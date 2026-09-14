import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2, } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2) {
    const server = createHttpServer({ serveWeb: false }), clients: Client[] = [];
    t.after(async () => { clients.forEach(c => c.disconnect()); await server.shutdown(); });
    await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    let seq = 0;
    const request = (kind: string, payload: unknown = {}, extra: Record<string, unknown> = {}): Command => ({ kind, protocolVersion: 1, requestId: `room-prepare-${++seq}`, payload, ...extra });
    async function connect(types: readonly GameType[] = SUPPORTED_GAME_TYPES) {
        const client: Client = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { supportsRoomPreparation: true, supportedSnapshotVersions: [2], supportedGameTypes: types } });
        clients.push(client);
        await new Promise<void>((resolve, reject) => { client.once("connect", resolve); client.once("connect_error", reject); });
        return client;
    }
    const send = (client: Client, command: Command) => new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Missing ${command.kind} acknowledgement`)), 5000);
        client.emit(command.kind, command, value => { clearTimeout(timer); resolve(value); });
    });
    const call = (client: Client, kind: string, payload: unknown = {}, extra: Record<string, unknown> = {}) => send(client, request(kind, payload, extra));
    const success = (raw: unknown) => { const ack = v.parse(StateSyncWireAckSchema, raw); assert.ok(ack.ok, ack.ok ? "" : JSON.stringify(ack.error)); return v.parse(PlatformSnapshotV2Schema, ack.data.snapshot); };
    const failure = (raw: unknown) => { const ack = v.parse(StateSyncWireAckSchema, raw); assert.equal(ack.ok, false); if (ack.ok)
        throw new Error("Expected failure"); return ack.error.code; };
    const bootstrap = async (client: Client) => { const ack = v.parse(SessionBootstrapAckSchema, await call(client, "session:bootstrap")); assert.ok(ack.ok); return ack.data.credential; };
    const host = await connect(), hostCredential = await bootstrap(host);
    let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: "PERCH" }));
    const members = [{ client: host, credential: hostCredential, playerId: lobby.self.playerId }];
    for (let i = 1; i < count; i++) {
        const client = await connect(), credential = await bootstrap(client);
        lobby = success(await call(client, "room:join", { bootstrapCredential: credential, nickname: `참가${i}`, roomCode: lobby.room.roomCode }));
        members.push({ client, credential, playerId: lobby.self.playerId });
    }
    const sync = async (client = host) => success(await call(client, "state:sync"));
    function selection(snapshot: PlatformSnapshotV2, gameType: GameType): Command {
        const game = snapshot.game;
        return request("room:selectGame", { gameType, gameId: game === null ? null : "gameId" in game ? game.gameId : game.publicState.gameId }, {
            expectedRoomRevision: snapshot.versions.roomRevision, expectedGameRevision: game?.gameRevision ?? null,
        });
    }
    async function readyAll() {
        for (const member of members) {
            const current = await sync(member.client);
            success(await call(member.client, "room:ready", { ready: true }, { expectedRoomRevision: current.versions.roomRevision }));
        }
        return sync();
    }
    return { server, host, members, lobby, connect, bootstrap, request, send, call, success, failure, sync, selection, readyAll };
}
function perch(snapshot: PlatformSnapshotV2) { if (snapshot.game?.gameType !== 'PERCH')
    throw new Error('Expected Perch'); return snapshot.game; }
type Harness = Awaited<ReturnType<typeof harness>>;
function action(h: Harness, s: PlatformSnapshotV2, payload: unknown) { const g = perch(s); if (g.phase === 'FINISHED')
    throw new Error('Finished'); return h.request('perch:act', payload, { gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId }); }
async function start(h: Harness) { const s = await h.sync(); return h.success(await h.call(h.host, 'game:start', {}, { expectedRoomRevision: s.versions.roomRevision })); }
async function begin(h: Harness) { let s = await start(h); s = h.success(await h.send(h.host, action(h, s, { type: 'CONFIGURE', randomBoard: false, objectives: false }))); return h.success(await h.send(h.host, action(h, s, { type: 'BEGIN' }))); }
test('PERCH Socket.IO: 2–5 players, strict projection, opaque private supply, capability check', async (t) => { for (const n of [2, 3, 4, 5]) {
    const h = await harness(t, n), s = await begin(h);
    assert.equal(perch(s).phase, 'PERCH');
    assert.equal(perch(s).playerStates.length, n);
    assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d => d.roomId === s.room.roomId), false);
    for (const m of h.members) {
        const view = perch(await h.sync(m.client));
        assert.equal(view.privateState.playerId, m.playerId);
        assert.equal('supply' in view, false);
        assert.equal('bag' in view, false);
        assert.equal(view.playerStates.find(p => p.playerId === m.playerId)!.hand.length, 4);
    }
    const unsupported = await h.connect(SUPPORTED_GAME_TYPES.filter(x => x !== 'PERCH'));
    assert.equal(h.failure(await h.call(unsupported, 'session:resume', { credential: { ...h.members[1]!.credential, roomCode: s.room.roomCode }, lastSeenVersions: null })), 'INCOMPATIBLE_GAME_CAPABILITY');
} });
test('PERCH Socket.IO: foreign actor, forged state, stale transition, concurrent mutation and replay', async (t) => { const h = await harness(t), s = await begin(h), g = perch(s), owner = h.members.find(m => m.playerId === g.activePlayerId)!, other = h.members.find(m => m !== owner)!, p = g.playerStates.find(p => p.playerId === owner.playerId)!, payload = { type: 'PLACE', birdId: p.hand[0]!.birdId, tileId: g.board[0]!.tileId, nest: null }, command = action(h, s, payload); assert.equal(h.failure(await h.send(other.client, command)), 'NOT_YOUR_TURN'); assert.equal(h.failure(await h.send(owner.client, { ...command, payload: { ...payload, score: 99 } })), 'INVALID_PAYLOAD'); assert.equal(h.failure(await h.send(owner.client, { ...command, turnId: 'wrong' })), 'STALE_GAME_REVISION'); const result = await Promise.all([h.send(owner.client, command), h.send(owner.client, { ...command, requestId: 'concurrent' })]); assert.equal(result.filter(x => v.parse(StateSyncWireAckSchema, x).ok).length, 1); const before = await h.server.runtime.persistence.findById(s.room.roomId); h.success(await h.send(owner.client, command)); assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId), before); assert.equal(h.failure(await h.send(owner.client, { ...command, payload: { type: 'END_TURN' } })), 'REQUEST_ID_REUSED'); });
test('PERCH Socket.IO: private objective selection, reconnect, explicit leave and rematch', async (t) => { const h = await harness(t, 3); let s = await start(h); assert.equal(h.failure(await h.send(h.members[1]!.client, action(h, s, { type: 'CONFIGURE', randomBoard: true, objectives: false }))), 'RULE_VIOLATION'); s = h.success(await h.send(h.host, action(h, s, { type: 'BEGIN' }))); const guest = h.members[1]!, view = await h.sync(guest.client), g = perch(view), objective = g.privateState.objectiveChoices[0]!; h.success(await h.send(guest.client, action(h, view, { type: 'OBJECTIVE', objective }))); const hostView = perch(await h.sync()); assert.equal(hostView.playerStates.find(p => p.playerId === guest.playerId)!.objectiveSelected, true); assert.equal(JSON.stringify(hostView).includes(`"${objective}"`), false); guest.client.disconnect(); const replacement = await h.connect(); const resumed = h.success(await h.call(replacement, 'session:resume', { credential: { ...guest.credential, roomCode: s.room.roomCode }, lastSeenVersions: null })); assert.equal(perch(resumed).privateState.objective, objective); assert.equal(resumed.self.playerId, guest.playerId); const old = action(h, resumed, { type: 'CONTINUE' }), leave = v.parse(RoomLeaveAckSchema, await h.call(replacement, 'room:leave', {}, { expectedRoomRevision: resumed.versions.roomRevision, expectedGameRevision: perch(resumed).gameRevision })); assert.ok(leave.ok); s = await h.sync(); const finished = perch(s); assert.equal(finished.phase, 'FINISHED'); if (finished.phase === 'FINISHED')
    assert.equal(finished.result.reason, 'CANCELLED'); h.success(await h.send(h.host, h.selection(s, 'PERCH'))); s = await start(h); assert.notEqual(perch(s).gameId, g.gameId); assert.equal(h.failure(await h.send(h.host, { ...old, requestId: 'old-game' })), 'STALE_GAME_REVISION'); });
test('PERCH Socket.IO: complete five-round game through public commands and return to another game', async (t) => { const h = await harness(t); let s = await begin(h), steps = 0; while (perch(s).phase !== 'FINISHED' && steps++ < 350) {
    const g = perch(s), actor = g.pending?.actor ?? g.activePlayerId, member = h.members.find(m => m.playerId === actor)!;
    s = await h.sync(member.client);
    const own = perch(s), p = own.playerStates.find(p => p.playerId === actor)!;
    const payload = own.pending ? { type: 'CHOOSE', choiceId: own.pending.choices[0]!.id } : own.phase === 'ROUND_END' ? { type: 'CONTINUE' } : own.placed ? { type: 'END_TURN' } : { type: 'PLACE', birdId: p.hand[0]!.birdId, tileId: own.board[0]!.tileId, nest: null };
    s = h.success(await h.send(member.client, action(h, s, payload)));
} const g = perch(s); assert.equal(g.phase, 'FINISHED'); if (g.phase === 'FINISHED') {
    assert.equal(g.result.reason, 'SCORED');
    assert.ok(g.result.winnerPlayerIds.length);
} const next = h.success(await h.send(h.host, h.selection(s, 'NUMBER_TILE'))); assert.equal(next.room.gameType, 'NUMBER_TILE'); assert.equal(next.room.phase, 'LOBBY'); });
