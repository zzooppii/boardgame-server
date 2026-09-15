import * as v from "valibot";
import { AvalonSettingsSchema, AvalonStageSchema, AvalonRoleSchema, AvalonVoteRecordSchema, AvalonQuestRecordSchema, AvalonResultSchema,
  AvalonIdsSchema, GameIdSchema, PlayerIdSchema, TurnIdSchema, ServerTimeSchema, GameRevisionSchema,
  avalonRoles, avalonIsEvil, avalonTeamSize, avalonFailThreshold,
  type AvalonSettings, type AvalonRole, type AvalonClientCommand, type AvalonResult, type GameId, type PlayerId, type TurnId } from "@hangul-rummikub/shared";
const bounded = (max: number) => v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(max));
const Player = v.strictObject({ playerId: PlayerIdSchema, role: AvalonRoleSchema, ready: v.boolean(), teamVote: v.nullable(v.boolean()), questVote: v.nullable(v.picklist(["SUCCESS", "FAIL"])) });
const State = v.strictObject({ rulesVersion: v.literal("avalon-base-v1"), gameId: GameIdSchema, revision: GameRevisionSchema,
  startedAt: ServerTimeSchema, finishedAt: v.nullable(ServerTimeSchema), phase: v.picklist(["PLAYING", "FINISHED"]), stage: AvalonStageSchema,
  transitionId: TurnIdSchema, stageStartedAt: ServerTimeSchema, settings: AvalonSettingsSchema,
  players: v.pipe(v.array(Player), v.minLength(5), v.maxLength(10)), leaderIndex: bounded(9), quest: v.pipe(bounded(5), v.minValue(1)),
  team: AvalonIdsSchema, rejected: bounded(5), votes: v.pipe(v.array(AvalonVoteRecordSchema), v.maxLength(25)), quests: v.pipe(v.array(AvalonQuestRecordSchema), v.maxLength(5)), result: v.nullable(AvalonResultSchema) });
export type AvalonState = v.InferOutput<typeof State>;

export function parseAvalonState(value: unknown): AvalonState {
  const s=v.parse(State,value), n=s.players.length, ids=s.players.map(p=>p.playerId), members=new Set(ids);
  const invalid=()=>{ throw new Error("Invalid Avalon state."); };
  if (members.size!==n || s.leaderIndex>=n || s.team.some(id=>!members.has(id)) || s.stageStartedAt<s.startedAt ||
    (s.phase==="FINISHED") !== (s.result!==null) || (s.phase==="FINISHED") !== (s.finishedAt!==null) || s.finishedAt!==null && s.finishedAt<s.stageStartedAt ||
    JSON.stringify(s.players.map(p=>p.role).sort())!==JSON.stringify(avalonRoles(n,s.settings).sort())) invalid();
  if (s.votes.some(r=>!members.has(r.leaderId) || r.team.some(id=>!members.has(id)) || r.team.length!==avalonTeamSize(n,r.quest) || r.ballots.length!==n || r.ballots.some((b,i)=>b.playerId!==ids[i]) || r.approved!==(r.ballots.filter(b=>b.agree).length>n/2))) invalid();
  if (s.quests.some((q,i)=>q.quest!==i+1 || q.team.some(id=>!members.has(id)) || q.team.length!==avalonTeamSize(n,q.quest) || q.failCount>s.players.filter(p=>q.team.includes(p.playerId)&&avalonIsEvil(p.role)).length || q.success!==(q.failCount<avalonFailThreshold(n,q.quest)))) invalid();
  if (s.players.some(p=>p.teamVote!==null && s.stage!=="TEAM_VOTE" || p.questVote!==null && (s.stage!=="QUEST_VOTE" || !s.team.includes(p.playerId)) || p.questVote==="FAIL" && !avalonIsEvil(p.role))) invalid();
  if (s.phase==="PLAYING") {
    if (s.rejected>4 || s.quests.filter(q=>!q.success).length>=3 || s.stage!=="REVEAL" && s.players.some(p=>!p.ready)) invalid();
    if (["TEAM_VOTE","VOTE_RESULT","QUEST_VOTE","QUEST_RESULT"].includes(s.stage) && s.team.length!==avalonTeamSize(n,s.quest)) invalid();
    if (["REVEAL","TEAM_BUILD","ASSASSINATION"].includes(s.stage) && s.team.length!==0) invalid();
    if (s.stage==="ASSASSINATION" ? s.quests.filter(q=>q.success).length!==3 : s.stage!=="QUEST_RESULT" && s.quests.filter(q=>q.success).length>=3) invalid();
    if (s.quests.length!==(s.stage==="QUEST_RESULT" || s.stage==="ASSASSINATION" ? s.quest : s.quest-1)) invalid();
    if (s.stage==="VOTE_RESULT" && (s.votes.at(-1)?.quest!==s.quest || JSON.stringify(s.votes.at(-1)?.team)!==JSON.stringify(s.team))) invalid();
  }
  if (s.result) {
    const r=s.result, winningTeam=r.reason==="CANCELLED" ? null : r.reason==="MERLIN_SURVIVED" ? "GOOD" : "EVIL";
    if (r.winningTeam!==winningTeam || JSON.stringify(r.roles)!==JSON.stringify(s.players.map(p=>({playerId:p.playerId,role:p.role}))) ||
      JSON.stringify(r.winnerPlayerIds)!==JSON.stringify(s.players.filter(p=>winningTeam!==null && avalonIsEvil(p.role)===(winningTeam==="EVIL")).map(p=>p.playerId))) invalid();
    if (r.reason==="THREE_FAILURES" && s.quests.filter(q=>!q.success).length!==3 || r.reason==="FIVE_REJECTIONS" && s.rejected!==5) invalid();
    if (r.reason==="MERLIN_FOUND" || r.reason==="MERLIN_SURVIVED") {
      const target=s.players.find(p=>p.playerId===r.targetId);
      if (!target || avalonIsEvil(target.role) || (target.role==="MERLIN")!==(r.reason==="MERLIN_FOUND") || s.quests.filter(q=>q.success).length!==3) invalid();
    } else if(r.targetId!==null) invalid();
  }
  return s;
}
export function createAvalonGame(input: { gameId: GameId; playerIds: readonly PlayerId[]; roles: readonly AvalonRole[]; leaderIndex: number; settings: AvalonSettings; now: number; transitionId: TurnId }): AvalonState {
  return parseAvalonState({ rulesVersion:"avalon-base-v1",gameId:input.gameId,revision:0,startedAt:input.now,finishedAt:null,phase:"PLAYING",stage:"REVEAL",transitionId:input.transitionId,stageStartedAt:input.now,settings:input.settings,
    players:input.playerIds.map((playerId,i)=>({playerId,role:input.roles[i],ready:false,teamVote:null,questVote:null})),leaderIndex:input.leaderIndex,quest:1,team:[],rejected:0,votes:[],quests:[],result:null });
}
function finish(s: AvalonState, reason: AvalonResult["reason"], now: number, targetId: PlayerId|null=null): void {
  const winningTeam=reason==="CANCELLED" ? null : reason==="MERLIN_SURVIVED" ? "GOOD" : "EVIL";
  s.phase="FINISHED";s.finishedAt=v.parse(ServerTimeSchema,now);
  s.players.forEach(p=>{p.teamVote=null;p.questVote=null;});
  s.result={reason,winningTeam,targetId,roles:s.players.map(p=>({playerId:p.playerId,role:p.role})),winnerPlayerIds:s.players.filter(p=>winningTeam!==null && avalonIsEvil(p.role)===(winningTeam==="EVIL")).map(p=>p.playerId)};
}
export function commandAvalon(previous: AvalonState, actor: PlayerId, command: AvalonClientCommand, now: number, transitionId: TurnId): AvalonState|null {
  if (command.kind==="avalon:configure" || previous.phase!=="PLAYING" || command.gameId!==previous.gameId || command.phaseId!==previous.transitionId || now<previous.stageStartedAt) return null;
  const s=parseAvalonState(previous), p=s.players.find(p=>p.playerId===actor);
  if(!p)return null;
  const stage=(next: AvalonState["stage"])=>{s.stage=next;s.transitionId=transitionId;s.stageStartedAt=v.parse(ServerTimeSchema,now);};
  switch(command.kind){
    case "avalon:ready":
      if(s.stage!=="REVEAL" || p.ready)return null;
      p.ready=true;if(s.players.every(p=>p.ready))stage("TEAM_BUILD");break;
    case "avalon:propose": {
      const team=command.payload.playerIds;
      if(s.stage!=="TEAM_BUILD" || s.players[s.leaderIndex]?.playerId!==actor || team.length!==avalonTeamSize(s.players.length,s.quest) || new Set(team).size!==team.length || team.some(id=>!s.players.some(p=>p.playerId===id)))return null;
      // Stable seat order; client selection order carries no game meaning.
      s.team=s.players.filter(p=>team.includes(p.playerId)).map(p=>p.playerId);stage("TEAM_VOTE");break;
    }
    case "avalon:vote":
      if(s.stage!=="TEAM_VOTE" || p.teamVote!==null)return null;
      p.teamVote=command.payload.agree;
      if(s.players.every(p=>p.teamVote!==null)){
        const ballots=s.players.map(p=>({playerId:p.playerId,agree:p.teamVote===true})), approved=ballots.filter(b=>b.agree).length>s.players.length/2;
        s.votes.push({quest:s.quest,leaderId:s.players[s.leaderIndex]!.playerId,team:[...s.team],ballots,approved});
        s.players.forEach(p=>{p.teamVote=null;});s.rejected=approved?0:s.rejected+1;
        if(s.rejected===5)finish(s,"FIVE_REJECTIONS",now);else stage("VOTE_RESULT");
      }break;
    case "avalon:quest":
      if(s.stage!=="QUEST_VOTE" || !s.team.includes(actor) || p.questVote!==null || command.payload.card==="FAIL" && !avalonIsEvil(p.role))return null;
      p.questVote=command.payload.card;
      if(s.players.filter(p=>s.team.includes(p.playerId)).every(p=>p.questVote!==null)){
        const failCount=s.players.filter(p=>p.questVote==="FAIL").length;
        s.quests.push({quest:s.quest,team:[...s.team],failCount,success:failCount<avalonFailThreshold(s.players.length,s.quest)});
        s.players.forEach(p=>{p.questVote=null;});
        if(s.quests.filter(q=>!q.success).length===3)finish(s,"THREE_FAILURES",now);else stage("QUEST_RESULT");
      }break;
    case "avalon:continue":
      if(now-s.stageStartedAt<3000)return null;
      if(s.stage==="VOTE_RESULT"){
        if(s.votes.at(-1)?.approved)stage("QUEST_VOTE");
        else{s.team=[];s.leaderIndex=(s.leaderIndex+1)%s.players.length;stage("TEAM_BUILD");}
      }else if(s.stage==="QUEST_RESULT"){
        s.team=[];
        if(s.quests.filter(q=>q.success).length===3)stage("ASSASSINATION");
        else{s.quest++;s.leaderIndex=(s.leaderIndex+1)%s.players.length;stage("TEAM_BUILD");}
      }else return null;break;
    case "avalon:assassinate": {
      const target=s.players.find(p=>p.playerId===command.payload.playerId);
      if(s.stage!=="ASSASSINATION" || p.role!=="ASSASSIN" || !target || avalonIsEvil(target.role))return null;
      finish(s,target.role==="MERLIN"?"MERLIN_FOUND":"MERLIN_SURVIVED",now,target.playerId);break;
    }
  }
  s.revision=v.parse(GameRevisionSchema,s.revision+1);return parseAvalonState(s);
}
export function cancelAvalon(previous: AvalonState, now: number): AvalonState {
  const s=parseAvalonState(previous);if(s.phase==="FINISHED")return s;
  finish(s,"CANCELLED",now);s.revision=v.parse(GameRevisionSchema,s.revision+1);return parseAvalonState(s);
}
