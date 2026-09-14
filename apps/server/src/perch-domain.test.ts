import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'valibot';
import { GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, TileIdSchema, PERCH_CREATURES, PERCH_LOCATION_INFO, PERCH_OBJECTIVES, perchFountainCells, perchRanks, perchStrength, type PerchAction, type PerchCreature, type PerchLocation } from '@hangul-rummikub/shared';
import { createPerchGame, applyPerchAction, activePerchPlayer, perchPending, parsePerchState, perchEdgeTiles, perchObjectiveAchieved, type PerchState } from './games/perch/domain/game.js';
import { projectPerch } from './games/perch/compatibility/projector.js';
let serial = 0;
const id = () => parse(TileIdSchema, `opaque-${++serial}`), now = parse(ServerTimeSchema, 1000);
function rng(seed = 1) { let n = seed; return { nextInt(max: number) { n = (n * 16807) % 2147483647; return n % max; } }; }
function game(count = 2, seed = 1) {
    const random = rng(seed);
    let state = createPerchGame({ gameId: parse(GameIdSchema, 'perch'), playerIds: Array.from({ length: count }, (_, i) => parse(PlayerIdSchema, `p${i}`)), now, turnId: parse(TurnIdSchema, 't0'), random, generateTileId: id });
    const host = state.players[0]!.playerId;
    return { get state() { return state; }, set state(s: PerchState) { state = parsePerchState(s); }, random, act(action: PerchAction, actor = activePerchPlayer(state).playerId) { const before = structuredClone(state), r = applyPerchAction(state, actor, action, now, parse(TurnIdSchema, `t${++serial}`), random, host, id); assert.deepEqual(state, before, 'input state must remain immutable'); assert.ok(r.ok, JSON.stringify({ action, phase: state.phase, reason: r.ok ? null : r.reason })); state = r.state; return state; }, begin(randomBoard = false) { this.act({ type: 'CONFIGURE', randomBoard, objectives: false }, host); this.act({ type: 'BEGIN' }, host); } };
}
function put(s: PerchState, loc: number, flock: number, n = 1) { const t = s.board[loc]!; let st = t.stacks.find(x => x.flock === flock); if (!st) {
    st = { flock, birds: [], nest: null, house: false };
    t.stacks.push(st);
} st.birds.push(...s.supply[flock]!.splice(0, n)); return st; }
function replace(s: PerchState, index: number, def: PerchLocation) { const t = s.board[index]!, old = s.board.find(b => b.definitionId === def); if (old) {
    old.definitionId = t.definitionId;
    old.nests = t.nests;
} t.definitionId = def; t.nests = Array.from({ length: PERCH_LOCATION_INFO[def].nests }, () => true); }
for (const count of [2, 3, 4, 5])
    test(`Perch ${count} players: seeded full five rounds with random boards, creatures and choices`, () => { const seen = new Set<string>(); for (let seed = 1; seed <= 16; seed++) {
        const h = game(count, seed);
        h.begin(seed !== 1);
        let steps = 0;
        while (h.state.phase !== 'FINISHED' && steps++ < 900) {
            const s = h.state, p = activePerchPlayer(s), pending = perchPending(s, s.queue[0]?.actor ?? p.playerId);
            if (pending) {
                seen.add(pending.kind);
                assert.ok(pending.choices.length);
                h.act({ type: 'CHOOSE', choiceId: pending.choices[h.random.nextInt(pending.choices.length)]!.id }, pending.actor);
            }
            else if (s.phase === 'ROUND_END')
                h.act({ type: 'CONTINUE' });
            else if (!s.bonusUsed && s.creatures.some(c => c.controller === p.playerId && !c.used) && steps % 2 === 0) {
                const c = s.creatures.find(c => c.controller === p.playerId && !c.used)!;
                const r = applyPerchAction(s, p.playerId, { type: 'CREATURE', creature: c.creature }, now, parse(TurnIdSchema, `try${steps}`), h.random, s.players[0]!.playerId, id);
                if (r.ok) {
                    h.state = r.state;
                    continue;
                }
                placeOrEnd();
            }
            else
                placeOrEnd();
            function placeOrEnd() { if (h.state.placed)
                h.act({ type: 'END_TURN' });
            else {
                const bird = p.hand[h.random.nextInt(p.hand.length)]!, legal = s.board.filter(t => !t.removed && !t.stacks.some(st => st.flock === bird.flock && st.house)), t = legal[h.random.nextInt(legal.length)]!;
                h.act({ type: 'PLACE', birdId: bird.birdId, tileId: t.tileId, nest: null });
            } }
            parsePerchState(h.state);
        }
        assert.equal(h.state.phase, 'FINISHED', `seed ${seed} stalled`);
        assert.equal(h.state.round, 5);
        assert.equal(h.state.bag.length, 0);
        assert.ok(h.state.result?.winnerPlayerIds.length);
        assert.equal(h.state.result?.bonuses.length, count * 5);
    } assert.ok(seen.has('FOUNTAIN')); });
test('Perch setup: board categories, owl edge, objectives privately projected', () => { for (const n of [2, 3, 4, 5])
    for (let seed = 1; seed < 8; seed++) {
        const h = game(n, seed), host = h.state.players[0]!.playerId;
        h.act({ type: 'CONFIGURE', randomBoard: true, objectives: true }, host);
        const size = n <= 3 ? [3, 2, 3] : n === 4 ? [4, 2, 4] : [5, 3, 5];
        for (const [i, k] of ['BASIC', 'SPECIAL', 'CREATURE'].entries())
            assert.equal(h.state.board.filter(t => PERCH_LOCATION_INFO[t.definitionId].kind === k).length, size[i]);
        const barn = h.state.board.find(t => t.definitionId === 'BARN');
        if (barn)
            assert.ok(perchEdgeTiles(h.state).includes(barn));
        h.act({ type: 'BEGIN' }, host);
        for (const p of h.state.players) {
            assert.equal(p.objectiveChoices.length, 2);
            const view = projectPerch({ state: h.state, gameId: h.state.gameId, gameRevision: h.state.revision, startedAt: h.state.startedAt, finishedAt: h.state.finishedAt }, p.playerId)!;
            assert.deepEqual(view.privateState.objectiveChoices, p.objectiveChoices);
            assert.equal('bag' in view, false);
            assert.equal('supply' in view, false);
            assert.equal('queue' in view, false);
            h.act({ type: 'OBJECTIVE', objective: p.objectiveChoices[0]! }, p.playerId);
        }
        assert.equal(h.state.phase, 'PERCH');
    } });
test('Perch tied ranks cancel their positions; nest and house each add one', () => { const h = game(5), s = h.state; const a = put(s, 0, 0, 5); put(s, 0, 1, 2); put(s, 0, 2, 2); put(s, 0, 3, 1); assert.deepEqual(perchRanks(s.board[0]!).map(r => [r.flock, r.rank, r.points]), [[0, 1, 3], [1, null, 0], [2, null, 0], [3, 4, 0]]); a.nest = 0; a.house = true; assert.equal(perchStrength(a), 7); });
test('Perch rejects out-of-turn, nonexistent birds and protected stacks atomically; hand actor can place another flock', () => { const h = game(); h.begin(); const s = h.state, p = activePerchPlayer(s), other = s.players.find(x => x !== p)!, t = s.board[0]!; const before = structuredClone(s); for (const [actor, birdId] of [[other.playerId, p.hand[0]!.birdId], [p.playerId, id()]] as const) {
    const r = applyPerchAction(s, actor, { type: 'PLACE', birdId, tileId: t.tileId, nest: null }, now, parse(TurnIdSchema, 'bad'), h.random, s.players[0]!.playerId, id);
    assert.equal(r.ok, false);
    assert.deepEqual(s, before);
} const b = p.hand.find(b => b.flock !== p.flock); assert.ok(b); h.act({ type: 'PLACE', birdId: b.birdId, tileId: t.tileId, nest: 0 }); assert.equal(h.state.board[0]!.stacks[0]!.flock, b.flock); assert.equal(h.state.board[0]!.stacks[0]!.nest, 0); assert.equal(h.state.revision, s.revision + 1); });
test('Perch house blocks placement and lightning without spending a token', () => { const h = game(); h.begin(); const s = h.state, p = activePerchPlayer(s), b = p.hand[0]!, st = put(s, 0, b.flock); st.house = true; p.lightning = true; s.round = 5; h.state = s; for (const action of [{ type: 'PLACE', birdId: b.birdId, tileId: s.board[0]!.tileId, nest: null }, { type: 'ZAP', birdId: st.birds[0]!.birdId, tileId: s.board[0]!.tileId, nest: null }] satisfies PerchAction[]) {
    const r = applyPerchAction(h.state, p.playerId, action, now, parse(TurnIdSchema, 'bad'), h.random, s.players[0]!.playerId, id);
    assert.equal(r.ok, false);
    assert.equal(h.state.players.find(x => x.playerId === p.playerId)!.lightning, true);
} });
for (const count of [2, 4])
    test(`Perch fountain ${count}: owner chooses supported cells; full fountain overflows`, () => { const h = game(count); h.begin(); const s = h.state, p = activePerchPlayer(s), other = s.players.find(x => x !== p)!, st = put(s, 0, other.flock); p.lightning = true; s.round = 5; h.state = s; h.act({ type: 'ZAP', tileId: s.board[0]!.tileId, birdId: st.birds[0]!.birdId, nest: null }); const pending = perchPending(h.state, other.playerId)!; assert.equal(pending.actor, other.playerId); assert.equal(perchPending(h.state, p.playerId)!.choices.length, 0); assert.equal(pending.choices.length, 4); h.act({ type: 'CHOOSE', choiceId: pending.choices[0]!.id }, other.playerId); assert.equal(h.state.pool.length, 0); assert.equal(h.state.fountain[0]?.flock, other.flock); const full = h.state; for (const c of perchFountainCells(count))
        if (!full.fountain[c.id])
            full.fountain[c.id] = full.supply[0]!.shift()!; full.bonusUsed = false; full.players.find(x => x.playerId === p.playerId)!.lightning = true; const next = put(full, 0, other.flock); h.state = full; h.act({ type: 'ZAP', tileId: full.board[0]!.tileId, birdId: next.birds[0]!.birdId, nest: null }); assert.equal(h.state.plaza.length, 1); assert.equal(h.state.queue.length, 0); });
for (const creature of PERCH_CREATURES)
    test(`Perch creature ${creature}: movement/effect continuation preserves every bird`, () => { const h = game(3); h.begin(); const s = h.state, p = activePerchPlayer(s); const homes: Record<PerchCreature, PerchLocation> = { BEE: 'BEEHIVE', CAT: 'COTTAGE', CUCKOO: 'THORN', DOG: 'DOGHOUSE', FOX: 'DEN', HAWK: 'HAWK_NEST', OWL: 'BARN', SCARECROW: 'CORN', SQUIRREL: 'BENCH' }; replace(s, 0, homes[creature]); for (let i = 0; i < s.board.length; i++) {
        put(s, i, 0);
        put(s, i, 1);
    } s.creatures = [{ creature, controller: p.playerId, tileId: creature === 'SCARECROW' ? null : s.board[0]!.tileId, intersection: creature === 'SCARECROW' ? [s.board[0]!.tileId, s.board[1]!.tileId, s.board[3]!.tileId] : [], used: false }]; s.fountain[0] = s.supply[2]!.shift()!; h.state = s; h.act({ type: 'CREATURE', creature }); let n = 0; while (h.state.queue.length && n++ < 20) {
        const pending = perchPending(h.state, h.state.queue[0]!.actor)!;
        h.act({ type: 'CHOOSE', choiceId: pending.choices[0]!.id }, pending.actor);
    } assert.equal(h.state.queue.length, 0); assert.equal(h.state.creatures[0]!.used, true); assert.equal(h.state.bonusUsed, true); parsePerchState(h.state); });
test('Perch state rejects duplicate birds, unsupported fountain, invalid nest and actor', () => { for (const mutate of [(s: PerchState) => { s.supply[0]![1] = s.supply[0]![0]!; }, (s: PerchState) => { s.fountain[s.fountain.length - 1] = s.supply[0]!.shift()!; }, (s: PerchState) => { put(s, 0, 0).nest = 2; }, (s: PerchState) => { s.queue.push({ kind: 'FOUNTAIN', actor: parse(PlayerIdSchema, 'outsider'), tiles: [], birdId: null, creature: null, flock: null }); }]) {
    const s = game().state;
    mutate(s);
    assert.throws(() => parsePerchState(s));
} });
test('Perch all objectives evaluate deterministically without changing state', () => { const s = game(5).state; for (let i = 0; i < s.board.length; i++)
    put(s, i, i % 3, 2); const before = structuredClone(s); for (const id of PERCH_OBJECTIVES) {
    assert.equal(typeof perchObjectiveAchieved(s, 0, id), 'boolean');
    assert.equal(perchObjectiveAchieved(s, 0, id), perchObjectiveAchieved(s, 0, id));
} assert.deepEqual(s, before); assert.equal(perchObjectiveAchieved(s, 4, 'WING'), true); assert.equal(perchObjectiveAchieved(s, 4, 'STORK'), false); assert.equal(perchObjectiveAchieved(s, 4, 'EGRETS'), true); });
for (const objective of PERCH_OBJECTIVES)
    test(`Perch objective ${objective}: independently constructed success and failure`, () => { const yes = game(5).state, no = game(5).state; const control = (s: PerchState, tiles: number[]) => tiles.forEach(i => put(s, i, 0, 2)); const creatures = (s: PerchState, n: number) => { s.creatures = PERCH_CREATURES.slice(0, n).map(creature => ({ creature, controller: s.players[0]!.playerId, tileId: null, intersection: [], used: false })); }; switch (objective) {
        case 'WISE':
            control(yes, [0, 3, 6]);
            break;
        case 'CHIRP':
            control(yes, [0, 1, 2]);
            break;
        case 'TOUCAN':
            control(yes, [0, 12]);
            break;
        case 'LORD':
            control(yes, [0, 2, 10, 12]);
            break;
        case 'IMPECKABLE':
        case 'EGGS':
            control(yes, [0]);
            break;
        case 'ILLEAGLE':
            put(yes, 0, 0, 3);
            put(yes, 0, 1, 1).nest = 0;
            break;
        case 'OSTRICH':
        case 'ROBIN':
            control(yes, [0, 1]);
            break;
        case 'JACK':
            creatures(yes, 2);
            creatures(no, 1);
            break;
        case 'BIRDEN':
            creatures(yes, 1);
            break;
        case 'WING':
            creatures(no, 1);
            break;
        case 'UNPHEASANT':
        case 'QUACK':
        case 'COMEDIHEN': {
            const rank = objective === 'UNPHEASANT' ? 2 : objective === 'QUACK' ? 3 : 4, locations = rank === 4 ? 3 : 2;
            for (let i = 0; i < locations; i++) {
                put(yes, i, 0);
                for (let f = 1; f < rank; f++)
                    put(yes, i, f, f + 1);
            }
            break;
        }
        case 'CROWBAR':
            put(yes, 0, 0, 3);
            put(yes, 1, 1, 2);
            put(no, 0, 0, 1);
            put(no, 1, 1, 3);
            break;
        case 'STORK':
            control(yes, yes.board.map((_, i) => i));
            control(no, no.board.map((_, i) => i).slice(1));
            break;
        case 'TWEET':
            control(yes, [0, 1, 2, 3, 4]);
            control(no, [0, 1, 2, 3]);
            break;
        case 'HIDDEN':
            no.board.forEach((_, i) => put(no, i, 1));
            break;
        case 'EGRETS':
            no.board.slice(2).forEach((_, i) => put(no, i + 2, 0));
            break;
        case 'MYSELF':
            control(yes, [0]);
            put(no, 0, 0, 2);
            put(no, 0, 1, 1);
            break;
        case 'EMU':
            control(yes, [4]);
            break;
    } assert.equal(perchObjectiveAchieved(yes, 0, objective), true, objective + ' success'); assert.equal(perchObjectiveAchieved(no, 0, objective), false, objective + ' failure'); });
test('Perch fountain printed layouts: exact seats and cross supports', () => { const small = perchFountainCells(2), large = perchFountainCells(5); assert.deepEqual([0, 1, 2, 3, 4].map(l => small.filter(c => c.level === l).length), [4, 3, 2, 2, 1]); assert.deepEqual(small[9]!.supports, [7, 8]); assert.deepEqual(small[10]!.supports, [7, 8]); assert.deepEqual([0, 1, 2, 3, 4, 5].map(l => large.filter(c => c.level === l).length), [4, 4, 4, 3, 2, 1]); assert.deepEqual(large[4]!.supports, [0]); assert.deepEqual(large[8]!.supports, [4]); assert.deepEqual(large[12]!.supports, [8, 9]); });
