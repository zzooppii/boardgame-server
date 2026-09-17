import * as v from 'valibot';
import {TileIdSchema} from '@hangul-rummikub/shared';

const goal = v.strictObject({tileId: TileIdSchema,
  number: v.pipe(v.number(), v.safeInteger(), v.minValue(1))});
const pile = v.pipe(v.array(goal), v.maxLength(21));
const InputSchema = v.strictObject({zone: v.pipe(v.array(goal), v.length(9)),
  park: v.strictObject({A: pile, B: pile, C: pile})});
type Goal = v.InferOutput<typeof goal>;
export type SpeakeasyGoalSetup = {
  /** Zone order: Downtown, Midtown, Uptown; park order: left to right. */
  zone: Goal[];
  park: {group: 'A' | 'B' | 'C'; tile: Goal}[];
  returned: Goal[];
};

/** Server-only selection from independently shuffled, verified tile metadata.
 * Rules v19c p.5. Requirements and printed rewards remain in the server catalog.
 */
export function prepareSpeakeasyGoals(input: unknown): SpeakeasyGoalSetup {
  const s = v.parse(InputSchema, input);
  const all = [...s.zone, ...s.park.A, ...s.park.B, ...s.park.C];
  if (all.length !== 30 || new Set(all.map(t => t.tileId)).size !== 30 || s.park.A.length < 2) {
    throw new Error('Invalid Speakeasy goal inventory.');
  }
  function select(pile: Goal[], count: number, used: Set<number>): Goal[] {
    const selected: Goal[] = [];
    for (const tile of pile) {
      if (used.has(tile.number)) continue;
      selected.push(tile); used.add(tile.number);
      if (selected.length === count) return selected;
    }
    throw new Error('Insufficient distinct Speakeasy goals.');
  }
  const zone = select(s.zone, 3, new Set());
  // A uses exactly the top two; do not silently skip or replace malformed catalog entries.
  const a = s.park.A.slice(0, 2), used = new Set(a.map(t => t.number));
  if (used.size !== 2) throw new Error('Invalid Speakeasy A goals.');
  const b = select(s.park.B, 2, used), c = select(s.park.C, 1, used);
  const park: SpeakeasyGoalSetup['park'] = [
    ...a.map(tile => ({group: 'A' as const, tile})),
    ...b.map(tile => ({group: 'B' as const, tile})),
    ...c.map(tile => ({group: 'C' as const, tile})),
  ];
  const placed = new Set([...zone, ...park.map(p => p.tile)].map(t => t.tileId));
  return {zone, park, returned: all.filter(t => !placed.has(t.tileId))};
}
