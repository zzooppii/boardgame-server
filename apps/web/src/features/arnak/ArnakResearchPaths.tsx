import { useId } from 'react';
import { ARNAK_RESEARCH } from '@hangul-rummikub/shared';

export function researchPosition(id: string): string {
    const node = ARNAK_RESEARCH.find(n => n.id === id);
    if (!node) return id;
    if (node.row === 0) return '출발';
    const position = id.endsWith('L') ? ' 왼쪽' : id.endsWith('M') ? ' 가운데' : id.endsWith('R') ? ' 오른쪽' : '';
    return `${node.row}단계${position}`;
}

/** Render the catalog edges only; never infer a legal action from a visible path. */
export function ArnakResearchPaths({ row, target }: { row: number; target: string | null }) {
    const marker = useId();
    const below = ARNAK_RESEARCH.filter(n => n.row === row);
    const above = ARNAK_RESEARCH.filter(n => n.row === row + 1);
    if (!above.length) return null;
    const edges = above.flatMap((to, i) => to.from.map(from => ({ from, to: to.id, x1: (below.findIndex(n => n.id === from) + .5) * 100 / below.length, x2: (i + .5) * 100 / above.length })));
    return <div className="ar-research-paths" aria-label={`${row}단계에서 ${row + 1}단계로 연결된 경로`}>
        <div className="ar-path-endpoints">{above.map(n => <span key={n.id} className={target === n.id ? 'selected' : ''}>{researchPosition(n.id)}</span>)}</div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="context-stroke"/></marker></defs>
            {edges.map(e => <path key={e.from + e.to} data-from={e.from} data-to={e.to} className={target === e.from || target === e.to ? 'selected' : ''} d={`M ${e.x1} 37 L ${e.x2} 3`} markerEnd={`url(#${marker})`}/>)}
        </svg>
        <div className="ar-path-endpoints">{below.map(n => <span key={n.id} className={target === n.id ? 'selected' : ''}>{researchPosition(n.id)}</span>)}</div>
        <span className="ar-sr">{edges.map(e => `${researchPosition(e.from)}에서 ${researchPosition(e.to)}까지 연결`).join('. ')}</span>
    </div>;
}
