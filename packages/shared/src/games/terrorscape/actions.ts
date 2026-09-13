import * as v from 'valibot';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';
export const TERROR_ROOMS=['R1','R2','R3','R4','R5','B1','B2','B3','B4','B5','G1','G2','G3','G4','G5'] as const;
export const TerrorRoomSchema=v.picklist(TERROR_ROOMS);
export type TerrorRoom=v.InferOutput<typeof TerrorRoomSchema>;
export const TERROR_CHARACTERS=['ANNA','WILLIAM','MARCO'] as const;
export const TerrorCharacterSchema=v.picklist(TERROR_CHARACTERS);
export type TerrorCharacter=v.InferOutput<typeof TerrorCharacterSchema>;
export const TERROR_ITEMS=['KEY','TOOLBOX','WHISKEY','HATCHET','HERBS','POWDER','AMMO','ADRENALINE','TRANQUILIZER','REVOLVER','FIRECRACKER','AMULET','SHORTSWORD','SECRET_MAP','FLASHLIGHT','LONGSWORD','TRAP_PARTS','MEDKIT'] as const;
export const TerrorItemSchema=v.picklist(TERROR_ITEMS);
export type TerrorItem=v.InferOutput<typeof TerrorItemSchema>;
export const TerrorCardSchema=v.strictObject({cardId:TileIdSchema,key:TerrorItemSchema});
export type TerrorCard=v.InferOutput<typeof TerrorCardSchema>;
export const TERROR_SKILLS=['PURSUE','BARRICADE','SENSE','CHAINSAW','MADNESS','STAY','RAGE'] as const;
export const TerrorSkillSchema=v.picklist(TERROR_SKILLS);
export type TerrorSkill=v.InferOutput<typeof TerrorSkillSchema>;
export const TerrorKillerCardSchema=v.strictObject({cardId:TileIdSchema,key:TerrorSkillSchema});
export type TerrorKillerCard=v.InferOutput<typeof TerrorKillerCardSchema>;
const path=v.pipe(v.array(TerrorRoomSchema),v.maxLength(3));
const edge=v.pipe(v.string(),v.maxLength(5));
export const TerrorscapeActionSchema=v.variant('type',[
 v.strictObject({type:v.literal('SET_ROLES'),killerPlayerId:PlayerIdSchema,owners:v.pipe(v.array(PlayerIdSchema),v.length(3))}),
 v.strictObject({type:v.literal('BEGIN_HUNT')}),
 v.strictObject({type:v.literal('BASIC'),character:TerrorCharacterSchema,kind:v.picklist(['MOVE','CALM','REPAIR','SEARCH','REMOVE_BLOCK','SPRINT','RECOVER']),path,edge,cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('ITEM'),character:TerrorCharacterSchema,cardId:TileIdSchema,target:TerrorCharacterSchema,destination:TerrorRoomSchema,edge}),
 v.strictObject({type:v.literal('TRADE'),character:TerrorCharacterSchema,target:TerrorCharacterSchema,cardId:TileIdSchema}),
 v.strictObject({type:v.literal('DISCARD'),character:TerrorCharacterSchema,cardId:TileIdSchema}),
 v.strictObject({type:v.literal('READY'),character:TerrorCharacterSchema,ready:v.boolean()}),
 v.strictObject({type:v.literal('DISCOVER'),character:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('KEEP'),cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('KILLER_BASIC'),kind:v.picklist(['MOVE','SEARCH']),destination:TerrorRoomSchema}),
 v.strictObject({type:v.literal('KILLER_CARD'),cardId:TileIdSchema,cost:v.pipe(v.array(TileIdSchema),v.maxLength(4)),path,zone:v.picklist(['R','B','G']),edge,replaces:v.pipe(v.array(edge),v.maxLength(7))}),
 v.strictObject({type:v.literal('KILLER_NEXT')}),
 v.strictObject({type:v.literal('UNLOCK_DISCARD'),cardId:TileIdSchema}),
 v.strictObject({type:v.literal('RAGE_MOVE'),path}),
 v.strictObject({type:v.literal('DEFENDER'),character:TerrorCharacterSchema}),
 v.strictObject({type:v.literal('DEFEND'),cardId:v.nullable(TileIdSchema)}),
 v.strictObject({type:v.literal('FLEE'),character:TerrorCharacterSchema,destination:TerrorRoomSchema}),
 v.strictObject({type:v.literal('PING'),room:TerrorRoomSchema,message:v.picklist(['GO','SEARCH','REPAIR','HELP'])}),
]);
export type TerrorscapeAction=v.InferOutput<typeof TerrorscapeActionSchema>;
export const TERROR_ITEM_INFO:Readonly<Record<TerrorItem,{name:string;description:string;noisy:boolean}>>={
 KEY:{name:'열쇠',description:'발견 즉시 팀이 공유합니다. 5개를 모아 함께 탈출하세요.',noisy:true},
 TOOLBOX:{name:'공구상자',description:'특수 행동 · 거실 무전기를 2 수리하고 소음을 냅니다. 소모.',noisy:false},
 WHISKEY:{name:'위스키',description:'추가 행동 · 인접 장소에 병을 던져 소음을 냅니다. 소모.',noisy:false},
 HATCHET:{name:'손도끼',description:'방어 +1 또는 추가 행동으로 인접 봉쇄 제거. 소모.',noisy:false},
 HERBS:{name:'약초',description:'특수 행동 · 같은 장소의 부상자를 치료하고 소음을 냅니다. 소모.',noisy:false},
 POWDER:{name:'석회가루',description:'방어 +2. 소모.',noisy:false},
 AMMO:{name:'탄약',description:'리볼버를 가진 경우 방어 +4. 탄약만 소모.',noisy:false},
 ADRENALINE:{name:'아드레날린',description:'추가 행동 · 인접 장소로 1칸 이동. 소모.',noisy:false},
 TRANQUILIZER:{name:'진정제',description:'추가 행동 · 자신의 공포를 모두 제거. 소모.',noisy:false},
 REVOLVER:{name:'리볼버',description:'탄약을 사용해 방어할 수 있습니다. 리볼버는 보관.',noisy:false},
 FIRECRACKER:{name:'폭죽',description:'특수 행동 · 저택 전체에 소음을 만들어 위치를 가립니다. 소모.',noisy:false},
 AMULET:{name:'부적',description:'생존자 차례 시작마다 자신의 공포 1 제거. 보관.',noisy:true},
 SHORTSWORD:{name:'단검',description:'방어 +1. 사용 후에도 보관.',noisy:false},
 SECRET_MAP:{name:'비밀 지도',description:'열쇠 5개와 생존자 전원이 정원에 있으면 숨겨진 출구로 탈출.',noisy:false},
 FLASHLIGHT:{name:'손전등',description:'특수 행동 · 거실↔묘지 또는 연회장↔정원 비밀 통로 이동. 보관.',noisy:false},
 LONGSWORD:{name:'장검',description:'방어 +3. 살인마가 즉시 카드 1장을 뽑습니다. 보관.',noisy:true},
 TRAP_PARTS:{name:'덫',description:'특수 행동 · 현 위치에 덫 설치. 그 장소의 다음 첫 방어 +2. 소모.',noisy:false},
 MEDKIT:{name:'응급키트',description:'마르코 특수 행동 · 같은 장소의 부상자 치료와 대상 공포 제거. 소모.',noisy:false},
};
export const TERROR_SKILL_INFO:Readonly<Record<TerrorSkill,{name:string;timing:'FAST'|'MAIN'|'SLOW';cost:number;description:string}>>={
 PURSUE:{name:'추격',timing:'FAST',cost:0,description:'1칸 이동합니다. 지나간 봉쇄는 제거합니다.'},
 BARRICADE:{name:'봉쇄',timing:'SLOW',cost:0,description:'현재 장소의 문 하나를 봉쇄합니다.'},
 SENSE:{name:'감지',timing:'FAST',cost:0,description:'한 구역의 생존자 위치를 감지합니다. 안나는 감지되지 않습니다.'},
 CHAINSAW:{name:'전기톱',timing:'MAIN',cost:2,description:'거리 1 이내 생존자 공포 +1 → 0~1칸 이동 → 같은 장소 전원 부상. 레벨 4부터 빠른 카드.'},
 MADNESS:{name:'광기',timing:'FAST',cost:2,description:'문 하나 봉쇄, 이번 차례 공격력 +2.'},
 STAY:{name:'꼼짝 마',timing:'SLOW',cost:4,description:'현재 장소의 문을 모두 봉쇄합니다.'},
 RAGE:{name:'난폭한 분노',timing:'MAIN',cost:1,description:'1~2칸 이동 후 수색. 아무도 없고 이동 중 봉쇄를 제거했다면 반복합니다.'},
};
export const TERROR_CHARACTER_INFO={ANNA:{name:'안나',ability:'감지 면역 · 수색 카드 소음 없음'},WILLIAM:{name:'윌리엄',ability:'무기 없이 방어 +1 · 3칸 달리기'},MARCO:{name:'마르코',ability:'응급키트 · 버림패의 약품 회수'}} as const;
