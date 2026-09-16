import type { MarsResource, MarsResources } from '@hangul-rummikub/shared';

/** Production costs are mandatory; habitat resource protection does not apply. */
export function marsCanReduceProduction(production: MarsResources, resource: MarsResource, amount: number): boolean {
    return production[resource] - amount >= (resource === 'money' ? -5 : 0);
}
