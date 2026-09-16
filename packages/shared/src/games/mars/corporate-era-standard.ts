import type { MarsEffect } from './catalog.js';
import type { MARS_CORPORATE_ERA_CARD_FACTS } from './corporate-era-facts.js';

type CorporateCardId = typeof MARS_CORPORATE_ERA_CARD_FACTS[number]['id'];

// Complete effect sequences using existing primitives. Still outside the live deck.
export const MARS_CORPORATE_ERA_STANDARD_RULES = {
    AICentral: {
        effects: [{ kind: 'production', resource: 'energy', amount: -1 }],
        actions: [{ kind: 'draw', amount: 2 }],
    },
    DevelopmentCenter: {
        effects: [],
        actions: [{ kind: 'stock', resource: 'energy', amount: -1 }, { kind: 'draw', amount: 1 }],
    },
    CaretakerContract: {
        effects: [],
        actions: [{ kind: 'stock', resource: 'heat', amount: -8 }, { kind: 'global', track: 'tr', amount: 1 }],
    },
    SpaceElevator: {
        effects: [{ kind: 'production', resource: 'titanium', amount: 1 }],
        actions: [{ kind: 'stock', resource: 'steel', amount: -1 }, { kind: 'stock', resource: 'money', amount: 5 }],
    },
    BribedCommittee: { effects: [{ kind: 'global', track: 'tr', amount: 2 }] },
    RadSuits: { effects: [{ kind: 'production', resource: 'money', amount: 1 }] },
    CorporateStronghold: {
        effects: [
            { kind: 'production', resource: 'energy', amount: -1 },
            { kind: 'production', resource: 'money', amount: 3 },
            { kind: 'place', tile: 'city', rule: 'normal' },
        ],
    },
    GreatEscarpmentConsortium: {
        effects: [{ kind: 'attackProduction', resource: 'steel', amount: 1 }, { kind: 'production', resource: 'steel', amount: 1 }],
    },
    // These cards provide printed tags/points only; no artificial action or passive.
    InterstellarColonyShip: { effects: [] },
    TransNeptuneProbe: { effects: [] },
} as const satisfies Partial<Record<CorporateCardId, Readonly<{ effects: readonly MarsEffect[]; actions?: readonly MarsEffect[] }>>>;
