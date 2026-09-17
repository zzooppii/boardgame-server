import * as v from 'valibot';
import {SpeakeasyBuildingKindSchema,SpeakeasyDeckSchema,SpeakeasyLocationSchema,SpeakeasyOperationSchema,SpeakeasyCountSchema,SpeakeasyDistrictIdSchema,TileIdSchema} from '@hangul-rummikub/shared';
const key=v.pipe(v.string(),v.minLength(1),v.maxLength(100));
const action=v.variant('kind',[
  v.strictObject({id:key,kind:v.literal('BOOK')}),
  v.strictObject({id:key,kind:v.literal('FAMILY'),vipCapacityByLevel:v.pipe(v.array(SpeakeasyCountSchema),v.length(5)),
    docks:v.pipe(v.array(v.strictObject({zone:v.picklist([0,1,2]),space:v.pipe(SpeakeasyCountSchema,v.maxValue(11))})),v.maxLength(36))}),
  v.strictObject({id:key,kind:v.literal('LEVEL'),operations:v.pipe(v.array(SpeakeasyOperationSchema),v.minLength(1),v.maxLength(5))}),
  v.strictObject({id:key,kind:v.literal('PRODUCE'),quantityByLevel:v.pipe(v.array(SpeakeasyCountSchema),v.length(5))}),
  v.strictObject({id:key,kind:v.literal('SELL'),limitByLevel:v.pipe(v.array(SpeakeasyCountSchema),v.length(5)),
    pricesByInfamy:v.pipe(v.array(v.strictObject({speakeasy:SpeakeasyCountSchema,premium:SpeakeasyCountSchema})),v.length(21))}),
  v.strictObject({id:key,kind:v.literal('DELIVER'),rangeBonus:SpeakeasyCountSchema,
    cardBonuses:v.array(v.strictObject({cardId:TileIdSchema,range:SpeakeasyCountSchema})),
    edges:v.pipe(v.array(v.tuple([SpeakeasyDistrictIdSchema,SpeakeasyDistrictIdSchema])),v.minLength(1),v.maxLength(120))}),
  v.strictObject({id:key,kind:v.literal('GOONS')}),
  v.strictObject({id:key,kind:v.literal('PROTECT'),costByPosition:v.pipe(v.array(v.pipe(v.number(),v.safeInteger(),v.minValue(1),v.maxValue(4))),v.minLength(2),v.maxLength(4))}),
  v.strictObject({id:key,kind:v.literal('OPERATION'),operations:v.pipe(v.array(SpeakeasyDeckSchema),v.minLength(1),v.maxLength(4))}),
  v.strictObject({id:key,kind:v.literal('BUILD'),kinds:v.pipe(v.array(SpeakeasyBuildingKindSchema),v.minLength(1),v.maxLength(4)),upgrade:v.boolean()}),
]);
export const SpeakeasyLocationProgramSchema=v.strictObject({location:SpeakeasyLocationSchema,
  rows:v.pipe(v.array(v.pipe(v.array(action),v.minLength(1),v.maxLength(6))),v.minLength(1),v.maxLength(6))});
export const SpeakeasyLocationProgressSchema=v.strictObject({program:SpeakeasyLocationProgramSchema,completed:v.array(key)});
export type SpeakeasyLocationProgram=v.InferOutput<typeof SpeakeasyLocationProgramSchema>;
export type SpeakeasyLocationProgress=v.InferOutput<typeof SpeakeasyLocationProgressSchema>;
export function availableLocationActions(s:SpeakeasyLocationProgress) {
  return s.program.rows.find(row=>row.some(a=>!s.completed.includes(a.id)))?.filter(a=>!s.completed.includes(a.id))??[];
}
export function parseLocationProgress(input:unknown):SpeakeasyLocationProgress {
  const s=v.parse(SpeakeasyLocationProgressSchema,input),ids=s.program.rows.flat().map(a=>a.id);
  if(s.program.location==='RESTAURANT'||new Set(ids).size!==ids.length||new Set(s.completed).size!==s.completed.length||s.completed.some(id=>!ids.includes(id))) throw new Error('Invalid location program.');
  for(const a of s.program.rows.flat()) if(a.kind==='DELIVER') {
    const edges=a.edges.map(([x,y])=>[Math.min(x,y),Math.max(x,y)].join(':'));
    if(a.edges.some(([x,y])=>x===y)||new Set(edges).size!==edges.length||new Set(a.cardBonuses.map(b=>b.cardId)).size!==a.cardBonuses.length) throw new Error('Invalid delivery catalog.');
  }
  for(const a of s.program.rows.flat()) if(a.kind==='FAMILY'&&new Set(a.docks.map(d=>`${d.zone}:${d.space}`)).size!==a.docks.length) throw new Error('Duplicate family dock catalog.');
  let waiting=false;
  for(const row of s.program.rows) {
    if(waiting&&row.some(a=>s.completed.includes(a.id))) throw new Error('Location row skipped.');
    if(row.some(a=>!s.completed.includes(a.id))) waiting=true;
  }
  return s;
}
