import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { spiritDefinition, SPIRIT_POWERS, SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, RoomLeaveAckSchema, type GameType, type PlatformSnapshotV2, } from "@hangul-rummikub/shared";
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

// Real independent Socket.IO clients; every state transition uses authenticated commands.
for (const scenario of ['NONE', 'WARD', 'FLAME', 'FORGOTTEN', 'SECOND_WAVE'] as const)
test(`SPIRIT_ISLAND multiplayer play: ${scenario}, powers, pending ownership and reconnect`, async t => {
    const h = await harness(t, scenario === 'FORGOTTEN' ? 4 : 2);
    let s = await start(h), reconnected = false, powers = 0, commands = 0;
    const roster = scenario === 'NONE' ? ['OCEAN', 'BRINGER'] as const : ['FANGS', 'KEEPER', 'THUNDER', 'GREEN'] as const;
    const act = async (index: number, payload: unknown) => {
        const member = h.members[index]!;
        const own = await h.sync(member.client);
        s = h.success(await h.send(member.client, action(h, own, payload)));
        assert.ok(++commands < 1800, `Game stuck: ${scenario} ${spirit(s).stage}`);
    };
    await act(0, { kind: 'CONFIGURE', settings: { expansion: scenario === 'NONE' ? 'CORE' : 'BRANCH_CLAW', progression: false, blightCard: true, adversary: scenario === 'NONE' ? 'NONE' : 'FRANCE', level: scenario === 'NONE' ? 0 : 3, scenario } });
    while (spirit(s).phase === 'PLAYING') {
        const g = spirit(s);
        if (g.pending) {
            const index = h.members.findIndex(m => m.playerId === g.pending!.playerId);
            const q = spirit(await h.sync(h.members[index]!.client)).pending!;
            assert.ok(index >= 0);const member = h.members[index]!;
            if (!reconnected) {
                const outsider = h.members[(index + 1) % h.members.length]!;
                const before = spirit(await h.sync(member.client));
                h.failure(await h.send(outsider.client, action(h, await h.sync(outsider.client), { kind: 'CHOOSE', choiceId: q.choiceId, optionId: q.options[0]!.id })));
                assert.deepEqual(spirit(await h.sync(member.client)), before);
                member.client.disconnect();member.client = await h.connect();
                const resumed = h.success(await h.call(member.client, 'session:resume', { credential: { ...member.credential, roomCode: s.room.roomCode }, lastSeenVersions: null }));
                assert.equal(resumed.self.playerId, member.playerId);assert.deepEqual(spirit(resumed), before);
                reconnected = true;
            }
            const option = q.options.find(o => /승리로 게임 마치기|지불하지 않음|이 선택 마치기|효과 없이 버리기/.test(o.label)) ?? q.options[0];
            assert.ok(option, `Empty choice: ${q.title}`);
            await act(index, { kind: 'CHOOSE', choiceId: q.choiceId, optionId: option.id });continue;
        }
        if (g.stage === 'SELECT') {
            const index = g.playerStates.findIndex(p => !p.spirit);
            assert.ok(index >= 0);await act(index, { kind: 'SELECT_SPIRIT', spirit: roster[index] });continue;
        }
        if (g.stage === 'PREPARE') {
            const index = g.playerStates.findIndex(p => !p.ready), p = g.playerStates[index];assert.ok(p);
            if (!p.grown) {assert.ok(p.spirit);const option=spiritDefinition(p.spirit).growth.findIndex((o,i)=>!p.growthSelections.includes(i)&&(o.cost??0)<=p.energy);assert.ok(option>=0);await act(index, { kind: 'GROW', option });continue; }
            if (!p.played.length) {
                const card = p.hand.find(c => {const meta = SPIRIT_POWERS.find(m => m.key === c.key);return meta && meta.cost <= p.energy;});
                if (card) {await act(index, { kind: 'PLAY_CARDS', cardIds: [card.cardId] });}
            }
            await act(index, { kind: 'READY', ready: true });continue;
        }
        if (g.stage === 'FAST' || g.stage === 'SLOW') {
            const index = g.playerStates.findIndex(p => !p.ready);assert.ok(index >= 0);
            const own = spirit(await h.sync(h.members[index]!.client));
            const option = own.privateState.powerOptions.find(o => o.targets.length && !o.repeat);
            if (option) {
                await act(index, { kind: 'USE_POWER', cardId: option.cardId, target: option.targets[0], threshold: option.thresholdMax, fast: g.stage === 'FAST', repeat: false, shadowReach: false });powers++;continue;
            }
            await act(index, { kind: 'READY', ready: true });continue;
        }
        await act(0, { kind: 'ADVANCE' });
        // All clients must receive the same public board; personal options belong to self.
        for (const member of h.members) {
            const own = spirit(await h.sync(member.client));
            assert.equal(own.gameRevision, spirit(s).gameRevision);assert.deepEqual(own.lands, spirit(s).lands);
            assert.equal(own.privateState.playerId, member.playerId);
            assert.ok(own.relics.every(r => r.side !== 'HIDDEN' || r.number === null));
        }
    }
    assert.ok(reconnected);assert.ok(powers > 0);const ended=spirit(s);assert.equal(ended.phase,'FINISHED');if(ended.phase==='FINISHED')assert.notEqual(ended.result.reason,'CANCELLED');
    t.diagnostic(`${scenario}: ${commands} accepted commands, ${powers} powers, ${spirit(s).round} rounds`);
});
