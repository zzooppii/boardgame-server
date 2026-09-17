import {ambushSpeakeasyShip} from '../domain/ship-ambush.js';
import {resolveSpeakeasyFamily} from '../domain/family-actions.js';
import {resolveSpeakeasyLevel} from './level-command.js';
import type {PlayerId,SpeakeasyPlayerCommand} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow,placeSpeakeasyCapo,finishSpeakeasyLocation,type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {parseLocationProgress,availableLocationActions} from '../domain/location-program.js';
import {commitSpeakeasyRoundEconomy,speakeasyEffectivePosition} from '../domain/round-lifecycle.js';
import {buildSpeakeasy,hireSpeakeasyGoons,protectSpeakeasy,produceSpeakeasy,deliverSpeakeasy,sellSpeakeasy,speakeasyInfamy} from '../domain/economy.js';
import {playRestaurantOperation} from '../domain/restaurant-actions.js';
import {cityTileDefinitions} from '../domain/city-tiles.js';
import {speakeasyCandidate,ruleFailure,type SpeakeasyRuleResult,type SpeakeasyEconomy} from '../domain/model.js';
import type {SpeakeasyCommandCatalog} from './player-command.js';

type LocationInput=Extract<SpeakeasyPlayerCommand,{type:'EXECUTE_LOCATION_ACTION'|'SKIP_LOCATION_ACTION'|'FINISH_LOCATION_ACTIONS'}>;
export function placeAtSpeakeasyLocation(s:SpeakeasyGameFlow,actor:PlayerId,
  input:Extract<SpeakeasyPlayerCommand,{type:'PLACE_CAPO'}>,catalog:SpeakeasyCommandCatalog):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const source=catalog.locations?.get(input.command.spaceId);
  if(!source) return ruleFailure('INVALID_ACTION');
  const progress=parseLocationProgress({program:source,completed:[]});
  if(s.spaces.find(p=>p.id===input.command.spaceId)?.location!==progress.program.location||
    progress.program.rows.flat().some(a=>a.kind==='PROTECT'&&a.costByPosition.length!==s.round.clock.order.length)) throw new Error('Mismatched location program.');
  const placed=placeSpeakeasyCapo(s,actor,input.command);
  return placed.ok?{ok:true,value:parseSpeakeasyGameFlow({...placed.value,locationActions:progress})}:placed;
}
export function resolveSpeakeasyLocation(s:SpeakeasyGameFlow,actor:PlayerId,input:LocationInput,
  catalog:SpeakeasyCommandCatalog):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  if(s.round.phase!=='PLAYING'||s.active?.playerId!==actor||s.active.restaurant||!s.locationActions) return ruleFailure('INVALID_ACTION');
  if(input.type==='FINISH_LOCATION_ACTIONS') return finishSpeakeasyLocation(s,input.command);
  const action=availableLocationActions(s.locationActions).find(a=>a.id===input.command.actionId);
  if(!action) return ruleFailure('INVALID_ACTION');
  const candidate=parseSpeakeasyGameFlow(s);
  if(input.type==='SKIP_LOCATION_ACTION') {
    candidate.locationActions!.completed.push(action.id);candidate.round.revision++;
    return {ok:true,value:parseSpeakeasyGameFlow(candidate)};
  }
  const choice=input.command.choice;
  if(choice.kind!==action.kind) return ruleFailure('INVALID_ACTION');
  if(choice.kind==='FAMILY'&&action.kind==='FAMILY') return resolveSpeakeasyFamily(candidate,actor,input.command,action,catalog.dockBenefits);
  if(choice.kind==='LEVEL'&&action.kind==='LEVEL') return resolveSpeakeasyLevel(candidate,actor,input.command,action,catalog);
  let outcome:SpeakeasyRuleResult<SpeakeasyEconomy>;
  const player=candidate.round.economy.players.find(p=>p.playerId===actor)!;
  switch(choice.kind) {
    case 'AMBUSH': {
      if(action.kind!=='AMBUSH') return ruleFailure('INVALID_ACTION');
      outcome=ambushSpeakeasyShip(candidate.round.economy,actor,choice,action);break;
    }
    case 'FAMILY': case 'LEVEL': return ruleFailure('INVALID_ACTION');
    case 'PRODUCE': {
      if(action.kind!=='PRODUCE') return ruleFailure('INVALID_ACTION');
      outcome=produceSpeakeasy(candidate.round.economy,actor,action.quantityByLevel[player.levels.STILLS-1]!);break;
    }
    case 'SELL': {
      if(action.kind!=='SELL') return ruleFailure('INVALID_ACTION');
      const prices=action.pricesByInfamy[speakeasyInfamy(player)-5]!;
      outcome=sellSpeakeasy(candidate.round.economy,actor,choice.buildingIds,{...prices,limit:action.limitByLevel[player.levels.PARTY-1]!});break;
    }
    case 'DELIVER': {
      if(action.kind!=='DELIVER') return ruleFailure('INVALID_ACTION');
      const bonus=action.cardBonuses.filter(b=>player.operations.some(c=>c.tileId===b.cardId)).reduce((sum,b)=>sum+b.range,0);
      outcome=deliverSpeakeasy(candidate.round.economy,actor,choice.steps,{range:player.levels.FLEET+action.rangeBonus+bonus,edges:action.edges});break;
    }
    case 'BOOK': outcome=speakeasyCandidate(candidate.round.economy,e=>{
      const p=e.players.find(p=>p.playerId===actor)!;
      if(p.bookReserve===0) return 'CAPACITY';p.bookReserve--;p.books++;return null;
    });break;
    case 'GOONS': outcome=hireSpeakeasyGoons(candidate.round.economy,actor,choice.count,false,choice.cashToSpend);break;
    case 'PROTECT': {
      if(action.kind!=='PROTECT') return ruleFailure('INVALID_ACTION');
      const position=speakeasyEffectivePosition(candidate.round,actor);
      if(position===null) return ruleFailure('INVALID_ACTION');
      outcome=protectSpeakeasy(candidate.round.economy,actor,choice.buildingIds,action.costByPosition[position]!);break;
    }
    case 'OPERATION': {
      if(action.kind!=='OPERATION') return ruleFailure('INVALID_ACTION');
      const card=candidate.round.economy.players.find(p=>p.playerId===actor)!.hand.find(c=>c.tileId===choice.cardId);
      const effects=card&&catalog.operations.get(card.tileId);
      if(!card||card.operation==='STRENGTH'||!action.operations.includes(card.operation)||!effects) return ruleFailure('INVALID_ACTION');
      outcome=playRestaurantOperation(candidate.round.economy,actor,card.tileId,effects);break;
    }
    case 'BUILD': {
      if(action.kind!=='BUILD') return ruleFailure('INVALID_ACTION');
      for(const build of choice.builds) {
        const resolve=catalog.buildingBenefits?.get(build.pieceId);
        if(!resolve) return ruleFailure('INVALID_ACTION');
        const occupied=candidate.round.economy.districts[build.district-1]!.slots[build.slot]!==null;
        const {cashToSpend,...placement}=build;
        const built=buildSpeakeasy(candidate.round.economy,actor,{...placement,...(cashToSpend===undefined?{}:{cashToSpend})},{kinds:action.kinds,upgrade:action.upgrade});
        if(!built.ok) return built;
        candidate.round.economy=built.value;
        const cityAt=candidate.city.buildings.findIndex(t=>t.district===build.district&&t.slot===build.slot);
        if(!occupied&&cityAt>=0) candidate.city.held.find(p=>p.playerId===actor)!.tiles.push(candidate.city.buildings.splice(cityAt,1)[0]!.tile);
        candidate.round.economy.players.find(p=>p.playerId===actor)!.cityTileCount=candidate.city.held.find(p=>p.playerId===actor)!.tiles.length;
        const bonus=resolve({economy:candidate.round.economy,city:candidate.city},actor);
        if(!bonus.ok) return bonus;
        candidate.round.economy=bonus.value.economy;candidate.city=bonus.value.city;
      }
      outcome={ok:true,value:candidate.round.economy};break;
    }
  }
  if(!outcome.ok) return outcome;
  for(const p of outcome.value.players) {
    const held=candidate.city.held.find(owner=>owner.playerId===p.playerId);
    if(!held) throw new Error('Missing location city owner.');p.cityTileCount=held.tiles.length;
  }
  if(cityTileDefinitions(s.city)!==cityTileDefinitions(candidate.city)||JSON.stringify(s.city.played)!==JSON.stringify(candidate.city.played)) throw new Error('Location city conservation.');
  const committed=commitSpeakeasyRoundEconomy(s.round,input.command,outcome);
  if(!committed.ok) return committed;
  candidate.round=committed.value;candidate.locationActions!.completed.push(action.id);
  return {ok:true,value:parseSpeakeasyGameFlow(candidate)};
}
