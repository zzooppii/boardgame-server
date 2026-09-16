import { speakeasyZone, type PlayerId } from '@hangul-rummikub/shared';
import { speakeasyOperating, speakeasyInfamy, speakeasyLeverage } from './economy.js';
import { speakeasyCandidate, type SpeakeasyBuilding, type SpeakeasyEconomy, type SpeakeasyPlayer } from './model.js';

const hierarchy = {STILLS: 1, SPEAKEASY: 2, NIGHTCLUB: 3, CASINO: 4} as const;
const finalValue = {STILLS: 20, SPEAKEASY: 10, NIGHTCLUB: 15, CASINO: 20} as const;
export function speakeasyDistrictControllers(d: SpeakeasyEconomy['districts'][number]): readonly (PlayerId | 'MOBSTER')[] {
  const operating = d.slots.filter((b): b is SpeakeasyBuilding => b !== null && speakeasyOperating(d.cop, b));
  if (!operating.length) return d.mobsterSlots.length ? ['MOBSTER'] : [];
  const rank = (b: SpeakeasyBuilding) => (b.familyId ? 10 : 0) + hierarchy[b.piece.kind];
  const best = Math.max(...operating.map(rank));
  return [...new Set(operating.filter(b => rank(b) === best).map(b => b.ownerId))];
}

export function speakeasyZonePayouts(s: SpeakeasyEconomy, payoutTables: readonly (readonly number[])[]) {
  if (payoutTables.length !== 3 || payoutTables.some(t => t.length < s.players.length + 1 || t.some(n => !Number.isSafeInteger(n) || n < 0))) throw new Error('A verified payout table is required.');
  const players: (PlayerId | 'MOBSTER')[] = [...s.players.map(p => p.playerId), 'MOBSTER'];
  return [0, 1, 2].map(zone => {
    const counts = players.map(playerId => ({playerId, controlled: s.districts.filter(d => speakeasyZone(d.id) === zone && speakeasyDistrictControllers(d).includes(playerId)).length}));
    return counts.map(entry => {
      const rank = counts.filter(c => c.controlled >= entry.controlled).length;
      return {...entry, zone, rank: entry.controlled > 0 ? rank : null, amount: entry.controlled > 0 ? payoutTables[zone]![rank - 1]! : 0};
    });
  });
}

export function speakeasyFinalScores(s: SpeakeasyEconomy) {
  return s.players.map(p => {
    const buildings = s.districts.flatMap(d => d.slots).filter((b): b is SpeakeasyBuilding => b !== null && b.ownerId === p.playerId);
    const protectedBuildings = buildings.filter(b => b.familyId !== null);
    const bottles = new Map<string, number>();
    for (const h of p.helpers) {
      if (bottles.has(h.bottle) && bottles.get(h.bottle) !== h.value) throw new Error('Inconsistent helper bottle values.');
      bottles.set(h.bottle, h.value);
    }
    const buildingMoney = protectedBuildings.reduce((sum, b) => sum + finalValue[b.piece.kind], 0);
    const helperMoney = [...bottles.values()].reduce((sum, n) => sum + n, 0);
    const tieBreak = [protectedBuildings.length, buildings.length, s.placedBooks.filter(b => b.ownerId === p.playerId).length,
      p.vip.length + s.docks.filter(d => d.ownerId === p.playerId).length + protectedBuildings.length];
    return {playerId: p.playerId, cash: p.cash, safe: p.safe, buildingMoney, helperMoney,
      total: p.cash + p.safe + buildingMoney + helperMoney, tieBreak};
  }).sort((a, b) => b.total - a.total || b.tieBreak[0]! - a.tieBreak[0]! || b.tieBreak[1]! - a.tieBreak[1]! || b.tieBreak[2]! - a.tieBreak[2]! || b.tieBreak[3]! - a.tieBreak[3]!);
}
export function speakeasyWinners(s: SpeakeasyEconomy): readonly PlayerId[] {
  const scores = speakeasyFinalScores(s), first = scores[0]!;
  return scores.filter(p => p.total === first.total && p.tieBreak.every((n, i) => n === first.tieBreak[i])).map(p => p.playerId);
}

export type SpeakeasyGoal =
  | Readonly<{kind: 'CRATES' | 'PROTECTED_DISTRICTS' | 'INFAMY' | 'LEVERAGE' | 'STRENGTH'; minimum: number}>
  | Readonly<{kind: 'LEVELS'; minimum: number; level: number}>
  | Readonly<{kind: 'BUILDINGS'; minimum: number; type: SpeakeasyBuilding['piece']['kind'] | null; protected: boolean; barrel: boolean; ignoreOperating: boolean; eachZone: boolean}>
  | Readonly<{kind: 'ZONE'; zone: 0 | 1 | 2; types: readonly SpeakeasyBuilding['piece']['kind'][]; placement: 'SAME_DISTRICT' | 'DIFFERENT_DISTRICTS' | 'ANY'}>;
export function speakeasyGoalMet(s: SpeakeasyEconomy, p: SpeakeasyPlayer, goal: SpeakeasyGoal): boolean {
  const owned = s.districts.flatMap(d => d.slots.flatMap(b => b?.ownerId === p.playerId ? [{...b, district: d.id, operating: speakeasyOperating(d.cop, b)}] : []));
  switch (goal.kind) {
    case 'CRATES': return p.crates.length >= goal.minimum;
    case 'PROTECTED_DISTRICTS': return new Set(owned.filter(b => b.familyId !== null).map(b => b.district)).size >= goal.minimum;
    case 'INFAMY': return speakeasyInfamy(p) >= goal.minimum;
    case 'LEVERAGE': return speakeasyLeverage(p) + p.leverageTokens >= goal.minimum;
    case 'STRENGTH': return p.levels.STRENGTH + p.goons.length + (p.associate?.strength ?? 0) >= goal.minimum;
    case 'LEVELS': return Object.values(p.levels).filter(level => level >= goal.level).length >= goal.minimum;
    case 'BUILDINGS': {
      const matching = owned.filter(b => (goal.ignoreOperating || b.operating) && (goal.type === null || b.piece.kind === goal.type) &&
        (!goal.protected || b.familyId !== null) && (!goal.barrel || b.barrelId !== null));
      return matching.length >= goal.minimum && (!goal.eachZone || [0, 1, 2].every(zone => matching.some(b => speakeasyZone(b.district) === zone)));
    }
    case 'ZONE': {
      const zoneGoal = goal;
      const matching = owned.filter(b => b.familyId !== null && speakeasyZone(b.district) === goal.zone);
      function select(i: number, chosen: typeof matching): boolean {
        if (i === zoneGoal.types.length) {
          const districts = new Set(chosen.map(b => b.district));
          return zoneGoal.placement === 'ANY' || (zoneGoal.placement === 'SAME_DISTRICT' ? districts.size === 1 : districts.size === chosen.length);
        }
        return matching.some(b => b.piece.kind === zoneGoal.types[i] && !chosen.includes(b) && select(i + 1, [...chosen, b]));
      }
      return select(0, []);
    }
  }
}
export function cookSpeakeasyBook(s: SpeakeasyEconomy, ownerId: PlayerId,
  goal: Readonly<{id: string; requirement: SpeakeasyGoal; payout: number}>, space: 0 | 1) {
  return speakeasyCandidate(s, candidate => {
    const p = candidate.players.find(p => p.playerId === ownerId);
    if (!p || !Number.isSafeInteger(goal.payout) || goal.payout < 0 || p.books < 1 ||
      candidate.placedBooks.some(b => b.goalId === goal.id && (b.ownerId === ownerId || b.space === space)) || !speakeasyGoalMet(candidate, p, goal.requirement)) return 'INVALID_ACTION';
    p.books--; p.safe += goal.payout; candidate.placedBooks.push({goalId: goal.id, space, ownerId}); return null;
  });
}
