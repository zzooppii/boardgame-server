import * as v from 'valibot';
export const DuelSettingsSchema = v.strictObject({ pantheon: v.boolean(), agora: v.boolean(), turnDurationSeconds: v.optional(v.picklist([0, 30, 60, 90]), 60) });
export type DuelSettings = v.InferOutput<typeof DuelSettingsSchema>;
export const DUEL_DEFAULT_SETTINGS: DuelSettings = { pantheon: true, agora: true, turnDurationSeconds: 60 };
export const DuelActionSchema = v.strictObject({ type: v.literal('SELECT'), optionId: v.pipe(v.string(), v.regex(/^option-[0-9]{1,4}$/)) });
export type DuelAction = v.InferOutput<typeof DuelActionSchema>;
