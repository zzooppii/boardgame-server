import { branchMinorPower } from './branch-claw-minor.js';
import { branchClawPower } from './branch-claw.js';
import type { PlayerId, SpiritPiece } from '@hangul-rummikub/shared';
import { spiritPower } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, land, player, meets, countPieces, invaders, presence, sacred, requireRule, elements } from './primitives.js';
/** Build a serializable sequence. Choices and post-move conditions are resolved against the current candidate. */
export function powerSteps(s: SpiritState, actor: PlayerId, key: string, landId: string | null, target: PlayerId, level: number): SpiritStep[] {
    const minor=branchMinorPower(s,actor,key,landId,target,level);if(minor!==null)return minor;
    const expanded=branchClawPower(s,actor,key,landId,target,level);if(expanded!==null)return expanded;
    const l = landId ? land(s, landId) : null, p = player(s, actor), bonus = (t: Parameters<typeof meets>[2]) => level > 0 && meets(s, actor, t);
    const e = (kind: SpiritStep['kind'], n = 0, k = '', tags: string[] = [], at = landId, to: PlayerId | null = target) => step(kind, actor, at, n, k, to, tags);
    const d = (n: number, tags: string[] = []) => e('DAMAGE', n, '', tags), f = (n: number) => e('FEAR', n), def = (n: number) => e('DEFEND', n), bl = () => e('BLIGHT', 1), clean = () => e('REMOVE_BLIGHT', 1);
    const move = (n: number, kinds: SpiritPiece['kind'][], gather = false, tags: string[] = []) => e('MOVE', n, gather ? 'GATHER' : 'PUSH', [...kinds, ...(n === 1 ? ['REQUIRED'] : []), ...tags]);
    const destroy = (n: number, kinds: SpiritPiece['kind'][], tags: string[] = []) => e('DESTROY', n, '', [...kinds, ...tags]);
    const each = (n: number, kinds: SpiritPiece['kind'][] = ['EXPLORER', 'TOWN', 'CITY'], tags: string[] = []) => e('EACH_DAMAGE', n, '', [...kinds, ...tags]);
    const special = (k: string, n = 0, tags: string[] = []) => e('SPECIAL', n, k, tags);
    const option = (...branches: string[]) => e('OPTION', 0, 'branches', branches);
    const jungle = !!l && ['JUNGLE', 'WETLAND'].includes(l.terrain), mountain = !!l && ['MOUNTAIN', 'JUNGLE'].includes(l.terrain), sands = !!l && ['JUNGLE', 'SANDS'].includes(l.terrain);
    const da = l ? countPieces(l, ['DAHAN']) : 0;
    if (key === 'innate2') {
        switch(p.spirit) {
            case 'GREEN': return [def(level>=2?4:2),...(level>=3?[clean()]:[])];
            case 'THUNDER': return [destroy(Math.floor(da/2),['TOWN']),...(level>=2?[destroy(Math.floor(da/3),['CITY'])]:[])];
            case 'OCEAN': return [e('SPECIAL',1,'DROWN',level>=2?['TOWN','CITY']:['TOWN']),...(level>=3?[e('SPECIAL',1,'DROWN',['TOWN','CITY'])]:[])];
            case 'BRINGER': return [f(level)];
            default: throw new Error('Unknown second innate');
        }
    }
    if (key === 'innate') {
        switch (p.spirit) {
            case 'GREEN': return [d(1,['BUILDINGS_ONLY'])];
            case 'THUNDER': return [move(elements(s,actor).AIR,['DAHAN'],true),move(elements(s,actor).SUN,['DAHAN'])];
            case 'OCEAN': return [f(level===3?4:level)];
            case 'BRINGER': return [...(meets(s,actor,{MOON:2,AIR:2})?[special('REVEAL_FEAR')]:[]),...(level>=2?[special('COPY_ELEMENT',1)]:[])];
            case 'RIVER': return level >= 3 ? [each(2)] : level >= 2 ? [d(2), move(3, ['EXPLORER', 'TOWN'])] : [move(1, ['EXPLORER', 'TOWN'])];
            case 'LIGHTNING': return [destroy(1, level >= 2 ? ['TOWN', 'CITY'] : ['TOWN']), ...(level >= 3 ? [destroy(level - 2, ['TOWN', 'CITY'])] : [])];
            case 'EARTH': return [special('FREE_REPEAT', level >= 3 ? 6 : level === 2 ? 3 : 1)];
            case 'SHADOW': return [move(1, ['EXPLORER'], true), ...(level >= 2 ? [destroy(2, ['EXPLORER'], ['BONUS_FEAR', 'OPTIONAL'])] : []), ...(level >= 3 ? [d(3, ['BONUS_FEAR'])] : [])];
            default: throw new Error('Missing spirit');
        }
    }
    switch (key) {
        case 'overgrow-in-a-night': return [special('OVERGROW')];
        case 'gift-of-proliferation': return [e('PRESENCE',1,'',[],null,target)];
        case 'fields-choked-with-growth': return [option('PUSH_TOWN:1','PUSH_DAHAN:3')];
        case 'stem-the-flow-of-fresh-water': return l && ['MOUNTAIN','SANDS'].includes(l.terrain) ? [each(1,['TOWN','CITY'])] : [d(1,['BUILDINGS_ONLY'])];
        case 'manifestation-of-power-and-glory': return [f(1),d(da*(l?presence(l,actor):0))];
        case 'words-of-warning': return [def(3),special('WORDS')];
        case 'sudden-ambush': return [e('MOVE',1,'GATHER',['DAHAN']),special('AMBUSH')];
        case 'voice-of-thunder': return [option('PUSH_DAHAN:4',...(l&&invaders(l).length?['FEAR:2']:[]))];
        case 'call-of-the-deeps': return [move(1,['EXPLORER'],true),...(l?.number===0?[e('MOVE',1,'GATHER',['EXPLORER'])]:[])];
        case 'grasping-tide': return [f(2),def(4)];
        case 'swallow-the-land-dwellers': return [e('SPECIAL',1,'DROWN',['EXPLORER']),e('SPECIAL',1,'DROWN',['TOWN']),e('SPECIAL',1,'DROWN',['DAHAN'])];
        case 'tidal-boon': return [e('ENERGY',2),e('LAND',0,'TIDAL',[],null,target)];
        case 'predatory-nightmares': return [d(2),move(2,['DAHAN'])];
        case 'dread-apparitions': return [special('DREAD'),f(1)];
        case 'dreams-of-the-dahan': return [option('GATHER_DAHAN:2',...(l&&countPieces(l,['TOWN','CITY'])?['FEAR:'+Math.min(3,da)]:[]))];
        case 'call-on-midnight-s-dream': return [special('MIDNIGHT')];
        case 'shatter-homesteads': return [f(1), destroy(1, ['TOWN'])];
        case 'raging-storm': return [each(1)];
        case 'lightning-s-boon': return [special('FAST_GIFT', 2)];
        case 'harbingers-of-the-lightning': return [move(2, ['DAHAN'], false, ['HARBINGERS'])];
        case 'flash-floods': return [d(l?.coastal ? 2 : 1)];
        case 'wash-away': return [move(3, ['EXPLORER', 'TOWN'])];
        case 'boon-of-vigor': return [e('ENERGY', target === actor ? 1 : player(s, target).played.length)];
        case 'river-s-bounty': return [move(2, ['DAHAN'], true), special('BOUNTY')];
        case 'concealing-shadows': return [f(1), special('PROTECT_DAHAN')];
        case 'favors-called-due': return [move(4, ['DAHAN'], true), special('FAVORS')];
        case 'mantle-of-dread': return [f(2), e('LAND', 0, 'MANTLE', [], null, target)];
        case 'crops-wither-and-fade': return [f(2), e('REPLACE', 1, 'DOWNGRADE', ['TOWN', 'CITY'])];
        case 'guard-the-healing-land': return [clean(), def(4)];
        case 'a-year-of-perfect-stillness': return [special('SKIP')];
        case 'rituals-of-destruction': return [d(da >= 3 ? 5 : 2), ...(da >= 3 ? [f(2)] : [])];
        case 'draw-of-the-fruitful-earth': return [move(2, ['EXPLORER'], true), move(2, ['DAHAN'], true)];
        case 'savage-mawbeasts': return [...(jungle ? [f(1), d(1)] : []), ...(bonus({ ANIMAL: 3 }) ? [d(1)] : [])];
        case 'voracious-growth': return [option('DAMAGE:2', 'REMOVE_BLIGHT:1')];
        case 'rouse-the-trees-and-stones': return [d(2), move(1, ['EXPLORER'])];
        case 'encompassing-ward': return s.lands.filter(l => presence(l, target) > 0).map(l => e('DEFEND', 2, '', [], l.id));
        case 'song-of-sanctity': return l && countPieces(l, ['EXPLORER']) > 0 ? [move(countPieces(l, ['EXPLORER']), ['EXPLORER'], false, ['REQUIRED'])] : [clean()];
        case 'uncanny-melting': return [...(l && invaders(l).length ? [f(1)] : []), ...(l && ['SANDS', 'WETLAND'].includes(l.terrain) ? [clean()] : [])];
        case 'shadows-of-the-burning-forest': return [f(2), ...(mountain ? [move(1, ['EXPLORER']), move(1, ['TOWN'])] : [])];
        case 'steam-vents': return [destroy(1, bonus({ EARTH: 3 }) ? ['EXPLORER', 'TOWN'] : ['EXPLORER'])];
        case 'veil-the-night-s-hunt': return [option('HUNT:0', 'PUSH_DAHAN:3')];
        case 'elemental-boon': return [special('ELEMENTS', 3)];
        case 'devouring-ants': return [f(1), d(sands ? 2 : 1), destroy(1, ['DAHAN'])];
        case 'dark-and-tangled-woods': return [f(2), ...(mountain ? [def(3)] : [])];
        case 'sap-the-strength-of-multitudes': return [def(5)];
        case 'drift-down-into-slumber': return [def(sands ? 4 : 1)];
        case 'land-of-haunts-and-embers': return [f(l?.blight ? 4 : 2), move(l?.blight ? 4 : 2, ['EXPLORER', 'TOWN']), bl()];
        case 'nature-s-resilience': return bonus({ WATER: 2 }) ? [option('DEFEND:6', 'REMOVE_BLIGHT:1')] : [def(6)];
        case 'visions-of-fiery-doom': return [f(bonus({ FIRE: 2 }) ? 2 : 1), move(1, ['EXPLORER', 'TOWN'])];
        case 'pull-beneath-the-hungry-earth': return [...(l && presence(l, actor) > 0 ? [f(1)] : []), d((l && presence(l, actor) > 0 ? 1 : 0) + (l && ['SANDS', 'WETLAND'].includes(l.terrain) ? 1 : 0))];
        case 'call-of-the-dahan-ways': return [e('REPLACE', 1, 'DAHAN', bonus({ MOON: 2 }) ? ['EXPLORER', 'TOWN'] : ['EXPLORER'])];
        case 'call-to-bloodshed': return [option(`DAMAGE:${da}`, 'GATHER_DAHAN:3')];
        case 'call-to-isolation': return [option(`PUSH_INVADERS:${da}`, 'PUSH_DAHAN:1')];
        case 'call-to-migrate': return [move(3, ['DAHAN'], true), move(3, ['DAHAN'])];
        case 'call-to-tend': return [option('REMOVE_BLIGHT:1', 'PUSH_DAHAN:3')];
        case 'quicken-the-earth-s-struggles': return [option('EACH_BUILDING:1', 'DEFEND:10')];
        case 'delusions-of-danger': return [option('PUSH_EXPLORER:1', 'FEAR:2')];
        case 'drought': return [destroy(3, ['TOWN']), each(1, ['TOWN', 'CITY']), bl(), ...(bonus({ SUN: 3 }) ? [destroy(1, ['CITY'])] : [])];
        case 'gift-of-constancy': return [e('ENERGY', 2), special('CONSTANCY')];
        case 'enticing-splendor': return [option('GATHER_INVADERS:1', 'GATHER_DAHAN:2')];
        case 'entrancing-apparitions': return [def(2), ...(l && !invaders(l).length ? [move(2, ['EXPLORER'], true)] : [])];
        case 'gift-of-living-energy': return [e('ENERGY', 1 + (target !== actor ? 1 : 0) + (s.lands.filter(l => sacred(s, l, actor)).length >= 2 ? 1 : 0))];
        case 'gift-of-power': return [e('GAIN', 1, 'MINOR', [], null, target)];
        case 'gnawing-rootbiters': return [move(2, ['TOWN'])];
        case 'lure-of-the-unknown': return [move(1, ['EXPLORER', 'TOWN'], true)];
        case 'purifying-flame': return l && ['MOUNTAIN', 'SANDS'].includes(l.terrain) ? [option(`DAMAGE:${l.blight}`, 'REMOVE_BLIGHT:1')] : [d(l?.blight ?? 0)];
        case 'rain-of-blood': return [f(l && countPieces(l, ['TOWN', 'CITY']) >= 2 ? 3 : 2)];
        case 'reaching-grasp': return [special('RANGE', 2)];
        case 'accelerated-rot': return [f(2), d(bonus({ SUN: 3, WATER: 2, PLANT: 3 }) ? 9 : 4), ...(bonus({ SUN: 3, WATER: 2, PLANT: 3 }) ? [clean()] : [])];
        case 'cleansing-floods': return [d(bonus({ WATER: 4 }) ? 14 : 4), clean()];
        case 'pillar-of-living-flame': return [f(bonus({ FIRE: 4 }) ? 5 : 3), d(bonus({ FIRE: 4 }) ? 10 : 5), ...(jungle ? [bl()] : [])];
        case 'poisoned-land': return [f(1), d(7), bl(), destroy(10000, ['DAHAN']), ...(bonus({ EARTH: 3, PLANT: 2, ANIMAL: 2 }) ? [special('POISON_BONUS')] : [])];
        case 'terrifying-nightmares': return [f(bonus({ MOON: 4 }) ? 6 : 2), move(4, ['EXPLORER', 'TOWN'])];
        case 'the-trees-and-stones-speak-of-war': return [d(da), def(da * 2), ...(bonus({ SUN: 2, EARTH: 2, PLANT: 2 }) ? [move(2, ['DAHAN'], false, ['MOVE_DEFEND'])] : [])];
        case 'entwined-power': return [special('ENTWINE'), e('GAIN', 1, 'ENTWINE', [], null, target), ...(bonus({ WATER: 2, PLANT: 4 }) ? [e('ENERGY', 3), e('ENERGY', 3, '', [], null, actor), special('GIFT_CARD', 0, []), e('SPECIAL', 0, 'GIFT_CARD', [target], null, actor)] : [])];
        case 'paralyzing-fright': return [f(bonus({ AIR: 2, EARTH: 3 }) ? 8 : 4), special('SKIP')];
        case 'powerstorm': return [e('ENERGY', 3), special('PAID_REPEAT', bonus({ SUN: 2, FIRE: 2, AIR: 3 }) ? 3 : 1)];
        case 'talons-of-lightning': return [f(3), d(5), ...(bonus({ FIRE: 3, AIR: 3 }) && l ? l.adjacent.map(id => e('DESTROY', 1, '', ['TOWN'], id)) : [])];
        case 'the-jungle-hungers': return [destroy(10000, ['EXPLORER', 'TOWN']), ...(bonus({ MOON: 2, PLANT: 3 }) ? [destroy(1, ['CITY'])] : [destroy(10000, ['DAHAN'])])];
        case 'the-land-thrashes-in-furious-pain': return [d((l?.blight ?? 0) * 2 + (l?.adjacent.reduce((n, id) => n + land(s, id).blight, 0) ?? 0)), ...(bonus({ MOON: 3, EARTH: 3 }) ? [e('LAND', 0, 'REPEAT_LAND_PAIN')] : [])];
        case 'tsunami': return [f(2), d(8), destroy(2, ['DAHAN']), ...(bonus({ WATER: 3, EARTH: 2 }) && l ? s.lands.filter(other => other.board === l.board && other.coastal && other.id !== l.id).flatMap(other => [e('FEAR', 1, '', [], other.id), e('DAMAGE', 4, '', [], other.id), e('DESTROY', 1, '', ['DAHAN'], other.id)]) : [])];
        case 'vigor-of-the-breaking-dawn': return [d(da * 2), ...(bonus({ SUN: 3, ANIMAL: 2 }) ? [move(2, ['DAHAN'], false, ['VIGOR']), special('VIGOR_AFTER')] : [])];
        case 'vengeance-of-the-dead': return [f(3), special('VENGEANCE', bonus({ ANIMAL: 3 }) ? 1 : 0)];
        case 'wrap-in-wings-of-sunlight': return [...(bonus({ SUN: 2, AIR: 2, ANIMAL: 2 }) ? [move(3, ['DAHAN'], true)] : []), e('LAND', 0, 'WINGS')];
        case 'blazing-renewal': return [e('LAND', bonus({ FIRE: 3, EARTH: 3, PLANT: 2 }) ? 4 : 0, 'RENEWAL')];
        case 'winds-of-rust-and-atrophy': return [f(1), def(6), e('REPLACE', 1, 'DOWNGRADE', ['TOWN', 'CITY']), ...(bonus({ AIR: 3, WATER: 3, ANIMAL: 2 }) ? [e('LAND', 0, 'REPEAT_WINDS')] : [])];
        case 'indomitable-claim': return [e('PRESENCE', 0, 'POWER'), def(20), ...(bonus({ SUN: 2, EARTH: 3 }) ? [...(l && invaders(l).length ? [f(3)] : []), special('SKIP')] : [])];
        case 'mists-of-oblivion': return [special('RESET_MISTS'), each(1, ['EXPLORER', 'TOWN', 'CITY'], ['MISTS']), ...(bonus({ MOON: 2, AIR: 3, WATER: 2 }) ? [d(3, ['MISTS'])] : [])];
        case 'infinite-vitality': return [special('VITALITY', bonus({ EARTH: 4 }) ? 1 : 0), ...(bonus({ EARTH: 4 }) ? [e('LAND', 0, 'CLEAN_ADJACENT')] : [])];
        case 'dissolve-the-bonds-of-kinship': return [e('REPLACE', 1, 'EXPLORER2', ['CITY']), e('REPLACE', 1, 'EXPLORER', ['TOWN']), e('REPLACE', 1, 'EXPLORER', ['DAHAN']), ...(bonus({ FIRE: 2, WATER: 2, ANIMAL: 3 }) ? [special('CIVIL_WAR')] : []), special('SCATTER')];
        default: requireRule(false, `구현하지 않은 능력: ${spiritPower(key).title}`);
    }
}
