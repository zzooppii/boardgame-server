import { MARS_CORPORATE_ERA_CORPORATION_FACTS, MARS_RESOURCES, marsCorporation, marsResources, type MarsCorporateCorporationFact } from '@hangul-rummikub/shared';

// Variant-specific initial production; corporations retain their printed starting effects.
export function marsCorporationStart(corporationId: string, variant: 'base' | 'corporate-era') {
    const corporate: MarsCorporateCorporationFact | undefined = variant === 'corporate-era'
        ? MARS_CORPORATE_ERA_CORPORATION_FACTS.find(c => c.id === corporationId)
        : undefined;
    if (variant === 'base' && MARS_CORPORATE_ERA_CORPORATION_FACTS.some(c => c.id === corporationId)) throw new Error('Unknown Mars corporation for base variant');
    const money = corporate?.money ?? marsCorporation(corporationId).money;
    const resources = marsResources({ money });
    const production = variant === 'base'
        ? marsResources({ money: 1, steel: 1, titanium: 1, plants: 1, energy: 1, heat: 1 })
        : marsResources();
    switch (corporationId) {
        case 'EcoLine': production.plants += 2; resources.plants = 3; break;
        case 'Helion': production.heat += 3; break;
        case 'InterplanetaryCinematics': resources.steel = 20; break;
        case 'MiningGuild': production.steel++; resources.steel = 5; break;
        case 'PhoboLog': resources.titanium = 10; break;
        case 'CheungShingMARS': production.money+=3;break;
        case 'PointLuna': production.titanium++;break;
        case 'Thorgate': production.energy++; break;
    }
    if (corporate) {
        for (const resource of MARS_RESOURCES) production[resource] += corporate.production[resource] ?? 0;
        // Saturn's own Jovian tag triggers its effect once when corporations enter play.
        if (corporate.passive.kind === 'jovianProduction') production.money += corporate.tags.filter(t => t === 'jovian').length;
    }
    return { resources, production };
}
