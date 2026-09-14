import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PERCH_CREATURE_INFO, PERCH_LOCATION_INFO, PERCH_OBJECTIVE_INFO, PERCH_FLOCK_COLORS, PERCH_FLOCK_NAMES, PERCH_FLOCK_MARKS, PROTOCOL_VERSION, perchRanks, perchStrength, perchController, perchFountainCells, type PerchAction, type PerchClientCommand, type PerchProjection, type PerchTile, type TileId, type PerchChoice } from '@hangul-rummikub/shared';
import type { PerchWebSnapshot } from '../../lib/snapshot-wire-decoder.js';
import { createRequestId } from '../../lib/request-id.js';
import { getGameStartControl } from '../../lib/game-start.js';
import { PerchCommandRejected } from '../../lib/perch-command-error.js';
import { PerchBirdToken, PerchLocationArt, PerchCreatureArt } from './art.js';
import { usePerchSound } from './sound.js';
type Props = {
    snapshot: PerchWebSnapshot;
    connected: boolean;
    pending: boolean;
    error: string | null;
    connectionLabel: string;
    onCommand(command: PerchClientCommand): Promise<void>;
    onRematch(): void;
    onStart(): void;
    onLeave(): void;
    onCopy(): void;
};
const STAGES = { SETUP: '게임 준비', OBJECTIVES: '비밀 목표 선택', MIGRATION: '새들의 이동', RECRUIT: '새 모집', PERCH: '새 배치', UPKEEP: '정비와 점수', ROUND_END: '라운드 정산', FINISHED: '마지막 노래' };
export function PerchScreen(props: Props) {
    const g = props.snapshot.game, sound = usePerchSound(g, props.connected), start = getGameStartControl(props.snapshot, props.pending || !props.connected);
    return <section className="perch-screen" aria-label="퍼치" onPointerDownCapture={sound.unlock} onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ')
        sound.unlock(); }}>
 <header className="pc-header"><div className="pc-brand"><span className="pc-feather">❧</span><div><h1>PERCH <small>퍼치</small></h1><span>작은 새들의 커다란 자리 다툼</span></div></div><div className="pc-tools"><span className="pc-connected">{props.connectionLabel}</span><details className="pc-audio"><summary>♫ 소리</summary><div><label>효과음 {sound.volume}%<input aria-label="퍼치 효과음 음량" type="range" min="0" max="100" value={sound.volume} onChange={e => sound.setVolume(Number(e.target.value))}/></label><button onClick={() => sound.setVolume(sound.volume ? 0 : 35)}>{sound.volume ? '음소거' : '소리 켜기'}</button><button onClick={() => { sound.unlock(); sound.select(); }}>소리 확인</button><small>{sound.enabled ? '새·물·나무의 소리가 준비됐어요.' : '화면을 누르면 소리가 활성화됩니다.'}</small></div></details><button onClick={props.onCopy}>초대 · {props.snapshot.room.roomCode}</button><button onClick={props.onLeave} disabled={props.pending}>나가기</button></div></header>
 {!props.connected && <p className="pc-alert" role="status">연결을 복구하고 있습니다. 내 차례와 선택 단계는 그대로 보존됩니다.</p>}{props.error && <p className="pc-alert" role="alert">{props.error}</p>}
 {g ? <PerchTable key={`${g.gameId}:${props.snapshot.self.playerId}`} {...props} game={g} selectSound={sound.select} errorSound={sound.error}/> : <div className="pc-lobby"><div className="pc-lobby-illustration"><img src="/images/perch/fountain.png" alt="따뜻한 숲속 정원의 층층이 쌓인 분수"/><span>KEEP YOUR FEATHERED FRIENDS CLOSE</span></div><div className="pc-lobby-copy"><span className="pc-eyebrow">A LITTLE PLACE IN THE WOODS</span><h2>어느 나뭇가지에<br />앉아볼까요?</h2><p>내 새도, 친구의 새도 손안에.<br />새들을 쌓고 숲속 동물과 함께<br />다섯 라운드의 이야기를 만드세요.</p><div className="pc-seats">{props.snapshot.room.players.map((p, i) => <div key={p.playerId}><PerchBirdToken flock={i % 5}/><span>{p.nickname}<small>{p.isHost ? '방장' : p.connectionStatus === 'CONNECTED' ? '함께하는 새' : '연결 대기'}</small></span></div>)}</div><button className="pc-primary" disabled={!start.canStart} onClick={props.onStart}>숲으로 들어가기 →</button><p className="pc-muted">{start.guidance}</p><small>2–5인 · 기본판 전체 · 강제 시간 제한 없음</small></div></div>}
 <details className="pc-guide"><summary>처음 만나는 퍼치 · 게임 방법</summary><div><p><b>① 모집</b> 내 새 2마리와 주머니에서 뽑은 2마리를 받습니다.</p><p><b>② 배치</b> 새를 고르고 장소를 누른 뒤 배치를 확정하세요. 상대 색의 새도 배치할 수 있습니다.</p><p><b>③ 보너스</b> 배치 전이나 후에 동물·새집·번개 중 하나를 사용할 수 있습니다. 행동이 끝나면 차례를 넘기세요.</p><p><b>④ 정산</b> 각 장소의 순위별 점수를 받습니다. 동률인 순위는 0점! 둥지와 새집은 각각 새 수 +1입니다.</p><p><b>⑤ 마지막 노래</b> 5라운드 정비 뒤 목표·최대 무리·동물·분수·광장 점수를 더합니다.</p></div></details>
 </section>;
}
function PerchTable(props: Props & {
    game: PerchProjection;
    selectSound(): void;
    errorSound(): void;
}) {
    const g = props.game, self = props.snapshot.self.playerId, me = g.playerStates.find(p => p.playerId === self)!, host = props.snapshot.room.players.some(p => p.playerId === self && p.isHost), finished = g.phase === 'FINISHED';
    const [selected, setSelected] = useState<TileId | null>(g.board[0]?.tileId ?? null), [birdId, setBirdId] = useState<TileId | null>(null), [nest, setNest] = useState<number | null>(null), [mode, setMode] = useState<'PLACE' | 'HOUSE' | 'ZAP'>('PLACE'), [draft, setDraft] = useState<{
        action: PerchAction;
        title: string;
        description: string;
    } | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [zoom, setZoom] = useState(100), [highlight, setHighlight] = useState<readonly TileId[]>([]);
    const sending = useRef(false), lastRevision = useRef(g.gameRevision), boardRef = useRef<HTMLDivElement>(null), detailRef = useRef<HTMLDivElement>(null);
    const blocked = busy || props.pending || !props.connected, canAct = g.phase === 'PERCH' && !g.pending && g.activePlayerId === self && !blocked, loc = g.board.find(t => t.tileId === selected && !t.removed), chosenBird = me.hand.find(b => b.birdId === birdId), name = (id: string) => props.snapshot.room.players.find(p => p.playerId === id)?.nickname ?? '중립 새';
    useEffect(() => { if (lastRevision.current !== g.gameRevision) {
        lastRevision.current = g.gameRevision;
        setDraft(null);
        setHighlight([]);
        setNest(null);
        if (!me.hand.some(b => b.birdId === birdId))
            setBirdId(null);
    } }, [g.gameRevision]);
    useEffect(() => { if (!props.connected)
        setDraft(null); }, [props.connected]);
    useEffect(() => { if (!draft)
        return; const previous = document.activeElement; return () => { if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus(); }; }, [draft !== null]);
    async function submit(action: PerchAction) { if (sending.current || blocked || g.phase === 'FINISHED')
        return; sending.current = true; setBusy(true); setError(null); try {
        await props.onCommand({ protocolVersion: PROTOCOL_VERSION, kind: 'perch:act', requestId: createRequestId(), gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId, payload: action });
        setDraft(null);
    }
    catch (e) {
        setError(e instanceof PerchCommandRejected ? e.message : '행동을 전송하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.');
        props.errorSound();
    }
    finally {
        sending.current = false;
        setBusy(false);
    } }
    function choose(action: PerchAction, title: string, description: string) { setDraft({ action, title, description }); props.selectSound(); }
    function selectTile(id: TileId) { setSelected(id); setNest(null); setDraft(null); props.selectSound(); if (window.matchMedia('(max-width:1000px)').matches && canAct && chosenBird)
        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })); }
    function choosePending(c: PerchChoice) { setHighlight(c.tileIds); choose({ type: 'CHOOSE', choiceId: c.id }, c.label, g.pending?.title ?? '선택 확정'); }
    let preview = loc ? perchRanks(loc) : [];
    if (loc && chosenBird && mode === 'PLACE' && !g.placed && !loc.stacks.some(st => st.flock === chosenBird.flock && st.house)) {
        const candidate: PerchTile = { ...loc, stacks: loc.stacks.map(st => ({ ...st, birds: [...st.birds] })) };
        const st = candidate.stacks.find(st => st.flock === chosenBird.flock);
        if (st) {
            st.birds.push(chosenBird);
            if (nest !== null)
                st.nest = nest;
        }
        else
            candidate.stacks.push({ flock: chosenBird.flock, birds: [chosenBird], nest, house: false });
        preview = perchRanks(candidate);
    }
    const columns = Math.max(...g.board.map(t => t.col)) + 1, latest = g.history.at(-1), pendingMine = g.pending?.actor === self;
    return <>
 <div className="pc-progress"><div><span className="pc-eyebrow">{finished ? 'THE LAST SONG' : 'SEASON OF THE FLOCK'}</span><h2>{STAGES[g.phase]} <small>{g.round} / 5 라운드</small></h2></div><div className="pc-rounds" aria-label={`현재 ${g.round}라운드`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n === g.round ? 'current' : n < g.round ? 'past' : ''}>{n}{n === 4 ? '⌂' : n === 5 ? 'ϟ' : ''}</span>)}</div><div className="pc-turn-label" role="status">{g.pending ? `${name(g.pending.actor)} · 추가 선택` : g.phase === 'OBJECTIVES' ? '각자 비밀 목표를 선택하세요' : g.phase === 'SETUP' ? '방장이 게임을 준비합니다' : finished ? '최종 결과' : `${name(g.activePlayerId)}${g.activePlayerId === self ? ' · 내 차례' : '님의 차례'}`}</div></div>
 <div className="pc-players">{g.turnOrder.map((id, i) => { const p = g.playerStates.find(p => p.playerId === id)!; return <div key={id} className={`pc-player ${g.activePlayerId === id && !finished ? 'active' : ''}`} style={{ '--flock': PERCH_FLOCK_COLORS[p.flock] } as CSSProperties}><PerchBirdToken flock={p.flock}/><div><strong>{i + 1}. {name(id)}{id === self ? ' · 나' : ''}</strong><span>모집 {p.hand.length} · 공급 {p.supplyCount}{p.house ? ' · ⌂' : ''}{p.lightning ? ' · ϟ' : ''}</span></div><b>{p.score}<small>점</small></b></div>; })}{g.neutralSupplyCount !== null && <span className="pc-neutral"><PerchBirdToken flock={2} small/> 중립 · 공급 {g.neutralSupplyCount}</span>}</div>
 {error && <p className="pc-alert" role="alert">{error}</p>}
 {g.phase === 'SETUP' && <div className="pc-setup"><div><h3>오늘의 숲을 골라주세요</h3><p>추천 배치로 익히거나, 매번 새로운 숲에서 겨뤄보세요.</p></div><label>장소 배치<select aria-label="장소 배치" disabled={!host || blocked} value={g.settings.randomBoard ? 'random' : 'recommended'} onChange={e => void submit({ type: 'CONFIGURE', randomBoard: e.target.value === 'random', objectives: g.settings.objectives })}><option value="recommended">첫 게임 추천 배치</option><option value="random">무작위 · 전체 24종</option></select></label><label className="pc-check"><input type="checkbox" disabled={!host || blocked} checked={g.settings.objectives} onChange={e => void submit({ type: 'CONFIGURE', randomBoard: g.settings.randomBoard, objectives: e.target.checked })}/>비밀 목표 사용</label><button className="pc-primary" disabled={!host || blocked || props.snapshot.room.players.some(p => p.connectionStatus !== 'CONNECTED')} onClick={() => void submit({ type: 'BEGIN' })}>새들의 이야기 시작 →</button></div>}
 {g.phase === 'OBJECTIVES' && <div className="pc-objective-select"><div><span className="pc-eyebrow">A SECRET AMBITION</span><h3>{me.objectiveSelected ? '목표를 골랐어요' : '나만의 비밀 목표를 고르세요'}</h3><p>{me.objectiveSelected ? '다른 플레이어의 선택을 기다립니다.' : '두 장 중 한 장을 선택합니다. 게임이 끝날 때까지 나에게만 보입니다.'}</p></div><div className="pc-objective-options">{g.privateState.objectiveChoices.map(id => { const o = PERCH_OBJECTIVE_INFO[id]; return <button key={id} className="pc-objective-card" disabled={blocked} onClick={() => choose({ type: 'OBJECTIVE', objective: id }, o.name, o.description)}><span className="pc-objective-top">비밀 목표 <b>{o.points}점</b></span><strong>{o.name}</strong><p>{o.description}</p><span className="pc-objective-bottom">마지막 라운드 후 달성 확인</span></button>; })}</div><span>{g.playerStates.filter(p => p.objectiveSelected).length} / {g.playerStates.length}명 선택 완료</span></div>}
 {finished && <div className="pc-results"><span className="pc-eyebrow">THE LAST SONG</span><h2>{g.result.reason === 'CANCELLED' ? '이번 이야기는 여기까지' : g.result.winnerPlayerIds.length > 1 ? `${g.result.winnerPlayerIds.map(name).join(' · ')} 공동 승리` : `${g.result.winnerPlayerIds.map(name).join('')}님의 승리`}</h2><div className="pc-result-columns">{g.playerStates.map(p => <div key={p.playerId}><h3><PerchBirdToken flock={p.flock} small/>{name(p.playerId)} · {p.score}점</h3>{g.result.bonuses.filter(b => b.playerId === p.playerId).map(b => <p key={b.source}>{b.source}<b>+{b.points}</b></p>)}{g.result.objectives.filter(o => o.playerId === p.playerId && o.objective).map(o => <p key={o.playerId}>{o.objective && PERCH_OBJECTIVE_INFO[o.objective].name} · {o.achieved ? '달성' : '미달성'}</p>)}</div>)}</div>{host ? <button className="pc-primary" disabled={blocked} onClick={props.onRematch}>같은 방에서 다시 준비하기 →</button> : <p>방장이 대기실로 돌아가 새 게임을 준비할 수 있습니다.</p>}</div>}
 {!finished && g.phase !== 'SETUP' && g.phase !== 'OBJECTIVES' && <div className="pc-hand-dock"><div className="pc-hand-title"><span className="pc-eyebrow">BIRDS IN YOUR HAND</span><h3>내가 배치할 새 <small>{me.hand.length}마리</small></h3></div><div className="pc-hand-birds">{me.hand.map((b, i) => <button key={b.birdId} aria-label={`${PERCH_FLOCK_NAMES[b.flock]} 새 ${i + 1} 선택`} aria-pressed={birdId === b.birdId} disabled={!canAct || g.placed} onClick={() => { setBirdId(b.birdId); setMode('PLACE'); setDraft(null); setNest(null); props.selectSound(); }}><PerchBirdToken flock={b.flock}/><span>{b.flock === me.flock ? '내 새' : PERCH_FLOCK_NAMES[b.flock] + ' 새'}</span></button>)}{me.hand.length === 0 && <span className="pc-muted">이번 라운드의 새를 모두 놓았어요.</span>}</div><div className="pc-end-turn"><span>{g.phase === 'PERCH' ? g.activePlayerId === self ? g.placed ? '새 배치 완료 · 보너스를 쓰거나 차례를 넘기세요.' : '새 1마리를 배치하세요.' : `${name(g.activePlayerId)}님의 차례입니다.` : STAGES[g.phase]}</span>{g.phase === 'PERCH' && g.activePlayerId === self && <button className="pc-primary" disabled={!canAct || !g.placed} onClick={() => void submit({ type: 'END_TURN' })}>차례 끝내기 →</button>}</div></div>}
 <div className="pc-main"><div className="pc-board-column"><div className="pc-board-toolbar"><span>우리들의 보금자리 <small>남은 장소 {g.board.filter(t => !t.removed).length}</small></span><label>확대 <input aria-label="보드 확대" type="range" min="80" max="140" step="10" value={zoom} onChange={e => setZoom(Number(e.target.value))}/>{zoom}%</label></div><div className="pc-board-scroll" ref={boardRef}><div className="pc-board" style={{ '--columns': columns, '--tile-size': `${Math.round(172 * zoom / 100)}px` } as CSSProperties} aria-label="장소 보드">
 {g.board.map(t => { const info = PERCH_LOCATION_INFO[t.definitionId], controller = perchController(t), selectedTile = selected === t.tileId, legal = canAct && mode === 'PLACE' && !g.placed && chosenBird && !t.removed && !t.stacks.some(st => st.flock === chosenBird.flock && st.house); return <button key={t.tileId} type="button" className={`pc-tile ${t.removed ? 'removed' : ''} ${legal ? 'legal' : ''} ${highlight.includes(t.tileId) ? 'highlight' : ''} ${latest?.tileId === t.tileId ? 'last-action' : ''}`} style={{ gridColumn: t.col + 1, gridRow: `${t.row + 1}/span 2` }} aria-pressed={selectedTile} aria-label={`${info.name}${t.removed ? ' · 제거된 장소' : ` · ${t.stacks.map(st => `${PERCH_FLOCK_NAMES[st.flock]} ${perchStrength(st)}`).join(', ') || '빈 장소'}`}`} onClick={() => selectTile(t.tileId)} disabled={t.removed}><PerchLocationArt id={t.definitionId}/><div className="pc-tile-title"><span>{info.kind === 'SPECIAL' ? '✦ ' : ''}{info.name}</span><div className="pc-tile-points">{info.scores.map((n, i) => <span key={i}><small>{i + 1}위</small>{t.definitionId === 'STATUE' && i === 0 ? '1+X' : n}</span>)}</div></div><div className="pc-flocks">{t.stacks.map(st => <span className="pc-stack" key={st.flock} title={`${PERCH_FLOCK_NAMES[st.flock]}: 새 ${st.birds.length}, 둥지 ${st.nest === null ? 0 : 1}, 새집 ${st.house ? 1 : 0}`}><span className="pc-stacked-birds">{Array.from({ length: Math.min(3, st.birds.length) }, (_, i) => <span key={i} style={{ bottom: i * 8 }}><PerchBirdToken flock={st.flock} small/></span>)}</span><b style={{ color: PERCH_FLOCK_COLORS[st.flock] }}>{PERCH_FLOCK_MARKS[st.flock]} {perchStrength(st)}</b><small>{st.nest !== null ? '◉ ' : ''}{st.house ? '⌂' : ''}</small></span>)}</div><div className="pc-tile-bottom"><span>{t.removed ? '광장으로 날아갔어요' : controller === null ? t.stacks.length ? '동률 · 지배자 없음' : '아직 고요한 장소' : `${PERCH_FLOCK_NAMES[controller]} 우세`}</span><span>{t.nests.map((exists, i) => exists ? <span key={i}>{t.stacks.some(st => st.nest === i) ? '◉' : '◎'}</span> : null)}</span></div>{g.creatures.filter(c => c.tileId === t.tileId).map(c => <span key={c.creature} className="pc-tile-creature"><PerchCreatureArt index={PERCH_CREATURE_INFO[c.creature].art}/><span>{PERCH_CREATURE_INFO[c.creature].name}</span></span>)}</button>; })}
 </div></div><div className="pc-board-caption"><span>◎ 둥지 +1 · ⌂ 새집 +1</span><span>주머니 {g.bagCount}마리 · 색깔과 뽑는 순서는 비공개</span></div>
 <div className="pc-creatures">{g.creatures.map(c => { const info = PERCH_CREATURE_INFO[c.creature]; return <div className={`pc-creature-card ${c.used ? 'used' : ''}`} key={c.creature}><PerchCreatureArt index={info.art}/><div><span className="pc-eyebrow">{c.controller ? `${name(c.controller)} 조종` : '아직 조종자 없음'}{c.used ? ' · 사용함' : ''}</span><h3>{info.name}</h3><p><b>이동</b> {info.move}</p><p><b>효과</b> {info.effect}</p>{c.intersection.length > 0 && <small>교차점: {c.intersection.map(id => g.board.find(t => t.tileId === id)).map(t => t ? PERCH_LOCATION_INFO[t.definitionId].name : '').join(' · ')}</small>}<button disabled={!canAct || g.bonusUsed || c.used || c.controller !== self} onClick={() => choose({ type: 'CREATURE', creature: c.creature }, `${info.name} 활성화`, '이번 차례 보너스 행동 1회를 사용합니다. 이동 후 효과 사용 여부를 선택합니다.')}>{c.used ? '이번 라운드 사용 완료' : `${info.name} 조종하기`}</button></div></div>; })}</div>
 </div><aside className="pc-sidebar"><div className={`pc-fountain ${g.pending?.kind === 'FOUNTAIN' ? 'choosing' : ''}`} aria-label="분수"><img src="/images/perch/fountain.png" alt="숲속 분수"/><div className="pc-fountain-label"><strong>새들이 쉬어가는 분수</strong><small>받침이 채워지면 더 높이 올라가요</small></div><svg className="pc-fountain-supports" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{perchFountainCells(g.playerStates.length).flatMap(c => c.supports.map(id => { const below = perchFountainCells(g.playerStates.length)[id]!; const step = g.playerStates.length <= 3 ? 14 : 12; return <line key={`${c.id}-${id}`} x1={16 + c.x * 11} y1={83 - c.level * step} x2={16 + below.x * 11} y2={83 - below.level * step}/>; }))}</svg>{perchFountainCells(g.playerStates.length).map(c => { const b = g.fountain[c.id], choice = pendingMine && g.pending?.kind === 'FOUNTAIN' ? g.pending.choices.find(o => o.slot === c.id) : undefined; return <button type="button" key={c.id} className={`pc-fountain-cell ${b ? 'occupied' : ''} ${choice ? 'available' : ''}`} style={{ left: `${16 + c.x * 11}%`, top: `${83 - c.level * (g.playerStates.length <= 3 ? 14 : 12)}%` }} disabled={!choice || blocked} aria-label={`분수 ${c.id + 1}번 · ${c.points}점 · ${b ? PERCH_FLOCK_NAMES[b.flock] + ' 새' : choice ? '선택 가능' : '선택 불가'}`} onClick={() => choice && choosePending(choice)}>{b ? <PerchBirdToken flock={b.flock} small/> : c.points}</button>; })}</div><div className="pc-plaza"><span>광장 · 마지막에 1마리당 1점</span><div>{Array.from({ length: Math.max(3, g.playerStates.length) }, (_, f) => <span key={f}><PerchBirdToken flock={f} small/>{g.plaza.filter(b => b.flock === f).length}</span>)}</div></div>
 {g.pending && <div className="pc-decision"><span className="pc-eyebrow">{pendingMine ? 'YOUR CHOICE' : 'WAITING FOR A FRIEND'}</span><h3>{g.pending.title}</h3>{pendingMine ? <><p>보드의 강조 표시와 결과를 확인하고 확정하세요.</p><div className="pc-choice-list">{g.pending.choices.map(c => <button key={c.id} disabled={blocked} onClick={() => choosePending(c)}>{c.label}</button>)}</div></> : <p>{name(g.pending.actor)}님의 선택을 기다립니다.</p>}</div>}
 {loc && <div className="pc-location-detail" ref={detailRef}><span className="pc-eyebrow">{PERCH_LOCATION_INFO[loc.definitionId].english}</span><h3>{PERCH_LOCATION_INFO[loc.definitionId].name}</h3><p>{PERCH_LOCATION_INFO[loc.definitionId].description}</p><div className="pc-score-preview"><span>지금 정산한다면{chosenBird && !g.placed && mode === 'PLACE' ? ' · 배치 전 → 후' : ''}</span>{Array.from({ length: Math.max(3, g.playerStates.length) }, (_, f) => { const before = perchRanks(loc).find(r => r.flock === f), after = preview.find(r => r.flock === f); return <div key={f}><span style={{ color: PERCH_FLOCK_COLORS[f] }}>{PERCH_FLOCK_MARKS[f]} {g.playerStates.find(p => p.flock === f) ? name(g.playerStates.find(p => p.flock === f)!.playerId) : '중립'}</span><span>{f >= g.playerStates.length ? '득점 없음' : `${before?.points ?? 0} → ${after?.points ?? 0}점`}</span></div>; })}</div>
 {canAct && <><div className="pc-mode-tabs">{(['PLACE', 'HOUSE', 'ZAP'] as const).map(m => <button key={m} aria-pressed={mode === m} disabled={m === 'PLACE' ? g.placed : g.bonusUsed || (m === 'HOUSE' ? !me.house : !me.lightning)} onClick={() => { setMode(m); setDraft(null); props.selectSound(); }}>{m === 'PLACE' ? '새 배치' : m === 'HOUSE' ? '⌂ 새집' : 'ϟ 번개'}</button>)}</div>
 {mode === 'PLACE' && !g.placed && <>{chosenBird ? <><p><b>{PERCH_FLOCK_NAMES[chosenBird.flock]} 새</b>를 이 장소에 놓습니다.</p>{loc.stacks.some(st => st.flock === chosenBird.flock && st.house) ? <p>이 무리는 새집으로 보호되어 새를 추가할 수 없습니다.</p> : <><label className="pc-nest-select">앉을 곳<select aria-label="앉을 둥지" value={nest ?? 'ground'} onChange={e => { setNest(e.target.value === 'ground' ? null : Number(e.target.value)); setDraft(null); }}><option value="ground">{loc.stacks.find(st => st.flock === chosenBird.flock)?.nest !== null && loc.stacks.find(st => st.flock === chosenBird.flock)?.nest !== undefined ? '기존 둥지 무리에 합류' : '가지에 앉기'}</option>{loc.nests.map((exists, i) => exists && !loc.stacks.some(st => st.nest === i && st.flock !== chosenBird.flock) && !loc.stacks.some(st => st.flock === chosenBird.flock && st.nest !== null && st.nest !== i) ? <option key={i} value={i}>둥지 {i + 1} · 유효 새 수 +1</option> : null)}</select></label><button className="pc-primary" disabled={blocked} onClick={() => choose({ type: 'PLACE', birdId: chosenBird.birdId, tileId: loc.tileId, nest }, `${PERCH_FLOCK_NAMES[chosenBird.flock]} 새 → ${PERCH_LOCATION_INFO[loc.definitionId].name}`, nest === null ? '새 1마리를 배치합니다.' : '둥지에 배치하고 같은 색 무리를 합칩니다.')}>이곳에 배치하기</button></>}</> : <p>위에서 배치할 새를 먼저 골라주세요.</p>}</>}
 {mode === 'HOUSE' && !g.bonusUsed && me.house && loc.stacks.filter(st => !st.house).map(st => <button className="pc-action-option" key={st.flock} onClick={() => choose({ type: 'HOUSE', tileId: loc.tileId, flock: st.flock }, `${PERCH_FLOCK_NAMES[st.flock]} 무리에 새집 건설`, '새 수 +1. 이후 이 무리에 새를 추가하거나 제거할 수 없습니다. 보너스 1회 소모.')}><PerchBirdToken flock={st.flock} small/>새 {st.birds.length}마리 보호</button>)}
 {mode === 'ZAP' && !g.bonusUsed && me.lightning && <>{loc.stacks.filter(st => !st.house).map(st => <button className="pc-action-option" key={st.flock} onClick={() => choose({ type: 'ZAP', tileId: loc.tileId, birdId: st.birds[0]!.birdId, nest: null }, `${PERCH_FLOCK_NAMES[st.flock]} 새에 번개 사용`, '새 1마리가 분수로 갑니다. 그 새의 주인이 분수 위치를 선택합니다.')}><PerchBirdToken flock={st.flock} small/>새 1마리 분수로</button>)}{loc.nests.map((exists, i) => exists && !loc.stacks.some(st => st.nest === i) ? <button key={i} onClick={() => choose({ type: 'ZAP', tileId: loc.tileId, birdId: null, nest: i }, `빈 둥지 ${i + 1} 제거`, '이 둥지를 게임에서 제거합니다. 보너스 1회 소모.')}>◎ 빈 둥지 {i + 1} 제거</button> : null)}</>}
 </>}
 </div>}
 {g.phase === 'ROUND_END' && <div className="pc-round-result"><h3>{g.round}라운드의 노래</h3>{g.playerStates.map(p => <p key={p.playerId}>{name(p.playerId)}<b>+{g.roundScores.filter(r => r.playerId === p.playerId).reduce((n, r) => n + r.points, 0)}점</b></p>)}<details><summary>장소별 득점 확인</summary>{g.roundScores.filter(r => r.points > 0).map((r, i) => <p key={i}>{r.source} · {name(r.playerId)} +{r.points}</p>)}</details><button className="pc-primary" disabled={blocked || g.activePlayerId !== self} onClick={() => void submit({ type: 'CONTINUE' })}>{g.activePlayerId === self ? '다음 라운드로 →' : `${name(g.activePlayerId)}님이 다음 라운드를 시작합니다`}</button></div>}
 <details className="pc-log"><summary>숲의 기록 · {g.history.length}</summary><ol>{[...g.history].reverse().map(l => <li key={l.id}><span>{l.id}</span>{l.text}</li>)}</ol></details>
 </aside></div>

 {g.privateState.objective && <details className="pc-my-objective"><summary>나의 비밀 목표 · {PERCH_OBJECTIVE_INFO[g.privateState.objective].name}</summary><p>{PERCH_OBJECTIVE_INFO[g.privateState.objective].description} · {PERCH_OBJECTIVE_INFO[g.privateState.objective].points}점</p></details>}
 <details className="pc-other-hands"><summary>다른 플레이어가 배치할 새</summary><div>{g.playerStates.filter(p => p.playerId !== self).map(p => <div key={p.playerId}><strong>{name(p.playerId)}</strong>{p.hand.map(b => <PerchBirdToken key={b.birdId} flock={b.flock} small/>)}</div>)}</div></details>
 {draft && <div className="pc-confirm-overlay"><div className="pc-confirm" role="dialog" aria-modal="true" aria-label="행동 확정" onKeyDown={e => { if (e.key === 'Escape' && !busy)
        setDraft(null); if (e.key === 'Tab') {
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }}><span className="pc-eyebrow">READY TO PERCH?</span><h3>{draft.title}</h3><p>{draft.description}</p><div><button autoFocus className="pc-primary" disabled={blocked} onClick={() => void submit(draft.action)}>확정</button><button disabled={busy} onClick={() => { setDraft(null); setHighlight([]); }}>다시 선택</button></div></div></div>}
 </>;
}
