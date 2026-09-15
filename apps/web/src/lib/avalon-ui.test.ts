import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {parse,safeParse} from "valibot";
import {AvalonLobbyPlatformSnapshotV2Schema,AvalonPlayingPlatformSnapshotV2Schema,AvalonFinishedPlatformSnapshotV2Schema,GameRevisionSchema,AvalonClientCommandSchema,type AvalonStage} from "@hangul-rummikub/shared";
import {AvalonGameScreen} from "../features/avalon/AvalonGameScreen.js";
import {AvalonAudio,avalonTransitionCue,AVALON_SCORE} from "../features/avalon/sound.js";
import {decodeWebSnapshot,type AvalonWebSnapshot} from "./snapshot-wire-decoder.js";
import {resolveRoomSnapshotView} from "./room-snapshot-view.js";
const players=Array.from({length:5},(_,i)=>({playerId:`p${i}`,nickname:`기사${i+1}`,isHost:i===0,connectionStatus:"CONNECTED"}));
function lobby(){return parse(AvalonLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:"p0"},room:{roomId:"room",roomCode:"BCDFGH",gameType:"AVALON",phase:"LOBBY",players,settings:{roleSet:"INTRIGUE"}},game:null});}
function playing(stage:AvalonStage="REVEAL"){
 const l=lobby(),{settings,...room}=l.room;
 return parse(AvalonPlayingPlatformSnapshotV2Schema,{...l,room:{...room,phase:"PLAYING"},game:{gameType:"AVALON",gameId:"game",gameRevision:0,rulesVersion:"avalon-base-v1",settings,playerStates:players.map(p=>({playerId:p.playerId})),votes:[],quests:[],phase:"PLAYING",stage,phaseId:"phase1",stageStartedAt:1000,quest:1,leaderId:"p0",team:stage==="TEAM_VOTE"||stage==="QUEST_VOTE"?["p0","p1"]:[],rejected:0,submittedCount:0,privateView:{playerId:"p0",role:"MERLIN",knownEvilIds:["p1","p3"],merlinCandidates:[],ready:stage!=="REVEAL",teamVote:null,questVote:null}}});
}
function render(s:AvalonWebSnapshot,connected=true){return renderToStaticMarkup(createElement(AvalonGameScreen,{snapshot:s,connected,pending:false,error:null,connectionLabel:"접속 중",onCommand:async()=>{},onStart:()=>{},onLeave:()=>{},onCopy:()=>{},onRematch:()=>{}}));}
test("AVALON illustrated lobby, decoder route, setup and minimum players",()=>{
 for(const s of [lobby(),playing()]){const decoded=decodeWebSnapshot(s);assert.equal(decoded.kind,"COMPATIBLE");if(decoded.kind==="COMPATIBLE")assert.equal(resolveRoomSnapshotView(decoded.value).kind,"AVALON");}
 const html=render(lobby());for(const text of ["원탁의 맹세","퍼시벌","모르가나","원탁에 모인 사람들"])assert.ok(html.includes(text));
 assert.ok(html.includes("av-hero"));assert.ok(html.includes("av-roster-roles"));
});
test("AVALON private identities start covered; ordinary role and reconnect do not render revealed private information",()=>{
 const s=playing();for(const connected of [true,false]){const html=render(s,connected);assert.ok(html.includes("봉인된 역할 카드"));assert.ok(!html.includes('class="av-private-info"'));assert.ok(!html.includes('class="av-knowledge"'));}
 const changed={...s,game:{...s.game,privateView:{...s.game.privateView,role:"SERVANT",knownEvilIds:[]}}};const html=render(parse(AvalonPlayingPlatformSnapshotV2Schema,changed));assert.ok(html.includes("봉인된 역할 카드"));
});
test("AVALON actions obey phase, private ballot lock, membership and two-step confirmation",()=>{
 assert.ok(render(playing("TEAM_BUILD")).includes("원정대 제안 확정"));
 let s=playing("TEAM_VOTE");assert.ok(render(s).includes("찬성 또는 반대를 선택하세요"));
 s=parse(AvalonPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,privateView:{...s.game.privateView,teamVote:false},submittedCount:1}});assert.ok(render(s).includes("나의 반대표를 봉인했습니다"));assert.ok(!render(s).includes("찬성 또는 반대를 선택하세요"));
 const q=playing("QUEST_VOTE");assert.ok(render(q).includes("선 진영은 성공 카드만"));assert.ok(render(q).includes("실패 · 악만 선택"));
 const nonmember=parse(AvalonPlayingPlatformSnapshotV2Schema,{...q,self:{playerId:"p4"},game:{...q.game,privateView:{...q.game.privateView,playerId:"p4",role:"SERVANT",knownEvilIds:[]}}});assert.ok(render(nonmember).includes("원정대의 선택을 기다립니다"));
});
test("AVALON strict wire rejects hidden roles, foreign candidates, duplicate team and forbidden own failure",()=>{
 const s=playing();assert.equal(safeParse(AvalonPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,roles:players}}).success,false);
 assert.equal(safeParse(AvalonPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,privateView:{...s.game.privateView,knownEvilIds:["outsider"]}}}).success,false);
 assert.equal(safeParse(AvalonClientCommandSchema,{protocolVersion:1,requestId:"r",gameId:"game",phaseId:"phase",kind:"avalon:propose",payload:{playerIds:["p0","p0"]}}).success,false);
 const q=playing("QUEST_VOTE");assert.equal(safeParse(AvalonPlayingPlatformSnapshotV2Schema,{...q,game:{...q.game,privateView:{...q.game.privateView,questVote:"FAIL"}}}).success,false);
});
test("AVALON audio: no initial/replayed sound, role-neutral voting cues, cancellation silent, absent audio safe",()=>{
 const first=playing().game,next=playing("TEAM_VOTE").game;next.gameRevision=parse(GameRevisionSchema,1);next.phaseId=parse(AvalonPlayingPlatformSnapshotV2Schema,{...playing(),game:{...next,phaseId:"phase2"}}).game.phaseId;
 assert.equal(avalonTransitionCue(null,next,"p0"),null);assert.equal(avalonTransitionCue(first,next,"p0"),"VOTE");assert.equal(avalonTransitionCue(first,next,"p3"),"VOTE");assert.equal(avalonTransitionCue(next,next,"p0"),null);
 const noAudio=new AvalonAudio(()=>null);assert.doesNotThrow(()=>{noAudio.unlock();noAudio.play("CARD");noAudio.setVolume(0);noAudio.dispose();});
 const broken=new AvalonAudio(()=>{throw Error("unavailable");});assert.doesNotThrow(()=>broken.unlock());
 assert.ok(Object.values(AVALON_SCORE).every(score=>score.every(note=>note.duration<1&&note.at<1)));
 const {privateView:_,stage:__,phaseId:___,stageStartedAt:____,quest:_____,leaderId:______,team:_______,rejected:________,submittedCount:_________,...base}=first;
 const finished=parse(AvalonFinishedPlatformSnapshotV2Schema,{...lobby(),room:{...playing().room,phase:"FINISHED"},game:{...base,phase:"FINISHED",gameRevision:2,result:{reason:"CANCELLED",winningTeam:null,winnerPlayerIds:[],targetId:null,roles:[{playerId:"p0",role:"MERLIN"},{playerId:"p1",role:"ASSASSIN"},{playerId:"p2",role:"PERCIVAL"},{playerId:"p3",role:"MORGANA"},{playerId:"p4",role:"SERVANT"}]}}});
 assert.equal(avalonTransitionCue(first,finished.game,"p0"),null);assert.ok(render(finished).includes("이번 판에는 승자가 없습니다"));
});
