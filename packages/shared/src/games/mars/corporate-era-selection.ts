import type { MarsEffect } from './catalog.js';

// These effects remain outside the live deck until the complete expansion is assembled.
export const MARS_CORPORATE_ERA_SELECTION_EFFECTS = {
    InventionContest: [{ kind: 'keepCards', count: 3, keep: 1 }],
    BusinessContacts: [{ kind: 'keepCards', count: 4, keep: 2 }],
} as const satisfies Record<string, readonly MarsEffect[]>;
export const MARS_CORPORATE_ERA_SELECTION_ACTIONS = {
    InventorsGuild: [{ kind: 'buyCard' }],
    BusinessNetwork: [{ kind: 'buyCard' }],
} as const satisfies Record<string, readonly MarsEffect[]>;
