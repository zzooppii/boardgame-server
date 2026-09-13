import type { PlayerId } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { countPieces, elements, invaders, land, player, presence, sacred, step, prepend, fear } from './primitives.js';
import { addToken } from './tokens.js';
export function branchClawPower(s:SpiritState,actor:PlayerId,key:string,id:string|null,target:PlayerId,level:number):SpiritStep[]|null {
 const l=id?land(s,id):null,p=player(s,actor),e=(key:string,n=0)=>step('SPECIAL',actor,id,n,key,target),d=(n:number)=>step('DAMAGE',actor,id,n),f=(n:number)=>step('FEAR',actor,id,n),mv=(n:number,kinds:string[])=>step('MOVE',actor,id,n,'PUSH',target,kinds),tok=(mode:string,key:string,n=1)=>e(`TOKEN:${mode}:${key}`,n);
 if(key==='innate'&&p.spirit==='FANGS')return [tok('GATHER','beasts'),...(level>=2?[e('BC_BEAST_DAMAGE')]:[]),tok('PUSH','beasts',2)];
 if(key==='innate2'&&p.spirit==='FANGS')return [f(level),d(level+1),step('SPECIAL',actor,id,1,'TOKEN:REMOVE:beasts',target,['REQUIRED'])];
 if(key==='innate'&&p.spirit==='KEEPER')return [e('BC_KEEPER_PUNISH',2+(level>=2?Math.min(elements(s,actor).SUN,elements(s,actor).PLANT):0)),step('DESTROY',actor,id,1,'',null,['DAHAN'])];
 if(key==='innate2'&&p.spirit==='KEEPER')return [mv(Math.floor(elements(s,actor).SUN/2),['EXPLORER']),e('BC_WILDS_AFTER')];
 switch(key){
 case 'prey-on-the-builders':return [tok('GATHER','beasts'),e('BC_PREY_BUILD')];
 case 'teeth-gleam-from-darkness':return [e('BC_TEETH')];
 case 'too-near-the-jungle':return [f(1),step('DESTROY',actor,id,1,'',null,['EXPLORER'])];
 case 'terrifying-chase':return [step('MOVE',actor,id,2+2*(l?.tokens.beasts??0),'PUSH',target,['EXPLORER','TOWN','DAHAN','BC_CHASE','REQUIRED']),e('BC_CHASE_FEAR')];
 case 'towering-wrath':return [f(2),d(l?[l,...l.adjacent.map(id=>land(s,id))].filter(a=>sacred(s,a,actor)).length*2:0),step('DESTROY',actor,id,10000,'',null,['DAHAN'])];
 case 'regrow-from-roots':return l&&l.blight<=2?[step('REMOVE_BLIGHT',actor,id,1)]:[];
 case 'boon-of-growing-power':return [step('GAIN',actor,null,0,'',target),...(target!==actor?[step('ENERGY',actor,null,1,'',target)]:[])];
 case 'sacrosanct-wilderness':return [e('BC_SACROSANCT')];
 default:return null;
 }
}
export function branchClawOptions(s:SpiritState,e:SpiritStep,add:(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown):boolean {
 const l=e.land?land(s,e.land):null;
 if(e.key==='BC_TEETH'&&l){add('공포 1 · 야수 1개 추가',()=>{fear(s,1,e.actor,l.id);addToken(s,l,'beasts',1,e.actor);},l.id);if(l.tokens.beasts>0&&invaders(l).length)add('공포 3',()=>fear(s,3,e.actor,l.id),l.id);return true;}
 if(e.key==='BC_SACROSANCT'&&l){add(`다한 2개 밀기 · 야생마다 피해 2 · 총 ${2*l.tokens.wilds}`,()=>prepend(s,step('MOVE',e.actor,l.id,2,'PUSH',e.actor,['DAHAN','REQUIRED']),step('DAMAGE',e.actor,l.id,2*l.tokens.wilds)),l.id);add('야생 1개 추가',()=>addToken(s,l,'wilds',1,e.actor),l.id);return true;}
 if(e.key==='BC_KEEPER_PUNISH'&&l){
  add('모든 피해를 이 지역에',()=>prepend(s,step('DAMAGE',e.actor,l.id,e.n)),l.id);
  if(elements(s,e.actor).PLANT>=4)for(const other of s.lands.filter(a=>a.id!==l.id&&presence(a,e.actor)>0))for(let n=1;n<=e.n;n++)add(`${other.id}에 ${n} · ${l.id}에 ${e.n-n}`,()=>prepend(s,step('DAMAGE',e.actor,l.id,e.n-n),step('DAMAGE',e.actor,other.id,n)),other.id);
  return true;
 }
 return false;
}
export function branchClawAutomatic(s:SpiritState,e:SpiritStep):boolean {
 const l=e.land?land(s,e.land):null;
 switch(e.key){
 case 'BC_BEAST_DAMAGE':if(l)prepend(s,step('DAMAGE',e.actor,l.id,l.tokens.beasts));return true;
 case 'BC_PREY_BUILD':if(l&&l.tokens.beasts>0)s.flags.push(`no-build:${l.id}`);return true;
 case 'BC_WILDS_AFTER':if(l&&elements(s,e.actor).PLANT>=1&&countPieces(l,['EXPLORER'])===0)addToken(s,l,'wilds',1,e.actor);return true;
 case 'BC_CHASE_FEAR':if(s.flags.includes('bc-chased')){fear(s,2,e.actor,e.land);s.flags=s.flags.filter(f=>f!=='bc-chased');}return true;
 default:return false;
 }
}
