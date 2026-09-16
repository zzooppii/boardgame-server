import {ServerTimeSchema} from "../../protocol.js";
import {HarmoniesSettingsSchema,HarmoniesDraftSchema} from "./actions.js";
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from '../../identifiers.js';
import { GameRevisionSchema } from '../../protocol.js';
import { HarmoniesCardIdSchema, HarmoniesCountSchema, HarmoniesPlayerSchema, HarmoniesTokenSchema } from './actions.js';
import { harmoniesPlayerValid, harmoniesReplay } from './rules.js';
export const HarmoniesLogSchema = v.strictObject({ id:HarmoniesCountSchema, playerId:PlayerIdSchema, text:v.string(), animals:HarmoniesCountSchema, cells:v.array(HarmoniesCountSchema) });
export const HarmoniesResultSchema = v.strictObject({ reason:v.picklist(['SCORED','CANCELLED']), winnerPlayerIds:v.array(PlayerIdSchema) });
const Base = {gameType:v.literal('HARMONIES'),gameId:GameIdSchema,gameRevision:GameRevisionSchema,rulesVersion:v.literal('harmonies-base-a-v1'),settings:HarmoniesSettingsSchema,deadlineAt:v.nullable(ServerTimeSchema),playerStates:v.pipe(v.array(HarmoniesPlayerSchema),v.minLength(2),v.maxLength(4)),activePlayerId:PlayerIdSchema,round:v.pipe(HarmoniesCountSchema,v.minValue(1)),markets:v.pipe(v.array(v.pipe(v.array(HarmoniesTokenSchema),v.maxLength(3))),v.length(5)),animalMarket:v.pipe(v.array(HarmoniesCardIdSchema),v.maxLength(5)),bagCount:v.pipe(HarmoniesCountSchema,v.maxValue(120)),deckCount:v.pipe(HarmoniesCountSchema,v.maxValue(32)),lastRound:v.boolean(),history:v.pipe(v.array(HarmoniesLogSchema),v.maxLength(100)),privateState:v.strictObject({playerId:PlayerIdSchema,draftSteps:v.optional(HarmoniesDraftSchema,[])})};
export const HarmoniesPlayingProjectionSchema = v.strictObject({...Base,phase:v.literal('PLAYING'),turnId:TurnIdSchema});
export const HarmoniesFinishedProjectionSchema = v.strictObject({...Base,phase:v.literal('FINISHED'),result:HarmoniesResultSchema});
export type HarmoniesProjection = v.InferOutput<typeof HarmoniesPlayingProjectionSchema>|v.InferOutput<typeof HarmoniesFinishedProjectionSchema>;
export function harmoniesProjectionIsConsistent(g:HarmoniesProjection):boolean {
  const ids=g.playerStates.map(p=>p.playerId),tokens=[...g.markets.flat(),...g.playerStates.flatMap(p=>p.board.flatMap(c=>c.stack))],cards=[...g.animalMarket,...g.playerStates.flatMap(p=>p.cards.map(c=>c.cardId))];
  const draftOwner=g.playerStates.find(p=>p.playerId===g.privateState.playerId);
  if(!draftOwner||g.privateState.draftSteps.length>0&&g.privateState.playerId!==g.activePlayerId||!harmoniesReplay(draftOwner,g.markets,g.animalMarket,g.privateState.draftSteps).ok||(g.phase==='PLAYING')!==(g.deadlineAt!==null))return false;
  return new Set(ids).size===ids.length && ids.includes(g.activePlayerId) && ids.includes(g.privateState.playerId) && g.playerStates.every(harmoniesPlayerValid) && new Set(tokens.map(t=>t.tileId)).size===tokens.length && tokens.length+g.bagCount===120 && new Set(cards).size===cards.length && cards.length+g.deckCount===32 && (g.phase!=='FINISHED'||g.result.winnerPlayerIds.every(id=>ids.includes(id)));
}
