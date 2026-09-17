import type { SpiritLand, SpiritPiece } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { countPieces, makePiece, removePiece, damagePiece, event, step, prepend, land, requireRule } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
export const franceLevel=(s:SpiritState,n=0)=>s.settings.adversary==='FRANCE'&&s.settings.level>=n;
export const franceFearRemoval=(s:SpiritState,p:SpiritPiece)=>franceLevel(s,6)&&p.kind==='EXPLORER'&&s.flags.includes('fear-action');
export function franceRemovedBlight(s:SpiritState,n:number){
 if(!franceLevel(s,5)){s.blightPool+=n;return;}
 for(let i=0;i<n;i++){s.franceBlight++;if(s.franceBlight===3*s.players.length){s.blightPool+=s.franceBlight;event(s,'BLIGHT',`프랑스 · 보관 오염 ${s.franceBlight}개 공급으로 반환`);s.franceBlight=0;}}
}
export function franceBuild(s:SpiritState,e:SpiritStep,l:SpiritLand,city:boolean){
 if(!franceLevel(s))return;
 const next:SpiritStep[]=[];
 if(franceLevel(s,2)&&countPieces(l,['EXPLORER'])>=2)next.push(step('SPECIAL',e.actor,l.id,0,'FR_LABOR'));
 if(franceLevel(s,4)&&city&&l.coastal)next.push(step('SPECIAL',e.actor,l.id,0,'FR_TRADE'));
 prepend(s,...next);
}
export function franceOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('FR_'))return false;
 const areas=s.lands.filter(l=>l.number>0),board=areas.filter(l=>l.board===e.tags[0]);
 if(e.key==='FR_ESCALATE')for(const l of board.filter(l=>e.tags.includes(l.terrain)))add(`${l.id} · ${countPieces(l,['TOWN','CITY'])?'오염':'마을'} 1개 추가`,()=>{if(countPieces(l,['TOWN','CITY']))prepend(s,step('BLIGHT',e.actor,l.id,1));else makePiece(s,l,'TOWN');},l.id);
 if(e.key==='FR_PERSISTENT')for(const l of board.filter(l=>!countPieces(l,['EXPLORER'])))add(`${l.id} · 탐험가 1개 추가`,()=>{makePiece(s,l,'EXPLORER');event(s,'EXPLORE',`${l.id} 끈질긴 탐험가`,e.actor,l.id);},l.id);
 if(e.key==='FR_LABOR'){
  const l=land(s,e.land),explorers=l.pieces.filter(p=>p.kind==='EXPLORER');
  if(explorers.length>=2)for(const keep of explorers)add(`${l.id} · 이 탐험가를 남기고 나머지 ${explorers.length-1}개를 마을로 교체${keep.strife?` · 남는 분쟁 ${keep.strife}`:''}`,()=>{
   for(const p of explorers.filter(p=>p.id!==keep.id)){removePiece(s,l,p,false,e.actor);const town=makePiece(s,l,'TOWN',false);town.strife=p.strife;town.damage=p.damage;damagePiece(s,l,town,0,e.actor);}event(s,'BUILD',`${l.id} 강제 노동 · 탐험가를 마을로 교체`,e.actor,l.id);
  },l.id,keep.id);
 }
 if(e.key==='FR_TRADE'){
  const from=land(s,e.land),adjacent=areas.filter(l=>from.adjacent.includes(l.id)),fewest=Math.min(...adjacent.map(l=>countPieces(l,['TOWN'])));
  for(const l of adjacent.filter(l=>countPieces(l,['TOWN'])===fewest))add(`${l.id} · 삼각 무역 마을 추가`,()=>{makePiece(s,l,'TOWN');event(s,'BUILD',`${l.id} 삼각 무역 · 마을 추가`,e.actor,l.id);},l.id);
 }
 if(e.key==='FR_REBELLION_TOWN')for(const l of board)for(const p of l.pieces.filter(p=>p.kind==='TOWN'))add(`${l.id} · 마을 1개 파괴`,()=>removePiece(s,l,p,true,e.actor),l.id,p.id);
 if(e.key==='FR_REBELLION_STRIFE')for(const l of board)for(const p of l.pieces.filter(p=>(p.kind==='TOWN'||e.n===2&&p.kind==='CITY'||e.tags.includes('BUILDINGS')&&p.kind==='CITY')&&!e.used.includes(p.id)))add(`${l.id} · ${p.kind==='CITY'?'도시':'마을'}에 분쟁 1`,()=>{p.strife++;event(s,'EVENT',`${l.id} 반란 · 분쟁 추가`,e.actor,l.id);if(e.n>1)prepend(s,{...e,n:e.n-1,tags:[...e.tags,'BUILDINGS'],used:[...e.used,p.id]});},l.id,p.id);
 return true;
}
export function franceAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='FR_REBELLION_MAIN'){
  requireRule(s.currentEvent==='REBELLION');const late=s.eventInvaderStage===3,next:SpiritStep[]=[];
  for(const p of s.players){if(late)next.push(step('SPECIAL',p.playerId,null,0,'FR_REBELLION_TOWN',p.playerId,[p.board]));next.push(step('SPECIAL',p.playerId,null,late?2:1,'FR_REBELLION_STRIFE',p.playerId,[p.board]));}
  if(late)next.push(step('SPECIAL',e.actor,null,0,'FR_REBELLION_DAMAGE'));
  prepend(s,...next,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'FR_REBELLION_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,late?0:1,'FR_REBELLION_NEXT'));return true;
 }
 if(e.key==='FR_REBELLION_DAMAGE'||e.key==='FR_REBELLION_DAHAN'){
  const dahan=e.key==='FR_REBELLION_DAHAN';
  if(s.settings.scenario==='FLAME'&&!e.land){prepend(s,...s.lands.filter(l=>l.pieces.some(p=>p.kind!=='DAHAN'&&p.strife>0)&&(!dahan||countPieces(l,['DAHAN'])>0)).flatMap(l=>[{...e,land:l.id},step('SPECIAL',e.actor,null,0,'SC_ACTION_END')]));return true;}
  for(const l of e.land?[land(s,e.land)]:s.lands){const n=countPieces(l,['DAHAN']);let added=0,total=0;for(const p of [...l.pieces].filter(p=>p.kind!=='DAHAN'&&p.strife>0)){total+=dahan?n:p.strife;if(damagePiece(s,l,p,dahan?n:p.strife,e.actor)&&dahan&&(p.kind==='TOWN'||p.kind==='CITY'))added++;}if(total)event(s,'DAMAGE',`${l.id} 반란 · 분쟁 침략자에게 총 피해 ${total}`,e.actor,l.id);for(let i=0;i<added;i++)makePiece(s,l,'DAHAN');if(added)event(s,'GROW',`${l.id} 봉기 지원 · 다한 ${added}개 추가`,e.actor,l.id);}
  return true;
 }
 if(e.key==='FR_REBELLION_NEXT'){
  // Draw the next event first, then count three cards above the recurring rebellion.
  s.currentEvent=null;prepend(s,step('SPECIAL',e.actor,null,0,'BCE_START',null,e.n?['REBELLION_RETURN']:[]));return true;
 }
 if(e.key==='FR_FEAR_END'){if(e.tags[0])event(s,'FEAR',`해결 완료 · ${e.tags[0]}`,e.actor);s.flags=s.flags.filter(f=>f!=='fear-action'&&!f.startsWith('france-fear:'));return true;}
 if(e.key==='FR_SETUP_END'){s.flags=s.flags.filter(f=>f!=='setup-active');return true;}
 return false;
}
export const franceTitles:Record<string,string>={FR_ESCALATE:'프랑스 강화 · 표시된 지형에서 마을 또는 오염을 추가하세요',FR_PERSISTENT:'탐험가가 없는 지역에 탐험가 1개를 놓으세요',FR_LABOR:'마을로 교체하지 않고 남길 탐험가 하나를 고르세요',FR_TRADE:'해안 도시에 인접한, 마을이 가장 적은 지역을 고르세요',FR_REBELLION_TOWN:'반란 · 이 보드에서 마을 1개를 파괴하세요',FR_REBELLION_STRIFE:'반란 · 분쟁을 받을 건물을 고르세요'};
