import type {PlayerId,SpeakeasyPlayerCommand} from '@hangul-rummikub/shared';
import {raiseSpeakeasyLevel,speakeasyInfamy} from '../domain/economy.js';
import {parseSpeakeasyGameFlow,type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {commitSpeakeasyRoundEconomy} from '../domain/round-lifecycle.js';
import {cityTileInventory,cityTileDefinitions,type CityEffectState} from '../domain/city-tiles.js';
import {speakeasyInventory,ruleFailure,type SpeakeasyRuleResult} from '../domain/model.js';
import type {SpeakeasyLocationProgram} from '../domain/location-program.js';
import type {SpeakeasyCommandCatalog} from './player-command.js';

type EffectState=CityEffectState & {decks:SpeakeasyGameFlow['round']['decks']};
/** Server-resolved benefit only. Unresolved player choices must fail, never silently disappear. */
export type SpeakeasyInfamyBenefit=(state:EffectState,actor:PlayerId)=>SpeakeasyRuleResult<EffectState>;
type Command=Extract<SpeakeasyPlayerCommand,{type:'EXECUTE_LOCATION_ACTION'}>['command'];
type Action=Extract<SpeakeasyLocationProgram['rows'][number][number],{kind:'LEVEL'}>;
function inventory(s:SpeakeasyGameFlow) {
  return JSON.stringify([...speakeasyInventory(s.round.economy),...cityTileInventory(s.city),
    ...Object.values(s.round.decks).flatMap(deck=>deck.map(card=>card.tileId))].sort());
}
/** Authorized location action: cost, level, immediate infamy benefit and completion commit together. */
export function resolveSpeakeasyLevel(original:SpeakeasyGameFlow,actor:PlayerId,command:Command,
  action:Action,catalog:SpeakeasyCommandCatalog):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const choice=command.choice;
  if(choice.kind!=='LEVEL'||!action.operations.includes(choice.operation)) return ruleFailure('INVALID_ACTION');
  const s=parseSpeakeasyGameFlow(original);
  const raised=raiseSpeakeasyLevel(s.round.economy,actor,choice.operation,choice.discardIds);
  if(!raised.ok) return raised;
  const infamy=speakeasyInfamy(raised.value.players.find(p=>p.playerId===actor)!);
  if(!catalog.infamyBenefits?.has(infamy)) return ruleFailure('INVALID_ACTION');
  const benefit=catalog.infamyBenefits.get(infamy);
  // Return paid cards to their deck before a benefit can draw from that deck.
  const committed=commitSpeakeasyRoundEconomy(s.round,command,raised);
  if(!committed.ok) return committed;
  s.round=committed.value;
  const levels=JSON.stringify(s.round.economy.players.map(p=>p.levels));
  if(benefit) {
    const result=benefit({economy:s.round.economy,city:s.city,decks:s.round.decks},actor);
    if(!result.ok) return result;
    s.round.economy=result.value.economy;s.round.decks=result.value.decks;s.city=result.value.city;
  }
  for(const p of s.round.economy.players) {
    const held=s.city.held.find(h=>h.playerId===p.playerId);
    if(!held) throw new Error('Missing infamy city owner.');p.cityTileCount=held.tiles.length;
  }
  if(levels!==JSON.stringify(s.round.economy.players.map(p=>p.levels))||inventory(original)!==inventory(s)||
    cityTileDefinitions(original.city)!==cityTileDefinitions(s.city)||JSON.stringify(original.city.played)!==JSON.stringify(s.city.played)) throw new Error('Invalid infamy benefit.');
  s.locationActions!.completed.push(action.id);
  return {ok:true,value:parseSpeakeasyGameFlow(s)};
}
