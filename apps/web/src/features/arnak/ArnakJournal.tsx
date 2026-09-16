import { useId, useState } from 'react';
import type { ArnakProjection } from '@hangul-rummikub/shared';

type History = ArnakProjection['history'];
export function filterArnakHistory(history: Readonly<History>, round: string, player: string) {
    return history.filter(entry => (!round || String(entry.round) === round) && (!player || entry.playerId === player)).reverse();
}

export function ArnakJournal({ history, players }: {
    history: Readonly<History>; players: readonly { playerId: string; nickname: string }[];
}) {
    const [round, setRound] = useState(''), [player, setPlayer] = useState(''), [limit, setLimit] = useState(15);
    const id = useId(), filtered = filterArnakHistory(history, round, player), shown = filtered.slice(0, limit);
    const rounds = [...new Set(history.map(entry => entry.round))].sort((a, b) => b - a);
    function reset() { setRound(''); setPlayer(''); setLimit(15); }
    return <details className="ar-log ar-journal"><summary>탐험 기록 · {history.length}건</summary>
        <p>최신 행동부터 표시합니다. 최근 기록은 최대 120건까지 볼 수 있습니다.</p>
        <div className="ar-journal-filters"><label htmlFor={`${id}-round`}>라운드<select id={`${id}-round`} value={round} onChange={event => { setRound(event.target.value); setLimit(15); }}><option value="">전체 라운드</option>{rounds.map(value => <option key={value} value={String(value)}>라운드 {value}</option>)}{round && !rounds.includes(Number(round)) && <option value={round}>라운드 {round}</option>}</select></label>
            <label htmlFor={`${id}-player`}>탐험가<select id={`${id}-player`} value={player} onChange={event => { setPlayer(event.target.value); setLimit(15); }}><option value="">모든 탐험가</option>{players.map(value => <option key={value.playerId} value={value.playerId}>{value.nickname}</option>)}</select></label>
            {(round || player) && <button type="button" onClick={reset}>전체 기록 보기</button>}
        </div>
        <p role="status">{filtered.length}건 중 {shown.length}건 표시</p>
        {shown.length ? <ol>{shown.map(entry => <li key={entry.id}><small>R{entry.round} · {players.find(value => value.playerId === entry.playerId)?.nickname ?? '탐험가'}</small><span>{entry.text}</span></li>)}</ol> : <p className="ar-muted">{history.length ? '조건에 맞는 탐험 기록이 없습니다.' : '아직 탐험 기록이 없습니다.'}</p>}
        {shown.length < filtered.length && <button type="button" onClick={() => setLimit(value => value + 15)}>이전 기록 더 보기 · {filtered.length - shown.length}건 남음</button>}
    </details>;
}
