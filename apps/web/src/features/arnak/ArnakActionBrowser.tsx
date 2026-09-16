import type { ArnakOffer } from '@hangul-rummikub/shared';
import { arnakActionTargets } from './action-browser.js';

export function ArnakActionBrowser({ offers, names, disabled, onSelect }: {
    offers: readonly ArnakOffer[]; names: ReadonlyMap<string, string>; disabled: boolean; onSelect(targetId: string): void;
}) {
    const groups = arnakActionTargets(offers);
    if (!groups.length) return null;
    return <section className="ar-action-browser" aria-label="가능한 행동 찾기">
        <h3>가능한 행동 찾기</h3><p>대상을 고르면 설명과 지불 방법을 확인할 수 있습니다.</p>
        {groups.map(group => <details key={group.kind}><summary>{group.label}<span>대상 {group.targets.length}개</span></summary>
            <div>{group.targets.map(target => <button type="button" key={target.targetId} disabled={disabled} onClick={() => onSelect(target.targetId)}>
                <strong>{names.get(target.targetId) ?? target.fallbackLabel}</strong><small>선택지 {target.choices}개 · 자세히 보기 →</small>
            </button>)}</div>
        </details>)}
    </section>;
}
