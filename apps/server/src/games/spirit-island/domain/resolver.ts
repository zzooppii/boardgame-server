import { SPIRIT_ELEMENTS, SPIRIT_ELEMENT_LABELS, spiritDefinition, spiritPower, type PlayerId, type SpiritChoiceOption, type SpiritPiece } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { powerSteps } from './powers.js';
import { step, prepend, player, land, presence, sacred, inRange, countPieces, invaders, makePiece, event, fear, damagePiece, removePiece, health, defense, matches, checkEnd, income, cardPower, requireRule } from './primitives.js';
export type SpiritOption = SpiritChoiceOption & {
    apply(): void;
};
const kinds: readonly SpiritPiece['kind'][] = ['EXPLORER', 'TOWN', 'CITY', 'DAHAN'];
const labels: Record<SpiritPiece['kind'], string> = { EXPLORER: '탐험가', TOWN: '마을', CITY: '도시', DAHAN: '다한' };
const selectedKinds = (e: SpiritStep) => kinds.filter(k => e.tags.includes(k));
const branchNames: Record<string, string> = { DAMAGE: '피해', REMOVE_BLIGHT: '오염 제거', DEFEND: '방어', FEAR: '공포', PUSH_DAHAN: '다한 밀기', PUSH_EXPLORER: '탐험가 밀기', PUSH_INVADERS: '탐험가/마을 밀기', GATHER_DAHAN: '다한 모으기', GATHER_INVADERS: '탐험가/마을 모으기', EACH_BUILDING: '각 마을/도시 피해', HUNT: '다한마다 서로 다른 침략자에게 피해 1' };
export function branch(s: SpiritState, e: SpiritStep, key: string) {
    const [k, raw] = key.split(':'), n = Number(raw);
    requireRule(Number.isSafeInteger(n) && n >= 0);
    if (k === 'DAMAGE' || k === 'REMOVE_BLIGHT' || k === 'DEFEND' || k === 'FEAR')
        prepend(s, { ...e, kind: k, n, key: '', tags: [] });
    else if (k === 'REMOVE_EXPLORERS' || k === 'REMOVE_TOWN')
        prepend(s, { ...e, kind: 'REMOVE', n, key: '', tags: k === 'REMOVE_TOWN' ? ['TOWN'] : ['EXPLORER'] });
    else if (k === 'HUNT')
        prepend(s, { ...e, kind: 'DAMAGE', n: countPieces(land(s, e.land), ['DAHAN']), key: 'HUNT', tags: ['DISTINCT'], used: [] });
    else if (k === 'EACH_BUILDING')
        prepend(s, { ...e, kind: 'EACH_DAMAGE', n, key: '', tags: ['TOWN', 'CITY'] });
    else if (k === 'PUSH_DAHAN' || k === 'PUSH_EXPLORER' || k === 'PUSH_INVADERS' || k === 'GATHER_DAHAN' || k === 'GATHER_INVADERS')
        prepend(s, { ...e, kind: 'MOVE', n, key: k.startsWith('GATHER') ? 'GATHER' : 'PUSH', tags: k.endsWith('DAHAN') ? ['DAHAN'] : k.endsWith('EXPLORER') ? ['EXPLORER', 'REQUIRED'] : ['EXPLORER', 'TOWN', 'REQUIRED'], used: [] });
    else
        throw new Error('Unknown branch');
}
function receive(s: SpiritState, recipient: PlayerId, cardId: string) { player(s, recipient).hand.push(cardId); event(s, 'CARD', `${spiritPower(cardPower(s, cardId).key).title} 획득`, recipient); if (cardPower(s, cardId).deck === 'MAJOR')
    prepend(s, step('FORGET', recipient, null, 1)); }
function draw(s: SpiritState, e: SpiritStep, deck: 'MINOR' | 'MAJOR') {
    const pile = deck === 'MINOR' ? s.minor : s.major, discard = deck === 'MINOR' ? s.minorDiscard : s.majorDiscard;
    // The application supplies a fresh shuffled discard order before a draw can require it.
    while (pile.length < 4 && discard.length)
        pile.push(discard.shift()!);
    s.offered = pile.splice(0, 4);
    s.offerRecipient = e.target ?? e.actor;
    s.offerOther = e.key === 'ENTWINE' ? e.actor : null;
    s.offerDeck = deck;
    if (s.offered.length)
        prepend(s, step('SPECIAL', s.offerRecipient, null, 0, 'TAKE_CARD', s.offerRecipient));
}
function moveRemaining(s: SpiritState, e: SpiritStep, pieceId: string, dest: string) { if (e.n > 1)
    prepend(s, { ...e, n: e.n - 1, used: [...e.used, pieceId, ...(e.tags.includes('SPREAD') ? [`land:${dest}`] : [])] }); }
function extraFear(s: SpiritState, e: SpiritStep, piece: SpiritPiece, killed: boolean) { if (!killed)
    return; if (e.tags.includes('BONUS_FEAR'))
    fear(s, 1, e.actor); if (e.tags.includes('MISTS') && (piece.kind === 'TOWN' || piece.kind === 'CITY')) {
    const prior = s.flags.find(f => f.startsWith('mists:')), n = Number(prior?.split(':')[1] ?? 0);
    if (n < 4) {
        fear(s, 1, e.actor);
        s.flags = s.flags.filter(f => !f.startsWith('mists:'));
        s.flags.push(`mists:${n + 1}`);
    }
} }
export function choiceTitle(e: SpiritStep): string { switch (e.kind) {
    case 'DAMAGE': return `피해 ${e.n} 남음 · 피해를 받을 기물을 선택하세요`;
    case 'MOVE': return `${e.key === 'GATHER' ? '모으기' : '밀기'} · 최대 ${e.n}개 · 기물과 목적지를 선택하세요`;
    case 'DESTROY': return `파괴할 기물을 선택하세요 · ${e.n >= 1000 ? '모두' : e.n + '개'}`;
    case 'REMOVE': return '제거할 침략자를 선택하세요';
    case 'REPLACE': return '교체할 기물을 선택하세요';
    case 'PRESENCE': return '현신을 꺼낼 트랙과 놓을 지역을 선택하세요';
    case 'BLIGHT': return '오염이 번질 인접 지역을 선택하세요';
    case 'GAIN': return '획득할 능력 종류를 선택하세요';
    case 'FORGET': return '주요 능력 획득 · 잊을 카드 1장을 선택하세요';
    case 'OPTION': return '이번에 사용할 효과를 선택하세요';
    case 'LAND': return '효과를 적용할 지역을 선택하세요';
    default: return e.key === 'TAKE_CARD' ? '획득할 능력 카드 선택' : e.key === 'ELEMENTS' ? `원소 ${e.n}개 더 선택` : e.key === 'GROWTH' ? '성장 효과를 원하는 순서로 처리하세요' : e.key === 'CONSTANCY_RECLAIM' ? '손으로 회수할 사용 카드 선택' : '다음 선택을 확인하세요';
} }
export function choiceOptions(s: SpiritState): SpiritOption[] {
    const e = s.queue[0];
    if (!e)
        return [];
    const list: SpiritOption[] = [];
    const add = (label: string, apply: () => void, landId: string | null = null, pieceId: string | null = null) => list.push({ id: `o${list.length}`, label, landId, pieceId, apply });
    const optional = () => add('이 선택 마치기', () => undefined);
    const l = e.land ? land(s, e.land) : null, owner = e.target ?? e.actor, p = player(s, owner);
    if (e.kind === 'DAMAGE' && e.n > 0 && l) {
        const areas = e.tags.includes('ADJACENT') ? [l, ...l.adjacent.map(id => land(s, id))] : [l];
        for (const area of areas)
            for (const piece of area.pieces.filter(p => (e.tags.includes('DAHAN_ONLY') ? p.kind === 'DAHAN' : p.kind !== 'DAHAN') && (!e.tags.includes('BUILDINGS_ONLY') || p.kind === 'TOWN' || p.kind === 'CITY') && (!e.tags.includes('DISTINCT') || !e.used.includes(p.id)))) {
                add(`${area.id} ${labels[piece.kind]} · 체력 ${health(area, piece) - piece.damage} → 피해 1`, () => { const killed = damagePiece(s, area, piece, 1, e.actor); extraFear(s, e, piece, killed); event(s, 'DAMAGE', `${area.id} ${labels[piece.kind]} ${killed ? '파괴' : '피해 1'}`, e.actor, area.id); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1, used: e.tags.includes('DISTINCT') ? [...e.used, piece.id] : e.used }); }, area.id, piece.id);
            }
    }
    else if ((e.kind === 'DESTROY' || e.kind === 'REMOVE' || e.kind === 'REPLACE') && e.n > 0 && l) {
        for (const piece of l.pieces.filter(p => selectedKinds(e).includes(p.kind) && !(p.kind === 'DAHAN' && s.flags.includes(`immortal:${l.id}`))))
            add(`${labels[piece.kind]}${piece.damage ? ' (피해 ' + piece.damage + ')' : ''} ${e.kind === 'REPLACE' ? '교체' : e.kind === 'REMOVE' ? '제거' : '파괴'}`, () => {
                removePiece(s, l, piece, e.kind === 'DESTROY', e.actor);
                extraFear(s, e, piece, e.kind === 'DESTROY');
                if (e.kind === 'REPLACE') {
                    const kind = e.key === 'DAHAN' ? 'DAHAN' : e.key === 'DOWNGRADE' ? (piece.kind === 'CITY' ? 'TOWN' : 'EXPLORER') : 'EXPLORER';
                    makePiece(s, l, kind);
                    if (e.key === 'EXPLORER2')
                        makePiece(s, l, kind);
                }
                event(s, 'DAMAGE', `${l.id} ${labels[piece.kind]} ${e.kind === 'REPLACE' ? '교체' : e.kind === 'REMOVE' ? '제거' : '파괴'}`, e.actor, l.id);
                if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1 });
            }, l.id, piece.id);
        if (e.tags.includes('OPTIONAL'))
            optional();
    }
    else if (e.kind === 'MOVE' && e.n > 0 && l) {
        const gather = e.key === 'GATHER', sources = gather ? l.adjacent.map(id => land(s, id)) : [l];
        for (const source of sources)
            for (const piece of source.pieces.filter(p => selectedKinds(e).includes(p.kind) && !e.used.includes(p.id))) {
                let destinations = gather ? [l] : e.tags.includes('ANY_LAND') ? s.lands.filter(a => a.id !== source.id) : source.adjacent.map(id => land(s, id));
                if (e.tags.includes('SPREAD')) {
                    const unused = destinations.filter(d => !e.used.includes(`land:${d.id}`));
                    if (unused.length)
                        destinations = unused;
                }
                if (e.tags.includes('MORE_BUILDINGS'))
                    destinations = destinations.filter(d => countPieces(d, ['TOWN', 'CITY']) > countPieces(source, ['TOWN', 'CITY']));
                for (const dest of destinations)
                    add(`${source.id} ${labels[piece.kind]}${piece.damage ? ' (피해 ' + piece.damage + ')' : ''} → ${dest.id}`, () => {
                        source.pieces = source.pieces.filter(q => q.id !== piece.id);
                        dest.pieces.push(piece);
                        if (e.tags.includes('HARBINGERS') && countPieces(dest, ['TOWN', 'CITY']) > 0 && !s.flags.includes('harbinger-fear')) {
                            fear(s, 1, e.actor);
                            s.flags.push('harbinger-fear');
                        }
                        if (e.tags.includes('MOVE_DEFEND')) {
                            source.defend = Math.max(0, source.defend - 2);
                            dest.defend += 2;
                        }
                        if (e.tags.includes('VIGOR'))
                            s.flags.push(`vigor:${dest.id}`);
                        moveRemaining(s, e, piece.id, dest.id);
                        event(s, 'MOVE', `${source.id} → ${dest.id} ${labels[piece.kind]} 이동`, e.actor, dest.id);
                    }, dest.id, piece.id);
            }
        if (!e.tags.includes('REQUIRED'))
            optional();
    }
    else if (e.kind === 'PRESENCE') {
        requireRule(p.spirit);
        const def = spiritDefinition(p.spirit);
        for (const track of ['energyTrack', 'cardTrack'] as const) {
            const values = track === 'energyTrack' ? def.energy : def.plays;
            if (p[track] >= values.length - 1)
                continue;
            const candidates = l ? [l] : s.lands.filter(l => inRange(s, p.playerId, l, e.n));
            for (const area of candidates)
                add(`${track === 'energyTrack' ? '에너지' : '카드'} 트랙 → ${area.id}`, () => { p[track]++; addPresenceAt(s, p.playerId, area.id); }, area.id);
        }
        // Adding Presence may instead move an existing Presence, even with covered track spaces.
        for (const from of s.lands.filter(l => presence(l, p.playerId) > 0))
            for (const to of s.lands.filter(l => l.id !== from.id && (e.land ? l.id === e.land : inRange(s, p.playerId, l, e.n))))
                add(`${from.id} 현신 → ${to.id}`, () => { const token = from.presence.find(t => t.playerId === p.playerId)!; token.count--; from.presence = from.presence.filter(t => t.count > 0); addPresenceAt(s, p.playerId, to.id); }, to.id);
        optional();
    }
    else if (e.kind === 'BLIGHT' && e.key === 'CASCADE' && l) {
        for (const id of l.adjacent.filter(id => !e.used.includes(id)))
            add(`${id}에 오염 연쇄`, () => prepend(s, { ...e, land: id, key: '', used: [...e.used, id] }), id);
    }
    else if (e.kind === 'GAIN') {
        add('보조 능력 · 4장 중 1장', () => draw(s, e, 'MINOR'));
        add('주요 능력 · 획득 후 카드 1장 망각', () => draw(s, e, 'MAJOR'));
    }
    else if (e.kind === 'FORGET') {
        for (const id of [...p.hand, ...p.discard, ...p.played])
            add(cardPower(s, id).title, () => { p.hand = p.hand.filter(c => c !== id); p.discard = p.discard.filter(c => c !== id); p.played = p.played.filter(c => c !== id); const deck = cardPower(s, id).deck; if (deck === 'MINOR')
                s.minorDiscard.push(id);
            else if (deck === 'MAJOR')
                s.majorDiscard.push(id);
            else
                s.forgotten.push(id); event(s, 'CARD', `${cardPower(s, id).title} 망각`, owner); });
    }
    else if (e.kind === 'OPTION') {
        for (const tag of e.tags) {
            const [name, n] = tag.split(':');
            add(`${branchNames[name!] ?? name}${n !== '0' ? ' ' + n : ''}`, () => branch(s, e, tag));
        }
    }
    else if (e.kind === 'LAND') {
        let candidates = s.lands;
        if (e.key === 'MANTLE')
            candidates = candidates.filter(l => presence(l, owner) > 0);
        if (e.key === 'REPEAT_LAND_PAIN')
            candidates = l ? l.adjacent.map(id => land(s, id)).filter(l => l.blight > 0) : [];
        if (e.key === 'REPEAT_WINDS')
            candidates = candidates.filter(l => inRange(s, e.actor, l, 3 + player(s, e.actor).rangeBonus, true));
        if (e.key === 'RENEWAL')
            candidates = candidates.filter(l => inRange(s, e.actor, l, 2));
        if (e.key === 'CLEAN_ADJACENT')
            candidates = l ? [l, ...l.adjacent.map(id => land(s, id))].filter(l => l.blight > 0) : [];
        if (e.key === 'FEAR_LAND')
            candidates = candidates.filter(l => fearLandAllowed(s, e, l.id));
        if (e.key === 'WINGS')
            candidates = candidates.filter(other => other.id !== l?.id);
        for (const area of candidates)
            add(area.id, () => {
                if (e.key === 'MANTLE')
                    prepend(s, step('MOVE', owner, area.id, 1, 'PUSH', owner, ['EXPLORER']), step('MOVE', owner, area.id, 1, 'PUSH', owner, ['TOWN']));
                else if (e.key === 'REPEAT_LAND_PAIN')
                    prepend(s, ...powerSteps(s, e.actor, 'the-land-thrashes-in-furious-pain', area.id, owner, 0));
                else if (e.key === 'REPEAT_WINDS')
                    prepend(s, ...powerSteps(s, e.actor, 'winds-of-rust-and-atrophy', area.id, owner, 0));
                else if (e.key === 'CLEAN_ADJACENT')
                    prepend(s, step('REMOVE_BLIGHT', e.actor, area.id, 1));
                else if (e.key === 'WINGS') {
                    requireRule(l);
                    prepend(s, step('SPECIAL', e.actor, l.id, 5, 'WINGS_MOVE', owner, [], [area.id]), step('DEFEND', e.actor, area.id, 5));
                }
                else if (e.key === 'RENEWAL') {
                    const amount = Math.min(2, p.destroyedPresence);
                    if (amount) {
                        p.destroyedPresence -= amount;
                        for (let i = 0; i < amount; i++)
                            addPresenceAt(s, owner, area.id);
                        prepend(s, step('EACH_DAMAGE', e.actor, area.id, 2, '', owner, ['TOWN', 'CITY']), ...(e.n ? [step('DAMAGE', e.actor, area.id, e.n)] : []));
                    }
                }
                else if (e.key === 'FEAR_LAND') {
                    if (e.tags.includes('DISTINCT'))
                        s.flags.push(`fear-used:${area.id}`);
                    prepend(s, ...fearLandSteps(s, e, area.id));
                }
            }, area.id);
        optional();
    }
    else if (e.kind === 'SPECIAL') {
        if (e.key === 'REMOVE_HEALTH' && l) {
            for (const piece of invaders(l).filter(q => health(l, q) <= e.n))
                add(`${labels[piece.kind]} 제거`, () => { removePiece(s, l, piece, false, e.actor); if (e.n > health(l, piece))
                    prepend(s, { ...e, n: e.n - health(l, piece) }); }, l.id, piece.id);
            optional();
        }
        else if (e.key === 'SAFETY_GATHER' && l) {
            for (const source of l.adjacent.map(id => land(s, id)))
                for (const piece of invaders(source).filter(q => q.kind !== 'CITY' && countPieces(l, ['TOWN', 'CITY']) > countPieces(source, ['TOWN', 'CITY'])))
                    add(`${source.id} ${labels[piece.kind]} → ${l.id}`, () => { source.pieces = source.pieces.filter(q => q.id !== piece.id); l.pieces.push(piece); }, l.id, piece.id);
            optional();
        }
        else if (e.key === 'TAKE_CARD') {
            for (const id of s.offered)
                add(cardPower(s, id).title, () => { const leftovers = s.offered.filter(c => c !== id), other = s.offerOther; receive(s, owner, id); s.offerOther = null; s.offered = []; if (other && leftovers.length) {
                    s.offered = leftovers;
                    s.offerRecipient = other;
                    prepend(s, step('SPECIAL', other, null, 0, 'TAKE_CARD', other));
                }
                else {
                    (s.offerDeck === 'MINOR' ? s.minorDiscard : s.majorDiscard).push(...leftovers);
                    s.offerRecipient = null;
                } });
        }
        else if (e.key === 'ELEMENTS' && e.n) {
            for (const element of SPIRIT_ELEMENTS.filter(x => !e.used.includes(x)))
                add(SPIRIT_ELEMENT_LABELS[element], () => { p.elements.push(element); if (owner !== e.actor)
                    player(s, e.actor).elements.push(element); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1, used: [...e.used, element] }); });
        }
        else if (e.key === 'GROWTH') {
            for (const [i, tag] of e.tags.entries())
                add(growthLabel(tag), () => { const remaining = e.tags.filter((_, index) => i !== index); if (remaining.length)
                    prepend(s, { ...e, tags: remaining }); const [kind, n] = tag.split(':'); if (kind === 'presence')
                    prepend(s, step('PRESENCE', e.actor, null, Number(n)));
                else if (kind === 'energy')
                    p.energy += Number(n);
                else if (kind === 'reclaim') {
                    p.hand.push(...p.discard);
                    p.discard = [];
                }
                else if (kind === 'gain')
                    prepend(s, step('GAIN', e.actor, null, 1, 'DEFAULT', e.actor)); });
        }
        else if (e.key === 'CONSTANCY_RECLAIM') {
            for (const id of p.played.filter(id => !e.used.includes(id)))
                add(cardPower(s, id).title, () => { p.played = p.played.filter(c => c !== id); p.hand.push(id); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1, used: [...e.used, id] }); });
            optional();
        }
        else if (e.key === 'GIFT_CARD') {
            const source = owner, recipient = owner === e.actor ? s.players.find(q => q.playerId === e.tags[0])?.playerId : e.actor;
            for (const id of p.hand)
                add(cardPower(s, id).title, () => { if (recipient && recipient !== source) {
                    p.hand = p.hand.filter(c => c !== id);
                    player(s, recipient).hand.push(id);
                } });
            optional();
        }
        else if (e.key === 'WINGS_MOVE' && l && e.n) {
            const dest = land(s, e.used[0]!);
            for (const piece of l.pieces.filter(p => p.kind === 'DAHAN'))
                add(`${l.id} 다한 → ${dest.id}`, () => { l.pieces = l.pieces.filter(p => p.id !== piece.id); dest.pieces.push(piece); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1 }); event(s, 'MOVE', `${l.id} → ${dest.id} 다한 이동`, e.actor, dest.id); }, dest.id, piece.id);
            optional();
        }
    }
    return list;
}
function growthLabel(tag: string) { const [k, n] = tag.split(':'); return k === 'presence' ? `현신 추가 · 사거리 ${n}` : k === 'energy' ? `에너지 +${n}` : k === 'reclaim' ? '사용한 카드 전부 회수' : '능력 카드 획득'; }
function addPresenceAt(s: SpiritState, actor: PlayerId, id: string) { const l = land(s, id), p = l.presence.find(p => p.playerId === actor); if (p)
    p.count++;
else
    l.presence.push({ playerId: actor, count: 1 }); event(s, 'GROW', `${id} 현신 배치`, actor, id); }
export function automatic(s: SpiritState, e: SpiritStep): boolean {
    const l = e.land ? land(s, e.land) : null, owner = e.target ?? e.actor, p = player(s, owner);
    if (e.kind === 'CHECK') {
        checkEnd(s);
        return true;
    }
    if (e.kind === 'FEAR') {
        fear(s, e.n, e.actor);
        return true;
    }
    if (e.kind === 'DEFEND') {
        if (l)
            l.defend += e.n;
        return true;
    }
    if (e.kind === 'ENERGY') {
        p.energy += e.n;
        return true;
    }
    if (e.kind === 'REMOVE_BLIGHT') {
        if (l) {
            const n = Math.min(l.blight, e.n);
            l.blight -= n;
            s.blightPool += n;
            if (n)
                event(s, 'GROW', `${l.id} 오염 ${n}개 회복`, e.actor, l.id);
        }
        return true;
    }
    if (e.kind === 'EACH_DAMAGE') {
        if (l)
            for (const piece of [...l.pieces].filter(p => selectedKinds(e).includes(p.kind))) {
                const killed = damagePiece(s, l, piece, e.n, e.actor);
                extraFear(s, e, piece, killed);
            }
        event(s, 'DAMAGE', `${e.land} 각 기물에게 피해 ${e.n}`, e.actor, e.land);
        return true;
    }
    if (e.kind === 'BLIGHT' && e.key !== 'CASCADE') {
        if (!l || l.vitality)
            return true;
        const cascade = l.blight > 0;
        l.blight++;
        s.blightPool = Math.max(0, s.blightPool - 1);
        for (const pr of l.presence) {
            if (pr.count > 0) {
                pr.count--;
                player(s, pr.playerId).destroyedPresence++;
            }
        }
        l.presence = l.presence.filter(p => p.count > 0);
        event(s, 'BLIGHT', `${l.id} 오염 추가${cascade ? ' · 연쇄 발생' : ''}`, e.actor, l.id);
        if (cascade && s.blightPool > 0)
            prepend(s, { ...e, key: 'CASCADE', used: e.used.length ? e.used : [l.id] });
        return true;
    }
    if (e.kind === 'GAIN') {
        if (e.key === 'DEFAULT' && p.spirit) {
            const progression = s.progressions.find(d => d.spirit === p.spirit);
            if (progression?.cards.length) {
                const id = progression.cards.shift()!;
                p.progression++;
                receive(s, owner, id);
                return true;
            }
        }
        if (e.key === 'MINOR') {
            draw(s, e, 'MINOR');
            return true;
        }
        return false;
    }
    if (e.kind !== 'SPECIAL')
        return false;
    switch (e.key) {
        case 'STAGE_BUILD':
            s.stage = 'BUILD';
            event(s, 'PHASE', '건설 단계');
            return true;
        case 'GROWTH': return e.tags.length === 0;
        case 'END_GROW':
            p.energy += income(p);
            event(s, 'GROW', `성장 완료 · 에너지 수입 +${income(p)}`, owner);
            return true;
        case 'BOUNTY':
            if (l && countPieces(l, ['DAHAN']) >= 2) {
                makePiece(s, l, 'DAHAN');
                player(s, e.actor).energy++;
            }
            return true;
        case 'FAVORS':
            if (l && invaders(l).length > 0 && countPieces(l, ['DAHAN']) > invaders(l).length)
                fear(s, 3, e.actor);
            return true;
        case 'PROTECT_DAHAN':
            if (l)
                l.protectDahan = true;
            return true;
        case 'SKIP':
            if (l)
                l.skip = true;
            return true;
        case 'FAST_GIFT':
            p.fastGift += e.n;
            return true;
        case 'FREE_REPEAT':
            p.repeatGrants.push({ id: `free-${s.effectCounter}`, remaining: 1, maxCost: e.n, paid: false, used: [] });
            return true;
        case 'PAID_REPEAT':
            p.repeatGrants.push({ id: `storm-${s.effectCounter}`, remaining: e.n, maxCost: 100, paid: true, used: [] });
            return true;
        case 'RANGE':
            p.rangeBonus += e.n;
            return true;
        case 'ENTWINE':
            player(s, e.actor).sharedWith.push(owner);
            p.sharedWith.push(e.actor);
            return true;
        case 'CONSTANCY':
            p.reclaimAtEnd++;
            if (owner !== e.actor)
                player(s, e.actor).reclaimAtEnd++;
            return true;
        case 'POISON_BONUS':
            if (l)
                prepend(s, step('FEAR', e.actor, l.id, l.blight), step('DAMAGE', e.actor, l.id, l.blight * 4));
            return true;
        case 'VIGOR_AFTER': {
            const ids = [...new Set(s.flags.filter(f => f.startsWith('vigor:')).map(f => f.slice(6)))];
            s.flags = s.flags.filter(f => !f.startsWith('vigor:'));
            prepend(s, ...ids.map(id => step('DAMAGE', e.actor, id, countPieces(land(s, id), ['DAHAN']) * 2)));
            return true;
        }
        case 'VENGEANCE':
            if (l)
                s.vengeance.push({ actor: e.actor, land: l.id, adjacent: e.n === 1 });
            return true;
        case 'RESET_MISTS':
            s.flags = s.flags.filter(f => !f.startsWith('mists:'));
            return true;
        case 'VITALITY':
            if (l) {
                l.vitality = true;
                l.dahanHealth += 4;
                if (e.n)
                    s.flags.push(`immortal:${l.id}`);
            }
            return true;
        case 'CIVIL_WAR':
            if (l) {
                const explorers = countPieces(l, ['EXPLORER']), buildings = countPieces(l, ['TOWN']) * 2 + countPieces(l, ['CITY']) * 3;
                prepend(s, step('DESTROY', e.actor, l.id, buildings, '', null, ['EXPLORER']), step('DAMAGE', e.actor, l.id, explorers, '', null, ['BUILDINGS_ONLY']));
            }
            return true;
        case 'SCATTER':
            if (l)
                prepend(s, step('MOVE', e.actor, l.id, countPieces(l, ['EXPLORER']), 'PUSH', null, ['EXPLORER', 'REQUIRED', 'SPREAD']));
            return true;
        case 'RAVAGE':
            if (l && !l.skip) {
                const total = countPieces(l, ['EXPLORER']) + 2 * countPieces(l, ['TOWN']) + 3 * countPieces(l, ['CITY']), amount = Math.max(0, total - defense(s, l));
                // Damage to Dahan must destroy as many as possible before assigning any remainder.
                if (amount > 0 && !l.protectDahan && !s.flags.includes(`immortal:${l.id}`)) {
                    let remaining = amount;
                    for (const piece of [...l.pieces].filter(p => p.kind === 'DAHAN').sort((a, b) => (health(l, a) - a.damage) - (health(l, b) - b.damage))) {
                        if (!remaining)
                            break;
                        const n = Math.min(remaining, health(l, piece) - piece.damage);
                        damagePiece(s, l, piece, n, e.actor);
                        remaining -= n;
                    }
                }
                if (total > 0)
                    prepend(s, ...(amount >= 2 ? [step('BLIGHT', e.actor, l.id, 1)] : []), step('DAMAGE', e.actor, l.id, countPieces(l, ['DAHAN']) * 2), step('CHECK', e.actor));
                event(s, 'DAMAGE', `${l.id} 파괴 · 피해 ${total}, 방어 ${defense(s, l)}`, e.actor, l.id);
            }
            return true;
        case 'BUILD':
            for (const area of s.lands.filter(l => matches(l, s.build) && !l.skip && invaders(l).length)) {
                if (s.flags.includes('no-build-city') && countPieces(area, ['CITY']) || s.flags.includes('no-build-dahan') && countPieces(area, ['DAHAN']) || s.flags.includes('dahan-outnumber') && countPieces(area, ['DAHAN']) > countPieces(area, ['TOWN', 'CITY']) || s.flags.includes('no-build-coastal') && area.coastal)
                    continue;
                const city = countPieces(area, ['TOWN']) > countPieces(area, ['CITY']);
                if (city && area.coastal && s.flags.includes('no-city-coastal'))
                    continue;
                makePiece(s, area, city ? 'CITY' : 'TOWN');
                event(s, 'BUILD', `${area.id} ${city ? '도시' : '마을'} 건설`, e.actor, area.id);
            }
            return true;
        case 'EXPLORE': {
            const card = s.invaderDeck.shift();
            if (!card) {
                s.phase = 'FINISHED';
                s.result = { reason: 'INVADERS', winnerPlayerIds: [], round: s.round };
                s.queue = [];
                event(s, 'LOSE', '침략자 덱이 소진되었습니다.');
                return true;
            }
            s.explore = card;
            for (const area of s.lands.filter(l => matches(l, card) && !l.skip)) {
                if (s.flags.includes('no-explore-dahan') && countPieces(area, ['DAHAN']) >= 2)
                    continue;
                if (area.coastal || countPieces(area, ['TOWN', 'CITY']) > 0 || area.adjacent.some(id => countPieces(land(s, id), ['TOWN', 'CITY']) > 0)) {
                    makePiece(s, area, 'EXPLORER');
                    event(s, 'EXPLORE', `${area.id} 탐험가 진입`, e.actor, area.id);
                }
            }
            return true;
        }
        case 'ADVANCE_INVADERS':
            if (s.ravage)
                s.invaderDiscard.push(s.ravage);
            s.ravage = s.build;
            s.build = s.explore;
            s.explore = null;
            return true;
        case 'TIME':
            for (const q of s.players)
                if (q.reclaimAtEnd > 0)
                    prepend(s, step('SPECIAL', q.playerId, null, q.reclaimAtEnd, 'CONSTANCY_RECLAIM', q.playerId));
            s.queue.push(step('SPECIAL', e.actor, null, 0, 'NEW_ROUND'));
            return true;
        case 'NEW_ROUND':
            for (const q of s.players) {
                q.discard.push(...q.played);
                q.played = [];
                q.resolved = [];
                q.elements = [];
                q.ready = false;
                q.grown = false;
                q.paid = false;
                q.reclaimedOne = false;
                q.fastUsed = 0;
                q.fastGift = 0;
                q.repeatGrants = [];
                q.rangeBonus = 0;
                q.sharedWith = [];
                q.reclaimAtEnd = 0;
            }
            for (const area of s.lands) {
                for (const piece of area.pieces)
                    piece.damage = 0;
                area.defend = 0;
                area.skip = false;
                area.protectDahan = false;
                area.vitality = false;
                area.dahanHealth = 0;
            }
            s.flags = [];
            s.vengeance = [];
            s.plans = [];
            s.round++;
            s.stage = 'PREPARE';
            event(s, 'PHASE', `${s.round}라운드 · 성장과 카드 준비`);
            return true;
        case 'FEAR_DAHAN_DAMAGE':
            if (l)
                prepend(s, step('DAMAGE', e.actor, l.id, countPieces(l, ['DAHAN']) * (e.n === 3 ? 2 : 1)));
            return true;
        case 'FEAR_CARD':
            resolveFear(s, e);
            return true;
        default: return false;
    }
}
export function settle(s: SpiritState) {
    let budget = 10000;
    while (s.queue.length && s.phase === 'PLAYING') {
        if (--budget <= 0)
            throw new Error('Spirit effect loop');
        const e = s.queue.shift()!;
        if (automatic(s, e))
            continue;
        s.queue.unshift(e);
        if (choiceOptions(s).length)
            return;
        s.queue.shift();
    }
    if (s.phase === 'PLAYING' && s.queue.length === 0)
        checkEnd(s);
}
export const SPIRIT_FEAR_KEYS = ['unseen', 'scapegoats', 'emigration', 'guard', 'tales', 'retreat', 'raid', 'enheartened', 'avoid', 'safety', 'interior', 'belief', 'isolation', 'overseas', 'trade'] as const;
export const SPIRIT_FEAR_NAMES: Record<string, string> = { unseen: '보이지 않는 존재의 공포', scapegoats: '희생양', emigration: '빨라지는 이주', guard: '경계하는 다한', tales: '야성의 소문', retreat: '후퇴', raid: '다한의 습격', enheartened: '용기를 얻은 다한', avoid: '다한을 피하다', safety: '안전을 찾아서', interior: '내륙을 경계하다', belief: '믿음이 뿌리내리다', isolation: '고립', overseas: '더 안전한 해외 무역', trade: '흔들리는 무역' };
function fearLandAllowed(s: SpiritState, e: SpiritStep, id: string): boolean {
    const l = land(s, id), key = e.tags[0], level = e.n;
    if (e.tags.includes('DISTINCT') && s.flags.includes(`fear-used:${id}`))
        return false;
    if (key === 'unseen')
        return s.players.some(p => level === 1 ? sacred(s, l, p.playerId) : presence(l, p.playerId) > 0) && invaders(l).length > 0;
    if (key === 'emigration')
        return level >= 3 || l.coastal;
    if (key === 'interior')
        return level >= 3 || !l.coastal;
    if (key === 'tales' || key === 'raid')
        return countPieces(l, ['DAHAN']) > 0;
    if (key === 'retreat')
        return level >= 3 || !l.coastal;
    if (key === 'enheartened')
        return level >= 2 || invaders(l).length > 0;
    if (key === 'belief')
        return s.players.some(p => presence(l, p.playerId) > 0);
    if (key === 'isolation')
        return invaders(l).length <= (level === 1 ? 1 : 2) && invaders(l).length > 0;
    if (key === 'trade')
        return l.coastal;
    if (key === 'safety')
        return level === 3 ? !countPieces(l, ['CITY']) : invaders(l).length > 0;
    return true;
}
function fearLandSteps(s: SpiritState, e: SpiritStep, id: string): SpiritStep[] {
    const l = land(s, id), key = e.tags[0], level = e.n, a = e.actor, rm = (n: number, tags: string[]) => step('REMOVE', a, id, n, '', null, tags), mv = (n: number, tags: string[], gather = false) => step('MOVE', a, id, n, gather ? 'GATHER' : 'PUSH', null, tags);
    switch (key) {
        case 'unseen': return [rm(1, level === 3 && s.players.some(p => sacred(s, l, p.playerId)) ? ['EXPLORER', 'TOWN', 'CITY'] : ['EXPLORER', 'TOWN'])];
        case 'emigration':
        case 'interior': return [rm(1, level === 1 ? ['EXPLORER'] : ['EXPLORER', 'TOWN'])];
        case 'tales': return level === 1 ? [rm(1, ['EXPLORER'])] : [step('OPTION', a, id, 0, 'fear-tales', null, ['REMOVE_EXPLORERS:2', 'REMOVE_TOWN:1'])];
        case 'retreat': return [mv(level === 1 ? 2 : level === 2 ? 3 : invaders(l).length, level === 1 ? ['EXPLORER'] : ['EXPLORER', 'TOWN'])];
        case 'raid': return [step('DAMAGE', a, id, level === 1 ? 1 : countPieces(l, ['DAHAN']) * (level === 3 ? 2 : 1))];
        case 'enheartened': return level === 1 ? [step('OPTION', a, id, 0, 'branches', null, ['PUSH_DAHAN:1', 'GATHER_DAHAN:1'])] : [mv(2, ['DAHAN'], true), step('SPECIAL', a, id, level, 'FEAR_DAHAN_DAMAGE')];
        case 'belief': return [step('SPECIAL', a, id, s.players.reduce((n, p) => n + presence(l, p.playerId), 0) * 2, 'REMOVE_HEALTH')];
        case 'isolation': return [rm(1, level === 3 ? ['EXPLORER', 'TOWN', 'CITY'] : ['EXPLORER', 'TOWN'])];
        case 'trade': return [step('REPLACE', a, id, 1, 'DOWNGRADE', null, level === 2 ? ['TOWN'] : ['TOWN', 'CITY'])];
        case 'safety':
            if (level === 1)
                return [mv(1, ['EXPLORER', 'MORE_BUILDINGS'])];
            if (level === 2)
                return [step('SPECIAL', a, id, 0, 'SAFETY_GATHER')];
            return [step('SPECIAL', a, id, 3, 'REMOVE_HEALTH')];
        default: return [];
    }
}
function resolveFear(s: SpiritState, e: SpiritStep) {
    const key = e.tags[0]!, level = s.terror, a = e.actor;
    s.fearDiscard.push(key);
    s.flags = s.flags.filter(f => !f.startsWith('fear-used:'));
    event(s, 'FEAR', `${SPIRIT_FEAR_NAMES[key]} · 공포 수준 ${level}`, a);
    if (key === 'scapegoats') {
        for (const l of s.lands) {
            const towns = countPieces(l, ['TOWN']), cities = countPieces(l, ['CITY']);
            prepend(s, step('DESTROY', a, l.id, level === 3 && (towns + cities) > 0 ? 10000 : towns + (level >= 2 ? cities * 2 : 0), '', null, ['EXPLORER']), ...(level === 3 ? [step('DESTROY', a, l.id, cities, '', null, ['TOWN'])] : []));
        }
        return;
    }
    if (key === 'guard') {
        for (const l of s.lands) {
            const n = countPieces(l, ['DAHAN']);
            l.defend += level === 3 ? n * 2 : level === 2 && n ? n + 1 : n;
        }
        return;
    }
    if (key === 'avoid') {
        s.flags.push(level === 1 ? 'no-explore-dahan' : level === 2 ? 'dahan-outnumber' : 'no-build-dahan');
        return;
    }
    if (key === 'overseas') {
        for (const l of s.lands.filter(l => l.coastal))
            l.defend += level * 3;
        if (level >= 2)
            s.flags.push(level === 2 ? 'no-city-coastal' : 'no-build-coastal');
        return;
    }
    if (key === 'trade' && level === 1) {
        s.flags.push('no-build-city');
        return;
    }
    if (key === 'belief' && level <= 2) {
        for (const l of s.lands.filter(l => l.presence.length))
            l.defend += 2;
        if (level === 2)
            for (const p of s.players)
                p.energy += s.lands.filter(l => sacred(s, l, p.playerId) && invaders(l).length > 0).length;
        return;
    }
    if (key === 'tales' && level === 3) {
        for (const l of s.lands.filter(l => countPieces(l, ['DAHAN']) > 0))
            prepend(s, step('OPTION', a, l.id, 0, 'fear-tales', null, ['REMOVE_EXPLORERS:2', 'REMOVE_TOWN:1']), ...(countPieces(l, ['DAHAN']) >= 2 ? [step('REMOVE', a, l.id, 1, '', null, ['CITY'])] : []));
        return;
    }
    prepend(s, ...s.players.map(p => step('LAND', p.playerId, null, level, 'FEAR_LAND', p.playerId, [key, ...(key === 'raid' || key === 'enheartened' && level >= 2 || key === 'belief' ? ['DISTINCT'] : [])])));
}
