import { arnakCard, type ArnakCard } from '@hangul-rummikub/shared';
import { ArnakCardArt } from './ArnakCardArt.js';

export function ArnakCleanup({ hand, keep, selected, disabled, onSelect }: {
    hand: readonly ArnakCard[]; keep: readonly string[]; selected: string | null;
    disabled: boolean; onSelect(id: string): void;
}) {
    const groups = [
        { label: '보관할 손패', cards: hand.filter(card => keep.includes(card.tileId)) },
        { label: '내려놓을 손패', cards: hand.filter(card => !keep.includes(card.tileId)) },
    ];
    return <section className="ar-cleanup" aria-label="라운드 정리 손패">
        <span className="ar-kicker">PACK YOUR CAMP</span><h3>손패 보관 정리</h3>
        <p>카드를 눌러 보관 여부를 고른 뒤 선택을 확정하세요. 아래 목록에는 확정된 선택만 표시됩니다.</p>
        {groups.map(group => <div key={group.label}><h4>{group.label} <span>{group.cards.length}장</span></h4>
            {group.cards.length ? <div className="ar-cleanup-cards">{group.cards.map(card => <button type="button" key={card.tileId} disabled={disabled} aria-pressed={selected === card.tileId} onClick={() => onSelect(card.tileId)} aria-label={`${arnakCard(card.definitionId).name} · 손패 ${hand.indexOf(card) + 1} · ${keep.includes(card.tileId) ? '보관 해제 선택' : '보관 선택'}`}>
                <ArnakCardArt definitionId={card.definitionId}/><span>{arnakCard(card.definitionId).name}<small>손패 {hand.indexOf(card) + 1}</small></span>
            </button>)}</div> : <p className="ar-muted">없음</p>}
        </div>)}
        <p className="ar-cleanup-note">보관 여부를 모두 확인했다면 전체 행동에서 패스를 확정하세요. 패스하면 이번 라운드에는 다시 행동할 수 없습니다.</p>
    </section>;
}
