import type {PlayerId,TerrorscapeProjection} from '@hangul-rummikub/shared';
import type {TerrorscapeState} from './state.js';
export function terrorView(s:TerrorscapeState,playerId:PlayerId):TerrorscapeProjection {
 const killer=playerId===s.killerPlayerId;
 const base={gameType:'TERRORSCAPE' as const,gameId:s.gameId,gameRevision:killer?s.killerRevision:s.survivorRevision,rulesVersion:s.rulesVersion,playerStates:s.players,killerPlayerId:s.killerPlayerId,owners:s.survivors.map(p=>p.playerId),round:s.round,killerLocation:s.killerLocation,level:s.level,strength:(s.level>=2?6:5)+s.bonus,blocks:s.blocks,noises:s.noises,firecracker:s.firecracker,conditions:s.survivors.map(({character,fear,injuries})=>({character,fear,injuries})),sensed:s.sensed,encounter:s.encounter,dice:s.dice,defenseTotal:s.defenseTotal,history:killer?s.logs.killer:s.logs.survivor,
 privateState:killer?{role:'KILLER' as const,playerId,killer:{hand:s.phase==='SETUP'?[]:s.hand,deckCount:s.killerDeck.length,discardCount:s.killerDiscard.length,actionsLeft:s.actionsLeft,slowUsed:s.slowUsed}}:{role:'SURVIVOR' as const,playerId,team:{survivors:s.survivors,keys:s.keys.length,repair:s.repair,repaired:s.repaired,rescue:s.rescue,trap:s.trap,searchCount:s.searchDeck.length,discoverCount:s.discoverDeck.length,discard:s.discard,loot:s.loot,pings:s.pings}}};
 if(s.phase==='FINISHED'){if(!s.result)throw new Error('Missing result');return {...base,phase:'FINISHED',result:s.result};}
 const phase=killer&&s.phase==='LOOT'?'SURVIVORS':!killer&&['FAST','MAIN','SLOW','RAGE','UNLOCK'].includes(s.phase)?'KILLER':s.phase;
 return {...base,phase,turnId:killer?s.killerTurnId:s.survivorTurnId};
}
