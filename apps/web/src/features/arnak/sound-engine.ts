export type ArnakCue = 'SELECT' | 'CARD' | 'DIG' | 'DISCOVER' | 'BUY' | 'RESEARCH' | 'GUARDIAN' | 'TURN' | 'WIN' | 'ERROR';
type Tone = { frequency: number; end?: number; delay: number; duration: number; gain: number; wave?: OscillatorType };
type Texture = { frequency: number; delay: number; duration: number; gain: number; filter: BiquadFilterType };
type Score = { tones: readonly Tone[]; textures: readonly Texture[] };
const notes = (frequencies: number[], duration: number, step: number, gain = .12): Tone[] => frequencies.map((frequency, i) => ({ frequency, delay: i * step, duration, gain, wave: 'triangle' }));
/** Short, layered sounds: paper, soil, metal and resonant stone. */
export const ARNAK_SOUND_SCORES: Record<ArnakCue, Score> = {
    SELECT: { tones: [{ frequency: 680, end: 360, delay: 0, duration: .045, gain: .12 }], textures: [] },
    CARD: { tones: [], textures: [{ frequency: 1700, filter: 'highpass', delay: 0, duration: .11, gain: .18 }, { frequency: 900, filter: 'bandpass', delay: .065, duration: .09, gain: .16 }] },
    DIG: { tones: [{ frequency: 130, end: 48, delay: 0, duration: .19, gain: .3 }], textures: [{ frequency: 650, filter: 'lowpass', delay: .025, duration: .22, gain: .5 }] },
    BUY: { tones: [{ frequency: 1568, delay: 0, duration: .24, gain: .16 }, { frequency: 2352, delay: .045, duration: .3, gain: .08 }, { frequency: 3136, delay: .045, duration: .16, gain: .04 }], textures: [{ frequency: 2400, filter: 'bandpass', delay: 0, duration: .025, gain: .1 }] },
    RESEARCH: { tones: notes([392, 587.33, 783.99], .45, .105), textures: [{ frequency: 480, filter: 'lowpass', delay: 0, duration: .15, gain: .2 }] },
    GUARDIAN: { tones: [{ frequency: 100, end: 38, delay: 0, duration: .5, gain: .3 }, ...notes([293.66, 440, 587.33], .55, .15)], textures: [{ frequency: 300, filter: 'lowpass', delay: 0, duration: .4, gain: .3 }] },
    DISCOVER: { tones: notes([196, 293.66, 392, 493.88], .65, .11), textures: [{ frequency: 900, filter: 'bandpass', delay: 0, duration: .35, gain: .13 }] },
    TURN: { tones: notes([440, 659.25], .23, .14, .11), textures: [] },
    WIN: { tones: notes([261.63, 329.63, 392, 523.25, 659.25], .8, .14), textures: [] },
    ERROR: { tones: [{ frequency: 160, end: 95, delay: 0, duration: .16, gain: .13, wave: 'triangle' }], textures: [] }
};
export function arnakVolume(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 30; }
/** Render one cue into a caller-owned bus; works with real-time and offline Web Audio. */
export function scheduleArnakCue(context: BaseAudioContext, output: AudioNode, cue: ArnakCue): () => void {
    const sources: AudioScheduledSourceNode[] = [], nodes: AudioNode[] = [];
    const start = context.currentTime + .005;
    let remaining = 0, released = false;
    function release() { if (released) return; released = true; for (const node of nodes) node.disconnect(); }
    function envelope(delay: number, duration: number, level: number) {
        const gain = context.createGain(), at = start + delay;
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + Math.min(.012, duration / 4));
        gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
        gain.connect(output); nodes.push(gain); return gain;
    }
    function run(source: AudioScheduledSourceNode, delay: number, duration: number) {
        sources.push(source); nodes.push(source); remaining++;
        source.onended = () => { if (--remaining === 0) release(); };
        source.start(start + delay); source.stop(start + delay + duration + .01);
    }
    const score = ARNAK_SOUND_SCORES[cue];
    for (const t of score.tones) {
        const oscillator = context.createOscillator(); oscillator.type = t.wave ?? 'sine';
        oscillator.frequency.setValueAtTime(t.frequency, start + t.delay);
        oscillator.frequency.exponentialRampToValueAtTime(t.end ?? t.frequency, start + t.delay + t.duration);
        oscillator.connect(envelope(t.delay, t.duration, t.gain)); run(oscillator, t.delay, t.duration);
    }
    for (const t of score.textures) {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * (t.duration + .02)), context.sampleRate);
        const data = buffer.getChannelData(0);
        // Reproducible noise avoids random behavior in rendering and verification.
        let seed = 7919;
        for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
        const source = context.createBufferSource(), filter = context.createBiquadFilter();
        source.buffer = buffer; filter.type = t.filter; filter.frequency.value = t.frequency; filter.Q.value = .7;
        source.connect(filter); filter.connect(envelope(t.delay, t.duration, t.gain)); nodes.push(filter); run(source, t.delay, t.duration);
    }
    return () => { if (released) return; for (const source of sources) source.stop(); release(); };
}
