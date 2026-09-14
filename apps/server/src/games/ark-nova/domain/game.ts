import { projectArkEffectGuide } from './effect-guide.js';
import type { RandomSource } from '../../../ports/system.js';
import { ArkCardRevealSchema } from './card-effect-choices.js';
import { ArkGoalRevealSchema } from './reserve-card-choices.js';
import { ArkEffectQueueSchema, completeArkEffect, createArkEffectQueue, beginArkAfterFinishing, arkEffectsPending, enqueueArkEffects, selectArkEffect } from './effect-queue.js';
import { resolveArkEffect } from './resolve-effect.js';
import { ArkZooWorkSchema, beginArkWazaBonus, beginArkZooWork, playNextArkZooCard, endArkZooWork, completeArkZooWork } from './zoo-card-work.js';
import { assertArkExtendedCardInventory } from './card-inventory.js';
import { assertArkZooMap } from './zoo-map.js';
import { arkZooIcons } from './zoo-icons.js';
import type { ArkEffectBatch } from './effect-queue.js';
import { arkProjectBonusIncome } from './project-bonuses.js';
import { arkSponsorIconTriggers, arkSponsorIncome } from './sponsor-effects.js';
import { ArkConservationBonusPoolSchema, createArkConservationBonuses } from './conservation-bonuses.js';
import * as v from 'valibot';
import {
  arkProjectSupportsAreConsistent,
  ArkActivatedProjectBonusesSchema, ArkProjectSupportRecordSchema, ArkAssociationWorkSchema, type ArkReward, ArkActionKindSchema, ArkRepeatedActionSchema, type ArkActionKind, ArkExtraActionKindSchema, ARK_CONTINENTS, ArkRewardSchema, ArkCardSchema, ArkCountSchema, ArkSoloCommandSchema, ArkRefSchema, GameRevisionSchema,
  ArkSoloPendingSchema, ArkSoloResultSchema, ArkSoloViewSchema, ARK_SOLO_STARTING_APPEAL, ArkActiveBuildSchema, ArkBuildBonusSchema, ArkPlacementSchema, type ArkSoloView,
  ServerTimeSchema, TurnIdSchema, type PlayerId, type ServerTime, type TurnId,
} from '@hangul-rummikub/shared';
import { ArkSoloSetupStateSchema, parseArkSoloSetup, createArkSoloSetup, chooseArkSoloInitialHand } from './solo-setup.js';
import { startArkAction, finishArkAction, takeArkXToken } from './action-row.js';
import { startArkSolo, finishArkSoloTurn, completeArkSoloScoring, parseArkSoloProgress } from './solo-lifecycle.js';
import { beginArkSoloBreak, resolveArkSoloBreakDiscard, completeArkSoloBreak, ARK_UNIVERSITIES } from './solo-break.js';
import { drawArkCards, discardArkHand, replenishArkDisplay, takeArkDisplayCard } from './card-zones.js';
import { arkConstructionAppeal, arkPlacementBonuses, canContinueArkBuild, arkReputationRange } from './build-turn.js';
import { arkNewBuildingEffects } from './construction-effects.js';
import { validateArkConstruction } from './construction.js';
import { arkUniversityResearch, arkReputationAdvance, assertArkAssociation } from './association.js';
import { startArkAssociationWork, continueArkAssociationWork, donateArkAssociationWork } from './association-work.js';
import { calculateArkSoloFinalScore } from './final-scoring.js';

const cards = v.array(ArkCardSchema);
const ExtraActionFrame=v.pipe(v.strictObject({
  action:ArkExtraActionKindSchema,started:v.boolean(),effects:ArkEffectQueueSchema,
  zooWork:v.nullable(ArkZooWorkSchema),legacyAfterFinishing:v.nullable(ArkActionKindSchema),
}),v.check(f=>f.effects.stage==='AFTER_FINISHING'&&f.effects.active===null&&f.effects.afterFinishing.length===0&&
  (f.zooWork!==null?f.zooWork.stage==='AFTER_FINISHING'&&f.legacyAfterFinishing===null&&
    f.zooWork.remaining<=(f.zooWork.action==='ANIMALS'?2:11)&&
    (f.zooWork.action!=='SPONSORS'||f.zooWork.upgraded||f.zooWork.playedCount<=1):f.legacyAfterFinishing!==null)));

const State = v.strictObject({
  ...ArkSoloSetupStateSchema.entries,
  extraActions:v.array(ExtraActionFrame),
  repeatedAction:v.nullable(v.strictObject({...ArkRepeatedActionSchema.entries,deferred:ArkEffectQueueSchema})),
  activatedProjectBonuses:ArkActivatedProjectBonusesSchema,projectSupports:v.pipe(v.array(ArkProjectSupportRecordSchema),v.maxLength(7)),
  played:cards,playedProjects:cards,pouched:v.record(ArkRefSchema,cards),sponsorTokens:v.record(ArkRefSchema,ArkCountSchema),
  legacyAfterFinishing:v.nullable(ArkActionKindSchema),effects:ArkEffectQueueSchema,zooWork:v.nullable(ArkZooWorkSchema),cardReveal:v.nullable(ArkCardRevealSchema),goalReveal:v.nullable(ArkGoalRevealSchema),
  conservationBonuses:ArkConservationBonusPoolSchema,wazaFocus:v.nullable(v.picklist(['SMALL','LARGE'])),supportedProjects:ArkCountSchema,
  resistanceGained:ArkCountSchema,goalDiscarded:v.boolean(),
  money:ArkCountSchema, appeal:v.pipe(ArkCountSchema,v.maxValue(113)),
  conservation:v.pipe(ArkCountSchema,v.maxValue(41)), reputation:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(15)),
  x:v.pipe(ArkCountSchema,v.maxValue(5)), workers:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(4)),
  goals:cards, display:v.pipe(v.array(v.nullable(ArkCardSchema)),v.length(6)),
  associationWork:v.nullable(ArkAssociationWorkSchema),donationsMade:ArkCountSchema,
  activeAssociation:v.boolean(), rewards:v.array(ArkRewardSchema),
  associationConservation:v.pipe(ArkCountSchema,v.maxValue(41)), extraWorkers:v.pipe(ArkCountSchema,v.maxValue(3)),
  upgradeCount:v.pipe(ArkCountSchema,v.maxValue(4)), extraAppeal:ArkCountSchema, reputationGained:v.pipe(ArkCountSchema,v.maxValue(14)),
  activeBuild:ArkActiveBuildSchema, buildBonuses:v.array(ArkBuildBonusSchema),
  phase:v.picklist(['PLAYING','FINISHED']), startedAt:ServerTimeSchema, finishedAt:v.nullable(ServerTimeSchema),
  transitionId:TurnIdSchema, pending:ArkSoloPendingSchema, result:v.nullable(ArkSoloResultSchema),
  breakStep:v.picklist(['NOT_STARTED','DISCARD','CARD_INCOME','COMPLETE']),
  donations:v.array(v.pipe(ArkCountSchema,v.maxValue(6))),
  busyWorkers:ArkCountSchema, taskWorkers:v.record(ArkRefSchema,ArkCountSchema),
  partners:v.array(ArkRefSchema), partnerSupply:v.array(ArkRefSchema),
  universities:v.array(v.picklist(ARK_UNIVERSITIES)), universitySupply:v.array(v.picklist(ARK_UNIVERSITIES)),
});
export type ArkSoloState = v.InferOutput<typeof State>;

/** One canonical state for the connected setup/action/break/final loop.
 * Zoo-card actions, multiplied actions, nested extra actions and effect choices share this loop.
 * Card-specific exceptions and platform transport integration remain under audit.
 */
export function parseArkSoloState(input: unknown): ArkSoloState {
  const s = v.parse(State, input);
  parseArkSoloProgress(s.progress);
  if(s.activeAssociation!==(s.associationWork!==null)||s.associationWork?.upgraded&&!s.actions.some(c=>c.kind==='ASSOCIATION'&&c.upgraded))throw new Error('Invalid Ark association continuation.');
  const repeated=s.repeatedAction;
  if(repeated&&(s.progress.stage!=='ACTION'||s.legacyAfterFinishing!==null||repeated.deferred.stage!=='IMMEDIATE'||arkEffectsPending(repeated.deferred)||
    !repeated.awaiting&&(repeated.mode==='TAKE_X'||!s.pending&&!s.activeBuild&&!s.activeAssociation&&!s.zooWork)||
    s.zooWork!==null&&s.zooWork.action!==repeated.action||s.activeBuild!==null&&repeated.action!=='BUILD'||s.activeAssociation&&repeated.action!=='ASSOCIATION'||
    repeated.awaiting&&(repeated.completed<1||s.pending!==null||s.activeBuild!==null||s.activeAssociation||s.zooWork!==null||s.legacyAfterFinishing!==null)))throw new Error('Invalid Ark repeated action.');
  if(s.extraActions.length&&(s.progress.stage!=='ACTION'||s.extraActions.slice(0,-1).some(f=>!f.started)||
    !s.extraActions.at(-1)!.started&&(s.pending!==null||s.zooWork!==null||s.activeBuild!==null||s.activeAssociation||s.legacyAfterFinishing!==null||arkEffectsPending(s.effects))))throw new Error('Invalid Ark extra action continuation.');
  assertArkExtendedCardInventory(s);
  if(s.playedProjects.length>2||s.supportedProjects!==s.activatedProjectBonuses.length||
    !arkProjectSupportsAreConsistent(s)||s.projectSupports.length>s.supportedProjects)throw new Error('Invalid Ark project board.');
  if((arkEffectsPending(s.effects))!==(s.pending?.kind==='EFFECT') ||
    s.zooWork!==null&&(s.progress.stage!=='ACTION'||s.activeBuild!==null||s.activeAssociation||s.legacyAfterFinishing!==null||
      s.effects.stage!==(s.zooWork.stage==='PLAYING'?'IMMEDIATE':'AFTER_FINISHING')||
      s.zooWork.remaining>(s.zooWork.action==='ANIMALS'?2:11)||
      s.zooWork.wazaUsed&&(s.zooWork.action!=='ANIMALS'||!s.zooWork.onlySmall||s.zooWork.playedCount<1||s.zooWork.remaining!==0||!s.played.some(c=>c.key==='228'))||
      s.zooWork.action==='SPONSORS'&&!s.zooWork.upgraded&&s.zooWork.playedCount>1||
      s.zooWork.upgraded&&!s.actions.some(a=>a.kind===s.zooWork!.action&&a.upgraded)) ||
    arkEffectsPending(s.effects)&&!s.zooWork&&!s.activeBuild&&!s.activeAssociation&&!s.legacyAfterFinishing&&!(s.progress.stage==='BREAK'&&s.breakStep==='CARD_INCOME') ||
    s.cardReveal!==null&&s.effects.active?.effect.kind!==s.cardReveal.kind ||
    s.goalReveal!==null&&s.effects.active?.effect.kind!=='RESISTANCE' ||
    s.effects.afterFinishing.length>0&&!s.zooWork&&!s.activeBuild&&!s.activeAssociation&&s.progress.stage!=='BREAK' ||
    s.legacyAfterFinishing!==null&&(s.progress.stage!=='ACTION'||s.effects.stage!=='AFTER_FINISHING'||!arkEffectsPending(s.effects)||s.activeBuild!==null||s.activeAssociation) ||
    s.progress.stage==='SETUP'&&(s.activatedProjectBonuses.length||s.playedProjects.length||s.projectSupports.length||s.donationsMade||s.played.length||s.zooWork||s.legacyAfterFinishing||s.resistanceGained||s.goalDiscarded||s.wazaFocus))throw new Error('Invalid Ark card effect state.');
  const finished = s.phase === 'FINISHED';
  if (finished !== (s.progress.stage === 'FINISHED') || finished !== (s.result !== null) || finished !== (s.finishedAt !== null) ||
    s.finishedAt !== null && s.finishedAt < s.startedAt || s.busyWorkers > s.workers ||
    s.goals.some(c=>c.key==='009') || new Set(s.actions.map(c=>c.kind)).size!==5 ||
    new Set(s.donations).size!==s.donations.length) throw new Error('Invalid Ark solo state.');
  if (s.progress.stage === 'SETUP') {
    const setup = Object.fromEntries(Object.keys(ArkSoloSetupStateSchema.entries).map(key=>[key,Reflect.get(s,key)]));
    // Reuse the setup boundary, including exact initial hand, action order and buildings.
    parseArkSoloSetup(setup);
    if (s.pending !== null || s.activeBuild !== null || s.buildBonuses.length || s.activeAssociation || s.rewards.length || s.associationConservation || s.extraWorkers || s.upgradeCount || s.extraAppeal || s.reputationGained || s.partners.length || s.universities.length || s.busyWorkers) throw new Error('Invalid Ark setup phase.');
  }
  if (s.pending?.kind === 'DRAW_DISCARD' && s.progress.stage !== 'ACTION' ||
    s.pending?.kind === 'BREAK_DISCARD' && (s.progress.stage !== 'BREAK' || s.breakStep !== 'DISCARD') ||
    s.pending?.kind === 'FINAL_GOAL' && s.progress.stage !== 'FINAL_SCORING' ||
    finished && s.pending !== null ||
    s.progress.stage === 'BREAK' && s.pending?.kind !== 'BREAK_DISCARD' && !(s.pending?.kind==='EFFECT'&&s.breakStep==='CARD_INCOME') ||
    s.progress.stage === 'FINAL_SCORING' && s.pending?.kind !== 'FINAL_GOAL' ||
    s.pending?.kind === 'DRAW_DISCARD' && s.pending.count !== 1 ||
    s.pending?.kind === 'BREAK_DISCARD' && s.pending.count !== s.hand.length - (s.universities.includes('HAND_LIMIT')?5:3)) throw new Error('Invalid Ark pending choice.');
  assertArkZooMap(s.buildings,s.played,s.actions.some(a=>a.kind==='BUILD'&&a.upgraded));
  if(!s.played.length&&s.buildings.some(b=>b.occupied||b.used))throw new Error('Unpopulated Ark zoo has occupied buildings.');
  const coveredBonuses=s.buildings.slice(2).flatMap(arkPlacementBonuses);
  const reputation=1+s.reputationGained;
  const workers=Math.min(4,1+s.extraWorkers);
  const upgrades=s.actions.filter(a=>a.upgraded).length;
  if (new Set(s.buildBonuses.map(b=>b.id)).size!==s.buildBonuses.length ||
    s.buildBonuses.some(b=>b.kind==='UPGRADE' ? b.id!=='reputation:5' || reputation<5 : !coveredBonuses.some(c=>c.id===b.id&&c.kind===b.kind)) ||
    s.actions.some(c=>c.venom||c.constriction) ||
    s.conservation !== (s.result?.conservation ?? s.associationConservation) || s.reputation !== reputation || s.workers !== workers ||
    upgrades !== s.upgradeCount ||
    s.appeal !== Math.min(113,ARK_SOLO_STARTING_APPEAL[s.difficulty]+s.extraAppeal+(s.result?.sponsorAppeal??0)) ||
    s.goals.length !== 2+s.resistanceGained-Number(s.goalDiscarded)) throw new Error('Unsupported Ark command state.');
  if (s.activeBuild !== null && (s.progress.stage!=='ACTION' || s.activeBuild.remaining>10 ||
      new Set(s.activeBuild.builtKinds).size!==s.activeBuild.builtKinds.length-Number(s.activeBuild.engineerUsed===true) ||
      s.activeBuild.engineerUsed&&!s.played.some(c=>c.key==='217')||
      !s.activeBuild.upgraded && s.activeBuild.builtKinds.length!==1+Number(s.activeBuild.engineerUsed===true)) ||
    s.buildBonuses.length>0 && s.pending?.kind!=='BUILD_BONUS' && s.pending?.kind!=='REWARD' ||
    s.buildBonuses.length>0 && s.activeBuild===null ||
    s.activeBuild!==null && s.pending!==null && s.pending.kind!=='BUILD_BONUS' && s.pending.kind!=='REWARD' && s.pending.kind!=='EFFECT' ||
    s.pending?.kind==='DRAW_PICK' && (s.progress.stage!=='ACTION'||!s.actions.find(a=>a.kind==='CARDS')!.upgraded)) throw new Error('Invalid Ark active action.');
  assertArkAssociation(s);
  if (s.partners.some(p=>!ARK_CONTINENTS.some(c=>c===p)) || s.activeAssociation && (s.progress.stage!=='ACTION'||s.activeBuild!==null||!['REWARD','EFFECT'].includes(s.pending?.kind??'')&&!(s.pending===null&&s.associationWork?.upgraded)) ||
    s.pending?.kind==='REWARD'&&s.rewards.length===0 || s.rewards.length>0&&!['REWARD','EFFECT'].includes(s.pending?.kind??'') ||
    s.rewards.length>0 && !s.activeBuild && !s.activeAssociation ||
    new Set(s.rewards.map(r=>r.id)).size!==s.rewards.length ||
    s.reputation>9&&!s.actions.find(a=>a.kind==='CARDS')!.upgraded ||
    JSON.stringify([...s.partnerSupply].sort())!==JSON.stringify(ARK_CONTINENTS.filter(c=>!s.partners.includes(c)).sort()) ||
    JSON.stringify([...s.universitySupply].sort())!==JSON.stringify(ARK_UNIVERSITIES.filter(u=>!s.universities.includes(u)).sort())) throw new Error('Invalid Ark reward state.');
  if (s.activeBuild) {
    const build=s.activeBuild, placed=s.buildings.slice(-build.builtKinds.length);
    if (placed.some((b,index)=>b.kind!==build.builtKinds[index]) ||
      build.remaining+placed.reduce((sum,b,index)=>sum+(build.builtKinds.indexOf(b.kind)<index?0:b.cells.length),0)>s.actions.findIndex(a=>a.kind==='BUILD')+6 ||
      build.builtKinds.some((kind,index)=>build.builtKinds.indexOf(kind)<index&&['PettingZoo','ReptileHouse','LargeBirdAviary'].includes(kind))||
      build.upgraded&&!s.actions.find(a=>a.kind==='BUILD')!.upgraded) throw new Error('Invalid Ark build continuation.');
  }
  const expectedDonations = s.progress.stage === 'BREAK' ? s.progress.round : s.progress.round - 1;
  if (s.donations.length !== Math.min(7,expectedDonations+s.donationsMade) || s.donations.some((space,index)=>space!==index) ||
    s.progress.stage !== 'SETUP' && s.revision < s.progress.turnsCompleted + 1 ||
    s.progress.stage !== 'BREAK' && s.breakStep !== (s.progress.round === 1 ? 'NOT_STARTED' : 'COMPLETE')) {
    throw new Error('Invalid Ark round state.');
  }
  if (s.result !== null) {
    const expected = calculateArkSoloFinalScore({universities:s.universities,x:s.x,played:s.played,buildings:s.buildings,universityResearch:arkUniversityResearch(s.universities),supportedProjects:s.supportedProjects,
      reputation:s.reputation,appeal:Math.min(113,ARK_SOLO_STARTING_APPEAL[s.difficulty]+s.extraAppeal),conservation:s.associationConservation,partners:s.partners,goals:s.goals});
    if (JSON.stringify(s.result) !== JSON.stringify(expected)) throw new Error('Invalid Ark final score.');
  }
  return s;
}

export function createArkSoloGame(input: Parameters<typeof createArkSoloSetup>[0] & Readonly<{now:ServerTime; transitionId:TurnId}>): ArkSoloState {
  const setup = createArkSoloSetup(input);
  return parseArkSoloState({...setup,phase:'PLAYING',startedAt:input.now,finishedAt:null,transitionId:input.transitionId,
    activatedProjectBonuses:[],projectSupports:[],repeatedAction:null,extraActions:[],legacyAfterFinishing:null,played:[],playedProjects:[],pouched:{},sponsorTokens:{},effects:createArkEffectQueue(),zooWork:null,cardReveal:null,goalReveal:null,
    conservationBonuses:createArkConservationBonuses(input.random),wazaFocus:null,supportedProjects:0,resistanceGained:0,goalDiscarded:false,
    associationWork:null,donationsMade:0,activeAssociation:false,rewards:[],associationConservation:0,extraWorkers:0,upgradeCount:0,extraAppeal:0,reputationGained:0,
    activeBuild:null,buildBonuses:[],pending:null,result:null,breakStep:'NOT_STARTED',donations:[],busyWorkers:0,taskWorkers:{},partners:[],
    partnerSupply:['Africa','Americas','Asia','Australia','Europe'],universities:[],universitySupply:[...ARK_UNIVERSITIES]});
}

function finishTurn(s: ArkSoloState, nextChoice: TurnId): void {
  if (s.repeatedAction || s.activeBuild || s.buildBonuses.length || s.pending || s.activeAssociation || s.rewards.length || s.zooWork || s.legacyAfterFinishing || arkEffectsPending(s.effects)) throw new Error('Unresolved Ark action.');
  const parent=s.extraActions.pop();
  if(parent) {
    if(!parent.started)throw new Error('Ark extra action was not started.');
    s.effects=parent.effects;s.zooWork=parent.zooWork;s.legacyAfterFinishing=parent.legacyAfterFinishing;
    resumeEffects(s,nextChoice);return;
  }
  replenishArkDisplay(s);
  const next = finishArkSoloTurn(s.progress, 0);
  if (!next.ok) throw new Error('Cannot finish Ark action.');
  s.progress = next.progress;
  if (s.progress.stage === 'BREAK') {
    s.breakStep = 'NOT_STARTED';
    const started = beginArkSoloBreak(s);
    if (!started.ok) throw new Error('Cannot start Ark break.');
    Object.assign(s, started.state);
    const count = Math.max(0, s.hand.length - (s.universities.includes('HAND_LIMIT')?5:3));
    if (count > 0) s.pending = {kind:'BREAK_DISCARD',choiceId:nextChoice,count};
    else finishBreak(s, [],nextChoice);
  } else if (s.progress.stage === 'FINAL_SCORING') {
    s.pending = s.goalDiscarded?null:{kind:'FINAL_GOAL',choiceId:nextChoice};
  }
}

function finishBreak(s:ArkSoloState,discarded:string[],next:TurnId):boolean {
  const result=resolveArkSoloBreakDiscard(s,{discard:discarded});if(!result.ok)return false;
  Object.assign(s,result.state);s.pending=null;
  s.effects=enqueueArkEffects(createArkEffectQueue(),[...arkSponsorIncome(s),...arkProjectBonusIncome(s.activatedProjectBonuses)]);
  resumeEffects(s,next);return true;
}
function finalize(s:ArkSoloState,now:ServerTime):void {
  const result=calculateArkSoloFinalScore({...s,universityResearch:arkUniversityResearch(s.universities)});
  const finished=completeArkSoloScoring(s.progress,result.total);if(!finished.ok)throw new Error('Unresolved Ark scoring.');
  s.result={...result,details:result.details.map(d=>({...d}))};s.appeal=result.appeal;s.conservation=result.conservation;
  s.progress=finished.progress;s.pending=null;s.phase='FINISHED';s.finishedAt=now;
}
function resumeEffects(s:ArkSoloState,next:TurnId):void {
  if(s.progress.stage==='BREAK'&&!arkEffectsPending(s.effects)&&s.effects.afterFinishing.length)s.effects=beginArkAfterFinishing(s.effects);
  if(arkEffectsPending(s.effects)){s.pending={kind:'EFFECT',choiceId:next};return;}
  s.pending=null;
  if(s.zooWork) {
    if(s.zooWork.stage==='AFTER_FINISHING') {
      const done=completeArkZooWork(s);if(!done.ok)throw new Error('Unresolved Ark zoo action.');Object.assign(s,done.state);finishTurn(s,next);
    }
  } else if(s.legacyAfterFinishing) {
    s.legacyAfterFinishing=null;finishTurn(s,next);
  } else if(s.progress.stage==='BREAK') {
    replenishArkDisplay(s);
    const finished=completeArkSoloBreak(s,0);if(!finished.ok)throw new Error('Unresolved Ark income.');Object.assign(s,finished.state);
  } else if(s.activeBuild)finishBuild(s,next);
  else if(s.activeAssociation)finishAssociation(s,next);
}

function finishRepeatedAction(s:ArkSoloState,next:TurnId):void {
  const repeated=s.repeatedAction;if(!repeated)throw new Error('Missing Ark repeated action.');
  const kind=repeated.action;s.effects=repeated.deferred;s.repeatedAction=null;
  finishLegacyAction(s,kind,next);
}
function finishLegacyAction(s:ArkSoloState,kind:ArkActionKind,next:TurnId):void {
  s.pending=null;
  const repeated=s.repeatedAction;
  if(repeated) {
    if(repeated.action!==kind||repeated.awaiting||arkEffectsPending(s.effects))throw new Error('Invalid Ark repeated completion.');
    repeated.deferred=enqueueArkEffects(repeated.deferred,s.effects.afterFinishing.map(j=>({sourceId:j.sourceId,effect:j.effect,timing:'AFTER_FINISHING'})));
    s.effects=createArkEffectQueue();repeated.completed++;
    if(repeated.remaining>1){repeated.remaining--;repeated.awaiting=true;return;}
    finishRepeatedAction(s,next);return;
  }
  s.actions=finishArkAction(s.actions,kind);
  if(s.effects.afterFinishing.length) {
    s.effects=beginArkAfterFinishing(s.effects);s.legacyAfterFinishing=kind;resumeEffects(s,next);
  } else finishTurn(s,next);
}
function finishBuild(s:ArkSoloState,next:TurnId):void {
  if(arkEffectsPending(s.effects)){s.pending={kind:'EFFECT',choiceId:next};return;}
  if (s.rewards.length) {s.pending={kind:'REWARD',choiceId:next};return;}
  if (s.buildBonuses.length) { s.pending={kind:'BUILD_BONUS',choiceId:next}; return; }
  s.pending=null;
  const active=s.activeBuild;
  if (!active) throw new Error('Missing build action.');
  if (canContinueArkBuild(s.buildings,s.money,active.remaining,active.builtKinds,active.upgraded,!active.engineerUsed&&s.played.some(c=>c.key==='217'),s.played.some(c=>c.key==='219'))) return;
  s.activeBuild=null;finishLegacyAction(s,'BUILD',next);
}
function placeBuilding(s:ArkSoloState,input:v.InferOutput<typeof ArkPlacementSchema>,next:TurnId):boolean {
  const active=s.activeBuild; if (!active) return false;
  const result=validateArkConstruction({buildings:s.buildings,money:s.money,remainingStrength:active.remaining,upgraded:active.upgraded,builtKinds:active.builtKinds,engineerAvailable:!active.engineerUsed&&s.played.some(c=>c.key==='217'),ignoreTerrain:s.played.some(c=>c.key==='219')},input);
  if (!result.ok) return false;
  const building={...result.building,id:`building:${next}`};
  if (s.buildings.some(b=>b.id===building.id)) return false;
  s.money-=result.cost;
  const special=building.kind==='LargeBirdAviary'||building.kind==='ReptileHouse';
  const queued=special||s.played.some(c=>['221','241','242'].includes(c.key));
  const buildingEffects=queued?arkNewBuildingEffects(s.buildings,building,s.played):[];
  const beforeAppeal=arkConstructionAppeal(s.buildings);s.buildings.push(building);
  active.remaining-=result.strengthCost;active.engineerUsed=active.engineerUsed===true||result.engineer; active.builtKinds.push(building.kind);
  if(queued) {
    const batch:ArkEffectBatch[]=buildingEffects.map(effect=>({sourceId:building.id,effect,timing:'IMMEDIATE'}));
    if(special)batch.push({sourceId:building.id,effect:{kind:'MOVE_TO_SPECIAL',buildingId:building.id,moved:[]},timing:'IMMEDIATE'});
    s.effects=enqueueArkEffects(s.effects,batch);
  } else {
    s.extraAppeal+=arkConstructionAppeal(s.buildings)-beforeAppeal;
    s.buildBonuses.push(...arkPlacementBonuses(building));
    s.appeal=Math.min(113,ARK_SOLO_STARTING_APPEAL[s.difficulty]+s.extraAppeal);
  }
  finishBuild(s,next); return true;
}
function pickCard(s:ArkSoloState,cardId:string|null):boolean {
  if (cardId!==null) return takeArkDisplayCard(s,cardId,arkReputationRange(s.reputation));
  if (!s.zooDeck.length) return false;
  drawArkCards(s,1); return true;
}

function queueAssociationRewards(s:ArkSoloState,previous:ReturnType<typeof arkZooIcons>,rewards:ArkReward[],effects:ArkEffectBatch[]=[]):void {
  const after=arkZooIcons(s.played,s.partners,s.universities);
  const added=Object.fromEntries(Object.entries(after).map(([tag,n])=>[tag,n-(previous[tag]??0)]));
  const triggers=arkSponsorIconTriggers(s,added,previous);
  if(triggers.length>0||effects.length>0) {
    // Printed/slot rewards and icon triggers belong to the same choice window.
    const batch:ArkEffectBatch[]=rewards.map(reward=>({sourceId:reward.id,timing:'IMMEDIATE',effect:
      reward.kind==='CARD'?{kind:'CARD_PICK',amount:reward.amount}:
      reward.kind==='UPGRADE'||reward.kind==='UPGRADE_OR_WORKER'?{kind:reward.kind}:
      {kind:'GAIN',resource:reward.kind,amount:reward.amount}}));
    s.effects=enqueueArkEffects(s.effects,[...batch,...effects,...triggers]);
  } else s.rewards.push(...rewards);
}
function finishAssociation(s:ArkSoloState,next:TurnId):void {
  if(arkEffectsPending(s.effects)){s.pending={kind:'EFFECT',choiceId:next};return;}
  if (s.rewards.length) {s.pending={kind:'REWARD',choiceId:next};return;}
  s.pending=null;
  if(s.associationWork?.upgraded)return;
  s.activeAssociation=false;s.associationWork=null;finishLegacyAction(s,'ASSOCIATION',next);
}
function resumeReward(s:ArkSoloState,next:TurnId):void {
  if (s.activeBuild) finishBuild(s,next);
  else if (s.activeAssociation) finishAssociation(s,next);
  else throw new Error('Missing reward continuation.');
}
function gainReputation(s:ArkSoloState,amount:number,id:string):void {
  const result=arkReputationAdvance(s.reputation,amount,s.actions,id);
  s.reputationGained+=result.reputation-s.reputation;s.reputation=result.reputation;
  s.extraAppeal+=result.appeal;s.appeal=Math.min(113,s.appeal+result.appeal);s.rewards.push(...result.rewards);
}

export type ArkSoloApplied = {ok:true;state:ArkSoloState} | {ok:false;reason:'UNAUTHORIZED'|'STALE_REVISION'|'INVALID_PHASE'|'INVALID_ACTION'};
export function applyArkSoloCommand(current: ArkSoloState, actor: PlayerId, expectedRevision: number, input: unknown, now: ServerTime, nextTransition: TurnId, random?:RandomSource): ArkSoloApplied {
  if (actor !== current.playerId) return {ok:false,reason:'UNAUTHORIZED'};
  if (expectedRevision !== current.revision) return {ok:false,reason:'STALE_REVISION'};
  if (current.phase !== 'PLAYING') return {ok:false,reason:'INVALID_PHASE'};
  const parsed = v.safeParse(ArkSoloCommandSchema,input);
  if (!parsed.success) return {ok:false,reason:'INVALID_ACTION'};
  const a = parsed.output, s = parseArkSoloState(current), invalid = ():ArkSoloApplied=>({ok:false,reason:'INVALID_ACTION'});
  if (now < s.startedAt) return invalid();
  const startingKind=a.kind==='BEGIN_ZOO'?a.action:a.kind==='TAKE_X'?a.action:a.kind==='FUNDRAISE'?'SPONSORS':
    a.kind==='DRAW'||a.kind==='SNAP'?'CARDS':a.kind==='BUILD'?'BUILD':a.kind==='ASSOCIATION'?'ASSOCIATION':null;
  if(s.repeatedAction?.awaiting&&startingKind===null&&a.kind!=='END_REPEAT')return invalid();
  if(startingKind!==null) {
    if(s.pending||s.activeBuild||s.activeAssociation||s.zooWork||s.legacyAfterFinishing)return invalid();
    const mode=a.kind==='TAKE_X'?'TAKE_X':'REGULAR';
    if(s.repeatedAction) {
      if(!s.repeatedAction.awaiting||s.repeatedAction.action!==startingKind||s.repeatedAction.mode!==mode)return invalid();
      s.repeatedAction.awaiting=false;
    } else {
      const card=s.actions.find(c=>c.kind===startingKind)!;
      if(card.multiplier>0) {
        s.repeatedAction={action:startingKind,mode,baseStrength:s.actions.indexOf(card)+1,remaining:card.multiplier+1,completed:0,awaiting:false,deferred:createArkEffectQueue()};
        card.multiplier=0;
      }
    }
    s.effects=createArkEffectQueue();
  }
  const extra=s.extraActions.at(-1);
  if(extra&&!extra.started&&a.kind!=='CANCEL_EXTRA') {
    const requested=a.kind==='BEGIN_ZOO'?a.action:a.kind==='TAKE_X'?'TAKE_X':a.kind==='FUNDRAISE'?'SPONSORS':
      a.kind==='DRAW'||a.kind==='SNAP'?'CARDS':a.kind==='BUILD'?'BUILD':a.kind==='ASSOCIATION'?'ASSOCIATION':null;
    if(requested!==extra.action)return invalid();
    extra.started=true;
  }
  if(a.kind==='END_REPEAT') {
    if(!s.repeatedAction?.awaiting)return invalid();
    finishRepeatedAction(s,nextTransition);
  } else if(a.kind==='CANCEL_EXTRA') {
    if(!extra||extra.started)return invalid();
    s.extraActions.pop();s.effects=extra.effects;s.zooWork=extra.zooWork;s.legacyAfterFinishing=extra.legacyAfterFinishing;
    resumeEffects(s,nextTransition);
  } else if (a.kind === 'INITIAL_HAND') {
    if (s.progress.stage !== 'SETUP') return invalid();
    // Preserve the existing strict initial-hand authentication/inventory checks.
    const setupInput = Object.fromEntries(Object.keys(ArkSoloSetupStateSchema.entries).map(key => [key, Reflect.get(s,key)]));
    const chosen = chooseArkSoloInitialHand(v.parse(ArkSoloSetupStateSchema,setupInput), actor, expectedRevision, {keep:a.keep});
    if (!chosen.ok) return invalid();
    s.hand = chosen.state.hand; s.discarded = chosen.state.discarded;
    const started = startArkSolo(s.progress); if (!started.ok) return invalid(); s.progress = started.progress;
  } else if(a.kind==='BEGIN_ZOO') {
    if(s.progress.stage!=='ACTION'||s.pending||s.activeBuild||s.activeAssociation)return invalid();
    const begun=beginArkZooWork(s,{action:a.action,x:a.x,gainReputation:a.gainReputation},s.repeatedAction?.baseStrength);if(!begun.ok)return invalid();Object.assign(s,begun.state);resumeEffects(s,nextTransition);
  } else if(a.kind==='PLAY_ZOO'||a.kind==='END_ZOO') {
    if(s.progress.stage!=='ACTION'||s.pending||!s.zooWork)return invalid();
    const waza=a.kind==='END_ZOO'?beginArkWazaBonus(s):null;
    if(waza) {Object.assign(s,waza);resumeEffects(s,nextTransition);}
    else if(a.kind==='END_ZOO'&&s.repeatedAction) {
      if(s.zooWork.stage!=='PLAYING')return invalid();
      const kind=s.zooWork.action;s.zooWork=null;finishLegacyAction(s,kind,nextTransition);
    } else {
      const result=a.kind==='PLAY_ZOO'?playNextArkZooCard(s,a.card):endArkZooWork(s);if(!result.ok)return invalid();Object.assign(s,result.state);resumeEffects(s,nextTransition);
    }
  } else if(a.kind==='SELECT_EFFECT') {
    if(s.pending?.kind!=='EFFECT'||s.pending.choiceId!==a.choiceId||s.effects.active)return invalid();
    const selected=selectArkEffect(s.effects,a.effectId);if(!selected.ok)return invalid();s.effects=selected.queue;resumeEffects(s,nextTransition);
  } else if(a.kind==='EFFECT') {
    if(s.pending?.kind!=='EFFECT'||s.pending.choiceId!==a.choiceId)return invalid();
    if(!s.effects.active){const selected=selectArkEffect(s.effects,a.effectId);if(!selected.ok)return invalid();s.effects=selected.queue;}
    const job=s.effects.active;if(!job||job.id!==a.effectId||job.effect.kind==='SCAVENGING'&&!random)return invalid();
    if(job.effect.kind==='EXTRA_ACTION') {
      if(s.effects.stage!=='AFTER_FINISHING'||s.progress.stage!=='ACTION'||(!s.zooWork&&!s.legacyAfterFinishing))return invalid();
      if(a.selection.kind!=='ACTION'&&a.selection.kind!=='SKIP')return invalid();
      if(a.selection.kind==='ACTION'&&job.effect.action!==null&&a.selection.action!==job.effect.action)return invalid();
      const completed=completeArkEffect(s.effects,job.id);
      if(a.selection.kind==='SKIP'){s.effects=completed;resumeEffects(s,nextTransition);}
      else {
        s.extraActions.push({action:a.selection.action,started:false,effects:completed,zooWork:s.zooWork,legacyAfterFinishing:s.legacyAfterFinishing});
        s.effects=createArkEffectQueue();s.zooWork=null;s.legacyAfterFinishing=null;s.pending=null;
      }
    } else {
    const before={appeal:s.appeal,conservation:s.conservation,reputation:s.reputation,workers:s.workers,goals:s.goals.length};
    const resolved=resolveArkEffect(s,a.effectId,a.selection,nextTransition,random??{nextInt:()=>{throw new Error('Missing Ark random source.');}});if(!resolved.ok)return invalid();
    Object.assign(s,resolved.state);s.extraAppeal+=s.appeal-before.appeal;s.associationConservation+=s.conservation-before.conservation;
    s.reputationGained+=s.reputation-before.reputation;s.extraWorkers+=s.workers-before.workers;s.upgradeCount=s.actions.filter(c=>c.upgraded).length;
    if(job.effect.kind==='RESISTANCE'&&s.goals.length>before.goals)s.resistanceGained++;
    if(job.effect.kind==='DISCARD_GOAL'&&s.goals.length<before.goals)s.goalDiscarded=true;
    resumeEffects(s,nextTransition);
    }
  } else if(a.kind==='ASSOCIATION_MORE'||a.kind==='DONATE'||a.kind==='END_ASSOCIATION') {
    if(!s.activeAssociation||!s.associationWork?.upgraded||s.pending)return invalid();
    if(a.kind==='END_ASSOCIATION') {
      s.associationWork=null;s.activeAssociation=false;finishLegacyAction(s,'ASSOCIATION',nextTransition);
    } else {
      const previous=arkZooIcons(s.played,s.partners,s.universities),beforeAppeal=s.appeal;
      const work=a.kind==='DONATE'?donateArkAssociationWork(s,s.associationWork,nextTransition,0):continueArkAssociationWork(s,s.associationWork,a.task,nextTransition,0);
      if(!work.ok)return invalid();Object.assign(s,work.state);s.extraAppeal+=s.appeal-beforeAppeal;s.associationWork=work.work;
      if(a.kind==='DONATE')s.donationsMade++;
      queueAssociationRewards(s,previous,work.rewards,work.effects);finishAssociation(s,nextTransition);
    }
  } else if (a.kind==='REWARD') {
    if (s.pending?.kind!=='REWARD'||s.pending.choiceId!==a.choiceId) return invalid();
    const index=s.rewards.findIndex(r=>r.id===a.rewardId),reward=s.rewards[index];if (!reward) return invalid();
    if (reward.kind==='CARD') {
      if (a.selection.kind!=='CARD'||!pickCard(s,a.selection.cardId)) return invalid();
      if (reward.amount>1) {reward.amount--;resumeReward(s,nextTransition);s.revision=v.parse(GameRevisionSchema,s.revision+1);s.transitionId=nextTransition;return {ok:true,state:parseArkSoloState(s)};}
    } else if (reward.kind==='UPGRADE'||reward.kind==='UPGRADE_OR_WORKER') {
      if (a.selection.kind==='UPGRADE') {
        const kind=a.selection.action,card=s.actions.find(c=>c.kind===kind)!;
        if (card.upgraded) return invalid();card.upgraded=true;s.upgradeCount++;
      } else if (reward.kind==='UPGRADE_OR_WORKER'&&a.selection.kind==='WORKER'&&s.workers<4) {s.workers++;s.extraWorkers++;}
      else return invalid();
    } else {
      if (a.selection.kind!=='NONE') return invalid();
      if (reward.kind==='REPUTATION') gainReputation(s,reward.amount,nextTransition);
      if (reward.kind==='WORKER') {const gained=Math.min(reward.amount,4-s.workers);s.workers+=gained;s.extraWorkers+=gained;}
      if (reward.kind==='X') s.x=Math.min(5,s.x+reward.amount);
      if (reward.kind==='CONSERVATION') {
        s.effects=enqueueArkEffects(s.effects,[{sourceId:reward.id,effect:{kind:'GAIN',resource:'CONSERVATION',amount:reward.amount},timing:'IMMEDIATE'}]);
      }
    }
    s.rewards.splice(index,1);resumeReward(s,nextTransition);
  } else if (a.kind === 'BUILD_BONUS') {
    if (s.pending?.kind!=='BUILD_BONUS'||s.pending.choiceId!==a.choiceId||!s.activeBuild) return invalid();
    const index=s.buildBonuses.findIndex(b=>b.id===a.bonusId), bonus=s.buildBonuses[index];
    if (!bonus) return invalid();
    if (bonus.kind==='CARD_1') {
      if (a.selection.kind!=='CARD'||!pickCard(s,a.selection.cardId)) return invalid();
    } else if (bonus.kind==='UPGRADE') {
      if (a.selection.kind!=='UPGRADE') return invalid();
      const kind=a.selection.action, card=s.actions.find(c=>c.kind===kind)!;
      if (card.upgraded) return invalid(); card.upgraded=true;s.upgradeCount++;
    } else {
      if (a.selection.kind!=='NONE') return invalid();
      if (bonus.kind==='MONEY_5') s.money+=5;
      if (bonus.kind==='MONEY_10') s.money+=10;
      if (bonus.kind==='X_1') s.x=Math.min(5,s.x+1);
      if (bonus.kind==='WORKER') {const gained=Math.min(1,4-s.workers);s.workers+=gained;s.extraWorkers+=gained;}
      if (bonus.kind==='REPUTATION_2') {
        gainReputation(s,2,nextTransition);
      }
    }
    s.buildBonuses.splice(index,1); finishBuild(s,nextTransition);
  } else if (a.kind==='BUILD_MORE'||a.kind==='END_BUILD') {
    if (!s.activeBuild||s.pending||s.buildBonuses.length) return invalid();
    if (a.kind==='BUILD_MORE') { if (!placeBuilding(s,a.placement,nextTransition)) return invalid(); }
    else { s.activeBuild=null;finishLegacyAction(s,'BUILD',nextTransition); }
  } else if (a.kind==='PICK_CARD') {
    if (s.pending?.kind!=='DRAW_PICK'||s.pending.choiceId!==a.choiceId||!pickCard(s,a.cardId)) return invalid();
    const pending=s.pending;
    if (pending.remaining>1) s.pending={...pending,remaining:pending.remaining-1,choiceId:nextTransition};
    else if (pending.discard) s.pending={kind:'DRAW_DISCARD',count:1,choiceId:nextTransition};
    else { s.pending=null; finishLegacyAction(s,'CARDS',nextTransition); }
  } else if (a.kind === 'DISCARD') {
    const pending = s.pending;
    if (!pending || pending.choiceId !== a.choiceId) return invalid();
    if (pending.kind === 'BREAK_DISCARD') { if (!finishBreak(s,a.cards,nextTransition)) return invalid(); }
    else if (pending.kind === 'DRAW_DISCARD') {
      if (!discardArkHand(s,a.cards,pending.count)) return invalid();
      s.pending = null; finishLegacyAction(s,'CARDS',nextTransition);
    } else return invalid();
  } else if (a.kind === 'FINAL_GOAL') {
    if(s.pending?.kind!=='FINAL_GOAL'||s.pending.choiceId!==a.choiceId||s.goalDiscarded||s.goals.length<2)return invalid();
    const index=s.goals.findIndex(c=>c.cardId===a.discard);if(index<0)return invalid();
    s.discardedGoals.push(...s.goals.splice(index,1));s.goalDiscarded=true;finalize(s,now);
  } else {
    if (s.progress.stage !== 'ACTION' || s.pending || s.activeBuild || s.activeAssociation || s.zooWork) return invalid();
    if (a.kind === 'TAKE_X') {
      const result = takeArkXToken(s.actions,a.action,s.x); if (!result.ok) return invalid();
      s.x = result.x; finishLegacyAction(s,a.action,nextTransition);
    } else {
      const kind = a.kind === 'FUNDRAISE' ? 'SPONSORS' : a.kind==='BUILD' ? 'BUILD' : a.kind==='ASSOCIATION' ? 'ASSOCIATION' : 'CARDS';
      const action = startArkAction(s.actions,kind,s.x,a.x,s.repeatedAction?.baseStrength); if (!action.ok) return invalid();
      if (a.kind!=='ASSOCIATION') s.x = action.xRemaining;
      if (a.kind==='ASSOCIATION') {
        const previous=arkZooIcons(s.played,s.partners,s.universities),beforeAppeal=s.appeal;
        const work=startArkAssociationWork(s,a.x,a.task,nextTransition,s.repeatedAction?.baseStrength);if (!work.ok) return invalid();
        Object.assign(s,work.state);s.extraAppeal+=s.appeal-beforeAppeal;
        s.activeAssociation=true;s.associationWork=work.work;
        queueAssociationRewards(s,previous,work.rewards,work.effects);
        finishAssociation(s,nextTransition);
      } else if (a.kind==='BUILD') {
        s.effects=createArkEffectQueue();
        s.activeBuild={remaining:action.strength,upgraded:action.upgraded,builtKinds:[]};
        if (!placeBuilding(s,a.placement,nextTransition)) return invalid();
      } else if (a.kind === 'FUNDRAISE') {
        s.money += action.strength*(action.upgraded?2:1);
        finishLegacyAction(s,kind,nextTransition);
      } else if (a.kind === 'SNAP') {
        if (action.strength < (action.upgraded?3:5) || !takeArkDisplayCard(s,a.cardId,6)) return invalid();
        finishLegacyAction(s,kind,nextTransition);
      } else {
        const strength = Math.min(5,action.strength);
        const draw = (action.upgraded?[1,2,2,3,4]:[1,1,2,2,3])[strength-1]!, discard = (action.upgraded?[0,1,0,1,1]:[1,0,1,0,1])[strength-1]!;
        if (action.upgraded) {
          if (s.zooDeck.length+s.display.filter((c,i)=>c!==null&&i<arkReputationRange(s.reputation)).length<draw) return invalid();
          s.pending={kind:'DRAW_PICK',choiceId:nextTransition,remaining:draw,discard:discard===1?1:0};
        } else {
        if (s.zooDeck.length < draw) return invalid();
        drawArkCards(s,draw);
        if (discard > 0) s.pending = {kind:'DRAW_DISCARD',choiceId:nextTransition,count:discard};
        else { finishLegacyAction(s,kind,nextTransition); }
        }
      }
    }
  }
  if(s.progress.stage==='FINAL_SCORING'&&s.pending===null&&s.goalDiscarded)finalize(s,now);
  s.revision = v.parse(GameRevisionSchema,s.revision+1); s.transitionId = nextTransition;
  return {ok:true,state:parseArkSoloState(s)};
}

/** Whitelist shared public state and the one owner's private cards. No reserves, deck order or discarded faces. */
export function projectArkSoloGame(s: ArkSoloState, viewer: PlayerId): ArkSoloView {
  if (viewer !== s.playerId) throw new Error('Unauthorized Ark solo viewer.');
  return v.parse(ArkSoloViewSchema,{gameId:s.gameId,playerId:s.playerId,revision:s.revision,transitionId:s.transitionId,phase:s.phase,
    activatedProjectBonuses:s.activatedProjectBonuses,projectSupports:s.projectSupports,playedProjects:s.playedProjects,
    associationWork:s.associationWork,activeAssociation:s.activeAssociation,rewards:s.rewards,partners:s.partners,partnerSupply:s.partnerSupply,universities:s.universities,universitySupply:s.universitySupply,taskWorkers:s.taskWorkers,
    activeBuild:s.activeBuild,buildBonuses:s.buildBonuses,
    repeatedAction:s.repeatedAction?{action:s.repeatedAction.action,mode:s.repeatedAction.mode,baseStrength:s.repeatedAction.baseStrength,remaining:s.repeatedAction.remaining,completed:s.repeatedAction.completed,awaiting:s.repeatedAction.awaiting}:null,
    extraAction:s.extraActions.length?{action:s.extraActions.at(-1)!.action,started:s.extraActions.at(-1)!.started,depth:s.extraActions.length}:null,
    wazaFocus:s.wazaFocus,zooWork:s.zooWork,played:s.played,sponsorTokens:s.sponsorTokens,pouchedCounts:Object.fromEntries(Object.entries(s.pouched).map(([id,cards])=>[id,cards.length])),
    effectOptions:(s.effects.active?[]:s.effects.frames.at(-1)??[]).map(j=>({id:j.id,kind:j.effect.kind,sourceId:j.sourceId,guide:projectArkEffectGuide(j.effect,s.actions,s.conservationBonuses)})),
    activeEffect:s.effects.active?{id:s.effects.active.id,kind:s.effects.active.effect.kind,sourceId:s.effects.active.sourceId,guide:projectArkEffectGuide(s.effects.active.effect,s.actions,s.conservationBonuses)}:null,
    revealedCards:s.goalReveal?{...s.goalReveal,kind:'RESISTANCE',keep:1}:s.cardReveal,
    reserveChoices:s.effects.active?.effect.kind==='ASSERTION'?s.baseProjectReserve:s.effects.active?.effect.kind==='DOMINANCE'?s.baseProjectReserve.filter(c=>c.key==='108'):[],
    startedAt:s.startedAt,finishedAt:s.finishedAt,workers:s.workers,busyWorkers:s.busyWorkers,
    difficulty:s.difficulty,progress:s.progress,pending:s.pending,result:s.result,money:s.money,appeal:s.appeal,
    conservation:s.conservation,reputation:s.reputation,x:s.x,actions:s.actions,buildings:s.buildings,
    hand:s.hand,goals:s.goals,baseProjects:s.baseProjects,donations:s.donations,
    display:s.progress.stage==='SETUP'?Array.from({length:6},()=>null):s.display,
    deckCount:s.zooDeck.length,discardCount:s.discarded.length});
}
