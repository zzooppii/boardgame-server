import * as v from 'valibot';
import { GameIdSchema } from '../../identifiers.js';
import { GameRevisionSchema } from '../../protocol.js';
import { ARK_RULES_VERSION } from './actions.js';
import { ArkSoloViewSchema } from './solo-contracts.js';

const fields={gameType:v.literal('ARK_NOVA'),gameId:GameIdSchema,gameRevision:GameRevisionSchema,
  rulesVersion:v.literal(ARK_RULES_VERSION),state:ArkSoloViewSchema};
const coherent=(s:{gameId:string;gameRevision:number;phase:string;state:v.InferOutput<typeof ArkSoloViewSchema>})=>
  s.gameId===s.state.gameId&&s.gameRevision===s.state.revision&&s.phase===s.state.phase;
export const ArkNovaPlayingProjectionSchema=v.pipe(v.strictObject({...fields,phase:v.literal('PLAYING')}),v.check(s=>coherent(s)));
export const ArkNovaFinishedProjectionSchema=v.pipe(v.strictObject({...fields,phase:v.literal('FINISHED')}),v.check(s=>coherent(s)));
export const ArkNovaProjectionSchema=v.union([ArkNovaPlayingProjectionSchema,ArkNovaFinishedProjectionSchema]);
export type ArkNovaProjection=v.InferOutput<typeof ArkNovaProjectionSchema>;
