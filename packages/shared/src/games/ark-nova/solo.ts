import { ArkEffectSelectionSchema, ArkZooCardChoiceSchema } from './effect-contracts.js';
import * as v from 'valibot';
import { ArkAssociationTaskSchema, ArkRewardSelectionSchema } from './association.js';
import { ArkPlacementSchema, ArkBuildSelectionSchema } from './build.js';
import { ArkActionKindSchema, ArkRefSchema } from './actions.js';

export const ARK_SOLO_ROUND_TURNS = [7, 6, 5, 4, 3, 2] as const;
export const ArkSoloDifficultySchema = v.picklist(['STANDARD', 'ADVANCED', 'EXPERT']);
export type ArkSoloDifficulty = v.InferOutput<typeof ArkSoloDifficultySchema>;
export const ARK_SOLO_STARTING_APPEAL: Readonly<Record<ArkSoloDifficulty, number>> = {
  STANDARD: 20, ADVANCED: 10, EXPERT: 0,
};
export const ARK_SOLO_DIFFICULTY_LABELS: Readonly<Record<ArkSoloDifficulty, string>> = {
  STANDARD: '기본 · 매력 20', ADVANCED: '숙련 · 매력 10', EXPERT: '도전 · 매력 0',
};
export const ArkSoloProgressSchema = v.strictObject({
  round: v.picklist([1, 2, 3, 4, 5, 6]),
  turnsCompleted: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(27)),
  turnInRound: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(7)),
  stage: v.picklist(['SETUP', 'ACTION', 'BREAK', 'FINAL_SCORING', 'FINISHED']),
});
export type ArkSoloProgress = v.InferOutput<typeof ArkSoloProgressSchema>;
const ids = v.pipe(v.array(ArkRefSchema), v.maxLength(250));
const x = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(5));
/** Commands currently wired into the server domain; platform transport registration is separate. */
export const ArkSoloCommandSchema = v.variant('kind', [
  v.strictObject({kind:v.literal('CANCEL_EXTRA')}),
  v.strictObject({kind:v.literal('END_REPEAT')}),
  v.strictObject({kind:v.literal('SELECT_EFFECT'),choiceId:ArkRefSchema,effectId:v.pipe(v.number(),v.safeInteger(),v.minValue(1))}),
  v.strictObject({kind:v.literal('BEGIN_ZOO'),action:v.picklist(['ANIMALS','SPONSORS']),x,gainReputation:v.optional(v.boolean(),true)}),
  v.strictObject({kind:v.literal('PLAY_ZOO'),card:ArkZooCardChoiceSchema}),
  v.strictObject({kind:v.literal('END_ZOO')}),
  v.strictObject({kind:v.literal('CANCEL_ZOO')}),
  v.strictObject({kind:v.literal('EFFECT'),choiceId:ArkRefSchema,effectId:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),selection:ArkEffectSelectionSchema}),
  v.strictObject({kind: v.literal('INITIAL_HAND'), keep: v.pipe(ids, v.length(4))}),
  v.strictObject({kind:v.literal('ASSOCIATION'),x,task:ArkAssociationTaskSchema}),
  v.strictObject({kind:v.literal('ASSOCIATION_MORE'),task:ArkAssociationTaskSchema}),
  v.strictObject({kind:v.literal('DONATE')}),
  v.strictObject({kind:v.literal('END_ASSOCIATION')}),
  v.strictObject({kind:v.literal('REWARD'),choiceId:ArkRefSchema,rewardId:ArkRefSchema,selection:ArkRewardSelectionSchema}),
  v.strictObject({kind:v.literal('BUILD'),x,placement:ArkPlacementSchema}),
  v.strictObject({kind:v.literal('BUILD_MORE'),placement:ArkPlacementSchema}),
  v.strictObject({kind:v.literal('END_BUILD')}),
  v.strictObject({kind:v.literal('BUILD_BONUS'),choiceId:ArkRefSchema,bonusId:ArkRefSchema,selection:ArkBuildSelectionSchema}),
  v.strictObject({kind:v.literal('PICK_CARD'),choiceId:ArkRefSchema,cardId:v.nullable(ArkRefSchema)}),
  v.strictObject({kind: v.literal('TAKE_X'), action: ArkActionKindSchema}),
  v.strictObject({kind: v.literal('FUNDRAISE'), x}),
  v.strictObject({kind: v.literal('DRAW'), x}),
  v.strictObject({kind: v.literal('SNAP'), x, cardId: ArkRefSchema}),
  v.strictObject({kind: v.literal('DISCARD'), choiceId: ArkRefSchema, cards: ids}),
  v.strictObject({kind: v.literal('FINAL_GOAL'), choiceId: ArkRefSchema, discard: ArkRefSchema}),
]);
export type ArkSoloCommand = v.InferOutput<typeof ArkSoloCommandSchema>;
export function arkSoloProgressIsConsistent(progress: ArkSoloProgress): boolean {
  const before = ARK_SOLO_ROUND_TURNS.slice(0, progress.round - 1).reduce((sum, n) => sum + n, 0);
  const capacity = ARK_SOLO_ROUND_TURNS[progress.round - 1]!;
  if (progress.turnsCompleted !== before + progress.turnInRound || progress.turnInRound > capacity) return false;
  switch (progress.stage) {
    case 'SETUP': return progress.round === 1 && progress.turnsCompleted === 0;
    case 'ACTION': return progress.turnInRound < capacity;
    case 'BREAK': return progress.round < 6 && progress.turnInRound === capacity;
    case 'FINAL_SCORING': case 'FINISHED': return progress.round === 6 && progress.turnInRound === capacity;
  }
}
