import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_MAP_A, arkInitialBuildings } from '@hangul-rummikub/shared';
import { validateArkConstruction, type ConstructionContext } from '../../games/ark-nova/domain/construction.js';

const context=():ConstructionContext=>({buildings:arkInitialBuildings(),money:40,remainingStrength:5,upgraded:false,builtKinds:[]});
const input={building:'ENCLOSURE_2',anchor:{q:0,r:2},rotation:0,reflected:false};
test('Diversity Researcher permits terrain coverage only through the server context and retains occupancy and cost rules',()=>{
 for(const anchor of [{q:2,r:4},{q:1,r:5}]) {
  const choice={building:'PAVILION',anchor,rotation:0,reflected:false},c=context();
  assert.equal(validateArkConstruction(c,choice).ok,false);
  assert.equal(validateArkConstruction(c,{...choice,ignoreTerrain:true}).ok,false);
  const allowed=validateArkConstruction({...c,ignoreTerrain:true},choice);assert.ok(allowed.ok);assert.equal(allowed.cost,2);
  assert.equal(validateArkConstruction({...c,ignoreTerrain:true,money:1},choice).ok,false);
  assert.equal(validateArkConstruction({...c,ignoreTerrain:true,buildings:[...c.buildings,{...allowed.building,id:'placed'}]},choice).ok,false);
 }
});
test('Engineer repeats an already built standard enclosure without strength but pays its full cost',()=>{
 const c:ConstructionContext={...context(),builtKinds:['ENCLOSURE_2'],remainingStrength:0,engineerAvailable:true};
 const choice=ARK_MAP_A.map(({q,r})=>({...input,anchor:{q,r}})).find(a=>validateArkConstruction(c,a).ok);assert.ok(choice);
 const result=validateArkConstruction(c,choice);assert.ok(result.ok);
 assert.equal(result.cost,4);assert.equal(result.strengthCost,0);assert.equal(result.engineer,true);
 assert.equal(validateArkConstruction({...c,engineerAvailable:false},choice).ok,false);
 assert.equal(validateArkConstruction({...c,money:3},choice).ok,false);
 assert.equal(validateArkConstruction({...c,builtKinds:['PAVILION']},choice).ok,false);
});
test('Engineer never duplicates a special enclosure or waives normal placement rules',()=>{
 for(const building of ['PettingZoo','ReptileHouse','LargeBirdAviary']) {
   const c={...context(),upgraded:true,builtKinds:[building],remainingStrength:10,engineerAvailable:true};
   assert.equal(validateArkConstruction(c,{...input,building}).ok,false);
 }
 const c={...context(),builtKinds:['ENCLOSURE_2'],remainingStrength:0,engineerAvailable:true};
 assert.equal(validateArkConstruction(c,{...input,anchor:{q:999,r:999}}).ok,false);
});
test('Ark server derives geometry and cost, without mutating canonical inputs',()=>{
 const c=context(),before=structuredClone(c);
 const choice=ARK_MAP_A.map(({q,r})=>({...input,anchor:{q,r}})).find(a=>validateArkConstruction(c,a).ok);
 assert.ok(choice);
 const result=validateArkConstruction(c,choice);assert.ok(result.ok);
 assert.equal(result.cost,4);assert.equal(result.building.cells.length,2);assert.deepEqual(c,before);
 assert.equal(validateArkConstruction(c,{...choice,cost:0}).ok,false);
 assert.equal(validateArkConstruction(c,{...choice,cells:[]}).ok,false);
});
test('Ark server rejects malformed rotations, insufficient resources and invalid action scope',()=>{
 const c=context();
 for(const building of ['__proto__','constructor','invented'])assert.equal(validateArkConstruction(c,{...input,building}).ok,false);
 for(const rotation of [-1,6,1.5,NaN,'0'])assert.equal(validateArkConstruction(c,{...input,rotation}).ok,false);
 assert.equal(validateArkConstruction({...c,money:3},input).ok,false);
 assert.equal(validateArkConstruction({...c,remainingStrength:1},input).ok,false);
 assert.equal(validateArkConstruction({...c,builtKinds:['ENCLOSURE_1']},input).ok,false);
 assert.equal(validateArkConstruction({...c,upgraded:true,builtKinds:['ENCLOSURE_2']},input).ok,false);
 assert.equal(validateArkConstruction(c,{...input,building:'LargeBirdAviary'}).ok,false);
 assert.equal(validateArkConstruction(c,{...input,anchor:{q:100,r:100}}).ok,false);
});
