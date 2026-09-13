import type { SpiritState, SpiritStep } from './state.js';
import { countPieces, event, land, player } from './primitives.js';
type Add = (label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
/** Wards are persistent pieces. Moving an existing ward never duplicates the limited supply. */
export function wardOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key!=='WARD_PLACE')return false;
 const area=land(s,e.land),p=player(s,e.actor),cost=2*(area.blight+countPieces(area,['TOWN','CITY']));
 if(p.energy>=cost){
  const place=()=>{p.energy-=cost;s.wards.push(area.id);event(s,'POWER',`${area.id} 수호 표식 · 에너지 ${cost} · 방어 +3`,e.actor,area.id);};
  if(s.wards.length<4*s.players.length)add(`에너지 ${cost} 지불 · ${area.id} 수호`,place,area.id);
  else for(const from of [...new Set(s.wards)])add(`${from}의 표식 재사용 · 에너지 ${cost}`,()=>{s.wards.splice(s.wards.indexOf(from),1);place();},from);
 }
 add('수호 표식 배치 생략',()=>undefined);
 return true;
}
