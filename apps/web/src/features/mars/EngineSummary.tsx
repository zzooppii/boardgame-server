import {marsCard,marsCorporation,marsEffectText,MARS_TAG_NAMES,type MarsPlayerPublic} from '@hangul-rummikub/shared';
export function marsEngineSummary(player:MarsPlayerPublic,generation:number){
 const counts=new Map<string,number>();
 const tags=[...(player.corporationId?marsCorporation(player.corporationId).tags:[]),...player.played.flatMap(c=>{const d=marsCard(c.definitionId);return d.type==='event'?[]:d.tags;})];
 for(const tag of tags)counts.set(tag,(counts.get(tag)??0)+1);
 const actionCards=player.played.filter(c=>marsCard(c.definitionId).actions),unusedCards=actionCards.filter(c=>c.usedGeneration!==generation);
 return {unusedCards,tags:[...counts].map(([tag,count])=>({tag,count})),unused:unusedCards.length,actions:actionCards.length,passives:player.played.filter(c=>marsCard(c.definitionId).passive)};
}
export function EngineSummary({player,generation,onInspect}:{player:MarsPlayerPublic;generation:number;onInspect(tileId:string):void}){
 const summary=marsEngineSummary(player,generation);
 return <section className="tm-engine-summary" aria-label="내 기업 엔진 요약">{player.protectedHabitats&&<p className="tm-protection"><strong>서식지 보호</strong><br/>상대는 내 식물·동물·미생물을 제거할 수 없습니다. 생산량 감소와 내 자원 사용은 보호 대상이 아닙니다.</p>}<div className="tm-engine-tags">{summary.tags.map(t=><span key={t.tag}>{MARS_TAG_NAMES[t.tag]} <b>{t.count}</b></span>)}{!summary.tags.length&&<span>보유 태그 없음</span>}</div><p>이번 세대 미사용 카드 행동 <strong>{summary.unused} / {summary.actions}</strong><small> · 실행 조건과 비용은 카드를 선택해 확인하세요.</small></p>{summary.unusedCards.length>0&&<section className="tm-unused-actions" aria-label="미사용 카드 행동 바로가기"><h3>미사용 카드 행동</h3><div>{summary.unusedCards.map(c=><button key={c.tileId} onClick={()=>onInspect(c.tileId)}><strong>{marsCard(c.definitionId).name}</strong><span>{marsCard(c.definitionId).actions?.map(marsEffectText).join(' · ')}</span><small>카드 확인 →</small></button>)}</div></section>}{summary.actions>0&&summary.unused===0&&<p className="tm-muted">이번 세대의 카드 행동을 모두 사용했습니다.</p>}{summary.passives.length>0&&<details><summary>지속 효과 {summary.passives.length}개</summary>{summary.passives.map(c=><button key={c.tileId} onClick={()=>onInspect(c.tileId)}><strong>{marsCard(c.definitionId).name}</strong><span>{marsCard(c.definitionId).passive}</span></button>)}</details>}</section>;
}
