import * as v from 'valibot';
import {GameIdSchema, TileIdSchema} from '../../identifiers.js';

export const SpeakeasyLocationSchema = v.picklist([
  'DOCKS', 'CITY_HALL', 'RESTAURANT', 'COMMISSION', 'CONTRACTOR', 'CITY_PLANNING', 'GARAGE', 'PARK',
]);
export const SpeakeasyPlaceCapoCommandSchema = v.strictObject({
  gameId: GameIdSchema,
  revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  capoId: TileIdSchema,
  spaceId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  restaurant: v.optional(v.strictObject({
    position: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(3)),
    discardIds: v.pipe(v.array(TileIdSchema), v.minLength(1), v.maxLength(2)),
  })),
});
