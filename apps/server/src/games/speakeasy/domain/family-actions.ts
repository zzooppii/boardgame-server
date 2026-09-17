import type {PlayerId,SpeakeasyPlayerCommand} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow,type SpeakeasyGameFlow} from './game-flow.js';
import {cityTileInventory,cityTileDefinitions,type CityEffectState} from './city-tiles.js';
import {speakeasyInventory,ruleFailure,type SpeakeasyRuleResult} from './model.js';
import type {SpeakeasyLocationProgram} from './location-program.js';

type EffectState=CityEffectState & {decks:SpeakeasyGameFlow['round']['decks']};
/** Fully resolved, verified server bonus. Any unresolved choice must return failure. */
export type SpeakeasyDockBenefit=(state:EffectState,actor:PlayerId)=>SpeakeasyRuleResult<EffectState>;
type Command=Extract<SpeakeasyPlayerCommand,{type:'EXECUTE_LOCATION_ACTION'}>['command'];
type Action=Extract<SpeakeasyLocationProgram['rows'][number][number],{kind:'FAMILY'}>;
function inventory(s:SpeakeasyGameFlow) {
  return JSON.stringify([...speakeasyInventory(s.round.economy),...cityTileInventory(s.city),
    ...Object.values(s.round.decks).flatMap(deck=>deck.map(card=>card.tileId))].sort());
}
/** Called after location actor, revision and row authorization. All moves commit atomically. */
export function resolveSpeakeasyFamily(original:SpeakeasyGameFlow,actor:PlayerId,command:Command,
  action:Action,benefits:ReadonlyMap<string,SpeakeasyDockBenefit|null>|undefined):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if(command.choice.kind!=='FAMILY') return ruleFailure('INVALID_ACTION');
  const s=parseSpeakeasyGameFlow(original),p=s.round.economy.players.find(p=>p.playerId===actor)!;
  const member=p.familyReserve.shift();if(!member) return ruleFailure('CAPACITY');
  const target=command.choice.destination;
  if(target.kind==='VIP') {
    if(p.vip.length>=action.vipCapacityByLevel[p.levels.VIP-1]!) return ruleFailure('CAPACITY');
    p.vip.push(member);
  } else {
    const valid=(zone:number,space:number)=>action.docks.some(d=>d.zone===zone&&d.space===space);
    const occupied=(zone:number,space:number)=>s.round.economy.docks.some(d=>d.zone===zone&&d.space===space);
    const bonus=target.bonus??target;
    if(target.bonus&&(!p.crates.some(c=>c===11||c===12)||!valid(bonus.zone,bonus.space))) return ruleFailure('INVALID_ACTION');
    const key=`${bonus.zone}:${bonus.space}`;
    if(!valid(target.zone,target.space)||occupied(target.zone,target.space)||!benefits?.has(key)) return ruleFailure('INVALID_ACTION');
    const movable=new Set(s.round.economy.docks.filter(d=>d.ownerId===actor).map(d=>d.familyId));
    s.round.economy.docks.push({familyId:member,ownerId:actor,zone:target.zone,space:target.space});
    const benefit=benefits.get(key);
    if(benefit) {
      const result=benefit({economy:s.round.economy,city:s.city,decks:s.round.decks},actor);
      if(!result.ok) return result;
      s.round.economy=result.value.economy;s.round.decks=result.value.decks;s.city=result.value.city;
    }
    for(const move of target.moves) {
      const old=s.round.economy.docks.find(d=>d.familyId===move.familyId&&d.ownerId===actor);
      if(!old||!movable.has(move.familyId)||!valid(move.zone,move.space)||occupied(move.zone,move.space)) return ruleFailure('INVALID_ACTION');
      old.zone=move.zone;old.space=move.space;
    }
  }
  for(const player of s.round.economy.players) {
    const held=s.city.held.find(h=>h.playerId===player.playerId);
    if(!held) throw new Error('Missing family city owner.');player.cityTileCount=held.tiles.length;
  }
  if(inventory(original)!==inventory(s)||cityTileDefinitions(original.city)!==cityTileDefinitions(s.city)||
    JSON.stringify(original.city.played)!==JSON.stringify(s.city.played)) throw new Error('Invalid dock benefit.');
  s.round.revision++;s.locationActions!.completed.push(action.id);
  return {ok:true,value:parseSpeakeasyGameFlow(s)};
}
