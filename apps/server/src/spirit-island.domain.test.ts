import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, SPIRITS, SPIRIT_POWERS, SpiritPlayingProjectionSchema, spiritProjectionIsConsistent, type SpiritAction, type SpiritId } from '@hangul-rummikub/shared';
import { createSpiritGame, applySpiritAction, parseSpiritState, powerOptions, type SpiritState } from './games/spirit-island/domain/game.js';
import { projectSpirit } from './games/spirit-island/compatibility/projector.js';
import { choiceOptions, settle, SPIRIT_FEAR_KEYS } from './games/spirit-island/domain/resolver.js';
import { powerSteps } from './games/spirit-island/domain/powers.js';
import { step, makePiece, land, defense, presence, innateLevel } from './games/spirit-island/domain/primitives.js';
const now = v.parse(ServerTimeSchema, 1000);
let seq = 0;
function setup(n = 1) { return createSpiritGame({ gameId: v.parse(GameIdSchema, 'spirit-test'), playerIds: Array.from({ length: n }, (_, i) => v.parse(PlayerIdSchema, `p${i}`)), now, transitionId: v.parse(TurnIdSchema, `turn-${++seq}`), id: () => `card-${++seq}`, shuffle: <T>(a: T[]) => a }); }
function apply(s: SpiritState, a: SpiritAction, actor = s.players[0]!.playerId) { const result = applySpiritAction(s, actor, a, now, v.parse(TurnIdSchema, `turn-${++seq}`)); assert.ok(result.ok, `Rejected ${JSON.stringify(a)} at ${s.stage}: ${JSON.stringify(s.queue[0])}`); return result.state; }
function chosen(n = 1, spirit: SpiritId = 'RIVER') { let s = setup(n); for (const [i, p] of s.players.entries())
    s = apply(s, { kind: 'SELECT_SPIRIT', spirit: n === 1 ? spirit : SPIRITS[i]!.id }, p.playerId); return s; }
function drain(s: SpiritState) { let left = 600; while (s.queue.length && s.phase === 'PLAYING') {
    assert.ok(--left > 0, 'queue must terminate');
    const o = choiceOptions(s)[0];
    assert.ok(o, JSON.stringify(s.queue[0]));
    const e = s.queue[0]!;
    s = apply(s, { kind: 'CHOOSE', choiceId: `${s.transitionId}:${s.revision}`, optionId: o.id }, e.target ?? e.actor);
} return s; }
function view(s: SpiritState, i = 0) { return projectSpirit({ gameId: s.gameId, gameRevision: s.revision, startedAt: s.startedAt, finishedAt: s.finishedAt, state: s }, s.players[i]!.playerId); }
for (let n = 1; n <= 4; n++)
    test(`${n} spirits: setup, public projections, growth, round and conservation`, () => {
        let s = chosen(n);
        assert.equal(s.stage, 'PREPARE');
        assert.equal(s.lands.length, 8 * n);
        assert.equal(s.blightPool, 5 * n + 1);
        assert.equal(s.invaderDeck.length, 11);
        assert.equal(s.ravage, null);
        assert.ok(s.build);
        for (let i = 0; i < n; i++) {
            const g = view(s, i);
            assert.ok(spiritProjectionIsConsistent(g));
            assert.ok(v.safeParse(SpiritPlayingProjectionSchema, g).success);
            assert.equal(g.playerStates.every(p => p.hand.length === 4), true);
            assert.ok(!JSON.stringify(g).includes('minorDiscard'));
        }
        for (const p of s.players) {
            s = drain(apply(s, { kind: 'GROW', option: 1 }, p.playerId));
            s = apply(s, { kind: 'PLAY_CARDS', cardIds: [] }, p.playerId);
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        }
        assert.equal(s.stage, 'FAST');
        for (const p of s.players)
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        while (!['SLOW', 'PREPARE'].includes(s.stage))
            s = drain(apply(s, { kind: 'ADVANCE' }));
        for (const p of s.players)
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        s = drain(apply(s, { kind: 'ADVANCE' }));
        assert.equal(s.round, 2);
        assert.equal(s.stage, 'PREPARE');
        parseSpiritState(s);
    });
test('invalid inputs, ownership, stale choice and insufficient energy leave canonical state unchanged', () => { let s = chosen(); const before = JSON.stringify(s); for (const action of [{ kind: 'GROW', option: 7 }, { kind: 'PLAY_CARDS', cardIds: ['unknown'] }, { kind: 'ADVANCE' }, { kind: 'SELECT_SPIRIT', spirit: 'EARTH' }, { kind: 'READY', ready: true }]) {
    assert.equal(applySpiritAction(s, s.players[0]!.playerId, action, now, s.transitionId).ok, false);
    assert.equal(JSON.stringify(s), before);
} s = apply(s, { kind: 'GROW', option: 1 }); assert.equal(applySpiritAction(s, s.players[0]!.playerId, { kind: 'CHOOSE', choiceId: 'stale', optionId: 'o0' }, now, s.transitionId).ok, false); });
test('River wetland counts as sacred and Lightning gains fast opportunities from air', () => {
    let s = chosen();
    assert.equal(presence(land(s, 'A5'), s.players[0]!.playerId), 1);
    s = drain(apply(s, { kind: 'GROW', option: 2 }));
    const p = s.players[0]!;
    s = apply(s, { kind: 'PLAY_CARDS', cardIds: p.hand.filter(id => s.cards.find(c => c.cardId === id)?.key === 'flash-floods') });
    s = apply(s, { kind: 'READY', ready: true });
    assert.ok(powerOptions(s, p.playerId).some(o => o.targets.includes('A4')));
    let lightning = chosen(1, 'LIGHTNING');
    lightning = drain(apply(lightning, { kind: 'GROW', option: 2 }));
    const lp = lightning.players[0]!, shatter = lp.hand.find(id => lightning.cards.find(c => c.cardId === id)?.key === 'shatter-homesteads')!;
    lightning = apply(lightning, { kind: 'PLAY_CARDS', cardIds: [shatter] });
    lightning = apply(lightning, { kind: 'READY', ready: true });
    assert.equal(powerOptions(lightning, lp.playerId).find(o => o.cardId === shatter)?.fast, true);
});
test('Ravage resolves blight, destroys Dahan, then surviving Dahan counterattack', () => { let s = chosen(1, 'EARTH'); const l = land(s, 'A2'); l.pieces = []; makePiece(s, l, 'TOWN'); makePiece(s, l, 'DAHAN'); makePiece(s, l, 'DAHAN'); l.defend = 0; s.stage = 'RAVAGE'; s.ravage = { stage: 1, terrains: [l.terrain], coastal: false }; s = drain(apply(s, { kind: 'ADVANCE' })); assert.equal(land(s, 'A2').blight, 1); assert.equal(land(s, 'A2').pieces.filter(p => p.kind === 'DAHAN').length, 1); assert.equal(land(s, 'A2').pieces.filter(p => p.kind === 'TOWN').length, 0); });
test('Earth sacred site provides defense 3 without consuming it', () => { const s = chosen(1, 'EARTH'); assert.equal(defense(s, land(s, 'A6')), 3); assert.equal(defense(s, land(s, 'A4')), 0); });
test('blight cascade requires adjacent target and removes one presence per spirit', () => { let s = chosen(2); const l = land(s, 'A4'); s.queue = [step('BLIGHT', s.players[0]!.playerId, l.id, 1)]; settle(s); assert.equal(s.queue[0]?.key, 'CASCADE'); assert.deepEqual(choiceOptions(s).map(o => o.landId).sort(), l.adjacent.slice().sort()); s = drain(s); assert.equal(s.blightPool, 9); });
test('damage persists through powers and is healed by time passing', () => { let s = chosen(); s.stage = 'SLOW'; const l = land(s, 'A2'); s.queue = [step('DAMAGE', s.players[0]!.playerId, l.id, 1)]; settle(s); s = drain(s); assert.equal(land(s, 'A2').pieces.find(p => p.kind === 'CITY')?.damage, 1); s = apply(s, { kind: 'READY', ready: true }); s = drain(apply(s, { kind: 'ADVANCE' })); assert.equal(land(s, 'A2').pieces.find(p => p.kind === 'CITY')?.damage, 0); });
test('individual draw choices never expose faces or IDs to teammate', () => { const s = chosen(2); s.queue = [step('GAIN', s.players[0]!.playerId, null, 1, 'MINOR')]; settle(s); assert.equal(s.offered.length, 4); const other = view(s, 1); assert.equal(other.pending?.options.length, 0); for (const id of s.offered)
    assert.ok(!JSON.stringify(other).includes(id)); assert.equal(view(s).pending?.options.length, 4); });
for (const card of SPIRIT_POWERS)
    test(`power effect ${card.key} resolves without unknown instructions`, () => { let s = chosen(2); const a = s.players[0]!.playerId, l = land(s, 'A4'); l.pieces = []; for (const kind of ['EXPLORER', 'EXPLORER', 'TOWN', 'CITY', 'DAHAN', 'DAHAN', 'DAHAN'] as const)
        makePiece(s, l, kind); s.players[0]!.elements = Array.from({ length: 6 }, () => ['SUN', 'MOON', 'FIRE', 'AIR', 'WATER', 'EARTH', 'PLANT', 'ANIMAL'] as const).flat(); s.stage = 'FAST'; s.queue = powerSteps(s, a, card.key, card.target.includes('SPIRIT') ? null : l.id, a, 1); settle(s); s = drain(s); assert.equal(s.queue.length, 0); parseSpiritState(s); });
for (const key of SPIRIT_FEAR_KEYS)
    for (const level of [1, 2, 3] as const)
        test(`fear ${key}, terror ${level}, all choices terminate`, () => { let s = chosen(2); s.terror = level; s.stage = 'FEAR'; s.queue = [step('SPECIAL', s.players[0]!.playerId, null, 0, 'FEAR_CARD', null, [key])]; settle(s); s = drain(s); assert.equal(s.queue.length, 0); });
test('innate thresholds do not consume elements', () => { const s = chosen(); s.players[0]!.elements = ['SUN', 'SUN', 'WATER', 'WATER', 'WATER']; assert.equal(innateLevel(s, s.players[0]!.playerId), 2); assert.equal(innateLevel(s, s.players[0]!.playerId), 2); });
test('victory is checked after the whole power, preserving sacrifice outcome', () => { let s = chosen(); const actor = s.players[0]!.playerId, target = land(s, 'A5'); for (const l of s.lands)
    l.pieces = l.pieces.filter(p => p.kind === 'DAHAN'); makePiece(s, target, 'TOWN'); s.stage = 'SLOW'; s.queue = [step('DAMAGE', actor, target.id, 2), step('BLIGHT', actor, target.id, 1), step('CHECK', actor)]; settle(s); s = drain(s); assert.equal(s.result?.reason, 'SACRIFICE'); assert.equal(s.phase, 'FINISHED'); });
test('negative power budgets and duplicate card selections fail atomically', () => { let s = chosen(); s = drain(apply(s, { kind: 'GROW', option: 0 })); const id = s.players[0]!.hand[0]!; const before = JSON.stringify(s); assert.equal(applySpiritAction(s, s.players[0]!.playerId, { kind: 'PLAY_CARDS', cardIds: [id, id] }, now, s.transitionId).ok, false); assert.equal(JSON.stringify(s), before); });
test('prepared cards can be changed with exact refunds before ready', () => { let s = chosen(); s = drain(apply(s, { kind: 'GROW', option: 2 })); const p = s.players[0]!, free = p.hand.find(id => s.cards.find(c => c.cardId === id)?.key === 'boon-of-vigor')!; const energy = p.energy; s = apply(s, { kind: 'PLAY_CARDS', cardIds: [free] }); s = apply(s, { kind: 'PLAY_CARDS', cardIds: [] }); assert.equal(s.players[0]!.energy, energy); assert.ok(s.players[0]!.hand.includes(free)); });
test('repeated Powerstorm never grants additional repeats', () => { let s = chosen(); const p = s.players[0]!, id = s.cards.find(c => c.key === 'powerstorm')!.cardId; s.major = s.major.filter(c => c !== id); for (const deck of s.progressions)
    deck.cards = deck.cards.filter(c => c !== id); p.played = [id]; p.resolved = [id]; p.energy = 10; p.repeatGrants = [{ id: 'grant', remaining: 1, maxCost: 10, paid: true, used: [] }]; s.stage = 'FAST'; const out = apply(s, { kind: 'USE_POWER', cardId: id, target: p.playerId, threshold: 0, fast: true, repeat: true, shadowReach: false }); assert.equal(out.players[0]!.repeatGrants.reduce((n, g) => n + g.remaining, 0), 0); assert.equal(out.players[0]!.energy, 10); });
for (const n of [1, 2, 3, 4])
    test(`${n} player complete legal game reaches a terminal result through normal commands`, () => { let s = chosen(n), commands = 0; while (s.phase === 'PLAYING' && commands++ < 1600) {
        if (s.queue.length) {
            s = drain(s);
            continue;
        }
        const unready = s.players.find(p => !p.ready) ?? s.players[0]!;
        if (s.stage === 'PREPARE') {
            if (!unready.grown) {
                s = drain(apply(s, { kind: 'GROW', option: 0 }, unready.playerId));
                continue;
            }
            s = apply(s, { kind: 'READY', ready: true }, unready.playerId);
        }
        else if (s.stage === 'FAST' || s.stage === 'SLOW')
            s = apply(s, { kind: 'READY', ready: true }, unready.playerId);
        else
            s = drain(apply(s, { kind: 'ADVANCE' }));
    } assert.equal(s.phase, 'FINISHED'); assert.ok(s.result); assert.ok(s.finishedAt !== null); assert.ok(s.round > 1); assert.ok(spiritProjectionIsConsistent(view(s))); });
