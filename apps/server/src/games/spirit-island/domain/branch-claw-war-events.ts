import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, invaders, countPieces, cardPower, defense, fear, event } from './primitives.js';
import { moveToken } from './tokens.js';
import { spiritFearKeys } from './resolver.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
export function warMain(s:SpiritState,e:SpiritStep,paid:boolean,shuffle:<T>(values:T[])=>T[]):boolean {
 if(s.currentEvent!=='WAR')return false;
 const effects:SpiritStep[]=[];
 if(paid){const used=[...s.fearDeck,...s.fearEarned,...s.fearDiscard],next=shuffle(spiritFearKeys(s.settings.expansion).filter(k=>!used.includes(k)))[0];if(next){s.fearDeck.unshift(next);s.revealedFear=s.revealedFear.filter(k=>k!==next);event(s,'EVENT','공포 덱 위에 미사용 공포 카드 1장 추가 · 뒷면 유지',e.actor);}else event(s,'EVENT','미사용 공포 카드 없음 · 추가 생략',e.actor);}
 else effects.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE14_DISCARD',null,[b])));
 prepend(s,...effects,step('CHECK',e.actor),...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE14_BEAST',null,[b])),step('CHECK',e.actor),...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE14_DAHAN',p.playerId)),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function warOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE14_ATTACK'){
  const coast=areas(s).filter(l=>l.board===e.tags[0]&&l.coastal),max=Math.max(0,...coast.map(l=>countPieces(l,['TOWN','CITY'])));
  for(const l of coast.filter(l=>max>0&&countPieces(l,['TOWN','CITY'])===max)){
   const hit=Math.max(0,e.n-defense(s,l));
   add(`${l.id} · 건물 ${max}개 · 침략자·땅 피해 ${hit}${hit>=2?' · 오염 1':''}`,()=>prepend(s,step('DAMAGE',e.actor,l.id,hit),...(hit>=2?[step('BLIGHT',e.actor,l.id,1)]:[]),step('CHECK',e.actor)),l.id);
  }
 }else if(e.key==='BCE14_BEAST'){
  for(const from of areas(s).filter(l=>l.board===e.tags[0]&&l.tokens.beasts>0))for(const to of areas(s).filter(l=>from.adjacent.includes(l.id)&&l.blight===0))add(`${from.id} 야수 → ${to.id}${invaders(to).length?' · 공포 1':''}`,()=>{moveToken(s,from,to,'beasts',e.actor);if(invaders(to).length)fear(s,1,e.actor,to.id);},to.id);
 }else if(e.key==='BCE14_DAHAN'){
  for(const from of areas(s).filter(l=>countPieces(l,['DAHAN'])>0))for(const to of areas(s).filter(l=>from.adjacent.includes(l.id)))add(`${from.id} 다한 → ${to.id} · 피해 1`,()=>prepend(s,step('MOVE',e.actor,from.id,1,'PUSH',e.actor,['DAHAN','REQUIRED','NO_OCEAN',`TO:${to.id}`]),step('DAMAGE',e.actor,to.id,1),step('CHECK',e.actor)),to.id);
  add('다한 이동 생략',()=>undefined);
 }else return false;
 return true;
}
export function warAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key!=='BCE14_DISCARD')return false;
 const id=s.major.shift()??s.majorDiscard.shift();if(!id)return true;s.majorDiscard.push(id);const c=cardPower(s,id);event(s,'CARD',`${e.tags[0]} 전쟁 피해 판정 · ${c.title} · 비용 ${c.cost}`,e.actor);prepend(s,{...e,key:'BCE14_ATTACK',n:c.cost});return true;
}
