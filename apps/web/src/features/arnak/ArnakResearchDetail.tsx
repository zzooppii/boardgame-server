import { ARNAK_RESEARCH, ARNAK_RESEARCH_EFFECTS, ARNAK_TEMPLE_COSTS, arnakCostText } from '@hangul-rummikub/shared';
import { describeArnakEffect } from './effect-description.js';

/** Catalog previews only. Actual availability and discounted costs come from server offers. */
export function ArnakResearchDetail({ target, templeSupply }: { target: string | null; templeSupply: readonly number[] }) {
    if (target === 'temple') return <section className="ar-card-inspector ar-research-detail" aria-label="사원 타일 안내">
        <span className="ar-kicker">TEMPLE TILES</span><h3>사원 타일</h3>
        <p>돋보기가 사원에 도착한 뒤 획득할 수 있습니다.</p>
        <ul>{ARNAK_TEMPLE_COSTS.map((cost, i) => <li key={i}><strong>{[2, 2, 2, 6, 6, 11][i]}점 <small>· 남은 타일 {templeSupply[i] ?? 0}개</small></strong><span>기본 비용: {arnakCostText(cost)}</span></li>)}</ul>
        <small>할인이 적용된 실제 비용은 아래 실행 가능한 행동에서 확인하세요.</small>
    </section>;
    const node = ARNAK_RESEARCH.find(n => n.id === target);
    if (!node) return null;
    return <section className="ar-card-inspector ar-research-detail" aria-label="연구 칸 안내">
        <span className="ar-kicker">RESEARCH JOURNAL</span><h3>{node.row === 0 ? '연구 출발점' : `${node.row}단계 연구 · ${node.id}`}</h3>
        {node.row > 0 && <><p>기본 비용: {arnakCostText(node.cost)}</p><p>이어지는 이전 칸: {node.from.map(id => id === '0' ? '출발점' : id).join(' · ')}</p></>}
        {node.row > 0 && node.row < 8 && <dl>{(['magnifier', 'notebook'] as const).map(token => <div key={token}><dt>{token === 'magnifier' ? '⌕ 돋보기 보상' : '▣ 수첩 보상'}</dt><dd>{(ARNAK_RESEARCH_EFFECTS[token]?.[node.row - 1] ?? []).map(describeArnakEffect).join(' · ')}</dd></div>)}</dl>}
        {node.row === 8 ? <p>돋보기의 사원 도착 칸입니다. 수첩은 이 칸으로 이동할 수 없습니다.</p> : <small>수첩은 돋보기보다 높은 단계로 이동할 수 없습니다.</small>}
        {node.row > 0 && <small>실행 가능한 이동과 할인 비용은 아래 행동 목록에서 확인하세요.</small>}
    </section>;
}
