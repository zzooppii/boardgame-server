import { parse } from 'valibot';
import { DuelPlayingProjectionSchema, DuelFinishedProjectionSchema, duelCard, type PlayerId, type DuelProjection } from '@hangul-rummikub/shared';
import type { DuelStoredGame } from './adapter.js';
import { choices, decisionActor, decisionLabel, draftAvailable } from '../domain/choices.js';
import { controller, science, godCost } from '../domain/economy.js';
import { playerIndex, type DuelEntity } from '../domain/state.js';
export function projectDuel(game: DuelStoredGame | null, viewer: PlayerId): DuelProjection | null {
    if (!game)
        return null;
    const s = game.state, seat = playerIndex(s, viewer);
    if (seat === null)
        throw new Error('Duel viewer missing.');
    const visible = (c: DuelEntity) => ({ tileId: c.tileId, definitionId: c.zone === 'BOARD' && c.slot !== null && !s.slots[c.slot]!.faceUp ? null : c.definitionId, back: ['WHITE', 'BLACK'].includes(duelCard(c.definitionId).color) ? 'SENATOR' : 'AGE', slot: c.slot });
    const actor = decisionActor(s), base = { gameType: 'SEVEN_WONDERS_DUEL', gameId: s.gameId, gameRevision: s.revision, rulesVersion: s.rulesVersion, settings: s.settings, age: s.age, stage: s.tasks.length ? 'RESOLVING' : s.stage, activePlayerId: s.players[actor]!.playerId,
        playerStates: s.players.map((p, i) => ({ playerId: p.playerId, coins: p.coins, protectedCoins: p.protectedCoins, buildings: s.cards.filter(c => c.zone === 'CITY' && c.owner === i).map(visible), gods: p.gods, progress: s.progress.filter(t => t.zone === 'PLAYER' && t.owner === i).map(t => t.id), science: science(s, i === 0 ? 0 : 1), mythology: p.mythology, offerings: p.offerings, influence: p.influence, conspiracies: s.conspiracies.filter(c => c.zone === 'HAND' && c.owner === i).map(c => ({ id: c.id, definitionId: seat === i || c.triggered ? c.definitionId : null, prepared: s.cards.some(t => t.zone === 'PREPARED' && t.under === c.id), triggered: c.triggered })) })),
        board: s.stage === 'DRAFT' && !s.settings.agora ? [] : s.cards.filter(c => c.zone === 'BOARD').sort((a, b) => a.slot! - b.slot!).map(visible), slots: s.stage === 'DRAFT' && !s.settings.agora ? [] : s.slots, discard: s.cards.filter(c => c.zone === 'DISCARD').map(visible), wonders: (s.stage === 'DRAFT' && (s.draftCount < 4 || s.draftCount === 4 && s.tasks.length > 0) ? s.wonders.slice(0, 4) : s.wonders).map(w => ({ id: w.id, owner: w.owner === -1 ? null : s.players[w.owner]!.playerId, built: w.built, removed: w.removed })), draftAvailable: s.stage === 'DRAFT' && !s.tasks.length ? draftAvailable(s).map(w => w.id) : [], military: s.military, militaryTokens: s.militaryTokens, minerva: s.minerva, progress: s.progress.filter(t => t.zone === 'BOARD').map(t => t.id),
        pantheon: s.pantheon.map((id, slot) => ({ slot, godId: s.age >= 2 || s.pantheonKnown[slot]!.includes(seat) ? id : null, occupied: id !== null, costs: [godCost(s, 0, slot, 0), godCost(s, 1, slot, 0)] })), enki: s.progress.filter(t => t.zone === 'ENKI').map(t => t.id), revealedGods: s.revealedGods,
        decrees: s.settings.agora ? Array.from({ length: 6 }, (_, chamber) => { const p = controller(s, chamber); return { chamber, ids: s.decrees.filter(d => d.chamber === chamber).map(d => d.revealed ? d.id : null), controller: p === null ? null : s.players[p]!.playerId }; }) : [],
        decision: s.phase === 'PLAYING' ? { playerId: s.players[actor]!.playerId, label: decisionLabel(s) } : null, history: s.history, privateState: { playerId: viewer, options: s.phase === 'PLAYING' && seat === actor ? choices(s).map(c => c.view) : [] } };
    return s.phase === 'PLAYING' ? parse(DuelPlayingProjectionSchema, { ...base, phase: 'PLAYING', turnId: s.transitionId }) : parse(DuelFinishedProjectionSchema, { ...base, phase: 'FINISHED', result: s.result });
}
