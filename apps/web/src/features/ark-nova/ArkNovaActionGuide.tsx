import {useContext} from 'react';
import {ArkNovaMultiplayerContext} from './ArkNovaMode.js';
import {ARK_ACTION_LABELS,type ArkActionKind} from '@hangul-rummikub/shared';

/** Printed action reference. This does not authorize a command or replace server validation. */
export function arkActionBenefits(kind:ArkActionKind,upgraded:boolean,strength:number):string {
  if(strength<1)return '행동력이 부족합니다.';
  switch(kind){
    case 'ANIMALS':return `동물 최대 ${strength>=5?2:strength>=2?1:0}장${upgraded&&strength>=5?' · 평판 1 선택 가능':''}`;
    case 'CARDS':{
      const i=Math.min(5,strength)-1;
      return `${(upgraded?[1,2,2,3,4]:[1,1,2,2,3])[i]}장 가져오기 · ${(upgraded?[0,1,0,1,1]:[1,0,1,0,1])[i]}장 버리기${strength>=(upgraded?3:5)?' 또는 공개 카드 1장 낚아채기':''}`;
    }
    case 'BUILD':return upgraded?`서로 다른 건물 · 합계 ${strength}칸까지`:`건물 1개 · 최대 ${strength}칸`;
    case 'SPONSORS':return upgraded?`후원 등급 합계 ${strength+1}까지 또는 모금 돈 ${strength*2}`:`후원 등급 ${strength}까지 1장 또는 모금 돈 ${strength}`;
    case 'ASSOCIATION':return upgraded?`서로 다른 업무 · 행동력 합계 ${strength}까지 · 기부 1회 가능`:`행동력 ${strength} 이하 업무 1개`;
  }
}
const descriptions:Record<ArkActionKind,readonly [string,string]>={
  ANIMALS:['손패의 동물을 한 장씩 입주시킵니다. 비용·아이콘·우리 조건을 충족해야 합니다.','손패 또는 평판 범위의 공개 동물을 입주시킵니다. 공개 카드는 칸 번호만큼 추가 비용을 냅니다.'],
  CARDS:['덱에서 뽑은 뒤 손패에서 버립니다. 낚아채기는 평판과 무관하게 공개 카드 1장을 가져옵니다.','덱 또는 평판 범위의 공개 카드에서 한 장씩 가져옵니다. 낚아채기는 평판과 무관합니다. 평판 상한이 15로 늘어납니다.'],
  BUILD:['칸당 돈 2. 일반 우리·매점·파빌리온·동물체험장을 건설합니다.','칸당 돈 2. 대형 조류관·파충류관과 건설 II 지도 칸이 해금됩니다. 같은 종류는 한 행동에 한 번만 건설합니다.'],
  SPONSORS:['후원자 한 장을 사용하거나 모금합니다. 카드의 조건도 충족해야 합니다.','손패 또는 평판 범위의 공개 후원자를 여러 장 사용할 수 있습니다. 공개 카드는 칸 번호만큼 추가 비용을 냅니다.'],
  ASSOCIATION:['직원을 배치합니다. 평판 +2: 행동력 2 · 제휴: 3 · 대학: 4 · 프로젝트: 기본 5.','행동력을 나눠 서로 다른 업무를 수행합니다. 업무 후 돈을 내고 보전 1을 얻는 기부가 가능합니다.'],
};
const symbols:Record<ArkActionKind,string>={ANIMALS:'♞',CARDS:'▤',BUILD:'⬡',SPONSORS:'@',ASSOCIATION:'♟'};
export const ARK_ACTION_ART:Record<ArkActionKind,string>={ANIMALS:'animals',CARDS:'cards',BUILD:'build',SPONSORS:'sponsors',ASSOCIATION:'association'};
export function ArkNovaActionGuide({kind,upgraded,strength}:{kind:ArkActionKind;upgraded:boolean;strength:number}){
  const referenceStrength=kind==='ANIMALS'||kind==='CARDS'?Math.min(5,strength):strength;
  return <div className="ark-action-guide">
    <img className={`ark-action-illustration ark-action-illustration-${kind}`} src={`/images/ark-nova/actions/${ARK_ACTION_ART[kind]}-v1.webp`} alt="" loading="lazy" decoding="async" width="768" height="512"/>
    <div className={`ark-action-banner${upgraded?' is-upgraded':''}`}><span aria-hidden="true">{symbols[kind]}</span>{ARK_ACTION_LABELS[kind]} {upgraded?'II':'I'}</div>
    <p className="ark-action-current">현재 행동력 {strength} · {arkActionBenefits(kind,upgraded,strength)}</p>
    <p>{descriptions[kind][upgraded?1:0]}</p>
    <div className="ark-action-reference"><table aria-label={`${ARK_ACTION_LABELS[kind]} ${upgraded?'II':'I'} 행동력별 혜택`}><thead><tr><th scope="col">행동력</th>{[1,2,3,4,5].map(n=><th scope="col" key={n} className={n===referenceStrength?'is-current':''}>{n===5&&(kind==='ANIMALS'||kind==='CARDS')?'5+':n}</th>)}</tr></thead>
      <tbody>{kind==='CARDS'?<>{['가져오기','버리기','낚아채기'].map((label,row)=><tr key={label}><th scope="row">{label}</th>{[1,2,3,4,5].map(n=><td key={n} className={n===referenceStrength?'is-current':''}>{row===0?(upgraded?[1,2,2,3,4]:[1,1,2,2,3])[n-1]:row===1?(upgraded?[0,1,0,1,1]:[1,0,1,0,1])[n-1]:n>=(upgraded?3:5)?'1장':'—'}</td>)}</tr>)}</>:<tr><th scope="row">{kind==='ANIMALS'?'동물 수':kind==='BUILD'?'건설 칸':kind==='SPONSORS'?'등급 / 모금':'업무 강도'}</th>{[1,2,3,4,5].map(n=><td key={n} className={n===referenceStrength?'is-current':''}>{kind==='ANIMALS'?n>=5?2:n>=2?1:0:kind==='SPONSORS'?`${n+Number(upgraded)} / ${n*(upgraded?2:1)}`:n}</td>)}</tr>}</tbody>
    </table></div>
    <small>{kind==='BUILD'||kind==='SPONSORS'||kind==='ASSOCIATION'?'표는 행동력 1–5 기준입니다. X 토큰으로 높인 수치는 위의 현재 혜택에 반영됩니다.':'강조한 열은 현재 행동력 기준입니다.'} 카드 효과·자원·배치 조건은 별도로 적용됩니다. {useContext(ArkNovaMultiplayerContext)?'카드 행동은 휴식 2칸, 모금은 행동력만큼 전진합니다.':'솔로 휴식은 라운드 종료에 진행합니다.'}</small>
  </div>;
}
