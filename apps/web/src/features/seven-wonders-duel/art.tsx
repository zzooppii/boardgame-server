import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DUEL_RESOURCES, DUEL_GODS, DUEL_CARDS, DUEL_WONDERS, DUEL_PROGRESS, DUEL_CONSPIRACIES, type DuelCost, type DuelCardDefinition } from '@hangul-rummikub/shared';
import { resourceNames, buildingBenefits } from './building-info.js';
import { useCardTooltip } from './CardTooltip.js';
export { resourceNames } from './building-info.js';
const resourceGlyph = { wood: '♣', clay: '◒', stone: '⬟', glass: '◈', papyrus: '▤' };
export function Atlas({ index, gods = false, buildings = false, className = '' }: {
    index: number;
    gods?: boolean;
    buildings?: boolean;
    className?: string;
}) { return <span aria-hidden="true" className={`du-art ${className}`} style={{ backgroundImage: `url(/images/seven-wonders-duel/${gods ? 'gods' : buildings ? 'buildings' : 'wonders'}.png)`, backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }}/>; }
export function Cost({ cost, coins = 0 }: {
    cost: DuelCost;
    coins?: number;
}) { return <span className="du-cost">{coins > 0 && <span className="du-coin" title={`${coins}코인`}>{coins}</span>}{DUEL_RESOURCES.filter(r => cost[r]).map(r => <span key={r} className={`du-resource ${r}`} title={`${resourceNames[r]} ${cost[r]}개`} aria-label={`${resourceNames[r]} ${cost[r]}개`}>{resourceGlyph[r]}<small>{cost[r]}</small></span>)}</span>; }
const scienceName: Record<string, string> = { QUILL: '깃펜', MORTAR: '절구', TRIANGLE: '삼각자', WHEEL: '바퀴', SUNDIAL: '해시계', ORBIT: '천구', LAW: '법률' };
const typeName: Record<string, string> = { WONDER: '불가사의', GREY: '회색 건물', BROWN: '갈색 건물', GREEN: '초록 건물', BLUE: '파란 건물', YELLOW: '노란 건물', RED: '빨간 건물', RESOURCES: '갈색·회색 건물', COINS: '코인 3개 묶음' };
export function effectText(d: DuelCardDefinition): string { return [d.points ? `${d.points}점` : '', d.shields ? `방패 ${d.shields}` : '', d.science ? `과학 ${scienceName[d.science]}` : '', d.production ? DUEL_RESOURCES.filter(r => d.production?.[r]).map(r => `${resourceNames[r]} ${d.production![r]} 생산`).join(' · ') : '', d.flex ? `${d.flex.map(r => resourceNames[r]).join('/')} 선택 생산` : '', d.trade ? `${d.trade.map(r => resourceNames[r]).join('/')} 구매 1코인` : '', d.income ? `${d.income}코인 획득` : '', d.incomePer ? `${typeName[d.incomePer]}당 ${d.incomeMultiplier ?? 1}코인` : '', d.guild ? `${typeName[d.guild]}가 더 많은 도시 기준 점수` : '', d.color === 'WHITE' ? '파란 건물 수에 따른 원로원 행동' : d.color === 'BLACK' ? '영향력 배치 또는 음모 획득' : d.color === 'TEMPLE' ? '대신전 총 1/2/3장: 5/12/21점' : ''].filter(Boolean).join(' · '); }
export function definition(id: string) { return DUEL_CARDS.find(d => d.id === id) ?? DUEL_WONDERS.find(d => d.id === id) ?? DUEL_GODS.find(d => d.id === id) ?? DUEL_PROGRESS.find(d => d.id === id) ?? DUEL_CONSPIRACIES.find(d => d.id === id); }
export function DetailArt({ id }: {
    id: string;
}) { const d = definition(id), godIndex = DUEL_GODS.findIndex(d => d.id === id); return <div className="du-detail-art">{godIndex >= 0 ? <Atlas index={godIndex} gods/> : d && 'art' in d ? <Atlas index={d.art} buildings={'color' in d}/> : <div className="du-medallion">{DUEL_PROGRESS.some(d => d.id === id) ? '❧' : '◈'}</div>}<h2>{d?.name ?? '비공개 카드'}</h2></div>; }
export function Card({ id, back = 'AGE', onClick, available = false, selected = false, style, tag, tooltip }: {
    tooltip?: ReactNode;
    id: string | null;
    back?: 'AGE' | 'SENATOR';
    onClick(): void;
    available?: boolean;
    selected?: boolean;
    style?: CSSProperties;
    tag?: string | undefined;
}) {
    const preview = useCardTooltip(id && tooltip ? id : null, tooltip, 'du-building-tooltip');
    const previous = useRef(id), [revealing, setRevealing] = useState(false);
    useEffect(() => {
        const revealed = previous.current === null && id !== null;
        previous.current = id;
        if (!revealed)
            return;
        setRevealing(true);
        const timer = setTimeout(() => setRevealing(false), 420);
        return () => clearTimeout(timer);
    }, [id]);
    const d = id ? DUEL_CARDS.find(d => d.id === id) : undefined;
    return <><button {...preview.trigger} type="button" className={`du-card ${d ? `du-${d.color}` : `du-back ${back === 'SENATOR' ? 'senator' : ''}`} ${available ? 'available' : ''} ${selected ? 'selected' : ''} ${revealing ? 'revealing' : ''}`} style={style} onClick={() => { preview.hide(); onClick(); }} aria-label={d ? `${d.name} · ${effectText(d)}${available ? ' · 선택 가능' : ''}` : `비공개 ${back === 'SENATOR' ? '의원' : '시대'} 카드`}>
 {d ? <><Atlas index={d.art} buildings={'color' in d}/><span className="du-card-top"><Cost cost={d.cost} coins={d.coins}/><b>{d.shields ? '⚔'.repeat(d.shields) : d.science ? '✧' : d.points ? `${d.points}❧` : d.color === 'WHITE' ? '♜' : d.color === 'BLACK' ? '◈' : ''}</b></span><span className="du-card-name">{d.name}</span><span className="du-card-benefit">{buildingBenefits(d).badges[0]}</span></> : <><span className="du-back-symbol">{back === 'SENATOR' ? '♜' : 'VII'}</span><small>{back === 'SENATOR' ? 'SENATE' : 'WONDERS'}</small></>}{tag && <span className="du-card-tag">{tag}</span>}
 </button>{preview.tooltip}</>;
}
export function wonderText(d: (typeof DUEL_WONDERS)[number]): string { const effects: Record<string, string> = { DESTROY_GREY: '상대 회색 건물 제거', DESTROY_BROWN: '상대 갈색 건물 제거', LIBRARY: '상자 속 진보 토큰 3개 중 1개 선택', RESURRECT: '버린 카드 1장 무료 건설', THEATER: '신화 덱에서 신 1명 무료 활성화', UNPREPARED: '준비하지 않은 음모 1장 발동', KNOSSOS: '영향력 배치 후 이동' }; return [`${d.points}점`, d.coins ? `${d.coins}코인 획득` : '', d.loss ? `상대 ${d.loss}코인 상실` : '', d.shields ? `방패 ${d.shields}` : '', d.replay ? '추가 턴' : '', d.flex ? `${d.flex.map(r => resourceNames[r]).join('/')} 선택 생산` : '', d.effect ? effects[d.effect] ?? '' : d.id === 'wonder-sanctuary' ? '신 활성화 비용 2코인 할인' : ''].filter(Boolean).join(' · '); }
