import { useEffect, useRef, useState } from 'react';
import type { PerchProjection, PerchLog } from '@hangul-rummikub/shared';
type Cue = PerchLog['sound'] | 'SELECT' | 'ERROR';
export function perchNewSoundIds(previous: {
    gameId: string;
    sequence: number;
} | null, g: PerchProjection, connected: boolean): number[] { if (!previous || previous.gameId !== g.gameId || !connected)
    return []; return g.history.filter(l => l.id > previous.sequence && l.sound !== 'NONE').map(l => l.id); }
export function usePerchSound(g: PerchProjection | null, connected: boolean) {
    const [volume, setVolume] = useState(() => { try {
        const n = Number(localStorage.getItem('perch-effects') ?? '35');
        return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 35;
    }
    catch {
        return 35;
    } }), [enabled, setEnabled] = useState(false);
    const context = useRef<AudioContext | null>(null), previous = useRef<{
        gameId: string;
        sequence: number;
    } | null>(null), volumeRef = useRef(volume), wasConnected = useRef(connected);
    volumeRef.current = volume;
    function play(cue: Cue) {
        const ctx = context.current;
        if (!ctx || ctx.state !== 'running' || volumeRef.current === 0 || cue === 'NONE')
            return;
        const now = ctx.currentTime, gain = volumeRef.current / 100 * .11;
        const tone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine', end = freq) => { const osc = ctx.createOscillator(), amp = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, now + start); osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + start + duration); amp.gain.setValueAtTime(.001, now + start); amp.gain.exponentialRampToValueAtTime(gain, now + start + .008); amp.gain.exponentialRampToValueAtTime(.001, now + start + duration); osc.connect(amp); amp.connect(ctx.destination); osc.start(now + start); osc.stop(now + start + duration + .01); osc.onended = () => { osc.disconnect(); amp.disconnect(); }; };
        const noise = (duration: number, frequency: number) => { const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate), xs = buffer.getChannelData(0); let seed = 1823; for (let i = 0; i < xs.length; i++) {
            seed = (seed * 16807) % 2147483647;
            xs[i] = (seed / 1073741824 - 1) * (1 - i / xs.length);
        } const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain(); source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; amp.gain.setValueAtTime(gain * .65, now); amp.gain.exponentialRampToValueAtTime(.001, now + duration); source.connect(filter); filter.connect(amp); amp.connect(ctx.destination); source.start(); source.onended = () => { source.disconnect(); filter.disconnect(); amp.disconnect(); }; };
        switch (cue) {
            case 'SELECT':
                tone(800, 0, .055, 'sine', 1100);
                break;
            case 'PLACE':
                tone(320, 0, .10, 'triangle', 130);
                tone(1800, .04, .1, 'sine', 2300);
                break;
            case 'WING':
                noise(.22, 1500);
                break;
            case 'WATER':
                tone(1450, 0, .2, 'sine', 420);
                tone(1900, .09, .16, 'sine', 600);
                break;
            case 'HOUSE':
                tone(210, 0, .12, 'triangle', 100);
                tone(290, .07, .10, 'triangle', 120);
                break;
            case 'ZAP':
                noise(.18, 2800);
                tone(650, 0, .16, 'sawtooth', 70);
                break;
            case 'CREATURE':
                tone(440, 0, .12, 'triangle');
                tone(660, .12, .15, 'triangle');
                break;
            case 'SCORE':
                [660, 830, 990].forEach((f, i) => tone(f, i * .085, .17));
                break;
            case 'TURN':
                tone(880, 0, .12);
                tone(1175, .14, .16);
                break;
            case 'WIN':
                [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .14, .38, 'triangle'));
                break;
            case 'DEAL':
                noise(.15, 900);
                tone(350, .05, .06, 'triangle');
                break;
            case 'ERROR':
                tone(190, 0, .12, 'triangle', 150);
                break;
            default: break;
        }
    }
    function unlock() { if (!context.current) {
        try {
            context.current = new AudioContext();
        }
        catch {
            return;
        }
    } void context.current.resume().then(() => setEnabled(true)).catch(() => setEnabled(false)); }
    useEffect(() => { try {
        localStorage.setItem('perch-effects', String(volume));
    }
    catch { /* Preferences are optional in storage-restricted browsers. */ } }, [volume]);
    useEffect(() => {
        if (!g) {
            previous.current = null;
            wasConnected.current = connected;
            return;
        }
        const newest = g.history.at(-1)?.id ?? 0;
        if (connected && wasConnected.current) {
            const ids = perchNewSoundIds(previous.current, g, true);
            const latest = g.history.filter(l => ids.includes(l.id)).slice(-1);
            if (latest[0])
                play(latest[0].sound);
        }
        previous.current = { gameId: g.gameId, sequence: newest };
        wasConnected.current = connected;
    }, [g?.gameId, g?.gameRevision, connected]);
    useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
    return { volume, setVolume, enabled, unlock, select: () => play('SELECT'), error: () => play('ERROR') };
}
