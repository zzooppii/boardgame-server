import type { PlayerId, SpiritPiece } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { cardPower, countPieces, event, invaders, land, makePiece, meets, player, presence, prepend, sacred, step } from './primitives.js';
import { addToken } from './tokens.js';

type AddChoice = (label: string, apply: () => void, landId?: string | null, pieceId?: string | null) => unknown;
const invaderKinds: SpiritPiece['kind'][] = ['EXPLORER', 'TOWN', 'CITY'];

export function branchMinorPower(s: SpiritState, actor: PlayerId, key: string, id: string | null, target: PlayerId, level: number): SpiritStep[] | null {
    const l = id ? land(s, id) : null;
    const effect = (key: string, n = 0) => step('SPECIAL', actor, id, n, key, target);
    const token = (key: string) => step('SPECIAL', actor, id, 1, `TOKEN:ADD:${key}`, target, ['REQUIRED']);
    const move = (n: number, kinds: SpiritPiece['kind'][], gather = false, required = false) => step('MOVE', actor, id, n, gather ? 'GATHER' : 'PUSH', target, [...kinds, ...(required ? ['REQUIRED'] : [])]);
    const destroy = (n: number, kinds: SpiritPiece['kind'][]) => step('DESTROY', actor, id, n, '', target, kinds);
    const f = (n: number) => step('FEAR', actor, id, n);
    const bonus = (threshold: Parameters<typeof meets>[2]) => level > 0 && meets(s, actor, threshold);
    switch (key) {
        case 'inflame-the-fires-of-life': return [effect('BC_INFLAME', bonus({ ANIMAL: 3 }) ? 1 : 0)];
        case 'fire-in-the-sky': return [f(2), token('strife')];
        case 'fleshrot-fever': return [f(1), token('disease')];
        case 'gold-s-allure': return [move(1, ['EXPLORER'], true, true), move(1, ['TOWN'], true, true), token('strife')];
        case 'guardian-serpents': return [effect('BC_GUARDIAN')];
        case 'here-there-be-monsters': return [move(1, ['EXPLORER', 'TOWN', 'DAHAN']), f(2 + (l && l.tokens.beasts > 0 ? 1 : 0))];
        case 'infested-aquifers': return [effect('BC_AQUIFERS')];
        case 'poisoned-dew': return [destroy(l && ['JUNGLE', 'WETLAND'].includes(l.terrain) ? 10000 : 1, ['EXPLORER'])];
        case 'portents-of-disaster': return [f(2), effect('BC_PORTENTS')];
        case 'prowling-panthers': return [effect('BC_PANTHERS')];
        case 'renewing-rain': return [...(l && ['JUNGLE', 'SANDS'].includes(l.terrain) ? [step('REMOVE_BLIGHT', actor, id, 1)] : []), ...(bonus({ PLANT: 3 }) ? [token('wilds')] : [])];
        case 'rites-of-the-land-s-rejection': return [effect('BC_REJECTION')];
        case 'pact-of-the-joined-hunt': return [effect('BC_PACT')];
        case 'razor-sharp-undergrowth': return [destroy(1, ['EXPLORER']), destroy(1, ['DAHAN']), token('wilds'), step('DEFEND', actor, id, 2)];
        case 'growth-through-sacrifice': return [step('SPECIAL', actor, null, 1, 'DESTROY_PRESENCE', actor), effect('BC_SACRIFICE', bonus({ SUN: 2 }) ? 1 : 0)];
        case 'scour-the-land': return [destroy(3, ['TOWN']), destroy(10000, ['EXPLORER']), step('BLIGHT', actor, id, 1)];
        case 'sky-stretches-to-shore': return [effect('BC_SKY')];
        case 'swarming-wasps': return [effect('BC_WASPS')];
        case 'absorb-corruption': return [effect('BC_ABSORB', bonus({ PLANT: 2 }) ? 1 : 0)];
        case 'animated-wrackroot': return [effect('BC_WRACKROOT')];
        case 'promises-of-protection': return [move(2, ['DAHAN'], true), effect('BC_DAHAN_HEALTH', 2)];
        case 'call-to-ferocity': return [effect('BC_FEROCITY')];
        case 'call-to-trade': return [move(1, ['DAHAN'], true), effect('BC_TRADE')];
        case 'confounding-mists': return [effect('BC_MISTS')];
        case 'cycles-of-time-and-tide': return [effect('BC_CYCLES')];
        case 'disorienting-landscape': return [move(1, ['EXPLORER'], false, true), ...(l && ['MOUNTAIN', 'JUNGLE'].includes(l.terrain) ? [token('wilds')] : [])];
        case 'elusive-ambushes': return [effect('BC_AMBUSH')];
        case 'tormenting-rotflies': return [effect('BC_ROTFLIES')];
        case 'twilight-fog-brings-madness': return [token('strife'), move(1, ['DAHAN'], false, true), step('EACH_DAMAGE', actor, id, 1, '', target, ['DAHAN'])];
        case 'teeming-rivers': return l && l.blight === 0 ? [token('beasts')] : l && l.blight === 1 ? [step('REMOVE_BLIGHT', actor, id, 1)] : [];
        case 'spur-on-with-words-of-fire': return [...(target !== actor ? [step('ENERGY', actor, null, 1, '', target)] : []), effect('BC_SPUR')];
        default: return null;
    }
}

export function branchMinorOptions(s: SpiritState, e: SpiritStep, add: AddChoice): boolean {
    const l = e.land ? land(s, e.land) : null, owner = e.target ?? e.actor;
    const q = player(s, owner);
    const queue = (...effects: SpiritStep[]) => prepend(s, ...effects);
    const f = (n: number) => step('FEAR', e.actor, e.land, n);
    const token = (key: string) => step('SPECIAL', e.actor, e.land, 1, `TOKEN:ADD:${key}`, owner, ['REQUIRED']);
    const move = (n: number, kinds: SpiritPiece['kind'][], gather = false) => step('MOVE', e.actor, e.land, n, gather ? 'GATHER' : 'PUSH', owner, kinds);
    const destroy = (n: number, kinds: SpiritPiece['kind'][]) => step('DESTROY', e.actor, e.land, n, '', owner, kinds);
    switch (e.key) {
        case 'BC_INFLAME':
            add('질병 1개 추가', () => queue(token('disease')), e.land);
            add('공포 1 · 분쟁 1개 추가', () => queue(f(1), token('strife')), e.land);
            if (e.n) add('두 효과 모두 적용', () => queue(token('disease'), f(1), token('strife')), e.land);
            return true;
        case 'BC_GUARDIAN':
        case 'BC_PACT':
            for (const area of s.lands.filter(l => presence(l, owner) > 0)) {
                add(`${area.id} ${e.key === 'BC_GUARDIAN' ? '야수 추가' : '함께 사냥'}`, () => {
                    if (e.key === 'BC_GUARDIAN') {
                        addToken(s, area, 'beasts', 1, e.actor);
                        if (sacred(s, area, owner)) area.defend += 4;
                    } else queue(step('MOVE', e.actor, area.id, 1, 'GATHER', owner, ['DAHAN', 'REQUIRED']), step('SPECIAL', e.actor, area.id, 0, 'BC_PACT_DAMAGE'));
                }, area.id);
            }
            return true;
        case 'BC_AQUIFERS':
            add('질병이 있으면 침략자마다 피해 1', () => { if (l && l.tokens.disease) queue(step('EACH_DAMAGE', e.actor, l.id, 1, '', null, invaderKinds)); }, e.land);
            add('산/습지이면 공포 1 · 질병 추가', () => { if (l && ['MOUNTAIN', 'WETLAND'].includes(l.terrain)) queue(f(1), token('disease')); }, e.land);
            return true;
        case 'BC_PANTHERS':
            add('공포 1 · 야수 추가', () => queue(f(1), token('beasts')), e.land);
            if (l?.tokens.beasts) add('탐험가/마을 1개 파괴', () => queue(destroy(1, ['EXPLORER', 'TOWN'])), l.id);
            return true;
        case 'BC_REJECTION':
            if (l) add('건설 차단 · 공포 발생', () => { s.flags.push(`no-build:${l.id}`); queue(f(Math.min(countPieces(l, ['DAHAN']), countPieces(l, ['TOWN', 'CITY'])))); }, l.id);
            add('다한 최대 3개 밀기', () => queue(move(3, ['DAHAN'])), e.land);
            return true;
        case 'BC_SACRIFICE':
            for (const area of s.lands.filter(l => presence(l, owner) > 0)) {
                const clean = step('REMOVE_BLIGHT', e.actor, area.id, 1);
                const grow = step('PRESENCE', e.actor, area.id, 0, 'POWER', owner);
                add(`${area.id} 오염 제거`, () => queue(clean), area.id);
                add(`${area.id} 현신 추가`, () => queue(grow), area.id);
                if (e.n) {
                    add(`${area.id} 오염 제거 후 현신 추가`, () => queue(clean, grow), area.id);
                    add(`${area.id} 현신 추가 후 오염 제거`, () => queue(grow, clean), area.id);
                }
            }
            return true;
        case 'BC_WASPS':
            add('야수 1개 추가', () => queue(token('beasts')), e.land);
            if (l?.tokens.beasts) add('탐험가 최대 2개 밀기', () => queue(move(2, ['EXPLORER'])), l.id);
            return true;
        case 'BC_ABSORB': {
            const gather = step('SPECIAL', e.actor, e.land, 0, 'BC_GATHER_BLIGHT', owner);
            const clean = step('SPECIAL', e.actor, e.land, 0, 'BC_PAID_CLEAN', owner);
            add('인접 지역에서 오염 모으기', () => queue(gather), e.land);
            if (player(s, e.actor).energy >= 1) {
                add('에너지 1 · 오염 제거', () => queue(clean), e.land);
                if (e.n) {
                    add('오염 모은 뒤 에너지 1로 제거', () => queue(gather, clean), e.land);
                    add('에너지 1로 제거한 뒤 오염 모으기', () => queue(clean, gather), e.land);
                }
            }
            return true;
        }
        case 'BC_GATHER_BLIGHT':
            if (l) for (const id of l.adjacent) {
                const from = land(s, id);
                if (from.blight) add(`${id} → ${l.id} 오염 1개 이동`, () => { from.blight--; l.blight++; event(s, 'MOVE', `${id} → ${l.id} 오염 이동`, e.actor, l.id); }, id);
            }
            return true;
        case 'BC_WRACKROOT':
            add('공포 1 · 탐험가 파괴', () => queue(f(1), destroy(1, ['EXPLORER'])), e.land);
            add('야생 1개 추가', () => queue(token('wilds')), e.land);
            return true;
        case 'BC_FEROCITY':
            add('다한 최대 3개 모으기', () => queue(move(3, ['DAHAN'], true)), e.land);
            if (l && countPieces(l, ['DAHAN'])) add('공포 1 · 탐험가와 마을 밀기', () => queue(f(1), {...move(1, ['EXPLORER']),tags:['EXPLORER','REQUIRED']}, {...move(1, ['TOWN']),tags:['TOWN','REQUIRED']}), l.id);
            return true;
        case 'BC_MISTS':
            add('방어 4', () => queue(step('DEFEND', e.actor, e.land, 4)), e.land);
            if (l) add('추가되는 침략자 밀어내기', () => { s.flags.push(`bc-mists:${l.id}:${e.actor}`); }, l.id);
            return true;
        case 'BC_AMBUSH':
            add('피해 1', () => queue(step('DAMAGE', e.actor, e.land, 1)), e.land);
            add('방어 4', () => queue(step('DEFEND', e.actor, e.land, 4)), e.land);
            return true;
        case 'BC_ROTFLIES':
            add('질병 1개 추가', () => queue(token('disease')), e.land);
            if (l && invaders(l).length) add('침략자에게 공포 발생', () => queue(f(2 + (l.tokens.disease > 0 ? 1 : 0) + (l.blight > 0 ? 1 : 0))), l.id);
            return true;
        case 'BC_SPUR':
            for (const id of q.hand) {
                const power = cardPower(s, id), cost = power.cost - (s.settings.scenario === 'BLITZ' && power.speed === 'FAST' ? 1 : 0);
                if (q.energy >= cost) add(`${power.title} · 에너지 ${cost}`, () => {
                    q.energy -= cost; q.hand = q.hand.filter(c => c !== id); q.played.push(id); q.ready = false;
                    event(s, 'CARD', `${power.title} 추가 준비`, owner);
                });
            }
            add('추가 준비하지 않기', () => undefined);
            return true;
        default: return false;
    }
}

export function branchMinorAutomatic(s: SpiritState, e: SpiritStep): boolean {
    const l = e.land ? land(s, e.land) : null, owner = e.target ?? e.actor;
    switch (e.key) {
        case 'BC_PORTENTS': if (l) s.flags.push(`portents:${l.id}:${e.actor}`); return true;
        case 'BC_PACT_DAMAGE': if (l) prepend(s, step('DAMAGE', e.actor, l.id, countPieces(l, ['DAHAN']))); return true;
        case 'BC_SKY': s.flags.push(`sky:${owner}`, `shore:${owner}`); return true;
        case 'BC_DAHAN_HEALTH': if (l) l.dahanHealth += e.n; return true;
        case 'BC_TRADE':
            if (l && s.terror <= 2) { s.flags.push(`trade-build:${l.id}`); prepend(s, step('MOVE', e.actor, l.id, 1, 'GATHER', owner, ['TOWN', 'REQUIRED'])); }
            return true;
        case 'BC_CYCLES':
            if (l) { if (countPieces(l, ['DAHAN'])) makePiece(s, l, 'DAHAN'); else prepend(s, step('REMOVE_BLIGHT', e.actor, l.id, 1)); }
            return true;
        case 'BC_PAID_CLEAN':
            if (player(s, e.actor).energy >= 1) { player(s, e.actor).energy--; prepend(s, step('REMOVE_BLIGHT', e.actor, e.land, 1)); }
            return true;
        default: return false;
    }
}
