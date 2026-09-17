import type {SpeakeasyPracticeAction, SpeakeasyPracticeView} from '@hangul-rummikub/shared';

type Choice = SpeakeasyPracticeView['choices'][number];
export const PRACTICE_ACTION_ORDER = ['SELL', 'DELIVER', 'PRODUCE', 'PROTECT', 'BUILD', 'MOVE'] as const;

/** Presentation only: available targets and actions always come from the server. */
export function practiceDistrictChoices(choices: readonly Choice[], district: number | null): Choice[] {
  return choices.filter(choice => district === null || choice.preview.targets.some(target => target.district === district));
}

export function practiceDistrictFilter(choices: readonly Choice[], district: number, current: SpeakeasyPracticeAction['type']): SpeakeasyPracticeAction['type'] {
  const available = practiceDistrictChoices(choices, district);
  if (available.some(choice => choice.action.type === current)) return current;
  return PRACTICE_ACTION_ORDER.find(type => available.some(choice => choice.action.type === type)) ?? current;
}

export function practiceFlowHint(view: Pick<SpeakeasyPracticeView, 'finished' | 'actionsLeft' | 'choices' | 'stock' | 'truck'>): {type: SpeakeasyPracticeAction['type'] | null; text: string} {
  if (view.finished) return {type: null, text: '대국이 끝났습니다. 최종 결과를 확인하거나 새 연습을 시작하세요.'};
  if (view.actionsLeft === 0) return {type: 'END_TURN', text: '이번 턴의 행동을 모두 사용했습니다. 턴을 마치면 컴퓨터가 행동하고 다시 내 차례가 됩니다.'};
  if (view.choices.some(c => c.action.type === 'SELL')) return {type: 'SELL', text: '주류가 도착한 건물이 있습니다. 판매를 선택해 현금을 벌어 보세요.'};
  if (view.choices.some(c => c.action.type === 'DELIVER')) return {type: 'DELIVER', text: '배달 가능한 건물이 있습니다. 경로와 적재량을 확인한 뒤 주류를 보내 보세요.'};
  if (view.stock === 0 && view.truck.load === 0 && view.choices.some(c => c.action.type === 'PRODUCE')) return {type: 'PRODUCE', text: '첫 단계는 생산입니다. 증류소에서 주류를 만들고 빈 주점으로 운송하세요.'};
  return {type: null, text: '지도의 내 건물이나 빈 구역을 눌러 가능한 행동을 찾아보세요. 건설·보호·트럭 이동도 선택할 수 있습니다.'};
}
