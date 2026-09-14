import * as v from 'valibot';
import { TileIdSchema } from '../../identifiers.js';
import { PerchCreatureSchema, PerchObjectiveSchema } from './catalog.js';
export const PerchFlockSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4));
export const PerchBirdSchema = v.strictObject({ birdId: TileIdSchema, flock: PerchFlockSchema });
export type PerchBird = v.InferOutput<typeof PerchBirdSchema>;
export const PerchActionSchema = v.variant('type', [
    v.strictObject({ type: v.literal('CONFIGURE'), randomBoard: v.boolean(), objectives: v.boolean() }),
    v.strictObject({ type: v.literal('BEGIN') }),
    v.strictObject({ type: v.literal('OBJECTIVE'), objective: PerchObjectiveSchema }),
    v.strictObject({ type: v.literal('PLACE'), birdId: TileIdSchema, tileId: TileIdSchema, nest: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2))) }),
    v.strictObject({ type: v.literal('HOUSE'), tileId: TileIdSchema, flock: PerchFlockSchema }),
    v.strictObject({ type: v.literal('ZAP'), tileId: TileIdSchema, birdId: v.nullable(TileIdSchema), nest: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2))) }),
    v.strictObject({ type: v.literal('CREATURE'), creature: PerchCreatureSchema }),
    v.strictObject({ type: v.literal('CHOOSE'), choiceId: v.pipe(v.string(), v.maxLength(40)) }),
    v.strictObject({ type: v.literal('END_TURN') }),
    v.strictObject({ type: v.literal('CONTINUE') }),
]);
export type PerchAction = v.InferOutput<typeof PerchActionSchema>;
