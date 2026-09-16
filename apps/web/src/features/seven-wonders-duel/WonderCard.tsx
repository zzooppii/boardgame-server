import { useCardTooltip } from './CardTooltip.js';
import { DUEL_RESOURCES, type DuelCost, type DuelWonderDefinition } from '@hangul-rummikub/shared';
import { Atlas, Cost, resourceNames } from './art.js';
import { wonderDraftEffect, wonderEffects } from './wonder-info.js';

export function WonderCost({ cost }: { cost: DuelCost }) {
    return <span className="du-wonder-cost">{DUEL_RESOURCES.filter(r => cost[r]).map(r =>
        <span key={r} className={`du-wonder-resource ${r}`}><i aria-hidden="true" />{resourceNames[r]} <b>×{cost[r]}</b></span>
    )}</span>;
}

export function WonderDetails({ wonder: w, draft = false }: { wonder: DuelWonderDefinition; draft?: boolean }) {
    const immediate = wonderDraftEffect(w);
    return <div className="du-wonder-details">
        <section><h3>건설에 필요한 자원</h3><WonderCost cost={w.cost} />
            {draft && <p className="du-wonder-note">지금은 불가사의를 고르는 단계입니다. 자원은 나중에 건설할 때 필요합니다.</p>}
        </section>
        {immediate && <section className="du-wonder-immediate"><h3>선택 즉시 효과</h3><p>{immediate}</p></section>}
        <section><h3>건설하면 얻는 효과</h3><ul>{wonderEffects(w).map(e => <li key={e.short}>{e.text}</li>)}</ul></section>
    </div>;
}

export function WonderCard({ wonder: w, draft = false, built = false, removed = false, onInspect }: {
    wonder: DuelWonderDefinition;
    draft?: boolean;
    built?: boolean;
    removed?: boolean;
    onInspect(): void;
}) {
    const preview = useCardTooltip(w.id, <><div className="du-wonder-tooltip-art"><Atlas index={w.art} /><strong>{w.name}</strong></div><WonderDetails wonder={w} draft={draft} /><p className="du-wonder-tooltip-hint">카드를 누르면 상세 창이 열립니다 · Esc로 닫기</p></>);
    const status = removed ? '제거됨' : built ? '건설 완료' : '미건설';
    return <>
        <button {...preview.trigger} type="button" className={`${draft ? 'du-draft-wonder' : 'du-wonder'} ${built ? 'built' : ''} ${removed ? 'removed' : ''}`}
            aria-label={`${w.name} · 비용과 효과 보기`} aria-haspopup="dialog"
            onClick={() => { preview.hide(); onInspect(); }}>
            <Atlas index={w.art} />
            {draft ? <span className="du-draft-info">
                <span className="du-wonder-title"><strong>{w.name}</strong><small>{w.expansion === 'PANTHEON' ? 'Pantheon' : w.expansion === 'AGORA' ? 'Agora' : '기본판'}</small></span>
                <span className="du-wonder-label">건설에 필요한 자원</span><WonderCost cost={w.cost} />
                <span className="du-wonder-label">건설 효과</span>
                <span className="du-wonder-benefits">{wonderEffects(w).map(e => <span key={e.short}>{e.short}</span>)}</span>
                {w.onSelect && <span className="du-draft-bonus">선택 즉시 · {w.onSelect === 'CONSPIRE' ? '음모 획득' : '영향력 1개 배치'}</span>}
                <span className="du-wonder-open">ⓘ 비용·효과 상세 보기</span>
            </span> : <><span className="du-wonder-caption"><strong>{w.name}</strong><small>{status} · ⓘ 효과 보기</small></span>{!built && !removed && <Cost cost={w.cost} />}</>}
        </button>
        {preview.tooltip}
    </>;
}
