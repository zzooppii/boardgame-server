import * as v from 'valibot';
import {parseSpeakeasyGameFlow, settleSpeakeasyGameRound, beginSpeakeasyMobWar,
  advanceSpeakeasyMobWar, beginSpeakeasyNextAct, type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {SpeakeasyActPlanSchema, startSpeakeasyLuciano} from '../domain/luciano.js';
import {speakeasyInventory, type SpeakeasyRuleResult} from '../domain/model.js';
import {cityTileInventory} from '../domain/city-tiles.js';

const PlansSchema = v.pipe(v.array(SpeakeasyActPlanSchema), v.length(3));
export type SpeakeasyActPlans = v.InferOutput<typeof PlansSchema>;

/** Private plans are fixed at game registration, never supplied by a player command. */
export function prepareSpeakeasyActPlans(initial: SpeakeasyGameFlow, input: unknown): SpeakeasyActPlans {
  const s = parseSpeakeasyGameFlow(initial), plans = v.parse(PlansSchema, input), r = s.round;
  if (r.clock.act !== 1 || r.clock.round !== 1 || r.clock.seat !== 0 || r.phase !== 'PLAYING' ||
    s.active || s.capos.some(p => p.placed.length)) throw new Error('Expected initial Speakeasy game.');
  const ids = [...speakeasyInventory(r.economy), ...cityTileInventory(s.city),
    ...Object.values(r.decks).flatMap(d => d.map(c => c.tileId)), ...s.capos.flatMap(p => [...p.available, ...p.retired])];
  const districts = new Set<number>(), cops = new Set<number>();
  for (const act of [1, 2, 3] as const) {
    const plan = plans[act - 1]!;
    startSpeakeasyLuciano({...plan, gameId:r.gameId, revision:r.revision, act, order:r.clock.order, economy:r.economy});
    if (plan.copDistricts.length !== 4) throw new Error('Expected four police districts per act.');
    for (const id of plan.districts) {
      if (districts.has(id)) throw new Error('Repeated scheduled mobster district.');
      districts.add(id);
    }
    for (const id of plan.copDistricts) {
      if (cops.has(id)) throw new Error('Repeated scheduled police district.');
      cops.add(id);
    }
    ids.push(...plan.deck.map(m => m.tileId));
  }
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate scheduled piece.');
  return plans;
}

/** Resolve forced transitions until another player decision or the final result is reached.
 * All work stays on a detached candidate. The command service commits this entire chain once.
 */
export function advanceSpeakeasyToDecision(original: SpeakeasyGameFlow, plans: SpeakeasyActPlans): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  let state = parseSpeakeasyGameFlow(original);
  // At most: round settlement + start + four reveals + police + payout + next act.
  for (let step = 0; step < 16; step++) {
    const round = state.round;
    let next: SpeakeasyRuleResult<SpeakeasyGameFlow>;
    if (round.phase === 'ROUND_END') next = settleSpeakeasyGameRound(state, round);
    else if (round.phase !== 'LUCIANO' || state.luciano?.phase === 'DEFENSE') return {ok:true, value:state};
    else if (!state.luciano) {
      const plan = plans[round.clock.act - 1];
      if (!plan) throw new Error('Missing Speakeasy act plan.');
      next = beginSpeakeasyMobWar(state, round, plan);
    } else if (state.luciano.phase === 'COMPLETE') next = beginSpeakeasyNextAct(state, round);
    else next = advanceSpeakeasyMobWar(state, round);
    if (!next.ok) return next;
    if (next.value.round.revision !== round.revision + 1) throw new Error('Invalid automatic transition.');
    state = next.value;
  }
  throw new Error('Speakeasy automatic transition limit exceeded.');
}
