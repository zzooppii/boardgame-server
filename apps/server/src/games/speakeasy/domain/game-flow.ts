import * as v from 'valibot';
import {PlayerIdSchema, TileIdSchema, SpeakeasyLocationSchema, SpeakeasyPlaceCapoCommandSchema,
  SPEAKEASY_ROUNDS, type PlayerId} from '@hangul-rummikub/shared';
import {parseSpeakeasyRoundLifecycle, startSpeakeasyRoundLifecycle, chooseSpeakeasyRestaurantPosition,
  finishSpeakeasyTurnActions, drawSpeakeasyOperation, settleSpeakeasyRound, commitSpeakeasyRoundEconomy,
  type SpeakeasyRoundLifecycle} from './round-lifecycle.js';
import {parseSpeakeasyLuciano, startSpeakeasyLuciano, advanceSpeakeasyLuciano, resolveSpeakeasyDefense,
  type SpeakeasyLuciano, type SpeakeasyPhaseGuard} from './luciano.js';
import {RestaurantChoicesSchema, parseRestaurantChoices, playRestaurantOperation, cookRestaurantBook, type OperationEffects, type RestaurantBookGoal} from './restaurant-actions.js';
import {SpeakeasyRestaurantActionCommandSchema, SpeakeasyRestaurantFinishCommandSchema, SpeakeasyRestaurantBookCommandSchema, SpeakeasyRestaurantCardCommandSchema} from '@hangul-rummikub/shared';
import {ruleFailure, speakeasyInventory, type SpeakeasyEconomy, type SpeakeasyRuleResult} from './model.js';

const Space = v.strictObject({id: v.pipe(v.string(), v.minLength(1), v.maxLength(100)), location: SpeakeasyLocationSchema});
const Capos = v.strictObject({playerId: PlayerIdSchema, available: v.array(TileIdSchema), retired: v.array(TileIdSchema),
  placed: v.array(v.strictObject({tileId: TileIdSchema, spaceId: Space.entries.id}))});
const State = v.strictObject({round: v.unknown(), spaces: v.array(Space), capos: v.array(Capos),
  active: v.nullable(v.strictObject({playerId: PlayerIdSchema, capoId: TileIdSchema, spaceId: Space.entries.id, restaurant: v.nullable(RestaurantChoicesSchema)})),
  luciano: v.nullable(v.unknown()), history: v.array(v.unknown())});
export type SpeakeasyGameFlow = Omit<v.InferOutput<typeof State>, 'round' | 'luciano' | 'history'> & {
  round: SpeakeasyRoundLifecycle; luciano: SpeakeasyLuciano | null; history: SpeakeasyLuciano[];
};

/** Internal snapshot, never a public projection. Space availability comes from verified board data. */
export function parseSpeakeasyGameFlow(input: unknown): SpeakeasyGameFlow {
  const raw = v.parse(State, input);
  const s: SpeakeasyGameFlow = {...raw, round: parseSpeakeasyRoundLifecycle(raw.round),
    luciano: raw.luciano === null ? null : parseSpeakeasyLuciano(raw.luciano), history: raw.history.map(parseSpeakeasyLuciano)};
  const r = s.round, order = r.clock.order, terminal = !['PLAYING', 'DRAW_OPERATION'].includes(r.phase);
  if (s.capos.length !== order.length || new Set(s.capos.map(p => p.playerId)).size !== order.length ||
    s.capos.some(p => !order.includes(p.playerId)) || new Set(s.spaces.map(p => p.id)).size !== s.spaces.length) throw new Error('Invalid Capo setup.');
  const ids = [...speakeasyInventory(r.economy), ...Object.values(r.decks).flatMap(cards => cards.map(c => c.tileId))];
  const occupied: string[] = [];
  for (const p of s.capos) {
    const expected = terminal ? r.clock.round : r.clock.round - 1 +
      (order.indexOf(p.playerId) < r.clock.seat || s.active?.playerId === p.playerId ? 1 : 0);
    if (p.placed.length !== expected || p.available.length + p.placed.length !== SPEAKEASY_ROUNDS[r.clock.act - 1] ||
      p.available.length + p.placed.length + p.retired.length !== 4) throw new Error('Invalid Capo progress.');
    ids.push(...p.available, ...p.retired, ...p.placed.map(c => c.tileId));
    for (const capo of p.placed) {
      const space = s.spaces.find(t => t.id === capo.spaceId);
      if (!space) throw new Error('Unknown Capo space.');
      if (space.location !== 'RESTAURANT') occupied.push(space.id);
    }
  }
  if (s.active && (terminal || s.active.playerId !== order[r.clock.seat] ||
    !s.capos.find(p => p.playerId === s.active!.playerId)?.placed.slice(-1).some(c => c.tileId === s.active!.capoId && c.spaceId === s.active!.spaceId))) throw new Error('Invalid active Capo.');
  if (s.active) {
    const restaurant = s.spaces.find(t => t.id === s.active!.spaceId)?.location === 'RESTAURANT';
    if (restaurant !== (s.active.restaurant !== null)) throw new Error('Missing Restaurant choices.');
    if (s.active.restaurant) {
      const choices = parseRestaurantChoices(s.active.restaurant);
      if (r.phase === 'DRAW_OPERATION' && (choices.current || choices.completed.length !== 2)) throw new Error('Unfinished Restaurant choices.');
    }
  }
  if (r.phase === 'DRAW_OPERATION' && !s.active) throw new Error('Missing active Capo.');
  const currentVisited = r.lowerRow.includes(order[r.clock.seat]!);
  if (!terminal && currentVisited !== (s.active !== null && s.spaces.find(t => t.id === s.active!.spaceId)?.location === 'RESTAURANT')) throw new Error('Invalid Restaurant progress.');
  if (new Set(occupied).size !== occupied.length || new Set(ids).size !== ids.length) throw new Error('Duplicate Capo or occupied space.');
  if (s.luciano) {
    const l = s.luciano;
    if (r.phase !== 'LUCIANO' || l.gameId !== r.gameId || l.revision !== r.revision || l.act !== r.clock.act ||
      JSON.stringify(l.order) !== JSON.stringify(order) || JSON.stringify(l.economy) !== JSON.stringify(r.economy)) throw new Error('Mismatched Luciano state.');
    const mobsters = [...l.deck, ...l.discarded, ...l.revealed.map(m => m.mobster), ...(l.current ? [l.current.mobster] : [])];
    if (mobsters.some(m => ids.includes(m.tileId))) throw new Error('Duplicate mobster identity.');
  }
  if (s.history.length !== r.clock.act - 1) throw new Error('Missing act history.');
  const mobsterIds = [...s.history, ...(s.luciano ? [s.luciano] : [])].flatMap(l =>
    [...l.deck, ...l.discarded, ...l.revealed.map(m => m.mobster), ...(l.current ? [l.current.mobster] : [])].map(m => m.tileId));
  if (new Set(mobsterIds).size !== mobsterIds.length || mobsterIds.some(id => ids.includes(id)) ||
    s.history.some((l, i) => l.phase !== 'COMPLETE' || l.act !== i + 1 || l.gameId !== r.gameId || l.revision >= r.revision ||
      l.order.length !== order.length || l.order.some(id => !order.includes(id)))) throw new Error('Invalid act history.');
  return s;
}

/** Verified initial economy/decks, player Capo identities, and per-player-count action spaces. */
export function startSpeakeasyGameFlow(round: SpeakeasyRoundLifecycle, spaces: unknown, capos: unknown): SpeakeasyGameFlow {
  if (round.clock.act !== 1 || round.clock.round !== 1 || round.clock.seat !== 0 || round.phase !== 'PLAYING' || round.lowerRow.some(Boolean)) throw new Error('Invalid initial game flow.');
  return parseSpeakeasyGameFlow({round, spaces, capos, active: null, luciano: null, history: []});
}
function matches(s: SpeakeasyGameFlow, g: SpeakeasyPhaseGuard): boolean {
  return s.round.gameId === g.gameId && s.round.revision === g.revision;
}
function success(s: SpeakeasyGameFlow): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  return {ok: true, value: parseSpeakeasyGameFlow(s)};
}

/** Placement and the mandatory Restaurant payment commit together; no stranded Capo on failure. */
export function placeSpeakeasyCapo(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const command = v.safeParse(SpeakeasyPlaceCapoCommandSchema, input);
  if (!command.success || !matches(original, command.output) || original.round.phase !== 'PLAYING' || original.active ||
    original.round.clock.order[original.round.clock.seat] !== actor) return ruleFailure('INVALID_ACTION');
  const c = command.output, s = parseSpeakeasyGameFlow(original), space = s.spaces.find(t => t.id === c.spaceId);
  const owner = s.capos.find(p => p.playerId === actor)!;
  if (!space || !owner.available.includes(c.capoId) || (space.location !== 'RESTAURANT' &&
    (c.restaurant || s.capos.some(p => p.placed.some(t => t.spaceId === space.id))))) return ruleFailure('INVALID_ACTION');
  if (space.location === 'RESTAURANT') {
    if (!c.restaurant) return ruleFailure('INVALID_ACTION');
    const outcome = chooseSpeakeasyRestaurantPosition(s.round, actor, {gameId: c.gameId, revision: c.revision, ...c.restaurant});
    if (!outcome.ok) return outcome;
    s.round = outcome.value;
  } else s.round.revision++;
  owner.available.splice(owner.available.indexOf(c.capoId), 1);
  owner.placed.push({tileId: c.capoId, spaceId: space.id});
  s.active = {playerId: actor, capoId: c.capoId, spaceId: space.id, restaurant: space.location === 'RESTAURANT' ? {completed: [], current: null} : null};
  return success(s);
}

/** Server-only: resolve an authorized location effect, including its bonuses, before committing it. */
export function commitSpeakeasyLocationEconomy(original: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard,
  outcome: SpeakeasyRuleResult<SpeakeasyEconomy>): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!matches(original, guard) || !original.active || original.active.restaurant) return ruleFailure('INVALID_ACTION');
  const result = commitSpeakeasyRoundEconomy(original.round, guard, outcome);
  if (!result.ok) return result;
  return success({...original, round: result.value});
}
/** Internal completion hook, only after the server location handler has resolved ALL choices. */
export function finishSpeakeasyLocation(original: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!matches(original, guard) || !original.active) return ruleFailure('INVALID_ACTION');
  const choices = original.active.restaurant;
  if (choices && (choices.current || choices.completed.length !== 2)) return ruleFailure('INVALID_ACTION');
  const result = finishSpeakeasyTurnActions(original.round, guard);
  if (!result.ok) return result;
  return success({...original, round: result.value});
}
export function drawSpeakeasyTurnCard(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!original.active) return ruleFailure('INVALID_ACTION');
  const result = drawSpeakeasyOperation(original.round, actor, input);
  if (!result.ok) return result;
  return success({...original, round: result.value, active: null});
}
export function settleSpeakeasyGameRound(original: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const result = settleSpeakeasyRound(original.round, guard);
  if (!result.ok) return result;
  return success({...original, round: result.value});
}

/** Server plan comes from the verified catalog/scheduled districts, never a client command. */
export function beginSpeakeasyMobWar(original: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard,
  plan: Pick<SpeakeasyLuciano, 'districts' | 'deck' | 'copDistricts' | 'payoutTables'>): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!matches(original, guard) || original.round.phase !== 'LUCIANO' || original.luciano) return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyGameFlow(original), r = s.round;
  if (r.clock.act === 4) return ruleFailure('INVALID_ACTION');
  s.luciano = startSpeakeasyLuciano({...plan, gameId: r.gameId, revision: r.revision + 1,
    act: r.clock.act, order: r.clock.order, economy: r.economy});
  r.revision = s.luciano.revision;
  return success(s);
}
function withLuciano(s: SpeakeasyGameFlow, result: SpeakeasyRuleResult<SpeakeasyLuciano>): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!result.ok) return result;
  return success({...s, luciano: result.value, round: {...s.round, economy: result.value.economy, revision: result.value.revision}});
}
export function advanceSpeakeasyMobWar(s: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!s.luciano || !matches(s, guard)) return ruleFailure('INVALID_ACTION');
  return withLuciano(s, advanceSpeakeasyLuciano(s.luciano, guard));
}
export function defendSpeakeasyGame(s: SpeakeasyGameFlow, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!s.luciano) return ruleFailure('INVALID_ACTION');
  return withLuciano(s, resolveSpeakeasyDefense(s.luciano, actor, input));
}
/** No new turn before police and payout finish. Identical Capos retire in stable pool order. */
export function beginSpeakeasyNextAct(original: SpeakeasyGameFlow, guard: SpeakeasyPhaseGuard): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if (!matches(original, guard) || original.round.phase !== 'LUCIANO' || original.luciano?.phase !== 'COMPLETE') return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyGameFlow(original), r = s.round;
  const act = r.clock.act === 1 ? 2 : r.clock.act === 2 ? 3 : r.clock.act === 3 ? 4 : null;
  if (!act) return ruleFailure('INVALID_ACTION');
  for (const p of s.capos) {
    const returned = p.placed.map(c => c.tileId);
    p.available = returned.splice(0, SPEAKEASY_ROUNDS[act - 1]);
    p.retired.push(...returned); p.placed = [];
  }
  s.round = startSpeakeasyRoundLifecycle({gameId: r.gameId, revision: r.revision + 1, economy: r.economy,
    decks: r.decks, clock: {act, round: 1, seat: 0, order: r.clock.order}});
  s.history.push(parseSpeakeasyLuciano(s.luciano));
  s.luciano = null;
  return success(s);
}

function restaurantActor(s: SpeakeasyGameFlow, actor: PlayerId, guard: SpeakeasyPhaseGuard): boolean {
  return matches(s, guard) && s.round.phase === 'PLAYING' && s.active?.playerId === actor && s.active.restaurant !== null;
}
export function chooseSpeakeasyRestaurantAction(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const parsed = v.safeParse(SpeakeasyRestaurantActionCommandSchema, input);
  if (!parsed.success || !restaurantActor(original, actor, parsed.output)) return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyGameFlow(original), choices = s.active!.restaurant!;
  if (choices.current || choices.completed.length === 2 || choices.completed.includes(parsed.output.action)) return ruleFailure('INVALID_ACTION');
  choices.current = {action: parsed.output.action, used: 0}; s.round.revision++;
  return success(s);
}
export function finishSpeakeasyRestaurantAction(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const parsed = v.safeParse(SpeakeasyRestaurantFinishCommandSchema, input);
  if (!parsed.success || !restaurantActor(original, actor, parsed.output)) return ruleFailure('INVALID_ACTION');
  const s = parseSpeakeasyGameFlow(original), choices = s.active!.restaurant!, current = choices.current;
  if (!current) return ruleFailure('INVALID_ACTION');
  choices.completed.push(current.action); choices.current = null; s.round.revision++;
  return success(s);
}
function restaurantEffect(original: SpeakeasyGameFlow, outcome: SpeakeasyRuleResult<SpeakeasyEconomy>): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const result = commitSpeakeasyRoundEconomy(original.round, original.round, outcome);
  if (!result.ok) return result;
  const s = parseSpeakeasyGameFlow(original); s.round = result.value;
  s.active!.restaurant!.current!.used++;
  return success(s);
}
/** Catalog and effect handlers are server-only; all choices in those effects must already be resolved. */
export function playSpeakeasyRestaurantCard(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown,
  effects: OperationEffects): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const parsed = v.safeParse(SpeakeasyRestaurantCardCommandSchema, input), current = original.active?.restaurant?.current;
  if (!parsed.success || !restaurantActor(original, actor, parsed.output) || current?.action !== 'OPERATION' || current.used !== 0) return ruleFailure('INVALID_ACTION');
  return restaurantEffect(original, playRestaurantOperation(original.round.economy, actor, parsed.output.cardId, effects));
}
export function cookSpeakeasyRestaurantBook(original: SpeakeasyGameFlow, actor: PlayerId, input: unknown,
  goals: readonly RestaurantBookGoal[]): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const parsed = v.safeParse(SpeakeasyRestaurantBookCommandSchema, input), current = original.active?.restaurant?.current;
  if (!parsed.success || !restaurantActor(original, actor, parsed.output) || current?.action !== 'BOOKS' || current.used >= 3) return ruleFailure('INVALID_ACTION');
  return restaurantEffect(original, cookRestaurantBook(original.round.economy, actor, parsed.output.goalId, parsed.output.space, goals));
}
