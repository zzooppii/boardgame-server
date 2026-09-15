import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ARK_CARDS,ARK_CONTINENTS,ARK_TAG_LABELS} from '@hangul-rummikub/shared';
import {ArkNovaCard} from '../features/ark-nova/ArkNovaCards.js';
import {ArkNovaAssociation} from '../features/ark-nova/ArkNovaAssociation.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
const front=(key:string)=>renderToStaticMarkup(createElement(ArkNovaCard,{card:{key,cardId:key}})).split('<details>')[0]!;
test('Reference animals expose their ability and alternative habitat directly on the front',()=>{
  const monkey=front('466');assert.match(monkey,/비용 12/);assert.match(monkey,/우리 3/);assert.match(monkey,/영장류/);assert.match(monkey,/아메리카/);
  assert.match(monkey,/강화: 행동을 마친 뒤 카드 행동 카드를 1번 또는 5번 칸/);assert.match(monkey,/매력 6/);
  const turtle=front('484');assert.match(turtle,/비용 9/);assert.match(turtle,/물 1/);assert.match(turtle,/일반 우리 1칸/);assert.match(turtle,/파충류관 1칸/);assert.match(turtle,/추가 특수능력 없음/);
});
test('All animal fronts retain repeated tags and expose housing and ability sections',()=>{
  for(const card of ARK_CARDS.filter(c=>c.kind==='ANIMAL')){
    const html=front(card.key);assert.match(html,/서식지:/);assert.match(html,/aria-label="특수능력"/);
    assert.doesNotMatch(html,/능력 설명 확인 중/);
    for(const tag of card.tags)assert.ok(html.includes(ARK_TAG_LABELS[tag]??tag),`${card.key} ${tag}`);
  }
});
test('Association board projects staff, owned partners, universities, and base project slots',()=>{
  const state=structuredClone(arkSoloSetupFixture);state.workers=2;state.busyWorkers=1;state.taskWorkers={PARTNER:1};state.partners=['Europe'];state.partnerSupply=ARK_CONTINENTS.filter(c=>c!=='Europe');
  const html=renderToStaticMarkup(createElement(ArkNovaAssociation,{state,disabled:false,onTask:()=>{},onDonate:()=>{}}));
  assert.match(html,/aria-label="협회판"/);assert.match(html,/대기 직원 1 \/ 2명/);assert.match(html,/PARTNER 배치 직원 1명/);assert.match(html,/보유 중/);
  assert.match(html,/이미 제휴한 대륙/);assert.match(html,/다음 기부/);assert.match(html,/연구 아이콘 2/);assert.match(html,/손패 한도 5 · 평판 1/);assert.doesNotMatch(html,/손패 한도 [56] · 연구/);
  assert.equal((html.match(/class="ark-project-spaces"/g)??[]).length,state.baseProjects.length);
});
test('Free university choices use the same correct hand limit and reputation as association work',async()=>{
  const {ArkNovaEffects}=await import('../features/ark-nova/ArkNovaEffects.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.activeEffect={id:1,kind:'FREE_UNIVERSITY',sourceId:'reward',guide:{resource:null,amount:null,actions:[],buildings:[],slots:[],mayRefill:false,bonuses:[]}};
  const html=renderToStaticMarkup(createElement(ArkNovaEffects,{state,disabled:false,onSelect:()=>{},placement:null,cell:null,housingId:null,onUniqueCard:()=>{},onBuilding:()=>{},onRotate:()=>{},onReflect:()=>{}}));
  assert.match(html,/손패 한도 5 · 평판 1/);assert.doesNotMatch(html,/손패 한도 6|손패 한도 5 · 연구/);
  assert.match(html,/연구 아이콘을 주지 않습니다/);assert.match(html,/평판은 대학 획득 시 한 번/);
});
test('Association milestones distinguish reached slots, next reward, and distant rewards',async()=>{
  const {ArkNovaAssociationBenefits}=await import('../features/ark-nova/ArkNovaAssociationBenefits.js');
  const render=(kind:'PARTNER'|'UNIVERSITY',count:number)=>renderToStaticMarkup(createElement(ArkNovaAssociationBenefits,{kind,count})).replace(/<[^>]+>/g,'');
  assert.match(render('PARTNER',1),/2번째 획득: 행동 업그레이드 · 다음 획득 보상/);
  assert.match(render('PARTNER',2),/2번째 획득: 행동 업그레이드 · 도달/);
  assert.match(render('PARTNER',2),/3번째 획득: 직원 \+1 · 다음 획득 보상/);
  assert.match(render('PARTNER',2),/4번째 획득: 보전 \+2 · 2곳 더 필요/);
  assert.match(render('UNIVERSITY',2),/3번째 획득: 보전 \+2 · 다음 획득 보상/);
  assert.doesNotMatch(render('UNIVERSITY',3),/다음 획득 보상|더 필요/);
});
test('Association board disables executable commands while a different action is pending',()=>{
  const html=renderToStaticMarkup(createElement(ArkNovaAssociation,{state:arkSoloSetupFixture,disabled:true,onTask:()=>{},onDonate:()=>{}}));
  const lanes=html.split('class="ark-association-projects"')[0]!;
  const buttons=lanes.match(/<button[^>]*>/g)??[];assert.ok(buttons.length>=10);assert.ok(buttons.every(b=>b.includes('disabled=""')));
  assert.doesNotMatch(lanes,/ · 가능/);
});
