import {arkMapCells,ARK_MAP_LAYOUTS,type ArkMapId} from '@hangul-rummikub/shared';
import * as v from 'valibot';
import { ArkBuildBonusSchema, arkBorder, arkCellKey, arkNeighbours, type ArkBuilding, type ArkBuildBonus, type ArkCard } from '@hangul-rummikub/shared';
import { arkConstructionAppeal, arkPlacementBonuses } from './build-turn.js';
import type { ArkZooEffect } from './animal-effects.js';
export function arkPlacementBonusEffect(kind:ArkBuildBonus['kind']):ArkZooEffect {
  switch(kind) {
    case 'MONEY_2':return {kind:'GAIN',resource:'MONEY',amount:2};
    case 'REPUTATION_1':return {kind:'GAIN',resource:'REPUTATION',amount:1};
    case 'MOVE_1':return {kind:'MOVE_ACTION',action:null,slots:[1]};
    case 'KIOSK':return {kind:'FREE_BUILD',buildings:['KIOSK'],amount:1,ignoreBuildUpgrade:false};
    case 'PAID_SPONSOR':return {kind:'PAID_SPONSOR',usesSponsorToken:false};
    case 'FREE_PARTNER':case 'FREE_UNIVERSITY':return {kind};
    case 'MULTIPLIER':return {kind:'MULTIPLIER',action:null};
    case 'CARD_1':return {kind:'CARD_PICK',amount:1};
    case 'UPGRADE':return {kind:'UPGRADE'};
    case 'MONEY_5':case 'MONEY_10':return {kind:'GAIN',resource:'MONEY',amount:kind==='MONEY_5'?5:10};
    case 'X_1':return {kind:'GAIN',resource:'X',amount:1};
    case 'WORKER':return {kind:'GAIN',resource:'WORKER',amount:1};
    case 'REPUTATION_2':return {kind:'GAIN',resource:'REPUTATION',amount:2};
  }
}
export function arkUncoveredPlacementBonuses(buildings:readonly ArkBuilding[],mapId:ArkMapId='A') {
  const covered=new Set(buildings.flatMap(b=>b.cells.map(arkCellKey)));
  return arkMapCells(mapId).filter(c=>c.bonus!==null&&!covered.has(arkCellKey(c))).map(c=>({...c,bonus:v.parse(ArkBuildBonusSchema.entries.kind,c.bonus)}));
}
/** Effects for one newly placed building; callers resolve these before placing the next building. */
export function arkNewBuildingEffects(before:readonly ArkBuilding[],building:ArkBuilding,played:readonly ArkCard[]=[],mapId:ArkMapId='A'):ArkZooEffect[] {
  const effects:ArkZooEffect[]=arkPlacementBonuses(building,mapId).map(b=>arkPlacementBonusEffect(b.kind));
  if(played.some(c=>c.key==='221')) {
    const covered=new Set(building.cells.map(arkCellKey));
    for(const cell of arkMapCells(mapId))if(cell.bonus!==null&&covered.has(arkCellKey(cell))&&arkBorder(cell))effects.push({kind:'ARCHAEOLOGIST'});
  }
  for(const [key,terrain] of [['241','WATER'],['242','ROCK']] as const) {
    if(!played.some(c=>c.key===key))continue;
    const covered=new Set([...before,building].flatMap(b=>b.cells.map(arkCellKey)));
    const amount=building.cells.filter(cell=>arkNeighbours(cell).some(n=>!covered.has(arkCellKey(n))&&arkMapCells(mapId).some(c=>c.terrain===terrain&&arkCellKey(c)===arkCellKey(n)))).length;
    if(amount)effects.push({kind:'GAIN',resource:'MONEY',amount});
  }
  const appeal=arkConstructionAppeal([...before,building],mapId)-arkConstructionAppeal(before,mapId);
  if(appeal>0)effects.push({kind:'GAIN',resource:'APPEAL',amount:appeal});
  if(mapId==='8')for(const cell of building.cells){const key=`${cell.q}:${cell.r+Math.ceil(cell.q/2)}`;if(ARK_MAP_LAYOUTS['8'].landmarks?.[key]==='HOLLYWOOD')effects.push({kind:'HOLLYWOOD'});}
  return effects;
}
