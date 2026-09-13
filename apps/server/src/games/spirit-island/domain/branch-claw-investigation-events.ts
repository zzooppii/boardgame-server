import type { SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { innate, powerOptions, resolveSpiritPower } from './game.js';
import { step, prepend, countPieces, presence, makePiece, event, cardPower } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
export const unnaturalBonus=(s:SpiritState,l:SpiritLand)=>s.flags.includes('event-unnatural')&&l.pieces.some(p=>p.kind!=='DAHAN')&&l.presence.some(p=>p.count>0)?3:0;
const eligible=(s:SpiritState,e:SpiritStep)=>areas(s).filter(l=>presence(l,e.actor)>0).reduce((n,l)=>n+countPieces(l,['DAHAN']),0)>=3;
const title=(s:SpiritState,e:SpiritStep,id:string)=>id.startsWith('innate')?`고유 능력 · ${innate(s,e.actor,id==='innate2').title}`:cardPower(s,id).title;
export function investigationMain(s:SpiritState,e:SpiritStep):boolean {
 if(s.currentEvent!=='INVESTIGATION')return false;
 s.eventTerrorLevel=s.terror;const late=s.terror>=2;
 event(s,'EVENT',`위험 조사 · 공포 ${s.terror} · ${late?'부자연스러운 것을 파괴하라':'위험 조사'}`);
 if(late)s.flags.push('event-unnatural');
 const boards=[...new Set(areas(s).map(l=>l.board))];
 prepend(s,...(late?[]:boards.map(b=>step('SPECIAL',e.actor,null,0,'BCE10_EXPLORE',null,[b]))),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE10_PREY'),step('CHECK',e.actor),...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE10_ROUSE',p.playerId)),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function investigationOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE10_EXPLORE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.pieces.length===0))add(`${l.id} · 위험을 조사하는 탐험가 추가`,()=>{makePiece(s,l,'EXPLORER');event(s,'EXPLORE',`${l.id} 위험 조사 · 탐험가 추가`,e.actor,l.id);},l.id);
 }else if(e.key==='BCE10_ROUSE'){
  if(eligible(s,e))for(const o of powerOptions(s,e.actor,true).filter(o=>o.targets.length+o.shadowTargets.length>0))add(`${title(s,e,o.cardId)}${o.repeat?' · 반복 권한 사용':''} · 지금 사용`,()=>prepend(s,{...e,key:'BCE10_TARGET',tags:[o.cardId,o.repeat?'REPEAT':'FIRST']}));
  add('즉시 사용 생략 · 느린 단계에 사용하기',()=>undefined);
 }else if(e.key==='BCE10_TARGET'){
  const o=powerOptions(s,e.actor,true).find(o=>o.cardId===e.tags[0]&&o.repeat===(e.tags[1]==='REPEAT'));
  if(o&&eligible(s,e))for(const shadowReach of [false,true])for(const target of shadowReach?o.shadowTargets:o.targets)for(let threshold=o.cardId.startsWith('innate')?1:0;threshold<=o.thresholdMax;threshold++){
   const level=threshold;add(`${title(s,e,o.cardId)} → ${target} · ${o.cardId.startsWith('innate')?`고유 ${level}단계`:level?'원소 조건 적용':'기본 효과'}${shadowReach?' · 그림자 사거리 에너지 1':''}`,()=>resolveSpiritPower(s,e.actor,{kind:'USE_POWER',cardId:o.cardId,target,threshold:level,repeat:o.repeat,fast:false,shadowReach},true),s.lands.some(l=>l.id===target)?target:null);
  }
  add('능력 선택으로 돌아가기',()=>prepend(s,{...e,key:'BCE10_ROUSE',tags:[]}));
 }else return false;
 return true;
}
export function investigationAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE10_PREY'){prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE3_PREY')),step('SPECIAL',e.actor,null,0,'BCE3_BEAST'));return true;}
 if(e.key==='BCE10_ROUSE'&&!eligible(s,e))return true;
 return false;
}
