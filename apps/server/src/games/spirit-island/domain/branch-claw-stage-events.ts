import { SPIRIT_EVENTS, SPIRIT_TERRAIN_LABELS, type SpiritLand, type SpiritTerrain } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, sacred, invaders, countPieces, makePiece, removePiece, fear, event, requireRule } from './primitives.js';
import { addToken, moveToken } from './tokens.js';
type Add = (label:string, apply:()=>void, landId?:string|null, pieceId?:string|null)=>unknown;
const areas = (s:SpiritState) => s.lands.filter(l=>l.number>0);
const boards = (s:SpiritState) => [...new Set(areas(s).map(l=>l.board))];
const adjacent = (s:SpiritState,l:SpiritLand) => l.adjacent.map(id=>land(s,id)).filter(l=>l.number>0);
const buildings = (l:SpiritLand) => countPieces(l,['TOWN','CITY']);
const site = (s:SpiritState,l:SpiritLand) => s.players.some(p=>sacred(s,l,p.playerId));
/** The top card is public only as a stage. Prussia's early III precedes its II cards. */
export function currentInvaderStage(s:SpiritState):1|2|3 {
 const top=s.invaderDeck[0];if(!top)return 3;
 return top.stage===3&&s.settings.adversary==='PRUSSIA'&&s.settings.level>=2&&s.invaderDeck.some(c=>c.stage===2)?2:top.stage;
}
function move(s:SpiritState,e:SpiritStep,from:SpiritLand,to:SpiritLand,n:number,kinds:string[]) {
 prepend(s,step('MOVE',e.actor,from.id,n,'PUSH',null,[...kinds,'REQUIRED','NO_OCEAN',`TO:${to.id}`]));
}
export function stageEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCE2_'))return false;
 const here=e.land?land(s,e.land):null;
 if(e.key==='BCE2_DIASPORA') {
  const max=Math.max(0,...areas(s).map(l=>invaders(l).length));
  for(const l of areas(s).filter(l=>invaders(l).length===max&&max>0))add(`${l.id} · 침략자 ${max}개, 인접 지역으로 분산`,()=>prepend(s,{...e,key:'BCE2_DISPERSE',land:l.id}),l.id);
 } else if(e.key==='BCE2_DISPERSE'&&here) {
  for(const to of adjacent(s,here).filter(l=>!e.used.includes(l.id)))for(const piece of here.pieces.filter(p=>p.kind==='EXPLORER'||p.kind==='TOWN'))add(`${here.id} ${piece.kind==='TOWN'?'마을':'탐험가'} → ${to.id}`,()=>{
   prepend(s,{...e,used:[...e.used,to.id]});move(s,e,here,to,1,[piece.kind,`ONLY:${piece.id}`]);
  },to.id,piece.id);
 } else if(e.key==='BCE2_DISCOVERY') {
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&site(s,l)))add(`${l.id} · 성소로 탐험가 모으기·추가`,()=>prepend(s,step('MOVE',e.actor,l.id,1,'GATHER',null,['EXPLORER','REQUIRED','NO_OCEAN']),step('SPECIAL',e.actor,l.id,0,'BCE2_ADD_EXPLORER')),l.id);
 } else if(e.key==='BCE2_UPGRADE'&&here) {
  for(const piece of here.pieces.filter(p=>p.kind==='TOWN'))add(`${here.id} 마을${piece.strife?` · 분쟁 ${piece.strife}`:''} → 도시`,()=>{
   removePiece(s,here,piece,false,e.actor);const city=makePiece(s,here,'CITY',false);city.strife=piece.strife;
   event(s,'BUILD',`${here.id} 도시화 · 마을을 도시로 교체`,e.actor,here.id);if(e.n>1)prepend(s,{...e,n:e.n-1});
  },here.id,piece.id);
 } else if(e.key==='BCE2_PROWL') {
  for(const id of new Set(e.tags)){const l=land(s,id);if(l.tokens.beasts===0)continue;
   const rest=()=>{const tags=[...e.tags];tags.splice(tags.indexOf(id),1);if(tags.length)prepend(s,{...e,tags});};
   if(invaders(l).length)add(`${id} 야수 · 공포 1`,()=>{rest();fear(s,1,e.actor,id);},id);
   else for(const to of adjacent(s,l))add(`${id} 야수 → ${to.id}`,()=>{rest();moveToken(s,l,to,'beasts',e.actor);},to.id);
  }
 } else if(e.key==='BCE2_RETREAT') {
  const city=e.tags[1]==='CITY',froms=areas(s).filter(l=>l.board===e.tags[0]&&(city?countPieces(l,['CITY'])>0:l.blight>0));
  const pairs=froms.flatMap(from=>adjacent(s,from).filter(to=>city?countPieces(to,['CITY'])===0:to.blight===0).map(to=>({from,to,n:Math.min(2,countPieces(from,['DAHAN']))})));
  const max=Math.max(0,...pairs.map(p=>p.n));
  for(const {from,to,n} of pairs.filter(p=>p.n===max&&max>0))add(`${from.id} 다한 ${n}개 → ${to.id}`,()=>move(s,e,from,to,n,['DAHAN']),to.id);
 } else if(e.key==='BCE2_DISEASE') {
  const candidates=areas(s).filter(l=>l.board===e.tags[0]&&['JUNGLE','WETLAND'].includes(l.terrain)),max=Math.max(0,...candidates.map(buildings));
  for(const l of candidates.filter(l=>max>0&&buildings(l)===max))add(`${l.id} · 건물 ${max}개, 질병 추가`,()=>addToken(s,l,'disease',1,e.actor),l.id);
 } else if(e.key==='BCE2_TEND'||e.key==='BCE2_COMING') {
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&(e.key==='BCE2_TEND'?l.blight>0&&countPieces(l,['DAHAN'])>=2:['MOUNTAIN','SANDS'].includes(l.terrain)&&countPieces(l,['DAHAN'])>0)))add(`${l.id} · ${e.key==='BCE2_TEND'?'오염 제거':'다한 추가'}`,()=>{if(e.key==='BCE2_TEND')prepend(s,step('REMOVE_BLIGHT',e.actor,l.id,1));else{makePiece(s,l,'DAHAN');event(s,'GROW',`${l.id} 다한 +1`,e.actor,l.id);}},l.id);
 } else if(e.key==='BCE2_FORTIFY') {
  const shown=[s.ravage,s.build,s.explore,s.immigration].flatMap(c=>c?.terrains??[]);
  const terrains:SpiritTerrain[]=['MOUNTAIN','JUNGLE','SANDS','WETLAND'];
  for(const terrain of terrains.filter(t=>!shown.includes(t)))add(`${SPIRIT_TERRAIN_LABELS[terrain]} · 추가 건설`,()=>{
   event(s,'BUILD',`요새화 · ${SPIRIT_TERRAIN_LABELS[terrain]}에서 추가 건설`,e.actor);
   prepend(s,...areas(s).filter(l=>l.terrain===terrain).flatMap(l=>[step('SPECIAL',e.actor,l.id,0,'BUILD_CARD_LAND'),step('CHECK',e.actor)]));
  });
 }
 return true;
}
export function stageEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(!e.key.startsWith('BCE2_'))return false;
 switch(e.key){
 case 'BCE2_MAIN': {
  const key=s.currentEvent;requireRule(key);const def=SPIRIT_EVENTS[key];requireRule(def.type==='STAGE');
  const early=(s.eventInvaderStage??currentInvaderStage(s))===1;
  event(s,'EVENT',`${def.title} · ${early?def.early:def.late}`);
  const effects:SpiritStep[]=[];
  if(key==='SEEKING_INTERIOR'){
   if(early)for(const l of areas(s).filter(l=>l.coastal)){const inland=adjacent(s,l).filter(l=>!l.coastal);if(inland.length)effects.push(step('MOVE',e.actor,l.id,1,'PUSH',null,['EXPLORER','REQUIRED','NO_OCEAN',...inland.map(l=>`TO:${l.id}`)]));}
   else effects.push(step('SPECIAL',e.actor,null,0,'BCE2_DIASPORA'));
  } else if(key==='RECONNAISSANCE') {
   if(early)s.flags.push('event-recon');else effects.push(...areas(s).filter(l=>countPieces(l,['TOWN'])>=2).map(l=>step('SPECIAL',e.actor,l.id,Math.ceil(countPieces(l,['TOWN'])/2),'BCE2_UPGRADE')));
  } else if(key==='DISCOVERIES') {
   if(early)effects.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE2_DISCOVERY',null,[b])));else s.flags.push('event-aggression');
  } else if(key==='STRANGE_TALES') {
   if(early){effects.push(step('FEAR',e.actor,null,s.players.filter(p=>areas(s).some(l=>sacred(s,l,p.playerId))).length));s.flags.push('event-sacred-explorers');}else s.flags.push('event-fortification');
  }
  prepend(s,...effects,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE2_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE2_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
 }
 case 'BCE2_ADD_EXPLORER': if(e.land){makePiece(s,land(s,e.land),'EXPLORER');event(s,'EXPLORE',`${e.land} · 이벤트 탐험가 추가`,e.actor,e.land);}return true;
 case 'BCE2_TOKEN':
  if(s.currentEvent==='SEEKING_INTERIOR')prepend(s,step('SPECIAL',e.actor,null,0,'BCE2_PROWL',null,areas(s).flatMap(l=>Array.from({length:l.tokens.beasts},()=>l.id))));
  else if(s.currentEvent==='RECONNAISSANCE')s.flags.push('event-stricken');
  else if(s.currentEvent==='DISCOVERIES')prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE2_DISEASE',null,[b])));
  else if(s.currentEvent==='STRANGE_TALES')prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE_BEAST_ATTACK')));
  return true;
 case 'BCE2_DAHAN':
  if(s.currentEvent==='SEEKING_INTERIOR'||s.currentEvent==='RECONNAISSANCE')prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE2_RETREAT',null,[b,s.currentEvent==='SEEKING_INTERIOR'?'BLIGHT':'CITY'])));
  else prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,s.currentEvent==='DISCOVERIES'?'BCE2_TEND':'BCE2_COMING',null,[b])));
  return true;
 case 'BCE2_AFTER_ADVANCE': {
  const explorers=s.flags.includes('event-sacred-explorers'),fortify=s.flags.includes('event-fortification');
  s.flags=s.flags.filter(f=>f!=='event-sacred-explorers'&&f!=='event-fortification');
  if(explorers)prepend(s,...areas(s).filter(l=>site(s,l)).map(l=>step('SPECIAL',e.actor,l.id,0,'BCE2_ADD_EXPLORER')),step('CHECK',e.actor));
  if(fortify)prepend(s,step('SPECIAL',e.actor,null,0,'BCE2_FORTIFY'),step('CHECK',e.actor));return true;
 }
 default:return false;
 }
}
