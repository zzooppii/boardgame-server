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
  let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: count > 4 ? "WOLF_NIGHT" : "TERRORSCAPE" }));
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

function terror(snapshot:PlatformSnapshotV2){if(snapshot.game?.gameType!=="TERRORSCAPE")throw new Error("Expected Terrorscape game.");return snapshot.game;}
type Harness=Awaited<ReturnType<typeof harness>>;
async function start(h:Harness){const s=await h.sync();return h.success(await h.call(h.host,"game:start",{},{expectedRoomRevision:s.versions.roomRevision}));}
function action(h:Harness,s:PlatformSnapshotV2,payload:unknown){const g=terror(s);if(g.phase==="FINISHED")throw new Error("Terrorscape finished.");return h.request("terrorscape:act",payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});}
async function begin(h:Harness){const s=await start(h);return h.success(await h.send(h.host,action(h,s,{type:'BEGIN_HUNT'})));}
test('TERRORSCAPE socket: 2–4 players, private projections, no timers and capability rejection',async t=>{for(const count of [2,3,4]){const h=await harness(t,count),s=await begin(h);assert.equal(terror(s).phase,'SURVIVORS');for(const m of h.members){const g=terror(await h.sync(m.client));assert.equal(g.privateState.playerId,m.playerId);assert.equal(g.privateState.role,m===h.members[0]?'KILLER':'SURVIVOR');}assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(x=>x.roomId===s.room.roomId),false);const unsupported=await h.connect(SUPPORTED_GAME_TYPES.filter(x=>x!=='TERRORSCAPE'));assert.equal(h.failure(await h.call(unsupported,'session:resume',{credential:{...h.members[1]!.credential,roomCode:s.room.roomCode},lastSeenVersions:null})),'INCOMPATIBLE_GAME_CAPABILITY');}});
test('TERRORSCAPE socket: hidden move, no opponent broadcast/revision, strict actor/scoped identity, duplicate and concurrent mutation',async t=>{
 const h=await harness(t,4);await begin(h);const guest=h.members[1]!,s=await h.sync(guest.client),before=terror(await h.sync()),move=action(h,s,{type:'BASIC',character:'ANNA',kind:'MOVE',path:['R2'],edge:'',cardId:null});
 await flushHost(h);const events:unknown[]=[];const observe=(x:unknown)=>events.push(x);h.host.on('state:snapshot',observe);
 assert.equal(h.failure(await h.send(h.host,move)),'RULE_VIOLATION');assert.equal(h.failure(await h.send(guest.client,{...move,payload:{type:'BASIC',character:'ANNA',kind:'MOVE',path:['R2'],edge:'',cardId:null,location:'G5'}})),'INVALID_PAYLOAD');
 assert.equal(h.failure(await h.send(guest.client,{...move,turnId:'forged'})),'STALE_GAME_REVISION');
 const replies=await Promise.all([h.send(guest.client,move),h.send(guest.client,{...move,requestId:'second-move'})]);assert.equal(replies.filter(x=>v.parse(StateSyncWireAckSchema,x).ok).length,1);await flushHost(h);assert.equal(events.length,0,JSON.stringify(events));h.host.off('state:snapshot',observe);assert.deepEqual(terror(await h.sync()),before);
 const stored=await h.server.runtime.persistence.findById(s.room.roomId);h.success(await h.send(guest.client,move));assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId),stored);assert.equal(h.failure(await h.send(guest.client,{...move,payload:{type:'READY',character:'ANNA',ready:true}})),'REQUEST_ID_REUSED');
 const replacement=await h.connect();const resumed=h.success(await h.call(replacement,'session:resume',{credential:{...guest.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));const g=terror(resumed);assert.equal(g.privateState.role,'SURVIVOR');if(g.privateState.role==='SURVIVOR')assert.equal(g.privateState.team.survivors[0]!.location,'R2');assert.equal(h.failure(await h.send(guest.client,move)),'UNAUTHENTICATED');
});
test('TERRORSCAPE socket: full team round, killer move/search/end and resumed scoped state',async t=>{
 const h=await harness(t);await begin(h);const guest=h.members[1]!;for(const character of ['ANNA','WILLIAM','MARCO']){let s=await h.sync(guest.client);h.success(await h.send(guest.client,action(h,s,{type:'BASIC',character,kind:'CALM',path:[],edge:'',cardId:null})));s=await h.sync(guest.client);h.success(await h.send(guest.client,action(h,s,{type:'READY',character,ready:true})));}
 let s=await h.sync(guest.client);s=h.success(await h.send(guest.client,action(h,s,{type:'DISCOVER',character:'ANNA'})));assert.equal(terror(s).phase,'LOOT');assert.equal(terror(await h.sync()).phase,'SURVIVORS');h.success(await h.send(guest.client,action(h,s,{type:'KEEP',cardId:null})));
 s=await h.sync();s=h.success(await h.send(h.host,action(h,s,{type:'KILLER_NEXT'})));s=h.success(await h.send(h.host,action(h,s,{type:'KILLER_BASIC',kind:'MOVE',destination:'B4'})));s=h.success(await h.send(h.host,action(h,s,{type:'KILLER_BASIC',kind:'SEARCH',destination:'B4'})));s=h.success(await h.send(h.host,action(h,s,{type:'KILLER_NEXT'})));assert.equal(terror(s).round,2);assert.equal(terror(s).phase,'SURVIVORS');assert.equal(terror(await h.sync(guest.client)).killerLocation,'B4');
});
test('TERRORSCAPE socket: private-revision leave cancels, same-room selection uses viewer revision and rematch rejects old game',async t=>{
 const h=await harness(t,3);await begin(h);const guest=h.members[1]!;let s=await h.sync(guest.client);const old=action(h,s,{type:'BASIC',character:'ANNA',kind:'CALM',path:[],edge:'',cardId:null});h.success(await h.send(guest.client,old));const hostView=await h.sync();const leave=v.parse(RoomLeaveAckSchema,await h.call(guest.client,'room:leave',{},{expectedRoomRevision:hostView.versions.roomRevision,expectedGameRevision:terror(await h.sync(guest.client)).gameRevision}));assert.ok(leave.ok,JSON.stringify(leave));s=await h.sync();const g=terror(s);assert.equal(g.phase,'FINISHED');if(g.phase==='FINISHED')assert.equal(g.result.reason,'CANCELLED');const lobby=h.success(await h.send(h.host,h.selection(s,'TERRORSCAPE')));assert.equal(lobby.room.roomCode,s.room.roomCode);assert.equal(lobby.room.players.length,2);const fresh=await start(h);assert.notEqual(terror(fresh).gameId,g.gameId);assert.equal(h.failure(await h.send(h.members[2]!.client,{...old,requestId:'previous-game'})),'STALE_GAME_REVISION');
});
test('TERRORSCAPE socket: finished host succession keeps room usable after host disconnect',async t=>{
 const h=await harness(t,3);const s=await begin(h),room=await h.server.runtime.persistence.findById(s.room.roomId);assert.ok(room?.gameType==='TERRORSCAPE'&&room.game);const {cancelTerrorscape}=await import('./games/terrorscape/domain/game.js');const {transitionTerrorscape}=await import('./games/terrorscape/application/service.js');const at=h.server.runtime.clock.now();const result=await h.server.runtime.persistence.commit({roomMutation:{kind:'REPLACE',candidate:transitionTerrorscape(room,cancelTerrorscape(room.game.state,at),at),expectedRoomRevision:room.roomRevision,expectedStorageRevision:room.storageRevision},sessionMutation:{kind:'NONE'},idempotency:{scopeKey:'terror-fixture',requestId:v.parse(RequestIdSchema,'finish-fixture'),payloadFingerprint:'finish',terminalResult:{ok:true},createdAt:at}});assert.equal(result.status,'COMMITTED');h.host.disconnect();await h.sync(h.members[1]!.client);t.mock.method(h.server.runtime.clock,'now',()=>v.parse(ServerTimeSchema,at+61_000));assert.equal(await h.server.runtime.terrorscapeHostSuccession!.evaluate(s.room.roomId),true);const view=await h.sync(h.members[1]!.client);assert.ok(view.room.players.find(p=>p.playerId===view.self.playerId)?.isHost);h.success(await h.send(h.members[1]!.client,h.selection(view,'NUMBER_TILE')));
});
test('TERRORSCAPE socket: delayed older fanout cannot regress the hidden-state watermark',async t=>{
 const h=await harness(t),setup=await start(h),projector=h.server.runtime.platformSnapshotV2Projector,original=projector.project.bind(projector);
 let release:()=>void=()=>{},entered:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});let delayOnce=true;
 t.mock.method(projector,'project',async(input:import('./application/platform-snapshot-v2-projector.js').ProjectPlatformSnapshotV2Input)=>{const snapshot=await original(input);if(delayOnce&&input.selfPlayerId===setup.self.playerId&&input.room.gameType==='TERRORSCAPE'&&input.room.game?.state.phase==='SETUP'){delayOnce=false;entered();await gate;}return snapshot;});
 const oldFanout=h.server.runtime.terrorscapeService!.notify(setup.room.roomId);await started;
 h.success(await h.send(h.host,action(h,setup,{type:'BEGIN_HUNT'})));const events:unknown[]=[];h.host.on('state:snapshot',event=>events.push(event));
 release();await oldFanout;await flushHost(h);assert.equal(events.length,0,'The older setup projection must be dropped.');
 const guest=h.members[1]!,view=await h.sync(guest.client);h.success(await h.send(guest.client,action(h,view,{type:'BASIC',character:'ANNA',kind:'MOVE',path:['R2'],edge:'',cardId:null})));await flushHost(h);assert.equal(events.length,0,'The private move must not repair a regressed watermark by sending an observable event.');
});

// Invalid sync is a TCP-order barrier with an ACK but no snapshot emission.
async function flushHost(h:Harness){assert.equal(h.failure(await h.call(h.host,'state:sync',{unexpected:true})),'INVALID_PAYLOAD');}
