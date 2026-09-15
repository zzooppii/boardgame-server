import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ArkNovaConditionGuide} from '../features/ark-nova/ArkNovaConditionGuide.js';import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
test('Research condition compares duplicate requirements with universities and played cards, excluding hand',()=>{
 const s=structuredClone(arkSoloSetupFixture);s.hand=[{cardId:'tiger',key:'407'},{cardId:'lab',key:'201'}];s.universities=['RESEARCH_REPUTATION'];
 const render=()=>renderToStaticMarkup(createElement(ArkNovaConditionGuide,{state:s,cardId:'tiger'}));
 assert.match(render(),/필요 2 · 보유 1/);assert.match(render(),/1개 부족/);
 s.played=[{cardId:'played-lab',key:'201'}];assert.match(render(),/필요 2 · 보유 2/);assert.match(render(),/충족/);
});

test('Animals II is an upgrade requirement even with enough action strength',()=>{
 const s=structuredClone(arkSoloSetupFixture);s.hand=[{cardId:'eagle',key:'505'}];
 const render=()=>renderToStaticMarkup(createElement(ArkNovaConditionGuide,{state:s,cardId:'eagle'}));
 assert.match(render(),/동물 II/);assert.match(render(),/업그레이드 필요/);assert.match(render(),/어떻게 업그레이드/);
 s.actions=s.actions.map(a=>({...a,upgraded:a.kind==='ANIMALS'}));assert.match(render(),/업그레이드 완료/);assert.doesNotMatch(render(),/어떻게 업그레이드/);
});
test('Partner condition identifies matching continent instead of treating any partner as enough',()=>{
 const s=structuredClone(arkSoloSetupFixture);s.hand=[{cardId:'bear',key:'409'}];s.partners=['Africa'];
 const render=()=>renderToStaticMarkup(createElement(ArkNovaConditionGuide,{state:s,cardId:'bear'}));
 assert.match(render(),/필요 아시아 · 보유 제휴 아프리카/);assert.match(render(),/미충족/);
 s.partners=['Asia'];assert.doesNotMatch(render(),/미충족/);assert.match(render(),/충족/);
});
