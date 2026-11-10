
/* ================= items, tools, recipes, gathering, survival status =================
   The world's own setting: Arc folk, the Thornkin clans, Greyhold, the Rust, the Ember, HALCYON and the Quiet City,
   Dr. Sel Arden, Sunfall, the Lantern vault, Meridian, Haven, mind spindles and the Gate Stone.
   Tier 1 (The Landing) is live. Later tiers are in the data so the browser shows what's coming. */

const TIERS = ['', 'The Landing', 'The Clans', 'The Arc Survivors', 'Greyhold', 'Sunfall', 'Beyond'];
// src: ren = renewable (gather / hunt / grow) · salv = only from ruins, crates or other factions · craft = made · story = questline only
const ITEM_DEFS = [
  // wood
  ['stick', 'Sticks', 'wood', 1, 'ren', '#a07a4e'], ['branch', 'Branch', 'wood', 1, 'ren', '#8c6a42'], ['log', 'Log', 'wood', 1, 'ren', '#7a5634'],
  ['plank', 'Plank', 'wood', 2, 'craft', '#b48c5c'], ['bark', 'Bark', 'wood', 1, 'ren', '#5e4430'], ['hardwood', 'Hardwood', 'wood', 1, 'ren', '#6a4a2c'],
  // stone
  ['stone', 'Small stone', 'stone', 1, 'ren', '#9a968e'], ['sharp_rock', 'Sharp rock', 'stone', 1, 'ren', '#8a8780'], ['flint', 'Flint', 'stone', 1, 'ren', '#4a4e56'],
  ['limestone', 'Limestone', 'stone', 1, 'ren', '#d8d2bc'], ['clay', 'Clay', 'stone', 1, 'ren', '#a8643c'], ['charcoal', 'Charcoal', 'stone', 1, 'craft', '#2a2826'],
  // plant fibres
  ['fiber', 'Plant fiber', 'fiber', 1, 'ren', '#8aa04a'], ['vine', 'Vines', 'fiber', 1, 'ren', '#5a7a32'], ['reed', 'Reeds', 'fiber', 1, 'ren', '#a8a05a'],
  ['leaves', 'Leaves', 'fiber', 1, 'ren', '#4e7a3a'],
  // metals
  ['scrap', 'Scrap metal', 'metal', 1, 'salv', '#9aa3a8'], ['iron', 'Iron', 'metal', 3, 'salv', '#6e6a66'], ['steel', 'Steel', 'metal', 3, 'salv', '#b8c0c6'],
  ['copper', 'Copper', 'metal', 3, 'salv', '#c07a4a'], ['aluminum', 'Aluminum', 'metal', 3, 'salv', '#d0d4d8'], ['wire', 'Wire', 'metal', 1, 'salv', '#c89a5a'],
  // animal
  ['hide', 'Hide', 'animal', 1, 'ren', '#9a6a44'], ['leather', 'Leather', 'animal', 2, 'craft', '#7a4a2a'], ['bone', 'Bone', 'animal', 1, 'ren', '#e8e0cc'],
  ['sinew', 'Sinew', 'animal', 1, 'ren', '#d8a088'], ['feather', 'Feathers', 'animal', 1, 'ren', '#e8e8e0'], ['teeth', 'Teeth', 'animal', 1, 'ren', '#f0ead8'], ['fat', 'Animal fat', 'animal', 1, 'ren', '#f0d890'],
  // textiles
  ['cloth', 'Cloth scraps', 'textile', 1, 'salv', '#8a8a7a'], ['rope', 'Rope', 'textile', 1, 'craft', '#c8a46a'], ['thread', 'Thread', 'textile', 2, 'craft', '#d8d0b8'],
  ['canvas', 'Canvas', 'textile', 3, 'salv', '#a8a088'], ['synth', 'Synthetic fabric', 'textile', 3, 'salv', '#5a7a9a'],
  // electronics (all salvage)
  ['circuit', 'Circuit board', 'elec', 3, 'salv', '#3a8a4a'], ['battery', 'Battery', 'elec', 3, 'salv', '#d8b040'], ['cu_wiring', 'Copper wiring', 'elec', 3, 'salv', '#d07a40'],
  ['sensor', 'Sensor', 'elec', 3, 'salv', '#5aa0c0'], ['fuse', 'Fuse', 'elec', 3, 'salv', '#c0c0b0'],
  // industrial
  ['nails', 'Nails', 'indus', 1, 'salv', '#a0a4a8'], ['screws', 'Screws', 'indus', 1, 'salv', '#b0b4b8'], ['bolts', 'Bolts', 'indus', 2, 'salv', '#8a8e92'],
  ['pipe', 'Pipe', 'indus', 2, 'salv', '#7a7e82'], ['gears', 'Gears', 'indus', 3, 'salv', '#b89a5a'], ['springs', 'Springs', 'indus', 3, 'salv', '#a8acb0'], ['rubber', 'Rubber', 'indus', 2, 'salv', '#2a2a2a'],
  ['fasteners', 'Fasteners', 'indus', 2, 'salv', '#9a9ea2'], ['spare_parts', 'Spare parts', 'indus', 2, 'salv', '#8a8a80'], ['tool_kit', 'Tool kit', 'indus', 2, 'salv', '#b04a3a'],
  ['hook', 'Bone hook', 'indus', 1, 'craft', '#e8e0cc'], ['pot', 'Clay pot', 'indus', 1, 'craft', '#a8643c'], ['antenna', 'Antenna', 'indus', 3, 'salv', '#9aa0a6'],
  // rare salvage (never renewable)
  ['arc_alloy', 'Arc alloy', 'rare', 3, 'salv', '#8ad0e0'], ['solar_cell', 'Solar cell', 'rare', 3, 'salv', '#3a5aa8'], ['shielding', 'Rust shielding', 'rare', 4, 'salv', '#c0a050'],
  ['med_parts', 'Medical components', 'rare', 3, 'salv', '#e0e8f0'],
  // food
  ['berries', 'Wild berries', 'food', 1, 'ren', '#a83a5a'], ['mushroom', 'Mushrooms', 'food', 1, 'ren', '#c8a888'], ['roots', 'Roots', 'food', 1, 'ren', '#a8784a'],
  ['nuts', 'Nuts', 'food', 1, 'ren', '#9a6a3a'], ['greens', 'Edible greens', 'food', 1, 'ren', '#6aa04a'],
  ['potato', 'Potatoes', 'food', 2, 'ren', '#c8a868'], ['corn', 'Corn', 'food', 2, 'ren', '#e8c840'], ['beans', 'Beans', 'food', 2, 'ren', '#7a5a3a'], ['wheat', 'Wheat', 'food', 2, 'ren', '#d8b860'],
  ['squash', 'Squash', 'food', 2, 'ren', '#e08a3a'], ['carrot', 'Carrots', 'food', 2, 'ren', '#e0702a'],
  ['meat', 'Raw meat', 'food', 1, 'ren', '#c0634a'], ['fish', 'River fish', 'food', 1, 'ren', '#8aa0a8'], ['lake_fish', 'Lake fish', 'food', 1, 'ren', '#7a9aa8'], ['shellfish', 'Shellfish', 'food', 1, 'ren', '#b89a8a'],
  ['salt', 'Salt', 'food', 2, 'salv', '#f0f0f0'], ['herb', 'Herbs', 'food', 1, 'ren', '#5a9a5a'], ['flour', 'Flour', 'food', 2, 'craft', '#f0e8d8'], ['oil', 'Cooking oil', 'food', 2, 'craft', '#d8c050'], ['honey', 'Honey', 'food', 2, 'ren', '#e0a020'],
  ['ration', 'Cooked meat', 'food', 1, 'craft', '#a8552e'], ['cooked_fish', 'Cooked fish', 'food', 1, 'craft', '#c08a5a'], ['dried_meat', 'Dried meat', 'food', 1, 'craft', '#7a3a22'],
  ['smoked_fish', 'Smoked fish', 'food', 2, 'craft', '#9a6a3a'], ['canned', 'Canned ration', 'food', 1, 'salv', '#8a9098'], ['arc_pack', 'Arc food pack', 'food', 1, 'salv', '#c8d0d8'],
  ['stew', 'Vegetable stew', 'food', 1, 'craft', '#9a6a2a'], ['fish_soup', 'Fish soup', 'food', 1, 'craft', '#c8b080'], ['roast', 'Roasted meat', 'food', 2, 'craft', '#8a3a1a'], ['bread', 'Bread', 'food', 2, 'craft', '#d8a860'],
  // water
  ['water_dirty', 'Dirty water', 'water', 1, 'ren', '#6a7a5a'], ['water_boiled', 'Boiled water', 'water', 1, 'craft', '#9ad0e0'], ['water_filtered', 'Filtered water', 'water', 2, 'craft', '#b0e0f0'], ['water_rain', 'Rainwater', 'water', 2, 'ren', '#a0c8e8'],
  // medicine
  ['herb_med', 'Medicinal herbs', 'med', 1, 'ren', '#3a8a5a'], ['bandage', 'Bandage', 'med', 1, 'salv', '#f0ece0'], ['herb_bandage', 'Herbal bandage', 'med', 1, 'craft', '#c8d8a8'],
  ['splint', 'Splint', 'med', 1, 'craft', '#b8946a'], ['poultice', 'Herbal poultice', 'med', 1, 'craft', '#6a9a4a'], ['disinfect', 'Disinfectant', 'med', 1, 'salv', '#c0e0f0'],
  ['painkiller', 'Painkillers', 'med', 1, 'salv', '#f0f0f0'], ['antibiotic', 'Antibiotics', 'med', 1, 'salv', '#e8e0f0'], ['sutures', 'Surgical thread', 'med', 2, 'salv', '#d0d0e0'],
  ['alcohol', 'Medical alcohol', 'med', 2, 'salv', '#e0f0f8'], ['purify_tab', 'Purification tablets', 'med', 1, 'salv', '#f8f8f8'], ['medkit', 'Medical kit', 'med', 2, 'craft', '#d84a3a'],
  ['iv', 'IV supplies', 'med', 3, 'salv', '#e0e8f0'], ['blood_bag', 'Blood bag', 'med', 4, 'salv', '#a02a2a'], ['rust_med', 'Rust medicine', 'med', 4, 'salv', '#c8a050'],
  ['lab_sample', 'Laboratory sample', 'med', 4, 'salv', '#8ad0a0'], ['blood_kit', 'Blood-testing kit', 'med', 4, 'salv', '#c0c8d0'], ['inject', 'Protective injection', 'med', 4, 'salv', '#a0d0e0'],
  // story items (questlines only; introduced gradually)
  ['wristband', 'Arc wristband', 'story', 1, 'story', '#8ad0e0'], ['id_chip', 'Arc ID chip', 'story', 3, 'story', '#6ab0c0'], ['nav_console', 'Dropship nav console', 'story', 1, 'story', '#5a7a8a'],
  ['insignia', 'Clan insignia', 'story', 2, 'story', '#b05a3a'], ['war_paint', 'War paint', 'story', 2, 'story', '#2a2a2a'], ['ember', 'The Ember', 'story', 5, 'story', '#ff8a3a'],
  ['blackvein', 'Black-vein sample', 'story', 4, 'story', '#1a1a1a'], ['greyhold_card', 'Greyhold access card', 'story', 4, 'story', '#d8d8d8'], ['greyhold_files', 'Greyhold medical files', 'story', 4, 'story', '#c8c0a8'],
  ['halcyon_chip', 'HALCYON chip', 'story', 5, 'story', '#5ab0ff'], ['arden_notes', "Dr. Arden's notebook", 'story', 5, 'story', '#7a5a3a'], ['sunfall_data', 'Sunfall warning data', 'story', 5, 'story', '#e8a040'],
  ['lantern_key', 'Lantern vault key', 'story', 5, 'story', '#c0a050'], ['meridian_gear', 'Meridian equipment', 'story', 6, 'story', '#9aa0b0'], ['spindle', 'Mind spindle', 'story', 6, 'story', '#b0a0e0'], ['gate_codes', 'Gate Stone codes', 'story', 6, 'story', '#a080c0'],
];
const ITEMS = {}; for (const [id, n, c, t, src, col] of ITEM_DEFS) ITEMS[id] = { id, n, c, t, src, col };

/* tools, weapons, wear: individual pieces with durability + quality */
const QUAL = [{ n: 'Crude', k: .7 }, { n: 'Standard', k: 1 }, { n: 'Fine', k: 1.4 }];
const GEAR_DEFS = {
  // primitive tools
  stone_axe: { n: 'Stone axe', kind: 'axe', pw: 1, dur: 40, t: 1 }, stone_pick: { n: 'Stone pickaxe', kind: 'pick', pw: 1, dur: 40, t: 1 },
  flint_knife: { n: 'Flint knife', kind: 'knife', pw: 1, dur: 35, t: 1 }, bone_knife: { n: 'Bone knife', kind: 'knife', pw: 1, dur: 25, t: 1 },
  wood_shovel: { n: 'Wooden shovel', kind: 'shovel', pw: 1, dur: 30, t: 1 }, fish_spear: { n: 'Fishing spear', kind: 'fish', pw: 1, dur: 25, t: 1 },
  fish_rod: { n: 'Fishing rod', kind: 'fish', pw: 2, dur: 60, t: 1 }, hand_saw: { n: 'Hand saw', kind: 'saw', pw: 1, dur: 80, t: 2 },
  torch_t: { n: 'Torch', kind: 'light', pw: 1, dur: 20, t: 1 }, fire_starter: { n: 'Flint fire starter', kind: 'fire', pw: 1, dur: 30, t: 1 },
  wood_hammer: { n: 'Wooden hammer', kind: 'hammer', pw: 1, dur: 40, t: 1 }, needle: { n: 'Sewing needle', kind: 'needle', pw: 1, dur: 30, t: 1 },
  // salvaged tools (found, never crafted in tier 1; last far longer)
  metal_axe: { n: 'Metal axe', kind: 'axe', pw: 2, dur: 160, t: 3, salv: 1 }, pickaxe: { n: 'Pickaxe', kind: 'pick', pw: 2, dur: 160, t: 3, salv: 1 },
  crowbar: { n: 'Crowbar', kind: 'pry', pw: 2, dur: 200, t: 3, salv: 1 }, wrench: { n: 'Wrench', kind: 'wrench', pw: 2, dur: 200, t: 3, salv: 1 },
  screwdriver: { n: 'Screwdriver', kind: 'driver', pw: 2, dur: 150, t: 3, salv: 1 }, bolt_cutters: { n: 'Bolt cutters', kind: 'cutter', pw: 2, dur: 120, t: 3, salv: 1 },
  pliers: { n: 'Pliers', kind: 'pliers', pw: 2, dur: 150, t: 3, salv: 1 }, welder: { n: 'Welding kit', kind: 'weld', pw: 2, dur: 80, t: 3, salv: 1 },
  wire_cutters: { n: 'Wire cutters', kind: 'cutter', pw: 1, dur: 120, t: 3, salv: 1 }, flashlight: { n: 'Flashlight', kind: 'light', pw: 2, dur: 150, t: 3, salv: 1 },
  radio: { n: 'Portable radio', kind: 'radio', pw: 2, dur: 200, t: 3, salv: 1 }, multitool: { n: 'Multitool', kind: 'knife', pw: 2, dur: 140, t: 3, salv: 1 },
  hunting_knife: { n: 'Hunting knife', kind: 'knife', pw: 2, dur: 120, t: 2, salv: 1 },
  // advanced equipment
  rust_detector: { n: 'Rust detector', kind: 'detector', pw: 3, dur: 300, t: 4, salv: 1 }, med_scanner: { n: 'Medical scanner', kind: 'scanner', pw: 3, dur: 200, t: 4, salv: 1 },
  lock_bypass: { n: 'Electronic lock bypass', kind: 'bypass', pw: 3, dur: 30, t: 4, salv: 1 }, solar_charger: { n: 'Portable solar charger', kind: 'charger', pw: 3, dur: 400, t: 3 },
  transmitter: { n: 'Signal transmitter', kind: 'radio', pw: 3, dur: 300, t: 4, salv: 1 }, repair_drone: { n: 'Repair drone', kind: 'drone', pw: 3, dur: 200, t: 5, salv: 1 },
  nvg: { n: 'Night-vision goggles', kind: 'nvg', pw: 3, dur: 300, t: 4, salv: 1 }, breather: { n: 'Breathing apparatus', kind: 'breather', pw: 3, dur: 120, t: 4, salv: 1 },
  diag_pc: { n: 'Diagnostic computer', kind: 'diag', pw: 3, dur: 400, t: 4, salv: 1 },
  // wear (body slot; protection 0–1 · fog = Rust resistance)
  wraps: { n: 'Cloth wraps', kind: 'wear', pw: 0, dur: 30, t: 1, prot: .06 }, hide_coat: { n: 'Hide coat', kind: 'wear', pw: 0, dur: 60, t: 1, prot: .12 },
  leather_armor: { n: 'Leather armor', kind: 'wear', pw: 0, dur: 90, t: 2, prot: .22 }, metal_chest: { n: 'Metal chest armor', kind: 'wear', pw: 0, dur: 140, t: 2, prot: .36 },
  arc_jumpsuit: { n: 'Arc jumpsuit', kind: 'wear', pw: 0, dur: 80, t: 3, prot: .08, salv: 1 }, tac_armor: { n: 'Tactical armor', kind: 'wear', pw: 0, dur: 200, t: 3, prot: .42, salv: 1 },
  hazmat: { n: 'Hazmat suit', kind: 'wear', pw: 0, dur: 100, t: 4, prot: .1, fog: .7, salv: 1 }, rust_suit: { n: 'Rust suit', kind: 'wear', pw: 0, dur: 160, t: 4, prot: .2, fog: .95 },
};
const gearDef = id => GEAR_DEFS[id];

/* station: where a recipe can be made · tool: a tool kind you must carry (used once) */
const RECIPES = [
  // survival & tools
  { o: 'rope', n: 1, i: { fiber: 4 }, cat: 'surv', t: 1 },
  { o: 'stone_axe', i: { stick: 1, stone: 2, fiber: 2 }, cat: 'surv', t: 1 },
  { o: 'stone_pick', i: { stick: 2, stone: 3, rope: 1 }, cat: 'surv', t: 1 },
  { o: 'flint_knife', i: { flint: 2, cloth: 1 }, cat: 'surv', t: 1 },
  { o: 'bone_knife', i: { bone: 2, sinew: 1 }, cat: 'surv', t: 1 },
  { o: 'wood_shovel', i: { stick: 2, bark: 2, rope: 1 }, cat: 'surv', t: 1 },
  { o: 'fish_spear', i: { stick: 2, flint: 1, fiber: 1 }, cat: 'surv', t: 1 },
  { o: 'hook', n: 2, i: { bone: 1 }, cat: 'surv', t: 1, tool: 'knife' },
  { o: 'fish_rod', i: { stick: 2, fiber: 2, hook: 1 }, cat: 'surv', t: 1 },
  { o: 'needle', i: { bone: 1 }, cat: 'surv', t: 1, tool: 'knife' },
  { o: 'pot', i: { clay: 3 }, cat: 'surv', t: 1, at: 'fire' },
  { o: 'charcoal', n: 2, i: { log: 1 }, cat: 'surv', t: 1, at: 'fire' },
  { o: 'hide_coat', i: { hide: 3, sinew: 2 }, cat: 'surv', t: 1, tool: 'needle' },
  { o: 'torch_t', i: { stick: 1, cloth: 1, fat: 1 }, cat: 'surv', t: 1, soon: 1 },
  { o: 'water_filter', i: { charcoal: 2, cloth: 1, pot: 1 }, cat: 'surv', t: 2, soon: 1 },
  { o: 'canteen', i: { leather: 2, fiber: 1 }, cat: 'surv', t: 2, soon: 1 },
  { o: 'backpack', i: { cloth: 4, leather: 2, fiber: 2 }, cat: 'surv', t: 2, soon: 1 },
  // food & medicine
  { o: 'ration', i: { meat: 1 }, cat: 'food', t: 1, at: 'fire' },
  { o: 'cooked_fish', i: { fish: 1 }, cat: 'food', t: 1, at: 'fire', alt: { lake_fish: 1 } },
  { o: 'water_boiled', i: { water_dirty: 1 }, cat: 'food', t: 1, at: 'fire' },
  { o: 'stew', i: { veg: 2, water_boiled: 1 }, cat: 'food', t: 1, at: 'fire' },
  { o: 'fish_soup', i: { fish: 1, herb: 1, water_boiled: 1 }, cat: 'food', t: 1, at: 'fire', alt: { lake_fish: 1 } },
  { o: 'dried_meat', n: 2, i: { meat: 2 }, cat: 'food', t: 1, at: 'rack' },
  { o: 'herb_bandage', i: { cloth: 1, herb_med: 2 }, cat: 'food', t: 1 },
  { o: 'poultice', i: { herb_med: 2, fat: 1 }, cat: 'food', t: 1 },
  { o: 'splint', i: { stick: 2, cloth: 2 }, cat: 'food', t: 1 },
  { o: 'medkit', i: { herb_bandage: 2, disinfect: 1, painkiller: 1 }, cat: 'food', t: 2 },
  { o: 'purify_kit', i: { water_filter: 1, pot: 1 }, cat: 'food', t: 2, soon: 1 },
  // weapons & armor
  { o: 'leather', i: { hide: 1, fat: 1 }, cat: 'war', t: 2, at: 'rack' },
  { o: 'leather_armor', i: { leather: 6, cloth: 3, fiber: 2 }, cat: 'war', t: 2, tool: 'needle' },
  { o: 'metal_chest', i: { scrap: 5, leather: 3, fasteners: 2 }, cat: 'war', t: 2, at: 'bench' },
  { o: 'hunt_spear', i: { stick: 2, sharp_rock: 1, rope: 1 }, cat: 'war', t: 2, soon: 1 },
  { o: 'bow', i: { hardwood: 2, sinew: 2 }, cat: 'war', t: 2, soon: 1 },
  { o: 'arrows', n: 5, i: { stick: 5, feather: 5, sharp_rock: 5 }, cat: 'war', t: 2, soon: 1 },
  { o: 'shield', i: { plank: 4, scrap: 3, leather: 2 }, cat: 'war', t: 2, soon: 1 },
  { o: 'repair_kit', i: { scrap: 2, spare_parts: 1, tool_kit: 1 }, cat: 'war', t: 3, soon: 1 },
  // base building & technology
  { o: 'campfire', i: { stone: 6, stick: 5 }, cat: 'base', t: 1 },
  { o: 'drying_rack', i: { stick: 6, rope: 2 }, cat: 'base', t: 1 },
  { o: 'plank', n: 2, i: { log: 1 }, cat: 'base', t: 2, at: 'bench', tool: 'saw' },
  { o: 'wood_wall', i: { log: 6, rope: 2 }, cat: 'base', t: 2, soon: 1 },
  { o: 'storage', i: { plank: 5, nails: 4 }, cat: 'base', t: 2, soon: 1 },
  { o: 'rain_coll', i: { scrap: 4, cloth: 2, pot: 1 }, cat: 'base', t: 2, soon: 1 },
  { o: 'cook_station', i: { stone: 8, scrap: 3 }, cat: 'base', t: 2, soon: 1 },
  { o: 'workbench', i: { plank: 6, scrap: 4, tool_kit: 1 }, cat: 'base', t: 3, soon: 1 },
  { o: 'radio_st', i: { circuit: 2, wire: 4, battery: 1, antenna: 1 }, cat: 'base', t: 3, soon: 1 },
  { o: 'solar_charger', i: { solar_cell: 2, wire: 2, circuit: 1 }, cat: 'base', t: 3, soon: 1 },
  { o: 'rust_detector', i: { sensor: 1, circuit: 1, battery: 1 }, cat: 'base', t: 4, soon: 1 },
  { o: 'greenhouse', i: { plank: 4, soil: 3, cloth: 2 }, cat: 'base', t: 3, soon: 1 },
  { o: 'med_station', i: { scrap: 4, medkit: 2 }, cat: 'base', t: 3, soon: 1 },
];
// names for outputs that aren't inventory items (placeables, future gear)
const EXTRA_NAMES = { campfire: 'Campfire', drying_rack: 'Drying rack', water_filter: 'Water filter', canteen: 'Water canteen', backpack: 'Basic backpack', purify_kit: 'Water purification kit',
  hunt_spear: 'Hunting spear', bow: 'Improvised bow', arrows: 'Arrows', shield: 'Reinforced shield', repair_kit: 'Weapon repair kit', wood_wall: 'Wooden wall', storage: 'Storage crate',
  rain_coll: 'Rain collector', cook_station: 'Cooking station', workbench: 'Workbench', radio_st: 'Radio station', greenhouse: 'Greenhouse plot', med_station: 'Medical station', soil: 'Soil' };
const VEG = ['roots', 'greens', 'mushroom', 'potato', 'carrot', 'squash', 'corn', 'beans'];
const PLACEABLE = { campfire: 1, drying_rack: 1 };
const RCATS = [['surv', 'Survival & tools'], ['food', 'Food & medicine'], ['war', 'Weapons & armor'], ['base', 'Base building']];
const nameOf = id => ITEMS[id]?.n || GEAR_DEFS[id]?.n || EXTRA_NAMES[id] || id;

/* ---------- counts (scrap / raw meat / cooked meat keep their old INV slots so the story + upgrades still work) ---------- */
const LINK = { scrap: 'scrap', meat: 'meat', ration: 'rations' };
function invInit() { INV.items = INV.items && typeof INV.items === 'object' ? INV.items : {}; INV.tools = Array.isArray(INV.tools) ? INV.tools : []; }
function cnt(id) {
  if (id === 'veg') return VEG.reduce((a, v) => a + cnt(v), 0);
  const k = LINK[id]; if (k) return INV[k] || 0;
  if (GEAR_DEFS[id]) return INV.tools.filter(t => t.id === id).length;
  return INV.items[id] || 0;
}
function give(id, n = 1, q) {
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) newGear(id, q); return; }
  const k = LINK[id]; if (k) { INV[k] = Math.max(0, (INV[k] || 0) + n); return; }
  const v = (INV.items[id] || 0) + n; if (v > 0) INV.items[id] = v; else delete INV.items[id];
}
function take(id, n) {
  if (id === 'veg') { for (const v of VEG) { const m = Math.min(n, cnt(v)); if (m) { take(v, m); n -= m; } if (!n) break; } return; }
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) { const j = INV.tools.findIndex(t => t.id === id && !t.on); if (j >= 0) INV.tools.splice(j, 1); } return; }
  give(id, -n);
}
function newGear(id, q, wear = 0) {
  const D = GEAR_DEFS[id]; if (q == null) { const r = rnd(); q = r < .22 ? 0 : r < .85 ? 1 : 2; }
  const max = Math.round(D.dur * QUAL[q].k), g = { id, q, max, d: Math.max(1, Math.round(max * (1 - wear))) };
  INV.tools.push(g);
  if (D.kind === 'wear' && !INV.tools.some(t => t.on)) g.on = true;
  return g;
}
const bestTool = kind => { let b = null; for (const t of INV.tools) { const D = GEAR_DEFS[t.id]; if (D.kind !== kind) continue; if (!b || D.pw > GEAR_DEFS[b.id].pw || (D.pw === GEAR_DEFS[b.id].pw && t.d > b.d)) b = t; } return b; };
let lastTool = null;
function wearTool(t, n = 1) {
  if (!t) return; t.d -= n; lastTool = t;
  if (t.d <= 0) { INV.tools.splice(INV.tools.indexOf(t), 1); sfx('no'); toast(`${QUAL[t.q].n} ${GEAR_DEFS[t.id].n.toLowerCase()} broke`, 2.6); if (lastTool === t) lastTool = null; }
}
const worn = () => INV.tools.find(t => t.on && GEAR_DEFS[t.id].kind === 'wear');

/* ---------- stations: the camp fire, bench and smokehouse, plus anything you've placed ---------- */
const PLACED = [];
function nearStation(kind) {
  const fixed = { fire: [SPOTS.fire, 4.2], bench: [SPOTS.bench, 4.2], rack: [SPOTS.smoke, 4.6] }[kind];
  if (fixed && Math.hypot(P.x - fixed[0].x, P.z - fixed[0].z) < fixed[1]) return true;
  const pk = kind === 'fire' ? 'campfire' : kind === 'rack' ? 'drying_rack' : null;
  return !!pk && PLACED.some(p => p.k === pk && Math.hypot(P.x - p.x, P.z - p.z) < 3.4);
}
const STATION_N = { fire: 'Fire', bench: 'Workbench', rack: 'Drying rack' };
function buildPlaced(p) {
  const g = new THREE.Group(); g.position.set(p.x, heightAt(p.x, p.z), p.z); g.rotation.y = p.yaw || 0;
  if (p.k === 'campfire') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; mesh(new THREE.DodecahedronGeometry(.22, 0), M(0x8a8780), Math.cos(a) * .6, .1, Math.sin(a) * .6, g); }
    for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(.07, .08, .9, 5), M(0x5a3a22), 0, .2, 0, g); l.rotation.set(1.2, i * 2.1, 0); }
    const fl = mesh(new THREE.ConeGeometry(.3, .8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 }), 0, .55, 0, g);
    DECOR_ANIM.push(t => { fl.scale.set(1 + Math.sin(t * 13 + p.x) * .12, 1 + Math.sin(t * 9 + p.z) * .22, 1); fl.material.color.setHSL(.07 + Math.sin(t * 7) * .015, 1, .55); });
  } else {
    for (const x of [-.9, .9]) mesh(new THREE.CylinderGeometry(.05, .06, 1.7, 5), M(0x6a4a30), x, .85, 0, g);
    const bar = mesh(new THREE.CylinderGeometry(.04, .04, 2, 5), M(0x6a4a30), 0, 1.6, 0, g); bar.rotation.z = Math.PI / 2;
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.12, .45, .03), M(0x8a3a24), -.6 + i * .3, 1.32, 0, g);
  }
  world.add(g); p.g = g; addCol(p.x, p.z, .55); PLACED.push(p);
}
function placeKit(k) {
  if (cnt(k) <= 0) return;
  if (Math.hypot(P.x, P.z) < 8) { sfx('no'); toast('Too close to the wreck — place it somewhere open'); return; }
  const x = P.x - Math.sin(P.yaw) * 2.2, z = P.z - Math.cos(P.yaw) * 2.2;
  if (waterAt(x, z) > heightAt(x, z) - .3) { sfx('no'); toast("Can't build in water"); return; }
  take(k, 1); const p = { k, x, z, yaw: P.yaw }; buildPlaced(p);
  (G.flags.placed ||= []).push({ k, x: +x.toFixed(1), z: +z.toFixed(1), yaw: +P.yaw.toFixed(2) });
  sfx('buy'); toast(`${nameOf(k)} built`); save(); if (invOpen) renderInv();
}
function restorePlaced() { for (const p of PLACED) world.remove(p.g); PLACED.length = 0; for (const p of G.flags.placed || []) buildPlaced({ ...p }); }

/* ---------- crafting ---------- */
const tierOpen = t => t <= 1 || (t === 2 && G.chapterDone);
function recipeState(r) {
  const ins = Object.entries(r.alt && cnt(Object.keys(r.i)[0]) < r.i[Object.keys(r.i)[0]] && Object.entries(r.alt).every(([k, n]) => cnt(k) >= n) ? { ...Object.fromEntries(Object.entries(r.i).slice(1)), ...r.alt } : r.i);
  const miss = ins.some(([k, n]) => cnt(k) < n), stOK = !r.at || nearStation(r.at), toolOK = !r.tool || !!bestTool(r.tool);
  return { ins, miss, stOK, toolOK, open: tierOpen(r.t) && !r.soon, ok: tierOpen(r.t) && !r.soon && !miss && stOK && toolOK };
}
function craft(r) {
  const s = recipeState(r);
  if (!s.open) { sfx('no'); return; }
  if (s.miss) { sfx('no'); toast('Missing materials'); return; }
  if (!s.stOK) { sfx('no'); toast(`Needs a ${STATION_N[r.at].toLowerCase()}`); return; }
  if (!s.toolOK) { sfx('no'); toast(`Needs a ${r.tool}`); return; }
  for (const [k, n] of s.ins) take(k, n);
  if (r.tool) wearTool(bestTool(r.tool));
  if (GEAR_DEFS[r.o]) {
    // a proper bench and an engineer's hands make better tools
    let q = null; if (nearStation('bench')) { const x = rnd(); q = x < .08 ? 0 : x < .7 ? 1 : 2; }
    const g = newGear(r.o, q); toast(`${QUAL[g.q].n} ${GEAR_DEFS[r.o].n.toLowerCase()} · ${g.max} uses`, 2.6);
  } else { give(r.o, r.n || 1); toast(`+${r.n || 1} ${nameOf(r.o)}`, 1.8); }
  sfx(r.at === 'fire' ? 'eat' : 'buy');
  if (r.o === 'ration' && G.step === 7) eat();
  save(); renderInv();
}

/* ---------- food: variety matters, raw/dirty things can make you sick ---------- */
const FOOD = {
  ration: { f: 0, h: 0, k: 'meat', ration: 1 }, dried_meat: { f: 42, h: 10, k: 'meat' }, roast: { f: 55, h: 14, k: 'meat' }, meat: { f: 14, h: 0, k: 'meat', risk: .45 },
  cooked_fish: { f: 32, h: 10, k: 'fish' }, smoked_fish: { f: 38, h: 10, k: 'fish' }, fish: { f: 10, h: 0, k: 'fish', risk: .4 }, lake_fish: { f: 10, h: 0, k: 'fish', risk: .4 }, shellfish: { f: 12, h: 2, k: 'fish', risk: .25 },
  berries: { f: 8, h: 2, k: 'plant' }, nuts: { f: 12, h: 2, k: 'plant' }, greens: { f: 7, h: 3, k: 'plant' }, roots: { f: 10, h: 1, k: 'plant', risk: .08 }, mushroom: { f: 9, h: 0, k: 'plant', risk: .22 },
  potato: { f: 14, h: 2, k: 'plant' }, carrot: { f: 9, h: 3, k: 'plant' }, honey: { f: 15, h: 6, k: 'plant' },
  stew: { f: 46, h: 22, k: 'meal' }, fish_soup: { f: 52, h: 24, k: 'meal' }, bread: { f: 30, h: 6, k: 'meal' }, canned: { f: 40, h: 8, k: 'meal' }, arc_pack: { f: 35, h: 10, k: 'meal' },
  water_dirty: { f: 2, h: 0, k: 'water', risk: .35 }, water_boiled: { f: 3, h: 5, k: 'water' }, water_filtered: { f: 3, h: 6, k: 'water' }, water_rain: { f: 3, h: 4, k: 'water' },
};
const DIET_N = 6;
function eatItem(id, quiet) {
  const F = FOOD[id]; if (!F || cnt(id) <= 0) return false;
  if (P.food >= 99 && F.k !== 'water' && !quiet) { toast('Not hungry'); return false; }
  take(id, 1);
  let [f, h] = F.ration ? RATION() : [F.f, F.h];
  P.diet = P.diet || [];
  const same = P.diet.filter(k => k === F.k).length, mult = F.k === 'water' ? 1 : Math.max(.45, 1 - same * .16);
  f = Math.round(f * mult);
  P.diet.push(F.k); if (P.diet.length > DIET_N) P.diet.shift();
  P.food = Math.min(100, P.food + f); P.hp = Math.min(100, P.hp + h);
  const hasP = P.diet.some(k => k === 'meat' || k === 'fish'), hasV = P.diet.some(k => k === 'plant' || k === 'meal'), hasW = P.diet.includes('water');
  let note = `+${f} food`;
  if (mult < .8) note += ' · same food again, less filling';
  if (hasP && hasV && hasW && !(P.fed > 0)) { P.fed = 240; note += ' · well fed'; }
  if (F.risk && rnd() < F.risk) { P.sick = Math.max(P.sick || 0, 70); note = 'That was bad. You feel sick.'; sfx('cough'); }
  else sfx('eat');
  toast(note, 2.2);
  if (id === 'ration') eat();
  return true;
}
function eatBest() {
  const have = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water' && !FOOD[id].risk);
  if (!have.length) { const raw = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water'); if (!raw.length) { sfx('no'); toast('Nothing to eat — hunt, forage or cook'); return; } toast('Only raw food left — cook it at a fire first', 2.4); return; }
  // pick what the diet is missing most, then the most filling
  const seen = k => (P.diet || []).filter(x => x === k).length;
  have.sort((a, b) => seen(FOOD[a].k) - seen(FOOD[b].k) || (FOOD[b].f || 40) - (FOOD[a].f || 40));
  eatItem(have[0]);
}
const foodCount = () => Object.keys(FOOD).reduce((a, id) => a + (FOOD[id].k !== 'water' && !FOOD[id].risk ? cnt(id) : 0), 0);

/* ---------- injuries: bleeding, fractures, sickness — each wants a different fix ---------- */
const MEDS = {
  herb_bandage: { h: 15, fix: ['bleed'] }, bandage: { h: 20, fix: ['bleed'] }, splint: { h: 0, fix: ['frac'] }, poultice: { h: 5, fix: ['sick'] },
  antibiotic: { h: 5, fix: ['sick'] }, painkiller: { h: 25, fix: [] }, medkit: { h: 60, fix: ['bleed', 'sick', 'frac'] }, purify_tab: { h: 0, fix: [] },
};
function useMed(id) {
  const M0 = MEDS[id]; if (!M0 || cnt(id) <= 0) return false;
  const fixes = M0.fix.filter(k => P[k] > 0);
  if (!fixes.length && P.hp >= 99) { toast("You don't need that right now"); return false; }
  take(id, 1); for (const k of fixes) P[k] = 0; P.hp = Math.min(100, P.hp + M0.h);
  sfx('pickup'); toast([M0.h ? `+${M0.h} health` : '', fixes.map(k => ({ bleed: 'bleeding stopped', frac: 'leg splinted', sick: 'fever breaking' })[k]).join(' · ')].filter(Boolean).join(' · '), 2.4);
  return true;
}
function healBest() {
  const want = ['bleed', 'frac', 'sick'].filter(k => P[k] > 0);
  const ids = Object.keys(MEDS).filter(id => cnt(id) > 0);
  let pickId = null;
  for (const w of want) { pickId = ids.filter(id => MEDS[id].fix.includes(w)).sort((a, b) => MEDS[a].fix.length - MEDS[b].fix.length)[0]; if (pickId) break; }
  if (!pickId && P.hp < 85) pickId = ids.filter(id => MEDS[id].h > 0).sort((a, b) => MEDS[a].h - MEDS[b].h)[0];
  if (!pickId) { sfx('no'); toast(want.length ? `Nothing here treats ${want[0] === 'frac' ? 'a fracture — make a splint' : want[0] === 'bleed' ? 'bleeding — make a herbal bandage' : 'sickness — make a poultice'}` : 'Nothing to treat'); return; }
  useMed(pickId);
}
const medCount = () => Object.keys(MEDS).reduce((a, id) => a + cnt(id), 0);
function clearInjuries() { P.bleed = 0; P.frac = 0; P.sick = 0; }
function onHurt(n, melee) {
  const w = worn();
  if (w) { const D = GEAR_DEFS[w.id]; n *= 1 - D.prot; wearTool(w, 1); }
  if (melee && rnd() < .22 + n / 120) { if (!(P.bleed > 0)) toast('You\'re bleeding — bandage it (slot 4)', 2.6); P.bleed = 45; }
  return n;
}
function onFall(dmg) { if (dmg >= 12 && !(P.frac > 0)) { P.frac = 1; toast('Something cracked. A splint will fix the leg (slot 4)', 3); } }
function updStatus(dt) {
  if (P.dead || cine) return;
  if (P.bleed > 0) { P.bleed -= dt; P.hp -= dt * .9; }
  if (P.sick > 0) { P.sick -= dt; P.food = Math.max(0, P.food - dt * .1); if (P.hp > 30) P.hp -= dt * .35; }
  if (P.fed > 0) { P.fed -= dt; if (P.hp < 100 && P.hurtT <= 0 && P.food > 45) P.hp = Math.min(100, P.hp + dt * .6); }
  if (P.hp <= 0) die();
}
const statusTags = () => [P.bleed > 0 && ['Bleeding', '#e0573d'], P.frac > 0 && ['Fractured leg', '#e0a040'], P.sick > 0 && ['Sick', '#a8c050'], P.fed > 0 && ['Well fed', '#7fc4b8']].filter(Boolean);

/* ---------- gathering: trees, rocks, undergrowth, water ---------- */
const RCELL = 6, RGRID = new Map(), RDEPL = new Map();
function addRes(kind, x, z, s = 1) { const k = gkey(Math.floor(x / RCELL), Math.floor(z / RCELL)); let L = RGRID.get(k); if (!L) RGRID.set(k, L = []); L.push({ kind, x, z, s, id: RGRID.size * 64 + L.length }); }
const NODE_USES = { fir: 4, alder: 4, snag: 3, boulder: 4, stone: 1, fern: 2 };
const NODE_REGROW = { fir: 420, alder: 420, snag: 600, boulder: 600, stone: 360, fern: 240 };
function nodeLeft(n) { const d = RDEPL.get(n); if (!d) return NODE_USES[n.kind]; if (G.t > d.at) { RDEPL.delete(n); return NODE_USES[n.kind]; } return NODE_USES[n.kind] - d.used; }
function useNode(n) { let d = RDEPL.get(n); if (!d || G.t > d.at) RDEPL.set(n, d = { used: 0, at: 0 }); d.used++; d.at = G.t + NODE_REGROW[n.kind]; }
function nearNode() {
  const ci = Math.floor(P.x / RCELL), cj = Math.floor(P.z / RCELL); let b = null, bd = 1e9;
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const n of RGRID.get(gkey(i, j)) || []) {
    const reach = n.kind === 'boulder' ? n.s * 1.1 + 1.4 : n.kind === 'fir' || n.kind === 'alder' || n.kind === 'snag' ? 1.9 : 1.6;
    const d = Math.hypot(n.x - P.x, n.z - P.z) - reach; if (d < 0 && d < bd && nodeLeft(n) > 0) { bd = d; b = n; }
  }
  return b;
}
function nearWater() {
  if (Math.abs(P.y - heightAt(P.x, P.z)) > 1.5 && !P.swim) return null;
  for (let a = 0; a < 6.28; a += .785) for (const r of [0, 1.6, 3]) { const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) + .15) return { x, z, lake: LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.R + 10) }; }
  return null;
}
const TREE_N = { fir: 'fir', alder: 'alder', snag: 'dead tree' };
function nodeAction(n) {
  if (n.kind in TREE_N) { const ax = bestTool('axe'); return ax ? { l: `Chop the ${TREE_N[n.kind]}`, t: 1.6 / GEAR_DEFS[ax.id].pw, fn: () => chop(n, ax) } : { l: n.kind === 'snag' ? 'Snap off dry branches' : 'Gather sticks', t: 1.1, fn: () => sticks(n) }; }
  if (n.kind === 'boulder') { const pk = bestTool('pick'); return pk ? { l: 'Mine the rock', t: 1.8 / GEAR_DEFS[pk.id].pw, fn: () => mine(n, pk) } : { l: 'Prise loose stones', t: 1.3, fn: () => looseStones(n) }; }
  if (n.kind === 'stone') return { l: 'Take the stone', t: .5, fn: () => { useNode(n); gain([['stone', 1], ['flint', rnd() < .25 ? 1 : 0], ['sharp_rock', rnd() < .2 ? 1 : 0]]); } };
  if (n.kind === 'fern') return { l: 'Forage the undergrowth', t: 1, fn: () => forage(n) };
}
function gain(list) {
  const got = list.filter(([, n]) => n > 0); for (const [id, n] of got) give(id, n);
  if (got.length) { sfx('pickup'); toast(got.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · '), 1.8); gatherHint(); }
}
function chop(n, ax) { useNode(n); const pw = GEAR_DEFS[ax.id].pw; wearTool(ax); sfx('thud'); gain([['log', pw + (rnd() < .4 ? 1 : 0)], ['stick', 1 + Math.floor(rnd() * 2)], ['bark', rnd() < .5 ? 1 : 0], ['hardwood', n.kind === 'alder' && rnd() < .55 ? 1 : 0]]); }
function sticks(n) { useNode(n); useNode(n); gain([['stick', 2 + Math.floor(rnd() * 2)], ['bark', rnd() < .3 ? 1 : 0], ['leaves', rnd() < .3 ? 1 : 0], ['branch', n.kind === 'snag' && rnd() < .4 ? 1 : 0]]); }
function mine(n, pk) { useNode(n); const pw = GEAR_DEFS[pk.id].pw; wearTool(pk); sfx('metal', .6); gain([['stone', 2 + pw], ['flint', rnd() < .35 + pw * .1 ? 1 : 0], ['limestone', rnd() < .25 ? 1 : 0], ['sharp_rock', rnd() < .3 ? 1 : 0]]); }
function looseStones(n) { useNode(n); useNode(n); gain([['stone', 1 + Math.floor(rnd() * 2)], ['flint', rnd() < .18 ? 1 : 0]]); }
function forage(n) {
  useNode(n); const kn = bestTool('knife'), sh = bestTool('shovel');
  const L = [['fiber', 2 + (kn ? 1 : 0)], ['vine', rnd() < .2 ? 1 : 0], ['berries', rnd() < .22 ? 1 + Math.floor(rnd() * 2) : 0], ['herb_med', rnd() < .18 ? 1 : 0], ['herb', rnd() < .14 ? 1 : 0],
    ['mushroom', rnd() < .14 ? 1 : 0], ['greens', rnd() < .16 ? 1 : 0], ['nuts', rnd() < .08 ? 1 : 0], ['roots', sh ? (rnd() < .6 ? 1 + Math.floor(rnd() * 2) : 0) : rnd() < .1 ? 1 : 0]];
  if (kn && rnd() < .5) wearTool(kn); if (sh && L[8][1]) wearTool(sh);
  gain(L);
}
function waterAction(w) {
  const fi = bestTool('fish'), sh = bestTool('shovel'), acts = [];
  if (cnt('pot') > 0) acts.push({ l: 'Fill the pot (dirty water)', t: 1, fn: () => gain([['water_dirty', 2]]) });
  if (fi) acts.push({ l: GEAR_DEFS[fi.id].kind === 'fish' && fi.id === 'fish_rod' ? 'Cast a line' : 'Spear fish', t: fi.id === 'fish_rod' ? 3.2 : 2.4, fn: () => {
    wearTool(fi); if (rnd() < (fi.id === 'fish_rod' ? .78 : .55)) gain([[w.lake ? 'lake_fish' : 'fish', 1], ['shellfish', rnd() < .1 ? 1 : 0]]); else { toast('Nothing bit', 1.4); sfx('splash'); } } });
  if (sh && !w.lake) acts.push({ l: 'Dig clay from the bank', t: 1.8, fn: () => { wearTool(sh); gain([['clay', 2 + Math.floor(rnd() * 2)]]); } });
  acts.push({ l: 'Cut reeds', t: .9, fn: () => gain([['reed', 1 + Math.floor(rnd() * 2)], ['fiber', 1], ['shellfish', rnd() < .08 ? 1 : 0]]) });
  return acts;
}
let gHinted = false;
function gatherHint() { if (gHinted || G.flags.craftHint) return; gHinted = true; G.flags.craftHint = 1; setTimeout(() => toast(isTouch ? 'Tap the bag → CRAFT to turn these into tools' : 'Press I → CRAFT to turn these into tools', 4.5), 1900); }

/* channelled actions: hold still, the bar fills, then it happens (moving away cancels) */
let chan = null;
function startChan(a) { if (chan || !a) return; chan = { ...a, t0: a.t, x: P.x, z: P.z }; sfx('swing'); }
function updChan(dt) {
  if (!chan) return;
  if (P.dead || cine || Math.hypot(P.x - chan.x, P.z - chan.z) > .9 || invOpen || shopOpen) { chan = null; return; }
  chan.t -= dt; if (Math.random() < dt * 2.5) sfx('swing');
  if (chan.t <= 0) { const f = chan.fn; chan = null; f(); if (invOpen) renderInv(); }
}
/* what the E key does out in the wilds, when nothing in INTERACT is closer */
let waterPick = 0;
function wildInteract() {
  if (chan) return { l: `${chan.l}…`, prog: 1 - chan.t / chan.t0, act: () => {} };
  const n = nearNode(); if (n) { const a = nodeAction(n); return a && { l: a.l, act: () => startChan(a) }; }
  const w = nearWater(); if (w) { const acts = waterAction(w); const a = acts[waterPick % acts.length]; return { l: a.l + (acts.length > 1 ? `  ·  ${isTouch ? 'hold' : 'Q'}: next` : ''), act: () => startChan(a), next: () => { waterPick++; }, multi: acts.length > 1 }; }
  return null;
}

/* butchering by-products: a knife gets you far more than meat */
function butcherYield(e) {
  const kn = bestTool('knife'), L = [['meat', e.type === 'boar' ? 2 : 1]];
  if (kn) { wearTool(kn); L.push(['hide', 1], ['bone', 1 + Math.floor(rnd() * 2)], ['fat', e.type === 'boar' ? 2 : 1], ['sinew', e.type === 'deer' ? 1 + Math.floor(rnd() * 2) : 1], ['teeth', e.type === 'boar' && rnd() < .5 ? 1 : 0]); }
  else L.push(['bone', rnd() < .5 ? 1 : 0]);
  return { L, kn };
}
/* salvage tables: ruins hold the things nobody can make any more */
const RUIN_AT = () => [[POI.halvard, 110], [POI.burn, 75], [POI.cinder, 130]];
function crateSalvage(c) {
  const ruin = RUIN_AT().some(([p, r]) => p && Math.hypot(c.x - p.x, c.z - p.z) < r), L = [];
  const roll = (id, p, a = 1, b = a) => { if (rnd() < p) L.push([id, a + Math.floor(rnd() * (b - a + 1))]); };
  roll('cloth', .55, 1, 3); roll('rope', .25); roll('nails', .35, 2, 5); roll('screws', .25, 2, 4); roll('wire', .3, 1, 2); roll('fasteners', .2, 1, 2);
  roll('bandage', .25); roll('painkiller', .15); roll('disinfect', .12); roll('antibiotic', .06); roll('canned', .2); roll('purify_tab', .1);
  if (ruin) { roll('circuit', .2); roll('battery', .22); roll('cu_wiring', .2); roll('sensor', .08); roll('fuse', .15); roll('arc_alloy', .07); roll('solar_cell', .05); roll('med_parts', .08); roll('spare_parts', .25); roll('tool_kit', .06); roll('pipe', .2); roll('rubber', .15); }
  const tools = [];
  if (rnd() < (ruin ? .16 : .07)) { const id = pick(['metal_axe', 'pickaxe', 'crowbar', 'wrench', 'hunting_knife', 'multitool', 'flashlight', 'pliers', 'screwdriver', 'hand_saw']); tools.push(newGear(id, pick([0, 1, 1, 2]), rr(.2, .65))); }
  for (const [id, n] of L) give(id, n);
  return [...L.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`), ...tools.map(t => `${GEAR_DEFS[t.id].n} (${Math.round(t.d / t.max * 100)}%)`)];
}
function clanDrop() { const L = []; if (rnd() < .3) L.push(['cloth', 1 + Math.floor(rnd() * 2)]); if (rnd() < .18) L.push(['bone', 1]); if (rnd() < .15) L.push(['feather', 2]); if (rnd() < .1) L.push(['rope', 1]); if (rnd() < .06) L.push(['herb_med', 1]); for (const [id, n] of L) give(id, n); return L; }

/* ---------- icons: one glyph per category, tinted per item ---------- */
const GLYPH = {
  wood: c => `<rect x="2" y="6" width="12" height="5" rx="2.5" fill="${c}" stroke="#000"/><circle cx="13" cy="8.5" r="2" fill="#d8b888" stroke="#000"/>`,
  stone: c => `<path d="M2 12l2-6 5-3 5 4 0 5z" fill="${c}" stroke="#000"/>`,
  fiber: c => `<path d="M8 14V5M8 14L4 4M8 14l4-10M8 14L2 8M8 14l6-6" stroke="${c}" stroke-width="1.6" fill="none"/>`,
  metal: c => `<path d="M2 5l6-3 6 3v6l-6 3-6-3z" fill="${c}" stroke="#000"/><path d="M2 5l6 3 6-3M8 8v6" stroke="#000" fill="none"/>`,
  animal: c => `<path d="M4 4a1.6 1.6 0 1 1 2 2l4 4a1.6 1.6 0 1 1 2 2 1.6 1.6 0 1 1-2-2L6 6a1.6 1.6 0 1 1-2-2z" fill="${c}" stroke="#000" stroke-width=".8"/>`,
  textile: c => `<path d="M3 3h10l-1 10H4z" fill="${c}" stroke="#000"/><path d="M5 6h6M5 9h6" stroke="#0006"/>`,
  elec: c => `<rect x="3" y="3" width="10" height="10" rx="1" fill="${c}" stroke="#000"/><path d="M6 6h4v4H6zM1 6h2M1 10h2M13 6h2M13 10h2" stroke="#000" fill="none"/>`,
  indus: c => `<circle cx="8" cy="8" r="5" fill="${c}" stroke="#000"/><circle cx="8" cy="8" r="2" fill="#0007"/>`,
  rare: c => `<path d="M8 1l5 5-5 9-5-9z" fill="${c}" stroke="#000"/><path d="M3 6h10" stroke="#fff6"/>`,
  food: c => `<path d="M3 9c0-4 4-7 8-6 3 1 3 5 0 7-2 2-5 3-7 2z" fill="${c}" stroke="#000"/>`,
  water: c => `<path d="M8 2C6 6 4 8 4 10.5a4 4 0 0 0 8 0C12 8 10 6 8 2z" fill="${c}" stroke="#000"/>`,
  med: c => `<rect x="2" y="3" width="12" height="10" rx="2" fill="${c}" stroke="#000"/><path d="M8 5v6M5 8h6" stroke="#c0302a" stroke-width="2"/>`,
  story: c => `<path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" fill="${c}" stroke="#000" stroke-width=".8"/>`,
  tool: c => `<path d="M3 14l7-7" stroke="#8a6a44" stroke-width="2"/><path d="M8 3l5 1 1 5-3-1-3 1z" fill="${c}" stroke="#000"/>`,
  wear: c => `<path d="M5 2h6l3 3-2 2v7H4V7L2 5z" fill="${c}" stroke="#000"/>`,
  build: c => `<path d="M2 8l6-5 6 5v6H2z" fill="${c}" stroke="#000"/><path d="M6 14v-4h4v4" stroke="#000" fill="none"/>`,
};
// painted item icons in assets/icons (cut from Bryce's icon sheet + pickup pack); anything missing falls back to a drawn glyph
const ICON_IDS = new Set('ammo_rifle ammo_hunt alcohol aluminum antenna antibiotic arc_alloy arc_jumpsuit arc_pack arden_notes arrows backpack bandage bark battery beans berries blackvein blood_bag blood_kit bolt_cutters bolts bone bone_knife bow branch bread breather campfire canned canteen canvas carrot charcoal circuit clay cloth cook_station cooked_fish copper corn crowbar cu_wiring diag_pc disinfect dried_meat ember fasteners fat feather fiber fire_starter fish fish_soup fish_spear flashlight flint flint_knife flour fuse gate_codes gears greenhouse greens greyhold_card greyhold_files halcyon_chip hardwood hazmat herb herb_bandage herb_med hide hide_coat honey hook hunt_spear hunting_knife id_chip inject insignia iron iv lab_sample lake_fish lantern_key leather leather_armor leaves limestone lock_bypass log meat med_parts med_scanner med_station medkit meridian_gear metal_axe metal_chest multitool mushroom nails nav_console nuts nvg oil painkiller pickaxe pipe plank pliers pot potato poultice purify_kit purify_tab radio radio_st rain_coll ration reed repair_drone repair_kit roast roots rope rubber rust_detector rust_med rust_suit salt scrap screwdriver screws sensor sharp_rock shellfish shielding sinew smoked_fish soil solar_cell solar_charger spare_parts spindle splint springs squash steel stew stick stone stone_axe stone_pick storage sunfall_data sutures synth tac_armor teeth thread tool_kit torch_t transmitter vine war_paint water_boiled water_dirty water_filter water_filtered water_rain welder wheat wire wire_cutters wood_hammer wood_wall wraps wrench wristband'.split(' '));
const ICON_TINT = { ration: 'sepia(.7) saturate(1.4) brightness(.72)', roast: 'sepia(.7) saturate(1.4) brightness(.65)', cooked_fish: 'sepia(.6) brightness(.85)', smoked_fish: 'sepia(.9) brightness(.7)',
  leather: 'brightness(.65) saturate(1.3)', hardwood: 'brightness(.75) saturate(1.2)', limestone: 'grayscale(1) brightness(1.1)', clay: 'saturate(1.6) hue-rotate(-10deg)', hook: 'brightness(1.05)', stone_pick: 'sepia(.4) brightness(.8)',
  flint_knife: 'grayscale(.8) brightness(.7)', bone_knife: 'sepia(.5) brightness(1.25)', water_dirty: 'sepia(.6) hue-rotate(40deg) brightness(.8)', herb_med: 'hue-rotate(15deg) saturate(1.2)', fish_soup: 'sepia(.3) brightness(1.15)' };
function icon(id) {
  if (ICON_IDS.has(id)) return `<img class="ic" src="assets/icons/${id}.png" alt="" draggable="false"${ICON_TINT[id] ? ` style="filter:${ICON_TINT[id]}"` : ''}>`;
  const I = ITEMS[id], D = GEAR_DEFS[id];
  const g = I ? GLYPH[I.c] || GLYPH.indus : D ? (D.kind === 'wear' ? GLYPH.wear : GLYPH.tool) : GLYPH.build;
  const col = I ? I.col : D ? (D.salv ? '#b8c0c6' : '#9a968e') : '#a07a4e';
  return `<svg viewBox="0 0 16 16">${g(col)}</svg>`;
}
const CAT_N = { wood: 'Wood', stone: 'Stone', fiber: 'Plant fibers', metal: 'Metals', animal: 'Animal', textile: 'Textiles', elec: 'Electronics', indus: 'Industrial', rare: 'Rare salvage', food: 'Food', water: 'Water', med: 'Medicine', story: 'Story' };
const SRC_N = { ren: 'Renewable', salv: 'Salvage only', craft: 'Crafted', story: 'Story item' };
