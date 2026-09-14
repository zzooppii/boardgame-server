import { GameRevisionSchema } from '../../protocol.js';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from '../../identifiers.js';
import { PandemicCardSchema, PandemicConsentActionSchema } from './actions.js';
import { PANDEMIC_CITIES, PANDEMIC_COLORS, PandemicCitySchema, PandemicRoleSchema } from './catalog.js';
export const PandemicCount = v.pipe(v.number(),v.safeInteger(),v.minValue(0));
export const PandemicCubesSchema = v.strictObject({BLUE:v.pipe(PandemicCount,v.maxValue(3)),YELLOW:v.pipe(PandemicCount,v.maxValue(3)),BLACK:v.pipe(PandemicCount,v.maxValue(3)),RED:v.pipe(PandemicCount,v.maxValue(3))});
export const PandemicSupplySchema = v.strictObject({BLUE:v.pipe(PandemicCount,v.maxValue(24)),YELLOW:v.pipe(PandemicCount,v.maxValue(24)),BLACK:v.pipe(PandemicCount,v.maxValue(24)),RED:v.pipe(PandemicCount,v.maxValue(24))});
export const PandemicDiseaseSchema = v.picklist(['ACTIVE','CURED','ERADICATED']);
export const PandemicCuresSchema = v.strictObject({BLUE:PandemicDiseaseSchema,YELLOW:PandemicDiseaseSchema,BLACK:PandemicDiseaseSchema,RED:PandemicDiseaseSchema});
export const PandemicStageSchema = v.picklist(['SETUP','ACTIONS','DRAW','EPIDEMIC_NEXT','INTENSIFY','INFECTION_READY','INFECTION','TURN_END']);
export const PandemicSoundSchema = v.picklist(['MOVE','TREAT','BUILD','CARD','INFECT','OUTBREAK','EPIDEMIC','CURE','EVENT','TURN','WIN','LOSE','PING','NONE']);
export const PandemicLogSchema = v.strictObject({id:PandemicCount,text:v.pipe(v.string(),v.maxLength(240)),sound:PandemicSoundSchema,city:v.nullable(PandemicCitySchema)});
export type PandemicLog = v.InferOutput<typeof PandemicLogSchema>;
export const PandemicSettingsSchema=v.strictObject({epidemics:v.picklist([4,5,6]),openHands:v.boolean()});
export const PandemicResultSchema=v.strictObject({reason:v.picklist(['CURED','OUTBREAKS','CUBES','DECK','CANCELLED']),winnerPlayerIds:v.array(PlayerIdSchema)});
export const PandemicPendingSchema=v.variant('kind',[
 v.strictObject({kind:v.literal('CONSENT'),proposer:PlayerIdSchema,responder:PlayerIdSchema,action:PandemicConsentActionSchema}),
 v.strictObject({kind:v.literal('FORECAST'),playerId:PlayerIdSchema}),
 v.strictObject({kind:v.literal('SHARE_PICK'),proposer:PlayerIdSchema,responder:PlayerIdSchema}),
]);
const player=v.strictObject({playerId:PlayerIdSchema,role:PandemicRoleSchema,city:PandemicCitySchema,handCount:PandemicCount,hand:v.nullable(v.array(PandemicCardSchema)),stored:v.nullable(PandemicCardSchema)});
const Base={gameType:v.literal('PANDEMIC'),gameId:GameIdSchema,gameRevision:GameRevisionSchema,rulesVersion:v.literal('pandemic-base-v1'),settings:PandemicSettingsSchema,playerStates:v.pipe(v.array(player),v.minLength(2),v.maxLength(4)),activePlayerId:PlayerIdSchema,actionsLeft:v.pipe(PandemicCount,v.maxValue(4)),round:PandemicCount,board:v.pipe(v.array(v.strictObject({city:PandemicCitySchema,cubes:PandemicCubesSchema})),v.length(48)),stations:v.pipe(v.array(PandemicCitySchema),v.maxLength(6)),supply:PandemicSupplySchema,cures:PandemicCuresSchema,outbreaks:v.pipe(PandemicCount,v.maxValue(8)),rateIndex:v.pipe(PandemicCount,v.maxValue(6)),playerDeckCount:PandemicCount,infectionDeckCount:PandemicCount,discard:v.array(PandemicCardSchema),infectionDiscard:v.array(PandemicCitySchema),infectionRemoved:v.array(PandemicCitySchema),lastInfected:v.nullable(PandemicCitySchema),infectionRemaining:PandemicCount,epidemicsRemaining:PandemicCount,quietNight:v.boolean(),operationsUsed:v.boolean(),pending:v.nullable(PandemicPendingSchema),continueReady:v.array(PlayerIdSchema),history:v.pipe(v.array(PandemicLogSchema),v.maxLength(80)),pings:v.pipe(v.array(v.strictObject({playerId:PlayerIdSchema,city:PandemicCitySchema,message:v.picklist(['HELP','MEET','TREAT'])})),v.maxLength(4)),privateState:v.strictObject({playerId:PlayerIdSchema,forecast:v.nullable(v.pipe(v.array(PandemicCitySchema),v.maxLength(6)))})};
export const PandemicPlayingProjectionSchema=v.strictObject({...Base,phase:PandemicStageSchema,turnId:TurnIdSchema});
export const PandemicFinishedProjectionSchema=v.strictObject({...Base,phase:v.literal('FINISHED'),result:PandemicResultSchema});
export type PandemicProjection=v.InferOutput<typeof PandemicPlayingProjectionSchema>|v.InferOutput<typeof PandemicFinishedProjectionSchema>;
export function pandemicProjectionIsConsistent(g:PandemicProjection):boolean {
 const ids=g.playerStates.map(p=>p.playerId), roles=g.playerStates.map(p=>p.role);
 if(new Set(ids).size!==ids.length||new Set(roles).size!==roles.length||!ids.includes(g.activePlayerId)||!ids.includes(g.privateState.playerId))return false;
 if(new Set(g.board.map(b=>b.city)).size!==48||new Set(g.stations).size!==g.stations.length)return false;
 if(g.playerStates.some(p=>p.hand!==null&&p.hand.length!==p.handCount||p.hand?.some(c=>c.kind==='EPIDEMIC')||p.stored!==null&&(p.role!=='PLANNER'||p.stored.kind!=='EVENT')||((g.settings.openHands||p.playerId===g.privateState.playerId)!==(p.hand!==null))))return false;
 if((g.pending?.kind==='CONSENT'||g.pending?.kind==='SHARE_PICK')&&(!ids.includes(g.pending.proposer)||!ids.includes(g.pending.responder)))return false;
 if(g.privateState.forecast!==null&&(g.pending?.kind!=='FORECAST'||g.pending.playerId!==g.privateState.playerId))return false;
 if(g.continueReady.some(id=>!ids.includes(id))||new Set(g.continueReady).size!==g.continueReady.length)return false;
 for(const color of PANDEMIC_COLORS){const n=g.board.reduce((sum,b)=>sum+b.cubes[color],0);if(n+g.supply[color]!==24||(g.cures[color]==='ERADICATED'&&n!==0))return false;}
 return g.board.every(b=>PANDEMIC_CITIES.includes(b.city));
}
