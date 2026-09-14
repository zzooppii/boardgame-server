import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, arkInitialBuildings } from '@hangul-rummikub/shared';
import { calculateArkSoloFinalScore } from '../../games/ark-nova/domain/final-scoring.js';
import { createArkSoloSetup } from '../../games/ark-nova/domain/solo-setup.js';
import { beginArkResistance, resolveArkResistance, takeArkReserveProject, ArkGoalRevealSchema } from '../../games/ark-nova/domain/reserve-card-choices.js';
import { assertArkExtendedCardInventory, type ArkExtendedInventory } from '../../games/ark-nova/domain/card-inventory.js';
import { createArkEffectQueue, enqueueArkEffects, selectArkEffect } from '../../games/ark-nova/domain/effect-queue.js';
import { resolveArkEffect, type ArkEffectState } from '../../games/ark-nova/domain/resolve-effect.js';
function setup():ArkExtendedInventory & ArkEffectState {
  let n=0;const s=createArkSoloSetup({gameId:v.parse(GameIdSchema,'game'),playerId:v.parse(PlayerIdSchema,'owner'),difficulty:'STANDARD',random:{nextInt:upper=>upper-1},nextCardId:()=>`instance-${++n}`});
  return {...s,played:[],pouched:{},playedProjects:[],cardReveal:null,goalReveal:null,effects:createArkEffectQueue(),sponsorTokens:{},supportedProjects:0,wazaFocus:null,conservationBonuses:[],partners:[],universities:[],partnerSupply:[],universitySupply:[]};
}
test('Resistance replaces solo goal 009, keeps one additional goal, preserves all cards through save/restore and rejects replay',()=>{
  let s=setup();const index=s.goalDeck.findIndex(c=>c.key==='009');s.goalDeck.unshift(...s.goalDeck.splice(index,1));
  const before=structuredClone(s),started=beginArkResistance(s,'resistance-choice');assert.ok(started.ok);s=started.state;
  assert.deepEqual(before.goals,s.goals);assert.equal(s.goalReveal?.candidates.length,2);assert.equal(s.discardedGoals[0]?.key,'009');assertArkExtendedCardInventory(s);
  assert.equal(beginArkResistance(s,'repeat').ok,false);s=JSON.parse(JSON.stringify(s));
  const held=s.goals[0]!.cardId;assert.equal(resolveArkResistance(s,{choiceId:'resistance-choice',keep:held}).ok,false);
  assert.equal(resolveArkResistance(s,{choiceId:'stale',keep:s.goalReveal!.candidates[0]!.cardId}).ok,false);
  const kept=s.goalReveal!.candidates[1]!,done=resolveArkResistance(s,{choiceId:'resistance-choice',keep:kept.cardId});assert.ok(done.ok);
  assert.equal(done.state.goals.length,3);assert.deepEqual(done.state.goals.at(-1),kept);assert.equal(done.state.goalReveal,null);assertArkExtendedCardInventory(done.state);
  assert.equal(resolveArkResistance(done.state,{choiceId:'resistance-choice',keep:kept.cardId}).ok,false);assert.deepEqual(before.goalReveal,null);
  assert.equal(v.safeParse(ArkGoalRevealSchema,{choiceId:'x',candidates:[kept,kept]}).success,false);
});
test('Assertion can acquire a reserve base card; Dominance only permits Primates and never duplicates a card already in play',()=>{
  const s=setup(),primate=s.baseProjectReserve.find(c=>c.key==='108')!,other=s.baseProjectReserve.find(c=>c.key!=='108')!;
  assert.equal(takeArkReserveProject(s,'DOMINANCE',{cardId:other.cardId}).ok,false);
  const acquired=takeArkReserveProject(s,'DOMINANCE',{cardId:primate.cardId});assert.ok(acquired.ok);assertArkExtendedCardInventory(acquired.state);
  assert.equal(takeArkReserveProject(acquired.state,'DOMINANCE',{cardId:primate.cardId}).ok,false);
  assert.equal(takeArkReserveProject(s,'ASSERTION',{cardId:s.baseProjects[0]!.cardId}).ok,false);
  const chosen=takeArkReserveProject(acquired.state,'ASSERTION',{cardId:other.cardId});assert.ok(chosen.ok);assertArkExtendedCardInventory(chosen.state);
  const moved=chosen.state.hand.splice(chosen.state.hand.findIndex(c=>c.cardId===other.cardId),1);chosen.state.discarded.push(...moved);assertArkExtendedCardInventory(chosen.state);
  chosen.state.hand.push(primate);assert.throws(()=>assertArkExtendedCardInventory(chosen.state));
  assert.equal(takeArkReserveProject(s,'ASSERTION',{cardId:null}).ok,true);
});
test('Resistance remains active until its private choice; crossing conservation 10 later discards only one of three goals',()=>{
  let s=setup();s.effects=enqueueArkEffects(s.effects,[{sourceId:'elephant',effect:{kind:'RESISTANCE'},timing:'IMMEDIATE'}]);
  let selected=selectArkEffect(s.effects,1);assert.ok(selected.ok);s.effects=selected.queue;
  let result=resolveArkEffect(s,1,{kind:'NONE'},'choose-goal',{nextInt:()=>0});assert.ok(result.ok);s=result.state;assert.equal(result.waiting,true);assertArkExtendedCardInventory(s);
  result=resolveArkEffect(s,1,{kind:'KEEP_GOAL',choiceId:'choose-goal',keep:s.goalReveal!.candidates[0]!.cardId},'next',{nextInt:()=>0});assert.ok(result.ok);s=result.state;assert.equal(s.goals.length,3);assert.equal(s.effects.active,null);
  s.conservation=9;s.effects=enqueueArkEffects(s.effects,[{sourceId:'project',effect:{kind:'GAIN',resource:'CONSERVATION',amount:1},timing:'IMMEDIATE'}]);
  selected=selectArkEffect(s.effects,2);assert.ok(selected.ok);s.effects=selected.queue;
  result=resolveArkEffect(s,2,{kind:'NONE'},'cp10',{nextInt:()=>0});assert.ok(result.ok);s=result.state;
  selected=selectArkEffect(s.effects,3);assert.ok(selected.ok);s.effects=selected.queue;
  result=resolveArkEffect(s,3,{kind:'GOAL',discard:s.goals[0]!.cardId},'discard-goal',{nextInt:()=>0});assert.ok(result.ok);assert.equal(result.state.goals.length,2);assertArkExtendedCardInventory(result.state);
  const final=calculateArkSoloFinalScore({...result.state,buildings:arkInitialBuildings(),universityResearch:0,supportedProjects:0});
  assert.deepEqual(final.details.map(d=>d.cardId),result.state.goals.map(c=>c.cardId));
});
