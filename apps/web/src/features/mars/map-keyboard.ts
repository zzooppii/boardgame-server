import {MARS_BOARD, type MarsSpace} from '@hangul-rummikub/shared';

const horizontal = (space: MarsSpace) => space.q + space.r / 2;

/** Navigation only: candidates come from server offers; focus never submits a placement. */
export function marsMapFocus(legalIds: readonly string[], current: string|null, key?: string): string|null {
    const legal = new Set(legalIds);
    const spaces = MARS_BOARD.filter(space => legal.has(space.id));
    const first = spaces[0];
    if (!first) return null;
    if (key === 'Home') return first.id;
    if (key === 'End') return spaces.at(-1)!.id;
    const origin = spaces.find(space => space.id === current) ?? first;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const direction = key === 'ArrowLeft' ? -1 : 1;
        return spaces.filter(space => space.r === origin.r && direction * (horizontal(space) - horizontal(origin)) > 0)
            .sort((a,b) => Math.abs(horizontal(a)-horizontal(origin))-Math.abs(horizontal(b)-horizontal(origin)))[0]?.id ?? origin.id;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
        const direction = key === 'ArrowUp' ? -1 : 1;
        return spaces.filter(space => direction * (space.r-origin.r) > 0)
            .sort((a,b) => Math.abs(a.r-origin.r)-Math.abs(b.r-origin.r) ||
                Math.abs(horizontal(a)-horizontal(origin))-Math.abs(horizontal(b)-horizontal(origin)) || horizontal(a)-horizontal(b))[0]?.id ?? origin.id;
    }
    return origin.id;
}
