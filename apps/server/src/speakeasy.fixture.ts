import {parse} from 'valibot';
import {PlayerIdSchema, TileIdSchema} from '@hangul-rummikub/shared';
import {parseSpeakeasyEconomy, type SpeakeasyEconomy} from './games/speakeasy/domain/model.js';

export const a = parse(PlayerIdSchema, 'sp-player-a'), b = parse(PlayerIdSchema, 'sp-player-b');
export const tile = (id: string) => parse(TileIdSchema, id);
/** Economic examples only: this fixture is never used as a real game or as a printed card catalog. */
export function example(playerCount = 2): SpeakeasyEconomy {
  return parseSpeakeasyEconomy({players: Array.from({length: playerCount}, (_, i) => i === 0 ? a : i === 1 ? b : parse(PlayerIdSchema, `extra-${i}`)).map((playerId, seat) => ({playerId, cash: 15, safe: 30,
    levels: {VIP: 2, PARTY: 2, STILLS: 2, FLEET: 3, STRENGTH: 3}, leverageTokens: 2,
    hand: Array.from({length: 4}, (_, i) => ({tileId: tile(`hand-${seat}-${i}`), operation: 'PARTY', leverage: 1})),
    operations: [{tileId: tile(`installed-${seat}`), operation: 'VIP', leverage: 3}],
    reserves: [...[3, 3, 3, 5, 5, 8, 8, 8].map((cost, i) => ({tileId: tile(`bar-${seat}-${i}`), kind: 'SPEAKEASY', cost, group: i < 3 ? 0 : i < 5 ? 1 : 2})),
      {tileId: tile(`stills-${seat}`), kind: 'STILLS', cost: 5, group: 1},
      ...[0, 1, 2].flatMap(i => [{tileId: tile(`club-${seat}-${i}`), kind: 'NIGHTCLUB', cost: 12, group: null}, {tileId: tile(`casino-${seat}-${i}`), kind: 'CASINO', cost: 17, group: null}])],
    removedBuildings: [], vip: [tile(`vip-${seat}-0`), tile(`vip-${seat}-1`)],
    familyReserve: Array.from({length: 10}, (_, i) => tile(`family-${seat}-${i}`)), removedFamily: [],
    goons: [tile(`goon-${seat}`)], stock: [], trucks: [0, 1].map(i => ({tileId: tile(`truck-${seat}-${i}`), district: null, barrels: []})),
    books: 3, bookReserve: 7, cityTileCount: 0, crates: [], helpers: [], associate: null,
  })), districts: Array.from({length: 16}, (_, i) => ({id: i + 1, blocked: false, cop: false, slots: [null, null], mobsterSlots: [], mobsterStrength: null})),
    docks: [], barrelSupply: Array.from({length: 40}, (_, i) => tile(`barrel-${i}`)),
    goonSupply: Array.from({length: 22}, (_, i) => tile(`supply-goon-${i}`)), discardedCards: [], placedBooks: []});
}
