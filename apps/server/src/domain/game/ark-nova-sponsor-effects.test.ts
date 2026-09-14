import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_CARDS, ARK_MAP_A, ARK_UNIQUE_BUILDINGS, arkInitialBuildings, arkUniqueShape, arkCellKey, type ArkCard } from '@hangul-rummikub/shared';
import { arkSponsorImmediate, arkSponsorIconTriggers, arkSponsorIncome, type ArkSponsorContext } from '../../games/ark-nova/domain/sponsor-effects.js';
import { validateArkUniqueConstruction } from '../../games/ark-nova/domain/unique-construction.js';
const card=(key:string):ArkCard=>({key,cardId:`card-${key}`});
const context=(keys:string[]):ArkSponsorContext=>({played:keys.map(card),partners:[],universities:[],buildings:arkInitialBuildings(),supportedProjects:0});
test('Sponsor research effects count themselves, repeat for double icons and award printed immediate resources',()=>{
  const s=context(['202','204','208','223']);
  const effects=arkSponsorIconTriggers(s,{Science:2},{Science:3});
  assert.deepEqual(effects.map(e=>e.effect),[{kind:'GAIN',resource:'REPUTATION',amount:2},{kind:'GAIN',resource:'CONSERVATION',amount:2},{kind:'GAIN',resource:'MONEY',amount:4}]);
  assert.deepEqual(arkSponsorImmediate('220',context(['220'])),[{kind:'GAIN',resource:'MONEY',amount:3}]);
  assert.deepEqual(arkSponsorImmediate('204',context(['204','223'])),[{kind:'GAIN',resource:'MONEY',amount:6}]);
});
test('Diversity rewards count novel kinds once and Africa moves wait until after finishing',()=>{
  const s=context(['214','262']);
  const effects=arkSponsorIconTriggers(s,{Africa:2,Primate:2,Bear:1},{Africa:1});
  assert.equal(effects.filter(e=>e.sourceId==='card-214').length,2);
  assert.ok(effects.filter(e=>e.sourceId==='card-214').every(e=>e.timing==='AFTER_FINISHING'));
  assert.deepEqual(effects.filter(e=>e.sourceId==='card-262').map(e=>e.effect),[{kind:'GAIN',resource:'APPEAL',amount:2},{kind:'GAIN',resource:'MONEY',amount:4}]);
});
test('Break income uses current category counts and returns card choices before the break can finish',()=>{
  const s=context(['201','206','209','220','231','236','464','465']);
  const effects=arkSponsorIncome(s).map(e=>e.effect);
  assert.deepEqual(effects,[{kind:'CARD_PICK',amount:1},{kind:'GAIN',resource:'CONSERVATION',amount:1},{kind:'GAIN',resource:'X',amount:1},{kind:'GAIN',resource:'MONEY',amount:3},{kind:'GAIN',resource:'MONEY',amount:6}]);
});
test('All fifteen printed unique outlines rotate without losing hexes; reflections are not accepted',()=>{
  const sizes=[3,4,4,4,4,4,3,4,4,4,4,3,2,2,2];
  assert.equal(Object.keys(ARK_UNIQUE_BUILDINGS).length,15);
  for(let i=0;i<15;i++)for(let rotation=0;rotation<6;rotation++) {
    const shape=arkUniqueShape(String(243+i),{q:0,r:0},rotation);
    assert.equal(shape.length,sizes[i]);assert.equal(new Set(shape.map(arkCellKey)).size,shape.length);
  }
  const c=ARK_CARDS.find(c=>c.key==='255')!;
  assert.equal(validateArkUniqueConstruction(arkInitialBuildings(),c,true,false,{anchor:{q:0,r:0},rotation:0,reflected:true}).ok,false);
});
test('Unique construction validates adjacency, terrain, border conditions and occupied cells atomically',()=>{
  const buildings=arkInitialBuildings(),before=structuredClone(buildings),c=ARK_CARDS.find(c=>c.key==='255')!;
  const inputs=ARK_MAP_A.flatMap(({q,r})=>[0,1,2,3,4,5].map(rotation=>({anchor:{q,r},rotation})));
  const input=inputs.find(input=>validateArkUniqueConstruction(buildings,c,true,false,input).ok);assert.ok(input);
  const result=validateArkUniqueConstruction(buildings,c,true,false,input);assert.ok(result.ok);
  assert.deepEqual(buildings,before);assert.equal(result.building.cells.length,2);
  assert.equal(validateArkUniqueConstruction([...buildings,{...result.building,id:'placed'}],c,true,false,input).ok,false);
  const entry=ARK_CARDS.find(c=>c.key==='257')!;
  const entryInput=inputs.find(input=>validateArkUniqueConstruction([],entry,true,false,input).ok);assert.ok(entryInput);
  assert.equal(validateArkUniqueConstruction([],c,true,false,entryInput).ok,false);
});
test('Native Farm Animals counts only adjacent uncovered land at the border, excluding rock and water per the official FAQ',()=>{
  // Initial map A buildings touch three uncovered border hexes: one land, one rock and one water.
  assert.deepEqual(arkSponsorImmediate('260',context(['260'])),[{kind:'GAIN',resource:'APPEAL',amount:1}]);
});
