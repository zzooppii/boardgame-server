import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, countPieces, makePiece, damagePiece, event } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const boards=(s:SpiritState)=>[...new Set(areas(s).map(l=>l.board))];
function choose(s:SpiritState,e:SpiritStep,teach:boolean){
 const boardIds=boards(s);
 const main=teach?boardIds.map(b=>step('SPECIAL',e.actor,null,0,'BCE8_TOWN',null,[b])):[...boardIds.map(b=>step('SPECIAL',e.actor,null,0,'BCE8_DAHAN',null,[b])),...boardIds.map(b=>step('SPECIAL',e.actor,null,0,'BCE8_BLIGHT',null,[b])),step('SPECIAL',e.actor,null,0,'BCE8_HEALTH')];
 if(teach)s.flags.push('event-next-build');
 event(s,'EVENT',teach?'다한에게 농사를 가르치도록 권함 · 다음 정상 파괴는 건설':'침략자의 요청을 거절함');
 prepend(s,...main,step('CHECK',e.actor),step('SPECIAL',e.actor,null,Math.ceil(boardIds.length/2),'BCE_DISEASE'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));
}
export function farmerEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key==='BCE8_CHOICE'){
  add('침략자의 요청을 거절한다 · 다한 피해·오염, 건물 체력 감소',()=>choose(s,e,false));
  add('섬에 맞는 농사를 가르친다 · 마을 추가, 다음 파괴를 건설로',()=>choose(s,e,true));
 }else if(e.key==='BCE8_DAHAN'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0&&countPieces(l,['TOWN','CITY'])>0))add(`${l.id} · 다한 피해 2`,()=>prepend(s,step('SPECIAL',e.actor,l.id,2,'BCE_DAHAN_DAMAGE')),l.id);
 }else if(e.key==='BCE8_BLIGHT'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['TOWN','CITY'])>=2))add(`${l.id} · 오염 추가`,()=>prepend(s,step('BLIGHT',e.actor,l.id,1)),l.id);
 }else if(e.key==='BCE8_TOWN'){
  for(const l of areas(s).filter(l=>l.board===e.tags[0]&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 농사를 배우는 마을 추가`,()=>{makePiece(s,l,'TOWN');event(s,'BUILD',`${l.id} 다한의 가르침으로 마을 추가`,e.actor,l.id);},l.id);
 }else return false;
 return true;
}
export function farmerEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE8_HEALTH'){
  for(const l of areas(s)){l.eventBuildingHealthLoss=true;for(const p of [...l.pieces].filter(p=>p.kind==='TOWN'||p.kind==='CITY'))damagePiece(s,l,p,0,e.actor);}
  event(s,'EVENT','이번 라운드 마을·도시 체력 −1 (최소 1)');return true;
 }
 if(e.key==='BCE8_BUILD_END'){s.flags=s.flags.filter(f=>f!=='event-converting-build');event(s,'BUILD','정상 파괴 대신 건설 완료 · 대기 중인 파괴 피해 증가 유지');return true;}
 return false;
}
