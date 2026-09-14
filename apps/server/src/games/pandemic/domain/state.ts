import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, PandemicCardSchema, PandemicCitySchema, PandemicRoleSchema, PandemicSettingsSchema, PandemicCubesSchema, PandemicSupplySchema, PandemicCuresSchema, PandemicCount, PandemicLogSchema, PandemicPendingSchema, PandemicResultSchema, PANDEMIC_CITIES, PANDEMIC_COLORS, PANDEMIC_EVENTS, type PandemicCity } from '@hangul-rummikub/shared';
export const PandemicStateSchema=v.strictObject({
 rulesVersion:v.literal('pandemic-base-v1'),gameId:GameIdSchema,revision:GameRevisionSchema,transitionId:TurnIdSchema,startedAt:ServerTimeSchema,finishedAt:v.nullable(ServerTimeSchema),phase:v.picklist(['SETUP','ACTIONS','DRAW','EPIDEMIC_NEXT','INTENSIFY','INFECTION_READY','INFECTION','TURN_END','FINISHED']),settings:PandemicSettingsSchema,
 players:v.pipe(v.array(v.strictObject({playerId:PlayerIdSchema,role:PandemicRoleSchema,city:PandemicCitySchema,hand:v.array(PandemicCardSchema),stored:v.nullable(PandemicCardSchema)})),v.minLength(2),v.maxLength(4)),activeIndex:PandemicCount,actionsLeft:v.pipe(PandemicCount,v.maxValue(4)),round:PandemicCount,
 board:v.pipe(v.array(v.strictObject({city:PandemicCitySchema,cubes:PandemicCubesSchema})),v.length(48)),stations:v.pipe(v.array(PandemicCitySchema),v.maxLength(6)),supply:PandemicSupplySchema,cures:PandemicCuresSchema,outbreaks:v.pipe(PandemicCount,v.maxValue(8)),rateIndex:v.pipe(PandemicCount,v.maxValue(6)),
 playerDeck:v.array(PandemicCardSchema),discard:v.array(PandemicCardSchema),removed:v.array(PandemicCardSchema),infectionDeck:v.array(PandemicCitySchema),infectionDiscard:v.array(PandemicCitySchema),infectionRemoved:v.array(PandemicCitySchema),lastInfected:v.nullable(PandemicCitySchema),infectionRemaining:PandemicCount,epidemicsRemaining:PandemicCount,quietNight:v.boolean(),operationsUsed:v.boolean(),pending:v.nullable(PandemicPendingSchema),continueReady:v.array(PlayerIdSchema),history:v.pipe(v.array(PandemicLogSchema),v.maxLength(80)),sequence:PandemicCount,result:v.nullable(PandemicResultSchema),pings:v.pipe(v.array(v.strictObject({playerId:PlayerIdSchema,city:PandemicCitySchema,message:v.picklist(['HELP','MEET','TREAT'])})),v.maxLength(4)),
});
export type PandemicState=v.InferOutput<typeof PandemicStateSchema>;
export function parsePandemicState(input:unknown):PandemicState {
 const s=v.parse(PandemicStateSchema,input),ids=s.players.map(p=>p.playerId);
 if(new Set(ids).size!==ids.length||new Set(s.players.map(p=>p.role)).size!==ids.length||s.activeIndex>=ids.length)throw new Error('Invalid Pandemic roster.');
 if(new Set(s.board.map(b=>b.city)).size!==48||new Set(s.stations).size!==s.stations.length)throw new Error('Invalid Pandemic board.');
 for(const color of PANDEMIC_COLORS){const count=s.board.reduce((n,b)=>n+b.cubes[color],0);if(count+s.supply[color]!==24||s.cures[color]==='ERADICATED'&&count!==0)throw new Error('Pandemic cube conservation.');}
 const cards=[...s.playerDeck,...s.discard,...s.removed,...s.players.flatMap(p=>[...p.hand,...p.stored?[p.stored]:[]])];
 if(new Set(cards.map(c=>c.cardId)).size!==cards.length||cards.length!==59)throw new Error('Pandemic card conservation.');
 const cities=cards.flatMap(c=>c.kind==='CITY'?[c.city]:[]),events=cards.flatMap(c=>c.kind==='EVENT'?[c.event]:[]);
 if(cities.length!==48||new Set(cities).size!==48||events.length!==5||new Set(events).size!==PANDEMIC_EVENTS.length||cards.filter(c=>c.kind==='EPIDEMIC').length!==6)throw new Error('Pandemic card faces.');
 const infection=[...s.infectionDeck,...s.infectionDiscard,...s.infectionRemoved];
 if(infection.length!==48||new Set(infection).size!==48)throw new Error('Pandemic infection conservation.');
 if(s.players.some(p=>p.hand.some(c=>c.kind==='EPIDEMIC')||p.stored&&(p.role!=='PLANNER'||p.stored.kind!=='EVENT')))throw new Error('Invalid Pandemic hand.');
 if((s.phase==='FINISHED')!==(s.result!==null)||(s.phase==='FINISHED')!==(s.finishedAt!==null))throw new Error('Pandemic finish mismatch.');
 if((s.pending?.kind==='CONSENT'||s.pending?.kind==='SHARE_PICK')&&(!ids.includes(s.pending.proposer)||!ids.includes(s.pending.responder)||s.pending.proposer===s.pending.responder))throw new Error('Invalid consent.');
 if(s.pending?.kind==='FORECAST'&&!ids.includes(s.pending.playerId))throw new Error('Invalid forecast.');
 if(new Set(s.continueReady).size!==s.continueReady.length||s.continueReady.some(id=>!ids.includes(id)))throw new Error('Invalid ready roster.');
 if(s.result){const winners=s.result.reason==='CURED'?ids:[];if(s.result.winnerPlayerIds.length!==winners.length||s.result.winnerPlayerIds.some(id=>!winners.includes(id)))throw new Error('Invalid Pandemic result.');}
 return s;
}
export function boardCity(s:PandemicState,city:PandemicCity){const b=s.board.find(b=>b.city===city);if(!b)throw new Error('Missing city.');return b;}
export function emptyPandemicBoard(){return PANDEMIC_CITIES.map(city=>({city,cubes:{BLUE:0,YELLOW:0,BLACK:0,RED:0}}));}
