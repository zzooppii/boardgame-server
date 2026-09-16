import {HarmoniesSettingsSchema,HarmoniesDraftSchema,HARMONIES_DEFAULT_SETTINGS,harmoniesCanPlace,type HarmoniesSettings,type HarmoniesStep} from "@hangul-rummikub/shared";
import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, TurnIdSchema, HarmoniesPlayerSchema, HarmoniesTokenSchema, HarmoniesCardIdSchema, HarmoniesCountSchema, HarmoniesLogSchema, HarmoniesResultSchema, HARMONIES_ANIMALS, HARMONIES_COLORS, HARMONIES_INVENTORY, harmoniesPlayerValid, harmoniesReplay, harmoniesScore, type GameId, type PlayerId, type ServerTime, type TurnId, type TileId, type HarmoniesAction, type HarmoniesToken } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
const StateSchema=v.strictObject({gameId:GameIdSchema,revision:GameRevisionSchema,rulesVersion:v.literal('harmonies-base-a-v1'),settings:HarmoniesSettingsSchema,deadlineAt:v.nullable(ServerTimeSchema),draftSteps:HarmoniesDraftSchema,startedAt:ServerTimeSchema,finishedAt:v.nullable(ServerTimeSchema),phase:v.picklist(['PLAYING','FINISHED']),transitionId:TurnIdSchema,players:v.pipe(v.array(HarmoniesPlayerSchema),v.minLength(2),v.maxLength(4)),active:v.pipe(HarmoniesCountSchema,v.maxValue(3)),round:v.pipe(HarmoniesCountSchema,v.minValue(1)),bag:v.array(HarmoniesTokenSchema),markets:v.pipe(v.array(v.pipe(v.array(HarmoniesTokenSchema),v.maxLength(3))),v.length(5)),deck:v.array(HarmoniesCardIdSchema),animalMarket:v.pipe(v.array(HarmoniesCardIdSchema),v.maxLength(5)),lastRound:v.boolean(),history:v.pipe(v.array(HarmoniesLogSchema),v.maxLength(100)),result:v.nullable(HarmoniesResultSchema)});
export type HarmoniesState=v.InferOutput<typeof StateSchema>;
export function parseHarmoniesState(input:unknown):HarmoniesState {
  const s=v.parse(StateSchema,input),tokens=[...s.bag,...s.markets.flat(),...s.players.flatMap(p=>p.board.flatMap(c=>c.stack))],cards=[...s.deck,...s.animalMarket,...s.players.flatMap(p=>p.cards.map(c=>c.cardId))];
  if(s.active>=s.players.length||new Set(s.players.map(p=>p.playerId)).size!==s.players.length||tokens.length!==120||new Set(tokens.map(t=>t.tileId)).size!==120||HARMONIES_COLORS.some(color=>tokens.filter(t=>t.color===color).length!==HARMONIES_INVENTORY[color])||cards.length!==32||new Set(cards).size!==32||s.players.some(p=>!harmoniesPlayerValid(p)))throw new Error('Invalid Harmonies inventory or players.');
  if((s.phase==='FINISHED')!==(s.finishedAt!==null&&s.result!==null)||s.phase==='PLAYING'&&(s.finishedAt!==null||s.result!==null))throw new Error('Invalid Harmonies phase.');
  if((s.phase==='PLAYING')!==(s.deadlineAt!==null)||!harmoniesReplay(s.players[s.active]!,s.markets,s.animalMarket,s.draftSteps).ok)throw new Error('Invalid Harmonies deadline or draft.');
  if(s.result?.winnerPlayerIds.some(id=>!s.players.some(p=>p.playerId===id)))throw new Error('Invalid Harmonies winners.');
  return s;
}
function shuffle<T>(items:readonly T[],random:RandomSource):T[]{const result=[...items];for(let i=result.length-1;i>0;i--){const j=random.nextInt(i+1);[result[i],result[j]]=[result[j]!,result[i]!];}return result;}
export function createHarmoniesGame(input:{generateTileId():TileId;gameId:GameId;playerIds:readonly PlayerId[];now:ServerTime;turnId:TurnId;random:RandomSource;settings?:HarmoniesSettings}):HarmoniesState {
  const bag=shuffle(HARMONIES_COLORS.flatMap(color=>Array.from({length:HARMONIES_INVENTORY[color]},():HarmoniesToken=>({tileId:input.generateTileId(),color}))),input.random),deck=shuffle(HARMONIES_ANIMALS.map(c=>c.id),input.random);
  // Randomized first player; the array becomes the stable clockwise seating order.
  const first=input.random.nextInt(input.playerIds.length),order=[...input.playerIds.slice(first),...input.playerIds.slice(0,first)];
  return parseHarmoniesState({gameId:input.gameId,revision:0,rulesVersion:'harmonies-base-a-v1',settings:input.settings??HARMONIES_DEFAULT_SETTINGS,deadlineAt:input.now+(input.settings??HARMONIES_DEFAULT_SETTINGS).turnSeconds*1000,draftSteps:[],startedAt:input.now,finishedAt:null,phase:'PLAYING',transitionId:input.turnId,players:order.map(playerId=>({playerId,board:Array.from({length:23},()=>({stack:[],animal:null})),cards:[],turns:0})),active:0,round:1,bag,markets:Array.from({length:5},()=>bag.splice(0,3)),deck,animalMarket:deck.splice(0,5),lastRound:false,history:[],result:null});
}
export function applyHarmoniesAction(s:HarmoniesState,actor:PlayerId,action:HarmoniesAction,now:ServerTime,turnId:TurnId):{ok:true;state:HarmoniesState}|{ok:false;reason:'INVALID_ACTION'|'INVALID_PHASE'|'NOT_YOUR_TURN'|'TURN_EXPIRED'} {
  if(s.phase!=='PLAYING')return {ok:false,reason:'INVALID_PHASE'};
  if(s.deadlineAt===null||now>=s.deadlineAt)return {ok:false,reason:'TURN_EXPIRED'};
  if(s.players[s.active]?.playerId!==actor)return {ok:false,reason:'NOT_YOUR_TURN'};
  const replay=harmoniesReplay(s.players[s.active]!,s.markets,s.animalMarket,action.steps);
  if(!replay.ok||!replay.draft.ready||replay.draft.source===null)return {ok:false,reason:'INVALID_ACTION'};
  const next=structuredClone(s),draft=replay.draft;
  draft.player.turns++;next.players[next.active]=draft.player;next.markets[draft.source!]=[];
  if(draft.takenCard!==null)next.animalMarket=next.animalMarket.filter(id=>id!==draft.takenCard);
  if(next.bag.length<3||draft.player.board.filter(c=>c.stack.length===0).length<=2)next.lastRound=true;
  next.markets[draft.source!]=next.bag.splice(0,3);
  while(next.animalMarket.length<5&&next.deck.length)next.animalMarket.push(next.deck.shift()!);
  next.revision=v.parse(GameRevisionSchema,next.revision+1);next.transitionId=turnId;
  const animals=action.steps.filter(a=>a.type==='SETTLE').length,cells=action.steps.flatMap(a=>a.type==='PLACE'?[a.cell]:[]);
  next.history.push({id:next.revision,playerId:actor,text:`토큰 3개 배치${draft.takenCard===null?'':' · 동물 카드 선택'}${animals?` · 동물 ${animals}마리 정착`:''}`,animals,cells});next.history=next.history.slice(-100);
  if(next.lastRound&&next.active===next.players.length-1){
    next.phase='FINISHED';next.finishedAt=now;
    const ranked=next.players.map(p=>({id:p.playerId,points:harmoniesScore(p.board,p.cards).total,cubes:p.cards.reduce((n,c)=>n+c.placed,0)})).sort((a,b)=>b.points-a.points||b.cubes-a.cubes),best=ranked[0]!;
    next.result={reason:'SCORED',winnerPlayerIds:ranked.filter(p=>p.points===best.points&&p.cubes===best.cubes).map(p=>p.id)};
  }else{next.active=(next.active+1)%next.players.length;if(next.active===0)next.round++;}
  next.draftSteps=[];next.deadlineAt=next.phase==='PLAYING'?v.parse(ServerTimeSchema,now+next.settings.turnSeconds*1000):null;
  return {ok:true,state:parseHarmoniesState(next)};
}
export function cancelHarmonies(s:HarmoniesState,now:ServerTime):HarmoniesState {return parseHarmoniesState({...s,revision:s.revision+1,phase:'FINISHED',finishedAt:now,deadlineAt:null,draftSteps:[],result:{reason:'CANCELLED',winnerPlayerIds:[]}});}

/** Only validated, server-acknowledged edits are eligible for timeout completion. */
export function saveHarmoniesDraft(s:HarmoniesState,actor:PlayerId,steps:HarmoniesStep[],now:ServerTime):HarmoniesState|null {
 if(s.phase!=='PLAYING'||s.players[s.active]?.playerId!==actor||s.deadlineAt===null||now>=s.deadlineAt)return null;
 const replay=harmoniesReplay(s.players[s.active]!,s.markets,s.animalMarket,steps);
 if(!replay.ok)return null;
 return parseHarmoniesState({...s,revision:s.revision+1,draftSteps:structuredClone(steps)});
}
export function timeoutHarmonies(s:HarmoniesState,now:ServerTime,turnId:TurnId):HarmoniesState|null {
 if(s.phase!=='PLAYING'||s.deadlineAt===null||now<s.deadlineAt)return null;
 const actor=s.players[s.active]!,steps=structuredClone(s.draftSteps);
 let replay=harmoniesReplay(actor,s.markets,s.animalMarket,steps);
 if(!replay.ok)throw new Error('Invalid saved Harmonies draft.');
 if(replay.draft.source===null){const source=s.markets.findIndex(m=>m.length===3);if(source<0)throw new Error('Missing Harmonies supply.');steps.push({type:'TAKE_TOKENS',source});}
 for(let i=0;i<3;i++){
  replay=harmoniesReplay(actor,s.markets,s.animalMarket,steps);if(!replay.ok)throw new Error('Invalid completion.');
  const token=replay.draft.pool[0];if(!token)break;
  const board=replay.draft.player.board;
  // Prefer empty cells in board order; never move an existing token or settle animals automatically.
  let cell=board.findIndex(c=>c.stack.length===0&&harmoniesCanPlace(c,token));
  if(cell<0)cell=board.findIndex(c=>harmoniesCanPlace(c,token));
  if(cell<0)throw new Error('No legal timeout placement.');
  steps.push({type:'PLACE',tileId:token.tileId,cell});
 }
 const result=applyHarmoniesAction({...s,deadlineAt:v.parse(ServerTimeSchema,now+1)},actor.playerId,{type:'SUBMIT_TURN',steps},now,turnId);
 if(!result.ok)throw new Error('Invalid timeout turn.');
 result.state.history[result.state.history.length-1]!.text+=' · 시간 초과 자동 완료';
 return result.state;
}
