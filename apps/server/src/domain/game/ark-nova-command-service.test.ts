import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { PROTOCOL_VERSION, GameIdSchema, PlayerIdSchema, RequestIdSchema, RoomIdSchema, RoomRevisionSchema, ServerTimeSchema, TurnIdSchema } from '@hangul-rummikub/shared';
import { createStorageRevision, type IdempotencyRecord } from '../../model/persistence.js';
import type { IdempotencyRepository } from '../../ports/idempotency-repository.js';
import { KeyedSerialExecutor } from '../../infrastructure/keyed-serial-executor.js';
import { createArkSoloGame } from '../../games/ark-nova/domain/game.js';
import { ArkNovaGameStateAdapter } from '../../games/ark-nova/compatibility/adapter.js';
import { ArkNovaCommandService } from '../../games/ark-nova/application/command-service.js';
import type { ArkNovaCommandRoom, ArkNovaCommandStore } from '../../games/ark-nova/application/command-store.js';

function harness() {
  let seq=0,current=true,commits=0,notifications=0,notifyFails=false;
  const roomId=v.parse(RoomIdSchema,'ark-room'),owner=v.parse(PlayerIdSchema,'ark-owner'),now=v.parse(ServerTimeSchema,1000);
  const state=createArkSoloGame({gameId:v.parse(GameIdSchema,'ark-game'),playerId:owner,now,transitionId:v.parse(TurnIdSchema,'setup'),difficulty:'STANDARD',random:{nextInt:max=>max-1},nextCardId:()=>`card-${++seq}`});
  let room:ArkNovaCommandRoom={roomId,roomRevision:v.parse(RoomRevisionSchema,1),storageRevision:createStorageRevision(1),phase:'PLAYING',activePlayerIds:[owner],game:{gameId:state.gameId,gameRevision:state.revision,startedAt:now,finishedAt:null,state}};
  const receipts=new Map<string,IdempotencyRecord>();let beforeCommit:()=>void=()=>{};
  const store:ArkNovaCommandStore={
    async load(id){return id===roomId?structuredClone(room):null;},
    async commit(input) {
      beforeCommit();
      if(!input.authorization.isCurrent())return 'AUTH_CHANGED';
      if(input.expected.storageRevision!==room.storageRevision||input.expected.roomRevision!==room.roomRevision||input.expected.game.gameId!==room.game.gameId||input.expected.game.gameRevision!==room.game.gameRevision)return 'CONFLICT';
      const game=new ArkNovaGameStateAdapter().cloneAndValidate(input.game);
      const next={...room,game,phase:game.state.phase,storageRevision:createStorageRevision(room.storageRevision+1)};
      const receipt=structuredClone(input.receipt);
      room=next;receipts.set(`${receipt.scopeKey}/${receipt.requestId}`,receipt);commits++;return 'COMMITTED';
    },
  };
  const ledger:IdempotencyRepository={
    async classify(scope,id,fingerprint){const record=receipts.get(`${scope}/${id}`);return record?{status:record.payloadFingerprint===fingerprint?'REPLAY':'CONFLICT',record}:{status:'MISS'};},
    async deleteByScope(){throw new Error('Unexpected deletion.');},async deleteCreatedBefore(){throw new Error('Unexpected cleanup.');},
  };
  const service=new ArkNovaCommandService({commandStore:store,idempotencyRepository:ledger,roomMutationExecutor:new KeyedSerialExecutor(),clock:{now:()=>now},ids:{generateTurnId:()=>v.parse(TurnIdSchema,`transition-${++seq}`)},random:{nextInt:max=>max-1},async notify(){notifications++;if(notifyFails)throw new Error('Disconnected delivery.');}});
  const command={kind:'arkNova:act',protocolVersion:PROTOCOL_VERSION,requestId:v.parse(RequestIdSchema,'request-one'),gameId:state.gameId,expectedGameRevision:state.revision,turnId:state.transitionId,payload:{kind:'INITIAL_HAND',keep:state.hand.slice(0,4).map(c=>c.cardId)}};
  return {command,service,roomId,owner,receipts,authorization:{isCurrent:()=>current},read:()=>structuredClone(room),stats:()=>({commits,notifications}),
    revoke:()=>{current=false;},setBeforeCommit:(fn:()=>void)=>{beforeCommit=fn;},failNotifications:()=>{notifyFails=true;},
    changeStorage:()=>{room={...room,storageRevision:createStorageRevision(room.storageRevision+1)};},
    send(input:unknown=command){return service.command({roomId,actorPlayerId:owner,command:input,authorization:{isCurrent:()=>current}});}};
}
test('Concurrent retransmissions commit a solo action once and replay the receipt despite its now-stale revision',async()=>{
  const h=harness();const results=await Promise.all([h.send(),h.send()]);assert.ok(results.every(r=>r.ok));
  assert.deepEqual(h.stats(),{commits:1,notifications:1});assert.equal(h.receipts.size,1);assert.equal(h.read().game.gameRevision,1);
  const reordered={payload:{keep:h.command.payload.keep,kind:'INITIAL_HAND'},...Object.fromEntries(Object.entries(h.command).filter(([key])=>key!=='payload').reverse())};
  assert.equal((await h.send(reordered)).ok,true);assert.deepEqual(h.stats(),{commits:1,notifications:1});
});
test('Competing requests cannot both apply the same revision and reusing an ID for different content is rejected',async()=>{
  const h=harness(),results=await Promise.all([h.send(),h.send({...h.command,requestId:'different-request'})]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(h.stats().commits,1);assert.equal(h.receipts.size,1);
  const conflict=await h.send({...h.command,payload:{...h.command.payload,keep:[...h.command.payload.keep].reverse()}});
  assert.equal(conflict.ok,false);if(!conflict.ok)assert.equal(conflict.error.code,'REQUEST_ID_REUSED');
});
test('Authorization loss at commit and storage races leave the candidate and receipt unapplied',async()=>{
  for(const reason of ['AUTH_CHANGED','CONFLICT'] as const) {
    const h=harness(),before=h.read().game;
    h.setBeforeCommit(reason==='AUTH_CHANGED'?h.revoke:h.changeStorage);
    const result=await h.send();assert.equal(result.ok,false);
    if(!result.ok)assert.equal(result.error.code,reason==='AUTH_CHANGED'?'UNAUTHENTICATED':'STALE_GAME_REVISION');
    assert.deepEqual(h.read().game,before);assert.equal(h.receipts.size,0);assert.equal(h.stats().notifications,0);
  }
});
test('A delivery failure after commit remains accepted and an unauthorized replay never retrieves an accepted response',async()=>{
  const h=harness();h.failNotifications();assert.equal((await h.send()).ok,true);assert.equal(h.stats().commits,1);
  h.revoke();const result=await h.send();assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'UNAUTHENTICATED');
  assert.deepEqual(h.stats(),{commits:1,notifications:1});
});
test('Invalid payloads and non-members do not create receipts or modify the room',async()=>{
  const h=harness(),before=h.read();
  assert.equal((await h.send({...h.command,playerId:h.owner})).ok,false);
  const result=await h.service.command({roomId:h.roomId,actorPlayerId:v.parse(PlayerIdSchema,'intruder'),command:h.command,authorization:h.authorization});
  assert.equal(result.ok,false);assert.deepEqual(h.read(),before);assert.equal(h.receipts.size,0);
});
