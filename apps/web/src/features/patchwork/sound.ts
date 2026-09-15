import {useEffect,useRef,useState} from 'react';
import type {PatchworkProjection} from '@hangul-rummikub/shared';
export type PatchworkCue='SELECT'|'ROTATE'|'FLIP'|'PLACE'|'CANCEL'|'INCOME'|'LEATHER'|'TURN'|'BONUS'|'WIN'|'ERROR';
export function patchworkNewCue(previous:{gameId:string;revision:number}|null,g:PatchworkProjection,continuous:boolean):PatchworkCue|null{
 if(!continuous||!previous||previous.gameId!==g.gameId||g.gameRevision<=previous.revision)return null;
 if(g.phase==='FINISHED')return g.result.reason==='SCORED'?'WIN':null;
 const last=g.history.at(-1);return last?.bonus?'BONUS':last?.income?'INCOME':last?.kind==='LEATHER'?'LEATHER':last?.kind==='ADVANCE'?'TURN':'PLACE';
}
export function usePatchworkSound(g:PatchworkProjection|null,connected:boolean){
 const [volume,setVolume]=useState(()=>{try{const n=Number(localStorage.getItem('patchwork-volume')??'35');return Number.isFinite(n)?Math.min(100,Math.max(0,n)):35;}catch{return 35;}}),[enabled,setEnabled]=useState(false);
 const context=useRef<AudioContext|null>(null),volumeRef=useRef(volume),previous=useRef<{gameId:string;revision:number}|null>(null),wasConnected=useRef(false);volumeRef.current=volume;
 function play(cue:PatchworkCue){const c=context.current;if(!c||c.state!=='running'||volumeRef.current===0)return;const now=c.currentTime,amp=volumeRef.current*.0011;
  function tone(f:number,offset:number,duration:number,type:OscillatorType='sine',end=f){if(!c)return;const osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(f,now+offset);osc.frequency.exponentialRampToValueAtTime(end,now+offset+duration);gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(amp,now+offset+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+duration);osc.connect(gain);gain.connect(c.destination);osc.start(now+offset);osc.stop(now+offset+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
  function cloth(){const buffer=c!.createBuffer(1,Math.floor(c!.sampleRate*.09),c!.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.sin(i*13.71)+Math.sin(i*7.13))*.3;const source=c!.createBufferSource(),filter=c!.createBiquadFilter(),gain=c!.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1000;gain.gain.setValueAtTime(amp*.45,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.09);source.connect(filter);filter.connect(gain);gain.connect(c!.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
  if(cue==='INCOME'){[1000,1400,1200,1800].forEach((f,i)=>tone(f,i*.05,.12,'triangle'));}
  else if(cue==='WIN'||cue==='BONUS'){(cue==='WIN'?[523,659,784,1046]:[659,784,988]).forEach((f,i)=>tone(f,i*.12,.35,'triangle'));}
  else if(cue==='PLACE'||cue==='LEATHER'){cloth();tone(cue==='LEATHER'?310:230,0,.11,'triangle',140);}
  else if(cue==='FLIP'){cloth();tone(510,0,.08,'sine',310);}
  else if(cue==='ROTATE'){cloth();tone(480,0,.06,'sine',650);}
  else if(cue==='TURN'){tone(640,0,.12);tone(820,.1,.15);}
  else if(cue==='CANCEL'){tone(460,0,.08,'sine',260);}
  else if(cue==='ERROR'){tone(160,0,.12,'triangle',125);}
  else{cloth();tone(760,0,.06);}
 }
 async function unlock(){try{context.current??=new AudioContext();await context.current.resume();setEnabled(context.current.state==='running');}catch{setEnabled(false);}}
 useEffect(()=>{try{localStorage.setItem('patchwork-volume',String(volume));}catch{/* Optional device preference; game state is unaffected. */}},[volume]);
 useEffect(()=>{if(g){const cue=patchworkNewCue(previous.current,g,connected&&wasConnected.current);if(cue)play(cue);previous.current={gameId:g.gameId,revision:g.gameRevision};}else previous.current=null;wasConnected.current=connected;},[g?.gameId,g?.gameRevision,connected]);
 useEffect(()=>()=>{void context.current?.close().catch(()=>undefined);context.current=null;},[]);
 return {volume,setVolume,enabled,play,unlock};
}
