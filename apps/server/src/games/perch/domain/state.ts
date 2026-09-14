import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, TurnIdSchema, TileIdSchema, PlayerIdSchema, PerchBirdSchema, PerchFlockSchema, PerchCount, PerchCreatureSchema, PerchSettingsSchema, PerchStageSchema, PerchTileSchema, PerchCreatureStateSchema, PerchObjectiveSchema, PerchLogSchema, PerchScoreLineSchema, PerchResultSchema, perchFountainCells } from '@hangul-rummikub/shared';
export const TaskKindSchema = v.picklist(['MIGRATE', 'ROOKERY_ADD', 'SEND_OWN', 'RECRUIT', 'BATH_RETURN', 'FEEDER_FIRST', 'FEEDER_SECOND', 'PERCH_BEGIN', 'UPKEEP', 'UPKEEP_TILE', 'ROUND_FINISH', 'FOUNTAIN', 'CREATURE_MOVE', 'EFFECT_CONFIRM', 'SEND', 'MOVE_FROM', 'MOVE_TO', 'SWAP_FROM', 'SWAP_TO', 'SQUIRREL', 'BEE', 'SCARECROW_HOME']);
export const PerchTaskSchema = v.strictObject({ kind: TaskKindSchema, actor: PlayerIdSchema, tiles: v.array(TileIdSchema), birdId: v.nullable(TileIdSchema), creature: v.nullable(PerchCreatureSchema), flock: v.nullable(PerchFlockSchema) });
export type PerchTask = v.InferOutput<typeof PerchTaskSchema>;
export const PerchStateSchema = v.strictObject({
    rulesVersion: v.literal('perch-base-v1'), gameId: GameIdSchema, revision: GameRevisionSchema, transitionId: TurnIdSchema, startedAt: ServerTimeSchema, finishedAt: v.nullable(ServerTimeSchema), phase: v.union([PerchStageSchema, v.literal('FINISHED')]), settings: PerchSettingsSchema,
    players: v.pipe(v.array(v.strictObject({ playerId: PlayerIdSchema, flock: PerchFlockSchema, score: PerchCount, hand: v.array(PerchBirdSchema), objective: v.nullable(PerchObjectiveSchema), objectiveChoices: v.array(PerchObjectiveSchema), house: v.boolean(), lightning: v.boolean() })), v.minLength(2), v.maxLength(5)),
    supply: v.array(v.array(PerchBirdSchema)), bag: v.array(PerchBirdSchema), pool: v.array(PerchBirdSchema), board: v.array(PerchTileSchema), creatures: v.array(PerchCreatureStateSchema), fountain: v.array(v.nullable(PerchBirdSchema)), plaza: v.array(PerchBirdSchema),
    round: v.pipe(PerchCount, v.minValue(1), v.maxValue(5)), turnOrder: v.array(PlayerIdSchema), activeIndex: PerchCount, placed: v.boolean(), bonusUsed: v.boolean(), queue: v.array(PerchTaskSchema), roundScores: v.array(PerchScoreLineSchema), history: v.pipe(v.array(PerchLogSchema), v.maxLength(100)), sequence: PerchCount, scoreTrack: v.array(PlayerIdSchema), result: v.nullable(PerchResultSchema),
});
export type PerchState = v.InferOutput<typeof PerchStateSchema>;
export function parsePerchState(input: unknown): PerchState {
    const s = v.parse(PerchStateSchema, input), ids = s.players.map(p => p.playerId), flocks = s.players.length === 2 ? 3 : s.players.length;
    if (new Set(ids).size !== ids.length || s.players.some((p, i) => p.flock !== i) || s.activeIndex >= ids.length)
        throw new Error('Invalid Perch roster.');
    for (const order of [s.turnOrder, s.scoreTrack])
        if (order.length !== ids.length || new Set(order).size !== ids.length || order.some(id => !ids.includes(id)))
            throw new Error('Invalid Perch order.');
    if (s.supply.length !== flocks)
        throw new Error('Invalid Perch supply.');
    const birds = [...s.supply.flat(), ...s.bag, ...s.pool, ...s.players.flatMap(p => p.hand), ...s.board.flatMap(t => t.stacks.flatMap(st => st.birds)), ...s.fountain.filter(b => b !== null), ...s.plaza];
    if (birds.length !== flocks * 28 || new Set(birds.map(b => b.birdId)).size !== birds.length)
        throw new Error('Perch bird conservation.');
    for (let flock = 0; flock < flocks; flock++)
        if (birds.filter(b => b.flock === flock).length !== 28 || s.supply[flock]!.some(b => b.flock !== flock))
            throw new Error('Perch flock conservation.');
    if (s.board.length !== (ids.length <= 3 ? 8 : ids.length === 4 ? 10 : 13) || new Set(s.board.map(t => t.tileId)).size !== s.board.length || new Set(s.board.map(t => t.definitionId)).size !== s.board.length)
        throw new Error('Invalid Perch board.');
    for (const t of s.board) {
        if (t.removed && (t.stacks.length || t.nests.some(Boolean)))
            throw new Error('Removed Perch tile occupied.');
        if (new Set(t.stacks.map(st => st.flock)).size !== t.stacks.length)
            throw new Error('Duplicate Perch flock stack.');
        for (const st of t.stacks)
            if (st.flock >= flocks || st.birds.some(b => b.flock !== st.flock) || st.nest !== null && (!t.nests[st.nest] || t.stacks.filter(x => x.nest === st.nest).length !== 1))
                throw new Error('Invalid Perch stack.');
    }
    const cells = perchFountainCells(ids.length);
    if (s.fountain.length !== cells.length || cells.some(c => s.fountain[c.id] && c.supports.some(id => !s.fountain[id])))
        throw new Error('Unsupported Perch fountain.');
    if (s.queue.some(t => !ids.includes(t.actor) || t.tiles.some(id => !s.board.some(b => b.tileId === id))))
        throw new Error('Invalid Perch continuation.');
    if ((s.phase === 'FINISHED') !== (s.result !== null) || (s.phase === 'FINISHED') !== (s.finishedAt !== null))
        throw new Error('Invalid Perch finish.');
    if (s.creatures.some(c => c.controller !== null && !ids.includes(c.controller) || c.tileId !== null && !s.board.some(t => t.tileId === c.tileId)))
        throw new Error('Invalid Perch creature.');
    const objectives = s.players.flatMap(p => [...p.objectiveChoices, ...p.objective ? [p.objective] : []]);
    if (new Set(objectives).size !== objectives.length)
        throw new Error('Duplicate Perch objective.');
    return s;
}
