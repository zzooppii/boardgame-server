import { ArkProjectSupportChoiceSchema } from './project-contracts.js';
import * as v from 'valibot';
import { ARK_CONTINENTS, ArkActionKindSchema, ArkCountSchema, ArkRefSchema } from './actions.js';
export const ARK_SOLO_UNIVERSITIES = ['HAND_LIMIT','RESEARCH_2','RESEARCH_REPUTATION'] as const;
export const ArkUniversitySchema=v.picklist(ARK_SOLO_UNIVERSITIES);
export const ArkAssociationGeneralTaskSchema=v.variant('kind',[
  v.strictObject({kind:v.literal('REPUTATION')}),
  v.strictObject({kind:v.literal('PARTNER'),continent:v.picklist(ARK_CONTINENTS)}),
  v.strictObject({kind:v.literal('UNIVERSITY'),university:ArkUniversitySchema}),
]);
export const ArkAssociationTaskSchema=v.variant('kind',[...ArkAssociationGeneralTaskSchema.options,v.strictObject({kind:v.literal('PROJECT'),...ArkProjectSupportChoiceSchema.entries})]);
export type ArkAssociationGeneralTask=v.InferOutput<typeof ArkAssociationGeneralTaskSchema>;
export type ArkAssociationTask=v.InferOutput<typeof ArkAssociationTaskSchema>;
export const ArkRewardSchema=v.strictObject({id:ArkRefSchema,kind:v.picklist(['REPUTATION','CONSERVATION','WORKER','UPGRADE','UPGRADE_OR_WORKER','CARD','X']),amount:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(4))});
export type ArkReward=v.InferOutput<typeof ArkRewardSchema>;
export const ArkRewardSelectionSchema=v.variant('kind',[
  v.strictObject({kind:v.literal('NONE')}),
  v.strictObject({kind:v.literal('WORKER')}),
  v.strictObject({kind:v.literal('CARD'),cardId:v.nullable(ArkRefSchema)}),
  v.strictObject({kind:v.literal('UPGRADE'),action:ArkActionKindSchema}),
]);

const taskKind=v.picklist(['REPUTATION','PARTNER','UNIVERSITY','PROJECT']);
export const ArkAssociationWorkSchema=v.pipe(v.strictObject({
  strength:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(10)),
  remaining:v.pipe(ArkCountSchema,v.maxValue(10)), upgraded:v.boolean(),
  tasks:v.pipe(v.array(taskKind),v.minLength(1),v.maxLength(4)), donated:v.boolean(),projectCost:v.optional(v.picklist([4,5]),5),
}),v.check(s=>new Set(s.tasks).size===s.tasks.length &&
  s.remaining===s.strength-s.tasks.reduce((sum,t)=>sum+(t==='REPUTATION'?2:t==='PARTNER'?3:t==='UNIVERSITY'?4:s.projectCost),0) &&
  (s.upgraded || s.tasks.length===1&&!s.donated)));
export type ArkAssociationWork=v.InferOutput<typeof ArkAssociationWorkSchema>;
