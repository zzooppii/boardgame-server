import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { ARK_MAP_A, arkInitialBuildings, ARK_ACTIONS, ARK_CARDS } from '@hangul-rummikub/shared';
import { createArkEffectQueue, enqueueArkEffects, selectArkEffect, completeArkEffect, beginArkAfterFinishing, ArkEffectQueueSchema, ArkZooEffectSchema } from '../../games/ark-nova/domain/effect-queue.js';
import { validateArkUniqueConstruction } from '../../games/ark-nova/domain/unique-construction.js';
import { arkCardDefinition } from '../../games/ark-nova/domain/zoo-icons.js';
import { planArkAnimalEffects, type ArkZooEffect } from '../../games/ark-nova/domain/animal-effects.js';
import { resolveArkEffect, type ArkEffectState } from '../../games/ark-nova/domain/resolve-effect.js';
const gain:ArkZooEffect={kind:'GAIN',resource:'MONEY',amount:3};
const event=(effect:ArkZooEffect)=>({sourceId:'source',effect,timing:'IMMEDIATE' as const});
const card=(key:string)=>({key,cardId:`card-${key}`});
function board():ArkEffectState {return {effects:createArkEffectQueue(),buildings:arkInitialBuildings(),played:[],pouched:{},sponsorTokens:{},supportedProjects:0,cardReveal:null,goalDeck:[],goalReveal:null,baseProjectReserve:[],
  zooDeck:[],hand:[],discarded:[],display:Array.from({length:6},()=>null),
  actions:ARK_ACTIONS.map(kind=>({kind,upgraded:false,venom:false,constriction:false,multiplier:0})),partners:[],universities:[],partnerSupply:[],universitySupply:[],
  goals:[card('001'),card('002')],discardedGoals:[],money:25,appeal:20,conservation:0,reputation:1,x:0,workers:1,wazaFocus:null,conservationBonuses:[]};}
function start(s:ArkEffectState,effect:ArkZooEffect):ArkEffectState {
  const effects=enqueueArkEffects(s.effects,[event(effect)]),selected=selectArkEffect(effects,effects.frames.at(-1)![0]!.id);assert.ok(selected.ok);return {...s,effects:selected.queue};
}
function resolve(s:ArkEffectState,input:unknown) {
  const result=resolveArkEffect(s,s.effects.active!.id,input,'choice',{nextInt:()=>0});assert.ok(result.ok);return result.state;
}
test('Nested effect rewards block siblings; after-finishing effects wait for the explicit action boundary',()=>{
  let q=enqueueArkEffects(createArkEffectQueue(),[event(gain),event(gain),{...event({kind:'MOVE_ACTION',action:null,slots:[1]}),timing:'AFTER_FINISHING'}]);
  const original=structuredClone(q);let selected=selectArkEffect(q,2);assert.ok(selected.ok);q=selected.queue;
  assert.deepEqual(original.frames[0]!.map(j=>j.id),[1,2]);assert.equal(selectArkEffect(q,1).ok,false);assert.throws(()=>beginArkAfterFinishing(q));
  q=completeArkEffect(q,2,[event(gain)]);
  assert.equal(selectArkEffect(q,1).ok,false);selected=selectArkEffect(q,4);assert.ok(selected.ok);
  q=completeArkEffect(selected.queue,4);selected=selectArkEffect(q,1);assert.ok(selected.ok);q=completeArkEffect(selected.queue,1);
  assert.equal(selectArkEffect(q,3).ok,false);q=beginArkAfterFinishing(q);assert.equal(selectArkEffect(q,3).ok,true);
  assert.throws(()=>beginArkAfterFinishing(q));assert.deepEqual(v.parse(ArkEffectQueueSchema,JSON.parse(JSON.stringify(q))),q);
  assert.equal(v.safeParse(ArkEffectQueueSchema,{...q,nextId:3}).success,false);
});
test('Every planned base animal job validates as an executable save record and unknown jobs reject',()=>{
  for(const card of ARK_CARDS.filter(c=>c.kind==='ANIMAL')) {
    const plan=planArkAnimalEffects(card);
    for(const effect of [...plan.immediate,...plan.afterFinishing])assert.equal(v.safeParse(ArkZooEffectSchema,effect).success,true,card.key);
  }
  assert.equal(v.safeParse(ArkZooEffectSchema,{kind:'GAIN',resource:'MONEY',amount:-1}).success,false);
  assert.equal(v.safeParse(ArkZooEffectSchema,{kind:'NEW_UNIMPLEMENTED_EFFECT'}).success,false);
});
test('A revealed hunter remains the active effect through save/restore and cannot be replayed or bypassed',()=>{
  let s=board();s.zooDeck=[card('201'),card('404'),card('405')];s=start(s,{kind:'HUNTER',amount:3});
  s=resolve(s,{kind:'NONE'});assert.equal(s.cardReveal?.keep,1);assert.ok(s.effects.active);
  s=JSON.parse(JSON.stringify(s));const before=structuredClone(s);
  assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'KEEP',choiceId:'choice',keep:['card-201']},'next',{nextInt:()=>0}).ok,false);assert.deepEqual(s,before);
  s=resolve(s,{kind:'KEEP',choiceId:'choice',keep:['card-404']});assert.equal(s.effects.active,null);assert.equal(s.cardReveal,null);assert.deepEqual(s.hand,[card('404')]);assert.equal(s.discarded.length,2);
  assert.equal(resolveArkEffect(s,1,{kind:'NONE'},'next',{nextInt:()=>0}).ok,false);
});
test('Conservation advancement queues each crossed milestone once; a chosen tile executes before sibling rewards',()=>{
  let s=board();s.conservationBonuses=[{track:5,tile:'MONEY_10'}];s=start(s,{kind:'GAIN',resource:'CONSERVATION',amount:10});
  s=resolve(s,{kind:'NONE'});assert.equal(s.conservation,10);
  assert.deepEqual(s.effects.frames[0]!.map(j=>j.effect.kind),['UPGRADE_OR_WORKER','CONSERVATION_BONUS','CONSERVATION_BONUS','DISCARD_GOAL']);
  const selected=selectArkEffect(s.effects,3);assert.ok(selected.ok);s.effects=selected.queue;
  s=resolve(s,{kind:'BONUS',tile:'MONEY_10'});assert.equal(s.conservationBonuses.length,0);assert.equal(selectArkEffect(s.effects,2).ok,false);
  const money=selectArkEffect(s.effects,6);assert.ok(money.ok);s.effects=money.queue;s=resolve(s,{kind:'NONE'});assert.equal(s.money,35);
});
test('Reputation caps and dynamic icons are evaluated when chosen, and unsupported effects remain pending',()=>{
  let s=board();s.played=[card('401')];s=start(s,{kind:'GAIN',resource:'APPEAL',amount:{kind:'ICONS',tag:'Predator',factor:1,cap:8}});
  s=resolve(s,{kind:'NONE'});assert.equal(s.appeal,22);
  s.reputation=8;s=start(s,{kind:'GAIN',resource:'REPUTATION',amount:10});s=resolve(s,{kind:'NONE'});assert.equal(s.reputation,9);assert.equal(s.appeal,22);
  s=start(s,{kind:'EXTRA_ACTION',action:null});const before=structuredClone(s);
  assert.deepEqual(resolveArkEffect(s,s.effects.active!.id,{kind:'NONE'},'next',{nextInt:()=>0}),{ok:false,reason:'UNSUPPORTED_EFFECT'});assert.deepEqual(s,before);
});
test('Two-card snapping allows the owner to choose whether to replenish between cards',()=>{
  const run=(refill:boolean)=>{
    let s=board();s.display=[card('401'),card('402'),card('403'),card('404'),card('405'),card('406')];s.zooDeck=[card('407')];s=start(s,{kind:'SNAP',amount:2,mayRefillBetween:true});
    s=resolve(s,{kind:'CARD',cardId:'card-401',refill});return s;
  };
  assert.equal(run(false).display[0],null);assert.equal(run(false).zooDeck.length,1);
  assert.equal(run(true).display[0]?.key,'402');assert.equal(run(true).display[5]?.key,'407');
});
test('Digging resolves one card at a time, replenishes discarded market cards immediately and permits stopping',()=>{
  let s=board();s.hand=[card('401')];s.display[0]=card('402');s.zooDeck=[card('403'),card('404')];s=start(s,{kind:'DIGGING',amount:3});
  s=resolve(s,{kind:'DIG',zone:'DISPLAY',cardId:'card-402'});assert.deepEqual(s.display.slice(0,2),[card('403'),card('404')]);assert.deepEqual(s.discarded,[card('402')]);
  const next=selectArkEffect(s.effects,s.effects.frames.at(-1)![0]!.id);assert.ok(next.ok);s.effects=next.queue;const before=structuredClone(s);
  assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'DIG',zone:'HAND',cardId:'foreign'},'next',{nextInt:()=>0}).ok,false);assert.deepEqual(s,before);
  s=resolve(s,{kind:'SKIP'});assert.equal(s.effects.frames.length,0);assert.deepEqual(s.hand,[card('401')]);
});
test('Sponsor Magnet takes every sponsor without reputation limits and preserves animal/project slots until turn end',()=>{
  let s=board();s.display=[card('201'),card('404'),card('116'),null,card('223'),card('264')];s=start(s,{kind:'SPONSOR_MAGNET'});
  s=resolve(s,{kind:'NONE'});assert.deepEqual(s.hand,[card('201'),card('223'),card('264')]);assert.deepEqual(s.display,[null,card('404'),card('116'),null,null,null]);
});
test('Free university consumes the board supply and triggers both research icons without spending an action or staff',()=>{
  let s=board();s.played=[card('208')];s.universitySupply=['RESEARCH_2','HAND_LIMIT','RESEARCH_REPUTATION'];s=start(s,{kind:'FREE_UNIVERSITY'});
  const original=structuredClone(s);s=resolve(s,{kind:'UNIVERSITY',university:'RESEARCH_2'});
  assert.deepEqual(s.universities,['RESEARCH_2']);assert.equal(s.universitySupply.includes('RESEARCH_2'),false);assert.deepEqual(s.actions,original.actions);assert.equal(s.workers,original.workers);assert.equal(s.money,25);
  const reward=s.effects.frames.at(-1)![0]!;assert.deepEqual(reward.effect,{kind:'GAIN',resource:'MONEY',amount:4});
  const selected=selectArkEffect(s.effects,reward.id);assert.ok(selected.ok);s.effects=selected.queue;s=resolve(s,{kind:'NONE'});assert.equal(s.money,29);
});
test('Free partner obeys the Association II slot restriction, emits the third-slot worker and keeps Africa movement deferred',()=>{
  let s=board();s.partners=['Asia','Europe'];s.partnerSupply=['Africa','Americas','Australia'];s.played=[card('214')];s=start(s,{kind:'FREE_PARTNER'});const before=structuredClone(s);
  assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'PARTNER',continent:'Africa'},'third',{nextInt:()=>0}).ok,false);assert.deepEqual(s,before);
  s.actions.find(a=>a.kind==='ASSOCIATION')!.upgraded=true;s=resolve(s,{kind:'PARTNER',continent:'Africa'});
  assert.deepEqual(s.partners,['Asia','Europe','Africa']);assert.equal(s.effects.frames.at(-1)![0]!.effect.kind,'GAIN');
  assert.equal(s.effects.afterFinishing.length,1);assert.equal(s.effects.afterFinishing[0]!.effect.kind,'MOVE_ACTION');assert.equal(s.workers,1);
  const gain=selectArkEffect(s.effects,s.effects.frames.at(-1)![0]!.id);assert.ok(gain.ok);s.effects=gain.queue;s=resolve(s,{kind:'NONE'});assert.equal(s.workers,2);
});
test('Free university applies printed reputation and slot upgrade, and rejects a duplicate or wrong kind of choice atomically',()=>{
  let s=board();s.universities=['RESEARCH_2'];s.universitySupply=['HAND_LIMIT','RESEARCH_REPUTATION'];s=start(s,{kind:'FREE_UNIVERSITY'});const before=structuredClone(s);
  for(const choice of [{kind:'UNIVERSITY',university:'RESEARCH_2'},{kind:'PARTNER',continent:'Asia'},{kind:'NONE'}])assert.equal(resolveArkEffect(s,s.effects.active!.id,choice,'uni',{nextInt:()=>0}).ok,false);
  assert.deepEqual(s,before);s=resolve(s,{kind:'UNIVERSITY',university:'HAND_LIMIT'});
  assert.deepEqual(s.effects.frames.at(-1)!.map(j=>j.effect),[{kind:'GAIN',resource:'REPUTATION',amount:1},{kind:'UPGRADE'}]);
  let unavailable=board();unavailable=start(unavailable,{kind:'FREE_UNIVERSITY'});assert.equal(resolve(unavailable,{kind:'NONE'}).effects.active,null);
});
test('Paid sponsor bonus pays the printed level up front, triggers research and leaves the action row untouched',()=>{
  let s=board();s.played=[card('208')];s.hand=[card('223')];s=start(s,{kind:'PAID_SPONSOR',usesSponsorToken:false});const before=structuredClone(s);
  s=resolve(s,{kind:'SPONSOR',card:{cardId:'card-223',housingId:null}});
  assert.equal(s.money,22);assert.deepEqual(s.actions,before.actions);assert.equal(s.hand.length,0);assert.equal(s.played.length,2);
  const trigger=s.effects.frames.at(-1)![0]!;assert.deepEqual(trigger.effect,{kind:'GAIN',resource:'MONEY',amount:4});
  const selected=selectArkEffect(s.effects,trigger.id);assert.ok(selected.ok);s.effects=selected.queue;s=resolve(s,{kind:'NONE'});assert.equal(s.money,26);assert.deepEqual(before.hand,[card('223')]);
});
test('Paid sponsor cannot borrow its future rewards, play from the display, ignore prerequisites or play an animal',()=>{
  for(const scenario of ['poor','display','condition','animal']) {
    let s=board();s.played=[card('208')];s.hand=[card(scenario==='condition'?'201':scenario==='animal'?'404':'223')];
    if(scenario==='poor')s.money=2;
    if(scenario==='display'){s.display[0]=s.hand.pop()!;s.actions.find(c=>c.kind==='SPONSORS')!.upgraded=true;}
    s=start(s,{kind:'PAID_SPONSOR',usesSponsorToken:false});const before=structuredClone(s),target=(s.hand[0]??s.display[0])!;
    assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'SPONSOR',card:{cardId:target.cardId,housingId:null}},'paid',{nextInt:()=>0}).ok,false,scenario);assert.deepEqual(s,before);
  }
});
test('Okapi Stable spends a sponsor token only on successful paid entry and exhausted tokens cannot be reused',()=>{
  let s=board();const source={key:'253',cardId:'source'};s.played=[source];s.hand=[card('223')];s.sponsorTokens.source=1;
  let placed=false;
  for(const anchor of ARK_MAP_A)for(const rotation of [0,1,2,3,4,5]) {
    if(placed)continue;
    const result=validateArkUniqueConstruction(s.buildings,arkCardDefinition(source),false,false,{anchor:{q:anchor.q,r:anchor.r},rotation});
    if(result.ok){s.buildings.push({...result.building,id:'unique:source'});placed=true;}
  }
  assert.ok(placed);s=start(s,{kind:'PAID_SPONSOR',usesSponsorToken:true});
  const invalid=resolveArkEffect(s,s.effects.active!.id,{kind:'SPONSOR',card:{cardId:'foreign',housingId:null}},'bad',{nextInt:()=>0});assert.equal(invalid.ok,false);assert.equal(s.sponsorTokens.source,1);
  s=resolve(s,{kind:'SPONSOR',card:{cardId:'card-223',housingId:null}});assert.equal(s.sponsorTokens.source,0);
  s.hand=[card('208')];s=start(s,{kind:'PAID_SPONSOR',usesSponsorToken:true});
  assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'SPONSOR',card:{cardId:'card-208',housingId:null}},'empty',{nextInt:()=>0}).ok,false);
  const skipped=resolve(s,{kind:'SKIP'});assert.equal(skipped.money,s.money);assert.equal(skipped.sponsorTokens.source,0);
  const bonus=start(skipped,{kind:'PAID_SPONSOR',usesSponsorToken:false});
  const paid=resolve(bonus,{kind:'SPONSOR',card:{cardId:'card-208',housingId:null}});assert.equal(paid.sponsorTokens.source,0);
});
test('Multiplier effects place repeatable tokens on the named card; the bonus tile may choose Animals',()=>{
  let s=start(board(),{kind:'MULTIPLIER',action:'SPONSORS'});
  assert.equal(resolveArkEffect(s,s.effects.active!.id,{kind:'MULTIPLIER',action:'BUILD'},'bad',{nextInt:()=>0}).ok,false);
  const row=structuredClone(s.actions);s=resolve(s,{kind:'MULTIPLIER',action:'SPONSORS'});
  assert.equal(s.actions.find(c=>c.kind==='SPONSORS')!.multiplier,1);assert.deepEqual(s.actions.map(c=>c.kind),row.map(c=>c.kind));
  s=resolve(start(s,{kind:'MULTIPLIER',action:'SPONSORS'}),{kind:'MULTIPLIER',action:'SPONSORS'});
  assert.equal(s.actions.find(c=>c.kind==='SPONSORS')!.multiplier,2);
  s=resolve(start(s,{kind:'MULTIPLIER',action:null}),{kind:'MULTIPLIER',action:'ANIMALS'});
  assert.equal(s.actions.find(c=>c.kind==='ANIMALS')!.multiplier,1);
});
