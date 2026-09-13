import { SPIRIT_BOARDS, spiritFearTiers, type SpiritSettings, type PlayerId } from '@hangul-rummikub/shared';
import type { SpiritState } from './state.js';
import { SPIRIT_FEAR_KEYS } from './resolver.js';
import { cardPower, requireRule, makePiece, land, countPieces, presence, step, event } from './primitives.js';
export function configureSpirit(s: SpiritState, settings: SpiritSettings, shuffle: <T>(values:T[])=>T[]) {
 requireRule(settings.adversary!=='NONE'||settings.level===0);
 requireRule(settings.expansion!=='BRANCH_CLAW'||settings.blightCard&&!settings.progression);
 s.settings={...settings}; s.configured=true;
 if(settings.expansion==='BRANCH_CLAW'){s.eventDeck=shuffle(['NEW_SPECIES','LITTLE_RAIN']);const cards=s.forgotten.filter(id=>cardPower(s,id).expansion&&['MINOR','MAJOR'].includes(cardPower(s,id).deck));s.forgotten=s.forgotten.filter(id=>!cards.includes(id));s.minor=shuffle([...s.minor,...cards.filter(id=>cardPower(s,id).deck==='MINOR')]);s.major=shuffle([...s.major,...cards.filter(id=>cardPower(s,id).deck==='MAJOR')]);} const {adversary:a,level:n}=settings;
 s.fearTiers=[...spiritFearTiers(settings)];
 s.fearDeck=shuffle([...SPIRIT_FEAR_KEYS]).slice(0,settings.scenario==='RITUAL'?15:s.fearTiers.reduce((x,y)=>x+y,0));
 if(settings.blightCard) {s.blightCard=shuffle<'SPIRAL'|'MEMORY'>(['SPIRAL','MEMORY'])[0]??'SPIRAL';s.blightPool=2*s.players.length+1;s.blightTotal=s.blightPool+s.lands.reduce((n,l)=>n+l.blight,0);}
 if(settings.scenario==='BLITZ'){s.blightPool+=s.players.length;s.blightTotal+=s.players.length;}
 for(const board of SPIRIT_BOARDS.slice(0,s.players.length)) {
  if(settings.expansion==='BRANCH_CLAW') {
   const area=s.lands.find(l=>l.board===board&&l.number>0&&l.pieces.length===0&&l.blight===0);
   requireRule(area);area.tokens.beasts++;land(s,`${board}2`).tokens.disease++;
  }
  if(a==='PRUSSIA'&&n>=1) makePiece(s,land(s,`${board}3`),'TOWN');
  if(a==='ENGLAND'&&n>=2) {makePiece(s,land(s,`${board}1`),'CITY');makePiece(s,land(s,`${board}2`),'TOWN');}
  if(a==='SWEDEN'&&n>=2) {makePiece(s,land(s,`${board}4`),'CITY');const l=land(s,`${board}4`);if(l.blight){land(s,`${board}5`).blight+=l.blight;l.blight=0;}}
  if(a==='SWEDEN'&&n>=6) {makePiece(s,land(s,`${board}8`),'TOWN');land(s,`${board}8`).blight++;s.blightTotal++;}
 }
 if(a==='ENGLAND'&&n>=5) for(const l of s.lands) l.invaderHealth=1;
 if(a==='PRUSSIA'&&n>=2) {
  const one=s.invaderDeck.filter(c=>c.stage===1),two=s.invaderDeck.filter(c=>c.stage===2),three=s.invaderDeck.filter(c=>c.stage===3);
  if(n>=3) one.pop(); if(n>=5) one.pop(); if(n>=4) two.pop(); if(n>=6) two.pop();
  s.invaderDeck=[...one,three.shift()!,...two,...three];
 }
 if(a==='SWEDEN'&&n>=4) {const c=s.invaderDeck.shift()!;s.invaderDiscard.push(c);for(const p of s.players) s.queue.push(step('SPECIAL',p.playerId,null,0,'SWEDEN_SETUP',p.playerId,[p.board,...c.terrains]));}
 event(s,'SELECT','섬의 규칙 설정을 확정했습니다.');
}
export function setupScenario(s: SpiritState) {
 if(s.settings.scenario!=='HEART') return;
 for(const l of s.lands) l.pieces=l.pieces.filter(p=>p.kind!=='TOWN');
 // This digital layout uses a jointly selected inland heart on each board.
 for(const p of s.players) s.queue.push(step('SPECIAL',p.playerId,null,0,'HEART_SETUP',p.playerId));
}
export function startRitual(s: SpiritState,actor: PlayerId,id:string) {
 const l=land(s,id);requireRule(s.settings.scenario==='RITUAL'&&['FAST','SLOW'].includes(s.stage)&&s.queue.length===0&&s.players.every(p=>presence(l,p.playerId)>0)&&countPieces(l,['DAHAN'])>=3*s.players.length&&l.presence.reduce((n,p)=>n+p.count,0)>=3&&s.players.reduce((n,p)=>n+p.energy,0)>=3);
 s.queue.push(step('SPECIAL',actor,id,3,'RITUAL_PAY',s.players[0]!.playerId),step('SPECIAL',actor,id,3,'RITUAL_PRESENCE',s.players[0]!.playerId),step('SPECIAL',actor,id,0,'RITUAL_FINISH'));
}
