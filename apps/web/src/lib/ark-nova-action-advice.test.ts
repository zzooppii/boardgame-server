import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {type ArkAssociationTask,ARK_MAP_A,validateArkUniqueConstruction,ARK_CARDS} from '@hangul-rummikub/shared';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
import {arkAssociationAdvice,arkDonationAdvice} from '../features/ark-nova/association-advice.js';
import {arkSponsorSelectionAdvice} from '../features/ark-nova/action-controls.js';
import {ArkNovaEffects} from '../features/ark-nova/ArkNovaEffects.js';
import {ArkNovaAssociation} from '../features/ark-nova/ArkNovaAssociation.js';
function state(){const s=structuredClone(arkSoloSetupFixture);s.actions=s.actions.filter(a=>a.kind!=='ASSOCIATION').concat({kind:'ASSOCIATION',upgraded:false,venom:false,constriction:false,multiplier:0});s.workers=4;s.busyWorkers=0;s.taskWorkers={};s.x=5;return s;}
const project=(cardId:string,slot:0|1|2=0):Extract<ArkAssociationTask,{kind:'PROJECT'}>=>({kind:'PROJECT',cardId,slot,bonus:'SNAP_1',animalId:null,housingId:null,sponsorTokenIds:[]});
test('Association advice respects strength, staff escalation, frozen side and repeated task exclusion',()=>{
  const s=state(),before=structuredClone(s);assert.deepEqual(arkAssociationAdvice(s,{kind:'REPUTATION'}),[]);assert.deepEqual(s,before);
  s.taskWorkers.REPUTATION=1;s.busyWorkers=3;assert.match(arkAssociationAdvice(s,{kind:'REPUTATION'}).join(' '),/직원 2명/);
  s.taskWorkers.REPUTATION=3;assert.match(arkAssociationAdvice(s,{kind:'REPUTATION'}).join(' '),/휴식 전/);
  s.associationWork={strength:5,remaining:3,upgraded:true,tasks:['REPUTATION'],donated:false,projectCost:5};
  assert.match(arkAssociationAdvice(s,{kind:'REPUTATION'}).join(' '),/이미 수행/);
  assert.match(arkAssociationAdvice(s,{kind:'UNIVERSITY',university:'RESEARCH_2'}).join(' '),/행동력 1 부족/);
  s.associationWork=null;s.partners=['Africa','Asia'];s.partnerSupply=['Europe'];
  assert.match(arkAssociationAdvice(s,{kind:'PARTNER',continent:'Europe'}).join(' '),/협회 II/);
});
test('Projects report current icons, token contribution, previous support and display access costs',()=>{
  const s=state();s.baseProjects=[{key:'101',cardId:'base'}];s.played=[];
  assert.match(arkAssociationAdvice(s,project('base',2)).join(' '),/프로젝트 조건 부족/);
  s.played=[{key:'404',cardId:'cat'},{key:'472',cardId:'reptile'},{key:'215',cardId:'token-sponsor'}];s.sponsorTokens={'token-sponsor':1};
  assert.deepEqual(arkAssociationAdvice(s,{...project('base',2),sponsorTokenIds:['token-sponsor']}),[]);
  assert.match(arkAssociationAdvice(s,project('base',2)).join(' '),/현재 2 · 필요 3/);
  s.hand=[];s.display=[null,null,{key:'116',cardId:'display'},null,null,null];s.money=0;s.reputation=1;
  const text=arkAssociationAdvice(s,project('display')).join(' ');assert.match(text,/협회 II/);assert.match(text,/평판/);assert.match(text,/돈 3 부족/);
  s.projectSupports=[{cardId:'base',slot:0}];assert.match(arkAssociationAdvice(s,project('base',2)).join(' '),/이미 지원/);
});
test('Release guidance chooses special capacity before standard housing and allows no housing only when none qualifies',()=>{
  const s=state();s.hand=[{key:'116',cardId:'release'}];s.played=[{key:'496',cardId:'bird'}];s.buildings[1]!.occupied=true;
  s.buildings.push({id:'aviary',kind:'LargeBirdAviary',cells:[{q:3,r:3}],occupied:false,used:1});
  const task={...project('release',1),animalId:'bird',housingId:'initial-enclosure'};
  assert.match(arkAssociationAdvice(s,task).join(' '),/비울 우리/);
  assert.deepEqual(arkAssociationAdvice(s,{...task,housingId:'aviary'}),[]);
  assert.match(arkAssociationAdvice(s,{...task,slot:0}).join(' '),/동물 종류·크기/);
  s.buildings=[];assert.deepEqual(arkAssociationAdvice(s,{...task,housingId:null}),[]);
});
test('Breeding requires a partner matching the selected animal and migration never reuses an occupied slot',()=>{
  const s=state();s.hand=[{key:'123',cardId:'breed'},{key:'116',cardId:'release'}];s.played=[{key:'496',cardId:'bird'},{key:'224',cardId:'migration'}];
  const breed={...project('breed'),animalId:'bird'};s.partners=['Asia'];assert.match(arkAssociationAdvice(s,breed).join(' '),/제휴 조건/);
  s.partners=['Africa'];assert.deepEqual(arkAssociationAdvice(s,breed),[]);
  s.projectSupports=[{cardId:'release',slot:0}];
  assert.deepEqual(arkAssociationAdvice(s,{...project('release',1),animalId:'bird'}),[]);
  assert.match(arkAssociationAdvice(s,{...project('release',0),animalId:'bird'}).join(' '),/점유된/);
});
test('Donation advice handles equal-price slots, final repeatable space and one donation per action',()=>{
  const s=state();s.associationWork={strength:5,remaining:3,upgraded:true,tasks:['REPUTATION'],donated:false,projectCost:5};
  s.money=4;s.donations=[0,1];assert.equal(arkDonationAdvice(s).cost,5);assert.match(arkDonationAdvice(s).issues.join(' '),/돈 1 부족/);
  s.donations=[0,1,2,3,4,5,6];s.money=12;assert.deepEqual(arkDonationAdvice(s),{cost:12,issues:[]});
  s.associationWork.donated=true;assert.match(arkDonationAdvice(s).issues.join(' '),/이미 기부/);
});
test('Sponsor guidance checks prerequisites, market surcharge and actual unique building geometry',()=>{
  const s=state();s.hand=[{key:'201',cardId:'lab'}];assert.match(arkSponsorSelectionAdvice(s,'lab',null)!.issues.join(' '),/후원자 행동 II/);
  s.hand=[];s.display=[null,{key:'213',cardId:'expert'},null,null,null,null];s.money=1;
  assert.deepEqual(arkSponsorSelectionAdvice(s,'expert',null),{price:2,issues:['돈 1 부족 (필요 2 · 보유 1)']});
  s.hand=[{key:'255',cardId:'playground'}];const card=ARK_CARDS.find(c=>c.key==='255')!;
  assert.match(arkSponsorSelectionAdvice(s,'playground',null)!.issues.join(' '),/고유 건물/);
  const placements=ARK_MAP_A.flatMap(anchor=>[0,1,2,3,4,5].map(rotation=>({anchor:{q:anchor.q,r:anchor.r},rotation})));
  const valid=placements.find(p=>validateArkUniqueConstruction(s.buildings,card,false,false,p).ok);assert.ok(valid);
  assert.doesNotMatch(arkSponsorSelectionAdvice(s,'playground',valid)!.issues.join(' '),/고유 건물/);
});
test('Association markup shows disabled reasons and available choices together',()=>{
  const s=state();s.workers=1;s.busyWorkers=1;s.taskWorkers.REPUTATION=1;
  const html=renderToStaticMarkup(createElement(ArkNovaAssociation,{state:s,disabled:false,onTask:()=>{}}));
  assert.match(html,/직원 2명 필요/);assert.match(html,/<button disabled="">평판 올리기/);
});

test('Paid sponsor effect advice charges printed level and rejects display even with upgraded action',()=>{
  const s=state();s.hand=[{key:'223',cardId:'research'}];s.money=2;
  assert.deepEqual(arkSponsorSelectionAdvice(s,'research',null,'PAID_EFFECT'),{price:3,issues:['돈 1 부족 (필요 3 · 보유 2)']});
  s.money=3;const before=structuredClone(s);
  assert.deepEqual(arkSponsorSelectionAdvice(s,'research',null,'PAID_EFFECT'),{price:3,issues:[]});assert.deepEqual(s,before);
  s.hand=[];s.display=[{key:'223',cardId:'research'},null,null,null,null,null];s.reputation=15;
  s.actions=s.actions.map(a=>({...a,upgraded:true}));
  assert.match(arkSponsorSelectionAdvice(s,'research',null,'PAID_EFFECT')!.issues.join(' '),/손패의 후원자만/);
});
test('Paid sponsor effect still checks prerequisites and unique building placement',()=>{
  const s=state();s.hand=[{key:'201',cardId:'lab'},{key:'255',cardId:'playground'}];s.money=100;
  assert.match(arkSponsorSelectionAdvice(s,'lab',null,'PAID_EFFECT')!.issues.join(' '),/후원자 행동 II/);
  assert.match(arkSponsorSelectionAdvice(s,'playground',null,'PAID_EFFECT')!.issues.join(' '),/고유 건물/);
  const card=ARK_CARDS.find(c=>c.key==='255')!;
  const placement=ARK_MAP_A.flatMap(anchor=>[0,1,2,3,4,5].map(rotation=>({anchor:{q:anchor.q,r:anchor.r},rotation}))).find(p=>validateArkUniqueConstruction(s.buildings,card,false,false,p).ok);
  assert.ok(placement);assert.deepEqual(arkSponsorSelectionAdvice(s,'playground',placement,'PAID_EFFECT'),{price:card.cost,issues:[]});
});

test('Paid sponsor effect renders hand-only choices and an empty-hand exit',()=>{
  const s=state();s.activeEffect={id:1,kind:'PAID_SPONSOR',sourceId:'bonus',guide:{resource:null,amount:null,actions:[],buildings:[],slots:[],mayRefill:false,bonuses:[]}};
  s.hand=[{key:'223',cardId:'hand-sponsor'},{key:'401',cardId:'animal'}];s.display=[{key:'213',cardId:'market-sponsor'},null,null,null,null,null];
  const render=()=>renderToStaticMarkup(createElement(ArkNovaEffects,{state:s,disabled:false,onSelect:()=>{},placement:null,cell:null,housingId:null,onUniqueCard:()=>{},onBuilding:()=>{},onRotate:()=>{},onReflect:()=>{}}));
  const html=render();assert.match(html,/과학 연구 기관/);assert.doesNotMatch(html,/아프리카 전문가|치타/);assert.match(html,/후원 등급만큼 돈/);assert.match(html,/<button disabled="">카드 사용/);
  s.hand=[];const empty=render();assert.match(empty,/손패에 후원자가 없습니다/);assert.match(empty,/<button>이 효과 포기/);
});
