import type { SpiritInvaderCard, SpiritLand } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { event, matches, prepend, step } from './primitives.js';
export type InvaderSlot = 'ravage'|'build'|'explore'|'immigration';
export function trackCards(s:SpiritState,slot:InvaderSlot):SpiritInvaderCard[] {return [...(s[slot]?[s[slot]]:[]),...s[`${slot}Extra`]];}
export function setTrack(s:SpiritState,slot:InvaderSlot,cards:SpiritInvaderCard[]):void {s[slot]=cards[0]??null;s[`${slot}Extra`]=cards.slice(1);}
export function shownCards(s:SpiritState):SpiritInvaderCard[] {return (['ravage','build','explore','immigration'] as const).flatMap(slot=>trackCards(s,slot));}
export function takeNextFear(s:SpiritState,kind:'build'|'explore'):number {
 const prefix=`fear-next-${kind}:`,flag=s.flags.find(f=>f.startsWith(prefix));if(!flag)return 0;
 s.flags.splice(s.flags.indexOf(flag),1);return Number(flag.slice(prefix.length));
}
export function lowestMatching(s:SpiritState,card:SpiritInvaderCard):string[] {
 return [...new Set(s.lands.map(l=>l.board))].flatMap(board=>{
  const first=s.lands.filter(l=>l.number>0&&l.board===board&&matches(l,card)).sort((a,b)=>a.number-b.number)[0];return first?[first.id]:[];
 });
}
export function beastsSkip(s:SpiritState,l:SpiritLand,kind:'ravage'|'build'|'explore'):boolean {
 return l.tokens.beasts>0&&(s.flags.includes('fear-wildbeasts:3')||kind!=='ravage'&&s.flags.includes('fear-wildbeasts:2'));
}
/** Schedule one card at a time so later cards see the results of earlier cards. */
export function invaderTrackAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(e.kind!=='SPECIAL')return false;
 if(e.key==='NORMAL_END'){s.flags=s.flags.filter(f=>f!==`normal-${e.tags[0]}`);return true;}
 if(e.key==='RAVAGE_CARDS'){
  const card=trackCards(s,'ravage')[e.n];if(!card){s.relicRavage=false;prepend(s,step('SPECIAL',e.actor,null,0,'STAGE_BUILD'));return true;}
  const areas=s.lands.filter(l=>l.number>0&&matches(l,card)),next={...e,n:e.n+1};
  event(s,'PHASE',`파괴 카드 ${e.n+1}/${trackCards(s,'ravage').length} 해결`,e.actor);
  if(s.flags.includes('event-next-build')){
   s.flags.splice(s.flags.indexOf('event-next-build'),1);s.flags.push('event-converting-build');
   prepend(s,...areas.flatMap(l=>[step('SPECIAL',e.actor,l.id,0,'BUILD_CARD_LAND'),step('CHECK',e.actor)]),step('SPECIAL',e.actor,null,0,'BCE8_BUILD_END'),next);
  }else{
   s.flags.push('normal-ravage');
   prepend(s,step('SPECIAL',e.actor,null,0,'BCE5_NORMAL_START'),...(areas.some(l=>s.flags.includes(`ruin:${l.id}`))?[step('SPECIAL',e.actor,null,0,'BCM_RAVAGE_ORDER',e.actor,areas.map(l=>l.id))]:areas.flatMap(l=>[step('SPECIAL',e.actor,l.id,0,'RAVAGE'),step('CHECK',e.actor)])),step('SPECIAL',e.actor,null,0,'BCE5_NORMAL_END'),step('SPECIAL',e.actor,null,0,'NORMAL_END',null,['ravage']),next);
  }
  return true;
 }
 if(e.key==='BUILD_CARDS'){
  const extra=e.tags.includes('IMMIGRATION'),cards=trackCards(s,extra?'immigration':'build'),card=cards[e.n];if(!card)return true;
  const next={...e,n:e.n+1},fear=extra?0:takeNextFear(s,'build');
  event(s,'BUILD',`${extra?'잉글랜드 추가 건설':'건설'} 카드 ${e.n+1}/${cards.length}${fear>=2?' · 이주 둔화로 생략':''}`,e.actor);
  if(fear===2)s.heldBuild.push(e.n);
  if(fear>=2){prepend(s,next);return true;}
  const skipped=fear===1?lowestMatching(s,card):[];
  if(!extra)s.flags.push('normal-build');
  prepend(s,...s.lands.filter(l=>l.number>0&&matches(l,card)&&!skipped.includes(l.id)).map(l=>step('SPECIAL',e.actor,l.id,0,'BUILD_CARD_LAND')),step('SPECIAL',e.actor,null,0,'NORMAL_END',null,['build']),next);return true;
 }
 if(e.key==='EXPLORE_START'){
  const flag=`fear-extra-explore:${s.round}`,extra=s.flags.filter(f=>f===flag).length;
  s.flags=s.flags.filter(f=>f!==flag);prepend(s,...Array.from({length:1+extra},()=>step('SPECIAL',e.actor,null,0,'EXPLORE')));return true;
 }
 return false;
}
