# 테러스케이프 구현 경계

[규칙](./TERRORSCAPE_GAME_RULES.md)을 따른다. 기존 Room/Session/UoW/Socket.IO 경계를 유지하는 concrete game module이다.

- `packages/shared/src/games/terrorscape`: 공개 지도 그래프·카드 설명, strict 행동 DTO와 역할별 projection. 비공개 전체 상태는 서버에만 둔다.
- `apps/server/src/games/terrorscape/domain`: deterministic 상태 전이, 카드 보존, 조우·도주·해금·발견 선택 상태. 주사위와 덱은 주입한 RandomSource로만 처리한다.
- `application`: actor/current-primary/단계/담당 캐릭터/시청자 측 revision을 방 mutation lane에서 검증한다. 후보 전체 검증 후 canonical revision을 한 번 증가시켜 commit한다. 실패는 live state 불변. requestId receipt를 사용해 재시도한다.
- `compatibility`: 저장 상태 검증, 명시적 allowlist projection. 양 팀 각각 단조 증가 revision/turnId를 사용해 숨겨진 행동 개수와 선택 단계를 상대에게 전달하지 않는다. 플랫폼 snapshot metadata는 기존처럼 wire snapshot에서 도출한다.
- `apps/web/src/features/terrorscape`: 전용 저택 보드·캐릭터/아이템 카드·지도 대상 선택·확정·협동 완료·도주/방어·음량 UI. 규칙의 최종 판정은 서버다. 모바일은 지도와 행동을 함께 사용할 수 있고 키보드로도 장소·문 선택이 가능하다.
- 자체 생성 일러스트와 Web Audio 기반 원본 공포 앰비언트·효과음을 사용한다. 첫 사용자 조작으로만 오디오 시작. 음악/효과음 별도 음량 및 정지, 화면 이탈 시 정리, 재접속 시 과거 효과 재생 금지. 숨겨진 실제 거리로 음악을 바꾸지 않는다.
- 연결 끊김은 판 유지, 명시적 나가기는 게임 취소. 같은 방 재경기/게임 교체는 기존 정책 사용. 기본적으로 in-memory이며 영구 저장·배포·새 dependency 없음.

검증: domain 효과/경계/보존, 개인별 projection, 실제 Socket.IO 2–4인·중복·동시 입력·위조·재접속·종료, React 화면·모바일/키보드·오디오 수명, root typecheck/test/build 및 diff 검사. 실제 실행 결과는 완료 후 추가한다.

## 화면·사운드 구현

일러스트는 `apps/web/public/images/terrorscape/README.md`에 제작 출처를 기록했다. 저택 1장, 인물 4종, 장소 16칸, 소지품 16칸을 원본 생성한 WebP atlas로 제공한다. 추격·봉쇄·감지·전기톱 등 살인마 카드 7종과 덫/응급키트도 추가 3×3 일러스트 atlas를 사용한다. 방 연결은 SVG, 카드·인물은 HTML/CSS이므로 키보드 포커스와 목적지 select를 함께 제공한다. 전용 `tsc-` 클래스 이름으로 다른 보드게임 스타일과 격리한다.

음악은 낮은 드론/필터 노이즈/단조 음형을 실시간 합성한다. 효과음은 이동·물건·소음·봉쇄·공포·주사위·부상·차례·종료에 대응한다. 오디오 시작은 사용자 제스처로 제한하고 음악 22%, 효과음 40%로 시작한다. 별도 슬라이더와 전체 음소거를 제공하고 숨김 탭에서 suspend, 화면 종료 시 context를 닫는다. 재접속 snapshot의 과거 기록은 다시 재생하지 않는다. 큰 갑작스러운 음량을 억제하는 compressor를 사용한다.

배역 확정 전에는 초기 살인마 손패를 누구에게도 전송하지 않는다. 방장이 배역을 바꾸더라도 이전 담당자에게 카드가 노출되지 않으며, 사냥 시작 후에만 확정된 살인마에게 전달한다.

## 실행 검증 (2026-09-13)

- 루트 `npm run typecheck`, `npm test`, `npm run build` 통과. 전체 테스트 공유 131 / 웹 704 / 서버 2,600 / 종단간 155개 통과. 최신 테러스케이프 전용 서버 테스트 27개(도메인 21 / Socket.IO 6)를 별도 출력 경로에서도 통과했다. 웹 전용 테스트 3개는 전체 웹 테스트에 포함된다.
- 실제 Chrome 두 컨텍스트: 방 생성·참가·배역 확정·생존자 이동/준비/발견·살인마 이동/수색·다음 라운드·새로고침 복구 확인. 390px 모바일의 직접 경로 지정/왕복 경로 확정과 살인마 메모 저장도 확인. JavaScript page error 0, document 가로 넘침 0.
- 음악/효과음 음량·전체 음소거, 사용자 조작 후 AudioContext running, 숨김 이벤트에서 suspended 및 재표시 running 확인. 화면에서 나가기 후 AudioContext가 closed 되는 것도 확인했다. 원본 score는 게임 비공개 상태를 입력받지 않는다.
- 비공개 이동은 살인마 projection·revision·turnId 및 unsolicited fanout을 변경하지 않는다. 요청한 `state:sync`의 응답 이벤트는 숨김 동작 검사의 전송 장벽과 분리했다. 더 오래된 fanout을 의도적으로 지연시킨 뒤 새 상태가 먼저 도착하게 하는 회귀 테스트도 통과했다.
- `git diff --check` 통과. 전체 앱 Vite 번들의 500 kB 초과 경고는 남아 있다(약 1.71 MB minified JavaScript). dependency/lockfile 변경과 공개 배포는 없다. 기존 스피릿 아일랜드의 병행 변경은 이 작업에서 수정하지 않았다.
