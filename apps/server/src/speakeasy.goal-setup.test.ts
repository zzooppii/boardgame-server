import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareSpeakeasyGoals} from './games/speakeasy/domain/goal-setup.js';
import {tile} from './speakeasy.fixture.js';

// Selection examples only, not a catalog of printed conditions or group membership.
const tiles = (prefix: string, numbers: number[]) => numbers.map((number, i) => ({tileId: tile(`${prefix}-${i}`), number}));
function seed() {
  return {zone: tiles('zone', [1, 1, 2, 2, 3, 3, 1, 2, 3]), park: {
    A: tiles('A', [1, 2, 3, 4, 5, 6, 7]), B: tiles('B', [1, 2, 3, 3, 4, 5, 6]),
    C: tiles('C', [1, 2, 3, 4, 5, 6, 7])}};
}
test('Goals select first eligible zone tiles and A/A/B/B/C park tiles in placement order', () => {
  const s = prepareSpeakeasyGoals(seed());
  assert.deepEqual(s.zone.map(t => t.tileId), ['zone-0', 'zone-2', 'zone-4']);
  assert.deepEqual(s.park.map(p => [p.group, p.tile.tileId]), [['A', 'A-0'], ['A', 'A-1'], ['B', 'B-2'], ['B', 'B-4'], ['C', 'C-4']]);
  assert.deepEqual(s.zone.map(t => t.number), [1, 2, 3]);
  assert.deepEqual(s.park.map(p => p.tile.number), [1, 2, 3, 4, 5]); // Separate number namespaces.
});
test('Goals return skipped and untouched tiles, preserving all 30 identities exactly once', () => {
  const input = seed(), s = prepareSpeakeasyGoals(input);
  const all = [...input.zone, ...Object.values(input.park).flat()].map(t => t.tileId).sort();
  assert.equal(s.returned.length, 22);
  assert.deepEqual([...s.zone, ...s.park.map(p => p.tile), ...s.returned].map(t => t.tileId).sort(), all);
  for (const id of ['zone-1', 'zone-8', 'A-2', 'B-0', 'B-3', 'B-6', 'C-0', 'C-6']) {
    assert.ok(s.returned.some(t => t.tileId === id));
  }
});
test('Goals respect shuffled order instead of sorting goal numbers', () => {
  const input = seed(); input.zone.reverse(); input.park.A.reverse(); input.park.B.reverse(); input.park.C.reverse();
  const s = prepareSpeakeasyGoals(input);
  assert.deepEqual(s.zone.map(t => t.number), [3, 2, 1]);
  assert.deepEqual(s.park.map(p => p.tile.number), [7, 6, 5, 4, 3]);
});
test('Goals do not infer unverified equal group sizes', () => {
  const input = seed(); input.park.C.push(...input.park.A.splice(2));
  assert.equal(prepareSpeakeasyGoals(input).park.length, 5);
});
test('Goal preparation is deterministic and owns its result objects', () => {
  const input = seed(), before = structuredClone(input), s = prepareSpeakeasyGoals(input);
  assert.deepEqual(s, prepareSpeakeasyGoals(input));
  s.zone[0]!.number = 99; s.park[0]!.tile.number = 99; s.returned[0]!.number = 99;
  assert.deepEqual(input, before);
});
for (const group of ['zone', 'A', 'B', 'C']) test(`Goals reject unusable ${group} selection without changing inputs`, () => {
  const input = seed();
  const pile = group === 'zone' ? input.zone : group === 'A' ? input.park.A : group === 'B' ? input.park.B : input.park.C;
  for (const t of pile) t.number = 1;
  const before = structuredClone(input);
  assert.throws(() => prepareSpeakeasyGoals(input));
  assert.deepEqual(input, before);
});
test('Goals reject missing inventory, duplicate physical IDs across groups and malformed numbers', () => {
  const input = seed();
  for (const bad of [null, {...input, zone: input.zone.slice(1)}, {...input, park: {...input.park, C: []}},
    {...input, park: {...input.park, C: [...input.park.C, input.zone[0]]}}, {...input, reward: 100}]) {
    assert.throws(() => prepareSpeakeasyGoals(bad));
  }
  for (const number of [0, -1, 1.5, NaN, Infinity, '1']) {
    assert.throws(() => prepareSpeakeasyGoals({...input, zone: [{...input.zone[0], number}, ...input.zone.slice(1)]}));
  }
  input.park.C[0]!.tileId = input.zone[0]!.tileId;
  assert.throws(() => prepareSpeakeasyGoals(input));
});
