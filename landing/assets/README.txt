PokeRipping landing — images
============================

Save the images you sent into THIS folder with exactly these names:

  pokeripping-logo.png   <- the yellow "PokeRipping" wordmark (transparent background recommended)
  gengar.png             <- the purple Gengar (hero character)
  bulbasaur.png          <- the teal Bulbasaur (game section, left)
  chikorita.png          <- the green Chikorita (game section, right)

Full paths, e.g.:
  landing/assets/pokeripping-logo.png

Notes:
- Transparent PNGs look best (especially the logo — a white background will show as a white box on the cream page).
- If an image is missing, the page still works: the logo falls back to styled text, and the
  character images simply don't render (no broken-image icons).

How to preview locally:
  Just open landing/index.html in a browser (double-click), or serve the folder, e.g.:
    python -m http.server 4000 --directory landing
  then open http://localhost:4000
