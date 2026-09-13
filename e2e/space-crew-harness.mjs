import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import * as v from 'valibot';
import {
  PROTOCOL_VERSION, SUPPORTED_GAME_TYPES, SessionBootstrapAckSchema,
  StateSyncWireAckSchema, StateSnapshotWireEventSchema, SpaceCrewActionSchema,
} from '@hangul-rummikub/shared';
import { createHttpServer } from '../apps/server/.test-dist/server.js';
import { createApplicationRuntime } from '../apps/server/.test-dist/composition-root.js';
import { InMemorySpaceCrewCampaignRepository } from '../apps/server/.test-dist/games/space-crew/infrastructure/campaign-repository.js';
import { decodeWebSnapshot } from '../apps/web/.test-dist/lib/snapshot-wire-decoder.js';
import { getSpaceCrewAvailableActions } from '../apps/web/.test-dist/features/space-crew/selectors.js';

export function decodeCrew(input) {
  const decoded = decodeWebSnapshot(input);
  assert.equal(decoded.kind, 'COMPATIBLE', 'actual wire snapshot must pass the production web decoder');
  assert.equal(decoded.value.kind, 'PLATFORM_V2_SPACE_CREW');
  return decoded.value.platformSnapshot;
}
export function gameOf(snapshot) {
  assert.equal(snapshot.game?.gameType, 'SPACE_CREW');
  return snapshot.game;
}

/** Real sockets; only the existing randomness port is replaced, never game state. */
export async function createCrewHarness(t, count, { seed = 1000 + count, campaigns = new InMemorySpaceCrewCampaignRepository() } = {}) {
  const runtime = createApplicationRuntime({ spaceCrewCampaignRepository: campaigns, spaceCrewProcessId: `e2e-process-${count}` });
  assert.ok(runtime.spaceCrewService);
  let randomState = seed >>> 0;
  t.mock.method(runtime.spaceCrewService.deps.random, 'nextInt', upper => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState % upper;
  });
  const server = createHttpServer({ serveWeb: false, runtime });
  const clients = [], members = [];
  let closed = false, sequence = 0;
  const close = async () => { if (closed) return; closed = true; clients.forEach(client => client.disconnect()); await server.shutdown(); };
  t.after(close);
  await new Promise((resolve, reject) => { server.httpServer.once('error', reject); server.httpServer.listen(0, '127.0.0.1', resolve); });
  const address = server.httpServer.address(); assert.ok(address && typeof address !== 'string');
  const recoveryToken = Buffer.alloc(32, count).toString('base64url');
  function command(kind, payload = {}, extra = {}) {
    return { kind, protocolVersion: PROTOCOL_VERSION, requestId: `e2e-${count}-${++sequence}`, payload, ...extra };
  }
  function send(member, request) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing ${request.kind} acknowledgement`)), 10000);
      member.client.emit(request.kind, request, raw => { clearTimeout(timer); resolve(raw); });
    });
  }
  function accepted(raw) {
    const ack = v.parse(StateSyncWireAckSchema, raw);
    assert.ok(ack.ok, ack.ok ? '' : `Wire command rejected: ${ack.error.code}`);
    return decodeCrew(ack.data.snapshot);
  }
  async function sync(member = members[0]) { return accepted(await send(member, command('state:sync'))); }
  async function syncAll() {
    const snapshots = await Promise.all(members.map(member => sync(member)));
    for (const member of members) assert.deepEqual(member.deliveryErrors, [], 'broadcast must pass web decoder and credential privacy');
    return snapshots;
  }
  for (let index = 0; index < count; index++) {
    const client = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, reconnection: false,
      auth: { supportsRoomPreparation: true, supportedSnapshotVersions: [2], supportedGameTypes: SUPPORTED_GAME_TYPES } });
    clients.push(client);
    const member = { client, playerId: null, credential: null, latest: null, deliveryErrors: [] };
    client.on('state:snapshot', raw => {
      try {
        assert.equal(JSON.stringify(raw).includes(recoveryToken), false);
        member.latest = decodeCrew(v.parse(StateSnapshotWireEventSchema, raw).payload.snapshot);
      } catch (error) { member.deliveryErrors.push(error instanceof Error ? error.message : 'Invalid broadcast'); }
    });
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    const boot = v.parse(SessionBootstrapAckSchema, await send(member, command('session:bootstrap'))); assert.ok(boot.ok);
    member.credential = boot.data.credential;
    const snapshot = accepted(await send(member, command(index === 0 ? 'room:create' : 'room:join', {
      bootstrapCredential: member.credential, nickname: `승무원${index + 1}`,
      ...(index === 0 ? { gameType: 'SPACE_CREW' } : { roomCode: (await sync()).room.roomCode }),
    })));
    member.playerId = snapshot.self.playerId; members.push(member);
  }
  async function startPractice(missionNumber = 1) {
    const current = await sync();
    accepted(await send(members[0], command('spaceCrew:start', { kind: 'NEW', mode: 'PRACTICE', missionNumber, recoveryToken }, { expectedRoomRevision: current.versions.roomRevision })));
    return syncAll();
  }
  async function practiceMission(missionNumber) {
    const current = await sync(), game = gameOf(current);
    accepted(await send(members[0], command('spaceCrew:practiceMission', { missionNumber }, { gameId: game.gameId, attemptId: game.attemptId, expectedGameRevision: game.gameRevision })));
    return syncAll();
  }
  function actionCommand(snapshot, action) {
    const game = gameOf(snapshot);
    return command('spaceCrew:act', v.parse(SpaceCrewActionSchema, action), { gameId: game.gameId, attemptId: game.attemptId, expectedGameRevision: game.gameRevision });
  }
  async function act(index, snapshot, action) {
    assert.ok(getSpaceCrewAvailableActions(gameOf(snapshot)).some(candidate => JSON.stringify(candidate) === JSON.stringify(action)), 'fixture must choose an action from that viewer’s web selector');
    const response = accepted(await send(members[index], actionCommand(snapshot, action)));
    assert.equal(gameOf(response).gameRevision, gameOf(snapshot).gameRevision + 1);
    return syncAll();
  }
  return { runtime, campaigns, members, recoveryToken, close, command, send, accepted, sync, syncAll, startPractice, practiceMission, actionCommand, act };
}

/** Compare all independently decoded views; never consult canonical hands. */
export function assertCrewViews(harness, snapshots, { expectBroadcast = true } = {}) {
  const games = snapshots.map(gameOf), first = games[0];
  const publicView = ({ privateState, ...rest }) => rest;
  const allHands = games.flatMap(game => game.privateState.hand);
  assert.equal(new Set(allHands.map(card => card.cardId)).size, allHands.length, 'every in-hand instance belongs to exactly one viewer');
  assert.equal(allHands.length + first.currentTrick.length + first.completedTrickCount * games.length, 40);
  for (const [index, game] of games.entries()) {
    assert.equal(game.privateState.playerId, harness.members[index].playerId);
    assert.deepEqual(publicView(game), publicView(first), 'all viewers agree on the complete public game');
    const exposed = new Set([...game.privateState.hand, ...game.currentTrick.map(play => play.card), ...(game.lastTrick?.plays.map(play => play.card) ?? []),
      ...game.communications.flatMap(item => item.card ? [item.card] : [])].map(card => card.cardId));
    const text = JSON.stringify(game);
    assert.equal(text.includes(harness.recoveryToken), false);
    for (const key of ['recoveryToken', 'recoveryDigest', 'lease', 'pendingInterruption', 'taskDeck', 'selectionOrder', 'exchange']) assert.equal(Object.hasOwn(game, key), false);
    for (const card of allHands) if (!exposed.has(card.cardId)) assert.equal(text.includes(JSON.stringify(card.cardId)), false, 'an opponent’s undisclosed card must not occur anywhere in this viewer’s projection');
    for (const other of games) {
      const selection = other.privateState.pendingDistressCardId;
      if (selection && other.privateState.playerId !== game.privateState.playerId && !exposed.has(selection)) assert.equal(text.includes(JSON.stringify(selection)), false);
    }
    const original = JSON.stringify(game);
    for (const action of getSpaceCrewAvailableActions(game)) {
      v.parse(SpaceCrewActionSchema, action);
      if (action.kind === 'PLAY' || action.kind === 'COMMUNICATE') assert.ok(game.privateState.hand.some(card => card.cardId === action.cardId));
      if (action.kind === 'DISTRESS' && action.action.kind === 'SELECT') assert.ok(game.privateState.hand.some(card => card.cardId === action.action.cardId && card.kind === 'COLOR'));
      if (action.kind === 'TASK') for (const key of ['taskId', 'firstTaskId', 'secondTaskId', 'fromTaskId', 'toTaskId']) {
        const value = action.action[key]; if (value !== undefined && value !== null) assert.ok(game.tasks.visibleTasks.some(task => task.id === value));
      }
    }
    assert.equal(JSON.stringify(game), original, 'web selectors leave the received view untouched');
    if (expectBroadcast) {
      assert.ok(harness.members[index].latest?.game);
      assert.deepEqual(harness.members[index].latest.game, game, 'actual broadcast and state-sync agree for each viewer');
    }
  }
  return first;
}
