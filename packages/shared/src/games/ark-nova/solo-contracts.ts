import {ArkHistorySchema} from './history.js';
import { arkProjectSupportsAreConsistent, ArkActivatedProjectBonusesSchema, ArkProjectSupportRecordSchema } from './project-contracts.js';
import { ArkEffectGuideSchema, ArkRepeatedActionSchema, ArkExtraActionKindSchema, ArkZooWorkSchema } from './effect-contracts.js';
import * as v from 'valibot';
import { ArkAssociationWorkSchema, ArkRewardSchema, ArkUniversitySchema } from './association.js';
import { ArkActiveBuildSchema, ArkBuildBonusSchema } from './build.js';
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from '../../identifiers.js';
import { GameRevisionSchema, ServerTimeSchema } from '../../protocol.js';
import { ArkActionKindSchema, ArkActionCardSchema, ArkBuildingSchema, ArkCardSchema, ArkCountSchema, ArkRefSchema } from './actions.js';
import { ArkSoloDifficultySchema, ArkSoloProgressSchema, arkSoloProgressIsConsistent } from './solo.js';

export const ArkSoloPendingSchema = v.nullable(v.variant('kind', [
  v.strictObject({kind:v.literal('EFFECT'),choiceId:ArkRefSchema}),
  v.strictObject({kind:v.literal('DRAW_DISCARD'), choiceId:ArkRefSchema, count:v.pipe(ArkCountSchema,v.minValue(1))}),
  v.strictObject({kind:v.literal('BREAK_DISCARD'), choiceId:ArkRefSchema, count:v.pipe(ArkCountSchema,v.minValue(1))}),
  v.strictObject({kind:v.literal('REWARD'),choiceId:ArkRefSchema}),
  v.strictObject({kind:v.literal('BUILD_BONUS'),choiceId:ArkRefSchema}),
  v.strictObject({kind:v.literal('DRAW_PICK'),choiceId:ArkRefSchema,remaining:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(4)),discard:v.picklist([0,1])}),
  v.strictObject({kind:v.literal('FINAL_GOAL'), choiceId:ArkRefSchema}),
]));
export const ArkSoloResultSchema = v.strictObject({
  appeal:v.pipe(ArkCountSchema,v.maxValue(113)), conservation:v.pipe(ArkCountSchema,v.maxValue(41)),
  goalPoints:ArkCountSchema, sponsorPoints:ArkCountSchema, sponsorAppeal:ArkCountSchema,
  total:v.pipe(v.number(),v.safeInteger()), won:v.boolean(),
  details:v.array(v.strictObject({cardId:ArkRefSchema,conservation:ArkCountSchema,appeal:ArkCountSchema})),
});
const cards = v.pipe(v.array(ArkCardSchema),v.maxLength(250));
/** Solo command-loop projection. The platform registration uses this contract once all actions are connected. */
export const ArkSoloViewSchema = v.pipe(v.strictObject({
  table:v.optional(v.strictObject({
    notice:v.optional(v.nullable(v.string())),
    stage:v.picklist(['SETUP','ACTION','BREAK','GOAL_DISCARD','INTERACTION','FINAL_SCORING','FINISHED']),
    interaction:v.optional(v.nullable(v.strictObject({ownerId:PlayerIdSchema,targetId:PlayerIdSchema}))),
    borrowed:v.optional(v.nullable(v.strictObject({targetId:PlayerIdSchema,action:ArkActionKindSchema,strength:ArkCountSchema}))),
    activePlayerId:PlayerIdSchema,breakPosition:ArkCountSchema,breakLimit:v.picklist([9,12,15]),breakNumber:ArkCountSchema,
    readyPlayerIds:v.array(PlayerIdSchema),finalTurns:v.nullable(v.array(PlayerIdSchema)),winners:v.array(PlayerIdSchema),
    occupiedProjects:v.array(v.strictObject({cardId:ArkRefSchema,slot:v.picklist([0,1,2]),playerId:v.nullable(PlayerIdSchema)})),
    players:v.pipe(v.array(v.strictObject({playerId:PlayerIdSchema,money:ArkCountSchema,appeal:ArkCountSchema,conservation:ArkCountSchema,reputation:ArkCountSchema,x:ArkCountSchema,workers:ArkCountSchema,busyWorkers:ArkCountSchema,handCount:ArkCountSchema,goalCount:ArkCountSchema,played:cards,buildings:v.array(ArkBuildingSchema),actions:v.array(ArkActionCardSchema),partners:v.array(ArkRefSchema),universities:v.array(ArkUniversitySchema),supportedProjects:ArkCountSchema,total:v.nullable(v.pipe(v.number(),v.safeInteger()))})),v.minLength(2),v.maxLength(4)),
  })),
  history:v.optional(ArkHistorySchema,()=>[]),
  /** Public board information only; effect jobs and private decks remain server-side. */
  scoreBoard:v.optional(v.strictObject({
    targetAppeal:v.pipe(v.number(),v.safeInteger(),v.minValue(1),v.maxValue(114)),
    gap:v.pipe(v.number(),v.safeInteger()),
    bonuses:v.array(v.strictObject({track:v.picklist([5,8]),tile:ArkRefSchema})),
    pendingMilestones:v.array(v.picklist([2,5,8,10])),
    choices:v.optional(v.array(v.strictObject({track:v.picklist([2,5,8,10]),choice:ArkRefSchema})),()=>[]),
    appealIncome:v.pipe(v.array(ArkCountSchema),v.length(114)),
  })),
  gameId:GameIdSchema, playerId:PlayerIdSchema, revision:GameRevisionSchema, transitionId:TurnIdSchema,
  phase:v.picklist(['PLAYING','FINISHED']), startedAt:ServerTimeSchema, finishedAt:v.nullable(ServerTimeSchema),
  difficulty:ArkSoloDifficultySchema, progress:ArkSoloProgressSchema,
  activatedProjectBonuses:ArkActivatedProjectBonusesSchema,projectSupports:v.pipe(v.array(ArkProjectSupportRecordSchema),v.maxLength(7)),playedProjects:v.pipe(cards,v.maxLength(4)),
  associationWork:v.nullable(ArkAssociationWorkSchema),
  activeAssociation:v.boolean(), rewards:v.array(ArkRewardSchema),
  partners:v.array(ArkRefSchema),partnerSupply:v.array(ArkRefSchema),universities:v.array(ArkUniversitySchema),universitySupply:v.array(ArkUniversitySchema),
  taskWorkers:v.record(ArkRefSchema,ArkCountSchema),
  activeBuild:ArkActiveBuildSchema, buildBonuses:v.array(ArkBuildBonusSchema),
  repeatedAction:v.nullable(ArkRepeatedActionSchema),
  extraAction:v.nullable(v.strictObject({action:ArkExtraActionKindSchema,started:v.boolean(),depth:v.pipe(ArkCountSchema,v.minValue(1))})),
  wazaFocus:v.optional(v.nullable(v.picklist(['SMALL','LARGE']))),zooWork:v.nullable(ArkZooWorkSchema),played:cards,pouchedCounts:v.record(ArkRefSchema,ArkCountSchema),sponsorTokens:v.record(ArkRefSchema,ArkCountSchema),
  effectOptions:v.array(v.strictObject({id:ArkCountSchema,kind:ArkRefSchema,sourceId:ArkRefSchema,guide:ArkEffectGuideSchema})),
  activeEffect:v.nullable(v.strictObject({id:ArkCountSchema,kind:ArkRefSchema,sourceId:ArkRefSchema,guide:ArkEffectGuideSchema})),
  revealedCards:v.nullable(v.strictObject({kind:v.picklist(['HUNTER','SCAVENGING','PERCEPTION','RESISTANCE']),choiceId:ArkRefSchema,candidates:cards,keep:ArkCountSchema})),
  reserveChoices:cards,
  pending:ArkSoloPendingSchema, result:v.nullable(ArkSoloResultSchema),
  money:ArkCountSchema, appeal:v.pipe(ArkCountSchema,v.maxValue(113)), conservation:v.pipe(ArkCountSchema,v.maxValue(41)),
  reputation:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(15)), x:v.pipe(ArkCountSchema,v.maxValue(5)),
  workers:v.pipe(ArkCountSchema,v.minValue(1),v.maxValue(4)), busyWorkers:v.pipe(ArkCountSchema,v.maxValue(4)),
  actions:v.pipe(v.array(ArkActionCardSchema),v.length(5)), buildings:v.pipe(v.array(ArkBuildingSchema),v.maxLength(100)),
  hand:cards, goals:cards, baseProjects:v.pipe(cards,v.minLength(3),v.maxLength(4)),
  donations:v.pipe(v.array(v.pipe(ArkCountSchema,v.maxValue(6))),v.maxLength(7)),
  display:v.pipe(v.array(v.nullable(ArkCardSchema)),v.length(6)), deckCount:ArkCountSchema, discardCount:ArkCountSchema,
}),v.check(s=> {
  const finished = s.phase === 'FINISHED';
  const visible = [...s.hand,...s.goals,...s.played,...s.playedProjects,...(s.revealedCards?.candidates??[]),...s.baseProjects,...s.display.filter(c=>c!==null)];
  const t=s.table;
  if((s.progress.mode==='MULTIPLAYER')!==!!t)return false;
  if(t){const ids=t.players.map(p=>p.playerId),self=t.players.find(p=>p.playerId===s.playerId);
    if(new Set(ids).size!==ids.length||!ids.includes(t.activePlayerId)||!self||self.money!==s.money||self.handCount!==s.hand.length||self.goalCount!==s.goals.length||t.breakLimit!==([9,12,15][ids.length-2])||t.breakPosition>t.breakLimit||(t.stage==='FINISHED')!==finished||[t.readyPlayerIds,t.finalTurns??[],t.winners].some(xs=>new Set(xs).size!==xs.length||xs.some(id=>!ids.includes(id)))||t.occupiedProjects.some(p=>p.playerId!==null&&!ids.includes(p.playerId)))return false;
  }
  return (s.progress.mode==='MULTIPLAYER'||s.baseProjects.length===3&&s.playedProjects.length<=2)&&s.history.every(entry=>entry.revision<=s.revision&&(s.table||entry.turn>=1))&&s.projectSupports.length<=s.activatedProjectBonuses.length&&arkProjectSupportsAreConsistent(s)&&s.activeAssociation===(s.associationWork!==null) && (s.repeatedAction===null||s.progress.stage==='ACTION') && (s.extraAction===null||s.progress.stage==='ACTION'&&(s.extraAction.started||s.pending===null&&s.zooWork===null&&s.activeBuild===null&&!s.activeAssociation)) && arkSoloProgressIsConsistent(s.progress) &&
    finished === (s.progress.stage === 'FINISHED') && finished === (s.result !== null) && finished === (s.finishedAt !== null) &&
    (s.finishedAt === null || s.finishedAt >= s.startedAt) &&
    (!finished || s.pending === null && s.activeBuild === null && s.buildBonuses.length === 0 && !s.activeAssociation && s.rewards.length === 0) && s.busyWorkers <= s.workers &&
    ((s.effectOptions.length>0||s.activeEffect!==null)===(s.pending?.kind==='EFFECT')) &&
    (s.revealedCards===null||s.activeEffect!==null) &&
    (s.zooWork===null||s.progress.stage==='ACTION'&&s.activeBuild===null&&!s.activeAssociation) &&
    (s.phase!=='FINISHED'||s.zooWork===null&&s.activeEffect===null&&s.effectOptions.length===0&&s.revealedCards===null) &&
    new Set(visible.map(c=>c.cardId)).size === visible.length &&
    (s.activeBuild === null || s.progress.stage === 'ACTION') &&
    (!s.activeAssociation || s.progress.stage === 'ACTION' && s.activeBuild === null && (s.pending?.kind === 'REWARD'||s.pending?.kind==='EFFECT'||s.pending===null&&s.associationWork?.upgraded===true)) &&
    (s.pending?.kind!=='REWARD'||s.rewards.length>0) && (s.rewards.length===0||s.pending?.kind==='REWARD'||s.pending?.kind==='EFFECT') &&
    (s.rewards.length === 0 || s.activeBuild !== null || s.activeAssociation) &&
    new Set(s.rewards.map(r=>r.id)).size === s.rewards.length &&
    Object.values(s.taskWorkers).reduce((sum,n)=>sum+n,0) === s.busyWorkers &&
    Object.entries(s.taskWorkers).every(([kind,n])=>['REPUTATION','PARTNER','UNIVERSITY','PROJECT'].includes(kind) && (n===1 || n===3)) &&
    new Set(s.partners).size === s.partners.length && new Set(s.universities).size === s.universities.length &&
    (s.buildBonuses.length === 0 || s.pending?.kind === 'BUILD_BONUS' || (s.pending?.kind === 'REWARD'||s.pending?.kind==='EFFECT'||s.pending===null&&s.associationWork?.upgraded===true)) &&
    new Set(s.actions.map(a=>a.kind)).size === 5 && new Set(s.donations).size === s.donations.length &&
    (s.progress.stage !== 'SETUP' || s.display.every(c=>c===null)) &&
    (s.pending === null || (s.pending.kind === 'FINAL_GOAL' ? s.progress.stage === 'FINAL_SCORING' :
      s.pending.kind === 'REWARD' ? s.progress.stage === 'ACTION' && s.rewards.length > 0 :
      s.pending.kind === 'BUILD_BONUS' ? s.progress.stage === 'ACTION' && s.activeBuild !== null && s.buildBonuses.length > 0 :
      s.pending.kind === 'DRAW_PICK' ? s.progress.stage === 'ACTION' :
      s.pending.kind === 'EFFECT' ? (s.progress.stage === 'ACTION'||s.progress.stage === 'BREAK') && (s.activeEffect!==null||s.effectOptions.length>0) :
      s.pending.count <= s.hand.length && s.progress.stage === (s.pending.kind === 'DRAW_DISCARD' ? 'ACTION' : 'BREAK'))) &&
    (s.result === null || s.result.appeal === s.appeal && s.result.conservation === s.conservation && s.result.won === (s.result.total >= 0));
},'Invalid Ark solo projection.'));
export type ArkSoloView = v.InferOutput<typeof ArkSoloViewSchema>;
