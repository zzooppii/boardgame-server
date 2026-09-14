import {ARK_DONATION_COSTS,occupyArkSoloDonation,ARK_PROJECTS,arkProjectEligibility,arkReleaseHousingChoices,arkReputationRange,type ArkSoloView,type ArkAssociationTask} from '@hangul-rummikub/shared';
import {arkDisplayedStrength} from './action-controls.js';

/** Advisory checks use the frozen action side/strength during an association continuation. */
export function arkAssociationAdvice(s:ArkSoloView,task:ArkAssociationTask,x=0):string[] {
  const issues:string[]=[],work=s.associationWork;
  const upgraded=work?.upgraded??s.actions.some(a=>a.kind==='ASSOCIATION'&&a.upgraded);
  const strength=work?.remaining??arkDisplayedStrength(s,'ASSOCIATION',x);
  const cost=task.kind==='REPUTATION'?2:task.kind==='PARTNER'?3:task.kind==='UNIVERSITY'?4:s.played.some(c=>c.key==='203')?4:5;
  const used=s.taskWorkers[task.kind]??0,staff=used===0?1:2;
  if(work&&(!work.upgraded||work.tasks.includes(task.kind)))issues.push('이번 협회 행동에서 이미 수행한 업무입니다.');
  if(strength<cost)issues.push(`행동력 ${cost-strength} 부족 (필요 ${cost} · 남음 ${strength})`);
  if(used>=3)issues.push('이번 휴식 전에는 이 업무를 더 수행할 수 없습니다.');
  else if(s.workers-s.busyWorkers<staff)issues.push(`직원 ${staff}명 필요 · 사용 가능 ${s.workers-s.busyWorkers}명`);
  if(task.kind==='PARTNER') {
    if(s.partners.includes(task.continent))issues.push('이미 제휴한 대륙입니다.');
    if(!s.partnerSupply.includes(task.continent))issues.push('현재 공급에 없는 제휴 동물원입니다.');
    if(s.partners.length>=(upgraded?4:2))issues.push(upgraded?'제휴 동물원 4개를 모두 보유했습니다.':'제휴 동물원 3·4번째 획득에는 협회 II가 필요합니다.');
  }
  if(task.kind==='UNIVERSITY') {
    if(s.universities.includes(task.university))issues.push('이미 보유한 대학입니다.');
    if(!s.universitySupply.includes(task.university))issues.push('현재 공급에 없는 대학입니다.');
  }
  if(task.kind!=='PROJECT')return issues;
  const held=s.hand.find(c=>c.cardId===task.cardId),base=s.baseProjects.find(c=>c.cardId===task.cardId),existing=s.playedProjects.find(c=>c.cardId===task.cardId);
  const slot=s.display.findIndex(c=>c?.cardId===task.cardId),card=base??existing??held??s.display[slot];
  const project=card&&ARK_PROJECTS.find(p=>p.key===card.key);
  if(!card||!project)return [...issues,'프로젝트를 선택하세요.'];
  if(!base&&!existing&&!held) {
    if(!upgraded)issues.push('공개 프로젝트 사용에는 협회 II가 필요합니다.');
    if(slot>=arkReputationRange(s.reputation))issues.push('현재 평판으로 이용할 수 없는 공개 카드 칸입니다.');
    if(s.money<slot+1)issues.push(`공개 프로젝트 비용 ${slot+1} · 돈 ${slot+1-s.money} 부족`);
  }
  if(s.projectSupports.some(p=>p.cardId===card.cardId&&(p.slot===task.slot||project.kind!=='RELEASE'||!s.played.some(c=>c.key==='224'))))issues.push('이미 지원한 프로젝트 또는 점유된 보상 칸입니다.');
  if(s.activatedProjectBonuses.includes(task.bonus))issues.push('이미 사용한 지도 보너스입니다.');
  const tokens=task.sponsorTokenIds??[];
  if(tokens.length&&(!base||new Set(tokens).size!==tokens.length||tokens.length>2||tokens.some(id=>!s.played.some(c=>c.cardId===id&&(c.key==='215'||c.key==='218'))||(s.sponsorTokens[id]??0)<1)))issues.push('사용할 수 없는 후원 토큰입니다.');
  const eligible=arkProjectEligibility(card.key,task.slot,s,tokens.length,!!base);
  if(project.kind==='RELEASE'||project.kind==='BREED') {
    if(!task.animalId||!eligible.animals.includes(task.animalId))issues.push(project.kind==='RELEASE'?'이 보상 칸의 동물 종류·크기에 맞는 방사 대상을 선택하세요.':'해당 동물 종류와 같은 대륙 제휴 조건을 만족하는 번식 대상을 선택하세요.');
  } else if(!eligible.eligible)issues.push(`프로젝트 조건 부족 (현재 ${eligible.value} · 필요 ${project.slots[task.slot]?.requirement??0})`);
  if(project.kind==='RELEASE'&&task.animalId) {
    const animal=s.played.find(c=>c.cardId===task.animalId);
    if(animal){const choices=arkReleaseHousingChoices(s.buildings,animal,s.played.some(c=>c.key==='219'));
      if(choices.length?!task.housingId||!choices.includes(task.housingId):task.housingId!==null)issues.push('방사할 동물에 맞는 비울 우리를 선택하세요.');}
  }
  return issues;
}

export function arkDonationAdvice(s:ArkSoloView) {
  const cost=ARK_DONATION_COSTS[occupyArkSoloDonation(s.donations).blocked??7]!,issues:string[]=[];
  if(!s.associationWork?.upgraded)issues.push('협회 II 행동 중에 기부할 수 있습니다.');
  if(s.associationWork?.donated)issues.push('이번 협회 행동에서 이미 기부했습니다.');
  if(s.money<cost)issues.push(`돈 ${cost-s.money} 부족`);
  return {cost,issues};
}
