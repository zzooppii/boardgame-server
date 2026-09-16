import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, TileIdSchema, TurnIdSchema, ServerTimeSchema, arnakResources, type ArnakOffer } from '@hangul-rummikub/shared';
import { createArnakGame, applyArnakAction, arnakOffers, parseArnakState, scoreArnak } from './games/arnak/domain/game.js';
import { projectArnak } from './games/arnak/compatibility/projector.js';

const now = v.parse(ServerTimeSchema, 1000);
function scenario(count: number) {
    let serial = 0, seed = 51;
    const random = { nextInt(max: number) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; } };
    let state = createArnakGame({ gameId: v.parse(GameIdSchema, 'research-game'), playerIds: Array.from({ length: count }, (_, i) => v.parse(PlayerIdSchema, `research-player-${i}`)), now, turnId: v.parse(TurnIdSchema, 'research-turn-0'), random, generateTileId: () => v.parse(TileIdSchema, `research-card-${++serial}`) });
    return {
        get state() { return state; },
        take(predicate: (offer: ArnakOffer) => boolean) {
            const offer = arnakOffers(state, state.activePlayerId).find(predicate);
            assert.ok(offer, 'Expected a legal research scenario action');
            const before = structuredClone(state);
            const result = applyArnakAction(state, state.activePlayerId, { type: 'TAKE', actionId: offer.id }, now, v.parse(TurnIdSchema, `research-turn-${++serial}`), random);
            assert.ok(result.ok); assert.deepEqual(state, before, 'Commands must not mutate their input');
            state = result.state; parseArnakState(state);
            return offer;
        },
        resolve() {
            for (let step = 0; state.jobs.length && step < 40; step++) this.take(o => o.kind === 'EFFECT');
            assert.equal(state.jobs.length, 0, 'Research rewards must resolve');
        },
    };
}

test('Arnak notebook promotion refreshes a spent assistant and uses its gold effect exactly once', () => {
    const game = scenario(2), p = game.state.players[0]!;
    // Explicit midgame fixture: the silver assistant is already spent, notebook trails the lens.
    const stack = game.state.assistantSupply.find(ids => ids.includes('assistant-0'))!;
    stack.splice(stack.indexOf('assistant-0'), 1);
    p.assistants.push({ definitionId: 'assistant-0', gold: false, ready: false });
    p.magnifier = '3'; p.notebook = '2R'; p.resources = arnakResources({ tablet: 2, arrow: 1 });
    parseArnakState(game.state);
    game.take(o => o.kind === 'RESEARCH' && o.targetId === '3' && o.label.startsWith('수첩'));
    assert.deepEqual(game.state.players[0]!.resources, arnakResources());
    assert.equal(arnakOffers(game.state, p.playerId).some(o => o.kind === 'END'), false);
    game.take(o => o.kind === 'EFFECT' && o.targetId === 'assistant-0' && o.label.endsWith('승급'));
    assert.deepEqual(game.state.players[0]!.assistants, [{ definitionId: 'assistant-0', gold: true, ready: true }]);
    for (const viewer of game.state.players) {
        const s = game.state;
        const projection = projectArnak({ gameId: s.gameId, gameRevision: s.revision, startedAt: s.startedAt, finishedAt: null, state: s }, viewer.playerId)!;
        assert.deepEqual(projection.playerStates[0]!.assistants, s.players[0]!.assistants);
    }
    game.take(o => o.kind === 'ASSISTANT' && o.targetId === 'assistant-0');
    assert.equal(game.state.players[0]!.resources.coin, 3, 'Gold grants three coins, not the silver two');
    assert.equal(game.state.players[0]!.assistants[0]!.ready, false);
    assert.equal(game.state.mainActionUsed, true, 'Free assistant use must preserve the research main action');
    assert.equal(arnakOffers(game.state, p.playerId).some(o => o.kind === 'ASSISTANT'), false);
    game.take(o => o.kind === 'END');
});

for (const count of [2, 3, 4]) test(`Arnak ${count} players research to the temple, promote both assistants, exhaust tiles and score`, () => {
    const game = scenario(count);
    // Resource-rich setup isolates research progression; no state edits after play starts.
    for (const p of game.state.players) p.resources = arnakResources({ coin: 50, compass: 50, tablet: 50, arrow: 50, jewel: 50 });
    const path = ['1L', '2R', '3', '4L', '5', '6R', '7L'];
    for (const [row, node] of path.entries()) for (const token of ['돋보기', '수첩']) for (let seat = 0; seat < count; seat++) {
        const actor = game.state.activePlayerId;
        game.take(o => o.kind === 'RESEARCH' && o.targetId === node && o.label.startsWith(token));
        game.resolve();
        const p = game.state.players.find(p => p.playerId === actor)!;
        assert.equal(token === '돋보기' ? p.magnifier : p.notebook, node);
        if (token === '수첩') {
            assert.equal(p.assistants.length, Math.min(row + 1, 2));
            assert.equal(p.assistants.filter(a => a.gold).length, Math.min(Math.max(row - 1, 0), 2));
        }
        game.take(o => o.kind === 'END');
    }
    for (let seat = 0; seat < count; seat++) {
        const actor = game.state.activePlayerId, rewards = game.state.templeRewards.length;
        assert.equal(arnakOffers(game.state, actor).some(o => o.targetId === '8' && o.label.startsWith('수첩')), false);
        game.take(o => o.kind === 'RESEARCH' && o.targetId === '8'); game.resolve();
        assert.equal(game.state.templeArrival[seat], actor);
        assert.equal(game.state.templeRewards.length, rewards - 1);
        assert.equal(scoreArnak(game.state.players[seat]!, game.state).research, [33, 31, 30, 29][seat]);
        game.take(o => o.kind === 'END');
    }
    for (let seat = 0; seat < count; seat++) {
        const before = { ...game.state.players[seat]!.resources };
        const offer = game.take(o => o.kind === 'RESEARCH' && o.label === '사원 타일 11점');
        for (const key of ['coin', 'compass', 'tablet', 'arrow', 'jewel'] as const) assert.equal(game.state.players[seat]!.resources[key], before[key] - offer.cost[key]);
        assert.equal(game.state.players[seat]!.templePoints, 11);
        game.take(o => o.kind === 'END');
    }
    assert.equal(game.state.templeSupply[5], 0);
    assert.equal(arnakOffers(game.state, game.state.activePlayerId).some(o => o.label === '사원 타일 11점'), false);
    for (let step = 0; game.state.phase !== 'FINISHED' && step < count * 12; step++) game.take(o => o.kind === 'PASS');
    assert.equal(game.state.phase, 'FINISHED'); assert.equal(game.state.round, 5);
    for (const [seat, score] of game.state.result!.scores.entries()) {
        assert.equal(score.research, [33, 31, 30, 29][seat]); assert.equal(score.temple, 11);
        assert.equal(score.total, score.research + score.temple + score.guardians + score.idols + score.slots + score.cards - score.fear);
    }
});

for (const first of ['선착순 보너스 먼저', '연구 보상 먼저']) test(`Arnak research receipt records actual draw and automatic compass: ${first}`, () => {
    const game = scenario(2), p = game.state.players[0]!;
    p.magnifier = '1L'; p.resources = arnakResources({ jewel: 1 });
    game.state.researchBonuses['2L'] = 'draw';
    const hand = p.hand.length;
    game.take(o => o.kind === 'RESEARCH' && o.targetId === '2L' && o.label.startsWith('돋보기'));
    game.take(o => o.label === first);
    if (first === '선착순 보너스 먼저') {
        assert.equal(game.state.players[0]!.resources.compass, 0);
        assert.doesNotMatch(game.state.history.at(-1)!.text, /획득:/);
    } else {
        assert.match(game.state.history.at(-1)!.text, /연구 보상 획득: 나침반 1개/);
    }
    game.take(o => o.kind === 'EFFECT' && o.targetId === 'draw');
    assert.equal(game.state.players[0]!.hand.length, hand + 1);
    assert.equal(game.state.players[0]!.resources.compass, 1);
    assert.equal(game.state.jobs.length, 0);
    assert.match(game.state.history.at(-1)!.text, first === '선착순 보너스 먼저' ? /카드 1장 \+ 나침반 1개 \(자동 반영 완료\)/ : /카드 1장 \(자동 반영 완료\)/);
    const s = game.state;
    const projection = projectArnak({ gameId: s.gameId, gameRevision: s.revision, startedAt: s.startedAt, finishedAt: null, state: s }, p.playerId)!;
    assert.equal(projection.history.at(-1)!.text, s.history.at(-1)!.text);
});

for (const source of ['1L','1R']) test(`Arnak research enforces the connected path from ${source} despite sufficient resources`,()=>{
 const game=scenario(2),p=game.state.players[0]!;
 p.magnifier=source;p.resources=arnakResources({coin:10,compass:10,tablet:10,arrow:10,jewel:10});
 const targets=arnakOffers(game.state,p.playerId).filter(o=>o.kind==='RESEARCH'&&o.label.startsWith('돋보기')).map(o=>o.targetId);
 assert.deepEqual(targets,source==='1L'?['2L','2R']:['2R']);
});
