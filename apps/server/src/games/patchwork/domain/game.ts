import * as v from 'valibot';
import {GameIdSchema,GameRevisionSchema,ServerTimeSchema,TurnIdSchema,PatchworkPublicFields,PatchworkResultSchema,PatchworkPlayingProjectionSchema,PatchworkFinishedProjectionSchema,PatchworkActionSchema,patchworkProjectionIsConsistent,patchworkFirstPlacement,patchworkPatch,patchworkCanPlace,patchworkOccupied,patchworkSeven,patchworkScore,patchworkMovePreview,PATCHWORK_PATCHES,PATCHWORK_LEATHER,type GameId,type PlayerId,type ServerTime,type TurnId,type TileId,type PatchworkSettings,type PatchworkAction} from '@hangul-rummikub/shared';
import type {RandomSource} from '../../../ports/system.js';
const {playerStates,...Fields}=PatchworkPublicFields;
const StateSchema=v.strictObject({gameId:GameIdSchema,revision:GameRevisionSchema,rulesVersion:v.literal('patchwork-base-v1'),startedAt:ServerTimeSchema,finishedAt:v.nullable(ServerTimeSchema),phase:v.picklist(['PLAYING','FINISHED']),transitionId:TurnIdSchema,players:playerStates,...Fields,result:v.nullable(PatchworkResultSchema)});
export type PatchworkState=v.InferOutput<typeof StateSchema>;
export function parsePatchworkState(input:unknown):PatchworkState{
 const s=v.parse(StateSchema,input),{players,revision,startedAt:_startedAt,finishedAt:_finishedAt,transitionId,result,...base}=s;
 const fields={...base,gameType:'PATCHWORK',gameRevision:revision,playerStates:players,privateState:{playerId:players[0]!.playerId}};
 const projection=s.phase==='PLAYING'?v.parse(PatchworkPlayingProjectionSchema,{...fields,phase:'PLAYING',turnId:transitionId}):v.parse(PatchworkFinishedProjectionSchema,{...fields,phase:'FINISHED',result});
 if(!patchworkProjectionIsConsistent(projection)||(s.phase==='FINISHED')!==(s.finishedAt!==null&&s.result!==null)||(s.phase==='PLAYING'&&(s.result!==null||s.finishedAt!==null)))throw new Error('Invalid Patchwork state.');
 if(s.phase==='PLAYING'&&!s.pendingLeather.length){const actor=s.players.find(p=>p.playerId===s.activePlayerId)!,other=s.players.find(p=>p!==actor)!;if(actor.position>other.position||actor.position===53)throw new Error('Invalid Patchwork turn.');}
 if(s.result?.reason==='SCORED'&&(s.finishOrder.length!==2||s.pendingLeather.length||s.result.winnerPlayerIds.length!==1))throw new Error('Invalid Patchwork finish.');
 return s;
}
export function createPatchworkGame(input:{generateTileId():TileId;gameId:GameId;playerIds:readonly PlayerId[];now:ServerTime;turnId:TurnId;random:RandomSource;settings?:PatchworkSettings}):PatchworkState{
 if(input.playerIds.length!==2||new Set(input.playerIds).size!==2)throw new Error('Two distinct players required.');
 const market=PATCHWORK_PATCHES.filter(p=>p.id>0).map(p=>({tileId:input.generateTileId(),patchId:p.id}));
 for(let i=market.length-1;i>0;i--){const j=input.random.nextInt(i+1);[market[i],market[j]]=[market[j]!,market[i]!];}
 const afterStart=market.findIndex(p=>p.patchId===1)+1;
 return parsePatchworkState({settings:input.settings??{turnDurationSeconds:60},deadlineAt:input.now+(input.settings?.turnDurationSeconds??60)*1000,gameId:input.gameId,revision:0,rulesVersion:'patchwork-base-v1',startedAt:input.now,finishedAt:null,phase:'PLAYING',transitionId:input.turnId,players:input.playerIds.map(playerId=>({playerId,placements:[],buttons:5,income:0,position:0})),activePlayerId:input.playerIds[input.random.nextInt(2)],market:[...market.slice(afterStart),...market.slice(0,afterStart)],leather:PATCHWORK_LEATHER.map(position=>({tileId:input.generateTileId(),patchId:0,position})),pendingLeather:[],discardedLeather:[],bonusOwner:null,finishOrder:[],history:[],result:null});
}
function settle(s:PatchworkState,actor:PlayerId,now:ServerTime):void{
 const p=s.players.find(p=>p.playerId===actor)!,other=s.players.find(p=>p.playerId!==actor)!;
 if(s.bonusOwner===null&&patchworkSeven(p.placements))s.bonusOwner=actor;
 if(patchworkOccupied(p.placements).size===81)s.discardedLeather.push(...s.pendingLeather.splice(0));
 if(s.pendingLeather.length)return;
 if(s.finishOrder.length===2){s.phase='FINISHED';s.finishedAt=now;const ranked=s.players.map(p=>({id:p.playerId,score:patchworkScore(p,s.bonusOwner).total})).sort((a,b)=>b.score-a.score||s.finishOrder.indexOf(a.id)-s.finishOrder.indexOf(b.id));s.result={reason:'SCORED',winnerPlayerIds:[ranked[0]!.id]};}
 else s.activePlayerId=p.position<=other.position?actor:other.playerId;
}
function applyAction(s:PatchworkState,actor:PlayerId,input:PatchworkAction,now:ServerTime,turnId:TurnId,automatic=false):{ok:true;state:PatchworkState}|{ok:false;reason:'INVALID_ACTION'|'INVALID_PHASE'|'NOT_YOUR_TURN'|'TURN_EXPIRED'}{
 if(s.phase!=='PLAYING')return {ok:false,reason:'INVALID_PHASE'};
 if(s.activePlayerId!==actor)return {ok:false,reason:'NOT_YOUR_TURN'};
 if(!automatic&&s.deadlineAt!==null&&now>=s.deadlineAt)return {ok:false,reason:'TURN_EXPIRED'};
 const parsed=v.safeParse(PatchworkActionSchema,input);if(!parsed.success)return {ok:false,reason:'INVALID_ACTION'};
 const a=parsed.output,next=structuredClone(s),p=next.players.find(p=>p.playerId===actor)!,other=next.players.find(p=>p.playerId!==actor)!;
 let patchId=0,distance=0,income=0;
 if(a.type==='PLACE_LEATHER'){
  const tile=next.pendingLeather[0];if(!tile||tile.tileId!==a.tileId||!patchworkCanPlace(p.placements,0,a.x,a.y,0,false))return {ok:false,reason:'INVALID_ACTION'};
  p.placements.push({...tile,x:a.x,y:a.y,rotation:0,flipped:false});next.pendingLeather.shift();
 }else{
  if(next.pendingLeather.length)return {ok:false,reason:'INVALID_ACTION'};
  const index=a.type==='BUY'?next.market.findIndex(t=>t.tileId===a.tileId):-1;
  if(a.type==='BUY'&&(index<0||index>=3))return {ok:false,reason:'INVALID_ACTION'};
  const tile=index>=0?next.market[index]:undefined;
  if(a.type==='BUY'){
   if(!tile||p.buttons<patchworkPatch(tile.patchId).cost||!patchworkCanPlace(p.placements,tile.patchId,a.x,a.y,a.rotation,a.flipped))return {ok:false,reason:'INVALID_ACTION'};
   patchId=tile.patchId;
  }
  const movement=patchworkMovePreview(p,other.position,tile?.patchId??null),from=p.position;
  if(a.type==='BUY'&&tile){p.placements.push({...tile,x:a.x,y:a.y,rotation:a.rotation,flipped:a.flipped});next.market=[...next.market.slice(index+1),...next.market.slice(0,index)];}
  p.buttons=movement.buttons;p.income=movement.income;p.position=movement.target;distance=movement.distance;income=movement.incomeGain;
  const gained=next.leather.filter(t=>t.position>from&&t.position<=p.position);next.pendingLeather=gained.map(({tileId,patchId})=>({tileId,patchId}));next.leather=next.leather.filter(t=>!gained.includes(t));
  if(p.position===53&&!next.finishOrder.includes(actor))next.finishOrder.push(actor);
 }
 settle(next,actor,now);next.deadlineAt=next.phase==='FINISHED'?null:next.pendingLeather.length?s.deadlineAt:v.parse(ServerTimeSchema,now+next.settings.turnDurationSeconds*1000);next.revision=v.parse(GameRevisionSchema,s.revision+1);next.transitionId=turnId;
 next.history.push({automatic,id:next.revision,playerId:actor,kind:a.type==='PLACE_LEATHER'?'LEATHER':a.type,patchId,distance,income,bonus:s.bonusOwner===null&&next.bonusOwner===actor});
 return {ok:true,state:parsePatchworkState(next)};
}
export function cancelPatchwork(s:PatchworkState,now:ServerTime):PatchworkState{return parsePatchworkState({...s,revision:s.revision+1,phase:'FINISHED',deadlineAt:null,finishedAt:now,result:{reason:'CANCELLED',winnerPlayerIds:[]}});}


export function applyPatchworkAction(s:PatchworkState,actor:PlayerId,input:PatchworkAction,now:ServerTime,turnId:TurnId){
 return applyAction(s,actor,input,now,turnId);
}

// Resolve the whole expired turn on a candidate, including all earned leather.
export function timeoutPatchwork(s:PatchworkState,now:ServerTime,turnId:TurnId):{ok:true;state:PatchworkState}|{ok:false}{
 if(s.phase!=='PLAYING'||s.deadlineAt===null||now<s.deadlineAt)return {ok:false};
 let next=s;
 if(!next.pendingLeather.length){
  const advanced=applyAction(next,next.activePlayerId,{type:'ADVANCE'},now,turnId,true);
  if(!advanced.ok)return {ok:false};
  next=advanced.state;
 }
 while(next.pendingLeather.length){
  const player=next.players.find(p=>p.playerId===next.activePlayerId)!;
  const position=patchworkFirstPlacement(player.placements,0);
  if(!position)return {ok:false};
  const placed=applyAction(next,next.activePlayerId,{type:'PLACE_LEATHER',tileId:next.pendingLeather[0]!.tileId,x:position.x,y:position.y},now,turnId,true);
  if(!placed.ok)return {ok:false};
  next=placed.state;
 }
 return {ok:true,state:next};
}
