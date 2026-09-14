import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, type ArkSoloCommand, type ArkActionKind } from '@hangul-rummikub/shared';
import { createArkSoloGame, applyArkSoloCommand, parseArkSoloState, projectArkSoloGame, type ArkSoloState } from '../../games/ark-nova/domain/game.js';
import { arkReputationAdvance } from '../../games/ark-nova/domain/association.js';
const playerId=v.parse(PlayerIdSchema,'association-owner'),now=v.parse(ServerTimeSchema,1000);let seq=0;
function act(s:ArkSoloState,a:ArkSoloCommand):ArkSoloState {
  const before=structuredClone(s),result=applyArkSoloCommand(s,playerId,s.revision,a,now,v.parse(TurnIdSchema,`association-${++seq}`));
  assert.ok(result.ok,JSON.stringify(a));assert.deepEqual(s,before);
  const restored=parseArkSoloState(JSON.parse(JSON.stringify(result.state)));projectArkSoloGame(restored,playerId);return restored;
}
function create() {
  let card=0;const s=createArkSoloGame({gameId:v.parse(GameIdSchema,'association-game'),playerId,difficulty:'STANDARD',now,transitionId:v.parse(TurnIdSchema,'association-initial'),random:{nextInt:max=>max-1},nextCardId:()=>`assoc-card-${++card}`});
  return act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
}
function resolve(s:ArkSoloState):ArkSoloState {
  while (s.pending?.kind==='REWARD'||s.pending?.kind==='BREAK_DISCARD'||s.pending?.kind==='EFFECT') {
    if (s.pending.kind==='BREAK_DISCARD') s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
    else if(s.pending.kind==='EFFECT') {
      const job=s.effects.active??s.effects.frames.at(-1)![0]!;
      s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
    } else {
      const r=s.rewards[0]!,kind:ArkActionKind=s.actions.find(c=>!c.upgraded&&c.kind!=='ASSOCIATION')!.kind;
      s=act(s,{kind:'REWARD',choiceId:s.pending.choiceId,rewardId:r.id,selection:r.kind==='CARD'?{kind:'CARD',cardId:null}:r.kind==='UPGRADE'?{kind:'UPGRADE',action:kind}:r.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
    }
  }
  return s;
}
function nextRound(s:ArkSoloState) {const round=s.progress.round;while(s.progress.round===round)s=resolve(act(s,{kind:'FUNDRAISE',x:0}));return s;}
function strengthFour(s:ArkSoloState) {
  for (const kind of ['CARDS','BUILD','SPONSORS'] as const) {
    if (s.actions.findIndex(a=>a.kind==='ASSOCIATION')>=3) break;
    s=resolve(act(s,{kind:'TAKE_X',action:kind}));
  }
  return s;
}

test('University hand limit applies on the first break and all workers and supplies reset',()=>{
  let s=create();s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university:'HAND_LIMIT'}});
  assert.equal(s.busyWorkers,1);assert.equal(s.taskWorkers.UNIVERSITY,1);assert.equal(s.progress.turnsCompleted,0);
  assert.equal(s.pending?.kind,'REWARD');s=resolve(s);assert.equal(s.reputation,2);assert.equal(s.progress.turnsCompleted,1);
  assert.equal(s.universitySupply.includes('HAND_LIMIT'),false);
  s=nextRound(s);assert.equal(s.hand.length,4);assert.equal(s.busyWorkers,0);assert.deepEqual(s.taskWorkers,{});
  assert.equal(s.universitySupply.includes('HAND_LIMIT'),false);assert.equal(s.universitySupply.length,2);
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university:'HAND_LIMIT'}},now,v.parse(TurnIdSchema,'duplicate-uni')).ok,false);
  assert.deepEqual(s,before);
});

test('Repeated association work requires two additional workers and third attempt is rejected',()=>{
  let s=create();s.workers=3;s.extraWorkers=2; // Available-worker boundary fixture.
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  assert.equal(s.busyWorkers,1);assert.equal(s.reputation,3);
  s=resolve(act(s,{kind:'TAKE_X',action:'BUILD'}));
  const insufficient=structuredClone(s);insufficient.workers=2;insufficient.extraWorkers=1;
  assert.equal(applyArkSoloCommand(insufficient,playerId,insufficient.revision,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}},now,v.parse(TurnIdSchema,'workers-short')).ok,false);
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  assert.equal(s.busyWorkers,3);assert.equal(s.taskWorkers.REPUTATION,3);assert.equal(s.reputation,5);assert.equal(s.upgradeCount,1);
  s.workers=4;s.extraWorkers=3;s=strengthFour(s);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}},now,v.parse(TurnIdSchema,'third-work')).ok,false);
});

test('Partner slot reward waits for a legal upgrade, and forged or stale choices do not commit',()=>{
  let s=create();s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Africa'}});
  assert.deepEqual(s.partners,['Africa']);s=strengthFour(nextRound(s));
  s=act(s,{kind:'ASSOCIATION',x:Math.max(0,3-(s.actions.findIndex(a=>a.kind==='ASSOCIATION')+1)),task:{kind:'PARTNER',continent:'Asia'}});
  assert.equal(s.pending?.kind,'REWARD');const before=structuredClone(s),r=s.rewards[0]!,choice=s.pending!.choiceId;
  for (const a of [{kind:'FUNDRAISE',x:0},{kind:'REWARD',choiceId:'old',rewardId:r.id,selection:{kind:'UPGRADE',action:'BUILD'}},{kind:'REWARD',choiceId:choice,rewardId:r.id,selection:{kind:'NONE'}}]) assert.equal(applyArkSoloCommand(s,playerId,s.revision,a,now,v.parse(TurnIdSchema,'bad-reward')).ok,false);
  assert.deepEqual(s,before);s=act(s,{kind:'REWARD',choiceId:choice,rewardId:r.id,selection:{kind:'UPGRADE',action:'BUILD'}});
  assert.equal(s.upgradeCount,1);assert.equal(s.activeAssociation,false);assert.equal(s.actions[0]!.kind,'ASSOCIATION');
  const view=projectArkSoloGame(s,playerId);view.partners.push('Europe');assert.equal(s.partners.length,2);
});

test('Three universities grant research, upgrade and conservation; goal scoring completes after 27 turns',()=>{
  let s=create();
  const goalIndex=s.goalDeck.findIndex(c=>c.key==='003');
  [s.goals[0],s.goalDeck[goalIndex]]=[s.goalDeck[goalIndex]!,s.goals[0]!];
  for (const university of ['RESEARCH_2','HAND_LIMIT','RESEARCH_REPUTATION'] as const) {
    s=strengthFour(s);s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university}}));
    if (university!=='RESEARCH_REPUTATION') s=nextRound(s);
  }
  assert.equal(s.universities.length,3);assert.equal(s.associationConservation,2);assert.equal(s.workers,2);assert.equal(s.upgradeCount,1);
  while (s.progress.stage!=='FINAL_SCORING') s=resolve(act(s,{kind:'FUNDRAISE',x:0}));
  s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[1]!.cardId});
  assert.equal(s.phase,'FINISHED');assert.equal(s.progress.turnsCompleted,27);assert.equal(s.result!.conservation,3);assert.equal(s.result!.goalPoints,1);
});

test('Reputation honors Cards I cap, Cards II rewards and overflow, with no repeated milestone rewards',()=>{
  const s=create();let result=arkReputationAdvance(8,4,s.actions,'cap');assert.equal(result.reputation,9);assert.equal(result.appeal,0);assert.deepEqual(result.rewards,[]);
  const cards=s.actions.find(c=>c.kind==='CARDS')!;cards.upgraded=true;
  result=arkReputationAdvance(9,6,s.actions,'upper');assert.equal(result.reputation,15);
  assert.deepEqual(result.rewards.map(r=>[r.kind,r.amount]),[['CARD',1],['CONSERVATION',1],['X',1],['CARD',2],['CONSERVATION',1],['X',1]]);
  result=arkReputationAdvance(15,2,s.actions,'overflow');assert.equal(result.appeal,2);assert.deepEqual(result.rewards,[]);
});

test('Two-card reputation reward keeps the action open until both selections and conservation resolve',()=>{
  let s=create();s.reputation=12;s.reputationGained=11;
  s.actions.find(a=>a.kind==='CARDS')!.upgraded=true;s.upgradeCount=1;
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}});
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'NONE'}});
  const reward=s.rewards.find(r=>r.kind==='CARD')!,hand=s.hand.length,choiceId=s.pending!.choiceId;
  s=act(s,{kind:'REWARD',choiceId,rewardId:reward.id,selection:{kind:'CARD',cardId:null}});
  assert.equal(s.hand.length,hand+1);assert.equal(s.progress.turnsCompleted,0);assert.equal(s.rewards.find(r=>r.id===reward.id)!.amount,1);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'REWARD',choiceId,rewardId:reward.id,selection:{kind:'CARD',cardId:null}},now,v.parse(TurnIdSchema,'stale-second-card')).ok,false);
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:reward.id,selection:{kind:'CARD',cardId:null}});
  assert.equal(s.hand.length,hand+2);assert.equal(s.activeAssociation,true);
  s=resolve(s);assert.equal(s.progress.turnsCompleted,1);assert.equal(s.conservation,1);assert.equal(s.activeAssociation,false);
  const corrupt=structuredClone(s);corrupt.activeAssociation=true;assert.throws(()=>parseArkSoloState(corrupt));
});
