import {arkNovaPlayerIds} from '../compatibility/adapter.js';
import * as v from 'valibot';
import { ArkNovaActCommandSchema, type ArkNovaActCommand, type ErrorDto, type PlayerId, type RoomId } from '@hangul-rummikub/shared';
import type { RoomMutationSerialExecutor } from '../../../application/room-session-service.js';
import type { IdempotencyRepository } from '../../../ports/idempotency-repository.js';
import type { Clock, IdGenerator, RandomSource } from '../../../ports/system.js';
import type { ArkNovaCommandStore } from './command-store.js';
import { prepareArkNovaCommand } from './prepare-command.js';

type Result=Readonly<{ok:true}>|Readonly<{ok:false;error:ErrorDto}>;
const failure=(code:ErrorDto['code']):Result=>({ok:false,error:{code,message:'현재 연결과 게임 상태, 선택 내용을 확인해주세요.',recoverable:true}});
const receiptSchema=v.strictObject({outcome:v.literal('ACCEPTED')});

/** Canonical JSON keeps equivalent object key order from conflicting on reconnect/retry. */
export function arkNovaCommandFingerprint(command:ArkNovaActCommand):string {
  const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value!==null&&typeof value==='object'?
    Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,ordered(item)])):value;
  return JSON.stringify(ordered(command));
}

/** Concrete command orchestration; the platform binds its existing room/UoW through commandStore. */
export class ArkNovaCommandService {
  constructor(private readonly deps:Readonly<{
    commandStore:ArkNovaCommandStore;idempotencyRepository:IdempotencyRepository;roomMutationExecutor:RoomMutationSerialExecutor;
    clock:Clock;ids:Pick<IdGenerator,'generateTurnId'>;random:RandomSource;notify(roomId:RoomId):Promise<void>;
  }>) {}
  async command(input:Readonly<{roomId:RoomId;actorPlayerId:PlayerId;command:unknown;authorization:{isCurrent():boolean}}>):Promise<Result> {
    const parsed=v.safeParse(ArkNovaActCommandSchema,input.command);if(!parsed.success)return failure('INVALID_PAYLOAD');
    const command=parsed.output,d=this.deps;let changed=false;
    try {
      const result=await d.roomMutationExecutor.run(input.roomId,async ():Promise<Result>=>{
        if(!input.authorization.isCurrent())return failure('UNAUTHENTICATED');
        const room=await d.commandStore.load(input.roomId);
        if(!room)return failure('INVALID_PHASE');
        if(room.roomId!==input.roomId)return failure('INTERNAL_ERROR');
        if(!room.activePlayerIds.includes(input.actorPlayerId)||!arkNovaPlayerIds(room.game.state).includes(input.actorPlayerId))return failure('UNAUTHENTICATED');
        const seats=arkNovaPlayerIds(room.game.state);if(seats.length!==room.activePlayerIds.length||seats.some(id=>!room.activePlayerIds.includes(id)))return failure('INVALID_PHASE');
        const scopeKey=`room-player:${room.roomId}:${input.actorPlayerId}`,payloadFingerprint=arkNovaCommandFingerprint(command);
        const prior=await d.idempotencyRepository.classify(scopeKey,command.requestId,payloadFingerprint);
        if(!input.authorization.isCurrent())return failure('UNAUTHENTICATED');
        if(prior.status==='CONFLICT')return failure('REQUEST_ID_REUSED');
        if(prior.status==='REPLAY') {v.parse(receiptSchema,prior.record.terminalResult);return {ok:true};}
        if(room.phase!=='PLAYING')return failure('INVALID_PHASE');
        const prepared=prepareArkNovaCommand(room.game,input.actorPlayerId,command,{clock:d.clock,ids:d.ids,random:d.random,authorization:input.authorization});
        if(!prepared.ok)return prepared;
        const committed=await d.commandStore.commit({expected:room,game:prepared.game,authorization:input.authorization,
          receipt:{scopeKey,requestId:command.requestId,payloadFingerprint,terminalResult:{outcome:'ACCEPTED'},createdAt:d.clock.now()}});
        if(committed!=='COMMITTED')return failure(committed==='AUTH_CHANGED'?'UNAUTHENTICATED':'STALE_GAME_REVISION');
        changed=true;return {ok:true};
      });
      // Delivery failure must not make an already committed action look rejected; sync/retry recovers it.
      if(changed)await Promise.allSettled([Promise.resolve().then(()=>d.notify(input.roomId))]);
      return result;
    } catch {return failure('INTERNAL_ERROR');}
  }
}
