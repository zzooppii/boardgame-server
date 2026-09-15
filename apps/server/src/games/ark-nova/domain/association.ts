import {ARK_MAP_LAYOUTS,type ArkMapId} from '@hangul-rummikub/shared';
import { type ArkAssociationGeneralTask, type ArkReward, type ArkActionCard } from '@hangul-rummikub/shared';
import { ARK_UNIVERSITIES, type ArkBreakState } from './solo-break.js';
export {arkUniversityResearch} from '@hangul-rummikub/shared';
export type ArkAssociationHoldings={mapId?:ArkMapId|undefined;partners:string[];partnerSupply:string[];universities:string[];universitySupply:string[]};
/** Acquisition shared by normal association work and free bonuses. Never consumes staff or moves an action. */
export function acquireArkAssociationTile(s:ArkAssociationHoldings,upgraded:boolean,task:Exclude<ArkAssociationGeneralTask,{kind:'REPUTATION'}>,rewardId:string):ArkReward[]|null {
  if(task.kind==='PARTNER'&&(!s.partnerSupply.includes(task.continent)||s.partners.includes(task.continent)||s.partners.length>=(upgraded?4:2)))return null;
  if(task.kind==='UNIVERSITY'&&(!s.universitySupply.includes(task.university)||s.universities.includes(task.university)))return null;
  const rewards:ArkReward[]=[];
  const add=(kind:ArkReward['kind'],amount:number,label:string)=>rewards.push({id:`${rewardId}:${label}`,kind,amount});
  if(task.kind==='PARTNER') {
    s.partners.push(task.continent);s.partnerSupply=s.partnerSupply.filter(p=>p!==task.continent);
    if(s.partners.length===ARK_MAP_LAYOUTS[s.mapId??'A'].partnerUpgrade)add('UPGRADE',1,'partner-slot');
    if(s.partners.length===3)add('WORKER',1,'partner-slot');
    if(s.partners.length===4&&ARK_MAP_LAYOUTS[s.mapId??'A'].partnerPoints)add('CONSERVATION',ARK_MAP_LAYOUTS[s.mapId??'A'].partnerPoints,'partner-slot');
  } else {
    s.universities.push(task.university);s.universitySupply=s.universitySupply.filter(u=>u!==task.university);
    if(task.university!=='RESEARCH_2')add('REPUTATION',task.university==='HAND_LIMIT'?1:2,'university-reputation');
    if(s.universities.length===(s.mapId==='1'||s.mapId==='3'?1:2))add('UPGRADE',1,'university-slot');
    if(s.universities.length===3&&ARK_MAP_LAYOUTS[s.mapId??'A'].universityPoints)add('CONSERVATION',ARK_MAP_LAYOUTS[s.mapId??'A'].universityPoints,'university-slot');
  }
  return rewards;
}
/** General tasks only. Caller freezes the action side and resolves the returned rewards. */
export function performArkAssociation(s:ArkBreakState,strength:number,upgraded:boolean,task:ArkAssociationGeneralTask,rewardId:string):ArkReward[]|null {
  const cost=task.kind==='REPUTATION'?2:task.kind==='PARTNER'?3:4;
  const used=s.taskWorkers[task.kind]??0,required=used===0?1:used===1?2:Infinity;
  if(strength<cost||s.workers-s.busyWorkers<required)return null;
  const rewards:ArkReward[]|null=task.kind==='REPUTATION'?[{id:`${rewardId}:reputation`,kind:'REPUTATION',amount:2}]:acquireArkAssociationTile(s,upgraded,task,rewardId);
  if(!rewards)return null;
  s.busyWorkers+=required;s.taskWorkers[task.kind]=used+required;return rewards;
}
export function arkReputationAdvance(reputation:number,amount:number,actions:readonly ArkActionCard[],id:string) {
  const cap=actions.find(a=>a.kind==='CARDS')!.upgraded?15:9;
  const next=Math.max(reputation,Math.min(cap,reputation+amount)),rewards:ArkReward[]=[];
  for (let value=reputation+1;value<=next;value++) {
    const kind:ArkReward['kind']|null=value===5?'UPGRADE':value===8?'WORKER':value===10||value===13?'CARD':value===11||value===14?'CONSERVATION':value===12||value===15?'X':null;
    if (kind) rewards.push({id:`${id}:reputation-${value}`,kind,amount:value===13?2:1});
  }
  return {reputation:next,appeal:cap===15?Math.max(0,reputation+amount-15):0,rewards};
}
export function assertArkAssociation(s:ArkBreakState & {multiplayer?:unknown}):void {
  if (Object.keys(s.taskWorkers).some(k=>!['REPUTATION','PARTNER','UNIVERSITY','PROJECT'].includes(k))||Object.values(s.taskWorkers).some(n=>n!==1&&n!==3)||
    Object.values(s.taskWorkers).reduce((sum,n)=>sum+n,0)!==s.busyWorkers||s.busyWorkers>s.workers||
    new Set(s.partners).size!==s.partners.length||!s.multiplayer&&s.partners.length>(s.actions.find(a=>a.kind==='ASSOCIATION')?.upgraded?4:2)||new Set(s.universities).size!==s.universities.length||
    s.universities.some(u=>!ARK_UNIVERSITIES.includes(u))) throw new Error('Invalid Ark association state.');
}
