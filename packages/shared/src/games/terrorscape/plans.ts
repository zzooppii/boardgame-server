import * as v from 'valibot';
export const TERROR_PLANS=['EXPLOSIVE','AMBUSH','ROCKET','SEAL','BLUEPRINT','DIY_RADIO','CAREFUL_REPAIR','BUZZER','SITE_STUDY','TUNNELS','PORTAL','MOLOTOV','SKELETON_KEY','INTEL','MYSTIC_HERBS','ANCIENT_CHEST'] as const;
export const TerrorPlanSchema=v.picklist(TERROR_PLANS);
export type TerrorPlan=v.InferOutput<typeof TerrorPlanSchema>;
export type TerrorPlanStep='KILLER'|'BOOK'|'TOOLS'|'OCCULT'|'RADIO'|'EXIT'|'TOGETHER'|'APART';
export const TERROR_PLAN_STEP:Record<TerrorPlanStep,string>={KILLER:'살인마의 공개 위치',BOOK:'서재 R5',TOOLS:'헛간 G3',OCCULT:'무덤 G2',RADIO:'무전기 B1',EXIT:'숨겨진 출구 G5',TOGETHER:'생존자 전원 같은 장소',APART:'생존자 모두 서로 다른 장소'};
export const TERROR_PLAN_INFO:Record<TerrorPlan,{name:string;steps:TerrorPlanStep[];description:string}>={
 EXPLOSIVE:{name:'Strike Back! Explosive Trap',steps:['KILLER','TOOLS','KILLER','TOOLS'],description:'일회용 기본 행동: 공구상자를 버려 현 위치에 폭발 덫. 살인마가 그곳을 수색하고 생존자가 없으면 생존자 승리.'},
 AMBUSH:{name:'Strike Back! Ambush',steps:['BOOK','KILLER','TOGETHER'],description:'완료한 장소에 매복. 그곳에서 공격력보다 3 이상 높은 방어에 성공하면 생존자 승리.'},
 ROCKET:{name:'Strike Back! Rocket Launcher',steps:['TOOLS','BOOK','KILLER','TOOLS'],description:'생존자 차례 시작에 전원이 같은 장소에 있고 그곳이 살인마와 인접하며, 직전 살인마 차례에 조우가 없었다면 승리.'},
 SEAL:{name:'Strike Back! The Arcane Seal',steps:['OCCULT','KILLER','OCCULT','OCCULT'],description:'완료 즉시 무덤에 소음. 무덤에서 공격을 성공적으로 방어하면 생존자 승리.'},
 BLUEPRINT:{name:'Mechanical Blueprint',steps:['BOOK','TOOLS','BOOK'],description:'무전기 수리할 때마다 진행 +1.'},
 DIY_RADIO:{name:'DIY Radio',steps:['BOOK','RADIO','BOOK','TOOLS'],description:'기본 행동: 공구상자 3개를 버려 무전기 수리를 즉시 완료하고 현 위치 소음.'},
 CAREFUL_REPAIR:{name:'Repair with Caution',steps:['RADIO','TOOLS','RADIO'],description:'공구상자 수리는 소음이 나지 않습니다.'},
 BUZZER:{name:'Buzzer',steps:['KILLER','KILLER','TOOLS'],description:'일회용 기본 행동: 공구상자를 버려 현 위치에 버저 설치. 이후 추가 행동으로 버저 위치에 소음.'},
 SITE_STUDY:{name:'Site Study',steps:['EXIT','TOGETHER'],description:'일회용 추가 행동: 1–2칸 이동.'},
 TUNNELS:{name:'Tunnels Investigation',steps:['OCCULT','BOOK','BOOK'],description:'모든 비밀 통로 입구를 서로 연결합니다. 기본 행동으로 다른 통로 입구로 이동.'},
 PORTAL:{name:'The Concealed Portal',steps:['EXIT','OCCULT','OCCULT','BOOK'],description:'차례 시작에 전원이 무덤에 있고 지도·손전등·부적을 가지고 있으면 승리.'},
 MOLOTOV:{name:'Molotov',steps:['TOOLS','TOOLS'],description:'매 공격에 위스키 한 개를 버려 방어 +2. 보통 방어 아이템과 함께 사용할 수 있습니다.'},
 SKELETON_KEY:{name:'Skeleton Key',steps:['TOOLS','TOOLS','BOOK','BOOK'],description:'일회용 기본 행동: 메인 홀에서 공구상자를 버려 수색 덱 맨 아래 열쇠를 획득.'},
 INTEL:{name:'Intel Sharing',steps:['APART','APART','TOGETHER'],description:'완료 즉시 선택한 생존자가 수색 카드 1장을 뽑습니다.'},
 MYSTIC_HERBS:{name:'Mystic Herbs',steps:['OCCULT','OCCULT'],description:'일회용 추가 행동: 무덤의 생존자를 치료하고 공포를 모두 제거.'},
 ANCIENT_CHEST:{name:'The Ancient Chest',steps:['BOOK','OCCULT'],description:'일회용 기본 행동: 부적을 버리고 수색 카드 3장을 연속으로 뽑습니다. 뽑는 동안 교환할 수 없습니다.'},
};
