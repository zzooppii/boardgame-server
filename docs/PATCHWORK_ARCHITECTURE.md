# 패치워크 구현 경계

2026-09-15. [규칙](./PATCHWORK_GAME_RULES.md)의 기본판 2인 친선전.

- `shared/games/patchwork`: 공개 구성품 데이터, 좌표 회전/반사·배치·점수·결과 미리보기의 순수 함수, 엄격한 DTO. 서버 저장 entity는 노출하지 않는다.
- `server/games/patchwork/domain`: 타일 38개 보존, 구매 가능한 순서, 비용, 실제 이동, 수입, 가죽 대기열, 연속 차례, 7×7, 종료·동률. 보드 전체나 클라이언트 점수는 받지 않는다.
- `patchwork:act`: BUY / ADVANCE / PLACE_LEATHER. `requestId`, `gameId`, `expectedGameRevision`, `turnId`와 현재 socket binding의 actor 검증. 방 단위 직렬화 → candidate 검증 → UoW 한 번 commit. 실패 시 state와 revision은 그대로. 중복 요청 영수증은 재사용한다.
- `compatibility`: 정확한 PATCHWORK Room union, adapter, 참가자 전용 projection, lifecycle, 재시작. 게임은 `activeTurn:null`이며 자동 timeout 행동이 없다.
- `web/features/patchwork`: 천 조각 선택·회전·반사·고정 미리보기, 클릭/탭/드래그/방향키, 확대, 구매와 전진 결과 미리보기. 불명확한 응답은 같은 requestId로 확인. 새 revision에서는 낡은 로컬 배치를 폐기한다.
- 그림: 자체 SVG 직물 무늬·단추·바느질선, 분홍/청록 퀼트, 나선 시간판, 자체 표지. 사용자 스크린샷은 배치/분위기 참고이며 원본 이미지·로고를 제품 asset으로 복사하지 않았다.
- 소리: Web Audio의 천 마찰·회전·반사·배치·단추 수입·가죽·보너스·승리. 최초 사용자 제스처 뒤 활성화, 음량·음소거 저장, 초기 snapshot/재접속/중복 revision은 완료음을 재생하지 않는다. reduced-motion을 따른다.
- 기존 방/세션/직렬화/registry 경계를 재사용한다. 새 dependency와 범용 엔진 리팩터링은 없다.

## 검증

전체 카탈로그와 8방향, 원자적 실패, 시장 회전, 시간·수입 경계, 가죽 대기 복구, 7×7, 마지막 칸 및 동률, seeded 완주를 순수 domain에서 확인한다. 실제 Socket.IO는 인증·capability·동시/중복/stale 요청·재접속·명시적 퇴장·재시작·게임 교체를 확인한다. 화면은 SSR과 실제 브라우저의 데스크톱/모바일 조작을 확인한다.

### 수동 화면 검증 (2026-09-15)

- 별도 브라우저 저장소의 두 참가자로 방 생성·입장·시작, 회전·반사·위치 지정·확정 후 상대 보드와 시간·단추의 동기화를 확인했다.
- 새로고침 재접속으로 확정한 배치가 복구되는 것을 확인했다.
- 390px 및 320px 프레임에서 반응형 화면을 검사했다. 320px 프레임의 실제 콘텐츠 폭 305px에서 `scrollWidth === clientWidth`를 확인했다.
- 모바일 조작부를 내 보드 바로 아래에 배치하고, 효과음 설정창의 화면 밖 잘림을 수정했다. 보드 밖 배치의 확정 차단, 방향키로 한 칸 이동, 같은 시간 칸에서 연속 차례를 확인했다.
- 효과음 설정의 사용자 제스처 활성화·단추 소리 재생을 호출했으며 브라우저 오류가 없었다. 음색에 대한 실제 청취 평가는 자동 검증에 포함하지 않았다.
- 표지 SVG와 실제 배치된 조각의 회전·반사된 무늬를 시각적으로 확인했다. 데스크톱에서 구매 카드 → 보드의 실제 드래그·드롭과 확정 후 수입 반영도 확인했다.

### 최종 자동 검증 결과

- 루트 `npm run typecheck`: 통과.
- 루트 `npm test`: 통과. shared 133, web 868, server 3,730, Space Crew E2E 155개, 실패·skip 0개.
- 루트 `npm run build`: 통과. 기존 웹 공통 번들의 500kB 초과 경고는 남는다 (최종 메인 JS 약 2.27MB, gzip 약 638kB).
- 신규 패치워크 검증: domain 25개 (16개 seeded 완주 포함), 실제 Socket.IO 3개, web 3개. 공통 게임 선택/퇴장 검증에도 패치워크의 정확한 2인 인원을 반영했다.
- 문서 로컬 링크 및 `git diff --check`: 통과. 공개 배포는 수행하지 않았다.
