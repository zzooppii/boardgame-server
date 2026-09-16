import type { ArnakProjection, ArnakTravel as Travel } from '@hangul-rummikub/shared';
import { ArnakTravel } from './ArnakTravel.js';

export function ArnakActionHints({ hints, target }: { hints: ArnakProjection['privateState']['blockedActions']; target: string | null }) {
    const shown = hints?.filter(h => h.targetId === target) ?? [];
    if (!shown.length) return null;
    return <section className="ar-action-reasons" aria-label="행동 불가 이유"><h3>지금 할 수 없는 행동</h3>{shown.map(h => <div key={h.label}><b>{h.label}</b><ul>{h.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>)}</section>;
}
export function ArnakTravelStock({ travel }: { travel: readonly Travel[] }) {
    return <section className="ar-travel-stock" aria-label="이번 차례 획득 이동"><b>획득한 이동 · 이번 차례까지</b>{travel.length ? <><ArnakTravel travel={travel}/><small>이동 비용 지불에 사용합니다. 차례가 끝나면 남은 이동은 사라집니다.</small></> : <small>보관 중인 이동 없음 · 손패의 이동 수단은 별도로 사용할 수 있습니다.</small>}</section>;
}
export function ArnakTravelExpiry({ travel }: { travel: readonly Travel[] }) {
    return travel.length ? <p className="ar-travel-expiry"><b>사용하지 않은 이동이 사라집니다.</b><ArnakTravel travel={travel}/>차례를 마치거나 패스하면 다음 차례로 가져갈 수 없습니다.</p> : null;
}
