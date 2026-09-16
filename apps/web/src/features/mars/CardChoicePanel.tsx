import { useState } from 'react';
import { marsCard } from '@hangul-rummikub/shared';
import type { MarsAction, MarsCardChoice, MarsCard, TileId } from '@hangul-rummikub/shared';
import { MarsCardView } from './cards.js';

export function CardChoicePanel({ choice, hand = [], money, heat, disabled, onConfirm, onSelect }: {
    choice: MarsCardChoice;
    hand?: readonly MarsCard[];
    money: number;
    heat: number;
    disabled: boolean;
    onConfirm(action: MarsAction): void;
    onSelect(): void;
}) {
    const [selected, setSelected] = useState<TileId[]>([]);
    const [spendHeat, setSpendHeat] = useState(0);
    const [search, setSearch] = useState('');
    const limit = choice.kind === 'KEEP' ? choice.keepCount : 1;
    const cost = choice.kind === 'BUY' ? selected.length * choice.cost : 0;
    const heatAvailable = choice.kind === 'BUY' && choice.canUseHeat;
    const cards = choice.kind === 'EXCHANGE' ? hand : choice.cards;
    const visibleCards = choice.kind === 'EXCHANGE' ? cards.filter(c => { const d = marsCard(c.definitionId); return `${d.name} ${d.englishName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()); }) : cards;
    const selectedCard = cards.find(c => c.tileId === selected[0]);
    const valid = (choice.kind !== 'KEEP' || selected.length === limit)
        && Number.isSafeInteger(spendHeat) && spendHeat >= 0 && spendHeat <= cost && spendHeat <= heat
        && (!spendHeat || heatAvailable) && money >= cost - spendHeat;
    function toggle(id: TileId) {
        if (disabled) return;
        if (selected.includes(id)) { setSelected(selected.filter(cardId => cardId !== id)); setSpendHeat(0); }
        else if (selected.length < limit) setSelected([...selected, id]);
        else return;
        onSelect();
    }
    return <section className="tm-card-choice" aria-label="비공개 카드 열람">
        <h3>{choice.label}</h3>
        <p>{choice.kind === 'EXCHANGE' ? '손패 1장을 버린 뒤 새 카드 1장을 뽑습니다. 교환하지 않아도 됩니다.' : choice.kind === 'KEEP' ? `${choice.cards.length}장 중 ${limit}장을 무료로 가져옵니다.` : '이 카드를 3 M€에 구매하거나 버립니다. 카드 실행 비용은 나중에 별도로 지불합니다.'}</p>
        <p className="tm-muted">{choice.kind === 'EXCHANGE' ? '선택하지 않은 손패는 그대로 유지됩니다. 상대에게 카드 내용은 공개되지 않습니다.' : '후보 카드는 나에게만 보입니다. 선택하지 않은 카드는 버립니다.'}</p>
        {choice.kind === 'EXCHANGE' && <label className="tm-exchange-search">교환할 손패 검색 <input type="search" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} /></label>}
        <div className="tm-choice-cards" aria-label="선택할 카드">
            {visibleCards.map(card => <MarsCardView key={card.tileId} card={card} selected={selected.includes(card.tileId)} disabled={disabled || (!selected.includes(card.tileId) && selected.length === limit)} onSelect={() => toggle(card.tileId)} />)}
        </div>
        {!visibleCards.length && <p>검색에 맞는 손패가 없습니다.</p>}
        {choice.kind === 'EXCHANGE' && selectedCard && <p>버릴 카드: <strong>{marsCard(selectedCard.definitionId).name}</strong><button disabled={disabled} onClick={() => toggle(selectedCard.tileId)}>선택 해제</button></p>}
        <p role="status">{selected.length} / {limit}장 선택{choice.kind !== 'EXCHANGE' && ` · 구매 비용 ${cost} M€`}</p>
        {heatAvailable && cost > 0 && <label>구매에 사용할 열 <input type="number" inputMode="numeric" min="0" max={Math.min(cost, heat)} value={spendHeat} disabled={disabled} onChange={event => setSpendHeat(Number(event.target.value))} /> / 보유 {heat}</label>}
        {choice.kind === 'BUY' && <p>확정 후 {money - cost + spendHeat} M€{heatAvailable && ` · 열 ${heat - spendHeat}`}</p>}
        {!valid && selected.length === limit && <p className="tm-warning">보유 자원과 사용할 열을 확인해주세요.</p>}
        <button className="tm-primary" disabled={disabled || !valid} onClick={() => onConfirm({ type: 'CHOOSE_CARDS', choiceId: choice.id, cardIds: selected, heat: spendHeat })}>
            {choice.kind === 'EXCHANGE' ? selected.length ? '1장 버리고 1장 뽑기 확정' : '교환하지 않고 계속' : choice.kind === 'BUY' ? selected.length ? '구매 확정 · 3 M€' : '구매하지 않고 버리기' : `${limit}장 선택 확정`}
        </button>
    </section>;
}
