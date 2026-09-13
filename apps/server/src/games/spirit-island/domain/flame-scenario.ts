import type { PlayerId, SpiritLand, SpiritPower } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { cardPower, countPieces, distance, drowning, event, invaders, land, player, prepend, presence, requireRule, step } from './primitives.js';
import { currentInvaderStage } from './branch-claw-stage-events.js';
import { hasRelic } from './forgotten-scenario.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
function scope(s:SpiritState,l:SpiritLand){return s.flags.find(f=>f.startsWith('power:'))??`land:${l.id}`;}
function restrictions(s:SpiritState,l:SpiritLand,moving=false):[string,number][] {
 const rules:[string,number][]=[];
 if(moving){if(s.flags.some(f=>f.startsWith('power:'))&&hasRelic(s,'INVADER',6))rules.push(['wind',1]);return rules;}
 if(s.settings.scenario==='FLAME'&&!s.flames.some(id=>s.lands.some(l=>l.id===id)&&distance(s,id,l.id)<=1))rules.push(['flame',2]);
 if(s.flags.includes('scenario-fire-power')&&hasRelic(s,'INVADER',1))rules.push(['scale',1]);return rules;
}
export function scenarioDamageAllowed(s:SpiritState,l:SpiritLand):boolean{
 const id=scope(s,l);return restrictions(s,l).every(([rule])=>s.flags.includes(`sc-paid:${id}:${rule}`));
}
/** Interpose the payment before damage is allocated; declining preserves other instructions. */
export function scenarioGate(s:SpiritState,e:SpiritStep):boolean{
 if(!e.land||e.n===0&&['DAMAGE','EACH_DAMAGE','DESTROY','MOVE'].includes(e.kind))return false;
 const moving=e.kind==='MOVE'&&['PUSH','GATHER'].includes(e.key)&&e.tags.some(t=>['EXPLORER','TOWN','CITY'].includes(t));
 if(!moving&&!['DAMAGE','EACH_DAMAGE','DESTROY'].includes(e.kind)&&!['SC_DROWN','FR_REBELLION_DAMAGE','FR_REBELLION_DAHAN'].includes(e.key))return false;
 if(e.tags.includes('DAHAN_ONLY')||e.kind==='DESTROY'&&!e.tags.some(t=>['EXPLORER','TOWN','CITY'].includes(t)))return false;
 const l=land(s,e.land),rules=restrictions(s,l,moving),id=scope(s,l);
 const unpaid=rules.filter(([r])=>!s.flags.includes(`sc-paid:${id}:${r}`));
 const unanswered=unpaid.filter(([r])=>!s.flags.includes(`sc-denied:${id}:${r}`));
 if(unanswered.length){prepend(s,step('SPECIAL',e.actor,l.id,unanswered.reduce((n,[,cost])=>n+cost,0),'SC_GATE',s.flags.some(f=>f.startsWith('power:'))?e.actor:s.players[0]!.playerId,unanswered.map(([r])=>r),[id]),e);return true;}
 if(unpaid.length){
  if(e.key==='SC_DROWN'){prepend(s,{...e,key:'SC_RELOCATE'});return true;}
  if(moving&&e.tags.includes('DAHAN')){prepend(s,{...e,tags:e.tags.filter(t=>!['EXPLORER','TOWN','CITY'].includes(t))});return true;}
  event(s,'POWER',`${l.id} 침략자의 면역으로 ${moving?'밀기·모으기':'피해·파괴'} 생략`,e.actor,l.id);return true;
 }
 if(s.flags.includes('scenario-fire-power')&&hasRelic(s,'SPIRIT',1)&&!s.flags.includes('scenario-fire-bonus')&&['DAMAGE','EACH_DAMAGE'].includes(e.kind)&&e.n>0){
  s.flags.push('scenario-fire-bonus');if(e.kind==='DAMAGE')e.n++;else prepend(s,step('DAMAGE',e.actor,l.id,1));
 }
 return false;
}
export function scenarioAfterPower(s:SpiritState,_actor:PlayerId,c:SpiritPower,_at:string|null){
 s.flags=s.flags.filter(f=>!f.startsWith('sc-paid:')&&!f.startsWith('sc-denied:')&&!f.startsWith('scenario-fire-'));
 if(c.elements.includes('FIRE'))s.flags.push('scenario-fire-power');
}
export function flameRitual(s:SpiritState,actor:PlayerId,at:string,id:string){
 const p=player(s,actor),l=land(s,at);
 requireRule(s.settings.scenario==='FLAME'&&s.stage==='PREPARE'&&!p.ready&&s.players.every(p=>p.grown)&&!s.flags.includes(`flame-ritual:${actor}`)&&presence(l,actor)>0&&[...p.hand,...p.played,...p.discard].includes(id));
 const c=cardPower(s,id);requireRule(c.elements.includes('FIRE'));
 p.hand=p.hand.filter(c=>c!==id);p.played=p.played.filter(c=>c!==id);p.discard=p.discard.filter(c=>c!==id);
 (c.deck==='MINOR'?s.minorDiscard:c.deck==='MAJOR'?s.majorDiscard:s.forgotten).push(id);
 s.flags.push(`flame-ritual:${actor}`,`power:${actor}`);s.flames.push(at);
 prepend(s,step('BLIGHT',actor,at,1),step('SPECIAL',actor,at,currentInvaderStage(s),'SC_FLAME_FINISH'),step('CHECK',actor));
 event(s,'POWER',`${at} 불꽃 의식 · ${c.title} 망각`,actor,at);
}
export function flameOptions(s:SpiritState,e:SpiritStep,add:Add):boolean{
 if(e.key==='SC_GATE'){
  const id=e.used[0]!,payer=s.flags.some(f=>f.startsWith('power:'))?s.players.filter(p=>s.flags.includes(`power:${p.playerId}`)):s.players;
  for(const p of payer.filter(p=>p.energy>=e.n))add(`${p.spirit} · 에너지 ${e.n} 지불 · 면역 해제`,()=>{p.energy-=e.n;s.flags.push(...e.tags.map(r=>`sc-paid:${id}:${r}`));event(s,'POWER',`면역 해제 · 에너지 ${e.n}`,p.playerId,e.land);});
  add('지불하지 않음 · 해당 피해·파괴·이동 생략',()=>{s.flags.push(...e.tags.map(r=>`sc-denied:${id}:${r}`));});return true;
 }
 if(e.key==='SC_RELOCATE'){
  const source=land(s,e.land),piece=source.pieces.find(p=>p.id===e.used[0]);if(!piece)return true;
  const valid=s.lands.filter(l=>l.number>0),nearest=Math.min(...valid.map(l=>distance(s,source.id,l.id)));
  for(const l of valid.filter(l=>distance(s,source.id,l.id)===nearest))add(`${l.id} · 익사하지 않은 침략자 이동`,()=>{source.pieces=source.pieces.filter(p=>p.id!==piece.id);l.pieces.push(piece);event(s,'MOVE',`${l.id} 면역으로 익사하지 않은 침략자 이동`,e.actor,l.id);},l.id,piece.id);return true;
 }
 return false;
}
export function flameAutomatic(s:SpiritState,e:SpiritStep):boolean{
 if(e.key==='SC_ACTION_END'){s.flags=s.flags.filter(f=>!f.startsWith('sc-paid:')&&!f.startsWith('sc-denied:'));return true;}
 if(e.key==='SC_FLAME_FINISH'){
  const l=land(s,e.land);player(s,e.actor).energy+=e.n;
  if(invaders(l).length)prepend(s,step('FEAR',e.actor,l.id,e.n),step('DAMAGE',e.actor,l.id,countPieces(l,['DAHAN'])));return true;
 }
 if(e.key==='SC_DROWN'){
  const l=land(s,e.land),piece=l.pieces.find(p=>p.id===e.used[0]);if(piece)drowning(s,l,piece);return true;
 }
 return false;
}
