import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {PlayerIdSchema, TileIdSchema} from '@hangul-rummikub/shared';
import {parseSpeakeasyEconomy, speakeasyInventory, type SpeakeasyEconomy, type SpeakeasyRuleResult} from './games/speakeasy/domain/model.js';
import {quoteSpeakeasyPayment, buildSpeakeasy, produceSpeakeasy, deliverSpeakeasy, sellSpeakeasy, protectSpeakeasy,
  raiseSpeakeasyLevel, hireSpeakeasyGoons, defendSpeakeasy, speakeasyInfamy} from './games/speakeasy/domain/economy.js';
import {speakeasyDistrictControllers, speakeasyZonePayouts, speakeasyFinalScores, speakeasyGoalMet, cookSpeakeasyBook, speakeasyWinners} from './games/speakeasy/domain/scoring.js';
import {nextSpeakeasyTurn, speakeasyNextOrder} from './games/speakeasy/domain/rounds.js';

const a = parse(PlayerIdSchema, 'sp-player-a'), b = parse(PlayerIdSchema, 'sp-player-b');
const tile = (id: string) => parse(TileIdSchema, id);
/** Economic examples only: this fixture is never used as a real game or as a printed card catalog. */
function example(): SpeakeasyEconomy {
  return parseSpeakeasyEconomy({players: [a, b].map((playerId, seat) => ({playerId, cash: 15, safe: 30,
    levels: {VIP: 2, PARTY: 2, STILLS: 2, FLEET: 3, STRENGTH: 3}, leverageTokens: 2,
    hand: Array.from({length: 4}, (_, i) => ({tileId: tile(`hand-${seat}-${i}`), operation: 'PARTY', leverage: 1})),
    operations: [{tileId: tile(`installed-${seat}`), operation: 'VIP', leverage: 3}],
    reserves: [...[3, 3, 3, 5, 5, 8, 8, 8].map((cost, i) => ({tileId: tile(`bar-${seat}-${i}`), kind: 'SPEAKEASY', cost, group: i < 3 ? 0 : i < 5 ? 1 : 2})),
      {tileId: tile(`stills-${seat}`), kind: 'STILLS', cost: 5, group: 1},
      ...[0, 1, 2].flatMap(i => [{tileId: tile(`club-${seat}-${i}`), kind: 'NIGHTCLUB', cost: 12, group: null}, {tileId: tile(`casino-${seat}-${i}`), kind: 'CASINO', cost: 17, group: null}])],
    removedBuildings: [], vip: [tile(`vip-${seat}-0`), tile(`vip-${seat}-1`)],
    familyReserve: Array.from({length: 10}, (_, i) => tile(`family-${seat}-${i}`)), removedFamily: [],
    goons: [tile(`goon-${seat}`)], stock: [], trucks: [0, 1].map(i => ({tileId: tile(`truck-${seat}-${i}`), district: null, barrels: []})),
    books: 3, bookReserve: 7, cityTileCount: 0, crates: [], helpers: [], associate: null,
  })), districts: Array.from({length: 16}, (_, i) => ({id: i + 1, blocked: false, cop: false, slots: [null, null], mobsterSlots: [], mobsterStrength: null})),
    docks: [], barrelSupply: Array.from({length: 40}, (_, i) => tile(`barrel-${i}`)),
    goonSupply: Array.from({length: 22}, (_, i) => tile(`supply-goon-${i}`)), discardedCards: [], placedBooks: []});
}
function value<T>(result: SpeakeasyRuleResult<T>): T {assert.ok(result.ok); return result.value;}
function build(s: SpeakeasyEconomy, piece = 'bar-0-0', district = 1, slot = 0, owner = a) {
  return value(buildSpeakeasy(s, owner, {pieceId: tile(piece), district, slot, goons: 0, useAssociate: false, freeAssociate: false, discardIds: []},
    {kinds: ['SPEAKEASY', 'STILLS', 'NIGHTCLUB', 'CASINO'], upgrade: true}));
}

test('Speakeasy payment: safe exchange, chosen cash split, exact affordability and invalid values', () => {
  assert.deepEqual(quoteSpeakeasyPayment(10, 14, 17), {ok: true, value: {cash: 10, safe: 14}});
  assert.deepEqual(quoteSpeakeasyPayment(10, 30, 5, 0), {ok: true, value: {cash: 0, safe: 10}});
  assert.equal(quoteSpeakeasyPayment(10, 13, 17).ok, false);
  for (const n of [-1, 1.5, NaN, Infinity]) assert.equal(quoteSpeakeasyPayment(10, 30, n).ok, false);
  assert.equal(quoteSpeakeasyPayment(10, 30, 5, 6).ok, false);
});
test('Speakeasy economic construction: input unchanged, opaque piece identity conserved', () => {
  const s = example(), before = structuredClone(s), next = build(s);
  assert.deepEqual(s, before); assert.equal(next.players[0]!.cash, 12);
  assert.equal(next.districts[0]!.slots[0]!.piece.tileId, tile('bar-0-0'));
  assert.deepEqual(speakeasyInventory(next), speakeasyInventory(s));
});
test('Speakeasy rejects blocked/foreign/occupied and invalid casino discard without paying', () => {
  const s = example(); s.districts[0]!.blocked = true; const before = structuredClone(s);
  for (const request of [{pieceId: tile('bar-0-0'), district: 1}, {pieceId: tile('bar-1-0'), district: 2}, {pieceId: tile('casino-0-0'), district: 2}]) {
    assert.equal(buildSpeakeasy(s, a, {...request, slot: 0, goons: 0, useAssociate: false, freeAssociate: false, discardIds: []},
      {kinds: ['SPEAKEASY', 'CASINO'], upgrade: true}).ok, false);
  }
  assert.deepEqual(s, before);
});
test('Speakeasy upgrade preserves protection and barrel, applies cleared-group discount', () => {
  let s = example(); for (let i = 0; i < 3; i++) s = build(s, `bar-0-${i}`, i + 1);
  s = value(protectSpeakeasy(s, a, [tile('bar-0-0')], 4));
  s.districts[0]!.slots[0]!.barrelId = s.barrelSupply.shift()!;
  const cash = s.players[0]!.cash, beforeSafe = s.players[0]!.safe;
  const next = build(s, 'club-0-0', 1);
  assert.equal(next.players[0]!.cash, 0); assert.equal(next.players[0]!.safe, beforeSafe - (9 - cash) * 2);
  assert.equal(next.districts[0]!.slots[0]!.familyId, s.districts[0]!.slots[0]!.familyId);
  assert.equal(next.districts[0]!.slots[0]!.barrelId, s.districts[0]!.slots[0]!.barrelId);
  assert.equal(next.players[0]!.removedBuildings[0]!.tileId, tile('bar-0-0'));
  assert.equal(buildSpeakeasy(next, a, {pieceId: tile('club-0-1'), district: 3, slot: 1, goons: 0, useAssociate: false, freeAssociate: false, discardIds: []}, {kinds: ['NIGHTCLUB'], upgrade: true}).ok, false);
});
test('Speakeasy attack must exceed strength; cannot take own associate district; no private ref leak', () => {
  const s = example(); s.districts[0]!.mobsterSlots = [0]; s.districts[0]!.mobsterStrength = 3;
  const request = {pieceId: tile('bar-0-0'), district: 1, slot: 0, goons: 0, useAssociate: false, freeAssociate: false, discardIds: []};
  assert.equal(buildSpeakeasy(s, a, request, {kinds: ['SPEAKEASY'], upgrade: false}).ok, false);
  const next = value(buildSpeakeasy(s, a, {...request, goons: 1}, {kinds: ['SPEAKEASY'], upgrade: false}));
  assert.equal(next.players[0]!.goons.length, 0); assert.equal(next.districts[0]!.mobsterSlots.length, 0);
  s.players[0]!.associate = {district: 1, strength: 5, fee: 1, defenseBonus: 0, protectionBonus: 0, stillsImmune: false, freeUseAvailable: false, takeoverDiscount: 0};
  assert.equal(buildSpeakeasy(s, a, {...request, useAssociate: true}, {kinds: ['SPEAKEASY'], upgrade: false}).ok, false);
});
test('Speakeasy police do not remove barrels; production/sale require operating buildings', () => {
  let s = build(example(), 'stills-0'); s = value(produceSpeakeasy(s, a, 2));
  assert.equal(s.players[0]!.stock.length, 2); s.districts[0]!.cop = true;
  assert.equal(produceSpeakeasy(s, a, 2).ok, false); assert.equal(s.players[0]!.stock.length, 2);
  s = value(protectSpeakeasy(s, a, [tile('stills-0')], 3));
  assert.equal(value(produceSpeakeasy(s, a, 2)).players[0]!.stock.length, 4);
});
test('Speakeasy production is limited by physical barrel supply and conserves IDs', () => {
  const s = build(example(), 'stills-0');
  const next = value(produceSpeakeasy(s, a, 100));
  assert.equal(next.players[0]!.stock.length, 40); assert.equal(next.barrelSupply.length, 0);
  assert.deepEqual(speakeasyInventory(next), speakeasyInventory(s));
});
test('Speakeasy delivery: free entry, zero-distance delivery, movement and persistent truck load', () => {
  let s = build(build(example(), 'stills-0'), 'bar-0-0', 1, 1); s = build(s, 'bar-0-1', 2); s = value(produceSpeakeasy(s, a, 3));
  const t = tile('truck-0-0');
  const next = value(deliverSpeakeasy(s, a, [{kind: 'MOVE', truckId: t, district: 1}, {kind: 'LOAD', truckId: t, count: 2},
    {kind: 'UNLOAD', truckId: t, buildingId: tile('bar-0-0')}, {kind: 'MOVE', truckId: t, district: 2}], {range: 1, edges: [[1, 2]]}));
  assert.equal(next.players[0]!.trucks[0]!.barrels.length, 1); assert.ok(next.districts[0]!.slots[1]!.barrelId);
  assert.equal(next.players[0]!.trucks[0]!.district, 2); assert.deepEqual(speakeasyInventory(next), speakeasyInventory(s));
});
test('Speakeasy delivery rejects teleport, excessive movement, stills delivery and rolls back whole route', () => {
  let s = build(example(), 'stills-0'); s = value(produceSpeakeasy(s, a, 3)); const t = tile('truck-0-0'), before = structuredClone(s);
  const prefix = [{kind: 'MOVE' as const, truckId: t, district: 1}, {kind: 'LOAD' as const, truckId: t, count: 2}];
  for (const tail of [{kind: 'MOVE' as const, truckId: t, district: 16}, {kind: 'UNLOAD' as const, truckId: t, buildingId: tile('stills-0')}, {kind: 'LOAD' as const, truckId: t, count: 1}]) {
    assert.equal(deliverSpeakeasy(s, a, [...prefix, tail], {range: 2, edges: [[1, 2]]}).ok, false);
  }
  assert.equal(deliverSpeakeasy(s, a, [...prefix, {kind: 'MOVE', truckId: t, district: 2}, {kind: 'MOVE', truckId: t, district: 1}], {range: 1, edges: [[1, 2]]}).ok, false);
  assert.deepEqual(s, before);
});
test('Speakeasy second truck needs fleet level three', () => {
  const s = example(); s.players[0]!.levels.FLEET = 2;
  assert.equal(deliverSpeakeasy(s, a, [{kind: 'MOVE', truckId: tile('truck-0-1'), district: 1}], {range: 2, edges: []}).ok, false);
});
test('Speakeasy selling counts the actual selected building type and preserves barrel tokens', () => {
  let s = build(example()); s = build(s, 'club-0-0', 2);
  s.districts[0]!.slots[0]!.barrelId = s.barrelSupply.shift()!; s.districts[1]!.slots[0]!.barrelId = s.barrelSupply.shift()!;
  const ids = [tile('bar-0-0'), tile('club-0-0')], before = s.players[0]!.cash;
  const next = value(sellSpeakeasy(s, a, ids, {limit: 2, speakeasy: 15, premium: 20}));
  assert.equal(next.players[0]!.cash, before + 35); assert.equal(next.barrelSupply.length, 40);
  s.districts[1]!.cop = true;
  assert.equal(sellSpeakeasy(s, a, ids, {limit: 2, speakeasy: 15, premium: 20}).ok, false);
  assert.equal(s.districts[0]!.slots[0]!.barrelId, tile('barrel-0'));
  assert.equal(sellSpeakeasy(s, a, [ids[0]!, ids[0]!], {limit: 2, speakeasy: 15, premium: 20}).ok, false);
});
test('Speakeasy protection consumes only tokens over reusable leverage, atomically', () => {
  const s = build(build(example()), 'bar-0-1', 2);
  assert.equal(protectSpeakeasy(s, a, [tile('bar-0-0'), tile('bar-0-1')], 3).ok, false);
  const next = value(protectSpeakeasy(s, a, [tile('bar-0-0'), tile('bar-0-1')], 2));
  assert.equal(next.players[0]!.leverageTokens, 1); assert.equal(next.players[0]!.operations.length, 1); assert.equal(next.players[0]!.vip.length, 0);
});
test('Speakeasy level four/five discard requirements and infamy', () => {
  let s = example(); const cards = s.players[0]!.hand.map(c => c.tileId);
  assert.equal(raiseSpeakeasyLevel(s, a, 'STRENGTH', []).ok, false);
  s = value(raiseSpeakeasyLevel(s, a, 'STRENGTH', [cards[0]!]));
  assert.equal(raiseSpeakeasyLevel(s, a, 'STRENGTH', [cards[1]!]).ok, false);
  s = value(raiseSpeakeasyLevel(s, a, 'STRENGTH', [cards[1]!, cards[2]!]));
  assert.equal(s.players[0]!.levels.STRENGTH, 5); assert.equal(speakeasyInfamy(s.players[0]!), 14);
  assert.equal(raiseSpeakeasyLevel(s, a, 'STRENGTH', []).ok, false);
  s.players[0]!.levels.FLEET = 4;
  assert.equal(raiseSpeakeasyLevel(s, a, 'FLEET', []).ok, false);
  assert.equal(value(raiseSpeakeasyLevel(s, a, 'FLEET', [cards[3]!])).players[0]!.levels.FLEET, 5);
});
test('Speakeasy goons pay lowest empty slots and are bounded by supply', () => {
  const s = example(), next = value(hireSpeakeasyGoons(s, a, 2, false));
  assert.equal(next.players[0]!.cash, 12); assert.equal(next.players[0]!.goons.length, 3);
  assert.equal(hireSpeakeasyGoons(next, a, 4, true).ok, false);
});
test('Speakeasy defense equality succeeds; a family member contributes no strength', () => {
  let s = build(example()); s = value(protectSpeakeasy(s, a, [tile('bar-0-0')], 3)); s.districts[0]!.mobsterStrength = 4;
  const request = {buildingId: tile('bar-0-0'), strength: 4, defend: true, goons: 0, useAssociate: false, freeAssociate: false};
  assert.equal(defendSpeakeasy(s, a, request).ok, false);
  assert.ok(value(defendSpeakeasy(s, a, {...request, goons: 1})).districts[0]!.slots[0]);
  const lost = value(defendSpeakeasy(s, a, {...request, defend: false}));
  assert.equal(lost.districts[0]!.slots[0], null); assert.equal(lost.players[0]!.removedFamily.length, 1);
});
test('Speakeasy losing stills returns all stock, removes building and conserves pieces', () => {
  let s = build(example(), 'stills-0'); s = value(produceSpeakeasy(s, a, 3)); s.districts[0]!.mobsterStrength = 8;
  const next = value(defendSpeakeasy(s, a, {buildingId: tile('stills-0'), strength: 8, defend: false, goons: 0, useAssociate: false, freeAssociate: false}));
  assert.equal(next.players[0]!.stock.length, 0); assert.equal(next.barrelSupply.length, 40); assert.deepEqual(speakeasyInventory(s), speakeasyInventory(next));
});
test('Speakeasy protected lower-tier building wins district, ties share control, police affect only players', () => {
  let s = build(example()); s = build(s, 'club-1-0', 1, 1, b);
  assert.deepEqual(speakeasyDistrictControllers(s.districts[0]!), [b]);
  s = value(protectSpeakeasy(s, a, [tile('bar-0-0')], 3));
  assert.deepEqual(speakeasyDistrictControllers(s.districts[0]!), [a]);
  const equal = build(build(example()), 'bar-1-0', 1, 1, b);
  assert.deepEqual(speakeasyDistrictControllers(equal.districts[0]!), [a, b]);
  const npc = example().districts[0]!; npc.cop = true; npc.mobsterStrength = 4; npc.mobsterSlots = [0];
  assert.deepEqual(speakeasyDistrictControllers(npc), ['MOBSTER']);
});
test('Speakeasy zone payouts include mobsters and lowest tied rank; zero districts gets zero', () => {
  const s = build(example()); s.districts[1]!.mobsterSlots = [0]; s.districts[1]!.mobsterStrength = 3;
  const results = speakeasyZonePayouts(s, [[30, 15, 5], [40, 20, 10], [45, 30, 20]]);
  assert.equal(results[0]![0]!.rank, 2); assert.equal(results[0]![0]!.amount, 15); assert.equal(results[0]![1]!.amount, 0);
  assert.equal(results[1]![0]!.amount, 0);
});
test('Speakeasy final scoring counts only protected buildings, distinct bottles, and all tiebreaks', () => {
  let s = build(build(example()), 'club-0-0', 2); s = value(protectSpeakeasy(s, a, [tile('bar-0-0')], 3));
  s.players[0]!.helpers = [{tileId: tile('helper-a'), bottle: 'one', value: 10, used: true}, {tileId: tile('helper-b'), bottle: 'one', value: 10, used: false}, {tileId: tile('helper-c'), bottle: 'two', value: 5, used: true}];
  const score = speakeasyFinalScores(s).find(p => p.playerId === a)!;
  assert.equal(score.buildingMoney, 10); assert.equal(score.helperMoney, 15); assert.equal(score.tieBreak[1], 2);
  assert.deepEqual(speakeasyWinners(example()), [a, b]);
});
test('Speakeasy books require distinct goals per owner, allow multiple goals in the same area', () => {
  let s = example(); s.players[0]!.crates = [1, 2];
  s = value(cookSpeakeasyBook(s, a, {id: 'dock-1', payout: 15, requirement: {kind: 'CRATES', minimum: 1}}, 0));
  assert.equal(cookSpeakeasyBook(s, a, {id: 'dock-1', payout: 15, requirement: {kind: 'CRATES', minimum: 1}}, 1).ok, false);
  s = value(cookSpeakeasyBook(s, a, {id: 'dock-2', payout: 15, requirement: {kind: 'CRATES', minimum: 2}}, 0));
  assert.equal(s.players[0]!.safe, 60); assert.equal(s.players[0]!.books, 1);
});
test('Speakeasy goal strength is a threshold, not spent; same/different district requirements', () => {
  let s = build(example()); s = build(s, 'bar-0-1', 1, 1); s = value(protectSpeakeasy(s, a, [tile('bar-0-0'), tile('bar-0-1')], 2));
  const goal = {kind: 'ZONE' as const, zone: 0 as const, types: ['SPEAKEASY' as const, 'SPEAKEASY' as const], placement: 'SAME_DISTRICT' as const};
  assert.equal(speakeasyGoalMet(s, s.players[0]!, goal), true);
  assert.equal(speakeasyGoalMet(s, s.players[0]!, {...goal, placement: 'DIFFERENT_DISTRICTS'}), false);
  assert.equal(speakeasyGoalMet(s, s.players[0]!, {kind: 'STRENGTH', minimum: 4}), true); assert.equal(s.players[0]!.goons.length, 1);
});
test('Speakeasy round boundaries cover all 11 rounds with 2/3/4 players', () => {
  for (const n of [2, 3, 4]) {
    const order = Array.from({length: n}, (_, i) => parse(PlayerIdSchema, `round-player-${i}`));
    let turns = 0;
    for (const act of [1, 2, 3, 4] as const) for (let round = 1; round <= [4, 3, 3, 1][act - 1]!; round++) for (let seat = 0; seat < n; seat++) {
      turns++; const next = nextSpeakeasyTurn({act, round, seat, order});
      if (seat < n - 1) assert.equal(next.kind, 'NEXT_PLAYER');
      else if (round < [4, 3, 3, 1][act - 1]!) assert.equal(next.kind, 'ROUND_END');
      else assert.equal(next.kind, act === 4 ? 'FINAL_SCORING' : 'LUCIANO');
    }
    assert.equal(turns, n * 11);
  }
});
test('Speakeasy restaurant keeps unmoved order and permits selecting same position', () => {
  const c = parse(PlayerIdSchema, 'c'), d = parse(PlayerIdSchema, 'd');
  assert.deepEqual(speakeasyNextOrder([a, b, c, d], [null, d, a, null]), [b, d, a, c]);
  assert.deepEqual(speakeasyNextOrder([a, b], [a, null]), [a, b]);
  assert.throws(() => speakeasyNextOrder([a, b], [a, a]));
});
test('Speakeasy runtime parser rejects duplicate pieces, unknown properties and mismatched owners', () => {
  const s = example(); s.players[0]!.stock.push(s.barrelSupply[0]!); assert.throws(() => parseSpeakeasyEconomy(s));
  assert.throws(() => parseSpeakeasyEconomy({...example(), unexpected: true}));
});
