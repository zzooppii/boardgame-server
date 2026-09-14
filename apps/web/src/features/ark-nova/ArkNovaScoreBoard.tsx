import {useEffect,useId,useRef,useState} from 'react';
import {ArkNovaScoreTrack} from './ArkNovaScoreTrack.js';
import {ARK_ACTION_LABELS, type ArkSoloView} from '@hangul-rummikub/shared';

const rewards=[{score:2,label:'행동 업그레이드 / 직원 1명'}, {score:5,label:'보너스 타일 / 돈 5'},
  {score:8,label:'보너스 타일 / 돈 5'}, {score:10,label:'목표 카드 1장 버리기'}] as const;
const bonusLabels:Readonly<Record<string,string>>={WORKER:'직원 1명',MONEY_5:'돈 5',DISCARD_GOAL:'목표 1장 정리',...Object.fromEntries(Object.entries(ARK_ACTION_LABELS).map(([key,label])=>[`UPGRADE_${key}`,`${label} II`])),REPUTATION_2:'평판 2',X_3:'X 토큰 3',ENCLOSURE_3:'무료 3칸 우리',CARDS_3:'카드 3장',MONEY_10:'돈 10',MULTIPLIER:'배수 토큰',UNIVERSITY:'대학',PARTNER:'제휴 동물원',PAID_SPONSOR:'후원자 사용 (비용 지불)'};
/** Same horizontal coordinate for both markers; conservation spaces widen after 10.
 * Score comparison and pending choices come from the server, never from client commands.
 */
type ScoreState=Pick<ArkSoloView,'appeal'|'conservation'|'scoreBoard'|'result'>;
export function ArkNovaScoreBoardDetail({state:s,onNavigate}:{state:ScoreState;onNavigate?:()=>void}) {
  const board=s.scoreBoard;
  const next=rewards.find(r=>r.score>s.conservation);
  return <section className="ark-score-board" aria-label="매력·보전 점수판">
    <header><div><small>ZOO PROGRESS</small><h2>매력과 보전</h2></div><div className="ark-score-summary" role="status" aria-live="polite" aria-atomic="true">
      <strong>매력 {s.appeal} · 보전 {s.conservation}</strong>
      <span>{s.result?`최종 확정 ${s.result.total}점`:board?board.gap<0?`교차까지 매력 ${-board.gap}점 거리`:`두 마커 교차 · 현재 거리 +${board.gap}`:'점수판 상세 정보 연결 대기'}</span>
    </div></header>
    {board&&<div className="ark-score-scroll" tabIndex={0} role="region" aria-label="네 줄로 이어진 매력 티켓과 보전 방패 점수 트랙">
      <ArkNovaScoreTrack appeal={s.appeal} conservation={s.conservation} board={board}/>
    </div>}
    {board&&<p className="ark-score-note">매력에 따른 휴식 수입 <b>돈 {board.appealIncome[s.appeal]}</b> · 매점·후원자 등의 추가 수입은 별도입니다.</p>}
    <p className="ark-score-note">{s.result?'목표·후원자 정산을 포함한 최종 점수입니다.':'현재 거리는 최종 목표·후원자 정산 전 수치입니다. 솔로는 교차해도 6라운드 끝까지 진행합니다.'}</p>
    <div className="ark-score-next"><strong>다음 보전 보상</strong><span>{next?`${next.score}점까지 보전 ${next.score-s.conservation}점 필요`:'보전 10점 기준점까지 모두 도달'}</span></div>
    <div className="ark-score-rewards">{rewards.map(r=>{
      const pending=board?.pendingMilestones.includes(r.score)??false;
      const reached=s.conservation>=r.score;
      const receipt=board?.choices.find(c=>c.track===r.score);
      return <article key={r.score} className={pending?'is-pending':reached?'is-reached':''}>
        <div className="ark-score-reward-heading"><b>보전 {r.score}</b><span>{pending?'선택 대기':receipt?'선택 완료':reached?'도달':`${r.score-s.conservation}점 남음`}</span></div>
        <strong>{r.label}</strong>
        {receipt&&<p>선택한 보상: {bonusLabels[receipt.choice]??receipt.choice}</p>}
        {(r.score===5||r.score===8)&&<p>{board?`남은 타일: ${board.bonuses.filter(b=>b.track===r.score).map(b=>bonusLabels[b.tile]??b.tile).join(' · ')||'없음'} · 돈 5 선택 가능`:'배치된 타일 정보 연결 대기'}</p>}
        {r.score===10&&<p>목표가 2장 이상일 때 1장을 버립니다.</p>}
        {pending&&<a href="#ark-current-action" onClick={onNavigate}>현재 보상 선택으로 이동 ↓</a>}
      </article>;
    })}</div>
    <small>도달 표시는 보상 수령 기록이 아닙니다. 보상 선택과 후속 효과는 현재 행동 영역에서 처리합니다.</small>
  </section>;
}


/** The full board is opt-in; the native modal handles focus trapping and Escape. */
export function ArkNovaScoreBoard({state:s}:{state:ScoreState}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const id=useId();
  const [open,setOpen]=useState(false);
  const board=s.scoreBoard,next=rewards.find(r=>r.score>s.conservation);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  const close=()=>dialog.current?.close();
  return <>
    <button type="button" className="ark-score-peek" aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      onClick={()=>{dialog.current?.showModal();setOpen(true);}}>
      <span className="ark-score-peek-values"><strong>매력 {s.appeal}</strong><strong>보전 {s.conservation}</strong></span>
      <span className="ark-score-peek-detail">
        <span>{s.result?`최종 ${s.result.total}점`:board?board.gap<0?`교차까지 ${-board.gap}점`:`교차 · +${board.gap}점`:'상세 정보 연결 대기'}</span>
        <small>{board?.pendingMilestones.length?`보상 선택 대기 ${board.pendingMilestones.length}건`:next?`다음 보상까지 보전 ${next.score-s.conservation}점`:'보전 10점 도달'}</small>
      </span>
      <span className="ark-score-peek-open">전체 점수판 보기 ↗</span>
    </button>
    <dialog ref={dialog} id={id} className="ark-dialog ark-score-dialog" aria-label="전체 매력·보전 점수판"
      onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)close();}}>
      <div className="ark-score-dialog-toolbar"><strong>매력·보전 점수판</strong><button type="button" onClick={close} aria-label="점수판 닫기">닫기 ×</button></div>
      <ArkNovaScoreBoardDetail state={s} onNavigate={close}/>
    </dialog>
  </>;
}
