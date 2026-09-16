import { parse } from 'valibot';
import { ArnakPlayingProjectionSchema, ArnakFinishedProjectionSchema, type PlayerId, type ArnakProjection } from '@hangul-rummikub/shared';
import type { ArnakStoredGame } from './adapter.js';
import { arnakActionHints } from '../domain/action-hints.js';
import { arnakOffers } from '../domain/game.js';
export function projectArnak(game: ArnakStoredGame | null, viewer: PlayerId): ArnakProjection | null {
    if (!game)
        return null;
    const s = game.state, self = s.players.find(p => p.playerId === viewer);
    if (!self)
        throw new Error('Arnak viewer missing');
    const playerStates = s.players.map(({ hand: _hand, deck: _deck, keep: _keep, travel: _travel, planeRound: _plane, noFear: _fear, ...publicState }) => publicState);
    const offers = arnakOffers(s, viewer);
    const base = { gameType: 'ARNAK', gameId: s.gameId, gameRevision: s.revision, rulesVersion: s.rulesVersion, round: s.round, playerStates, activePlayerId: s.activePlayerId, startingPlayerId: s.startingPlayerId, mainActionUsed: s.mainActionUsed, stage: s.stage, sites: s.sites, market: s.market, itemDeckCount: s.itemDeck.length, artifactDeckCount: s.artifactDeck.length, assistantSupply: s.assistantSupply.map(stack => stack.slice(0, 1)), researchBonuses: s.researchBonuses, templeRewards: [], templeSupply: s.templeSupply, templeArrival: s.templeArrival, history: s.history, pendingLabels: s.jobs.map(j => j.label), privateState: { playerId: viewer, hand: self.hand, revealedCards: s.activePlayerId === viewer ? s.peek : [], keep: self.keep, travel: [...self.travel], blockedActions: arnakActionHints(s, viewer, offers), offers } };
    return s.phase === 'FINISHED' ? parse(ArnakFinishedProjectionSchema, { ...base, phase: 'FINISHED', result: s.result }) : parse(ArnakPlayingProjectionSchema, { ...base, phase: 'PLAYING', turnId: s.transitionId });
}
