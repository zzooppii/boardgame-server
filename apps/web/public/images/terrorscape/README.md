# Terrorscape development artwork

Created with the built-in image generation tool on 2026-09-13 for this implementation. These are original illustrations, not scans of published game components. Original PNGs were retained in the local generation directory; WebP copies at quality 86 are served by the application. No external runtime image requests.

- `manor.webp`: cinematic Victorian mansion at midnight, teal moonlight, bare trees and fog, amber entrance; quiet dark left space. Source `exec-f97dffc0-24c2-4ba0-b1a2-3d73e01b3d95.png`.
- `portraits.webp`: 2×2 original portraits: auburn-haired survivor, athletic survivor, mature doctor, masked butcher; teal rim light / candlelight. Source `exec-0ebf75f1-270a-4f40-8f44-c68dac27bdaa.png`.
- `rooms.webp`: 4×4 original room atlas: main hall, gallery, hallway, den, library, living room/radio, dining room, kitchen, storage, banquet hall, trail, graveyard, shed, greenhouse, garden, gate. Source `exec-3fb3fffa-e36a-4616-8bf0-8c71e7130540.png`.
- `items.webp`: 4×4 original inventory atlas: key, toolbox, whiskey, hatchet, herbs, powder, ammo, adrenaline, tranquilizer, revolver, firecracker, amulet, dagger, map, flashlight, sword. Source `exec-e739f1e4-fc51-476f-b9f3-5cdcf35c36ce.png`.

Music and interaction sounds are an original procedural Web Audio composition in `apps/web/src/features/terrorscape/sound.ts`; no downloaded recordings, audio dependencies or licensed soundtrack samples are used. The score uses detuned low tones, filtered noise and a sparse minor-note motif. Music and effects have separate user controls, persist locally, and pause while hidden.

- `skills.webp`: 3×3 original atlas: pursuit footprints, barricaded door, listening masked figure, chainsaw, fractured mirror, locked doors, raging silhouette, spring trap, doctor's medical bag. Source `exec-cb532418-e841-41b7-a423-98305aa95aa7.png`. Generated with the same teal-shadow / candlelight palette, no original component scans.

## 기본판 추가 자산 (2026-09-13)

- `base-cast.webp`: 내장 image_gen으로 생성한 소피아/존슨/망령/학살자 2×2 초상화. 원본과 최종 프롬프트는 `docs/assets/terrorscape/README.md` 및 `base-cast-draft.png`에 보존. 현재 게임 인물 선택 및 지도에 사용한다.
- `base-skills.webp`: 내장 image_gen으로 생성한 4×3 원본 일러스트 atlas. 망령 5종, 학살자 5종, 카메라와 부적. WebP 변환만 수행했다.

최종 생성 프롬프트:

> Create an original painted gothic horror board-game card illustration atlas, square canvas exactly 4 columns by 3 rows of twelve equal square panels edge-to-edge. No text, no borders, no labels. Dark teal, black, blue mist with dim copper candle accents, legible silhouettes and richly detailed painterly realism. Row1 left to right: a spectral screaming face in swirling blue fog; a ghost racing through an old mansion corridor leaving icy wake; fear footprints glowing violet through darkness; an apparition dissolving into midnight mist. Row2: pale ghost draining blue wisps of life from an empty candlelit room, no gore; a detective's deduction desk with connected room sketches and magnifying glass, no letters; a sinister sealed threatening envelope pinned to a door with a knife, no lettering; a hooded masked stalker silhouette seen at end of hallway. Row3: a hooded killer lurking behind a partly opened door; supernatural dark crimson flower made of shadows and sharp petals blooming in moonlight, no gore; vintage camera resting on burgundy fabric; ancient protective bronze amulet glowing against a dark background. Each scene fills its own square cell; no objects crossing cell boundaries. Entirely original designs, not copied from published game art.

## 저택 평면도 일러스트 (2026-09-13)

`manor-floorplan.webp`는 내장 `image_gen`의 스케치 기반 생성/편집 모드로 제작한 연속 평면도 일러스트다. 입력은 코드의 방 좌표로 그린 `docs/assets/terrorscape/manor-art-layout.png`와 기존 `rooms.webp`의 화풍이며, 제품 사진은 배경 자산으로 사용하지 않았다. 청록색 달빛, 촛불, 낡은 가구와 바닥 질감을 사용한다. 최종 PNG는 생성 디렉터리에 보존하고 WebP 품질90으로 형식 변환만 했다. 실제 이동 경계와 문, 말, 선택 표시는 SVG가 담당한다.

최종 원본: `exec-44ea9aa6-c570-4f70-9e90-a7b2caa11bec.png`. 초안: `exec-034d25ad-f69a-49ef-b538-3ef1abd839a2.png`, 후속 편집: `exec-f6ca9351-169d-467a-967c-1b6fd5ad564a.png`, `exec-0355369c-b59b-4490-86e5-4076ea156d07.png`.

생성 프롬프트의 구성: strict overhead orthographic roofless manor; preserve the layout reference's exact polygon footprints and framing; fifteen connected rooms and grounds; no text, UI, figures or door icons; original richly detailed painted gothic horror, eerie teal moonlight, warm candlelight and worn materials matching `rooms.webp`.

최종 편집 프롬프트:

> Edit FIRST image with surgical layout corrections using SECOND reference as exact floor-plan truth. Preserve beautiful existing detailed gothic haunted art, all framing and unchanged rooms. CRITICAL fix 1: central corridor is an upside-down L shape per second reference: its upper horizontal arm extends fully from x=350 to690 at y=280..420 (coordinates in schematic before 35 border offset). In first image there is an erroneous small office with desk in the upper-right part of corridor, approximately pixel x650..837 y367..517 in 1493x1054 first image. REMOVE that desk/office and REMOVE vertical partition at x650 and its adjoining bottom wall; continue the corridor's SAME checker floor horizontally rightward all the way to ballroom wall. Keep the corridor outer bottom boundary at y~527. This entire upper horizontal arm must connect openly to diagonal corridor below-left, no new walls. Retain study immediately BELOW this arm, and library below study. CRITICAL fix 2: garden G5 is the entire right-side area above tool shed, approximately x1190..1455 y290..703 in first image. It must be an OUTDOOR overgrown garden, NOT a parquet indoor salon. Remove indoor parquet, curtains and roofed-room furnishings there, replace with cobblestone trail, moss, moonlit plants and a small fountain. Preserve its exact outer footprint. The lower right area G3 should remain outdoor courtyard and tool shed. Keep all other room footprints exactly unchanged. No extra rooms, partitions, text or symbols. Maintain same framing, same dimensions, rich eerie teal shadows and warm candles. Strict top-down board map.

칸막이 정렬을 바로잡기 위해 평면도를 첫 번째 입력으로 다시 지정한 최종 생성 프롬프트:

> Paint the FIRST reference layout into a finished original haunted manor board illustration. SECOND image is an art-style reference ONLY: do NOT copy its incorrect room partitions. Exact first-reference floor geometry takes priority. Trace EVERY cream boundary from first reference precisely; add ZERO additional partitions. In particular the red hallway shape is ONE OPEN continuous bent room, including its entire wide horizontal rectangular upper arm labeled hallway. Fill ALL of that hallway polygon with a continuous checkerboard floor; NO desk, NO small office, NO vertical wall subdividing its upper arm. Dining room and banquet room stay separate, with exactly the wall shown in first reference. The study workshop lies ONLY in polygon below hallway and above narrow library. Every first-reference polygon must be one room only. Green garden fountain at right must be outdoors. Beautiful intricate weathered furnishings inside other labeled rooms, lush spooky vegetation outdoors, strictly overhead roofless top-down view, dark teal moonlight and amber candles matching the second image's painted realism. Preserve exact first-reference aspect ratio and edge framing and boundary alignment. Remove all labels/text, no tokens or UI. All color regions become painted floors and grounds, never leave flat schematic fills. Do not move any boundary or create any extra room. This is a precise sketch-to-render task, not a redesign.

최종 국소 수정 프롬프트:

> Make ONLY two architectural corrections to this exact image, preserving every other pixel's content and same framing/art style. 1. Find the tiny square room with a writing desk directly LEFT of the grand piano and directly ABOVE the library/study room. It is in the very CENTER of the image. DEMOLISH its LEFT vertical wall. Remove ALL furniture inside that tiny square desk room. Replace its floor with the exact same black-and-white diamond checker tiles as the diagonal corridor immediately to its left. These two spaces now form ONE OPEN continuous corridor, with no wall or partition between them. Keep the tiny room's TOP and BOTTOM walls; only its LEFT wall disappears. The entire tiny square becomes empty checker tile corridor. 2. Restore the vertical wall along the LEFT edge of the piano ballroom: extend the existing vertical stone wall on the left of the piano UPWARD until it meets the bottom wall of the kitchen above. It must separate the dining room on the left from the ballroom on the right, crossing the horizontal red rug and checker floor currently joining them. Change nothing else, no new rooms, no new walls anywhere else, no new furniture. Preserve all outdoor gardens, kitchen, storage, living room, art gallery, main hall, study and library exactly. No text, no labels.

## Feral Instincts 자산 (2026-09-14)

- `feral-atlas.webp`: 원본 공포 일러스트 4×4 atlas. 행 순서대로 늑대인간 / 사냥꾼 / 은 단검 / 은 탄환, Howl / Savage Bite / Blood Hunt / Territorial Awareness, Hyper-hearing / Hunting Instinct / Axe Throw / Bated Breath, Tracking / Traps Reset / 여행 가방 / 보물 상자. 내장 image_gen으로 기존 인물 화풍을 참고해 생성했다. 원본 `exec-6d5e7329-ee98-43a7-8d70-69aaff9b6e16.png`.
- `cabin-floorplan.webp`: 침엽수 숲·호숫가·캠프와 지붕 없는 오두막의 연속 평면도. 코드로 그린 좌표 가이드와 기존 저택 화풍을 참고해 내장 image_gen으로 생성/편집했다. 최종 원본 `exec-e47530a1-bafd-4cc1-822e-04125bf3d808.png`, 1586×992, WebP 품질88로 형식 변환. 생성 결과의 벽에 `cabin-layout.ts`의 표시 좌표를 맞췄고, 규칙상 연결은 공유 지도 그래프로 별도 검증한다. 원본 제품 지도나 카드 스캔을 배포하지 않는다.

원본 PNG는 로컬 생성 디렉터리에 보존한다. 생성 프롬프트 구성:

> Original painted gothic horror atlas, exact four by four equal square cells, no text or borders. Werewolf and huntress portraits, silver weapons and ten hunting skill scenes, suitcase and treasure chest. Dark teal moonlight, copper candle highlights, readable silhouettes and worn materials consistent with existing character artwork. No published component scans.

> Strict orthographic top-down roofless forest cabin board, preserve the coordinate guide's relative rooms and outdoor paths. Detailed dark pine woods, misty lakeside, candlelit rooms and campfires. Continuous painted gothic horror illustration matching the existing manor palette. No labels, characters, tokens, UI or door symbols. Keep game room, two bedrooms, conference room, reception, separate lakeview house and northern cabin; preserve the same framing when editing.

늑대 울음·금속 함정 효과음은 `sound.ts`에서 합성하며 외부 녹음 파일을 사용하지 않는다.
