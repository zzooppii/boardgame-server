import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import { parse } from "valibot";
import { AvalonLobbyPlatformSnapshotV2Schema, AvalonPlayingPlatformSnapshotV2Schema, AvalonFinishedPlatformSnapshotV2Schema, SessionBootstrapAckSchema,
  avalonTeamSize, avalonIsEvil, StateSyncWireAckSchema, RoomLeaveAckSchema, ServerTimeSchema } from "@hangul-rummikub/shared";
import { createHttpServer } from "./server.js";
type Client = Socket<Record<string,(value:unknown)=>void>,Record<string,(value:unknown,ack:(value:unknown)=>void)=>void>>;
async function harness(t:TestContext,count=5,start=true){
 const server=createHttpServer({serveWeb:false}),clients:Client[]=[];
 t.after(async()=>{clients.forEach(c=>c.disconnect());await server.shutdown();});
 await new Promise<void>(r=>server.httpServer.listen(0,"127.0.0.1",r));const address=server.httpServer.address();assert.ok(address&&typeof address!=="string");const port=address.port;
 let seq=0,now=server.runtime.clock.now();t.mock.method(server.runtime.clock,"now",()=>now);t.mock.method(server.runtime.avalonService!.deps.random,"nextInt",(n:number)=>n-1);
 async function connect(types=["AVALON", "WOLF_NIGHT"]){const c:Client=io(`http://127.0.0.1:${port}`,{transports:["websocket"],forceNew:true,reconnection:false,auth:{supportedSnapshotVersions:[2],supportedGameTypes:types,supportsRoomPreparation:true}});clients.push(c);await new Promise<void>((r,j)=>{c.once("connect",r);c.once("connect_error",j);});return c;}
 const request=(kind:string,payload:unknown={},extra:Record<string,unknown>={}):{kind:string;protocolVersion:number;requestId:string;payload:unknown;[key:string]:unknown}=>({kind,protocolVersion:1,requestId:`avalon-${++seq}`,payload,...extra});
 const send=(c:Client,command:ReturnType<typeof request>)=>new Promise<unknown>((r,j)=>{const timer=setTimeout(()=>j(new Error(`Missing ${command.kind} ACK`)),4000);c.emit(command.kind,command,result=>{clearTimeout(timer);r(result);});});
 const call=(c:Client,kind:string,payload:unknown={},extra:Record<string,unknown>={})=>send(c,request(kind,payload,extra));
 const success=(value:unknown)=>{const ack=parse(StateSyncWireAckSchema,value);assert.ok(ack.ok,ack.ok?"":ack.error.code);return ack.data.snapshot;};
 const failure=(value:unknown)=>{const ack=parse(StateSyncWireAckSchema,value);assert.equal(ack.ok,false);if(ack.ok)throw new Error();return ack.error.code;};
 async function bootstrap(c:Client){const ack=parse(SessionBootstrapAckSchema,await call(c,"session:bootstrap"));assert.ok(ack.ok);return ack.data.credential;}
 const host=await connect(),credential=await bootstrap(host);
 let lobby=parse(AvalonLobbyPlatformSnapshotV2Schema,success(await call(host,"room:create",{bootstrapCredential:credential,nickname:"달빛1",gameType:"AVALON"})));
 const members=[{client:host,playerId:lobby.self.playerId,credential}];
 for(let i=1;i<count;i++){const c=await connect(),credential=await bootstrap(c);lobby=parse(AvalonLobbyPlatformSnapshotV2Schema,success(await call(c,"room:join",{bootstrapCredential:credential,nickname:`달빛${i+1}`,roomCode:lobby.room.roomCode})));members.push({client:c,playerId:lobby.self.playerId,credential});}
 lobby=parse(AvalonLobbyPlatformSnapshotV2Schema,success(await call(host,"avalon:configure",{roleSet:"INTRIGUE"},{expectedRoomRevision:lobby.versions.roomRevision})));
 if(start)success(await call(host,"game:start",{},{expectedRoomRevision:lobby.versions.roomRevision}));
 async function stored(){const room=await server.runtime.persistence.findById(lobby.room.roomId);assert.ok(room?.gameType==="AVALON"&&room.game);return room;}
 const sync=async(c=host)=>success(await call(c,"state:sync"));
 function time(at:number){now=parse(ServerTimeSchema,at);}
 async function proceed(){const room=await stored(),s=room.game!.state;time(s.stageStartedAt+3000);return success(await call(host,"avalon:continue",{},{gameId:s.gameId,phaseId:s.transitionId}));}
 async function ready(){const s=(await stored()).game!.state;const scope={gameId:s.gameId,phaseId:s.transitionId};(await Promise.all(members.map(m=>call(m.client,"avalon:ready",{},scope)))).forEach(success);}

 return{server,connect,bootstrap,request,send,call,success,failure,lobby,members,stored,sync,time,proceed,ready};
}
for(const count of [5,7,10]) test(`AVALON ${count} independent clients: secret role → simultaneous votes → quests → assassination → rematch`,async t=>{
 const h=await harness(t,count);await h.ready();
 for(let q=1;q<=3;q++){
  let s=(await h.stored()).game!.state;
  const leader=h.members.find(m=>m.playerId===s.players[s.leaderIndex]!.playerId)!,team=s.players.slice(0,avalonTeamSize(count,q)).map(p=>p.playerId);
  h.success(await h.call(leader.client,"avalon:propose",{playerIds:team},{gameId:s.gameId,phaseId:s.transitionId}));
  s=(await h.stored()).game!.state;const scope={gameId:s.gameId,phaseId:s.transitionId};
  (await Promise.all(h.members.map(m=>h.call(m.client,"avalon:vote",{agree:true},scope)))).forEach(h.success);
  s=(await h.stored()).game!.state;assert.equal(s.stage,"VOTE_RESULT");assert.equal(s.votes.at(-1)?.ballots.length,count);
  await h.proceed();s=(await h.stored()).game!.state;
  (await Promise.all(h.members.filter(m=>team.includes(m.playerId)).map(m=>h.call(m.client,"avalon:quest",{card:"SUCCESS"},{gameId:s.gameId,phaseId:s.transitionId})))).forEach(h.success);
  const result=parse(AvalonPlayingPlatformSnapshotV2Schema,await h.sync());assert.equal(result.game.stage,"QUEST_RESULT");assert.equal(result.game.quests.length,q);
  assert.ok(!JSON.stringify(result).includes('"roles":'));await h.proceed();
 }
 let s=(await h.stored()).game!.state;assert.equal(s.stage,"ASSASSINATION");assert.equal(s.phase,"PLAYING");
 const assassin=h.members.find(m=>m.playerId===s.players.find(p=>p.role==="ASSASSIN")!.playerId)!,target=s.players.find(p=>count===7?p.role==="MERLIN":!avalonIsEvil(p.role)&&p.role!=="MERLIN")!;
 const command=h.request("avalon:assassinate",{playerId:target.playerId},{gameId:s.gameId,phaseId:s.transitionId});
 const end=parse(AvalonFinishedPlatformSnapshotV2Schema,h.success(await h.send(assassin.client,command)));assert.equal(end.game.result.winningTeam,count===7?"EVIL":"GOOD");
 h.success(await h.send(assassin.client,command));assert.equal((await h.stored()).game!.gameRevision,end.game.gameRevision);assert.equal(h.server.runtime.turnScheduler.scheduledCount,0);
 const reset=h.request("room:selectGame",{gameType:"AVALON",gameId:s.gameId},{expectedRoomRevision:end.versions.roomRevision,expectedGameRevision:end.game.gameRevision});
 const lobby=parse(AvalonLobbyPlatformSnapshotV2Schema,h.success(await h.send(h.members[0]!.client,reset)));assert.equal(lobby.room.roomCode,h.lobby.room.roomCode);assert.deepEqual(lobby.room.settings,{roleSet:"INTRIGUE"});
 const next=parse(AvalonPlayingPlatformSnapshotV2Schema,h.success(await h.call(h.members[0]!.client,"game:start",{},{expectedRoomRevision:lobby.versions.roomRevision})));assert.notEqual(next.game.gameId,s.gameId);
 assert.equal(h.failure(await h.send(assassin.client,{...command,requestId:"old-game-new-request"})),"STALE_GAME_REVISION");
});
test("AVALON raw private projections, locked ballot receipts, conflicting request IDs and primary reconnect",async t=>{
 const h=await harness(t,7);let s=(await h.stored()).game!.state;
 for(const m of h.members){const wire=parse(AvalonPlayingPlatformSnapshotV2Schema,await h.sync(m.client)),role=s.players.find(p=>p.playerId===m.playerId)!.role;
 assert.equal(wire.game.privateView.role,role);assert.ok(!JSON.stringify(wire).includes('"roles":'));assert.ok(wire.game.playerStates.every(p=>Object.keys(p).length===1));
 assert.equal(wire.game.privateView.merlinCandidates.length,role==="PERCIVAL"?2:0);}
 await h.ready();s=(await h.stored()).game!.state;
 const leader=h.members.find(m=>m.playerId===s.players[s.leaderIndex]!.playerId)!;
 h.success(await h.call(leader.client,"avalon:propose",{playerIds:s.players.slice(0,2).map(p=>p.playerId)},{gameId:s.gameId,phaseId:s.transitionId}));
 s=(await h.stored()).game!.state;const voter=h.members[0]!,other=h.members[1]!;
 const vote=h.request("avalon:vote",{agree:false},{gameId:s.gameId,phaseId:s.transitionId});h.success(await h.send(voter.client,vote));const revision=(await h.stored()).game!.gameRevision;
 h.success(await h.send(voter.client,vote));assert.equal((await h.stored()).game!.gameRevision,revision);
 assert.equal(h.failure(await h.send(voter.client,{...vote,payload:{agree:true}})),"REQUEST_ID_REUSED");
 assert.equal(h.failure(await h.call(voter.client,"avalon:vote",{agree:true},{gameId:s.gameId,phaseId:s.transitionId})),"INVALID_PAYLOAD");
 const another=parse(AvalonPlayingPlatformSnapshotV2Schema,await h.sync(other.client));assert.equal(another.game.privateView.teamVote,null);assert.equal(another.game.votes.length,0);assert.equal(another.game.submittedCount,1);
 const replacement=await h.connect();const resumed=parse(AvalonPlayingPlatformSnapshotV2Schema,h.success(await h.call(replacement,"session:resume",{credential:{...voter.credential,roomCode:h.lobby.room.roomCode},lastSeenVersions:null})));
 assert.equal(resumed.self.playerId,voter.playerId);assert.equal(resumed.game.privateView.teamVote,false);assert.equal(resumed.game.privateView.role,s.players[0]!.role);
 h.success(await h.send(replacement,vote));
 const ack=parse(StateSyncWireAckSchema,await h.send(voter.client,{...vote,requestId:"superseded"}));assert.equal(ack.ok,false);assert.equal((await h.stored()).game!.gameRevision,revision);
});
test("AVALON admission, five-player start guard, host-only configuration, strict commands and explicit leave cancellation",async t=>{
 const h=await harness(t,4,false),host=h.members[0]!,other=h.members[1]!;
 assert.equal(h.failure(await h.call(host.client,"game:start",{},{expectedRoomRevision:h.lobby.versions.roomRevision})),"NOT_ENOUGH_PLAYERS");
 assert.equal(h.failure(await h.call(other.client,"avalon:configure",{roleSet:"BASIC"},{expectedRoomRevision:h.lobby.versions.roomRevision})),"HOST_ONLY");
 const incapable=await h.connect(["WOLF_NIGHT"]),old=await h.bootstrap(incapable);
 assert.equal(h.failure(await h.call(incapable,"room:join",{bootstrapCredential:old,nickname:"구버전",roomCode:h.lobby.room.roomCode})),"INCOMPATIBLE_GAME_CAPABILITY");
 const fifth=await h.connect(),cred=await h.bootstrap(fifth);const lobby=parse(AvalonLobbyPlatformSnapshotV2Schema,h.success(await h.call(fifth,"room:join",{bootstrapCredential:cred,nickname:"다섯째",roomCode:h.lobby.room.roomCode})));
 h.success(await h.call(host.client,"game:start",{},{expectedRoomRevision:lobby.versions.roomRevision}));let room=await h.stored(),s=room.game!.state;
 assert.equal(h.failure(await h.call(host.client,"avalon:ready",{role:"MERLIN"},{gameId:s.gameId,phaseId:s.transitionId})),"INVALID_PAYLOAD");
 assert.equal(room.game!.gameRevision,0);
 const late=await h.connect(),lateCred=await h.bootstrap(late);assert.equal(parse(StateSyncWireAckSchema,await h.call(late,"room:join",{bootstrapCredential:lateCred,nickname:"늦은손님",roomCode:lobby.room.roomCode})).ok,false);
 const left=parse(RoomLeaveAckSchema,await h.call(other.client,"room:leave",{},{expectedRoomRevision:room.roomRevision,expectedGameRevision:room.game!.gameRevision}));assert.ok(left.ok,left.ok?"":left.error.code);
 const end=parse(AvalonFinishedPlatformSnapshotV2Schema,await h.sync());assert.equal(end.game.result.reason,"CANCELLED");assert.deepEqual(end.game.result.winnerPlayerIds,[]);
});
test("AVALON ten-player room rejects eleventh; nonleader and foreign game commands are atomic",async t=>{
 const h=await harness(t,10,false),extra=await h.connect(),credential=await h.bootstrap(extra);
 assert.equal(h.failure(await h.call(extra,"room:join",{bootstrapCredential:credential,nickname:"열한째",roomCode:h.lobby.room.roomCode})),"ROOM_FULL");
 h.success(await h.call(h.members[0]!.client,"game:start",{},{expectedRoomRevision:h.lobby.versions.roomRevision}));await h.ready();const s=(await h.stored()).game!.state;
 const nonleader=h.members.find(m=>m.playerId!==s.players[s.leaderIndex]!.playerId)!;const before=(await h.stored()).game!.gameRevision;
 assert.equal(h.failure(await h.call(nonleader.client,"avalon:propose",{playerIds:s.players.slice(0,3).map(p=>p.playerId)},{gameId:s.gameId,phaseId:s.transitionId})),"INVALID_PAYLOAD");
 assert.equal(h.failure(await h.call(nonleader.client,"avalon:ready",{},{gameId:"wrong-game",phaseId:s.transitionId})),"STALE_GAME_REVISION");assert.equal((await h.stored()).game!.gameRevision,before);
});
