import type {RoomId, PlayerId, RequestId, ServerTime} from '@hangul-rummikub/shared';
import type {SpeakeasyGameFlow} from '../domain/game-flow.js';

/** Internal records only. Never include this record, receipts or fingerprints in a wire projection. */
export type SpeakeasyReceipt = Readonly<{
  actorId: PlayerId; requestId: RequestId; fingerprint: string; revision: number; createdAt: ServerTime;
}>;
export type StoredSpeakeasyGame = Readonly<{
  roomId: RoomId; version: number; status: 'PLAYING'|'CLOSED';
  state: SpeakeasyGameFlow; receipts: readonly SpeakeasyReceipt[];
}>;
export type SpeakeasyStoreCommit = Readonly<{
  roomId: RoomId; expectedVersion: number; actorId: PlayerId; requestId: RequestId;
  fingerprint: string; candidate: SpeakeasyGameFlow; at: ServerTime;
}>;
export type SpeakeasyStoreResult =
  | {status: 'COMMITTED'|'REPLAY'; record: StoredSpeakeasyGame; receipt: SpeakeasyReceipt}
  | {status: 'CONFLICT'|'STALE'|'UNAUTHORIZED'|'CLOSED'};

/** Atomic state+receipt boundary. Implementations must provide detached reads/results and check
 * authorization synchronously at commit, CAS the storage version, and scope receipts to game+actor.
 * A future platform adapter must participate in the existing Room UoW, never a second side write.
 */
export interface SpeakeasyCommandStore {
  read(roomId: RoomId): Promise<StoredSpeakeasyGame|null>;
  commit(change: SpeakeasyStoreCommit, authorization: {isCurrent(): boolean}): Promise<SpeakeasyStoreResult>;
}
