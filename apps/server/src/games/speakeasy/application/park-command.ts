import type {PlayerId,SpeakeasyPlayerCommand} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow,placeSpeakeasyCapo,type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {takeAvailableCityTile} from '../domain/city-tiles.js';
import {speakeasyCandidate,ruleFailure,type SpeakeasyRuleResult} from '../domain/model.js';
import {placeAtSpeakeasyLocation} from './location-command.js';
import type {SpeakeasyCommandCatalog} from './player-command.js';

/** Commands have passed the shared schema and game/revision guard in player-command. */
export function exchangeSpeakeasyCapo(original:SpeakeasyGameFlow,actor:PlayerId,
  input:Extract<SpeakeasyPlayerCommand,{type:'EXCHANGE_CAPO'}>,catalog:SpeakeasyCommandCatalog):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if(original.round.phase!=='PLAYING'||original.active||original.parkBenefit||original.round.clock.order[original.round.clock.seat]!==actor) return ruleFailure('INVALID_ACTION');
  const c=input.command,s=parseSpeakeasyGameFlow(original);
  const displaced=s.capos.find(p=>p.playerId!==actor&&p.placed.some(t=>t.tileId===c.targetCapoId));
  const target=displaced?.placed.find(t=>t.tileId===c.targetCapoId);
  const destination=target&&s.spaces.find(space=>space.id===target.spaceId);
  if(!displaced||!target||!destination||destination.location==='PARK'||
    s.spaces.find(space=>space.id===c.parkSpaceId)?.location!=='PARK'||
    s.capos.some(p=>p.placed.some(t=>t.spaceId===c.parkSpaceId))) return ruleFailure('INVALID_ACTION');
  // Moving the opponent preserves their placement count and frees the target atomically.
  target.spaceId=c.parkSpaceId;
  const placement={gameId:c.gameId,revision:c.revision,capoId:c.capoId,spaceId:destination.id,
    ...(c.restaurant===undefined?{}:{restaurant:c.restaurant})};
  const placed=destination.location==='RESTAURANT'?placeSpeakeasyCapo(s,actor,placement):
    placeAtSpeakeasyLocation(s,actor,{type:'PLACE_CAPO',command:placement},catalog);
  if(!placed.ok) return placed;
  placed.value.parkBenefit={playerId:displaced.playerId,capoId:target.tileId,spaceId:c.parkSpaceId};
  return {ok:true,value:parseSpeakeasyGameFlow(placed.value)};
}

export function chooseSpeakeasyParkBenefit(original:SpeakeasyGameFlow,actor:PlayerId,
  command:Extract<SpeakeasyPlayerCommand,{type:'CHOOSE_PARK_BENEFIT'}>['command']):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if(original.round.phase!=='PLAYING'||original.parkBenefit?.playerId!==actor) return ruleFailure('INVALID_ACTION');
  const s=parseSpeakeasyGameFlow(original),choice=command.choice;
  if(choice.kind==='CITY_TILE') {
    const taken=takeAvailableCityTile(s.city,actor,choice.column,choice.row,choice.refill);
    if(!taken.ok) return taken;
    s.city=taken.value;
    s.round.economy.players.find(p=>p.playerId===actor)!.cityTileCount=s.city.held.find(p=>p.playerId===actor)!.tiles.length;
  } else if(choice.kind!=='SKIP') {
    const result=speakeasyCandidate(s.round.economy,e=>{
      const p=e.players.find(p=>p.playerId===actor)!;
      if(choice.kind==='BOOK') {
        if(p.bookReserve===0) return 'CAPACITY';
        p.bookReserve--;p.books++;
      } else {
        if(p.leverageTokens===20) return 'CAPACITY';
        p.leverageTokens++;
      }
      return null;
    });
    if(!result.ok) return result;
    s.round.economy=result.value;
  }
  s.parkBenefit=null;s.round.revision++;
  return {ok:true,value:parseSpeakeasyGameFlow(s)};
}
