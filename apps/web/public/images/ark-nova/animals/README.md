# Base animal illustrations

128 original wildlife illustrations generated with the built-in image_gen tool for cards 401–528. Eight 4×4 PNG atlases keep the cards in catalog order, except atlas 6 cells 7 and 8 are slow worm (488) and grass snake (487). `animal-art.tsx` handles that explicit exception and measured row cropping. The live game and preview share this component; no family-image substitution remains.

The exact generation prompt set is in `prompts.json`. Each cell depicts its named animal in a native habitat with a natural-history painting treatment. These are generated illustrations, not official card scans or biological identification references. All eight atlases were visually inspected; close species and fine anatomical details may still benefit from specialist review.

Native outputs: 1536×1024 PNG, approximately 28 MB combined. Only sheets referenced by visible components are requested in normal games; the complete catalog requests all eight. Original family and terrain assets are retained for history and existing board use.
