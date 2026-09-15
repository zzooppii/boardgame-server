import { useEffect, useRef, useState } from 'react';
import type { ArnakProjection } from '@hangul-rummikub/shared';
import { arnakVolume, scheduleArnakCue, type ArnakCue } from './sound-engine.js';
export type { ArnakCue } from './sound-engine.js';
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
        return Number.isFinite(n) ? arnakVolume(n) : 30;
    }
    catch {
        return 30;
    } });
    const context = useRef<AudioContext | null>(null), volumeRef = useRef(volume), previous = useRef<{
        gameId: string;
        revision: number;
    } | null>(null), wasConnected = useRef(false);
    const bus = useRef<GainNode | null>(null), stopCue = useRef<(() => void) | null>(null);
    volumeRef.current = volume;
    function play(cue: ArnakCue) {
        const c = context.current;
        if (!c || !bus.current || c.state !== 'running' || !volumeRef.current || document.hidden) return;
        stopCue.current?.();
        stopCue.current = scheduleArnakCue(c, bus.current, cue);
    }
    function changeVolume(value: number) {
        const next = arnakVolume(value);
        volumeRef.current = next;
        if (!next) { stopCue.current?.(); stopCue.current = null; }
        if (bus.current && context.current) bus.current.gain.setTargetAtTime(next / 100, context.current.currentTime, .01);
        setVolume(next);
    }
    async function unlock() { try {
        if (!context.current) {
            context.current = new AudioContext();
            bus.current = context.current.createGain();
            bus.current.gain.value = volumeRef.current / 100;
            bus.current.connect(context.current.destination);
        }
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
    useEffect(() => {
        const silence = () => { if (document.hidden) { stopCue.current?.(); stopCue.current = null; } };
        document.addEventListener('visibilitychange', silence);
        return () => {
            document.removeEventListener('visibilitychange', silence);
            stopCue.current?.(); stopCue.current = null;
            bus.current?.disconnect(); bus.current = null;
            void context.current?.close().catch(() => undefined); context.current = null;
        };
    }, []);
    return { volume, setVolume: changeVolume, play, unlock };
}
