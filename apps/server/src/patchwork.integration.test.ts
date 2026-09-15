import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2, patchworkPatch, patchworkFirstPlacement, patchworkScore, } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2, initialGame: GameType = "PATCHWORK") {
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
function patchwork(s:PlatformSnapshotV2){if(s.game?.gameType!=='PATCHWORK')throw new Error('Expected Patchwork');return s.game;}
type Harness=Awaited<ReturnType<typeof harness>>;
function action(h:Harness,s:PlatformSnapshotV2,payload:unknown){const g=patchwork(s);if(g.phase==='FINISHED')throw new Error('Finished');return h.request('patchwork:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});}
async function start(h:Harness){const s=await h.sync();return h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));}
function payload(s:PlatformSnapshotV2){const g=patchwork(s),p=g.playerStates.find(p=>p.playerId===g.activePlayerId)!;
 if(g.pendingLeather.length)return {type:'PLACE_LEATHER',tileId:g.pendingLeather[0]!.tileId,x:patchworkFirstPlacement(p.placements,0)!.x,y:patchworkFirstPlacement(p.placements,0)!.y};
 for(const t of g.market.slice(0,3)){if(p.buttons<patchworkPatch(t.patchId).cost)continue;const place=patchworkFirstPlacement(p.placements,t.patchId);if(place)return {type:'BUY',tileId:t.tileId,...place};}return {type:'ADVANCE'};
}
test('PATCHWORK sockets: exact 2 players, full public state, no deadline, capability and authenticated actor',async t=>{
 const h=await harness(t),s=await start(h),g=patchwork(s);assert.equal(g.playerStates.length,2);assert.equal(g.market.length,33);assert.equal(g.leather.length,5);assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===s.room.roomId),false);
 const owner=h.members.find(m=>m.playerId===g.activePlayerId)!,other=h.members.find(m=>m!==owner)!;assert.equal(h.failure(await h.send(other.client,action(h,s,payload(s)))),'NOT_YOUR_TURN');
 const unsupported=await h.connect(SUPPORTED_GAME_TYPES.filter(x=>x!=='PATCHWORK'));assert.equal(h.failure(await h.call(unsupported,'session:resume',{credential:{...other.credential,roomCode:s.room.roomCode},lastSeenVersions:null})),'INCOMPATIBLE_GAME_CAPABILITY');
 for(const member of h.members){const projection=patchwork(await h.sync(member.client));assert.equal(projection.privateState.playerId,member.playerId);assert.deepEqual(projection.market,g.market);assert.deepEqual(projection.playerStates,g.playerStates);assert.equal(JSON.stringify(projection).includes('sessionToken'),false);}
 for(const count of [1,3]){const bad=await harness(t,count,count===3?'PERCH':'PATCHWORK');let state=await bad.sync();if(count===3)state=bad.success(await bad.send(bad.host,bad.selection(state,'PATCHWORK')));assert.equal(bad.failure(await bad.call(bad.host,'game:start',{}, {expectedRoomRevision:state.versions.roomRevision})),'NOT_ENOUGH_PLAYERS');}
});
test('PATCHWORK sockets: atomic rejection, racing turns, idempotency, stale game and changed request',async t=>{
 const h=await harness(t),s=await start(h),g=patchwork(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!,before=await h.server.runtime.persistence.findById(s.room.roomId);
 for(const tileId of [g.market[3]!.tileId,'not-a-tile'])assert.equal(h.failure(await h.send(owner.client,action(h,s,{type:'BUY',tileId,x:0,y:0,rotation:0,flipped:false}))),'RULE_VIOLATION');
 assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),before);
 assert.equal(h.failure(await h.send(owner.client,action(h,s,{type:'ADVANCE',buttons:100}))),'INVALID_PAYLOAD');
 const c=action(h,s,{type:'ADVANCE'});assert.equal(h.failure(await h.send(owner.client,{...c,turnId:'old'})),'STALE_GAME_REVISION');
 const race=await Promise.all([h.send(owner.client,c),h.send(owner.client,{...c,requestId:'race'})]);assert.equal(race.filter(x=>v.parse(StateSyncWireAckSchema,x).ok).length,1);
 const after=await h.server.runtime.persistence.findById(s.room.roomId);h.success(await h.send(owner.client,c));assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),after);assert.equal(h.failure(await h.send(owner.client,{...c,payload:{type:'BUY',tileId:g.market[0]!.tileId,x:0,y:0,rotation:0,flipped:false}})),'REQUEST_ID_REUSED');
});
test('PATCHWORK sockets: full game, pending leather reconnect, exact result, same-room rematch and switch',async t=>{
 const h=await harness(t);let s=await start(h),count=0,reconnected=false,buys=0,leathers=0;const originalId=patchwork(s).gameId;
 while(patchwork(s).phase!=='FINISHED'&&count++<120){const g=patchwork(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!;
  if(g.pendingLeather.length&&!reconnected){owner.client.disconnect();const replacement=await h.connect(),resumed=h.success(await h.call(replacement,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.deepEqual(patchwork(resumed).pendingLeather,g.pendingLeather);assert.deepEqual(patchwork(resumed).playerStates,g.playerStates);owner.client=replacement;s=resumed;reconnected=true;}
  const a=payload(s);if(a.type==='BUY')buys++;if(a.type==='PLACE_LEATHER')leathers++;s=h.success(await h.send(owner.client,action(h,s,a)));
 }
 const end=patchwork(s);assert.equal(end.phase,'FINISHED');assert.ok(buys>5);assert.ok(leathers>0&&reconnected);if(end.phase==='FINISHED'){assert.equal(end.result.reason,'SCORED');const winner=end.playerStates.find(p=>p.playerId===end.result.winnerPlayerIds[0])!;assert.equal(patchworkScore(winner,end.bonusOwner).total,Math.max(...end.playerStates.map(p=>patchworkScore(p,end.bonusOwner).total)));}
 const host=h.members[0]!.client;s=h.success(await h.send(host,h.selection(s,'PATCHWORK')));s=h.success(await h.call(host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));assert.notEqual(patchwork(s).gameId,originalId);assert.ok(patchwork(s).playerStates.every(p=>p.buttons===5&&p.placements.length===0));
 const guest=h.members[1]!.client,guestState=await h.sync(guest);const left=v.parse(RoomLeaveAckSchema,await h.call(guest,'room:leave',{}, {expectedRoomRevision:guestState.versions.roomRevision,expectedGameRevision:patchwork(guestState).gameRevision}));assert.ok(left.ok);s=await h.sync(host);const cancelled=patchwork(s);assert.equal(cancelled.phase,'FINISHED');if(cancelled.phase==='FINISHED')assert.equal(cancelled.result.reason,'CANCELLED');
 const switched=h.success(await h.send(host,h.selection(s,'NUMBER_TILE')));assert.equal(switched.room.phase,'LOBBY');assert.equal(switched.room.roomCode,s.room.roomCode);assert.equal(switched.room.gameType,'NUMBER_TILE');
});
