import { SPIRIT_BOARDS, SPIRIT_ELEMENTS, type PlayerId, type SpiritElement, type SpiritLand, type SpiritPiece } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { addPresence, cardPower, countPieces, distance, event, inRange, invaders, land, meets, oceanActive, player, presence, prepend, removePiece, sacred, step, targetAllowed } from './primitives.js';
import { addToken, type IslandToken } from './tokens.js';
import { powerSteps } from './powers.js';

type Add = (label: string, apply: () => void, landId?: string | null, pieceId?: string | null) => unknown;
const kinds: SpiritPiece['kind'][] = ['EXPLORER','TOWN','CITY'];
const names = {EXPLORER:'탐험가',TOWN:'마을',CITY:'도시',DAHAN:'다한'};
const tokenNames = {beasts:'야수',disease:'질병',wilds:'야생',strife:'분쟁'};
const tokens: IslandToken[] = ['beasts','disease','wilds'];
const adj = (s: SpiritState, l: SpiritLand) => l.adjacent.map(id=>land(s,id)).filter(a=>oceanActive(s,a));
const special = (e: SpiritStep, key: string, n=0, at=e.land, tags:string[]=[]) => step('SPECIAL',e.actor,at,n,key,e.target,tags);
const damage = (e: SpiritStep,n:number,at=e.land,tags:string[]=[]) => step('DAMAGE',e.actor,at,n,'',null,tags);
const token = (e:SpiritStep,key:string,n=1,at=e.land) => special(e,`TOKEN:ADD:${key}`,n,at,['REQUIRED']);
const destroy = (e:SpiritStep,ks:SpiritPiece['kind'][],at=e.land) => step('DESTROY',e.actor,at,10000,'',null,ks);
const neighbors = (e:SpiritStep,key:string,n:number) => special(e,'BCM_NEIGHBORS',n,e.land,[key]);

export function branchMajorPower(s:SpiritState,actor:PlayerId,key:string,id:string|null,target:PlayerId,level:number):SpiritStep[]|null {
 const e=step('SPECIAL',actor,id,0,'',target), l=id?land(s,id):null;
 const b=(t:Partial<Record<SpiritElement,number>>) => level>0&&meets(s,actor,t);
 const x=(key:string,n=0)=>special(e,key,n), f=(n:number)=>step('FEAR',actor,id,n);
 switch(key){
  case 'strangling-firevine': return [destroy(e,['EXPLORER']),token(e,'wilds'),x('BCM_FIREVINE_SOURCE',b({FIRE:2,PLANT:3})?2:1)];
  case 'bloodwrack-plague': return [token(e,'disease',2),x('BCM_PLAGUE',b({EARTH:2,ANIMAL:4})?1:0)];
  case 'cast-down-into-the-briny-deep': return [f(6),destroy(e,kinds),...(b({SUN:2,MOON:2,WATER:4,EARTH:4})?[x('BCM_SINK')]:[])];
  case 'death-falls-gently-from-open-blossoms': return [damage(e,4),x('BCM_BLOSSOMS'),...(b({AIR:3,PLANT:3})?[f(3),neighbors(e,'disease',2)]:[])];
  case 'fire-and-flood': return [x('BCM_FIRE_FLOOD_SOURCE',(b({FIRE:3})?1:0)+(b({WATER:3})?1:0))];
  case 'grant-hatred-a-ravenous-form': {const n=l?l.blight+l.pieces.reduce((n,p)=>n+p.strife,0):0;return [f(n),damage(e,2*n),x('BCM_HATRED',l?invaders(l).length:0),...(b({MOON:4,FIRE:2})?[neighbors(e,'strife',3)]:[])];}
  case 'insatiable-hunger-of-the-swarm':return [step('BLIGHT',actor,id,1),token(e,'beasts',2),special(e,'TOKEN:GATHER:beasts',2),x('BCM_SWARM'),...(b({AIR:2,ANIMAL:4})?[special(e,'BCM_REPEAT',1,id,[key,'ADJACENT'])]:[])];
  case 'instruments-of-their-own-ruin':return [token(e,'strife'),x('BCM_RUIN',b({SUN:4,FIRE:2,ANIMAL:2})?1:0)];
  case 'flow-like-water-reach-like-air':return [x('BCM_FLOW',b({AIR:2,WATER:2})?1:0)];
  case 'pent-up-calamity':return [x('BCM_CALAMITY',b({MOON:2,FIRE:3})?1:0)];
  case 'pyroclastic-flow':return [damage(e,2),destroy(e,['EXPLORER']),...(l&&['JUNGLE','WETLAND'].includes(l.terrain)?[step('BLIGHT',actor,id,1)]:[]),...(b({FIRE:2,AIR:3,EARTH:2})?[damage(e,4),token(e,'wilds')]:[])];
  case 'savage-transformation':return [f(2),x('BCM_TRANSFORM'),...(b({MOON:2,ANIMAL:3})?[special(e,'BCM_TRANSFORM',1)]:[])];
  case 'sea-monsters':return [token(e,'beasts'),x('BCM_SEA'),...(b({WATER:3,ANIMAL:3})?[special(e,'BCM_REPEAT',0,id,[key])]:[])];
  case 'tigers-hunting':return [f(2),token(e,'beasts'),special(e,'TOKEN:GATHER:beasts',1),x('BCM_BEAST_DAMAGE'),special(e,'TOKEN:PUSH:beasts',2),...(b({SUN:2,MOON:2,ANIMAL:3})?[x('BCM_TIGER_ADJ')]:[])];
  case 'unrelenting-growth':return [x('BCM_GROWTH',b({SUN:3,PLANT:3})?1:0)];
  case 'volcanic-eruption':return [f(6),damage(e,20),destroy(e,['DAHAN']),x('BCM_KILL_BEASTS'),step('BLIGHT',actor,id,1),...(b({FIRE:4,EARTH:3})?[destroy(e,kinds),token(e,'wilds'),x('BCM_VOLCANO_ADJ')]:[])];
  case 'sweep-into-the-sea':return [x('BCM_SWEEP'),...(b({SUN:3,WATER:2})?[special(e,'BCM_REPEAT',1,id,[key,'ADJACENT'])]:[])];
  case 'manifest-incarnation':return [f(6+(l?countPieces(l,['TOWN','CITY'])+presence(l,actor):0)+(b({SUN:3,MOON:3})?3:0)),...(['CITY','TOWN','EXPLORER'] as const).map(k=>step('REMOVE',actor,id,1,'',null,[k])),special(e,'BCM_MANIFEST',b({SUN:3,MOON:3})?6:0)];
  case 'smothering-infestation':return [token(e,'disease'),...(l&&['JUNGLE','WETLAND'].includes(l.terrain)?[f(2),damage(e,3)]:[]),...(b({WATER:2,PLANT:2})?[step('EACH_DAMAGE',actor,id,1,'',null,kinds)]:[])];
  case 'twisted-flowers-murmur-ultimatums':return [f(4),token(e,'strife'),...(b({MOON:3,AIR:2,PLANT:3})?[f(3)]:[]),x('BCM_ULTIMATUM'),...(b({MOON:3,AIR:2,PLANT:3})?[damage(e,3)]:[])];
  case 'unlock-the-gates-of-deepest-power':return [step('GAIN',actor,null,2,'BCM_UNLOCK',target,b(Object.fromEntries(SPIRIT_ELEMENTS.map(e=>[e,2])))?['THRESHOLD']:[])];
  default:return null;
 }
}

export function branchMajorOptions(s:SpiritState,e:SpiritStep,add:Add):boolean {
 if(!e.key.startsWith('BCM_'))return false;
 const l=e.land?land(s,e.land):null, owner=e.target??e.actor,p=player(s,owner), queue=(...es:SpiritStep[])=>prepend(s,...es);
 switch(e.key){
  case 'BCM_RAVAGE_ORDER':
   for(const id of e.tags.filter(id=>s.lands.some(l=>l.id===id)))add(`${id} 파괴 먼저 해결`,()=>queue(step('SPECIAL',e.actor,id,0,'RAVAGE'),step('CHECK',e.actor),{...e,tags:e.tags.filter(x=>x!==id)}),id);return true;
  case 'BCM_UNLOCK_PLAY': {
   const id=e.tags[0]!;if(!p.hand.includes(id))return true;
   const c=cardPower(s,id),cost=Math.max(0,Math.ceil(c.cost/2)-(s.settings.scenario==='BLITZ'&&c.speed==='FAST'?1:0));
   const play=(forget:boolean)=>{if(!forget)p.energy-=cost;else s.flags.push(`forget-end:${id}`);p.hand=p.hand.filter(x=>x!==id);p.played.push(id);p.ready=false;s.flags.push(`unlocked:${owner}:${c.key}`);event(s,'CARD',`${c.title} 모든 원소 조건으로 준비`,owner);};
   if(p.energy>=cost)add(`${cost} 에너지 지불 · 모든 원소 조건으로 준비`,()=>play(false));
   add('라운드 끝 망각 · 무료 준비',()=>play(true));add('준비하지 않기',()=>undefined);return true;
  }
  case 'BCM_SINK_RESCUE': {
   const board=e.tags[0]!,area=s.lands.find(a=>a.board===board&&a.pieces.some(p=>p.kind==='DAHAN'));
   if(!area)return true;const piece=area.pieces.find(p=>p.kind==='DAHAN')!;
   const legal=s.lands.filter(a=>a.board!==board&&a.number>0),min=Math.min(...legal.map(a=>distance(s,area.id,a.id)));
   for(const to of legal.filter(a=>distance(s,area.id,a.id)===min))add(`${area.id} 살아남은 다한 → ${to.id}`,()=>{area.pieces=area.pieces.filter(p=>p.id!==piece.id);to.pieces.push(piece);queue(e);},to.id,piece.id);
   return true;
  }
  case 'BCM_FIREVINE_SOURCE':
   if(l)for(const source of s.lands.filter(a=>a.terrain==='SANDS'&&[e.actor,...player(s,e.actor).sharedWith].some(p=>presence(a,p)>0)&&sourceReach(s,e,a,l,1)))add(`${source.id} 출발 모래 · 야생 추가`,()=>queue(token(e,'wilds',1,source.id),special(e,'BCM_FIREVINE_DAMAGE',e.n)),source.id);
   return true;
  case 'BCM_NEIGHBORS':
   if(l&&e.n>0)for(const area of adj(s,l).filter(a=>!e.used.includes(a.id)&&(e.tags[0]!=='disease'||invaders(a).length)))add(`${area.id} ${e.tags[0]==='strife'?'분쟁':'질병'} 추가`,()=>queue(token(e,e.tags[0]!,1,area.id),{...e,n:e.n-1,used:[...e.used,area.id]}),area.id);
   if(e.tags[0]==='strife')add('인접 지역 선택 마치기',()=>undefined);return true;
  case 'BCM_TRANSFORM':
   if(l)for(const area of e.n?[l,...adj(s,l)]:[l])for(const piece of area.pieces.filter(p=>p.kind==='EXPLORER'))add(`${area.id} 탐험가 → 야수`,()=>{removePiece(s,area,piece,false,e.actor);addToken(s,area,'beasts',1,e.actor);},area.id,piece.id);return true;
  case 'BCM_TIGER_ADJ':
   if(l)for(const area of adj(s,l).filter(a=>!a.blight))add(`${area.id} 피해 ${1+area.tokens.beasts}`,()=>queue(damage(e,1+area.tokens.beasts,area.id)),area.id);return true;
  case 'BCM_GROWTH':
   for(const area of s.lands.filter(a=>oceanActive(s,a)&&inRange(s,owner,a,1)))add(`${area.id} 현신 2개 · 야생`,()=>queue(step('PRESENCE',e.actor,area.id,0,'POWER',owner),step('PRESENCE',e.actor,area.id,0,'POWER',owner),token(e,'wilds',e.n?2:1,area.id),...(e.n?[step('REMOVE_BLIGHT',e.actor,area.id,1),step('GAIN',e.actor,null,1,'',owner)]:[])),area.id);return true;
  case 'BCM_REPEAT':
   if(l)for(const area of e.tags.includes('ADJACENT')?adj(s,l):s.lands.filter(a=>oceanActive(s,a))) {
    const c=s.cards.find(c=>c.key===e.tags[0]);if(!c)continue;
    // Only a repeat with an explicit destination overrides normal targeting.
    const meta=cardPower(s,c.cardId);if(!e.tags.includes('ADJACENT')&&!targetAllowed(s,e.actor,meta,area))continue;
    add(`${area.id} ${meta.title} 반복`,()=>{s.flags=s.flags.filter(f=>!f.startsWith('dream-'));queue(...powerSteps(s,e.actor,meta.key,area.id,owner,1).filter(x=>x.key!=='BCM_REPEAT'));},area.id);
   }return true;
  case 'BCM_SWEEP':
   if(l){if(l.coastal)add('해안의 탐험가·마을 모두 파괴',()=>queue(destroy(e,['EXPLORER','TOWN'])),l.id);
    add('가장 가까운 바다 방향으로 모두 밀기',()=>queue(step('MOVE',e.actor,l.id,countPieces(l,['EXPLORER','TOWN']),'PUSH',owner,['EXPLORER','TOWN','REQUIRED','TOWARDS_OCEAN'])),l.id);}
   return true;
  case 'BCM_CALAMITY':
   add('질병 1 · 분쟁 추가',()=>queue(token(e,'disease'),token(e,'strife',e.n?3:1)),e.land);
   add('토큰을 제거하여 공포와 피해',()=>queue(special(e,'BCM_CALAMITY_REMOVE',e.n)),e.land);return true;
  case 'BCM_CALAMITY_REMOVE':
   if(l){for(const key of tokens)if(l.tokens[key])add(`${tokenNames[key]} 1개 제거`,()=>{l.tokens[key]--;queue({...e,used:[...e.used,key]});},l.id);
    for(const piece of invaders(l).filter(p=>p.strife))add(`${names[piece.kind]} 분쟁 1개 제거`,()=>{piece.strife--;queue({...e,used:[...e.used,'strife']});},l.id,piece.id);
    add(`제거 완료 · 공포 ${e.used.length} · 피해 ${e.used.length*3}`,()=>queue(step('FEAR',e.actor,l.id,e.used.length),damage(e,e.used.length*3),...(e.n?[e.used.length?{...e,key:'BCM_CALAMITY_RETURN',n:Math.min(2,e.used.length)}:token(e,'strife',2)]:[])),l.id);}
   return true;
  case 'BCM_CALAMITY_RETURN':
   if(e.n>0)for(const key of [...new Set(e.used)])add(`${key==='strife'?'분쟁':key==='beasts'?'야수':key==='disease'?'질병':'야생'} 1개 반환`,()=>{const used=[...e.used];used.splice(used.indexOf(key),1);queue(token(e,key),{...e,n:e.n-1,used});},e.land);
   add('반환 마치기',()=>undefined);return true;
  case 'BCM_FIRE_FLOOD_SOURCE':
   if(l)for(const source of s.lands.filter(a=>[e.actor,...player(s,e.actor).sharedWith].some(p=>sacred(s,a,p))&&sourceReach(s,e,a,l,1)))add(`${source.id} 공통 성소`,()=>queue({...e,key:'BCM_FIRE_FLOOD_SECOND',tags:[source.id]}),source.id);return true;
  case 'BCM_FIRE_FLOOD_SECOND':
   if(l)for(const area of s.lands.filter(a=>a.id!==l.id&&oceanActive(s,a)&&sourceReach(s,e,land(s,e.tags[0]!),a,2)))add(`${area.id} 두 번째 대상 · 각 피해 4`,()=>queue(damage(e,4),damage(e,4,area.id),{...e,key:'BCM_FIRE_FLOOD_BONUS',tags:[l.id,area.id]}),area.id);return true;
  case 'BCM_FIRE_FLOOD_BONUS':
   if(e.n>0)for(const id of e.tags.filter(id=>s.lands.some(l=>l.id===id)))add(`${id} 추가 피해 4`,()=>queue(damage(e,4,id),{...e,n:e.n-1}),id);return true;
  case 'BCM_FLOW_MOVE':
   for(const from of s.lands.filter(a=>presence(a,owner)))for(const to of adj(s,from))add(`${from.id} 현신 → ${to.id}`,()=>{
    addPresence(from,owner,-1);const prior=presence(to,owner);addPresence(to,owner,1);event(s,'MOVE',`${from.id} → ${to.id} 현신 이동`,owner,to.id);
    queue(...(['EXPLORER','TOWN','DAHAN',...(e.n?['CITY','BLIGHT']:[])]).map(k=>step('SPECIAL',e.actor,from.id,2,'BCM_FLOW_CARRY',owner,[k,to.id])),...(p.spirit==='KEEPER'&&prior===1?[step('MOVE',owner,to.id,countPieces(to,['DAHAN']),'PUSH',owner,['DAHAN','REQUIRED'])]:[]));
   },to.id);add('현신을 이동하지 않기',()=>undefined);return true;
  case 'BCM_FLOW_CARRY':
   if(l&&e.n>0){const to=s.lands.find(a=>a.id===e.tags[1]);if(to){if(e.tags[0]==='BLIGHT'&&l.blight)add(`${l.id} 오염 → ${to.id}`,()=>{l.blight--;to.blight++;queue({...e,n:e.n-1});},to.id);
    for(const piece of l.pieces.filter(p=>p.kind===e.tags[0]))add(`${l.id} ${names[piece.kind]} → ${to.id}`,()=>queue(step('MOVE',e.actor,l.id,1,'PUSH',owner,[piece.kind,'REQUIRED',`ONLY:${piece.id}`,`TO:${to.id}`]),{...e,n:e.n-1}),to.id,piece.id);}}
   add('동반 이동 마치기',()=>undefined);return true;
  default:return false;
 }
}

export function branchMajorAutomatic(s:SpiritState,e:SpiritStep):boolean {
 if(!e.key.startsWith('BCM_'))return false;
 const l=e.land?land(s,e.land):null,owner=e.target??e.actor;
 switch(e.key){
  case 'BCM_RUIN':if(l){if(e.n)s.flags.push(`ruin:${l.id}`);else prepend(s,...invaders(l).filter(p=>p.strife>0).map(p=>damage(e,p.kind==='EXPLORER'?1:p.kind==='TOWN'?2:3,l.id,[`EXCLUDE:${p.id}`])));}return true;
  case 'BCM_SINK':if(l){
   const doomed=s.lands.filter(a=>a.board===l.board),dream=player(s,e.actor).spirit==='BRINGER'&&s.flags.includes(`power:${e.actor}`);
   for(const area of doomed){for(const piece of [...area.pieces])removePiece(s,area,piece,true,e.actor);for(const disc of [...area.presence])if(!dream||disc.playerId===e.actor){player(s,disc.playerId).destroyedPresence+=disc.count;addPresence(area,disc.playerId,-disc.count);}if(!dream){area.tokens={beasts:0,wilds:0,disease:0};s.blightTotal-=area.blight;area.blight=0;}}
   if(!dream)prepend(s,special(e,'BCM_SINK_RESCUE',0,null,[l.board]),special(e,'BCM_SINK_FINISH',0,null,[l.board]));return true;
  }return true;
  case 'BCM_SINK_FINISH':{
   const board=e.tags[0]!,ids=s.lands.filter(l=>l.board===board).map(l=>l.id);const boardId=SPIRIT_BOARDS.find(b=>b===board);if(!boardId)throw new Error('Unknown destroyed board');s.destroyedBoards.push(boardId);s.lands=s.lands.filter(l=>l.board!==board);
   for(const area of s.lands)area.adjacent=area.adjacent.filter(id=>!ids.includes(id));
   s.queue=s.queue.filter(e=>!e.land||!ids.includes(e.land));s.vengeance=s.vengeance.filter(v=>!ids.includes(v.land));s.plans=s.plans.filter(p=>!ids.includes(p.landId));s.hearts=s.hearts.filter(id=>!ids.includes(id));event(s,'POWER',`${board} 보드가 바다 아래로 가라앉았습니다.`,e.actor);return true;
  }
  case 'BCM_FIREVINE_DAMAGE':if(l)prepend(s,damage(e,[l,...adj(s,l)].reduce((n,l)=>n+l.tokens.wilds,0)*e.n));return true;
  case 'BCM_PLAGUE':if(l){const n=l.tokens.disease;for(const area of [l,...adj(s,l)])area.defend+=n;if(e.n)prepend(s,step('FEAR',e.actor,l.id,2),damage(e,n,l.id,['ADJACENT']));}return true;
  case 'BCM_BLOSSOMS':if(l&&invaders(l).length)prepend(s,token(e,'disease'));return true;
  case 'BCM_HATRED':if(l&&e.n>0&&!invaders(l).length)prepend(s,token(e,'beasts'));return true;
  case 'BCM_SWARM':if(l){const n=l.tokens.beasts;prepend(s,step('FEAR',e.actor,l.id,n),damage(e,2*n),damage(e,2*n,l.id,['DAHAN_ONLY']),special(e,'BCM_KILL_BEASTS',1));}return true;
  case 'BCM_KILL_BEASTS':if(l&&!(player(s,e.actor).spirit==='BRINGER'&&s.flags.includes(`power:${e.actor}`)))l.tokens.beasts=e.n?Math.max(0,l.tokens.beasts-e.n):0;return true;
  case 'BCM_SEA':if(l)prepend(s,...(invaders(l).length?[step('FEAR',e.actor,l.id,Math.min(8,l.tokens.beasts*2))]:[]),damage(e,l.tokens.beasts*3+l.blight));return true;
  case 'BCM_BEAST_DAMAGE':if(l)prepend(s,damage(e,l.tokens.beasts));return true;
  case 'BCM_VOLCANO_ADJ':if(l)prepend(s,...adj(s,l).flatMap(a=>[damage(e,10,a.id),destroy(e,['DAHAN'],a.id),special(e,'BCM_KILL_BEASTS',0,a.id),...(!a.blight?[step('BLIGHT',e.actor,a.id,1)]:[])]));return true;
  case 'BCM_ULTIMATUM':if(l&&s.terror>=2)prepend(s,step('REMOVE',e.actor,l.id,2,'',null,kinds));return true;
  case 'BCM_MANIFEST':if(l)prepend(s,step('SPECIAL',e.actor,l.id,e.n,'RAVAGE',null,['POWER_RAVAGE']),step('SPECIAL',e.actor,null,0,'BCM_RESTORE_POWER'));s.flags=s.flags.filter(f=>f!==`power:${e.actor}`);return true;
  case 'BCM_RESTORE_POWER':s.flags.push(`power:${e.actor}`);return true;
  case 'BCM_FLOW':player(s,owner).rangeBonus+=2;prepend(s,{...e,key:'BCM_FLOW_MOVE'});return true;
  default:return false;
 }
}

/** Distance to the printed coast, independent of whether Ocean is a playable land. */
export function oceanDistance(s:SpiritState,area:SpiritLand):number {
 if(area.number===0)return 0;
 return Math.min(...s.lands.filter(a=>a.number>0&&a.coastal).map(a=>distance(s,area.id,a.id)+1));
}

function sourceReach(s:SpiritState,e:SpiritStep,from:SpiritLand,to:SpiritLand,range:number):boolean {
 return s.flags.includes(`source-shadow:${e.actor}`)&&countPieces(to,['DAHAN'])>0 || distance(s,from.id,to.id)<=range+player(s,e.actor).rangeBonus+(to.coastal?s.flags.filter(f=>f===`shore:${e.actor}`).length*3:0);
}
