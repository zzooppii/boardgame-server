import {SPEAKEASY_BUILDING_LABELS,type SpeakeasyPracticeView} from '@hangul-rummikub/shared';

export function PracticeSettlement({view,busy,onInspect}:{
  view:SpeakeasyPracticeView;busy:boolean;onInspect(choice:SpeakeasyPracticeView['choices'][number]):void;
}) {
  if(view.finished)return null;
  const settlement=view.settlement;
  if(!settlement)return <section className="sp-practice-settlement" aria-label="다음 정산"><strong>11턴 종료 · 최종 정산</strong><p>지역 수입 지급은 끝났습니다. 현금·금고·보호 건물의 점수로 승자를 정합니다.</p></section>;
  const affected=view.districts.flatMap(d=>d.slots.flatMap((b,slot)=>b&&settlement.atRisk.includes(b.tileId)?[{building:b,district:d.id,slot}]:[]));
  return <section className={`sp-practice-settlement ${affected.length?'is-warning':''}`} aria-label="다음 정산">
    <div><strong>{settlement.turn===view.turn?'이번 턴 종료':`${settlement.turn}턴 종료`} · {settlement.district}구역 경찰 진입</strong><span>내 금고 예상 수입 <b>+${settlement.income}</b></span></div>
    <p>현재 건물 상태에 경찰 진입을 반영한 예상입니다. 정산 전 건설·보호에 따라 금액이 달라집니다.</p>
    {affected.length?<><p className="sp-settlement-warning">보호하지 않으면 내 건물 {affected.length}곳의 영업이 중단됩니다.</p><ul>{affected.map(item=>{
      const protect=view.choices.find(c=>c.action.type==='PROTECT'&&c.action.buildingId===item.building.tileId);
      return <li key={item.building.tileId}><span>{item.district}구역 {item.slot+1}번 칸 · {SPEAKEASY_BUILDING_LABELS[item.building.kind]}</span>
        {protect?<button type="button" disabled={busy} onClick={()=>onInspect(protect)}>{item.district}구역 {item.slot+1}번 칸 보호 미리보기</button>:<span>{view.actionsLeft===0?'남은 행동 없음':'지금은 보호할 수 없음'}</span>}</li>;
    })}</ul></>:<p>이번 경찰 진입으로 새로 영업이 중단될 내 건물은 없습니다.</p>}
  </section>;
}
