import {type ArkMapId} from './maps.js';
import { ARK_CONTINENTS, type ArkCard, type ArkBuilding } from './actions.js';
import {arkProject} from './catalog.js';
import { arkCardDefinition, arkZooIcons, ARK_ZOO_ANIMAL_CATEGORIES } from './zoo-icons.js';
import { arkEnclosuresToEmpty } from './animal-housing.js';
export type ArkProjectContext=Readonly<{mapId?:ArkMapId|undefined;played:readonly ArkCard[];partners:readonly string[];universities:readonly string[]}>;
/** The eligible animal IDs are required for breeding/release; unrelated icons cannot stand in for an animal. */
export function arkProjectEligibility(key:string,slot:number,s:ArkProjectContext,extraBaseIcon=0,inBaseRow=false):{eligible:boolean;animals:string[];value:number} {
  const project=arkProject(key),condition=project.slots[slot];
  if (!Number.isInteger(slot)||!condition||!Number.isInteger(extraBaseIcon)||extraBaseIcon<0||extraBaseIcon>2||extraBaseIcon>0&&!inBaseRow) return {eligible:false,animals:[],value:0};
  const definitions=s.played.map(c=>({card:c,definition:arkCardDefinition(c)}));
  if (project.kind==='BREED'||project.kind==='RELEASE') {
    const animals=definitions.filter(({definition:d})=>d.kind==='ANIMAL'&&d.tags.includes(project.tag)&&
      (project.kind==='RELEASE'?(condition.requirement===4?d.size>=4:condition.requirement===2?d.size<=2:d.size===condition.requirement):d.tags.some(t=>s.partners.includes(t)))).map(({card})=>card.cardId);
    return {eligible:animals.length>0,animals,value:animals.length};
  }
  const icons=arkZooIcons(s.played,s.partners,s.universities);
  let value:number;
  if (project.tag==='ALL_ANIMALS') value=ARK_ZOO_ANIMAL_CATEGORIES.filter(t=>(icons[t]??0)>0).length;
  else if (project.tag==='ALL_CONTINENTS') value=ARK_CONTINENTS.filter(t=>(icons[t]??0)>0).length;
  else if (project.tag==='ANIMAL_SIZE_2') value=definitions.filter(({definition:d})=>d.kind==='ANIMAL'&&d.size<=2).length;
  else if (project.tag==='ANIMAL_SIZE_4') value=definitions.filter(({definition:d})=>d.kind==='ANIMAL'&&d.size>=4).length;
  else value=icons[project.tag]??0;
  if (project.kind==='BASE') value+=extraBaseIcon;
  return {eligible:value>=condition.requirement,animals:[],value};
}
export function arkReleaseHousingChoices(buildings:readonly ArkBuilding[],animal:ArkCard,ignoreTerrain=false,mapId:ArkMapId='A'):string[] {
  const d=arkCardDefinition(animal);
  const special=buildings.filter(b=>d.special.some(s=>s.kind===b.kind&&b.used>=s.size));
  if (special.length) return special.map(b=>b.id);
  return arkEnclosuresToEmpty(buildings,d,ignoreTerrain,mapId);
}
/** A release removes only printed appeal. Earlier ability rewards, conservation and reputation stay earned. */
export function releaseArkProjectAnimal(s:ArkProjectContext & {buildings:readonly ArkBuilding[];appeal:number},key:string,slot:number,animalId:string,housingId:string|null,ignoreTerrain=false):
  {ok:true;played:ArkCard[];buildings:ArkBuilding[];discarded:ArkCard;appeal:number}|{ok:false} {
  if (arkProject(key).kind!=='RELEASE'||!arkProjectEligibility(key,slot,s).animals.includes(animalId)) return {ok:false};
  const animal=s.played.find(c=>c.cardId===animalId)!;const d=arkCardDefinition(animal);
  const choices=arkReleaseHousingChoices(s.buildings,animal,ignoreTerrain,s.mapId);
  if (choices.length?housingId===null||!choices.includes(housingId):housingId!==null) return {ok:false};
  const buildings=s.buildings.map(b=>({...b,cells:b.cells.map(c=>({...c}))}));
  const housing=buildings.find(b=>b.id===housingId);
  if (housing) {
    const special=d.special.find(x=>x.kind===housing.kind);
    if (special) housing.used-=special.size;
    else housing.occupied=false;
  }
  return {ok:true,played:s.played.filter(c=>c.cardId!==animalId).map(c=>({...c})),buildings,discarded:{...animal},appeal:Math.max(0,s.appeal-d.appeal)};
}
