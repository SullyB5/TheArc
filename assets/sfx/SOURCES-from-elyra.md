# Sound effects: sources, processing and the coverage checklist

Free sound effects from Pixabay (Pixabay Content License: free to use, no attribution required).
Imported Oct 25 2026. Credits stay in this file only — no names are shown in the game.

Every event → file mapping lives in **one file: `js/shared/sfx-map.js`**. To give an event a new sound, drop the file in
`audio/sfx/` (run `audio/sfx/process.sh` on it once) and change that event's line. Anything whose file is missing or still
loading plays its synthesized stand-in from `js/shared/audio.js`, so nothing ever goes silent.

## Files

Originals are kept untouched in `audio/sfx/raw/`. The files in `audio/sfx/` are made from them by `audio/sfx/process.sh`
(ffmpeg): silent heads and tails trimmed (under −60 dBFS), loudness-normalised (the RMS of what's left to −20 dBFS, a few dB
lower for the engine loop and the long beds, a little higher for the quiet door) with peaks capped at −1 dBFS so nothing clips,
mono 44.1 kHz MP3. The game trims again as it decodes (anything the encoder padded), and crossfades the engine loop's seam.

| File | Length (raw) | What it is | Original upload |
|---|---|---|---|
| gun-scifi-shot.mp3 | 0.7 s | single futuristic energy shot | sound-work, futuristic-gun-shot-sci-fi-217154 |
| ray-gun-blast.mp3 | 3.3 s | ray gun blast with tail | flutie8211, ray-gun-blast-1-546936 |
| pistol-shot-reverb.mp3 | 1.5 s | 9mm pistol, short reverb | freesound_community, 9mm-pistol-shoot-short-reverb-7152 |
| gun-shot-heavy.mp3 | 6.0 s (3.8 s audible) | single loud gunshot, long tail | u_62htdrvg4y, gun-shot-359196 |
| gun-shots-multi.mp3 | 7.6 s | three short bursts at ~10 rounds/s (0.6–1.9 s, 2.6–3.3 s, 4.05–4.35 s), each ending in a tail | u_2n07b18i8q, gun-shoot-512969 |
| machine-gun-a.mp3 | 4.1 s (1.8 s audible) | automatic burst | dennish18, machine-gun-129928 |
| machine-gun-b.mp3 | 1.8 s | automatic burst | dennish18, machine-gun-129929 |
| machine-gun-burst-clean.mp3 | 1.6 s | clean automatic burst | freesound_community, clean-machine-gun-burst-98224 |
| rocket-launcher-rpg.mp3 | 4.2 s | RPG launch + whoosh | sovetsky_rastov72, rpg-7-sound-effect-267739 |
| rocket-engine-large.mp3 | 11.1 s | large rocket engine roar | freesound_community, large-rocket-engine-86240 |
| ship-flyby-large.mp3 | 7.8 s | large sci-fi ship flyby | daviddumaisaudio, large-sci-fi-ship-flyby-04-204490 |
| drone-engine-loop.mp3 | 3.6 s | sci-fi engine hum, loopable | freesound_community, sci-fi-drone-engine-loop-40794 |
| door-scifi-a.mp3 | 1.9 s | sci-fi door open/close | freesound_community, sci_fi_door-6451 |
| door-scifi-b.mp3 | 0.7 s | short sci-fi door (quiet raw, peaks −12 dB; levelled by processing) | freesound_community, sci-fi-door-14782 |
| car-engine.mp3 | 3.1 s | car engine turning over and revving | dragon-studio, car-engine-372477 |
| car-engine-roaring.mp3 | 4.1 s | car engine roaring | dragon-studio, car-engine-roaring-376881 |
| missile-explosion.mp3 | 6.0 s | missile explosion | voicebosch, missile-explosion-168600 |

Made from them by `process.sh` (one-shots cut out of the bursts):

| File | Cut from | What it is |
|---|---|---|
| gun-shots-multi-1/2/3.mp3 | gun-shots-multi | the last round of each of the three bursts, with its natural tail |
| machine-gun-a-single.mp3 | machine-gun-a | the first round, crossfaded into the burst's own tail |
| machine-gun-b-single.mp3 | machine-gun-b | the first round, crossfaded into the burst's own tail |
| machine-gun-clean-single.mp3 | machine-gun-burst-clean | the first round, crossfaded into the burst's own tail |
| car-engine-loop.mp3 | car-engine-roaring | its steady middle (0.2–1.65 s), looped in the game with a crossfaded seam |

Smaller slices (reload clicks, the empty click, swap, low ammo, hit confirms, the Herald charge-up) are cut at decode time from
the files above; their offsets are in `sfx-map.js`.

## How sounds play

- Every play varies pitch (±4–6 %) and volume (±10 %) so repeats never sound identical.
- **Your own weapon** plays centred and un-attenuated. Everything else uses the existing distance/pan, plus a low-pass that
  closes with distance (far gunfire is muffled).
- **Single tap**: one single-round sample per trigger pull. **Full spray**: single-round samples chained at the gun's fire
  rate; each new round fades the previous one out in 40 ms, so a long hold is continuous with no gaps and no stacking, and on
  release the last round rings out with its natural tail.
- The existing voice cap (40) covers samples and synth together. Your own gun, doors and cutscene sounds always get a voice.
- Light reverb is on only in indoor zones (tunnels, halls, the tower). Flybys bend pitch (doppler). Big explosions, the dome
  and the Hollow King duck everything else for a moment.
- Loops pause with the game, obey mute and the SFX slider, and stop cleanly when a cutscene is skipped. Cutscene sounds sit
  under subtitle clicks and music.
- Files load in the background once a level has started (synth until each is ready), so loading times don't grow.
- Settings → SFX and Music volume. Hidden sound test: `sound-test.html` (or, on the menu, open Settings and press **T** three times).

## Coverage checklist

Legend: ✅ file · 🎛 synthesized (no fitting file yet) · event name in `sfx-map.js` in `code`.

### Keepers — player and human allies (normal guns)

| Event | Where | Sound |
|---|---|---|
| `gun.rifle.standard` Pulse rifle | The Mountain, Pathfinder 01–03 | ✅ machine-gun-a single (tap) / chained (spray) |
| `gun.rifle.m254` M254 Remnant White | same | ✅ machine-gun-b single, pitched down (heavier) |
| `gun.rifle.night` Night Watch carbine | same | ✅ clean single |
| `gun.rifle.carbine` Red Carbine | same | ✅ machine-gun-a single, pitched up |
| `gun.rifle.smg` Red Ripper | same | ✅ clean single, pitched up (snappier) |
| `gun.rifle.herald-rifle` captured Herald rifle (an enemy gun: the Heralds' sound) | same | ✅ ray-gun-blast short slice (tap/spray) |
| `gun.rifle.hollow-gun` captured Hollow pulse gun (an enemy gun: the Host's sound) | same | ✅ gun-scifi-shot (tap/spray) |
| `gun.lance.standard` Lance | same | ✅ gun-shot-heavy |
| `gun.lance.desert` Dune Marksman | same | ✅ gun-shot-heavy, pitched down |
| `gun.lance.longshot` Red Longshot | same | ✅ gun-shots-multi-2 |
| `gun.side.standard` Keeper Sidearm | same | ✅ pistol-shot-reverb |
| `gun.side.pistol-custom` Tidewalker revolver | same | ✅ gun-shots-multi-1 |
| `gun.side.pistol-custom-2` Sandcat | same | ✅ gun-shots-multi-3 |
| `gun.side.revolver` Red Fang | same | ✅ gun-shot-heavy, pitched up |
| `gun.breaker` Breaker launcher (Keeper skins) | same | ✅ rocket-launcher-rpg |
| `gun.breaker.hollow-heavy` Hollow Heavy Blaster (enemy make) | same | ✅ ray-gun-blast, pitched down (the Hollow missile sound) |
| `gun.breaker.herald-heavy` Herald Heavy · Special (enemy make) | same | ✅ ray-gun-blast |
| `missile.hit` a missile or rocket landing (Breaker rockets, interceptor, walker and sea-gun missiles) | all | ✅ missile-explosion |
| `gun.squad` Keeper squad rifles, shoulder sentry | The Mountain, Pathfinder | ✅ machine-gun-b / clean singles |
| `gun.keeper.trooper` Keeper troopers in the streets | Tide City | ✅ clean single |
| `gun.walker` Warden Six walker cannon | Tide City streets | ✅ gun-shot-heavy, pitched down |
| `gun.skiff` gun-skiff guns (your vehicle) | Tide City streets | ✅ machine-gun-a single (own) |
| `gun.pilot` your interceptor guns (tap/spray) | Heralds, Tide City | ✅ clean single (own) |
| `gun.pilot.zeal` your guns under Zeal | Heralds, Tide City | ✅ clean single, pitched up (own) |
| `gun.fighter` Keeper wingmen | Heralds, Tide City | ✅ machine-gun-b single |
| `gun.capital` Keeper capital cannons | Heralds, Tide City | ✅ gun-shot-heavy, pitched way down |
| `gun.flak` Keeper flak and sea guns | Heralds, Tide City | ✅ clean single, pitched down |
| `gun.pf.nose` the Pathfinder / Dropship Two nose guns | Pathfinder 01 escape, Pathfinder 03 air | ✅ machine-gun-a single (own when you fly) |
| `gun.pf.big` the Pathfinder's heavy guns | Pathfinder 01 escape cutscene | ✅ gun-shot-heavy, pitched down |
| `missile.keeper` your missiles, sea-gun SAMs, walker missiles, Keeper capital missiles | Heralds, Tide City | ✅ rocket-launcher-rpg |

### The Heralds (sci-fi only)

| Event | Where | Sound |
|---|---|---|
| `gun.herald.rifle` red and amber troopers (rapid: tap/spray) | Pathfinder 02–03 | ✅ ray-gun-blast, short slice |
| `gun.herald.fighter` Herald fighters | Heralds, Tide City, Pathfinder 03 | ✅ ray-gun-blast short slice, pitched up |
| `gun.herald.capital` Herald capital ship lasers | Heralds, Tide City | ✅ ray-gun-blast |
| `gun.herald.bomber` Void Lancer torpedoes | Heralds | ✅ ray-gun-blast, pitched down |
| `gun.herald.mech` Herald mech machine guns | Pathfinder 02–03 | ✅ ray-gun-blast short slice, pitched down |
| `gun.heavy` Herald mech cannons, Hollow turrets | The Mountain, Pathfinder | ✅ ray-gun-blast |
| `gun.herald.warship` the Herald warship's beam | Pathfinder 03 | ✅ ray-gun-blast, pitched way down |
| `gun.herald.flak` amber wall guns | Pathfinder 03 air | ✅ ray-gun-blast short slice, pitched up |
| `herald.charge` charge-up warning before a Herald heavy attack (mech cannons, warship beam) | Pathfinder 02–03 | ✅ ray-gun-blast reversed |

### The Hollow and the Empty Host (sci-fi only)

| Event | Where | Sound |
|---|---|---|
| `gun.hollow.trooper` Empty Host troopers (rapid: tap/spray), the Hollow King's gate guns | The Mountain, Pathfinder 01, Tide City | ✅ gun-scifi-shot |
| `gun.hollow.fighter` Hollow fighters | Tide City, Pathfinder 01 escape | ✅ gun-scifi-shot, pitched up |
| `gun.hollow.capital` Hollow capital ship lasers | Tide City | ✅ ray-gun-blast |
| `gun.hollow.warship` the Hollow warship in the escape | Pathfinder 01 escape | ✅ ray-gun-blast, pitched down |
| `missile.hollow` Hollow missiles (none fire yet; mapped for when they do) | — | ✅ ray-gun-blast, pitched down |

### Engines, flybys, launches

| Event | Where | Sound |
|---|---|---|
| `loop.interceptor` your interceptor's engine | Heralds, Tide City | 🎛 jet roar, with ✅ drone-engine-loop under it |
| `loop.walker` Warden Six's walker | Tide City streets | ✅ drone-engine-loop, low |
| `loop.skiff` gun-skiff (warthog class) | Tide City streets | ✅ car-engine-loop |
| `loop.warthog` the warthog (for Pathfinder's warthog runs, when they're built) | — | ✅ car-engine-loop, a touch lower |
| `engine.start` / `engine.rev` the skiff's engine turning over as you board, and roaring when you floor it | Tide City streets | ✅ car-engine / car-engine-roaring |
| `loop.dropship` Empty Host dropships, Dropship Two in flight, the Pathfinder | The Mountain, Pathfinder 01–03, Tide City streets | ✅ drone-engine-loop (nearest two) |
| `loop.mech` Herald mechs | Pathfinder 02–03 | ✅ drone-engine-loop, very low (nearest two) |
| `loop.carrier` the Hollow King's carriers | Tide City streets | ✅ drone-engine-loop, lowest |
| `flyby` ships passing the camera (every former whoosh), Pathfinder fly-ins, Tide City fleet arrivals, the Herald convoy | all | ✅ ship-flyby-large with doppler bend |
| `launch` dropship and ship take-offs (every former lift-off), the interceptors leaving the Mountain, the evacuation shuttles | all | ✅ rocket-engine-large |
| `jump` Slipscape jumps in and out | Heralds, Tide City, prologue | 🎛 synth (no fitting file) |

### Doors, hatches, airlocks

| Event | Where | Sound |
|---|---|---|
| `door.big` the Hollow King's gate, the Pathfinder vault, the sealed door, the shutter, the tower door, the White City's opening | The Mountain, Pathfinder 01–03 | ✅ door-scifi-a, pitched down (the old stone creak stays under it) |
| `door.open` the drop bay's rear door, the Pathfinder's ramp, Dropship Two's ramp | Pathfinder 01–02 | ✅ door-scifi-a |
| `door.hatch` canopies and hatches (boarding the interceptor, the walker/skiff) | The Mountain, Tide City streets | ✅ door-scifi-b |

### Your gear and feedback

| Event | Where | Sound |
|---|---|---|
| `reload` (mag out, mag in, rack timed to the reload) | ground chapters | ✅ door-scifi-b slices |
| `empty` dry click | ground chapters | ✅ door-scifi-b slice |
| `swap` weapon swap | ground chapters | ✅ door-scifi-a + door-scifi-b slices |
| `lowammo` magazine under a quarter (once per magazine) | ground chapters | ✅ door-scifi-b slice, twice |
| `hit.hollow` hit confirm on the Empty Host | ground chapters | ✅ gun-scifi-shot attack slice |
| `hit.herald` hit confirm on armoured Heralds, mechs, turrets, dropships | ground chapters | ✅ clean round attack + door clank |
| `nade.pin` grenade throw (the pin; the arm's swish is synth) | ground chapters | ✅ door-scifi-b slice + 🎛 |
| mobile shield, sentry launch, pickups, Zeal, shield crackle / hull clang when you're hit, alarms, radio click | all | 🎛 synth |

### Stays synthesized

Explosions of every size (except missile and rocket impacts), blasts, crashes, collapses, the city's death, the Spear's shot, the planet's beam, the war horn,
the voice in the tunnels, static, swells, the score (music), Slipscape jumps.

### Big moments (duck everything else)

Big explosions, the Spear firing, the city falling, the White City's dome, the Hollow King's appearances.
