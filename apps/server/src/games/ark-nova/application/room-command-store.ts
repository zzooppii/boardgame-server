import * as v from 'valibot';
import { RoomRevisionSchema, type RoomId } from '@hangul-rummikub/shared';
import type { RoomRepository } from '../../../ports/room-repository.js';
import type { RoomUnitOfWork } from '../../../ports/room-unit-of-work.js';
import type { ArkNovaCommandStore, ArkNovaCommandRoom } from './command-store.js';

/** Uses the platform's existing atomic room + receipt transaction. */
export class ArkNovaRoomCommandStore implements ArkNovaCommandStore {
  constructor(private readonly rooms:RoomRepository, private readonly unitOfWork:RoomUnitOfWork) {}

  async load(roomId:RoomId):Promise<ArkNovaCommandRoom|null> {
    const room=await this.rooms.findById(roomId);
    if(!room || room.gameType!=='ARK_NOVA' || room.phase==='LOBBY' || !room.game)return null;
    return {roomId:room.roomId,roomRevision:room.roomRevision,storageRevision:room.storageRevision,
      phase:room.phase,game:room.game,
      activePlayerIds:room.players.filter(p=>!room.departedPlayerIds?.includes(p.playerId)).map(p=>p.playerId)};
  }

  async commit(input:Parameters<ArkNovaCommandStore['commit']>[0]):Promise<'COMMITTED'|'CONFLICT'|'AUTH_CHANGED'> {
    if(!input.authorization.isCurrent())return 'AUTH_CHANGED';
    const room=await this.rooms.findById(input.expected.roomId), expected=input.expected;
    if(!room || room.gameType!=='ARK_NOVA' || !room.game || room.phase!==expected.phase ||
      room.roomRevision!==expected.roomRevision || room.storageRevision!==expected.storageRevision ||
      room.game.gameId!==expected.game.gameId || room.game.gameRevision!==expected.game.gameRevision)return 'CONFLICT';
    const phase=input.game.state.phase;
    const result=await this.unitOfWork.commit({
      roomMutation:{kind:'REPLACE',expectedRoomRevision:expected.roomRevision,expectedStorageRevision:expected.storageRevision,
        candidate:{...room,game:input.game,phase,updatedAt:input.receipt.createdAt,
          roomRevision:phase===room.phase?room.roomRevision:v.parse(RoomRevisionSchema,room.roomRevision+1)}},
      sessionMutation:{kind:'NONE'},idempotency:input.receipt,
    },{isSatisfied:()=>input.authorization.isCurrent()});
    if(result.status==='COMMITTED')return 'COMMITTED';
    if(result.status==='PRECONDITION_FAILED' && result.reason==='COMMIT_PRECONDITION_FAILED')return 'AUTH_CHANGED';
    return 'CONFLICT';
  }
}
