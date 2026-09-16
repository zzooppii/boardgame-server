import type { PlayerId } from "@hangul-rummikub/shared";
import type { GreatKingdomStoredGame } from "./adapter.js";
import { publicGreatKingdom } from "../domain/game.js";
export function projectGreatKingdom(game: GreatKingdomStoredGame, viewer: PlayerId) {
  if (!game.state.players.some(p => p.playerId === viewer)) throw new Error("Great Kingdom viewer missing.");
  return publicGreatKingdom(game.state);
}
