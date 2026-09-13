import {useEffect,useState} from 'react';
import {terrorBoard,TERROR_ROOMS,type TerrorRoom,type TerrorHuntTrap,type TerrorscapeAction,type TerrorscapeProjection} from '@hangul-rummikub/shared';
const TYPES:readonly TerrorHuntTrap[]=['NET_A','NET_B','SKULL','BEAR'];
export const HUNT_TRAP_NAME:Readonly<Record<TerrorHuntTrap,string>>={NET_A:'그물 1',NET_B:'그물 2',SKULL:'해골',BEAR:'곰덫'};
export function TrapPlacement({game:g,disabled,act}:{game:TerrorscapeProjection;disabled:boolean;act(a:TerrorscapeAction):void}){
 const board=terrorBoard(g.map),allowed=g.phase==='SETUP'?TERROR_ROOMS.filter(r=>board.rooms[r].search||r===board.radio):TERROR_ROOMS;
 const initial=()=>TYPES.map((trap,i)=>({trap,room:g.privateState.role==='KILLER'?g.privateState.killer.traps.find(t=>t.trap===trap)?.room??allowed[i]!:allowed[i]!}));
 const [placements,setPlacements]=useState(initial);
 useEffect(()=>setPlacements(initial()),[g.map,g.phase,g.killerPlayerId]);
 if(g.privateState.role!=='KILLER')return null;
 return <fieldset className="tsc-trap-placement"><legend>{g.phase==='SETUP'?'사냥꾼 함정 준비':'함정 재설치'}</legend><p>종류 배치는 나에게만 보입니다. 서로 다른 장소에 하나씩 놓으세요.</p>{placements.map((p,i)=><label key={p.trap}>{HUNT_TRAP_NAME[p.trap]}<select value={p.room} disabled={disabled} onChange={e=>{const room:TerrorRoom|undefined=allowed.find(r=>r===e.target.value);if(room)setPlacements(placements.map((p,j)=>i===j?{...p,room}:p));}}>{allowed.map(r=><option key={r} value={r}>{r} {board.rooms[r].name}</option>)}</select></label>)}<button disabled={disabled||new Set(placements.map(p=>p.room)).size!==4} onClick={()=>act({type:'SET_TRAPS',placements})}>{g.phase==='SETUP'?'함정 준비 저장':'재설치 확정'}</button>{g.phase==='SETUP'&&g.trapsPrepared&&<small>함정 준비 완료</small>}</fieldset>;
}
