import { parse } from 'valibot';
import { HarmoniesPlayingProjectionSchema, HarmoniesFinishedProjectionSchema, type PlayerId, type HarmoniesProjection } from '@hangul-rummikub/shared';
import type { HarmoniesStoredGame } from './adapter.js';
export function projectHarmonies(game:HarmoniesStoredGame|null,viewer:PlayerId):HarmoniesProjection|null {
  if(!game)return null;
  const s=game.state;if(!s.players.some(p=>p.playerId===viewer))throw new Error('Harmonies viewer missing.');
  const base={gameType:'HARMONIES',gameId:s.gameId,gameRevision:s.revision,rulesVersion:s.rulesVersion,settings:s.settings,deadlineAt:s.deadlineAt,playerStates:s.players,activePlayerId:s.players[s.active]!.playerId,round:s.round,markets:s.markets,animalMarket:s.animalMarket,bagCount:s.bag.length,deckCount:s.deck.length,lastRound:s.lastRound,history:s.history,privateState:{playerId:viewer,draftSteps:s.players[s.active]!.playerId===viewer?s.draftSteps:[]}};
  return s.phase==='FINISHED'?parse(HarmoniesFinishedProjectionSchema,{...base,phase:'FINISHED',result:s.result}):parse(HarmoniesPlayingProjectionSchema,{...base,phase:'PLAYING',turnId:s.transitionId});
}
