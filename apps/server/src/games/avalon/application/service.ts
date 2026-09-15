import { GameRevisionSchema, RoomRevisionSchema, ServerTimeSchema,
  AvalonClientCommandSchema, AVALON_DEFAULT_SETTINGS, type AvalonClientCommand, type ErrorDto, type RoomId, type PlayerId, type ServerTime } from "@hangul-rummikub/shared";
import * as v from "valibot";
import { GameStartSuccessDataSchema, type StartGameInput, type GameStartResult } from "../../../application/game-start-service.js";
import type { RoomMutationSerialExecutor } from "../../../application/room-session-service.js";
import type { RoomRepository } from "../../../ports/room-repository.js";
import type { RoomUnitOfWork } from "../../../ports/room-unit-of-work.js";
import type { IdempotencyRepository } from "../../../ports/idempotency-repository.js";
import type { RoomPresencePolicyReader } from "../../../ports/room-presence-policy.js";
import type { Clock, IdGenerator, RandomSource, TurnScheduler } from "../../../ports/system.js";
import type { AvalonRoomRecord } from "../../../model/persistence.js";
import { createAvalonGame, commandAvalon, type AvalonState } from "../domain/game.js";

import { avalonRoles } from "@hangul-rummikub/shared";

export type AvalonDependencies = Readonly<{ roomRepository: RoomRepository; roomUnitOfWork: RoomUnitOfWork; idempotencyRepository: IdempotencyRepository;
  roomMutationExecutor: RoomMutationSerialExecutor; presence: RoomPresencePolicyReader; clock: Clock; ids: IdGenerator; random: RandomSource; turnScheduler: TurnScheduler }>;
const failure = (code: ErrorDto["code"]) => ({ ok: false as const, error: { code, message: "현재 단계와 연결 상태를 확인해주세요.", recoverable: true } });
const Receipt = v.strictObject({ outcome: v.picklist(["ACCEPTED", "CONFIGURED"]) });
const receiptResult = (value: unknown) => {
  const receipt = v.parse(Receipt, value);
  return { ok: true as const, outcome: receipt.outcome };
};
export function transitionAvalon(room: AvalonRoomRecord, state: AvalonState, at: ServerTime): Omit<AvalonRoomRecord, "storageRevision"> {
  if (!room.game) throw new Error("Missing AVALON game.");
  const phase = state.phase === "FINISHED" ? "FINISHED" : "PLAYING";
  return { ...room, phase, game: { ...room.game, state, gameRevision: v.parse(GameRevisionSchema, state.revision), finishedAt: state.finishedAt === null ? null : v.parse(ServerTimeSchema, state.finishedAt) },
    roomRevision: phase === room.phase ? room.roomRevision : v.parse(RoomRevisionSchema, room.roomRevision + 1), updatedAt: at };
}
export class AvalonService {
  private readonly listeners = new Set<(roomId: RoomId) => void | Promise<void>>();
  constructor(readonly deps: AvalonDependencies) {}
  subscribe(listener: (roomId: RoomId) => void | Promise<void>) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async notify(roomId: RoomId) { await Promise.allSettled([...this.listeners].map(fn => Promise.resolve().then(() => fn(roomId)))); }
  async start(input: StartGameInput): Promise<GameStartResult> {
    const d = this.deps;
    try {
      const result = await d.roomMutationExecutor.run(input.roomId, async (): Promise<GameStartResult> => {
        if (!input.authorization.isCurrent()) return failure("UNAUTHENTICATED");
        const room = await d.roomRepository.findById(input.roomId);
        if (room?.gameType !== "AVALON") return failure("INVALID_PHASE");
        const scopeKey = `room-player:${room.roomId}:${input.actorPlayerId}`, payloadFingerprint = JSON.stringify(["game:start", input.expectedRoomRevision]);
        const prior = await d.idempotencyRepository.classify(scopeKey, input.requestId, payloadFingerprint);
        if (prior.status === "CONFLICT") return failure("REQUEST_ID_REUSED");
        if (prior.status === "REPLAY") return { ok: true, data: v.parse(GameStartSuccessDataSchema, prior.record.terminalResult) };
        if (room.phase !== "LOBBY" || room.game !== null) return failure("INVALID_PHASE");
        if (room.hostPlayerId !== input.actorPlayerId) return failure("HOST_ONLY");
        if (room.roomRevision !== input.expectedRoomRevision) return failure("STALE_ROOM_REVISION");
        if (room.players.length < 5) return failure("NOT_ENOUGH_PLAYERS");
        if (room.players.length > 10) return failure("INVALID_PHASE");
        const lease = await d.presence.acquireRoomPresenceLease(room.roomId);
        if (!lease.isCurrent() || !room.players.every(p => lease.connectionStatusByPlayerId.get(p.playerId) === "CONNECTED")) return failure("PLAYERS_NOT_CONNECTED");
        const now = d.clock.now(), gameId = d.ids.generateGameId(), turnId = d.ids.generateTurnId();
        const settings = room.settings ?? AVALON_DEFAULT_SETTINGS;
        const playerIds = room.players.map(p => p.playerId);
        const roles = avalonRoles(playerIds.length, settings);
        for (let i = roles.length - 1; i > 0; i--) { const j = d.random.nextInt(i + 1); [roles[i], roles[j]] = [roles[j]!, roles[i]!]; }
        const state = createAvalonGame({ gameId, playerIds, roles, leaderIndex: d.random.nextInt(playerIds.length), settings, now, transitionId: turnId });
        const roomRevision = v.parse(RoomRevisionSchema, room.roomRevision + 1), gameRevision = v.parse(GameRevisionSchema, 0);
        const data = v.parse(GameStartSuccessDataSchema, { roomId: room.roomId, roomRevision, gameId, gameRevision, turnId });
        const committed = await d.roomUnitOfWork.commit({ roomMutation: { kind: "REPLACE", candidate: { ...room, phase: "PLAYING", roomRevision, updatedAt: now,
          game: { gameId, gameRevision, startedAt: now, finishedAt: null, state } }, expectedRoomRevision: room.roomRevision, expectedStorageRevision: room.storageRevision },
          sessionMutation: { kind: "NONE" }, idempotency: { scopeKey, requestId: input.requestId, payloadFingerprint, terminalResult: data, createdAt: now } },
          { isSatisfied: () => input.authorization.isCurrent() && lease.isCurrent() });
        return committed.status === "COMMITTED" ? { ok: true, data } : failure("STALE_ROOM_REVISION");
      });
      return result;
    } catch { return failure("INTERNAL_ERROR"); }
  }
  async command(input: Readonly<{ roomId: RoomId; actorPlayerId: PlayerId; command: AvalonClientCommand; receivedAt: ServerTime; authorization: { isCurrent(): boolean } }>) {
    const parsed = v.safeParse(AvalonClientCommandSchema, input.command);
    if (!parsed.success) return failure("INVALID_PAYLOAD");
    const d = this.deps, c = parsed.output;
    let changed = false;
    try {
      const result = await d.roomMutationExecutor.run(input.roomId, async () => {
        if (!input.authorization.isCurrent()) return failure("UNAUTHENTICATED");
        const room = await d.roomRepository.findById(input.roomId);
        if (room?.gameType !== "AVALON" || room.departedPlayerIds?.includes(input.actorPlayerId) || !room.players.some(p => p.playerId === input.actorPlayerId)) return failure("INVALID_PHASE");
        const scopeKey = `room-player:${room.roomId}:${input.actorPlayerId}`, payloadFingerprint = JSON.stringify(c);
        const prior = await d.idempotencyRepository.classify(scopeKey, c.requestId, payloadFingerprint);
        if (prior.status === "CONFLICT") return failure("REQUEST_ID_REUSED");
        if (prior.status === "REPLAY") return receiptResult(prior.record.terminalResult);
        const now = d.clock.now(); let candidate: Omit<AvalonRoomRecord, "storageRevision"> = room;
        let outcome: v.InferOutput<typeof Receipt>["outcome"];
        if (c.kind === "avalon:configure") {
          if (room.phase !== "LOBBY") return failure("INVALID_PHASE");
          if (room.hostPlayerId !== input.actorPlayerId) return failure("HOST_ONLY");
          if (room.roomRevision !== c.expectedRoomRevision) return failure("STALE_ROOM_REVISION");
          candidate = { ...room, settings: c.payload, roomRevision: v.parse(RoomRevisionSchema, room.roomRevision + 1), updatedAt: now }; outcome = "CONFIGURED";
        } else {
          if (!room.game || room.game.gameId !== c.gameId) return failure("STALE_GAME_REVISION");
          if (room.phase !== "PLAYING" || room.game.state.transitionId !== c.phaseId) return failure("STALE_GAME_REVISION");
          const state = commandAvalon(room.game.state, input.actorPlayerId, c, now, d.ids.generateTurnId());
          if (!state) return failure("INVALID_PAYLOAD");
          outcome = "ACCEPTED"; candidate = transitionAvalon(room, state, now);
        }
        // The state and replay receipt commit atomically under the room lane.
        const committed = await d.roomUnitOfWork.commit({ roomMutation: { kind: "REPLACE", candidate,
          expectedRoomRevision: room.roomRevision, expectedStorageRevision: room.storageRevision }, sessionMutation: { kind: "NONE" },
          idempotency: { scopeKey, requestId: c.requestId, payloadFingerprint, terminalResult: { outcome }, createdAt: now } }, { isSatisfied: () => input.authorization.isCurrent() });
        if (committed.status !== "COMMITTED") return failure("STALE_GAME_REVISION");
        changed = candidate !== room;
        return receiptResult({ outcome });
      });
      if (changed) await this.notify(input.roomId);
      return result;
    } catch { return failure("INTERNAL_ERROR"); }
  }
}
