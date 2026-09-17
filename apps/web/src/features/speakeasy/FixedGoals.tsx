import type {PlayerId, SpeakeasyFixedGoalView} from '@hangul-rummikub/shared';
import type {SpeakeasyCue} from './sound.js';

const titles = {CRATES:'부두 · 상자',PROTECTED_DISTRICTS:'시청 · 보호 구역',INFAMY:'악명'};
const reasons: Record<SpeakeasyFixedGoalView['status'], string> = {
  READY:'장부 배치 가능', REQUIREMENT:'조건을 더 채워야 합니다', CLAIMED:'이미 달성한 목표입니다',
  FULL:'장부 두 칸이 모두 찼습니다', NO_BOOKS:'사용할 장부가 없습니다',
  BOOK_ACTION_REQUIRED:'레스토랑에서 장부 행동을 선택하세요', ACTION_LIMIT:'이번 행동의 장부 3개를 모두 사용했습니다',
};
export function FixedGoals({goals,viewer,owner,onCue}:{goals:SpeakeasyFixedGoalView[];viewer:PlayerId;owner(id:PlayerId):string;onCue(cue:SpeakeasyCue):void}) {
  return <section className="sp-fixed-goals" aria-label="나의 고정 목표">
    <header><div><p className="sp-eyebrow">COOK THE BOOKS</p><h3>장부로 채우는 금고</h3></div><p>원작 고정 목표 · 조건 안내</p></header>
    <p>목표를 펼쳐 진행 상황과 장부 칸을 확인하세요. 이 미리보기에서는 배치 명령을 보내지 않습니다.</p>
    <div className="sp-fixed-goal-grid">{goals.map(goal=><details key={goal.id} className={`sp-fixed-goal ${goal.status==='CLAIMED'?'is-claimed':''}`} onToggle={event=>{if(event.currentTarget.open)onCue('SELECT');}}>
      <summary><span><strong>{titles[goal.kind]} {goal.minimum}</strong><small>{goal.progress} / {goal.minimum} · {goal.status==='CLAIMED'?'달성 완료':goal.progress>=goal.minimum?'조건 충족':'진행 중'}</small></span><b>금고 +${goal.payout}</b></summary>
      <progress value={Math.min(goal.progress,goal.minimum)} max={goal.minimum} aria-label={`${titles[goal.kind]} 목표 진행 ${goal.progress}/${goal.minimum}`}/>
      <p className="sp-fixed-goal-status">{reasons[goal.status]}</p>
      {goal.kind==='PROTECTED_DISTRICTS'&&<p>보호 건물이 있는 서로 다른 구역을 셉니다.</p>}
      <ol aria-label="장부 칸">{goal.spaces.map((id,i)=><li key={i} className={id===viewer?'is-mine':''}>{i+1}번 · {id?`${owner(id)} 배치됨`:'빈칸'}</li>)}</ol>
      <small>같은 목표에는 내 장부를 한 번만 놓을 수 있습니다.</small>
    </details>)}</div>
  </section>;
}
