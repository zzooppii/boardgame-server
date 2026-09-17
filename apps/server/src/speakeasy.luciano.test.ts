import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parse} from 'valibot';
import {GameIdSchema, PlayerIdSchema, SpeakeasyDefenseCommandSchema} from '@hangul-rummikub/shared';
import {a, b, tile, example} from './speakeasy.fixture.js';
import {startSpeakeasyLuciano, advanceSpeakeasyLuciano, resolveSpeakeasyDefense, projectSpeakeasyLuciano,
  parseSpeakeasyLuciano, type SpeakeasyLuciano} from './games/speakeasy/domain/luciano.js';
import {buildSpeakeasy} from './games/speakeasy/domain/economy.js';
import {type SpeakeasyEconomy, type SpeakeasyRuleResult, speakeasyInventory} from './games/speakeasy/domain/model.js';

function value<T>(r: SpeakeasyRuleResult<T>): T {assert.ok(r.ok);return r.value;}
function built(s: SpeakeasyEconomy, piece: string, owner = a, district = 1, slot = 0) {
  return value(buildSpeakeasy(s, owner, {pieceId: tile(piece), district, slot, goons: 0, useAssociate: false, freeAssociate: false, discardIds: []}, {kinds: ['SPEAKEASY', 'NIGHTCLUB'], upgrade: true}));
}
/** Deliberately small invented numeric fixture, never an official setup/catalog. */
function setup(economy = example(), order = [a, b]) {
  return {gameId: parse(GameIdSchema, 'speakeasy-war-one'), revision: 20, act: 1,
    order, economy, districts: [7, 1], copDistricts: [1],
    deck: [{tileId: tile('hidden-mobster-1'), strength: 3, modifier: 1}, {tileId: tile('hidden-mobster-7'), strength: 2, modifier: 0},
      {tileId: tile('unused-mobster'), strength: 5, modifier: 1}],
    payoutTables: [[30, 15, 5], [40, 20, 10], [45, 30, 20]]};
}
const advance = (s: SpeakeasyLuciano) => value(advanceSpeakeasyLuciano(s, s));
const command = (s: SpeakeasyLuciano, building = 'bar-0-0') => ({gameId: s.gameId, revision: s.revision,
  buildingId: tile(building), defend: true, goons: 1, useAssociate: false, freeAssociate: false});

test('Luciano reveals one ascending district and blocks further reveals while any defense is pending', () => {
  const economy = built(built(example(), 'bar-0-0'), 'bar-1-0', b, 1, 1);
  const before = startSpeakeasyLuciano(setup(economy));
  let s = advance(before);
  assert.equal(s.current?.district, 1); assert.equal(s.current?.mobster.strength, 3);
  assert.equal(s.economy.districts[0]!.mobsterStrength, 3); // Attack is 4, takeover remains base strength 3.
  assert.equal(s.phase, 'DEFENSE'); assert.equal(advanceSpeakeasyLuciano(s, s).ok, false);
  assert.equal(projectSpeakeasyLuciano(s, a)!.actorId, a);
  assert.equal(resolveSpeakeasyDefense(s, b, command(s, 'bar-1-0')).ok, false);
  assert.equal(resolveSpeakeasyDefense(s, a, {...command(s), goons: 0}).ok, false);
  s = value(resolveSpeakeasyDefense(s, a, command(s)));
  assert.equal(projectSpeakeasyLuciano(s, a)!.actorId, b);
  assert.equal(s.phase, 'DEFENSE');
  s = value(resolveSpeakeasyDefense(s, b, command(s, 'bar-1-0')));
  assert.equal(s.phase, 'REVEAL'); assert.equal(s.revealed[0]!.stayed, false);
  assert.equal(s.economy.districts[0]!.mobsterStrength, null);
  assert.equal(s.current, null); assert.equal(s.nextIndex, 1);
  assert.equal(before.revision, 20); assert.equal(before.nextIndex, 0);
  assert.deepEqual(speakeasyInventory(before.economy), speakeasyInventory(s.economy));
});

test('Luciano rejects stale game/revision, forged power and ownership without changing any state', () => {
  const s = advance(startSpeakeasyLuciano(setup(built(example(), 'bar-0-0'))));
  const snapshot = structuredClone(s);
  for (const c of [{...command(s), strength: 999}, {...command(s), actorId: b}, {...command(s), revision: s.revision - 1},
    {...command(s), gameId: 'previous-game'}, {...command(s), buildingId: 'missing-id'}, {...command(s), goons: 7},
    {...command(s), defend: false, useAssociate: true}]) assert.equal(resolveSpeakeasyDefense(s, a, c).ok, false);
  assert.equal(resolveSpeakeasyDefense(s, b, command(s)).ok, false);
  assert.deepEqual(s, snapshot);
  const first = value(resolveSpeakeasyDefense(s, a, command(s)));
  assert.equal(resolveSpeakeasyDefense(first, a, command(s)).ok, false);
  assert.equal(advanceSpeakeasyLuciano(first, s).ok, false);
});

test('Luciano lets an owner choose building order but spends goons independently for each defense', () => {
  const economy = built(built(example(), 'bar-0-0'), 'bar-0-1', a, 1, 1);
  let s = advance(startSpeakeasyLuciano(setup(economy)));
  s = value(resolveSpeakeasyDefense(s, a, command(s, 'bar-0-1')));
  assert.equal(s.economy.players[0]!.goons.length, 0);
  assert.equal(resolveSpeakeasyDefense(s, a, {...command(s), goons: 0}).ok, false);
  s = value(resolveSpeakeasyDefense(s, a, {...command(s), defend: false, goons: 0}));
  assert.equal(s.economy.districts[0]!.slots[0], null);
  assert.ok(s.economy.districts[0]!.slots[1]);
  assert.equal(s.revealed[0]!.stayed, true); assert.deepEqual(s.economy.districts[0]!.mobsterSlots, [0]);
});

test('Luciano restores a pending choice, hides future/unused mobsters and exposes only viewer money', () => {
  const economy = built(example(), 'bar-0-0'); economy.players[1]!.safe = 9876;
  let s = advance(startSpeakeasyLuciano(setup(economy)));
  s = parseSpeakeasyLuciano(JSON.parse(JSON.stringify(s)));
  const view = projectSpeakeasyLuciano(s, a)!;
  const serialized = JSON.stringify(view);
  for (const secret of ['hidden-mobster-7', 'unused-mobster', '9876', 'hand-1', 'installed-1', 'payoutTables', 'copDistricts']) assert.equal(serialized.includes(secret), false);
  assert.equal(view.revealed[0]!.attack, 4); assert.equal(view.self.safe, 30);
  assert.equal(projectSpeakeasyLuciano(s, b)!.self.safe, 9876);
  assert.equal(projectSpeakeasyLuciano(s, parse(PlayerIdSchema, 'outsider')), null);
  assert.equal(value(resolveSpeakeasyDefense(s, a, command(s))).phase, 'REVEAL');
});

test('Luciano fills empty slots, keeps older mobsters and discards surplus incoming tiles', () => {
  const economy = example(); economy.districts[8]!.mobsterStrength = 8; economy.districts[8]!.mobsterSlots = [0];
  let s = startSpeakeasyLuciano(setup(economy));
  s = advance(s); assert.deepEqual(s.economy.districts[0]!.mobsterSlots, [0, 1]);
  assert.equal(s.revealed.length, 1); assert.equal(s.phase, 'REVEAL');
  s = advance(s); assert.equal(s.phase, 'COPS');
  assert.equal(s.economy.districts[8]!.mobsterStrength, 8);
  assert.equal(s.discarded[0]!.tileId, tile('unused-mobster')); assert.equal(s.deck.length, 0);
  assert.equal(JSON.stringify(projectSpeakeasyLuciano(s, a)).includes('unused-mobster'), false);
});

test('Luciano police precede control payout, preserve barrels and pay safes exactly once', () => {
  let economy = built(example(), 'bar-0-0');
  economy = built(economy, 'bar-0-1', a, 2);
  economy.districts[0]!.slots[0]!.barrelId = economy.barrelSupply.shift()!;
  let s = advance(startSpeakeasyLuciano(setup(economy)));
  s = value(resolveSpeakeasyDefense(s, a, command(s))); s = advance(s);
  assert.equal(s.phase, 'COPS'); assert.equal(s.economy.districts[0]!.cop, false);
  assert.equal(s.economy.players[0]!.safe, 30);
  s = advance(s); assert.equal(s.phase, 'PAYOUT'); assert.equal(s.economy.districts[0]!.cop, true);
  assert.ok(s.economy.districts[0]!.slots[0]!.barrelId);
  const view = projectSpeakeasyLuciano(s, a)!; assert.equal(view.districts[0]!.buildings[0]!.operating, false);
  const cash = s.economy.players[0]!.cash;
  const before = s; s = advance(s);
  assert.equal(s.phase, 'COMPLETE'); assert.equal(s.economy.players[0]!.safe, 45); // Downtown tied with NPC: second rank.
  assert.equal(s.economy.players[0]!.cash, cash); assert.equal(s.payouts.length, 6);
  assert.equal(advanceSpeakeasyLuciano(s, s).ok, false);
  assert.equal(advanceSpeakeasyLuciano(s, before).ok, false);
});

test('Luciano validates catalog boundary and incoming scheduled district counts for 2/3/4 players', () => {
  for (const count of [2, 3, 4]) for (const act of [1, 2, 3]) {
    const economy = example(count);
    const n = (count === 2 ? [2, 2, 3] : [3, 3, 4])[act - 1]!;
    const seed = {...setup(economy), act, order: economy.players.map(p => p.playerId), districts: Array.from({length:n}, (_,i) => i+1),
      deck: Array.from({length:n},(_,i) => ({tileId:tile(`mob-${i}`), strength:3,modifier:1})),
      payoutTables: [0,1,2].map(() => Array.from({length:count+1},(_,i)=>30-i*5))};
    let s = startSpeakeasyLuciano(seed);
    while (s.phase !== 'COMPLETE') s = advance(s);
    assert.equal(s.revealed.length, n); assert.equal(s.payouts.length, count*3);
    assert.throws(() => startSpeakeasyLuciano({...seed, districts: seed.districts.slice(1)}));
  }
  const seed = setup();
  for (const invalid of [{...seed, act:4}, {...seed, order:[a,a]}, {...seed, districts:[1,1]}, {...seed, deck:[]},
    {...seed, deck:[seed.deck[0],seed.deck[0]]}, {...seed, payoutTables:[[1]]}, {...seed, copDistricts:[1,1]}]) assert.throws(() => startSpeakeasyLuciano(invalid));
  assert.throws(() => parse(SpeakeasyDefenseCommandSchema, {...command(startSpeakeasyLuciano(seed)), strength:9}));
});

test('Luciano does not invent mobster buildings when the physical supply is exhausted', () => {
  const economy = example();
  for (const d of economy.districts) if (![1,7,15,16].includes(d.id)) {d.mobsterStrength = 2;d.mobsterSlots = [0,1];}
  const s = startSpeakeasyLuciano(setup(economy)); const before = structuredClone(s);
  assert.deepEqual(advanceSpeakeasyLuciano(s, s), {ok:false,reason:'CAPACITY'});
  assert.deepEqual(s, before);
});


test('Luciano permits police in blocked two-player districts through payout without opening them', () => {
  const economy = built(example(), 'bar-0-0', a, 3);
  for (const id of [2, 4, 8, 10, 16]) economy.districts[id - 1]!.blocked = true;
  const seed = {...setup(economy), copDistricts: [2, 4, 8, 16]};
  const before = structuredClone(seed);
  let s = startSpeakeasyLuciano(seed);
  while (s.phase !== 'COPS') s = advance(s);
  assert.ok(seed.copDistricts.every(id => !s.economy.districts[id - 1]!.cop));
  s = advance(s);
  assert.equal(s.phase, 'PAYOUT');
  s = parseSpeakeasyLuciano(JSON.parse(JSON.stringify(s)));
  for (const id of seed.copDistricts) {
    const district = s.economy.districts[id - 1]!;
    assert.equal(district.cop, true);
    assert.equal(district.blocked, true);
    assert.deepEqual(district.slots, [null, null]);
    assert.deepEqual(district.mobsterSlots, []);
    assert.equal(projectSpeakeasyLuciano(s, a)!.districts[id - 1]!.cop, true);
  }
  const cash = s.economy.players[0]!.cash;
  s = advance(s);
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.economy.players[0]!.safe, 45); // One district each for player A and mobsters: fixture's second-place payout.
  assert.equal(s.economy.players[0]!.cash, cash);
  assert.deepEqual(seed, before);
  assert.deepEqual(speakeasyInventory(s.economy), speakeasyInventory(economy));
  assert.equal(buildSpeakeasy(s.economy, a, {pieceId: tile('bar-0-1'), district: 2, slot: 0,
    goons: 0, useAssociate: false, freeAssociate: false, discardIds: []}, {kinds: ['SPEAKEASY'], upgrade: false}).ok, false);
  assert.equal(advanceSpeakeasyLuciano(s, s).ok, false);
});

test('Luciano still rejects blocked mobster targets, duplicate police and already occupied police districts', () => {
  const economy = example(); economy.districts[1]!.blocked = true;
  const seed = {...setup(economy), copDistricts: [2]};
  assert.throws(() => startSpeakeasyLuciano({...seed, districts: [1, 2]}));
  assert.throws(() => startSpeakeasyLuciano({...seed, copDistricts: [2, 2]}));
  assert.throws(() => startSpeakeasyLuciano({...seed, copDistricts: [17]}));
  economy.districts[1]!.cop = true;
  assert.throws(() => startSpeakeasyLuciano(seed));
});
