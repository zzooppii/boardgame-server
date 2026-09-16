import { MARS_BOARD, type MarsDefinition, type MarsEffect, type MarsProjection } from '@hangul-rummikub/shared';

const productionRules = new Set(['citiesEnergy', 'citiesIncome', 'plantTags', 'powerTags', 'microbeTags', 'nitrogen', 'earthIncome', 'buildingIncome', 'spaceIncome', 'opponentsSpaceIncome', 'insulation']);
/** Production boxes only. Placement rewards, immediate resources and passive triggers are excluded. */
export function marsProductionBox(card: MarsDefinition, tiles: MarsProjection['tiles']): readonly MarsEffect[] {
    if (card.type === 'event' || !card.tags.includes('building')) return [];
    if ((card.id === 'MiningRights' || card.id === 'MiningArea')) {
        const tile = tiles.find(t => t.source === card.id);
        const bonus = MARS_BOARD.find(b => b.id === tile?.spaceId)?.bonus;
        if (bonus?.includes('steel')) return [{ kind: 'production', resource: 'steel', amount: 1 }];
        if (bonus?.includes('titanium')) return [{ kind: 'production', resource: 'titanium', amount: 1 }];
        return [];
    }
    return card.effects.filter(e => e.kind === 'production' || e.kind === 'attackProduction' || e.kind === 'dynamic' && productionRules.has(e.rule));
}
