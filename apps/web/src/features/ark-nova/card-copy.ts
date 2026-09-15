import { ARK_TAG_LABELS, type ArkAbility } from '@hangul-rummikub/shared';

/** Reference prose only. These strings must never substitute for executable rule handlers. */
export function arkAbilityCopy(ability: ArkAbility, solo=false): string {
  const n = ability.value;
  if(solo&&ability.key==='JUMPING')return `도약: 돈 ${n}을 얻습니다. 솔로에서는 휴식 마커를 전진시키지 않습니다.`;
  const text: Readonly<Record<string, string>> = {
    SPRINT: `질주: 덱에서 카드 ${n}장을 뽑습니다.`,
    PACK: '무리: 내 동물원의 육식 아이콘마다 매력 1을 얻습니다.',
    HUNTER: `사냥: 카드 ${n}장을 공개해 동물 카드 최대 1장을 가져옵니다. 나머지는 버립니다.`,
    CLEVER: '영리함: 행동을 마친 뒤 행동 카드 하나를 1번 칸으로 옮깁니다.',
    INVENTIVE: `기발함: X 토큰 ${n}개를 얻습니다. 보유 한도는 5개입니다.`,
    INVENTIVE_BEAR: '곰의 기발함: 모든 동물원의 곰 아이콘 수에 따라 X 토큰을 최대 3개 얻습니다.',
    INVENTIVE_PRIMARY: '영장류의 기발함: 내 영장류 아이콘이 1/3/5개 이상이면 X 토큰을 1/2/3개 얻습니다.',
    FULL_THROATED: '우렁찬 울음: 협회 직원 한 명을 추가로 고용합니다.',
    ICONIC_ANIMAL: `상징 동물: 모든 동물원의 ${ARK_TAG_LABELS[ability.tag] ?? ability.tag} 아이콘마다 매력 1, 최대 8을 얻습니다.`,
    SUN_BATHING: `일광욕: 손패를 최대 ${n}장 팔아 카드당 돈 4를 얻습니다.`,
    POUCH: `주머니: 손패를 최대 ${n}장 이 카드 아래에 넣어 카드당 매력 2를 얻습니다.`,
    RESISTANCE: '저항: 최종 목표 카드 2장을 뽑아 1장을 보관합니다.',
    ASSERTION: '주장: 아직 사용하지 않은 기본 보전 프로젝트 하나를 골라 손으로 가져옵니다.',
    FLOCK_ANIMAL: '군집: 충분히 큰 다른 초식동물이 있으면 새 표준 우리를 점유하지 않고 입주시킬 수 있습니다.',
    DIGGING: `땅파기: 최대 ${n}회, 공개 카드 교체 또는 손패를 버리고 새 카드 뽑기를 선택합니다.`,
    JUMPING: `도약: 휴식 마커를 ${n}칸 전진시키고 돈 ${n}을 얻습니다.`,
    SPONSOR_MAGNET: '후원 유치: 공개 카드열의 후원자 카드를 모두 손으로 가져옵니다.',
    DOMINANCE: '우위: 영장류 기본 보전 프로젝트가 아직 사용되지 않았다면 손으로 가져옵니다.',
    VENOM: `독: 매력이 앞선 대상의 낮은 강도 행동 카드에 독 토큰 ${n}개를 놓습니다.`,
    CONSTRICTION: '조이기: 매력·보전에서 앞선 대상의 높은 강도 행동 카드에 강도를 줄이는 토큰을 놓습니다.',
    PILFERING_1: '도둑질: 가장 높은 매력의 대상이 돈 또는 무작위 손패로 지불할 것을 선택합니다.',
    PILFERING_2: '도둑질: 매력·보전 선두를 대상으로 돈 또는 무작위 손패를 받습니다.',
    SNAPPING_1: '낚아채기: 공개 카드열에서 카드 1장을 가져옵니다.',
    SNAPPING_2: '낚아채기: 공개 카드열에서 카드 2장을 가져옵니다. 중간 보충을 선택할 수 있습니다.',
    SCAVENGING: `청소: 버린 카드에서 무작위로 ${n}장을 확인하고 최대 1장을 가져옵니다.`,
    POSTURING: `뽐내기: 매점 또는 파빌리온을 최대 ${n}개 무료로 짓습니다. 배치 규칙은 적용합니다.`,
    PERCEPTION_4: '통찰: 카드 4장을 뽑아 2장을 보관합니다.',
    DETERMINATION: '결단: 현재 행동을 마친 뒤 추가 행동을 실행합니다.',
    HYPNOSIS: '최면: 대상의 1~3번 칸 행동 카드 하나를 사용해 추가 행동을 실행합니다.',
    PEACOCKING: '공작의 뽐내기: 배치할 수 있다면 대형 조류관을 무료로 짓습니다.',
    PETTING_ZOO_ANIMAL: '체험 동물: 내 체험 동물 아이콘마다 매력 3을 얻습니다.',
  };
  if (text[ability.key]) return solo?text[ability.key]!.replace('모든 동물원의','내 동물원의'):text[ability.key]!;
  const suffix = ability.key.split('_').slice(1).join('_');
  const action: Readonly<Record<string,string>> = {ANIMAL:'동물',ASSOCIATION:'협회',BUILDING:'건설',BUILD:'건설',CARD:'카드',CARDS:'카드',SPONSORS:'후원자'};
  const name = action[suffix];
  if (name && ability.key.startsWith('BOOST_')) return `강화: 행동을 마친 뒤 ${name} 행동 카드를 1번 또는 5번 칸으로 옮깁니다.`;
  if (name && ability.key.startsWith('ACTION_')) return `추가 행동: 현재 행동을 마친 뒤 ${name} 행동을 실행합니다.`;
  if (name && ability.key.startsWith('MULTIPLIER_')) return `반복: ${name} 행동 카드에 반복 토큰을 놓습니다.`;
  return '능력 설명 확인 중';
}
