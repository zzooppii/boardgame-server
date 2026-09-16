import { DUEL_CARDS, DUEL_RESOURCES, type DuelCardDefinition, type DuelColor, type DuelCost, type DuelProjection } from '@hangul-rummikub/shared';

export const resourceNames = { wood: '나무', clay: '점토', stone: '돌', glass: '유리', papyrus: '파피루스' };
export const scienceNames: Record<string, string> = { QUILL: '깃펜', MORTAR: '절구', TRIANGLE: '삼각자', WHEEL: '바퀴', SUNDIAL: '해시계', ORBIT: '천구', LAW: '법률' };
const countNames: Record<string, string> = { WONDER: '건설한 불가사의', GREY: '회색 건물', BROWN: '갈색 건물', GREEN: '초록 건물', BLUE: '파란 건물', YELLOW: '노란 건물', RED: '빨간 건물', RESOURCES: '갈색·회색 건물', COINS: '일반 코인 3개 묶음' };
export const buildingColorNames: Record<DuelColor, string> = { BROWN: '원자재', GREY: '제품', YELLOW: '상업', RED: '군사', BLUE: '시민', GREEN: '과학', PURPLE: '조합', TEMPLE: '대신전', WHITE: '정치가', BLACK: '음모가' };
type Benefit = { short: string; text: string };
export function buildingBenefits(d: DuelCardDefinition) {
    const ongoing: Benefit[] = [], onBuild: Benefit[] = [], scoring: Benefit[] = [];
    for (const r of DUEL_RESOURCES) if (d.production?.[r]) ongoing.push({ short: `${resourceNames[r]} ${d.production[r]}`, text: `${resourceNames[r]} ${d.production[r]}개를 생산합니다. 건설에 이용해도 생산 능력은 소모되지 않습니다.` });
    if (d.flex) ongoing.push({ short: `${d.flex.map(r => resourceNames[r]).join('/')} 중 1개`, text: `건설할 때마다 ${d.flex.map(r => resourceNames[r]).join('·')} 중 필요한 자원 1개를 선택해 생산합니다. 모두를 동시에 생산하는 것은 아닙니다.` });
    if (d.trade) ongoing.push({ short: `${d.trade.map(r => resourceNames[r]).join('/')} 구매 1코인`, text: `${d.trade.map(r => resourceNames[r]).join('·')}의 부족분을 개당 1코인으로 은행에서 구매할 수 있습니다. 자원을 생산하는 효과는 아닙니다.` });
    if (d.science) ongoing.push({ short: `${scienceNames[d.science]} 기호`, text: `${scienceNames[d.science]} 과학 기호를 제공합니다. 같은 기호 한 쌍을 완성하면 진보 토큰을 선택하며, 서로 다른 기호 6개로 과학 승리합니다.` });
    if (d.shields) onBuild.push({ short: `방패 ${d.shields}`, text: `방패 ${d.shields}개를 제공합니다. 건설 시 군사 규칙에 따라 충돌 말을 상대 수도 쪽으로 이동합니다. 현재 우세는 군사력 트랙에서 확인하세요.` });
    if (d.income) onBuild.push({ short: `건설 시 +${d.income}코인`, text: `건설할 때 은행에서 코인 ${d.income}개를 한 번 받습니다.` });
    if (d.incomePer) onBuild.push({ short: `건설 시 ${countNames[d.incomePer]}당 +${d.incomeMultiplier ?? 1}`, text: `건설 당시 내 도시의 ${countNames[d.incomePer]} 1개당 코인 ${d.incomeMultiplier ?? 1}개를 한 번 받습니다.` });
    if (d.guild && d.guild !== 'WONDER' && d.guild !== 'COINS') onBuild.push({ short: '건설 시 비교 보상', text: `건설 당시 ${countNames[d.guild]}가 더 많은 도시를 기준으로, 해당 건물 1개당 코인 1개를 한 번 받습니다.` });
    if (d.color === 'WHITE') onBuild.push({ short: '원로원 행동', text: '고용 시 파란 건물 수에 따라 원로원 행동을 1~3회 합니다. 법령 보정과 행동 가능 지역은 선택 안내에 표시됩니다.' });
    if (d.color === 'BLACK') onBuild.push({ short: '영향력 또는 음모', text: '고용 시 영향력 큐브 1개를 배치하거나 음모를 획득합니다.' });
    if (d.points) scoring.push({ short: `승점 ${d.points}`, text: `게임 종료 시 승점 ${d.points}점을 제공합니다.` });
    if (d.guild) scoring.push({ short: `${countNames[d.guild]} 비교 점수`, text: `게임 종료 시 ${countNames[d.guild]}가 더 많은 도시를 기준으로, 1개당 ${d.guild === 'WONDER' ? 2 : 1}점을 받습니다.` });
    if (d.color === 'TEMPLE') scoring.push({ short: '대신전 점수', text: '내 대신전이 총 1/2/3장이면 합계 5/12/21점을 받습니다.' });
    const chain = d.chainOut ? DUEL_CARDS.filter(c => c.chainIn === d.chainOut).map(c => c.name) : [];
    return { ongoing, onBuild, scoring, chain, badges: [...ongoing, ...onBuild, ...scoring].map(e => e.short) };
}

export function cityBuildingGroups(buildings: DuelProjection['playerStates'][number]['buildings'], pantheon: boolean, agora: boolean) {
    const visible = buildings.flatMap(c => { const d = DUEL_CARDS.find(d => d.id === c.definitionId); return d ? [{ tileId: c.tileId, card: d }] : []; });
    const fixed: DuelCost = {};
    for (const { card } of visible) for (const r of DUEL_RESOURCES) fixed[r] = (fixed[r] ?? 0) + (card.production?.[r] ?? 0);
    const colors: DuelColor[][] = [['BROWN'], ['GREY'], ['YELLOW'], ['RED'], ['BLUE'], ['GREEN'], [pantheon ? 'TEMPLE' : 'PURPLE'], ...(agora ? [['WHITE', 'BLACK'] as DuelColor[]] : [])];
    return { fixed, groups: colors.map(types => ({ id: types[0]!, name: types.length > 1 ? '의원' : buildingColorNames[types[0]!], cards: visible.filter(c => types.includes(c.card.color)) })) };
}
