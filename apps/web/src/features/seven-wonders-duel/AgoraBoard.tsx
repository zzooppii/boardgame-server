import { DUEL_DECREES, type DuelProjection } from '@hangul-rummikub/shared';
import { useCardTooltip } from './CardTooltip.js';

type Chamber = DuelProjection['decrees'][number];
export type AgoraProps = {
    chambers: readonly Chamber[];
    self: string;
    mine: readonly number[];
    theirs: readonly number[];
};
const points = [1, 2, 3, 3, 2, 1];
const control = (ch: Chamber, self: string) => ch.controller === self ? '나 지배' : ch.controller ? '상대 지배' : '미지배';
const laws = (ch: Chamber) => ch.ids.map(id => id === null ? '아직 공개되지 않은 법령' : DUEL_DECREES[id - 1] ?? '법령 정보 없음');

export function AgoraDetails({ chamber, self, mine, theirs }: Omit<AgoraProps, 'chambers'> & { chamber: Chamber }) {
    return <div className="du-agora-details"><h2>{chamber.chamber + 1} 의회 · {control(chamber, self)}</h2>
        <p>나의 영향력 {mine[chamber.chamber]}개 · 상대의 영향력 {theirs[chamber.chamber]}개</p>
        <p>게임 종료 시 지배한 플레이어에게 승점 {points[chamber.chamber]}점</p>
        <h3>법령 효과</h3><ul>{laws(chamber).map((law, i) => <li key={i}>{law}</li>)}</ul>
        {!chamber.ids.length && <p>법령 없음</p>}
        <p className="du-agora-note">6개 의회를 모두 지배하면 정치 승리입니다.</p>
    </div>;
}
function ChamberCard({ chamber, onInspect, ...props }: Omit<AgoraProps, 'chambers'> & { chamber: Chamber; onInspect(chamber: number): void }) {
    const preview = useCardTooltip(`chamber-${chamber.chamber}`, <AgoraDetails {...props} chamber={chamber} />);
    return <><button {...preview.trigger} type="button" className={`du-agora-chamber ${chamber.controller === props.self ? 'mine' : chamber.controller ? 'theirs' : ''}`}
        aria-label={`${chamber.chamber + 1} 의회 · ${control(chamber, props.self)} · 법령 상세 보기`} aria-haspopup="dialog"
        onClick={() => { preview.hide(); onInspect(chamber.chamber); }}>
        <span className="du-agora-chamber-heading"><strong>{chamber.chamber + 1} 의회</strong><b>{points[chamber.chamber]}점</b></span>
        <span className="du-agora-influence"><span>나 <i aria-hidden="true">◆</i> {props.mine[chamber.chamber]}</span><span>상대 <i aria-hidden="true">◆</i> {props.theirs[chamber.chamber]}</span></span>
        <strong className="du-agora-control">{control(chamber, props.self)}</strong>
        <span className="du-agora-law">{laws(chamber).join(' · ') || '법령 없음'}</span>
        <small>ⓘ 법령·효과 보기</small>
    </button>{preview.tooltip}</>;
}
export function AgoraBoard({ onInspect, ...props }: AgoraProps & { onInspect(chamber: number): void }) {
    return <section className="du-agora" aria-label="AGORA 원로원"><div className="du-agora-title"><strong>AGORA</strong><span>원로원 · 6개 지배로 승리</span>
        <small>나 {props.chambers.filter(ch => ch.controller === props.self).length}/6 · 상대 {props.chambers.filter(ch => ch.controller !== null && ch.controller !== props.self).length}/6 지배</small></div>
        <div className="du-agora-chambers">{props.chambers.map(ch => <ChamberCard key={ch.chamber} {...props} chamber={ch} onInspect={onInspect} />)}</div>
    </section>;
}
