import { DUEL_CARDS, type DuelCardDefinition } from '@hangul-rummikub/shared';

/** Group public component facts, not the hidden cards selected for this game. */
export function buildingReference(pantheon: boolean, agora: boolean) {
    const cards = DUEL_CARDS.filter(c => c.color === 'TEMPLE' ? pantheon : c.color === 'PURPLE' ? !pantheon : c.color === 'WHITE' || c.color === 'BLACK' ? agora : true);
    const colors = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
    const roots = cards.filter(c => c.chainOut && !c.chainIn).sort((a, b) => colors.indexOf(a.color) - colors.indexOf(b.color) || a.age - b.age);
    const chains: DuelCardDefinition[][] = roots.map(root => {
        const chain = [root];
        let next = cards.find(c => c.chainIn === root.chainOut);
        while (next && !chain.includes(next)) {
            chain.push(next);
            next = next.chainOut ? cards.find(c => c.chainIn === next?.chainOut) : undefined;
        }
        return chain;
    }).filter(chain => chain.length > 1);
    const linkedIds = new Set(chains.flat().map(c => c.id));
    return { chains, unlinked: cards.filter(c => !linkedIds.has(c.id) && c.color !== 'TEMPLE'), temples: cards.filter(c => c.color === 'TEMPLE') };
}
