import { useEffect, useRef, useState } from 'react';
import type { SpiritProjection, SpiritId } from '@hangul-rummikub/shared';
export type SpiritCue = 'PICK' | 'SELECT' | 'GROW' | 'CARD' | 'POWER' | 'MOVE' | 'DAMAGE' | 'FEAR' | 'BLIGHT' | 'BUILD' | 'EXPLORE' | 'PHASE' | 'WIN' | 'LOSE' | 'PLAN' | 'ERROR' | 'SINK';
export function spiritTransitionCues(previous: SpiritProjection | null, next: SpiritProjection | null): SpiritCue[] {
    if (!previous || !next || previous.gameId !== next.gameId || next.gameRevision <= previous.gameRevision)
        return [];
    const last = previous.log.at(-1)?.id ?? 0;
    const sinking=next.destroyedBoards.length>previous.destroyedBoards.length;
    const cues:SpiritCue[]=[...new Set(next.log.filter(e => e.id > last).map(e => e.kind))].slice(-3);
    return sinking?['SINK',...cues.filter(c=>c==='WIN'||c==='LOSE')]:cues;
}
/** Small wooden cube taps, paper sweeps, a soft plucked scale and brass coin chimes. */
export class SpiritAudio {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private volume = .55;
    private lastPick = -1;
    constructor(private readonly factory: () => AudioContext | null = () => typeof window !== 'undefined' && typeof window.AudioContext === 'function' ? new AudioContext() : null) { }
    unlock() { try {
        if (!this.context) {
            this.context = this.factory();
            if (!this.context)
                return;
            this.master = this.context.createGain();
            this.master.gain.value = this.volume * .35;
            this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended')
            void this.context.resume().catch(() => undefined);
    }
    catch {
        this.dispose();
    } }
    setVolume(volume: number) { this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0; if (this.context && this.master)
        this.master.gain.setTargetAtTime(this.volume * .35, this.context.currentTime, .02); }
    private tone(hz: number, at: number, duration: number, level = .25) { const c = this.context, m = this.master; if (!c || !m)
        return; const tone = c.createOscillator(), gain = c.createGain(); tone.type = 'triangle'; tone.frequency.setValueAtTime(hz, at); gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(level, at + .004); gain.gain.exponentialRampToValueAtTime(.0001, at + duration); tone.connect(gain); gain.connect(m); tone.onended = () => { tone.disconnect(); gain.disconnect(); }; tone.start(at); tone.stop(at + duration + .01); }
    private paper(at: number) { const c = this.context, m = this.master; if (!c || !m)
        return; const b = c.createBuffer(1, Math.ceil(c.sampleRate * .18), c.sampleRate), samples = b.getChannelData(0); let seed = 17; for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = (seed / 2147483648 - 1) * Math.sin(Math.PI * i / samples.length) * .22;
    } const source = c.createBufferSource(), filter = c.createBiquadFilter(); source.buffer = b; filter.type = 'bandpass'; filter.frequency.value = 1700; source.connect(filter); filter.connect(m); source.onended = () => { source.disconnect(); filter.disconnect(); }; source.start(at); source.stop(at + .2); }
    play(cues: readonly SpiritCue[], spirit: SpiritId | null = null) {
        const c = this.context;
        if (!c || c.state !== 'running' || !this.volume)
            return;
        if (cues.every(cue => cue === 'PICK') && c.currentTime - this.lastPick < .06)
            return;
        this.lastPick = c.currentTime;
        let at = c.currentTime + .01;
        for (const cue of cues) {
            if (cue === 'CARD' || cue === 'MOVE') {
                this.paper(at);
                if (cue === 'MOVE')
                    this.paper(at + .12);
                at += .35;
            }
            else if(cue==='SINK'){[196,146.83,110,73.42].forEach((hz,i)=>this.tone(hz,at+i*.16,.7,.16));at+=1.2;}
            else if (cue === 'POWER') {
                (spirit==='FANGS'?[164.81,246.94,329.63]:spirit==='KEEPER'?[130.81,196,261.63]:spirit==='RIVER'||spirit==='OCEAN'?[392,523.25,783.99]:spirit==='EARTH'||spirit==='GREEN'?[196,293.66,392]:spirit==='SHADOW'||spirit==='BRINGER'?[220,311.13,440]:[1046.5,1568,2093]).forEach((hz, i) => this.tone(hz, at + i * .07, .4, .15));
                at += .5;
            }
            else if (cue === 'GROW') {
                [392, 493.88, 587.33].forEach((hz, i) => this.tone(hz, at + i * .09, .23));
                at += .45;
            }
            else if (cue === 'WIN') {
                [392, 493.88, 587.33, 783.99].forEach((hz, i) => this.tone(hz, at + i * .15, .65));
                at += 1;
            }
            else if (cue === 'PHASE') {
                this.tone(587.33, at, .22, .16);
                this.tone(783.99, at + .13, .35, .16);
                at += .5;
            }
            else if (cue === 'BUILD' || cue === 'DAMAGE') {
                [280, 420, 330].forEach((hz, i) => this.tone(hz, at + i * .07, .075, .3));
                at += .3;
            }
            else if (cue === 'BLIGHT' || cue === 'FEAR' || cue === 'LOSE') {
                this.tone(110, at, .65, .2);
                this.tone(cue === 'FEAR' ? 164.81 : 116.54, at + .08, .6, .12);
                at += .8;
            }
            else {
                this.tone(cue === 'ERROR' ? 196 : 640, at, .07, .15);
                at += .15;
            }
        }
    }
    dispose() { const c = this.context; this.context = null; this.master = null; if (c && c.state !== 'closed')
        void c.close().catch(() => undefined); }
}
const key = 'spirit:sound-volume';
export function useSpiritSound(game: SpiritProjection | null, connected: boolean) {
    const [volume, setVolume] = useState(() => { try {
        const value = localStorage.getItem(key);
        return value !== null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 55;
    }
    catch {
        return 55;
    } });
    const audio = useRef<SpiritAudio | null>(null), previous = useRef(game), online = useRef(connected);
    useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);
    useEffect(() => { const cues = spiritTransitionCues(previous.current, game); previous.current = game; if (connected && online.current)
        audio.current?.play(cues, game?.playerStates.find(p=>p.playerId===game.log.filter(e=>e.kind==='POWER').at(-1)?.playerId)?.spirit ?? null); online.current = connected; }, [game, connected]);
    function unlock() { if (volume === 0)
        return; audio.current ??= new SpiritAudio(); audio.current.setVolume(volume / 100); audio.current.unlock(); }
    function play(cue: SpiritCue) { unlock(); audio.current?.play([cue]); }
    function changeVolume(n: number) { const next = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; setVolume(next); try {
        localStorage.setItem(key, String(next));
    }
    catch { /* Volume remains in memory when browser storage is unavailable. */ } audio.current ??= new SpiritAudio(); audio.current.setVolume(next / 100); if (next > 0)
        audio.current.unlock(); }
    return { volume, changeVolume, unlock, play };
}
