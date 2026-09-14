import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse} from 'valibot';
import {ARK_CARDS,GameRevisionSchema} from '@hangul-rummikub/shared';
import {arkAnimalArt,ArkAnimalArt} from '../features/ark-nova/animal-art.js';
import {arkFeedback} from '../features/ark-nova/feedback.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';

test('All 128 base animals have distinct species cells and existing local atlases',()=>{
  const animals=ARK_CARDS.filter(c=>c.kind==='ANIMAL');
  const cells=new Set<string>();
  for(const card of animals){
    const art=arkAnimalArt(card.key);assert.ok(art,card.key);
    cells.add(`${art.backgroundImage}:${art.backgroundPosition}`);
    const file=String(art.backgroundImage).match(/species-\d\.webp/)?.[0];assert.ok(file);
    assert.ok(existsSync(new URL(`../../public/images/ark-nova/animals/${file}`,import.meta.url)));
    const html=renderToStaticMarkup(createElement(ArkAnimalArt,{cardKey:card.key}));
    assert.ok(html.includes(`${card.name} 일러스트`));assert.ok(!html.includes('animal-families'));
  }
  assert.equal(animals.length,128);assert.equal(cells.size,128);
  assert.equal(arkAnimalArt('not-a-card'),undefined);assert.equal(arkAnimalArt('201'),undefined);
  // The generated sheet deliberately places slow worm before grass snake.
  assert.ok(Number(String(arkAnimalArt('487')?.backgroundPosition).split('%')[0])>90);
  assert.ok(Number(String(arkAnimalArt('488')?.backgroundPosition).split('%')[0])<70);
});
test('Move feedback uses accepted changes and suppresses duplicates, initial setup and reconnect gaps',()=>{
  const before=structuredClone(arkSoloSetupFixture);before.progress.stage='ACTION';
  const next=structuredClone(before);next.revision++;
  next.buildings.push({id:'new-pen',kind:'ENCLOSURE_1',cells:[{q:0,r:2}],occupied:true,used:1});
  next.played.push({cardId:'animal',key:'473'});next.conservation+=2;
  assert.deepEqual(arkFeedback(before,next),{revision:next.revision,built:['new-pen'],arrivals:['new-pen'],animals:['473'],conservation:2});
  assert.equal(arkFeedback(next,next),null);
  assert.equal(arkFeedback(before,{...next,revision:parse(GameRevisionSchema,next.revision+1)}),null);
  assert.equal(arkFeedback({...before,progress:{...before.progress,stage:'SETUP'}},next),null);
  assert.equal(arkFeedback(before,{...before,revision:parse(GameRevisionSchema,before.revision+1)}),null);
});
test('Existing enclosures celebrate occupancy but removing animals or playing sponsors does not announce arrival',()=>{
  const before=structuredClone(arkSoloSetupFixture);before.progress.stage='ACTION';
  const next=structuredClone(before);next.revision++;
  const pen=next.buildings.find(b=>b.kind==='ENCLOSURE_3')!;pen.occupied=true;
  next.played.push({cardId:'new-animal',key:'467'});
  assert.deepEqual(arkFeedback(before,next)?.arrivals,[pen.id]);
  const sponsor=structuredClone(before);sponsor.revision++;sponsor.played.push({cardId:'sponsor',key:'203'});
  assert.equal(arkFeedback(before,sponsor),null);
  assert.equal(arkFeedback(next,{...before,revision:parse(GameRevisionSchema,next.revision+1)}),null);
});
