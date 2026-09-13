import { SPIRIT_BLIGHT, type PlayerId } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { step, prepend, player, addPresence, event, fear, countPieces, makePiece, removePiece, cardPower } from './primitives.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
const refill=(s:SpiritState)=>s.blightCard?(SPIRIT_BLIGHT[s.blightCard].perPlayer-(s.settings.scenario==='BLITZ'?1:0))*s.players.length:0;
export function flipBlight(s:SpiritState,actor:PlayerId):boolean {
 if(s.blightPool!==0||!s.blightCard||s.blighted)return false;
 s.blighted=true;const reserve=s.waveReserve,n=reserve??refill(s);s.blightPool+=n;if(reserve===null)s.blightTotal+=n;s.waveReserve=null;
 event(s,'BLIGHT',`오염된 섬 · ${SPIRIT_BLIGHT[s.blightCard].name}`,actor);
 if(s.blightCard!=='SPIRAL'&&s.blightCard!=='MEMORY')prepend(s,step('SPECIAL',actor,null,0,'BCL_REVEAL'));
 return true;
}
export function wallSupport(s:SpiritState){
 if(!s.blighted||s.blightCard!=='WALL'||s.stage!=='PREPARE')return;
 for(const p of s.players){const flag=`wall:${p.playerId}:${s.round}`;if(s.flags.includes(flag))continue;s.flags.push(flag);p.energy++;p.bonusPlays++;event(s,'GROW','벼랑 끝의 저항 · 에너지 +1 · 카드 사용 +1',p.playerId);}
}
function immediate(s:SpiritState,e:SpiritStep){
 const next:SpiritStep[]=[];
 for(const p of s.players){
  if(s.blightCard==='PALL')next.push(step('SPECIAL',p.playerId,null,0,'BCL_PRESENCE',p.playerId,[p.board]),step('SPECIAL',p.playerId,null,0,'BCL_TOWN',p.playerId,[p.board]));
  if(s.blightCard==='ECOSYSTEM')next.push(step('SPECIAL',p.playerId,null,0,'BCL_BEAST',p.playerId,[p.board]),step('SPECIAL',p.playerId,null,0,'BCL_BLIGHT',p.playerId,[p.board]));
  if(s.blightCard==='FARMLANDS')next.push(step('SPECIAL',p.playerId,null,0,'BCL_FARMLANDS',p.playerId,[p.board]));
  if(s.blightCard==='EROSION'||s.blightCard==='TIPPING'){
   for(let i=0;i<(s.blightCard==='TIPPING'?3:1);i++)next.push(step('SPECIAL',p.playerId,null,0,'DESTROY_PRESENCE',p.playerId));
   if(s.blightCard==='EROSION')next.push(step('SPECIAL',p.playerId,null,0,'BCL_ENERGY',p.playerId));
  }
 }
 if(s.blightCard==='EROSION')fear(s,2*s.players.length,e.actor);
 if(s.blightCard==='WALL')wallSupport(s);
 if(s.blightCard==='LESSER'){
  while(s.lesserOffer.length<s.players.length+1&&(s.minor.length||s.minorDiscard.length)){
   if(!s.minor.length)s.minor.push(...s.minorDiscard.splice(0));
   const id=s.minor.shift();if(id)s.lesserOffer.push(id);
  }
  next.push(...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCL_AID',p.playerId)),step('SPECIAL',e.actor,null,0,'BCL_AID_END'));
 }
 prepend(s,...next);
}
export function blightOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCL_'))return false;
 if(e.key==='BCL_REVEAL'){
  add('카드 효과 진행',()=>immediate(s,e));
  if(s.waveNumber===1&&s.players.length===1&&s.blightCard&&SPIRIT_BLIGHT[s.blightCard].perPlayer===2&&s.blightDeck.length)add('1인 규칙 · 사용하지 않은 오염 카드로 교체',()=>{
   const old=refill(s),replacement=s.blightDeck.shift();if(!replacement)return;s.blightCard=replacement;const delta=refill(s)-old;s.blightPool+=delta;s.blightTotal+=delta;
   event(s,'BLIGHT',`오염 카드 교체 · ${SPIRIT_BLIGHT[replacement].name}`,e.actor);
   prepend(s,{...e});
  });
 }else if(e.key==='BCL_AID'){
  for(const id of s.lesserOffer)add(`${cardPower(s,id).title} · 매 라운드 무료 사용`,()=>{player(s,e.actor).lesserPower=id;s.lesserOffer=s.lesserOffer.filter(c=>c!==id);event(s,'CARD',`작은 정령들의 도움 · ${cardPower(s,id).title}`,e.actor);});
 }else{
  for(const l of s.lands.filter(l=>l.board===e.tags[0])){
   if(e.key==='BCL_PRESENCE')for(const pr of l.presence)add(`${l.id} · ${player(s,pr.playerId).spirit} 현신 1개 파괴`,()=>{addPresence(l,pr.playerId,-1);player(s,pr.playerId).destroyedPresence++;event(s,'BLIGHT',`${l.id} 현신 1개 파괴`,pr.playerId,l.id);},l.id);
   if(l.number===0)continue;
   if(e.key==='BCL_TOWN')for(const piece of l.pieces.filter(p=>p.kind==='TOWN'))add(`${l.id} · 마을 1개 제거`,()=>{removePiece(s,l,piece,false,e.actor);event(s,'BLIGHT',`${l.id} 마을 제거`,e.actor,l.id);},l.id,piece.id);
   if(e.key==='BCL_BEAST'&&l.tokens.beasts>0)add(`${l.id} · 야수 1개 파괴`,()=>{l.tokens.beasts--;event(s,'BLIGHT',`${l.id} 야수 1개 파괴`,e.actor,l.id);},l.id);
   if(e.key==='BCL_BLIGHT'&&countPieces(l,['TOWN','CITY'])>0)add(`${l.id} · 오염 1개 추가`,()=>prepend(s,step('BLIGHT',e.actor,l.id,1)),l.id);
   if(e.key==='BCL_FARMLANDS'&&!l.coastal&&countPieces(l,['TOWN','CITY'])===0)add(`${l.id} · 마을 1개와 도시 1개 추가`,()=>{makePiece(s,l,'TOWN');makePiece(s,l,'CITY');event(s,'BUILD',`${l.id} 농지 · 마을·도시 추가`,e.actor,l.id);},l.id);
  }
 }
 return true;
}
export function blightAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.key==='BCL_ENERGY'){const p=player(s,e.actor);p.energy=Math.max(0,p.energy-1);event(s,'BLIGHT','의지의 침식 · 에너지 1 상실',e.actor);return true;}
 if(e.key==='BCL_AID_END'){s.minorDiscard.push(...s.lesserOffer.splice(0));return true;}
 return false;
}
export const blightTitles:Record<string,string>={BCL_REVEAL:'오염 카드를 확인하고 효과를 진행하세요',BCL_PRESENCE:'이 보드에서 파괴할 현신 1개를 고르세요 · 어느 정령이든 가능',BCL_TOWN:'이 보드에서 제거할 마을 1개를 고르세요',BCL_BEAST:'이 보드에서 파괴할 야수 1개를 고르세요',BCL_BLIGHT:'이 보드의 건물 지역에 오염 1개를 놓으세요',BCL_FARMLANDS:'마을·도시가 없는 내륙 지역에 마을과 도시를 놓으세요',BCL_AID:'내 정령이 매 라운드 무료로 사용할 보조 능력을 고르세요'};
