import type {MarsOffer} from '@hangul-rummikub/shared';

/** Mandatory project choices must remain reachable regardless of hand filters or action tabs. */
export function marsVisibleOffers(offers: readonly MarsOffer[], resolving: boolean, target: string|null, group: 'all'|'project'|'claim'): MarsOffer[] {
    const instant = offers.filter(o => o.id.startsWith('instant:') && o.kind === 'CARD');
    if (instant.length) return instant;
    return offers.filter(o => o.id.startsWith('initial-award:') || (
        resolving ? o.kind === 'PLACE' || o.kind === 'EFFECT' :
        target ? o.targetId === target :
        group === 'project' ? o.kind === 'PROJECT' :
        group === 'claim' ? ['MILESTONE','AWARD'].includes(o.kind) :
        ['CONVERT','ACTION','END','PASS'].includes(o.kind)
    ));
}
