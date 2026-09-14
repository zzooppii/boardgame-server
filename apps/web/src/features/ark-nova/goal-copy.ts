import type {ArkGoalDefinition} from '@hangul-rummikub/shared';
const subjects:Readonly<Record<string,string>>={
  '001':'표준 우리 4·5칸을 요구하는 내 대형 동물 수',
  '002':'표준 우리 1·2칸을 요구하는 동물과 체험 동물을 합친 내 소형 동물 수',
  '003':'대학과 카드의 연구 아이콘 수',
  '005':'보전 프로젝트를 지원한 총횟수',
  '006':'물·바위를 제외하고 아직 건설하지 않은 땅의 칸 수. 건설 II가 필요한 빈 칸도 포함',
  '007':'내 평판',
  '008':'사용한 후원자 카드 수',
  '010':'내 카드의 바위 아이콘 수. 지도 바위 칸의 수가 아닙니다',
  '011':'내 카드의 물 아이콘 수. 지도 물 칸의 수가 아닙니다',
};
export function arkGoalCopy(goal:ArkGoalDefinition):readonly string[]{
  if(goal.key==='009')return ['솔로에서는 이 카드를 사용하지 않습니다. 뽑으면 즉시 버리고 다른 목표로 교체합니다.'];
  if(goal.key==='004')return ['다음 조건마다 보전 1을 얻습니다. 최대 보전 4.',...goal.thresholds.map(String),'연결은 해당 물·바위 칸에 건물이 인접한 상태입니다. 땅 전체와 가장자리 덮기에서 물·바위 칸은 제외합니다.'];
  return [`종료 시 ${subjects[goal.key]??goal.name}를 셉니다.`,`${goal.thresholds.join(' / ')} 이상이면 각각 보전 1 / 2 / 3 / 4를 얻습니다. 첫 기준에 못 미치면 0입니다.`];
}
