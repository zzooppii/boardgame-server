import {ArkTagBadge} from './ArkTagBadge.js';
import {arkReputationRange,ARK_SOLO_ABILITIES,arkSoloCardAbilities,ARK_CARDS, ARK_GOALS, ARK_PROJECTS, ARK_TAG_LABELS, arkCardName, type ArkCard} from '@hangul-rummikub/shared';
import {arkProjectCopy,arkProjectSlotCopy} from './project-copy.js';
import {arkGoalCopy} from './goal-copy.js';
import {arkSponsorCopy} from './sponsor-copy.js';
import {ArkAnimalArt} from './animal-art.js';
import {arkAbilityCopy} from './card-copy.js';

const requirementLabel=(key:string)=>key==='Partner_Zoo'?'같은 대륙 제휴':key==='AnimalsII'?'동물 II':key==='SponsorsII'?'후원자 II':key==='Reputation'?'평판 3 이상':key==='Appeal'?'매력 25 이하':ARK_TAG_LABELS[key]??key;

export function ArkNovaCard({card,selected=false,disabled=false,onSelect}:{card:ArkCard;selected?:boolean;disabled?:boolean;onSelect?():void}) {
  const definition=ARK_CARDS.find(c=>c.key===card.key);
  const abilities=definition?(definition.kind==='SPONSOR'?(arkSponsorCopy[definition.key]??[]):arkSoloCardAbilities(definition).map(a=>arkAbilityCopy(a,true))):[];
  const habitats:Readonly<Record<string,string>>={ReptileHouse:'파충류관',LargeBirdAviary:'대형 조류관',PettingZoo:'체험 동물원'};
  const goal=ARK_GOALS.find(c=>c.key===card.key),project=ARK_PROJECTS.find(c=>c.key===card.key);
  return <article className={`ark-live-card ${definition?.kind==='ANIMAL'?'is-animal':definition?.kind==='SPONSOR'?'is-sponsor':''} ${selected?'is-selected':''}`}>
    <button type="button" className="ark-live-card-select" aria-pressed={selected} disabled={disabled||!onSelect} onClick={onSelect} aria-label={`${arkCardName(card.key)}${selected?' 선택됨':''}`}>
      <div className="ark-card-picture"><ArkAnimalArt cardKey={card.key}/>{definition&&<div className="ark-card-corners"><span className="ark-card-cost">{definition.kind==='ANIMAL'?`비용 ${definition.cost}`:`후원 등급 ${definition.cost}`}</span>{definition.kind==='ANIMAL'&&<span className="ark-card-size">우리 {definition.size}{!definition.standard?' · 특수':''}</span>}</div>}</div>
      <div className="ark-live-card-copy"><small>{card.key} · {definition?.kind==='ANIMAL'?'동물':definition?.kind==='SPONSOR'?'후원자':ARK_GOALS.some(c=>c.key===card.key)?'최종 목표':'보전 프로젝트'}</small><strong>{arkCardName(card.key)}</strong>
      {definition&&<>
        <span className="ark-card-tags" aria-label="카드 아이콘">{definition.tags.map((tag,i)=><ArkTagBadge key={`${tag}-${i}`} tag={tag}/>)}</span>
        <span className="ark-card-requirements">조건: {definition.requirements.length?definition.requirements.map(requirementLabel).join(' · '):'없음'}{definition.water?` · 물 ${definition.water}`:''}{definition.rock?` · 바위 ${definition.rock}`:''}</span>
        {definition.kind==='ANIMAL'&&<span className="ark-card-habitats">서식지: {definition.standard?`일반 우리 ${definition.size}칸`: '특수 우리 전용'}{definition.special.map((h,i)=><span key={i}> · {habitats[h.kind]??h.kind} {h.size}칸</span>)}</span>}
        <span className="ark-card-abilities" aria-label="특수능력">{ARK_SOLO_ABILITIES[definition.key]&&<b>솔로 전용 효과</b>}{abilities.length?abilities.map((text,i)=><span key={i}>{text}</span>):<span>추가 특수능력 없음</span>}</span>
        <span className="ark-card-scores" aria-label="인쇄된 기본 보상"><span>매력 {definition.appeal}</span><span>보전 {definition.conservation}</span><span>평판 {definition.reputation}</span></span>
      </>}
      {selected&&<span className="ark-selection-mark">✓ 선택됨</span>}</div>
    </button>
    <details><summary>카드 내용</summary>{definition?<div className="ark-live-card-details">
      <p>{definition.tags.map(t=>ARK_TAG_LABELS[t]??t).join(' · ')}</p>
      <p>조건: {definition.requirements.length?definition.requirements.map(t=>ARK_TAG_LABELS[t]??t).join(' · '):'아이콘 조건 없음'}{definition.water?` · 물 ${definition.water}`:''}{definition.rock?` · 바위 ${definition.rock}`:''}</p>
      {definition.kind==='SPONSOR'&&arkSponsorCopy[definition.key]?.map((text,i)=><p key={`sponsor-${i}`}>{text}</p>)}{ARK_SOLO_ABILITIES[definition.key]&&<strong>솔로 전용 효과</strong>}{arkSoloCardAbilities(definition).map((a,i)=><p key={i}>{arkAbilityCopy(a,true)}</p>)}
    </div>:<div>{goal&&arkGoalCopy(goal).map((text,i)=><p key={i}>{text}</p>)}{project&&<><p>{arkProjectCopy(project)}</p>{project.slots.map((_,i)=><p key={i}>{arkProjectSlotCopy(project,i)}</p>)}</>}</div>}</details>
  </article>;
}
export function ArkNovaCardRow({cards,selected=[],disabled=false,onSelect,maxSelected}:{cards:readonly ArkCard[];selected?:readonly string[];disabled?:boolean;maxSelected?:number;onSelect?(id:string):void}) {
  const atLimit=maxSelected!==undefined&&cards.filter(c=>selected.includes(c.cardId)).length>=maxSelected;
  return <div className="ark-live-card-row">{cards.map(card=><ArkNovaCard key={card.cardId} card={card} selected={selected.includes(card.cardId)} disabled={disabled||atLimit&&!selected.includes(card.cardId)} {...(onSelect?{onSelect:()=>onSelect(card.cardId)}:{})}/>)}</div>;
}

/** Keep empty slots visible: a card's display position must not shift before server refill. */
const reputationRewards:Readonly<Record<number,string>>={5:'행동 II',8:'직원 +1',10:'카드 1',11:'보전 +1',12:'X +1',13:'카드 2',14:'보전 +1',15:'X +1'};
export function ArkNovaDisplay({cards,selected,disabled,onSelect,reputation=1,cardsUpgraded=false}:{cards:readonly (ArkCard|null)[];selected:string|null;disabled:boolean;onSelect(id:string):void;reputation?:number;cardsUpgraded?:boolean}) {
  const range=arkReputationRange(reputation);
  const groups=Array.from({length:6},(_,i)=>Array.from({length:15},(_,n)=>n+1).filter(n=>arkReputationRange(n)===i+1));
  return <div className="ark-market-board">
    <div className="ark-market-caption"><strong>공개 카드 · 평판 연결판</strong><span>현재 평판 {reputation} · 1–{range}번 칸이 평판 범위 안</span></div>
    <p className="ark-market-help">평판은 명성을 나타냅니다. 범위 안의 공개 카드 이용에는 행동별 조건도 필요합니다. 낚아채기는 평판 범위와 무관합니다.</p>
    <div className="ark-market-scroll" role="region" aria-label="공개 카드와 평판 트랙 · 가로로 스크롤" tabIndex={0}><div className="ark-market-surface">
      <div className="ark-live-display">{cards.map((card,index)=><section key={index} aria-label={`공개 카드 ${index+1}번 칸`} className={index<range?'is-in-range':'is-outside-range'}><h3><b>{index+1}</b><span>{index<range?'평판 범위 안':`평판 ${groups[index]?.[0]}부터`}</span></h3>{card?<ArkNovaCard card={card} selected={selected===card.cardId} disabled={disabled} onSelect={()=>onSelect(card.cardId)}/>:<div className="ark-live-empty">다음 보충을 기다리는 빈 칸</div>}</section>)}</div>
      <div className="ark-reputation-track" aria-label="평판 트랙">{groups.map((values,index)=><div className="ark-reputation-group" key={index} aria-label={`${index+1}번 공개 카드에 연결된 평판`}>
        {values.map(value=><div key={value} className={`ark-reputation-step ${value===reputation?'is-current':''} ${value>9&&!cardsUpgraded?'is-locked':''}`} aria-current={value===reputation?'step':undefined} aria-label={`평판 ${value}${value===reputation?', 현재 위치':''}${value>9&&!cardsUpgraded?', 카드 II 필요':''}${reputationRewards[value]?`, ${reputationRewards[value]}`:''}`}><b>{value}</b>{value===reputation&&<span className="ark-reputation-marker" aria-hidden="true">●</span>}<small>{reputationRewards[value]??'·'}</small></div>)}
      </div>)}</div>
    </div></div>
    <p className="ark-market-help">{cardsUpgraded?'카드 II · 평판 15까지 진행 가능':'평판 10–15는 카드 행동 II 필요 · 현재 상한 9'}. 금색 마커가 현재 위치입니다. 카드의 숫자는 인쇄된 기본값이며 실제 지불액은 선택 후 안내에 표시됩니다.</p>
  </div>;
}
