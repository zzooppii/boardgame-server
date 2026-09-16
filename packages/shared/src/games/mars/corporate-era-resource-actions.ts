import type { MarsEffect } from './catalog.js';

// Data only. Actual card registration and generation-limited activation follow in full catalog integration.
export const MARS_CORPORATE_ERA_RESOURCE_ACTIONS = {
    SecurityFleet: [{ kind: 'stock', resource: 'titanium', amount: -1 }, { kind: 'add', resource: 'fighter', amount: 1, self: true }],
    PhysicsComplex: [{ kind: 'stock', resource: 'energy', amount: -6 }, { kind: 'add', resource: 'science', amount: 1, self: true }],
    Tardigrades: [{ kind: 'add', resource: 'microbe', amount: 1, self: true }],
} as const satisfies Record<string, readonly MarsEffect[]>;
