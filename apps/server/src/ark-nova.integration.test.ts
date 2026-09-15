import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import {
  SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema,
  StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2,
} from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
import type { ArkSoloCommand } from "@hangul-rummikub/shared";

type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = { kind: string; protocolVersion: number; requestId: string; payload: unknown; [key: string]: unknown };
async function harness(t: TestContext, count = 1) {
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
  let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: count > 1 ? "WOLF_NIGHT" : "ARK_NOVA" }));
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

function ark(snapshot:PlatformSnapshotV2) {
  if(snapshot.game?.gameType!=='ARK_NOVA')throw new Error('Expected Ark Nova game.');
  return snapshot.game;
}
test('ARK_NOVA socket solo: one player, private setup, reconnect, receipts and all 27 turns through scoring',async t=>{
  const h=await harness(t), outsider=await h.connect(),credential=await h.bootstrap(outsider);
  let snapshot=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:h.lobby.versions.roomRevision}));
  assert.equal(h.failure(await h.call(outsider,'room:join',{bootstrapCredential:credential,nickname:'참가자',roomCode:h.lobby.room.roomCode})),'ROOM_NOT_JOINABLE');
  assert.equal(ark(snapshot).state.hand.length,8);
  assert.equal(Object.hasOwn(ark(snapshot).state,'zooDeck'),false);
  assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===snapshot.room.roomId),false);
  const initial=ark(snapshot), replacement=await h.connect();
  snapshot=h.success(await h.call(replacement,'session:resume',{credential:{...h.members[0]!.credential,roomCode:snapshot.room.roomCode},lastSeenVersions:null}));
  assert.deepEqual(ark(snapshot),initial);
  let steps=0;
  while(ark(snapshot).phase!=='FINISHED') {
    assert.ok(++steps<40);
    const g=ark(snapshot),s=g.state;
    const payload:ArkSoloCommand=s.progress.stage==='SETUP'?{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)}:
      s.pending?.kind==='BREAK_DISCARD'?{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)}:
      s.pending?.kind==='FINAL_GOAL'?{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId}:{kind:'FUNDRAISE',x:0};
    const command=h.request('arkNova:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:s.transitionId});
    if(steps===1)assert.equal(h.failure(await h.send(h.host,command)),'UNAUTHENTICATED');
    snapshot=h.success(await h.send(replacement,command));
    assert.equal(ark(snapshot).gameRevision,g.gameRevision+1);
    const replay=h.success(await h.send(replacement,command));
    assert.deepEqual(ark(replay),ark(snapshot));
    assert.equal(h.failure(await h.send(replacement,{...command,requestId:command.requestId+'-stale'})),ark(snapshot).phase==='FINISHED'?'INVALID_PHASE':'STALE_GAME_REVISION');
  }
  assert.equal(ark(snapshot).state.progress.turnsCompleted,27);
  assert.equal(snapshot.room.phase,'FINISHED');
  const saved=await h.server.runtime.persistence.findById(snapshot.room.roomId);
  assert.equal(saved?.gameType,'ARK_NOVA');assert.equal(saved?.phase,'FINISHED');
  const left=v.parse(RoomLeaveAckSchema,await h.call(replacement,'room:leave',{}, {expectedRoomRevision:snapshot.versions.roomRevision,expectedGameRevision:ark(snapshot).gameRevision}));
  assert.ok(left.ok);assert.equal(await h.server.runtime.persistence.findById(snapshot.room.roomId),null);
});

test('ARK_NOVA refuses a five-player room selection atomically and explicit playing leave removes the solo room',async t=>{
  const group=await harness(t,5),before=await group.sync();
  const stored=await group.server.runtime.persistence.findById(before.room.roomId);
  assert.equal(group.failure(await group.send(group.host,group.selection(before,'ARK_NOVA'))),'ROOM_FULL');
  assert.deepEqual(await group.server.runtime.persistence.findById(before.room.roomId),stored);
  const h=await harness(t),started=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:h.lobby.versions.roomRevision}));
  const left=v.parse(RoomLeaveAckSchema,await h.call(h.host,'room:leave',{}, {expectedRoomRevision:started.versions.roomRevision,expectedGameRevision:ark(started).gameRevision}));
  assert.ok(left.ok);assert.equal(await h.server.runtime.persistence.findById(started.room.roomId),null);
});

for(const count of [2,3,4])test(`ARK_NOVA ${count}-player sockets: shared turns, private hands, reconnect and idempotent commands`,async t=>{
  const h=await harness(t,count);
  h.success(await h.send(h.host,h.selection(await h.sync(),'ARK_NOVA')));
  const ready=await h.readyAll();
  let snapshot=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:ready.versions.roomRevision}));
  for(const member of h.members){
    const own=ark(await h.sync(member.client));
    assert.equal(own.state.table?.players.length,count);
    assert.equal(own.state.hand.length,8);
    for(const other of h.members.filter(m=>m!==member)){
      const view=ark(await h.sync(other.client)).state;
      for(const card of [...own.state.hand,...own.state.goals])assert.ok(!JSON.stringify(view).includes(JSON.stringify(card.cardId)));
    }
    snapshot=h.success(await h.call(member.client,'arkNova:act',{kind:'INITIAL_HAND',keep:own.state.hand.slice(0,4).map(c=>c.cardId)},{gameId:own.gameId,expectedGameRevision:own.gameRevision,turnId:own.state.transitionId}));
  }
  assert.equal(ark(snapshot).state.table!.stage,'ACTION');
  const active=h.members.find(m=>m.playerId===ark(snapshot).state.table!.activePlayerId)!;
  const before=ark(await h.sync(active.client));
  const replacement=await h.connect();
  const resumed=h.success(await h.call(replacement,'session:resume',{credential:{...active.credential,roomCode:snapshot.room.roomCode},lastSeenVersions:null}));
  assert.deepEqual(ark(resumed),before);
  const command=h.request('arkNova:act',{kind:'FUNDRAISE',x:0},{gameId:before.gameId,expectedGameRevision:before.gameRevision,turnId:before.state.transitionId});
  const wrong=h.members.find(m=>m.playerId!==active.playerId)!;
  assert.equal(h.failure(await h.send(wrong.client,command)),'RULE_VIOLATION');
  assert.deepEqual(ark(await h.sync(replacement)),before);
  snapshot=h.success(await h.send(replacement,command));
  assert.notEqual(ark(snapshot).state.table!.activePlayerId,active.playerId);
  assert.deepEqual(ark(h.success(await h.send(replacement,command))),ark(snapshot));
  const selfView=ark(snapshot).state;
  for(const member of h.members.filter(m=>m.playerId!==active.playerId)){
    const other=ark(await h.sync(member.client));
    assert.equal(other.gameRevision,ark(snapshot).gameRevision);
    assert.deepEqual(other.state.display,selfView.display);
    assert.deepEqual(other.state.table,selfView.table);
    for(const card of selfView.hand)assert.ok(!JSON.stringify(other.state).includes(JSON.stringify(card.cardId)));
  }
});
