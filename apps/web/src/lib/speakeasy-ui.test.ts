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
  const cues: readonly SpeakeasyCue[] = ['SELECT', 'CANCEL', 'BUILD', 'PRODUCE', 'DELIVER', 'SELL', 'PROTECT', 'SETTLE', 'ERROR'];
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
