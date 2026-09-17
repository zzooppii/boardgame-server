import {speakeasyFinalScores} from './games/speakeasy/domain/scoring.js';
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

function shipSetup() {
  const {s,c}=logistics();
  s.round.economy.ports=[1,2,3,4];
  s.round.economy.ships=[{tileId:tile('ship-a'),port:1,barrels:s.round.economy.barrelSupply.splice(0,2),prices:[6,5]},
    {tileId:tile('ship-b'),port:2,barrels:[],prices:[7]}];
  return {s:skip(s,'produce',c),c};
}
const buy=(count=2)=>({kind:'BUY',truckId:'truck-0-0',shipId:'ship-a',count});

test('Speakeasy truck buys rightmost barrels and ship skips occupied ports after the whole purchase',()=>{
  const {s,c}=shipSetup();
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),buy(),move(2),unload]}},c);
  const e=result.candidate.round.economy;
  assert.equal(e.players[0]!.cash,4);assert.equal(e.ships[0]!.port,3);assert.equal(e.ships[0]!.barrels.length,0);
  assert.equal(e.players[0]!.trucks[0]!.barrels.length,1);assert.equal(e.districts[1]!.slots[0]!.barrelId,tile('barrel-1'));
  assert.deepEqual(result.actorView.ports,[1,2,3,4]);
  assert.deepEqual(result.actorView.ships[0],{tileId:tile('ship-a'),port:3,barrels:0,crate:null,prices:[6,5]});
  assert.ok(!JSON.stringify(result.actorView.ships).includes('barrel-'));
  result.actorView.ships[0]!.prices[0]=999;assert.equal(e.ships[0]!.prices[0],6);
});

test('Speakeasy empty ship loads supply at leftmost price, supports safe payment and wraps clockwise',()=>{
  const {s,c}=shipSetup(),ship=s.round.economy.ships[0]!;
  s.round.economy.barrelSupply.push(...ship.barrels.splice(0));ship.port=4;
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(4),{...buy(),cashToSpend:2}]}},c);
  const e=result.candidate.round.economy;
  assert.equal(e.players[0]!.cash,13);assert.equal(e.players[0]!.safe,10);
  assert.equal(e.ships[0]!.port,1);assert.equal(e.ships[0]!.barrels.length,0);assert.equal(e.players[0]!.trucks[0]!.barrels.length,2);
});

test('Speakeasy partial ship stock uses supply for second barrel and can be bought again from a second truck',()=>{
  const {s,c}=shipSetup(),ship=s.round.economy.ships[0]!;
  s.round.economy.barrelSupply.push(ship.barrels.pop()!);
  const result=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),buy(),move(3,'truck-0-1'),{...buy(1),truckId:'truck-0-1'}]}},c);
  assert.equal(result.candidate.round.economy.ships[0]!.port,4);
  assert.equal(result.candidate.round.economy.players[0]!.cash,0);assert.equal(result.candidate.round.economy.players[0]!.safe,24);
});

test('Speakeasy ship purchase rejects wrong location, excess cargo, forged prices and failures after payment atomically',()=>{
  const {s,c}=shipSetup(),before=structuredClone(s);
  for(const steps of [[move(2),buy()],[move(1),{...buy(),truckId:'truck-1-0'}],
    [move(1),{...buy(),count:3}],[move(1),{...buy(),price:0}],
    [move(1),buy(),move(4)],[move(1),buy(),move(3),buy(1)]]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps}}),c).ok,false);
    assert.deepEqual(s,before);
  }
  s.round.economy.players[0]!.cash=0;s.round.economy.players[0]!.safe=0;
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),buy()]}}),c).ok,false);
  assert.equal(s.round.economy.ships[0]!.barrels.length,2);
});

test('Speakeasy ship configuration rejects occupied ports, missing prices and duplicate barrel instances',()=>{
  const {s}=shipSetup();
  for(const alter of [
    (f:SpeakeasyGameFlow)=>{f.round.economy.ships[1]!.port=1;},
    (f:SpeakeasyGameFlow)=>{f.round.economy.ports=[1,2];},
    (f:SpeakeasyGameFlow)=>{f.round.economy.ships[0]!.prices=[];},
    (f:SpeakeasyGameFlow)=>{f.round.economy.ships[0]!.barrels[0]=f.round.economy.barrelSupply[0]!;},
    (f:SpeakeasyGameFlow)=>{f.round.economy.ports=[1,2,3,3];},
  ]) {const invalid=structuredClone(s);alter(invalid);assert.throws(()=>parseSpeakeasyGameFlow(invalid));}
});

test('Speakeasy exhausted barrel supply rolls back a mixed ship and supply purchase',()=>{
  const {s,c}=shipSetup(),e=s.round.economy;
  e.players[1]!.stock.push(...e.barrelSupply.splice(0),e.ships[0]!.barrels.pop()!);
  const before=structuredClone(s);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'deliver',choice:{kind:'DELIVER',steps:[move(1),buy()]}}),c).ok,false);
  assert.deepEqual(s,before);
});

function ambushSetup(crate=9,defense=7) {
  const {s}=shipSetup(),p=s.round.economy.players[0]!,other=s.round.economy.players[1]!;
  s.round.economy.ships[0]!.crate=crate;s.round.economy.crateSupply=[18,5].filter(n=>n!==crate);
  s.round.economy.docks=[{ownerId:a,zone:0,space:0,familyId:p.familyReserve.shift()!},
    {ownerId:b,zone:0,space:1,familyId:other.familyReserve.shift()!}];
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'ambush',kind:'AMBUSH',vipCapacityByLevel:[1,3,4,5,6],
    defenses:[{shipId:tile('ship-a'),byRemaining:[20,12,defense]}]}]]};
  s.locationActions={program,completed:[]};
  return {s,c:{...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program]))}};
}
const ambushChoice=()=>({kind:'AMBUSH',shipId:'ship-a',familyId:'family-0-0',borrowedFamilyIds:['family-1-0'],goons:1,destination:{kind:'BUILDING',buildingId:'bar-0-0'}});

test('Speakeasy ambush requires strictly greater strength; cash hire, goons, crate, barrel, family and ship commit together',()=>{
  const tied=ambushSetup();const before=structuredClone(tied.s);
  assert.equal(prepareSpeakeasyPlayerCommand(tied.s,a,body(tied.s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()}),tied.c).ok,false);
  assert.deepEqual(tied.s,before);
  const {s,c}=ambushSetup(9,6),r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()},c),e=r.candidate.round.economy;
  assert.equal(e.players[0]!.cash,29);assert.equal(e.players[1]!.cash,16);assert.equal(e.players[0]!.goons.length,0);
  assert.deepEqual(e.players[0]!.crates,[9]);assert.equal(e.ships[0]!.crate,18);assert.deepEqual(e.crateSupply,[5]);
  assert.equal(e.districts[1]!.slots[0]!.barrelId,tile('barrel-1'));assert.equal(e.ships[0]!.port,3);
  assert.equal(e.players[0]!.vip.length,3);assert.equal(e.docks.length,1);assert.equal(r.actorView.ships[0]!.crate,18);
  assert.equal(r.actorView.turn.stage,'FINISH_LOCATION');assert.ok(!JSON.stringify(r.actorView).includes('crateSupply'));
});

test('Speakeasy ambush crate income precedes family return and cargo placement; spent goons do not earn income',()=>{
  for(const [crate,cash] of [[3,12],[4,0],[10,0],[17,8]] as const) {
    const {s,c}=ambushSetup(crate,6),r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()},c);
    assert.equal(r.candidate.round.economy.players[0]!.cash,14+cash);
  }
});

test('Speakeasy ambush cannot use safe money, wrong-zone or repeated borrowed members, or forged defense',()=>{
  const {s,c}=ambushSetup(9,6),before=structuredClone(s);
  for(const choice of [{...ambushChoice(),borrowedFamilyIds:['family-1-0','family-1-0']},
    {...ambushChoice(),familyId:'family-1-0'},{...ambushChoice(),borrowedFamilyIds:['family-0-0']},
    {...ambushChoice(),defense:0},{...ambushChoice(),destination:{kind:'DISCARD'}}]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice}),c).ok,false);assert.deepEqual(s,before);
  }
  s.round.economy.players[0]!.cash=0;
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()}),c).ok,false);
  s.round.economy.players[0]!.cash=15;s.round.economy.docks[1]!.zone=1;
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()}),c).ok,false);
});

test('Speakeasy ambush sends family to reserve when VIP is full and loads the Stills area',()=>{
  const {s,c}=ambushSetup(9,6);s.round.economy.players[0]!.levels.VIP=1;
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:{...ambushChoice(),destination:{kind:'STILLS'}}},c),p=r.candidate.round.economy.players[0]!;
  assert.equal(p.vip.length,2);assert.ok(p.familyReserve.includes(tile('family-0-0')));assert.deepEqual(p.stock,[tile('barrel-1')]);
});

test('Speakeasy ambush discards cargo only without an eligible building and missing replacement crate rolls back',()=>{
  const {s,c}=ambushSetup(9,6);s.round.economy.districts[0]!.cop=true;s.round.economy.districts[1]!.cop=true;
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:{...ambushChoice(),destination:{kind:'DISCARD'}}},c);
  assert.equal(r.candidate.round.economy.barrelSupply.length,s.round.economy.barrelSupply.length+1);
  s.round.economy.crateSupply=[];const before=structuredClone(s);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:{...ambushChoice(),destination:{kind:'DISCARD'}}}),c).ok,false);assert.deepEqual(s,before);
});

test('Speakeasy crate 11/12 permits choosing another registered dock bonus without moving the new family there',()=>{
  const {s,c}=familySetup(),benefits=new Map(c.dockBenefits);
  benefits.set('0:3',state=>{state.economy.players[0]!.cash+=8;return {ok:true,value:state};});
  const choice={kind:'FAMILY',destination:{kind:'DOCK',zone:0,space:2,moves:[],bonus:{zone:0,space:3}}};
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice}),{...c,dockBenefits:benefits}).ok,false);
  s.round.economy.players[0]!.crates=[11];
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'family',choice},{...c,dockBenefits:benefits});
  assert.equal(r.candidate.round.economy.players[0]!.cash,23);assert.equal(r.candidate.round.economy.docks.at(-1)!.space,2);
});

test('Speakeasy all eighteen crate income formulas apply during the authorized ambush',()=>{
  const expected=[0,10,12,0,15,0,0,12,15,0,12,12,0,0,0,10,8,10];
  expected.forEach((cash,index)=>{
    const {s,c}=ambushSetup(index+1,6);
    const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()},c);
    assert.equal(r.candidate.round.economy.players[0]!.cash,14+cash,`crate ${index+1}`);
  });
});

test('Speakeasy empty-ship ambush uses supply and missing barrel restores all rewards and hired cash',()=>{
  const {s,c}=ambushSetup(9,6),e=s.round.economy;
  e.barrelSupply.push(...e.ships[0]!.barrels.splice(0));
  const action=s.locationActions!.program.rows[0]![0]!;assert.equal(action.kind,'AMBUSH');
  if(action.kind!=='AMBUSH') throw new Error('Expected ambush.');action.defenses[0]!.byRemaining[0]=6;
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()},c);
  assert.equal(r.candidate.round.economy.barrelSupply.length,e.barrelSupply.length-1);
  e.players[1]!.stock.push(...e.barrelSupply.splice(0));const before=structuredClone(s);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'ambush',choice:ambushChoice()}),c).ok,false);
  assert.deepEqual(s,before);
});

function helperSetup() {
  const s=setup(),p=s.round.economy.players[0]!;
  const card=(id:string)=>({tileId:tile(id),bottle:'example-bottle',value:5 as const,used:false});
  p.helpers=[card('helper-owned'),card('helper-second')];
  s.round.economy.players[1]!.helpers=[card('helper-opponent')];
  s.round.economy.helperDisplay=[card('helper-display')];s.round.economy.helperDeck=[card('helper-hidden')];
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'helper',kind:'HELPER'}]]};
  const c:SpeakeasyCommandCatalog={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program])),
    helpers:new Map(p.helpers.map(h=>[h.tileId,state=>{state.economy.players[0]!.cash+=3;return {ok:true,value:state};}]))};
  return {s,c};
}

test('Speakeasy helper use happens once before Capo placement and leaves the card for final bottle scoring',()=>{
  const {s,c}=helperSetup();
  const r=run(s,'USE_HELPER',{cardId:'helper-owned'},c);
  assert.equal(r.candidate.round.economy.players[0]!.cash,18);assert.equal(r.candidate.round.economy.players[0]!.helpers[0]!.used,true);
  assert.equal(r.candidate.capos[0]!.available.length,4);assert.equal(r.candidate.active,null);
  assert.deepEqual(r.actorView.self.usableHelperIds,[]);assert.equal(r.actorView.turn.stage,'PLACE_CAPO');
  for(const cardId of ['helper-owned','helper-second']) assert.equal(prepareSpeakeasyPlayerCommand(r.candidate,a,body(r.candidate,'USE_HELPER',{cardId}),c).ok,false);
  const placed=enter(r.candidate,c);
  assert.equal(prepareSpeakeasyPlayerCommand(placed,a,body(placed,'USE_HELPER',{cardId:'helper-second'}),c).ok,false);
  assert.equal(placed.round.economy.players[0]!.helpers.length,2);
  assert.equal(speakeasyFinalScores(placed.round.economy).find(p=>p.playerId===a)!.helperMoney,5);
});

test('Speakeasy helper acquisition takes a visible card and immediately replenishes the same display slot',()=>{
  const {s,c}=helperSetup(),active=enter(s,c);
  const r=run(active,'EXECUTE_LOCATION_ACTION',{actionId:'helper',choice:{kind:'HELPER',cardId:'helper-display'}},c);
  assert.equal(r.candidate.round.economy.players[0]!.helpers.at(-1)!.tileId,tile('helper-display'));
  assert.deepEqual(r.actorView.helperMarket,{cards:[{tileId:tile('helper-hidden'),bottle:'example-bottle',value:5}],deckCount:0});
  assert.equal(r.actorView.turn.stage,'FINISH_LOCATION');assert.deepEqual(r.actorView.self.usableHelperIds,[]);
  assert.equal(prepareSpeakeasyPlayerCommand(active,a,body(active,'EXECUTE_LOCATION_ACTION',{actionId:'helper',choice:{kind:'HELPER',cardId:'helper-hidden'}}),c).ok,false);
});

test('Speakeasy helper ownership, actor, revision and missing effects are checked before benefit',()=>{
  const {s,c}=helperSetup(),before=structuredClone(s);
  for(const cardId of ['helper-opponent','helper-display','missing']) assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'USE_HELPER',{cardId}),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'USE_HELPER',{cardId:'helper-opponent'}),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'USE_HELPER',{cardId:'helper-owned'}),{...c,helpers:new Map()}).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,{type:'USE_HELPER',command:{gameId,revision:99,cardId:'helper-owned'}},c).ok,false);
  assert.deepEqual(s,before);
});

test('Speakeasy helper failure or malformed effect rolls back used marker, reward and turn allowance',()=>{
  const {s,c}=helperSetup(),before=structuredClone(s),effects=new Map(c.helpers),input=body(s,'USE_HELPER',{cardId:'helper-owned'});
  effects.set(tile('helper-owned'),state=>{state.economy.players[0]!.cash=999;return {ok:false,reason:'CAPACITY'};});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,helpers:effects}).ok,false);
  effects.set(tile('helper-owned'),state=>{state.economy.players[0]!.helpers[0]!.used=false;return {ok:true,value:state};});
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,input,{...c,helpers:effects}));
  effects.set(tile('helper-owned'),state=>{state.decks.PARTY.shift();return {ok:true,value:state};});
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,input,{...c,helpers:effects}));assert.deepEqual(s,before);
});

test('Speakeasy helper draw effect preserves deck privacy and depleted helper deck does not lose a displayed card',()=>{
  const {s,c}=helperSetup(),effects=new Map(c.helpers);
  effects.set(tile('helper-owned'),state=>{state.economy.players[0]!.hand.push(state.decks.PARTY.shift()!);return {ok:true,value:state};});
  const r=run(s,'USE_HELPER',{cardId:'helper-owned'},{...c,helpers:effects});
  assert.equal(r.actorView.turn.self.hand.at(-1)!.tileId,tile('deck-PARTY-0'));
  assert.ok(!JSON.stringify(r.actorView).includes('helper-hidden'));assert.ok(!JSON.stringify(r.actorView).includes('helper-opponent'));
  s.round.economy.players[1]!.helpers.push(...s.round.economy.helperDeck.splice(0));const active=enter(s,c),before=structuredClone(active);
  assert.equal(prepareSpeakeasyPlayerCommand(active,a,body(active,'EXECUTE_LOCATION_ACTION',{actionId:'helper',choice:{kind:'HELPER',cardId:'helper-display'}}),c).ok,false);
  assert.deepEqual(active,before);
});

test('Speakeasy helper allowance renews next round while receipts and used cards prevent duplicate benefits',async()=>{
  const {s,c}=helperSetup(),roomId=parse(RoomIdSchema,'helper-room'),store=new InMemorySpeakeasyCommandStore();
  store.add(roomId,s,exampleActPlans());
  const service=new SpeakeasyCommandService({store,executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,1)},catalog:c});
  const context=(actorPlayerId:PlayerId)=>({roomId,actorPlayerId,authorization:{isCurrent:()=>true}});
  async function send(actor:PlayerId,type:string,fields:object={}) {
    const state=(await store.read(roomId))!.state,request={requestId:`helper-${state.round.revision}`,action:body(state,type,fields)};
    const reply=await service.command(context(actor),request);assert.ok(reply.ok,JSON.stringify(reply));return {request,reply};
  }
  const first=await send(a,'USE_HELPER',{cardId:'helper-owned'}),before=await store.read(roomId);
  const replay=await service.command(context(a),first.request);assert.ok(replay.ok);assert.equal(replay.replayed,true);assert.deepEqual(await store.read(roomId),before);
  for(const [index,actor] of [a,b].entries()) {
    await send(actor,'PLACE_CAPO',{capoId:`capo-${index}-0`,spaceId:`office-${index}`});
    await send(actor,'SKIP_LOCATION_ACTION',{actionId:'helper'});await send(actor,'FINISH_LOCATION_ACTIONS');await send(actor,'DRAW_OPERATION',{deck:'VIP'});
  }
  const next=(await store.read(roomId))!.state;assert.equal(next.round.clock.round,2);
  assert.equal(prepareSpeakeasyPlayerCommand(next,a,body(next,'USE_HELPER',{cardId:'helper-owned'}),c).ok,false);
  await send(a,'USE_HELPER',{cardId:'helper-second'});
  assert.equal((await store.read(roomId))!.state.round.economy.players[0]!.cash,21);
  assert.equal((await store.read(roomId))!.state.helperUses.length,2);
});

function paidLevelSetup(level=3) {
  const s=setup();s.round.economy.players[0]!.levels.FLEET=level;
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'extra-level',kind:'PAID_LEVEL',operation:'FLEET'}]]};
  const c:SpeakeasyCommandCatalog={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program])),
    infamyBenefits:new Map(Array.from({length:20},(_,i)=>[i+6,null]))};
  return {s:enter(s,c),c};
}
const paidChoice=(discardIds:string[]=[])=>({kind:'PAID_LEVEL',cardId:'hand-0-0',discardIds});

test('Speakeasy optional paid level discards any hand card and raises only the server-indicated operation',()=>{
  const {s,c}=paidLevelSetup(),r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice:paidChoice()},c);
  const p=r.candidate.round.economy.players[0]!;
  assert.equal(p.levels.FLEET,4);assert.equal(p.levels.PARTY,2);assert.equal(p.hand.length,3);
  assert.equal(r.candidate.round.decks.PARTY.at(-1)!.tileId,tile('hand-0-0'));
  assert.equal(r.actorView.turn.stage,'FINISH_LOCATION');
  assert.equal(prepareSpeakeasyPlayerCommand(r.candidate,a,body(r.candidate,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice:paidChoice()}),c).ok,false);
});

test('Speakeasy paid level five needs two distinct hand cards and returns both before the infamy reward',()=>{
  const {s,c}=paidLevelSetup(4),benefits=new Map(c.infamyBenefits);
  benefits.set(14,(state,actor)=>{
    assert.deepEqual(state.decks.PARTY.slice(-2).map(card=>card.tileId),[tile('hand-0-0'),tile('hand-0-1')]);
    state.economy.players.find(p=>p.playerId===actor)!.hand.push(state.decks.PARTY.shift()!);return {ok:true,value:state};
  });
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice:paidChoice(['hand-0-1'])},{...c,infamyBenefits:benefits});
  assert.equal(r.candidate.round.economy.players[0]!.levels.FLEET,5);assert.equal(r.candidate.round.economy.players[0]!.hand.length,3);
  assert.equal(r.candidate.round.economy.players[0]!.hand.at(-1)!.tileId,tile('deck-PARTY-0'));
  for(const choice of [paidChoice(),paidChoice(['hand-0-0']),paidChoice(['installed-0']),paidChoice(['hand-1-0'])]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice}),c).ok,false);
  }
});

test('Speakeasy paid increase rejects installed/opponent cards, forged tracks, excess costs and maximum level',()=>{
  const {s,c}=paidLevelSetup(),before=structuredClone(s);
  for(const choice of [{...paidChoice(),cardId:'installed-0'},{...paidChoice(),cardId:'hand-1-0'},
    {...paidChoice(),operation:'STRENGTH'},paidChoice(['hand-0-1'])]) {
    assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice}),c).ok,false);assert.deepEqual(s,before);
  }
  const max=paidLevelSetup(5);
  assert.equal(prepareSpeakeasyPlayerCommand(max.s,a,body(max.s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice:paidChoice(['hand-0-1'])}),max.c).ok,false);
  assert.throws(()=>parseLocationProgress({program:{location:'CONTRACTOR',rows:[[{id:'extra',kind:'PAID_LEVEL',operation:'STRENGTH'}]]},completed:[]}));
});

test('Speakeasy paid increase can be skipped and missing or failed infamy reward rolls back both cards',()=>{
  const {s,c}=paidLevelSetup(4),before=structuredClone(s),input=body(s,'EXECUTE_LOCATION_ACTION',{actionId:'extra-level',choice:paidChoice(['hand-0-1'])});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:new Map()}).ok,false);
  const benefits=new Map(c.infamyBenefits);benefits.set(14,state=>{state.economy.players[0]!.cash=999;return {ok:false,reason:'CAPACITY'};});
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,input,{...c,infamyBenefits:benefits}).ok,false);assert.deepEqual(s,before);
  const skipped=skip(s,'extra-level',c);assert.deepEqual(skipped.round.economy,s.round.economy);
  assert.equal(run(skipped,'FINISH_LOCATION_ACTIONS',{},c).actorView.turn.stage,'DRAW_OPERATION');
});

test('Speakeasy crate city limits keep five or six tiles after the mandatory draw',()=>{
  for(const crates of [[7],[8],[7,8]]) {
    const initial=setup();initial.round.economy.players[0]!.crates=crates;
    let s=enter(initial);s.city.held[0]!.tiles=Array.from({length:4+crates.length},(_,i)=>({tileId:tile(`limit-${i}`),effectId:'example'}));
    s.round.economy.players[0]!.cityTileCount=s.city.held[0]!.tiles.length;
    for(const id of ['book','goons','build','protect','card']) s=skip(s,id);
    s=run(s,'FINISH_LOCATION_ACTIONS').candidate;
    const r=run(s,'DRAW_OPERATION',{deck:'VIP'});
    assert.equal(r.actorView.turn.actorId,b);assert.equal(r.candidate.awaitingCityReturn,false);
    assert.equal(r.candidate.city.held[0]!.tiles.length,4+crates.length);
    assert.doesNotThrow(()=>parseSpeakeasyGameFlow(r.candidate));
  }
});

function cityAcquireSetup(crates:number[]=[]) {
  const s=setup();s.round.economy.players[0]!.crates=crates;
  const city=(id:string)=>({tileId:tile(id),effectId:'example'});
  s.city.middle[0]=[city('city-top'),city('city-covered')];s.city.right[1]=city('city-right');s.city.supply[2]=[city('city-hidden')];
  const program:SpeakeasyLocationProgram={location:'CONTRACTOR',rows:[[{id:'city',kind:'CITY_TILE'}]]};
  const c={...catalog(s),locations:new Map(s.spaces.map(space=>[space.id,program]))};
  return {s:enter(s,c),c};
}

test('Speakeasy city pickup takes exposed middle tile without refilling or exposing buried supply',()=>{
  const {s,c}=cityAcquireSetup(),r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'city',choice:{kind:'CITY_TILE',column:'MIDDLE',row:0}},c);
  assert.equal(r.candidate.city.held[0]!.tiles[0]!.tileId,tile('city-top'));
  assert.equal(r.candidate.city.middle[0]![0]!.tileId,tile('city-covered'));assert.equal(r.candidate.city.supply[2]!.length,1);
  assert.equal(r.actorView.turn.self.cityTiles[0]!.tileId,tile('city-top'));
  assert.ok(!JSON.stringify(r.actorView).includes('city-hidden'));assert.equal(r.actorView.turn.stage,'FINISH_LOCATION');
});

test('Speakeasy right city pickup refills from the chosen stack and invalid choices roll back',()=>{
  const {s,c}=cityAcquireSetup(),before=structuredClone(s);
  for(const choice of [
    {kind:'CITY_TILE',column:'RIGHT',row:1},{kind:'CITY_TILE',column:'RIGHT',row:1,refill:0},
    {kind:'CITY_TILE',column:'MIDDLE',row:0,refill:2},{kind:'CITY_TILE',column:'MIDDLE',row:2},
    {kind:'CITY_TILE',column:'RIGHT',row:1,refill:2,tileId:'city-hidden'},
  ]) {assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXECUTE_LOCATION_ACTION',{actionId:'city',choice}),c).ok,false);assert.deepEqual(s,before);}
  const r=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'city',choice:{kind:'CITY_TILE',column:'RIGHT',row:1,refill:2}},c);
  assert.equal(r.candidate.city.held[0]!.tiles[0]!.tileId,tile('city-right'));assert.equal(r.candidate.city.right[1]!.tileId,tile('city-hidden'));
  assert.equal(r.candidate.city.supply[2]!.length,0);assert.equal(r.candidate.round.economy.players[0]!.cityTileCount,1);
});

test('Speakeasy city pickup above the crate-adjusted limit returns exactly the excess after drawing',()=>{
  const {s:initial,c}=cityAcquireSetup([7]);let s=initial;
  s.city.held[0]!.tiles=Array.from({length:5},(_,i)=>({tileId:tile(`owned-city-${i}`),effectId:'example'}));s.round.economy.players[0]!.cityTileCount=5;
  s=run(s,'EXECUTE_LOCATION_ACTION',{actionId:'city',choice:{kind:'CITY_TILE',column:'MIDDLE',row:0}},c).candidate;
  s=run(s,'FINISH_LOCATION_ACTIONS',{},c).candidate;
  const drawn=run(s,'DRAW_OPERATION',{deck:'VIP'},c);assert.equal(drawn.actorView.turn.stage,'RETURN_CITY');assert.equal(drawn.actorView.turn.self.returnCount,1);
  assert.equal(drawn.actorView.turn.self.eligibleReturnIds.length,6);
  assert.equal(prepareSpeakeasyPlayerCommand(drawn.candidate,a,body(drawn.candidate,'RETURN_CITY_TILES',{placements:[{tileId:'city-top',row:1},{tileId:'owned-city-0',row:2}]}),c).ok,false);
  const returned=run(drawn.candidate,'RETURN_CITY_TILES',{placements:[{tileId:'city-top',row:1}]},c);
  assert.equal(returned.candidate.city.held[0]!.tiles.length,5);assert.equal(returned.actorView.turn.actorId,b);
});

test('Speakeasy crate capacity never exempts played city tiles from mandatory return',()=>{
  const initial=setup();initial.spaces[0]!.location='RESTAURANT';initial.round.economy.players[0]!.crates=[7];
  let s=run(initial,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0',restaurant:{position:0,discardIds:['hand-0-0']}}).candidate;
  s.city.held[0]!.tiles=Array.from({length:7},(_,i)=>({tileId:tile(`played-limit-${i}`),effectId:'example'}));s.round.economy.players[0]!.cityTileCount=7;
  s.city.played=[tile('played-limit-0'),tile('played-limit-1')];s.active!.restaurant={completed:['CITY_TILES','BOOKS'],current:null};
  s=run(s,'FINISH_RESTAURANT').candidate;
  const drawn=run(s,'DRAW_OPERATION',{deck:'VIP'});
  assert.equal(drawn.actorView.turn.self.returnCount,2);assert.deepEqual(drawn.actorView.turn.self.eligibleReturnIds,[tile('played-limit-0'),tile('played-limit-1')]);
  assert.deepEqual(drawn.actorView.turn.self.mandatoryReturnIds,[tile('played-limit-0'),tile('played-limit-1')]);
  const returned=run(drawn.candidate,'RETURN_CITY_TILES',{placements:[{tileId:'played-limit-0',row:0},{tileId:'played-limit-1',row:1}]});
  assert.equal(returned.candidate.city.held[0]!.tiles.length,5);assert.equal(returned.candidate.city.played.length,0);
});

function parkSetup() {
  const s=setup();s.spaces.push({id:'park-0',location:'PARK'},{id:'park-1',location:'PARK'},{id:'restaurant',location:'RESTAURANT'});
  s.city.middle[0]=[{tileId:tile('park-city'),effectId:'example'}];
  s.city.right[1]={tileId:tile('park-right'),effectId:'example'};
  s.city.supply[2]=[{tileId:tile('park-hidden'),effectId:'example'}];
  const c={...catalog(s),locations:new Map(s.spaces.filter(x=>x.location==='CONTRACTOR').map(x=>[x.id,{location:'CONTRACTOR' as const,rows:[[{id:'book',kind:'BOOK' as const}]]}]))};
  return {s,c};
}
function parkReady() {
  const initial=parkSetup(),c=initial.c;
  let s=run(initial.s,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0'},c).candidate;
  s=run(s,'SKIP_LOCATION_ACTION',{actionId:'book'},c).candidate;
  s=run(s,'FINISH_LOCATION_ACTIONS',{},c).candidate;
  s=run(s,'DRAW_OPERATION',{deck:'VIP'},c).candidate;
  return {s,c};
}
const exchangeFields={capoId:'capo-1-0',targetCapoId:'capo-0-0',parkSpaceId:'park-0'};

test('Speakeasy Park exchange pauses for the displaced owner and then executes the target location',()=>{
  const {s,c}=parkReady();let result=run(s,'EXCHANGE_CAPO',exchangeFields,c,b);
  assert.equal(result.actorView.turn.stage,'PARK_BENEFIT');assert.equal(result.actorView.turn.actorId,a);
  assert.equal(result.actorView.turn.active!.playerId,b);assert.equal(result.actorView.turn.parkBenefit!.spaceId,'park-0');
  assert.equal(result.candidate.capos[0]!.placed[0]!.spaceId,'park-0');
  assert.equal(result.candidate.capos[1]!.placed[0]!.spaceId,'office-0');
  assert.equal(result.candidate.capos[1]!.available.length,3);
  for(const actor of [a,b]) for(const [type,fields] of [
    ['EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}}],
    ['SKIP_LOCATION_ACTION',{actionId:'book'}],['FINISH_LOCATION_ACTIONS',{}],['DRAW_OPERATION',{deck:'VIP'}],
    ['EXCHANGE_CAPO',exchangeFields],['PLACE_CAPO',{capoId:'capo-1-1',spaceId:'office-1'}],
  ] as const) assert.equal(prepareSpeakeasyPlayerCommand(result.candidate,actor,body(result.candidate,type,fields),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(result.candidate,b,body(result.candidate,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}}),c).ok,false);
  result=run(result.candidate,'CHOOSE_PARK_BENEFIT',{choice:{kind:'LEVERAGE'}},c,a);
  assert.equal(result.candidate.round.economy.players[0]!.leverageTokens,s.round.economy.players[0]!.leverageTokens+1);
  assert.equal(result.actorView.turn.actorId,b);assert.equal(result.actorView.turn.stage,'LOCATION');assert.equal(result.actorView.turn.parkBenefit,null);
  result=run(result.candidate,'EXECUTE_LOCATION_ACTION',{actionId:'book',choice:{kind:'BOOK'}},c,b);
  assert.equal(result.candidate.round.economy.players[1]!.books,s.round.economy.players[1]!.books+1);
  result=run(result.candidate,'FINISH_LOCATION_ACTIONS',{},c,b);assert.equal(result.actorView.turn.stage,'DRAW_OPERATION');
  result=run(result.candidate,'DRAW_OPERATION',{deck:'VIP'},c,b);assert.equal(result.actorView.turn.stage,'ROUND_END');
});

test('Speakeasy Park exchange validates target, free Park space, fresh own Capo and registered target program atomically',()=>{
  const {s,c}=parkReady(),before=structuredClone(s);
  for(const fields of [
    {...exchangeFields,targetCapoId:'capo-1-0'}, {...exchangeFields,targetCapoId:'missing'},
    {...exchangeFields,capoId:'capo-0-1'}, {...exchangeFields,parkSpaceId:'office-1'},
    {...exchangeFields,restaurant:{position:1,discardIds:['hand-1-0']}}, {...exchangeFields,bonus:'BOOK'},
  ]) assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'EXCHANGE_CAPO',fields),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,a,body(s,'EXCHANGE_CAPO',exchangeFields),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,{type:'EXCHANGE_CAPO',command:{gameId,revision:0,...exchangeFields}},c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'EXCHANGE_CAPO',exchangeFields),{...c,locations:new Map()}).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'PLACE_CAPO',{capoId:'capo-1-0',spaceId:'park-0'}),c).ok,false);
  const parked=structuredClone(s);parked.capos[0]!.placed[0]!.spaceId='park-0';parseSpeakeasyGameFlow(parked);
  assert.equal(prepareSpeakeasyPlayerCommand(parked,b,body(parked,'EXCHANGE_CAPO',exchangeFields),c).ok,false);
  assert.equal(prepareSpeakeasyPlayerCommand(parked,b,body(parked,'EXCHANGE_CAPO',{...exchangeFields,parkSpaceId:'park-1'}),c).ok,false);
  assert.deepEqual(s,before);
});

test('Speakeasy Park book and city choices are exclusive, validated, private and rollback on failure',()=>{
  const {s,c}=parkReady(),pending=run(s,'EXCHANGE_CAPO',exchangeFields,c,b).candidate;
  const book=run(pending,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}},c,a);
  assert.equal(book.candidate.round.economy.players[0]!.books,4);assert.equal(book.candidate.round.economy.players[0]!.bookReserve,6);
  assert.equal(prepareSpeakeasyPlayerCommand(book.candidate,a,body(book.candidate,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}}),c).ok,false);
  const before=structuredClone(pending);
  for(const choice of [{kind:'BOOK',amount:2},{kind:'CITY_TILE',column:'MIDDLE',row:1},{kind:'CITY_TILE',column:'RIGHT',row:1},
    {kind:'CITY_TILE',column:'RIGHT',row:1,refill:0},{kind:'CITY_TILE',column:'MIDDLE',row:0,refill:2}])
    assert.equal(prepareSpeakeasyPlayerCommand(pending,a,body(pending,'CHOOSE_PARK_BENEFIT',{choice}),c).ok,false);
  assert.deepEqual(pending,before);
  const empty=structuredClone(pending);empty.round.economy.players[0]!.books=10;empty.round.economy.players[0]!.bookReserve=0;
  assert.equal(prepareSpeakeasyPlayerCommand(empty,a,body(empty,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}}),c).ok,false);
  const city=run(pending,'CHOOSE_PARK_BENEFIT',{choice:{kind:'CITY_TILE',column:'RIGHT',row:1,refill:2}},c,a);
  assert.equal(city.candidate.city.right[1]!.tileId,tile('park-hidden'));assert.equal(city.actorView.turn.self.cityTiles[0]!.tileId,tile('park-right'));
  assert.ok(!JSON.stringify(book.actorView).includes('park-hidden'));
  const broken=structuredClone(pending);broken.parkBenefit!.playerId=b;assert.throws(()=>parseSpeakeasyGameFlow(broken));
});

test('Speakeasy Park can exchange into Restaurant only with its mandatory payment and turn-position choice',()=>{
  const {s:initial,c}=parkSetup();
  let s=run(initial,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'restaurant',restaurant:{position:0,discardIds:['hand-0-0']}},c).candidate;
  for(const action of ['BOOKS','CITY_TILES']) {
    s=run(s,'CHOOSE_RESTAURANT_ACTION',{action},c).candidate;s=run(s,'FINISH_RESTAURANT_ACTION',{},c).candidate;
  }
  s=run(s,'FINISH_RESTAURANT',{},c).candidate;s=run(s,'DRAW_OPERATION',{deck:'VIP'},c).candidate;
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'EXCHANGE_CAPO',exchangeFields),c).ok,false);
  const before=structuredClone(s);
  assert.equal(prepareSpeakeasyPlayerCommand(s,b,body(s,'EXCHANGE_CAPO',{...exchangeFields,restaurant:{position:0,discardIds:['hand-1-0']}}),c).ok,false);
  assert.deepEqual(s,before);
  const placed=run(s,'EXCHANGE_CAPO',{...exchangeFields,restaurant:{position:1,discardIds:['hand-1-0','hand-1-1']}},c,b);
  assert.equal(placed.candidate.round.lowerRow[1],b);assert.equal(placed.candidate.round.economy.players[1]!.hand.length,s.round.economy.players[1]!.hand.length-2);
  assert.equal(placed.candidate.locationActions,null);
  const rewarded=run(placed.candidate,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}},c,a);
  assert.equal(rewarded.actorView.turn.stage,'RESTAURANT_CHOICE');assert.equal(rewarded.actorView.turn.actorId,b);
});

test('Speakeasy Park outside-turn city gain waits until the owners next draw and service receipts do not repeat it',async()=>{
  const {s,c}=parkSetup();s.city.held[0]!.tiles=Array.from({length:4},(_,i)=>({tileId:tile(`park-held-${i}`),effectId:'example'}));s.round.economy.players[0]!.cityTileCount=4;
  const roomId=parse(RoomIdSchema,'park-room'),store=new InMemorySpeakeasyCommandStore();store.add(roomId,s,exampleActPlans());
  const service=new SpeakeasyCommandService({store,catalog:c,executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,100)}});
  const context=(actor:PlayerId)=>({roomId,actorPlayerId:actor,authorization:{isCurrent:()=>true}});
  async function send(actor:PlayerId,type:string,fields:object={}) {
    const state=(await store.read(roomId))!.state,request={requestId:`park-${state.round.revision}`,action:body(state,type,fields)};
    const reply=await service.command(context(actor),request);assert.ok(reply.ok,JSON.stringify(reply));return {request,reply};
  }
  await send(a,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0'});await send(a,'SKIP_LOCATION_ACTION',{actionId:'book'});
  await send(a,'FINISH_LOCATION_ACTIONS');await send(a,'DRAW_OPERATION',{deck:'VIP'});
  const swap=await send(b,'EXCHANGE_CAPO',exchangeFields);
  const saved=await store.read(roomId);const replay=await service.command(context(b),swap.request);assert.ok(replay.ok&&replay.replayed);assert.deepEqual(await store.read(roomId),saved);
  const gained=await send(a,'CHOOSE_PARK_BENEFIT',{choice:{kind:'CITY_TILE',column:'MIDDLE',row:0}});
  assert.equal(gained.reply.view.turn.self.cityTiles.length,5);assert.equal(gained.reply.view.turn.self.returnCount,0);
  const rewardSaved=await store.read(roomId);const rewardReplay=await service.command(context(a),gained.request);assert.ok(rewardReplay.ok&&rewardReplay.replayed);assert.deepEqual(await store.read(roomId),rewardSaved);
  const other=await service.snapshot(context(b));assert.ok(other.ok);assert.ok(!JSON.stringify(other.view).includes('park-held-0'));
  await send(b,'SKIP_LOCATION_ACTION',{actionId:'book'});await send(b,'FINISH_LOCATION_ACTIONS');await send(b,'DRAW_OPERATION',{deck:'VIP'});
  assert.equal((await store.read(roomId))!.state.round.clock.round,2);
  const next=(await store.read(roomId))!.state;
  assert.equal(prepareSpeakeasyPlayerCommand(next,a,body(next,'EXCHANGE_CAPO',{capoId:'capo-0-1',targetCapoId:'capo-1-0',parkSpaceId:'park-0'}),c).ok,false);
  await send(a,'EXCHANGE_CAPO',{capoId:'capo-0-1',targetCapoId:'capo-1-0',parkSpaceId:'park-1'});
  await send(b,'CHOOSE_PARK_BENEFIT',{choice:{kind:'BOOK'}});
  await send(a,'SKIP_LOCATION_ACTION',{actionId:'book'});await send(a,'FINISH_LOCATION_ACTIONS');
  const draw=await send(a,'DRAW_OPERATION',{deck:'VIP'});assert.equal(draw.reply.view.turn.stage,'RETURN_CITY');assert.equal(draw.reply.view.turn.self.returnCount,1);
  const done=await send(a,'RETURN_CITY_TILES',{placements:[{tileId:'park-city',row:0}]});assert.equal(done.reply.view.turn.actorId,b);assert.equal(done.reply.view.turn.self.cityTiles.length,4);
});


test('Speakeasy pre-Capo helper city gain also defers excess returns until after the turn draw',()=>{
  const {s,c}=helperSetup();s.city.held[0]!.tiles=Array.from({length:4},(_,i)=>({tileId:tile(`helper-held-${i}`),effectId:'example'}));s.round.economy.players[0]!.cityTileCount=4;
  s.city.middle[0]=[{tileId:tile('helper-city-gain'),effectId:'example'}];
  const helpers=new Map(c.helpers);helpers.set(tile('helper-owned'),state=>{
    state.city.held[0]!.tiles.push(state.city.middle[0]!.shift()!);return {ok:true,value:state};
  });
  const cat={...c,helpers};let r=run(s,'USE_HELPER',{cardId:'helper-owned'},cat);
  assert.equal(r.actorView.turn.stage,'PLACE_CAPO');assert.equal(r.actorView.turn.self.cityTiles.length,5);
  r=run(r.candidate,'PLACE_CAPO',{capoId:'capo-0-0',spaceId:'office-0'},cat);
  r=run(r.candidate,'SKIP_LOCATION_ACTION',{actionId:'helper'},cat);r=run(r.candidate,'FINISH_LOCATION_ACTIONS',{},cat);
  r=run(r.candidate,'DRAW_OPERATION',{deck:'VIP'},cat);assert.equal(r.actorView.turn.stage,'RETURN_CITY');assert.equal(r.actorView.turn.self.returnCount,1);
});


test('Speakeasy displaced owner may decline the optional Park reward without gaining resources',()=>{
  const {s,c}=parkReady(),pending=run(s,'EXCHANGE_CAPO',exchangeFields,c,b).candidate;
  const result=run(pending,'CHOOSE_PARK_BENEFIT',{choice:{kind:'SKIP'}},c,a);
  assert.deepEqual(result.candidate.round.economy,pending.round.economy);assert.deepEqual(result.candidate.city,pending.city);
  assert.equal(result.actorView.turn.stage,'LOCATION');assert.equal(result.actorView.turn.actorId,b);
});
