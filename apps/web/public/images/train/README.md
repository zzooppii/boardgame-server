# TRAIN illustration assets

2026-09-12, OpenAI image_gen, newly generated original illustrations. The user's original Ticket to Ride board/component screenshots informed the physical component types and railway atmosphere; no screenshot was embedded or traced into these images. No publisher logos, card lettering or original decorative frames were requested.

- `journey.jpg`: original brass/dark-green steam locomotive, landscape and railway travel lobby artwork.
- `carriages.jpg`: nine equal cells, 3 columns × 3 rows, ordered RED/ORANGE/YELLOW, GREEN/BLUE/PURPLE, WHITE/BLACK/LOCOMOTIVE. CSS background position selects the complete cell without separate image files.

Prompts: original premium railway board-game illustration, late-19th-century North American railway in detailed gouache/engraving style, parchment/antique brass/forest-green/burgundy/ivory palette. Journey: large locomotive lower right, mountains, sunset, pines and small station, quieter upper-left area for HTML text. Carriages: red boxcar, orange lumber wagon, yellow covered freight, green caboose, blue passenger car, purple sleeper, ivory refrigerated car, black coal hopper, golden locomotive with a subtle rainbow sky; complete side profiles and margins in a 3×3 equal atlas. No words, lettering, logos, watermark or outer frame.

Generation PNGs (1536×1024) are retained outside the repository in the Codex generated_images directory: `exec-fa7da3e0-8fe5-4a4b-b56e-98942370be5c.png` (journey), `exec-188336d2-9583-4a19-bd40-c101768eddb3.png` (carriages). Delivery JPEGs were converted with macOS sips, quality 85/90 respectively. Both originals were visually inspected; actual market/hand card crops were checked in browser. Geography, routes, destination cards and plastic-like train pieces are implemented as SVG/CSS separately.

Sound effects are synthesized by `src/features/train/sound.ts` through Web Audio; there are no downloaded audio assets or additional audio dependencies.

## Korea journey — 2026-09-14

`korea-journey.png` is a newly generated original 1536×1024 OpenAI image_gen illustration for the custom Korea map. It was visually inspected and used in map selection and the lobby. Geography and playable routes remain separate SVG/data assets.

Prompt: “Use case: illustration-story. Asset type: landscape illustration for a Korean railway board game map selection card in a cream parchment, brass and forest-green UI. Primary request: an original inviting hand-painted Korean rail journey landscape: a sleek white and deep teal high-speed passenger train rounds a sweeping track beside layered Korean mountains, a river, a modest traditional tiled-roof pavilion and a distant modern city in warm morning light. Rich illustrated board game art, beautifully coherent perspective, painterly print texture, restrained jade green and warm ochre, no photorealism. Wide landscape composition readable as a small thumbnail, train occupies middle lower third, scenic background. No words, lettering, logos, brands, frame, UI or watermark. Do not reproduce any existing board game cover. Save generated image for use in workspace.”

## Japan journey — 2026-09-14

`japan-journey.jpg`: original illustration generated with the built-in image_gen tool, visually inspected, converted from its original 1536×1024 PNG to JPEG (quality 86) for the Japan map picker/lobby. Source retained in Codex generated_images as `exec-0d6b985f-c71b-4c85-9f9b-37c7e67beb36.png`.

Prompt: “Use case: illustration-story. Asset type: landscape lobby and map selection illustration for an original Japan railway board game. Primary request: an inviting hand-painted Japanese railway journey, a cream and indigo passenger train rounding a curve past spring cherry blossoms, a river bridge and distant Mount Fuji, a small traditional station nestled in green hills. Premium illustrated board game gouache print texture, warm parchment sunlight, jade green, muted indigo and soft cherry pink; detailed coherent train and tracks. Wide landscape composition readable as a thumbnail, calm scenic upper half. No text, lettering, logos, brands, UI, watermark or frame. Original art, do not reproduce an existing game cover. Save for use in project.”
