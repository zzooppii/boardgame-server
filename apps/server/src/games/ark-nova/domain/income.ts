import { arkDistance, type ArkBuilding } from '@hangul-rummikub/shared';

// First appeal space of each income band, from 5 through 37 money on the base board.
const INCOME_THRESHOLDS = [0, 1, 2, 3, 4, 5, 7, 10, 12, 14, 16, 18, 21, 24, 27, 30, 33, 36, 40, 44, 48, 52, 56, 61, 66, 71, 76, 81, 86, 91, 96, 102, 108] as const;

export function arkAppealIncome(appeal: number): number {
  if (!Number.isSafeInteger(appeal) || appeal < 0 || appeal > 113) throw new Error('Invalid appeal track position.');
  return 4 + INCOME_THRESHOLDS.filter(start => start <= appeal).length;
}

/** Each adjacent building earns once per kiosk, even when multiple hexes touch it. */
export function arkKioskIncome(buildings: readonly ArkBuilding[]): number {
  return buildings.filter(b => b.kind === 'KIOSK').reduce((sum, kiosk) => sum + buildings.filter(b =>
    b.id !== kiosk.id && b.kind !== 'KIOSK' && (!b.kind.startsWith('ENCLOSURE_') || b.occupied) &&
    b.cells.some(cell => kiosk.cells.some(k => arkDistance(cell, k) === 1)),
  ).length, 0);
}
