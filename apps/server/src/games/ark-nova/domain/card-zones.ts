import type { ArkCard } from '@hangul-rummikub/shared';

export type ArkCardZones = {
  zooDeck: ArkCard[];
  display: (ArkCard | null)[];
  hand: ArkCard[];
  discarded: ArkCard[];
};

/** Only the owning domain transaction may call these helpers on its candidate. */
export function drawArkCards(zones: ArkCardZones, amount: number): ArkCard[] {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid draw amount.');
  const drawn = zones.zooDeck.splice(0, amount);
  zones.hand.push(...drawn);
  return drawn;
}

/** Preserve holes during the action: a taken card must not change other slot costs. */
export function takeArkDisplayCard(zones: ArkCardZones, cardId: string, maxSlot: number): boolean {
  if (!Number.isSafeInteger(maxSlot) || maxSlot < 0 || maxSlot > 6) return false;
  const slot = zones.display.findIndex(c => c?.cardId === cardId);
  if (slot < 0 || slot >= maxSlot) return false;
  const card = zones.display[slot];
  if (!card) return false;
  zones.display[slot] = null;
  zones.hand.push(card);
  return true;
}

/** End of the complete turn, not after each draw or card play. */
export function replenishArkDisplay(zones: ArkCardZones): void {
  const remaining = zones.display.filter(c => c !== null);
  while (remaining.length < 6 && zones.zooDeck.length > 0) remaining.push(zones.zooDeck.shift()!);
  zones.display = Array.from({length: 6}, (_, index) => remaining[index] ?? null);
}

export function discardArkHand(zones: ArkCardZones, cardIds: readonly string[], count: number): boolean {
  if (!Number.isSafeInteger(count) || count < 0) return false;
  if (cardIds.length !== count || new Set(cardIds).size !== count || cardIds.some(id => !zones.hand.some(c => c.cardId === id))) return false;
  const selected = new Set(cardIds);
  zones.discarded.push(...zones.hand.filter(c => selected.has(c.cardId)));
  zones.hand = zones.hand.filter(c => !selected.has(c.cardId));
  return true;
}
