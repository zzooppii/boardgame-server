import assert from "node:assert/strict";
import test from "node:test";
import {parse,safeParse} from "valibot";
import {AvalonClientCommandSchema,AvalonPlayingProjectionSchema,GameIdSchema,PlayerIdSchema,TurnIdSchema,avalonRoles,avalonTeamSize,avalonIsEvil,type PlayerId,type AvalonSettings} from "@hangul-rummikub/shared";
import {createAvalonGame,commandAvalon,cancelAvalon,parseAvalonState,type AvalonState} from "./games/avalon/domain/game.js";
import {projectAvalon} from "./games/avalon/compatibility/projector.js";
let seq=0;const next=()=>parse(TurnIdSchema,`phase-${++seq}`);
function create(n=7,roleSet:AvalonSettings["roleSet"]="INTRIGUE") {return createAvalonGame({gameId:parse(GameIdSchema,"avalon-test"),playerIds:Array.from({length:n},(_,i)=>parse(PlayerIdSchema,`p${i}`)),roles:avalonRoles(n,{roleSet}),settings:{roleSet},leaderIndex:0,now:1000,transitionId:next()});}
function cmd(s:AvalonState,actor:PlayerId,kind:string,payload:unknown={},now=s.stageStartedAt+3000){return commandAvalon(s,actor,parse(AvalonClientCommandSchema,{kind:`avalon:${kind}`,protocolVersion:1,requestId:`r-${++seq}`,gameId:s.gameId,phaseId:s.transitionId,payload}),now,next());}
function apply(s:AvalonState,actor:PlayerId,kind:string,payload:unknown={}){const result=cmd(s,actor,kind,payload);assert.ok(result,`${s.stage} ${kind}`);return result;}
function ready(n=7,roleSet:AvalonSettings["roleSet"]="INTRIGUE"){let s=create(n,roleSet);for(const p of s.players)s=apply(s,p.playerId,"ready");return s;}
function propose(s:AvalonState,team=s.players.slice(0,avalonTeamSize(s.players.length,s.quest)).map(p=>p.playerId)){return apply(s,s.players[s.leaderIndex]!.playerId,"propose",{playerIds:team});}
function vote(s:AvalonState,agrees=s.players.length){for(const [i,p] of s.players.entries())s=apply(s,p.playerId,"vote",{agree:i<agrees});return s;}
function quest(s:AvalonState,failures=0){s=apply(vote(propose(s)),s.players[0]!.playerId,"continue");for(const id of s.team){const p=s.players.find(p=>p.playerId===id)!;const fail=failures>0&&avalonIsEvil(p.role);if(fail)failures--;s=apply(s,id,"quest",{card:fail?"FAIL":"SUCCESS"});}return s;}
function project(s:AvalonState,viewer=s.players[0]!.playerId){return projectAvalon({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:s.finishedAt,state:s},viewer);}
for(const n of [5,6,7,8,9,10])for(const mode of ["BASIC","INTRIGUE"] as const)test(`AVALON ${n} ${mode}: role counts, all stages, three successes and both assassination outcomes`,()=>{
 let s=ready(n,mode);assert.equal(s.players.filter(p=>avalonIsEvil(p.role)).length,n===10?4:n>=7?3:2);
 for(let q=1;q<=3;q++){s=quest(s);assert.equal(s.phase,"PLAYING");assert.equal(s.stage,"QUEST_RESULT");s=apply(s,s.players[0]!.playerId,"continue");}
 assert.equal(s.stage,"ASSASSINATION");assert.equal(s.result,null);
 const assassin=s.players.find(p=>p.role==="ASSASSIN")!,merlin=s.players.find(p=>p.role==="MERLIN")!,other=s.players.find(p=>!avalonIsEvil(p.role)&&p.role!=="MERLIN")!;
 assert.equal(cmd(s,other.playerId,"assassinate",{playerId:merlin.playerId}),null);
 assert.equal(cmd(s,assassin.playerId,"assassinate",{playerId:assassin.playerId}),null);
 for(const target of [merlin,other]){const end=apply(s,assassin.playerId,"assassinate",{playerId:target.playerId});assert.equal(end.result?.winningTeam,target===merlin?"EVIL":"GOOD");assert.equal(project(end).phase,"FINISHED");}
});
test("AVALON known identities whitelist: Merlin, evil, Percival candidates, ordinary servant; projection detached",()=>{
 const s=create();for(const p of s.players){const view=project(s,p.playerId);assert.equal(view.phase,"PLAYING");if(view.phase!=="PLAYING")throw Error();
 assert.deepEqual(view.privateView.merlinCandidates,p.role==="PERCIVAL"?s.players.filter(p=>p.role==="MERLIN"||p.role==="MORGANA").map(p=>p.playerId):[]);
 assert.deepEqual(view.privateView.knownEvilIds,p.role==="MERLIN"||avalonIsEvil(p.role)?s.players.filter(x=>x.playerId!==p.playerId&&avalonIsEvil(x.role)).map(p=>p.playerId):[]);
 assert.equal(view.playerStates.some(x=>"role" in x),false);assert.equal(safeParse(AvalonPlayingProjectionSchema,{...view,allRoles:s.players}).success,false);
 view.playerStates[0]!.playerId=parse(PlayerIdSchema,"changed");assert.equal(s.players[0]!.playerId,"p0");}
 assert.throws(()=>project(s,parse(PlayerIdSchema,"outside")));
});
test("AVALON simultaneous ballot scope, immutable votes, invalid proposals and good failure leave input unchanged",()=>{
 const s=ready(6),before=structuredClone(s);assert.equal(cmd(s,s.players[1]!.playerId,"propose",{playerIds:s.players.slice(0,2).map(p=>p.playerId)}),null);
 assert.equal(cmd(s,s.players[0]!.playerId,"propose",{playerIds:["p0","missing"]}),null);assert.deepEqual(s,before);
 let t=propose(s);const phase=t.transitionId;t=apply(t,t.players[0]!.playerId,"vote",{agree:true});assert.equal(t.transitionId,phase);
 assert.equal(cmd(t,t.players[0]!.playerId,"vote",{agree:false}),null);
 const stranger=project(t,t.players[1]!.playerId);assert.equal(stranger.phase,"PLAYING");if(stranger.phase==="PLAYING"){assert.equal(stranger.privateView.teamVote,null);assert.equal(stranger.submittedCount,1);assert.equal(stranger.votes.length,0);}
 for(const [i,p] of t.players.entries())if(i>0)t=apply(t,p.playerId,"vote",{agree:i<3});assert.equal(t.votes[0]?.approved,false);assert.equal(t.rejected,1);
 assert.equal(cmd(t,t.players[0]!.playerId,"continue",{},t.stageStartedAt+2999),null);
 t=apply(t,t.players[0]!.playerId,"continue");assert.equal(t.leaderIndex,1);
 t=apply(vote(propose(t)),t.players[0]!.playerId,"continue");const good=t.players.find(p=>t.team.includes(p.playerId)&&!avalonIsEvil(p.role))!;
 assert.equal(cmd(t,good.playerId,"quest",{card:"FAIL"}),null);assert.equal(cmd(t,t.players.at(-1)!.playerId,"quest",{card:"SUCCESS"}),null);
});
test("AVALON fifth consecutive rejection ends game; an approved team resets rejection count",()=>{
 let s=ready(5);for(let i=0;i<5;i++){s=vote(propose(s),0);if(i<4)s=apply(s,s.players[0]!.playerId,"continue");}
 assert.equal(s.result?.reason,"FIVE_REJECTIONS");assert.equal(project(s).phase,"FINISHED");
 s=ready();s=apply(vote(propose(s),0),s.players[0]!.playerId,"continue");s=vote(propose(s));assert.equal(s.rejected,0);
});
test("AVALON fourth quest at 7–10 players needs two failures; no individual quest ledger survives aggregation",()=>{
 for(const n of [7,8,9,10])for(const fails of [1,2]){let s=ready(n);for(const count of [0,1,0]){s=quest(s,count);s=apply(s,s.players[0]!.playerId,"continue");}
 const evil=s.players.filter(p=>avalonIsEvil(p.role)).slice(0,2).map(p=>p.playerId),good=s.players.filter(p=>!avalonIsEvil(p.role)).map(p=>p.playerId);
 s=apply(vote(propose(s,[...evil,...good.slice(0,avalonTeamSize(n,4)-2)])),s.players[0]!.playerId,"continue");
 for(const [i,id] of s.team.entries()) {const fail=evil.slice(0,fails).includes(id);s=apply(s,id,"quest",{card:fail?"FAIL":"SUCCESS"});if(i<s.team.length-1){const view=project(s,good.at(-1)!);assert.equal(view.quests.length,3);}}
 assert.equal(s.quests.at(-1)?.success,fails===1);assert.ok(s.players.every(p=>p.questVote===null));assert.equal(project(s).quests.at(-1)?.failCount,fails);}
});
test("AVALON three failed quests end immediately; cancel, stale phase, finished mutation, corrupted persistence",()=>{
 let s=ready();for(let q=0;q<3;q++){s=quest(s,1);if(q<2)s=apply(s,s.players[0]!.playerId,"continue");}
 assert.equal(s.result?.reason,"THREE_FAILURES");assert.equal(cmd(s,s.players[0]!.playerId,"continue"),null);
 const original=ready(),cancelled=cancelAvalon(original,100000);assert.equal(cancelled.result?.reason,"CANCELLED");assert.deepEqual(cancelled.result?.winnerPlayerIds,[]);assert.equal(original.phase,"PLAYING");
 assert.throws(()=>parseAvalonState({...original,players:original.players.map(p=>({...p,role:"MERLIN"}))}));assert.throws(()=>parseAvalonState({...original,leaderIndex:9}));assert.throws(()=>parseAvalonState({...original,unknown:"secret"}));
 const voteState=propose(original);const c=parse(AvalonClientCommandSchema,{kind:"avalon:vote",protocolVersion:1,requestId:"stale",gameId:original.gameId,phaseId:original.transitionId,payload:{agree:true}});assert.equal(commandAvalon(voteState,voteState.players[0]!.playerId,c,10000,next()),null);
});
