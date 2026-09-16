import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import {
  SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema,
  StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2,
} from "@hangul-rummikub/shared";
import { createApplicationRuntime } from "./composition-root.js";
import { createHttpServer } from "./server.js";

type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = { kind: string; protocolVersion: number; requestId: string; payload: unknown; [key: string]: unknown };
async function harness(t: TestContext, count = 2) {
  const server = createHttpServer({ serveWeb: false, runtime: createApplicationRuntime() }), clients: Client[] = [];
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
  let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: count > 2 ? "WOLF_NIGHT" : "GREAT_KINGDOM" }));
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

function greatKingdom(snapshot: PlatformSnapshotV2) {
  if(snapshot.game?.gameType!=='GREAT_KINGDOM')throw new Error('Expected Great Kingdom game.');
  return snapshot.game;
}
type Harness=Awaited<ReturnType<typeof harness>>;
async function start(h:Harness){const s=await h.sync();return h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));}
function action(h:Harness,s:PlatformSnapshotV2,payload:unknown){const g=greatKingdom(s);if(g.phase!=='PLAYING')throw new Error('Expected playing Great Kingdom.');return h.request('greatKingdom:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});}

test('GREAT_KINGDOM admission and capabilities: exactly two and preserved oversized lobby', async t => {
  const single = await harness(t, 1), one = await single.sync();
  assert.equal(single.failure(await single.call(single.host, 'game:start', {}, {expectedRoomRevision: one.versions.roomRevision})), 'NOT_ENOUGH_PLAYERS');
  const incompatible = await single.connect(['JAIPUR']), incompatibleToken = await single.bootstrap(incompatible);
  assert.equal(single.failure(await single.call(incompatible, 'room:join', {bootstrapCredential: incompatibleToken, nickname: '구버전', roomCode: single.lobby.room.roomCode})), 'INCOMPATIBLE_GAME_CAPABILITY');
  const h = await harness(t), outsider = await h.connect(), credential = await h.bootstrap(outsider);
  assert.equal(h.failure(await h.call(outsider, 'room:join', {bootstrapCredential: credential, nickname: '셋째', roomCode: h.lobby.room.roomCode})), 'ROOM_FULL');
  const started = await start(h); assert.equal(started.room.phase, 'PLAYING');
  assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d => d.roomId === started.room.roomId), false);
  const large = await harness(t, 3); const switched = large.success(await large.send(large.host, large.selection(await large.sync(), 'GREAT_KINGDOM')));
  assert.equal(switched.room.players.length, 3);
  assert.equal(large.failure(await large.call(large.host, 'game:start', {}, {expectedRoomRevision: switched.versions.roomRevision})), 'NOT_ENOUGH_PLAYERS');
});
test('GREAT_KINGDOM sockets enforce actor, strict payload, revision, idempotency and public board',async t=>{
  const h=await harness(t),s=await start(h),g=greatKingdom(s);if(g.phase!=='PLAYING')throw new Error();
  const actor=h.members.find(p=>p.playerId===g.activePlayerId)!,other=h.members.find(p=>p!==actor)!;
  const before=await h.server.runtime.persistence.findById(s.room.roomId);
  assert.equal(h.failure(await h.send(other.client,action(h,s,{kind:'PLACE',position:1}))),'NOT_YOUR_TURN');
  assert.equal(h.failure(await h.send(actor.client,action(h,s,{kind:'PLACE',position:40}))),'RULE_VIOLATION');
  for(const payload of [{kind:'PLACE',position:81},{kind:'PLACE',position:1.5},{kind:'PASS',position:0},{kind:'PLACE',position:0,playerId:other.playerId}])assert.equal(h.failure(await h.send(actor.client,action(h,s,payload))),'INVALID_PAYLOAD');
  assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),before);
  const cmd=action(h,s,{kind:'PLACE',position:1});(await Promise.all([h.send(actor.client,cmd),h.send(actor.client,cmd)])).forEach(h.success);
  const after=greatKingdom(await h.sync());assert.equal(after.gameRevision,1);assert.equal(after.board[1]?.color,'BLUE');assert.deepEqual(after,greatKingdom(await h.sync(other.client)));
  assert.equal(h.failure(await h.send(actor.client,{...cmd,requestId:'new-stale'})),'STALE_GAME_REVISION');
  assert.equal(h.failure(await h.send(actor.client,{...cmd,payload:{kind:'PASS'}})),'REQUEST_ID_REUSED');
  assert.ok(before?.gameType==='GREAT_KINGDOM'&&before.game);
  for(const id of before.game.state.players.flatMap(p=>p.reserve))assert.equal(JSON.stringify(g).includes(JSON.stringify(id)),false);
});
test('GREAT_KINGDOM siege finish and rematch replace identity; two passes finish territory scoring',async t=>{
  const h=await harness(t);let s=await start(h);const firstId=greatKingdom(s).gameId;
  async function move(position:number|null){const g=greatKingdom(s);if(g.phase!=='PLAYING')throw new Error();const actor=h.members.find(p=>p.playerId===g.activePlayerId)!;s=h.success(await h.send(actor.client,action(h,s,position===null?{kind:'PASS'}:{kind:'PLACE',position})));}
  for(const position of [1,0,9])await move(position);
  let g=greatKingdom(s);assert.equal(g.phase,'FINISHED');if(g.phase!=='FINISHED')throw new Error();assert.equal(g.result.reason,'SIEGE');assert.deepEqual(g.result.destroyedPositions,[0]);
  const lobby=h.success(await h.send(h.host,h.selection(await h.sync(),'GREAT_KINGDOM')));assert.equal(lobby.room.roomCode,s.room.roomCode);assert.equal(lobby.game,null);
  s=await start(h);assert.notEqual(greatKingdom(s).gameId,firstId);await move(null);await move(null);g=greatKingdom(s);assert.equal(g.phase,'FINISHED');if(g.phase!=='FINISHED')throw new Error();assert.equal(g.result.reason,'TERRITORY');assert.deepEqual(g.result.winnerPlayerIds,[]);
});
test('GREAT_KINGDOM resume preserves board, old socket loses authority, explicit leave cancels',async t=>{
  const h=await harness(t),s=await start(h),g=greatKingdom(s);if(g.phase!=='PLAYING')throw new Error();
  const member=h.members.find(p=>p.playerId===g.activePlayerId)!,other=h.members.find(p=>p!==member)!;
  h.success(await h.send(member.client,action(h,s,{kind:'PLACE',position:1})));
  const fresh=await h.connect(),resumed=h.success(await h.call(fresh,'session:resume',{credential:{...member.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));
  assert.equal(greatKingdom(resumed).board[1]?.color,'BLUE');assert.equal(resumed.self.playerId,member.playerId);
  assert.equal(h.failure(await h.send(member.client,action(h,resumed,{kind:'PASS'}))),'UNAUTHENTICATED');
  const leave=v.parse(RoomLeaveAckSchema,await h.call(fresh,'room:leave',{}, {expectedRoomRevision:resumed.versions.roomRevision,expectedGameRevision:resumed.game?.gameRevision}));assert.ok(leave.ok);
  const f=greatKingdom(await h.sync(other.client));assert.equal(f.phase,'FINISHED');if(f.phase!=='FINISHED')throw new Error();assert.equal(f.result.reason,'CANCELLED');assert.deepEqual(f.result.winnerPlayerIds,[]);
});

test('GREAT_KINGDOM default runtime starts without any scoring configuration',async t=>{
 const h=await harness(t),s=await start(h);assert.equal(s.room.phase,'PLAYING');
 assert.equal(greatKingdom(s).rulesVersion,'great-kingdom-base-v2');
});
