import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_ACTIONS, ARK_MAP_A, ArkPlacementSchema, arkInitialBuildings, arkShape, arkPlacementReason, type ArkBuilding } from '@hangul-rummikub/shared';
import * as v from 'valibot';
import { createArkEffectQueue, enqueueArkEffects, selectArkEffect } from '../../games/ark-nova/domain/effect-queue.js';
import { resolveArkEffect, type ArkEffectState } from '../../games/ark-nova/domain/resolve-effect.js';
import type { ArkZooEffect } from '../../games/ark-nova/domain/animal-effects.js';
import { arkNewBuildingEffects, arkUncoveredPlacementBonuses } from '../../games/ark-nova/domain/construction-effects.js';
function state(effect:ArkZooEffect):ArkEffectState {
  const effects=enqueueArkEffects(createArkEffectQueue(),[{sourceId:'source',effect,timing:'IMMEDIATE'}]),selected=selectArkEffect(effects,1);assert.ok(selected.ok);
  return {effects:selected.queue,buildings:arkInitialBuildings(),played:[],pouched:{},sponsorTokens:{},supportedProjects:0,cardReveal:null,goalDeck:[],goalReveal:null,baseProjectReserve:[],
    zooDeck:[],hand:[],discarded:[],display:Array.from({length:6},()=>null),actions:ARK_ACTIONS.map(kind=>({kind,upgraded:false,venom:false,constriction:false,multiplier:0})),partners:[],universities:[],partnerSupply:[],universitySupply:[],
    goals:[],discardedGoals:[],money:0,appeal:20,conservation:0,reputation:1,x:0,workers:1,wazaFocus:null,conservationBonuses:[]};
}
function placement(buildings:ArkBuilding[],kind:string):v.InferOutput<typeof ArkPlacementSchema> {
  for(const anchor of ARK_MAP_A)for(const rotation of [0,1,2,3,4,5])for(const reflected of [false,true]) {
    if(arkPlacementReason(buildings,kind,arkShape(kind,anchor,rotation,reflected),false)===null)return v.parse(ArkPlacementSchema,{building:kind,anchor:{q:anchor.q,r:anchor.r},rotation,reflected});
  }
  throw new Error('No test placement.');
}
const random={nextInt:()=>0};
test('WAZA extra animal is optional, hand-only and limited to small animals',()=>{
  const s=state({kind:'WAZA_PLAY',upgraded:true});s.hand=[{key:'401',cardId:'large'}];s.display[5]={key:'404',cardId:'small-market'};
  for(const cardId of ['large','small-market'])assert.equal(resolveArkEffect(s,1,{kind:'ANIMAL',card:{cardId,housingId:'initial-enclosure'}},'invalid-waza',random).ok,false);
  const result=resolveArkEffect(s,1,{kind:'SKIP'},'skip-extra',random);assert.ok(result.ok);
  assert.deepEqual(result.state.effects.frames.flat().map(j=>j.effect),[{kind:'WAZA_SNAP'}]);
  assert.deepEqual(result.state.hand,s.hand);assert.deepEqual(result.state.display,s.display);
});
test('WAZA market choice must take an available small animal and preserves holes until the outer turn finishes',()=>{
  const s=state({kind:'WAZA_SNAP'});s.display[0]={key:'401',cardId:'large'};s.display[5]={key:'528',cardId:'pet'};
  for(const choice of [{kind:'NONE'},{kind:'CARD',cardId:'large'},{kind:'CARD',cardId:'pet',refill:true}])assert.equal(resolveArkEffect(s,1,choice,'bad-snap',random).ok,false);
  const result=resolveArkEffect(s,1,{kind:'CARD',cardId:'pet'},'waza-pet',random);assert.ok(result.ok);
  assert.equal(result.state.hand[0]!.cardId,'pet');assert.equal(result.state.display[5],null);assert.equal(result.state.reputation,1);
  assert.ok(resolveArkEffect(state({kind:'WAZA_SNAP'}),1,{kind:'NONE'},'no-small-animal',random).ok);
});
test('Archaeologist is triggered by each covered border bonus, including free construction',()=>{
  const s=state({kind:'FREE_BUILD',buildings:['ENCLOSURE_2'],amount:1,ignoreBuildUpgrade:false});s.played=[{key:'221',cardId:'archaeologist'}];
  const result=resolveArkEffect(s,1,{kind:'BUILD',placement:{building:'ENCLOSURE_2',anchor:{q:0,r:1},rotation:1,reflected:false}},'arch-build',random);assert.ok(result.ok);
  assert.equal(result.state.effects.frames.flat().filter(j=>j.effect.kind==='ARCHAEOLOGIST').length,1);
  const building:ArkBuilding={id:'two-bonuses',kind:'ENCLOSURE_2',cells:[{q:0,r:0},{q:0,r:1}],used:0,occupied:false};
  assert.equal(arkNewBuildingEffects([],building,s.played).filter(e=>e.kind==='ARCHAEOLOGIST').length,2);
  assert.equal(arkNewBuildingEffects([],building).filter(e=>e.kind==='ARCHAEOLOGIST').length,0);
});
test('Archaeologist selects an uncovered bonus without covering it or recursively triggering itself',()=>{
  const s=state({kind:'ARCHAEOLOGIST'}),cell=arkUncoveredPlacementBonuses(s.buildings).find(c=>c.q===0&&c.r===1)!;assert.ok(cell);
  const before=structuredClone(s),result=resolveArkEffect(s,1,{kind:'MAP_BONUS',cell:{q:cell.q,r:cell.r}},'chosen',random);assert.ok(result.ok);assert.deepEqual(s,before);
  assert.deepEqual(result.state.buildings,s.buildings);
  assert.deepEqual(result.state.effects.frames.flat().map(j=>j.effect),[{kind:'GAIN',resource:'X',amount:1}]);
  assert.ok(arkUncoveredPlacementBonuses(result.state.buildings).some(c=>c.q===cell.q&&c.r===cell.r));
  assert.equal(resolveArkEffect(s,1,{kind:'NONE'},'skip',random).ok,false);
  assert.equal(resolveArkEffect(s,1,{kind:'MAP_BONUS',cell:{q:999,r:999}},'bad',random).ok,false);
  const covered=structuredClone(s);covered.buildings.push({id:'covered',kind:'PAVILION',cells:[{q:cell.q,r:cell.r}],occupied:false,used:0});
  assert.equal(resolveArkEffect(covered,1,{kind:'MAP_BONUS',cell:{q:cell.q,r:cell.r}},'covered',random).ok,false);
});
test('Hydrologist and Geologist pay once per newly covered space, even when it touches multiple matching terrain spaces',()=>{
  const water:ArkBuilding={id:'water-edge',kind:'ENCLOSURE_2',cells:[{q:7,r:-3},{q:8,r:-2}],occupied:false,used:0};
  const rock:ArkBuilding={id:'rock-edge',kind:'PAVILION',cells:[{q:3,r:-1}],occupied:false,used:0};
  const money=(effects:ArkZooEffect[])=>effects.filter(e=>e.kind==='GAIN'&&e.resource==='MONEY');
  const hydrologist={key:'241',cardId:'hydrologist'},geologist={key:'242',cardId:'geologist'};
  // 7,-3 touches three water spaces, but still earns only one money.
  assert.deepEqual(money(arkNewBuildingEffects([],water,[hydrologist])),[{kind:'GAIN',resource:'MONEY',amount:10},{kind:'GAIN',resource:'MONEY',amount:2}]);
  // 3,-1 touches rocks at 2,0 and 3,-2; its printed money placement bonus is separate.
  assert.deepEqual(money(arkNewBuildingEffects([],rock,[geologist])),[{kind:'GAIN',resource:'MONEY',amount:5},{kind:'GAIN',resource:'MONEY',amount:1}]);
  assert.deepEqual(money(arkNewBuildingEffects([],water)),[{kind:'GAIN',resource:'MONEY',amount:10}]);
  const coveredWater:ArkBuilding={id:'covered-water',kind:'ENCLOSURE_3',cells:[{q:7,r:-4},{q:8,r:-4},{q:8,r:-3}],occupied:false,used:0};
  assert.deepEqual(money(arkNewBuildingEffects([coveredWater],water,[hydrologist,{key:'219',cardId:'diversity'}])),[{kind:'GAIN',resource:'MONEY',amount:10}]);
});
test('Free construction costs no money, keeps the Build card in place and resolves bonuses before the next placement',()=>{
  const s=state({kind:'FREE_BUILD',buildings:['PAVILION'],amount:2,ignoreBuildUpgrade:false}),before=structuredClone(s);
  const result=resolveArkEffect(s,1,{kind:'BUILD',placement:placement(s.buildings,'PAVILION')},'build-1',random);assert.ok(result.ok);
  const next=result.state;assert.equal(next.money,0);assert.deepEqual(next.actions,s.actions);assert.equal(next.buildings.length,3);assert.deepEqual(s,before);
  const later=next.effects.frames[0]![0]!;assert.equal(later.effect.kind,'FREE_BUILD');assert.equal(selectArkEffect(next.effects,later.id).ok,false);
  while(next.effects.frames.length>1) {
    const job=next.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'GAIN');const selected=selectArkEffect(next.effects,job.id);assert.ok(selected.ok);next.effects=selected.queue;
    const resolved=resolveArkEffect(next,job.id,{kind:'NONE'},`gain-${job.id}`,random);assert.ok(resolved.ok);Object.assign(next,resolved.state);
  }
  assert.equal(next.appeal,21);assert.equal(selectArkEffect(next.effects,later.id).ok,true);
});
test('Free construction rejects ungranted buildings, occupied cells and special buildings without an explicit exception',()=>{
  const s=state({kind:'FREE_BUILD',buildings:['KIOSK'],amount:1,ignoreBuildUpgrade:false});
  assert.equal(resolveArkEffect(s,1,{kind:'BUILD',placement:placement(s.buildings,'PAVILION')},'x',random).ok,false);
  assert.equal(resolveArkEffect(s,1,{kind:'BUILD',placement:{building:'KIOSK',anchor:s.buildings[0]!.cells[0],rotation:0,reflected:false}},'x',random).ok,false);
  const aviary=state({kind:'FREE_BUILD',buildings:['LargeBirdAviary'],amount:1,ignoreBuildUpgrade:false}),where=placement(aviary.buildings,'LargeBirdAviary');
  assert.equal(resolveArkEffect(aviary,1,{kind:'BUILD',placement:where},'x',random).ok,false);
  const peacock=state({kind:'FREE_BUILD',buildings:['LargeBirdAviary'],amount:1,ignoreBuildUpgrade:true});
  const allowed=resolveArkEffect(peacock,1,{kind:'BUILD',placement:where},'x',random);assert.ok(allowed.ok);assert.ok(allowed.state.effects.frames.flat().some(j=>j.effect.kind==='MOVE_TO_SPECIAL'));
  assert.equal(allowed.state.actions.find(a=>a.kind==='BUILD')!.upgraded,false);
});
test('New special enclosure relocation empties a legal standard enclosure and cannot move the same animal twice',()=>{
  const s=state({kind:'MOVE_TO_SPECIAL',buildingId:'aviary',moved:[]});s.played=[{key:'496',cardId:'bird'}];s.buildings[1]!.occupied=true;
  const where=placement(s.buildings,'LargeBirdAviary');s.buildings.push({id:'aviary',kind:'LargeBirdAviary',cells:arkShape(where.building,where.anchor,where.rotation,where.reflected),occupied:false,used:0});
  const moved=resolveArkEffect(s,1,{kind:'MOVE_ANIMAL',cardId:'bird',housingId:'initial-enclosure'},'move',random);assert.ok(moved.ok);
  assert.equal(moved.state.buildings[1]!.occupied,false);assert.ok(moved.state.buildings.at(-1)!.used>0);
  const selected=selectArkEffect(moved.state.effects,moved.state.effects.frames.at(-1)![0]!.id);assert.ok(selected.ok);moved.state.effects=selected.queue;
  assert.equal(resolveArkEffect(moved.state,selected.queue.active!.id,{kind:'MOVE_ANIMAL',cardId:'bird',housingId:'initial-enclosure'},'again',random).ok,false);
  assert.ok(resolveArkEffect(moved.state,selected.queue.active!.id,{kind:'SKIP'},'done',random).ok);
});
test('Official erratum permits relocation without flipping when no occupied enclosure meets the animal size',()=>{
  const s=state({kind:'MOVE_TO_SPECIAL',buildingId:'aviary',moved:[]});s.played=[{key:'496',cardId:'bird'}];
  const where=placement(s.buildings,'LargeBirdAviary');s.buildings.push({id:'aviary',kind:'LargeBirdAviary',cells:arkShape(where.building,where.anchor,where.rotation,where.reflected),occupied:false,used:0});
  const moved=resolveArkEffect(s,1,{kind:'MOVE_ANIMAL',cardId:'bird',housingId:null},'move-without-flip',random);assert.ok(moved.ok);assert.ok(moved.state.buildings.at(-1)!.used>0);
  const occupied=structuredClone(s);occupied.buildings[1]!.occupied=true;
  assert.equal(resolveArkEffect(occupied,1,{kind:'MOVE_ANIMAL',cardId:'bird',housingId:null},'cannot-skip-flip',random).ok,false);
});

test('Relocation then release frees only special capacity and removes subsequent bird income without replaying rewards',async()=>{
  const {releaseArkProjectAnimal}=await import('../../games/ark-nova/domain/project-requirements.js');
  const {arkSponsorIncome}=await import('../../games/ark-nova/domain/sponsor-effects.js');
  const s=state({kind:'MOVE_TO_SPECIAL',buildingId:'aviary',moved:[]});s.appeal=37;s.played=[{key:'496',cardId:'bird'},{key:'233',cardId:'bird-sponsor'}];s.buildings[1]!.occupied=true;
  const where=placement(s.buildings,'LargeBirdAviary');s.buildings.push({id:'aviary',kind:'LargeBirdAviary',cells:arkShape(where.building,where.anchor,where.rotation,where.reflected),occupied:false,used:0});
  const moved=resolveArkEffect(s,1,{kind:'MOVE_ANIMAL',cardId:'bird',housingId:'initial-enclosure'},'move-release',random);assert.ok(moved.ok);
  assert.equal(moved.state.appeal,37);assert.deepEqual(moved.state.played,s.played);
  assert.ok(arkSponsorIncome(moved.state).some(j=>j.effect.kind==='GAIN'&&j.effect.resource==='MONEY'&&j.effect.amount===3));
  const before=structuredClone(moved.state);
  assert.equal(releaseArkProjectAnimal(moved.state,'116',1,'bird','initial-enclosure').ok,false);
  const released=releaseArkProjectAnimal(moved.state,'116',1,'bird','aviary');assert.ok(released.ok);
  assert.equal(released.appeal,33);assert.equal(released.buildings.find(b=>b.id==='aviary')!.used,0);
  assert.equal(released.buildings[1]!.occupied,false);assert.deepEqual(moved.state,before);
  assert.ok(!arkSponsorIncome({...moved.state,...released}).some(j=>j.sourceId==='bird-sponsor'));
});
