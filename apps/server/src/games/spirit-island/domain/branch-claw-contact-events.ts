import type { SpiritInvaderCard } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, countPieces, invaders, makePiece, cardPower, fear, event } from './primitives.js';
import { addToken } from './tokens.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
export function protectedInvaderCard(s:SpiritState,c:SpiritInvaderCard):boolean {
 const p=s.protectedInvader;return p!==null&&p.stage===c.stage&&p.coastal===c.coastal&&p.terrains.length===c.terrains.length&&p.terrains.every((t,i)=>t===c.terrains[i]);
}
export function contactEventMain(s:SpiritState,e:SpiritStep,paid:boolean):boolean {
 const key=s.currentEvent;if(key!=='MISSIONARIES'&&key!=='RISING_INTEREST')return false;
 const main:SpiritStep[]=[];
 if(key==='MISSIONARIES'){
  if(paid){main.push(...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE7_DISEASE',p.playerId)),step('FEAR',e.actor,null,2*s.players.length));s.flags.push(...Array.from({length:3},()=> 'event-next-city-extra'));}
  else {s.flags.push('event-return');main.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE7_DISCARD',null,[b])));}
 }else if(paid){
  const removed=s.fearDeck.shift();if(removed){s.revealedFear=s.revealedFear.filter(c=>c!==removed);if(s.settings.scenario!=='RITUAL')s.terror=s.fearDeck.length===0?4:s.fearDeck.length<=s.fearTiers[2]!?3:s.fearDeck.length<=s.fearTiers[1]!+s.fearTiers[2]!?2:s.terror;event(s,'EVENT','공포 덱 위 카드 1장 제거 · 해결하지 않음');}
  s.flags.push('event-next-city-extra','event-next-town');
 }else{
  const index=s.invaderDeck.findIndex(c=>!protectedInvaderCard(s,c));if(index>=0){s.invaderDeck.splice(index,1);event(s,'EVENT','침략 덱의 일반 카드 1장 제거');}
  main.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE7_TOWN',null,[b])));
 }
 prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE7_TOKEN'),step('CHECK',e.actor),...(key==='RISING_INTEREST'?[step('SPECIAL',e.actor,null,0,'BCE7_DAHAN'),step('CHECK',e.actor)]:[]),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function contactEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE7_PUSH'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0))for(const p of l.pieces.filter(p=>p.kind==='EXPLORER'))for(const to of l.adjacent.map(id=>land(s,id)).filter(l=>l.number>0))add(`${l.id} 탐험가 → ${to.id}`,()=>prepend(s,step('MOVE',e.actor,l.id,1,'PUSH',null,['EXPLORER','REQUIRED','NO_OCEAN',`ONLY:${p.id}`,`TO:${to.id}`])),to.id,p.id);
 }else if(e.key==='BCE7_CONVERT'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0&&!s.flags.includes(`immortal:${l.id}`)))add(`${l.id} · 다한 1개를 마을로 교체`,()=>prepend(s,step('REPLACE',e.actor,l.id,1,'SWEDEN_TOWN',null,['DAHAN'])),l.id);
 }else if(e.key==='BCE7_DISEASE'){
  for(const l of areas(s).filter(l=>countPieces(l,['CITY'])>0))add(`${l.id} · 도시에 질병 추가`,()=>addToken(s,l,'disease',1,e.actor),l.id);
 }else if(e.key==='BCE7_TOWN'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['TOWN'])===0))add(`${l.id} · 마을 추가`,()=>{makePiece(s,l,'TOWN');event(s,'BUILD',`${l.id} 관심으로 마을 추가`,e.actor,l.id);},l.id);
 }else if(e.key==='BCE7_JUNGLE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.terrain==='JUNGLE'&&l.blight===0))add(`${l.id} · 야수 추가${invaders(l).length?' · 공포 1':''}`,()=>{addToken(s,l,'beasts',1,e.actor);if(invaders(l).length)fear(s,1,e.actor,l.id);},l.id);
 }else if(e.key==='BCE7_WILDS'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 다한 지역에 야생 추가`,()=>addToken(s,l,'wilds',1,e.actor),l.id);
 }else return false;
 return true;
}
export function contactEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE7_DISCARD'){
  const id=s.minor.shift()??s.minorDiscard.shift();if(!id)return true;s.minorDiscard.push(id);const c=cardPower(s,id);event(s,'CARD',`${e.tags[0]} · 선교사 판정: ${c.title} · ${c.elements.includes('SUN')?'태양 원소 있음':'태양 원소 없음'}`);prepend(s,{...e,key:c.elements.includes('SUN')?'BCE7_PUSH':'BCE7_CONVERT'});return true;
 }
 if(e.key==='BCE7_TOKEN'){
  if(s.currentEvent==='MISSIONARIES')prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE3_PREY')),step('SPECIAL',e.actor,null,0,'BCE3_BEAST'));
  else prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE7_JUNGLE',null,[b])));
  return true;
 }
 if(e.key==='BCE7_DAHAN'){prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE7_WILDS',null,[b])));return true;}
 return false;
}
