import { marsMetalValues } from '../domain/economy.js';
import { parse } from 'valibot';
import { MarsPlayingProjectionSchema, MarsFinishedProjectionSchema, marsCard, marsResources, type MarsProjection, type PlayerId } from '@hangul-rummikub/shared';
import type { MarsStoredGame } from './adapter.js';
import { marsOffers, marsCardReason, marsCost } from '../domain/game.js';
export function projectMars(game: MarsStoredGame | null, viewer: PlayerId): MarsProjection | null {
    if (!game)
        return null;
    const s = game.state, self = s.players.find(p => p.playerId === viewer);
    if (!self)
        throw new Error('Mars viewer missing');
    const playerStates = s.players.map(p => ({ playerId: p.playerId, protectedHabitats: p.protectedHabitats, corporationId: s.stage === 'SETUP' && p.playerId !== viewer ? null : p.corporationId, resources: s.stage === 'SETUP' && p.playerId !== viewer ? marsResources() : p.resources, production: s.stage === 'SETUP' && p.playerId !== viewer ? marsResources() : p.production, tr: p.tr, handCount: p.hand.length, played: p.played, passed: p.passed, ready: p.ready, generationStartTr: p.generationStartTr, corporationUsedGeneration: p.corporationUsedGeneration }));
    const paymentCard = s.payment ? self.played.find(c => c.tileId === s.payment?.source) : undefined;
    const payment = s.activePlayerId === viewer && s.payment ? { label: paymentCard ? marsCard(paymentCard.definitionId).name : s.payment.source, cost: s.payment.cost, steel: ['steel', 'both'].includes(s.payment.material), titanium: ['titanium', 'both'].includes(s.payment.material), heat: self.corporationId === 'Helion', ...marsMetalValues(self), cardId: s.payment.cardId, cancelable: s.payment.mode === 'card' } : null;
    const base = { gameType: 'TERRAFORMING_MARS', gameId: s.gameId, gameRevision: s.revision, rulesVersion: s.rulesVersion, generation: s.generation, stage: s.stage, activePlayerId: s.activePlayerId, startingPlayerId: s.startingPlayerId, actionsTaken: s.actionsTaken, oxygen: s.oxygen, temperature: s.temperature, oceans: s.oceans, tiles: s.tiles, landClaims: s.landClaims, milestones: s.milestones, awards: s.awards, history: s.history, playerStates, deckCount: s.deck.length, discardCount: s.discard.length, privateState: { playerId: viewer, nextCardDiscount: self.nextCardDiscount, hand: self.hand, research: self.research, corporations: s.stage === 'SETUP' ? self.corporations : [], offers: marsOffers(s, viewer), payment, cardChoice: s.cardChoice?.ownerId === viewer ? s.cardChoice.view : null, cardStatus: self.hand.map(c => ({ tileId: c.tileId, cost: marsCost(self, marsCard(c.definitionId)), reason: marsCardReason(s, self, marsCard(c.definitionId)) })) } };
    return s.phase === 'FINISHED' ? parse(MarsFinishedProjectionSchema, { ...base, phase: 'FINISHED', result: s.result }) : parse(MarsPlayingProjectionSchema, { ...base, phase: 'PLAYING', turnId: s.transitionId });
}
