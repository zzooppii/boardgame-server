import { duelCard, duelWonder, DUEL_GODS, DUEL_PROGRESS, DUEL_CONSPIRACIES, DUEL_DECREES, type DuelOption } from '@hangul-rummikub/shared';
import { other, type DuelState, type DuelSeat, type DuelTask, type DuelEntity } from './state.js';
import { city, quote, godCost, countType, hasDecree } from './economy.js';
export type DuelOperation = {
    kind: string;
    a: string;
    b: string;
    n: number;
};
export type DuelChoice = {
    view: DuelOption;
    operation: DuelOperation;
};
export function available(s: DuelState, c: DuelEntity): boolean { return c.zone === 'BOARD' && c.slot !== null && !s.slots[c.slot]!.coveredBy.some(i => s.cards.some(t => t.zone === 'BOARD' && t.slot === i)); }
export function draftAvailable(s: DuelState) { return s.wonders.slice(s.draftCount < 4 ? 0 : 4, s.draftCount < 4 ? 4 : 8).filter(w => w.owner === -1 && !w.removed); }
export function decisionActor(s: DuelState): DuelSeat { return s.tasks[0]?.actor ?? s.active; }
export function decisionLabel(s: DuelState): string {
    const t = s.tasks[0];
    if (!t)
        return s.stage === 'DRAFT' ? '불가사의를 선택하세요' : s.stage === 'NEXT_AGE' ? '다음 시대의 선공을 선택하세요' : '카드 사용 또는 신 활성화를 선택하세요';
    const labels: Partial<Record<DuelTask['kind'], string>> = { PROGRESS: '진보 토큰을 선택하세요', LIBRARY: '진보 토큰을 선택하세요', RESURRECT: '무료로 건설할 버린 카드를 선택하세요', GOD_PLACE: '판테온에 배치할 신을 선택하세요', GOD_SLOT: '신을 놓을 빈 자리를 선택하세요', GOD_TOP: '활성화할 신을 선택하세요', GOD_DECK: '신화 덱을 선택하세요', GOD_PICK: '활성화할 신을 선택하세요', GOD_ORDER: '신화 덱의 맨 위부터 순서를 정하세요', ENKI: '엔키의 진보 토큰을 선택하세요', SNAKE: '복제할 상대 과학 건물을 선택하세요', MINERVA: '미네르바를 놓을 군사 칸을 선택하세요', NEPTUNE_DISCARD: '효과 없이 버릴 군사 토큰을 선택하세요', NEPTUNE_APPLY: '효과를 적용할 군사 토큰을 선택하세요', ANUBIS: '해체할 불가사의를 선택하세요', ISIS: '무료로 건설할 불가사의와 버린 카드를 선택하세요', STEAL_WONDER: '가져올 상대 미건설 불가사의를 선택하세요', SENATE: `원로원 행동 ${t.remaining}회 남음`, CONSPIRE: '영향력을 놓거나 음모를 획득하세요', CONSPIRACY_PICK: '가져올 음모를 선택하세요', CONSPIRACY_RETURN: '남은 음모의 덱 위치를 선택하세요', UNPREPARED: '준비하지 않은 음모를 발동할 수 있습니다', LOCK_PROGRESS: '봉인할 진보 토큰을 선택하세요', SWAP: '교환할 같은 색 건물을 선택하세요', MOVE_DECREE: '이동할 법령과 목적지를 선택하세요', PLACE: '영향력을 놓을 의회를 선택하세요', MOVE: '영향력을 인접 의회로 옮길 수 있습니다', REMOVE: '제거할 상대 영향력을 선택하세요', BOX_BUILD: '시대 준비에서 제외된 건물 중 선택하세요', TOP_BUILD: '배치 최상단의 건물을 선택하세요', DISCARD_TWO: '배치에서 제거할 카드를 선택하세요' };
    return labels[t.kind] ?? '효과의 대상을 선택하세요';
}
export function choices(s: DuelState): DuelChoice[] {
    if (s.phase === 'FINISHED')
        return [];
    const out: DuelChoice[] = [], p = decisionActor(s), op = other(p), me = s.players[p]!, t = s.tasks[0];
    function add(kind: string, a = '', b = '', n = 0, label = kind, group: DuelOption['group'] = 'CHOICE', definitionId: string | null = null, cost: number | null = null, detail = '') {
        out.push({ view: { id: `option-${out.length}`, group, label, detail, sourceId: kind === 'DECREE' ? `decree-position-${s.decrees.findIndex(d => d.id === Number(a))}` : a || null, targetId: b || null, definitionId, cost }, operation: { kind, a, b, n } });
    }
    const cardChoice = (kind: string, c: DuelEntity, b = '', label?: string) => {
        const hidden = c.zone === 'BOARD' && c.slot !== null && !s.slots[c.slot]!.faceUp;
        const title = hidden ? `비공개 ${['WHITE', 'BLACK'].includes(duelCard(c.definitionId).color) ? '의원' : '시대'} 카드 · ${s.slots[c.slot!]!.y + 1}행` : label ?? duelCard(c.definitionId).name;
        add(kind, c.tileId, b, 0, kind === 'FREE_BUILD' ? `무료 건설 · ${title}` : kind === 'FREE_WONDER' ? `무료 불가사의 · ${title}` : title, 'CHOICE', hidden ? null : c.definitionId, kind.startsWith('FREE_') ? 0 : null);
    };
    if (t) {
        const skip = () => add('SKIP', '', '', 0, '이 효과 생략', 'SKIP');
        switch (t.kind) {
            case 'PROGRESS':
            case 'LIBRARY':
            case 'ENKI':
                for (const item of s.progress.filter(i => t.kind === 'ENKI' ? i.zone === 'ENKI' : t.kind === 'LIBRARY' ? t.data.includes(i.id) && i.zone === 'BOX' : i.zone === 'BOARD'))
                    add('PROGRESS', item.id, '', 0, DUEL_PROGRESS.find(d => d.id === item.id)!.name, 'CHOICE', item.id, null, DUEL_PROGRESS.find(d => d.id === item.id)!.text);
                break;
            case 'RESURRECT':
                for (const c of s.cards.filter(c => c.zone === 'DISCARD'))
                    cardChoice('FREE_BUILD', c);
                break;
            case 'BOX_BUILD':
                for (const c of s.cards.filter(c => c.zone === 'BOX' && c.age <= s.age && c.age > 0))
                    cardChoice('FREE_BUILD', c);
                break;
            case 'TOP_BUILD':
                for (const c of s.cards.filter(c => c.zone === 'BOARD' && c.slot !== null && s.slots[c.slot]!.y === 0 && !['WHITE', 'BLACK'].includes(duelCard(c.definitionId).color)))
                    cardChoice('FREE_BUILD', c);
                break;
            case 'DESTROY_BROWN':
            case 'DESTROY_GREY':
            case 'DESTROY_BLUE':
            case 'DESTROY_YELLOW':
                for (const c of city(s, op).filter(c => duelCard(c.definitionId).color === t.kind.slice(8)))
                    cardChoice('DESTROY', c);
                break;
            case 'STEAL_RESOURCE':
                for (const c of city(s, op).filter(c => ['BROWN', 'GREY'].includes(duelCard(c.definitionId).color)))
                    cardChoice('STEAL', c);
                break;
            case 'GOD_PLACE':
                for (const id of s.godDecks.find(d => d.mythology === t.data[0])?.ids.slice(0, 2) ?? [])
                    add('PICK_GOD', id, '', 0, DUEL_GODS.find(d => d.id === id)!.name, 'CHOICE', id);
                break;
            case 'GOD_SLOT':
                s.pantheon.forEach((id, i) => {
                    if (!id)
                        add('PLACE_GOD', t.data[0]!, String(i), i, `${i + 1}번 자리 · 나 ${p === 0 ? 3 + i : 8 - i} / 상대 ${p === 0 ? 8 - i : 3 + i}코인`, 'CHOICE', t.data[0]!);
                });
                break;
            case 'GOD_DECK':
                for (const deck of s.godDecks.filter(d => d.ids.length))
                    add('GOD_DECK', deck.mythology, '', 0, ({ GREEK: '그리스', ROMAN: '로마', PHOENICIAN: '페니키아', EGYPTIAN: '이집트', MESOPOTAMIAN: '메소포타미아' } as Record<string, string>)[deck.mythology]!);
                break;
            case 'GOD_TOP':
            case 'GOD_PICK':
                for (const id of t.data) {
                    const d = DUEL_GODS.find(d => d.id === id);
                    if (d)
                        add('FREE_GOD', id, '', 0, d.name, 'CHOICE', id, null, d.text);
                }
                break;
            case 'GOD_ORDER': {
                const deck = s.godDecks.find(d => d.mythology === t.data[0]);
                for (const id of deck?.ids.filter(id => !t.data.slice(1).includes(id)) ?? [])
                    add('ORDER_GOD', id, '', 0, DUEL_GODS.find(d => d.id === id)!.name, 'CHOICE', id);
                break;
            }
            case 'SNAKE':
                for (const c of city(s, op).filter(c => duelCard(c.definitionId).science))
                    cardChoice('SNAKE', c);
                break;
            case 'MINERVA':
                for (let i = -9; i <= 9; i++)
                    add('MINERVA', String(i), '', i, `군사 트랙 ${i === 0 ? '중앙' : i > 0 ? `상대 방향 +${i}` : `내 방향 ${i}`}`);
                break;
            case 'NEPTUNE_DISCARD':
            case 'NEPTUNE_APPLY':
                for (const n of s.militaryTokens)
                    add(t.kind, String(n), '', n, `${n < 0 ? '왼쪽' : '오른쪽'} ${Math.abs(n) === 3 ? '첫' : '두 번째'} 군사 토큰`);
                break;
            case 'SABOTAGE':
                for (const w of s.wonders.filter(w => w.owner === op && w.built && !w.removed))
                    add('SABOTAGE', w.id, '', 0, duelWonder(w.id).name, 'CHOICE', w.id);
                break;
            case 'DISCARD_ANY':
                for (const c of s.cards.filter(c => c.zone === 'BOARD').sort((a, b) => a.slot! - b.slot!))
                    cardChoice('DISCARD_EFFECT', c);
                break;
            case 'ANUBIS':
                for (const w of s.wonders.filter(w => w.built && !w.removed))
                    add('ANUBIS', w.id, '', 0, `${w.owner === p ? '내' : '상대'} ${duelWonder(w.id).name}`, 'CHOICE', w.id);
                break;
            case 'ISIS':
                for (const w of s.wonders.filter(w => w.owner === p && !w.built && !w.removed))
                    for (const c of s.cards.filter(c => c.zone === 'DISCARD'))
                        cardChoice('FREE_WONDER', c, w.id, `${duelWonder(w.id).name} ← ${duelCard(c.definitionId).name}`);
                break;
            case 'STEAL_WONDER':
                for (const w of s.wonders.filter(w => w.owner === op && !w.built && !w.removed))
                    add('STEAL_WONDER', w.id, '', 0, duelWonder(w.id).name, 'CHOICE', w.id);
                break;
            case 'SENATE':
            case 'PLACE':
            case 'MOVE':
            case 'REMOVE': {
                if ((t.kind === 'SENATE' || t.kind === 'PLACE') && me.influence.reduce((a, b) => a + b, 0) < 12)
                    for (let i = 0; i < 6; i++)
                        if (t.section === -1 || Math.floor(i / 2) === t.section)
                            add('PLACE', String(i), '', i, `${i + 1}번 의회에 배치`);
                if (t.kind === 'SENATE' || t.kind === 'MOVE')
                    for (let i = 0; i < 6; i++)
                        if (me.influence[i]! > 0)
                            for (const j of [i - 1, i + 1])
                                if (j >= 0 && j < 6)
                                    add('MOVE', String(i), String(j), j, `${i + 1}번 → ${j + 1}번 의회`);
                if (t.kind === 'REMOVE')
                    for (let i = 0; i < 6; i++)
                        if (s.players[op]!.influence[i]! > 0)
                            add('REMOVE', String(i), '', i, `${i + 1}번 의회의 상대 영향력 제거`);
                if (t.kind !== 'REMOVE')
                    skip();
                break;
            }
            case 'CONSPIRE':
                if (me.influence.reduce((a, b) => a + b, 0) < 12)
                    add('CONSPIRATOR_PLACE', '', '', 0, '영향력 1개 배치');
                if (s.conspiracyOrder.length)
                    add('DRAW_CONSPIRACY', '', '', 0, '음모 획득');
                skip();
                break;
            case 'CONSPIRACY_PICK':
                for (const id of t.data) {
                    const c = s.conspiracies.find(c => c.id === id)!, d = DUEL_CONSPIRACIES.find(d => d.id === c.definitionId)!;
                    add('KEEP_CONSPIRACY', id, '', 0, d.name, 'CHOICE', d.id, null, d.text);
                }
                break;
            case 'CONSPIRACY_RETURN':
                add('RETURN_CONSPIRACY', '', '', 0, '덱 맨 위에 놓기');
                add('RETURN_CONSPIRACY', '', '', 1, '덱 맨 아래에 놓기');
                break;
            case 'UNPREPARED':
                for (const c of s.conspiracies.filter(c => c.owner === p && c.zone === 'HAND' && !c.triggered && !s.cards.some(e => e.zone === 'PREPARED' && e.under === c.id))) {
                    const d = DUEL_CONSPIRACIES.find(d => d.id === c.definitionId)!;
                    add('TRIGGER', c.id, '', 0, d.name, 'CHOICE', d.id, null, d.text);
                }
                skip();
                break;
            case 'LOCK_PROGRESS':
                for (const token of s.progress.filter(t => t.zone === 'BOARD' || t.zone === 'BOX' || t.zone === 'PLAYER' && t.owner === op))
                    add('LOCK', token.id, t.data[0] ?? '', 0, `${token.zone === 'PLAYER' ? '상대' : token.zone === 'BOX' ? '상자' : '공용'} · ${DUEL_PROGRESS.find(d => d.id === token.id)!.name}`, 'CHOICE', token.id);
                break;
            case 'SWAP':
                for (const c of city(s, op).filter(c => ['BLUE', 'GREEN'].includes(duelCard(c.definitionId).color)))
                    for (const own of city(s, p).filter(own => duelCard(own.definitionId).color === duelCard(c.definitionId).color))
                        cardChoice('SWAP', c, own.tileId, `${duelCard(c.definitionId).name} ↔ 내 ${duelCard(own.definitionId).name}`);
                break;
            case 'MOVE_DECREE':
                for (const d of s.decrees)
                    for (let i = 0; i < 6; i++)
                        if (d.chamber !== i)
                            add('DECREE', String(d.id), String(i), i, `${d.chamber + 1}번의 ${d.revealed ? DUEL_DECREES[d.id - 1] : '비공개 법령'} → ${i + 1}번 의회`);
                break;
            case 'DISCARD_TWO':
                for (const c of s.cards.filter(c => available(s, c)))
                    cardChoice('DISCARD_EFFECT', c);
                if (t.optional)
                    skip();
                break;
            case 'REVEAL':
            case 'HANDOFF':
            case 'CHECK_SCIENCE': break;
        }
        return out;
    }
    if (s.stage === 'DRAFT') {
        for (const w of draftAvailable(s))
            add('DRAFT', w.id, '', 0, duelWonder(w.id).name, 'DRAFT', w.id, null, duelWonder(w.id).onSelect === 'CONSPIRE' ? '선택 즉시 음모 획득' : duelWonder(w.id).onSelect === 'PLACE' ? '선택 즉시 영향력 배치' : '');
        return out;
    }
    if (s.stage === 'NEXT_AGE') {
        add('STARTER', '', '', 0, s.players[0]!.playerId === me.playerId ? '내가 선공' : '상대가 선공');
        add('STARTER', '', '', 1, s.players[1]!.playerId === me.playerId ? '내가 선공' : '상대가 선공');
        return out;
    }
    const money = me.coins + me.protectedCoins;
    for (const c of s.cards.filter(c => available(s, c))) {
        const d = duelCard(c.definitionId), q = quote(s, p, d);
        if (q.total <= money)
            add('BUILD', c.tileId, '', 0, `${d.color === 'WHITE' || d.color === 'BLACK' ? '고용' : '건설'} · ${q.total}코인`, 'BUILD', d.id, q.total, q.detail);
        add('DISCARD', c.tileId, '', 0, `버리고 ${2 + countType(s, p, 'YELLOW') + (hasDecree(s, p, 13) ? 2 : 0)}코인 받기`, 'DISCARD', d.id, null, '건물 효과를 얻지 않습니다.');
        for (const w of s.wonders.filter(w => w.owner === p && !w.built && !w.removed)) {
            const q = quote(s, p, duelWonder(w.id));
            if (q.total <= money)
                add('WONDER', c.tileId, w.id, 0, `${d.name} 사용 → ${duelWonder(w.id).name} · ${q.total}코인`, 'WONDER', w.id, q.total, q.detail);
        }
        for (const conspiracy of s.conspiracies.filter(x => x.owner === p && x.zone === 'HAND' && !x.triggered && !s.cards.some(e => e.zone === 'PREPARED' && e.under === x.id)))
            add('PREPARE', c.tileId, conspiracy.id, 0, `${d.name} 사용 → ${DUEL_CONSPIRACIES.find(d => d.id === conspiracy.definitionId)!.name} 준비`, 'PREPARE', conspiracy.definitionId, 0, '선택한 카드의 건물 효과는 적용하지 않습니다.');
    }
    if (s.settings.pantheon && s.age >= 2)
        s.pantheon.forEach((id, slot) => {
            if (!id)
                return;
            for (let mask = 0; mask < (1 << me.offerings.length); mask++) {
                const offering = me.offerings.reduce((sum, n, i) => sum + ((mask & (1 << i)) ? n : 0), 0), cost = godCost(s, p, slot, offering);
                if (cost <= money)
                    add('INVOKE', String(slot), String(mask), mask, `${DUEL_GODS.find(d => d.id === id)!.name} · ${cost}코인${offering ? ` · 공물 ${offering}` : ''}`, 'INVOKE', id, cost, '카드 배치를 소비하지 않는 본행동입니다.');
            }
        });
    if (s.stage === 'TURN_START')
        for (const c of s.conspiracies.filter(c => c.owner === p && c.zone === 'HAND' && !c.triggered && s.cards.some(e => e.zone === 'PREPARED' && e.under === c.id))) {
            const d = DUEL_CONSPIRACIES.find(d => d.id === c.definitionId)!;
            add('TRIGGER', c.id, '', 0, d.name + ' 발동', 'TRIGGER', d.id, null, d.text);
        }
    return out;
}
