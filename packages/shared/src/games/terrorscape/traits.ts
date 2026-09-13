import * as v from 'valibot';
export const TERROR_TRAITS=['MARTIAL','HURRIED','INTREPID','FIRST_AID','SURVIVAL_INSTINCT','MORALE','SILENT_RETRIEVAL','HEROIC_SAVE','DECOY','TAUNT','LUCK','VIGILANT','SECRET_WEAPON','SLEIGHT','JUDICIOUS','PROMPT','BURST','COORDINATOR','HERBOLOGY','MARKSMAN','FATAL','ENTRAPMENT','LIE_WAIT','MURDEROUS','HEIGHTENED','DETERRENCE','SLY','AURA','PERILOUS','ENCIRCLE','TOYING','DEVIOUS','NIGHTMARE','SWIFT','ACUTE','ENHANCED','SELF_CHALLENGE','SUPPRESSED','IMMEDIATE','TERRORISING'] as const;
export const TerrorTraitSchema=v.picklist(TERROR_TRAITS);
export type TerrorTrait=v.InferOutput<typeof TerrorTraitSchema>;
export const TerrorDifficultySchema=v.picklist(['NONE','EASY','NORMAL','HARD','NIGHTMARE']);
export type TerrorDifficulty=v.InferOutput<typeof TerrorDifficultySchema>;
type Info={name:string;description:string;side:'SURVIVOR'|'KILLER';once:boolean;timing:'PASSIVE'|'ACTION'|'LOOT'|'DEFEND'|'ENCOUNTER'|'START'|'END'|'SENSE'|'LEVEL'};
const survivor=(name:string,description:string,timing:Info['timing']='PASSIVE',once=false):Info=>({name,description,side:'SURVIVOR',once,timing});
const killer=(name:string,description:string,timing:Info['timing']='PASSIVE',once=false):Info=>({name,description,side:'KILLER',once,timing});
export const TERROR_TRAIT_INFO:Record<TerrorTrait,Info>={
 MARTIAL:survivor('Martial Arts','방어 아이템 미사용 시 방어 +1.'),
 HURRIED:survivor('Hurried Flee','살인마로부터 거리 1 이내에서 기본 이동을 시작하면 최대 3칸 이동.'),
 INTREPID:survivor('Intrepidity','기본 이동을 선택하면 공포 1 제거.'),
 FIRST_AID:survivor('First Aid','일회용 기본 행동: 같은 장소의 다른 생존자를 치료.','ACTION',true),
 SURVIVAL_INSTINCT:survivor('Survival Instinct','조우 후 도주 최대 2칸, 이후 공포 모두 제거.'),
 MORALE:survivor('Morale Boost','기본 행동: 장소에 관계없이 다른 생존자 전원의 공포 1 제거.','ACTION'),
 SILENT_RETRIEVAL:survivor('Silent Retrieval','일회용: 이번 발견 카드로 발생한 소음을 취소.','LOOT',true),
 HEROIC_SAVE:survivor('Heroic Save','일회용: 다른 생존자와 함께 조우 시 다른 생존자들이 1칸 이동해 조우를 피하도록 함.','ENCOUNTER',true),
 DECOY:survivor('Sound Decoy','일회용 추가 행동: 지도 한 장소에 소음.','ACTION',true),
 TAUNT:survivor('Taunting Strategy','기본 행동: 현 위치 소음. 살인마 덱 3장 버린 뒤 1장 뽑기.','ACTION'),
 LUCK:survivor('A Stroke of Luck','방어 주사위가 모두 0이면 방어 성공.'),
 VIGILANT:survivor('Hypervigilance','살인마와 같은 장소에서는 아이템·기본 행동 소음 없음. 특성·계획 소음은 제외.'),
 SECRET_WEAPON:survivor('Secret Weapon','일회용: 방어 아이템 대신 방어 +4.','DEFEND',true),
 SLEIGHT:survivor('Sleight of Hand','일회용: 방금 발견한 두 아이템을 모두 보관.','LOOT',true),
 JUDICIOUS:survivor('Judicious Move','일회용 추가 행동: 지도 봉쇄 하나 제거, 자신의 공포 모두 제거, 또는 인접 장소 소음 중 하나.','ACTION',true),
 PROMPT:survivor('Prompt Reaction','일회용 추가 행동: 1칸 이동.','ACTION',true),
 BURST:survivor('Burst of Speed','일회용 기본 행동: 출발지 소음 후 2–4칸 이동.','ACTION',true),
 COORDINATOR:survivor('Coordinator','기본 행동: 같은 장소의 다른 생존자들이 각자 1–2칸 이동할 수 있음.','ACTION'),
 HERBOLOGY:survivor('Herbology','약초로 치료할 때 소음 없음.'),
 MARKSMAN:survivor('Marksmanship','시작 시 발견 덱의 리볼버 획득 후 덱 섞기. 탄약 방어 +1.'),
 FATAL:killer('Fatal Attack','공격력 +1.'),
 ENTRAPMENT:killer('Insidious Entrapment','일회용: 지도 문 두 개 봉쇄.','ACTION',true),
 LIE_WAIT:killer('Lie in Wait','레벨 2로 시작하고 첫 살인마 차례를 건너뜀.'),
 MURDEROUS:killer('Murderous Intent','감지 성공 시 손패 1장을 버려 감지된 생존자들에게 공포.','SENSE'),
 HEIGHTENED:killer('Heightened Senses','차례당 한 번, 감지 성공 후 추가로 한 색 구역 감지.','SENSE'),
 DETERRENCE:killer('Deterrence','레벨 3/4/5 도달 시 선택한 생존자 1명에게 공포.','LEVEL'),
 SLY:killer('Sly Entrapper','레벨 2/4 도달 시 지도 문 하나 봉쇄.','LEVEL'),
 AURA:killer('Terror Aura','조우하지 않고 은신하지 않은 차례 끝에 현 위치 전원에게 공포.','END'),
 PERILOUS:killer('Perilous Ambush','조우하지 않고 은신하지 않은 차례 끝에 손패 2장을 버려 0–2칸 은신.','END'),
 ENCIRCLE:killer('Total Encirclement','조우하지 않고 은신하지 않은 차례 끝에 손패 2장을 버려 현재 장소 문 하나 봉쇄.','END'),
 TOYING:killer('Toying with the Prey','조우를 즉시 취소하고 차례를 끝내며 카드 6장을 뽑을 수 있음.','ENCOUNTER'),
 DEVIOUS:killer('Devious Ploy','시작 손패 +1. 초과한 새 카드를 버리는 대신 손패의 다른 카드를 버릴 수 있음.'),
 NIGHTMARE:killer('Nightmare Descends','게임 시작에 모든 생존자에게 공포.'),
 SWIFT:killer('Swift Action','차례 시작, 은신하지 않았다면 손패 2장을 버려 1칸 이동.','START'),
 ACUTE:killer('Acute Hearing','차례 시작, 손패 1장을 버려 소음이 있는 장소 하나 감지.','START'),
 ENHANCED:killer('Enhanced Tracking','차례 시작, 은신하지 않았다면 손패 1장을 버려 거리 1 이내 전부 감지.','START'),
 SELF_CHALLENGE:killer('Self-challenge','시작 손패 +1, 공격력 -1. 레벨 3에 도달하면 즉시 레벨 4.'),
 SUPPRESSED:killer('Suppressed Rage','시작 공격력 -1, 레벨 상승 때마다 공격력 +1.'),
 IMMEDIATE:killer('Immediate Response','감지 성공 시 손패 1장을 버려 1칸 이동.','SENSE'),
 TERRORISING:killer('Terrorising the Mass','생존자에게 피해를 줄 때마다 모든 생존자에게 공포.'),
};
