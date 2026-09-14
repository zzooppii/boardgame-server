import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelPerch } from "../domain/game.js";
import { transitionPerch } from "./service.js";
export function createPerchLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'PERCH' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Perch playing room required.');
            const state = cancelPerch(room.game.state, input.occurredAt);
            return { candidate: transitionPerch(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
