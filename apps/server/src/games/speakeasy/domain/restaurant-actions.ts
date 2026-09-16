import * as v from 'valibot';
import {SpeakeasyRestaurantActionSchema, type PlayerId, type TileId} from '@hangul-rummikub/shared';
import {speakeasyCandidate, ruleFailure, type SpeakeasyEconomy, type SpeakeasyRuleResult, type SpeakeasyCard} from './model.js';
import {cookSpeakeasyBook, type SpeakeasyGoal} from './scoring.js';

export const RestaurantChoicesSchema = v.strictObject({
  completed: v.pipe(v.array(SpeakeasyRestaurantActionSchema), v.maxLength(2)),
  current: v.nullable(v.strictObject({action: SpeakeasyRestaurantActionSchema,
    used: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(3))})),
});
export type RestaurantChoices = v.InferOutput<typeof RestaurantChoicesSchema>;
export function parseRestaurantChoices(input: unknown): RestaurantChoices {
  const s = v.parse(RestaurantChoicesSchema, input);
  if (new Set(s.completed).size !== s.completed.length || (s.current &&
    (s.completed.length === 2 || s.completed.includes(s.current.action) || s.current.used > restaurantLimit(s.current.action)))) throw new Error('Invalid Restaurant choices.');
  return s;
}
export function restaurantLimit(action: v.InferOutput<typeof SpeakeasyRestaurantActionSchema>): number {
  return action === 'OPERATION' ? 1 : action === 'CITY_TILES' ? 2 : 3;
}

/** Both callbacks are trusted server effect handlers, never client-supplied state or values. */
export type OperationEffects = Readonly<{
  benefit: (s: SpeakeasyEconomy, actor: PlayerId, card: SpeakeasyCard) => SpeakeasyRuleResult<SpeakeasyEconomy>;
  action: (s: SpeakeasyEconomy, actor: PlayerId, card: SpeakeasyCard) => SpeakeasyRuleResult<SpeakeasyEconomy>;
}>;
/** Replacement, benefit, then action. A failed/unresolved effect rolls back the entire play. */
export function playRestaurantOperation(original: SpeakeasyEconomy, actor: PlayerId, cardId: TileId,
  effects: OperationEffects): SpeakeasyRuleResult<SpeakeasyEconomy> {
  const installed = speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === actor), index = p?.hand.findIndex(c => c.tileId === cardId) ?? -1;
    if (!p || index < 0) return 'INVALID_ACTION';
    const card = p.hand.splice(index, 1)[0]!;
    const old = p.operations.findIndex(c => c.operation === card.operation);
    if (old >= 0) s.discardedCards.push(...p.operations.splice(old, 1));
    p.operations.push(card); return null;
  });
  if (!installed.ok) return installed;
  const card = installed.value.players.find(p => p.playerId === actor)!.operations.find(c => c.tileId === cardId)!;
  const benefit = effects.benefit(installed.value, actor, card);
  if (!benefit.ok) return benefit;
  const action = effects.action(benefit.value, actor, card);
  if (!action.ok) return action;
  // Verify total piece conservation even when a supplied effect handler is faulty.
  return speakeasyCandidate(original, s => {Object.assign(s, action.value); return null;});
}
export type RestaurantBookGoal = Readonly<{id: string; requirement: SpeakeasyGoal; payout: number;
  bonus: (s: SpeakeasyEconomy, actor: PlayerId, space: 0 | 1) => SpeakeasyRuleResult<SpeakeasyEconomy>}>;
export function cookRestaurantBook(original: SpeakeasyEconomy, actor: PlayerId, goalId: string, space: 0 | 1,
  goals: readonly RestaurantBookGoal[]): SpeakeasyRuleResult<SpeakeasyEconomy> {
  if (new Set(goals.map(g => g.id)).size !== goals.length) throw new Error('Duplicate goal catalog.');
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return ruleFailure('INVALID_ACTION');
  const placed = cookSpeakeasyBook(original, actor, goal, space);
  if (!placed.ok) return placed;
  const bonus = goal.bonus(placed.value, actor, space);
  if (!bonus.ok) return bonus;
  return speakeasyCandidate(original, s => {Object.assign(s, bonus.value); return null;});
}
