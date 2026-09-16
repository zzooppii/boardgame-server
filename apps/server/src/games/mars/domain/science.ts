import type { MarsDefinition, MarsEffect } from '@hangul-rummikub/shared';
import type { MarsEconomyPlayer } from './economy.js';

/** The newly paid card is already in played, so Mars University includes its own tag. */
export function marsScienceExchangeEffects(owner: MarsEconomyPlayer, card: Pick<MarsDefinition, 'tags'>): MarsEffect[] {
    if (!owner.played.some(c => c.definitionId === 'MarsUniversity')) return [];
    return card.tags.filter(tag => tag === 'science').map(() => ({ kind: 'exchangeCard' }));
}
