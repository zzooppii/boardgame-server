import {useRef, useState} from 'react';
import {safeParse} from 'valibot';
import {PROTOCOL_VERSION, GreatKingdomSettingsSchema, GREAT_KINGDOM_DIFFICULTY_LABELS, type GreatKingdomClientCommand, type GreatKingdomSettings} from '@hangul-rummikub/shared';
import type {GreatKingdomWebSnapshot} from '../../lib/snapshot-wire-decoder.js';
import {createRequestId} from '../../lib/request-id.js';
import {GreatKingdomCommandRejected} from '../../lib/great-kingdom-command-error.js';
type Props = {snapshot: GreatKingdomWebSnapshot; connected: boolean; pending: boolean; onCommand(c: GreatKingdomClientCommand): Promise<void>; onBusy(busy: boolean): void};
export function KingdomSettings({snapshot: s, connected, pending, onCommand, onBusy}: Props) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<GreatKingdomClientCommand | null>(null), inFlight = useRef(false);
  const host = s.room.players.some(p => p.playerId === s.self.playerId && p.isHost), settings = s.room.settings;
  const disabled = !host || !connected || pending || busy || retry !== null;
  async function send(command: GreatKingdomClientCommand) {
    if(inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusy(true); setError(null);
    let uncertain = false;
    try {await onCommand(command); setRetry(null);}
    catch(e) {uncertain = !(e instanceof GreatKingdomCommandRejected); setError(e instanceof Error ? e.message : '설정을 저장하지 못했습니다.'); setRetry(e instanceof GreatKingdomCommandRejected ? null : command);}
    finally {inFlight.current = false; setBusy(false); onBusy(uncertain);}
  }
  function change(value: GreatKingdomSettings) {
    const parsed = safeParse(GreatKingdomSettingsSchema, value);
    if(disabled || !parsed.success) return;
    void send({kind:'greatKingdom:configure',protocolVersion:PROTOCOL_VERSION,requestId:createRequestId(),expectedRoomRevision:s.versions.roomRevision,payload:parsed.output});
  }
  return <section className="gk-settings" aria-label="대국 설정"><div><span className="gk-eyebrow">MATCH SETTINGS</span><h3>어떤 상대와 겨룰까요?</h3><p>{host ? '방장이 설정하며 모든 참가자에게 동일하게 적용됩니다.' : '방장이 선택한 대국 설정입니다.'}</p></div>
    <div className="gk-opponents"><button type="button" aria-pressed={settings.opponent === 'HUMAN'} disabled={disabled} onClick={() => change({opponent:'HUMAN',turnSeconds:0})}><strong>친구와 대전</strong><span>두 사람의 전략 대결</span></button>{(['EASY','MEDIUM','HARD'] as const).map(level => <button key={level} type="button" aria-pressed={settings.opponent === level} disabled={disabled || s.room.players.length !== 1} onClick={() => change({opponent:level,turnSeconds:0})}><strong>AI {GREAT_KINGDOM_DIFFICULTY_LABELS[level]}</strong><span>{level === 'EASY' ? '가볍게 익히는 왕국 건설' : level === 'MEDIUM' ? '공격과 방어를 함께' : '다음 수까지 읽는 상대'}</span></button>)}</div>
    {s.room.players.length > 1 && <p>AI 대전은 방에 혼자 있을 때 선택할 수 있습니다.</p>}
    {settings.opponent === 'HUMAN' ? <label className="gk-time-setting">한 차례 제한 시간<select aria-label="한 차례 제한 시간" value={settings.turnSeconds} disabled={disabled} onChange={e => {const parsed = safeParse(GreatKingdomSettingsSchema,{...settings,turnSeconds:Number(e.target.value)}); if(parsed.success) change(parsed.output);}}>{[0,60,120,180,300].map(seconds => <option key={seconds} value={seconds}>{seconds ? `${seconds}초` : '제한 없음'}</option>)}</select><small>시간이 끝나면 자동 패스 · 연속 두 번 패스하면 영토 계산</small></label> : <p>AI 대전은 시간 제한이 없습니다. 충분히 생각하고 수를 놓으세요.</p>}
    <div role="status">{busy ? '설정 저장 중…' : ''}</div>{error && <p className="gk-error" role="alert">{error}</p>}{retry && <button type="button" disabled={busy || !connected} onClick={() => void send(retry)}>설정 저장 결과 재확인</button>}
  </section>;
}
