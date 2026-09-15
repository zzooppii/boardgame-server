import {parse} from 'valibot';
import {PatchworkPlayingProjectionSchema,PatchworkFinishedProjectionSchema,type PlayerId,type PatchworkProjection} from '@hangul-rummikub/shared';
import type {PatchworkStoredGame} from './adapter.js';
export function projectPatchwork(game:PatchworkStoredGame|null,viewer:PlayerId):PatchworkProjection|null{
 if(!game)return null;const s=game.state;
 if(!s.players.some(p=>p.playerId===viewer))throw new Error('Patchwork viewer missing.');
 const base={gameType:'PATCHWORK',gameId:s.gameId,gameRevision:s.revision,rulesVersion:s.rulesVersion,playerStates:s.players,activePlayerId:s.activePlayerId,market:s.market,leather:s.leather,pendingLeather:s.pendingLeather,discardedLeather:s.discardedLeather,bonusOwner:s.bonusOwner,finishOrder:s.finishOrder,history:s.history,privateState:{playerId:viewer}};
 return s.phase==='FINISHED'?parse(PatchworkFinishedProjectionSchema,{...base,phase:'FINISHED',result:s.result}):parse(PatchworkPlayingProjectionSchema,{...base,phase:'PLAYING',turnId:s.transitionId});
}
