import test from 'node:test';
import assert from 'node:assert/strict';
import { arkInitialBuildings, ARK_ACTIONS, type ArkCard } from '@hangul-rummikub/shared';
import { arkZooIcons, arkCardDefinition } from '../../games/ark-nova/domain/zoo-icons.js';
import { arkMissingCardConditions, arkAnimalPrice } from '../../games/ark-nova/domain/card-requirements.js';
import { playArkZooCard, type ArkCardPlayState } from '../../games/ark-nova/domain/card-play.js';
import { arkProjectEligibility, releaseArkProjectAnimal } from '../../games/ark-nova/domain/project-requirements.js';
const card=(key:string):ArkCard=>({key,cardId:`card-${key}`});
const arkCard=(key:string)=>arkCardDefinition(card(key));
const board=():ArkCardPlayState=>({played:[],partners:[],universities:[],actions:ARK_ACTIONS.map(kind=>({kind,upgraded:false,venom:false,constriction:false,multiplier:0})),reputation:1,appeal:20,hand:[],display:[null,null,null,null,null,null],buildings:arkInitialBuildings(),money:40,wazaFocus:null});
const animalScope={kind:'ANIMAL',upgraded:false,remaining:2,paySponsorLevel:false} as const;
test('Zoo icons count duplicates, partner and research icons but never left-edge conditions',()=>{
  const icons=arkZooIcons([card('401'),card('407'),card('223')],['Africa'],['RESEARCH_2']);
  assert.equal(icons.Predator,3);assert.equal(icons.Africa,2);assert.equal(icons.Science,4);assert.equal(icons.Water,2);
  assert.equal(arkCard('464').rock,0);
});
test('Card prerequisites precede its own icons and match the animal continent for partners',()=>{
  const s=board();assert.deepEqual(arkMissingCardConditions(arkCard('402'),s),['Predator','Predator','Predator']);
  s.played=[card('401')];assert.deepEqual(arkMissingCardConditions(arkCard('402'),s),['Predator']);
  s.partners=['Europe'];assert.deepEqual(arkMissingCardConditions(arkCard('403'),s),['Partner_Zoo']);
  s.partners=['Africa'];assert.deepEqual(arkMissingCardConditions(arkCard('403'),s),[]);
});
test('Animal payment is up front, occupied housing and replay reject atomically',()=>{
  const s=board();s.hand=[card('404')];const housingId=s.buildings.find(b=>b.kind==='ENCLOSURE_3')!.id,before=structuredClone(s);
  const result=playArkZooCard(s,animalScope,{cardId:'card-404',housingId});assert.ok(result.ok);
  assert.equal(result.paid,9);assert.equal(result.state.money,31);assert.equal(result.remaining,1);assert.equal(result.state.hand.length,0);assert.equal(result.state.played.length,1);assert.equal(result.state.appeal,20);
  assert.deepEqual(s,before);assert.equal(playArkZooCard(result.state,animalScope,{cardId:'card-404',housingId}).ok,false);
  assert.equal(playArkZooCard({...s,money:8},animalScope,{cardId:'card-404',housingId}).ok,false);
  assert.equal(playArkZooCard(s,animalScope,{cardId:'card-404',housingId,cost:0}).ok,false);
});
test('Display plays require side II and reputation and preserve slot prices and holes',()=>{
  const s=board();s.display[2]=card('404');const housingId=s.buildings.find(b=>b.kind==='ENCLOSURE_3')!.id;
  assert.equal(playArkZooCard(s,animalScope,{cardId:'card-404',housingId}).ok,false);
  assert.equal(playArkZooCard(s,{...animalScope,upgraded:true},{cardId:'card-404',housingId}).ok,false);
  s.reputation=4;const result=playArkZooCard(s,{...animalScope,upgraded:true},{cardId:'card-404',housingId});assert.ok(result.ok);assert.equal(result.paid,12);assert.equal(result.state.display[2],null);
  assert.equal(arkAnimalPrice(arkCard('426'),{played:[card('230')],partners:['Africa']},3),29);
});
test('Sponsors spend strength, not their level in money, except the explicit money bonus',()=>{
  const s=board();s.hand=[card('223')];const scope={kind:'SPONSOR',upgraded:true,remaining:6,paySponsorLevel:false} as const;
  const result=playArkZooCard(s,scope,{cardId:'card-223',housingId:null});assert.ok(result.ok);assert.equal(result.paid,0);assert.equal(result.remaining,3);
  const paid=playArkZooCard(s,{...scope,paySponsorLevel:true},{cardId:'card-223',housingId:null});assert.ok(paid.ok);assert.equal(paid.paid,3);
});
test('Breeding requires an animal and a partner of its continent, not two arbitrary category icons',()=>{
  const s=board();s.played=[card('404')];s.partners=['Europe'];assert.equal(arkProjectEligibility('124',0,s).eligible,false);
  s.partners=['Africa'];for (const slot of [0,1,2]) assert.equal(arkProjectEligibility('124',slot,s).eligible,true);
  s.played=[card('239')];assert.equal(arkProjectEligibility('124',0,s).eligible,false);
});
test('Release requires the exact animal size and removes only printed appeal and its card',()=>{
  const s=board();s.played=[card('404')];s.buildings.find(b=>b.kind==='ENCLOSURE_3')!.occupied=true;
  const housingId=s.buildings.find(b=>b.kind==='ENCLOSURE_3')!.id,before=structuredClone(s);
  assert.equal(releaseArkProjectAnimal(s,'116',1,'card-404',housingId).ok,false);
  const result=releaseArkProjectAnimal(s,'116',2,'card-404',housingId);assert.ok(result.ok);
  assert.equal(result.appeal,16);assert.equal(result.played.length,0);assert.equal(result.buildings.find(b=>b.id===housingId)!.occupied,false);assert.deepEqual(s,before);
});
