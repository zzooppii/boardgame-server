import * as v from 'valibot';
export const SpiritSettingsSchema = v.strictObject({
  expansion: v.optional(v.picklist(['CORE','BRANCH_CLAW'])), progression: v.boolean(), blightCard: v.boolean(),
  adversary: v.picklist(['NONE','PRUSSIA','ENGLAND','SWEDEN']), level: v.picklist([0,1,2,3,4,5,6]),
  scenario: v.picklist(['NONE','BLITZ','HEART','RITUAL','INSURRECTION'])
});
export type SpiritSettings = v.InferOutput<typeof SpiritSettingsSchema>;
export const SPIRIT_DEFAULT_SETTINGS: SpiritSettings = {expansion:'CORE',progression:true,blightCard:false,adversary:'NONE',level:0,scenario:'NONE'};
export const SPIRIT_ADVERSARIES = {NONE:'대적 없음',PRUSSIA:'브란덴부르크–프로이센',ENGLAND:'잉글랜드',SWEDEN:'스웨덴'};
export const SPIRIT_SCENARIOS = {NONE:'일반 게임',BLITZ:'전격전',HEART:'섬의 심장 수호',RITUAL:'공포의 의식',INSURRECTION:'다한의 봉기'};
export const SPIRIT_SCENARIO_HELP: Record<SpiritSettings['scenario'],string> = {
 NONE:'공포 수준에 맞는 침략자를 모두 몰아내면 승리합니다.',
 BLITZ:'모든 능력을 빠른 단계에 사용합니다. 원래 빠른 카드는 비용이 1 줄고, 비용 0인 빠른 카드는 준비할 때 에너지 1을 얻습니다. 빠른 고유 능력과 별도 신속화는 첫 사용에 에너지 1을 얻습니다. 탐험마다 보드당 탐험가 1개가 추가됩니다. 시작 오염 공급은 인원당 1개 늘고 오염된 섬의 공급은 인원당 1개 줄어듭니다. 침략자는 준비 중 추가 건설·탐험을 합니다.',
 HEART:'시작 시 마을을 제거하고 정령마다 보조·주요 능력을 1장씩 받습니다. 보드별 심장 지역에 탐험가와 현신을 추가합니다. 2라운드부터 심장에 건물이 있으면 패배합니다.',
 RITUAL:'공포 카드만으로 공포 수준이 오르지 않습니다. 모든 정령의 현신과 인원당 다한 3개가 있는 지역에서 팀이 에너지 3과 현신 3개를 바쳐 공포 수준을 올립니다. 의식 때 획득한 공포 카드를 해결하고 다한을 흩어 보냅니다.',
 INSURRECTION:'이동한 다한은 효과 종료 후 피해 1을 줍니다. 파괴된 건물은 가까운 다한 지역에 작은 침략자로 돌아옵니다. 공포 II에는 건물이 다한보다 많은 지역이 없어야 승리하며, III에는 그런 지역이 인원수보다 적으면 승리합니다. 다한이 인원당 2개 미만이면 패배합니다.'
};
export function spiritFearTiers(settings: SpiritSettings): readonly [number,number,number] {
 const tables = {PRUSSIA:[[3,3,3],[3,3,3],[3,3,3],[3,4,3],[4,4,3],[4,4,3],[4,4,4]],ENGLAND:[[3,3,3],[3,4,3],[4,4,3],[4,5,4],[4,5,5],[4,5,5],[4,5,4]],SWEDEN:[[3,3,3],[3,3,3],[3,4,3],[3,4,3],[3,4,4],[4,4,4],[4,4,5]]} satisfies Record<string,number[][]>;
 if(settings.adversary==='NONE') return [3,3,3]; const t=tables[settings.adversary][settings.level]!; return [t[0]!,t[1]!,t[2]!];
}
