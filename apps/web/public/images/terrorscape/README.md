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
