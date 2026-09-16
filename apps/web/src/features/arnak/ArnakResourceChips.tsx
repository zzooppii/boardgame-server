import { ARNAK_RESOURCES, ARNAK_RESOURCE_NAMES, type ArnakResources } from '@hangul-rummikub/shared';

export function ArnakResourceChips({ value, names = false }: { value: Partial<ArnakResources>; names?: boolean }) {
    return <span className="ar-resource-chips">{ARNAK_RESOURCES.filter(k => (value[k] ?? 0) > 0).map(k =>
        <span className={'ar-resource-chip ' + k} key={k} title={ARNAK_RESOURCE_NAMES[k]} aria-label={`${ARNAK_RESOURCE_NAMES[k]} ${value[k]}`}>
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                {k === 'coin' && <><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><path d="m16 9 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z"/></>}
                {k === 'compass' && <><circle cx="16" cy="16" r="13"/><path d="m21 7-3 12-7 6 3-12Z"/><path d="m14 13 4 6"/></>}
                {k === 'tablet' && <><path d="M7 3h19l-2 26H5L7 3Z"/><path d="m10 9 3-2 2 4m4-4 2 3-3 2M9 16h5m4-1 3 3-4 1M9 23l4-2 1 4m4-2h3"/></>}
                {k === 'arrow' && <><path d="m16 2 12 24-12-5-12 5L16 2Z"/><path d="M16 2v19l-3 8h6l-3-8"/></>}
                {k === 'jewel' && <><path d="m16 2 11 9-4 16-13 3-7-13L16 2Z"/><path d="m16 2 3 12 8-3m-8 3 4 13m-4-13-9 16m9-16L3 17m13-15-6 28"/></>}
            </svg><b>{value[k]}</b>{names && <small>{ARNAK_RESOURCE_NAMES[k]}</small>}
        </span>)}</span>;
}
