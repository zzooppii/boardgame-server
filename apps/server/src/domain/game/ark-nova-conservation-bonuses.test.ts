import test from 'node:test';
import assert from 'node:assert/strict';
import { createArkConservationBonuses, chooseArkConservationBonus, arkConservationAdvance, ARK_BASE_BONUS_TILES } from '../../games/ark-nova/domain/conservation-bonuses.js';
test('Conservation setup chooses four distinct base tiles, two per printed track space',()=>{
  const pool=createArkConservationBonuses({nextInt:max=>max-1});assert.equal(pool.length,4);assert.equal(new Set(pool.map(t=>t.tile)).size,4);
  assert.deepEqual(pool.map(t=>t.track),[5,5,8,8]);assert.equal(ARK_BASE_BONUS_TILES.length,9);
  assert.throws(()=>createArkConservationBonuses({nextInt:max=>max}));
});
test('Conservation crossing queues every milestone once and clamps the printed end of the track',()=>{
  assert.deepEqual(arkConservationAdvance(1,10),{conservation:11,milestones:[2,5,8,10]});
  assert.deepEqual(arkConservationAdvance(8,1),{conservation:9,milestones:[]});
  assert.deepEqual(arkConservationAdvance(40,3),{conservation:41,milestones:[]});
  assert.throws(()=>arkConservationAdvance(0,-1));
});
test('Money alternative preserves available tiles, taking a tile removes exactly that tile and wrong-track selection rejects',()=>{
  const pool=createArkConservationBonuses({nextInt:max=>max-1}),before=structuredClone(pool);
  const money=chooseArkConservationBonus(pool,5,null);assert.ok(money.ok);assert.deepEqual(money.pool,pool);assert.deepEqual(money.effect,{kind:'GAIN',resource:'MONEY',amount:5});
  const taken=chooseArkConservationBonus(pool,5,pool[0]!.tile);assert.ok(taken.ok);assert.equal(taken.pool.length,3);assert.deepEqual(pool,before);
  assert.equal(chooseArkConservationBonus(taken.pool,5,pool[0]!.tile).ok,false);
  assert.equal(chooseArkConservationBonus(pool,5,pool[2]!.tile).ok,false);
});
