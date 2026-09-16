import * as v from 'valibot';
import { PlayerIdSchema, TileIdSchema } from '../../identifiers.js';

export const SpeakeasyBuildingKindSchema = v.picklist(['SPEAKEASY', 'STILLS', 'NIGHTCLUB', 'CASINO']);
export const SpeakeasyOperationSchema = v.picklist(['VIP', 'PARTY', 'STILLS', 'FLEET', 'STRENGTH']);
export const SpeakeasyDistrictIdSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(16));
export const SpeakeasyCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10000));
export const SpeakeasyBuildingViewSchema = v.strictObject({
  tileId: TileIdSchema, ownerId: PlayerIdSchema, kind: SpeakeasyBuildingKindSchema,
  protected: v.boolean(), barrel: v.boolean(), operating: v.boolean(),
});
export type SpeakeasyBuildingKind = v.InferOutput<typeof SpeakeasyBuildingKindSchema>;
export type SpeakeasyOperation = v.InferOutput<typeof SpeakeasyOperationSchema>;
export type SpeakeasyBuildingView = v.InferOutput<typeof SpeakeasyBuildingViewSchema>;
export const SPEAKEASY_BUILDING_LABELS: Readonly<Record<SpeakeasyBuildingKind, string>> = {
  SPEAKEASY: '주점', STILLS: '증류소', NIGHTCLUB: '나이트클럽', CASINO: '카지노',
};
export const SPEAKEASY_OPERATION_LABELS: Readonly<Record<SpeakeasyOperation, string>> = {
  VIP: 'VIP 룸', PARTY: '파티', STILLS: '증류', FLEET: '운송', STRENGTH: '세력',
};
export const SPEAKEASY_ROUNDS = [4, 3, 3, 1] as const;
export function speakeasyZone(district: number): 0 | 1 | 2 {
  if (!Number.isSafeInteger(district) || district < 1 || district > 16) throw new Error('Invalid Speakeasy district.');
  return district <= 6 ? 0 : district <= 12 ? 1 : 2;
}

/** A readiness declaration, not a rules variant or a substitute card catalog. */
export const SPEAKEASY_READINESS = Object.freeze({
  status: 'COMPONENT_AUDIT_REQUIRED', rulesSource: 'v19c + FAQ April 2026',
  blockers: ['운영 카드 48장', '마피아 타일 20개', '보드별 수치·연결', '카드·타일별 장수와 보너스'],
} as const);
