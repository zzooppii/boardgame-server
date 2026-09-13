import { stageEventOptions, stageEventAutomatic } from './branch-claw-stage-events.js';
import { branchEventOptions, branchEventAutomatic } from './branch-claw-events.js';
import { branchMajorOptions, branchMajorAutomatic, oceanDistance } from './branch-claw-major.js';
import { branchMinorOptions, branchMinorAutomatic } from './branch-claw-minor.js';
import { branchClawOptions, branchClawAutomatic } from './branch-claw.js';
import { tokenOptions } from './tokens.js';
import { SPIRIT_ELEMENTS, SPIRIT_ELEMENT_LABELS, spiritDefinition, spiritPower, type PlayerId, type SpiritChoiceOption, type SpiritPiece, type SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { setupScenario } from './settings.js';
import { powerSteps } from './powers.js';
import { step, prepend, player, land, presence, sacred, inRange, countPieces, invaders, makePiece, event, fear, damagePiece, removePiece, health, defense, matches, checkEnd, income, cardPower, requireRule, oceanActive, presenceAllowed, addPresence, drowning, elements, distance } from './primitives.js';
export type SpiritOption = SpiritChoiceOption & {
    apply(): void;
};
const kinds: readonly SpiritPiece['kind'][] = ['EXPLORER', 'TOWN', 'CITY', 'DAHAN'];
const labels: Record<SpiritPiece['kind'], string> = { EXPLORER: '탐험가', TOWN: '마을', CITY: '도시', DAHAN: '다한' };
const selectedKinds = (e: SpiritStep) => kinds.filter(k => e.tags.includes(k));
function buildIsSkipped(s: SpiritState, area: SpiritLand): boolean {
    return area.skip || s.flags.includes(`no-build:${area.id}`)
        || s.flags.includes('no-build-city') && countPieces(area, ['CITY']) > 0
        || s.flags.includes('no-build-dahan') && countPieces(area, ['DAHAN']) > 0
        || s.flags.includes('dahan-outnumber') && countPieces(area, ['DAHAN']) > countPieces(area, ['TOWN', 'CITY'])
        || s.flags.includes('no-build-coastal') && area.coastal
        || s.flags.includes('no-city-coastal') && area.coastal && countPieces(area, ['TOWN']) > countPieces(area, ['CITY']);
}

const branchNames: Record<string, string> = { DAMAGE: '피해', REMOVE_BLIGHT: '오염 제거', DEFEND: '방어', FEAR: '공포', PUSH_TOWN: '마을 밀기', PUSH_DAHAN: '다한 밀기', PUSH_EXPLORER: '탐험가 밀기', PUSH_INVADERS: '탐험가/마을 밀기', GATHER_DAHAN: '다한 모으기', GATHER_INVADERS: '탐험가/마을 모으기', EACH_BUILDING: '각 마을/도시 피해', HUNT: '다한마다 서로 다른 침략자에게 피해 1' };
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
    else if (k === 'PUSH_TOWN' || k === 'PUSH_DAHAN' || k === 'PUSH_EXPLORER' || k === 'PUSH_INVADERS' || k === 'GATHER_DAHAN' || k === 'GATHER_INVADERS')
        prepend(s, { ...e, kind: 'MOVE', n, key: k.startsWith('GATHER') ? 'GATHER' : 'PUSH', tags: k === 'PUSH_TOWN' ? ['TOWN','REQUIRED'] : k.endsWith('DAHAN') ? ['DAHAN'] : k.endsWith('EXPLORER') ? ['EXPLORER', 'REQUIRED'] : ['EXPLORER', 'TOWN', 'REQUIRED'], used: [] });
    else
        throw new Error('Unknown branch');
}
function receive(s: SpiritState, recipient: PlayerId, cardId: string, forget=true) { player(s, recipient).hand.push(cardId); event(s, 'CARD', `${spiritPower(cardPower(s, cardId).key).title} 획득`, recipient); if (forget && cardPower(s, cardId).deck === 'MAJOR')
    prepend(s, step('FORGET', recipient, null, 1)); }
function draw(s: SpiritState, e: SpiritStep, deck: 'MINOR' | 'MAJOR') {
    const pile = deck === 'MINOR' ? s.minor : s.major, discard = deck === 'MINOR' ? s.minorDiscard : s.majorDiscard;
    // The application supplies a fresh shuffled discard order before a draw can require it.
    const count=e.key==='BCM_UNLOCK'?2:4;
    while (pile.length < count && discard.length)
        pile.push(discard.shift()!);
    s.offered = pile.splice(0, count);
    s.offerRecipient = e.target ?? e.actor;
    s.offerOther = e.key === 'ENTWINE' ? e.actor : null;
    s.offerDeck = deck;
    if (s.offered.length)
        prepend(s, step('SPECIAL', s.offerRecipient, null, 0, 'TAKE_CARD', s.offerRecipient,e.key==='BCM_UNLOCK'?['UNLOCK',...e.tags]:[]));
}
function moveRemaining(s: SpiritState, e: SpiritStep, pieceId: string, dest: string) { if (e.n > 1)
    prepend(s, { ...e, n: e.n - 1, used: [...e.used, pieceId, ...(e.tags.includes('SPREAD') ? [`land:${dest}`] : [])] }); }
function extraFear(s: SpiritState, e: SpiritStep, piece: SpiritPiece, killed: boolean) { if (!killed)
    return; if (e.tags.includes('BONUS_FEAR'))
    fear(s, 1, e.actor, e.land); if (e.tags.includes('MISTS') && (piece.kind === 'TOWN' || piece.kind === 'CITY')) {
    const prior = s.flags.find(f => f.startsWith('mists:')), n = Number(prior?.split(':')[1] ?? 0);
    if (n < 4) {
        fear(s, 1, e.actor, e.land);
        s.flags = s.flags.filter(f => !f.startsWith('mists:'));
        s.flags.push(`mists:${n + 1}`);
    }
} }
export function choiceTitle(e: SpiritStep): string {
 const titles:Record<string,string>={BCE2_DIASPORA:'침략자가 가장 많은 지역을 고르세요',BCE2_DISPERSE:'각 인접 지역으로 하나씩 밀어내세요',BCE2_DISCOVERY:'탐험가가 찾아올 성소를 고르세요',BCE2_UPGRADE:'도시로 바뀔 마을을 고르세요',BCE2_PROWL:'야수의 공포 또는 이동을 해결하세요',BCE2_RETREAT:'다한이 함께 떠날 출발지와 목적지를 고르세요',BCE2_DISEASE:'밀림·습지 중 건물이 가장 많은 지역에 질병을 놓으세요',BCE2_TEND:'다한이 돌보는 지역의 오염을 제거하세요',BCE2_COMING:'새 다한이 태어날 산·모래 지역을 고르세요',BCE2_FORTIFY:'침략자 행동에 없는 지형을 골라 추가 건설하세요',BCE_REVEAL:'공개된 이벤트를 함께 읽고 진행하세요',BCE_CHOICE:'팀과 의논해 이벤트의 대응을 고르세요',BCE_PAY:'원소·카드·에너지로 비용을 분담하세요 · 확정 전에는 소모되지 않습니다',BCE_DISEASE:'서로 다른 보드에서 질병이 퍼질 지역을 고르세요',BCE_BLIGHT_LAND:'이벤트로 오염을 추가할 지역을 고르세요',BCE_BEAST_LAND:'야수가 나타날 지역을 고르세요',BCE_PRESENCE:'다한과 함께하는 지역에 현신을 추가할까요?',BCM_RAVAGE_ORDER:'파괴를 먼저 해결할 지역을 고르세요',BCM_FIREVINE_SOURCE:'불덩굴이 뻗어 나올 모래 지역을 고르세요',BCM_FIRE_FLOOD_SOURCE:'두 대상의 사거리를 잴 공통 성소를 고르세요',BCM_FIRE_FLOOD_SECOND:'홍수가 덮칠 두 번째 지역을 고르세요',BCM_FIRE_FLOOD_BONUS:'추가 피해 4를 받을 지역을 고르세요',BCM_REPEAT:'능력을 반복할 지역을 고르세요',BCM_CALAMITY_REMOVE:'토큰을 제거하고 쌓인 공포·피해를 확정하세요',BCM_UNLOCK_PLAY:'새 주요 능력의 준비 비용을 선택하세요',BCM_SINK_RESCUE:'가라앉는 섬에서 살아남은 다한을 옮기세요',BCM_FLOW_MOVE:'이동할 현신과 목적지를 고르세요',BCM_FLOW_CARRY:'현신과 함께 이동할 기물을 고르세요',OCEAN_SETUP:'바다와 이어질 시작 해안을 고르세요',FOLLOW_DAHAN:'이동한 기물을 따라갈 현신을 선택하세요',FANGS_SETUP:'야수가 있는 시작 지역을 고르세요',GREEN_STOP:'현신을 희생해 침략자 행동을 막을까요?',HEART_SETUP:'지켜낼 섬의 심장을 고르세요',HEART_PRESENCE:'심장 가까이에 시작 현신을 놓으세요',RITUAL_ENERGY:'의식에 기여할 에너지를 선택하세요',RITUAL_PRESENCE:'의식에 희생할 현신을 선택하세요',BLITZ_EXPLORE:'추가 탐험가가 들어올 지역을 고르세요',MIDNIGHT_PLAY:'꿈에서 얻은 주요 능력을 즉시 준비할까요?'};
 if(titles[e.key])return titles[e.key]!;
 switch (e.kind) {
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
    if (stageEventOptions(s,e,add)||branchEventOptions(s,e,add)||branchMajorOptions(s,e,add)||branchMinorOptions(s,e,add)||branchClawOptions(s,e,add)||tokenOptions(s,e,add)) return list;
    if (e.kind === 'DAMAGE' && e.n > 0 && l) {
        const areas = e.tags.includes('ADJACENT_ONLY') ? l.adjacent.map(id=>land(s,id)) : e.tags.includes('ADJACENT') ? [l, ...l.adjacent.map(id => land(s, id))] : [l];
        for (const area of areas)
            for (const piece of area.pieces.filter(p => (e.tags.includes('DAHAN_ONLY') ? p.kind === 'DAHAN' : p.kind !== 'DAHAN') && (!e.tags.includes('BUILDINGS_ONLY') || p.kind === 'TOWN' || p.kind === 'CITY') && (!e.tags.includes('DISTINCT') || !e.used.includes(p.id)) && !e.tags.includes(`EXCLUDE:${p.id}`))) {
                add(`${area.id} ${labels[piece.kind]}${piece.strife?' · 분쟁 '+piece.strife:''} · 체력 ${health(area, piece) - piece.damage} → 피해 1`, () => { const killed = damagePiece(s, area, piece, 1, e.actor); extraFear(s, e, piece, killed); event(s, 'DAMAGE', `${area.id} ${labels[piece.kind]} ${killed ? '파괴' : '피해 1'}`, e.actor, area.id); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1, used: e.tags.includes('DISTINCT') ? [...e.used, piece.id] : e.used }); }, area.id, piece.id);
            }
    }
    else if ((e.kind === 'DESTROY' || e.kind === 'REMOVE' || e.kind === 'REPLACE') && e.n > 0 && l) {
        for (const piece of l.pieces.filter(p => selectedKinds(e).includes(p.kind) && !(s.flags.includes(`power:${e.actor}`)&&player(s,e.actor).spirit==='BRINGER'&&s.flags.includes(`dream-killed:${p.id}`)) && !(p.kind === 'DAHAN' && s.flags.includes(`immortal:${l.id}`))))
            add(`${labels[piece.kind]}${piece.strife?' · 분쟁 '+piece.strife:''}${piece.damage ? ' (피해 ' + piece.damage + ')' : ''} ${e.kind === 'REPLACE' ? '교체' : e.kind === 'REMOVE' ? '제거' : '파괴'}`, () => {
                removePiece(s, l, piece, e.kind === 'DESTROY', e.actor);
                extraFear(s, e, piece, e.kind === 'DESTROY');
                if (e.kind === 'REPLACE') {
                    const kind = e.key==='SWEDEN_TOWN'?'TOWN':e.key === 'DAHAN' ? 'DAHAN' : e.key === 'DOWNGRADE' ? (piece.kind === 'CITY' ? 'TOWN' : 'EXPLORER') : 'EXPLORER';
                    const replacement=makePiece(s, l, kind, false);
                    if(piece.kind!=='DAHAN'&&kind!=='DAHAN')replacement.strife=piece.strife;
                    if (e.key === 'EXPLORER2')
                        makePiece(s, l, kind, false);
                }
                event(s, 'DAMAGE', `${l.id} ${labels[piece.kind]} ${e.kind === 'REPLACE' ? '교체' : e.kind === 'REMOVE' ? '제거' : '파괴'}`, e.actor, l.id);
                if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1 });
            }, l.id, piece.id);
        if (e.tags.includes('OPTIONAL'))
            optional();
    }
    else if (e.kind === 'MOVE' && e.n > 0 && l) {
        const gather = e.key === 'GATHER', sources = gather ? l.adjacent.map(id => land(s, id)).filter(l=>oceanActive(s,l)&&(!e.tags.includes('NO_OCEAN')||l.number>0)) : [l];
        for (const source of sources)
            for (const piece of source.pieces.filter(p => selectedKinds(e).includes(p.kind) && !e.used.includes(p.id) && (!e.tags.some(t=>t.startsWith('ONLY:')) || e.tags.includes(`ONLY:${p.id}`)))) {
                let destinations = gather ? [l] : e.tags.includes('ANY_LAND') ? s.lands.filter(a => a.id !== source.id) : source.adjacent.map(id => land(s, id));
                destinations = destinations.filter(l=>oceanActive(s,l)&&(!e.tags.includes('NO_OCEAN')||l.number>0)&&(!e.tags.some(t=>t.startsWith('TO:'))||e.tags.includes(`TO:${l.id}`))&&(!e.tags.includes('TOWARDS_OCEAN')||oceanDistance(s,l)<oceanDistance(s,source)));
                if (e.tags.includes('SPREAD')) {
                    const unused = destinations.filter(d => !e.used.includes(`land:${d.id}`));
                    if (unused.length)
                        destinations = unused;
                }
                if (e.tags.includes('MORE_BUILDINGS'))
                    destinations = destinations.filter(d => countPieces(d, ['TOWN', 'CITY']) > countPieces(source, ['TOWN', 'CITY']));
                for (const dest of destinations)
                    add(`${source.id} ${labels[piece.kind]}${piece.strife?' · 분쟁 '+piece.strife:''}${piece.damage ? ' (피해 ' + piece.damage + ')' : ''} → ${dest.id}`, () => {
                        if(e.tags.includes('BC_CHASE')&&piece.kind!=='DAHAN')s.flags.push('bc-chased');
                        source.pieces = source.pieces.filter(q => q.id !== piece.id);
                        dest.pieces.push(piece);
                        followDahan(s,e,source.id,dest.id,piece);
                        if(dest.number===0) {
                            if(piece.kind==='DAHAN' && e.tags.includes('TIDAL')) prepend(s,step('SPECIAL',e.actor,dest.id,1,'TIDAL_SAVE',e.target,[],[piece.id]));
                            else drowning(s,dest,piece);
                        }
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
            const candidates = (l ? [l] : s.lands.filter(l => e.tags.includes('FANGS') ? l.number>0 : e.n===100 ? l.number===0 : inRange(s, p.playerId, l, e.n))).filter(l=>(e.key==='POWER'||presenceAllowed(s,p.playerId,l)) && (!e.tags.includes('FANGS')||l.terrain==='JUNGLE'||l.tokens.beasts>0)&&(!e.tags.includes('KEEPER_WILDS')||l.tokens.wilds>0||presence(l,owner)>0)&&(!e.tags.includes('NO_BLIGHT')||l.blight===0)&&(!e.tags.includes('GREEN') || ['JUNGLE','WETLAND'].includes(l.terrain)) && (!e.tags.includes('DAHAN') || countPieces(l,['DAHAN'])>0) && (!e.tags.includes('INHABITED') || l.pieces.length>0));
            for (const area of candidates)
                add(`${track === 'energyTrack' ? '에너지' : '카드'} 트랙 → ${area.id}`, () => { p[track]++; addPresenceAt(s, p.playerId, area.id); }, area.id);
        }
        if (p.spirit==='GREEN' && e.tags.includes('GROWTH') && p.destroyedPresence>0 && (!s.blighted||p.energy>0)) for(const area of s.lands.filter(l=>presenceAllowed(s,owner,l) && inRange(s,owner,l,e.n) && (!e.tags.includes('GREEN')||['JUNGLE','WETLAND'].includes(l.terrain)))) add(`파괴된 현신 재생 → ${area.id}`,()=>{if(s.blighted)p.energy--;p.destroyedPresence--;addPresenceAt(s,owner,area.id);},area.id);
        // Adding Presence may instead move an existing Presence, even with covered track spaces.
        for (const from of s.lands.filter(l => presence(l, p.playerId) > 0))
            for (const to of s.lands.filter(l => l.id !== from.id && (e.key==='POWER'||presenceAllowed(s,p.playerId,l)) && (!e.tags.includes('FANGS')||l.terrain==='JUNGLE'||l.tokens.beasts>0)&&(!e.tags.includes('KEEPER_WILDS')||l.tokens.wilds>0||presence(l,owner)>0)&&(!e.tags.includes('NO_BLIGHT')||l.blight===0)&&(!e.tags.includes('GREEN') || ['JUNGLE','WETLAND'].includes(l.terrain)) && (!e.tags.includes('DAHAN') || countPieces(l,['DAHAN'])>0) && (!e.tags.includes('INHABITED') || l.pieces.length>0) && (e.land ? l.id === e.land : e.tags.includes('FANGS') ? l.number>0 : e.n===100 ? l.number===0 : inRange(s, p.playerId, l, e.n))))
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
        let candidates = s.lands.filter(l=>l.number>0 || !['FEAR_LAND'].includes(e.key)&&oceanActive(s,l));
        if (e.key === 'TIDAL' || e.key === 'MANTLE')
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
                if (e.key === 'TIDAL') prepend(s,step('MOVE',owner,area.id,1,'PUSH',owner,['TOWN','TIDAL']),step('MOVE',owner,area.id,2,'PUSH',owner,['DAHAN','TIDAL']));
                else if (e.key === 'MANTLE')
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
        if(e.key==='BLITZ_EXPLORE'){for(const id of e.tags)add(`${id} 추가 탐험가`,()=>makePiece(s,land(s,id),'EXPLORER'),id);}
        else if(e.key==='SWEDEN_SETUP') {const areas=s.lands.filter(a=>a.board===e.tags[0]&&e.tags.includes(a.terrain));const min=Math.min(...areas.map(a=>invaders(a).length));for(const area of areas.filter(a=>invaders(a).length===min)) add(`${area.id}에 마을 추가`,()=>makePiece(s,area,'TOWN'),area.id);}
        else if(e.key==='HEART_SETUP') {for(const area of s.lands.filter(a=>a.board===p.board&&!a.coastal)) add(`${area.id}을 섬의 심장으로 선택`,()=>{s.hearts.push(area.id);makePiece(s,area,'EXPLORER');const legal=s.lands.filter(a=>a.board===p.board&&presenceAllowed(s,owner,a));const min=Math.min(...legal.map(a=>distance(s,a.id,area.id)));prepend(s,step('SPECIAL',owner,area.id,min,'HEART_PRESENCE',owner));for(const pile of [s.minor,s.major]){const id=pile.shift();if(id)p.hand.push(id);}},area.id);}
        else if(e.key==='HEART_PRESENCE' && l) {for(const area of s.lands.filter(a=>a.board===p.board&&presenceAllowed(s,owner,a)&&distance(s,a.id,l.id)===e.n))for(const track of ['energyTrack','cardTrack'] as const)if(p.spirit&&p[track]<(track==='energyTrack'?spiritDefinition(p.spirit).energy:spiritDefinition(p.spirit).plays).length-1)add(`${track==='energyTrack'?'에너지':'카드'} 트랙 → ${area.id}`,()=>{p[track]++;addPresenceAt(s,owner,area.id);},area.id);}
        else if(e.key==='BLIGHT_PENALTY') {add('현신 1개 파괴',()=>prepend(s,step('SPECIAL',owner,null,0,'DESTROY_PRESENCE',owner)));if(s.blightCard==='MEMORY'&&[...p.hand,...p.played,...p.discard].length)add('능력 카드 1장 망각',()=>prepend(s,step('FORGET',owner,null,1)));}
        else if(e.key==='ESCALATE') {let areas=s.lands.filter(a=>a.number>0&&a.board===e.tags[0]);if(s.settings.adversary==='PRUSSIA'){if(areas.some(a=>countPieces(a,['TOWN','CITY'])))for(const area of areas.filter(a=>!countPieces(a,['TOWN'])))add(`${area.id}에 마을 추가`,()=>makePiece(s,area,'TOWN'),area.id);}else if(s.settings.adversary==='ENGLAND'){const max=Math.max(...areas.map(a=>countPieces(a,['TOWN','CITY'])));if(max>0)for(const area of areas.filter(a=>countPieces(a,['TOWN','CITY'])===max))add(`${area.id} 추가 건설`,()=>prepend(s,step('SPECIAL',e.actor,area.id,0,'ESCALATE_BUILD')),area.id);}}
        else if(e.key==='SWEDEN_MINE' && l) {for(const area of l.adjacent.map(id=>land(s,id)).filter(a=>a.number>0&&!countPieces(a,['TOWN','CITY'])))add(`${area.id}에 마을 추가`,()=>makePiece(s,area,'TOWN'),area.id);}
        else if(e.key==='MILITARY' && l) {const areas=s.lands.filter(a=>a.number>0&&countPieces(a,['DAHAN']));const min=Math.min(...areas.map(a=>distance(s,l.id,a.id)));for(const area of areas.filter(a=>distance(s,l.id,a.id)===min))add(`${area.id} 군사 대응`,()=>makePiece(s,area,e.tags[0]==='TOWN'?'TOWN':'EXPLORER'),area.id);}
        else if((e.key==='RITUAL_PAY'||e.key==='RITUAL_PRESENCE')&&l) {const i=s.players.findIndex(q=>q.playerId===owner),others=s.players.slice(i+1),have=e.key==='RITUAL_PAY'?p.energy:presence(l,owner),other=others.reduce((n,q)=>n+(e.key==='RITUAL_PAY'?q.energy:presence(l,q.playerId)),0);for(let n=Math.max(0,e.n-other);n<=Math.min(e.n,have);n++)add(`${e.key==='RITUAL_PAY'?'에너지':'현신'} ${n}개 바치기`,()=>{if(e.key==='RITUAL_PAY')p.energy-=n;else{addPresence(l,owner,-n);p.destroyedPresence+=n;}if(e.n>n){const next=others[0];requireRule(next);prepend(s,{...e,n:e.n-n,target:next.playerId});}},l.id);}
        else if (e.key === 'FANGS_SETUP') { for(const area of s.lands.filter(l=>l.number>0&&l.tokens.beasts>0))add(`시작 현신 → ${area.id}`,()=>addPresenceAt(s,owner,area.id),area.id); }
        else if (e.key === 'OCEAN_SETUP') { for(const area of s.lands.filter(l=>l.board===p.board && l.number>0 && l.coastal)) add(`初 현신 → ${area.id}`.replace('初','시작'),()=>addPresenceAt(s,owner,area.id),area.id); }
        else if(e.key==='RECLAIM_GROW') { for(const id of p.discard) add(cardPower(s,id).title,()=>{p.discard=p.discard.filter(c=>c!==id);p.hand.push(id);}); optional(); }
        else if(e.key==='REVEAL_FEAR') { for(const [i,key] of s.fearDeck.entries()) if(!s.revealedFear.includes(key)) add(`공포 덱 위에서 ${i+1}번째 카드 공개`,()=>{s.revealedFear.push(key);event(s,'FEAR',`공포 카드 공개 · ${SPIRIT_FEAR_NAMES[key]}`,e.actor);}); optional(); }
        else if(e.key==='COPY_ELEMENT') { const available=elements(s,owner); for(const element of SPIRIT_ELEMENTS.filter(x=>available[x]>0)) add(SPIRIT_ELEMENT_LABELS[element],()=>p.elements.push(element)); optional(); }
        else if(e.key==='GREEN_STOP' && l) { add('현신 1개 파괴 · '+(e.tags[0]==='RAVAGE'?'파괴':'건설')+' 막기',()=>{addPresence(l,owner,-1);p.destroyedPresence++;event(s,'GROW',`${l.id} 녹음으로 침략자 행동 차단`,owner,l.id);},l.id); add('침략자 행동 진행',()=>prepend(s,step('SPECIAL',e.actor,l.id,0,e.tags[0]!,null,['GREEN_ALLOWED']))); }
        else if(e.key==='DESTROY_PRESENCE') { for(const area of s.lands.filter(a=>presence(a,owner)>0 && (!l||distance(s,a.id,l.id)<=e.n))) add(`${area.id} 현신 파괴`,()=>{addPresence(area,owner,-1);p.destroyedPresence++;},area.id); }
        else if(e.key==='FOLLOW_DAHAN' && l) { const dest=land(s,e.used[0]!); if(presence(l,owner)>0 && presenceAllowed(s,owner,dest)) add(`${l.id} 현신 → ${dest.id}`,()=>{addPresence(l,owner,-1);addPresenceAt(s,owner,dest.id);},dest.id); optional(); }
        else if(e.key==='TIDE_IN'||e.key==='TIDE_OUT') { const areas=s.lands.filter(a=>a.number===0&&!e.used.includes(a.id)); for(const ocean of areas) { const sources=e.key==='TIDE_IN'?ocean.adjacent.map(id=>land(s,id)):[ocean]; for(const from of sources.filter(a=>presence(a,owner)>0)) for(const to of (e.key==='TIDE_IN'?[ocean]:ocean.adjacent.map(id=>land(s,id)))) add(`${from.id} 현신 → ${to.id}`,()=>{addPresence(from,owner,-1);addPresenceAt(s,owner,to.id);prepend(s,{...e,used:[...e.used,ocean.id]});},to.id); add(`${ocean.id} 조수 이동 생략`,()=>prepend(s,{...e,used:[...e.used,ocean.id]}),ocean.id); } }
        else if(e.key==='DROWN' && l) { for(const piece of l.pieces.filter(p=>selectedKinds(e).includes(p.kind))) add(`${labels[piece.kind]} 익사`,()=>drowning(s,l,piece),l.id,piece.id); }
        else if(e.key==='TIDAL_SAVE' && l) { const piece=l.pieces.find(p=>p.id===e.used[0]); if(piece) { for(const area of s.lands.filter(a=>a.number>0&&a.coastal)) add(`다한 구출 → ${area.id}`,()=>{l.pieces=l.pieces.filter(p=>p.id!==piece.id);area.pieces.push(piece);followDahan(s,e,l.id,area.id,piece);},area.id); add('다한 익사',()=>drowning(s,l,piece)); } }
        else if(e.key==='OVERGROW' && l) { add('현신 1개 추가',()=>prepend(s,step('PRESENCE',e.actor,l.id))); if(presence(l,e.actor)&&invaders(l).length) add('공포 3',()=>fear(s,3,e.actor,l.id)); }
        else if(e.key==='MIDNIGHT' && l) { if(countPieces(l,['DAHAN'])) add('주요 능력 획득',()=>{prepend(s,step('GAIN',owner,null,1,'MAJOR'),step('SPECIAL',owner,l.id,0,'MIDNIGHT_AFTER',owner,[],[...p.hand,...p.discard,...p.played]));}); if(invaders(l).length) add('공포 2',()=>fear(s,2,e.actor,l.id)); }
        else if(e.key==='MIDNIGHT_PLAY') { for(const id of p.hand.filter(id=>cardPower(s,id).deck==='MAJOR' && !e.used.includes(id) && cardPlayCost(s,id)<=p.energy)) add(`즉시 준비 · ${cardPower(s,id).title}`,()=>{p.energy-=cardPlayCost(s,id);p.hand=p.hand.filter(c=>c!==id);p.played.push(id);}); optional(); }
        else if (e.key === 'REMOVE_HEALTH' && l) {
            for (const piece of invaders(l).filter(q => health(l, q) <= e.n))
                add(`${labels[piece.kind]} 제거`, () => { removePiece(s, l, piece, false, e.actor); if (e.n > health(l, piece))
                    prepend(s, { ...e, n: e.n - health(l, piece) }); }, l.id, piece.id);
            optional();
        }
        else if (e.key === 'SAFETY_GATHER' && l) {
            for (const source of l.adjacent.map(id => land(s, id)))
                for (const piece of invaders(source).filter(q => q.kind !== 'CITY' && countPieces(l, ['TOWN', 'CITY']) > countPieces(source, ['TOWN', 'CITY'])))
                    add(`${source.id} ${labels[piece.kind]} → ${l.id}`, () => { if(e.tags.includes('BC_CHASE')&&piece.kind!=='DAHAN')s.flags.push('bc-chased');
                        source.pieces = source.pieces.filter(q => q.id !== piece.id); l.pieces.push(piece); }, l.id, piece.id);
            optional();
        }
        else if (e.key === 'TAKE_CARD') {
            for (const id of s.offered)
                add(cardPower(s, id).title, () => { const leftovers = s.offered.filter(c => c !== id), other = s.offerOther; receive(s, owner, id,!e.tags.includes('UNLOCK')); if(e.tags.includes('THRESHOLD'))prepend(s,step('SPECIAL',owner,null,0,'BCM_UNLOCK_PLAY',owner,[id])); s.offerOther = null; s.offered = []; if (other && leftovers.length) {
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
                add(e.used.includes('FANGS')&&tag.startsWith('presence:')?'밀림 또는 야수 지역에 현신 추가 · 거리 제한 없음':growthLabel(tag), () => { const remaining = e.tags.filter((_, index) => i !== index); if (remaining.length)
                    prepend(s, { ...e, tags: remaining }); const [kind, n] = tag.split(':'); if (['presence','green','dahan','inhabited'].includes(kind!)) prepend(s,step('PRESENCE',e.actor,null,Number(n),'',null,['GROWTH',...e.used,...(kind==='green'?['GREEN']:kind==='dahan'?['DAHAN']:kind==='inhabited'?['INHABITED']:[])]));
                else if(kind==='reclaimone') prepend(s,step('SPECIAL',e.actor,null,0,'RECLAIM_GROW'));
                else if(kind==='tide-in'||kind==='tide-out') prepend(s,step('SPECIAL',e.actor,null,0,kind==='tide-in'?'TIDE_IN':'TIDE_OUT'));
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
                add(`${l.id} 다한 → ${dest.id}`, () => { l.pieces = l.pieces.filter(p => p.id !== piece.id); dest.pieces.push(piece); followDahan(s,e,l.id,dest.id,piece); if (e.n > 1)
                    prepend(s, { ...e, n: e.n - 1 }); event(s, 'MOVE', `${l.id} → ${dest.id} 다한 이동`, e.actor, dest.id); }, dest.id, piece.id);
            optional();
        }
    }
    return list;
}
function growthLabel(tag: string) { const [k, n] = tag.split(':'); return k==='green' ? '현신 추가 · 사거리 2 · 밀림/습지' : k==='dahan' ? `현신 추가 · 사거리 ${n} · 다한 지역` : k==='inhabited' ? '현신 추가 · 사거리 4 · 다한/침략자 지역' : k==='tide-in' ? '각 바다로 현신 모으기' : k==='tide-out' ? '각 바다에서 현신 밀기' : k==='reclaimone' ? '카드 1장 회수' : k === 'presence' ? n==='100'?'아무 바다에 현신 추가':`현신 추가 · 사거리 ${n}` : k === 'energy' ? `에너지 +${n}` : k === 'reclaim' ? '사용한 카드 전부 회수' : '능력 카드 획득'; }
function addPresenceAt(s: SpiritState, actor: PlayerId, id: string) { const prior=presence(land(s,id),actor); const l = land(s, id), p = l.presence.find(p => p.playerId === actor); if (p)
    p.count++;
else
    l.presence.push({ playerId: actor, count: 1 }); event(s, 'GROW', `${id} 현신 배치`, actor, id);if(player(s,actor).spirit==='KEEPER'&&prior===1)prepend(s,step('MOVE',actor,id,countPieces(l,['DAHAN']),'PUSH',actor,['DAHAN','REQUIRED'])); }
export function automatic(s: SpiritState, e: SpiritStep): boolean {
    if(stageEventAutomatic(s,e)||branchEventAutomatic(s,e)||branchMajorAutomatic(s,e)||branchMinorAutomatic(s,e)||branchClawAutomatic(s,e))return true;
    const l = e.land ? land(s, e.land) : null, owner = e.target ?? e.actor, p = player(s, owner);
    if (e.kind === 'CHECK') {
        if(s.settings.scenario==='INSURRECTION') { const moved=s.flags.filter(f=>f.startsWith('raid:')); if(moved.length) {s.flags=s.flags.filter(f=>!f.startsWith('raid:')&&!f.startsWith('power:')); prepend(s,...moved.flatMap(f=>{const id=f.slice(5);const area=s.lands.find(l=>l.pieces.some(p=>p.id===id));return area?[step('DAMAGE',e.actor,area.id,1)]:[]}),e);return true;} }
        s.flags=s.flags.filter(f=>!f.startsWith('power:'));
        checkEnd(s);
        return true;
    }
    if (e.kind === 'FEAR') {
        fear(s, e.n, e.actor, e.land);
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
        if(s.blightPool<=0) return true;
        const cascade = l.blight > 0 && e.key!=='EXTRA';
        l.blight++;
        s.blightPool = Math.max(0, s.blightPool - 1);
        for (const pr of e.key==='EXTRA'?[]:l.presence) {
            if (pr.count > 0) {
                pr.count--;
                player(s, pr.playerId).destroyedPresence++;
            }
        }
        l.presence = l.presence.filter(p => p.count > 0);
        event(s, 'BLIGHT', `${l.id} 오염 추가${cascade ? ' · 연쇄 발생' : ''}`, e.actor, l.id);
        if(s.blightPool===0&&s.blightCard&&!s.blighted){s.blighted=true;const n=((s.blightCard==='SPIRAL'?5:4)-(s.settings.scenario==='BLITZ'?1:0))*s.players.length;s.blightPool=n;s.blightTotal+=n;event(s,'BLIGHT',s.blightCard==='SPIRAL'?'오염된 섬 · 쇠퇴의 소용돌이':'오염된 섬 · 먼지가 되는 기억');}
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
        if (e.key === 'MINOR' || e.key === 'MAJOR' || e.key==='BCM_UNLOCK') {
            draw(s, e, e.key==='MINOR'?'MINOR':'MAJOR');
            return true;
        }
        return false;
    }
    if (e.kind !== 'SPECIAL')
        return false;
    switch (e.key) {
        case 'SWEDEN_ESCALATE':if(l&&countPieces(l,['DAHAN'])>0&&invaders(l).length>=countPieces(l,['DAHAN']))prepend(s,step('REPLACE',e.actor,l.id,1,'SWEDEN_TOWN',null,['DAHAN']));return true;
        case 'SCENARIO_SETUP': setupScenario(s); return true;
        case 'RITUAL_FINISH': {s.terror=s.terror===1?2:s.terror===2?3:4;const earned=s.fearEarned.splice(0);prepend(s,...earned.map(key=>step('SPECIAL',e.actor,null,0,'FEAR_CARD',null,[key])),...(l?[step('MOVE',e.actor,l.id,countPieces(l,['DAHAN']),'PUSH',null,['DAHAN','REQUIRED','SPREAD'])]:[]),step('CHECK',e.actor));return true;}
        case 'ESCALATE_BUILD': {if(l&&!buildIsSkipped(s,l)){const green=s.players.find(p=>p.spirit==='GREEN'&&sacred(s,l,p.playerId));if(green){prepend(s,step('SPECIAL',e.actor,l.id,0,'GREEN_STOP',green.playerId,['BUILD_LAND']));return true;}prepend(s,step('SPECIAL',e.actor,l.id,0,'BUILD_LAND'));}return true;}
        case 'INVADER_START': prepend(s,...(s.blighted?s.players.map(q=>step('SPECIAL',q.playerId,null,0,'BLIGHT_PENALTY',q.playerId)):[]),...(s.settings.expansion==='BRANCH_CLAW'?[step('SPECIAL',e.actor,null,0,'BCE_START')]:[])); return true;
        case 'IMMIGRATION': { if(s.settings.adversary==='ENGLAND'&&s.settings.level>=3&&s.immigration) {const old=s.build;s.build=s.immigration;automatic(s,step('SPECIAL',e.actor,null,0,'BUILD'));if(s.settings.level===6&&!s.flags.includes('fear-resolved'))automatic(s,step('SPECIAL',e.actor,null,0,'BUILD'));s.build=old;}s.stage='RAVAGE';return true;}
        case 'WORDS': if(l) s.flags.push(`words:${l.id}`); return true;
        case 'DREAD': if(l) s.flags.push(`dread:${l.id}`); return true;
        case 'AMBUSH': if(l) prepend(s,step('DESTROY',e.actor,l.id,countPieces(l,['DAHAN']),'',null,['EXPLORER'])); return true;
        case 'MIDNIGHT_AFTER': { const key=s.cards.find(c=>c.key==='call-on-midnight-s-dream')?.cardId; if(key && ![...p.hand,...p.played,...p.discard].includes(key) && l) { p.energy+=countPieces(l,['DAHAN']); prepend(s,step('SPECIAL',owner,l.id,0,'MIDNIGHT_PLAY',owner,[],e.used)); } return true; }
        case 'STAGE_BUILD':
            s.stage = 'BUILD';
            event(s, 'PHASE', '건설 단계');
            return true;
        case 'GROWTH': return e.tags.length === 0;
        case 'END_GROW':
            if(!p.grown)return true;
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
            if(l&&s.flags.includes('event-stricken')&&(l.tokens.disease>0||invaders(l).some(p=>p.strife>0))){event(s,'DAMAGE',`${l.id} 질병·분쟁으로 파괴 생략`,e.actor,l.id);return true;}
            if (l && !l.skip) {
                if(invaders(l).length&&s.flags.includes(`trade-build:${l.id}`)){s.flags.splice(s.flags.indexOf(`trade-build:${l.id}`),1);prepend(s,step('SPECIAL',e.actor,l.id,0,'ESCALATE_BUILD'));return true;}
                const green=s.players.find(p=>p.spirit==='GREEN'&&sacred(s,l,p.playerId));
                if(green&&!e.tags.includes('GREEN_ALLOWED')&&invaders(l).length) {prepend(s,step('SPECIAL',e.actor,l.id,0,'GREEN_STOP',green.playerId,['RAVAGE']));return true;}
                if(s.flags.includes(`ruin:${l.id}`)){const high=s.settings.adversary==='SWEDEN'&&s.settings.level>=3;const n=invaders(l).reduce((n,p)=>n+(p.kind==='EXPLORER'?1:p.kind==='TOWN'?(high?3:2):(high?5:3)),0)+(invaders(l).length&&s.flags.includes('event-aggression')?1:0);prepend(s,step('DAMAGE',e.actor,l.id,n,'',null,['ADJACENT_ONLY']));return true;}
                const originalDahan=countPieces(l,['DAHAN']);
                const sweden=s.settings.adversary==='SWEDEN', highSweden=sweden&&s.settings.level>=3;
                const attackers=invaders(l),total=attackers.reduce((n,p)=>n+(p.strife>0?0:p.kind==='EXPLORER'?1:p.kind==='TOWN'?(highSweden?3:2):(highSweden?5:3)),0)+(attackers.length&&s.flags.includes('event-aggression')?1:0),amount=Math.max(0,total-defense(s,l)-(s.flags.includes('event-canny')?countPieces(l,['DAHAN']):0)-(e.tags.includes('POWER_RAVAGE')?e.n:0));
                for(const attacker of attackers)if(attacker.strife>0)attacker.strife--;
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
                const dead=originalDahan-countPieces(l,['DAHAN']), thunder=s.players.find(p=>p.spirit==='THUNDER');
                if (attackers.length > 0) prepend(s, ...(amount >= 2 ? [step('BLIGHT', e.actor, l.id, 1),...(sweden&&s.settings.level>=1&&amount>=6?[step('BLIGHT',e.actor,l.id,1,'EXTRA')]:[]),...(sweden&&s.settings.level>=5?[step('SPECIAL',e.actor,l.id,0,'SWEDEN_MINE')]:[])] : []), ...(thunder?Array.from({length:dead},()=>step('SPECIAL',e.actor,l.id,1,'DESTROY_PRESENCE',thunder.playerId)):[]), step('DAMAGE', e.actor, l.id, (s.flags.includes(`words:${l.id}`)?originalDahan:countPieces(l, ['DAHAN'])) * 2), step('CHECK', e.actor));
                event(s, 'DAMAGE', `${l.id} 파괴 · 피해 ${total}, 방어 ${defense(s, l)+(s.flags.includes('event-canny')?originalDahan:0)}`, e.actor, l.id);
            }
            return true;
        case 'BUILD':
            prepend(s,...s.lands.filter(l=>l.number>0&&matches(l,s.build)).map(l=>step('SPECIAL',e.actor,l.id,0,'BUILD_CARD_LAND')));
            return true;
        case 'BUILD_CARD_LAND':
            if(l&&(invaders(l).length>0||s.settings.adversary==='ENGLAND'&&s.settings.level>=1&&l.adjacent.filter(id=>land(s,id).number>0).reduce((n,id)=>n+countPieces(land(s,id),['TOWN','CITY']),0)>=2))prepend(s,step('SPECIAL',e.actor,l.id,0,'ESCALATE_BUILD'));
            return true;
        case 'BUILD_LAND': if(l&&!buildIsSkipped(s,l)) {if(l.tokens.disease>0){l.tokens.disease--;return true;}makePiece(s,l,countPieces(l,['TOWN'])>countPieces(l,['CITY'])?'CITY':'TOWN');event(s,'BUILD',`${l.id} 건설`,e.actor,l.id);} return true;
        case 'EXPLORE': {
            const card = s.invaderDeck.shift();
            if (!card) {
                s.phase = 'FINISHED';
                s.result = { reason: 'INVADERS', winnerPlayerIds: [], round: s.round };
                s.queue = [];
                event(s, 'LOSE', '침략자 덱이 소진되었습니다.');
                return true;
            }
            s.explore = card; const explored: string[]=[];
            for (const area of s.lands.filter(l => l.number>0 && matches(l, card) && !l.skip)) {
                if (s.flags.includes('no-explore-dahan') && countPieces(area, ['DAHAN']) >= 2)
                    continue;
                if (area.coastal || countPieces(area, ['TOWN', 'CITY']) > 0 || area.adjacent.some(id => countPieces(land(s, id), ['TOWN', 'CITY']) > 0)) {
                    if(area.tokens.wilds>0){area.tokens.wilds--;event(s,'EXPLORE',`${area.id} 야생으로 탐험 차단`,e.actor,area.id);continue;}
                    makePiece(s, area, 'EXPLORER');if(s.flags.includes('event-recon'))makePiece(s,area,'EXPLORER'); explored.push(area.id);
                    event(s, 'EXPLORE', `${area.id} 탐험가 진입`, e.actor, area.id);
                }
            }
            const after:SpiritStep[]=[];
            if(s.settings.scenario==='BLITZ')for(const q of s.players){const ids=explored.filter(id=>id[0]===q.board);if(ids.length)after.push(step('SPECIAL',q.playerId,null,0,'BLITZ_EXPLORE',q.playerId,ids));}
            if(card.stage===2&&!card.coastal){if(s.settings.adversary==='SWEDEN')after.push(...explored.map(id=>step('SPECIAL',e.actor,id,0,'SWEDEN_ESCALATE')));else if(s.settings.adversary!=='NONE')after.push(...s.players.map(q=>step('SPECIAL',q.playerId,null,0,'ESCALATE',q.playerId,[q.board])));}
            prepend(s,...after);
            return true;
        }
        case 'ADVANCE_INVADERS':
            if(s.settings.adversary==='ENGLAND'&&s.settings.level===3&&s.ravage?.stage===2) s.flags.push('immigration-ended');
            if(s.settings.adversary==='ENGLAND'&&s.settings.level>=3) s.immigration=s.settings.level===3&&(s.ravage?.stage!==1||s.flags.includes('immigration-ended'))?null:s.ravage;
            if (s.ravage)
                s.invaderDiscard.push(s.ravage);
            s.ravage = s.build;
            s.build = s.explore;
            s.explore = null;
            if(s.flags.includes('event-sacred-explorers')||s.flags.includes('event-fortification'))prepend(s,step('SPECIAL',e.actor,null,0,'BCE2_AFTER_ADVANCE'));
            return true;
        case 'TIME':
            for (const q of s.players)
                if (q.reclaimAtEnd > 0)
                    prepend(s, step('SPECIAL', q.playerId, null, q.reclaimAtEnd, 'CONSTANCY_RECLAIM', q.playerId));
            s.queue.push(step('SPECIAL', e.actor, null, 0, 'NEW_ROUND'));
            return true;
        case 'NEW_ROUND':
            for(const q of s.players)for(const id of [...q.hand,...q.played,...q.discard].filter(id=>s.flags.includes(`forget-end:${id}`))){q.hand=q.hand.filter(c=>c!==id);q.played=q.played.filter(c=>c!==id);q.discard=q.discard.filter(c=>c!==id);s.majorDiscard.push(id);event(s,'CARD',`${cardPower(s,id).title} 라운드 종료 망각`,q.playerId);}
            for (const q of s.players) {
                q.growthSelections=[];q.reclaimedCards=[];q.bonusPlays=0; q.greenRepeats=0; q.trackChoices=[];
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
                area.dahanHealth = 0;area.eventHealthLoss=false;
            }
            s.flags = s.flags.filter(f=>f==='immigration-ended');
            s.currentEvent=null;s.eventInvaderStage=null;s.vengeance = [];
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
            s.flags.push('fear-resolved');
            resolveFear(s, e);
            return true;
        default: return false;
    }
}
export function settle(s: SpiritState) {
    let budget = 10000;
    while ((s.queue.length || s.flags.some(f => f.startsWith('raid:'))) && s.phase === 'PLAYING') {
        if (!s.queue.length) s.queue.push(step('CHECK', s.players[0]!.playerId));
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

function followDahan(s: SpiritState,e: SpiritStep,from: string,to: string,piece: SpiritPiece) { if(piece.kind!=='DAHAN') return; if(s.settings.scenario==='INSURRECTION'&&!s.flags.includes(`raid:${piece.id}`)) s.flags.push(`raid:${piece.id}`); for(const p of s.players.filter(p=>p.spirit==='THUNDER'&&presence(land(s,from),p.playerId)>0)) prepend(s,step('SPECIAL',e.actor,from,0,'FOLLOW_DAHAN',p.playerId,[],[to])); }

function cardPlayCost(s:SpiritState,id:string){const c=cardPower(s,id);return c.cost-(s.settings.scenario==='BLITZ'&&c.speed==='FAST'?1:0);}
