import { DUEL_CARDS, type DuelCardDefinition } from '@hangul-rummikub/shared';
import { Atlas } from './art.js';
import { WonderCost } from './WonderCard.js';
import { buildingBenefits, buildingColorNames } from './building-info.js';

export function BuildingDetails({ card: d, owned = false, quotedCost }: { card: DuelCardDefinition; owned?: boolean; quotedCost?: number | null | undefined }) {
    const benefits = buildingBenefits(d), precursor = DUEL_CARDS.find(c => c.chainOut && c.chainOut === d.chainIn);
    return <div className="du-building-details">
        {owned ? <p className="du-building-owned-note">보유 건물 · 아래는 이 카드의 효과입니다.</p> : <section><h3>건설 비용</h3>
            {d.color === 'WHITE' || d.color === 'BLACK' ? <p>이미 고용한 의원 수에 따라 코인을 지불합니다. 부패 등 추가 효과가 적용될 수 있습니다.</p>
                : <><WonderCost cost={d.cost} />{d.coins > 0 && <p>코인 {d.coins}개</p>}{!d.coins && Object.keys(d.cost).length === 0 && <p>비용 없음</p>}</>}
            {typeof quotedCost === 'number' && <p className="du-building-price">지금 건설 비용 <strong>{quotedCost}코인</strong></p>}
            {precursor && <p>무료 연계: {precursor.name} 보유</p>}{d.color === 'TEMPLE' && <p>해당 신화 토큰 보유 시 무료 건설</p>}
        </section>}
        {([{ title: '생산·할인·과학', effects: benefits.ongoing }, { title: '건설·고용 시 효과', effects: benefits.onBuild }, { title: '게임 종료 점수', effects: benefits.scoring }]).filter(section => section.effects.length).map(section => <section key={section.title}><h3>{section.title}</h3><ul>{section.effects.map(e => <li key={e.short}>{e.text}</li>)}</ul></section>)}
        {benefits.onBuild.some(e => e.text.includes('코인')) && <p className="du-building-note">코인 보상은 건설할 때 한 번 적용됩니다. 매 턴 받는 수입이 아닙니다.</p>}
        {benefits.chain.length > 0 && <section><h3>무료로 이어지는 건물</h3><p>이 건물을 보유하면 {benefits.chain.join(' · ')}을(를) 무료로 건설할 수 있습니다.</p></section>}
    </div>;
}

export function BuildingPreview(props: Parameters<typeof BuildingDetails>[0]) {
    const d = props.card;
    return <><div className="du-building-preview"><div><span className="du-building-kind">{d.age ? `시대 ${['I', 'II', 'III'][d.age - 1]} · ` : ''}{buildingColorNames[d.color]}</span><h2>{d.name}</h2><BuildingDetails {...props} /></div><div className={`du-building-preview-art du-${d.color}`}><Atlas index={d.art} buildings /><strong>{d.name}</strong></div></div><p className="du-wonder-tooltip-hint">눌러서 상세 보기 · Esc로 닫기</p></>;
}
