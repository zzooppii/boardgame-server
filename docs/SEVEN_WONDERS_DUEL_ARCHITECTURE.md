# 7 Wonders Duel 아키텍처

- `packages/shared/src/games/seven-wonders-duel`: 공개 구성물, 직렬화 DTO, 설정, SELECT 명령.
- `apps/server/src/games/seven-wonders-duel/domain`: 전체 비공개 상태, 시대 배치, 비용, 효과 큐, 승리 판정. 난수·시간·ID를 주입한다.
- application은 방별 직렬화, 인증, 멱등성, room/game revision 및 transition ID를 검사하고 검증된 candidate만 commit한다.
- compatibility projection은 시점별 공개 정보와 viewer 자신의 선택만 내보낸다. 신화 덱, 제거된 비공개 카드, 상대 음모, 숨겨진 법령은 원시 상태로 전송하지 않는다.
- 추가 선택은 서버 task queue에 저장된다. 본행동, 효과의 대상 선택, 카드 공개, 턴 인계를 구분한다. 재접속은 동일 projection과 선택 목록을 복원한다.
- 웹은 테이블 배치, 카드 확대, 선택 확인, 연계 참고표, 이벤트 기반 음향을 담당한다. 프론트가 판정을 수행하지 않는다. 비공개 정보의 사운드나 애니메이션도 공개 이벤트만 사용한다.
- 음향은 사용자 조작 이후 Web Audio로 합성하고 음소거를 제공한다. reduced-motion, 키보드 및 터치 조작을 지원한다.

기존 room/session 수명주기와 server-authoritative 경계는 유지한다. 전용 테이블 및 자산은 게임 선택 후 로드한다.

## 완료 검증 (2026-09-15)

- root `npm run typecheck`: 통과.
- root `npm test`: 공유 133, 웹 877, 서버 3,802, E2E 155 — 총 4,967건 통과.
- root `npm run build`: 통과. 기존 공통 JavaScript 번들의 500 kB 초과 경고는 유지된다. 듀얼 화면은 약 26 kB의 별도 지연 로딩 청크다.
- `git diff --check`, 신규 파일 공백 및 문서 내부 링크 확인: 통과.
- 듀얼 규칙·통신 및 공통 방 테스트 재검증: 143건 통과. 기본판 및 확장 네 조합의 48개 시드 대전, 모든 신·음모의 효과 처리, 비용, 과학 쌍, 군사·원로원, 비공개 정보, 멱등성, 재접속, 취소 및 같은 방 재시작을 포함한다.
- Chrome 두 독립 접속: 방 생성/입장, 불가사의 선택, 카드 확대/확정, 2시대 진입, 판테온 공개, 관문 활성화 및 두 화면에 동일한 신 후보 5장 공개를 확인했다. 관문 활성화 자체는 배치 카드를 소비하지 않았다.
- 1440px 데스크톱 및 390px 모바일 확인. 모바일 문서 너비 390px, 브라우저 JavaScript 오류 없음. 카드 배치는 독립 영역에서 좌우 스크롤한다.
- 일러스트 3개 atlas(총 48개 장면)의 출처와 생성 프롬프트는 `apps/web/public/images/seven-wonders-duel/README.md`에 기록했다.
