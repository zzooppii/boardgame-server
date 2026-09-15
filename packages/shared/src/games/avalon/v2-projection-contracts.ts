import * as v from "valibot";
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from "../../identifiers.js";
import { GameRevisionSchema, ServerTimeSchema } from "../../protocol.js";
import { AvalonRoleSchema, AvalonSettingsSchema, AvalonStageSchema, avalonIsEvil, avalonRoles, avalonTeamSize, avalonFailThreshold } from "./contracts.js";
const number = (max: number) => v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(max));
export const AvalonIdsSchema = v.pipe(v.array(PlayerIdSchema), v.maxLength(10), v.check(ids => new Set(ids).size === ids.length));
export const AvalonBallotSchema = v.strictObject({ playerId: PlayerIdSchema, agree: v.boolean() });
export const AvalonVoteRecordSchema = v.strictObject({ quest: v.pipe(number(5), v.minValue(1)), leaderId: PlayerIdSchema, team: AvalonIdsSchema, ballots: v.pipe(v.array(AvalonBallotSchema), v.minLength(5), v.maxLength(10)), approved: v.boolean() });
export const AvalonQuestRecordSchema = v.strictObject({ quest: v.pipe(number(5), v.minValue(1)), team: AvalonIdsSchema, failCount: number(5), success: v.boolean() });
export const AvalonResultSchema = v.strictObject({ reason: v.picklist(["THREE_FAILURES", "FIVE_REJECTIONS", "MERLIN_FOUND", "MERLIN_SURVIVED", "CANCELLED"]), winningTeam: v.nullable(v.picklist(["GOOD", "EVIL"])), winnerPlayerIds: AvalonIdsSchema, targetId: v.nullable(PlayerIdSchema), roles: v.pipe(v.array(v.strictObject({ playerId: PlayerIdSchema, role: AvalonRoleSchema })), v.minLength(5), v.maxLength(10)) });
export type AvalonResult = v.InferOutput<typeof AvalonResultSchema>;
const Base = { gameType: v.literal("AVALON"), gameId: GameIdSchema, gameRevision: GameRevisionSchema, rulesVersion: v.literal("avalon-base-v1"), settings: AvalonSettingsSchema,
  playerStates: v.pipe(v.array(v.strictObject({ playerId: PlayerIdSchema })), v.minLength(5), v.maxLength(10)),
  votes: v.pipe(v.array(AvalonVoteRecordSchema), v.maxLength(25)), quests: v.pipe(v.array(AvalonQuestRecordSchema), v.maxLength(5)) };
const Playing = v.strictObject({ ...Base, phase: v.literal("PLAYING"), stage: AvalonStageSchema, phaseId: TurnIdSchema, stageStartedAt: ServerTimeSchema,
  quest: v.pipe(number(5), v.minValue(1)), leaderId: PlayerIdSchema, team: AvalonIdsSchema, rejected: number(4), submittedCount: number(10),
  privateView: v.strictObject({ playerId: PlayerIdSchema, role: AvalonRoleSchema, knownEvilIds: AvalonIdsSchema, merlinCandidates: AvalonIdsSchema,
    ready: v.boolean(), teamVote: v.nullable(v.boolean()), questVote: v.nullable(v.picklist(["SUCCESS", "FAIL"])) }) });
const Finished = v.strictObject({ ...Base, phase: v.literal("FINISHED"), result: AvalonResultSchema });
export type AvalonPlayingProjection = v.InferOutput<typeof Playing>;
export type AvalonFinishedProjection = v.InferOutput<typeof Finished>;
export type AvalonProjection = AvalonPlayingProjection | AvalonFinishedProjection;
export function avalonProjectionConsistent(s: AvalonProjection): boolean {
  const ids = s.playerStates.map(p => p.playerId), members = new Set<string>(ids), n = ids.length;
  const belongs = (xs: readonly string[]) => xs.every(id => members.has(id));
  if (members.size !== n) return false;
  if (s.votes.some(r => !members.has(r.leaderId) || !belongs(r.team) || r.team.length !== avalonTeamSize(n, r.quest) || r.ballots.length !== n || r.ballots.some((b,i) => b.playerId !== ids[i]) || r.approved !== (r.ballots.filter(b => b.agree).length > n / 2))) return false;
  if (s.quests.some((r,i) => r.quest !== i+1 || !belongs(r.team) || r.team.length !== avalonTeamSize(n,r.quest) || r.failCount > r.team.length || r.success !== (r.failCount < avalonFailThreshold(n,r.quest)))) return false;
  if (s.phase === "FINISHED") {
    const r=s.result;
    if (r.roles.some((p,i) => p.playerId !== ids[i]) || r.roles.length !== n || JSON.stringify(r.roles.map(p=>p.role).sort()) !== JSON.stringify(avalonRoles(n,s.settings).sort())) return false;
    const expectedTeam = r.reason === "CANCELLED" ? null : r.reason === "MERLIN_SURVIVED" ? "GOOD" : "EVIL";
    const winners=r.roles.filter(p=>expectedTeam !== null && avalonIsEvil(p.role) === (expectedTeam === "EVIL")).map(p=>p.playerId);
    const assassination = r.reason === "MERLIN_FOUND" || r.reason === "MERLIN_SURVIVED";
    const target=r.roles.find(p=>p.playerId===r.targetId);
    return r.winningTeam===expectedTeam && JSON.stringify(winners)===JSON.stringify(r.winnerPlayerIds) &&
      (assassination ? target !== undefined && !avalonIsEvil(target.role) && (target.role === "MERLIN") === (r.reason === "MERLIN_FOUND") && s.quests.filter(q=>q.success).length===3 : r.targetId===null) &&
      (r.reason!=="THREE_FAILURES" || s.quests.filter(q=>!q.success).length===3) &&
      (r.reason!=="FIVE_REJECTIONS" || s.votes.slice(-5).length===5 && s.votes.slice(-5).every(vote=>!vote.approved && vote.quest===s.votes.at(-1)?.quest));
  }
  const p=s.privateView;
  const evilCount=avalonRoles(n,s.settings).filter(avalonIsEvil).length;
  if (s.settings.roleSet === "BASIC" && (p.role === "PERCIVAL" || p.role === "MORGANA")) return false;
  if (p.knownEvilIds.length !== (p.role === "MERLIN" ? evilCount : avalonIsEvil(p.role) ? evilCount-1 : 0)) return false;
  if (s.stage !== "REVEAL" && !p.ready) return false;
  if (!["REVEAL","TEAM_VOTE","QUEST_VOTE"].includes(s.stage) && s.submittedCount !== 0) return false;
  if ((s.stage === "REVEAL" && p.ready || p.teamVote !== null || p.questVote !== null) && s.submittedCount < 1) return false;
  if (s.quests.length !== (s.stage === "QUEST_RESULT" || s.stage === "ASSASSINATION" ? s.quest : s.quest-1)) return false;
  if (s.stage === "ASSASSINATION" && s.quests.filter(q=>q.success).length !== 3) return false;
  if (s.quests.filter(q=>!q.success).length >= 3) return false;
  if (s.stage === "VOTE_RESULT" && (s.votes.at(-1)?.quest !== s.quest || JSON.stringify(s.votes.at(-1)?.team) !== JSON.stringify(s.team))) return false;

  if (!members.has(p.playerId) || !members.has(s.leaderId) || !belongs(s.team) || !belongs(p.knownEvilIds) || !belongs(p.merlinCandidates) || p.knownEvilIds.includes(p.playerId) || p.merlinCandidates.includes(p.playerId)) return false;
  if (p.role !== "MERLIN" && !avalonIsEvil(p.role) && p.knownEvilIds.length || (p.role === "PERCIVAL" ? p.merlinCandidates.length !== 2 : p.merlinCandidates.length !== 0)) return false;
  if (s.stage !== "TEAM_VOTE" && p.teamVote !== null || s.stage !== "QUEST_VOTE" && p.questVote !== null || p.questVote !== null && !s.team.includes(p.playerId) || p.questVote === "FAIL" && !avalonIsEvil(p.role)) return false;
  if (["TEAM_VOTE","VOTE_RESULT","QUEST_VOTE","QUEST_RESULT"].includes(s.stage) && s.team.length !== avalonTeamSize(n,s.quest)) return false;
  if (["REVEAL","TEAM_BUILD","ASSASSINATION"].includes(s.stage) && s.team.length !== 0) return false;
  if (s.submittedCount > (s.stage === "QUEST_VOTE" ? s.team.length : n)) return false;
  return true;
}
export const AvalonPlayingProjectionSchema = v.pipe(Playing, v.check(s => avalonProjectionConsistent(s)));
export const AvalonFinishedProjectionSchema = v.pipe(Finished, v.check(s => avalonProjectionConsistent(s)));
