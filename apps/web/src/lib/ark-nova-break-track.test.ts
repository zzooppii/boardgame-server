import test from 'node:test';import assert from 'node:assert/strict';import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{ArkNovaBreakTrack}from'../features/ark-nova/ArkNovaBreakTrack.js';import type{ArkSoloView}from'@hangul-rummikub/shared';
const render=(progress:ArkSoloView['progress'])=>renderToStaticMarkup(createElement(ArkNovaBreakTrack,{progress}));
test('Solo countdown uses completed turns and announces this-turn break',()=>{
 assert.match(render({round:1,turnInRound:0,turnsCompleted:0,stage:'ACTION'}),/휴식까지 7턴/);
 assert.match(render({round:1,turnInRound:6,turnsCompleted:6,stage:'ACTION'}),/이번 턴 종료 후 휴식/);
 assert.match(render({round:1,turnInRound:7,turnsCompleted:7,stage:'BREAK'}),/휴식 중/);
 assert.match(render({round:2,turnInRound:0,turnsCompleted:7,stage:'ACTION'}),/휴식까지 6턴/);
});
test('Final round counts down to scoring, never an additional break',()=>{
 const html=render({round:6,turnInRound:1,turnsCompleted:26,stage:'ACTION'});
 assert.match(html,/이번 턴 종료 후 최종 정산/);assert.doesNotMatch(html,/휴식까지/);
 assert.match(render({round:6,turnInRound:2,turnsCompleted:27,stage:'FINISHED'}),/게임 종료/);
});
