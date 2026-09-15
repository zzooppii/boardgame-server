import * as v from 'valibot';
import {PlayerIdSchema,TileIdSchema} from '../../identifiers.js';
export const PatchworkCountSchema=v.pipe(v.number(),v.safeInteger(),v.minValue(0));
export const PatchworkCoordinateSchema=v.pipe(PatchworkCountSchema,v.maxValue(8));
export const PatchworkRotationSchema=v.picklist([0,1,2,3]);
export const PatchworkTileSchema=v.strictObject({tileId:TileIdSchema,patchId:v.pipe(PatchworkCountSchema,v.maxValue(33))});
export const PatchworkPlacementSchema=v.strictObject({...PatchworkTileSchema.entries,x:PatchworkCoordinateSchema,y:PatchworkCoordinateSchema,rotation:PatchworkRotationSchema,flipped:v.boolean()});
export const PatchworkPlayerSchema=v.strictObject({playerId:PlayerIdSchema,placements:v.pipe(v.array(PatchworkPlacementSchema),v.maxLength(38)),buttons:PatchworkCountSchema,income:v.pipe(PatchworkCountSchema,v.maxValue(100)),position:v.pipe(PatchworkCountSchema,v.maxValue(53))});
const Position={x:PatchworkCoordinateSchema,y:PatchworkCoordinateSchema,rotation:PatchworkRotationSchema,flipped:v.boolean()};
export const PatchworkActionSchema=v.variant('type',[
 v.strictObject({type:v.literal('BUY'),tileId:TileIdSchema,...Position}),
 v.strictObject({type:v.literal('ADVANCE')}),
 v.strictObject({type:v.literal('PLACE_LEATHER'),tileId:TileIdSchema,x:PatchworkCoordinateSchema,y:PatchworkCoordinateSchema}),
]);
export type PatchworkAction=v.InferOutput<typeof PatchworkActionSchema>;
export type PatchworkPlacement=v.InferOutput<typeof PatchworkPlacementSchema>;
export type PatchworkPlayer=v.InferOutput<typeof PatchworkPlayerSchema>;
export type PatchworkTile=v.InferOutput<typeof PatchworkTileSchema>;
export type PatchworkRotation=v.InferOutput<typeof PatchworkRotationSchema>;
