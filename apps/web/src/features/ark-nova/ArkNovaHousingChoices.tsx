import {arkCellKey,type ArkBuilding,type ArkCell} from '@hangul-rummikub/shared';
import {arkBuildingName} from './board-labels.js';
/** Picking housing only sets the local anchor; admission still requires the explicit play command. */
export function ArkNovaHousingChoices({buildings,eligibleIds,selected,disabled,onChoose}:{buildings:readonly ArkBuilding[];eligibleIds:readonly string[];selected:ArkCell|null;disabled:boolean;onChoose(cell:ArkCell):void}) {
  const eligible=buildings.filter(b=>eligibleIds.includes(b.id));
  if(!eligible.length)return null;
  return <div className="ark-housing-choices" role="group" aria-label="입주 가능한 우리 선택"><p>우리 선택 · 지도 또는 아래 버튼을 누르세요.</p>{eligible.map(b=>{
    const cell=b.cells[0];if(!cell)return null;
    const active=selected!==null&&b.cells.some(c=>arkCellKey(c)===arkCellKey(selected));
    return <button type="button" key={b.id} disabled={disabled} aria-pressed={active} onClick={()=>onChoose({q:cell.q,r:cell.r})}><b>{arkBuildingName(b)}</b><span>{cell.q+1}열 {cell.r+Math.ceil(cell.q/2)+1}칸 기준</span><span>{active?'✓ 선택됨':'이 우리 선택'}</span></button>;
  })}<small>우리 선택만으로 입주하지 않습니다. ‘카드 사용’을 눌러 확정하세요.</small></div>;
}
