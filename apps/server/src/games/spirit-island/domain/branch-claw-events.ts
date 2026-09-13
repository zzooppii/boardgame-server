import { SPIRIT_EVENTS, SPIRIT_ELEMENT_LABELS, type SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { cardPower, elements, player, prepend, step, event, requireRule, countPieces, presence, invaders, land, damagePiece, health } from './primitives.js';
import { addToken } from './tokens.js';
type Add = (label:string, apply:()=>void, landId?:string|null, pieceId?:string|null)=>unknown;
const boards = (s:SpiritState) => [...new Set(s.lands.filter(l=>l.number>0).map(l=>l.board))];
const buildings = (l:SpiritLand) => countPieces(l,['TOWN','CITY']);
export function eventPaymentView(s:SpiritState) {
 const payment=s.eventPayment;if(!payment)return null;
 const contributions=payment.pledges.map(pledge=>({playerId:pledge.playerId, energy:pledge.energy, support:elements(s,pledge.playerId)[payment.element]+pledge.cards.reduce((n,c)=>n+(c.mode==='DISCARD'?2:4)-(player(s,pledge.playerId).played.includes(c.cardId)?cardPower(s,c.cardId).elements.filter(e=>e===payment.element).length:0),0)}));
 const support=contributions.reduce((n,c)=>n+c.support,0), energy=contributions.reduce((n,c)=>n+c.energy,0);
 return {cost:payment.cost,element:payment.element,contributions,support,energy,remaining:Math.max(0,payment.cost-support-energy)};
}
function finishMain(s:SpiritState,e:SpiritStep,paid:boolean) {
 requireRule(s.currentEvent);const key=s.currentEvent;
 const effects:SpiritStep[]=[];
 if(paid) {
  if(key==='NEW_SPECIES')effects.push(step('FEAR',e.actor,null,s.players.length),...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE_BEAST_LAND',null,[b])));
  else effects.push(...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE_PRESENCE',p.playerId)));
 } else {
  effects.push(...boards(s).map(b=>step('SPECIAL',e.actor,null,0,'BCE_DISCARD_MINOR',null,[b])));
  if(key==='NEW_SPECIES')s.flags.push('event-return');
  else effects.push(step('SPECIAL',e.actor,null,0,'BCE_HEALTH'));
 }
 prepend(s,...effects,step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_TOKEN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_DAHAN'),step('CHECK',e.actor),step('SPECIAL',e.actor,null,0,'BCE_END'));
}
export function branchEventOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCE_'))return false;
 const owner=e.target??e.actor, p=player(s,owner), key=s.currentEvent;
 if(e.key==='BCE_REVEAL') {
  add(s.round===1?'첫 라운드 · 효과 없이 버리기':'이벤트 선택 시작',()=>{if(s.round!==1)prepend(s,step('SPECIAL',e.actor,null,0,'BCE_CHOICE'));});
 } else if(e.key==='BCE_CHOICE') {
  requireRule(key);const def=SPIRIT_EVENTS[key];
  add(def.free,()=>finishMain(s,e,false));
  add(`${def.paid} · 비용 ${4*s.players.length} · ${SPIRIT_ELEMENT_LABELS[def.element]} 지원`,()=>{s.eventPayment={cost:4*s.players.length,element:def.element,pledges:s.players.map(p=>({playerId:p.playerId,energy:0,cards:[]}))};prepend(s,step('SPECIAL',owner,null,0,'BCE_PAY',owner));});
 } else if(e.key==='BCE_PAY') {
  const payment=s.eventPayment, view=eventPaymentView(s);requireRule(payment&&view);
  const pledge=payment.pledges.find(q=>q.playerId===owner);requireRule(pledge);
  const again=()=>prepend(s,e);
  // The plan can be abandoned without consuming anyone's resources.
  add('지원 취소 · 이벤트 선택으로 돌아가기',()=>{s.eventPayment=null;prepend(s,step('SPECIAL',owner,null,0,'BCE_CHOICE'));});
  if(view.remaining===0)add('모인 지원으로 비용 확정',()=>{
   let needed=Math.max(0,payment.cost-view.support);
   for(const q of payment.pledges){const spirit=player(s,q.playerId),spent=Math.min(q.energy,needed);requireRule(spirit.energy>=spent);spirit.energy-=spent;needed-=spent;
    for(const c of q.cards){spirit.hand=spirit.hand.filter(id=>id!==c.cardId);spirit.played=spirit.played.filter(id=>id!==c.cardId);spirit.discard=spirit.discard.filter(id=>id!==c.cardId);
     if(c.mode==='DISCARD')spirit.discard.push(c.cardId);else {const deck=cardPower(s,c.cardId).deck;(deck==='MINOR'?s.minorDiscard:deck==='MAJOR'?s.majorDiscard:s.forgotten).push(c.cardId);}
     event(s,'CARD',`${cardPower(s,c.cardId).title} · 이벤트 지원 ${c.mode==='DISCARD'?'버림':'망각'}`,q.playerId);
    }
    event(s,'CARD',`이벤트 비용 · 에너지 ${spent}`,q.playerId);
   }
   requireRule(needed===0);s.eventPayment=null;finishMain(s,e,true);
  });
  if(pledge.energy<p.energy&&view.remaining>0)add('에너지 1 지원 추가',()=>{pledge.energy++;again();});
  if(pledge.energy>0)add('에너지 1 지원 취소',()=>{pledge.energy--;again();});
  for(const id of [...p.hand,...p.played,...p.discard].filter(id=>cardPower(s,id).elements.includes(payment.element))){const selected=pledge.cards.find(c=>c.cardId===id),title=cardPower(s,id).title;
   if(selected)add(`${title} · 지원 선택 취소`,()=>{pledge.cards=pledge.cards.filter(c=>c.cardId!==id);again();});
   else {if(p.hand.includes(id))add(`${title} · 손패 버림으로 지원 2`,()=>{pledge.cards.push({cardId:id,mode:'DISCARD'});again();});add(`${title} · 망각으로 지원 4${p.played.includes(id)?' (사용 원소 제외)':''}`,()=>{pledge.cards.push({cardId:id,mode:'FORGET'});again();});}
  }
  if(s.players.length>1)add('다음 정령에게 지원 선택 넘기기',()=>{const next=s.players[(s.players.findIndex(p=>p.playerId===owner)+1)%s.players.length]!;prepend(s,{...e,target:next.playerId});});
 } else if(e.key==='BCE_BLIGHT_LAND'||e.key==='BCE_BEAST_LAND') {
  for(const l of s.lands.filter(l=>l.number>0&&l.board===e.tags[0]&&(key==='LITTLE_RAIN'?l.terrain==='SANDS':buildings(l)>0)))add(`${l.id} · ${e.key==='BCE_BLIGHT_LAND'?'오염':'야수'} 추가`,()=>{if(e.key==='BCE_BLIGHT_LAND')prepend(s,step('BLIGHT',owner,l.id,1));else addToken(s,l,'beasts',1,owner);},l.id);
 } else if(e.key==='BCE_PRESENCE') {
  for(const l of s.lands.filter(l=>l.number>0&&presence(l,owner)>0&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 현신 추가`,()=>prepend(s,step('PRESENCE',owner,l.id)),l.id);
  add('현신 추가 생략',()=>undefined);
 } else if(e.key==='BCE_DISEASE') {
  for(const l of s.lands.filter(l=>l.number>0&&!e.used.includes(l.board)&&invaders(l).length>0&&countPieces(l,['DAHAN'])>0))add(`${l.id} · 질병 1, 다한 피해 2`,()=>{addToken(s,l,'disease',1,owner);prepend(s,step('SPECIAL',owner,l.id,2,'BCE_DAHAN_DAMAGE'),...(e.n>1?[{...e,n:e.n-1,used:[...e.used,l.board]}]:[]));},l.id);
 }
 return true;
}
export function branchEventAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(!e.key.startsWith('BCE_'))return false;
 switch(e.key){
 case 'BCE_START': {const key=s.eventDeck.shift();if(!key)return true;s.currentEvent=key;s.eventDiscard.push(key);event(s,'EVENT',`${SPIRIT_EVENTS[key].title}${s.round===1?' · 첫 라운드는 효과 없이 버립니다.':''}`);prepend(s,step('SPECIAL',e.actor,null,0,'BCE_REVEAL'));return true;}
 case 'BCE_DISCARD_MINOR': {const id=s.minor.shift()??s.minorDiscard.shift();if(!id)return true;s.minorDiscard.push(id);const c=cardPower(s,id);event(s,'CARD',`${e.tags[0]} · 이벤트 공개 후 버림: ${c.title}`);if(s.currentEvent==='NEW_SPECIES'?c.speed==='FAST':!c.elements.includes('WATER'))prepend(s,{...e,key:'BCE_BLIGHT_LAND'});return true;}
 case 'BCE_HEALTH': for(const l of s.lands.filter(l=>l.number>0)){l.eventHealthLoss=true;for(const piece of [...l.pieces])damagePiece(s,l,piece,0,e.actor);}return true;
 case 'BCE_TOKEN': if(s.currentEvent==='NEW_SPECIES')prepend(s,step('SPECIAL',e.actor,null,Math.ceil(boards(s).length/2),'BCE_DISEASE'));else prepend(s,...s.lands.filter(l=>l.number>0&&l.tokens.beasts>0).map(l=>step('SPECIAL',e.actor,l.id,l.tokens.beasts,'BCE_BEAST_ATTACK')));return true;
 case 'BCE_BEAST_ATTACK': {const l=land(s,e.land);if(e.n>0)prepend(s,step('DAMAGE',e.actor,l.id,2),step('SPECIAL',e.actor,l.id,e.n,'BCE_BEAST_AFTER',null,[],l.pieces.filter(p=>p.kind==='TOWN'||p.kind==='CITY').map(p=>p.id)));return true;}
 case 'BCE_BEAST_AFTER': {const l=land(s,e.land);if(e.used.some(id=>!l.pieces.some(p=>p.id===id)))l.tokens.beasts=Math.max(0,l.tokens.beasts-1);if(e.n>1)prepend(s,{...e,key:'BCE_BEAST_ATTACK',n:e.n-1,used:[]});return true;}
 case 'BCE_DAHAN_DAMAGE': {const l=land(s,e.land);let n=e.n;for(const piece of [...l.pieces].filter(p=>p.kind==='DAHAN').sort((a,b)=>b.damage-a.damage)){if(!n)break;const hit=Math.min(n,health(l,piece)-piece.damage);damagePiece(s,l,piece,hit,e.actor);n-=hit;}return true;}
 case 'BCE_DAHAN': if(s.currentEvent==='NEW_SPECIES'){for(const p of s.players)if(s.lands.filter(l=>l.number>0&&presence(l,p.playerId)>0).reduce((n,l)=>n+countPieces(l,['DAHAN']),0)>=2){p.energy++;event(s,'CARD','다한의 공물 · 에너지 +1',p.playerId);}}else s.flags.push('event-canny');return true;
 case 'BCE_END': if(s.flags.includes('event-return')&&s.currentEvent){const key=s.currentEvent;s.eventDiscard=s.eventDiscard.filter(k=>k!==key);s.eventDeck=s.eventDeck.filter(k=>k!==key);s.eventDeck.splice(Math.min(2,s.eventDeck.length),0,key);s.flags=s.flags.filter(f=>f!=='event-return');}event(s,'PHASE','이벤트 해결 완료 · 공포 단계');return true;
 default:return false;
 }
}
