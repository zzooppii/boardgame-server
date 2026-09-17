import * as v from 'valibot';
import {GameIdSchema,TileIdSchema} from '../../identifiers.js';
import {SpeakeasyDistrictIdSchema,SpeakeasyCountSchema,SpeakeasyOperationSchema} from './contracts.js';
const key=v.pipe(v.string(),v.minLength(1),v.maxLength(100));
const guard={gameId:GameIdSchema,revision:v.pipe(v.number(),v.safeInteger(),v.minValue(0))};
export const SpeakeasyLocationActionKindSchema=v.picklist(['BOOK','GOONS','PROTECT','OPERATION','BUILD','PRODUCE','DELIVER','SELL','LEVEL']);
export const SpeakeasyLocationChoiceSchema=v.variant('kind',[
  v.strictObject({kind:v.literal('BOOK')}),
  v.strictObject({kind:v.literal('LEVEL'),operation:SpeakeasyOperationSchema,discardIds:v.pipe(v.array(TileIdSchema),v.maxLength(2))}),
  v.strictObject({kind:v.literal('PRODUCE')}),
  v.strictObject({kind:v.literal('SELL'),buildingIds:v.pipe(v.array(TileIdSchema),v.minLength(1),v.maxLength(12))}),
  v.strictObject({kind:v.literal('DELIVER'),steps:v.pipe(v.array(v.variant('kind',[
    v.strictObject({kind:v.literal('MOVE'),truckId:TileIdSchema,district:SpeakeasyDistrictIdSchema}),
    v.strictObject({kind:v.literal('LOAD'),truckId:TileIdSchema,count:v.pipe(SpeakeasyCountSchema,v.minValue(1),v.maxValue(2))}),
    v.strictObject({kind:v.literal('UNLOAD'),truckId:TileIdSchema,buildingId:TileIdSchema}),
  ])),v.minLength(1),v.maxLength(80))}),
  v.strictObject({kind:v.literal('GOONS'),count:v.pipe(SpeakeasyCountSchema,v.minValue(1),v.maxValue(6)),cashToSpend:v.optional(SpeakeasyCountSchema)}),
  v.strictObject({kind:v.literal('PROTECT'),buildingIds:v.pipe(v.array(TileIdSchema),v.minLength(1),v.maxLength(12))}),
  v.strictObject({kind:v.literal('OPERATION'),cardId:TileIdSchema}),
  v.strictObject({kind:v.literal('BUILD'),builds:v.pipe(v.array(v.strictObject({
    pieceId:TileIdSchema,district:SpeakeasyDistrictIdSchema,slot:v.picklist([0,1,2]),
    goons:v.pipe(SpeakeasyCountSchema,v.maxValue(6)),useAssociate:v.boolean(),freeAssociate:v.boolean(),
    discardIds:v.pipe(v.array(TileIdSchema),v.maxLength(1)),cashToSpend:v.optional(SpeakeasyCountSchema),
  })),v.minLength(1),v.maxLength(2))}),
]);
export const SpeakeasyLocationActionCommandSchema=v.strictObject({...guard,actionId:key,choice:SpeakeasyLocationChoiceSchema});
export const SpeakeasyLocationSkipCommandSchema=v.strictObject({...guard,actionId:key});
export const SpeakeasyLocationFinishCommandSchema=v.strictObject(guard);
export const SpeakeasyLocationActionsViewSchema=v.strictObject({rows:v.array(v.array(v.strictObject({id:key,kind:SpeakeasyLocationActionKindSchema,
  status:v.picklist(['AVAILABLE','WAITING','DONE'])}))),canFinish:v.boolean()});
export type SpeakeasyLocationChoice=v.InferOutput<typeof SpeakeasyLocationChoiceSchema>;
