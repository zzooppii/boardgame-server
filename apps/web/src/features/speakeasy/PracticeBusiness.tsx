import {useState} from 'react';
import {SPEAKEASY_BUILDING_LABELS, type SpeakeasyPracticeView} from '@hangul-rummikub/shared';
import {SpeakeasyBuildingArt} from './art.js';
import {practiceBusinesses, filterPracticeBusinesses, type PracticeBusinessFilter} from './practice-business.js';

const filters = [{id:'ALL',label:'전체'},{id:'SELL',label:'판매 가능'},{id:'CLOSED',label:'영업 중단'},{id:'UNPROTECTED',label:'미보호'}] as const;
export function PracticeBusiness({view,busy,onInspect}: {
  view: SpeakeasyPracticeView; busy: boolean;
  onInspect(choice: SpeakeasyPracticeView['choices'][number]): void;
}) {
  const [filter,setFilter]=useState<PracticeBusinessFilter>('ALL');
  const businesses=practiceBusinesses(view),visible=filterPracticeBusinesses(businesses,filter);
  return <details className="sp-practice-business">
    <summary>내 사업 현황 · {businesses.length}곳 · 영업 중단 {businesses.filter(item=>!item.building.operating).length}곳</summary>
    <div className="sp-business-resources">
      <span>보호된 건물 {businesses.filter(item=>item.building.protected).length}곳</span>
      <span>남은 조직원 {view.family}명</span>
      <span>트럭 {view.truck.district===null?'지도 밖':`${view.truck.district}구역`} · 주류 {view.truck.load}개</span>
      {view.reserves.map(reserve=><span key={reserve.kind}>남은 {SPEAKEASY_BUILDING_LABELS[reserve.kind]} {reserve.count}개</span>)}
    </div>
    <div className="sp-business-filters" role="group" aria-label="내 건물 상태 필터">
      {filters.map(item=><button type="button" key={item.id} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label} {filterPracticeBusinesses(businesses,item.id).length}</button>)}
    </div>
    <p>판매 가능은 지금 남은 행동으로 판매할 수 있는 건물입니다. 버튼을 누르면 비용과 결과를 먼저 확인합니다.</p>
    <div className="sp-business-cards">{visible.map(item=><article key={item.building.tileId} aria-label={`${item.district}구역 ${item.slot+1}번 칸 내 ${SPEAKEASY_BUILDING_LABELS[item.building.kind]}`} className={item.building.operating?'':'is-closed'}>
      <div className="sp-business-title"><SpeakeasyBuildingArt kind={item.building.kind}/><div><h3>{SPEAKEASY_BUILDING_LABELS[item.building.kind]}</h3><span>{item.district}구역 · {item.slot+1}번 칸</span></div></div>
      <ul className="sp-business-badges">
        <li className={item.building.operating?'':'is-warning'}>{item.building.operating?'영업 중':'영업 중단'}</li>
        <li>{item.building.protected?'조직원 보호':'보호 없음'}</li>
        <li>{item.building.barrel?'주류 1개 보유':item.building.kind==='STILLS'?'주류 생산 시설':'배달된 주류 없음'}</li>
        {item.cop&&<li>경찰 배치</li>}
      </ul>
      <div className="sp-business-choices">{item.choices.map(choice=><button type="button" key={choice.action.type} disabled={busy} onClick={()=>onInspect(choice)}>{choice.label} 미리보기</button>)}</div>
      {!item.choices.length&&<p>{view.finished?'대국이 종료되었습니다.':view.actionsLeft===0?'다음 턴에 행동할 수 있습니다.':'현재 가능한 행동이 없습니다.'}</p>}
    </article>)}</div>
    {!visible.length&&<p role="status">이 상태에 해당하는 내 건물이 없습니다. 다른 상태를 선택해 보세요.</p>}
  </details>;
}
