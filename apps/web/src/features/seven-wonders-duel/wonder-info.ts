import { type DuelWonderDefinition } from '@hangul-rummikub/shared';

type WonderEffect = { short: string; text: string };
const specialEffects: Record<string, WonderEffect> = {
    DESTROY_GREY: { short: '상대 회색 건물 제거', text: '상대가 건설한 회색 건물 1장을 선택해 버립니다.' },
    DESTROY_BROWN: { short: '상대 갈색 건물 제거', text: '상대가 건설한 갈색 건물 1장을 선택해 버립니다.' },
    LIBRARY: { short: '진보 토큰 획득', text: '상자에 남은 진보 토큰 중 무작위로 공개한 최대 3개를 보고, 1개를 선택해 효과를 얻습니다.' },
    RESURRECT: { short: '버린 카드 무료 건설', text: '버린 카드 더미에서 1장을 선택해 비용 없이 건설합니다.' },
    THEATER: { short: '신 무료 활성화', text: '신화 덱 하나의 남은 신들을 보고, 1명을 선택해 비용 없이 활성화합니다. 나머지는 원하는 순서로 덱에 돌려놓습니다.' },
    UNPREPARED: { short: '미준비 음모 발동', text: '자신이 보유한 준비하지 않은 음모 1장을 준비 비용 없이 발동할 수 있습니다.' },
    KNOSSOS: { short: '영향력 배치·이동', text: '원로원에 자신의 영향력 큐브 1개를 배치한 뒤, 자신의 큐브 1개를 인접 의회로 이동할 수 있습니다.' },
};
const names = { wood: '나무', clay: '점토', stone: '돌', glass: '유리', papyrus: '파피루스' };

/** Printed benefits only; payment and legal effect targets remain server-authoritative. */
export function wonderEffects(w: DuelWonderDefinition): WonderEffect[] {
    const effects: WonderEffect[] = [];
    if (w.effect && specialEffects[w.effect]) effects.push(specialEffects[w.effect]!);
    if (w.flex) effects.push({ short: `${w.flex.map(r => names[r]).join('/')} 중 1개 생산`, text: `건설할 때마다 ${w.flex.map(r => names[r]).join('·')} 중 필요한 자원 1개를 선택해 생산합니다.` });
    if (w.id === 'wonder-sanctuary') effects.push({ short: '신 활성화 2코인 할인', text: '이후 판테온의 신을 활성화할 때 비용이 2코인 줄어듭니다.' });
    if (w.shields) effects.push({ short: `방패 ${w.shields}개`, text: `방패 ${w.shields}개를 제공합니다. 군사 규칙에 따라 충돌 말을 상대 수도 방향으로 이동합니다.` });
    if (w.coins) effects.push({ short: `코인 +${w.coins}`, text: `은행에서 코인 ${w.coins}개를 받습니다.` });
    if (w.loss) effects.push({ short: `상대 코인 −${w.loss}`, text: `상대가 코인 ${w.loss}개를 잃습니다. 일반 코인이 부족하면 남은 만큼만 잃으며 보호 코인은 잃지 않습니다.` });
    if (w.replay) effects.push({ short: '추가 턴', text: '효과 처리가 끝나면 한 턴을 더 진행합니다. 시대가 끝나면 추가 턴은 적용되지 않습니다.' });
    if (w.points) effects.push({ short: `승점 ${w.points}점`, text: `게임 종료 시 승점 ${w.points}점을 제공합니다.` });
    return effects;
}

export function wonderDraftEffect(w: DuelWonderDefinition): string | null {
    if (w.onSelect === 'CONSPIRE') return '이 불가사의를 선택하는 즉시 음모 획득 절차를 진행합니다. 건설 전에도 적용됩니다.';
    if (w.onSelect === 'PLACE') return '이 불가사의를 선택하는 즉시 원로원에 영향력 큐브 1개를 배치할 수 있습니다. 건설 전에도 적용됩니다.';
    return null;
}
