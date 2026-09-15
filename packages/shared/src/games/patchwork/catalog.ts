/** Basic edition component facts; source audit: docs/PATCHWORK_GAME_RULES.md. */
export type PatchworkPatch = Readonly<{id:number;cost:number;time:number;income:number;rows:readonly string[]}>;
export const PATCHWORK_PATCHES: readonly PatchworkPatch[] = Object.freeze([
  Object.freeze({id:1,cost:2,time:1,income:0,rows:Object.freeze(["##"])}),
  Object.freeze({id:2,cost:2,time:2,income:0,rows:Object.freeze(["###"])}),
  Object.freeze({id:3,cost:3,time:3,income:1,rows:Object.freeze(["####"])}),
  Object.freeze({id:4,cost:7,time:1,income:1,rows:Object.freeze(["#####"])}),
  Object.freeze({id:5,cost:6,time:5,income:2,rows:Object.freeze(["##", "##"])}),
  Object.freeze({id:6,cost:2,time:2,income:0,rows:Object.freeze(["## ", "###"])}),
  Object.freeze({id:7,cost:10,time:5,income:3,rows:Object.freeze(["##  ", "####"])}),
  Object.freeze({id:8,cost:7,time:4,income:2,rows:Object.freeze([" ## ", "####"])}),
  Object.freeze({id:9,cost:4,time:2,income:0,rows:Object.freeze(["### ", " ###"])}),
  Object.freeze({id:10,cost:8,time:6,income:3,rows:Object.freeze([" ##", " ##", "## "])}),
  Object.freeze({id:11,cost:1,time:2,income:0,rows:Object.freeze(["# #", "###"])}),
  Object.freeze({id:12,cost:1,time:5,income:1,rows:Object.freeze(["#  #", "####"])}),
  Object.freeze({id:13,cost:3,time:6,income:2,rows:Object.freeze(["# #", "###", " # "])}),
  Object.freeze({id:14,cost:2,time:2,income:0,rows:Object.freeze(["###", " # "])}),
  Object.freeze({id:15,cost:5,time:5,income:2,rows:Object.freeze(["###", " # ", " # "])}),
  Object.freeze({id:16,cost:7,time:2,income:2,rows:Object.freeze(["###", " # ", " # ", " # "])}),
  Object.freeze({id:17,cost:0,time:3,income:1,rows:Object.freeze([" # ", "###", " # ", " # "])}),
  Object.freeze({id:18,cost:4,time:2,income:1,rows:Object.freeze(["# ", "# ", "##"])}),
  Object.freeze({id:19,cost:4,time:6,income:2,rows:Object.freeze(["# ", "# ", "##"])}),
  Object.freeze({id:20,cost:10,time:3,income:2,rows:Object.freeze(["# ", "# ", "# ", "##"])}),
  Object.freeze({id:21,cost:3,time:4,income:1,rows:Object.freeze(["# ", "# ", "##", "# "])}),
  Object.freeze({id:22,cost:5,time:4,income:2,rows:Object.freeze([" # ", "###", " # "])}),
  Object.freeze({id:23,cost:1,time:4,income:1,rows:Object.freeze([" # ", " # ", "###", " # ", " # "])}),
  Object.freeze({id:24,cost:5,time:3,income:1,rows:Object.freeze([" ## ", "####", " ## "])}),
  Object.freeze({id:25,cost:2,time:3,income:0,rows:Object.freeze(["# #", "###", "# #"])}),
  Object.freeze({id:26,cost:3,time:1,income:0,rows:Object.freeze([" #", "##"])}),
  Object.freeze({id:27,cost:1,time:3,income:0,rows:Object.freeze([" #", "##"])}),
  Object.freeze({id:28,cost:3,time:2,income:1,rows:Object.freeze([" #", "##", "# "])}),
  Object.freeze({id:29,cost:7,time:6,income:3,rows:Object.freeze([" #", "##", "# "])}),
  Object.freeze({id:30,cost:2,time:3,income:1,rows:Object.freeze([" #", " #", "##", "# "])}),
  Object.freeze({id:31,cost:1,time:2,income:0,rows:Object.freeze(["   #", "####", "#   "])}),
  Object.freeze({id:32,cost:2,time:1,income:0,rows:Object.freeze(["  # ", "####", " #  "])}),
  Object.freeze({id:33,cost:10,time:4,income:3,rows:Object.freeze(["  #", " ##", "## "])}),
  Object.freeze({id:0,cost:0,time:0,income:0,rows:Object.freeze(["#"])}),
]);
export const PATCHWORK_END = 53;
export const PATCHWORK_INCOME = Object.freeze([5,11,17,23,29,35,41,47,53]);
export const PATCHWORK_LEATHER = Object.freeze([26,32,38,44,50]);
export function patchworkPatch(id:number):PatchworkPatch {
  const patch=PATCHWORK_PATCHES.find(p=>p.id===id);
  if(!patch) throw new Error('Unknown patch definition.');
  return patch;
}
