import { SPIRIT_ELEMENTS, spiritDefinition, spiritPower, type PlayerId, type SpiritElement, type SpiritLand, type SpiritPiece, type SpiritPower, type SpiritInvaderCard } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritPlayer, SpiritStep } from './state.js';
export class SpiritRuleError extends Error {
}
export function requireRule(value: unknown, message = '현재 선택을 다시 확인하세요.'): asserts value { if (!value)
    throw new SpiritRuleError(message); }
export function player(s: SpiritState, id: PlayerId): SpiritPlayer { const p = s.players.find(p => p.playerId === id); requireRule(p); return p; }
export function land(s: SpiritState, id: string | null): SpiritLand { const l = s.lands.find(l => l.id === id); requireRule(l); return l; }
export const countPieces = (l: SpiritLand, kinds: readonly SpiritPiece['kind'][]): number => l.pieces.filter(p => kinds.includes(p.kind)).length;
export const invaders = (l: SpiritLand) => l.pieces.filter(p => p.kind !== 'DAHAN');
export const presence = (l: SpiritLand, id: PlayerId) => l.presence.find(p => p.playerId === id)?.count ?? 0;
export function sacred(s: SpiritState, l: SpiritLand, id: PlayerId): boolean { return presence(l, id) >= 2 || (presence(l, id) >= 1 && player(s, id).spirit === 'RIVER' && l.terrain === 'WETLAND'); }
export function addPresence(l: SpiritLand, id: PlayerId, n: number) { const p = l.presence.find(p => p.playerId === id); if (p)
    p.count += n;
else
    l.presence.push({ playerId: id, count: n }); l.presence = l.presence.filter(p => p.count > 0); }
export function makePiece(s: SpiritState, l: SpiritLand, kind: SpiritPiece['kind']) { const p = { id: `${s.gameId}:p${++s.pieceCounter}`, kind, damage: 0 }; l.pieces.push(p); return p; }
export function event(s: SpiritState, kind: SpiritState['log'][number]['kind'], text: string, actor: PlayerId | null = null, landId: string | null = null) { s.log.push({ id: ++s.effectCounter, kind, text, landId, playerId: actor }); s.log = s.log.slice(-50); }
export function step(kind: SpiritStep['kind'], actor: PlayerId, landId: string | null = null, n = 0, key = '', target: PlayerId | null = null, tags: string[] = [], used: string[] = []): SpiritStep { return { kind, actor, land: landId, n, key, target, tags, used }; }
export function prepend(s: SpiritState, ...steps: SpiritStep[]) { s.queue.unshift(...steps); }
export function cardPower(s: SpiritState, id: string): SpiritPower { const c = s.cards.find(c => c.cardId === id); requireRule(c); return spiritPower(c.key); }
export function elements(s: SpiritState, id: PlayerId): Record<SpiritElement, number> { const p = player(s, id), all = [...p.elements, ...p.played.flatMap(id => cardPower(s, id).elements)]; return { SUN: all.filter(e => e === 'SUN').length, MOON: all.filter(e => e === 'MOON').length, FIRE: all.filter(e => e === 'FIRE').length, AIR: all.filter(e => e === 'AIR').length, WATER: all.filter(e => e === 'WATER').length, EARTH: all.filter(e => e === 'EARTH').length, PLANT: all.filter(e => e === 'PLANT').length, ANIMAL: all.filter(e => e === 'ANIMAL').length }; }
export function meets(s: SpiritState, id: PlayerId, threshold: Partial<Record<SpiritElement, number>>): boolean { const e = elements(s, id); return SPIRIT_ELEMENTS.every(k => e[k] >= (threshold[k] ?? 0)); }
export function distance(s: SpiritState, a: string, b: string): number { const seen = new Set([a]), queue: [
    string,
    number
][] = [[a, 0]]; for (let i = 0; i < queue.length; i++) {
    const [id, d] = queue[i]!;
    if (id === b)
        return d;
    for (const next of land(s, id).adjacent)
        if (!seen.has(next)) {
            seen.add(next);
            queue.push([next, d + 1]);
        }
} return Infinity; }
export function inRange(s: SpiritState, id: PlayerId, l: SpiritLand, range: number, needsSacred = false, terrain: SpiritPower['sourceTerrain'] = null): boolean {
    const p = player(s, id), owners = [id, ...p.sharedWith];
    return s.lands.some(from => owners.some(owner => needsSacred ? sacred(s, from, owner) : presence(from, owner) > 0) && (!terrain || from.terrain === terrain) && distance(s, from.id, l.id) <= range);
}
export function targetAllowed(s: SpiritState, id: PlayerId, c: SpiritPower, l: SpiritLand, shadow = false): boolean {
    if (c.terrains.length && !c.terrains.includes(l.terrain))
        return false;
    if (c.target === 'COASTAL' && !l.coastal || c.target === 'DAHAN' && !countPieces(l, ['DAHAN']) || c.target === 'INVADERS' && !invaders(l).length || c.target === 'NO_INVADERS' && invaders(l).length || c.target === 'NO_BLIGHT' && l.blight || c.target === 'BLIGHT' && !l.blight)
        return false;
    if (c.target === 'SPIRIT' || c.target === 'OTHER_SPIRIT')
        return false;
    let range = c.range + player(s, id).rangeBonus;
    if (c.key === 'sap-the-strength-of-multitudes' && meets(s, id, { AIR: 1 }))
        range++;
    if (c.key === 'talons-of-lightning' && meets(s, id, { FIRE: 3, AIR: 3 }))
        range = Math.max(range, 3 + player(s, id).rangeBonus);
    if (shadow && player(s, id).spirit === 'SHADOW' && player(s, id).energy >= 1 && countPieces(l, ['DAHAN']) > 0)
        return !c.sacred || s.lands.some(from => sacred(s, from, id));
    return inRange(s, id, l, range, c.sacred, c.sourceTerrain);
}
export function innateLevel(s: SpiritState, id: PlayerId): number {
    const p = player(s, id);
    if (!p.spirit)
        return 0;
    const thresholds: Record<NonNullable<SpiritPlayer['spirit']>, Partial<Record<SpiritElement, number>>[]> = { RIVER: [{ SUN: 1, WATER: 2 }, { SUN: 2, WATER: 3 }, { SUN: 3, WATER: 4, EARTH: 1 }], LIGHTNING: [{ FIRE: 3, AIR: 2 }, { FIRE: 4, AIR: 3 }, { FIRE: 5, AIR: 4, WATER: 1 }, { FIRE: 5, AIR: 5, WATER: 2 }], EARTH: [{ SUN: 1, EARTH: 2, PLANT: 2 }, { SUN: 2, EARTH: 3, PLANT: 2 }, { SUN: 2, EARTH: 4, PLANT: 3 }], SHADOW: [{ MOON: 2, FIRE: 1 }, { MOON: 3, FIRE: 2 }, { MOON: 4, FIRE: 3, AIR: 2 }] };
    let level = 0;
    for (const [i, t] of thresholds[p.spirit].entries())
        if (meets(s, id, t))
            level = i + 1;
    return level;
}
export function fear(s: SpiritState, n: number, actor: PlayerId) { if (n <= 0 || s.terror === 4)
    return; s.fear += n; event(s, 'FEAR', `공포 +${n}`, actor); while (s.fear >= s.players.length * 4) {
    s.fear -= s.players.length * 4;
    const next = s.fearDeck.shift();
    if (!next)
        break;
    s.fearEarned.push(next);
    if (s.fearDeck.length === 6)
        s.terror = 2;
    if (s.fearDeck.length === 3)
        s.terror = 3;
    if (s.fearDeck.length === 0) {
        s.terror = 4;
        s.fear %= s.players.length * 4;
        break;
    }
} }
export const health = (l: SpiritLand, p: SpiritPiece) => p.kind === 'CITY' ? 3 : p.kind === 'TOWN' ? 2 : p.kind === 'DAHAN' ? 2 + l.dahanHealth : 1;
export function removePiece(s: SpiritState, l: SpiritLand, piece: SpiritPiece, destroy: boolean, actor: PlayerId): void {
    if (destroy && piece.kind === 'DAHAN' && l.vitality && s.flags.includes(`immortal:${l.id}`))
        return;
    l.pieces = l.pieces.filter(p => p.id !== piece.id);
    if (destroy && (piece.kind === 'CITY' || piece.kind === 'TOWN'))
        fear(s, piece.kind === 'CITY' ? 2 : 1, actor);
    // Trigger chains are queued after the current destruction effect, never recursively committed.
    if (destroy && piece.kind !== 'EXPLORER')
        for (const v of s.vengeance.filter(v => v.land === l.id)) {
            const queued = s.queue.find(e => e.key === 'vengeance' && e.actor === v.actor && e.land === l.id);
            if (queued)
                queued.n++;
            else {
                const index = s.queue.findIndex(e => e.kind === 'CHECK');
                s.queue.splice(index < 0 ? s.queue.length : index, 0, step('DAMAGE', v.actor, l.id, 1, 'vengeance', null, v.adjacent ? ['ADJACENT'] : []));
            }
        }
}
export function damagePiece(s: SpiritState, l: SpiritLand, p: SpiritPiece, n: number, actor: PlayerId): boolean { if (p.kind === 'DAHAN' && s.flags.includes(`immortal:${l.id}`))
    return false; p.damage += n; if (p.damage >= health(l, p)) {
    removePiece(s, l, p, true, actor);
    return true;
} return false; }
export function defense(s: SpiritState, l: SpiritLand): number { return l.defend + (s.players.some(p => p.spirit === 'EARTH' && sacred(s, l, p.playerId)) ? 3 : 0); }
export function matches(l: SpiritLand, c: SpiritInvaderCard | null): boolean { return c !== null && (c.coastal ? l.coastal : c.terrains.includes(l.terrain)); }
export function checkEnd(s: SpiritState) {
    if (s.phase === 'FINISHED' || s.stage === 'SELECT')
        return;
    const won = s.terror === 4 || s.lands.every(l => invaders(l).every(p => s.terror === 3 ? p.kind !== 'CITY' : s.terror === 2 ? p.kind === 'EXPLORER' : false));
    const lost = s.blightPool <= 0 ? 'BLIGHT' : s.players.some(p => !s.lands.some(l => presence(l, p.playerId) > 0)) ? 'PRESENCE' : null;
    if (!won && !lost)
        return;
    s.phase = 'FINISHED';
    s.result = { reason: won ? (lost ? 'SACRIFICE' : 'VICTORY') : lost!, winnerPlayerIds: won ? s.players.map(p => p.playerId) : [], round: s.round };
    s.queue = [];
    event(s, won ? 'WIN' : 'LOSE', won ? '섬을 지켜냈습니다.' : lost === 'BLIGHT' ? '오염이 섬을 뒤덮었습니다.' : '한 정령의 현신이 모두 사라졌습니다.');
}
export function income(p: SpiritPlayer): number { requireRule(p.spirit); return spiritDefinition(p.spirit).energy[p.energyTrack]!; }
export function playLimit(p: SpiritPlayer): number { requireRule(p.spirit); return spiritDefinition(p.spirit).plays[p.cardTrack]!; }
