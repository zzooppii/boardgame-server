import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, TileIdSchema, TurnIdSchema } from '../../identifiers.js';
import { GameRevisionSchema } from '../../protocol.js';
import { PerchBirdSchema, PerchFlockSchema } from './actions.js';
import { PERCH_LOCATION_INFO, PerchCreatureSchema, PerchLocationSchema, PerchObjectiveSchema, perchFountainCells } from './catalog.js';
export const PerchCount = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const PerchSettingsSchema = v.strictObject({ randomBoard: v.boolean(), objectives: v.boolean() });
export const PerchStackSchema = v.strictObject({ flock: PerchFlockSchema, birds: v.pipe(v.array(PerchBirdSchema), v.minLength(1), v.maxLength(28)), nest: v.nullable(PerchCount), house: v.boolean() });
export type PerchStack = v.InferOutput<typeof PerchStackSchema>;
export const PerchTileSchema = v.strictObject({ tileId: TileIdSchema, definitionId: PerchLocationSchema, col: PerchCount, row: PerchCount, removed: v.boolean(), nests: v.array(v.boolean()), stacks: v.array(PerchStackSchema) });
export type PerchTile = v.InferOutput<typeof PerchTileSchema>;
export const PerchCreatureStateSchema = v.strictObject({ creature: PerchCreatureSchema, controller: v.nullable(PlayerIdSchema), tileId: v.nullable(TileIdSchema), intersection: v.array(TileIdSchema), used: v.boolean() });
export type PerchCreatureState = v.InferOutput<typeof PerchCreatureStateSchema>;
export const PerchChoiceSchema = v.strictObject({ id: v.string(), label: v.string(), tileIds: v.array(TileIdSchema), birdId: v.nullable(TileIdSchema), slot: v.nullable(PerchCount) });
export type PerchChoice = v.InferOutput<typeof PerchChoiceSchema>;
export const PerchSoundSchema = v.picklist(['DEAL', 'PLACE', 'WING', 'WATER', 'HOUSE', 'ZAP', 'CREATURE', 'SCORE', 'TURN', 'WIN', 'NONE']);
export const PerchLogSchema = v.strictObject({ id: PerchCount, text: v.string(), sound: PerchSoundSchema, tileId: v.nullable(TileIdSchema) });
export type PerchLog = v.InferOutput<typeof PerchLogSchema>;
export const PerchScoreLineSchema = v.strictObject({ playerId: PlayerIdSchema, source: v.string(), points: PerchCount });
export const PerchResultSchema = v.strictObject({ reason: v.picklist(['SCORED', 'CANCELLED']), winnerPlayerIds: v.array(PlayerIdSchema), bonuses: v.array(PerchScoreLineSchema), objectives: v.array(v.strictObject({ playerId: PlayerIdSchema, objective: v.nullable(PerchObjectiveSchema), achieved: v.boolean() })) });
export const PerchStageSchema = v.picklist(['SETUP', 'OBJECTIVES', 'MIGRATION', 'RECRUIT', 'PERCH', 'UPKEEP', 'ROUND_END']);
export const PerchPublicPlayerSchema = v.strictObject({ playerId: PlayerIdSchema, flock: PerchFlockSchema, score: PerchCount, hand: v.array(PerchBirdSchema), supplyCount: PerchCount, objectiveSelected: v.boolean(), house: v.boolean(), lightning: v.boolean() });
export const PerchPendingViewSchema = v.strictObject({ actor: PlayerIdSchema, title: v.string(), kind: v.string(), choices: v.array(PerchChoiceSchema) });
const Base = { gameType: v.literal('PERCH'), gameId: GameIdSchema, gameRevision: GameRevisionSchema, rulesVersion: v.literal('perch-base-v1'), settings: PerchSettingsSchema, playerStates: v.pipe(v.array(PerchPublicPlayerSchema), v.minLength(2), v.maxLength(5)), activePlayerId: PlayerIdSchema, round: v.pipe(PerchCount, v.minValue(1), v.maxValue(5)), board: v.array(PerchTileSchema), creatures: v.array(PerchCreatureStateSchema), fountain: v.array(v.nullable(PerchBirdSchema)), plaza: v.array(PerchBirdSchema), bagCount: PerchCount, neutralSupplyCount: v.nullable(PerchCount), turnOrder: v.array(PlayerIdSchema), placed: v.boolean(), bonusUsed: v.boolean(), pending: v.nullable(PerchPendingViewSchema), history: v.pipe(v.array(PerchLogSchema), v.maxLength(100)), roundScores: v.array(PerchScoreLineSchema), privateState: v.strictObject({ playerId: PlayerIdSchema, objective: v.nullable(PerchObjectiveSchema), objectiveChoices: v.pipe(v.array(PerchObjectiveSchema), v.maxLength(2)) }) };
export const PerchPlayingProjectionSchema = v.strictObject({ ...Base, phase: PerchStageSchema, turnId: TurnIdSchema });
export const PerchFinishedProjectionSchema = v.strictObject({ ...Base, phase: v.literal('FINISHED'), result: PerchResultSchema });
export type PerchProjection = v.InferOutput<typeof PerchPlayingProjectionSchema> | v.InferOutput<typeof PerchFinishedProjectionSchema>;
export function perchStrength(stack: PerchStack | undefined): number { return stack ? stack.birds.length + (stack.nest === null ? 0 : 1) + (stack.house ? 1 : 0) : 0; }
export function perchRanks(tile: PerchTile): Array<{
    flock: number;
    count: number;
    rank: number | null;
    points: number;
}> {
    const counts = tile.stacks.map(s => ({ flock: s.flock, count: perchStrength(s) })), info = PERCH_LOCATION_INFO[tile.definitionId];
    return counts.map(c => {
        const rank = counts.filter(x => x.count === c.count).length > 1 ? null : 1 + counts.filter(x => x.count > c.count).length;
        const points = rank === null ? 0 : rank === 1 && tile.definitionId === 'STATUE' ? 1 + Math.floor(counts.reduce((n, x) => n + x.count, 0) / 2) : info.scores[rank - 1] ?? 0;
        return { ...c, rank, points };
    });
}
export function perchController(tile: PerchTile): number | null { return perchRanks(tile).find(x => x.rank === 1)?.flock ?? null; }
export function perchAdjacent(a: PerchTile, b: PerchTile): boolean { return !a.removed && !b.removed && ((a.col === b.col && Math.abs(a.row - b.row) === 2) || (Math.abs(a.col - b.col) === 1 && Math.abs(a.row - b.row) === 1)); }
export function perchProjectionIsConsistent(g: PerchProjection): boolean {
    const ids = g.playerStates.map(p => p.playerId), flocks = g.playerStates.map(p => p.flock);
    if (new Set(ids).size !== ids.length || new Set(flocks).size !== flocks.length || !ids.includes(g.privateState.playerId) || !ids.includes(g.activePlayerId) || g.turnOrder.length !== ids.length || new Set(g.turnOrder).size !== ids.length || g.turnOrder.some(id => !ids.includes(id)))
        return false;
    if (g.board.length !== (ids.length <= 3 ? 8 : ids.length === 4 ? 10 : 13) || new Set(g.board.map(t => t.tileId)).size !== g.board.length || new Set(g.board.map(t => t.definitionId)).size !== g.board.length)
        return false;
    const cells = perchFountainCells(ids.length);
    if (g.fountain.length !== cells.length || cells.some(c => g.fountain[c.id] && c.supports.some(id => !g.fountain[id])))
        return false;
    if (g.playerStates.some((p, i) => p.flock !== i || p.supplyCount > 28) || (ids.length === 2 ? g.neutralSupplyCount === null : g.neutralSupplyCount !== null))
        return false;
    if (g.board.some(t => t.nests.length !== PERCH_LOCATION_INFO[t.definitionId].nests))
        return false;
    if (g.creatures.some(c => c.controller !== null && !ids.includes(c.controller) || c.tileId !== null && !g.board.some(t => t.tileId === c.tileId && !t.removed)))
        return false;
    if (g.pending && (!ids.includes(g.pending.actor) || g.pending.actor !== g.privateState.playerId && g.pending.choices.length > 0))
        return false;
    if (g.phase !== 'OBJECTIVES' && g.privateState.objectiveChoices.length)
        return false;
    if (g.board.some(t => t.removed && t.stacks.length || new Set(t.stacks.map(s => s.flock)).size !== t.stacks.length || t.stacks.some(s => s.birds.some(b => b.flock !== s.flock) || s.nest !== null && (!t.nests[s.nest] || t.stacks.filter(x => x.nest === s.nest).length !== 1))))
        return false;
    const birds = [...g.playerStates.flatMap(p => p.hand), ...g.board.flatMap(t => t.stacks.flatMap(s => s.birds)), ...g.fountain.filter(b => b !== null), ...g.plaza];
    return birds.every(b => b.flock < Math.max(3, ids.length)) && new Set(birds.map(b => b.birdId)).size === birds.length;
}
