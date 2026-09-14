import test from 'node:test';
import assert from 'node:assert/strict';
import { beginArkCardReveal, resolveArkCardReveal, tradeArkHandCards, ArkCardRevealSchema, type ArkCardEffectZones } from '../../games/ark-nova/domain/card-effect-choices.js';
import * as v from 'valibot';
const card=(key:string)=>({key,cardId:`hidden-${key}`});
const zones=():ArkCardEffectZones=>({hand:[card('401')],zooDeck:[card('201'),card('402'),card('101'),card('403'),card('404')],discarded:[card('205'),card('405'),card('206')],display:[null,null,null,null,null,null],cardReveal:null});
const random={nextInt:(max:number)=>max-1};
function inventory(s:ArkCardEffectZones):string[] {return [...s.hand,...s.zooDeck,...s.discarded,...s.display.filter(c=>c!==null),...(s.cardReveal?.candidates??[])].map(c=>c.cardId).sort();}
test('Hunter isolates drawn cards until a legal animal choice, preserves inventory, and rejects foreign IDs',()=>{
  const s=zones(),before=structuredClone(s),start=beginArkCardReveal(s,{kind:'HUNTER',amount:3},'hunt',random);assert.ok(start.ok);
  assert.deepEqual(s,before);assert.deepEqual(inventory(start.state),inventory(s));assert.equal(start.state.hand.length,1);assert.equal(start.state.zooDeck.length,2);
  for(const keep of [['hidden-201'],['hidden-403'],[],['hidden-402','hidden-402']])assert.equal(resolveArkCardReveal(start.state,{choiceId:'hunt',keep}).ok,false);
  const resolved=resolveArkCardReveal(start.state,{choiceId:'hunt',keep:['hidden-402']});assert.ok(resolved.ok);
  assert.deepEqual(resolved.state.hand.map(c=>c.key),['401','402']);assert.equal(resolved.state.cardReveal,null);assert.deepEqual(inventory(resolved.state),inventory(s));
  assert.equal(resolveArkCardReveal(resolved.state,{choiceId:'hunt',keep:['hidden-402']}).ok,false);
});
test('Perception selects exactly the permitted cards across JSON storage and leaves no revealed cards orphaned',()=>{
  const start=beginArkCardReveal(zones(),{kind:'PERCEPTION',amount:4,keep:2},'perception',random);assert.ok(start.ok);
  start.state.cardReveal=v.parse(ArkCardRevealSchema,JSON.parse(JSON.stringify(start.state.cardReveal)));
  assert.equal(resolveArkCardReveal(start.state,{choiceId:'wrong',keep:['hidden-201','hidden-402']}).ok,false);
  const result=resolveArkCardReveal(start.state,{choiceId:'perception',keep:['hidden-201','hidden-403']});assert.ok(result.ok);
  assert.deepEqual(result.state.hand.map(c=>c.key),['401','201','403']);assert.deepEqual(inventory(result.state),inventory(zones()));
});
test('Hunter without an animal discards the revealed cards and completes without an impossible choice',()=>{
  const s=zones();s.zooDeck=[card('201'),card('101')];const result=beginArkCardReveal(s,{kind:'HUNTER',amount:4},'none',random);assert.ok(result.ok);
  assert.equal(result.state.cardReveal,null);assert.equal(result.state.zooDeck.length,0);assert.equal(result.state.hand.length,1);assert.deepEqual(inventory(result.state),inventory(s));
});
test('Scavenging uses injected randomness once when opening, and cannot redraw while selection is pending',()=>{
  let calls=0;const rng={nextInt:()=>{calls++;return 0;}};
  const s=zones(),start=beginArkCardReveal(s,{kind:'SCAVENGING',amount:2},'scavenge',rng);assert.ok(start.ok);assert.equal(calls,2);
  assert.deepEqual(start.state.zooDeck,s.zooDeck);assert.deepEqual(start.state.cardReveal!.candidates.map(c=>c.key),['405','206']);
  assert.equal(beginArkCardReveal(start.state,{kind:'SCAVENGING',amount:2},'again',rng).ok,false);assert.equal(calls,2);
  const result=resolveArkCardReveal(start.state,{choiceId:'scavenge',keep:['hidden-206']});assert.ok(result.ok);assert.deepEqual(inventory(result.state),inventory(s));
});
test('Sunbathing and Pouch keep separate card zones, pay per selected card, and do not accept played or duplicate cards',()=>{
  const s={...zones(),money:5,appeal:20,played:[{key:'425',cardId:'constructor'}],pouched:{}};
  const before=structuredClone(s);
  const pouch=tradeArkHandCards(s,'POUCH',1,'constructor',{cards:['hidden-401']});assert.ok(pouch.ok);
  assert.equal(pouch.state.appeal,22);assert.equal(pouch.state.money,5);assert.equal(pouch.state.hand.length,0);assert.equal(Object.hasOwn(pouch.state.pouched,'constructor'),true);
  const sold=tradeArkHandCards(s,'SUNBATHING',2,'constructor',{cards:['hidden-401']});assert.ok(sold.ok);assert.equal(sold.state.money,9);assert.equal(sold.state.appeal,20);
  for(const cards of [['constructor'],['hidden-401','hidden-401']])assert.equal(tradeArkHandCards(s,'POUCH',2,'constructor',{cards}).ok,false);
  assert.deepEqual(s,before);
});
