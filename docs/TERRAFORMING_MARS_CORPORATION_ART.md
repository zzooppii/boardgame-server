# 기업 전용 일러스트 1차

내장 `image_gen`으로 제작한 오리지널 그림을 기업 ID에 연결한다. 이름·태그·효과·시작 자금과 규칙은 변경하지 않는다. 기업 선택·내 기업·공개 기업 상세가 같은 `CorporationArt`를 사용한다. 다른 기업은 기존 atlas를 유지한다.

| 기업 | 패널 | 장면 |
| --- | --- | --- |
| EcoLine · 에코라인 | 왼쪽 위 | 생태 돔 안의 큰 나무 |
| Helion · 헬리온 | 오른쪽 위 | 열 저장 탑과 동심원 설비 |
| MiningGuild · 광업협동조합 | 왼쪽 아래 | 화성 노천 광산의 대형 채굴 장비 |
| TharsisRepublic · 타르시스 공화국 | 오른쪽 아래 | 돔 안의 세 도시 탑 |

제품 파일: `apps/web/public/images/mars/corporations-v1.webp`. 1536×1024, 2×2 패널, 292,392바이트. 썸네일의 3:2 비율을 유지하며 그림은 장식 요소로 처리한다. 기업명·태그·설명은 별도의 읽을 수 있는 텍스트다.

원본: `/Users/harvey/.codex/generated_images/01a0a594-5bf8-7761-b7a3-5ec9c70fca42/exec-c63ee5ab-5d89-4bfe-84f2-2e91817df79f.png`. 원본을 보존했다. 첫 변환은 불필요한 알파 채널로 672,362바이트였고, 불투명 그림 용도에 맞게 `cwebp -q 82 -noalpha`로 최종 파일을 저장했다. 최종 WebP의 색과 패널 경계를 직접 확인했다.

## 최종 생성 프롬프트

Use case: stylized-concept. Asset type: a single production illustration sprite atlas for corporation identities in a terraforming Mars web board game. Original landscape 1536x1024 canvas divided into exactly 2 columns and 2 rows of equal 3:2 panels touching precisely at center, no borders or gaps. Four independent cinematic painterly science fiction scenes with very bold focal silhouettes legible at 60px wide thumbnails. TOP LEFT: EcoLine theme, a large luminous green tree under a transparent ecological dome, green canopy dominant, Mars rust landscape beyond, emerald and cream daylight. TOP RIGHT: Helion theme, a monumental glowing amber heat storage tower with concentric thermal rings on Mars, strong circular silhouette, warm orange and dark navy, clean industrial energy scene. BOTTOM LEFT: Mining Guild theme, a massive angular yellow excavator lifting reddish mineral ore in a stepped Martian open pit, dominant scoop silhouette, copper and slate palette. BOTTOM RIGHT: Tharsis Republic theme, an elegant cluster of three pale civic towers beneath a broad transparent dome on Mars, clear city skyline, soft blue and warm sandstone light. Keep each main subject large and in the central 70 percent of its panel. Different silhouettes and color palettes distinguish the four scenes while remaining cohesive. No text, letters, numbers, emblems, logos, UI, borders or watermarks anywhere. Original artwork, do not recreate published board game card art.

## 검증 범위

단위 검사는 네 기업의 선택·공개 정보 패널 위치, 다른 기업의 기존 그림 유지와 WebP 용량을 확인한다. Chrome의 40장 화면 검증용 상태에서 기업을 에코라인으로 설정해 새 이미지 로딩과 내 기업·공개 기업 정보의 그림 일치를 검사한다. 이 상태는 읽기 전용 UI 검증에만 사용하며 실제 기업 효과를 적용한 대국을 대신하지 않는다.

최종 결과: Chrome 로딩·1536×1024 원본 크기·그림 일치·revision 불변과 기존 기업 선택·재접속·효과음 회귀 통과. 320px 화면의 60px 기업 썸네일을 직접 검토했다. 최신 마스 변경을 반영한 격리 복사본에서 루트 타입 검사·빌드·테스트 통과. 공유 145개·웹 1,024개·서버 4,212개·공통 E2E 155개, 총 5,536개에서 실패·취소·미실행 0개다. 기존 공통 번들 500 kB 경고 및 실제 기기·청음 검수는 남아 있다.
