import { parse } from 'valibot';
import { PerchPlayingProjectionSchema, PerchFinishedProjectionSchema, type PlayerId, type PerchProjection } from '@hangul-rummikub/shared';
import type { PerchStoredGame } from './adapter.js';
import { activePerchPlayer, perchPending } from '../domain/game.js';
export function projectPerch(game: PerchStoredGame | null, viewer: PlayerId): PerchProjection | null {
    if (!game)
        return null;
    const s = game.state, me = s.players.find(p => p.playerId === viewer);
    if (!me)
        throw new Error('Perch viewer missing.');
    const base = { gameType: 'PERCH' as const, gameId: s.gameId, gameRevision: s.revision, rulesVersion: s.rulesVersion, settings: s.settings, playerStates: s.players.map(p => ({ playerId: p.playerId, flock: p.flock, score: p.score, hand: p.hand, supplyCount: s.supply[p.flock]!.length, objectiveSelected: p.objective !== null, house: p.house, lightning: p.lightning })), activePlayerId: activePerchPlayer(s).playerId, round: s.round, board: s.board, creatures: s.creatures, fountain: s.fountain, plaza: s.plaza, bagCount: s.bag.length, neutralSupplyCount: s.players.length === 2 ? s.supply[2]!.length : null, turnOrder: s.turnOrder, placed: s.placed, bonusUsed: s.bonusUsed, pending: perchPending(s, viewer), history: s.history, roundScores: s.roundScores, privateState: { playerId: viewer, objective: me.objective, objectiveChoices: s.phase === 'OBJECTIVES' ? me.objectiveChoices : [] } };
    return s.phase === 'FINISHED' ? parse(PerchFinishedProjectionSchema, { ...base, phase: 'FINISHED', result: s.result }) : parse(PerchPlayingProjectionSchema, { ...base, phase: s.phase, turnId: s.transitionId });
}
