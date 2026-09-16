import { SPEAKEASY_ROUNDS, type PlayerId } from '@hangul-rummikub/shared';

export type SpeakeasyRoundClock = Readonly<{act: 1 | 2 | 3 | 4; round: number; seat: number; order: readonly PlayerId[]}>;
export type SpeakeasyRoundTransition =
  | Readonly<{kind: 'NEXT_PLAYER'; clock: SpeakeasyRoundClock}>
  | Readonly<{kind: 'ROUND_END'; act: 1 | 2 | 3 | 4; nextRound: number}>
  | Readonly<{kind: 'LUCIANO'; act: 1 | 2 | 3}>
  | Readonly<{kind: 'FINAL_SCORING'}>;
export function nextSpeakeasyTurn(clock: SpeakeasyRoundClock): SpeakeasyRoundTransition {
  if (clock.order.length < 2 || clock.order.length > 4 || new Set(clock.order).size !== clock.order.length ||
    ![1, 2, 3, 4].includes(clock.act) || !Number.isSafeInteger(clock.round) || clock.round < 1 || clock.round > SPEAKEASY_ROUNDS[clock.act - 1]! ||
    !Number.isSafeInteger(clock.seat) || clock.seat < 0 || clock.seat >= clock.order.length) throw new Error('Invalid Speakeasy round.');
  if (clock.seat + 1 < clock.order.length) return {kind: 'NEXT_PLAYER', clock: {...clock, seat: clock.seat + 1}};
  if (clock.round < SPEAKEASY_ROUNDS[clock.act - 1]!) return {kind: 'ROUND_END', act: clock.act, nextRound: clock.round + 1};
  return clock.act === 4 ? {kind: 'FINAL_SCORING'} : {kind: 'LUCIANO', act: clock.act};
}

/** Slots on the lower row are fixed first; all other markers retain their relative order. */
export function speakeasyNextOrder(order: readonly PlayerId[], lowerRow: readonly (PlayerId | null)[]): readonly PlayerId[] {
  const moved = lowerRow.filter((id): id is PlayerId => id !== null);
  if (order.length < 2 || order.length > 4 || order.length !== lowerRow.length || new Set(order).size !== order.length ||
    new Set(moved).size !== moved.length || moved.some(id => !order.includes(id))) throw new Error('Invalid Speakeasy turn order.');
  const waiting = order.filter(id => !moved.includes(id));
  return lowerRow.map(id => id ?? waiting.shift()!);
}
