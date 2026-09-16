import { ARNAK_TRAVEL_NAMES, type ArnakTravel as Travel } from '@hangul-rummikub/shared';

const shapes: Record<Travel, string> = {
    foot: 'M8 3h7v8l5 4h2v5H3v-6h5V3Zm0 6h7M4 17h17',
    car: 'M3 11h18v7H3v-7Zm3 0 2-6h8l3 6M12 5v6M6 18v3m12-3v3M6 14h2m8 0h2',
    boat: 'M3 16h18l-4 5H7l-4-5Zm9-14v14M10 4 4 13h6V4Zm4 2 6 7h-6V6Z',
    plane: 'm12 2 2 8 8 4v3l-8-2v5l3 2H7l3-2v-5l-8 2v-3l8-4 2-8Z',
};

/** The card's printed travel value, not an additional resource cost. */
export function ArnakTravel({ travel }: { travel: readonly Travel[] }) {
    const types = [...new Set(travel)];
    return <span className="ar-travel" aria-label={'이동 수단: ' + travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')}>
        {types.map(type => {
            const count = travel.filter(t => t === type).length;
            return <span className={'ar-travel-token ' + type} key={type}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={shapes[type]}/></svg>
                <span>{type === 'foot' ? '신발 · 도보' : ARNAK_TRAVEL_NAMES[type]}</span>
                {count > 1 && <b>×{count}</b>}
            </span>;
        })}
    </span>;
}
