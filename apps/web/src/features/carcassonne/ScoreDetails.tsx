import {
  CARCASSONNE_FEATURE_LABELS,
  type CarcassonneScoreEvent,
} from "@hangul-rummikub/shared";
import { scoreEventFormula } from "./scoring.js";
export function ScoreDetails({
  playerName,
  events,
  selectedId,
  nickname,
  onSelect,
  onClose,
}: {
  playerName: string;
  events: readonly CarcassonneScoreEvent[];
  selectedId: string;
  nickname(id: string): string;
  onSelect(id: string): void;
  onClose(): void;
}) {
  const selected = events.find((e) => e.featureId === selectedId);
  if (!selected) return null;
  return (
    <section className="cc-score-details" aria-label="최종 점수 근거">
      <div className="cc-inspector-head">
        <div>
          <span className="cc-eyebrow">FOLLOW THE POINTS</span>
          <h3>
            {playerName} · {CARCASSONNE_FEATURE_LABELS[selected.kind]} +
            {events.reduce((n, e) => n + e.points, 0)}점
          </h3>
        </div>
        <button type="button" onClick={onClose}>
          점수 상세 닫기
        </button>
      </div>
      <div className="cc-score-features" aria-label="정산 영역 선택">
        {events.map((e, i) => (
          <button
            key={e.featureId}
            type="button"
            aria-pressed={selectedId === e.featureId}
            onClick={() => onSelect(e.featureId)}
          >
            {CARCASSONNE_FEATURE_LABELS[e.kind]} {i + 1} <b>+{e.points}점</b>
          </button>
        ))}
      </div>
      <p className="cc-score-formula">{scoreEventFormula(selected)}</p>
      <p>
        {selected.winnerPlayerIds.map(nickname).join(" · ")}
        {selected.winnerPlayerIds.length > 1
          ? " 공동 최다 점유 · 각자 전체 점수를 받습니다."
          : " 최다 점유 · 전체 점수를 받습니다."}
      </p>
      <p className="cc-score-legend">
        <span>▧ 선택한 영역</span>
        {selected.kind === "FIELD" && (
          <span>◆ 점수에 포함된 완성 도시 · 같은 도시는 한 번만 계산</span>
        )}
      </p>
    </section>
  );
}
