import { useState } from 'react';
import { arnakCard, arnakCostText, ARNAK_ASSISTANTS, ARNAK_TRAVEL_NAMES, type ArnakCard, type ArnakOffer } from '@hangul-rummikub/shared';
import { groupArnakOffers, arnakOfferLabel, type ArnakOfferGroup, type ArnakIdolContext } from './offer-list.js';
import { ArnakTravel } from './ArnakTravel.js';
import { ArnakWorldArt } from './ArnakWorldArt.js';
import { describeArnakEffect } from './effect-description.js';

/** Public catalog reference only; the server offer still determines the selected action. */
function AssistantPreview({ offer }: { offer: ArnakOffer | undefined }) {
    const assistant = offer?.kind === 'EFFECT' ? ARNAK_ASSISTANTS.find(a => a.id === offer.targetId) : undefined;
    if (!assistant) return null;
    return <div className="ar-offer-assistant">
        <ArnakWorldArt definitionId={assistant.id}/>
        <div><small>{assistant.free ? '자유 행동' : '주 행동'}</small>
            <dl><div><dt>☆ 은색 능력</dt><dd className="ar-silver-effect">{assistant.silver.map(describeArnakEffect).join(' · ')}</dd></div>
                <div><dt>★ 금색 능력 · 승급 후</dt><dd className="ar-gold-effect">{assistant.gold.map(describeArnakEffect).join(' · ')}</dd></div></dl>
        </div>
    </div>;
}
export function ArnakOfferList({ offers, hand, selected, disabled, onSelect, idol }: {
    offers: readonly ArnakOffer[]; hand: readonly ArnakCard[]; selected: string | null; disabled: boolean; onSelect(id: string | null): void; idol?: ArnakIdolContext | undefined;
}) {
    const [preserved, setPreserved] = useState<ReadonlySet<string>>(new Set());
    const groups = groupArnakOffers(offers, preserved), count = groups.reduce((n, group) => n + group.offers.length, 0);
    const candidates = hand.filter(card => offers.some(offer => offer.cards.includes(card.tileId)));
    const label = (card: ArnakCard) => {
        const d = arnakCard(card.definitionId);
        return `${d.name} · ${d.travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')} · 손패 ${hand.indexOf(card) + 1}`;
    };
    function toggle(id: string) {
        const next = new Set(preserved);
        if (next.has(id)) next.delete(id); else next.add(id);
        setPreserved(next); onSelect(null);
    }
    function reset() { setPreserved(new Set()); onSelect(null); }
    const renderGroup = (group: ArnakOfferGroup) => <fieldset className="ar-offer-group" key={group.key} data-offer-kind={group.offers[0]?.kind}>
        <legend>{group.offers[0]?.free ? 'ϟ ' : ''}{group.offers[0] ? arnakOfferLabel(group.offers[0], idol) : group.label}{group.offers.length > 1 && <small> · 지불 방법 {group.offers.length}개</small>}</legend>
        <AssistantPreview offer={group.offers[0]}/>
        {group.offers.map((offer, i) => <button type="button" className={selected === offer.id ? 'selected' : ''} disabled={disabled} key={offer.id} aria-pressed={selected === offer.id} onClick={() => onSelect(offer.id)}>
            {offer.kind === 'END' ? <><strong>{arnakOfferLabel(offer, idol)}</strong><small>{idol ? '우상과 슬롯 점수를 보관합니다. 이번 차례를 마칩니다.' : '이번 차례를 마칩니다.'}</small></> : offer.kind === 'IDOL' ? <><strong>우상 1개 사용{Object.values(offer.cost).some(amount => amount > 0) ? ' + ' + arnakCostText(offer.cost) : ''}</strong><small>{idol ? `빈 슬롯 ${idol.slotPoints}점 포기 · 위 보상 하나 획득` : '빈 우상 슬롯에 놓고 위 보상 하나 획득'}</small></> : <>
                <strong>{group.offers.length > 1 ? `방법 ${i + 1} · ` : ''}{Object.values(offer.cost).some(amount => amount > 0) ? arnakCostText(offer.cost) : '자원 지불 없음'}</strong>
                <small>{offer.cards.length ? '지불 카드: ' + offer.cards.map(id => { const card = hand.find(c => c.tileId === id); return card ? label(card) : '카드'; }).join(', ') : offer.detail || '카드 지불 없음'}</small>
            </>}
            {(offer.travelUsed?.length ?? 0) > 0 && <span className="ar-travel-payment"><b>획득 이동 사용</b><ArnakTravel travel={offer.travelUsed ?? []}/></span>}
        </button>)}
    </fieldset>;
    return <div className="ar-offer-list">
        {offers.length > 1 && candidates.length > 0 && <details className="ar-payment-filter"><summary>아끼려는 손패 선택{preserved.size ? ` · ${preserved.size}장` : ''}</summary>
            <p>선택한 카드를 지불하지 않는 방법만 표시합니다.</p>
            <div>{candidates.map(card => <button type="button" disabled={disabled} key={card.tileId} aria-pressed={preserved.has(card.tileId)} onClick={() => toggle(card.tileId)}>{label(card)}</button>)}</div>
            {preserved.size > 0 && <button type="button" onClick={reset}>필터 초기화</button>}
        </details>}
        {preserved.size > 0 && <p className="ar-payment-count" role="status">지불 방법 {count}개 / 전체 {offers.length}개</p>}
        {offers.some(o => o.kind === 'EFFECT' && o.targetId === 'research-reward') && <p className="ar-research-receipt" role="note"><b>선착순 보너스와 연구 보상을 모두 받습니다.</b><br/>아래에서는 받는 순서만 고릅니다. 자원 보상은 자동 반영되며, 카드 뽑기 등은 이어지는 선택을 확정하세요.</p>}
        <div className="ar-offers">
            {groups.filter(g => !['IDOL', 'END'].includes(g.offers[0]!.kind)).map(renderGroup)}
            {groups.some(g => g.offers[0]?.kind === 'IDOL') && <section className="ar-idol-choices" aria-label="우상 사용 선택">
                <h3>𓅓 우상 사용 <small>선택 · 자유 행동</small></h3>
                <p>새 유적에서 얻은 우상으로 <b>아래 보상 중 하나</b>를 받습니다. 꼭 사용할 필요는 없습니다.</p>
                {idol && <p>사용 가능한 우상 <b>{idol.remaining}개</b> · 이번 사용 시 빈 슬롯 <b>{idol.slotPoints}점</b>을 포기합니다.</p>}
                <p>우상 자체의 3점은 유지됩니다. 보관하면 슬롯 점수를 지키고 나중에 사용할 수 있습니다.</p>
                {groups.filter(g => g.offers[0]?.kind === 'IDOL').map(renderGroup)}
            </section>}
            {groups.filter(g => g.offers[0]?.kind === 'END').map(renderGroup)}
        </div>
        {offers.length > 0 && !count && <div className="ar-payment-empty"><p>선택한 손패를 모두 아끼는 지불 방법이 없습니다.</p><button type="button" onClick={reset}>전체 지불 방법 보기</button></div>}
    </div>;
}
