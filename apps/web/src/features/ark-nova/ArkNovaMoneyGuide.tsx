import type {ArkSoloView} from '@hangul-rummikub/shared';
import {arkDisplayedStrength} from './action-controls.js';

/** Display-only income guidance. Additional break effects are not included in appeal income. */
export function ArkNovaMoneyGuide({state:s,x,canFundraise}:{state:ArkSoloView;x:number;canFundraise:boolean}) {
  if(s.phase==='FINISHED'||s.progress.stage==='SETUP'||s.progress.stage==='FINAL_SCORING')return null;
  const upgraded=s.actions.some(a=>a.kind==='SPONSORS'&&a.upgraded);
  const strength=arkDisplayedStrength(s,'SPONSORS',x),amount=strength*(upgraded?2:1);
  const income=s.scoreBoard?.appealIncome[s.appeal];
  const available=canFundraise&&strength>0;
  return <details className="ark-money-guide"><summary>돈 버는 방법{available?` · 모금으로 돈 ${amount}`:''}</summary>
    <h3>지금 돈이 필요하면 모금</h3>
    <p>후원자 카드를 사용하는 대신 모금할 수 있습니다. 돈이나 손패가 없어도 가능하며, 후원자 행동을 사용합니다.</p>
    <p>후원자 {upgraded?'II':'I'} · 행동력 {strength} · X 토큰 {x}개 추가 기준 · 모금 돈 {amount}</p>
    {available?<a href="#ark-sponsors-action" onClick={()=>document.getElementById('ark-sponsors-action')?.focus()}>후원자 행동에서 모금 선택 ↓</a>:<p>현재 행동·효과·휴식 처리를 마친 뒤, 후원자 행동을 선택할 수 있을 때 모금하세요.</p>}
    <h3>휴식 때 받는 수입</h3>
    {s.progress.round===6?<p>6라운드는 휴식 없이 최종 정산하므로, 이번 라운드가 끝나도 휴식 수입을 받지 않습니다.</p>:<p>{income===undefined?'매력 수입은 전체 점수판에서 확인할 수 있습니다.':`현재 매력 ${s.appeal}의 기본 휴식 수입은 돈 ${income}입니다.`} 매점·후원자·활성화한 지도 보너스의 추가 수입은 별도입니다. 휴식 전 매력이 바뀌면 수입도 달라집니다.</p>}
    <h3>X 토큰은 돈이 아닙니다</h3>
    <p>‘X 토큰 받기’는 행동력과 관계없이 1개를 받습니다(최대 5개). 다음 행동을 시작하기 전에 토큰 1개당 행동력을 1 높일 수 있습니다. 모금에도 사용할 수 있습니다.</p>
  </details>;
}
