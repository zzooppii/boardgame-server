import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_ACTIONS, ARK_MAP_A, arkPlacementReason, arkInitialBuildings } from '@hangul-rummikub/shared';
import { createArkEffectQueue, selectArkEffect } from '../../games/ark-nova/domain/effect-queue.js';
import { resolveArkEffect } from '../../games/ark-nova/domain/resolve-effect.js';
import { beginArkWazaBonus, cancelArkZooWork, beginArkZooWork, playNextArkZooCard, endArkZooWork, completeArkZooWork, type ArkZooWorkState } from '../../games/ark-nova/domain/zoo-card-work.js';
const card=(key:string)=>({key,cardId:`card-${key}`});
function board():ArkZooWorkState {return {effects:createArkEffectQueue(),zooWork:null,supportedProjects:0,played:[],pouched:{},sponsorTokens:{},cardReveal:null,goalDeck:[],goalReveal:null,baseProjectReserve:[],
  zooDeck:[card('201'),card('405')],hand:[card('404')],discarded:[],display:Array.from({length:6},()=>null),buildings:arkInitialBuildings(),
  actions:ARK_ACTIONS.map(kind=>({kind,upgraded:false,venom:false,constriction:false,multiplier:0})),partners:[],universities:[],partnerSupply:[],universitySupply:[],
  goals:[card('001'),card('002')],discardedGoals:[],money:40,appeal:20,conservation:0,reputation:1,x:2,workers:1,wazaFocus:null,conservationBonuses:[]};}
function begin(s:ArkZooWorkState,action:'ANIMALS'|'SPONSORS',x=0):ArkZooWorkState {const result=beginArkZooWork(s,{action,x});assert.ok(result.ok);return result.state;}
function play(s:ArkZooWorkState,key:string,housingId:string|null):ArkZooWorkState {const result=playNextArkZooCard(s,{cardId:`card-${key}`,housingId});assert.ok(result.ok);return result.state;}
function effect(s:ArkZooWorkState,kind:string,input:unknown):ArkZooWorkState {
  if(!s.effects.active) {
    const job=s.effects.frames.at(-1)!.find(j=>j.effect.kind===kind)!;assert.ok(job,kind);
    const selection=selectArkEffect(s.effects,job.id);assert.ok(selection.ok);s={...s,effects:selection.queue};
  }
  const result=resolveArkEffect(s,s.effects.active!.id,input,'private-choice',{nextInt:()=>0});assert.ok(result.ok);return result.state;
}
test('WAZA does not trigger for an empty action or an action containing a medium animal',()=>{
  const original=board();original.played=[card('228')];original.hand=[card('408')];
  let s=begin(original,'ANIMALS');assert.equal(beginArkWazaBonus(s),null);
  s=play(s,'408','initial-enclosure');s=effect(s,'GAIN',{kind:'NONE'});
  assert.equal(s.zooWork!.onlySmall,false);assert.equal(beginArkWazaBonus(s),null);
});
test('Animals action pays, hunts, plays the drawn animal, shifts once, then resolves Clever before completion',()=>{
  const original=board();
  const anchor=ARK_MAP_A.find(c=>arkPlacementReason(original.buildings,'ENCLOSURE_1',[c],false)===null)!;assert.ok(anchor);
  original.buildings.push({id:'second-house',kind:'ENCLOSURE_1',cells:[{q:anchor.q,r:anchor.r}],occupied:false,used:0});
  let s=begin(original,'ANIMALS',2);assert.equal(s.x,0);assert.equal(s.zooWork?.remaining,2);
  s=play(s,'404',s.buildings.find(b=>b.kind==='ENCLOSURE_3')!.id);assert.equal(s.money,31);
  assert.equal(endArkZooWork(s).ok,false);assert.equal(playNextArkZooCard(s,{cardId:'card-405',housingId:'second-house'}).ok,false);
  s=effect(s,'HUNTER',{kind:'NONE'});assert.ok(s.cardReveal);assert.equal(s.effects.active?.effect.kind,'HUNTER');
  s=JSON.parse(JSON.stringify(s));s=effect(s,'HUNTER',{kind:'KEEP',choiceId:'private-choice',keep:['card-405']});
  s=effect(s,'GAIN',{kind:'NONE'});assert.equal(s.appeal,24);
  s=play(s,'405','second-house');s=effect(s,'GAIN',{kind:'NONE'});assert.equal(s.appeal,27);assert.equal(s.money,23);
  assert.equal(s.actions[2]?.kind,'ANIMALS');assert.equal(s.effects.afterFinishing.length,1);
  const ended=endArkZooWork(s);assert.ok(ended.ok);s=ended.state;assert.equal(s.actions[0]?.kind,'ANIMALS');assert.equal(completeArkZooWork(s).ok,false);
  s=effect(s,'MOVE_ACTION',{kind:'MOVE',action:'BUILD',slot:1});assert.equal(s.actions[0]?.kind,'BUILD');
  const completed=completeArkZooWork(s);assert.ok(completed.ok);assert.equal(completed.state.zooWork,null);assert.equal(endArkZooWork(completed.state).ok,false);
  assert.equal(original.money,40);assert.equal(original.hand.length,1);assert.equal(original.buildings.find(b=>b.kind==='ENCLOSURE_3')!.occupied,false);
});
test('Sponsors II spends a frozen level budget and triggers existing sponsors on both science icons',()=>{
  const initial=board();initial.actions.find(a=>a.kind==='SPONSORS')!.upgraded=true;initial.played=[card('208')];initial.hand=[card('223'),card('201')];
  let s=begin(initial,'SPONSORS');assert.equal(s.zooWork?.remaining,6);
  s=play(s,'223',null);assert.equal(s.zooWork?.remaining,3);assert.equal(s.money,40);
  s=effect(s,'GAIN',{kind:'NONE'});assert.equal(s.money,44);
  assert.equal(playNextArkZooCard(s,{cardId:'card-201',housingId:null}).ok,false); // Level 4 exceeds the remaining 3.
  const ended=endArkZooWork(s);assert.ok(ended.ok);assert.ok(completeArkZooWork(ended.state).ok);
});
test('Animal II reputation resolves before the first card, may be declined, and upgrades do not change the active side',()=>{
  const initial=board();initial.actions.find(a=>a.kind==='ANIMALS')!.upgraded=true;initial.reputation=4;
  let s=begin(initial,'ANIMALS',2);
  assert.equal(playNextArkZooCard(s,{cardId:'card-404',housingId:s.buildings[0]!.id}).ok,false);
  s=effect(s,'GAIN',{kind:'NONE'});assert.equal(s.reputation,5);assert.equal(s.effects.frames[0]![0]!.effect.kind,'UPGRADE');
  s=effect(s,'UPGRADE',{kind:'UPGRADE',action:'BUILD'});assert.equal(s.zooWork?.remaining,2);
  const declined=beginArkZooWork(initial,{action:'ANIMALS',x:2,gainReputation:false});assert.ok(declined.ok);assert.equal(declined.state.effects.frames.length,0);
  let sponsors=begin(board(),'SPONSORS');sponsors.hand=[card('223'),card('208')];sponsors=play(sponsors,'223',null);
  sponsors.actions.find(a=>a.kind==='SPONSORS')!.upgraded=true;
  assert.equal(playNextArkZooCard(sponsors,{cardId:'card-208',housingId:null}).ok,false);
});

test('Cancel pristine zoo selection refunds X and preserves cards, board, resources and action order',()=>{
 const initial=board(),started=begin(initial,'ANIMALS',2),before=structuredClone(started);
 const result=cancelArkZooWork(started);assert.ok(result.ok);assert.deepEqual(result.state,initial);assert.deepEqual(started,before);
 assert.equal(cancelArkZooWork(result.state).ok,false);
 const played=play(started,'404','initial-enclosure');assert.equal(cancelArkZooWork(played).ok,false);
});
test('Zoo cancellation cannot refund after reputation, reveal, or a legacy session',()=>{
 const initial=board();initial.actions.find(a=>a.kind==='ANIMALS')!.upgraded=true;
 const started=begin(initial,'ANIMALS',2);assert.equal(cancelArkZooWork(started).ok,false);
 const declined=beginArkZooWork(initial,{action:'ANIMALS',x:2,gainReputation:false});assert.ok(declined.ok);assert.ok(cancelArkZooWork(declined.state).ok);
 const legacy=begin(board(),'ANIMALS');delete legacy.zooWork!.cancelX;assert.equal(cancelArkZooWork(legacy).ok,false);
});
