import type { ArnakOffer } from '@hangul-rummikub/shared';
export type ArnakOfferGroup = { key: string; label: string; offers: ArnakOffer[] };
/** Presentation only: retain every server-issued choice and its original ID. */
export function groupArnakOffers(offers: readonly ArnakOffer[], preservedCards: ReadonlySet<string>): ArnakOfferGroup[] {
    const groups = new Map<string, ArnakOfferGroup>();
    for (const offer of offers) {
        if (offer.cards.some(id => preservedCards.has(id))) continue;
        const key = JSON.stringify([offer.kind, offer.targetId, offer.label, offer.detail, offer.free]);
        const group = groups.get(key);
        if (group) group.offers.push(offer);
        else groups.set(key, { key, label: offer.label, offers: [offer] });
    }
    return [...groups.values()];
}
