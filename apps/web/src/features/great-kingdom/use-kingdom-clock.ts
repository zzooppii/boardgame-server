import {useEffect, useState} from 'react';
export function useKingdomClock(serverTime: number, deadline: number | null) {
  const [elapsed, setElapsed] = useState({serverTime, deadline, value: 0});
  useEffect(() => {
    const start = performance.now();
    setElapsed({serverTime, deadline, value: 0});
    if (deadline === null) return;
    const timer = window.setInterval(() => setElapsed({serverTime, deadline, value: performance.now() - start}), 200);
    return () => window.clearInterval(timer);
  }, [serverTime, deadline]);
  const delta = elapsed.serverTime === serverTime && elapsed.deadline === deadline ? elapsed.value : 0;
  const seconds = deadline === null ? null : Math.max(0, Math.ceil((deadline - serverTime - delta) / 1000));
  return {seconds, expired: seconds === 0};
}
