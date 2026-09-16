import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, type GameType, type PlatformSnapshotV2, } from "@hangul-rummikub/shared";
import { parseMarsState, applyMarsAction, marsOffers } from "./games/mars/domain/game.js";
import { transitionMars } from "./games/mars/application/service.js";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2, initialGame: GameType = "TERRAFORMING_MARS") {
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
function mars(s:PlatformSnapshotV2){if(s.game?.gameType!=='TERRAFORMING_MARS')throw new Error('Expected Mars');return s.game;}
test('Mars sockets preserve private state, pending payment and idempotency across reconnect',async t=>{
 const h=await harness(t,3);let s=await h.sync();s=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));assert.equal(mars(s).playerStates.length,3);
 const act=async(client:Client,payload:unknown)=>{const g=mars(await h.sync(client));assert.ok(g.phase==='PLAYING');return h.call(client,'mars:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});};
 for(const m of h.members)h.success(await act(m.client,{type:'SETUP',corporationId:'Beginner',cardIds:[]}));
 s=await h.sync();let g=mars(s);assert.ok(g.phase==='PLAYING');const owner=h.members.find(m=>m.playerId===g.activePlayerId)!,other=h.members.find(m=>m!==owner)!;
 const command=h.request('mars:act',{type:'TAKE',actionId:'project:aquifer'},{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});
 assert.equal(h.failure(await h.send(other.client,command)),'NOT_YOUR_TURN');const after=h.success(await h.send(owner.client,command));assert.equal(mars(after).gameRevision,g.gameRevision+1);assert.equal(mars(after).privateState.payment?.cost,18);
 const replay=h.success(await h.send(owner.client,command));assert.equal(mars(replay).gameRevision,g.gameRevision+1);assert.equal(h.failure(await h.send(owner.client,{...command,requestId:'mars-stale'})),'STALE_GAME_REVISION');
 const wire=JSON.stringify(await h.sync(other.client));for(const c of mars(after).privateState.hand)assert.equal(wire.includes(c.tileId),false);assert.equal(mars(await h.sync(other.client)).privateState.payment,null);
 owner.client.disconnect();const resumed=await h.connect();const restored=h.success(await h.call(resumed,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.deepEqual(mars(restored).privateState,mars(after).privateState);
 s=h.success(await act(resumed,{type:'PAY',payment:{money:18,steel:0,titanium:0,heat:0}}));g=mars(s);const place=g.privateState.offers.find(o=>o.kind==='PLACE');assert.ok(place);
 const paid=structuredClone(g);resumed.disconnect();const placingClient=await h.connect();
 const restoredPlacement=mars(h.success(await h.call(placingClient,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null})));
 assert.deepEqual(restoredPlacement.privateState,paid.privateState);assert.deepEqual(restoredPlacement.playerStates,paid.playerStates);assert.equal(restoredPlacement.oceans,0);
 assert.equal(mars(await h.sync(other.client)).privateState.offers.some(o=>o.kind==='PLACE'),false);
 assert.ok(restoredPlacement.phase==='PLAYING');
 const placement=h.request('mars:act',{type:'TAKE',actionId:place.id},{gameId:restoredPlacement.gameId,expectedGameRevision:restoredPlacement.gameRevision,turnId:restoredPlacement.turnId});
 const first=mars(h.success(await h.send(placingClient,placement))),second=mars(h.success(await h.send(placingClient,placement)));
 assert.equal(first.oceans,1);assert.deepEqual(second,first,'Repeated placement must not charge or reward twice');
});

for(const count of [3,4,5])test(`Mars ${count}-player simultaneous research, reconnect and full game through scoring`,{timeout:180000},async t=>{
 const h=await harness(t,count);let s=await h.sync();
 s=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));
 const commandFor=(g:ReturnType<typeof mars>,payload:unknown)=>{assert.equal(g.phase,'PLAYING');if(g.phase!=='PLAYING')throw new Error('Expected playing game');return h.request('mars:act',payload,{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});};
 const freshAct=async(client:Client,payload:unknown)=>h.success(await h.send(client,commandFor(mars(await h.sync(client)),payload)));
 const setup=mars(s);
 const replies=await Promise.all(h.members.map(m=>h.send(m.client,commandFor(setup,{type:'SETUP',corporationId:'Beginner',cardIds:[]}))));
 assert.equal(replies.filter(raw=>v.parse(StateSyncWireAckSchema,raw).ok).length,1,'Exactly one command may commit the shared revision.');
 for(const [i,raw] of replies.entries())if(!v.parse(StateSyncWireAckSchema,raw).ok){assert.equal(h.failure(raw),'STALE_GAME_REVISION');await freshAct(h.members[i]!.client,{type:'SETUP',corporationId:'Beginner',cardIds:[]});}
 s=await h.sync();assert.equal(mars(s).stage,'ACTION');assert.equal(mars(s).gameRevision,setup.gameRevision+count);
 for(const m of h.members){const g=mars(await h.sync(m.client)),me=g.playerStates.find(p=>p.playerId===m.playerId)!;assert.equal(me.resources.money,42);assert.equal(g.privateState.hand.length,10);}
 for(let i=0;i<count;i++){const g=mars(await h.sync()),owner=h.members.find(m=>m.playerId===g.activePlayerId)!;await freshAct(owner.client,{type:'TAKE',actionId:'pass'});}
 const views=await Promise.all(h.members.map(async m=>mars(await h.sync(m.client))));
 assert.ok(views.every(g=>g.stage==='RESEARCH'&&g.generation===2&&g.privateState.research.length===4));
 const revision=views[0]!.gameRevision;
 const purchases=views.map(g=>commandFor(g,{type:'RESEARCH',cardIds:g.privateState.research.slice(0,2).map(c=>c.tileId)}));
 const results=await Promise.all(h.members.map((m,i)=>h.send(m.client,purchases[i]!)));
 assert.equal(results.filter(raw=>v.parse(StateSyncWireAckSchema,raw).ok).length,1);
 for(const [i,raw] of results.entries()){
  const member=h.members[i]!;
  if(!v.parse(StateSyncWireAckSchema,raw).ok){assert.equal(h.failure(raw),'STALE_GAME_REVISION');const latest=mars(await h.sync(member.client));purchases[i]=commandFor(latest,{type:'RESEARCH',cardIds:views[i]!.privateState.research.slice(0,2).map(c=>c.tileId)});h.success(await h.send(member.client,purchases[i]!));}
  const before=mars(await h.sync(member.client));
  const replay=mars(h.success(await h.send(member.client,purchases[i]!)));
  assert.equal(replay.gameRevision,before.gameRevision);assert.deepEqual(replay.privateState,before.privateState,'Replay must not buy or draw again.');
 }
 for(const [i,member] of h.members.entries()){
  const current=await h.sync(member.client),g=mars(current),before=views[i]!,me=g.playerStates.find(p=>p.playerId===member.playerId)!;
  assert.equal(g.stage,'ACTION');assert.equal(g.gameRevision,revision+count);assert.equal(g.privateState.hand.length,12);assert.equal(me.resources.money,before.playerStates.find(p=>p.playerId===member.playerId)!.resources.money-6);
  for(const [j,other] of views.entries())if(i!==j)for(const card of [...other.privateState.hand,...other.privateState.research])assert.equal(JSON.stringify(current).includes(card.tileId),false,'Other hand and research identities remain private.');
 }
 const owner=h.members.find(m=>m.playerId===mars(s).startingPlayerId)!;
 owner.client.disconnect();const resumed=await h.connect();
 const restored=h.success(await h.call(resumed,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));
 assert.equal(mars(restored).privateState.hand.length,12);assert.equal(mars(restored).privateState.research.length,0);assert.equal(mars(restored).stage,'ACTION');
 owner.client=resumed;
 let current=mars(restored),steps=0;
 while(current.phase==='PLAYING'&&steps++<2500){
  if(current.stage==='RESEARCH'){
   for(const member of h.members)current=mars(await freshAct(member.client,{type:'RESEARCH',cardIds:[]}));
   continue;
  }
  const active=h.members.find(m=>m.playerId===current.activePlayerId)!;
  current=mars(await h.sync(active.client));
  if(current.privateState.payment){current=mars(await freshAct(active.client,{type:'PAY',payment:{money:current.privateState.payment.cost,steel:0,titanium:0,heat:0}}));continue;}
  const offers=current.privateState.offers;
  const choice=offers.find(o=>o.kind==='PLACE'||o.kind==='EFFECT')||offers.find(o=>o.id==='plants'&&current.oxygen<14)||offers.find(o=>o.id==='heat')||offers.find(o=>o.id==='project:aquifer')||offers.find(o=>o.id==='project:greenery'&&current.oxygen<14)||offers.find(o=>o.id==='project:asteroid')||offers.find(o=>o.id==='final-greenery')||offers.find(o=>o.kind==='END'||o.kind==='PASS');
  assert.ok(choice,`${count} players must not deadlock at generation ${current.generation}`);
  current=mars(await freshAct(active.client,{type:'TAKE',actionId:choice.id}));
 }
 assert.equal(current.phase,'FINISHED',`${count} players should complete within the action bound`);
 if(current.phase!=='FINISHED')throw new Error('Expected finished game');
 assert.equal(current.oceans,9);assert.equal(current.oxygen,14);assert.equal(current.temperature,8);assert.equal(current.result.reason,'SCORED');assert.equal(current.result.scores.length,count);assert.ok(current.result.winnerPlayerIds.length>0);
 for(const member of h.members){const final=mars(await h.sync(member.client));assert.equal(final.phase,'FINISHED');if(final.phase==='FINISHED')assert.deepEqual(final.result,current.result);}

});


test('Mars private card choice sockets restore candidates and commit only once', async t => {
 const h = await harness(t, 3);
 let snapshot = await h.sync();
 h.success(await h.call(h.host, 'game:start', {}, {expectedRoomRevision:snapshot.versions.roomRevision}));
 const commandFor = (g:ReturnType<typeof mars>, payload:unknown) => {
  assert.ok(g.phase === 'PLAYING');
  return h.request('mars:act', payload, {gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});
 };
 for (const member of h.members) h.success(await h.send(member.client, commandFor(mars(await h.sync(member.client)), {type:'SETUP',corporationId:'Beginner',cardIds:[]})));
 snapshot = await h.sync();
 const room = await h.server.runtime.persistence.findById(snapshot.room.roomId);
 assert.ok(room?.gameType === 'TERRAFORMING_MARS' && room.game);
 const service = h.server.runtime.marsService;
 assert.ok(service);
 // Trusted fixture queues an expansion effect without enabling unfinished expansion cards.
 const state = parseMarsState(room.game.state);
 state.frames = [[{id:state.nextJob++,source:'Business Contacts',effect:{kind:'keepCards',count:4,keep:2}}]];
 state.actionInProgress = true;
 const offer = marsOffers(state,state.activePlayerId).find(o=>o.kind === 'EFFECT');
 assert.ok(offer);
 const opened = applyMarsAction(state,state.activePlayerId,{type:'TAKE',actionId:offer.id},service.deps.clock.now(),service.deps.ids.generateTurnId(),service.deps.random);
 assert.ok(opened.ok);
 const replaced = await h.server.runtime.persistence.replace({candidate:transitionMars(room,opened.state,service.deps.clock.now()),expectedRoomRevision:room.roomRevision,expectedStorageRevision:room.storageRevision});
 assert.equal(replaced.status,'REPLACED');
 const owner = h.members.find(m=>m.playerId === state.activePlayerId)!;
 const other = h.members.find(m=>m !== owner)!;
 const before = mars(await h.sync(owner.client)), pending = before.privateState.cardChoice;
 assert.ok(pending?.kind === 'KEEP');
 for(const member of h.members.filter(m=>m !== owner)) {
  const publicView = mars(await h.sync(member.client));
  assert.equal(publicView.privateState.cardChoice,null);
  for(const card of pending.cards) assert.equal(JSON.stringify(publicView).includes(card.tileId),false);
 }
 const command = commandFor(before,{type:'CHOOSE_CARDS',choiceId:pending.id,cardIds:pending.cards.slice(0,2).map(c=>c.tileId)});
 assert.equal(h.failure(await h.send(other.client,command)),'NOT_YOUR_TURN');
 const invalid = commandFor(before,{type:'CHOOSE_CARDS',choiceId:pending.id,cardIds:[pending.cards[0]!.tileId,pending.cards[0]!.tileId]});
 assert.equal(h.failure(await h.send(owner.client,invalid)),'RULE_VIOLATION');
 assert.deepEqual(mars(await h.sync(owner.client)).privateState,before.privateState);
 owner.client.disconnect();
 const resumed = await h.connect();
 const restored = mars(h.success(await h.call(resumed,'session:resume',{credential:{...owner.credential,roomCode:snapshot.room.roomCode},lastSeenVersions:null})));
 assert.deepEqual(restored.privateState.cardChoice,pending);
 const accepted = mars(h.success(await h.send(resumed,command)));
 assert.equal(accepted.privateState.cardChoice,null);
 assert.equal(accepted.privateState.hand.length,before.privateState.hand.length+2);
 const replay = mars(h.success(await h.send(resumed,command)));
 assert.deepEqual(replay,accepted);
 assert.equal(h.failure(await h.send(resumed,{...command,requestId:'private-choice-stale'})),'STALE_GAME_REVISION');
});
