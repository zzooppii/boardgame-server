import * as v from 'valibot';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';
export const MARS_RESOURCES = ['money', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;
export type MarsResource = typeof MARS_RESOURCES[number];
export const MARS_RESOURCE_NAMES: Record<MarsResource, string> = { money: 'M€', steel: '강철', titanium: '티타늄', plants: '식물', energy: '에너지', heat: '열' };
export const MarsCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1000000));
export const MarsIntegerSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(-100), v.maxValue(1000000));
export const MarsRefSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(250));
export const MarsResourcesSchema = v.strictObject({ money: MarsCountSchema, steel: MarsCountSchema, titanium: MarsCountSchema, plants: MarsCountSchema, energy: MarsCountSchema, heat: MarsCountSchema });
export const MarsProductionSchema = v.strictObject({ ...MarsResourcesSchema.entries, money: v.pipe(MarsIntegerSchema, v.minValue(-5)) });
export type MarsResources = v.InferOutput<typeof MarsResourcesSchema>;
export function marsResources(value: Partial<MarsResources> = {}): MarsResources { return { money: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, ...value }; }
export const MarsCardSchema = v.strictObject({ tileId: TileIdSchema, definitionId: MarsRefSchema, resources: MarsCountSchema, usedGeneration: MarsCountSchema });
export type MarsCard = v.InferOutput<typeof MarsCardSchema>;
export const MarsOfferSchema = v.strictObject({ id: MarsRefSchema, kind: v.picklist(['CARD', 'PROJECT', 'CONVERT', 'ACTION', 'MILESTONE', 'AWARD', 'PLACE', 'EFFECT', 'END', 'PASS', 'CANCEL']), targetId: MarsRefSchema, label: MarsRefSchema, detail: v.pipe(v.string(), v.maxLength(1500)), cost: MarsCountSchema });
export type MarsOffer = v.InferOutput<typeof MarsOfferSchema>;
export const MarsPaymentSchema = v.strictObject({ money: MarsCountSchema, steel: MarsCountSchema, titanium: MarsCountSchema, heat: MarsCountSchema });
export type MarsPayment = v.InferOutput<typeof MarsPaymentSchema>;
export const MarsActionSchema = v.variant('type', [
    v.strictObject({ type: v.literal('TAKE'), actionId: MarsRefSchema }),
    v.strictObject({ type: v.literal('SETUP'), corporationId: MarsRefSchema, cardIds: v.pipe(v.array(TileIdSchema), v.maxLength(10)) }),
    v.strictObject({ type: v.literal('RESEARCH'), cardIds: v.pipe(v.array(TileIdSchema), v.maxLength(4)), heat: v.optional(MarsCountSchema) }),
    v.strictObject({ type: v.literal('SELL'), cardIds: v.pipe(v.array(TileIdSchema), v.minLength(1), v.maxLength(137)) }),
    v.strictObject({ type: v.literal('PAY'), payment: MarsPaymentSchema }),
]);
export type MarsAction = v.InferOutput<typeof MarsActionSchema>;
export const MarsPlayerPublicSchema = v.strictObject({ playerId: PlayerIdSchema, corporationId: v.nullable(MarsRefSchema), resources: MarsResourcesSchema, production: MarsProductionSchema, tr: MarsCountSchema, handCount: MarsCountSchema, played: v.array(MarsCardSchema), passed: v.boolean(), ready: v.boolean(), generationStartTr: MarsCountSchema, corporationUsedGeneration: MarsCountSchema });
export type MarsPlayerPublic = v.InferOutput<typeof MarsPlayerPublicSchema>;
