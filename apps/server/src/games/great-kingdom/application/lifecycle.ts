import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelGreatKingdom } from "../domain/game.js";
import { transitionGreatKingdom } from "./service.js";
export function createGreatKingdomLifecycle(){return {
  applyPlayingLeave(input:{room:RoomRecord;actorPlayerId:PlayerId;occurredAt:ServerTime}):PlayingLeaveActionResult {
    const {room}=input;if(room.gameType!=='GREAT_KINGDOM'||room.phase!=='PLAYING'||!room.game)throw new Error('GreatKingdom playing room required.');
    const state=cancelGreatKingdom(room.game.state,input.occurredAt);
    return {candidate:transitionGreatKingdom(room,state,input.occurredAt),advisory:'NONE',finishedGameId:room.game.gameId,nextTurnIdentity:null};
  },
};}
