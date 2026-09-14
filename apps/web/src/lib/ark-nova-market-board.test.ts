import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ARK_CARDS,arkReputationRange} from '@hangul-rummikub/shared';
import {ArkNovaCard,ArkNovaDisplay} from '../features/ark-nova/ArkNovaCards.js';
const cards=Array.from({length:6},(_,i)=>({key:'401',cardId:`card-${i}`}));
const render=(reputation:number,cardsUpgraded=false)=>renderToStaticMarkup(createElement(ArkNovaDisplay,{cards,selected:null,disabled:false,onSelect:()=>{},reputation,cardsUpgraded}));
test('Market connects all six slots to the same reputation ranges as server card access',()=>{
  for(let reputation=1;reputation<=15;reputation++){
    const html=render(reputation,true);
    assert.equal((html.match(/class="is-in-range"/g)??[]).length,arkReputationRange(reputation));
    assert.equal((html.match(/aria-current="step"/g)??[]).length,1);
    assert.ok(html.includes(`평판 ${reputation}, 현재 위치`));
    assert.equal((html.match(/번 공개 카드에 연결된 평판/g)??[]).length,6);
  }
});
test('Out-of-range display cards stay selectable for snapping; reputation cap is explicitly marked',()=>{
  const html=render(1);
  assert.equal((html.match(/class="is-outside-range"/g)??[]).length,5);
  assert.doesNotMatch(html,/disabled=""/);assert.match(html,/낚아채기는 평판 범위와 무관/);
  assert.equal((html.match(/, 카드 II 필요/g)??[]).length,6);
  assert.doesNotMatch(render(15,true),/, 카드 II 필요/);
});
test('Animal card fronts expose printed cost, habitat, conditions and all three score values',()=>{
  for(const card of ARK_CARDS.filter(c=>c.kind==='ANIMAL')){
    const html=renderToStaticMarkup(createElement(ArkNovaCard,{card:{key:card.key,cardId:card.key},onSelect:()=>{}}));
    const front=html.split('<details>')[0]!;
    for(const value of [`비용 ${card.cost}`,`우리 ${card.size}`,`매력 ${card.appeal}`,`보전 ${card.conservation}`,`평판 ${card.reputation}`])assert.ok(front.includes(value),`${card.key}: ${value}`);
    assert.match(front,/조건:/);assert.match(front,/카드 아이콘/);
  }
});
test('Sponsor front distinguishes action level from animal money cost and shows repeated requirements',()=>{
  const sponsor=renderToStaticMarkup(createElement(ArkNovaCard,{card:{key:'223',cardId:'sponsor'}})).split('<details>')[0]!;
  assert.match(sponsor,/후원 등급 3/);assert.doesNotMatch(sponsor,/비용 3/);
  const lion=renderToStaticMarkup(createElement(ArkNovaCard,{card:{key:'402',cardId:'lion'}})).split('<details>')[0]!;
  assert.match(lion,/조건: 육식 · 육식 · 육식/);
});
