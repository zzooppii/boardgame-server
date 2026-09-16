import * as v from 'valibot';
import {SpeakeasyPlaceCapoCommandSchema} from './locations.js';
import {SpeakeasyDefenseCommandSchema} from './luciano.js';
import {
  SpeakeasyRestaurantActionCommandSchema, SpeakeasyRestaurantFinishCommandSchema,
  SpeakeasyRestaurantCardCommandSchema, SpeakeasyRestaurantBookCommandSchema,
  SpeakeasyCityTileCommandSchema, SpeakeasyCityReturnCommandSchema, SpeakeasyDrawCommandSchema,
} from './restaurant.js';

/** Payload only. The transport must authenticate the actor and supply its room/receipt envelope.
 * Server settlement, arbitrary economy replacement and unresolved location completion are not commands.
 */
export const SpeakeasyPlayerCommandSchema = v.variant('type', [
  v.strictObject({type: v.literal('PLACE_CAPO'), command: SpeakeasyPlaceCapoCommandSchema}),
  v.strictObject({type: v.literal('CHOOSE_RESTAURANT_ACTION'), command: SpeakeasyRestaurantActionCommandSchema}),
  v.strictObject({type: v.literal('FINISH_RESTAURANT_ACTION'), command: SpeakeasyRestaurantFinishCommandSchema}),
  v.strictObject({type: v.literal('PLAY_OPERATION'), command: SpeakeasyRestaurantCardCommandSchema}),
  v.strictObject({type: v.literal('USE_CITY_TILE'), command: SpeakeasyCityTileCommandSchema}),
  v.strictObject({type: v.literal('PLACE_BOOK'), command: SpeakeasyRestaurantBookCommandSchema}),
  v.strictObject({type: v.literal('FINISH_RESTAURANT'), command: SpeakeasyRestaurantFinishCommandSchema}),
  v.strictObject({type: v.literal('DRAW_OPERATION'), command: SpeakeasyDrawCommandSchema}),
  v.strictObject({type: v.literal('RETURN_CITY_TILES'), command: SpeakeasyCityReturnCommandSchema}),
  v.strictObject({type: v.literal('DEFEND'), command: SpeakeasyDefenseCommandSchema}),
]);
export type SpeakeasyPlayerCommand = v.InferOutput<typeof SpeakeasyPlayerCommandSchema>;
