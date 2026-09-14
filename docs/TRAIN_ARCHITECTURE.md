# TRAIN 아키텍처

2026-09-12. 규칙은 [TRAIN_GAME_RULES.md](TRAIN_GAME_RULES.md), 기존 플랫폼 경계는 [ARCHITECTURE.md](ARCHITECTURE.md)를 따른다. 새 dependency 없이 기존 React/Socket.IO/Valibot/TypeScript 구조에 추가한다.

## 책임과 계약

- `packages/shared/src/games/train`: 고정 지도·목적지 카탈로그, opaque 카드 ID, strict command 및 플레이어별 projection DTO. 전체 덱/비공개 서버 상태는 포함하지 않는다.
- `apps/server/src/games/train/domain/game.ts`: 주입된 난수·시간·ID로 초기화 및 순수 candidate 전이. 카드 110장/목적지 30장의 유일성·보존, 색별 구성, 점유 노선·기차·점수, 단계와 종료 결과를 검증한다. 연결은 그래프 탐색, 최장 노선은 사용한 edge의 BigInt mask를 기억하는 정확한 탐색이다. 도시 재방문은 허용하고 edge 재사용은 금지한다.
- `application/service.ts`: 인증된 현재 primary player, gameId/turnId/revision, requestId fingerprint를 검증한다. 기존 room executor와 unit of work로 중복/경합을 직렬화하고 검증된 candidate만 commit한다. Socket.IO handler는 이를 호출한다.
- `compatibility/adapter.ts`, `projector.ts`: 내부 상태 저장/검사, 본인 손패와 목적지만 전달. 상대에게는 개수·기차·노선 점수만 전달하며 종료 시 정산 목적지를 공개한다.
- 기존 start/leave/presence/retention/snapshot 라우터와 composition root에 TRAIN을 등록한다. 지속 playerId와 임시 socketId, sessionToken 정책을 그대로 유지한다.

## 단계와 복구

`SETUP → TURN → DRAW_SECOND → TURN` 또는 `TURN → CHOOSE_TICKETS → TURN`.
노선 점유와 첫 공개 기관차는 TURN에서 다음 TURN으로 전이한다. 모든 실제 획득과 목적지 제시는 즉시 서버 commit이다. 실패한 입력은 상태/게임 revision을 바꾸지 않는다. 차례마다 서버 deadlineAt = 시작 시각 + 90초를 저장한다. 부분 행동은 deadlineAt을 유지하며 transitionId/revision만 갱신한다. 접속 단절은 현재 단계를 유지하고 시간을 연장하지 않는다. 명시적 나가기는 CANCELLED, 기차 종료 조건 또는 전원 행동 불가 시 FINISHED가 된다. 종료 후 방장 승계·같은 방 재시작/게임 변경은 기존 플랫폼을 따른다. in-memory 저장이므로 서버 프로세스 재시작 복구는 지원하지 않는다.

## 화면과 소리

- `TrainBoard.tsx`: SVG로 미국 지도(36개 도시·100개 노선·309칸) 또는 한국 창작 지도(30개 도시·81개 노선·255칸)와 점유 기차를 그린다. 정적 지도 좌표/노선 데이터는 판정 데이터와 같으며 곡률/복선 간격은 렌더링 책임이다. 클릭/키보드/목록 선택, 확대·축소·드래그·핀치, 목적지 도시 강조를 제공한다.
- `TrainScreen.tsx`: 공개 시장, 색별 손패, 목적지 선택/반환 순서, 지불 카드 조합 확인, 마지막 순환, 종료 정산. scope 변경 시 선택/재시도 상태를 정리하며 응답 불명확 시 같은 requestId로 재시도한다. UI의 가능한 행동 계산은 안내용이고 최종 판정은 서버가 한다.
- `sound.ts`: Web Audio로 카드·기차 배치·완료·차례·결과 효과음을 합성한다. 사용자 제스처 후 활성화하며 음소거/음량을 로컬 저장한다. 처음 받은 스냅샷은 과거 소리를 재생하지 않는다.
- 원본 여행 일러스트와 9종 열차 카드 atlas는 [이미지 제작 기록](../apps/web/public/images/train/README.md)을 참고한다. 보드·목적지 장식·기차 말은 SVG/CSS로 그린다. 색 외에 기호·문구를 제공하며 reduced-motion을 따른다.

## 검증

`train.domain.test.ts`: 구성·보존·행동·복선·최장 노선·마지막 차례·2–5인 완주.
`train.integration.test.ts`: 실제 socket 인증·동시성·중복·비공개 정보·재접속·취소·게임 변경.
`train-ui.test.ts`: 90초 카운트다운·기차/카드 부족 사유·지불 선택·노선 열림·두 번째 뽑기 제한·지도 기하/화면 정적 렌더링.
루트 `typecheck`, `test`, `build`, `git diff --check`와 실제 브라우저 2인 조작/모바일 배치를 확인한다.

2026-09-12 검증 결과: 루트 typecheck/test/build 성공. 전체 회귀 테스트 shared 126, web 640, server 1780 모두 통과한 뒤 추가한 음향 fallback·socket 완주/재시작을 포함해 TRAIN focused web 4 + server 18도 통과했다. desktop 두 브라우저의 목적지 선택·노선 점유·두 장 뽑기·중간 새로고침 복구와 390px 모바일 배치/확대/음소거 유지 확인. 최종 JPEG 빌드 로드 확인. 자동 효과음 cue 검증을 수행했으나 실제 스피커 음색 청취는 별도 확인 대상이다. Vite의 기존 500kB 초과 chunk 경고는 유지된다. 공개 배포는 수행하지 않았다.


## 2026-09-14 오류 수정 및 90초 타이머

마지막 차례의 KEEP_TICKETS에서 pendingTickets를 비운 뒤 endTurn이 CHOOSE_TICKETS를 유지한 채 FINISHED로 바꿔 `Train pending tickets mismatch`가 발생했다. endTurn이 먼저 완료된 행동의 step을 TURN으로 정리하도록 수정했으며, 2–5인/1–3장 보유 및 시간 초과 정산 회귀 테스트로 검사한다.

TRAIN adapter는 activeTurn을 제공하며 공통 scheduler/router/overdue sweeper가 deadlineAt을 복구한다. timeout은 서버 Clock과 room/gameId/revision/turnId/deadlineAt 전체를 검증하고, 같은 방 executor에서 일반 command와 직렬화한다. 늦은 입력은 TURN_EXPIRED로 거부한다. timer 자동 행동 여러 개는 내부 candidate에서 수행한 후 revision 한 번으로 commit하며 TIMEOUT feedback에는 비공개 카드 내용이 없다. 만료 전 요청·중복 timeout·이전 타이머·재접속·마지막 목적지 확정은 테스트 대상이다.

화면은 남은 기차 말/열차 카드/노선 점수를 구분하고, 부족한 기차의 실제 수와 필요한 수를 표시한다. 90초 표시는 serverTime + monotonic 경과 시각을 사용하며 실제 판정은 서버만 수행한다. 기존 in-memory 저장의 서버 재시작 복구 제한은 유지된다.

검증 기록(2026-09-14): 수정 전 마지막 목적지 확정 테스트가 `Train pending tickets mismatch`로 실패함을 확인했다. 수정 후 루트 typecheck/build/test가 통과했다(shared 131, web 755, server 3423, space-crew e2e 155). 이후 동시 진행 중인 별도 ARK_NOVA 작업의 `conservation-bonuses.ts`에서 ports.js 모듈 및 FREE_UNIVERSITY/FREE_PARTNER 타입 오류가 생겨 최신 server 전체 재컴파일은 실패했다. 해당 파일은 변경하지 않았으며 TRAIN 두 테스트 엔트리와 실제 의존 코드를 분리 컴파일한 뒤 22개 서버 테스트가 모두 통과했다. 웹 TRAIN 6개도 통과했다. Vite 500kB 초과 기존 번들 경고는 유지된다. 별도 로컬 3017 서버의 실제 브라우저에서 01:30 카운트다운 및 90초 만료 후 목적지 2장 자동 보유/다음 플레이어 전환을 확인했다. 운영 서버 배포·현재 판 변경은 수행하지 않았다.

## 2026-09-14 지도 선택과 한국 창작 지도

`maps.ts`가 지도별 도시·노선·목적지·기차 수·배점·화면 크기를 제공한다. `korea-catalog.ts`는 창작 도시 30개, 노선 81개(255칸), 목적지 30장이다. 한국도 미국판 기본 규칙을 사용한다. 기존 미국 카탈로그와 mapId 없는 저장 상태는 USA로 유지한다.

`train:configure`는 방장·대기실·roomRevision을 검증해 settings.mapId를 저장하고 준비 상태를 해제한다. 시작 시 선택한 지도와 rulesVersion을 게임에 고정한다. 서버 판정, 저장 검증, 플레이어 projection, UI 모두 같은 지도 정의를 조회하며 다른 지도의 카드/노선은 거부한다. 재접속은 지도·비공개 카드·기존 서버 deadline을 보존한다.

`TrainMapPicker.tsx`는 미국/한국 선택과 전용 여행 일러스트를 제공한다. `KoreaLandscape.tsx`는 창작 SVG 배경이며 `TrainBoard.tsx`가 해당 지도의 세로 비율·도시명·곡선·복선·확대 이동을 적용한다. 기존 카드/기차/턴 효과음과 음량 설정을 공유한다. 지도 추가 시 카탈로그와 지도 정의, 필요한 배경 및 검증을 추가한다. 특수 규칙이 있는 공식 확장은 별도의 규칙 설계가 필요하다.

지도 카탈로그 테스트는 연결성, 노선/목적지 ID, 복선, 칸 수, 독립적인 최단 경로 배점을 검사한다. 두 지도 각각 2–5인/3개 seed 완주 및 한국 지도 인증·설정·재접속·다른 지도 참조 거부를 검사한다. 실제 사람과의 반복 플레이에 따른 한국 지도 밸런스 조정은 남아 있다.

지도 확장 검증: 최신 루트 typecheck/build 통과. 실제 로컬 2인 브라우저에서 한국 지도 선택·게임 시작·목적지 선택·파주–서울 2칸 점유(기차 45→43, 노선 점수 0→2)·다음 차례 전환·90초 자동 행동·새로고침 복구·확대를 확인했다. 모바일 viewport 도구의 390px 설정이 실제 화면에 적용되지 않아 이번 변경의 모바일 실화면 검증은 미완료다. 합성 효과음 경로는 기존 기능을 공유하며 실제 스피커 청취는 별도 확인 대상이다. Vite 500kB chunk 경고가 유지된다. 운영 배포는 수행하지 않았다.

최종 전체 회귀 결과: 루트 `npm test` 통과(shared 132, web 757, server 3455, space-crew e2e 155). 루트 typecheck/build 및 `git diff --check`도 통과했다. 중간 재접속 테스트에 추가한 phase 분기 타입 오류를 수정한 뒤 전체를 재실행한 결과다.

## 모바일 지도 조작 보완 및 구조 점검 (2026-09-14)

`map-viewport.ts`는 지도 크기와 현재 배율로 이동 한계를 계산한다. 축소하거나 가장자리까지 드래그해도 지도 밖 빈 공간으로 밀리지 않으며, 전체 보기에서는 중앙으로 복귀한다. 핀치가 끝나 한 손가락만 남으면 현재 위치를 기준으로 드래그를 이어간다. 760px 이하에서는 지도 조작 버튼의 최소 터치 크기를 44px로 제공한다.

한국 지도 구조 점검: 2칸 23개, 3칸 35개, 4칸 15개, 5칸 4개, 6칸 4개. 목적지 점수 범위 3–19, 평균 10.43(미국 4–22, 평균 11.63). 어느 노선 그룹 하나를 모두 막아도 전체 도시가 연결되는지 회귀 테스트를 추가했다. 이는 한 구간 차단에 대한 우회 가능성을 확인하며, 여러 플레이어의 동시 점유나 전략적 난이도 균형을 보장하지는 않는다. 목적지 배점과 노선 구성은 변경하지 않았다.

390×844 CSS 픽셀 iframe에 실제 앱을 로드해 모바일 지도·공개 카드 가로 스크롤·버튼 배치를 확인했다. 이 방식은 이전 viewport 도구 제한을 피하며 실제 기기 터치 센서 검증과는 구분한다.

모바일 실제 조작 결과: 청주–대전 2칸 선택 및 점유, 기차 45→43개·노선 점수 0→2점·다음 차례 전환 확인. 확대·드래그 후 축소 시 전체 지도 복귀도 확인했다. 실제 휴대전화의 두 손가락 터치 조작은 별도 확인 대상이다. 타입 검사와 빌드가 통과했고, 기존 Vite 500kB chunk 경고는 유지된다.

최종 보완 검증: 루트 typecheck/build/test 모두 통과. 테스트 shared 133, web 758, server 3467, 통신 e2e 155(합계 4513). `git diff --check` 통과. 공개 배포와 커밋은 수행하지 않았다.

## 일본 창작 지도 추가 (2026-09-14)

`japan-catalog.ts`: 32개 도시, 75개 노선(236칸), 목적지 30장(5–21점). `maps.ts`에 JAPAN과 `train-japan-original-v1`을 등록했다. 서버 state/projection 및 공통 turn-transition의 TRAIN 규칙 버전 판별을 확장했다. 기존 train:configure 계약과 90초 타이머, 일반 노선 점유, 점수 계산 및 효과음을 그대로 사용한다. 전 지도의 목적지·노선 ID는 분리하며 섬 사이 연결도 일반 노선이다.

`JapanLandscape.tsx`의 세로형 1200×1500 SVG와 `japan-journey.jpg`를 사용한다. 선택 화면은 넓은 화면에서 세 지도를 한 줄에 보여준다. 일러스트 제작 도구와 프롬프트는 [이미지 제작 기록](../apps/web/public/images/train/README.md)에 보관했다. 북부 및 시코쿠 주변의 긴 노선은 인근 도시와 혼동하지 않도록 곡률을 조정했다.

자동 검증: 세 지도 각각 2–5인 × 3 seed(총 36판) 완주와 보존·정산, 일본 설정의 방장/단계/revision/idempotency 검증, 재접속 카드·타이머 보존을 검사한다. 일본 목적지 배점은 독립적인 최단 경로 계산과 대조하고 어느 노선 그룹 하나가 막혀도 전체 도시의 우회 연결이 유지되는지 검사한다. 실제 사람의 전략별 승률과 체감 난이도는 이 검사로 보장하지 않는다.

일본 추가 검증 결과: 루트 typecheck는 통과했다. 이후 동시에 변경 중인 ARK_NOVA의 association-work.ts / association.ts / game.ts 타입 불일치로 루트 build와 test의 서버 컴파일이 실패했다. 해당 파일은 수정하지 않았다. TRAIN 실제 의존 코드만 별도 TypeScript 프로젝트로 컴파일한 뒤 도메인·Socket.IO 통합 25개가 통과했다(핵심 판정을 mock으로 대체하지 않음). shared 133개 및 최종 web 759개 테스트, 최종 web build, git diff --check 통과. Vite 500kB chunk 경고 유지. 전체 통신 e2e는 루트 server 컴파일 실패로 실행되지 않았다.

실제 로컬 2인 화면에서 일본 지도 선택, 일러스트 로드, 목적지 두 장 보유, 삿포로–아사히카와 점유(기차 45→43, 노선 점수 0→2), 다음 차례와 재접속을 확인했다. 390×844 CSS 픽셀 iframe에서 일본 지도 전체 배치와 확대도 확인했다. 실제 휴대전화 터치 및 사람 간 전략 밸런스는 별도 확인 대상이다. 이번 일본 지도는 커밋·운영 배포하지 않았다.
