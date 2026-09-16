import type { MarsEffect } from './catalog.js';

// Effect data only; the complete expansion catalog is not enabled yet.
export const MARS_CORPORATE_ERA_BOARD_EFFECTS = {
    LandClaim: [{ kind: 'claimLand' }],
} as const satisfies Record<string, readonly MarsEffect[]>;
