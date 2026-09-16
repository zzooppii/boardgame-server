import { useEffect, useRef, useState } from 'react';
import { ARNAK_RESOURCES, ARNAK_RESOURCE_NAMES, ARNAK_RESEARCH, ARNAK_TRAVEL_NAMES, arnakCard, arnakSite, arnakGuardian, arnakAssistant, arnakCostText, PROTOCOL_VERSION, type ArnakCard, type ArnakResources, type ArnakOffer, type ArnakProjection, type ArnakClientCommand } from '@hangul-rummikub/shared';
import type { ArnakWebSnapshot } from '../../lib/snapshot-wire-decoder.js';
import { getGameStartControl } from '../../lib/game-start.js';
import { createRequestId } from '../../lib/request-id.js';
import { ArnakCommandRejected } from '../../lib/arnak-command-error.js';
import { describeArnakEffect as describe } from './effect-description.js';
import { ArnakCardDetail } from './ArnakCardDetail.js';
import { ArnakTravel } from './ArnakTravel.js';
import { ArnakCardArt } from './ArnakCardArt.js';
import { ArnakWorldArt } from './ArnakWorldArt.js';
import { ArnakOpponentCamp } from './ArnakOpponentCamp.js';
import { ArnakResults } from './ArnakResults.js';
import { ArnakJournal } from './ArnakJournal.js';
import { ArnakActionBrowser } from './ArnakActionBrowser.js';
import { ArnakCleanup } from './ArnakCleanup.js';
import { ArnakResearchTrack } from './ArnakResearchTrack.js';
import { ArnakResearchDetail } from './ArnakResearchDetail.js';
import { ArnakOfferList } from './ArnakOfferList.js';
import { ArnakFeedback } from './feedback.js';
import { ArnakSoundControls } from './ArnakSoundControls.js';
import { useArnakSound, type ArnakCue } from './sound.js';
type Props = {
    snapshot: ArnakWebSnapshot;
    connected: boolean;
    pending: boolean;
    error: string | null;
    connectionLabel: string;
    onCommand(c: ArnakClientCommand): Promise<void>;
    onRematch(): void;
    onStart(): void;
    onLeave(): void;
    onCopy(): void;
};
const rewardNames: Record<string, string> = { coin: '금화', compass: '나침반', tablet: '석판', arrow: '화살촉', draw: '카드 뽑기', exile: '카드 제거', upgrade: '자원 강화', refresh: '조수 준비' };
const symbols = { coin: '◉', compass: '✥', tablet: '▤', arrow: '◆', jewel: '♦' };
function Resources({ value }: {
    value: Partial<ArnakResources>;
}) { return <span className="ar-resources">{ARNAK_RESOURCES.map(k => value[k] !== undefined ? <span className={'ar-resource ' + k} key={k} title={ARNAK_RESOURCE_NAMES[k]}><i aria-hidden="true">{symbols[k]}</i><b>{value[k]}</b><span className="ar-sr">{ARNAK_RESOURCE_NAMES[k]}</span></span> : null)}</span>; }
function Card({ card, selected = false, available = false, payment = false, market = false, onSelect }: {
    card: ArnakCard;
    selected?: boolean;
    available?: boolean;
    payment?: boolean;
    market?: boolean;
    onSelect(): void;
}) { const d = arnakCard(card.definitionId); return <button className={`ar-card ${d.type} ${selected ? 'selected' : ''} ${available ? 'available' : ''} ${payment ? 'payment' : ''}`} onClick={onSelect} aria-pressed={selected} aria-label={`${d.name}, ${market ? `구매 비용 ${d.type === 'item' ? '금화' : '나침반'} ${d.cost}개, ` : ''}이동 ${d.travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')}, ${d.points}점, ${d.effects.map(describe).join(', ')}`}><div className="ar-card-title"><strong>{d.name}</strong></div><ArnakCardArt definitionId={d.id}/><span className="ar-card-type">{payment ? '지불 예정' : d.type === 'artifact' ? '유물' : d.type === 'item' ? '아이템' : d.type === 'fear' ? '공포' : '기본 카드'}</span><ArnakTravel travel={d.travel}/><div className="ar-card-effect">{d.free && <b className="ar-lightning">ϟ </b>}{d.effects.length ? d.effects.map(describe).join(' · ') : '이동에 사용하거나 제거하세요.'}{d.exileSelf && <small>사용 후 이 카드 제거</small>}</div><div className="ar-card-foot">{market ? <span className={`ar-purchase-price ${d.type}`}><small>구매 · {d.type === 'item' ? '금화' : '나침반'}</small><strong>{d.type === 'item' ? '◉' : '✥'} {d.cost}</strong></span> : <span>{d.type === 'item' ? '◉ ' + d.cost : d.type === 'artifact' ? '✥ ' + d.cost : d.type === 'fear' ? '공포' : '시작 카드'}</span>}<b>{d.points} VP</b></div></button>; }
export function ArnakScreen(props: Props) { const g = props.snapshot.game, sound = useArnakSound(g, props.connected), start = getGameStartControl(props.snapshot, props.pending || !props.connected); return <section className="arnak-screen" aria-label="아르낙의 잊혀진 유적" onPointerDownCapture={() => void sound.unlock()} onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ')
    void sound.unlock(); }}><header className="ar-header"><div><span className="ar-kicker">LOST RUINS OF</span><h1>ARNAK <small>아르낙의 잊혀진 유적</small></h1></div><nav><span className="ar-connection">{props.connectionLabel}</span><ArnakSoundControls {...sound}/><button onClick={props.onCopy}>초대 · {props.snapshot.room.roomCode}</button><button onClick={props.onLeave} disabled={props.pending}>나가기</button></nav></header>{!props.connected && <p className="ar-alert" role="status">연결을 복구하고 있습니다. 확정된 탐험과 진행 중인 선택은 보존됩니다.</p>}{props.error && <p className="ar-alert" role="alert">{props.error}</p>}{g ? <Table key={g.gameId} {...props} game={g} play={sound.play}/> : <div className="ar-lobby"><img src="/images/arnak/island.webp" alt="열대 바다에서 울창한 밀림을 지나 새 사원으로 이어지는 잊힌 섬"/><div><span className="ar-kicker">THE ISLAND IS CALLING</span><h2>지도를 벗어나,<br />전설 속으로.</h2><p>오래된 길을 따라 탐험가를 보내고,<br />잠든 수호자와 마주하며 사원의 비밀을 밝혀보세요.</p><div className="ar-tags"><span>2–4인</span><span>기본판 · 새 사원</span><span>5라운드</span></div><div className="ar-lobby-players">{props.snapshot.room.players.map((p, i) => <p key={p.playerId}><i className={'ar-pawn seat-' + i}/><b>{p.nickname}</b><span>{p.isHost ? '방장 · ' : ''}{p.connectionStatus === 'CONNECTED' ? '준비됨' : '재접속 중'}</span></p>)}</div><button className="ar-primary" onClick={props.onStart} disabled={!start.canStart}>탐험 시작 →</button><p className="ar-muted">{start.guidance}</p></div></div>}</section>; }
function Table(props: Props & {
    game: ArnakProjection;
    play(c: ArnakCue): void;
}) {
    const g = props.game, self = props.snapshot.self.playerId, me = g.playerStates.find(p => p.playerId === self)!, finished = g.phase === 'FINISHED';
    const [target, setTarget] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false), [rules, setRules] = useState(false);
    const [detailCardId, setDetailCardId] = useState<string | null>(null);
    const visibleCards = [...g.market, ...g.privateState.hand, ...g.privateState.revealedCards, ...g.playerStates.flatMap(player => player.played)];
    const detailCard = visibleCards.find(c => c.tileId === detailCardId);
    const actionNames = new Map<string, string>([
        ...visibleCards.map(c => [c.tileId, arnakCard(c.definitionId).name] as const),
        ...g.sites.map((site, index) => [site.id, site.definitionId ? arnakSite(site.definitionId).name : `미발견 유적 ${index + 1}`] as const),
        ...ARNAK_RESEARCH.map(node => [node.id, `${node.row}단계 연구 · ${node.id}`] as const),
        ['temple', '사원 타일'],
    ]);
    const sending = useRef(false), request = useRef<ArnakClientCommand | null>(null);
    useEffect(() => { setTarget(null); setSelected(null); setError(null); setUncertain(false); request.current = null; }, [g.gameRevision, g.gameId]);
    const offers = g.privateState.offers, available = new Set(offers.map(o => o.targetId)), canAct = !finished && g.activePlayerId === self && props.connected && !busy && !props.pending && !uncertain, offer = offers.find(o => o.id === selected), shown = target ? offers.filter(o => o.targetId === target) : offers.filter(o => g.pendingLabels.length ? !['CARD', 'ASSISTANT', 'BOON', 'IDOL'].includes(o.kind) : o.kind === 'END' || o.kind === 'PASS' || o.kind === 'IDOL' || o.kind === 'ASSISTANT' || o.kind === 'BOON'), name = (id: string) => props.snapshot.room.players.find(p => p.playerId === id)?.nickname ?? '탐험가';
    function jump(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
    function select(id: string) { setTarget(id); const same = offers.filter(o => o.targetId === id); setSelected(same.length === 1 ? same[0]!.id : null); props.play('SELECT'); if (window.matchMedia('(max-width:1100px)').matches)
        jump('ar-actions'); }
    async function send(chosen: ArnakOffer) {
        if (sending.current || g.phase !== 'PLAYING' || !props.connected)
            return;
        sending.current = true;
        setBusy(true);
        setError(null);
        const command = request.current ?? { protocolVersion: PROTOCOL_VERSION, requestId: createRequestId(), kind: 'arnak:act' as const, gameId: g.gameId, expectedGameRevision: g.gameRevision, turnId: g.turnId, payload: { type: 'TAKE' as const, actionId: chosen.id } };
        request.current = command;
        try {
            await props.onCommand(command);
            request.current = null;
            setUncertain(false);
        }
        catch (e) {
            const rejected = e instanceof ArnakCommandRejected;
            setUncertain(!rejected);
            if (rejected)
                request.current = null;
            setError(e instanceof Error ? e.message : '처리 결과를 확인하지 못했습니다.');
            props.play('ERROR');
        }
        finally {
            sending.current = false;
            setBusy(false);
        }
    }
    return <>{detailCard && <ArnakCardDetail key={detailCard.tileId} card={detailCard} onClose={() => setDetailCardId(null)}/>}<ArnakFeedback game={g} self={self} connected={props.connected}/><div className="ar-roundbar"><div><span className="ar-kicker">EXPEDITION JOURNAL</span><b>{finished ? '탐험 종료' : `${name(g.activePlayerId)}의 차례`}</b><small>{finished ? '최종 점수' : g.stage === 'CLEANUP' ? '보관할 손패를 선택하세요' : g.pendingLabels[0] ?? (g.mainActionUsed ? '자유 행동 후 차례를 마치세요' : '주 행동 1회 · 자유 행동 가능')}</small></div><ol>{['I', 'II', 'III', 'IV', 'V'].map((r, i) => <li key={r} className={g.round === i + 1 ? 'current' : ''}>{r}</li>)}</ol><button onClick={() => setRules(!rules)}>? 탐험 안내</button></div>{rules && <aside className="ar-rules"><h3>한 차례의 흐름</h3><p>장소·카드·연구 칸을 선택하고 오른쪽에서 지불 방법을 고른 뒤 확정하세요. 주 행동은 한 번, ϟ 자유 행동은 여러 번 가능합니다. 카드 한 장은 이동과 효과 중 하나로만 사용합니다.</p><p>금화 2개는 비행기 이동 1회를 대신합니다. 새 유적 발견은 나침반 3개 또는 6개가 필요합니다. 유물은 구입 즉시 사용하고, 손패에서 사용하면 석판 1개를 지불합니다.</p><p>패스하면 다음 라운드까지 기다립니다. 수호자를 남겨둔 탐험가마다 공포를 받습니다. 돋보기·수첩, 수호자, 우상과 카드 점수를 합쳐 5라운드 후 승자를 정합니다.</p></aside>}
 <div className="ar-opponents">{g.playerStates.filter(p => p.playerId !== self).map(p => <details key={p.playerId} className={p.playerId === g.activePlayerId ? 'active' : ''}><summary><i className={'ar-pawn seat-' + g.playerStates.indexOf(p)}/><b>{name(p.playerId)}</b><span>{p.passed ? '패스' : `손패 ${p.handCount} · 탐험가 ${p.workers}`}</span><Resources value={p.resources}/></summary><ArnakOpponentCamp player={p} onInspectCard={setDetailCardId}/></details>)}</div>
 <section className="ar-market"><div className="ar-section-title"><h2>교역소 <small>ITEMS & ARTIFACTS</small></h2><span>아이템 {g.itemDeckCount} · 유물 {g.artifactDeckCount}</span></div><div className="ar-market-cards">{g.market.map(c => <Card key={c.tileId} card={c} market selected={target === c.tileId} available={available.has(c.tileId)} onSelect={() => select(c.tileId)}/>)}</div></section>
 <div className="ar-table"><div className="ar-island" id="ar-map"><div className="ar-map-title"><span className="ar-kicker">AN UNCHARTED ISLAND</span><h2>잊혀진 유적</h2></div>{[2, 1, 0].map(level => <section className={'ar-sites level-' + level} key={level} aria-label={`${level}단계 탐험 장소`}><h3>{level === 2 ? 'II · 깊은 밀림' : level === 1 ? 'I · 탐험의 시작' : 'BASE CAMP · 해안 거점'}<small>{level ? `발견 ✥ ${level === 1 ? 3 : 6}` : '발견된 장소'}</small></h3><div>{g.sites.filter(s => s.level === level).map(site => <button key={site.id} onClick={() => select(site.id)} aria-pressed={target === site.id} className={`ar-site ${site.definitionId ? 'revealed' : 'hidden-site'} ${available.has(site.id) ? 'available' : ''} ${target === site.id ? 'selected' : ''}`}><span className="ar-site-image">{site.definitionId ? <ArnakWorldArt definitionId={site.definitionId}/> : <span className="ar-idol">𓅓<small>우상 ×{site.idolCount}</small></span>}{site.guardianId && <span className="ar-site-guardian" title={arnakGuardian(site.guardianId).name}><ArnakWorldArt definitionId={site.guardianId}/><b>5</b></span>}</span><strong>{actionNames.get(site.id)}</strong><small>{site.definitionId ? arnakSite(site.definitionId).effects.map(describe).join(' · ') : `${rewardNames[site.idolReward ?? ''] ?? ''} 우상 보상`}</small><span className="ar-worker-slots">{site.occupants.map((id, i) => <span key={i} className={site.blocked[i] ? 'blocked' : ''}>{id ? <i className={'ar-pawn seat-' + g.playerStates.findIndex(p => p.playerId === id)}/> : site.blocked[i] ? '×' : site.travel[i]?.map(t => ({ foot: '♟', car: '▰', boat: '◒', plane: '✈' })[t]).join('')}</span>)}</span></button>)}</div></section>)}</div>
 <ArnakResearchTrack game={g} target={target} available={available} name={name} onSelect={select}/>
 <aside className="ar-action-panel" id="ar-actions"><div className="ar-section-title"><h2>{g.stage === 'CLEANUP' ? '라운드 정리' : '탐험 수첩'}</h2><button onClick={() => { setTarget(null); setSelected(null); }}>전체</button></div>{target && [...g.market, ...g.privateState.hand, ...g.privateState.revealedCards].some(c => c.tileId === target) && <div className="ar-card-inspector">{(() => { const c = [...g.market, ...g.privateState.hand, ...g.privateState.revealedCards].find(c => c.tileId === target)!, d = arnakCard(c.definitionId); return <><h3>{d.name}</h3><button type="button" className="ar-inspect-button" onClick={() => setDetailCardId(c.tileId)}>일러스트·효과 크게 보기 ↗</button><p>{d.effects.map(describe).join(' · ')}</p><small>이동: {d.travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')} · {d.free ? '자유 행동' : '주 행동'}{d.type === 'artifact' ? ' · 손패 사용 시 석판 1' : ''}</small>{d.passEffects.length > 0 && <p>대신 패스하고 {d.passEffects.map(describe).join(' · ')}</p>}</>; })()}</div>}{g.sites.some(site=>site.id===target)&&<div className="ar-card-inspector">{(()=>{const site=g.sites.find(site=>site.id===target)!;return <><ArnakWorldArt definitionId={site.definitionId} expanded/><h3>{site.definitionId?arnakSite(site.definitionId).name:'미발견 유적'}</h3><p>이동: {site.travel.map(t=>t.map(k=>ARNAK_TRAVEL_NAMES[k]).join(' + ')).join(' / ')}</p>{site.definitionId?<p>{arnakSite(site.definitionId).effects.map(describe).join(' · ')}</p>:<p>발견 비용: 나침반 {site.level===1?3:6} · 우상 {site.idolCount}개</p>}{site.guardianId&&<p><ArnakWorldArt definitionId={site.guardianId} expanded/><b>{arnakGuardian(site.guardianId).name} · 5점</b><br/>극복 비용: {arnakCostText(arnakGuardian(site.guardianId).cost)}{arnakGuardian(site.guardianId).travel.length?' · '+arnakGuardian(site.guardianId).travel.map(t=>ARNAK_TRAVEL_NAMES[t]).join(' + '):''}{arnakGuardian(site.guardianId).discard?' · 손패 1장 버리기':''}</p>}</>;})()}</div>}{(() => {
     const assistant = me.assistants.find(a => a.definitionId === target);
     const supplyId = g.assistantSupply.flatMap(stack => stack.slice(0, 1)).find(id => id === target);
     if (assistant || supplyId) {
         const d = arnakAssistant(assistant?.definitionId ?? supplyId!);
         return <div className="ar-card-inspector"><ArnakWorldArt definitionId={d.id} expanded/><h3>{d.name}</h3><p>{assistant ? `${assistant.gold ? '금색' : '은색'} 조수 · ${assistant.ready ? '준비됨' : '사용 완료'}` : '공급 더미 맨 위 조수'}</p><small>{d.free ? '자유 행동' : '주 행동'}</small><h4>은색 능력</h4><p>{d.silver.map(describe).join(' · ')}</p><h4>금색 능력</h4><p>{d.gold.map(describe).join(' · ')}</p></div>;
     }
     const guardian = me.guardians.find(guardian => guardian.definitionId === target);
     if (guardian) { const d = arnakGuardian(guardian.definitionId); return <div className="ar-card-inspector"><ArnakWorldArt definitionId={d.id} expanded/><h3>{d.name} · 5점</h3><p>{d.boon.map(describe).join(' · ')}</p><small>{guardian.used ? '축복 사용 완료 · 점수는 유지됩니다.' : '일회성 자유 행동 · 축복 사용 후에도 5점을 얻습니다.'}</small></div>; }
     return null;
 })()}<ArnakResearchDetail target={target} templeSupply={g.templeSupply}/>{g.stage === 'CLEANUP' && g.activePlayerId === self && !finished && <ArnakCleanup hand={g.privateState.hand} keep={g.privateState.keep} selected={target} disabled={!canAct} onSelect={select}/>}<p className="ar-action-help">{!canAct ? finished ? '탐험의 결과를 확인하세요.' : !props.connected ? '연결 복구 후 행동할 수 있습니다.' : busy ? '서버에서 행동을 확인하고 있습니다.' : uncertain ? '처리 결과를 다시 확인해주세요.' : `${name(g.activePlayerId)}의 선택을 기다립니다.` : target ? '1. 지불 방법 선택 → 2. 아래에서 확정' : g.pendingLabels.length ? '추가 효과를 처리하세요.' : '지도·카드·연구 칸을 눌러 행동을 고르세요.'}</p>{g.privateState.revealedCards.length > 0 && <div className="ar-revealed">{g.privateState.revealedCards.map(c => <Card key={c.tileId} card={c} selected={target === c.tileId} available onSelect={() => select(c.tileId)}/>)}</div>}{!target && g.stage === 'ACTION' && !g.pendingLabels.length && !finished && g.activePlayerId === self && <ArnakActionBrowser key={g.gameRevision} offers={offers} names={actionNames} disabled={!canAct} onSelect={select}/>}<ArnakOfferList key={`${g.gameRevision}:${target ?? ''}`} offers={shown} hand={g.privateState.hand} selected={selected} disabled={!canAct} onSelect={id => { setSelected(id); if (id) props.play('SELECT'); }}/>{!shown.length && <p className="ar-muted">{target ? '현재 실행 가능한 행동이 없습니다. 필요한 자원·이동 카드·주 행동 사용 여부를 확인하세요.' : '선택 가능한 대상을 지도와 손패에서 찾을 수 있습니다.'}</p>}{offer && <div className="ar-confirm"><b>{offer.label}</b><p>{arnakCostText(offer.cost)}</p>{g.stage === 'CLEANUP' && offer.kind === 'PASS' && <p className="ar-cleanup-note">보관 {g.privateState.hand.filter(c => g.privateState.keep.includes(c.tileId)).length}장 · 내려놓기 {g.privateState.hand.filter(c => !g.privateState.keep.includes(c.tileId)).length}장<br/>이 선택으로 이번 라운드를 마칩니다.</p>}{offer.cards.length > 0 && <p className="ar-payment-summary">지불할 카드: {offer.cards.map(id => arnakCard(g.privateState.hand.find(c => c.tileId === id)!.definitionId).name).join(' · ')}<small>이 카드는 효과를 사용하지 않고 내려놓습니다.</small></p>}<button className="ar-primary" onClick={() => void send(offer)} disabled={!canAct}>{busy ? '확인 중…' : '선택 확정 →'}</button><small>확정 시 비용과 카드가 적용됩니다.</small></div>}{error && <p className="ar-alert" role="alert">{error}</p>}{uncertain && <button disabled={busy || !props.connected} onClick={() => { const saved = request.current; const o = offers.find(o => o.id === saved?.payload.actionId); if (o)
        void send(o); }}>동일 요청 처리 결과 다시 확인</button>}<ArnakJournal history={g.history} players={props.snapshot.room.players}/></aside></div>
 <section className="ar-camp" id="ar-hand"><div className="ar-camp-heading"><div><span className="ar-kicker">YOUR EXPEDITION</span><h2>{name(self)}의 야영지</h2><p>탐험가 {me.workers}/2 · 덱 {me.deckCount}장 · 사용한 카드 {me.played.length}장</p></div><Resources value={me.resources}/><div className="ar-idol-slots"><button onClick={() => select('idol')}>𓅓 우상 {me.idols}</button>{[1, 2, 3, 4].map((v, i) => <span key={v} className={me.idolSlots > i ? 'used' : ''}>{me.idolSlots > i ? '𓅓' : v + ' VP'}</span>)}</div></div><div className="ar-hand" aria-label="내 손패">{g.privateState.hand.map(c => <div key={c.tileId}>{g.stage === 'CLEANUP' && g.privateState.keep.includes(c.tileId) && <span className="ar-keep">다음 라운드 보관</span>}<Card card={c} payment={offer?.cards.includes(c.tileId) ?? false} selected={target === c.tileId} available={available.has(c.tileId)} onSelect={() => select(c.tileId)}/></div>)}</div><div className="ar-assistants ar-owned-abilities" aria-label="내 조수와 수호자">{me.assistants.map(a => <button key={a.definitionId} onClick={() => select(a.definitionId)} className={a.ready ? 'ready' : 'spent'} aria-pressed={target === a.definitionId}><ArnakWorldArt definitionId={a.definitionId}/><span>{a.gold ? '★ ' : '☆ '}{arnakAssistant(a.definitionId).name}<small>{a.ready ? '사용 가능' : '사용 완료'} · {arnakAssistant(a.definitionId).free ? '자유 행동' : '주 행동'}</small><small className="ar-ability-effect">{(a.gold ? arnakAssistant(a.definitionId).gold : arnakAssistant(a.definitionId).silver).map(describe).join(' · ')}</small></span></button>)}{me.guardians.map(g => <button key={g.definitionId} onClick={() => select(g.definitionId)} className={g.used ? 'spent' : 'ready'} aria-pressed={target === g.definitionId}><ArnakWorldArt definitionId={g.definitionId}/><span>{arnakGuardian(g.definitionId).name}<small>{g.used ? '축복 사용 완료' : '축복 사용 가능'} · 자유 행동 · 5 VP</small><small className="ar-ability-effect">{arnakGuardian(g.definitionId).boon.map(describe).join(' · ')}</small></span></button>)}</div><details className="ar-supply"><summary>고용 가능한 조수</summary><p className="ar-supply-note">공급 더미 맨 위의 조수입니다. 고용하면 은색 능력으로 시작합니다.</p><div className="ar-assistants ar-assistant-market">{g.assistantSupply.flatMap(stack => stack.slice(0, 1)).map(id => {
     const assistant = arnakAssistant(id);
     return <button key={id} onClick={() => select(id)} aria-pressed={target === id}><ArnakWorldArt definitionId={id}/><span><strong>{assistant.name}</strong><small>{assistant.free ? '자유 행동' : '주 행동'}</small><small className="ar-supply-ability"><b>☆ 은색 능력</b><span className="ar-silver-effect">{assistant.silver.map(describe).join(' · ')}</span></small><small className="ar-supply-ability"><b>★ 금색 능력 · 승급 후</b><span className="ar-gold-effect">{assistant.gold.map(describe).join(' · ')}</span></small></span></button>;
 })}</div></details><details><summary>사용한 카드 확인</summary><div className="ar-played">{me.played.map(c => <button key={c.tileId} onClick={() => setDetailCardId(c.tileId)}>{arnakCard(c.definitionId).name} ↗</button>)}</div></details></section>
 <nav className="ar-mobile-nav" aria-label="게임 영역 바로가기"><button onClick={() => jump('ar-map')}>✥ 지도</button><button onClick={() => jump('ar-hand')}>▤ 손패 {g.privateState.hand.length}</button><button onClick={() => jump('ar-actions')}>ϟ 행동 {g.pendingLabels.length ? '· 선택 대기' : ''}</button></nav>{finished && <ArnakResults result={g.result} players={props.snapshot.room.players} self={self} isHost={props.snapshot.room.players.some(p => p.playerId === self && p.isHost)} disabled={props.pending || !props.connected} onRematch={props.onRematch}/>}</>;
}
