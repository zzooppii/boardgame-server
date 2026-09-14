import {useRef,useState} from 'react';
import {PANDEMIC_CITIES,PANDEMIC_CITY_INFO,PANDEMIC_COLORS,PANDEMIC_EDGES,PANDEMIC_ROLE_INFO,pandemicNeighbors,type PandemicCity,type PandemicProjection} from '@hangul-rummikub/shared';
import {DISEASE_COLORS,DISEASE_NAMES} from './presentation.js';
export function PandemicBoard({game,selected,onSelect}:{game:PandemicProjection;selected:PandemicCity;onSelect(city:PandemicCity):void}){
 const [zoom,setZoom]=useState(1),viewport=useRef<HTMLDivElement>(null),neighbors=pandemicNeighbors(selected);
 return <div className="pd-board-shell"><div className="pd-map-tools"><span>세계 감염 현황 <small>도시를 선택하세요</small></span><div><button aria-label="지도 축소" onClick={()=>setZoom(z=>Math.max(1,z-.25))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="지도 확대" onClick={()=>setZoom(z=>Math.min(2,z+.25))}>+</button></div></div>
 <div className="pd-map-scroll" ref={viewport}><div className="pd-map-size" style={{width:`${zoom*100}%`}}><svg viewBox="0 0 1240 760" role="group" aria-label="48개 도시 세계 지도. 도시 이름을 눌러 행동을 선택하세요.">
 <defs><filter id="pd-glow"><feGaussianBlur stdDeviation="4"/></filter><linearGradient id="pd-ocean" x2="0" y2="1"><stop stopColor="#061d38"/><stop offset="1" stopColor="#03101f"/></linearGradient></defs>
 <rect width="1240" height="760" fill="url(#pd-ocean)"/><image href="/images/pandemic/world.webp" width="1240" height="760" preserveAspectRatio="none" opacity=".84" pointerEvents="none"/>
 <rect width="1240" height="760" fill="#011226" opacity=".16"/>
 <g aria-hidden="true">{PANDEMIC_EDGES.map(([a,b])=>{const ca=PANDEMIC_CITY_INFO[a],cb=PANDEMIC_CITY_INFO[b],lit=a===selected||b===selected,wrap=Math.abs(ca.x-cb.x)>800,edgeOffset=a==='SAN_FRANCISCO'&&b==='MANILA'?38:0;return <g key={a+b} className={lit?'pd-route selected':'pd-route'}>{wrap?<><path d={`M ${ca.x} ${ca.y} L ${ca.x<cb.x?0:1240} ${ca.y-20-edgeOffset}`}/><path d={`M ${cb.x} ${cb.y} L ${ca.x<cb.x?1240:0} ${cb.y-20}`}/><text x={ca.x<cb.x?8:1232} y={ca.y-35-edgeOffset} textAnchor={ca.x<cb.x?'start':'end'}>{cb.name} ↔</text><text x={ca.x<cb.x?1232:8} y={cb.y-35} textAnchor={ca.x<cb.x?'end':'start'}>{ca.name} ↔</text></>:<line x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}/>}</g>;})}</g>
 {PANDEMIC_CITIES.map(id=>{const city=PANDEMIC_CITY_INFO[id],state=game.board.find(b=>b.city===id)!,players=game.playerStates.filter(p=>p.city===id),station=game.stations.includes(id),latest=game.history.filter(h=>h.city===id).at(-1),ping=game.pings.find(p=>p.city===id),count=PANDEMIC_COLORS.reduce((n,c)=>n+state.cubes[c],0);return <g key={id} transform={`translate(${city.x} ${city.y})`} role="button" tabIndex={0} aria-label={`${city.name}, ${PANDEMIC_COLORS.filter(c=>state.cubes[c]).map(c=>`${DISEASE_NAMES[c]} ${state.cubes[c]}`).join(', ')||'질병 없음'}${station?', 연구소':''}${players.length?`, 플레이어 ${players.length}명`:''}`} aria-pressed={selected===id} className={`pd-city ${selected===id?'selected':''} ${neighbors.includes(id)?'neighbor':''}`} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}>
 <circle r="24" fill="transparent"/>
 {selected===id&&<circle r="23" fill="none" stroke="#f5fffa" strokeWidth="2"/>}
 <circle r="13" fill={DISEASE_COLORS[city.color]} opacity=".65" filter="url(#pd-glow)"/><circle r="10" fill="#08182b" stroke={DISEASE_COLORS[city.color]} strokeWidth="3"/>
 {station?<text className="pd-station" y="5" textAnchor="middle">✚</text>:<circle r="3" fill={DISEASE_COLORS[city.color]}/>}
 <text className="pd-city-name" y="35" textAnchor="middle">{city.name}</text>
 {count>0&&<g transform="translate(-18 -25)">{PANDEMIC_COLORS.filter(c=>state.cubes[c]).map((c,i)=><g key={c} transform={`translate(${i*22} 0)`}><rect x="-6" y="-9" width="20" height="18" rx="3" fill={DISEASE_COLORS[c]} stroke="#eef9ff" strokeWidth=".5"/><text x="4" y="5" textAnchor="middle" className="pd-cube-count">{state.cubes[c]}</text></g>)}</g>}
 {players.map((p,i)=><g key={p.playerId} transform={`translate(${(i-(players.length-1)/2)*24} -48)`}><circle r="11" fill={PANDEMIC_ROLE_INFO[p.role].color} stroke="#06152a" strokeWidth="2"/><text y="5" textAnchor="middle" className="pd-pawn-letter">{game.playerStates.indexOf(p)+1}</text></g>)}
 {ping&&<text x="22" y="-36" className="pd-ping">{ping.message==='MEET'?'◎':ping.message==='TREAT'?'✚':'!'}</text>}
 {latest&&game.history.at(-1)?.id===latest.id&&<circle key={latest.id} className={`pd-map-pulse ${latest.sound==='OUTBREAK'?'danger':''}`} r="16" fill="none" strokeWidth="3"/>}
 </g>;})}
 <text x="28" y="724" className="pd-map-caption">PANDEMIC / GLOBAL RESPONSE NETWORK</text>
 </svg></div></div><div className="pd-map-legend"><span>✚ 연구소</span><span>숫자 배지 = 질병 큐브</span><span>원형 번호 = 팀원</span><span>모바일: 지도를 옆으로 밀어 탐색</span></div></div>;
}
