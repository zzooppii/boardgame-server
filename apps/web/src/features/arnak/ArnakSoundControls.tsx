import { useRef } from 'react';
import type { ArnakCue } from './sound-engine.js';
const samples: readonly { cue: ArnakCue; label: string }[] = [
    { cue: 'CARD', label: '카드 넘김' }, { cue: 'DIG', label: '발굴' },
    { cue: 'BUY', label: '구매' }, { cue: 'DISCOVER', label: '유적 발견' }
];
export function ArnakSoundControls({ volume, setVolume, unlock, play }: {
    volume: number; setVolume(value: number): void; unlock(): Promise<void>; play(cue: ArnakCue): void;
}) {
    const lastAudible = useRef(volume || 30);
    if (volume > 0) lastAudible.current = volume;
    return <details className="ar-sound-controls"><summary>♫ 소리{volume === 0 ? ' 꺼짐' : ''}</summary>
        <label>효과음 {volume}%<input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))}/></label>
        <button type="button" aria-pressed={volume === 0} onClick={() => setVolume(volume ? 0 : lastAudible.current)}>{volume ? '음소거' : '소리 켜기'}</button>
        <p>소리 미리 듣기</p><div className="ar-sound-samples">{samples.map(sample => <button type="button" key={sample.cue} disabled={!volume} onClick={() => void unlock().then(() => play(sample.cue))}>{sample.label}</button>)}</div>
        <small>{volume ? '다른 탭을 보는 동안에는 효과음이 멈춥니다.' : '소리를 켜면 미리 들을 수 있습니다.'}</small>
    </details>;
}
