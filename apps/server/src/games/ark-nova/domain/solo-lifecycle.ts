import * as v from 'valibot';
import {
  ArkSoloProgressSchema, arkSoloProgressIsConsistent, ARK_SOLO_ROUND_TURNS,
  ARK_SOLO_STARTING_APPEAL, ArkSoloDifficultySchema, type ArkSoloDifficulty, type ArkSoloProgress,
} from '@hangul-rummikub/shared';

export type SoloTransition = Readonly<{ok: true; progress: ArkSoloProgress}> |
  Readonly<{ok: false; reason: 'INVALID_PHASE' | 'UNRESOLVED_ACTION'}>;
/** Board spaces in ascending cost order; equal-cost spaces are distinct. */
export {ARK_DONATION_COSTS,occupyArkSoloDonation} from '@hangul-rummikub/shared';
export function parseArkSoloProgress(input: unknown): ArkSoloProgress {
  return v.parse(v.pipe(ArkSoloProgressSchema, v.check(arkSoloProgressIsConsistent, 'Invalid solo timeline.')), input);
}
export function createArkSoloProgress(difficulty: ArkSoloDifficulty): Readonly<{progress: ArkSoloProgress; appeal: number}> {
  const parsed = v.parse(ArkSoloDifficultySchema, difficulty);
  return {progress: {round: 1, turnInRound: 0, turnsCompleted: 0, stage: 'SETUP'}, appeal: ARK_SOLO_STARTING_APPEAL[parsed]};
}
export function startArkSolo(progress: ArkSoloProgress): SoloTransition {
  const p = parseArkSoloProgress(progress);
  return p.stage === 'SETUP' ? {ok: true, progress: {...p, stage: 'ACTION'}} : {ok: false, reason: 'INVALID_PHASE'};
}
/** Call only after an authenticated action and all of its extra actions/effects have committed. */
export function finishArkSoloTurn(progress: ArkSoloProgress, unresolvedEffects: number): SoloTransition {
  const p = parseArkSoloProgress(progress);
  if (p.stage !== 'ACTION') return {ok: false, reason: 'INVALID_PHASE'};
  if (!Number.isSafeInteger(unresolvedEffects) || unresolvedEffects !== 0) return {ok: false, reason: 'UNRESOLVED_ACTION'};
  const turnInRound = p.turnInRound + 1;
  const stage = turnInRound < ARK_SOLO_ROUND_TURNS[p.round - 1]! ? 'ACTION' : p.round === 6 ? 'FINAL_SCORING' : 'BREAK';
  return {ok: true, progress: parseArkSoloProgress({...p, turnInRound, turnsCompleted: p.turnsCompleted + 1, stage})};
}
/** Resolve discard, worker/token cleanup, market and income before calling this function. */
export function finishArkSoloBreak(progress: ArkSoloProgress, unresolvedEffects: number): SoloTransition {
  const p = parseArkSoloProgress(progress);
  if (p.stage !== 'BREAK') return {ok: false, reason: 'INVALID_PHASE'};
  if (!Number.isSafeInteger(unresolvedEffects) || unresolvedEffects !== 0) return {ok: false, reason: 'UNRESOLVED_ACTION'};
  return {ok: true, progress: parseArkSoloProgress({...p, round: p.round + 1, turnInRound: 0, stage: 'ACTION'})};
}
/** Occupied values are zero-based space IDs, not costs. Space 7 (12 money) is repeatable. */
export function completeArkSoloScoring(progress: ArkSoloProgress, victoryPoints: number): Readonly<{ok: true; progress: ArkSoloProgress; won: boolean; victoryPoints: number}> | Readonly<{ok: false; reason: 'INVALID_PHASE' | 'INVALID_SCORE'}> {
  const p = parseArkSoloProgress(progress);
  if (p.stage !== 'FINAL_SCORING') return {ok: false, reason: 'INVALID_PHASE'};
  if (!Number.isSafeInteger(victoryPoints)) return {ok: false, reason: 'INVALID_SCORE'};
  return {ok: true, progress: {...p, stage: 'FINISHED'}, won: victoryPoints >= 0, victoryPoints};
}
