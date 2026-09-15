import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {arkActionBenefits,ArkNovaActionGuide} from '../features/ark-nova/ArkNovaActionGuide.js';
import {ArkNovaTable} from '../features/ark-nova/ArkNovaTable.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
test('Animal thresholds and upgraded reputation are distinct',()=>{
  assert.equal(arkActionBenefits('ANIMALS',false,1),'동물 최대 0장');
  assert.equal(arkActionBenefits('ANIMALS',false,2),'동물 최대 1장');
  assert.equal(arkActionBenefits('ANIMALS',true,5),'동물 최대 2장 · 평판 1 선택 가능');
});
test('Draw reference distinguishes upgraded discard and snap thresholds and caps at five',()=>{
  assert.equal(arkActionBenefits('CARDS',false,3),'2장 가져오기 · 1장 버리기');
  assert.equal(arkActionBenefits('CARDS',true,3),'2장 가져오기 · 0장 버리기 또는 공개 카드 1장 낚아채기');
  assert.equal(arkActionBenefits('CARDS',true,8),'4장 가져오기 · 1장 버리기 또는 공개 카드 1장 낚아채기');
});
test('Boosted strength remains visible for construction and sponsor alternatives',()=>{
  assert.equal(arkActionBenefits('BUILD',true,7),'서로 다른 건물 · 합계 7칸까지');
  assert.equal(arkActionBenefits('SPONSORS',true,7),'후원 등급 합계 8까지 또는 모금 돈 14');
  const html=renderToStaticMarkup(createElement(ArkNovaActionGuide,{kind:'CARDS',upgraded:true,strength:3}));
  assert.match(html,/카드 II 행동력별 혜택/);assert.match(html,/<th scope="col" class="is-current">3/);assert.match(html,/솔로 휴식은 라운드 종료/);
});
test('Association board starts collapsed behind accessible toggles without removing task controls',()=>{
  const html=renderToStaticMarkup(createElement(ArkNovaTable,{state:{...arkSoloSetupFixture,progress:{...arkSoloSetupFixture.progress,stage:'ACTION'},pending:null},disabled:false,onCommand:()=>{},onCue:()=>{}}));
  assert.match(html,/id="ark-association-content" hidden/);
  assert.equal((html.match(/aria-controls="ark-association-content" aria-expanded="false"/g)??[]).length,2);
  assert.match(html,/협회판에서 업무 선택/);assert.match(html,/평판 올리기/);
  assert.equal((html.match(/행동력별 혜택/g)??[]).length,5);
});
