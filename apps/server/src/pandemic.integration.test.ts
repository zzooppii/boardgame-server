import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import {
  SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema,
  StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2,
  RequestIdSchema, ServerTimeSchema,
} from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";


type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = { kind: string; protocolVersion: number; requestId: string; payload: unknown; [key: string]: unknown };
async function harness(t: TestContext, count = 2) {
  const server = createHttpServer({ serveWeb: false }), clients: Client[] = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await server.shutdown(); });
  await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
  const address = server.httpServer.address(); assert.ok(address && typeof address !== "string");
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
  const failure = (raw: unknown) => { const ack = v.parse(StateSyncWireAckSchema, raw); assert.equal(ack.ok, false); if (ack.ok) throw new Error("Expected failure"); return ack.error.code; };
  const bootstrap = async (client: Client) => { const ack = v.parse(SessionBootstrapAckSchema, await call(client, "session:bootstrap")); assert.ok(ack.ok); return ack.data.credential; };
  const host = await connect(), hostCredential = await bootstrap(host);
  let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: count > 4 ? "WOLF_NIGHT" : "PANDEMIC" }));
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
function pandemic(snapshot:PlatformSnapshotV2){if(snapshot.game?.gameType!=='PANDEMIC')throw new Error('Expected Pandemic');return snapshot.game;}
type Harness=Awaited<ReturnType<typeof harness>>;
function action(h:Harness,s:PlatformSnapshotV2,payload:unknown){const g=pandemic(s);if(g.phase==='FINISHED')throw new Error('Finished');return h.request('pandemic:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});}
async function start(h:Harness){const s=await h.sync();return h.success(await h.call(h.host,'game:start',{},{expectedRoomRevision:s.versions.roomRevision}));}
async function begin(h:Harness){const s=await start(h);return h.success(await h.send(h.host,action(h,s,{type:'BEGIN'})));}
test('PANDEMIC Socket.IO: 2–4 players, strict projection, no timers, resumed identity and unsupported client rejection',async t=>{for(const n of [2,3,4]){const h=await harness(t,n),s=await begin(h);assert.equal(pandemic(s).phase,'ACTIONS');assert.equal(pandemic(s).playerStates.length,n);assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===s.room.roomId),false);for(const member of h.members){const view=pandemic(await h.sync(member.client));assert.equal(view.privateState.playerId,member.playerId);assert.ok(view.playerStates.every(p=>p.hand!==null));assert.equal('infectionDeck' in view,false);}const unsupported=await h.connect(SUPPORTED_GAME_TYPES.filter(x=>x!=='PANDEMIC'));assert.equal(h.failure(await h.call(unsupported,'session:resume',{credential:{...h.members[1]!.credential,roomCode:s.room.roomCode},lastSeenVersions:null})),'INCOMPATIBLE_GAME_CAPABILITY');}});
test('PANDEMIC Socket.IO: actor ownership, forged state, stale revision, idempotency and simultaneous mutation',async t=>{const h=await harness(t),s=await begin(h),g=pandemic(s),owner=h.members.find(m=>m.playerId===g.activePlayerId)!,other=h.members.find(m=>m!==owner)!,command=action(h,s,{type:'END_ACTIONS'});assert.equal(h.failure(await h.send(other.client,command)),'RULE_VIOLATION');assert.equal(h.failure(await h.send(owner.client,{...command,payload:{type:'END_ACTIONS',actionsLeft:99}})),'INVALID_PAYLOAD');assert.equal(h.failure(await h.send(owner.client,{...command,turnId:'wrong'})),'STALE_GAME_REVISION');const result=await Promise.all([h.send(owner.client,command),h.send(owner.client,{...command,requestId:'concurrent'})]);assert.equal(result.filter(x=>v.parse(StateSyncWireAckSchema,x).ok).length,1);const before=await h.server.runtime.persistence.findById(s.room.roomId);h.success(await h.send(owner.client,command));assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),before);assert.equal(h.failure(await h.send(owner.client,{...command,payload:{type:'CONTINUE'}})),'REQUEST_ID_REUSED');});
test('PANDEMIC Socket.IO: full turn boundaries wait for all members and reconnect restores confirmation',async t=>{const h=await harness(t,3);let s=await begin(h);const initial=pandemic(s).activePlayerId,owner=h.members.find(m=>m.playerId===initial)!;h.success(await h.send(owner.client,action(h,s,{type:'END_ACTIONS'})));s=await h.sync();h.success(await h.send(h.host,action(h,s,{type:'CONTINUE'})));assert.equal(pandemic(await h.sync()).phase,'DRAW');const guest=h.members[1]!,replacement=await h.connect();const resumed=h.success(await h.call(replacement,'session:resume',{credential:{...guest.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.ok(pandemic(resumed).continueReady.includes(h.members[0]!.playerId));guest.client=replacement;for(let i=0;i<30&&pandemic(await h.sync()).activePlayerId===initial;i++){s=await h.sync();const g=pandemic(s);if(g.phase==='FINISHED')break;for(const member of h.members){const view=await h.sync(member.client),pg=pandemic(view),p=pg.playerStates.find(p=>p.playerId===member.playerId)!;if(p.handCount>7&&pg.epidemicsRemaining===0){h.success(await h.send(member.client,action(h,view,{type:'DISCARD',cardId:p.hand![0]!.cardId})));break;}if(!pg.continueReady.includes(member.playerId)){h.success(await h.send(member.client,action(h,view,{type:'CONTINUE'})));}}}assert.notEqual(pandemic(await h.sync()).activePlayerId,initial);});
test('PANDEMIC Socket.IO: private hands, only host configures, explicit leave cancels and same-room rematch rejects old game',async t=>{const h=await harness(t,3);let s=await start(h);assert.equal(h.failure(await h.send(h.members[1]!.client,action(h,s,{type:'CONFIGURE',epidemics:5,openHands:false}))),'RULE_VIOLATION');s=h.success(await h.send(h.host,action(h,s,{type:'CONFIGURE',epidemics:5,openHands:false})));s=h.success(await h.send(h.host,action(h,s,{type:'BEGIN'})));const g=pandemic(s),old=action(h,s,{type:'CONTINUE'});assert.equal(g.playerStates[1]!.hand,null);const guest=h.members[1]!,view=await h.sync(guest.client);const leave=v.parse(RoomLeaveAckSchema,await h.call(guest.client,'room:leave',{},{expectedRoomRevision:view.versions.roomRevision,expectedGameRevision:pandemic(view).gameRevision}));assert.ok(leave.ok);s=await h.sync();const finished=pandemic(s);assert.equal(finished.phase,'FINISHED');if(finished.phase==='FINISHED')assert.equal(finished.result.reason,'CANCELLED');const lobby=h.success(await h.send(h.host,h.selection(s,'PANDEMIC')));assert.equal(lobby.room.roomCode,s.room.roomCode);s=await start(h);assert.notEqual(pandemic(s).gameId,g.gameId);assert.equal(h.failure(await h.send(h.host,{...old,requestId:'old-game'})),'STALE_GAME_REVISION');});
test('PANDEMIC Socket.IO: finished host succession permits room reuse',async t=>{const h=await harness(t,3),s=await begin(h),room=await h.server.runtime.persistence.findById(s.room.roomId);assert.ok(room?.gameType==='PANDEMIC'&&room.game);const {cancelPandemic}=await import('./games/pandemic/domain/game.js');const {transitionPandemic}=await import('./games/pandemic/application/service.js');const at=h.server.runtime.clock.now();const result=await h.server.runtime.persistence.commit({roomMutation:{kind:'REPLACE',candidate:transitionPandemic(room,cancelPandemic(room.game.state,at),at),expectedRoomRevision:room.roomRevision,expectedStorageRevision:room.storageRevision},sessionMutation:{kind:'NONE'},idempotency:{scopeKey:'pandemic-fixture',requestId:v.parse(RequestIdSchema,'finish'),payloadFingerprint:'finish',terminalResult:{ok:true},createdAt:at}});assert.equal(result.status,'COMMITTED');h.host.disconnect();await h.sync(h.members[1]!.client);t.mock.method(h.server.runtime.clock,'now',()=>v.parse(ServerTimeSchema,at+61_000));assert.equal(await h.server.runtime.pandemicHostSuccession!.evaluate(s.room.roomId),true);const view=await h.sync(h.members[1]!.client);assert.ok(view.room.players.find(p=>p.playerId===view.self.playerId)?.isHost);h.success(await h.send(h.members[1]!.client,h.selection(view,'NUMBER_TILE')));});
