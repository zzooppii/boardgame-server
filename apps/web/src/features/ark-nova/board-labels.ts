import {ARK_BUILDINGS,type ArkBuilding,type ArkCell} from '@hangul-rummikub/shared';
import {arkHexPoints} from './presentation.js';
export const arkMapBonusLabels:Readonly<Record<string,string>>={REPUTATION_2:'평판 +2',X_1:'X 토큰 +1',CARD_1:'카드 1장 획득',MONEY_5:'돈 +5',MONEY_10:'돈 +10',WORKER:'협회 직원 +1'};
export function arkBuildingLabel(b:ArkBuilding):string {
  const name=ARK_BUILDINGS[b.kind]?.name??'특수 건물';
  const housing=b.kind.startsWith('ENCLOSURE_')||['PettingZoo','ReptileHouse','LargeBirdAviary'].includes(b.kind);
  return `${name} · ${b.cells.length}칸${housing?` · ${b.occupied||b.used>0?'동물 입주':'비어 있음'}`:''}`;
}
/** Shared hex edges cancel; the remaining edges form closed, fillable facility contours. */
export function arkBuildingOutline(cells:readonly ArkCell[]):string {
  const edges=new Map<string,readonly [string,string]>();
  for(const cell of cells){
    const points=arkHexPoints(cell,30).split(' ').map(p=>p.split(',').map(Number).map(n=>Math.round(n*1000)/1000).join(','));
    for(let i=0;i<6;i++){
      const a=points[i]!,b=points[(i+1)%6]!,key=[a,b].sort().join('|');
      if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
    }
  }
  const next=new Map([...edges.values()]);
  const loops:string[]=[];
  while(next.size){
    const start=next.keys().next().value;
    if(start===undefined)break;
    let point=start,path=`M${start}`;
    do {
      const end=next.get(point);
      if(end===undefined)break;
      next.delete(point);
      path+=`L${end}`;
      point=end;
    } while(point!==start);
    loops.push(`${path}Z`);
  }
  return loops.join(' ');
}
