import { investigationMain } from './branch-claw-investigation-events.js';
import { SPIRIT_EVENTS, type SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, countPieces, invaders, fear, event, requireRule } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
export function fearfulMobsBonus(s:SpiritState,l:SpiritLand):number {return s.flags.includes('event-fearful-mobs')&&invaders(l).length>=3?3:0;}
/** Coastal lands are one step from the ocean; land paths may cross board edges. */
export function exploreHasSource(s:SpiritState,l:SpiritLand):boolean {
 const distance=s.flags.includes('event-distant-explore')?2:1;
 let frontier=[l];const visited=new Set([l.id]);
 for(let depth=0;depth<=distance;depth++){
  if(frontier.some(a=>countPieces(a,['TOWN','CITY'])>0||depth<distance&&a.coastal))return true;
  frontier=frontier.flatMap(a=>a.adjacent.map(id=>land(s,id))).filter(a=>{if(a.number===0||visited.has(a.id))return false;visited.add(a.id);return true;});
 }
 return false;
}
export function terrorEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE6_ASSIMILATE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])===1&&!s.flags.includes(`immortal:${l.id}`)&&(countPieces(l,['CITY'])>0||l.adjacent.some(id=>countPieces(land(s,id),['CITY'])>0))))add(`${l.id} · 다한을 마을로 교체`,()=>prepend(s,step('REPLACE',e.actor,l.id,1,'SWEDEN_TOWN',null,['DAHAN'])),l.id);
 }else if(e.key==='BCE6_REPRISAL'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0&&countPieces(l,['TOWN','CITY'])>0))add(`${l.id} · 방어를 무시하고 다한 피해 3`,()=>prepend(s,step('SPECIAL',e.actor,l.id,3,'BCE_DAHAN_DAMAGE')),l.id);
 }else if(e.key==='BCE6_OFFENSIVE'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>=2&&countPieces(l,['TOWN','CITY'])>=2))add(`${l.id} · 건물 ${Math.min(countPieces(l,['DAHAN']),countPieces(l,['TOWN','CITY']))}개 파괴 후 오염 추가`,()=>prepend(s,step('DESTROY',e.actor,l.id,countPieces(l,['DAHAN']),'',null,['TOWN','CITY']),step('BLIGHT',e.actor,l.id,1)),l.id);
 }else return false;
 return true;
}
export function terrorEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE6_MAIN'){
  if(investigationMain(s,e))return true;
  const key=s.currentEvent;requireRule(key==='CULTURAL_ASSIMILATION'||key==='DISTANT_EXPLORATION');
  const def=SPIRIT_EVENTS[key];s.eventTerrorLevel=s.terror;const late=s.terror>=def.lateFrom;event(s,'EVENT',`${def.title} · 공포 ${s.terror} · ${late?def.late:def.early}`);
  const main:SpiritStep[]=[];
  if(key==='CULTURAL_ASSIMILATION')main.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,late?'BCE6_REPRISAL':'BCE6_ASSIMILATE',null,[b])));
  else s.flags.push(late?'event-fearful-mobs':'event-distant-explore');
  prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE6_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE6_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
 }
 if(e.key==='BCE6_TOKEN'){
  if(s.currentEvent==='CULTURAL_ASSIMILATION')prepend(s,...areas(s).filter(l=>l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE_BEAST_ATTACK')));
  else prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE4_GRIM',null,[b])));
  return true;
 }
 if(e.key==='BCE6_DAHAN'){
  if(s.currentEvent==='CULTURAL_ASSIMILATION')prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE6_OFFENSIVE',null,[b])));
  else for(const l of areas(s).filter(l=>invaders(l).length>0&&countPieces(l,['DAHAN'])>countPieces(l,['TOWN','CITY'])))fear(s,1,e.actor,l.id);
  return true;
 }
 return false;
}
