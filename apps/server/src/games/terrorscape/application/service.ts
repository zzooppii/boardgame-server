import * as v from "valibot";
import { TerrorscapeClientCommandSchema, GameRevisionSchema, RoomRevisionSchema, ServerTimeSchema, type TerrorscapeClientCommand, type ErrorDto, type RoomId, type PlayerId, type ServerTime } from "@hangul-rummikub/shared";
import { GameStartSuccessDataSchema, type StartGameInput, type GameStartResult } from "../../../application/game-start-service.js";
import type { RoomMutationSerialExecutor } from "../../../application/room-session-service.js";
import type { RoomRepository } from "../../../ports/room-repository.js";
import type { RoomUnitOfWork } from "../../../ports/room-unit-of-work.js";
import type { IdempotencyRepository } from "../../../ports/idempotency-repository.js";
import type { RoomPresencePolicyReader } from "../../../ports/room-presence-policy.js";
import type { Clock, IdGenerator, RandomSource } from "../../../ports/system.js";
import type { TerrorscapeRoomRecord } from "../../../model/persistence.js";
import { createTerrorscapeGame, applyTerrorscapeAction, makeTerrorscapeCards, type TerrorscapeState } from "../domain/game.js";

export type TerrorscapeDependencies = Readonly<{ roomRepository:RoomRepository; roomUnitOfWork:RoomUnitOfWork; idempotencyRepository:IdempotencyRepository; roomMutationExecutor:RoomMutationSerialExecutor; presence:RoomPresencePolicyReader; clock:Clock; ids:IdGenerator; random:RandomSource }>;
const failure=(code:ErrorDto['code'])=>({ok:false as const,error:{code,message:code==='RULE_VIOLATION'?'현재 단계, 담당 캐릭터, 이동 경로와 카드 비용을 확인해주세요.':code==='NOT_ENOUGH_PLAYERS'?'테러스케이프는 2~4명이 플레이합니다.':'현재 차례와 연결 상태를 확인해주세요.',recoverable:true}});
const Receipt=v.strictObject({outcome:v.literal('ACCEPTED')});
export function transitionTerrorscape(room:TerrorscapeRoomRecord,state:TerrorscapeState,at:ServerTime):Omit<TerrorscapeRoomRecord,'storageRevision'> {
  if(!room.game)throw new Error('Missing Terrorscape game.');
  const phase=state.phase==='FINISHED'?'FINISHED':'PLAYING';
  return {...room,phase,game:{...room.game,state,gameRevision:state.revision,finishedAt:state.finishedAt},roomRevision:phase===room.phase?room.roomRevision:v.parse(RoomRevisionSchema,room.roomRevision+1),updatedAt:at};
}
export class TerrorscapeService {
  private readonly listeners=new Set<(roomId:RoomId)=>void|Promise<void>>();
  constructor(readonly deps:TerrorscapeDependencies) {}
  subscribe(listener:(roomId:RoomId)=>void|Promise<void>){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  async notify(roomId:RoomId){await Promise.allSettled([...this.listeners].map(fn=>Promise.resolve().then(()=>fn(roomId))));}
  async start(input:StartGameInput):Promise<GameStartResult> {
    const d=this.deps;
    try {return await d.roomMutationExecutor.run(input.roomId,async ():Promise<GameStartResult>=>{
      if(!input.authorization.isCurrent())return failure('UNAUTHENTICATED');
      const room=await d.roomRepository.findById(input.roomId);
      if(room?.gameType!=='TERRORSCAPE'||room.departedPlayerIds?.includes(input.actorPlayerId)||!room.players.some(p=>p.playerId===input.actorPlayerId))return failure('INVALID_PHASE');
      const scopeKey=`room-player:${room.roomId}:${input.actorPlayerId}`,payloadFingerprint=JSON.stringify(['game:start',input.expectedRoomRevision]);
      const prior=await d.idempotencyRepository.classify(scopeKey,input.requestId,payloadFingerprint);
      if(prior.status==='CONFLICT')return failure('REQUEST_ID_REUSED');
      if(prior.status==='REPLAY')return {ok:true,data:v.parse(GameStartSuccessDataSchema,prior.record.terminalResult)};
      if(room.phase!=='LOBBY'||room.game!==null)return failure('INVALID_PHASE');
      if(room.hostPlayerId!==input.actorPlayerId)return failure('HOST_ONLY');
      if(room.roomRevision!==input.expectedRoomRevision)return failure('STALE_ROOM_REVISION');
      if((room.players.length<2||room.players.length>4))return failure('NOT_ENOUGH_PLAYERS');
      const lease=await d.presence.acquireRoomPresenceLease(room.roomId);
      if(!lease.isCurrent()||!room.players.every(p=>lease.connectionStatusByPlayerId.get(p.playerId)==='CONNECTED'))return failure('PLAYERS_NOT_CONNECTED');
      const now=d.clock.now(),gameId=d.ids.generateGameId(),turnId=d.ids.generateTurnId();
      const state=createTerrorscapeGame({cards:makeTerrorscapeCards(()=>d.ids.generateTileId()),gameId,playerIds:room.players.map(p=>p.playerId),now,turnId,random:d.random});
      const roomRevision=v.parse(RoomRevisionSchema,room.roomRevision+1),gameRevision=v.parse(GameRevisionSchema,0);
      const data=v.parse(GameStartSuccessDataSchema,{roomId:room.roomId,roomRevision,gameId,gameRevision,turnId});
      const committed=await d.roomUnitOfWork.commit({roomMutation:{kind:'REPLACE',candidate:{...room,phase:'PLAYING',roomRevision,updatedAt:now,game:{gameId,gameRevision,startedAt:now,finishedAt:null,state}},expectedRoomRevision:room.roomRevision,expectedStorageRevision:room.storageRevision},sessionMutation:{kind:'NONE'},idempotency:{scopeKey,requestId:input.requestId,payloadFingerprint,terminalResult:data,createdAt:now}},{isSatisfied:()=>input.authorization.isCurrent()&&lease.isCurrent()});
      return committed.status==='COMMITTED'?{ok:true,data}:failure('STALE_ROOM_REVISION');
    });}catch{return failure('INTERNAL_ERROR');}
  }
  async command(input:Readonly<{roomId:RoomId;actorPlayerId:PlayerId;command:TerrorscapeClientCommand;receivedAt:ServerTime;authorization:{isCurrent():boolean}}>) {
    const parsed=v.safeParse(TerrorscapeClientCommandSchema,input.command);if(!parsed.success)return failure('INVALID_PAYLOAD');
    const d=this.deps,c=parsed.output;let changed=false;
    try {
      const result=await d.roomMutationExecutor.run(input.roomId,async()=>{
        if(!input.authorization.isCurrent())return failure('UNAUTHENTICATED');
        const room=await d.roomRepository.findById(input.roomId);
        if(room?.gameType!=='TERRORSCAPE'||room.departedPlayerIds?.includes(input.actorPlayerId)||!room.players.some(p=>p.playerId===input.actorPlayerId))return failure('INVALID_PHASE');
        const scopeKey=`room-player:${room.roomId}:${input.actorPlayerId}`,payloadFingerprint=JSON.stringify(c);
        const prior=await d.idempotencyRepository.classify(scopeKey,c.requestId,payloadFingerprint);
        if(prior.status==='CONFLICT')return failure('REQUEST_ID_REUSED');
        if(prior.status==='REPLAY'){v.parse(Receipt,prior.record.terminalResult);return {ok:true as const};}
        if(!room.game||room.game.gameId!==c.gameId||(input.actorPlayerId===room.game.state.killerPlayerId?room.game.state.killerRevision:room.game.state.survivorRevision)!==c.expectedGameRevision)return failure('STALE_GAME_REVISION');
        if(room.phase!=='PLAYING')return failure('INVALID_PHASE');
        const s=room.game.state,now=v.parse(ServerTimeSchema,d.clock.now());
        if(c.turnId!==(input.actorPlayerId===s.killerPlayerId?s.killerTurnId:s.survivorTurnId))return failure('STALE_GAME_REVISION');
        const applied=applyTerrorscapeAction(s,input.actorPlayerId,c.payload,now,d.ids.generateTurnId(),d.random,room.hostPlayerId);
        if(!applied.ok)return failure(applied.reason==='INVALID_ACTION'?'RULE_VIOLATION':applied.reason);
        const committed=await d.roomUnitOfWork.commit({roomMutation:{kind:'REPLACE',candidate:transitionTerrorscape(room,applied.state,now),expectedRoomRevision:room.roomRevision,expectedStorageRevision:room.storageRevision},sessionMutation:{kind:'NONE'},idempotency:{scopeKey,requestId:c.requestId,payloadFingerprint,terminalResult:{outcome:'ACCEPTED'},createdAt:now}},{isSatisfied:()=>input.authorization.isCurrent()});
        if(committed.status!=='COMMITTED')return failure('STALE_GAME_REVISION');
        changed=true;return {ok:true as const};
      });
      if(changed)await this.notify(input.roomId);
      return result;
    }catch{return failure('INTERNAL_ERROR');}
  }
}
