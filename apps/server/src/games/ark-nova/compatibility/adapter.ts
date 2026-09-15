import {parseArkMultiplayerState,type ArkMultiplayerState} from '../domain/multiplayer.js';
import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, type PlayerId, type GameId, type GameRevision, type ServerTime } from '@hangul-rummikub/shared';
import { parseArkSoloState, type ArkSoloState } from '../domain/game.js';

export type ArkNovaStoredGame=Readonly<{gameId:GameId;gameRevision:GameRevision;startedAt:ServerTime;finishedAt:ServerTime|null;state:ArkSoloState|ArkMultiplayerState}>;
export type ArkNovaLifecycle=
  | Readonly<{lifecycle:'RUNNING';gameId:GameId;gameRevision:GameRevision;activeTurn:null}>
  | Readonly<{lifecycle:'FINISHED';gameId:GameId;finishedAt:ServerTime}>;

/** Matches the existing room persistence adapter boundary. Solo play has no scheduled deadline. */
export class ArkNovaGameStateAdapter {
  cloneAndValidate(game:ArkNovaStoredGame):ArkNovaStoredGame {
    if(!('mode' in game.state)&&game.state.multiplayer)throw new Error('Participant requires multiplayer container.');
    const state='mode' in game.state?parseArkMultiplayerState(structuredClone(game.state)):parseArkSoloState(structuredClone(game.state));
    const gameId=v.parse(GameIdSchema,game.gameId),gameRevision=v.parse(GameRevisionSchema,game.gameRevision),startedAt=v.parse(ServerTimeSchema,game.startedAt);
    const finishedAt=v.parse(v.nullable(ServerTimeSchema),game.finishedAt);
    if(state.gameId!==gameId||state.revision!==gameRevision||state.startedAt!==startedAt||state.finishedAt!==finishedAt)throw new Error('Ark Nova stored metadata mismatch.');
    return {gameId,gameRevision,startedAt,finishedAt,state};
  }
  inspectLifecycle(game:ArkNovaStoredGame):ArkNovaLifecycle {
    const stored=this.cloneAndValidate(game);
    if(stored.state.phase==='FINISHED') {
      if(stored.finishedAt===null)throw new Error('Ark Nova finish time missing.');
      return {lifecycle:'FINISHED',gameId:stored.gameId,finishedAt:stored.finishedAt};
    }
    return {lifecycle:'RUNNING',gameId:stored.gameId,gameRevision:stored.gameRevision,activeTurn:null};
  }
}

export function arkNovaPlayerIds(state:ArkNovaStoredGame['state']):PlayerId[]{return 'mode' in state?state.players.map(p=>p.playerId):[state.playerId];}
