import * as v from 'valibot';
import { GameRevisionSchema, SPIRIT_POWERS, SPIRITS, SPIRIT_BOARDS, SPIRIT_BOARD_DATA, spiritBoardLinks, SpiritActionSchema, spiritDefinition, type PlayerId, type SpiritPower, type SpiritInvaderCard, type SpiritTerrain } from '@hangul-rummikub/shared';
import { SpiritStateSchema, type SpiritState } from './state.js';
import { SPIRIT_FEAR_KEYS, settle, choiceOptions } from './resolver.js';
import { SpiritRuleError, requireRule, player, presence, addPresence, makePiece, event, step, cardPower, playLimit, elements, innateLevel, targetAllowed, checkEnd } from './primitives.js';
import { powerSteps } from './powers.js';
export type { SpiritState } from './state.js';
export function parseSpiritState(value: unknown): SpiritState {
    const s = v.parse(SpiritStateSchema, value), roster = new Set(s.players.map(p => p.playerId)), ids = new Set(s.cards.map(c => c.cardId));
    requireRule(roster.size === s.players.length && ids.size === s.cards.length);
    requireRule(s.cards.length === SPIRIT_POWERS.length && new Set(s.cards.map(c => c.key)).size === s.cards.length && s.cards.every(c => SPIRIT_POWERS.some(p => p.key === c.key)));
    const zones = [...s.minor, ...s.major, ...s.minorDiscard, ...s.majorDiscard, ...s.forgotten, ...s.offered, ...s.progressions.flatMap(p => p.cards), ...s.players.flatMap(p => [...p.hand, ...p.played, ...p.discard])];
    requireRule(zones.length === ids.size && new Set(zones).size === ids.size && zones.every(id => ids.has(id)));
    const links = spiritBoardLinks(s.players.length), landIds = new Set(s.lands.map(l => l.id));
    requireRule(s.lands.length === 8 * s.players.length && landIds.size === s.lands.length);
    for (const l of s.lands) {
        const def = SPIRIT_BOARD_DATA[l.board];
        requireRule(l.id === `${l.board}${l.number}` && l.terrain === def.terrains[l.number - 1] && l.coastal === (l.number <= 3));
        const expected = links.flatMap(([a, b]) => a === l.id ? [b] : b === l.id ? [a] : []).sort();
        requireRule(JSON.stringify([...l.adjacent].sort()) === JSON.stringify(expected));
        requireRule(l.presence.every(p => roster.has(p.playerId) && p.count > 0) && new Set(l.presence.map(p => p.playerId)).size === l.presence.length);
    }
    requireRule(new Set(s.lands.flatMap(l => l.pieces.map(p => p.id))).size === s.lands.reduce((n, l) => n + l.pieces.length, 0));
    requireRule(s.blightPool + s.lands.reduce((n, l) => n + l.blight, 0) === s.blightTotal);
    const selected = s.players.flatMap(p => p.spirit ? [p.spirit] : []);
    requireRule(new Set(selected).size === selected.length);
    for (const p of s.players)
        if (p.spirit) {
            const def = spiritDefinition(p.spirit);
            requireRule(p.energyTrack < def.energy.length && p.cardTrack < def.plays.length);
            requireRule(s.lands.reduce((n, l) => n + presence(l, p.playerId), 0) + p.destroyedPresence + (def.energy.length - 1 - p.energyTrack) + (def.plays.length - 1 - p.cardTrack) === 13);
        }
    requireRule((s.phase === 'FINISHED') === (s.result !== null && s.finishedAt !== null));
    requireRule(s.queue.every(e => roster.has(e.actor) && (!e.target || roster.has(e.target)) && (!e.land || landIds.has(e.land))));
    return s;
}
export function createSpiritGame(input: {
    gameId: SpiritState['gameId'];
    playerIds: PlayerId[];
    now: SpiritState['startedAt'];
    transitionId: SpiritState['transitionId'];
    id(): string;
    shuffle<T>(values: T[]): T[];
}): SpiritState {
    requireRule(input.playerIds.length >= 1 && input.playerIds.length <= 4 && new Set(input.playerIds).size === input.playerIds.length);
    const cards = SPIRIT_POWERS.map(p => ({ cardId: input.id(), key: p.key }));
    const progressions = SPIRITS.map(d => ({ spirit: d.id, cards: d.progression.map(key => cards.find(c => c.key === key)!.cardId) }));
    const reserved = new Set(progressions.flatMap(p => p.cards));
    const deck = (kind: string) => input.shuffle(cards.filter(c => SPIRIT_POWERS.find(p => p.key === c.key)!.deck === kind && !reserved.has(c.cardId)).map(c => c.cardId));
    const terrains: SpiritTerrain[] = ['MOUNTAIN', 'JUNGLE', 'SANDS', 'WETLAND'];
    const first: SpiritInvaderCard[] = terrains.map(t => ({ stage: 1, terrains: [t], coastal: false }));
    const second: SpiritInvaderCard[] = [...terrains.map(t => ({ stage: 2 as const, terrains: [t], coastal: false })), { stage: 2, terrains: [], coastal: true }];
    const third: SpiritInvaderCard[] = terrains.flatMap((t, i) => terrains.slice(i + 1).map(u => ({ stage: 3 as const, terrains: [t, u], coastal: false })));
    const links = spiritBoardLinks(input.playerIds.length);
    const s: SpiritState = { rulesVersion: 'spirit-island-intro-v1', gameId: input.gameId, revision: v.parse(GameRevisionSchema, 0), startedAt: input.now, finishedAt: null, phase: 'PLAYING', transitionId: input.transitionId, round: 1, stage: 'SELECT',
        players: input.playerIds.map((playerId, i) => ({ playerId, spirit: null, board: SPIRIT_BOARDS[i]!, energy: 0, energyTrack: 0, cardTrack: 0, destroyedPresence: 0, grown: false, ready: false, paid: false, reclaimedOne: false, hand: [], played: [], discard: [], resolved: [], elements: [], fastUsed: 0, fastGift: 0, repeatGrants: [], rangeBonus: 0, sharedWith: [], reclaimAtEnd: 0, progression: 0 })),
        lands: SPIRIT_BOARDS.slice(0, input.playerIds.length).flatMap(board => SPIRIT_BOARD_DATA[board].terrains.map((terrain, i) => { const id = `${board}${i + 1}`; return { id, board, number: i + 1, terrain, coastal: i < 3, adjacent: links.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []), pieces: [], presence: [], blight: i + 1 === SPIRIT_BOARD_DATA[board].blight ? 1 : 0, defend: 0, skip: false, protectDahan: false, vitality: false, dahanHealth: 0 }; })), cards, minor: deck('MINOR'), major: deck('MAJOR'), minorDiscard: [], majorDiscard: [], forgotten: cards.filter(c => !['MINOR', 'MAJOR'].includes(SPIRIT_POWERS.find(p => p.key === c.key)!.deck)).map(c => c.cardId), progressions,
        fear: 0, fearDeck: input.shuffle([...SPIRIT_FEAR_KEYS]).slice(0, 9), fearEarned: [], fearDiscard: [], terror: 1, blightPool: 5 * input.playerIds.length + 1, blightTotal: 6 * input.playerIds.length + 1, invaderDeck: [...input.shuffle(first).slice(0, 3), ...input.shuffle(second).slice(0, 4), ...input.shuffle(third).slice(0, 5)], invaderDiscard: [], ravage: null, build: null, explore: null, queue: [], offered: [], offerRecipient: null, offerOther: null, offerDeck: 'MINOR', effectCounter: 0, pieceCounter: 0, log: [], plans: [], flags: [], vengeance: [], result: null };
    for (const l of s.lands) {
        const def = SPIRIT_BOARD_DATA[l.board];
        for (let i = 0; i < def.dahan[l.number - 1]!; i++)
            makePiece(s, l, 'DAHAN');
        if (l.number === 2)
            makePiece(s, l, 'CITY');
        if (l.number === def.town)
            makePiece(s, l, 'TOWN');
    }
    return parseSpiritState(s);
}
function innate(s: SpiritState, id: PlayerId): SpiritPower { const p = player(s, id); requireRule(p.spirit); return { key: 'innate', name: 'Innate', title: spiritDefinition(p.spirit).innate, description: '', cost: 0, speed: p.spirit === 'SHADOW' ? 'FAST' : 'SLOW', range: 1, sacred: p.spirit === 'RIVER' || p.spirit === 'LIGHTNING', sourceTerrain: null, target: p.spirit === 'EARTH' ? 'SPIRIT' : 'ANY', terrains: [], elements: [], deck: p.spirit }; }
export function powerOptions(s: SpiritState, id: PlayerId) {
    const p = player(s, id);
    if (!['FAST', 'SLOW'].includes(s.stage) || s.queue.length || p.ready || !p.spirit || s.phase !== 'PLAYING')
        return [];
    const fastRemaining = Math.max(0, p.fastGift + (p.spirit === 'LIGHTNING' ? elements(s, id).AIR : 0) - p.fastUsed);
    return [...p.played, ...(innateLevel(s, id) ? ['innate'] : [])].flatMap(cardId => {
        const c = cardId === 'innate' ? innate(s, id) : cardPower(s, cardId), resolved = p.resolved.includes(cardId), grant = p.repeatGrants.find(r => r.remaining > 0 && !r.used.includes(cardId) && c.cost <= r.maxCost && (!r.paid || p.energy >= c.cost));
        if (resolved && (!grant || cardId === 'innate'))
            return [];
        const fast = s.stage === 'FAST' && (c.speed === 'FAST' || fastRemaining > 0), slow = s.stage === 'SLOW' && c.speed === 'SLOW';
        if (!fast && !slow)
            return [];
        return [{ cardId, key: c.key, fast, slow, targets: c.target === 'SPIRIT' || c.target === 'OTHER_SPIRIT' ? s.players.filter(q => c.target !== 'OTHER_SPIRIT' || q.playerId !== id || s.players.length === 1).map(q => q.playerId) : s.lands.filter(l => targetAllowed(s, id, c, l)).map(l => l.id), thresholdMax: cardId === 'innate' ? innateLevel(s, id) : 1, repeat: resolved, shadowTargets: c.target === 'SPIRIT' || c.target === 'OTHER_SPIRIT' ? [] : s.lands.filter(l => !targetAllowed(s, id, c, l) && targetAllowed(s, id, c, l, true)).map(l => l.id) }];
    });
}
export type SpiritApplied = {
    ok: true;
    state: SpiritState;
} | {
    ok: false;
    reason: 'INVALID_ACTION' | 'INVALID_PHASE' | 'NOT_YOUR_TURN';
};
export function applySpiritAction(current: SpiritState, actor: PlayerId, input: unknown, now: SpiritState['startedAt'], nextTurn: SpiritState['transitionId'], shuffle: <T>(values: T[]) => T[] = values => values): SpiritApplied {
    if (current.phase !== 'PLAYING')
        return { ok: false, reason: 'INVALID_PHASE' };
    const parsed = v.safeParse(SpiritActionSchema, input);
    if (!parsed.success)
        return { ok: false, reason: 'INVALID_ACTION' };
    try {
        const s = structuredClone(current), p = player(s, actor), a = parsed.output;
        if (s.minor.length < 4 && s.minorDiscard.length) {
            s.minor.push(...shuffle(s.minorDiscard));
            s.minorDiscard = [];
        }
        if (s.major.length < 4 && s.majorDiscard.length) {
            s.major.push(...shuffle(s.majorDiscard));
            s.majorDiscard = [];
        }
        if (a.kind === 'PLAN') {
            requireRule(!a.landId || s.lands.some(l => l.id === a.landId));
            s.plans = s.plans.filter(p => p.playerId !== actor);
            if (a.landId)
                s.plans.push({ playerId: actor, landId: a.landId, intent: a.intent });
            event(s, 'PLAN', '협동 계획 표시', actor, a.landId);
        }
        else if (a.kind === 'CHOOSE') {
            requireRule(a.choiceId === `${s.transitionId}:${s.revision}` && s.queue.length && (s.queue[0]!.target ?? s.queue[0]!.actor) === actor);
            const option = choiceOptions(s).find(o => o.id === a.optionId);
            requireRule(option);
            s.queue.shift();
            option.apply();
            settle(s);
        }
        else {
            requireRule(s.queue.length === 0);
            switch (a.kind) {
                case 'SELECT_SPIRIT': {
                    requireRule(s.stage === 'SELECT' && !p.spirit && !s.players.some(q => q.spirit === a.spirit));
                    p.spirit = a.spirit;
                    const home = s.lands.filter(l => l.board === p.board), last = (terrain: SpiritTerrain) => home.filter(l => l.terrain === terrain).at(-1)!;
                    if (a.spirit === 'RIVER')
                        addPresence(last('WETLAND'), actor, 1);
                    else if (a.spirit === 'LIGHTNING')
                        addPresence(last('SANDS'), actor, 2);
                    else if (a.spirit === 'EARTH') {
                        addPresence(last('MOUNTAIN'), actor, 2);
                        addPresence(home.find(l => l.number === SPIRIT_BOARD_DATA[p.board].blight)!, actor, 1);
                    }
                    else {
                        addPresence(last('JUNGLE'), actor, 2);
                        addPresence(last('SANDS'), actor, 1);
                    }
                    p.hand = s.forgotten.filter(id => cardPower(s, id).deck === a.spirit);
                    s.forgotten = s.forgotten.filter(id => !p.hand.includes(id));
                    event(s, 'SELECT', `${spiritDefinition(a.spirit).name} 선택`, actor);
                    if (s.players.every(p => p.spirit)) {
                        for (const reserved of s.progressions.filter(r => !s.players.some(p => p.spirit === r.spirit))) {
                            for (const id of reserved.cards)
                                (cardPower(s, id).deck === 'MINOR' ? s.minor : s.major).push(id);
                            reserved.cards = [];
                        }
                        s.minor = shuffle(s.minor);
                        s.major = shuffle(s.major);
                        s.queue.push(step('SPECIAL', actor, null, 0, 'EXPLORE'), step('SPECIAL', actor, null, 0, 'ADVANCE_INVADERS'));
                        s.stage = 'PREPARE';
                        settle(s);
                    }
                    break;
                }
                case 'GROW': {
                    requireRule(s.stage === 'PREPARE' && !p.grown && !p.ready && p.spirit);
                    p.grown = true;
                    const g = spiritDefinition(p.spirit).growth[a.option]!;
                    const tags = [...(g.reclaim ? ['reclaim:0'] : []), ...(g.gain ? ['gain:0'] : []), ...(g.energy ? [`energy:${g.energy}`] : []), ...g.presence.map(n => `presence:${n}`)];
                    s.queue.push(step('SPECIAL', actor, null, 0, 'GROWTH', actor, tags), step('SPECIAL', actor, null, 0, 'END_GROW', actor));
                    settle(s);
                    break;
                }
                case 'PLAY_CARDS': {
                    requireRule(s.stage === 'PREPARE' && p.grown && !p.ready && new Set(a.cardIds).size === a.cardIds.length && a.cardIds.length <= playLimit(p));
                    const pool = [...p.hand, ...p.played];
                    requireRule(a.cardIds.every(id => pool.includes(id)));
                    const old = p.played.reduce((n, id) => n + cardPower(s, id).cost, 0), cost = a.cardIds.reduce((n, id) => n + cardPower(s, id).cost, 0);
                    requireRule(p.energy + old >= cost);
                    p.energy += old - cost;
                    p.hand = pool.filter(id => !a.cardIds.includes(id));
                    p.played = [...a.cardIds];
                    p.paid = true;
                    event(s, 'CARD', `능력 ${p.played.length}장 준비`, actor);
                    break;
                }
                case 'RECLAIM_ONE':
                    requireRule(s.stage === 'PREPARE' && p.spirit === 'RIVER' && p.cardTrack >= 4 && !p.reclaimedOne && !p.ready && p.discard.includes(a.cardId));
                    p.discard = p.discard.filter(id => id !== a.cardId);
                    p.hand.push(a.cardId);
                    p.reclaimedOne = true;
                    break;
                case 'READY':
                    requireRule(['PREPARE', 'FAST', 'SLOW'].includes(s.stage) && (s.stage !== 'PREPARE' || p.grown));
                    p.ready = a.ready;
                    if (s.players.every(q => q.ready)) {
                        s.stage = s.stage === 'PREPARE' ? 'FAST' : s.stage === 'FAST' ? 'FEAR' : 'TIME';
                        for (const q of s.players)
                            q.ready = false;
                        event(s, 'PHASE', `${s.stage} 단계`);
                    }
                    break;
                case 'USE_POWER': {
                    const opt = powerOptions(s, actor).find(o => o.cardId === a.cardId && o.repeat === a.repeat);
                    requireRule(opt && (a.fast ? opt.fast : opt.slow) && a.threshold <= opt.thresholdMax && (a.cardId !== 'innate' || a.threshold >= 1));
                    requireRule((a.shadowReach ? opt.shadowTargets : opt.targets).includes(a.target));
                    const c = a.cardId === 'innate' ? innate(s, actor) : cardPower(s, a.cardId);
                    if (a.repeat) {
                        const grant = p.repeatGrants.find(r => r.remaining && !r.used.includes(a.cardId) && c.cost <= r.maxCost && (!r.paid || p.energy >= c.cost));
                        requireRule(grant);
                        grant.remaining--;
                        grant.used.push(a.cardId);
                        if (grant.paid)
                            p.energy -= c.cost;
                    }
                    else
                        p.resolved.push(a.cardId);
                    if (a.fast && c.speed === 'SLOW')
                        p.fastUsed++;
                    if (a.shadowReach) {
                        requireRule(p.energy >= 1);
                        p.energy--;
                    }
                    const target = s.players.find(q => q.playerId === a.target)?.playerId ?? actor, at = s.lands.some(l => l.id === a.target) ? a.target : null;
                    s.flags = s.flags.filter(f => f !== 'harbinger-fear');
                    event(s, 'POWER', c.title, actor, at);
                    const effects = powerSteps(s, actor, c.key, at, target, a.threshold).filter(e => !a.repeat || !['PAID_REPEAT', 'FREE_REPEAT', 'REPEAT_WINDS', 'REPEAT_LAND_PAIN'].includes(e.key));
                    s.queue.push(...effects, step('CHECK', actor));
                    settle(s);
                    break;
                }
                case 'ADVANCE': {
                    requireRule(['FEAR', 'RAVAGE', 'BUILD', 'EXPLORE', 'TIME'].includes(s.stage));
                    if (s.stage === 'FEAR') {
                        const next = s.fearEarned.shift();
                        if (next)
                            s.queue.push(step('SPECIAL', actor, null, 0, 'FEAR_CARD', null, [next]));
                        else
                            s.stage = 'RAVAGE';
                    }
                    else if (s.stage === 'RAVAGE') {
                        s.queue.push(...s.lands.filter(l => s.ravage && (s.ravage.coastal ? l.coastal : s.ravage.terrains.includes(l.terrain))).flatMap(l => [step('SPECIAL', actor, l.id, 0, 'RAVAGE'), step('CHECK', actor)]), step('SPECIAL', actor, null, 0, 'STAGE_BUILD'));
                    }
                    else if (s.stage === 'BUILD') {
                        s.queue.push(step('SPECIAL', actor, null, 0, 'BUILD'));
                        s.stage = 'EXPLORE';
                    }
                    else if (s.stage === 'EXPLORE') {
                        s.queue.push(step('SPECIAL', actor, null, 0, 'EXPLORE'), step('SPECIAL', actor, null, 0, 'ADVANCE_INVADERS'));
                        s.stage = 'SLOW';
                    }
                    else
                        s.queue.push(step('SPECIAL', actor, null, 0, 'TIME'));
                    settle(s);
                    event(s, 'PHASE', `${s.stage} 단계`);
                    break;
                }
            }
        }
        if (s.queue.length === 0)
            checkEnd(s);
        if (s.phase === 'FINISHED')
            s.finishedAt = now;
        s.revision = v.parse(GameRevisionSchema, s.revision + 1);
        s.transitionId = nextTurn;
        return { ok: true, state: parseSpiritState(s) };
    }
    catch (error) {
        if (error instanceof SpiritRuleError)
            return { ok: false, reason: 'INVALID_ACTION' };
        throw error;
    }
}
export function cancelSpirit(current: SpiritState, now: SpiritState['startedAt']): SpiritState { const s = structuredClone(current); if (s.phase === 'FINISHED')
    return s; s.phase = 'FINISHED'; s.finishedAt = now; s.revision = v.parse(GameRevisionSchema, s.revision + 1); s.result = { reason: 'CANCELLED', winnerPlayerIds: [], round: s.round }; s.queue = []; return parseSpiritState(s); }
