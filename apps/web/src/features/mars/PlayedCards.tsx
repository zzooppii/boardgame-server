import {useState} from 'react';
import {marsCard,MARS_TAG_NAMES,MARS_CARD_RESOURCE_NAMES,type MarsCard} from '@hangul-rummikub/shared';
import {DEFAULT_MARS_HAND_OPTIONS,filterMarsHand} from './hand.js';
import {MarsArt,MarsCardView,marsCardActionStatus} from './cards.js';

export const MARS_PLAYED_FILTERS=[
 {id:'all',label:'모든 카드'},
 {id:'unused',label:'이번 세대 미사용 행동'},
 {id:'action',label:'행동 카드'},
 {id:'passive',label:'지속 효과'},
 {id:'resource',label:'자원 보유 카드'},
] as const;
export const MARS_PLAYED_SORTS=[{id:'default',label:'기본 순서'},{id:'latest',label:'최근 실행순'},{id:'name',label:'이름순'},{id:'resources',label:'자원 많은 순'}] as const;
export type MarsPlayedSort=typeof MARS_PLAYED_SORTS[number]['id'];
export type MarsPlayedFilter=typeof MARS_PLAYED_FILTERS[number]['id'];
export function filterMarsPlayed(cards:readonly MarsCard[],generation:number,query:string,filter:MarsPlayedFilter,actionsFirst:boolean,sort:MarsPlayedSort='default',tag=''):MarsCard[]{
 const result=filterMarsHand(cards,[],{...DEFAULT_MARS_HAND_OPTIONS,query,tag}).filter(card=>{
  const definition=marsCard(card.definitionId);
  switch(filter){
   case 'unused':return !!definition.actions&&card.usedGeneration!==generation;
   case 'action':return !!definition.actions;
   case 'passive':return !!definition.passive;
   case 'resource':return !!definition.resource&&card.resources>0;
   default:return true;
  }
 });
 if(sort==='latest')result.reverse();
 else if(sort==='name')result.sort((a,b)=>marsCard(a.definitionId).name.localeCompare(marsCard(b.definitionId).name,'ko'));
 else if(sort==='resources')result.sort((a,b)=>b.resources-a.resources);
 else if(actionsFirst)result.sort((a,b)=>Number(!!marsCard(b.definitionId).actions)-Number(!!marsCard(a.definitionId).actions));
 return result;
}
export function PlayedCardRow({card,generation,selected,onSelect}:{card:MarsCard;generation:number;selected:boolean;onSelect():void}){
 const definition=marsCard(card.definitionId),status=marsCardActionStatus(card,generation);
 const resource=definition.resource?`${MARS_CARD_RESOURCE_NAMES[definition.resource]} ${card.resources}개`:null;
 return <button className="tm-played-row" aria-pressed={selected} onClick={onSelect} aria-label={[definition.name,resource,status,'카드 상세 열기'].filter(Boolean).join(' · ')}>
  <MarsArt cell={definition.art} definitionId={definition.id}/>
  <span className="tm-played-row-copy"><strong>{definition.name}</strong><small>{definition.englishName} · #{definition.number}</small><span>{definition.tags.map(tag=>MARS_TAG_NAMES[tag]).join(' · ')}</span>{resource&&<b>{resource}</b>}{status&&<span className={card.usedGeneration===generation?'tm-played-used':''}>{status}</span>}</span>
 </button>;
}
export function PlayedCards({cards,generation,selected,onSelect,own=false}:{cards:readonly MarsCard[];generation:number;selected:string|null;onSelect(card:MarsCard):void;own?:boolean}){
 const [query,setQuery]=useState(''),[tag,setTag]=useState(''),[filter,setFilter]=useState<MarsPlayedFilter>('all'),[view,setView]=useState<'cards'|'list'>('cards'),[sort,setSort]=useState<MarsPlayedSort>('default');
 const visible=filterMarsPlayed(cards,generation,query,filter,own,sort,tag);
 return <section aria-label="낸 카드 탐색">
  <div className="tm-hand-tools">
   <label>낸 카드 검색<input type="search" value={query} placeholder="이름·효과·카드 번호" onChange={e=>setQuery(e.target.value)}/></label>
   <label>인쇄 태그<select aria-label="낸 카드 태그" value={tag} onChange={e=>setTag(e.target.value)}><option value="">모든 태그</option>{Object.entries(MARS_TAG_NAMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>낸 카드 필터<select aria-label="낸 카드 필터" value={filter} onChange={e=>setFilter(MARS_PLAYED_FILTERS.find(f=>f.id===e.target.value)?.id??'all')}>{MARS_PLAYED_FILTERS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
   <label>정렬<select aria-label="낸 카드 정렬" value={sort} onChange={e=>setSort(MARS_PLAYED_SORTS.find(s=>s.id===e.target.value)?.id??'default')}>{MARS_PLAYED_SORTS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label>보기 방식<select aria-label="낸 카드 보기 방식" value={view} onChange={e=>setView(e.target.value==='list'?'list':'cards')}><option value="cards">카드 그림 보기</option><option value="list">간단 목록 보기</option></select></label>
   <button aria-label="낸 카드 필터 초기화" onClick={()=>{setQuery('');setTag('');setFilter('all');setSort('default');}}>필터 초기화</button><span role="status">{visible.length} / {cards.length}장</span>
  </div>
  {filter==='unused'&&<p className="tm-muted">사용 여부만 표시합니다. 실행 조건·비용·현재 차례는 별도로 확인하세요.</p>}
  {!visible.length?<p className="tm-empty">{cards.length?'조건에 맞는 낸 카드가 없습니다. 검색어나 필터를 변경하세요.':'아직 낸 카드가 없습니다.'}</p>:view==='list'?<div className="tm-played-list">{visible.map(card=><PlayedCardRow key={card.tileId} card={card} generation={generation} selected={selected===card.tileId} onSelect={()=>onSelect(card)}/>)}</div>:<div className="tm-card-grid">{visible.map(card=><div key={card.tileId}><MarsCardView card={card} generation={generation} selected={selected===card.tileId} onSelect={()=>onSelect(card)}/>{marsCard(card.definitionId).actions&&<span className={'tm-use-status '+(card.usedGeneration===generation?'used':'')}>{marsCardActionStatus(card,generation)}</span>}</div>)}</div>}
 </section>;
}
