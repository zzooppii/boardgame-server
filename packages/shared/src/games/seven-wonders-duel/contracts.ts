import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, TileIdSchema, TurnIdSchema } from '../../identifiers.js';
import { GameRevisionSchema } from '../../protocol.js';
import { DuelSettingsSchema } from './actions.js';
import { DUEL_RULES_VERSION, DUEL_CARDS, DUEL_WONDERS } from './catalog.js';
export const DuelCount = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10000));
export const DuelId = v.pipe(v.string(), v.minLength(1), v.maxLength(120));
export const DuelOptionSchema = v.strictObject({ id: DuelId, group: v.picklist(['BUILD', 'DISCARD', 'WONDER', 'PREPARE', 'INVOKE', 'TRIGGER', 'CHOICE', 'SKIP', 'DRAFT']), label: v.pipe(v.string(), v.maxLength(300)), detail: v.pipe(v.string(), v.maxLength(600)), sourceId: v.nullable(DuelId), targetId: v.nullable(DuelId), definitionId: v.nullable(DuelId), cost: v.nullable(DuelCount) });
export type DuelOption = v.InferOutput<typeof DuelOptionSchema>;
export const DuelVisibleCardSchema = v.strictObject({ tileId: TileIdSchema, definitionId: v.nullable(DuelId), back: v.picklist(['AGE', 'SENATOR']), slot: v.nullable(DuelCount) });
export const DuelSlotSchema = v.strictObject({ index: DuelCount, x: v.number(), y: DuelCount, coveredBy: v.array(DuelCount), faceUp: v.boolean(), mythology: v.nullable(DuelId), offering: DuelCount });
export const DuelWonderViewSchema = v.strictObject({ id: DuelId, owner: v.nullable(PlayerIdSchema), built: v.boolean(), removed: v.boolean() });
export const DuelPlayerViewSchema = v.strictObject({ playerId: PlayerIdSchema, coins: DuelCount, protectedCoins: DuelCount, buildings: v.array(DuelVisibleCardSchema), gods: v.array(DuelId), progress: v.array(DuelId), science: v.array(DuelId), mythology: v.array(DuelId), offerings: v.array(DuelCount), influence: v.pipe(v.array(DuelCount), v.length(6)), conspiracies: v.array(v.strictObject({ id: DuelId, definitionId: v.nullable(DuelId), prepared: v.boolean(), triggered: v.boolean() })) });
export const DuelScoreSchema = v.strictObject({ playerId: PlayerIdSchema, green: v.number(), blue: v.number(), yellow: v.number(), guild: v.number(), wonders: v.number(), progress: v.number(), coins: v.number(), military: v.number(), gods: v.number(), temples: v.number(), senate: v.number(), total: v.number() });
export const DuelResultSchema = v.strictObject({ reason: v.picklist(['SCORED', 'MILITARY', 'SCIENCE', 'POLITICAL', 'CANCELLED']), winnerPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(2)), scores: v.array(DuelScoreSchema) });
export const DuelPublicFields = {
    settings: DuelSettingsSchema, age: v.picklist([1, 2, 3]), stage: v.picklist(['DRAFT', 'TURN_START', 'ACTION', 'RESOLVING', 'NEXT_AGE']), activePlayerId: PlayerIdSchema,
    playerStates: v.pipe(v.array(DuelPlayerViewSchema), v.length(2)), board: v.array(DuelVisibleCardSchema), slots: v.array(DuelSlotSchema), discard: v.array(DuelVisibleCardSchema), wonders: v.array(DuelWonderViewSchema), draftAvailable: v.array(DuelId),
    military: v.pipe(v.number(), v.safeInteger(), v.minValue(-9), v.maxValue(9)), militaryTokens: v.array(v.number()), minerva: v.nullable(v.number()), progress: v.array(DuelId),
    revealedGods: v.array(DuelId), pantheon: v.array(v.strictObject({ slot: DuelCount, godId: v.nullable(DuelId), occupied: v.boolean(), costs: v.pipe(v.array(DuelCount), v.length(2)) })), enki: v.array(DuelId),
    decrees: v.array(v.strictObject({ chamber: DuelCount, ids: v.array(v.nullable(DuelCount)), controller: v.nullable(PlayerIdSchema) })),
    decision: v.nullable(v.strictObject({ playerId: PlayerIdSchema, label: v.string() })),
    history: v.array(v.strictObject({ id: DuelCount, playerId: PlayerIdSchema, text: v.pipe(v.string(), v.maxLength(600)), sound: v.picklist(['card', 'coin', 'wonder', 'military', 'science', 'god', 'senate', 'conspiracy', 'reveal', 'turn', 'finish']) })),
};
const Base = { gameType: v.literal('SEVEN_WONDERS_DUEL'), gameId: GameIdSchema, gameRevision: GameRevisionSchema, rulesVersion: v.literal(DUEL_RULES_VERSION), ...DuelPublicFields, privateState: v.strictObject({ playerId: PlayerIdSchema, options: v.pipe(v.array(DuelOptionSchema), v.maxLength(2000)) }) };
export const DuelPlayingProjectionSchema = v.strictObject({ ...Base, phase: v.literal('PLAYING'), turnId: TurnIdSchema });
export const DuelFinishedProjectionSchema = v.strictObject({ ...Base, phase: v.literal('FINISHED'), result: DuelResultSchema });
export type DuelProjection = v.InferOutput<typeof DuelPlayingProjectionSchema> | v.InferOutput<typeof DuelFinishedProjectionSchema>;
export function duelProjectionIsConsistent(g: DuelProjection): boolean {
    const ids = g.playerStates.map(p => p.playerId), all = [...g.board, ...g.discard, ...g.playerStates.flatMap(p => p.buildings)];
    return new Set(ids).size === 2 && ids.includes(g.activePlayerId) && ids.includes(g.privateState.playerId) && new Set(all.map(c => c.tileId)).size === all.length && all.every(c => c.definitionId === null || DUEL_CARDS.some(d => d.id === c.definitionId)) && g.wonders.every(w => DUEL_WONDERS.some(d => d.id === w.id) && (w.owner === null || ids.includes(w.owner))) && (g.decision === null || ids.includes(g.decision.playerId)) && (g.privateState.options.length === 0 || g.decision?.playerId === g.privateState.playerId) && g.slots.every(slot => slot.coveredBy.every(i => g.slots.some(s => s.index === i))) && (g.phase !== 'FINISHED' || g.result.winnerPlayerIds.every(id => ids.includes(id)));
}
