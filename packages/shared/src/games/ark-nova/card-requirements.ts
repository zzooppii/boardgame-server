import {arkMapFeatureActive,type ArkMapId} from './maps.js';
import type {ArkBuilding} from './actions.js';
import type {ArkCardDefinition} from './catalog.js';
import { ARK_CONTINENTS, type ArkActionCard, type ArkCard, } from './actions.js';
import { arkZooIcons } from './zoo-icons.js';
export type ArkRequirementContext=Readonly<{
  mapId?:ArkMapId|undefined;buildings?:readonly ArkBuilding[]|undefined;
  played:readonly ArkCard[];partners:readonly string[];universities:readonly string[];
  actions:readonly ArkActionCard[];reputation:number;appeal:number;
}>;
/** Individual missing icons are separate conditions, so permitted ignore effects can choose one. */
export function arkMissingCardConditions(card:ArkCardDefinition,s:ArkRequirementContext):string[] {
  const icons=arkZooIcons(s.played,s.partners,s.universities),used:Record<string,number>={},missing:string[]=[];
  for (const requirement of card.requirements) {
    let satisfied:boolean;
    switch (requirement) {
      case 'AnimalsII': satisfied=s.actions.some(a=>a.kind==='ANIMALS'&&a.upgraded);break;
      case 'SponsorsII': satisfied=s.actions.some(a=>a.kind==='SPONSORS'&&a.upgraded);break;
      case 'Appeal': satisfied=s.appeal<=25;break;
      case 'Reputation': satisfied=s.reputation>=3;break;
      case 'Partner_Zoo': satisfied=card.kind==='SPONSOR'?s.partners.length>0:card.tags.some(t=>s.partners.includes(t));break;
      default: used[requirement]=(used[requirement]??0)+1;satisfied=(icons[requirement]??0)>=used[requirement]!;
    }
    if (!satisfied) missing.push(requirement);
  }
  return missing;
}
/** Money is paid before triggered effects; display surcharge is never reduced by partner zoos. */
export function arkAnimalPrice(card:ArkCardDefinition,s:Pick<ArkRequirementContext,'played'|'partners'>,displaySlot=0):number {
  if (card.kind!=='ANIMAL'||!Number.isInteger(displaySlot)||displaySlot<0||displaySlot>6) throw new Error('Invalid animal price input.');
  const partnerDiscount=card.tags.filter(t=>ARK_CONTINENTS.some(c=>c===t)&&s.partners.includes(t)).length*3;
  const small=card.size<=2&&s.played.some(c=>c.key==='229')?3:0;
  const large=card.size>=4&&s.played.some(c=>c.key==='230')?4:0;
  return Math.max(0,card.cost-partnerDiscount-small-large)+displaySlot;
}

export function arkIgnoredAnimalConditions(card:ArkCardDefinition,s:ArkRequirementContext):number {return card.kind==='ANIMAL'?Number(s.mapId==='6'&&arkMapFeatureActive(s.mapId,s.buildings??[]))+Number(card.size>=4&&s.played.some(c=>c.key==='263')):0;}
export function arkSponsorLevel(card:ArkCardDefinition,s:Pick<ArkRequirementContext,'mapId'|'buildings'>):number {return Math.max(0,card.cost-Number(card.kind==='SPONSOR'&&s.mapId==='8'&&arkMapFeatureActive(s.mapId,s.buildings??[])));}
