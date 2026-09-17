import * as v from 'valibot';
import {GameIdSchema, TileIdSchema} from '../../identifiers.js';
import {SpeakeasyDistrictIdSchema} from './contracts.js';

const guard = {gameId:GameIdSchema, revision:v.pipe(v.number(),v.safeInteger(),v.minValue(0))};
/** Setup choices only. Prices, benefits, actor and canonical state come from the server. */
export const SpeakeasySetupCommandSchema = v.variant('type', [
  v.strictObject({type:v.literal('SETUP_DOCK'), command:v.strictObject({...guard,
    zone:v.picklist([0,1,2]), space:v.pipe(v.number(),v.safeInteger(),v.minValue(0),v.maxValue(11))})}),
  v.strictObject({type:v.literal('SETUP_BUILD'), command:v.strictObject({...guard,
    pieceId:TileIdSchema, district:SpeakeasyDistrictIdSchema, slot:v.picklist([0,1,2])})}),
  v.strictObject({type:v.literal('SETUP_OPERATION'), command:v.strictObject({...guard,cardId:TileIdSchema})}),
]);
export type SpeakeasySetupCommand = v.InferOutput<typeof SpeakeasySetupCommandSchema>;
