import {arkBonusPresentation} from './ArkNovaBonusTile.js';
import {useId} from 'react';
import type {ArkSoloView} from '@hangul-rummikub/shared';

const rows=[{high:113,low:85,x:98,y:42},{high:84,low:55,x:48,y:250},
  {high:54,low:25,x:48,y:392},{high:24,low:0,x:48,y:534}];
const width=43;
function point(appeal:number){const row=rows.find(r=>appeal>=r.low&&appeal<=r.high);return row?{x:row.x+(row.high-appeal)*width,y:row.y}:{x:44,y:42};}
const target=(conservation:number)=>conservation<=10?114-2*conservation:124-3*conservation;
const shield=(x:number,y:number,w:number,h:number)=>`M${x} ${y}h${w}v${h-10}q${-w/2} 20 ${-w} 0Z`;

/** Fold the printed track into four rows; both markers share the appeal coordinate.
 * Row splits retain partial conservation/income spaces instead of changing their sizes.
 */
export function ArkNovaScoreTrack({appeal,conservation,board}:{appeal:number;conservation:number;board:NonNullable<ArkSoloView['scoreBoard']>}){
  const id=useId().replaceAll(':','');
  const ap=point(appeal),cp=point(board.targetAppeal);
  return <svg viewBox="0 0 1400 690" role="img" aria-label={`매력 ${appeal}, 보전 ${conservation}, ${board.gap<0?`교차까지 ${-board.gap}점`:`교차 거리 ${board.gap}점`}`}>
    <defs>
      <linearGradient id={`${id}-wood`} x2="0" y2="1"><stop stopColor="#705039"/><stop offset=".48" stopColor="#8b6545"/><stop offset="1" stopColor="#533a2b"/></linearGradient>
      <linearGradient id={`${id}-paper`} x2=".15" y2="1"><stop stopColor="#fff1cd"/><stop offset="1" stopColor="#c9a675"/></linearGradient>
      <linearGradient id={`${id}-green`} x2="1" y2="1"><stop stopColor="#4d805a"/><stop offset="1" stopColor="#24543d"/></linearGradient>
    </defs>
    <rect x="5" y="5" width="1390" height="680" rx="13" fill={`url(#${id}-wood)`} stroke="#382a20" strokeWidth="4"/>
    {Array.from({length:55},(_,i)=><path key={i} d={`M14 ${16+i*12}Q380 ${i*12+3} 740 ${i*12+20}T1388 ${i*12+16}`} stroke={i%2?'#e9cba2':'#211e15'} strokeOpacity=".065" fill="none"/>)}
    <path d={shield(25,44,46,100)} fill={`url(#${id}-green)`} stroke="#d6ddba"/>
    <text x="48" y="139" textAnchor="middle" className="ark-track-white">0</text>
    {Array.from({length:41},(_,i)=>i+1).flatMap(c=>rows.flatMap((row,rowIndex)=>{
      const low=Math.max(row.low,target(c)),high=Math.min(row.high,target(c-1)-1);
      if(low>high)return [];
      const start=point(high).x-19,w=(high-low+1)*width-5;
      return <g key={`${c}-${rowIndex}`}><path d={shield(start,row.y+20,w,79)} fill={`url(#${id}-green)`} stroke="#c8d9b7" strokeWidth="1.5"/>
        <text x={start+w/2} y={row.y+96} textAnchor="middle" className="ark-track-white">{c}</text>
      </g>;
    }))}
    {rows.flatMap((row,rowIndex)=>Array.from({length:row.high-row.low+1},(_,i)=>{
      const n=row.high-i,p=point(n),income=board.appealIncome[n];
      const first=i===0||income!==board.appealIncome[n+1];
      return <g key={n}>
        <rect x={p.x-20} y={p.y-13} width="42" height="23" fill="#344a50" stroke="#b8c6bc"/>
        {first&&<g><rect x={p.x-12} y={p.y-27} width="24" height="22" rx="5" fill="#344a50" stroke="#c8d1c4"/><text x={p.x} y={p.y-11} textAnchor="middle" className="ark-track-white">{income}</text></g>}
        <path d={`M${p.x-18} ${p.y+4}h12q6 10 12 0h12v61l-6 -4l-6 4l-6 -4l-6 4l-6 -4l-6 4Z`} fill={`url(#${id}-paper)`} stroke="#ad895a" strokeWidth="2"/>
        <path d={`M${p.x-14} ${p.y+38}h28 M${p.x-14} ${p.y+51}h28`} stroke="#9e7d52" strokeDasharray="2 2"/>
        <text x={p.x} y={p.y+31} textAnchor="middle" className="ark-track-ticket">{n}</text>
        {n===row.low&&rowIndex<3&&<text x={p.x+27} y={p.y+79} className="ark-track-white">↵</text>}
      </g>;
    }))}
    {[{c:2,label:'행동 II / 직원 +1'},{c:5,label:'타일 / 돈 5'},{c:8,label:'타일 / 돈 5'},{c:10,label:'목표 1장 정리'}].map(({c,label})=>{
      const p=point(target(c));return <g key={c}><path d={`M${p.x} 145v16`} stroke="#fff0b0" strokeWidth="2"/>
        <path d={shield(p.x-17,124,34,34)} fill="#edf5d8" stroke="#29553b" strokeWidth="2"/><text x={p.x} y="146" textAnchor="middle" className="ark-track-ticket">{c}</text>
        {c===5||c===8?<g><text x={p.x} y="169" textAnchor="middle" className="ark-track-white">타일 하나 또는 돈 5 · 택1</text>{Array.from({length:2},(_,index)=>{
          const tile=board.bonuses.filter(b=>b.track===c)[index]?.tile;
          const bonus=tile?arkBonusPresentation(tile):null,x=p.x+(index===0?-58:58);
          return <g key={index}><title>{bonus?`${bonus.label}: ${bonus.description}`:'남은 타일 없음'}</title><path d={`M${x} 174l29 19l-11 31h-36l-11 -31Z`} fill={bonus?'#f7dd67':'#796449'} stroke="#b89e45" strokeWidth="2"/><text x={x} y="201" textAnchor="middle" style={{fill:'#342b22',fontSize:18,fontWeight:800}}>{bonus?.symbol??'—'}</text><text x={x} y="219" textAnchor="middle" style={{fill:'#342b22',fontSize:9}}>{bonus?.label??'없음'}</text></g>;
        })}<rect x={p.x-18} y="189" width="36" height="29" rx="8" fill="#40565c" stroke="#fff1cd"/><text x={p.x} y="209" textAnchor="middle" className="ark-track-white">돈 5</text></g>:<><rect x={p.x-78} y="169" width="156" height="35" rx="9" fill="#f7e8a7" stroke="#b89e45"/>
        <text x={p.x} y="191" textAnchor="middle" className="ark-track-reward">{label}</text></>}
      </g>;
    })}
    <g className="ark-score-marker" style={{transform:`translate(${ap.x}px,${ap.y+24}px)`}}><circle r="19" fill="#e58232" stroke="#fff5c8" strokeWidth="3"/><text y="5" textAnchor="middle" className="ark-score-marker-number">{appeal}</text><title>{`매력 ${appeal}`}</title></g>
    <g className="ark-score-marker" style={{transform:`translate(${cp.x}px,${cp.y+78}px)`}}><path d={shield(-19,-19,38,38)} fill="#a7dc8f" stroke="#fff5c8" strokeWidth="3"/><text y="5" textAnchor="middle" className="ark-track-ticket">{conservation}</text><title>{`보전 ${conservation}`}</title></g>
    <text x="1180" y="550" className="ark-track-white">← 매력 · 보전 →</text>
    <text x="1180" y="575" className="ark-track-white">티켓: 매력 점수</text>
    <text x="1180" y="600" className="ark-track-white">방패: 보전 점수</text>
    <text x="1180" y="625" className="ark-track-white">상단 숫자: 휴식 수입</text>
  </svg>;
}
