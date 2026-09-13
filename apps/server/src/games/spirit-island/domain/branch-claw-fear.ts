import { SPIRIT_BRANCH_FEAR_KEYS } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, countPieces, invaders, health, event, destroyFromHealthLoss, damagePiece } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const areas=(s:SpiritState)=>s.lands.filter(l=>l.number>0);
export function branchFear(s:SpiritState,e:SpiritStep,key:string,level:number):boolean {
 if(!SPIRIT_BRANCH_FEAR_KEYS.includes(key))return false;
 if(key==='quarantine'){s.flags.push('quarantine-coast');if(level===2)s.flags.push('quarantine-source');if(level===3)s.flags.push('quarantine-disease');return true;}
 if(key==='demoralized'){for(const l of areas(s))l.defend+=level;return true;}
 if(key==='departure'&&level>=2)for(const l of areas(s).filter(l=>l.coastal))l.defend+=2*(level-1);
 const after:SpiritStep[]=(key==='unrest'||key==='panic')&&level>=2||key==='threaten'&&level===2?[step('SPECIAL',e.actor,null,0,'BCF_STRIFE_HEALTH')]:key==='threaten'&&level===3?[step('SPECIAL',e.actor,null,0,'BCF_THREATEN_DAMAGE')]:key==='discord'&&level>=2?[step('SPECIAL',e.actor,null,level,'BCF_DISCORD')]:[];
 prepend(s,...s.players.map(p=>step('SPECIAL',p.playerId,null,level,'BCF_LAND',p.playerId,[key])),...after,step('CHECK',e.actor));return true;
}
export function branchFearOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(e.key!=='BCF_LAND')return false;
 const key=e.tags[0],level=e.n;
 for(const l of areas(s)){
  const remove=(kinds:string[])=>{if(l.pieces.some(p=>kinds.includes(p.kind)))add(`${l.id} · ${kinds.length>1?'탐험가/마을':'탐험가'} 1개 제거`,()=>prepend(s,step('REMOVE',e.actor,l.id,1,'',null,kinds)),l.id);};
  const budget=(n:number)=>{if(invaders(l).some(p=>health(l,p)<=n))add(`${l.id} · 체력 합계 최대 ${n} 제거 (받은 피해와 무관)`,()=>prepend(s,step('SPECIAL',e.actor,l.id,n,'REMOVE_HEALTH')),l.id);};
  if(key==='discord'&&invaders(l).length>=2&&!s.flags.includes(`fear-used:${l.id}`))add(`${l.id} · 다른 정령과 겹치지 않는 지역 · 분쟁 1개`,()=>{
   s.flags.push(`fear-used:${l.id}`);prepend(s,step('SPECIAL',e.actor,l.id,1,'TOKEN:ADD:strife',null,['REQUIRED']));
  },l.id);
  if(key==='unrest'||key==='panic'||key==='threaten'){
   const eligible=key==='unrest'||key==='panic'&&level===3||key==='panic'&&(l.tokens.beasts>0||l.tokens.disease>0||countPieces(l,['DAHAN'])>0)||key==='threaten'&&countPieces(l,['DAHAN'])>0;
   const kinds=key==='unrest'&&level<3?['TOWN']:['EXPLORER','TOWN','CITY'];
   if(eligible&&l.pieces.some(p=>kinds.includes(p.kind)))add(`${l.id} · ${kinds.length===1?'마을':'침략자'} 하나에 분쟁 1개`,()=>prepend(s,step('SPECIAL',e.actor,l.id,1,'TOKEN:ADD:strife',null,[...kinds,'REQUIRED'])),l.id);
  }
  if(key==='careful'){
   const nearby=areas(s).filter(from=>l.adjacent.includes(from.id)).reduce((n,from)=>n+countPieces(from,['DAHAN']),0);
   if(countPieces(l,['DAHAN'])>0||nearby>=(level===1?5:level===2?3:1))add(`${l.id} · 이번 라운드 파괴 생략`,()=>{l.ravageSkip=true;event(s,'FEAR',`${l.id} 조심스러운 발걸음 · 이번 라운드 파괴 생략`,e.actor,l.id);},l.id);
  }
  if(key==='attack'){
   if(level===1&&countPieces(l,['DAHAN'])>0)remove(['EXPLORER']);
   if(level>=2&&!s.flags.includes(`fear-used:${l.id}`)&&countPieces(l,level===2?['DAHAN']:['TOWN','CITY'])>0){
    add(`${l.id} · ${level===2?'다한마다 피해 1':'다한 1개 모으기 → 다한마다 피해 2'}`,()=>{
     s.flags.push(`fear-used:${l.id}`);
     prepend(s,...(level===3?[step('MOVE',e.actor,l.id,1,'GATHER',null,['DAHAN','REQUIRED','NO_OCEAN'])]:[]),step('SPECIAL',e.actor,l.id,level,'FEAR_DAHAN_DAMAGE'));
    },l.id);
   }
  }
  if(key==='monsters'){
   if(l.tokens.beasts>0){
    if(level===1)remove(['EXPLORER','TOWN']);
    else if(countPieces(l,['EXPLORER','TOWN'])>0){const n=level===3?2:1;add(`${l.id} · 야수 지역 · 탐험가 ${n}개와 마을 ${n}개 제거`,()=>prepend(s,step('REMOVE',e.actor,l.id,n,'',null,['EXPLORER']),step('REMOVE',e.actor,l.id,n,'',null,['TOWN'])),l.id);}
   }
   if(level>=2&&areas(s).some(from=>l.adjacent.includes(from.id)&&from.tokens.beasts>0))remove(level===2?['EXPLORER']:['EXPLORER','TOWN']);
  }
  if(key==='departure'&&l.coastal&&areas(s).some(from=>l.adjacent.includes(from.id)&&from.pieces.some(p=>p.kind==='TOWN'||level>=2&&p.kind==='EXPLORER')))add(`${l.id} 해안 · ${level>=2?'탐험가/마을':'마을'} 최대 ${level===3?2:1} 모으기`,()=>prepend(s,step('MOVE',e.actor,l.id,level===3?2:1,'GATHER',null,level===1?['TOWN','NO_OCEAN']:['EXPLORER','TOWN','NO_OCEAN'])),l.id);
  if(key==='pestilent'){
   if(l.tokens.disease>0){if(level===1)remove(['EXPLORER','TOWN']);else budget(level===2?3:5);}
   if(level>=2&&!l.coastal)remove(level===2?['EXPLORER']:['EXPLORER','TOWN']);
  }
  if(key==='dangerous'&&(l.tokens.beasts>0||l.tokens.disease>0||countPieces(l,['DAHAN'])>=2)){if(level===3)budget(4);else remove(level===1?['EXPLORER']:['EXPLORER','TOWN']);}
 }
 if(key==='careful'||key==='departure'||key==='pestilent'&&level>=2||key==='dangerous'&&level===3)add('이번 정령의 선택 생략',()=>undefined);
 return true;
}

export function branchFearAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.kind!=='SPECIAL')return false;
 if(e.key==='BCF_DISCORD'){
  if(e.n===2){
   for(const l of areas(s))for(const p of [...invaders(l)].filter(p=>p.strife>0)){const n=p.strife;damagePiece(s,l,p,n,e.actor);event(s,'DAMAGE',`${l.id} 불화 · 분쟁 ${n}개로 피해 ${n}`,e.actor,l.id);}
  }else prepend(s,...areas(s).flatMap(l=>invaders(l).filter(p=>p.strife>0).map(p=>step('DAMAGE',e.actor,l.id,p.kind==='EXPLORER'?1:p.kind==='TOWN'?2:3,'BCF_DISCORD_ATTACK',null,[`EXCLUDE:${p.id}`,`SOURCE:${p.kind}`]))));
  return true;
 }
 if(e.key==='BCF_STRIFE_HEALTH'){
  for(const l of s.lands){l.strifeHealthLoss++;for(const p of [...invaders(l)])destroyFromHealthLoss(s,l,p,e.actor);}return true;
 }
 if(e.key==='BCF_THREATEN_DAMAGE'){
  prepend(s,...areas(s).filter(l=>invaders(l).some(p=>p.strife>0)).map(l=>step('DAMAGE',e.actor,l.id,countPieces(l,['DAHAN']))));return true;
 }
 return false;
}
