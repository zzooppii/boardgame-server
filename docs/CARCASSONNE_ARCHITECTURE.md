# 카르카손 구현 경계

[규칙과 온라인 정책](./CARCASSONNE_GAME_RULES.md)을 기존 Room/Session/직렬화/UoW 플랫폼에 연결한다.

- Shared: 공개 타일 카탈로그, 90도 회전·연결 그래프·배치 가능성, strict action/projection DTO. 서버 내부 덱·저장 state는 노출하지 않는다.
- Domain: 타일 72장 보존, 미플 7개 보존, feature 연결·완성·최다 점유·농부의 도시 중복 제거·최종 정산. 입력 state를 수정하지 않고 candidate를 반환한다. 시간·난수·ID는 주입한다.
- Application: actor/current-primary/room/game/turn/revision/deadline 검증, 방 직렬화, idempotency와 전체 candidate 단일 commit. timeout은 같은 lane과 기존 scheduler/overdue recovery를 사용한다.
- Projection: 보드와 현재 타일 및 점수는 공개한다. 덱은 count만 전송한다. 카드형 게임과 달리 이번 타일은 공동 정보다.
- Web: 독립 React 화면. 지도 pan/zoom/전체 보기, 합법 위치, 90도 회전, 영역별 미플 선택, 공개 feature 강조, 확정 전 preview, 결과 내역, 재접속과 응답 유실 재확인. 룰 엔진은 컴포넌트 밖에 둔다.
- Art: 자체 생성 성곽·전원 일러스트를 홈/대기실에 사용한다. 실제 타일은 카탈로그와 같은 region 정의에서 자체 SVG 지형·성벽·도로·미플을 그린다.
- Sound: Web Audio의 목재 타격·현·종 계열 자체 합성음, 선택/회전/미플/서버 배치/정산/내 차례/종료/마감 구분. 음소거·볼륨, reduced motion, 터치/키보드 지원.

## 주요 파일

- [공개 카탈로그](../packages/shared/src/games/carcassonne/catalog.ts), [연결 그래프](../packages/shared/src/games/carcassonne/geometry.ts), [공개 계약](../packages/shared/src/games/carcassonne/contracts.ts)
- [서버 규칙 엔진](../apps/server/src/games/carcassonne/domain/game.ts), [명령·타이머 처리](../apps/server/src/games/carcassonne/application/service.ts)
- [플레이 화면](../apps/web/src/features/carcassonne/CarcassonneScreen.tsx), [지도](../apps/web/src/features/carcassonne/CarcassonneBoard.tsx), [아트·사운드 제작 기록](../image/carcassonne/README.md)

## 연결 표현

도시·도로의 포트는 북/동/남/서 = 0/1/2/3이다. 들판은 각 변을 둘로 나눈 8개 포트를 사용한다. 북서쪽 북변부터 시계 방향으로 0–7이며 반대편 연결은 좌우가 뒤집힌다. 회전 시 도시·도로는 1포트, 들판은 2포트씩 이동한다. 도시는 같은 타일의 분리된 영역이 바깥에서 다시 연결될 수 있으므로 영역 노드 수와 고유 타일 수를 구분한다.

## 검증 — 2026-09-11

- root `npm run typecheck`: 통과.
- root `npm test`: **2,482개 통과**, 실패·skip 없음(shared 126, web 629, server 1,727).
- root `npm run build`: 통과. 기존 통합 JS 번들의 500 kB 초과 경고는 남아 있다(현재 1,271.54 kB, gzip 359.34 kB). 게임 외 번들 구조 개편은 하지 않았다.
- `git diff --check`: 통과. 새 dependency 및 lockfile 변경 없음.
- 카르카손 도메인 14개: 공식 수량·회전·모든 접면, 도시 연결/분리·동률·방패·동일 타일 중복 방지, 도로 고리·교차로, 들판 분리·도시 중복 제거, 수도원 8방향, 배치 전 점유 검사, 원자성·보존·프라이버시, 배치 불가 재추첨, 시간 초과, 2–5인 각각 3개 seed의 완주.
- 실제 Socket.IO 9개: 2–5인 시작과 정원, 위조/오래된 명령, 공개 projection 일치, 재전송과 경쟁, 새 primary로 재접속, 서버 마감, 자동 턴, 완주·방장 승계·재시작·나가기 취소.
- Web 5개: 화면/DTO/미리보기/점유/볼륨 및 sound cue 중복 방지. 소리가 지원되지 않는 환경에서도 게임은 유지된다.
- 실제 브라우저: 데스크톱 1365×900, 모바일 390×844 및 320×740 확인. 모바일 가로 넘침 없음, 미플 목록 터치 높이 44px. 타일 회전→위치→미플→확정, 영역 강조, 지도 전체 보기·확대, 음소거 저장과 새로고침 복원을 확인했다.
- 별도 로컬 서버에서 브라우저 1명과 임시 Socket.IO 플레이어 4명으로 72장 게임을 완료했다. 결과 33/14/16/23/25점과 상세 정산 및 새로고침 후 72장 복원 확인. 브라우저 console error/warn 없음. 임시 플레이어는 테스트 도구이며 제품의 AI 상대 기능이 아니다.

공개 배포는 진행하지 않았다. 강·수도원장·기타 확장과 제한 시간 선택 등 후속 범위는 [규칙 문서](./CARCASSONNE_GAME_RULES.md)의 `TO_BE_CONFIRMED`에 남긴다.

## 최종 정산 상세와 완성 연출 — 2026-09-16

- 결과의 도로·도시·수도원·들판 항목을 누르면 서버 `finalScoring`의 개별 영역과 계산 근거를 보여 준다. 진행 중 획득 점수는 별도 합계로 표시한다. 동률은 각 플레이어에게 전체 점수를 표시하며 0점 들판도 근거를 확인할 수 있다.
- 선택한 영역만 금색으로 강조하고, 들판에 포함되는 서로 다른 완성 도시는 청록색으로 함께 표시한다. 해당 영역과 도시가 들어오도록 지도를 맞추며 여러 정산 영역을 전환할 수 있다. 공개 연결 그래프는 표시 위치를 찾는 데만 사용하고 점수는 서버 결과를 따른다.
- 서버가 확정한 완성 영역의 빛 효과, 회수 미플의 떠오르는 효과, 플레이어별 증가 점수·미플 회수 개수를 3.2초 동안 표시한다. 배치·득점·회수·종료 합성음을 순서대로 연결한다. 놓자마자 회수되는 미플과 마지막 타일의 완성도 포함한다.
- 동일 게임의 연속된 revision에만 연출을 적용한다. 첫 진입·재접속·중복 snapshot·revision 누락·취소에는 지난 연출을 재생하지 않는다. reduced motion에서는 움직임을 제거하고 안내 문구를 유지한다.
- 주요 파일: [정산 표시 계산](../apps/web/src/features/carcassonne/scoring.ts), [상세 패널](../apps/web/src/features/carcassonne/ScoreDetails.tsx), [연출 수명 관리](../apps/web/src/features/carcassonne/use-celebration.ts), [표시 회귀 테스트](../apps/web/src/lib/carcassonne-scoring.test.ts).
- 카르카손 웹 테스트 10개 통과: 정확한 영역·완성 도시 강조, 동률, 미완성 방패·수도원·0점 들판, 즉시 회수, 동시 완성, 마지막 턴, 중복 연출 방지와 사운드 순서를 포함한다.
- 브라우저와 임시 Socket.IO 플레이어로 5인 72장 완주. 50/54/42/64/48점 결과에서 영역 전환, 들판 3개 도시 × 3점과 공동 최다 점유, 데스크톱·390×844 모바일 화면, 가로 넘침 없음, 새로고침 후 72장 복원과 연출 미재생을 확인했다. console error/warn 없음.
- root `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` 통과. 전체 테스트 5,212개(shared 140, web 959, server 3,958, 연동 155), 실패·skip 없음. 통합 JS 번들의 기존 500 kB 초과 경고는 남아 있다(2,478.67 kB, gzip 698.51 kB). 서버 계약·게임 규칙·dependency 변경 없음.

## 선택 확장 — 여관과 성당 / 상인과 건축가

- `carcassonne:configure`는 게임 명령과 구분되는 room revision 명령이다. 방장·현재 연결·LOBBY·revision을 검사하고 방 직렬화/UoW/idempotency 안에서 설정을 저장한다. 대기실과 플레이 projection에 설정을 공개하고 시작할 때 state로 복사한다. 게임 시작 후 설정 변경은 거부한다.
- 선택된 카탈로그에 따라 72/90/96/114장을 생성한다. 공식 Big Box B1/B2의 EA–EQ, HA–HX를 별도 식별자로 관리한다. 여관·성당·상품은 타일 전체가 아니라 해당 도로·도시 region에 귀속한다. 타일별 도시 분리·다리·들판 경계는 같은 region 그래프와 SVG에서 표현한다.
- 말의 `piece`는 NORMAL/BIG/BUILDER/PIG이며 기존 payload의 생략은 NORMAL이다. 일반 7개와 활성화된 특수 말 각 1개의 보존을 별도로 검증한다. 건축가와 돼지는 자기 일반/큰 미플이 있는 알맞은 영역에만 배치하며 점유 수에는 포함하지 않는다.
- 추가 턴 여부는 배치 전부터 있던 건축가가 새 타일과 연결되었는지로 계산한다. 정산·회수 후에도 추가 턴 권리를 유지하지만 추가 턴에서 재발동하지 않는다. 서버는 매 배치마다 revision·turnId·deadline을 갱신하고 timeout도 같은 경로를 사용한다.
- 상품은 새 타일로 완성된 모든 상품 도시에서 배치자에게 지급한다. 점유 없는 도시도 포함하며 과거 완성 도시는 다시 지급하지 않는다. 공개 보드의 완성 도시 상품 수와 전체 보유량도 일치해야 한다.
- 정산 event의 `playerPoints`는 돼지 때문에 공동 최다 점유자끼리 달라지는 점수를 표현한다. 화면과 최종 합계는 이 서버 지급액을 사용한다. 상품 최다 보유 보너스는 결과에서 별도로 보여 준다.
- 대기실에 설명·타일 미리보기·총 장수를 갖춘 확장 선택 카드를 제공한다. 플레이 화면은 일반/큰 미플/건축가/돼지를 별도 모양으로 그리고 보유 말·상품·추가 턴을 표시한다. 여관의 연못, 성당, 상품 문양, 다리와 확장 표식을 자체 SVG로 그린다. 상품·건축가 합성음을 기존 중복 방지 사운드 흐름에 연결한다.
- 기본판 payload 호환을 위해 새 공개 필드는 선택적이며 생략 시 확장 없음으로 해석한다. 실제 서버 신규 state에는 설정과 자원 정보를 명시한다. 온라인 정원은 기존 2–5인으로 유지한다. 강·수도원장·기타 확장은 여전히 후속 범위다.

브라우저 검증에서 두 확장을 함께 켠 5인 게임을 114장까지 완료했다. 최종 점수는 99/53/42/92/86점이며 상품의 공동 최다 10점, 3종 상품 합계 30점, 돼지 들판의 4점 계산 근거와 지도 강조를 확인했다. 최초 진입 기본값 72장 → 여관 90장 → 두 확장 114장, 대기실 새로고침 후 설정 복원, 큰 미플 배치, 건축가 추가 턴, 돼지 배치, 종료 후 새로고침 복원 및 효과 중복 방지, console error/warn 없음을 확인했다.

- 같은 방에서 카르카손을 다시 준비할 때 확장 설정을 유지한다. 114장 완료 → 대기실 → 다시 114장 시작하는 실제 Socket.IO 회귀 테스트로 확인했다.
- root `npm run typecheck`, `npm test`, `npm run build` 통과. 전체 테스트 5,269개(shared 140, web 969, server 4,005, 연동 155), 실패·skip 없음. 이후 재시작 설정 보존 수정과 회귀 테스트를 추가하고 카르카손 서버 34개 전체 및 root build를 다시 통과했다. 카르카손 웹 12개는 전체 테스트에 포함된다.
- 390×844 모바일에서 가로 넘침이 없음을 확인하고 특수 말 선택 영역을 2열로 보정했다. 마지막 CSS 보정 후 모바일 화면의 재촬영은 완료하지 못했다.
- 통합 JS 번들의 기존 500 kB 초과 경고는 남아 있다(2,526.52 kB, gzip 712.48 kB). 새 dependency 및 lockfile 변경 없음. 공개 배포는 진행하지 않았다.
