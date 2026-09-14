export type ArkCue = 'SELECT' | 'ROTATE' | 'PLACE' | 'UNDO' | 'CARD' | 'ERROR' | 'ARRIVAL' | 'CONSERVATION';
export type ArkSoundPreferences = Readonly<{enabled: boolean; volume: number}>;
const preferenceKey = 'ark-nova.sound.v1';
export function readArkSoundPreferences(storage?: Pick<Storage, 'getItem'>): ArkSoundPreferences {
  try {
    const value: unknown = JSON.parse(storage?.getItem(preferenceKey) ?? 'null');
    if (typeof value === 'object' && value !== null && 'enabled' in value && 'volume' in value &&
      typeof value.enabled === 'boolean' && typeof value.volume === 'number' && Number.isFinite(value.volume)) {
      return {enabled: value.enabled, volume: Math.max(0, Math.min(1, value.volume))};
    }
  } catch { /* Storage may be unavailable in private browsing. Audio remains opt-in. */ }
  return {enabled: false, volume: .45};
}
export function saveArkSoundPreferences(value: ArkSoundPreferences, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(preferenceKey, JSON.stringify(value)); } catch { /* Preference persistence is optional. */ }
}

/** Synthesized paper/wood cues; no network audio, autoplay, microphone or external assets. */
export class ArkAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<OscillatorNode>();
  private preferences: ArkSoundPreferences = {enabled: false, volume: .45};
  private lastCueAt = -1;
  constructor(private readonly factory: () => AudioContext | null = () => typeof AudioContext === 'undefined' ? null : new AudioContext()) {}
  setPreferences(preferences: ArkSoundPreferences): void {
    this.preferences = preferences;
    if (this.master && this.context) this.master.gain.setTargetAtTime(preferences.enabled ? preferences.volume * .18 : 0, this.context.currentTime, .015);
  }
  unlock(): void {
    if (!this.preferences.enabled) return;
    try {
      if (!this.context) {
        this.context = this.factory();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.master.gain.value = this.preferences.volume * .18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { this.dispose(); }
  }
  play(cue: ArkCue): void {
    if (!this.preferences.enabled || this.preferences.volume === 0) return;
    this.unlock();
    const c = this.context, master = this.master;
    if (!c || !master || c.state !== 'running' || c.currentTime - this.lastCueAt < .035) return;
    this.lastCueAt = c.currentTime;
    const notes: readonly (readonly [number, number, number])[] = cue === 'CONSERVATION' ? [[523,0,.24],[659,.10,.25],[784,.20,.28],[1047,.32,.4]] :
      cue === 'ARRIVAL' ? [[392,0,.14],[587,.12,.18],[784,.24,.26]] : cue === 'PLACE' ? [[180, 0, .1], [440, .045, .14], [660, .085, .18]] :
      cue === 'CARD' ? [[900, 0, .025], [610, .035, .04]] : cue === 'ROTATE' ? [[360, 0, .06]] :
      cue === 'UNDO' ? [[420, 0, .07], [300, .06, .1]] : cue === 'ERROR' ? [[160, 0, .09], [130, .09, .09]] : [[520, 0, .045]];
    for (const [hz, delay, duration] of notes) {
      const oscillator = c.createOscillator(), gain = c.createGain(), at = c.currentTime + delay;
      oscillator.type = cue === 'ERROR'||cue==='CONSERVATION'||cue==='ARRIVAL' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(hz, at);
      oscillator.frequency.exponentialRampToValueAtTime(hz * (cue==='CONSERVATION'||cue==='ARRIVAL'?1:.65), at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.32, at + .005);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain); gain.connect(master);
      this.voices.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(at); oscillator.stop(at + duration + .01);
    }
  }
  dispose(): void {
    for (const voice of this.voices) { voice.onended = null; voice.stop(); voice.disconnect(); }
    this.voices.clear(); this.master?.disconnect(); this.master = null;
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = null; this.lastCueAt = -1;
  }
}
