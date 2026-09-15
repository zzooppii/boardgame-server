import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelArnak } from "../domain/game.js";
import { transitionArnak } from "./service.js";
export function createArnakLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'ARNAK' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Arnak playing room required.');
            const state = cancelArnak(room.game.state, input.occurredAt);
            return { candidate: transitionArnak(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
