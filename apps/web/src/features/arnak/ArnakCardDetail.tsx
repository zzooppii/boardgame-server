import { useEffect, useId, useRef } from 'react';
import { arnakCard, ARNAK_TRAVEL_NAMES, type ArnakCard } from '@hangul-rummikub/shared';
import { describeArnakEffect } from './effect-description.js';

export function ArnakCardDetail({ card, onClose }: { card: ArnakCard; onClose(): void }) {
    const dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null), title = useId(), d = arnakCard(card.definitionId);
    useEffect(() => {
        const element = dialog.current;
        if (!element) return;
        const opener = document.activeElement;
        element.showModal();
        closeButton.current?.focus();
        return () => {
            element.close();
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);
    return <dialog ref={dialog} className="ar-detail-dialog" aria-labelledby={title}
        onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus(); } }}>
        <div className="ar-detail-heading"><span className="ar-kicker">EXPEDITION ARCHIVE</span><button ref={closeButton} type="button" onClick={onClose} aria-label="카드 상세 닫기">닫기 ×</button></div>
        <div className="ar-detail-layout">
            <div className={'ar-detail-illustration ' + d.type}>
                <div className="ar-detail-art" role="img" aria-label={d.name + ' 테마 일러스트'} style={{ backgroundPosition: `${d.art % 4 * 100 / 3}% ${Math.floor(d.art / 4) * 100 / 3}%` }}/>
                <span>{d.type === 'artifact' ? '유물' : d.type === 'item' ? '아이템' : d.type === 'fear' ? '공포' : '기본 카드'}</span><strong>{d.points} VP</strong>
            </div>
            <div className="ar-detail-copy"><h2 id={title}>{d.name}</h2><p className="ar-detail-english">{d.englishName}</p>
                <dl><div><dt>이동 수단</dt><dd>{d.travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')}</dd></div>
                    <div><dt>행동</dt><dd>{d.effects.length ? d.free ? '자유 행동' : '주 행동' : '효과 없이 이동에 사용'}</dd></div>
                    {(d.type === 'item' || d.type === 'artifact') && <div><dt>획득 비용</dt><dd>{d.type === 'item' ? '금화' : '나침반'} {d.cost}</dd></div>}</dl>
                <h3>카드 효과</h3>{d.effects.length ? <ol>{d.effects.map(id => <li key={id}>{describeArnakEffect(id)}</li>)}</ol> : <p>이동 비용으로 사용하거나 카드 제거 효과로 제거할 수 있습니다. 최종 점수 −1점입니다.</p>}
                {d.exileSelf && <p className="ar-detail-note">효과로 사용하면 이 카드 자체를 제거합니다.</p>}
                {d.passEffects.length > 0 && <section className="ar-detail-note"><h3>대신 패스할 때</h3><p>{d.passEffects.map(describeArnakEffect).join(' · ')}</p><p>일반 효과와 둘 중 하나를 선택합니다. 패스하면 이번 라운드에 더 이상 차례가 돌아오지 않습니다.</p></section>}
                {d.type === 'artifact' && <p className="ar-detail-note">획득 즉시 효과를 사용할 수 있습니다. 이후 손패에서 효과를 사용하면 석판 1개를 지불합니다.</p>}
                <p className="ar-detail-hint">카드 한 장은 이동과 효과 중 하나로 사용합니다. 이 창에서는 행동을 실행하지 않습니다.</p>
            </div>
        </div>
    </dialog>;
}
