import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {PlayerIdSchema,TileIdSchema,type SpeakeasyPracticeAction,type SpeakeasyPracticeView} from '@hangul-rummikub/shared';
import {practiceBusinesses,filterPracticeBusinesses,type PracticeBusinessView} from '../features/speakeasy/practice-business.js';
const me=parse(PlayerIdSchema,'business-me'),other=parse(PlayerIdSchema,'business-other');
const a=parse(TileIdSchema,'business-a'),b=parse(TileIdSchema,'business-b'),c=parse(TileIdSchema,'business-c');
function choice(action:SpeakeasyPracticeAction,slot:0|1=0):SpeakeasyPracticeView['choices'][number] {
  return {action,label:'행동',detail:'미리보기',preview:{targets:[{district:1,slot}],route:[1],delta:{cash:0,safe:0,stock:0,family:0,truckLoad:0}}};
}
function fixture():PracticeBusinessView {
  return {viewerId:me,finished:false,actionsLeft:2,districts:[{id:1,cop:true,slots:[
    {tileId:a,ownerId:me,kind:'SPEAKEASY',protected:false,barrel:true,operating:false},
    {tileId:b,ownerId:me,kind:'SPEAKEASY',protected:true,barrel:true,operating:true},
  ]},{id:2,cop:false,slots:[{tileId:c,ownerId:other,kind:'SPEAKEASY',protected:false,barrel:true,operating:true},null]}],
  choices:[choice({type:'PROTECT',buildingId:a}),choice({type:'SELL',buildingId:b},1),choice({type:'MOVE',district:1}),choice({type:'BUILD',district:1,slot:0,kind:'NIGHTCLUB'})]};
}
test('Business cards separate identical buildings by exact instance and exclude the opponent',()=>{
  const view=fixture(),before=structuredClone(view),cards=practiceBusinesses(view);
  assert.equal(cards.length,2);assert.deepEqual(cards.map(card=>card.slot),[0,1]);
  assert.deepEqual(cards[0]!.choices.map(c=>c.action.type),['PROTECT']);
  assert.deepEqual(cards[1]!.choices.map(c=>c.action.type),['SELL']);
  assert.equal(cards[0]!.canSell,false);assert.equal(cards[1]!.canSell,true);
  assert.deepEqual(view,before);
});
test('Closed, unprotected and sellable filters use independent server states',()=>{
  const cards=practiceBusinesses(fixture());
  assert.equal(filterPracticeBusinesses(cards,'CLOSED')[0]!.building.tileId,a);
  assert.equal(filterPracticeBusinesses(cards,'UNPROTECTED')[0]!.building.tileId,a);
  assert.equal(filterPracticeBusinesses(cards,'SELL')[0]!.building.tileId,b);
  assert.equal(filterPracticeBusinesses(cards,'ALL').length,2);
  const view=fixture();view.choices=[];
  assert.equal(filterPracticeBusinesses(practiceBusinesses(view),'SELL').length,0,'A barrel alone must not invent sale permission');
});
test('No executable business shortcuts remain after actions are exhausted or the game ends',()=>{
  for(const update of [{actionsLeft:0},{finished:true}]){
    const cards=practiceBusinesses({...fixture(),...update});
    assert.ok(cards.every(card=>card.choices.length===0&&!card.canSell));
    assert.equal(cards.length,2);
  }
});
test('Production attaches only to its exact server target, not another building in the same district',()=>{
  const view=fixture();view.districts[0]!.slots[0]!.kind='STILLS';
  view.choices=[choice({type:'PRODUCE'})];
  const cards=practiceBusinesses(view);
  assert.equal(cards[0]!.choices[0]!.action.type,'PRODUCE');assert.equal(cards[1]!.choices.length,0);
});
test('Protecting a closed building updates status and removes its old shortcut on the next projection',()=>{
  const view=fixture();assert.equal(filterPracticeBusinesses(practiceBusinesses(view),'CLOSED').length,1);
  view.districts[0]!.slots[0]!.protected=true;view.districts[0]!.slots[0]!.operating=true;
  view.choices=[choice({type:'SELL',buildingId:a})];
  const cards=practiceBusinesses(view);
  assert.equal(filterPracticeBusinesses(cards,'CLOSED').length,0);
  assert.equal(filterPracticeBusinesses(cards,'UNPROTECTED').length,0);
  assert.equal(cards[0]!.choices[0]!.action.type,'SELL');
});
