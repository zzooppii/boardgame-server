import * as v from 'valibot';
import {GameIdSchema, TileIdSchema} from '../../identifiers.js';

export const SpeakeasyRestaurantCommandSchema = v.strictObject({
  gameId: GameIdSchema,
  revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  position: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(3)),
  discardIds: v.pipe(v.array(TileIdSchema), v.minLength(1), v.maxLength(2)),
});
export type SpeakeasyRestaurantCommand = v.InferOutput<typeof SpeakeasyRestaurantCommandSchema>;

/** Zero-based lower-row position. The unavailable fourth space is never offered to three players. */
export function speakeasyRestaurantDiscardCount(players: number, position: number): 1 | 2 | null {
  if (![2, 3, 4].includes(players) || !Number.isInteger(position) || position < 0 || position >= players) return null;
  return position >= (players === 2 ? 1 : 2) ? 2 : 1;
}

export const SpeakeasyDeckSchema = v.picklist(['VIP', 'PARTY', 'STILLS', 'FLEET']);
export const SpeakeasyDrawCommandSchema = v.strictObject({
  gameId: GameIdSchema, revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  deck: SpeakeasyDeckSchema,
});

export const SpeakeasyRestaurantActionSchema = v.picklist(['OPERATION', 'CITY_TILES', 'BOOKS']);
export const SpeakeasyRestaurantActionCommandSchema = v.strictObject({
  gameId: GameIdSchema, revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  action: SpeakeasyRestaurantActionSchema,
});
export const SpeakeasyRestaurantFinishCommandSchema = v.strictObject({
  gameId: GameIdSchema, revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
});
export const SpeakeasyRestaurantBookCommandSchema = v.strictObject({
  ...SpeakeasyRestaurantFinishCommandSchema.entries,
  goalId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)), space: v.picklist([0, 1]),
});
export const SpeakeasyRestaurantCardCommandSchema = v.strictObject({
  ...SpeakeasyRestaurantFinishCommandSchema.entries, cardId: TileIdSchema,
});
