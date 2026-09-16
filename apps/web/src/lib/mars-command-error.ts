import type {MarsAction,ProtocolErrorCode} from '@hangul-rummikub/shared';
export class MarsCommandRejected extends Error {
  constructor(message:string,readonly code?:ProtocolErrorCode){super(message);}
}
export function marsRejectionMessage(error:MarsCommandRejected,action:MarsAction):string{
  return error.code==='STALE_GAME_REVISION'&&(action.type==='SETUP'||action.type==='RESEARCH')
    ?'다른 참가자의 선택이 먼저 반영되었습니다. 내 선택은 유지됩니다. 내용을 확인하고 다시 확정해주세요.'
    :error.message;
}
