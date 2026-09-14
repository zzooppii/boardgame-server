import { GameIdSchema, GameRevisionSchema, ServerTimeSchema, type GameId, type GameRevision, type ServerTime } from "@hangul-rummikub/shared";
import { parse } from "valibot";
import { parsePandemicState, type PandemicState } from "../domain/game.js";
export type PandemicStoredGame=Readonly<{gameId:GameId;gameRevision:GameRevision;startedAt:ServerTime;finishedAt:ServerTime|null;state:PandemicState}>;
export type PandemicLifecycle=Readonly<{lifecycle:'RUNNING';gameId:GameId;gameRevision:GameRevision;activeTurn:null}>|Readonly<{lifecycle:'FINISHED';gameId:GameId;finishedAt:ServerTime}>;
export class PandemicGameStateAdapter {
  cloneAndValidate(game:PandemicStoredGame):PandemicStoredGame {
    const state=parsePandemicState(game.state),gameId=parse(GameIdSchema,game.gameId),gameRevision=parse(GameRevisionSchema,game.gameRevision),startedAt=parse(ServerTimeSchema,game.startedAt);
    if(state.gameId!==gameId||state.revision!==gameRevision||state.startedAt!==startedAt||state.finishedAt!==game.finishedAt)throw new Error('Pandemic stored metadata mismatch.');
    return {gameId,gameRevision,startedAt,finishedAt:state.finishedAt,state};
  }
  inspectLifecycle(game:PandemicStoredGame):PandemicLifecycle {
    if(game.state.phase==='FINISHED'){if(game.finishedAt===null)throw new Error('Pandemic finish time missing.');return {lifecycle:'FINISHED',gameId:game.gameId,finishedAt:game.finishedAt};}
    return {lifecycle:'RUNNING',gameId:game.gameId,gameRevision:game.gameRevision,activeTurn:null};
  }
}
