import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, type GameId, type GameRevision, type ServerTime } from "@hangul-rummikub/shared";
import { parse } from "valibot";
import { parseAvalonState, type AvalonState } from "../domain/game.js";
export type AvalonStoredGame = Readonly<{ gameId: GameId; gameRevision: GameRevision; startedAt: ServerTime; finishedAt: ServerTime | null; state: AvalonState }>;
export type AvalonLifecycle =
  | Readonly<{ lifecycle: "RUNNING"; gameId: GameId; gameRevision: GameRevision; activeTurn: null }>
  | Readonly<{ lifecycle: "FINISHED"; gameId: GameId; finishedAt: ServerTime }>;
export class AvalonGameStateAdapter {
  cloneAndValidate(game: AvalonStoredGame): AvalonStoredGame {
    const state = parseAvalonState(game.state), gameId = parse(GameIdSchema, game.gameId), gameRevision = parse(GameRevisionSchema, game.gameRevision), startedAt = parse(ServerTimeSchema, game.startedAt);
    if (state.gameId !== gameId || state.revision !== gameRevision || state.startedAt !== startedAt || state.finishedAt !== game.finishedAt) throw new Error("AVALON stored metadata mismatch.");
    return { gameId, gameRevision, startedAt, finishedAt: state.finishedAt === null ? null : parse(ServerTimeSchema, state.finishedAt), state };
  }
  inspectLifecycle(game: AvalonStoredGame): AvalonLifecycle {
    if (game.state.phase === "FINISHED") {
      if (game.finishedAt === null) throw new Error("AVALON missing finish time.");
      return { lifecycle: "FINISHED", gameId: game.gameId, finishedAt: game.finishedAt };
    }
    return { lifecycle: "RUNNING", gameId: game.gameId, gameRevision: game.gameRevision,
      activeTurn: null };
  }
}
