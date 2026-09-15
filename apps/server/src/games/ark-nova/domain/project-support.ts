import * as v from 'valibot';
import { ARK_PROJECTS, ArkProjectSupportChoiceSchema, ArkActivatedProjectBonusesSchema, type ArkProjectBonus, type ArkCard, type ArkBuilding } from '@hangul-rummikub/shared';
import { arkProjectEligibility, releaseArkProjectAnimal } from './project-requirements.js';
import { arkProjectBonusEffect } from './project-bonuses.js';
import { arkReputationRange } from './build-turn.js';
import type { ArkEffectBatch } from './effect-queue.js';
export type ArkProjectSupportState={
  multiplayer?:{playerCount:number;occupiedProjects:{cardId:string;slot:number}[]}|undefined;
  hand:ArkCard[];display:(ArkCard|null)[];discarded:ArkCard[];played:ArkCard[];buildings:ArkBuilding[];pouched:Record<string,ArkCard[]>;
  baseProjects:ArkCard[];playedProjects:ArkCard[];projectSupports:{cardId:string;slot:0|1|2}[];
  sponsorTokens:Record<string,number>;
  activatedProjectBonuses:ArkProjectBonus[];supportedProjects:number;partners:string[];universities:string[];
  reputation:number;appeal:number;money:number;workers:number;busyWorkers:number;taskWorkers:Record<string,number>;
};
/** One candidate support transaction. The action coordinator checks remaining strength and executes
 * the returned simultaneous effects before allowing the next task or completing the action.
 */
export function supportArkProject<T extends ArkProjectSupportState>(current:T,upgraded:boolean,remaining:number,input:unknown):
  {ok:true;state:T;cost:number;effects:ArkEffectBatch[]}|{ok:false} {
  const selected=v.safeParse(ArkProjectSupportChoiceSchema,input),bonuses=v.safeParse(ArkActivatedProjectBonusesSchema,current.activatedProjectBonuses);
  if(!selected.success||!bonuses.success)return {ok:false};
  const a=selected.output,cost=current.played.some(c=>c.key==='203')?4:5;
  const used=current.taskWorkers.PROJECT??0,staff=used===0?1:used===1?2:Infinity;
  if(!Number.isSafeInteger(remaining)||remaining<cost||current.workers-current.busyWorkers<staff||bonuses.output.includes(a.bonus))return {ok:false};
  const held=current.hand.find(c=>c.cardId===a.cardId),displayIndex=current.display.findIndex(c=>c?.cardId===a.cardId);
  const inBase=current.baseProjects.find(c=>c.cardId===a.cardId),existing=current.playedProjects.find(c=>c.cardId===a.cardId);
  const card=inBase??existing??held??(upgraded&&displayIndex>=0&&displayIndex<arkReputationRange(current.reputation)?current.display[displayIndex]:null);
  const project=card&&ARK_PROJECTS.find(p=>p.key===card.key);
  const migration=current.played.find(c=>c.key==='224');
  if(current.multiplayer?.occupiedProjects.some(p=>p.cardId===a.cardId&&p.slot===a.slot))return {ok:false};
  if(!card||!project||current.projectSupports.some(p=>p.cardId===a.cardId&&
    (p.slot===a.slot||project.kind!=='RELEASE'||!migration)))return {ok:false};
  const tokens=a.sponsorTokenIds??[];
  if(tokens.length&&(!inBase||tokens.some(id=>!current.played.some(c=>c.cardId===id&&(c.key==='215'||c.key==='218'))||
    !Object.hasOwn(current.sponsorTokens,id)||!Number.isSafeInteger(current.sponsorTokens[id])||current.sponsorTokens[id]!<1)))return {ok:false};
  const eligible=arkProjectEligibility(card.key,a.slot,current,tokens.length,!!inBase);
  if(!eligible.eligible)return {ok:false};
  if(project.kind==='BREED'||project.kind==='RELEASE') {
    if(a.animalId===null||!eligible.animals.includes(a.animalId))return {ok:false};
  } else if(a.animalId!==null)return {ok:false};
  if(project.kind!=='RELEASE'&&a.housingId!==null)return {ok:false};
  const fresh=!inBase&&!existing,price=fresh&&!held?displayIndex+1:0;
  if(current.money<price)return {ok:false};
  const s=structuredClone(current),effects:ArkEffectBatch[]=[];
  const emit=(effect:ArkEffectBatch['effect'])=>effects.push({sourceId:card.cardId,effect,timing:'IMMEDIATE'});
  if(project.kind==='RELEASE') {
    const release=releaseArkProjectAnimal(s,card.key,a.slot,a.animalId!,a.housingId,s.played.some(c=>c.key==='219'));
    if(!release.ok)return {ok:false};
    s.played=release.played;s.buildings=release.buildings;s.appeal=release.appeal;s.discarded.push(release.discarded);
    if(Object.hasOwn(s.pouched,release.discarded.cardId)) {
      s.discarded.push(...s.pouched[release.discarded.cardId]!);
      delete s.pouched[release.discarded.cardId];
    }
  }
  if(fresh) {
    if(held)s.hand=s.hand.filter(c=>c.cardId!==a.cardId);else s.display[displayIndex]=null;
    s.playedProjects.unshift({...card});
    if(s.playedProjects.length>(s.multiplayer?.playerCount??2)) {
      const removed=s.playedProjects.pop()!;s.discarded.push(removed);s.projectSupports=s.projectSupports.filter(p=>p.cardId!==removed.cardId);
    }
    if(project.kind==='RELEASE')emit({kind:'GAIN',resource:'REPUTATION',amount:1});
  }
  s.money-=price;s.busyWorkers+=staff;s.taskWorkers.PROJECT=used+staff;
  for(const id of tokens)s.sponsorTokens[id]!--;
  s.projectSupports.push({cardId:a.cardId,slot:a.slot});s.activatedProjectBonuses.push(a.bonus);s.supportedProjects++;
  const reward=project.slots[a.slot]!;
  if(reward.conservation)emit({kind:'GAIN',resource:'CONSERVATION',amount:reward.conservation});
  if(reward.reputation)emit({kind:'GAIN',resource:'REPUTATION',amount:reward.reputation});
  if(project.kind==='RELEASE'&&migration)effects.push({sourceId:migration.cardId,effect:{kind:'GAIN',resource:'CONSERVATION',amount:1},timing:'IMMEDIATE'});
  effects.push({sourceId:`project-bonus:${a.bonus}`,effect:arkProjectBonusEffect(a.bonus),timing:'IMMEDIATE'});
  return {ok:true,state:s,cost,effects};
}
