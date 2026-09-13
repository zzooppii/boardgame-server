import { spiritPower, type SpiritPower, type SpiritProjection, type SpiritLand } from '@hangul-rummikub/shared';
export function powerArtwork(p: SpiritPower): number {
 const k=p.key;
 if(/night|dream/.test(k))return 6;
 if(/thunder|manifestation|warning|ambush/.test(k))return 7;
 if(/drown|tidal|tide|deep|tsunami|swallow/.test(k))return 4;
 if(/root|hungry-earth|devour/.test(k))return 8;
 if(/flame|fire|storm|rot/.test(k))return 9;
 if(/heal|renew|vigor|bounty|sanctity|purif/.test(k))return 10;
 if(/fear|dread|shadow|haunt|delusion/.test(k))return 11;
 if(/animal|beast|ants|hunt/.test(k))return 12;
 if(/tree|stone|earth|mountain/.test(k))return 13;
 if(/dahan|migrat|call|voice/.test(k))return 14;
 if(/water|rain|wash|melt|flow/.test(k))return 15;
 return p.deck==='RIVER'?0:p.deck==='LIGHTNING'?1:p.deck==='EARTH'?2:p.deck==='SHADOW'?3:p.deck==='GREEN'||p.elements.includes('PLANT')?5:p.elements.includes('WATER')?0:p.elements.includes('AIR')?1:2;
}
export function preparedCardCost(g: SpiritProjection,p: SpiritPower) {return p.cost-(g.settings.scenario==='BLITZ'&&p.speed==='FAST'?1:0);}
export function ravagePreview(g: SpiritProjection,l: SpiritLand) {
 const active=l.number>0&&g.ravage!==null&&(g.ravage.coastal?l.coastal:g.ravage.terrains.includes(l.terrain));
 const earth=g.playerStates.some(p=>p.spirit==='EARTH'&&(l.presence.find(x=>x.playerId===p.playerId)?.count??0)>=2);
 const high=g.settings.adversary==='SWEDEN'&&g.settings.level>=3;
 const attack=l.pieces.reduce((n,p)=>n+(p.strife>0?0:p.kind==='EXPLORER'?1:p.kind==='TOWN'?high?3:2:p.kind==='CITY'?high?5:3:0),0),defend=l.defend+(earth?3:0),damage=Math.max(0,attack-defend);
 return {active,attack,defend,damage,blight:active&&!l.skip&&!l.vitality&&damage>=2,blocked:l.skip};
}
export function preparationElements(g:SpiritProjection,ids:readonly string[]) {
 const cards=g.playerStates.flatMap(p=>[...p.hand,...p.played]);
 return ids.flatMap(id=>{const c=cards.find(c=>c.cardId===id);return c?spiritPower(c.key).elements:[];});
}
export const stageGuidance: Record<SpiritProjection['stage'],readonly [string,string]> = {
 SELECT:['함께 섬을 지킬 정령을 고르세요','처음이라면 강이나 번개로 시작해 보세요. 모든 정령의 선택이 끝나면 첫 탐험이 진행됩니다.'],
 PREPARE:['성장 → 카드 선택 → 준비 확정','붉은 표시 지역은 이번 파괴 대상입니다. 먼저 위험을 확인하고 방어하거나 침략자를 옮길 능력을 준비하세요.'],
 FAST:['빛나는 지역을 고르고 능력을 실행하세요','카드와 고유 능력을 원하는 순서로 사용합니다. 효과를 해결할 동료와 순서를 의논하세요.'],
 FEAR:['획득한 공포의 힘을 확인하세요','공포 카드는 현재 공포 수준의 효과로 해결합니다. 선택이 필요한 경우 담당 정령의 화면에 표시됩니다.'],
 RAVAGE:['침략자 피해와 다한의 반격','방어를 뺀 피해가 2 이상이면 오염이 추가됩니다. 기존 오염이 있는 곳은 인접 지역으로 연쇄됩니다.'],
 BUILD:['건설을 막으면 다음 파괴가 약해집니다','침략자 행동을 진행하면 대상 지형에 건물이 생깁니다. 대적이 있다면 추가 건설 조건을 확인하세요.'],
 EXPLORE:['새 탐험 지역이 드러납니다','탐험 뒤 침략 카드가 다음 행동 칸으로 이동합니다. 새로 드러난 건설·파괴 대상을 살펴보세요.'],
 SLOW:['다음 라운드를 준비하는 힘','느린 능력은 침략자 행동 이후의 섬에 사용합니다. 새 탐험가를 옮겨 다음 건설을 막아보세요.'],
 TIME:['다음 라운드로 돌아갑니다','사용 카드는 버리고 피해와 방어를 초기화합니다. 회수 효과의 선택이 남으면 먼저 해결합니다.']
};

export function victoryGoal(g:SpiritProjection): readonly [string,string] {
 if(g.settings.scenario==='INSURRECTION')return g.terror===1?['공포 수준 II 달성','다한이 인원당 2개 미만이면 패배']:g.terror===2?['건물 수 ≤ 다한 수','모든 지역에서 충족하면 승리']:['건물 우세 지역 줄이기',`건물 수가 다한보다 많은 지역을 ${g.playerStates.length}곳 미만으로`];
 return [g.terror===1?'모든 침략자':g.terror===2?'마을과 도시':g.terror===3?'모든 도시':'섬을 해방!',g.terror<4?'없애면 승리':'승리 조건 달성'];
}
