import {TERROR_ROOMS,terrorBoard,TERROR_CHARACTER_INFO,terrorEdge,type TerrorRoom,type TerrorscapeProjection} from '@hangul-rummikub/shared';
export type TerrorCue=TerrorscapeProjection['history'][number]['sound']|'SENSE'|'REVEAL'|'SELECT'|'HOWL'|'TRAP';
export type TerrorFeedback={id:string;kind:'MOVE'|'NOISE'|'TRAP'|'BLOCK'|'SENSE'|'ATTACK'|'HURT'|'FEAR'|'DEFENSE'|'REVEAL'|'TURN'|'WIN'|'CARD';rooms:readonly TerrorRoom[];edge?:string;text:string;sound:TerrorCue};
/** Only compare viewer projections. Never infer a survivor's position from sensing or logs. */
export function terrorFeedback(before:TerrorscapeProjection|null,after:TerrorscapeProjection):TerrorFeedback[]{
 if(!before||before.gameId!==after.gameId||before.privateState.playerId!==after.privateState.playerId||before.privateState.role!==after.privateState.role||after.gameRevision<=before.gameRevision||before.phase==='SETUP'||before.phase==='TRAIT_DRAFT')return [];
 const TERROR_ROOM_INFO=terrorBoard(after.map).rooms;const events:TerrorFeedback[]=[];
 const add=(event:Omit<TerrorFeedback,'id'>)=>events.push({...event,id:`${after.gameId}:${after.gameRevision}:${events.length}`});
 const team=after.privateState.role==='SURVIVOR'?after.privateState.team:null;
 if(before.killerLocation!==after.killerLocation&&after.killerLocation)add({kind:before.killerLocation===null?'REVEAL':'MOVE',rooms:[after.killerLocation],text:`살인자 ${before.killerLocation===null?'재등장':'이동'} · ${TERROR_ROOM_INFO[after.killerLocation].name}`,sound:before.killerLocation===null?'REVEAL':'STEP'});
 if(team&&before.privateState.role==='SURVIVOR')for(const p of team.survivors){const old=before.privateState.team.survivors.find(c=>c.character===p.character);if(old&&old.location!==p.location)add({kind:'MOVE',rooms:[p.location],text:`${TERROR_CHARACTER_INFO[p.character].name} 이동 · ${TERROR_ROOM_INFO[p.location].name}`,sound:'STEP'});}
 for(const room of after.noises.filter(r=>!before.noises.includes(r)))add({kind:'NOISE',rooms:[room],text:`${TERROR_ROOM_INFO[room].name} · 소음 발생`,sound:'NOISE'});
 for(const edge of new Set([...before.blocks,...after.blocks]))if(before.blocks.includes(edge)!==after.blocks.includes(edge)){const rooms=TERROR_ROOMS.filter(r=>edge.split('-').includes(r));if(rooms.length===2&&terrorEdge(rooms[0]!,rooms[1]!)===edge)add({kind:'BLOCK',rooms,edge,text:`${rooms.map(r=>TERROR_ROOM_INFO[r].name).join(' ↔ ')} · ${after.blocks.includes(edge)?'문 봉쇄':'봉쇄 제거'}`,sound:'BLOCK'});}
 if(JSON.stringify(before.sensed)!==JSON.stringify(after.sensed))for(const sensed of after.sensed){const rooms=sensed.kind==='ZONE'?TERROR_ROOMS.filter(r=>r.startsWith(sensed.zone)):sensed.kind==='PAIR'?sensed.rooms:[sensed.location];add({kind:'SENSE',rooms,text:`${TERROR_CHARACTER_INFO[sensed.character].name} 감지 · ${sensed.kind==='ZONE'?'구역만 확인':sensed.kind==='PAIR'?'표시한 장소 중 한 곳':TERROR_ROOM_INFO[sensed.location].name}`,sound:'SENSE'});}
 if(after.encounter&&(!before.encounter||after.encounter.location!==before.encounter.location))add({kind:'ATTACK',rooms:[after.encounter.location],text:`${TERROR_ROOM_INFO[after.encounter.location].name} · 조우! 방어를 준비하세요`,sound:'REVEAL'});
 if(after.trapReveal&&JSON.stringify(after.trapReveal)!==JSON.stringify(before.trapReveal))add({kind:'TRAP',rooms:[after.trapReveal.room],text:`${TERROR_ROOM_INFO[after.trapReveal.room].name} · 함정 발동`,sound:'TRAP'});
 const newLogs=after.history.filter(e=>e.id>(before.history.at(-1)?.id??0));
 if(newLogs.some(e=>e.text==='살인마 · 울부짖음'))add({kind:'CARD',rooms:[],text:'늑대인간이 울부짖습니다.',sound:'HOWL'});
 const defense=[...newLogs].reverse().find(e=>e.sound==='DEFENSE');if(defense)add({kind:'DEFENSE',rooms:after.encounter?[after.encounter.location]:[],text:defense.text,sound:'DEFENSE'});
 for(const condition of after.conditions){const old=before.conditions.find(c=>c.character===condition.character);if(!old)continue;const location=team?.survivors.find(c=>c.character===condition.character)?.location;
 const rooms=location?[location]:[];
 if(condition.injuries>old.injuries)add({kind:'HURT',rooms,text:`${TERROR_CHARACTER_INFO[condition.character].name} · 부상`,sound:'HURT'});
 else if(condition.fear>old.fear)add({kind:'FEAR',rooms,text:`${TERROR_CHARACTER_INFO[condition.character].name} · 공포 증가`,sound:'FEAR'});
 }
 if(after.phase==='FINISHED'&&before.phase!=='FINISHED')add({kind:'WIN',rooms:[],text:after.history.at(-1)?.text??'게임 종료',sound:'WIN'});
 else if(before.round!==after.round||before.phase==='SURVIVORS'&&after.phase!=='SURVIVORS'&&newLogs.some(e=>e.sound==='TURN'))add({kind:'TURN',rooms:[],text:[...newLogs].reverse().find(e=>e.sound==='TURN')?.text??'차례 변경',sound:'TURN'});
 if(!events.length){const last=[...newLogs].reverse().find(e=>e.sound!=='NONE');if(last)add({kind:'CARD',rooms:[],text:last.text,sound:last.text==='살인마 · 울부짖음'?'HOWL':last.sound});}
 return events;
}
