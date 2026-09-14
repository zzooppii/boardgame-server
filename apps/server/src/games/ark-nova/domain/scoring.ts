/** Original base-game track (rulebook p.19), after resolving all final card effects.
 * This calculates the distance between markers, not the effects of goal/sponsor cards.
 */
export function arkVictoryPoints(appeal: number, conservation: number): number {
  if (!Number.isSafeInteger(appeal) || appeal < 0 || appeal > 113 ||
    !Number.isSafeInteger(conservation) || conservation < 0 || conservation > 41) {
    throw new Error('Invalid Ark Nova scoring track position.');
  }
  const target = conservation <= 10 ? 114 - 2 * conservation : 124 - 3 * conservation;
  return appeal - target;
}
