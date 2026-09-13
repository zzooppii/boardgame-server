import type { SpiritLand, PlayerId } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { land, presence, prepend, step, event } from './primitives.js';
export type IslandToken = keyof SpiritLand['tokens'];
export function tokenKey(value:string): IslandToken | null {return value==='beasts'||value==='wilds'||value==='disease'?value:null;}
export function addToken(s:SpiritState,l:SpiritLand,key:IslandToken,n:number,actor:PlayerId) {
 l.tokens[key]+=n;event(s,'POWER',`${l.id} ${key==='beasts'?'야수':key==='wilds'?'야생':'질병'} +${n}`,actor,l.id);
}
export function moveToken(s:SpiritState,from:SpiritLand,to:SpiritLand,key:IslandToken,actor:PlayerId) {
 from.tokens[key]--;to.tokens[key]++;event(s,'MOVE',`${from.id} → ${to.id} ${key==='beasts'?'야수':key==='wilds'?'야생':'질병'} 이동`,actor,to.id);
 if(key==='beasts')for(const p of s.players.filter(p=>p.spirit==='FANGS'&&presence(from,p.playerId)>0))prepend(s,step('SPECIAL',actor,from.id,0,'FOLLOW_DAHAN',p.playerId,[],[to.id]));
}
export function tokenOptions(s:SpiritState,e:SpiritStep,add:(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown):boolean {
 if(!e.key.startsWith('TOKEN:'))return false;
 const [,mode,key]=e.key.split(':'),l=e.land?land(s,e.land):null;if(!l||e.n===0)return true;
 const repeat=()=>{if(e.n>1)prepend(s,{...e,n:e.n-1});};
 if(key==='strife') {
  if(mode==='ADD')for(const piece of l.pieces.filter(p=>p.kind!=='DAHAN'&&(!e.tags.some(t=>['EXPLORER','TOWN','CITY'].includes(t))||e.tags.includes(p.kind))))add(`${l.id} ${piece.kind}에 분쟁 추가`,()=>{piece.strife++;repeat();},l.id,piece.id);
  if(mode==='REMOVE')for(const piece of l.pieces.filter(p=>p.strife>0))add(`${l.id} 분쟁 제거`,()=>{piece.strife--;repeat();},l.id,piece.id);
 } else {
  const token=tokenKey(key??'');if(!token)throw new Error('Unknown island token');
  const name=token==='beasts'?'야수':token==='wilds'?'야생':'질병';
  if(mode==='ADD')add(`${l.id} ${name} 추가`,()=>{addToken(s,l,token,e.n,e.actor);},l.id);
  if(mode==='REMOVE'&&l.tokens[token]>0)add(`${l.id} ${name} 제거`,()=>{l.tokens[token]--;repeat();},l.id);
  if(mode==='GATHER')for(const id of l.adjacent){const from=land(s,id);if(from.tokens[token]>0&&(!e.tags.includes('NO_BLIGHT')||l.blight===0))add(`${from.id} → ${l.id} ${name}`,()=>{repeat();moveToken(s,from,l,token,e.actor);},from.id);}
  if(mode==='PUSH'&&l.tokens[token]>0)for(const id of l.adjacent){const to=land(s,id);if(!e.tags.includes('NO_BLIGHT')||to.blight===0)add(`${l.id} → ${to.id} ${name}`,()=>{repeat();moveToken(s,l,to,token,e.actor);},to.id);}
 }
 if(!e.tags.includes('REQUIRED'))add('이 선택 마치기',()=>undefined);
 return true;
}
