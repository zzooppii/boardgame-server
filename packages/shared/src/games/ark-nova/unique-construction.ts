import {type ArkMapId} from './maps.js';
import * as v from 'valibot';
import {ArkCellSchema,type ArkBuilding} from './actions.js';
import type {ArkCardDefinition} from './catalog.js';
import {arkMapCells,arkCellKey,arkNeighbours,arkBorder,arkTerrainCount} from './geometry.js';
import {arkUniqueShape} from './unique-buildings.js';
const Placement=v.strictObject({anchor:ArkCellSchema,rotation:v.picklist([0,1,2,3,4,5])});
/** Unique buildings must fit before paying/playing their sponsor. No reflected/back-face placements. */
export function validateArkUniqueConstruction(buildings:readonly ArkBuilding[],card:ArkCardDefinition,buildUpgraded:boolean,ignoreTerrain:boolean,input:unknown,mapId:ArkMapId='A'):
  {ok:true;building:Omit<ArkBuilding,'id'>}|{ok:false} {
  const placement=v.safeParse(Placement,input);
  if(!placement.success||card.kind!=='SPONSOR'||buildings.some(b=>b.kind===`UNIQUE_${card.key}`))return {ok:false};
  const cells=arkUniqueShape(card.key,placement.output.anchor,placement.output.rotation);
  if(!cells.length)return {ok:false};
  const occupied=new Set(buildings.flatMap(b=>b.cells.map(arkCellKey)));
  if(cells.some(c=>{const map=arkMapCells(mapId).find(m=>arkCellKey(m)===arkCellKey(c));return !map||occupied.has(arkCellKey(c))||map.restricted&&!buildUpgraded||map.terrain!=='LAND'&&!ignoreTerrain;}))return {ok:false};
  if(card.key!=='257'&&!(buildings.length?cells.some(c=>arkNeighbours(c).some(n=>occupied.has(arkCellKey(n)))):mapId!=='A'&&cells.some(arkBorder)))return {ok:false};
  if(['254','257'].includes(card.key)&&cells.filter(arkBorder).length<2)return {ok:false};
  if(!ignoreTerrain&&(card.rock===null||arkTerrainCount(cells,'WATER',mapId)<card.water||arkTerrainCount(cells,'ROCK',mapId)<card.rock))return {ok:false};
  return {ok:true,building:{kind:`UNIQUE_${card.key}`,cells,occupied:false,used:0}};
}
