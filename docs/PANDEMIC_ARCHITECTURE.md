# 팬데믹 구현 경계

[규칙](./PANDEMIC_GAME_RULES.md)을 따른다. 기존 Room/Session/직렬화/UoW 구조를 유지한다.

- shared/games/pandemic: 도시 그래프·역할·카드 메타데이터, 엄격한 command 및 viewer projection. 지도 좌표는 이동 판정에 사용하지 않는다.
- server/games/pandemic/domain: 순수 candidate 전이, 주입 난수/ID/시간, 감염 연쇄, 카드·큐브 보존, 동의/예측 대기.
- application: actor/session/game/revision/turn 검증, 같은 방 직렬화 및 중복 명령 receipt. 성공한 candidate만 commit.
- compatibility: 저장 상태 의미 검증, 숨은 덱 순서와 비공개 손패 보호. 전체 서버 state를 DTO로 보내지 않는다.
- web/features/pandemic: 남색 지도와 청록빛 대륙, 도시/연결 SVG, 카드·역할 아트, 선택/비용/확정 패널, 모바일 지도 확대, 독립 음량·음소거, 감염·치료·발병·승패 피드백. 첫 snapshot/재접속/중복 revision은 지난 효과음을 재생하지 않는다.
- 외부 dependency 및 배포 설정 변경 없음. 서버 재시작 후 방 복원은 기존 메모리 저장 한계를 유지한다.

## 검증 기록

2026-09-14 검증:

- `npm run typecheck`: shared/web/server 통과.
- 루트 `npm test`: shared 133개 + web 784개 + server 3,588개 + 기존 Space Crew E2E 155개, 총 4,660개 통과. 이후 추가한 비공개 공유 회귀 2개를 포함해 팬데믹 domain 전체 45개를 별도 재실행하여 통과.
- `git diff --check`: 통과.
- `npm run build`: shared/web/server 통과. 기존 단일 번들의 500 kB 초과 경고 유지(메인 JS 약 2.05 MB, gzip 약 576 kB).
- 팬데믹 domain 45개: 2–4인·난이도별 배치, 48도시/93연결, 이동 비용, 역할, 연쇄 발병, 승패, 이벤트, 손패 제한, 비공개 카드 공유, 불법 입력의 원자적 거절, 결정적 종료 시뮬레이션 통과.
- 팬데믹 Socket.IO 5개: 인증/차례/revision, 중복·동시 요청, 비공개 projection, 재접속, 전체 단계 확인, 나가기·다시하기·방장 승계 통과.
- 팬데믹 web 6개: 실제 컴포넌트 렌더링, 지도 접근성, 역할·동의·예측 UI, 이동 비용 미리보기, 비공개 정보 거절, 중복 효과음 방지 통과.
- Chrome 실제 2인 방: 입장/역할 선택/시작 → 워싱턴 이동 → 파랑 큐브 3→2 치료 → 하룻밤의 평온 → 양쪽 진행 확인 → 카드 2장 → 감염 생략 → 동료 차례. 새로고침 복구와 키보드 도시 선택 확인.
- 1440×1000 및 390×844 레이아웃 확인. 390px에서 문서 너비 375px(스크롤바 제외), 지도만 독립 가로 스크롤. 역할·손패 이미지 렌더링 확인. 앱 자체 console error/warn 없음. 소리는 자동 재생 정책에 맞춰 사용자 입력 이후 활성화하며, 실제 스피커 청취 평가는 별도다.

## 실행과 변경 파일

루트에서 `npm run build` 후 `npm start`로 실행한다. 홈에서 **팬데믹** 선택 → 방 생성 → 2–4명 입장 → 출동 준비 → 역할·난이도 설정 → 작전 시작 순서다. 개발은 기존 `npm run dev`를 사용한다.

핵심 파일은 `packages/shared/src/games/pandemic/`, `apps/server/src/games/pandemic/`, `apps/web/src/features/pandemic/`이며, 기존 플랫폼의 게임 등록·전송·재접속 경계에 PANDEMIC 분기만 추가했다. 아트와 생성 출처는 [asset README](../apps/web/public/images/pandemic/README.md)에 기록했다. 확장팩·AI·관전·영구 저장·공개 배포는 후속 범위다.
