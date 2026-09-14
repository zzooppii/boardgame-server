import test from 'node:test';
import assert from 'node:assert/strict';
import {projectArkScoreBoard} from '../../games/ark-nova/domain/score-board.js';
import {createArkEffectQueue,enqueueArkEffects,selectArkEffect,completeArkEffect} from '../../games/ark-nova/domain/effect-queue.js';
import {chooseArkConservationBonus} from '../../games/ark-nova/domain/conservation-bonuses.js';
test('Score board uses scoring boundary at conservation 10/11 and both endpoints',()=>{
  for(const [appeal,conservation,target,gap] of [[0,0,114,-114],[94,10,94,0],[94,11,91,3],[113,41,1,112]]){
    const board=projectArkScoreBoard({appeal:appeal!,conservation:conservation!,conservationBonuses:[],effects:createArkEffectQueue()});
    assert.equal(board.targetAppeal,target);assert.equal(board.gap,gap);
  }
});
test('Score board includes nested waiting milestone choices, never executable jobs',()=>{
  let effects=createArkEffectQueue();
  effects=enqueueArkEffects(effects,[{sourceId:'gain',effect:{kind:'CONSERVATION_BONUS',track:5},timing:'IMMEDIATE'},
    {sourceId:'gain',effect:{kind:'CONSERVATION_BONUS',track:8},timing:'IMMEDIATE'},
    {sourceId:'gain',effect:{kind:'GAIN',resource:'MONEY',amount:1},timing:'IMMEDIATE'}]);
  const selected=selectArkEffect(effects,3);assert.ok(selected.ok);
  effects=completeArkEffect(selected.queue,3,[{sourceId:'nested',effect:{kind:'UPGRADE_OR_WORKER'},timing:'IMMEDIATE'}]);
  const board=projectArkScoreBoard({appeal:20,conservation:8,conservationBonuses:[],effects});
  assert.deepEqual(board.pendingMilestones,[2,5,8]);
  assert.deepEqual(Object.keys(board).sort(),['appealIncome','bonuses','choices','gap','pendingMilestones','targetAppeal']);
});
test('Money choice retains public tiles without inventing a claimed tile or pending choice',()=>{
  const pool=[{track:5 as const,tile:'X_3' as const}];
  const chosen=chooseArkConservationBonus(pool,5,null);assert.ok(chosen.ok);
  const board=projectArkScoreBoard({appeal:20,conservation:5,conservationBonuses:chosen.pool,effects:createArkEffectQueue()});
  assert.deepEqual(board.bonuses,pool);assert.deepEqual(board.pendingMilestones,[]);
  board.bonuses.pop();assert.equal(chosen.pool.length,1);
});
