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

근거: [Advanced Alloys](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/AdvancedAlloys.ts), [Standard Technology](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/base/StandardTechnology.ts) 및 각 카드의 인쇄 효과 설명을 대조했다. 일회성 다음 카드 할인(Indentured Workers)과 선택형 효과는 다음 단계다.

## 다음 개발 단계

1. **경제 효과 통합 마무리:** 이번에 구현한 경제 계산·24장 효과를 전체 카드 조건·행동·점수와 조립하고 일회성 다음 카드 할인, 남은 즉시 효과를 구현한다.
2. **선택과 비공개 카드:** Business Contacts·Invention Contest의 뽑아서 고르기, Inventors Guild·Business Network의 카드 열람·구매, Mars University의 버리고 뽑기. 선택 중 재접속과 상대 projection 비공개 검증.
3. **특수 규칙:** 생산량 복제, 토지 소유권 예약, 보호된 동식물·미생물, 자원 제거·탈취, 과학 태그 중복 반응, 전투기 자원과 자원별 점수.
4. **시작 전 설정:** 방장 권한·room revision·중복 요청·동시 시작 검증, 참가자 표시, 208장 재고 검증과 시작 생산량 0 적용. 기업시대 기업 선택과 초기 효과 적용.
5. **실제 화면 검증:** 선택 대기·지불·재접속·최종 점수의 2–5인 시나리오, 모바일 조작과 기존 효과음 연결. 전체 효과가 준비된 뒤 옵션을 활성화한다.

## 근거 및 표현 원칙

- [기본판 공식 규칙서](https://cdn.1j1ju.com/medias/13/3f/fb-terraforming-mars-rule.pdf) 13쪽 Corporate Era: 표시된 프로젝트와 기업 2종 추가, 시작 생산 보너스 제외.
- [공개 카드 구분 목록](https://github.com/terraforming-mars/terraforming-mars/blob/main/src/server/cards/StandardCardManifests.ts)의 `CORP_ERA_CARD_MANIFEST`와 [카드별 인쇄 정보](https://github.com/terraforming-mars/terraforming-mars/tree/main/src/server/cards/base), [기업 정보](https://github.com/terraforming-mars/terraforming-mars/tree/main/src/server/cards/corporation)를 대조했다. 상속된 Mining Area의 건물 태그·비용 4도 포함한다.
- 영문명은 식별용 인쇄명이다. 공식 한국어 카드명 대조는 아직 남아 있으며 임의 번역을 공식 명칭으로 표시하지 않는다.
- 기본판 자동 회귀·다인 완주 검증은 완료된 범위를 유지한다. 사람의 장기 플레이, 실제 휴대폰·스피커 평가와 공식 한국어 용어 대조는 별도 미완료 항목이다.
