import {type ArkMapId} from '@hangul-rummikub/shared';
import * as v from 'valibot';
import { ArkCellSchema, ARK_BUILDINGS, arkShape, arkPlacementReason, type ArkBuilding } from '@hangul-rummikub/shared';

/** A rules kernel only. Room commands must authenticate, serialize and commit separately. */
const ConstructionInput = v.strictObject({
  building: v.pipe(v.string(), v.maxLength(40)),
  anchor: ArkCellSchema,
  rotation: v.picklist([0, 1, 2, 3, 4, 5]),
  reflected: v.boolean(),
});
export type ConstructionContext = Readonly<{
mapId?:ArkMapId|undefined;  buildings: readonly ArkBuilding[];
  money: number;
  remainingStrength: number;
  upgraded: boolean;
  builtKinds: readonly string[];
  engineerAvailable?: boolean;
  ignoreTerrain?: boolean;
}>;
export type ConstructionValidation =
  | Readonly<{ok: false; reason: 'INVALID_INPUT' | 'INVALID_BUILDING' | 'INSUFFICIENT_STRENGTH' | 'INSUFFICIENT_MONEY' | 'DUPLICATE_KIND' | 'INVALID_PLACEMENT'; message: string}>
  | Readonly<{ok: true; cost: number; strengthCost:number; engineer:boolean; building: Omit<ArkBuilding, 'id'>}>;

export function validateArkConstruction(context: ConstructionContext, input: unknown): ConstructionValidation {
  const parsed = v.safeParse(ConstructionInput, input);
  if (!parsed.success) return {ok: false, reason: 'INVALID_INPUT', message: '배치 입력을 확인하세요.'};
  const a = parsed.output, definition = Object.hasOwn(ARK_BUILDINGS, a.building) ? ARK_BUILDINGS[a.building] : undefined;
  if (!definition || !context.upgraded && ['ReptileHouse', 'LargeBirdAviary'].includes(a.building)) {
    return {ok: false, reason: 'INVALID_BUILDING', message: '현재 행동으로 지을 수 없는 건물입니다.'};
  }
  const engineer=context.engineerAvailable===true&&context.builtKinds.includes(a.building)&&
    !['PettingZoo','ReptileHouse','LargeBirdAviary'].includes(a.building);
  if (!engineer&&(context.builtKinds.includes(a.building) || !context.upgraded && context.builtKinds.length > 0)) {
    return {ok: false, reason: 'DUPLICATE_KIND', message: '같은 행동에서 이 건물을 더 지을 수 없습니다.'};
  }
  const strengthCost=engineer?0:definition.shape.length;
  if (strengthCost > context.remainingStrength) return {ok: false, reason: 'INSUFFICIENT_STRENGTH', message: '남은 행동 강도가 부족합니다.'};
  const cost = definition.shape.length * 2;
  if (context.money < cost) return {ok: false, reason: 'INSUFFICIENT_MONEY', message: '건설 비용이 부족합니다.'};
  // The client supplies an anchor/orientation, never trusted occupied cells or cost.
  const cells = arkShape(a.building, a.anchor, a.rotation, a.reflected);
  const reason = arkPlacementReason(context.buildings, a.building, cells, context.upgraded,context.ignoreTerrain===true,false,context.mapId);
  if (reason) return {ok: false, reason: 'INVALID_PLACEMENT', message: reason};
  return {ok: true, cost, strengthCost,engineer,building: {kind: a.building, cells, occupied: false, used: 0}};
}
