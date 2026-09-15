import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { ArkSoloViewSchema, GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, type ArkSoloCommand, type PlayerId } from '@hangul-rummikub/shared';
import { createArkMultiplayerGame, applyArkMultiplayerCommand, projectArkMultiplayerGame, parseArkMultiplayerState, type ArkMultiplayerState } from '../../games/ark-nova/domain/multiplayer.js';
const now=v.parse(ServerTimeSchema,1000);let sequence=0;
const next=()=>v.parse(TurnIdSchema,`multi-turn-${++sequence}`),random={nextInt:(max:number)=>max-1};
function create(count:number){let id=0;return createArkMultiplayerGame({gameId:v.parse(GameIdSchema,'ark-multi'),playerIds:Array.from({length:count},(_,i)=>v.parse(PlayerIdSchema,`p${i}`)),now,transitionId:next(),random,nextCardId:()=>`multi-card-${++id}`});}
function act(s:ArkMultiplayerState,command:ArkSoloCommand,actor:PlayerId=s.playerId){const before=structuredClone(s);const result=applyArkMultiplayerCommand(s,actor,s.revision,command,now,next(),random);assert.ok(result.ok,JSON.stringify(result));assert.deepEqual(s,before);const restored=parseArkMultiplayerState(JSON.parse(JSON.stringify(result.state)));for(const p of restored.players)projectArkMultiplayerGame(restored,p.playerId);return restored;}
function start(count:number){let s=create(count);for(const p of [...s.players])s=act(s,{kind:'INITIAL_HAND',keep:p.hand.slice(0,4).map(c=>c.cardId)},p.playerId);return s;}
for(const count of [2,3,4])test(`${count} players: private setup, shared deck, turn ownership and repeated breaks`,()=>{
  const setup=create(count);assert.deepEqual(setup.players.map(p=>p.appeal),Array.from({length:count},(_,i)=>i));assert.equal(setup.shared.baseProjects.length,count===4?4:3);
  for(const p of setup.players){const view=projectArkMultiplayerGame(setup,p.playerId);assert.ok(view.display.every(c=>c===null));for(const other of setup.players.filter(q=>q!==p))for(const card of [...other.hand,...other.goals])assert.ok(!JSON.stringify(view).includes(JSON.stringify(card.cardId)));}
  let s=start(count);const initialDonations=[...s.shared.donations];
  assert.equal(applyArkMultiplayerCommand(s,s.players[1]!.playerId,s.revision,{kind:'FUNDRAISE',x:0},now,next(),random).ok,false);
  for(let i=0;i<60;i++){
    if(s.stage==='BREAK'){const p=s.players.find(p=>p.playerId===s.playerId)!;assert.equal(p.pending?.kind,'BREAK_DISCARD');if(p.pending?.kind!=='BREAK_DISCARD')throw new Error('Unexpected break');s=act(s,{kind:'DISCARD',choiceId:p.pending.choiceId,cards:p.hand.slice(0,p.pending.count).map(c=>c.cardId)});}
    else s=act(s,{kind:'FUNDRAISE',x:0});
  }
  assert.ok(s.breakNumber>=3);assert.deepEqual(s.shared.donations,initialDonations);assert.equal(s.phase,'PLAYING');
});

import {createArkEffectQueue,enqueueArkEffects} from '../../games/ark-nova/domain/effect-queue.js';
import type {ArkZooEffect} from '../../games/ark-nova/domain/animal-effects.js';
function appeal(s:ArkMultiplayerState,index:number,value:number){const p=s.players[index]!;p.appeal=value;p.extraAppeal=value-p.multiplayer!.startingAppeal;}
function effect(s:ArkMultiplayerState,e:ArkZooEffect){const p=s.players.find(p=>p.playerId===s.playerId)!;p.effects=enqueueArkEffects({...createArkEffectQueue(),stage:'AFTER_FINISHING'},[{sourceId:'test-interaction',effect:e,timing:'AFTER_FINISHING'}]);p.legacyAfterFinishing='ANIMALS';p.pending={kind:'EFFECT',choiceId:s.transitionId};return act(s,{kind:'SELECT_EFFECT',choiceId:s.transitionId,effectId:1});}
function useEffect(s:ArkMultiplayerState,selection:Extract<ArkSoloCommand,{kind:'EFFECT'}>['selection']){const p=s.players.find(p=>p.playerId===s.playerId)!;return act(s,{kind:'EFFECT',choiceId:p.pending!.choiceId,effectId:p.effects.active!.id,selection});}
test('Venom affects lower slots, constriction affects higher slots, and poison payment is charged once',()=>{
  let s=start(3);appeal(s,1,8);appeal(s,2,4);s=effect(s,{kind:'INTERACTION',ability:'VENOM',amount:2});s=useEffect(s,{kind:'NONE'});
  assert.deepEqual(s.players[1]!.actions.map(a=>a.venom),[true,true,false,false,false]);assert.ok(s.players[2]!.actions.every(a=>!a.venom));
  const victim=s.players[1]!,money=victim.money;assert.equal(s.playerId,victim.playerId);
  const strength=victim.actions.findIndex(a=>a.kind==='SPONSORS')+1;s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.players[1]!.money,money+strength-2);
  s.playerId=s.players[0]!.playerId;s=effect(s,{kind:'INTERACTION',ability:'CONSTRICTION',amount:1});s=useEffect(s,{kind:'NONE'});assert.equal(s.players[1]!.actions[4]!.constriction,true);assert.equal(s.players[1]!.actions[3]!.constriction,false);
});
test('Pilfering asks the victim, conserves money/cards, and hides the transferred hand from bystanders',()=>{
  let s=start(3);appeal(s,1,10);const owner=s.playerId,target=s.players[1]!.playerId,money=s.players[0]!.money;
  s=effect(s,{kind:'INTERACTION',ability:'PILFERING',amount:1});s=useEffect(s,{kind:'INTERACTION',targetId:target,action:null});assert.equal(s.stage,'INTERACTION');assert.equal(s.playerId,target);
  const refused=applyArkMultiplayerCommand(s,owner,s.revision,{kind:'INTERACTION_PAYMENT',choiceId:s.transitionId,payment:'MONEY'},now,next(),random);assert.equal(refused.ok,false);
  s=act(s,{kind:'INTERACTION_PAYMENT',choiceId:s.transitionId,payment:'MONEY'});assert.equal(s.players[0]!.money,money+5);assert.equal(s.players[1]!.money,20);assert.equal(s.players[0]!.progress.turnsCompleted,1);assert.equal(s.playerId,target);
});
test('Hypnosis borrows only the chosen card and its side/strength, then restores the owner row',()=>{
  let s=start(2);appeal(s,1,10);const target=s.players[1]!;target.actions.sort((a,b)=>['ANIMALS','CARDS','SPONSORS','BUILD','ASSOCIATION'].indexOf(a.kind)-['ANIMALS','CARDS','SPONSORS','BUILD','ASSOCIATION'].indexOf(b.kind));
  target.actions[2]!.upgraded=true;target.upgradeCount=1;const original=structuredClone(s.players[0]!.actions),money=s.players[0]!.money;
  s=effect(s,{kind:'INTERACTION',ability:'HYPNOSIS',amount:3});s=useEffect(s,{kind:'INTERACTION',targetId:target.playerId,action:'SPONSORS'});
  assert.equal(applyArkMultiplayerCommand(s,s.playerId,s.revision,{kind:'TAKE_X',action:'BUILD'},now,next(),random).ok,false);
  s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.players[0]!.money,money+6);assert.deepEqual(s.players[0]!.actions,original);assert.equal(s.players[1]!.actions[0]!.kind,'SPONSORS');assert.equal(s.players[0]!.progress.turnsCompleted,1);
});
test('First conservation 10 interrupts for every private goal choice and resumes the correct player',()=>{
  let s=start(3);const owner=s.players[0]!;owner.conservation=9;owner.associationConservation=9;s=effect(s,{kind:'GAIN',resource:'CONSERVATION',amount:1});s=useEffect(s,{kind:'NONE'});assert.equal(s.stage,'GOAL_DISCARD');
  for(let i=0;i<3;i++){const p=s.players.find(p=>p.playerId===s.playerId)!;s=act(s,{kind:'FINAL_GOAL',choiceId:s.transitionId,discard:p.goals[0]!.cardId});}
  assert.equal(s.stage,'ACTION');assert.equal(s.playerId,s.players[1]!.playerId);assert.ok(s.players.every(p=>p.goalDiscarded&&p.goals.length===1));
});
for(const count of [2,3,4])test(`${count} players: crossing grants only opponents a final turn and scores everyone once`,()=>{
  let s=start(count);appeal(s,0,113);s.players[0]!.conservation=1;s.players[0]!.associationConservation=1;s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.finalTurns!.length,count-1);
  for(let i=1;i<count;i++){while(s.stage==='BREAK'){const p=s.players.find(p=>p.playerId===s.playerId)!;if(p.pending?.kind!=='BREAK_DISCARD')throw new Error('Unexpected income choice');s=act(s,{kind:'DISCARD',choiceId:p.pending.choiceId,cards:p.hand.slice(0,p.pending.count).map(c=>c.cardId)});}s=act(s,{kind:'FUNDRAISE',x:0});}assert.equal(s.stage,'FINAL_SCORING');
  for(let i=0;i<count;i++){const p=s.players.find(p=>p.playerId===s.playerId)!;s=act(s,{kind:'FINAL_GOAL',choiceId:p.pending!.choiceId,discard:p.goals[0]!.cardId});}
  assert.equal(s.phase,'FINISHED');assert.deepEqual(s.winners,[s.players[0]!.playerId]);assert.ok(s.players.every(p=>p.progress.turnsCompleted===1&&p.result));
});

import {type ArkCard} from '@hangul-rummikub/shared';
/** Move existing cards only: the fixture must pass the full deck-conservation parser. */
function takeCard(s:ArkMultiplayerState,key:string):ArkCard{
  for(const zone of [s.shared.zooDeck,s.shared.discarded,...s.players.map(p=>p.hand)]){const i=zone.findIndex(c=>c.key===key);if(i>=0)return zone.splice(i,1)[0]!;}
  const i=s.shared.display.findIndex(c=>c?.key===key);assert.ok(i>=0,key);const card=s.shared.display[i]!;s.shared.display[i]=null;return card;
}
test('Global expert income reacts to an opponent animal once and failed/replayed choices do not pay again',()=>{
  let s=start(3);s.players[1]!.played.push(takeCard(s,'236'));const card=takeCard(s,'466');s.players[0]!.hand.push(card);
  const animals=s.players[0]!.actions.findIndex(a=>a.kind==='ANIMALS');[s.players[0]!.actions[animals],s.players[0]!.actions[2]]=[s.players[0]!.actions[2]!,s.players[0]!.actions[animals]!];
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:false});const before=s.players[1]!.money;
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:card.cardId,housingId:'initial-enclosure'}});assert.equal(s.players[1]!.money,before+3);
  assert.equal(applyArkMultiplayerCommand(s,s.playerId,s.revision,{kind:'PLAY_ZOO',card:{cardId:card.cardId,housingId:'initial-enclosure'}},now,next(),random).ok,false);assert.equal(s.players[1]!.money,before+3);
});
test('Pilfering skips quarantine, transfers all remaining money if no cards, and ignores conservation zero',()=>{
  let s=start(3);s.players[1]!.played.push(takeCard(s,'225'));appeal(s,1,20);appeal(s,2,8);
  s.shared.discarded.push(...s.players[2]!.hand.splice(0));s.players[2]!.money=3;
  s=effect(s,{kind:'INTERACTION',ability:'PILFERING',amount:2});const target=s.players[2]!.playerId;
  s=useEffect(s,{kind:'INTERACTION',targetId:target,action:null});assert.equal(s.players[0]!.money,28);assert.equal(s.players[2]!.money,0);
  s=useEffect(s,{kind:'SKIP'});assert.equal(s.players[0]!.progress.turnsCompleted,1);
});
test('Random stolen cards remain private after a victim payment',()=>{
  let s=start(3);appeal(s,1,10);const target=s.players[1]!,stolen=target.hand.at(-1)!;
  s=effect(s,{kind:'INTERACTION',ability:'PILFERING',amount:1});s=useEffect(s,{kind:'INTERACTION',targetId:target.playerId,action:null});s=act(s,{kind:'INTERACTION_PAYMENT',choiceId:s.transitionId,payment:'CARD'});
  assert.ok(s.players[0]!.hand.some(c=>c.cardId===stolen.cardId));assert.ok(!s.players[1]!.hand.some(c=>c.cardId===stolen.cardId));
  assert.ok(!JSON.stringify(projectArkMultiplayerGame(s,s.players[2]!.playerId)).includes(stolen.cardId));
});
test('A repeated fundraising action crosses the break line once and finishes both actions before shared income',()=>{
  let s=start(2);s.breakPosition=8;const p=s.players[0]!,sponsor=p.actions.find(a=>a.kind==='SPONSORS')!,strength=p.actions.indexOf(sponsor)+1,money=p.money;sponsor.multiplier=1;
  s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.stage,'ACTION');assert.equal(s.breakPosition,9);assert.equal(s.players[0]!.x,1);assert.equal(s.players[0]!.progress.turnsCompleted,0);
  s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.stage,'BREAK');assert.equal(s.players[0]!.money,money+2*strength);assert.equal(s.players[0]!.x,1);assert.equal(s.players[0]!.progress.turnsCompleted,1);
  const discarded=s.shared.display.slice(0,2).map(c=>c!.cardId);
  while(s.stage==='BREAK'){const p=s.players.find(p=>p.playerId===s.playerId)!;assert.equal(p.pending?.kind,'BREAK_DISCARD');if(p.pending?.kind!=='BREAK_DISCARD')throw new Error('Expected discard');s=act(s,{kind:'DISCARD',choiceId:p.pending.choiceId,cards:p.hand.slice(0,p.pending.count).map(c=>c.cardId)});}
  assert.equal(s.breakNumber,1);for(const id of discarded)assert.ok(s.shared.discarded.some(c=>c.cardId===id));assert.equal(s.playerId,s.players[1]!.playerId);
});
test('A queued extra action completes before a break and counts as only one multiplayer turn',()=>{
  let s=start(2);s.breakPosition=8;s=effect(s,{kind:'EXTRA_ACTION',action:'SPONSORS'});s=useEffect(s,{kind:'ACTION',action:'SPONSORS'});
  assert.equal(s.players[0]!.progress.turnsCompleted,0);s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.stage,'BREAK');assert.equal(s.players[0]!.progress.turnsCompleted,1);
});

test('Crossing during break income grants every player one final turn after all income resolves',()=>{
  let s=start(2);appeal(s,0,113);s.players[0]!.activatedProjectBonuses=['CONSERVATION_1'];s.players[0]!.supportedProjects=1;
  s.playerId=s.players[1]!.playerId;s.breakPosition=8;s=act(s,{kind:'FUNDRAISE',x:0});
  let steps=0;
  while(s.stage==='BREAK'){
    assert.ok(++steps<12);const p=s.players.find(p=>p.playerId===s.playerId)!;
    if(p.pending?.kind==='BREAK_DISCARD')s=act(s,{kind:'DISCARD',choiceId:p.pending.choiceId,cards:p.hand.slice(0,p.pending.count).map(c=>c.cardId)});
    else {const job=p.effects.active??p.effects.frames.at(-1)![0]!;s=act(s,{kind:'EFFECT',choiceId:p.pending!.choiceId,effectId:job.id,selection:{kind:'NONE'}});}
  }
  assert.equal(s.players[0]!.conservation,1);assert.deepEqual(s.finalTurns,s.players.map(p=>p.playerId));assert.equal(s.playerId,s.players[0]!.playerId);
});
test('Patent Release pays opponents once at effect resolution, including its cap',()=>{
  let s=start(3);const p=s.players[0]!,patent=takeCard(s,'222');p.played.push(patent,takeCard(s,'204'),takeCard(s,'225'));p.effects=enqueueArkEffects({...createArkEffectQueue(),stage:'AFTER_FINISHING'},[{sourceId:patent.cardId,effect:{kind:'GAIN',resource:'CONSERVATION',amount:2},timing:'AFTER_FINISHING'}]);p.legacyAfterFinishing='SPONSORS';p.pending={kind:'EFFECT',choiceId:s.transitionId};
  s=act(s,{kind:'SELECT_EFFECT',choiceId:s.transitionId,effectId:1});s=useEffect(s,{kind:'NONE'});
  assert.equal(s.players[1]!.money,29);assert.equal(s.players[2]!.money,29);assert.equal(s.players[0]!.conservation,2);
});
test('Multiplayer restoration rejects mismatched seats, forged ownership and invalid stage metadata',()=>{
  const s=start(2),bad=structuredClone(s);bad.players[1]!.playerId=bad.players[0]!.playerId;assert.throws(()=>parseArkMultiplayerState(bad));
  const continuation=structuredClone(s);continuation.stage='INTERACTION';assert.throws(()=>parseArkMultiplayerState(continuation));
  const projection=projectArkMultiplayerGame(s,s.playerId);const forged=structuredClone(projection);forged.table!.players[0]!.handCount++;assert.throws(()=>v.parse(ArkSoloViewSchema,forged));
});

test('Hypnotized animal action moves the target row before Boost and preserves the owner after-finishing move',()=>{
  let s=start(2);appeal(s,1,10);const target=s.players[1]!,targetId=target.playerId,card=takeCard(s,'466');s.players[0]!.hand.push(card);
  const i=target.actions.findIndex(a=>a.kind==='ANIMALS');[target.actions[i],target.actions[2]]=[target.actions[2]!,target.actions[i]!];
  s=effect(s,{kind:'INTERACTION',ability:'HYPNOSIS',amount:3});s=useEffect(s,{kind:'INTERACTION',targetId,action:'ANIMALS'});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:false});s=act(s,{kind:'PLAY_ZOO',card:{cardId:card.cardId,housingId:'initial-enclosure'}});
  let p=s.players[0]!;for(const job of [...p.effects.frames.at(-1)!])s=act(s,{kind:'EFFECT',choiceId:s.players[0]!.pending!.choiceId,effectId:job.id,selection:{kind:'NONE'}});
  s=act(s,{kind:'END_ZOO'});assert.equal(s.players[1]!.actions[0]!.kind,'ANIMALS');assert.equal(s.players[0]!.progress.turnsCompleted,0);
  p=s.players[0]!;const boost=p.effects.active??p.effects.frames.at(-1)![0]!;assert.equal(boost.effect.kind,'MOVE_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:p.pending!.choiceId,effectId:boost.id,selection:{kind:'MOVE',action:'CARDS',slot:5}});
  assert.equal(s.players[0]!.actions[4]!.kind,'CARDS');assert.equal(s.players[0]!.progress.turnsCompleted,1);assert.equal(s.borrowed.length,0);
});

test('Poison is settled after card income, allowing a zero-money player to earn during the action',()=>{
  let s=start(2);const p=s.players[0]!,card=takeCard(s,'220');p.hand.push(card);p.money=0;p.actions.find(a=>a.kind==='BUILD')!.venom=true;
  s=act(s,{kind:'BEGIN_ZOO',action:'SPONSORS',x:0,gainReputation:false});assert.equal(s.players[0]!.money,0);
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:card.cardId,housingId:null}});
  for(const job of [...s.players[0]!.effects.frames.at(-1)!])s=act(s,{kind:'EFFECT',choiceId:s.players[0]!.pending!.choiceId,effectId:job.id,selection:{kind:'NONE'}});
  assert.equal(s.players[0]!.money,3);s=act(s,{kind:'END_ZOO'});assert.equal(s.players[0]!.money,1);assert.equal(s.players[0]!.progress.turnsCompleted,1);assert.equal(s.venomRollback,null);
});
test('An unaffordable poison turn rolls back atomically to its beginning; a poisoned action remains playable',()=>{
  let s=start(2);s.players[0]!.money=0;s.players[0]!.actions.find(a=>a.kind==='BUILD')!.venom=true;const before=structuredClone(s);
  s=act(s,{kind:'TAKE_X',action:'CARDS'});assert.match(s.notice??'',/독 비용 2/);assert.equal(s.playerId,before.playerId);assert.equal(s.revision,before.revision+1);assert.deepEqual(s.players,before.players);assert.deepEqual(s.shared,before.shared);
  assert.equal(JSON.stringify(projectArkMultiplayerGame(s,s.playerId)).includes('venomRollback'),false);
  s=act(s,{kind:'TAKE_X',action:'BUILD'});assert.equal(s.players[0]!.money,0);assert.equal(s.players[0]!.x,1);assert.equal(s.players[0]!.progress.turnsCompleted,1);assert.equal(s.notice,null);
});

test('A pilfering owner tied for the lead may select themselves for no effect',()=>{
  let s=start(2);appeal(s,0,8);appeal(s,1,8);s=effect(s,{kind:'INTERACTION',ability:'PILFERING',amount:1});s=useEffect(s,{kind:'SKIP'});assert.equal(s.players[0]!.money,25);assert.equal(s.players[1]!.money,25);assert.equal(s.players[0]!.progress.turnsCompleted,1);
});
