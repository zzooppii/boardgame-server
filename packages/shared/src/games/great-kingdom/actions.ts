import * as v from "valibot";
import { TileIdSchema } from "../../identifiers.js";
export const GreatKingdomColorSchema = v.picklist(["BLUE", "ORANGE"]);
export const GreatKingdomPositionSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(80));
export const GreatKingdomCastleSchema = v.strictObject({tileId: TileIdSchema, color: v.picklist(["BLUE", "ORANGE", "NEUTRAL"])});
export const GreatKingdomBoardSchema = v.pipe(v.array(v.nullable(GreatKingdomCastleSchema)), v.length(81));
export const GreatKingdomActionSchema = v.variant("kind", [
  v.strictObject({kind: v.literal("PLACE"), position: GreatKingdomPositionSchema}),
  v.strictObject({kind: v.literal("PASS")}),
]);
export type GreatKingdomColor = v.InferOutput<typeof GreatKingdomColorSchema>;
export type GreatKingdomCastle = v.InferOutput<typeof GreatKingdomCastleSchema>;
export type GreatKingdomBoard = v.InferOutput<typeof GreatKingdomBoardSchema>;
export type GreatKingdomAction = v.InferOutput<typeof GreatKingdomActionSchema>;
export function greatKingdomCoordinate(position: number): string {
  return `${String.fromCharCode(65 + position % 9)}${9 - Math.floor(position / 9)}`;
}
