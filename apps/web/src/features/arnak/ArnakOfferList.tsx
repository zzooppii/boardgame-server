import { useState } from 'react';
import { arnakCard, arnakCostText, ARNAK_TRAVEL_NAMES, type ArnakCard, type ArnakOffer } from '@hangul-rummikub/shared';
import { groupArnakOffers } from './offer-list.js';
export function ArnakOfferList({ offers, hand, selected, disabled, onSelect }: {
    offers: readonly ArnakOffer[]; hand: readonly ArnakCard[]; selected: string | null; disabled: boolean; onSelect(id: string | null): void;
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
    return <div className="ar-offer-list">
        {offers.length > 1 && candidates.length > 0 && <details className="ar-payment-filter"><summary>아끼려는 손패 선택{preserved.size ? ` · ${preserved.size}장` : ''}</summary>
            <p>선택한 카드를 지불하지 않는 방법만 표시합니다.</p>
            <div>{candidates.map(card => <button type="button" disabled={disabled} key={card.tileId} aria-pressed={preserved.has(card.tileId)} onClick={() => toggle(card.tileId)}>{label(card)}</button>)}</div>
            {preserved.size > 0 && <button type="button" onClick={reset}>필터 초기화</button>}
        </details>}
        {preserved.size > 0 && <p className="ar-payment-count" role="status">지불 방법 {count}개 / 전체 {offers.length}개</p>}
        <div className="ar-offers">{groups.map(group => <fieldset className="ar-offer-group" key={group.key}>
            <legend>{group.offers[0]?.free ? 'ϟ ' : ''}{group.label}{group.offers.length > 1 && <small> · 지불 방법 {group.offers.length}개</small>}</legend>
            {group.offers.map((offer, i) => <button type="button" className={selected === offer.id ? 'selected' : ''} disabled={disabled} key={offer.id} aria-pressed={selected === offer.id} onClick={() => onSelect(offer.id)}>
                <strong>{group.offers.length > 1 ? `방법 ${i + 1} · ` : ''}{Object.values(offer.cost).some(amount => amount > 0) ? arnakCostText(offer.cost) : '자원 지불 없음'}</strong>
                <small>{offer.cards.length ? '지불 카드: ' + offer.cards.map(id => { const card = hand.find(c => c.tileId === id); return card ? label(card) : '카드'; }).join(', ') : offer.detail || '카드 지불 없음'}</small>
            </button>)}
        </fieldset>)}</div>
        {offers.length > 0 && !count && <div className="ar-payment-empty"><p>선택한 손패를 모두 아끼는 지불 방법이 없습니다.</p><button type="button" onClick={reset}>전체 지불 방법 보기</button></div>}
    </div>;
}
