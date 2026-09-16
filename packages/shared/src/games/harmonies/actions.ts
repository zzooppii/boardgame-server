import * as v from 'valibot';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';
import { HARMONIES_COLORS } from './catalog.js';
export const HarmoniesCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const HarmoniesCellIdSchema = v.pipe(HarmoniesCountSchema, v.maxValue(22));
export const HarmoniesCardIdSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(32));
export const HarmoniesTokenSchema = v.strictObject({ tileId: TileIdSchema, color: v.picklist(HARMONIES_COLORS) });
export type HarmoniesToken = v.InferOutput<typeof HarmoniesTokenSchema>;
export const HarmoniesCellSchema = v.strictObject({ stack: v.pipe(v.array(HarmoniesTokenSchema), v.maxLength(3)), animal: v.nullable(HarmoniesCardIdSchema) });
export type HarmoniesCell = v.InferOutput<typeof HarmoniesCellSchema>;
export const HarmoniesOwnedCardSchema = v.strictObject({ cardId: HarmoniesCardIdSchema, placed: v.pipe(HarmoniesCountSchema, v.maxValue(5)) });
export type HarmoniesOwnedCard = v.InferOutput<typeof HarmoniesOwnedCardSchema>;
export const HarmoniesPlayerSchema = v.strictObject({ playerId: PlayerIdSchema, board: v.pipe(v.array(HarmoniesCellSchema), v.length(23)), cards: v.pipe(v.array(HarmoniesOwnedCardSchema), v.maxLength(32)), turns: HarmoniesCountSchema });
export type HarmoniesPlayer = v.InferOutput<typeof HarmoniesPlayerSchema>;
export const HarmoniesStepSchema = v.variant('type', [
  v.strictObject({ type: v.literal('TAKE_TOKENS'), source: v.pipe(HarmoniesCountSchema, v.maxValue(4)) }),
  v.strictObject({ type: v.literal('PLACE'), tileId: TileIdSchema, cell: HarmoniesCellIdSchema }),
  v.strictObject({ type: v.literal('TAKE_ANIMAL'), cardId: HarmoniesCardIdSchema }),
  v.strictObject({ type: v.literal('SETTLE'), cardId: HarmoniesCardIdSchema, origin: HarmoniesCellIdSchema, rotation: v.pipe(HarmoniesCountSchema, v.maxValue(5)) }),
]);
export type HarmoniesStep = v.InferOutput<typeof HarmoniesStepSchema>;
export const HarmoniesActionSchema = v.strictObject({ type: v.literal('SUBMIT_TURN'), steps: v.pipe(v.array(HarmoniesStepSchema), v.minLength(4), v.maxLength(32)) });
export type HarmoniesAction = v.InferOutput<typeof HarmoniesActionSchema>;

export const HarmoniesSettingsSchema = v.strictObject({turnSeconds:v.picklist([30,60])});
export type HarmoniesSettings = v.InferOutput<typeof HarmoniesSettingsSchema>;
export const HARMONIES_DEFAULT_SETTINGS: HarmoniesSettings = {turnSeconds:60};
export const HarmoniesDraftSchema = v.pipe(v.array(HarmoniesStepSchema),v.maxLength(32));
