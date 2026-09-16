import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "valibot";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type CarcassonneProjection,
  CarcassonnePlayingProjectionSchema,
  CarcassonneFinishedProjectionSchema,
  CarcassonneScoreEventSchema,
  analyzeCarcassonneBoard,
  carcassonneRegionKey,
} from "@hangul-rummikub/shared";
import {
  carcassonneCelebration,
  finalScoreEvents,
  scoreEventGeometry,
  scoreEventFormula,
} from "../features/carcassonne/scoring.js";
import { carcassonneTransitionCues } from "../features/carcassonne/sound.js";
import { ScoreDetails } from "../features/carcassonne/ScoreDetails.js";
import { CarcassonneTileArt } from "../features/carcassonne/art.js";
const playing = () =>
  parse(CarcassonnePlayingProjectionSchema, {
    gameType: "CARCASSONNE",
    gameId: "game",
    gameRevision: 0,
    rulesVersion: "carcassonne-base72-v1",
    phase: "PLAYING",
    turnId: "turn",
    activePlayerId: "a",
    turnStartedAt: 1000,
    deadlineAt: 91000,
    board: [{ tileId: "start", kind: "D", x: 0, y: 0, rotation: 0 }],
    currentTile: { tileId: "closing", kind: "E" },
    bagCount: 70,
    discardedTiles: [],
    meeples: [],
    playerStates: [
      { playerId: "a", score: 0, availableMeeples: 7 },
      { playerId: "b", score: 0, availableMeeples: 7 },
    ],
    feedback: null,
    history: [],
  });
function closing() {
  const old = playing(),
    placed = { ...old.currentTile!, x: 1, y: 0, rotation: 270 as const },
    board = [...old.board, placed],
    city = analyzeCarcassonneBoard(board, []).find((f) => f.kind === "CITY")!;
  const event = parse(CarcassonneScoreEventSchema, {
    featureId: city.id,
    kind: "CITY",
    tileIds: city.tileIds,
    points: 4,
    winnerPlayerIds: ["a"],
    returnedPlayerIds: ["a"],
    final: false,
    complete: true,
    shields: 0,
    cityCount: 0,
  });
  const next = parse(CarcassonnePlayingProjectionSchema, {
    ...old,
    gameRevision: 1,
    turnId: "next",
    activePlayerId: "b",
    board,
    bagCount: 69,
    currentTile: { tileId: "following", kind: "B" },
    playerStates: [{ ...old.playerStates[0], score: 4 }, old.playerStates[1]],
    feedback: {
      playerId: "a",
      tile: placed,
      meepleRegionId: "c0",
      automatic: false,
      at: 2000,
      scoring: [event],
    },
  });
  return { old, next, event };
}
function final() {
  const { next } = closing();
  next.meeples = [
    {
      playerId: next.playerStates[0]!.playerId,
      tileId: next.board[1]!.tileId,
      regionId: "f0",
    },
  ];
  const field = analyzeCarcassonneBoard(next.board, next.meeples).find((f) =>
    f.nodes.includes(carcassonneRegionKey(next.board[1]!.tileId, "f0")),
  )!;
  const event = parse(CarcassonneScoreEventSchema, {
    featureId: field.id,
    kind: "FIELD",
    tileIds: field.tileIds,
    points: 3,
    winnerPlayerIds: ["a", "b"],
    returnedPlayerIds: [],
    final: true,
    complete: false,
    shields: 0,
    cityCount: 1,
  });
  const {
    turnId: _turn,
    activePlayerId: _active,
    turnStartedAt: _started,
    deadlineAt: _deadline,
    ...base
  } = next;
  return {
    event,
    game: parse(CarcassonneFinishedProjectionSchema, {
      ...base,
      phase: "FINISHED",
      currentTile: null,
      bagCount: 0,
      result: {
        reason: "TILES_EXHAUSTED",
        winnerPlayerIds: ["a"],
        scores: [],
        finalScoring: [event],
      },
    }),
  };
}
test("Final scoring: tied players each see the full award; fields highlight their exact region and unique completed city separately", () => {
  const { game, event } = final();
  assert.deepEqual(finalScoreEvents(game, "a", "FIELD"), [event]);
  assert.deepEqual(finalScoreEvents(game, "b", "FIELD"), [event]);
  assert.deepEqual(finalScoreEvents(game, "a", "CITY"), []);
  const geometry = scoreEventGeometry(game, event);
  assert.deepEqual(geometry.nodes, ["closing/f0"]);
  assert.deepEqual(
    new Set(geometry.cityNodes),
    new Set(["closing/c0", "start/c0"]),
  );
  assert.equal(geometry.nodes.includes("start/f0"), false);
  assert.equal(new Set(geometry.tileIds).size, 2);
  assert.equal(scoreEventFormula(event), "서로 다른 완성 도시 1개 × 3점 = 3점");
  const html = renderToStaticMarkup(
    createElement(ScoreDetails, {
      playerName: "가",
      events: [event],
      selectedId: event.featureId,
      nickname: (id) => id,
      onSelect() {},
      onClose() {},
    }),
  );
  assert.match(html, /각자 전체 점수/);
  assert.match(html, /같은 도시는 한 번/);
  assert.match(html, /aria-pressed="true"/);
  const art = renderToStaticMarkup(
    createElement(CarcassonneTileArt, {
      kind: "E",
      highlight: ["f0"],
      secondaryHighlight: ["c0"],
    }),
  );
  assert.match(art, /#79d6e5/);
  assert.match(art, /#fff397/);
});
test("Score explanations distinguish unfinished shields, monasteries, zero-city farms and separate feature buttons", () => {
  const { game, event } = final();
  assert.equal(
    scoreEventFormula({
      ...event,
      kind: "CITY",
      tileIds: ["start", "closing"].map(
        (id) => game.board.find((t) => t.tileId === id)!.tileId,
      ),
      shields: 1,
      points: 3,
    }),
    "2타일 + 방패 1개 · 미완성 ×1 = 3점",
  );
  assert.match(
    scoreEventFormula({ ...event, kind: "MONASTERY", points: 7 }),
    /7칸/,
  );
  assert.match(
    scoreEventFormula({ ...event, cityCount: 0, points: 0 }),
    /0개 × 3점 = 0점/,
  );
  const second = { ...event, featureId: "other", points: 0, cityCount: 0 };
  const html = renderToStaticMarkup(
    createElement(ScoreDetails, {
      playerName: "가",
      events: [event, second],
      selectedId: "other",
      nickname: (id) => id,
      onSelect() {},
      onClose() {},
    }),
  );
  assert.match(html, /들판 2/);
  assert.match(html, /0개 × 3점/);
});
test("Celebration: newly placed-and-returned meeple is visible even when reserve never changes; points come from server scores", () => {
  const { old, next } = closing(),
    effect = carcassonneCelebration(old, next);
  assert.ok(effect);
  assert.equal(effect.returned.length, 1);
  assert.equal(effect.returned[0]!.tileId, "closing");
  assert.deepEqual(effect.gains, [{ playerId: "a", points: 4 }]);
  assert.equal(effect.nodes.length, 2);
  assert.equal(
    old.playerStates[0]!.availableMeeples,
    next.playerStates[0]!.availableMeeples,
  );
  assert.deepEqual(carcassonneTransitionCues(old, next, "b"), [
    "PLACE",
    "SCORE",
    "RETURN",
    "TURN",
  ]);
});
test("Celebration: existing meeples return for all tied owners and simultaneous completion events are retained", () => {
  const { old, next, event } = closing();
  old.meeples = [
    {
      playerId: old.playerStates[1]!.playerId,
      tileId: old.board[0]!.tileId,
      regionId: "c0",
    },
  ];
  old.playerStates[1]!.availableMeeples = 6;
  next.feedback!.scoring = [
    {
      ...event,
      winnerPlayerIds: old.playerStates.map((p) => p.playerId),
      returnedPlayerIds: old.playerStates.map((p) => p.playerId),
    },
    { ...event, featureId: "additional", kind: "ROAD" },
  ];
  next.playerStates[1]!.score = 4;
  const effect = carcassonneCelebration(old, next)!;
  assert.equal(effect.returned.length, 2);
  assert.equal(effect.gains.length, 2);
  assert.equal(effect.completed.length, 2);
});
test("Celebration and sound: mounting, duplicates, revision gaps, old games and cancellation cannot replay a completion", () => {
  const { old, next } = closing(),
    { game } = final();
  for (const [a, b] of [
    [null, next],
    [next, next],
    [
      old,
      {
        ...next,
        gameRevision: parse(CarcassonnePlayingProjectionSchema, {
          ...next,
          gameRevision: 3,
        }).gameRevision,
      },
    ],
    [
      old,
      {
        ...next,
        gameId: parse(CarcassonnePlayingProjectionSchema, {
          ...next,
          gameId: "other",
        }).gameId,
      },
    ],
    [
      old,
      {
        ...game,
        result: {
          reason: "CANCELLED" as const,
          winnerPlayerIds: [],
          scores: [],
          finalScoring: [],
        },
      },
    ],
  ] satisfies [CarcassonneProjection | null, CarcassonneProjection][]) {
    assert.equal(carcassonneCelebration(a, b), null);
    assert.deepEqual(carcassonneTransitionCues(a, b, "a"), []);
  }
  const ended = {
    ...game,
    playerStates: game.playerStates.map((p) => ({
      ...p,
      score: p.playerId === "a" ? 7 : 3,
    })),
  };
  assert.deepEqual(carcassonneCelebration(old, ended)?.gains, [
    { playerId: "a", points: 7 },
    { playerId: "b", points: 3 },
  ]);
  assert.deepEqual(carcassonneTransitionCues(old, ended, "a"), [
    "PLACE",
    "SCORE",
    "RETURN",
    "FINISH",
  ]);
});

test("CARCASSONNE expansion score details use each tied winner's pig award and explain incomplete facilities", () => {
  const old = playing();
  const event = parse(CarcassonneScoreEventSchema, {
    featureId: "field",
    kind: "FIELD",
    tileIds: ["start"],
    points: 6,
    winnerPlayerIds: ["a", "b"],
    returnedPlayerIds: [],
    final: true,
    complete: false,
    shields: 0,
    cityCount: 2,
    playerPoints: [
      { playerId: "a", points: 8, pig: true },
      { playerId: "b", points: 6, pig: false },
    ],
  });
  const g = parse(CarcassonneFinishedProjectionSchema, {
    ...Object.fromEntries(
      Object.entries(old).filter(
        ([k]) =>
          !["turnId", "activePlayerId", "turnStartedAt", "deadlineAt"].includes(
            k,
          ),
      ),
    ),
    phase: "FINISHED",
    result: {
      reason: "TILES_EXHAUSTED",
      winnerPlayerIds: ["a"],
      scores: [],
      finalScoring: [event],
    },
  });
  const a = finalScoreEvents(g, "a", "FIELD")[0]!,
    b = finalScoreEvents(g, "b", "FIELD")[0]!;
  assert.equal(a.points, 8);
  assert.equal(b.points, 6);
  assert.match(scoreEventFormula(a), /4점 \(돼지\)/);
  assert.match(scoreEventFormula(b), /3점/);
  assert.match(
    scoreEventFormula({ ...event, kind: "ROAD", inn: true, points: 0 }),
    /미완성 도로 = 0점/,
  );
  assert.match(
    scoreEventFormula({ ...event, kind: "CITY", cathedral: true, points: 0 }),
    /미완성 도시 = 0점/,
  );
  const next = parse(CarcassonnePlayingProjectionSchema, {
    ...old,
    gameRevision: 1,
    bonusTurn: true,
    feedback: {
      ...closing().next.feedback!,
      goods: { WINE: 1, GRAIN: 0, CLOTH: 0 },
    },
  });
  assert.ok(carcassonneTransitionCues(old, next, "a").includes("GOODS"));
  assert.ok(carcassonneTransitionCues(old, next, "a").includes("BUILDER"));
});
