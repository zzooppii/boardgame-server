# 전용 카드 일러스트

내장 `image_gen`으로 생성한 오리지널 그림을 카드 ID에 연결한다. 공용 카드 데이터와 규칙은 변경하지 않는다.

기업 전용 그림의 제작 기록은 [기업 일러스트](TERRAFORMING_MARS_CORPORATION_ART.md)를 참고한다.

## 1차 제작

| 카드 | 위치 | 장면 |
| --- | --- | --- |
| Fish | 왼쪽 위 | 화성 수중 서식지의 물고기 |
| Psychrophiles | 오른쪽 위 | 얼음 결정 사이의 미생물 |
| OlympusConference | 왼쪽 아래 | 화성 연구 돔의 과학 회의 |
| SecurityFleet | 오른쪽 아래 | 화성 궤도 함대 |

제품 파일: `apps/web/public/images/mars/featured-cards-v1.webp`. 1536×1024, 2×2 패널, WebP 품질 82, 280,420바이트. 카드·상세 패널에서 같은 패널을 사용한다. 전용 그림이 없는 카드는 기존 12장면 atlas를 유지한다. 모든 카드의 고유 일러스트 제작이 완료된 것은 아니다.

원본: `/Users/harvey/.codex/generated_images/01a0a594-5bf8-7761-b7a3-5ec9c70fca42/exec-ae2034e1-7094-487b-9949-1cd9088a4dc6.png`. 내장 도구 출력은 보존하고 `cwebp -q 82`로 제품 파일을 새로 저장했다.

## 최종 생성 프롬프트

Use case: stylized-concept. Asset type: one production sprite atlas for a web board game about terraforming Mars. Generate an original landscape 1536x1024 illustration atlas with exactly 2 columns and 2 rows of equal rectangular panels, meeting precisely at the middle, no gaps, no borders, no text, no logos, no symbols or numbers. Four independent painterly science-fiction card scenes with strong silhouettes readable at thumbnail size, cohesive warm rust Mars accents and cinematic natural lighting. TOP LEFT: silver fish swimming in a deep teal transparent aquatic habitat on Mars, fish dominant foreground, faint habitat architecture behind. TOP RIGHT: cold-loving microbes, translucent turquoise organisms and branching ice crystals under a scientific macro view, icy blue and mint palette, no fish. BOTTOM LEFT: an Olympus scientific conference inside a Mars research dome, small scientists gathered around a luminous physical planetary model at a circular table, ochre and violet lighting, no text displays. BOTTOM RIGHT: a peaceful security fleet of three distinct compact spacecraft in formation above a rust-red Mars horizon, deep indigo space and copper light, no battle, no explosions. Each scene fills its own quadrant edge to edge and keeps its focal subject within the central 70 percent of its quadrant. Original art, no reproduction of existing board-game card artwork. No typography anywhere.


## 검증

네 장면의 구분과 경계를 생성 결과에서 확인했다. Chrome에서는 전용 WebP 로딩·1536px 원본 크기·호냉성 미생물 패널 위치·카드와 상세 그림 일치를 검사했고 320px 카드 캡처를 직접 검토했다. 격리 복사본에서 루트 타입 검사·빌드·테스트 통과. 공유 145개·웹 1,018개·서버 4,212개·공통 E2E 155개, 총 5,530개에서 실패·취소·미실행 0개다. 기존 공통 번들 500 kB 경고는 유지된다.

## 생태 카드 전용 일러스트 2차

| 카드 | 위치 | 장면 |
| --- | --- | --- |
| Tardigrades · 완보동물 | 왼쪽 위 | 이끼와 광물 위의 황금빛 완보동물 확대 장면 |
| Birds · 새 | 오른쪽 위 | 화성 수목원 돔의 새 두 마리 |
| SmallAnimals · 소형 동물 | 왼쪽 아래 | 고사리 사이에 머무는 토끼 두 마리 |
| Livestock · 가축 | 오른쪽 아래 | 농업 돔 안에서 풀을 뜯는 소 |

내장 `image_gen`으로 만든 오리지널 그림이다. 제품 파일: `apps/web/public/images/mars/ecology-cards-v1.webp`. 1536×1024, 2×2 패널, WebP 품질 82, 372,668바이트. 기존 atlas를 유지하고 별도 파일을 추가했다. 전용 그림은 총 8장이다. 카드 그림·간단 목록·상세 패널 모두 같은 카드 ID 매핑을 사용하며 규칙·태그·자원은 변경하지 않는다.

원본: `/Users/harvey/.codex/generated_images/01a0a594-5bf8-7761-b7a3-5ec9c70fca42/exec-1f8ffbaa-888d-4899-b62f-6486a43fb29c.png`. 원본을 보존하고 `cwebp -q 82`로 변환했다. 축소 화면에서 완보동물·새·토끼·소의 형태가 구분되도록 중심 피사체를 크게 구성했다.

### 최종 생성 프롬프트

Use case: stylized-concept. Asset type: one production sprite atlas for a web board game about terraforming Mars. Create an original 1536x1024 landscape illustration atlas, precisely 2 columns and 2 rows of equal 3:2 rectangular panels, touching at the exact center, with no gutters, borders, lettering, numbers, logos or UI. Four independent painterly science-fiction ecology scenes with clear dominant subjects readable at 72px thumbnail scale, restrained detail, cinematic natural light and warm rust Mars accents. TOP LEFT: one large translucent amber tardigrade seen in scientific macro view walking on a mossy mineral surface, eight short legs and rounded segmented body, ochre and emerald palette. TOP RIGHT: two clearly recognizable songbirds, one perched on a branch and one flying inside a bright green Martian arboretum dome, airy blue sky through glass, no other animals. BOTTOM LEFT: two small rabbits sheltering beside ferns in a green Martian habitat, rounded rabbit silhouettes with long ears, earthy jade and cream palette. BOTTOM RIGHT: a small herd of cattle grazing on golden grass within a broad agricultural habitat on Mars, one prominent brown and white cow in foreground and faint dome ribs and red hills behind, warm sunset lighting. Each scene fills its quadrant edge to edge. Keep focal subjects in the central 70 percent of each quadrant, strong separation from backgrounds. These are original game illustrations, not reproductions of existing board game artwork. No typography anywhere.


### 2차 검증

네 카드의 각 패널 매핑·카드/목록 렌더링·WebP 형식과 600 kB 미만 용량을 단위 검사했다. Chrome에서 새 파일의 1536×1024 로딩, 가축 카드·목록·상세의 동일 그림, 서버 revision 불변과 기존 재접속·효과음 회귀를 확인했다. 320px 카드 및 72px 목록 그림 캡처를 직접 검토했다. 최신 마스 변경을 반영한 격리 복사본의 루트 타입 검사·빌드·테스트 통과. 공유 145개·웹 1,022개·서버 4,212개·공통 E2E 155개, 총 5,534개에서 실패·취소·미실행 0개다. 기존 공통 번들 500 kB 경고와 실제 기기·청음 검수는 남아 있다.
