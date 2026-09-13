import * as v from 'valibot';
export const SPIRIT_BLIGHT_KEYS = ['SPIRAL','MEMORY','PALL','LESSER','WALL','ECOSYSTEM','EROSION','FARMLANDS','TIPPING'] as const;
export const SpiritBlightKeySchema = v.picklist(SPIRIT_BLIGHT_KEYS);
export type SpiritBlightKey = v.InferOutput<typeof SpiritBlightKeySchema>;
export const SPIRIT_BLIGHT = {
 SPIRAL:{name:'쇠퇴의 소용돌이',perPlayer:5,timing:'침략자 단계 시작',help:'각 정령은 현신 1개를 파괴합니다.'},
 MEMORY:{name:'먼지가 되는 기억',perPlayer:4,timing:'침략자 단계 시작',help:'각 정령은 현신 1개를 파괴하거나 능력 카드 1장을 망각합니다.'},
 PALL:{name:'땅을 뒤덮은 장막',perPlayer:3,timing:'공개 즉시',help:'각 보드에서 현신 1개를 파괴하고 마을 1개를 제거합니다. 서로 다른 지역을 골라도 됩니다.'},
 LESSER:{name:'작은 정령들의 도움',perPlayer:2,timing:'공개 즉시 · 매 라운드 유지',help:'인원수보다 1장 많은 보조 능력을 공개해 각 정령에게 1장씩 배정합니다. 비용과 카드 사용 횟수 없이 매 라운드 사용하고 원소를 얻습니다. 버리거나 망각할 수 없습니다.'},
 WALL:{name:'벼랑 끝의 저항',perPlayer:2,timing:'매 정령 단계',help:'각 정령은 에너지 1과 카드 사용 횟수 1을 추가로 얻습니다.'},
 ECOSYSTEM:{name:'무너지는 생태계',perPlayer:5,timing:'공개 즉시',help:'각 보드에서 야수 1개를 파괴한 뒤 마을이나 도시가 있는 지역에 오염 1개를 추가합니다. 서로 다른 지역을 골라도 됩니다.'},
 EROSION:{name:'의지의 침식',perPlayer:3,timing:'공개 즉시',help:'인원수마다 공포 2를 얻습니다. 각 정령은 현신 1개를 파괴하고 에너지 1을 잃습니다.'},
 FARMLANDS:{name:'풍요를 약속하는 농지',perPlayer:4,timing:'공개 즉시',help:'각 보드에서 마을·도시가 없는 내륙 지역 하나에 마을 1개와 도시 1개를 추가합니다.'},
 TIPPING:{name:'한계점',perPlayer:5,timing:'공개 즉시 · 원판 카드',help:'각 정령은 현신 3개를 파괴합니다. 가지와 발톱 원판 구성의 카드입니다.'},
} as const satisfies Record<SpiritBlightKey,{name:string;perPlayer:number;timing:string;help:string}>;
export const spiritBlightKeys = (expansion:'CORE'|'BRANCH_CLAW'):SpiritBlightKey[] => expansion==='BRANCH_CLAW'?[...SPIRIT_BLIGHT_KEYS]:['SPIRAL','MEMORY'];
