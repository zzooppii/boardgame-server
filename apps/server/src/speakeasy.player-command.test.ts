import test from 'node:test';
import assert from 'node:assert/strict';
import {parse, safeParse} from 'valibot';
import {GameIdSchema, PlayerIdSchema, SpeakeasyPlayerCommandSchema, type PlayerId} from '@hangul-rummikub/shared';
import {a, b, example, tile} from './speakeasy.fixture.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {startSpeakeasyGameFlow, parseSpeakeasyGameFlow, placeSpeakeasyCapo, finishSpeakeasyLocation,
  drawSpeakeasyTurnCard, settleSpeakeasyGameRound, beginSpeakeasyMobWar, advanceSpeakeasyMobWar,
  type SpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
import {speakeasyCandidate, type SpeakeasyRuleResult} from './games/speakeasy/domain/model.js';
import {prepareSpeakeasyPlayerCommand, type SpeakeasyCommandCatalog} from './games/speakeasy/application/player-command.js';

const empty: SpeakeasyCommandCatalog = {operations: new Map(), city: [], goals: []};
const denied = {ok: false, reason: 'INVALID_ACTION'};
const value = <T>(r: SpeakeasyRuleResult<T>): T => {assert.ok(r.ok); return r.value;};
const guard = (s: SpeakeasyGameFlow) => ({gameId:s.round.gameId, revision:s.round.revision});
function setup(count = 2) {
  const economy = example(count);
  const deck = (operation: 'VIP'|'PARTY'|'STILLS'|'FLEET') => Array.from({length:12}, (_,i) => ({tileId:tile(`draw-${operation}-${i}`), operation, leverage:1}));
  const round = startSpeakeasyRoundLifecycle({gameId:parse(GameIdSchema,'commands'), revision:0, economy,
    clock:{act:1,round:1,seat:0,order:economy.players.map(p=>p.playerId)},
    decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}});
  const capos = economy.players.map((p,i)=>({playerId:p.playerId, available:Array.from({length:4},(_,n)=>tile(`capo-${i}-${n}`)), placed:[], retired:[]}));
  // Synthetic layout and cards, not the official board/catalog.
  const spaces = [{id:'restaurant',location:'RESTAURANT'}, ...capos.flatMap(p=>p.available.map(id=>({id:`space-${id}`,location:'GARAGE'})))];
  return startSpeakeasyGameFlow(round, spaces, capos);
}
function command(s: SpeakeasyGameFlow, type: string, fields: object = {}) {
  return {type, command:{...guard(s), ...fields}};
}
function run(s: SpeakeasyGameFlow, actor: PlayerId, type: string, fields: object = {}, catalog = empty) {
  const before = structuredClone(s), result = prepareSpeakeasyPlayerCommand(s,actor,command(s,type,fields),catalog);
  assert.deepEqual(s,before); assert.ok(result.ok); assert.equal(result.candidate.round.revision,s.round.revision+1);
  assert.equal(result.actorView.turn.revision,result.candidate.round.revision);
  assert.equal(result.actorView.turn.viewerId,actor);
  return result.candidate;
}
function enter(s:SpeakeasyGameFlow) {
  return run(s,a,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'restaurant',restaurant:{position:0,discardIds:[tile('hand-0-0')]}});
}
function choose(s:SpeakeasyGameFlow, action:string) {return run(s,a,'CHOOSE_RESTAURANT_ACTION',{action});}
function close(s:SpeakeasyGameFlow) {return run(s,a,'FINISH_RESTAURANT_ACTION');}
function skip(s:SpeakeasyGameFlow, action:string) {return close(choose(s,action));}

test('Speakeasy player command schema accepts only known strict envelopes and validated bodies',()=>{
  const s=setup();
  const inputs=[command(s,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'restaurant'}),
    command(s,'CHOOSE_RESTAURANT_ACTION',{action:'BOOKS'}),command(s,'FINISH_RESTAURANT_ACTION'),
    command(s,'PLAY_OPERATION',{cardId:tile('hand-0-1')}),command(s,'USE_CITY_TILE',{tileId:tile('city')}),
    command(s,'PLACE_BOOK',{goalId:'goal',space:0}),command(s,'FINISH_RESTAURANT'),
    command(s,'DRAW_OPERATION',{deck:'VIP'}),command(s,'RETURN_CITY_TILES',{placements:[]}),
    command(s,'DEFEND',{buildingId:tile('building'),defend:false,goons:0,useAssociate:false,freeAssociate:false})];
  for(const input of inputs) {
    assert.ok(safeParse(SpeakeasyPlayerCommandSchema,input).success);
    assert.equal(safeParse(SpeakeasyPlayerCommandSchema,{...input,actor:a}).success,false);
    assert.equal(safeParse(SpeakeasyPlayerCommandSchema,{...input,command:{...input.command,economy:s.round.economy}}).success,false);
  }
  for(const input of [null,[],command(s,'SETTLE_ROUND'),command(s,'FINISH_LOCATION'),command(s,'DRAW_OPERATION',{deck:'STRENGTH'}),
    command(s,'PLACE_BOOK',{goalId:'goal',space:2}),command(s,'RETURN_CITY_TILES',{placements:[{tileId:'city',row:3}]}),
    command(s,'FINISH_RESTAURANT',{revision:-1}),command(s,'FINISH_RESTAURANT',{revision:1.5})]) {
    assert.equal(safeParse(SpeakeasyPlayerCommandSchema,input).success,false);
  }
});

test('Speakeasy command preparation refuses outsiders, forged identity, stale revision and unimplemented locations',()=>{
  const s=setup(),before=structuredClone(s);
  const place=command(s,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'restaurant',restaurant:{position:0,discardIds:[tile('hand-0-0')]}});
  for(const actor of [b,parse(PlayerIdSchema,'outsider')]) assert.deepEqual(prepareSpeakeasyPlayerCommand(s,actor,place,empty),denied);
  for(const input of [{...place,actor:a},{...place,command:{...place.command,gameId:'another'}},
    {...place,command:{...place.command,revision:10}},command(s,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'space-capo-0-0'}),
    command(s,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'unknown'}),command(s,'SETTLE_ROUND')]) {
    assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,input,empty),denied);
  }
  assert.deepEqual(s,before);
});

test('Speakeasy prepared candidate is detached, has private actor projection, and cannot apply a stale retry',()=>{
  const s=setup(),before=structuredClone(s), input=command(s,'PLACE_CAPO',{capoId:tile('capo-0-0'),spaceId:'restaurant',restaurant:{position:0,discardIds:[tile('hand-0-0')]}});
  const result=prepareSpeakeasyPlayerCommand(s,a,input,empty);assert.ok(result.ok);
  assert.deepEqual(s,before);
  const wire=JSON.stringify(result.actorView);
  for(const p of s.round.economy.players.filter(p=>p.playerId!==a)) for(const c of p.hand) assert.ok(!wire.includes(JSON.stringify(c.tileId)));
  assert.ok(!wire.includes('draw-VIP-0'));assert.ok(!wire.includes('history'));assert.ok(!wire.includes('decks'));
  assert.deepEqual(prepareSpeakeasyPlayerCommand(result.candidate,a,input,empty),denied);
  result.actorView.turn.self.hand.length=0;
  assert.equal(result.candidate.round.economy.players[0]!.hand.length,3);
  result.candidate.round.economy.players[0]!.cash=99;
  assert.deepEqual(s,before);
});

for(const count of [2,3,4]) test(`Speakeasy ${count}-player restaurant command sequence preserves mandatory draw and changes actor once`,()=>{
  let s=enter(setup(count));
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'FINISH_RESTAURANT'),empty),denied);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'DRAW_OPERATION',{deck:'VIP'}),empty),denied);
  s=skip(s,'BOOKS');s=skip(s,'CITY_TILES');
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,b,command(s,'FINISH_RESTAURANT'),empty),denied);
  s=run(s,a,'FINISH_RESTAURANT');
  const saved=parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.round.phase,'DRAW_OPERATION');
  const input=command(saved,'DRAW_OPERATION',{deck:'VIP'});
  const result=prepareSpeakeasyPlayerCommand(saved,a,input,empty);assert.ok(result.ok);
  assert.equal(result.actorView.turn.actorId,b);assert.equal(result.actorView.turn.stage,'PLACE_CAPO');
  assert.equal(result.candidate.round.economy.players[0]!.hand.at(-1)!.tileId,'draw-VIP-0');
  assert.equal(result.candidate.round.decks.VIP.length,11);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(result.candidate,a,input,empty),denied);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(result.candidate,a,command(result.candidate,'DRAW_OPERATION',{deck:'VIP'}),empty),denied);
});

test('Speakeasy operation command uses only owned catalog cards and preserves bonus then action order',()=>{
  const s=choose(enter(setup()),'OPERATION'),calls:string[]=[];
  const catalog:SpeakeasyCommandCatalog={...empty,operations:new Map([[tile('hand-0-1'),{
    benefit:(state,actor)=>{calls.push('benefit');return speakeasyCandidate(state,c=>{c.players.find(p=>p.playerId===actor)!.cash+=2;return null;});},
    action:(state,actor)=>{calls.push('action');assert.equal(state.players[0]!.cash,17);return speakeasyCandidate(state,c=>{c.players.find(p=>p.playerId===actor)!.safe+=3;return null;});},
  }]])};
  for(const [actor,id] of [[b,'hand-0-1'],[a,'hand-1-1'],[a,'missing'],[a,'hand-0-2']] as const) {
    assert.deepEqual(prepareSpeakeasyPlayerCommand(s,actor,command(s,'PLAY_OPERATION',{cardId:tile(id)}),catalog),denied);
  }
  assert.deepEqual(calls,[]);
  const next=run(s,a,'PLAY_OPERATION',{cardId:tile('hand-0-1')},catalog);
  assert.deepEqual(calls,['benefit','action']);assert.equal(next.round.economy.players[0]!.safe,33);
  assert.equal(next.active!.restaurant!.current!.used,1);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(next,a,command(next,'PLAY_OPERATION',{cardId:tile('hand-0-1')}),catalog),denied);
});

test('Speakeasy failed or throwing server card effects never mutate the original live state',()=>{
  const s=choose(enter(setup()),'OPERATION'),before=structuredClone(s);
  const catalog:SpeakeasyCommandCatalog={...empty,operations:new Map([[tile('hand-0-1'),{
    benefit:state=>{state.players[0]!.cash=999;return {ok:true,value:state};},
    action:()=>({ok:false,reason:'INSUFFICIENT_FUNDS'}),
  }]])};
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'PLAY_OPERATION',{cardId:tile('hand-0-1')}),catalog),denied);
  assert.deepEqual(s,before);
  const broken:SpeakeasyCommandCatalog={...empty,operations:new Map([[tile('hand-0-1'),{
    benefit:state=>{state.players[0]!.cash=999;throw new Error('Faulty server effect');},
    action:state=>({ok:true,value:state}),
  }]])};
  assert.throws(()=>prepareSpeakeasyPlayerCommand(s,a,command(s,'PLAY_OPERATION',{cardId:tile('hand-0-1')}),broken),/Faulty server effect/);
  assert.deepEqual(s,before);
});

test('Speakeasy book command uses server goal payout and cannot forge a bonus or reuse the goal',()=>{
  const s=choose(enter(setup()),'BOOKS');
  const catalog:SpeakeasyCommandCatalog={...empty,goals:[{id:'goal',requirement:{kind:'INFAMY',minimum:1},payout:5,bonus:state=>({ok:true,value:state})}]};
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'PLACE_BOOK',{goalId:'goal',space:0,payout:900}),catalog),denied);
  const next=run(s,a,'PLACE_BOOK',{goalId:'goal',space:0},catalog);
  assert.equal(next.round.economy.players[0]!.safe,35);assert.equal(next.round.economy.players[0]!.books,2);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(next,a,command(next,'PLACE_BOOK',{goalId:'goal',space:1}),catalog),denied);
});

test('Speakeasy city command retains the actor through draw, then returns used tiles before changing turns',()=>{
  let s=setup();s.city.held[0]!.tiles=[{tileId:tile('city-a'),effectId:'cash'}];s.round.economy.players[0]!.cityTileCount=1;
  s=choose(enter(parseSpeakeasyGameFlow(s)),'CITY_TILES');
  const catalog:SpeakeasyCommandCatalog={...empty,city:[{effectId:'cash',resolve:state=>{state.economy.players[0]!.cash+=1;return {ok:true,value:state};}}]};
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'USE_CITY_TILE',{tileId:tile('city-a')}),empty),denied);
  s=run(s,a,'USE_CITY_TILE',{tileId:tile('city-a')},catalog);
  s=skip(close(s),'BOOKS');s=run(s,a,'FINISH_RESTAURANT');s=run(s,a,'DRAW_OPERATION',{deck:'VIP'});
  assert.equal(s.awaitingCityReturn,true);assert.equal(s.active!.playerId,a);
  const fields={placements:[{tileId:tile('city-a'),row:0}]};
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,b,command(s,'RETURN_CITY_TILES',fields),catalog),denied);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'DRAW_OPERATION',{deck:'VIP'}),catalog),denied);
  s=run(s,a,'RETURN_CITY_TILES',fields,catalog);
  assert.equal(s.city.middle[0]![0]!.tileId,'city-a');assert.equal(s.round.clock.seat,1);assert.equal(s.active,null);
});

test('Speakeasy public completion never bypasses an unresolved normal location',()=>{
  const initial=setup();
  const s=value(placeSpeakeasyCapo(initial,a,{...guard(initial),capoId:tile('capo-0-0'),spaceId:'space-capo-0-0'}));
  const before=structuredClone(s);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'FINISH_RESTAURANT'),empty),denied);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,a,command(s,'FINISH_LOCATION'),empty),denied);
  assert.deepEqual(s,before);
});

test('Speakeasy defense command authorizes the current defender and returns only revealed mafia data',()=>{
  let s=setup();const player=s.round.economy.players[0]!;
  s.round.economy.districts[0]!.slots[0]={ownerId:a,piece:player.reserves.shift()!,familyId:null,barrelId:null};
  s=parseSpeakeasyGameFlow(s);
  while(s.round.phase==='PLAYING') {
    const actor=s.round.clock.order[s.round.clock.seat]!,capo=s.capos.find(p=>p.playerId===actor)!.available[0]!;
    s=value(placeSpeakeasyCapo(s,actor,{...guard(s),capoId:capo,spaceId:`space-${capo}`}));
    s=value(finishSpeakeasyLocation(s,guard(s)));s=value(drawSpeakeasyTurnCard(s,actor,{...guard(s),deck:'VIP'}));
    if(s.round.phase==='ROUND_END')s=value(settleSpeakeasyGameRound(s,guard(s)));
  }
  s=value(beginSpeakeasyMobWar(s,guard(s),{districts:[1,2],copDistricts:[1],payoutTables:[[10,5,1],[10,5,1],[10,5,1]],
    deck:[{tileId:tile('revealed-mobster'),strength:1,modifier:0},{tileId:tile('hidden-mobster'),strength:9,modifier:0}]}));
  s=value(advanceSpeakeasyMobWar(s,guard(s)));
  const fields={buildingId:tile('bar-0-0'),defend:false,goons:0,useAssociate:false,freeAssociate:false};
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s,b,command(s,'DEFEND',fields),empty),denied);
  const result=prepareSpeakeasyPlayerCommand(s,a,command(s,'DEFEND',fields),empty);assert.ok(result.ok);
  assert.equal(result.actorView.luciano!.phase,'REVEAL');assert.ok(!JSON.stringify(result.actorView).includes('hidden-mobster'));
  assert.equal(result.candidate.round.economy.districts[0]!.slots[0],null);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(result.candidate,a,command(result.candidate,'DEFEND',fields),empty),denied);
});

for (const count of [2, 3, 4]) test(`Speakeasy ${count}-player command uses printed fixed goals without injected payout data`, () => {
  let s = setup(count);
  s.round.economy.players[0]!.crates = [1, 2, 3];
  s = choose(enter(s), 'BOOKS');
  const before = structuredClone(s), input = command(s, 'PLACE_BOOK', {goalId: 'fixed:docks:1', space: 0});
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s, b, input, empty), denied);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(s, a, command(s, 'PLACE_BOOK', {goalId: 'fixed:docks:1', space: 0, payout: 999}), empty), denied);
  const next = run(s, a, 'PLACE_BOOK', {goalId: 'fixed:docks:1', space: 0});
  assert.equal(next.round.economy.players[0]!.safe, 45);
  assert.deepEqual(prepareSpeakeasyPlayerCommand(next, a, input, empty), denied);
  assert.deepEqual(s, before);
  s = run(next, a, 'PLACE_BOOK', {goalId: 'fixed:docks:2', space: 0});
  s = run(s, a, 'PLACE_BOOK', {goalId: 'fixed:docks:3', space: 0});
  assert.equal(s.round.economy.players[0]!.safe, 75);
  assert.equal(s.round.economy.players[0]!.books, 0);
  s = skip(close(s), 'CITY_TILES'); s = run(s, a, 'FINISH_RESTAURANT');
  assert.equal(s.round.phase, 'DRAW_OPERATION');
  s = run(s, a, 'DRAW_OPERATION', {deck: 'VIP'});
  assert.equal(s.round.clock.order[s.round.clock.seat], b);
});

test('Speakeasy rejects server catalog overrides of printed fixed goal IDs atomically', () => {
  const s = choose(enter(setup()), 'BOOKS'), before = structuredClone(s);
  const catalog: SpeakeasyCommandCatalog = {...empty, goals: [{id: 'fixed:infamy:10',
    requirement: {kind: 'INFAMY', minimum: 1}, payout: 999, bonus: value => ({ok: true, value})}]};
  assert.throws(() => prepareSpeakeasyPlayerCommand(s, a, command(s, 'PLACE_BOOK', {goalId: 'fixed:infamy:10', space: 0}), catalog));
  assert.deepEqual(s, before);
});
