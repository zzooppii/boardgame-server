import * as v from 'valibot';
import { arkActionStrength, ArkActionCardSchema, ArkActionKindSchema, type ArkActionCard, type ArkActionKind } from '@hangul-rummikub/shared';

const Row = v.pipe(v.array(ArkActionCardSchema), v.length(5), v.check(cards => new Set(cards.map(c => c.kind)).size === 5));
export type ArkActionStart = Readonly<{ok: true; strength: number; xRemaining: number; upgraded: boolean}> |
  Readonly<{ok: false; reason: 'INVALID_ACTION' | 'INSUFFICIENT_X' | 'INSUFFICIENT_STRENGTH'}>;
export function startArkAction(row: readonly ArkActionCard[], kind: ArkActionKind, xAvailable: number, xSpent: number, baseStrength?:number): ArkActionStart {
  const parsed = v.safeParse(Row, row), action = v.safeParse(ArkActionKindSchema, kind);
  if (!parsed.success || !action.success || !Number.isSafeInteger(xAvailable) || xAvailable < 0 || xAvailable > 5 || !Number.isSafeInteger(xSpent) || xSpent < 0) return {ok: false, reason: 'INVALID_ACTION'};
  if (xSpent > xAvailable) return {ok: false, reason: 'INSUFFICIENT_X'};
  const index = parsed.output.findIndex(card => card.kind === action.output), card = parsed.output[index]!;
  if(baseStrength!==undefined&&(!Number.isSafeInteger(baseStrength)||baseStrength<1||baseStrength>5))return {ok:false,reason:'INVALID_ACTION'};
  const strength = arkActionStrength(baseStrength??index+1,xSpent,card.constriction);
  if (strength < 1) return {ok: false, reason: 'INSUFFICIENT_STRENGTH'};
  return {ok: true, strength, xRemaining: xAvailable - xSpent, upgraded: card.upgraded};
}
/** This shift happens only after the action and its immediate effects, before after-finishing effects. */
export function finishArkAction(row: readonly ArkActionCard[], kind: ArkActionKind): ArkActionCard[] {
  const cards = v.parse(Row, row), action = v.parse(ArkActionKindSchema, kind);
  const index = cards.findIndex(card => card.kind === action), [used] = cards.splice(index, 1);
  cards.unshift({...used!, venom: false, constriction: false});
  return cards;
}
export function takeArkXToken(row: readonly ArkActionCard[], kind: ArkActionKind, xAvailable: number):
  Readonly<{ok: true; row: ArkActionCard[]; x: number}> | Readonly<{ok: false; reason: 'X_LIMIT' | 'INVALID_ACTION'}> {
  if (!Number.isSafeInteger(xAvailable) || xAvailable < 0 || xAvailable > 5) return {ok: false, reason: 'INVALID_ACTION'};
  if (xAvailable === 5) return {ok: false, reason: 'X_LIMIT'};
  if (!v.safeParse(Row, row).success || !v.safeParse(ArkActionKindSchema, kind).success) return {ok: false, reason: 'INVALID_ACTION'};
  return {ok: true, row: finishArkAction(row, kind), x: xAvailable + 1};
}
