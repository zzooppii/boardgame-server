import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, TurnIdSchema, ArnakPublicFields, ArnakResultSchema, ArnakPlayerPublicSchema, ArnakCardSchema, ArnakTravelSchema, ArnakActionSchema, ArnakRefSchema, ARNAK_CARDS, ARNAK_RESOURCES, ARNAK_SITES, ARNAK_GUARDIANS, ARNAK_ASSISTANTS, ARNAK_IDOLS, ARNAK_IDOL_REWARDS, ARNAK_RESEARCH, ARNAK_RESEARCH_EFFECTS, ARNAK_REWARD_EFFECTS, ARNAK_IDOL_EFFECTS, ARNAK_TEMPLE_COSTS, arnakResources, arnakCard, arnakEffect, arnakSite, arnakGuardian, arnakAssistant, arnakResearch, arnakCostText, type ArnakResources, type ArnakTravel, type ArnakOffer, type ArnakAction, type GameId, type PlayerId, type TileId, type ServerTime, type TurnId } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
const Player = v.strictObject({ ...ArnakPlayerPublicSchema.entries, hand: v.array(ArnakCardSchema), deck: v.array(ArnakCardSchema), keep: v.array(ArnakRefSchema), travel: v.array(ArnakTravelSchema), planeRound: v.boolean(), noFear: v.boolean() });
const Job = v.strictObject({ effect: ArnakRefSchema, label: ArnakRefSchema, context: v.string() });
const { playerStates: _players, itemDeckCount: _items, artifactDeckCount: _artifacts, pendingLabels: _pending, ...Fields } = ArnakPublicFields;
const State = v.strictObject({ gameId: GameIdSchema, revision: GameRevisionSchema, rulesVersion: v.literal('arnak-bird-v1'), startedAt: ServerTimeSchema, finishedAt: v.nullable(ServerTimeSchema), phase: v.picklist(['PLAYING', 'FINISHED']), transitionId: TurnIdSchema, players: v.array(Player), ...Fields, itemDeck: v.array(ArnakCardSchema), artifactDeck: v.array(ArnakCardSchema), fearDeck: v.array(ArnakCardSchema), exiled: v.array(ArnakCardSchema), siteDeck1: v.array(ArnakRefSchema), siteDeck2: v.array(ArnakRefSchema), guardianDeck: v.array(ArnakRefSchema), jobs: v.array(Job), peek: v.array(ArnakCardSchema), inventory: v.array(ArnakCardSchema), result: v.nullable(ArnakResultSchema) });
export type ArnakState = v.InferOutput<typeof State>;
type Person = ArnakState['players'][number];
type Choice = {
    offer: ArnakOffer;
    apply(): void;
};
function shuffled<T>(a: readonly T[], r: RandomSource): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) {
    const j = r.nextInt(i + 1);
    [b[i], b[j]] = [b[j]!, b[i]!];
} return b; }
function sync(s: ArnakState) { for (const p of s.players) {
    p.handCount = p.hand.length;
    p.deckCount = p.deck.length;
} }
export function parseArnakState(input: unknown): ArnakState {
    const s = v.parse(State, input), ids = s.players.map(p => p.playerId), cards = [...s.itemDeck, ...s.artifactDeck, ...s.fearDeck, ...s.exiled, ...s.market, ...s.peek, ...s.players.flatMap(p => [...p.hand, ...p.deck, ...p.played])];
    if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || !ids.includes(s.activePlayerId) || !ids.includes(s.startingPlayerId) || cards.length !== s.inventory.length || new Set(cards.map(c => c.tileId)).size !== cards.length || cards.some(c => !s.inventory.some(i => i.tileId === c.tileId && i.definitionId === c.definitionId)))
        throw new Error('Invalid Arnak inventory');
    for (const p of s.players) {
        if (p.handCount !== p.hand.length || p.deckCount !== p.deck.length || p.workers + s.sites.reduce((n, site) => n + site.occupants.filter(id => id === p.playerId).length, 0) !== 2 || arnakResearch(p.notebook).row > arnakResearch(p.magnifier).row || p.idolSlots > p.idols)
            throw new Error('Invalid Arnak player');
    }
    if (s.sites.some(t => t.travel.length !== t.occupants.length || t.blocked.length !== t.travel.length || t.occupants.some(id => id !== null && !ids.includes(id))))
        throw new Error('Invalid Arnak site');
    if ((s.phase === 'FINISHED') !== (s.finishedAt !== null && s.result !== null) || s.phase==='PLAYING'&&(s.finishedAt!==null||s.result!==null))
        throw new Error('Invalid Arnak lifecycle');
    const guardians=[...s.guardianDeck,...s.sites.flatMap(t=>t.guardianId?[t.guardianId]:[]),...s.players.flatMap(p=>p.guardians.map(g=>g.definitionId))];
    if(guardians.length!==15||new Set(guardians).size!==15)throw new Error('Invalid guardian inventory');
    for(const id of guardians)arnakGuardian(id);
    for(const site of s.sites)if(site.definitionId&&arnakSite(site.definitionId).level!==site.level)throw new Error('Invalid site level');
    for (const c of cards)
        arnakCard(c.definitionId);
    return s;
}
export function createArnakGame(input: {
    generateTileId(): TileId;
    gameId: GameId;
    playerIds: readonly PlayerId[];
    now: ServerTime;
    turnId: TurnId;
    random: RandomSource;
}): ArnakState {
    const r = input.random, n = input.playerIds.length;
    if (n < 2 || n > 4 || new Set(input.playerIds).size !== n)
        throw new Error('Arnak requires 2–4 players');
    const make = (definitionId: string) => ({ tileId: input.generateTileId(), definitionId });
    const itemDeck = shuffled(ARNAK_CARDS.filter(c => c.type === 'item').map(c => make(c.id)), r), artifactDeck = shuffled(ARNAK_CARDS.filter(c => c.type === 'artifact').map(c => make(c.id)), r), fearDeck = Array.from({ length: 19 }, () => make('fear'));
    const first = r.nextInt(n), order = [...input.playerIds.slice(first), ...input.playerIds.slice(0, first)];
    const players = order.map((playerId, i) => { const deck = shuffled([...['funding-car', 'funding-boat', 'exploration-car', 'exploration-boat'].map(make), ...fearDeck.splice(0, 2)], r), hand = deck.splice(0, 5); return { playerId, resources: arnakResources([{ coin: 2 }, { coin: 1, compass: 1 }, { coin: 2, compass: 1 }, { coin: 1, compass: 2 }][i]), workers: 2, handCount: hand.length, deckCount: deck.length, hand, deck, keep: [], played: [], assistants: [], guardians: [], idols: 0, idolSlots: 0, magnifier: '0', notebook: '0', templePoints: 0, fearTiles: 0, passed: false, travel: [], planeRound: false, noFear: false }; });
    const blocked = new Set(n === 2 ? [0, 1, 2, 3, 4] : n === 3 ? shuffled([0, 1, 2, 3, 4], r).slice(0, 3) : []), idols = shuffled(ARNAK_IDOLS, r);
    const sites: ArnakState['sites'] = Array.from({ length: 5 }, (_, i) => ({ id: 'base-' + i, level: 0, definitionId: 'base-' + i, guardianId: null, travel: [['foot'], ['foot', 'foot']], occupants: [null, null], blocked: [false, blocked.has(i)], idolReward: null, idolCount: 0 }));
    for (let level = 1; level <= 2; level++)
        for (let i = 0; i < (level === 1 ? 8 : 4); i++)
            sites.push({ id: 'region-' + level + '-' + i, level: level === 1 ? 1 : 2, definitionId: null, guardianId: null, travel: level === 1 ? [[i % 4 < 2 ? 'car' : 'boat']] : [[i < 2 ? 'car' : 'boat', i < 2 ? 'car' : 'boat']], occupants: [null], blocked: [false], idolReward: idols.pop()!, idolCount: level });
    const bonuses = shuffled(Object.keys(ARNAK_REWARD_EFFECTS).flatMap(k => [k, k, k]), r), researchBonuses: Record<string, string> = {};
    for (const node of ARNAK_RESEARCH)
        if ([2, 4, 6].includes(node.row) || (node.row === 3 || node.row === 5) && n === 4 || node.row === 7 && n >= 3)
            researchBonuses[node.id] = bonuses.pop()!;
    const market = [...artifactDeck.splice(0, 1), ...itemDeck.splice(0, 5)], inventory = [...itemDeck, ...artifactDeck, ...fearDeck, ...market, ...players.flatMap(p => [...p.deck, ...p.hand])];
    const assistants = shuffled(ARNAK_ASSISTANTS.map(a => a.id), r);
    return parseArnakState({ gameId: input.gameId, revision: 0, rulesVersion: 'arnak-bird-v1', startedAt: input.now, finishedAt: null, phase: 'PLAYING', transitionId: input.turnId, players, activePlayerId: order[0], startingPlayerId: order[0], round: 1, mainActionUsed: false, stage: 'ACTION', sites, market, itemDeck, artifactDeck, fearDeck, exiled: [], siteDeck1: shuffled(ARNAK_SITES.filter(d => d.level === 1).map(d => d.id), r), siteDeck2: shuffled(ARNAK_SITES.filter(d => d.level === 2).map(d => d.id), r), guardianDeck: shuffled(ARNAK_GUARDIANS.map(g => g.id), r), assistantSupply: [assistants.slice(0, 4), assistants.slice(4, 8), assistants.slice(8)], researchBonuses, templeRewards: bonuses.slice(0, n), templeSupply: Array<number>(6).fill(n), templeArrival: [], history: [], jobs: [], peek: [], inventory, result: null });
}
function canPay(p: Person, c: ArnakResources) { return ARNAK_RESOURCES.every(k => p.resources[k] >= c[k]); }
function pay(p: Person, c: ArnakResources) { for (const k of ARNAK_RESOURCES)
    p.resources[k] -= c[k]; }
function gain(p: Person, c: Partial<ArnakResources>) { for (const k of ARNAK_RESOURCES)
    p.resources[k] += c[k] ?? 0; }
function enqueue(s: ArnakState, ids: readonly string[], label: string, context = '', front = false) { const jobs = ids.map(effect => ({ effect, label, context })); if (front)
    s.jobs.unshift(...jobs);
else
    s.jobs.push(...jobs); }
function draw(p: Person, n = 1, bottom = false) { p.hand.push(...(bottom ? p.deck.splice(Math.max(0, p.deck.length - n), n) : p.deck.splice(0, n))); }
function fear(s: ArnakState, p: Person) { const c = s.fearDeck.shift(); if (c)
    p.played.push(c);
else
    p.fearTiles++; }
function refill(s: ArnakState) { while (s.market.filter(c => arnakCard(c.definitionId).type === 'artifact').length < s.round && s.artifactDeck.length) {
    const index = s.market.findIndex(c => arnakCard(c.definitionId).type === 'item');
    s.market.splice(index < 0 ? s.market.length : index, 0, s.artifactDeck.shift()!);
} while (s.market.length < 6 && s.itemDeck.length)
    s.market.push(s.itemDeck.shift()!); }
function nextTurn(s: ArnakState, now: ServerTime, r: RandomSource) {
    refill(s);
    const p = s.players.find(p => p.playerId === s.activePlayerId)!;
    p.travel = [];
    s.mainActionUsed = false;
    s.stage = 'ACTION';
    if (s.players.every(p => p.passed)) {
        for (const player of s.players) {
            if (!player.noFear)
                for (const site of s.sites)
                    if (site.guardianId)
                        for (const id of site.occupants)
                            if (id === player.playerId)
                                fear(s, player);
            player.workers = 2;
        }
        for (const site of s.sites)
            site.occupants.fill(null);
        if (s.round === 5) {
            s.phase = 'FINISHED';
            s.finishedAt = now;
            const scores = s.players.map(p => scoreArnak(p, s));
            const max = Math.max(...scores.map(p => p.total));
            const tied = scores.filter(p => p.total === max);
            const arrival = s.templeArrival.find(id => tied.some(t => t.playerId === id));
            const best = Math.max(...tied.map(t => t.research));
            s.result = { reason: 'SCORED', scores, winnerPlayerIds: arrival ? [arrival] : tied.filter(t => t.research === best).map(t => t.playerId) };
            return;
        }
        for (const player of s.players) {
            const discard = player.hand.filter(c => !player.keep.includes(c.tileId));
            player.hand = player.hand.filter(c => player.keep.includes(c.tileId));
            player.deck.push(...shuffled([...player.played, ...discard], r));
            player.played = [];
            player.keep = [];
            player.passed = false;
            player.noFear = false;
            player.planeRound = false;
            player.travel = [];
            for (const a of player.assistants)
                a.ready = true;
            draw(player, Math.max(0, 5 - player.hand.length));
        }
        const left = s.market.map(c => arnakCard(c.definitionId).type).lastIndexOf('artifact'), right = s.market.findIndex(c => arnakCard(c.definitionId).type === 'item');
        s.exiled.push(...s.market.filter((_, i) => i === left || i === right));
        s.market = s.market.filter((_, i) => i !== left && i !== right);
        s.round++;
        refill(s);
        s.startingPlayerId = s.players[(s.players.findIndex(p => p.playerId === s.startingPlayerId) + 1) % s.players.length]!.playerId;
        s.activePlayerId = s.startingPlayerId;
    }
    else {
        let index = s.players.indexOf(p);
        do {
            index = (index + 1) % s.players.length;
        } while (s.players[index]!.passed);
        s.activePlayerId = s.players[index]!.playerId;
    }
}
export function scoreArnak(p: Person, s: ArnakState) { const research = ([0, 1, 2, 4, 6, 9, 12, 16, 0][arnakResearch(p.magnifier).row] ?? 0) + ([0, 0, 1, 2, 4, 6, 8, 10][arnakResearch(p.notebook).row] ?? 0) + (s.templeArrival.includes(p.playerId) ? [23, 21, 20, 19][s.templeArrival.indexOf(p.playerId)]! : 0), temple = p.templePoints, guardians = p.guardians.length * 5, idols = p.idols * 3, slots = [1, 2, 3, 4].slice(p.idolSlots).reduce((a, b) => a + b, 0), cards = [...p.hand, ...p.deck, ...p.played].reduce((n, c) => n + Math.max(0, arnakCard(c.definitionId).points), 0), fear = [...p.hand, ...p.deck, ...p.played].filter(c => c.definitionId === 'fear').length + p.fearTiles * 2; return { playerId: p.playerId, research, temple, guardians, idols, slots, cards, fear, total: research + temple + guardians + idols + slots + cards - fear }; }
type Payment = {
    cards: TileId[];
    coins: number;
    remaining: ArnakTravel[];
};
function payments(p: Person, needs: readonly ArnakTravel[], extra: readonly ArnakTravel[] = []): Payment[] {
    const out: Payment[] = [], seen = new Set<string>();
    function search(left: readonly ArnakTravel[], pool: ArnakTravel[], used: TileId[], coins: number) {
        if (!left.length) {
            const key = [...used].sort().join() + ':' + coins + ':' + [...pool].sort().join();
            if (!seen.has(key)) {
                seen.add(key);
                out.push({ cards: used, coins, remaining: pool });
            }
            return;
        }
        const need = left[0]!;
        for (let i = 0; i < pool.length; i++)
            if (pool[i] === 'plane' || pool[i] === need || need === 'foot')
                search(left.slice(1), pool.filter((_, j) => i !== j), used, coins);
        for (const card of p.hand)
            if (!used.includes(card.tileId)) {
                const icons = arnakCard(card.definitionId).travel.map(t => p.planeRound ? 'plane' as const : t);
                for (let i = 0; i < icons.length; i++)
                    if (icons[i] === 'plane' || icons[i] === need || need === 'foot')
                        search(left.slice(1), [...pool, ...icons.filter((_, j) => j !== i)], [...used, card.tileId], coins);
            }
        if (coins + 2 <= p.resources.coin)
            search(left.slice(1), pool, used, coins + 2);
    }
    search(needs, [...p.travel, ...extra], [], 0);
    return out;
}
function spendTravel(p: Person, payment: Payment) { p.resources.coin -= payment.coins; p.travel = payment.remaining; for (const id of payment.cards) {
    const index = p.hand.findIndex(c => c.tileId === id);
    p.played.push(...p.hand.splice(index, 1));
} }
function effectLabel(id: string): string { const e = arnakEffect(id); if (e.kind === 'gain')
    return arnakCostText(e.value ?? {}); return ({ draw: '카드 뽑기', exile: '카드 제거', discard: '손패 버리기', fear: '공포 받기', trade: '자원 교환', travel: '이동 수단', assistant: '조수 선택', upgrade: '조수 승급', refresh: '조수 준비', resourceUpgrade: '자원 강화', buy: '카드 획득', research: '연구', activate: '장소 효과', deploy: '탐험가 배치', relocate: '탐험가 이동', overcome: '수호자 극복', special: '추가 효과', peekKeep: '카드 선택', peekReturn: '덱에 되돌리기', choice: '보상 선택', payTravel: '이동 비용 지불' } as const)[e.kind]; }
function choices(s: ArnakState, now: ServerTime, r: RandomSource): Choice[] {
    if (s.phase !== 'PLAYING')
        return [];
    const p = s.players.find(p => p.playerId === s.activePlayerId)!, out: Choice[] = [];
    function add(kind: ArnakOffer['kind'], targetId: string, label: string, fn: () => void, cost = arnakResources(), cards: TileId[] = [], free = true, detail = '') {
        if (!canPay(p, cost))
            return;
        out.push({ offer: { id: 'action-' + out.length, kind, targetId, label, detail, cost, cards, free }, apply: () => { pay(p, cost); fn(); } });
    }
    function effects(ids: readonly string[], label: string, context = '') { enqueue(s, ids, label, context, true); }
    function buyCards(mode: string, discount: number, done: () => void, kind: ArnakOffer['kind'] = 'BUY', free = false) {
        const candidates = mode === 'exiled' ? s.exiled.filter(c => arnakCard(c.definitionId).type === 'item') : s.market;
        for (const c of candidates) {
            const d = arnakCard(c.definitionId);
            if (mode.startsWith('item') && d.type !== 'item' || mode.startsWith('artifact') && d.type !== 'artifact')
                continue;
            const cost = arnakResources({ [d.type === 'item' ? 'coin' : 'compass']: Math.max(0, d.cost - discount) });
            add(kind, c.tileId, d.name + ' 획득', () => { done(); const source = mode === 'exiled' ? s.exiled : s.market; source.splice(source.findIndex(t => t.tileId === c.tileId), 1); if (d.type === 'artifact') {
                p.played.push(c);
                effects(d.effects, d.name);
            }
            else if (mode === 'item-hand')
                p.hand.push(c);
            else if (mode === 'item-top')
                p.deck.unshift(c);
            else
                p.deck.push(c); if (mode !== 'exiled')
                refill(s); }, cost, [], free, `${d.points}점 · ${d.type === 'artifact' ? '즉시 효과 적용' : '덱 아래에 놓기'}`);
        }
    }
    function sites(level: number, mode: string, done: () => void) { for (const site of s.sites) {
        if (!site.definitionId || site.level > level || (mode === 'unoccupied' && site.occupants.some(Boolean)) || (mode === 'own' && !site.occupants.includes(p.playerId)))
            continue;
        add('EFFECT', site.id, arnakSite(site.definitionId).name + ' 활성화', () => { done(); effects(arnakSite(site.definitionId!).effects, '장소 효과'); });
    } }
    function deploy(discount: number, extra: readonly ArnakTravel[], level: number, done: (siteId: string) => void, excluded = '') {
        if (!p.workers)
            return;
        for (const site of s.sites) {
            if (site.level > level || site.id === excluded)
                continue;
            for (let slot = 0; slot < site.occupants.length; slot++) {
                if (site.occupants[slot] || site.blocked[slot])
                    continue;
                const cost = arnakResources({ compass: site.definitionId ? 0 : Math.max(0, (site.level === 1 ? 3 : 6) - discount) });
                for (const payment of payments(p, site.travel[slot]!, extra)) {
                    const total = { ...cost, coin: cost.coin + payment.coins };
                    add(site.definitionId ? 'DIG' : 'DISCOVER', site.id, site.definitionId ? arnakSite(site.definitionId).name + ' 발굴' : `${site.level}단계 유적 발견`, () => { done(site.id); spendTravel(p, { ...payment, coins: 0 }); p.workers--; site.occupants[slot] = p.playerId; if (!site.definitionId) {
                        site.definitionId = (site.level === 1 ? s.siteDeck1 : s.siteDeck2).shift()!;
                        p.idols += site.idolCount;
                        site.idolCount = 0;
                        const reward = site.idolReward;
                        site.idolReward = null;
                        enqueue(s, ['@guardian'], '수호자 등장', site.id, true);
                        effects(arnakSite(site.definitionId).effects, '새 유적');
                        if (reward)
                            effects(ARNAK_IDOL_REWARDS[reward] ?? [], '우상 보상');
                    }
                    else
                        effects(arnakSite(site.definitionId).effects, '장소 효과'); }, total, payment.cards, false, `이동: ${site.travel[slot]!.join(' · ')}${payment.coins ? ' · 비행기 대체 금화 ' + payment.coins : ''}`);
                }
            }
        }
    }
    function research(mode: string, discount: Partial<ArnakResources>, freeAll: boolean, done: () => void) {
        for (const token of ['magnifier', 'notebook'] as const) {
            if (mode === 'notebook' && token !== 'notebook')
                continue;
            for (const node of ARNAK_RESEARCH) {
                if (!(node.from as readonly string[]).includes(p[token]) || token === 'notebook' && (node.row === 8 || node.row > arnakResearch(p.magnifier).row))
                    continue;
                const cost = arnakResources();
                for (const k of ARNAK_RESOURCES)
                    cost[k] = freeAll ? 0 : Math.max(0, node.cost[k] - (discount[k] ?? 0));
                add('RESEARCH', node.id, `${token === 'magnifier' ? '돋보기' : '수첩'} 연구 → ${node.row}`, () => { done(); p[token] = node.id; if (node.row === 8) {
                    s.templeArrival.push(p.playerId);
                    if (s.templeRewards.length)
                        enqueue(s, ['@temple'], '사원 보너스 선택', '', true);
                }
                else {const bonus=s.researchBonuses[node.id];if(bonus){delete s.researchBonuses[node.id];enqueue(s,['@research-order'],'연구 보상 순서',token+'|'+node.row+'|'+bonus,true);}else effects(ARNAK_RESEARCH_EFFECTS[token]?.[node.row-1]??[],'연구 보상');}
                }, cost, [], false,node.row===8?'사원 도착 점수와 보너스':(ARNAK_RESEARCH_EFFECTS[token]?.[node.row-1]??[]).map(effectLabel).join(' · '));
            }
        }
    }
    function overcome(mode: string, free: boolean, done: () => void) {
        for (const site of s.sites) {
            if (!site.guardianId || mode !== 'no-opponent' && !site.occupants.includes(p.playerId) || mode === 'no-opponent' && site.occupants.some(id => id !== null && id !== p.playerId))
                continue;
            const g = arnakGuardian(site.guardianId);
            for (const payment of free ? [{ cards: [], coins: 0, remaining: p.travel }] : payments(p, g.travel)) {
                const cost = free ? arnakResources() : { ...g.cost, coin: g.cost.coin + payment.coins };
                if (!free && g.discard) {
                    for (const card of p.hand.filter(c => !payment.cards.includes(c.tileId)))
                        add('GUARDIAN', site.id, g.name + ' 극복 · ' + arnakCard(card.definitionId).name + ' 버리기', () => { done(); spendTravel(p, { ...payment, coins: 0 }); p.played.push(...p.hand.splice(p.hand.findIndex(c => c.tileId === card.tileId), 1)); p.guardians.push({ definitionId: g.id, used: false }); site.guardianId = null; }, cost, [...payment.cards, card.tileId], false, '수호자 5점과 축복');
                }
                else
                    add('GUARDIAN', site.id, g.name + ' 극복', () => { done(); spendTravel(p, { ...payment, coins: 0 }); p.guardians.push({ definitionId: g.id, used: false }); site.guardianId = null; }, cost, payment.cards, false, '수호자 5점과 축복');
            }
        }
    }
    if (s.stage === 'CLEANUP') {
        for (const card of p.hand)
            add('KEEP', card.tileId, p.keep.includes(card.tileId) ? '다음 라운드에 버리기' : '다음 라운드까지 보관', () => { p.keep = p.keep.includes(card.tileId) ? p.keep.filter(id => id !== card.tileId) : [...p.keep, card.tileId]; });
        add('PASS', 'pass', '패스 확정', () => { p.passed = true; nextTurn(s, now, r); }, undefined, undefined, false, '선택한 카드를 보관하고 이번 라운드를 마칩니다');
        return out;
    }
    const job = s.jobs[0];
    if (job) {
        const done = () => { s.jobs.shift(); };
        if (job.effect === '@guardian')
            add('EFFECT', job.context, '수호자 공개', () => { done(); s.sites.find(t => t.id === job.context)!.guardianId = s.guardianDeck.shift() ?? null; });
        else if (job.effect === '@temple') {
            for (const [i, reward] of s.templeRewards.entries())
                add('EFFECT', 'temple', '사원 보너스 · ' + effectLabel(ARNAK_REWARD_EFFECTS[reward]!), () => { done(); s.templeRewards.splice(i, 1); effects([ARNAK_REWARD_EFFECTS[reward]!], '사원 보상'); });
        }
        else if (job.effect === '@pass')
            add('PASS', 'pass', '라운드 패스', () => { done(); s.stage = 'CLEANUP'; }, undefined, undefined, false);
        else if (job.effect === '@peek') {
            for (const card of s.peek)
                add('EFFECT', card.tileId, arnakCard(card.definitionId).name + ' 손패로', () => { done(); s.peek.splice(s.peek.indexOf(card), 1); p.hand.push(card); if (job.context === 'crystal' && s.peek.length)
                    enqueue(s, ['@return'], '덱 위로 되돌릴 카드', '', true);
                else
                    p.played.push(...s.peek.splice(0)); });
            if (!s.peek.length)
                add('EFFECT', 'skip', '뽑을 카드 없음', done);
        }
        else if (job.effect === '@return') {
            for (const card of s.peek)
                add('EFFECT', card.tileId, arnakCard(card.definitionId).name + ' 덱 위로', () => { done(); s.peek.splice(s.peek.indexOf(card), 1); p.deck.unshift(card); p.played.push(...s.peek.splice(0)); });
            add('EFFECT', 'skip', '모두 사용한 카드 더미로', () => { done(); p.played.push(...s.peek.splice(0)); });
        }
        else if(job.effect==='@research-order'){const [token,row,bonus]=job.context.split('|'),normal=ARNAK_RESEARCH_EFFECTS[token!]?.[Number(row)-1]??[],bonusEffect=ARNAK_REWARD_EFFECTS[bonus!]!;add('EFFECT','research-reward','연구 보상 먼저',()=>{done();effects([bonusEffect],'선착순 보너스');effects(normal,'연구 보상');});add('EFFECT','research-reward','선착순 보너스 먼저',()=>{done();effects(normal,'연구 보상');effects([bonusEffect],'선착순 보너스');});}
        else if (job.effect === '@hammer') {
            buyCards('exiled', 99, done, 'EFFECT', true);
            add('EFFECT', 'skip', '획득하지 않기', done);
        }
        else if (job.effect === '@second-base') {
            for (const site of s.sites.filter(t => t.level === 0 && t.id !== job.context))
                add('EFFECT', site.id, arnakSite(site.definitionId!).name + ' 활성화', () => { done(); effects(arnakSite(site.definitionId!).effects, '두 번째 장소'); });
        }
        else if (job.effect === '@second-deploy') {
            deploy(99, ['plane', 'plane'], 0, done, job.context);
            add('EFFECT', 'skip', '두 번째 배치 생략', done);
        }
        else if (job.effect === '@peek-buy') {
            buyCards(job.context.split('|')[0]!, 3, done, 'EFFECT', true);
            add('EFFECT', 'skip', '구매하지 않기', () => { done(); const id = job.context.split('|')[1], index = s.market.findIndex(c => c.tileId === id); if (index >= 0) {
                const card = s.market.splice(index, 1)[0]!;
                (arnakCard(card.definitionId).type === 'item' ? s.itemDeck : s.artifactDeck).unshift(card);
            } refill(s); });
        }
        else if (job.effect === '@knife') {
            const used = job.context.split(',').filter(Boolean);
            for (const [key, value] of [['coin', { coin: 1 }], ['compass', { compass: 1 }], ['tablet', { tablet: 1 }]] as const)
                if (!used.includes(key))
                    add('EFFECT', 'knife', arnakCostText(value), () => { done(); gain(p, value); if (used.length === 0)
                        enqueue(s, ['@knife'], '다용도 칼 두 번째 선택', key, true); });
            if (!used.includes('exile'))
                add('EFFECT', 'knife', '카드 제거', () => { done(); if (!used.length)
                    enqueue(s, ['@knife'], '다용도 칼 두 번째 선택', 'exile', true); effects(['reward-exile/0'], '다용도 칼'); });
        }
        else if (job.effect === '@two-base') {
            sites(0, 'any', () => { done(); });
        }
        else {
            const e = arnakEffect(job.effect), after = () => { done(); if (e.after)
                effects(e.after.map((_, i) => job.effect + '/after/' + i), job.label); };
            switch (e.kind) {
                case 'gain':
                    add('EFFECT', 'reward', arnakCostText(e.value ?? {}), () => { after(); gain(p, e.value ?? {}); });
                    break;
                case 'draw':
                    add('EFFECT', 'draw', `카드 ${Math.min(e.amount ?? 1, p.deck.length)}장 뽑기`, () => { after(); draw(p, e.amount ?? 1, e.mode === 'bottom'); });
                    break;
                case 'fear':
                    add('EFFECT', 'fear', '공포 받고 효과 적용', () => { after(); fear(s, p); });
                    break;
                case 'travel':
                    add('EFFECT', 'travel', '이동 수단 받기', () => { after(); p.travel.push(...(e.travel ?? [])); });
                    break;
                case 'trade':
                    add('EFFECT', 'trade', '비용 지불하고 교환', after, arnakResources(e.cost));
                    break;
                case 'payTravel':
                    for (const payment of payments(p, e.travel ?? []))
                        add('EFFECT', 'travel', '이동 비용 지불', () => { after(); spendTravel(p, { ...payment, coins: 0 }); }, arnakResources({ coin: payment.coins }), payment.cards);
                    break;
                case 'discard':
                case 'exile': {
                    const source = e.kind === 'discard' ? p.hand : [...p.hand, ...p.played];
                    for (const card of source)
                        add('EFFECT', card.tileId, arnakCard(card.definitionId).name + (e.kind === 'discard' ? ' 버리기' : ' 제거'), () => { after(); const from = p.hand.includes(card) ? p.hand : p.played; from.splice(from.indexOf(card), 1); if (e.kind === 'discard')
                            p.played.push(card);
                        else if (card.definitionId === 'fear')
                            s.fearDeck.push(card);
                        else
                            s.exiled.push(card); });
                    if (e.kind === 'exile' && p.fearTiles)
                        add('EFFECT', 'fear-tile', '공포 타일 제거', () => { after(); p.fearTiles--; });
                    break;
                }
                case 'choice':
                    for (const [i, option] of (e.choices ?? []).entries())
                        add('EFFECT', 'choice', option.map((_, j) => effectLabel(job.effect + '/choice/' + i + '/' + j)).join(' + '), () => { done(); effects(option.map((_, j) => job.effect + '/choice/' + i + '/' + j), job.label); });
                    break;
                case 'resourceUpgrade':
                    for (const [a, b] of [['tablet', 'arrow'], ['arrow', 'jewel']] as const)
                        add('EFFECT', 'upgrade', `${a} → ${b}`, () => { after(); gain(p, { [b]: 1 }); }, arnakResources({ [a]: 1 }));
                    break;
                case 'refresh':
                    for (const a of p.assistants)
                        if (!a.ready)
                            add('EFFECT', a.definitionId, arnakAssistant(a.definitionId).name + ' 준비', () => { after(); a.ready = true; });
                    break;
                case 'upgrade':
                    for (const a of p.assistants)
                        if (!a.gold)
                            add('EFFECT', a.definitionId, arnakAssistant(a.definitionId).name + ' 승급', () => { after(); a.gold = true; a.ready = true; });
                    break;
                case 'assistant': {
                    for (const [i, stack] of s.assistantSupply.entries()) {
                        const id = stack[0];
                        if (!id)
                            continue;
                        const a = arnakAssistant(id);
                        if (e.mode === 'exchange') {
                            for (const old of p.assistants)
                                add('EFFECT', id, arnakAssistant(old.definitionId).name + ' → ' + a.name, () => { after(); stack.shift(); stack.push(old.definitionId); old.definitionId = id; old.ready = true; });
                        }
                        else if (e.mode === 'take') {
                            if (p.assistants.length < 2)
                                add('EFFECT', id, a.name + ' 고용', () => { after(); s.assistantSupply[i]!.shift(); p.assistants.push({ definitionId: id, gold: false, ready: true }); });
                        }
                        else
                            add('EFFECT', id, a.name + ' 능력 복사', () => { after(); effects(e.mode === 'gold-copy' ? a.gold : a.silver, a.name); });
                    }
                    break;
                }
                case 'buy': {
                    if (e.mode?.endsWith('-peek')) {
                        add('EFFECT', 'peek', '덱 맨 위 카드 공개', () => { done(); const deck = e.mode?.startsWith('item') ? s.itemDeck : s.artifactDeck, card = deck.shift(); if (card) {
                            const index = s.market.findIndex(c => arnakCard(c.definitionId).type === 'item');
                            if (e.mode?.startsWith('artifact'))
                                s.market.splice(index < 0 ? s.market.length : index, 0, card);
                            else
                                s.market.push(card);
                        } enqueue(s, ['@peek-buy'], job.label, e.mode!.split('-')[0] + '|' + (card?.tileId ?? ''), true); });
                    }
                    else
                        buyCards(e.mode ?? 'either', e.amount ?? 0, after, 'EFFECT', true);
                    break;
                }
                case 'activate':
                    if (e.mode === 'stack') {
                        const deck = e.level === 2 ? s.siteDeck2 : s.siteDeck1;
                        if (deck.length)
                            add('EFFECT', 'site-stack', '미발견 장소 효과 공개', () => { done(); const id = deck.shift()!; deck.push(id); effects(arnakSite(id).effects, '장소 효과'); });
                    }
                    else
                        sites(e.level ?? 2, e.mode ?? 'any', after);
                    break;
                case 'deploy':
                    deploy(e.amount ?? 0, e.travel ?? [], e.level ?? 2, siteId => { after(); if (e.mode === 'twice')
                        enqueue(s, ['@second-deploy'], job.label, siteId, true); });
                    break;
                case 'research':
                    research(e.mode ?? '', e.value ?? {}, (e.amount ?? 0) >= 99, after);
                    break;
                case 'overcome':
                    overcome(e.mode ?? 'own', true, after);
                    break;
                case 'relocate':
                    for (const from of s.sites)
                        for (const [slot, id] of from.occupants.entries())
                            if (id === p.playerId)
                                for (const to of s.sites)
                                    if (to !== from && to.definitionId && to.level <= (e.level ?? 1))
                                        for (const [target, who] of to.occupants.entries())
                                            if (who === null && !to.blocked[target])
                                                add('EFFECT', to.id, arnakSite(to.definitionId).name + '로 이동', () => { after(); from.occupants[slot] = null; to.occupants[target] = p.playerId; effects(arnakSite(to.definitionId!).effects, '이동 장소'); });
                    break;
                case 'special':
                    switch (e.mode) {
                        case 'brush':
                            add('EFFECT', 'reward', '우상으로 나침반 얻기', () => { after(); gain(p, { compass: Math.min(3, p.idols) }); });
                            break;
                        case 'bow':
                            add('EFFECT', 'reward', '수호자로 나침반 얻기', () => { after(); gain(p, { compass: Math.min(3, p.guardians.length + s.sites.filter(t => t.guardianId && t.occupants.includes(p.playerId)).length) }); });
                            break;
                        case 'theodolite':
                            add('EFFECT', 'reward', '탐험가로 나침반 얻기', () => { after(); gain(p, { compass: 2 - p.workers }); });
                            break;
                        case 'war-mask':
                            add('EFFECT', 'ward', '이번 라운드 수호자 공포 방지', () => { after(); p.noFear = true; });
                            break;
                        case 'knife':
                            add('EFFECT', 'knife', '서로 다른 보상 두 가지 선택', () => { done(); enqueue(s, ['@knife'], job.label, '', true); });
                            break;
                        case 'crystal':
                        case 'obsidian':
                            for (let n = 0; n <= Math.min(p.deck.length, e.mode === 'crystal' ? 3 : 2); n++)
                                add('EFFECT', 'peek', `카드 ${n}장 확인`, () => { done(); s.peek = e.mode === 'crystal' ? p.deck.splice(0, n) : p.deck.splice(p.deck.length - n, n); enqueue(s, ['@peek'], job.label, e.mode!, true); });
                            break;
                        case 'stone-key':
                            if (p.idolSlots)
                                add('EFFECT', 'idol', '마지막 우상을 슬롯에서 회수', () => { after(); p.idolSlots--; });
                            break;
                        case 'ocarina':
                            for (const site of s.sites)
                                for (const [i, id] of site.occupants.entries())
                                    if (id === p.playerId)
                                        add('EFFECT', site.id, '탐험가 회수 · 모든 이동을 비행기로', () => { after(); site.occupants[i] = null; p.workers++; p.planeRound = true; });
                            add('EFFECT', 'travel', '회수 없이 모든 이동을 비행기로', () => { after(); p.planeRound = true; });
                            break;
                        case 'research-discount':
                            for (const value of [{ tablet: 1 }, { arrow: 1 }, { jewel: 1 }])
                                research('', value, false, after);
                            break;
                        case 'hammer':
                            add('EFFECT', 'market', '오른쪽 아이템 제거 후 획득', () => { done(); const index = s.market.map(c => arnakCard(c.definitionId).type).lastIndexOf('item'); if (index >= 0)
                                s.exiled.push(...s.market.splice(index, 1)); enqueue(s, ['@hammer'], '제거된 아이템 획득', '', true); });
                            break;
                        case 'two-base':
                            for (const site of s.sites.filter(t => t.level === 0))
                                add('EFFECT', site.id, arnakSite(site.definitionId!).name + ' 첫 활성화', () => { done(); enqueue(s, ['@second-base'], '다른 기초 장소 활성화', site.id, true); effects(arnakSite(site.definitionId!).effects, '첫 장소'); });
                            break;
                        case 'crown':
                            for (const from of s.sites.filter(t => t.guardianId && t.occupants.includes(p.playerId)))
                                for (const to of s.sites.filter(t => t !== from && t.definitionId && t.level <= 1 && !t.guardianId && !t.occupants.some(Boolean)))
                                    add('EFFECT', to.id, '수호자를 ' + arnakSite(to.definitionId!).name + '로 이동', () => { after(); to.guardianId = from.guardianId; from.guardianId = null; effects(arnakSite(to.definitionId!).effects, '왕관 장소'); });
                            break;
                    }
                    break;
                case 'peekKeep':
                case 'peekReturn': break;
            }
            // Benefits can be declined; mandatory discards that follow a draw cannot be declined while a card remains.
            if (!(e.kind === 'discard' && !e.after && p.hand.length))
                add('EFFECT', 'skip', '이 효과 건너뛰기', done);
        }
    }
    // Free actions interrupt a pending benefit and return to it after resolving.
    for (const card of p.hand) {
        const d = arnakCard(card.definitionId);
        if (!d.effects.length || !d.free && (s.mainActionUsed || s.jobs.length))
            continue;
        const cost = arnakResources(d.type === 'artifact' ? { tablet: 1 } : {});
        add('CARD', card.tileId, d.name + ' 사용', () => { if (!d.free)
            s.mainActionUsed = true; p.hand.splice(p.hand.indexOf(card), 1); (d.exileSelf ? s.exiled : p.played).push(card); effects(d.effects, d.name); }, cost, [], d.free, d.effects.map(effectLabel).join(' · '));
    }
    for (const card of p.hand) {
        const d = arnakCard(card.definitionId);
        if (d.passEffects.length && !s.mainActionUsed && !s.jobs.length)
            add('CARD', card.tileId, d.name + ' · 패스 보상', () => { s.mainActionUsed = true; p.hand.splice(p.hand.indexOf(card), 1); p.played.push(card); enqueue(s, ['@pass'], '라운드 패스'); effects(d.passEffects, d.name); }, arnakResources(d.type === 'artifact' ? { tablet: 1 } : {}), [], false, '보상을 받고 이번 라운드 패스');
    }
    for (const a of p.assistants) {
        const d = arnakAssistant(a.definitionId);
        if (!a.ready || !d.free && (s.mainActionUsed || s.jobs.length))
            continue;
        add('ASSISTANT', a.definitionId, d.name + ' 사용', () => { a.ready = false; if (!d.free)
            s.mainActionUsed = true; effects(a.gold ? d.gold : d.silver, d.name); }, undefined, undefined, d.free);
    }
    for (const [i, g] of p.guardians.entries())
        if (!g.used)
            add('BOON', g.definitionId, arnakGuardian(g.definitionId).name + ' 축복', () => { p.guardians[i]!.used = true; effects(arnakGuardian(g.definitionId).boon, '수호자 축복'); });
    if (p.idols > p.idolSlots && p.idolSlots < 4)
        for (const id of ARNAK_IDOL_EFFECTS) {
            const e = arnakEffect(id), cost = arnakResources(e.cost);
            add('IDOL', 'idol', e.kind === 'trade' ? '금화 1 → 보석 1' : effectLabel(id), () => { p.idolSlots++; if (e.kind === 'trade')
                effects((e.after ?? []).map((_, i) => id + '/after/' + i), '우상 슬롯');
            else
                effects([id], '우상 슬롯'); }, cost);
        }
    if (!s.jobs.length) {
        if (!s.mainActionUsed) {
            const main = () => { s.mainActionUsed = true; };
            deploy(0, [], 2, main);
            buyCards('either', 0, main);
            research('', {}, false, main);
            overcome('own', false, main);
            if (p.magnifier === '8')
                for (const [i, cost] of ARNAK_TEMPLE_COSTS.entries())
                    if (s.templeSupply[i]! > 0)
                        add('RESEARCH', 'temple', `사원 타일 ${[2, 2, 2, 6, 6, 11][i]}점`, () => { main(); s.templeSupply[i]!--; p.templePoints += [2, 2, 2, 6, 6, 11][i]!; }, cost, [], false);
            add('PASS', 'pass', '이번 라운드 패스', () => { s.mainActionUsed = true; enqueue(s, ['@pass'], '라운드 종료'); }, undefined, undefined, false);
        }
        else
            add('END', 'end', '차례 마치기', () => nextTurn(s, now, r), undefined, undefined, false);
    }
    return out;
}
const previewRandom: RandomSource = { nextInt: () => 0 };
export function arnakOffers(s: ArnakState, viewer: PlayerId): ArnakOffer[] { if (s.activePlayerId !== viewer || s.phase !== 'PLAYING')
    return []; return choices(structuredClone(s), s.startedAt, previewRandom).map(c => c.offer); }
function settleAutomatic(s: ArnakState) { const p = s.players.find(p => p.playerId === s.activePlayerId)!; for (let i = 0; i < 200; i++) {
    const job = s.jobs[0];
    if (!job)
        return;
    if (job.effect === '@guardian') {
        s.jobs.shift();
        s.sites.find(t => t.id === job.context)!.guardianId = s.guardianDeck.shift() ?? null;
        continue;
    }
    if (job.effect === '@pass') {
        s.jobs.shift();
        s.stage = 'CLEANUP';
        return;
    }
    if (job.effect.startsWith('@'))
        return;
    const e = arnakEffect(job.effect);
    if (e.kind !== 'gain' && e.kind !== 'travel')
        return;
    s.jobs.shift();
    if (e.kind === 'gain')
        gain(p, e.value ?? {});
    else
        p.travel.push(...(e.travel ?? []));
} }
export function applyArnakAction(s: ArnakState, actor: PlayerId, input: ArnakAction, now: ServerTime, turnId: TurnId, random: RandomSource): {
    ok: true;
    state: ArnakState;
} | {
    ok: false;
    reason: 'INVALID_ACTION' | 'INVALID_PHASE' | 'NOT_YOUR_TURN';
} {
    if (s.phase !== 'PLAYING')
        return { ok: false, reason: 'INVALID_PHASE' };
    if (s.activePlayerId !== actor)
        return { ok: false, reason: 'NOT_YOUR_TURN' };
    const parsed = v.safeParse(ArnakActionSchema, input);
    if (!parsed.success)
        return { ok: false, reason: 'INVALID_ACTION' };
    const next = structuredClone(s), selected = choices(next, now, random).find(c => c.offer.id === parsed.output.actionId);
    if (!selected)
        return { ok: false, reason: 'INVALID_ACTION' };
    selected.apply();
    settleAutomatic(next);
    sync(next);
    next.revision = v.parse(GameRevisionSchema, s.revision + 1);
    next.transitionId = turnId;
    next.history.push({ id: next.revision, playerId: actor, kind: selected.offer.kind, text: selected.offer.kind==='EFFECT'&&['@peek','@return'].includes(s.jobs[0]?.effect??'')?'확인한 카드의 배치를 마쳤습니다':selected.offer.label, round: s.round });
    next.history = next.history.slice(-120);
    return { ok: true, state: parseArnakState(next) };
}
export function cancelArnak(s: ArnakState, now: ServerTime): ArnakState { return parseArnakState({ ...s, revision: s.revision + 1, phase: 'FINISHED', finishedAt: now, result: { reason: 'CANCELLED', winnerPlayerIds: [], scores: s.players.map(p => scoreArnak(p, s)) } }); }
