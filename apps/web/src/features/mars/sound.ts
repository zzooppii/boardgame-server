import { useEffect, useRef, useState } from 'react';
import { MARS_RESOURCES, type MarsProjection, type MarsResource } from '@hangul-rummikub/shared';
export type MarsCue = 'SELECT' | 'CARD' | 'PLACE' | 'WATER' | 'GREENERY' | 'HEAT' | 'PRODUCTION' | 'TURN' | 'CLAIM' | 'FINISH' | 'ERROR';
export function marsFeedback(previous: MarsProjection | null, current: MarsProjection, continuous: boolean): {
    cue: MarsCue | null;
    deltas: Partial<Record<MarsResource, number>>;
} {
    if (!continuous || !previous || previous.gameId !== current.gameId || current.gameRevision !== previous.gameRevision + 1)
        return { cue: null, deltas: {} };
    const a = previous.playerStates.find(p => p.playerId === current.privateState.playerId), b = current.playerStates.find(p => p.playerId === current.privateState.playerId), deltas: Partial<Record<MarsResource, number>> = {};
    if (a && b)
        for (const k of MARS_RESOURCES) {
            const n = b.resources[k] - a.resources[k];
            if (n)
                deltas[k] = n;
        }
    const event = current.history.at(-1), newEvent = event && event.id > (previous.history.at(-1)?.id ?? 0);
    const cue: MarsCue | null = current.phase === 'FINISHED' && previous.phase !== 'FINISHED' ? (current.result.reason === 'SCORED' ? 'FINISH' : null) : current.generation !== previous.generation || newEvent && event.kind === 'PRODUCTION' ? 'PRODUCTION' : current.oceans > previous.oceans ? 'WATER' : current.tiles.length > previous.tiles.length ? (current.tiles.at(-1)?.kind === 'greenery' ? 'GREENERY' : 'PLACE') : current.temperature > previous.temperature ? 'HEAT' : newEvent && event.kind === 'CARD' ? 'CARD' : newEvent && event.kind === 'CLAIM' ? 'CLAIM' : current.activePlayerId !== previous.activePlayerId && current.activePlayerId === current.privateState.playerId ? 'TURN' : null;
    return { cue, deltas };
}
export function useMarsSound(g: MarsProjection | null, connected: boolean) {
    const [volume, setVolume] = useState(() => { try {
        const n = Number(localStorage.getItem('mars-sound-volume') ?? '30');
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 30;
    }
    catch {
        return 30;
    } });
    const context = useRef<AudioContext | null>(null), level = useRef(volume), previous = useRef<MarsProjection | null>(null), wasConnected = useRef(false);
    level.current = volume;
    function play(cue: MarsCue) {
        const c = context.current;
        if (!c || c.state !== 'running' || level.current === 0)
            return;
        const start = c.currentTime, amp = level.current / 100 * .12;
        const tone = (frequency: number, offset: number, duration: number, end = frequency, type: OscillatorType = 'sine') => { const osc = c.createOscillator(), gain = c.createGain(); osc.type = type; osc.frequency.setValueAtTime(frequency, start + offset); osc.frequency.exponentialRampToValueAtTime(end, start + offset + duration); gain.gain.setValueAtTime(.0001, start + offset); gain.gain.exponentialRampToValueAtTime(amp, start + offset + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + offset + duration); osc.connect(gain); gain.connect(c.destination); osc.start(start + offset); osc.stop(start + offset + duration + .02); osc.onended = () => { osc.disconnect(); gain.disconnect(); }; };
        if (cue === 'WATER') {
            [420, 720, 520, 940].forEach((f, i) => tone(f, i * .055, .18, f * .7));
        }
        else if (cue === 'GREENERY') {
            [392, 494, 587].forEach((f, i) => tone(f, i * .07, .25, f, 'triangle'));
        }
        else if (cue === 'HEAT') {
            tone(85, 0, .3, 210, 'triangle');
            tone(210, .12, .15, 90);
        }
        else if (cue === 'PRODUCTION') {
            [330, 440, 550, 660].forEach((f, i) => tone(f, i * .08, .24, f, 'triangle'));
        }
        else if (cue === 'FINISH' || cue === 'CLAIM') {
            (cue === 'FINISH' ? [262, 330, 392, 523, 659] : [523, 659, 784]).forEach((f, i) => tone(f, i * .11, .4, f, 'triangle'));
        }
        else if (cue === 'PLACE') {
            tone(150, 0, .12, 65, 'triangle');
            tone(440, .055, .12, 280);
        }
        else if (cue === 'CARD') {
            tone(680, 0, .11, 220, 'triangle');
            tone(390, .055, .12);
        }
        else if (cue === 'TURN') {
            tone(523, 0, .17);
            tone(784, .12, .22);
        }
        else if (cue === 'ERROR') {
            tone(170, 0, .13, 120, 'triangle');
        }
        else
            tone(800, 0, .055, 680);
    }
    async function unlock() { try {
        context.current ??= new AudioContext();
        if (context.current.state === 'suspended')
            await context.current.resume();
    }
    catch { /* Audio can be unavailable; all interaction remains visible. */ } }
    useEffect(() => { try {
        localStorage.setItem('mars-sound-volume', String(volume));
    }
    catch { /* Optional preference only. */ } }, [volume]);
    useEffect(() => { if (g) {
        const f = marsFeedback(previous.current, g, connected && wasConnected.current);
        if (f.cue)
            play(f.cue);
    } previous.current = g; wasConnected.current = connected; }, [g, connected]);
    useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
    return { volume, setVolume, play, unlock };
}
