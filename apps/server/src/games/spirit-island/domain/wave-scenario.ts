import { parse } from 'valibot';
import { PlayerIdSchema, type PlayerId } from '@hangul-rummikub/shared';
import type { SpiritState, SpiritStep } from './state.js';
import { createSpiritGame } from './game.js';
import { configureSpirit } from './settings.js';
import { cardPower, countPieces, event, land, makePiece, player, prepend, requireRule, step } from './primitives.js';
import { currentInvaderStage } from './branch-claw-stage-events.js';
type Add=(label:string,apply:()=>void,landId?:string|null,pieceId?:string|null)=>unknown;
export const legacyActor=(id:PlayerId)=>id.startsWith('__spirit_legacy:');
export const waveController=(s:SpiritState,id:PlayerId)=>s.wavePowers.find(w=>w.actor===id)?.controller??id;
export function waveVictory(s:SpiritState){
 s.waveWon=true;s.queue=[];s.flags=s.flags.filter(f=>!f.startsWith('power:'));
 prepend(s,step('SPECIAL',s.players[0]!.playerId,null,0,'WAVE_DECIDE'));
 event(s,'WIN',`${s.waveNumber}번째 물결을 막았습니다. 다음 물결을 준비하거나 승리로 마칠 수 있습니다.`);
}
export function prepareLegacy(s:SpiritState,actor:PlayerId,id:string){
 if(currentInvaderStage(s)===3)s.waveStageThree=true;
 const power=s.wavePowers.find(w=>w.cardId===id&&w.controller===actor);
 requireRule(power&&s.settings.scenario==='SECOND_WAVE'&&s.stage==='PREPARE'&&s.waveStageThree&&!s.waveWon);
 const p=player(s,power.actor);requireRule(p.hand.includes(id));p.hand=p.hand.filter(c=>c!==id);p.played.push(id);
 event(s,'CARD',`이전 정령의 도움 · ${cardPower(s,id).title} 무료 준비`,actor);
}
function restartWave(s:SpiritState,shuffle:<T>(a:T[])=>T[]){
 const old=structuredClone(s),wave=old.waveNumber+1;let index=0;
 const next=createSpiritGame({gameId:s.gameId,playerIds:s.players.map(p=>p.playerId),now:s.startedAt,transitionId:s.transitionId,id:()=>s.cards[index++]!.cardId,shuffle});
 next.waveNumber=wave;next.wavePriorSpirits=old.players.flatMap(p=>p.spirit?[p.spirit]:[]);
 // Base pre-printed Invaders are shifted before applying adversary setup.
 for(const l of next.lands){l.blight=0;l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');}
 const shift=Math.max(0,5-wave);
 for(const l of next.lands.filter(l=>l.number>=6))if(shift){const dest=land(next,`${l.board}${l.number-shift}`);dest.pieces.push(...l.pieces.splice(0));}
 for(const p of next.players)for(let n=Math.max(1,7-wave);n<=(wave===7?6:5);n++)makePiece(next,land(next,`${p.board}${n}`),'TOWN');
 const level=old.settings.adversary==='NONE'?0:Math.min(6,old.settings.level+(old.blighted?0:1));
 configureSpirit(next,{...old.settings,level:level===0?0:level===1?1:level===2?2:level===3?3:level===4?4:level===5?5:6},shuffle);
 const extraBlight=next.lands.reduce((n,l)=>n+l.blight,0);
 for(const l of next.lands){
  const prior=old.lands.find(a=>a.id===l.id);
  l.blight=prior?.blight??0;l.tokens=prior?{...prior.tokens}:{beasts:0,wilds:0,disease:0};
  for(let n=0;n<(prior?countPieces(prior,['DAHAN']):0);n++)makePiece(next,l,'DAHAN');
 }
 next.blightCard=old.blightCard;next.blightDeck=[...old.blightDeck];next.blightTotal=old.blightTotal;
 const supply=old.blightPool+old.franceBlight+(old.waveReserve??0);
 next.blightPool=old.blighted?Math.min(supply,2*next.players.length+1):supply;
 next.waveReserve=old.blighted?supply-next.blightPool:old.waveReserve;
 next.franceBlight=0;next.blightPool-=extraBlight;
 // Setup Blight has no extra source; place the same amount on Sweden's prescribed lands.
 if(extraBlight)for(const p of next.players)land(next,`${p.board}8`).blight++;
 next.wavePowers=old.wavePowers.filter(w=>!old.legacyPlayers.some(p=>p.playerId===w.actor));
 next.legacyPlayers=next.wavePowers.map(w=>{
  const template=structuredClone(next.players[0]!);template.playerId=w.actor;template.spirit=w.spirit;template.hand=[w.cardId];template.grown=true;return template;
 });
 const inherited=new Set(next.wavePowers.map(w=>w.cardId));
 next.minor=next.minor.filter(id=>!inherited.has(id));next.major=next.major.filter(id=>!inherited.has(id));next.forgotten=next.forgotten.filter(id=>!inherited.has(id));
 for(const p of next.progressions)p.cards=p.cards.filter(id=>!inherited.has(id));
 next.revision=old.revision;next.log=old.log;next.effectCounter=old.effectCounter;
 Object.assign(s,next);event(s,'PHASE',`${wave}번째 물결 · 새로운 정령을 선택하세요.`);
}
export function waveOptions(s:SpiritState,e:SpiritStep,add:Add,shuffle:<T>(a:T[])=>T[]):boolean{
 if(!e.key.startsWith('WAVE_'))return false;
 if(e.key==='WAVE_DECIDE'){
  add('승리로 게임 마치기',()=>{s.waveWon=false;s.phase='FINISHED';s.result={reason:'VICTORY',winnerPlayerIds:s.players.map(p=>p.playerId),round:s.round};s.queue=[];});
  add(`${s.waveNumber+1}번째 물결 준비${s.destroyedBoards.length?' · 가라앉은 보드는 빈 섬으로 복원':''}`,()=>{
   s.wavePowers=s.wavePowers.filter(w=>s.legacyPlayers.some(p=>p.playerId===w.actor));
   prepend(s,...s.players.map(p=>step('SPECIAL',p.playerId,null,0,'WAVE_CARD',p.playerId)),...(['beasts','wilds','disease','blight'] as const).map(key=>step('SPECIAL',e.actor,null,0,'WAVE_TRIM',null,[key])),step('SPECIAL',e.actor,null,0,'WAVE_DAHAN'),step('SPECIAL',e.actor,null,0,'WAVE_POPULATION'),step('SPECIAL',e.actor,null,0,'WAVE_RESTART'));
  });return true;
 }
 if(e.key==='WAVE_CARD'){
  const p=player(s,e.actor);if(![...p.hand,...p.played,...p.discard].length)add('남길 능력 없음 · 계속',()=>undefined);for(const id of [...p.hand,...p.played,...p.discard])add(`${cardPower(s,id).title} · 다음 물결에 남기기`,()=>{
   requireRule(p.spirit);s.wavePowers.push({cardId:id,spirit:p.spirit,controller:p.playerId,actor:parse(PlayerIdSchema,`__spirit_legacy:${s.waveNumber+1}:${s.players.indexOf(p)}`)});
  });return true;
 }
 if(e.key==='WAVE_TRIM'){
  const kind=e.tags[0],blight=kind==='blight',read=(l:SpiritState['lands'][number])=>blight?l.blight:kind==='beasts'?l.tokens.beasts:kind==='wilds'?l.tokens.wilds:l.tokens.disease;
  if(s.lands.reduce((n,l)=>n+read(l),0)<=(blight?s.waveNumber+1:1)*s.players.length)return true;
  for(const l of s.lands.filter(l=>read(l)>0))add(`${l.id} · ${blight?'오염':kind==='beasts'?'야수':kind==='wilds'?'야생':'질병'} 1개 돌려놓기`,()=>{
   if(blight){l.blight--;s.blightPool++;}else if(kind==='beasts')l.tokens.beasts--;else if(kind==='wilds')l.tokens.wilds--;else l.tokens.disease--;
   prepend(s,e);
  },l.id);return true;
 }
 if(e.key==='WAVE_DAHAN'){
  const source=s.lands.find(l=>countPieces(l,['DAHAN'])>2);if(!source)return true;
  for(const id of source.adjacent.filter(id=>land(s,id).number>0))add(`${source.id} → ${id} · 다한 1개 밀기`,()=>{
   const piece=source.pieces.find(p=>p.kind==='DAHAN')!;source.pieces=source.pieces.filter(p=>p.id!==piece.id);land(s,id).pieces.push(piece);prepend(s,e);
  },id);return true;
 }
 if(e.key==='WAVE_POPULATION'){
  const crowded=s.players.find(p=>s.lands.filter(l=>l.board===p.board).reduce((n,l)=>n+countPieces(l,['DAHAN']),0)>8);
  if(crowded){for(const l of s.lands.filter(l=>l.board===crowded.board&&countPieces(l,['DAHAN'])))add(`${l.id} · 다한 1개 제거 · 보드당 8개까지`,()=>{const i=l.pieces.findIndex(p=>p.kind==='DAHAN');l.pieces.splice(i,1);prepend(s,e);},l.id);}
  else add('다한의 세대교체 마치기',()=>{
   for(const p of s.players){const area=s.lands.filter(l=>l.board===p.board&&countPieces(l,['DAHAN'])).sort((a,b)=>a.number-b.number),total=area.reduce((n,l)=>n+countPieces(l,['DAHAN']),0);if(total>=2&&total<=4)makePiece(s,area[0]!,'DAHAN');}
  });return true;
 }
 if(e.key==='WAVE_RESTART'){add('다음 물결의 섬과 덱 준비',()=>restartWave(s,shuffle));return true;}
 return true;
}
