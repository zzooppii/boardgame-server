import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2, } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2, initialGame: GameType = "SEVEN_WONDERS_DUEL") {
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
function duel(s:PlatformSnapshotV2){if(s.game?.gameType!=='SEVEN_WONDERS_DUEL')throw new Error('Duel required');return s.game;}
type Harness=Awaited<ReturnType<typeof harness>>;
async function start(h:Harness){const s=await h.sync();return h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));}
function action(h:Harness,s:PlatformSnapshotV2,optionId:string){const g=duel(s);assert.equal(g.phase,'PLAYING');if(g.phase!=='PLAYING')throw new Error('finished');return h.request('duel:act',{type:'SELECT',optionId},{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});}
test('DUEL sockets: settings are host-only, persisted, revision scoped, frozen at start; exact two players',async t=>{
 const h=await harness(t),before=await h.sync();
 assert.equal(h.failure(await h.call(h.members[1]!.client,'duel:configure',{pantheon:false,agora:false},{expectedRoomRevision:before.versions.roomRevision})),'HOST_ONLY');
 const configured=h.success(await h.call(h.host,'duel:configure',{pantheon:false,agora:true},{expectedRoomRevision:before.versions.roomRevision}));assert.equal(configured.room.gameType,'SEVEN_WONDERS_DUEL');if(configured.room.gameType==='SEVEN_WONDERS_DUEL'&&configured.room.phase==='LOBBY')assert.deepEqual(configured.room.settings,{pantheon:false,agora:true,turnDurationSeconds:60});
 assert.equal(h.failure(await h.call(h.host,'duel:configure',{pantheon:true,agora:false},{expectedRoomRevision:before.versions.roomRevision})),'STALE_ROOM_REVISION');const s=await start(h);assert.deepEqual(duel(s).settings,{pantheon:false,agora:true,turnDurationSeconds:60});assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===s.room.roomId),true);
 assert.equal(h.failure(await h.call(h.host,'duel:configure',{pantheon:true,agora:false},{expectedRoomRevision:s.versions.roomRevision})),'INVALID_PHASE');
 const solo=await harness(t,1);assert.equal(solo.failure(await solo.call(solo.host,'game:start',{}, {expectedRoomRevision:(await solo.sync()).versions.roomRevision})),'NOT_ENOUGH_PLAYERS');
});
test('DUEL sockets: authenticated choice, candidate rejection, request retry, races and capability checks',async t=>{
 const h=await harness(t),initial=await start(h),owner=h.members.find(m=>m.playerId===duel(initial).activePlayerId)!,opponent=h.members.find(m=>m!==owner)!,s=await h.sync(owner.client),g=duel(s),before=await h.server.runtime.persistence.findById(s.room.roomId);
 assert.equal(duel(await h.sync(opponent.client)).privateState.options.length,0);assert.equal(h.failure(await h.send(opponent.client,action(h,s,'option-0'))),'NOT_YOUR_TURN');
 assert.equal(h.failure(await h.send(owner.client,action(h,s,'option-9999'))),'RULE_VIOLATION');assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),before);
 const command=action(h,s,g.privateState.options[0]!.id);assert.equal(h.failure(await h.send(owner.client,{...command,turnId:'stale'})),'STALE_GAME_REVISION');
 const race=await Promise.all([h.send(owner.client,command),h.send(owner.client,{...command,requestId:'race'})]);assert.equal(race.filter(r=>v.parse(StateSyncWireAckSchema,r).ok).length,1);const after=await h.server.runtime.persistence.findById(s.room.roomId);h.success(await h.send(owner.client,command));assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),after);
 assert.equal(h.failure(await h.send(owner.client,{...command,payload:{type:'SELECT',optionId:'option-1'}})),'REQUEST_ID_REUSED');
 const unsupported=await h.connect(SUPPORTED_GAME_TYPES.filter(x=>x!=='SEVEN_WONDERS_DUEL'));assert.equal(h.failure(await h.call(unsupported,'session:resume',{credential:{...opponent.credential,roomCode:s.room.roomCode},lastSeenVersions:null})),'INCOMPATIBLE_GAME_CAPABILITY');
});
for (const settings of [{pantheon:true,agora:false},{pantheon:false,agora:true},{pantheon:true,agora:true}]) {
test(`DUEL sockets: complete expansion game ${JSON.stringify(settings)}, reconnect an unresolved choice, leave cancellation and rematch retain settings`,async t=>{
 const h=await harness(t),lobby=await h.sync();
 h.success(await h.call(h.host,'duel:configure',{...settings,turnDurationSeconds:0},{expectedRoomRevision:lobby.versions.roomRevision}));
 let s=await start(h),steps=0,reconnected=false;
 assert.deepEqual(duel(s).settings,{...settings,turnDurationSeconds:0});
 while(duel(s).phase==='PLAYING'&&steps++<350){const g=duel(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!;s=await h.sync(owner.client);
  if(!reconnected&&steps===2){owner.client.disconnect();const next=await h.connect();const resumed=h.success(await h.call(next,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.deepEqual(duel(resumed).privateState,duel(s).privateState);owner.client=next;s=resumed;reconnected=true;}
  const options=duel(s).privateState.options,o=options.find(o=>o.group==='DISCARD')??options.find(o=>o.group==='SKIP')??options[0]!;assert.ok(o);s=h.success(await h.send(owner.client,action(h,s,o.id)));
 }
 assert.ok(reconnected);assert.equal(duel(s).phase,'FINISHED');assert.equal(duel(s).gameRevision,steps);const host=h.members[0]!.client;s=h.success(await h.send(host,h.selection(s,'SEVEN_WONDERS_DUEL')));s=h.success(await h.call(host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));assert.equal(duel(s).gameRevision,0);assert.deepEqual(duel(s).settings,{...settings,turnDurationSeconds:0});
 const guest=h.members[1]!.client,gs=await h.sync(guest);const left=v.parse(RoomLeaveAckSchema,await h.call(guest,'room:leave',{}, {expectedRoomRevision:gs.versions.roomRevision,expectedGameRevision:duel(gs).gameRevision}));assert.ok(left.ok);const end=duel(await h.sync(host));assert.equal(end.phase,'FINISHED');if(end.phase==='FINISHED'){assert.equal(end.result.reason,'CANCELLED');assert.deepEqual(end.result.winnerPlayerIds,[]);}
});
}

test('DUEL timer: settings wire validation, deadline recovery, late input and duplicate timeout race',async t=>{
 const {DuelService}=await import('./games/seven-wonders-duel/application/service.js');const {DuelClientCommandSchema,ServerTimeSchema}=await import('@hangul-rummikub/shared');
 const h=await harness(t);let snapshot=await h.sync();
 for(const seconds of [30,90,60]){snapshot=h.success(await h.call(h.host,'duel:configure',{pantheon:false,agora:false,turnDurationSeconds:seconds},{expectedRoomRevision:snapshot.versions.roomRevision}));if(snapshot.room.gameType==='SEVEN_WONDERS_DUEL'&&snapshot.room.phase==='LOBBY')assert.equal(snapshot.room.settings.turnDurationSeconds,seconds);}
 assert.equal(h.failure(await h.call(h.host,'duel:configure',{pantheon:false,agora:false,turnDurationSeconds:45},{expectedRoomRevision:snapshot.versions.roomRevision})),'INVALID_PAYLOAD');
 snapshot=await start(h);const deadline=(await h.server.runtime.persistence.listActiveTurnDeadlines()).find(d=>d.roomId===snapshot.room.roomId)!;assert.ok(deadline);
 const owner=h.members.find(m=>m.playerId===duel(snapshot).activePlayerId)!;snapshot=await h.sync(owner.client);const g=duel(snapshot);assert.equal(g.phase,'PLAYING');if(g.phase!=='PLAYING')throw new Error('playing');assert.equal(g.deadlineAt,deadline.deadlineAt);assert.equal(duel(await h.sync()).gameRevision,g.gameRevision);
 let at=v.parse(ServerTimeSchema,deadline.deadlineAt-1);const service=new DuelService({...h.server.runtime.duelService!.deps,clock:{now:()=>at}});
 assert.equal((await service.timeout(deadline)).status,'NO_OP');at=deadline.deadlineAt;
 const late=await service.command({roomId:snapshot.room.roomId,actorPlayerId:owner.playerId,command:v.parse(DuelClientCommandSchema,action(h,snapshot,g.privateState.options[0]!.id)),receivedAt:at,authorization:{isCurrent:()=>true}});assert.equal(late.ok,false);if(!late.ok)assert.equal(late.error.code,'TURN_EXPIRED');
 const race=await Promise.all([service.timeout(deadline),service.timeout(deadline)]);assert.deepEqual(race.map(r=>r.status).sort(),['APPLIED','NO_OP']);
 const after=duel(await h.sync());assert.equal(after.gameRevision,g.gameRevision+1);assert.ok(after.history.at(-1)!.text.includes('시간 초과'));
 assert.equal((await service.timeout(deadline)).status,'NO_OP');assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).filter(d=>d.roomId===snapshot.room.roomId).length,1);
});

test('DUEL unlimited settings persist and running games have no scheduled deadline',async t=>{
 const h=await harness(t),before=await h.sync();h.success(await h.call(h.host,'duel:configure',{pantheon:false,agora:false,turnDurationSeconds:0},{expectedRoomRevision:before.versions.roomRevision}));
 const initial=await start(h),g=duel(initial);assert.equal(g.settings.turnDurationSeconds,0);assert.equal(g.phase,'PLAYING');if(g.phase==='PLAYING')assert.equal(g.deadlineAt,null);
 assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===initial.room.roomId),false);
 const owner=h.members.find(m=>m.playerId===g.activePlayerId)!;const own=await h.sync(owner.client);const next=h.success(await h.send(owner.client,action(h,own,duel(own).privateState.options[0]!.id)));assert.equal(duel(next).settings.turnDurationSeconds,0);
 assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===initial.room.roomId),false);
});
