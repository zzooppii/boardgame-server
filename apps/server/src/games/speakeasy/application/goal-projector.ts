import type {PlayerId, SpeakeasyFixedGoalView} from '@hangul-rummikub/shared';
import type {SpeakeasyGameFlow} from '../domain/game-flow.js';
import {speakeasyFixedBookGoals} from '../domain/fixed-goals.js';
import {speakeasyGoalMet} from '../domain/scoring.js';
import {speakeasyInfamy} from '../domain/economy.js';

/** Called with validated game state; recipient progress is never room-broadcast. */
export function projectSpeakeasyFixedGoals(s: SpeakeasyGameFlow, viewer: PlayerId): SpeakeasyFixedGoalView[] {
  const economy = s.round.economy, p = economy.players.find(p => p.playerId === viewer);
  if (!p) throw new Error('Missing goal recipient.');
  const current = s.active?.restaurant?.current;
  return speakeasyFixedBookGoals().map(goal => {
    const requirement = goal.requirement;
    if (requirement.kind !== 'CRATES' && requirement.kind !== 'PROTECTED_DISTRICTS' && requirement.kind !== 'INFAMY') throw new Error('Invalid fixed goal.');
    const progress = requirement.kind === 'CRATES' ? p.crates.length : requirement.kind === 'INFAMY' ? speakeasyInfamy(p) :
      economy.districts.filter(d => d.slots.some(b => b?.ownerId === viewer && b.familyId !== null)).length;
    const spaces = [0, 1].map(space => economy.placedBooks.find(b => b.goalId === goal.id && b.space === space)?.ownerId ?? null);
    const status: SpeakeasyFixedGoalView['status'] = spaces.includes(viewer) ? 'CLAIMED' : spaces.every(Boolean) ? 'FULL' :
      !speakeasyGoalMet(economy, p, requirement) ? 'REQUIREMENT' : p.books === 0 ? 'NO_BOOKS' :
      s.round.phase !== 'PLAYING' || s.awaitingCityReturn || s.active?.playerId !== viewer || current?.action !== 'BOOKS' ? 'BOOK_ACTION_REQUIRED' :
      current.used >= 3 ? 'ACTION_LIMIT' : 'READY';
    return {id:goal.id, kind:requirement.kind, minimum:requirement.minimum, progress, payout:goal.payout, spaces, status};
  });
}
