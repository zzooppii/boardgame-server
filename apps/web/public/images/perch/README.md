# Perch artwork

Created 2026-09-14 with the built-in OpenAI image generation tool for this implementation. The user's fountain/card screenshots informed composition and board-game readability. No publisher or BGA image is included in these production assets. Bird silhouettes and flock marks are original SVG in `features/perch/art.tsx`. Effects use locally synthesized Web Audio; no remote audio or tracking.

## Final prompt set

Common direction: original warm gouache and fine ink woodland board-game illustration, natural cream/teal/ochre colors, crisp readable silhouettes, no letters, logos, numbers or interface overlays.

- `locations.png`: 1536×1024 atlas, exactly six columns and four rows of equal square panels with no gutters. Row 1: peeling birch trees, great ash tree by a cottage, lonely elm, mighty oak, scented pine, Japanese maple. Row 2: full bird feeder, park bench, beehive, thorn bush, cornfield with scarecrow, fox den. Row 3: hawk nest, owl barn, country cottage, doghouse, stone bird statue, swaying power lines. Row 4: early bird on garden wall, happy birdbath, overstuffed birdhouse, precariously hanging nest, rookery, high perch. Every panel is a distinct scene, bounded by the precise grid. Final output: `exec-e3f248c8-5761-4a85-9b98-c39ea99dcd8a.png`.
- `fountain.png`: square front elevation of a five-tier antique stone fountain in a woodland garden. Teal water, warm dusk sky, evergreens and a low brick wall. Keep basin faces clear for UI overlays; no birds, tokens or lettering. Output: `exec-ec66eae8-fed2-4622-a670-4cd267b45549.png`.
- `creatures.png`: square 3×3 atlas of distinct animal portraits on parchment: bee/cat/cuckoo, dog/fox/hawk, owl/scarecrow/squirrel. All nine centered within equal cells, no text or UI. Output: `exec-250a606b-cd0d-4af4-a6cd-907af523c215.png`.

All final assets were visually inspected. UI names, card effects, values, stacks, fountain supports and choices are rendered separately as selectable HTML/SVG.
