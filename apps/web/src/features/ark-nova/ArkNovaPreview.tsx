import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ARK_ACTIONS, ARK_ACTION_LABELS, ARK_BUILDINGS, ARK_CARDS, ARK_MAP_A, ARK_TAG_LABELS, arkCellKey, arkShape, type ArkActionKind, type ArkCardDefinition, type ArkCell } from '@hangul-rummikub/shared';
import { ArkAudio, readArkSoundPreferences, saveArkSoundPreferences, type ArkCue } from './sound.js';
import { arkArtFamily, arkHexPoints, arkLandCount, arkPreviewCovered, arkScreenPoint, initialArkPreview, placeArkPreview, previewPlacementReason, searchArkCards, undoArkPreview } from './presentation.js';
import './ark-nova.css';
import { BoardIllustrationDefs, BoardBonus } from './BoardIllustration.js';
import { arkAbilityCopy } from './card-copy.js';

const actionCopy: Record<ArkActionKind, readonly [string, string]> = {
  CARDS: ['카드 도감', '동물과 후원자의 비용, 서식 조건, 아이콘을 살펴보세요.'],
  BUILD: ['동물원 설계', '우리와 편의 시설을 놓으며 동물원의 모양을 만들어보세요.'],
  ANIMALS: ['동물 알아보기', '어떤 동물을 위한 동물원을 만들고 싶으신가요?'],
  ASSOCIATION: ['보전과 협력', '대륙별 동물원, 대학, 보전 프로젝트가 만나는 공간입니다.'],
  SPONSORS: ['후원자 도감', '동물원의 장기적인 성장을 돕는 후원자를 살펴보세요.'],
};
const bonusLabel: Readonly<Record<string, string>> = {REPUTATION_2: '평판 2', X_1: 'X 토큰', CARD_1: '카드', MONEY_5: '돈 5', MONEY_10: '돈 10', WORKER: '협회 직원'};
const bonusShort: Readonly<Record<string, string>> = {REPUTATION_2: '↑2', X_1: 'X', CARD_1: '▤', MONEY_5: '5', MONEY_10: '10', WORKER: '♟'};

function LeafMark({className = ''}: {className?: string}) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M31 7C9 4 5 18 12 26c10 8 22-1 19-19Z" fill="currentColor" opacity=".24"/><path d="M9 33 28 12M15 25l-1-10m7 4 9-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function FamilyArt({card}: {card: ArkCardDefinition}) {
  const family = arkArtFamily(card);
  return <div aria-hidden="true" className={`ark-family-art ${card.kind === 'SPONSOR' ? 'ark-sponsor-art' : ''}`} style={card.kind === 'ANIMAL' ? {backgroundPosition: `${family % 3 * 50}% ${Math.floor(family / 3) * 100}%`} : undefined}><span>{card.kind === 'ANIMAL' ? '생태군 일러스트' : 'ZOO PARTNERS'}</span></div>;
}
function Tags({card}: {card: ArkCardDefinition}) {
  return <div className="ark-tags">{card.tags.map((tag, i) => <span key={`${tag}-${i}`}>{ARK_TAG_LABELS[tag] ?? tag}</span>)}</div>;
}
function CardDetail({card, onClose}: {card: ArkCardDefinition; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current, previous = document.activeElement; d?.showModal(); return () => { d?.close(); if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  return <dialog ref={dialog} className="ark-dialog" aria-labelledby="ark-detail-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ark-detail-body"><button className="ark-close" type="button" aria-label="카드 상세 닫기" onClick={onClose}>×</button>
      <FamilyArt card={card}/><div className="ark-detail-copy"><p className="ark-overline">{card.kind === 'ANIMAL' ? '동물' : '후원자'} · {card.key}</p><h2 id="ark-detail-title">{card.name}</h2><p className="ark-latin">{card.english}</p><Tags card={card}/>
        <dl className="ark-card-facts"><div><dt>{card.kind === 'ANIMAL' ? '기본 비용' : '후원 등급'}</dt><dd>{card.cost}{card.kind === 'ANIMAL' ? ' 돈' : ''}</dd></div>{card.kind === 'ANIMAL' && <div><dt>기본 우리</dt><dd>{card.standard ? `${card.size}칸 이상` : '특수 우리'}</dd></div>}<div><dt>매력</dt><dd>+{card.appeal}</dd></div><div><dt>보전 / 평판</dt><dd>{card.conservation} / {card.reputation}</dd></div></dl>
        <h3>서식과 카드 조건</h3><p>{card.water ? `물 ${card.water}칸 인접. ` : ''}{card.rock === null ? '바위 조건 확인 중. ' : card.rock ? `바위 ${card.rock}칸 인접. ` : ''}{!card.water && card.rock === 0 ? '별도 물·바위 인접 조건 없음. ' : ''}</p>
        <p>{card.requirements.length ? [...new Set(card.requirements)].map(tag => `${ARK_TAG_LABELS[tag] ?? tag}${card.requirements.filter(t => t === tag).length > 1 ? ` ×${card.requirements.filter(t => t === tag).length}` : ''}`).join(' · ') : '별도 아이콘 조건 없음'}</p>
        {card.special.length > 0 && <p>특수 우리: {card.special.map(s => `${ARK_BUILDINGS[s.kind]?.name ?? s.kind} ${s.size}칸`).join(', ')}</p>}
        <h3>카드 능력 참고</h3>{card.abilities.length ? card.abilities.map((ability, i) => <p key={i}>{arkAbilityCopy(ability)}</p>) : <p>{card.kind === 'ANIMAL' ? '별도 동물 능력 없음' : '후원자의 개별 효과 설명은 검토 중입니다.'}</p>}
        <p className="ark-note">카드 수치는 검토 중인 참고 데이터입니다. 개별 능력·후원 효과는 이 프리뷰에서 실행하지 않습니다.</p>
        <button type="button" className="ark-primary" onClick={onClose}>도감으로 돌아가기</button>
      </div>
    </div>
  </dialog>;
}

export default function ArkNovaPreview({onExit}: {onExit: () => void}) {
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [action, setAction] = useState<ArkActionKind>('BUILD');
  const [state, setState] = useState(initialArkPreview);
  const [building, setBuilding] = useState('ENCLOSURE_3');
  const [anchor, setAnchor] = useState<ArkCell | null>(null);
  const [hover, setHover] = useState<ArkCell | null>(null);
  const [rotation, setRotation] = useState(0);
  const [reflected, setReflected] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [focusedCell, setFocusedCell] = useState(0);
  const [query, setQuery] = useState('');
  const [cardKind, setCardKind] = useState('ALL');
  const [detail, setDetail] = useState<ArkCardDefinition | null>(null);
  const [message, setMessage] = useState('우리의 크기를 고른 다음 지도에서 기준 칸을 선택하세요.');
  const [sound, setSound] = useState(() => { try { return readArkSoundPreferences(window.localStorage); } catch { return readArkSoundPreferences(); } });
  const audio = useRef<ArkAudio | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const a = new ArkAudio(); audio.current = a; heading.current?.focus(); return () => { a.dispose(); audio.current = null; }; }, []);
  useEffect(() => { audio.current?.setPreferences(sound); try { saveArkSoundPreferences(sound, window.localStorage); } catch { /* Sound works without persistence. */ } }, [sound]);
  const play = (cue: ArkCue) => audio.current?.play(cue);
  const draft = {kind: building, anchor, rotation, reflected, upgraded};
  const reason = previewPlacementReason(state, draft);
  const ghostAnchor = anchor ?? hover;
  const ghostCells = ghostAnchor ? arkShape(building, ghostAnchor, rotation, reflected) : [];
  const ghostReason = previewPlacementReason(state, {...draft, anchor: ghostAnchor});
  const occupied = new Map(state.buildings.flatMap(b => b.cells.map(c => [arkCellKey(c), b] as const)));
  const visibleCards = useMemo(() => searchArkCards(ARK_CARDS, query, action === 'ANIMALS' ? 'ANIMAL' : action === 'SPONSORS' ? 'SPONSOR' : cardKind), [action, query, cardKind]);
  const covered = arkPreviewCovered(state);
  const selectAction = (next: ArkActionKind) => { setAction(next); setQuery(''); setHover(null); play('SELECT'); };
  function place(): void {
    const next = placeArkPreview(state, draft);
    if (next === state) { setMessage(reason ?? '배치를 확인하세요.'); play('ERROR'); return; }
    setState(next); setAnchor(null); setHover(null); play('PLACE');
    setMessage(`${ARK_BUILDINGS[building]!.name} 배치 완료. ${ARK_BUILDINGS[building]!.shape.length * 2} 돈을 사용했습니다.`);
  }
  function selectAnchor(cell: ArkCell): void { setAnchor({q: cell.q, r: cell.r}); play(previewPlacementReason(state, {...draft, anchor: cell}) ? 'ERROR' : 'SELECT'); }
  function rotate(direction: number): void { setRotation(r => (r + direction + 6) % 6); play('ROTATE'); }
  function mapKey(event: KeyboardEvent<SVGPolygonElement>, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectAnchor(ARK_MAP_A[index]!); return; }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotate(event.shiftKey ? -1 : 1); return; }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); setReflected(f => !f); play('ROTATE'); return; }
    if (event.key === 'Escape') { setAnchor(null); setHover(null); return; }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const current = arkScreenPoint(ARK_MAP_A[index]!);
    const candidates = ARK_MAP_A.map((cell, i) => ({i, point: arkScreenPoint(cell)})).filter(({point}) => event.key === 'ArrowRight' ? point.x > current.x : event.key === 'ArrowLeft' ? point.x < current.x : event.key === 'ArrowDown' ? point.y > current.y : point.y < current.y);
    const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    candidates.sort((a, b) => { const distance = (point: {x: number; y: number}) => Math.abs(point.x-current.x)*(horizontal ? 1 : 3)+Math.abs(point.y-current.y)*(horizontal ? 3 : 1); return distance(a.point)-distance(b.point); });
    const next = candidates[0]?.i ?? index; setFocusedCell(next);
    event.currentTarget.ownerSVGElement?.querySelector<SVGPolygonElement>(`[data-cell-index="${next}"]`)?.focus();
  }
  return <main className="ark-shell">
    <header className="ark-topbar"><button type="button" className="ark-back" onClick={onExit}>← 게임 목록</button><div className="ark-wordmark"><LeafMark/><span>ARK NOVA<small>나만의 작은 야생</small></span></div><div className="ark-audio-control"><button type="button" aria-pressed={sound.enabled} onClick={() => { const next = {...sound, enabled: !sound.enabled}; setSound(next); audio.current?.setPreferences(next); if (next.enabled) audio.current?.play('SELECT'); }}>{sound.enabled ? '소리 켜짐' : '소리 꺼짐'}</button><label><span className="ark-sr-only">효과음 음량</span><input type="range" min="0" max="100" value={Math.round(sound.volume * 100)} onChange={e => setSound(s => ({...s, volume: Number(e.target.value) / 100}))}/></label></div></header>
    <section className="ark-hero"><div><p className="ark-overline">FIELD NOTES · MAP A</p><h1 ref={heading} tabIndex={-1}>야생을 위한 공간을 짓다.</h1><p>작은 우리 하나에서 시작하는, 당신만의 동물원.</p></div><span className="ark-preview-badge">인터랙션 프리뷰</span></section>
    <p className="ark-preview-notice">건설 조작·카드 도감·효과음을 체험하는 개발 화면입니다. 멀티플레이 대국, 카드 능력, 점수 정산은 아직 연결되지 않았습니다. 나가면 체험 배치가 초기화됩니다.</p>
    <div className="ark-resource-strip"><div><span>체험 예산</span><strong>{state.money}<small> 돈</small></strong></div><div><span>사용한 땅</span><strong>{covered}<small> / {arkLandCount}</small></strong></div><div><span>새로 지은 건물</span><strong>{state.history.length}<small> 동</small></strong></div><div className="ark-resource-caption"><LeafMark/><span>우리, 물, 바위.<br/>모든 공간에는 이유가 있습니다.</span></div></div>
    <nav className="ark-action-rack" aria-label="아크노바 체험 공간">{ARK_ACTIONS.map((kind, i) => <button key={kind} type="button" className={`ark-action-card ${action === kind ? 'is-active' : ''}`} aria-pressed={action === kind} onClick={() => selectAction(kind)}><span className="ark-action-number" aria-hidden="true">0{i + 1}</span><span>{ARK_ACTION_LABELS[kind]}</span><small>{kind === 'BUILD' ? '배치 체험' : kind === 'ASSOCIATION' ? '구성 안내' : '카드 도감'}</small></button>)}</nav>
    <section className="ark-workspace" aria-labelledby="ark-section-title"><div className="ark-section-heading"><div><p className="ark-overline">YOUR ZOO JOURNAL</p><h2 id="ark-section-title">{actionCopy[action][0]}</h2><p>{actionCopy[action][1]}</p></div><span className="ark-edition">기본판 · 지도 A</span></div>
      {action === 'BUILD' ? <div className={`ark-build-layout ${boardExpanded ? 'is-expanded' : ''}`}>
        <div className="ark-map-panel"><div className="ark-map-heading"><span>THE ZOO PLAN</span><button type="button" aria-pressed={boardExpanded} onClick={() => setBoardExpanded(expanded => !expanded)}>{boardExpanded ? '기본 크기' : '보드 크게 보기'}</button></div><svg className="ark-map" viewBox="0 0 450 410" role="group" aria-label="지도 A 건물 배치. 방향키로 칸 이동, Enter로 선택, R로 회전, F로 반전." onPointerLeave={() => setHover(null)}>
          <BoardIllustrationDefs/>
          <rect className="ark-board-ground" x="4" y="4" width="442" height="402" rx="14" fill="url(#ark-painted-grass)" pointerEvents="none"/>
          <defs><pattern id="ark-fence" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v8" stroke="#557452" strokeWidth="2"/></pattern></defs>
          {ARK_MAP_A.map((cell, i) => { const key = arkCellKey(cell), b = occupied.get(key), center = arkScreenPoint(cell); const label = `${cell.q + 1}열 ${cell.r + Math.ceil(cell.q / 2) + 1}칸, ${b ? ARK_BUILDINGS[b.kind]?.name : cell.terrain === 'WATER' ? '물' : cell.terrain === 'ROCK' ? '바위' : '빈 땅'}${cell.bonus ? `, ${bonusLabel[cell.bonus]} 보너스` : ''}${cell.restricted ? ', 건설 II 필요' : ''}`;
            return <g key={key}><polygon points={arkHexPoints(cell)} data-cell-index={i} role="button" tabIndex={focusedCell === i ? 0 : -1} aria-label={label} aria-pressed={anchor !== null && key === arkCellKey(anchor)} className={`ark-hex terrain-${cell.terrain.toLowerCase()} ${anchor && key === arkCellKey(anchor) ? 'is-anchor' : ''} ${b ? `is-built ${b.occupied ? 'is-occupied' : ''} ${b.kind === 'KIOSK' ? 'is-kiosk' : b.kind === 'PAVILION' ? 'is-pavilion' : ''}` : ''}`} onFocus={() => setFocusedCell(i)} onKeyDown={e => mapKey(e, i)} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(cell); }} onClick={() => selectAnchor(cell)}/>
              {b?.occupied && <polygon points={arkHexPoints(cell, 21)} fill="url(#ark-fence)" opacity=".45" pointerEvents="none"/>}
              {!b && cell.bonus && <BoardBonus x={center.x} y={center.y} label={bonusShort[cell.bonus] ?? '?'}/>}
              {!b && cell.restricted && <BoardBonus x={center.x} y={center.y} label="II" restricted/>}
              {b?.kind === 'KIOSK' && <g pointerEvents="none" className="ark-kiosk-symbol"><path d={`M${center.x - 11} ${center.y - 3}h22l-4-8h-14Zm3 2v12h16v-12`} fill="none" stroke="currentColor" strokeWidth="2"/><path d={`M${center.x - 11} ${center.y - 3}h22`} stroke="currentColor" strokeWidth="4"/></g>}
              {b?.kind === 'PAVILION' && <text x={center.x} y={center.y + 5} className="ark-hex-label" pointerEvents="none">✦</text>}
            </g>;
          })}
          {ghostCells.map(c => <polygon key={arkCellKey(c)} points={arkHexPoints(c, 27)} className={`ark-ghost ${ghostReason ? 'is-invalid' : ''}`} pointerEvents="none"/>)}
          {anchor && <circle cx={arkScreenPoint(anchor).x} cy={arkScreenPoint(anchor).y} r="5" fill="#fffef4" stroke="#23483a" strokeWidth="2" pointerEvents="none"/>}
        </svg><div className="ark-map-legend"><span><i className="land"/>건설 가능한 땅</span><span><i className="water"/>물</span><span><i className="rock"/>바위</span><span><i className="occupied"/>사용 중인 우리</span></div><p className="ark-map-help">칸 선택 후 가배치 · <kbd>R</kbd> 회전 · <kbd>F</kbd> 반전 · <kbd>Esc</kbd> 선택 해제</p></div>
        <aside className="ark-build-controls" aria-label="건설 도구"><div className="ark-control-title"><span className="ark-step">01</span><h3>무엇을 지을까요?</h3></div><div className="ark-building-rack">{Object.entries(ARK_BUILDINGS).map(([key, d]) => <button type="button" key={key} className={building === key ? 'is-selected' : ''} aria-pressed={building === key} onClick={() => { setBuilding(key); setAnchor(null); setRotation(0); setReflected(false); play('SELECT'); }}><span>{d.name}</span><small>{d.shape.length * 2} 돈</small></button>)}</div>
          <label className="ark-upgrade-toggle"><input type="checkbox" checked={upgraded} onChange={e => setUpgraded(e.target.checked)}/>건설 II 배치 체험</label>
          <div className="ark-control-title"><span className="ark-step">02</span><h3>방향을 맞춰주세요</h3></div><div className="ark-orientation"><button type="button" aria-label="왼쪽으로 60도 회전" onClick={() => rotate(-1)}>↶</button><span>{rotation * 60}°</span><button type="button" aria-label="오른쪽으로 60도 회전" onClick={() => rotate(1)}>↷</button><button type="button" className="ark-flip" aria-pressed={reflected} onClick={() => { setReflected(f => !f); play('ROTATE'); }}>↔ 반전</button></div>
          <div className={`ark-placement-feedback ${anchor ? reason ? 'is-error' : 'is-valid' : ''}`} role="status">{anchor ? reason ?? `${ARK_BUILDINGS[building]!.name} 배치가 가능합니다.` : '지도에서 기준 칸을 선택하세요.'}</div>
          <button type="button" className="ark-primary" disabled={reason !== null} onClick={place}>이곳에 배치하기 <span>−{ARK_BUILDINGS[building]!.shape.length * 2} 돈</span></button>
          <div className="ark-secondary-actions"><button type="button" disabled={!state.history.length} onClick={() => { setState(undoArkPreview); setAnchor(null); setMessage('마지막 체험 배치를 되돌렸습니다.'); play('UNDO'); }}>마지막 배치 되돌리기</button><button type="button" onClick={() => { setState(initialArkPreview()); setAnchor(null); setHover(null); setMessage('새로운 동물원 설계를 시작합니다.'); play('UNDO'); }}>초기화</button></div>
          <p className="ark-note">지도 보너스와 행동 강도는 이 배치 체험의 예산에 적용하지 않습니다. 실제 대국의 되돌리기 기능과는 별개입니다.</p>
        </aside>
      </div> : action === 'ASSOCIATION' ? <div className="ark-association"><div className="ark-association-illustration"><LeafMark/><p>좋은 동물원은<br/><strong>연결되어 있습니다.</strong></p></div><div><p className="ark-overline">CONSERVATION & PARTNERSHIPS</p><h3>야생을 보호하는 다섯 대륙</h3><div className="ark-partners">{['Africa', 'Americas', 'Asia', 'Australia', 'Europe'].map((tag, i) => <span key={tag}><b>0{i + 1}</b>{ARK_TAG_LABELS[tag]}</span>)}</div><p>협회 직원을 보내 제휴 동물원과 대학을 확보하고, 보전 프로젝트를 지원하는 공간입니다.</p><p className="ark-note">협회 행동과 보전 점수 처리는 서버 규칙 구현 단계에서 연결됩니다. 이 화면에서는 구성을 살펴볼 수 있습니다.</p><button type="button" className="ark-primary" onClick={() => selectAction('BUILD')}>동물원 설계로 돌아가기</button></div></div> : <>
        <div className="ark-catalog-toolbar"><label><span className="ark-sr-only">카드 이름 또는 번호 검색</span><input type="search" placeholder="동물 이름, 영문 이름, 카드 번호 검색" value={query} onChange={e => setQuery(e.target.value)}/></label>{action === 'CARDS' && <label><span className="ark-sr-only">카드 종류</span><select value={cardKind} onChange={e => setCardKind(e.target.value)}><option value="ALL">모든 카드</option><option value="ANIMAL">동물</option><option value="SPONSOR">후원자</option></select></label>}<span aria-live="polite">{visibleCards.length}장의 기록</span></div>
        <div className="ark-catalog-grid">{visibleCards.map(card => <button type="button" key={card.key} className="ark-zoo-card" aria-label={`${card.name}, ${card.kind === 'ANIMAL' ? '비용' : '후원 등급'} ${card.cost}, 상세 보기`} onClick={() => { setDetail(card); play('CARD'); }}><div className="ark-card-topline"><span>{card.kind === 'ANIMAL' ? 'ANIMAL' : 'SPONSOR'}</span><span>No. {card.key}</span></div><FamilyArt card={card}/><div className="ark-card-copy"><h3>{card.name}</h3><p className="ark-latin">{card.english}</p><Tags card={card}/><div className="ark-card-bottom"><span>{card.kind === 'ANIMAL' ? `${card.size}칸 · ${card.cost} 돈` : `후원 등급 ${card.cost}`}</span><strong>{card.kind === 'ANIMAL' ? `매력 +${card.appeal}` : '상세 보기'}</strong></div></div></button>)}</div>{visibleCards.length === 0 && <p className="ark-empty">일치하는 카드가 없습니다. 이름이나 카드 번호를 다시 확인하세요.</p>}
      </>}
    </section>
    <footer className="ark-footer"><LeafMark/><span>각자의 동물원, 하나의 지구.</span><span>ART & INTERACTION STUDY</span></footer>
    <p className="ark-sr-only" aria-live="polite" aria-atomic="true">{message}</p>
    {detail && <CardDetail card={detail} onClose={() => setDetail(null)}/>}
  </main>;
}
