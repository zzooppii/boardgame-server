import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DUEL_CARDS, DUEL_WONDERS, DUEL_GODS, DUEL_DECREES, PROTOCOL_VERSION, type DuelProjection, type DuelClientCommand, type DuelOption } from '@hangul-rummikub/shared';
import type { DuelWebSnapshot } from '../../lib/snapshot-wire-decoder.js';
import { getGameStartControl } from '../../lib/game-start.js';
import { createRequestId } from '../../lib/request-id.js';
import { DuelCommandRejected } from '../../lib/duel-command-error.js';
import { Atlas, Card, Cost, DetailArt, definition, effectText, wonderText } from './art.js';
import { useDuelSound } from './sound.js';
import './duel.css';
type Props = {
    snapshot: DuelWebSnapshot;
    connected: boolean;
    pending: boolean;
    error: string | null;
    connectionLabel: string;
    onCommand(c: DuelClientCommand): Promise<void>;
    onRematch(): void;
    onStart(): void;
    onLeave(): void;
    onCopy(): void;
};
function Modal({ children, close, label }: {
    children: ReactNode;
    close(): void;
    label: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
    return <dialog ref={ref} className="du-modal" aria-label={label} onCancel={close} onClick={e => {
            if (e.target === e.currentTarget)
                close();
        }}><button className="du-modal-close" onClick={close} aria-label="닫기">×</button>{children}</dialog>;
}
export default function DuelScreen(props: Props) {
    const g = props.snapshot.game, sound = useDuelSound(g, props.connected), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false), saved = useRef<DuelClientCommand | null>(null), start = getGameStartControl(props.snapshot, props.pending || busy || !props.connected);
    const revision = g?.gameRevision ?? props.snapshot.versions.roomRevision;
    useEffect(() => { saved.current = null; setUncertain(false); setError(null); }, [g?.gameId, revision]);
    async function send(command: DuelClientCommand) {
        if (busy || !props.connected)
            return;
        saved.current = command;
        setBusy(true);
        setError(null);
        try {
            await props.onCommand(command);
            saved.current = null;
            setUncertain(false);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : '요청을 확인하지 못했습니다.');
            setUncertain(saved.current === command && !(e instanceof DuelCommandRejected));
            sound.play('error');
        }
        finally {
            setBusy(false);
        }
    }
    const can = props.connected && !props.pending && !busy && !uncertain;
    return <section className="du-screen" onPointerDownCapture={() => void sound.unlock()} onKeyDownCapture={e => {
            if (e.key === 'Enter' || e.key === ' ')
                void sound.unlock();
        }}>
 <header className="du-header"><div className="du-brand"><b>7</b><div><span>WONDERS</span><h1>DUEL <small>7 원더스 듀얼</small></h1></div></div><nav aria-label="게임 도구"><span className={props.connected ? 'du-online' : 'du-offline'}>{props.connectionLabel}</span><details><summary>♫ 소리 {sound.volume === 0 ? '꺼짐' : ''}</summary><label>효과음 <input aria-label="효과음 음량" type="range" min="0" max="100" value={sound.volume} onChange={e => sound.setVolume(Number(e.target.value))}/></label><button onClick={() => sound.setVolume(sound.volume ? 0 : 30)}>{sound.volume ? '음소거' : '소리 켜기'}</button><button onClick={() => void sound.unlock().then(() => sound.play('wonder'))}>미리 듣기</button></details><button onClick={props.onCopy}>초대 · {props.snapshot.room.roomCode}</button><button onClick={props.onLeave} disabled={props.pending}>나가기</button></nav></header>
 {!props.connected && <p className="du-alert" role="status">연결을 복구하고 있습니다. 진행 중인 선택은 다시 접속하면 이어집니다.</p>}{(props.error || error) && <p className="du-alert" role="alert">{error ?? props.error}{uncertain && <button disabled={busy || !props.connected} onClick={() => {
                    if (saved.current)
                        void send(saved.current);
                }}>처리 결과 다시 확인</button>}</p>}
 {g ? <Table key={g.gameId + props.snapshot.self.playerId} {...props} game={g} canAct={can} busy={busy} choose={o => {
                if (g.phase === 'PLAYING')
                    void send({ protocolVersion: PROTOCOL_VERSION, kind: 'duel:act', requestId: createRequestId(), gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId, payload: { type: 'SELECT', optionId: o.id } });
            }} selectSound={() => sound.play('select')}/> : <div className="du-lobby"><div className="du-lobby-scene"><Atlas index={8}/><div><span>BUILD A CIVILIZATION</span><h2>두 문명.<br />하나의 역사.</h2><p>당신의 다음 선택이<br />고대 세계를 바꿉니다.</p></div><div className="du-lobby-god"><Atlas index={8} gods/></div></div><div className="du-lobby-panel"><span className="du-eyebrow">THE TABLE IS SET</span><h2>어떤 역사를 만들까요?</h2><p>불가사의, 과학, 군사력. 그리고 신들의 힘과 원로원의 영향력까지.</p><div className="du-expansions">{(['pantheon', 'agora'] as const).map((key, i) => <label key={key}><Atlas index={i ? 14 : 12}/><span><strong>{i ? 'Agora' : 'Pantheon'}</strong><small>{i ? '의원 · 음모 · 정치 승리' : '신화 · 판테온 · 대신전'}</small></span><input type="checkbox" checked={'settings' in props.snapshot.room ? props.snapshot.room.settings[key] : true} disabled={!can || !start.isHost} onChange={e => { const settings = 'settings' in props.snapshot.room ? props.snapshot.room.settings : { pantheon: true, agora: true }; void send({ protocolVersion: PROTOCOL_VERSION, kind: 'duel:configure', requestId: createRequestId(), expectedRoomRevision: props.snapshot.versions.roomRevision, payload: { ...settings, [key]: e.target.checked } }); }}/></label>)}</div><div className="du-lobby-players">{props.snapshot.room.players.map((p, i) => <div key={p.playerId}><b>{i + 1}</b><span>{p.nickname}<small>{p.connectionStatus === 'CONNECTED' ? '접속 중' : '재접속 대기'}</small></span>{p.isHost && <small>방장</small>}</div>)}{props.snapshot.room.players.length === 1 && <button onClick={props.onCopy}>+ 상대 초대하기</button>}</div><button className="du-primary" disabled={!start.canStart} onClick={props.onStart}>문명 건설 시작 →</button><small>{start.guidance}</small><p className="du-lobby-note">2인 · 기본판 또는 확장 조합 · 턴 제한 없이<br />카드를 눌러 확대하고, 행동을 선택한 뒤 확정하세요.</p></div></div>}
 </section>;
}
function Table(props: Props & {
    game: DuelProjection;
    canAct: boolean;
    busy: boolean;
    choose(o: DuelOption): void;
    selectSound(): void;
}) {
    const g = props.game, self = props.snapshot.self.playerId, me = g.playerStates.find(p => p.playerId === self)!, other = g.playerStates.find(p => p.playerId !== self)!, seat = g.playerStates[0]!.playerId === self ? 0 : 1;
    const [inspect, setInspect] = useState<{
        id: string | null;
        source: string;
    } | null>(null), [option, setOption] = useState<string | null>(null), [reference, setReference] = useState(false), [ledger, setLedger] = useState(false);
    const options = g.privateState.options, selected = options.find(o => o.id === option), mine = g.decision?.playerId === self, can = props.canAct && mine && g.phase === 'PLAYING', name = (id: string) => props.snapshot.room.players.find(p => p.playerId === id)?.nickname ?? '플레이어';
    useEffect(() => { setOption(null); setInspect(null); }, [g.gameRevision]);
    function inspectCard(id: string | null, source: string) { setInspect({ id, source }); setOption(null); props.selectSound(); }
    const actions = inspect ? options.filter(o => o.sourceId === inspect.source || o.targetId === inspect.source || o.definitionId === inspect.id) : [];
    const maxX = Math.max(...g.slots.map(s => s.x)) + 1, maxY = Math.max(...g.slots.map(s => s.y));
    const wonderList = (playerId: string) => <div className="du-wonder-grid">{g.wonders.filter(w => w.owner === playerId).map(w => { const d = DUEL_WONDERS.find(d => d.id === w.id)!; return <button key={w.id} className={`du-wonder ${w.built ? 'built' : ''} ${w.removed ? 'removed' : ''}`} onClick={() => inspectCard(w.id, w.id)}><Atlas index={d.art}/><span className="du-wonder-caption"><strong>{d.name}</strong><small>{w.removed ? '제거됨' : w.built ? '✓ 건설 완료' : `${d.points}점${d.replay ? ' · ↻' : ''}`}</small></span>{!w.built && !w.removed && <Cost cost={d.cost}/>}</button>; })}</div>;
    const city = (p: typeof me) => <section className={`du-city ${p.playerId === self ? 'own' : ''}`}><div className="du-player-row"><b className="du-avatar">{p.playerId === self ? '나' : '상대'}</b><strong>{name(p.playerId)}</strong><span className="du-money">● {p.coins}</span>{p.protectedCoins > 0 && <span>보호 ● {p.protectedCoins}</span>}<span title="서로 다른 과학 기호 6개로 승리">✧ {new Set(p.science).size}/6</span><span>{p.buildings.length} 건물</span></div><div className="du-city-cards">{p.buildings.map(c => <button key={c.tileId} className={`du-city-chip du-${DUEL_CARDS.find(d => d.id === c.definitionId)!.color}`} onClick={() => inspectCard(c.definitionId, c.tileId)}>{definition(c.definitionId!)?.name}</button>)}{!p.buildings.length && <span className="du-empty">아직 건설한 건물이 없습니다</span>}</div><div className="du-inventory">{p.progress.map(id => <button key={id} onClick={() => inspectCard(id, id)} className="du-progress">❧ {definition(id)?.name}</button>)}{p.gods.map(id => <button key={id} onClick={() => inspectCard(id, id)}>✦ {definition(id)?.name}</button>)}{p.mythology.map((id, i) => <span key={i} title={id}>신화 {id.slice(0, 3)}</span>)}{p.offerings.map((n, i) => <span key={i}>공물 {n}</span>)}{p.conspiracies.map(c => <button key={c.id} className="du-conspiracy" onClick={() => inspectCard(c.definitionId, c.id)}>{c.triggered ? '✓' : c.prepared ? '◆' : '◇'} {c.definitionId ? definition(c.definitionId)?.name : '비공개 음모'}</button>)}</div></section>;
    const pyramid = <div><span className="du-scroll-hint">↔ 배치를 좌우로 밀어 모든 카드를 확인하세요</span><div className="du-pyramid-scroll"><div className="du-pyramid" style={{ '--du-columns': maxX, width: `${maxX * 103 + 30}px`, height: `${maxY * 69 + 160}px` } as CSSProperties}>{g.board.map(c => { const slot = g.slots.find(s => s.index === c.slot)!, available = !slot.coveredBy.some(i => g.board.some(b => b.slot === i)), build = options.find(o => o.group === 'BUILD' && o.sourceId === c.tileId); return <Card key={c.tileId} id={c.definitionId} back={c.back} available={available} style={{ left: 15 + slot.x * 103, top: slot.y * 69, zIndex: slot.y + 1 }} onClick={() => inspectCard(c.definitionId, c.tileId)} tag={slot.mythology ? '✦ 신화' : slot.offering ? `공물 ${slot.offering}` : available ? (build ? `${build.cost} ●` : '선택 가능') : undefined}/>; })}</div></div></div>;
    return <div className="du-table"><div className="du-table-heading"><div><span className="du-eyebrow">{g.settings.pantheon ? 'PANTHEON · ' : ''}{g.settings.agora ? 'AGORA · ' : ''}TWO CIVILIZATIONS</span><h2>{g.phase === 'FINISHED' ? '역사의 한 페이지' : g.stage === 'DRAFT' ? '불가사의를 선택하세요' : `시대 ${['I', 'II', 'III'][g.age - 1]}`}</h2></div><div><button onClick={() => setReference(true)}>⛓ 건물·연계표</button><button onClick={() => setLedger(true)}>기록 · 버린 카드</button></div></div>
 {g.phase === 'FINISHED' && <section className="du-result"><span className="du-eyebrow">{g.result.reason}</span><h2>{g.result.reason === 'CANCELLED' ? '이번 게임이 취소되었습니다' : g.result.winnerPlayerIds.length === 2 ? '두 문명의 공동 승리' : `${name(g.result.winnerPlayerIds[0]!)}님의 승리`}</h2><div>{g.result.scores.map(s => <article key={s.playerId}><strong>{name(s.playerId)}</strong><b>{s.total}<small>점</small></b><p>건물 {s.blue + s.green + s.yellow + s.guild} · 불가사의 {s.wonders}<br />진보 {s.progress} · 코인 {s.coins} · 군사 {s.military}<br />신·대신전 {s.gods + s.temples} · 원로원 {s.senate}</p></article>)}</div>{props.snapshot.room.players.find(p => p.playerId === self)?.isHost && <button disabled={!props.canAct} className="du-primary" onClick={props.onRematch}>같은 방에서 다시 플레이 →</button>}</section>}
 <div className="du-status" role="status"><span className={mine ? 'active' : ''}/><strong>{g.phase === 'FINISHED' ? '게임 종료' : mine ? '당신의 선택' : '상대의 선택'}</strong><span>{g.decision?.label ?? '결과를 확인하세요'}</span></div>
 {g.settings.pantheon && <section className="du-pantheon"><div className="du-side-title"><span>✦</span><strong>PANTHEON</strong><small>{g.age === 1 ? '신들을 초대하세요' : '카드 대신 신 활성화'}</small></div>{g.pantheon.map((slot, i) => <button key={i} className={`du-god ${slot.godId ? 'revealed' : ''}`} onClick={() => inspectCard(slot.godId, String(i))}><span className="du-god-slot">{i + 1}</span>{slot.godId ? <Atlas index={DUEL_GODS.findIndex(d => d.id === slot.godId)} gods/> : <span className="du-god-seal">{slot.occupied ? '✦' : '◇'}</span>}<strong>{slot.godId ? definition(slot.godId)?.name : slot.occupied ? '비공개 신' : '빈 자리'}</strong><small>나 {slot.costs[seat]} ● · 상대 {slot.costs[1 - seat]} ●</small></button>)}</section>}
 {g.revealedGods.length>0&&<section className="du-public-reveal" aria-label="효과로 공개된 신"><h3>효과로 공개된 신</h3><p>두 플레이어가 함께 볼 수 있습니다.</p><div>{g.revealedGods.map(id=><button key={id} className="du-god revealed" onClick={()=>inspectCard(id,id)}><Atlas index={DUEL_GODS.findIndex(d=>d.id===id)} gods/><strong>{definition(id)?.name}</strong><small>공개된 신</small></button>)}</div></section>}
 <div className="du-board-layout"><aside className="du-wonders"><div className="du-section-heading"><span>상대의 불가사의</span><b>{g.wonders.filter(w => w.owner === other.playerId && w.built).length}/{g.wonders.filter(w => w.owner === other.playerId).length}</b></div>{wonderList(other.playerId)}<div className="du-wonders-divider">VII <span>단 7개만 건설할 수 있습니다</span></div><div className="du-section-heading"><span>나의 불가사의</span><b>{g.wonders.filter(w => w.owner === self && w.built).length}/{g.wonders.filter(w => w.owner === self).length}</b></div>{wonderList(self)}</aside>
 <main className="du-board-center">{city(other)}{g.stage === 'DRAFT' ? <><section className="du-draft-grid">{g.draftAvailable.map(id => { const w = DUEL_WONDERS.find(w => w.id === id)!; return <button className="du-draft-wonder" key={id} onClick={() => inspectCard(id, id)}><Atlas index={w.art}/><div><span>WONDER {w.art + 1}</span><h3>{w.name}</h3><Cost cost={w.cost}/><small>{w.points}점 {w.replay ? ' · 추가 턴' : ''}</small></div></button>; })}</section>{g.settings.agora && <details className="du-draft-preview"><summary>시대 I 카드 배치 미리보기</summary>{pyramid}</details>}</> : pyramid}{city(me)}</main>
 <aside className="du-empire"><section className="du-military"><div className="du-section-heading"><span>⚔ 군사력</span><b>{g.military === 0 ? '균형' : `${Math.abs(g.military)}칸`}</b></div><div className="du-military-track">{Array.from({ length: 19 }, (_, i) => i - 9).map(n => <div key={n} className={`du-military-cell ${n === 0 ? 'center' : ''} ${Math.abs(n) === 9 ? 'capital' : ''}`}><span>{Math.abs(n) === 9 ? '♜' : g.militaryTokens.includes(n) ? g.settings.agora ? Math.abs(n) === 3 ? '+◆' : '−◆' : Math.abs(n) === 3 ? '−2' : '−5' : Math.abs(n) === 0 ? '·' : ''}</span>{g.minerva === n && <b title="미네르바">♙</b>}{g.military === n && <b className="du-conflict" title="충돌 말">⚔</b>}</div>)}</div><div className="du-track-labels"><span>{name(g.playerStates[0]!.playerId)} 수도</span><span>{name(g.playerStates[1]!.playerId)} 수도</span></div></section>
 <section className="du-progress-board"><div className="du-section-heading">진보 토큰 <small>같은 기호 한 쌍</small></div><div>{g.progress.map(id => <button key={id} onClick={() => inspectCard(id, id)}><span>❧</span>{definition(id)?.name}</button>)}</div>{g.enki.length > 0 && <p>엔키: {g.enki.map(id => definition(id)?.name).join(' · ')}</p>}</section>
 {g.settings.agora && <section className="du-senate"><div className="du-section-heading"><span>♜ 원로원</span><b>6개 지배로 승리</b></div>{g.decrees.map(ch => <div key={ch.chamber} className={`du-chamber ${ch.controller === self ? 'mine' : ch.controller ? 'theirs' : ''}`}><header><strong>{ch.chamber + 1} 의회</strong><span>{[1, 2, 3, 3, 2, 1][ch.chamber]}❧</span></header><div className="du-cubes"><span>나 ◆ {me.influence[ch.chamber]}</span><span>상대 ◆ {other.influence[ch.chamber]}</span></div>{ch.ids.map((id, i) => <p key={i}>{id ? DUEL_DECREES[id - 1] : '◇ 아직 공개되지 않은 법령'}</p>)}{!ch.ids.length && <p>법령 없음</p>}</div>)}</section>}</aside></div>
 {g.phase === 'PLAYING' && <section className="du-action-panel"><div><span className="du-eyebrow">YOUR NEXT MOVE</span><h3>{mine ? g.decision?.label : `${name(g.activePlayerId)}님을 기다리고 있습니다`}</h3><p>카드를 눌러 비용과 효과를 확인하세요. 선택 후 한 번 더 확정합니다.</p></div>{mine && <div className="du-option-list">{options.filter(o => g.stage === 'RESOLVING' || g.stage === 'NEXT_AGE' || o.group === 'INVOKE' || o.group === 'TRIGGER' || o.group === 'DRAFT').map(o => <button key={o.id} disabled={!can} className={option === o.id ? 'selected' : ''} onClick={() => { setOption(o.id); setInspect({ id: o.definitionId, source: o.sourceId ?? '' }); props.selectSound(); }}>{o.label}</button>)}</div>}</section>}
 <div className="du-latest" aria-live="polite">{g.history.at(-1) ? `${name(g.history.at(-1)!.playerId)} · ${g.history.at(-1)!.text}` : '상대와 나, 두 문명의 역사가 시작됩니다.'}</div>
 {inspect && <Modal close={() => { setInspect(null); setOption(null); }} label="카드 확대 및 행동 선택">{inspect.id ? <><DetailArt id={inspect.id}/><div className="du-detail-copy">{(() => { const d = definition(inspect.id!); return d && 'cost' in d ? <><Cost cost={d.cost} coins={'color' in d ? d.coins : 0}/><p>{'color' in d ? effectText(d) : wonderText(d)}</p>{'chainOut' in d && d.chainOut && <p>연계: {DUEL_CARDS.filter(c => c.chainIn === d.chainOut).map(c => c.name).join(' / ')}</p>}</> : d && 'text' in d ? <p>{d.text}</p> : null; })()}</div></> : <div className="du-detail-copy"><h2>{actions.length || selected ? '행동 선택' : '비공개 정보'}</h2><p>{actions.length || selected ? '선택할 위치나 효과를 확인하세요.' : '규칙상 공개되는 시점에 내용을 확인할 수 있습니다.'}</p></div>}<div className="du-detail-actions">{actions.map(o => <button key={o.id} disabled={!can} className={option === o.id ? 'selected' : ''} onClick={() => { setOption(o.id); props.selectSound(); }}><strong>{o.label}</strong>{o.detail && <small>{o.detail}</small>}</button>)}{selected && <div className="du-confirm"><p><strong>{selected.label}</strong></p><button className="du-primary" disabled={!can} onClick={() => props.choose(selected)}>{props.busy ? '처리 중…' : '이 선택 확정 →'}</button></div>}{!actions.length && !selected && <p className="du-help">{mine ? '이 대상에 지금 가능한 행동이 없습니다.' : '다른 플레이어의 선택을 기다리고 있습니다.'}</p>}</div></Modal>}
 {reference && <Modal close={() => setReference(false)} label="건물 연계 참고표"><div className="du-reference"><span className="du-eyebrow">CIVILIZATION REFERENCE</span><h2>건물과 무료 연계</h2><p>⛓ 앞선 건물을 보유하면 다음 건물을 무료로 건설합니다. 클릭하면 비용과 효과를 확인할 수 있습니다.</p>{['BROWN', 'GREY', 'RED', 'GREEN', 'BLUE', 'YELLOW', 'PURPLE', 'TEMPLE'].map(color => <section key={color}><h3>{({ BROWN: '원자재', GREY: '제품', RED: '군사', GREEN: '과학', BLUE: '시민', YELLOW: '상업', PURPLE: '길드', TEMPLE: '대신전' } as Record<string, string>)[color]}</h3><div className="du-reference-ages">{[1, 2, 3].map(age => <div key={age}><h4>시대 {['I', 'II', 'III'][age - 1]}</h4>{DUEL_CARDS.filter(d => d.age === age && d.color === color && (color !== 'TEMPLE' || g.settings.pantheon) && (color !== 'PURPLE' || !g.settings.pantheon)).map(d => <button className={`du-reference-card du-${d.color}`} key={d.id} onClick={() => { setReference(false); inspectCard(d.id, d.id); }}><strong>{d.name}</strong><Cost cost={d.cost} coins={d.coins}/><small>{effectText(d)}</small>{d.chainIn && <small>⛓ {DUEL_CARDS.find(c => c.chainOut === d.chainIn)?.name ?? d.mythology}</small>}</button>)}</div>)}</div></section>)}</div></Modal>}
 {ledger && <Modal close={() => setLedger(false)} label="게임 기록"><div className="du-reference"><h2>버린 카드 · {g.discard.length}장</h2><div className="du-discard-cards">{g.discard.map(c => <Card key={c.tileId} id={c.definitionId} onClick={() => { setLedger(false); inspectCard(c.definitionId, c.tileId); }}/>)}</div><h2>진행 기록</h2><ol>{g.history.map(h => <li key={h.id}><strong>{name(h.playerId)}</strong> · {h.text}</li>)}</ol></div></Modal>}
 </div>;
}
