import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2, type HarmoniesStep, harmoniesScore, harmoniesAnimal, } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2, initialGame: GameType = "HARMONIES") {
    const server = createHttpServer({ serveWeb: false }), clients: Client[] = [];
    t.after(async () => { clients.forEach(c => c.disconnect()); await server.shutdown(); });
    await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    let seq = 0;
    const request = (kind: string, payload: unknown = {}, extra: Record<string, unknown> = {}): Command => ({ kind, protocolVersion: 1, requestId: `room-prepare-${++seq}`, payload, ...extra });
    async function connect(types: readonly GameType[] = SUPPORTED_GAME_TYPES) {
        const client: Client = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { supportsRoomPreparation: true, supportedSnapshotVersions: [2], supportedGameTypes: types } });
        clients.push(client);
        await new Promise<void>((resolve, reject) => { client.once("connect", resolve); client.once("connect_error", reject); });
        return client;
    }
    const send = (client: Client, command: Command) => new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Missing ${command.kind} acknowledgement`)), 5000);
        client.emit(command.kind, command, value => { clearTimeout(timer); resolve(value); });
    });
    const call = (client: Client, kind: string, payload: unknown = {}, extra: Record<string, unknown> = {}) => send(client, request(kind, payload, extra));
    const success = (raw: unknown) => { const ack = v.parse(StateSyncWireAckSchema, raw); assert.ok(ack.ok, ack.ok ? "" : JSON.stringify(ack.error)); return v.parse(PlatformSnapshotV2Schema, ack.data.snapshot); };
    const failure = (raw: unknown) => { const ack = v.parse(StateSyncWireAckSchema, raw); assert.equal(ack.ok, false); if (ack.ok)
        throw new Error("Expected failure"); return ack.error.code; };
    const bootstrap = async (client: Client) => { const ack = v.parse(SessionBootstrapAckSchema, await call(client, "session:bootstrap")); assert.ok(ack.ok); return ack.data.credential; };
    const host = await connect(), hostCredential = await bootstrap(host);
    let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: initialGame }));
    const members = [{ client: host, credential: hostCredential, playerId: lobby.self.playerId }];
    for (let i = 1; i < count; i++) {
        const client = await connect(), credential = await bootstrap(client);
        lobby = success(await call(client, "room:join", { bootstrapCredential: credential, nickname: `참가${i}`, roomCode: lobby.room.roomCode }));
        members.push({ client, credential, playerId: lobby.self.playerId });
    }
    const sync = async (client = host) => success(await call(client, "state:sync"));
    function selection(snapshot: PlatformSnapshotV2, gameType: GameType): Command {
        const game = snapshot.game;
        return request("room:selectGame", { gameType, gameId: game === null ? null : "gameId" in game ? game.gameId : game.publicState.gameId }, {
            expectedRoomRevision: snapshot.versions.roomRevision, expectedGameRevision: game?.gameRevision ?? null,
        });
    }
    async function readyAll() {
        for (const member of members) {
            const current = await sync(member.client);
            success(await call(member.client, "room:ready", { ready: true }, { expectedRoomRevision: current.versions.roomRevision }));
        }
        return sync();
    }
    return { server, host, members, lobby, connect, bootstrap, request, send, call, success, failure, sync, selection, readyAll };
}
function harmonies(snapshot: PlatformSnapshotV2) { if (snapshot.game?.gameType !== 'HARMONIES')
    throw new Error('Expected Harmonies'); return snapshot.game; }
type Harness = Awaited<ReturnType<typeof harness>>;
function action(h: Harness, s: PlatformSnapshotV2, payload: unknown) { const g = harmonies(s); if (g.phase === 'FINISHED')
    throw new Error('Finished'); return h.request('harmonies:act', payload, { gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId }); }
async function start(h: Harness) { const s = await h.sync(); return h.success(await h.call(h.host, 'game:start', {}, { expectedRoomRevision: s.versions.roomRevision })); }
function turnPayload(s:PlatformSnapshotV2){const g=harmonies(s),p=g.playerStates.find(p=>p.playerId===g.activePlayerId)!,source=g.markets.findIndex(m=>m.length===3),empty=p.board.flatMap((c,i)=>c.stack.length?[]:[i]);const steps:HarmoniesStep[]=[{type:'TAKE_TOKENS',source},...g.markets[source]!.map((token,i)=>({type:'PLACE' as const,tileId:token.tileId,cell:empty[i]!}))];if(g.animalMarket[0]!==undefined&&p.cards.filter(c=>c.placed<harmoniesAnimal(c.cardId).points.length).length<4)steps.unshift({type:'TAKE_ANIMAL',cardId:g.animalMarket[0]});return {type:'SUBMIT_TURN',steps};}
test('HARMONIES sockets: 2/3/4 player admission, hidden bag/deck, strict actor and capabilities',async t=>{
 for(const count of [2,3,4]){const h=await harness(t,count),s=await start(h),g=harmonies(s);assert.equal(g.phase,'PLAYING');assert.equal(g.playerStates.length,count);assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===s.room.roomId),false);
 for(const member of h.members){const projection=harmonies(await h.sync(member.client));assert.equal(projection.privateState.playerId,member.playerId);assert.equal('bag' in projection,false);assert.equal('deck' in projection,false);assert.equal(projection.playerStates[0]!.board.length,23);}
 const owner=h.members.find(m=>m.playerId===g.activePlayerId)!,other=h.members.find(m=>m!==owner)!,command=action(h,s,turnPayload(s));assert.equal(h.failure(await h.send(other.client,command)),'NOT_YOUR_TURN');assert.equal(h.failure(await h.send(owner.client,{...command,payload:{...turnPayload(s),score:900}})),'INVALID_PAYLOAD');
 const unsupported=await h.connect(SUPPORTED_GAME_TYPES.filter(x=>x!=='HARMONIES'));assert.equal(h.failure(await h.call(unsupported,'session:resume',{credential:{...other.credential,roomCode:s.room.roomCode},lastSeenVersions:null})),'INCOMPATIBLE_GAME_CAPABILITY');
 }
 for(const count of [1,5]){const h=await harness(t,count,count===5?'PERCH':'HARMONIES');let s=await h.sync();if(count===5)s=h.success(await h.send(h.host,h.selection(s,'HARMONIES')));assert.equal(h.failure(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision})),'NOT_ENOUGH_PLAYERS');}
});
test('HARMONIES sockets: racing turns, stale revision, altered request replay, unseen tile references are atomic',async t=>{
 const h=await harness(t),s=await start(h),g=harmonies(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!,c=action(h,s,turnPayload(s));
 const before=await h.server.runtime.persistence.findById(s.room.roomId);assert.ok(before?.gameType==='HARMONIES'&&before.game);const payload=turnPayload(s),i=payload.steps.findIndex(a=>a.type==='PLACE');
 for(const id of [before.game.state.bag[0]!.tileId,'nonexistent']){const steps=payload.steps.map((a,index)=>index===i?{type:'PLACE',tileId:id,cell:0}:a);assert.equal(h.failure(await h.send(owner.client,action(h,s,{type:'SUBMIT_TURN',steps}))),'RULE_VIOLATION');}
 assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),before);
 assert.equal(h.failure(await h.send(owner.client,{...c,turnId:'stale'})),'STALE_GAME_REVISION');
 const race=await Promise.all([h.send(owner.client,c),h.send(owner.client,{...c,requestId:'race'})]);assert.equal(race.filter(r=>v.parse(StateSyncWireAckSchema,r).ok).length,1);
 const committed=await h.server.runtime.persistence.findById(s.room.roomId);h.success(await h.send(owner.client,c));assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),committed);
 assert.equal(h.failure(await h.send(owner.client,{...c,payload:{...payload,steps:payload.steps.slice().reverse()}})),'REQUEST_ID_REUSED');
});
test('HARMONIES sockets: reconnect retains landscape; departure cancels; same room starts fresh and switches games',async t=>{
 const h=await harness(t,3);let s=await start(h),g=harmonies(s);const owner=h.members.find(m=>m.playerId===g.activePlayerId)!;
 s=h.success(await h.send(owner.client,action(h,s,turnPayload(s))));g=harmonies(s);const guest=h.members[1]!,before=harmonies(await h.sync(guest.client));guest.client.disconnect();const replacement=await h.connect();const resumed=h.success(await h.call(replacement,'session:resume',{credential:{...guest.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.deepEqual(harmonies(resumed).playerStates,before.playerStates);assert.equal(resumed.self.playerId,guest.playerId);
 const leave=v.parse(RoomLeaveAckSchema,await h.call(replacement,'room:leave',{}, {expectedRoomRevision:resumed.versions.roomRevision,expectedGameRevision:before.gameRevision}));assert.ok(leave.ok);s=await h.sync();const end=harmonies(s);assert.equal(end.phase,'FINISHED');if(end.phase==='FINISHED')assert.equal(end.result.reason,'CANCELLED');
 h.success(await h.send(h.host,h.selection(s,'HARMONIES')));s=await start(h);assert.notEqual(harmonies(s).gameId,g.gameId);assert.equal(harmonies(s).playerStates.length,2);assert.ok(harmonies(s).playerStates.every(p=>p.board.every(c=>c.stack.length===0)));
});
test('HARMONIES sockets: complete match, exact final score and same-room game selection',async t=>{
 const h=await harness(t,4);let s=await start(h),turns=0;
 while(harmonies(s).phase!=='FINISHED'&&turns++<40){const g=harmonies(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!;s=h.success(await h.send(owner.client,action(h,s,turnPayload(s))));}
 const g=harmonies(s);assert.equal(g.phase,'FINISHED');assert.equal(turns,28);if(g.phase==='FINISHED'){assert.equal(g.result.reason,'SCORED');assert.ok(g.result.winnerPlayerIds.length);const best=Math.max(...g.playerStates.map(p=>harmoniesScore(p.board,p.cards).total));assert.ok(g.result.winnerPlayerIds.every(id=>{const p=g.playerStates.find(p=>p.playerId===id)!;return harmoniesScore(p.board,p.cards).total===best;}));}
 const next=h.success(await h.send(h.host,h.selection(s,'NUMBER_TILE')));assert.equal(next.room.phase,'LOBBY');assert.equal(next.room.roomCode,s.room.roomCode);assert.equal(next.room.gameType,'NUMBER_TILE');
});
