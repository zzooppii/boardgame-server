import { useEffect, useRef, useState } from 'react';
import type { ArnakProjection } from '@hangul-rummikub/shared';
export type ArnakCue = 'SELECT' | 'CARD' | 'DIG' | 'DISCOVER' | 'BUY' | 'RESEARCH' | 'GUARDIAN' | 'TURN' | 'WIN' | 'ERROR';
type SoundSnapshot = Pick<ArnakProjection, 'gameId' | 'gameRevision' | 'phase' | 'stage'> & { history: readonly { kind: string }[]; result?: { reason: string } };
export function arnakNewCue(previous: {
    gameId: string;
    revision: number;
} | null, g: SoundSnapshot, continuous: boolean): ArnakCue | null {
    if (!continuous || !previous || previous.gameId !== g.gameId || g.gameRevision !== previous.revision + 1)
        return null;
    if (g.phase === 'FINISHED')
        return g.result?.reason === 'SCORED' ? 'WIN' : null;
    const kind = g.history.at(-1)?.kind;
    if (kind === 'KEEP') return 'SELECT';
    if (kind === 'PASS' && g.stage === 'CLEANUP') return 'CARD';
    return kind === 'DISCOVER' || kind === 'DIG' || kind === 'BUY' || kind === 'RESEARCH' || kind === 'GUARDIAN' ? kind : kind === 'END' || kind === 'PASS' ? 'TURN' : 'CARD';
}
export function useArnakSound(g: ArnakProjection | null, connected: boolean) {
    const [volume, setVolume] = useState(() => { try {
        const n = Number(localStorage.getItem('arnak-volume') ?? '30');
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 30;
    }
    catch {
        return 30;
    } });
    const context = useRef<AudioContext | null>(null), volumeRef = useRef(volume), previous = useRef<{
        gameId: string;
        revision: number;
    } | null>(null), wasConnected = useRef(false);
    volumeRef.current = volume;
    function play(cue: ArnakCue) {
        const c = context.current;
        if (!c || c.state !== 'running' || !volumeRef.current)
            return;
        const at = c.currentTime, amp = volumeRef.current * .001;
        function tone(f: number, delay: number, duration: number, type: OscillatorType = 'sine', end = f) { if (!c)
            return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, at + delay); o.frequency.exponentialRampToValueAtTime(end, at + delay + duration); g.gain.setValueAtTime(.0001, at + delay); g.gain.exponentialRampToValueAtTime(amp, at + delay + .008); g.gain.exponentialRampToValueAtTime(.0001, at + delay + duration); o.connect(g); g.connect(c.destination); o.start(at + delay); o.stop(at + delay + duration + .01); o.onended = () => { o.disconnect(); g.disconnect(); }; }
        if (cue === 'DISCOVER' || cue === 'WIN')
            ([196, 293.66, 392, 493.88, 587.33]).forEach((f, i) => tone(f, i * .09, .65, 'triangle'));
        else if (cue === 'RESEARCH')
            ([523.25, 783.99, 1046.5]).forEach((f, i) => tone(f, i * .09, .38));
        else if (cue === 'GUARDIAN') {
            tone(85, 0, .45, 'triangle', 42);
            tone(392, .12, .55, 'triangle');
            tone(587, .25, .55);
        }
        else if (cue === 'BUY') {
            tone(1600, 0, .14, 'triangle');
            tone(2100, .06, .22, 'triangle');
        }
        else if (cue === 'DIG') {
            tone(150, 0, .14, 'triangle', 60);
            tone(110, .06, .19, 'triangle', 48);
        }
        else if (cue === 'TURN') {
            tone(440, 0, .17);
            tone(659, .12, .25);
        }
        else if (cue === 'ERROR')
            tone(130, 0, .17, 'triangle', 80);
        else if (cue === 'CARD') {
            tone(540, 0, .08, 'triangle', 220);
            tone(290, .03, .09);
        }
        else
            tone(780, 0, .065, 'sine', 520);
    }
    async function unlock() { try {
        context.current ??= new AudioContext();
        await context.current.resume();
    }
    catch { /* Sound availability never blocks play. */ } }
    useEffect(() => { try {
        localStorage.setItem('arnak-volume', String(volume));
    }
    catch { /* Optional device preference. */ } }, [volume]);
    useEffect(() => { if (g) {
        const cue = arnakNewCue(previous.current, g, connected && wasConnected.current);
        if (cue)
            play(cue);
        previous.current = { gameId: g.gameId, revision: g.gameRevision };
    }
    else
        previous.current = null; wasConnected.current = connected; }, [g?.gameId, g?.gameRevision, connected]);
    useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
    return { volume, setVolume, play, unlock };
}
