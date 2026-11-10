# The Arc — Chapter 1: Landfall

First-person survival / holdout game (Three.js, plain static files — no build step for Vercel).

- `game.js` is generated: edit the parts in `src/` and run `./build.sh`
  - `1-world.js` map layout, terrain heightmap, river/lake, renderer + ELYRA finishing pass (bloom + grade), sky, textures, helpers
  - `1b-build.js` terrain chunks, water, forest, grass, mist
  - `1c-camp.js` Kestrel: the wreck, wall, gate, towers, camp props, nearby sites
  - `1d-regions.js` Halvard, the Burn, Ashmere, Lake Ilse, the lookout, the broken span, scout camps, relay, crates
  - `1e-far.js` the far view: coarse whole-map terrain under the streamed chunks, far-forest cones past the real trees, mountain ranges out to ~9 km, smoke columns over the holds, birds
  - `2-actors.js` people/animals, player, guns, particles, audio + music
  - `3-game.js` story, AI, nights, the Rust, upgrades, input, HUD, map, save, main loop
- `assets/` models, textures, sound effects and score borrowed from Bryce's ELYRA kit (real-world guns only); sound effects are Pixabay (see `assets/sfx/SOURCES-from-elyra.md`)
- `vendor/` three.js r170 example modules (GLTF loader, meshopt decoder, post-processing)

World: ~4.4 km across, one forest biome. The Chapter 1 valley sits in the middle inside a ring of ridges; roads leave it through passes
to the outlands (Varnhold, Sunscar, Elderhollow clan holds, Cinder City, the Watchers, Lake Varr, Mirrorwater). Terrain chunks and
outland forest cells stream in around the player (`updTerrain` / `updForest` in `1b-build.js`).

HUD: health (bottom-left), toolbar 1–5 (bottom), gun + ammo (bottom-right), minimap (top-right, tap for the full map), bag (inventory).

Movement has momentum (accelerate/brake over a fraction of a second, slide along trees, steep climbs slow you), jump buffering + coyote time, and a stamina-limited sprint (bar above health; run it dry and you're winded until a third comes back).

Controls — PC: WASD, hold Shift to run, mouse, click fire, right-click aim, R reload, 1–5 toolbar (Q / wheel swap guns, 3 eats a ration), E use, Space jump/swim, I inventory, M map, F fly (Space up, C down, Shift fast), N sound.
Phone: double-tap the bag to fly; hold JUMP to climb. Controls follow the device (phones/tablets: touch; computers, including touchscreen laptops: keyboard + mouse).
Phone: left thumb move (push to the edge, or tap RUN, to run), right thumb look, crosshair button fires, AIM; tap toolbar slots, the minimap, or the bag.
