import { SPIRIT_EVENTS } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, countPieces, invaders, makePiece, fear, event, requireRule } from './primitives.js';
import { addToken } from './tokens.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
/** Pending effects survive empty Ravage slots; only the normal card activates them. */
export function normalRavageBonus(s:SpiritState,kind:string):number {
 return kind==='CITY'?2*s.flags.filter(f=>f==='event-normal-city').length:kind==='TOWN'?s.flags.filter(f=>f==='event-normal-town').length:0;
}
export function industryIslandMain(s:SpiritState,e:SpiritStep):boolean {
 const key=s.currentEvent;if(key!=='URBAN_DEVELOPMENT'&&key!=='HEAVY_FARMING')return false;
 const def=SPIRIT_EVENTS[key];s.eventIslandState=s.blighted?'BLIGHTED':'HEALTHY';event(s,'EVENT',`${def.title} · ${s.blighted?def.blighted:def.healthy}`);
 const main:SpiritStep[]=[];
 if(!s.blighted)s.flags.push(key==='URBAN_DEVELOPMENT'?'event-next-city':'event-next-town');
 else for(const b of boards(s)){
  if(key==='URBAN_DEVELOPMENT'&&areas(s).some(l=>l.board===b&&invaders(l).length>0))main.push(step('SPECIAL',e.actor,null,0,'BCE5_PITS',null,[b]));
  if(key==='HEAVY_FARMING'&&areas(s).some(l=>l.board===b&&countPieces(l,['CITY'])>0))main.push(step('SPECIAL',e.actor,null,2,'BCE3_PROTECT',null,[b,'CITY']));
 }
 prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE5_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE5_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
}
export function industryEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE5_PITS'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.blight>=2))add(`${l.id} · 오염 추가, 연쇄 없음`,()=>prepend(s,step('BLIGHT',e.actor,l.id,1,'',null,['NO_CASCADE'])),l.id);
 }else if(e.key==='BCE5_DISEASE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]))add(`${l.id} · 질병 추가`,()=>addToken(s,l,'disease',1,e.actor),l.id);
 }else if(e.key==='BCE5_GROW'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&['JUNGLE','WETLAND'].includes(l.terrain)&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 다한 추가`,()=>{makePiece(s,l,'DAHAN');event(s,'GROW',`${l.id} 다한 +1`,e.actor,l.id);},l.id);
 }else return false;
 return true;
}
export function industryEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 switch(e.key){
 case 'BCE5_NORMAL_START':
  if(s.ravage)s.flags=s.flags.map(f=>f==='event-next-city'?'event-normal-city':f==='event-next-town'?'event-normal-town':f);
  return true;
 case 'BCE5_NORMAL_END':s.flags=s.flags.filter(f=>f!=='event-normal-city'&&f!=='event-normal-town');return true;
 case 'BCE5_INVADER_END':s.flags=s.flags.filter(f=>f!=='event-lingering-plagues');return true;
 case 'BCE5_TOKEN':
  requireRule(s.currentEvent==='URBAN_DEVELOPMENT'||s.currentEvent==='HEAVY_FARMING');
  if(s.currentEvent==='URBAN_DEVELOPMENT'){
   s.flags.push('event-lingering-plagues');prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE5_DISEASE',null,[b])));
  }else prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE3_PREY')),step('SPECIAL',e.actor,null,0,'BCE3_BEAST'));
  return true;
 case 'BCE5_DAHAN':
  if(s.currentEvent==='URBAN_DEVELOPMENT'){
   for(const l of areas(s).filter(l=>invaders(l).length>0&&countPieces(l,['DAHAN'])>countPieces(l,['TOWN','CITY'])))fear(s,1,e.actor,l.id);
  }else prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE5_GROW',null,[b])));
  return true;
 default:return false;
 }
}
