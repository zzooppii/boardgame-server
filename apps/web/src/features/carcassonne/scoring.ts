import {
  analyzeCarcassonneBoard,
  carcassonneAwardPoints,
  carcassonneRegionKey,
  type CarcassonneProjection,
  type CarcassonneScoreEvent,
} from "@hangul-rummikub/shared";
export const FINAL_SCORE_CATEGORIES = [
  { kind: "ROAD", key: "roads", label: "도로" },
  { kind: "CITY", key: "cities", label: "도시" },
  { kind: "MONASTERY", key: "monasteries", label: "수도원" },
  { kind: "FIELD", key: "fields", label: "들판" },
] as const;
export function finalScoreEvents(
  game: CarcassonneProjection,
  playerId: string,
  kind: CarcassonneScoreEvent["kind"],
) {
  return game.phase === "FINISHED" && game.result.reason === "TILES_EXHAUSTED"
    ? game.result.finalScoring
        .filter(
          (e) =>
            e.kind === kind && e.winnerPlayerIds.some((id) => id === playerId),
        )
        .map((e) => ({ ...e, points: carcassonneAwardPoints(e, playerId) }))
    : [];
}
/** Resolve server-awarded points to exact regions, not every region on each tile. */
export function scoreEventGeometry(
  game: CarcassonneProjection,
  event: CarcassonneScoreEvent,
) {
  const features = analyzeCarcassonneBoard(game.board, game.meeples),
    feature = features.find((f) => f.id === event.featureId);
  const cities =
    event.kind === "FIELD"
      ? features.filter((f) => feature?.completedCityIds.includes(f.id))
      : [];
  return {
    nodes: feature?.nodes ?? [],
    cityNodes: cities.flatMap((f) => f.nodes),
    tileIds: [
      ...new Set([
        ...(feature?.tileIds ?? event.tileIds),
        ...cities.flatMap((f) => f.tileIds),
      ]),
    ],
  };
}
export function scoreEventFormula(event: CarcassonneScoreEvent): string {
  const count = new Set(event.tileIds).size;
  if (!event.complete && event.inn) return "여관이 있는 미완성 도로 = 0점";
  if (!event.complete && event.cathedral)
    return "성당이 있는 미완성 도시 = 0점";
  switch (event.kind) {
    case "CITY":
      return `${count}타일 + 방패 ${event.shields}개${event.cathedral ? " · 성당 ×3" : event.complete ? " · 완성 ×2" : " · 미완성 ×1"} = ${event.points}점`;
    case "ROAD":
      return `${count}타일 × ${event.inn ? 2 : 1}점${event.inn ? " (여관)" : ""} = ${event.points}점`;
    case "MONASTERY":
      return `수도원과 주변 ${event.points}칸 × 1점 = ${event.points}점`;
    case "FIELD":
      return `서로 다른 완성 도시 ${event.cityCount}개 × ${event.cityCount > 0 && event.points === event.cityCount * 4 ? "4점 (돼지)" : "3점"} = ${event.points}점`;
  }
}
export function freshCarcassonneFeedback(
  previous: CarcassonneProjection | null,
  next: CarcassonneProjection | null,
) {
  if (
    !previous ||
    !next ||
    previous.phase !== "PLAYING" ||
    previous.gameId !== next.gameId ||
    next.gameRevision !== previous.gameRevision + 1 ||
    (next.phase === "FINISHED" && next.result.reason === "CANCELLED") ||
    !next.feedback ||
    next.feedback.tile.tileId === previous.feedback?.tile.tileId
  )
    return null;
  return next.feedback;
}
export function carcassonneCelebration(
  previous: CarcassonneProjection | null,
  next: CarcassonneProjection | null,
) {
  const feedback = freshCarcassonneFeedback(previous, next);
  if (!feedback || !previous || !next) return null;
  const completed = feedback.scoring;
  const nodes = completed.flatMap((e) => scoreEventGeometry(next, e).nodes);
  const candidates = [
    ...previous.meeples,
    ...(feedback.meepleRegionId
      ? [
          {
            playerId: feedback.playerId,
            tileId: feedback.tile.tileId,
            regionId: feedback.meepleRegionId,
            piece: feedback.piece ?? "NORMAL",
          },
        ]
      : []),
  ];
  const returned = candidates.filter((m) =>
    nodes.includes(carcassonneRegionKey(m.tileId, m.regionId)),
  );
  const gains = next.playerStates
    .map((p) => ({
      playerId: p.playerId,
      points:
        p.score -
        (previous.playerStates.find((old) => old.playerId === p.playerId)
          ?.score ?? p.score),
    }))
    .filter((p) => p.points > 0);
  return {
    key: next.gameId + ":" + next.gameRevision,
    tileId: feedback.tile.tileId,
    nodes,
    returned,
    gains,
    completed,
  };
}
export type CarcassonneCelebration = NonNullable<
  ReturnType<typeof carcassonneCelebration>
>;
