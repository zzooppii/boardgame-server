import * as v from 'valibot';
import {GameIdSchema, PlayerIdSchema, TileIdSchema} from '../../identifiers.js';
import {SpeakeasyBuildingViewSchema, SpeakeasyCountSchema, SpeakeasyDistrictIdSchema} from './contracts.js';

const revision = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const SpeakeasyDefenseCommandSchema = v.strictObject({
  gameId: GameIdSchema, revision, buildingId: TileIdSchema,
  defend: v.boolean(), goons: v.pipe(SpeakeasyCountSchema, v.maxValue(6)),
  useAssociate: v.boolean(), freeAssociate: v.boolean(),
  cashToSpend: v.optional(SpeakeasyCountSchema),
});
export type SpeakeasyDefenseCommand = v.InferOutput<typeof SpeakeasyDefenseCommandSchema>;

export const SpeakeasyLucianoPhaseSchema = v.picklist(['REVEAL', 'DEFENSE', 'COPS', 'PAYOUT', 'COMPLETE']);
const revealedMobster = v.strictObject({
  district: SpeakeasyDistrictIdSchema, tileId: TileIdSchema,
  strength: SpeakeasyCountSchema, attack: SpeakeasyCountSchema, stayed: v.nullable(v.boolean()),
});
const payout = v.strictObject({playerId: PlayerIdSchema, zone: v.picklist([0, 1, 2]), amount: SpeakeasyCountSchema});
export const SpeakeasyLucianoViewSchema = v.strictObject({
  gameId: GameIdSchema, revision, act: v.picklist([1, 2, 3]), phase: SpeakeasyLucianoPhaseSchema,
  actorId: v.nullable(PlayerIdSchema), district: v.nullable(SpeakeasyDistrictIdSchema),
  remainingDistricts: SpeakeasyCountSchema,
  pendingBuildings: v.array(TileIdSchema), revealed: v.array(revealedMobster),
  districts: v.array(v.strictObject({district: SpeakeasyDistrictIdSchema, cop: v.boolean(),
    buildings: v.array(SpeakeasyBuildingViewSchema), mobsterSlots: SpeakeasyCountSchema})),
  self: v.strictObject({playerId: PlayerIdSchema, cash: SpeakeasyCountSchema, safe: SpeakeasyCountSchema,
    strength: SpeakeasyCountSchema, goons: SpeakeasyCountSchema}),
  payouts: v.array(payout),
});
export type SpeakeasyLucianoView = v.InferOutput<typeof SpeakeasyLucianoViewSchema>;
