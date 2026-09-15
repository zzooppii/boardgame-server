import * as v from 'valibot';
import type {ArkBuilding, ArkCell} from './actions.js';
/** Original base-game boards, not the later 1a–8a alternatives. Offset coordinates are column:row. */
export const ARK_MAP_IDS=['A','0','1','2','3','4','5','6','7','8'] as const;
export const ArkMapIdSchema=v.picklist(ARK_MAP_IDS);
export type ArkMapId=v.InferOutput<typeof ArkMapIdSchema>;
export type ArkMapLayout=Readonly<{name:string;description:string;rocks:string;water:string;restricted:string;bonuses:Readonly<Record<string,string>>;landmarks?:Readonly<Record<string,string>>;project:string;recurring:boolean;partnerUpgrade:number;partnerPoints:number;universityPoints:number}>;
const common={partnerUpgrade:2,partnerPoints:1,universityPoints:1};
export const ARK_MAP_LAYOUTS:Readonly<Record<ArkMapId,ArkMapLayout>>={
 A:{...common,name:'첫 동물원',description:'매점과 빈 3칸 우리로 시작합니다.',rocks:'1:0 1:1 1:6 2:1 3:0 5:2 6:4',water:'2:0 2:5 3:6 4:0 5:4 6:3 7:0 8:0 8:1',restricted:'7:6 8:5',bonuses:{'0:0':'REPUTATION_2','0:1':'X_1','2:2':'CARD_1','2:4':'MONEY_5','3:1':'MONEY_5','4:3':'X_1','5:0':'X_1','5:3':'CARD_1','5:5':'CARD_1','7:1':'WORKER','7:5':'REPUTATION_2','8:2':'MONEY_10'},project:'CONSERVATION_1',recurring:true,partnerPoints:2,universityPoints:2},
 '0':{...common,name:'입문 동물원',description:'빈 지도에서 시작하며 배치 보너스가 풍부합니다.',rocks:'0:5 1:6 2:0 3:1 5:4 5:6 6:1 6:4 6:5',water:'0:0 0:1 1:0 1:5 2:3 3:0 5:2 7:6 8:4 8:5',restricted:'6:2 7:2',bonuses:{'1:1':'CARD_1','2:2':'CARD_1','3:4':'X_1','3:6':'CARD_1','4:0':'X_1','4:2':'MONEY_10','5:3':'MOVE_1','5:5':'X_1','7:1':'MONEY_5','7:5':'REPUTATION_2','8:3':'MONEY_5','0:4':'REPUTATION_2'},project:'CONSERVATION_1',recurring:true,partnerPoints:2,universityPoints:2},
 '1':{...common,name:'전망대',description:'전망대에 인접한 일반 우리를 입주 면으로 뒤집을 때마다 매력 2를 얻습니다.',rocks:'1:0 2:0 3:0 0:2 0:3 0:4 1:3 3:5 3:6',water:'4:2 5:3 6:3 7:3 8:2 8:3 5:6',restricted:'3:2 4:3 5:4',bonuses:{'0:0':'X_1','4:0':'MOVE_1','7:1':'CARD_1','6:2':'MONEY_5','3:3':'CARD_1','7:4':'X_1','0:5':'MONEY_5','4:5':'REPUTATION_1','7:6':'X_1'},landmarks:{'1:3':'TOWER'},project:'PAID_SPONSOR',recurring:true,partnerPoints:2},
 '2':{...common,name:'야외 구역',description:'야외 구역에 인접한 일반 우리는 배치 후 모든 판정에서 2칸 큰 우리로 취급합니다.',rocks:'0:0 0:1 1:2 4:0 5:0 8:2 0:4 0:5 1:5',water:'6:0 7:0 3:4 4:4 4:5 5:4 5:5',restricted:'1:0 2:0 3:3 5:3',bonuses:{'1:1':'FREE_PARTNER','5:1':'CARD_1','7:1':'CARD_1','0:2':'REPUTATION_1','4:3':'X_1','7:3':'X_1','1:6':'PAID_SPONSOR','8:5':'MOVE_1'},landmarks:{'5:4':'OUTDOOR'},project:'CONSERVATION_1',recurring:false,partnerPoints:0,universityPoints:2},
 '3':{...common,name:'은빛 호수',description:'호숫가의 돈 2 표시 칸을 덮을 때마다 해당 배치 보너스를 받습니다.',rocks:'5:0 7:0 6:1 8:2 8:3 4:5 3:6',water:'6:0 2:1 2:2 2:3 1:3 0:5 5:5 5:6 6:4',restricted:'0:0 1:0 1:1 1:2 2:0',bonuses:{'0:1':'REPUTATION_1','0:2':'MONEY_2','0:3':'MONEY_2','1:1':'MONEY_2','1:2':'MONEY_2','1:4':'MONEY_2','2:0':'MONEY_2','2:4':'MONEY_2','3:1':'MONEY_2','3:2':'MONEY_2','3:3':'MONEY_2','3:4':'MONEY_2','5:1':'MOVE_1','7:1':'PAID_SPONSOR','5:3':'CARD_1','4:4':'REPUTATION_1','8:4':'X_1','6:5':'X_1','1:6':'CARD_1'},project:'UPGRADE',recurring:false,universityPoints:2},
 '4':{...common,name:'상업 항구',description:'왼쪽 아래 항구 옆 칸을 건설하면, 자기 차례에 한 번 손패 1장을 버리고 돈 3을 받을 수 있습니다.',rocks:'7:1 6:2 6:3 3:4 3:5 7:5 5:6',water:'5:0 8:0 8:1 1:2 2:1 2:2 3:2 0:4 1:6',restricted:'6:1 8:2 8:3 8:4',bonuses:{'6:0':'CARD_1','1:1':'X_1','3:1':'X_1','5:2':'X_1','7:2':'MULTIPLIER','0:2':'REPUTATION_1','3:3':'CARD_1','2:4':'MOVE_1','8:5':'MONEY_5'},project:'FREE_UNIVERSITY',recurring:false},
 '5':{...common,name:'공원 식당',description:'휴식 수입으로 식당에 인접한 건설된 칸마다 돈 1을 받습니다. 빈 우리도 셉니다.',rocks:'6:0 2:1 2:2 4:2 7:2 1:4 6:4',water:'4:1 0:2 1:2 7:3 8:3 5:4 5:5 2:4',restricted:'1:1 1:5 5:6',bonuses:{'1:0':'X_1','4:0':'MOVE_1','6:1':'CARD_1','8:1':'REPUTATION_1','1:3':'X_1','2:3':'PAID_SPONSOR','6:3':'CARD_1','4:4':'CARD_1','6:5':'MONEY_5'},landmarks:{'4:2':'RESTAURANT'},project:'SPECIAL_ENCLOSURE',recurring:false,partnerPoints:2,universityPoints:0},
 '6':{...common,name:'연구소',description:'왼쪽 아래 연구소 옆 칸을 건설하면 동물 카드의 조건 1개를 무시합니다. 물·바위 조건은 제외합니다.',rocks:'4:0 5:0 3:3 3:4 2:3 2:4 7:5',water:'0:0 0:1 8:0 8:1 7:2 7:3 5:5 5:6 8:5',restricted:'7:0 6:0 4:1 5:2',bonuses:{'3:0':'X_1','1:1':'X_1','5:1':'CARD_1','7:1':'FREE_UNIVERSITY','2:2':'MONEY_5','8:3':'MONEY_5','1:4':'MOVE_1','3:5':'CARD_1','6:5':'REPUTATION_1'},project:'MOVE_1_TWICE',recurring:true,universityPoints:0},
 '7':{...common,name:'아이스크림 가게',description:'매점 보너스 3칸을 모두 덮으면 휴식마다 내 매점 하나당 돈 1을 추가로 받습니다.',rocks:'0:0 0:1 4:0 4:1 3:2 1:4 2:4 4:4 5:4',water:'7:0 8:0 8:1 8:2 7:2 7:5 8:5',restricted:'3:4 3:5 3:6',bonuses:{'1:1':'KIOSK','3:1':'CARD_1','7:1':'X_1','0:2':'REPUTATION_1','5:2':'KIOSK','3:3':'PAID_SPONSOR','7:3':'MOVE_1','4:3':'CARD_1','1:5':'REPUTATION_1','5:5':'KIOSK','8:4':'X_1','4:5':'CARD_1','7:6':'MONEY_5'},project:'APPEAL_2',recurring:true,partnerPoints:0,universityPoints:1},
 '8':{...common,name:'할리우드 힐스',description:'H칸을 덮을 때 첫 후원자가 나올 때까지 공개해 손패로 받습니다. H 3칸을 모두 덮으면 후원 등급이 1 낮아집니다.',rocks:'0:4 0:5 1:6 2:5 3:6 4:4 5:6 6:5 7:5',water:'1:0 5:1 5:2 4:1 6:1 1:2 2:2',restricted:'3:3 2:3 3:5',bonuses:{'3:0':'X_1','1:1':'X_1','6:0':'MONEY_5','7:2':'CARD_1','4:2':'X_1','0:3':'MOVE_1','8:4':'REPUTATION_1'},landmarks:{'1:5':'HOLLYWOOD','4:5':'HOLLYWOOD','6:4':'HOLLYWOOD'},project:'FREE_PARTNER',recurring:false},
};
export function arkMapCovered(buildings:readonly ArkBuilding[],column:number,row:number):boolean {return buildings.some(b=>b.cells.some(c=>c.q===column&&c.r===row-Math.ceil(column/2)));}
export function arkMapFeatureActive(id:ArkMapId|undefined,buildings:readonly ArkBuilding[]):boolean {
 if(id==='4'||id==='6')return arkMapCovered(buildings,0,5);
 if(id==='7')return ['1:1','5:2','5:5'].every(k=>{const [q,r]=k.split(':').map(Number);return arkMapCovered(buildings,q!,r!);});
 if(id==='8')return ['1:5','4:5','6:4'].every(k=>{const [q,r]=k.split(':').map(Number);return arkMapCovered(buildings,q!,r!);});
 return false;
}
export function arkEnclosureSize(building:ArkBuilding,id:ArkMapId='A'):number {
 const target:ArkCell={q:5,r:1}; // Outdoor Areas: offset 5:4.
 const adjacent=building.cells.some(c=>(Math.abs(c.q-target.q)+Math.abs(c.r-target.r)+Math.abs(c.q+c.r-target.q-target.r))/2===1);
 return building.cells.length+(id==='2'&&building.kind.startsWith('ENCLOSURE_')&&adjacent?2:0);
}

export function arkMapProjectBonuses(id:ArkMapId='A'):readonly string[]{return ['SNAP_1','ENCLOSURE_2','MONEY_5',ARK_MAP_LAYOUTS[id].project,id==='A'?'REPUTATION_2':'WORKER','MONEY_12','X_3'];}
