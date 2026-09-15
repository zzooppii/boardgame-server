import {useEffect,useRef,useState} from 'react';
import type {HarmoniesProjection,HarmoniesColor} from '@hangul-rummikub/shared';
export type HarmoniesCue='SELECT'|'UNDO'|'CARD'|'ANIMAL'|'TURN'|'COMMIT'|'WIN'|'ERROR'|HarmoniesColor;
export function harmoniesNewCue(previous:{gameId:string;revision:number}|null,g:HarmoniesProjection,continuous:boolean):HarmoniesCue|null{
 if(!continuous||!previous||previous.gameId!==g.gameId||previous.revision>=g.gameRevision)return null;
 return g.phase==='FINISHED'?(g.result.reason==='SCORED'?'WIN':null):g.history.at(-1)?.animals?'ANIMAL':'COMMIT';
}
export function useHarmoniesSound(g:HarmoniesProjection|null,connected:boolean){
 const [volume,setVolume]=useState(()=>{try{const n=Number(localStorage.getItem('harmonies-volume')??'35');return Number.isFinite(n)?Math.min(100,Math.max(0,n)):35;}catch{return 35;}}),[enabled,setEnabled]=useState(false);
 const ctx=useRef<AudioContext|null>(null),level=useRef(volume),previous=useRef<{gameId:string;revision:number}|null>(null),wasConnected=useRef(false);level.current=volume;
 function play(cue:HarmoniesCue){const c=ctx.current;if(!c||c.state!=='running'||!level.current)return;
  const now=c.currentTime,amp=level.current*.0012;
  const tone=(f:number,start:number,duration:number,type:OscillatorType='sine',to=f)=>{const osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(f,now+start);osc.frequency.exponentialRampToValueAtTime(to,now+start+duration);gain.gain.setValueAtTime(.0001,now+start);gain.gain.exponentialRampToValueAtTime(amp,now+start+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+start+duration);osc.connect(gain);gain.connect(c.destination);osc.start(now+start);osc.stop(now+start+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};};
  if(cue==='WATER'){tone(1100,0,.2,'sine',300);tone(1550,.045,.15,'sine',450);}
  else if(cue==='STONE'){tone(370,0,.13,'triangle',280);tone(1260,0,.09,'sine',900);}
  else if(cue==='WOOD'||cue==='RED'){tone(cue==='WOOD'?250:340,0,.10,'triangle',120);tone(590,.015,.075,'sine',270);}
  else if(cue==='ANIMAL'||cue==='LEAF'){tone(1300,0,.1,'sine',2100);tone(1700,.11,.12,'sine',2500);}
  else if(cue==='WIN'){[523,659,784,1046].forEach((f,i)=>tone(f,i*.13,.38,'triangle'));}
  else if(cue==='TURN'||cue==='COMMIT'){tone(660,0,.15);tone(880,.13,.2);}
  else if(cue==='UNDO'){tone(620,0,.10,'sine',340);}
  else if(cue==='ERROR'){tone(190,0,.13,'triangle',155);}
  else if(cue==='CARD'){tone(500,0,.08,'triangle',270);tone(730,.06,.08);}
  else{tone(cue==='FIELD'?930:700,0,.07,'sine',1000);}
 }
 async function unlock(){try{ctx.current??=new AudioContext();await ctx.current.resume();setEnabled(ctx.current.state==='running');}catch{setEnabled(false);}}
 useEffect(()=>{try{localStorage.setItem('harmonies-volume',String(volume));}catch{/* Audio preferences are optional. */}},[volume]);
 useEffect(()=>{if(g){const cue=harmoniesNewCue(previous.current,g,connected&&wasConnected.current);if(cue)play(cue);previous.current={gameId:g.gameId,revision:g.gameRevision};}else previous.current=null;wasConnected.current=connected;},[g?.gameId,g?.gameRevision,connected]);
 useEffect(()=>()=>{void ctx.current?.close().catch(()=>undefined);ctx.current=null;},[]);
 return {volume,setVolume,enabled,unlock,play};
}
