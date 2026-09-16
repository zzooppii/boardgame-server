import {emptyCityTiles, takeAvailableCityTile, cityTileInventory, type CityTileEffect} from './games/speakeasy/domain/city-tiles.js';
import {playSpeakeasyCityTile, returnSpeakeasyTurnCityTiles} from './games/speakeasy/domain/game-flow.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {GameIdSchema} from '@hangul-rummikub/shared';
import {example, a, b, tile} from './speakeasy.fixture.js';
import {type SpeakeasyEconomy, type SpeakeasyRuleResult} from './games/speakeasy/domain/model.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {speakeasyDefenseActor} from './games/speakeasy/domain/luciano.js';
import {type RestaurantBookGoal, type OperationEffects} from './games/speakeasy/domain/restaurant-actions.js';
import {chooseSpeakeasyRestaurantAction, finishSpeakeasyRestaurantAction, playSpeakeasyRestaurantCard, cookSpeakeasyRestaurantBook, startSpeakeasyGameFlow, parseSpeakeasyGameFlow, placeSpeakeasyCapo, finishSpeakeasyLocation,
  drawSpeakeasyTurnCard, settleSpeakeasyGameRound, beginSpeakeasyMobWar, advanceSpeakeasyMobWar,
  defendSpeakeasyGame, beginSpeakeasyNextAct, commitSpeakeasyLocationEconomy, type SpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
const value = <T>(r: SpeakeasyRuleResult<T>): T => {assert.ok(r.ok); return r.value;};
const mobPhase = (s: SpeakeasyGameFlow) => s.luciano?.phase;
const guard = (s: SpeakeasyGameFlow) => ({gameId:s.round.gameId,revision:s.round.revision});
function setup(count = 2) {
  const economy = example(count);
  const deck = (operation: 'VIP'|'PARTY'|'STILLS'|'FLEET') => Array.from({length:12},(_,i)=>({tileId:tile(`deck-${operation}-${i}`),operation,leverage:1}));
  const round = startSpeakeasyRoundLifecycle({gameId:parse(GameIdSchema,'flow'),revision:0,economy,
    clock:{act:1,round:1,seat:0,order:economy.players.map(p=>p.playerId)},
    decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}});
  // Deliberately synthetic slots/catalog: tests sequencing, not official board setup.
  const capos = economy.players.map((p,i)=>({playerId:p.playerId,available:Array.from({length:4},(_,j)=>tile(`capo-${i}-${j}`)),retired:[],placed:[]}));
  const spaces = capos.flatMap(p=>p.available.map(id=>({id:`space-${id}`,location:'GARAGE'})));
  spaces.push({id:'restaurant',location:'RESTAURANT'});
  return startSpeakeasyGameFlow(round,spaces,capos);
}
function place(s:SpeakeasyGameFlow, restaurant = false, position = 0) {
  const actor=s.round.clock.order[s.round.clock.seat]!, capoId=s.capos.find(p=>p.playerId===actor)!.available[0]!;
  const p=s.round.economy.players.find(p=>p.playerId===actor)!;
  return value(placeSpeakeasyCapo(s,actor,{...guard(s),capoId,spaceId:restaurant?'restaurant':`space-${capoId}`,
    ...(restaurant?{restaurant:{position,discardIds:p.hand.slice(0,position >= (s.capos.length===2?1:2)?2:1).map(c=>c.tileId)}}:{})}));
}
function end(s:SpeakeasyGameFlow) {
  const actor=s.round.clock.order[s.round.clock.seat]!;
  if(s.active?.restaurant) {
    for(const action of ['CITY_TILES','BOOKS'] as const) {
      s=value(chooseSpeakeasyRestaurantAction(s,actor,{...guard(s),action}));
      s=value(finishSpeakeasyRestaurantAction(s,actor,guard(s)));
    }
  }
  s=value(finishSpeakeasyLocation(s,guard(s)));
  const deck=(['VIP','PARTY','STILLS','FLEET'] as const).find(d=>s.round.decks[d].length)!;
  return value(drawSpeakeasyTurnCard(s,actor,{...guard(s),deck}));
}
function finishAct(s:SpeakeasyGameFlow) {
  while(s.round.phase==='PLAYING') {
    s=end(place(s));
    if(s.round.phase==='ROUND_END') s=value(settleSpeakeasyGameRound(s,guard(s)));
  }
  return s;
}
function war(s:SpeakeasyGameFlow) {
  const act=s.round.clock.act;
  const count=s.capos.length===2?[2,2,3][act-1]!:[3,3,4][act-1]!;
  const districts=s.round.economy.districts.filter(d=>!d.blocked&&d.mobsterStrength===null).slice(0,count).map(d=>d.id);
  return value(beginSpeakeasyMobWar(s,guard(s),{districts,copDistricts:[],payoutTables:[[12,8,4,2,1],[12,8,4,2,1],[12,8,4,2,1]],
    deck:districts.map((_,i)=>({tileId:tile(`mobster-${act}-${i}`),strength:1,modifier:0}))}));
}
function finishWar(s:SpeakeasyGameFlow) {
  while(s.luciano?.phase!=='COMPLETE') {
    if(s.luciano?.phase==='DEFENSE') {
      const actor=speakeasyDefenseActor(s.luciano)!;
      const buildingId=s.luciano.current!.pending.find(id=>s.round.economy.districts.some(d=>d.slots.some(b=>b?.piece.tileId===id&&b.ownerId===actor)))!;
      s=value(defendSpeakeasyGame(s,actor,{...guard(s),buildingId,defend:false,goons:0,useAssociate:false,freeAssociate:false}));
    } else s=value(advanceSpeakeasyMobWar(s,guard(s)));
  }
  return s;
}

test('Capo placement requires turn ownership, a real own Capo and an available verified space',()=>{
  const s=setup(), before=structuredClone(s), command={...guard(s),capoId:tile('capo-0-0'),spaceId:'space-capo-0-0'};
  for(const input of [{...command,capoId:tile('capo-1-0')},{...command,spaceId:'missing'}, {...command,revision:10},
    {...command,gameId:'other'},{...command,actor:a},{...command,restaurant:{position:0,discardIds:[tile('hand-0-0')]}}]) assert.equal(placeSpeakeasyCapo(s,a,input).ok,false);
  assert.equal(placeSpeakeasyCapo(s,b,command).ok,false);
  const next=place(s);assert.equal(next.round.revision,1);assert.equal(next.capos[0]!.available.length,3);
  assert.equal(placeSpeakeasyCapo(next,a,{...command,...guard(next)}).ok,false);
  assert.deepEqual(s,before);
});
test('Cannot finish actions, commit location effects or draw before placing a Capo',()=>{
  const s=setup();assert.equal(finishSpeakeasyLocation(s,guard(s)).ok,false);
  assert.equal(commitSpeakeasyLocationEconomy(s,guard(s),{ok:true,value:s.round.economy}).ok,false);
  assert.equal(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}).ok,false);
  const placed=place(s);assert.equal(drawSpeakeasyTurnCard(placed,a,{...guard(placed),deck:'VIP'}).ok,false);
});
test('Normal space stays occupied after a turn; Restaurant permits multiple Capos with atomic payment',()=>{
  let s=end(place(setup()));
  assert.equal(placeSpeakeasyCapo(s,b,{...guard(s),capoId:tile('capo-1-0'),spaceId:'space-capo-0-0'}).ok,false);
  s=setup();const before=structuredClone(s);
  assert.equal(placeSpeakeasyCapo(s,a,{...guard(s),capoId:tile('capo-0-0'),spaceId:'restaurant'}).ok,false);
  assert.equal(placeSpeakeasyCapo(s,a,{...guard(s),capoId:tile('capo-0-0'),spaceId:'restaurant',restaurant:{position:1,discardIds:[tile('hand-1-0'),tile('hand-1-1')]}}).ok,false);
  assert.deepEqual(s,before);
  s=end(place(s,true,1)); s=end(place(s,true,0));
  assert.ok(s.capos.every(p=>p.placed[0]!.spaceId==='restaurant'));
  s=value(settleSpeakeasyGameRound(s,guard(s))); assert.deepEqual(s.round.clock.order,[b,a]);
  assert.equal(s.active,null);
});
test('Drawing ends the active location but does not free its space or allow replay',()=>{
  const s=place(setup()), ready=value(finishSpeakeasyLocation(s,guard(s)));
  assert.equal(finishSpeakeasyLocation(ready,guard(ready)).ok,false);
  const next=end(s);assert.equal(next.active,null);assert.equal(next.capos[0]!.placed.length,1);
  assert.equal(drawSpeakeasyTurnCard(next,a,{...guard(ready),deck:'VIP'}).ok,false);
  assert.equal(commitSpeakeasyLocationEconomy(ready,guard(ready),{ok:true,value:ready.round.economy}).ok,false);
});
test('All 2/3/4-player acts preserve Capos and carry settled economy/decks through Mob War',()=>{
  for(const count of [2,3,4]) {
    let s=setup(count), turns=0;
    const initialCapos=s.capos.flatMap(p=>p.available).sort();
    for(let act=1;act<=4;act++) {
      const rounds=[4,3,3,1][act-1]!;
      s=finishAct(s);turns+=rounds*count;
      assert.ok(s.capos.every(p=>p.available.length===0&&p.placed.length===rounds));
      if(act===4){assert.equal(s.round.phase,'FINAL_SCORING');break;}
      assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
      s=war(s);assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
      assert.equal(beginSpeakeasyMobWar(s,guard(s),s.luciano!).ok,false);
      s=finishWar(s);const old=structuredClone(s), previous=guard(s);
      s=value(beginSpeakeasyNextAct(s,guard(s)));
      assert.equal(s.round.clock.act,act+1);assert.equal(s.round.clock.round,1);
      assert.deepEqual(s.round.economy,old.round.economy);assert.deepEqual(s.round.decks,old.round.decks);
      assert.equal(s.history.length,act);assert.equal(s.luciano,null);
      assert.ok(s.capos.every(p=>p.available.length===[3,3,1][act-1]&&p.placed.length===0));
      assert.equal(beginSpeakeasyNextAct(s,previous).ok,false);
      assert.deepEqual(s.capos.flatMap(p=>[...p.available,...p.retired]).sort(),initialCapos);
    }
    assert.equal(turns,11*count);assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  }
});
test('Restored flow retains exact location, draw, occupied slots and rejects inconsistent progress',()=>{
  const s=value(finishSpeakeasyLocation(place(setup()),{gameId:parse(GameIdSchema,'flow'),revision:1}));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),s);
  assert.throws(()=>parseSpeakeasyGameFlow({...s,active:null}));
  const bad=structuredClone(s);bad.capos[0]!.available.push(bad.capos[0]!.placed[0]!.tileId);
  assert.throws(()=>parseSpeakeasyGameFlow(bad));
  const missing=structuredClone(s);missing.spaces=[];assert.throws(()=>parseSpeakeasyGameFlow(missing));
  const final=finishWar(war(finishAct(setup())));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(final))),final);
  const mismatched=structuredClone(final);mismatched.luciano!.revision--;assert.throws(()=>parseSpeakeasyGameFlow(mismatched));
  const next=value(beginSpeakeasyNextAct(final,guard(final)));assert.throws(()=>parseSpeakeasyGameFlow({...next,history:[]}));
});

test('Location effects commit only during the active action and failures preserve the full flow',()=>{
  const s=place(setup()), before=structuredClone(s);
  const failed=commitSpeakeasyLocationEconomy(s,guard(s),{ok:false,reason:'INSUFFICIENT_FUNDS'});
  assert.deepEqual(failed,{ok:false,reason:'INSUFFICIENT_FUNDS'});assert.deepEqual(s,before);
  // A resolved server reward. Clients never supply an economy snapshot to this internal hook.
  const reward=structuredClone(s.round.economy);reward.players[0]!.cash+=3;
  const next=value(commitSpeakeasyLocationEconomy(s,guard(s),{ok:true,value:reward}));
  assert.equal(next.round.economy.players[0]!.cash,s.round.economy.players[0]!.cash+3);
  assert.equal(next.round.revision,s.round.revision+1);assert.deepEqual(next.active,s.active);
  assert.equal(commitSpeakeasyLocationEconomy(next,guard(s),{ok:true,value:reward}).ok,false);
});

test('Mob War pauses for the owner defense and police/payout cannot be skipped before the next act',()=>{
  let s=setup();
  const p=s.round.economy.players[0]!, index=p.reserves.findIndex(b=>b.kind==='SPEAKEASY');
  s.round.economy.districts[0]!.slots[0]={piece:p.reserves.splice(index,1)[0]!,ownerId:a,familyId:null,barrelId:null};
  s=war(finishAct(parseSpeakeasyGameFlow(s)));
  s=value(advanceSpeakeasyMobWar(s,guard(s)));assert.equal(mobPhase(s),'DEFENSE');
  const command={...guard(s),buildingId:s.luciano!.current!.pending[0]!,defend:false,goons:0,useAssociate:false,freeAssociate:false};
  assert.equal(advanceSpeakeasyMobWar(s,guard(s)).ok,false);
  assert.equal(defendSpeakeasyGame(s,b,command).ok,false);
  assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  const previous=structuredClone(s);
  s=value(defendSpeakeasyGame(s,a,command));
  assert.equal(previous.round.economy.districts[0]!.slots[0]!.ownerId,a);
  assert.equal(s.round.economy.districts[0]!.slots[0],null);
  assert.equal(defendSpeakeasyGame(s,a,command).ok,false);
  while(s.luciano!.phase!=='PAYOUT') s=value(advanceSpeakeasyMobWar(s,guard(s)));
  assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  s=value(advanceSpeakeasyMobWar(s,guard(s)));
  const money=s.round.economy.players.map(p=>p.safe);
  assert.equal(advanceSpeakeasyMobWar(s,guard(s)).ok,false);
  s=value(beginSpeakeasyNextAct(s,guard(s)));
  assert.deepEqual(s.round.economy.players.map(p=>p.safe),money);
});


const unchanged = (s: SpeakeasyEconomy): SpeakeasyRuleResult<SpeakeasyEconomy> => ({ok:true,value:s});
const noEffects: OperationEffects = {benefit:unchanged,action:unchanged};
const goals: RestaurantBookGoal[] = Array.from({length:4},(_,i)=>({id:`goal-${i}`,requirement:{kind:'INFAMY',minimum:1},payout:5,bonus:unchanged}));
function choose(s:SpeakeasyGameFlow,action:'OPERATION'|'CITY_TILES'|'BOOKS') {
  return value(chooseSpeakeasyRestaurantAction(s,a,{...guard(s),action}));
}
function close(s:SpeakeasyGameFlow) {return value(finishSpeakeasyRestaurantAction(s,a,guard(s)));}

test('Restaurant chooses two distinct actions in either order and explicitly closes optional actions',()=>{
  for(const actions of [['BOOKS','OPERATION'],['OPERATION','CITY_TILES'],['CITY_TILES','BOOKS']] as const) {
    let s=place(setup(),true);
    assert.equal(finishSpeakeasyLocation(s,guard(s)).ok,false);
    for(const action of actions) {
      s=choose(s,action);
      assert.equal(finishSpeakeasyLocation(s,guard(s)).ok,false);
      assert.equal(chooseSpeakeasyRestaurantAction(s,a,{...guard(s),action:'BOOKS'}).ok,false);
      s=close(s); // All location actions except the entry payment/order change are optional (rules p13).
      assert.equal(chooseSpeakeasyRestaurantAction(s,a,{...guard(s),action}).ok,false);
    }
    assert.equal(chooseSpeakeasyRestaurantAction(s,a,{...guard(s),action:'OPERATION'}).ok,false);
    const ready=value(finishSpeakeasyLocation(s,guard(s)));
    assert.equal(ready.round.phase,'DRAW_OPERATION');
    assert.equal(drawSpeakeasyTurnCard(ready,a,{...guard(ready),deck:'VIP'}).ok,true);
  }
});
test('Restaurant action commands reject outsiders, stale revisions, forged fields and other locations',()=>{
  const s=place(setup(),true), original=structuredClone(s);
  const command={...guard(s),action:'BOOKS'};
  assert.equal(chooseSpeakeasyRestaurantAction(s,b,command).ok,false);
  for(const c of [{...command,revision:0},{...command,gameId:'other'},{...command,action:'UNKNOWN'},{...command,actor:a}]) assert.equal(chooseSpeakeasyRestaurantAction(s,a,c).ok,false);
  assert.equal(chooseSpeakeasyRestaurantAction(place(setup()),a,command).ok,false);
  assert.equal(commitSpeakeasyLocationEconomy(s,guard(s),unchanged(s.round.economy)).ok,false);
  assert.deepEqual(s,original);
});
test('Operations replacement returns the old card to its deck and resolves benefit before action once',()=>{
  let s=setup();s.round.economy.players[0]!.hand[1]!.operation='VIP';
  s=choose(place(s,true),'OPERATION');const before=structuredClone(s), order:string[]=[];
  const effects:OperationEffects={benefit:(state,actor,card)=>{
    order.push('benefit');const p=state.players.find(p=>p.playerId===actor)!;
    assert.equal(card.operation,'VIP');assert.equal(p.operations[0]!.tileId,card.tileId);
    p.cash+=2;return unchanged(state);
  },action:(state,actor)=>{order.push('action');assert.equal(state.players.find(p=>p.playerId===actor)!.cash,17);return unchanged(state);}};
  const command={...guard(s),cardId:tile('hand-0-1')};
  const next=value(playSpeakeasyRestaurantCard(s,a,command,effects));
  assert.deepEqual(order,['benefit','action']);assert.equal(next.round.revision,s.round.revision+1);
  assert.equal(next.round.decks.VIP.at(-1)!.tileId,tile('installed-0'));
  assert.equal(next.active!.restaurant!.current!.used,1);
  assert.equal(playSpeakeasyRestaurantCard(next,a,{...guard(next),cardId:tile('hand-0-2')},effects).ok,false);
  assert.equal(playSpeakeasyRestaurantCard(next,a,command,effects).ok,false);assert.deepEqual(s,before);
});
test('Failed operation effects roll back replacement, benefit and action allowance',()=>{
  const s=choose(place(setup(),true),'OPERATION'), before=structuredClone(s);
  const effects:OperationEffects={benefit:state=>{state.players[0]!.cash+=100;return unchanged(state);},action:()=>({ok:false,reason:'INVALID_ACTION'})};
  assert.equal(playSpeakeasyRestaurantCard(s,a,{...guard(s),cardId:tile('hand-0-1')},effects).ok,false);
  assert.deepEqual(s,before);
  assert.equal(playSpeakeasyRestaurantCard(s,a,{...guard(s),cardId:tile('hand-1-1')},noEffects).ok,false);
  assert.equal(playSpeakeasyRestaurantCard(s,a,{...guard(s),cardId:tile('installed-0')},noEffects).ok,false);
});
test('Restaurant books apply sequential bonuses, pay safe money and stop at three',()=>{
  let s=choose(place(setup(),true),'BOOKS');
  const catalog:RestaurantBookGoal[]=goals.map(g=>({...g,bonus:state=>{
    const p=state.players[0]!;p.bookReserve--;p.books++;return unchanged(state);
  }}));
  for(let i=0;i<3;i++) s=value(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:`goal-${i}`,space:0},catalog));
  assert.equal(s.round.economy.players[0]!.safe,45);assert.equal(s.round.economy.players[0]!.cash,15);
  assert.equal(s.round.economy.players[0]!.books,3);assert.equal(s.round.economy.placedBooks.length,3);
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-3',space:0},catalog).ok,false);
  s=close(s);assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-3',space:0},catalog).ok,false);
});
test('Book failures preserve placement count and funds; later books use the updated goal requirements',()=>{
  let s=choose(place(setup(),true),'BOOKS');const before=structuredClone(s);
  const blocked:RestaurantBookGoal[]=[{...goals[0]!,requirement:{kind:'CRATES',minimum:1}}];
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:0},blocked).ok,false);
  assert.equal(cookSpeakeasyRestaurantBook(s,b,{...guard(s),goalId:'goal-0',space:0},goals).ok,false);
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'missing',space:0},goals).ok,false);
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:0,payout:100},goals).ok,false);
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:0},[{...goals[0]!,bonus:()=>({ok:false,reason:'INVALID_ACTION'})}]).ok,false);
  assert.deepEqual(s,before);
  const sequential:RestaurantBookGoal[]=[{...goals[0]!,bonus:state=>{state.players[0]!.crates.push(1);return unchanged(state);}},
    {...goals[1]!,requirement:{kind:'CRATES',minimum:1}}];
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-1',space:0},sequential).ok,false);
  s=value(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:0},sequential));
  assert.equal(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:1},goals).ok,false);
  s=value(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-1',space:0},sequential));
  assert.equal(s.round.economy.placedBooks.length,2);
});
test('Restaurant restore preserves in-progress allowance and rejects impossible or prematurely finished choices',()=>{
  let s=choose(place(setup(),true),'BOOKS');
  s=value(cookSpeakeasyRestaurantBook(s,a,{...guard(s),goalId:'goal-0',space:0},goals));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),s);
  const bad=structuredClone(s);bad.active!.restaurant!.current!.used=4;assert.throws(()=>parseSpeakeasyGameFlow(bad));
  const duplicate=structuredClone(s);duplicate.active!.restaurant!.completed=['BOOKS'];assert.throws(()=>parseSpeakeasyGameFlow(duplicate));
  const premature=structuredClone(s);premature.round.phase='DRAW_OPERATION';assert.throws(()=>parseSpeakeasyGameFlow(premature));
});


function cityGame(count=2) {
  const s=setup();
  s.city=emptyCityTiles(s.round.clock.order);
  s.city.held[0]!.tiles=Array.from({length:count},(_,i)=>({tileId:tile(`city-${i}`),effectId:'reward'}));
  s.round.economy.players[0]!.cityTileCount=count;
  s.city.middle=[[{tileId:tile('market-first'),effectId:'gain'}],[{tileId:tile('market-second'),effectId:'reward'}],[]];
  s.city.right=[{tileId:tile('right-visible'),effectId:'reward'},null,null];
  s.city.supply=[[{tileId:tile('hidden-city'),effectId:'reward'}],[],[]];
  return parseSpeakeasyGameFlow(s);
}
const cityReward:CityTileEffect={effectId:'reward',resolve:(s,actor)=>{
  s.economy.players.find(p=>p.playerId===actor)!.cash+=2;return {ok:true,value:s};
}};
function playCity(s:SpeakeasyGameFlow,id:string,catalog:readonly CityTileEffect[]=[cityReward]) {
  return value(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile(id)},catalog));
}
function readyAfterCities(s:SpeakeasyGameFlow) {
  s=close(s);s=close(choose(s,'BOOKS'));return value(finishSpeakeasyLocation(s,guard(s)));
}
test('City tiles are individually owned, used once, and unavailable in the display until turn end',()=>{
  let s=choose(place(cityGame(),true),'CITY_TILES');const before=structuredClone(s);
  s=playCity(s,'city-0');assert.equal(s.round.economy.players[0]!.cash,17);
  assert.equal(s.round.economy.players[0]!.cityTileCount,2);
  assert.deepEqual(s.city.played,[tile('city-0')]);assert.ok(!s.city.middle.flat().some(t=>t.tileId===tile('city-0')));
  assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-0')},[cityReward]).ok,false);
  s=playCity(s,'city-1');assert.equal(s.round.economy.players[0]!.cash,19);
  assert.equal(s.active!.restaurant!.current!.used,2);
  assert.equal(before.round.economy.players[0]!.cash,15);assert.equal(before.city.played.length,0);
});
test('City action may use a newly gained tile, but cannot exceed two plays',()=>{
  let s=cityGame();s.city.held[0]!.tiles[0]!.effectId='gain';
  s=choose(place(s,true),'CITY_TILES');
  const gain:CityTileEffect={effectId:'gain',resolve:(state,actor)=>{
    const result=takeAvailableCityTile(state.city,actor,'MIDDLE',1);
    return result.ok?{ok:true,value:{...state,city:result.value}}:result;
  }};
  s=playCity(s,'city-0',[gain]);s=playCity(s,'market-second');
  assert.equal(s.round.economy.players[0]!.cityTileCount,3);
  assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-1')},[cityReward]).ok,false);
});
test('City failures, unknown effects, foreign/hidden IDs and forged commands preserve the entire state',()=>{
  const s=choose(place(cityGame(),true),'CITY_TILES'), before=structuredClone(s);
  for(const id of ['hidden-city','right-visible','missing']) assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile(id)},[cityReward]).ok,false);
  assert.equal(playSpeakeasyCityTile(s,b,{...guard(s),tileId:tile('city-0')},[cityReward]).ok,false);
  assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-0'),effectId:'reward'},[cityReward]).ok,false);
  assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-0')},[]).ok,false);
  const fail:CityTileEffect={effectId:'reward',resolve:state=>{state.economy.players[0]!.cash+=99;state.city.held[0]!.tiles.pop();return {ok:false,reason:'INVALID_ACTION'};}};
  assert.equal(playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-0')},[fail]).ok,false);assert.deepEqual(s,before);
  const corrupt:CityTileEffect={effectId:'reward',resolve:state=>{state.city.played=[];return {ok:true,value:state};}};
  assert.throws(()=>playSpeakeasyCityTile(s,a,{...guard(s),tileId:tile('city-0')},[corrupt]));assert.deepEqual(s,before);
});
test('City returns follow the mandatory draw and delay the next player until empty/shortest piles are filled',()=>{
  let s=choose(place(cityGame(),true),'CITY_TILES');s=playCity(s,'city-0');s=playCity(s,'city-1');s=readyAfterCities(s);
  const beforeDraw=s;
  assert.equal(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements:[{tileId:tile('city-0'),row:2},{tileId:tile('city-1'),row:0}]}).ok,false);
  s=value(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}));
  assert.equal(s.round.economy.players[0]!.hand.length,beforeDraw.round.economy.players[0]!.hand.length+1);
  assert.equal(s.round.clock.seat,0);assert.equal(s.awaitingCityReturn,true);
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),s);
  assert.equal(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}).ok,false);
  const wrong={...guard(s),placements:[{tileId:tile('city-0'),row:0},{tileId:tile('city-1'),row:1}]};
  assert.equal(returnSpeakeasyTurnCityTiles(s,a,wrong).ok,false);
  const before=structuredClone(s);
  s=value(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements:[{tileId:tile('city-0'),row:2},{tileId:tile('city-1'),row:0}]}));
  assert.equal(s.city.middle[0]![0]!.tileId,tile('city-1'));
  assert.equal(s.round.economy.players[0]!.cityTileCount,0);assert.equal(s.city.played.length,0);
  assert.deepEqual(cityTileInventory(s.city),cityTileInventory(before.city));
  assert.equal(returnSpeakeasyTurnCityTiles(s,a,wrong).ok,false);
  assert.equal(s.round.clock.seat,1);assert.equal(s.active,null);assert.equal(s.awaitingCityReturn,false);
});
test('Overflow returns only the chosen excess plus played tiles, preserving four unused tiles',()=>{
  // Gain during a turn: exceeding four is legal until end of turn, not during initial setup.
  let s=place(cityGame(4),true);
  s.city.held[0]!.tiles.push(s.city.middle[0]!.shift()!,s.city.middle[1]!.shift()!);
  s.round.economy.players[0]!.cityTileCount=6;
  s=choose(parseSpeakeasyGameFlow(s),'CITY_TILES');s=playCity(s,'city-0');s=readyAfterCities(s);s=value(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}));
  const placements=[{tileId:tile('city-0'),row:0},{tileId:tile('market-first'),row:1}];
  assert.equal(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements:placements.slice(0,1)}).ok,false);
  assert.equal(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements:[placements[0],placements[0]]}).ok,false);
  s=value(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements}));
  assert.equal(s.city.held[0]!.tiles.length,4);assert.equal(s.round.economy.players[0]!.cityTileCount,4);
});
test('City display draws expose only top tiles, refill the right column and never refill middle piles',()=>{
  const s=cityGame().city, original=structuredClone(s);
  const middle=value(takeAvailableCityTile(s,a,'MIDDLE',0));assert.equal(middle.middle[0]!.length,0);assert.deepEqual(middle.supply,s.supply);
  assert.equal(takeAvailableCityTile(s,a,'RIGHT',0).ok,false);
  assert.equal(takeAvailableCityTile(s,a,'RIGHT',0,1).ok,false);
  const right=value(takeAvailableCityTile(s,a,'RIGHT',0,0));assert.equal(right.right[0]!.tileId,tile('hidden-city'));
  assert.equal(right.held[0]!.tiles.at(-1)!.tileId,tile('right-visible'));assert.deepEqual(s,original);
});
test('City restore preserves pending returns and rejects duplicated identities, counts and ownership',()=>{
  let s=choose(place(cityGame(),true),'CITY_TILES');s=readyAfterCities(playCity(s,'city-0'));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),s);
  const count=structuredClone(s);count.round.economy.players[0]!.cityTileCount++;assert.throws(()=>parseSpeakeasyGameFlow(count));
  const duplicate=structuredClone(s);duplicate.city.middle[0]!.push(duplicate.city.held[0]!.tiles[0]!);assert.throws(()=>parseSpeakeasyGameFlow(duplicate));
  const foreign=structuredClone(s);foreign.city.played=[tile('right-visible')];assert.throws(()=>parseSpeakeasyGameFlow(foreign));
});

test('Last-player city cleanup delays round settlement until after the draw and tile return',()=>{
  let s=end(place(cityGame()));
  s.city.held[1]!.tiles.push(s.city.middle[1]!.shift()!);s.round.economy.players[1]!.cityTileCount=1;
  s=place(parseSpeakeasyGameFlow(s),true);
  s=value(chooseSpeakeasyRestaurantAction(s,b,{...guard(s),action:'CITY_TILES'}));
  s=value(playSpeakeasyCityTile(s,b,{...guard(s),tileId:tile('market-second')},[cityReward]));
  s=value(finishSpeakeasyRestaurantAction(s,b,guard(s)));
  s=value(chooseSpeakeasyRestaurantAction(s,b,{...guard(s),action:'BOOKS'}));
  s=value(finishSpeakeasyRestaurantAction(s,b,guard(s)));s=value(finishSpeakeasyLocation(s,guard(s)));
  s=value(drawSpeakeasyTurnCard(s,b,{...guard(s),deck:'VIP'}));
  assert.equal(s.round.clock.seat,1);assert.equal(s.awaitingCityReturn,true);
  assert.equal(settleSpeakeasyGameRound(s,guard(s)).ok,false);
  s=value(returnSpeakeasyTurnCityTiles(s,b,{...guard(s),placements:[{tileId:tile('market-second'),row:2}]}));
  assert.equal(s.round.phase,'ROUND_END');assert.equal(s.awaitingCityReturn,false);
  s=value(settleSpeakeasyGameRound(s,guard(s)));assert.equal(s.round.clock.round,2);
});

// Per-viewer turn data must be safe even before a transport is connected.
import {projectSpeakeasyTurn} from './games/speakeasy/application/turn-projector.js';
import {SpeakeasyTurnViewSchema,PlayerIdSchema} from '@hangul-rummikub/shared';
test('Turn projection separates private hands and funds for every supported player count',()=>{
  for(const count of [2,3,4]) {
    const s=setup(count);
    for(const player of s.round.economy.players) {
      const view=projectSpeakeasyTurn(s,player.playerId)!;
      assert.deepEqual(parse(SpeakeasyTurnViewSchema,JSON.parse(JSON.stringify(view))),view);
      assert.equal(view.stage,'PLACE_CAPO');assert.equal(view.actorId,a);
      assert.deepEqual(view.self.hand,player.hand);assert.equal(view.self.safe,player.safe);
      const wire=JSON.stringify(view);
      for(const other of s.round.economy.players.filter(p=>p.playerId!==player.playerId)) {
        for(const card of other.hand) assert.ok(!wire.includes(card.tileId));
      }
      for(const card of Object.values(s.round.decks).flat()) assert.ok(!wire.includes(card.tileId));
      assert.deepEqual(view.self.drawDecks,[]);
    }
  }
  assert.equal(projectSpeakeasyTurn(setup(),parse(PlayerIdSchema,'outsider')),null);
});
test('Hidden identities, order and opponent funds cannot change the viewer turn projection',()=>{
  const s=cityGame(), before=projectSpeakeasyTurn(s,a);
  s.city.middle[0]!.push({tileId:tile('buried-secret'),effectId:'buried-effect'});
  const withBuried=projectSpeakeasyTurn(s,a)!;
  assert.equal(withBuried.market.middle[0]!.count,2);
  assert.equal(withBuried.market.middle[0]!.top!.tileId,tile('market-first'));
  const changed=structuredClone(s);
  changed.round.economy.players[1]!.safe=999;
  changed.round.economy.players[1]!.hand.reverse();
  changed.round.economy.players[1]!.hand[0]!.leverage=9;
  changed.round.decks.VIP.reverse();
  changed.city.supply[0]![0]={tileId:tile('different-secret'),effectId:'different-effect'};
  changed.city.middle[0]![1]={tileId:tile('different-buried'),effectId:'different-effect'};
  assert.deepEqual(projectSpeakeasyTurn(changed,a),withBuried);
  assert.ok(!JSON.stringify(withBuried).includes('hidden-city'));
  assert.ok(!JSON.stringify(withBuried).includes('buried-secret'));
  assert.ok(before);
});
test('Turn projection is detached from canonical state and rejects invalid restored state',()=>{
  const s=cityGame(), before=structuredClone(s), view=projectSpeakeasyTurn(s,a)!;
  view.self.hand.pop();view.self.availableCapos.length=0;view.self.cityTiles[0]!.effectId='changed';
  view.market.middle[0]!.top!.effectId='changed';view.order.reverse();
  assert.deepEqual(s,before);
  const bad=structuredClone(s);bad.awaitingCityReturn=true;
  assert.throws(()=>projectSpeakeasyTurn(bad,a));
});
test('Turn panel follows Restaurant choices, completion and the mandatory draw without enabling observers',()=>{
  let s=place(setup(),true);
  assert.equal(projectSpeakeasyTurn(s,a)!.stage,'RESTAURANT_CHOICE');
  s=choose(s,'CITY_TILES');assert.equal(projectSpeakeasyTurn(s,a)!.stage,'RESTAURANT_ACTION');
  assert.equal(projectSpeakeasyTurn(s,b)!.restaurant!.current!.action,'CITY_TILES');
  s=close(s);s=close(choose(s,'BOOKS'));
  assert.equal(projectSpeakeasyTurn(s,a)!.stage,'FINISH_LOCATION');
  s=value(finishSpeakeasyLocation(s,guard(s)));
  assert.equal(projectSpeakeasyTurn(s,a)!.stage,'DRAW_OPERATION');
  assert.deepEqual(projectSpeakeasyTurn(s,a)!.self.drawDecks,['VIP','PARTY','STILLS','FLEET']);
  assert.deepEqual(projectSpeakeasyTurn(s,b)!.self.drawDecks,[]);
  s=value(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}));
  const next=projectSpeakeasyTurn(s,b)!;
  assert.equal(next.actorId,b);assert.equal(next.stage,'PLACE_CAPO');assert.equal(next.active,null);
  assert.equal(next.spaces.find(p=>p.id==='restaurant')!.occupants[0]!.playerId,a);
});
test('Return projection preserves actor after draw and exposes only own required choices',()=>{
  let s=playCity(choose(place(cityGame(),true),'CITY_TILES'),'city-0');
  s=readyAfterCities(s);s=value(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}));
  const view=projectSpeakeasyTurn(s,a)!, other=projectSpeakeasyTurn(s,b)!;
  assert.equal(view.stage,'RETURN_CITY');assert.equal(view.actorId,a);
  assert.equal(view.self.returnCount,1);assert.deepEqual(view.self.mandatoryReturnIds,[tile('city-0')]);
  assert.deepEqual(view.self.eligibleReturnIds,[tile('city-0')]);assert.deepEqual(view.self.firstReturnRows,[2]);
  assert.deepEqual(view.self.drawDecks,[]);assert.equal(other.self.returnCount,0);
  assert.deepEqual(other.self.mandatoryReturnIds,[]);assert.deepEqual(other.self.firstReturnRows,[]);
  assert.ok(view.self.hand.some(c=>c.tileId===tile('deck-VIP-0')));
  assert.ok(!JSON.stringify(other).includes('deck-VIP-0'));
  assert.deepEqual(projectSpeakeasyTurn(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),a),view);
  s=value(returnSpeakeasyTurnCityTiles(s,a,{...guard(s),placements:[{tileId:tile('city-0'),row:2}]}));
  assert.equal(projectSpeakeasyTurn(s,b)!.stage,'PLACE_CAPO');assert.equal(projectSpeakeasyTurn(s,b)!.actorId,b);
});
test('Return projection includes optional excess tiles as well as mandatory used tiles',()=>{
  let s=choose(place(cityGame(4),true),'CITY_TILES');
  s=playCity(s,'city-0',[{effectId:'reward',resolve:state=>{
    state.city.held[0]!.tiles.push(...state.city.middle[0]!.splice(0),...state.city.middle[1]!.splice(0));
    return {ok:true,value:state};
  }}]);
  s=readyAfterCities(s);s=value(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}));
  const view=projectSpeakeasyTurn(s,a)!;
  assert.equal(view.self.returnCount,2);assert.equal(view.self.eligibleReturnIds.length,6);
  assert.equal(view.self.mandatoryReturnIds.length,1);assert.deepEqual(view.self.firstReturnRows,[0,1,2]);
});
test('Round and Luciano waiting stages do not expose previous actor actions or future mobs',()=>{
  let s=end(place(end(place(setup()))));
  assert.equal(projectSpeakeasyTurn(s,a)!.stage,'ROUND_END');assert.equal(projectSpeakeasyTurn(s,a)!.actorId,null);
  s=finishAct(setup());
  const piece=s.round.economy.players[0]!.reserves.shift()!;
  s.round.economy.districts[0]!.slots[0]={piece,ownerId:a,familyId:null,barrelId:null};
  s=war(s);
  const view=projectSpeakeasyTurn(s,a)!;
  assert.equal(view.stage,'LUCIANO');assert.equal(view.actorId,null);assert.deepEqual(view.self.drawDecks,[]);
  for(const mob of s.luciano!.deck) assert.ok(!JSON.stringify(view).includes(mob.tileId));
  s=value(advanceSpeakeasyMobWar(s,guard(s)));
  assert.equal(s.luciano!.phase,'DEFENSE');
  assert.equal(projectSpeakeasyTurn(s,a)!.actorId,a);
});

test('Final scoring projection clears acting identity and per-turn prompts',()=>{
  let s=setup();
  for(let act=1;act<=4;act++) {
    s=finishAct(s);
    if(act<4) {s=finishWar(war(s));s=value(beginSpeakeasyNextAct(s,guard(s)));}
  }
  const view=projectSpeakeasyTurn(s,a)!;
  assert.equal(view.stage,'FINAL_SCORING');assert.equal(view.actorId,null);assert.equal(view.active,null);
  assert.deepEqual(view.self.drawDecks,[]);assert.equal(view.self.returnCount,0);
  assert.ok(!JSON.stringify(view).includes('mobster-'));
});

import {projectSpeakeasyBoard} from './games/speakeasy/application/board-projector.js';
import {SpeakeasyBoardViewSchema} from '@hangul-rummikub/shared';
test('Board snapshots validate for 2/3/4 players and keep personal boards scoped to the recipient',()=>{
  for(const count of [2,3,4]) {
    const s=setup(count);
    for(const p of s.round.economy.players) {
      const view=projectSpeakeasyBoard(s,p.playerId)!;
      assert.deepEqual(parse(SpeakeasyBoardViewSchema,JSON.parse(JSON.stringify(view))),view);
      assert.deepEqual(view.self.levels,p.levels);assert.deepEqual(view.self.reserves,p.reserves);
      assert.deepEqual(view.self.operations,p.operations);assert.equal(view.turn.viewerId,p.playerId);
      assert.equal(view.result,null);assert.equal(view.luciano,null);assert.equal(view.districts.length,16);
      for(const other of s.round.economy.players.filter(q=>q.playerId!==p.playerId)) {
        const wire=JSON.stringify(view);
        for(const id of [...other.hand.map(c=>c.tileId),...other.reserves.map(c=>c.tileId),...other.operations.map(c=>c.tileId)]) assert.ok(!wire.includes(id));
      }
    }
  }
  assert.equal(projectSpeakeasyBoard(setup(),parse(PlayerIdSchema,'outsider')),null);
});
test('Board projection retains exact empty and mobster slots and recalculates police protection',()=>{
  const s=setup(),e=s.round.economy,p=e.players[0]!,d=e.districts[0]!;
  const piece=p.reserves.shift()!,barrel=e.barrelSupply.pop()!;
  d.slots=[null,{piece,ownerId:a,familyId:null,barrelId:barrel},null];d.cop=true;d.mobsterSlots=[2];d.mobsterStrength=4;
  e.districts[15]!.blocked=true;
  const before=projectSpeakeasyBoard(s,b)!;
  assert.equal(before.districts[0]!.slots.length,3);assert.equal(before.districts[0]!.slots[0],null);
  assert.equal(before.districts[0]!.slots[1]!.tileId,piece.tileId);
  assert.equal(before.districts[0]!.slots[1]!.operating,false);assert.equal(before.districts[0]!.slots[1]!.barrel,true);
  assert.deepEqual(before.districts[0]!.mobsterSlots,[2]);assert.equal(before.districts[0]!.mobsterStrength,4);
  assert.equal(before.districts[15]!.blocked,true);
  d.slots[1]!.familyId=p.vip.pop()!;
  const after=projectSpeakeasyBoard(s,b)!;
  assert.equal(after.districts[0]!.slots[1]!.operating,true);assert.equal(after.districts[0]!.slots[1]!.protected,true);
  assert.equal(after.districts[0]!.slots[1]!.barrel,true);
  assert.ok(!JSON.stringify(after).includes(barrel));
});
test('Map trucks disclose position and load but not cargo identities; docks and books keep board coordinates',()=>{
  const s=setup(),e=s.round.economy,p=e.players[0]!;
  p.trucks[0]!.district=3;p.trucks[0]!.barrels.push(e.barrelSupply.pop()!,e.barrelSupply.pop()!);
  e.docks.push({ownerId:a,familyId:p.vip.pop()!,zone:1,space:4});
  p.books--;e.placedBooks.push({ownerId:a,goalId:'test-goal',space:1});
  const view=projectSpeakeasyBoard(s,b)!;
  assert.deepEqual(view.trucks,[{tileId:p.trucks[0]!.tileId,ownerId:a,district:3,load:2}]);
  for(const id of p.trucks[0]!.barrels) assert.ok(!JSON.stringify(view).includes(id));
  assert.deepEqual(view.docks,[{ownerId:a,zone:1,space:4}]);
  assert.deepEqual(view.placedBooks,[{ownerId:a,goalId:'test-goal',space:1}]);
  assert.deepEqual(projectSpeakeasyBoard(s,a)!.self.trucks,p.trucks);
});
test('Opponent private economy and unrevealed supplies cannot change the board snapshot',()=>{
  const s=cityGame(),p=s.round.economy.players[1]!;
  p.helpers.push({tileId:tile('secret-helper'),bottle:'private-bottle',value:5,used:false});
  const before=projectSpeakeasyBoard(s,a),changed=structuredClone(s),other=changed.round.economy.players[1]!;
  other.cash=999;other.safe=888;other.levels.VIP=5;other.leverageTokens=10;
  other.hand.reverse();other.operations[0]!.leverage=9;other.helpers[0]!.bottle='different-bottle';
  other.reserves.reverse();other.stock.push(changed.round.economy.barrelSupply.pop()!);
  changed.round.decks.PARTY.reverse();changed.city.supply[0]![0]!.effectId='hidden-other-effect';
  assert.deepEqual(projectSpeakeasyBoard(changed,a),before);
  assert.ok(!JSON.stringify(before).includes('secret-helper'));
});
test('Board snapshot is detached, restoration-stable, and rejects corrupted canonical state',()=>{
  const s=cityGame(),before=structuredClone(s),view=projectSpeakeasyBoard(s,a)!;
  assert.deepEqual(projectSpeakeasyBoard(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),a),view);
  view.self.levels.VIP=5;view.self.reserves.pop();view.self.trucks[0]!.barrels.push(tile('local-only'));
  view.districts[0]!.slots.pop();view.turn.self.hand.pop();
  assert.deepEqual(s,before);
  const bad=structuredClone(s);bad.round.economy.districts[0]!.slots[0]={piece:bad.round.economy.players[0]!.reserves[0]!,ownerId:a,familyId:null,barrelId:null};
  assert.throws(()=>projectSpeakeasyBoard(bad,a));
});
test('Luciano board snapshot uses the same revision and revealed state without exposing remaining mobs',()=>{
  let s=finishAct(setup());const piece=s.round.economy.players[0]!.reserves.shift()!;
  s.round.economy.districts[0]!.slots[0]={piece,ownerId:a,familyId:null,barrelId:null};
  s=war(s);s=value(advanceSpeakeasyMobWar(s,guard(s)));
  const view=projectSpeakeasyBoard(s,b)!;
  assert.equal(view.luciano!.phase,'DEFENSE');assert.equal(view.turn.actorId,a);
  assert.equal(view.luciano!.revision,view.turn.revision);assert.equal(view.luciano!.self.playerId,b);
  assert.equal(view.luciano!.districts[0]!.buildings[0]!.tileId,view.districts[0]!.slots[0]!.tileId);
  const changed=structuredClone(s);changed.luciano!.deck[0]!.strength++;
  assert.deepEqual(projectSpeakeasyBoard(changed,b),view);
  assert.ok(!JSON.stringify(view).includes(changed.luciano!.deck[0]!.tileId));
});
test('Final results appear only after final settlement and preserve joint winners without revealing hands',()=>{
  let s=setup();
  for(let act=1;act<=4;act++) {
    assert.equal(projectSpeakeasyBoard(s,a)!.result,null);
    s=finishAct(s);
    if(act<4) {s=finishWar(war(s));s=value(beginSpeakeasyNextAct(s,guard(s)));}
  }
  const view=projectSpeakeasyBoard(s,a)!;
  assert.equal(view.turn.stage,'FINAL_SCORING');assert.deepEqual(view.result!.winners,[a,b]);
  assert.deepEqual(view.result!.scores.map(p=>p.total),[45,45]);
  assert.ok(view.result!.scores.every(p=>p.tieBreak.length===4));
  // The fixture includes both deck-VIP-1 and deck-VIP-10: compare full encoded IDs, not prefixes.
  assert.ok(view.turn.self.hand.some(card=>card.tileId===tile('deck-VIP-10')));
  for(const card of s.round.economy.players[1]!.hand) assert.ok(!JSON.stringify(view).includes(JSON.stringify(card.tileId)));
  assert.ok(!Object.hasOwn(view.result!.scores[1]!,'safe'));
});
