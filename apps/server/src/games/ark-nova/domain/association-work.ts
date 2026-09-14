import * as v from 'valibot';
import { ArkAssociationTaskSchema, ArkRefSchema, type ArkReward } from '@hangul-rummikub/shared';
import { supportArkProject, type ArkProjectSupportState } from './project-support.js';
import type { ArkEffectBatch } from './effect-queue.js';
import { performArkAssociation } from './association.js';
import { startArkAction, finishArkAction } from './action-row.js';
import { ARK_DONATION_COSTS, occupyArkSoloDonation } from './solo-lifecycle.js';
import type { ArkBreakState } from './solo-break.js';

import { ArkAssociationWorkSchema as WorkSchema, type ArkAssociationWork } from '@hangul-rummikub/shared';
export type { ArkAssociationWork };
type Board=ArkBreakState & ArkProjectSupportState & {x:number};
type WorkResult<T>={ok:true;state:T;work:ArkAssociationWork;rewards:ArkReward[];effects:ArkEffectBatch[]} | {ok:false;reason:'INVALID_ACTION'|'UNRESOLVED_EFFECTS'};
const invalid={ok:false,reason:'INVALID_ACTION'} as const;
const unresolved={ok:false,reason:'UNRESOLVED_EFFECTS'} as const;

/** Internal candidate operations. The application must resolve every returned reward before continuing.
 * Project support shares the same staff/strength ledger; platform transport registration is separate.
 */
export function startArkAssociationWork<T extends Board>(current:T,xSpent:number,input:unknown,rewardId:string,baseStrength?:number):WorkResult<T> {
  const task=v.safeParse(ArkAssociationTaskSchema,input);
  if (current.progress.stage!=='ACTION'||!task.success||!v.safeParse(ArkRefSchema,rewardId).success) return invalid;
  const action=startArkAction(current.actions,'ASSOCIATION',current.x,xSpent,baseStrength);
  if (!action.ok) return invalid;
  let state=structuredClone(current);let rewards:ArkReward[]=[],effects:ArkEffectBatch[]=[],cost:number;
  if(task.output.kind==='PROJECT') {
    const {kind,...choice}=task.output;void kind;
    const result=supportArkProject(state,action.upgraded,action.strength,choice);if(!result.ok)return invalid;
    state=result.state;effects=result.effects;cost=result.cost;
  } else {
    const result=performArkAssociation(state,action.strength,action.upgraded,task.output,rewardId);if(result===null)return invalid;
    rewards=result;cost=task.output.kind==='REPUTATION'?2:task.output.kind==='PARTNER'?3:4;
  }
  state.x=action.xRemaining;
  return {ok:true,state,rewards,effects,work:v.parse(WorkSchema,{projectCost:task.output.kind==='PROJECT'?cost:5,strength:action.strength,remaining:action.strength-cost,upgraded:action.upgraded,tasks:[task.output.kind],donated:false})};
}
export function continueArkAssociationWork<T extends Board>(current:T,active:ArkAssociationWork,input:unknown,rewardId:string,unresolvedEffects:number):WorkResult<T> {
  if (unresolvedEffects!==0) return unresolved;
  const work=v.safeParse(WorkSchema,active),task=v.safeParse(ArkAssociationTaskSchema,input);
  if (current.progress.stage!=='ACTION'||!work.success||!task.success||!v.safeParse(ArkRefSchema,rewardId).success||
    !work.output.upgraded||work.output.tasks.includes(task.output.kind)) return invalid;
  let state=structuredClone(current);let rewards:ArkReward[]=[],effects:ArkEffectBatch[]=[],cost:number;
  if(task.output.kind==='PROJECT') {
    const {kind,...choice}=task.output;void kind;
    const result=supportArkProject(state,true,work.output.remaining,choice);if(!result.ok)return invalid;
    state=result.state;effects=result.effects;cost=result.cost;
  } else {
    const result=performArkAssociation(state,work.output.remaining,true,task.output,rewardId);if(result===null)return invalid;
    rewards=result;cost=task.output.kind==='REPUTATION'?2:task.output.kind==='PARTNER'?3:4;
  }
  return {ok:true,state,rewards,effects,work:v.parse(WorkSchema,{...work.output,projectCost:task.output.kind==='PROJECT'?cost:work.output.projectCost,remaining:work.output.remaining-cost,tasks:[...work.output.tasks,task.output.kind]})};
}
export function donateArkAssociationWork<T extends Board>(current:T,active:ArkAssociationWork,rewardId:string,unresolvedEffects:number):WorkResult<T> {
  if (unresolvedEffects!==0) return unresolved;
  const work=v.safeParse(WorkSchema,active);
  if (current.progress.stage!=='ACTION'||!work.success||!work.output.upgraded||work.output.donated||!v.safeParse(ArkRefSchema,rewardId).success) return invalid;
  // The server determines the cheapest free space, including the repeatable final space.
  const next=occupyArkSoloDonation(current.donations),cost=ARK_DONATION_COSTS[next.blocked??7];
  if (cost===undefined||!Number.isSafeInteger(current.money)||current.money<cost) return invalid;
  const state=structuredClone(current);state.money-=cost;state.donations=next.occupied;
  return {ok:true,state,effects:[],work:{...work.output,donated:true},rewards:[{id:rewardId,kind:'CONSERVATION',amount:1}]};
}
export function endArkAssociationWork<T extends Board>(current:T,active:ArkAssociationWork,unresolvedEffects:number):{ok:true;state:T}|{ok:false;reason:'INVALID_ACTION'|'UNRESOLVED_EFFECTS'} {
  if (unresolvedEffects!==0) return unresolved;
  if (current.progress.stage!=='ACTION'||!v.safeParse(WorkSchema,active).success) return invalid;
  const state=structuredClone(current);state.actions=finishArkAction(state.actions,'ASSOCIATION');
  return {ok:true,state};
}
