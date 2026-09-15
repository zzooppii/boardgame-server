import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ArkNovaConditionGuide} from '../features/ark-nova/ArkNovaConditionGuide.js';import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
test('Research condition compares duplicate requirements with universities and played cards, excluding hand',()=>{
 const s=structuredClone(arkSoloSetupFixture);s.hand=[{cardId:'tiger',key:'407'},{cardId:'lab',key:'201'}];s.universities=['RESEARCH_REPUTATION'];
 const render=()=>renderToStaticMarkup(createElement(ArkNovaConditionGuide,{state:s,cardId:'tiger'}));
 assert.match(render(),/필요 2 · 보유 1/);assert.match(render(),/1개 부족/);
 s.played=[{cardId:'played-lab',key:'201'}];assert.match(render(),/필요 2 · 보유 2/);assert.match(render(),/충족/);
});
