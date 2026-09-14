import { useRef, useState } from 'react';
import { PROTOCOL_VERSION, TRAIN_MAP_OPTIONS, type TrainClientCommand, type TrainMapId } from '@hangul-rummikub/shared';
import type { TrainWebSnapshot } from '../../lib/snapshot-wire-decoder.js';
import { createRequestId } from '../../lib/request-id.js';

export function TrainMapPicker({ snapshot, disabled, onCommand, onPick }: {
    snapshot: TrainWebSnapshot;
    disabled: boolean;
    onCommand(command: TrainClientCommand): Promise<void>;
    onPick(): void;
}) {
    const [sending, setSending] = useState(false), [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const mapId = snapshot.room.settings?.mapId ?? 'USA';
    const host = snapshot.room.players.find(player => player.playerId === snapshot.self.playerId)?.isHost;
    async function select(next: TrainMapId) {
        if (!host || disabled || inFlight.current || next === mapId || snapshot.room.phase !== 'LOBBY') return;
        inFlight.current = true;
        setSending(true);
        setError(null);
        try {
            await onCommand({ kind: 'train:configure', protocolVersion: PROTOCOL_VERSION, requestId: createRequestId(), expectedRoomRevision: snapshot.versions.roomRevision, payload: { mapId: next } });
            onPick();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '지도 설정을 확인하지 못했습니다. 다시 시도해주세요.');
        } finally {
            inFlight.current = false;
            setSending(false);
        }
    }
    return <section className="tr-map-picker" aria-label="여행 지도 선택">
        <div className="tr-section-title"><div><span className="tr-eyebrow">CHOOSE YOUR JOURNEY</span><h2>어디로 떠날까요?</h2></div><span>{host ? '방장이 지도를 선택합니다' : '방장의 지도 선택을 기다립니다'}</span></div>
        <div className="tr-map-options">{TRAIN_MAP_OPTIONS.map(map => <button type="button" key={map.mapId} className="tr-map-option" aria-pressed={map.mapId === mapId} disabled={disabled || sending || !host || !map.available || map.mapId === mapId} onClick={() => void select(map.mapId)}>
            <img src={map.image} alt="" loading="lazy"/>
            <div className="tr-map-option-copy"><span className="tr-map-badge">{map.mapId === mapId ? '✓ 선택한 지도' : map.available ? '지도 선택' : '준비 중'}</span><h3>{map.label}</h3><p>{map.subtitle}</p><div className="tr-map-tags">{map.rules.map(rule => <span key={rule}>{rule}</span>)}</div></div>
        </button>)}</div>
        <p className="tr-muted">지도는 게임 시작 전에 선택할 수 있습니다. 지도를 바꾸면 참가자의 준비 상태가 해제됩니다.</p>
        {error ? <p role="alert" className="tr-error">{error}</p> : null}
    </section>;
}
