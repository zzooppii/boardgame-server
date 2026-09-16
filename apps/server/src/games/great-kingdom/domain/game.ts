import * as v from "valibot";
import { GameIdSchema, GameRevisionSchema, PlayerIdSchema, ServerTimeSchema, TileIdSchema, TurnIdSchema,
  GreatKingdomSettingsSchema, GREAT_KINGDOM_DEFAULT_SETTINGS, type GreatKingdomSettings,
  GreatKingdomBoardSchema, GreatKingdomColorSchema, GreatKingdomMoveSchema, GreatKingdomResultSchema,
  GreatKingdomPlayingProjectionSchema, GreatKingdomFinishedProjectionSchema, greatKingdomProjectionIsConsistent,
  type GameId, type PlayerId, type ServerTime, type TurnId, type TileId, type GreatKingdomAction, type GreatKingdomProjection,
} from "@hangul-rummikub/shared";
import { legalPositions, territoryOwners, surroundedCastles } from "./board.js";
const Player = v.strictObject({playerId: PlayerIdSchema, color: GreatKingdomColorSchema, reserve: v.pipe(v.array(TileIdSchema), v.maxLength(40))});
const Base = {rulesVersion: v.literal("great-kingdom-base-v2"), gameId: GameIdSchema, revision: GameRevisionSchema,
  startedAt: ServerTimeSchema, transitionId: TurnIdSchema,
  settings: GreatKingdomSettingsSchema, botPlayerId: v.nullable(PlayerIdSchema), deadlineAt: v.nullable(ServerTimeSchema),
  board: GreatKingdomBoardSchema, players: v.pipe(v.array(Player), v.length(2)),
  history: v.pipe(v.array(GreatKingdomMoveSchema), v.maxLength(162)),
  consecutivePasses: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(2))};
const Schema = v.variant("phase", [
  v.strictObject({...Base, phase: v.literal("PLAYING"), activePlayerId: PlayerIdSchema, finishedAt: v.null()}),
  v.strictObject({...Base, phase: v.literal("FINISHED"), finishedAt: ServerTimeSchema, result: GreatKingdomResultSchema}),
]);
export type GreatKingdomState = v.InferOutput<typeof Schema>;
export type GreatKingdomSetup = Readonly<{reserves: readonly (readonly TileId[])[]; neutralId: TileId; starter: number; settings?: GreatKingdomSettings; botPlayerId?: PlayerId | null;}>;
export type GreatKingdomOutcome = Readonly<{ok: true; state: GreatKingdomState}> | Readonly<{ok: false; reason: "INVALID_PHASE" | "NOT_YOUR_TURN" | "INVALID_ACTION"}>;
export function publicGreatKingdom(s: GreatKingdomState): GreatKingdomProjection {
  const owners = territoryOwners(s.board);
  const base = {gameType: "GREAT_KINGDOM", gameId: s.gameId, gameRevision: s.revision, rulesVersion: s.rulesVersion,
    settings: s.settings, botPlayerId: s.botPlayerId, deadlineAt: s.deadlineAt, board: s.board, territoryOwners: owners,
    playerStates: s.players.map(p => ({playerId: p.playerId, color: p.color, remaining: p.reserve.length, territory: owners.filter(o => o === p.color).length})),
    history: s.history, consecutivePasses: s.consecutivePasses};
  if (s.phase === "FINISHED") return v.parse(GreatKingdomFinishedProjectionSchema, {...base, phase: s.phase, result: s.result});
  const player = s.players.find(p => p.playerId === s.activePlayerId);
  if (!player) throw new Error("Great Kingdom actor missing.");
  return v.parse(GreatKingdomPlayingProjectionSchema, {...base, phase: s.phase, activePlayerId: s.activePlayerId,
    turnId: s.transitionId, legalPositions: legalPositions(s.board, player.color, player.reserve.length)});
}
export function parseGreatKingdomState(input: unknown): GreatKingdomState {
  const s = v.parse(Schema, input);
  if (s.deadlineAt !== null && s.deadlineAt < s.startedAt) throw new Error("Invalid Great Kingdom deadline.");
  const ids = [...s.board.flatMap(c => c ? [c.tileId] : []), ...s.players.flatMap(p => p.reserve)];
  if (ids.length !== 81 || new Set(ids).size !== 81 || !greatKingdomProjectionIsConsistent(publicGreatKingdom(s))) throw new Error("Invalid Great Kingdom state.");
  const blue = surroundedCastles(s.board, "BLUE"), orange = surroundedCastles(s.board, "ORANGE");
  if (s.phase === "PLAYING" && (blue.length || orange.length)) throw new Error("Unresolved siege.");
  if (s.phase === "FINISHED") {
    if (s.finishedAt < s.startedAt) throw new Error("Invalid finish time.");
    if (s.result.reason === "SIEGE") {
      const last = s.history.at(-1); if (!last) throw new Error("Missing siege move.");
      const opponent = last.color === "BLUE" ? orange : blue, own = last.color === "BLUE" ? blue : orange;
      const destroyed = opponent.length ? opponent : own;
      if (JSON.stringify(destroyed) !== JSON.stringify(s.result.destroyedPositions)) throw new Error("Invalid siege result.");
      const winner = opponent.length ? last.playerId : s.players.find(p => p.playerId !== last.playerId)?.playerId;
      if (s.result.winnerPlayerIds[0] !== winner) throw new Error("Invalid siege winner.");
    } else if (blue.length || orange.length) throw new Error("Unresolved terminal siege.");
  }
  return s;
}
export function createGreatKingdomGame(input: GreatKingdomSetup & {gameId: GameId; playerIds: readonly PlayerId[]; now: ServerTime; transitionId: TurnId}): GreatKingdomState {
  if (input.playerIds.length !== 2 || input.reserves.length !== 2 || input.reserves.some(r => r.length !== 40) || ![0, 1].includes(input.starter)) throw new Error("Invalid Great Kingdom setup.");
  const players = [input.starter, 1 - input.starter].map((seat, i) => ({playerId: input.playerIds[seat]!, color: i === 0 ? "BLUE" : "ORANGE", reserve: input.reserves[seat]}));
  const settings = input.settings ?? GREAT_KINGDOM_DEFAULT_SETTINGS, botPlayerId = input.botPlayerId ?? null;
  return parseGreatKingdomState({settings, botPlayerId, deadlineAt: nextKingdomDeadline(settings, botPlayerId, players[0]!.playerId, input.now), rulesVersion: "great-kingdom-base-v2", gameId: input.gameId, revision: 0, startedAt: input.now,
    transitionId: input.transitionId, players,
    board: Array.from({length: 81}, (_, i) => i === 40 ? {tileId: input.neutralId, color: "NEUTRAL"} : null),
    history: [], consecutivePasses: 0, phase: "PLAYING", activePlayerId: players[0]!.playerId, finishedAt: null});
}
function base(s: GreatKingdomState) {
  return {rulesVersion: s.rulesVersion, gameId: s.gameId, revision: v.parse(GameRevisionSchema, s.revision + 1), startedAt: s.startedAt,
    settings: s.settings, botPlayerId: s.botPlayerId, deadlineAt: s.deadlineAt, transitionId: s.transitionId, board: s.board, players: s.players, history: s.history, consecutivePasses: s.consecutivePasses};
}
export function applyGreatKingdomAction(original: GreatKingdomState, actor: PlayerId, action: GreatKingdomAction, now: ServerTime, transitionId: TurnId): GreatKingdomOutcome {
  if (original.phase !== "PLAYING") return {ok: false, reason: "INVALID_PHASE"};
  if (original.activePlayerId !== actor) return {ok: false, reason: "NOT_YOUR_TURN"};
  const s = parseGreatKingdomState(original), player = s.players.find(p => p.playerId === actor)!;
  const other = s.players.find(p => p.playerId !== actor)!;
  if (action.kind === "PLACE") {
    if (!legalPositions(s.board, player.color, player.reserve.length).includes(action.position)) return {ok: false, reason: "INVALID_ACTION"};
    const tileId = player.reserve.shift(); if (!tileId) return {ok: false, reason: "INVALID_ACTION"};
    s.board[action.position] = {tileId, color: player.color}; s.consecutivePasses = 0;
  } else s.consecutivePasses++;
  s.history.push({move: s.history.length + 1, playerId: actor, color: player.color, kind: action.kind, position: action.kind === "PLACE" ? action.position : null});
  const candidate = {...base(s), transitionId};
  if (action.kind === "PLACE") {
    const opponent = surroundedCastles(s.board, other.color), own = surroundedCastles(s.board, player.color);
    if (opponent.length || own.length) return {ok: true, state: parseGreatKingdomState({...candidate, deadlineAt: null, phase: "FINISHED", finishedAt: now,
      result: {reason: "SIEGE", winnerPlayerIds: [opponent.length ? actor : other.playerId], destroyedPositions: opponent.length ? opponent : own}})};
  }
  if (s.consecutivePasses === 2) {
    const owners = territoryOwners(s.board), difference = owners.filter(c => c === "BLUE").length - owners.filter(c => c === "ORANGE").length;
    const winnerPlayerIds = difference === 0 ? [] : [s.players[difference > 0 ? 0 : 1]!.playerId];
    return {ok: true, state: parseGreatKingdomState({...candidate, deadlineAt: null, phase: "FINISHED", finishedAt: now,
      result: {reason: "TERRITORY", winnerPlayerIds, destroyedPositions: []}})};
  }
  return {ok: true, state: parseGreatKingdomState({...candidate, deadlineAt: nextKingdomDeadline(s.settings, s.botPlayerId, other.playerId, now), phase: "PLAYING", finishedAt: null, activePlayerId: other.playerId})};
}
export function cancelGreatKingdom(original: GreatKingdomState, now: ServerTime): GreatKingdomState {
  if (original.phase === "FINISHED") return parseGreatKingdomState(original);
  return parseGreatKingdomState({...base(parseGreatKingdomState(original)), deadlineAt: null, phase: "FINISHED", finishedAt: now,
    result: {reason: "CANCELLED", winnerPlayerIds: [], destroyedPositions: []}});
}

/** Bot wakeups use the same recoverable server scheduler as human deadlines. */
export function nextKingdomDeadline(settings: GreatKingdomSettings, bot: PlayerId | null, actor: PlayerId, now: ServerTime): ServerTime | null {
  const delay = actor === bot ? 650 : settings.turnSeconds * 1000;
  return delay === 0 ? null : v.parse(ServerTimeSchema, now + delay);
}
