import { useEffect, useRef, useState } from 'react';

export function duelSecondsRemaining(deadlineAt: number, serverTime: number, elapsedMs: number): number {
    return Math.max(0, Math.ceil((deadlineAt - serverTime - Math.max(0, elapsedMs)) / 1000));
}
export function TurnTimer({ deadlineAt, serverTime, connected }: { deadlineAt: number | null; serverTime: number; connected: boolean }) {
    const sample = useRef({ serverTime, receivedAt: performance.now() });
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => { sample.current = { serverTime, receivedAt: performance.now() }; setNow(performance.now()); }, [serverTime]);
    useEffect(() => { if (deadlineAt === null) return; const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, [deadlineAt]);
    if (deadlineAt === null) return <span className="du-turn-timer">◷ 시간 제한 없음</span>;
    const seconds = duelSecondsRemaining(deadlineAt, sample.current.serverTime, now - sample.current.receivedAt);
    return <span className={`du-turn-timer ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-live="off" aria-label={`선택 제한시간 ${seconds}초 남음`}>
        <b>◷ {seconds}초</b><small>{!connected ? '재접속 중에도 시간은 흐릅니다' : seconds === 0 ? '서버 자동 진행 대기' : '연속 효과는 남은 시간 공유'}</small>
    </span>;
}
