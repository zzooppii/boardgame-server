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
  private voices = new Map<OscillatorNode, GainNode>();
  private resuming: Promise<void> | null = null;
  private pendingCue: ArkCue | null = null;
  private preferences: ArkSoundPreferences = {enabled: false, volume: .45};
  private lastCueAt = new Map<ArkCue, number>();
  constructor(private readonly factory: () => AudioContext | null = () => typeof AudioContext === 'undefined' ? null : new AudioContext()) {}
  setPreferences(preferences: ArkSoundPreferences): void {
    this.preferences = {enabled:preferences.enabled,volume:Number.isFinite(preferences.volume)?Math.max(0,Math.min(1,preferences.volume)):0};
    if(!this.preferences.enabled||this.preferences.volume===0)this.stop();
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.preferences.enabled ? this.preferences.volume * .18 : 0, this.context.currentTime, .015);
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
      if (this.context.state !== 'running' && this.context.state !== 'closed' && !this.resuming) {
        const context=this.context;
        this.resuming=context.resume().then(()=>{
          if(this.context!==context)return;
          this.resuming=null;
          const cue=this.pendingCue;this.pendingCue=null;
          if(cue)this.play(cue);
        },()=>{if(this.context===context){this.resuming=null;this.pendingCue=null;}});
      }
    } catch { this.dispose(); }
  }
  play(cue: ArkCue): void {
    if (!this.preferences.enabled || this.preferences.volume === 0) return;
    this.unlock();
    const c = this.context, master = this.master;
    if (!c || !master) return;
    if(c.state!=='running') {
      if(!this.pendingCue||cue==='CONSERVATION'||cue==='ARRIVAL'||cue==='PLACE'||cue==='ERROR')this.pendingCue=cue;
      return;
    }
    // Debounce repeats of the same cue; a selection click must not swallow a server-confirmed arrival.
    const last=this.lastCueAt.get(cue),cooldown=['CONSERVATION','ARRIVAL','PLACE'].includes(cue) ? .18 : .06;
    if(last!==undefined&&c.currentTime-last<cooldown)return;
    this.lastCueAt.set(cue,c.currentTime);
    if(this.voices.size>=12)this.stop();
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
      this.voices.set(oscillator,gain);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(at); oscillator.stop(at + duration + .01);
    }
  }
  stop(): void {
    this.pendingCue=null;
    for (const [voice,gain] of this.voices) { voice.onended=null;voice.stop();voice.disconnect();gain.disconnect(); }
    this.voices.clear();
  }
  dispose(): void {
    this.stop();this.resuming=null;this.master?.disconnect(); this.master = null;
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = null; this.lastCueAt.clear();
  }
}
