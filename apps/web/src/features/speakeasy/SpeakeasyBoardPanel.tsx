import {useRef,useState,type KeyboardEvent} from 'react';
import {SPEAKEASY_BUILDING_LABELS,SPEAKEASY_OPERATION_LABELS,type SpeakeasyBoardView,type PlayerId} from '@hangul-rummikub/shared';
import {SpeakeasyBuildingArt,SpeakeasyToken} from './art.js';
import {speakeasyBoardFocus,SPEAKEASY_STAGE_LABELS} from './board-view.js';
import {FixedGoals} from './FixedGoals.js';
import type {SpeakeasyCue} from './sound.js';

type Props={view:SpeakeasyBoardView;onCue(cue:SpeakeasyCue):void};
export function SpeakeasyBoardPanel(props:Props) {
  // Changing recipient/game clears private reveal and inspection state.
  return <BoardContents key={`${props.view.turn.gameId}:${props.view.turn.viewerId}`} {...props}/>;
}
function BoardContents({view,onCue}:Props) {
  const [selected,setSelected]=useState<number|null>(null),[safeVisible,setSafeVisible]=useState(false);
  const grid=useRef<HTMLDivElement>(null),detail=useRef<HTMLElement>(null),t=view.turn;
  const owner=(id:PlayerId)=>id===t.viewerId?'나':`패밀리 ${t.order.indexOf(id)+1}`;
  const district=view.districts.find(d=>d.id===selected);
  function keyboard(event:KeyboardEvent<HTMLButtonElement>,id:number) {
    if(!event.key.startsWith('Arrow'))return;
    event.preventDefault();
    const columns=grid.current&&getComputedStyle(grid.current).getPropertyValue('--sp-snapshot-columns').trim()==='2'?2:4;
    let next=speakeasyBoardFocus(id,event.key,columns);
    while(next!==null&&view.districts[next-1]?.blocked) next=speakeasyBoardFocus(next,event.key,columns);
    if(next!==null)grid.current?.querySelector<HTMLButtonElement>(`[data-snapshot-district="${next}"]`)?.focus();
  }
  return <section className="sp-snapshot" aria-label="지도와 개인 경영판" onKeyDown={event=>{if(event.key==='Escape'){setSelected(null);onCue('CANCEL');}}}>
    <header className="sp-snapshot-heading"><div><p className="sp-eyebrow">YOUR EMPIRE · AT A GLANCE</p><h2>한눈에 보는 나의 사업</h2><p>고정 예시 · 구역 배치는 경로 지도가 아닙니다. 구역을 눌러 상태를 살펴보세요.</p></div><div className="sp-snapshot-phase"><span>{t.act}막 · {t.round}라운드</span><strong>{SPEAKEASY_STAGE_LABELS[t.stage]}</strong><span>{t.actorId?`${owner(t.actorId)}의 차례`:'정산 진행'}</span></div></header>
    <div className="sp-snapshot-grid"><div>
      <div className="sp-snapshot-map" ref={grid} role="group" aria-label="구역 상태 지도">{view.districts.map(d=><button type="button" key={d.id} data-snapshot-district={d.id} disabled={d.blocked} aria-pressed={selected===d.id} aria-label={`${d.id}구역${d.blocked?' · 사용하지 않음':''}${d.cop?' · 경찰':''} · 상세 보기`} onKeyDown={e=>keyboard(e,d.id)} onClick={()=>{setSelected(d.id);onCue('SELECT');}}>
        <span className="sp-snapshot-district-head"><strong>{String(d.id).padStart(2,'0')}</strong><span>{d.cop?'경찰':d.id<=6?'다운타운':d.id<=12?'미드타운':'업타운'}</span></span>
        <span className="sp-snapshot-lots">{d.slots.map((b,i)=><span key={i} className={`sp-snapshot-lot ${b?`sp-owner-${t.order.indexOf(b.ownerId)}`:''} ${b&&!b.operating?'is-closed':''}`}>
          {b?<><SpeakeasyBuildingArt kind={b.kind}/><span>{owner(b.ownerId)} · {SPEAKEASY_BUILDING_LABELS[b.kind]}</span><small>{b.protected?'보호 ':''}{b.barrel?'주류 ':''}{b.operating?'영업':'영업 중단'}</small></>:<><span className="sp-snapshot-empty">{d.blocked?'—':d.mobsterSlots.some(slot=>slot===i)?'♟':'+'}</span><small>{d.blocked?'사용 안 함':d.mobsterSlots.some(slot=>slot===i)?`마피아 ${d.mobsterStrength}`:'빈칸'}</small></>}
        </span>)}</span>
        {view.trucks.filter(truck=>truck.district===d.id).map(truck=><span className="sp-snapshot-truck" key={truck.tileId}><SpeakeasyToken kind="TRUCK"/>{owner(truck.ownerId)} · 주류 {truck.load}/2</span>)}
      </button>)}</div>
      <p className="sp-rule-note">방향키로 구역 이동 · Enter/Space로 상세 보기 · Escape로 선택 취소</p>
      <aside className="sp-snapshot-inspector" ref={detail} tabIndex={-1} aria-label="선택한 구역 정보" aria-live="polite" aria-atomic="true"><h3>{district?`${district.id}구역 살펴보기`:'살펴볼 구역을 선택하세요'}</h3>{district?<><p>{district.cop?'경찰이 진입한 구역입니다.':'경찰이 없는 구역입니다.'}</p>{district.slots.map((b,i)=><p key={i}>{i+1}번 칸 · {b?`${owner(b.ownerId)}의 ${SPEAKEASY_BUILDING_LABELS[b.kind]} · ${b.protected?'보호 중':'보호 없음'} · ${b.barrel?'주류 있음':'주류 없음'} · ${b.operating?'영업 중':'영업 중단'}`:district.mobsterSlots.some(slot=>slot===i)?`마피아 · 세력 ${district.mobsterStrength}`:'빈 건물 칸'}</p>)}</>:<p>건물 칸의 위치와 보호·주류·영업 상태를 확인할 수 있습니다.</p>}</aside>
    </div><aside className="sp-snapshot-personal" aria-label="내 경영판">
      <p className="sp-eyebrow">PRIVATE LEDGER</p><h3>내 경영판</h3>
      <div className="sp-snapshot-money"><div><span>현금</span><strong>${t.self.cash}</strong></div><div><span>금고 · 나만 보기</span><strong>{safeVisible?`$${t.self.safe}`:'•••'}</strong><button type="button" aria-pressed={safeVisible} onClick={()=>{setSafeVisible(!safeVisible);onCue('SELECT');}}>{safeVisible?'금고 가리기':'금고 보기'}</button></div></div>
      <h4>운영 수준</h4><dl className="sp-snapshot-levels">{(['VIP','PARTY','STILLS','FLEET','STRENGTH'] as const).map(key=><div key={key}><dt>{SPEAKEASY_OPERATION_LABELS[key]}</dt><dd>{view.self.levels[key]}<span aria-hidden="true">{'●'.repeat(view.self.levels[key])}{'○'.repeat(5-view.self.levels[key])}</span></dd></div>)}</dl>
      <h4>나의 자원</h4><div className="sp-snapshot-resources"><span>VIP 패밀리 <strong>{view.self.vip}</strong></span><span>부하 <strong>{view.self.goons}</strong></span><span>저장 주류 <strong>{view.self.stock.length}</strong></span><span>장부 <strong>{view.self.books}</strong></span><span>도시 타일 <strong>{t.self.cityTiles.length}</strong></span><span>남은 카포 <strong>{t.self.availableCapos.length}</strong></span></div>
      <h4>내 손패 · {t.self.hand.length}장</h4><div className="sp-snapshot-hand">{t.self.hand.map((card,i)=><div key={card.tileId}><span>카드 {i+1}</span><strong>{SPEAKEASY_OPERATION_LABELS[card.operation]}</strong><small>영향력 {card.leverage}</small></div>)}</div>
      <h4>설치한 운영 카드</h4>{view.self.operations.map(card=><p className="sp-snapshot-installed" key={card.tileId}>{SPEAKEASY_OPERATION_LABELS[card.operation]} · 영향력 {card.leverage}</p>)}
      <h4>공개 배치</h4><p>내 부두 {view.docks.filter(d=>d.ownerId===t.viewerId).length}곳 · 내 장부 배치 {view.placedBooks.filter(b=>b.ownerId===t.viewerId).length}곳</p>
      <p className="sp-rule-note">온라인 대국 연결 전의 화면 예시입니다. 카포 배치·카드 사용 명령은 전송하지 않습니다.</p>
    </aside></div>
    <FixedGoals goals={view.self.fixedGoals} viewer={t.viewerId} owner={owner} onCue={onCue}/>
    {selected!==null&&<button type="button" className="sp-mobile-review" onClick={()=>{detail.current?.scrollIntoView({block:'start'});detail.current?.focus({preventScroll:true});}}>{selected}구역 상세 보기 ↓</button>}
    {view.result&&<section className="sp-snapshot-result"><h3>최종 결과</h3><p>승자 · {view.result.winners.map(owner).join(', ')}</p>{view.result.scores.map(score=><p key={score.playerId}>{owner(score.playerId)} · ${score.total} · 건물 ${score.buildingMoney} · 도우미 ${score.helperMoney}</p>)}</section>}
  </section>;
}
