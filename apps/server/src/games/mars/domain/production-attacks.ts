import type { MarsResource, MarsResources, PlayerId } from '@hangul-rummikub/shared';

/** Production costs are mandatory; habitat resource protection does not apply. */
export function marsCanReduceProduction(production: MarsResources, resource: MarsResource, amount: number): boolean {
    return production[resource] - amount >= (resource === 'money' ? -5 : 0);
}

/** When nobody produces energy, only the actor can gain then lose their own step. */
export function marsEnergyProductionTargets(players: readonly { playerId: PlayerId; production: MarsResources }[], actorId: PlayerId): readonly PlayerId[] {
    const producers = players.filter(p => p.production.energy > 0);
    return producers.length ? producers.map(p => p.playerId) : players.filter(p => p.playerId === actorId).map(p => p.playerId);
}
