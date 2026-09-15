import { AvalonPlayingProjectionSchema, AvalonFinishedProjectionSchema, avalonIsEvil, type PlayerId } from "@hangul-rummikub/shared";
import { parse } from "valibot";
import type { AvalonStoredGame } from "./adapter.js";
export function projectAvalon(game: AvalonStoredGame, self: PlayerId) {
  const s=game.state,p=s.players.find(p=>p.playerId===self);
  if(!p)throw new Error("Avalon viewer must be a participant.");
  const base={gameType:"AVALON",gameId:game.gameId,gameRevision:game.gameRevision,rulesVersion:s.rulesVersion,settings:s.settings,
    playerStates:s.players.map(p=>({playerId:p.playerId})),votes:s.votes,quests:s.quests};
  if(s.phase==="FINISHED")return parse(AvalonFinishedProjectionSchema,{...base,phase:"FINISHED",result:s.result});
  const knownEvilIds=p.role==="MERLIN" || avalonIsEvil(p.role) ? s.players.filter(other=>other.playerId!==self && avalonIsEvil(other.role)).map(p=>p.playerId) : [];
  const merlinCandidates=p.role==="PERCIVAL" ? s.players.filter(p=>p.role==="MERLIN" || p.role==="MORGANA").map(p=>p.playerId) : [];
  return parse(AvalonPlayingProjectionSchema,{...base,phase:"PLAYING",stage:s.stage,phaseId:s.transitionId,stageStartedAt:s.stageStartedAt,
    quest:s.quest,leaderId:s.players[s.leaderIndex]!.playerId,team:s.team,rejected:s.rejected,
    submittedCount:s.players.filter(p=>s.stage==="REVEAL"?p.ready:s.stage==="TEAM_VOTE"?p.teamVote!==null:s.stage==="QUEST_VOTE"?p.questVote!==null:false).length,
    privateView:{playerId:self,role:p.role,knownEvilIds,merlinCandidates,ready:p.ready,teamVote:p.teamVote,questVote:p.questVote}});
}
