import * as v from 'valibot';
import { DuelActionSchema, GameRevisionSchema, duelCard, duelWonder, DUEL_CONSPIRACIES, type DuelAction, type PlayerId, type ServerTime, type TurnId } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { parseDuelState, task, other, type DuelState, type DuelSeat, type DuelTask, type DuelEntity } from './state.js';
import { choices, decisionActor, available, type DuelOperation } from './choices.js';
import { quote, science, scores, hasProgress, hasDecree, controller, countType, godCost } from './economy.js';
import { setupAge, shuffled, revealEnki } from './setup.js';
export { createDuelGame } from './setup.js';
export { parseDuelState, type DuelState } from './state.js';
function finish(s: DuelState, reason: NonNullable<DuelState['result']>['reason'], winners: DuelSeat[], now: ServerTime) { s.phase = 'FINISHED'; s.finishedAt = now; s.result = { reason, winnerPlayerIds: winners.map(p => s.players[p]!.playerId), scores: scores(s) }; s.tasks = []; }
function scienceSnapshot(s: DuelState) { return ([0, 1] as const).map(p => science(s, p)); }
function checkScience(s: DuelState, before: ReturnType<typeof scienceSnapshot>, now: ServerTime) {
    const after = scienceSnapshot(s), wins = ([0, 1] as const).filter(p => new Set(after[p]).size >= 6);
    if (wins.length) {
        finish(s, 'SCIENCE', wins, now);
        return;
    }
    const pending: DuelTask[] = [];
    for (const p of [s.active, other(s.active)])
        for (const symbol of new Set(after[p])) {
            const delta = Math.floor(after[p]!.filter(x => x === symbol).length / 2) - Math.floor(before[p]!.filter(x => x === symbol).length / 2);
            for (let i = 0; i < delta; i++)
                pending.push(task('PROGRESS', p));
        }
    s.tasks.unshift(...pending);
}
function lose(s: DuelState, p: DuelSeat, n: number) { const loss = Math.min(s.players[p]!.coins, n); s.players[p]!.coins -= loss; return loss; }
function pay(s: DuelState, p: DuelSeat, n: number, trade = 0) {
    const regular = Math.min(s.players[p]!.coins, n);
    s.players[p]!.coins -= regular;
    s.players[p]!.protectedCoins -= n - regular;
    if (hasProgress(s, other(p), 'economy'))
        s.players[other(p)]!.coins += trade;
}
function tokenTasks(s: DuelState, p: DuelSeat, n: number): DuelTask[] {
    s.militaryTokens = s.militaryTokens.filter(t => t !== n);
    if (s.settings.agora)
        return Math.abs(n) === 3 ? [task('PLACE', p)] : [task('MOVE', p), task('REMOVE', p)];
    lose(s, other(p), Math.abs(n) === 3 ? 2 : 5);
    return [];
}
function tokenEffect(s: DuelState, p: DuelSeat, n: number) { s.tasks.unshift(...tokenTasks(s, p, n)); }
function military(s: DuelState, p: DuelSeat, n: number, now: ServerTime) {
    const pending: DuelTask[] = [];
    for (let i = 0; i < n && s.phase === 'PLAYING'; i++) {
        const next = s.military + (p === 0 ? 1 : -1);
        if (s.minerva === next) {
            s.minerva = null;
            break;
        }
        s.military = next;
        if (hasProgress(s, p, 'poliorcetics'))
            lose(s, other(p), 1);
        if (Math.abs(next) === 9) {
            finish(s, 'MILITARY', [p], now);
            break;
        }
        if (s.militaryTokens.includes(next))
            pending.push(...tokenTasks(s, p, next));
    }
    if (s.phase === 'PLAYING')
        s.tasks.unshift(...pending);
}
function senateChange(s: DuelState, before: DuelSeat | null, now: ServerTime) {
    for (const d of s.decrees)
        if (s.players.some(p => p.influence[d.chamber]! > 0))
            d.revealed = true;
    const decree = s.decrees.find(d => d.id === 9 && d.revealed), after = decree ? controller(s, decree.chamber) : null;
    const delta = (after === 0 ? 1 : after === 1 ? -1 : 0) - (before === 0 ? 1 : before === 1 ? -1 : 0);
    if (delta)
        military(s, delta > 0 ? 0 : 1, Math.abs(delta), now);
    if (s.phase === 'PLAYING')
        for (const p of [0, 1] as const)
            if ([0, 1, 2, 3, 4, 5].every(ch => controller(s, ch) === p))
                finish(s, 'POLITICAL', [p], now);
}
function decreeShield(s: DuelState) { const d = s.decrees.find(d => d.id === 9 && d.revealed); return d ? controller(s, d.chamber) : null; }
function acquiredToken(s: DuelState, p: DuelSeat, c: DuelEntity) {
    if (c.slot === null)
        return;
    const slot = s.slots[c.slot]!;
    if (slot.mythology) {
        s.players[p]!.mythology.push(slot.mythology);
        s.tasks.unshift(task('GOD_PLACE', p, [slot.mythology]));
        slot.mythology = null;
    }
    if (slot.offering) {
        s.players[p]!.offerings.push(slot.offering);
        slot.offering = 0;
    }
}
function reveal(s: DuelState, p: DuelSeat) {
    for (const c of s.cards.filter(c => available(s, c))) {
        const slot = s.slots[c.slot!]!;
        if (!slot.faceUp) {
            slot.faceUp = true;
            acquiredToken(s, p, c);
        }
    }
}
function relocate(c: DuelEntity, zone: DuelEntity['zone'], owner: DuelEntity['owner'] = -1, under: string | null = null) { c.zone = zone; c.owner = owner; c.slot = null; c.under = under; }
function drawConspiracy(s: DuelState, p: DuelSeat) {
    const ids = s.conspiracyOrder.splice(0, 2);
    for (const id of ids) {
        const c = s.conspiracies.find(c => c.id === id)!;
        c.zone = 'CHOICE';
        c.owner = p;
    }
    if (hasProgress(s, p, 'organized-crime'))
        for (const id of ids)
            s.conspiracies.find(c => c.id === id)!.zone = 'HAND';
    else if (ids.length)
        s.tasks.unshift(task('CONSPIRACY_PICK', p, ids));
}
function addEffect(s: DuelState, p: DuelSeat, effect: string, random: RandomSource, source = '') {
    switch (effect) {
        case 'LIBRARY':
            s.tasks.unshift(task('LIBRARY', p, shuffled(s.progress.filter(t => t.zone === 'BOX').map(t => t.id), random).slice(0, 3)));
            break;
        case 'BOX_PROGRESS':
            s.tasks.unshift(task('LIBRARY', p, s.progress.filter(t => t.zone === 'BOX').map(t => t.id)));
            break;
        case 'THEATER':
            s.tasks.unshift(task('GOD_DECK', p));
            break;
        case 'KNOSSOS':
            s.tasks.unshift(task('PLACE', p), task('MOVE', p));
            break;
        case 'POLITICAL':
            s.tasks.unshift(task('PLACE', p), task('REMOVE', p), task('MOVE', p));
            break;
        case 'DISCARD_TWO':
            s.tasks.unshift(task('DISCARD_TWO', p, [], 2, -1, true));
            break;
        default: {
            const kinds: readonly string[] = ['RESURRECT', 'DESTROY_BROWN', 'DESTROY_GREY', 'DESTROY_BLUE', 'DESTROY_YELLOW', 'STEAL_RESOURCE', 'STEAL_WONDER', 'UNPREPARED', 'LOCK_PROGRESS', 'SWAP', 'MOVE_DECREE', 'BOX_BUILD', 'TOP_BUILD', 'SABOTAGE'];
            for (const kind of kinds)
                if (effect === kind) {
                    const parsed = task('RESURRECT', p, source ? [source] : []);
                    const matching = (['RESURRECT', 'DESTROY_BROWN', 'DESTROY_GREY', 'DESTROY_BLUE', 'DESTROY_YELLOW', 'STEAL_RESOURCE', 'STEAL_WONDER', 'UNPREPARED', 'LOCK_PROGRESS', 'SWAP', 'MOVE_DECREE', 'BOX_BUILD', 'TOP_BUILD', 'SABOTAGE'] as const).find(k => k === effect);
                    if (matching) {
                        parsed.kind = matching;
                        s.tasks.unshift(parsed);
                    }
                    break;
                }
        }
    }
}
function build(s: DuelState, p: DuelSeat, c: DuelEntity, now: ServerTime, random: RandomSource, paid: boolean) {
    const before = scienceSnapshot(s), d = duelCard(c.definitionId), q = quote(s, p, d);
    if (paid) {
        pay(s, p, q.total, q.trade);
        if (q.method === 'CHAIN' && hasProgress(s, p, 'urbanism'))
            s.players[p]!.coins += 4;
    }
    acquiredToken(s, p, c);
    relocate(c, 'CITY', p);
    const me = s.players[p]!;
    me.coins += (d.income ?? 0) + (d.incomePer ? countType(s, p, d.incomePer) * (d.incomeMultiplier ?? 1) : 0);
    if (d.guild && d.guild !== 'WONDER' && d.guild !== 'COINS')
        me.coins += Math.max(countType(s, 0, d.guild), countType(s, 1, d.guild));
    const decree = ({ BLUE: 1, GREEN: 2, YELLOW: 3, RED: 4 } as Partial<Record<string, number>>)[d.color];
    if (decree)
        for (const who of [0, 1] as const)
            if (hasDecree(s, who, decree))
                s.players[who]!.coins += s.age;
    if (d.color === 'WHITE')
        s.tasks.unshift(task('SENATE', p, [], Math.min(3, 1 + Math.floor((countType(s, p, 'BLUE') + (hasDecree(s, p, 12) ? 2 : 0)) / 2)), d.section ?? -1));
    if (d.color === 'BLACK') {
        s.tasks.unshift(task('CONSPIRE', p));
        if (hasDecree(s, p, 16))
            s.replay = true;
    }
    military(s, p, d.shields + (d.color === 'RED' && hasProgress(s, p, 'strategy') ? 1 : 0), now);
    if (s.phase === 'PLAYING')
        checkScience(s, before, now);
    void random;
}
function constructWonder(s: DuelState, p: DuelSeat, c: DuelEntity, id: string, now: ServerTime, random: RandomSource, paid: boolean) {
    const w = s.wonders.find(w => w.id === id)!, d = duelWonder(id);
    if (paid) {
        const q = quote(s, p, d);
        pay(s, p, q.total, q.trade);
    }
    acquiredToken(s, p, c);
    relocate(c, 'WONDER', p, id);
    w.built = true;
    if (s.wonders.filter(w => w.built || w.removed).length >= 7)
        for (const rest of s.wonders)
            if (!rest.built)
                rest.removed = true;
    s.players[p]!.coins += d.coins ?? 0;
    lose(s, other(p), d.loss ?? 0);
    s.replay ||= !!d.replay || hasProgress(s, p, 'theology');
    for (const who of [0, 1] as const)
        if (hasDecree(s, who, 14))
            s.players[who]!.coins += s.age;
    if (d.effect)
        addEffect(s, p, d.effect, random);
    military(s, p, d.shields ?? 0, now);
}
function god(s: DuelState, p: DuelSeat, id: string, now: ServerTime, random: RandomSource) {
    const before = scienceSnapshot(s);
    s.players[p]!.gods.push(id);
    const map: Partial<Record<string, DuelTask['kind']>> = { enki: 'ENKI', nisaba: 'SNAKE', baal: 'STEAL_RESOURCE', hades: 'RESURRECT', zeus: 'DISCARD_ANY', anubis: 'ANUBIS', isis: 'ISIS', ra: 'STEAL_WONDER', minerva: 'MINERVA' };
    const kind = map[id];
    if (kind)
        s.tasks.unshift(task(kind, p));
    if (id === 'astarte')
        s.players[p]!.protectedCoins += 7;
    if (id === 'tanit')
        s.players[p]!.coins += 12;
    if (id === 'mars')
        military(s, p, 2, now);
    if (id === 'neptune')
        s.tasks.unshift(task('NEPTUNE_DISCARD', p), task('NEPTUNE_APPLY', p));
    if (id === 'gate') {
        const ids = s.godDecks.flatMap(d => d.ids.slice(0, 1));
        s.revealedGods = ids;
        if (ids.includes('enki'))
            revealEnki(s, random);
        s.tasks.unshift(task('GOD_TOP', p, ids));
    }
    if (s.phase === 'PLAYING')
        checkScience(s, before, now);
}
function trigger(s: DuelState, p: DuelSeat, id: string, now: ServerTime, random: RandomSource) {
    const c = s.conspiracies.find(c => c.id === id)!, d = DUEL_CONSPIRACIES.find(d => d.id === c.definitionId)!;
    c.triggered = true;
    if (d.move) {
        const exchangeAvailable = d.effect !== 'SWAP' || s.cards.some(a => a.zone === 'CITY' && a.owner === p && ['BLUE', 'GREEN'].includes(duelCard(a.definitionId).color) && s.cards.some(b => b.zone === 'CITY' && b.owner === other(p) && duelCard(b.definitionId).color === duelCard(a.definitionId).color));
        s.tasks.unshift(task(exchangeAvailable ? 'MOVE' : 'PLACE', p));
    }
    if (d.effect === 'HALF_COINS') {
        const n = lose(s, other(p), Math.ceil(s.players[other(p)]!.coins / 2));
        s.players[p]!.coins += n;
    }
    else if (d.effect === 'COUP')
        military(s, p, 2, now);
    else if (d.effect === 'INFLUENCE_COINS') {
        s.players[p]!.coins += s.players[p]!.influence.reduce((a, b) => a + b, 0);
        lose(s, other(p), s.players[other(p)]!.influence.reduce((a, b) => a + b, 0));
    }
    else
        addEffect(s, p, d.effect, random, id);
}
function handoff(s: DuelState, p: DuelSeat, now: ServerTime, random: RandomSource) {
    if (!s.cards.some(c => c.zone === 'BOARD')) {
        if (s.age === 3) {
            const results = scores(s), best = Math.max(...results.map(r => r.total)), tied = results.filter(r => r.total === best), blue = Math.max(...tied.map(r => r.blue));
            finish(s, 'SCORED', ([0, 1] as const).filter(i => results[i]!.total === best && results[i]!.blue === blue), now);
            return;
        }
        s.age = s.age === 1 ? 2 : 3;
        setupAge(s, random);
        s.active = s.military > 0 ? 1 : s.military < 0 ? 0 : p;
        s.stage = 'NEXT_AGE';
        s.replay = false;
        return;
    }
    s.active = s.replay ? p : other(p);
    s.replay = false;
    s.stage = 'TURN_START';
}
function pump(s: DuelState, now: ServerTime, random: RandomSource) {
    for (let guard = 0; guard < 200 && s.phase === 'PLAYING'; guard++) {
        const t = s.tasks[0];
        if (!t) {
            if (s.stage === 'DRAFT') {
                if (s.draftCount === 8) {
                    s.active = s.starter;
                    s.stage = 'TURN_START';
                }
                else
                    s.active = ([0, 1, 1, 0, 1, 0, 0, 1][s.draftCount] === 0 ? s.starter : other(s.starter));
            }
            return;
        }
        if (t.kind === 'REVEAL') {
            s.tasks.shift();
            reveal(s, t.actor);
            continue;
        }
        if (t.kind === 'HANDOFF') {
            s.tasks.shift();
            handoff(s, t.actor, now, random);
            continue;
        }
        if (t.kind === 'CHECK_SCIENCE') {
            s.tasks.shift();
            continue;
        }
        if (!choices(s).length) {
            s.tasks.shift();
            continue;
        }
        return;
    }
}
function execute(s: DuelState, p: DuelSeat, a: DuelOperation, now: ServerTime, random: RandomSource) {
    const pending = s.tasks.shift(), beforeScience = scienceSnapshot(s), beforeShield = decreeShield(s), c = s.cards.find(c => c.tileId === a.a);
    const main = !pending && ['BUILD', 'DISCARD', 'WONDER', 'PREPARE', 'INVOKE'].includes(a.kind);
    if (main) {
        s.stage = 'ACTION';
        s.tasks.push(task('REVEAL', p), task('HANDOFF', p));
    }
    switch (a.kind) {
        case 'SKIP': break;
        case 'DRAFT': {
            const w = s.wonders.find(w => w.id === a.a)!;
            w.owner = p;
            s.draftCount++;
            const e = duelWonder(w.id).onSelect;
            if (e === 'CONSPIRE')
                drawConspiracy(s, p);
            if (e === 'PLACE')
                s.tasks.unshift(task('PLACE', p));
            break;
        }
        case 'STARTER':
            s.active = a.n === 0 ? 0 : 1;
            s.stage = 'TURN_START';
            break;
        case 'BUILD':
        case 'FREE_BUILD':
            build(s, p, c!, now, random, a.kind === 'BUILD');
            if (a.kind === 'FREE_BUILD' && s.phase === 'PLAYING')
                reveal(s, p);
            break;
        case 'WONDER':
        case 'FREE_WONDER':
            constructWonder(s, p, c!, a.b, now, random, a.kind === 'WONDER');
            break;
        case 'DISCARD':
            acquiredToken(s, p, c!);
            relocate(c!, 'DISCARD');
            s.players[p]!.coins += 2 + countType(s, p, 'YELLOW') + (hasDecree(s, p, 13) ? 2 : 0);
            break;
        case 'PREPARE':
            acquiredToken(s, p, c!);
            relocate(c!, 'PREPARED', p, a.b);
            break;
        case 'INVOKE': {
            const slot = Number(a.a), id = s.pantheon[slot]!, offering = s.players[p]!.offerings.reduce((n, v, i) => n + ((a.n & (1 << i)) ? v : 0), 0);
            pay(s, p, godCost(s, p, slot, offering));
            s.players[p]!.offerings = s.players[p]!.offerings.filter((_, i) => !(a.n & (1 << i)));
            s.pantheon[slot] = null;
            god(s, p, id, now, random);
            break;
        }
        case 'TRIGGER':
            if (!pending)
                s.stage = 'ACTION';
            trigger(s, p, a.a, now, random);
            break;
        case 'PROGRESS': {
            const token = s.progress.find(t => t.id === a.a)!;
            token.zone = 'PLAYER';
            token.owner = p;
            if (['agriculture', 'urbanism'].includes(a.a))
                s.players[p]!.coins += 6;
            if (pending?.kind === 'ENKI') {
                for (const t of s.progress)
                    if (t.zone === 'ENKI')
                        t.zone = 'BOX';
            }
            checkScience(s, beforeScience, now);
            break;
        }
        case 'DESTROY':
            relocate(c!, 'DISCARD');
            for (const player of s.players)
                if (player.snake === c!.tileId)
                    player.snake = null;
            break;
        case 'STEAL':
            c!.owner = p;
            break;
        case 'PICK_GOD': {
            const deck = s.godDecks.find(d => d.ids.includes(a.a))!;
            deck.ids = deck.ids.filter(id => id !== a.a);
            s.tasks.unshift(task('GOD_SLOT', p, [a.a]));
            break;
        }
        case 'PLACE_GOD':
            s.pantheon[a.n] = a.a;
            s.pantheonKnown[a.n] = [p];
            break;
        case 'GOD_DECK': {
            const deck = s.godDecks.find(d => d.mythology === a.a)!;
            s.revealedGods = [...deck.ids];
            if (deck.ids.includes('enki'))
                revealEnki(s, random);
            s.tasks.unshift(task('GOD_PICK', p, [...deck.ids]), task('GOD_ORDER', p, [a.a]));
            break;
        }
        case 'FREE_GOD': {
            for (const deck of s.godDecks)
                deck.ids = deck.ids.filter(id => id !== a.a);
            s.revealedGods = s.revealedGods.filter(id => id !== a.a);
            if (a.a !== 'enki')
                for (const t of s.progress)
                    if (t.zone === 'ENKI' && !s.pantheon.includes('enki'))
                        t.zone = 'BOX';
            god(s, p, a.a, now, random);
            if (pending?.kind === 'GOD_TOP')
                s.revealedGods = [];
            break;
        }
        case 'ORDER_GOD': {
            const t = pending!, deck = s.godDecks.find(d => d.mythology === t.data[0])!;
            t.data.push(a.a);
            if (t.data.length - 1 < deck.ids.length)
                s.tasks.unshift(t);
            else {
                deck.ids = t.data.slice(1);
                s.revealedGods = [];
            }
            break;
        }
        case 'SNAKE':
            s.players[p]!.snake = c!.tileId;
            checkScience(s, beforeScience, now);
            break;
        case 'MINERVA':
            s.minerva = a.n;
            break;
        case 'NEPTUNE_DISCARD':
            s.militaryTokens = s.militaryTokens.filter(n => n !== a.n);
            break;
        case 'NEPTUNE_APPLY':
            tokenEffect(s, p, a.n);
            break;
        case 'ANUBIS':
        case 'SABOTAGE': {
            const w = s.wonders.find(w => w.id === a.a)!;
            const under = s.cards.find(c => c.zone === 'WONDER' && c.under === w.id)!;
            relocate(under, 'DISCARD');
            w.built = false;
            if (a.kind === 'SABOTAGE')
                w.removed = true;
            if (w.owner !== -1)
                military(s, other(w.owner), duelWonder(w.id).shields ?? 0, now);
            break;
        }
        case 'STEAL_WONDER':
            s.wonders.find(w => w.id === a.a)!.owner = p;
            break;
        case 'PLACE':
            s.players[p]!.influence[a.n]!++;
            senateChange(s, beforeShield, now);
            if (s.phase === 'PLAYING' && pending!.remaining > 1)
                s.tasks.unshift({ ...pending!, remaining: pending!.remaining - 1 });
            break;
        case 'MOVE':
            s.players[p]!.influence[Number(a.a)]!--;
            s.players[p]!.influence[a.n]!++;
            senateChange(s, beforeShield, now);
            if (s.phase === 'PLAYING' && pending!.remaining > 1)
                s.tasks.unshift({ ...pending!, remaining: pending!.remaining - 1 });
            break;
        case 'REMOVE':
            s.players[other(p)]!.influence[a.n]!--;
            senateChange(s, beforeShield, now);
            break;
        case 'CONSPIRATOR_PLACE':
            s.tasks.unshift(task('PLACE', p));
            break;
        case 'DRAW_CONSPIRACY':
            drawConspiracy(s, p);
            break;
        case 'KEEP_CONSPIRACY':
            s.conspiracies.find(c => c.id === a.a)!.zone = 'HAND';
            {
                const rest = pending!.data.filter(id => id !== a.a);
                if (rest.length)
                    s.tasks.unshift(task('CONSPIRACY_RETURN', p, rest));
            }
            break;
        case 'RETURN_CONSPIRACY':
            for (const id of pending!.data) {
                const c = s.conspiracies.find(c => c.id === id)!;
                c.zone = 'DECK';
                c.owner = -1;
                if (a.n === 0)
                    s.conspiracyOrder.unshift(c.id);
                else
                    s.conspiracyOrder.push(c.id);
            }
            break;
        case 'LOCK': {
            const t = s.progress.find(t => t.id === a.a)!;
            t.zone = 'LOCKED';
            t.owner = -1;
            t.source = a.b;
            break;
        }
        case 'SWAP': {
            const own = s.cards.find(c => c.tileId === a.b)!;
            own.owner = other(p);
            c!.owner = p;
            for (const player of s.players)
                if (player.snake === own.tileId || player.snake === c!.tileId)
                    player.snake = null;
            checkScience(s, beforeScience, now);
            break;
        }
        case 'DECREE':
            s.decrees.find(d => d.id === Number(a.a))!.chamber = a.n;
            senateChange(s, beforeShield, now);
            break;
        case 'DISCARD_EFFECT':
            acquiredToken(s, p, c!);
            relocate(c!, 'DISCARD');
            if (s.phase === 'PLAYING' && pending!.remaining > 1)
                s.tasks.unshift({ ...pending!, remaining: pending!.remaining - 1 });
            reveal(s, p);
            break;
        default: throw new Error('Unknown server-generated Duel operation.');
    }
}
export function applyDuelAction(s: DuelState, actor: PlayerId, input: DuelAction, now: ServerTime, turnId: TurnId, random: RandomSource): {
    ok: true;
    state: DuelState;
} | {
    ok: false;
    reason: 'INVALID_ACTION' | 'INVALID_PHASE' | 'NOT_YOUR_TURN';
} {
    if (s.phase !== 'PLAYING')
        return { ok: false, reason: 'INVALID_PHASE' };
    const p = decisionActor(s);
    if (s.players[p]!.playerId !== actor)
        return { ok: false, reason: 'NOT_YOUR_TURN' };
    const parsed = v.safeParse(DuelActionSchema, input);
    if (!parsed.success)
        return { ok: false, reason: 'INVALID_ACTION' };
    const selected = choices(s).find(c => c.view.id === parsed.output.optionId);
    if (!selected)
        return { ok: false, reason: 'INVALID_ACTION' };
    const next = structuredClone(s);
    execute(next, p, selected.operation, now, random);
    pump(next, now, random);
    next.revision = v.parse(GameRevisionSchema, s.revision + 1);
    next.transitionId = turnId;
    const kind = selected.operation.kind, sound = next.phase === 'FINISHED' ? 'finish' : kind === 'WONDER' || kind === 'FREE_WONDER' ? 'wonder' : kind.includes('GOD') || kind === 'INVOKE' ? 'god' : kind === 'TRIGGER' ? 'conspiracy' : ['PLACE', 'MOVE', 'REMOVE', 'DECREE'].includes(kind) ? 'senate' : kind === 'PROGRESS' ? 'science' : kind === 'DISCARD' ? 'coin' : next.military !== s.military ? 'military' : selected.operation.kind === 'BUILD' && selected.view.definitionId && duelCard(selected.view.definitionId).science ? 'science' : 'card';
    const hidden = ['PICK_GOD', 'PLACE_GOD', 'KEEP_CONSPIRACY', 'RETURN_CONSPIRACY', 'LOCK', 'ORDER_GOD', 'PREPARE'].includes(kind);
    next.history.push({ id: next.revision, playerId: actor, text: hidden ? '비공개 선택을 완료했습니다.' : selected.view.label, sound });
    return { ok: true, state: parseDuelState(next) };
}
export function cancelDuel(s: DuelState, now: ServerTime): DuelState { const next = structuredClone(s); finish(next, 'CANCELLED', [], now); next.revision = v.parse(GameRevisionSchema, next.revision + 1); return parseDuelState(next); }
