import { MARS_CORPORATE_SPECIAL } from './corporate-era-special.js';
import { MARS_CORPORATE_ERA_CARD_FACTS, type MarsCorporateCardFact } from './corporate-era-facts.js';
import { MARS_CORPORATE_ERA_ECONOMIC_EFFECTS } from './corporate-era-economy.js';
import { MARS_CORPORATE_ERA_ATTACK_EFFECTS } from './corporate-era-attacks.js';
import { MARS_CORPORATE_ERA_BOARD_EFFECTS } from './corporate-era-board.js';
import { MARS_CORPORATE_ERA_PROTECTION_EFFECTS } from './corporate-era-protection.js';
import { MARS_CORPORATE_ERA_SELECTION_EFFECTS, MARS_CORPORATE_ERA_SELECTION_ACTIONS } from './corporate-era-selection.js';
import { MARS_CORPORATE_ERA_RESOURCE_ACTIONS } from './corporate-era-resource-actions.js';
import type { MarsEffect } from './catalog.js';
import { MARS_CORPORATE_ERA_STANDARD_RULES } from './corporate-era-standard.js';

type Execution = Readonly<{ effects: readonly MarsEffect[]; actions?: readonly MarsEffect[]; passive?: string }>;
export type MarsPreparedCorporateCard = MarsCorporateCardFact & { id: typeof MARS_CORPORATE_ERA_CARD_FACTS[number]['id'] } & Execution;
const immediate: Readonly<Record<string, readonly MarsEffect[]>> = {
    ...MARS_CORPORATE_ERA_ECONOMIC_EFFECTS,
    ...MARS_CORPORATE_ERA_ATTACK_EFFECTS,
    ...MARS_CORPORATE_ERA_BOARD_EFFECTS,
    ...MARS_CORPORATE_ERA_PROTECTION_EFFECTS,
    ...MARS_CORPORATE_ERA_SELECTION_EFFECTS,
};
const passive: Readonly<Record<string, string>> = {
    AdvancedAlloys: '강철과 티타늄의 지불 가치 각각 1 M€ 증가',
    AntiGravityTechnology: '프로젝트 카드 비용 2 M€ 할인',
    EarthCatapult: '프로젝트 카드 비용 2 M€ 할인',
    EarthOffice: '지구 태그 카드 비용 3 M€ 할인',
    MediaGroup: '이벤트 카드 실행 후 3 M€ 획득',
    SpaceStation: '우주 태그 카드 비용 2 M€ 할인',
    StandardTechnology: '유료 일반 프로젝트 실행 후 3 M€ 획득. 특허 매각 제외',
    QuantumExtractor: '우주 태그 카드 비용 2 M€ 할인',
    MassConverter: '우주 태그 카드 비용 2 M€ 할인',
};
const execution: Record<string, Execution> = { ...MARS_CORPORATE_ERA_STANDARD_RULES, ...Object.fromEntries(Object.entries(MARS_CORPORATE_SPECIAL).map(([id, {name: _name, ...rules}]) => [id, rules])) };
for (const [id, effects] of Object.entries(immediate)) execution[id] = { effects };
for (const [id, description] of Object.entries(passive)) execution[id] = { ...(execution[id] ?? { effects: [] }), passive: description };
for (const [id, actions] of Object.entries(MARS_CORPORATE_ERA_RESOURCE_ACTIONS)) execution[id] = { effects: [], actions };
execution.BusinessNetwork = { effects: MARS_CORPORATE_ERA_SELECTION_EFFECTS.BusinessNetwork, actions: MARS_CORPORATE_ERA_SELECTION_ACTIONS.BusinessNetwork };
execution.InventorsGuild = { effects: [], actions: MARS_CORPORATE_ERA_SELECTION_ACTIONS.InventorsGuild };
execution.MarsUniversity = { effects: [], passive: '과학 태그마다 손패 1장을 버리고 1장을 뽑을 수 있음. 자신의 태그 포함' };

/** Complete Corporate Era definitions; the game selects the full expansion catalog at setup. */
export const MARS_PREPARED_CORPORATE_CARDS: readonly MarsPreparedCorporateCard[] = MARS_CORPORATE_ERA_CARD_FACTS.flatMap(fact => {
    const rules = execution[fact.id];
    return rules ? [{ ...fact, ...rules }] : [];
});
export const MARS_PENDING_CORPORATE_CARD_IDS: readonly string[] = MARS_CORPORATE_ERA_CARD_FACTS.filter(fact => !execution[fact.id]).map(fact => fact.id);
