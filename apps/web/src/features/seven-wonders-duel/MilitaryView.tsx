import type { DuelProjection } from '@hangul-rummikub/shared';

type MilitaryState = Pick<DuelProjection, 'military' | 'militaryTokens' | 'minerva' | 'settings'>;
type Props = { game: MilitaryState; seat: 0 | 1; myName: string; opponentName: string };

export function militarySummary(position: number, seat: 0 | 1): string {
    const relative = position * (seat === 0 ? 1 : -1);
    return relative === 0 ? '중앙 · 군사력 균형' : `${relative > 0 ? '나' : '상대'} 우세 ${Math.abs(relative)}칸`;
}

export function MilitaryView({ game: g, seat, myName, opponentName }: Props) {
    return <div className="du-military-detail">
        <header><span className="du-eyebrow">MILITARY CONFLICT</span><h2>군사력과 충돌 트랙</h2><p className="du-military-current">⚔ {militarySummary(g.military, seat)}</p></header>
        <p>방패 1개마다 충돌 말을 상대 수도 쪽으로 1칸 이동합니다. 중앙에서 몇 칸 떨어졌는지 아래 숫자로 확인하세요.</p>
        <div className="du-military-expanded">
            <div className="du-military-capital">상대 수도 · {opponentName}<strong>도달하면 나의 군사 승리</strong></div>
            <div className="du-military-rows" aria-label="확대 군사 트랙">
                {Array.from({ length: 19 }, (_, i) => 9 - i).map(relative => {
                    const position = relative * (seat === 0 ? 1 : -1), distance = Math.abs(relative);
                    const current = position === g.military, token = distance === 3 || distance === 6;
                    const remaining = g.militaryTokens.includes(position), target = relative > 0 ? '상대' : '나', beneficiary = relative > 0 ? '나' : '상대';
                    const effect = g.settings.agora ? distance === 3 ? `${beneficiary}: 영향력 1개 배치` : `${beneficiary}: 자신의 영향력 이동 후 ${relative > 0 ? '상대' : '내'} 큐브 제거` : `${target}: ${distance === 3 ? 2 : 5}코인 상실`;
                    return <div key={relative} className={`du-military-step zone-${distance >= 6 ? 3 : distance >= 3 ? 2 : distance ? 1 : 0} ${current ? 'current' : ''}`} aria-current={current ? 'location' : undefined}>
                        <span className="du-military-distance">{relative === 0 ? '중앙' : `${relative > 0 ? '상대' : '내'} 쪽 ${distance}칸`}</span>
                        <span className="du-military-space">{current ? <b aria-label="현재 충돌 말">⚔</b> : distance === 9 ? '♜' : '·'}{g.minerva === position && <em title="미네르바">미네르바</em>}</span>
                        <span className={`du-military-effect ${token && !remaining ? 'spent' : ''}`}>
                            {distance === 9 ? `${beneficiary} 즉시 승리` : token ? <><strong>{effect}</strong><small>{remaining ? '토큰 있음 · 진입 시 발동' : '토큰 없음 · 다시 발동하지 않음'}</small></> : current ? '현재 위치' : ''}
                            {[1, 4, 7].includes(distance) && <span className="du-military-zone-score">종료 시 {beneficiary} {distance === 7 ? 10 : distance === 4 ? 5 : 2}점</span>}
                        </span>
                    </div>;
                })}
            </div>
            <div className="du-military-capital own">내 수도 · {myName}<strong>도달하면 상대의 군사 승리</strong></div>
        </div>
        <section className="du-military-rules"><h3>{g.settings.agora ? 'Agora 군사 토큰' : '언제 코인을 잃나요?'}</h3>
            {g.settings.agora ? <p>이 게임에서는 코인 손실 토큰을 사용하지 않습니다. 3칸 토큰은 공격하는 플레이어의 영향력 1개 배치, 6칸 토큰은 자신의 영향력 1개 이동 후 상대 영향력 1개 제거입니다. 각 행동의 대상은 서버가 안내합니다.</p>
                : <p>중앙에서 한쪽으로 3칸: 그쪽 수도의 플레이어가 2코인을 잃습니다. 6칸: 5코인을 추가로 잃습니다. 코인은 은행으로 돌려놓으며, 일반 코인이 부족하면 남은 만큼만 잃습니다. 보호 코인은 잃지 않습니다.</p>}
            <p>각 토큰은 한 번만 적용됩니다. 말이 되돌아갔다가 다시 지나도 사라진 토큰은 발동하지 않습니다. 신·진보·법령 등의 추가 효과는 별도로 적용됩니다.</p>
        </section>
        <section className="du-military-rules"><h3>게임 종료 시 군사 승점</h3><p>말이 상대 수도 쪽에 있을 때만 내 점수가 됩니다. 구간별 점수는 합산하지 않습니다.</p>
            <div className="du-military-score"><span>중앙<b>0점</b></span><span>1–2칸<b>2점</b></span><span>3–5칸<b>5점</b></span><span>6–8칸<b>10점</b></span><span>9칸<b>즉시 승리</b></span></div>
        </section>
        {g.minerva !== null && <p className="du-military-minerva">미네르바가 표시된 칸에 들어가기 직전에 이번 이동 전체가 멈추고 미네르바가 제거됩니다.</p>}
    </div>;
}
