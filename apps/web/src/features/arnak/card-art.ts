import type { CSSProperties } from 'react';
import { arnakCard } from '@hangul-rummikub/shared';

/** Atlas order is explicit so catalog reordering cannot silently change illustrations. */
export const ARNAK_CARD_ART_SHEETS: readonly (readonly string[])[] = [
    ['0101', '0102', '0103', '0104', '0105', '0106', '0107', '0108', '0109', '0110', '0111', '0112', '0113', '0114', '0115', '0116'],
    ['0117', '0118', '0119', '0120', '0121', '0122', '0123', '0124', '0125', '0126', '0127', '0128', '0129', '0130', '0131', '0132'],
    ['0133', '0134', '0135', '0136', '0137', '0138', '0139', '0140', '0201', '0202', '0203', '0204', '0205', '0206', '0207', '0208'],
    ['0209', '0210', '0211', '0212', '0213', '0214', '0215', '0216', '0217', '0218', '0219', '0220', '0221', '0222', '0223', '0224'],
    ['0225', '0226', '0227', '0228', '0229', '0230', '0231', '0232', '0233', '0234', '0235', 'funding-car', 'funding-boat', 'exploration-car', 'exploration-boat', 'fear']
];
const cells = new Map(ARNAK_CARD_ART_SHEETS.flatMap((ids, sheet) => ids.map((id, cell) => [id, { sheet: sheet + 1, cell }] as const)));
// Generated row edges vary slightly. Crop a square inside each verified cell to avoid neighboring art.
const rowEdges: readonly (readonly number[])[] = [
    [0, 314, 627, 941, 1254], [0, 314, 627, 941, 1254], [0, 314, 627, 934, 1254],
    [0, 314, 627, 918, 1254], [0, 314, 627, 919, 1254]
];
export function arnakCardArtStyle(definitionId: string): CSSProperties {
    const art = cells.get(definitionId);
    if (!art) {
        const cell = arnakCard(definitionId).art;
        return { backgroundImage: "url('/images/arnak/atlas.webp')", backgroundPosition: `${cell % 4 * 100 / 3}% ${Math.floor(cell / 4) * 100 / 3}%`, backgroundSize: '400% 400%' };
    }
    const edges = rowEdges[art.sheet - 1]!, row = Math.floor(art.cell / 4), column = art.cell % 4;
    const top = edges[row]!, height = edges[row + 1]! - top, width = 1254 / 4;
    const size = Math.min(width, height) - 8;
    const x = column * width + (width - size) / 2, y = top + (height - size) / 2;
    return {
        backgroundImage: `url('/images/arnak/cards-${art.sheet}.webp')`,
        backgroundPosition: `${x / (1254 - size) * 100}% ${y / (1254 - size) * 100}%`,
        backgroundSize: `${1254 / size * 100}% ${1254 / size * 100}%`
    };
}
