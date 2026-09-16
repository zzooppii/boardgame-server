import type { PlayerId, MarsResource, MarsCardResource } from '@hangul-rummikub/shared';

/** Resource removal only: production reductions and spending have separate rules. */
export function marsCanRemoveResource(actorId: PlayerId, owner: { playerId: PlayerId; protectedHabitats: boolean }, resource: MarsResource | MarsCardResource, cardDefinitionId?: string): boolean {
    if (resource === 'animal' && cardDefinitionId === 'Pets') return false;
    return actorId === owner.playerId || !owner.protectedHabitats || !['plants', 'animal', 'microbe'].includes(resource);
}
