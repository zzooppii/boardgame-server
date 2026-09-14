import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { ARK_MAP_A, arkShape, arkPlacementReason, ArkPlacementSchema, GameIdSchema, GameRevisionSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, type ArkSoloCommand } from '@hangul-rummikub/shared';
import { createArkSoloGame, applyArkSoloCommand, parseArkSoloState, projectArkSoloGame, type ArkSoloState } from '../../games/ark-nova/domain/game.js';
const owner=v.parse(PlayerIdSchema,'cards-owner'),now=v.parse(ServerTimeSchema,1000);let seq=0;
function act(s:ArkSoloState,a:ArkSoloCommand):ArkSoloState {
  const before=structuredClone(s),result=applyArkSoloCommand(s,owner,s.revision,a,now,v.parse(TurnIdSchema,`live-card-${++seq}`),{nextInt:()=>0});
  assert.ok(result.ok,JSON.stringify(a));assert.deepEqual(s,before);
  const restored=parseArkSoloState(JSON.parse(JSON.stringify(result.state)));projectArkSoloGame(restored,owner);return restored;
}
function setup(keys:string[]):ArkSoloState {
  let n=0;const s=createArkSoloGame({gameId:v.parse(GameIdSchema,'cards-game'),playerId:owner,now,transitionId:v.parse(TurnIdSchema,'start'),difficulty:'STANDARD',random:{nextInt:max=>max-1},nextCardId:()=>`opaque-${++n}`});
  for(const [index,key] of keys.entries()) {
    const held=s.hand.findIndex(c=>c.key===key);
    if(held>=0)[s.hand[index],s.hand[held]]=[s.hand[held]!,s.hand[index]!];
    else {
      const deck=s.zooDeck.findIndex(c=>c.key===key);
      if(deck>=0)[s.hand[index],s.zooDeck[deck]]=[s.zooDeck[deck]!,s.hand[index]!];
      else {const display=s.display.findIndex(c=>c?.key===key);assert.ok(display>=0,key);[s.hand[index],s.display[display]]=[s.display[display]!,s.hand[index]!];}
    }
  }
  return act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
}
function resolve(s:ArkSoloState):ArkSoloState {
  for(let guard=0;(s.pending?.kind==='EFFECT'||s.pending?.kind==='BUILD_BONUS'||s.pending?.kind==='REWARD')&&guard<40;guard++) {
    if(s.pending.kind==='BUILD_BONUS'){s=act(s,{kind:'BUILD_BONUS',choiceId:s.pending.choiceId,bonusId:s.buildBonuses[0]!.id,selection:{kind:'NONE'}});continue;}
    if(s.pending.kind==='REWARD'){const reward=s.rewards[0]!;s=act(s,{kind:'REWARD',choiceId:s.pending.choiceId,rewardId:reward.id,selection:reward.kind==='UPGRADE'?{kind:'UPGRADE',action:'SPONSORS'}:{kind:'NONE'}});continue;}
    const job=s.effects.active??s.effects.frames.at(-1)![0]!;
    let selection:Extract<ArkSoloCommand,{kind:'EFFECT'}>['selection'];
    switch(job.effect.kind) {
      case 'GAIN':selection={kind:'NONE'};break;
      case 'HUNTER':selection=s.cardReveal?{kind:'KEEP',choiceId:s.cardReveal.choiceId,keep:s.cardReveal.candidates.filter(c=>Number(c.key)>=401).slice(0,1).map(c=>c.cardId)}:{kind:'NONE'};break;
      case 'CARD_PICK':selection={kind:'CARD',cardId:s.progress.stage==='BREAK'?s.display.find(c=>c!==null)!.cardId:null,refill:false};break;
      default:throw new Error(`Unexpected test effect ${job.effect.kind}`);
    }
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection});
  }
  assert.notEqual(s.pending?.kind,'EFFECT');return s;
}
test('Canonical solo commands play an animal and sponsor, resolve private choices, and finish 27 turns with exactly five sponsor incomes',()=>{
  let s=setup(['404','201','208','223']);s=act(s,{kind:'TAKE_X',action:'CARDS'});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='404')!.cardId,housingId:'initial-enclosure'}});
  assert.equal(s.money,16);assert.equal(s.progress.turnsCompleted,1);assert.equal(s.pending?.kind,'EFFECT');
  const before=structuredClone(s);
  for(const command of [{kind:'END_ZOO'},{kind:'FUNDRAISE',x:0},{kind:'EFFECT',choiceId:'stale',effectId:1,selection:{kind:'NONE'}}]) {
    assert.equal(applyArkSoloCommand(s,owner,s.revision,command,now,v.parse(TurnIdSchema,'rejected')).ok,false);
  }
  assert.deepEqual(s,before);s=resolve(s);assert.equal(s.appeal,24);
  s=act(s,{kind:'END_ZOO'});assert.equal(s.progress.turnsCompleted,2);
  s=resolve(act(s,{kind:'BUILD',x:0,placement:{building:'ENCLOSURE_2',anchor:{q:0,r:1},rotation:1,reflected:false}}));
  s=resolve(act(s,{kind:'BUILD',x:0,placement:{building:'PAVILION',anchor:{q:0,r:0},rotation:0,reflected:false}}));
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  assert.equal(s.actions.find(a=>a.kind==='SPONSORS')!.upgraded,true);
  s=act(s,{kind:'BEGIN_ZOO',action:'SPONSORS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='201')!.cardId,housingId:null}});s=resolve(s);s=act(s,{kind:'END_ZOO'});
  assert.equal(s.played.length,2);let incomes=0;
  for(let guard=0;s.phase==='PLAYING'&&guard<100;guard++) {
    if(s.pending?.kind==='EFFECT') {assert.equal(s.progress.stage,'BREAK');incomes++;s=resolve(s);assert.equal(s.display.filter(c=>c!==null).length,6);}
    else if(s.pending?.kind==='BREAK_DISCARD')s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
    else if(s.pending?.kind==='FINAL_GOAL')s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId});
    else s=act(s,{kind:'FUNDRAISE',x:0});
  }
  assert.equal(s.phase,'FINISHED');assert.equal(s.progress.turnsCompleted,27);assert.equal(incomes,5);assert.equal(s.result?.appeal,25);
});
test('Effect selection authenticates actor and revision and projection exposes only the currently revealed private cards',()=>{
  let s=setup(['404','201','208','223']);s=act(s,{kind:'TAKE_X',action:'CARDS'});s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='404')!.cardId,housingId:'initial-enclosure'}});
  const job=s.effects.frames.at(-1)!.find(j=>j.effect.kind==='HUNTER')!,command={kind:'SELECT_EFFECT',choiceId:s.pending!.choiceId,effectId:job.id} as const;
  assert.equal(applyArkSoloCommand(s,v.parse(PlayerIdSchema,'stranger'),s.revision,command,now,v.parse(TurnIdSchema,'bad')).ok,false);
  assert.equal(applyArkSoloCommand(s,owner,s.revision-1,command,now,v.parse(TurnIdSchema,'bad')).ok,false);
  s=act(s,command);s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'NONE'}});
  assert.ok(s.cardReveal);const view=projectArkSoloGame(s,owner),wire=JSON.stringify(view);
  assert.deepEqual(view.revealedCards?.candidates,s.cardReveal.candidates);
  assert.ok(!wire.includes(s.zooDeck[0]!.cardId));assert.ok(!wire.includes(s.goalDeck[0]!.cardId));assert.ok(!wire.includes(s.baseProjectReserve[0]!.cardId));
  assert.throws(()=>projectArkSoloGame(s,v.parse(PlayerIdSchema,'stranger')));
});
test('Association conservation bonus pays a sponsor, resolves its immediate rewards, then shifts Association once before the deferred Africa move',()=>{
  let s=setup(['214','223','208','201']);
  // Boundary fixture: the first two university slots and conservation 2 upgrades were earned previously.
  s.universities=['RESEARCH_2','HAND_LIMIT'];s.universitySupply=['RESEARCH_REPUTATION'];
  s.conservation=4;s.associationConservation=4;s.reputation=3;s.reputationGained=2;
  s.actions.find(c=>c.kind==='BUILD')!.upgraded=true;s.actions.find(c=>c.kind==='CARDS')!.upgraded=true;s.upgradeCount=2;
  s.conservationBonuses=[{track:5,tile:'PAID_SPONSOR'}];
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university:'RESEARCH_REPUTATION'}});
  const conservation=s.rewards.find(r=>r.kind==='CONSERVATION')!;
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:conservation.id,selection:{kind:'NONE'}});
  const effect=(selection:Extract<ArkSoloCommand,{kind:'EFFECT'}>['selection'])=>{
    const job=s.effects.active??s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection});
  };
  effect({kind:'NONE'});assert.equal(s.conservation,6);
  effect({kind:'BONUS',tile:'PAID_SPONSOR'});
  effect({kind:'SPONSOR',card:{cardId:s.hand.find(c=>c.key==='214')!.cardId,housingId:null}});
  assert.equal(s.money,21);assert.equal(s.progress.turnsCompleted,0);assert.equal(s.activeAssociation,true);
  effect({kind:'NONE'});assert.equal(s.appeal,21);assert.equal(s.effects.afterFinishing.length,1);
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'NONE'}});
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'UPGRADE',action:'SPONSORS'}});
  assert.equal(s.legacyAfterFinishing,'ASSOCIATION');assert.equal(s.actions[0]!.kind,'ASSOCIATION');assert.equal(s.progress.turnsCompleted,0);
  effect({kind:'MOVE',action:'BUILD',slot:1});
  assert.equal(s.legacyAfterFinishing,null);assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.actions[1]!.kind,'ASSOCIATION');assert.equal(s.progress.turnsCompleted,1);
});
test('Normal university acquisition offers its slot upgrade and both Science rewards in either order without extra staff',()=>{
  for(const upgradeFirst of [true,false]) {
    let s=setup(['208','223','214','201']);
    // Previously played sponsor and first university, keeping physical card inventory intact.
    s.played.push(s.hand.splice(s.hand.findIndex(c=>c.key==='208'),1)[0]!);
    s.universities=['HAND_LIMIT'];s.universitySupply=['RESEARCH_2','RESEARCH_REPUTATION'];
    s.reputation=2;s.reputationGained=1;
    const row=structuredClone(s.actions),money=s.money;
    s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university:'RESEARCH_2'}});
    assert.equal(s.pending?.kind,'EFFECT');assert.equal(s.rewards.length,0);assert.equal(s.busyWorkers,1);
    assert.deepEqual(s.actions,row);assert.equal(s.progress.turnsCompleted,0);
    for(const kind of upgradeFirst?['UPGRADE','GAIN']:['GAIN','UPGRADE']) {
      const job=s.effects.frames.at(-1)!.find(j=>j.effect.kind===kind)!;
      assert.ok(job);
      s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:kind==='UPGRADE'?{kind:'UPGRADE',action:'SPONSORS'}:{kind:'NONE'}});
    }
    assert.equal(s.money,money+4);assert.equal(s.busyWorkers,1);assert.equal(s.progress.turnsCompleted,1);
    assert.equal(s.actions[0]!.kind,'ASSOCIATION');assert.equal(s.actions.find(c=>c.kind==='SPONSORS')!.upgraded,true);
  }
});
test('Normal Africa partnership moves Association before the expert effect and ends the turn only after that choice',()=>{
  let s=setup(['214','223','208','201']);s.played.push(s.hand.splice(s.hand.findIndex(c=>c.key==='214'),1)[0]!);
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Africa'}});
  assert.deepEqual(s.partners,['Africa']);assert.equal(s.busyWorkers,1);
  assert.equal(s.legacyAfterFinishing,'ASSOCIATION');assert.equal(s.actions[0]!.kind,'ASSOCIATION');
  assert.equal(s.progress.turnsCompleted,0);assert.equal(s.pending?.kind,'EFFECT');
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'TAKE_X',action:'BUILD'},now,v.parse(TurnIdSchema,'blocked')).ok,false);
  assert.deepEqual(s,before);
  const job=s.effects.frames.at(-1)![0]!;
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'MOVE',action:'BUILD',slot:1}});
  assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.actions[1]!.kind,'ASSOCIATION');
  assert.equal(s.busyWorkers,1);assert.equal(s.legacyAfterFinishing,null);
});

test('Normal upgraded construction opens relocation and map rewards, preserving the active build until every choice resolves',()=>{
  let s=setup(['496','223','208','201']);
  s.played.push(s.hand.splice(s.hand.findIndex(c=>c.key==='496'),1)[0]!);s.buildings[1]!.occupied=true;
  s.actions.find(c=>c.kind==='BUILD')!.upgraded=true;s.upgradeCount=1;
  const placements=ARK_MAP_A.flatMap(anchor=>[0,1,2,3,4,5].flatMap(rotation=>[false,true].map(reflected=>
    v.parse(ArkPlacementSchema,{building:'LargeBirdAviary',anchor:{q:anchor.q,r:anchor.r},rotation,reflected}))));
  const placement=placements.find(p=>arkPlacementReason(s.buildings,p.building,arkShape(p.building,p.anchor,p.rotation,p.reflected),true)===null)!;
  assert.ok(placement);
  // Build starts in slot 3; the five-cell aviary uses two earned X tokens.
  s.x=2;
  const beforeMoney=s.money;
  s=act(s,{kind:'BUILD',x:2,placement});
  assert.equal(s.money,beforeMoney-10);assert.equal(s.x,0);assert.equal(s.pending?.kind,'EFFECT');
  const aviary=s.buildings.at(-1)!;assert.equal(aviary.kind,'LargeBirdAviary');
  const move=s.effects.frames.at(-1)!.find(j=>j.effect.kind==='MOVE_TO_SPECIAL')!;assert.ok(move);
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:move.id,selection:{kind:'MOVE_ANIMAL',cardId:s.played[0]!.cardId,housingId:'initial-enclosure'}});
  assert.equal(s.buildings[1]!.occupied,false);assert.ok(s.buildings.at(-1)!.used>0);assert.equal(s.progress.turnsCompleted,0);
  const again=s.effects.frames.at(-1)![0]!;
  assert.equal(again.effect.kind,'MOVE_TO_SPECIAL');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:again.id,selection:{kind:'SKIP'}});
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    assert.ok(job.effect.kind==='GAIN'||job.effect.kind==='CARD_PICK');
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='CARD_PICK'?{kind:'CARD',cardId:null,refill:false}:{kind:'NONE'}});
  }
  if(s.activeBuild)s=act(s,{kind:'END_BUILD'});
  assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.appeal,20);
});
test('Solo Determination finishes its X action before a normal turn, round break, or final scoring',()=>{
  for(const completed of [0,5,25])for(const multiplier of [0,1]) {
  let s=setup(['485','223','208','201']);s.actions.find(c=>c.kind==='BUILD')!.multiplier=multiplier;
  s.revision=v.parse(GameRevisionSchema,completed+1);
  if(completed===25){s.progress={round:6,turnsCompleted:25,turnInRound:0,stage:'ACTION'};s.donations=[0,1,2,3,4];s.breakStep='COMPLETE';}
  else {s.progress.turnsCompleted=completed;s.progress.turnInRound=completed;}
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Europe'}});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='485')!.cardId,housingId:'initial-enclosure'}});
  s=resolve(s);s=act(s,{kind:'END_ZOO'});
  assert.equal(s.actions[0]!.kind,'ANIMALS');assert.equal(s.progress.turnsCompleted,completed+1);
  const job=s.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'EXTRA_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action:'TAKE_X'}});
  assert.deepEqual(projectArkSoloGame(s,owner).extraAction,{action:'TAKE_X',started:false,depth:1});
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'FUNDRAISE',x:0},now,v.parse(TurnIdSchema,'wrong-extra')).ok,false);assert.deepEqual(s,before);
  s=act(s,{kind:'TAKE_X',action:'BUILD'});
  if(multiplier){assert.equal(s.progress.turnsCompleted,completed+1);assert.equal(s.extraActions.length,1);s=act(s,{kind:'END_REPEAT'});}
  assert.equal(s.x,1);assert.equal(s.progress.turnsCompleted,completed+2);assert.equal(s.extraActions.length,0);
  assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.actions[1]!.kind,'ANIMALS');
  if(completed===25) {
    assert.equal(s.pending?.kind,'FINAL_GOAL');s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});assert.equal(s.phase,'FINISHED');
  } else {assert.equal(s.pending,null);assert.equal(s.progress.round,completed===5?2:1);}
  }
});
test('A fixed Association extra action forbids taking X and uses the ordinary staff and reward rules',()=>{
  let s=setup(['409','223','208','201']);s.workers=2;s.extraWorkers=1;
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Asia'}});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='409')!.cardId,housingId:'initial-enclosure'}});
  s=resolve(s);s=act(s,{kind:'END_ZOO'});
  const job=s.effects.frames.at(-1)![0]!;
  for(const action of ['TAKE_X','BUILD'])assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action}},now,v.parse(TurnIdSchema,'bad-fixed')).ok,false);
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action:'ASSOCIATION'}});
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}});
  assert.equal(s.progress.turnsCompleted,1);assert.equal(s.extraActions.length,1);assert.equal(s.pending?.kind,'REWARD');
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'CANCEL_EXTRA'},now,v.parse(TurnIdSchema,'cannot-cancel-started')).ok,false);
  s=resolve(s);
  assert.equal(s.reputation,3);assert.equal(s.busyWorkers,2);assert.equal(s.progress.turnsCompleted,2);assert.equal(s.extraActions.length,0);
});
test('An extra Animals action can itself grant an Association action without losing either parent continuation',()=>{
  let s=setup(['485','409','223','201']);s.money=100;s.x=1;s.workers=2;s.extraWorkers=1;
  s.partners=['Asia'];s.partnerSupply=s.partnerSupply.filter(c=>c!=='Asia');
  s.buildings.push({id:'previous-two-space',kind:'ENCLOSURE_2',cells:arkShape('ENCLOSURE_2',{q:0,r:1},1,false),occupied:false,used:0});
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Europe'}});
  s=resolve(s);
  const animal=(key:string,housingId:string,x:number)=>{
    s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x,gainReputation:true});
    s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key===key)!.cardId,housingId}});s=resolve(s);s=act(s,{kind:'END_ZOO'});
  };
  const choose=(action:'ANIMALS'|'ASSOCIATION')=>{const job=s.effects.frames.at(-1)![0]!;s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action}});};
  animal('485','initial-enclosure',0);choose('ANIMALS');
  animal('409','previous-two-space',1);choose('ASSOCIATION');
  assert.equal(s.extraActions.length,2);assert.equal(s.extraActions[0]!.started,true);assert.equal(s.progress.turnsCompleted,1);
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  assert.equal(s.extraActions.length,0);assert.equal(s.progress.turnsCompleted,2);assert.equal(s.zooWork,null);
  assert.equal(s.appeal,27);assert.equal(s.busyWorkers,2);assert.equal(s.x,0);
});

test('An unstarted extra action can be declined without shifting a card or becoming stuck at the X limit',()=>{
  let s=setup(['485','223','208','201']);s.x=5;
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Europe'}});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='485')!.cardId,housingId:'initial-enclosure'}}));s=act(s,{kind:'END_ZOO'});
  const row=structuredClone(s.actions),job=s.effects.frames.at(-1)![0]!;
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action:'TAKE_X'}});
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'TAKE_X',action:'BUILD'},now,v.parse(TurnIdSchema,'full-x')).ok,false);assert.deepEqual(s,before);
  s=act(s,{kind:'CANCEL_EXTRA'});assert.deepEqual(s.actions,row);assert.equal(s.x,5);assert.equal(s.progress.turnsCompleted,2);assert.equal(s.extraActions.length,0);
});
test('Two multiplier tokens allow three Sponsors actions at the same base strength with separately paid X tokens',()=>{
  let s=setup(['404','223','208','201']);s.actions.find(c=>c.kind==='SPONSORS')!.multiplier=2;s.x=3;
  const row=structuredClone(s.actions.map(c=>c.kind)),base=row.indexOf('SPONSORS')+1,money=s.money;
  s=act(s,{kind:'FUNDRAISE',x:1});
  assert.deepEqual(s.actions.map(c=>c.kind),row);assert.equal(s.progress.turnsCompleted,0);assert.equal(s.money,money+base+1);assert.equal(s.x,2);
  assert.equal(projectArkSoloGame(s,owner).repeatedAction?.remaining,2);
  const before=structuredClone(s);
  for(const command of [{kind:'TAKE_X',action:'SPONSORS'},{kind:'DRAW',x:0}])assert.equal(applyArkSoloCommand(s,owner,s.revision,command,now,v.parse(TurnIdSchema,'not-repeat')).ok,false);
  assert.deepEqual(s,before);
  s=act(s,{kind:'FUNDRAISE',x:2});assert.equal(s.money,money+2*base+3);assert.equal(s.x,0);assert.equal(s.progress.turnsCompleted,0);
  s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.money,money+3*base+3);assert.equal(s.progress.turnsCompleted,1);
  assert.equal(s.actions[0]!.kind,'SPONSORS');assert.equal(s.actions[0]!.multiplier,0);assert.equal(s.repeatedAction,null);
});
test('Multiplied X actions never mix with regular actions and may end early at the five-token limit',()=>{
  let s=setup(['404','223','208','201']);s.x=4;s.actions.find(c=>c.kind==='BUILD')!.multiplier=2;
  const row=s.actions.map(c=>c.kind);
  s=act(s,{kind:'TAKE_X',action:'BUILD'});assert.equal(s.x,5);assert.deepEqual(s.actions.map(c=>c.kind),row);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'TAKE_X',action:'BUILD'},now,v.parse(TurnIdSchema,'cap')).ok,false);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'FUNDRAISE',x:0},now,v.parse(TurnIdSchema,'mix')).ok,false);
  s=act(s,{kind:'END_REPEAT'});assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.x,5);
});
test('Multiplied Animals waits to shift and release Determination until both animal actions finish',()=>{
  let s=setup(['485','404','223','201']);s.money=100;
  s.buildings.push({id:'previous-two-space',kind:'ENCLOSURE_2',cells:arkShape('ENCLOSURE_2',{q:0,r:1},1,false),occupied:false,used:0});
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Europe'}});
  s.actions.find(c=>c.kind==='ANIMALS')!.multiplier=1;
  const row=s.actions.map(c=>c.kind);
  const animal=(key:string,housingId:string)=>{
    s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
    s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key===key)!.cardId,housingId}}));s=act(s,{kind:'END_ZOO'});
  };
  animal('485','previous-two-space');
  assert.deepEqual(s.actions.map(c=>c.kind),row);assert.equal(s.pending,null);assert.equal(s.repeatedAction?.deferred.afterFinishing.length,1);
  assert.equal(s.progress.turnsCompleted,1);
  animal('404','initial-enclosure');
  assert.equal(s.repeatedAction,null);assert.equal(s.actions[0]!.kind,'ANIMALS');assert.equal(s.progress.turnsCompleted,1);
  const job=s.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'EXTRA_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action:'TAKE_X'}});
  s=act(s,{kind:'TAKE_X',action:'BUILD'});assert.equal(s.progress.turnsCompleted,2);assert.equal(s.appeal,26);
});
test('Boost waits until both multiplied Animals actions finish before moving the action card',()=>{
  let s=setup(['419','404','223','201']);s.money=100;
  s.buildings.push({id:'previous-two-space',kind:'ENCLOSURE_2',cells:arkShape('ENCLOSURE_2',{q:0,r:1},1,false),occupied:false,used:0});
  s=act(s,{kind:'TAKE_X',action:'CARDS'});s.actions.find(c=>c.kind==='ANIMALS')!.multiplier=1;
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='419')!.cardId,housingId:'previous-two-space'}});
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='MOVE_ACTION'?{kind:'MOVE',action:'ANIMALS',slot:5}:{kind:'NONE'}});
  }
  s=act(s,{kind:'END_ZOO'});assert.equal(s.actions[1]!.kind,'ANIMALS');assert.equal(s.pending,null);
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});assert.equal(s.zooWork?.remaining,1);
  s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='404')!.cardId,housingId:'initial-enclosure'}}));
  s=act(s,{kind:'END_ZOO'});assert.equal(s.actions[0]!.kind,'ANIMALS');assert.equal(s.progress.turnsCompleted,1);
  const boost=s.effects.frames.at(-1)![0]!;assert.equal(boost.effect.kind,'MOVE_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:boost.id,selection:{kind:'MOVE',action:'ANIMALS',slot:5}});
  assert.equal(s.actions[4]!.kind,'ANIMALS');assert.equal(s.progress.turnsCompleted,2);
});
test('A played Cassowary grants the Build multiplier and permits the same building kind in separate repeated actions',()=>{
  let s=setup(['516','404','223','201']);
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'PARTNER',continent:'Australia'}});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='516')!.cardId,housingId:'initial-enclosure'}});
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='MULTIPLIER'?{kind:'MULTIPLIER',action:'BUILD'}:{kind:'NONE'}});
  }
  s=act(s,{kind:'END_ZOO'});assert.equal(s.actions.find(c=>c.kind==='BUILD')!.multiplier,1);
  const row=s.actions.map(c=>c.kind);
  for(let i=0;i<2;i++) {
    const anchor=ARK_MAP_A.find(cell=>arkPlacementReason(s.buildings,'PAVILION',[{q:cell.q,r:cell.r}],false)===null)!;assert.ok(anchor);
    s=resolve(act(s,{kind:'BUILD',x:0,placement:{building:'PAVILION',anchor:{q:anchor.q,r:anchor.r},rotation:0,reflected:false}}));
    if(i===0){assert.deepEqual(s.actions.map(c=>c.kind),row);assert.equal(s.progress.turnsCompleted,2);}
  }
  assert.equal(s.buildings.filter(b=>b.kind==='PAVILION').length,2);assert.equal(s.progress.turnsCompleted,3);assert.equal(s.actions[0]!.kind,'BUILD');
});
test('A repeated Cards action may snap then draw, keeping discard choices and market refill inside the same turn',()=>{
  let s=setup(['404','223','208','201']);s.x=2;
  const cards=s.actions.splice(s.actions.findIndex(c=>c.kind==='CARDS'),1)[0]!;cards.multiplier=1;s.actions.splice(2,0,cards);
  const picked=s.display[0]!.cardId;
  s=act(s,{kind:'SNAP',x:2,cardId:picked});assert.ok(s.hand.some(c=>c.cardId===picked));assert.equal(s.display.filter(c=>c!==null).length,5);
  assert.equal(s.progress.turnsCompleted,0);assert.equal(s.repeatedAction?.awaiting,true);
  s=act(s,{kind:'DRAW',x:0});assert.equal(s.pending?.kind,'DRAW_DISCARD');assert.equal(s.progress.turnsCompleted,0);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'END_REPEAT'},now,v.parse(TurnIdSchema,'unresolved-discard')).ok,false);
  s=act(s,{kind:'DISCARD',choiceId:s.pending!.choiceId,cards:[s.hand.at(-1)!.cardId]});
  assert.equal(s.progress.turnsCompleted,1);assert.equal(s.display.filter(c=>c!==null).length,6);assert.equal(s.repeatedAction,null);
});
test('A multiplied action completes every repetition before the solo break or final scoring',()=>{
  for(const completed of [6,26]) {
    let s=setup(['404','223','208','201']);s.revision=v.parse(GameRevisionSchema,completed+1);
    s.progress=completed===6?{round:1,turnsCompleted:6,turnInRound:6,stage:'ACTION'}:{round:6,turnsCompleted:26,turnInRound:1,stage:'ACTION'};
    if(completed===26){s.donations=[0,1,2,3,4];s.breakStep='COMPLETE';}
    s.actions.find(c=>c.kind==='SPONSORS')!.multiplier=1;
    s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.progress.turnsCompleted,completed);assert.equal(s.pending,null);
    s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.progress.turnsCompleted,completed+1);assert.equal(s.repeatedAction,null);
    if(completed===6){assert.equal(s.pending?.kind,'BREAK_DISCARD');s=act(s,{kind:'DISCARD',choiceId:s.pending!.choiceId,cards:[s.hand[0]!.cardId]});assert.equal(s.progress.round,2);}
    else {assert.equal(s.pending?.kind,'FINAL_GOAL');s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});assert.equal(s.phase,'FINISHED');}
  }
});
test('Repeated Association work charges the repeated task staff cost and waits for its reputation upgrade',()=>{
  let s=setup(['404','223','208','201']);s.workers=3;s.extraWorkers=2;s.actions.find(c=>c.kind==='ASSOCIATION')!.multiplier=1;
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  assert.equal(s.busyWorkers,1);assert.equal(s.reputation,3);assert.equal(s.progress.turnsCompleted,0);
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}});assert.equal(s.busyWorkers,3);
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'NONE'}});
  assert.equal(s.reputation,5);assert.equal(s.pending?.kind,'REWARD');assert.equal(s.progress.turnsCompleted,0);
  s=resolve(s);assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'ASSOCIATION');assert.equal(s.actions.find(c=>c.kind==='SPONSORS')!.upgraded,true);
});
test('Association II completes three distinct tasks, donates once, then resolves Africa before ending the solo turn',()=>{
  let s=setup(['214','223','208','201']);s.played.push(s.hand.splice(0,1)[0]!);
  s.actions.find(c=>c.kind==='ASSOCIATION')!.upgraded=true;s.upgradeCount=1;s.workers=3;s.extraWorkers=2;s.x=5;
  const row=s.actions.map(c=>c.kind);
  s=act(s,{kind:'ASSOCIATION',x:5,task:{kind:'UNIVERSITY',university:'RESEARCH_2'}});
  assert.equal(s.associationWork?.remaining,5);assert.equal(s.x,0);assert.equal(s.pending,null);
  s=act(s,{kind:'ASSOCIATION_MORE',task:{kind:'PARTNER',continent:'Africa'}});
  assert.equal(s.effects.afterFinishing.length,1);assert.equal(s.pending,null);assert.equal(s.associationWork?.remaining,2);
  s=resolve(act(s,{kind:'ASSOCIATION_MORE',task:{kind:'REPUTATION'}}));
  assert.equal(s.busyWorkers,3);assert.equal(s.associationWork?.remaining,0);assert.equal(s.reputation,3);
  const money=s.money;s=act(s,{kind:'DONATE'});assert.equal(s.money,money-2);assert.deepEqual(s.donations,[0]);assert.equal(s.donationsMade,1);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'END_ASSOCIATION'},now,v.parse(TurnIdSchema,'donation-pending')).ok,false);
  s=resolve(s);assert.equal(s.conservation,1);assert.equal(s.effects.afterFinishing.length,1);
  for(const command of [{kind:'DONATE'},{kind:'ASSOCIATION_MORE',task:{kind:'REPUTATION'}}])assert.equal(applyArkSoloCommand(s,owner,s.revision,command,now,v.parse(TurnIdSchema,'duplicate-work')).ok,false);
  assert.deepEqual(s.actions.map(c=>c.kind),row);assert.equal(s.progress.turnsCompleted,0);
  s=act(s,{kind:'END_ASSOCIATION'});assert.equal(s.actions[0]!.kind,'ASSOCIATION');assert.equal(s.progress.turnsCompleted,0);
  const job=s.effects.frames.at(-1)![0]!;
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'MOVE',action:'BUILD',slot:1}});
  assert.equal(s.progress.turnsCompleted,1);assert.equal(s.associationWork,null);
  while(s.phase!=='FINISHED') {
    if(s.pending?.kind==='FINAL_GOAL')s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId});
    else s=act(s,{kind:'FUNDRAISE',x:0});
  }
  assert.equal(s.progress.turnsCompleted,27);assert.deepEqual(s.donations,[0,1,2,3,4,5]);assert.equal(s.donationsMade,1);
});
test('Association donation uses the repeatable final 12-money space without occupying or advancing past it',()=>{
  let s=setup(['404','223','208','201']);s.actions.find(c=>c.kind==='ASSOCIATION')!.upgraded=true;s.upgradeCount=1;
  s.donations=[0,1,2,3,4,5,6];s.donationsMade=7;
  s=resolve(act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}}));
  s=resolve(act(s,{kind:'DONATE'}));assert.equal(s.money,13);assert.equal(s.donationsMade,8);assert.deepEqual(s.donations,[0,1,2,3,4,5,6]);
  s=act(s,{kind:'END_ASSOCIATION'});assert.equal(s.progress.turnsCompleted,1);assert.equal(s.conservation,1);
});
test('Upgrading Association during its side I action does not unlock donation or another task in that same action',()=>{
  let s=setup(['404','223','208','201']);s.reputation=3;s.reputationGained=2;
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'REPUTATION'}});
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'NONE'}});
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'UPGRADE',action:'ASSOCIATION'}});
  assert.equal(s.actions[0]!.upgraded,true);assert.equal(s.associationWork,null);assert.equal(s.progress.turnsCompleted,1);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'DONATE'},now,v.parse(TurnIdSchema,'not-retroactive')).ok,false);
});
test('Association II can use a worker earned from reputation in a later task of the same action',()=>{
  let s=setup(['404','223','208','201']);s.actions.find(c=>c.kind==='ASSOCIATION')!.upgraded=true;s.upgradeCount=1;
  s.reputation=6;s.reputationGained=5;s.x=1;
  s=act(s,{kind:'ASSOCIATION',x:1,task:{kind:'REPUTATION'}});
  s=act(s,{kind:'REWARD',choiceId:s.pending!.choiceId,rewardId:s.rewards[0]!.id,selection:{kind:'NONE'}});
  assert.equal(s.reputation,8);assert.equal(s.workers,1);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'ASSOCIATION_MORE',task:{kind:'PARTNER',continent:'Africa'}},now,v.parse(TurnIdSchema,'worker-not-resolved')).ok,false);
  s=resolve(s);assert.equal(s.workers,2);assert.equal(s.associationWork?.remaining,3);
  s=act(s,{kind:'ASSOCIATION_MORE',task:{kind:'PARTNER',continent:'Africa'}});
  assert.equal(s.busyWorkers,2);assert.equal(s.associationWork?.remaining,0);assert.equal(s.x,0);
  s=act(s,{kind:'END_ASSOCIATION'});assert.equal(s.progress.turnsCompleted,1);
});
test('A supported Research project activates money income for the four remaining breaks and reaches final scoring',()=>{
  let s=setup(['132','223','208','201']);
  s=act(s,{kind:'ASSOCIATION',x:0,task:{kind:'UNIVERSITY',university:'RESEARCH_2'}});
  for(const action of ['BUILD','CARDS','SPONSORS'] as const)s=act(s,{kind:'TAKE_X',action});
  for(let i=0;i<3;i++)s=act(s,{kind:'FUNDRAISE',x:0});
  assert.equal(s.pending?.kind,'BREAK_DISCARD');
  s=act(s,{kind:'DISCARD',choiceId:s.pending!.choiceId,cards:[s.hand.find(c=>c.key!=='132')!.cardId]});
  const project=s.hand.find(c=>c.key==='132')!.cardId,x=5-(s.actions.findIndex(c=>c.kind==='ASSOCIATION')+1);
  s=act(s,{kind:'ASSOCIATION',x,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_5',animalId:null,housingId:null}});
  assert.equal(s.supportedProjects,1);assert.equal(s.pending?.kind,'EFFECT');
  assert.deepEqual(projectArkSoloGame(s,owner).activatedProjectBonuses,['MONEY_5']);
  const moneyJob=s.effects.frames.at(-1)!.find(j=>j.effect.kind==='GAIN'&&j.effect.resource==='MONEY')!,money=s.money;
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:moneyJob.id,selection:{kind:'NONE'}});assert.equal(s.money,money+5);
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='UPGRADE_OR_WORKER'?{kind:'UPGRADE',action:'ASSOCIATION'}:{kind:'NONE'}});
  }
  assert.equal(s.progress.turnsCompleted,8);assert.equal(s.associationWork,null);assert.equal(s.conservation,2);
  let incomes=0;
  for(let guard=0;s.phase!=='FINISHED'&&guard<60;guard++) {
    if(s.pending?.kind==='EFFECT'){assert.equal(s.progress.stage,'BREAK');incomes++;s=resolve(s);}
    else if(s.pending?.kind==='FINAL_GOAL')s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId});
    else s=act(s,{kind:'FUNDRAISE',x:0});
  }
  assert.equal(incomes,4);assert.equal(s.phase,'FINISHED');assert.equal(s.progress.turnsCompleted,27);assert.equal(s.supportedProjects,1);
});
test('A real release project discards the played animal, removes only its printed appeal and resolves all score bonuses',()=>{
  let s=setup(['404','116','223','201']);s=act(s,{kind:'TAKE_X',action:'CARDS'});
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  const animal=s.hand.find(c=>c.key==='404')!.cardId;
  s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:animal,housingId:'initial-enclosure'}}));s=act(s,{kind:'END_ZOO'});
  assert.equal(s.appeal,24);
  const project=s.hand.find(c=>c.key==='116')!.cardId,x=5-(s.actions.findIndex(c=>c.kind==='ASSOCIATION')+1);
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'ASSOCIATION',x,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_12',animalId:animal,housingId:null}},now,v.parse(TurnIdSchema,'invalid-release')).ok,false);assert.deepEqual(s,before);
  s=act(s,{kind:'ASSOCIATION',x,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_12',animalId:animal,housingId:'initial-enclosure'}});
  assert.equal(s.appeal,20);assert.equal(s.buildings[1]!.occupied,false);assert.ok(s.discarded.some(c=>c.cardId===animal));
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
  }
  assert.equal(s.conservation,3);assert.equal(s.reputation,2);assert.equal(s.workers,2);assert.equal(s.progress.turnsCompleted,3);
  assert.equal(s.playedProjects[0]!.cardId,project);assert.equal(s.projectSupports[0]!.cardId,project);
});
test('Migration Recording repeat support survives canonical restore and owner projection without replaying entry reputation',()=>{
  let s=setup(['404','403','224','116']);
  // Start with both animals and Migration Recording already played, preserving the complete inventory.
  s.played=s.hand.filter(c=>c.key!=='116');s.hand=s.hand.filter(c=>c.key==='116');
  s.buildings[1]!.occupied=true;s.appeal=31;s.extraAppeal=11;s.workers=3;s.extraWorkers=2;s.x=5;
  const animal=s.played.find(c=>c.key==='404')!.cardId,other=s.played.find(c=>c.key==='403')!.cardId,project=s.hand[0]!.cardId;
  s=act(s,{kind:'ASSOCIATION',x:1,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_12',animalId:animal,housingId:'initial-enclosure'}});
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
  }
  assert.equal(s.conservation,4);assert.equal(s.reputation,2);assert.equal(s.progress.turnsCompleted,1);
  const command:ArkSoloCommand={kind:'ASSOCIATION',x:4,task:{kind:'PROJECT',cardId:project,slot:1,bonus:'X_3',animalId:other,housingId:null}};
  s=act(s,command);
  assert.equal(s.supportedProjects,2);assert.equal(s.busyWorkers,3);assert.equal(s.appeal,20);
  assert.deepEqual(projectArkSoloGame(s,owner).projectSupports,[{cardId:project,slot:2},{cardId:project,slot:1}]);
  assert.equal(s.effects.frames.flat().some(j=>j.effect.kind==='GAIN'&&j.effect.resource==='REPUTATION'),false);
  assert.throws(()=>parseArkSoloState({...s,projectSupports:[s.projectSupports[0]!,s.projectSupports[0]!]}));
  const without=structuredClone(s),migration=without.played.findIndex(c=>c.key==='224');
  without.hand.push(without.played.splice(migration,1)[0]!);
  assert.throws(()=>parseArkSoloState(without));
});
test('Releasing a pouch animal discards its tucked cards while preserving appeal earned by Pouch',()=>{
  let s=setup(['450','117','223','201']);
  s=act(s,{kind:'TAKE_X',action:'CARDS'});
  const animal=s.hand.find(c=>c.key==='450')!.cardId,tucked=s.hand.find(c=>c.key==='223')!.cardId,project=s.hand.find(c=>c.key==='117')!.cardId;
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:true});
  s=act(s,{kind:'PLAY_ZOO',card:{cardId:animal,housingId:'initial-enclosure'}});
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='POUCH'?{kind:'CARDS',cards:[tucked]}:{kind:'NONE'}});
  }
  s=act(s,{kind:'END_ZOO'});assert.equal(s.appeal,26);assert.equal(s.pouched[animal]!.length,1);
  const x=5-(s.actions.findIndex(c=>c.kind==='ASSOCIATION')+1);
  s=act(s,{kind:'ASSOCIATION',x,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_12',animalId:animal,housingId:'initial-enclosure'}});
  assert.equal(s.appeal,22);assert.equal(Object.hasOwn(s.pouched,animal),false);
  assert.ok(s.discarded.some(c=>c.cardId===animal));assert.ok(s.discarded.some(c=>c.cardId===tucked));
  assert.equal(Object.hasOwn(projectArkSoloGame(s,owner).pouchedCounts,animal),false);
});
test('Breeding sponsor tokens travel through the real project command, restore and private projection',()=>{
  let s=setup(['215','218','404','201']);
  s.played=s.hand.filter(c=>['215','218','404'].includes(c.key));s.hand=s.hand.filter(c=>c.key==='201');
  s.appeal=24;s.extraAppeal=4;s.buildings[1]!.occupied=true;
  const target=s.baseProjects.find(c=>c.key==='103');
  if(!target) {
    const index=s.baseProjectReserve.findIndex(c=>c.key==='103');assert.ok(index>=0);
    [s.baseProjects[0],s.baseProjectReserve[index]]=[s.baseProjectReserve[index]!,s.baseProjects[0]!];
  }
  const project=s.baseProjects.find(c=>c.key==='103')!.cardId,token=s.played.find(c=>c.key==='215')!.cardId;
  s.sponsorTokens[token]=2;s.x=1;
  const command:ArkSoloCommand={kind:'ASSOCIATION',x:1,task:{kind:'PROJECT',cardId:project,slot:2,bonus:'MONEY_12',animalId:null,housingId:null,sponsorTokenIds:[token]}};
  const invalid={...command,task:{...command.task,sponsorTokenIds:[token,token]}},before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,invalid,now,v.parse(TurnIdSchema,'duplicate-token')).ok,false);assert.deepEqual(s,before);
  s=act(s,command);assert.equal(s.sponsorTokens[token],1);assert.equal(projectArkSoloGame(s,owner).sponsorTokens[token],1);
  while(s.pending?.kind==='EFFECT') {
    const job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
  }
  assert.equal(s.conservation,2);assert.equal(s.progress.turnsCompleted,1);assert.equal(s.supportedProjects,1);
});
test('Engineer keeps Build I open for a paid duplicate and completes just one solo turn',()=>{
  let s=setup(['217','223','208','201']);s.played.push(s.hand.splice(0,1)[0]!);
  const place=()=>{const cell=ARK_MAP_A.find(c=>c.bonus===null&&arkPlacementReason(s.buildings,'PAVILION',[{q:c.q,r:c.r}],false)===null);assert.ok(cell);return {building:'PAVILION',anchor:{q:cell.q,r:cell.r},rotation:0 as const,reflected:false};};
  s=act(s,{kind:'BUILD',x:0,placement:place()});
  assert.equal(s.progress.turnsCompleted,0);assert.ok(s.activeBuild);assert.equal(s.money,23);assert.equal(s.appeal,21);
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'FUNDRAISE',x:0},now,v.parse(TurnIdSchema,'unfinished-engineer')).ok,false);assert.deepEqual(s,before);
  s=act(s,{kind:'BUILD_MORE',placement:place()});
  assert.equal(s.money,21);assert.equal(s.appeal,22);assert.equal(s.activeBuild,null);assert.equal(s.progress.turnsCompleted,1);
  assert.equal(s.actions[0]!.kind,'BUILD');assert.equal(s.buildings.filter(b=>b.kind==='PAVILION').length,2);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'BUILD_MORE',placement:place()},now,v.parse(TurnIdSchema,'third-engineer')).ok,false);
});
test('Engineer uses its extra build once in Build II while preserving strength for a different regular building',()=>{
  let s=setup(['217','223','208','201']);s.played.push(s.hand.splice(0,1)[0]!);
  s.actions.find(c=>c.kind==='BUILD')!.upgraded=true;s.upgradeCount=1;s.x=2;
  const place=(building:string)=>{const cell=ARK_MAP_A.find(c=>c.bonus===null&&arkPlacementReason(s.buildings,building,[{q:c.q,r:c.r}],true)===null);assert.ok(cell);return {building,anchor:{q:cell.q,r:cell.r},rotation:0 as const,reflected:false};};
  s=act(s,{kind:'BUILD',x:2,placement:place('PAVILION')});const remaining=s.activeBuild!.remaining;
  s=act(s,{kind:'BUILD_MORE',placement:place('PAVILION')});assert.equal(s.activeBuild!.remaining,remaining);assert.equal(s.activeBuild!.engineerUsed,true);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'BUILD_MORE',placement:place('PAVILION')},now,v.parse(TurnIdSchema,'third-ii')).ok,false);
  s=act(s,{kind:'BUILD_MORE',placement:place('ENCLOSURE_1')});assert.equal(s.activeBuild!.remaining,remaining-1);
  assert.equal(s.money,19);assert.equal(s.progress.turnsCompleted,0);
  assert.throws(()=>parseArkSoloState({...s,activeBuild:{...s.activeBuild,engineerUsed:false}}));
  s=act(s,{kind:'END_BUILD'});assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'BUILD');
});
test('Archaeologist in a real Build action resolves a remote bonus before shifting the action and ending the turn',()=>{
  let s=setup(['221','223','208','201']);s.played.push(s.hand.splice(0,1)[0]!);
  s=act(s,{kind:'BUILD',x:0,placement:{building:'ENCLOSURE_2',anchor:{q:0,r:1},rotation:1,reflected:false}});
  const job=s.effects.frames.at(-1)!.find(j=>j.effect.kind==='ARCHAEOLOGIST')!,cell=ARK_MAP_A.find(c=>c.bonus==='MONEY_5')!;
  assert.ok(job);assert.equal(s.progress.turnsCompleted,0);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'END_BUILD'},now,v.parse(TurnIdSchema,'arch-pending')).ok,false);
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'MAP_BONUS',cell:{q:cell.q,r:cell.r}}});
  while(s.pending?.kind==='EFFECT') {
    const next=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:next.id,selection:next.effect.kind==='UPGRADE'?{kind:'UPGRADE',action:'SPONSORS'}:{kind:'NONE'}});
  }
  assert.equal(s.money,26);assert.equal(s.appeal,20);assert.equal(s.reputation,1);assert.equal(s.x,1);assert.equal(s.progress.turnsCompleted,1);
  assert.equal(s.actions[0]!.kind,'BUILD');assert.ok(!s.buildings.some(b=>b.cells.some(c=>c.q===cell.q&&c.r===cell.r)));
});
test('Diversity Researcher authorizes ordinary terrain construction only while played and survives restore',()=>{
  let s=setup(['219','223','208','201']);
  const command:ArkSoloCommand={kind:'BUILD',x:0,placement:{building:'PAVILION',anchor:{q:2,r:4},rotation:0,reflected:false}},before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,command,now,v.parse(TurnIdSchema,'unplayed-diversity')).ok,false);assert.deepEqual(s,before);
  s.played.push(s.hand.splice(0,1)[0]!);s=act(s,command);
  assert.equal(s.money,23);assert.equal(s.appeal,21);assert.equal(s.progress.turnsCompleted,1);
  assert.deepEqual(s.buildings.at(-1)!.cells,[{q:2,r:4}]);
});
for(const multiplier of [0,1])test(`WAZA plays a paid extra small animal and takes a distant market card (multiplier ${multiplier})`,()=>{
  let s=setup(['228','404','405','201']);s.played.push(s.hand.splice(0,1)[0]!);
  s=act(s,{kind:'BUILD',x:0,placement:{building:'ENCLOSURE_1',anchor:{q:0,r:2},rotation:0,reflected:false}});
  const enclosure=s.buildings.at(-1)!.id;s.actions.find(c=>c.kind==='ANIMALS')!.multiplier=multiplier;
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:false});
  s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='404')!.cardId,housingId:'initial-enclosure'}}));
  const index=s.zooDeck.findIndex(c=>c.key==='450');assert.ok(index>=0);
  [s.zooDeck[index],s.display[5]]=[s.display[5]!,s.zooDeck[index]!];const snap=s.display[5]!.cardId;
  const turns=s.progress.turnsCompleted,row=s.actions.map(c=>c.kind);
  s=act(s,{kind:'END_ZOO'});assert.equal(s.zooWork!.wazaUsed,true);assert.deepEqual(s.actions.map(c=>c.kind),row);
  let job=s.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'WAZA_PLAY');
  const money=s.money;
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ANIMAL',card:{cardId:s.hand.find(c=>c.key==='405')!.cardId,housingId:enclosure}}});
  assert.equal(s.money,money-8);
  while(s.pending?.kind==='EFFECT') {
    job=s.effects.frames.at(-1)![0]!;
    s=act(s,{kind:'EFFECT',choiceId:s.pending.choiceId,effectId:job.id,selection:job.effect.kind==='WAZA_SNAP'?{kind:'CARD',cardId:snap,refill:false}:{kind:'NONE'}});
  }
  assert.ok(s.hand.some(c=>c.cardId===snap));assert.equal(s.display[5],null);assert.equal(s.progress.turnsCompleted,turns);
  assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'PLAY_ZOO',card:{cardId:snap,housingId:null}},now,v.parse(TurnIdSchema,'waza-extra-twice')).ok,false);
  s=act(s,{kind:'END_ZOO'});
  if(multiplier) {assert.equal(s.repeatedAction!.awaiting,true);s=act(s,{kind:'END_REPEAT'});}
  job=s.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'MOVE_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'MOVE',action:'SPONSORS',slot:1}});
  assert.equal(s.progress.turnsCompleted,turns+1);assert.equal(s.zooWork,null);assert.equal(s.appeal,27);
});

for(const completed of [6,26])for(const moneyFirst of [false,true])test(`Predator sponsors, hunting and delayed boost survive repeated Animals at turn ${completed+1}, money-first ${moneyFirst}`,()=>{
  let s=setup(['404','408','239','234']);
  // A boundary fixture with both sponsors already in play; preserve all physical cards.
  for(const key of ['239','234'])s.played.push(s.hand.splice(s.hand.findIndex(c=>c.key===key),1)[0]!);
  let placement:v.InferOutput<typeof ArkPlacementSchema>|undefined;
  for(const cell of ARK_MAP_A)for(const rotation of [0,1,2,3,4,5]) {
    const candidate={building:'ENCLOSURE_3',anchor:{q:cell.q,r:cell.r},rotation,reflected:false};
    if(!placement&&!arkPlacementReason(s.buildings,candidate.building,arkShape(candidate.building,candidate.anchor,rotation,false),false))placement=v.parse(ArkPlacementSchema,candidate);
  }
  assert.ok(placement);s.buildings.push({id:'second-enclosure',kind:'ENCLOSURE_3',cells:arkShape(placement.building,placement.anchor,placement.rotation,false),occupied:false,used:0});
  s.revision=v.parse(GameRevisionSchema,completed+1);
  s.progress=completed===6?{round:1,turnsCompleted:6,turnInRound:6,stage:'ACTION'}:{round:6,turnsCompleted:26,turnInRound:1,stage:'ACTION'};
  if(completed===26){s.donations=[0,1,2,3,4];s.breakStep='COMPLETE';}
  const animalAction=s.actions.splice(s.actions.findIndex(a=>a.kind==='ANIMALS'),1)[0]!;animalAction.multiplier=1;s.actions.splice(1,0,animalAction);
  const originalRow=s.actions.map(a=>a.kind),donations=[...s.donations];
  for(const [key,housing] of [['404','initial-enclosure'],['408','second-enclosure']] as const){
    s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:false});
    s=act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key===key)!.cardId,housingId:housing}});
    assert.equal(s.progress.turnsCompleted,completed);assert.deepEqual(s.donations,donations);
    const payment=s.money;
    if(moneyFirst){const job=s.effects.frames.at(-1)!.find(j=>j.effect.kind==='GAIN'&&j.effect.resource==='MONEY')!;assert.ok(job);
      const command={kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'NONE'}} as const;
      s=act(s,command);assert.equal(s.money,payment+3);
      const before=structuredClone(s);assert.equal(applyArkSoloCommand(s,owner,s.revision,command,now,v.parse(TurnIdSchema,'duplicate-predator-trigger')).ok,false);assert.deepEqual(s,before);
    }
    s=resolve(s);assert.deepEqual(s.actions.map(a=>a.kind),originalRow);
    s=act(s,{kind:'END_ZOO'});
    if(key==='404'){assert.equal(s.repeatedAction?.awaiting,true);assert.equal(s.progress.turnsCompleted,completed);assert.deepEqual(s.actions.map(a=>a.kind),originalRow);}
  }
  assert.equal(s.money,8);assert.equal(s.appeal,30);assert.equal(s.progress.turnsCompleted,completed);
  assert.equal(s.actions[0]!.kind,'ANIMALS');assert.equal(s.effects.frames.flat().filter(j=>j.effect.kind==='MOVE_ACTION').length,1);
  const boost=s.effects.frames.at(-1)![0]!;assert.equal(boost.effect.kind,'MOVE_ACTION');
  const before=structuredClone(s);assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'FUNDRAISE',x:0},now,v.parse(TurnIdSchema,'before-boost')).ok,false);assert.deepEqual(s,before);
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:boost.id,selection:{kind:'MOVE',action:'ASSOCIATION',slot:5}});
  assert.equal(s.progress.turnsCompleted,completed+1);assert.equal(s.actions[4]!.kind,'ASSOCIATION');
  if(completed===6){
    if(s.pending?.kind==='BREAK_DISCARD')s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
    assert.equal(s.progress.stage,'BREAK');assert.equal(s.breakStep,'CARD_INCOME');
    const incomes=s.effects.frames.flat().filter(j=>j.effect.kind==='GAIN'&&j.effect.resource==='MONEY');
    assert.equal(incomes.length,1);assert.deepEqual(incomes[0]!.effect,{kind:'GAIN',resource:'MONEY',amount:6});
    const beforeIncome=s.money;s=resolve(s);assert.equal(s.money,beforeIncome+6);assert.equal(s.progress.round,2);assert.deepEqual(s.donations,[0]);
  }else{
    assert.equal(s.pending?.kind,'FINAL_GOAL');assert.equal(s.money,8);assert.deepEqual(s.donations,donations);
    s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});
    assert.equal(s.phase,'FINISHED');assert.equal(s.result?.appeal,30);assert.equal(s.money,8);
    assert.equal(s.effects.frames.length,0);assert.equal(s.extraActions.length,0);assert.equal(s.repeatedAction,null);
  }
});
for(const completed of [6,26])test(`Determination's repeated X action stays inside the parent Animals turn ${completed+1}`,()=>{
  let s=setup(['485','404','223','201']);s.money=100;s.partners=['Europe'];s.partnerSupply=s.partnerSupply.filter(p=>p!=='Europe');
  s.revision=v.parse(GameRevisionSchema,completed+1);s.progress=completed===6?{round:1,turnsCompleted:6,turnInRound:6,stage:'ACTION'}:{round:6,turnsCompleted:26,turnInRound:1,stage:'ACTION'};
  if(completed===26){s.donations=[0,1,2,3,4];s.breakStep='COMPLETE';}
  s.actions.find(a=>a.kind==='BUILD')!.multiplier=2;
  const animals=s.actions.splice(s.actions.findIndex(a=>a.kind==='ANIMALS'),1)[0]!;s.actions.splice(1,0,animals);
  s=act(s,{kind:'BEGIN_ZOO',action:'ANIMALS',x:0,gainReputation:false});
  s=resolve(act(s,{kind:'PLAY_ZOO',card:{cardId:s.hand.find(c=>c.key==='485')!.cardId,housingId:'initial-enclosure'}}));
  s=act(s,{kind:'END_ZOO'});const job=s.effects.frames.at(-1)![0]!;assert.equal(job.effect.kind,'EXTRA_ACTION');
  s=act(s,{kind:'EFFECT',choiceId:s.pending!.choiceId,effectId:job.id,selection:{kind:'ACTION',action:'TAKE_X'}});
  const row=s.actions.map(a=>a.kind),money=s.money;
  for(let count=1;count<=3;count++){
    s=act(s,{kind:'TAKE_X',action:'BUILD'});assert.equal(s.x,count);
    if(count<3){assert.equal(s.money,money);assert.equal(s.progress.turnsCompleted,completed);assert.equal(s.extraActions.length,1);assert.equal(s.repeatedAction?.awaiting,true);assert.deepEqual(s.actions.map(a=>a.kind),row);
      const before=structuredClone(s);assert.equal(applyArkSoloCommand(s,owner,s.revision,{kind:'FUNDRAISE',x:0},now,v.parse(TurnIdSchema,'wrong-nested-repeat')).ok,false);assert.deepEqual(s,before);}
  }
  assert.equal(s.progress.turnsCompleted,completed+1);assert.equal(s.extraActions.length,0);assert.equal(s.repeatedAction,null);assert.equal(s.actions[0]!.kind,'BUILD');
  if(completed===6){if(s.pending?.kind==='BREAK_DISCARD')s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});assert.equal(s.progress.round,2);assert.deepEqual(s.donations,[0]);}
  else{assert.equal(s.pending?.kind,'FINAL_GOAL');s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});assert.equal(s.phase,'FINISHED');assert.equal(s.money,money);}
});
