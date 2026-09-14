export const ARK_DONATION_COSTS = [2, 5, 5, 7, 7, 10, 10, 12] as const;
export function occupyArkSoloDonation(occupied: readonly number[]): Readonly<{occupied: number[]; blocked: number | null}> {
  if (occupied.some(space => !Number.isSafeInteger(space) || space < 0 || space > 6) || new Set(occupied).size !== occupied.length) {
    throw new Error('Invalid occupied donation spaces.');
  }
  const blocked = ARK_DONATION_COSTS.findIndex((cost, space) => cost !== 12 && !occupied.includes(space));
  return {occupied: blocked < 0 ? [...occupied] : [...occupied, blocked], blocked: blocked < 0 ? null : blocked};
}
