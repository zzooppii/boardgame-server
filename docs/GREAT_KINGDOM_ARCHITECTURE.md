# 그레이트 킹덤 구현 경계

[규칙](./GREAT_KINGDOM_GAME_RULES.md)을 따른다. 기존 Room/Session/직렬화 구조를 유지한다.

- shared games/great-kingdom: 엄격한 PLACE/PASS 명령, 공개 보드·영토·수순 DTO와 구조 일관성 검사. 보드 전체나 점수를 명령으로 받지 않는다.
- server domain: 81개 구성물 ID 보존, 색별 영역 탐색, 중립 성의 경계/득점 구분, 네 변 제외, 연결 성의 공성, 연속 패스. 순수 함수가 전체 candidate를 생성한다.
- application: primary 인증 actor, room/game phase, gameId/revision/turnId 확인. 방 직렬화와 UoW·idempotency 영수증을 재사용한다. 실패 시 상태와 revision 불변.
- projection: 참가자만 읽는다. 공개 보드는 동일하며 미배치 성 ID와 저장 state는 노출하지 않는다. 서버가 합법 좌표와 영토를 계산한다.
- lifecycle: 시간 제한 없음. 재접속·명시적 이탈 취소·종료 보존·방장 승계·같은 방 재시작은 기존 concrete adapter 형태로 연결한다.
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
