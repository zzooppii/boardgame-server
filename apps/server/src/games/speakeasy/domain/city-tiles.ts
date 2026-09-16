import * as v from 'valibot';
import {PlayerIdSchema, TileIdSchema, type PlayerId, type TileId} from '@hangul-rummikub/shared';
import {ruleFailure, type SpeakeasyEconomy, type SpeakeasyRuleResult} from './model.js';

const Tile = v.strictObject({tileId: TileIdSchema, effectId: v.pipe(v.string(), v.minLength(1), v.maxLength(100))});
const piles = v.pipe(v.array(v.array(Tile)), v.length(3));
export const CityTilesSchema = v.strictObject({
  held: v.array(v.strictObject({playerId: PlayerIdSchema, tiles: v.array(Tile)})),
  played: v.array(TileIdSchema),
  middle: piles,
  right: v.pipe(v.array(v.nullable(Tile)), v.length(3)),
  supply: piles,
  buildings: v.array(v.strictObject({district: v.pipe(v.number(),v.safeInteger(),v.minValue(1),v.maxValue(16)),
    slot: v.picklist([0,1,2]), tile: Tile})),
});
export type SpeakeasyCityTiles = v.InferOutput<typeof CityTilesSchema>;
function allCityTiles(s: SpeakeasyCityTiles) {
  return [...s.held.flatMap(p=>p.tiles),...s.middle.flat(),...s.right.flatMap(t=>t?[t]:[]),...s.supply.flat(),...s.buildings.map(b=>b.tile)];
}
export function cityTileInventory(s: SpeakeasyCityTiles): string[] {return allCityTiles(s).map(t=>t.tileId).sort();}
export function cityTileDefinitions(s: SpeakeasyCityTiles): string {
  return JSON.stringify(allCityTiles(s).map(t=>[t.tileId,t.effectId]).sort((a,b)=>a[0]!.localeCompare(b[0]!)));
}
export function parseCityTiles(input: unknown): SpeakeasyCityTiles {
  const s=v.parse(CityTilesSchema,input), ids=cityTileInventory(s);
  if(ids.length>54 || new Set(ids).size!==ids.length || new Set(s.held.map(p=>p.playerId)).size!==s.held.length ||
    new Set(s.played).size!==s.played.length || s.played.some(id=>!s.held.some(p=>p.tiles.some(t=>t.tileId===id))) ||
    new Set(s.buildings.map(b=>`${b.district}:${b.slot}`)).size!==s.buildings.length) throw new Error('Invalid city tile inventory.');
  return s;
}
export function emptyCityTiles(players: readonly PlayerId[]): SpeakeasyCityTiles {
  return {held:players.map(playerId=>({playerId,tiles:[]})),played:[],middle:[[],[],[]],right:[null,null,null],supply:[[],[],[]],buildings:[]};
}
/** Server effect helper: take an exposed tile; right-column replacement uses a chosen nonempty stack. */
export function takeAvailableCityTile(original: SpeakeasyCityTiles, actor: PlayerId,
  column: 'MIDDLE'|'RIGHT', row: 0|1|2, refill?: 0|1|2): SpeakeasyRuleResult<SpeakeasyCityTiles> {
  const s=parseCityTiles(original), owner=s.held.find(p=>p.playerId===actor);
  if(!owner || ![0,1,2].includes(row)) return ruleFailure('INVALID_ACTION');
  if(column==='MIDDLE') {
    if(refill!==undefined || !s.middle[row]!.length) return ruleFailure('INVALID_ACTION');
    owner.tiles.push(s.middle[row]!.shift()!);
  } else {
    const tile=s.right[row];
    // A depleted replacement supply needs its official exhaustion policy; do not invent it here.
    if(!tile || refill===undefined || ![0,1,2].includes(refill) || !s.supply[refill]!.length) return ruleFailure('INVALID_ACTION');
    owner.tiles.push(tile);s.right[row]=s.supply[refill]!.shift()!;
  }
  return {ok:true,value:parseCityTiles(s)};
}
export function cityReturnsNeeded(s: SpeakeasyCityTiles, actor: PlayerId): number {
  const owned=s.held.find(p=>p.playerId===actor)?.tiles.length ?? 0;
  return s.played.length+Math.max(0,owned-s.played.length-4);
}
/** Ordered placements preserve the player's choice among equally short piles. */
export function returnCityTiles(original: SpeakeasyCityTiles, actor: PlayerId,
  placements: readonly {tileId:TileId;row:0|1|2}[]): SpeakeasyRuleResult<SpeakeasyCityTiles> {
  const s=parseCityTiles(original), owner=s.held.find(p=>p.playerId===actor);
  if(!owner || placements.length!==cityReturnsNeeded(s,actor) || new Set(placements.map(p=>p.tileId)).size!==placements.length ||
    s.played.some(id=>!placements.some(p=>p.tileId===id))) return ruleFailure('INVALID_ACTION');
  for(const p of placements) {
    const at=owner.tiles.findIndex(t=>t.tileId===p.tileId);
    if(at<0 || ![0,1,2].includes(p.row) || s.middle[p.row]!.length!==Math.min(...s.middle.map(p=>p.length))) return ruleFailure('INVALID_ACTION');
    s.middle[p.row]!.unshift(owner.tiles.splice(at,1)[0]!);
  }
  s.played=[];
  return {ok:true,value:parseCityTiles(s)};
}
export type CityEffectState = {economy:SpeakeasyEconomy;city:SpeakeasyCityTiles};
export type CityTileEffect = Readonly<{effectId:string;
  resolve:(s:CityEffectState,actor:PlayerId)=>SpeakeasyRuleResult<CityEffectState>}>;
