import { ARNAK_RESEARCH, ARNAK_RESEARCH_EFFECTS, ARNAK_REWARD_EFFECTS, ARNAK_RESOURCE_NAMES, ARNAK_RESOURCES, arnakCostText, arnakEffect, type ArnakProjection } from '@hangul-rummikub/shared';
import { describeArnakEffect } from './effect-description.js';
import { ArnakResourceChips } from './ArnakResourceChips.js';

function Reward({ id }: { id: string }) {
    const effect = arnakEffect(id), description = describeArnakEffect(id);
    if (effect.kind === 'gain') return <ArnakResourceChips value={effect.value ?? {}}/>;
    const text = effect.kind === 'assistant' && effect.mode === 'take' ? '조수 고용' : effect.kind === 'upgrade' ? '조수 승급 + 준비' : effect.kind === 'buy' ? '유물 무료 획득' : effect.kind === 'overcome' ? '내 장소 수호자 극복' : description;
    return <span className="ar-reward-effect" title={description}>{text}</span>;
}

/** Printed track information. Legal moves and actual costs remain server-owned. */
export function ArnakResearchTrack({ game, target, available, name, onSelect }: {
    game: Pick<ArnakProjection, 'playerStates' | 'researchBonuses'>; target: string | null; available: ReadonlySet<string>; name(id: string): string; onSelect(id: string): void;
}) {
    return <aside className="ar-research ar-research-visual" aria-label="새 사원 연구 트랙">
        <div className="ar-section-title"><h2>새 사원 <small>RESEARCH</small></h2></div>
        <button className="ar-temple" onClick={() => onSelect('temple')}>
            <span className="ar-art" aria-hidden="true" style={{ backgroundPosition: '66.6667% 100%' }}/>
            <strong>사원의 비밀</strong><span>도착 순서 점수 · 23 / 21 / 20 / 19</span><small>사원 타일 2 / 6 / 11점 · 눌러서 비용 확인</small>
        </button>
        <p className="ar-track-guide">칸의 <b>지불</b> 자원을 내고 이동 → 말에 맞는 <b>보상</b> 획득</p>
        <div className="ar-track-legend">{ARNAK_RESOURCES.map(k => <span key={k}><ArnakResourceChips value={{ [k]: 1 }}/>{ARNAK_RESOURCE_NAMES[k]}</span>)}</div>
        <p className="ar-track-guide">점수는 최종 위치 기준 · ✦ 선착순 보너스는 별도</p>
        {Array.from({ length: 9 }, (_, i) => 8 - i).map(row => <section className="ar-track-level" key={row} aria-label={`${row}단계 연구`}>
            <div className="ar-research-row"><span className="ar-row-number">{row}</span>{ARNAK_RESEARCH.filter(n => n.row === row).map(node =>
                <button key={node.id} className={`${available.has(node.id) ? 'available' : ''} ${target === node.id ? 'selected' : ''}`} onClick={() => onSelect(node.id)} aria-pressed={target === node.id} aria-label={`연구 ${node.id} · ${arnakCostText(node.cost)}`}>
                    <span className="ar-node-caption">{row === 0 ? '출발' : row === 8 ? '사원 도착 · 지불' : '지불'}</span>
                    {row > 0 && <ArnakResourceChips value={node.cost}/>}
                    <span className="ar-node-occupants">{game.playerStates.flatMap((p, i) => (['magnifier', 'notebook'] as const).filter(t => p[t] === node.id).map(t =>
                        <span className={'ar-research-token seat-' + i} key={p.playerId + t} title={name(p.playerId) + (t === 'magnifier' ? ' 돋보기' : ' 수첩')}>{t === 'magnifier' ? '⌕' : '▣'}</span>))}</span>
                    {game.researchBonuses[node.id] && <span className="ar-node-bonus"><small>✦ 선착순</small><Reward id={ARNAK_REWARD_EFFECTS[game.researchBonuses[node.id]!]!}/></span>}
                </button>)}</div>
            {row > 0 && row < 8 && <div className="ar-track-rewards">{(['magnifier', 'notebook'] as const).map(token =>
                <div key={token} className={'ar-track-reward ' + token}>
                    <span className="ar-reward-heading"><b>{token === 'magnifier' ? '⌕ 돋보기' : '▣ 수첩'} 보상</b><span className="ar-track-points">{(token === 'magnifier' ? [0, 1, 2, 4, 6, 9, 12, 16] : [0, 0, 1, 2, 4, 6, 8, 10])[row]}점</span></span>
                    <span className="ar-reward-content">{(ARNAK_RESEARCH_EFFECTS[token]?.[row - 1] ?? []).map(id => <Reward key={id} id={id}/>)}</span>
                </div>)}</div>}
            {row === 8 && <p className="ar-temple-arrival">돋보기만 도착 · 도착 순위 점수 + 사원 보너스 선택</p>}
        </section>)}
    </aside>;
}
