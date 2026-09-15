import { useEffect, useRef, useState } from 'react';
import type { DuelProjection } from '@hangul-rummikub/shared';
export type DuelCue = DuelProjection['history'][number]['sound'] | 'select' | 'error';
export function duelNewCue(previous: {
    gameId: string;
    revision: number;
} | null, g: Pick<DuelProjection, 'gameId' | 'gameRevision' | 'phase' | 'history'>, continuous: boolean): DuelCue | null { return !continuous || !previous || previous.gameId !== g.gameId || g.gameRevision <= previous.revision ? null : g.phase === 'FINISHED' ? 'finish' : g.history.at(-1)?.sound ?? null; }
export function useDuelSound(g: DuelProjection | null, connected: boolean) {
    const [volume, setVolume] = useState(() => {
        try {
            const n = Number(localStorage.getItem('duel-volume') ?? 30);
            return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 30;
        }
        catch {
            return 30;
        }
    }), ctx = useRef<AudioContext | null>(null), vol = useRef(volume), prev = useRef<{
        gameId: string;
        revision: number;
    } | null>(null), continuous = useRef(false);
    vol.current = volume;
    async function unlock() {
        try {
            ctx.current ??= new AudioContext();
            await ctx.current.resume();
        }
        catch { /* Audio availability does not affect gameplay. */ }
    }
    function play(cue: DuelCue) {
        const c = ctx.current;
        if (!c || c.state !== 'running' || !vol.current)
            return;
        const now = c.currentTime, notes: Record<DuelCue, number[]> = { select: [640], error: [120, 100], card: [210, 150], coin: [1200, 1760, 1320], wonder: [196, 294, 392, 587], military: [90, 110, 80], science: [523, 784, 1046], god: [294, 440, 587, 880], senate: [260, 330], conspiracy: [146, 155, 220], reveal: [440, 660], turn: [392, 523], finish: [392, 494, 587, 784] };
        notes[cue].forEach((f, i) => { const o = c.createOscillator(), gain = c.createGain(); o.type = cue === 'military' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f, now + i * .065); gain.gain.setValueAtTime(.0001, now + i * .065); gain.gain.exponentialRampToValueAtTime(vol.current * .001, now + i * .065 + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .065 + .25); o.connect(gain); gain.connect(c.destination); o.start(now + i * .065); o.stop(now + i * .065 + .27); o.onended = () => { o.disconnect(); gain.disconnect(); }; });
    }
    useEffect(() => {
        try {
            localStorage.setItem('duel-volume', String(volume));
        }
        catch { /* Optional device preference. */ }
    }, [volume]);
    useEffect(() => {
        if (g) {
            const cue = duelNewCue(prev.current, g, connected && continuous.current);
            if (cue)
                play(cue);
            prev.current = { gameId: g.gameId, revision: g.gameRevision };
        }
        else
            prev.current = null;
        continuous.current = connected;
    }, [g?.gameId, g?.gameRevision, connected]);
    useEffect(() => () => { void ctx.current?.close().catch(() => undefined); ctx.current = null; }, []);
    return { volume, setVolume, unlock, play };
}
