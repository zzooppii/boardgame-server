import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parse} from 'valibot';
import {GameIdSchema} from '@hangul-rummikub/shared';
import {prepareSpeakeasyBoard} from './games/speakeasy/domain/board-setup.js';
import {parseSpeakeasyEconomy} from './games/speakeasy/domain/model.js';
import {startSpeakeasyLuciano, advanceSpeakeasyLuciano} from './games/speakeasy/domain/luciano.js';
import {example, tile} from './speakeasy.fixture.js';

const ids = Array.from({length: 16}, (_, i) => i + 1);
const rotate = (offset: number) => [...ids.slice(offset), ...ids.slice(0, offset)];
// Example strengths only: no claim that these are the printed A-tile catalog.
function seed(playerCount = 2) {
  return {playerCount, ...(playerCount === 2 ? {blockedDistrictOrder: [...ids]} : {}),
    mobsterDistrictOrder: [...ids], copDistrictOrder: [...ids],
    setupMobsters: Array.from({length: playerCount === 2 ? 4 : 6}, (_, i) => ({tileId: tile(`setup-mob-${i}`), strength: i + 1}))};
}

test('Board setup blocks 2/2/1 districts and returns skipped districts to the mobster draw', () => {
  const s = prepareSpeakeasyBoard(seed());
  assert.deepEqual(s.districts.filter(d => d.blocked).map(d => d.id), [1, 2, 7, 8, 13]);
  assert.deepEqual(s.initialMobsters.map(m => m.district), [3, 4, 5, 6]);
  assert.deepEqual(s.mobsterDistrictsByAct, [[9, 10], [11, 12], [14, 15, 16]]);
  assert.deepEqual(s.copDistrictsByAct, [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]);
  assert.ok(s.districts[0]!.blocked && s.districts[0]!.cop);
  assert.equal(s.districts.filter(d => !d.blocked).reduce((n, d) => n + d.slots.length, 0), 22);
});

for (const players of [2, 3, 4]) test(`Board setup preserves all scheduled districts and printed slot counts for ${players} players`, () => {
  for (let offset = 0; offset < 16; offset++) {
    const input = {...seed(players), ...(players === 2 ? {blockedDistrictOrder: rotate(offset)} : {}),
      mobsterDistrictOrder: rotate((offset + 5) % 16), copDistrictOrder: rotate((offset + 9) % 16)};
    const before = structuredClone(input), s = prepareSpeakeasyBoard(input);
    const blocked = s.districts.filter(d => d.blocked).map(d => d.id);
    assert.deepEqual([blocked.filter(id => id <= 6).length, blocked.filter(id => id > 6 && id <= 12).length,
      blocked.filter(id => id > 12).length], players === 2 ? [2, 2, 1] : [0, 0, 0]);
    const allMobsters = [...s.initialMobsters.map(m => m.district), ...s.mobsterDistrictsByAct.flat()];
    assert.deepEqual([...allMobsters, ...blocked].sort((a, b) => a - b), ids);
    assert.deepEqual(allMobsters, input.mobsterDistrictOrder.filter(id => !blocked.includes(id)));
    assert.deepEqual(s.mobsterDistrictsByAct.map(a => a.length), players === 2 ? [2, 2, 3] : [3, 3, 4]);
    assert.deepEqual([...s.districts.filter(d => d.cop).map(d => d.id), ...s.copDistrictsByAct.flat()].sort((a, b) => a - b), ids);
    assert.deepEqual(s.copDistrictsByAct.flat(), input.copDistrictOrder.slice(4));
    for (const d of s.districts) {
      assert.equal(d.slots.length, d.id >= 13 && players !== 2 ? 3 : 2);
      assert.ok(d.slots.every(b => b === null));
      const initial = s.initialMobsters.find(m => m.district === d.id);
      assert.equal(d.mobsterStrength, initial?.mobster.strength ?? null);
      assert.deepEqual(d.mobsterSlots, initial ? d.slots.map((_, i) => i) : []);
    }
    assert.deepEqual(input, before);
    assert.deepEqual(prepareSpeakeasyBoard(input), s);
    assert.doesNotThrow(() => parseSpeakeasyEconomy({...example(players), districts: s.districts}));
  }
});

test('Board setup result owns its objects and does not mutate the shuffled inputs', () => {
  const input = seed(), before = structuredClone(input), result = prepareSpeakeasyBoard(input);
  result.initialMobsters[0]!.mobster.strength = 99;
  result.mobsterDistrictsByAct[0]!.reverse();
  result.districts[0]!.cop = false;
  assert.deepEqual(input, before);
});

test('Board setup rejects invalid counts, missing/duplicate districts and unverified extra input fields', () => {
  const s = seed();
  for (const input of [null, {...s, playerCount: 1}, {...s, playerCount: 5}, {...s, blockedDistrictOrder: undefined},
    {...seed(3), blockedDistrictOrder: ids}, {...s, setupMobsters: s.setupMobsters.slice(1)},
    {...s, setupMobsters: [s.setupMobsters[0], ...s.setupMobsters.slice(0, 3)]},
    {...s, setupMobsters: s.setupMobsters.map(m => ({...m, strength: -1}))}, {...s, safe: 100}]) {
    assert.throws(() => prepareSpeakeasyBoard(input));
  }
  for (const field of ['blockedDistrictOrder', 'mobsterDistrictOrder', 'copDistrictOrder']) {
    for (const order of [ids.slice(1), [...ids, 1], [...ids.slice(1), 2], [0, ...ids.slice(1)], [17, ...ids.slice(1)], [1.5, ...ids.slice(1)]]) {
      assert.throws(() => prepareSpeakeasyBoard({...s, [field]: order}));
    }
  }
});

for (const players of [2, 3, 4]) test(`Prepared ${players}-player board runs through the first Luciano phase with the existing engine`, () => {
  const board = prepareSpeakeasyBoard(seed(players));
  const economy = parseSpeakeasyEconomy({...example(players), districts: board.districts});
  let s = startSpeakeasyLuciano({gameId: parse(GameIdSchema, 'setup-integration'), revision: 0, act: 1,
    order: economy.players.map(p => p.playerId), economy, districts: board.mobsterDistrictsByAct[0],
    copDistricts: board.copDistrictsByAct[0],
    deck: board.mobsterDistrictsByAct[0].map(id => ({tileId: tile(`incoming-${id}`), strength: 2, modifier: 0})),
    payoutTables: [[20, 10, 5, 0, 0], [20, 10, 5, 0, 0], [20, 10, 5, 0, 0]]});
  while (s.phase !== 'COMPLETE') {
    const outcome = advanceSpeakeasyLuciano(s, s); assert.ok(outcome.ok); s = outcome.value;
  }
  assert.equal(s.economy.districts.filter(d => d.cop).length, 8);
  assert.equal(s.revealed.length, players === 2 ? 2 : 3);
  assert.deepEqual(s.economy.districts.filter(d => d.blocked), board.districts.filter(d => d.blocked).map(d =>
    ({...d, cop: d.cop || board.copDistrictsByAct[0].includes(d.id)})));
  assert.ok(s.payouts.every(p => p.amount === 0)); // Players have no buildings in this setup slice.
});
