import type { MarsEffect } from './catalog.js';

// Effect data only; the expansion deck remains disabled until its complete catalog is ready.
export const MARS_CORPORATE_ERA_PROTECTION_EFFECTS = {
    ProtectedHabitats: [{ kind: 'protectHabitats' }],
} as const satisfies Record<string, readonly MarsEffect[]>;
