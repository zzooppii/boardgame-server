import {completeArkEffect,createArkEffectQueue,ArkEffectQueueSchema} from './effect-queue.js';
import {finishArkAction} from './action-row.js';
import {resumeArkParticipantEffects} from './game.js';
import {arkZooIcons} from './zoo-icons.js';
import * as v from 'valibot';
import { ARK_CONTINENTS, ArkSoloCommandSchema, GameRevisionSchema, PlayerIdSchema, ArkCountSchema, ArkActionKindSchema, type PlayerId, type ServerTime, type TurnId, type ArkSoloView } from '@hangul-rummikub/shared';
import { ArkParticipantStateSchema, applyArkSoloCommand, createArkSoloGame, parseArkSoloState, projectArkSoloGame, finishArkParticipantBreak, finalizeArkParticipant, type ArkSoloState } from './game.js';
import { assertArkExtendedCardInventory } from './card-inventory.js';
import { replenishArkDisplay } from './card-zones.js';
import { ARK_UNIVERSITIES } from './solo-break.js';
import { arkVictoryPoints } from './scoring.js';

/** Shared card zones and supplies have exactly one owner in storage. Hydration is temporary. */
const sharedKeys=['zooDeck','display','discarded','goalDeck','discardedGoals','baseProjectReserve','baseProjects','playedProjects','conservationBonuses','donations','partnerSupply','universitySupply'] as const;
const metadataKeys=['gameId','revision','transitionId','startedAt','finishedAt','phase'] as const;
const SharedSchema=v.pick(ArkParticipantStateSchema,sharedKeys);
const PlayerSchema=v.omit(ArkParticipantStateSchema,[...sharedKeys,...metadataKeys]);
const MetadataSchema=v.pick(ArkParticipantStateSchema,metadataKeys);
const SlotSchema=v.strictObject({cardId:ArkParticipantStateSchema.entries.hand.item.entries.cardId,slot:v.picklist([0,1,2]),playerId:v.nullable(PlayerIdSchema)});
const State=v.strictObject({
  ...MetadataSchema.entries,mode:v.literal('MULTIPLAYER'),playerId:PlayerIdSchema,
  venomRollback:v.optional(v.nullable(v.pipe(v.string(),v.maxLength(2000000))),null),notice:v.optional(v.nullable(v.string()),null),
  shared:SharedSchema,players:v.pipe(v.array(PlayerSchema),v.minLength(2),v.maxLength(4)),
  stage:v.picklist(['SETUP','ACTION','BREAK','GOAL_DISCARD','INTERACTION','FINAL_SCORING','FINISHED']),
  readyPlayerIds:v.array(PlayerIdSchema),breakPosition:ArkCountSchema,breakNumber:ArkCountSchema,
  breakQueue:v.array(PlayerIdSchema),resumePlayerId:PlayerIdSchema,
  finalTurns:v.nullable(v.array(PlayerIdSchema)),winners:v.array(PlayerIdSchema),
  interaction:v.nullable(v.strictObject({ownerId:PlayerIdSchema,targetId:PlayerIdSchema,effectId:ArkCountSchema})),
  borrowed:v.array(v.strictObject({ownerId:PlayerIdSchema,targetId:PlayerIdSchema,rowRestored:v.boolean(),strength:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(3)),action:ArkActionKindSchema,actions:ArkParticipantStateSchema.entries.actions,effects:ArkEffectQueueSchema,zooWork:ArkParticipantStateSchema.entries.zooWork,legacyAfterFinishing:ArkParticipantStateSchema.entries.legacyAfterFinishing,extraActions:ArkParticipantStateSchema.entries.extraActions,repeatedAction:ArkParticipantStateSchema.entries.repeatedAction,progress:ArkParticipantStateSchema.entries.progress})),
  occupiedProjects:v.array(SlotSchema),goalDiscardTriggered:v.boolean(),goalQueue:v.array(PlayerIdSchema),resumeStage:v.picklist(['SETUP','ACTION','BREAK','FINAL_SCORING']),goalResumePlayerId:PlayerIdSchema,
});
export type ArkMultiplayerState=v.InferOutput<typeof State>;
export const arkMultiplayerBreakLimit=(count:number):9|12|15=>count===2?9:count===3?12:15;
// Valibot strict objects reject unrelated fields; select declared keys explicitly at internal boundaries.
function pick<T extends keyof ArkSoloState>(s:ArkSoloState,keys:readonly T[]):Pick<ArkSoloState,T>{return Object.fromEntries(keys.map(k=>[k,s[k]])) as Pick<ArkSoloState,T>;}
function local(s:ArkSoloState){const omitted=new Set<string>([...sharedKeys,...metadataKeys]);return v.parse(PlayerSchema,Object.fromEntries(Object.entries(s).filter(([k])=>!omitted.has(k))));}
function publicPool(s:ArkSoloState){return v.parse(SharedSchema,pick(s,sharedKeys));}
export function hydrateArkPlayer(s:ArkMultiplayerState,id:PlayerId):ArkSoloState {
  const player=s.players.find(p=>p.playerId===id);if(!player?.multiplayer)throw new Error('Unknown Ark participant.');
  return {...structuredClone(player),...structuredClone(s.shared),gameId:s.gameId,revision:s.revision,transitionId:s.transitionId,startedAt:s.startedAt,finishedAt:s.phase==='FINISHED'?s.finishedAt:null,phase:s.phase,
    multiplayer:{...structuredClone(player.multiplayer),otherPartners:s.players.filter(p=>p.playerId!==id).flatMap(p=>p.partners),otherUniversities:s.players.filter(p=>p.playerId!==id).flatMap(p=>p.universities),occupiedProjects:s.occupiedProjects.filter(p=>p.playerId!==id).map(({cardId,slot})=>({cardId,slot})),otherZoo:s.players.filter(p=>p.playerId!==id).flatMap(p=>structuredClone(p.played)),rightZoo:structuredClone(s.players[(s.players.indexOf(player)+s.players.length-1)%s.players.length]!.played)}};
}
function save(s:ArkMultiplayerState,p:ArkSoloState):void {s.players[s.players.findIndex(x=>x.playerId===p.playerId)]=local(p);s.shared=publicPool(p);}
export function parseArkMultiplayerState(input:unknown):ArkMultiplayerState {
  const s=v.parse(State,input),ids=s.players.map(p=>p.playerId);
  if(new Set(ids).size!==ids.length||!ids.includes(s.playerId)||!ids.includes(s.resumePlayerId)||s.breakPosition>arkMultiplayerBreakLimit(ids.length)||
    [s.readyPlayerIds,s.breakQueue,s.goalQueue,s.winners,s.finalTurns??[]].some(xs=>new Set(xs).size!==xs.length||xs.some(id=>!ids.includes(id))))throw new Error('Invalid Ark multiplayer seats.');
  if(!ids.includes(s.goalResumePlayerId)||(s.stage==='INTERACTION')!==(s.interaction!==null)||s.interaction&&(!ids.includes(s.interaction.ownerId)||s.interaction.targetId!==s.playerId||s.interaction.ownerId===s.interaction.targetId)||s.borrowed.some(f=>!ids.includes(f.ownerId)||!ids.includes(f.targetId)||f.ownerId===f.targetId)||s.stage==='GOAL_DISCARD'&&s.goalQueue[0]!==s.playerId)throw new Error('Invalid Ark multiplayer continuation.');
  if(s.venomRollback){
    const raw:unknown=JSON.parse(s.venomRollback);
    if(!raw||typeof raw!=='object'||!('venomRollback' in raw)||raw.venomRollback!==null)throw new Error('Invalid poisoned turn checkpoint.');
    const checkpoint=parseArkMultiplayerState(raw);
    if(checkpoint.gameId!==s.gameId||checkpoint.revision>s.revision||checkpoint.stage!=='ACTION'||checkpoint.players.map(p=>p.playerId).join('|')!==ids.join('|'))throw new Error('Poisoned turn checkpoint mismatch.');
  }
  const players=ids.map(id=>parseArkSoloState(hydrateArkPlayer(s,id)));
  if(players.some((p,i)=>!p.multiplayer||p.multiplayer.playerCount!==ids.length||p.multiplayer.startingAppeal!==i||p.progress.mode!=='MULTIPLAYER'))throw new Error('Invalid Ark multiplayer context.');
  const first=players[0]!;
  assertArkExtendedCardInventory({...first,hand:players.flatMap(p=>[...p.hand,...(p.cardReveal?.candidates??[])]),played:players.flatMap(p=>p.played),pouched:Object.assign({},...players.map(p=>p.pouched)),cardReveal:null,
    goals:players.flatMap(p=>[...p.goals,...(p.goalReveal?.candidates??[])]),goalReveal:null});
  if(new Set(s.occupiedProjects.map(p=>`${p.cardId}:${p.slot}`)).size!==s.occupiedProjects.length||s.occupiedProjects.some(p=>!s.shared.baseProjects.concat(s.shared.playedProjects).some(c=>c.cardId===p.cardId)||p.playerId!==null&&!ids.includes(p.playerId)))throw new Error('Invalid occupied Ark project slots.');
  if(s.occupiedProjects.some(o=>o.playerId!==null&&!players.find(p=>p.playerId===o.playerId)!.projectSupports.some(p=>p.cardId===o.cardId&&p.slot===o.slot)))throw new Error('Orphaned Ark project token.');
  for(const p of players)if(p.projectSupports.some(r=>!s.occupiedProjects.some(o=>o.playerId===p.playerId&&o.cardId===r.cardId&&o.slot===r.slot)))throw new Error('Missing Ark project token.');
  if((s.phase==='FINISHED')!==(s.stage==='FINISHED')||(s.phase==='FINISHED')!==(s.finishedAt!==null)||s.stage==='FINISHED'&&players.some(p=>!p.result))throw new Error('Invalid Ark multiplayer result.');
  return s;
}
export function createArkMultiplayerGame(input:Omit<Parameters<typeof createArkSoloGame>[0],'playerId'|'difficulty'>&{playerIds:readonly PlayerId[]}):ArkMultiplayerState {
  if(input.playerIds.length<2||input.playerIds.length>4||new Set(input.playerIds).size!==input.playerIds.length)throw new Error('Ark Nova requires 2–4 players.');
  const first=input.random.nextInt(input.playerIds.length);if(!Number.isSafeInteger(first)||first<0||first>=input.playerIds.length)throw new Error('Invalid random seat.');
  const ids=[...input.playerIds.slice(first),...input.playerIds.slice(0,first)],template=createArkSoloGame({...input,playerId:ids[0]!,difficulty:'EXPERT'});
  const pool=publicPool(template);pool.zooDeck.unshift(...template.hand);pool.goalDeck.unshift(...template.goals,...pool.discardedGoals.splice(0));
  if(ids.length===4)pool.baseProjects.push(pool.baseProjectReserve.shift()!);
  pool.donations=ids.length===2?[1,3,5]:[];
  const players=ids.map((playerId,i)=>{
    const p=structuredClone(template);p.playerId=playerId;p.hand=pool.zooDeck.splice(0,8);p.goals=pool.goalDeck.splice(0,2);p.appeal=i;
    for(let k=4;k>1;k--){const j=1+input.random.nextInt(k);if(j<1||j>k)throw new Error('Invalid random action.');[p.actions[k],p.actions[j]]=[p.actions[j]!,p.actions[k]!];}
    p.progress={mode:'MULTIPLAYER',round:1,turnsCompleted:0,turnInRound:0,stage:'SETUP'};
    p.multiplayer={startingAppeal:v.parse(v.picklist([0,1,2,3]),i),playerCount:v.parse(v.picklist([2,3,4]),ids.length),otherZoo:[],rightZoo:[],turnEnded:false,breakAdvance:0,breakCompleted:false,occupiedProjects:[],otherPartners:[],otherUniversities:[]};
    return local(p);
  });
  return parseArkMultiplayerState({mode:'MULTIPLAYER',gameId:template.gameId,revision:template.revision,transitionId:template.transitionId,startedAt:template.startedAt,finishedAt:null,phase:'PLAYING',playerId:ids[0],players,shared:pool,
    stage:'SETUP',readyPlayerIds:[],breakPosition:0,breakNumber:0,breakQueue:[],resumePlayerId:ids[0],finalTurns:null,winners:[],interaction:null,borrowed:[],goalQueue:[],goalDiscardTriggered:false,resumeStage:'ACTION',goalResumePlayerId:ids[0],
    occupiedProjects:ids.length===2?pool.baseProjects.map((c,slot)=>({cardId:c.cardId,slot,playerId:null})):[]});
}
function orderFrom(s:ArkMultiplayerState,id:PlayerId):PlayerId[]{const ids=s.players.map(p=>p.playerId),i=ids.indexOf(id);return [...ids.slice(i),...ids.slice(0,i)];}
function nextPlayer(s:ArkMultiplayerState,id:PlayerId):PlayerId{return orderFrom(s,id)[1]!;}
function prepareFinal(s:ArkMultiplayerState,now:ServerTime,next:TurnId):void {
  s.stage='FINAL_SCORING';
  for(const entry of [...s.players]){
    const p=hydrateArkPlayer(s,entry.playerId);p.progress.stage='FINAL_SCORING';p.multiplayer!.turnEnded=false;
    if(!p.goalDiscarded)p.pending={kind:'FINAL_GOAL',choiceId:next};
    else p.pending=null;
    save(s,p);
  }
  settleFinal(s,now);
}
function settleFinal(s:ArkMultiplayerState,now:ServerTime):void {
  const waiting=s.players.find(p=>!p.goalDiscarded);if(waiting){s.playerId=waiting.playerId;return;}
  if(s.players.every(p=>p.result===null))for(const entry of [...s.players]){const p=hydrateArkPlayer(s,entry.playerId);finalizeArkParticipant(p,now);save(s,p);}
  const ranked=[...s.players].sort((a,b)=>b.result!.total-a.result!.total||b.supportedProjects-a.supportedProjects),best=ranked[0]!;
  s.winners=ranked.filter(p=>p.result!.total===best.result!.total&&p.supportedProjects===best.supportedProjects).map(p=>p.playerId);
  s.phase='FINISHED';s.stage='FINISHED';s.finishedAt=now;
}
function beginBreak(s:ArkMultiplayerState,trigger:PlayerId,next:TurnId):void {
  s.stage='BREAK';s.resumePlayerId=nextPlayer(s,trigger);s.breakQueue=orderFrom(s,trigger);s.breakNumber++;
  // Everyone discards before any income. The shared market is refreshed exactly once.
  for(const p of s.players){p.progress.stage='BREAK';p.breakStep='DISCARD';p.multiplayer!.breakCompleted=false;p.multiplayer!.turnEnded=false;const count=Math.max(0,p.hand.length-(p.universities.includes('HAND_LIMIT')?5:3));p.pending=count?{kind:'BREAK_DISCARD',choiceId:next,count}:null;}
  advanceBreak(s,next);
}
function advanceBreak(s:ArkMultiplayerState,next:TurnId):void {
  const discarding=s.players.find(p=>p.pending?.kind==='BREAK_DISCARD');if(discarding){s.playerId=discarding.playerId;return;}
  if(s.players.every(p=>p.breakStep==='DISCARD')){
    s.shared.partnerSupply=ARK_CONTINENTS.filter(c=>!s.players.every(p=>p.partners.includes(c)));s.shared.universitySupply=ARK_UNIVERSITIES.filter(u=>!s.players.every(p=>p.universities.includes(u)));
    s.shared.discarded.push(...s.shared.display.slice(0,2).filter(c=>c!==null));s.shared.display[0]=null;s.shared.display[1]=null;
    // replenish mutates the temporary object, including replacing display; copy the updated zones back.
    const zones={...s.shared,hand:[]};replenishArkDisplay(zones);s.shared.display=zones.display;s.shared.zooDeck=zones.zooDeck;
    for(const p of s.players){p.actions=p.actions.map(a=>({...a,venom:false,constriction:false,multiplier:0}));p.busyWorkers=0;p.taskWorkers={};}
  }
  while(s.breakQueue.length){
    const id=s.breakQueue[0]!,p=hydrateArkPlayer(s,id);s.playerId=id;
    if(p.breakStep==='DISCARD'){if(!finishArkParticipantBreak(p,[],next))throw new Error('Cannot start multiplayer income.');save(s,p);}
    if(!p.multiplayer!.breakCompleted)return;
    s.breakQueue.shift();
  }
  if(s.finalTurns===null&&s.players.some(p=>arkVictoryPoints(p.appeal,p.conservation)>=0))s.finalTurns=orderFrom(s,s.resumePlayerId);
  for(const p of s.players){p.progress.stage='ACTION';p.progress.round++;p.progress.turnInRound=0;p.multiplayer!.breakCompleted=false;}
  s.breakPosition=0;s.stage='ACTION';s.playerId=s.resumePlayerId;
}
export function applyArkMultiplayerCommand(current:ArkMultiplayerState,actor:PlayerId,revision:number,input:unknown,now:ServerTime,next:TurnId,random:Parameters<typeof applyArkSoloCommand>[6]) {
  const invalid=()=>({ok:false as const,reason:'INVALID_ACTION' as const});
  if(!current.players.some(p=>p.playerId===actor))return {ok:false as const,reason:'UNAUTHORIZED' as const};
  if(revision!==current.revision)return {ok:false as const,reason:'STALE_REVISION' as const};
  if(current.phase!=='PLAYING')return {ok:false as const,reason:'INVALID_PHASE' as const};
  const command=v.safeParse(ArkSoloCommandSchema,input);if(!command.success)return invalid();
  if(current.stage==='SETUP'?(command.output.kind!=='INITIAL_HAND'||current.readyPlayerIds.includes(actor)):actor!==current.playerId)return invalid();
  const s=parseArkMultiplayerState(current),p=hydrateArkPlayer(s,actor),a=command.output;
  if(a.kind==='INITIAL_HAND'&&a.mapId&&a.mapId!=='A'&&a.mapId!=='0'&&s.players.some(other=>other.playerId!==actor&&s.readyPlayerIds.includes(other.playerId)&&other.mapId===a.mapId))return invalid();
  const borrowing=s.borrowed.at(-1);
  s.notice=null;
  const starting=a.kind==='BEGIN_ZOO'||a.kind==='TAKE_X'?a.action:a.kind==='FUNDRAISE'?'SPONSORS':a.kind==='DRAW'||a.kind==='SNAP'?'CARDS':a.kind==='BUILD'?'BUILD':a.kind==='ASSOCIATION'?'ASSOCIATION':null;
  if((starting||a.kind==='HARBOR')&&s.stage==='ACTION'&&!p.pending&&!p.zooWork&&!p.activeBuild&&!p.activeAssociation){
    if(!s.venomRollback&&p.actions.some(c=>c.venom))s.venomRollback=JSON.stringify(s);
    const m=p.multiplayer!,card=p.actions.find(c=>c.kind===starting);
    if(a.kind==='BEGIN_ZOO')m.venomStart={removed:m.venomRemoved??false};
    if(card?.venom)m.venomRemoved=true;
  }
  if(borrowing?.ownerId===actor&&!borrowing.rowRestored&&!p.extraActions.length){
    const kind=a.kind==='BEGIN_ZOO'||a.kind==='TAKE_X'?a.action:a.kind==='FUNDRAISE'?'SPONSORS':a.kind==='DRAW'||a.kind==='SNAP'?'CARDS':a.kind==='BUILD'?'BUILD':a.kind==='ASSOCIATION'?'ASSOCIATION':null;
    if(kind!==null&&kind!==borrowing.action)return invalid();
  }
  if(s.stage==='INTERACTION'){
    if(a.kind!=='INTERACTION_PAYMENT'||a.choiceId!==s.transitionId||!s.interaction||s.interaction.targetId!==actor)return invalid();
    const owner=hydrateArkPlayer(s,s.interaction.ownerId);
    if(a.payment==='MONEY'){if(p.money<5)return invalid();p.money-=5;owner.money+=5;}
    else{if(!p.hand.length||!random)return invalid();const i=random.nextInt(p.hand.length);if(!Number.isSafeInteger(i)||i<0||i>=p.hand.length)return invalid();owner.hand.push(...p.hand.splice(i,1));}
    save(s,p);finishInteraction(owner,s.interaction.effectId,next);save(s,owner);s.playerId=owner.playerId;s.stage='ACTION';s.interaction=null;
  }else if(s.stage==='GOAL_DISCARD'){
    if(a.kind!=='FINAL_GOAL'||a.choiceId!==s.transitionId||p.goalDiscarded||!p.goals.some(c=>c.cardId===a.discard))return invalid();
    p.goalDeck.push(...p.goals.filter(c=>c.cardId===a.discard));p.goals=p.goals.filter(c=>c.cardId!==a.discard);p.goalDiscarded=true;save(s,p);s.goalQueue.shift();
    if(s.goalQueue.length)s.playerId=s.goalQueue[0]!;else{s.stage=s.resumeStage;s.playerId=s.goalResumePlayerId;}
  }else if(s.stage==='FINAL_SCORING'){
    if(a.kind!=='FINAL_GOAL'||p.pending?.kind!=='FINAL_GOAL'||a.choiceId!==p.pending.choiceId||!p.goals.some(c=>c.cardId===a.discard))return invalid();
    p.discardedGoals.push(...p.goals.filter(c=>c.cardId===a.discard));p.goals=p.goals.filter(c=>c.cardId!==a.discard);p.goalDiscarded=true;p.pending=null;save(s,p);
  }else if(s.stage==='BREAK'&&p.pending?.kind==='BREAK_DISCARD'){
    if(a.kind!=='DISCARD'||a.choiceId!==p.pending.choiceId||a.cards.length!==p.pending.count||new Set(a.cards).size!==a.cards.length||a.cards.some(id=>!p.hand.some(c=>c.cardId===id)))return invalid();
    p.discarded.push(...p.hand.filter(c=>a.cards.includes(c.cardId)));p.hand=p.hand.filter(c=>!a.cards.includes(c.cardId));p.pending=null;save(s,p);
  }else{
    const job=p.effects.active;
    const result=a.kind==='EFFECT'&&job?.effect.kind==='INTERACTION'?handleInteraction(s,p,a,next):applyArkSoloCommand(p,actor,revision,a,now,next,random);if(!result.ok)return result;
    if(a.kind==='CANCEL_ZOO'&&result.state.multiplayer?.venomStart){const m=result.state.multiplayer,prior=m.venomStart!;m.venomRemoved=prior.removed;delete m.venomStart;}
    save(s,result.state);
    const entered=result.state.played.filter(c=>!p.played.some(old=>old.cardId===c.cardId));
    for(const card of entered){const added=arkZooIcons([card],[],[]);for(const other of s.players.filter(o=>o.playerId!==actor)){for(const sponsor of other.played){const tag=({236:'Primate',237:'Reptile',238:'Bird',239:'Predator',240:'Herbivore'} as Readonly<Record<string,string>>)[sponsor.key];if(tag)other.money+=3*(added[tag]??0);}}}
    // Patent Release pays opponents when its conservation effect resolves, not when the card enters.
    if(a.kind==='EFFECT'&&p.effects.active?.effect.kind==='GAIN'&&p.effects.active.effect.resource==='CONSERVATION'&&p.played.some(c=>c.cardId===p.effects.active!.sourceId&&c.key==='222')){const gain=result.state.conservation-p.conservation;for(const other of s.players.filter(o=>o.playerId!==actor))other.money+=2*gain;}
    for(const token of result.state.projectSupports)if(!s.occupiedProjects.some(o=>o.cardId===token.cardId&&o.slot===token.slot))s.occupiedProjects.push({...token,playerId:actor});
    const visible=new Set([...s.shared.baseProjects,...s.shared.playedProjects].map(c=>c.cardId));s.occupiedProjects=s.occupiedProjects.filter(o=>visible.has(o.cardId));for(const pl of s.players)pl.projectSupports=pl.projectSupports.filter(o=>visible.has(o.cardId));
    if(s.stage==='SETUP'){s.readyPlayerIds.push(actor);if(s.readyPlayerIds.length===s.players.length){s.stage='ACTION';s.playerId=s.players[0]!.playerId;}}
  }
  while(s.borrowed.length){
    const frame=s.borrowed.at(-1)!,borrower=s.players.find(p=>p.playerId===frame.ownerId)!;
    if(!frame.rowRestored&&(borrower.multiplayer!.borrowedFinished||borrower.multiplayer!.turnEnded)){
      borrower.actions=frame.actions.map(old=>({...old,upgraded:old.kind===frame.action?old.upgraded:borrower.actions.find(a=>a.kind===old.kind)!.upgraded}));borrower.upgradeCount=borrower.actions.filter(a=>a.upgraded).length;
      const target=s.players.find(p=>p.playerId===frame.targetId)!;target.actions=finishArkAction(target.actions,frame.action);frame.rowRestored=true;delete borrower.multiplayer!.borrowedFinished;
    }
    if(borrower.multiplayer!.turnEnded){
      const borrowed=hydrateArkPlayer(s,frame.ownerId);borrowed.multiplayer!.turnEnded=false;borrowed.progress=frame.progress;
      borrowed.effects=frame.effects;borrowed.zooWork=frame.zooWork;borrowed.legacyAfterFinishing=frame.legacyAfterFinishing;borrowed.extraActions=frame.extraActions;borrowed.repeatedAction=frame.repeatedAction;delete borrowed.multiplayer!.borrowedStrength;
      s.borrowed.pop();const parent=s.borrowed.at(-1);if(parent)borrowed.multiplayer!.borrowedStrength=parent.strength;finishInteraction(borrowed,borrowed.effects.active!.id,next);save(s,borrowed);
    } else break;
  }
  for(const after of s.players){const m=after.multiplayer!;
    if(m.breakAdvance){const previous=s.breakPosition;s.breakPosition=Math.min(arkMultiplayerBreakLimit(s.players.length),s.breakPosition+m.breakAdvance);m.breakAdvance=0;if(previous<s.breakPosition&&s.breakPosition===arkMultiplayerBreakLimit(s.players.length))after.x=Math.min(5,after.x+1);}
  }
  const ended=s.players.find(p=>p.multiplayer!.turnEnded);
  if(s.stage==='ACTION'&&ended){const m=ended.multiplayer!,endedId=ended.playerId;
    if(!m.venomRemoved&&ended.actions.some(c=>c.venom)){
      if(ended.money<2){
        if(!s.venomRollback)throw new Error('Missing poisoned turn checkpoint.');
        const restored=parseArkMultiplayerState(JSON.parse(s.venomRollback));
        restored.revision=v.parse(GameRevisionSchema,revision+1);restored.transitionId=next;restored.venomRollback=null;
        restored.notice='독 비용 2를 지불할 수 없어 이번 차례를 시작 전으로 되돌렸습니다. 돈을 벌거나 독 토큰이 있는 행동 카드를 사용하세요.';
        return {ok:true as const,state:parseArkMultiplayerState(restored)};
      }
      ended.money-=2;
      const entry=ended.history.at(-1);if(entry?.revision===revision+1){entry.notes=[...entry.notes.slice(0,19),'독 비용 돈 2'];const money=entry.changes.find(c=>c.resource==='돈');if(money)money.after=ended.money;else entry.changes.push({resource:'돈',before:ended.money+2,after:ended.money});}
    }
    s.venomRollback=null;m.turnEnded=false;m.venomRemoved=false;delete m.venomStart;
    if(s.finalTurns){s.finalTurns=s.finalTurns.filter(id=>id!==endedId);if(!s.finalTurns.length)prepareFinal(s,now,next);}
    else if(arkVictoryPoints(ended.appeal,ended.conservation)>=0)s.finalTurns=orderFrom(s,endedId).slice(1);
    if(s.stage==='ACTION'){if(s.breakPosition===arkMultiplayerBreakLimit(s.players.length))beginBreak(s,endedId,next);else s.playerId=nextPlayer(s,endedId);}
  }
  if(s.stage==='BREAK')advanceBreak(s,next);
  if(s.stage==='FINAL_SCORING')settleFinal(s,now);
  if(!s.interaction&&!s.borrowed.length&&!s.goalDiscardTriggered&&s.stage!=='FINISHED'&&s.stage!=='FINAL_SCORING'&&s.players.some(p=>p.conservation>=10)){
    s.goalDiscardTriggered=true;s.goalQueue=orderFrom(s,actor).filter(id=>!s.players.find(p=>p.playerId===id)!.goalDiscarded);
    if(s.goalQueue.length){s.resumeStage=s.stage==='BREAK'?'BREAK':'ACTION';s.goalResumePlayerId=s.playerId;s.stage='GOAL_DISCARD';s.playerId=s.goalQueue[0]!;}
  }
  s.revision=v.parse(GameRevisionSchema,revision+1);s.transitionId=next;
  return {ok:true as const,state:parseArkMultiplayerState(s)};
}
export function projectArkMultiplayerGame(s:ArkMultiplayerState,viewer:PlayerId):ArkSoloView {
  const p=hydrateArkPlayer(s,viewer);
  return projectArkSoloGame(p,viewer,{hideDisplay:s.stage==='SETUP',table:{notice:s.notice,interaction:s.interaction?{ownerId:s.interaction.ownerId,targetId:s.interaction.targetId}:null,borrowed:s.borrowed.at(-1)?.ownerId===viewer&&!s.borrowed.at(-1)!.rowRestored?{targetId:s.borrowed.at(-1)!.targetId,action:s.borrowed.at(-1)!.action,strength:s.borrowed.at(-1)!.strength}:null,stage:s.stage,activePlayerId:s.playerId,breakPosition:s.breakPosition,breakLimit:arkMultiplayerBreakLimit(s.players.length),breakNumber:s.breakNumber,readyPlayerIds:s.readyPlayerIds,finalTurns:s.finalTurns,winners:s.winners,occupiedProjects:s.occupiedProjects,
    players:s.players.map(p=>({mapId:p.mapId,playerId:p.playerId,money:p.money,appeal:p.appeal,conservation:p.conservation,reputation:p.reputation,x:p.x,workers:p.workers,busyWorkers:p.busyWorkers,handCount:p.hand.length,goalCount:p.goals.length,played:p.played,buildings:p.buildings,actions:p.actions,partners:p.partners,universities:p.universities,supportedProjects:p.supportedProjects,total:p.result?.total??null}))}});
}
function finishInteraction(p:ArkSoloState,id:number,next:TurnId):void {
  const job=p.effects.active;if(job?.id!==id||job.effect.kind!=='INTERACTION')throw new Error('Invalid interactive effect.');
  if(job.effect.ability==='PILFERING'&&job.effect.amount===2){job.effect={...job.effect,amount:1,track:'CONSERVATION'};p.pending={kind:'EFFECT',choiceId:next};return;}
  p.effects=completeArkEffect(p.effects,id);resumeArkParticipantEffects(p,next);
}
function handleInteraction(s:ArkMultiplayerState,p:ArkSoloState,a:Extract<v.InferOutput<typeof ArkSoloCommandSchema>,{kind:'EFFECT'}>,next:TurnId){
  const invalid=()=>({ok:false as const,reason:'INVALID_ACTION' as const}),job=p.effects.active;
  if(!job||job.id!==a.effectId||job.effect.kind!=='INTERACTION'||p.pending?.choiceId!==a.choiceId)return invalid();
  const e=job.effect,eligible=(o:typeof s.players[number])=>o.playerId!==p.playerId&&o.appeal>=5&&!o.played.some(c=>c.key==='225');
  if(e.ability==='VENOM'||e.ability==='CONSTRICTION'){
    if(a.selection.kind!=='NONE')return invalid();
    for(const o of s.players.filter(eligible)){
      const amount=e.ability==='VENOM'?(o.appeal>p.appeal?e.amount:0):Number(o.appeal>p.appeal)+Number(o.conservation>p.conservation);
      for(let i=0;i<Math.min(5,amount);i++)o.actions[e.ability==='VENOM'?i:4-i]![e.ability==='VENOM'?'venom':'constriction']=true;
    }
    finishInteraction(p,job.id,next);return {ok:true as const,state:p};
  }
  const track=e.track==='CONSERVATION'?'conservation':'appeal',top=Math.max(...s.players.filter(o=>!o.played.some(c=>c.key==='225')).map(o=>o[track]));
  const targets=s.players.filter(o=>o[track]===top&&(track!=='conservation'||top>=1)&&eligible(o));
  if(a.selection.kind==='SKIP'){
    if(targets.length&&e.ability!=='HYPNOSIS'&&(p[track]!==top||p.played.some(c=>c.key==='225')))return invalid();finishInteraction(p,job.id,next);return {ok:true as const,state:p};
  }
  if(a.selection.kind!=='INTERACTION')return invalid();
  const selected=a.selection,target=targets.find(o=>o.playerId===selected.targetId);if(!target)return invalid();
  if(e.ability==='PILFERING'){
    if(selected.action!==null)return invalid();
    if(target.money<5&&!target.hand.length){p.money+=target.money;target.money=0;finishInteraction(p,job.id,next);return {ok:true as const,state:p};}
    s.stage='INTERACTION';s.playerId=target.playerId;s.interaction={ownerId:p.playerId,targetId:target.playerId,effectId:job.id};
    return {ok:true as const,state:p};
  }
  const index=target.actions.findIndex(c=>c.kind===selected.action),card=target.actions[index];if(index<0||index>2||!card)return invalid();
  // Pause the current card's immediate effects; the borrowed action uses the other player's side and strength.
  s.borrowed.push({ownerId:p.playerId,targetId:target.playerId,rowRestored:false,strength:index+1,action:card.kind,actions:structuredClone(p.actions),effects:p.effects,zooWork:p.zooWork,legacyAfterFinishing:p.legacyAfterFinishing,extraActions:p.extraActions,repeatedAction:p.repeatedAction,progress:{...p.progress}});
  p.effects=createArkEffectQueue();p.zooWork=null;p.legacyAfterFinishing=null;p.extraActions=[];p.repeatedAction=null;p.pending=null;
  p.actions=p.actions.map(c=>c.kind===card.kind?{...card,multiplier:0}:c);p.upgradeCount=p.actions.filter(c=>c.upgraded).length;
  p.multiplayer!.borrowedStrength=index+1;
  if(card.upgraded&&card.kind==='BUILD')p.multiplayer!.borrowedBuildUnlocked=true;
  if(card.upgraded&&card.kind==='ASSOCIATION')p.multiplayer!.borrowedAssociationUnlocked=true;
  return {ok:true as const,state:p};
}
