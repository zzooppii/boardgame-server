import assert from 'node:assert/strict';
import {test} from 'node:test';
import {a, b, example} from './speakeasy.fixture.js';
import {speakeasyFixedBookGoals} from './games/speakeasy/domain/fixed-goals.js';
import {cookRestaurantBook} from './games/speakeasy/domain/restaurant-actions.js';
import {parseSpeakeasyEconomy, speakeasyInventory} from './games/speakeasy/domain/model.js';

function state(kind: string, amount: number) {
  const s = example(), p = s.players[0]!;
  if (kind === 'CRATES') p.crates = Array.from({length: amount}, (_, i) => i + 1);
  if (kind === 'INFAMY') {
    p.levels = {VIP: 1, PARTY: 1, STILLS: 1, FLEET: 1, STRENGTH: 1};
    let remaining = amount - 5;
    for (const key of ['VIP', 'PARTY', 'STILLS', 'FLEET', 'STRENGTH'] as const) {
      const increase = Math.min(4, remaining); p.levels[key] += increase; remaining -= increase;
    }
  }
  if (kind === 'PROTECTED_DISTRICTS') {
    for (let i = 0; i < amount; i++) s.districts[i]!.slots[0] = {
      piece: p.reserves.shift()!, ownerId: a, familyId: p.familyReserve.shift()!, barrelId: null,
    };
  }
  return parseSpeakeasyEconomy(s);
}

for (const [id, kind, minimum, payout] of [
  ['fixed:docks:1', 'CRATES', 1, 15], ['fixed:docks:2', 'CRATES', 2, 15], ['fixed:docks:3', 'CRATES', 3, 15],
  ['fixed:city-hall:3', 'PROTECTED_DISTRICTS', 3, 20], ['fixed:city-hall:5', 'PROTECTED_DISTRICTS', 5, 20],
  ['fixed:city-hall:7', 'PROTECTED_DISTRICTS', 7, 20], ['fixed:infamy:10', 'INFAMY', 10, 10],
  ['fixed:infamy:15', 'INFAMY', 15, 15], ['fixed:infamy:22', 'INFAMY', 22, 20],
] as const) test(`Printed goal ${id} checks its boundary and pays only the safe`, () => {
  const goals = speakeasyFixedBookGoals();
  const below = state(kind, minimum - 1), before = structuredClone(below);
  assert.deepEqual(cookRestaurantBook(below, a, id, 0, goals), {ok: false, reason: 'INVALID_ACTION'});
  assert.deepEqual(below, before);
  for (const amount of [minimum, minimum + 1]) {
    const s = state(kind, amount), original = structuredClone(s), result = cookRestaurantBook(s, a, id, 0, goals);
    assert.ok(result.ok);
    assert.equal(result.value.players[0]!.safe, s.players[0]!.safe + payout);
    assert.equal(result.value.players[0]!.cash, s.players[0]!.cash);
    assert.equal(result.value.players[0]!.books, s.players[0]!.books - 1);
    assert.deepEqual(result.value.placedBooks, [{goalId: id, space: 0, ownerId: a}]);
    assert.deepEqual(speakeasyInventory(result.value), speakeasyInventory(s));
    assert.deepEqual(s, original);
    assert.equal(cookRestaurantBook(result.value, a, id, 1, goals).ok, false);
  }
});

test('City Hall counts distinct protected districts, not buildings or unprotected districts', () => {
  const s = state('PROTECTED_DISTRICTS', 3);
  s.districts[0]!.slots[1] = s.districts[2]!.slots[0]!; s.districts[2]!.slots[0] = null;
  assert.equal(cookRestaurantBook(s, a, 'fixed:city-hall:3', 0, speakeasyFixedBookGoals()).ok, false);
  s.districts[2]!.slots[0] = s.districts[0]!.slots[1]!; s.districts[0]!.slots[1] = null;
  const building = s.districts[2]!.slots[0]!;
  s.players[0]!.familyReserve.push(building.familyId!); building.familyId = null;
  assert.equal(cookRestaurantBook(s, a, 'fixed:city-hall:3', 0, speakeasyFixedBookGoals()).ok, false);
});

test('Two players may use different spaces of one fixed goal, but occupied spaces cannot be reused', () => {
  const s = state('CRATES', 1); s.players[1]!.crates = [2];
  const goals = speakeasyFixedBookGoals(), first = cookRestaurantBook(s, a, 'fixed:docks:1', 0, goals);
  assert.ok(first.ok);
  assert.equal(cookRestaurantBook(first.value, b, 'fixed:docks:1', 0, goals).ok, false);
  const second = cookRestaurantBook(first.value, b, 'fixed:docks:1', 1, goals);
  assert.ok(second.ok); assert.equal(second.value.players[1]!.safe, 45);
  assert.equal(second.value.placedBooks.length, 2);
});

test('Fixed goals have stable unique IDs and detached metadata', () => {
  const goals = speakeasyFixedBookGoals();
  assert.equal(goals.length, 9); assert.equal(new Set(goals.map(g => g.id)).size, 9);
  goals.splice(0, 9);
  assert.equal(speakeasyFixedBookGoals().length, 9);
});
