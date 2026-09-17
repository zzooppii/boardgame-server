import type {RestaurantBookGoal} from './restaurant-actions.js';

/** Printed board goals, Rules v19c p.23. Tile goals and their bonuses are separate. */
export function speakeasyFixedBookGoals(): RestaurantBookGoal[] {
  const definitions: Pick<RestaurantBookGoal, 'id' | 'requirement' | 'payout'>[] = [
    {id: 'fixed:docks:1', requirement: {kind: 'CRATES', minimum: 1}, payout: 15},
    {id: 'fixed:docks:2', requirement: {kind: 'CRATES', minimum: 2}, payout: 15},
    {id: 'fixed:docks:3', requirement: {kind: 'CRATES', minimum: 3}, payout: 15},
    {id: 'fixed:city-hall:3', requirement: {kind: 'PROTECTED_DISTRICTS', minimum: 3}, payout: 20},
    {id: 'fixed:city-hall:5', requirement: {kind: 'PROTECTED_DISTRICTS', minimum: 5}, payout: 20},
    {id: 'fixed:city-hall:7', requirement: {kind: 'PROTECTED_DISTRICTS', minimum: 7}, payout: 20},
    {id: 'fixed:infamy:10', requirement: {kind: 'INFAMY', minimum: 10}, payout: 10},
    {id: 'fixed:infamy:15', requirement: {kind: 'INFAMY', minimum: 15}, payout: 15},
    {id: 'fixed:infamy:22', requirement: {kind: 'INFAMY', minimum: 22}, payout: 20},
  ];
  // Each call owns its metadata; callers cannot change another game's printed payouts.
  return definitions.map(goal => ({...goal, bonus: s => ({ok: true, value: s})}));
}
