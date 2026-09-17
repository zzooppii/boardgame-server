import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {TileIdSchema, type SpeakeasyPracticeAction, type SpeakeasyPracticeView} from '@hangul-rummikub/shared';
import {practiceDistrictChoices, practiceDistrictFilter, practiceFlowHint} from '../features/speakeasy/practice-guide.js';

type Choice = SpeakeasyPracticeView['choices'][number];
const buildingId = parse(TileIdSchema, 'guide-test-building');
function choice(action: SpeakeasyPracticeAction, district: number, route: number[] = []): Choice {
  return {action, label: '선택', detail: '설명', preview: {targets: [{district, slot: 0}], route,
    delta: {cash: 0, safe: 0, stock: 0, family: 0, truckLoad: 0}}};
}
const produce = choice({type: 'PRODUCE'}, 1);
const deliver = choice({type: 'DELIVER', buildingId}, 2, [1, 2]);
const sell = choice({type: 'SELL', buildingId}, 2);
const build = choice({type: 'BUILD', kind: 'SPEAKEASY', district: 3, slot: 0}, 3);
const move = choice({type: 'MOVE', district: 3}, 3, [1, 2, 3]);
const base = {finished: false, actionsLeft: 2, choices: [produce], stock: 0, truck: {district: null, load: 0}};

test('Selecting a district excludes production elsewhere and routes that only pass through', () => {
  const choices = [produce, deliver, sell, build, move];
  assert.deepEqual(practiceDistrictChoices(choices, 1), [produce]);
  assert.deepEqual(practiceDistrictChoices(choices, 2), [deliver, sell]);
  assert.deepEqual(practiceDistrictChoices(choices, 3), [build, move]);
  assert.deepEqual(practiceDistrictChoices(choices, null), choices);
  assert.deepEqual(practiceDistrictChoices(choices, 16), []);
});
test('Map selection keeps an available category and otherwise opens an executable category', () => {
  const choices = [produce, deliver, sell, build, move];
  assert.equal(practiceDistrictFilter(choices, 2, 'PRODUCE'), 'SELL');
  assert.equal(practiceDistrictFilter(choices, 2, 'DELIVER'), 'DELIVER');
  assert.equal(practiceDistrictFilter(choices, 3, 'PRODUCE'), 'BUILD');
  assert.equal(practiceDistrictFilter([], 3, 'PRODUCE'), 'PRODUCE');
});
test('The learning flow follows server choices from production to delivery and sale', () => {
  assert.equal(practiceFlowHint(base).type, 'PRODUCE');
  assert.equal(practiceFlowHint({...base, stock: 2, choices: [produce, deliver]}).type, 'DELIVER');
  assert.equal(practiceFlowHint({...base, choices: [produce, deliver, sell]}).type, 'SELL');
  assert.equal(practiceFlowHint({...base, choices: []}).type, null);
});
test('Exhausted actions and finished games never suggest stale executable choices', () => {
  assert.equal(practiceFlowHint({...base, actionsLeft: 0, choices: [sell]}).type, 'END_TURN');
  assert.equal(practiceFlowHint({...base, finished: true, actionsLeft: 0, choices: [sell]}).type, null);
});
test('Stored or loaded liquor does not encourage repeating production when delivery is unavailable', () => {
  assert.equal(practiceFlowHint({...base, stock: 2}).type, null);
  assert.equal(practiceFlowHint({...base, truck: {district: 2, load: 1}}).type, null);
});
