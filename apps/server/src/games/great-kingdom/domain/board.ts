import type { GreatKingdomBoard, GreatKingdomColor } from "@hangul-rummikub/shared";
export function neighbors(position: number): number[] {
  const row = Math.floor(position / 9), col = position % 9;
  return [row > 0 ? position - 9 : -1, col < 8 ? position + 1 : -1, row < 8 ? position + 9 : -1, col > 0 ? position - 1 : -1].filter(i => i >= 0);
}
function edges(i: number): number {
  return (i < 9 ? 1 : 0) | (i >= 72 ? 2 : 0) | (i % 9 === 0 ? 4 : 0) | (i % 9 === 8 ? 8 : 0);
}
/** For a given owner, their castles are walls. Enemy castles contaminate the entire region.
 * Neutral is a wall for empty territory, but is traversed in a second pass to test its own enclosure. */
export function territoryOwners(board: GreatKingdomBoard): (GreatKingdomColor | null)[] {
  const owners: (GreatKingdomColor | null)[] = Array.from({length: 81}, () => null);
  for (const color of ["BLUE", "ORANGE"] as const) {
    for (const includeNeutral of [false, true]) {
      const seen = new Set<number>();
      const wall = (i: number) => board[i]?.color === color || (!includeNeutral && board[i]?.color === "NEUTRAL");
      for (let origin = 0; origin < 81; origin++) {
        if (seen.has(origin) || wall(origin)) continue;
        const cells = [origin]; seen.add(origin);
        let edgeMask = 0, enemy = false, ownBoundary = false;
        for (let cursor = 0; cursor < cells.length; cursor++) {
          const i = cells[cursor]!; edgeMask |= edges(i);
          const piece = board[i];
          if (piece && piece.color !== "NEUTRAL" && piece.color !== color) enemy = true;
          for (const j of neighbors(i)) {
            if (board[j]?.color === color) ownBoundary = true;
            if (!seen.has(j) && !wall(j)) { seen.add(j); cells.push(j); }
          }
        }
        if (enemy || !ownBoundary || edgeMask === 15) continue;
        for (const i of cells) {
          if (includeNeutral ? board[i]?.color === "NEUTRAL" : board[i] === null) owners[i] = color;
        }
      }
    }
  }
  return owners;
}
export function surroundedCastles(board: GreatKingdomBoard, color: GreatKingdomColor): number[] {
  const seen = new Set<number>(), captured: number[] = [];
  for (let origin = 0; origin < 81; origin++) {
    if (seen.has(origin) || board[origin]?.color !== color) continue;
    const group = [origin]; seen.add(origin); let liberty = false;
    for (let cursor = 0; cursor < group.length; cursor++) {
      for (const j of neighbors(group[cursor]!)) {
        if (board[j] === null) liberty = true;
        else if (board[j]?.color === color && !seen.has(j)) { seen.add(j); group.push(j); }
      }
    }
    if (!liberty) captured.push(...group);
  }
  return captured.sort((a, b) => a - b);
}
export function legalPositions(board: GreatKingdomBoard, color: GreatKingdomColor, remaining: number): number[] {
  if (!remaining) return [];
  const owners = territoryOwners(board);
  return board.flatMap((cell, i) => cell === null && (owners[i] === null || owners[i] === color) ? [i] : []);
}
