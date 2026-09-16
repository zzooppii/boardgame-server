# 기업시대 구현 단계

## 확정한 범위

사용자가 선택한 순서는 기본판 검증 이후 기업시대 추가다. 기본 타르시스 지도·2–5인에 기업시대 프로젝트 71장과 기업 2종을 더해 총 프로젝트 208장, 일반 기업 12종을 사용한다. 초보자 기업은 별도로 유지한다. 시작 생산량의 기본 보너스 1을 제거하고 각 기업의 시작 효과를 적용한다.

기업시대의 선택은 게임 시작 전 방장이 변경하며 참가자 모두에게 공개한다. 시작 후에는 해당 대국 동안 고정한다. 프렐류드와 장기 대국 저장은 이번 확장 구현에 포함하지 않는다.

## 현재 구현한 첫 단계

- `packages/shared/src/games/mars/corporate-era-facts.ts`: 기업시대 71장의 번호·영문명·비용·태그·조건·점수·보유 자원 종류, Saturn Systems와 Teractor의 시작 자원·생산·지속 효과를 기록했다. 참조 구현의 실행 코드는 포함하지 않는다.
- 요구 조건은 전역 지표, 태그, 생산량, 전체 도시 수로 구분한다. 전역 조건 완화가 생산량·태그 조건에 적용되지 않도록 별도 타입으로 둔다.
- 자원 점수는 `per`와 `points`를 분리한다. Physics Complex의 과학 자원당 2점과 Tardigrades의 미생물 4개당 1점을 같은 분모로 해석하지 않는다. Commercial District의 인접 도시 점수도 전체 도시 점수와 구분한다.
- `apps/server/src/games/mars/domain/corporation-start.ts`: 기본판과 기업시대의 기업별 시작 자원·생산량 계산을 순수 함수로 분리했다. 기본판 초기 선택에 이 함수를 연결했고, 기업시대 계산은 테스트에서 검증한다.
- Saturn Systems는 티타늄 생산 1과 42 M€로 시작하며 자신의 목성 태그에도 효과가 적용되어 M€ 생산 1을 얻는다. Teractor는 60 M€로 시작한다. 지구 카드 할인과 상대 목성 태그 반응의 경제 계산도 구현했다. 새 기업의 실제 대국 선택은 확장 활성화 단계에서 연결한다.

**아직 기업시대로 플레이할 수 없다.** 인쇄 정보는 실행 가능한 `MARS_CARDS`·`MARS_CORPORATIONS`와 분리했다. 현재 게임 생성은 계속 기본판 137장·기업 10종만 사용한다. 기업시대 선택 UI·설정 명령·확장 덱 활성화는 추가 효과 구현과 검증 이후 연결한다. 데이터가 존재한다는 이유로 효과 없는 카드를 게임에 넣지 않는다.

## 경제 효과 구현

- 서버 `economy.ts`에서 기본판과 기업시대의 영구 할인·금속 가치·카드 수입·일반 프로젝트 수입·목성 태그 생산 반응을 계산한다. 기본판 비용 검사·실제 지불·플레이 후 수입 처리도 같은 함수를 사용한다.
- 영구 할인은 합산하며 비용의 하한은 0이다. Earth Catapult·Anti-Gravity Technology는 모든 프로젝트, Earth Office·Teractor는 지구 카드, Space Station·Quantum Extractor·Mass Converter는 우주 카드에 적용한다. 원래의 Research Outpost·Shuttles·Thorgate와 중첩한다. 할인 카드는 지불한 후부터 효과를 얻는다.
- Advanced Alloys는 강철·티타늄 가치에 각각 1을 더한다. PhoboLog와 함께라면 강철 3, 티타늄 5 M€다. 재료 사용 가능 태그·보유량·카드 효과에 필요한 자원은 계속 서버가 별도로 검증한다.
- Media Group의 이벤트 수입은 Interplanetary Cinematics·Optimal Aerobraking과 중첩한다. CrediCor의 기준은 할인 전 인쇄 비용이다. Standard Technology는 유료 일반 프로젝트 처리 뒤 3 M€를 주며 특허 매각에는 적용하지 않는다.
- Cartel·Miranda Resort·Medical Lab·Satellites·Toll Station에 필요한 태그별 생산 계산과 효과 큐 실행을 추가했다. 기업 태그와 낸 카드의 중복 태그는 세고, 뒤집힌 이벤트 태그는 제외한다. Toll Station은 상대방들만 센다.
- `corporate-era-economy.ts`에 24장의 생산·자원·드로우·태그별 생산 효과 데이터를 작성했다. 카드의 조건·지불·행동·점수까지 연결된 전체 실행 카탈로그는 아직 조립하지 않았다. 이 데이터는 실제 덱이 아니다.
- 지불 projection에 `steelValue`(2 또는 3)를 명시하고 `titaniumValue`를 3·4·5로 확장했다. 화면의 배수·지불 가치와 서버 지불 판정이 같은 산술 함수를 사용한다. 클라이언트가 배수를 명령에 추가하는 위조 요청은 거절한다.

근거: [Advanced Alloys](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/AdvancedAlloys.ts), [Standard Technology](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/StandardTechnology.ts) 및 각 카드의 인쇄 효과 설명을 대조했다. 일회성 다음 카드 할인은 아래 단계에서 구현했으며, 남은 선택형 효과와 실제 카드 통합은 후속 단계다.

## 다음 개발 단계

1. **경제 효과 통합 마무리:** 경제 계산·26장 효과 데이터를 전체 카드 조건·행동·점수와 조립하고 남은 즉시 효과를 구현한다.
2. **선택 효과 통합:** 구현한 비공개 열람·선택·구매를 실제 기업시대 카드의 조건·행동·사용 횟수와 연결한다. Mars University의 과학 태그별 손패 교환 엔진·트리거 계산을 추가했으며 실제 확장 카드 통합은 남아 있다.
3. **특수 규칙:** 구현한 생산량 복제·서식지 보호·토지 예약을 실제 확장 카드와 통합한다. 자원 공격 효과를 실제 카드와 연결하고 과학 태그 중복 반응과 남은 점수 규칙을 구현한다. 전투기·자원별 점수 배율은 아래 단계에서 기반을 추가했으며 실제 카드 통합이 남아 있다.
4. **시작 전 설정:** 방장 권한·room revision·중복 요청·동시 시작 검증, 참가자 표시, 208장 재고 검증과 시작 생산량 0 적용. 기업시대 기업 선택과 초기 효과 적용.
5. **실제 화면 검증:** 선택 대기·지불·재접속·최종 점수의 2–5인 시나리오, 모바일 조작과 기존 효과음 연결. 전체 효과가 준비된 뒤 옵션을 활성화한다.

## 근거 및 표현 원칙

- [기본판 공식 규칙서](https://cdn.1j1ju.com/medias/13/3f/fb-terraforming-mars-rule.pdf) 13쪽 Corporate Era: 표시된 프로젝트와 기업 2종 추가, 시작 생산 보너스 제외.
- [공개 카드 구분 목록](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/StandardCardManifests.ts)의 `CORP_ERA_CARD_MANIFEST`와 [카드별 인쇄 정보](https://github.com/terraforming-mars/terraforming-mars/tree/main/src/server/cards/base), [기업 정보](https://github.com/terraforming-mars/terraforming-mars/tree/main/src/server/cards/corporation)를 대조했다. 상속된 Mining Area의 건물 태그·비용 4도 포함한다.
- 영문명은 식별용 인쇄명이다. 공식 한국어 카드명 대조는 아직 남아 있으며 임의 번역을 공식 명칭으로 표시하지 않는다.
- 기본판 자동 회귀·다인 완주 검증은 완료된 범위를 유지한다. 사람의 장기 플레이, 실제 휴대폰·스피커 평가와 공식 한국어 용어 대조는 별도 미완료 항목이다.


## 비공개 카드 선택·구매 효과

- `corporate-era-selection.ts`에 Invention Contest(3장 중 1장), Business Contacts(4장 중 2장), Inventors Guild·Business Network(1장 열람 후 3 M€ 구매 또는 버리기)의 효과 데이터를 추가했다. 실제 기업시대 카드 등록은 아직 하지 않았다. Business Network의 시작 생산 감소 등 전체 카드 통합은 별도로 남아 있다.
- 서버는 후보 카드를 덱에서 분리한 대기 영역에 보관한다. 본인만 후보를 받고, 선택 완료 전에는 손패에 넣거나 다른 행동을 진행할 수 없다. 선택 후 나머지는 버린다. 덱이 부족하면 기존 버림 더미를 섞고, 전체 카드가 부족하면 실제 열람 수만큼 선택 수를 줄인다.
- 구매에는 프로젝트 할인·강철·티타늄을 적용하지 않는다. 헬리온은 열을 1 M€로 지불할 수 있다. 돈이 없어도 구매하지 않고 버릴 수 있다. 공개 기록에는 획득 장수만 남긴다.
- 화면은 기존 일러스트 카드, 선택 수 제한, 별도 확정, 열 지불과 잔량 안내를 제공한다. 모바일은 후보 카드 영역만 가로 스크롤하며 선택·획득 효과음을 재사용한다. 재접속하면 같은 후보를 복원하되 아직 확정하지 않은 로컬 선택은 초기화된다.
- 도메인 회귀는 3인 비공개 projection, 중복·외부 카드 ID와 잘못된 선택 수·열 지불 거절, 덱 재섞기·고갈·종료 취소의 137장 보존을 검증한다. 통합·브라우저 테스트는 미완성 확장 덱 대신 서버 테스트 fixture로 효과 큐를 준비하고, 실제 명령·재접속·UI를 검증한다.

근거: [Invention Contest](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/InventionContest.ts), [Business Contacts](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/BusinessContacts.ts), [Inventors Guild](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/InventorsGuild.ts), [Business Network](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/BusinessNetwork.ts)의 인쇄 효과와 기본판 규칙서의 카드 구매 규칙을 대조했다.


## 일회성 다음 카드 할인

- Indentured Workers의 `nextCardDiscount` 효과를 경제 효과 데이터에 추가해 총 25장이 됐다. 같은 세대 다음 프로젝트 카드에 8 M€를 할인하며 영구 할인과 합산하고 0 미만으로 내려가지 않는다.
- 서버 플레이어 상태가 남은 할인을 소유한다. 실제 카드의 지불에 성공한 직후, 그 카드의 새 효과를 실행하기 전에 기존 할인을 소비한다. 비용이 8보다 작아도 남는 할인은 이월하지 않는다.
- 카드 선택·잘못된 지불·취소는 할인을 소비하지 않는다. 일반 프로젝트, 카드 열람 구매, 매각, 차례 교대에도 남으며 세대 생산 시 만료한다. 실제 카드 등록과 인쇄된 -1 VP 적용은 전체 확장 카탈로그 통합 때 함께 검증한다.
- 본인 projection의 `nextCardDiscount`와 서버가 계산한 손패·지불 비용을 사용해 안내한다. 재접속해도 남은 할인과 지불 대기를 복원한다. 일반 프로젝트·카드 구매에는 적용되지 않는다는 설명을 표시한다.

근거: [Indentured Workers 인쇄 효과](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/IndenturedWorkers.ts). 기업시대 전체 덱과 시작 전 옵션은 계속 비활성 상태다.


## 과학 태그와 선택적 손패 교환

- `science.ts`가 Mars University 소유자의 새 과학 태그마다 `exchangeCard` 효과를 만든다. 새 카드가 낸 카드 목록에 들어간 후 계산하여 자기 과학 태그도 포함하고, Research의 두 과학 태그에는 두 효과를 만든다. 다른 플레이어의 카드에는 반응하지 않는다.
- 실제 손패 교환 엔진은 `EXCHANGE` 비공개 대기로 처리한다. 손패는 그대로 보관하고 선택 확정 시 한 장만 버린 다음 한 장을 뽑는다. 교환 생략은 손패·자원을 바꾸지 않으며, 빈 손패면 대기를 만들지 않는다. 버린 뒤 덱이 고갈되면 기존 재섞기 규칙에 따라 방금 버린 카드도 다시 뽑힐 수 있다.
- 여러 과학 태그는 각 선택을 따로 해결하므로 첫 교환에서 받은 카드를 다음 교환에 사용할 수 있다. 전체 카드 실행은 계속 한 행동이다. 카드의 즉시 효과와 교환 효과는 기존 서버 효과 선택 큐에서 해결한다.
- 화면은 손패 검색·일러스트·선택 해제·버릴 카드 이름·별도 확정·교환 생략을 제공한다. 손패 장수가 같아도 새 카드를 받으면 기존 획득 효과음을 재생하고 재접속에서는 반복하지 않는다.
- `EXCHANGE.cards`는 빈 배열이며 카드 후보를 손패와 중복 보관하지 않는다. 본인에게 이미 제공한 손패를 사용한다. 공개 로그에는 교환 여부만 기록하고 카드 이름·ID를 공개하지 않는다.
- 실제 기업시대 Mars University 카드 등록·1 VP와 전체 확장 대국 검증은 아직 남아 있다. 과학 태그 반응 계산과 서버 효과 큐를 따로 검증하며 브라우저는 서버 내부 테스트 fixture를 사용한다.

근거: [Mars University 인쇄 효과](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/MarsUniversity.ts).


## 서식지 보호와 공격 대상 검증

- `corporate-era-protection.ts`에 Protected Habitats의 보호 활성화 효과를 추가했다. 서버는 플레이어별 `protectedHabitats`를 소유하고 세대가 바뀌어도 유지한다. 현재 기본판 생성에서는 모두 false이며 실제 확장 카드는 아직 덱에 넣지 않았다.
- `protection.ts`의 단일 판정으로 상대 식물 제거와 동물·미생물 제거 대상, 포식자·개미 행동의 실행 가능 여부를 검사한다. 보호된 후보를 화면에서 제외하고 조작된 후보 ID를 보내도 서버가 다시 검사해 거절한다.
- 보호는 자원에만 적용하며 생산량 감소를 막지 않는다. 자신의 식물 제거·동물/미생물 사용은 허용한다. Pets의 동물 제거 금지는 보호 효과와 별개로 유지한다.
- 참가자 현황에 보호 표시를 공개하고 기업 엔진 요약에 보호 범위와 예외를 설명한다. 새 이미지·효과음은 추가하지 않고 기존 카드 실행 피드백을 유지한다.
- 테스트는 확장 덱 대신 보호 효과를 서버 큐에 넣는 fixture를 사용한다. 실제 Protected Habitats 카드 등록과 전체 기업시대 조합 검증은 남아 있다.

근거: [Protected Habitats 인쇄 설명](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/ProtectedHabitats.ts).


## 건물 생산량 복제

- Robotic Workforce의 `copyProduction` 효과 데이터를 추가했다. `production-copy.ts`는 건물 카드의 생산량 증가·감소·상대 생산량 감소만 추출한다. 카드의 행동·자원 수령·타일·TR·전역 지표·태그·지속 효과는 다시 실행하지 않는다.
- 대상은 자신이 이미 낸 카드 중 생산량 감소를 지불할 수 있는 카드다. 서버는 카드 실행 가능 여부와 실제 선택 후보에 같은 검증을 사용한다. 상대 카드·생산 상자가 없는 카드·감소 하한을 넘는 카드는 선택할 수 없다. M€ 생산의 하한 -5를 유지한다.
- Mining Rights는 자신이 이미 놓은 타일의 금속 종류를 조회해 그 생산만 올린다. 타일을 새로 놓거나 배치 보너스를 다시 받지 않는다. 동적 생산 효과는 복제 실행 시점의 서버 상태로 다시 계산한다.
- 화면 안내와 후보 설명에 실제 복제할 생산 효과·감소량·복제 제외 항목을 표시하고 별도 확정한다. 선택 대기는 기존 효과 큐와 재접속 경계를 사용한다.
- 실제 Robotic Workforce 등록과 9 M€ 지불, 기업시대 전체 건물 목록·Mining Area 등 미등록 추가 카드 조합은 전체 카탈로그 통합 단계에서 검증한다. 테스트는 유효한 서버 효과 fixture와 현재 등록된 기본판 건물을 사용한다.

근거: [Robotic Workforce](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/RoboticWorkforce.ts) 및 [생산 상자 범위](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/RoboticWorkforceBase.ts).

### 생산량 복제 단계 검증 (2026-09-16)

- 루트 `npm run typecheck`, `npm test`, `npm run build`와 `git diff --check` 통과. 전체 테스트는 공유 140개·웹 970개·서버 4,010개·공통 E2E 155개가 통과했다. 빌드의 기존 공통 청크 500 kB 초과 경고는 남아 있다.
- 마스 도메인·경제 테스트 55개 통과. 복제 제외 항목, 상대 카드 거절, 감소 지불 가능 여부·M€ 생산 하한, 기존 채굴 타일의 금속 종류를 검증했다.
- 실제 Chrome의 `e2e/mars-private-choice.browser.test.mjs` 통과. 기존 비공개 선택·교환·할인과 서식지 보호 표시, 생산량 복제 대기의 새로고침 복원·확정 후 서버 생산량을 확인했다. 320px 화면의 가로 넘침 검사와 스크린샷 시각 확인도 완료했다.
- 위 검증은 효과 엔진과 기본판 테스트 fixture 범위다. 실제 기업시대 카드 등록·전체 덱 조합과 로비 옵션은 아직 검증하지 않았다.

## 토지 예약

- Land Claim의 `claimLand` 효과 데이터와 공개 예약 상태를 추가했다. 빈 비예약 육지만 선택할 수 있으며 예약만으로 타일·보너스·인접 소유권·점수를 얻지 않는다.
- 상대 예약 칸은 모든 배치 후보에서 제외한다. 소유자도 도시 인접·녹지 인접 등 기존 배치 조건을 지킨다. 실제 타일을 놓으면 예약 표시를 제거하고 정상 배치 보너스를 한 번 적용한다.
- 지도에 기업 번호·색상 깃발과 점선 테두리를 표시한다. 선택·예약 확정·새로고침 복원·기존 확정 효과음을 연결했다.
- 실제 Land Claim 카드 등록·1 M€ 지불과 확장 전체 조합은 아직 남아 있다. 현재 검증은 기본판 서버 효과 fixture를 사용한다.

근거: [Land Claim 인쇄 설명](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/LandClaim.ts).

### 토지 예약 단계 검증 (2026-09-16)

- 마스 도메인·경제 59개 테스트 통과. 보너스·점수 미지급, 위조·중복·잘못된 예약 상태 거절, 상대 배치 거절, 정상 배치 시 예약 해소와 보너스 1회 적용, 세대 유지·최종 녹지를 확인했다.
- 실제 Chrome 두 세션에서 키보드 선택·예약 확정·상대에게 공개·새로고침 복원을 확인했다. 320px 모바일 가로 넘침 검사와 지도 스크린샷 시각 확인도 완료했다. 비공개 선택·교환·할인·보호·생산량 복제 회귀도 함께 통과했다.
- 실제 확장 덱이 아닌 서버 내부 효과 fixture 검증이다. 실제 Land Claim 카드 지불과 전체 기업시대 대국은 후속 통합 검증 범위다.
- 루트 `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` 모두 통과했다. 전체 테스트는 공유 140개·웹 972개·서버 4,014개·공통 E2E 155개가 통과했다. 기존 공통 청크 500 kB 초과 빌드 경고는 유지된다.

## 자원 공격 효과

- `corporate-era-attacks.ts`에 Hired Raiders·Sabotage·Virus의 선택 효과 데이터를 추가했다. 자원 종류를 고른 뒤 한 대상·수량을 선택하고 별도 확정한다. 보유량보다 많이 선택할 수 없으며 생략할 수 있다.
- 서버 `attackStock`은 상대 자원 차감과 동일 수량 수입을 한 번에 처리한다. 일반 제거는 수입을 주지 않는다. `removeCardResource`는 카드 한 장의 자원만 줄이고, Protected Habitats와 Pets를 검사한다.
- 화면은 대상 이름·카드 이름·수량 변화와 제거/탈취 차이를 안내한다. 기존 자원 변화 표시와 전용 공격 효과음을 연결했다.
- 실제 확장 카드 등록과 비용·태그·전체 대국 통합은 남아 있다. 엔진·브라우저 검증은 서버 내부 효과 fixture를 사용한다.

근거: [Hired Raiders](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/HiredRaiders.ts), [Sabotage](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/Sabotage.ts), [Virus](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/Virus.ts)의 인쇄 효과.

### 자원 공격 단계 검증 (2026-09-16)

- 마스 도메인·경제 63개 테스트 통과. 보유량을 넘는 위조 선택 거절, 단일 상대에게서 부분 수량 탈취, 제거 시 수입 없음, 생산량 불변, 서식지·Pets 보호와 생략을 검증했다.
- 최종 빌드로 실제 Chrome 두 세션 검증 통과. 공격 선택 새로고침 복원, 강철 1개 부분 탈취 후 양쪽 서버 자원, 320px 확정 화면과 가로 넘침을 확인했다. 기존 비공개 선택·교환·할인·보호·생산량 복제·예약도 함께 검증했다.
- 타입 검사·빌드·`git diff --check` 통과. 기존 공통 번들의 500 kB 초과 경고는 남아 있다. 효과음은 연속 스냅샷에서 공격 확정에 반응하고 재접속·중복 수신에서 반복하지 않는지 테스트했다. 실제 스피커 청취 평가는 별도다.
- 루트 `npm test` 전체 통과: 공유 140개·웹 973개·서버 4,018개·공통 E2E 155개. 최종 공격 기록 문구는 기업 번호로 정리하고 최종 빌드의 Chrome 검증도 재실행했다.

## 전투기·과학 자원과 점수 배율

- 카드 자원 종류에 전투기를 추가하고 자기 카드와 다른 자원 종류를 추가하지 못하도록 검증했다. 화면에 전투기 이름과 실제 자원별 점수 조건을 표시한다.
- 기본판 자원 점수를 `resourceScore: {per, points}`로 명시하고 최종 서버 정산에 연결했다. Physics Complex의 1개당 2점, Security Fleet의 1개당 1점, Tardigrades의 4개당 1점을 같은 계산으로 처리할 수 있다. 미완성 묶음은 카드별로 버림하며 다른 카드 자원과 합치지 않는다.
- Security Fleet(티타늄 1 → 전투기 1), Physics Complex(에너지 6 → 과학 1), Tardigrades(미생물 1 추가)의 행동 데이터를 추가했다. 실제 카드 등록·지불·세대당 사용 횟수와 해당 확장 카드의 브라우저 실행은 전체 카탈로그 통합 때 검증한다. 현재 확장 카드 행동 데이터와 점수 함수를 분리 검증하며 실제 기본판 자원 카드의 행동·점수 회귀를 함께 확인한다.

근거: [Security Fleet](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/SecurityFleet.ts), [Physics Complex](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/PhysicsComplex.ts) 및 기존 기업시대 인쇄 데이터.

### 카드 자원·점수 단계 검증 (2026-09-16)

- 마스 도메인·경제 66개 테스트 통과. 기본판 전체 자원 카드의 기존 점수 유지, 기업시대 세 카드의 점수 배율·묶음 경계, 전투기 종류 불일치 거절, 실제 어류 카드의 1세대 1회 사용과 재접속 정산을 확인했다.
- 공유 테스트 140개·웹 테스트 974개 통과. Chrome 두 세션에서 기존 마스 선택·효과 흐름과 어류의 실제 행동·동물 1→2·점수 문구·320px 화면을 검증하고 스크린샷을 확인했다. 전투기 카드 자체는 아직 미등록이므로 이 브라우저 검증에 포함하지 않는다.
- 루트 `typecheck`, `test`, `build`를 실행했으나 별도 작업 중인 `games/speakeasy/domain/scoring.ts`의 `SpeakeasyGoal.types/placement` 타입 오류와 `speakeasy.domain.test.ts`의 미사용 TileId로 서버 컴파일이 실패했다. 전체 테스트 후반 E2E는 실행되지 않았다. 마스 테스트·브라우저는 이번 컴파일에서 생성된 산출물로 별도 실행했으며 전체 빌드 성공으로 처리하지 않는다. 웹 빌드의 기존 500 kB 공통 청크 경고도 남아 있다. `git diff --check` 통과.
