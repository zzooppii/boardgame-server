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
    let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: count > 4 ? "WOLF_NIGHT" : "SPIRIT_ISLAND" }));
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
function spirit(snapshot: PlatformSnapshotV2) {
    if (snapshot.game?.gameType !== 'SPIRIT_ISLAND')
        throw new Error('Expected Spirit game.');
    return snapshot.game;
}
type Harness = Awaited<ReturnType<typeof harness>>;
async function start(h: Harness) { const s = await h.sync(); return h.success(await h.call(h.host, 'game:start', {}, { expectedRoomRevision: s.versions.roomRevision })); }
function action(h: Harness, s: PlatformSnapshotV2, payload: unknown) { const g = spirit(s); if (g.phase !== 'PLAYING')
    throw new Error('Expected playing Spirit.'); return h.request('spirit:act', payload, { gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId }); }
test('SPIRIT_ISLAND socket: 1–4 seats, initialization and no deadlines', async (t) => {
    for (const count of [1, 2, 3, 4]) {
        const h = await harness(t, count), s = await start(h);
        assert.equal(s.room.phase, 'PLAYING');
        assert.equal(spirit(s).playerStates.length, count);
        assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d => d.roomId === s.room.roomId), false);
    }
    const h = await harness(t, 5), s = h.success(await h.send(h.host, h.selection(await h.sync(), 'SPIRIT_ISLAND')));
    assert.equal(h.failure(await h.call(h.host, 'game:start', {}, { expectedRoomRevision: s.versions.roomRevision })), 'NOT_ENOUGH_PLAYERS');
});
test('SPIRIT_ISLAND socket: duplicate, stale and reused requests; illegal actions stay atomic', async (t) => {
    const h = await harness(t, 1), s = await start(h), g = spirit(s), c = action(h, s, { kind: 'SELECT_SPIRIT', spirit: 'RIVER' });
    const results = await Promise.all([h.send(h.host, c), h.send(h.host, c)]);
    for (const raw of results)
        assert.equal(spirit(h.success(raw)).gameRevision, g.gameRevision + 1);
    assert.equal(h.failure(await h.send(h.host, { ...c, payload: { kind: 'SELECT_SPIRIT', spirit: 'EARTH' } })), 'REQUEST_ID_REUSED');
    assert.equal(h.failure(await h.send(h.host, action(h, s, { kind: 'GROW', option: 1 }))), 'STALE_GAME_REVISION');
    const own = await h.sync(), before = await h.server.runtime.persistence.findById(s.room.roomId);
    assert.equal(h.failure(await h.send(h.host, action(h, own, { kind: 'PLAY_CARDS', cardIds: ['unknown'] }))), 'RULE_VIOLATION');
    assert.deepEqual(await h.server.runtime.persistence.findById(s.room.roomId), before);
    const choice = h.success(await h.send(h.host, action(h, own, { kind: 'GROW', option: 1 })));
    assert.ok(spirit(choice).pending);
});
test('SPIRIT_ISLAND socket: reconnect resumes pending growth; leave cancels and restart works', async (t) => {
    const h = await harness(t, 1);
    let s = await start(h);
    s = h.success(await h.send(h.host, action(h, s, { kind: 'SELECT_SPIRIT', spirit: 'RIVER' })));
    s = h.success(await h.send(h.host, action(h, s, { kind: 'GROW', option: 1 })));
    const before = spirit(s), member = h.members[0]!;
    member.client.disconnect();
    const replacement = await h.connect();
    const resumed = h.success(await h.call(replacement, 'session:resume', { credential: { ...member.credential, roomCode: s.room.roomCode }, lastSeenVersions: null }));
    assert.equal(resumed.self.playerId, member.playerId);
    assert.deepEqual(spirit(resumed), before);
    const q = spirit(resumed).pending!;
    const next = h.success(await h.send(replacement, action(h, resumed, { kind: 'CHOOSE', choiceId: q.choiceId, optionId: q.options[0]!.id })));
    assert.equal(spirit(next).gameRevision, before.gameRevision + 1);
});
test('SPIRIT_ISLAND socket: explicit leave cancels, retained host starts fresh in same room', async (t) => {
    const h = await harness(t, 2), s = await start(h), member = h.members[1]!;
    const left = v.parse(RoomLeaveAckSchema, await h.call(member.client, 'room:leave', {}, { expectedRoomRevision: s.versions.roomRevision, expectedGameRevision: spirit(s).gameRevision }));
    assert.ok(left.ok);
    const ended = await h.sync(), g = spirit(ended);
    assert.equal(g.phase, 'FINISHED');
    if (g.phase === 'FINISHED')
        assert.equal(g.result.reason, 'CANCELLED');
    const reset = h.success(await h.send(h.host, h.selection(ended, 'SPIRIT_ISLAND')));
    assert.equal(reset.room.roomCode, s.room.roomCode);
    assert.equal(reset.room.players.length, 1);
    assert.equal((await start(h)).room.phase, 'PLAYING');
});
