import { gain, registerArnakEffects, type ArnakEffect, arnakResources } from './catalog.js';
import type { ArnakResources, ArnakTravel } from './actions.js';
const draw: ArnakEffect = { kind: 'draw' }, exile: ArnakEffect = { kind: 'exile' }, up: ArnakEffect = { kind: 'resourceUpgrade' }, refresh: ArnakEffect = { kind: 'refresh' };
const travel = (...travel: ArnakTravel[]): ArnakEffect => ({ kind: 'travel', travel });
const choice = (...choices: ArnakEffect[][]): ArnakEffect => ({ kind: 'choice', choices });
export const ARNAK_SITES = [
    ...[{ coin: 2 }, { compass: 2 }, { tablet: 2 }, { arrow: 1 }, { jewel: 1 }].map((r, i) => ({ id: 'base-' + i, level: 0, name: ['해안 야영지', '탐험가의 길', '석판 채석장', '고대 제단', '보석 동굴'][i]!, art: i, effects: registerArnakEffects('base-' + i, i === 4 ? [{ kind: 'discard', after: [gain(r)] }] : [gain(r)]) })),
    ...[[draw, gain({ coin: 1, tablet: 1 })], [gain({ tablet: 1, arrow: 1 })], [{ kind: 'fear', after: [gain({ tablet: 1, jewel: 1 })] }], [choice([gain({ compass: 2 })], [{ kind: 'buy', mode: 'item', amount: 99 }])], [gain({ coin: 1, arrow: 1 })], [{ kind: 'fear', after: [gain({ compass: 1, jewel: 1 })] }], [gain({ jewel: 1 })], [draw, gain({ arrow: 1 })], [gain({ compass: 1, arrow: 1 })], [gain({ coin: 1, tablet: 2 })]].map((effects, i) => ({ id: 'site1-' + i, level: 1, name: ['숲속 서고', '이끼 낀 제단', '잊힌 제의실', '대상인의 유적', '석양의 전망대', '뱀의 샘', '붉은 수정 동굴', '강변의 비문', '탐험가의 묘', '무너진 궁전'][i]!, art: 8 + i % 4, effects: registerArnakEffects('site1-' + i, effects as ArnakEffect[]) })),
    ...[[gain({ arrow: 1, jewel: 1 })], [gain({ tablet: 2, jewel: 1 })], [gain({ coin: 1, compass: 1, tablet: 1, arrow: 1 })], [draw, gain({ tablet: 1, jewel: 1 })], [{ kind: 'fear', after: [gain({ tablet: 2, arrow: 2 })] }], [gain({ compass: 2, jewel: 1 })]].map((effects, i) => ({ id: 'site2-' + i, level: 2, name: ['태양의 성소', '새 왕의 무덤', '잃어버린 도시', '빛의 도서관', '금지된 제단', '하늘의 문'][i]!, art: 8 + i % 4, effects: registerArnakEffects('site2-' + i, effects as ArnakEffect[]) }))
];
export function arnakSite(id: string) { const d = ARNAK_SITES.find(s => s.id === id); if (!d)
    throw new Error('Unknown Arnak site'); return d; }
const assistantRows: readonly (readonly [
    ArnakEffect[],
    ArnakEffect[]
])[] = [
    [[gain({ coin: 2 })], [gain({ coin: 3 })]], [[gain({ tablet: 1 })], [gain({ coin: 1, tablet: 1 })]],
    [[{ kind: 'payTravel', travel: ['foot'], after: [gain({ arrow: 1 })] }], [gain({ arrow: 1 })]],
    [[{ kind: 'trade', cost: { coin: 1 }, after: [gain({ arrow: 1 })] }], [{ kind: 'trade', cost: { coin: 1 }, after: [choice([gain({ arrow: 1 })], [gain({ jewel: 1 })])] }]],
    [[exile], [gain({ compass: 1 }), exile]], [[draw, { kind: 'discard' }], [draw]],
    [[choice([gain({ coin: 1 })], [travel('plane')])], [choice([gain({ coin: 2 })], [travel('plane', 'plane')])]],
    [[choice([gain({ compass: 1 })], [travel('car')])], [choice([gain({ coin: 1, compass: 1 })], [travel('car', 'car')])]],
    [[choice([gain({ compass: 1 })], [travel('boat')])], [choice([gain({ coin: 1, compass: 1 })], [travel('boat', 'boat')])]],
    [[{ kind: 'buy', mode: 'either', amount: 1 }], [{ kind: 'buy', mode: 'either', amount: 2 }]],
    [[up], [up, gain({ compass: 1 })]], [[gain({ compass: 1 })], [gain({ compass: 2 })]]
];
export const ARNAK_ASSISTANTS = assistantRows.map(([silver, gold], i) => ({ id: 'assistant-' + i, name: ['금광 탐사자', '문자 연구가', '정찰병', '보석 상인', '고문서 학자', '길잡이', '항공 조종사', '운전사', '항해사', '유물 거래상', '세공사', '탐험대원'][i]!, free: i !== 9, silver: registerArnakEffects('assistant-' + i + '/silver', silver), gold: registerArnakEffects('assistant-' + i + '/gold', gold) }));
export function arnakAssistant(id: string) { const d = ARNAK_ASSISTANTS.find(a => a.id === id); if (!d)
    throw new Error('Unknown assistant'); return d; }
const guardianRows: readonly (readonly [
    string,
    Partial<ArnakResources>,
    ArnakTravel[],
    boolean,
    ArnakEffect
])[] = [
    ['가시 멧돼지', { arrow: 1 }, ['boat'], false, travel('car')], ['그림자 늑대', { coin: 1, arrow: 1 }, ['foot'], false, travel('car')], ['붉은 박쥐', { arrow: 1 }, ['plane'], false, exile], ['검은 표범', { coin: 4 }, [], false, up], ['바다 뱀', { compass: 1, coin: 1, arrow: 1 }, [], false, travel('boat')],
    ['황금 전갈', { compass: 1, arrow: 1 }, [], true, draw], ['석상 올빼미', { tablet: 3 }, [], false, travel('plane')], ['붉은 불사조', { jewel: 1 }, ['foot'], false, travel('plane')], ['붉은 호랑이', { compass: 2, arrow: 1 }, [], false, travel('boat')], ['불 개미', { compass: 1 }, ['foot', 'foot'], false, exile], ['깃털 사냥꾼', { arrow: 1 }, ['plane'], false, exile], ['동굴 거미', { coin: 1, arrow: 1 }, [], true, exile], ['갑옷 딱정벌레', { coin: 2, arrow: 1 }, [], false, travel('car')], ['뿔 도마뱀', { tablet: 1, arrow: 1 }, ['foot'], false, exile], ['거대 두꺼비', { arrow: 1 }, ['car'], false, travel('boat')]
];
export const ARNAK_GUARDIANS = guardianRows.map(([name, cost, travel, discard, boon], i) => ({ id: 'guardian-' + i, name, cost: arnakResources(cost), travel, discard, boon: registerArnakEffects('guardian-' + i, [boon]), art: 12 + i % 3 }));
export function arnakGuardian(id: string) { const d = ARNAK_GUARDIANS.find(g => g.id === id); if (!d)
    throw new Error('Unknown guardian'); return d; }
export const ARNAK_IDOLS = [...Array<string>(3).fill('coin'), ...Array<string>(3).fill('compass'), ...Array<string>(3).fill('tablet'), ...Array<string>(3).fill('exile'), ...Array<string>(2).fill('upgrade'), ...Array<string>(2).fill('refresh')];
export const ARNAK_IDOL_REWARDS = Object.fromEntries([['coin', gain({ coin: 1 })], ['compass', gain({ compass: 1 })], ['tablet', gain({ tablet: 1 })], ['exile', exile], ['upgrade', up], ['refresh', refresh]].map(([k, e]) => [k, registerArnakEffects('idol-reward-' + k, [e as ArnakEffect])]));
export const ARNAK_RESEARCH = ([
    ['0', 0, [], {}], ['1L', 1, ['0'], { compass: 1, arrow: 1 }], ['1R', 1, ['0'], { jewel: 1 }], ['2L', 2, ['1L'], { jewel: 1 }], ['2R', 2, ['1L', '1R'], { tablet: 1, arrow: 1 }], ['3', 3, ['2L', '2R'], { tablet: 2, arrow: 1 }], ['4L', 4, ['3'], { coin: 1, tablet: 1, arrow: 1 }], ['4M', 4, ['3'], { tablet: 1, jewel: 1 }], ['4R', 4, ['3'], { arrow: 2 }], ['5', 5, ['4L', '4M', '4R'], { coin: 1, jewel: 1 }], ['6L', 6, ['5'], { compass: 1, jewel: 1 }], ['6R', 6, ['5'], { tablet: 2, arrow: 1 }], ['7L', 7, ['6L', '6R'], { coin: 1, tablet: 1, arrow: 1 }], ['7R', 7, ['6R'], { tablet: 1, jewel: 1 }], ['8', 8, ['7L', '7R'], { coin: 1, compass: 1, jewel: 1 }]
] satisfies [
    string,
    number,
    string[],
    Partial<ArnakResources>
][]).map(([id, row, from, cost]) => ({ id, row, from, cost: arnakResources(cost) }));
export function arnakResearch(id: string) { const d = ARNAK_RESEARCH.find(n => n.id === id); if (!d)
    throw new Error('Unknown research'); return d; }
export const ARNAK_RESEARCH_REWARDS = { magnifier: [[gain({ coin: 1 })], [gain({ compass: 1 })], [gain({ compass: 1 })], [gain({ compass: 1 })], [gain({ compass: 1 })], [draw], [gain({ compass: 1 })]], notebook: [[{ kind: 'assistant', mode: 'take' }], [{ kind: 'assistant', mode: 'take' }], [{ kind: 'upgrade' }], [{ kind: 'upgrade' }], [gain({ compass: 2 })], [{ kind: 'buy', mode: 'artifact', amount: 99 }], [{ kind: 'overcome', mode: 'own' }]] } satisfies Record<string, ArnakEffect[][]>;
export const ARNAK_RESEARCH_EFFECTS = Object.fromEntries(Object.entries(ARNAK_RESEARCH_REWARDS).map(([k, rows]) => [k, rows.map((effects, i) => registerArnakEffects('research-' + k + '-' + i, effects))]));
export const ARNAK_TEMPLE_COSTS = [{ coin: 1, tablet: 2 }, { jewel: 1 }, { compass: 1, arrow: 1 }, { coin: 1, tablet: 2, jewel: 1 }, { jewel: 1, compass: 1, arrow: 1 }, { coin: 1, tablet: 2, jewel: 1, compass: 1, arrow: 1 }].map(arnakResources);
