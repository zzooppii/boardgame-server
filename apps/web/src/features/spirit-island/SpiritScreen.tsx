import { useEffect, useRef, useState } from 'react';
import { PROTOCOL_VERSION, SPIRITS, SPIRIT_POWERS, SPIRIT_BOARDS, SPIRIT_ELEMENTS, SPIRIT_ELEMENT_LABELS, SPIRIT_TERRAIN_LABELS, spiritDefinition, spiritPower, type SpiritAction, type SpiritClientCommand, type SpiritPower, type SpiritInvaderCard } from '@hangul-rummikub/shared';
import type { SpiritWebSnapshot } from '../../lib/snapshot-wire-decoder.js';
import { getGameStartControl } from '../../lib/game-start.js';
import { createRequestId } from '../../lib/request-id.js';
import { SpiritCommandRejected } from '../../lib/spirit-command-error.js';
import { useSpiritSound } from './sound.js';
type Props = Readonly<{
    snapshot: SpiritWebSnapshot;
    connected: boolean;
    pending: boolean;
    error: string | null;
    connectionLabel: string;
    onCommand(command: SpiritClientCommand): Promise<void>;
    onRematch(): void;
    onStart(): void;
    onLeave(): void;
    onCopy(): void;
}>;
type Game = NonNullable<SpiritWebSnapshot['game']>;
const stages = { SELECT: '정령 선택', PREPARE: '성장과 준비', FAST: '빠른 능력', FEAR: '공포', RAVAGE: '파괴', BUILD: '건설', EXPLORE: '탐험', SLOW: '느린 능력', TIME: '시간의 흐름' };
const symbols = { SUN: '☀', MOON: '☾', FIRE: '♨', AIR: '≋', WATER: '◈', EARTH: '⬟', PLANT: '❧', ANIMAL: '♧' };
const kindNames = { EXPLORER: '탐험가', TOWN: '마을', CITY: '도시', DAHAN: '다한' };
function Invader({ card, label }: {
    card: SpiritInvaderCard | null;
    label: string;
}) { return <div className={`si-invader si-${label}`}><small>{label}</small><strong>{card ? (card.coastal ? '해안' : card.terrains.map(t => SPIRIT_TERRAIN_LABELS[t]).join(' · ')) : '—'}</strong><span>{card ? `침략 ${card.stage}단계` : '아직 없음'}</span></div>; }
function Card({ power, selected, disabled, onClick }: {
    power: SpiritPower;
    selected?: boolean;
    disabled?: boolean;
    onClick?(): void;
}) { return <button type="button" className={`si-card si-card-${power.speed.toLowerCase()}`} aria-pressed={selected} disabled={disabled} onClick={onClick}><span className="si-card-top"><b>{power.cost}<small> 에너지</small></b><span>{power.speed === 'FAST' ? '⚡ 빠른' : '☾ 느린'}</span></span><span className={`si-card-art si-art-${power.elements.includes('WATER') ? 'RIVER' : power.elements.includes('FIRE') ? 'LIGHTNING' : power.elements.includes('EARTH') ? 'EARTH' : 'SHADOW'}`} aria-hidden="true"/><strong>{power.title}</strong><span className="si-card-meta">{power.target.includes('SPIRIT') ? '정령 대상' : `사거리 ${power.range}${power.sacred ? ' · 성소에서' : ''}`}</span><span className="si-card-description">{power.description}</span><span className="si-elements">{power.elements.map(e => <span key={e} title={SPIRIT_ELEMENT_LABELS[e]} aria-label={SPIRIT_ELEMENT_LABELS[e]}>{symbols[e]}</span>)}</span></button>; }
function TerrainMark({ terrain }: {
    terrain: SpiritInvaderCard['terrains'][number];
}) { return <svg className="si-terrain-mark" viewBox="0 0 80 60" aria-hidden="true">{terrain === 'MOUNTAIN' ? <><path d="M4 52L28 10l22 42ZM31 52L52 18l24 34Z"/><path className="si-snow" d="M20 24l8-14 9 17-9-4ZM46 28l6-10 9 13-9-3Z"/></> : terrain === 'JUNGLE' ? <><path d="M8 50L25 6l18 44ZM34 53L52 13l20 40Z"/><path d="M25 26v32m27-27v27"/></> : terrain === 'WETLAND' ? <><path d="M0 43Q15 34 28 42t30 0t25 0M0 52q14-9 28 0t30 0t25 0"/><path d="M25 40V15m0 12-8-8m8 3 9-12M54 39V22m0 8 10-8"/></> : <><path d="M1 41Q18 14 37 37Q61 9 79 40M4 50Q22 25 47 51M37 57Q57 30 78 49"/></>}</svg>; }
function Token({ kind }: {
    kind: keyof typeof kindNames;
}) { return <svg viewBox="0 0 32 32" className={`si-token si-token-${kind}`} aria-hidden="true">{kind === 'DAHAN' ? <><ellipse cx="16" cy="24" rx="10" ry="4"/><path d="M11 24V13h10v11M3 15Q16-9 29 15Z"/></> : kind === 'EXPLORER' ? <><circle cx="16" cy="6" r="4"/><path d="M12 12h8l3 9h-4v9h-6v-9H9Z"/><path d="M26 4v25"/></> : kind === 'TOWN' ? <path d="M4 15L16 4l12 11v15H4Zm9 6v9h6v-9Z"/> : <path d="M3 30V10h7V4h7v12h5V7h7v23Zm4-15h2m4-6h2m9 4h2M13 24v6h6v-6Z"/>}</svg>; }
const positions: [
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ]
] = [[12, 17], [49, 10], [85, 20], [62, 42], [31, 43], [13, 71], [75, 75], [43, 78]];
function IslandMap({ g, selected, legal, onSelect }: {
    g: Game;
    selected: string | null;
    legal: string[];
    onSelect(id: string): void;
}) { return <div className="si-map-grid">{SPIRIT_BOARDS.slice(0, g.playerStates.length).map(board => <section key={board} className="si-island" aria-label={`${board} 섬 구역`}><div className="si-sea-label">{board} · 바다</div><svg className="si-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{g.lands.filter(l => l.board === board).flatMap(l => l.adjacent.filter(id => id.startsWith(board) && id > l.id).map(id => { const a = positions[l.number - 1]!, b = positions[Number(id.slice(1)) - 1]!; return <line key={`${l.id}-${id}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={selected === l.id || selected === id ? 'si-connected' : ''}/>; }))}</svg>{g.lands.filter(l => l.board === board).map(l => { const pos = positions[l.number - 1]!, danger = g.ravage && (g.ravage.coastal ? l.coastal : g.ravage.terrains.includes(l.terrain)); return <button type="button" key={l.id} className={`si-land si-terrain-${l.terrain}${legal.includes(l.id) ? ' si-legal' : ''}${selected === l.id ? ' si-selected' : ''}${danger ? ' si-danger' : ''}`} style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }} aria-pressed={selected === l.id} aria-label={`${l.id} ${SPIRIT_TERRAIN_LABELS[l.terrain]}${l.coastal ? ' 해안' : ''} · ${l.pieces.map(p => kindNames[p.kind]).join(', ')} · 오염 ${l.blight}`} onClick={() => onSelect(l.id)}><TerrainMark terrain={l.terrain}/><span className="si-land-heading"><b>{l.id}</b><small>{SPIRIT_TERRAIN_LABELS[l.terrain]}{l.coastal ? ' ⌁' : ''}</small></span><span className="si-pieces">{(['EXPLORER', 'TOWN', 'CITY', 'DAHAN'] as const).filter(k => l.pieces.some(p => p.kind === k)).map(k => <span key={k}><Token kind={k}/><b>{l.pieces.filter(p => p.kind === k).length}</b></span>)}</span><span className="si-presences">{l.presence.map(p => <i key={p.playerId} className={`si-disc si-art-${g.playerStates.find(q => q.playerId === p.playerId)?.spirit ?? 'RIVER'}`} title={`현신 ${p.count}`}>{p.count}</i>)}{l.blight > 0 ? <span className="si-blight">✹ {l.blight}</span> : null}{l.skip ? <span>방해</span> : l.defend > 0 ? <span>방어 {l.defend}</span> : null}{g.plans.some(p => p.landId === l.id) ? <span>⚑</span> : null}</span></button>; })}</section>)}</div>; }
export function SpiritScreen(props: Props) { const s = props.snapshot, sound = useSpiritSound(s.game, props.connected), start = getGameStartControl(s, props.pending || !props.connected); return <section className="spirit-screen" onPointerDown={sound.unlock} onKeyDown={sound.unlock} aria-label="정령섬"><header className="si-header"><div><span className="si-eyebrow">SPIRIT ISLAND</span><h1>정령섬</h1></div><div className="si-header-actions"><span>방 {s.room.roomCode}</span><span role="status">{props.connectionLabel}</span><button onClick={props.onCopy}>초대 링크</button><button onClick={props.onLeave} disabled={props.pending}>나가기</button><label className="si-volume">소리 <input type="range" min="0" max="100" value={sound.volume} onChange={e => sound.changeVolume(Number(e.target.value))} aria-label="효과음 음량"/><span>{sound.volume === 0 ? '끔' : sound.volume + '%'}</span></label></div></header>{props.error ? <p role="alert" className="si-error">{props.error}</p> : null}{s.game === null ? <div className="si-lobby"><div className="si-lobby-copy"><span className="si-eyebrow">THE ISLAND REMEMBERS</span><h2>이 섬의 모든 것이<br />우리의 힘이 됩니다.</h2><p>강과 번개, 대지와 그림자.<br />서로 다른 힘을 모아 섬을 지켜내세요.</p><div className="si-seats">{s.room.players.map(p => <span key={p.playerId}>{p.nickname} {p.isHost ? '♛' : ''} · {p.connectionStatus === 'CONNECTED' ? '준비 중' : '재접속 대기'}</span>)}</div><p>{start.guidance}</p><button className="si-primary" disabled={!start.canStart} onClick={props.onStart}>섬으로 들어가기 →</button><p className="si-muted">1–4인 협동 · 입문 정령 4종 · 시간 제한 없음</p></div></div> : <SpiritTable key={s.game.gameId} {...props} game={s.game} sound={sound}/>}</section>; }
function SpiritTable({ game: g, sound, ...props }: Props & {
    game: Game;
    sound: ReturnType<typeof useSpiritSound>;
}) {
    const self = props.snapshot.self.playerId, me = g.playerStates.find(p => p.playerId === self)!, name = (id: string) => props.snapshot.room.players.find(p => p.playerId === id)?.nickname ?? '정령', definition = me.spirit ? spiritDefinition(me.spirit) : null;
    const [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState<string[]>(me.played.map(c => c.cardId)), [powerId, setPowerId] = useState<string | null>(null), [target, setTarget] = useState(''), [threshold, setThreshold] = useState(1), [choice, setChoice] = useState(''), [flight, setFlight] = useState(false), [error, setError] = useState<string | null>(null), [retry, setRetry] = useState<SpiritClientCommand | null>(null), [confirmReady, setConfirmReady] = useState(false);
    const scope = `${g.gameId}:${g.gameRevision}`, scopeRef = useRef(scope), commandRef = useRef<SpiritClientCommand | null>(null), mounted = useRef(true);
    scopeRef.current = scope;
    useEffect(() => () => { mounted.current = false; }, []);
    const handScope = JSON.stringify([me.hand.map(c => c.cardId), me.played.map(c => c.cardId)]);
    useEffect(() => { setDraft(me.played.map(c => c.cardId)); }, [handScope, g.stage]);
    useEffect(() => { setPowerId(null); setTarget(''); setChoice(''); setRetry(null); setFlight(false); setConfirmReady(false); commandRef.current = null; }, [scope]);
    const canAct = props.connected && !props.pending && !flight && !retry && g.phase === 'PLAYING', pending = g.pending, ownChoice = pending?.playerId === self, option = g.privateState.powerOptions.find(o => o.cardId === powerId), area = g.lands.find(l => l.id === selected), legal = option ? [...option.targets, ...option.shadowTargets] : ownChoice ? pending.options.flatMap(o => o.landId ? [o.landId] : []) : [];
    async function send(c: SpiritClientCommand) { if (commandRef.current || !props.connected)
        return; commandRef.current = c; setFlight(true); setError(null); const sentScope = scope; try {
        await props.onCommand(c);
        if (mounted.current && scopeRef.current === sentScope)
            setRetry(null);
    }
    catch (e) {
        if (mounted.current && scopeRef.current === sentScope) {
            if (e instanceof SpiritCommandRejected) {
                setError(e.message);
                setRetry(null);
                sound.play('ERROR');
            }
            else {
                setError('응답을 확인하지 못했습니다. 같은 요청으로 결과를 재확인하세요.');
                setRetry(c);
            }
        }
    }
    finally {
        if (mounted.current && scopeRef.current === sentScope) {
            setFlight(false);
            commandRef.current = null;
        }
    } }
    function act(payload: SpiritAction) { if (!canAct || g.phase !== 'PLAYING')
        return; void send({ kind: 'spirit:act', protocolVersion: PROTOCOL_VERSION, requestId: createRequestId(), gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId, payload }); }
    function pickLand(id: string) { setSelected(id); if (option && legal.includes(id))
        setTarget(id); sound.play('PICK'); }
    const cards = [...me.hand, ...me.played], cost = draft.reduce((n, id) => n + spiritPower(cards.find(c => c.cardId === id)!.key).cost, 0), budget = me.energy + me.played.reduce((n, c) => n + spiritPower(c.key).cost, 0), limit = definition?.plays[me.cardTrack] ?? 0;
    const availableChoices = ownChoice ? pending.options.filter(o => !selected || !o.landId || o.landId === selected) : [];
    return <><nav className="si-phases" aria-label="라운드 진행"><b>라운드 {g.round}</b>{Object.entries(stages).filter(([k]) => k !== 'SELECT').map(([key, label]) => <span key={key} aria-current={g.stage === key ? 'step' : undefined}>{label}</span>)}</nav><div className="si-statusbar"><div><small>공포</small><strong>{g.fear}<em> / {g.fearPool}</em></strong><progress max={g.fearPool} value={g.fear}/><span>획득 {g.earnedFearCount}장 · 덱 {g.fearDeckCount}장</span></div><div><small>공포 수준 {g.terror}</small><strong>{g.terror === 1 ? '모든 침략자' : g.terror === 2 ? '마을과 도시' : g.terror === 3 ? '모든 도시' : '섬을 해방!'}</strong><span>{g.terror < 4 ? '없애면 승리' : '승리 조건 달성'}</span></div><div><small>남은 오염</small><strong>{g.blightPool}<em>개</em></strong><span>0개가 되면 패배</span></div><Invader card={g.ravage} label="파괴"/><Invader card={g.build} label="건설"/><div><small>다음 탐험</small><strong>?</strong><span>덱 {g.invaderDeckCount}장</span></div></div>
 {g.stage === 'SELECT' && g.phase === 'PLAYING' ? <section className="si-selection"><div className="si-section-title"><span className="si-eyebrow">CHOOSE YOUR SPIRIT</span><h2>어떤 힘으로 섬을 지킬까요?</h2><p>각자 정령을 선택하면 첫 탐험과 준비 단계가 시작됩니다.</p></div><div className="si-spirit-grid">{SPIRITS.map(d => { const owner = g.playerStates.find(p => p.spirit === d.id); return <article key={d.id} className="si-spirit-card"><div className={`si-spirit-portrait si-art-${d.id}`}/><div><small>{d.subtitle}</small><h3>{d.name}</h3><p>{d.special}</p><button className="si-primary" disabled={!canAct || !!me.spirit || !!owner} onClick={() => act({ kind: 'SELECT_SPIRIT', spirit: d.id })}>{owner ? `${name(owner.playerId)}의 정령` : '이 정령 선택'}</button></div></article>; })}</div></section> : null}
 <div className="si-party">{g.playerStates.map(p => <details key={p.playerId} className={p.playerId === self ? 'si-self' : ''}><summary><span className={`si-avatar si-art-${p.spirit ?? 'RIVER'}`}/><span><b>{name(p.playerId)}{p.playerId === self ? ' · 나' : ''}</b><small>{p.spirit ? spiritDefinition(p.spirit).name : '정령 선택 중'}</small></span><span>에너지 <b>{p.energy}</b><small>{p.ready ? '✓ 준비 완료' : p.grown ? '능력 준비 중' : '성장 대기'}</small></span></summary><p>섬 {p.board} · 손패 {p.hand.length}장 · 사용 {p.played.length}장</p><div className="si-teammate-cards">{[...p.hand, ...p.played].map(c => <span key={c.cardId}>{spiritPower(c.key).title}</span>)}</div></details>)}</div>
 <div className="si-navigation"><a href={pending ? "#si-current-choice" : "#si-current-spirit"}>{pending ? pending.title : "내 정령과 능력 보기"} ↓</a></div><div className="si-table-layout"><div className="si-map-wrap"><div className="si-section-title"><h2>살아 있는 섬</h2><span>지역을 눌러 살펴보기 · 연결선은 인접 관계</span></div><IslandMap g={g} selected={selected} legal={legal} onSelect={pickLand}/><div className="si-map-legend">{(['EXPLORER', 'TOWN', 'CITY', 'DAHAN'] as const).map(k => <span key={k}><Token kind={k}/>{kindNames[k]}</span>)}<span>◉ 현신 · 두 개는 성소</span><span>✹ 오염</span></div></div><aside className="si-inspector"><span className="si-eyebrow">ISLAND JOURNAL</span><h2>{area ? `${area.id} · ${SPIRIT_TERRAIN_LABELS[area.terrain]}` : '섬을 살펴보세요'}</h2>{area ? <><p>{area.coastal ? '바다와 맞닿은 해안' : '내륙'} · 오염 {area.blight}개</p><p>인접: {area.adjacent.map(id => <button key={id} onClick={() => pickLand(id)}>{id}</button>)}</p><div className="si-piece-detail">{area.pieces.map(p => <span key={p.id}><Token kind={p.kind}/>{kindNames[p.kind]}{p.damage ? ` · 피해 ${p.damage}` : ''}</span>)}</div><p>협동 계획 공유</p><div className="si-plan-actions">{([{ intent: 'DEFEND', label: '방어할게요' }, { intent: 'ATTACK', label: '공격할게요' }, { intent: 'MOVE', label: '이동할게요' }, { intent: 'HELP', label: '도와주세요' }] as const).map(p => <button key={p.intent} disabled={!canAct} onClick={() => act({ kind: 'PLAN', landId: area.id, intent: p.intent })}>{p.label}</button>)}</div></> : <p>지도의 지역을 선택하면 기물과 인접 지역, 협동 계획을 확인할 수 있습니다.</p>}<div className="si-journal" aria-live="polite">{g.log.slice(-5).reverse().map(e => <p key={e.id}><small>{e.playerId ? name(e.playerId) : '섬'}</small>{e.text}</p>)}</div></aside></div>
 {error ? <p role="alert" className="si-error">{error}</p> : null}{retry ? <button className="si-primary" disabled={flight || !props.connected} onClick={() => void send(retry)}>같은 요청 결과 재확인</button> : null}
 {pending ? <section id="si-current-choice" className="si-choice" aria-labelledby="si-choice-heading"><span className="si-eyebrow">{ownChoice ? 'YOUR CHOICE' : `${name(pending.playerId)}의 선택`}</span><h2 id="si-choice-heading">{pending.title}</h2>{ownChoice ? <><p>대상 지역을 지도에서 고른 뒤 아래 선택을 확정하세요.</p>{selected ? <button onClick={() => setSelected(null)}>지역 필터 해제 · 모든 선택 보기</button> : null}<div className="si-options">{availableChoices.map(o => { const c = SPIRIT_POWERS.find(c => c.title === o.label); return <button key={o.id} aria-pressed={choice === o.id} disabled={!canAct} onClick={() => { setChoice(o.id); sound.play('PICK'); }}><b>{o.label}</b>{c ? <span>{c.cost} 에너지 · {c.speed === 'FAST' ? '빠른' : '느린'} · {c.description}</span> : null}</button>; })}</div><button className="si-primary" disabled={!canAct || !pending.options.some(o => o.id === choice)} onClick={() => act({ kind: 'CHOOSE', choiceId: pending.choiceId, optionId: choice })}>선택 확정</button></> : <p>선택이 끝나면 이어서 진행할 수 있습니다.</p>}</section> : null}
 {definition && g.phase === 'PLAYING' && g.stage !== 'SELECT' ? <section id="si-current-spirit" className="si-spirit-panel"><div className={`si-panel-portrait si-art-${definition.id}`}/><div className="si-panel-content"><span className="si-eyebrow">YOUR SPIRIT</span><h2>{definition.name}</h2><p>{definition.special}</p><div className="si-tracks">{[{ label: '에너지 수입', values: definition.energy, index: me.energyTrack }, { label: '카드 사용', values: definition.plays, index: me.cardTrack }].map(t => <div key={t.label}><b>{t.label}</b>{t.values.map((n, i) => <span key={i} className={i <= t.index ? 'si-uncovered' : ''} aria-label={`${n}${i <= t.index ? ' 열린 칸' : ' 현신으로 덮인 칸'}`}>{i <= t.index ? n : '◉'}{i === t.index ? <small>현재</small> : null}</span>)}</div>)}</div>{g.stage === 'PREPARE' && !me.grown ? <div className="si-growth">{definition.growth.map((gr, i) => <button key={i} disabled={!canAct || !!pending} onClick={() => act({ kind: 'GROW', option: i === 0 ? 0 : i === 1 ? 1 : 2 })}><small>성장 {i + 1}</small>{gr.reclaim ? <span>↶ 카드 회수</span> : null}{gr.gain ? <span>✧ 능력 획득</span> : null}{gr.presence.map((range, j) => <span key={j}>◉ 현신 배치 · 사거리 {range}</span>)}{gr.energy ? <span>☀ 에너지 +{gr.energy}</span> : null}</button>)}</div> : null}<div className="si-innate"><h3>{definition.innate}</h3>{definition.innateText.map(t => <p key={t}>{t}</p>)}<div className="si-elements">{SPIRIT_ELEMENTS.map(e => <span key={e} title={SPIRIT_ELEMENT_LABELS[e]}>{symbols[e]} {me.elements.filter(x => x === e).length}</span>)}</div>{g.privateState.powerOptions.filter(o => o.cardId === 'innate').map(o => <button key={o.cardId} disabled={!canAct} onClick={() => { setPowerId(o.cardId); setThreshold(o.thresholdMax); setTarget(''); }}>고유 능력 사용 · {o.thresholdMax}단계</button>)}</div></div></section> : null}
 {g.stage === 'PREPARE' && me.grown && g.phase === 'PLAYING' ? <section className="si-hand-section"><div className="si-section-title"><h2>이번 라운드의 능력</h2><span>선택 {draft.length} / {limit}장 · 비용 {cost} / {budget} 에너지</span></div><div className="si-hand">{cards.map(c => <Card key={c.cardId} power={spiritPower(c.key)} selected={draft.includes(c.cardId)} disabled={!canAct || !!pending || me.ready} onClick={() => { setDraft(d => d.includes(c.cardId) ? d.filter(id => id !== c.cardId) : [...d, c.cardId]); sound.play('PICK'); }}/>)}</div><button className="si-primary" disabled={!canAct || !!pending || me.ready || draft.length > limit || cost > budget} onClick={() => act({ kind: 'PLAY_CARDS', cardIds: draft })}>카드 준비 확정 · 에너지 {budget - cost} 남음</button>{me.spirit === 'RIVER' && me.cardTrack >= 4 ? <details><summary>카드 1장 회수</summary>{me.discard.map(c => <button key={c.cardId} disabled={!canAct || !!pending || me.ready} onClick={() => act({ kind: 'RECLAIM_ONE', cardId: c.cardId })}>{spiritPower(c.key).title}</button>)}</details> : null}</section> : null}
 {['FAST', 'SLOW'].includes(g.stage) && g.phase === 'PLAYING' ? <section className="si-hand-section"><div className="si-section-title"><h2>{stages[g.stage]} 사용</h2><span>순서는 팀과 자유롭게 의논하세요.</span></div><div className="si-hand">{me.played.map(c => <Card key={c.cardId} power={spiritPower(c.key)} selected={powerId === c.cardId} disabled={!canAct || !g.privateState.powerOptions.some(o => o.cardId === c.cardId)} onClick={() => { setPowerId(c.cardId); setThreshold(1); setTarget(''); sound.play('PICK'); }}/>)}</div></section> : null}
 {option ? <section className="si-choice"><h2>{option.key === 'innate' ? definition?.innate : spiritPower(option.key).title}</h2><p>빛나는 지역을 선택하세요. 정령 대상 능력은 아래에서 동료를 고릅니다.</p><div className="si-options">{[...option.targets, ...option.shadowTargets].map(id => <button key={id} aria-pressed={target === id} onClick={() => { setTarget(id); if (g.lands.some(l => l.id === id))
        setSelected(id); }}>{g.playerStates.some(p => p.playerId === id) ? name(id) : id}{option.shadowTargets.includes(id) ? ' · 그림자 사거리 +1 에너지' : ''}</button>)}</div><label>적용 단계 <select value={threshold} onChange={e => setThreshold(Number(e.target.value))}>{Array.from({ length: option.thresholdMax + (option.key === 'innate' ? 0 : 1) }, (_, i) => i + (option.key === 'innate' ? 1 : 0)).map(n => <option key={n} value={n}>{n === 0 ? '기본 효과만' : option.key === 'innate' ? `${n}단계` : '원소 조건을 충족하면 추가 효과'}</option>)}</select></label><p>{target ? `${target}에 ${option.fast ? '빠른' : '느린'} 능력${option.repeat ? ' 반복' : ''}을 사용합니다.` : '대상을 선택하세요.'}</p><button className="si-primary" disabled={!canAct || !target} onClick={() => act({ kind: 'USE_POWER', cardId: option.cardId, target, threshold, fast: option.fast, repeat: option.repeat, shadowReach: option.shadowTargets.includes(target) })}>능력 실행</button><button onClick={() => setPowerId(null)}>취소</button></section> : null}
 {g.phase === 'PLAYING' && !pending && g.stage !== 'SELECT' ? <footer className="si-action-bar"><div><b>{stages[g.stage]}</b><span>{['PREPARE', 'FAST', 'SLOW'].includes(g.stage) ? `${g.playerStates.filter(p => p.ready).length} / ${g.playerStates.length}명 준비 완료` : '침략자 행동을 확인하며 진행하세요.'}</span></div>{['PREPARE', 'FAST', 'SLOW'].includes(g.stage) ? <><button className="si-primary" disabled={!canAct || g.stage === 'PREPARE' && (!me.grown || JSON.stringify([...draft].sort()) !== JSON.stringify(me.played.map(c => c.cardId).sort()))} onClick={() => me.ready ? act({ kind: 'READY', ready: false }) : setConfirmReady(true)}>{me.ready ? '준비 취소' : '이 단계 마치기 →'}</button>{confirmReady ? <div role="alert"><p>{g.stage === 'PREPARE' ? '서버에 확정한 카드로 준비를 마칩니다.' : '사용하지 않은 능력은 이번 단계에서 건너뜁니다.'}</p><button disabled={!canAct} onClick={() => act({ kind: 'READY', ready: true })}>단계 완료 확정</button><button onClick={() => setConfirmReady(false)}>계속 고민하기</button></div> : null}</> : <button className="si-primary" disabled={!canAct} onClick={() => act({ kind: 'ADVANCE' })}>{stages[g.stage]} 진행 →</button>}</footer> : null}
 {g.phase === 'FINISHED' ? <section className="si-result"><span className="si-eyebrow">{g.result.winnerPlayerIds.length ? 'THE ISLAND ENDURES' : 'THE ISLAND REMEMBERS'}</span><h2>{g.result.winnerPlayerIds.length ? '섬을 지켜냈습니다' : g.result.reason === 'CANCELLED' ? '게임이 취소되었습니다' : '섬에 고요가 내려앉았습니다'}</h2><p>{g.round}라운드 · {g.result.reason === 'BLIGHT' ? '오염 토큰 소진' : g.result.reason === 'PRESENCE' ? '정령의 현신 소진' : g.result.reason === 'INVADERS' ? '침략자 덱 소진' : g.result.reason === 'SACRIFICE' ? '희생을 통해 거둔 승리' : '함께한 정령들의 기록'}</p><button className="si-primary" disabled={!props.connected || props.pending || !props.snapshot.room.players.find(p => p.playerId === self)?.isHost} onClick={props.onRematch}>새로운 섬으로</button></section> : null}
 <details className="si-help"><summary>진행 방법과 이번 버전 안내</summary><p>성장 → 에너지 수입 → 카드 준비 → 빠른 능력 → 공포 → 파괴 → 건설 → 탐험 → 느린 능력 → 시간의 흐름 순서입니다. 침략자 피해는 탐험가 1, 마을 2, 도시 3이며 방어 후 피해 2 이상이면 오염이 생깁니다. 살아남은 다한은 각 2의 피해로 반격합니다.</p><p>원소는 사용한 카드에서 얻으며 소비되지 않습니다. 밀기는 대상 지역에서 인접 지역으로, 모으기는 인접 지역에서 대상 지역으로 이동합니다. 보드 간 연결도 지역 상세의 인접 목록으로 확인하세요.</p><p>입문 정령 4종과 성장 카드 순서를 사용합니다. 적대국·시나리오·확장·오염 카드는 포함하지 않습니다. 일러스트는 이 웹 게임을 위해 만든 별도 이미지입니다.</p></details></>;
}
