import {useEffect, useRef, useState} from 'react';
import type {GreatKingdomProjection, PlayerId} from '@hangul-rummikub/shared';
export type KingdomCue = 'SELECT' | 'CANCEL' | 'PLACE' | 'TERRITORY' | 'PASS' | 'TURN' | 'SIEGE' | 'WIN' | 'LOSS' | 'ERROR' | 'DRAW';
export type KingdomSoundFrame = {gameId: string; revision: number; territory: number};
export function kingdomNewCue(previous: KingdomSoundFrame | null, g: GreatKingdomProjection, continuous: boolean, selfId: PlayerId): KingdomCue | null {
  if (!continuous || !previous || previous.gameId !== g.gameId || g.gameRevision !== previous.revision + 1) return null;
  if (g.phase === 'FINISHED') return g.result.reason === 'CANCELLED' ? null : g.result.reason === 'SIEGE' ? 'SIEGE' : g.result.winnerPlayerIds.length === 0 ? 'DRAW' : g.result.winnerPlayerIds.includes(selfId) ? 'WIN' : 'LOSS';
  if (g.history.at(-1)?.kind === 'PASS') return 'PASS';
  if (g.playerStates.reduce((n, p) => n + p.territory, 0) > previous.territory) return 'TERRITORY';
  return 'PLACE';
}
export function useKingdomSound(g: GreatKingdomProjection | null, connected: boolean, selfId: PlayerId) {
  const [volume, setVolume] = useState(() => {try {const n = Number(localStorage.getItem('great-kingdom-volume') ?? '35'); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 35;} catch {return 35;}});
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null), level = useRef(volume), previous = useRef<KingdomSoundFrame | null>(null), online = useRef(false);
  level.current = volume;
  function play(cue: KingdomCue) {
    const c = audio.current; if (!c || c.state !== 'running' || level.current === 0) return;
    const now = c.currentTime, amplitude = level.current * .001;
    function tone(f: number, offset: number, duration: number, type: OscillatorType = 'sine', end = f) {
      if (!c) return;
      const osc = c.createOscillator(), gain = c.createGain(); osc.type = type;
      osc.frequency.setValueAtTime(f, now + offset); osc.frequency.exponentialRampToValueAtTime(end, now + offset + duration);
      gain.gain.setValueAtTime(.0001, now + offset); gain.gain.exponentialRampToValueAtTime(amplitude, now + offset + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      osc.connect(gain); gain.connect(c.destination); osc.start(now + offset); osc.stop(now + offset + duration + .01);
      osc.onended = () => {osc.disconnect(); gain.disconnect();};
    }
    function stone() {
      const buffer = c!.createBuffer(1, Math.ceil(c!.sampleRate * .055), c!.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.sin(i * 12.9898) + Math.sin(i * 7.131)) * .3;
      const source = c!.createBufferSource(), filter = c!.createBiquadFilter(), gain = c!.createGain(); source.buffer = buffer;
      filter.type = 'lowpass'; filter.frequency.value = 1550; gain.gain.setValueAtTime(amplitude * .8, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .055);
      source.connect(filter); filter.connect(gain); gain.connect(c!.destination); source.start();
      source.onended = () => {source.disconnect(); filter.disconnect(); gain.disconnect();};
    }
    if (cue === 'PLACE' || cue === 'TERRITORY' || cue === 'SIEGE') {stone(); tone(260, 0, .14, 'triangle', 110);}
    if (cue === 'TERRITORY') [660, 880, 1100].forEach((f, i) => tone(f, .12 + i * .055, .22));
    if (cue === 'SIEGE') {tone(120, .06, .5, 'triangle', 45); [392, 523, 659].forEach((f, i) => tone(f, .35 + i * .1, .4, 'triangle'));}
    if (cue === 'WIN') [392, 523, 659, 784].forEach((f, i) => tone(f, i * .11, .38, 'triangle'));
    if (cue === 'DRAW') {tone(440, 0, .22); tone(440, .22, .28);}
    if (cue === 'LOSS') {tone(330, 0, .22); tone(262, .18, .32);}
    if (cue === 'PASS') {tone(480, 0, .14); tone(360, .1, .18);}
    if (cue === 'TURN') {tone(740, 0, .12); tone(880, .1, .16);}
    if (cue === 'SELECT') tone(920, 0, .07, 'sine', 680);
    if (cue === 'CANCEL') tone(440, 0, .075, 'sine', 300);
    if (cue === 'ERROR') tone(170, 0, .14, 'triangle', 125);
  }
  async function unlock() {try {audio.current ??= new AudioContext(); const c = audio.current; if (c.state !== 'running') await c.resume(); if (audio.current === c) setEnabled(c.state === 'running');} catch {setEnabled(false);}}
  useEffect(() => {try {localStorage.setItem('great-kingdom-volume', String(volume));} catch {/* Device preference is optional in private browsing. */}}, [volume]);
  useEffect(() => {
    if (g) {const cue = kingdomNewCue(previous.current, g, connected && online.current, selfId); if (cue) play(cue);
      previous.current = {gameId: g.gameId, revision: g.gameRevision, territory: g.playerStates.reduce((n, p) => n + p.territory, 0)};
    } else previous.current = null;
    online.current = connected;
  }, [g?.gameId, g?.gameRevision, connected]);
  useEffect(() => () => {const c = audio.current; audio.current = null; if (c) void c.close().catch(() => { /* Browser may have already disposed the context. */ });}, []);
  return {volume, setVolume, enabled, unlock, play};
}
