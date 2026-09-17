import type {PlayerId,TileId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow,type SpeakeasyGameFlow} from './game-flow.js';
import {speakeasyCandidate,speakeasyInventory,ruleFailure,type SpeakeasyEconomy,type SpeakeasyRuleResult} from './model.js';
import {cityTileInventory,cityTileDefinitions,type CityEffectState} from './city-tiles.js';
type EffectState=CityEffectState & {decks:SpeakeasyGameFlow['round']['decks']};
/** Server-resolved benefit. Additional choices must be fully resolved or return failure. */
export type SpeakeasyHelperEffect=(s:EffectState,actor:PlayerId)=>SpeakeasyRuleResult<EffectState>;
export function takeSpeakeasyHelper(original:SpeakeasyEconomy,actor:PlayerId,cardId:TileId) {
  return speakeasyCandidate(original,e=>{
    const p=e.players.find(p=>p.playerId===actor),index=e.helperDisplay.findIndex(h=>h.tileId===cardId);
    if(!p||index<0||!e.helperDeck.length) return 'INVALID_ACTION';
    p.helpers.push(e.helperDisplay[index]!);e.helperDisplay[index]=e.helperDeck.shift()!;return null;
  });
}
export function canUseSpeakeasyHelper(s:SpeakeasyGameFlow,actor:PlayerId):boolean {
  const r=s.round;
  return r.phase==='PLAYING'&&!s.active&&r.clock.order[r.clock.seat]===actor&&
    !s.helperUses.some(h=>h.playerId===actor&&h.act===r.clock.act&&h.round===r.clock.round);
}
function inventory(s:SpeakeasyGameFlow) {
  return JSON.stringify([...speakeasyInventory(s.round.economy),...cityTileInventory(s.city),...Object.values(s.round.decks).flatMap(d=>d.map(c=>c.tileId))].sort());
}
/** Authorization/revision is provided by player-command; no Capo or location action is consumed. */
export function useSpeakeasyHelper(original:SpeakeasyGameFlow,actor:PlayerId,cardId:TileId,
  effects:ReadonlyMap<TileId,SpeakeasyHelperEffect>|undefined):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if(!canUseSpeakeasyHelper(original,actor)) return ruleFailure('INVALID_ACTION');
  const effect=effects?.get(cardId),s=parseSpeakeasyGameFlow(original);
  const card=s.round.economy.players.find(p=>p.playerId===actor)!.helpers.find(h=>h.tileId===cardId);
  if(!card||card.used||!effect) return ruleFailure('INVALID_ACTION');
  card.used=true;
  const result=effect({economy:s.round.economy,city:s.city,decks:s.round.decks},actor);
  if(!result.ok) return result;
  s.round.economy=result.value.economy;s.round.decks=result.value.decks;s.city=result.value.city;
  for(const p of s.round.economy.players) {
    const held=s.city.held.find(h=>h.playerId===p.playerId);
    if(!held) throw new Error('Missing helper city owner.');p.cityTileCount=held.tiles.length;
  }
  if(inventory(original)!==inventory(s)||cityTileDefinitions(original.city)!==cityTileDefinitions(s.city)||
    JSON.stringify(original.city.played)!==JSON.stringify(s.city.played)) throw new Error('Invalid helper effect.');
  s.helperUses.push({playerId:actor,cardId,act:s.round.clock.act,round:s.round.clock.round});s.round.revision++;
  return {ok:true,value:parseSpeakeasyGameFlow(s)};
}
