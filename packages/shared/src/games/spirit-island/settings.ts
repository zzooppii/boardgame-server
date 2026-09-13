import * as v from 'valibot';
export const SpiritSettingsSchema = v.strictObject({
  expansion: v.optional(v.picklist(['CORE','BRANCH_CLAW'])), progression: v.boolean(), blightCard: v.boolean(),
  adversary: v.picklist(['NONE','PRUSSIA','ENGLAND','SWEDEN','FRANCE']), level: v.picklist([0,1,2,3,4,5,6]),
  scenario: v.picklist(['NONE','BLITZ','HEART','RITUAL','INSURRECTION','WARD','FLAME','FORGOTTEN','SECOND_WAVE'])
});
export type SpiritSettings = v.InferOutput<typeof SpiritSettingsSchema>;
export const SPIRIT_DEFAULT_SETTINGS: SpiritSettings = {expansion:'CORE',progression:true,blightCard:false,adversary:'NONE',level:0,scenario:'NONE'};
export const SPIRIT_ADVERSARIES = {NONE:'대적 없음',PRUSSIA:'브란덴부르크–프로이센',ENGLAND:'잉글랜드',SWEDEN:'스웨덴',FRANCE:'프랑스 · 플랜테이션 식민지'};
export const SPIRIT_SCENARIOS = {SECOND_WAVE:'다음 물결',FLAME:'파괴하는 불꽃의 의식',FORGOTTEN:'오래전 잊힌 힘',WARD:'해안 수호',NONE:'일반 게임',BLITZ:'전격전',HEART:'섬의 심장 수호',RITUAL:'공포의 의식',INSURRECTION:'다한의 봉기'};
export const SPIRIT_SCENARIO_HELP: Record<SpiritSettings['scenario'],string> = {
 SECOND_WAVE:'승리 후 다한과 일부 토큰·오염, 정령당 능력 하나를 다음 판에 남기고 다른 정령으로 섬을 지킵니다. 건강한 섬에서 승리하면 대적 단계가 높아집니다. 이전 정령의 능력은 침략 III에 진입한 뒤 정령 단계에 무료로 준비합니다. 같은 방에서 최대 일곱 번째 물결까지 이어갑니다.',
 FLAME:'모든 성장이 끝난 뒤 불 원소 카드 하나를 망각해 내 현신 지역에 불꽃 표식과 오염을 놓습니다. 침략 단계만큼 에너지를 얻고, 침략자가 있으면 같은 수의 공포와 다한당 피해 1을 줍니다. 불꽃에서 거리 1을 벗어난 침략자는 피해·파괴마다 에너지 2를 내야 해칠 수 있습니다. 다한 반격·공포·이벤트에도 적용합니다.',
 FORGOTTEN:'다한 3개 또는 침략자 2개(프랑스는 3개)가 모인 지역의 숨은 표식을 즉시 탐색합니다. 번호가 있으면 발견한 진영이 특별한 힘을 얻습니다. 정령은 그 힘의 사용을 보류할 수 있습니다.',
 WARD:'정령마다 라운드당 카드 1장을 원소 없는 느린 수호 능력(비용 0 · 사거리 0)으로 준비할 수 있습니다. 사용할 때 대상의 오염·마을·도시 하나당 에너지 2를 내고 수호 표식을 놓습니다. 표식마다 방어 3을 제공하지만 오염이 추가되면 사라집니다. 침략 III단계에는 탐험 때 마을도 추가됩니다. 공포 II 이상에서 모든 해안에 수호 표식이 있어야 승리합니다.',
 NONE:'공포 수준에 맞는 침략자를 모두 몰아내면 승리합니다.',
 BLITZ:'모든 능력을 빠른 단계에 사용합니다. 원래 빠른 카드는 비용이 1 줄고, 비용 0인 빠른 카드는 준비할 때 에너지 1을 얻습니다. 빠른 고유 능력과 별도 신속화는 첫 사용에 에너지 1을 얻습니다. 탐험마다 보드당 탐험가 1개가 추가됩니다. 시작 오염 공급은 인원당 1개 늘고 오염된 섬의 공급은 인원당 1개 줄어듭니다. 침략자는 준비 중 추가 건설·탐험을 합니다.',
 HEART:'시작 시 마을을 제거하고 정령마다 보조·주요 능력을 1장씩 받습니다. 보드별 심장 지역에 탐험가와 현신을 추가합니다. 2라운드부터 심장에 건물이 있으면 패배합니다.',
 RITUAL:'공포 카드만으로 공포 수준이 오르지 않습니다. 모든 정령의 현신과 인원당 다한 3개가 있는 지역에서 팀이 에너지 3과 현신 3개를 바쳐 공포 수준을 올립니다. 의식 때 획득한 공포 카드를 해결하고 다한을 흩어 보냅니다.',
 INSURRECTION:'이동한 다한은 효과 종료 후 피해 1을 줍니다. 파괴된 건물은 가까운 다한 지역에 작은 침략자로 돌아옵니다. 공포 II에는 건물이 다한보다 많은 지역이 없어야 승리하며, III에는 그런 지역이 인원수보다 적으면 승리합니다. 다한이 인원당 2개 미만이면 패배합니다.'
};
export function spiritFearTiers(settings: SpiritSettings): readonly [number,number,number] {
 const tables = {FRANCE:[[3,3,3],[3,3,3],[3,4,3],[4,4,3],[4,4,4],[4,5,4],[4,5,5]],PRUSSIA:[[3,3,3],[3,3,3],[3,3,3],[3,4,3],[4,4,3],[4,4,3],[4,4,4]],ENGLAND:[[3,3,3],[3,4,3],[4,4,3],[4,5,4],[4,5,5],[4,5,5],[4,5,4]],SWEDEN:[[3,3,3],[3,3,3],[3,4,3],[3,4,3],[3,4,4],[4,4,4],[4,4,5]]} satisfies Record<string,number[][]>;
 if(settings.adversary==='NONE') return [3,3,3]; const t=tables[settings.adversary][settings.level]!; return [t[0]!,t[1]!,t[2]!];
}
