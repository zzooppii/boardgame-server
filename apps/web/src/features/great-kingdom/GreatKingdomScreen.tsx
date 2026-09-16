import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {PROTOCOL_VERSION, greatKingdomCoordinate, type GreatKingdomClientCommand, type GreatKingdomProjection, type GreatKingdomAction} from '@hangul-rummikub/shared';
import type {GreatKingdomWebSnapshot} from '../../lib/snapshot-wire-decoder.js';
import {createRequestId} from '../../lib/request-id.js';
import {getGameStartControl} from '../../lib/game-start.js';
import {GreatKingdomCommandRejected} from '../../lib/great-kingdom-command-error.js';
import {Castle, KingdomIllustration} from './art.js';
import {greatKingdomCellReason, greatKingdomScope, greatKingdomSelection} from './ui.js';
import {useKingdomSound, type KingdomCue} from './sound.js';
type Props = Readonly<{snapshot: GreatKingdomWebSnapshot; connected: boolean; pending: boolean; error: string | null; connectionLabel: string;
  onCommand(command: GreatKingdomClientCommand): Promise<void>; onRematch(): void; onStart(): void; onLeave(): void; onCopy(): void}>;
export function GreatKingdomScreen(props: Props) {
  const s = props.snapshot, start = getGameStartControl(s, props.pending || !props.connected);
  const sound = useKingdomSound(s.game, props.connected, s.self.playerId);
  const [help, setHelp] = useState(false);
  return <section className="gk-root" aria-label="그레이트 킹덤" onPointerDown={() => void sound.unlock()} onKeyDown={() => void sound.unlock()}>
    <header className="gk-header"><div className="gk-brand"><Castle color="NEUTRAL"/><div><span className="gk-eyebrow">GREAT KINGDOM</span><h1>그레이트 킹덤</h1></div></div>
      <div className="gk-tools"><span className={`gk-connection ${props.connected ? 'is-online' : ''}`} role="status">{props.connectionLabel}</span><button type="button" onClick={props.onCopy} disabled={props.pending}>초대 · {s.room.roomCode}</button><button type="button" onClick={() => setHelp(!help)} aria-expanded={help}>게임 방법</button><button type="button" onClick={props.onLeave} disabled={props.pending}>나가기</button></div></header>
    {props.error && <p className="gk-error" role="alert">{props.error}</p>}
    {help && <section className="gk-help" aria-label="게임 방법"><div><span className="gk-eyebrow">HOW TO PLAY</span><h2>영토를 넓히고, 성을 지키세요.</h2><button type="button" onClick={() => setHelp(false)} aria-label="게임 방법 닫기">닫기</button></div>
      <ol><li><strong>성을 하나씩</strong> 파랑부터 번갈아 빈칸을 선택하고 성 놓기로 확정합니다. 대각선은 연결되지 않습니다.</li><li><strong>둘러싸면 내 영토</strong> 내 성과 가장자리·중립 성으로 둘러싼 빈칸이 영토입니다. 상대 성이 섞였거나 네 변을 모두 쓰는 영역은 제외합니다. 중립 성을 둘러싸면 그 칸도 영토입니다.</li><li><strong>상대 영토에는 배치 불가</strong> 빗금 친 상대 영토에 들어갈 수 없습니다. 내 영토에 놓으면 그만큼 빈 영토가 줄어듭니다.</li><li><strong>성 하나만 파괴해도 승리</strong> 연결된 성 묶음의 상하좌우 빈틈을 모두 막으면 공성 승리입니다. 양쪽이 동시에 막히면 방금 둔 쪽이 이깁니다. 내 마지막 빈틈을 막으면 패배할 수 있습니다.</li><li><strong>둘 다 패스하면 영토 비교</strong> 연속 패스 두 번으로 종료합니다. 영토가 1칸이라도 많은 쪽이 승리하며, 같으면 무승부입니다.</li></ol>
      <p>시간 제한 없음 · 무르기 없음 · 연결이 끊기면 재접속 가능 · 나가기는 이번 판 취소</p></section>}
    {s.game === null ? <div className="gk-lobby"><div className="gk-lobby-copy"><span className="gk-eyebrow">TWO KINGDOMS · ONE BOARD</span><h2>한 수를 놓고,<br/>왕국을 넓히세요.</h2><p>성 하나를 지키는 신중함.<br/>상대를 둘러싸는 대담함.<br/>작은 보드 위에 두 사람의 전략이 펼쳐집니다.</p><div className="gk-lobby-meta"><span>2인 전용</span><span>시간 제한 없음</span><span>영토 · 공성</span></div></div><KingdomIllustration/>
      <div className="gk-lobby-bottom"><div className="gk-seats">{s.room.players.map(p => <div key={p.playerId}><span className="gk-avatar">{p.nickname.slice(0, 1)}</span><div><strong>{p.nickname}</strong><small>{p.connectionStatus === 'CONNECTED' ? '접속 중' : '재접속 대기'}{p.isHost ? ' · 방장' : ''}</small></div></div>)}{s.room.players.length === 1 && <button type="button" className="gk-empty-seat" onClick={props.onCopy}>＋ 상대 초대하기</button>}</div><div><p>{start.guidance}</p><button type="button" className="gk-primary" disabled={!start.canStart} onClick={() => {sound.play('TURN'); props.onStart();}}>왕국 건설 시작 <span aria-hidden="true">↗</span></button></div></div>
    </div> : <KingdomTable key={s.game.gameId} {...props} game={s.game} play={sound.play}/>}
    <footer className="gk-footer"><span>GREAT KINGDOM <i>·</i> 한 수에 담긴 전략</span><div className="gk-sound"><button type="button" onClick={() => {void sound.unlock(); sound.setVolume(sound.volume ? 0 : 35);}} aria-label={sound.volume ? '효과음 끄기' : '효과음 켜기'} aria-pressed={sound.volume > 0}>{sound.volume ? '♪ 효과음' : '♪ 음소거'}</button><label>음량 <input aria-label="효과음 음량" type="range" min="0" max="100" step="5" value={sound.volume} onChange={e => sound.setVolume(Number(e.target.value))}/></label><button type="button" onClick={() => void sound.unlock().then(() => sound.play('PLACE'))}>소리 듣기</button>{!sound.enabled && <span className="gk-audio-hint">조작하면 소리가 켜집니다</span>}</div></footer>
  </section>;
}
function KingdomTable({game: g, play, ...props}: Props & {game: GreatKingdomProjection; play(cue: KingdomCue): void}) {
  const selfId = props.snapshot.self.playerId, scope = greatKingdomScope(g);
  const [selection, setSelection] = useState<{scope: string; position: number} | null>(null), [passConfirm, setPassConfirm] = useState(false);
  const [flight, setFlight] = useState(false), [message, setMessage] = useState<string | null>(null), [retry, setRetry] = useState<GreatKingdomClientCommand | null>(null);
  const [showTerritory, setShowTerritory] = useState(true), [zoom, setZoom] = useState(false), [showAll, setShowAll] = useState(false);
  const pendingRef = useRef<GreatKingdomClientCommand | null>(null), mounted = useRef(true), scopeRef = useRef(scope), boardRef = useRef<HTMLDivElement>(null);
  scopeRef.current = scope;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {setSelection(null); setRetry(null); setMessage(null); setPassConfirm(false);}, [scope]);
  const selected = greatKingdomSelection(g, selfId, selection?.scope === scope ? selection.position : null);
  const mine = g.playerStates.find(p => p.playerId === selfId)!;
  const other = g.playerStates.find(p => p.playerId !== selfId)!;
  const nickname = (id: string) => props.snapshot.room.players.find(p => p.playerId === id)?.nickname ?? '플레이어';
  const myTurn = g.phase === 'PLAYING' && g.activePlayerId === selfId;
  const canAct = myTurn && props.connected && !props.pending && !flight && retry === null;
  const active = g.phase === 'PLAYING' ? g.playerStates.find(p => p.playerId === g.activePlayerId)! : null;
  const last = g.history.at(-1), placed = [...g.history].reverse().find(h => h.kind === 'PLACE');
  const ownTerritory = selected !== null && g.territoryOwners[selected] === mine.color;
  const rows = showAll ? [...g.history].reverse() : [...g.history].reverse().slice(0, 8);
  async function send(command: GreatKingdomClientCommand) {
    if (pendingRef.current || !props.connected || props.pending) return;
    pendingRef.current = command; setFlight(true); setMessage(null); const sentScope = scope;
    try {await props.onCommand(command); if (mounted.current && scopeRef.current === sentScope) {setRetry(null); setSelection(null); setPassConfirm(false);}}
    catch (error) {if (mounted.current && scopeRef.current === sentScope) {
      if (error instanceof GreatKingdomCommandRejected) {setRetry(null); setMessage(error.message); play('ERROR');}
      else {setRetry(command); setMessage('응답을 확인하지 못했습니다. 같은 요청의 결과를 다시 확인해주세요.');}
    }} finally {if (pendingRef.current === command) pendingRef.current = null; if (mounted.current) setFlight(false);}
  }
  function submit(payload: GreatKingdomAction) {
    if (!canAct || g.phase !== 'PLAYING') return;
    void send({kind: 'greatKingdom:act', protocolVersion: PROTOCOL_VERSION, requestId: createRequestId(), gameId: g.gameId,
      expectedGameRevision: g.gameRevision, turnId: g.turnId, payload});
  }
  function select(position: number) {
    if (!canAct) return;
    setSelection({scope, position}); setPassConfirm(false); play('SELECT');
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    if (event.key === 'Escape') {setSelection(null); setPassConfirm(false); play('CANCEL'); return;}
    const delta = {ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1}[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    let i = position + delta;
    while (i >= 0 && i < 81 && (Math.abs(delta) === 9 || Math.floor(i / 9) === Math.floor(position / 9))) {
      if (g.phase === 'PLAYING' && g.legalPositions.includes(i)) {boardRef.current?.querySelector<HTMLButtonElement>(`[data-position="${i}"]`)?.focus(); return;} i += delta;
    }
  }
  return <>
    <div className="gk-matchbar"><span><span className="gk-live-dot"/> {g.phase === 'PLAYING' ? `${g.history.length + 1}번째 수` : '대국 종료'}</span><span>영토가 1칸이라도 많으면 승리</span><span>{last ? `${nickname(last.playerId)} · ${last.position === null ? '패스' : greatKingdomCoordinate(last.position)}` : '첫 수를 기다립니다'}</span></div>
    <div className="gk-layout"><main className="gk-main">
      <div className="gk-players">{g.playerStates.map(p => <section key={p.playerId} className={`gk-player gk-${p.color.toLowerCase()} ${active?.playerId === p.playerId ? 'is-active' : ''}`} aria-label={`${nickname(p.playerId)} 왕국`}>
        <Castle color={p.color}/><div className="gk-player-name"><small>{p.color === 'BLUE' ? '파랑 · 선공' : '주황 · 후공'}{p.playerId === selfId ? ' · 나' : ''}</small><strong title={nickname(p.playerId)}>{nickname(p.playerId)}</strong><span>{props.snapshot.room.players.find(r => r.playerId === p.playerId)?.connectionStatus === 'CONNECTED' ? active?.playerId === p.playerId ? '생각하는 중' : '접속 중' : '재접속 대기'}</span></div><div className="gk-player-score"><strong>{p.territory}<small>칸</small></strong><span>남은 성 {p.remaining}</span></div>
      </section>)}</div>
      <div className={`gk-board-scroll ${zoom ? 'is-zoomed' : ''}`}><div className="gk-board-frame"><div className="gk-coordinate-top" aria-hidden="true">{'ABCDEFGHI'.split('').map(c => <span key={c}>{c}</span>)}</div><div className="gk-coordinate-side" aria-hidden="true">{Array.from({length: 9}, (_, i) => <span key={i}>{9 - i}</span>)}</div>
        <div ref={boardRef} className={`gk-board ${showTerritory ? 'show-territory' : ''}`} role="group" aria-label="9×9 왕국 보드">
          {g.board.map((cell, i) => {const owner = g.territoryOwners[i], legal = g.phase === 'PLAYING' && g.legalPositions.includes(i), chosen = selected === i;
            const destroyed = g.phase === 'FINISHED' && g.result.destroyedPositions.includes(i);
            const name = `${greatKingdomCoordinate(i)} · ${greatKingdomCellReason(g, i)}${chosen ? ' · 선택됨' : ''}${destroyed ? ' · 공성으로 파괴' : ''}`;
            return <button key={i} type="button" data-position={i} data-owner={owner ?? ''} className={`gk-cell ${chosen ? 'is-selected' : ''} ${placed?.position === i ? 'is-last' : ''} ${destroyed ? 'is-destroyed' : ''} ${legal && canAct ? 'is-legal' : ''}`}
              disabled={!canAct || !legal} aria-label={name} aria-pressed={chosen} title={name} onClick={() => select(i)} onKeyDown={event => keyboard(event, i)}>
              {owner && <span className="gk-territory-mark" aria-hidden="true">{owner === 'BLUE' ? '●' : '◆'}</span>}
              {cell ? <Castle color={cell.color}/> : chosen ? <Castle color={mine.color} ghost/> : <span className="gk-placement-dot" aria-hidden="true"/>}
              {placed?.position === i && <span className="gk-last-marker" aria-hidden="true"/>}
              {destroyed && <span className="gk-destroyed-mark" aria-hidden="true">×</span>}
            </button>;})}
        </div><div className="gk-board-signature" aria-hidden="true">G R E A T　K I N G D O M</div></div></div>
      <div className="gk-board-tools"><label><input type="checkbox" checked={showTerritory} onChange={e => setShowTerritory(e.target.checked)}/>영토 표시</label><span>● 파랑 영토　◆ 주황 영토</span><button type="button" className="gk-zoom" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? '전체 보기' : '보드 확대'}</button></div>
      {g.phase === 'PLAYING' ? <section className={`gk-action-panel ${myTurn ? 'is-mine' : ''}`} aria-label="내 차례 행동"><div className="gk-turn-status" role="status"><span className="gk-eyebrow">{myTurn ? 'YOUR TURN' : 'OPPONENT’S TURN'}</span><h2>{!props.connected ? '다시 연결하고 있습니다' : flight ? '수를 전달하고 있습니다' : myTurn ? passConfirm ? '이번 차례를 패스할까요?' : selected !== null ? `${greatKingdomCoordinate(selected)}에 성을 놓습니다` : '어디에 성을 세울까요?' : `${nickname(other.playerId)}의 차례입니다`}</h2><p>{passConfirm ? g.consecutivePasses === 1 ? '상대도 패스했습니다. 확정하면 영토를 계산하고 종료합니다.' : '성을 놓지 않고 상대에게 차례를 넘깁니다.' : ownTerritory ? '내 영토에 놓으면 영토가 1칸 줄어듭니다.' : myTurn ? g.legalPositions.length === 0 ? '놓을 수 있는 칸이 없습니다. 패스로 차례를 넘겨주세요.' : '빈칸을 선택한 뒤 확정하세요. 확정 전에는 바꿀 수 있습니다.' : last?.kind === 'PASS' ? '패스가 이어지면 대국이 끝납니다.' : '상대의 마지막 수는 작은 테두리로 표시됩니다.'}</p></div>
        <div className="gk-action-buttons">{passConfirm ? <><button type="button" className="gk-primary" disabled={!canAct} onClick={() => submit({kind: 'PASS'})}>{g.consecutivePasses === 1 ? '패스하고 영토 계산' : '패스 확정'}</button><button type="button" disabled={flight} onClick={() => setPassConfirm(false)}>계속 생각하기</button></> : <><button type="button" className="gk-primary" disabled={!canAct || selected === null} onClick={() => selected !== null && submit({kind: 'PLACE', position: selected})}>{selected === null ? '성을 선택하세요' : `${greatKingdomCoordinate(selected)}에 성 놓기`}</button><button type="button" disabled={!canAct || selected === null} onClick={() => {setSelection(null); play('CANCEL');}}>선택 취소</button><button type="button" disabled={!canAct} onClick={() => {setSelection(null); setPassConfirm(true); play('SELECT');}}>패스</button></>}</div>
      </section> : <section className={`gk-result ${g.result.winnerPlayerIds.includes(selfId) ? 'is-winner' : ''}`} role="status"><span className="gk-eyebrow">{g.result.reason === 'SIEGE' ? 'SIEGE VICTORY' : g.result.reason === 'TERRITORY' ? 'THE FINAL KINGDOM' : 'GAME CANCELLED'}</span><h2>{g.result.reason === 'CANCELLED' ? '대국이 취소되었습니다' : g.result.winnerPlayerIds.length === 0 ? '무승부' : `${nickname(g.result.winnerPlayerIds[0]!)} 승리`}</h2><p>{g.result.reason === 'SIEGE' ? `표시된 성 ${g.result.destroyedPositions.length}개의 빈틈이 모두 막혔습니다. 영토보다 공성 승리가 우선합니다.` : g.result.reason === 'TERRITORY' ? `파랑 ${g.playerStates[0]!.territory}칸 · 주황 ${g.playerStates[1]!.territory}칸. 영토가 많은 쪽이 승리하며, 같으면 무승부입니다.` : '플레이어가 나가 이번 판을 종료했습니다. 승패는 기록하지 않습니다.'}</p>{props.snapshot.room.players.some(p => p.playerId === selfId && p.isHost) ? <button type="button" className="gk-primary" disabled={!props.connected || props.pending} onClick={props.onRematch}>같은 방에서 다시 시작</button> : <p>방장이 다음 대국을 준비할 수 있습니다.</p>}</section>}
      {(message || retry) && <div className="gk-error" role="alert"><p>{message}</p>{retry && <button type="button" disabled={!props.connected || flight || props.pending} onClick={() => void send(retry)}>같은 요청 결과 재확인</button>}</div>}
    </main><aside className="gk-sidebar"><section className="gk-objective"><span className="gk-eyebrow">BUILD YOUR KINGDOM</span><h2>넓은 영토,<br/>견고한 왕국.</h2><div className="gk-objective-castles"><Castle color="BLUE"/><Castle color="ORANGE"/></div><p>영토를 넓히거나<br/>상대 성을 하나라도 포위하세요.</p><div className="gk-score-rule"><strong>영토 승리</strong><span>상대보다 1칸이라도 많으면 승리<br/>같으면 무승부</span></div></section>
      <section className="gk-history"><div className="gk-section-heading"><h2>대국 기록</h2><span>{g.history.length}수</span></div>{rows.length ? <ol>{rows.map(h => <li key={h.move}><span className="gk-move-number">{String(h.move).padStart(2, '0')}</span><span className={`gk-history-color gk-${h.color.toLowerCase()}`}>{h.color === 'BLUE' ? '●' : '◆'}</span><span className="gk-history-name" title={nickname(h.playerId)}>{nickname(h.playerId)}</span><strong>{h.position === null ? '패스' : greatKingdomCoordinate(h.position)}</strong></li>)}</ol> : <p className="gk-history-empty">첫 번째 성이<br/>이야기의 시작입니다.</p>}{g.history.length > 8 && <button type="button" onClick={() => setShowAll(!showAll)}>{showAll ? '최근 8수만 보기' : '전체 기록 보기'}</button>}</section>
      <p className="gk-keyboard-tip">방향키로 칸 이동 · Enter로 선택<br/>Escape로 선택 취소</p>
    </aside></div>
  </>;
}
