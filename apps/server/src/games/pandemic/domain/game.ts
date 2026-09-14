import * as v from 'valibot';
import { GameRevisionSchema, PandemicActionSchema, PANDEMIC_CITIES, PANDEMIC_CITY_INFO, PANDEMIC_COLORS, PANDEMIC_EVENTS, PANDEMIC_EVENT_INFO, PANDEMIC_ROLES, PANDEMIC_ROLE_INFO, PANDEMIC_RATE, pandemicNeighbors, type PandemicAction, type PandemicCard, type PandemicCity, type PandemicColor, type PandemicLog, type GameId, type PlayerId, type ServerTime, type TileId, type TurnId } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { boardCity, emptyPandemicBoard, parsePandemicState, type PandemicState } from './state.js';
export { parsePandemicState, type PandemicState } from './state.js';
type Player=PandemicState['players'][number];
class InvalidAction extends Error {}
function requireRule(condition:unknown):asserts condition {if(!condition)throw new InvalidAction('Invalid action.');}
function shuffle<T>(items:readonly T[],random:RandomSource):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=random.nextInt(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Invalid random source.');[a[i],a[j]]=[a[j]!,a[i]!];}return a;}
function log(s:PandemicState,text:string,sound:PandemicLog['sound'],city:PandemicCity|null=null){s.sequence++;s.history.push({id:s.sequence,text,sound,city});s.history=s.history.slice(-80);}
function findPlayer(s:PandemicState,id:PlayerId):Player {const p=s.players.find(p=>p.playerId===id);requireRule(p);return p;}
function active(s:PandemicState){return s.players[s.activeIndex]!;}
function handCard(p:Player,id:TileId){const card=p.hand.find(c=>c.cardId===id);requireRule(card);return card;}
function discard(s:PandemicState,p:Player,id:TileId){const c=handCard(p,id);p.hand=p.hand.filter(c=>c.cardId!==id);s.discard.push(c);return c;}
function finish(s:PandemicState,reason:NonNullable<PandemicState['result']>['reason'],now:ServerTime){s.phase='FINISHED';s.finishedAt=now;s.pending=null;s.continueReady=[];s.result={reason,winnerPlayerIds:reason==='CURED'?s.players.map(p=>p.playerId):[]};log(s,reason==='CURED'?'네 가지 치료제를 모두 발견했습니다. 팀 승리!':reason==='CANCELLED'?'참가자가 방을 나가 게임이 취소되었습니다.':reason==='DECK'?'플레이어 카드가 부족합니다. 팀 패배.':reason==='CUBES'?'질병 큐브가 부족합니다. 팀 패배.':'발병 8회. 팀 패배.',reason==='CURED'?'WIN':reason==='CANCELLED'?'NONE':'LOSE');}
function eradicate(s:PandemicState){for(const c of PANDEMIC_COLORS)if(s.cures[c]==='CURED'&&s.supply[c]===24)s.cures[c]='ERADICATED';}
function medic(s:PandemicState){for(const p of s.players)if(p.role==='MEDIC')for(const c of PANDEMIC_COLORS)if(s.cures[c]!=='ACTIVE'){const b=boardCity(s,p.city);s.supply[c]+=b.cubes[c];b.cubes[c]=0;}eradicate(s);}
function protectedCity(s:PandemicState,city:PandemicCity,color:PandemicColor){return s.cures[color]==='ERADICATED'||s.players.some(p=>p.role==='QUARANTINE'&&(p.city===city||pandemicNeighbors(p.city).includes(city))||p.role==='MEDIC'&&p.city===city&&s.cures[color]!=='ACTIVE');}
/** A single infection resolution owns its outbreak set. Never shared across different cards. */
export function infectPandemic(s:PandemicState,city:PandemicCity,color:PandemicColor,amount:number,now:ServerTime,epidemic=false):void {
 const outbreaks=new Set<PandemicCity>();
 const queue:Array<{city:PandemicCity;amount:number;epidemic:boolean}>=[{city,amount,epidemic}];
 while(queue.length&&s.phase!=='FINISHED'){
  const item=queue.shift()!;if(outbreaks.has(item.city)||protectedCity(s,item.city,color))continue;
  const b=boardCity(s,item.city),overflow=item.epidemic?b.cubes[color]>0:b.cubes[color]+item.amount>3;
  const place=Math.min(item.amount,3-b.cubes[color]);
  if(s.supply[color]<place){finish(s,'CUBES',now);return;}
  b.cubes[color]+=place;s.supply[color]-=place;
  if(overflow){outbreaks.add(item.city);s.outbreaks++;log(s,`${PANDEMIC_CITY_INFO[item.city].name} 발병 — 인접 도시로 확산`,'OUTBREAK',item.city);if(s.outbreaks>=8){finish(s,'OUTBREAKS',now);return;}for(const next of pandemicNeighbors(item.city))queue.push({city:next,amount:1,epidemic:false});}
 }
}
export function makePandemicCards(id:()=>TileId):PandemicCard[]{return [...PANDEMIC_CITIES.map(city=>({kind:'CITY' as const,cardId:id(),city})),...PANDEMIC_EVENTS.map(event=>({kind:'EVENT' as const,cardId:id(),event})),...Array.from({length:6},()=>({kind:'EPIDEMIC' as const,cardId:id()}))];}
export function createPandemicGame(input:{cards:PandemicCard[];gameId:GameId;playerIds:readonly PlayerId[];now:ServerTime;turnId:TurnId;random:RandomSource}):PandemicState {
 const roles=shuffle(PANDEMIC_ROLES,input.random);
 return parsePandemicState({rulesVersion:'pandemic-base-v1',gameId:input.gameId,revision:0,transitionId:input.turnId,startedAt:input.now,finishedAt:null,phase:'SETUP',settings:{epidemics:4,openHands:true},players:input.playerIds.map((playerId,i)=>({playerId,role:roles[i],city:'ATLANTA',hand:[],stored:null})),activeIndex:0,actionsLeft:4,round:1,board:emptyPandemicBoard(),stations:['ATLANTA'],supply:{BLUE:24,YELLOW:24,BLACK:24,RED:24},cures:{BLUE:'ACTIVE',YELLOW:'ACTIVE',BLACK:'ACTIVE',RED:'ACTIVE'},outbreaks:0,rateIndex:0,playerDeck:input.cards,discard:[],removed:[],infectionDeck:[...PANDEMIC_CITIES],infectionDiscard:[],infectionRemoved:[],lastInfected:null,infectionRemaining:0,epidemicsRemaining:0,quietNight:false,operationsUsed:false,pending:null,continueReady:[],history:[],sequence:0,result:null,pings:[]});
}
function begin(s:PandemicState,random:RandomSource){
 let deck=shuffle(s.playerDeck.filter(c=>c.kind!=='EPIDEMIC'),random);const epi=s.playerDeck.filter(c=>c.kind==='EPIDEMIC');
 const count=s.players.length===2?4:s.players.length===3?3:2;
 for(const p of s.players)p.hand=deck.splice(0,count);
 let max=-1;for(let i=0;i<s.players.length;i++)for(const c of s.players[i]!.hand)if(c.kind==='CITY'&&PANDEMIC_CITY_INFO[c.city].population>max){max=PANDEMIC_CITY_INFO[c.city].population;s.activeIndex=i;}
 s.playerDeck=[];const size=Math.floor(deck.length/s.settings.epidemics),extra=deck.length%s.settings.epidemics;
 for(let i=0;i<s.settings.epidemics;i++)s.playerDeck.push(...shuffle([...deck.splice(0,size+(i<extra?1:0)),epi[i]!],random));
 s.removed=epi.slice(s.settings.epidemics);s.infectionDeck=shuffle(PANDEMIC_CITIES,random);
 for(let i=0;i<9;i++){const city=s.infectionDeck.shift()!,color=PANDEMIC_CITY_INFO[city].color,n=3-Math.floor(i/3);boardCity(s,city).cubes[color]=n;s.supply[color]-=n;s.infectionDiscard.push(city);}
 s.phase='ACTIONS';log(s,'초기 감염 완료. 함께 네 가지 치료제를 발견하세요.','TURN');
}
function spendAction(s:PandemicState){requireRule(s.actionsLeft>0);s.actionsLeft--;if(s.actionsLeft===0)s.phase='DRAW';}
function noOverflow(s:PandemicState){return s.players.every(p=>p.hand.length<=7);}
function build(s:PandemicState,city:PandemicCity,replace:PandemicCity|null){requireRule(!s.stations.includes(city));if(s.stations.length===6){requireRule(replace!==null&&s.stations.includes(replace));s.stations=s.stations.filter(c=>c!==replace);}else requireRule(replace===null);s.stations.push(city);log(s,`${PANDEMIC_CITY_INFO[city].name} 연구소 건설`,'BUILD',city);}
function requestConsent(s:PandemicState,proposer:PlayerId,responder:PlayerId,action:v.InferOutput<typeof import('@hangul-rummikub/shared').PandemicConsentActionSchema>,consented:boolean){if(proposer===responder||consented)return false;s.pending={kind:'CONSENT',proposer,responder,action};return true;}
function move(s:PandemicState,p:Player,a:Extract<PandemicAction,{type:'MOVE'}>,consented:boolean){
 const target=findPlayer(s,a.playerId);requireRule(target.city!==a.destination);requireRule(target===p||p.role==='DISPATCHER');
 const from=target.city;let cost:TileId|null=null;
 if(a.mode==='DRIVE')requireRule(pandemicNeighbors(from).includes(a.destination)&&a.cardId===null);
 else if(a.mode==='SHUTTLE')requireRule(s.stations.includes(from)&&s.stations.includes(a.destination)&&a.cardId===null);
 else if(a.mode==='DISPATCH')requireRule(p.role==='DISPATCHER'&&s.players.some(q=>q!==target&&q.city===a.destination)&&a.cardId===null);
 else {requireRule(a.cardId!==null);const c=handCard(p,a.cardId);requireRule(c.kind==='CITY');if(a.mode==='DIRECT')requireRule(c.city===a.destination);else if(a.mode==='CHARTER')requireRule(c.city===from);else requireRule(p.role==='OPERATIONS'&&p===target&&!s.operationsUsed&&s.stations.includes(from));cost=c.cardId;}
 if(requestConsent(s,p.playerId,target.playerId,a,consented))return;
 if(cost)discard(s,p,cost);if(a.mode==='OPERATIONS')s.operationsUsed=true;target.city=a.destination;medic(s);spendAction(s);log(s,`${PANDEMIC_ROLE_INFO[target.role].name}: ${PANDEMIC_CITY_INFO[from].name} → ${PANDEMIC_CITY_INFO[a.destination].name}`,'MOVE',a.destination);
}
function share(s:PandemicState,p:Player,a:Extract<PandemicAction,{type:'SHARE'}>,consented:boolean){
 const from=findPlayer(s,a.from),to=findPlayer(s,a.to);requireRule(from!==to&&(p===from||p===to)&&from.city===to.city);const c=handCard(from,a.cardId);requireRule(c.kind==='CITY'&&(from.role==='RESEARCHER'||c.city===from.city));
 if(requestConsent(s,p.playerId,(p===from?to:from).playerId,a,consented))return;
 from.hand=from.hand.filter(c=>c.cardId!==a.cardId);to.hand.push(c);spendAction(s);log(s,`${PANDEMIC_CITY_INFO[c.city].name} 카드 공유`,'CARD',from.city);
}
function playEvent(s:PandemicState,p:Player,a:Extract<PandemicAction,{type:'EVENT'}>,consented:boolean){
 const stored=p.stored?.cardId===a.cardId,c=stored?p.stored:handCard(p,a.cardId);requireRule(c?.kind==='EVENT');
 if(c.event==='AIRLIFT') {requireRule(a.target!==null&&a.city!==null&&a.replace===null);const target=findPlayer(s,a.target);requireRule(target.city!==a.city);if(requestConsent(s,p.playerId,target.playerId,a,consented))return;target.city=a.city;medic(s);}
 else if(c.event==='GRANT'){requireRule(a.target===null&&a.city!==null);build(s,a.city,a.replace);}
 else if(c.event==='RESILIENT'){requireRule(a.target===null&&a.replace===null&&a.city!==null&&s.infectionDiscard.includes(a.city));s.infectionDiscard=s.infectionDiscard.filter(x=>x!==a.city);s.infectionRemoved.push(a.city);}
 else {requireRule(a.target===null&&a.city===null&&a.replace===null);if(c.event==='QUIET_NIGHT'){requireRule(!s.quietNight);s.quietNight=true;}else{requireRule(s.infectionDeck.length>0);s.pending={kind:'FORECAST',playerId:p.playerId};}}
 if(stored){s.removed.push(c);p.stored=null;}else discard(s,p,c.cardId);
 log(s,`${PANDEMIC_EVENT_INFO[c.event].name} 사용`,'EVENT',a.city);
}
function epidemic(s:PandemicState,now:ServerTime){s.rateIndex=Math.min(6,s.rateIndex+1);const city=s.infectionDeck.pop();if(!city)throw new Error('Infection deck empty during epidemic.');s.infectionDiscard.push(city);s.lastInfected=city;log(s,`전염병: ${PANDEMIC_CITY_INFO[city].name} 감염`,'EPIDEMIC',city);infectPandemic(s,city,PANDEMIC_CITY_INFO[city].color,3,now,true);if(s.phase!=='FINISHED')s.phase='INTENSIFY';}
function infection(s:PandemicState,now:ServerTime){const city=s.infectionDeck.shift();if(!city)throw new Error('Infection deck exhausted.');s.infectionDiscard.push(city);s.lastInfected=city;s.infectionRemaining--;log(s,`${PANDEMIC_CITY_INFO[city].name} 감염`,'INFECT',city);infectPandemic(s,city,PANDEMIC_CITY_INFO[city].color,1,now);if(s.phase!=='FINISHED')s.phase=s.infectionRemaining===0?'TURN_END':'INFECTION';}
function continuePhase(s:PandemicState,now:ServerTime,random:RandomSource){
 switch(s.phase){
  case 'DRAW':{
   if(s.playerDeck.length<2){finish(s,'DECK',now);return;}
   const cards=s.playerDeck.splice(0,2);for(const c of cards)if(c.kind==='EPIDEMIC'){s.removed.push(c);s.epidemicsRemaining++;}else active(s).hand.push(c);
   log(s,'플레이어 카드 2장 공개','CARD');if(s.epidemicsRemaining>0)epidemic(s,now);else s.phase='INFECTION_READY';return;
  }
  case 'EPIDEMIC_NEXT':epidemic(s,now);return;
  case 'INTENSIFY':s.infectionDeck=[...shuffle(s.infectionDiscard,random),...s.infectionDeck];s.infectionDiscard=[];s.epidemicsRemaining--;s.phase=s.epidemicsRemaining>0?'EPIDEMIC_NEXT':'INFECTION_READY';log(s,'강화: 감염 버림패를 섞어 덱 위에 놓았습니다.','EPIDEMIC');return;
  case 'INFECTION_READY':if(s.quietNight){s.quietNight=false;s.phase='TURN_END';log(s,'하룻밤의 평온: 도시 감염을 건너뜁니다.','EVENT');return;}s.infectionRemaining=PANDEMIC_RATE[s.rateIndex]!;infection(s,now);return;
  case 'INFECTION':infection(s,now);return;
  case 'TURN_END':s.activeIndex=(s.activeIndex+1)%s.players.length;if(s.activeIndex===0)s.round++;s.actionsLeft=4;s.operationsUsed=false;s.phase='ACTIONS';log(s,`${PANDEMIC_ROLE_INFO[active(s).role].name}의 차례`,'TURN',active(s).city);return;
  default:throw new InvalidAction();
 }
}
function act(s:PandemicState,p:Player,a:PandemicAction,now:ServerTime,random:RandomSource,host:PlayerId|null,consented=false){
 if(s.phase==='SETUP'){
  if(a.type==='ROLE'){requireRule(!s.players.some(q=>q!==p&&q.role===a.role));p.role=a.role;return;}
  requireRule(p.playerId===host);
  if(a.type==='CONFIGURE'){s.settings={epidemics:a.epidemics,openHands:a.openHands};return;}
  requireRule(a.type==='BEGIN');begin(s,random);return;
 }
 requireRule(s.phase!=='FINISHED');
 if(a.type==='PING'){s.pings=s.pings.filter(x=>x.playerId!==p.playerId);s.pings.push({playerId:p.playerId,city:a.city,message:a.message});log(s,`${PANDEMIC_ROLE_INFO[p.role].name}: ${a.message==='TREAT'?'치료 요청':a.message==='MEET'?'여기서 만나요':'도움 요청'}`,'PING',a.city);return;}
 if(s.pending){
  if(s.pending.kind==='FORECAST'){requireRule(a.type==='FORECAST_ORDER'&&s.pending.playerId===p.playerId);const top=s.infectionDeck.slice(0,6);requireRule(a.cities.length===top.length&&new Set(a.cities).size===top.length&&a.cities.every(c=>top.includes(c)));s.infectionDeck.splice(0,top.length,...a.cities);s.pending=null;log(s,'예측: 감염 카드 순서 확정','EVENT');return;}
  if(s.pending.kind==='SHARE_PICK'){requireRule(a.type==='OFFER_CARD'&&s.pending.responder===p.playerId);const pending=s.pending;s.pending=null;if(a.cardId!==null)act(s,findPlayer(s,pending.proposer),{type:'SHARE',from:p.playerId,to:pending.proposer,cardId:a.cardId},now,random,host,true);else log(s,'카드 공유 요청을 거절했습니다.','NONE');return;}
  requireRule(a.type==='CONSENT'&&s.pending.responder===p.playerId);const pending=s.pending;s.pending=null;
  if(a.accept)act(s,findPlayer(s,pending.proposer),pending.action,now,random,host,true);else log(s,'동료가 제안을 거절했습니다.','NONE');return;
 }
 if(a.type==='EVENT'){playEvent(s,p,a,consented);return;}
 if(a.type==='DISCARD'){requireRule(p.hand.length>7&&s.epidemicsRemaining===0);discard(s,p,a.cardId);log(s,`${PANDEMIC_ROLE_INFO[p.role].name}: 손패 정리`,'CARD');return;}
 if(a.type==='CONTINUE'){
  requireRule(s.phase!=='ACTIONS');requireRule(s.epidemicsRemaining>0||noOverflow(s));
  // A boundary advances only after everyone explicitly releases their event opportunity.
  requireRule(!s.continueReady.includes(p.playerId));s.continueReady.push(p.playerId);
  if(s.continueReady.length===s.players.length){s.continueReady=[];continuePhase(s,now,random);}return;
 }
 requireRule(s.phase==='ACTIONS'&&active(s)===p&&s.actionsLeft>0&&noOverflow(s));
 switch(a.type){
  case 'MOVE':move(s,p,a,consented);return;
  case 'SHARE':share(s,p,a,consented);return;
  case 'REQUEST_SHARE':{const from=findPlayer(s,a.from);requireRule(from!==p&&from.city===p.city);s.pending={kind:'SHARE_PICK',proposer:p.playerId,responder:from.playerId};return;}
  case 'TREAT':{const b=boardCity(s,p.city),n=b.cubes[a.color];requireRule(n>0);const count=p.role==='MEDIC'||s.cures[a.color]!=='ACTIVE'?n:1;b.cubes[a.color]-=count;s.supply[a.color]+=count;eradicate(s);spendAction(s);log(s,`${PANDEMIC_CITY_INFO[p.city].name}: 질병 ${count}개 치료`,'TREAT',p.city);return;}
  case 'BUILD':{let cost:TileId|null=null;if(p.role!=='OPERATIONS'){const c=p.hand.find(c=>c.kind==='CITY'&&c.city===p.city);requireRule(c);cost=c.cardId;}build(s,p.city,a.replace);if(cost)discard(s,p,cost);spendAction(s);return;}
  case 'CURE':{requireRule(s.cures[a.color]==='ACTIVE'&&s.stations.includes(p.city));const count=p.role==='SCIENTIST'?4:5;requireRule(a.cards.length===count&&new Set(a.cards).size===count);for(const id of a.cards){const c=handCard(p,id);requireRule(c.kind==='CITY'&&PANDEMIC_CITY_INFO[c.city].color===a.color);}for(const id of a.cards)discard(s,p,id);s.cures[a.color]='CURED';medic(s);spendAction(s);log(s,`${a.color} 치료제 발견!`,'CURE',p.city);if(PANDEMIC_COLORS.every(c=>s.cures[c]!=='ACTIVE'))finish(s,'CURED',now);return;}
  case 'STORE':{requireRule(p.role==='PLANNER'&&p.stored===null);const c=s.discard.find(c=>c.cardId===a.cardId);requireRule(c?.kind==='EVENT');s.discard=s.discard.filter(c=>c.cardId!==a.cardId);p.stored=c;spendAction(s);log(s,'위기관리자가 이벤트를 보관합니다.','CARD');return;}
  case 'END_ACTIONS':s.actionsLeft=0;s.phase='DRAW';return;
  default:throw new InvalidAction();
 }
}
export function applyPandemicAction(original:PandemicState,actor:PlayerId,input:PandemicAction,now:ServerTime,turn:TurnId,random:RandomSource,host:PlayerId|null):{ok:true;state:PandemicState}|{ok:false;reason:'INVALID_ACTION'}{
 const parsed=v.safeParse(PandemicActionSchema,input);if(!parsed.success)return {ok:false,reason:'INVALID_ACTION'};
 try{const s=parsePandemicState(original),p=findPlayer(s,actor);act(s,p,parsed.output,now,random,host);if(parsed.output.type!=='CONTINUE'&&parsed.output.type!=='PING')s.continueReady=[];s.revision=v.parse(GameRevisionSchema,s.revision+1);s.transitionId=turn;return {ok:true,state:parsePandemicState(s)};}catch(error){if(error instanceof InvalidAction)return {ok:false,reason:'INVALID_ACTION'};throw error;}
}
export function cancelPandemic(original:PandemicState,now:ServerTime):PandemicState{const s=parsePandemicState(original);finish(s,'CANCELLED',now);s.revision=v.parse(GameRevisionSchema,s.revision+1);return parsePandemicState(s);}
