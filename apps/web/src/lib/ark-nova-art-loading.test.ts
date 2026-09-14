import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createArkArtLoader} from '../features/ark-nova/art-loading.js';
import {ArkAnimalArt} from '../features/ark-nova/animal-art.js';
import {ArkNovaCard} from '../features/ark-nova/ArkNovaCards.js';
test('Cards render accessible placeholders without eagerly referencing atlas or family image URLs',()=>{
  for(const cardKey of ['401','436','201']){
    const html=renderToStaticMarkup(createElement(ArkAnimalArt,{cardKey}));
    assert.match(html,/data-art-state="loading"/);assert.match(html,/background-image:none/);assert.match(html,/그림 준비 중/);
    assert.doesNotMatch(html,/url\(|\.png|\.webp/);
  }
  const card=renderToStaticMarkup(createElement(ArkNovaCard,{card:{cardId:'bison',key:'436'}}));
  assert.match(card,/아메리카들소/);assert.match(card,/비용 18/);assert.match(card,/카드 내용/);
});
test('Cards sharing an atlas share one pending request and a completed cache entry',async()=>{
  let requests=0,finish:()=>void=()=>{};
  const load=createArkArtLoader(()=>{requests++;return new Promise<void>(resolve=>{finish=resolve;});});
  const a=load('atlas'),b=load('atlas');assert.equal(a,b);assert.equal(requests,1);
  finish();await Promise.all([a,b]);await load('atlas');assert.equal(requests,1);
});
test('Image failures are surfaced and do not poison later retries',async()=>{
  let requests=0;const load=createArkArtLoader(async()=>{if(++requests===1)throw new Error('offline');});
  await assert.rejects(load('atlas'),/offline/);await load('atlas');assert.equal(requests,2);
});
