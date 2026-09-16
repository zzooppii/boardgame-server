import * as v from "valibot";
import {
  GameIdSchema,
  PlayerIdSchema,
  TileIdSchema,
  TurnIdSchema,
} from "../../identifiers.js";
import { GameRevisionSchema, ServerTimeSchema } from "../../protocol.js";
import {
  CarcassonneBoardTileSchema,
  CarcassonneSettingsSchema,
  CarcassonnePieceSchema,
  CarcassonneGoodsSchema,
  CarcassonneMeepleSchema,
  CarcassonneRegionIdSchema,
  CarcassonneTileSchema,
} from "./actions.js";
import {
  CARCASSONNE_CATALOG,
  CARCASSONNE_DEFAULT_SETTINGS,
  carcassonneTileCount,
  carcassonneTileEnabled,
  CARCASSONNE_RULES_VERSION,
  CARCASSONNE_TURN_DURATION_MS,
} from "./catalog.js";
import {
  CARCASSONNE_OFFSETS,
  analyzeCarcassonneBoard,
  carcassonneCellKey,
  carcassonneEdge,
} from "./geometry.js";
const count = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(0),
  v.maxValue(114),
);
const score = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(0),
  v.maxValue(10000),
);
export const CarcassonnePlayerSchema = v.strictObject({
  playerId: PlayerIdSchema,
  score,
  availableMeeples: v.pipe(count, v.maxValue(7)),
  availableBig: v.optional(v.boolean()),
  availableBuilder: v.optional(v.boolean()),
  availablePig: v.optional(v.boolean()),
  goods: v.optional(CarcassonneGoodsSchema),
});
export const CarcassonneScoreEventSchema = v.strictObject({
  featureId: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
  kind: v.picklist(["CITY", "ROAD", "FIELD", "MONASTERY"]),
  tileIds: v.pipe(v.array(TileIdSchema), v.minLength(1), v.maxLength(114)),
  points: score,
  winnerPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(5)),
  returnedPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(50)),
  final: v.boolean(),
  complete: v.boolean(),
  shields: count,
  cityCount: count,
  inn: v.optional(v.boolean()),
  cathedral: v.optional(v.boolean()),
  playerPoints: v.optional(
    v.array(
      v.strictObject({
        playerId: PlayerIdSchema,
        points: score,
        pig: v.boolean(),
      }),
    ),
  ),
});
export const CarcassonneFeedbackSchema = v.strictObject({
  playerId: PlayerIdSchema,
  tile: CarcassonneBoardTileSchema,
  meepleRegionId: v.nullable(CarcassonneRegionIdSchema),
  automatic: v.boolean(),
  piece: v.optional(CarcassonnePieceSchema),
  goods: v.optional(CarcassonneGoodsSchema),
  bonusTurn: v.optional(v.boolean()),
  at: ServerTimeSchema,
  scoring: v.pipe(v.array(CarcassonneScoreEventSchema), v.maxLength(300)),
});
export const CarcassonneResultSchema = v.strictObject({
  reason: v.picklist(["TILES_EXHAUSTED", "CANCELLED"]),
  winnerPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(5)),
  scores: v.pipe(
    v.array(
      v.strictObject({
        playerId: PlayerIdSchema,
        base: score,
        roads: score,
        cities: score,
        monasteries: score,
        fields: score,
        goods: v.optional(score),
        total: score,
      }),
    ),
    v.maxLength(5),
  ),
  finalScoring: v.pipe(v.array(CarcassonneScoreEventSchema), v.maxLength(300)),
});
const base = {
  gameType: v.literal("CARCASSONNE"),
  gameId: GameIdSchema,
  gameRevision: GameRevisionSchema,
  rulesVersion: v.literal(CARCASSONNE_RULES_VERSION),
  settings: v.optional(CarcassonneSettingsSchema),
  bonusTurn: v.optional(v.boolean()),
  board: v.pipe(
    v.array(CarcassonneBoardTileSchema),
    v.minLength(1),
    v.maxLength(114),
  ),
  meeples: v.pipe(v.array(CarcassonneMeepleSchema), v.maxLength(50)),
  currentTile: v.nullable(CarcassonneTileSchema),
  bagCount: count,
  discardedTiles: v.pipe(v.array(CarcassonneTileSchema), v.maxLength(113)),
  playerStates: v.pipe(
    v.array(CarcassonnePlayerSchema),
    v.minLength(2),
    v.maxLength(5),
  ),
  feedback: v.nullable(CarcassonneFeedbackSchema),
  history: v.pipe(v.array(CarcassonneFeedbackSchema), v.maxLength(8)),
};
export const CarcassonnePlayingProjectionSchema = v.strictObject({
  ...base,
  phase: v.literal("PLAYING"),
  turnId: TurnIdSchema,
  activePlayerId: PlayerIdSchema,
  turnStartedAt: ServerTimeSchema,
  deadlineAt: ServerTimeSchema,
});
export const CarcassonneFinishedProjectionSchema = v.strictObject({
  ...base,
  phase: v.literal("FINISHED"),
  result: CarcassonneResultSchema,
});
export type CarcassonneScoreEvent = v.InferOutput<
  typeof CarcassonneScoreEventSchema
>;
export type CarcassonneFeedback = v.InferOutput<
  typeof CarcassonneFeedbackSchema
>;
export type CarcassonneResult = v.InferOutput<typeof CarcassonneResultSchema>;
export type CarcassonnePlayingProjection = v.InferOutput<
  typeof CarcassonnePlayingProjectionSchema
>;
export type CarcassonneFinishedProjection = v.InferOutput<
  typeof CarcassonneFinishedProjectionSchema
>;
export type CarcassonneProjection =
  CarcassonnePlayingProjection | CarcassonneFinishedProjection;
export function carcassonneProjectionIsConsistent(
  g: CarcassonneProjection,
): boolean {
  const settings = g.settings ?? CARCASSONNE_DEFAULT_SETTINGS;
  const players = new Set(g.playerStates.map((p) => p.playerId)),
    cells = new Map(g.board.map((t) => [carcassonneCellKey(t.x, t.y), t]));
  if (players.size !== g.playerStates.length || cells.size !== g.board.length)
    return false;
  const visible = [
    ...g.board,
    ...g.discardedTiles,
    ...(g.currentTile ? [g.currentTile] : []),
  ];
  if (
    new Set(visible.map((t) => t.tileId)).size !== visible.length ||
    visible.length + g.bagCount !== carcassonneTileCount(settings) ||
    visible.some((t) => !carcassonneTileEnabled(t.kind, settings))
  )
    return false;
  for (const kind of Object.keys(CARCASSONNE_CATALOG))
    if (
      visible.filter((t) => t.kind === kind).length >
      Object.values(CARCASSONNE_CATALOG).find((t) => t.kind === kind)!.count
    )
      return false;
  const start = cells.get("0,0");
  if (!start || start.kind !== "D" || start.rotation !== 0) return false;
  const visited = new Set<string>(["0,0"]),
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i]!;
    for (const [direction, [dx, dy]] of CARCASSONNE_OFFSETS.entries()) {
      const key = carcassonneCellKey(tile.x + dx, tile.y + dy),
        neighbor = cells.get(key);
      if (!neighbor) continue;
      if (
        carcassonneEdge(tile, direction) !==
        carcassonneEdge(neighbor, (direction + 2) % 4)
      )
        return false;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }
  if (
    visited.size !== g.board.length ||
    new Set(g.meeples.map((m) => m.tileId)).size !== g.meeples.length
  )
    return false;
  for (const m of g.meeples) {
    const tile = g.board.find((t) => t.tileId === m.tileId);
    if (
      !players.has(m.playerId) ||
      !tile ||
      !CARCASSONNE_CATALOG[tile.kind].regions.some((r) => r.id === m.regionId)
    )
      return false;
  }
  for (const p of g.playerStates)
    if (
      p.availableMeeples +
        g.meeples.filter(
          (m) =>
            m.playerId === p.playerId && (!m.piece || m.piece === "NORMAL"),
        ).length !==
      7
    )
      return false;
  for (const p of g.playerStates) {
    for (const [piece, available, enabled] of [
      ["BIG", p.availableBig, settings.innsAndCathedrals],
      ["BUILDER", p.availableBuilder, settings.tradersAndBuilders],
      ["PIG", p.availablePig, settings.tradersAndBuilders],
    ] as const) {
      if (
        Number(available ?? false) +
          g.meeples.filter(
            (m) => m.playerId === p.playerId && m.piece === piece,
          ).length !==
        Number(enabled)
      )
        return false;
    }
    if (
      !settings.tradersAndBuilders &&
      Object.values(p.goods ?? {}).some((n) => n !== 0)
    )
      return false;
  }
  const features = analyzeCarcassonneBoard(g.board, g.meeples);
  for (const f of features)
    for (const m of f.meeples) {
      if (m.piece === "BUILDER" || m.piece === "PIG") {
        if (
          m.piece === "BUILDER"
            ? f.kind !== "CITY" && f.kind !== "ROAD"
            : f.kind !== "FIELD"
        )
          return false;
        if (
          !f.meeples.some(
            (other) =>
              other.playerId === m.playerId &&
              (!other.piece ||
                other.piece === "NORMAL" ||
                other.piece === "BIG"),
          )
        )
          return false;
      }
    }
  for (const good of ["WINE", "GRAIN", "CLOTH"] as const) {
    const obtained = g.playerStates.reduce(
      (n, p) => n + (p.goods?.[good] ?? 0),
      0,
    );
    const complete = features
      .filter((f) => f.kind === "CITY" && f.complete)
      .reduce(
        (n, f) => n + (f.goods?.filter((g) => g === good).length ?? 0),
        0,
      );
    if (obtained !== complete) return false;
  }
  if (g.phase === "PLAYING") {
    if (
      !g.currentTile ||
      !players.has(g.activePlayerId) ||
      g.deadlineAt - g.turnStartedAt !== CARCASSONNE_TURN_DURATION_MS
    )
      return false;
    if (
      analyzeCarcassonneBoard(g.board, g.meeples).some(
        (f) => f.complete && f.meeples.length > 0,
      )
    )
      return false;
  }
  const validEvent = (event: CarcassonneScoreEvent) =>
    event.winnerPlayerIds.every((id) => players.has(id)) &&
    new Set(event.winnerPlayerIds).size === event.winnerPlayerIds.length &&
    event.returnedPlayerIds.every((id) => players.has(id)) &&
    event.tileIds.every((id) => g.board.some((t) => t.tileId === id));
  for (const feedback of [...g.history, ...(g.feedback ? [g.feedback] : [])])
    if (
      !players.has(feedback.playerId) ||
      !g.board.some((t) => t.tileId === feedback.tile.tileId) ||
      !feedback.scoring.every(validEvent)
    )
      return false;
  if (g.phase === "FINISHED") {
    const result = g.result;
    if (result.reason === "CANCELLED")
      return (
        result.winnerPlayerIds.length === 0 &&
        result.scores.length === 0 &&
        result.finalScoring.length === 0
      );
    if (
      g.currentTile !== null ||
      g.bagCount !== 0 ||
      result.scores.length !== players.size ||
      new Set(result.scores.map((s) => s.playerId)).size !== players.size ||
      !result.finalScoring.every(validEvent)
    )
      return false;
    if (
      result.scores.some(
        (s) =>
          !players.has(s.playerId) ||
          s.total !==
            s.base +
              s.roads +
              s.cities +
              s.monasteries +
              s.fields +
              (s.goods ?? 0) ||
          g.playerStates.find((p) => p.playerId === s.playerId)?.score !==
            s.total,
      )
    )
      return false;
    const best = Math.max(...result.scores.map((s) => s.total)),
      winners = result.scores
        .filter((s) => s.total === best)
        .map((s) => s.playerId);
    if (
      result.winnerPlayerIds.length !== winners.length ||
      new Set(result.winnerPlayerIds).size !== winners.length ||
      !winners.every((id) => result.winnerPlayerIds.includes(id))
    )
      return false;
  }
  return true;
}

export function carcassonneAwardPoints(
  event: CarcassonneScoreEvent,
  playerId: string,
): number {
  return (
    event.playerPoints?.find((p) => p.playerId === playerId)?.points ??
    (event.winnerPlayerIds.some((id) => id === playerId) ? event.points : 0)
  );
}
