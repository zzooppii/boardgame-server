import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArkNovaMoneyGuide} from '../features/ark-nova/ArkNovaMoneyGuide.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
import type {ArkSoloView} from '@hangul-rummikub/shared';
const state=():ArkSoloView=>({...structuredClone(arkSoloSetupFixture),money:0,x:3,pending:null,progress:{round:1,turnInRound:0,turnsCompleted:0,stage:'ACTION'}});
const render=(s:ArkSoloView,x=0,canFundraise=true)=>renderToStaticMarkup(createElement(ArkNovaMoneyGuide,{state:s,x,canFundraise}));
test('Money guide explains affordable fundraising with actual sponsor position, upgrade and X boost',()=>{
  const s=state(),index=s.actions.findIndex(a=>a.kind==='SPONSORS');
  assert.match(render(s),new RegExp(`모금으로 돈 ${index+1}`));
  s.actions[index]!.upgraded=true;
  const html=render(s,2);
  assert.match(html,new RegExp(`모금으로 돈 ${(index+3)*2}`));assert.match(html,/X 토큰 2개 추가 기준/);
  assert.match(html,/href="#ark-sponsors-action"/);assert.match(html,/돈이나 손패가 없어도 가능/);
});
test('Money guide does not offer fundraising navigation while another action is unresolved',()=>{
  const html=render(state(),0,false);assert.doesNotMatch(html,/href=|모금으로 돈/);assert.match(html,/현재 행동·효과·휴식 처리를 마친 뒤/);
});
test('Final round warns there is no break income, and unavailable projection never displays an invented amount',()=>{
  const s=state();delete s.scoreBoard;
  assert.match(render(s),/매력 수입은 전체 점수판/);assert.doesNotMatch(render(s),/undefined|NaN/);
  s.progress.round=6;
  const html=render(s);assert.match(html,/휴식 수입을 받지 않습니다/);assert.doesNotMatch(html,/기본 휴식 수입은 돈/);
  s.phase='FINISHED';assert.equal(render(s),'');
});
