# 퍼치 구현 경계

[규칙](./PERCH_GAME_RULES.md)에 따른 서버 권위형 2–5인 기본판. 기존 Room/Session/직렬화/UoW를 유지한다.

- shared/games/perch: 구성물 메타데이터, 공용 DTO, 명령의 런타임 검증, 공개 보드 계산. 서버 전체 상태는 공유하지 않으며, 목표·목표 후보는 본인의 privateState로만 투영한다.
- server/games/perch/domain: deterministic candidate 전이, 난수·ID·시간 주입, 새 보존, 실제 배치 권한과 새 색깔 소속 분리, 효과 큐와 추가 선택, 정산.
- application/compatibility: 현재 세션·gameId·revision·transition 검증, 중복 명령 receipt, 원자적 저장, 플레이어별 projection, 명시적 퇴장 취소. 단절 중 자동 전략 선택 없음.
- web/features/perch: 일러스트 장소 보드, 분수와 광장, 색+문양 새, 점수 예상, 카드 설명, 확인 후 배치, 동물 경로·대상 선택, 모바일 확대, 소리 설정. 재접속/같은 revision에서 과거 소리를 재생하지 않는다.
- 아트는 imagegen 생성물, 글과 숫자는 DOM, 조작 가능한 보드 구조는 React/SVG. 소리는 Web Audio로 직접 합성하며 외부 음원이나 새 dependency를 추가하지 않는다.

## 브라우저 검수

- localhost의 서로 다른 두 브라우저 세션으로 방 생성, 참가, 목표 선택, 둥지 배치, 확인 대화상자, 차례 넘기기와 새로고침 재접속 확인.
- 확인창에서 Tab 순환과 Escape 취소를 제공하며, 결과 수신 시 오래된 draft를 제거한다.
- 390px 모바일과 1440px 데스크톱에서 카드·분수·조작 영역을 확인. 모바일 보드는 인접 관계를 유지한 채 내부 가로 스크롤과 확대를 제공한다. 문서 전체의 가로 넘침 없음.
- 오디오 컨텍스트 활성화 표시, 음소거 0%, 음량 복원과 재생 버튼 확인. 브라우저 오류 로그 없음. 소리의 청감 평가는 자동 검증 범위에 포함하지 않는다.
- 생성 아트의 출처·프롬프트: [assets README](../apps/web/public/images/perch/README.md).

## 자동 검증 범위

- 2–5인 추천/무작위 64개 시드 게임을 5라운드 종료까지 진행하며 매 전이 새 보존 검증.
- 동물 9종, 목표 22종의 성공/실패 사례, 양면 분수 자리 수와 받침, 동률 정산, 새집 보호, 잘못된 입력의 원자적 거절.
- 실제 Socket.IO의 동시 요청·중복 요청·stale revision, 목표 비공개, 재접속, 퇴장 취소, 같은 방 재시작과 다른 게임 전환.
- 화면 렌더링, 계약 거절, 소리 중복/재접속 방지. 기존 전체 회귀 테스트와 root typecheck/build를 함께 실행한다.

## 2026-09-14 최종 결과

- Root `npm run typecheck`: 통과.
- Root `npm test`: 4,716개 통과, 실패/skip 0 (shared 133, web 788, server 3,640, 통합 미션 155).
- Root `npm run build`: 통과. 기존 단일 진입 번들 크기 경고 유지 (JS 약 2.10 MB, gzip 약 589 KB).
- `git diff --check`: 통과. 새 dependency·설정 변경 없음. 공개 배포는 수행하지 않음.
- 중간 검증에서 발견한 카탈로그의 기존 고정 개수와 이벤트 union 기대값을 31개 게임 계약에 맞게 갱신했다. 분수 4–5인 아래 세 층의 자리 수를 원본과 대조해 각 4개로 수정하고 회귀 테스트를 추가했다.
