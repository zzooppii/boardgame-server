# Base animal illustrations

128 original wildlife illustrations generated with the built-in image_gen tool for cards 401–528. Eight 4×4 PNG atlases keep the cards in catalog order, except atlas 6 cells 7 and 8 are slow worm (488) and grass snake (487). `animal-art.tsx` handles that explicit exception and measured row cropping. The live game and preview share this component; no family-image substitution remains.

The exact generation prompt set is in `prompts.json`. Each cell depicts its named animal in a native habitat with a natural-history painting treatment. These are generated illustrations, not official card scans or biological identification references. All eight atlases were visually inspected; close species and fine anatomical details may still benefit from specialist review.

Native outputs: 1536×1024 PNG, retained as originals. Runtime uses lossless WebP copies: 29,258,475 bytes of PNG become 19,819,644 bytes of WebP (32.3% smaller). Conversion uses `cwebp -quiet -lossless -m 6 source.png -o target.webp`; decoded RGBA pixels were compared with the originals and are identical. Cropping and card-to-species mapping are unchanged.

Illustrations load within 200 px of the viewport, with a shared request cache per sheet. The complete catalog eventually requests all eight sheets as it is scrolled. Feedback illustrations load immediately. A fixed-size placeholder keeps card names, costs and controls available while loading; failed loads show an explicit message and can retry when mounted again. Browsers without IntersectionObserver load immediately. Original family and terrain assets are retained for history and existing board use.
