import * as v from 'valibot';
import {GameIdSchema, PlayerIdSchema, TileIdSchema} from '../../identifiers.js';
import {SpeakeasyOperationSchema, SpeakeasyBuildingKindSchema, SpeakeasyBuildingViewSchema, SpeakeasyDistrictIdSchema} from './contracts.js';
import {SpeakeasyLucianoViewSchema} from './luciano.js';
import {SpeakeasyRestaurantActionSchema, SpeakeasyDeckSchema} from './restaurant.js';

export const SpeakeasyLocationSchema = v.picklist([
  'DOCKS', 'CITY_HALL', 'RESTAURANT', 'COMMISSION', 'CONTRACTOR', 'CITY_PLANNING', 'GARAGE', 'PARK',
]);
export const SpeakeasyPlaceCapoCommandSchema = v.strictObject({
  gameId: GameIdSchema,
  revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  capoId: TileIdSchema,
  spaceId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  restaurant: v.optional(v.strictObject({
    position: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(3)),
    discardIds: v.pipe(v.array(TileIdSchema), v.minLength(1), v.maxLength(2)),
  })),
});

/** Per-viewer turn panel only; not a complete board snapshot or command authorization. */
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(100));
const cityTile = v.strictObject({tileId: TileIdSchema, effectId: key});
export const SpeakeasyTurnViewSchema = v.strictObject({
  gameId: GameIdSchema, revision: count, viewerId: PlayerIdSchema,
  act: v.picklist([1,2,3,4]), round: v.pipe(count,v.minValue(1),v.maxValue(4)),
  stage: v.picklist(['PLACE_CAPO','LOCATION','RESTAURANT_CHOICE','RESTAURANT_ACTION','FINISH_LOCATION','DRAW_OPERATION','RETURN_CITY','ROUND_END','LUCIANO','FINAL_SCORING']),
  actorId: v.nullable(PlayerIdSchema), order: v.array(PlayerIdSchema), lowerRow: v.array(v.nullable(PlayerIdSchema)),
  spaces: v.array(v.strictObject({id:key, location:SpeakeasyLocationSchema,
    occupants:v.array(v.strictObject({playerId:PlayerIdSchema,capoId:TileIdSchema}))})),
  active: v.nullable(v.strictObject({playerId:PlayerIdSchema,capoId:TileIdSchema,spaceId:key})),
  restaurant: v.nullable(v.strictObject({
    completed:v.array(SpeakeasyRestaurantActionSchema),
    current:v.nullable(v.strictObject({action:SpeakeasyRestaurantActionSchema,used:count})),
  })),
  market: v.strictObject({
    middle:v.pipe(v.array(v.strictObject({count,top:v.nullable(cityTile)})),v.length(3)),
    right:v.pipe(v.array(v.nullable(cityTile)),v.length(3)),
    supplyCounts:v.pipe(v.array(count),v.length(3)),
  }),
  self:v.strictObject({
    cash:count,safe:count,availableCapos:v.array(TileIdSchema),
    hand:v.array(v.strictObject({tileId:TileIdSchema,operation:SpeakeasyOperationSchema,leverage:count})),
    cityTiles:v.array(v.strictObject({...cityTile.entries,used:v.boolean()})),
    drawDecks:v.array(SpeakeasyDeckSchema),
    returnCount:count,mandatoryReturnIds:v.array(TileIdSchema),eligibleReturnIds:v.array(TileIdSchema),
    firstReturnRows:v.array(v.picklist([0,1,2])),
  }),
});
export type SpeakeasyTurnView = v.InferOutput<typeof SpeakeasyTurnViewSchema>;

const level = v.pipe(count,v.minValue(1),v.maxValue(5));
const truck = v.strictObject({tileId:TileIdSchema,district:v.nullable(SpeakeasyDistrictIdSchema),barrels:v.array(TileIdSchema)});
export const SpeakeasyFixedGoalViewSchema = v.strictObject({
  id:key, kind:v.picklist(['CRATES','PROTECTED_DISTRICTS','INFAMY']), minimum:count, progress:count, payout:count,
  spaces:v.pipe(v.array(v.nullable(PlayerIdSchema)),v.length(2)),
  status:v.picklist(['READY','REQUIREMENT','CLAIMED','FULL','NO_BOOKS','BOOK_ACTION_REQUIRED','ACTION_LIMIT']),
});
export type SpeakeasyFixedGoalView = v.InferOutput<typeof SpeakeasyFixedGoalViewSchema>;
/** Screen snapshot: visible board + authenticated player's personal board. No canonical state. */
export const SpeakeasyBoardViewSchema = v.strictObject({
  turn:SpeakeasyTurnViewSchema,
  districts:v.pipe(v.array(v.strictObject({id:SpeakeasyDistrictIdSchema,blocked:v.boolean(),cop:v.boolean(),
    slots:v.array(v.nullable(SpeakeasyBuildingViewSchema)),mobsterSlots:v.array(v.picklist([0,1,2])),mobsterStrength:v.nullable(count)})),v.length(16)),
  trucks:v.array(v.strictObject({tileId:TileIdSchema,ownerId:PlayerIdSchema,district:SpeakeasyDistrictIdSchema,load:count})),
  docks:v.array(v.strictObject({ownerId:PlayerIdSchema,zone:v.picklist([0,1,2]),space:count})),
  placedBooks:v.array(v.strictObject({ownerId:PlayerIdSchema,goalId:v.string(),space:v.picklist([0,1])})),
  self:v.strictObject({
    fixedGoals:v.pipe(v.array(SpeakeasyFixedGoalViewSchema),v.length(9)),
    levels:v.strictObject({VIP:level,PARTY:level,STILLS:level,FLEET:level,STRENGTH:level}),
    leverageTokens:count,operations:SpeakeasyTurnViewSchema.entries.self.entries.hand,
    reserves:v.array(v.strictObject({tileId:TileIdSchema,kind:SpeakeasyBuildingKindSchema,cost:count,group:v.nullable(v.picklist([0,1,2]))})),
    vip:count,familyReserve:count,goons:count,stock:v.array(TileIdSchema),trucks:v.array(truck),
    books:count,bookReserve:count,crates:v.array(count),
    helpers:v.array(v.strictObject({tileId:TileIdSchema,bottle:v.string(),value:v.picklist([5,10,20]),used:v.boolean()})),
    associate:v.nullable(v.strictObject({district:SpeakeasyDistrictIdSchema,strength:count,fee:count,defenseBonus:count,
      protectionBonus:count,stillsImmune:v.boolean(),freeUseAvailable:v.boolean(),takeoverDiscount:count})),
  }),
  luciano:v.nullable(SpeakeasyLucianoViewSchema),
  result:v.nullable(v.strictObject({winners:v.array(PlayerIdSchema),scores:v.array(v.strictObject({
    playerId:PlayerIdSchema,total:count,buildingMoney:count,helperMoney:count,tieBreak:v.pipe(v.array(count),v.length(4)),
  }))})),
});
export type SpeakeasyBoardView = v.InferOutput<typeof SpeakeasyBoardViewSchema>;
