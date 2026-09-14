import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_MAP_A, arkInitialBuildings, type ArkBuilding } from '@hangul-rummikub/shared';
import { assertArkZooMap } from '../../games/ark-nova/domain/zoo-map.js';
import { validateArkConstruction } from '../../games/ark-nova/domain/construction.js';
import { validateArkUniqueConstruction } from '../../games/ark-nova/domain/unique-construction.js';
import { arkCardDefinition } from '../../games/ark-nova/domain/zoo-icons.js';
function build(placed:ArkBuilding[],kind:string):ArkBuilding {
  for(const cell of ARK_MAP_A)for(const rotation of [0,1,2,3,4,5])for(const reflected of [false,true]) {
    const result=validateArkConstruction({buildings:placed,money:100,remainingStrength:5,upgraded:true,builtKinds:[]},{building:kind,anchor:{q:cell.q,r:cell.r},rotation,reflected});
    if(result.ok)return {...result.building,id:`building-${kind}`};
  }
  throw new Error('No test placement.');
}
test('Stored map permits occupied standard and partially populated special enclosures without historical animal assignment',()=>{
  const map=arkInitialBuildings();map[1]!.occupied=true;map.push(build(map,'ReptileHouse'));map[2]!.used=3;
  assert.doesNotThrow(()=>assertArkZooMap(map,[],true));
  const restored=JSON.parse(JSON.stringify(map));assert.doesNotThrow(()=>assertArkZooMap(restored,[],true));
  map[2]!.used=6;assert.throws(()=>assertArkZooMap(map,[],true));map[2]!.used=3;map[2]!.occupied=true;assert.throws(()=>assertArkZooMap(map,[],true));
});
test('Stored map rejects forged coordinates, shape, initial tiles and occupied kiosks',()=>{
  const valid=arkInitialBuildings();valid.push(build(valid,'ENCLOSURE_3'));
  assert.doesNotThrow(()=>assertArkZooMap(valid,[],true));
  const overlap=structuredClone(valid);overlap[2]!.cells[0]={...overlap[0]!.cells[0]!};assert.throws(()=>assertArkZooMap(overlap,[],true));
  const initial=structuredClone(valid);initial[1]!.id='forged';assert.throws(()=>assertArkZooMap(initial,[],true));
  const kiosk=structuredClone(valid);kiosk[0]!.occupied=true;assert.throws(()=>assertArkZooMap(kiosk,[],true));
  const shape=structuredClone(valid);shape[2]!.cells[0]={q:20,r:20};assert.throws(()=>assertArkZooMap(shape,[],true));
});
test('Unique buildings must match a played sponsor, its front outline and physical card instance',()=>{
  const map=arkInitialBuildings(),card={key:'256',cardId:'unique-sponsor'};
  let building:ArkBuilding|undefined;
  for(const cell of ARK_MAP_A)for(const rotation of [0,1,2,3,4,5]) {
    const result=validateArkUniqueConstruction(map,arkCardDefinition(card),true,false,{anchor:{q:cell.q,r:cell.r},rotation});
    if(result.ok)building={...result.building,id:'unique:unique-sponsor'};
  }
  assert.ok(building);map.push(building);assert.doesNotThrow(()=>assertArkZooMap(map,[card],true));
  assert.throws(()=>assertArkZooMap(map,[],true));assert.throws(()=>assertArkZooMap(map,[{...card,cardId:'different'}],true));
  assert.throws(()=>assertArkZooMap(arkInitialBuildings(),[card],true));
});
