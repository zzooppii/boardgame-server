import * as v from 'valibot';
import { ArkActionKindSchema, ArkCountSchema, ArkRefSchema } from '@hangul-rummikub/shared';
import type { ArkZooEffect } from './animal-effects.js';
const Amount=v.union([ArkCountSchema,v.strictObject({kind:v.literal('ICONS'),tag:ArkRefSchema,factor:ArkCountSchema,cap:ArkCountSchema,scope:v.optional(v.literal('ALL'))}),
  v.strictObject({kind:v.literal('THRESHOLDS'),tag:ArkRefSchema,thresholds:v.pipe(v.array(ArkCountSchema),v.check(xs=>xs.every((n,i)=>i===0||n>xs[i-1]!)))})]);
/** Internal executable jobs, never accepted as client commands or copied wholesale into projections. */
export const ArkZooEffectSchema:v.GenericSchema<ArkZooEffect>=v.variant('kind',[
  v.strictObject({kind:v.literal('INTERACTION'),ability:v.picklist(['VENOM','CONSTRICTION','PILFERING','HYPNOSIS']),amount:ArkCountSchema,track:v.optional(v.literal('CONSERVATION'))}),
  v.strictObject({kind:v.literal('BREAK'),amount:ArkCountSchema}),
  v.strictObject({kind:v.literal('WAZA_PLAY'),upgraded:v.boolean()}),
  v.strictObject({kind:v.literal('PAID_SPONSOR'),usesSponsorToken:v.boolean()}),
  v.strictObject({kind:v.literal('MOVE_TO_SPECIAL'),buildingId:ArkRefSchema,moved:v.pipe(v.array(ArkRefSchema),v.check(ids=>new Set(ids).size===ids.length))}),
  v.strictObject({kind:v.literal('CONSERVATION_BONUS'),track:v.picklist([5,8])}),
  v.strictObject({kind:v.literal('GAIN'),resource:v.picklist(['APPEAL','CONSERVATION','REPUTATION','MONEY','X','WORKER']),amount:Amount}),
  ...(['DRAW','HUNTER','DIGGING','SCAVENGING','CARD_PICK','SUNBATHING','POUCH','SPONSOR_TOKENS'] as const).map(kind=>v.strictObject({kind:v.literal(kind),amount:ArkCountSchema})),
  v.strictObject({kind:v.literal('PERCEPTION'),amount:ArkCountSchema,keep:ArkCountSchema}),
  v.strictObject({kind:v.literal('SNAP'),amount:ArkCountSchema,mayRefillBetween:v.boolean()}),
  v.strictObject({kind:v.literal('MOVE_ACTION'),action:v.nullable(ArkActionKindSchema),slots:v.pipe(v.array(v.picklist([1,5])),v.minLength(1),v.maxLength(2),v.check(xs=>new Set(xs).size===xs.length))}),
  ...(['EXTRA_ACTION','MULTIPLIER'] as const).map(kind=>v.strictObject({kind:v.literal(kind),action:v.nullable(ArkActionKindSchema)})),
  v.strictObject({kind:v.literal('FREE_BUILD'),buildings:v.pipe(v.array(ArkRefSchema),v.minLength(1)),amount:ArkCountSchema,ignoreBuildUpgrade:v.boolean()}),
  ...(['WAZA_SNAP','ARCHAEOLOGIST','UPGRADE','UPGRADE_OR_WORKER','DISCARD_GOAL','WAZA_FOCUS','FREE_PARTNER','FREE_UNIVERSITY','RESISTANCE','ASSERTION','DOMINANCE','SPONSOR_MAGNET'] as const).map(kind=>v.strictObject({kind:v.literal(kind)})),
]);
const Sequence=v.pipe(v.number(),v.safeInteger(),v.minValue(1));
const Job=v.strictObject({id:Sequence,sourceId:ArkRefSchema,effect:ArkZooEffectSchema});
export type ArkEffectJob=v.InferOutput<typeof Job>;
const Frame=v.pipe(v.array(Job),v.minLength(1));
export const ArkEffectQueueSchema=v.pipe(v.strictObject({
  nextId:Sequence,stage:v.picklist(['IMMEDIATE','AFTER_FINISHING']),frames:v.array(Frame),
  active:v.nullable(Job),afterFinishing:v.array(Job),
}),v.check(s=>{
  const jobs=[...s.frames.flat(),...s.afterFinishing,...(s.active?[s.active]:[])];
  return new Set(jobs.map(j=>j.id)).size===jobs.length&&jobs.every(j=>j.id<s.nextId)&&
    (s.stage==='IMMEDIATE'||s.afterFinishing.length===0);
}));
export type ArkEffectQueue=v.InferOutput<typeof ArkEffectQueueSchema>;
export type ArkEffectBatch=Readonly<{sourceId:string;effect:ArkZooEffect;timing:'IMMEDIATE'|'AFTER_FINISHING'}>;
export function createArkEffectQueue():ArkEffectQueue {return {nextId:1,stage:'IMMEDIATE',frames:[],active:null,afterFinishing:[]};}
export function arkEffectsPending(s:ArkEffectQueue):boolean {return s.active!==null||s.frames.length>0;}
function jobs(s:ArkEffectQueue,batch:readonly ArkEffectBatch[]):ArkEffectJob[] {
  const immediate:ArkEffectJob[]=[];
  for(const item of batch) {
    const job=v.parse(Job,{id:s.nextId++,sourceId:item.sourceId,effect:item.effect});
    if(item.timing==='AFTER_FINISHING'&&s.stage==='IMMEDIATE')s.afterFinishing.push(job);
    else immediate.push(job);
  }
  return immediate;
}
/** Append one simultaneous event only when the preceding event has fully resolved. */
export function enqueueArkEffects(current:ArkEffectQueue,batch:readonly ArkEffectBatch[]):ArkEffectQueue {
  const s=v.parse(ArkEffectQueueSchema,current);
  if(arkEffectsPending(s))throw new Error('Unresolved Ark effect event.');
  const added=jobs(s,batch);if(added.length)s.frames.push(added);
  return v.parse(ArkEffectQueueSchema,s);
}
/** The top frame is the current event. A nested reward cannot be bypassed to select an older sibling. */
export function selectArkEffect(current:ArkEffectQueue,id:number):{ok:true;queue:ArkEffectQueue}|{ok:false} {
  const s=v.parse(ArkEffectQueueSchema,current),frame=s.frames.at(-1);
  if(s.active||!frame)return {ok:false};
  const index=frame.findIndex(j=>j.id===id);if(index<0)return {ok:false};
  s.active=frame.splice(index,1)[0]!;
  if(!frame.length)s.frames.pop();
  return {ok:true,queue:v.parse(ArkEffectQueueSchema,s)};
}
/** Called only after the active effect's transaction succeeds, including every private sub-choice. */
export function completeArkEffect(current:ArkEffectQueue,id:number,children:readonly ArkEffectBatch[]=[],continuation:readonly ArkEffectBatch[]=[]):ArkEffectQueue {
  const s=v.parse(ArkEffectQueueSchema,current);
  if(s.active?.id!==id)throw new Error('Missing active Ark effect.');
  s.active=null;
  const later=jobs(s,continuation);if(later.length)s.frames.push(later);
  const nested=jobs(s,children);if(nested.length)s.frames.push(nested);
  return v.parse(ArkEffectQueueSchema,s);
}
/** Caller must move the used action card to slot 1 before invoking this boundary. */
export function beginArkAfterFinishing(current:ArkEffectQueue):ArkEffectQueue {
  const s=v.parse(ArkEffectQueueSchema,current);
  if(s.stage!=='IMMEDIATE'||arkEffectsPending(s))throw new Error('Cannot finish unresolved Ark effects.');
  s.stage='AFTER_FINISHING';
  if(s.afterFinishing.length)s.frames.push(s.afterFinishing.splice(0));
  return v.parse(ArkEffectQueueSchema,s);
}
