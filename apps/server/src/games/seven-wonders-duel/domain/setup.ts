import { DUEL_CARDS, DUEL_WONDERS, DUEL_GODS, DUEL_MYTHOLOGIES, DUEL_PROGRESS, DUEL_CONSPIRACIES, DUEL_RULES_VERSION, type DuelSettings, type GameId, type PlayerId, type TileId, type ServerTime, type TurnId } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { parseDuelState, type DuelState, type DuelEntity, type DuelSeat } from './state.js';
export function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = random.nextInt(i + 1);
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
}
export function layout(age: 1 | 2 | 3, agora: boolean): DuelState['slots'] {
    const counts = age === 1 ? (agora ? [3, 4, 5, 6, 7] : [2, 3, 4, 5, 6]) : age === 2 ? (agora ? [7, 6, 5, 4, 3] : [6, 5, 4, 3, 2]) : agora ? [2, 3, 4, 5, 4, 3, 2] : [2, 3, 4, 2, 4, 3, 2];
    const width = Math.max(...counts);
    let index = 0;
    const slots = counts.flatMap((n, y) => Array.from({ length: n }, (_, i) => ({ index: index++, x: age === 3 && !agora && y === 3 ? .5 + i * 2 : (width - n) / 2 + i, y, coveredBy: [] as number[], faceUp: y % 2 === 0, mythology: null as string | null, offering: 0 })));
    for (const slot of slots)
        slot.coveredBy = slots.filter(next => next.y === slot.y + 1 && Math.abs(next.x - slot.x) < .99).map(s => s.index);
    return slots;
}
export function setupAge(s: DuelState, random: RandomSource): void {
    s.slots = layout(s.age, s.settings.agora);
    const cards = shuffled(s.cards.filter(c => c.zone === 'DECK' && c.age === s.age), random);
    if (cards.length !== s.slots.length)
        throw new Error('Age deck / layout mismatch.');
    cards.forEach((c, i) => { c.zone = 'BOARD'; c.slot = i; });
    if (s.settings.pantheon) {
        const positions = s.age === 1 ? (s.settings.agora ? [4, 6, 12, 14, 17] : [2, 4, 9, 11, 13]) : s.age === 2 ? (s.settings.agora ? [7, 9, 12] : [6, 8, 10]) : [];
        if (s.age === 1) {
            const tokens = shuffled([...DUEL_MYTHOLOGIES, ...DUEL_MYTHOLOGIES], random).slice(0, 5);
            positions.forEach((index, i) => { s.slots[index]!.mythology = tokens[i]!; });
        }
        if (s.age === 2) {
            const offerings = shuffled([2, 3, 4], random);
            positions.forEach((index, i) => { s.slots[index]!.offering = offerings[i]!; });
            const empty = s.pantheon.indexOf(null);
            if (empty >= 0)
                s.pantheon[empty] = 'gate';
            s.pantheonKnown = s.pantheon.map(() => [0, 1]);
            if (s.pantheon.includes('enki'))
                revealEnki(s, random);
        }
    }
}
export function revealEnki(s: DuelState, random: RandomSource): void {
    if (s.progress.some(t => t.zone === 'ENKI'))
        return;
    shuffled(s.progress.filter(t => t.zone === 'BOX'), random).slice(0, 2).forEach(t => { t.zone = 'ENKI'; t.source = 'enki'; });
}
export function createDuelGame(input: {
    generateTileId(): TileId;
    gameId: GameId;
    playerIds: readonly PlayerId[];
    now: ServerTime;
    turnId: TurnId;
    random: RandomSource;
    settings: DuelSettings;
}): DuelState {
    if (input.playerIds.length !== 2 || new Set(input.playerIds).size !== 2)
        throw new Error('Two distinct players required.');
    const { random, settings } = input, starter: DuelSeat = random.nextInt(2) === 0 ? 0 : 1;
    const cards: DuelEntity[] = DUEL_CARDS.filter(c => ['WHITE', 'BLACK'].includes(c.color) ? settings.agora : c.color === 'TEMPLE' ? settings.pantheon : true).map(c => ({ tileId: input.generateTileId(), definitionId: c.id, zone: 'OUT', owner: -1, age: c.age === 1 ? 1 : c.age === 2 ? 2 : c.age === 3 ? 3 : 0, slot: null, under: null }));
    for (const age of [1, 2, 3] as const) {
        const deck = shuffled(cards.filter(c => c.age === age && !['PURPLE', 'TEMPLE'].includes(DUEL_CARDS.find(d => d.id === c.definitionId)!.color)), random);
        deck.forEach((c, i) => c.zone = i < 3 ? 'BOX' : 'DECK');
    }
    shuffled(cards.filter(c => DUEL_CARDS.find(d => d.id === c.definitionId)!.color === (settings.pantheon ? 'TEMPLE' : 'PURPLE')), random).slice(0, 3).forEach(c => c.zone = 'DECK');
    if (settings.agora)
        shuffled(cards.filter(c => c.age === 0), random).forEach((c, i) => { c.age = i < 5 ? 1 : i < 10 ? 2 : 3; c.zone = 'DECK'; });
    const chosen = shuffled(DUEL_WONDERS.filter(w => !w.expansion || w.expansion === 'PANTHEON' && settings.pantheon || w.expansion === 'AGORA' && settings.agora), random).slice(0, 8);
    const progress = shuffled(DUEL_PROGRESS.filter(p => p.expansion === 'BASE' || p.expansion === 'PANTHEON' && settings.pantheon || p.expansion === 'AGORA' && settings.agora), random);
    const conspiracies = settings.agora ? shuffled(DUEL_CONSPIRACIES, random).map(c => ({ id: input.generateTileId(), definitionId: c.id, zone: 'DECK', owner: -1, triggered: false })) : [];
    const s = parseDuelState({ gameId: input.gameId, revision: 0, rulesVersion: DUEL_RULES_VERSION, startedAt: input.now, finishedAt: null, phase: 'PLAYING', transitionId: input.turnId, settings, deadlineAt: settings.turnDurationSeconds === 0 ? null : input.now + settings.turnDurationSeconds * 1000, turnNumber: 0, timerRemaining: [settings.turnDurationSeconds * 1000, settings.turnDurationSeconds * 1000],
        players: input.playerIds.map(playerId => ({ playerId, coins: 7, protectedCoins: 0, mythology: [], offerings: [], influence: [0, 0, 0, 0, 0, 0], gods: [], snake: null })), active: starter, starter, age: 1, stage: 'DRAFT', draftCount: 0, replay: false, cards, slots: [], wonders: chosen.map(w => ({ id: w.id, owner: -1, built: false, removed: false })),
        progress: progress.map((p, i) => ({ id: p.id, zone: i < 5 ? 'BOARD' : 'BOX', owner: -1, source: null })), revealedGods: [], godDecks: settings.pantheon ? DUEL_MYTHOLOGIES.map(mythology => ({ mythology, ids: shuffled(DUEL_GODS.filter(d => d.mythology === mythology).map(d => d.id), random) })) : [], pantheon: [null, null, null, null, null, null], pantheonKnown: [[], [], [], [], [], []], conspiracies, conspiracyOrder: conspiracies.map(c => c.id),
        decrees: settings.agora ? shuffled(Array.from({ length: 16 }, (_, i) => i + 1), random).slice(0, 6).map((id, chamber) => ({ id, chamber, revealed: chamber === 0 || chamber === 2 || chamber === 3 || chamber === 5 })) : [], military: 0, militaryTokens: [-6, -3, 3, 6], minerva: null, tasks: [], history: [], result: null });
    setupAge(s, random);
    return parseDuelState(s);
}
