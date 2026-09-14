import * as v from 'valibot';
import { ArkActionKindSchema, ArkCellSchema, ArkCountSchema, ArkRefSchema } from './actions.js';
export const ArkPlacementSchema = v.strictObject({building:ArkRefSchema,anchor:ArkCellSchema,rotation:v.picklist([0,1,2,3,4,5]),reflected:v.boolean()});
export const ArkBuildBonusSchema = v.strictObject({id:ArkRefSchema,kind:v.picklist(['MONEY_5','MONEY_10','X_1','CARD_1','REPUTATION_2','WORKER','UPGRADE'])});
export const ArkActiveBuildSchema = v.nullable(v.strictObject({remaining:ArkCountSchema,upgraded:v.boolean(),engineerUsed:v.optional(v.boolean()),builtKinds:v.pipe(v.array(ArkRefSchema),v.minLength(1),v.maxLength(10))}));
export const ArkBuildSelectionSchema = v.variant('kind',[
  v.strictObject({kind:v.literal('NONE')}),
  v.strictObject({kind:v.literal('CARD'),cardId:v.nullable(ArkRefSchema)}),
  v.strictObject({kind:v.literal('UPGRADE'),action:ArkActionKindSchema}),
]);
export type ArkBuildBonus = v.InferOutput<typeof ArkBuildBonusSchema>;
