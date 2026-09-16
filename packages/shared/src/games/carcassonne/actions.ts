import * as v from "valibot";
import { TileIdSchema, PlayerIdSchema } from "../../identifiers.js";
import { CARCASSONNE_TILE_KINDS } from "./catalog.js";
export const CarcassonneSettingsSchema = v.strictObject({
  innsAndCathedrals: v.boolean(),
  tradersAndBuilders: v.boolean(),
});
export const CarcassonnePieceSchema = v.picklist([
  "NORMAL",
  "BIG",
  "BUILDER",
  "PIG",
]);
export const CarcassonneGoodsSchema = v.strictObject({
  WINE: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(9)),
  GRAIN: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(6)),
  CLOTH: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(5)),
});
export const CarcassonneTileKindSchema = v.picklist(CARCASSONNE_TILE_KINDS);
export const CarcassonneRotationSchema = v.picklist([0, 90, 180, 270]);
export const CarcassonneCoordinateSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(-114),
  v.maxValue(114),
);
export const CarcassonneRegionIdSchema = v.pipe(
  v.string(),
  v.regex(/^[crfm][0-3]$/),
);
export const CarcassonneTileSchema = v.strictObject({
  tileId: TileIdSchema,
  kind: CarcassonneTileKindSchema,
});
export const CarcassonneBoardTileSchema = v.strictObject({
  tileId: TileIdSchema,
  kind: CarcassonneTileKindSchema,
  x: CarcassonneCoordinateSchema,
  y: CarcassonneCoordinateSchema,
  rotation: CarcassonneRotationSchema,
});
export const CarcassonneMeepleSchema = v.strictObject({
  playerId: PlayerIdSchema,
  tileId: TileIdSchema,
  regionId: CarcassonneRegionIdSchema,
  piece: v.optional(CarcassonnePieceSchema),
});
export const CarcassonneActionSchema = v.strictObject({
  tileId: TileIdSchema,
  x: CarcassonneCoordinateSchema,
  y: CarcassonneCoordinateSchema,
  rotation: CarcassonneRotationSchema,
  meepleRegionId: v.nullable(CarcassonneRegionIdSchema),
  piece: v.optional(CarcassonnePieceSchema),
});
export type CarcassonneTile = v.InferOutput<typeof CarcassonneTileSchema>;
export type CarcassonneBoardTile = v.InferOutput<
  typeof CarcassonneBoardTileSchema
>;
export type CarcassonneMeeple = v.InferOutput<typeof CarcassonneMeepleSchema>;
export type CarcassonneAction = v.InferOutput<typeof CarcassonneActionSchema>;
export type CarcassonneRotation = v.InferOutput<
  typeof CarcassonneRotationSchema
>;
