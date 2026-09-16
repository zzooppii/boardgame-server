/** Official base inventory A–X, Big Box 2010 appendix B1. Art is original. */
export const CARCASSONNE_BASE_TILE_KINDS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
] as const;
export const CARCASSONNE_INNS_TILE_KINDS = [
  "EA",
  "EB",
  "EC",
  "ED",
  "EE",
  "EF",
  "EG",
  "EH",
  "EI",
  "EJ",
  "EK",
  "EL",
  "EM",
  "EN",
  "EO",
  "EP",
  "EQ",
] as const;
export const CARCASSONNE_TRADERS_TILE_KINDS = [
  "HA",
  "HB",
  "HC",
  "HD",
  "HE",
  "HF",
  "HG",
  "HH",
  "HI",
  "HJ",
  "HK",
  "HL",
  "HM",
  "HN",
  "HO",
  "HP",
  "HQ",
  "HR",
  "HS",
  "HT",
  "HU",
  "HV",
  "HW",
  "HX",
] as const;
export const CARCASSONNE_TILE_KINDS = [
  ...CARCASSONNE_BASE_TILE_KINDS,
  ...CARCASSONNE_INNS_TILE_KINDS,
  ...CARCASSONNE_TRADERS_TILE_KINDS,
] as const;
export type CarcassonneSettings = {
  innsAndCathedrals: boolean;
  tradersAndBuilders: boolean;
};
export const CARCASSONNE_DEFAULT_SETTINGS: CarcassonneSettings = {
  innsAndCathedrals: false,
  tradersAndBuilders: false,
};
export const CARCASSONNE_GOODS = ["WINE", "GRAIN", "CLOTH"] as const;
export type CarcassonneGood = (typeof CARCASSONNE_GOODS)[number];
export const CARCASSONNE_GOOD_LABELS = {
  WINE: "포도주",
  GRAIN: "곡물",
  CLOTH: "직물",
} as const;
export const CARCASSONNE_PIECE_LABELS = {
  NORMAL: "일반 미플",
  BIG: "큰 미플",
  BUILDER: "건축가",
  PIG: "돼지",
} as const;
export type CarcassonnePiece = keyof typeof CARCASSONNE_PIECE_LABELS;
export function carcassonneTileCount(
  settings: CarcassonneSettings = CARCASSONNE_DEFAULT_SETTINGS,
) {
  return (
    72 +
    (settings.innsAndCathedrals ? 18 : 0) +
    (settings.tradersAndBuilders ? 24 : 0)
  );
}
export function carcassonneTileEnabled(
  kind: CarcassonneTileKind,
  settings: CarcassonneSettings = CARCASSONNE_DEFAULT_SETTINGS,
) {
  return (
    kind.length === 1 ||
    (kind.startsWith("E")
      ? settings.innsAndCathedrals
      : settings.tradersAndBuilders)
  );
}
export type CarcassonneTileKind = (typeof CARCASSONNE_TILE_KINDS)[number];
export type CarcassonneFeatureKind = "CITY" | "ROAD" | "FIELD" | "MONASTERY";
export type CarcassonneRegion = Readonly<{
  id: string;
  kind: CarcassonneFeatureKind;
  ports: readonly number[];
  adjacentCities: readonly string[];
  shields: number;
  inn?: boolean;
  cathedral?: boolean;
  goods?: CarcassonneGood;
  point: readonly [number, number];
  path: string;
}>;
export type CarcassonneTileDefinition = Readonly<{
  kind: CarcassonneTileKind;
  count: number;
  label: string;
  regions: readonly CarcassonneRegion[];
}>;
const all = "M0 0H100V100H0Z",
  left = "M0 0H50V100H0Z",
  right = "M50 0H100V100H50Z";
const top = "M0 0H100V50H0Z",
  bottom = "M0 50H100V100H0Z";
const nw = "M0 0H50V50H0Z",
  ne = "M50 0H100V50H50Z",
  se = "M50 50H100V100H50Z",
  sw = "M0 50H50V100H0Z";
const curveSE = "M100 50Q50 50 50 100",
  curveNW = "M50 0Q50 50 0 50",
  curveSW = "M50 100Q50 50 0 50";
const insideSE = "M100 50Q50 50 50 100H100Z",
  outsideSE = "M0 0H100V50Q50 50 50 100H0Z";
const insideNW = "M50 0Q50 50 0 50V0Z",
  outsideNW = "M50 0H100V100H0V50Q50 50 50 0Z";
const insideSW = "M50 100Q50 50 0 50V100Z",
  outsideSW = "M0 0H100V100H50Q50 50 0 50Z";
const capN = "M0 0H100Q78 29 50 29Q22 29 0 0Z";
const capE = "M100 0V100Q71 78 71 50Q71 22 100 0Z";
const capS = "M100 100H0Q22 71 50 71Q78 71 100 100Z";
const capW = "M0 100V0Q29 22 29 50Q29 78 0 100Z";
const cornerNW = "M0 0H100Q82 22 50 50Q22 82 0 100Z";
const cityNEW = "M0 0H100V100Q50 36 0 100Z";
const cityNS = "M0 0H100Q65 50 100 100H0Q35 50 0 0Z";
const cityEW = "M0 0Q50 35 100 0V100Q50 65 0 100Z";
const r = (
  id: string,
  kind: CarcassonneFeatureKind,
  ports: readonly number[],
  point: readonly [number, number],
  path: string,
  adjacentCities: readonly string[] = [],
  shields = 0,
): CarcassonneRegion => ({
  id,
  kind,
  ports,
  point,
  path,
  adjacentCities,
  shields,
});
const c = (
  ports: readonly number[],
  point: readonly [number, number],
  path: string,
  shields = 0,
  id = "c0",
) => r(id, "CITY", ports, point, path, [], shields);
const road = (
  ports: readonly number[],
  point: readonly [number, number],
  path: string,
  id = "r0",
) => r(id, "ROAD", ports, point, path);
const f = (
  id: string,
  ports: readonly number[],
  point: readonly [number, number],
  path: string,
  adjacentCities: readonly string[] = [],
) => r(id, "FIELD", ports, point, path, adjacentCities);
const monastery = r("m0", "MONASTERY", [], [50, 46], "M34 30H66V63H34Z");
const d = (
  kind: CarcassonneTileKind,
  count: number,
  label: string,
  regions: readonly CarcassonneRegion[],
): CarcassonneTileDefinition => ({ kind, count, label, regions });
const allPorts = [0, 1, 2, 3, 4, 5, 6, 7];
/** Directions: N/E/S/W=0/1/2/3. Field half-edges run clockwise, N-left=0. */
const BASE: Readonly<
  Record<
    (typeof CARCASSONNE_BASE_TILE_KINDS)[number],
    CarcassonneTileDefinition
  >
> = {
  A: d("A", 2, "길이 있는 수도원", [
    monastery,
    road([2], [50, 82], "M50 63L50 100"),
    f("f0", allPorts, [20, 28], all),
  ]),
  B: d("B", 4, "수도원", [monastery, f("f0", allPorts, [20, 28], all)]),
  C: d("C", 1, "방패 도시", [c([0, 1, 2, 3], [50, 50], all, 1)]),
  D: d("D", 4, "도시와 곧은 길", [
    c([1], [87, 50], capE),
    road([0, 2], [50, 46], "M50 0L50 100"),
    f("f0", [0, 5, 6, 7], [24, 45], left),
    f("f1", [1, 4], [64, 16], right, ["c0"]),
  ]),
  E: d("E", 5, "작은 도시", [
    c([0], [50, 14], capN),
    f("f0", [2, 3, 4, 5, 6, 7], [50, 65], all, ["c0"]),
  ]),
  F: d("F", 2, "방패가 있는 연결 도시", [
    c([1, 3], [50, 50], cityEW, 1),
    f("f0", [0, 1], [50, 12], top, ["c0"]),
    f("f1", [4, 5], [50, 88], bottom, ["c0"]),
  ]),
  G: d("G", 1, "연결 도시", [
    c([0, 2], [50, 50], cityNS),
    f("f0", [2, 3], [88, 50], right, ["c0"]),
    f("f1", [6, 7], [12, 50], left, ["c0"]),
  ]),
  H: d("H", 3, "마주 보는 두 도시", [
    c([1], [87, 50], capE),
    c([3], [13, 50], capW, 0, "c1"),
    f("f0", [0, 1, 4, 5], [50, 50], all, ["c0", "c1"]),
  ]),
  I: d("I", 2, "이웃한 두 도시", [
    c([1], [87, 50], capE),
    c([2], [50, 87], capS, 0, "c1"),
    f("f0", [0, 1, 6, 7], [34, 34], all, ["c0", "c1"]),
  ]),
  J: d("J", 3, "도시와 오른쪽 굽은 길", [
    c([0], [50, 14], capN),
    road([1, 2], [64, 64], curveSE),
    f("f0", [2, 5, 6, 7], [26, 51], outsideSE, ["c0"]),
    f("f1", [3, 4], [84, 84], insideSE),
  ]),
  K: d("K", 3, "도시와 왼쪽 굽은 길", [
    c([1], [87, 50], capE),
    road([0, 3], [36, 36], curveNW),
    f("f0", [0, 7], [16, 16], insideNW),
    f("f1", [1, 4, 5, 6], [49, 77], outsideNW, ["c0"]),
  ]),
  L: d("L", 3, "도시와 삼거리", [
    c([1], [87, 50], capE),
    road([0], [50, 21], "M50 0L50 50"),
    road([2], [50, 79], "M50 50L50 100", "r1"),
    road([3], [21, 50], "M0 50L50 50", "r2"),
    f("f0", [1, 4], [64, 16], right, ["c0"]),
    f("f1", [0, 7], [22, 23], nw),
    f("f2", [5, 6], [22, 77], sw),
  ]),
  M: d("M", 2, "방패가 있는 모퉁이 도시", [
    c([0, 3], [30, 29], cornerNW, 1),
    f("f0", [2, 3, 4, 5], [75, 76], all, ["c0"]),
  ]),
  N: d("N", 3, "모퉁이 도시", [
    c([0, 3], [30, 29], cornerNW),
    f("f0", [2, 3, 4, 5], [75, 76], all, ["c0"]),
  ]),
  O: d("O", 2, "방패 도시와 굽은 길", [
    c([0, 3], [30, 29], cornerNW, 1),
    road([1, 2], [64, 64], curveSE),
    f("f0", [2, 5], [81, 35], outsideSE, ["c0"]),
    f("f1", [3, 4], [85, 85], insideSE),
  ]),
  P: d("P", 3, "모퉁이 도시와 굽은 길", [
    c([0, 3], [30, 29], cornerNW),
    road([1, 2], [64, 64], curveSE),
    f("f0", [2, 5], [81, 35], outsideSE, ["c0"]),
    f("f1", [3, 4], [85, 85], insideSE),
  ]),
  Q: d("Q", 1, "방패가 있는 큰 도시", [
    c([0, 1, 3], [50, 35], cityNEW, 1),
    f("f0", [4, 5], [50, 87], all, ["c0"]),
  ]),
  R: d("R", 3, "큰 도시", [
    c([0, 1, 3], [50, 35], cityNEW),
    f("f0", [4, 5], [50, 87], all, ["c0"]),
  ]),
  S: d("S", 2, "방패 도시의 입구", [
    c([0, 1, 3], [50, 35], cityNEW, 1),
    road([2], [50, 85], "M50 68L50 100"),
    f("f0", [4], [69, 91], right, ["c0"]),
    f("f1", [5], [31, 91], left, ["c0"]),
  ]),
  T: d("T", 1, "도시의 입구", [
    c([0, 1, 3], [50, 35], cityNEW),
    road([2], [50, 85], "M50 68L50 100"),
    f("f0", [4], [69, 91], right, ["c0"]),
    f("f1", [5], [31, 91], left, ["c0"]),
  ]),
  U: d("U", 8, "곧은 길", [
    road([0, 2], [50, 50], "M50 0L50 100"),
    f("f0", [0, 5, 6, 7], [22, 50], left),
    f("f1", [1, 2, 3, 4], [78, 50], right),
  ]),
  V: d("V", 9, "굽은 길", [
    road([2, 3], [36, 64], curveSW),
    f("f0", [5, 6], [16, 84], insideSW),
    f("f1", [0, 1, 2, 3, 4, 7], [66, 35], outsideSW),
  ]),
  W: d("W", 4, "삼거리", [
    road([1], [80, 50], "M50 50L100 50"),
    road([2], [50, 80], "M50 50L50 100", "r1"),
    road([3], [20, 50], "M0 50L50 50", "r2"),
    f("f0", [0, 1, 2, 7], [50, 23], top),
    f("f1", [3, 4], [78, 78], se),
    f("f2", [5, 6], [22, 78], sw),
  ]),
  X: d("X", 1, "사거리", [
    road([0], [50, 20], "M50 0L50 50"),
    road([1], [80, 50], "M50 50L100 50", "r1"),
    road([2], [50, 80], "M50 50L50 100", "r2"),
    road([3], [20, 50], "M0 50L50 50", "r3"),
    f("f0", [0, 7], [22, 22], nw),
    f("f1", [1, 2], [78, 22], ne),
    f("f2", [3, 4], [78, 78], se),
    f("f3", [5, 6], [22, 78], sw),
  ]),
};
// Expansion inventories follow the same Big Box 2010 B1/B2 tile identifiers.
const copy = (
  kind: CarcassonneTileKind,
  source: keyof typeof BASE,
  label: string,
  change: (r: CarcassonneRegion) => CarcassonneRegion = (r) => r,
  count = 1,
) => d(kind, count, label, BASE[source].regions.map(change));
const inn = (r: CarcassonneRegion): CarcassonneRegion =>
  r.kind === "ROAD" && r.id === "r0" ? { ...r, inn: true } : r;
const goods =
  (good: CarcassonneGood) =>
  (r: CarcassonneRegion): CarcassonneRegion =>
    r.id === "c0" ? { ...r, goods: good, shields: 0 } : r;
const cityNE = "M0 0H100V100Q78 78 50 50Q22 22 0 0Z";
const fieldSouth = [4, 5];
const crossFields = [
  f("f0", [0, 7], [20, 20], nw),
  f("f1", [1, 2], [80, 20], ne),
  f("f2", [3, 4], [80, 80], se),
  f("f3", [5, 6], [20, 80], sw),
];
const splitCityRoad = (
  kind: CarcassonneTileKind,
  label: string,
  good?: CarcassonneGood,
) =>
  d(kind, 1, label, [
    { ...c([0, 1], [70, 25], cityNE), ...(good ? { goods: good } : {}) },
    road([2], [50, 83], "M50 55V100"),
    f("f0", [4], [73, 87], right, ["c0"]),
    f("f1", [5, 6, 7], [22, 65], left, ["c0"]),
  ]);
const westNorthRoad = (
  kind: CarcassonneTileKind,
  label: string,
  good?: CarcassonneGood,
  hasInn = false,
) =>
  d(kind, 1, label, [
    { ...c([0, 3], [28, 28], cornerNW), ...(good ? { goods: good } : {}) },
    { ...road([2], [50, 82], "M50 50V100"), inn: hasInn },
    f("f0", [2, 3, 4], [80, 70], right, ["c0"]),
    f("f1", [5], [28, 90], left, ["c0"]),
  ]);
const threeCity = (
  kind: CarcassonneTileKind,
  label: string,
  good?: CarcassonneGood,
) =>
  d(kind, 1, label, [
    { ...c([0, 3], [28, 28], cornerNW), ...(good ? { goods: good } : {}) },
    c([1], [87, 50], capE, 0, "c1"),
    c([2], [50, 87], capS, 0, "c2"),
    f("f0", [], [64, 64], all, ["c0", "c1", "c2"]),
  ]);
export const CARCASSONNE_CATALOG: Readonly<
  Record<CarcassonneTileKind, CarcassonneTileDefinition>
> = {
  ...BASE,
  EA: copy("EA", "V", "굽은 길의 여관", inn),
  EB: copy("EB", "U", "곧은 길의 여관", inn),
  EC: copy("EC", "W", "삼거리의 여관", inn),
  ED: d("ED", 1, "두 길의 수도원", [
    monastery,
    road([3], [18, 50], "M0 50H34"),
    road([1], [82, 50], "M66 50H100", "r1"),
    f("f0", [0, 1, 2, 7], [50, 18], top),
    f("f1", [3, 4, 5, 6], [50, 82], bottom),
  ]),
  EE: d("EE", 1, "서로 다른 두 굽은 길", [
    road([0, 3], [34, 34], curveNW),
    road([1, 2], [66, 66], curveSE, "r1"),
    f("f0", [0, 7], [15, 15], insideNW),
    f("f1", [1, 2, 5, 6], [50, 50], all),
    f("f2", [3, 4], [85, 85], insideSE),
  ]),
  EF: splitCityRoad("EF", "모퉁이 도시의 입구"),
  EG: d("EG", 1, "안쪽 들판을 감싼 도시", [
    c([3], [27, 48], "M0 0Q50 35 100 0Q75 62 0 100Z"),
    f("f0", [0, 1], [50, 10], top, ["c0"]),
    f("f1", [2, 3, 4, 5], [75, 80], all, ["c0"]),
  ]),
  EH: d("EH", 1, "네 개의 독립 도시", [
    c([0], [50, 13], capN),
    c([1], [87, 50], capE, 0, "c1"),
    c([2], [50, 87], capS, 0, "c2"),
    c([3], [13, 50], capW, 0, "c3"),
    f("f0", [], [50, 50], all, ["c0", "c1", "c2", "c3"]),
  ]),
  EI: d("EI", 1, "두 도시 사이의 교차로", [
    c([1], [87, 50], capE),
    c([3], [13, 50], capW, 0, "c1"),
    road([0], [50, 20], "M50 0V50"),
    road([2], [50, 80], "M50 50V100", "r1"),
    f("f0", [0], [35, 18], nw, ["c1"]),
    f("f1", [1], [65, 18], ne, ["c0"]),
    f("f2", [4], [65, 82], se, ["c0"]),
    f("f3", [5], [35, 82], sw, ["c1"]),
  ]),
  EJ: d("EJ", 1, "작은 도시의 진입로", [
    c([0], [50, 13], capN),
    road([2], [50, 65], "M50 29V100"),
    f("f0", [2, 3, 4], [80, 60], right, ["c0"]),
    f("f1", [5, 6, 7], [20, 60], left, ["c0"]),
  ]),
  EK: copy(
    "EK",
    "C",
    "성당",
    (r) => ({ ...r, shields: 0, cathedral: true }),
    2,
  ),
  EL: copy("EL", "O", "방패 도시와 여관", inn),
  EM: d("EM", 1, "작은 도시와 여관", [
    c([0], [50, 13], capN),
    ...BASE.V.regions.map((r) =>
      r.kind === "FIELD" && r.id === "f1"
        ? { ...r, ports: [2, 3, 4, 7], adjacentCities: ["c0"] }
        : inn(r),
    ),
  ]),
  EN: westNorthRoad("EN", "성문 앞 여관", undefined, true),
  EO: d("EO", 1, "세 개의 독립 도시", [
    c([0], [50, 13], capN),
    c([1], [87, 50], capE, 0, "c1"),
    c([3], [13, 50], capW, 0, "c2"),
    f("f0", fieldSouth, [50, 60], all, ["c0", "c1", "c2"]),
  ]),
  EP: d("EP", 1, "방패 도시와 서쪽 도시", [
    c([0, 1], [70, 28], cityNE, 1),
    c([3], [13, 50], capW, 0, "c1"),
    f("f0", [4, 5], [40, 76], all, ["c0", "c1"]),
  ]),
  EQ: d("EQ", 1, "두 성문과 방패 도시", [
    c([1, 3], [50, 50], cityEW, 1),
    road([0], [50, 12], "M50 0V29"),
    road([2], [50, 88], "M50 71V100", "r1"),
    f("f0", [0], [22, 12], nw, ["c0"]),
    f("f1", [1], [78, 12], ne, ["c0"]),
    f("f2", [4], [78, 88], se, ["c0"]),
    f("f3", [5], [22, 88], sw, ["c0"]),
  ]),
  HA: d("HA", 1, "도시로 들어가는 굽은 길", [
    c([1], [87, 50], capE),
    road([2], [50, 76], "M50 100V70Q50 50 71 50"),
    f("f0", [0, 1, 5, 6, 7], [25, 30], all, ["c0"]),
    f("f1", [4], [65, 85], se, ["c0"]),
  ]),
  HB: d("HB", 1, "다리 아래 두 길", [
    road([0, 2], [50, 25], "M50 0V100"),
    road([1, 3], [25, 50], "M0 50H100", "r1"),
    ...crossFields,
  ]),
  HC: d("HC", 1, "도시 앞 고가 다리", [
    c([0], [50, 13], capN),
    road([2], [50, 76], "M50 29V100"),
    road([3], [22, 50], "M0 50H80", "r1"),
    f("f0", [7], [22, 37], nw, ["c0"]),
    f("f1", [2, 3, 4], [83, 65], right, ["c0"]),
    f("f2", [5, 6], [20, 80], sw),
  ]),
  HD: d(
    "HD",
    1,
    "곡물 도시와 두 도시",
    [
      ...splitCityRoad("HD", "", "GRAIN").regions,
      c([3], [13, 50], capW, 0, "c1"),
    ].map((r) =>
      r.id === "f1" ? { ...r, ports: [5], adjacentCities: ["c0", "c1"] } : r,
    ),
  ),
  HE: d("HE", 1, "곡물 성문", [
    { ...c([1, 3], [50, 50], cityEW), goods: "GRAIN" },
    road([2], [50, 87], "M50 71V100"),
    f("f0", [0, 1], [50, 12], top, ["c0"]),
    f("f1", [4], [78, 88], se, ["c0"]),
    f("f2", [5], [22, 88], sw, ["c0"]),
  ]),
  HF: westNorthRoad("HF", "곡물 도시의 길", "GRAIN"),
  HG: copy("HG", "N", "곡물 모퉁이 도시", goods("GRAIN")),
  HH: copy("HH", "R", "곡물 대도시", goods("GRAIN")),
  HI: d("HI", 1, "곡물 도시와 두 입구", [
    { ...c([0, 3], [30, 30], cornerNW), goods: "GRAIN" },
    road([2], [50, 84], "M50 50V100"),
    f("f0", [2, 3, 4], [82, 72], right, ["c0"]),
    f("f1", [5], [28, 90], left, ["c0"]),
  ]),
  HJ: d("HJ", 1, "세 길의 수도원", [
    monastery,
    road([1], [83, 50], "M66 50H100"),
    road([2], [50, 82], "M50 63V100", "r1"),
    road([3], [17, 50], "M0 50H34", "r2"),
    f("f0", [0, 1, 2, 7], [50, 17], top),
    f("f1", [3, 4], [80, 80], se),
    f("f2", [5, 6], [20, 80], sw),
  ]),
  HK: splitCityRoad("HK", "직물 도시의 길", "CLOTH"),
  HL: d(
    "HL",
    1,
    "직물 도시와 서쪽 도시",
    [
      ...splitCityRoad("HL", "", "CLOTH").regions,
      c([3], [13, 50], capW, 0, "c1"),
    ].map((r) =>
      r.id === "f1" ? { ...r, ports: [5], adjacentCities: ["c0", "c1"] } : r,
    ),
  ),
  HM: threeCity("HM", "직물과 세 도시", "CLOTH"),
  HN: d("HN", 1, "직물 도시와 남쪽 도시", [
    { ...c([1, 3], [50, 43], cityEW), goods: "CLOTH" },
    c([2], [50, 87], capS, 0, "c1"),
    f("f0", [0, 1], [50, 12], top, ["c0"]),
    f("f1", [], [50, 72], bottom, ["c0", "c1"]),
  ]),
  HO: d("HO", 1, "직물 도시의 두 성문", [
    { ...c([0, 3], [30, 30], cornerNW), goods: "CLOTH" },
    road([1], [83, 50], "M50 50H100"),
    road([2], [50, 83], "M50 50V100", "r1"),
    f("f0", [2], [88, 28], ne, ["c0"]),
    f("f1", [3, 4], [82, 82], se, ["c0"]),
    f("f2", [5], [28, 88], sw, ["c0"]),
  ]),
  HP: d("HP", 1, "포도주 도시와 남쪽 도시", [
    { ...c([1, 3], [50, 43], cityEW), goods: "WINE" },
    c([2], [50, 87], capS, 0, "c1"),
    f("f0", [0, 1], [50, 12], top, ["c0"]),
    f("f1", [], [50, 72], bottom, ["c0", "c1"]),
  ]),
  HQ: copy("HQ", "F", "포도주 장터", goods("WINE")),
  HR: d("HR", 1, "포도주 도시 북문", [
    { ...c([1, 3], [50, 50], cityEW), goods: "WINE" },
    road([0], [50, 12], "M50 0V29"),
    f("f0", [0], [22, 12], nw, ["c0"]),
    f("f1", [1], [78, 12], ne, ["c0"]),
    f("f2", [4, 5], [50, 88], bottom, ["c0"]),
  ]),
  HS: d("HS", 1, "포도주 도시 남문", [
    { ...c([1, 3], [50, 50], cityEW), goods: "WINE" },
    road([2], [50, 88], "M50 71V100"),
    f("f0", [0, 1], [50, 12], top, ["c0"]),
    f("f1", [4], [78, 88], se, ["c0"]),
    f("f2", [5], [22, 88], sw, ["c0"]),
  ]),
  HT: copy("HT", "N", "포도주 모퉁이 도시", goods("WINE")),
  HU: d("HU", 1, "포도주 도시의 두 성문", [
    { ...c([0, 3], [30, 30], cornerNW), goods: "WINE" },
    road([1], [83, 50], "M50 50H100"),
    road([2], [50, 83], "M50 50V100", "r1"),
    f("f0", [2], [88, 28], ne, ["c0"]),
    f("f1", [3, 4], [82, 82], se, ["c0"]),
    f("f2", [5], [28, 88], sw, ["c0"]),
  ]),
  HV: copy("HV", "T", "포도주 대도시의 길", goods("WINE")),
  HW: splitCityRoad("HW", "포도주 대도시의 입구", "WINE"),
  HX: d("HX", 1, "포도주와 두 도시", [
    { ...c([0, 3], [28, 28], cornerNW), goods: "WINE" },
    c([1, 2], [82, 82], "M100 0V100H0Q40 65 65 40Z", 0, "c1"),
    f("f0", [], [54, 54], all, ["c0", "c1"]),
  ]),
};
export const CARCASSONNE_RULES_VERSION = "carcassonne-base72-v1" as const;
export const CARCASSONNE_TURN_DURATION_MS = 90_000;
export const CARCASSONNE_FEATURE_LABELS: Readonly<
  Record<CarcassonneFeatureKind, string>
> = { CITY: "도시", ROAD: "도로", FIELD: "들판", MONASTERY: "수도원" };
