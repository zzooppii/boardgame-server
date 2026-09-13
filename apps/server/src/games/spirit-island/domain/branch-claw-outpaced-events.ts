import type { SpiritState, SpiritStep } from './state.js';
import { powerOptions, resolveSpiritPower } from './game.js';
import { step, prepend, cardPower, player, powerSpeed, setPowerSpeed, presence, addPresence, countPieces, event, requireRule } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
const remaining=(s:SpiritState,e:SpiritStep)=>e.tags.filter(id=>player(s,e.actor).played.includes(id));
const slow=(s:SpiritState,e:SpiritStep)=>remaining(s,e).filter(id=>powerSpeed(s,e.actor,id,cardPower(s,id))==='SLOW');
function nextCard(s:SpiritState,e:SpiritStep,use:boolean){prepend(s,...(use?[{...e,key:'BCE11_USE',tags:e.tags.slice(0,1),used:[]}]:[]),{...e,key:'BCE11_CARDS',tags:e.tags.slice(1),used:[]});}
function raidNext(s:SpiritState,e:SpiritStep,id?:string){const p=s.players[e.n+1];if(p)prepend(s,{...e,actor:p.playerId,target:p.playerId,n:e.n+1,tags:id?[...e.tags,id]:e.tags});}
export function outpacedOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 const p=player(s,e.actor);
 if(e.key==='BCE11_CARDS'){
  for(const id of slow(s,e))add(`${cardPower(s,id).title} · 처리하기`,()=>prepend(s,{...e,key:'BCE11_CARD',tags:[id,...e.tags.filter(c=>c!==id)]}));
  if(s.flags.includes(`sky:${e.actor}`))for(const id of remaining(s,e)){const speed=powerSpeed(s,e.actor,id,cardPower(s,id))==='SLOW'?'FAST':'SLOW';add(`${cardPower(s,id).title} · 하늘의 권한으로 ${speed==='FAST'?'빠르게 · 비용 대상에서 제외':'느리게'}`,()=>{s.flags.splice(s.flags.indexOf(`sky:${e.actor}`),1);setPowerSpeed(s,e.actor,id,speed);event(s,'POWER',`${cardPower(s,id).title} · 속도 변경`,e.actor);prepend(s,e);});}
  if(!slow(s,e).length)add('남은 느린 카드 없음 · 다음으로',()=>undefined);
 }else if(e.key==='BCE11_CARD'){
  const id=e.tags[0];requireRule(id&&p.played.includes(id));const c=cardPower(s,id);
  add(`${c.title} 버리기 · 에너지 ${c.cost+1} 획득`,()=>{p.played=p.played.filter(x=>x!==id);p.discard.push(id);p.energy+=c.cost+1;event(s,'CARD',`${c.title} 버림 · 에너지 +${c.cost+1}, 원소 제거`,e.actor);nextCard(s,e,false);});
  if(p.energy>=3)add(`${c.title} 유지 · 내 에너지 3 지불`,()=>{p.energy-=3;event(s,'CARD',`${c.title} 유지 · 에너지 3 지불`,e.actor);nextCard(s,e,true);});
  const total=s.lands.reduce((n,l)=>n+presence(l,e.actor),0);
  if(total>=2)add(`${c.title} 유지 · 내 현신 2개 희생${total===2?' · 마지막 현신 소실로 패배':''}`,()=>prepend(s,{...e,key:'BCE11_SACRIFICE',used:[]}));
  add('다른 카드부터 처리하기',()=>prepend(s,{...e,key:'BCE11_CARDS'}));
 }else if(e.key==='BCE11_SACRIFICE'){
  for(const l of s.lands.filter(l=>presence(l,e.actor)>0)){const picked=e.used.filter(id=>id===l.id).length;
   if(picked)add(`${l.id} 현신 선택 취소`,()=>{const used=[...e.used];used.splice(used.indexOf(l.id),1);prepend(s,{...e,used});},l.id);
   if(e.used.length<2&&picked<presence(l,e.actor))add(`${l.id} 내 현신 선택 (${e.used.length}/2)`,()=>prepend(s,{...e,used:[...e.used,l.id]}),l.id);
  }
  add('희생 취소 · 카드 선택으로',()=>prepend(s,{...e,key:'BCE11_CARD',used:[]}));
  if(e.used.length===2)add('내 현신 2개 희생 확정',()=>{
   for(const id of new Set(e.used)){const l=s.lands.find(l=>l.id===id);requireRule(l&&presence(l,e.actor)>=e.used.filter(x=>x===id).length);}
   for(const id of e.used){const l=s.lands.find(l=>l.id===id)!;addPresence(l,e.actor,-1);p.destroyedPresence++;event(s,'BLIGHT',`${id} 뒤처진 정령들 · 현신 희생`,e.actor,id);}
   nextCard(s,e,true);prepend(s,step('CHECK',e.actor));
  });
 }else if(e.key==='BCE11_USE'){
  const o=powerOptions(s,e.actor,true).find(o=>o.cardId===e.tags[0]);
  if(o)for(const shadowReach of [false,true])for(const target of shadowReach?o.shadowTargets:o.targets)for(const threshold of [0,1])add(`${cardPower(s,o.cardId).title} → ${target} · ${threshold?'원소 조건 적용':'기본 효과'}${o.repeat?' · 반복 권한 사용':''}${shadowReach?' · 그림자 사거리 에너지 1':''}`,()=>resolveSpiritPower(s,e.actor,{kind:'USE_POWER',cardId:o.cardId,target,threshold,repeat:o.repeat,fast:false,shadowReach},true),s.lands.some(l=>l.id===target)?target:null);
  add('지금 사용하지 않기 · 느린 단계까지 유지',()=>undefined);
 }else if(e.key==='BCE11_RAID'){
  for(const l of areas(s).filter(l=>!e.tags.includes(l.id)&&countPieces(l,['DAHAN'])>countPieces(l,['TOWN','CITY'])))add(`${l.id} · 다한 습격 피해 ${countPieces(l,['DAHAN'])}`,()=>{raidNext(s,e,l.id);prepend(s,step('DAMAGE',e.actor,l.id,countPieces(l,['DAHAN'])),step('CHECK',e.actor));},l.id);
 }else return false;
 return true;
}
export function outpacedAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCE11_MAIN'){
  event(s,'EVENT','뒤처진 정령들 · 정령마다 느린 카드를 독립적으로 처리');
  prepend(s,...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[...p.played])),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE11_DISEASE'),step('CHECK',e.actor),step('SPECIAL',s.players[0]!.playerId,null,0,'BCE11_RAID',s.players[0]!.playerId),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));return true;
 }
 if(e.key==='BCE11_CARDS'&&!slow(s,e).length&&(!s.flags.includes(`sky:${e.actor}`)||!remaining(s,e).length))return true;
 if(e.key==='BCE11_DISEASE'){s.flags.push('event-lingering-plagues');prepend(s,...[...new Set(areas(s).map(l=>l.board))].map(b=>step('SPECIAL',e.actor,null,0,'BCE5_DISEASE',null,[b])));return true;}
 if(e.key==='BCE11_RAID'&&!areas(s).some(l=>!e.tags.includes(l.id)&&countPieces(l,['DAHAN'])>countPieces(l,['TOWN','CITY']))){raidNext(s,e);return true;}
 return false;
}
