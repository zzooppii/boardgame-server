import type { SpiritTerrain } from './actions.js';
export const SPIRIT_BOARDS = ['A', 'B', 'C', 'D'] as const;
export type SpiritBoard = typeof SPIRIT_BOARDS[number];
type BoardDefinition = Readonly<{
    terrains: readonly SpiritTerrain[];
    edges: readonly (readonly [
        number,
        number
    ])[];
    dahan: readonly number[];
    town: number;
    blight: number;
}>;
export const SPIRIT_BOARD_DATA: Record<SpiritBoard, BoardDefinition> = {
    A: { terrains: ['MOUNTAIN', 'WETLAND', 'JUNGLE', 'SANDS', 'WETLAND', 'MOUNTAIN', 'SANDS', 'JUNGLE'], edges: [[1, 2], [1, 4], [1, 5], [1, 6], [2, 3], [2, 4], [3, 4], [4, 5], [5, 6], [5, 7], [5, 8], [6, 8], [7, 8]], dahan: [0, 1, 2, 0, 0, 1, 2, 0], town: 8, blight: 4 },
    B: { terrains: ['WETLAND', 'MOUNTAIN', 'SANDS', 'JUNGLE', 'SANDS', 'WETLAND', 'MOUNTAIN', 'JUNGLE'], edges: [[1, 2], [1, 4], [1, 5], [1, 6], [2, 3], [2, 4], [3, 4], [4, 5], [4, 7], [5, 6], [5, 7], [6, 7], [6, 8], [7, 8]], dahan: [1, 0, 2, 0, 0, 0, 1, 2], town: 6, blight: 4 },
    C: { terrains: ['JUNGLE', 'SANDS', 'MOUNTAIN', 'JUNGLE', 'WETLAND', 'SANDS', 'MOUNTAIN', 'WETLAND'], edges: [[1, 2], [1, 5], [1, 6], [2, 3], [2, 4], [2, 5], [3, 4], [4, 5], [4, 7], [5, 6], [5, 7], [6, 7], [6, 8], [7, 8]], dahan: [1, 0, 2, 0, 2, 1, 0, 0], town: 7, blight: 5 },
    D: { terrains: ['WETLAND', 'JUNGLE', 'WETLAND', 'SANDS', 'MOUNTAIN', 'JUNGLE', 'SANDS', 'MOUNTAIN'], edges: [[1, 2], [1, 5], [1, 7], [1, 8], [2, 3], [2, 4], [2, 5], [3, 4], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7], [7, 8]], dahan: [2, 1, 0, 0, 1, 0, 2, 0], town: 7, blight: 5 },
};
/** Adjacency is a rule fact; the illustrated map may be fitted to any viewport. */
export function spiritBoardLinks(selection: number | readonly SpiritBoard[]): readonly (readonly [
    string,
    string
])[] {
    const boards = typeof selection === 'number' ? SPIRIT_BOARDS.slice(0, selection) : selection;
    const count = boards.length;
    if (count < 1 || count > 4 || new Set(boards).size !== count) throw new Error('Invalid island board selection');
    const links: [
        string,
        string
    ][] = [];
    for (const board of boards)
        for (const [a, b] of SPIRIT_BOARD_DATA[board].edges)
            links.push([`${board}${a}`, `${board}${b}`]);
    const seams: [string, string][] = [];
    // Slots retain the existing digital layout; letters below identify slots, not selected boards.
    // Opposing inland edges form the two-board island. Extra boards extend the two shores.
    if (count >= 2)
        seams.push(['A7', 'B8'], ['A7', 'B7'], ['A8', 'B7']);
    if (count >= 3)
        seams.push(['A3', 'C1'], ['A4', 'C1'], ['A4', 'C6'], ['A5', 'C6'], ['A7', 'C6'], ['A7', 'C8']);
    if (count >= 4)
        seams.push(['C7', 'D8'], ['C7', 'D7'], ['C8', 'D7'], ['B1', 'D3'], ['B1', 'D4'], ['B6', 'D4'], ['B6', 'D6'], ['B8', 'D6'], ['B8', 'D7']);
    const place = (id: string) => {
        const index = SPIRIT_BOARDS.findIndex(board => board === id[0]);
        const board = boards[index];
        if (!board) throw new Error('Missing island board slot');
        return `${board}${id.slice(1)}`;
    };
    return [...links, ...seams.map(([a, b]): [string, string] => [place(a), place(b)])];
}
