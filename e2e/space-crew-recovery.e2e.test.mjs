import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { parse } from 'valibot';
import { SUPPORTED_GAME_TYPES, StateSyncWireAckSchema, SessionBootstrapAckSchema,
  SpaceCrewStartCommandSchema, SpaceCrewClientCommandSchema } from '@hangul-rummikub/shared';
import { createHttpServer } from '../apps/server/.test-dist/server.js';
import { createApplicationRuntime } from '../apps/server/.test-dist/composition-root.js';
import { FileSpaceCrewCampaignRepository } from '../apps/server/.test-dist/games/space-crew/infrastructure/campaign-repository.js';
import { SpaceCrewCampaignStorage } from '../apps/web/.test-dist/features/space-crew/campaign-storage.js';
import { SpaceCrewOutbox, spaceCrewRejectionIsDefinitive } from '../apps/web/.test-dist/lib/space-crew-outbox.js';
import { decodeWebSnapshot } from '../apps/web/.test-dist/lib/snapshot-wire-decoder.js';

class BrowserStorage {
  entries = new Map();
  get length() { return this.entries.size; }
  key(index) { return [...this.entries.keys()][index] ?? null; }
  getItem(key) { return this.entries.get(key) ?? null; }
  setItem(key, value) { this.entries.set(key, value); }
  removeItem(key) { this.entries.delete(key); }
}
const browserCrypto = {
  randomBytes: () => webcrypto.getRandomValues(new Uint8Array(32)),
  sha256: bytes => webcrypto.subtle.digest('SHA-256', bytes),
};
function take(result) { assert.equal(result.ok, true, result.ok ? '' : result.reason); return result.value; }
function game(snapshot) { assert.equal(snapshot.game?.gameType, 'SPACE_CREW'); return snapshot.game; }
function snapshot(raw) {
  const ack = parse(StateSyncWireAckSchema, raw); assert.equal(ack.ok, true, ack.ok ? '' : ack.error.code);
  const decoded = decodeWebSnapshot(ack.data.snapshot); assert.equal(decoded.kind, 'COMPATIBLE');
  assert.equal(decoded.value.kind, 'PLATFORM_V2_SPACE_CREW'); return decoded.value.platformSnapshot;
}

async function serverRoom(t, directory, processId, count = 4) {
  const campaigns = new FileSpaceCrewCampaignRepository({ directory });
  const server = createHttpServer({ serveWeb: false, runtime: createApplicationRuntime({ spaceCrewCampaignRepository: campaigns, spaceCrewProcessId: processId }) });
  const clients = [], broadcasts = []; let closed = false, sequence = 0;
  const close = async () => { if (closed) return; closed = true; clients.forEach(client => client.disconnect()); await server.shutdown(); };
  t.after(close);
  await new Promise(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
  const address = server.httpServer.address(); assert.ok(address && typeof address !== 'string');
  async function connect() {
    const client = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, reconnection: false,
      auth: { supportsRoomPreparation: true, supportedSnapshotVersions: [2], supportedGameTypes: SUPPORTED_GAME_TYPES } });
    clients.push(client); client.on('state:snapshot', event => broadcasts.push(event));
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    return client;
  }
  const request = (kind, payload = {}, extra = {}) => ({ kind, protocolVersion: 1, requestId: `${processId}-request-${++sequence}`, payload, ...extra });
  const send = (client, command) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing ${command.kind} acknowledgement`)), 5000);
    client.emit(command.kind, command, raw => { clearTimeout(timer); resolve(raw); });
  });
  const call = (client, kind, payload = {}, extra = {}) => send(client, request(kind, payload, extra));
  async function bootstrap(client) {
    const ack = parse(SessionBootstrapAckSchema, await call(client, 'session:bootstrap')); assert.ok(ack.ok); return ack.data.credential;
  }
  const host = await connect(), credential = await bootstrap(host);
  let lobby = snapshot(await call(host, 'room:create', { bootstrapCredential: credential, nickname: '복구방장', gameType: 'SPACE_CREW' }));
  const members = [{ client: host, credential, playerId: lobby.self.playerId, tab: new BrowserStorage() }];
  for (let index = 1; index < count; index++) {
    const client = await connect(), credential = await bootstrap(client);
    lobby = snapshot(await call(client, 'room:join', { bootstrapCredential: credential, roomCode: lobby.room.roomCode, nickname: `복구선원${index}` }));
    members.push({ client, credential, playerId: lobby.self.playerId, tab: new BrowserStorage() });
  }
  const sync = async (member = members[0]) => snapshot(await call(member.client, 'state:sync'));
  const scope = member => ({ roomId: lobby.room.roomId, playerId: member.playerId });
  const actor = playerId => { const member = members.find(member => member.playerId === playerId); assert.ok(member); return member; };
  function command(view, payload, kind = 'spaceCrew:act') {
    const current = game(view);
    return parse(SpaceCrewClientCommandSchema, request(kind, payload, { gameId: current.gameId, attemptId: current.attemptId, expectedGameRevision: current.gameRevision }));
  }
  function startCommand(view, payload) {
    return parse(SpaceCrewStartCommandSchema, request('spaceCrew:start', payload, { expectedRoomRevision: view.versions.roomRevision }));
  }
  async function dispatch(member, command) {
    const outbox = new SpaceCrewOutbox(member.tab); outbox.save(scope(member), command);
    const raw = await send(member.client, command), ack = parse(StateSyncWireAckSchema, raw);
    if (ack.ok || spaceCrewRejectionIsDefinitive(ack.error.code)) outbox.clear(scope(member), command.requestId);
    return snapshot(raw);
  }
  async function loseAcknowledgement(member, command) {
    const outbox = new SpaceCrewOutbox(member.tab); outbox.save(scope(member), command);
    // Drop the ACK callback entirely. Observe only the independent authorized
    // state broadcast to know the real server committed before simulating reload.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { member.client.off('state:snapshot', changed); reject(new Error('Missing committed state after dropped acknowledgement')); }, 5000);
      const changed = event => {
        const decoded = decodeWebSnapshot(event.payload.snapshot);
        if (decoded.kind !== 'COMPATIBLE' || decoded.value.kind !== 'PLATFORM_V2_SPACE_CREW') return;
        const view = decoded.value.platformSnapshot;
        if (view.self.playerId !== member.playerId || view.room.roomId !== lobby.room.roomId || !view.game) return;
        const advanced = command.kind === 'spaceCrew:start' ? view.versions.roomRevision > command.expectedRoomRevision
          : view.game.gameId === command.gameId && view.game.gameRevision > command.expectedGameRevision;
        if (!advanced) return;
        clearTimeout(timer); member.client.off('state:snapshot', changed); resolve();
      };
      member.client.on('state:snapshot', changed);
      member.client.emit(command.kind, command, () => {});
    });
    assert.deepEqual(new SpaceCrewOutbox(member.tab).read(scope(member)), command);
  }
  async function reconnect(member) {
    member.client.disconnect(); member.client = await connect();
    const raw = await call(member.client, 'session:resume', { credential: { ...member.credential, roomCode: lobby.room.roomCode }, lastSeenVersions: null });
    const resumed = snapshot(raw); assert.equal(resumed.self.playerId, member.playerId); return resumed;
  }
  async function choose(view) {
    const current = game(view), member = actor(current.tasks.activePlayerId), task = current.tasks.visibleTasks.find(task => task.ownerId === null); assert.ok(task);
    return dispatch(member, command(view, { kind: 'TASK', action: { kind: 'CHOOSE', taskId: task.id } }));
  }
  return { server, campaigns, close, broadcasts, members, sync, scope, actor, command, startCommand, dispatch, loseAcknowledgement, reconnect, choose };
}

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'space-crew-recovery-e2e-'));
  // Explicit server closes occur before cleanup; this remains a fallback for failed assertions.
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}

test('P8 recovery: browser-backed NEW and action envelopes survive lost acknowledgements and same-seat reconnect', async t => {
  const path = await directory(t), h = await serverRoom(t, path, 'ack-loss');
  const local = new BrowserStorage(), saved = new SpaceCrewCampaignStorage(() => local, () => browserCrypto);
  const credential = take(await saved.create({ mode: 'CAMPAIGN', label: '응답 유실 검증' }));
  assert.deepEqual(take(await new SpaceCrewCampaignStorage(() => local, () => browserCrypto).list()), [credential]);
  const host = h.members[0], initial = await h.sync(), start = h.startCommand(initial, { kind: 'NEW', mode: 'CAMPAIGN', recoveryToken: credential.recoveryToken });
  await h.loseAcknowledgement(host, start);
  const committed = await h.sync(), beforeReplay = game(committed), checkpoint = await h.campaigns.read(credential.campaignId);
  assert.equal(checkpoint.attempts.length, 1); assert.equal(checkpoint.attempts[0].status, 'ACTIVE');
  const reconnected = await h.reconnect(host); assert.deepEqual(game(reconnected).privateState, beforeReplay.privateState);
  const replay = new SpaceCrewOutbox(host.tab).read(h.scope(host)); assert.deepEqual(replay, start);
  const replayed = await h.dispatch(host, replay);
  assert.deepEqual(game(replayed), beforeReplay); assert.equal(new SpaceCrewOutbox(host.tab).read(h.scope(host)), null);
  assert.deepEqual(await h.campaigns.read(credential.campaignId), checkpoint);

  const chooser = h.actor(game(replayed).tasks.activePlayerId), own = await h.sync(chooser), target = game(own).tasks.visibleTasks[0];
  const choose = h.command(own, { kind: 'TASK', action: { kind: 'CHOOSE', taskId: target.id } });
  await h.loseAcknowledgement(chooser, choose);
  const selected = game(await h.sync(chooser)); assert.equal(selected.gameRevision, game(own).gameRevision + 1);
  const replayChoice = new SpaceCrewOutbox(chooser.tab).read(h.scope(chooser)); assert.deepEqual(replayChoice, choose);
  assert.deepEqual(game(await h.dispatch(chooser, replayChoice)), selected);
  assert.deepEqual(await h.campaigns.read(credential.campaignId), checkpoint);
  assert.equal(JSON.stringify(h.broadcasts).includes(credential.recoveryToken), false);
  assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).length, 0);
  await h.close();
});

test('P8 recovery: exported browser credential resumes file-backed progress after restart with fresh room, seats and cards', async t => {
  const path = await directory(t), first = await serverRoom(t, path, 'before-restart');
  // Only the injected entropy port is fixed; all assignment, trick and mission rules execute normally.
  t.mock.method(first.server.runtime.spaceCrewService.deps.random, 'nextInt', upper => upper - 1);
  const local = new BrowserStorage(), saved = new SpaceCrewCampaignStorage(() => local, () => browserCrypto);
  const credential = take(await saved.create({ mode: 'CAMPAIGN' }));
  let view = await first.dispatch(first.members[0], first.startCommand(await first.sync(), { kind: 'NEW', mode: 'CAMPAIGN', recoveryToken: credential.recoveryToken }));
  view = await first.choose(view);
  for (let index = 0; index < 4; index++) {
    const member = first.actor(game(view).activePlayerId), own = await first.sync(member), state = game(own);
    const suit = state.currentTrick[0]?.card.suit, matching = state.privateState.hand.filter(card => card.suit === suit);
    const card = (matching.length ? matching : state.privateState.hand)[0]; assert.ok(card);
    view = await first.dispatch(member, first.command(own, { kind: 'PLAY', cardId: card.cardId }));
  }
  assert.equal(game(view).missionStatus, 'SUCCESS');
  view = await first.dispatch(first.members[0], first.command(view, {}, 'spaceCrew:next'));
  while (game(view).tasks.phase !== 'READY') view = await first.choose(view);
  view = await first.dispatch(first.members[0], first.command(view, { kind: 'DISTRESS', action: { kind: 'PROPOSE', direction: 'LEFT' } }));
  for (const member of first.members.slice(1)) view = await first.dispatch(member, first.command(await first.sync(member), { kind: 'DISTRESS', action: { kind: 'VOTE', accept: true } }));
  for (const member of first.members) {
    const own = await first.sync(member), card = game(own).privateState.hand.find(card => card.kind === 'COLOR'); assert.ok(card);
    view = await first.dispatch(member, first.command(own, { kind: 'DISTRESS', action: { kind: 'SELECT', cardId: card.cardId } }));
  }
  const old = game(view), checkpointBefore = await first.campaigns.read(credential.campaignId);
  const oldCards = (await Promise.all(first.members.map(async member => game(await first.sync(member)).privateState.hand))).flat();
  assert.equal(old.missionNumber, 2); assert.equal(old.distress.active, true);
  assert.deepEqual(checkpointBefore.attempts.map(attempt => attempt.status), ['SUCCESS', 'ACTIVE']);
  take(await saved.updateMetadata(credential.campaignId, { missionNumber: 2 }));
  const recoveryText = take(await saved.exportRecoveryText(credential.campaignId));
  await first.close();

  const second = await serverRoom(t, path, 'after-restart', 3), importedBrowser = new BrowserStorage();
  const importedStorage = new SpaceCrewCampaignStorage(() => importedBrowser, () => browserCrypto);
  const imported = take(await importedStorage.importRecoveryText(recoveryText)); assert.equal(imported.campaignId, credential.campaignId);
  const lobby = await second.sync(), resume = second.startCommand(lobby, { kind: 'RESUME', campaignId: imported.campaignId, recoveryToken: imported.recoveryToken });
  const resumed = await second.dispatch(second.members[0], resume), current = game(resumed);
  assert.notEqual(resumed.room.roomId, view.room.roomId); assert.notEqual(current.gameId, old.gameId); assert.notEqual(current.attemptId, old.attemptId);
  assert.ok(second.members.every(member => !first.members.some(oldMember => oldMember.playerId === member.playerId)));
  assert.equal(current.missionNumber, 2); assert.equal(current.attemptNumber, 2); assert.equal(current.distress.active, true);
  assert.equal(current.completedTrickCount, 0); assert.equal(current.totalTricks, 13); assert.deepEqual(current.campaign.completedMissions, [1]);
  assert.equal(current.campaign.recordedAttempts, 3);
  const checkpointAfter = await second.campaigns.read(imported.campaignId);
  assert.deepEqual(checkpointAfter.attempts.map(attempt => attempt.status), ['SUCCESS', 'ABORTED', 'ACTIVE']);
  assert.deepEqual(checkpointAfter.distressEvents, checkpointBefore.distressEvents);
  const newHands = (await Promise.all(second.members.map(async member => game(await second.sync(member)).privateState.hand))).flat();
  assert.equal(newHands.length, 40); assert.equal(new Set(newHands.map(card => card.cardId)).size, 40);
  assert.ok(newHands.every(card => !oldCards.some(oldCard => oldCard.cardId === card.cardId)));
  const files = await Promise.all((await readdir(path)).filter(name => name.endsWith('.json')).map(name => readFile(join(path, name), 'utf8')));
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.equal(file.includes(imported.recoveryToken), false);
    assert.ok([...oldCards, ...newHands].every(card => !file.includes(card.cardId)));
  }
  assert.equal(JSON.stringify(second.broadcasts).includes(imported.recoveryToken), false);
  assert.equal((await second.server.runtime.persistence.listActiveTurnDeadlines()).length, 0);
  await second.close();
});
