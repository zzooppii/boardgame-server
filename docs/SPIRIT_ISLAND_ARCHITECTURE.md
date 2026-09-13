# 정령섬 구현 경계

[규칙과 범위](./SPIRIT_ISLAND_GAME_RULES.md)를 따른다. 기존 Room/Session/UoW/Socket.IO 경계를 유지한다.

- `packages/shared/src/games/spirit-island`: 공개 정령·카드 메타데이터, 지도 연결, strict command와 projection 계약.
- `apps/server/src/games/spirit-island/domain`: framework-independent 상태·전이·효과 처리. 전부 candidate에서 검증 후 commit한다. 선택을 요구하는 효과를 직렬화 가능한 대기 상태로 보존한다.
- `application`: 인증된 actor, 현재 세션, 방 직렬화, request receipt와 원자 commit. 타이머 없음.
- `compatibility`: 저장 상태 검증 및 명시적 allowlist projection. 미공개 카드 후보와 덱 순서는 보호한다.
- `apps/web/src/features/spirit-island`: 실제 지도·기물, 정령/카드 패널, 선택·확정, 협동 안내, 반응형 레이아웃, Web Audio 효과음.
- 새 dependency·서버 설정·배포 변경 없음. 기존 게임에 정령섬 규칙을 섞지 않는다.

검증은 도메인 규칙·위조 입력·실제 Socket.IO 다중 접속·재접속·브라우저 상호작용과 root typecheck/test/build 및 diff 검사를 포함한다. 완료 결과와 실제 제한은 후속 검증 기록에 남긴다.

## 검증 기록 — 2026-09-13

- root `npm run typecheck`, `npm test`, `npm run build` 실행. 전체 회귀 테스트 3,185개 통과(shared 131 / web 688 / server 2,211 / e2e 155). 이후 추가한 1–4인 종료까지의 진행 검증을 포함한 정령섬 도메인 테스트 139개도 별도로 전부 통과했다.
- 정령섬 Socket.IO 테스트: 1–4인 시작, 5인 시작 거부, 같은 방 게임 교체, deadline 없음, 중복·경쟁 요청, request fingerprint, stale revision, 불법 입력의 무변경, 선택 중 재접속, 명시적 나가기 취소와 재시작.
- 브라우저: 실제 방 생성·정령 선택·성장·트랙/현신 배치·카드 비용 확정·빠른 능력 대상 지정·피해 대상 선택·탐험가 제거·새로고침 복원. 390×844 모바일과 데스크톱에서 확인했고 브라우저 error 로그는 없었다.
- `git diff --check` 통과. 빌드는 성공하지만 기존 단일 JS 번들의 500 kB 초과 경고가 남는다(약 1.59 MB, gzip 약 447 kB). 번들 분리는 이번 기능 범위에서 다루지 않았다.

## 화면과 조작

공개 카드와 정령의 기능 설명은 독자적으로 작성한 한국어 설명이다. 전용 생성 일러스트는 [이미지 기록](../apps/web/public/images/spirit-island/README.md)을 참조한다. SVG 기물과 지형 표식, 지형별 색, 위험 표시, 대상 강조를 함께 사용한다. 지도는 공간 배치를 단순화한 디지털 표현이며 인접 연결선과 상세 목록이 이동·사거리 판단 기준이다.

동료 행동으로 game revision이 바뀌어도 내 임시 손패 선택은 유지한다. 카드 준비와 단계 완료는 별도로 확정한다. 피해·이동·현신·획득 후보는 서버가 전달한 가능한 선택 중에서 고른 뒤 확정하며, 늦은 응답은 이전 화면을 덮어쓰지 않는다. 음량은 로컬 저장하고 첫 snapshot과 재접속 때 지난 소리를 재생하지 않는다.

공개 배포와 서버 재시작 후 영구 복원은 포함하지 않았다. 나머지 정령·대적·시나리오·오염 카드·확장은 규칙 문서의 후속 범위다.
