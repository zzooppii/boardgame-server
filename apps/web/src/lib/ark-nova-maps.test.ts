import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ARK_MAP_IDS,ARK_MAP_LAYOUTS,arkOffset} from '@hangul-rummikub/shared';
import {ArkNovaBoard} from '../features/ark-nova/ArkNovaBoard.js';
import {ArkNovaTable} from '../features/ark-nova/ArkNovaTable.js';
import {ArkNovaAssociationBenefits} from '../features/ark-nova/ArkNovaAssociationBenefits.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
import {arkBuildPlacementHint,arkMapBonusAdvice} from '../features/ark-nova/action-controls.js';
test('All original maps render their own name, terrain and landmark explanations',()=>{
 for(const mapId of ARK_MAP_IDS){const html=renderToStaticMarkup(createElement(ArkNovaBoard,{mapId,buildings:[],selected:null,onSelect:()=>{}}));assert.ok(html.includes(ARK_MAP_LAYOUTS[mapId].name));assert.equal((html.match(/data-cell-index=/g)??[]).length,58);}
 const h=renderToStaticMarkup(createElement(ArkNovaBoard,{mapId:'8',buildings:[],selected:null,onSelect:()=>{}}));assert.equal((h.match(/>H<\/text>/g)??[]).length,3);
});
test('Initial-hand screen offers maps A, 0 and 1–8 before confirming the hand',()=>{
 const html=renderToStaticMarkup(createElement(ArkNovaTable,{state:arkSoloSetupFixture,disabled:false,onCommand:()=>{},onCue:()=>{}}));for(const id of ARK_MAP_IDS)assert.ok(html.includes(`지도 ${id} · ${ARK_MAP_LAYOUTS[id].name}`));assert.ok(html.includes('동물원 지도'));
});
test('Construction advice and archaeologist use selected map rather than map A',()=>{
 const s={...structuredClone(arkSoloSetupFixture),mapId:'0' as const,buildings:[]};
 assert.equal(arkBuildPlacementHint(s,{building:'ENCLOSURE_1',anchor:arkOffset(0,2),rotation:0,reflected:false}),null);
 assert.match(arkBuildPlacementHint(s,{building:'ENCLOSURE_1',anchor:arkOffset(0,0),rotation:0,reflected:false})??'',/물과 바위/);
 assert.equal(arkMapBonusAdvice({...s,mapId:'8'},arkOffset(1,5)).available.some(c=>c.q===1&&c.r===4),false);
});
test('University rewards display the original map-specific threshold',()=>{
 const html=renderToStaticMarkup(createElement(ArkNovaAssociationBenefits,{kind:'UNIVERSITY',mapId:'1',count:0}));assert.match(html,/1번째 획득: 행동 업그레이드/);assert.match(html,/보전 \+1/);
});
