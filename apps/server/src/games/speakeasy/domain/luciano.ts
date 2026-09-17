import * as v from 'valibot';
import {GameIdSchema, PlayerIdSchema, TileIdSchema, SpeakeasyCountSchema as count,
  SpeakeasyDistrictIdSchema, type GameId, type PlayerId} from '@hangul-rummikub/shared';
import {SpeakeasyDefenseCommandSchema, SpeakeasyLucianoPhaseSchema, SpeakeasyLucianoViewSchema,
  type SpeakeasyLucianoView} from '@hangul-rummikub/shared';
import {defendSpeakeasy, speakeasyOperating} from './economy.js';
import {parseSpeakeasyEconomy, SpeakeasyEconomySchema, speakeasyInventory,
  type SpeakeasyRuleResult, ruleFailure} from './model.js';
import {speakeasyZonePayouts} from './scoring.js';

const MobsterSchema = v.strictObject({tileId: TileIdSchema, strength: count, modifier: v.pipe(v.number(), v.safeInteger(), v.minValue(-10000), v.maxValue(10000))});
const revision = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER - 1));
const SourceSchema = v.strictObject({gameId: GameIdSchema, revision, act: v.picklist([1, 2, 3]),
  order: v.pipe(v.array(PlayerIdSchema), v.minLength(2), v.maxLength(4)), economy: SpeakeasyEconomySchema,
  districts: v.array(SpeakeasyDistrictIdSchema), deck: v.array(MobsterSchema),
  copDistricts: v.array(SpeakeasyDistrictIdSchema), payoutTables: v.array(v.array(count))});
const StateSchema = v.strictObject({...SourceSchema.entries,
  phase: SpeakeasyLucianoPhaseSchema, nextIndex: count,
  current: v.nullable(v.strictObject({district: SpeakeasyDistrictIdSchema, mobster: MobsterSchema, pending: v.array(TileIdSchema)})),
  revealed: v.array(v.strictObject({district: SpeakeasyDistrictIdSchema, mobster: MobsterSchema, stayed: v.boolean()})),
  discarded: v.array(MobsterSchema),
  payouts: v.array(v.strictObject({playerId: PlayerIdSchema, zone: v.picklist([0, 1, 2]), amount: count})),
});
export type SpeakeasyLuciano = v.InferOutput<typeof StateSchema>;
export type SpeakeasyPhaseGuard = Readonly<{gameId: GameId; revision: number}>;

function validateSource(s: v.InferOutput<typeof SourceSchema>): void {
  parseSpeakeasyEconomy(s.economy);
  if (s.economy.districts.reduce((n, d) => n + d.mobsterSlots.length, 0) > 24) throw new Error('Mobster building supply exceeded.');
  const owners = new Set(s.economy.players.map(p => p.playerId));
  if (s.order.length !== owners.size || new Set(s.order).size !== owners.size || s.order.some(id => !owners.has(id))) throw new Error('Invalid Luciano order.');
  const expected = s.order.length === 2 ? [2, 2, 3][s.act - 1] : [3, 3, 4][s.act - 1];
  // Rules v19c p.4: blocked two-player districts still receive police, but never mobsters.
  if (s.districts.length !== expected || new Set(s.districts).size !== expected ||
    new Set(s.copDistricts).size !== s.copDistricts.length || s.districts.some(id => s.economy.districts[id - 1]!.blocked)) throw new Error('Invalid Luciano districts.');
  speakeasyZonePayouts(s.economy, s.payoutTables);
}

/** Serializable internal state. Never send this object to a socket or persist it in a browser. */
export function parseSpeakeasyLuciano(input: unknown): SpeakeasyLuciano {
  const s = v.parse(StateSchema, input); validateSource(s);
  if (s.districts.some((id, i) => i > 0 && id <= s.districts[i - 1]!) || s.nextIndex > s.districts.length ||
    s.revealed.length + (s.current ? 1 : 0) !== s.nextIndex ||
    s.revealed.some((r, i) => r.district !== s.districts[i]) ||
    (s.phase === 'DEFENSE') !== (s.current !== null) ||
    (s.phase === 'REVEAL' ? s.nextIndex >= s.districts.length : s.phase !== 'DEFENSE' && s.nextIndex !== s.districts.length)) throw new Error('Invalid Luciano progress.');
  const mobsters = [...s.deck, ...s.discarded, ...s.revealed.map(r => r.mobster), ...(s.current ? [s.current.mobster] : [])];
  const ids = [...speakeasyInventory(s.economy), ...mobsters.map(m => m.tileId)];
  if (mobsters.some(m => m.strength + m.modifier < 0 || m.strength + m.modifier > 10000) || new Set(ids).size !== ids.length || s.deck.length < s.districts.length - s.nextIndex) throw new Error('Invalid Luciano inventory.');
  if (s.current) {
    const d = s.economy.districts[s.current.district - 1]!;
    if (s.current.district !== s.districts[s.nextIndex - 1] || d.mobsterStrength !== s.current.mobster.strength ||
      !s.current.pending.length || new Set(s.current.pending).size !== s.current.pending.length ||
      s.current.pending.some(id => !d.slots.some(b => b?.piece.tileId === id))) throw new Error('Invalid Luciano defense.');
  }
  if (s.phase !== 'COMPLETE' && s.payouts.length) throw new Error('Premature Luciano payout.');
  return s;
}

/** The game controller supplies its verified, shuffled catalog and already scheduled districts. */
export function startSpeakeasyLuciano(input: unknown): SpeakeasyLuciano {
  const source = v.parse(SourceSchema, input); validateSource(source);
  if (source.deck.length < source.districts.length || source.districts.some(id => {
    const d = source.economy.districts[id - 1]!; return d.mobsterStrength !== null || d.mobsterSlots.length > 0;
  }) || source.copDistricts.some(id => source.economy.districts[id - 1]!.cop)) throw new Error('Invalid Luciano setup.');
  return parseSpeakeasyLuciano({...source, districts: [...source.districts].sort((a, b) => a - b),
    phase: 'REVEAL', nextIndex: 0, current: null, revealed: [], discarded: [], payouts: []});
}

export function speakeasyDefenseActor(s: SpeakeasyLuciano): PlayerId | null {
  const current = s.current;
  if (!current) return null;
  const district = s.economy.districts[current.district - 1]!;
  return s.order.find(id => district.slots.some(b => b?.ownerId === id && current.pending.includes(b.piece.tileId))) ?? null;
}
function finishDistrict(s: SpeakeasyLuciano): void {
  const current = s.current;
  if (!current || current.pending.length) throw new Error('Unresolved Luciano defense.');
  const district = s.economy.districts[current.district - 1]!;
  const stayed = district.mobsterSlots.length > 0;
  if (!stayed) district.mobsterStrength = null;
  s.revealed.push({district: current.district, mobster: current.mobster, stayed}); s.current = null;
  s.phase = s.nextIndex === s.districts.length ? 'COPS' : 'REVEAL';
  if (s.phase === 'COPS') s.discarded.push(...s.deck.splice(0));
}
function identities(s: SpeakeasyLuciano): string[] {
  return [...speakeasyInventory(s.economy), ...s.deck.map(m => m.tileId), ...s.discarded.map(m => m.tileId),
    ...s.revealed.map(r => r.mobster.tileId), ...(s.current ? [s.current.mobster.tileId] : [])].sort();
}
function commit(before: SpeakeasyLuciano, candidate: SpeakeasyLuciano): SpeakeasyRuleResult<SpeakeasyLuciano> {
  candidate.revision++;
  const checked = parseSpeakeasyLuciano(candidate);
  if (JSON.stringify(identities(before)) !== JSON.stringify(identities(checked))) throw new Error('Luciano tile conservation.');
  return {ok: true, value: checked};
}
function matches(s: SpeakeasyLuciano, guard: SpeakeasyPhaseGuard): boolean {
  return s.gameId === guard.gameId && s.revision === guard.revision;
}

/** Server-only continuation: one reveal, police placement, or payout per atomic transition. */
export function advanceSpeakeasyLuciano(original: SpeakeasyLuciano, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyLuciano> {
  if (!matches(original, guard) || original.phase === 'DEFENSE' || original.phase === 'COMPLETE') return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyLuciano(original);
  if (s.phase === 'REVEAL') {
    const district = s.economy.districts[s.districts[s.nextIndex]! - 1]!, mobster = s.deck.shift()!;
    if (s.economy.districts.reduce((n, d) => n + d.mobsterSlots.length, 0) + district.slots.filter(b => b === null).length > 24) return ruleFailure('CAPACITY');
    district.mobsterStrength = mobster.strength;
    district.mobsterSlots = district.slots.flatMap((b, i) => b === null ? [i] : []);
    s.current = {district: district.id, mobster, pending: district.slots.flatMap(b => b ? [b.piece.tileId] : [])};
    s.nextIndex++; s.phase = 'DEFENSE';
    if (!s.current.pending.length) finishDistrict(s);
  } else if (s.phase === 'COPS') {
    for (const id of s.copDistricts) s.economy.districts[id - 1]!.cop = true;
    s.phase = 'PAYOUT';
  } else if (s.phase === 'PAYOUT') {
    const payoutRows = speakeasyZonePayouts(s.economy, s.payoutTables).flat();
    for (const row of payoutRows) {
      const p = s.economy.players.find(p => p.playerId === row.playerId);
      if (p) {
        p.safe += row.amount;
        // Zone is narrowed explicitly rather than trusting a cast of a computed number.
        if (row.zone !== 0 && row.zone !== 1 && row.zone !== 2) throw new Error('Invalid zone.');
        s.payouts.push({playerId: p.playerId, zone: row.zone, amount: row.amount});
      }
    }
    s.phase = 'COMPLETE';
  }
  return commit(original, s);
}

export function resolveSpeakeasyDefense(original: SpeakeasyLuciano, actorId: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyLuciano> {
  const parsed = v.safeParse(SpeakeasyDefenseCommandSchema, input);
  if (!parsed.success || !matches(original, parsed.output) || original.phase !== 'DEFENSE' || speakeasyDefenseActor(original) !== actorId) return ruleFailure('INVALID_ACTION');
  const command = parsed.output, s = parseSpeakeasyLuciano(original), current = s.current!;
  const building = s.economy.districts[current.district - 1]!.slots.find(b => b?.piece.tileId === command.buildingId);
  if (!current.pending.includes(command.buildingId) || building?.ownerId !== actorId) return ruleFailure('INVALID_ACTION');
  if (!command.defend && s.economy.districts.reduce((n, d) => n + d.mobsterSlots.length, 0) >= 24) return ruleFailure('CAPACITY');
  const outcome = defendSpeakeasy(s.economy, actorId, {
    buildingId: command.buildingId, defend: command.defend, goons: command.goons,
    useAssociate: command.useAssociate, freeAssociate: command.freeAssociate,
    ...(command.cashToSpend === undefined ? {} : {cashToSpend: command.cashToSpend}),
    strength: current.mobster.strength + current.mobster.modifier,
  });
  if (!outcome.ok) return outcome;
  s.economy = outcome.value; current.pending = current.pending.filter(id => id !== command.buildingId);
  if (!current.pending.length) finishDistrict(s);
  return commit(original, s);
}

/** Projection contains only revealed mobsters and the authenticated viewer's own money. */
export function projectSpeakeasyLuciano(s: SpeakeasyLuciano, viewer: PlayerId): SpeakeasyLucianoView | null {
  const self = s.economy.players.find(p => p.playerId === viewer);
  if (!self) return null;
  return v.parse(SpeakeasyLucianoViewSchema, {
    gameId: s.gameId, revision: s.revision, act: s.act, phase: s.phase,
    actorId: speakeasyDefenseActor(s), district: s.current?.district ?? null,
    remainingDistricts: s.districts.length - s.nextIndex, pendingBuildings: s.current?.pending ?? [],
    revealed: [...s.revealed.map(r => ({district: r.district, ...r.mobster, attack: r.mobster.strength + r.mobster.modifier, stayed: r.stayed})),
      ...(s.current ? [{district: s.current.district, ...s.current.mobster, attack: s.current.mobster.strength + s.current.mobster.modifier, stayed: null}] : [])]
      .map(({district, tileId, strength, attack, stayed}) => ({district, tileId, strength, attack, stayed})),
    districts: s.economy.districts.map(d => ({district: d.id, cop: d.cop, mobsterSlots: d.mobsterSlots.length,
      buildings: d.slots.flatMap(b => b ? [{tileId: b.piece.tileId, ownerId: b.ownerId, kind: b.piece.kind,
        protected: b.familyId !== null, barrel: b.barrelId !== null, operating: speakeasyOperating(d.cop, b)}] : [])})),
    self: {playerId: self.playerId, cash: self.cash, safe: self.safe, strength: self.levels.STRENGTH, goons: self.goons.length},
    payouts: s.payouts,
  });
}
