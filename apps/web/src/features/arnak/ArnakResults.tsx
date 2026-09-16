import type { ArnakProjection } from '@hangul-rummikub/shared';

type Result = Extract<ArnakProjection, { phase: 'FINISHED' }>['result'];
const scoreRows = [
    ['research', '연구'], ['temple', '사원 타일'], ['guardians', '수호자'],
    ['idols', '우상'], ['slots', '미사용 우상 슬롯'], ['cards', '카드'], ['fear', '공포 감점'],
] as const;
export function ArnakResults({ result, players, self, isHost, disabled, onRematch }: {
    result: Result; players: readonly { playerId: string; nickname: string }[];
    self: string; isHost: boolean; disabled: boolean; onRematch(): void;
}) {
    const name = (id: string) => players.find(player => player.playerId === id)?.nickname ?? '탐험가';
    const scored = result.reason === 'SCORED';
    const winner = (id: string) => scored && result.winnerPlayerIds.some(playerId => playerId === id);
    return <section className="ar-results ar-expedition-results" aria-label="탐험 결과">
        <span className="ar-kicker">THE EXPEDITION RETURNS</span>
        <h2>{scored ? `${result.winnerPlayerIds.map(name).join(' · ')}의 승리` : '탐험이 중단되었습니다'}</h2>
        {scored ? <><div className="ar-result-cards">{result.scores.map(score => <article key={score.playerId} className={winner(score.playerId) ? 'ar-result-winner' : ''}>
            <span className="ar-result-badge">{winner(score.playerId) ? '★ 승리' : '탐험 완료'}{score.playerId === self ? ' · 나' : ''}</span>
            <h3>{name(score.playerId)}</h3><b>{score.total}<small> VP</small></b>
        </article>)}</div>
            <details className="ar-score-details"><summary>점수 내역 비교</summary>
                <div className="ar-score-scroll" role="region" aria-label="플레이어별 점수 비교" tabIndex={0}><table>
                    <caption>항목별 최종 점수 · 공포는 감점으로 표시됩니다</caption>
                    <thead><tr><th scope="col">점수 항목</th>{result.scores.map(score => <th scope="col" key={score.playerId}>{name(score.playerId)}{score.playerId === self && <small>나</small>}</th>)}</tr></thead>
                    <tbody>{scoreRows.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{result.scores.map(score => <td key={score.playerId} className={key === 'fear' && score.fear ? 'ar-score-penalty' : ''}>{key === 'fear' && score.fear ? `−${score.fear}` : score[key]}</td>)}</tr>)}</tbody>
                    <tfoot><tr><th scope="row">총점</th>{result.scores.map(score => <td key={score.playerId}>{score.total}</td>)}</tr></tfoot>
                </table></div>
                <p>총점이 같아도 승자는 동점 판정에 따라 달라질 수 있습니다.</p>
            </details></> : <p>중단된 탐험은 승자를 정하지 않습니다.</p>}
        {isHost ? <button className="ar-primary" onClick={onRematch} disabled={disabled}>새로운 탐험 준비 →</button> : <p className="ar-muted">방장이 새로운 탐험을 준비할 수 있습니다.</p>}
    </section>;
}
