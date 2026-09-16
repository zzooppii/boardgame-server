import { MARS_CORPORATE_ERA_CARD_FACTS, type MarsCorporateCardFact } from './corporate-era-facts.js';
import { MARS_CORPORATE_ERA_ECONOMIC_EFFECTS } from './corporate-era-economy.js';
import { MARS_CORPORATE_ERA_ATTACK_EFFECTS } from './corporate-era-attacks.js';
import { MARS_CORPORATE_ERA_BOARD_EFFECTS } from './corporate-era-board.js';
import { MARS_CORPORATE_ERA_PROTECTION_EFFECTS } from './corporate-era-protection.js';
import { MARS_CORPORATE_ERA_SELECTION_EFFECTS, MARS_CORPORATE_ERA_SELECTION_ACTIONS } from './corporate-era-selection.js';
import { MARS_CORPORATE_ERA_RESOURCE_ACTIONS } from './corporate-era-resource-actions.js';
import type { MarsEffect } from './catalog.js';

type Execution = Readonly<{ effects: readonly MarsEffect[]; actions?: readonly MarsEffect[]; passive?: string }>;
export type MarsPreparedCorporateCard = MarsCorporateCardFact & Execution;
const immediate: Readonly<Record<string, readonly MarsEffect[]>> = {
    ...MARS_CORPORATE_ERA_ECONOMIC_EFFECTS,
    ...MARS_CORPORATE_ERA_ATTACK_EFFECTS,
    ...MARS_CORPORATE_ERA_BOARD_EFFECTS,
    ...MARS_CORPORATE_ERA_PROTECTION_EFFECTS,
    ...MARS_CORPORATE_ERA_SELECTION_EFFECTS,
};
const passive: Readonly<Record<string, string>> = {
    QuantumExtractor: '우주 태그 카드 비용 2 M€ 할인',
    MassConverter: '우주 태그 카드 비용 2 M€ 할인',
};
const execution: Record<string, Execution> = {};
for (const [id, effects] of Object.entries(immediate)) execution[id] = { effects, ...(passive[id] ? { passive: passive[id] } : {}) };
for (const [id, actions] of Object.entries(MARS_CORPORATE_ERA_RESOURCE_ACTIONS)) execution[id] = { effects: [], actions };
execution.InventorsGuild = { effects: [], actions: MARS_CORPORATE_ERA_SELECTION_ACTIONS.InventorsGuild };
execution.MarsUniversity = { effects: [], passive: '과학 태그마다 손패 1장을 버리고 1장을 뽑을 수 있음. 자신의 태그 포함' };

/** Prepared definitions only: never used as a partial expansion deck. */
export const MARS_PREPARED_CORPORATE_CARDS: readonly MarsPreparedCorporateCard[] = MARS_CORPORATE_ERA_CARD_FACTS.flatMap(fact => {
    const rules = execution[fact.id];
    return rules ? [{ ...fact, ...rules }] : [];
});
export const MARS_PENDING_CORPORATE_CARD_IDS: readonly string[] = MARS_CORPORATE_ERA_CARD_FACTS.filter(fact => !execution[fact.id]).map(fact => fact.id);
