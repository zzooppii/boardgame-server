import * as v from 'valibot';
import { ARK_RULES_VERSION, ArkNovaProjectionSchema, type ArkNovaProjection, type PlayerId } from '@hangul-rummikub/shared';
import { projectArkSoloGame } from '../domain/game.js';
import { ArkNovaGameStateAdapter, type ArkNovaStoredGame } from './adapter.js';

export function projectArkNova(game:ArkNovaStoredGame,viewer:PlayerId):ArkNovaProjection {
  const stored=new ArkNovaGameStateAdapter().cloneAndValidate(game),state=projectArkSoloGame(stored.state,viewer);
  return v.parse(ArkNovaProjectionSchema,{gameType:'ARK_NOVA',gameId:stored.gameId,gameRevision:stored.gameRevision,
    rulesVersion:ARK_RULES_VERSION,phase:state.phase,state});
}
