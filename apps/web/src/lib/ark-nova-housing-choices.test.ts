import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ArkNovaHousingChoices} from '../features/ark-nova/ArkNovaHousingChoices.js';
test('Housing choices show only eligible buildings and select the whole enclosure by any cell',()=>{
 const buildings=[{id:'a',kind:'ENCLOSURE_2',cells:[{q:0,r:0},{q:1,r:0}],occupied:false,used:0},{id:'b',kind:'ENCLOSURE_1',cells:[{q:2,r:0}],occupied:false,used:0}];
 const html=renderToStaticMarkup(createElement(ArkNovaHousingChoices,{buildings,eligibleIds:['a'],selected:{q:1,r:0},disabled:true,onChoose:()=>{}}));
 assert.match(html,/2칸 우리/);assert.doesNotMatch(html,/1칸 우리/);assert.match(html,/aria-pressed="true"/);assert.match(html,/disabled=""/);assert.match(html,/카드 사용/);
});
