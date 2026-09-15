import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelHarmonies } from "../domain/game.js";
import { transitionHarmonies } from "./service.js";
export function createHarmoniesLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'HARMONIES' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Harmonies playing room required.');
            const state = cancelHarmonies(room.game.state, input.occurredAt);
            return { candidate: transitionHarmonies(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
