import * as v from 'valibot';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';
import { PandemicCitySchema, PandemicColorSchema, PandemicRoleSchema } from './catalog.js';
export const PandemicCardSchema = v.variant('kind',[
 v.strictObject({kind:v.literal('CITY'),cardId:TileIdSchema,city:PandemicCitySchema}),
 v.strictObject({kind:v.literal('EVENT'),cardId:TileIdSchema,event:v.picklist(['AIRLIFT','GRANT','QUIET_NIGHT','FORECAST','RESILIENT'])}),
 v.strictObject({kind:v.literal('EPIDEMIC'),cardId:TileIdSchema}),
]);
export type PandemicCard = v.InferOutput<typeof PandemicCardSchema>;
export const PandemicMoveSchema = v.strictObject({type:v.literal('MOVE'),playerId:PlayerIdSchema,destination:PandemicCitySchema,mode:v.picklist(['DRIVE','DIRECT','CHARTER','SHUTTLE','OPERATIONS','DISPATCH']),cardId:v.nullable(TileIdSchema)});
export const PandemicShareSchema = v.strictObject({type:v.literal('SHARE'),from:PlayerIdSchema,to:PlayerIdSchema,cardId:TileIdSchema});
export const PandemicEventActionSchema = v.strictObject({type:v.literal('EVENT'),cardId:TileIdSchema,target:v.nullable(PlayerIdSchema),city:v.nullable(PandemicCitySchema),replace:v.nullable(PandemicCitySchema)});
export const PandemicConsentActionSchema = v.variant('type',[PandemicMoveSchema,PandemicShareSchema,PandemicEventActionSchema]);
export const PandemicActionSchema = v.variant('type',[
 v.strictObject({type:v.literal('CONFIGURE'),epidemics:v.picklist([4,5,6]),openHands:v.boolean()}),
 v.strictObject({type:v.literal('ROLE'),role:PandemicRoleSchema}), v.strictObject({type:v.literal('BEGIN')}),
 PandemicMoveSchema, PandemicShareSchema, PandemicEventActionSchema,
 v.strictObject({type:v.literal('TREAT'),color:PandemicColorSchema}),
 v.strictObject({type:v.literal('BUILD'),replace:v.nullable(PandemicCitySchema)}),
 v.strictObject({type:v.literal('CURE'),color:PandemicColorSchema,cards:v.pipe(v.array(TileIdSchema),v.minLength(4),v.maxLength(5))}),
 v.strictObject({type:v.literal('STORE'),cardId:TileIdSchema}),
 v.strictObject({type:v.literal('DISCARD'),cardId:TileIdSchema}),
 v.strictObject({type:v.literal('END_ACTIONS')}), v.strictObject({type:v.literal('CONTINUE')}),
 v.strictObject({type:v.literal('CONSENT'),accept:v.boolean()}),
 v.strictObject({type:v.literal('REQUEST_SHARE'),from:PlayerIdSchema}),
 v.strictObject({type:v.literal('OFFER_CARD'),cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('FORECAST_ORDER'),cities:v.pipe(v.array(PandemicCitySchema),v.minLength(1),v.maxLength(6))}),
 v.strictObject({type:v.literal('PING'),city:PandemicCitySchema,message:v.picklist(['HELP','MEET','TREAT'])}),
]);
export type PandemicAction = v.InferOutput<typeof PandemicActionSchema>;
