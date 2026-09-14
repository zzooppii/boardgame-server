import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_CARDS } from '@hangul-rummikub/shared';
import { planArkAnimalEffects, evaluateArkEffectAmount } from '../../games/ark-nova/domain/animal-effects.js';
const plan=(key:string)=>planArkAnimalEffects(ARK_CARDS.find(c=>c.key===key)!);
test('Every base animal has an explicit solo effect plan without silently dropping unknown abilities',()=>{
  const animals=ARK_CARDS.filter(c=>c.kind==='ANIMAL');assert.equal(animals.length,128);
  for (const card of animals) assert.doesNotThrow(()=>planArkAnimalEffects(card),card.key);
  assert.throws(()=>planArkAnimalEffects({...animals[0]!,abilities:[{key:'UNKNOWN',value:1,tag:''}]}));
});
test('All eleven interactive base animals replace their multiplayer ability with their printed solo panel',()=>{
  const immediate:Record<string,unknown>={449:{kind:'GAIN',resource:'X',amount:1},456:{kind:'DRAW',amount:1},458:{kind:'DRAW',amount:2},463:{kind:'DRAW',amount:1},470:{kind:'GAIN',resource:'X',amount:2},492:{kind:'GAIN',resource:'X',amount:2}};
  for (const [key,effect] of Object.entries(immediate)) assert.deepEqual(plan(key).immediate.at(-1),effect);
  for (const key of ['474','482','483']) assert.deepEqual(plan(key).afterFinishing,[{kind:'MOVE_ACTION',action:null,slots:[1]}]);
  for (const key of ['475','485']) assert.deepEqual(plan(key).afterFinishing,[{kind:'EXTRA_ACTION',action:null}]);
});
test('Card ability amounts resolve from current icons and after-finishing effects stay separate',()=>{
  const pack=plan('402').immediate.find(e=>e.kind==='GAIN'&&typeof e.amount!=='number');assert.ok(pack?.kind==='GAIN');
  assert.equal(evaluateArkEffectAmount(pack.amount,{Predator:1}),1);assert.equal(evaluateArkEffectAmount(pack.amount,{Predator:4}),4);
  assert.deepEqual(plan('408').afterFinishing,[{kind:'MOVE_ACTION',action:'ASSOCIATION',slots:[1,5]}]);
  assert.deepEqual(plan('409').afterFinishing,[{kind:'EXTRA_ACTION',action:'ASSOCIATION'}]);
  const inventive=plan('464').immediate.at(-1);assert.ok(inventive?.kind==='GAIN');
  assert.equal(evaluateArkEffectAmount(inventive.amount,{Primate:4}),2);assert.equal(evaluateArkEffectAmount(inventive.amount,{Primate:9}),3);
});
