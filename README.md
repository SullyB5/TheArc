# The Arc

Open-world first-person survival / holdout game (Three.js, plain static files — no build step for Vercel).

- `game.js` is generated: edit the parts in `src/` and run `./build.sh`
  - `1-world.js` map layout, terrain heightmap, river/lake, renderer + ELYRA finishing pass (bloom + grade), sky, textures, helpers
  - `1b-build.js` terrain chunks, water, forest, grass, mist
  - `1c-camp.js` Kestrel: the wreck, wall, gate, towers, camp props, nearby sites
  - `1e-city.js` Cinder City (instanced towers, facade shader), the Foundry (Ironjaw's rebuilt district), Farlight traders, Greyhold Station, Ironjaw yards, locked caches, the trader
  - `1d-regions.js` Halvard, the Burn, Ashmere, Lake Ilse, the lookout, the broken span, scout camps, relay, crates
  - `1e-far.js` the far view: coarse whole-map terrain under the streamed chunks, far-forest cones past the real trees, mountain ranges out to ~9 km, smoke columns over the holds, birds
  - `2-actors.js` people/animals, player, guns, particles, audio + music
  - `2a-data.js` every item, tool, weapon, wear piece, placeable and recipe (tiers 1–6, unlocked by key items)
  - `2a-icons.js` item icons (`assets/icons/<id>.png`; build.sh lists them into `2a-icons.gen.js`)
  - `2c-weapons.js` weapon slots, viewmodels, guns/bows/melee/grenades, enemy gunners
  - `2d-build.js` base building: walls, doors, towers, storage, beds, farms, power, turrets, barracks
  - `2b-craft.js` items (every category, renewable vs salvage, tiers 1–6), tools with durability + quality, recipes, stations, gathering nodes, food variety + contamination, injuries
  - `3-game.js` story, AI, nights, the Rust, upgrades, input, HUD, map, save, main loop
- `assets/` models, textures, sound effects and score borrowed from Bryce's ELYRA kit (real-world guns only); sound effects are Pixabay (see `assets/sfx/SOURCES-from-elyra.md`)
- `vendor/` three.js r170 example modules (GLTF loader, meshopt decoder, post-processing)

World: ~4.4 km across, one forest biome. The Chapter 1 valley sits in the middle inside a ring of ridges; roads leave it through passes
to the outlands (Varnhold, Sunscar, Elderhollow clan holds, Cinder City, the Watchers, Lake Varr, Mirrorwater). Terrain chunks and
outland forest cells stream in around the player (`updTerrain` / `updForest` in `1b-build.js`).

Open world: no chapters. Tier keys: clan insignia (2), Arc ID chip (3), Greyhold card (4), Dr. Arden's notebook (5), Gate Stone codes (6). Nights bring raids (clans, then Ironjaw from night 6, Greyhold from night 20); night 100 is the big one. Dying drops your bag where you fell.

Movement has momentum (accelerate/brake over a fraction of a second, slide along trees, steep climbs slow you), jump buffering + coyote time, and a stamina-limited sprint (bar above health; run it dry and you're winded until a third comes back).

HUD: health (bottom-left), toolbar 1–5 (bottom: 1–2 guns, 3 melee/bow, 4 eat, 5 treat), gun + ammo (bottom-right), minimap (top-right, tap for the full map), bag (inventory).

Controls — PC: WASD, hold Shift to run, mouse, click fire/swing, right-click aim, R reload, 1–5 toolbar (Q / wheel cycle weapons), E use, Q next action / dismantle, G throw, B binoculars, Space jump/swim, I bag + craft, M map, F fly (Space up, C down, Shift fast), N sound.
Phone: double-tap the bag to fly; hold JUMP to climb. Controls follow the device (phones/tablets: touch; computers, including touchscreen laptops: keyboard + mouse).
Phone: left thumb move (push to the edge, or tap RUN, to run), right thumb look, crosshair button fires, AIM; tap toolbar slots, the minimap, or the bag.
