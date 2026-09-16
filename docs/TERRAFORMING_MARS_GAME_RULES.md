# 테라포밍 마스 구현 기준

## CONFIRMED — 이번 구현

사용자의 기본판 개발 및 일러스트·UI·효과음·상호작용 요청에 따라 기본 지도(타르시스), 2–5인, 기업시대를 제외한 기본판 프로젝트 137장과 기본 기업 10종·초보자 기업을 대상으로 구현한다. 기존 다른 게임의 미확정 규칙은 변경하지 않는다.

- 일반 기업은 후보 2개 중 1개를 선택하고 초기 프로젝트 10장 중 원하는 카드를 장당 3 M€에 구매한다. 초보자 기업은 42 M€와 초기 10장을 받는다. 기업시대 제외 규칙에 따라 모든 자원 생산량 1로 시작한 뒤 기업 효과를 적용한다.
- 세대마다 연구에서 4장 중 원하는 카드를 구매한다. 첫 세대는 초기 선택이 연구를 대신한다.
- 특허 매각은 원하는 손패 여러 장을 한 행동으로 버리고 장당 1 M€를 얻는다. 헬리온은 연구 구매에도 열을 M€ 대신 사용할 수 있다. 카드 자체의 필수 열 소비와 가격 지불은 별도로 충족해야 한다.
- 차례당 1–2행동. 1행동 후 차례 종료와 그 세대 전체 패스는 별도 명령이다. 모두 패스하면 생산한다.
- 기존 에너지를 열로 전환한 뒤 자원을 생산한다. M€ 수입에는 TR을 더한다. 파란 카드 행동은 세대당 1회.
- 강철은 건물 태그 카드에 2 M€, 티타늄은 우주 태그 카드에 3 M€의 가치로 지불한다. 기업 효과와 카드 할인은 서버가 계산한다. 과잉 지불한 자원은 돌려받지 않는다.
- 산소 14%, 기온 +8°C, 해양 9개 달성 세대의 생산 뒤 마지막 녹지 전환과 정산을 수행한다.
- 지도 예약 칸, 인접 조건, 배치 보너스, 해양 인접 보상, 테라포밍 경계 보너스를 적용한다.
- 개척기업(Landlord)은 위치와 무관하게 소유한 모든 타일을 센다. 포보스·가니메데 도시와 특수 타일을 포함하며 소유자가 없는 해양은 제외한다. 기본판 규칙서 11쪽의 “Owning the most tiles in play”를 근거로 화성 표면만 세던 판정을 수정했다.
- 업적 3개와 기업상 3개를 선점할 수 있다. 기업상은 후원자와 무관하게 종료 시 해당 순위로 정산한다. 최종 동점은 M€ 보유량으로 판정한다.

- 수령 가능한 카드가 있다면 동물·미생물 추가 효과를 해결해야 한다. 수령할 카드가 없을 때만 생략한다(기본판 규칙서 9쪽 즉시 효과).

## CONFIRMED — 기업시대 개발 기준

사용자의 “기본판 검증을 마무리한 뒤 기업시대 추가” 선택에 따라 기업시대 프로젝트 71장·기업 2종 추가와 시작 생산 보너스 제외를 확정한다. 게임 시작 전 방장이 선택하고 시작 후 고정한다. 근거는 기본판 규칙서 13쪽이다. 현재는 인쇄 정보·시작 자원·경제 효과·비공개 카드 선택을 구현한 단계이며 확장 플레이는 아직 활성화하지 않는다. [구현 단계와 미완료 효과](./TERRAFORMING_MARS_CORPORATE_ERA.md)를 따른다.

기업시대 경제 효과의 확정 기준은 [경제 효과 구현](./TERRAFORMING_MARS_CORPORATE_ERA.md#경제-효과-구현)을 따른다. 영구 할인 합산, 금속 가치 가산, 인쇄 비용 기준 환급, 특허 매각의 환급 제외, 이벤트 태그의 지속 집계 제외를 적용한다. 실행 가능한 확장 카탈로그는 후속 연결 단계다.

비공개 카드 열람·선택·구매의 확정 기준은 [비공개 카드 선택·구매 효과](./TERRAFORMING_MARS_CORPORATE_ERA.md#비공개-카드-선택구매-효과)를 따른다. 선택하지 않은 후보는 버리고, 열람 구매는 장당 3 M€이며 프로젝트 할인은 적용하지 않는다. 헬리온의 열 지불을 허용한다.

## 온라인 진행 정책

시간 제한 없이 진행한다. 일시적인 접속 끊김은 패스로 취급하지 않는다. 진행 중 명시적으로 방을 나가면 기존 플랫폼의 게임 취소 정책을 적용하며, 확인 문구로 설명한다. 재접속은 서버에 확정된 상태와 선택 대기 상태를 복원한다. 연구 선택 내용과 손패·덱 순서는 다른 참가자에게 공개하지 않는다.

## 근거

- [기본판 규칙서](https://cdn.1j1ju.com/medias/13/3f/fb-terraforming-mars-rule.pdf), 시작·세대·행동·지도·종료·기업시대 구분.
- [공개 기본판 카드 및 지도 참조](https://github.com/terraforming-mars/terraforming-mars/tree/main/src/server/cards/base), 카드 번호·비용·태그·조건·효과의 교차 확인. 참조 구현 코드는 제품에 포함하지 않는다.

## TO_BE_CONFIRMED / 후속 범위

프렐류드·추가 지도 등 추가 확장, 드래프트, 솔로, 시간 제한은 후속 범위다. 서버 재시작을 넘는 영구 대국 저장은 사용자 요청으로 개발 범위에서 제외한다. 한국어 카드 이름은 설명용 번역으로 공식 한국어판과 용어 대조가 남는다. 인메모리 재접속을 서버 재시작 복구로 표현하지 않는다.


## CONFIRMED — 기업시대 일회성 할인

Indentured Workers는 같은 세대에 다음으로 실행하는 프로젝트 카드의 비용을 8 M€ 줄인다. 영구 할인과 합산하며 비용 하한은 0이다. 지불 취소·실패, 일반 프로젝트·카드 구매·매각·파란 카드 행동은 이 할인을 소비하지 않는다. 프로젝트 지불 성공 시 남는 할인도 모두 소비하고, 사용하지 않은 할인은 세대 생산 시 만료한다. 근거는 [카드 인쇄 설명](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/IndenturedWorkers.ts)이다. 확장 덱 활성화와 해당 카드의 -1 VP 연결은 전체 카탈로그 통합 단계에서 검증한다.

## CONFIRMED — Mars University 손패 교환

자신이 과학 태그를 낼 때마다 손패 1장을 버리고 1장을 뽑을 수 있다. 자기 카드의 과학 태그도 포함하며 태그가 여러 개면 각각 선택한다. 교환하지 않아도 되고, 손패가 없으면 해당 선택을 생략한다. 먼저 버린 다음 뽑는다. 근거는 [Mars University 인쇄 효과](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/MarsUniversity.ts)다. 실제 확장 카드 등록은 전체 카탈로그 통합 단계에서 진행한다.

## CONFIRMED — Protected Habitats 보호 범위

상대는 보호된 플레이어의 식물·동물·미생물 자원을 제거할 수 없다. 자신의 자원 소비·제거, 생산량 감소, M€ 등 다른 자원에는 적용하지 않는다. Pets의 동물 제거 금지는 별도로 유지한다. 근거는 [Protected Habitats 인쇄 효과](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/ProtectedHabitats.ts)다. 실제 확장 카드 등록은 전체 카탈로그 통합 단계다.

## CONFIRMED — Robotic Workforce 생산량 복제

자신이 낸 건물 카드 한 장의 생산량 상자만 복제한다. 생산량 감소도 다시 적용하며, 자원 수령·타일 배치·전역 지표·점수·태그·지속 효과는 복제하지 않는다. Mining Rights는 기존 타일에서 선택한 금속 생산을 사용한다. 근거는 [Robotic Workforce 인쇄 설명](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/RoboticWorkforce.ts)이다. 실제 확장 카드 등록과 모든 추가 카드 조합은 후속 통합 단계다.

## CONFIRMED — Land Claim 토지 예약

비어 있는 비예약 육지에 자신의 표시를 놓는다. 해양 전용 칸·녹티스·외부 도시는 예약할 수 없다. 이후 해당 플레이어만 그 칸에 타일을 놓을 수 있으며 일반 배치 조건은 그대로 적용한다. 표시는 타일이 아니므로 예약 시 배치 보너스·인접 보너스·타일 점수·녹지 인접 기준을 얻지 않는다. 실제 타일 배치 시 예약을 해소하고 정상 배치 효과를 처리한다. 근거는 [Land Claim 인쇄 설명](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/LandClaim.ts)이다. 실제 카드 등록은 전체 카탈로그 통합 단계다.

## CONFIRMED — 기업시대 자원 공격

Hired Raiders는 상대 한 명에게서 강철 최대 2 또는 M€ 최대 3을 가져온다. Sabotage는 한 플레이어에게서 티타늄 최대 3, 강철 최대 4, M€ 최대 7 중 하나를 제거한다. Virus는 한 카드의 동물 최대 2 또는 한 플레이어의 식물 최대 5를 제거한다. 모두 생략할 수 있으며 실제 보유량 안에서 수량을 선택한다. 탈취는 상대가 잃은 수량만큼 받으며 생산량은 바꾸지 않는다. 서식지 보호·Pets의 동물 보호를 적용한다. 근거: [Hired Raiders](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/HiredRaiders.ts), [Sabotage](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/Sabotage.ts), [Virus](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/Virus.ts)의 인쇄 효과. 실제 확장 카드 등록은 후속 통합 단계다.

## CONFIRMED — 카드 자원과 점수

Security Fleet는 행동으로 티타늄 1개를 지불하고 자기 카드에 전투기 1개를 추가하며 전투기당 1점이다. Physics Complex는 에너지 6개를 지불하고 자기 카드에 과학 자원 1개를 추가하며 과학 자원당 2점이다. Tardigrades는 미생물 4개당 1점으로 남는 수량은 버림한다. 기존 카드와 마찬가지로 행동은 세대당 한 번이며 자기 카드에 적힌 종류의 자원만 추가한다. 근거: [Security Fleet](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/SecurityFleet.ts), [Physics Complex](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/PhysicsComplex.ts), 기존 기업시대 인쇄 데이터. 실제 확장 카드 등록은 후속 통합 단계다.

## CONFIRMED — 기업시대 생산량 공격

Hackers는 자신의 에너지 생산을 1 줄이고 한 플레이어의 M€ 생산을 2 줄이며 자신의 M€ 생산을 2 올린다. Asteroid Mining Consortium은 자기 티타늄 생산이 1 이상이어야 하며 한 플레이어의 티타늄 생산을 1 줄이고 자기 생산을 1 올린다. 자신을 대상으로 할 수 있다. 생산량 감소는 생략할 수 없으며 M€ 생산 하한 -5, 다른 생산 하한 0을 지킨다. 서식지 보호는 생산량 감소를 막지 않는다. 근거: [Hackers](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/Hackers.ts), [Asteroid Mining Consortium](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/AsteroidMiningConsortium.ts). 실제 카드의 조건·비용·점수 통합은 후속 단계다.
