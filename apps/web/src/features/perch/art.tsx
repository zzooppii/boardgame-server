import type { CSSProperties } from 'react';
import { PERCH_LOCATIONS, PERCH_FLOCK_COLORS, PERCH_FLOCK_MARKS, type PerchLocation } from '@hangul-rummikub/shared';
export function PerchLocationArt({ id, className = '' }: {
    id: PerchLocation;
    className?: string;
}) { const index = PERCH_LOCATIONS.indexOf(id); return <span aria-hidden="true" className={`pc-location-art ${className}`} style={{ backgroundPosition: `${(index % 6) * 20}% ${Math.floor(index / 6) * 100 / 3}%` }}/>; }
export function PerchCreatureArt({ index, className = '' }: {
    index: number;
    className?: string;
}) { return <span aria-hidden="true" className={`pc-creature-art ${className}`} style={{ backgroundPosition: `${index % 3 * 50}% ${Math.floor(index / 3) * 50}%` }}/>; }
export function PerchBirdToken({ flock, small = false }: {
    flock: number;
    small?: boolean;
}) { return <span className={`pc-bird ${small ? 'small' : ''}`} style={{ '--bird-color': PERCH_FLOCK_COLORS[flock] } as CSSProperties} aria-hidden="true"><svg viewBox="0 0 64 48"><path d="M4 25 18 29Q17 11 31 11Q42 1 50 13L61 16 51 21Q49 41 29 40Q12 39 4 25Z" fill="currentColor" stroke="#26382f" strokeWidth="1.5"/><path d="M21 25Q32 39 43 24Q30 20 21 25" fill="#ffffff" opacity=".22"/><circle cx="44" cy="14" r="2" fill="#192f2d"/><path d="M28 40v5m9-6v5" stroke="#c49a65" strokeWidth="2"/></svg><span>{PERCH_FLOCK_MARKS[flock]}</span></span>; }
