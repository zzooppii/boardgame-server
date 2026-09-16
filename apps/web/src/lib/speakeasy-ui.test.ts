import {startCityPreview,cityPreviewStep,cityPreviewRows,cityPreviewReturns} from '../features/speakeasy/city-preview.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {speakeasyContinuousCue, speakeasyTones, type SpeakeasyCue} from '../features/speakeasy/sound.js';
import {SPEAKEASY_PREVIEW_SCENES, speakeasyPreviewBuildings, speakeasyPreviewOperating, speakeasyDistrictFocus} from '../features/speakeasy/preview-scenes.js';

test('Speakeasy never replays historical or disconnected sound events', () => {
  const current = {gameId: 'a', revision: 4, cue: 'SELL' as const};
  assert.equal(speakeasyContinuousCue(null, current, true), null);
  for (const revision of [1, 4, 5]) assert.equal(speakeasyContinuousCue({gameId: 'a', revision}, current, true), null);
  assert.equal(speakeasyContinuousCue({gameId: 'b', revision: 3}, current, true), null);
  assert.equal(speakeasyContinuousCue({gameId: 'a', revision: 3}, current, false), null);
  assert.equal(speakeasyContinuousCue({gameId: 'a', revision: 3}, current, true), 'SELL');
});

test('Speakeasy cues are short, finite and have bounded gains', () => {
  const cues: readonly SpeakeasyCue[] = ['CARD_DRAW', 'TILE_USE', 'TILE_RETURN', 'SELECT', 'CANCEL', 'BUILD', 'PRODUCE', 'DELIVER', 'SELL', 'PROTECT', 'SETTLE', 'ERROR'];
  for (const cue of cues) for (const tone of speakeasyTones(cue)) {
    assert.ok(tone.frequency > 0 && tone.frequency < 20000);
    assert.ok(tone.end > 0 && tone.end < 20000);
    assert.ok(tone.duration > .006 && tone.delay >= 0 && tone.duration + tone.delay < 1);
    assert.ok(tone.gain > 0 && tone.gain <= 1);
  }
});

test('guided scenes reset independently and alter only the described building', () => {
  for (const scene of SPEAKEASY_PREVIEW_SCENES) {
    const before = speakeasyPreviewBuildings(scene, false);
    const snapshot = JSON.stringify(before);
    const after = speakeasyPreviewBuildings(scene, true);
    const other = (b: typeof before[number]) => b.district !== scene.target || b.slot !== scene.changed.slot;
    assert.deepEqual(before.filter(other), after.filter(other));
    assert.deepEqual(after.find(b => !other(b)), scene.changed);
    assert.equal(JSON.stringify(before), snapshot);
    assert.deepEqual(speakeasyPreviewBuildings(scene, false), before);
  }
});

test('protection scene preserves liquor and visibly restores operation under police', () => {
  const scene = SPEAKEASY_PREVIEW_SCENES.find(s => s.id === 'protect')!;
  const before = speakeasyPreviewBuildings(scene, false).find(b => b.district === 12)!;
  const after = speakeasyPreviewBuildings(scene, true).find(b => b.district === 12)!;
  assert.equal(before.barrel, true);
  assert.equal(after.barrel, true);
  assert.equal(speakeasyPreviewOperating(before), false);
  assert.equal(speakeasyPreviewOperating(after), true);
});

test('district keyboard navigation follows visual rows across zone panels', () => {
  assert.equal(speakeasyDistrictFocus(2, 'ArrowRight'), 7);
  assert.equal(speakeasyDistrictFocus(7, 'ArrowLeft'), 2);
  assert.equal(speakeasyDistrictFocus(2, 'ArrowDown'), 4);
  assert.equal(speakeasyDistrictFocus(15, 'ArrowUp'), 13);
  assert.equal(speakeasyDistrictFocus(12, 'ArrowRight'), null);
  assert.equal(speakeasyDistrictFocus(1, 'ArrowUp'), null);
  assert.equal(speakeasyDistrictFocus(1, 'ArrowLeft'), null);
  assert.equal(speakeasyDistrictFocus(16, 'ArrowDown'), null);
});


test('city presentation keeps used tiles until after drawing and balances returns before completing',()=>{
  const initial=startCityPreview();let s=initial;
  s=cityPreviewStep(s,{type:'SELECT',id:'produce'});s=cityPreviewStep(s,{type:'USE'});
  s=cityPreviewStep(s,{type:'SELECT',id:'deliver'});s=cityPreviewStep(s,{type:'USE'});
  assert.equal(s.held.length,6);assert.equal(s.used.length,2);
  assert.equal(cityPreviewStep(s,{type:'SELECT',id:'book'}),s);
  assert.equal(cityPreviewStep(s,{type:'RETURN',row:1}),s);
  s=cityPreviewStep(s,{type:'FINISH'});assert.equal(s.phase,'DRAW');
  assert.equal(cityPreviewStep(s,{type:'SELECT',id:'produce'}),s);
  s=cityPreviewStep(s,{type:'DRAW'});assert.equal(s.phase,'RETURN');
  assert.equal(cityPreviewStep(s,{type:'DRAW'}),s);
  s=cityPreviewStep(s,{type:'SELECT',id:'produce'});assert.deepEqual(cityPreviewRows(s),[1]);
  assert.equal(cityPreviewStep(s,{type:'RETURN',row:0}),s);
  s=cityPreviewStep(s,{type:'RETURN',row:1});assert.equal(cityPreviewReturns(s),1);
  s=cityPreviewStep(s,{type:'SELECT',id:'deliver'});assert.deepEqual(cityPreviewRows(s),[1,2]);
  s=cityPreviewStep(s,{type:'RETURN',row:2});assert.equal(s.phase,'DONE');assert.equal(s.held.length,4);
  assert.deepEqual(initial,startCityPreview());
});
test('city presentation allows skipping uses and choosing excess without discarding below four',()=>{
  let s=cityPreviewStep(startCityPreview(),{type:'FINISH'});s=cityPreviewStep(s,{type:'DRAW'});
  for(const id of ['book','protect']) {
    s=cityPreviewStep(s,{type:'SELECT',id});s=cityPreviewStep(s,{type:'RETURN',row:1});
  }
  assert.equal(s.phase,'DONE');assert.equal(s.held.length,4);
  assert.equal(cityPreviewStep(s,{type:'SELECT',id:'family'}),s);
  const reset=cityPreviewStep(s,{type:'RESET'});assert.equal(reset.phase,'USE');assert.equal(reset.held.length,6);assert.equal(reset.selected,null);
});
test('city selection cancel and rejected repeated clicks never use or return a tile twice',()=>{
  let s=cityPreviewStep(startCityPreview(),{type:'SELECT',id:'produce'});
  s=cityPreviewStep(s,{type:'SELECT',id:null});assert.equal(cityPreviewStep(s,{type:'USE'}),s);
  assert.equal(cityPreviewStep(s,{type:'SELECT',id:'foreign-id'}),s);
  s=cityPreviewStep(s,{type:'SELECT',id:'produce'});s=cityPreviewStep(s,{type:'USE'});
  assert.equal(cityPreviewStep(s,{type:'USE'}),s);assert.equal(cityPreviewStep(s,{type:'SELECT',id:'produce'}),s);
});
