import * as v from 'valibot';
import {SpeakeasyDistrictIdSchema, SpeakeasyCountSchema, TileIdSchema} from '@hangul-rummikub/shared';
import {SpeakeasyEconomySchema, type SpeakeasyEconomy} from './model.js';

const districtOrder = v.pipe(v.array(SpeakeasyDistrictIdSchema), v.length(16),
  v.check(ids => new Set(ids).size === 16, 'District order must contain each district once.'));
const mobster = v.strictObject({tileId: TileIdSchema, strength: SpeakeasyCountSchema});
const InputSchema = v.strictObject({playerCount: v.picklist([2, 3, 4]),
  blockedDistrictOrder: v.optional(districtOrder), mobsterDistrictOrder: districtOrder,
  copDistrictOrder: districtOrder, setupMobsters: v.array(mobster)});
type Mobster = v.InferOutput<typeof mobster>;
type Schedule = [number[], number[], number[]];
export type SpeakeasyBoardSetup = {
  districts: SpeakeasyEconomy['districts'];
  initialMobsters: {district: number; mobster: Mobster}[];
  mobsterDistrictsByAct: Schedule;
  copDistrictsByAct: Schedule;
};

/** Rules v19c pp.4–5. Server-only shuffled inputs and verified A tiles, never a client command.
 * Full district permutations are filtered after blocking; shuffle each order independently.
 * This prepares the board slice, not a complete game or a verified card catalog.
 */
export function prepareSpeakeasyBoard(input: unknown): SpeakeasyBoardSetup {
  const s = v.parse(InputSchema, input);
  const twoPlayers = s.playerCount === 2;
  if (twoPlayers !== (s.blockedDistrictOrder !== undefined) ||
    s.setupMobsters.length !== (twoPlayers ? 4 : 6) ||
    new Set(s.setupMobsters.map(m => m.tileId)).size !== s.setupMobsters.length) {
    throw new Error('Invalid Speakeasy board setup.');
  }
  const blocked = new Set<number>();
  const quota = [2, 2, 1];
  for (const id of s.blockedDistrictOrder ?? []) {
    const zone = id <= 6 ? 0 : id <= 12 ? 1 : 2;
    if (quota[zone]! > 0) {blocked.add(id); quota[zone]!--;}
  }
  const order = s.mobsterDistrictOrder.filter(id => !blocked.has(id));
  const initialMobsters = s.setupMobsters.map((mobster, i) => ({district: order[i]!, mobster}));
  const districts = v.parse(SpeakeasyEconomySchema.entries.districts,
    Array.from({length: 16}, (_, i) => {
      const id = i + 1, initial = initialMobsters.find(m => m.district === id);
      const slots = Array.from({length: id >= 13 && !twoPlayers ? 3 : 2}, () => null);
      return {id, blocked: blocked.has(id), cop: s.copDistrictOrder.slice(0, 4).includes(id), slots,
        mobsterSlots: initial ? slots.map((_, slot) => slot) : [], mobsterStrength: initial?.mobster.strength ?? null};
    }));
  const start = initialMobsters.length, first = twoPlayers ? 2 : 3;
  return {districts, initialMobsters,
    mobsterDistrictsByAct: [order.slice(start, start + first), order.slice(start + first, start + first * 2), order.slice(start + first * 2)],
    copDistrictsByAct: [s.copDistrictOrder.slice(4, 8), s.copDistrictOrder.slice(8, 12), s.copDistrictOrder.slice(12, 16)]};
}
