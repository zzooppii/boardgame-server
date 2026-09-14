import * as v from 'valibot';
import { ArkRefSchema } from './actions.js';
import { ARK_PROJECTS } from './catalog.js';
export const ARK_MAP_A_PROJECT_BONUSES=['SNAP_1','ENCLOSURE_2','MONEY_5','CONSERVATION_1','REPUTATION_2','MONEY_12','X_3'] as const;
export const ArkProjectBonusSchema=v.picklist(ARK_MAP_A_PROJECT_BONUSES);
export type ArkProjectBonus=v.InferOutput<typeof ArkProjectBonusSchema>;
export const ArkActivatedProjectBonusesSchema=v.pipe(v.array(ArkProjectBonusSchema),v.maxLength(7),v.check(xs=>new Set(xs).size===xs.length));
export const ArkProjectSupportChoiceSchema=v.strictObject({cardId:ArkRefSchema,slot:v.picklist([0,1,2]),bonus:ArkProjectBonusSchema,
  animalId:v.nullable(ArkRefSchema),housingId:v.nullable(ArkRefSchema),
  sponsorTokenIds:v.optional(v.pipe(v.array(ArkRefSchema),v.maxLength(2),v.check(ids=>new Set(ids).size===ids.length)))});
export const ArkProjectSupportRecordSchema=v.strictObject({cardId:ArkRefSchema,slot:v.picklist([0,1,2])});

/** Migration Recording waives the one-support-per-project limit, never slot occupancy. */
export function arkProjectSupportsAreConsistent(s:{
  projectSupports:readonly {cardId:string;slot:number}[];
  baseProjects:readonly {cardId:string;key:string}[];playedProjects:readonly {cardId:string;key:string}[];
  played:readonly {key:string}[];
}):boolean {
  const seen=new Map<string,Set<number>>(),migration=s.played.some(c=>c.key==='224');
  for(const support of s.projectSupports) {
    const card=[...s.baseProjects,...s.playedProjects].find(c=>c.cardId===support.cardId);
    const project=card&&ARK_PROJECTS.find(p=>p.key===card.key);
    if(!project||!Number.isInteger(support.slot)||support.slot<0||support.slot>2)return false;
    const slots=seen.get(support.cardId);
    if(slots&&(slots.has(support.slot)||!migration||project.kind!=='RELEASE'))return false;
    if(slots)slots.add(support.slot);else seen.set(support.cardId,new Set([support.slot]));
  }
  return true;
}
