import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema } from '@hangul-rummikub/shared';
import { createArkSoloGame, applyArkSoloCommand } from '../../games/ark-nova/domain/game.js';
import { startArkAssociationWork, continueArkAssociationWork, donateArkAssociationWork, endArkAssociationWork } from '../../games/ark-nova/domain/association-work.js';
import { beginArkSoloBreak, resolveArkSoloBreakDiscard } from '../../games/ark-nova/domain/solo-break.js';

function board(upgraded=true) {
  let id=0;const playerId=v.parse(PlayerIdSchema,'work-owner');
  const s=createArkSoloGame({gameId:v.parse(GameIdSchema,'work-game'),playerId,difficulty:'STANDARD',now:v.parse(ServerTimeSchema,1000),transitionId:v.parse(TurnIdSchema,'work-setup'),random:{nextInt:max=>max-1},nextCardId:()=>`work-card-${++id}`});
  const chosen=applyArkSoloCommand(s,playerId,0,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)},v.parse(ServerTimeSchema,1000),v.parse(TurnIdSchema,'work-hand'));
  assert.ok(chosen.ok);const state=chosen.state;
  state.actions.find(a=>a.kind==='ASSOCIATION')!.upgraded=upgraded;
  state.workers=4;state.x=5;return state;
}

test('Association II shares strength across different tasks, spends X once and shifts only on completion',()=>{
  const initial=board(),before=structuredClone(initial);
  const first=startArkAssociationWork(initial,5,{kind:'UNIVERSITY',university:'RESEARCH_2'},'first');assert.ok(first.ok);
  assert.equal(first.work.strength,9);assert.equal(first.work.remaining,5);assert.equal(first.state.x,0);assert.equal(first.state.busyWorkers,1);
  const second=continueArkAssociationWork(first.state,first.work,{kind:'PARTNER',continent:'Africa'},'second',0);assert.ok(second.ok);
  const third=continueArkAssociationWork(second.state,second.work,{kind:'REPUTATION'},'third',0);assert.ok(third.ok);
  assert.equal(third.work.remaining,0);assert.equal(third.state.busyWorkers,3);assert.deepEqual(third.rewards.map(r=>[r.kind,r.amount]),[['REPUTATION',2]]);
  assert.deepEqual(third.state.actions,initial.actions);assert.deepEqual(initial,before);
  assert.equal(endArkAssociationWork(third.state,third.work,1).ok,false);
  const ended=endArkAssociationWork(third.state,third.work,0);assert.ok(ended.ok);assert.equal(ended.state.actions[0]!.kind,'ASSOCIATION');assert.equal(ended.state.progress.turnsCompleted,0);
});

test('Continuation rejects duplicate work, overspending, pending rewards and malformed input without mutation',()=>{
  const first=startArkAssociationWork(board(),0,{kind:'REPUTATION'},'first');assert.ok(first.ok);
  const before=structuredClone(first);
  for (const task of [{kind:'REPUTATION'},{kind:'UNIVERSITY',university:'RESEARCH_2'},{kind:'PARTNER',continent:'Africa',cost:0}]) assert.equal(continueArkAssociationWork(first.state,first.work,task,'next',0).ok,false);
  assert.equal(continueArkAssociationWork(first.state,first.work,{kind:'PARTNER',continent:'Africa'},'next',1).ok,false);
  assert.equal(continueArkAssociationWork(first.state,{...first.work,remaining:9},{kind:'PARTNER',continent:'Africa'},'next',0).ok,false);
  assert.deepEqual(first,before);
});

test('Side I stays frozen when upgraded by its reward and cannot continue or donate',()=>{
  const first=startArkAssociationWork(board(false),2,{kind:'PARTNER',continent:'Africa'},'first');assert.ok(first.ok);
  first.state.actions.find(a=>a.kind==='ASSOCIATION')!.upgraded=true;
  assert.equal(continueArkAssociationWork(first.state,first.work,{kind:'REPUTATION'},'next',0).ok,false);
  assert.equal(donateArkAssociationWork(first.state,first.work,'donation',0).ok,false);
  assert.ok(endArkAssociationWork(first.state,first.work,0).ok);
});

test('Third and fourth partner slots require side II and return worker and conservation rewards',()=>{
  for (const owned of [['Africa','Asia'],['Africa','Asia','Europe']]) {
    const s=board();s.partners=owned;s.partnerSupply=['Americas','Australia'];
    const before=structuredClone(s);
    const result=startArkAssociationWork(s,0,{kind:'PARTNER',continent:'Americas'},'slot');assert.ok(result.ok);
    assert.deepEqual(result.rewards.map(r=>[r.kind,r.amount]),owned.length===2?[['WORKER',1]]:[['CONSERVATION',2]]);
    assert.deepEqual(s,before);
    s.actions.find(a=>a.kind==='ASSOCIATION')!.upgraded=false;
    assert.equal(startArkAssociationWork(s,0,{kind:'PARTNER',continent:'Americas'},'invalid').ok,false);
  }
});

test('Donation uses the cheapest distinct slot, requires side II work, charges once and preserves staff',()=>{
  let s=board();s.donations=[0,1];
  const first=startArkAssociationWork(s,1,{kind:'REPUTATION'},'first');assert.ok(first.ok);
  assert.equal(donateArkAssociationWork(first.state,first.work,'donation',1).ok,false);
  const donated=donateArkAssociationWork(first.state,first.work,'donation',0);assert.ok(donated.ok);
  assert.equal(donated.state.money,first.state.money-5);assert.deepEqual(donated.state.donations,[0,1,2]);
  assert.equal(donated.state.busyWorkers,first.state.busyWorkers);assert.equal(donated.work.remaining,first.work.remaining);
  assert.deepEqual(donated.rewards,[{id:'donation',kind:'CONSERVATION',amount:1}]);
  assert.equal(donateArkAssociationWork(donated.state,donated.work,'again',0).ok,false);
  const poor={...first.state,money:4};assert.equal(donateArkAssociationWork(poor,first.work,'poor',0).ok,false);assert.equal(poor.money,4);
  const next=continueArkAssociationWork(donated.state,donated.work,{kind:'PARTNER',continent:'Asia'},'after-donation',0);assert.ok(next.ok);
});

test('Final donation space remains repeatable across actions and a solo break blocks the next free slot',()=>{
  const s=board();s.donations=[0,1,2,3,4,5,6];s.money=30;
  const first=startArkAssociationWork(s,0,{kind:'REPUTATION'},'first');assert.ok(first.ok);
  const donated=donateArkAssociationWork(first.state,first.work,'donation',0);assert.ok(donated.ok);assert.equal(donated.state.money,18);assert.deepEqual(donated.state.donations,s.donations);
  const ended=endArkAssociationWork(donated.state,donated.work,0);assert.ok(ended.ok);
  const second=startArkAssociationWork(ended.state,2,{kind:'PARTNER',continent:'Africa'},'second');assert.ok(second.ok);
  const twice=donateArkAssociationWork(second.state,second.work,'second-donation',0);assert.ok(twice.ok);assert.equal(twice.state.money,6);assert.deepEqual(twice.state.donations,s.donations);
  const breaking=board();breaking.donations=[0,1,2];breaking.progress={round:1,turnInRound:7,turnsCompleted:7,stage:'BREAK'};
  const started=beginArkSoloBreak(breaking);assert.ok(started.ok);assert.deepEqual(started.state.donations,[0,1,2,3]);
  const reset=resolveArkSoloBreakDiscard(started.state,{discard:[started.state.hand[0]!.cardId]});assert.ok(reset.ok);assert.equal(reset.state.busyWorkers,0);assert.deepEqual(reset.state.taskWorkers,{});
});
