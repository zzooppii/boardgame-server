import * as v from 'valibot';
export const PANDEMIC_COLORS = ['BLUE', 'YELLOW', 'BLACK', 'RED'] as const;
export const PandemicColorSchema = v.picklist(PANDEMIC_COLORS);
export type PandemicColor = v.InferOutput<typeof PandemicColorSchema>;
export const PANDEMIC_CITIES = ['SAN_FRANCISCO','CHICAGO','MONTREAL','NEW_YORK','WASHINGTON','ATLANTA','LONDON','MADRID','PARIS','ESSEN','MILAN','ST_PETERSBURG','LOS_ANGELES','MEXICO_CITY','MIAMI','BOGOTA','LIMA','SANTIAGO','BUENOS_AIRES','SAO_PAULO','LAGOS','KINSHASA','JOHANNESBURG','KHARTOUM','ALGIERS','ISTANBUL','CAIRO','MOSCOW','BAGHDAD','RIYADH','TEHRAN','KARACHI','MUMBAI','DELHI','CHENNAI','KOLKATA','BEIJING','SEOUL','TOKYO','SHANGHAI','OSAKA','TAIPEI','HONG_KONG','BANGKOK','HO_CHI_MINH_CITY','MANILA','JAKARTA','SYDNEY'] as const;
export const PandemicCitySchema = v.picklist(PANDEMIC_CITIES);
export type PandemicCity = v.InferOutput<typeof PandemicCitySchema>;
type CityInfo = Readonly<{name:string;color:PandemicColor;x:number;y:number;population:number}>;
// Coordinates are presentation-only; the adjacency graph below is authoritative.
const city = (name:string,color:PandemicColor,x:number,y:number,population:number):CityInfo => ({name,color,x,y,population});
export const PANDEMIC_CITY_INFO:Readonly<Record<PandemicCity,CityInfo>> = {
 SAN_FRANCISCO:city('샌프란시스코','BLUE',145,225,5865), CHICAGO:city('시카고','BLUE',240,190,9121), MONTREAL:city('몬트리올','BLUE',315,165,3429), NEW_YORK:city('뉴욕','BLUE',375,205,20464), WASHINGTON:city('워싱턴','BLUE',345,265,4679), ATLANTA:city('애틀랜타','BLUE',255,270,4715),
 LONDON:city('런던','BLUE',510,160,8586), MADRID:city('마드리드','BLUE',500,280,5427), PARIS:city('파리','BLUE',565,225,10755), ESSEN:city('에센','BLUE',610,160,575), MILAN:city('밀라노','BLUE',630,230,5232), ST_PETERSBURG:city('상트페테르부르크','BLUE',720,125,4879),
 LOS_ANGELES:city('로스앤젤레스','YELLOW',165,305,14900), MEXICO_CITY:city('멕시코시티','YELLOW',235,355,19463), MIAMI:city('마이애미','YELLOW',325,340,5582), BOGOTA:city('보고타','YELLOW',315,415,8702), LIMA:city('리마','YELLOW',290,490,9121), SANTIAGO:city('산티아고','YELLOW',305,590,6015), BUENOS_AIRES:city('부에노스아이레스','YELLOW',390,565,13639), SAO_PAULO:city('상파울루','YELLOW',430,485,20186), LAGOS:city('라고스','YELLOW',555,390,11547), KINSHASA:city('킨샤사','YELLOW',610,465,9046), JOHANNESBURG:city('요하네스버그','YELLOW',650,550,3888), KHARTOUM:city('하르툼','YELLOW',685,425,4887),
 ALGIERS:city('알제','BLACK',565,320,2946), ISTANBUL:city('이스탄불','BLACK',680,280,13576), CAIRO:city('카이로','BLACK',650,350,14718), MOSCOW:city('모스크바','BLACK',755,210,15512), BAGHDAD:city('바그다드','BLACK',745,335,6204), RIYADH:city('리야드','BLACK',750,415,5037), TEHRAN:city('테헤란','BLACK',810,260,7419), KARACHI:city('카라치','BLACK',825,345,20711), MUMBAI:city('뭄바이','BLACK',835,420,16910), DELHI:city('델리','BLACK',885,285,22242), CHENNAI:city('첸나이','BLACK',895,490,8865), KOLKATA:city('콜카타','BLACK',935,355,14374),
 BEIJING:city('베이징','RED',985,195,17311), SEOUL:city('서울','RED',1060,220,22547), TOKYO:city('도쿄','RED',1140,270,13189), SHANGHAI:city('상하이','RED',1000,285,13482), OSAKA:city('오사카','RED',1160,350,2871), TAIPEI:city('타이베이','RED',1080,375,8338), HONG_KONG:city('홍콩','RED',1010,405,7106), BANGKOK:city('방콕','RED',940,455,7151), HO_CHI_MINH_CITY:city('호찌민시','RED',1000,510,8314), MANILA:city('마닐라','RED',1100,465,20767), JAKARTA:city('자카르타','RED',950,575,26063), SYDNEY:city('시드니','RED',1130,610,3785),
};
const links:ReadonlyArray<readonly [PandemicCity,readonly PandemicCity[]]> = [
 ['SAN_FRANCISCO',['TOKYO','MANILA','LOS_ANGELES','CHICAGO']], ['CHICAGO',['LOS_ANGELES','MEXICO_CITY','ATLANTA','MONTREAL']], ['MONTREAL',['NEW_YORK','WASHINGTON']], ['NEW_YORK',['WASHINGTON','LONDON','MADRID']], ['WASHINGTON',['ATLANTA','MIAMI']], ['ATLANTA',['MIAMI']], ['LONDON',['MADRID','PARIS','ESSEN']], ['MADRID',['PARIS','ALGIERS','SAO_PAULO']], ['PARIS',['ALGIERS','ESSEN','MILAN']], ['ESSEN',['MILAN','ST_PETERSBURG']], ['MILAN',['ISTANBUL']], ['ST_PETERSBURG',['ISTANBUL','MOSCOW']],
 ['LOS_ANGELES',['MEXICO_CITY','SYDNEY']], ['MEXICO_CITY',['MIAMI','BOGOTA','LIMA']], ['MIAMI',['BOGOTA']], ['BOGOTA',['LIMA','BUENOS_AIRES','SAO_PAULO']], ['LIMA',['SANTIAGO']], ['BUENOS_AIRES',['SAO_PAULO']], ['SAO_PAULO',['LAGOS']], ['LAGOS',['KHARTOUM','KINSHASA']], ['KINSHASA',['KHARTOUM','JOHANNESBURG']], ['JOHANNESBURG',['KHARTOUM']],
 ['ALGIERS',['ISTANBUL','CAIRO']], ['ISTANBUL',['MOSCOW','BAGHDAD','CAIRO']], ['MOSCOW',['TEHRAN']], ['CAIRO',['BAGHDAD','RIYADH','KHARTOUM']], ['BAGHDAD',['TEHRAN','KARACHI','RIYADH']], ['RIYADH',['KARACHI']], ['TEHRAN',['KARACHI','DELHI']], ['KARACHI',['DELHI','MUMBAI']], ['MUMBAI',['DELHI','CHENNAI']], ['DELHI',['CHENNAI','KOLKATA']], ['CHENNAI',['KOLKATA','BANGKOK','JAKARTA']], ['KOLKATA',['BANGKOK','HONG_KONG']],
 ['BEIJING',['SEOUL','SHANGHAI']], ['SEOUL',['SHANGHAI','TOKYO']], ['TOKYO',['SHANGHAI','OSAKA']], ['SHANGHAI',['TAIPEI','HONG_KONG']], ['OSAKA',['TAIPEI']], ['TAIPEI',['HONG_KONG','MANILA']], ['HONG_KONG',['MANILA','HO_CHI_MINH_CITY','BANGKOK']], ['BANGKOK',['HO_CHI_MINH_CITY','JAKARTA']], ['HO_CHI_MINH_CITY',['MANILA','JAKARTA']], ['MANILA',['SYDNEY']], ['JAKARTA',['SYDNEY']],
];
export const PANDEMIC_EDGES = Object.freeze(links.flatMap(([a,neighbors])=>neighbors.map(b=>Object.freeze([a,b] as const))));
export function pandemicNeighbors(id:PandemicCity):PandemicCity[] { return PANDEMIC_EDGES.flatMap(([a,b])=>a===id?[b]:b===id?[a]:[]); }
export const PANDEMIC_ROLES = ['SCIENTIST','MEDIC','QUARANTINE','OPERATIONS','RESEARCHER','DISPATCHER','PLANNER'] as const;
export const PandemicRoleSchema = v.picklist(PANDEMIC_ROLES);
export type PandemicRole = v.InferOutput<typeof PandemicRoleSchema>;
export const PANDEMIC_ROLE_INFO:Readonly<Record<PandemicRole,{name:string;description:string;art:number;color:string}>> = {
 SCIENTIST:{name:'과학자',description:'연구소에서 같은 색 도시 카드 4장으로 치료제를 발견합니다.',art:0,color:'#e5edf7'}, MEDIC:{name:'의무병',description:'한 행동으로 같은 색 큐브를 모두 치료합니다. 치료제가 있는 질병은 현 위치에서 자동 제거하고 감염을 막습니다.',art:1,color:'#ffa43c'}, QUARANTINE:{name:'검역 전문가',description:'현 위치와 인접 도시의 큐브 추가와 발병을 막습니다.',art:2,color:'#56cda4'}, OPERATIONS:{name:'건설 전문가',description:'카드 없이 연구소 건설. 턴당 한 번, 연구소에서 아무 도시 카드 1장을 버려 원하는 도시로 이동합니다.',art:3,color:'#a3d756'}, RESEARCHER:{name:'연구원',description:'같은 도시의 동료에게 위치와 다른 도시 카드도 줄 수 있습니다. 받는 방향에는 적용되지 않습니다.',art:4,color:'#cba279'}, DISPATCHER:{name:'운항 관리자',description:'동의를 받아 동료를 이동시키거나, 다른 말이 있는 도시로 말을 옮깁니다. 비용은 내 손패에서 냅니다.',art:5,color:'#c18eff'}, PLANNER:{name:'위기관리자',description:'한 행동으로 버린 이벤트를 역할에 1장 보관합니다. 사용하면 게임에서 제거합니다.',art:6,color:'#ff777e'},
};
export const PANDEMIC_EVENTS = ['AIRLIFT','GRANT','QUIET_NIGHT','FORECAST','RESILIENT'] as const;
export const PandemicEventSchema = v.picklist(PANDEMIC_EVENTS);
export type PandemicEvent = v.InferOutput<typeof PandemicEventSchema>;
export const PANDEMIC_EVENT_INFO:Readonly<Record<PandemicEvent,{name:string;description:string;art:number}>> = {
 AIRLIFT:{name:'공중 수송',description:'동의를 받아 한 플레이어를 원하는 도시로 옮깁니다.',art:8}, GRANT:{name:'정부 보조금',description:'도시 카드를 쓰지 않고 원하는 도시에 연구소를 세웁니다.',art:9}, QUIET_NIGHT:{name:'하룻밤의 평온',description:'다음 도시 감염 단계를 건너뜁니다.',art:10}, FORECAST:{name:'예측',description:'감염 덱 위 최대 6장의 순서를 정합니다. 맨 앞 카드가 다음에 나옵니다.',art:11}, RESILIENT:{name:'저항력 강화',description:'감염 버림패의 카드 한 장을 게임에서 제거합니다.',art:11},
};
export const PANDEMIC_RATE = [2,2,2,3,3,4,4] as const;
