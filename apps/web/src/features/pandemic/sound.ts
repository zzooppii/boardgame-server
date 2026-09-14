import {useEffect,useRef,useState} from 'react';
import type {PandemicLog,PandemicProjection} from '@hangul-rummikub/shared';
import {pandemicFeedback} from './presentation.js';
type Cue=PandemicLog['sound']|'SELECT';
/** Locally synthesized tactile taps, filtered card rustle, soft alarms and discovery chimes. */
export class PandemicAudio {
 private ctx:AudioContext|null=null;private fx:GainNode|null=null;private ambient:GainNode|null=null;private drones:OscillatorNode[]=[];private level=.4;private music=0;
 unlock(){try{if(!this.ctx){const c=new AudioContext();this.ctx=c;this.fx=c.createGain();this.fx.connect(c.destination);this.ambient=c.createGain();this.ambient.connect(c.destination);for(const f of [65.41,98,130.81]){const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.connect(this.ambient);o.start();this.drones.push(o);}this.volume(this.level,this.music);}if(this.ctx.state==='suspended')void this.ctx.resume().catch(()=>this.suspend());}catch{this.dispose();}}
 volume(effects:number,music:number){this.level=effects;this.music=music;if(this.ctx&&this.fx&&this.ambient){this.fx.gain.setTargetAtTime(effects*.18,this.ctx.currentTime,.03);this.ambient.gain.setTargetAtTime(music*.018,this.ctx.currentTime,.1);}}
 suspend(){if(this.ctx?.state==='running')void this.ctx.suspend().catch(()=>this.dispose());}
 play(cue:Cue){const c=this.ctx,master=this.fx;if(!c||!master||c.state!=='running'||!this.level)return;
 const tone=(hz:number,offset:number,length:number,end=hz)=>{const o=c.createOscillator(),gain=c.createGain(),at=c.currentTime+offset;o.type='triangle';o.frequency.setValueAtTime(hz,at);o.frequency.exponentialRampToValueAtTime(end,at+length);gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.35,at+.006);gain.gain.exponentialRampToValueAtTime(.001,at+length);o.connect(gain);gain.connect(master);o.onended=()=>{o.disconnect();gain.disconnect();};o.start(at);o.stop(at+length+.02);};
 if(cue==='CARD'||cue==='EVENT'){const buffer=c.createBuffer(1,c.sampleRate*.16,c.sampleRate),data=buffer.getChannelData(0);let seed=79;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*Math.sin(i/data.length*Math.PI)*.15;}const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=2000;source.connect(filter);filter.connect(master);source.onended=()=>{source.disconnect();filter.disconnect();};source.start();}
 if(cue==='WIN'||cue==='CURE'){[392,493.88,587.33,783.99].forEach((f,i)=>tone(f,i*.12,.5));}
 else if(cue==='EPIDEMIC'||cue==='OUTBREAK'||cue==='LOSE'){tone(220,0,.4,110);tone(164.81,.18,.6,82.4);}
 else if(cue==='MOVE'){tone(360,0,.09,200);tone(480,.11,.1,260);}
 else if(cue==='TREAT'){tone(660,0,.16,880);tone(990,.1,.24);}
 else if(cue==='BUILD'){tone(180,0,.08);tone(240,.09,.08);tone(360,.18,.18);}
 else if(cue==='TURN'){tone(523.25,0,.16);tone(783.99,.12,.28);}
 else if(cue==='INFECT'){tone(150,0,.15,75);}
 else if(cue==='SELECT'||cue==='PING'){tone(cue==='PING'?880:620,0,.055);}
 }
 dispose(){for(const o of this.drones){o.stop();o.disconnect();}this.drones=[];const c=this.ctx;this.ctx=null;this.fx=null;this.ambient=null;if(c&&c.state!=='closed')void c.close().catch(()=>undefined);}
}
function saved(key:string,defaultValue:number){try{const s=localStorage.getItem(key);return s!==null&&Number.isFinite(Number(s))?Math.max(0,Math.min(100,Number(s))):defaultValue;}catch{return defaultValue;}}
export function usePandemicSound(game:PandemicProjection|null,connected:boolean){
 const audio=useRef<PandemicAudio|null>(null),previous=useRef<PandemicProjection|null>(null),wasConnected=useRef(false);
 const [effects,setEffects]=useState(()=>saved('pandemic-effects',40)),[music,setMusic]=useState(()=>saved('pandemic-music',0));
 useEffect(()=>{audio.current=new PandemicAudio();return()=>{audio.current?.dispose();audio.current=null;};},[]);
 useEffect(()=>{audio.current?.volume(effects/100,music/100);try{localStorage.setItem('pandemic-effects',String(effects));localStorage.setItem('pandemic-music',String(music));}catch{/* Volume remains usable when storage is unavailable. */}},[effects,music]);
 useEffect(()=>{const visibility=()=>{if(document.hidden)audio.current?.suspend();};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{if(connected&&wasConnected.current&&!document.hidden){const cues=pandemicFeedback(previous.current,game);for(const cue of [...new Set(cues.map(c=>c.sound))].slice(-3))audio.current?.play(cue);}previous.current=game;wasConnected.current=connected;if(!connected)audio.current?.suspend();},[game,connected]);
 return {effects,music,setEffects,setMusic,unlock:()=>{if(connected)audio.current?.unlock();},select:()=>audio.current?.play('SELECT')};
}
