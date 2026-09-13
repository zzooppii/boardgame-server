import {useEffect,useRef,useState} from 'react';
import type {TerrorscapeProjection} from '@hangul-rummikub/shared';
import {terrorFeedback,type TerrorFeedback,type TerrorCue} from './feedback.js';
export function useTerrorFeedback(game:TerrorscapeProjection|null,connected:boolean,play:(cue:TerrorCue)=>void){
 const previous=useRef<TerrorscapeProjection|null>(null),offline=useRef<TerrorscapeProjection|null>(null),latest=useRef(game),sound=useRef(play),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const [events,setEvents]=useState<TerrorFeedback[]>([]);sound.current=play;latest.current=game;
 const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[];};
 useEffect(()=>{const reset=()=>{clear();previous.current=document.hidden?null:latest.current;setEvents([]);};document.addEventListener('visibilitychange',reset);return()=>{document.removeEventListener('visibilitychange',reset);clear();};},[]);
 useEffect(()=>{
 if(!connected||document.hidden||!game){clear();previous.current=null;offline.current=game;setEvents([]);return;}
 if(game===offline.current)return;offline.current=null;
 const before=previous.current;const fresh=terrorFeedback(before,game);previous.current=game;if(!fresh.length){if(!before||before.gameId!==game.gameId||before.privateState.role!==game.privateState.role||before.privateState.playerId!==game.privateState.playerId||game.gameRevision<before.gameRevision){clear();setEvents([]);}return;}
 clear();setEvents(fresh);const cues=[...new Set(fresh.map(e=>e.sound))].slice(-4);cues.forEach((cue,i)=>{timers.current.push(setTimeout(()=>sound.current(cue),i*220));});
 timers.current.push(setTimeout(()=>setEvents([]),2800));
 },[game,connected]);
 return events;
}
