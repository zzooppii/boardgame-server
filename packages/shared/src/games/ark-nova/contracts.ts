import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TurnIdSchema} from '../../identifiers.js';
import {GameRevisionSchema} from '../../protocol.js';
import {ARK_RULES_VERSION,ArkRefSchema as ref,ArkCountSchema as count,ArkCardSchema,ArkBuildingSchema,ArkActionCardSchema,ArkActionKindSchema,ArkOptionSchema} from './actions.js';
export const ArkPlayerViewSchema=v.strictObject({playerId:PlayerIdSchema,money:count,appeal:count,conservation:count,reputation:v.pipe(count,v.maxValue(15)),x:v.pipe(count,v.maxValue(5)),workers:v.pipe(count,v.maxValue(4)),busy:v.pipe(count,v.maxValue(4)),actions:v.pipe(v.array(ArkActionCardSchema),v.length(5)),buildings:v.pipe(v.array(ArkBuildingSchema),v.maxLength(100)),played:v.pipe(v.array(ArkCardSchema),v.maxLength(250)),handCount:v.pipe(count,v.maxValue(250)),partners:v.pipe(v.array(ref),v.maxLength(5)),universities:v.pipe(v.array(ref),v.maxLength(3)),bonuses:v.pipe(v.array(ref),v.maxLength(7)),supported:v.pipe(v.array(ref),v.maxLength(50)),tokens:v.record(ref,count),goalsCount:v.pipe(count,v.maxValue(11))});
export type ArkPlayerView=v.InferOutput<typeof ArkPlayerViewSchema>;
export const ArkPendingViewSchema=v.strictObject({choiceId:ref,playerId:PlayerIdSchema,title:v.pipe(v.string(),v.maxLength(200)),kind:v.picklist(['SELECT','BUILD','DISCARD','SETUP','ORDER']),min:count,max:count,options:v.pipe(v.array(ArkOptionSchema),v.maxLength(300)),buildings:v.pipe(v.array(ref),v.maxLength(50)),optional:v.boolean()});
export type ArkPendingView=v.InferOutput<typeof ArkPendingViewSchema>;
export const ArkProjectViewSchema=v.strictObject({card:ArkCardSchema,base:v.boolean(),claims:v.pipe(v.array(v.strictObject({slot:v.picklist([0,1,2]),playerId:v.nullable(PlayerIdSchema)})),v.maxLength(3))});
export type ArkProjectView=v.InferOutput<typeof ArkProjectViewSchema>;
export const ArkLogSchema=v.strictObject({id:count,playerId:v.nullable(PlayerIdSchema),kind:v.picklist(['SETUP','BUILD','ANIMAL','CARD','SPONSOR','ASSOCIATION','CONSERVATION','BREAK','TURN','CHOICE','FINISH']),text:v.pipe(v.string(),v.maxLength(400))});
export type ArkLog=v.InferOutput<typeof ArkLogSchema>;
export const ArkResultSchema=v.strictObject({reason:v.picklist(['SCORED','CANCELLED']),winnerPlayerIds:v.pipe(v.array(PlayerIdSchema),v.maxLength(4)),scores:v.pipe(v.array(v.strictObject({playerId:PlayerIdSchema,appeal:count,conservation:count,goalPoints:count,total:v.pipe(v.number(),v.safeInteger()),goals:v.pipe(v.array(ref),v.maxLength(11))})),v.maxLength(4))});
export type ArkResult=v.InferOutput<typeof ArkResultSchema>;
const base={gameType:v.literal('ARK_NOVA'),rulesVersion:v.literal(ARK_RULES_VERSION),gameId:GameIdSchema,gameRevision:GameRevisionSchema,startingPlayerId:PlayerIdSchema,playerStates:v.pipe(v.array(ArkPlayerViewSchema),v.minLength(2),v.maxLength(4)),market:v.pipe(v.array(v.nullable(ArkCardSchema)),v.length(6)),deckCount:count,discardCount:count,projects:v.pipe(v.array(ArkProjectViewSchema),v.maxLength(8)),partners:v.pipe(v.array(ref),v.maxLength(5)),universities:v.pipe(v.array(ref),v.maxLength(3)),donations:v.pipe(v.array(count),v.maxLength(20)),breakRemaining:count,breakNumber:count,stage:v.picklist(['SETUP','TURN','BREAK','FINAL']),turnNumber:count,finalTurns:v.nullable(v.pipe(v.array(PlayerIdSchema),v.maxLength(4))),activeAction:v.nullable(v.strictObject({kind:ArkActionKindSchema,strength:count,remaining:count,performed:count})),pending:v.nullable(ArkPendingViewSchema),privateState:v.strictObject({playerId:PlayerIdSchema,hand:v.pipe(v.array(ArkCardSchema),v.maxLength(250)),goals:v.pipe(v.array(ref),v.maxLength(11)),options:v.pipe(v.array(ArkOptionSchema),v.maxLength(300))}),log:v.pipe(v.array(ArkLogSchema),v.maxLength(60))};
export const ArkPlayingProjectionSchema=v.strictObject({...base,phase:v.literal('PLAYING'),turnId:TurnIdSchema,activePlayerId:PlayerIdSchema});
export const ArkFinishedProjectionSchema=v.strictObject({...base,phase:v.literal('FINISHED'),result:ArkResultSchema});
export type ArkProjection=v.InferOutput<typeof ArkPlayingProjectionSchema>|v.InferOutput<typeof ArkFinishedProjectionSchema>;
export type ArkPlayingProjection=v.InferOutput<typeof ArkPlayingProjectionSchema>;
export function arkProjectionIsConsistent(g:ArkProjection):boolean{
 const ids=new Set(g.playerStates.map(p=>p.playerId)),self=g.playerStates.find(p=>p.playerId===g.privateState.playerId);
 if(ids.size!==g.playerStates.length||!self||!ids.has(g.startingPlayerId)||self.handCount!==g.privateState.hand.length||self.goalsCount!==g.privateState.goals.length)return false;
 const cards=[...g.market.filter(c=>c!==null),...g.privateState.hand,...g.playerStates.flatMap(p=>p.played),...g.projects.map(p=>p.card)];
 if(new Set(cards.map(c=>c.cardId)).size!==cards.length)return false;
 if(g.playerStates.some(p=>new Set(p.actions.map(a=>a.kind)).size!==5||p.busy>p.workers||new Set(p.buildings.flatMap(b=>b.cells.map(c=>`${c.q},${c.r}`))).size!==p.buildings.reduce((n,b)=>n+b.cells.length,0)))return false;
 if(g.pending&&!ids.has(g.pending.playerId)||g.finalTurns?.some(id=>!ids.has(id)))return false;
 if(g.phase==='PLAYING')return ids.has(g.activePlayerId);
 return g.result.scores.length===ids.size&&g.result.scores.every(p=>ids.has(p.playerId))&&g.result.winnerPlayerIds.every(id=>ids.has(id));
}
