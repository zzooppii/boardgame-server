import {useState, type KeyboardEvent} from 'react';
import {ARK_BUILDINGS, ARK_MAP_A, arkCellKey, type ArkBuilding, type ArkCell} from '@hangul-rummikub/shared';
import {BoardIllustrationDefs, BoardBonus} from './BoardIllustration.js';
import {arkHexPoints, arkScreenPoint} from './presentation.js';

const bonuses:Readonly<Record<string,string>>={REPUTATION_2:'↑2',X_1:'X',CARD_1:'▤',MONEY_5:'5',MONEY_10:'10',WORKER:'♟'};
export const arkBoardCellInput=(cell:ArkCell):ArkCell=>({q:cell.q,r:cell.r});
export type ArkNovaBoardProps=Readonly<{
  buildings:readonly ArkBuilding[];selected:ArkCell|null;ghost?:readonly ArkCell[];invalid?:boolean;
  disabled?:boolean;onSelect(cell:ArkCell):void;onRotate?():void;onReflect?():void;onCancel?():void;
}>;
/** Server buildings are immutable here; the translucent placement is only an input draft. */
export function ArkNovaBoard({buildings,selected,ghost=[],invalid=false,disabled=false,onSelect,onRotate,onReflect,onCancel}:ArkNovaBoardProps) {
  const [focused,setFocused]=useState(0);
  const occupied=new Map(buildings.flatMap(b=>b.cells.map(c=>[arkCellKey(c),b] as const)));
  function key(e:KeyboardEvent<SVGPolygonElement>,index:number) {
    if(disabled)return;
    if(e.key==='Enter'||e.key===' ') {e.preventDefault();onSelect(arkBoardCellInput(ARK_MAP_A[index]!));return;}
    if(e.key.toLowerCase()==='r'){e.preventDefault();onRotate?.();return;}
    if(e.key.toLowerCase()==='f'){e.preventDefault();onReflect?.();return;}
    if(e.key==='Escape'){e.preventDefault();onCancel?.();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();
    const origin=arkScreenPoint(ARK_MAP_A[index]!);
    const candidates=ARK_MAP_A.map((cell,i)=>({i,p:arkScreenPoint(cell)})).filter(({p})=>
      e.key==='ArrowLeft'?p.x<origin.x:e.key==='ArrowRight'?p.x>origin.x:e.key==='ArrowUp'?p.y<origin.y:p.y>origin.y);
    const next=candidates.sort((a,b)=>Math.hypot(a.p.x-origin.x,a.p.y-origin.y)-Math.hypot(b.p.x-origin.x,b.p.y-origin.y))[0];
    if(next)e.currentTarget.ownerSVGElement?.querySelector<SVGPolygonElement>(`[data-cell-index="${next.i}"]`)?.focus();
  }
  return <div className="ark-map-panel"><div className="ark-map-heading"><span>MY ZOO · 지도 A</span><span>{buildings.length}개 시설</span></div>
    <svg className="ark-map" viewBox="0 0 450 410" role="group" aria-label="내 동물원 지도. 방향키로 이동, Enter로 칸 선택, R 회전, F 반전.">
      <BoardIllustrationDefs/><rect x="4" y="4" width="442" height="402" rx="14" fill="url(#ark-painted-grass)" pointerEvents="none"/>
      {ARK_MAP_A.map((cell,i)=>{
        const id=arkCellKey(cell),b=occupied.get(id),p=arkScreenPoint(cell),isSelected=selected!==null&&id===arkCellKey(selected);
        const label=`${cell.q+1}열 ${cell.r+Math.ceil(cell.q/2)+1}칸, ${b?ARK_BUILDINGS[b.kind]?.name??'특수 건물':cell.terrain==='WATER'?'물':cell.terrain==='ROCK'?'바위':'빈 땅'}${b?.occupied?', 동물 입주':''}${cell.restricted?', 건설 II 필요':''}`;
        return <g key={id}><polygon points={arkHexPoints(cell)} role="button" data-cell-index={i} tabIndex={focused===i?0:-1} aria-label={label} aria-disabled={disabled} aria-pressed={isSelected}
          className={`ark-hex terrain-${cell.terrain.toLowerCase()} ${isSelected?'is-anchor':''} ${b?`is-built ${b.occupied?'is-occupied':''} ${b.kind==='KIOSK'?'is-kiosk':b.kind==='PAVILION'?'is-pavilion':''}`:''}`}
          onFocus={()=>setFocused(i)} onKeyDown={e=>key(e,i)} onClick={()=>{if(!disabled)onSelect(arkBoardCellInput(cell));}}/>
          {!b&&cell.bonus&&<BoardBonus x={p.x} y={p.y} label={bonuses[cell.bonus]??'+'}/>}
          {!b&&cell.restricted&&<BoardBonus x={p.x} y={p.y} label="II" restricted/>}
          {b&&(b.kind==='KIOSK'||b.kind==='PAVILION'||b.occupied)&&<text className="ark-hex-label" x={p.x} y={p.y+5} pointerEvents="none">{b.kind==='KIOSK'?'⌂':b.kind==='PAVILION'?'✦':'●'}</text>}
        </g>;
      })}
      {ghost.map(c=><polygon key={arkCellKey(c)} points={arkHexPoints(c,27)} className={`ark-ghost ${invalid?'is-invalid':''}`} pointerEvents="none"/>)}
      {selected&&<circle cx={arkScreenPoint(selected).x} cy={arkScreenPoint(selected).y} r="5" fill="#fffef4" stroke="#23483a" strokeWidth="2" pointerEvents="none"/>}
    </svg><p className="ark-map-help">칸 선택 · <kbd>R</kbd> 회전 · <kbd>F</kbd> 반전 · <kbd>Esc</kbd> 선택 해제</p>
  </div>;
}
