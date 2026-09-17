import test from 'node:test';
import assert from 'node:assert/strict';
import {parse, safeParse} from 'valibot';
import {GameIdSchema, RoomIdSchema, RequestIdSchema, ServerTimeSchema, PlayerIdSchema,
  SpeakeasyCommandRequestSchema, SpeakeasyCommandReplySchema} from '@hangul-rummikub/shared';
import {a,b,example,tile,exampleActPlans} from './speakeasy.fixture.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {startSpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
import {SpeakeasyCommandService, type SpeakeasyCommandContext} from './games/speakeasy/application/command-service.js';
import type {SpeakeasyCommandCatalog} from './games/speakeasy/application/player-command.js';
import type {SpeakeasyCommandStore} from './games/speakeasy/ports/command-store.js';
import {InMemorySpeakeasyCommandStore} from './games/speakeasy/infrastructure/in-memory-command-store.js';
import {KeyedSerialExecutor} from './infrastructure/keyed-serial-executor.js';

const roomId=parse(RoomIdSchema,'speakeasy-room'),now=parse(ServerTimeSchema,123456);
const empty:SpeakeasyCommandCatalog={operations:new Map(),city:[],goals:[]};
const fail=(reason:string)=>({ok:false,reason});
function setup(gameId='service-game') {
  const economy=example();
  const deck=(operation:'VIP'|'PARTY'|'STILLS'|'FLEET')=>Array.from({length:12},(_,i)=>({tileId:tile(`deck-${operation}-${i}`),operation,leverage:1}));
  const round=startSpeakeasyRoundLifecycle({gameId:parse(GameIdSchema,gameId),revision:0,economy,
    clock:{act:1,round:1,seat:0,order:[a,b]},decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}});
  return startSpeakeasyGameFlow(round,[{id:'restaurant',location:'RESTAURANT'}],
    [a,b].map((playerId,i)=>({playerId,available:Array.from({length:4},(_,n)=>tile(`capo-${i}-${n}`)),placed:[],retired:[]})));
}
function harness(catalog=empty) {
  const store=new InMemorySpeakeasyCommandStore(),executor=new KeyedSerialExecutor<typeof roomId>();
  store.add(roomId,setup(),exampleActPlans());
  const clock={now:()=>now};
  const make=(port:SpeakeasyCommandStore=store)=>new SpeakeasyCommandService({store:port,executor,clock,catalog});
  const context:SpeakeasyCommandContext={roomId,actorPlayerId:a,authorization:{isCurrent:()=>true}};
  return {store,executor,clock,make,context,service:make()};
}
const request=(revision:number,type:string,fields:object={},id=`r-${revision}`)=>({requestId:id,
  action:{type,command:{gameId:'service-game',revision,...fields}}});
const place=(id='place')=>request(0,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'restaurant',restaurant:{position:0,discardIds:['hand-0-0']}},id);
function deferred() {let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
async function send(h:ReturnType<typeof harness>,type:string,fields:object={}) {
  const record=await h.store.read(roomId);assert.ok(record);
  const result=await h.service.command(h.context,request(record.state.round.revision,type,fields));
  assert.ok(result.ok);return result;
}
async function beforeDraw(h:ReturnType<typeof harness>) {
  assert.ok((await h.service.command(h.context,place())).ok);
  for(const action of ['BOOKS','CITY_TILES']) {
    await send(h,'CHOOSE_RESTAURANT_ACTION',{action});await send(h,'FINISH_RESTAURANT_ACTION');
  }
  await send(h,'FINISH_RESTAURANT');
}

test('Speakeasy service request and reply contracts reject forged context and malformed identifiers',async()=>{
  const h=harness();assert.ok(safeParse(SpeakeasyCommandRequestSchema,place()).success);
  for(const body of [null,{...place(),actorPlayerId:a},{...place(),roomId}, {...place(),requestId:''},
    {...place(),requestId:'x'.repeat(129)},{...place(),action:{...place().action,actor:a}}]) {
    assert.deepEqual(await h.service.command(h.context,body),fail('INVALID_PAYLOAD'));
  }
  assert.equal((await h.store.read(roomId))!.version,0);
  const result=await h.service.command(h.context,place());assert.ok(result.ok);
  assert.ok(safeParse(SpeakeasyCommandReplySchema,result).success);
  assert.equal(safeParse(SpeakeasyCommandReplySchema,{...result,candidate:setup()}).success,false);
  assert.equal(result.acceptedRevision,1);assert.equal(result.replayed,false);
});

test('Speakeasy concurrent identical requests commit once and replay without paying or placing twice',async()=>{
  const h=harness();
  const replies=await Promise.all(Array.from({length:20},()=>h.service.command(h.context,place())));
  assert.equal(replies.filter(r=>r.ok&&!r.replayed).length,1);
  assert.equal(replies.filter(r=>r.ok&&r.replayed).length,19);
  const saved=(await h.store.read(roomId))!;
  assert.equal(saved.version,1);assert.equal(saved.state.round.revision,1);assert.equal(saved.receipts.length,1);
  assert.equal(saved.state.capos[0]!.placed.length,1);assert.equal(saved.state.round.economy.players[0]!.hand.length,3);
  assert.equal(saved.receipts[0]!.createdAt,now);assert.equal(h.executor.activeKeyCount,0);
});

test('Speakeasy conflicting reuse is rejected but JSON member order does not change request identity',async()=>{
  const h=harness();assert.ok((await h.service.command(h.context,place())).ok);
  const reordered={action:{command:{restaurant:{discardIds:['hand-0-0'],position:0},spaceId:'restaurant',capoId:'capo-0-0',revision:0,gameId:'service-game'},type:'PLACE_CAPO'},requestId:'place'};
  const replay=await h.service.command(h.context,reordered);assert.ok(replay.ok);assert.equal(replay.replayed,true);
  assert.deepEqual(await h.service.command(h.context,request(0,'PLACE_CAPO',{...place().action.command,capoId:'capo-0-1'},'place')),fail('REQUEST_ID_REUSED'));
  assert.deepEqual(await h.service.command(h.context,request(1,'FINISH_RESTAURANT',{},'place')),fail('REQUEST_ID_REUSED'));
  assert.equal((await h.store.read(roomId))!.receipts.length,1);
});

test('Speakeasy competing distinct requests at one revision have one winner',async()=>{
  const h=harness();
  const replies=await Promise.all(Array.from({length:8},(_,i)=>h.service.command(h.context,place(`request-${i}`))));
  assert.equal(replies.filter(r=>r.ok).length,1);
  assert.equal(replies.filter(r=>!r.ok&&r.reason==='STALE_GAME_REVISION').length,7);
  assert.equal((await h.store.read(roomId))!.version,1);
});

test('Speakeasy old receipt returns current private view, not the historical board or an extra action',async()=>{
  const h=harness();assert.ok((await h.service.command(h.context,place())).ok);
  await send(h,'CHOOSE_RESTAURANT_ACTION',{action:'BOOKS'});
  const before=await h.store.read(roomId),reply=await h.service.command(h.context,place());
  assert.ok(reply.ok);assert.equal(reply.acceptedRevision,1);assert.equal(reply.view.turn.revision,2);
  assert.equal(reply.view.turn.stage,'RESTAURANT_ACTION');assert.equal(reply.replayed,true);
  assert.deepEqual(await h.store.read(roomId),before);
  assert.deepEqual(await h.service.command({...h.context,actorPlayerId:b},place()),fail('STALE_GAME_REVISION'));
});

test('Speakeasy service recreation restores private views and retries a card draw without drawing twice',async()=>{
  const h=harness();await beforeDraw(h);
  const revision=(await h.store.read(roomId))!.state.round.revision,body=request(revision,'DRAW_OPERATION',{deck:'VIP'},'draw');
  const first=await h.service.command(h.context,body);assert.ok(first.ok);
  const recreated=h.make(),replay=await recreated.command(h.context,body);assert.ok(replay.ok);assert.equal(replay.replayed,true);
  const snapshot=await recreated.snapshot(h.context);assert.ok(snapshot.ok);assert.deepEqual(snapshot.view,replay.view);
  assert.equal(snapshot.view.turn.self.hand.length,4);
  assert.equal((await h.store.read(roomId))!.state.round.decks.VIP.length,11);
  const other=await recreated.snapshot({...h.context,actorPlayerId:b});assert.ok(other.ok);
  assert.ok(!JSON.stringify(other.view).includes('deck-VIP-0'));
  // Request IDs are scoped to actor, so the next player can use the same textual ID.
  const next=await recreated.command({...h.context,actorPlayerId:b},request(first.view.turn.revision,'PLACE_CAPO',
    {capoId:'capo-1-0',spaceId:'restaurant',restaurant:{position:1,discardIds:['hand-1-0','hand-1-1']}},'place'));
  assert.ok(next.ok);assert.equal(next.replayed,false);
});

test('Speakeasy revoked authorization denies commands, replay and snapshots even for a known player',async()=>{
  const h=harness();let current=true;
  const context={...h.context,authorization:{isCurrent:()=>current}};
  assert.ok((await h.service.command(context,place())).ok);current=false;
  assert.deepEqual(await h.service.command(context,place()),fail('UNAUTHENTICATED'));
  assert.deepEqual(await h.service.snapshot(context),fail('UNAUTHENTICATED'));
  const outsider={...h.context,actorPlayerId:parse(PlayerIdSchema,'outsider')};
  assert.deepEqual(await h.service.snapshot(outsider),fail('INVALID_PHASE'));
  assert.deepEqual(await h.service.command(outsider,place()),fail('INVALID_PHASE'));
});

test('Speakeasy authorization is rechecked after an awaited read and at atomic commit',async()=>{
  const h=harness();let current=true;
  const context={...h.context,authorization:{isCurrent:()=>current}};
  const readPort:SpeakeasyCommandStore={read:async id=>{const r=await h.store.read(id);current=false;return r;},commit:(c,a)=>h.store.commit(c,a)};
  assert.deepEqual(await h.make(readPort).command(context,place()),fail('UNAUTHENTICATED'));
  current=true;
  const commitPort:SpeakeasyCommandStore={read:id=>h.store.read(id),commit:async(c,a)=>{current=false;return h.store.commit(c,a);}};
  assert.deepEqual(await h.make(commitPort).command(context,place()),fail('UNAUTHENTICATED'));
  assert.equal((await h.store.read(roomId))!.version,0);assert.equal((await h.store.read(roomId))!.receipts.length,0);
});

test('Speakeasy a lost reply after commit can be recovered through a new authorization without repeating the command',async()=>{
  const h=harness();let current=true;
  const port:SpeakeasyCommandStore={read:id=>h.store.read(id),commit:async(c,a)=>{const result=await h.store.commit(c,a);current=false;return result;}};
  assert.deepEqual(await h.make(port).command({...h.context,authorization:{isCurrent:()=>current}},place()),fail('UNAUTHENTICATED'));
  assert.equal((await h.store.read(roomId))!.version,1);
  const reply=await h.service.command(h.context,place());assert.ok(reply.ok);assert.equal(reply.replayed,true);
  assert.equal((await h.store.read(roomId))!.state.capos[0]!.placed.length,1);
});

test('Speakeasy storage failures return a sanitized error and leave state and receipt untouched',async()=>{
  const h=harness(),before=await h.store.read(roomId);
  const port:SpeakeasyCommandStore={read:id=>h.store.read(id),commit:async()=>{throw new Error('private secret payload');}};
  const reply=await h.make(port).command(h.context,place());assert.deepEqual(reply,fail('INTERNAL_ERROR'));
  assert.deepEqual(await h.store.read(roomId),before);
  assert.ok((await h.service.command(h.context,place())).ok);
});

test('Speakeasy queued commands stop after room closure and another room remains independent',async()=>{
  const h=harness(),gate=deferred(),started=deferred();
  const held=h.executor.run(roomId,async()=>{started.release();await gate.promise;});await started.promise;
  const pending=h.service.command(h.context,place());
  const otherRoom=parse(RoomIdSchema,'other-room');h.store.add(otherRoom,setup('other-game'),exampleActPlans());
  assert.ok((await h.service.snapshot({...h.context,roomId:otherRoom})).ok);
  h.store.close(roomId);gate.release();await held;
  assert.deepEqual(await pending,fail('INVALID_PHASE'));
  assert.equal((await h.store.read(roomId))!.receipts.length,0);
  assert.deepEqual(await h.service.snapshot(h.context),fail('INVALID_PHASE'));
});

test('Speakeasy storage CAS prevents lost updates even when callers use separate serial executors',async()=>{
  const h=harness(),both=deferred();let reads=0;
  const port:SpeakeasyCommandStore={read:async id=>{const r=await h.store.read(id);if(++reads===2)both.release();await both.promise;return r;},commit:(c,a)=>h.store.commit(c,a)};
  const another=new SpeakeasyCommandService({store:port,executor:new KeyedSerialExecutor(),clock:h.clock,catalog:empty});
  const results=await Promise.all([h.make(port).command(h.context,place('one')),another.command(h.context,place('two'))]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(results.filter(r=>!r.ok&&r.reason==='STALE_GAME_REVISION').length,1);
  assert.equal((await h.store.read(roomId))!.receipts.length,1);
});

test('Speakeasy port atomically recognizes replay/conflict and never commits an invalid candidate',async()=>{
  const h=harness();const first=await h.service.command(h.context,place());assert.ok(first.ok);
  const saved=(await h.store.read(roomId))!,receipt=saved.receipts[0]!;
  const change={roomId,expectedVersion:0,actorId:a,requestId:receipt.requestId,fingerprint:receipt.fingerprint,candidate:saved.state,at:now};
  assert.equal((await h.store.commit(change,h.context.authorization)).status,'REPLAY');
  assert.equal((await h.store.commit({...change,fingerprint:'different'},h.context.authorization)).status,'CONFLICT');
  await assert.rejects(h.store.commit({...change,expectedVersion:saved.version,requestId:parse(RequestIdSchema,'bad-candidate')},h.context.authorization),/storage transition/);
  assert.deepEqual(await h.store.read(roomId),saved);
});

test('Speakeasy reads and replies are detached and game replacement cannot replay a previous game receipt',async()=>{
  const h=harness(),input=place();const reply=await h.service.command(h.context,input);assert.ok(reply.ok);
  const snapshot=await h.service.snapshot(h.context);assert.ok(snapshot.ok);
  const raw=(await h.store.read(roomId))!;raw.state.round.economy.players[0]!.cash=10000;
  reply.view.turn.self.hand.length=0;snapshot.view.turn.self.safe=99999;
  assert.equal((await h.store.read(roomId))!.state.round.economy.players[0]!.cash,15);
  assert.equal((await h.store.read(roomId))!.state.round.economy.players[0]!.safe,30);
  assert.equal((await h.store.read(roomId))!.state.round.economy.players[0]!.hand.length,3);
  assert.throws(()=>h.store.add(roomId,setup(),exampleActPlans()),/already exists/);
  h.store.remove(roomId);assert.equal(await h.store.read(roomId),null);h.store.add(roomId,setup('next-game'),exampleActPlans());
  assert.deepEqual(await h.service.command(h.context,input),fail('STALE_GAME_REVISION'));
  assert.equal((await h.store.read(roomId))!.receipts.length,0);
});

test('Speakeasy failed server effects cannot persist partial resource changes or disclose exception details',async()=>{
  const catalog:SpeakeasyCommandCatalog={...empty,operations:new Map([[tile('hand-0-1'),{
    benefit:state=>{state.players[0]!.cash=1000;throw new Error('private card detail');},action:state=>({ok:true,value:state}),
  }]])};
  const h=harness(catalog);assert.ok((await h.service.command(h.context,place())).ok);
  await send(h,'CHOOSE_RESTAURANT_ACTION',{action:'OPERATION'});
  const before=await h.store.read(roomId);
  const result=await h.service.command(h.context,request(2,'PLAY_OPERATION',{cardId:'hand-0-1'}));
  assert.deepEqual(result,fail('INTERNAL_ERROR'));assert.deepEqual(await h.store.read(roomId),before);
});

test('Speakeasy receipt fingerprints preserve ordered choices rather than sorting arrays',async()=>{
  const h=harness();
  const fields={capoId:'capo-0-0',spaceId:'restaurant',restaurant:{position:1,discardIds:['hand-0-0','hand-0-1']}};
  assert.ok((await h.service.command(h.context,request(0,'PLACE_CAPO',fields,'ordered'))).ok);
  const reversed={...fields,restaurant:{position:1,discardIds:['hand-0-1','hand-0-0']}};
  assert.deepEqual(await h.service.command(h.context,request(0,'PLACE_CAPO',reversed,'ordered')),fail('REQUEST_ID_REUSED'));
});

test('Speakeasy storage versions prevent an old candidate committing after remove and re-add',async()=>{
  const h=harness();const result=await h.service.command(h.context,place());assert.ok(result.ok);
  const saved=(await h.store.read(roomId))!,receipt=saved.receipts[0]!;
  h.store.remove(roomId);h.store.add(roomId,setup(),exampleActPlans());
  const before=await h.store.read(roomId);
  const commit=await h.store.commit({roomId,expectedVersion:0,actorId:a,requestId:receipt.requestId,
    fingerprint:receipt.fingerprint,candidate:saved.state,at:now},h.context.authorization);
  assert.equal(commit.status,'STALE');assert.deepEqual(await h.store.read(roomId),before);
});
