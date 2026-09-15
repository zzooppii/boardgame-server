import { type PlayerId, type ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelAvalon } from "../domain/game.js";
import { transitionAvalon } from "./service.js";
export function createAvalonLifecycle() {
  return {
    applyPlayingLeave(input: { room: RoomRecord; actorPlayerId: PlayerId; occurredAt: ServerTime }): PlayingLeaveActionResult {
      const { room } = input;
      if (room.gameType !== "AVALON" || room.phase !== "PLAYING" || !room.game) throw new Error("AVALON playing room required.");
      const state = cancelAvalon(room.game.state, input.occurredAt);
      return { candidate: transitionAvalon(room, state, input.occurredAt), advisory: "NONE", finishedGameId: state.phase === "FINISHED" ? room.game.gameId : null,
        nextTurnIdentity: null };
    },
  };
}
