import * as v from 'valibot';
import { SpiritEventKeySchema } from './events.js';
import { SpiritSettingsSchema, SPIRIT_DEFAULT_SETTINGS } from './settings.js';
import { GameIdSchema, PlayerIdSchema, TurnIdSchema } from '../../identifiers.js';
import { GameRevisionSchema } from '../../protocol.js';
import { SpiritCountSchema as count, SpiritRefSchema as ref, SpiritIdSchema, SpiritTerrainSchema, SpiritElementSchema } from './actions.js';
export const SpiritPieceSchema = v.strictObject({ id: ref, kind: v.picklist(['EXPLORER', 'TOWN', 'CITY', 'DAHAN']), damage: count, strife: v.optional(count,0) });
export type SpiritPiece = v.InferOutput<typeof SpiritPieceSchema>;
export const SpiritLandSchema = v.strictObject({ eventHealthBonus:v.optional(v.nullable(v.picklist(['BUILDINGS','EXPLORERS'])),null), eventHealthLoss:v.optional(v.boolean(),false), id: ref, board: v.picklist(['A', 'B', 'C', 'D']), number: v.pipe(count, v.minValue(0), v.maxValue(8)), terrain: SpiritTerrainSchema, coastal: v.boolean(), adjacent: v.pipe(v.array(ref), v.maxLength(12)), pieces: v.pipe(v.array(SpiritPieceSchema), v.maxLength(250)), presence: v.pipe(v.array(v.strictObject({ playerId: PlayerIdSchema, count })), v.maxLength(4)), tokens:v.optional(v.strictObject({beasts:count,wilds:count,disease:count}),{beasts:0,wilds:0,disease:0}), invaderHealth:v.optional(count,0), blight: count, defend: count, skip: v.boolean(), protectDahan: v.boolean(), vitality: v.boolean(), dahanHealth: count });
export type SpiritLand = v.InferOutput<typeof SpiritLandSchema>;
export const SpiritCardSchema = v.strictObject({ cardId: ref, key: ref });
export type SpiritCard = v.InferOutput<typeof SpiritCardSchema>;
export const SpiritChoiceOptionSchema = v.strictObject({ id: ref, label: v.pipe(v.string(), v.maxLength(220)), landId: v.nullable(ref), pieceId: v.nullable(ref) });
export type SpiritChoiceOption = v.InferOutput<typeof SpiritChoiceOptionSchema>;
export const SpiritStageSchema = v.picklist(['SELECT', 'PREPARE', 'FAST', 'FEAR', 'RAVAGE', 'BUILD', 'EXPLORE', 'SLOW', 'TIME']);
export const SpiritPlayerViewSchema = v.strictObject({ playerId: PlayerIdSchema, spirit: v.nullable(SpiritIdSchema), board: v.picklist(['A', 'B', 'C', 'D']), canCallPredators:v.optional(v.boolean(),false), growthSelections:v.optional(v.array(count),[]), reclaimedCards:v.optional(v.array(ref),[]), bonusPlays: v.optional(count, 0), energy: count, energyTrack: count, cardTrack: count, destroyedPresence: count, grown: v.boolean(), ready: v.boolean(), hand: v.pipe(v.array(SpiritCardSchema), v.maxLength(150)), played: v.pipe(v.array(SpiritCardSchema), v.maxLength(20)), discard: v.pipe(v.array(SpiritCardSchema), v.maxLength(150)), resolved: v.pipe(v.array(ref), v.maxLength(100)), elements: v.pipe(v.array(SpiritElementSchema), v.maxLength(150)), fastRemaining: count, repeatRemaining: count });
export const SpiritInvaderCardSchema = v.strictObject({ stage: v.picklist([1, 2, 3]), terrains: v.pipe(v.array(SpiritTerrainSchema), v.maxLength(2)), coastal: v.boolean() });
export type SpiritInvaderCard = v.InferOutput<typeof SpiritInvaderCardSchema>;
export const SpiritResultSchema = v.strictObject({ reason: v.picklist(['VICTORY', 'SACRIFICE', 'BLIGHT', 'PRESENCE', 'INVADERS', 'CANCELLED', 'ADVERSARY', 'SCENARIO']), winnerPlayerIds: v.pipe(v.array(PlayerIdSchema), v.maxLength(4)), round: count });
export type SpiritResult = v.InferOutput<typeof SpiritResultSchema>;
export const SpiritFeedbackSchema = v.strictObject({ id: count, kind: v.picklist(['EVENT', 'SELECT', 'GROW', 'CARD', 'POWER', 'MOVE', 'DAMAGE', 'FEAR', 'BLIGHT', 'BUILD', 'EXPLORE', 'PHASE', 'WIN', 'LOSE', 'PLAN']), text: v.pipe(v.string(), v.maxLength(300)), landId: v.nullable(ref), playerId: v.nullable(PlayerIdSchema) });
const base = { eventIslandState:v.optional(v.nullable(v.picklist(['HEALTHY','BLIGHTED'])),null), eventInvaderStage:v.optional(v.nullable(v.picklist([1,2,3])),null), eventRavageBonus:v.optional(count,0), eventStricken:v.optional(v.boolean(),false), eventExploreBonus:v.optional(v.boolean(),false), eventAfterAdvance:v.optional(v.nullable(v.picklist(['SACRED_EXPLORERS','FORTIFICATION'])),null), currentEvent:v.optional(v.nullable(SpiritEventKeySchema),null), eventDeckCount:v.optional(count,0), eventDiscardCount:v.optional(count,0), cannyDefense:v.optional(v.boolean(),false), eventPayment:v.optional(v.nullable(v.strictObject({ cost:count, support:count, energy:count, remaining:count, element:SpiritElementSchema, contributions:v.array(v.strictObject({ playerId:PlayerIdSchema, energy:count, support:count })) })),null), ravageRedirects:v.optional(v.array(ref),[]), destroyedBoards:v.optional(v.array(v.picklist(['A','B','C','D'])),[]), settings:v.optional(SpiritSettingsSchema,SPIRIT_DEFAULT_SETTINGS), configured:v.optional(v.boolean(),false), blighted:v.optional(v.boolean(),false), blightCard:v.optional(v.nullable(v.picklist(['SPIRAL','MEMORY'])),null), hearts:v.optional(v.array(ref),[]), immigration:v.optional(v.nullable(SpiritInvaderCardSchema),null), gameType: v.literal('SPIRIT_ISLAND'), rulesVersion: v.literal('spirit-island-core-v2'), gameId: GameIdSchema, gameRevision: GameRevisionSchema, round: count, stage: SpiritStageSchema,
    lands: v.pipe(v.array(SpiritLandSchema), v.maxLength(36)), playerStates: v.pipe(v.array(SpiritPlayerViewSchema), v.minLength(1), v.maxLength(4)),
    revealedFear: v.optional(v.array(v.strictObject({ position: count, name: ref, effects: v.tuple([ref,ref,ref]) })), []), fear: count, fearPool: count, terror: v.picklist([1, 2, 3, 4]), fearDeckCount: count, earnedFearCount: count, blightPool: count,
    ravage: v.nullable(SpiritInvaderCardSchema), build: v.nullable(SpiritInvaderCardSchema), explore: v.nullable(SpiritInvaderCardSchema), invaderDeckCount: count,
    pending: v.nullable(v.strictObject({ choiceId: ref, playerId: PlayerIdSchema, title: v.pipe(v.string(), v.maxLength(220)), options: v.pipe(v.array(SpiritChoiceOptionSchema), v.maxLength(1500)) })),
    plans: v.pipe(v.array(v.strictObject({ playerId: PlayerIdSchema, landId: ref, intent: v.picklist(['DEFEND', 'ATTACK', 'MOVE', 'HELP']) })), v.maxLength(4)),
    log: v.pipe(v.array(SpiritFeedbackSchema), v.maxLength(50)),
    privateState: v.strictObject({ playerId: PlayerIdSchema, hand: v.pipe(v.array(SpiritCardSchema), v.maxLength(150)), powerOptions: v.pipe(v.array(v.strictObject({ cardId: ref, key: ref, fast: v.boolean(), slow: v.boolean(), targets: v.pipe(v.array(ref), v.maxLength(36)), thresholdMax: count, repeat: v.boolean(), shadowTargets: v.pipe(v.array(ref), v.maxLength(32)) })), v.maxLength(60)) }),
};
export const SpiritPlayingProjectionSchema = v.strictObject({ ...base, phase: v.literal('PLAYING'), turnId: TurnIdSchema });
export const SpiritFinishedProjectionSchema = v.strictObject({ ...base, phase: v.literal('FINISHED'), result: SpiritResultSchema });
export type SpiritPlayingProjection = v.InferOutput<typeof SpiritPlayingProjectionSchema>;
export type SpiritProjection = SpiritPlayingProjection | v.InferOutput<typeof SpiritFinishedProjectionSchema>;
export function spiritProjectionIsConsistent(g: SpiritProjection): boolean {
    const ids = new Set(g.playerStates.map(p => p.playerId)), self = g.playerStates.find(p => p.playerId === g.privateState.playerId), lands = new Set(g.lands.map(l => l.id));
    if (ids.size !== g.playerStates.length || !self || JSON.stringify(self.hand) !== JSON.stringify(g.privateState.hand) || g.fearPool !== ids.size * (g.settings.adversary==='ENGLAND'&&g.settings.level===6?5:4) || g.fear >= g.fearPool || g.lands.filter(l => l.number > 0).length !== (ids.size - g.destroyedBoards.length) * 8 || lands.size !== g.lands.length)
        return false;
    if(new Set(g.destroyedBoards).size!==g.destroyedBoards.length || g.destroyedBoards.length>ids.size || g.lands.some(l=>g.destroyedBoards.includes(l.board)))return false;
    if(g.ravageRedirects.some(id=>!lands.has(id)))return false;
    if (g.lands.some(l => l.adjacent.some(id => !lands.has(id)) || l.presence.some(p => !ids.has(p.playerId))))
        return false;
    const cards = g.playerStates.flatMap(p => [...p.hand, ...p.played, ...p.discard]).map(c => c.cardId);
    if (new Set(cards).size !== cards.length || g.pending && !ids.has(g.pending.playerId) || g.plans.some(p => !ids.has(p.playerId) || !lands.has(p.landId)))
        return false;
    return g.phase !== 'FINISHED' || g.result.winnerPlayerIds.every(id => ids.has(id));
}
