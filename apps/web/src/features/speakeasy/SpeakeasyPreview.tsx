import {SpeakeasyPractice} from './SpeakeasyPractice.js';
import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {SPEAKEASY_BUILDING_LABELS, SPEAKEASY_OPERATION_LABELS, type SpeakeasyOperation} from '@hangul-rummikub/shared';
import {SpeakeasyBuildingArt, SpeakeasyToken} from './art.js';
import {SPEAKEASY_PREVIEW_SCENES, speakeasyPreviewBuildings, speakeasyPreviewOperating, speakeasyDistrictFocus} from './preview-scenes.js';
import {useSpeakeasyAudio} from './sound.js';
import './speakeasy.css';
import './practice.css';
import {SpeakeasyCityPreview} from './SpeakeasyCityPreview.js';
import {SpeakeasyBoardPanel} from './SpeakeasyBoardPanel.js';
import {createSpeakeasyBoardPreview} from './board-preview.js';
import {readSpeakeasyBoardView} from './board-view.js';

const names = ['나', '노랑 패밀리', '보라 패밀리'];
const zones = [{name: '다운타운', english: 'DOWNTOWN', from: 1, to: 6}, {name: '미드타운', english: 'MIDTOWN', from: 7, to: 12}, {name: '업타운', english: 'UPTOWN', from: 13, to: 16}];
const operations: readonly SpeakeasyOperation[] = ['VIP', 'PARTY', 'STILLS', 'FLEET', 'STRENGTH'];

/** Entry point opens a server-authoritative training match; legacy guided scenes remain separate. */
export default function SpeakeasyPreview({onExit}: {onExit(): void}) {
  const [mode, setMode] = useState<'SCENES'|'CITY'|'BOARD'|'PRACTICE'>('PRACTICE');
  const [boardPreview] = useState(()=>readSpeakeasyBoardView(createSpeakeasyBoardPreview(),'speakeasy-board-preview','sp-player-a'));
  const [sceneIndex, setSceneIndex] = useState(0), [selected, setSelected] = useState<number | null>(null), [applied, setApplied] = useState(false);
  const [help, setHelp] = useState(false), [showSafe, setShowSafe] = useState(false), [mobileTab, setMobileTab] = useState<'MAP' | 'PLAYER'>('MAP');
  const [zoom, setZoom] = useState(false), [status, setStatus] = useState(''), audio = useSpeakeasyAudio();
  const board = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const action = useRef<HTMLElement>(null);
  const interactionRevision = useRef(0);
  const scene = SPEAKEASY_PREVIEW_SCENES[sceneIndex]!, buildings = speakeasyPreviewBuildings(scene, applied);
  const chosen = buildings.filter(b => b.district === selected);
  const targetSelected = selected === scene.target && !applied;
  useEffect(() => {heading.current?.focus();}, []);

  function chooseDistrict(district: number) {interactionRevision.current++; setSelected(district); audio.play('SELECT');}
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, district: number) {
    if (event.key === 'Escape') {interactionRevision.current++; setSelected(null); audio.play('CANCEL'); return;}
    const next = speakeasyDistrictFocus(district, event.key);
    if (event.key.startsWith('Arrow')) event.preventDefault();
    if (next !== null) {
      board.current?.querySelector<HTMLButtonElement>(`[data-district="${next}"]`)?.focus();
    }
  }
  function changeScene(index: number) {setMode('SCENES');interactionRevision.current++; setSceneIndex(index); setSelected(null); setApplied(false); setStatus(''); audio.play('SELECT');}
  async function applyScene() {
    if (!targetSelected) return;
    const revision = interactionRevision.current;
    await audio.unlock();
    if (revision !== interactionRevision.current) return;
    interactionRevision.current++; audio.play(scene.cue); setApplied(true); setStatus(scene.after);
  }
  if(mode==='PRACTICE')return <SpeakeasyPractice onExit={onExit} onPreview={()=>{setMode('BOARD');void audio.unlock();}}/>;
  const completed = applied ? scene.after : scene.before;
  return <main className="sp-root" onPointerDown={() => void audio.unlock()} onKeyDown={() => void audio.unlock()}>
    <header className="sp-header"><button type="button" className="sp-back" onClick={onExit}>← 게임 목록</button><div className="sp-wordmark">SPEAKEASY<span>MANHATTAN · 1920</span></div><span className="sp-preview-tag">개발 미리보기</span></header>
    <section className="sp-hero">
      <img src="/images/speakeasy/jazz-club.png" width="1536" height="1024" alt="1920년대 맨해튼의 창밖 야경과 재즈 주점"/>
      <div className="sp-hero-copy"><p className="sp-eyebrow">A CITY AFTER DARK</p><h1 ref={heading} tabIndex={-1}>도시가 잠들면,<br/>당신의 밤이 시작됩니다.</h1><p>주점을 열고, 주류를 나르고, 사업을 지키세요.</p><span>2–4인 기본판 개발 중 · 아래는 고정 예시의 화면·음향 체험입니다.</span></div>
    </section>
    <div className="sp-timeline"><div><span className="sp-live-dot"/> 상호작용 체험 <strong>{mode === 'BOARD' ? '지도·개인판' : mode === 'CITY' ? '도시 타일' : `${sceneIndex + 1} / ${SPEAKEASY_PREVIEW_SCENES.length}`}</strong></div><span>선택하고 · 검토하고 · 확정하기</span><button type="button" onClick={() => setHelp(!help)} aria-expanded={help} aria-controls="sp-help">{help ? '도움말 닫기' : '게임과 조작 안내'}</button></div>
    {help && <section id="sp-help" className="sp-help"><h2>사업의 흐름을 눈으로 읽는 보드</h2><div><p><strong>지도</strong> 건물 모양과 패밀리 색으로 소유권을, 주류통과 사람으로 재고와 보호를 읽습니다. 경찰이 있는 12구역은 보호 전후의 차이를 보여줍니다.</p><p><strong>선택과 확정</strong> 구역을 누르면 오른쪽에서 정보를 확인할 수 있습니다. 강조된 구역을 선택한 뒤 연출 버튼으로 적용 전후를 비교하세요. 방향키로 구역 이동, Enter로 선택, Escape로 취소할 수 있습니다.</p><p><strong>원작 규칙 확인 중</strong> 최신 규칙서의 판정 원칙을 구현하고 있습니다. 전체 카드·타일의 개별 값 확인과 온라인 진행 연결은 남아 있습니다. 이 화면은 실제 대국이나 솔로 모드가 아닙니다.</p></div></section>}
    <nav className="sp-scene-tabs" aria-label="체험할 행동">{SPEAKEASY_PREVIEW_SCENES.map((s, i) => <button key={s.id} type="button" aria-pressed={mode === 'SCENES' && sceneIndex === i} onClick={() => changeScene(i)}><span>{String(i + 1).padStart(2, '0')}</span>{s.label}</button>)}<button type="button" aria-pressed={mode === 'CITY'} onClick={()=>{interactionRevision.current++;setMode('CITY');audio.play('SELECT');}}>도시 타일</button><button type="button" aria-pressed={mode === 'BOARD'} onClick={()=>{interactionRevision.current++;setMode('BOARD');audio.play('SELECT');}}>지도·개인판</button></nav>
    {mode === 'BOARD' ? (boardPreview?<SpeakeasyBoardPanel view={boardPreview} onCue={audio.play}/>:<p role="alert">화면 데이터를 확인할 수 없습니다.</p>) : mode === 'CITY' ? <SpeakeasyCityPreview audio={audio}/> : <><div className="sp-layout">
      <section className="sp-table-column">
        <div className="sp-players" aria-label="예시 패밀리">{names.map((name, i) => <div key={name} className={`sp-player sp-owner-${i}`}><span className="sp-family-symbol">{['●', '◆', '▲'][i]}</span><div><strong>{name}</strong><small>{i === 0 ? '청록 패밀리' : '다른 패밀리'}</small></div><span className="sp-wallet">{i === 0 ? '내 경영판 ↓' : '금고 비공개'}</span></div>)}</div>
        <nav className="sp-mobile-nav" aria-label="화면 영역"><button type="button" aria-pressed={mobileTab === 'MAP'} onClick={() => setMobileTab('MAP')}>도시 지도</button><button type="button" aria-pressed={mobileTab === 'PLAYER'} onClick={() => setMobileTab('PLAYER')}>내 경영판</button></nav>
        <div className={`sp-map-section ${mobileTab === 'MAP' ? 'sp-mobile-active' : ''}`}>
          <div className="sp-board-heading"><div><p className="sp-eyebrow">THE ISLAND OF MANHATTAN</p><h2>밤의 도시</h2></div><div><span>구역 개요 · 경로 지도 아님</span><button type="button" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>{zoom ? '전체 보기' : '지도 확대'}</button></div></div>
          <div className={`sp-map-scroll ${zoom ? 'is-zoomed' : ''}`}>
            <div className="sp-map" ref={board} role="group" aria-label="맨해튼 16개 구역">
              <div className="sp-watermark" aria-hidden="true">H U D S O N　 R I V E R</div>
              <div className="sp-zones">{zones.map((zone, z) => <section className="sp-zone" key={zone.name}><header><span>{zone.english}</span><h3>{zone.name}</h3></header><div className="sp-district-grid">
                {Array.from({length: zone.to - zone.from + 1}, (_, index) => zone.from + index).map(district => {
                  const pieces = buildings.filter(b => b.district === district), target = district === scene.target;
                  const label = `${district}구역${district === 12 ? ' · 경찰' : ''} · ${pieces.length ? pieces.map(b => `${names[b.owner]} ${SPEAKEASY_BUILDING_LABELS[b.kind]}${b.protected ? ' 보호됨' : ''}${b.barrel ? ' 주류 있음' : ''}`).join(', ') : '빈 건물 칸'}`;
                  return <button type="button" key={district} data-district={district} aria-label={label} aria-pressed={selected === district}
                    className={`sp-district ${target && !applied ? 'is-target' : ''} ${selected === district ? 'is-selected' : ''} ${target && applied ? 'is-changed' : ''}`}
                    onClick={() => chooseDistrict(district)} onKeyDown={event => keyboard(event, district)}>
                    <span className="sp-district-number">{String(district).padStart(2, '0')}</span>
                    {district === 12 && <span className="sp-cop-marker"><SpeakeasyToken kind="COP"/><span>경찰</span></span>}
                    <span className="sp-building-lots">{Array.from({length: z === 2 ? 3 : 2}, (_, slot) => {
                      const b = pieces.find(b => b.slot === slot);
                      return <span key={slot} className={`sp-lot ${b ? `sp-owner-${b.owner} ${speakeasyPreviewOperating(b) ? '' : 'is-closed'}` : 'is-empty'}`}>
                        {b ? <><SpeakeasyBuildingArt kind={b.kind}/><span className="sp-piece-label">{SPEAKEASY_BUILDING_LABELS[b.kind]}</span><span className="sp-piece-tokens">{b.protected && <SpeakeasyToken kind="FAMILY"/>}{b.barrel && <SpeakeasyToken kind="BARREL"/>}</span></> : <span className="sp-empty-lot" aria-hidden="true">＋</span>}
                      </span>;
                    })}</span>
                    {target && !applied && <span className="sp-target-label">{selected === district ? '선택됨' : '체험 대상'}</span>}
                    {target && applied && <span className="sp-target-label is-done">✓ {scene.label}</span>}
                  </button>;
                })}
              </div></section>)}</div>
              <div className="sp-central-park"><span aria-hidden="true">❧</span> CENTRAL PARK <span>공개 목표와 장부</span><SpeakeasyToken kind="BOOK"/></div>
              {applied && scene.id === 'deliver' && <div className="sp-delivery-arrival" aria-hidden="true"><SpeakeasyToken kind="TRUCK"/>배달 도착</div>}
            </div>
          </div>
          <div className="sp-map-legend"><span><SpeakeasyToken kind="FAMILY"/>건물 보호</span><span><SpeakeasyToken kind="BARREL"/>주류 1개</span><span><SpeakeasyToken kind="COP"/>경찰</span><span>빗금 · 영업 중단</span></div>
        </div>
        <section className={`sp-operations-section ${mobileTab === 'PLAYER' ? 'sp-mobile-active' : ''}`} aria-label="내 경영판 예시">
          <header><div><p className="sp-eyebrow">YOUR FAMILY BUSINESS</p><h2>내 경영판</h2></div><span className="sp-example-label">예시 상태</span></header>
          <div className="sp-finances"><div><small>사용할 현금</small><strong>$15</strong></div><div><small>나만 보는 금고</small><button type="button" aria-pressed={showSafe} aria-label={showSafe ? '금고 금액 숨기기' : '금고 금액 보기'} onClick={() => {setShowSafe(!showSafe); audio.play('SELECT');}}>{showSafe ? '$30' : '•••'} <span>{showSafe ? '숨기기' : '보기'}</span></button></div><div><small>남은 카포</small><strong>2 <span>/ 3</span></strong></div></div>
          <div className="sp-operation-tracks">{operations.map((op, i) => <div key={op} className={`sp-operation sp-op-${op.toLowerCase()}`}><span>{SPEAKEASY_OPERATION_LABELS[op]}</span><div aria-label={`${SPEAKEASY_OPERATION_LABELS[op]} 수준 ${[2, 2, 2, 3, 2][i]}`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n === [2, 2, 2, 3, 2][i] ? 'is-current' : ''}>{n}</span>)}</div></div>)}</div>
          <p className="sp-operations-note">현금과 금고를 구분합니다. 금고에서 비용 $1을 지불하려면 $2가 필요합니다.</p>
        </section>
      </section>
      <aside ref={action} className="sp-action-column" aria-label="현재 행동 안내">
        <section className="sp-action-card"><p className="sp-eyebrow">{scene.location}</p><h2>{scene.title}</h2><ol className="sp-stepper" aria-label="행동 단계"><li className={selected !== null ? 'is-complete' : 'is-current'}>선택</li><li className={targetSelected ? 'is-current' : applied ? 'is-complete' : ''}>검토</li><li className={applied ? 'is-complete' : ''}>확정</li></ol>
          <p className="sp-instruction">{applied ? scene.after : scene.instruction}</p>
          <div className="sp-selection-detail" aria-live="polite"><span className="sp-detail-label">{selected === null ? '선택을 기다립니다' : `${selected}구역`}</span>
            {selected === null ? <p>도시판에서 금색 테두리가 있는 구역을 눌러주세요.</p> : <><strong>{chosen.length ? chosen.map(b => `${names[b.owner]} · ${SPEAKEASY_BUILDING_LABELS[b.kind]}`).join(' / ') : '새 사업을 위한 빈 칸'}</strong><p>{selected === scene.target ? completed : '이 구역은 살펴보기만 가능합니다. 이번 체험 대상은 ' + scene.target + '구역입니다.'}</p></>}
          </div>
          <div className="sp-before-after"><span>{scene.before}</span><span aria-hidden="true">↓</span><strong>{scene.after}</strong></div>
          {applied ? <div className="sp-confirmed" role="status">✓ 변화가 적용되었습니다</div> : <button type="button" className="sp-primary" disabled={!targetSelected} onClick={() => void applyScene()}>{scene.button}<span aria-hidden="true">↗</span></button>}
          <div className="sp-secondary-actions"><button type="button" disabled={selected === null && !applied} onClick={() => {interactionRevision.current++; setSelected(null); setApplied(false); setStatus(''); audio.play('CANCEL');}}>처음부터 보기</button><button type="button" onClick={() => changeScene((sceneIndex + 1) % SPEAKEASY_PREVIEW_SCENES.length)}>다음 체험 →</button></div>
          <p className="sp-rule-note">{scene.rule}</p>
        </section>
        <section className="sp-recent"><p className="sp-eyebrow">WHAT CHANGED</p><h3>행동 기록</h3><div aria-live="polite"><span className="sp-log-dot"/>{status || '아직 적용한 행동이 없습니다.'}</div><p>선택만으로 보드는 바뀌지 않습니다.<br/>확정 후 결과와 소리가 함께 전달됩니다.</p></section>
      </aside>
    </div>
    {targetSelected && <button type="button" className="sp-mobile-review" onClick={() => action.current?.scrollIntoView({block: 'start'})}>선택한 행동 검토하기 ↓</button>}</>}
    <footer className="sp-footer"><div><span className="sp-eyebrow">THE SOUND OF THE CITY</span><p>작은 선택에도, 분명한 반응.</p></div><div className="sp-audio-controls"><button type="button" aria-pressed={audio.volume > 0} onClick={() => {audio.setVolume(audio.volume ? 0 : 30); void audio.unlock();}}>{audio.volume ? '♪ 효과음 켜짐' : '♪ 음소거'}</button><label>음량<input aria-label="스피크이지 효과음 음량" type="range" min="0" max="100" step="5" value={audio.volume} onChange={e => audio.setVolume(Number(e.target.value))}/><span>{audio.volume}%</span></label><button type="button" disabled={audio.volume === 0} onClick={() => void audio.unlock().then(() => audio.play('SETTLE'))}>정산 소리 듣기</button></div>{!audio.available && <p role="status">이 브라우저에서 소리를 사용할 수 없습니다. 모든 결과는 화면에도 표시됩니다.</p>}</footer>
    <p className="sp-development-note">개발 미리보기 · 각 체험은 독립된 예시입니다. 카드 전체 데이터 확인과 온라인 대국 연결은 진행 중입니다.</p>
  </main>;
}
