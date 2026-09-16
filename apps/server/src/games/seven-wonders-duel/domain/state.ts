import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, PlayerIdSchema, TileIdSchema, TurnIdSchema, ServerTimeSchema, DuelSettingsSchema, DuelCount, DuelId, DuelSlotSchema, DuelResultSchema, DUEL_RULES_VERSION, DUEL_CARDS, DUEL_WONDERS, DUEL_GODS, DUEL_PROGRESS, DUEL_CONSPIRACIES, type PlayerId } from '@hangul-rummikub/shared';
const Owner = v.picklist([-1, 0, 1]);
export const DuelEntitySchema = v.strictObject({ tileId: TileIdSchema, definitionId: DuelId, zone: v.picklist(['DECK', 'BOX', 'OUT', 'BOARD', 'CITY', 'DISCARD', 'WONDER', 'PREPARED']), owner: Owner, age: v.picklist([0, 1, 2, 3]), slot: v.nullable(DuelCount), under: v.nullable(DuelId) });
const Player = v.strictObject({ playerId: PlayerIdSchema, coins: DuelCount, protectedCoins: DuelCount, mythology: v.array(DuelId), offerings: v.array(DuelCount), influence: v.pipe(v.array(DuelCount), v.length(6)), gods: v.array(DuelId), snake: v.nullable(TileIdSchema) });
export const TASK_KINDS = ['PROGRESS', 'LIBRARY', 'RESURRECT', 'DESTROY_BROWN', 'DESTROY_GREY', 'DESTROY_BLUE', 'DESTROY_YELLOW', 'STEAL_RESOURCE', 'GOD_PLACE', 'GOD_SLOT', 'GOD_TOP', 'GOD_DECK', 'GOD_PICK', 'GOD_ORDER', 'ENKI', 'SNAKE', 'MINERVA', 'NEPTUNE_DISCARD', 'NEPTUNE_APPLY', 'ANUBIS', 'ISIS', 'STEAL_WONDER', 'SENATE', 'CONSPIRE', 'CONSPIRACY_PICK', 'CONSPIRACY_RETURN', 'UNPREPARED', 'LOCK_PROGRESS', 'SWAP', 'MOVE_DECREE', 'PLACE', 'MOVE', 'REMOVE', 'BOX_BUILD', 'TOP_BUILD', 'DISCARD_TWO', 'DISCARD_ANY', 'SABOTAGE', 'REVEAL', 'HANDOFF', 'CHECK_SCIENCE'] as const;
const Task = v.strictObject({ kind: v.picklist(TASK_KINDS), actor: v.picklist([0, 1]), data: v.array(DuelId), remaining: DuelCount, section: v.pipe(v.number(), v.safeInteger(), v.minValue(-1), v.maxValue(2)), optional: v.boolean() });
export type DuelTask = v.InferOutput<typeof Task>;
const State = v.strictObject({
    gameId: GameIdSchema, revision: GameRevisionSchema, rulesVersion: v.literal(DUEL_RULES_VERSION), startedAt: ServerTimeSchema, finishedAt: v.nullable(ServerTimeSchema), phase: v.picklist(['PLAYING', 'FINISHED']), transitionId: TurnIdSchema, settings: DuelSettingsSchema,
    deadlineAt: v.nullable(ServerTimeSchema), turnNumber: DuelCount, timerRemaining: v.tuple([v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(90000)), v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(90000))]),
    players: v.pipe(v.array(Player), v.length(2)), active: v.picklist([0, 1]), starter: v.picklist([0, 1]), age: v.picklist([1, 2, 3]), stage: v.picklist(['DRAFT', 'TURN_START', 'ACTION', 'NEXT_AGE']), draftCount: DuelCount, replay: v.boolean(),
    cards: v.array(DuelEntitySchema), slots: v.array(DuelSlotSchema), wonders: v.array(v.strictObject({ id: DuelId, owner: Owner, built: v.boolean(), removed: v.boolean() })),
    progress: v.array(v.strictObject({ id: DuelId, zone: v.picklist(['BOARD', 'BOX', 'PLAYER', 'ENKI', 'LOCKED']), owner: Owner, source: v.nullable(DuelId) })),
    revealedGods: v.array(DuelId), godDecks: v.array(v.strictObject({ mythology: DuelId, ids: v.array(DuelId) })), pantheon: v.pipe(v.array(v.nullable(DuelId)), v.length(6)), pantheonKnown: v.array(v.array(v.picklist([0, 1]))),
    conspiracies: v.array(v.strictObject({ id: TileIdSchema, definitionId: DuelId, zone: v.picklist(['DECK', 'CHOICE', 'HAND']), owner: Owner, triggered: v.boolean() })), conspiracyOrder: v.array(TileIdSchema),
    decrees: v.array(v.strictObject({ id: DuelCount, chamber: DuelCount, revealed: v.boolean() })), military: v.pipe(v.number(), v.safeInteger(), v.minValue(-9), v.maxValue(9)), militaryTokens: v.array(v.number()), minerva: v.nullable(v.number()),
    tasks: v.array(Task), history: v.array(v.strictObject({ id: DuelCount, playerId: PlayerIdSchema, text: v.string(), sound: v.picklist(['card', 'coin', 'wonder', 'military', 'science', 'god', 'senate', 'conspiracy', 'reveal', 'turn', 'finish']) })), result: v.nullable(DuelResultSchema),
});
export type DuelState = v.InferOutput<typeof State>;
export type DuelEntity = v.InferOutput<typeof DuelEntitySchema>;
export type DuelSeat = 0 | 1;
export function other(seat: DuelSeat): DuelSeat { return seat === 0 ? 1 : 0; }
export function playerIndex(s: DuelState, id: PlayerId): DuelSeat | null { return s.players[0]!.playerId === id ? 0 : s.players[1]!.playerId === id ? 1 : null; }
export function task(kind: DuelTask['kind'], actor: DuelSeat, data: string[] = [], remaining = 1, section = -1, optional = false): DuelTask { return { kind, actor, data, remaining, section, optional }; }
export function parseDuelState(input: unknown): DuelState {
    const s = v.parse(State, input);
    if ((s.phase === 'PLAYING' && s.settings.turnDurationSeconds !== 0) !== (s.deadlineAt !== null) || s.timerRemaining.some(n => n > s.settings.turnDurationSeconds * 1000))
        throw new Error('Invalid Duel turn timer.');
    if (new Set(s.players.map(p => p.playerId)).size !== 2 || new Set(s.cards.map(c => c.tileId)).size !== s.cards.length || new Set(s.cards.map(c => c.definitionId)).size !== s.cards.length)
        throw new Error('Invalid Duel inventory identity.');
    const expected = DUEL_CARDS.filter(c => c.color === 'WHITE' || c.color === 'BLACK' ? s.settings.agora : c.color === 'TEMPLE' ? s.settings.pantheon : true);
    if (expected.length !== s.cards.length || expected.some(d => !s.cards.some(c => c.definitionId === d.id)))
        throw new Error('Duel card conservation failed.');
    if (s.cards.some(c => !DUEL_CARDS.some(d => d.id === c.definitionId) || (c.zone === 'CITY' || c.zone === 'WONDER' || c.zone === 'PREPARED') && c.owner === -1 || c.zone === 'BOARD' && (c.slot === null || !s.slots.some(t => t.index === c.slot)) || c.zone !== 'BOARD' && c.slot !== null))
        throw new Error('Invalid Duel card location.');
    const board = s.cards.filter(c => c.zone === 'BOARD');
    if (new Set(board.map(c => c.slot)).size !== board.length)
        throw new Error('Duplicate board position.');
    if (s.wonders.length !== 8 || new Set(s.wonders.map(w => w.id)).size !== 8 || s.wonders.some(w => !DUEL_WONDERS.some(d => d.id === w.id) || w.built && w.owner === -1))
        throw new Error('Invalid wonders.');
    for (const w of s.wonders) {
        const n = s.cards.filter(c => c.zone === 'WONDER' && c.under === w.id);
        if (n.length !== (w.built ? 1 : 0) || n.some(c => c.owner !== w.owner))
            throw new Error('Invalid wonder construction card.');
    }
    if (s.players.some(p => p.influence.reduce((a, b) => a + b, 0) > 12) || s.decrees.some(d => d.chamber > 5 || d.id < 1 || d.id > 16) || new Set(s.decrees.map(d => d.id)).size !== s.decrees.length)
        throw new Error('Invalid Senate.');
    if (s.progress.some(p => !DUEL_PROGRESS.some(d => d.id === p.id)) || new Set(s.progress.map(p => p.id)).size !== s.progress.length)
        throw new Error('Invalid progress.');
    const gods = [...s.godDecks.flatMap(d => d.ids), ...s.pantheon.filter((id): id is string => id !== null), ...s.players.flatMap(p => p.gods)];
    if (new Set(gods).size !== gods.length || gods.some(id => !DUEL_GODS.some(d => d.id === id)))
        throw new Error('Invalid divinity inventory.');
    if (s.conspiracies.some(c => !DUEL_CONSPIRACIES.some(d => d.id === c.definitionId)) || new Set(s.conspiracies.map(c => c.id)).size !== s.conspiracies.length || new Set(s.conspiracyOrder).size !== s.conspiracyOrder.length || s.conspiracyOrder.some(id => !s.conspiracies.some(c => c.id === id && c.zone === 'DECK')))
        throw new Error('Invalid conspiracy deck.');
    const progressCount = 10 + (s.settings.pantheon ? 3 : 0) + (s.settings.agora ? 2 : 0);
    if (s.progress.length !== progressCount || s.progress.some(t => (t.zone === 'PLAYER') !== (t.owner !== -1)))
        throw new Error('Invalid progress ownership/conservation.');
    if (s.conspiracies.length !== (s.settings.agora ? 16 : 0) || s.conspiracies.filter(c => c.zone === 'DECK').length !== s.conspiracyOrder.length || s.conspiracies.some(c => (c.zone === 'DECK') !== (c.owner === -1)))
        throw new Error('Invalid conspiracy conservation.');
    if (s.cards.some(c => c.zone === 'WONDER' && !s.wonders.some(w => w.id === c.under && w.built && w.owner === c.owner) || c.zone === 'PREPARED' && !s.conspiracies.some(t => t.id === c.under && t.zone === 'HAND' && t.owner === c.owner)))
        throw new Error('Orphan construction/preparation card.');
    const prepared = s.cards.filter(c => c.zone === 'PREPARED');
    if (new Set(prepared.map(c => c.under)).size !== prepared.length)
        throw new Error('Duplicate conspiracy preparation.');
    if (s.phase === 'FINISHED' && s.tasks.length)
        throw new Error('Finished game has pending decisions.');
    if ((s.phase === 'FINISHED') !== (s.result !== null && s.finishedAt !== null))
        throw new Error('Invalid Duel finish state.');
    return s;
}
