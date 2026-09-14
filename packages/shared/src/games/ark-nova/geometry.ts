import type {ArkBuilding,ArkCell} from './actions.js';
export type ArkMapCell=ArkCell&Readonly<{terrain:'LAND'|'WATER'|'ROCK';bonus:string|null;restricted:boolean}>;
export const arkCellKey=(c:ArkCell):string=>`${c.q},${c.r}`;
export const arkOffset=(column:number,row:number):ArkCell=>({q:column,r:row-Math.ceil(column/2)});
const rocks=new Set(['1:0','1:1','1:6','2:1','3:0','5:2','6:4']);
const water=new Set(['2:0','2:5','3:6','4:0','5:4','6:3','7:0','8:0','8:1']);
const bonuses:Readonly<Record<string,string>>={'0:0':'REPUTATION_2','0:1':'X_1','2:2':'CARD_1','2:4':'MONEY_5','3:1':'MONEY_5','4:3':'X_1','5:0':'X_1','5:3':'CARD_1','5:5':'CARD_1','7:1':'WORKER','7:5':'REPUTATION_2','8:2':'MONEY_10'};
export const ARK_MAP_A:readonly ArkMapCell[]=Array.from({length:9},(_,q)=>Array.from({length:q%2?7:6},(_,row):ArkMapCell=>{const k=`${q}:${row}`;return {...arkOffset(q,row),terrain:rocks.has(k)?'ROCK':water.has(k)?'WATER':'LAND',bonus:bonuses[k]??null,restricted:k==='7:6'||k==='8:5'};})).flat();
export const arkNeighbours=(c:ArkCell):ArkCell[]=>[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([q,r])=>({q:c.q+q!,r:c.r+r!}));
export const arkDistance=(a:ArkCell,b:ArkCell):number=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
export const arkBorder=(c:ArkCell):boolean=>arkNeighbours(c).some(n=>!ARK_MAP_A.some(x=>arkCellKey(x)===arkCellKey(n)));
export const ARK_BUILDINGS:Readonly<Record<string,Readonly<{name:string;shape:readonly ArkCell[];special:boolean;capacity:number}>>>= {
 'ENCLOSURE_1':{name:'1칸 우리',shape:[{q:0,r:0}],special:false,capacity:1},
 'ENCLOSURE_2':{name:'2칸 우리',shape:[{q:0,r:0},{q:1,r:0}],special:false,capacity:2},
 'ENCLOSURE_3':{name:'3칸 우리',shape:[{q:0,r:0},{q:1,r:0},{q:1,r:-1}],special:false,capacity:3},
 'ENCLOSURE_4':{name:'4칸 우리',shape:[{q:0,r:0},{q:1,r:0},{q:1,r:-1},{q:2,r:-1}],special:false,capacity:4},
 'ENCLOSURE_5':{name:'5칸 우리',shape:[{q:0,r:0},{q:1,r:0},{q:1,r:-1},{q:2,r:-1},{q:2,r:0}],special:false,capacity:5},
 KIOSK:{name:'매점',shape:[{q:0,r:0}],special:false,capacity:0},
 PAVILION:{name:'파빌리온',shape:[{q:0,r:0}],special:false,capacity:0},
 PettingZoo:{name:'체험 동물원',shape:[{q:0,r:0},{q:0,r:1},{q:1,r:-1}],special:true,capacity:3},
 ReptileHouse:{name:'파충류관',shape:[{q:0,r:0},{q:0,r:1},{q:1,r:0},{q:2,r:-1},{q:2,r:0}],special:true,capacity:5},
 LargeBirdAviary:{name:'대형 조류관',shape:[{q:0,r:0},{q:0,r:1},{q:1,r:0},{q:1,r:1},{q:2,r:-1}],special:true,capacity:5},
};
export function arkShape(kind:string,anchor:ArkCell,rotation:number,reflected:boolean):ArkCell[]{
 const definition=Object.hasOwn(ARK_BUILDINGS,kind)?ARK_BUILDINGS[kind]:undefined;if(!definition)return [];
 return definition.shape.map(c=>{let q=c.q,r=reflected?-c.q-c.r:c.r;for(let i=0;i<rotation;i++){const nq=-r;r=q+r;q=nq;}return{q:q+anchor.q,r:r+anchor.r};});
}
export function arkPlacementReason(buildings:readonly ArkBuilding[],kind:string,cells:readonly ArkCell[],upgraded:boolean,ignoreTerrain=false,detached=false):string|null{
 if(!Object.hasOwn(ARK_BUILDINGS,kind)||!cells.length)return '건물을 선택하세요.';
 if(cells.length!==ARK_BUILDINGS[kind]!.shape.length)return '건물 크기가 맞지 않습니다.';
 if(new Set(cells.map(arkCellKey)).size!==cells.length)return '배치 칸이 중복됩니다.';
 const covered=new Set(buildings.flatMap(b=>b.cells.map(arkCellKey)));
 for(const c of cells){const m=ARK_MAP_A.find(m=>arkCellKey(m)===arkCellKey(c));if(!m)return '동물원 경계를 벗어났습니다.';if(covered.has(arkCellKey(c)))return '이미 건물이 있는 칸입니다.';if(m.terrain!=='LAND'&&!ignoreTerrain)return '물과 바위 위에는 건설할 수 없습니다.';if(m.restricted&&!upgraded)return '건설 카드를 먼저 업그레이드하세요.';}
 if(!detached){
  if(buildings.length&&!cells.some(c=>arkNeighbours(c).some(n=>covered.has(arkCellKey(n)))))return '기존 건물과 한 변 이상 연결하세요.';
  if(!buildings.length&&!cells.some(arkBorder))return '첫 건물은 가장자리에 놓으세요.';
 }
 if(kind==='KIOSK'&&buildings.some(b=>b.kind==='KIOSK'&&cells.some(c=>b.cells.some(x=>arkDistance(c,x)<3))))return '매점 사이에는 빈 칸 2개 이상의 거리가 필요합니다.';
 if(ARK_BUILDINGS[kind]?.special&&buildings.some(b=>b.kind===kind))return '특수 우리는 종류별로 하나만 지을 수 있습니다.';
 return null;
}
export function arkTerrainCount(cells:readonly ArkCell[],terrain:'WATER'|'ROCK'):number{const covered=new Set(cells.map(arkCellKey));return ARK_MAP_A.filter(m=>m.terrain===terrain&&!covered.has(arkCellKey(m))&&cells.some(c=>arkDistance(m,c)===1)).length;}
export const arkConnectedTerrain=(buildings:readonly ArkBuilding[],terrain:'WATER'|'ROCK'):number=>arkTerrainCount(buildings.flatMap(b=>b.cells),terrain);
export function arkInitialBuildings():ArkBuilding[]{return[{id:'initial-kiosk',kind:'KIOSK',cells:[arkOffset(0,3)],occupied:false,used:0},{id:'initial-enclosure',kind:'ENCLOSURE_3',cells:[arkOffset(0,4),arkOffset(0,5),arkOffset(1,5)],occupied:false,used:0}];}
