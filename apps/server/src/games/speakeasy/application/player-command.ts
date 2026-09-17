import type {SpeakeasyDockBenefit} from '../domain/family-actions.js';
import type {SpeakeasyInfamyBenefit} from './level-command.js';
import {safeParse} from 'valibot';
import {placeAtSpeakeasyLocation,resolveSpeakeasyLocation} from './location-command.js';
import type {SpeakeasyLocationProgram} from '../domain/location-program.js';
import {SpeakeasyPlayerCommandSchema, type SpeakeasyPlayerCommand, type SpeakeasyBoardView,
  type PlayerId, type TileId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow, placeSpeakeasyCapo, chooseSpeakeasyRestaurantAction,
  finishSpeakeasyRestaurantAction, playSpeakeasyRestaurantCard, cookSpeakeasyRestaurantBook,
  playSpeakeasyCityTile, finishSpeakeasyLocation, drawSpeakeasyTurnCard,
  returnSpeakeasyTurnCityTiles, defendSpeakeasyGame, type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {type SpeakeasyRuleResult, ruleFailure} from '../domain/model.js';
import type {OperationEffects, RestaurantBookGoal} from '../domain/restaurant-actions.js';
import type {CityTileEffect,CityEffectState} from '../domain/city-tiles.js';
import {projectSpeakeasyBoard} from './board-projector.js';
import {speakeasyFixedBookGoals} from '../domain/fixed-goals.js';

/** Validated server catalog only. Instance IDs resolve to server handlers, never client effects. */
export type SpeakeasyCommandCatalog = Readonly<{
  operations: ReadonlyMap<TileId, OperationEffects>;
  city: readonly CityTileEffect[];
  /** Verified tile goals for this game. Printed board goals are added internally. */
  goals: readonly RestaurantBookGoal[];
  /** Every reachable infamy space must explicitly define a resolved benefit or null (no benefit). */
  infamyBenefits?: ReadonlyMap<number,SpeakeasyInfamyBenefit|null>;
  dockBenefits?: ReadonlyMap<string,SpeakeasyDockBenefit|null>;
  locations?: ReadonlyMap<string,SpeakeasyLocationProgram>;
  buildingBenefits?: ReadonlyMap<TileId,(s:CityEffectState,actor:PlayerId)=>SpeakeasyRuleResult<CityEffectState>>;
}>;
export type PreparedSpeakeasyCommand =
  | {ok: true; candidate: SpeakeasyGameFlow; actorView: SpeakeasyBoardView}
  | {ok: false; reason: 'INVALID_ACTION'};

/** Pure preparation, NOT persistence or authentication. Call within the existing room serializer,
 * after session/room checks. Commit candidate + receipt atomically before sending actorView.
 * candidate is private server state and must never be serialized to a client.
 * Unexpected invariant/catalog failures propagate to the service's internal-error boundary.
 */
export function prepareSpeakeasyPlayerCommand(original: SpeakeasyGameFlow, actor: PlayerId,
  input: unknown, catalog: SpeakeasyCommandCatalog): PreparedSpeakeasyCommand {
  const parsed = safeParse(SpeakeasyPlayerCommandSchema, input);
  const denied = {ok: false, reason: 'INVALID_ACTION'} as const;
  if (!parsed.success || !original.round.clock.order.includes(actor)) return denied;
  const {gameId, revision} = parsed.output.command;
  if (original.round.gameId !== gameId || original.round.revision !== revision) return denied;
  // Detached validated state protects live data even when a server handler mutates then fails.
  const source = parseSpeakeasyGameFlow(original);
  const result = dispatch(source, actor, parsed.output, catalog);
  if (!result.ok) return denied;
  const candidate = parseSpeakeasyGameFlow(result.value);
  if (candidate.round.gameId !== gameId || candidate.round.revision !== revision + 1) {
    throw new Error('Invalid Speakeasy command transition.');
  }
  const actorView = projectSpeakeasyBoard(candidate, actor);
  if (!actorView) throw new Error('Missing Speakeasy command recipient.');
  return {ok: true, candidate, actorView};
}

function dispatch(s: SpeakeasyGameFlow, actor: PlayerId, input: SpeakeasyPlayerCommand,
  catalog: SpeakeasyCommandCatalog): SpeakeasyRuleResult<SpeakeasyGameFlow> {
  switch (input.type) {
    case 'PLACE_CAPO':
      if (s.spaces.find(space => space.id === input.command.spaceId)?.location !== 'RESTAURANT') return placeAtSpeakeasyLocation(s,actor,input,catalog);
      return placeSpeakeasyCapo(s, actor, input.command);
    case 'EXECUTE_LOCATION_ACTION': case 'SKIP_LOCATION_ACTION': case 'FINISH_LOCATION_ACTIONS':
      return resolveSpeakeasyLocation(s,actor,input,catalog);
    case 'CHOOSE_RESTAURANT_ACTION': return chooseSpeakeasyRestaurantAction(s, actor, input.command);
    case 'FINISH_RESTAURANT_ACTION': return finishSpeakeasyRestaurantAction(s, actor, input.command);
    case 'PLAY_OPERATION': {
      const card = s.round.economy.players.find(p => p.playerId === actor)?.hand.find(c => c.tileId === input.command.cardId);
      const effects = card && catalog.operations.get(card.tileId);
      if (!effects) return ruleFailure('INVALID_ACTION');
      return playSpeakeasyRestaurantCard(s, actor, input.command, effects);
    }
    case 'USE_CITY_TILE': return playSpeakeasyCityTile(s, actor, input.command, catalog.city);
    case 'PLACE_BOOK': return cookSpeakeasyRestaurantBook(s, actor, input.command, [...speakeasyFixedBookGoals(), ...catalog.goals]);
    case 'FINISH_RESTAURANT':
      // finishSpeakeasyLocation is a server hook; authorize the actor and restrict its public use.
      if (s.active?.playerId !== actor || !s.active.restaurant || s.round.phase !== 'PLAYING') return ruleFailure('INVALID_ACTION');
      return finishSpeakeasyLocation(s, input.command);
    case 'DRAW_OPERATION': return drawSpeakeasyTurnCard(s, actor, input.command);
    case 'RETURN_CITY_TILES': return returnSpeakeasyTurnCityTiles(s, actor, input.command);
    case 'DEFEND': return defendSpeakeasyGame(s, actor, input.command);
  }
}
