# The Arc — Chapter 1: Landfall

First-person survival / holdout game (Three.js, plain static files — no build step for Vercel).

- `game.js` is generated: edit the parts in `src/` and run `./build.sh`
  - `1-world.js` map layout, terrain heightmap, river/lake, renderer + ELYRA finishing pass (bloom + grade), sky, textures, helpers
  - `1b-build.js` terrain chunks, water, forest, grass, mist
  - `1c-camp.js` Kestrel: the wreck, wall, gate, towers, camp props, nearby sites
  - `1d-regions.js` Halvard, the Burn, Ashmere, Lake Ilse, the lookout, the broken span, scout camps, relay, crates
  - `2-actors.js` people/animals, player, guns, particles, audio + music
  - `3-game.js` story, AI, nights, the Rust, upgrades, input, HUD, map, save, main loop
- `assets/` models, textures, sound effects and score borrowed from Bryce's ELYRA kit (real-world guns only); sound effects are Pixabay (see `assets/sfx/SOURCES-from-elyra.md`)
- `vendor/` three.js r170 example modules (GLTF loader, meshopt decoder, post-processing)

Controls — PC: WASD, mouse, click fire, right-click aim, R reload, Q swap, E use, Space jump/swim, M map, N sound.
Phone: left thumb move, right thumb look, crosshair button fires, AIM / SWAP / MAP buttons.
