# Incoming models (The Arc), Nov 10 2026

Bryce's batch of Sketchfab models for ELYRA and The Arc, sorted and prepared here so each game's chat can place them. **Nothing loads these yet.** Once a model is placed in a level, move it out of `incoming/` into the game's normal models folder and tick it off.

- `arc/` is only for The Arc
- `shared/` fits both games. The same files are also in the ELYRA repo's `incoming/shared/`, so the two copies are independent
- `previews/` has a 320x240 render of every model (open the .jpg to see one)

How they were prepared (raw uploads were ~2.2 GB, now ~37 MB in this repo): meshes flattened and joined per material, simplified with meshoptimizer where heavy, textures resized (1024, or 2048 for big pieces) and converted to WebP, meshopt-compressed. **Load with `GLTFLoader` + `setMeshoptDecoder(MeshoptDecoder)`.** Each model is rescaled to metres, with its origin centred on X/Z and at floor level (Y = 0). Facing direction was left as authored. "Packs" (chairs-set, medbay-pack, floor-modular, floor-section*) are several pieces laid out in one file: split them by mesh before placing.

## The Arc only
| File | What it is | Size (WxHxD) | Tris | Weight | Use here | Original upload |
|---|---|---|---|---|---|---|
| `fuel-tank.glb` | Rusted green horizontal fuel tank on legs (8 m) | 2.02x2.45x7.99 m | 10,874 | 0.7 MB | Power yard, fuel depot, Cinder City industrial | `horizontal_fuel_tank` |
| `park-arch.glb` | Ruined white stone triumphal-arch colonnade on a base (24 m) | 23.81x7.36x9.55 m | 137,786 | 0.8 MB | Cinder City ruined park / landmark | `arch_of_the_park` |
| `wood-stove.glb` | Cast-iron wood stove with flue pipe | 0.89x2.08x0.84 m | 29,017 | 1.6 MB | Kestrel's houses, cooking building, trader camp | `wood_stove` |

## Shared (both games)
| File | What it is | Size (WxHxD) | Tris | Weight | Use here | Original upload |
|---|---|---|---|---|---|---|
| `bed.glb` | Bunk with shelving and orange screens | 0.59x1.18x2.00 m | 14,124 | 0.4 MB | Crash-site sleeping pods, Arc main structure bunks *(ELYRA: Crew quarters on ships and outposts)* | `sci-fi_bed` |
| `catwalk-bridge.glb` | Short metal catwalk ramp with lit edges (6.5 m) | 6.46x0.77x3.00 m | 536 | 0.1 MB | Wreck walkways, gate catwalks *(ELYRA: Hangars, facility walkways)* | `sci-fi_bridge` |
| `ceiling-light.glb` | Long strip ceiling light (1.5 m) | 0.30x0.10x1.50 m | 12,064 | 0.3 MB | Station wreck and Arc interiors *(ELYRA: Any interior)* | `sci-fi_style_ceiling_light` |
| `chairs-x4.glb` | Four padded seats in a row (2.7 m) | 2.72x0.88x0.61 m | 67,244 | 3.6 MB | Station seating, the crashed section's seats *(ELYRA: Dropship / shuttle seating)* | `sci-fi_chairs_x4_by_jungle_jim (+ identical __1_ copy, skipped)` |
| `cinema-camera.glb` | Rigged-out film camera with cable (15 cm) | 0.15x0.08x0.12 m | 27,182 | 1.1 MB | Found recorder / salvage *(ELYRA: Footage-log recorder prop)* | `sony_fx_300_-_jackal` |
| `computer-console.glb` | Laptop-style computer terminal with glowing screen (1.5 m) | 1.48x1.16x1.21 m | 2,060 | 0.3 MB | Station computers, radio room *(ELYRA: Terminals / hack points)* | `sci_-_fi_computer_game_ready` |
| `corridor.glb` | Dark corridor tube with red lights (8 m) | 2.60x2.08x8.15 m | 29,980 | 2.1 MB | Damaged section of the wreck *(ELYRA: Hollow ship interiors)* | `sci-fi_corridor_-_revisited_2019` |
| `floor-material.glb` | Rusty tileable sci-fi floor (180 m plane; mostly use its textures) | 180.00x0.00x180.00 m | 4,194 | 1.4 MB | Wreck floors, industrial yards *(ELYRA: Hollow floors)* | `sci-fi_floor_material` |
| `floor-modular.glb` | Pack of black modular floor tiles laid out (split into pieces) | 6.90x0.07x5.30 m | 35,687 | 0.6 MB | Station floors *(ELYRA: Ship floors)* | `modular_sci-fi_floor` |
| `floor-panel.glb` | Floor panel with red light strips (20 x 8 m) | 20.00x0.08x8.00 m | 34,760 | 1.2 MB | Landing pad, wreck floor *(ELYRA: Hangar/runway floors)* | `sci_fi_floor_panel01_medium_4x10` |
| `floor-section-b.glb` | Two grated floor sections (11 x 12 m spread) | 10.76x1.20x12.48 m | 51,042 | 0.3 MB | Wreck floors *(ELYRA: Catwalk floors)* | `sci-fi_floor_section_kb011` |
| `floor-section.glb` | Two greebled floor sections (34 x 22 m spread) | 34.00x1.06x21.93 m | 59,933 | 0.3 MB | Wreck decks *(ELYRA: Hollow base floors, ship decks)* | `sci-fi_floor_section_kb019` |
| `floor-tiles.glb` | Flat blue tile plane (15 x 6 m, 2 triangles; texture only) | 15.00x0.00x6.00 m | 24 | 0.1 MB | Floors *(ELYRA: Floors)* | `sci-fi_modular_floor_tiles` |
| `fuel-cell.glb` | Glowing orange fuel-cell canister (75 cm) | 0.66x0.75x0.64 m | 8,132 | 0.1 MB | Salvage from the wreck / power cells for the base *(ELYRA: Pickups, generators, explosive barrels)* | `sci-fi_fuel_cell_canister` |
| `gas-bottle.glb` | Green N2 gas bottle with valve (1.44 m) | 0.39x1.44x0.41 m | 4,090 | 0.4 MB | Workshops, explosive salvage *(ELYRA: Labs, hangars)* | `nitrogen_bottle` |
| `hallway.glb` | White modular corridor section (4.5 x 3.3 x 5.9 m) | 4.47x3.29x5.92 m | 245,333 | 6.2 MB | Inside the Arc station wreck *(ELYRA: Keeper ship/outpost corridors)* | `sci_fi_hallway_free` |
| `keypad-panel.glb` | Wall keypad with an ENTER PIN screen (2 m panel) | 2.00x2.00x0.18 m | 884 | 0.2 MB | Locked bunker/vault doors *(ELYRA: Locked doors, puzzle doors)* | `simple_sci-fi_wall_panel` |
| `locker.glb` | Red metal locker (1.73 m) | 0.76x1.73x1.33 m | 1,452 | 0.1 MB | Arc station wreck interior, barracks, storage loot container *(ELYRA: Keeper barracks, armouries)* | `sci-fi_locker` |
| `medbay-pack.glb` | Grimy medical pack laid out in a row: drip stands, carts, scanners, cabinets (split into pieces) | 15.85x3.20x3.07 m | 15,974 | 1.4 MB | Arc infirmary, crash-site med bay *(ELYRA: Hollow labs, Last Signal facility medbay)* | `nursing_sci-fi_pack_terror_version` |
| `medkit-case.glb` | White medical case (62 cm) | 0.42x0.18x0.62 m | 25,906 | 0.6 MB | Med loot crate *(ELYRA: Health pickup / medbay prop)* | `sci-fi_med_kit` |
| `medkit-small.glb` | Red wall-mounted medkit (40 cm) | 0.11x0.40x0.23 m | 744 | 0.3 MB | Med supplies pickup / infirmary wall *(ELYRA: Health pickup)* | `sci-fi_medkit` |
| `roof-panel.glb` | Grey grated roof/ceiling plate (4.5 x 6.4 m) | 4.53x0.19x6.35 m | 156 | 1.3 MB | Ceilings and scrap roofing *(ELYRA: Ceilings)* | `sci-fi_roof_panel` |
| `server-rack.glb` | Open server rack (2 m) | 1.27x2.00x0.82 m | 29,625 | 1.6 MB | Arc tech room, salvage *(ELYRA: Facility server rooms (The Last Signal))* | `server_rack` |
| `server-tower.glb` | Plain dark server tower (2 m, 90 triangles) | 0.60x2.09x0.60 m | 90 | 0.0 MB | Background filler *(ELYRA: Background filler)* | `server` |
| `statue.glb` | Dark stone animal statue (7.8 m) | 3.02x7.79x4.49 m | 1,496 | 0.4 MB | Ruins landmark *(ELYRA: White City / Remnant shrine)* | `statue` |
| `stone-arch-ruins.glb` | Row of broken stone arches with rubble (17.5 m) | 17.55x4.95x4.10 m | 39,307 | 4.9 MB | Ancient ruins landmark *(ELYRA: Remnant ruins on Elyra/Astraea)* | `stone_arch_pillars_-_ruins` |
| `stone-pillar.glb` | Weathered marble pillar (3.7 m) | 1.39x3.66x1.39 m | 908 | 0.3 MB | Ruins in the wild / Cinder City *(ELYRA: White City ruins)* | `stone_pillar` |
| `walkie-talkie.glb` | Handheld radio (36 cm) | 0.14x0.36x0.05 m | 7,173 | 0.1 MB | Radios to contact the station / other settlers *(ELYRA: Comms prop / pickup)* | `starmax-8000_sci-fi_walkie-talkie` |
| `wall-2.glb` | White panelled wall with diagonal braces (11 x 5.6 m) | 11.27x5.63x1.02 m | 55,113 | 0.4 MB | Arc main structure walls *(ELYRA: Keeper interiors)* | `sci-fi_wall_2` |
| `wall-3.glb` | Flat dark wall/floor plate texture card (5.3 x 3.6 m) | 5.31x0.14x3.55 m | 12 | 0.2 MB | Filler panels *(ELYRA: Filler panels)* | `sci-fi_wall_3` |
| `wall-4.glb` | Teal machinery/electrical wall section (2 m tall) | 0.39x2.00x1.43 m | 12,844 | 0.5 MB | Power room, wreck machinery *(ELYRA: Engine rooms, Tide City utility)* | `sci-fi_wall_4` |
| `wall-b.glb` | Curved grey hull wall with a window (4.5 x 3.8 m) | 4.49x3.83x2.41 m | 1,908 | 0.5 MB | Broken hull pieces at the crash site *(ELYRA: Ship hulls, outposts)* | `sci-fi_wall` |
| `wall-c.glb` | Curved white wall panel (2.6 m) | 2.57x1.24x0.33 m | 98 | 2.1 MB | Arc interior trim *(ELYRA: Interior trim)* | `sci-fi_wall__1_` |
| `wall-screen.glb` | Wall monitor with a radar UI (3 x 2 m) | 2.99x2.01x0.13 m | 220 | 0.1 MB | Arc command/radio room *(ELYRA: Command rooms)* | `full_screen` |
