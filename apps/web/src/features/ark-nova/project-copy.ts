import {ARK_TAG_LABELS,type ArkProjectDefinition} from '@hangul-rummikub/shared';
export function arkProjectCopy(project:ArkProjectDefinition):string{
  const tag=ARK_TAG_LABELS[project.tag]??project.tag;
  if(project.kind==='RELEASE')return `${tag} 동물 1마리를 방사합니다. 동물 카드를 버리고 인쇄된 기본 매력을 잃습니다. 이전 능력으로 얻은 매력·보전·평판은 유지합니다. 동물 크기에 맞는 단계를 고르세요.`;
  if(project.kind==='BREED')return `내 제휴 동물원과 같은 대륙 아이콘을 가진 ${tag} 동물 1마리가 필요합니다. 동물을 버리거나 우리를 비우지 않습니다.`;
  if(project.tag==='ALL_ANIMALS'||project.tag==='ALL_CONTINENTS')return `서로 다른 ${tag}의 수로 지원 조건을 확인합니다.`;
  if(project.tag==='ANIMAL_SIZE_2'||project.tag==='ANIMAL_SIZE_4')return `내 ${tag} 카드 수로 지원 조건을 확인합니다.`;
  return `내 ${tag} 아이콘 수로 지원 조건을 확인합니다.`;
}
export function arkProjectSlotCopy(project:ArkProjectDefinition,index:number):string{
  const slot=project.slots[index];if(!slot)return '';
  const condition=project.kind==='RELEASE'?(slot.requirement===4?'4·5칸 동물':slot.requirement===2?'1·2칸 또는 체험 동물':'3칸 동물'):project.kind==='BREED'?'제휴 대륙의 해당 동물 1마리':`${slot.requirement} 이상`;
  return `${condition} · 보전 +${slot.conservation}${slot.reputation?` · 평판 +${slot.reputation}`:''}`;
}
