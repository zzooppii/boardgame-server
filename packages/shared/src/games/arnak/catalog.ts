import type { ArnakResource, ArnakResources, ArnakTravel } from './actions.js';
import { ARNAK_CARD_FACTS } from './card-facts.js';
export const ARNAK_RESOURCES: readonly ArnakResource[] = ['coin', 'compass', 'tablet', 'arrow', 'jewel'];
export const ARNAK_RESOURCE_NAMES: Record<ArnakResource, string> = { coin: '금화', compass: '나침반', tablet: '석판', arrow: '화살촉', jewel: '보석' };
export const ARNAK_TRAVEL_NAMES: Record<ArnakTravel, string> = { foot: '도보', car: '자동차', boat: '배', plane: '비행기' };
export function arnakResources(part: Partial<ArnakResources> = {}): ArnakResources { return { coin: 0, compass: 0, tablet: 0, arrow: 0, jewel: 0, ...part }; }
export function arnakCostText(cost: Partial<ArnakResources>): string { return ARNAK_RESOURCES.filter(k => cost[k]).map(k => `${ARNAK_RESOURCE_NAMES[k]} ${cost[k]}`).join(' · ') || '비용 없음'; }
export type ArnakEffectKind = 'gain' | 'draw' | 'exile' | 'discard' | 'fear' | 'trade' | 'travel' | 'assistant' | 'upgrade' | 'refresh' | 'resourceUpgrade' | 'buy' | 'research' | 'activate' | 'deploy' | 'relocate' | 'overcome' | 'special' | 'peekKeep' | 'peekReturn' | 'choice' | 'payTravel';
export type ArnakEffect = Readonly<{
    kind: ArnakEffectKind;
    amount?: number;
    value?: Partial<ArnakResources>;
    cost?: Partial<ArnakResources>;
    mode?: string;
    level?: number;
    travel?: readonly ArnakTravel[];
    after?: readonly ArnakEffect[];
    choices?: readonly (readonly ArnakEffect[])[];
}>;
export const gain = (value: Partial<ArnakResources>): ArnakEffect => ({ kind: 'gain', value });
const draw = (amount = 1): ArnakEffect => ({ kind: 'draw', amount });
const exile: ArnakEffect = { kind: 'exile' }, refresh: ArnakEffect = { kind: 'refresh' }, resourceUpgrade: ArnakEffect = { kind: 'resourceUpgrade' };
const special = (mode: string): ArnakEffect => ({ kind: 'special', mode });
const activate = (level: number, mode = 'any'): ArnakEffect => ({ kind: 'activate', level, mode });
const deploy = (travel: readonly ArnakTravel[], amount = 0): ArnakEffect => ({ kind: 'deploy', travel, amount });
const buy = (mode: string, amount: number, level = 0): ArnakEffect => ({ kind: 'buy', mode, amount, level });
const trade = (cost: Partial<ArnakResources>, ...after: ArnakEffect[]): ArnakEffect => ({ kind: 'trade', cost, after });
const discard = (...after: ArnakEffect[]): ArnakEffect => ({ kind: 'discard', after });
export type ArnakCardDefinition = Readonly<{
    id: string;
    name: string;
    englishName: string;
    type: 'starter' | 'fear' | 'item' | 'artifact';
    cost: number;
    points: number;
    travel: readonly ArnakTravel[];
    free: boolean;
    exileSelf: boolean;
    effects: readonly string[];
    passEffects: readonly string[];
    art: number;
}>;
const effectMap = new Map<string, ArnakEffect>();
export function registerArnakEffects(prefix: string, effects: readonly ArnakEffect[]): string[] { return effects.map((e, i) => { const id = `${prefix}/${i}`; effectMap.set(id, e); if (e.after)
    registerArnakEffects(id + '/after', e.after); e.choices?.forEach((c, j) => registerArnakEffects(id + '/choice/' + j, c)); return id; }); }
export function arnakEffect(id: string): ArnakEffect { const e = effectMap.get(id); if (!e)
    throw new Error('Unknown Arnak effect.'); return e; }
type CardSpec = readonly [
    string,
    readonly ArnakEffect[],
    boolean?,
    boolean?,
    passEffects?: readonly ArnakEffect[]
];
const specs: Record<string, CardSpec> = {
    '0101': ['탐사 일지', [{ kind: 'research', mode: 'notebook', amount: 99 }], false, true],
    '0102': ['탐험견', [gain({ compass: 1 }), activate(0, 'unoccupied')]],
    '0103': ['수통', [draw(3)], false, true],
    '0104': ['쌍안경', [activate(1)]],
    '0105': ['말', [draw(), gain({ coin: 1, compass: 1 })]],
    '0106': ['전서구', [gain({ tablet: 2 })], true],
    '0107': ['모종삽', [trade({ compass: 1 }, gain({ jewel: 1 }))]],
    '0108': ['회중시계', [gain({ coin: 2 })], true, false, [gain({ coin: 3 })]],
    '0109': ['밧줄', [discard(draw(2))]],
    '0110': ['타조', [draw(), deploy(['car'])]],
    '0111': ['튼튼한 장화', [gain({ compass: 1 }), deploy(['foot', 'foot'])]],
    '0112': ['공중 보급', [buy('item-hand', 99)], false, true],
    '0113': ['리볼버', [trade({ compass: 1 }, { kind: 'overcome', mode: 'own' })]],
    '0114': ['유물 붓', [special('brush')]],
    '0115': ['큰 배낭', [gain({ coin: 1 }), { kind: 'draw', amount: 1, mode: 'bottom' }]],
    '0116': ['간략한 지도', [gain({ compass: 3 })], false, true],
    '0117': ['짐 나르는 당나귀', [draw(2)]],
    '0118': ['횃불', [exile, gain({ tablet: 1 })]],
    '0119': ['곡괭이', [trade({ compass: 1 }, gain({ tablet: 1, arrow: 1 }))]],
    '0120': ['정밀 나침반', [buy('artifact-peek', 3)]],
    '0121': ['도끼', [exile, gain({ compass: 1 })]],
    '0122': ['랜턴', [activate(0)]],
    '0123': ['활과 화살', [special('bow')]],
    '0124': ['열기구', [deploy(['plane'], 3)], false, true],
    '0125': ['자동차', [gain({ compass: 2 })], true],
    '0126': ['다용도 칼', [special('knife')]],
    '0127': ['바다거북', [draw(), deploy(['boat'])]],
    '0128': ['텐트', [{ kind: 'activate', mode: 'own', level: 3 }]],
    '0129': ['갈고리', [discard(draw(), exile)]],
    '0130': ['사금 채취 접시', [gain({ coin: 2 })], true],
    '0131': ['비행기', [deploy(['plane'], 2)]],
    '0132': ['정밀 시계', [gain({ coin: 1, compass: 1 })], true, false, [gain({ compass: 3 })]],
    '0133': ['곰 덫', [{ kind: 'overcome', mode: 'no-opponent' }], false, true],
    '0134': ['마체테', [exile, gain({ compass: 2 })]],
    '0135': ['낚싯대', [buy('item-peek', 3)]],
    '0136': ['탐험 모자', [gain({ coin: 1, compass: 1 })], true],
    '0137': ['채찍', [buy('artifact', 4)], false, true],
    '0138': ['앵무새', [discard(gain({ jewel: 1 }))]],
    '0139': ['측량기', [gain({ coin: 1 }), special('theodolite')]],
    '0140': ['증기선', [gain({ compass: 2 })], true],
    '0201': ['보물 상자', [draw(), gain({ coin: 1 })]],
    '0202': ['길잡이 해골', [trade({ compass: 1 }, activate(2, 'stack'))]],
    '0203': ['사냥의 화살', [{ kind: 'fear', after: [gain({ arrow: 2 })] }]],
    '0204': ['죽은 자의 룬', [{ kind: 'fear', after: [gain({ coin: 1, tablet: 3 })] }]],
    '0205': ['길잡이 지팡이', [{ kind: 'relocate', level: 1 }]],
    '0206': ['의식용 단검', [exile, gain({ arrow: 1 })]],
    '0207': ['원숭이 메달', [buy('item-top', 99)]],
    '0208': ['호랑이 발톱 비녀', [exile, activate(0, 'unoccupied')]],
    '0209': ['신성한 북', [discard(refresh, refresh)]],
    '0210': ['전쟁 곤봉', [{ kind: 'overcome', mode: 'own' }]],
    '0211': ['흑요석 귀고리', [special('obsidian')]],
    '0212': ['상인의 저울', [resourceUpgrade, gain({ coin: 3 })]],
    '0213': ['장식 망치', [special('hammer')]],
    '0214': ['수정 귀고리', [special('crystal')]],
    '0215': ['수호자의 왕관', [special('crown')]],
    '0216': ['별자리 지도', [trade({ coin: 1 }, special('two-base'))]],
    '0217': ['수호자의 오카리나', [special('ocarina')]],
    '0218': ['뱀의 금', [{ kind: 'fear', after: [gain({ coin: 4 })] }]],
    '0219': ['상인의 동전', [resourceUpgrade, gain({ coin: 2 })]],
    '0220': ['정화의 솥', [draw(), exile]],
    '0221': ['절구', [exile, gain({ coin: 2 })]],
    '0222': ['오래된 포도주', [gain({ coin: 1 }), { kind: 'assistant', mode: 'gold-copy' }]],
    '0223': ['통로의 조개', [{ kind: 'deploy', level: 0, amount: 99, travel: ['plane', 'plane'], mode: 'twice' }]],
    '0224': ['아라아누의 우상', [{ kind: 'research', value: { jewel: 1 } }]],
    '0225': ['길잡이 샌들', [{ kind: 'relocate', level: 0 }]],
    '0226': ['전쟁 가면', [gain({ arrow: 1 }), special('war-mask')]],
    '0227': ['코코넛 물병', [gain({ coin: 2 }), { kind: 'assistant', mode: 'silver-copy' }]],
    '0228': ['길잡이 돌', [activate(1, 'stack')]],
    '0229': ['돌 열쇠', [special('stone-key')]],
    '0230': ['의식용 딸랑이', [refresh]],
    '0231': ['뱀 우상', [{ kind: 'fear', after: [gain({ jewel: 1 })] }]],
    '0232': ['돌 항아리', [draw()]],
    '0233': ['문자가 새겨진 칼', [special('research-discount')]],
    '0234': ['장식 뿔피리', [{ kind: 'assistant', mode: 'exchange' }]],
    '0235': ['해시계', [gain({ tablet: 2 })], false, false, [gain({ jewel: 1 })]],
};
const cardArt:Record<string,number>={"0101": 4, "0102": 13, "0103": 9, "0104": 6, "0105": 13, "0106": 7, "0107": 5, "0108": 0, "0109": 5, "0110": 14, "0111": 6, "0112": 11, "0113": 5, "0114": 5, "0115": 6, "0116": 0, "0117": 6, "0118": 15, "0119": 5, "0120": 0, "0121": 5, "0122": 15, "0123": 5, "0124": 0, "0125": 6, "0126": 5, "0127": 12, "0128": 6, "0129": 5, "0130": 1, "0131": 0, "0132": 0, "0133": 5, "0134": 5, "0135": 5, "0136": 6, "0137": 5, "0138": 7, "0139": 6, "0140": 0, "0201": 11, "0202": 8, "0203": 5, "0204": 2, "0205": 8, "0206": 9, "0207": 8, "0208": 13, "0209": 9, "0210": 5, "0211": 3, "0212": 1, "0213": 5, "0214": 3, "0215": 8, "0216": 0, "0217": 10, "0218": 1, "0219": 1, "0220": 9, "0221": 9, "0222": 9, "0223": 9, "0224": 8, "0225": 6, "0226": 8, "0227": 9, "0228": 2, "0229": 2, "0230": 10, "0231": 12, "0232": 9, "0233": 5, "0234": 10, "0235": 0};
export const ARNAK_CARDS: readonly ArnakCardDefinition[] = [
    ...(['funding-car', 'funding-boat', 'exploration-car', 'exploration-boat'] as const).map((id): ArnakCardDefinition => ({ id, name: id.startsWith('funding') ? '자금 지원' : '탐험', englishName: id.startsWith('funding') ? 'Funding' : 'Exploration', type: 'starter', cost: 0, points: 0, travel: [id.endsWith('car') ? 'car' : 'boat'], free: true, exileSelf: false, effects: registerArnakEffects(id, [gain(id.startsWith('funding') ? { coin: 1 } : { compass: 1 })]), passEffects: [], art: id.startsWith('funding') ? 1 : 0 })),
    { id: 'fear', name: '공포', englishName: 'Fear', type: 'fear', cost: 0, points: -1, travel: ['foot'], free: false, exileSelf: false, effects: [], passEffects: [], art: 12 },
    ...ARNAK_CARD_FACTS.map((fact): ArnakCardDefinition => { const spec = specs[fact.id]; if (!spec)
        throw new Error('Missing Arnak card effects.'); return { id: fact.id, name: spec[0], englishName: fact.name, type: fact.type, cost: fact.cost, points: fact.points, travel: fact.travel, free: spec[2] ?? false, exileSelf: spec[3] ?? false, effects: registerArnakEffects(fact.id, spec[1]), passEffects: registerArnakEffects(fact.id + '/pass', spec[4] ?? []), art: cardArt[fact.id] ?? 8 }; })
];
export function arnakCard(id: string): ArnakCardDefinition { const c = ARNAK_CARDS.find(c => c.id === id); if (!c)
    throw new Error('Unknown Arnak card.'); return c; }
export const ARNAK_IDOL_EFFECTS = registerArnakEffects('idol', [trade({ coin: 1 }, gain({ jewel: 1 })), gain({ arrow: 1 }), gain({ tablet: 2 }), gain({ coin: 1, compass: 1 }), draw()]);
export const ARNAK_REWARD_EFFECTS = Object.fromEntries(['coin', 'compass', 'tablet', 'arrow', 'draw', 'exile'].map(k => [k, registerArnakEffects('reward-' + k, [k === 'draw' ? draw() : k === 'exile' ? exile : gain({ [k]: 1 })])[0]!]));
export const ARNAK_DYNAMIC_EFFECTS = registerArnakEffects('dynamic', [{ kind: 'peekKeep' }, { kind: 'peekReturn' }]);
