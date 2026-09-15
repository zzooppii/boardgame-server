# 아발론 — 구현 경계

[규칙](AVALON_GAME_RULES.md), [공통 아키텍처](ARCHITECTURE.md), [방 교체](ROOM_GAME_SWITCH.md)를 따른다.

- Shared: 역할/설정/단계/명령 DTO, strict 공개 및 viewer별 projection. 실제 배정 및 비공개 표는 서버에만 저장한다.
- Domain: REVEAL → TEAM_BUILD → TEAM_VOTE → VOTE_RESULT → QUEST_VOTE → QUEST_RESULT → 다음 원정 또는 ASSASSINATION → FINISHED. 부결·실패 승리는 즉시 종료한다. candidate 복제 후 검증, 성공 시 단일 revision 증가. 시간과 ID, 난수 결과를 주입한다.
- Application: canonical room/game/phase, primary actor, membership, 대장/원정대원/암살자 자격, 불변 표, 멱등 receipt를 검증한다. room lane과 UoW/CAS로 직렬화한다. 동시 표는 gameId/phaseId/개인 제출 상태로 검사하므로 다른 사람의 표가 stale 원인이 되지 않는다. 강제 deadline 없음.
- Projection: 멀린에게 악의 위치만, 악에게 동료 위치만, 퍼시벌에게 좌석 순으로 정렬한 두 후보만 전송한다. 미공개 표는 본인 것만. 원정 결과에는 집계만 전송하며 원장은 집계 후 폐기한다. 방장도 권한이 동일하다.
- Platform: 기존 concrete game union, 저장 clone/validation, 시작/이탈/retention/projector/transport/웹 decoder를 additive 연결한다. 새 공통 게임 프레임워크나 dependency를 추가하지 않는다.
- Web: 판타지 삽화, 성배 원정 트랙, 왕관 대장, 방패 참가자, 가려진 개인 카드, 선택→확정 조작, 공개 투표 행렬, 원정 및 암살 연출. 모바일 카드 그리드와 고정 행동 영역. 소리는 역할 중립·사용자 제스처 활성화·음량 저장·중복/초기 snapshot/비활성 탭 억제. 움직임 감소 설정을 따른다.
- Art: 첨부한 실물 구성 사진은 분위기 참고. 자체 ImageGen atlas를 프로젝트에 저장하고 CSS sprite로 사용한다. 텍스트와 상태 표시는 React에서 렌더링한다. 자산 프롬프트는 images/avalon/README.md에 기록한다.

## 검증

- Domain: 5–10인 두 역할 구성, 승리 분기, 5회 부결, 7인 이상 4차 원정의 실패 2장 조건, 불변 표, 잘못된 명령과 저장 상태.
- Socket.IO: 5/7/10인 완주 및 재경기, actor/phase/game 검증, 재접속과 primary 교체, receipt 재전송, 비밀 정보 projection, 명시적 이탈 취소, 정원 제한.
- Web: 역할 카드 기본 가림, 단계별 행동 및 확정, 잘못된 wire 거부, 효과음 중복/초기/취소/장치 부재 처리.
- 실제 로컬 브라우저: 5인 방 생성부터 역할 확인·원정대 선택·투표·원정 3회·암살·결과 공개·재대기까지 진행. 새로고침 시 카드 가림과 음소거 유지 확인. 320/390/1280px에서 가로 넘침 없음. 플레이 도중 브라우저 오류 로그 없음.
- 공통 방 전환 테스트의 아발론 참가자는 최소 인원인 5인으로 설정했다. 다른 게임의 참가자 수와 검증은 유지했다.

일러스트와 생성 프롬프트: [자산 기록](../apps/web/public/images/avalon/README.md). 효과음은 [Web Audio 악보 및 재생기](../apps/web/src/features/avalon/sound.ts)에 정의한다.


### 개발 작업 폴더 검증 결과 — 2026-09-15

- 루트 `npm run typecheck`: 통과.
- 루트 `npm test`: 4,842개 통과, 실패/skip 없음 (shared 133, web 854, server 3,700, E2E 155).
- 루트 `npm run build`: 통과. 기존 통합 웹 번들의 500 kB 초과 경고는 남아 있다 (주 JS 약 2.22 MB, gzip 약 625 kB).
- `git diff --check` 및 신규 문서의 로컬 링크 검사: 통과.
- 초기 회귀 실패는 게임 목록의 기대값 및 공통 시작 테스트의 아발론 참가자 수를 갱신해 해결한 뒤 전체 검증을 다시 실행했다.

### 아발론 단독 커밋 검증 — 2026-09-15

하모니즈 및 별도 아크노바 작업을 제외한 커밋 후보를 독립 디렉터리에서 검증했다. 커밋의 게임 목록은 32개이며, 원래 작업 폴더의 다른 변경은 그대로 보존했다.

- 루트 `npm run typecheck`: 통과.
- 루트 `npm test`: 4,822개 통과, 실패/skip 없음 (shared 133, web 850, server 3,684, E2E 155).
- 루트 `npm run build`: 통과. 통합 번들 500 kB 초과 경고는 유지 (주 JS 약 2.18 MB, gzip 약 612 kB).
- 커밋 대상과 검증 디렉터리의 코드·자산 일치 확인 및 `git diff --cached --check`: 통과.
