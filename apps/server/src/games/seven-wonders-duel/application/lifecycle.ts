import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelDuel } from "../domain/game.js";
import { transitionDuel } from "./service.js";
export function createDuelLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'SEVEN_WONDERS_DUEL' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Duel playing room required.');
            const state = cancelDuel(room.game.state, input.occurredAt);
            return { candidate: transitionDuel(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
