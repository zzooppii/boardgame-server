import * as v from 'valibot';
export const SpiritCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10000));
export const SpiritIdSchema = v.picklist(['RIVER', 'LIGHTNING', 'EARTH', 'SHADOW']);
export type SpiritId = v.InferOutput<typeof SpiritIdSchema>;
export const SpiritTerrainSchema = v.picklist(['MOUNTAIN', 'JUNGLE', 'SANDS', 'WETLAND']);
export type SpiritTerrain = v.InferOutput<typeof SpiritTerrainSchema>;
export const SpiritElementSchema = v.picklist(['SUN', 'MOON', 'FIRE', 'AIR', 'WATER', 'EARTH', 'PLANT', 'ANIMAL']);
export type SpiritElement = v.InferOutput<typeof SpiritElementSchema>;
export const SpiritRefSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export const SpiritActionSchema = v.variant('kind', [
    v.strictObject({ kind: v.literal('SELECT_SPIRIT'), spirit: SpiritIdSchema }),
    v.strictObject({ kind: v.literal('GROW'), option: v.picklist([0, 1, 2]) }),
    v.strictObject({ kind: v.literal('PLAY_CARDS'), cardIds: v.pipe(v.array(SpiritRefSchema), v.maxLength(10)) }),
    v.strictObject({ kind: v.literal('RECLAIM_ONE'), cardId: SpiritRefSchema }),
    v.strictObject({ kind: v.literal('READY'), ready: v.boolean() }),
    v.strictObject({ kind: v.literal('USE_POWER'), cardId: SpiritRefSchema, target: SpiritRefSchema, threshold: v.pipe(SpiritCountSchema, v.maxValue(4)), fast: v.boolean(), repeat: v.boolean(), shadowReach: v.boolean() }),
    v.strictObject({ kind: v.literal('CHOOSE'), choiceId: SpiritRefSchema, optionId: SpiritRefSchema }),
    v.strictObject({ kind: v.literal('ADVANCE') }),
    v.strictObject({ kind: v.literal('PLAN'), landId: v.nullable(SpiritRefSchema), intent: v.picklist(['DEFEND', 'ATTACK', 'MOVE', 'HELP']) }),
]);
export type SpiritAction = v.InferOutput<typeof SpiritActionSchema>;
