import { SPIRIT_ELEMENT_LABELS, type SpiritElement } from '@hangul-rummikub/shared';

export function ElementBadge({ element, count }: { element: SpiritElement; count?: number }) {
    const label = SPIRIT_ELEMENT_LABELS[element];
    return <span className={`si-element-badge${count === 0 ? ' si-element-empty' : ''}`} aria-label={count === undefined ? label : `${label} ${count}개`}>
        <svg className="si-element-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {element === 'SUN' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : null}
            {element === 'MOON' ? <path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/> : null}
            {element === 'FIRE' ? <path d="M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-3 2-6 1-10Zm0 12c-3 3-3 6 0 7 3-1 3-4 0-7Z"/> : null}
            {element === 'AIR' ? <><path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a2 2 0 1 0-2-2M4 16h10a3 3 0 1 1-3 3"/></> : null}
            {element === 'WATER' ? <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15c0 2 1 3 3 3"/> : null}
            {element === 'EARTH' ? <><path d="m3 18 3-9 8-4 7 8-3 7H6Zm3-9 7 3 1-7m-1 7 5 8m-5-8L6 20M2 22h20"/></> : null}
            {element === 'PLANT' ? <><path d="M12 22V10m0 5C4 15 3 10 3 6c6 0 9 3 9 9Zm0-4c0-6 3-9 9-9 0 6-3 9-9 9Z"/></> : null}
            {element === 'ANIMAL' ? <><ellipse cx="5" cy="9" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="5" rx="2" ry="3"/><ellipse cx="21" cy="10" rx="2" ry="3"/><path d="M7 16c2-1 2-6 6-6s4 5 6 6c4 5-2 7-6 4-4 3-10 1-6-4Z"/></> : null}
        </svg>
        <span className="si-element-name">{label}</span>
        {count === undefined ? null : <b className="si-element-count">{count}</b>}
    </span>;
}
