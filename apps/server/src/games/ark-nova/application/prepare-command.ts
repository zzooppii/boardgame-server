import {applyArkMultiplayerCommand} from '../domain/multiplayer.js';
import * as v from 'valibot';
import { ArkNovaActCommandSchema, type ErrorDto, type PlayerId, type RequestId } from '@hangul-rummikub/shared';
import type { Clock, IdGenerator, RandomSource } from '../../../ports/system.js';
import { applyArkSoloCommand } from '../domain/game.js';
import { ArkNovaGameStateAdapter, arkNovaPlayerIds, type ArkNovaStoredGame } from '../compatibility/adapter.js';

type Authorization=Readonly<{isCurrent():boolean}>;
type Prepared=
  | Readonly<{ok:true;game:ArkNovaStoredGame;requestId:RequestId}>
  | Readonly<{ok:false;error:ErrorDto}>;
const failure=(code:ErrorDto['code']):Prepared=>({ok:false,error:{code,message:'현재 연결과 게임 상태, 선택 내용을 확인해주세요.',recoverable:true}});

/** Called inside the room mutation executor after receipt lookup. This returns a candidate only;
 * the room service must atomically commit it with the receipt and recheck authorization at commit. */
export function prepareArkNovaCommand(current:ArkNovaStoredGame,actor:PlayerId,input:unknown,
  deps:Readonly<{clock:Clock;ids:Pick<IdGenerator,'generateTurnId'>;random:RandomSource;authorization:Authorization}>):Prepared {
  if(!deps.authorization.isCurrent()||!arkNovaPlayerIds(current.state).includes(actor))return failure('UNAUTHENTICATED');
  const parsed=v.safeParse(ArkNovaActCommandSchema,input);if(!parsed.success)return failure('INVALID_PAYLOAD');
  const command=parsed.output;
  if(command.gameId!==current.gameId||command.expectedGameRevision!==current.gameRevision||command.turnId!==current.state.transitionId)return failure('STALE_GAME_REVISION');
  try {
    const adapter=new ArkNovaGameStateAdapter(),stored=adapter.cloneAndValidate(current);
    const result='mode' in stored.state?applyArkMultiplayerCommand(stored.state,actor,command.expectedGameRevision,command.payload,deps.clock.now(),deps.ids.generateTurnId(),deps.random):applyArkSoloCommand(stored.state,actor,command.expectedGameRevision,command.payload,deps.clock.now(),deps.ids.generateTurnId(),deps.random);
    if(!result.ok)return failure(result.reason==='INVALID_PHASE'?'INVALID_PHASE':result.reason==='STALE_REVISION'?'STALE_GAME_REVISION':result.reason==='UNAUTHORIZED'?'UNAUTHENTICATED':'RULE_VIOLATION');
    if(!deps.authorization.isCurrent())return failure('UNAUTHENTICATED');
    return {ok:true,requestId:command.requestId,game:adapter.cloneAndValidate({...stored,state:result.state,gameRevision:result.state.revision,finishedAt:result.state.finishedAt})};
  } catch {return failure('INTERNAL_ERROR');}
}
