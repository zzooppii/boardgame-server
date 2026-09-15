import { arnakEffect, arnakCostText, ARNAK_TRAVEL_NAMES, type ArnakEffect } from '@hangul-rummikub/shared';

const specialDescriptions: Record<string, string> = { brush: '우상마다 나침반 1 (최대 3)', bow: '내 장소와 보유 수호자마다 나침반 1 (최대 3)', theodolite: '배치한 탐험가마다 나침반 1', knife: '금화·나침반·석판·카드 제거 중 서로 다른 두 가지', crystal: '덱 위 최대 3장 확인, 1장 보관·1장 반환 가능', obsidian: '덱 아래 최대 2장 확인, 1장 보관', hammer: '오른쪽 아이템 제거 후 제거된 아이템 1장 획득', crown: '수호자를 빈 장소로 이동하고 그 장소 활성화', 'two-base': '서로 다른 기초 장소 두 곳 활성화', ocarina: '탐험가 회수 가능 · 이번 라운드 카드 이동을 비행기로', 'stone-key': '마지막 슬롯의 우상 회수', 'war-mask': '이번 라운드 수호자로 인한 공포 방지', 'research-discount': '석판·화살촉·보석 중 하나 할인하여 연구 또는 사원 타일 획득' };
const travelText = (effect: ArnakEffect) => (effect.travel ?? []).map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ');
const siteLevel = (level = 2) => level === 0 ? '기초 장소' : level >= 2 ? '기초·1·2단계 장소' : '기초·1단계 장소';

/** Display the catalog's effects, including nested costs and alternatives. No game decisions live here. */
export function describeArnakEffect(id: string): string { return describeEffect(arnakEffect(id)); }
function describeEffect(e: ArnakEffect): string {
    const text = describeBase(e);
    return e.after?.length ? `${text} → ${e.after.map(describeEffect).join(' · ')}` : text;
}
function describeBase(e: ArnakEffect): string {
    switch (e.kind) {
        case 'gain': return arnakCostText(e.value ?? {});
        case 'draw': return `${e.mode === 'bottom' ? '덱 아래에서 ' : ''}카드 ${e.amount ?? 1}장 뽑기`;
        case 'discard': return '손패 1장 버리기';
        case 'fear': return '공포 1장 받기';
        case 'exile': return '손패 또는 사용한 카드 1장 제거';
        case 'trade': return arnakCostText(e.cost ?? {}) + ' 지불';
        case 'payTravel': return travelText(e) + ' 이동 비용 지불';
        case 'travel': return travelText(e) + ' 이동 획득 · 이번 차례에 사용';
        case 'choice': return '하나 선택: ' + (e.choices ?? []).map(c => '(' + c.map(describeEffect).join(' · ') + ')').join(' 또는 ');
        case 'refresh': return '사용한 조수 1명 다시 준비';
        case 'upgrade': return '은색 조수 1명 금색으로 승급하고 다시 준비';
        case 'resourceUpgrade': return '석판 1 → 화살촉 1 또는 화살촉 1 → 보석 1';
        case 'assistant': return e.mode === 'take' ? '공급 더미 맨 위 조수 1명 고용' : e.mode === 'exchange' ? '내 조수 1명을 공급 더미 맨 위 조수와 교환하고 다시 준비' : `공급 더미 맨 위 조수 1명의 ${e.mode === 'gold-copy' ? '금색' : '은색'} 능력 복사`;
        case 'buy': {
            const type = e.mode?.startsWith('item') ? '아이템' : e.mode?.startsWith('artifact') ? '유물' : '아이템 또는 유물';
            const discount = (e.amount ?? 0) >= 99 ? '비용 없이' : (e.amount ?? 0) > 0 ? `비용 ${e.amount} 할인하여` : '비용을 지불하여';
            const destination = e.mode === 'item-hand' ? '손패에 추가' : e.mode === 'item-top' ? '덱 위에 놓기' : type === '아이템' ? '덱 아래에 놓기' : type === '유물' ? '즉시 효과 사용' : '아이템은 덱 아래 · 유물은 즉시 효과 사용';
            return `${e.mode?.endsWith('-peek') ? '해당 덱 맨 위도 공개해 선택 가능 · ' : ''}${type} 1장 ${discount} 획득 · ${destination}`;
        }
        case 'research': return `${e.mode === 'notebook' ? '수첩만 한 칸 연구 (돋보기보다 높이 이동 불가)' : '한 칸 연구 또는 도착한 사원에서 타일 획득'}${(e.amount ?? 0) >= 99 ? ' · 비용 없음' : e.value ? ' · ' + arnakCostText(e.value) + ' 할인' : ''}`;
        case 'activate': return e.mode === 'stack' ? `미발견 ${e.level ?? 1}단계 장소 더미 맨 위 효과 사용` : `${e.mode === 'own' ? '내 탐험가가 있는 ' : e.mode === 'unoccupied' ? '아무 탐험가도 없는 ' : '발견된 '}${siteLevel(e.level)} 한 곳의 효과 사용`;
        case 'deploy': return `${e.mode === 'twice' ? '탐험가를 서로 다른 두 기초 장소에 배치' : '탐험가 1명 배치하여 발굴 또는 발견'}${e.travel?.length ? ' · 이동 ' + travelText(e) + ' 할인' : ''}${(e.amount ?? 0) > 0 && e.level !== 0 ? ' · 발견 나침반 ' + e.amount + ' 할인' : ''}`;
        case 'relocate': return `내 탐험가를 다른 ${siteLevel(e.level ?? 1)}의 빈칸으로 이동하고 장소 효과 사용 · 이동 비용 없음`;
        case 'overcome': return `${e.mode === 'no-opponent' ? '다른 플레이어의 탐험가가 없는 장소' : '내 탐험가가 있는 장소'}의 수호자 극복 · 극복 비용 없음`;
        case 'special': return specialDescriptions[e.mode ?? ''] ?? '추가 효과 선택';
        case 'peekKeep': return '확인한 카드 1장을 손패에 추가';
        case 'peekReturn': return '확인한 카드 1장을 덱 위로 반환';
    }
}
