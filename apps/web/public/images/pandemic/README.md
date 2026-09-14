# 팬데믹 전용 그림

2026-09-14. Built-in image_gen 도구로 새로 생성. 사용자 첨부 보드의 남색·청록 지도 분위기를 참고했으며 스크린샷의 글자·숫자·도시 UI는 사용하지 않았다.

- `world.webp`: 1536×1024 세계 지도 배경. 클릭 가능한 도시·연결·큐브·말·연구소는 React/SVG 레이어다.
- `atlas.webp`: 1536×1024, 4열×3행 카드 그림. 0–6 역할, 7 관제실, 8 공중 수송, 9 보급, 10 평온한 도시, 11 연구실. CSS background-position으로 표시하며 인물은 텍스트와 별도다. 도시 카드는 관제 지도 그림을 재사용하고 도시명/색상을 별도 표시한다. 48장 개별 도시 삽화를 생성했다고 주장하지 않는다.
- 원본 PNG는 Codex generated_images에 보존. 프로젝트 참조는 이 디렉터리의 WebP만 사용한다. cwebp q88로 형식 변환.

## Atlas 최종 프롬프트

Create an original premium board game art asset atlas, landscape ratio 3:2, 1536x1024 if possible. A seamless dark navy and luminous cyan global disease response command center mood, painterly cinematic realistic illustration, polished tabletop game. NO text, NO letters, NO logos, NO UI, NO borders. Precisely 4 columns by 3 rows equally sized illustration cells, each cell fully filled, separate scenes and no gutters. Top row cells left to right: a female laboratory scientist with glasses and white coat holding a glowing blue vial; a male field medic with orange rescue vest; a female quarantine specialist wearing teal protective gear; a male operations engineer in green jacket with blueprint. Middle row: a female researcher in brown jacket examining microscope; male flight dispatcher in purple uniform with headset; female contingency planner in red jacket surrounded by plans; a cyan holographic world map in a dark blue operations room (for game cover). Bottom row: rescue helicopter flying above night city; medical supply cargo transport aircraft at dawn; calm blue city night with protective medical light; laboratory overlooking city skyline with microscopes and glass medicine vials. Each portrait has face centered upper middle, chest-up, diverse adult people with distinctive silhouettes, serious hopeful expressions. Keep important faces centered within their own cell. Rich blue backgrounds, warm highlights, tactile painted board game art. This atlas is for CSS background-position crops in actual game cards.

## World 최종 프롬프트

Original premium tabletop board game background only. A flat equirectangular world map painted in luminous cyan and rich turquoise against deep midnight navy ocean, landscape 3:2. North America on left, South America lower left, Europe upper center, Africa center lower, Asia right, Australia bottom right. Full entire world with Pacific split at left and right edge, continent outlines accurate and recognizable, no Antarctica. Northern continents within top quarter; leave narrow ocean margins. Subtle printed paper texture, elegant faint latitude-longitude blue grid, restrained cyan rim light along coasts, atmospheric dark blue edges. Reference mood is classic blue global pandemic response board, but a new clean original painting. Flat orthographic rectangular map, NOT globe, no perspective, no 3D. Absolutely NO TEXT, no labels, no city dots, no paths, no symbols, no UI, no counters, no logo, no decorative title. All game interactive elements will be overlaid by software.

## 효과음

Web Audio에서 자체 합성한다. 카드 마찰은 고정 시드 노이즈와 대역 필터, 이동/큐브는 짧은 타격음, 치료는 상승음, 전염병/발병은 낮아지는 경고음, 치료제/승리는 화음이다. 배경은 낮은 관제실 드론이며 기본0%, 효과음40%. 첫 사용자 동작 이후 활성화하고 숨은 탭/단절에서 정지한다.
