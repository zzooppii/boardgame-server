import {ARK_SOLO_ROUND_TURNS,type ArkSoloView} from '@hangul-rummikub/shared';
export function ArkNovaBreakTrack({progress:p}:Pick<ArkSoloView,'progress'>){
  const total=ARK_SOLO_ROUND_TURNS[p.round-1]!,remaining=Math.max(0,total-p.turnInRound);
  const final=p.round===6,done=p.stage==='FINISHED',scoring=p.stage==='FINAL_SCORING',resting=p.stage==='BREAK';
  const label=done?'게임 종료':scoring?'최종 정산 중':resting?'휴식 중':p.stage==='SETUP'?`시작 준비 · 첫 휴식까지 ${total}턴`:remaining===1?`이번 턴 종료 후 ${final?'최종 정산':'휴식'}`:`${final?'최종 정산':'휴식'}까지 ${remaining}턴`;
  return <section className={`ark-break-track ${remaining===1||resting?'is-soon':''}`} aria-label="솔로 휴식 진행판">
    <div className="ark-break-heading"><strong aria-live="polite">{label}</strong><span>{p.round}/6라운드 · {p.turnInRound}/{total}턴 완료</span></div>
    <div className="ark-break-spaces" role="progressbar" aria-label={final?'최종 정산까지 라운드 진행':'휴식까지 라운드 진행'} aria-valuemin={0} aria-valuemax={total} aria-valuenow={p.turnInRound} aria-valuetext={label}>
      {Array.from({length:total},(_,i)=><span key={i} className={i<p.turnInRound?'is-done':i===p.turnInRound&&p.stage==='ACTION'?'is-current':''} aria-hidden="true">{i<p.turnInRound?'✓':i+1}</span>)}<b aria-hidden="true">{final?'🏁':'☕'}</b>
    </div>
    <small>{resting?'손패 정리·직원 복귀·수입 등 남은 휴식 처리를 진행하세요.':final?'마지막 라운드는 휴식 없이 최종 정산합니다.':'솔로는 라운드 종료에 휴식합니다. 한 턴의 행동과 추가 효과를 모두 마치면 1칸 전진합니다.'} · 전체 {p.turnsCompleted}/27턴 완료</small>
  </section>;
}
