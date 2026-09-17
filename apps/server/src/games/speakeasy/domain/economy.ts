import type { PlayerId, TileId, SpeakeasyOperation } from '@hangul-rummikub/shared';
import { speakeasyZone } from '@hangul-rummikub/shared';
import { speakeasyCandidate, ruleFailure, type SpeakeasyEconomy, type SpeakeasyPlayer,
  type SpeakeasyBuilding, type SpeakeasyRuleResult, type SpeakeasyFailure } from './model.js';

export type SpeakeasyPayment = Readonly<{cash: number; safe: number}>;
const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Cash priority is a preview default; the caller may explicitly choose a different legal split. */
export function quoteSpeakeasyPayment(cash: number, safe: number, cost: number, cashToSpend = Math.min(cash, cost)): SpeakeasyRuleResult<SpeakeasyPayment> {
  if (![cash, safe, cost, cashToSpend].every(natural) || cashToSpend > cost || cashToSpend > cash) return ruleFailure('INVALID_ACTION');
  const safeToSpend = (cost - cashToSpend) * 2;
  return safeToSpend <= safe ? {ok: true, value: {cash: cashToSpend, safe: safeToSpend}} : ruleFailure('INSUFFICIENT_FUNDS');
}
function pay(p: SpeakeasyPlayer, cost: number, cashToSpend?: number): SpeakeasyFailure | null {
  const quote = quoteSpeakeasyPayment(p.cash, p.safe, cost, cashToSpend);
  if (!quote.ok) return quote.reason;
  p.cash -= quote.value.cash; p.safe -= quote.value.safe; return null;
}
export function speakeasyOperating(cop: boolean, b: Pick<SpeakeasyBuilding, 'familyId'>): boolean {return !cop || b.familyId !== null;}
export function speakeasyInfamy(p: SpeakeasyPlayer): number {return Object.values(p.levels).reduce((sum, n) => sum + n, 0);}
function crateCount(p: SpeakeasyPlayer, ids: readonly number[]): number {return p.crates.filter(id => ids.includes(id)).length;}
export function speakeasyLeverage(p: SpeakeasyPlayer): number {
  return p.operations.reduce((sum, c) => sum + c.leverage, 0) + (p.associate?.protectionBonus ?? 0) + crateCount(p, [15, 16]) * 2;
}
export function speakeasyUpgradeDiscount(p: SpeakeasyPlayer): number {
  return [0, 1, 2].reduce((discount, group) => p.reserves.some(b => b.group === group) ? discount : Math.max(discount, [3, 5, 8][group]!), 0);
}
function discard(p: SpeakeasyPlayer, s: SpeakeasyEconomy, cardIds: readonly TileId[]): boolean {
  if (new Set(cardIds).size !== cardIds.length || cardIds.some(id => !p.hand.some(c => c.tileId === id))) return false;
  for (const id of cardIds) {const at = p.hand.findIndex(c => c.tileId === id); s.discardedCards.push(...p.hand.splice(at, 1));}
  return true;
}

export type SpeakeasyBuildRequest = Readonly<{pieceId: TileId; district: number; slot: number;
  goons: number; useAssociate: boolean; freeAssociate: boolean; discardIds: readonly TileId[]; cashToSpend?: number}>;
export function buildSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId, request: SpeakeasyBuildRequest,
  permission: Readonly<{kinds: readonly SpeakeasyBuilding['piece']['kind'][]; upgrade: boolean; ignoreDefense?: boolean}>): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId), d = s.districts.find(d => d.id === request.district);
    const piece = p?.reserves.find(b => b.tileId === request.pieceId);
    if (!p || !d || !piece || d.blocked || !permission.kinds.includes(piece.kind) || !natural(request.slot) || request.slot >= d.slots.length ||
      !natural(request.goons) || request.goons > p.goons.length) return 'INVALID_ACTION';
    const old = d.slots[request.slot], takeover = d.mobsterSlots.includes(request.slot);
    const upgrade = old !== null && old !== undefined;
    if (upgrade && (!permission.upgrade || old.ownerId !== ownerId || old.piece.kind !== 'SPEAKEASY' || !['NIGHTCLUB', 'CASINO'].includes(piece.kind))) return 'INVALID_ACTION';
    if (['NIGHTCLUB', 'CASINO'].includes(piece.kind) && s.districts.some(x => speakeasyZone(x.id) === speakeasyZone(d.id) && x.slots.some(b => b?.ownerId === ownerId && b.piece.kind === piece.kind))) return 'INVALID_ACTION';
    if (piece.kind === 'STILLS' && s.districts.some(x => x.slots.some(b => b?.ownerId === ownerId && b.piece.kind === 'STILLS'))) return 'INVALID_ACTION';
    if (request.discardIds.length !== (piece.kind === 'CASINO' ? 1 : 0)) return 'INVALID_ACTION';
    if (takeover && p.associate?.district === d.id) return 'INVALID_ACTION';
    if (!takeover && (request.useAssociate || request.freeAssociate || request.goons > 0)) return 'INVALID_ACTION';
    if (request.useAssociate && !p.associate) return 'INVALID_ACTION';
    if (request.freeAssociate && (!request.useAssociate || !p.associate?.freeUseAvailable)) return 'INVALID_ACTION';
    if (takeover && !permission.ignoreDefense) {
      const attack = p.levels.STRENGTH + request.goons + (request.useAssociate ? p.associate!.strength : 0) + crateCount(p, [13, 14]);
      if (attack <= (d.mobsterStrength ?? Infinity)) return 'INSUFFICIENT_STRENGTH';
    }
    const associateFee = request.useAssociate && !request.freeAssociate ? Math.max(0, p.associate!.fee - p.associate!.takeoverDiscount - 2 * crateCount(p, [5, 6])) : 0;
    const cost = Math.max(0, piece.cost - (upgrade ? speakeasyUpgradeDiscount(p) : 0)) + associateFee;
    const failure = pay(p, cost, request.cashToSpend); if (failure) return failure;
    if (!discard(p, s, request.discardIds)) return 'INVALID_ACTION';
    if (request.freeAssociate) p.associate!.freeUseAvailable = false;
    s.goonSupply.push(...p.goons.splice(p.goons.length - request.goons, request.goons));
    p.reserves.splice(p.reserves.indexOf(piece), 1);
    d.mobsterSlots = d.mobsterSlots.filter(i => i !== request.slot);
    if (old) p.removedBuildings.push(old.piece);
    d.slots[request.slot] = {piece, ownerId, familyId: old?.familyId ?? null, barrelId: old?.barrelId ?? null};
    return null;
  });
}

/** Quantity must come from the verified player-board table, not an incoming client value. */
export function produceSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId, baseQuantity: number): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId);
    if (!p || !natural(baseQuantity)) return 'INVALID_ACTION';
    if (!s.districts.some(d => d.slots.some(b => b?.ownerId === ownerId && b.piece.kind === 'STILLS' && speakeasyOperating(d.cop, b)))) return 'NOT_OPERATING';
    p.stock.push(...s.barrelSupply.splice(0, Math.min(s.barrelSupply.length, baseQuantity + crateCount(p, [17, 18]))));
    return null;
  });
}

/** A complete delivery draft commits together. No teleportation between trucks or buildings. */
export type SpeakeasyDeliveryStep =
  | Readonly<{kind: 'MOVE'; truckId: TileId; district: number}>
  | Readonly<{kind: 'BUY'; truckId: TileId; shipId: TileId; count: number; cashToSpend?: number|undefined}>
  | Readonly<{kind: 'LOAD'; truckId: TileId; count: number}>
  | Readonly<{kind: 'UNLOAD'; truckId: TileId; buildingId: TileId}>;
export function deliverSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId, steps: readonly SpeakeasyDeliveryStep[],
  rules: Readonly<{range: number; edges: readonly (readonly [number, number])[]}>): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId);
    if (!p || !natural(rules.range) || steps.length > 80) return 'INVALID_ACTION';
    const movement = new Map<TileId, number>();
    for (const step of steps) {
      const truck = p.trucks.find(t => t.tileId === step.truckId);
      if (!truck || (p.trucks.indexOf(truck) === 1 && p.levels.FLEET < 3)) return 'INVALID_ACTION';
      if (step.kind === 'MOVE') {
        if (!s.districts.some(d => d.id === step.district)) return 'INVALID_ACTION';
        if (truck.district !== null) {
          if (!rules.edges.some(([a, b]) => (a === truck.district && b === step.district) || (b === truck.district && a === step.district))) return 'INVALID_ACTION';
          const spent = (movement.get(truck.tileId) ?? 0) + 1;
          if (spent > rules.range + crateCount(p, [9, 10])) return 'CAPACITY';
          movement.set(truck.tileId, spent);
        }
        truck.district = step.district;
      } else if (step.kind === 'BUY') {
        const ship=s.ships.find(ship=>ship.tileId===step.shipId);
        if(!ship||truck.district!==ship.port) return 'INVALID_ACTION';
        if(!natural(step.count)||step.count<1||step.count>2||truck.barrels.length+step.count>2) return 'CAPACITY';
        let cost=0;
        for(let i=0;i<step.count;i++) {
          cost+=ship.prices[Math.max(0,ship.barrels.length-1)]!;
          const barrel=ship.barrels.length?ship.barrels.pop():s.barrelSupply.shift();
          if(!barrel) return 'CAPACITY';truck.barrels.push(barrel);
        }
        const failed=pay(p,cost,step.cashToSpend);if(failed) return failed;
        const port=s.ports.indexOf(ship.port);
        const next=Array.from({length:s.ports.length-1},(_,i)=>s.ports[(port+i+1)%s.ports.length]!)
          .find(d=>!s.ships.some(other=>other.port===d));
        if(next===undefined) return 'INVALID_ACTION';ship.port=next;
      } else if (step.kind === 'LOAD') {
        if (!natural(step.count) || step.count < 1 || truck.barrels.length + step.count > 2 || p.stock.length < step.count) return 'CAPACITY';
        const district = s.districts.find(d => d.id === truck.district);
        if (!district?.slots.some(b => b?.ownerId === ownerId && b.piece.kind === 'STILLS' && speakeasyOperating(district.cop, b))) return 'NOT_OPERATING';
        truck.barrels.push(...p.stock.splice(0, step.count));
      } else {
        const district = s.districts.find(d => d.id === truck.district);
        const b = district?.slots.find(b => b?.piece.tileId === step.buildingId);
        if (!district || !b || b.ownerId !== ownerId || b.piece.kind === 'STILLS') return 'INVALID_ACTION';
        if (!speakeasyOperating(district.cop, b)) return 'NOT_OPERATING';
        if (b.barrelId !== null || truck.barrels.length === 0) return 'CAPACITY';
        b.barrelId = truck.barrels.shift()!;
      }
    }
    return null;
  });
}

export function sellSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId, buildingIds: readonly TileId[],
  rates: Readonly<{limit: number; speakeasy: number; premium: number}>): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId);
    if (!p || ![rates.limit, rates.speakeasy, rates.premium].every(natural) || new Set(buildingIds).size !== buildingIds.length ||
      buildingIds.length > rates.limit + crateCount(p, [1, 2])) return 'INVALID_ACTION';
    for (const id of buildingIds) {
      const d = s.districts.find(d => d.slots.some(b => b?.piece.tileId === id));
      const b = d?.slots.find(b => b?.piece.tileId === id);
      if (!b || !d || b.ownerId !== ownerId || !b.barrelId || b.piece.kind === 'STILLS') return 'INVALID_ACTION';
      if (!speakeasyOperating(d.cop, b)) return 'NOT_OPERATING';
      s.barrelSupply.push(b.barrelId); b.barrelId = null;
      p.cash += b.piece.kind === 'SPEAKEASY' ? rates.speakeasy : rates.premium;
    }
    return null;
  });
}

export function protectSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId, buildingIds: readonly TileId[],
  leveragePerMember: number): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId);
    if (!p || !Number.isSafeInteger(leveragePerMember) || leveragePerMember < 1 || leveragePerMember > 4 ||
      new Set(buildingIds).size !== buildingIds.length || buildingIds.length > p.vip.length) return 'INVALID_ACTION';
    const cost = Math.max(0, buildingIds.length * leveragePerMember - speakeasyLeverage(p));
    if (cost > p.leverageTokens) return 'CAPACITY';
    for (const id of buildingIds) {
      const b = s.districts.flatMap(d => d.slots).find(b => b?.piece.tileId === id);
      if (!b || b.ownerId !== ownerId || b.familyId !== null) return 'INVALID_ACTION';
      b.familyId = p.vip.shift()!;
    }
    p.leverageTokens -= cost; return null;
  });
}

export function raiseSpeakeasyLevel(original: SpeakeasyEconomy, ownerId: PlayerId, operation: SpeakeasyOperation,
  discardIds: readonly TileId[]): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId); if (!p) return 'INVALID_ACTION';
    const next = p.levels[operation] + 1;
    const required = operation === 'STRENGTH' ? next === 5 ? 2 : next === 4 ? 1 : 0 : next === 5 ? 1 : 0;
    if (next > 5 || discardIds.length !== required || !discard(p, s, discardIds)) return 'INVALID_ACTION';
    p.levels[operation] = next; return null;
  });
}

export function hireSpeakeasyGoons(original: SpeakeasyEconomy, ownerId: PlayerId, count: number, free: boolean, cashToSpend?: number): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId);
    if (!p || !natural(count) || p.goons.length + count > 6 || count > s.goonSupply.length) return 'CAPACITY';
    const cost = free ? 0 : Array.from({length: count}, (_, i) => p.goons.length + i).reduce((sum, n) => sum + n, 0);
    const failed = pay(p, cost, cashToSpend); if (failed) return failed;
    p.goons.push(...s.goonSupply.splice(0, count)); return null;
  });
}

export function defendSpeakeasy(original: SpeakeasyEconomy, ownerId: PlayerId,
  request: Readonly<{buildingId: TileId; strength: number; defend: boolean; goons: number; useAssociate: boolean; freeAssociate: boolean; cashToSpend?: number}>): SpeakeasyRuleResult<SpeakeasyEconomy> {
  return speakeasyCandidate(original, s => {
    const p = s.players.find(p => p.playerId === ownerId), d = s.districts.find(d => d.slots.some(b => b?.piece.tileId === request.buildingId));
    const at = d?.slots.findIndex(b => b?.piece.tileId === request.buildingId), b = at === undefined ? null : d?.slots[at];
    if (!p || !d || !b || at === undefined || b.ownerId !== ownerId || !natural(request.strength) || !natural(request.goons) || request.goons > p.goons.length) return 'INVALID_ACTION';
    if (!request.defend && (request.goons || request.useAssociate || request.freeAssociate || (request.cashToSpend ?? 0) > 0)) return 'INVALID_ACTION';
    if (request.useAssociate && !p.associate) return 'INVALID_ACTION';
    if (request.freeAssociate && (!request.useAssociate || !p.associate?.freeUseAvailable)) return 'INVALID_ACTION';
    const immune = b.piece.kind === 'STILLS' && p.associate?.stillsImmune === true;
    if (request.defend) {
      const strength = p.levels.STRENGTH + request.goons + (p.associate?.defenseBonus ?? 0) + crateCount(p, [3, 4]) + (request.useAssociate ? p.associate!.strength : 0);
      if (!immune && strength < request.strength) return 'INSUFFICIENT_STRENGTH';
      const fee = request.useAssociate && !request.freeAssociate ? Math.max(0, p.associate!.fee - 2 * crateCount(p, [5, 6])) : 0;
      const failed = pay(p, fee, request.cashToSpend); if (failed) return failed;
      if (request.freeAssociate) p.associate!.freeUseAvailable = false;
      s.goonSupply.push(...p.goons.splice(p.goons.length - request.goons, request.goons));
    } else {
      p.removedBuildings.push(b.piece); if (b.familyId) p.removedFamily.push(b.familyId);
      if (b.barrelId) s.barrelSupply.push(b.barrelId);
      if (b.piece.kind === 'STILLS') s.barrelSupply.push(...p.stock.splice(0));
      d.slots[at] = null; d.mobsterSlots.push(at);
      // The surrounding Mob War controller must already have revealed this district's Mobster.
      if (d.mobsterStrength === null) return 'INVALID_ACTION';
    }
    return null;
  });
}
