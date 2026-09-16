import { marsBaseRequirements, marsRequirementReason } from './requirements.js';
import { marsCanReduceProduction, marsEnergyProductionTargets } from './production-attacks.js';
import { marsCardResourcePoints, marsAddedCardResources } from './card-resources.js';
import { marsLandClaimsAreConsistent } from '@hangul-rummikub/shared';
import { marsProductionBox } from './production-copy.js';
import { marsCanRemoveResource } from './protection.js';
import { marsScienceExchangeEffects } from './science.js';
import { marsEconomyTags, marsMetalValues, marsDiscountedCost, marsCardIncome, marsStandardProjectIncome, marsJovianProduction, marsTagProduction } from './economy.js';
import { marsCorporationStart } from './corporation-start.js';
import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, TurnIdSchema, MARS_CARDS, MARS_RESOURCES, MARS_BOARD, MARS_MILESTONES, MARS_AWARDS, MARS_CORPORATIONS, MarsPublicFields, MarsPlayerPublicSchema, MarsCardSchema, MarsCardChoiceSchema, PlayerIdSchema, MarsRefSchema, MarsCountSchema, MarsResultSchema, MarsActionSchema, marsResources, marsCard, marsAdjacent, marsEffectText, MARS_RESOURCE_NAMES, marsPaymentValue, type MarsEffect, type MarsDefinition, type MarsOffer, type MarsPlacementRule, type MarsTileKind, type GameId, type PlayerId, type TileId, type ServerTime, type TurnId } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
const Resource = v.picklist(MARS_RESOURCES), CardResource = v.picklist(['animal', 'microbe', 'science', 'fighter']);
const Effect: v.GenericSchema<MarsEffect> = v.lazy(() => v.variant('kind', [
    v.strictObject({ kind: v.literal('stock'), resource: Resource, amount: v.pipe(v.number(), v.safeInteger()) }),
    v.strictObject({ kind: v.literal('production'), resource: Resource, amount: v.pipe(v.number(), v.safeInteger()) }),
    v.strictObject({ kind: v.literal('global'), track: v.picklist(['oxygen', 'temperature', 'tr']), amount: MarsCountSchema }),
    v.strictObject({ kind: v.literal('place'), tile: v.picklist(['city', 'greenery', 'ocean', 'special']), rule: v.picklist(['normal', 'oceanLand', 'greeneryOcean', 'oceanSpecial', 'isolated', 'nextGreenery', 'twoCities', 'volcano', 'mining', 'noctis', 'phobos', 'ganymede']) }),
    v.pipe(v.strictObject({ kind: v.literal('keepCards'), count: v.pipe(MarsCountSchema, v.minValue(1), v.maxValue(4)), keep: v.pipe(MarsCountSchema, v.minValue(1), v.maxValue(4)) }), v.check(e => e.keep <= e.count)),
    v.strictObject({ kind: v.literal('buyCard') }),
    v.strictObject({ kind: v.literal('exchangeCard') }),
    v.strictObject({ kind: v.literal('protectHabitats') }),
    v.strictObject({ kind: v.literal('copyProduction') }),
    v.strictObject({ kind: v.literal('claimLand') }),
    v.strictObject({ kind: v.literal('transferEnergyProduction') }),
    v.strictObject({ kind: v.literal('attackStock'), resource: Resource, amount: MarsCountSchema, steal: v.boolean() }),
    v.strictObject({ kind: v.literal('removeCardResource'), resource: CardResource, amount: MarsCountSchema }),
    v.strictObject({ kind: v.literal('nextCardDiscount'), amount: v.literal(8) }),
    v.strictObject({ kind: v.literal('draw'), amount: MarsCountSchema }), v.strictObject({ kind: v.literal('removePlants'), amount: MarsCountSchema }),
    v.strictObject({ kind: v.literal('attackProduction'), resource: Resource, amount: MarsCountSchema }),
    v.strictObject({ kind: v.literal('add'), resource: CardResource, amount: MarsCountSchema, self: v.boolean() }), v.strictObject({ kind: v.literal('steal'), resource: CardResource }),
    v.strictObject({ kind: v.literal('consumeSelf'), amount: MarsCountSchema }), v.strictObject({ kind: v.literal('pay'), amount: MarsCountSchema, material: v.picklist(['none', 'steel', 'titanium']) }),
    v.strictObject({ kind: v.literal('choice'), options: v.array(v.strictObject({ label: MarsRefSchema, effects: v.array(Effect) })) }),
    v.strictObject({ kind: v.literal('dynamic'), rule: v.picklist(['citiesEnergy', 'citiesPlants', 'citiesMoney', 'citiesIncome', 'plantTags', 'powerTags', 'microbeTags', 'nitrogen', 'insulation', 'search', 'flooding', 'specialDesign', 'earthIncome', 'buildingIncome', 'spaceIncome', 'opponentsSpaceIncome']) }),
]));
const Job = v.strictObject({ id: MarsCountSchema, source: MarsRefSchema, effect: Effect });
const Player = v.strictObject({ ...MarsPlayerPublicSchema.entries, hand: v.array(MarsCardSchema), research: v.array(MarsCardSchema), corporations: v.array(MarsRefSchema), initialActionDone: v.boolean(), specialDesign: v.boolean(), nextCardDiscount: v.picklist([0, 8]) });
const Payment = v.strictObject({ cost: MarsCountSchema, material: v.picklist(['none', 'steel', 'titanium', 'both']), source: MarsRefSchema, mode: v.picklist(['card', 'effect']), cardId: v.nullable(MarsRefSchema) });
const { playerStates: _players, deckCount: _deck, discardCount: _discard, ...Public } = MarsPublicFields;
const State = v.strictObject({ gameId: GameIdSchema, revision: GameRevisionSchema, rulesVersion: v.literal('mars-base-v1'), startedAt: ServerTimeSchema, finishedAt: v.nullable(ServerTimeSchema), phase: v.picklist(['PLAYING', 'FINISHED']), transitionId: TurnIdSchema, ...Public, players: v.array(Player), deck: v.array(MarsCardSchema), discard: v.array(MarsCardSchema), inventory: v.array(MarsCardSchema), frames: v.array(v.array(Job)), current: v.nullable(Job), payment: v.nullable(Payment), cardChoice: v.nullable(v.strictObject({ ownerId: PlayerIdSchema, view: MarsCardChoiceSchema })), nextJob: MarsCountSchema, actionInProgress: v.boolean(), lastSpace: v.nullable(MarsRefSchema), result: v.nullable(MarsResultSchema) });
export type MarsState = v.InferOutput<typeof State>;
type Person = MarsState['players'][number];
type JobType = v.InferOutput<typeof Job>;
type Choice = {
    offer: MarsOffer;
    apply(): void;
};
function player(s: MarsState, id: PlayerId): Person { const p = s.players.find(p => p.playerId === id); if (!p)
    throw new Error('Missing Mars player'); return p; }
function active(s: MarsState) { return player(s, s.activePlayerId); }
function has(p: Person, id: string) { return p.played.some(c => c.definitionId === id); }
export const marsTags = marsEconomyTags;
function shuffled<T>(a: readonly T[], r: RandomSource): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) {
    const j = r.nextInt(i + 1);
    [b[i], b[j]] = [b[j]!, b[i]!];
} return b; }
function sync(s: MarsState) { for (const p of s.players)
    p.handCount = p.hand.length; }
function log(s: MarsState, kind: MarsState['history'][number]['kind'], text: string, id = s.activePlayerId) { s.history.push({ id: (s.history.at(-1)?.id ?? 0) + 1, generation: s.generation, playerId: id, kind, text }); s.history = s.history.slice(-120); }
export function parseMarsState(input: unknown): MarsState {
    const s = v.parse(State, input), ids = s.players.map(p => p.playerId), cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => [...p.hand, ...p.research, ...p.played]), ...(s.cardChoice?.view.cards ?? [])];
    if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length || !ids.includes(s.activePlayerId) || !ids.includes(s.startingPlayerId))
        throw new Error('Invalid Mars roster');
    if (!marsLandClaimsAreConsistent(s, ids)) throw new Error('Invalid Mars land claims');
    const inventory = new Map(s.inventory.map(c => [c.tileId, c.definitionId]));
    if (inventory.size !== 137 || s.inventory.length !== 137 || new Set(s.inventory.map(c => c.definitionId)).size !== 137 || cards.length !== 137 || new Set(cards.map(c => c.tileId)).size !== 137 || cards.some(c => inventory.get(c.tileId) !== c.definitionId))
        throw new Error('Invalid Mars inventory');
    for (const c of cards)
        marsCard(c.definitionId);
    if (new Set(s.tiles.map(t => t.spaceId)).size !== s.tiles.length || s.tiles.some(t => !MARS_BOARD.some(b => b.id === t.spaceId) && !['phobos', 'ganymede'].includes(t.spaceId) || t.ownerId !== null && !ids.includes(t.ownerId) || t.kind === 'ocean' && t.ownerId !== null || t.kind !== 'ocean' && t.ownerId === null) || s.oceans !== s.tiles.filter(t => t.kind === 'ocean').length)
        throw new Error('Invalid Mars board');
    if (s.temperature % 2 !== 0 || s.players.some(p => p.handCount !== p.hand.length) || s.players.some(p => p.corporationId !== null && !['Beginner', ...MARS_CORPORATIONS.map(c => c.id)].includes(p.corporationId)))
        throw new Error('Invalid Mars player');
    if (s.phase === 'FINISHED' ? (s.finishedAt === null || s.result === null || s.frames.length > 0 || s.current !== null || s.payment !== null || s.cardChoice !== null) : (s.finishedAt !== null || s.result !== null))
        throw new Error('Invalid Mars lifecycle');
    if ([...s.milestones, ...s.awards].some(c => !ids.includes(c.playerId)) || new Set(s.milestones.map(c => c.id)).size !== s.milestones.length || new Set(s.awards.map(c => c.id)).size !== s.awards.length || s.milestones.some(c => !MARS_MILESTONES.some(m => m.id === c.id)) || s.awards.some(c => !MARS_AWARDS.some(a => a.id === c.id)))
        throw new Error('Invalid Mars claims');
    if (s.cardChoice?.view.kind === 'EXCHANGE' && active(s).hand.length === 0) throw new Error('Invalid empty exchange');
    if (s.cardChoice && (s.cardChoice.ownerId !== s.activePlayerId || s.phase !== 'PLAYING' || s.stage !== 'ACTION' || s.payment !== null || s.current !== null || !s.actionInProgress || (s.cardChoice.view.kind === 'BUY' && s.cardChoice.view.canUseHeat !== (active(s).corporationId === 'Helion'))))
        throw new Error('Invalid Mars private card choice');
    const jobs = [...s.frames.flat(), ...(s.current ? [s.current] : [])];
    const jobIds = [...jobs.map(j => j.id), ...(s.cardChoice ? [s.cardChoice.view.id] : [])];
    if (new Set(jobIds).size !== jobIds.length || jobIds.some(id => id >= s.nextJob))
        throw new Error('Invalid Mars effects');
    return s;
}
export function createMarsGame(input: {
    generateTileId(): TileId;
    gameId: GameId;
    playerIds: readonly PlayerId[];
    now: ServerTime;
    turnId: TurnId;
    random: RandomSource;
}): MarsState {
    const { random: r } = input;
    if (input.playerIds.length < 2 || input.playerIds.length > 5 || new Set(input.playerIds).size !== input.playerIds.length)
        throw new Error('Mars requires 2–5 players');
    const inventory = MARS_CARDS.map(c => ({ tileId: input.generateTileId(), definitionId: c.id, resources: 0, usedGeneration: 0 })), deck = shuffled(inventory, r), corporations = shuffled(MARS_CORPORATIONS.map(c => c.id), r), first = r.nextInt(input.playerIds.length), order = [...input.playerIds.slice(first), ...input.playerIds.slice(0, first)];
    const players = order.map(playerId => ({ playerId, protectedHabitats: false, corporationId: null, resources: marsResources(), production: marsResources({ money: 1, steel: 1, titanium: 1, plants: 1, energy: 1, heat: 1 }), tr: 20, handCount: 0, hand: [], research: deck.splice(0, 10), corporations: corporations.splice(0, 2), played: [], passed: false, ready: false, generationStartTr: 20, corporationUsedGeneration: 0, initialActionDone: false, specialDesign: false, nextCardDiscount: 0 as const }));
    return parseMarsState({ gameId: input.gameId, revision: 0, rulesVersion: 'mars-base-v1', startedAt: input.now, finishedAt: null, phase: 'PLAYING', transitionId: input.turnId, generation: 1, stage: 'SETUP', activePlayerId: order[0], startingPlayerId: order[0], actionsTaken: 0, oxygen: 0, temperature: -30, oceans: 0, tiles: [], landClaims: [], milestones: [], awards: [], history: [], players, deck, discard: [], inventory, frames: [], current: null, payment: null, cardChoice: null, nextJob: 1, actionInProgress: false, lastSpace: null, result: null });
}
function takeCards(s: MarsState, n: number, r: RandomSource): MarsState['deck'] {
    const cards: MarsState['deck'] = [];
    for (let i = 0; i < n; i++) {
        if (!s.deck.length && s.discard.length) { s.deck = shuffled(s.discard, r); s.discard = []; }
        const card = s.deck.shift();
        if (!card) break;
        cards.push(card);
    }
    return cards;
}
function draw(s: MarsState, p: Person, n: number, r: RandomSource) { p.hand.push(...takeCards(s, n, r)); }

export function marsClaimableSpaces(s: Pick<MarsState, 'tiles' | 'landClaims'>): string[] {
    return MARS_BOARD.filter(b => !b.ocean && !b.reserved && !s.tiles.some(t => t.spaceId === b.id) && !s.landClaims.some(c => c.spaceId === b.id)).map(b => b.id);
}
export function marsSpaces(s: Pick<MarsState, 'tiles' | 'oceans' | 'landClaims'>, owner: PlayerId, tile: MarsTileKind, rule: MarsPlacementRule = 'normal'): string[] {
    if (tile === 'ocean' && s.oceans >= 9)
        return [];
    if (rule === 'phobos' || rule === 'ganymede')
        return s.tiles.some(t => t.spaceId === rule) ? [] : [rule];
    const occupied = new Set(s.tiles.map(t => t.spaceId));
    let spaces = MARS_BOARD.filter(b => !occupied.has(b.id) && !s.landClaims.some(c => c.spaceId === b.id && c.ownerId !== owner) && (rule === 'noctis' ? b.reserved : !b.reserved));
    if (rule === 'noctis')
        return spaces.map(b => b.id);
    spaces = spaces.filter(b => (rule === 'greeneryOcean' || rule === 'oceanSpecial' || tile === 'ocean' && rule !== 'oceanLand') ? b.ocean : !b.ocean);
    if (rule === 'volcano')
        spaces = spaces.filter(b => ['2-2', '3-1', '4-1', '5-1'].includes(b.id));
    if (rule === 'mining')
        spaces = spaces.filter(b => b.bonus.some(k => k === 'steel' || k === 'titanium'));
    if (rule === 'isolated')
        spaces = spaces.filter(b => !s.tiles.some(t => marsAdjacent(b.id, t.spaceId)));
    if (rule === 'nextGreenery')
        spaces = spaces.filter(b => s.tiles.some(t => t.kind === 'greenery' && marsAdjacent(b.id, t.spaceId)));
    if (tile === 'city') {
        spaces = spaces.filter(b => { const n = s.tiles.filter(t => t.kind === 'city' && marsAdjacent(b.id, t.spaceId)).length; return rule === 'twoCities' ? n >= 2 : n === 0; });
    }
    if (tile === 'greenery' && rule === 'normal') {
        const own = spaces.filter(b => s.tiles.some(t => t.ownerId === owner && marsAdjacent(b.id, t.spaceId)));
        if (own.length)
            spaces = own;
    }
    return spaces.map(b => b.id);
}
function amountAvailable(p: Person, material = 'none'): number {
    const values = marsMetalValues(p);
    return p.resources.money + (p.corporationId === 'Helion' ? p.resources.heat : 0) + (material === 'steel' || material === 'both' ? p.resources.steel * values.steelValue : 0) + (material === 'titanium' || material === 'both' ? p.resources.titanium * values.titaniumValue : 0);
}
export function marsCost(p: Person, c: MarsDefinition): number { return marsDiscountedCost(p, c, p.nextCardDiscount); }
function material(c: MarsDefinition): 'both' | 'steel' | 'titanium' | 'none' { return c.tags.includes('building') ? (c.tags.includes('space') ? 'both' : 'steel') : c.tags.includes('space') ? 'titanium' : 'none'; }
function ownCard(p: Person, source: string) { return p.played.find(c => c.tileId === source); }
function effectsPossible(s: MarsState, p: Person, effects: readonly MarsEffect[], source: string): boolean {
    const stocks = marsResources(), production = marsResources();
    for (const e of effects) {
        if (e.kind === 'stock' && e.amount < 0)
            stocks[e.resource] -= e.amount;
        if (e.kind === 'production' && e.amount < 0)
            production[e.resource] -= e.amount;
    }
    if (MARS_RESOURCES.some(k => p.resources[k] < stocks[k] || p.production[k] - (k === 'money' ? -5 : 0) < production[k]))
        return false;
    const oceans = effects.filter(e => e.kind === 'place' && e.tile === 'ocean' && e.rule === 'normal').length;
    if (Math.min(oceans, 9 - s.oceans) > marsSpaces(s, p.playerId, 'ocean').length)
        return false;
    return effects.every(e => { switch (e.kind) {
        case 'place': return e.tile === 'ocean' && s.oceans >= 9 || marsSpaces(s, p.playerId, e.tile, e.rule).length > 0;
        case 'attackProduction': return s.players.some(t => marsCanReduceProduction(t.production, e.resource, e.amount));
        case 'pay': return amountAvailable(p, e.material) >= e.amount;
        case 'consumeSelf': return (ownCard(p, source)?.resources ?? 0) >= e.amount;
        case 'claimLand': return marsClaimableSpaces(s).length > 0;
        case 'copyProduction': return p.played.some(card => { const box = marsProductionBox(marsCard(card.definitionId), s.tiles.filter(t => t.ownerId === p.playerId)); return box.length > 0 && effectsPossible(s, p, box, source); });
        case 'steal': return s.players.some(owner => owner.played.some(c => marsCard(c.definitionId).resource === e.resource && c.resources > 0 && marsCanRemoveResource(p.playerId, owner, e.resource, c.definitionId)));
        case 'choice': return e.options.some(o => effectsPossible(s, p, o.effects, source));
        case 'dynamic': return e.rule !== 'search' || s.deck.length + s.discard.length > 0;
        default: return true;
    } });
}
export function marsCardReason(s: MarsState, p: Person, c: MarsDefinition): string | null {
    const bonus = (p.corporationId === 'Inventrix' ? 2 : 0) + (has(p, 'AdaptationTechnology') ? 2 : 0) + (p.specialDesign ? 2 : 0);
    const requirementFailure = marsRequirementReason(marsBaseRequirements(c.requirements), {
        oxygen: s.oxygen, temperature: s.temperature, oceans: s.oceans,
        cities: s.tiles.filter(t => t.kind === 'city').length,
        ownGreenery: s.tiles.filter(t => t.ownerId === p.playerId && t.kind === 'greenery').length,
        production: p.production, globalAllowance: bonus, tagCount: tag => marsTags(p, tag),
    });
    if (requirementFailure) return requirementFailure;
    if (!effectsPossible(s, p, c.effects, ''))
        return '생산 감소·필수 자원·배치 조건을 충족하지 못합니다.';
    const available = {...p, resources: {...p.resources}};
    for (const e of c.effects) if (e.kind === 'stock' && e.amount < 0) available.resources[e.resource] += e.amount;
    if (amountAvailable(available, material(c)) < marsCost(p, c))
        return '지불할 자원이 부족합니다.';
    return null;
}
function enqueue(s: MarsState, effects: readonly MarsEffect[], source: string) { const after = effects.filter(e => e.kind === 'dynamic' && e.rule === 'flooding'), first = effects.filter(e => !after.includes(e)); if (after.length) {
    s.lastSpace = null;
    s.frames.push(after.map(effect => ({ id: s.nextJob++, source, effect })));
} if (first.length)
    s.frames.push(first.map(effect => ({ id: s.nextJob++, source, effect }))); }
function global(s: MarsState, track: 'oxygen' | 'temperature' | 'tr', amount: number) {
    const p = active(s);
    if (track === 'tr') {
        p.tr += amount;
        return;
    }
    const before = s[track], step = track === 'temperature' ? 2 : 1, cap = track === 'temperature' ? 8 : 14;
    const change = Math.min(amount, (cap - before) / step);
    s[track] += change * step;
    p.tr += change;
    if (track === 'temperature') {
        if (before < -24 && s.temperature >= -24)
            p.production.heat++;
        if (before < -20 && s.temperature >= -20)
            p.production.heat++;
        if (before < 0 && s.temperature >= 0 && s.oceans < 9)
            enqueue(s, [{ kind: 'place', tile: 'ocean', rule: 'normal' }], '온도 0°C 보너스');
    }
    if (track === 'oxygen' && before < 8 && s.oxygen >= 8)
        global(s, 'temperature', 1);
    if (change)
        log(s, 'TERRAFORM', `${track === 'oxygen' ? '산소' : '기온'} ${before} → ${s[track]} · TR +${change}`);
}
function place(s: MarsState, p: Person, spaceId: string, e: Extract<MarsEffect, {
    kind: 'place';
}>, source: string, r: RandomSource) {
    const definition = ownCard(p, source)?.definitionId ?? source;
    s.landClaims = s.landClaims.filter(c => c.spaceId !== spaceId);
    s.tiles.push({ spaceId, kind: e.tile, ownerId: e.tile === 'ocean' ? null : p.playerId, source: definition });
    s.lastSpace = spaceId;
    const b = MARS_BOARD.find(b => b.id === spaceId);
    if (b) {
        for (const resource of b.bonus) {
            if (resource === 'card')
                draw(s, p, 1, r);
            else
                p.resources[resource]++;
        }
        p.resources.money += s.tiles.filter(t => t.kind === 'ocean' && marsAdjacent(t.spaceId, spaceId)).length * 2;
        if (p.corporationId === 'MiningGuild' && b.bonus.some(k => k === 'steel' || k === 'titanium'))
            p.production.steel++;
        if (e.rule === 'mining') {
            if (b.bonus.includes('steel'))
                p.production.steel++;
            else
                p.production.titanium++;
        }
    }
    if (e.tile === 'ocean') {
        s.oceans++;
        p.tr++;
    }
    if (e.tile === 'greenery')
        global(s, 'oxygen', 1);
    for (const owner of s.players) {
        if (e.tile === 'ocean' && has(owner, 'ArcticAlgae'))
            owner.resources.plants += 2;
        if (e.tile === 'city') {
            if (owner.corporationId === 'TharsisRepublic') {
                if (b)
                    owner.production.money++;
                if (owner.playerId === p.playerId)
                    owner.resources.money += 3;
            }
            if (has(owner, 'ImmigrantCity'))
                owner.production.money++;
            if (has(owner, 'RoverConstruction'))
                owner.resources.money += 2;
            for (const c of owner.played)
                if (c.definitionId === 'Pets')
                    c.resources++;
        }
        if (e.tile === 'greenery' && owner.playerId === p.playerId)
            for (const c of owner.played)
                if (c.definitionId === 'Herbivores')
                    c.resources++;
    }
    log(s, 'PLACE', `${{ city: '도시', greenery: '녹지', ocean: '해양', special: '특수 타일' }[e.tile]} · ${b?.name ?? (spaceId === 'phobos' ? '포보스' : '가니메데')}`);
}
function playedTriggers(s: MarsState, p: Person, c: MarsDefinition) {
    const tags = c.tags;
    for (const card of p.played) {
        if (card.definitionId === 'Decomposers')
            card.resources += tags.filter(t => ['plant', 'animal', 'microbe'].includes(t)).length;
        if (card.definitionId === 'EcologicalZone')
            card.resources += tags.filter(t => ['plant', 'animal'].includes(t)).length;
    }
    const income = marsCardIncome(p, c);
    for (const resource of MARS_RESOURCES) p.resources[resource] += income[resource];
    for (const owner of s.players) owner.production.money += marsJovianProduction(owner, c);
}
function payNegatives(p: Person, effects: readonly MarsEffect[]): readonly MarsEffect[] { return effects.filter(e => { if (e.kind === 'stock' && e.amount < 0) {
    p.resources[e.resource] += e.amount;
    return false;
} if (e.kind === 'production' && e.amount < 0) {
    p.production[e.resource] += e.amount;
    return false;
} return true; }); }
function executeSimple(s: MarsState, j: JobType, r: RandomSource): boolean {
    const e = j.effect, p = active(s), source = ownCard(p, j.source);
    switch (e.kind) {
        case 'stock':
            p.resources[e.resource] += e.amount;
            return true;
        case 'production':
            p.production[e.resource] += e.amount;
            return true;
        case 'global':
            global(s, e.track, e.amount);
            return true;
        case 'nextCardDiscount':
            p.nextCardDiscount = e.amount;
            return true;
        case 'protectHabitats':
            p.protectedHabitats = true;
            return true;
        case 'exchangeCard':
            if (p.hand.length) s.cardChoice = { ownerId: p.playerId, view: { id: j.id, label: 'Mars University · 손패 교환', kind: 'EXCHANGE', cards: [] } };
            return true;
        case 'keepCards':
        case 'buyCard': {
            const cards = takeCards(s, e.kind === 'keepCards' ? e.count : 1, r);
            if (cards.length) {
                const base = { id: j.id, label: source ? marsCard(source.definitionId).name : j.source, cards };
                s.cardChoice = { ownerId: p.playerId, view: e.kind === 'keepCards'
                    ? { ...base, kind: 'KEEP', keepCount: Math.min(e.keep, cards.length) }
                    : { ...base, kind: 'BUY', cost: 3, canUseHeat: p.corporationId === 'Helion' } };
            }
            return true;
        }
        case 'draw':
            draw(s, p, e.amount, r);
            return true;
        case 'add':
            if (e.self) {
                if (!source)
                    throw new Error('Missing card resource source');
                source.resources = marsAddedCardResources(source.resources, marsCard(source.definitionId).resource, e.resource, e.amount);
                return true;
            }
            return false;
        case 'consumeSelf':
            if (!source || source.resources < e.amount)
                throw new Error('Missing card resources');
            source.resources -= e.amount;
            return true;
        case 'place': return e.tile === 'ocean' && s.oceans >= 9;
        case 'pay':
            s.payment = { cost: e.amount, material: e.material, source: j.source, mode: 'effect', cardId: null };
            return true;
        case 'dynamic': {
            const allCities = s.tiles.filter(t => t.kind === 'city'), onMars = allCities.filter(t => MARS_BOARD.some(b => b.id === t.spaceId)).length;
            switch (e.rule) {
                case 'citiesEnergy':
                    p.production.energy += allCities.length;
                    return true;
                case 'citiesPlants':
                    p.resources.plants += allCities.length;
                    return true;
                case 'citiesMoney':
                    p.resources.money += onMars;
                    return true;
                case 'citiesIncome':
                    p.production.money += onMars;
                    return true;
                case 'plantTags':
                case 'powerTags':
                case 'microbeTags':
                case 'nitrogen':
                case 'earthIncome':
                case 'buildingIncome':
                case 'spaceIncome':
                case 'opponentsSpaceIncome': {
                    const production = marsTagProduction(p, s.players.filter(other => other.playerId !== p.playerId), e.rule);
                    for (const resource of MARS_RESOURCES) p.production[resource] += production[resource];
                    return true;
                }
                case 'specialDesign':
                    p.specialDesign = true;
                    return true;
                case 'search': {
                    if (!s.deck.length) {
                        s.deck = shuffled(s.discard, r);
                        s.discard = [];
                    }
                    const c = s.deck.shift();
                    if (c) {
                        if (source && marsCard(c.definitionId).tags.includes('microbe'))
                            source.resources++;
                        s.discard.push(c);
                        log(s, 'ACTION', `생명체 탐사 공개: ${marsCard(c.definitionId).name}`);
                    }
                    return true;
                }
                default: return false;
            }
        }
        default: return false;
    }
}
function awardMetric(s: MarsState, p: Person, id: string): number { switch (id) {
    case 'landlord': return s.tiles.filter(t => t.ownerId === p.playerId).length;
    case 'banker': return p.production.money;
    case 'scientist': return marsTags(p, 'science');
    case 'thermalist': return p.resources.heat;
    case 'miner': return p.resources.steel + p.resources.titanium;
    default: return 0;
} }
export function scoreMars(s: MarsState) {
    return s.players.map(p => {
        const myTiles = s.tiles.filter(t => t.ownerId === p.playerId);
        let cards = 0;
        for (const c of p.played) {
            const d = marsCard(c.definitionId);
            switch (d.score) {
                case 'fixed':
                    cards += d.points;
                    break;
                case 'resources':
                    if (!d.resourceScore) throw new Error('Missing Mars resource scoring rule');
                    cards += marsCardResourcePoints(c.resources, d.resourceScore);
                    break;
                case 'jovian':
                    cards += marsTags(p, 'jovian');
                    break;
                case 'cities':
                    cards += Math.floor(s.tiles.filter(t => t.kind === 'city').length / d.points);
                    break;
                case 'life':
                    cards += c.resources ? 3 : 0;
                    break;
                case 'capital': {
                    const tile = myTiles.find(t => t.source === d.id);
                    if (tile)
                        cards += s.tiles.filter(t => t.kind === 'ocean' && marsAdjacent(t.spaceId, tile.spaceId)).length;
                    break;
                }
            }
        }
        const greenery = myTiles.filter(t => t.kind === 'greenery').length, cities = myTiles.filter(t => t.kind === 'city').reduce((n, t) => n + s.tiles.filter(g => g.kind === 'greenery' && marsAdjacent(g.spaceId, t.spaceId)).length, 0), milestones = s.milestones.filter(m => m.playerId === p.playerId).length * 5;
        let awards = 0;
        for (const a of s.awards) {
            const values = s.players.map(x => awardMetric(s, x, a.id)), mine = awardMetric(s, p, a.id), higher = values.filter(x => x > mine).length;
            if (higher === 0)
                awards += 5;
            else if (s.players.length > 2 && higher === 1)
                awards += 2;
        }
        return { playerId: p.playerId, tr: p.tr, cards, greenery, cities, milestones, awards, money: p.resources.money, total: p.tr + cards + greenery + cities + milestones + awards };
    });
}
function finish(s: MarsState, now: ServerTime, reason: 'SCORED' | 'CANCELLED' = 'SCORED') { if (s.cardChoice) { s.discard.push(...s.cardChoice.view.cards); s.cardChoice = null; } const scores = scoreMars(s), highest = Math.max(...scores.map(s => s.total)), money = Math.max(...scores.filter(s => s.total === highest).map(s => s.money)); s.result = { reason, scores, winnerPlayerIds: reason === 'CANCELLED' ? [] : scores.filter(s => s.total === highest && s.money === money).map(s => s.playerId) }; s.phase = 'FINISHED'; s.finishedAt = now; s.frames = []; s.current = null; s.payment = null; s.actionInProgress = false; log(s, 'FINISH', reason === 'SCORED' ? '테라포밍 완료 · 최종 정산' : '참가자 퇴장으로 게임 취소'); }
function nextPlayer(s: MarsState) { const i = s.players.findIndex(p => p.playerId === s.activePlayerId); for (let n = 1; n <= s.players.length; n++) {
    const p = s.players[(i + n) % s.players.length]!;
    if (!p.passed) {
        s.activePlayerId = p.playerId;
        return;
    }
} }
function nextTurn(s: MarsState, now: ServerTime, r: RandomSource) {
    s.actionsTaken = 0;
    if (s.stage === 'FINAL_GREENERY') {
        if (s.players.every(p => p.passed)) {
            finish(s, now);
            return;
        }
        nextPlayer(s);
        return;
    }
    if (s.players.every(p => p.passed)) {
        for (const p of s.players) {
            const oldEnergy = p.resources.energy;
            p.resources.heat += oldEnergy;
            p.resources.energy = 0;
            for (const resource of MARS_RESOURCES)
                p.resources[resource] += p.production[resource] + (resource === 'money' ? p.tr : 0);
            p.passed = false;
            p.specialDesign = false;
            p.nextCardDiscount = 0;
            log(s, 'PRODUCTION', `생산 완료 · 에너지 ${oldEnergy} → 열 · M€ +${p.production.money + p.tr}`, p.playerId);
        }
        if (s.oxygen === 14 && s.temperature === 8 && s.oceans === 9) {
            s.stage = 'FINAL_GREENERY';
            s.activePlayerId = s.startingPlayerId;
            return;
        }
        s.generation++;
        s.startingPlayerId = s.players[(s.players.findIndex(p => p.playerId === s.startingPlayerId) + 1) % s.players.length]!.playerId;
        s.activePlayerId = s.startingPlayerId;
        s.stage = 'RESEARCH';
        for (const p of s.players) {
            p.ready = false;
            p.generationStartTr = p.tr;
            const before = p.hand.length;
            draw(s, p, 4, r);
            p.research = p.hand.splice(before);
        }
        return;
    }
    nextPlayer(s);
}
function drain(s: MarsState, now: ServerTime, r: RandomSource) {
    for (let steps = 0; steps < 1000; steps++) {
        if (s.payment || s.current || s.cardChoice)
            return;
        while (s.frames.length && !s.frames.at(-1)!.length)
            s.frames.pop();
        const frame = s.frames.at(-1);
        if (frame) {
            if (frame.length > 1)
                return;
            const j = frame.pop()!;
            s.frames.pop();
            if (!executeSimple(s, j, r)) {
                s.current = j;
                return;
            }
            continue;
        }
        if (s.actionInProgress) {
            s.actionInProgress = false;
            if (s.stage === 'ACTION') {
                s.actionsTaken++;
                if (s.actionsTaken === 2)
                    nextTurn(s, now, r);
            }
        }
        return;
    }
    throw new Error('Mars effect limit');
}
function milestoneEligible(s: MarsState, p: Person, id: string) { switch (id) {
    case 'terraformer': return p.tr >= 35;
    case 'mayor': return s.tiles.filter(t => t.ownerId === p.playerId && t.kind === 'city').length >= 3;
    case 'gardener': return s.tiles.filter(t => t.ownerId === p.playerId && t.kind === 'greenery').length >= 3;
    case 'builder': return marsTags(p, 'building') >= 8;
    case 'planner': return p.hand.length >= 16;
    default: return false;
} }
function choices(s: MarsState, viewer: PlayerId, now: ServerTime, r: RandomSource): Choice[] {
    if (s.phase !== 'PLAYING' || s.activePlayerId !== viewer || ['SETUP', 'RESEARCH'].includes(s.stage))
        return [];
    if (s.cardChoice) return [];
    const p = active(s), out: Choice[] = [];
    const offer = (id: string, kind: MarsOffer['kind'], targetId: string, label: string, detail: string, cost: number, apply: () => void) => out.push({ offer: { id, kind, targetId, label, detail, cost }, apply });
    if (s.payment) {
        if (s.payment.mode === 'card')
            offer('cancel', 'CANCEL', 'cancel', '선택 취소', '지불 전 카드 선택 취소', 0, () => { s.payment = null; });
        return out;
    }
    const j = s.current;
    if (j) {
        const e = j.effect, resolve = (fn: () => void) => () => { s.current = null; fn(); };
        if (e.kind === 'claimLand') {
            for (const id of marsClaimableSpaces(s))
                offer(`claim-land:${id}`, 'PLACE', id, `${MARS_BOARD.find(b => b.id === id)?.name ?? id} 예약`, '나만 타일 배치 가능 · 지금은 보너스·점수 없음 · 실제 배치 조건 유지', 0, resolve(() => { s.landClaims.push({ spaceId: id, ownerId: p.playerId }); log(s, 'CLAIM', `${id} 토지 예약`); }));
        }
        if (e.kind === 'copyProduction') {
            for (const card of p.played) {
                const definition = marsCard(card.definitionId), box = marsProductionBox(definition, s.tiles.filter(t => t.ownerId === p.playerId));
                if (box.length && effectsPossible(s, p, box, j.source))
                    offer(`copy-production:${card.tileId}`, 'EFFECT', card.tileId, `${definition.name} 생산량 복제`, box.map(marsEffectText).join(' · ') + ' · 자원·배치·지표·태그는 복제하지 않음', 0, resolve(() => { enqueue(s, payNegatives(p, box), j.source); log(s, 'ACTION', `${definition.name} 생산량 상자 복제`); }));
            }
        }
        if (e.kind === 'place') {
            for (const id of marsSpaces(s, p.playerId, e.tile, e.rule)) {
                const b = MARS_BOARD.find(b => b.id === id), cash = s.tiles.filter(t => t.kind === 'ocean' && marsAdjacent(t.spaceId, id)).length * 2;
                offer(`place:${id}`, 'PLACE', id, b?.name ?? id, `${marsEffectText(e)}${b?.bonus.length ? ` · ${b.bonus.map(k => k === 'card' ? '카드 1' : MARS_RESOURCE_NAMES[k] + ' 1').join(', ')}` : ''}${cash ? ` · 해양 인접 M€ +${cash}` : ''}`, 0, resolve(() => place(s, p, id, e, j.source, r)));
            }
        }
        if (e.kind === 'attackStock') {
            offer('skip', 'EFFECT', 'skip', e.steal ? '탈취하지 않기' : '제거하지 않기', '자원을 변경하지 않고 계속', 0, resolve(() => undefined));
            for (const target of s.players) {
                if (e.steal && target.playerId === p.playerId || !marsCanRemoveResource(p.playerId, target, e.resource)) continue;
                for (let amount = 1; amount <= Math.min(e.amount, target.resources[e.resource]); amount++) {
                    const n = amount;
                    offer(`attack-stock:${target.playerId}:${e.resource}:${n}`, 'EFFECT', target.playerId, `${MARS_RESOURCE_NAMES[e.resource]} ${n} ${e.steal ? '탈취' : '제거'}`, `대상 ${target.resources[e.resource]} → ${target.resources[e.resource] - n}${e.steal ? ` · 내 자원 ${p.resources[e.resource]} → ${p.resources[e.resource] + n}` : ''} · 생산량 변화 없음`, 0, resolve(() => { target.resources[e.resource] -= n; if (e.steal) p.resources[e.resource] += n; log(s, 'ATTACK', `${s.players.indexOf(target) + 1}번 기업 · ${MARS_RESOURCE_NAMES[e.resource]} ${n} ${e.steal ? '탈취' : '제거'}`); }));
                }
            }
        }
        if (e.kind === 'removeCardResource') {
            offer('skip', 'EFFECT', 'skip', '제거하지 않기', '카드 자원을 변경하지 않고 계속', 0, resolve(() => undefined));
            for (const target of s.players) for (const card of target.played) {
                if (marsCard(card.definitionId).resource !== e.resource || !marsCanRemoveResource(p.playerId, target, e.resource, card.definitionId)) continue;
                for (let amount = 1; amount <= Math.min(e.amount, card.resources); amount++) {
                    const n = amount;
                    offer(`attack-card:${card.tileId}:${n}`, 'EFFECT', target.playerId, `${marsCard(card.definitionId).name} 자원 ${n} 제거`, `카드 자원 ${card.resources} → ${card.resources - n} · 내 자원 획득 없음`, 0, resolve(() => { card.resources -= n; log(s, 'ATTACK', `${s.players.indexOf(target) + 1}번 기업 · ${marsCard(card.definitionId).name} 자원 ${n} 제거`); }));
                }
            }
        }
        if (e.kind === 'transferEnergyProduction') {
            for (const targetId of marsEnergyProductionTargets(s.players, p.playerId)) {
                const target = s.players.find(t => t.playerId === targetId)!;
                const self = targetId === p.playerId;
                const detail = self
                    ? `${p.production.energy === 0 ? '모두의 생산이 0 · ' : ''}내 생산 증가·감소 상쇄 · ${p.production.energy} → ${p.production.energy} · 보유 에너지 변화 없음`
                    : `대상 생산 ${target.production.energy} → ${target.production.energy - 1} · 내 생산 ${p.production.energy} → ${p.production.energy + 1} · 보유 에너지 변화 없음`;
                offer(`transfer-energy:${targetId}`, 'EFFECT', targetId, self ? '내 에너지 생산 유지' : '에너지 생산 1 이전', detail, 0, resolve(() => {
                    if (!self) { target.production.energy--; p.production.energy++; }
                    log(s, 'ATTACK', self ? '내 에너지 생산 증가·감소 상쇄' : `${s.players.indexOf(target) + 1}번 기업 에너지 생산 −1 · 내 생산 +1`);
                }));
            }
        }
        if (e.kind === 'attackProduction') {
            for (const t of s.players)
                if (marsCanReduceProduction(t.production, e.resource, e.amount))
                    offer(`reduce:${t.playerId}`, 'EFFECT', t.playerId, `${MARS_RESOURCE_NAMES[e.resource]} 생산 감소`, `${t.playerId === p.playerId ? '내 생산량 감소 · ' : ''}${t.production[e.resource]} → ${t.production[e.resource] - e.amount} · 하한 ${e.resource === 'money' ? -5 : 0} · 보유 자원 변화 없음`, 0, resolve(() => { t.production[e.resource] -= e.amount; log(s, 'ATTACK', `${s.players.indexOf(t) + 1}번 기업 · ${MARS_RESOURCE_NAMES[e.resource]} 생산 −${e.amount}`); }));
        }
        if (e.kind === 'removePlants') {
            offer('skip', 'EFFECT', 'skip', '식물 제거하지 않기', '선택 효과 건너뛰기', 0, resolve(() => undefined));
            for (const t of s.players) {
                const n = Math.min(t.resources.plants, e.amount);
                if (n && marsCanRemoveResource(p.playerId, t, 'plants'))
                    for (let amount = 1; amount <= n; amount++)
                        offer(`burn:${t.playerId}:${amount}`, 'EFFECT', t.playerId, `식물 ${amount} 제거`, `현재 식물 ${t.resources.plants}`, 0, resolve(() => { t.resources.plants -= amount; }));
            }
        }
        if (e.kind === 'add') {
            const targets = p.played.filter(c => c.tileId !== j.source && marsCard(c.definitionId).resource === e.resource);
            for (const c of targets)
                offer(`add:${c.tileId}`, 'EFFECT', c.tileId, marsCard(c.definitionId).name, marsEffectText(e), 0, resolve(() => { c.resources += e.amount; }));
            if (!targets.length)
                offer('skip', 'EFFECT', 'skip', '자원 추가 생략', '자원을 받을 카드가 없습니다.', 0, resolve(() => undefined));
        }
        if (e.kind === 'steal') {
            for (const owner of s.players)
                for (const c of owner.played)
                    if (c.resources > 0 && marsCard(c.definitionId).resource === e.resource && marsCanRemoveResource(p.playerId, owner, e.resource, c.definitionId))
                        offer(`steal:${c.tileId}`, 'EFFECT', c.tileId, marsCard(c.definitionId).name, '자원 1 제거 후 내 행동 카드에 1 추가', 0, resolve(() => { c.resources--; ownCard(p, j.source)!.resources++; }));
        }
        if (e.kind === 'choice') {
            e.options.forEach((o, i) => { if (effectsPossible(s, p, o.effects, j.source))
                offer(`choice:${i}`, 'EFFECT', String(i), o.label, o.effects.map(marsEffectText).join(' · '), 0, resolve(() => enqueue(s, payNegatives(p, o.effects), j.source))); });
        }
        if (e.kind === 'dynamic' && e.rule === 'insulation') {
            for (let n = 0; n <= p.production.heat; n++)
                offer(`insulate:${n}`, 'EFFECT', String(n), `${n}단계 전환`, `열 생산 −${n} / M€ 생산 +${n}`, 0, resolve(() => { p.production.heat -= n; p.production.money += n; }));
        }
        if (e.kind === 'dynamic' && e.rule === 'flooding') {
            offer('skip', 'EFFECT', 'skip', '홍수 피해 생략', 'M€ 제거하지 않기', 0, resolve(() => undefined));
            for (const target of s.players)
                if (s.tiles.some(t => t.ownerId === target.playerId && s.lastSpace && marsAdjacent(t.spaceId, s.lastSpace)))
                    offer(`flood:${target.playerId}`, 'EFFECT', target.playerId, '인접 소유자에게 홍수 피해', `M€ ${Math.min(4, target.resources.money)} 제거`, 0, resolve(() => { target.resources.money = Math.max(0, target.resources.money - 4); }));
        }
        return out;
    }
    const frame = s.frames.at(-1);
    if (frame?.length) {
        for (const job of frame)
            offer(`resolve:${job.id}`, 'EFFECT', job.source, marsEffectText(job.effect), '해결할 효과의 순서를 선택하세요.', 0, () => { frame.splice(frame.findIndex(j => j.id === job.id), 1); if (!frame.length)
                s.frames.pop(); if (!executeSimple(s, job, r))
                s.current = job; });
        return out;
    }
    const begin = (effects: readonly MarsEffect[], source: string) => { s.actionInProgress = true; const cost = effects.find(e => e.kind === 'pay'); if (cost?.kind === 'pay')
        s.payment = { cost: cost.amount, material: cost.material, source, mode: 'effect', cardId: null }; enqueue(s, payNegatives(p, effects.filter(e => e.kind !== 'pay')), source); };
    if (s.stage === 'FINAL_GREENERY') {
        const plants = p.corporationId === 'EcoLine' ? 7 : 8;
        if (p.resources.plants >= plants && marsSpaces(s, p.playerId, 'greenery').length)
            offer('final-greenery', 'CONVERT', 'greenery', '마지막 녹지 배치', `식물 ${plants} 사용`, 0, () => { p.resources.plants -= plants; begin([{ kind: 'place', tile: 'greenery', rule: 'normal' }], '마지막 녹지'); });
        offer('final-pass', 'PASS', 'pass', '녹지 전환 마치기', '내 마지막 녹지 배치를 마칩니다.', 0, () => { p.passed = true; nextTurn(s, now, r); });
        return out;
    }
    if (!p.initialActionDone) {
        if (p.corporationId === 'TharsisRepublic') {
            offer('initial-city', 'ACTION', 'corporation', '기업 첫 행동: 도시 배치', '무료로 도시를 배치합니다.', 0, () => { p.initialActionDone = true; begin([{ kind: 'place', tile: 'city', rule: 'normal' }], '기업 첫 도시'); });
            return out;
        }
        if (p.corporationId === 'Inventrix') {
            offer('initial-draw', 'ACTION', 'corporation', '기업 첫 행동: 카드 3장', '비공개 카드 3장을 획득합니다.', 0, () => { p.initialActionDone = true; begin([{ kind: 'draw', amount: 3 }], '기업 연구'); });
            return out;
        }
    }
    for (const c of p.hand) {
        const d = marsCard(c.definitionId);
        if (!marsCardReason(s, p, d))
            offer(`card:${c.tileId}`, 'CARD', c.tileId, d.name, `카드 비용 ${marsCost(p, d)} M€ · 지불 방법 선택`, marsCost(p, d), () => { s.payment = { cost: marsCost(p, d), material: material(d), source: d.name, mode: 'card', cardId: c.tileId }; });
    }
    const projects: {
        id: 'power' | 'asteroid' | 'aquifer' | 'greenery' | 'city';
        label: string;
        cost: number;
        effects: MarsEffect[];
        allowed: boolean;
    }[] = [
        { id: 'power', label: '발전소 건설', cost: p.corporationId === 'Thorgate' ? 8 : 11, effects: [{ kind: 'production', resource: 'energy', amount: 1 }], allowed: true },
        { id: 'asteroid', label: '소행성 충돌', cost: 14, effects: [{ kind: 'global', track: 'temperature', amount: 1 }], allowed: s.temperature < 8 },
        { id: 'aquifer', label: '지하수 추출', cost: 18, effects: [{ kind: 'place', tile: 'ocean', rule: 'normal' }], allowed: s.oceans < 9 },
        { id: 'greenery', label: '녹지 조성', cost: 23, effects: [{ kind: 'place', tile: 'greenery', rule: 'normal' }], allowed: true },
        { id: 'city', label: '도시 건설', cost: 25, effects: [{ kind: 'place', tile: 'city', rule: 'normal' }, { kind: 'production', resource: 'money', amount: 1 }], allowed: true },
    ];
    for (const project of projects)
        if (project.allowed && amountAvailable(p) >= project.cost && effectsPossible(s, p, project.effects, ''))
            offer(`project:${project.id}`, 'PROJECT', project.id, project.label, project.effects.map(marsEffectText).join(' · '), project.cost, () => { begin([{ kind: 'pay', amount: project.cost, material: 'none' }, ...project.effects, ...(marsStandardProjectIncome(p, project.id, project.cost) ? [{ kind: 'stock' as const, resource: 'money' as const, amount: marsStandardProjectIncome(p, project.id, project.cost) }] : [])], project.label); });
    for (const c of p.hand)
        offer(`sell:${c.tileId}`, 'PROJECT', c.tileId, `특허 매각: ${marsCard(c.definitionId).name}`, '이 카드 1장 버리고 M€ 1 획득', 0, () => { p.hand.splice(p.hand.indexOf(c), 1); s.discard.push(c); p.resources.money++; s.actionInProgress = true; log(s, 'ACTION', '특허 매각 · 카드 1장'); });
    const plants = p.corporationId === 'EcoLine' ? 7 : 8;
    if (p.resources.plants >= plants && marsSpaces(s, p.playerId, 'greenery').length)
        offer('plants', 'CONVERT', 'greenery', '식물 → 녹지', `식물 ${plants} 사용`, 0, () => { p.resources.plants -= plants; begin([{ kind: 'place', tile: 'greenery', rule: 'normal' }], '녹지 전환'); });
    if (p.resources.heat >= 8 && s.temperature < 8)
        offer('heat', 'CONVERT', 'heat', '열 → 기온', `열 8 사용 · 기온 +1단계`, 0, () => { p.resources.heat -= 8; begin([{ kind: 'global', track: 'temperature', amount: 1 }], '기온 상승'); });
    for (const c of p.played) {
        const d = marsCard(c.definitionId);
        if (d.actions && c.usedGeneration !== s.generation && effectsPossible(s, p, d.actions, c.tileId))
            offer(`action:${c.tileId}`, 'ACTION', c.tileId, `${d.name} 행동`, d.actions.map(marsEffectText).join(' · '), 0, () => { c.usedGeneration = s.generation; begin(d.actions!, c.tileId); log(s, 'ACTION', `${d.name} 행동 사용`); });
    }
    if (p.corporationId === 'UnitedNationsMarsInitiative' && p.corporationUsedGeneration !== s.generation && p.tr > p.generationStartTr && amountAvailable(p) >= 3)
        offer('unmi', 'ACTION', 'corporation', '국제연합: TR +1', 'M€ 3 사용 · 이번 세대 TR 상승 필요', 3, () => { p.corporationUsedGeneration = s.generation; begin([{ kind: 'pay', amount: 3, material: 'none' }, { kind: 'global', track: 'tr', amount: 1 }], '국제연합 화성계획'); });
    if (s.milestones.length < 3 && amountAvailable(p) >= 8)
        for (const m of MARS_MILESTONES)
            if (!s.milestones.some(c => c.id === m.id) && milestoneEligible(s, p, m.id))
                offer(`milestone:${m.id}`, 'MILESTONE', m.id, `${m.name} 달성`, m.detail + ' · 종료 5점', 8, () => { s.milestones.push({ id: m.id, playerId: p.playerId }); begin([{ kind: 'pay', amount: 8, material: 'none' }], m.name); log(s, 'CLAIM', `업적: ${m.name}`); });
    const awardCost = [8, 14, 20][s.awards.length];
    if (awardCost !== undefined && amountAvailable(p) >= awardCost)
        for (const a of MARS_AWARDS)
            if (!s.awards.some(c => c.id === a.id))
                offer(`award:${a.id}`, 'AWARD', a.id, `${a.name} 후원`, a.detail + ' · 최종 순위로 점수', awardCost, () => { s.awards.push({ id: a.id, playerId: p.playerId }); begin([{ kind: 'pay', amount: awardCost, material: 'none' }], a.name); log(s, 'CLAIM', `기업상 후원: ${a.name}`); });
    if (s.actionsTaken === 1)
        offer('end', 'END', 'end', '이번 차례 마치기', '다음 차례에 다시 행동할 수 있습니다.', 0, () => nextTurn(s, now, r));
    if (s.actionsTaken === 0)
        offer('pass', 'PASS', 'pass', '이번 세대 패스', '이번 세대에는 더 행동하지 않습니다.', 0, () => { p.passed = true; log(s, 'PASS', '이번 세대 패스'); nextTurn(s, now, r); });
    return out;
}
export function marsOffers(s: MarsState, viewer: PlayerId): MarsOffer[] { return choices(s, viewer, s.startedAt, { nextInt: () => 0 }).map(c => c.offer); }
function selectCards(s: MarsState, p: Person, ids: readonly TileId[], corporationId?: string, heat = 0): boolean {
    if (p.ready || new Set(ids).size !== ids.length || ids.some(id => !p.research.some(c => c.tileId === id)))
        return false;
    let kept = ids;
    if (corporationId !== undefined) {
        if (corporationId !== 'Beginner' && !p.corporations.includes(corporationId))
            return false;
        const start = marsCorporationStart(corporationId, 'base');
        p.corporationId = corporationId;
        p.resources = start.resources;
        p.production = start.production;
        if (corporationId === 'Beginner')
            kept = p.research.map(c => c.tileId);
        p.initialActionDone = !['Inventrix', 'TharsisRepublic'].includes(corporationId);
    }
    const cost = corporationId === 'Beginner' ? 0 : kept.length * 3;
    if (heat > cost || heat > p.resources.heat || (heat > 0 && p.corporationId !== 'Helion') || p.resources.money < cost - heat)
        return false;
    p.resources.money -= cost - heat;
    p.resources.heat -= heat;
    p.hand.push(...p.research.filter(c => kept.includes(c.tileId)));
    s.discard.push(...p.research.filter(c => !kept.includes(c.tileId)));
    p.research = [];
    p.ready = true;
    log(s, corporationId !== undefined ? 'SETUP' : 'RESEARCH', '카드 선택 완료', p.playerId);
    if (s.players.every(p => p.ready)) {
        s.stage = 'ACTION';
        s.activePlayerId = s.startingPlayerId;
        for (const p of s.players)
            p.generationStartTr = p.tr;
    }
    return true;
}
export function applyMarsAction(current: MarsState, actor: PlayerId, input: unknown, now: ServerTime, turnId: TurnId, r: RandomSource): {
    ok: true;
    state: MarsState;
} | {
    ok: false;
    reason: 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'INVALID_PHASE';
} {
    const payload = v.safeParse(MarsActionSchema, input);
    if (!payload.success)
        return { ok: false, reason: 'INVALID_ACTION' };
    const s = parseMarsState(current), p = s.players.find(p => p.playerId === actor), a = payload.output;
    if (s.phase !== 'PLAYING' || !p)
        return { ok: false, reason: 'INVALID_PHASE' };
    let accepted = false;
    if (a.type === 'SETUP' && s.stage === 'SETUP')
        accepted = selectCards(s, p, a.cardIds, a.corporationId);
    else if (a.type === 'RESEARCH' && s.stage === 'RESEARCH')
        accepted = selectCards(s, p, a.cardIds, undefined, a.heat ?? 0);
    else {
        if (actor !== s.activePlayerId)
            return { ok: false, reason: 'NOT_YOUR_TURN' };
        if (a.type === 'TAKE') {
            const option = choices(s, actor, now, r).find(c => c.offer.id === a.actionId);
            if (option) {
                option.apply();
                accepted = true;
            }
        }
        if (a.type === 'SELL' && s.stage === 'ACTION' && !s.payment && !s.current && !s.cardChoice && !s.frames.length && !s.actionInProgress && p.initialActionDone && !p.passed && new Set(a.cardIds).size === a.cardIds.length && a.cardIds.every(id => p.hand.some(c => c.tileId === id))) {
            const sold = p.hand.filter(c => a.cardIds.includes(c.tileId));
            p.hand = p.hand.filter(c => !a.cardIds.includes(c.tileId));
            s.discard.push(...sold);
            p.resources.money += sold.length;
            s.actionInProgress = true;
            log(s, 'ACTION', `특허 매각 · 카드 ${sold.length}장`);
            accepted = true;
        }
        if (a.type === 'CHOOSE_CARDS' && s.cardChoice && s.cardChoice.ownerId === actor && s.cardChoice.view.id === a.choiceId) {
            const choice = s.cardChoice.view, heat = a.heat ?? 0;
            const unique = new Set(a.cardIds).size === a.cardIds.length;
            const candidates = choice.kind === 'EXCHANGE' ? p.hand : choice.cards;
            const own = a.cardIds.every(id => candidates.some(c => c.tileId === id));
            const count = choice.kind === 'KEEP' ? a.cardIds.length === choice.keepCount : a.cardIds.length <= 1;
            const cost = choice.kind === 'BUY' ? choice.cost * a.cardIds.length : 0;
            if (unique && own && count && heat <= cost && heat <= p.resources.heat && (!heat || p.corporationId === 'Helion') && p.resources.money >= cost - heat) {
                p.resources.money -= cost - heat;
                p.resources.heat -= heat;
                if (choice.kind === 'EXCHANGE') {
                    if (a.cardIds.length) {
                        const index = p.hand.findIndex(c => c.tileId === a.cardIds[0]);
                        s.discard.push(...p.hand.splice(index, 1));
                        draw(s, p, 1, r);
                    }
                } else {
                    p.hand.push(...choice.cards.filter(c => a.cardIds.includes(c.tileId)));
                    s.discard.push(...choice.cards.filter(c => !a.cardIds.includes(c.tileId)));
                }
                s.cardChoice = null;
                log(s, 'ACTION', choice.kind === 'EXCHANGE' ? (a.cardIds.length ? '손패 1장 교환 완료' : '손패 교환 생략') : `비공개 카드 선택 완료 · ${a.cardIds.length}장 획득`);
                accepted = true;
            }
        }
        if (a.type === 'PAY' && s.payment) {
            const payment = s.payment, spend = a.payment;
            const value = marsPaymentValue(spend, marsMetalValues(p));
            const card = payment.mode === 'card' ? p.hand.find(c => c.tileId === payment.cardId) : undefined;
            const reserved = marsResources();
            if (card) for (const e of marsCard(card.definitionId).effects) if (e.kind === 'stock' && e.amount < 0) reserved[e.resource] -= e.amount;
            const remaining = {...p.resources, money:p.resources.money-spend.money, steel:p.resources.steel-spend.steel, titanium:p.resources.titanium-spend.titanium, heat:p.resources.heat-spend.heat};
            const legal = MARS_RESOURCES.every(k => remaining[k] >= reserved[k]) && spend.money <= p.resources.money && spend.steel <= p.resources.steel && spend.titanium <= p.resources.titanium && spend.heat <= p.resources.heat && (!spend.steel || ['steel', 'both'].includes(payment.material)) && (!spend.titanium || ['titanium', 'both'].includes(payment.material)) && (!spend.heat || p.corporationId === 'Helion') && value >= payment.cost;
            if (legal) {
                for (const k of ['money', 'steel', 'titanium', 'heat'] as const)
                    p.resources[k] -= spend[k];
                s.payment = null;
                if (payment.mode === 'card') {
                    const c = p.hand.find(c => c.tileId === payment.cardId);
                    if (!c)
                        return { ok: false, reason: 'INVALID_ACTION' };
                    const d = marsCard(c.definitionId);
                    p.hand.splice(p.hand.indexOf(c), 1);
                    p.played.push(c);
                    p.specialDesign = false;
                    p.nextCardDiscount = 0;
                    s.actionInProgress = true;
                    enqueue(s, [...payNegatives(p, d.effects), ...marsScienceExchangeEffects(p, d)], c.tileId);
                    playedTriggers(s, p, d);
                    log(s, 'CARD', `${d.name} · 지불 ${value} M€ 가치`);
                }
                accepted = true;
            }
        }
    }
    if (!accepted)
        return { ok: false, reason: 'INVALID_ACTION' };
    drain(s, now, r);
    sync(s);
    s.revision = v.parse(GameRevisionSchema, s.revision + 1);
    s.transitionId = turnId;
    return { ok: true, state: parseMarsState(s) };
}
export function cancelMars(current: MarsState, now: ServerTime): MarsState { const s = parseMarsState(current); finish(s, now, 'CANCELLED'); s.revision = v.parse(GameRevisionSchema, s.revision + 1); return parseMarsState(s); }
