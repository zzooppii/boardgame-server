import {arkSponsorCopy} from './sponsor-copy.js';
import {arkMapBonusLabels,arkBuildingName,arkUniqueBuildingCardKey,arkBuildingLabel,arkBuildingOutline} from './board-labels.js';
import type {ArkFeedback} from './feedback.js';
import {useId, useState, type KeyboardEvent} from 'react';
import {ARK_MAP_A, arkCellKey, type ArkBuilding, type ArkCell} from '@hangul-rummikub/shared';
import {BoardIllustrationDefs, BoardBonus} from './BoardIllustration.js';
import {arkHexPoints, arkScreenPoint} from './presentation.js';

const bonuses:Readonly<Record<string,string>>={REPUTATION_2:'↑2',X_1:'X',CARD_1:'▤',MONEY_5:'5',MONEY_10:'10',WORKER:'♟'};
export const arkBoardCellInput=(cell:ArkCell):ArkCell=>({q:cell.q,r:cell.r});
export type ArkNovaBoardProps=Readonly<{
  eligibleBonusCells?:readonly ArkCell[];eligibleHousingIds?:readonly string[];feedback?:ArkFeedback|null;buildings:readonly ArkBuilding[];selected:ArkCell|null;ghost?:readonly ArkCell[];invalid?:boolean;
  disabled?:boolean;onSelect(cell:ArkCell):void;onRotate?():void;onReflect?():void;onCancel?():void;
}>;
/** Server buildings are immutable here; the translucent placement is only an input draft. */
export function ArkNovaBoard({eligibleBonusCells=[],eligibleHousingIds=[],feedback,buildings,selected,ghost=[],invalid=false,disabled=false,onSelect,onRotate,onReflect,onCancel}:ArkNovaBoardProps) {
  const tileId=useId();
  const [focused,setFocused]=useState(0),[zoomed,setZoomed]=useState(false);
  const occupied=new Map(buildings.flatMap(b=>b.cells.map(c=>[arkCellKey(c),b] as const)));
  const selectedBuilding=selected?occupied.get(arkCellKey(selected)):undefined;
  const uniqueCardKey=selectedBuilding?arkUniqueBuildingCardKey(selectedBuilding):null;
  const selectedMapCell=selected?ARK_MAP_A.find(c=>arkCellKey(c)===arkCellKey(selected)):undefined;
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
    <p className="ark-map-legend">노란 오각형: 건설로 덮으면 받는 보상 · 굵은 노란 테두리 하나 = 우리 하나 · 모래색: 빈 우리 · 진한 초록: 동물 입주 · 청록색: 후원자 고유 건물 · 보라색 II: 건설 II 필요</p>
    <div className={`ark-map-viewport ${zoomed?'is-zoomed':''}`}><svg className="ark-map" viewBox="0 0 450 410" role="group" aria-label="내 동물원 지도. 방향키로 이동, Enter로 칸 선택, R 회전, F 반전.">
      <BoardIllustrationDefs/><rect x="4" y="4" width="442" height="402" rx="14" fill="url(#ark-painted-grass)" pointerEvents="none"/>
      {ARK_MAP_A.map((cell,i)=>{
        const id=arkCellKey(cell),b=occupied.get(id),p=arkScreenPoint(cell),isSelected=selected!==null&&id===arkCellKey(selected);
        const bonusEligible=eligibleBonusCells.some(c=>arkCellKey(c)===id);
        const label=`${cell.q+1}열 ${cell.r+Math.ceil(cell.q/2)+1}칸, ${b?arkBuildingName(b):cell.terrain==='WATER'?'물':cell.terrain==='ROCK'?'바위':'빈 땅'}${b?.occupied?', 동물 입주':''}${b&&eligibleHousingIds.includes(b.id)?', 입주 가능':''}${cell.restricted?', 건설 II 필요':''}${!b&&cell.bonus?`, 덮으면 ${arkMapBonusLabels[cell.bonus]??cell.bonus}`:''}${bonusEligible?', 지도 보너스 선택 가능':''}${b?`, ${arkBuildingLabel(b)}`:''}`;
        return <g key={id}><polygon points={arkHexPoints(cell)} role="button" data-cell-index={i} tabIndex={focused===i?0:-1} aria-label={label} aria-disabled={disabled} aria-pressed={isSelected}
          className={`ark-hex ${bonusEligible?'is-eligible-bonus':''} terrain-${cell.terrain.toLowerCase()} ${isSelected?'is-anchor':''} ${b&&eligibleHousingIds.includes(b.id)?'is-eligible-housing':''} ${b?`is-built ${b.occupied||b.used>0?'is-occupied':''} ${b.kind==='KIOSK'?'is-kiosk':b.kind==='PAVILION'?'is-pavilion':''}`:''}`}
          onFocus={()=>setFocused(i)} onKeyDown={e=>key(e,i)} onClick={()=>{if(!disabled)onSelect(arkBoardCellInput(cell));}}/>
          {!b&&cell.bonus&&<BoardBonus x={p.x} y={p.y} label={bonuses[cell.bonus]??'+'}/>}
          {!b&&cell.restricted&&<BoardBonus x={p.x} y={p.y} label="II" restricted/>}
          {b&&(b.kind==='KIOSK'||b.kind==='PAVILION'||b.occupied)&&<text className="ark-hex-label" x={p.x} y={p.y+5} pointerEvents="none">{b.kind==='KIOSK'?'⌂':b.kind==='PAVILION'?'✦':'●'}</text>}
        </g>;
      })}
      {buildings.map((b,index)=>{
        const p=arkScreenPoint(b.cells[0]!),outline=arkBuildingOutline(b.cells),clip=`${tileId}-tile-${index}`;
        const inhabited=b.occupied||b.used>0;
        return <g key={b.id} pointerEvents="none" aria-label={arkBuildingLabel(b)} className="ark-facility-tile">
          <defs><clipPath id={clip}><path d={outline}/></clipPath></defs>
          <path d={outline} fill={arkUniqueBuildingCardKey(b)?'#b3d2d2':inhabited?'#719157':'#e2cb8f'}/>
          <g clipPath={`url(#${clip})`}>
            <path d={`M${p.x-70},${p.y+40} Q${p.x},${p.y-35} ${p.x+90},${p.y+60}`} fill="none" stroke={inhabited?'#99ad71':'#f2dfad'} strokeWidth="22"/>
            {b.cells.slice(1).map(c=>{const a=arkScreenPoint(c);return <g key={arkCellKey(c)} transform={`translate(${a.x} ${a.y})`}>
              <ellipse cy="9" rx="19" ry="8" fill="#655a3b" opacity=".2"/>
              <path d="M-18,6 -15,-7 -4,-13 9,-9 17,3 10,10 -7,11Z" fill="#9a9582"/>
              <path d="M-15,-7 -4,-13 9,-9 4,-1 -6,1Z" fill="#d2cdb4"/>
              <path d="M-18,6 -6,1 4,-1 10,10 -7,11Z" fill="#b3ad98"/>
              <path d="M-20,13 Q0,22 21,8" fill="none" stroke="#775338" strokeWidth="2"/>
              <path d="M-19,9v9 M1,14v9 M20,4v10" stroke="#4e3b2c" strokeWidth="2.5"/>
            </g>;})}
          </g>
        </g>;
      })}
      {buildings.map(b=>{const p=arkScreenPoint(b.cells[0]!),outline=arkBuildingOutline(b.cells);return <g key={b.id} pointerEvents="none">
        <path d={outline} className="ark-facility-separator"/>
        <path d={outline} className={`ark-facility-outline ${eligibleHousingIds.includes(b.id)?'is-eligible':''} ${selectedBuilding?.id===b.id?'is-selected':''}`}/>
        <rect x={p.x-24} y={p.y-14} width="48" height="28" rx="7" fill={b.occupied||b.used>0?'#285b42':'#fff4d5'} stroke="#634b2a"/>
        <text x={p.x} y={p.y-3} textAnchor="middle" {...(arkBuildingName(b).length>6?{textLength:44,lengthAdjust:"spacingAndGlyphs" as const}:{})} style={{fontSize:8,fontWeight:800,fill:b.occupied||b.used>0?'#fff':'#493a24'}}>{arkBuildingName(b)}</text>
        <text x={p.x} y={p.y+8} textAnchor="middle" style={{fontSize:7,fill:b.occupied||b.used>0?'#fff':'#493a24'}}>{b.cells.length}칸 · {b.occupied||b.used>0?'입주':b.kind.startsWith('ENCLOSURE_')?'빈 우리':'시설'}</text>
      </g>;})}
      {feedback&&buildings.filter(b=>feedback.built.includes(b.id)||feedback.arrivals.includes(b.id)).flatMap(b=>b.cells.map(c=><polygon key={`${feedback.revision}-${arkCellKey(c)}`} points={arkHexPoints(c,27)} className={`ark-board-celebration ${feedback.arrivals.includes(b.id)?'is-arrival':'is-construction'}`} pointerEvents="none"/>))}
      {ghost.map(c=><polygon key={arkCellKey(c)} points={arkHexPoints(c,27)} className={`ark-ghost ${invalid?'is-invalid':''}`} pointerEvents="none"/>)}
      {selected&&!selectedBuilding&&<circle cx={arkScreenPoint(selected).x} cy={arkScreenPoint(selected).y} r="5" fill="#fffef4" stroke="#23483a" strokeWidth="2" pointerEvents="none"/>}
    </svg></div><div className="ark-map-touch-tools" aria-label="지도 조작"><button type="button" aria-pressed={zoomed} onClick={()=>setZoomed(value=>!value)}>{zoomed?'지도 전체 보기':'지도 확대'}</button>{ghost.length>0&&onRotate&&<button type="button" disabled={disabled} onClick={onRotate}>배치 회전 ↻</button>}{ghost.length>0&&onReflect&&<button type="button" disabled={disabled} onClick={onReflect}>배치 반전 ↔</button>}{onCancel&&<button type="button" disabled={disabled||selected===null} onClick={onCancel}>선택 해제</button>}</div>{zoomed&&<p className="ark-map-help">확대된 지도는 가로·세로로 스크롤할 수 있습니다.</p>}<p className="ark-map-selection" role="status">{selected?`선택: ${selected.q+1}열 ${selected.r+Math.ceil(selected.q/2)+1}칸 · ${selectedBuilding?arkBuildingLabel(selectedBuilding):selectedMapCell?.bonus?`이 칸을 덮으면 ${arkMapBonusLabels[selectedMapCell.bonus]??selectedMapCell.bonus}`:selectedMapCell?.terrain==='WATER'?'물':selectedMapCell?.terrain==='ROCK'?'바위':'빈 땅'}`:'지도에서 칸을 선택하면 시설과 보상을 확인할 수 있습니다.'}</p><p className="ark-map-help">칸 선택 · <kbd>R</kbd> 회전 · <kbd>F</kbd> 반전 · <kbd>Esc</kbd> 선택 해제</p>
    {selectedBuilding&&uniqueCardKey&&<section className="ark-map-building-detail" aria-label="선택한 고유 건물 정보"><h3>{arkBuildingName(selectedBuilding)} · {selectedBuilding.cells.length}칸</h3><p>후원자 고유 건물 · 카드 {uniqueCardKey}</p><ul>{(arkSponsorCopy[uniqueCardKey]??[]).map(text=><li key={text}>{text}</li>)}</ul><small>이미 건설된 시설입니다. 즉시 효과는 건설할 때 한 번 처리되며, 여기를 눌러 다시 받지 않습니다.</small></section>}
    <div className="ark-facility-list" aria-label="건설된 시설">{buildings.map(b=><button type="button" key={b.id} disabled={disabled} aria-pressed={selectedBuilding?.id===b.id} onClick={()=>onSelect(arkBoardCellInput(b.cells[0]!))}>{arkBuildingLabel(b)}</button>)}</div>
  </div>;
}
