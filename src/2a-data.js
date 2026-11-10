
/* ================= the data: every item, tool, weapon, piece of wear, placeable and recipe =================
   The world's own setting: Arc folk, the Thornkin clans, Ironjaw scavengers, Greyhold, the Rust, the Ember,
   HALCYON, Dr. Sel Arden, Sunfall, the Lantern vault, Meridian, mind spindles and the Gate Stone.
   Tiers aren't chapters: each one opens when you find its key item out in the world (see TIER_KEYS). */

const TIERS = ['', 'The Landing', 'The Clans', 'The Arc Survivors', 'Greyhold', 'Sunfall', 'Beyond'];
const TIER_KEYS = { insignia: 2, id_chip: 3, greyhold_card: 4, arden_notes: 5, gate_codes: 6 };
const TIER_HOW = ['', '', 'Take a clan insignia from the Thornkin (holds, outposts, warriors)', 'Find an Arc ID chip (the Burn, Farlight, the city)',
  'Take a Greyhold access card (Greyhold Station, the Foundry)', "Open the Grey Door for Dr. Arden's notebook", 'Crack the Foundry strongroom for the Gate Stone codes'];

// [id, name, category, tier, source, weight]   source: ren = renewable · salv = only from ruins/crates/factions · craft · story
const ITEM_DEFS = [
  // wood
  ['stick', 'Sticks', 'wood', 1, 'ren', .3], ['branch', 'Branch', 'wood', 1, 'ren', .8], ['log', 'Log', 'wood', 1, 'ren', 3], ['plank', 'Plank', 'wood', 1, 'craft', 1.2],
  ['bark', 'Bark', 'wood', 1, 'ren', .3], ['hardwood', 'Hardwood', 'wood', 1, 'ren', 1.5],
  // stone + earth
  ['stone', 'Small stone', 'stone', 1, 'ren', .5], ['sharp_rock', 'Sharp rock', 'stone', 1, 'craft', .3], ['flint', 'Flint', 'stone', 1, 'ren', .3],
  ['limestone', 'Limestone', 'stone', 1, 'ren', .8], ['clay', 'Clay', 'stone', 1, 'ren', .8], ['charcoal', 'Charcoal', 'stone', 1, 'craft', .2],
  ['metal_ore', 'Metal ore', 'stone', 2, 'ren', 1.2], ['soil', 'Soil', 'stone', 1, 'ren', 1], ['ash', 'Ash', 'stone', 1, 'craft', .1], ['fertilizer', 'Fertilizer', 'stone', 2, 'craft', .5],
  // plant fibres
  ['fiber', 'Plant fiber', 'fiber', 1, 'ren', .1], ['vine', 'Vines', 'fiber', 1, 'ren', .2], ['reed', 'Reeds', 'fiber', 1, 'ren', .1], ['leaves', 'Leaves', 'fiber', 1, 'ren', .05],
  // metals
  ['scrap', 'Scrap metal', 'metal', 1, 'salv', .5], ['iron', 'Iron', 'metal', 3, 'craft', 1], ['steel', 'Steel', 'metal', 3, 'craft', 1], ['copper', 'Copper', 'metal', 2, 'salv', .6],
  ['aluminum', 'Aluminum', 'metal', 3, 'salv', .4], ['wire', 'Wire', 'metal', 1, 'salv', .2],
  // animal
  ['hide', 'Hide', 'animal', 1, 'ren', 1], ['leather', 'Leather', 'animal', 2, 'craft', .6], ['bone', 'Bone', 'animal', 1, 'ren', .3], ['sinew', 'Sinew', 'animal', 1, 'ren', .05],
  ['feather', 'Feathers', 'animal', 1, 'ren', .01], ['teeth', 'Teeth', 'animal', 1, 'ren', .05], ['fat', 'Animal fat', 'animal', 1, 'ren', .3],
  // textiles
  ['cloth', 'Cloth scraps', 'textile', 1, 'salv', .1], ['rope', 'Rope', 'textile', 1, 'craft', .3], ['thread', 'Thread', 'textile', 1, 'craft', .02],
  ['canvas', 'Canvas', 'textile', 2, 'craft', .5], ['synth', 'Synthetic fabric', 'textile', 3, 'salv', .3],
  // electronics (only from ruins and factions)
  ['circuit', 'Circuit board', 'elec', 3, 'salv', .2], ['battery', 'Battery', 'elec', 3, 'salv', .4], ['cu_wiring', 'Copper wiring', 'elec', 2, 'salv', .3],
  ['sensor', 'Sensor', 'elec', 3, 'salv', .2], ['fuse', 'Fuse', 'elec', 3, 'salv', .05], ['antenna', 'Antenna', 'elec', 3, 'salv', .5], ['power_cell', 'Power cell', 'elec', 5, 'salv', .6],
  ['data_drive', 'Data drive', 'elec', 3, 'salv', .1], ['camera', 'Camera', 'elec', 3, 'salv', .6], ['tablet', 'Computer tablet', 'elec', 4, 'salv', .6],
  // industrial
  ['nails', 'Nails', 'indus', 1, 'salv', .02], ['screws', 'Screws', 'indus', 1, 'salv', .02], ['bolts', 'Bolts', 'indus', 2, 'salv', .05], ['pipe', 'Pipe', 'indus', 2, 'salv', 1],
  ['gears', 'Gears', 'indus', 3, 'salv', .3], ['springs', 'Springs', 'indus', 3, 'salv', .1], ['rubber', 'Rubber', 'indus', 2, 'salv', .4], ['fasteners', 'Fasteners', 'indus', 2, 'craft', .1],
  ['spare_parts', 'Spare parts', 'indus', 3, 'salv', .6], ['tool_kit', 'Tool kit', 'indus', 3, 'salv', 2], ['hook', 'Bone hook', 'indus', 1, 'craft', .01], ['pot', 'Clay pot', 'indus', 1, 'craft', .8],
  ['glass', 'Glass', 'indus', 3, 'salv', .4], ['gunpowder', 'Gunpowder', 'indus', 3, 'craft', .05], ['fuel', 'Fuel', 'indus', 3, 'salv', 2], ['gas_tank', 'Gas cylinder', 'indus', 3, 'salv', 4],
  ['engine_part', 'Engine part', 'indus', 3, 'salv', 3], ['spare_tire', 'Spare tire', 'indus', 3, 'salv', 6], ['winch', 'Winch cable', 'indus', 3, 'salv', 2], ['cable_spool', 'Cable spool', 'indus', 3, 'salv', 2],
  // rare salvage (never renewable)
  ['arc_alloy', 'Arc alloy', 'rare', 3, 'salv', .5], ['solar_cell', 'Solar cell', 'rare', 3, 'salv', .4], ['shielding', 'Rust shielding', 'rare', 4, 'salv', 1], ['med_parts', 'Medical components', 'rare', 3, 'salv', .2],
  // food
  ['berries', 'Wild berries', 'food', 1, 'ren', .05], ['blueberries', 'Blueberries', 'food', 1, 'ren', .05], ['mushroom', 'Mushrooms', 'food', 1, 'ren', .05], ['roots', 'Roots', 'food', 1, 'ren', .1],
  ['nuts', 'Nuts', 'food', 1, 'ren', .05], ['greens', 'Edible greens', 'food', 1, 'ren', .05], ['herb', 'Herbs', 'food', 1, 'ren', .02],
  ['potato', 'Potatoes', 'food', 2, 'ren', .3], ['corn', 'Corn', 'food', 2, 'ren', .3], ['beans', 'Beans', 'food', 2, 'ren', .2], ['wheat', 'Wheat', 'food', 2, 'ren', .2],
  ['squash', 'Squash', 'food', 2, 'ren', .8], ['carrot', 'Carrots', 'food', 2, 'ren', .2],
  ['meat', 'Raw meat', 'food', 1, 'ren', .5], ['fish', 'River fish', 'food', 1, 'ren', .4], ['lake_fish', 'Lake fish', 'food', 1, 'ren', .4], ['shellfish', 'Shellfish', 'food', 1, 'ren', .2],
  ['salt', 'Salt', 'food', 2, 'craft', .05], ['flour', 'Flour', 'food', 2, 'craft', .3], ['oil', 'Cooking oil', 'food', 2, 'craft', .3], ['honey', 'Honey', 'food', 1, 'ren', .3],
  ['ration', 'Cooked meat', 'food', 1, 'craft', .4], ['cooked_fish', 'Cooked fish', 'food', 1, 'craft', .3], ['dried_meat', 'Dried meat', 'food', 1, 'craft', .2], ['roast', 'Roasted meat', 'food', 1, 'craft', .5],
  ['smoked_fish', 'Smoked fish', 'food', 1, 'craft', .2], ['canned', 'Canned ration', 'food', 1, 'salv', .4], ['arc_pack', 'Arc food pack', 'food', 1, 'salv', .3],
  ['stew', 'Vegetable stew', 'food', 1, 'craft', .6], ['veg_soup', 'Vegetable soup', 'food', 1, 'craft', .6], ['fish_soup', 'Fish soup', 'food', 1, 'craft', .6], ['bread', 'Bread', 'food', 2, 'craft', .3],
  // seeds
  ['seed_corn', 'Corn seeds', 'seed', 2, 'ren', .01], ['seed_potato', 'Seed potatoes', 'seed', 2, 'ren', .05], ['seed_wheat', 'Wheat seeds', 'seed', 2, 'ren', .01],
  ['seed_bean', 'Bean seeds', 'seed', 2, 'ren', .01], ['seed_squash', 'Squash seeds', 'seed', 2, 'ren', .01], ['seed_carrot', 'Carrot seeds', 'seed', 2, 'ren', .01],
  // water
  ['water_dirty', 'Dirty water', 'water', 1, 'ren', .5], ['water_boiled', 'Boiled water', 'water', 1, 'craft', .5], ['water_filtered', 'Filtered water', 'water', 2, 'craft', .5], ['water_rain', 'Rainwater', 'water', 1, 'ren', .5],
  // medicine
  ['herb_med', 'Medicinal herbs', 'med', 1, 'ren', .02], ['bandage', 'Bandage', 'med', 1, 'craft', .05], ['herb_bandage', 'Herbal bandage', 'med', 1, 'craft', .05], ['splint', 'Splint', 'med', 1, 'craft', .4],
  ['poultice', 'Herbal poultice', 'med', 1, 'craft', .1], ['disinfect', 'Disinfectant', 'med', 2, 'craft', .2], ['painkiller', 'Painkillers', 'med', 1, 'craft', .05], ['antibiotic', 'Antibiotics', 'med', 3, 'craft', .05],
  ['sutures', 'Surgical thread', 'med', 2, 'craft', .02], ['alcohol', 'Medical alcohol', 'med', 2, 'craft', .3], ['purify_tab', 'Purification tablets', 'med', 2, 'salv', .02], ['medkit', 'Medical kit', 'med', 2, 'craft', .6],
  ['surgical_kit', 'Surgical kit', 'med', 3, 'craft', .5], ['iv', 'IV supplies', 'med', 3, 'craft', .4], ['blood_bag', 'Blood bag', 'med', 4, 'salv', .4], ['rust_med', 'Rust medicine', 'med', 4, 'craft', .1],
  ['lab_sample', 'Laboratory sample', 'med', 4, 'salv', .05], ['blood_kit', 'Blood-testing kit', 'med', 4, 'salv', .3], ['inject', 'Protective injection', 'med', 4, 'craft', .05], ['serum', 'Black-vein serum', 'med', 5, 'craft', .05],
  // documents + odds and ends
  ['map', 'Old map', 'doc', 1, 'salv', .05], ['notebook', 'Notebook', 'doc', 1, 'salv', .1], ['photo', 'Photograph', 'doc', 1, 'salv', .01], ['documents', 'Documents', 'doc', 2, 'salv', .1],
  ['war_paint', 'War paint', 'doc', 2, 'craft', .05],
  // story items (keys, relics)
  ['wristband', 'Arc wristband', 'story', 1, 'story', .1], ['id_chip', 'Arc ID chip', 'story', 3, 'story', .01], ['nav_console', 'Dropship nav console', 'story', 3, 'story', 2],
  ['insignia', 'Clan insignia', 'story', 2, 'story', .1], ['ember', 'The Ember', 'story', 6, 'story', .3], ['blackvein', 'Black-vein sample', 'story', 5, 'story', .05],
  ['greyhold_card', 'Greyhold access card', 'story', 4, 'story', .01], ['greyhold_files', 'Greyhold medical files', 'story', 4, 'story', .2], ['halcyon_chip', 'HALCYON chip', 'story', 5, 'story', .01],
  ['arden_notes', "Dr. Arden's notebook", 'story', 5, 'story', .2], ['sunfall_data', 'Sunfall warning data', 'story', 5, 'story', .05], ['lantern_key', 'Lantern vault key', 'story', 5, 'story', .1],
  ['meridian_gear', 'Meridian equipment', 'story', 6, 'story', 1], ['spindle', 'Mind spindle', 'story', 6, 'story', .2], ['gate_codes', 'Gate Stone codes', 'story', 6, 'story', .5],
  // ammunition
  ['ammo_556', 'Rifle rounds', 'ammo', 1, 'salv', .012], ['ammo_762', 'Heavy rifle rounds', 'ammo', 1, 'salv', .025], ['ammo_9', '9mm rounds', 'ammo', 3, 'craft', .01],
  ['ammo_45', '.45 rounds', 'ammo', 3, 'craft', .015], ['ammo_12', 'Shotgun shells', 'ammo', 3, 'craft', .04], ['ammo_flare', 'Flares', 'ammo', 3, 'craft', .1],
  ['arrows', 'Arrows', 'ammo', 2, 'craft', .04], ['bolts_xb', 'Crossbow bolts', 'ammo', 3, 'craft', .05], ['cell', 'Pulse cells', 'ammo', 6, 'salv', .1],
  ['throw_spear', 'Throwing spear', 'ammo', 1, 'craft', 1], ['smoke_gren', 'Smoke grenade', 'ammo', 3, 'craft', .4], ['frag', 'Frag grenade', 'ammo', 3, 'craft', .4], ['molotov', 'Fire bottle', 'ammo', 2, 'craft', .5],
];
const ITEMS = {}; for (const [id, n, c, t, src, w] of ITEM_DEFS) ITEMS[id] = { id, n, c, t, src, w };

/* tools, weapons and wear are individual pieces with durability + quality */
const QUAL = [{ n: 'Crude', k: .7 }, { n: 'Standard', k: 1 }, { n: 'Fine', k: 1.4 }];
const GEAR_DEFS = {
  // primitive tools
  stone_axe: { n: 'Stone axe', kind: 'axe', pw: 1, dur: 40, t: 1, w: 1.5 }, stone_pick: { n: 'Stone pickaxe', kind: 'pick', pw: 1, dur: 40, t: 1, w: 2 },
  flint_knife: { n: 'Flint knife', kind: 'knife', pw: 1, dur: 35, t: 1, w: .3 }, bone_knife: { n: 'Bone knife', kind: 'knife', pw: 1, dur: 25, t: 1, w: .2 },
  wood_shovel: { n: 'Wooden shovel', kind: 'shovel', pw: 1, dur: 30, t: 1, w: 1.5 }, fish_spear: { n: 'Fishing spear', kind: 'fish', pw: 1, dur: 25, t: 1, w: 1 },
  fish_rod: { n: 'Fishing rod', kind: 'fish', pw: 2, dur: 60, t: 1, w: .8 }, torch_t: { n: 'Torch', kind: 'light', pw: 1, dur: 240, t: 1, w: .5 },
  fire_starter: { n: 'Flint fire starter', kind: 'fire', pw: 1, dur: 30, t: 1, w: .2 }, wood_hammer: { n: 'Wooden hammer', kind: 'hammer', pw: 1, dur: 40, t: 1, w: 1 },
  needle: { n: 'Sewing needle', kind: 'needle', pw: 1, dur: 30, t: 1, w: .01 }, hand_saw: { n: 'Hand saw', kind: 'saw', pw: 1, dur: 80, t: 2, w: 1 },
  // metal tools
  metal_axe: { n: 'Metal axe', kind: 'axe', pw: 2, dur: 160, t: 3, w: 2.2 }, pickaxe: { n: 'Pickaxe', kind: 'pick', pw: 2, dur: 160, t: 3, w: 3 },
  hammer: { n: 'Hammer', kind: 'hammer', pw: 2, dur: 160, t: 3, w: 1 }, crowbar: { n: 'Crowbar', kind: 'pry', pw: 2, dur: 200, t: 3, w: 2 },
  wrench: { n: 'Wrench', kind: 'wrench', pw: 2, dur: 200, t: 3, w: 1 }, screwdriver: { n: 'Screwdriver', kind: 'driver', pw: 2, dur: 150, t: 3, w: .3 },
  bolt_cutters: { n: 'Bolt cutters', kind: 'cutter', pw: 2, dur: 120, t: 3, w: 2.5 }, pliers: { n: 'Pliers', kind: 'pliers', pw: 2, dur: 150, t: 3, w: .4 },
  wire_cutters: { n: 'Wire cutters', kind: 'pliers', pw: 1, dur: 120, t: 3, w: .4 }, multitool: { n: 'Multitool', kind: 'multi', pw: 2, dur: 140, t: 3, w: .3 },
  welder: { n: 'Welding kit', kind: 'weld', pw: 2, dur: 80, t: 3, w: 4 }, flashlight: { n: 'Flashlight', kind: 'light', pw: 2, dur: 900, t: 3, w: .5 },
  radio: { n: 'Portable radio', kind: 'radio', pw: 2, dur: 400, t: 3, w: 1 }, binoculars: { n: 'Binoculars', kind: 'binoc', pw: 2, dur: 400, t: 3, w: .8 },
  compass: { n: 'Compass', kind: 'compass', pw: 1, dur: 999, t: 2, w: .2 }, climb_gear: { n: 'Climbing gear', kind: 'climb', pw: 2, dur: 200, t: 3, w: 2 },
  // advanced equipment
  rust_detector: { n: 'Rust detector', kind: 'detector', pw: 3, dur: 600, t: 4, w: .6 }, med_scanner: { n: 'Medical scanner', kind: 'scanner', pw: 3, dur: 400, t: 4, w: .8 },
  lock_bypass: { n: 'Electronic lock bypass', kind: 'bypass', pw: 3, dur: 12, t: 4, w: .4 }, solar_charger: { n: 'Portable solar charger', kind: 'charger', pw: 3, dur: 999, t: 3, w: 1 },
  transmitter: { n: 'Signal transmitter', kind: 'transmit', pw: 3, dur: 20, t: 4, w: 1.5 }, repair_drone: { n: 'Repair drone', kind: 'drone', pw: 3, dur: 600, t: 5, w: 3 },
  breather: { n: 'Breathing apparatus', kind: 'breather', pw: 3, dur: 300, t: 4, w: 2 }, diag_pc: { n: 'Diagnostic computer', kind: 'diag', pw: 3, dur: 999, t: 4, w: 3 },
  // weapons (stats live in WDEF, in 2c-weapons.js)
  stone_knife: { n: 'Stone knife', kind: 'weapon', dur: 40, t: 1, w: .3 }, bone_dagger: { n: 'Bone dagger', kind: 'weapon', dur: 35, t: 1, w: .2 },
  hunting_knife: { n: 'Hunting knife', kind: 'knife', pw: 2, dur: 150, t: 2, w: .4 }, mil_knife: { n: 'Combat knife', kind: 'knife', pw: 2, dur: 220, t: 3, w: .4 },
  wood_spear: { n: 'Wooden spear', kind: 'weapon', dur: 40, t: 1, w: 1.5 }, metal_spear: { n: 'Metal spear', kind: 'weapon', dur: 120, t: 2, w: 2 }, hunt_spear: { n: 'Hunting spear', kind: 'weapon', dur: 70, t: 2, w: 1.6 },
  club: { n: 'Club', kind: 'weapon', dur: 60, t: 1, w: 2 }, staff: { n: 'Staff', kind: 'weapon', dur: 80, t: 1, w: 1.5 }, hatchet: { n: 'Hatchet', kind: 'axe', pw: 1, dur: 90, t: 2, w: 1.2 },
  machete: { n: 'Machete', kind: 'weapon', dur: 140, t: 2, w: 1 }, sword: { n: 'Sword', kind: 'weapon', dur: 220, t: 3, w: 1.8 }, war_axe: { n: 'War axe', kind: 'axe', pw: 2, dur: 200, t: 3, w: 2.6 },
  stun_baton: { n: 'Stun baton', kind: 'weapon', dur: 160, t: 3, w: 1 },
  shortbow: { n: 'Shortbow', kind: 'weapon', dur: 120, t: 2, w: 1 }, recurve: { n: 'Recurve bow', kind: 'weapon', dur: 200, t: 2, w: 1.2 }, crossbow: { n: 'Crossbow', kind: 'weapon', dur: 220, t: 3, w: 3 },
  pistol: { n: 'Pistol', kind: 'weapon', dur: 600, t: 3, w: 1 }, revolver: { n: 'Revolver', kind: 'weapon', dur: 700, t: 3, w: 1.3 }, shotgun: { n: 'Shotgun', kind: 'weapon', dur: 400, t: 3, w: 3.5 },
  smg: { n: 'Submachine gun', kind: 'weapon', dur: 900, t: 4, w: 3 }, assault: { n: 'Assault rifle', kind: 'weapon', dur: 1200, t: 4, w: 3.8 }, sniper: { n: 'Sniper rifle', kind: 'weapon', dur: 300, t: 4, w: 5 },
  // (Nov 10, Bryce's models) more guns, bows and blades
  m1911: { n: 'M1911 pistol', kind: 'weapon', dur: 650, t: 3, w: 1.1 }, pump_rifle: { n: 'Lightning pump rifle', kind: 'weapon', dur: 500, t: 3, w: 3.2 },
  pulse_pistol: { n: 'Meridian pulse pistol', kind: 'weapon', dur: 700, t: 6, w: 1 },
  longbow: { n: 'Longbow', kind: 'weapon', dur: 220, t: 2, w: 1.1 }, yumi: { n: 'Yumi', kind: 'weapon', dur: 240, t: 3, w: 1.2 }, hornbow: { n: 'Horn bow', kind: 'weapon', dur: 260, t: 3, w: .9 },
  hunt_recurve: { n: "Hunter's recurve", kind: 'weapon', dur: 280, t: 3, w: 1.3 }, hand_xbow: { n: 'Hand crossbow', kind: 'weapon', dur: 160, t: 3, w: 1.4 },
  heavy_xbow: { n: 'Heavy crossbow', kind: 'weapon', dur: 300, t: 4, w: 5 }, repeat_xbow: { n: 'Repeating crossbow', kind: 'weapon', dur: 200, t: 4, w: 3 },
  kukri: { n: 'Kukri', kind: 'weapon', dur: 180, t: 3, w: .9 }, tomahawk: { n: 'Tactical tomahawk', kind: 'axe', pw: 2, dur: 240, t: 3, w: 1.2 },
  lmg: { n: 'Light machine gun', kind: 'weapon', dur: 1600, t: 4, w: 8 }, flare_gun: { n: 'Flare gun', kind: 'weapon', dur: 200, t: 3, w: .8 },
  grey_rifle: { n: 'Greyhold security rifle', kind: 'weapon', dur: 1600, t: 4, w: 3.6 }, pulse_rifle: { n: 'Meridian pulse rifle', kind: 'weapon', dur: 900, t: 6, w: 3 },
  // wear: slot · prot (damage cut) · fog (Rust resistance) · mob (speed) · stealth (how close enemies get before noticing) · warm (slower hunger) · cap (carry)
  wraps: { n: 'Torn clothing', kind: 'wear', slot: 'body', prot: .04, warm: .05, dur: 40, t: 1, w: .5 }, hide_coat: { n: 'Hide coat', kind: 'wear', slot: 'body', prot: .1, warm: .25, dur: 80, t: 1, w: 3 },
  jacket: { n: 'Leather jacket', kind: 'wear', slot: 'body', prot: .12, warm: .2, dur: 140, t: 2, w: 2 }, hunt_outfit: { n: 'Hunting outfit', kind: 'wear', slot: 'body', prot: .1, warm: .15, stealth: .35, dur: 120, t: 2, w: 2 },
  rain_cloak: { n: 'Rain cloak', kind: 'wear', slot: 'body', prot: .05, warm: .3, fog: .15, dur: 100, t: 2, w: 1.2 }, leather_armor: { n: 'Clan leather armor', kind: 'wear', slot: 'body', prot: .22, warm: .1, dur: 160, t: 2, w: 4 },
  metal_chest: { n: 'Metal chestplate', kind: 'wear', slot: 'body', prot: .36, mob: -.08, dur: 220, t: 2, w: 8 }, arc_jumpsuit: { n: 'Arc jumpsuit', kind: 'wear', slot: 'body', prot: .06, warm: .1, mob: .04, dur: 160, t: 3, w: 1.2 },
  util_vest: { n: 'Utility vest', kind: 'wear', slot: 'body', prot: .1, cap: 12, dur: 160, t: 3, w: 1.5 }, sec_uniform: { n: 'Security uniform', kind: 'wear', slot: 'body', prot: .18, dur: 200, t: 3, w: 3 },
  tac_armor: { n: 'Tactical armor', kind: 'wear', slot: 'body', prot: .42, mob: -.04, cap: 6, dur: 320, t: 3, w: 7 }, hazmat: { n: 'Hazmat suit', kind: 'wear', slot: 'body', prot: .08, fog: .7, mob: -.06, dur: 160, t: 4, w: 4 },
  grey_armor: { n: 'Greyhold security armor', kind: 'wear', slot: 'body', prot: .5, fog: .3, dur: 400, t: 4, w: 8 }, rust_suit: { n: 'Rust suit', kind: 'wear', slot: 'body', prot: .2, fog: .95, mob: -.05, dur: 260, t: 4, w: 5 },
  mil_armor: { n: 'Reinforced military armor', kind: 'wear', slot: 'body', prot: .6, mob: -.06, dur: 500, t: 5, w: 10 }, sealed_suit: { n: 'Sealed environmental suit', kind: 'wear', slot: 'body', prot: .45, fog: 1, warm: .3, dur: 600, t: 6, w: 6 },
  clan_mask: { n: 'Clan bone mask', kind: 'wear', slot: 'head', prot: .05, stealth: .2, dur: 80, t: 2, w: .8 }, gas_mask: { n: 'Gas mask', kind: 'wear', slot: 'head', fog: .6, dur: 200, t: 4, w: 1 },
  helmet: { n: 'Helmet', kind: 'wear', slot: 'head', prot: .14, dur: 260, t: 3, w: 1.5 }, riot_helmet: { n: 'Riot helmet', kind: 'wear', slot: 'head', prot: .2, dur: 320, t: 4, w: 2 },
  nvg: { n: 'Night-vision goggles', kind: 'wear', slot: 'head', nv: 1, dur: 900, t: 4, w: .8 },
  gloves: { n: 'Gloves', kind: 'wear', slot: 'arms', prot: .02, gather: .3, dur: 120, t: 2, w: .2 }, arm_guards: { n: 'Arm guards', kind: 'wear', slot: 'arms', prot: .1, dur: 160, t: 2, w: 1.2 },
  shield: { n: 'Reinforced shield', kind: 'wear', slot: 'arms', prot: .22, mob: -.05, dur: 260, t: 2, w: 5 }, riot_shield: { n: 'Riot shield', kind: 'wear', slot: 'arms', prot: .32, mob: -.07, dur: 400, t: 4, w: 6 },
  boots: { n: 'Boots', kind: 'wear', slot: 'feet', prot: .02, mob: .06, dur: 200, t: 2, w: 1 }, hide_boots: { n: 'Hide boots', kind: 'wear', slot: 'feet', mob: .03, warm: .1, dur: 90, t: 1, w: .8 },
  backpack: { n: 'Backpack', kind: 'wear', slot: 'pack', cap: 30, dur: 999, t: 2, w: 1 }, duffel: { n: 'Duffel bag', kind: 'wear', slot: 'pack', cap: 20, dur: 999, t: 2, w: 1 },
  canteen: { n: 'Water canteen', kind: 'container', dur: 999, t: 2, w: .5 },
};
const WEAR_SLOTS = ['head', 'body', 'arms', 'feet', 'pack'];

/* recipes · at: station (fire · cook · rack · bench · forge · lab · filter) · tool: a tool kind you must carry (wears once) */
const R_ = (o, i, cat, t, extra = {}) => ({ o, i, cat, t, ...extra });
const RECIPES = [
  // materials
  R_('rope', { fiber: 4 }, 'mat', 1), R_('rope', { vine: 3 }, 'mat', 1, { alt: 1 }), R_('thread', { fiber: 3 }, 'mat', 1, { n: 3 }), R_('sharp_rock', { flint: 1 }, 'mat', 1, { n: 2 }),
  R_('plank', { log: 1 }, 'mat', 1, { tool: 'axe' }), R_('plank', { log: 1 }, 'mat', 2, { n: 3, at: 'bench', tool: 'saw' }),
  R_('charcoal', { log: 1 }, 'mat', 1, { n: 2, at: 'fire' }), R_('ash', { stick: 3 }, 'mat', 1, { n: 2, at: 'fire' }), R_('pot', { clay: 3 }, 'mat', 1, { at: 'fire' }),
  R_('hook', { bone: 1 }, 'mat', 1, { n: 2, tool: 'knife' }), R_('leather', { hide: 1, fat: 1 }, 'mat', 2, { at: 'rack' }), R_('leather', { hide: 1, bark: 3 }, 'mat', 2, { at: 'rack', alt: 1 }),
  R_('cloth', { thread: 4 }, 'mat', 2, { n: 2, at: 'bench' }), R_('canvas', { cloth: 3, fat: 1 }, 'mat', 2), R_('fertilizer', { ash: 1, soil: 1, bone: 1 }, 'mat', 2, { n: 2 }),
  R_('fasteners', { nails: 3, screws: 2 }, 'mat', 2, { n: 2 }), R_('copper', { cu_wiring: 2 }, 'mat', 2, { tool: 'knife' }), R_('salt', { water_dirty: 3 }, 'mat', 2, { at: 'cook' }),
  R_('iron', { metal_ore: 2, charcoal: 1 }, 'mat', 3, { at: 'forge' }), R_('iron', { scrap: 3, charcoal: 1 }, 'mat', 3, { at: 'forge', alt: 1 }), R_('steel', { iron: 2, charcoal: 2 }, 'mat', 3, { at: 'forge' }),
  R_('nails', { iron: 1 }, 'mat', 3, { n: 10, at: 'forge' }), R_('screws', { steel: 1 }, 'mat', 3, { n: 8, at: 'forge' }), R_('bolts', { steel: 1 }, 'mat', 3, { n: 5, at: 'forge' }),
  R_('wire', { copper: 1 }, 'mat', 3, { n: 3, at: 'bench', tool: 'pliers' }), R_('pipe', { iron: 2 }, 'mat', 3, { at: 'forge' }), R_('springs', { steel: 1 }, 'mat', 3, { n: 3, at: 'forge' }),
  R_('gears', { steel: 1 }, 'mat', 3, { n: 2, at: 'forge' }), R_('gunpowder', { charcoal: 2, salt: 1, ash: 1 }, 'mat', 3, { n: 5, at: 'bench' }),
  R_('spare_parts', { gears: 1, springs: 1, screws: 2 }, 'mat', 3, { at: 'bench' }), R_('tool_kit', { scrap: 4, screws: 4, leather: 1 }, 'mat', 3, { at: 'bench', tool: 'wrench' }),
  R_('fuel', { fat: 4, charcoal: 1 }, 'mat', 3, { at: 'forge' }), R_('glass', { limestone: 2, ash: 2, charcoal: 2 }, 'mat', 3, { at: 'forge' }),
  // tools
  R_('stone_axe', { stick: 1, stone: 2, fiber: 2 }, 'tool', 1), R_('stone_pick', { stick: 2, stone: 3, rope: 1 }, 'tool', 1), R_('flint_knife', { flint: 2, cloth: 1 }, 'tool', 1),
  R_('flint_knife', { flint: 2, fiber: 2 }, 'tool', 1, { alt: 1 }), R_('bone_knife', { bone: 2, sinew: 1 }, 'tool', 1), R_('wood_shovel', { stick: 2, bark: 2, rope: 1 }, 'tool', 1),
  R_('fish_spear', { stick: 2, flint: 1, fiber: 1 }, 'tool', 1), R_('fish_rod', { stick: 2, fiber: 2, hook: 1 }, 'tool', 1), R_('torch_t', { stick: 1, cloth: 1, fat: 1 }, 'tool', 1),
  R_('fire_starter', { flint: 1, stone: 1 }, 'tool', 1), R_('wood_hammer', { log: 1, stick: 1, rope: 1 }, 'tool', 1), R_('needle', { bone: 1 }, 'tool', 1, { tool: 'knife' }),
  R_('hand_saw', { scrap: 3, stick: 1 }, 'tool', 2, { at: 'bench' }), R_('compass', { iron: 1, glass: 1 }, 'tool', 3, { at: 'bench' }),
  R_('metal_axe', { iron: 2, hardwood: 1, leather: 1 }, 'tool', 3, { at: 'forge' }), R_('pickaxe', { iron: 3, hardwood: 1 }, 'tool', 3, { at: 'forge' }), R_('hammer', { iron: 1, hardwood: 1 }, 'tool', 3, { at: 'forge' }),
  R_('crowbar', { steel: 2 }, 'tool', 3, { at: 'forge' }), R_('wrench', { steel: 1, iron: 1 }, 'tool', 3, { at: 'forge' }), R_('screwdriver', { steel: 1, plank: 1 }, 'tool', 3, { at: 'bench' }),
  R_('pliers', { steel: 1, rubber: 1 }, 'tool', 3, { at: 'forge' }), R_('wire_cutters', { steel: 1, rubber: 1 }, 'tool', 3, { at: 'forge' }), R_('bolt_cutters', { steel: 3, rubber: 1, bolts: 2 }, 'tool', 3, { at: 'forge' }),
  R_('multitool', { steel: 2, screws: 2, springs: 1 }, 'tool', 3, { at: 'bench' }), R_('welder', { battery: 2, cu_wiring: 2, steel: 2, gas_tank: 1 }, 'tool', 3, { at: 'bench' }),
  R_('flashlight', { battery: 1, glass: 1, aluminum: 1, wire: 1 }, 'tool', 3, { at: 'bench' }), R_('radio', { circuit: 1, battery: 1, antenna: 1, wire: 2 }, 'tool', 3, { at: 'bench' }),
  R_('binoculars', { glass: 2, aluminum: 1, rubber: 1 }, 'tool', 3, { at: 'bench' }), R_('climb_gear', { rope: 3, steel: 1, leather: 2 }, 'tool', 3, { at: 'bench' }),
  R_('solar_charger', { solar_cell: 2, wire: 2, circuit: 1 }, 'tool', 3, { at: 'bench' }), R_('canteen', { leather: 2, fiber: 1 }, 'tool', 2),
  R_('rust_detector', { sensor: 1, circuit: 1, battery: 1 }, 'tool', 4, { at: 'bench' }), R_('med_scanner', { sensor: 2, circuit: 1, battery: 1, glass: 1 }, 'tool', 4, { at: 'lab' }),
  R_('lock_bypass', { circuit: 1, battery: 1, wire: 2, sensor: 1 }, 'tool', 4, { at: 'bench', tool: 'driver' }), R_('transmitter', { circuit: 2, antenna: 1, battery: 2 }, 'tool', 4, { at: 'bench' }),
  R_('breather', { rubber: 2, charcoal: 3, aluminum: 1, gas_tank: 1 }, 'tool', 4, { at: 'bench' }), R_('diag_pc', { circuit: 3, battery: 2, glass: 1, aluminum: 2 }, 'tool', 4, { at: 'bench' }),
  R_('repair_drone', { circuit: 2, sensor: 2, battery: 2, arc_alloy: 2, spare_parts: 2 }, 'tool', 5, { at: 'bench' }),
  // weapons + ammo
  R_('stone_knife', { flint: 2, stick: 1, fiber: 1 }, 'weap', 1), R_('bone_dagger', { bone: 2, sinew: 1 }, 'weap', 1), R_('wood_spear', { hardwood: 1 }, 'weap', 1, { tool: 'knife' }),
  R_('club', { hardwood: 1, fiber: 2 }, 'weap', 1), R_('staff', { hardwood: 2 }, 'weap', 1, { tool: 'knife' }), R_('throw_spear', { stick: 2, flint: 1, feather: 2 }, 'weap', 1, { n: 2 }),
  R_('shortbow', { hardwood: 2, sinew: 2 }, 'weap', 2), R_('recurve', { hardwood: 2, bone: 2, sinew: 3, leather: 1 }, 'weap', 2, { at: 'bench' }),
  R_('arrows', { stick: 5, feather: 5, sharp_rock: 5 }, 'weap', 2, { n: 5 }), R_('hunt_spear', { stick: 2, sharp_rock: 1, rope: 1 }, 'weap', 2),
  R_('hatchet', { hardwood: 1, flint: 2, sinew: 1 }, 'weap', 2), R_('machete', { scrap: 3, leather: 1 }, 'weap', 2, { at: 'bench' }), R_('metal_spear', { scrap: 2, stick: 2, rope: 1 }, 'weap', 2, { at: 'bench' }),
  R_('hunting_knife', { iron: 1, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('molotov', { alcohol: 1, cloth: 1 }, 'weap', 2),
  R_('crossbow', { plank: 2, steel: 1, springs: 1, sinew: 3 }, 'weap', 3, { at: 'bench' }), R_('bolts_xb', { stick: 5, iron: 1 }, 'weap', 3, { n: 5, at: 'forge' }),
  R_('sword', { steel: 3, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('war_axe', { steel: 2, hardwood: 1, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('mil_knife', { steel: 1, rubber: 1 }, 'weap', 3, { at: 'forge' }),
  R_('stun_baton', { battery: 2, cu_wiring: 2, rubber: 1, aluminum: 1 }, 'weap', 3, { at: 'bench' }),
  R_('pistol', { steel: 2, springs: 2, spare_parts: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }), R_('revolver', { steel: 3, springs: 1, spare_parts: 1, hardwood: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }),
  R_('shotgun', { pipe: 2, steel: 2, spare_parts: 2, hardwood: 1 }, 'weap', 3, { at: 'bench', tool: 'wrench' }), R_('flare_gun', { pipe: 1, springs: 1, scrap: 2 }, 'weap', 3, { at: 'bench' }),
  R_('smg', { steel: 4, springs: 3, spare_parts: 3, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }), R_('assault', { steel: 5, springs: 3, spare_parts: 4, arc_alloy: 1, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }),
  R_('sniper', { steel: 4, glass: 2, spare_parts: 3, hardwood: 1, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }), R_('lmg', { steel: 8, springs: 4, spare_parts: 6, arc_alloy: 2, tool_kit: 1 }, 'weap', 5, { at: 'bench', tool: 'weld' }),
  R_('m1911', { steel: 2, springs: 2, spare_parts: 1, rubber: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }), R_('pump_rifle', { pipe: 1, steel: 3, springs: 2, spare_parts: 2, hardwood: 2 }, 'weap', 3, { at: 'bench', tool: 'wrench' }),
  R_('longbow', { hardwood: 3, sinew: 3, leather: 1 }, 'weap', 2, { tool: 'knife' }), R_('yumi', { hardwood: 3, plank: 1, sinew: 3, leather: 1, rope: 1 }, 'weap', 3, { at: 'bench' }),
  R_('hornbow', { bone: 3, hardwood: 1, sinew: 4, leather: 1 }, 'weap', 3, { at: 'bench' }), R_('hunt_recurve', { hardwood: 2, aluminum: 1, sinew: 3, leather: 1, rubber: 1 }, 'weap', 3, { at: 'bench' }),
  R_('hand_xbow', { plank: 1, steel: 1, springs: 1, sinew: 2 }, 'weap', 3, { at: 'bench' }), R_('heavy_xbow', { plank: 3, steel: 3, springs: 2, gears: 2, rope: 2 }, 'weap', 4, { at: 'bench', tool: 'wrench' }),
  R_('repeat_xbow', { plank: 3, hardwood: 2, springs: 2, sinew: 4, fasteners: 1 }, 'weap', 4, { at: 'bench' }),
  R_('kukri', { steel: 2, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('tomahawk', { steel: 2, rubber: 1, fasteners: 1 }, 'weap', 3, { at: 'forge' }),
  R_('pulse_pistol', { meridian_gear: 1, power_cell: 1, arc_alloy: 2, circuit: 1 }, 'weap', 6, { at: 'bench' }),
  R_('pulse_rifle', { meridian_gear: 1, power_cell: 2, arc_alloy: 3, circuit: 2 }, 'weap', 6, { at: 'bench' }),
  R_('ammo_9', { scrap: 1, gunpowder: 1 }, 'weap', 3, { n: 15, at: 'bench' }), R_('ammo_45', { scrap: 1, gunpowder: 1 }, 'weap', 3, { n: 10, at: 'bench' }),
  R_('ammo_556', { scrap: 2, gunpowder: 2 }, 'weap', 3, { n: 20, at: 'bench' }), R_('ammo_762', { scrap: 2, gunpowder: 2 }, 'weap', 3, { n: 8, at: 'bench' }),
  R_('ammo_12', { scrap: 1, gunpowder: 2, cloth: 1 }, 'weap', 3, { n: 8, at: 'bench' }), R_('ammo_flare', { gunpowder: 1, scrap: 1, fat: 1 }, 'weap', 3, { n: 2, at: 'bench' }),
  R_('smoke_gren', { charcoal: 2, scrap: 1, fiber: 2 }, 'weap', 3, { at: 'bench' }), R_('frag', { gunpowder: 3, scrap: 2, screws: 2 }, 'weap', 3, { at: 'bench' }),
  R_('cell', { power_cell: 1 }, 'weap', 6, { n: 10, at: 'bench' }),
  R_('repair_kit', { scrap: 2, spare_parts: 1, tool_kit: 1 }, 'weap', 3, { at: 'bench' }),
  // clothing + armor
  R_('wraps', { cloth: 3 }, 'wear', 1), R_('hide_coat', { hide: 3, sinew: 2 }, 'wear', 1, { tool: 'needle' }), R_('hide_boots', { hide: 2, sinew: 1 }, 'wear', 1, { tool: 'needle' }),
  R_('jacket', { leather: 4, thread: 2 }, 'wear', 2, { tool: 'needle' }), R_('hunt_outfit', { leather: 3, hide: 2, thread: 2, leaves: 6 }, 'wear', 2, { tool: 'needle' }),
  R_('rain_cloak', { canvas: 2, fat: 2 }, 'wear', 2), R_('leather_armor', { leather: 6, cloth: 3, fiber: 2 }, 'wear', 2, { tool: 'needle' }),
  R_('metal_chest', { scrap: 5, leather: 3, fasteners: 2 }, 'wear', 2, { at: 'bench' }), R_('clan_mask', { bone: 2, leather: 1, feather: 1 }, 'wear', 2),
  R_('war_paint', { charcoal: 1, fat: 1, berries: 1 }, 'wear', 2, { n: 2 }), R_('gloves', { leather: 1, thread: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('arm_guards', { leather: 2, bone: 2 }, 'wear', 2), R_('boots', { leather: 2, rubber: 1, thread: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('backpack', { cloth: 4, leather: 2, fiber: 2 }, 'wear', 2, { tool: 'needle' }), R_('duffel', { canvas: 3, leather: 1, rope: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('shield', { plank: 4, scrap: 3, leather: 2 }, 'wear', 2, { at: 'bench' }),
  R_('util_vest', { canvas: 2, cloth: 2, fasteners: 2 }, 'wear', 3, { at: 'bench' }), R_('arc_jumpsuit', { synth: 3, thread: 2 }, 'wear', 3, { tool: 'needle' }),
  R_('sec_uniform', { synth: 2, cloth: 2, thread: 2 }, 'wear', 3, { tool: 'needle' }), R_('tac_armor', { steel: 3, synth: 3, fasteners: 4 }, 'wear', 3, { at: 'bench' }),
  R_('helmet', { steel: 2, leather: 1, fasteners: 1 }, 'wear', 3, { at: 'forge' }),
  R_('gas_mask', { rubber: 2, charcoal: 3, glass: 1, aluminum: 1 }, 'wear', 4, { at: 'bench' }), R_('hazmat', { rubber: 4, synth: 4, glass: 1 }, 'wear', 4, { at: 'bench', tool: 'needle' }),
  R_('rust_suit', { shielding: 2, rubber: 4, synth: 4, glass: 1 }, 'wear', 4, { at: 'bench' }), R_('nvg', { circuit: 1, sensor: 1, glass: 2, battery: 1 }, 'wear', 4, { at: 'bench' }),
  R_('riot_helmet', { steel: 2, glass: 1, rubber: 1 }, 'wear', 4, { at: 'forge' }), R_('riot_shield', { steel: 3, glass: 2, rubber: 1 }, 'wear', 4, { at: 'forge' }),
  R_('mil_armor', { steel: 4, arc_alloy: 2, synth: 3, fasteners: 4 }, 'wear', 5, { at: 'bench' }), R_('sealed_suit', { shielding: 3, arc_alloy: 2, rubber: 4, battery: 2, circuit: 1 }, 'wear', 6, { at: 'bench' }),
  // food + cooking
  R_('ration', { meat: 1 }, 'food', 1, { at: 'fire' }), R_('roast', { meat: 2, herb: 1 }, 'food', 1, { at: 'fire' }), R_('cooked_fish', { fish: 1 }, 'food', 1, { at: 'fire', alt2: { lake_fish: 1 } }),
  R_('water_boiled', { water_dirty: 1 }, 'food', 1, { at: 'fire' }), R_('water_boiled', { water_rain: 1 }, 'food', 1, { at: 'fire', alt: 1 }),
  R_('stew', { veg: 2, water_boiled: 1 }, 'food', 1, { at: 'fire' }), R_('veg_soup', { greens: 2, roots: 1, water_boiled: 1 }, 'food', 1, { at: 'fire' }),
  R_('fish_soup', { fish: 1, herb: 1, water_boiled: 1 }, 'food', 1, { at: 'fire', alt2: { lake_fish: 1 } }),
  R_('dried_meat', { meat: 2 }, 'food', 1, { n: 2, at: 'rack' }), R_('smoked_fish', { fish: 2 }, 'food', 1, { n: 2, at: 'rack', alt2: { lake_fish: 2 } }),
  R_('oil', { fat: 2 }, 'food', 2, { at: 'fire' }), R_('oil', { corn: 3 }, 'food', 2, { at: 'cook', alt: 1 }), R_('flour', { wheat: 3 }, 'food', 2, { tool: 'hammer' }),
  R_('bread', { flour: 2, water_boiled: 1 }, 'food', 2, { n: 2, at: 'cook' }), R_('water_filtered', { water_dirty: 3, charcoal: 1 }, 'food', 2, { n: 3 }),
  R_('water_filtered', { water_dirty: 1 }, 'food', 2, { at: 'filter', alt: 1 }),
  R_('seed_corn', { corn: 1 }, 'food', 2, { n: 3, tool: 'knife' }), R_('seed_potato', { potato: 1 }, 'food', 2, { n: 2, tool: 'knife' }), R_('seed_wheat', { wheat: 1 }, 'food', 2, { n: 3 }),
  R_('seed_bean', { beans: 1 }, 'food', 2, { n: 3 }), R_('seed_squash', { squash: 1 }, 'food', 2, { n: 4, tool: 'knife' }), R_('seed_carrot', { carrot: 1 }, 'food', 2, { n: 2 }),
  // medicine
  R_('herb_bandage', { cloth: 1, herb_med: 2 }, 'med', 1), R_('bandage', { cloth: 1, water_boiled: 1 }, 'med', 1, { at: 'fire' }), R_('poultice', { herb_med: 2, fat: 1 }, 'med', 1),
  R_('splint', { stick: 2, cloth: 2 }, 'med', 1), R_('painkiller', { bark: 2, water_boiled: 1 }, 'med', 1, { at: 'fire' }),
  R_('alcohol', { corn: 3, pot: 1 }, 'med', 2, { at: 'cook' }), R_('alcohol', { wheat: 3, pot: 1 }, 'med', 2, { at: 'cook', alt: 1 }), R_('alcohol', { berries: 6, pot: 1 }, 'med', 2, { at: 'cook', alt: 1 }),
  R_('disinfect', { alcohol: 1, water_boiled: 1 }, 'med', 2, { n: 2 }), R_('sutures', { thread: 2, alcohol: 1 }, 'med', 2, { n: 3 }),
  R_('medkit', { herb_bandage: 2, disinfect: 1, painkiller: 1 }, 'med', 2), R_('medkit', { bandage: 2, disinfect: 1, painkiller: 1 }, 'med', 2, { alt: 1 }),
  R_('antibiotic', { mushroom: 3, alcohol: 1, pot: 1 }, 'med', 3, { n: 2, at: 'lab' }), R_('surgical_kit', { sutures: 2, disinfect: 1, steel: 1 }, 'med', 3, { at: 'lab' }),
  R_('iv', { med_parts: 1, water_filtered: 2, sutures: 1 }, 'med', 3, { at: 'lab' }),
  R_('rust_med', { lab_sample: 1, herb_med: 3, alcohol: 1 }, 'med', 4, { at: 'lab' }), R_('inject', { lab_sample: 1, med_parts: 1, alcohol: 1 }, 'med', 4, { n: 2, at: 'lab' }),
  R_('serum', { blackvein: 1, med_parts: 2, inject: 1 }, 'med', 5, { at: 'lab' }),
];

/* placeables (made into kits, then placed — see 2d-build.js for what each one does) */
const BUILD_LIST = [
  ['campfire', 'Campfire', 1, { stone: 6, stick: 5 }], ['sleeping_mat', 'Sleeping mat', 1, { fiber: 8, leaves: 6 }], ['tent', 'Tent', 1, { stick: 6, hide: 3, rope: 2 }],
  ['wood_shelter', 'Wooden shelter', 1, { log: 6, stick: 8, rope: 3, leaves: 6 }], ['storage_chest', 'Storage chest', 1, { log: 2, plank: 2, rope: 1 }],
  ['drying_rack', 'Drying rack', 1, { stick: 6, rope: 2 }], ['cooking_rack', 'Cooking rack', 1, { stick: 6, stone: 4, pot: 1 }], ['water_collector', 'Water collector', 1, { stick: 4, hide: 2, pot: 1 }],
  ['palisade', 'Wooden palisade', 1, { log: 4, stick: 4 }], ['spikes', 'Spike barricade', 1, { stick: 8, rope: 2 }], ['watchtower', 'Watchtower', 1, { log: 10, rope: 6, plank: 4 }],
  ['wood_wall', 'Wooden wall', 2, { log: 6, rope: 2 }], ['storage_crate', 'Storage crate', 2, { plank: 5, nails: 4 }], ['rain_coll', 'Rain collector', 2, { scrap: 4, cloth: 2, pot: 1 }],
  ['cook_station', 'Cooking station', 2, { stone: 8, scrap: 3 }], ['workshop', 'Workshop', 2, { plank: 6, scrap: 4, fasteners: 2 }], ['farm_plot', 'Farm plot', 2, { log: 2, soil: 4, stick: 4 }],
  ['greenhouse', 'Greenhouse plot', 2, { plank: 4, soil: 3, cloth: 2 }], ['water_filter', 'Water filter', 2, { charcoal: 2, cloth: 1, pot: 1 }],
  ['chair', 'Chair', 2, { plank: 2, nails: 2 }], ['table', 'Table', 2, { plank: 4, nails: 4 }], ['bed', 'Bed', 2, { plank: 4, cloth: 4, hide: 2 }], ['shelves', 'Shelves', 2, { plank: 4, nails: 2 }],
  ['lantern', 'Lantern', 2, { scrap: 2, fat: 2, glass: 1 }], ['weapon_rack', 'Weapon rack', 2, { plank: 3, nails: 2 }], ['map_table', 'Map table', 2, { plank: 4, nails: 2, map: 1 }],
  ['bookshelf', 'Bookshelf', 2, { plank: 4, notebook: 2 }],
  ['forge', 'Forge', 3, { stone: 20, clay: 8, log: 4 }], ['metal_wall', 'Metal wall', 3, { scrap: 6, steel: 1, fasteners: 2 }], ['door', 'Reinforced door', 3, { steel: 3, plank: 4, bolts: 4 }],
  ['lockers', 'Lockers', 3, { steel: 2, fasteners: 2 }], ['ammo_box', 'Ammunition storage', 3, { scrap: 3, fasteners: 1 }], ['metal_crate', 'Metal crate', 3, { scrap: 6, bolts: 2 }],
  ['barracks', 'Barracks', 3, { plank: 12, nails: 10, cloth: 6, hide: 4 }], ['med_station', 'Medical station', 3, { scrap: 4, medkit: 2, plank: 4 }],
  ['generator', 'Generator', 3, { engine_part: 1, scrap: 6, cu_wiring: 2 }], ['solar_panel', 'Solar panels', 3, { solar_cell: 3, aluminum: 2, wire: 2 }],
  ['radio_tower', 'Radio tower', 3, { circuit: 2, wire: 4, battery: 1, antenna: 1 }],
  ['turret', 'Security station', 4, { circuit: 2, sensor: 2, steel: 4, battery: 2 }], ['lab', 'Research lab', 4, { diag_pc: 1, glass: 2, steel: 4, med_parts: 2 }],
];
const BUILD_N = {}; for (const [id, n, t] of BUILD_LIST) { BUILD_N[id] = n; ITEMS[id] = { id, n, c: 'build', t, src: 'craft', w: 2 }; RECIPES.push(R_(id, BUILD_LIST.find(b => b[0] === id)[3], 'build', t)); }
for (const id of ['palisade', 'spikes', 'wood_wall', 'metal_wall', 'door']) RECIPES.find(r => r.o === id).n = 2;

const VEG = ['roots', 'greens', 'mushroom', 'potato', 'carrot', 'squash', 'corn', 'beans'];
const RCATS = [['mat', 'Materials'], ['tool', 'Tools'], ['weap', 'Weapons'], ['wear', 'Clothing'], ['food', 'Food'], ['med', 'Medicine'], ['build', 'Building']];
const nameOf = id => ITEMS[id]?.n || GEAR_DEFS[id]?.n || id;
const STATION_N = { fire: 'Fire', cook: 'Cooking station', rack: 'Drying rack', bench: 'Workbench', forge: 'Forge', lab: 'Lab', filter: 'Water filter' };
const CAT_N = { wood: 'Wood', stone: 'Stone & earth', fiber: 'Plant fibers', metal: 'Metals', animal: 'Animal', textile: 'Textiles', elec: 'Electronics', indus: 'Industrial', rare: 'Rare salvage',
  food: 'Food', seed: 'Seeds', water: 'Water', med: 'Medicine', doc: 'Documents', story: 'Relics & keys', ammo: 'Ammunition', build: 'To place' };
const SRC_N = { ren: 'Renewable', salv: 'Salvage only', craft: 'Crafted', story: 'Story item' };
const LORE = {
  insignia: 'Thornkin clan mark. Studying it teaches the clans’ craft — Tier 2.', id_chip: 'An Arc crew chip. Opens Arc lockers and the old ring’s manuals — Tier 3.',
  greyhold_card: 'A Greyhold security card. Opens the Grey Door and Greyhold technology — Tier 4.', arden_notes: 'Dr. Sel Arden’s research, from before Sunfall — Tier 5.',
  gate_codes: 'Coordinates and sequences for the Gate Stone. Meridian technology — Tier 6.', ember: 'A warm, humming relic. Carrying it, wounds close faster and the Rust can’t touch you.',
  blackvein: 'Blood that the Rust doesn’t poison. A lab can make a serum from it.', wristband: 'Arc vitals band — shows how long your injuries will last.',
  nav_console: 'Lander navigation data — reveals every landmark on the map.', map: 'An old-world map — reveals every named place.', halcyon_chip: 'It whispers about a Quiet City.',
  sunfall_data: 'The sun will flare again. Night 100 is the warning.', lantern_key: 'Opens the Lantern vault, if anyone can find it.', spindle: 'A mind spindle. Nobody knows what it holds.',
  meridian_gear: 'Equipment from a ship that never came back. A bench can build a pulse rifle from it.', greyhold_files: 'Greyhold’s medical files — their labs made the Rust medicine.',
};
