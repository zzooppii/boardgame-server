import { expandedIslandMain } from './branch-claw-settlement-events.js';
import { SPIRIT_EVENTS, SPIRITS } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, addPresence, player, countPieces, makePiece, removePiece, event, requireRule } from './primitives.js';
import { addToken } from './tokens.js';
type Add = (label:string, apply:()=>void, landId?:string|null, pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
const slots=(s:SpiritState,board:string|undefined)=>areas(s).filter(l=>l.board===board).flatMap(l=>l.presence.filter(p=>p.count>0).map(p=>({land:l,owner:p.playerId,count:p.count,key:JSON.stringify([l.id,p.playerId])})));
export function islandEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCE3_'))return false;
 const cost=e.n||2;
 if(e.key==='BCE3_PROTECT') {
  add(`${e.tags[0]} · 오염 확산을 받아들인다`,()=>prepend(s,{...e,key:'BCE3_BLIGHT'}));
  if(slots(s,e.tags[0]).reduce((n,p)=>n+p.count,0)>=cost)add(`${e.tags[0]} · 현신 ${cost}개로 보호한다`,()=>prepend(s,{...e,key:'BCE3_PLEDGE',used:[]}));
 } else if(e.key==='BCE3_PLEDGE') {
  const available=slots(s,e.tags[0]);
  const label=(slot:typeof available[number])=>`${slot.land.id} · ${SPIRITS.find(p=>p.id===player(s,slot.owner).spirit)?.name??slot.owner}`;
  for(const slot of available){const n=e.used.filter(key=>key===slot.key).length;if(n)add(`선택 취소 · ${label(slot)} 현신 ${n}개 중 1개`,()=>{const used=[...e.used];used.splice(used.indexOf(slot.key),1);prepend(s,{...e,used});},slot.land.id);}
  add('희생 취소 · 보드 선택으로 돌아가기',()=>prepend(s,{...e,key:'BCE3_PROTECT',used:[]}));
  if(e.used.length<cost)for(const slot of available.filter(p=>e.used.filter(key=>key===p.key).length<p.count))add(`${label(slot)} 현신 선택 (${e.used.length}/${cost})`,()=>prepend(s,{...e,used:[...e.used,slot.key]}),slot.land.id);
  if(e.used.length===cost)add(`현신 ${cost}개 희생 확정 · 이 보드 보호`,()=>{
   requireRule(e.used.every(key=>available.some(p=>p.key===key&&p.count>=e.used.filter(k=>k===key).length)));
   for(const key of e.used){const slot=available.find(p=>p.key===key);requireRule(slot);addPresence(slot.land,slot.owner,-1);player(s,slot.owner).destroyedPresence++;event(s,'BLIGHT',`${slot.land.id} 현신 희생 · ${e.tags[0]} 오염 확산 방지`,slot.owner,slot.land.id);}
  });
 } else if(e.key==='BCE3_BLIGHT') {
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&(e.tags[1]==='INLAND'?!l.coastal:e.tags[1]==='COAST'?l.coastal:e.tags[1]==='BUILDINGS'?countPieces(l,['TOWN','CITY'])>0||l.adjacent.some(id=>countPieces(land(s,id),['TOWN','CITY'])>0):l.adjacent.some(id=>land(s,id).blight>0))))add(`${l.id} · 오염 확산`,()=>prepend(s,step('BLIGHT',e.actor,l.id,1)),l.id);
 } else if(e.key==='BCE3_PREY') {
  const l=e.land?land(s,e.land):null;
  if(l&&e.n>0)for(const p of l.pieces.filter(p=>p.kind==='EXPLORER'))add(`${l.id} 탐험가 파괴`,()=>{removePiece(s,l,p,true,e.actor);if(e.n>1)prepend(s,{...e,n:e.n-1});},l.id,p.id);
 } else if(e.key==='BCE3_BEAST') {
  const empty=boards(s).filter(b=>!areas(s).some(l=>l.board===b&&l.tokens.beasts>0));
  for(const l of areas(s).filter(l=>empty.includes(l.board)))add(`${l.id} · 야수가 없는 보드에 야수 추가`,()=>addToken(s,l,'beasts',1,e.actor),l.id);
 } else if(e.key==='BCE3_DAHAN') {
  const coastal=s.currentEvent==='TIGHT_KNIT';
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.coastal===coastal&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 다한 추가`,()=>{makePiece(s,l,'DAHAN');event(s,'GROW',`${l.id} 다한 +1`,e.actor,l.id);},l.id);
 }
 return true;
}
export function islandEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(!e.key.startsWith('BCE3_'))return false;
 switch(e.key){
 case 'BCE3_MAIN': {
  if(expandedIslandMain(s,e))return true;
  requireRule(s.currentEvent);const def=SPIRIT_EVENTS[s.currentEvent];requireRule(def.type==='ISLAND');
  s.eventIslandState=s.blighted?'BLIGHTED':'HEALTHY';event(s,'EVENT',`${def.title} · ${s.blighted?def.blighted:def.healthy}`);
  const main:SpiritStep[]=[];
  if(s.blighted)main.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE3_PROTECT',null,[b])));
  else for(const l of areas(s))l.eventHealthBonus=s.currentEvent==='TIGHT_KNIT'?'BUILDINGS':'EXPLORERS';
  prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE3_TOKEN'),step('CHECK',e.actor),...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE3_DAHAN',null,[b])),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
 }
 case 'BCE3_TOKEN':
  if(s.currentEvent==='TIGHT_KNIT')prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE3_PREY')),step('SPECIAL',e.actor,null,0,'BCE3_BEAST'));
  else prepend(s,step('SPECIAL',e.actor,null,0,'BCE2_PROWL',null,areas(s).flatMap(l=>Array.from({length:l.tokens.beasts},()=>l.id))));
  return true;
 default:return false;
 }
}
