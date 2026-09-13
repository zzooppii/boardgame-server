import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, sacred, invaders, presence, countPieces, player, addPresence, event, requireRule } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
export const threatenedSites=(s:SpiritState)=>areas(s).filter(l=>invaders(l).length>0&&s.players.some(p=>sacred(s,l,p.playerId)));
export const validSacredPlan=(s:SpiritState,used:readonly string[])=>new Set(used).size===used.length&&used.every(id=>threatenedSites(s).some(l=>l.id===id));
export function sacredPaymentOptions(s:SpiritState,e:SpiritStep,add:Add){
 if(s.currentEvent!=='SACRED_SITES')return;
 const payment=s.eventPayment;requireRule(payment);
 for(const l of threatenedSites(s)){
  const damage=e.used.includes(l.id);
  add(`${l.id} · ${damage?'피해 2 계획 → 각 정령 현신 1 희생으로 변경':'현신 희생 계획 → 피해 2로 변경 (비용 3)'}`,()=>{const used=damage?e.used.filter(id=>id!==l.id):[...e.used,l.id];payment.cost=3*used.length;prepend(s,{...e,used});},l.id);
 }
}
export function sacredMain(s:SpiritState,e:SpiritStep,paid:boolean):boolean {
 if(s.currentEvent!=='SACRED_SITES')return false;
 const effects:SpiritStep[]=[];
 if(paid){
  requireRule(validSacredPlan(s,e.used));
  for(const l of threatenedSites(s))effects.push(e.used.includes(l.id)?step('DAMAGE',e.actor,l.id,2):step('SPECIAL',e.actor,l.id,0,'BCE13_SACRIFICE'),step('CHECK',e.actor));
 }else{
  for(const p of s.players)for(const l of areas(s).filter(l=>sacred(s,l,p.playerId)))effects.push(step('MOVE',p.playerId,l.id,1,'PUSH',p.playerId,['EXPLORER','TOWN','REQUIRED','NO_OCEAN']));
  effects.push(step('SPECIAL',e.actor,null,s.players.length,'BCE13_POOL'),step('CHECK',e.actor));
 }
 prepend(s,...effects,step('SPECIAL',e.actor,null,0,'BCE13_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE13_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function sacredAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE13_SACRIFICE'){
  const l=areas(s).find(l=>l.id===e.land);requireRule(l);
  for(const p of s.players)if(presence(l,p.playerId)>0){addPresence(l,p.playerId,-1);player(s,p.playerId).destroyedPresence++;event(s,'BLIGHT',`${l.id} 위협받는 성소 · 현신 1 희생`,p.playerId,l.id);}
 }else if(e.key==='BCE13_POOL'){
  for(let i=0;i<e.n&&s.blightPool>0;i++){
   s.blightPool--;s.blightTotal--;event(s,'BLIGHT','섬의 힘 · 오염 공급 1개 영구 제거',e.actor);
   if(s.blightPool===0&&s.blightCard&&!s.blighted){s.blighted=true;const n=((s.blightCard==='SPIRAL'?5:4)-(s.settings.scenario==='BLITZ'?1:0))*s.players.length;s.blightPool=n;s.blightTotal+=n;event(s,'BLIGHT','위협받는 성소 · 오염 카드 뒤집기',e.actor);}
  }
 }else if(e.key==='BCE13_TOKEN'){
  prepend(s,step('SPECIAL',e.actor,null,0,'BCE2_PROWL',null,areas(s).flatMap(l=>Array.from({length:l.tokens.beasts},()=>l.id))));
 }else if(e.key==='BCE13_DAHAN'){
  prepend(s,...s.players.filter(p=>areas(s).filter(l=>presence(l,p.playerId)>0).reduce((n,l)=>n+countPieces(l,['DAHAN']),0)>=4).map(p=>step('GAIN',p.playerId,null,0,'MINOR',p.playerId)));
 }else return false;
 return true;
}
