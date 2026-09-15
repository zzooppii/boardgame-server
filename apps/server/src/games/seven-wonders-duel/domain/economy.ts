import { duelCard, duelWonder, DUEL_RESOURCES, type DuelCardDefinition, type DuelWonderDefinition, type DuelResource, type DuelCost, type DuelScience } from '@hangul-rummikub/shared';
import { other, type DuelState, type DuelSeat } from './state.js';
export function city(s: DuelState, p: DuelSeat) { return s.cards.filter(c => c.zone === 'CITY' && c.owner === p); }
export function hasProgress(s: DuelState, p: DuelSeat, id: string): boolean { return s.progress.some(t => t.id === id && t.zone === 'PLAYER' && t.owner === p); }
export function controller(s: DuelState, chamber: number): DuelSeat | null { const a = s.players[0]!.influence[chamber]!, b = s.players[1]!.influence[chamber]!; return a > b ? 0 : b > a ? 1 : null; }
export function hasDecree(s: DuelState, p: DuelSeat, id: number): boolean { return s.settings.agora && s.decrees.some(d => d.id === id && d.revealed && controller(s, d.chamber) === p); }
export function science(s: DuelState, p: DuelSeat): DuelScience[] {
    const a = city(s, p).flatMap(c => { const n = duelCard(c.definitionId).science; return n ? [n] : []; });
    if (hasProgress(s, p, 'law'))
        a.push('LAW');
    if (s.players[p]!.gods.includes('ishtar'))
        a.push('LAW');
    const target = s.cards.find(c => c.tileId === s.players[p]!.snake && c.zone === 'CITY' && c.owner === other(p));
    const symbol = target ? duelCard(target.definitionId).science : undefined;
    if (s.players[p]!.gods.includes('nisaba') && symbol)
        a.push(symbol);
    return a;
}
export function production(s: DuelState, p: DuelSeat): {
    fixed: DuelCost;
    flex: (readonly DuelResource[])[];
    trade: Set<DuelResource>;
} {
    const fixed: DuelCost = {}, flex: (readonly DuelResource[])[] = [], trade = new Set<DuelResource>();
    for (const c of city(s, p)) {
        const d = duelCard(c.definitionId);
        for (const r of DUEL_RESOURCES)
            fixed[r] = (fixed[r] ?? 0) + (d.production?.[r] ?? 0);
        if (d.flex)
            flex.push(d.flex);
        d.trade?.forEach(r => trade.add(r));
    }
    for (const w of s.wonders.filter(w => w.owner === p && w.built && !w.removed)) {
        const d = duelWonder(w.id);
        if (d.flex)
            flex.push(d.flex);
    }
    return { fixed, flex, trade };
}
export type DuelQuote = {
    total: number;
    printed: number;
    trade: number;
    purchases: DuelCost;
    method: 'RESOURCES' | 'CHAIN' | 'ENGINEERING' | 'FREE';
    detail: string;
};
const resourceNames: Record<DuelResource, string> = { wood: '나무', clay: '점토', stone: '돌', glass: '유리', papyrus: '파피루스' };
function priced(s: DuelState, p: DuelSeat, cost: DuelCost, coins: number, discount: number): DuelQuote {
    const prod = production(s, p), rival = city(s, other(p)).map(c => duelCard(c.definitionId)).filter(d => d.color === 'BROWN' || d.color === 'GREY');
    const prices = DUEL_RESOURCES.map(r => Math.max(1, (prod.trade.has(r) ? 1 : 2 + rival.reduce((n, d) => n + (d.production?.[r] ?? 0), 0)) - (hasDecree(s, p, ['wood', 'clay', 'stone'].includes(r) ? 10 : 11) ? 1 : 0)));
    let best = Infinity, bestNeeds: number[] = [];
    function search(i: number, needs: number[]): void {
        if (i < prod.flex.length) {
            for (const r of prod.flex[i]!) {
                const next = [...needs], j = DUEL_RESOURCES.indexOf(r);
                next[j] = Math.max(0, next[j]! - 1);
                search(i + 1, next);
            }
            return;
        }
        const next = [...needs];
        const order = DUEL_RESOURCES.map((_, j) => j).sort((a, b) => prices[b]! - prices[a]!);
        let left = discount;
        for (const j of order) {
            const remove = Math.min(left, next[j]!);
            next[j]! -= remove;
            left -= remove;
        }
        const price = next.reduce((sum, n, j) => sum + n * prices[j]!, 0);
        if (price < best) {
            best = price;
            bestNeeds = next;
        }
    }
    search(0, DUEL_RESOURCES.map(r => Math.max(0, (cost[r] ?? 0) - (prod.fixed[r] ?? 0))));
    const purchases: DuelCost = {};
    bestNeeds.forEach((n, i) => {
        if (n)
            purchases[DUEL_RESOURCES[i]!] = n;
    });
    const parts = DUEL_RESOURCES.flatMap((r, i) => bestNeeds[i] ? `${resourceNames[r]} ${bestNeeds[i]}개 × ${prices[i]}코인` : []);
    return { total: coins + best, printed: coins, trade: best, purchases, method: 'RESOURCES', detail: `표기 코인 ${coins} + 부족 자원 ${best}${parts.length ? ` (${parts.join(' · ')})` : ' · 생산으로 충당'}` };
}
export function quote(s: DuelState, p: DuelSeat, d: DuelCardDefinition | DuelWonderDefinition): DuelQuote {
    const isCard = 'color' in d;
    if (isCard && (d.color === 'WHITE' || d.color === 'BLACK')) {
        const n = hasProgress(s, p, 'corruption') ? 0 : city(s, p).filter(c => ['WHITE', 'BLACK'].includes(duelCard(c.definitionId).color)).length;
        return { total: n, printed: n, trade: 0, purchases: {}, method: n ? 'RESOURCES' : 'FREE', detail: hasProgress(s, p, 'corruption') ? '부패: 의원 무료 고용' : `이미 고용한 의원 ${n}명` };
    }
    const pool = city(s, p).concat(hasDecree(s, p, 15) ? city(s, other(p)) : []).map(c => duelCard(c.definitionId));
    if (isCard && d.chainIn && (pool.some(c => c.chainOut === d.chainIn) || d.mythology && (s.players[p]!.mythology.includes(d.mythology) || hasDecree(s, p, 15) && s.players[other(p)]!.mythology.includes(d.mythology))))
        return { total: 0, printed: 0, trade: 0, purchases: {}, method: 'CHAIN', detail: '보유 연계 기호로 무료 건설' };
    const discount = (isCard ? (d.color === 'BLUE' && hasProgress(s, p, 'masonry') ? 2 : 0) : (hasProgress(s, p, 'architecture') ? 2 : 0) + (hasDecree(s, p, 8) ? 1 : 0));
    const printed = isCard ? d.coins : 0;
    let best = priced(s, p, d.cost, printed, discount);
    const colorDecree = isCard ? ({ YELLOW: 5, RED: 6, GREEN: 7 } as Partial<Record<string, number>>)[d.color] : undefined;
    if (colorDecree && hasDecree(s, p, colorDecree)) {
        const resource = priced(s, p, d.cost, printed, discount + 1), money = priced(s, p, d.cost, 0, discount);
        best = resource.total < best.total ? resource : best;
        best = money.total < best.total ? money : best;
    }
    if (isCard && d.chainIn && hasProgress(s, p, 'engineering') && best.total > 1)
        return { total: 1, printed: 1, trade: 0, purchases: {}, method: 'ENGINEERING', detail: '공학: 연계 기호가 있는 건물 1코인 (연쇄 보너스 없음)' };
    return best;
}
export function godCost(s: DuelState, p: DuelSeat, slot: number, offering: number): number { const normal = p === 0 ? 3 + slot : 8 - slot; return Math.max(0, normal * (s.pantheon[slot] === 'gate' ? 2 : 1) - (s.wonders.some(w => w.owner === p && w.id === 'wonder-sanctuary' && w.built && !w.removed) ? 2 : 0) - offering); }
export function countType(s: DuelState, p: DuelSeat, type: string): number {
    if (type === 'WONDER')
        return s.wonders.filter(w => w.owner === p && w.built && !w.removed).length;
    if (type === 'COINS')
        return Math.floor(s.players[p]!.coins / 3);
    return city(s, p).filter(c => type === 'RESOURCES' ? ['BROWN', 'GREY'].includes(duelCard(c.definitionId).color) : duelCard(c.definitionId).color === type).length;
}
export function scores(s: DuelState) {
    return s.players.map((p, i) => {
        const seat = i === 0 ? 0 : 1;
        const cards = city(s, seat).map(c => duelCard(c.definitionId));
        const sum = (color: string) => cards.filter(c => c.color === color).reduce((n, c) => n + c.points, 0);
        const green = sum('GREEN'), blue = sum('BLUE'), yellow = sum('YELLOW');
        const guild = cards.reduce((n, c) => n + (c.guild ? Math.max(countType(s, 0, c.guild), countType(s, 1, c.guild)) * (c.guild === 'WONDER' ? 2 : 1) : 0), 0);
        const wonders = s.wonders.filter(w => w.owner === seat && w.built && !w.removed).reduce((n, w) => n + duelWonder(w.id).points, 0);
        const progress = (hasProgress(s, seat, 'agriculture') ? 4 : 0) + (hasProgress(s, seat, 'philosophy') ? 7 : 0) + (hasProgress(s, seat, 'mathematics') ? 3 * s.progress.filter(t => t.zone === 'PLAYER' && t.owner === seat).length : 0) + (hasProgress(s, seat, 'mysticism') ? 2 * (p.mythology.length + p.offerings.length) : 0);
        const coins = Math.floor(p.coins / 3), advantage = s.military * (seat === 0 ? 1 : -1), military = advantage >= 6 ? 10 : advantage >= 3 ? 5 : advantage > 0 ? 2 : 0;
        const gods = (p.gods.includes('aphrodite') ? 9 : 0) + p.protectedCoins, nTemples = cards.filter(c => c.color === 'TEMPLE').length, temples = [0, 5, 12, 21][nTemples] ?? 21;
        const senate = s.settings.agora ? [1, 2, 3, 3, 2, 1].reduce((n, v, ch) => n + (controller(s, ch) === seat ? v : 0), 0) : 0;
        return { playerId: p.playerId, green, blue, yellow, guild, wonders, progress, coins, military, gods, temples, senate, total: green + blue + yellow + guild + wonders + progress + coins + military + gods + temples + senate };
    });
}
