import type { MarsRule } from './catalog.js';

export const MARS_CORPORATE_SPECIAL: Readonly<Record<string, MarsRule>> = {
    CEOsFavoriteProject: { name: 'CEO’s Favorite Project', effects: [{kind:'copyCardResource'}] },
    CommercialDistrict: { name: 'Commercial District', effects: [{kind:'production',resource:'energy',amount:-1},{kind:'production',resource:'money',amount:4},{kind:'place',tile:'special',rule:'normal'}] },
    IndustrialCenter: { name: 'Industrial Center', effects: [{kind:'place',tile:'special',rule:'nextCity'}], actions:[{kind:'pay',amount:7,material:'none'},{kind:'production',resource:'steel',amount:1}] },
    MiningArea: { name:'Mining Area',effects:[{kind:'place',tile:'special',rule:'miningArea'}] },
    RestrictedArea: {name:'Restricted Area',effects:[{kind:'place',tile:'special',rule:'normal'}],actions:[{kind:'pay',amount:2,material:'none'},{kind:'draw',amount:1}]},
    ElectroCatapult: {name:'Electro Catapult',effects:[{kind:'production',resource:'energy',amount:-1}],actions:[{kind:'choice',options:[{label:'식물 1 → 7 M€',effects:[{kind:'stock',resource:'plants',amount:-1},{kind:'stock',resource:'money',amount:7}]},{label:'강철 1 → 7 M€',effects:[{kind:'stock',resource:'steel',amount:-1},{kind:'stock',resource:'money',amount:7}]}]}]},
    PowerInfrastructure: {name:'Power Infrastructure',effects:[],actions:[{kind:'energySale'}]},
    MediaArchives: {name:'Media Archives',effects:[{kind:'eventIncome'}]},
    TerraformingGanymede: {name:'Terraforming Ganymede',effects:[{kind:'jovianTr'}]},
    OlympusConference: {name:'Olympus Conference',effects:[],passive:'과학 태그마다 과학 자원 +1 또는 과학 자원 1개를 카드 1장으로 교환. 자기 태그 포함'},
    ViralEnhancers: {name:'Viral Enhancers',effects:[],passive:'식물·동물·미생물 태그마다 식물 +1 또는 방금 낸 카드에 동물/미생물 +1. 자기 태그 포함'},
};
