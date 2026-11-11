
/* ================= weapons: three slots (1–2 guns, 3 melee or bow), throwables on G =================
   The Arc rifle (bench upgrades) and the hunting rifle are always yours; everything else is a piece of gear with
   durability. Guns are hitscan (shotguns fire pellets), bows and crossbows loose real arrows, melee swings hit what's
   in front of you, grenades bounce and go off. */

// stats: cls gun|bow|melee · ammo item · dmg · mag · rate (s between shots) · spread · pellets · auto · scope · reach · stun · burn · spd (projectile)
const WDEF = {
  hunter: { cls: 'gun', ammo: 'ammo_762', dmg: 150, mag: 5, rate: 1.05, spread: .0015, scope: 5, reload: 2.2 },
  pistol: { cls: 'gun', ammo: 'ammo_9', dmg: 30, mag: 12, rate: .16, spread: .018, scope: 1.25, reload: 1.3 },
  revolver: { cls: 'gun', ammo: 'ammo_45', dmg: 58, mag: 6, rate: .42, spread: .012, scope: 1.3, reload: 2 },
  shotgun: { cls: 'gun', ammo: 'ammo_12', dmg: 15, pellets: 9, mag: 6, rate: .85, spread: .055, scope: 1.2, reload: 2.4 },
  smg: { cls: 'gun', ammo: 'ammo_9', dmg: 22, mag: 30, rate: .07, spread: .022, auto: 1, scope: 1.3, reload: 1.6 },
  assault: { cls: 'gun', ammo: 'ammo_556', dmg: 40, mag: 30, rate: .095, spread: .01, auto: 1, scope: 1.6, reload: 1.8 },
  sniper: { cls: 'gun', ammo: 'ammo_762', dmg: 210, mag: 5, rate: 1.2, spread: .0008, scope: 7, reload: 2.4 },
  lmg: { cls: 'gun', ammo: 'ammo_556', dmg: 36, mag: 80, rate: .085, spread: .02, auto: 1, scope: 1.4, reload: 3.6 },
  grey_rifle: { cls: 'gun', ammo: 'ammo_556', dmg: 50, mag: 30, rate: .1, spread: .007, auto: 1, scope: 2.2, reload: 1.8 },
  pulse_rifle: { cls: 'gun', ammo: 'cell', dmg: 85, mag: 20, rate: .2, spread: .002, auto: 1, scope: 2, reload: 1.5, pulse: 1 },
  flare_gun: { cls: 'bow', ammo: 'ammo_flare', dmg: 25, mag: 1, rate: .8, spd: 55, grav: 4, burn: 6, flare: 1, reload: 1.4 },
  shortbow: { cls: 'bow', ammo: 'arrows', dmg: 55, mag: 1, rate: .85, spd: 48, grav: 9, reload: .01 },
  recurve: { cls: 'bow', ammo: 'arrows', dmg: 80, mag: 1, rate: .95, spd: 62, grav: 8, reload: .01 },
  crossbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 120, mag: 1, rate: .3, spd: 80, grav: 5, reload: 1.8, scope: 1.8 },
  m1911: { cls: 'gun', ammo: 'ammo_45', dmg: 44, mag: 8, rate: .22, spread: .014, scope: 1.25, reload: 1.5 },
  pump_rifle: { cls: 'gun', ammo: 'ammo_45', dmg: 82, mag: 10, rate: .62, spread: .004, scope: 1.9, reload: 2.6 },
  pulse_pistol: { cls: 'gun', ammo: 'cell', dmg: 58, mag: 12, rate: .2, spread: .005, scope: 1.4, reload: 1.2, pulse: 1 },
  longbow: { cls: 'bow', ammo: 'arrows', dmg: 95, mag: 1, rate: 1.1, spd: 70, grav: 7, reload: .01, scope: 1.2 },
  yumi: { cls: 'bow', ammo: 'arrows', dmg: 102, mag: 1, rate: 1.05, spd: 74, grav: 7, reload: .01, scope: 1.2 },
  hornbow: { cls: 'bow', ammo: 'arrows', dmg: 72, mag: 1, rate: .6, spd: 60, grav: 8, reload: .01 },
  hunt_recurve: { cls: 'bow', ammo: 'arrows', dmg: 90, mag: 1, rate: .85, spd: 68, grav: 8, reload: .01, scope: 1.15 },
  hand_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 62, mag: 1, rate: .3, spd: 60, grav: 7, reload: 1.1, scope: 1.3 },
  heavy_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 175, mag: 1, rate: .4, spd: 96, grav: 4, reload: 3, scope: 2.2 },
  repeat_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 46, mag: 8, rate: .32, spd: 62, grav: 7, reload: 2.6, scope: 1.2 },
  // melee (tools double as weapons, weaker)
  stone_knife: { cls: 'melee', dmg: 22, rate: .42, reach: 2 }, bone_dagger: { cls: 'melee', dmg: 24, rate: .4, reach: 2 }, flint_knife: { cls: 'melee', dmg: 18, rate: .42, reach: 2 },
  bone_knife: { cls: 'melee', dmg: 16, rate: .42, reach: 2 }, hunting_knife: { cls: 'melee', dmg: 32, rate: .38, reach: 2.1 }, mil_knife: { cls: 'melee', dmg: 40, rate: .34, reach: 2.1 },
  multitool: { cls: 'melee', dmg: 14, rate: .45, reach: 1.9 }, wood_spear: { cls: 'melee', dmg: 34, rate: .7, reach: 3.2 }, metal_spear: { cls: 'melee', dmg: 52, rate: .7, reach: 3.3 },
  hunt_spear: { cls: 'melee', dmg: 44, rate: .65, reach: 3.2 }, fish_spear: { cls: 'melee', dmg: 22, rate: .7, reach: 3 }, club: { cls: 'melee', dmg: 40, rate: .8, reach: 2.3, stun: .6 },
  staff: { cls: 'melee', dmg: 26, rate: .55, reach: 2.8, stun: .3 }, hatchet: { cls: 'melee', dmg: 42, rate: .6, reach: 2.2 }, machete: { cls: 'melee', dmg: 55, rate: .55, reach: 2.4 },
  sword: { cls: 'melee', dmg: 75, rate: .55, reach: 2.6 }, war_axe: { cls: 'melee', dmg: 90, rate: .85, reach: 2.5 }, stun_baton: { cls: 'melee', dmg: 25, rate: .6, reach: 2.2, stun: 2.6 },
  stone_axe: { cls: 'melee', dmg: 30, rate: .75, reach: 2.2 }, metal_axe: { cls: 'melee', dmg: 50, rate: .7, reach: 2.3 }, crowbar: { cls: 'melee', dmg: 40, rate: .65, reach: 2.3, stun: .4 },
  kukri: { cls: 'melee', dmg: 60, rate: .5, reach: 2.3 }, tomahawk: { cls: 'melee', dmg: 70, rate: .55, reach: 2.3 },
  pickaxe: { cls: 'melee', dmg: 45, rate: .85, reach: 2.3 }, stone_pick: { cls: 'melee', dmg: 26, rate: .85, reach: 2.2 }, hammer: { cls: 'melee', dmg: 34, rate: .6, reach: 2, stun: .5 },
  wood_hammer: { cls: 'melee', dmg: 20, rate: .6, reach: 2, stun: .3 }, wrench: { cls: 'melee', dmg: 30, rate: .55, reach: 2, stun: .3 }, wood_shovel: { cls: 'melee', dmg: 22, rate: .75, reach: 2.4 },
};
const isWeapon = id => !!WDEF[id];
const SLOT_OF = id => WDEF[id]?.cls === 'gun' ? 'gun' : 'hand';
const THROWS = ['frag', 'molotov', 'smoke_gren', 'throw_spear'];

/* ---------- viewmodels: three models from the kit for the rifles, everything else built from parts ---------- */
const VMAT = { gun: () => S(0x1c1d1f, { metalness: .65, roughness: .38 }), steel: () => S(0x9aa0a4, { metalness: .8, roughness: .3 }), wood: () => M(0x6a4528), dark: () => M(0x141414),
  leather: () => M(0x3a2618), bone: () => M(0xd8ccb2), orange: () => S(0xd0441e, { metalness: .2, roughness: .5 }), glow: c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }) };
function vbox(g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, g); o.rotation.set(rx, ry, rz); return o; }
function vcyl(g, r0, r1, l, m, x, y, z, rx = Math.PI / 2, ry = 0, rz = 0, seg = 10) { const o = mesh(new THREE.CylinderGeometry(r0, r1, l, seg), m, x, y, z, g); o.rotation.set(rx, ry, rz); return o; }
const PROC = {
  pistol: g => { const m = VMAT.gun(); vbox(g, .036, .045, .2, m, 0, .01, 0); vbox(g, .032, .1, .05, m, 0, -.055, .06, -.25); vbox(g, .03, .02, .05, m, 0, -.03, .02); },
  flare_gun: g => { const m = VMAT.orange(); vcyl(g, .025, .025, .18, m, 0, .01, -.02); vbox(g, .04, .05, .1, m, 0, .01, .06); vbox(g, .035, .1, .05, m, 0, -.06, .08, -.3); },
  revolver: g => { const m = VMAT.steel(); vcyl(g, .012, .012, .2, m, 0, .02, -.06); vcyl(g, .028, .028, .05, m, 0, .01, .04); vbox(g, .03, .03, .08, m, 0, .02, .06); vbox(g, .032, .1, .045, VMAT.wood(), 0, -.05, .1, -.35); },
  shotgun: g => { const m = VMAT.gun(), w = VMAT.wood(); vcyl(g, .018, .018, .62, m, 0, .025, -.18); vcyl(g, .016, .016, .5, m, 0, -.01, -.14); vbox(g, .05, .06, .16, m, 0, .01, .18); vbox(g, .05, .07, .28, w, 0, -.02, .38, .12); vbox(g, .04, .04, .16, w, 0, -.02, -.12); },
  smg: g => { const m = VMAT.gun(); vbox(g, .05, .07, .34, m, 0, 0, 0); vcyl(g, .014, .014, .14, m, 0, .01, -.24); vbox(g, .03, .14, .04, m, 0, -.1, -.02); vbox(g, .035, .09, .045, m, 0, -.07, .1, -.25); vbox(g, .02, .03, .18, m, 0, .02, .24); },
  pulse_rifle: g => { const m = S(0xd8dde2, { metalness: .5, roughness: .3 }); vbox(g, .06, .08, .7, m, 0, 0, 0); vbox(g, .045, .05, .3, VMAT.dark(), 0, .06, -.05); vbox(g, .012, .012, .5, VMAT.glow(0x6ad8ff), .032, 0, 0); vbox(g, .012, .012, .5, VMAT.glow(0x6ad8ff), -.032, 0, 0); vbox(g, .04, .1, .05, m, 0, -.08, .12, -.25); },
  shortbow: g => { const w = VMAT.wood(), a = new THREE.Mesh(new THREE.TorusGeometry(.34, .01, 5, 20, 2), w); a.rotation.set(0, Math.PI / 2, -1); a.position.set(0, 0, .3); g.add(a); vcyl(g, .0015, .0015, .58, VMAT.bone(), 0, 0, .03, 0); vbox(g, .025, .07, .025, VMAT.leather(), 0, 0, -.04); },
  recurve: g => { PROC.shortbow(g); vbox(g, .03, .08, .03, VMAT.leather(), 0, 0, -.12); },
  crossbow: g => { const w = VMAT.wood(), m = VMAT.gun(); vbox(g, .05, .05, .6, w, 0, 0, 0); vbox(g, .5, .025, .04, m, 0, .02, -.24); vcyl(g, .002, .002, .5, VMAT.bone(), 0, .03, -.17, 0, 0, Math.PI / 2); vbox(g, .035, .1, .05, w, 0, -.07, .15, -.3); },
  knife: (g, blade = VMAT.steel(), hilt = VMAT.leather(), L = .2) => { vbox(g, .01, .035, L, blade, 0, 0, -L / 2); vbox(g, .03, .03, .11, hilt, 0, 0, .05); },
  spear: (g, tip = VMAT.steel()) => { vcyl(g, .014, .014, 1.3, VMAT.wood(), 0, 0, .1); mesh(new THREE.ConeGeometry(.03, .16, 5), tip, 0, 0, -.62, g).rotation.x = -Math.PI / 2; },
  club: g => { vcyl(g, .03, .05, .55, VMAT.wood(), 0, 0, -.1); for (let i = 0; i < 6; i++) { const s = mesh(new THREE.ConeGeometry(.012, .06, 4), VMAT.steel(), Math.cos(i) * .05, Math.sin(i) * .05, -.3 + (i % 3) * .05, g); s.rotation.set(Math.PI / 2, 0, i); } },
  axe: (g, head = VMAT.steel(), L = .5) => { vcyl(g, .016, .02, L, VMAT.wood(), 0, 0, 0); vbox(g, .02, .13, .09, head, 0, .05, -L / 2 + .04); },
  hammer: (g, head = VMAT.steel()) => { vcyl(g, .015, .018, .38, VMAT.wood(), 0, 0, 0); vbox(g, .05, .05, .1, head, 0, .02, -.18, 0, Math.PI / 2); },
  baton: g => { vcyl(g, .02, .02, .5, VMAT.dark(), 0, 0, -.05); vcyl(g, .022, .022, .06, VMAT.glow(0x5ab0ff), 0, 0, -.32); },
  sword: g => { vbox(g, .012, .045, .7, VMAT.steel(), 0, 0, -.35); vbox(g, .13, .02, .03, VMAT.gun(), 0, 0, .02); vbox(g, .03, .03, .14, VMAT.leather(), 0, 0, .1); },
  crowbar: g => { vcyl(g, .012, .012, .7, S(0xb02a1a, { metalness: .4 }), 0, 0, -.1); vcyl(g, .012, .012, .1, S(0xb02a1a), 0, .04, -.46, 0); },
  shovel: g => { vcyl(g, .015, .015, .8, VMAT.wood(), 0, 0, 0); vbox(g, .14, .01, .18, VMAT.wood(), 0, 0, -.45); },
};
PROC.m1911 = PROC.pistol; PROC.pump_rifle = PROC.shotgun;
const VIEWS = {
  pistol: { proc: PROC.pistol, len: .22, at: [.17, -.18, -.36], grip: [0, -.09, .07], fore: [-.01, -.09, .05], scope: 1.25, sound: 'machine-gun-clean-single' },
  flare_gun: { proc: PROC.flare_gun, len: .22, at: [.17, -.18, -.36], grip: [0, -.09, .07], fore: [-.01, -.09, .06] },
  revolver: { proc: PROC.revolver, len: .3, at: [.17, -.18, -.38], grip: [0, -.09, .1], fore: [-.01, -.09, .09], sound: 'gun-shot-heavy' },
  shotgun: { proc: PROC.shotgun, len: .9, at: [.2, -.2, -.44], grip: [0, -.07, .2], fore: [0, -.04, -.12], sound: 'gun-shot-heavy' },
  smg: { proc: PROC.smg, len: .5, at: [.19, -.2, -.4], grip: [0, -.09, .1], fore: [0, -.05, -.1], sound: 'machine-gun-clean-single' },
  assault: { model: 'gun-night', len: .84, axis: 'z', tint: 0x6a6a5a, at: [.2, -.21, -.43], grip: [0, -.07, .09], fore: [0, -.03, -.19], sound: 'rifle-m16-b' },
  grey_rifle: { model: 'gun-desert', len: .86, axis: 'z', tint: 0x9aa0a6, at: [.2, -.215, -.44], grip: [0, -.08, .1], fore: [0, -.04, -.2], sound: 'rifle-m16-b' },
  lmg: { model: 'gun-desert', len: 1, axis: 'z', tint: 0x4a4e44, at: [.21, -.23, -.46], grip: [0, -.08, .12], fore: [0, -.04, -.24], sound: 'gun-shot-heavy', extra: g => vcyl(g, .07, .07, .08, VMAT.gun(), 0, -.09, -.02, 0, 0, Math.PI / 2) },
  sniper: { model: 'sniper', len: 1.2, axis: 'x', yaw: Math.PI / 2, tint: 0x5a5e62, at: [.2, -.2, -.52], grip: [0, -.07, .22], fore: [0, -.04, -.22], sound: 'gun-shot-heavy' },
  pulse_rifle: { proc: PROC.pulse_rifle, len: .7, at: [.2, -.2, -.42], grip: [0, -.08, .12], fore: [0, -.05, -.18] },
  shortbow: { proc: PROC.shortbow, len: .3, at: [-.06, -.1, -.55], grip: [0, -.02, -.04], fore: [0, -.02, -.04], bow: 1 },
  recurve: { proc: PROC.recurve, len: .3, at: [-.06, -.1, -.55], grip: [0, -.02, -.04], fore: [0, -.02, -.04], bow: 1 },
  crossbow: { proc: PROC.crossbow, len: .6, at: [.18, -.2, -.42], grip: [0, -.07, .15], fore: [0, -.03, -.12] },
};
/* (Nov 10) Bryce's weapon models (assets/models/w/*.glb), baked so the muzzle or blade tip points -z, up is +y and the middle of
   the model is at the origin. `msize` is the model's length along `axis` (bows stand up, so theirs is their height); grip/fore are
   where the hands close. Until a model has loaded (they stream in after the world), the drawn stand-in above is used. */
const MV = (model, msize, at, grip, fore, extra = {}) => ({ model, msize, axis: 'z', at, grip, fore, ...extra });
const BOWV = (model, h, extra = {}) => ({ model, msize: h, axis: 'y', yaw: -.85, at: [-.07, -.1, -.52], grip: [0, 0, 0], fore: [0, 0, 0], bow: 1, ...extra });   // turned so you see the curve of the limbs
const MODEL_VIEWS = {
  pistol: MV('w/pistol9', .2, [.17, -.16, -.36], [0, -.035, .05], [-.01, -.05, .045], { len: .2, sound: 'machine-gun-clean-single' }),
  m1911: MV('w/m1911', .22, [.17, -.16, -.37], [0, -.035, .055], [-.01, -.05, .05], { len: .22, sound: 'gun-shot-heavy' }),
  revolver: MV('w/revolver38', .27, [.17, -.16, -.38], [0, -.04, .085], [-.01, -.055, .08], { len: .27, sound: 'gun-shot-heavy' }),
  pulse_pistol: MV('w/pulse_pistol', .26, [.17, -.16, -.37], [0, -.045, .06], [-.01, -.06, .055], { len: .26, sound: 'machine-gun-clean-single' }),
  smg: MV('w/smg', .66, [.19, -.2, -.42], [0, -.06, .09], [0, -.05, -.16], { len: .66, sound: 'machine-gun-clean-single' }),
  shotgun: MV('w/rmb93', .92, [.2, -.2, -.44], [0, -.06, .13], [0, -.04, -.17], { len: .92, sound: 'gun-shot-heavy' }),
  pump_rifle: MV('w/lightning', 1, [.2, -.2, -.46], [0, -.05, .17], [0, -.03, -.14], { len: 1, sound: 'gun-shot-heavy' }),
  shortbow: BOWV('w/shortbow', .95), recurve: BOWV('w/recurve', .95), longbow: BOWV('w/longbow', 1.35), yumi: BOWV('w/yumi', 1.45),
  hornbow: BOWV('w/hornbow', .8), hunt_recurve: BOWV('w/recurve2', 1.15),
  crossbow: MV('w/light_xbow', .66, [.18, -.2, -.44], [0, -.05, .2], [0, -.03, -.08], { len: .66 }),
  hand_xbow: MV('w/hand_xbow', .4, [.17, -.18, -.4], [0, -.07, .09], [-.01, -.07, .08], { len: .4 }),
  heavy_xbow: MV('w/heavy_xbow', .78, [.19, -.2, -.47], [0, -.05, .22], [0, -.03, -.1], { len: .78 }),
  repeat_xbow: MV('w/repeat_xbow', .5, [.18, -.2, -.44], [0, -.05, .14], [0, -.03, -.06], { len: .5 }),
};
// blades and axes: the grip sits along the handle (+z end)
const BLADEV = (model, L, g) => ({ model, msize: L, axis: 'z', len: L, at: [.24, -.24, -.42], grip: [0, -.01, L * g], fore: [0, -.01, L * g], melee: 1 });
const MELEE_MODELS = { hunting_knife: BLADEV('w/kabar', .3, .3), mil_knife: BLADEV('w/kabar', .32, .3), multitool: BLADEV('w/folding_knife', .2, .28),
  hatchet: BLADEV('w/hatchet', .4, .38), metal_axe: BLADEV('w/hatchet', .62, .4), war_axe: BLADEV('w/tomahawk', .62, .38), tomahawk: BLADEV('w/tomahawk', .42, .36),
  machete: BLADEV('w/machete', .6, .36), kukri: BLADEV('w/kukri', .46, .36) };
const WEAPON_MODELS = [...new Set([...Object.values(MODEL_VIEWS), ...Object.values(MELEE_MODELS)].map(V => V.model).concat(['w/arrow', 'w/bolt', 'w/frag', 'w/molotov']))];
const MELEE_VIEW = { stone_knife: g => PROC.knife(g, M(0x4a4e56)), flint_knife: g => PROC.knife(g, M(0x4a4e56), M(0x8aa04a)), bone_dagger: g => PROC.knife(g, VMAT.bone()), bone_knife: g => PROC.knife(g, VMAT.bone()),
  hunting_knife: g => PROC.knife(g), mil_knife: g => PROC.knife(g, VMAT.gun(), VMAT.dark(), .22), multitool: g => PROC.knife(g, VMAT.steel(), VMAT.orange(), .1), machete: g => PROC.knife(g, VMAT.steel(), VMAT.dark(), .5),
  wood_spear: g => PROC.spear(g, VMAT.wood()), metal_spear: g => PROC.spear(g), hunt_spear: g => PROC.spear(g, M(0x4a4e56)), fish_spear: g => PROC.spear(g, M(0x4a4e56)), staff: g => vcyl(g, .02, .02, 1.5, VMAT.wood(), 0, 0, 0),
  club: PROC.club, hatchet: g => PROC.axe(g, M(0x4a4e56), .4), stone_axe: g => PROC.axe(g, M(0x7a7870), .45), metal_axe: g => PROC.axe(g), war_axe: g => PROC.axe(g, VMAT.steel(), .7), sword: PROC.sword,
  stun_baton: PROC.baton, crowbar: PROC.crowbar, pickaxe: g => { PROC.axe(g, VMAT.steel(), .6); vbox(g, .02, .3, .03, VMAT.steel(), 0, .02, -.27); }, stone_pick: g => { PROC.axe(g, M(0x7a7870), .55); vbox(g, .02, .26, .04, M(0x7a7870), 0, .02, -.24); },
  hammer: g => PROC.hammer(g), wood_hammer: g => PROC.hammer(g, VMAT.wood()), wrench: g => { vbox(g, .015, .03, .32, VMAT.steel(), 0, 0, -.05); vbox(g, .015, .07, .05, VMAT.steel(), 0, .02, -.22); }, wood_shovel: PROC.shovel };
for (const id in MELEE_VIEW) VIEWS[id] = { proc: MELEE_VIEW[id], len: .5, at: [.24, -.24, -.42], grip: [0, 0, .05], fore: [0, 0, .05], melee: 1 };
for (const id in MODEL_VIEWS) VIEWS[id] = { ...VIEWS[id], ...MODEL_VIEWS[id] };
for (const id in MELEE_MODELS) VIEWS[id] = { ...VIEWS[id], proc: MELEE_VIEW[id] || (g => PROC.knife(g, VMAT.steel(), VMAT.dark(), .4)), ...MELEE_MODELS[id] };
for (const id in VIEWS) { const V = VIEWS[id], D = GEAR_DEFS[id]; WEAPONS[id] = { name: D ? D.n : id, axis: 'z', auto: !!WDEF[id]?.auto, scope: WDEF[id]?.scope || 1, sound: V.sound || 'rifle-m16-a', ...V }; }
WEAPONS.hunter.name = 'Hunting rifle';

/* ---------- what's in each slot ---------- */
function eqInit() {
  if (!Array.isArray(INV.eq) || INV.eq.length !== 3) INV.eq = ['arc', G.flags.hunter ? 'hunter' : null, null];
  INV.eq = INV.eq.map(u => u === 'arc' || u === 'hunter' || u == null ? u : INV.tools.some(t => t.u === u) ? u : null);
  if (!INV.eq[0] && !INV.eq[1] && !INV.eq[2]) INV.eq[0] = 'arc';
}
function slotWeapon(i) {
  const u = INV.eq?.[i]; if (u == null) return null;
  if (u === 'arc') { const R = RIFLE[UP.rifle]; return { key: R.id, g: null, st: { cls: 'gun', ammo: 'ammo_556', dmg: R.dmg, mag: R.mag, rate: R.rate, spread: R.spread, auto: 1, scope: WEAPONS[R.id].scope, reload: 1.7 }, name: WEAPONS[R.id].name };
  }
  if (u === 'hunter') return { key: 'hunter', g: null, st: WDEF.hunter, name: 'Hunting rifle' };
  const g = INV.tools.find(t => t.u === u); if (!g || !WDEF[g.id]) return null;
  return { key: g.id, g, st: WDEF[g.id], name: GEAR_DEFS[g.id].n };
}
const curW = () => slotWeapon(P.slot) || slotWeapon(0) || { key: 'carbine', g: null, st: { cls: 'melee', dmg: 8, rate: .5, reach: 1.6 }, name: 'Fists' };
const gunId = () => curW().key;
const magOf = w => w.g ? (w.g.mag ?? 0) : INV.mags[w.key] ?? 0;
function setMag(w, n) { if (w.g) w.g.mag = n; else INV.mags[w.key] = n; }
const ammoLeft = w => w.st.ammo ? cnt(w.st.ammo) : 0;
function selectSlot(i) {
  if (!slotWeapon(i)) { if (i === 2) toast('Slot 3 is for a melee weapon or bow — equip one from the bag', 2.4); return; }
  if (P.slot === i || P.reload > 0) return;
  P.slot = i; P.swapT = .4; selectGunView(gunId()); sfx('reload'); toast(curW().name, 1.2);
}
function swapGun() { for (let k = 1; k <= 3; k++) { const i = (P.slot + k) % 3; if (slotWeapon(i)) { selectSlot(i); return; } } }
function equipTo(g, i) {
  const cls = WDEF[g.id]?.cls; if (!cls) return;
  if (cls === 'gun' && i === 2) i = 0; if (cls !== 'gun' && i !== 2) i = 2;
  INV.eq = INV.eq.map(u => u === g.u ? null : u); INV.eq[i] = g.u;
  if (P.slot === i) selectGunView(gunId()); toast(`${GEAR_DEFS[g.id].n} → slot ${i + 1}`, 1.8); sfx('reload'); save();
}
function autoEquip(g) {
  if (!WDEF[g.id] || !INV.eq || GEAR_DEFS[g.id].kind !== 'weapon' && !['hunting_knife', 'mil_knife', 'hatchet', 'war_axe'].includes(g.id)) return;
  const i = WDEF[g.id].cls === 'gun' ? (INV.eq[1] == null ? 1 : INV.eq[0] == null ? 0 : -1) : (INV.eq[2] == null ? 2 : -1);
  if (i >= 0) { INV.eq[i] = g.u; setTimeout(() => toast(`${GEAR_DEFS[g.id].n} ready in slot ${i + 1}`, 2.2), 1200); }
}
function onGearBroke(g) { if (!slotWeapon(P.slot)) { P.slot = slotWeapon(0) ? 0 : slotWeapon(1) ? 1 : 0; selectGunView(gunId()); } }

/* ---------- firing ---------- */
const ray = new THREE.Vector3(), rayO = new THREE.Vector3();
function rayHit(o, d, maxT) {
  let best = null, bt = maxT, mult = 1;
  for (const e of ents) {
    if (e.dead || e.type === 'npc') continue;
    if (Math.hypot(e.x - o.x, e.z - o.z) > maxT + 3) continue;
    for (const [cx, cy, cz, r, m] of hitSpheres(e)) {
      const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
      if (h < 0) continue; const t = -b - Math.sqrt(h);
      if (t > 0 && t < bt) { bt = t; best = e; mult = m; }
    }
  }
  let tHit = bt, solid = false;
  for (let t = .8; t < bt; t += 1) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < heightAt(x, z)) { tHit = t; best = null; solid = true; break; }
    if (t > 2 && (t | 0) % 2 === 0) for (const c of nearCols(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r * .8 && y < heightAt(c.x, c.z) + (c.h < 99 ? c.h : 8)) { tHit = t; best = null; solid = true; break; }
    if (solid) break;
  }
  return { e: best, t: tHit, mult, solid };
}
function shoot() {
  const w = curW(), R = w.st;
  if (P.reload > 0 || P.fire > 0 || P.dead || P.swapT > 0) return;
  if (R.cls === 'melee') return swing(w);
  if (magOf(w) <= 0) { sfx('dry'); P.fire = .25; if (ammoLeft(w) > 0) reload(); else toast(`Out of ${nameOf(R.ammo).toLowerCase()}`); input.fire = false; return; }
  setMag(w, magOf(w) - 1); P.fire = R.rate; P.kick = Math.min(P.kick + (R.dmg > 100 ? .09 : R.pellets ? .11 : .028), .14);
  if (!R.auto) input.fire = false;
  if (w.g) wearTool(w.g, 1);
  camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  if (R.cls === 'bow') { aiNoise(P.x, P.z, 12); fireProj(R, w.key); sfx(R.flare ? 'shot' : 'whoosh'); if (magOf(w) === 0 && ammoLeft(w) > 0) setTimeout(reload, 120); return; }
  sfx('shot'); aiNoise(P.x, P.z, 85); flash.visible = true; flash.rotation.z = rnd() * 6; flashLight.intensity = 3; setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 40);
  const mz = new THREE.Vector3(); muzzle.getWorldPosition(mz);
  let hitAny = false, head = false;
  for (let p = 0; p < (R.pellets || 1); p++) {
    const sp = R.spread * (1 - P.ads * .7) * (P.onGround ? 1 : 2.5);
    const d = ray.clone(); d.x += rr(-sp, sp); d.y += rr(-sp, sp); d.normalize();
    const h = rayHit(rayO, d, 400), end = rayO.clone().addScaledVector(d, h.t);
    if (p < 3) tracer(mz, end, R.pulse ? 0x7ae0ff : undefined);
    if (h.e) { damage(h.e, R.dmg * h.mult * (h.t > 40 && R.pellets ? .5 : 1), true, end); hitAny = true; head = head || h.mult > 1.5; }
    else if (h.t < 399 && p < 3) { puff(end.x, end.y + .1, end.z, 0x6a5a48, 4, 1.5, .1, .4); if (p === 0) sfx('impact', .7); }
  }
  if (hitAny) { sfx(head ? 'head' : 'hit'); hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90); hud.hitm.style.filter = head ? 'drop-shadow(0 0 3px #f44)' : ''; }
  if (magOf(w) === 0 && ammoLeft(w) > 0) setTimeout(reload, 240);
}
function reload() {
  const w = curW(), R = w.st;
  if (R.cls === 'melee' || P.reload > 0 || magOf(w) >= R.mag || ammoLeft(w) <= 0) return;
  P.reload = R.reload || 1.7; P.reloadMax = P.reload; if (R.cls !== 'bow' || R.reload > .5) sfx('reload');
}
function finishReload() { const w = curW(), R = w.st; if (!R.ammo) return; const n = Math.min(R.mag - magOf(w), ammoLeft(w)); setMag(w, magOf(w) + n); take(R.ammo, n); }

/* melee: a short swing, then whatever's in reach in front of you takes the hit */
function swing(w) {
  const R = w.st; P.fire = R.rate; P.swingT = .32; sfx('swing'); input.fire = !!R.auto;
  setTimeout(() => {
    if (P.dead) return;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = R.reach + .6;
    for (const e of ents) { if (e.dead || e.type === 'npc') continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > bd || Math.abs(e.y - P.y) > 2.5) continue; if ((dx * fx + dz * fz) / (d || 1) < .45) continue; bd = d; best = e; }
    if (best) {
      const at = new THREE.Vector3(best.x, best.y + 1.2, best.z), sneak = best.state === 'idle' || best.state === 'graze' || best.state === 'root';
      const td = sneak && best.type === 'clan' && P.crouch && behindOf(best) && !best.boss;   // (Nov 11) silent takedown
      damage(best, R.dmg * (td ? 8 : sneak ? 2 : 1), true, at); sfx('hit'); if (R.stun) best.stun = Math.max(best.stun || 0, R.stun); if (td) { toast('Silent takedown', 1.2); } else aiNoise(P.x, P.z, 6);
      if (w.g) wearTool(w.g, 1); hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90);
      if (sneak && !td) toast('Sneak attack ×2', 1);
    } else { const n = nearNode(); if (n && w.g && ['stone_axe', 'metal_axe', 'hatchet', 'war_axe', 'pickaxe', 'stone_pick'].includes(w.g.id)) sfx('thud'); }
  }, 130);
}

/* projectiles: arrows, bolts, flares, thrown spears, grenades, fire bottles */
const PROJ = [];
const PROJ_MODEL = { arrow: ['w/arrow', .75], bolt: ['w/bolt', .42], frag: ['w/frag', .12, 'y'], molotov: ['w/molotov', .26, 'y'] };
function projMesh(kind) {
  const g = new THREE.Group(), pm = PROJ_MODEL[kind], mc = pm && modelCopy(pm[0], pm[1], pm[2] || 'z');
  if (mc) { mc.traverse(o => { if (o.isMesh) { o.castShadow = false; } }); { const b = new THREE.Box3().setFromObject(mc); mc.position.y -= (b.min.y + b.max.y) / 2; } g.add(mc); if (kind === 'molotov') mesh(new THREE.SphereGeometry(.035, 6, 4), VMAT.glow(0xff8a2a), 0, .27, 0, g); world.add(g); return g; }
  if (kind === 'frag' || kind === 'smoke_gren') mesh(new THREE.SphereGeometry(.07, 8, 6), M(kind === 'frag' ? 0x4a5a3a : 0x6a6a62), 0, 0, 0, g);
  else if (kind === 'molotov') { mesh(new THREE.CylinderGeometry(.04, .05, .2, 8), M(0x7a4a1a), 0, 0, 0, g); mesh(new THREE.SphereGeometry(.04, 6, 4), VMAT.glow(0xff8a2a), 0, .12, 0, g); }
  else if (kind === 'flare') mesh(new THREE.SphereGeometry(.08, 8, 6), VMAT.glow(0xff4a3a), 0, 0, 0, g);
  else { const L = kind === 'throw_spear' ? 1.6 : kind === 'bolt' ? .45 : .7; vcyl(g, .008, .008, L, VMAT.wood(), 0, 0, 0); mesh(new THREE.ConeGeometry(.018, .07, 4), VMAT.steel(), 0, 0, -L / 2, g).rotation.x = -Math.PI / 2; }
  world.add(g); return g;
}
function fireProj(R, key) {
  const kind = R.flare ? 'flare' : /crossbow|xbow/.test(key) ? 'bolt' : 'arrow', g = projMesh(kind), d = ray.clone();
  const p = { g, kind, x: rayO.x + d.x * .6, y: rayO.y + d.y * .6 - .05, z: rayO.z + d.z * .6, vx: d.x * R.spd, vy: d.y * R.spd, vz: d.z * R.spd, grav: R.grav, dmg: R.dmg, burn: R.burn || 0, t: 0, owner: 'p' };
  PROJ.push(p);
}
function throwNext() {
  if (P.dead || cine || G.mode !== 'play') return;
  const id = (P.thr && cnt(P.thr) > 0) ? P.thr : THROWS.find(k => cnt(k) > 0);
  if (!id) { toast('Nothing to throw — craft grenades or throwing spears', 2); sfx('no'); return; }
  take(id, 1); camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  const spd = id === 'throw_spear' ? 32 : 18, g = projMesh(id);
  PROJ.push({ g, kind: id, x: rayO.x + ray.x * .5, y: rayO.y + ray.y * .5, z: rayO.z + ray.z * .5, vx: ray.x * spd, vy: ray.y * spd + (id === 'throw_spear' ? 1 : 3.5), vz: ray.z * spd, grav: 12, dmg: id === 'throw_spear' ? 70 : 0, t: 0, owner: 'p', fuse: id === 'frag' ? 2.4 : id === 'smoke_gren' ? 1.6 : 0 });
  sfx('whoosh'); toast(`${nameOf(id)} · ${cnt(id)} left`, 1.2);
}
const FIRES = [], SMOKES_P = [];
function explode(x, y, z) {
  sfx('boom'); puff(x, y + .5, z, 0xffa040, 18, 7, .3, .5, 2); puff(x, y + .5, z, 0x3a3a36, 16, 4, .5, 1.6, -1);
  for (const e of [...ents]) { if (e.dead || e.type === 'npc') continue; const d = Math.hypot(e.x - x, e.z - z, (e.y + 1) - y); if (d < 7) damage(e, 160 * (1 - d / 7) + 20, true, new THREE.Vector3(e.x, e.y + 1, e.z)); }
  const dp = Math.hypot(P.x - x, P.z - z, P.y + 1 - y); if (dp < 6) hurtPlayer(70 * (1 - dp / 6), x + .01, z);
  for (const p of PLACED || []) if (Math.hypot(p.x - x, p.z - z) < 4 && p.hp != null) p.hp -= 60;
}
function updProj(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i]; p.t += dt;
    if (!p.stuck) {
      const steps = 3, sd = dt / steps;
      for (let s = 0; s < steps && !p.stuck; s++) {
        p.vy -= p.grav * sd; p.x += p.vx * sd; p.y += p.vy * sd; p.z += p.vz * sd;
        const gh = heightAt(p.x, p.z);
        if (p.owner === 'p' && p.dmg > 0) for (const e of ents) { if (e.dead || e.type === 'npc') continue; if (Math.hypot(e.x - p.x, e.z - p.z) > 2.5) continue;
          for (const [cx, cy, cz, r, m] of hitSpheres(e)) if (Math.hypot(p.x - cx, p.y - cy, p.z - cz) < r + .05) { damage(e, p.dmg * m, true, new THREE.Vector3(p.x, p.y, p.z)); sfx(m > 1.5 ? 'head' : 'hit'); if (p.burn) e.burn = p.burn; p.stuck = 1; p.hitE = e; p.t = 20; break; }
          if (p.stuck) break; }
        if (!p.stuck && p.y < gh) {
          p.y = gh + .05;
          if (p.kind === 'frag' || p.kind === 'smoke_gren') { p.vx *= .35; p.vz *= .35; p.vy = Math.abs(p.vy) * .3; if (Math.abs(p.vy) < .6) { p.vy = 0; p.grav = 0; p.vx = p.vz = 0; } }
          else p.stuck = 1;
          if (p.kind === 'molotov') { FIRES.push({ x: p.x, z: p.z, y: gh, t: 7 }); sfx('boom', .5); p.t = 99; }
          if (p.kind === 'flare') { FIRES.push({ x: p.x, z: p.z, y: gh, t: 1.2, small: 1 }); }
        }
        if (!p.stuck && p.t > .1) for (const c of nearCols(p.x, p.z)) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r * .8 && p.y < heightAt(c.x, c.z) + 8) { if (p.kind === 'frag' || p.kind === 'smoke_gren') { p.vx *= -.3; p.vz *= -.3; } else p.stuck = 1; break; }
      }
      p.g.position.set(p.x, p.y, p.z);
      if (!p.stuck && p.grav && p.kind !== 'frag' && p.kind !== 'smoke_gren') p.g.lookAt(p.x - p.vx, p.y - p.vy, p.z - p.vz);
      if (p.kind === 'flare' && Math.random() < .5) puff(p.x, p.y, p.z, 0xff6a3a, 1, .5, .06, .3, 1);
    }
    if (p.hitE && !p.hitE.dead) p.g.position.set(p.hitE.x, p.hitE.y + 1.2, p.hitE.z);
    if (p.fuse) { p.fuse -= dt; if (p.fuse <= 0) { if (p.kind === 'frag') explode(p.x, p.y, p.z); else SMOKES_P.push({ x: p.x, z: p.z, y: p.y, t: 14 }); p.t = 99; p.fuse = 0; } }
    if (p.t > (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'throw_spear' ? 25 : 30) || p.t >= 99) { world.remove(p.g); PROJ.splice(i, 1); }
  }
  for (let i = FIRES.length - 1; i >= 0; i--) { const f = FIRES[i]; f.t -= dt; if (Math.random() < dt * (f.small ? 8 : 20)) puff(f.x + rr(-1.5, 1.5) * (f.small ? .2 : 1), f.y + .3, f.z + rr(-1.5, 1.5) * (f.small ? .2 : 1), pick([0xff8a2a, 0xffb04a, 0xe0502a]), 2, 1.5, .18, .6, 3);
    if (!f.small) { for (const e of ents) if (!e.dead && e.type !== 'npc' && Math.hypot(e.x - f.x, e.z - f.z) < 3.2) e.burn = Math.max(e.burn || 0, 3); if (Math.hypot(P.x - f.x, P.z - f.z) < 2.4) hurtPlayer(14 * dt, f.x + .01, f.z); }
    if (f.t <= 0) FIRES.splice(i, 1); }
  for (let i = SMOKES_P.length - 1; i >= 0; i--) { const s = SMOKES_P[i]; s.t -= dt; if (Math.random() < dt * 14) puff(s.x + rr(-3, 3), s.y + rr(.5, 3), s.z + rr(-3, 3), 0xa8a8a0, 2, .6, rr(.6, 1.2), 2.5, -.3);
    for (const e of ents) if (e.type === 'clan' && Math.hypot(e.x - s.x, e.z - s.z) < 9 && e.state === 'chase') { e.state = e.mode === 'raid' ? 'raid' : 'idle'; e.blind = 3; }
    if (s.t <= 0) SMOKES_P.splice(i, 1); }
}
const inSmoke = (x, z) => SMOKES_P.some(s => Math.hypot(x - s.x, z - s.z) < 9);

/* melee + bow viewmodel motion */
function weaponAnim(dt) {
  const V = WEAPONS[gunId()];
  if (P.swingT > 0) { P.swingT -= dt; const k = Math.sin((1 - P.swingT / .32) * Math.PI); vm.rotation.x -= k * 1.1; vm.rotation.z += k * .5; vm.position.x -= k * .12; vm.position.z -= k * .15; }
  if (V?.melee && !(P.swingT > 0)) { vm.rotation.x += .25; vm.rotation.z -= .2; }
  if (V?.bow) { vm.rotation.z += .15; const draw = P.fire > 0 ? Math.min(1, P.fire * 1.5) : 0; vm.position.z += draw * .05; }
}

/* ---------- enemy gunners (Ironjaw scavengers, Greyhold soldiers) ---------- */
function gunnerShoot(e) {
  const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz);
  e.yaw = Math.atan2(dx, dz);
  const from = new THREE.Vector3(e.x + Math.sin(e.yaw) * .5, e.y + 1.45, e.z + Math.cos(e.yaw) * .5), to = new THREE.Vector3(P.x + rr(-.4, .4), P.y + 1.2, P.z + rr(-.4, .4));
  // line of sight: terrain + walls between us
  const dir = to.clone().sub(from), L = dir.length(); dir.normalize();
  for (let t = 1.5; t < L - 1; t += 1.5) { const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t; if (y < heightAt(x, z)) return false; if (t > 3) for (const c of nearCols(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r * .7 && y < heightAt(c.x, c.z) + Math.min(c.h || 8, 8)) return false; }
  if (inSmoke(P.x, P.z) || inSmoke(e.x, e.z)) return false;
  const moving = Math.hypot(input.mx, input.my) > .3, hitP = clamp((e.fac === 'grey' ? .46 : .36) - d / (e.fac === 'grey' ? 120 : 90) - (moving ? .14 : 0) - (P.over ? -.05 : 0), .05, .45);
  tracer(from, to, 0xffd890); sfx(d < 40 ? 'turret' : 'impact', Math.max(.15, 1 - d / 90));
  if (rnd() < hitP) hurtPlayer(e.fac === 'grey' ? rr(8, 12) : rr(5, 9), e.x, e.z); else if (rnd() < .3) sfx('whoosh');
  return true;
}
function updGunner(e, dt, dp) {
  // keep a fighting distance, strafe, shoot when there's a clear line
  { const cv = aiCover(e, dt, dp); if (cv) return cv; }   // (Nov 11) hurt gunners break for cover — 2l-combat.js
  const p = e.p; let tx = e.x, tz = e.z, spd = 0;
  const want = e.fac === 'grey' ? 20 : 15;
  if (dp > want + 8) { tx = P.x; tz = P.z; spd = e.speed; }
  else if (dp < want - 8) { tx = e.x - (P.x - e.x); tz = e.z - (P.z - e.z); spd = e.speed * .8; }
  else { e.strafe = (e.strafe || (rnd() < .5 ? 1 : -1)); if (rnd() < dt * .4) e.strafe *= -1; const a = Math.atan2(P.x - e.x, P.z - e.z) + Math.PI / 2 * e.strafe; tx = e.x + Math.sin(a) * 4; tz = e.z + Math.cos(a) * 4; spd = e.speed * .55; }
  if (e.cool <= 0 && dp < 70) { e.cool = e.fac === 'grey' ? rr(.8, 1.3) : rr(1.2, 2.1); e.burst = (e.burst || 0) + 1; if (e.burst > 3) { e.burst = 0; e.cool = rr(2.5, 4); } if (!gunnerShoot(e)) { e.cool = .4; spd = e.speed; tx = P.x; tz = P.z; } }
  return [tx, tz, spd];
}
