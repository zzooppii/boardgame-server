import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse,safeParse} from 'valibot';
import {ArkHistorySchema} from '@hangul-rummikub/shared';
import {ArkNovaHistory} from '../features/ark-nova/ArkNovaHistory.js';
test('History presents newest confirmed changes first with signed deltas and before/after balances',()=>{
  const entries=parse(ArkHistorySchema,[{revision:1,round:1,turn:1,label:'카라칼 사용',notes:[],changes:[{resource:'돈',before:25,after:16}]},{revision:3,round:1,turn:1,label:'카라칼 · 카드 효과',notes:['휴식 시작'],changes:[{resource:'매력',before:20,after:24}]}]);
  const before=structuredClone(entries),html=renderToStaticMarkup(createElement(ArkNovaHistory,{entries}));
  assert.ok(html.indexOf('카라칼 · 카드 효과')<html.indexOf('카라칼 사용'));assert.match(html,/-9/);assert.match(html,/\+4/);assert.match(html,/25 → 16/);assert.match(html,/휴식 시작/);assert.deepEqual(entries,before);
  assert.equal(safeParse(ArkHistorySchema,[entries[1],entries[0]]).success,false);
  assert.equal(safeParse(ArkHistorySchema,Array(101).fill(entries[0])).success,false);
});
test('Empty history provides guidance rather than inventing prior moves',()=>{
  assert.match(renderToStaticMarkup(createElement(ArkNovaHistory,{entries:[]})),/첫 행동을 진행하면/);
});
