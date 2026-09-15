import {type ArkMapId} from '@hangul-rummikub/shared';
import * as v from 'valibot';
import { ARK_BUILDINGS, ARK_UNIQUE_BUILDINGS, ArkBuildingSchema, arkShape, arkCellKey, arkInitialBuildings, arkPlacementReason, type ArkBuilding, type ArkCard } from '@hangul-rummikub/shared';
import { arkCardDefinition } from './zoo-icons.js';
import { validateArkUniqueConstruction } from './unique-construction.js';
const sameCells=(a:ArkBuilding['cells'],b:ArkBuilding['cells'])=>a.map(arkCellKey).sort().join('|')===b.map(arkCellKey).sort().join('|');
/** Validate stored map geometry independently of animal assignment. Standard enclosures deliberately do not
 * remember a historical animal ID: flock, release and special-enclosure movement follow the printed rules.
 */
export function assertArkZooMap(buildings:readonly ArkBuilding[],played:readonly ArkCard[],buildUpgraded:boolean,mapId:ArkMapId='A'):void {
  const all=v.parse(v.array(ArkBuildingSchema),buildings),initial=arkInitialBuildings(mapId);
  if(all.length<initial.length||new Set(all.map(b=>b.id)).size!==all.length)throw new Error('Invalid Ark map inventory.');
  const ignoreTerrain=played.some(c=>c.key==='219'),placed:ArkBuilding[]=[];
  for(const [index,b] of all.entries()) {
    if(Object.hasOwn(ARK_BUILDINGS,b.kind)) {
      const definition=ARK_BUILDINGS[b.kind]!;
      if(definition.special ? b.occupied||b.used>definition.capacity : b.used!==0||!b.kind.startsWith('ENCLOSURE_')&&b.occupied)throw new Error('Invalid Ark building occupancy.');
      if(index<initial.length) {
        const expected=initial[index]!;
        if(b.id!==expected.id||b.kind!==expected.kind||!sameCells(b.cells,expected.cells))throw new Error('Invalid Ark initial map.');
      } else {
        const hasShape=b.cells.some(anchor=>[0,1,2,3,4,5].some(rotation=>[false,true].some(reflected=>sameCells(b.cells,arkShape(b.kind,anchor,rotation,reflected)))));
        if(!hasShape||arkPlacementReason(placed,b.kind,b.cells,buildUpgraded,ignoreTerrain,false,mapId)!==null)throw new Error('Invalid Ark stored construction.');
      }
    } else {
      const key=b.kind.startsWith('UNIQUE_')?b.kind.slice(7):'',card=played.find(c=>c.key===key);
      if(index<initial.length||!Object.hasOwn(ARK_UNIQUE_BUILDINGS,key)||!card||b.id!==`unique:${card.cardId}`||b.occupied||b.used!==0)throw new Error('Invalid Ark unique building.');
      const definition=arkCardDefinition(card);
      const fits=b.cells.some(anchor=>[0,1,2,3,4,5].some(rotation=>{
        const result=validateArkUniqueConstruction(placed,definition,buildUpgraded,ignoreTerrain,{anchor,rotation},mapId);
        return result.ok&&sameCells(b.cells,result.building.cells);
      }));
      if(!fits)throw new Error('Invalid Ark stored unique construction.');
    }
    placed.push(b);
  }
  if(played.some(c=>Object.hasOwn(ARK_UNIQUE_BUILDINGS,c.key)&&!all.some(b=>b.kind===`UNIQUE_${c.key}`)))throw new Error('Missing Ark unique building.');
}
