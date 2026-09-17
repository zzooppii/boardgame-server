import {useState} from 'react';
import {marsCard,type MarsCard} from '@hangul-rummikub/shared';
import {DEFAULT_MARS_HAND_OPTIONS,filterMarsHand} from './hand.js';
import {MarsCardView,marsCardActionStatus} from './cards.js';

export const MARS_PLAYED_FILTERS=[
 {id:'all',label:'모든 카드'},
 {id:'unused',label:'이번 세대 미사용 행동'},
 {id:'action',label:'행동 카드'},
 {id:'passive',label:'지속 효과'},
 {id:'resource',label:'자원 보유 카드'},
] as const;
export type MarsPlayedFilter=typeof MARS_PLAYED_FILTERS[number]['id'];
export function filterMarsPlayed(cards:readonly MarsCard[],generation:number,query:string,filter:MarsPlayedFilter,actionsFirst:boolean):MarsCard[]{
 const result=filterMarsHand(cards,[],{...DEFAULT_MARS_HAND_OPTIONS,query}).filter(card=>{
  const definition=marsCard(card.definitionId);
  switch(filter){
   case 'unused':return !!definition.actions&&card.usedGeneration!==generation;
   case 'action':return !!definition.actions;
   case 'passive':return !!definition.passive;
   case 'resource':return !!definition.resource&&card.resources>0;
   default:return true;
  }
 });
 if(actionsFirst)result.sort((a,b)=>Number(!!marsCard(b.definitionId).actions)-Number(!!marsCard(a.definitionId).actions));
 return result;
}
export function PlayedCards({cards,generation,selected,onSelect,own=false}:{cards:readonly MarsCard[];generation:number;selected:string|null;onSelect(card:MarsCard):void;own?:boolean}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<MarsPlayedFilter>('all');
 const visible=filterMarsPlayed(cards,generation,query,filter,own);
 return <section aria-label="낸 카드 탐색">
  <div className="tm-hand-tools">
   <label>낸 카드 검색<input type="search" value={query} placeholder="이름·효과·카드 번호" onChange={e=>setQuery(e.target.value)}/></label>
   <label>낸 카드 필터<select aria-label="낸 카드 필터" value={filter} onChange={e=>setFilter(MARS_PLAYED_FILTERS.find(f=>f.id===e.target.value)?.id??'all')}>{MARS_PLAYED_FILTERS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
   <button aria-label="낸 카드 필터 초기화" onClick={()=>{setQuery('');setFilter('all');}}>필터 초기화</button><span role="status">{visible.length} / {cards.length}장</span>
  </div>
  {filter==='unused'&&<p className="tm-muted">사용 여부만 표시합니다. 실행 조건·비용·현재 차례는 별도로 확인하세요.</p>}
  {!visible.length?<p className="tm-empty">{cards.length?'조건에 맞는 낸 카드가 없습니다. 검색어나 필터를 변경하세요.':'아직 낸 카드가 없습니다.'}</p>:<div className="tm-card-grid">{visible.map(card=><div key={card.tileId}><MarsCardView card={card} generation={generation} selected={selected===card.tileId} onSelect={()=>onSelect(card)}/>{marsCard(card.definitionId).actions&&<span className={'tm-use-status '+(card.usedGeneration===generation?'used':'')}>{marsCardActionStatus(card,generation)}</span>}</div>)}</div>}
 </section>;
}
