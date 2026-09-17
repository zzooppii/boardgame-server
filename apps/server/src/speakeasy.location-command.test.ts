import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {GameIdSchema,RoomIdSchema,ServerTimeSchema,type PlayerId} from '@hangul-rummikub/shared';
import {example,a,b,tile,exampleActPlans} from './speakeasy.fixture.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {startSpeakeasyGameFlow,parseSpeakeasyGameFlow,type SpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
import {emptyCityTiles} from './games/speakeasy/domain/city-tiles.js';
import {parseLocationProgress,type SpeakeasyLocationProgram} from './games/speakeasy/domain/location-program.js';
import {prepareSpeakeasyPlayerCommand,type SpeakeasyCommandCatalog} from './games/speakeasy/application/player-command.js';
import {SpeakeasyCommandService} from './games/speakeasy/application/command-service.js';
import {InMemorySpeakeasyCommandStore} from './games/speakeasy/infrastructure/in-memory-command-store.js';
import {KeyedSerialExecutor} from './infrastructure/keyed-serial-executor.js';
const gameId=parse(GameIdSchema,'locations');
function setup() {
  const economy=example(),order=[a,b];
  const deck=(operation:'VIP'|'PARTY'|'STILLS'|'FLEET')=>Array.from({length:12},(_,i)=>({tileId:tile(`deck-${operation}-${i}`),operation,leverage:1}));
  return startSpeakeasyGameFlow(startSpeakeasyRoundLifecycle({gameId,revision:0,economy,clock:{act:1,round:1,seat:0,order},
    decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}}),
    Array.from({length:8},(_,i)=>({id:`office-${i}`,location:'CONTRACTOR'})),
    order.map((playerId,i)=>({playerId,available:Array.from({length:4},(_,j)=>tile(`capo-${i}-${j}`)),retired:[],placed:[]})));
}
// Synthetic complete programs, not the official Person-of-Interest layout or component bonuses.
const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'book',kind:'BOOK'},{id:'goons',kind:'GOONS'}],
  [{id:'build',kind:'BUILD',kinds:['SPEAKEASY','STILLS'],upgrade:false}],
  [{id:'protect',kind:'PROTECT',costByPosition:[4,3]},{id:'card',kind:'OPERATION',operations:['PARTY']}]]};
function catalog(s=setup()):SpeakeasyCommandCatalog {
  return {operations:new Map(s.round.economy.players.flatMap(p=>p.hand.map(c=>[c.tileId,{benefit:e=>({ok:true,value:e}),action:e=>({ok:true,value:e})}] as const))),
    city:[],goals:[],locations:new Map(s.spaces.map(space=>[space.id,program])),
    buildingBenefits:new Map(s.round.economy.players.flatMap(p=>p.reserves.map(b=>[b.tileId,(state)=>({ok:true,value:state})] as const)))};
}
const body=(s:SpeakeasyGameFlow,type:string,fields:object={})=>({type,command:{gameId,revision:s.round.revision,...fields}});
function run(s:SpeakeasyGameFlow,type:string,fields:object={},c=catalog(),actor=a) {
  const before=structuredClone(s),r=prepareSpeakeasyPlayerCommand(s,actor,body(s,type,fields),c);
  assert.deepEqual(s,before);assert.ok(r.ok,JSON.stringify(r));assert.equal(r.candidate.round.revision,s.round.revision+1);return r;
}
const enter=(s=setup(),c=catalog())=>run(s,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0'},c).candidate;
const skip=(s:SpeakeasyGameFlow,actionId:string,c=catalog())=>run(s,'SKIP_LOCATION_ACTION',{actionId},c).candidate;
const build=(pieceId:string,district:number,slot:0|1=0)=>({pieceId,district,slot,goons:0,useAssociate:false,freeAssociate:false,discardIds:[]});

test('Speakeasy registered locations respect row order, either order within a row, skip and mandatory draw',()=>{
  let s=enter();
  for(const type of ['FINISH_LOCATION_ACTIONS','FINISH_RESTAURANT','DRAW_OPERATION']) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,type,type==='DRAW_OPERATION'?{deck:'VIP'}:{}),catalog()).ok,false);
  }
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'SKIP_LOCATION_ACTION',{actionId:'build'}),catalog()).ok,false);
  const goons=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'goons',choice:{kind:'GOONS',count:2,cashToSpend:1}});
  assert.equal(goons.candidate.round.economy.players[0]!.cash,14);assert.equal(goons.candidate.round.economy.players[0]!.safe,26);
  assert.equal(goons.actorView.turn.locationActions!.rows[1]![0]!.status,'WAITING');s=goons.candidate;
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}}).candidate;
  assert.equal(s.round.economy.players[0]!.books,4);assert.equal(s.round.economy.players[0]!.bookReserve,6);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}}),catalog()).ok,false);
  for(const actionId of ['build','card','protect']) s=skip(s,actionId);
  const finished=run(s,'FINISH_LOCATION_ACTIONS');assert.equal(finished.actorView.turn.stage,'DRAW_OPERATION');assert.equal(finished.actorView.turn.locationActions!.canFinish,false);
  const next=run(finished.candidate,'DRAW_OPERATION',{deck:'VIP'});assert.equal(next.actorView.turn.actorId,b);assert.equal(next.candidate.locationActions,null);
  assert.equal(next.actorView.turn.locationActions,null);assert.equal(next.candidate.capos[0]!.placed[0]!.spaceId,'office-0');
});

test('Speakeasy unsupported spaces, wrong actor, stale revision and forged choice values cannot mutate location state',()=>{
  const s=setup(),empty={operations:new Map(),city:[],goals:[]};
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0'}),empty).ok,false);
  const active=enter(),before=structuredClone(active);
  const input=body(active,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}});
  assert.equal(prepareSpeakeasyPlayerCommand(active,b,input,catalog()).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(active,a,{...input,command:{...input.command,revision:0}},catalog()).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(active,a,body(active,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK',amount:100}}),catalog()).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(active,a,body(active,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'GOONS',count:1}}),catalog()).ok,false);
  assert.deepEqual(active,before);
  assert.throws(()=>parseLocationProgress({program:{...program,rows:[program.rows[0],program.rows[0]]},completed:[]}));
  assert.throws(()=>parseLocationProgress({program,completed:['build']}));
});

test('Speakeasy construction resolves up to two buildings, their city tiles and bonuses before later protection',()=>{
  const start=setup();start.city=emptyCityTiles([a,b]);
  start.city.buildings=[0,1].map(slot=>({district:15,slot:slot===0?0:1,tile:{tileId:tile(`city-${slot}`),effectId:'example'}}));
  let s=enter(start);s=skip(skip(s,'book'),'goons');
  const c=catalog(),bonuses=new Map(c.buildingBenefits);
  for(const id of ['bar-0-0','bar-0-1']) bonuses.set(tile(id),(state,actor)=>{const p=state.economy.players.find(p=>p.playerId===actor)!;assert.equal(p.cityTileCount,state.city.held[0]!.tiles.length);p.cash++;return {ok:true,value:state};});
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'build',choice:{kind:'BUILD',builds:[build('bar-0-0',15),build('bar-0-1',15,1)]}},{...c,buildingBenefits:bonuses}).candidate;
  assert.equal(s.round.economy.players[0]!.cash,11);assert.equal(s.city.held[0]!.tiles.length,2);assert.equal(s.city.buildings.length,0);
  const denied=prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'protect',choice:{kind:'PROTECT',buildingIds:['bar-0-0','bar-0-1']}}),c);
  assert.equal(denied.ok,false,'permanent 3 + tokens 2 cannot pay 8');
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'protect',choice:{kind:'PROTECT',buildingIds:['bar-0-0']}}).candidate;
  assert.equal(s.round.economy.players[0]!.leverageTokens,1);assert.ok(s.round.economy.districts[14]!.slots[0]!.familyId);
  const card=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'card',choice:{kind:'OPERATION',cardId:'hand-0-0'}});
  assert.equal(card.actorView.turn.stage,'FINISH_LOCATION');assert.equal(card.actorView.turn.locationActions!.canFinish,true);
  assert.equal(card.candidate.round.economy.players[0]!.operations.at(-1)!.tileId,tile('hand-0-0'));
});

test('Speakeasy second construction failure and failed bonus roll back both builds and progress',()=>{
  let s=enter();s=skip(skip(s,'book'),'goons');const before=structuredClone(s),c=catalog();
  const input=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'build',choice:{kind:'BUILD',builds:[build('bar-0-0',15),build('bar-0-1',15)]}});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,c).ok,false);assert.deepEqual(s,before);
  const benefits=new Map(c.buildingBenefits);benefits.set(tile('bar-0-1'),state=>{state.economy.players[0]!.cash=999;return {ok:false,reason:'CAPACITY'};});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'build',choice:{kind:'BUILD',builds:[build('bar-0-0',15),build('bar-0-1',15,1)]}}),{...c,buildingBenefits:benefits}).ok,false);
  assert.deepEqual(s,before);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'build',choice:{kind:'BUILD',builds:[build('bar-0-0',15)]}}),{...c,buildingBenefits:new Map()}).ok,false);
});

test('Speakeasy location excess city tiles wait for return after the draw and preserve pending actor',()=>{
  const initial=setup();initial.city.held[0]!.tiles=Array.from({length:4},(_,i)=>({tileId:tile(`held-${i}`),effectId:'example'}));initial.round.economy.players[0]!.cityTileCount=4;
  initial.city.buildings=[{district:15,slot:0,tile:{tileId:tile('extra-city'),effectId:'example'}}];
  let s=enter(initial);s=skip(skip(s,'book'),'goons');s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'build',choice:{kind:'BUILD',builds:[build('bar-0-0',15)]}}).candidate;
  s=skip(skip(s,'protect'),'card');s=run(s,'FINISH_LOCATION_ACTIONS').candidate;
  const drawn=run(s,'DRAW_OPERATION',{deck:'VIP'});assert.equal(drawn.actorView.turn.stage,'RETURN_CITY');assert.equal(drawn.actorView.turn.self.returnCount,1);
  const returned=run(drawn.candidate,'RETURN_CITY_TILES',{placements:[{tileId:'extra-city',row:0}]});
  assert.equal(returned.actorView.turn.actorId,b);assert.equal(returned.candidate.locationActions,null);
  assert.equal(returned.candidate.city.held[0]!.tiles.length,4);
});

test('Speakeasy ordinary locations complete 22 service turns with automatic act transitions and deduplicated rewards',async()=>{
  const roomId=parse(RoomIdSchema,'location-room'),store=new InMemorySpeakeasyCommandStore(),state=setup();
  const c=catalog(state);store.add(roomId,state,exampleActPlans());
  const service=new SpeakeasyCommandService({store,executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,1)},catalog:c});
  const context=(actorPlayerId:PlayerId)=>({roomId,actorPlayerId,authorization:{isCurrent:()=>true}});
  async function send(actor:PlayerId,type:string,fields:object={}) {
    const s=(await store.read(roomId))!.state,request={requestId:`r-${s.round.revision}`,action:body(s,type,fields)};
    const reply=await service.command(context(actor),request);assert.ok(reply.ok,JSON.stringify(reply));return {reply,request};
  }
  for(let turn=0;turn<22;turn++) {
    const s=(await store.read(roomId))!.state,actor=s.round.clock.order[s.round.clock.seat]!,index=s.round.clock.order.indexOf(actor);
    const slot=index*4+s.round.clock.round-1;
    await send(actor,'PLACE_CAPO',{capoId:s.capos[index]!.available[0],spaceId:`office-${slot}`});
    if(turn<2) {
      const result=await send(actor,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}}),before=await store.read(roomId);
      const replay=await service.command(context(actor),result.request);assert.ok(replay.ok);assert.equal(replay.replayed,true);assert.deepEqual(await store.read(roomId),before);
    } else await send(actor,'SKIP_LOCATION_ACTION',{actionId:'book'});
    for(const actionId of ['goons','build','protect','card']) await send(actor,'SKIP_LOCATION_ACTION',{actionId});
    await send(actor,'FINISH_LOCATION_ACTIONS');await send(actor,'DRAW_OPERATION',{deck:turn<12?'VIP':'PARTY'});
  }
  const final=(await store.read(roomId))!.state;assert.equal(final.round.phase,'FINAL_SCORING');assert.equal(final.history.length,3);
  assert.ok(final.round.economy.players.every(p=>p.books===4));assert.equal(parseSpeakeasyGameFlow(final).locationActions,null);
  const view=await service.snapshot(context(a));assert.ok(view.ok);assert.ok(view.view.result);
});

// Synthetic production/price tables and graph exercise authority, not printed component values.
function logistics() {
  const s=setup(),p=s.round.economy.players[0]!;
  for(const [id,district] of [['stills-0',1],['bar-0-0',2]] as const) {
    const index=p.reserves.findIndex(piece=>piece.tileId===id),piece=p.reserves.splice(index,1)[0]!;
    s.round.economy.districts[district-1]!.slots[0]={piece,ownerId:a,barrelId:null,familyId:null};
  }
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'produce',kind:'PRODUCE',quantityByLevel:[1,2,3,4,5]}],
    [{id:'deliver',kind:'DELIVER',rangeBonus:0,cardBonuses:[{cardId:tile('installed-0'),range:2}],edges:[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]]}],
    [{id:'sell',kind:'SELL',limitByLevel:[1,2,3,4,5],pricesByInfamy:Array.from({length:21},(_,i)=>({speakeasy:i+5,premium:i+10}))}]]};
  const c={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program]))};
  return {s:enter(s,c),c,program};
}
const move=(district:number,truckId='truck-0-0')=>({kind:'MOVE',truckId,district});
const load={kind:'LOAD',truckId:'truck-0-0',count:1};
const unload={kind:'UNLOAD',truckId:'truck-0-0',buildingId:'bar-0-0'};

test('Speakeasy production, delivery and sale use current levels and preserve every barrel',()=>{
  let {s,c}=logistics();
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'produce',choice:{kind:'PRODUCE'}},c).candidate;
  assert.equal(s.round.economy.players[0]!.stock.length,2);
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),load,move(2),unload]}},c).candidate;
  assert.equal(s.round.economy.players[0]!.stock.length,1);
  assert.ok(s.round.economy.districts[1]!.slots[0]!.barrelId);
  const cash=s.round.economy.players[0]!.cash;
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'sell',choice:{kind:'SELL',buildingIds:['bar-0-0']}},c).candidate;
  assert.equal(s.round.economy.players[0]!.cash,cash+12);
  assert.equal(s.round.economy.districts[1]!.slots[0]!.barrelId,null);
  assert.equal(s.round.economy.barrelSupply.length,39);
  assert.equal(run(s,'FINISH_LOCATION_ACTIONS',{},c).actorView.turn.stage,'DRAW_OPERATION');
});

test('Speakeasy invalid delivery tail rolls back loading, movement and action completion',()=>{
  let {s,c}=logistics();s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'produce',choice:{kind:'PRODUCE'}},c).candidate;
  const before=structuredClone(s);
  for(const steps of [[move(1),load,move(3)],[move(1),load,move(2),unload,unload],
    [move(1),load,move(2,'truck-1-0')],[move(1),load,move(2),{...unload,buildingId:'bar-1-0'}]]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps}}),c).ok,false);
    assert.deepEqual(s,before);
  }
  assert.equal(s.locationActions!.completed.includes('deliver'),false);
});

test('Speakeasy delivery grants installed card range only and rejects client supplied rules',()=>{
  let {s,c}=logistics();s=skip(s,'produce',c);
  const steps=[1,2,3,4,5,6].map(n=>move(n));
  const delivered=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps}},c);
  assert.equal(delivered.candidate.round.economy.players[0]!.trucks[0]!.district,6);
  for(const choice of [{kind:'DELIVER',steps:[...steps,move(7)]},{kind:'DELIVER',steps,range:100},
    {kind:'DELIVER',steps,edges:[[1,7]]},{kind:'DELIVER',steps:[]}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice}),c).ok,false);
  }
  const p=s.round.economy.players[0]!;p.hand.push(...p.operations.splice(0));
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps}}),c).ok,false);
  p.levels.FLEET=2;
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1,'truck-0-1')]}}),c).ok,false);
});

test('Speakeasy logistics rejects closed businesses, duplicate sales and forged quantities',()=>{
  let {s,c}=logistics();s.round.economy.districts[0]!.cop=true;
  for(const choice of [{kind:'PRODUCE'},{kind:'PRODUCE',quantity:99}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'produce',choice}),c).ok,false);
  }
  s.round.economy.districts[0]!.cop=false;
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'produce',choice:{kind:'PRODUCE'}},c).candidate;
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),load,move(2),unload]}},c).candidate;
  for(const choice of [{kind:'SELL',buildingIds:['bar-0-0','bar-0-0']},{kind:'SELL',buildingIds:['bar-0-0'],speakeasy:100}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'sell',choice}),c).ok,false);
  }
  s.round.economy.districts[1]!.cop=true;const before=structuredClone(s);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'sell',choice:{kind:'SELL',buildingIds:['bar-0-0']}}),c).ok,false);
  assert.deepEqual(s,before);
});

test('Speakeasy server delivery graph and level tables must be complete and unambiguous',()=>{
  const {program}=logistics();const delivery=program.rows[1]![0]!;
  for(const invalid of [{...delivery,edges:[[1,1]]},{...delivery,edges:[[1,2],[2,1]]},
    {...delivery,cardBonuses:[{cardId:'duplicate',range:2},{cardId:'duplicate',range:2}]}]) {
    assert.throws(()=>parseLocationProgress({program:{...program,rows:[[invalid]]},completed:[]}));
  }
  assert.throws(()=>parseLocationProgress({program:{...program,rows:[[{id:'produce',kind:'PRODUCE',quantityByLevel:[1]}]]},completed:[]}));
});

function levelSetup(operation:'VIP'|'STRENGTH'='VIP',level=4) {
  const s=setup();s.round.economy.players[0]!.levels[operation]=level;
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'level',kind:'LEVEL',operations:[operation]}]]};
  const c:SpeakeasyCommandCatalog={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program])),
    infamyBenefits:new Map(Array.from({length:20},(_,i)=>[i+6,null]))};
  return {s:enter(s,c),c};
}

test('Speakeasy level action pays hand cards, raises infamy and resolves reward before completion',()=>{
  const {s,c}=levelSetup();const benefits=new Map(c.infamyBenefits);
  // Synthetic benefit draws the top card; paid cards must already be at the deck bottom.
  benefits.set(15,(state,actor)=>{
    assert.equal(state.decks.PARTY.at(-1)!.tileId,tile('hand-0-0'));
    state.economy.players.find(p=>p.playerId===actor)!.hand.push(state.decks.PARTY.shift()!);
    return {ok:true,value:state};
  });
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:['hand-0-0']}},{...c,infamyBenefits:benefits});
  const p=result.candidate.round.economy.players[0]!;
  assert.equal(p.levels.VIP,5);assert.equal(Object.values(p.levels).reduce((a,b)=>a+b,0),15);
  assert.equal(p.hand.length,4);assert.equal(p.hand.at(-1)!.tileId,tile('deck-PARTY-0'));
  assert.equal(result.actorView.turn.stage,'FINISH_LOCATION');assert.equal(result.candidate.round.economy.discardedCards.length,0);
});

test('Speakeasy strength level four costs one card and level five costs two',()=>{
  for(const [level,cost] of [[3,1],[4,2]] as const) {
    const {s,c}=levelSetup('STRENGTH',level);
    for(const discardIds of [[],['hand-0-0','hand-0-0'],['installed-0'],['hand-1-0']]) {
      assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'STRENGTH',discardIds}}),c).ok,false);
    }
    const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'STRENGTH',discardIds:Array.from({length:cost},(_,i)=>`hand-0-${i}`)}},c);
    assert.equal(r.candidate.round.economy.players[0]!.levels.STRENGTH,level+1);
    assert.equal(r.candidate.round.decks.PARTY.length,12+cost);
  }
});

test('Speakeasy level action rejects missing benefits, forbidden tracks and maximum levels atomically',()=>{
  const {s,c}=levelSetup(),before=structuredClone(s);
  const input=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:['hand-0-0']}});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:new Map()}).ok,false);
  for(const choice of [{kind:'LEVEL',operation:'STRENGTH',discardIds:['hand-0-0']},
    {kind:'LEVEL',operation:'VIP',discardIds:[]},{kind:'LEVEL',operation:'VIP',discardIds:['hand-0-0'],amount:2}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice}),c).ok,false);
  }
  assert.deepEqual(s,before);
  const max=levelSetup('VIP',5);
  assert.equal(prepareSpeakeasyPlayerCommand(max.s,a,body(max.s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:['hand-0-0']}}),max.c).ok,false);
});

test('Speakeasy failed or malformed infamy benefits restore the paid card and uncompleted action',()=>{
  const {s,c}=levelSetup(),before=structuredClone(s),input=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:['hand-0-0']}});
  const benefits=new Map(c.infamyBenefits);
  benefits.set(15,state=>{state.decks.PARTY.shift();state.economy.players[0]!.cash=999;return {ok:false,reason:'CAPACITY'};});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:benefits}).ok,false);assert.deepEqual(s,before);
  benefits.set(15,state=>{state.decks.PARTY.shift();return {ok:true,value:state};});
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:benefits}));assert.deepEqual(s,before);
  benefits.set(15,state=>{state.economy.players[0]!.levels.PARTY++;return {ok:true,value:state};});
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:benefits}));assert.deepEqual(s,before);
});

test('Speakeasy lower levels require no discard and an explicitly empty infamy benefit can complete',()=>{
  const {s,c}=levelSetup('VIP',2);
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:[]}},c);
  assert.equal(result.candidate.round.economy.players[0]!.levels.VIP,3);
  assert.equal(result.candidate.round.economy.players[0]!.hand.length,4);
  assert.equal(prepareSpeakeasyPlayerCommand(result.candidate,a,body(result.candidate,'EXECUTE_LOCATION_ACTION',{actionId:'level',choice:{kind:'LEVEL',operation:'VIP',discardIds:[]}}),c).ok,false);
});

function familySetup() {
  const s=setup(),p=s.round.economy.players[0]!,other=s.round.economy.players[1]!;
  s.round.economy.docks=[{ownerId:a,familyId:p.familyReserve.shift()!,zone:0,space:0},
    {ownerId:a,familyId:p.familyReserve.shift()!,zone:0,space:1},
    {ownerId:b,familyId:other.familyReserve.shift()!,zone:1,space:0}];
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'family',kind:'FAMILY',vipCapacityByLevel:[2,3,4,5,6],
    docks:[{zone:0,space:0},{zone:0,space:1},{zone:0,space:2},{zone:0,space:3},{zone:1,space:0}]}]]};
  const c:SpeakeasyCommandCatalog={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program])),
    dockBenefits:new Map([['0:2',state=>{state.economy.players[0]!.cash+=4;return {ok:true,value:state};}]])};
  return {s:enter(s,c),c};
}
const dockChoice=(moves:object[]=[],zone=0,space=2)=>({kind:'FAMILY',destination:{kind:'DOCK',zone,space,moves}});

test('Speakeasy family acquisition fills VIP only to the current server capacity',()=>{
  const {s,c}=familySetup(),before=s.round.economy.players[0]!.familyReserve.length;
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:{kind:'FAMILY',destination:{kind:'VIP'}}},c);
  assert.equal(result.candidate.round.economy.players[0]!.vip.length,3);
  assert.equal(result.candidate.round.economy.players[0]!.familyReserve.length,before-1);
  assert.equal(result.actorView.turn.stage,'FINISH_LOCATION');
  s.round.economy.players[0]!.levels.VIP=1;
  const denied=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:{kind:'FAMILY',destination:{kind:'VIP'}}});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,denied,c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(result.candidate,a,body(result.candidate,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:{kind:'FAMILY',destination:{kind:'VIP'}}}),c).ok,false);
});

test('Speakeasy new dock placement rewards once and sequential old-family moves earn no additional benefit',()=>{
  const {s,c}=familySetup(),cash=s.round.economy.players[0]!.cash;
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:dockChoice([
    {familyId:'family-0-0',zone:0,space:3},{familyId:'family-0-1',zone:0,space:0},{familyId:'family-0-0',zone:0,space:1},
  ])},c);
  const e=result.candidate.round.economy;
  assert.equal(e.players[0]!.cash,cash+4);assert.equal(e.docks.length,4);
  assert.equal(e.docks.find(d=>d.familyId==='family-0-0')!.space,1);
  assert.equal(e.docks.find(d=>d.familyId==='family-0-1')!.space,0);
  assert.equal(e.docks.find(d=>d.familyId==='family-0-2')!.space,2);
});

test('Speakeasy dock relocation rejects occupied, unknown, opponent and new members without partial rewards',()=>{
  const {s,c}=familySetup(),before=structuredClone(s);
  const choices=[dockChoice([],1,0),dockChoice([],2,11),
    dockChoice([{familyId:'family-0-0',zone:0,space:1}]),
    dockChoice([{familyId:'family-1-0',zone:0,space:3}]),
    dockChoice([{familyId:'family-0-2',zone:0,space:3}]),
    dockChoice([{familyId:'missing',zone:0,space:3}]),
    dockChoice([{familyId:'family-0-0',zone:0,space:3},{familyId:'family-0-1',zone:2,space:0}])];
  for(const choice of choices) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice}),c).ok,false);
    assert.deepEqual(s,before);
  }
});

test('Speakeasy missing, failed or invalid dock bonuses cannot consume a family member',()=>{
  const {s,c}=familySetup(),before=structuredClone(s),input=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:dockChoice()});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,dockBenefits:new Map()}).ok,false);
  const benefits=new Map(c.dockBenefits);
  benefits.set('0:2',state=>{state.economy.players[0]!.cash=999;return {ok:false,reason:'CAPACITY'};});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,dockBenefits:benefits}).ok,false);
  benefits.set('0:2',state=>{state.decks.PARTY.shift();return {ok:true,value:state};});
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,input,{...c,dockBenefits:benefits}));
  assert.deepEqual(s,before);
});

test('Speakeasy dock bonus can draw a card while input cannot override reward or VIP capacity',()=>{
  const {s,c}=familySetup(),benefits=new Map(c.dockBenefits);
  benefits.set('0:2',state=>{state.economy.players[0]!.hand.push(state.decks.PARTY.shift()!);return {ok:true,value:state};});
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:dockChoice()},{...c,dockBenefits:benefits});
  assert.equal(result.candidate.round.economy.players[0]!.hand.at(-1)!.tileId,tile('deck-PARTY-0'));
  for(const choice of [{...dockChoice(),reward:99},{kind:'FAMILY',destination:{kind:'VIP',capacity:99}},
    {kind:'FAMILY',destination:{kind:'VIP',moves:[]}}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice}),c).ok,false);
  }
  const empty=structuredClone(s);empty.round.economy.players[0]!.removedFamily.push(...empty.round.economy.players[0]!.familyReserve.splice(0));
  assert.equal(prepareSpeakeasyPlayerCommand(empty,a,body(empty,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice:dockChoice()}),c).ok,false);
});
