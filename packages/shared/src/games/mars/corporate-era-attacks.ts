import type { MarsEffect } from './catalog.js';

// Effect data only; full card registration remains part of expansion integration.
export const MARS_CORPORATE_ERA_ATTACK_EFFECTS = {
    HiredRaiders: [{ kind: 'choice', options: [
        { label: '강철 최대 2 탈취', effects: [{ kind: 'attackStock', resource: 'steel', amount: 2, steal: true }] },
        { label: 'M€ 최대 3 탈취', effects: [{ kind: 'attackStock', resource: 'money', amount: 3, steal: true }] },
    ] }],
    Sabotage: [{ kind: 'choice', options: [
        { label: '티타늄 최대 3 제거', effects: [{ kind: 'attackStock', resource: 'titanium', amount: 3, steal: false }] },
        { label: '강철 최대 4 제거', effects: [{ kind: 'attackStock', resource: 'steel', amount: 4, steal: false }] },
        { label: 'M€ 최대 7 제거', effects: [{ kind: 'attackStock', resource: 'money', amount: 7, steal: false }] },
    ] }],
    Virus: [{ kind: 'choice', options: [
        { label: '동물 최대 2 제거', effects: [{ kind: 'removeCardResource', resource: 'animal', amount: 2 }] },
        { label: '식물 최대 5 제거', effects: [{ kind: 'removePlants', amount: 5 }] },
    ] }],
} as const satisfies Record<string, readonly MarsEffect[]>;
