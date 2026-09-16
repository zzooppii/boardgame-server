import type { MarsDefinition, MarsEffect } from '@hangul-rummikub/shared';
import type { MarsEconomyPlayer } from './economy.js';

/** The newly paid card is already in played, so Mars University includes its own tag. */
export function marsScienceExchangeEffects(owner: MarsEconomyPlayer, card: Pick<MarsDefinition, 'tags'>): MarsEffect[] {
    if (!owner.played.some(c => c.definitionId === 'MarsUniversity')) return [];
    return card.tags.filter(tag => tag === 'science').map(() => ({ kind: 'exchangeCard' }));
}

/** Card already belongs to the tableau: own tags and duplicate tags trigger separately. */
export function marsCorporateTriggerEffects(owner: MarsEconomyPlayer, card: Pick<MarsDefinition, 'tags'>): MarsEffect[] {
    const effects: MarsEffect[] = [];
    if (owner.played.some(c => c.definitionId === 'OlympusConference')) effects.push(...card.tags.filter(t => t === 'science').map((): MarsEffect => ({kind:'olympus'})));
    if (owner.played.some(c => c.definitionId === 'ViralEnhancers')) effects.push(...card.tags.filter(t => ['plant','animal','microbe'].includes(t)).map((): MarsEffect => ({kind:'viral'})));
    return effects;
}
