import * as v from 'valibot';
import { ARK_SOLO_UNIVERSITIES, ARK_CONTINENTS, ArkRefSchema, type ArkActionCard, type ArkBuilding, type ArkSoloProgress } from '@hangul-rummikub/shared';
import { discardArkHand, replenishArkDisplay, type ArkCardZones } from './card-zones.js';
import { arkAppealIncome, arkKioskIncome } from './income.js';
import { finishArkSoloBreak, occupyArkSoloDonation, parseArkSoloProgress } from './solo-lifecycle.js';

export const ARK_UNIVERSITIES = ARK_SOLO_UNIVERSITIES;
export type ArkUniversity = typeof ARK_UNIVERSITIES[number];
export type ArkBreakState = ArkCardZones & {
  progress: ArkSoloProgress;
  multiplayer?:unknown;
  breakStep: 'NOT_STARTED' | 'DISCARD' | 'CARD_INCOME' | 'COMPLETE';
  donations: number[];
  actions: ArkActionCard[];
  buildings: ArkBuilding[];
  workers: number;
  busyWorkers: number;
  taskWorkers: Record<string, number>;
  partners: string[];
  partnerSupply: string[];
  universities: ArkUniversity[];
  universitySupply: ArkUniversity[];
  money: number;
  appeal: number;
};
export type ArkBreakResult = {ok: true; state: ArkBreakState} | {ok: false; reason: 'INVALID_PHASE' | 'INVALID_CHOICE' | 'UNRESOLVED_INCOME'};

/** The solo donation is blocked before discarding, and cannot be blocked twice. */
export function beginArkSoloBreak(current: ArkBreakState): ArkBreakResult {
  parseArkSoloProgress(current.progress);
  if (current.progress.stage !== 'BREAK' || current.breakStep !== 'NOT_STARTED') return {ok: false, reason: 'INVALID_PHASE'};
  const state = structuredClone(current);
  state.donations = occupyArkSoloDonation(state.donations).occupied;
  state.breakStep = 'DISCARD';
  return {ok: true, state};
}

/** Caller sends only selected IDs. Hand limit, income and supply come from canonical state. */
export function resolveArkSoloBreakDiscard(current: ArkBreakState, input: unknown): ArkBreakResult {
  if (current.progress.stage !== 'BREAK' || current.breakStep !== 'DISCARD') return {ok: false, reason: 'INVALID_PHASE'};
  const parsed = v.safeParse(v.strictObject({discard: v.pipe(v.array(ArkRefSchema), v.maxLength(250))}), input);
  if (!parsed.success) return {ok: false, reason: 'INVALID_CHOICE'};
  const state = structuredClone(current);
  const excess = Math.max(0, state.hand.length - (state.universities.includes('HAND_LIMIT') ? 5 : 3));
  if (!discardArkHand(state, parsed.output.discard, excess)) return {ok: false, reason: 'INVALID_CHOICE'};
  state.actions = state.actions.map(card => ({...card, venom: false, constriction: false, multiplier: 0}));
  state.busyWorkers = 0;
  state.taskWorkers = {};
  if(!state.multiplayer){
  state.partnerSupply = ARK_CONTINENTS.filter(partner => !state.partners.includes(partner));
  state.universitySupply = ARK_UNIVERSITIES.filter(university => !state.universities.includes(university));
  state.discarded.push(...state.display.slice(0, 2).filter(card => card !== null));
  state.display[0] = null;
  state.display[1] = null;
  replenishArkDisplay(state);
  }
  state.money += arkAppealIncome(state.appeal) + arkKioskIncome(state.buildings);
  state.breakStep = 'CARD_INCOME';
  return {ok: true, state};
}

/** All sponsor and uncovered map incomes (including resulting choices) must resolve first. */
export function completeArkSoloBreak(current: ArkBreakState, remainingIncomeEffects: number): ArkBreakResult {
  if (current.progress.stage !== 'BREAK' || current.breakStep !== 'CARD_INCOME') return {ok: false, reason: 'INVALID_PHASE'};
  if (remainingIncomeEffects !== 0) return {ok: false, reason: 'UNRESOLVED_INCOME'};
  const next = finishArkSoloBreak(current.progress, remainingIncomeEffects);
  if (!next.ok) return {ok: false, reason: 'INVALID_PHASE'};
  const state = structuredClone(current);
  // Income choices can remove market cards. Refill once the solo player's entire income is done.
  replenishArkDisplay(state);
  state.progress = next.progress;
  state.breakStep = 'COMPLETE';
  return {ok: true, state};
}
