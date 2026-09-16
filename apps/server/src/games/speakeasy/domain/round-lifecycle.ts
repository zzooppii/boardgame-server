import * as v from 'valibot';
import {GameIdSchema, PlayerIdSchema, SPEAKEASY_ROUNDS, SpeakeasyRestaurantCommandSchema, SpeakeasyDrawCommandSchema,
  speakeasyRestaurantDiscardCount, type PlayerId} from '@hangul-rummikub/shared';
import {SpeakeasyEconomySchema, SpeakeasyCardSchema, parseSpeakeasyEconomy, speakeasyInventory, ruleFailure,
  type SpeakeasyRuleResult, type SpeakeasyEconomy} from './model.js';
import {nextSpeakeasyTurn, speakeasyNextOrder} from './rounds.js';
import {speakeasyOperating} from './economy.js';
import {speakeasyFinalScores, speakeasyWinners} from './scoring.js';
import type {SpeakeasyPhaseGuard} from './luciano.js';

const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const act = v.picklist([1, 2, 3, 4]);
const order = v.pipe(v.array(PlayerIdSchema), v.minLength(2), v.maxLength(4));
const SeedSchema = v.strictObject({gameId: GameIdSchema, revision: integer, economy: SpeakeasyEconomySchema,
  clock: v.strictObject({act, round: integer, seat: integer, order}),
  decks: v.strictObject({VIP: v.array(SpeakeasyCardSchema), PARTY: v.array(SpeakeasyCardSchema), STILLS: v.array(SpeakeasyCardSchema), FLEET: v.array(SpeakeasyCardSchema)})});
const SettlementSchema = v.strictObject({act, round: integer, restaurantVisited: v.boolean(),
  orderBefore: order, orderAfter: order,
  payouts: v.array(v.strictObject({playerId: PlayerIdSchema, casinos: integer, cash: integer}))});
const StateSchema = v.strictObject({...SeedSchema.entries,
  phase: v.picklist(['PLAYING', 'DRAW_OPERATION', 'ROUND_END', 'LUCIANO', 'FINAL_SCORING']),
  lowerRow: v.array(v.nullable(PlayerIdSchema)),
  lastSettlement: v.nullable(SettlementSchema),
});
export type SpeakeasyRoundLifecycle = v.InferOutput<typeof StateSchema>;

function sameMembers(a: readonly PlayerId[], b: readonly PlayerId[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length && a.every(id => b.includes(id));
}
export function parseSpeakeasyRoundLifecycle(input: unknown): SpeakeasyRoundLifecycle {
  const s = v.parse(StateSchema, input);
  parseSpeakeasyEconomy(s.economy);
  const next = nextSpeakeasyTurn(s.clock);
  for (const [deck, cards] of Object.entries(s.decks)) if (cards.some(c => c.operation !== deck)) throw new Error('Wrong operations deck.');
  const ids = inventory(s);
  if (new Set(ids).size !== ids.length || s.economy.discardedCards.length) throw new Error('Invalid operations inventory.');
  if (!sameMembers(s.clock.order, s.economy.players.map(p => p.playerId))) throw new Error('Invalid round players.');
  speakeasyNextOrder(s.clock.order, s.lowerRow);
  if (!['PLAYING', 'DRAW_OPERATION'].includes(s.phase) && next.kind === 'NEXT_PLAYER') throw new Error('Premature round end.');
  if (['PLAYING', 'DRAW_OPERATION'].includes(s.phase) && s.lowerRow.some(id => id !== null && s.clock.order.indexOf(id) > s.clock.seat)) throw new Error('Premature restaurant marker.');
  if (s.phase === 'LUCIANO' && next.kind !== 'LUCIANO') throw new Error('Premature Luciano phase.');
  if (s.phase === 'FINAL_SCORING' && next.kind !== 'FINAL_SCORING') throw new Error('Premature final scoring.');
  if ((s.phase === 'LUCIANO' || s.phase === 'FINAL_SCORING') && s.lowerRow.some(id => id !== null)) throw new Error('Unsettled turn order.');
  if ((s.phase === 'LUCIANO' || s.phase === 'FINAL_SCORING') && !s.lastSettlement) throw new Error('Missing terminal round receipt.');
  if (s.lastSettlement) {
    const receipt = s.lastSettlement;
    if (!sameMembers(receipt.orderBefore, s.clock.order) || !sameMembers(receipt.orderAfter, s.clock.order) ||
      !sameMembers(receipt.payouts.map(p => p.playerId), s.clock.order) || receipt.round < 1 || receipt.round > SPEAKEASY_ROUNDS[receipt.act - 1]!) throw new Error('Invalid round receipt.');
    const terminal = s.phase === 'LUCIANO' || s.phase === 'FINAL_SCORING';
    if (receipt.act !== s.clock.act || receipt.round !== s.clock.round - (terminal ? 0 : 1) ||
      receipt.orderAfter.some((id, i) => id !== s.clock.order[i])) throw new Error('Round receipt does not match progress.');
    const unit = s.clock.order.length === 2 ? 5 : 3;
    if (receipt.payouts.some(p => p.cash !== (receipt.restaurantVisited ? p.casinos * unit : 0))) throw new Error('Invalid casino receipt.');
  }
  return s;
}

/** Entry from the game's verified setup/act controller. Does not deal cards or place Capos. */
export function startSpeakeasyRoundLifecycle(input: unknown): SpeakeasyRoundLifecycle {
  const seed = v.parse(SeedSchema, input);
  if (seed.clock.seat !== 0) throw new Error('A round must start with its first player.');
  const initial: SpeakeasyRoundLifecycle = {...seed, phase: 'PLAYING', lowerRow: seed.clock.order.map(() => null), lastSettlement: null};
  returnDiscards(initial);
  return parseSpeakeasyRoundLifecycle(initial);
}
function matches(s: SpeakeasyRoundLifecycle, g: SpeakeasyPhaseGuard): boolean {
  return s.gameId === g.gameId && s.revision === g.revision;
}
function inventory(s: SpeakeasyRoundLifecycle): string[] {
  return [...speakeasyInventory(s.economy), ...Object.values(s.decks).flatMap(cards => cards.map(c => c.tileId))].sort();
}
function returnDiscards(s: SpeakeasyRoundLifecycle): void {
  for (const card of s.economy.discardedCards.splice(0)) {
    if (card.operation === 'STRENGTH') throw new Error('Strength has no operations deck.');
    s.decks[card.operation].push(card);
  }
}
function commit(before: SpeakeasyRoundLifecycle, s: SpeakeasyRoundLifecycle): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  returnDiscards(s);
  s.revision++;
  const checked = parseSpeakeasyRoundLifecycle(s);
  if (JSON.stringify(inventory(before)) !== JSON.stringify(inventory(checked))) throw new Error('Round piece conservation.');
  return {ok: true, value: checked};
}

/** Server-only bridge for an already authorized economic domain action; never accepts a client state. */
export function commitSpeakeasyRoundEconomy(original: SpeakeasyRoundLifecycle, guard: SpeakeasyPhaseGuard,
  outcome: SpeakeasyRuleResult<SpeakeasyEconomy>): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  if (!matches(original, guard) || original.phase !== 'PLAYING') return ruleFailure('INVALID_ACTION');
  if (!outcome.ok) return outcome;
  const s = parseSpeakeasyRoundLifecycle(original);
  s.economy = parseSpeakeasyEconomy(outcome.value);
  return commit(original, s);
}

/** Mandatory Restaurant sub-action. The caller must already have authorized this location action. */
export function chooseSpeakeasyRestaurantPosition(original: SpeakeasyRoundLifecycle, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  const parsed = v.safeParse(SpeakeasyRestaurantCommandSchema, input);
  if (!parsed.success || !matches(original, parsed.output) || original.phase !== 'PLAYING' || original.clock.order[original.clock.seat] !== actor) return ruleFailure('INVALID_ACTION');
  const command = parsed.output, s = parseSpeakeasyRoundLifecycle(original);
  const required = speakeasyRestaurantDiscardCount(s.clock.order.length, command.position);
  if (required === null || s.lowerRow[command.position] !== null || s.lowerRow.includes(actor) || command.discardIds.length !== required ||
    new Set(command.discardIds).size !== required) return ruleFailure('INVALID_ACTION');
  const p = s.economy.players.find(p => p.playerId === actor)!;
  if (command.discardIds.some(id => !p.hand.some(c => c.tileId === id))) return ruleFailure('INVALID_ACTION');
  for (const id of command.discardIds) {
    const index = p.hand.findIndex(c => c.tileId === id);
    s.economy.discardedCards.push(...p.hand.splice(index, 1));
  }
  s.lowerRow[command.position] = actor;
  return commit(original, s);
}

/** Effective position changes immediately, although actual turn sequence changes only at round end. */
export function speakeasyEffectivePosition(s: SpeakeasyRoundLifecycle, playerId: PlayerId): number | null {
  if (!s.clock.order.includes(playerId)) return null;
  const moved = s.lowerRow.indexOf(playerId);
  return moved < 0 ? s.clock.order.indexOf(playerId) : moved;
}

/** Server-only hook AFTER all location/helper effects and end-turn choices have resolved. */
export function finishSpeakeasyTurnActions(original: SpeakeasyRoundLifecycle, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  if (!matches(original, guard) || original.phase !== 'PLAYING') return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyRoundLifecycle(original);
  s.phase = 'DRAW_OPERATION';
  return commit(original, s);
}

/** The required top-card draw completes the turn. Clients cannot skip it or choose a buried card. */
export function drawSpeakeasyOperation(original: SpeakeasyRoundLifecycle, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  const parsed = v.safeParse(SpeakeasyDrawCommandSchema, input);
  if (!parsed.success || !matches(original, parsed.output) || original.phase !== 'DRAW_OPERATION' || original.clock.order[original.clock.seat] !== actor) return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyRoundLifecycle(original), cards = s.decks[parsed.output.deck];
  const top = cards.shift();
  if (!top) return ruleFailure('INVALID_ACTION');
  s.economy.players.find(p => p.playerId === actor)!.hand.push(top);
  const next = nextSpeakeasyTurn(s.clock);
  if (next.kind === 'NEXT_PLAYER') {s.clock.seat = next.clock.seat; s.phase = 'PLAYING';}
  else s.phase = 'ROUND_END';
  return commit(original, s);
}

/** Casino cash and turn-order changes commit once, including the final round before scoring. */
export function settleSpeakeasyRound(original: SpeakeasyRoundLifecycle, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyRoundLifecycle> {
  if (!matches(original, guard) || original.phase !== 'ROUND_END') return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyRoundLifecycle(original), next = nextSpeakeasyTurn(s.clock);
  const visited = s.lowerRow.some(id => id !== null), orderBefore = [...s.clock.order];
  const payouts = s.economy.players.map(p => {
    const casinos = s.economy.districts.reduce((n, d) => n + d.slots.filter(b => b?.ownerId === p.playerId && b.piece.kind === 'CASINO' && speakeasyOperating(d.cop, b)).length, 0);
    const cash = visited ? casinos * (s.clock.order.length === 2 ? 5 : 3) : 0;
    p.cash += cash;
    return {playerId: p.playerId, casinos, cash};
  });
  s.clock.order = [...speakeasyNextOrder(orderBefore, s.lowerRow)];
  s.lastSettlement = {act: s.clock.act, round: s.clock.round, restaurantVisited: visited,
    orderBefore, orderAfter: [...s.clock.order], payouts};
  s.lowerRow = s.lowerRow.map(() => null);
  if (next.kind === 'ROUND_END') {s.clock.round = next.nextRound; s.clock.seat = 0; s.phase = 'PLAYING';}
  else if (next.kind === 'LUCIANO') s.phase = 'LUCIANO';
  else if (next.kind === 'FINAL_SCORING') s.phase = 'FINAL_SCORING';
  else return ruleFailure('INVALID_ACTION');
  return commit(original, s);
}

export function finalizedSpeakeasyRoundScores(s: SpeakeasyRoundLifecycle) {
  if (s.phase !== 'FINAL_SCORING') return null;
  return {scores: speakeasyFinalScores(s.economy), winners: speakeasyWinners(s.economy)};
}
