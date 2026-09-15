import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import * as v from "valibot";
import { SUPPORTED_GAME_TYPES, PlatformSnapshotV2Schema, SessionBootstrapAckSchema, StateSyncWireAckSchema, type GameType, type PlatformSnapshotV2, } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string, (value: unknown) => void>, Record<string, (value: unknown, ack: (value: unknown) => void) => void>>;
type Command = {
    kind: string;
    protocolVersion: number;
    requestId: string;
    payload: unknown;
    [key: string]: unknown;
};
async function harness(t: TestContext, count = 2, initialGame: GameType = "ARNAK") {
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
    let lobby = success(await call(host, "room:create", { bootstrapCredential: hostCredential, nickname: "방장", gameType: initialGame }));
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
function arnak(s:PlatformSnapshotV2){if(s.game?.gameType!=='ARNAK')throw new Error('Expected Arnak');return s.game;}
test('ARNAK sockets validate actor, retain private choices across reconnect, reject stale revisions and replay commands once',async t=>{
 const h=await harness(t,3);let s=await h.sync();s=h.success(await h.call(h.host,'game:start',{}, {expectedRoomRevision:s.versions.roomRevision}));let g=arnak(s);assert.equal(g.playerStates.length,3);assert.equal((await h.server.runtime.persistence.listActiveTurnDeadlines()).some(d=>d.roomId===s.room.roomId),false);
 const owner=h.members.find(m=>m.playerId===g.activePlayerId)!,other=h.members.find(m=>m!==owner)!;s=await h.sync(owner.client);g=arnak(s);assert.equal(g.phase,'PLAYING');if(g.phase!=='PLAYING')throw new Error('Playing');const offer=g.privateState.offers.find(o=>o.kind==='CARD')!;const command=h.request('arnak:act',{type:'TAKE',actionId:offer.id},{gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.turnId});
 assert.equal(h.failure(await h.send(other.client,command)),'NOT_YOUR_TURN');const after=h.success(await h.send(owner.client,command));assert.equal(arnak(after).gameRevision,g.gameRevision+1);const replay=h.success(await h.send(owner.client,command));assert.equal(arnak(replay).gameRevision,g.gameRevision+1);const stale={...command,requestId:'new-stale-request'};assert.equal(h.failure(await h.send(owner.client,stale)),'STALE_GAME_REVISION');
 const privateIds=arnak(after).privateState.hand.map(c=>c.tileId);const otherWire=JSON.stringify(await h.sync(other.client));for(const id of privateIds)assert.equal(otherWire.includes(id),false);
 owner.client.disconnect();const resumed=await h.connect();const restored=h.success(await h.call(resumed,'session:resume',{credential:{...owner.credential,roomCode:s.room.roomCode},lastSeenVersions:null}));assert.deepEqual(arnak(restored).privateState,arnak(after).privateState);
});
