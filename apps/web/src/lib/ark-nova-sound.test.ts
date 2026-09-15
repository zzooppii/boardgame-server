import test from 'node:test';
import assert from 'node:assert/strict';
import {ArkAudio} from '../features/ark-nova/sound.js';

function contextFixture(initial:'running'|'suspended'='running') {
  const params=()=>({value:0,setValueAtTime(value:number){this.value=value;},setTargetAtTime(value:number){this.value=value;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const gains:Array<{gain:ReturnType<typeof params>;disconnected:boolean;connect():void;disconnect():void}>=[];
  const voices:Array<{frequency:ReturnType<typeof params>;type:string;onended:(()=>void)|null;stops:number;disconnected:boolean;connect():void;disconnect():void;start():void;stop():void}>=[];
  let finishResume=()=>{};
  const context={currentTime:1,state:initial as AudioContextState,destination:{},resumes:0,closed:false,
    resume(){this.resumes++;return new Promise<void>(resolve=>{finishResume=()=>{this.state='running';resolve();};});},
    close(){this.closed=true;this.state='closed';return Promise.resolve();},
    createGain(){const gain={gain:params(),disconnected:false,connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;},
    createOscillator(){const voice={frequency:params(),type:'sine',onended:null as (()=>void)|null,stops:0,disconnected:false,connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stops++;}};voices.push(voice);return voice;},
  };
  // A Web Audio test double for precisely the methods used by ArkAudio; no browser state is simulated elsewhere.
  const audio=new ArkAudio(()=>context as unknown as AudioContext);
  audio.setPreferences({enabled:true,volume:.5});
  return {audio,context,gains,voices,resume:()=>finishResume()};
}
test('A selection click never suppresses an immediate arrival, while identical duplicate cues are debounced',()=>{
  const f=contextFixture();f.audio.play('SELECT');f.audio.play('ARRIVAL');f.audio.play('ARRIVAL');
  assert.equal(f.voices.length,4);assert.deepEqual(f.voices.map(v=>v.frequency.value),[520,392,587,784]);
  f.context.currentTime+=.2;f.audio.play('ARRIVAL');assert.equal(f.voices.length,7);f.audio.dispose();
});
test('Suspended mobile audio resumes once and plays the latest result instead of losing its first cue',async()=>{
  const f=contextFixture('suspended');f.audio.play('SELECT');f.audio.play('CONSERVATION');
  assert.equal(f.voices.length,0);assert.equal(f.context.resumes,1);
  f.resume();await Promise.resolve();assert.equal(f.voices.length,4);assert.equal(f.voices[0]!.frequency.value,523);f.audio.dispose();
});
test('Muting cancels pending resume playback and disconnects scheduled voices and gains',async()=>{
  const f=contextFixture('suspended');f.audio.play('PLACE');f.audio.setPreferences({enabled:false,volume:.5});
  f.resume();await Promise.resolve();assert.equal(f.voices.length,0);
  f.audio.setPreferences({enabled:true,volume:5});f.audio.play('CONSERVATION');assert.equal(f.gains[0]!.gain.value,.18);
  f.audio.setPreferences({enabled:true,volume:0});assert.ok(f.voices.every(v=>v.disconnected&&v.stops===2));assert.ok(f.gains.slice(1).every(g=>g.disconnected));
  f.audio.play('PLACE');assert.equal(f.voices.length,4);f.audio.dispose();assert.ok(f.context.closed);
});
test('Disposing during resume cannot resurrect sound after leaving the game',async()=>{
  const f=contextFixture('suspended');f.audio.play('ARRIVAL');f.audio.dispose();f.resume();await Promise.resolve();assert.equal(f.voices.length,0);
});
