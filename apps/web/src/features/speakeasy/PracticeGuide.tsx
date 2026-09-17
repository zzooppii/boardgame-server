import type {SpeakeasyPracticeAction, SpeakeasyPracticeView} from '@hangul-rummikub/shared';
import {SpeakeasyToken} from './art.js';
import {practiceFlowHint} from './practice-guide.js';

const steps = [
  {type: 'PRODUCE', title: '생산', token: 'BARREL', text: '증류소에서 주류를 만들어 저장합니다.'},
  {type: 'DELIVER', title: '운송', token: 'TRUCK', text: '주류를 트럭에 싣고 빈 주점에 배달합니다.'},
  {type: 'SELL', title: '판매', token: null, text: '건물의 주류를 판매해 현금을 얻습니다.'},
] as const;

export function PracticeGuide({view, busy, onOpen}: {
  view: SpeakeasyPracticeView;
  busy: boolean;
  onOpen(type: SpeakeasyPracticeAction['type']): void;
}) {
  const hint = practiceFlowHint(view);
  if (view.finished) return null;
  return <details className="sp-practice-guide" open>
    <summary>플레이 길잡이 · 생산 → 운송 → 판매</summary>
    <p>수익을 만드는 세 단계입니다. 차례를 나누어 진행해도 주류와 트럭 위치는 유지됩니다.</p>
    <ol>{steps.map((step, index) => {
      const count = view.choices.filter(c => c.action.type === step.type).length;
      return <li key={step.type} className={hint.type === step.type ? 'is-next' : ''}>
        <div>{step.token ? <SpeakeasyToken kind={step.token}/> : <span className="sp-practice-guide-money" aria-hidden="true">$</span>}<strong>{index + 1}. {step.title}</strong></div>
        <p>{step.text}</p>
        <button type="button" disabled={busy || count === 0} onClick={() => onOpen(step.type)}>
          {step.title} {count ? `선택하기 · ${count}개 가능` : '· 지금은 선택 없음'}
        </button>
      </li>;
    })}</ol>
    <p className="sp-practice-guide-hint">{hint.text}</p>
    {hint.type === 'END_TURN' && <button type="button" disabled={busy} onClick={() => onOpen('END_TURN')}>다음 턴으로 이어가기</button>}
    <small>길잡이 버튼은 선택 화면을 엽니다. 행동은 비용과 결과를 확인하고 확정하세요.</small>
  </details>;
}
