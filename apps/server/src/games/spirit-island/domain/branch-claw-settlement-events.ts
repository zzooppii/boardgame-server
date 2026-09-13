import { SPIRIT_EVENTS, type SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, player, presence, countPieces, invaders, makePiece, removePiece, event, requireRule } from './primitives.js';
import { addToken, moveToken } from './tokens.js';
import { oceanDistance } from './branch-claw-major.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
const adjacent=(s:SpiritState,l:SpiritLand)=>l.adjacent.map(id=>land(s,id)).filter(l=>l.number>0);
const inward=(s:SpiritState,l:SpiritLand)=>adjacent(s,l).filter(to=>oceanDistance(s,to)>oceanDistance(s,l));
function move(s:SpiritState,e:SpiritStep,from:SpiritLand,to:SpiritLand,id:string,kind:'TOWN'|'EXPLORER') {prepend(s,step('MOVE',e.actor,from.id,1,'PUSH',null,[kind,'REQUIRED','NO_OCEAN',`ONLY:${id}`,`TO:${to.id}`]));}
export function expandedIslandMain(s:SpiritState,e:SpiritStep):boolean {
 const key=s.currentEvent;if(!key||!['ROOTS','NEW_LANDS','SURGE_INLAND','POPULATION'].includes(key))return false;
 const def=SPIRIT_EVENTS[key];requireRule(def.type==='ISLAND');s.eventIslandState=s.blighted?'BLIGHTED':'HEALTHY';event(s,'EVENT',`${def.title} · ${s.blighted?def.blighted:def.healthy}`);
 const main:SpiritStep[]=[];
 if(s.blighted){
  if(key==='POPULATION')main.push(...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE4_FADE',p.playerId)));
  else main.push(...boards(s).filter(b=>key==='SURGE_INLAND'||areas(s).some(l=>l.board===b&&invaders(l).length>0)).map(b=>step('SPECIAL',e.actor,null,key==='ROOTS'?3:2,'BCE3_PROTECT',null,[b,key==='ROOTS'?'INLAND':key==='NEW_LANDS'?'COAST':'BUILDINGS'])));
 }else if(key==='NEW_LANDS')main.push(...areas(s).filter(l=>countPieces(l,['EXPLORER'])>=2).map(l=>step('SPECIAL',e.actor,l.id,0,'BCE4_SEARCH')));
 else main.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,key==='ROOTS'?'BCE4_ROOTS':key==='SURGE_INLAND'?'BCE4_SURGE':'BCE4_POPULATION',null,[b])));
 prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE4_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE4_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function settlementEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCE4_'))return false;
 if(e.key==='BCE4_ROOTS'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&!l.coastal))for(const p of l.pieces.filter(p=>p.kind==='EXPLORER'))add(`${l.id} 탐험가 → 마을`,()=>{removePiece(s,l,p,false,e.actor);const town=makePiece(s,l,'TOWN',false);town.strife=p.strife;event(s,'BUILD',`${l.id} 탐험가를 마을로 교체`,e.actor,l.id);},l.id,p.id);
 }else if(e.key==='BCE4_SEARCH'){
  const l=land(s,e.land);for(const to of adjacent(s,l).filter(l=>invaders(l).length===0))for(const p of l.pieces.filter(p=>p.kind==='EXPLORER'))add(`${l.id} 탐험가 → ${to.id}`,()=>move(s,e,l,to,p.id,'EXPLORER'),to.id,p.id);
 }else if(e.key==='BCE4_SURGE'||e.key==='BCE4_SURGE_NEXT'){
  const sources=e.key==='BCE4_SURGE'?areas(s).filter(l=>l.board===e.tags[0]&&l.coastal):areas(s).filter(l=>l.pieces.some(p=>p.id===e.used[0]));
  for(const l of sources)for(const p of l.pieces.filter(p=>p.kind==='TOWN'&&(e.key==='BCE4_SURGE'||p.id===e.used[0])))for(const to of inward(s,l))add(`${l.id} 마을 → ${to.id}`,()=>{if(e.key==='BCE4_SURGE')prepend(s,{...e,key:'BCE4_SURGE_NEXT',used:[p.id]});move(s,e,l,to,p.id,'TOWN');},to.id,p.id);
  if(e.key==='BCE4_SURGE_NEXT')add('한 번 이동으로 마치기',()=>undefined);
 }else if(e.key==='BCE4_POPULATION'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['EXPLORER','TOWN'])>0))add(`${l.id} · 마을 추가`,()=>{makePiece(s,l,'TOWN');event(s,'BUILD',`${l.id} 인구 증가 · 마을 +1`,e.actor,l.id);},l.id);
 }else if(e.key==='BCE4_FADE'){
  const p=player(s,e.target??e.actor),remainingPresence=s.lands.reduce((n,l)=>n+presence(l,p.playerId),0);
  if(remainingPresence>=2)add(`내 현신 2개 파괴${remainingPresence===2?' · 마지막 현신 소실로 패배':''}`,()=>prepend(s,step('SPECIAL',p.playerId,null,0,'DESTROY_PRESENCE',p.playerId),step('SPECIAL',p.playerId,null,0,'DESTROY_PRESENCE',p.playerId)));
  if(p.hand.length+p.discard.length+p.played.length>=2)add('내 능력 2장 망각',()=>prepend(s,step('FORGET',p.playerId,null,1,'',p.playerId),step('FORGET',p.playerId,null,1,'',p.playerId)));
  if(s.blightPool>0)add(`오염 카드의 오염 1개를 게임에서 제거${s.blightPool===1?' · 오염 공급 소진으로 패배':''}`,()=>{s.blightPool--;s.blightTotal--;event(s,'BLIGHT','힘의 쇠퇴 · 오염 공급 1개 영구 제거',p.playerId);});
 }else if(e.key==='BCE4_HUNT'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.tokens.beasts>0))for(const to of adjacent(s,l).filter(l=>l.blight===0))add(`${l.id} 야수 → ${to.id} · 피해 1`,()=>{prepend(s,step('DAMAGE',e.actor,to.id,1));moveToken(s,l,to,'beasts',e.actor);},to.id);
 }else if(e.key==='BCE4_GRIM'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.tokens.disease>0))add(`${l.id} · 침략자·다한 피해 2`,()=>prepend(s,step('DAMAGE',e.actor,l.id,2),step('SPECIAL',e.actor,l.id,2,'BCE_DAHAN_DAMAGE')),l.id);
 }else if(e.key==='BCE4_SANDFEVER'){
  const candidates=areas(s).filter(l=>l.board===e.tags[0]&&['MOUNTAIN','SANDS'].includes(l.terrain)),buildings=(l:SpiritLand)=>countPieces(l,['TOWN','CITY']),max=Math.max(0,...candidates.map(buildings));
  for(const l of candidates.filter(l=>max>0&&buildings(l)===max))add(`${l.id} · 건물 ${max}개, 질병 추가`,()=>addToken(s,l,'disease',1,e.actor),l.id);
 }else if(e.key==='BCE4_DRIVE'){
  for(const l of areas(s).filter(l=>countPieces(l,['DAHAN'])>0))for(const p of l.pieces.filter(p=>p.kind==='EXPLORER'||p.kind==='TOWN'))for(const to of adjacent(s,l))add(`${l.id} ${p.kind==='TOWN'?'마을':'탐험가'} → ${to.id}`,()=>move(s,e,l,to,p.id,p.kind==='TOWN'?'TOWN':'EXPLORER'),to.id,p.id);
  add('침략자 밀기 생략',()=>undefined);
 }
 return true;
}
export function settlementEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE4_TOKEN'){
  if(s.currentEvent==='ROOTS')s.flags.push('event-stricken');
  else prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,s.currentEvent==='NEW_LANDS'?'BCE4_HUNT':s.currentEvent==='SURGE_INLAND'?'BCE4_GRIM':'BCE4_SANDFEVER',null,[b])));
  return true;
 }
 if(e.key==='BCE4_DAHAN'){
  if(s.currentEvent==='ROOTS')prepend(s,...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE4_DRIVE',p.playerId)));
  else if(s.currentEvent==='POPULATION'){for(const p of s.players)if(areas(s).filter(l=>presence(l,p.playerId)>0).reduce((n,l)=>n+countPieces(l,['DAHAN']),0)>=2){p.energy++;event(s,'CARD','다한의 공물 · 에너지 +1',p.playerId);}}
  else s.flags.push('event-canny');
  return true;
 }
 return false;
}
