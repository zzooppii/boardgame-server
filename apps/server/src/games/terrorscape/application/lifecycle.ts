import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelTerrorscape } from "../domain/game.js";
import { transitionTerrorscape } from "./service.js";
export function createTerrorscapeLifecycle(){return {
  applyPlayingLeave(input:{room:RoomRecord;actorPlayerId:PlayerId;occurredAt:ServerTime}):PlayingLeaveActionResult {
    const {room}=input;if(room.gameType!=='TERRORSCAPE'||room.phase!=='PLAYING'||!room.game)throw new Error('Terrorscape playing room required.');
    const state=cancelTerrorscape(room.game.state,input.occurredAt);
    return {candidate:transitionTerrorscape(room,state,input.occurredAt),advisory:'NONE',finishedGameId:room.game.gameId,nextTurnIdentity:null};
  },
};}
