import type { DuelCardDefinition } from '@hangul-rummikub/shared';
import { effectText } from './art.js';
import { WonderCost } from './WonderCard.js';
import { buildingReference } from './building-reference.js';

export function BuildingReference({ pantheon, agora, onInspect }: { pantheon: boolean; agora: boolean; onInspect(id: string): void }) {
    const { chains, unlinked, temples } = buildingReference(pantheon, agora);
    function card(d: DuelCardDefinition) {
        const senator = d.color === 'WHITE' || d.color === 'BLACK';
        return <button type="button" key={d.id} className={`du-chain-card du-${d.color}`} onClick={() => onInspect(d.id)} aria-label={`${d.name} · 비용과 효과 보기`}>
            <strong>{d.name}</strong><span className="du-chain-cost">{senator ? '고용 비용: 원로원 규칙 적용' : <>{d.coins > 0 && <span>코인 {d.coins}</span>}<WonderCost cost={d.cost} />{d.coins === 0 && Object.keys(d.cost).length === 0 && <span>비용 없음</span>}</>}</span>
            <span className="du-chain-benefit">{effectText(d)}</span>
        </button>;
    }
    return <div className="du-chain-reference">
        <header><span className="du-eyebrow">BUILDING CHAINS</span><h2>건물과 무료 연계</h2><p>앞선 건물을 보유하면 선으로 연결된 다음 건물의 자원·코인 비용이 면제됩니다. 각 건물을 눌러 상세 효과를 확인하세요.</p><small>구성물 참고표입니다. 이번 게임에서 제외된 카드도 포함합니다.</small></header>
        <div className="du-chain-layout">
            <section><h3>연계 건물</h3><p className="du-reference-scroll-hint">↔ 좁은 화면에서는 표를 좌우로 밀어 보세요.</p>
                <div className="du-chain-scroll" tabIndex={0} role="region" aria-label="시대별 연계 건물 표"><div className="du-chains">
                    <div className="du-chain-age-headings">{[1, 2, 3].map(age => <strong key={age}>시대 {['I', 'II', 'III'][age - 1]}</strong>)}</div>
                    {chains.map(chain => <div key={chain[0]!.id} className={`du-chain-row du-${chain[0]!.color}`}>
                        <svg className="du-chain-lines" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">{chain.slice(1).map((to, i) => <line key={to.id} x1={(chain[i]!.age - 1) * 100 + 50} x2={(to.age - 1) * 100 + 50} y1="50" y2="50" />)}</svg>
                        {chain.slice(1).map((to, i) => <span key={to.id} className="du-chain-arrow" style={{ left: `${(chain[i]!.age + to.age - 1) / 6 * 100}%` }} title={`${chain[i]!.name} 보유 → ${to.name} 무료 건설`} aria-label={`${chain[i]!.name} → ${to.name} 무료 연계`}>→</span>)}
                        {[1, 2, 3].map(age => <div className="du-chain-cell" key={age}>{chain.filter(c => c.age === age).map(card)}</div>)}
                    </div>)}
                </div></div>
            </section>
            <section><h3>연계되지 않은 건물</h3><p>표시된 비용을 지불해 건설합니다. 할인 등의 효과는 별도로 적용됩니다.</p>
                <div className="du-chain-scroll" tabIndex={0} role="region" aria-label="연계되지 않은 건물 표"><div className={`du-unlinked-grid ${pantheon ? 'without-guilds' : ''}`}>
                    {[1, 2, 3].map(age => <div key={age}><h4>시대 {['I', 'II', 'III'][age - 1]}</h4>{unlinked.filter(c => c.age === age && c.color !== 'PURPLE').map(card)}</div>)}
                    {!pantheon && <div><h4>조합</h4>{unlinked.filter(c => c.color === 'PURPLE').map(card)}</div>}
                </div></div>
                {pantheon && <section className="du-temple-reference"><h3>Pantheon · 대신전</h3><p>해당 신화 토큰을 보유하면 무료로 건설합니다. 일반 건물 연계와 구분됩니다.</p><div>{temples.map(card)}</div></section>}
                {agora && <section className="du-temple-reference"><h3>Agora · 의원</h3><p>시대 I·II에 5장씩, 시대 III에 3장이 추가됩니다. 특정 시대에 고정된 건물이 아니므로 따로 표시합니다.</p><div>{unlinked.filter(c => c.color === 'WHITE' || c.color === 'BLACK').map(card)}</div></section>}
            </section>
        </div>
    </div>;
}
