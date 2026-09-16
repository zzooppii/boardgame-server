import type { CSSProperties } from 'react';
import { DUEL_RESOURCES, type DuelCardDefinition, type DuelProjection } from '@hangul-rummikub/shared';
import { definition } from './art.js';
import { BuildingPreview } from './BuildingDetails.js';
import { buildingBenefits, cityBuildingGroups, resourceNames, scienceNames } from './building-info.js';
import { useCardTooltip } from './CardTooltip.js';

export function BuildingRibbon({ card, onInspect }: { card: DuelCardDefinition; onInspect(): void }) {
    const preview = useCardTooltip(card.id, <BuildingPreview card={card} owned />, 'du-building-tooltip');
    const benefits = buildingBenefits(card);
    return <><button type="button" {...preview.trigger} className={`du-building-ribbon du-${card.color}`} aria-label={`${card.name} · 보유 효과 보기`} aria-haspopup="dialog" onClick={() => { preview.hide(); onInspect(); }}>
        <span className="du-ribbon-benefits">{benefits.badges.map(text => <strong key={text}>{text}</strong>)}</span>
        <span className="du-ribbon-name">{card.name}{benefits.chain.length > 0 && <b aria-label="무료 연계 제공"> ⛓</b>}</span>
    </button>{preview.tooltip}</>;
}

function EffectToken({ id, source, label, className = '', onInspect }: { id: string | null; source: string; label: string; className?: string; onInspect(id: string | null, source: string): void }) {
    const d = id ? definition(id) : undefined;
    const tooltip = useCardTooltip(d && 'text' in d ? id : null, <div className="du-token-preview"><h2>{d?.name}</h2><p>{d && 'text' in d ? d.text : ''}</p><small>눌러서 상세 보기</small></div>);
    return <><button type="button" {...tooltip.trigger} className={className} onClick={() => { tooltip.hide(); onInspect(id, source); }}>{label}</button>{tooltip.tooltip}</>;
}

export function CityPanel({ player: p, name, own, settings, onInspect }: {
    player: DuelProjection['playerStates'][number]; name: string; own: boolean; settings: DuelProjection['settings'];
    onInspect(id: string | null, source: string): void;
}) {
    const { fixed, groups } = cityBuildingGroups(p.buildings, settings.pantheon, settings.agora);
    const symbols = [...new Set(p.science)];
    return <section className={`du-city du-city-tableau ${own ? 'own' : ''}`} aria-label={`${own ? '나' : '상대'}의 도시 · ${name}`}>
        <div className="du-player-row"><b className="du-avatar">{own ? '나' : '상대'}</b><strong>{name}</strong><span className="du-money" title="현재 보유 코인">● {p.coins}</span>{p.protectedCoins > 0 && <span>보호 ● {p.protectedCoins}</span>}<span title="서로 다른 과학 기호 6개로 승리">✧ {symbols.length}/6</span><span>{p.buildings.length} 건물</span></div>
        {p.buildings.length > 0 ? <>
            <div className="du-city-production"><strong>건물 고정 생산</strong>{DUEL_RESOURCES.map(r => <span key={r} className={`du-production-total ${r} ${fixed[r] ? '' : 'empty'}`}>{resourceNames[r]} <b>{fixed[r] ?? 0}</b></span>)}<small>선택 생산은 각 카드에서 확인</small></div>
            {symbols.length > 0 && <div className="du-science-symbols"><strong>과학 기호</strong>{symbols.map(symbol => <span key={symbol}>{scienceNames[symbol] ?? symbol} <b>×{p.science.filter(s => s === symbol).length}</b></span>)}<small>신·진보 포함</small></div>}
            <div className="du-city-tableau-heading"><strong>보유 건물의 혜택</strong><span>마우스를 올리거나 눌러 자세히 보기</span></div>
            <div className="du-city-scroll" tabIndex={0} role="region" aria-label={`${name}의 색상별 건물`}><div className="du-city-columns" style={{ '--du-city-groups': groups.length } as CSSProperties}>
                {groups.map(group => <div key={group.id} className={`du-city-column du-${group.id}`}><h3>{group.name}<small>{group.cards.length}</small></h3>
                    {group.cards.map(c => <BuildingRibbon key={c.tileId} card={c.card} onInspect={() => onInspect(c.card.id, c.tileId)} />)}
                    {!group.cards.length && <span className="du-column-empty">—</span>}
                </div>)}
            </div></div>
            <p className="du-city-scope">건물의 기본 효과입니다. 불가사의·신·진보·법령의 추가 효과는 별도로 적용됩니다.</p>
        </> : <p className="du-empty">아직 건설한 건물이 없습니다</p>}
        <div className="du-inventory">
            {p.progress.map(id => <EffectToken key={id} id={id} source={id} label={`❧ ${definition(id)?.name}`} className="du-progress" onInspect={onInspect} />)}
            {p.gods.map(id => <EffectToken key={id} id={id} source={id} label={`✦ ${definition(id)?.name}`} onInspect={onInspect} />)}
            {p.mythology.map((id, i) => <span key={i}>신화 {({ GREEK: '그리스', ROMAN: '로마', EGYPTIAN: '이집트', PHOENICIAN: '페니키아', MESOPOTAMIAN: '메소포타미아' } as Record<string, string>)[id] ?? id}</span>)}
            {p.offerings.map((n, i) => <span key={i}>공물 {n}</span>)}
            {p.conspiracies.map(c => <EffectToken key={c.id} id={c.definitionId} source={c.id} label={`${c.triggered ? '✓' : c.prepared ? '◆' : '◇'} ${c.definitionId ? definition(c.definitionId)?.name : '비공개 음모'}`} className="du-conspiracy" onInspect={onInspect} />)}
        </div>
    </section>;
}
