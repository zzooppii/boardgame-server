import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelPandemic } from "../domain/game.js";
import { transitionPandemic } from "./service.js";
export function createPandemicLifecycle(){return {
  applyPlayingLeave(input:{room:RoomRecord;actorPlayerId:PlayerId;occurredAt:ServerTime}):PlayingLeaveActionResult {
    const {room}=input;if(room.gameType!=='PANDEMIC'||room.phase!=='PLAYING'||!room.game)throw new Error('Pandemic playing room required.');
    const state=cancelPandemic(room.game.state,input.occurredAt);
    return {candidate:transitionPandemic(room,state,input.occurredAt),advisory:'NONE',finishedGameId:room.game.gameId,nextTurnIdentity:null};
  },
};}
