import {useEffect, useRef, useState} from 'react';

export type SpeakeasyCue = 'CARD_DRAW' | 'TILE_USE' | 'TILE_RETURN' | 'SELECT' | 'CANCEL' | 'BUILD' | 'PRODUCE' | 'DELIVER' | 'SELL' | 'PROTECT' | 'SETTLE' | 'ERROR';
export type SpeakeasyTone = Readonly<{frequency: number; end: number; delay: number; duration: number; shape: OscillatorType; gain: number}>;
export function speakeasyTones(cue: SpeakeasyCue): readonly SpeakeasyTone[] {
  const note = (frequency: number, delay: number, duration: number, end = frequency, shape: OscillatorType = 'sine', gain = 1): SpeakeasyTone => ({frequency, end, delay, duration, shape, gain});
  switch (cue) {
    case 'CARD_DRAW': return [note(640, 0, .06, 240, 'triangle', .35), note(420, .065, .08, 260, 'sine', .3)];
    case 'TILE_USE': return [note(330, 0, .09, 200, 'triangle', .5), note(660, .08, .15, 660, 'sine', .3)];
    case 'TILE_RETURN': return [note(180, 0, .09, 80, 'triangle', .6), note(240, .08, .07, 100, 'triangle', .3)];
    case 'SELECT': return [note(680, 0, .055, 310, 'triangle', .4)];
    case 'CANCEL': return [note(380, 0, .08, 260, 'sine', .4)];
    case 'BUILD': return [note(210, 0, .12, 85, 'triangle'), note(285, .13, .18, 100, 'triangle', .7)];
    case 'PRODUCE': return [note(320, 0, .12, 180, 'sine', .6), note(460, .09, .14, 230, 'sine', .5), note(520, .2, .18, 340, 'sine', .5)];
    case 'DELIVER': return [note(85, 0, .32, 160, 'triangle', .6), note(420, .28, .12, 220, 'triangle', .4)];
    case 'SELL': return [note(1046.5, 0, .18, 1046.5, 'sine', .45), note(1318.5, .07, .2, 1318.5, 'sine', .3), note(1568, .13, .25, 1568, 'sine', .2)];
    case 'PROTECT': return [note(260, 0, .06, 200, 'triangle', .6), note(523.25, .09, .22, 523.25, 'sine', .4)];
    case 'SETTLE': return [note(196, 0, .65, 196, 'triangle', .5), note(246.94, .07, .55, 246.94, 'sine', .4), note(293.66, .14, .5, 293.66, 'sine', .4), note(440, .22, .5, 440, 'sine', .3)];
    case 'ERROR': return [note(150, 0, .13, 100, 'triangle', .35)];
  }
}
export function speakeasyContinuousCue(previous: {gameId: string; revision: number} | null,
  current: {gameId: string; revision: number; cue: SpeakeasyCue}, continuouslyConnected: boolean): SpeakeasyCue | null {
  return continuouslyConnected && previous?.gameId === current.gameId && current.revision === previous.revision + 1 ? current.cue : null;
}
export function useSpeakeasyAudio() {
  const [volume, setVolume] = useState(() => {
    try {const n = Number(localStorage.getItem('speakeasy-volume') ?? '30'); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 30;}
    catch {return 30;}
  });
  const [available, setAvailable] = useState(true), context = useRef<AudioContext | null>(null);
  const mounted = useRef(true), level = useRef(volume), nodes = useRef(new Set<OscillatorNode>());
  level.current = volume;
  async function unlock(): Promise<void> {
    if (!mounted.current || level.current === 0) return;
    try {
      context.current ??= new AudioContext(); const c = context.current;
      if (c.state === 'suspended') await c.resume();
      if (mounted.current) setAvailable(c.state === 'running');
    } catch {if (mounted.current) setAvailable(false);}
  }
  function play(cue: SpeakeasyCue) {
    const c = context.current;
    if (!c || c.state !== 'running' || level.current === 0 || !mounted.current) return;
    const now = c.currentTime;
    for (const t of speakeasyTones(cue)) {
      const oscillator = c.createOscillator(), gain = c.createGain();
      oscillator.type = t.shape; oscillator.frequency.setValueAtTime(t.frequency, now + t.delay);
      oscillator.frequency.exponentialRampToValueAtTime(t.end, now + t.delay + t.duration);
      gain.gain.setValueAtTime(.0001, now + t.delay);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level.current / 100 * .12 * t.gain), now + t.delay + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, now + t.delay + t.duration);
      oscillator.connect(gain); gain.connect(c.destination); nodes.current.add(oscillator);
      oscillator.onended = () => {nodes.current.delete(oscillator); oscillator.disconnect(); gain.disconnect();};
      oscillator.start(now + t.delay); oscillator.stop(now + t.delay + t.duration + .01);
    }
  }
  function changeVolume(next: number) {
    const safe = Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 0;
    level.current = safe; setVolume(safe);
    if (safe === 0) for (const oscillator of nodes.current) oscillator.stop();
  }
  useEffect(() => {try {localStorage.setItem('speakeasy-volume', String(volume));} catch {/* Audio preference is optional when storage is unavailable. */}}, [volume]);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; const c = context.current; context.current = null;
    if (c && c.state !== 'closed') void c.close().catch(() => {/* The browser may already be closing its audio device. */});
  };}, []);
  return {volume, setVolume: changeVolume, available, unlock, play};
}
