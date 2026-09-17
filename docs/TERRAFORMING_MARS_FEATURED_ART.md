# 전용 카드 일러스트 1차

내장 `image_gen`으로 생성한 오리지널 그림을 카드 ID에 연결한다. 공용 카드 데이터와 규칙은 변경하지 않는다.

| 카드 | 위치 | 장면 |
| --- | --- | --- |
| Fish | 왼쪽 위 | 화성 수중 서식지의 물고기 |
| Psychrophiles | 오른쪽 위 | 얼음 결정 사이의 미생물 |
| OlympusConference | 왼쪽 아래 | 화성 연구 돔의 과학 회의 |
| SecurityFleet | 오른쪽 아래 | 화성 궤도 함대 |

제품 파일: `apps/web/public/images/mars/featured-cards-v1.webp`. 1536×1024, 2×2 패널, WebP 품질 82, 280,420바이트. 카드·상세 패널에서 같은 패널을 사용한다. 다른 카드는 기존 12장면 atlas를 유지한다. 모든 카드의 고유 일러스트 제작이 완료된 것은 아니다.

원본: `/Users/harvey/.codex/generated_images/01a0a594-5bf8-7761-b7a3-5ec9c70fca42/exec-ae2034e1-7094-487b-9949-1cd9088a4dc6.png`. 내장 도구 출력은 보존하고 `cwebp -q 82`로 제품 파일을 새로 저장했다.

## 최종 생성 프롬프트

Use case: stylized-concept. Asset type: one production sprite atlas for a web board game about terraforming Mars. Generate an original landscape 1536x1024 illustration atlas with exactly 2 columns and 2 rows of equal rectangular panels, meeting precisely at the middle, no gaps, no borders, no text, no logos, no symbols or numbers. Four independent painterly science-fiction card scenes with strong silhouettes readable at thumbnail size, cohesive warm rust Mars accents and cinematic natural lighting. TOP LEFT: silver fish swimming in a deep teal transparent aquatic habitat on Mars, fish dominant foreground, faint habitat architecture behind. TOP RIGHT: cold-loving microbes, translucent turquoise organisms and branching ice crystals under a scientific macro view, icy blue and mint palette, no fish. BOTTOM LEFT: an Olympus scientific conference inside a Mars research dome, small scientists gathered around a luminous physical planetary model at a circular table, ochre and violet lighting, no text displays. BOTTOM RIGHT: a peaceful security fleet of three distinct compact spacecraft in formation above a rust-red Mars horizon, deep indigo space and copper light, no battle, no explosions. Each scene fills its own quadrant edge to edge and keeps its focal subject within the central 70 percent of its quadrant. Original art, no reproduction of existing board-game card artwork. No typography anywhere.


## 검증

네 장면의 구분과 경계를 생성 결과에서 확인했다. Chrome에서는 전용 WebP 로딩·1536px 원본 크기·호냉성 미생물 패널 위치·카드와 상세 그림 일치를 검사했고 320px 카드 캡처를 직접 검토했다. 격리 복사본에서 루트 타입 검사·빌드·테스트 통과. 공유 145개·웹 1,018개·서버 4,212개·공통 E2E 155개, 총 5,530개에서 실패·취소·미실행 0개다. 기존 공통 번들 500 kB 경고는 유지된다.
