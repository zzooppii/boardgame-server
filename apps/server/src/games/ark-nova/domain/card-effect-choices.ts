import * as v from 'valibot';
import { ArkCardSchema, ArkCountSchema, ArkRefSchema, ARK_CARDS, type ArkCard } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import type { ArkCardZones } from './card-zones.js';
const Request=v.variant('kind',[
  v.strictObject({kind:v.literal('HUNTER'),amount:ArkCountSchema}),
  v.strictObject({kind:v.literal('SCAVENGING'),amount:ArkCountSchema}),
  v.strictObject({kind:v.literal('PERCEPTION'),amount:ArkCountSchema,keep:ArkCountSchema}),
]);
export const ArkCardRevealSchema=v.pipe(v.strictObject({
  choiceId:ArkRefSchema,kind:v.picklist(['HUNTER','SCAVENGING','PERCEPTION']),
  candidates:v.array(ArkCardSchema),keep:ArkCountSchema,
}),v.check(s=>new Set(s.candidates.map(c=>c.cardId)).size===s.candidates.length&&s.keep<=s.candidates.length&&
  (s.kind==='PERCEPTION'||s.keep===Math.min(1,s.candidates.filter(c=>s.kind!=='HUNTER'||ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL')).length))));
export type ArkCardReveal=v.InferOutput<typeof ArkCardRevealSchema>;
export type ArkCardEffectZones=ArkCardZones & {cardReveal:ArkCardReveal|null};
const Keep=v.strictObject({choiceId:ArkRefSchema,keep:v.array(ArkRefSchema)});
function isAnimal(c:ArkCard):boolean {return ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL');}
/** Only an authenticated owning transaction begins a reveal. Rejected selections never redraw or consume RNG. */
export function beginArkCardReveal<T extends ArkCardEffectZones>(current:T,input:unknown,choiceId:string,random:RandomSource):{ok:true;state:T}|{ok:false} {
  const request=v.safeParse(Request,input);
  if(current.cardReveal!==null||!request.success||!v.safeParse(ArkRefSchema,choiceId).success||
    request.output.kind==='PERCEPTION'&&request.output.keep>request.output.amount)return {ok:false};
  const state=structuredClone(current),effect=request.output;
  if(effect.kind==='SCAVENGING') {
    for(let i=state.discarded.length-1;i>0;i--) {
      const j=random.nextInt(i+1);if(!Number.isSafeInteger(j)||j<0||j>i)throw new Error('Invalid random index.');
      [state.discarded[i],state.discarded[j]]=[state.discarded[j]!,state.discarded[i]!];
    }
  }
  const candidates=(effect.kind==='SCAVENGING'?state.discarded:state.zooDeck).splice(0,effect.amount);
  const keep=effect.kind==='PERCEPTION'?Math.min(effect.keep,candidates.length):Math.min(1,candidates.filter(c=>effect.kind!=='HUNTER'||isAnimal(c)).length);
  if(keep===0) {state.discarded.push(...candidates);return {ok:true,state};}
  state.cardReveal=v.parse(ArkCardRevealSchema,{choiceId,kind:effect.kind,candidates,keep});
  return {ok:true,state};
}
export function resolveArkCardReveal<T extends ArkCardEffectZones>(current:T,input:unknown):{ok:true;state:T}|{ok:false} {
  const selection=v.safeParse(Keep,input);
  if(!selection.success||!current.cardReveal)return {ok:false};
  const reveal=v.parse(ArkCardRevealSchema,current.cardReveal),chosen=selection.output;
  if(chosen.choiceId!==reveal.choiceId||chosen.keep.length!==reveal.keep||new Set(chosen.keep).size!==chosen.keep.length||
    chosen.keep.some(id=>!reveal.candidates.some(c=>c.cardId===id&&(reveal.kind!=='HUNTER'||isAnimal(c)))))return {ok:false};
  const state=structuredClone(current),kept=new Set(chosen.keep);
  state.hand.push(...reveal.candidates.filter(c=>kept.has(c.cardId)));
  state.discarded.push(...reveal.candidates.filter(c=>!kept.has(c.cardId)));
  state.cardReveal=null;
  return {ok:true,state};
}
const Trade=v.strictObject({cards:v.array(ArkRefSchema)});
/** Resolves Sunbathing/Pouch. Pouched cards remain owned inventory but no longer provide icons or abilities. */
export function tradeArkHandCards<T extends ArkCardZones & {money:number;appeal:number;played:ArkCard[];pouched:Record<string,ArkCard[]>}>(
  current:T,kind:'SUNBATHING'|'POUCH',maximum:number,sourceId:string,input:unknown,
):{ok:true;state:T}|{ok:false} {
  const choice=v.safeParse(Trade,input);
  if(!choice.success||!Number.isSafeInteger(maximum)||maximum<0||!current.played.some(c=>c.cardId===sourceId)||
    choice.output.cards.length>maximum||new Set(choice.output.cards).size!==choice.output.cards.length||
    choice.output.cards.some(id=>!current.hand.some(c=>c.cardId===id)))return {ok:false};
  const state=structuredClone(current),ids=new Set(choice.output.cards),cards=state.hand.filter(c=>ids.has(c.cardId));
  state.hand=state.hand.filter(c=>!ids.has(c.cardId));
  if(kind==='SUNBATHING') {state.money+=4*cards.length;state.discarded.push(...cards);}
  else {
    // Define an own property even when a valid opaque source ID resembles a prototype name.
    const previous=Object.hasOwn(state.pouched,sourceId)?state.pouched[sourceId]!:[];
    Object.defineProperty(state.pouched,sourceId,{value:[...previous,...cards],enumerable:true,writable:true,configurable:true});
    state.appeal=Math.min(113,state.appeal+2*cards.length);
  }
  return {ok:true,state};
}
