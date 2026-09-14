import * as v from 'valibot';
import { ARK_CONTINENTS, ArkActionKindSchema, ArkRefSchema, ArkCountSchema, ArkCellSchema } from './actions.js';
import { ArkUniversitySchema } from './association.js';
import { ArkPlacementSchema } from './build.js';
export const ArkExtraActionKindSchema=v.union([ArkActionKindSchema,v.literal('TAKE_X')]);
const ArkBonusTileSchema=v.picklist(['REPUTATION_2','X_3','ENCLOSURE_3','CARDS_3','MONEY_10','MULTIPLIER','UNIVERSITY','PARTNER','PAID_SPONSOR']);
export const ArkZooCardChoiceSchema=v.strictObject({cardId:ArkRefSchema,housingId:v.nullable(ArkRefSchema),uniquePlacement:v.optional(v.strictObject({anchor:ArkCellSchema,rotation:v.picklist([0,1,2,3,4,5])}))});
export const ArkEffectSelectionSchema=v.variant('kind',[
  v.strictObject({kind:v.literal('ANIMAL'),card:ArkZooCardChoiceSchema}),
  v.strictObject({kind:v.literal('MAP_BONUS'),cell:ArkCellSchema}),
  v.strictObject({kind:v.literal('ACTION'),action:ArkExtraActionKindSchema}),
  v.strictObject({kind:v.literal('MULTIPLIER'),action:ArkActionKindSchema}),
  v.strictObject({kind:v.literal('SPONSOR'),card:ArkZooCardChoiceSchema}),
  v.strictObject({kind:v.literal('PARTNER'),continent:v.picklist(ARK_CONTINENTS)}),
  v.strictObject({kind:v.literal('UNIVERSITY'),university:ArkUniversitySchema}),
  v.strictObject({kind:v.literal('NONE')}),
  v.strictObject({kind:v.literal('BUILD'),placement:ArkPlacementSchema}),
  v.strictObject({kind:v.literal('MOVE_ANIMAL'),cardId:ArkRefSchema,housingId:v.nullable(ArkRefSchema)}),
  v.strictObject({kind:v.literal('SKIP')}),
  v.strictObject({kind:v.literal('DIG'),zone:v.picklist(['HAND','DISPLAY']),cardId:ArkRefSchema}),
  v.strictObject({kind:v.literal('KEEP'),choiceId:ArkRefSchema,keep:v.array(ArkRefSchema)}),
  v.strictObject({kind:v.literal('CARDS'),cards:v.array(ArkRefSchema)}),
  v.strictObject({kind:v.literal('CARD'),cardId:v.nullable(ArkRefSchema),refill:v.optional(v.boolean(),false)}),
  v.strictObject({kind:v.literal('UPGRADE'),action:ArkActionKindSchema}),
  v.strictObject({kind:v.literal('MOVE'),action:ArkActionKindSchema,slot:v.picklist([1,5])}),
  v.strictObject({kind:v.literal('WORKER')}),
  v.strictObject({kind:v.literal('GOAL'),discard:ArkRefSchema}),
  v.strictObject({kind:v.literal('KEEP_GOAL'),choiceId:ArkRefSchema,keep:ArkRefSchema}),
  v.strictObject({kind:v.literal('PROJECT'),cardId:v.nullable(ArkRefSchema)}),
  v.strictObject({kind:v.literal('BONUS'),tile:v.nullable(ArkBonusTileSchema)}),
  v.strictObject({kind:v.literal('FOCUS'),focus:v.picklist(['SMALL','LARGE'])}),
]);
export const ArkZooWorkSchema=v.strictObject({action:v.picklist(['ANIMALS','SPONSORS']),upgraded:v.boolean(),remaining:ArkCountSchema,playedCount:ArkCountSchema,onlySmall:v.optional(v.boolean()),wazaUsed:v.optional(v.boolean()),stage:v.picklist(['PLAYING','AFTER_FINISHING'])});

export const ArkRepeatedActionSchema=v.strictObject({action:ArkActionKindSchema,mode:v.picklist(['REGULAR','TAKE_X']),
  baseStrength:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(5)),remaining:v.pipe(ArkCountSchema,v.minValue(1)),completed:ArkCountSchema,awaiting:v.boolean()});

/** Display-only options for the active job; never accepted as an executable effect. */
export const ArkEffectGuideSchema=v.strictObject({
  resource:v.nullable(v.picklist(['APPEAL','CONSERVATION','REPUTATION','MONEY','X','WORKER'])),
  amount:v.nullable(ArkCountSchema),actions:v.array(ArkExtraActionKindSchema),
  buildings:v.array(ArkRefSchema),slots:v.array(v.picklist([1,5])),
  mayRefill:v.boolean(),bonuses:v.array(ArkBonusTileSchema),
});
export type ArkEffectGuide=v.InferOutput<typeof ArkEffectGuideSchema>;
