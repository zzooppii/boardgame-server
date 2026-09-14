import * as v from 'valibot';
import { ARK_BUILDINGS, ARK_MAP_A, ArkBuildBonusSchema, arkCellKey, arkInitialBuildings, type ArkBuilding, type ArkBuildBonus } from '@hangul-rummikub/shared';
import { validateArkConstruction } from './construction.js';

export {arkReputationRange} from '@hangul-rummikub/shared';
export function arkPlacementBonuses(building:ArkBuilding):ArkBuildBonus[] {
  const covered=new Set(building.cells.map(arkCellKey));
  return ARK_MAP_A.filter(cell=>covered.has(arkCellKey(cell))&&cell.bonus!==null).map(cell=>v.parse(ArkBuildBonusSchema,{id:`map:${arkCellKey(cell)}`,kind:cell.bonus}));
}
export function arkConstructionAppeal(buildings:readonly ArkBuilding[]):number {
  const covered=new Set(buildings.flatMap(b=>b.cells.map(arkCellKey)));
  return buildings.filter(b=>b.kind==='PAVILION').length + (ARK_MAP_A.filter(c=>c.terrain==='LAND').every(c=>covered.has(arkCellKey(c))) ? 7 : 0);
}
/** Current construction-only games contain empty buildings; animal occupancy is added with card play. */
export function assertArkConstructedMap(buildings:readonly ArkBuilding[]):void {
  const initial=arkInitialBuildings();
  if (JSON.stringify(buildings.slice(0,2))!==JSON.stringify(initial) || new Set(buildings.map(b=>b.id)).size!==buildings.length) throw new Error('Invalid Ark buildings.');
  const placed=[...initial];
  for (const building of buildings.slice(2)) {
    if (building.occupied || building.used!==0) throw new Error('Unsupported occupied Ark building.');
    const fits=building.cells.some(anchor=>[0,1,2,3,4,5].some(rotation=>[false,true].some(reflected=>{
      const result=validateArkConstruction({buildings:placed,money:10000,remainingStrength:5,upgraded:true,builtKinds:[]},{building:building.kind,anchor,rotation,reflected});
      return result.ok && result.building.cells.map(arkCellKey).sort().join('|')===building.cells.map(arkCellKey).sort().join('|');
    })));
    if (!fits) throw new Error('Invalid Ark building geometry.');
    placed.push(building);
  }
}
export function canContinueArkBuild(buildings:readonly ArkBuilding[],money:number,remaining:number,builtKinds:readonly string[],upgraded=true,engineerAvailable=false,ignoreTerrain=false):boolean {
  return Object.keys(ARK_BUILDINGS).some(building=>ARK_MAP_A.some(anchor=>[0,1,2,3,4,5].some(rotation=>[false,true].some(reflected=>
    validateArkConstruction({buildings,money,remainingStrength:remaining,upgraded,builtKinds,engineerAvailable,ignoreTerrain},{building,anchor:{q:anchor.q,r:anchor.r},rotation,reflected}).ok))));
}
