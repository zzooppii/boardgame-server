import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "valibot";
import {
  BURGUNDY_DEFAULT_SETTINGS,
  BurgundyLobbyPlatformSnapshotV2Schema,
  burgundyBoard,
  TileIdSchema,
  BurgundyPlayerSchema,
  BurgundyPlayingProjectionSchema,
  BurgundyPlayingPlatformSnapshotV2Schema,
} from "@hangul-rummikub/shared";
import { BurgundyScreen } from "../features/burgundy/BurgundyScreen.js";
import { BurgundyGoodsArt } from "../features/burgundy/art.js";
import { BurgundyBoard } from "../features/burgundy/BurgundyBoard.js";
import {
  BurgundyAudio,
  burgundySoundCues,
} from "../features/burgundy/sound.js";
import { decodeWebSnapshot } from "./snapshot-wire-decoder.js";
import { resolveRoomSnapshotView } from "./room-snapshot-view.js";
const lobby = () =>
  parse(BurgundyLobbyPlatformSnapshotV2Schema, {
    snapshotVersion: 2,
    versions: { roomRevision: 1, presenceVersion: 1 },
    serverTime: 1000,
    self: { playerId: "a" },
    room: {
      roomId: "bu-room",
      roomCode: "ABCDEF",
      gameType: "BURGUNDY",
      phase: "LOBBY",
      settings: BURGUNDY_DEFAULT_SETTINGS,
      players: [
        {
          playerId: "a",
          nickname: "공작",
          isHost: true,
          connectionStatus: "CONNECTED",
        },
        {
          playerId: "b",
          nickname: "친구",
          isHost: false,
          connectionStatus: "CONNECTED",
        },
      ],
    },
    game: null,
  });
test("BURGUNDY host lobby routes through strict snapshot and renders edition, settings, artwork and audio", () => {
  const s = lobby(),
    d = decodeWebSnapshot(s);
  assert.equal(d.kind, "COMPATIBLE");
  if (d.kind !== "COMPATIBLE") return;
  assert.equal(resolveRoomSnapshotView(d.value).kind, "BURGUNDY");
  const html = renderToStaticMarkup(
    createElement(BurgundyScreen, {
      snapshot: s,
      connected: true,
      pending: false,
      error: null,
      connectionLabel: "연결됨",
      onCommand: async () => {},
      onStart() {},
      onRematch() {},
      onLeave() {},
      onCopy() {},
    }),
  );
  assert.match(html, /20주년판/);
  assert.match(html, /30초/);
  assert.match(html, /60초/);
  assert.match(html, /90초/);
  assert.match(html, /무역로/);
  assert.doesNotMatch(html, /포도밭|팀전|솔로/);
  assert.match(html, /음소거/);
  assert.match(html, /게임 시작/);
});
test("BURGUNDY board keeps all37 cells and uses labels as well as colors for placement", () => {
  const board = burgundyBoard(1);
  const p = parse(BurgundyPlayerSchema, {
    playerId: "a",
    score: 0,
    silver: 1,
    workers: 2,
    boardId: 1,
    board: [{ cellId: "0,0", tile: { tileId: "start", kind: "CASTLE" } }],
    storage: [],
    goods: [0, 0, 0, 0, 0, 0],
    soldGoods: [0, 0, 0, 0, 0, 0],
    soldGoodsCount: 0,
    dice: [
      { value: 1, used: false },
      { value: 2, used: false },
    ],
    shipPosition: 0,
    orderStamp: 0,
    purchased: false,
    bonuses: [],
    scoreBreakdown: {
      animals: 0,
      regions: 0,
      phaseBonus: 0,
      colorBonus: 0,
      buildings: 0,
      goodsSales: 0,
      expansion: 0,
    },
    extension: {
      shields: [],
      shield16Used: false,
      tradeRoute: [],
      tradeRouteFilled: 0,
      tradeRouteGoods: [],
      borderConnections: [],
    },
  });
  const cell = board.cells.find((c) => c.id !== "0,0")!;
  const html = renderToStaticMarkup(
    createElement(BurgundyBoard, {
      player: p,
      selectedCell: null,
      selectedTile: { tileId: parse(TileIdSchema, "preview"), kind: "CASTLE" },
      legalCells: new Set([cell.id]),
      interactive: true,
      onCell() {},
      onInspect() {},
    }),
  );
  assert.equal((html.match(/class="bu-cell(?: |")/g) ?? []).length, 37);
  assert.match(html, /배치 가능/);
  assert.match(html, /영지 확대/);
  assert.match(html, /성/);
});
test("BURGUNDY audio tolerates unavailable Web Audio and never sounds on initial projection", () => {
  const audio = new BurgundyAudio(() => null);
  audio.unlock();
  audio.setVolume(0);
  audio.play(["PLACE"]);
  audio.dispose();
  assert.deepEqual(burgundySoundCues(null, null, "a"), []);
});

function progressPlayer() {
  return parse(BurgundyPlayerSchema, {
    playerId: "a",
    score: 0,
    silver: 1,
    workers: 2,
    boardId: 1,
    board: [{ cellId: "0,0", tile: { tileId: "start", kind: "CASTLE" } }],
    storage: [],
    goods: [0, 0, 0, 0, 0, 0],
    soldGoods: [0, 0, 0, 0, 0, 0],
    soldGoodsCount: 0,
    dice: [
      { value: 1, used: false },
      { value: 2, used: false },
    ],
    shipPosition: 0,
    orderStamp: 0,
    purchased: false,
    bonuses: [],
    scoreBreakdown: {
      animals: 0,
      regions: 0,
      phaseBonus: 0,
      colorBonus: 0,
      buildings: 0,
      goodsSales: 0,
      expansion: 0,
    },
    extension: {
      shields: [],
      shield16Used: false,
      tradeRoute: [],
      tradeRouteFilled: 0,
      tradeRouteGoods: [],
      borderConnections: [],
    },
  });
}
function progressSnapshot(active = "a") {
  const base = lobby();
  const p = progressPlayer();
  const game = parse(BurgundyPlayingProjectionSchema, {
    gameType: "BURGUNDY", gameId: "preview", gameRevision: 1,
    rulesVersion: "burgundy-anniversary-2019-v1", settings: base.room.settings,
    endingPhase: false, phaseIndex: 0, roundIndex: 1, whiteDie: 3,
    playerStates: [p, { ...p, playerId: "b", board: [{ cellId: "0,0", tile: { tileId: "other-start", kind: "CASTLE" } }] }],
    depots: [[], [], [], [], [], []], blackDepot: [], inns: [],
    depotGoods: [[0,0,0,0,0,0], [0,0,0,0,0,0], [1,0,0,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0]],
    roundGoods: [2, 4, 6], supplyCount: 20, discardCount: 0,
    roundOrder: ["a", "b"], turnOrder: ["a", "b"], pending: [],
    colorFinishers: { CASTLE: ["b"], SHIP: [], LIVESTOCK: [], MONASTERY: [], MINE: [], BUILDING: [] },
    feedback: null, history: [], expansion: { shieldDepots: [[],[],[],[],[],[]], borderFinishers: [] },
    phase: "PLAYING", turnId: "turn", activePlayerId: active, turnStartedAt: 1000, deadlineAt: 61000,
  });
  return parse(BurgundyPlayingPlatformSnapshotV2Schema, { ...base, room: { ...base.room, phase: "PLAYING" }, game });
}
function progressMarkup(active = "a", connected = true) {
  return renderToStaticMarkup(createElement(BurgundyScreen, {
    snapshot: progressSnapshot(active), connected, pending: false, error: null,
    connectionLabel: "연결됨", onCommand: async () => {}, onStart() {},
    onRematch() {}, onLeave() {}, onCopy() {},
  }));
}
test("BURGUNDY progress distinguishes own/opponent deadlines and hides stale time offline", () => {
  assert.match(progressMarkup(), /지금 내 차례예요/);
  assert.match(progressMarkup(), /내 차례 남은 시간 60초/);
  assert.match(progressMarkup("b"), /친구님의 차례/);
  assert.match(progressMarkup("b"), /상대 차례 남은 시간 60초/);
  assert.doesNotMatch(progressMarkup("b"), /지금 내 차례예요/);
  assert.match(progressMarkup("a", false), /연결이 끊겼어요/);
  assert.doesNotMatch(progressMarkup("a", false), /role="timer"/);
});
test("BURGUNDY supply aligns remaining goods to future rounds and shows both bonus ranks", () => {
  const html = progressMarkup();
  assert.match(html, /3라운드 공급 대기: 2번 상품/);
  assert.match(html, /5라운드 공급 대기: 6번 상품/);
  assert.doesNotMatch(html, /2라운드 공급 대기/);
  assert.match(html, /1등 · \+5점/);
  assert.match(html, /2등 · \+2점/);
  assert.match(html, /bu-bonus-claimed/);
});

test("BURGUNDY illustrated goods separate sale die and quantity and identify all six types", () => {
  const names = ["직물", "포도", "은식기", "도자기", "목상자", "곡물"];
  for (let value = 1; value <= 6; value++) {
    const html = renderToStaticMarkup(createElement(BurgundyGoodsArt, {value, count: 3}));
    assert.ok(html.includes(`${value}번 상품 · ${names[value - 1]} 3개 · 판매 주사위 ${value}`));
    assert.match(html, /bu-goods-stack/);
    assert.match(html, /×3/);
  }
  const supply = renderToStaticMarkup(createElement(BurgundyGoodsArt, {value: 1}));
  assert.doesNotMatch(supply, /bu-goods-count|bu-goods-stack/);
});
