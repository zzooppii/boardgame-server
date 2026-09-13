import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelSpirit } from "../domain/game.js";
import { transitionSpirit } from "./service.js";
export function createSpiritLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'SPIRIT_ISLAND' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Spirit playing room required.');
            const state = cancelSpirit(room.game.state, input.occurredAt);
            return { candidate: transitionSpirit(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
