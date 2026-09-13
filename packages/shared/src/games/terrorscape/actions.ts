import * as v from 'valibot';
import {TerrorTraitSchema,TerrorDifficultySchema} from './traits.js';
import {TerrorPlanSchema} from './plans.js';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';
export const TERROR_ROOMS=['R1','R2','R3','R4','R5','B1','B2','B3','B4','B5','G1','G2','G3','G4','G5'] as const;
export const TerrorRoomSchema=v.picklist(TERROR_ROOMS);
export type TerrorRoom=v.InferOutput<typeof TerrorRoomSchema>;
export const TERROR_CHARACTERS=['ANNA','WILLIAM','MARCO','SOPHIA','JOHNSON'] as const;
export const TerrorCharacterSchema=v.picklist(TERROR_CHARACTERS);
export type TerrorCharacter=v.InferOutput<typeof TerrorCharacterSchema>;
export const TERROR_KILLERS=['BUTCHER','SPECTRE','MURDERER','WEREWOLF','HUNTRESS'] as const;
export const TerrorKillerSchema=v.picklist(TERROR_KILLERS);
export type TerrorKiller=v.InferOutput<typeof TerrorKillerSchema>;
export const TERROR_ITEMS=['KEY','TOOLBOX','WHISKEY','HATCHET','HERBS','POWDER','AMMO','ADRENALINE','TRANQUILIZER','REVOLVER','FIRECRACKER','AMULET','SHORTSWORD','SECRET_MAP','FLASHLIGHT','LONGSWORD','TRAP_PARTS','MEDKIT','CAMERA','SILVER_DAGGER','SILVER_BULLETS'] as const;
export const TerrorItemSchema=v.picklist(TERROR_ITEMS);
export type TerrorItem=v.InferOutput<typeof TerrorItemSchema>;
export const TerrorCardSchema=v.strictObject({cardId:TileIdSchema,key:TerrorItemSchema});
export type TerrorCard=v.InferOutput<typeof TerrorCardSchema>;
export const TERROR_SKILLS=['PURSUE','BARRICADE','SENSE','CHAINSAW','MADNESS','STAY','RAGE','SCREAM','WHIZZ','TRAIL','VANISH','DRAIN','DEDUCTION','NOTICE','STALK','LURK','BLOSSOM','HOWL','SAVAGE_BITE','BLOOD_HUNT','TERRITORIAL','HYPER_HEARING','HUNTING_INSTINCT','AXE_THROW','BATED_BREATH','TRACKING','TRAPS_RESET'] as const;
export const TerrorSkillSchema=v.picklist(TERROR_SKILLS);
export type TerrorSkill=v.InferOutput<typeof TerrorSkillSchema>;
export const TerrorKillerCardSchema=v.strictObject({cardId:TileIdSchema,key:TerrorSkillSchema});
export type TerrorKillerCard=v.InferOutput<typeof TerrorKillerCardSchema>;
export const TerrorMapSchema=v.picklist(['MANOR','CABIN']);
export type TerrorMap=v.InferOutput<typeof TerrorMapSchema>;
export const TerrorHuntTrapSchema=v.picklist(['NET_A','NET_B','SKULL','BEAR']);
export type TerrorHuntTrap=v.InferOutput<typeof TerrorHuntTrapSchema>;
export const TerrorTrapPlacementSchema=v.strictObject({trap:TerrorHuntTrapSchema,room:TerrorRoomSchema});
const path=v.pipe(v.array(TerrorRoomSchema),v.maxLength(6));
const edge=v.pipe(v.string(),v.maxLength(5));
export const TerrorscapeActionSchema=v.variant('type',[
 v.strictObject({type:v.literal('SET_MAP'),map:TerrorMapSchema}),
 v.strictObject({type:v.literal('SET_TRAPS'),placements:v.pipe(v.array(TerrorTrapPlacementSchema),v.length(4))}),
 v.strictObject({type:v.literal('OPEN_CACHE'),character:TerrorCharacterSchema,kind:v.picklist(['SUITCASE','TREASURE'])}),
 v.strictObject({type:v.literal('SET_ROLES'),killerPlayerId:PlayerIdSchema,owners:v.pipe(v.array(PlayerIdSchema),v.length(3))}),
 v.strictObject({type:v.literal('SET_CAST'),killer:TerrorKillerSchema,characters:v.pipe(v.array(TerrorCharacterSchema),v.length(3))}),
 v.strictObject({type:v.literal('PASSAGE'),character:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('ATTACK_CARD'),cardId:v.nullable(TileIdSchema),cost:v.optional(v.pipe(v.array(TileIdSchema),v.maxLength(1)))}),
 v.strictObject({type:v.literal('SPECTRE_SEARCH'),cost:v.pipe(v.array(TileIdSchema),v.maxLength(2))}),
 v.strictObject({type:v.literal('FEAR_REACTION'),cost:v.pipe(v.array(TileIdSchema),v.maxLength(3))}),
 v.strictObject({type:v.literal('REAPPEAR_TARGET'),target:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('LEVEL_BLOCK'),edge,replaces:v.pipe(v.array(edge),v.maxLength(1))}),
 v.strictObject({type:v.literal('SET_SEPARATE'),enabled:v.boolean()}),
 v.strictObject({type:v.literal('CORPSE_LOOT'),character:TerrorCharacterSchema,target:TerrorCharacterSchema,cardId:TileIdSchema}),
 v.strictObject({type:v.literal('SET_DIFFICULTY'),difficulty:TerrorDifficultySchema}),
 v.strictObject({type:v.literal('CHOOSE_TRAITS'),character:v.nullable(TerrorCharacterSchema),traits:v.pipe(v.array(TerrorTraitSchema),v.maxLength(3))}),
 v.strictObject({type:v.literal('TRAIT_USE'),trait:TerrorTraitSchema,character:v.nullable(TerrorCharacterSchema),target:TerrorCharacterSchema,path,room:TerrorRoomSchema,zone:v.picklist(['R','B','G']),choice:v.picklist(['FEAR','NOISE','BLOCK']),cost:v.pipe(v.array(TileIdSchema),v.maxLength(3)),edges:v.pipe(v.array(edge),v.maxLength(2)),replaces:v.pipe(v.array(edge),v.maxLength(7))}),
 v.strictObject({type:v.literal('TRAIT_PASS')}),
 v.strictObject({type:v.literal('GROUP_MOVE'),character:TerrorCharacterSchema,path}),
 v.strictObject({type:v.literal('SET_PLANS'),enabled:v.boolean()}),
 v.strictObject({type:v.literal('PLAN_PROGRESS'),plan:v.nullable(TerrorPlanSchema),target:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('PLAN_USE'),character:TerrorCharacterSchema,target:TerrorCharacterSchema,path,destination:TerrorRoomSchema,cards:v.pipe(v.array(TileIdSchema),v.maxLength(3))}),
 v.strictObject({type:v.literal('BEGIN_HUNT')}),
 v.strictObject({type:v.literal('BASIC'),character:TerrorCharacterSchema,kind:v.picklist(['MOVE','CALM','REPAIR','SEARCH','REMOVE_BLOCK','SPRINT','RECOVER']),path,edge,cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('ITEM'),character:TerrorCharacterSchema,cardId:TileIdSchema,target:TerrorCharacterSchema,destination:TerrorRoomSchema,edge}),
 v.strictObject({type:v.literal('TRADE'),character:TerrorCharacterSchema,target:TerrorCharacterSchema,cardId:TileIdSchema}),
 v.strictObject({type:v.literal('DISCARD'),character:TerrorCharacterSchema,cardId:TileIdSchema}),
 v.strictObject({type:v.literal('READY'),character:TerrorCharacterSchema,ready:v.boolean()}),
 v.strictObject({type:v.literal('DISCOVER'),character:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('KEEP'),cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('KILLER_BASIC'),kind:v.picklist(['MOVE','SEARCH']),destination:TerrorRoomSchema}),
 v.strictObject({type:v.literal('KILLER_CARD'),target:v.optional(TerrorCharacterSchema),cardId:TileIdSchema,cost:v.pipe(v.array(TileIdSchema),v.maxLength(4)),path,zone:v.picklist(['R','B','G']),edge,replaces:v.pipe(v.array(edge),v.maxLength(7))}),
 v.strictObject({type:v.literal('KILLER_NEXT')}),
 v.strictObject({type:v.literal('UNLOCK_DISCARD'),cardId:TileIdSchema}),
 v.strictObject({type:v.literal('RAGE_MOVE'),path}),
 v.strictObject({type:v.literal('DEFENDER'),character:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('DEFEND'),cardId:v.nullable(TileIdSchema),molotov:v.optional(v.boolean())}),
 v.strictObject({type:v.literal('FLEE'),character:TerrorCharacterSchema,destination:TerrorRoomSchema,path:v.optional(path)}),
 v.strictObject({type:v.literal('PING'),room:TerrorRoomSchema,message:v.picklist(['GO','SEARCH','REPAIR','HELP'])}),
]);
export type TerrorscapeAction=v.InferOutput<typeof TerrorscapeActionSchema>;
export const TERROR_ITEM_INFO:Readonly<Record<TerrorItem,{name:string;description:string;noisy:boolean}>>={
 SILVER_DAGGER:{name:'은 단검',description:'Silver Dagger · 방어 +5. 사용 후 보관.',noisy:false},
 SILVER_BULLETS:{name:'은 탄환',description:'Silver Bullets · 리볼버 필요. 이번 방어에서 굴린 1과 3을 모두 5로 바꿉니다. 탄환만 소모.',noisy:false},
 KEY:{name:'열쇠',description:'발견 즉시 팀이 공유합니다. 5개를 모아 함께 탈출하세요.',noisy:true},
 TOOLBOX:{name:'공구상자',description:'특수 행동 · 무전기 장소에서 2 수리하고 소음을 냅니다. 존슨은 3 수리. 소모.',noisy:true},
 WHISKEY:{name:'위스키',description:'추가 행동 · 인접 장소에 병을 던져 소음을 냅니다. 소모.',noisy:false},
 HATCHET:{name:'손도끼',description:'방어 +1 또는 추가 행동으로 인접 봉쇄 제거. 소모.',noisy:false},
 HERBS:{name:'약초',description:'특수 행동 · 같은 장소의 부상자를 치료하고 소음을 냅니다. 소모.',noisy:false},
 POWDER:{name:'석회가루',description:'방어 +2. 소모.',noisy:false},
 AMMO:{name:'탄약',description:'리볼버를 가진 경우 방어 +4. 탄약만 소모.',noisy:false},
 ADRENALINE:{name:'아드레날린',description:'추가 행동 · 인접 장소로 1칸 이동. 소모.',noisy:false},
 TRANQUILIZER:{name:'진정제',description:'추가 행동 · 자신의 공포를 모두 제거. 소모.',noisy:false},
 REVOLVER:{name:'리볼버',description:'탄약을 사용해 방어할 수 있습니다. 리볼버는 보관.',noisy:false},
 FIRECRACKER:{name:'폭죽',description:'특수 행동 · 저택 전체에 소음을 만들어 위치를 가립니다. 소모.',noisy:false},
 AMULET:{name:'부적',description:'조우 공격 외 피해 한 번을 막고 소모. Lv5 조우 부상과 Death Blossom 즉사는 막지 못합니다.',noisy:true},
 SHORTSWORD:{name:'단검',description:'방어 +1. 사용 후에도 보관.',noisy:false},
 SECRET_MAP:{name:'비밀 지도',description:'열쇠 5개와 생존자 전원이 숨겨진 출구에 있으면 숨겨진 출구로 탈출.',noisy:false},
 FLASHLIGHT:{name:'손전등',description:'특수 행동 · 현재 지도의 같은 번호 비밀 통로 이동. 보관.',noisy:false},
 LONGSWORD:{name:'장검',description:'방어 +3. 살인마가 즉시 카드 1장을 뽑습니다. 보관.',noisy:true},
 TRAP_PARTS:{name:'덫',description:'특수 행동 · 현 위치에 덫 설치. 그 장소의 다음 첫 방어 +2. 소모.',noisy:false},
 CAMERA:{name:'소피아의 카메라',description:'소피아 전용 · 추가 행동으로 현 위치에 소음. 소모.',noisy:false},
 MEDKIT:{name:'응급키트',description:'마르코 특수 행동 · 같은 장소의 부상자 치료와 대상 공포 제거. 소모.',noisy:false},
};
export const TERROR_SKILL_INFO:Readonly<Record<TerrorSkill,{name:string;timing:'FAST'|'MAIN'|'SLOW'|'ATTACK';cost:number;description:string}>>={
 HOWL:{name:'울부짖음',timing:'FAST',cost:2,description:'Howl · 거리 2 이내 모든 생존자 공포 1, 이어서 1칸 이동.'},
 SAVAGE_BITE:{name:'야수의 이빨',timing:'ATTACK',cost:0,description:'Savage Bite · 이번 공격력 +2.'},
 BLOOD_HUNT:{name:'피의 사냥',timing:'FAST',cost:0,description:'Blood Hunt · 부상자가 있을 때만 사용. 2칸 이동.'},
 TERRITORIAL:{name:'영역 감각',timing:'FAST',cost:0,description:'Territorial Awareness · 빠른 카드: 모든 수색 장소 감지. 또는 느린 카드: 0–3칸 은신.'},
 HYPER_HEARING:{name:'초청각',timing:'FAST',cost:3,description:'Hyper-hearing · 가장 가까운 소음 장소까지 0–6칸 이동 후 수색. 동률이면 선택.'},
 HUNTING_INSTINCT:{name:'사냥 본능',timing:'FAST',cost:1,description:'Hunting Instinct · 장소 한 곳을 감지. 안나는 감지되지 않습니다.'},
 AXE_THROW:{name:'도끼 투척',timing:'ATTACK',cost:1,description:'Axe Throw · 이번 공격력 +4.'},
 BATED_BREATH:{name:'숨죽인 매복',timing:'MAIN',cost:2,description:'Bated Breath · 카드 1장 뽑기 → 0–2칸 은신. 다음 살인자 차례 종료까지 공격력 +3.'},
 TRACKING:{name:'발자국 추적',timing:'FAST',cost:1,description:'Tracking · 수색. 조우하지 않았다면 생존자 한 명까지의 거리 확인. 레벨 4부터 이어서 0–1칸 이동.'},
 TRAPS_RESET:{name:'함정 재설치',timing:'MAIN',cost:3,description:'Traps Reset · 아무 장소로 은신 후 함정 4개 재배치. 장소당 최대 1개.'},
 SCREAM:{name:'비명',timing:'FAST',cost:0,description:'거리 1 이내 모든 생존자에게 공포 1.'},
 WHIZZ:{name:'섬찟한 이동',timing:'MAIN',cost:0,description:'1–4칸 이동하며 출발지와 경로의 생존자에게 공포 1. 레벨 2부터 카드 2장을 버려 추가 수색 가능.'},
 TRAIL:{name:'공포가 남긴 흔적',timing:'FAST',cost:1,description:'공포가 있는 모든 생존자의 위치를 공개합니다. 감지가 아니므로 안나도 포함.'},
 VANISH:{name:'소멸',timing:'SLOW',cost:1,description:'0–2칸 은신 이동. 다음 등장 시 거리 1 이내 공포 1, 이어서 수색.'},
 DRAIN:{name:'생명력 흡수',timing:'MAIN',cost:-1,description:'나머지 손패 모두 버림. 공포가 있는 모든 생존자에게 부상 1.'},
 DEDUCTION:{name:'논리적 추론',timing:'FAST',cost:1,description:'서로 인접한 장소 두 곳을 감지합니다. 지도에서 두 장소를 직접 지정하세요.'},
 NOTICE:{name:'살인 예고',timing:'FAST',cost:1,description:'모든 생존자에게 공포 1.'},
 STALK:{name:'잠복',timing:'SLOW',cost:0,description:'느린 카드로 0–2칸 은신 이동 또는 공격 직전에 사용해 이번 공격력 +1.'},
 LURK:{name:'도사리는 위협',timing:'SLOW',cost:1,description:'0–2칸 은신 이동. 다음 등장 시 생존자 한 명에게 공포 1, 이어서 수색.'},
 BLOSSOM:{name:'죽음의 꽃이 피다',timing:'SLOW',cost:2,description:'0–2칸 은신 이동. 다음 등장 시 거리 1 이내 모든 생존자를 즉시 제거.'},
 PURSUE:{name:'추격',timing:'FAST',cost:0,description:'1칸 이동합니다. 지나간 봉쇄는 제거합니다.'},
 BARRICADE:{name:'봉쇄',timing:'SLOW',cost:0,description:'현재 장소의 문 하나를 봉쇄합니다.'},
 SENSE:{name:'감지',timing:'FAST',cost:0,description:'한 구역에 있는 생존자의 이름을 감지합니다. 안나는 감지되지 않습니다.'},
 CHAINSAW:{name:'전기톱',timing:'MAIN',cost:2,description:'거리 1 이내 생존자 공포 +1 → 0~1칸 이동 → 같은 장소 전원 부상. 레벨 4부터 빠른 카드.'},
 MADNESS:{name:'광기',timing:'FAST',cost:2,description:'문 하나 봉쇄, 이번 차례 공격력 +2.'},
 STAY:{name:'꼼짝 마',timing:'SLOW',cost:4,description:'현재 장소의 문을 모두 봉쇄합니다.'},
 RAGE:{name:'난폭한 분노',timing:'MAIN',cost:1,description:'1~2칸 이동 후 수색. 아무도 없고 이동 중 봉쇄를 제거했다면 반복합니다.'},
};
export const TERROR_CHARACTER_INFO={ANNA:{name:'안나',ability:'감지 면역 · 수색 카드 소음 없음'},WILLIAM:{name:'윌리엄',ability:'무기 없이 방어 +1 · 3칸 달리기'},MARCO:{name:'마르코',ability:'응급키트 · 버림패의 약품 회수'},SOPHIA:{name:'소피아',ability:'카메라 · 비밀 통로 이동 (손전등 보유 시 추가 행동)'},JOHNSON:{name:'존슨',ability:'소지품 한도 없음 · 공구상자 수리 +1'}} as const;

export const TERROR_KILLER_INFO={WEREWOLF:{name:'늑대인간',strength:6,description:'Feral Instincts · 레벨 2 초청각 해금, 레벨 3 공격력 +1, 레벨 4 비조우·비은신 차례 종료에 거리 2 공포. 생존자는 은 무기 보물 상자 사용.'},HUNTRESS:{name:'사냥꾼',strength:3,description:'Feral Instincts · 비공개 함정 4개. 레벨 2 함정 재설치, 레벨 3 카드 비용 -1(최소 0), 레벨 4 추적 후 0–1칸 이동.'},BUTCHER:{name:'도살자',strength:5,description:'봉쇄를 부수는 추격과 전기톱. 레벨 2 공격력 +1, 레벨 3 분노 해금, 레벨 4 전기톱 빠른 카드.'},SPECTRE:{name:'망령',strength:2,description:'조우 시 공포. 레벨 2 스쳐 지나간 뒤 추가 수색, 레벨 3 공포 넘침에 카드 3장으로 부상, 레벨 4 생명 흡수 해금.'},MURDERER:{name:'학살자',strength:4,description:'은신과 기습. 레벨 2 재등장 조우 공격력 +3, 레벨 3 죽음의 꽃 해금, 레벨 4 공격력 +2와 즉시 봉쇄 4회.'}} as const;
export function terrorInventoryLimit(character:TerrorCharacter):number{return character==='JOHNSON'?49:3;}
export function terrorSkillCost(skill:TerrorSkill,handSize:number,killer:TerrorKiller='BUTCHER',level=1):number{if(killer==='HUNTRESS'&&level>=3)return Math.max(0,TERROR_SKILL_INFO[skill].cost-1);return skill==='DRAIN'?Math.max(0,handSize-1):TERROR_SKILL_INFO[skill].cost;}
