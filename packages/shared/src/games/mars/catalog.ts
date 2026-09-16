import { MARS_PRELUDE_FACTS, MARS_PRELUDE_PROJECT_FACTS, MARS_PRELUDE_CORPORATIONS } from './prelude.js';
import { MARS_KOREAN_NAMES } from './korean-names.js';
import { MARS_PREPARED_CORPORATE_CARDS } from './corporate-era-catalog.js';
import type { MarsCorporateRequirement, MARS_CORPORATE_ERA_CARD_FACTS } from './corporate-era-facts.js';
import { MARS_CARD_FACTS } from './card-facts.js';
import { MARS_RESOURCE_NAMES, type MarsResource } from './actions.js';
import type { MarsPlacementRule, MarsTileKind } from './board.js';
type BaseMarsCardId = typeof MARS_CARD_FACTS[number]['id'];
export type MarsCardId = BaseMarsCardId | typeof MARS_CORPORATE_ERA_CARD_FACTS[number]['id'] | typeof MARS_PRELUDE_FACTS[number]['id'] | typeof MARS_PRELUDE_PROJECT_FACTS[number]['id'];
export type MarsCardResource = 'animal' | 'microbe' | 'science' | 'fighter';
export const MARS_CARD_RESOURCE_NAMES: Readonly<Record<string, string>> = { animal: '동물', microbe: '미생물', science: '과학', fighter: '전투기' };
export type MarsResourceScore = Readonly<{ per: number; points: number }>;
export type MarsEffect = {kind:'drawTag';tag:'plant'|'space';amount:number} | {kind:'instantProject';discount:number;ignoreGlobal:boolean} | {kind:'copyCardResource' | 'olympus' | 'viral' | 'energySale' | 'eventIncome' | 'jovianTr'} | {kind:'transferEnergyProduction'} | {kind:'attackStock';resource:MarsResource;amount:number;steal:boolean} | {kind:'removeCardResource';resource:MarsCardResource;amount:number} | {kind:'claimLand'} | {kind:'copyProduction'} | {kind:'protectHabitats'} | {kind:'exchangeCard'} | {kind:'nextCardDiscount';amount:8} | { kind: 'keepCards'; count: number; keep: number } | { kind: 'buyCard' } | {
    kind: 'stock' | 'production';
    resource: MarsResource;
    amount: number;
} | {
    kind: 'global';
    track: 'oxygen' | 'temperature' | 'tr';
    amount: number;
} | {
    kind: 'place';
    tile: MarsTileKind;
    rule: MarsPlacementRule;
} | {
    kind: 'draw' | 'removePlants';
    amount: number;
} | {
    kind: 'attackProduction';
    resource: MarsResource;
    amount: number;
} | {
    kind: 'add';
    resource: MarsCardResource;
    amount: number;
    self: boolean;
} | {
    kind: 'steal';
    resource: MarsCardResource;
} | {
    kind: 'consumeSelf';
    amount: number;
} | {
    kind: 'pay';
    amount: number;
    material: 'none' | 'steel' | 'titanium';
} | {
    kind: 'choice';
    options: readonly {
        label: string;
        effects: readonly MarsEffect[];
    }[];
} | {
    kind: 'dynamic';
    rule: 'citiesEnergy' | 'citiesPlants' | 'citiesMoney' | 'citiesIncome' | 'plantTags' | 'powerTags' | 'microbeTags' | 'nitrogen' | 'insulation' | 'search' | 'flooding' | 'specialDesign' | 'earthIncome' | 'buildingIncome' | 'spaceIncome' | 'opponentsSpaceIncome';
};
export type MarsRule = {
    name: string;
    effects: readonly MarsEffect[];
    actions?: readonly MarsEffect[];
    passive?: string;
};
const s = (resource: MarsResource, amount: number): MarsEffect => ({ kind: 'stock', resource, amount });
const p = (resource: MarsResource, amount: number): MarsEffect => ({ kind: 'production', resource, amount });
const g = (track: 'oxygen' | 'temperature' | 'tr', amount = 1): MarsEffect => ({ kind: 'global', track, amount });
const t = (tile: MarsTileKind, rule: MarsPlacementRule = 'normal'): MarsEffect => ({ kind: 'place', tile, rule });
const add = (resource: MarsCardResource, amount: number, self = false): MarsEffect => ({ kind: 'add', resource, amount, self });
const attack = (resource: MarsResource, amount: number): MarsEffect => ({ kind: 'attackProduction', resource, amount });
const burn = (amount: number): MarsEffect => ({ kind: 'removePlants', amount });
const draw = (amount: number): MarsEffect => ({ kind: 'draw', amount });
const pay = (amount: number, material: 'none' | 'steel' | 'titanium' = 'none'): MarsEffect => ({ kind: 'pay', amount, material });
const dynamic = (rule: Extract<MarsEffect, {
    kind: 'dynamic';
}>['rule']): MarsEffect => ({ kind: 'dynamic', rule });
const choice = (...options: {
    label: string;
    effects: readonly MarsEffect[];
}[]): MarsEffect => ({ kind: 'choice', options });
const microbes = (amount: number, track: 'oxygen' | 'temperature' | 'tr'): MarsEffect => choice({ label: '미생물 1 추가', effects: [add('microbe', 1, true)] }, { label: `미생물 ${amount} 사용`, effects: [{ kind: 'consumeSelf', amount }, g(track)] });
const r = (name: string, effects: readonly MarsEffect[] = [], actions?: readonly MarsEffect[], passive?: string): MarsRule => ({ name, effects, ...(actions ? { actions } : {}), ...(passive ? { passive } : {}) });
const RULES: Record<BaseMarsCardId, MarsRule> = {
    AdaptationTechnology: r('적응 기술', [], undefined, '전역 조건을 양방향으로 2단계 완화'),
    AdaptedLichen: r('적응된 지의류', [p('plants', 1)]),
    AdvancedEcosystems: r('발전된 생태계'),
    AerobrakedAmmoniaAsteroid: r('암모니아 소행성', [p('heat', 3), p('plants', 1), add('microbe', 2)]),
    Ants: r('개미', [], [{ kind: 'steal', resource: 'microbe' }]),
    AquiferPumping: r('대수층 펌프', [], [pay(8, 'steel'), t('ocean')]),
    Algae: r('조류', [s('plants', 1), p('plants', 2)]),
    ArchaeBacteria: r('고세균', [p('plants', 1)]),
    ArcticAlgae: r('극지 조류', [s('plants', 1)], undefined, '누군가 해양을 배치할 때마다 식물 2 획득'),
    ArtificialLake: r('인공 호수', [t('ocean', 'oceanLand')]),
    ArtificialPhotosynthesis: r('인공 광합성', [choice({ label: '식물 생산 +1', effects: [p('plants', 1)] }, { label: '에너지 생산 +2', effects: [p('energy', 2)] })]),
    Asteroid: r('소행성', [g('temperature'), s('titanium', 2), burn(3)]),
    AsteroidMining: r('소행성 채굴', [p('titanium', 2)]),
    BeamFromAThoriumAsteroid: r('토륨 소행성 에너지', [p('heat', 3), p('energy', 3)]),
    BigAsteroid: r('거대 소행성', [g('temperature', 2), s('titanium', 4), burn(4)]),
    BiomassCombustors: r('바이오매스 연소기', [attack('plants', 1), p('energy', 2)]),
    Birds: r('조류 동물', [attack('plants', 2)], [add('animal', 1, true)]),
    BlackPolarDust: r('검은 극지 먼지', [t('ocean'), p('money', -2), p('heat', 3)]),
    BreathingFilters: r('호흡 필터'),
    Bushes: r('관목', [p('plants', 2), s('plants', 2)]),
    Capital: r('수도', [p('energy', -2), p('money', 5), t('city')]),
    CarbonateProcessing: r('탄산염 처리', [p('energy', -1), p('heat', 3)]),
    CloudSeeding: r('인공 강우', [p('money', -1), attack('heat', 1), p('plants', 2)]),
    ColonizerTrainingCamp: r('개척자 훈련소'),
    Comet: r('혜성', [g('temperature'), t('ocean'), burn(3)]),
    ConvoyFromEuropa: r('유로파 수송대', [t('ocean'), draw(1)]),
    CupolaCity: r('큐폴라 도시', [p('energy', -1), p('money', 3), t('city')]),
    Decomposers: r('분해자', [], undefined, '내가 식물·동물·미생물 태그를 낼 때마다 해당 태그당 미생물 1 추가. 이 카드 포함'),
    DeepWellHeating: r('심층 지열', [p('energy', 1), g('temperature')]),
    DeimosDown: r('데이모스 추락', [g('temperature', 3), s('steel', 4), burn(8)]),
    DesignedMicroOrganisms: r('설계 미생물', [p('plants', 2)]),
    DomedCrater: r('돔 분화구', [s('plants', 3), p('energy', -1), p('money', 3), t('city')]),
    DustSeals: r('방진 밀폐'),
    EcologicalZone: r('생태 구역', [t('special', 'nextGreenery')], undefined, '내가 식물·동물 태그를 낼 때마다 해당 태그당 동물 1 추가. 이 카드 포함'),
    EnergySaving: r('에너지 절약', [dynamic('citiesEnergy')]),
    EosChasmaNationalPark: r('에오스 국립공원', [add('animal', 1), s('plants', 3), p('money', 2)]),
    EquatorialMagnetizer: r('적도 자기장', [], [p('energy', -1), g('tr')]),
    ExtremeColdFungus: r('극저온 균류', [], [choice({ label: '식물 1 획득', effects: [s('plants', 1)] }, { label: '다른 카드에 미생물 2', effects: [add('microbe', 2)] })]),
    Farming: r('농업', [p('money', 2), p('plants', 2), s('plants', 2)]),
    Fish: r('어류', [attack('plants', 1)], [add('animal', 1, true)]),
    Flooding: r('홍수', [t('ocean'), dynamic('flooding')]),
    FoodFactory: r('식품 공장', [p('plants', -1), p('money', 4)]),
    FusionPower: r('핵융합 발전', [p('energy', 3)]),
    FueledGenerators: r('연료 발전기', [p('money', -1), p('energy', 1)]),
    GanymedeColony: r('가니메데 식민지', [t('city', 'ganymede')]),
    GeothermalPower: r('지열 발전', [p('energy', 2)]),
    GHGFactories: r('온실가스 공장', [p('energy', -1), p('heat', 4)]),
    GHGProducingBacteria: r('온실가스 생산 박테리아', [], [microbes(2, 'temperature')]),
    GiantIceAsteroid: r('초대형 얼음 소행성', [g('temperature', 2), t('ocean'), t('ocean'), burn(6)]),
    GiantSpaceMirror: r('거대 우주 거울', [p('energy', 3)]),
    Grass: r('풀', [p('plants', 1), s('plants', 3)]),
    GreatDam: r('대형 댐', [p('energy', 2)]),
    Greenhouses: r('온실', [dynamic('citiesPlants')]),
    Heather: r('히스', [p('plants', 1), s('plants', 1)]),
    HeatTrappers: r('열 포집기', [attack('heat', 2), p('energy', 1)]),
    Herbivores: r('초식동물', [add('animal', 1, true), attack('plants', 1)], undefined, '내가 녹지를 배치할 때마다 동물 1 추가'),
    IceAsteroid: r('얼음 소행성', [t('ocean'), t('ocean')]),
    IceCapMelting: r('빙하 융해', [t('ocean')]),
    ImmigrantCity: r('이민 도시', [p('energy', -1), p('money', -2), t('city')], undefined, '누군가 도시를 배치할 때마다 M€ 생산 +1. 이 도시 포함'),
    ImmigrationShuttles: r('이민 수송선', [p('money', 5)]),
    ImportedGHG: r('온실가스 수입', [p('heat', 1), s('heat', 3)]),
    ImportedHydrogen: r('수소 수입', [choice({ label: '식물 3', effects: [s('plants', 3)] }, { label: '미생물 3', effects: [add('microbe', 3)] }, { label: '동물 2', effects: [add('animal', 2)] }), t('ocean')]),
    ImportedNitrogen: r('질소 수입', [g('tr'), s('plants', 4), add('microbe', 3), add('animal', 2)]),
    ImportOfAdvancedGHG: r('고성능 온실가스 수입', [p('heat', 2)]),
    IndustrialMicrobes: r('산업 미생물', [p('energy', 1), p('steel', 1)]),
    Insects: r('곤충', [dynamic('plantTags')]),
    Insulation: r('단열', [dynamic('insulation')]),
    Ironworks: r('제철소', [], [s('energy', -4), s('steel', 1), g('oxygen')]),
    KelpFarming: r('다시마 양식', [p('money', 2), p('plants', 3), s('plants', 2)]),
    LakeMarineris: r('마리네리스 호수', [t('ocean'), t('ocean')]),
    LargeConvoy: r('대형 수송대', [t('ocean'), draw(2), choice({ label: '식물 5', effects: [s('plants', 5)] }, { label: '동물 4', effects: [add('animal', 4)] })]),
    LavaFlows: r('용암 흐름', [g('temperature', 2), t('special', 'volcano')]),
    Lichen: r('지의류', [p('plants', 1)]),
    Livestock: r('가축', [p('plants', -1), p('money', 2)], [add('animal', 1, true)]),
    LocalHeatTrapping: r('국지 열 포집', [s('heat', -5), choice({ label: '식물 4', effects: [s('plants', 4)] }, { label: '동물 2', effects: [add('animal', 2)] })]),
    LunarBeam: r('달 에너지 빔', [p('money', -2), p('heat', 2), p('energy', 2)]),
    MagneticFieldDome: r('자기장 돔', [p('energy', -2), p('plants', 1), g('tr')]),
    MagneticFieldGenerators: r('자기장 생성기', [p('energy', -4), p('plants', 2), g('tr', 3)]),
    Mangrove: r('맹그로브', [t('greenery', 'greeneryOcean')]),
    MartianRails: r('화성 철도', [], [s('energy', -1), dynamic('citiesMoney')]),
    MethaneFromTitan: r('타이탄 메탄', [p('heat', 2), p('plants', 2)]),
    MicroMills: r('소형 공장', [p('heat', 1)]),
    MiningExpedition: r('채굴 원정', [g('oxygen'), burn(2), s('steel', 2)]),
    MiningRights: r('채굴권', [t('special', 'mining')]),
    MoholeArea: r('모홀 구역', [p('heat', 4), t('special', 'oceanSpecial')]),
    Moss: r('이끼', [s('plants', -1), p('plants', 1)]),
    NaturalPreserve: r('자연 보호구역', [t('special', 'isolated'), p('money', 1)]),
    NitriteReducingBacteria: r('아질산 환원균', [add('microbe', 3, true)], [microbes(3, 'tr')]),
    NitrogenRichAsteroid: r('질소 풍부 소행성', [g('tr', 2), g('temperature'), dynamic('nitrogen')]),
    NitrophilicMoss: r('호질소성 이끼', [s('plants', -2), p('plants', 2)]),
    NoctisCity: r('녹티스 시티', [p('energy', -1), p('money', 3), t('city', 'noctis')]),
    NoctisFarming: r('녹티스 농장', [p('money', 1), s('plants', 2)]),
    NuclearPower: r('원자력 발전', [p('money', -2), p('energy', 3)]),
    NuclearZone: r('핵실험 구역', [t('special'), g('temperature', 2)]),
    OpenCity: r('개방 도시', [s('plants', 2), p('energy', -1), p('money', 4), t('city')]),
    OptimalAerobraking: r('최적 대기 감속', [], undefined, '내가 우주 이벤트를 낼 때마다 M€ 3와 열 3 획득'),
    OreProcessor: r('광석 처리기', [], [s('energy', -4), s('titanium', 1), g('oxygen')]),
    PermafrostExtraction: r('영구동토 추출', [t('ocean')]),
    PeroxidePower: r('과산화물 발전', [p('money', -1), p('energy', 2)]),
    Pets: r('반려동물', [add('animal', 1, true)], undefined, '누군가 도시를 배치할 때마다 동물 1 추가. 이 카드의 동물은 제거 불가'),
    PhobosSpaceHaven: r('포보스 우주항', [p('titanium', 1), t('city', 'phobos')]),
    Plantation: r('플랜테이션', [t('greenery')]),
    PowerGrid: r('전력망', [dynamic('powerTags')]),
    PowerPlant: r('발전소', [p('energy', 1)]),
    Predators: r('포식자', [], [{ kind: 'steal', resource: 'animal' }]),
    ProtectedValley: r('보호 계곡', [p('money', 2), t('greenery', 'greeneryOcean')]),
    RadChemFactory: r('방사화학 공장', [p('energy', -1), g('tr', 2)]),
    RegolithEaters: r('표토 섭식균', [], [microbes(2, 'oxygen')]),
    ReleaseOfInertGases: r('불활성 기체 방출', [g('tr', 2)]),
    ResearchOutpost: r('연구 전초기지', [t('city', 'isolated')], undefined, '모든 프로젝트 카드 비용 1 M€ 할인'),
    RoverConstruction: r('로버 건설', [], undefined, '누군가 도시를 배치할 때마다 M€ 2 획득'),
    SearchForLife: r('생명체 탐사', [], [pay(1), dynamic('search')]),
    Shuttles: r('우주 왕복선', [p('energy', -1), p('money', 2)], undefined, '우주 태그 프로젝트 카드 비용 2 M€ 할인'),
    SmallAnimals: r('소형 동물', [attack('plants', 1)], [add('animal', 1, true)]),
    SoilFactory: r('토양 공장', [p('energy', -1), p('plants', 1)]),
    SolarPower: r('태양광 발전', [p('energy', 1)]),
    SolarWindPower: r('태양풍 발전', [p('energy', 1), s('titanium', 2)]),
    Soletta: r('솔레타', [p('heat', 7)]),
    SpaceMirrors: r('우주 거울', [], [pay(7), p('energy', 1)]),
    SpecialDesign: r('특수 설계', [dynamic('specialDesign')]),
    Steelworks: r('제강소', [], [s('energy', -4), s('steel', 2), g('oxygen')]),
    StripMine: r('노천 광산', [p('energy', -2), p('steel', 2), p('titanium', 1), g('oxygen', 2)]),
    SubterraneanReservoir: r('지하 저수지', [t('ocean')]),
    SymbioticFungus: r('공생 균류', [], [add('microbe', 1)]),
    TectonicStressPower: r('지각 응력 발전', [p('energy', 3)]),
    TowingAComet: r('혜성 견인', [s('plants', 2), g('oxygen'), t('ocean')]),
    Trees: r('나무', [p('plants', 3), s('plants', 1)]),
    TundraFarming: r('툰드라 농업', [p('plants', 1), p('money', 2), s('plants', 1)]),
    UndergroundCity: r('지하 도시', [p('energy', -2), p('steel', 2), t('city')]),
    UndergroundDetonations: r('지하 폭발', [], [pay(10), p('heat', 2)]),
    UrbanizedArea: r('도시화 구역', [p('energy', -1), p('money', 2), t('city', 'twoCities')]),
    WaterImportFromEuropa: r('유로파 물 수입', [], [pay(12, 'titanium'), t('ocean')]),
    WaterSplittingPlant: r('물 분해 공장', [], [s('energy', -3), g('oxygen')]),
    WavePower: r('파력 발전', [p('energy', 1)]),
    Windmills: r('풍력 발전', [p('energy', 1)]),
    Worms: r('벌레', [dynamic('microbeTags')]),
    Zeppelins: r('비행선', [dynamic('citiesIncome')]),
};
export type MarsDefinition = {
    corporateRequirements?: readonly MarsCorporateRequirement[];
    id: MarsCardId;
    name: string;
    englishName: string;
    number: string;
    cost: number;
    tags: readonly string[];
    requirements: readonly {
        kind: string;
        amount: number;
        max: boolean;
    }[];
    type: string;
    score: string;
    points: number;
    resourceScore: MarsResourceScore | null;
    resource: string | null;
    art: number;
} & MarsRule;
export const MARS_CARDS: readonly MarsDefinition[] = MARS_CARD_FACTS.map(f => { const tags: readonly string[] = f.id === 'MiningRights' ? ['building'] : f.tags; return { ...f, resourceScore: f.score === 'resources' ? { per: f.points, points: 1 } : null, ...RULES[f.id], name: MARS_KOREAN_NAMES[f.id] ?? RULES[f.id].name, englishName: f.name, tags, art: tags.includes('animal') ? 9 : tags.includes('microbe') ? 8 : tags.includes('plant') ? 1 : tags.includes('city') ? 0 : tags.includes('power') ? 6 : tags.includes('space') ? (f.type === 'event' ? 3 : 5) : tags.includes('science') ? 11 : tags.includes('building') ? 4 : 2 }; });
export const MARS_CORPORATE_CARDS: readonly MarsDefinition[] = MARS_PREPARED_CORPORATE_CARDS.map(c => ({
    ...c, name: MARS_KOREAN_NAMES[c.id] ?? c.englishName, corporateRequirements: c.requirements,
    requirements: c.requirements.map(r => r.kind === 'global' ? {kind:r.track,amount:r.amount,max:r.max} : {kind:r.kind === 'tag' ? r.tag : r.kind === 'production' ? `${MARS_RESOURCE_NAMES[r.resource]} 생산` : '전체 도시',amount:r.amount,max:false}),
    score: c.score.kind === 'tag' ? c.score.tag : c.score.kind,
    points: 'points' in c.score ? c.score.points : 0,
    resourceScore: c.score.kind === 'resources' ? {per:c.score.per,points:c.score.points} : null,
    art: c.tags.includes('microbe') ? 8 : c.tags.includes('city') ? 0 : c.tags.includes('power') ? 6 : c.tags.includes('space') ? 5 : c.tags.includes('science') ? 11 : c.tags.includes('building') ? 4 : 2,
}));
export const MARS_ALL_CARDS: readonly MarsDefinition[] = [...MARS_CARDS, ...MARS_CORPORATE_CARDS];
export const MARS_PRELUDES: readonly MarsDefinition[] = MARS_PRELUDE_FACTS.map(f => ({cost:0,type:'prelude',score:'fixed',points:0,resourceScore:null,resource:null,requirements:[],art:marsPreludeArt(f.id,f.tags,f.effects),...(f.tags.some(t=>t==='wild')?{passive:'행동의 조건·효과·업적에 와일드 태그 사용. 태그 반응·기업상·종료 점수에는 제외'}:{}),...f}));
export const MARS_PRELUDE_PROJECTS: readonly MarsDefinition[] = MARS_PRELUDE_PROJECT_FACTS.map(f => ({type:'automated',score:'fixed',points:0,resourceScore:null,resource:null,requirements:[],art:f.tags.some(t=>t==='science')?11:f.tags.some(t=>t==='microbe')?8:4,...f}));
export function marsProjectCatalog(corporateEra = false, prelude = false): readonly MarsDefinition[] {return [...(corporateEra?MARS_ALL_CARDS:MARS_CARDS),...(prelude?MARS_PRELUDE_PROJECTS:[])];}
export function marsCard(id: string): MarsDefinition { const c = [...MARS_ALL_CARDS,...MARS_PRELUDE_PROJECTS,...MARS_PRELUDES].find(c => c.id === id); if (!c)
    throw new Error('Unknown Mars card'); return c; }
export const MARS_TAG_NAMES: Record<string, string> = { wild: '와일드', building: '건물', space: '우주', science: '과학', plant: '식물', animal: '동물', microbe: '미생물', earth: '지구', jovian: '목성', power: '에너지', city: '도시' };
export function marsEffectText(e: MarsEffect): string {
    switch (e.kind) {
        case 'drawTag': return `${MARS_TAG_NAMES[e.tag]} 태그 카드 ${e.amount}장까지 공개하며 찾기`;
        case 'instantProject': return `손패 프로젝트 1장 즉시 실행 · ${e.ignoreGlobal?'전역 조건 무시':`${e.discount} M€ 할인`}`;
        case 'copyCardResource': return '자원이 있는 내 카드에 같은 자원 +1';
        case 'olympus': return '올림푸스 회의 · 과학 자원 추가 또는 카드 뽑기';
        case 'viral': return '바이러스 강화제 · 식물 또는 방금 낸 카드의 자원 추가';
        case 'energySale': return '원하는 에너지를 같은 수의 M€로 전환';
        case 'eventIncome': return '모두가 낸 이벤트마다 M€ +1';
        case 'jovianTr': return '이 카드를 포함한 내 목성 태그마다 TR +1';
        case 'attackStock': return `${e.steal?'상대 자원 탈취':'자원 제거'} · ${MARS_RESOURCE_NAMES[e.resource]} 최대 ${e.amount} (선택)`;
        case 'removeCardResource': return `카드 1장의 ${MARS_CARD_RESOURCE_NAMES[e.resource]} 최대 ${e.amount} 제거 (선택)`;
        case 'claimLand': return '빈 육지 1칸 예약 · 나만 타일 배치 가능';
        case 'copyProduction': return '내 건물 카드 1장의 생산량 상자만 복제 (감소 포함)';
        case 'protectHabitats': return '상대의 식물·동물·미생물 제거로부터 보호';
        case 'exchangeCard': return '손패 1장을 버리고 1장 뽑기 (선택)';
        case 'nextCardDiscount': return '이번 세대 다음 프로젝트 카드 비용 8 M€ 할인';
        case 'stock':
        case 'production': return `${MARS_RESOURCE_NAMES[e.resource]}${e.kind === 'production' ? ' 생산' : ''} ${e.amount >= 0 ? '+' : ''}${e.amount}`;
        case 'global': return `${{ oxygen: '산소', temperature: '기온', tr: 'TR' }[e.track]} +${e.amount}${e.track === 'tr' ? '' : '단계'}`;
        case 'place': return `${{ city: '도시', greenery: '녹지', ocean: '해양', special: '특수 타일' }[e.tile]} 배치${e.rule === 'normal' ? '' : ` · ${{ nextCity: '도시 인접', miningArea: '내 타일 인접 금속 보너스 칸', oceanLand: '육지 칸', greeneryOcean: '해양 예약 칸', oceanSpecial: '해양 예약 칸', isolated: '다른 타일과 비인접', nextGreenery: '녹지 인접', twoCities: '도시 2개 이상 인접', volcano: '화산', mining: '강철·티타늄 보너스 칸', noctis: '녹티스 예약 칸', phobos: '포보스', ganymede: '가니메데' }[e.rule]}`}`;
        case 'keepCards': return `카드 ${e.count}장 열람 후 ${e.keep}장 선택`;
        case 'buyCard': return '카드 1장 열람 후 3 M€로 구매하거나 버리기';
        case 'draw': return `카드 ${e.amount}장 획득`;
        case 'removePlants': return `한 플레이어 식물 최대 ${e.amount} 제거(선택)`;
        case 'attackProduction': return `플레이어 1명의 ${MARS_RESOURCE_NAMES[e.resource]} 생산 −${e.amount}`;
        case 'transferEnergyProduction': return '에너지 생산 1 이전 · 모두 0이면 내 생산 0 유지';
        case 'add': return `${e.self ? '이 카드' : '다른 내 카드'}에 ${MARS_CARD_RESOURCE_NAMES[e.resource]} +${e.amount}`;
        case 'steal': return `카드에서 ${MARS_CARD_RESOURCE_NAMES[e.resource]} 1 제거 → 이 카드에 1 추가`;
        case 'consumeSelf': return `이 카드 자원 ${e.amount} 사용`;
        case 'pay': return `${e.amount} M€ 지불${e.material === 'none' ? '' : `(${MARS_RESOURCE_NAMES[e.material]} 사용 가능)`}`;
        case 'choice': return e.options.map(o => o.label).join(' 또는 ');
        case 'dynamic': return { citiesEnergy: '전체 도시마다 에너지 생산 +1', citiesPlants: '전체 도시마다 식물 +1', citiesMoney: '화성 도시마다 M€ +1', citiesIncome: '화성 도시마다 M€ 생산 +1', plantTags: '내 식물 태그마다 식물 생산 +1', powerTags: '이 카드를 포함한 내 에너지 태그마다 에너지 생산 +1', microbeTags: '이 카드를 포함한 내 미생물 태그 2개당 식물 생산 +1', nitrogen: '식물 생산 +1(내 식물 태그 3개 이상이면 +4)', insulation: '선택한 열 생산량을 같은 수의 M€ 생산량으로 전환', search: '덱 맨 위를 공개·버림. 미생물 태그면 과학 자원 +1', flooding: '방금 해양에 인접한 소유자 1명의 M€ 최대 4 제거(선택)', specialDesign: '이번 세대 다음 프로젝트의 전역 조건을 양방향 2단계 완화', earthIncome: '이 카드를 포함한 내 지구 태그마다 M€ 생산 +1', buildingIncome: '이 카드를 포함한 내 건물 태그 2개당 M€ 생산 +1', spaceIncome: '이 카드를 포함한 내 우주 태그마다 M€ 생산 +1', opponentsSpaceIncome: '상대방들의 우주 태그마다 M€ 생산 +1' }[e.rule];
    }
}
export function marsCardDescription(c: MarsDefinition): string { return [...c.effects.map(marsEffectText), ...(c.actions ? [`행동: ${c.actions.map(marsEffectText).join(' · ')}`] : []), ...(c.passive ? [c.passive] : [])].join(' · ') || '조건을 충족하면 종료 점수를 얻습니다.'; }
export const MARS_CORPORATIONS = [
    { id: 'CrediCor', name: '크레디코르', money: 57, tags: [], art: 10, text: '기본 비용 20 M€ 이상 카드 또는 일반 프로젝트 실행 후 M€ 4 환급' },
    { id: 'EcoLine', name: '에코라인', money: 36, tags: ['plant'], art: 1, text: '식물 생산 +2, 식물 3. 녹지 전환에 식물 7개 사용' },
    { id: 'Helion', name: '헬리온', money: 42, tags: ['space'], art: 7, text: '열 생산 +3. M€ 대신 열을 1:1로 지불 가능' },
    { id: 'InterplanetaryCinematics', name: '인터플래너터리 시네마틱스', money: 30, tags: ['building'], art: 10, text: '강철 20. 이벤트 카드 실행 후 M€ 2 획득' },
    { id: 'Inventrix', name: '인벤트릭스', money: 45, tags: ['science'], art: 11, text: '첫 행동으로 카드 3장 획득. 전역 조건 양방향 2단계 완화' },
    { id: 'MiningGuild', name: '광업협동조합', money: 30, tags: ['building', 'building'], art: 4, text: '강철 5, 강철 생산 +1. 강철·티타늄 배치 보너스 획득 시 강철 생산 +1' },
    { id: 'PhoboLog', name: '포볼로그', money: 23, tags: ['space'], art: 5, text: '티타늄 10. 티타늄의 지불 가치는 4 M€' },
    { id: 'TharsisRepublic', name: '타르시스 공화국', money: 40, tags: ['building'], art: 0, text: '첫 행동으로 도시 배치. 화성 도시마다 M€ 생산 +1, 내가 도시를 배치하면 M€ 3 획득' },
    { id: 'Thorgate', name: '토르게이트', money: 48, tags: ['power'], art: 6, text: '에너지 생산 +1. 에너지 태그 카드와 일반 발전소 비용 3 M€ 할인' },
    { id: 'UnitedNationsMarsInitiative', name: '국제연합 화성계획', money: 40, tags: ['earth'], art: 11, text: '행동: 이번 세대 TR을 올렸다면 3 M€로 TR +1(세대당 1회)' },
] as const;
export const MARS_ALL_CORPORATIONS = [...MARS_CORPORATIONS,
    {id:'SaturnSystems',name:'새턴 시스템',money:42,tags:['jovian'],art:5,text:'티타늄 생산 +1. 누구든 목성 태그를 내면 내 M€ 생산 +1. 자기 기업 태그 포함'},
    {id:'Teractor',name:'테렉터',money:60,tags:['earth'],art:10,text:'지구 태그 프로젝트 비용 3 M€ 할인'},
];
export function marsCorporation(id: string) { if (id === 'Beginner')
    return { id: 'Beginner', name: '초보자 기업', money: 42, tags: [] as readonly string[], art: 10, text: '초기 카드 10장을 무료로 획득' }; const c = [...MARS_ALL_CORPORATIONS,...MARS_PRELUDE_CORPORATIONS].find(c => c.id === id); if (!c)
    throw new Error('Unknown Mars corporation'); return c; }

export function marsCorporationCatalog(corporateEra=false,prelude=false){return [...(corporateEra?MARS_ALL_CORPORATIONS:MARS_CORPORATIONS),...(prelude?MARS_PRELUDE_CORPORATIONS:[])];}

function marsPreludeArt(id:string,tags:readonly string[],effects:readonly MarsEffect[]):number {
 if(id.includes('Asteroid'))return 3;
 if(effects.some(e=>e.kind==='place'&&e.tile==='city'))return 0;
 if(tags.includes('science'))return 11;
 if(tags.includes('plant')||effects.some(e=>e.kind==='place'&&e.tile==='greenery'))return 1;
 if(tags.includes('microbe'))return 8;
 if(effects.some(e=>e.kind==='place'&&e.tile==='ocean'))return 2;
 if(tags.includes('space')||tags.includes('jovian'))return 5;
 if(tags.includes('power'))return 6;
 if(effects.some(e=>e.kind==='production'&&e.resource==='heat'))return 7;
 if(tags.includes('building')||effects.some(e=>(e.kind==='stock'||e.kind==='production')&&['steel','titanium'].includes(e.resource)))return 4;
 return 10;
}
