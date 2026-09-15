import {ARK_MAP_LAYOUTS,type ArkMapId} from '@hangul-rummikub/shared';
import type {ARK_SOLO_UNIVERSITIES} from '@hangul-rummikub/shared';

export const ARK_UNIVERSITY_LABELS:Record<(typeof ARK_SOLO_UNIVERSITIES)[number],string>={
  HAND_LIMIT:'손패 한도 5 · 평판 1',
  RESEARCH_2:'연구 아이콘 2',
  RESEARCH_REPUTATION:'연구 1 · 평판 2',
};

/** Explains existing acquisition rewards; reaching a slot is not proof its queued reward was resolved. */
export function ArkNovaAssociationBenefits({kind,count,mapId='A'}:{mapId?:ArkMapId|undefined;kind:'PARTNER'|'UNIVERSITY';count:number}) {
  const partner=kind==='PARTNER';
  const layout=ARK_MAP_LAYOUTS[mapId];
  const milestones:readonly (readonly [number,string])[]=partner?[[2,'행동 업그레이드'],[3,'직원 +1'],...(layout.partnerPoints?[[4,`보전 +${layout.partnerPoints}`] as const]:[])]:[[mapId==='1'||mapId==='3'?1:2,'행동 업그레이드'],...(layout.universityPoints?[[3,`보전 +${layout.universityPoints}`] as const]:[])];
  return <details className="ark-association-benefits"><summary>{partner?'제휴':'대학'} 혜택 · 현재 {count}곳</summary>
    <p>{partner?'제휴 대륙 아이콘마다 해당 동물의 비용이 돈 3 줄어듭니다. 제휴는 카드·번식 조건에도 사용합니다.':'연구 아이콘은 카드 조건에 쓰이며 소모되지 않습니다. 평판은 대학 획득 시 한 번 받고, 손패 한도는 휴식 때 적용합니다. 손패 한도 대학은 연구 아이콘을 주지 않습니다.'}</p>
    <ul>{milestones.map(([n,reward])=><li key={n}>{n}번째 획득: {reward} · {count>=n?'도달':count===n-1?'다음 획득 보상':`${n-count}곳 더 필요`}</li>)}</ul>
    {partner&&<p>3·4번째 제휴에는 협회 II가 필요합니다.</p>}
    <small>추가 보상은 획득할 때 한 번 받습니다. 대기 중인 보상은 현재 행동 영역에서 마무리하세요.</small>
  </details>;
}
