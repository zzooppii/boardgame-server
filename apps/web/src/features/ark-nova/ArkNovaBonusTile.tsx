/** Presentation only: available choices and resolution remain server-owned. */
const bonuses:Readonly<Record<string,{label:string;symbol:string;description:string}>>={
  REPUTATION_2:{label:'평판 2',symbol:'2 🎓',description:'평판을 2 올립니다. 평판 트랙의 보상도 처리합니다.'},
  X_3:{label:'X 토큰 3',symbol:'3 ×',description:'행동 강도를 높이는 X 토큰을 3개 받습니다. 보유 한도는 5개입니다.'},
  ENCLOSURE_3:{label:'무료 3칸 우리',symbol:'3 ⬡',description:'3칸 표준 우리 하나를 무료로 건설합니다. 지도에서 위치를 고르며, 일반 배치 조건은 유지됩니다.'},
  CARDS_3:{label:'카드 3장',symbol:'3 ▤',description:'카드를 한 장씩 총 3장 가져옵니다. 덱 또는 평판 범위 안의 공개 카드를 선택합니다.'},
  MONEY_10:{label:'돈 10',symbol:'10',description:'돈 10을 받습니다.'},
  MULTIPLIER:{label:'배수 토큰',symbol:'×2',description:'행동 카드 하나에 배수 토큰을 놓습니다. 해당 행동을 사용할 때 두 번 수행할 수 있습니다.'},
  UNIVERSITY:{label:'대학',symbol:'⚗',description:'협회판에서 대학 하나를 가져와 혜택을 받습니다. 남아 있는 대학 중에서 선택합니다.'},
  PARTNER:{label:'제휴 동물원',symbol:'🌐',description:'협회판에서 제휴 동물원 하나를 가져옵니다. 세 번째·네 번째 제휴에는 협회 II가 필요합니다.'},
  PAID_SPONSOR:{label:'후원자 사용',symbol:'@',description:'손패의 후원자 한 장을 후원 등급만큼 돈을 내고 사용합니다. 카드의 조건도 충족해야 합니다.'},
  MONEY_5:{label:'돈 5',symbol:'5',description:'타일 대신 돈 5를 받습니다. 보너스 타일은 그대로 남습니다.'},
};
export function arkBonusPresentation(tile:string){return bonuses[tile]??{label:tile,symbol:'?',description:'효과 정보를 확인할 수 없습니다.'};}
export function ArkNovaBonusTile({tile}:{tile:string}){
  const bonus=arkBonusPresentation(tile);
  return <><span className={`ark-bonus-token${tile==='MONEY_5'?' is-money':''}`} aria-hidden="true">{bonus.symbol}</span><strong>{bonus.label}</strong><span className="ark-bonus-description">{bonus.description}</span></>;
}
