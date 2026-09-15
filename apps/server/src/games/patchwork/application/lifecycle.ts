import type { PlayerId, ServerTime } from "@hangul-rummikub/shared";
import type { RoomRecord } from "../../../model/persistence.js";
import type { PlayingLeaveActionResult } from "../../../application/player-lifecycle-router.js";
import { cancelPatchwork } from "../domain/game.js";
import { transitionPatchwork } from "./service.js";
export function createPatchworkLifecycle() {
    return {
        applyPlayingLeave(input: {
            room: RoomRecord;
            actorPlayerId: PlayerId;
            occurredAt: ServerTime;
        }): PlayingLeaveActionResult {
            const { room } = input;
            if (room.gameType !== 'PATCHWORK' || room.phase !== 'PLAYING' || !room.game)
                throw new Error('Patchwork playing room required.');
            const state = cancelPatchwork(room.game.state, input.occurredAt);
            return { candidate: transitionPatchwork(room, state, input.occurredAt), advisory: 'NONE', finishedGameId: room.game.gameId, nextTurnIdentity: null };
        },
    };
}
