import type { SpiritProjection } from '@hangul-rummikub/shared';
import { victoryGoal } from './presentation.js';

export function FearPanel({ game: g }: { game: SpiritProjection }) {
 const goal = victoryGoal(g);
 const ritual = g.settings.scenario === 'RITUAL';
 const nextRound = ['RAVAGE', 'BUILD', 'EXPLORE', 'SLOW', 'TIME'].includes(g.stage);
 const fearLog = g.log.filter(entry => entry.kind === 'FEAR');
 const latestCard = fearLog.filter(entry=>entry.text.includes(' · 공포 카드 ')).at(-1);
 const recent = fearLog.filter(entry=>!entry.text.includes(' · 공포 카드 ')).slice(-3);
 return <section id="si-fear-status" className="si-fear-panel" aria-label="공포 축적과 카드 실행 안내">
  <div className="si-fear-progress">
   <h2>공포 모으기 <strong>{g.fear} / {g.fearPool}</strong></h2>
   <progress aria-label="다음 공포 카드까지 모은 공포" max={g.fearPool} value={g.fear}/>
   <div className="si-fear-tokens" aria-hidden="true">{Array.from({ length:g.fearPool },(_,i)=><span key={i} className={i<g.fear?'si-fear-filled':''}/>)}</div>
   <p>{g.terror===4 ? '공포 덱을 모두 획득했습니다.' : <>공포 <b>{Math.max(0,g.fearPool-g.fear)}개</b> 더 모으면 공포 카드 <b>1장 획득</b></>}</p>
   <small>{g.fearPool}개를 채울 때마다 카드 1장을 얻고, 남은 공포는 다음 카드에 이어집니다.</small>
  </div>
  <div className="si-fear-earned" aria-live="polite" aria-atomic="true">
   <h3>획득한 공포 카드 · 해결 대기 <strong>{g.earnedFearCount}장</strong></h3>
   <p>{ritual ? '공포의 의식 시나리오에서는 공포 카드 효과를 실행하지 않습니다.' : g.stage==='FEAR' ? '지금은 공포 단계입니다. 대기 카드를 순서대로 해결합니다. 현재 해결 중인 카드는 대기 장수에서 빠집니다.' : <>획득 즉시 효과가 실행되지는 않습니다. <b>{nextRound?'다음 라운드':'이번 라운드'} 공포 단계</b>에 실행됩니다.</>}</p>
   {!ritual ? <p className="si-fear-timing">빠른 능력 → <b>공포 카드 실행</b> → 파괴{g.settings.expansion==='BRANCH_CLAW'?' · 확장판은 공포 카드 전에 이벤트를 해결합니다.':''}</p> : null}
   <small>공포 수치가 0으로 돌아가도 획득한 카드는 사라지지 않습니다.</small>
  </div>
  <div className="si-fear-victory">
   <h3>현재 승리 목표 · {g.terror===4?'최종 공포 단계':`공포 수준 ${g.terror}`}</h3>
   <p aria-live="polite"><strong>{goal[0]}</strong> · {goal[1]}</p>
   <details><summary>공포 수준이 오르면 어떻게 이기나요?</summary>
    <ol>
     <li>I · 탐험가·마을·도시 모두 제거</li>
     <li>II · 마을·도시만 제거 (기본 구성 누적 3장 획득)</li>
     <li>III · 도시만 제거 (기본 구성 누적 6장 획득)</li>
     <li>마지막 카드 획득 · 침략자가 남아 있어도 승리 (기본 구성 누적 9장)</li>
    </ol>
    <p>카드를 획득해 수준 구분선이 드러나면 즉시 수준이 올라갑니다. 효과 해결까지 기다리지 않습니다. 공포 카드 효과는 해결할 때의 수준을 사용합니다.</p>
    <small>위 순서는 기본 승리 조건입니다. 대적·이벤트에 따라 카드 장수가 달라지고, 시나리오는 수준 상승 방식이나 승리 조건을 바꿀 수 있습니다.</small>
   </details>
  </div>
  {latestCard ? <article className="si-fear-effect" aria-label="최근 공포 카드 효과" aria-live="polite"><h3>최근 공포 카드 효과</h3><p>{latestCard.text}</p><small>해결 대기 0장은 남은 카드가 없다는 뜻입니다. 지난 라운드의 기록은 현재 적용 중인 효과와 다를 수 있습니다.</small></article> : null}
  <div className="si-fear-history"><h3>최근 공포 기록</h3>{recent.length ? <ol>{recent.map(e=><li key={e.id}>{e.text}</li>)}</ol> : <p>능력 효과나 마을·도시 파괴로 공포를 얻으면 여기에 표시됩니다.</p>}</div>
 </section>;
}
