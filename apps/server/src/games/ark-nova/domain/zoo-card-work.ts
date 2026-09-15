import * as v from 'valibot';
import { ArkCountSchema, ArkZooWorkSchema } from '@hangul-rummikub/shared';
import { assertArkZooMap } from './zoo-map.js';
import { startArkAction, finishArkAction } from './action-row.js';
import { playArkZooCard, type ArkCardPlayState } from './card-play.js';
import { arkCardEntryEffects } from './card-entry-effects.js';
import { createArkEffectQueue, enqueueArkEffects, arkEffectsPending, beginArkAfterFinishing } from './effect-queue.js';
import type { ArkEffectState } from './resolve-effect.js';
export { ArkZooWorkSchema };
export type ArkZooWork=v.InferOutput<typeof ArkZooWorkSchema>;
export type ArkZooWorkState=ArkCardPlayState & ArkEffectState & {zooWork:ArkZooWork|null;supportedProjects:number};
const Begin=v.strictObject({action:v.picklist(['ANIMALS','SPONSORS']),x:v.pipe(ArkCountSchema,v.maxValue(5)),gainReputation:v.optional(v.boolean(),true)});
/** This action kernel is called by an authenticated game command and does not advance the solo clock. */
export function beginArkZooWork<T extends ArkZooWorkState>(current:T,input:unknown,baseStrength?:number):{ok:true;state:T}|{ok:false} {
  const chosen=v.safeParse(Begin,input);
  if(!chosen.success||current.zooWork||current.cardReveal||current.goalReveal||arkEffectsPending(current.effects)||current.effects.afterFinishing.length)return {ok:false};
  const action=startArkAction(current.actions,chosen.output.action,current.x,chosen.output.x,baseStrength);
  if(!action.ok)return {ok:false};
  const remaining=chosen.output.action==='ANIMALS'?(action.strength>=5?2:action.strength>=2?1:0):action.strength+Number(action.upgraded);
  if(remaining===0)return {ok:false};
  const s=structuredClone(current);s.x=action.xRemaining;
  s.zooWork={action:chosen.output.action,upgraded:action.upgraded,remaining,playedCount:0,cancelX:chosen.output.action==='ANIMALS'&&action.upgraded&&action.strength>=5&&chosen.output.gainReputation?null:chosen.output.x,onlySmall:true,wazaUsed:false,stage:'PLAYING'};
  s.effects=createArkEffectQueue();
  if(chosen.output.action==='ANIMALS'&&action.upgraded&&action.strength>=5&&chosen.output.gainReputation)s.effects=enqueueArkEffects(s.effects,[{
    sourceId:'action:ANIMALS',effect:{kind:'GAIN',resource:'REPUTATION',amount:1},timing:'IMMEDIATE',
  }]);
  return {ok:true,state:s};
}
/** Entry, payment and every immediate/triggered job commit together. The next card waits for all these jobs. */
export function playNextArkZooCard<T extends ArkZooWorkState>(current:T,input:unknown):{ok:true;state:T}|{ok:false} {
  const active=current.zooWork;
  if(!active||active.stage!=='PLAYING'||arkEffectsPending(current.effects)||current.cardReveal||current.goalReveal||
    active.action==='SPONSORS'&&!active.upgraded&&active.playedCount>0)return {ok:false};
  const result=playArkZooCard(current,{kind:active.action==='ANIMALS'?'ANIMAL':'SPONSOR',upgraded:active.upgraded,remaining:active.remaining,paySponsorLevel:false},input);
  if(!result.ok)return {ok:false};
  const s=result.state,batch=arkCardEntryEffects(current,s,result.card);
  s.zooWork={...active,remaining:result.remaining,playedCount:active.playedCount+1,onlySmall:active.onlySmall===true&&result.definition.kind==='ANIMAL'&&result.definition.size<=2};
  assertArkZooMap(s.buildings,s.played,s.actions.some(a=>a.kind==='BUILD'&&a.upgraded));
  s.effects=enqueueArkEffects(s.effects,batch);
  return {ok:true,state:s};
}
/** Shift once after all cards/immediate effects. Deferred jobs still belong to this same turn. */
export function endArkZooWork<T extends ArkZooWorkState>(current:T):{ok:true;state:T}|{ok:false} {
  if(!current.zooWork||current.zooWork.stage!=='PLAYING'||arkEffectsPending(current.effects)||current.cardReveal||current.goalReveal)return {ok:false};
  const s=structuredClone(current),active=s.zooWork!;
  s.actions=finishArkAction(s.actions,active.action);s.effects=beginArkAfterFinishing(s.effects);
  active.stage='AFTER_FINISHING';return {ok:true,state:s};
}
/** The outer loop may finish the turn only after this succeeds. */
export function completeArkZooWork<T extends ArkZooWorkState>(current:T):{ok:true;state:T}|{ok:false} {
  if(current.zooWork?.stage!=='AFTER_FINISHING'||arkEffectsPending(current.effects)||current.cardReveal||current.goalReveal||current.effects.afterFinishing.length)return {ok:false};
  const s=structuredClone(current);s.zooWork=null;return {ok:true,state:s};
}

/** Reserve the remaining normal card allowance before offering WAZA's one hand-only extra animal. */
export function beginArkWazaBonus<T extends ArkZooWorkState>(current:T):T|null {
  const active=current.zooWork,source=current.played.find(c=>c.key==='228');
  if(!active||active.action!=='ANIMALS'||active.stage!=='PLAYING'||active.playedCount===0||!active.onlySmall||active.wazaUsed||!source||arkEffectsPending(current.effects))return null;
  const s=structuredClone(current);s.zooWork={...active,remaining:0,wazaUsed:true};
  s.effects=enqueueArkEffects(s.effects,[{sourceId:source.cardId,effect:{kind:'WAZA_PLAY',upgraded:active.upgraded},timing:'IMMEDIATE'}]);
  return s;
}

/** Only a pristine selection phase is reversible; no card or reward can be undone. */
export function cancelArkZooWork<T extends ArkZooWorkState>(current:T):{ok:true;state:T}|{ok:false} {
  const active=current.zooWork;
  if(!active||active.stage!=='PLAYING'||active.playedCount!==0||active.cancelX==null||active.wazaUsed||
    arkEffectsPending(current.effects)||current.effects.afterFinishing.length||current.cardReveal||current.goalReveal||current.x+active.cancelX>5)return {ok:false};
  const s=structuredClone(current);s.x+=active.cancelX;s.zooWork=null;return {ok:true,state:s};
}
