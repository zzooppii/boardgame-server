# Arnak illustration assets

All three illustrations were generated specifically for this implementation with the imagegen tool. They are original archaeology/fantasy illustrations, not copies of the commercial board or cards. The user's screenshot informed spatial organization only.

- `island.webp`: tall hand-painted archaeology island; turquoise ocean and beach below, jungle river and ancient terraces in the middle, monumental bird temple and golden mist above. Emerald, amber and teal. No printed UI or text.
- `camp.webp`: wide hand-painted expedition tent with archaeology crates, maps, lantern and distant jungle valley; clear foreground tabletop for interface overlays. No text or UI.
- `atlas.webp`: 4×4 equal-cell illustration atlas: compass, coins, tablet, red gem; journal, machete, binoculars/backpack, parrot; bird idol, ritual bowl/dagger, horn, chest; serpent, horned tiger, stone bird, scholar.

CSS uses atlas background positioning. Resource/travel glyphs and game text are separate accessible HTML. Cards use the dedicated sheets described below; the research temple retains legacy artwork. Korean card names are working translations.

Production files are encoded as quality-88 WebP without resizing. Original generated PNGs remain in the Codex generated-images folder. Total network transfer for the three illustrations is approximately 2 MB.

## Dedicated card illustrations — 2026-09-16

`cards-1.webp` through `cards-5.webp` add 80 distinct painted subjects: 40 items, 35 artifacts, four starter definitions and fear. These replace shared motifs on cards; sites, guardians and assistants use the world sheets described below. The illustrations are generated interpretations, not scans of the published cards.

Each source is a 1254×1254, 4×4 atlas. Explicit card IDs and measured row boundaries live in `apps/web/src/features/arnak/card-art.ts`. A small inset avoids neighboring-cell seams. A square inner surface preserves proportions in short cards and full detail views. Both views use `ArnakCardArt`.

The five production files total 3,485,552 bytes, encoded with installed `cwebp -q 88` without resizing. They load as shared browser-cached sheets when referenced. Exact prompts, built-in `image_gen` provenance and original PNG basenames are in [card-art-prompts.json](./card-art-prompts.json). Original PNGs remain in the generation directory; all runtime assets are in this repository.

Atlas order (left to right, top to bottom):

- 1: items 0101–0116.
- 2: items 0117–0132.
- 3: items 0133–0140, artifacts 0201–0208.
- 4: artifacts 0209–0224.
- 5: artifacts 0225–0235, funding-car, funding-boat, exploration-car, exploration-boat, fear.

## World illustrations — 2026-09-16

`world-1.webp` through `world-3.webp` give the 21 sites, 15 guardians and 12 assistants distinct pictures. They are original generated interpretations of this implementation's names. Each atlas has 16 cells; `world-art.ts` maps explicit definition IDs to cells and trims their edges. `ArnakWorldArt` serves board thumbnails and the inspector's larger picture. Missing/hidden definitions render no picture; callers pass only public site/guardian IDs and the player's own or top-supply assistants.

- 1: base-0–4, site1-0–9, site2-0.
- 2: site2-1–5, guardian-0–10.
- 3: guardian-11–14, assistant-0–11.

The three files total 1,875,336 bytes, quality-88 WebP without resizing. Exact built-in image_gen prompts and source PNG basenames are in [world-art-prompts.json](./world-art-prompts.json). Original PNGs remain in the generation directory. The old atlas remains available for the research temple and legacy fallback imagery.
