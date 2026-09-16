import type { MarsCardResource, MarsResourceScore } from '@hangul-rummikub/shared';

/** Counts remain card-local; a card cannot receive another resource type. */
export function marsAddedCardResources(count: number, cardResource: string | null, resource: MarsCardResource, amount: number): number {
    if (cardResource !== resource) throw new Error('Mismatched Mars card resource');
    return count + amount;
}

/** Round down each card's complete groups before multiplying its printed VP. */
export function marsCardResourcePoints(count: number, score: MarsResourceScore): number {
    if (!Number.isSafeInteger(score.per) || score.per < 1 || !Number.isSafeInteger(score.points) || score.points < 0)
        throw new Error('Invalid Mars resource scoring rule');
    return Math.floor(count / score.per) * score.points;
}
