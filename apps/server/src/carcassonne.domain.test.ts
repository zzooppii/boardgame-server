import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import {
  CARCASSONNE_CATALOG,
  CARCASSONNE_TILE_KINDS,
  CARCASSONNE_BASE_TILE_KINDS,
  CARCASSONNE_GOODS,
  carcassonneTileCount,
  carcassonneAwardPoints,
  type CarcassonneSettings,
  type CarcassonnePiece,
  CarcassonneActionSchema,
  GameIdSchema,
  PlayerIdSchema,
  TileIdSchema,
  TurnIdSchema,
  ServerTimeSchema,
  analyzeCarcassonneBoard,
  carcassonneFeaturePoints,
  carcassonneMajority,
  carcassonneMeepleChoices,
  carcassonnePlacementReason,
  carcassonneRegionKey,
  legalCarcassonnePlacements,
  oppositeCarcassonneFieldPort,
  rotateCarcassonnePoint,
  carcassonneEdge,
  type CarcassonneBoardTile,
  type CarcassonneTileKind,
  type CarcassonneRotation,
} from "@hangul-rummikub/shared";
import {
  createCarcassonneGame,
  makeCarcassonneTiles,
  parseCarcassonneState,
  publicCarcassonne,
  applyCarcassonneAction,
  timeoutCarcassonne,
  chooseCarcassonneTimeoutAction,
  cancelCarcassonne,
  type CarcassonneState,
} from "./games/carcassonne/domain/game.js";
const player = (n: number) => v.parse(PlayerIdSchema, "carc-player-" + n),
  time = (n: number) => v.parse(ServerTimeSchema, n),
  turn = (n: number) => v.parse(TurnIdSchema, "carc-turn-" + n);
let serial = 0;
const tile = (
  kind: CarcassonneTileKind,
  x: number,
  y: number,
  rotation: CarcassonneRotation = 0,
): CarcassonneBoardTile => ({
  kind,
  x,
  y,
  rotation,
  tileId: v.parse(TileIdSchema, "geometry-" + ++serial),
});
function random(seed: number) {
  let n = seed;
  return {
    nextInt(upper: number) {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n % upper;
    },
  };
}
function create(
  count = 2,
  seed = 17,
  settings: CarcassonneSettings = {
    innsAndCathedrals: false,
    tradersAndBuilders: false,
  },
) {
  let id = 0;
  return createCarcassonneGame({
    settings,
    gameId: v.parse(GameIdSchema, "carc-game"),
    playerIds: Array.from({ length: count }, (_, i) => player(i)),
    tiles: makeCarcassonneTiles(
      () => v.parse(TileIdSchema, "tile-" + ++id),
      settings,
    ),
    starter: 0,
    now: time(1000),
    turnId: turn(0),
    random: random(seed),
  });
}
function drawKind(s: CarcassonneState, kind: CarcassonneTileKind) {
  const candidate = s.inventory.find(
    (t) => t.kind === kind && s.bag.includes(t.tileId),
  );
  assert.ok(candidate);
  assert.ok(s.currentTileId);
  s.bag = s.bag.filter((id) => id !== candidate.tileId);
  s.bag.push(s.currentTileId);
  s.currentTileId = candidate.tileId;
  return parseCarcassonneState(s);
}
function move(
  s: CarcassonneState,
  at: { x: number; y: number; rotation: CarcassonneRotation },
  region: string | null = null,
  now = s.turnStartedAt + 1,
) {
  assert.ok(s.currentTileId);
  return applyCarcassonneAction(
    s,
    s.activePlayerId,
    {
      tileId: s.currentTileId,
      x: at.x,
      y: at.y,
      rotation: at.rotation,
      meepleRegionId: region,
    },
    time(now),
    turn(s.revision + 1),
  );
}

test("CARCASSONNE catalog: official 24 kinds / 72 instances, complete unique edge and field ports, city adjacency and rotation invariants", () => {
  assert.equal(CARCASSONNE_BASE_TILE_KINDS.length, 24);
  assert.equal(
    CARCASSONNE_BASE_TILE_KINDS.reduce(
      (n, k) => n + CARCASSONNE_CATALOG[k].count,
      0,
    ),
    72,
  );
  assert.deepEqual(
    CARCASSONNE_BASE_TILE_KINDS.map((k) => CARCASSONNE_CATALOG[k].count),
    [2, 4, 1, 4, 5, 2, 1, 3, 2, 3, 3, 3, 2, 3, 2, 3, 1, 3, 2, 1, 8, 9, 4, 1],
  );
  for (const kind of CARCASSONNE_TILE_KINDS) {
    const t = CARCASSONNE_CATALOG[kind];
    assert.equal(new Set(t.regions.map((r) => r.id)).size, t.regions.length);
    for (const r of t.regions) {
      assert.ok(r.path.length);
      assert.ok(r.point.every((n) => n > 0 && n < 100));
      assert.equal(new Set(r.ports).size, r.ports.length);
      for (const city of r.adjacentCities)
        assert.ok(t.regions.some((c) => c.id === city && c.kind === "CITY"));
    }
    const cityPorts = t.regions
        .filter((r) => r.kind === "CITY")
        .flatMap((r) => r.ports),
      roadPorts = t.regions
        .filter((r) => r.kind === "ROAD")
        .flatMap((r) => r.ports),
      fieldPorts = t.regions
        .filter((r) => r.kind === "FIELD")
        .flatMap((r) => r.ports);
    assert.equal(
      new Set([...cityPorts, ...roadPorts]).size,
      cityPorts.length + roadPorts.length,
    );
    assert.equal(new Set(fieldPorts).size, fieldPorts.length);
    for (let p = 0; p < 8; p++)
      assert.equal(
        fieldPorts.includes(p),
        !cityPorts.includes(Math.floor(p / 2)),
      );
    for (const rotation of [0, 90, 180, 270] as const)
      for (let d = 0; d < 4; d++)
        assert.equal(
          carcassonneEdge({ kind, rotation }, (d + rotation / 90) % 4),
          carcassonneEdge({ kind, rotation: 0 }, d),
        );
  }
  for (let p = 0; p < 8; p++)
    assert.equal(
      oppositeCarcassonneFieldPort(oppositeCarcassonneFieldPort(p)),
      p,
    );
  assert.deepEqual(rotateCarcassonnePoint([20, 30], 90), [70, 20]);
});
test("CARCASSONNE adjacency: diagonal, occupied, mismatched neighbor, all four sides, bounded coordinates", () => {
  const start = tile("D", 0, 0);
  assert.ok(carcassonnePlacementReason([start], tile("E", 1, 1)));
  assert.ok(carcassonnePlacementReason([start], tile("E", 0, 0)));
  assert.ok(carcassonnePlacementReason([start], tile("E", 1, 0, 0)));
  assert.equal(carcassonnePlacementReason([start], tile("E", 1, 0, 270)), null);
  assert.ok(carcassonnePlacementReason([start], tile("B", 73, 0)));
  const legal = legalCarcassonnePlacements([start], tile("E", 0, 0));
  assert.ok(legal.length > 0);
  assert.ok(
    legal.every((t) => carcassonnePlacementReason([start], t) === null),
  );
});
test("CARCASSONNE cities: connected bridge differs from separate cities; shields and tied majority", () => {
  const middle = tile("G", 0, 0),
    north = tile("E", 0, -1, 180),
    south = tile("E", 0, 1);
  const claims = [
    { playerId: player(0), tileId: north.tileId, regionId: "c0" },
    { playerId: player(1), tileId: south.tileId, regionId: "c0" },
  ];
  const city = analyzeCarcassonneBoard([middle, north, south], claims).find(
    (f) => f.kind === "CITY",
  )!;
  assert.equal(city.complete, true);
  assert.equal(carcassonneFeaturePoints(city, false), 6);
  assert.deepEqual(
    new Set(carcassonneMajority(city)),
    new Set([player(0), player(1)]),
  );
  const dominant = analyzeCarcassonneBoard(
    [middle, north, south],
    [...claims, { playerId: player(0), tileId: middle.tileId, regionId: "c0" }],
  ).find((f) => f.kind === "CITY")!;
  assert.deepEqual(carcassonneMajority(dominant), [player(0)]);
  assert.equal(
    analyzeCarcassonneBoard([tile("H", 0, 0)], []).filter(
      (f) => f.kind === "CITY",
    ).length,
    2,
  );
  const shield = analyzeCarcassonneBoard([tile("M", 0, 0)], []).find(
    (f) => f.kind === "CITY",
  )!;
  assert.equal(carcassonneFeaturePoints(shield, true), 2);
  assert.equal(carcassonneFeaturePoints(shield, false), 0);
});
test("CARCASSONNE roads: a closed loop counts four unique tiles; crossroads do not merge road segments", () => {
  const board = [
    tile("V", 0, 0, 270),
    tile("V", 1, 0),
    tile("V", 0, 1, 180),
    tile("V", 1, 1, 90),
  ];
  const roads = analyzeCarcassonneBoard(board, []).filter(
    (f) => f.kind === "ROAD",
  );
  assert.equal(roads.length, 1);
  assert.equal(roads[0]!.complete, true);
  assert.equal(carcassonneFeaturePoints(roads[0]!, false), 4);
  const junction = analyzeCarcassonneBoard([tile("X", 0, 0)], []).filter(
    (f) => f.kind === "ROAD",
  );
  assert.equal(junction.length, 4);
  assert.ok(junction.every((f) => f.openEdges === 1));
});
test("CARCASSONNE fields: opposite half edges, closed road separates inside/outside, same city counts once per field", () => {
  const board = [
    tile("E", 0, 0),
    tile("E", 0, -1, 180),
    tile("B", -1, 0),
    tile("B", -1, -1),
  ];
  const fields = analyzeCarcassonneBoard(board, []).filter(
    (f) => f.kind === "FIELD",
  );
  assert.equal(fields.length, 1);
  assert.equal(fields[0]!.completedCityIds.length, 1);
  assert.equal(carcassonneFeaturePoints(fields[0]!, true), 3);
  assert.equal(carcassonneFeaturePoints(fields[0]!, false), 0);
  const ring = [
    tile("V", 0, 0, 270),
    tile("V", 1, 0),
    tile("V", 0, 1, 180),
    tile("V", 1, 1, 90),
  ];
  assert.equal(
    analyzeCarcassonneBoard(ring, []).filter((f) => f.kind === "FIELD").length,
    2,
  );
  const straight = [tile("U", 0, 0), tile("U", 0, 1)];
  const fs = analyzeCarcassonneBoard(straight, []).filter(
    (f) => f.kind === "FIELD",
  );
  assert.equal(fs.length, 2);
  assert.ok(fs.every((f) => f.tileIds.length === 2));
});
test("CARCASSONNE monastery counts self plus all eight neighbors, including diagonals", () => {
  const center = tile("B", 0, 0),
    board = [center];
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) if (x || y) board.push(tile("B", x, y));
  const feature = (b: CarcassonneBoardTile[]) =>
    analyzeCarcassonneBoard(b, []).find((f) =>
      f.nodes.includes(carcassonneRegionKey(center.tileId, "m0")),
    )!;
  assert.equal(carcassonneFeaturePoints(feature([center]), true), 1);
  assert.equal(feature(board).complete, true);
  assert.equal(carcassonneFeaturePoints(feature(board), false), 9);
  assert.equal(feature(board.slice(0, -1)).complete, false);
});
test("CARCASSONNE new meeple is placed before scoring: city closes, scores and returns in one atomic move", () => {
  const s = drawKind(create(), "E"),
    before = JSON.stringify(s),
    result = move(s, { x: 1, y: 0, rotation: 270 }, "c0");
  assert.ok(result.ok);
  assert.equal(JSON.stringify(s), before);
  assert.equal(result.state.players[0]!.score, 4);
  assert.equal(result.state.players[0]!.availableMeeples, 7);
  assert.equal(result.state.meeples.length, 0);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.feedback?.scoring[0]?.points, 4);
});
test("CARCASSONNE existing claim blocks placement, but another player can finish the claimed city", () => {
  let s = drawKind(create(), "E");
  s.meeples = [
    { playerId: player(1), tileId: s.board[0]!.tileId, regionId: "c0" },
  ];
  s.players[1]!.availableMeeples = 6;
  s = parseCarcassonneState(s);
  assert.deepEqual(move(s, { x: 1, y: 0, rotation: 270 }, "c0"), {
    ok: false,
    reason: "INVALID_ACTION",
  });
  const result = move(s, { x: 1, y: 0, rotation: 270 });
  assert.ok(result.ok);
  assert.equal(result.state.players[0]!.score, 0);
  assert.equal(result.state.players[1]!.score, 4);
  assert.equal(result.state.players[1]!.availableMeeples, 7);
});
test("CARCASSONNE farmer remains deployed during play; invalid IDs, injected fields, stale actor and deadline do not mutate state", () => {
  const s = drawKind(create(), "E"),
    a = {
      tileId: s.currentTileId!,
      x: 1,
      y: 0,
      rotation: 270,
      meepleRegionId: "f0",
    },
    before = JSON.stringify(s);
  assert.equal(
    v.safeParse(CarcassonneActionSchema, { ...a, score: 999 }).success,
    false,
  );
  assert.deepEqual(
    applyCarcassonneAction(s, player(1), a, time(1001), turn(1)),
    { ok: false, reason: "NOT_YOUR_TURN" },
  );
  for (const id of ["missing", s.bag[0]])
    assert.deepEqual(
      applyCarcassonneAction(
        s,
        player(0),
        { ...a, tileId: id },
        time(1001),
        turn(1),
      ),
      { ok: false, reason: "INVALID_ACTION" },
    );
  assert.deepEqual(
    applyCarcassonneAction(s, player(0), a, time(91000), turn(1)),
    { ok: false, reason: "TURN_EXPIRED" },
  );
  assert.equal(JSON.stringify(s), before);
  const result = applyCarcassonneAction(s, player(0), a, time(90999), turn(1));
  assert.ok(result.ok);
  assert.equal(result.state.meeples.length, 1);
  assert.equal(result.state.players[0]!.availableMeeples, 6);
  assert.equal(result.state.players[0]!.score, 0);
});
test("CARCASSONNE public projection hides future deck IDs; invariant validation rejects lost or duplicated tiles", () => {
  const s = create(),
    view = JSON.stringify(publicCarcassonne(s));
  for (const id of s.bag) assert.equal(view.includes('"' + id + '"'), false);
  assert.throws(() => parseCarcassonneState({ ...s, bag: s.bag.slice(1) }));
  assert.throws(() =>
    parseCarcassonneState({ ...s, bag: [...s.bag, s.bag[0]] }),
  );
  const cancelled = cancelCarcassonne(s, time(1200));
  assert.equal(cancelled.result?.reason, "CANCELLED");
  assert.equal(cancelled.deadlineAt, null);
  assert.deepEqual(cancelled.result?.winnerPlayerIds, []);
});
test("CARCASSONNE timeout: early callback is ignored; exact deadline places only a tile and starts a new deadline", () => {
  const s = create();
  assert.equal(timeoutCarcassonne(s, time(90999), turn(1)), null);
  const next = timeoutCarcassonne(s, time(91000), turn(1));
  assert.ok(next);
  assert.equal(next.feedback?.automatic, true);
  assert.equal(next.feedback?.meepleRegionId, null);
  assert.equal(next.deadlineAt, 181000);
  assert.equal(next.board.length, 2);
  assert.equal(next.revision, 1);
});
test("CARCASSONNE full 2/3/4/5-player games preserve every tile and meeple, settle farmers and terminate without a client clock", () => {
  for (const count of [2, 3, 4, 5])
    for (const seed of [3, 17, 89]) {
      let s = create(count, seed),
        moves = 0;
      const rng = random(seed + 99),
        earned = new Map(s.players.map((p) => [p.playerId, 0]));
      while (s.phase === "PLAYING") {
        const current = publicCarcassonne(s).currentTile;
        assert.ok(current);
        const placements = legalCarcassonnePlacements(s.board, current),
          chosen = placements[rng.nextInt(placements.length)]!;
        const choices = carcassonneMeepleChoices(
            s.board,
            s.meeples,
            chosen,
          ).filter((c) => c.available),
          p = s.players.find((p) => p.playerId === s.activePlayerId)!;
        const region =
          p.availableMeeples > 0 && choices.length
            ? choices[rng.nextInt(choices.length)]!.region.id
            : null;
        const result = move(s, chosen, region);
        assert.ok(result.ok);
        s = result.state;
        moves++;
        for (const event of s.feedback?.scoring ?? [])
          for (const id of event.winnerPlayerIds)
            earned.set(id, earned.get(id)! + event.points);
        assert.ok(moves <= 71);
        assert.equal(
          s.board.length +
            s.bag.length +
            s.discard.length +
            (s.currentTileId ? 1 : 0),
          72,
        );
        for (const p of s.players)
          assert.equal(
            p.availableMeeples +
              s.meeples.filter((m) => m.playerId === p.playerId).length,
            7,
          );
      }
      assert.equal(s.result?.reason, "TILES_EXHAUSTED");
      assert.equal(s.deadlineAt, null);
      assert.ok(s.result);
      for (const score of s.result.scores) {
        assert.equal(score.base, earned.get(score.playerId));
        assert.equal(
          score.total,
          score.base +
            score.cities +
            score.roads +
            score.fields +
            score.monasteries,
        );
      }
      assert.equal(chooseCarcassonneTimeoutAction(s), null);
    }
});
test("CARCASSONNE unplaceable draw: a four-city tile is discarded once all city edges are closed; same next turn receives another tile", () => {
  const opening = move(drawKind(create(), "E"), { x: 1, y: 0, rotation: 270 });
  assert.ok(opening.ok);
  const s = drawKind(opening.state, "B"),
    closed = s.inventory.find(
      (t) => t.kind === "C" && s.bag.includes(t.tileId),
    ),
    replacement = s.inventory.find(
      (t) => t.kind === "E" && s.bag.includes(t.tileId),
    );
  assert.ok(closed);
  assert.ok(replacement);
  assert.equal(legalCarcassonnePlacements(s.board, closed).length, 0);
  s.bag = s.bag.filter(
    (id) => id !== closed.tileId && id !== replacement.tileId,
  );
  s.bag.push(replacement.tileId, closed.tileId);
  const before = JSON.stringify(s),
    next = move(parseCarcassonneState(s), { x: -1, y: 0, rotation: 0 });
  assert.ok(next.ok);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(next.state.discard, [closed.tileId]);
  assert.equal(next.state.currentTileId, replacement.tileId);
  assert.equal(next.state.revision, s.revision + 1);
  assert.equal(next.state.activePlayerId, player(0));
});
test("CARCASSONNE city loop: two separate regions on one tile reconnect outside it and count that tile only once", () => {
  const board = [
    tile("H", 0, 0),
    tile("N", -1, 0, 90),
    tile("N", 1, 0),
    tile("N", -1, -1, 180),
    tile("N", 1, -1, 270),
    tile("F", 0, -1),
  ];
  const cities = analyzeCarcassonneBoard(board, []).filter(
    (f) => f.kind === "CITY",
  );
  assert.equal(cities.length, 1);
  const city = cities[0]!;
  assert.equal(city.complete, true);
  assert.equal(city.nodes.length, 7);
  assert.equal(city.tileIds.length, 6);
  assert.equal(city.shields, 1);
  assert.equal(carcassonneFeaturePoints(city, false), 14);
});

const both = { innsAndCathedrals: true, tradersAndBuilders: true };
function playPiece(
  s: CarcassonneState,
  kind: CarcassonneTileKind,
  x: number,
  y: number,
  rotation: CarcassonneRotation = 0,
  region: string | null = null,
  piece: CarcassonnePiece = "NORMAL",
) {
  const current = s.inventory.find((t) => t.tileId === s.currentTileId);
  s = current?.kind === kind ? s : drawKind(s, kind);
  const a = {
    tileId: s.currentTileId!,
    x,
    y,
    rotation,
    meepleRegionId: region,
    piece,
  };
  const before = JSON.stringify(s);
  const result = applyCarcassonneAction(
    s,
    s.activePlayerId,
    a,
    time(s.turnStartedAt + 1),
    turn(s.revision + 1),
  );
  assert.equal(JSON.stringify(s), before);
  assert.ok(result.ok, JSON.stringify(a));
  return result.state;
}
test("CARCASSONNE expansions: exact inventories, facilities and goods; separate bridge roads, monasteries and enclosed fields", () => {
  assert.equal(Object.keys(CARCASSONNE_CATALOG).length, 65);
  for (const settings of [
    { innsAndCathedrals: false, tradersAndBuilders: false },
    { innsAndCathedrals: true, tradersAndBuilders: false },
    { innsAndCathedrals: false, tradersAndBuilders: true },
    both,
  ]) {
    const s = create(2, 17, settings);
    assert.equal(s.inventory.length, carcassonneTileCount(settings));
    assert.equal(s.players[0]!.availableBig, settings.innsAndCathedrals);
    assert.equal(s.players[0]!.availableBuilder, settings.tradersAndBuilders);
    assert.equal(s.players[0]!.availablePig, settings.tradersAndBuilders);
  }
  const regions = Object.values(CARCASSONNE_CATALOG).flatMap((t) =>
    Array.from({ length: t.count }, () => t.regions).flat(),
  );
  assert.equal(regions.filter((r) => r.inn).length, 6);
  assert.equal(regions.filter((r) => r.cathedral).length, 2);
  assert.deepEqual(
    CARCASSONNE_GOODS.map((g) => regions.filter((r) => r.goods === g).length),
    [9, 6, 5],
  );
  for (const [kind, roads, fields, cities] of [
    ["HB", 2, 4, 0],
    ["HC", 2, 3, 1],
    ["ED", 2, 2, 0],
    ["HJ", 3, 3, 0],
    ["EH", 0, 1, 4],
    ["HM", 0, 1, 3],
    ["EI", 2, 4, 2],
    ["EG", 0, 2, 1],
  ] as const) {
    const fs = analyzeCarcassonneBoard([tile(kind, 0, 0)], []);
    assert.deepEqual(
      ["ROAD", "FIELD", "CITY"].map(
        (k) => fs.filter((f) => f.kind === k).length,
      ),
      [roads, fields, cities],
      kind,
    );
  }
  const ec = analyzeCarcassonneBoard([tile("EC", 0, 0)], []).filter(
    (f) => f.kind === "ROAD",
  );
  assert.equal(ec.filter((f) => f.inn).length, 1);
  assert.equal(ec[0]!.inn, true);
});
test("CARCASSONNE expansions: inns and cathedrals multiply only completed features, never stack", () => {
  const ring = [
    tile("EA", 0, 0, 270),
    tile("EA", 1, 0),
    tile("V", 0, 1, 180),
    tile("V", 1, 1, 90),
  ];
  let road = analyzeCarcassonneBoard(ring, []).find((f) => f.kind === "ROAD")!;
  assert.equal(road.complete, true);
  assert.equal(carcassonneFeaturePoints(road, false), 8);
  road = analyzeCarcassonneBoard(ring.slice(0, -1), []).find(
    (f) => f.kind === "ROAD",
  )!;
  assert.equal(carcassonneFeaturePoints(road, true), 0);
  const board = [
    tile("EK", 0, 0),
    tile("E", 0, -1, 180),
    tile("E", 1, 0, 270),
    tile("E", 0, 1),
    tile("E", -1, 0, 90),
  ];
  const city = analyzeCarcassonneBoard(board, []).find(
    (f) => f.kind === "CITY",
  )!;
  assert.equal(carcassonneFeaturePoints(city, false), 15);
  assert.equal(
    carcassonneFeaturePoints(
      analyzeCarcassonneBoard(board.slice(0, -1), []).find(
        (f) => f.kind === "CITY",
      )!,
      true,
    ),
    0,
  );
});
test("CARCASSONNE expansions: big follower counts twice and returns to its own reserve; special pieces cannot bypass settings", () => {
  let s = create(2, 17, both);
  s = playPiece(s, "E", 1, 0, 270, "c0", "BIG");
  assert.equal(s.players[0]!.score, 4);
  assert.equal(s.players[0]!.availableBig, true);
  assert.equal(s.players[0]!.availableMeeples, 7);
  const t = tile("U", 0, 0);
  const f = analyzeCarcassonneBoard(
    [t],
    [
      { playerId: player(0), tileId: t.tileId, regionId: "r0", piece: "BIG" },
      { playerId: player(1), tileId: t.tileId, regionId: "r0" },
      {
        playerId: player(1),
        tileId: t.tileId,
        regionId: "r0",
        piece: "BUILDER",
      },
    ],
  ).find((f) => f.kind === "ROAD")!;
  assert.deepEqual(carcassonneMajority(f), [player(0)]);
  f.meeples.push({ playerId: player(1), tileId: t.tileId, regionId: "r0" });
  assert.deepEqual(
    new Set(carcassonneMajority(f)),
    new Set([player(0), player(1)]),
  );
  const base = drawKind(create(), "E");
  for (const piece of ["BIG", "BUILDER", "PIG"])
    assert.deepEqual(
      applyCarcassonneAction(
        base,
        base.activePlayerId,
        {
          tileId: base.currentTileId,
          x: 1,
          y: 0,
          rotation: 270,
          meepleRegionId: "c0",
          piece,
        },
        time(1001),
        turn(1),
      ),
      { ok: false, reason: "INVALID_ACTION" },
    );
});
test("CARCASSONNE expansions: builder requires own follower, grants one extra turn, and never chains; deadline remains authoritative", () => {
  let s = create(2, 17, both);
  s.meeples = [
    { playerId: player(0), tileId: s.board[0]!.tileId, regionId: "r0" },
  ];
  s.players[0]!.availableMeeples = 6;
  s = playPiece(s, "U", 0, -1, 0, "r0", "BUILDER");
  assert.equal(s.activePlayerId, player(1));
  assert.equal(s.bonusTurn, false);
  s = playPiece(s, "E", 1, 0, 270);
  s = playPiece(s, "U", 0, -2);
  assert.equal(s.activePlayerId, player(0));
  assert.equal(s.bonusTurn, true);
  assert.equal(s.deadlineAt! - s.turnStartedAt, 90000);
  const action = chooseCarcassonneTimeoutAction(s)!;
  assert.equal(
    applyCarcassonneAction(s, player(0), action, time(s.deadlineAt!), turn(999))
      .ok,
    false,
  );
  s = playPiece(s, "U", 0, -3);
  assert.equal(s.activePlayerId, player(1));
  assert.equal(s.bonusTurn, false);
  const noClaim = drawKind(create(2, 17, both), "U");
  assert.equal(
    applyCarcassonneAction(
      noClaim,
      noClaim.activePlayerId,
      {
        tileId: noClaim.currentTileId,
        x: 0,
        y: -1,
        rotation: 0,
        meepleRegionId: "r0",
        piece: "BUILDER",
      },
      time(1001),
      turn(1),
    ).ok,
    false,
  );
});
test("CARCASSONNE expansions: completing a builder city keeps bonus and pays goods to completing opponent, even without city points", () => {
  let s = create(2, 17, both);
  s.meeples = [
    { playerId: player(0), tileId: s.board[0]!.tileId, regionId: "c0" },
  ];
  s.players[0]!.availableMeeples = 6;
  s = playPiece(s, "HE", 1, 0, 0, "c0", "BUILDER");
  s = playPiece(s, "E", 2, 0, 270);
  assert.equal(s.players[0]!.score, 6);
  assert.equal(s.players[1]!.score, 0);
  assert.equal(s.players[1]!.goods!.GRAIN, 1);
  assert.equal(s.players[0]!.availableBuilder, true);
  let b = create(2, 17, both);
  b.meeples = [
    { playerId: player(0), tileId: b.board[0]!.tileId, regionId: "c0" },
  ];
  b.players[0]!.availableMeeples = 6;
  b = playPiece(b, "HE", 1, 0, 0, "c0", "BUILDER");
  b = playPiece(b, "B", -1, 0);
  b = playPiece(b, "E", 2, 0, 270);
  assert.equal(b.activePlayerId, player(0));
  assert.equal(b.bonusTurn, true);
  assert.equal(b.players[0]!.availableBuilder, true);
  assert.equal(b.players[0]!.goods!.GRAIN, 1);
});
test("CARCASSONNE expansions: pig changes only its winning owner's field award; goods final majority and zero holdings", () => {
  const a = tile("E", 0, 0),
    b = tile("E", 0, -1, 180);
  const f = analyzeCarcassonneBoard(
    [a, b, tile("B", -1, 0), tile("B", -1, -1)],
    [
      {
        playerId: player(0),
        tileId: a.tileId,
        regionId: "f0",
        piece: "NORMAL",
      },
      {
        playerId: player(1),
        tileId: b.tileId,
        regionId: "f0",
        piece: "NORMAL",
      },
      { playerId: player(0), tileId: a.tileId, regionId: "f0", piece: "PIG" },
    ],
  ).find((f) => f.kind === "FIELD")!;
  assert.deepEqual(
    new Set(carcassonneMajority(f)),
    new Set([player(0), player(1)]),
  );
  assert.equal(carcassonneFeaturePoints(f, true, player(0)), 4);
  assert.equal(carcassonneFeaturePoints(f, true, player(1)), 3);
  let s = create(2, 17, both);
  s.meeples = [
    { playerId: player(0), tileId: s.board[0]!.tileId, regionId: "f1" },
  ];
  s.players[0]!.availableMeeples = 6;
  s = playPiece(s, "U", 0, -1, 0, "f1", "PIG");
  assert.equal(s.players[0]!.availablePig, false);
  s = playPiece(s, "HE", 1, 0);
  s = drawKind(s, "E");
  s.discard.push(...s.bag);
  s.bag = [];
  s = playPiece(s, "E", 2, 0, 270);
  assert.equal(s.phase, "FINISHED");
  assert.equal(s.result!.scores[0]!.goods, 10);
  assert.equal(s.result!.scores[1]!.goods, 0);
  const field = s.result!.finalScoring.find((e) => e.kind === "FIELD")!;
  assert.equal(carcassonneAwardPoints(field, player(0)), 4);
  assert.throws(() =>
    parseCarcassonneState({
      ...s,
      settings: { innsAndCathedrals: false, tradersAndBuilders: false },
    }),
  );
});
test("CARCASSONNE expansions: all combinations finish with tile/piece/goods conservation and hidden deck, 2–5 players", () => {
  for (const settings of [
    { innsAndCathedrals: true, tradersAndBuilders: false },
    { innsAndCathedrals: false, tradersAndBuilders: true },
    both,
  ])
    for (const count of [2, 3, 4, 5]) {
      let s = create(count, 17 + count, settings);
      let moves = 0;
      while (s.phase === "PLAYING") {
        const current = publicCarcassonne(s).currentTile!;
        const placement = legalCarcassonnePlacements(s.board, current)[0]!;
        const p = s.players.find((p) => p.playerId === s.activePlayerId)!;
        let selected: { region: string; piece: CarcassonnePiece } | null = null;
        for (const piece of ["BUILDER", "PIG", "BIG", "NORMAL"] as const) {
          if (
            !(piece === "NORMAL"
              ? p.availableMeeples > 0
              : piece === "BIG"
                ? p.availableBig
                : piece === "BUILDER"
                  ? p.availableBuilder
                  : p.availablePig)
          )
            continue;
          const choices = carcassonneMeepleChoices(
            s.board,
            s.meeples,
            placement,
            p.playerId,
            piece,
          ).filter((c) => c.available);
          if (choices.length) {
            selected = {
              region: choices[moves % choices.length]!.region.id,
              piece,
            };
            break;
          }
        }
        const result = applyCarcassonneAction(
          s,
          s.activePlayerId,
          {
            tileId: current.tileId,
            x: placement.x,
            y: placement.y,
            rotation: placement.rotation,
            meepleRegionId: selected?.region ?? null,
            piece: selected?.piece ?? "NORMAL",
          },
          time(s.turnStartedAt + 1),
          turn(++moves),
        );
        assert.ok(result.ok);
        s = result.state;
        assert.ok(moves < 114);
        assert.equal(
          s.board.length +
            s.bag.length +
            s.discard.length +
            Number(s.currentTileId !== null),
          carcassonneTileCount(settings),
        );
        for (const id of s.bag)
          assert.equal(
            JSON.stringify(publicCarcassonne(s)).includes('"' + id + '"'),
            false,
          );
      }
      assert.equal(s.result!.reason, "TILES_EXHAUSTED");
      for (const score of s.result!.scores)
        assert.equal(
          score.total,
          score.base +
            score.roads +
            score.cities +
            score.fields +
            score.monasteries +
            (score.goods ?? 0),
        );
    }
});

test("CARCASSONNE expansion catalog matches official B1/B2 edge signatures including separate southern cities", () => {
  const signatures = {
    EA: "FFRR",
    EB: "RFRF",
    EC: "FRRR",
    ED: "FRFR",
    EE: "RRRR",
    EF: "CCRF",
    EG: "FFFC",
    EH: "CCCC",
    EI: "RCRC",
    EJ: "CFRF",
    EK: "CCCC",
    EL: "CRRC",
    EM: "CFRR",
    EN: "CFRC",
    EO: "CCFC",
    EP: "CCFC",
    EQ: "RCRC",
    HA: "FCRF",
    HB: "RRRR",
    HC: "CFRR",
    HD: "CCRC",
    HE: "FCRC",
    HF: "CFRC",
    HG: "CFFC",
    HH: "CCFC",
    HI: "CFRC",
    HJ: "FRRR",
    HK: "CCRF",
    HL: "CCRC",
    HM: "CCCC",
    HN: "FCCC",
    HO: "CRRC",
    HP: "FCCC",
    HQ: "FCFC",
    HR: "RCFC",
    HS: "FCRC",
    HT: "CFFC",
    HU: "CRRC",
    HV: "CCRC",
    HW: "CCRF",
    HX: "CCCC",
  };
  for (const [kind, expected] of Object.entries(signatures)) {
    const def = Object.values(CARCASSONNE_CATALOG).find(
      (t) => t.kind === kind,
    )!;
    assert.equal(
      [0, 1, 2, 3]
        .map((d) => carcassonneEdge({ kind: def.kind, rotation: 0 }, d)[0])
        .join(""),
      expected,
      kind,
    );
  }
  for (const kind of ["HN", "HP"] as const) {
    const fs = analyzeCarcassonneBoard([tile(kind, 0, 0)], []);
    assert.equal(fs.filter((f) => f.kind === "CITY").length, 2);
    assert.equal(fs.filter((f) => f.kind === "FIELD").length, 2);
  }
});

test("CARCASSONNE goods: tied positive holdings each receive ten, unused goods receive zero", () => {
  let s = create(2, 17, both);
  s = playPiece(s, "HQ", 1, 0);
  s = playPiece(s, "E", 2, 0, 270); // player 1 receives wine, no city follower required
  s = playPiece(s, "HT", 1, 1, 180);
  s = playPiece(s, "E", 2, 1, 270);
  s = playPiece(s, "E", 1, 2); // player 0 completes the second wine city
  assert.equal(s.players[0]!.goods!.WINE, 1);
  assert.equal(s.players[1]!.goods!.WINE, 1);
  s = drawKind(s, "B");
  s.discard.push(...s.bag);
  s.bag = [];
  s = playPiece(s, "B", -1, 0);
  assert.deepEqual(
    s.result!.scores.map((p) => p.goods),
    [10, 10],
  );
});
