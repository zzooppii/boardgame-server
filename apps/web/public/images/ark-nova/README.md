# Ark Nova interface study artwork

Created on 2026-09-14 with the built-in `image_gen` tool. Original generated artwork; no official card artwork, branding graphics, or downloaded animal photographs were copied into these files. Text and interactive map elements are rendered separately in HTML/SVG.

- `zoo-landscape.png`: original painted zoo landscape, emerald forest, teal ponds, sandstone paths, warm light, tiger, elephants, giraffe, flamingos, red panda and macaw framing an open meadow. Used for the interface hero and sponsor/association atmosphere.
- `animal-families.png`: six equal 3×2 wildlife panels (tiger, giraffe, chimpanzee, macaw, iguana, goat). Used as **category illustrations**, not accurate species-specific portraits for all 128 animal cards. The UI labels them accordingly.

Generation source outputs:

- `exec-9ae7a388-20c8-4304-ab2c-7638375e847a.png`
- `exec-93ddd092-9b64-4076-a568-9790e093e0db.png`

Exact prompt for the six-panel sheet:

> Create an original premium board game illustration sheet, landscape 3:2, precisely six equal rectangular panels in a 3-column 2-row grid, thin ivory gutters separating all panels. NO words, letters, numbers, logos or UI. Each panel is a complete hand-painted watercolor and gouache wildlife portrait with fine natural history detail, warm light, elegant rich forest green and sandstone palette, suitable as a collectible zoo card illustration. Top left: a majestic orange tiger with black stripes beside tropical foliage. Top middle: a giraffe among acacia trees in golden savanna. Top right: a chimpanzee in a lush green rainforest. Bottom left: a colorful scarlet macaw perched on a branch. Bottom middle: a green iguana on a sunlit rock near water. Bottom right: a friendly small brown goat in a sunny meadow. Anatomically coherent animals, painterly fine detail, cinematic but legible silhouettes. Each animal entirely within its panel, head and body centered. Original artwork, not a reproduction of any existing board game.

- `terrain-atlas-v1.png`: original 2×2 painted grass, earth, pond and boulder texture atlas. Built-in `image_gen`; user-supplied board image used as a style reference only. SVG clips each quadrant to the existing Map A geometry. Source: `exec-de84f0ee-f0b6-491b-b013-1c7c818ad38e.png`.

Exact terrain prompt:
Use case: stylized-concept. Asset type: production terrain texture atlas for a beautiful illustrated zoo board game, using the attached board as a style reference only. Create ONE square 2-by-2 atlas with four equal square panels, no gutters and no text, hex borders, tokens, icons, UI or buildings. TOP LEFT: seamless lush fine green meadow grass with warm painterly tufts. TOP RIGHT: seamless sandy ochre earth with small cracks and scattered tiny grass tufts, mostly calm earth. BOTTOM LEFT: top-down turquoise blue pond with fine ripples and pale sunlight flecks, organic shallow shoreline and grass at the outer edges, water covering most of panel. BOTTOM RIGHT: a cluster of sculpted grey-lavender boulders viewed from directly overhead, painted highlights and soft cast shadows on grass, stones centered and occupying 80% of panel. Match the reference's charming richly textured printed board-game illustration, natural colors, tactile gouache and colored-pencil detail, coherent overhead daylight, clear miniature-scale shapes. Each panel must fill its exact quadrant so software can use it independently. Original artwork; do not reproduce the reference layout. No perspective horizon, no labels, no watermark.
