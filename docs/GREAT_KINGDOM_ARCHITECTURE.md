# 그레이트 킹덤 구현 경계

[규칙](./GREAT_KINGDOM_GAME_RULES.md)을 따른다. 기존 Room/Session/직렬화 구조를 유지한다.

- shared games/great-kingdom: 엄격한 PLACE/PASS 명령, 공개 보드·영토·수순 DTO와 구조 일관성 검사. 보드 전체나 점수를 명령으로 받지 않는다.
- server domain: 81개 구성물 ID 보존, 색별 영역 탐색, 중립 성의 경계/득점 구분, 네 변 제외, 연결 성의 공성, 연속 패스. 순수 함수가 전체 candidate를 생성한다.
- application: primary 인증 actor, room/game phase, gameId/revision/turnId 확인. 방 직렬화와 UoW·idempotency 영수증을 재사용한다. 실패 시 상태와 revision 불변.
- projection: 참가자만 읽는다. 공개 보드는 동일하며 미배치 성 ID와 저장 state는 노출하지 않는다. 서버가 합법 좌표와 영토를 계산한다.
- lifecycle: 사람 대전의 선택적 턴 제한 및 AI 차례 예약. 재접속·명시적 이탈 취소·종료 보존·방장 승계·같은 방 재시작은 기존 concrete adapter 형태로 연결한다.
- web: 별도 반응형 화면. 자체 SVG 성/표지, 영토 해칭, 마지막 수, 선택 후 확정, 패스 확인, 수순, 규칙 설명, 결과 보드. 시각·소리는 서버 판정을 보조하며 판정을 지연하지 않는다.
- audio: 사용자 제스처 이후 Web Audio 활성화. 선택/배치/영토/패스/차례/공성/승리·패배·무승부를 구분. 음량/음소거 선호는 로컬 저장, 초기 snapshot·재접속·중복 revision은 결과음을 재생하지 않는다.
- 새 dependency, 기존 게임 리팩터링, 공개 배포는 포함하지 않는다.

## 검증

구현 완료 후 domain 경계, 실제 Socket.IO, 웹 조작과 소리 정책, root typecheck/test/build 및 데스크톱·모바일 검증 결과를 기록한다.

### 2026-09-16 실행 기록

- 전용 domain 11개: 영토/중립/네 변/상대 성/공성/자기 포위/동시 포위/패스/점수 경계/성 ID 보존. 20개 seed의 완주도 포함한다.
- 전용 실제 Socket.IO 5개: 2인 제한, capability, actor·revision·payload 검증, 원자적 거부, 중복 요청, 공개 projection, 공성·영토 종료, 재대국, 재접속·구 socket 거부·이탈 취소, 기본 설정에서 시작 가능.
- 전용 Web 5개: 각 phase 렌더링, 81개 좌표, 조작 권한과 선택 scope, 엄격한 DTO, 초기/중복/재접속 효과음 억제.
- 인앱 브라우저에서 두 origin의 실제 참가자 연결: 새 방, 참가, 선택 미리보기·확정, 3수 공성 종료, 새로고침 복구, 같은 방 재시작, 연속 패스 확인·영토 종료, 방향키/Enter/Escape, 게임 방법, 효과음 미리듣기·음소거를 조작했다. 콘솔 error/warn 없음. 실제 스피커 음질 평가는 별도다.
- 390×844 및 320×740 viewport에서 가로 overflow 없음. 확대 시 540px 보드가 보드 컨테이너 안에서만 스크롤된다. viewport override는 검증 후 해제했다.
- 초기 브라우저 검증은 임시 3칸 정책으로 수행했다. 이후 사용자 정정에 따라 보정 필드·런타임 설정·시작 제한을 제거하고 `great-kingdom-base-v2`로 변경했다. 서버는 실제 영토 수를 비교하며 동률의 `TERRITORY` 결과는 `winnerPlayerIds: []`다. UI는 무승부 문구와 전용 효과음을 제공한다. 구 v1 projection은 새 계약에서 거부한다.

### 주요 변경 위치

- `packages/shared/src/games/great-kingdom/{actions,contracts}.ts`
- `apps/server/src/games/great-kingdom/{domain,application,compatibility}/`
- `apps/web/src/features/great-kingdom/{GreatKingdomScreen,art,ui,sound,great-kingdom.css}`
- `apps/web/public/images/great-kingdom/cover.svg`: 직접 제작한 SVG. 외부 규칙서·상품 이미지는 배포 자산에 포함하지 않는다.
- 공통 game type, DTO/protocol, room 생성·선택·start·lifecycle·projection, Socket.IO, Web decoder·catalog·App의 분기만 추가한다.

### 최초 구현 검사 (점수 정정 전)

- root `npm run typecheck`: 통과.
- root `npm run build`: 통과. 기존 대형 번들 경고 유지(main 약 2.53MB minified).
- root `npm test`: shared 140/140, web 969/969, server 4003/4004. 기존 `SNEAKY eight raw clients / 15-second real-time tapping keeps teacher scheduler responsive`가 `Too little exercise: 120`으로 실패하여 root 명령은 실패했다.
- 위 부하 테스트를 `--test-name-pattern='15-second real-time tapping'`으로 단독 재실행: 해당 1개 통과. 다른 76개는 이름 필터로 실행 대상이 아니며 원본 테스트는 변경하지 않았다. 전체 실행의 실패를 성공으로 대체하지 않는다.
- root가 단락 실행으로 중단한 마지막 Space Crew E2E는 동일 명령으로 별도 실행: 155/155 통과.
- `git diff --check`: 통과. 작업 중 함께 변경되던 다른 게임 파일은 수정하거나 되돌리지 않았다.

### 점수 기준 정정

사용자 정정에 따라 선후공 보정을 삭제했다. 양쪽 각각 정확히 1칸 앞서는 경우와 0:0·1:1 동률을 domain 테스트로 검증한다. 기본 runtime에서 게임 시작을 검증하고, 무승부 DTO·렌더링·효과음 및 구 버전 projection 거부를 검사한다. 점수 기준에 남은 미확정 항목은 없다. UI 안내·결과·서버 판정은 같은 기준을 사용한다.

정정 후 검증: root `typecheck`, `test`, `build` 모두 통과. 전체 테스트 shared 140 + web 971 + server 4,010 + E2E 155 = 5,276개 통과. 그레이트 킹덤 전용 21개 포함. 기존 대형 번들 경고는 유지된다. `git diff --check` 통과. 검토용 로컬 서버도 보정 설정 없이 기본 runtime으로 재시작했다.

## AI·턴 제한 확장 (2026-09-17)

- 대기실의 `greatKingdom:configure`는 방장·room revision·엄격한 settings를 검사하며 UoW와 idempotency를 사용한다. 설정은 방과 게임에 보존한다.
- AI는 game state의 `botPlayerId`로만 표현한다. room roster·presence·session에는 가짜 접속자를 만들지 않는다. projection은 실제 사람 roster와 AI를 제외한 게임 참가자의 일치를 검증한다.
- AI 수 선택은 별도 domain 모듈에서 공개 보드를 평가한다. 난이도별 노드 예산과 협력적 yield를 사용한다. 최종 수는 기존 domain 적용 함수를 통과한다.
- AI 차례의 650ms 예약 및 사람의 선택적 deadline은 기존 TurnScheduler·ScheduledTurnRouter·active deadline 복구를 재사용한다. room mutation 직렬화 안에서 game/revision/turn/deadline을 재검사하여 늦은 callback과 중복 적용을 막는다.
- 사람의 시간 초과는 PASS다. 클라이언트의 시계는 서버 시각을 기준으로 단조 증가하는 경과 시간을 표시하며 승패를 판정하지 않는다. 게임 종료·이탈 후 예약은 유효 상태 검사를 통과하지 못한다.
- 대기실은 AI 3단계와 친구 대전, 시간 선택·저장 상태를 제공한다. 대국 중 AI 생각 중 표시와 카운트다운, 10초 이하 강조를 제공한다. 기존 배치·턴·패스·결과 효과음을 그대로 사용한다.

### 확장 검증 기록

- 그레이트 킹덤 서버 전용 24/24 통과: 기존 규칙·소켓 검증에 AI 3단계 합법 수·공성/방어·완주, 방장 설정과 재시도, 만료 시 늦은 착수 거부, 이른/중복 callback 무시, 자동 패스·영토 종료, 시간 유지 재접속·재대국을 추가했다.
- 웹 전용 8/8, 시작/카탈로그 포함 선택 검사 16/16 통과. 공통 게임 선택·재대국 Socket.IO 회귀 82/82 통과.
- 실제 브라우저: 고급 AI 시작→착수→자동 응수→내 차례 복귀, 새로고침 복구. 친구 대전 120초 설정 저장·새로고침 유지, 두 origin 참가자의 60초 동기화 및 비방장 설정 비활성화. 실제 60초 초과 자동 패스, 두 차례 시간 초과 후 양쪽 무승부, 재대국의 60초 유지 확인. 콘솔 error/warn 없음.
- 데스크톱·390px 모바일 설정 패널을 시각 확인했다. 모바일 난이도 2열, 가로 overflow 없음. 임시 viewport를 복원했다. 기존 배치·차례·패스·결과 소리와 음량 제어를 유지한다.
- root `typecheck`와 `build`를 실행했으나 동시에 작업 중인 `games/arnak/domain/action-hints.ts`의 `p` possibly undefined 및 파생 Player 타입 오류로 실패했다. shared/web 검사와 Vite 빌드는 통과했고 기존 500kB 초과 번들 경고는 남았다.
- root `test`: shared 145/145, web 1,015/1,016. 다른 작업의 `Mars played card exploration combines search with action, passive and resource filters without changing state`에서 Psychrophiles가 포함되는 기대값 차이로 실패해 server/E2E 단계가 실행되지 않았다. 해당 게임 소스와 assertion은 변경하지 않았다. 최신 server test compile도 위 아르낙 오류를 보고했으며, emit된 최신 그레이트 킹덤 전용 테스트 및 공통 게임 선택 회귀는 별도 실행하여 통과했다.
- 처음 포트 권한 없이 시작한 Socket.IO 검사는 EPERM으로 실패했다. 이후 허용된 로컬 포트 실행으로 전용 검사를 재실행했다. 권한 없는 root test는 중단하고 로컬 포트 실행 권한으로 root test를 다시 실행한 결과가 위 기록이다.
- root test가 중단하여 별도로 실행한 Space Crew E2E 155/155 통과. `git diff --check` 통과. 전체 root 검사의 실패를 이 개별 통과로 대체하지 않는다.
