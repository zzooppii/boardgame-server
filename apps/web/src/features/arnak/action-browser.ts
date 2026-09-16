import type { ArnakOffer } from '@hangul-rummikub/shared';
const categories = [
    ['DIG', '발굴'], ['DISCOVER', '발견'], ['BUY', '구매'],
    ['RESEARCH', '연구'], ['GUARDIAN', '수호자 극복'], ['CARD', '카드 사용'],
] as const;

/** Index only server-issued targets. Payment alternatives do not inflate target counts. */
export function arnakActionTargets(offers: readonly ArnakOffer[]) {
    return categories.flatMap(([kind, label]) => {
        const targets = new Map<string, { targetId: string; fallbackLabel: string; choices: number }>();
        for (const offer of offers) {
            if (offer.kind !== kind) continue;
            const target = targets.get(offer.targetId);
            if (target) target.choices += 1;
            else targets.set(offer.targetId, { targetId: offer.targetId, fallbackLabel: offer.label, choices: 1 });
        }
        return targets.size ? [{ kind, label, targets: [...targets.values()] }] : [];
    });
}
