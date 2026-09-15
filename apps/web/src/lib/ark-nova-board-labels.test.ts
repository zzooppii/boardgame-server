import test from 'node:test';
import assert from 'node:assert/strict';
import {arkBuildingOutline,arkBuildingName,arkBuildingLabel,arkMapBonusLabels} from '../features/ark-nova/board-labels.js';
test('Facility border removes shared edges instead of drawing separate hexagons',()=>{
  assert.equal((arkBuildingOutline([{q:0,r:0}]).match(/L/g)??[]).length,6);
  assert.equal((arkBuildingOutline([{q:0,r:0},{q:1,r:0}]).match(/L/g)??[]).length,10);
});
test('Empty enclosure size and bonus rewards are explicit',()=>{
  assert.equal(arkBuildingLabel({id:'a',kind:'ENCLOSURE_2',cells:[{q:0,r:0},{q:1,r:0}],occupied:false,used:0}),'2칸 우리 · 2칸 · 비어 있음');
  assert.equal(arkMapBonusLabels.MONEY_5,'돈 +5');
});

test('A connected enclosure is a closed silhouette without internal seams',()=>{
  const cells=[{q:0,r:0},{q:1,r:0},{q:0,r:1}];
  const outline=arkBuildingOutline(cells);
  assert.equal((outline.match(/M/g)??[]).length,1);
  assert.equal((outline.match(/Z/g)??[]).length,1);
  assert.equal((outline.match(/L/g)??[]).length,12);
  assert.equal(arkBuildingOutline([]),'');
});

test('Unique facility labels resolve the printed sponsor instead of a generic facility',()=>{
 const b={id:'playground',kind:'UNIQUE_255',cells:[{q:0,r:0},{q:1,r:0}],occupied:false,used:0};
 assert.equal(arkBuildingName(b),'모험 놀이터');assert.equal(arkBuildingLabel(b),'모험 놀이터 · 2칸');
 assert.equal(arkBuildingName({...b,kind:'UNIQUE_unknown'}),'특수 건물');
});
