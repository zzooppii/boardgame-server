import * as v from 'valibot';
import {
  PlayerIdSchema, TileIdSchema, SpeakeasyBuildingKindSchema, SpeakeasyCountSchema as count,
  SpeakeasyDistrictIdSchema, SpeakeasyOperationSchema,
} from '@hangul-rummikub/shared';

const ids = v.array(TileIdSchema);
const level = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(5));
export const SpeakeasyCardSchema = v.strictObject({tileId: TileIdSchema, operation: SpeakeasyOperationSchema,
  leverage: v.pipe(count, v.maxValue(20))});
const BuildingPiece = v.strictObject({tileId: TileIdSchema, kind: SpeakeasyBuildingKindSchema,
  cost: count, group: v.nullable(v.pipe(count, v.maxValue(2)))});
const Building = v.strictObject({piece: BuildingPiece, ownerId: PlayerIdSchema,
  familyId: v.nullable(TileIdSchema), barrelId: v.nullable(TileIdSchema)});
const Associate = v.strictObject({district: SpeakeasyDistrictIdSchema, strength: count, fee: count,
  defenseBonus: count, protectionBonus: count, stillsImmune: v.boolean(), freeUseAvailable: v.boolean(), takeoverDiscount: count});
const Helper = v.strictObject({tileId: TileIdSchema, bottle: v.pipe(v.string(), v.minLength(1), v.maxLength(50)), value: v.picklist([5, 10, 20]), used: v.boolean()});
const Player = v.strictObject({
  playerId: PlayerIdSchema, cash: count, safe: count,
  levels: v.strictObject({VIP: level, PARTY: level, STILLS: level, FLEET: level, STRENGTH: level}),
  leverageTokens: v.pipe(count, v.maxValue(20)), hand: v.array(SpeakeasyCardSchema), operations: v.array(SpeakeasyCardSchema),
  reserves: v.array(BuildingPiece), removedBuildings: v.array(BuildingPiece),
  vip: ids, familyReserve: ids, removedFamily: ids, goons: ids, stock: ids,
  trucks: v.pipe(v.array(v.strictObject({tileId: TileIdSchema, district: v.nullable(SpeakeasyDistrictIdSchema), barrels: v.pipe(ids, v.maxLength(2))})), v.length(2)),
  books: v.pipe(count, v.maxValue(10)), bookReserve: v.pipe(count, v.maxValue(10)),
  cityTileCount: count, crates: v.array(v.pipe(count, v.minValue(1), v.maxValue(18))),
  helpers: v.array(Helper),
  associate: v.nullable(Associate),
});

export const SpeakeasyEconomySchema = v.strictObject({
  helperDisplay:v.optional(v.array(Helper),()=>[]),helperDeck:v.optional(v.array(Helper),()=>[]),
  crateSupply:v.optional(v.array(v.pipe(count,v.minValue(1),v.maxValue(18))),()=>[]),
  ports: v.optional(v.pipe(v.array(SpeakeasyDistrictIdSchema),v.maxLength(16)),()=>[]),
  ships: v.optional(v.array(v.strictObject({tileId:TileIdSchema,port:SpeakeasyDistrictIdSchema,barrels:ids,crate:v.optional(v.pipe(count,v.minValue(1),v.maxValue(18))),
    prices:v.pipe(v.array(count),v.minLength(1),v.maxLength(40))})),()=>[]),
  players: v.pipe(v.array(Player), v.minLength(2), v.maxLength(4)),
  districts: v.pipe(v.array(v.strictObject({id: SpeakeasyDistrictIdSchema, blocked: v.boolean(), cop: v.boolean(),
    slots: v.pipe(v.array(v.nullable(Building)), v.minLength(2), v.maxLength(3)),
    mobsterSlots: v.array(v.pipe(count, v.maxValue(2))), mobsterStrength: v.nullable(count),
  })), v.length(16)),
  docks: v.array(v.strictObject({familyId: TileIdSchema, ownerId: PlayerIdSchema, zone: v.picklist([0, 1, 2]), space: v.pipe(count, v.maxValue(11))})),
  barrelSupply: ids, goonSupply: ids, discardedCards: v.array(SpeakeasyCardSchema),
  placedBooks: v.array(v.strictObject({goalId: v.string(), space: v.picklist([0, 1]), ownerId: PlayerIdSchema})),
});
export type SpeakeasyEconomy = v.InferOutput<typeof SpeakeasyEconomySchema>;
export type SpeakeasyPlayer = SpeakeasyEconomy['players'][number];
export type SpeakeasyBuilding = NonNullable<SpeakeasyEconomy['districts'][number]['slots'][number]>;
export type SpeakeasyCard = v.InferOutput<typeof SpeakeasyCardSchema>;
export type SpeakeasyFailure = 'INVALID_ACTION' | 'INSUFFICIENT_FUNDS' | 'NOT_OPERATING' | 'CAPACITY' | 'INSUFFICIENT_STRENGTH';
export type SpeakeasyRuleResult<T> = {ok: true; value: T} | {ok: false; reason: SpeakeasyFailure};
export const ruleFailure = (reason: SpeakeasyFailure): {ok: false; reason: SpeakeasyFailure} => ({ok: false, reason});

/** Internal economic slice. It deliberately does not assert that a full base-game catalog is available. */
export function parseSpeakeasyEconomy(input: unknown): SpeakeasyEconomy {
  const s = v.parse(SpeakeasyEconomySchema, input);
  if([...s.helperDisplay,...s.helperDeck].some(h=>h.used)) throw new Error('Used helper in market.');
  const owners = new Set(s.players.map(p => p.playerId));
  if (owners.size !== s.players.length || s.districts.some((d, i) => d.id !== i + 1)) throw new Error('Invalid Speakeasy identities.');
  const pieces: string[] = [...s.barrelSupply, ...s.goonSupply, ...s.discardedCards.map(c => c.tileId)];
  if(new Set(s.ports).size!==s.ports.length||new Set(s.ships.map(ship=>ship.port)).size!==s.ships.length||
    (s.ships.length>0&&s.ships.length>=s.ports.length)||s.ships.some(ship=>!s.ports.includes(ship.port)||ship.barrels.length>ship.prices.length)) throw new Error('Invalid ship configuration.');
  for(const helper of [...s.helperDisplay,...s.helperDeck]) pieces.push(helper.tileId);
  for(const ship of s.ships) pieces.push(ship.tileId,...ship.barrels);
  for (const p of s.players) {
    pieces.push(...p.vip, ...p.familyReserve, ...p.removedFamily, ...p.goons, ...p.stock,
      ...p.reserves.map(b => b.tileId), ...p.removedBuildings.map(b => b.tileId),
      ...p.hand.map(c => c.tileId), ...p.operations.map(c => c.tileId), ...p.helpers.map(c => c.tileId));
    if (p.goons.length > 6 || new Set(p.operations.map(c => c.operation)).size !== p.operations.length ||
      p.operations.some(c => c.operation === 'STRENGTH') || p.hand.some(c => c.operation === 'STRENGTH')) throw new Error('Invalid Speakeasy player.');
    for (const t of p.trucks) pieces.push(t.tileId, ...t.barrels);
    if (p.books + p.bookReserve + s.placedBooks.filter(b => b.ownerId === p.playerId).length !== 10) throw new Error('Speakeasy book conservation.');
  }
  for (const d of s.districts) {
    if ((d.blocked && (d.slots.some(Boolean) || d.mobsterSlots.length)) || new Set(d.mobsterSlots).size !== d.mobsterSlots.length ||
      d.mobsterSlots.some(i => i >= d.slots.length || d.slots[i] !== null) || (d.mobsterSlots.length > 0 && d.mobsterStrength === null)) throw new Error('Invalid Speakeasy district.');
    for (const b of d.slots) if (b) {
      if (!owners.has(b.ownerId) || (b.piece.kind === 'STILLS' && b.barrelId !== null)) throw new Error('Invalid Speakeasy building.');
      pieces.push(b.piece.tileId); if (b.familyId) pieces.push(b.familyId); if (b.barrelId) pieces.push(b.barrelId);
    }
  }
  for (const member of s.docks) {if (!owners.has(member.ownerId)) throw new Error('Invalid dock owner.'); pieces.push(member.familyId);}
  if (new Set(s.docks.map(d => `${d.zone}:${d.space}`)).size !== s.docks.length || new Set(pieces).size !== pieces.length) throw new Error('Duplicate Speakeasy piece.');
  if (new Set(s.placedBooks.map(b => `${b.goalId}:${b.space}`)).size !== s.placedBooks.length ||
    new Set(s.placedBooks.map(b => `${b.goalId}:${b.ownerId}`)).size !== s.placedBooks.length ||
    s.placedBooks.some(b => !owners.has(b.ownerId))) throw new Error('Invalid Speakeasy book placement.');
  return s;
}

export function speakeasyInventory(s: SpeakeasyEconomy): string[] {
  const pieces = [...s.barrelSupply, ...s.goonSupply, ...s.discardedCards.map(c => c.tileId), ...s.docks.map(d => d.familyId)];
  for(const helper of [...s.helperDisplay,...s.helperDeck]) pieces.push(helper.tileId);
  for(const ship of s.ships) pieces.push(ship.tileId,...ship.barrels);
  for (const p of s.players) pieces.push(...p.vip, ...p.familyReserve, ...p.removedFamily, ...p.goons, ...p.stock,
    ...p.reserves.map(b => b.tileId), ...p.removedBuildings.map(b => b.tileId), ...p.hand.map(c => c.tileId),
    ...p.operations.map(c => c.tileId), ...p.helpers.map(h => h.tileId), ...p.trucks.flatMap(t => [t.tileId, ...t.barrels]));
  for (const d of s.districts) for (const b of d.slots) if (b) pieces.push(b.piece.tileId, ...(b.familyId ? [b.familyId] : []), ...(b.barrelId ? [b.barrelId] : []));
  return pieces.sort();
}

export function speakeasyCandidate(original: SpeakeasyEconomy, mutate: (candidate: SpeakeasyEconomy) => SpeakeasyFailure | null): SpeakeasyRuleResult<SpeakeasyEconomy> {
  const candidate = parseSpeakeasyEconomy(original);
  const failed = mutate(candidate); if (failed) return ruleFailure(failed);
  const result = parseSpeakeasyEconomy(candidate);
  if (JSON.stringify(speakeasyInventory(original)) !== JSON.stringify(speakeasyInventory(result))) throw new Error('Speakeasy piece conservation.');
  return {ok: true, value: result};
}
