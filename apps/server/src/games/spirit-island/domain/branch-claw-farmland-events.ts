import { shownCards } from './invader-track.js';
import { SPIRIT_TERRAIN_LABELS, type SpiritTerrain } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, land, countPieces, makePiece, event } from './primitives.js';
import { addToken } from './tokens.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
export function farmlandIslandMain(s:SpiritState,e:SpiritStep):boolean {
 if(s.currentEvent!=='FARMLAND')return false;
 s.eventIslandState=s.blighted?'BLIGHTED':'HEALTHY';
 event(s,'EVENT',s.blighted?'새 환금 작물의 정착 · 추가 파괴':'비옥한 농경지 · 탐험 중 보드마다 마을 1개');
 if(!s.blighted)s.flags.push('event-farmland');
 prepend(s,...(s.blighted?[step('SPECIAL',e.actor,null,0,'BCE9_TERRAIN')]:[]),step('CHECK',e.actor),...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE9_BEAST',null,[b])),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE9_DEFENSE'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));
 return true;
}
export function farmlandExploreSteps(s:SpiritState,e:SpiritStep,ids:string[]):SpiritStep[] {
 return boards(s).flatMap(b=>{const targets=ids.filter(id=>land(s,id).board===b);return targets.length?[step('SPECIAL',e.actor,null,0,'BCE9_EXPLORE',null,targets)]:[];});
}
function explore(s:SpiritState,e:SpiritStep,town:string|null){
 for(const id of e.tags){const l=land(s,id);makePiece(s,l,id===town?'TOWN':'EXPLORER');if(s.flags.includes('event-recon'))makePiece(s,l,'EXPLORER');event(s,'EXPLORE',`${id} ${id===town?'비옥한 농경지 · 마을':'탐험가'} 진입`,e.actor,id);}
 if(town)s.flags.push(`event-farmland-used:${land(s,town).board}`);
}
export function farmlandEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE9_TERRAIN'){
  const shown=shownCards(s).flatMap(c=>c.terrains),terrains:SpiritTerrain[]=['MOUNTAIN','JUNGLE','SANDS','WETLAND'];
  for(const terrain of terrains.filter(t=>!shown.includes(t)))add(`${SPIRIT_TERRAIN_LABELS[terrain]} · 추가 파괴`,()=>prepend(s,...boards(s).map(b=>step('SPECIAL',e.actor,null,2,'BCE3_PROTECT',null,[b,'RAVAGE',terrain]))));
 }else if(e.key==='BCE9_EXPLORE'){
  for(const id of e.tags)add(`${id} · 탐험가 대신 마을`,()=>explore(s,e,id),id);
 }else if(e.key==='BCE9_BEAST'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&l.blight===0&&countPieces(l,['TOWN'])>0))add(`${l.id} · 자극받은 야수 추가`,()=>addToken(s,l,'beasts',1,e.actor),l.id);
 }else return false;
 return true;
}
export function farmlandEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE9_EXPLORE'&&e.tags[0]&&s.flags.includes(`event-farmland-used:${land(s,e.tags[0]).board}`)){explore(s,e,null);return true;}
 if(e.key==='BCE9_RAVAGE'){
  const targets=areas(s).filter(l=>l.board===e.tags[0]&&l.terrain===e.tags[2]);
  prepend(s,...(targets.some(l=>s.flags.includes(`ruin:${l.id}`))?[step('SPECIAL',e.actor,null,0,'BCM_RAVAGE_ORDER',e.actor,targets.map(l=>l.id))]:targets.flatMap(l=>[step('SPECIAL',e.actor,l.id,0,'RAVAGE'),step('CHECK',e.actor)])));return true;
 }
 if(e.key==='BCE9_DEFENSE'){s.flags.push('event-canny');event(s,'EVENT','영리한 방어 · 이후 파괴에서 다한마다 방어 1');return true;}
 return false;
}
