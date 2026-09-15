import {useId} from 'react';
import {ARK_ACTION_LABELS,type ArkActionKind} from '@hangul-rummikub/shared';

const benefits:Record<ArkActionKind,readonly string[]>={
  ANIMALS:['동물 II 조건이 있는 동물을 입주시킬 수 있습니다.','손패뿐 아니라 평판 범위의 공개 동물도 사용합니다. 공개 칸 번호만큼 추가 비용을 냅니다.','행동력 5 이상이면 평판 +1을 선택할 수 있습니다.'],
  BUILD:['건물 1개 → 서로 다른 건물을 행동력 합계 안에서 여러 개 건설합니다.','파충류관·대형 조류관과 지도에 II로 표시된 칸이 열립니다.','건설 비용은 그대로 칸당 돈 2입니다.'],
  SPONSORS:['후원자 1장 → 후원 등급 합계가 행동력 +1 이하인 여러 장을 사용합니다.','평판 범위의 공개 후원자도 사용하며, 공개 칸 번호만큼 추가 비용을 냅니다. 후원자 II 조건도 충족합니다.','모금이 행동력만큼 → 행동력의 2배가 됩니다. 예: 행동력 5에서 돈 5 → 10.'],
  CARDS:['덱뿐 아니라 평판 범위의 공개 카드에서도 가져옵니다.','행동력 5에서 3장 가져오고 1장 버리기 → 4장 가져오고 1장 버리기.','낚아채기 최소 행동력 5 → 3, 평판 상한 9 → 15.'],
  ASSOCIATION:['업무 1개 → 서로 다른 업무를 행동력 합계 안에서 여러 개 수행합니다. 직원은 업무마다 필요합니다.','업무 후 돈을 내고 보전 +1을 받는 기부를 1회 할 수 있습니다.','제휴 동물원 보유 한도 2 → 4개.'],
};
export function ArkNovaUpgradeChoice({action,disabled,onChoose}:{action:ArkActionKind;disabled:boolean;onChoose():void}){
  const id=useId();
  return <article className="ark-upgrade-choice">
    <h4>{ARK_ACTION_LABELS[action]} I → II</h4>
    <ul id={id}>{benefits[action].map(text=><li key={text}>{text}</li>)}</ul>
    <button type="button" disabled={disabled} aria-describedby={id} onClick={onChoose}>{ARK_ACTION_LABELS[action]} II</button>
  </article>;
}
