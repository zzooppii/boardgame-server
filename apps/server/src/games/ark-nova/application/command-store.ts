import type { PlayerId, RoomId, RoomRevision } from '@hangul-rummikub/shared';
import type { IdempotencyRecord, StorageRevision } from '../../../model/persistence.js';
import type { ArkNovaStoredGame } from '../compatibility/adapter.js';

/** A narrow view of the existing room repository, not a second game/session store. */
export type ArkNovaCommandRoom=Readonly<{
  roomId:RoomId;roomRevision:RoomRevision;storageRevision:StorageRevision;
  phase:'PLAYING'|'FINISHED';activePlayerIds:readonly PlayerId[];game:ArkNovaStoredGame;
}>;
export interface ArkNovaCommandStore {
  /** Return null for missing rooms, other game types, lobbies or unavailable games. */
  load(roomId:RoomId):Promise<ArkNovaCommandRoom|null>;
  /** Compare the room/storage/game revisions and atomically store both game and receipt.
   * Check authorization at the same commit point. Never persist only one half. */
  commit(input:Readonly<{expected:ArkNovaCommandRoom;game:ArkNovaStoredGame;receipt:IdempotencyRecord;authorization:{isCurrent():boolean}}>):
    Promise<'COMMITTED'|'CONFLICT'|'AUTH_CHANGED'>;
}
