import { useState } from "react";
import {
  CARCASSONNE_DEFAULT_SETTINGS,
  carcassonneTileCount,
  PROTOCOL_VERSION,
  type CarcassonneClientCommand,
} from "@hangul-rummikub/shared";
import type { CarcassonneWebSnapshot } from "../../lib/snapshot-wire-decoder.js";
import { createRequestId } from "../../lib/request-id.js";
import { CarcassonneTileArt } from "./art.js";
export function ExpansionSettings({
  snapshot,
  disabled,
  onCommand,
  onBusy,
}: {
  snapshot: CarcassonneWebSnapshot;
  disabled: boolean;
  onCommand(c: CarcassonneClientCommand): Promise<void>;
  onBusy(busy: boolean): void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const settings = snapshot.room.settings ?? CARCASSONNE_DEFAULT_SETTINGS;
  const host = snapshot.room.players.some(
    (p) => p.playerId === snapshot.self.playerId && p.isHost,
  );
  async function toggle(key: keyof typeof settings) {
    if (busy || disabled || !host) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onCommand({
        kind: "carcassonne:configure",
        protocolVersion: PROTOCOL_VERSION,
        requestId: createRequestId(),
        expectedRoomRevision: snapshot.versions.roomRevision,
        payload: { ...settings, [key]: !settings[key] },
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "확장 설정을 저장하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="cc-expansion-settings" aria-label="확장판 선택">
      <div className="cc-expansion-heading">
        <div>
          <span className="cc-eyebrow">A BIGGER WORLD</span>
          <h3>우리 지도의 다음 이야기</h3>
        </div>
        <b>{carcassonneTileCount(settings)}장</b>
      </div>
      <p>
        {host
          ? "확장을 각각 켜거나 함께 사용하세요."
          : "방장이 선택한 확장으로 함께 플레이합니다."}
      </p>
      {(
        [
          {
            key: "innsAndCathedrals",
            title: "여관과 성당",
            tile: "EK",
            description: "타일 18장 · 큰 미플 1개",
            detail: "여관 도로 2배, 성당 도시 3배. 완성하지 못하면 0점!",
          },
          {
            key: "tradersAndBuilders",
            title: "상인과 건축가",
            tile: "HG",
            description: "타일 24장 · 건축가 · 돼지 · 상품",
            detail: "건축가의 추가 턴, 돼지의 들판 보너스와 상품 경쟁.",
          },
        ] as const
      ).map((item) => (
        <button
          key={item.key}
          type="button"
          className="cc-expansion-card"
          aria-pressed={settings[item.key]}
          disabled={disabled || busy || !host}
          onClick={() => void toggle(item.key)}
        >
          <CarcassonneTileArt kind={item.tile} />
          <span>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
            <span>{item.detail}</span>
          </span>
          <b>{settings[item.key] ? "사용" : "꺼짐"}</b>
        </button>
      ))}
      {error && (
        <p role="alert" className="cc-error">
          {error}
        </p>
      )}
    </section>
  );
}
