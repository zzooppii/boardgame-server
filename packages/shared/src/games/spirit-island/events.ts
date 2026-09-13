import * as v from 'valibot';
/** Only completed events are included in this explicitly labelled preview deck. */
export const SpiritEventKeySchema = v.picklist(['NEW_SPECIES', 'LITTLE_RAIN']);
export type SpiritEventKey = v.InferOutput<typeof SpiritEventKeySchema>;
export const SPIRIT_EVENTS = {
 NEW_SPECIES: { title: '새로운 종의 확산', name: 'New Species Spread', artwork: 'KEEPER', element: 'MOON', free: '외래종의 번성을 지켜본다', paid: '위험한 종을 변화시킨다', main: '무료: 보드마다 보조 덱 맨 위 카드를 버립니다. 빠른 능력이면 건물이 있는 지역에 오염 1개를 추가합니다. 해결 후 이 이벤트를 덱 위에서 세 번째에 돌려놓습니다. 지원: 인원당 비용 4, 달 원소 지원. 인원당 공포 1, 보드마다 건물이 있는 지역에 야수 1개를 추가합니다.', token: '새 질병 · 보드 절반(올림)을 골라, 침략자와 다한이 함께 있는 지역에 질병 1개와 다한 피해 2를 줍니다.', dahan: '춤과 무늬의 공물 · 자기 현신이 있는 지역들에 다한이 합계 2개 이상인 정령은 에너지 1을 얻습니다.' },
 LITTLE_RAIN: { title: '비가 적은 해', name: 'Years of Little Rain', artwork: 'OCEAN', element: 'WATER', free: '가뭄을 감수한다', paid: '가뭄을 누그러뜨린다', main: '무료: 보드마다 보조 덱 맨 위 카드를 버립니다. 물 원소가 없으면 모래 지역에 오염 1개를 추가합니다. 이번 라운드 마을·도시·다한의 체력이 1 감소합니다(최소 1). 지원: 인원당 비용 4, 물 원소 지원. 각 정령은 자기 현신과 다한이 있는 지역에 현신 1개를 추가할 수 있습니다.', token: '야수의 공격 · 야수마다 차례로 침략자에게 피해 2. 마을이나 도시를 파괴한 야수만 제거합니다.', dahan: '노련한 방어 · 이번 라운드 파괴 행동에서 다한마다 방어 1을 제공합니다.' },
} as const;
