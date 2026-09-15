import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TurnIdSchema} from '../../identifiers.js';
import {GameRevisionSchema} from '../../protocol.js';
import {PatchworkCountSchema,PatchworkPlayerSchema,PatchworkTileSchema,type PatchworkTile} from './actions.js';
import {patchworkPlayerValid,patchworkSeven} from './rules.js';
import {PATCHWORK_LEATHER} from './catalog.js';
export const PatchworkLeatherSchema=v.strictObject({...PatchworkTileSchema.entries,position:v.picklist([26,32,38,44,50])});
export const PatchworkLogSchema=v.strictObject({id:PatchworkCountSchema,playerId:PlayerIdSchema,kind:v.picklist(['BUY','ADVANCE','LEATHER']),patchId:v.pipe(PatchworkCountSchema,v.maxValue(33)),distance:PatchworkCountSchema,income:PatchworkCountSchema,bonus:v.boolean()});
export const PatchworkResultSchema=v.strictObject({reason:v.picklist(['SCORED','CANCELLED']),winnerPlayerIds:v.pipe(v.array(PlayerIdSchema),v.maxLength(1))});
export const PatchworkPublicFields={playerStates:v.pipe(v.array(PatchworkPlayerSchema),v.length(2)),activePlayerId:PlayerIdSchema,market:v.pipe(v.array(PatchworkTileSchema),v.maxLength(33)),leather:v.pipe(v.array(PatchworkLeatherSchema),v.maxLength(5)),pendingLeather:v.pipe(v.array(PatchworkTileSchema),v.maxLength(5)),discardedLeather:v.pipe(v.array(PatchworkTileSchema),v.maxLength(5)),bonusOwner:v.nullable(PlayerIdSchema),finishOrder:v.pipe(v.array(PlayerIdSchema),v.maxLength(2)),history:v.pipe(v.array(PatchworkLogSchema),v.maxLength(150))};
const Base={gameType:v.literal('PATCHWORK'),gameId:GameIdSchema,gameRevision:GameRevisionSchema,rulesVersion:v.literal('patchwork-base-v1'),...PatchworkPublicFields,privateState:v.strictObject({playerId:PlayerIdSchema})};
export const PatchworkPlayingProjectionSchema=v.strictObject({...Base,phase:v.literal('PLAYING'),turnId:TurnIdSchema});
export const PatchworkFinishedProjectionSchema=v.strictObject({...Base,phase:v.literal('FINISHED'),result:PatchworkResultSchema});
export type PatchworkProjection=v.InferOutput<typeof PatchworkPlayingProjectionSchema>|v.InferOutput<typeof PatchworkFinishedProjectionSchema>;
export function patchworkProjectionIsConsistent(g:PatchworkProjection):boolean{
 const ids=g.playerStates.map(p=>p.playerId),all:PatchworkTile[]=[...g.market,...g.leather,...g.pendingLeather,...g.discardedLeather,...g.playerStates.flatMap(p=>p.placements)];
 return new Set(ids).size===2&&ids.includes(g.activePlayerId)&&ids.includes(g.privateState.playerId)&&g.playerStates.every(patchworkPlayerValid)&&all.length===38&&new Set(all.map(t=>t.tileId)).size===38&&Array.from({length:33},(_,i)=>i+1).every(id=>all.filter(t=>t.patchId===id).length===1)&&all.filter(t=>t.patchId===0).length===5&&g.market.every(t=>t.patchId!==0)&&[...g.leather,...g.pendingLeather,...g.discardedLeather].every(t=>t.patchId===0)&&new Set(g.leather.map(t=>t.position)).size===g.leather.length&&g.leather.every(t=>PATCHWORK_LEATHER.includes(t.position)&&g.playerStates.every(p=>p.position<t.position))&&(g.bonusOwner===null||g.playerStates.some(p=>p.playerId===g.bonusOwner&&patchworkSeven(p.placements)!==null))&&new Set(g.finishOrder).size===g.finishOrder.length&&g.finishOrder.every(id=>g.playerStates.some(p=>p.playerId===id&&p.position===53))&&g.playerStates.filter(p=>p.position===53).length===g.finishOrder.length&&(g.phase!=='FINISHED'||g.result.winnerPlayerIds.every(id=>ids.includes(id)));
}
