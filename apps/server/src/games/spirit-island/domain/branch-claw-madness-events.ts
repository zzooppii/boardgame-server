import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, event, requireRule } from './primitives.js';
import { moveToken } from './tokens.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
export const madnessCost=(s:SpiritState,removed:readonly string[]=[])=>3*Math.max(1,areas(s).reduce((n,l)=>n+l.tokens.beasts,0)-removed.length);
export const validMadnessPlan=(s:SpiritState,removed:readonly string[])=>removed.every(id=>areas(s).some(l=>l.id===id&&l.tokens.beasts>=removed.filter(x=>x===id).length));
export function madnessPaymentOptions(s:SpiritState,e:SpiritStep,add:Add){
 if(s.currentEvent!=='MADNESS')return;
 const payment=s.eventPayment;requireRule(payment);
 const plan=(used:string[])=>{requireRule(validMadnessPlan(s,used));payment.cost=madnessCost(s,used);prepend(s,{...e,used});};
 for(const l of areas(s).filter(l=>l.tokens.beasts>0)){
  const picked=e.used.filter(id=>id===l.id).length;
  if(picked<l.tokens.beasts)add(`${l.id} 야수 제거 계획 +1 · 현재 ${picked}/${l.tokens.beasts}`,()=>plan([...e.used,l.id]),l.id);
  if(picked)add(`${l.id} 야수 제거 계획 취소 1 · 현재 ${picked}/${l.tokens.beasts}`,()=>{const used=[...e.used];used.splice(used.indexOf(l.id),1);plan(used);},l.id);
 }
}
export function madnessMain(s:SpiritState,e:SpiritStep,paid:boolean):boolean {
 if(s.currentEvent!=='MADNESS')return false;
 const effects:SpiritStep[]=[],boards=[...new Set(areas(s).map(l=>l.board))];
 if(paid){
  requireRule(validMadnessPlan(s,e.used));
  for(const id of e.used){land(s,id).tokens.beasts--;event(s,'POWER',`${id} · 광기 지원 확정 · 야수 1 제거`,e.actor,id);}
  effects.push(...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE12_PUSH',p.playerId)));
 }else effects.push(...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('DESTROY',e.actor,l.id,l.tokens.beasts,'',null,['DAHAN'])),...boards.map(b=>step('SPECIAL',e.actor,null,0,'BCE12_REMOVE',null,[b])));
 prepend(s,...effects,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE12_FRENZY'),step('CHECK',e.actor),...boards.map(b=>step('SPECIAL',e.actor,null,0,'BCE2_RETREAT',null,[b,'TOKENS'])),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));
 return true;
}
export function madnessOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE12_REMOVE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.tokens.beasts>0))add(`${l.id} · 야수 1 제거`,()=>{l.tokens.beasts--;event(s,'POWER',`${l.id} · 광기 · 야수 1 제거`,e.actor,l.id);},l.id);
 }else if(e.key==='BCE12_PUSH'){
  for(const from of areas(s).filter(l=>l.tokens.beasts>0))for(const to of areas(s).filter(l=>from.adjacent.includes(l.id)))add(`${from.id} 야수 → ${to.id}`,()=>moveToken(s,from,to,'beasts',e.actor),to.id);
  add('야수 이동 생략',()=>undefined);
 }else return false;
 return true;
}
export function madnessAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key!=='BCE12_FRENZY')return false;
 prepend(s,...areas(s).flatMap(l=>Array.from({length:l.tokens.beasts},()=>[step('DESTROY',e.actor,l.id,1,'',null,['EXPLORER']),step('DAMAGE',e.actor,l.id,2)]).flat()));
 return true;
}
