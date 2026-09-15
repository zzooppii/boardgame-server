import type { CSSProperties } from 'react';
import { ARNAK_SITES, ARNAK_GUARDIANS, ARNAK_ASSISTANTS } from '@hangul-rummikub/shared';

export const ARNAK_WORLD_ART_SHEETS: readonly (readonly string[])[] = [
    ['base-0', 'base-1', 'base-2', 'base-3', 'base-4', 'site1-0', 'site1-1', 'site1-2', 'site1-3', 'site1-4', 'site1-5', 'site1-6', 'site1-7', 'site1-8', 'site1-9', 'site2-0'],
    ['site2-1', 'site2-2', 'site2-3', 'site2-4', 'site2-5', 'guardian-0', 'guardian-1', 'guardian-2', 'guardian-3', 'guardian-4', 'guardian-5', 'guardian-6', 'guardian-7', 'guardian-8', 'guardian-9', 'guardian-10'],
    ['guardian-11', 'guardian-12', 'guardian-13', 'guardian-14', 'assistant-0', 'assistant-1', 'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6', 'assistant-7', 'assistant-8', 'assistant-9', 'assistant-10', 'assistant-11']
];
const cells = new Map(ARNAK_WORLD_ART_SHEETS.flatMap((ids, sheet) => ids.map((id, cell) => [id, { sheet: sheet + 1, cell }] as const)));
const names = new Map([...ARNAK_SITES, ...ARNAK_GUARDIANS, ...ARNAK_ASSISTANTS].map(d => [d.id, d.name]));
/** Only an explicitly supplied public definition selects art; hidden or unknown IDs have no image. */
export function arnakWorldArt(definitionId: string | null | undefined): { name: string; style: CSSProperties } | null {
    if (!definitionId) return null;
    const art = cells.get(definitionId), name = names.get(definitionId);
    if (!art || !name) return null;
    // Centered 96% of each square cell keeps its boundary out of small and enlarged views.
    const side = .24, x = art.cell % 4 * .25 + .005, y = Math.floor(art.cell / 4) * .25 + .005;
    return { name, style: {
        backgroundImage: `url('/images/arnak/world-${art.sheet}.webp')`,
        backgroundPosition: `${x / (1 - side) * 100}% ${y / (1 - side) * 100}%`,
        backgroundSize: `${100 / side}% ${100 / side}%`
    } };
}
