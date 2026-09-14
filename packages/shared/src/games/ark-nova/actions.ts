import * as v from 'valibot';
export const ARK_RULES_VERSION = 'ark-nova-base-map-a-v1' as const;
export const ArkRefSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export const ArkCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10000));
export const ArkActionKindSchema = v.picklist(['CARDS','BUILD','ANIMALS','ASSOCIATION','SPONSORS']);
export type ArkActionKind = v.InferOutput<typeof ArkActionKindSchema>;
export const ARK_ACTIONS: readonly ArkActionKind[] = ['CARDS','BUILD','ANIMALS','ASSOCIATION','SPONSORS'];
export const ARK_ACTION_LABELS: Record<ArkActionKind,string> = {CARDS:'카드',BUILD:'건설',ANIMALS:'동물',ASSOCIATION:'협회',SPONSORS:'후원자'};
export const ArkCellSchema = v.strictObject({q:v.pipe(v.number(),v.safeInteger(),v.minValue(-20),v.maxValue(20)),r:v.pipe(v.number(),v.safeInteger(),v.minValue(-20),v.maxValue(20))});
export type ArkCell=v.InferOutput<typeof ArkCellSchema>;
export const ArkActionSchema = v.variant('kind',[
 v.strictObject({kind:v.literal('BEGIN'),action:ArkActionKindSchema,x:v.pipe(ArkCountSchema,v.maxValue(5)),alternative:v.boolean(),multiplier:v.boolean()}),
 v.strictObject({kind:v.literal('CHOOSE'),choiceId:ArkRefSchema,options:v.pipe(v.array(ArkRefSchema),v.maxLength(250))}),
 v.strictObject({kind:v.literal('PLACE'),choiceId:ArkRefSchema,building:ArkRefSchema,anchor:ArkCellSchema,rotation:v.picklist([0,1,2,3,4,5]),reflected:v.boolean()}),
 v.strictObject({kind:v.literal('CANCEL')}),
]);
export type ArkAction=v.InferOutput<typeof ArkActionSchema>;
export const ArkCardSchema=v.strictObject({cardId:ArkRefSchema,key:ArkRefSchema});
export type ArkCard=v.InferOutput<typeof ArkCardSchema>;
export const ArkBuildingSchema=v.strictObject({id:ArkRefSchema,kind:ArkRefSchema,cells:v.pipe(v.array(ArkCellSchema),v.minLength(1),v.maxLength(10)),occupied:v.boolean(),used:ArkCountSchema});
export type ArkBuilding=v.InferOutput<typeof ArkBuildingSchema>;
export const ArkActionCardSchema=v.strictObject({kind:ArkActionKindSchema,upgraded:v.boolean(),venom:v.boolean(),constriction:v.boolean(),multiplier:ArkCountSchema});
export type ArkActionCard=v.InferOutput<typeof ArkActionCardSchema>;
export const ArkOptionSchema=v.strictObject({id:ArkRefSchema,label:v.pipe(v.string(),v.maxLength(400)),card:v.nullable(ArkCardSchema),disabled:v.boolean(),reason:v.pipe(v.string(),v.maxLength(250))});
export type ArkOption=v.InferOutput<typeof ArkOptionSchema>;
export const ARK_CONTINENTS=['Africa','Americas','Asia','Australia','Europe'] as const;
export const ARK_ANIMAL_TAGS=['Predator','Herbivore','Primate','Reptile','Bird','Pet'] as const;
export const ARK_TAG_LABELS:Readonly<Record<string,string>>={Africa:'아프리카',Americas:'아메리카',Asia:'아시아',Australia:'오세아니아',Europe:'유럽',Predator:'육식',Herbivore:'초식',Primate:'영장류',Reptile:'파충류',Bird:'조류',Pet:'체험 동물',Bear:'곰',Science:'연구',Water:'물',Rock:'바위',Partner_Zoo:'제휴 동물원',AnimalsII:'동물 II',SponsorsII:'후원자 II',Appeal:'매력 25 이하',Reputation:'평판',ALL_ANIMALS:'동물 종류',ALL_CONTINENTS:'대륙 종류',ANIMAL_SIZE_2:'소형 동물',ANIMAL_SIZE_4:'대형 동물'};
