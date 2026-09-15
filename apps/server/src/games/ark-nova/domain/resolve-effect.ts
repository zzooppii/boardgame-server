import * as v from 'valibot';
import { ArkEffectSelectionSchema, ARK_BUILDINGS, arkShape, arkPlacementReason, ARK_CARDS, type ArkBuilding, type ArkActionCard, type ArkCard } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { beginArkResistance, resolveArkResistance, takeArkReserveProject, type ArkGoalZones } from './reserve-card-choices.js';
import { playArkZooCard } from './card-play.js';
import { arkCardEntryEffects } from './card-entry-effects.js';
import { assertArkZooMap } from './zoo-map.js';
import { arkZooIcons } from './zoo-icons.js';
import { evaluateArkEffectAmount, type ArkZooEffect } from './animal-effects.js';
import { ArkEffectQueueSchema, completeArkEffect, type ArkEffectQueue, type ArkEffectBatch } from './effect-queue.js';
import { beginArkCardReveal, resolveArkCardReveal, tradeArkHandCards, type ArkCardEffectZones } from './card-effect-choices.js';
import { arkSponsorIconTriggers } from './sponsor-effects.js';
import { acquireArkAssociationTile, arkReputationAdvance } from './association.js';
import { arkConservationAdvance, chooseArkConservationBonus, type ArkConservationBonusPool } from './conservation-bonuses.js';
import { drawArkCards, takeArkDisplayCard, replenishArkDisplay } from './card-zones.js';
import { arkEnclosuresToEmpty, occupyArkAnimalHousing } from './animal-housing.js';
import { arkNewBuildingEffects, arkPlacementBonusEffect, arkUncoveredPlacementBonuses } from './construction-effects.js';
import { arkReputationRange } from './build-turn.js';
export type ArkEffectState=ArkCardEffectZones & ArkGoalZones & {
  multiplayer?:{breakAdvance:number;otherZoo:ArkCard[];otherPartners?:string[];otherUniversities?:string[]}|undefined;
  conservationChoices?:{track:2|5|8|10;choice:string}[]|undefined;
  supportedProjects:number;buildings:ArkBuilding[];baseProjectReserve:ArkCard[];
  effects:ArkEffectQueue;played:ArkCard[];pouched:Record<string,ArkCard[]>;sponsorTokens:Record<string,number>;
  actions:ArkActionCard[];partners:string[];universities:string[];partnerSupply:string[];universitySupply:string[];goals:ArkCard[];discardedGoals:ArkCard[];
  money:number;appeal:number;conservation:number;reputation:number;x:number;workers:number;
  wazaFocus:'SMALL'|'LARGE'|null;conservationBonuses:ArkConservationBonusPool;
};
export type ArkEffectResolution<T>={ok:true;state:T;waiting:boolean}|{ok:false;reason:'INVALID_CHOICE'|'UNSUPPORTED_EFFECT'};
/** Pure candidate executor. Actor, revision and choice ownership belong to the enclosing game transaction.
 * Unsupported effects stay active; the caller must dispatch their specialized action/build/project handler.
 */
export function resolveArkEffect<T extends ArkEffectState>(current:T,effectId:number,input:unknown,choiceId:string,random:RandomSource):ArkEffectResolution<T> {
  const queue=v.parse(ArkEffectQueueSchema,current.effects),job=queue.active,selected=v.safeParse(ArkEffectSelectionSchema,input);
  const invalid=():ArkEffectResolution<T>=>({ok:false,reason:'INVALID_CHOICE'});
  if(!job||job.id!==effectId||!selected.success)return invalid();
  const a=selected.output,effect=job.effect;
  let s=structuredClone(current);
  const children:ArkEffectBatch[]=[],continuation:ArkEffectBatch[]=[];
  const enqueue=(effect:ArkZooEffect)=>children.push({sourceId:job.sourceId,effect,timing:'IMMEDIATE'});
  if(current.cardReveal&& !['HUNTER','SCAVENGING','PERCEPTION'].includes(effect.kind))return invalid();
  if(current.goalReveal&&effect.kind!=='RESISTANCE')return invalid();
  switch(effect.kind) {
    case 'WAZA_PLAY': {
      if(a.kind!=='SKIP') {
        if(a.kind!=='ANIMAL'||!s.hand.some(c=>c.cardId===a.card.cardId))return invalid();
        const held=s.hand.find(c=>c.cardId===a.card.cardId)!,definition=ARK_CARDS.find(c=>c.key===held.key);
        if(!definition||definition.kind!=='ANIMAL'||definition.size>2)return invalid();
        const result=playArkZooCard(s,{kind:'ANIMAL',upgraded:effect.upgraded,remaining:1,paySponsorLevel:false},a.card);
        if(!result.ok)return invalid();
        children.push(...arkCardEntryEffects(s,result.state,result.card));s=result.state;
      }
      continuation.push({sourceId:job.sourceId,effect:{kind:'WAZA_SNAP'},timing:'IMMEDIATE'});break;
    }
    case 'WAZA_SNAP': {
      const candidates=s.display.filter(c=>c!==null&&ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL'&&d.size<=2));
      if(a.kind==='NONE'&&candidates.length===0)break;
      if(a.kind!=='CARD'||a.refill||a.cardId===null||!candidates.some(c=>c!.cardId===a.cardId))return invalid();
      const index=s.display.findIndex(c=>c?.cardId===a.cardId);s.hand.push(s.display[index]!);s.display[index]=null;break;
    }
    case 'ARCHAEOLOGIST': {
      const available=arkUncoveredPlacementBonuses(s.buildings);
      if(a.kind==='NONE'&&available.length===0)break;
      if(a.kind!=='MAP_BONUS')return invalid();
      const cell=available.find(c=>c.q===a.cell.q&&c.r===a.cell.r);
      if(!cell||cell.bonus===null)return invalid();
      enqueue(arkPlacementBonusEffect(cell.bonus));break;
    }
    case 'MULTIPLIER': {
      if(a.kind!=='MULTIPLIER'||effect.action!==null&&a.action!==effect.action)return invalid();
      const card=s.actions.find(c=>c.kind===a.action);if(!card||!Number.isSafeInteger(card.multiplier+1))return invalid();
      card.multiplier++;break;
    }
    case 'PAID_SPONSOR': {
      if(a.kind==='SKIP')break;
      if(a.kind!=='SPONSOR')return invalid();
      const source=s.played.find(c=>c.cardId===job.sourceId),tokens=Object.hasOwn(s.sponsorTokens,job.sourceId)?s.sponsorTokens[job.sourceId]!:0;
      if(effect.usesSponsorToken&&(source?.key!=='253'||tokens<1))return invalid();
      const played=playArkZooCard(s,{kind:'SPONSOR',upgraded:s.actions.some(c=>c.kind==='SPONSORS'&&c.upgraded),remaining:10000,paySponsorLevel:true},a.card);
      if(!played.ok)return invalid();
      children.push(...arkCardEntryEffects(s,played.state,played.card));s=played.state;
      if(effect.usesSponsorToken)s.sponsorTokens[job.sourceId]=tokens-1;
      assertArkZooMap(s.buildings,s.played,s.actions.some(c=>c.kind==='BUILD'&&c.upgraded));break;
    }
    case 'FREE_PARTNER':case 'FREE_UNIVERSITY': {
      const upgraded=s.actions.some(c=>c.kind==='ASSOCIATION'&&c.upgraded);
      const available=effect.kind==='FREE_PARTNER'?(s.partners.length<(upgraded?4:2)?s.partnerSupply:[]):s.universitySupply;
      if(a.kind==='NONE'&&available.length===0)break;
      if(effect.kind==='FREE_PARTNER'?a.kind!=='PARTNER':a.kind!=='UNIVERSITY')return invalid();
      if(a.kind!=='PARTNER'&&a.kind!=='UNIVERSITY')return invalid();
      const previous=arkZooIcons(s.played,s.partners,s.universities),rewards=acquireArkAssociationTile(s,upgraded,a,choiceId);if(!rewards)return invalid();
      for(const reward of rewards) {
        if(reward.kind==='UPGRADE'||reward.kind==='UPGRADE_OR_WORKER')enqueue({kind:reward.kind});
        else if(reward.kind==='CARD')enqueue({kind:'CARD_PICK',amount:reward.amount});
        else enqueue({kind:'GAIN',resource:reward.kind,amount:reward.amount});
      }
      const after=arkZooIcons(s.played,s.partners,s.universities),added=Object.fromEntries(Object.entries(after).map(([tag,n])=>[tag,n-(previous[tag]??0)]));
      children.push(...arkSponsorIconTriggers(s,added,previous));break;
    }
    case 'MOVE_TO_SPECIAL': {
      if(a.kind==='SKIP')break;
      if(a.kind!=='MOVE_ANIMAL'||effect.moved.includes(a.cardId))return invalid();
      const card=s.played.find(c=>c.cardId===a.cardId),animal=ARK_CARDS.find(d=>d.key===card?.key&&d.kind==='ANIMAL');
      const destination=s.buildings.find(b=>b.id===effect.buildingId),ignoreTerrain=s.played.some(c=>c.key==='219');
      if(!animal||!destination||!['ReptileHouse','LargeBirdAviary'].includes(destination.kind)||
        (a.housingId===null?arkEnclosuresToEmpty(s.buildings,animal,ignoreTerrain).length>0:!arkEnclosuresToEmpty(s.buildings,animal,ignoreTerrain).includes(a.housingId)))return invalid();
      const occupied=occupyArkAnimalHousing(s.buildings,animal,destination.id,ignoreTerrain);if(!occupied.ok)return invalid();
      s.buildings=occupied.buildings;if(a.housingId!==null)s.buildings.find(b=>b.id===a.housingId)!.occupied=false;
      enqueue({...effect,moved:[...effect.moved,a.cardId]});break;
    }
    case 'FREE_BUILD': {
      if(a.kind==='SKIP')break;
      if(a.kind!=='BUILD'||effect.amount<1||!effect.buildings.includes(a.placement.building))return invalid();
      const kind=a.placement.building,definition=Object.hasOwn(ARK_BUILDINGS,kind)?ARK_BUILDINGS[kind]:undefined;
      const upgraded=s.actions.some(c=>c.kind==='BUILD'&&c.upgraded);
      if(!definition||!upgraded&&!effect.ignoreBuildUpgrade&&['ReptileHouse','LargeBirdAviary'].includes(kind))return invalid();
      const cells=arkShape(kind,a.placement.anchor,a.placement.rotation,a.placement.reflected);
      // The special-building permission does not upgrade restricted map spaces.
      if(arkPlacementReason(s.buildings,kind,cells,upgraded,s.played.some(c=>c.key==='219'))!==null)return invalid();
      const building={id:`effect-building:${choiceId}`,kind,cells,occupied:false,used:0};
      if(s.buildings.some(b=>b.id===building.id))return invalid();
      arkNewBuildingEffects(s.buildings,building,s.played).forEach(enqueue);s.buildings.push(building);
      if(['ReptileHouse','LargeBirdAviary'].includes(kind))enqueue({kind:'MOVE_TO_SPECIAL',buildingId:building.id,moved:[]});
      if(effect.amount>1)continuation.push({sourceId:job.sourceId,effect:{...effect,amount:effect.amount-1},timing:'IMMEDIATE'});
      break;
    }
    case 'RESISTANCE': {
      if(s.goalReveal) {
        if(a.kind!=='KEEP_GOAL')return invalid();
        const result=resolveArkResistance(s,{choiceId:a.choiceId,keep:a.keep});if(!result.ok)return invalid();s=result.state;
      } else {
        if(a.kind!=='NONE'||s.cardReveal)return invalid();
        const result=beginArkResistance(s,choiceId);if(!result.ok)return invalid();return {ok:true,state:result.state,waiting:true};
      }
      break;
    }
    case 'ASSERTION':case 'DOMINANCE': {
      if(a.kind!=='PROJECT')return invalid();
      const result=takeArkReserveProject(s,effect.kind,{cardId:a.cardId});if(!result.ok)return invalid();s=result.state;break;
    }
    case 'HUNTER':case 'SCAVENGING':case 'PERCEPTION': {
      if(s.cardReveal) {
        if(a.kind!=='KEEP')return invalid();
        const result=resolveArkCardReveal(s,{choiceId:a.choiceId,keep:a.keep});if(!result.ok)return invalid();s=result.state;
      } else {
        if(a.kind!=='NONE')return invalid();
        const revealed=beginArkCardReveal(s,effect,choiceId,random);if(!revealed.ok)return invalid();s=revealed.state;
        if(s.cardReveal)return {ok:true,state:s,waiting:true};
      }
      break;
    }
    case 'POUCH':case 'SUNBATHING': {
      if(a.kind!=='CARDS')return invalid();
      const traded=tradeArkHandCards(s,effect.kind,effect.amount,job.sourceId,{cards:a.cards});if(!traded.ok)return invalid();s=traded.state;break;
    }
    case 'DIGGING': {
      if(a.kind==='SKIP')break;
      if(a.kind!=='DIG'||effect.amount===0)return invalid();
      if(a.zone==='DISPLAY') {
        const slot=s.display.findIndex(c=>c?.cardId===a.cardId);if(slot<0)return invalid();
        s.discarded.push(s.display[slot]!);s.display[slot]=null;replenishArkDisplay(s);
      } else {
        const index=s.hand.findIndex(c=>c.cardId===a.cardId);if(index<0||!s.zooDeck.length)return invalid();
        s.discarded.push(...s.hand.splice(index,1));drawArkCards(s,1);
      }
      if(effect.amount>1)enqueue({...effect,amount:effect.amount-1});break;
    }
    case 'SPONSOR_MAGNET': {
      if(a.kind!=='NONE')return invalid();
      for(const card of s.display.filter(c=>c!==null)) {
        // Project cards also occur in the display; they are not zoo-card definitions.
        if(ARK_CARDS.some(d=>d.key===card.key&&d.kind==='SPONSOR'))takeArkDisplayCard(s,card.cardId,6);
      }
      break;
    }
    case 'BREAK':if(a.kind!=='NONE'||!s.multiplayer)return invalid();s.multiplayer.breakAdvance+=effect.amount;break;
    case 'DRAW':
      if(a.kind!=='NONE')return invalid();drawArkCards(s,effect.amount);break;
    case 'GAIN': {
      if(a.kind!=='NONE')return invalid();
      const all=typeof effect.amount==='object'&&effect.amount.kind==='ICONS'&&effect.amount.scope==='ALL';
      const amount=evaluateArkEffectAmount(effect.amount,arkZooIcons(all?[...s.played,...(s.multiplayer?.otherZoo??[])]:s.played,all?[...s.partners,...(s.multiplayer?.otherPartners??[])]:s.partners,all?[...s.universities,...(s.multiplayer?.otherUniversities??[])]:s.universities));
      switch(effect.resource) {
        case 'MONEY':s.money+=amount;break;
        case 'APPEAL':s.appeal=Math.min(113,s.appeal+amount);break;
        case 'X':s.x=Math.min(5,s.x+amount);break;
        case 'WORKER':s.workers=Math.min(4,s.workers+amount);break;
        case 'REPUTATION': {
          const advanced=arkReputationAdvance(s.reputation,amount,s.actions,choiceId);
          s.reputation=advanced.reputation;s.appeal=Math.min(113,s.appeal+advanced.appeal);
          for(const reward of advanced.rewards) {
            if(reward.kind==='CARD')enqueue({kind:'CARD_PICK',amount:reward.amount});
            else if(reward.kind==='UPGRADE'||reward.kind==='UPGRADE_OR_WORKER')enqueue({kind:reward.kind});
            else enqueue({kind:'GAIN',resource:reward.kind,amount:reward.amount});
          }
          break;
        }
        case 'CONSERVATION': {
          const advanced=arkConservationAdvance(s.conservation,amount);s.conservation=advanced.conservation;
          for(const track of advanced.milestones) {
            if(track===2)enqueue({kind:'UPGRADE_OR_WORKER'});
            else if(track===10) {if(!s.multiplayer&&s.goals.length>1)enqueue({kind:'DISCARD_GOAL'});}
            else enqueue({kind:'CONSERVATION_BONUS',track});
          }
          break;
        }
      }
      break;
    }
    case 'CARD_PICK':case 'SNAP': {
      if(effect.amount===0) {if(a.kind!=='NONE')return invalid();break;}
      if(a.kind!=='CARD'||a.refill&&(effect.kind!=='SNAP'||!effect.mayRefillBetween||effect.amount<2))return invalid();
      if(a.cardId===null) {
        if(effect.kind==='SNAP'||!s.zooDeck.length)return invalid();drawArkCards(s,1);
      } else if(!takeArkDisplayCard(s,a.cardId,effect.kind==='SNAP'?6:arkReputationRange(s.reputation)))return invalid();
      if(effect.amount>1) {
        if(effect.kind==='SNAP'&&effect.mayRefillBetween&&a.refill)replenishArkDisplay(s);
        enqueue({...effect,amount:effect.amount-1});
      }
      break;
    }
    case 'MOVE_ACTION': {
      if(a.kind==='SKIP')break;
      if(a.kind!=='MOVE'||effect.action!==null&&effect.action!==a.action||!effect.slots.includes(a.slot))return invalid();
      const index=s.actions.findIndex(c=>c.kind===a.action);if(index<0)return invalid();
      const moved=s.actions.splice(index,1)[0]!;s.actions.splice(a.slot-1,0,moved);break;
    }
    case 'UPGRADE':case 'UPGRADE_OR_WORKER': {
      if(a.kind==='UPGRADE') {
        const action=s.actions.find(c=>c.kind===a.action);
        if(!action||action.upgraded||s.actions.filter(c=>c.upgraded).length>=4)return invalid();action.upgraded=true;
      } else if(a.kind==='WORKER'&&effect.kind==='UPGRADE_OR_WORKER'&&s.workers<4)s.workers++;
      else return invalid();
      if(effect.kind==='UPGRADE_OR_WORKER')(s.conservationChoices??=[]).push({track:2,choice:a.kind==='UPGRADE'?`UPGRADE_${a.action}`:'WORKER'});
      break;
    }
    case 'CONSERVATION_BONUS': {
      if(a.kind!=='BONUS')return invalid();
      const chosen=chooseArkConservationBonus(s.conservationBonuses,effect.track,a.tile);if(!chosen.ok)return invalid();
      s.conservationBonuses=chosen.pool;(s.conservationChoices??=[]).push({track:effect.track,choice:a.tile??'MONEY_5'});enqueue(chosen.effect);break;
    }
    case 'DISCARD_GOAL': {
      if(a.kind!=='GOAL'||s.goals.length<2)return invalid();
      const index=s.goals.findIndex(c=>c.cardId===a.discard);if(index<0)return invalid();
      s.discardedGoals.push(...s.goals.splice(index,1));(s.conservationChoices??=[]).push({track:10,choice:'DISCARD_GOAL'});break;
    }
    case 'WAZA_FOCUS':
      if(a.kind!=='FOCUS'||s.wazaFocus!==null)return invalid();s.wazaFocus=a.focus;break;
    case 'SPONSOR_TOKENS': {
      if(a.kind!=='NONE'||!s.played.some(c=>c.cardId===job.sourceId))return invalid();
      const before=Object.hasOwn(s.sponsorTokens,job.sourceId)?s.sponsorTokens[job.sourceId]!:0;
      Object.defineProperty(s.sponsorTokens,job.sourceId,{value:before+effect.amount,enumerable:true,writable:true,configurable:true});break;
    }
    default:return {ok:false,reason:'UNSUPPORTED_EFFECT'};
  }
  s.effects=completeArkEffect(s.effects,job.id,children,continuation);
  return {ok:true,state:s,waiting:false};
}
