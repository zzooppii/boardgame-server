import type { PlayerId, SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { addPresence, countPieces, event, fear, invaders, land, player, prepend, presence, requireRule, step } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
export const relicNames=['빈 표식','불타는 비늘','청동 고리','물 떨어지는 이빨','얼어붙은 갈비뼈','빛나는 잉걸불','바람으로 엮은 밧줄','햇빛 기둥','가죽 주머니'] as const;
export const hasRelic=(s:SpiritState,side:'SPIRIT'|'INVADER',n:number)=>s.relics.some(r=>r.number===n&&r.side===side&&r.active);
export function setupRelics(s:SpiritState,shuffle:<T>(a:T[])=>T[]){
 const available:(1|2|3|4|5|6|7|8)[]=[1,2,3,4,5,6,7,8];
 const numbers=shuffle(available).slice(0,s.players.length+1);
 const tokens=shuffle([...numbers,...Array.from({length:3*s.players.length-1},()=>0 as const)]);
 s.relics=[];
 for(const p of s.players)for(const l of shuffle(s.lands.filter(l=>l.board===p.board&&l.number>0&&!countPieces(l,['DAHAN']))).slice(0,4))s.relics.push({land:l.id,number:tokens.shift()!,side:'HIDDEN',active:false});
}
/** Called at piece arrival and before each queued effect, including during a Power. */
export function searchRelics(s:SpiritState){
 if(s.settings.scenario!=='FORGOTTEN')return;
 for(const r of s.relics.filter(r=>r.side==='HIDDEN')){
  const l=s.lands.find(l=>l.id===r.land);if(!l)continue;
  const spirit=countPieces(l,['DAHAN'])>=3,enemy=invaders(l).length>=(s.settings.adversary==='FRANCE'?3:2);
  if(!spirit&&!enemy)continue;
  r.side=spirit?'SPIRIT':'INVADER';
  event(s,'EVENT',`${l.id} ${spirit?'다한':'침략자'} 탐색 · ${relicNames[r.number]}`,null,l.id);
  if(!r.number)continue;
  if(spirit)prepend(s,step('SPECIAL',s.players[0]!.playerId,l.id,r.number,'RELIC_FOUND'));
  else activate(s,s.players[0]!.playerId,r.number,'INVADER');
 }
}
function activate(s:SpiritState,actor:PlayerId,n:number,side:'SPIRIT'|'INVADER'){
 const r=s.relics.find(r=>r.number===n&&r.side===side);requireRule(r&&!r.active);r.active=true;
 if(n===6&&side==='SPIRIT')for(const p of s.players)p.rangeBonus++;
 if(n===4){if(side==='INVADER')s.relicIceRound=s.round+1;else s.relicRavage=true;}
 if(n===7){
  if(side==='SPIRIT'){
   const prior=s.fear;fear(s,2*s.players.length*(s.settings.adversary==='ENGLAND'&&s.settings.level===6?5:4),actor);s.fear=prior;
   prepend(s,step('SPECIAL',actor,null,0,'RELIC_ATTACK'));
  }else prepend(s,...s.players.map(p=>step('SPECIAL',actor,null,0,'RELIC_PILLAR',null,[p.board])));
 }
 if(n===8&&side==='SPIRIT')prepend(s,step('SPECIAL',actor,null,0,'RELIC_EMPTY'));
 event(s,'POWER',`${relicNames[n]} · ${side==='SPIRIT'?'정령':'침략자'} 효과 활성화`,actor);
}
export function activateRelic(s:SpiritState,actor:PlayerId,n:number){
 requireRule(s.settings.scenario==='FORGOTTEN'&&s.stage!=='SELECT');activate(s,actor,n,'SPIRIT');
}
export function shiftSands(s:SpiritState,actor:PlayerId,from:string,to:string){
 const a=land(s,from),b=land(s,to);requireRule(hasRelic(s,'SPIRIT',2)&&a.terrain==='SANDS'&&b.terrain==='SANDS'&&a.id!==b.id&&presence(a,actor)>0);
 addPresence(a,actor,-1);addPresence(b,actor,1);event(s,'MOVE',`청동 고리 · ${from} → ${to} 현신 전환`,actor,to);
}
export function relicInvaders(s:SpiritState,l:SpiritLand){return hasRelic(s,'INVADER',2)&&l.terrain==='SANDS'?s.lands.filter(a=>a.terrain==='SANDS').flatMap(invaders):invaders(l);}
export function relicOptions(s:SpiritState,e:SpiritStep,add:Add):boolean{
 if(!e.key.startsWith('RELIC_'))return false;
 if(e.key==='RELIC_FOUND'){
  add(`${relicNames[e.n]} 사용`,()=>activateRelic(s,e.actor,e.n));add('사용 보류 · 이후 시나리오 패널에서 활성화',()=>undefined);return true;
 }
 for(const l of s.lands.filter(l=>l.number>0)){
  if(e.key==='RELIC_ATTACK')add(`${l.id} · 다한 ${countPieces(l,['DAHAN'])}개 · 피해 ${2*countPieces(l,['DAHAN'])}`,()=>prepend(s,step('DAMAGE',e.actor,l.id,2*countPieces(l,['DAHAN'])),step('CHECK',e.actor)),l.id);
  if(e.key==='RELIC_EMPTY')add(`${l.id} · 모든 기물·현신·오염·토큰 영구 제거`,()=>{
   for(const pr of l.presence)player(s,pr.playerId).removedPresence+=pr.count;
   l.presence=[];l.pieces=[];s.blightTotal-=l.blight;l.blight=0;l.tokens={beasts:0,wilds:0,disease:0};
   s.relics=s.relics.filter(r=>r.land!==l.id||r.side!=='HIDDEN'&&!(r.number===8&&r.side==='INVADER'));
   event(s,'POWER',`${l.id} 가죽 주머니 · 모든 기물 영구 제거`,e.actor,l.id);
  },l.id);
  if(e.key==='RELIC_PILLAR'&&l.board===e.tags[0]){
   const buildings=countPieces(l,['TOWN','CITY']),max=Math.max(...s.lands.filter(a=>a.board===l.board).map(a=>countPieces(a,['TOWN','CITY'])));
   if(buildings>0&&buildings===max)add(`${l.id} · 건물 ${buildings}개 · 다한·토큰 파괴 후 오염`,()=>{
    l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');for(const p of l.pieces)p.strife=0;l.tokens={beasts:0,wilds:0,disease:0};prepend(s,step('BLIGHT',e.actor,l.id,1));
   },l.id);
  }
 }
 return true;
}
export function relicReclaim(s:SpiritState,id:PlayerId){s.flags.push(`relic-reclaimed:${id}`);}
