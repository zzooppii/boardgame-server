import * as v from 'valibot';
import {SpeakeasyLocationActionCommandSchema,SpeakeasyLocationSkipCommandSchema,SpeakeasyLocationFinishCommandSchema} from './location-actions.js';
import {RequestIdSchema, GameIdSchema} from '../../identifiers.js';
import {SpeakeasyPlaceCapoCommandSchema, SpeakeasyBoardViewSchema} from './locations.js';
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
  v.strictObject({type:v.literal('EXECUTE_LOCATION_ACTION'),command:SpeakeasyLocationActionCommandSchema}),
  v.strictObject({type:v.literal('SKIP_LOCATION_ACTION'),command:SpeakeasyLocationSkipCommandSchema}),
  v.strictObject({type:v.literal('FINISH_LOCATION_ACTIONS'),command:SpeakeasyLocationFinishCommandSchema}),
  v.strictObject({type: v.literal('PLACE_CAPO'), command: SpeakeasyPlaceCapoCommandSchema}),
  v.strictObject({type: v.literal('CHOOSE_RESTAURANT_ACTION'), command: SpeakeasyRestaurantActionCommandSchema}),
  v.strictObject({type: v.literal('FINISH_RESTAURANT_ACTION'), command: SpeakeasyRestaurantFinishCommandSchema}),
  v.strictObject({type: v.literal('USE_HELPER'), command: SpeakeasyRestaurantCardCommandSchema}),
  v.strictObject({type: v.literal('PLAY_OPERATION'), command: SpeakeasyRestaurantCardCommandSchema}),
  v.strictObject({type: v.literal('USE_CITY_TILE'), command: SpeakeasyCityTileCommandSchema}),
  v.strictObject({type: v.literal('PLACE_BOOK'), command: SpeakeasyRestaurantBookCommandSchema}),
  v.strictObject({type: v.literal('FINISH_RESTAURANT'), command: SpeakeasyRestaurantFinishCommandSchema}),
  v.strictObject({type: v.literal('DRAW_OPERATION'), command: SpeakeasyDrawCommandSchema}),
  v.strictObject({type: v.literal('RETURN_CITY_TILES'), command: SpeakeasyCityReturnCommandSchema}),
  v.strictObject({type: v.literal('DEFEND'), command: SpeakeasyDefenseCommandSchema}),
]);
export type SpeakeasyPlayerCommand = v.InferOutput<typeof SpeakeasyPlayerCommandSchema>;

/** The authenticated room and player identity come from the transport context, not this body. */
export const SpeakeasyCommandRequestSchema = v.strictObject({
  requestId: RequestIdSchema,
  action: SpeakeasyPlayerCommandSchema,
});
export const SpeakeasyCommandFailureSchema = v.strictObject({
  ok: v.literal(false),
  reason: v.picklist(['INVALID_PAYLOAD','UNAUTHENTICATED','INVALID_PHASE','STALE_GAME_REVISION',
    'REQUEST_ID_REUSED','RULE_VIOLATION','INTERNAL_ERROR']),
});
/** On replay, acceptedRevision identifies the original commit; view is the current private snapshot. */
export const SpeakeasyCommandReplySchema = v.union([
  v.strictObject({ok: v.literal(true), requestId: RequestIdSchema, gameId: GameIdSchema,
    acceptedRevision: v.pipe(v.number(),v.safeInteger(),v.minValue(0)), replayed: v.boolean(), view: SpeakeasyBoardViewSchema}),
  SpeakeasyCommandFailureSchema,
]);
export type SpeakeasyCommandReply = v.InferOutput<typeof SpeakeasyCommandReplySchema>;
export type SpeakeasyCommandFailure = v.InferOutput<typeof SpeakeasyCommandFailureSchema>;
