import { MARS_CORPORATE_ERA_CARD_FACTS, MARS_CORPORATE_ERA_CORPORATION_FACTS, marsCard, marsCorporation, marsResources, type MarsCard, type MarsDefinition } from '@hangul-rummikub/shared';

export type MarsEconomyPlayer = Readonly<{
    corporationId: string | null;
    played: readonly Pick<MarsCard, 'definitionId'>[];
}>;
type PrintedProject = Pick<MarsDefinition, 'cost' | 'tags' | 'type'>;
const has = (p: MarsEconomyPlayer, id: string) => p.played.some(c => c.definitionId === id);

export function marsEconomyTags(p: MarsEconomyPlayer, tag: string): number {
    const corporation = p.corporationId === null ? null : MARS_CORPORATE_ERA_CORPORATION_FACTS.find(c => c.id === p.corporationId) ?? marsCorporation(p.corporationId);
    return (corporation?.tags.filter(t => t === tag).length ?? 0) + p.played.reduce((total, card) => {
        const facts = MARS_CORPORATE_ERA_CARD_FACTS.find(c => c.id === card.definitionId) ?? marsCard(card.definitionId);
        return total + (facts.type === 'event' ? 0 : facts.tags.filter(t => t === tag).length);
    }, 0);
}

export function marsMetalValues(p: MarsEconomyPlayer): { steelValue: 2 | 3; titaniumValue: 3 | 4 | 5 } {
    const alloys = has(p, 'AdvancedAlloys');
    return { steelValue: alloys ? 3 : 2, titaniumValue: p.corporationId === 'PhoboLog' ? (alloys ? 5 : 4) : (alloys ? 4 : 3) };
}

export function marsDiscountedCost(p: MarsEconomyPlayer, card: Pick<PrintedProject, 'cost' | 'tags'>): number {
    let discount = (has(p, 'ResearchOutpost') ? 1 : 0) + (has(p, 'EarthCatapult') ? 2 : 0) + (has(p, 'AntiGravityTechnology') ? 2 : 0);
    if (card.tags.includes('space')) for (const id of ['Shuttles', 'SpaceStation', 'QuantumExtractor', 'MassConverter']) if (has(p, id)) discount += 2;
    if (card.tags.includes('earth')) discount += (has(p, 'EarthOffice') ? 3 : 0) + (p.corporationId === 'Teractor' ? 3 : 0);
    if (card.tags.includes('power') && p.corporationId === 'Thorgate') discount += 3;
    return Math.max(0, card.cost - discount);
}

/** Paid-card rewards use printed cost and the event's tags, before it is turned face down. */
export function marsCardIncome(p: MarsEconomyPlayer, card: PrintedProject) {
    const result = marsResources();
    if (card.type === 'event') {
        if (p.corporationId === 'InterplanetaryCinematics') result.money += 2;
        if (has(p, 'MediaGroup')) result.money += 3;
        if (card.tags.includes('space') && has(p, 'OptimalAerobraking')) { result.money += 3; result.heat += 3; }
    }
    if (p.corporationId === 'CrediCor' && card.cost >= 20) result.money += 4;
    return result;
}

export function marsStandardProjectIncome(p: MarsEconomyPlayer, project: 'power' | 'asteroid' | 'aquifer' | 'greenery' | 'city' | 'sell', cost: number): number {
    if (project === 'sell') return 0;
    return (has(p, 'StandardTechnology') ? 3 : 0) + (p.corporationId === 'CrediCor' && cost >= 20 ? 4 : 0);
}

export function marsJovianProduction(owner: MarsEconomyPlayer, card: Pick<PrintedProject, 'tags'>): number {
    return owner.corporationId === 'SaturnSystems' ? card.tags.filter(t => t === 'jovian').length : 0;
}

export type MarsTagProductionRule = 'plantTags' | 'powerTags' | 'microbeTags' | 'nitrogen' | 'earthIncome' | 'buildingIncome' | 'spaceIncome' | 'opponentsSpaceIncome';
/** The caller supplies played cards including the newly paid card; events never remain as tags. */
export function marsTagProduction(p: MarsEconomyPlayer, opponents: readonly MarsEconomyPlayer[], rule: MarsTagProductionRule) {
    const result = marsResources();
    switch (rule) {
        case 'plantTags': result.plants = marsEconomyTags(p, 'plant'); break;
        case 'powerTags': result.energy = marsEconomyTags(p, 'power'); break;
        case 'microbeTags': result.plants = Math.floor(marsEconomyTags(p, 'microbe') / 2); break;
        case 'nitrogen': result.plants = marsEconomyTags(p, 'plant') >= 3 ? 4 : 1; break;
        case 'earthIncome': result.money = marsEconomyTags(p, 'earth'); break;
        case 'buildingIncome': result.money = Math.floor(marsEconomyTags(p, 'building') / 2); break;
        case 'spaceIncome': result.money = marsEconomyTags(p, 'space'); break;
        case 'opponentsSpaceIncome': result.money = opponents.reduce((sum, other) => sum + marsEconomyTags(other, 'space'), 0); break;
    }
    return result;
}
