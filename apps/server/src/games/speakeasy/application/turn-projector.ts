import * as v from 'valibot';
import {availableLocationActions} from '../domain/location-program.js';
import {SpeakeasyTurnViewSchema, type SpeakeasyTurnView, type PlayerId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow, type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {cityReturnsNeeded,speakeasyCityTileLimit} from '../domain/city-tiles.js';
import {speakeasyDefenseActor} from '../domain/luciano.js';

function stage(s: SpeakeasyGameFlow): SpeakeasyTurnView['stage'] {
  if (s.awaitingCityReturn) return 'RETURN_CITY';
  if (s.round.phase !== 'PLAYING') return s.round.phase;
  if (!s.active) return 'PLACE_CAPO';
  if (!s.active.restaurant) return s.locationActions&&!availableLocationActions(s.locationActions).length?'FINISH_LOCATION':'LOCATION';
  if (s.active.restaurant.completed.length === 2) return 'FINISH_LOCATION';
  return s.active.restaurant.current ? 'RESTAURANT_ACTION' : 'RESTAURANT_CHOICE';
}

/** The caller supplies an authenticated player identity, never a request's claimed viewerId.
 * Explicit allowlisting keeps hands, future draws, buried/face-down tiles and history private.
 * This projection does not grant permission to execute a command.
 */
export function projectSpeakeasyTurn(original: SpeakeasyGameFlow, viewer: PlayerId): SpeakeasyTurnView | null {
  if (!original.round.clock.order.includes(viewer)) return null;
  const s = parseSpeakeasyGameFlow(original), r = s.round;
  const self = r.economy.players.find(p => p.playerId === viewer)!;
  const held = s.city.held.find(p => p.playerId === viewer)!.tiles;
  const currentStage = stage(s);
  const actorId = ['PLAYING','DRAW_OPERATION'].includes(r.phase) ? r.clock.order[r.clock.seat]! :
    s.luciano ? speakeasyDefenseActor(s.luciano) : null;
  const returning = currentStage === 'RETURN_CITY' && actorId === viewer;
  const played = s.active?.playerId === viewer ? s.city.played : [];
  const excess = held.length - played.length > speakeasyCityTileLimit(r.economy,viewer);
  return v.parse(SpeakeasyTurnViewSchema, {
    gameId:r.gameId, revision:r.revision, viewerId:viewer,
    act:r.clock.act, round:r.clock.round, stage:currentStage, actorId,
    order:r.clock.order, lowerRow:r.lowerRow,
    spaces:s.spaces.map(space => ({id:space.id,location:space.location,
      occupants:s.capos.flatMap(p => p.placed.filter(c => c.spaceId === space.id).map(c => ({playerId:p.playerId,capoId:c.tileId})))})),
    active:s.active ? {playerId:s.active.playerId,capoId:s.active.capoId,spaceId:s.active.spaceId} : null,
    restaurant:s.active?.restaurant ?? null,
    locationActions:s.locationActions?{rows:s.locationActions.program.rows.map(row=>row.map(a=>({id:a.id,kind:a.kind,
      status:s.locationActions!.completed.includes(a.id)?'DONE':availableLocationActions(s.locationActions!).some(next=>next.id===a.id)?'AVAILABLE':'WAITING'}))),
      canFinish:r.phase==='PLAYING'&&s.active?.playerId===viewer&&availableLocationActions(s.locationActions).length===0}:null,
    market:{middle:s.city.middle.map(pile => ({count:pile.length,top:pile[0] ?? null})),
      right:s.city.right, supplyCounts:s.city.supply.map(pile => pile.length)},
    self:{cash:self.cash,safe:self.safe,availableCapos:s.capos.find(p => p.playerId === viewer)!.available,
      hand:self.hand.map(card => ({tileId:card.tileId,operation:card.operation,leverage:card.leverage})),
      cityTiles:held.map(tile => ({tileId:tile.tileId,effectId:tile.effectId,used:played.includes(tile.tileId)})),
      drawDecks:currentStage === 'DRAW_OPERATION' && actorId === viewer ?
        (['VIP','PARTY','STILLS','FLEET'] as const).filter(deck => r.decks[deck].length > 0) : [],
      returnCount:returning ? cityReturnsNeeded(s.city,viewer,speakeasyCityTileLimit(r.economy,viewer)) : 0,
      mandatoryReturnIds:returning ? played : [],
      eligibleReturnIds:returning ? held.filter(tile => excess || played.includes(tile.tileId)).map(tile => tile.tileId) : [],
      firstReturnRows:returning ? ([0,1,2] as const).filter(row => s.city.middle[row]!.length === Math.min(...s.city.middle.map(p => p.length))) : [],
    },
  });
}
