import {ARK_SOLO_ABILITIES,arkSoloCardAbilities,ARK_CARDS, ARK_GOALS, ARK_PROJECTS, ARK_TAG_LABELS, arkCardName, type ArkCard} from '@hangul-rummikub/shared';
import {arkProjectCopy,arkProjectSlotCopy} from './project-copy.js';
import {arkGoalCopy} from './goal-copy.js';
import {arkSponsorCopy} from './sponsor-copy.js';
import {arkArtFamily} from './presentation.js';
import {arkAbilityCopy} from './card-copy.js';

export function ArkNovaCard({card,selected=false,disabled=false,onSelect}:{card:ArkCard;selected?:boolean;disabled?:boolean;onSelect?():void}) {
  const definition=ARK_CARDS.find(c=>c.key===card.key),family=definition?arkArtFamily(definition):0;
  const goal=ARK_GOALS.find(c=>c.key===card.key),project=ARK_PROJECTS.find(c=>c.key===card.key);
  return <article className={`ark-live-card ${selected?'is-selected':''}`}>
    <button type="button" className="ark-live-card-select" aria-pressed={selected} disabled={disabled||!onSelect} onClick={onSelect} aria-label={`${arkCardName(card.key)}${selected?' 선택됨':''}`}>
      <div aria-hidden="true" className={`ark-family-art ${definition?.kind!=='ANIMAL'?'ark-sponsor-art':''}`} style={definition?.kind==='ANIMAL'?{backgroundPosition:`${family%3*50}% ${Math.floor(family/3)*100}%`}:undefined}><span>{definition?.kind==='ANIMAL'?'WILDLIFE':definition?.kind==='SPONSOR'?'ZOO PARTNERS':'CONSERVATION'}</span></div>
      <div className="ark-live-card-copy"><small>{card.key} · {definition?.kind==='ANIMAL'?'동물':definition?.kind==='SPONSOR'?'후원자':ARK_GOALS.some(c=>c.key===card.key)?'최종 목표':'보전 프로젝트'}</small><strong>{arkCardName(card.key)}</strong>
      {definition&&<span>{definition.kind==='ANIMAL'?`비용 ${definition.cost} · 우리 ${definition.size}`:`후원 등급 ${definition.cost}`} · 매력 {definition.appeal}</span>}
      {selected&&<span className="ark-selection-mark">✓ 선택됨</span>}</div>
    </button>
    <details><summary>카드 내용</summary>{definition?<div className="ark-live-card-details">
      <p>{definition.tags.map(t=>ARK_TAG_LABELS[t]??t).join(' · ')}</p>
      <p>조건: {definition.requirements.length?definition.requirements.map(t=>ARK_TAG_LABELS[t]??t).join(' · '):'아이콘 조건 없음'}{definition.water?` · 물 ${definition.water}`:''}{definition.rock?` · 바위 ${definition.rock}`:''}</p>
      {definition.kind==='SPONSOR'&&arkSponsorCopy[definition.key]?.map((text,i)=><p key={`sponsor-${i}`}>{text}</p>)}{ARK_SOLO_ABILITIES[definition.key]&&<strong>솔로 전용 효과</strong>}{arkSoloCardAbilities(definition).map((a,i)=><p key={i}>{arkAbilityCopy(a,true)}</p>)}
    </div>:<div>{goal&&arkGoalCopy(goal).map((text,i)=><p key={i}>{text}</p>)}{project&&<><p>{arkProjectCopy(project)}</p>{project.slots.map((_,i)=><p key={i}>{arkProjectSlotCopy(project,i)}</p>)}</>}</div>}</details>
  </article>;
}
export function ArkNovaCardRow({cards,selected=[],disabled=false,onSelect}:{cards:readonly ArkCard[];selected?:readonly string[];disabled?:boolean;onSelect?(id:string):void}) {
  return <div className="ark-live-card-row">{cards.map(card=><ArkNovaCard key={card.cardId} card={card} selected={selected.includes(card.cardId)} disabled={disabled} {...(onSelect?{onSelect:()=>onSelect(card.cardId)}:{})}/>)}</div>;
}

/** Keep empty slots visible: a card's display position must not shift before server refill. */
export function ArkNovaDisplay({cards,selected,disabled,onSelect}:{cards:readonly (ArkCard|null)[];selected:string|null;disabled:boolean;onSelect(id:string):void}) {
  return <div className="ark-live-display">{cards.map((card,index)=><section key={index} aria-label={`공개 카드 ${index+1}번 칸`}><h3>{index+1}번 칸</h3>{card?<ArkNovaCard card={card} selected={selected===card.cardId} disabled={disabled} onSelect={()=>onSelect(card.cardId)}/>:<div className="ark-live-empty">다음 보충을 기다리는 빈 칸</div>}</section>)}</div>;
}
