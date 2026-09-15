# Original Duel illustration atlases

Generated with the built-in `image_gen` tool through the imagegen skill, 2026-09-15. Generation mode, no reference game artwork used. Images are project assets copied from Codex's generated_images directory. CSS selects cells of each 4×4 atlas; no runtime image service is needed.

- `wonders.png`: 16 original ancient architectural paintings, in catalog `art` order. Appian road, Colossus, Circus, Library, Lighthouse, Hanging Gardens, Mausoleum, Piraeus, Pyramids, Sphinx, Artemis, Zeus statue, Sanctuary, Divine Theater, Curia Julia, Knossos. Used for wonder illustrations.
- `gods.png`: Enki, Ishtar, Nisaba, Astarte; Baal, Tanit, Aphrodite, Hades; Zeus, Anubis, Isis, Ra; Mars, Minerva, Neptune, Gate. Used for Pantheon cards.

## Prompt set

Wonder atlas: a single regular 4×4 grid of equal square paintings, without gutters, borders, text or logos. Original ancient Mediterranean architecture in premium painterly style, atmospheric detailed landscapes with ochre, emerald and turquoise. Each named scene above occupies one cell in row-major order, with readable silhouettes and luminous natural lighting.

God atlas: a perfectly regular 4×4 grid of sixteen equal square illustrations, no gaps, frames, text or numbers. Original premium ancient mythology portraits in luminous detailed cinematic oil-and-gouache style, jewel turquoise, jade, ochre, warm ivory, ancient architecture backgrounds. Waist-up figures, distinct silhouettes and attributes. Enki with flowing water; Ishtar with lion and star; Nisaba with papyrus and snake; Astarte holding coins; Baal with lightning; Tanit with crescent and treasure; fully clothed Aphrodite with dove and roses; Hades with dark crown; Zeus with lightning; jackal-headed Anubis; winged Isis; falcon-headed Ra; Mars with bronze helmet; Minerva with owl; Neptune with trident; luminous stone portal. No existing game illustrations, letters or UI elements.

Original output files: `exec-f22561e5-eb96-4de5-b20a-4248051a6819.png` and `exec-5c51e6e9-5852-48ec-9793-96c9e25427d5.png`.

- `buildings.png`: 16 original building-category paintings. Timber camp, clay pit, quarry, glassblower, papyrus workshop, military gate, library, observatory, theater, temple, aqueduct, market, harbor, guild hall, senate, grand temple. Prompt: exact 4×4 grid, equal square paintings, no gaps/borders/text; ancient Mediterranean, atmospheric luminous gouache and oil, turquoise skies, jade landscapes, honey-gold sunlight, readable architectural silhouettes and human activity, original artwork. Original output `exec-03a05839-1b1a-4074-ba51-3d16b10b0cb8.png`. Buildings use this separate atlas so resource and military cards have appropriate scenes.
