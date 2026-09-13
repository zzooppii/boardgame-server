import {useId,useState} from 'react';
import {TERROR_ROOMS,TERROR_ROOM_INFO,TERROR_DOORS,terrorEdge,type TerrorRoom,type TerrorscapeProjection} from '@hangul-rummikub/shared';
import {MANOR_ROOMS,MANOR_DOORS,MANOR_OUTDOOR,type Point} from './manor-layout.js';
import {Portrait} from './art.js';

type Props={game:TerrorscapeProjection;start:TerrorRoom;path:readonly TerrorRoom[];destination:TerrorRoom|null;activeRooms:readonly TerrorRoom[];notes:readonly TerrorRoom[];edge:string;disabled:boolean;onRoom(room:TerrorRoom):void;onDoor(edge:string):void};
export function ManorMap({game:g,start,path,destination,activeRooms,notes,edge,disabled,onRoom,onDoor}:Props){
 const id=useId().replaceAll(':',''),[zoom,setZoom]=useState(false),team=g.privateState.role==='SURVIVOR'?g.privateState.team:null;
 const route:Point[]=[];let previous=start;
 for(const room of path){if(!route.length)route.push(MANOR_ROOMS[previous].furniture);const gate=MANOR_DOORS[terrorEdge(previous,room)]?.at??MANOR_OUTDOOR[terrorEdge(previous,room)];if(gate)route.push(gate);route.push(MANOR_ROOMS[room].furniture);previous=room;}
 return <><div className="tsc-floor-tools"><span>방을 눌러 이동 · 문을 눌러 봉쇄 대상 선택</span><button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>{zoom?'지도 전체 보기':'지도 확대'}</button></div><div className="tsc-map-scroll"><svg viewBox="-35 -35 1290 910" className={'tsc-floorplan'+(zoom?' tsc-floor-zoom':'')} aria-label="저택 평면도">
 <defs>
 {TERROR_ROOMS.map(r=><clipPath key={r} id={`${id}-${r}`}><polygon points={MANOR_ROOMS[r].polygon}/></clipPath>)}
 </defs>
 <rect x="-35" y="-35" width="1290" height="910" rx="24" fill="#1d2b27"/>
 <image className="tsc-floor-art" href="/images/terrorscape/manor-floorplan.webp" x="-35" y="-35" width="1290" height="910" preserveAspectRatio="none" aria-hidden="true" pointerEvents="none"/>
 {TERROR_ROOMS.map(r=>{const info=TERROR_ROOM_INFO[r],layout=MANOR_ROOMS[r],at=team?.survivors.filter(p=>p.location===r&&p.outcome!=='ESCAPED')??[],tokens=[...(g.killerLocation===r?[g.killerType]:[]),...at.map(p=>p.character)];return <g key={r} className={'tsc-floor-room '+(r[0]==='R'?'tsc-zone-red':r[0]==='B'?'tsc-zone-blue':'tsc-zone-green')+(destination===r?' tsc-floor-picked':'')+(activeRooms.includes(r)?' tsc-floor-reachable':'')} role="button" tabIndex={0} aria-label={`${info.name}${g.noises.includes(r)?' · 소음':''}${g.killerLocation===r?' · 살인마':''}`} aria-pressed={destination===r} onClick={()=>onRoom(r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onRoom(r);}}}>
 <title>{r} {info.name} · {info.hint||'일반 장소'}</title>
 <polygon className="tsc-floor-base" points={layout.polygon} fill="transparent" stroke="#182322" strokeWidth="5" strokeLinejoin="round"/>
 <g clipPath={`url(#${id}-${r})`}><polygon className="tsc-zone-border" points={layout.polygon} fill="none" strokeWidth="20"/><polygon className="tsc-floor-highlight" points={layout.polygon}/></g>
 <g transform={`translate(${layout.label[0]} ${layout.label[1]})`} className="tsc-floor-label"><rect x="-87" y="-20" width="174" height="35" rx="4"/><text textAnchor="middle" y="4"><tspan className="tsc-floor-code">{r} </tspan>{info.name}</text></g>
 {info.search&&<g className="tsc-passage-badge" aria-hidden="true" transform={`translate(${layout.label[0]+72} ${layout.label[1]-43})`}><circle r="19"/><circle cx="-3" cy="-5" r="6" fill="none" stroke="#f2e9c9" strokeWidth="3"/><path d="M-3 1V12H5M-3 7H3" fill="none" stroke="#f2e9c9" strokeWidth="3"/></g>}
 {['B1','R5','G2','G3'].includes(r)&&<g className="tsc-floor-feature" transform={`translate(${layout.label[0]-63} ${layout.label[1]-41})`}><rect x="-22" y="-15" width="44" height="28" rx="5"/><text textAnchor="middle" y="5">{r==='B1'?'수리':r==='R5'?'책':r==='G2'?'주술':'공구'}</text></g>}
 {(r==='B1'||r==='B5'||r==='G2'||r==='G5')&&<g className="tsc-passage-badge" transform={`translate(${layout.label[0]+72} ${layout.label[1]-43})`}><circle r="19"/><text textAnchor="middle" y="6">{r==='B1'||r==='G2'?'Ⅰ':'Ⅱ'}</text></g>}
 {tokens.map((c,i)=><foreignObject key={c} x={layout.furniture[0]-tokens.length*22+i*44} y={layout.furniture[1]-25} width="44" height="52" className="tsc-floor-token"><Portrait character={c}/></foreignObject>)}
 {g.noises.includes(r)&&<g className="tsc-floor-noise" transform={`translate(${layout.label[0]-68} ${layout.label[1]-42})`}><circle r="18"/><text textAnchor="middle" y="7">◉</text></g>}
 {notes.includes(r)&&g.privateState.role==='KILLER'&&<text x={layout.furniture[0]} y={layout.furniture[1]+57} className="tsc-floor-note">?</text>}
 {team?.trap===r&&<text x={layout.label[0]} y={layout.label[1]-30} className="tsc-floor-note">덫</text>}
 </g>;})}
 <g className="tsc-outdoor-boundaries"><path d="M540 740Q527 777 540 833M850 740Q837 777 850 833M1013 487Q1054 582 1214 585"/></g>
 {route.length>1&&<polyline className="tsc-floor-route" points={route.map(p=>p.join(',')).join(' ')}/>}
 {TERROR_DOORS.map(([a,b])=>{const key=terrorEdge(a,b),door=MANOR_DOORS[key]!,blocked=g.blocks.includes(key);return <g key={key} className={'tsc-floor-door'+(blocked?' is-blocked':'')+(edge===key?' is-selected':'')} transform={`translate(${door.at[0]} ${door.at[1]}) rotate(${door.angle})`} role="button" tabIndex={disabled?-1:0} aria-disabled={disabled} aria-pressed={edge===key} aria-label={`${TERROR_ROOM_INFO[a].name} ↔ ${TERROR_ROOM_INFO[b].name} 문${blocked?' · 봉쇄':''}`} onClick={()=>{if(!disabled)onDoor(key);}} onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onDoor(key);}}}><rect className="tsc-door-hit" x="-43" y="-22" width="86" height="44"/><rect x="-36" y="-9" width="72" height="18" rx="2" className="tsc-door-plank"/>{blocked?<path d="M-25 -6L25 6M-25 6L25 -6"/>:<path d="M-27 0H27"/>}</g>;})}
 <g className="tsc-floor-exit"><path d="M0 338v67M1220 338v67"/><text transform="translate(-14 375) rotate(-90)" textAnchor="middle">정문 출구</text><text transform="translate(1239 375) rotate(90)" textAnchor="middle">숨겨진 출구</text></g>
 </svg></div>{edge&&<p className="tsc-door-selection" role="status">선택한 문: {edge.split('-').map(r=>TERROR_ROOMS.find(room=>room===r)).map(r=>r?TERROR_ROOM_INFO[r].name:'').join(' ↔ ')} · 카드 또는 행동에서 확정하세요.</p>}
 <div className="tsc-map-legend"><span>흰색 문 · 봉쇄 가능</span><span>붉은 × · 봉쇄됨</span><span>야외 점선 · 봉쇄 불가</span><span>Ⅰ 거실↔무덤 · Ⅱ 연회장↔정원</span><span>열쇠 표시 · 수색 / ◉ 소음</span></div></>;
}
