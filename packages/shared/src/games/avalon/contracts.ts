import * as v from "valibot";
export const AvalonRoleSchema = v.picklist(["MERLIN", "ASSASSIN", "PERCIVAL", "MORGANA", "SERVANT", "MINION"]);
export type AvalonRole = v.InferOutput<typeof AvalonRoleSchema>;
export const AVALON_ROLE_LABELS: Readonly<Record<AvalonRole, string>> = { MERLIN: "멀린", ASSASSIN: "암살자", PERCIVAL: "퍼시벌", MORGANA: "모르가나", SERVANT: "아서의 충신", MINION: "모드레드의 하수인" };
export const AVALON_ROLE_HELP: Readonly<Record<AvalonRole, string>> = {
  MERLIN: "악의 편에 선 사람들을 압니다. 정체를 숨기며 선의 원정을 도우세요. 마지막 암살에서 살아남아야 합니다.",
  ASSASSIN: "동료 악인을 압니다. 선이 원정 세 번을 성공하면, 마지막으로 멀린을 찾아 암살할 수 있습니다.",
  PERCIVAL: "멀린과 모르가나 두 후보를 압니다. 둘 중 진짜 멀린을 찾아 보호하세요.",
  MORGANA: "동료 악인을 압니다. 퍼시벌에게 멀린처럼 보입니다. 믿음을 얻어 원정을 방해하세요.",
  SERVANT: "말과 투표 기록을 통해 믿을 동료를 찾으세요. 원정에서는 성공만 제출할 수 있습니다.",
  MINION: "동료 악인을 압니다. 원정에서 성공 또는 실패를 선택할 수 있습니다. 의심을 피하며 원정을 방해하세요.",
};
export function avalonIsEvil(role: AvalonRole): boolean { return role === "ASSASSIN" || role === "MORGANA" || role === "MINION"; }
export const AvalonSettingsSchema = v.strictObject({ roleSet: v.picklist(["BASIC", "INTRIGUE"]) });
export type AvalonSettings = v.InferOutput<typeof AvalonSettingsSchema>;
export const AVALON_DEFAULT_SETTINGS: AvalonSettings = { roleSet: "INTRIGUE" };
export const AvalonStageSchema = v.picklist(["REVEAL", "TEAM_BUILD", "TEAM_VOTE", "VOTE_RESULT", "QUEST_VOTE", "QUEST_RESULT", "ASSASSINATION"]);
export type AvalonStage = v.InferOutput<typeof AvalonStageSchema>;
const TEAMS: Readonly<Record<number, readonly number[]>> = { 5: [2,3,2,3,3], 6: [2,3,4,3,4], 7: [2,3,3,4,4], 8: [3,4,4,5,5], 9: [3,4,4,5,5], 10: [3,4,4,5,5] };
export function avalonTeamSize(players: number, quest: number): number {
  const size = TEAMS[players]?.[quest - 1];
  if (size === undefined) throw new Error("Invalid Avalon setup.");
  return size;
}
export function avalonFailThreshold(players: number, quest: number): number { return players >= 7 && quest === 4 ? 2 : 1; }
export function avalonRoles(players: number, settings: AvalonSettings): AvalonRole[] {
  if (!Number.isInteger(players) || players < 5 || players > 10) throw new Error("Avalon needs 5–10 players.");
  const evil = players === 10 ? 4 : players >= 7 ? 3 : 2;
  const roles: AvalonRole[] = ["MERLIN", "ASSASSIN"];
  if (settings.roleSet === "INTRIGUE") roles.push("PERCIVAL", "MORGANA");
  while (roles.filter(avalonIsEvil).length < evil) roles.push("MINION");
  while (roles.length < players) roles.push("SERVANT");
  return roles;
}
