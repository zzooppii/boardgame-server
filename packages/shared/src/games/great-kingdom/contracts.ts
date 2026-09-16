import * as v from "valibot";
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from "../../identifiers.js";
import { GameRevisionSchema } from "../../protocol.js";
import { GreatKingdomBoardSchema, GreatKingdomColorSchema, GreatKingdomPositionSchema } from "./actions.js";
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(81));
export const GreatKingdomMoveSchema = v.strictObject({
  move: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(162)),
  playerId: PlayerIdSchema, color: GreatKingdomColorSchema,
  kind: v.picklist(["PLACE", "PASS"]), position: v.nullable(GreatKingdomPositionSchema),
});
export const GreatKingdomResultSchema = v.strictObject({
  reason: v.picklist(["SIEGE", "TERRITORY", "CANCELLED"]),
  winnerPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(1)),
  destroyedPositions: v.pipe(v.array(GreatKingdomPositionSchema), v.maxLength(40)),
});
const Base = {
  gameType: v.literal("GREAT_KINGDOM"), gameId: GameIdSchema, gameRevision: GameRevisionSchema,
  rulesVersion: v.literal("great-kingdom-base-v2"),

  board: GreatKingdomBoardSchema,
  territoryOwners: v.pipe(v.array(v.nullable(GreatKingdomColorSchema)), v.length(81)),
  playerStates: v.pipe(v.array(v.strictObject({playerId: PlayerIdSchema, color: GreatKingdomColorSchema,
    remaining: v.pipe(count, v.maxValue(40)), territory: count})), v.length(2)),
  history: v.pipe(v.array(GreatKingdomMoveSchema), v.maxLength(162)),
  consecutivePasses: v.pipe(count, v.maxValue(2)),
};
export const GreatKingdomPlayingProjectionSchema = v.strictObject({...Base, phase: v.literal("PLAYING"),
  turnId: TurnIdSchema, activePlayerId: PlayerIdSchema, legalPositions: v.pipe(v.array(GreatKingdomPositionSchema), v.maxLength(80))});
export const GreatKingdomFinishedProjectionSchema = v.strictObject({...Base, phase: v.literal("FINISHED"), result: GreatKingdomResultSchema});
export type GreatKingdomProjection = v.InferOutput<typeof GreatKingdomPlayingProjectionSchema> | v.InferOutput<typeof GreatKingdomFinishedProjectionSchema>;
export function greatKingdomProjectionIsConsistent(g: GreatKingdomProjection): boolean {
  const ids = new Set(g.playerStates.map(p => p.playerId));
  const castles = g.board.filter(c => c !== null);
  if (ids.size !== 2 || g.playerStates[0]?.color !== "BLUE" || g.playerStates[1]?.color !== "ORANGE" ||
    g.board[40]?.color !== "NEUTRAL" || castles.filter(c => c.color === "NEUTRAL").length !== 1 ||
    new Set(castles.map(c => c.tileId)).size !== castles.length) return false;
  if (g.playerStates.some(p => p.remaining + castles.filter(c => c.color === p.color).length !== 40 ||
    p.territory !== g.territoryOwners.filter(c => c === p.color).length)) return false;
  if (g.territoryOwners.some((owner, i) => owner !== null && g.board[i] !== null && g.board[i]?.color !== "NEUTRAL")) return false;
  const positions = g.history.flatMap(h => h.position === null ? [] : [h.position]);
  if (new Set(positions).size !== positions.length || positions.length !== castles.length - 1) return false;
  if (g.history.some((h, i) => h.move !== i + 1 || h.playerId !== g.playerStates[i % 2]?.playerId || h.color !== g.playerStates[i % 2]?.color ||
    (h.kind === "PASS" ? h.position !== null : h.position === null || g.board[h.position]?.color !== h.color))) return false;
  const passes = g.history.at(-1)?.kind === "PASS" ? (g.history.at(-2)?.kind === "PASS" ? 2 : 1) : 0;
  if (passes !== g.consecutivePasses) return false;
  if (g.phase === "PLAYING") return g.gameRevision === g.history.length && passes < 2 &&
    g.activePlayerId === g.playerStates[g.history.length % 2]?.playerId &&
    new Set(g.legalPositions).size === g.legalPositions.length && g.legalPositions.every(i => g.board[i] === null &&
      g.territoryOwners[i] !== g.playerStates.find(p => p.playerId !== g.activePlayerId)?.color) &&
    (g.playerStates.find(p => p.playerId === g.activePlayerId)?.remaining !== 0 || g.legalPositions.length === 0);
  if (g.result.reason === "CANCELLED") return g.gameRevision === g.history.length + 1 && g.result.winnerPlayerIds.length === 0 && g.result.destroyedPositions.length === 0;
  if (g.gameRevision !== g.history.length) return false;
  if (g.result.reason === "TERRITORY") {
    const difference = g.playerStates[0]!.territory - g.playerStates[1]!.territory;
    const winner = difference === 0 ? null : g.playerStates[difference > 0 ? 0 : 1]!.playerId;
    return passes === 2 && g.result.destroyedPositions.length === 0 &&
      (winner === null ? g.result.winnerPlayerIds.length === 0 : g.result.winnerPlayerIds.length === 1 && g.result.winnerPlayerIds[0] === winner);
  }
  if (g.result.winnerPlayerIds.length !== 1 || !ids.has(g.result.winnerPlayerIds[0]!)) return false;
  const loser = g.playerStates.find(p => p.playerId !== g.result.winnerPlayerIds[0]);
  return g.history.at(-1)?.kind === "PLACE" && g.result.destroyedPositions.length > 0 &&
    new Set(g.result.destroyedPositions).size === g.result.destroyedPositions.length &&
    g.result.destroyedPositions.every(i => g.board[i]?.color === loser?.color);
}
