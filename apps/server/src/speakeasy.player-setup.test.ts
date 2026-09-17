import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,safeParse} from 'valibot';
import {GameIdSchema,RoomIdSchema,ServerTimeSchema,SpeakeasySetupCommandSchema} from '@hangul-rummikub/shared';
import {example,a,b,tile,exampleActPlans} from './speakeasy.fixture.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {startSpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
import {startSpeakeasyPlayerSetup,chooseSpeakeasyPlayerSetup,parseSpeakeasyPlayerSetup,
  completeSpeakeasyPlayerSetup,speakeasySetupStep,type SpeakeasyPlayerSetup,type SpeakeasySetupCatalog,type SpeakeasySetupBenefit} from './games/speakeasy/domain/player-setup.js';
import {SpeakeasyCommandService} from './games/speakeasy/application/command-service.js';
import {InMemorySpeakeasyCommandStore} from './games/speakeasy/infrastructure/in-memory-command-store.js';
import {KeyedSerialExecutor} from './infrastructure/keyed-serial-executor.js';
import {emptyCityTiles} from './games/speakeasy/domain/city-tiles.js';

const gameId=parse(GameIdSchema,'setup-game');
function seed(count=2) {
  const economy=example(count),order=economy.players.map(p=>p.playerId);
  const deck=(operation:'VIP'|'PARTY'|'STILLS'|'FLEET')=>Array.from({length:12},(_,i)=>({tileId:tile(`deck-${operation}-${i}`),operation,leverage:1}));
  const decks={VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')};
  for(const p of economy.players) {
    p.hand=Object.values(decks).map(cards=>cards.shift()!);p.operations=[];
    p.levels={VIP:1,PARTY:1,STILLS:1,FLEET:1,STRENGTH:1};p.books=0;p.bookReserve=10;p.vip=[];p.leverageTokens=0;
  }
  const city=emptyCityTiles(order);
  city.buildings=order.map((_,i)=>({district:i+1,slot:0,tile:{tileId:tile(`city-${i}`),effectId:'example'}}));
  const round=startSpeakeasyRoundLifecycle({gameId,revision:0,economy,clock:{act:1,round:1,seat:0,order},decks});
  return startSpeakeasyGameFlow(round,[{id:'restaurant',location:'RESTAURANT'}],order.map((playerId,i)=>({playerId,
    available:Array.from({length:4},(_,n)=>tile(`capo-${i}-${n}`)),placed:[],retired:[]})),city);
}
const identity:SpeakeasySetupBenefit=s=>({ok:true,value:s});
/** These no-op/test rewards verify sequencing; they are not printed component data. */
function catalog(s:SpeakeasyPlayerSetup):SpeakeasySetupCatalog {
  return {docks:[{zone:0,space:0,benefit:identity},{zone:0,space:1,benefit:identity}],
    buildings:new Map(s.flow.round.economy.players.flatMap(p=>p.reserves.map(b=>[b.tileId,identity] as const))),
    operationBenefits:new Map(s.flow.round.economy.players.flatMap(p=>p.hand.map(c=>[c.tileId,identity] as const)))};
}
function command(s:SpeakeasyPlayerSetup,type:string,fields:object={}) {
  return {type,command:{gameId,revision:s.flow.round.revision,...fields}};
}
function apply(s:SpeakeasyPlayerSetup,type:string,fields:object={},c=catalog(s)) {
  const actor=speakeasySetupStep(s).actorId!;
  const result=chooseSpeakeasyPlayerSetup(s,actor,command(s,type,fields),c);assert.ok(result.ok,JSON.stringify(result));
  assert.equal(result.value.flow.round.revision,s.flow.round.revision+1);return result.value;
}
function docks(s:SpeakeasyPlayerSetup) {
  if(s.flow.round.clock.order.length===2) {s=apply(s,'SETUP_DOCK',{zone:0,space:0});s=apply(s,'SETUP_DOCK',{zone:0,space:1});}
  return s;
}
function finish(s:SpeakeasyPlayerSetup) {
  s=docks(s);
  while(speakeasySetupStep(s).stage!=='READY') {
    const actor=speakeasySetupStep(s).actorId!,index=s.flow.round.clock.order.indexOf(actor),p=s.flow.round.economy.players.find(p=>p.playerId===actor)!;
    s=apply(s,'SETUP_BUILD',{pieceId:p.reserves[0]!.tileId,district:index+1,slot:0});
    s=apply(s,'SETUP_OPERATION',{cardId:p.hand[0]!.tileId});
  }
  return s;
}

test('Speakeasy setup validates the initial deal and runs in reverse order for 2/3/4 players',()=>{
  for(const count of [2,3,4]) {
    const s=startSpeakeasyPlayerSetup(seed(count)),initial=structuredClone(s),order=s.flow.round.clock.order;
    assert.equal(speakeasySetupStep(s).actorId,order.at(-1));assert.equal(speakeasySetupStep(s).stage,count===2?'DOCK':'BUILD');
    assert.equal(completeSpeakeasyPlayerSetup(s).ok,false);
    const ready=finish(s);assert.deepEqual(ready.openings.map(p=>p.playerId),[...order].reverse());
    assert.deepEqual(ready.dockPlayers,count===2?[b,a]:[]);assert.equal(speakeasySetupStep(ready).stage,'READY');
    const complete=completeSpeakeasyPlayerSetup(ready);assert.ok(complete.ok);
    assert.deepEqual(complete.value.round.clock,{act:1,round:1,seat:0,order});assert.equal(complete.value.active,null);
    for(const p of complete.value.round.economy.players) {
      assert.equal(p.cash,12);assert.equal(p.safe,30);assert.equal(p.hand.length,3);assert.equal(p.operations.length,1);assert.equal(p.cityTileCount,1);
    }
    assert.deepEqual(complete.value.round.decks,s.flow.round.decks,'no turn-end draw during setup');
    assert.ok(complete.value.capos.every(p=>p.available.length===4&&p.placed.length===0));
    assert.deepEqual(s,initial);assert.deepEqual(parseSpeakeasyPlayerSetup(JSON.parse(JSON.stringify(ready))),ready);
    complete.value.round.economy.players[0]!.cash=999;assert.equal(ready.flow.round.economy.players[0]!.cash,12);
  }
});

test('Speakeasy setup rejects forged payloads, wrong actor, wrong step, stale revision and reused dock',()=>{
  let s=startSpeakeasyPlayerSetup(seed());const before=structuredClone(s),body=command(s,'SETUP_DOCK',{zone:0,space:0});
  for(const input of [{...body,actor:b},{...body,command:{...body.command,benefit:10}},{...body,command:{...body.command,space:12}},null]) {
    assert.equal(safeParse(SpeakeasySetupCommandSchema,input).success,false);
    assert.equal(chooseSpeakeasyPlayerSetup(s,b,input,catalog(s)).ok,false);
  }
  assert.equal(chooseSpeakeasyPlayerSetup(s,a,body,catalog(s)).ok,false);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_BUILD',{pieceId:'bar-1-0',district:2,slot:0}),catalog(s)).ok,false);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,{...body,command:{...body.command,gameId:'other'}},catalog(s)).ok,false);
  assert.deepEqual(s,before);s=apply(s,'SETUP_DOCK',{zone:0,space:0});
  assert.equal(chooseSpeakeasyPlayerSetup(s,a,command(s,'SETUP_DOCK',{zone:0,space:0}),catalog(s)).ok,false);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,body,catalog(s)).ok,false);
  const three=startSpeakeasyPlayerSetup(seed(3));
  assert.equal(chooseSpeakeasyPlayerSetup(three,speakeasySetupStep(three).actorId!,command(three,'SETUP_DOCK',{zone:0,space:0}),catalog(three)).ok,false);
});

test('Speakeasy setup allows only empty legal spaces and cash-paid Speakeasies or Stills',()=>{
  const source=seed();source.round.economy.districts[5]!.blocked=true;source.round.economy.districts[6]!.mobsterSlots=[0];source.round.economy.districts[6]!.mobsterStrength=1;
  let s=docks(startSpeakeasyPlayerSetup(source));const before=structuredClone(s);
  for(const fields of [{pieceId:'bar-1-0',district:6,slot:0},{pieceId:'bar-1-0',district:7,slot:0},
    {pieceId:'bar-1-0',district:2,slot:2},{pieceId:'bar-0-0',district:2,slot:0},{pieceId:'casino-1-0',district:2,slot:0}]) {
    assert.equal(chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_BUILD',fields),catalog(s)).ok,false);
  }
  assert.deepEqual(s,before);s=apply(s,'SETUP_BUILD',{pieceId:'stills-1',district:2,slot:0});
  assert.equal(s.flow.round.economy.players[1]!.cash,10);assert.equal(s.flow.round.economy.players[1]!.safe,30);
  s=apply(s,'SETUP_OPERATION',{cardId:s.flow.round.economy.players[1]!.hand[0]!.tileId});
  assert.equal(chooseSpeakeasyPlayerSetup(s,a,command(s,'SETUP_BUILD',{pieceId:'bar-0-0',district:2,slot:0}),catalog(s)).ok,false);
});

test('Speakeasy setup resolves the city tile before building benefit, and installs the card before only its top benefit',()=>{
  let s=docks(startSpeakeasyPlayerSetup(seed()));const c=catalog(s),events:string[]=[];
  const buildings=new Map(c.buildings);buildings.set(tile('bar-1-0'),(state,actor)=>{
    events.push('building');const p=state.economy.players.find(p=>p.playerId===actor)!;
    assert.equal(p.cash,12);assert.equal(p.cityTileCount,1);assert.equal(state.city.held[1]!.tiles[0]!.tileId,tile('city-1'));
    p.books++;p.bookReserve--;return {ok:true,value:state};
  });
  s=apply(s,'SETUP_BUILD',{pieceId:'bar-1-0',district:2,slot:0},{...c,buildings});
  assert.deepEqual(events,['building']);assert.equal(s.flow.round.economy.players[1]!.books,1);
  const cardId=s.flow.round.economy.players[1]!.hand[0]!.tileId,operationBenefits=new Map(c.operationBenefits);
  operationBenefits.set(cardId,(state,actor)=>{events.push('top');assert.ok(state.economy.players.find(p=>p.playerId===actor)!.operations.some(c=>c.tileId===cardId));return {ok:true,value:state};});
  const decks=structuredClone(s.flow.round.decks);s=apply(s,'SETUP_OPERATION',{cardId},{...c,operationBenefits});
  assert.deepEqual(events,['building','top']);assert.deepEqual(s.flow.round.decks,decks);
  assert.equal(speakeasySetupStep(s).actorId,a);
});

test('Speakeasy missing, failed or corrupt setup benefits cannot consume a piece or advance progress',()=>{
  const s=docks(startSpeakeasyPlayerSetup(seed())),before=structuredClone(s),body=command(s,'SETUP_BUILD',{pieceId:'bar-1-0',district:2,slot:0}),c=catalog(s);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,body,{...c,buildings:new Map()}).ok,false);
  const failed:SpeakeasySetupBenefit=state=>{state.economy.players[1]!.cash=1000;return {ok:false,reason:'INVALID_ACTION'};};
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,body,{...c,buildings:new Map([[tile('bar-1-0'),failed]])}).ok,false);
  const corrupt:SpeakeasySetupBenefit=state=>{state.economy.barrelSupply.pop();return {ok:true,value:state};};
  assert.throws(()=>chooseSpeakeasyPlayerSetup(s,b,body,{...c,buildings:new Map([[tile('bar-1-0'),corrupt]])}),/conservation/);
  const throwing:SpeakeasySetupBenefit=()=>{throw new Error('effect failed');};
  assert.throws(()=>chooseSpeakeasyPlayerSetup(s,b,body,{...c,buildings:new Map([[tile('bar-1-0'),throwing]])}),/effect failed/);
  assert.deepEqual(s,before);
  const ready=finish(startSpeakeasyPlayerSetup(seed()));
  assert.equal(chooseSpeakeasyPlayerSetup(ready,a,command(ready,'SETUP_OPERATION',{cardId:'deck-VIP-0'}),catalog(ready)).ok,false);
});

test('Speakeasy setup rejects inconsistent progress, missing initial cards and a started game',()=>{
  const wrong=seed();wrong.round.economy.players[0]!.hand.pop();assert.throws(()=>startSpeakeasyPlayerSetup(wrong));
  const installed=seed();installed.round.economy.players[0]!.operations.push(installed.round.economy.players[0]!.hand.pop()!);assert.throws(()=>startSpeakeasyPlayerSetup(installed));
  const skipped=startSpeakeasyPlayerSetup(seed());skipped.dockPlayers=[b,a];assert.throws(()=>parseSpeakeasyPlayerSetup(skipped));
  const s=finish(startSpeakeasyPlayerSetup(seed())),bad=structuredClone(s);bad.openings.reverse();assert.throws(()=>parseSpeakeasyPlayerSetup(bad));
  bad.openings=s.openings;bad.dockPlayers=[a,b];assert.throws(()=>parseSpeakeasyPlayerSetup(bad));
  const city=seed();city.city.buildings[0]!.slot=2;assert.throws(()=>startSpeakeasyPlayerSetup(city));
});

test('Speakeasy completed preparation registers with the command service and starts the first ordinary turn',async()=>{
  const setup=finish(startSpeakeasyPlayerSetup(seed())),ready=completeSpeakeasyPlayerSetup(setup);assert.ok(ready.ok);
  const plans=exampleActPlans();plans[0]!.districts=[3,4];plans[1]!.districts=[5,6];plans[2]!.districts=[7,8,9];
  const roomId=parse(RoomIdSchema,'prepared-room'),store=new InMemorySpeakeasyCommandStore();store.add(roomId,ready.value,plans);
  const service=new SpeakeasyCommandService({store,executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,1)},catalog:{operations:new Map(),city:[],goals:[]}});
  const context={roomId,actorPlayerId:a,authorization:{isCurrent:()=>true}},before=await service.snapshot(context);assert.ok(before.ok);
  assert.equal(before.view.turn.actorId,a);assert.equal(before.view.turn.stage,'PLACE_CAPO');assert.equal(before.view.turn.self.hand.length,3);
  const reply=await service.command(context,{requestId:'first-turn',action:{type:'PLACE_CAPO',command:{gameId,revision:ready.value.round.revision,
    capoId:ready.value.capos[0]!.available[0],spaceId:'restaurant',restaurant:{position:0,discardIds:[before.view.turn.self.hand[0]!.tileId]}}}});
  assert.ok(reply.ok);assert.equal(reply.view.turn.stage,'RESTAURANT_CHOICE');assert.equal(reply.view.turn.self.hand.length,2);
  assert.equal((await store.read(roomId))!.state.city.held[0]!.tiles.length,1);
});


test('Speakeasy a failed dock or card benefit leaves family, hand, progress and revision unchanged',()=>{
  let s=startSpeakeasyPlayerSetup(seed());
  const fail:SpeakeasySetupBenefit=state=>{state.economy.players[1]!.cash+=100;return {ok:false,reason:'CAPACITY'};};
  let before=structuredClone(s),c=catalog(s);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_DOCK',{zone:0,space:0}),{...c,docks:[{zone:0,space:0,benefit:fail}]}).ok,false);
  assert.deepEqual(s,before);s=docks(s);s=apply(s,'SETUP_BUILD',{pieceId:'bar-1-0',district:2,slot:0});
  before=structuredClone(s);c=catalog(s);const cardId=s.flow.round.economy.players[1]!.hand[0]!.tileId;
  const failed=chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_OPERATION',{cardId}),{...c,operationBenefits:new Map([[cardId,fail]])});
  assert.equal(failed.ok,false);assert.deepEqual(s,before);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_OPERATION',{cardId:s.flow.round.economy.players[0]!.hand[0]!.tileId}),c).ok,false);
  assert.equal(chooseSpeakeasyPlayerSetup(s,b,{type:'SETUP_OPERATION',command:{gameId,revision:s.flow.round.revision-1,cardId}},c).ok,false);
  assert.ok(chooseSpeakeasyPlayerSetup(s,b,command(s,'SETUP_OPERATION',{cardId}),c).ok);
});
