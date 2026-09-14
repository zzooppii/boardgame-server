import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {type ArkAssociationTask,ARK_MAP_A,validateArkUniqueConstruction,ARK_CARDS} from '@hangul-rummikub/shared';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
import {arkAssociationAdvice,arkDonationAdvice} from '../features/ark-nova/association-advice.js';
import {arkSponsorSelectionAdvice} from '../features/ark-nova/action-controls.js';
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
