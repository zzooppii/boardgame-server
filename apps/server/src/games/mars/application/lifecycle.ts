import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelMars } from "../domain/game.js";
import { transitionMars } from "./service.js";
export function createMarsLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'TERRAFORMING_MARS' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Mars playing room required.');
            const state = cancelMars(room.game.state, input.occurredAt);
            return { candidate: transitionMars(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
