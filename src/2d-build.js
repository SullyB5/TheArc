
/* ================= base building: everything you can place =================
   Kits are crafted, then placed in front of you (walls face you). Q on a placed thing dismantles it for half back. */

/* colliders near a point (used by shots, projectiles and line-of-sight checks) */
function nearCols(x, z) { const L = grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); return L || []; }

const WOOD = () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x9a7a58 });
const MB = (g, w, h, d, m, x, y, z, ry = 0) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, g); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; return o; };
const MC = (g, r0, r1, h, m, x, y, z, seg = 8) => { const o = mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z, g); o.castShadow = true; return o; };
const glowM = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// wall-type pieces are a 4m run, built across your view
const WALLS = { palisade: { h: 3.4, m: 'logs', spike: 1 }, wood_wall: { h: 3, m: 'planks' }, metal_wall: { h: 3.4, m: 'metal' }, door: { h: 3, m: 'door' } };
function wallMesh(g, k) {
  const W = WALLS[k];
  if (W.m === 'logs') for (let i = 0; i < 9; i++) { MC(g, .2, .22, W.h, WOOD(), -1.8 + i * .45, W.h / 2, 0, 7); mesh(new THREE.ConeGeometry(.21, .5, 7), WOOD(), -1.8 + i * .45, W.h + .25, 0, g); }
  else if (W.m === 'planks') { for (let i = 0; i < 6; i++) MB(g, 4, .44, .12, WOOD(), 0, .3 + i * .5, 0); for (const x of [-1.9, 0, 1.9]) MB(g, .2, W.h, .2, M(0x5a3e28), x, W.h / 2, .12); }
  else if (W.m === 'metal') { const mt = new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x8a8478, 0x7a6a5a, 0x6a7072]) }); for (let i = 0; i < 4; i++) MB(g, 1.05, W.h, .08, mt, -1.5 + i * 1, W.h / 2, (i % 2) * .04); for (const y of [.5, W.h - .4]) MB(g, 4.1, .12, .14, M(0x3a3a3a), 0, y, .08); }
  else { for (const x of [-1.6, 1.6]) MB(g, .8, W.h, .3, M(0x5a5a5a), x, W.h / 2, 0); const dr = new THREE.Group(); dr.position.set(-1.2, 0, 0); g.add(dr); MB(dr, 2.4, 2.6, .12, new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a6a64 }), 1.2, 1.3, 0); MB(dr, .1, .1, .2, M(0x222222), 2.1, 1.3, .1); g.userData.leaf = dr; MB(g, 4, .4, .3, M(0x5a5a5a), 0, W.h - .2, 0); }
}
// what each placeable is and does · st: stations it counts as · store: storage slots · rest: you can set your respawn here
const BUILD_DEF = {
  campfire: { st: ['fire'], light: 1, mk: g => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; mesh(new THREE.DodecahedronGeometry(.22, 0), M(0x8a8780), Math.cos(a) * .6, .1, Math.sin(a) * .6, g); } for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.07, .08, .9, 5), M(0x5a3a22), 0, .2, 0, g).rotation.set(1.2, i * 2.1, 0); g.userData.flame = mesh(new THREE.ConeGeometry(.3, .8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 }), 0, .55, 0, g); }, r: .55 },
  sleeping_mat: { rest: 1, mk: g => { MB(g, .9, .08, 2, M(0x7a8a4a), 0, .04, 0); MB(g, .8, .14, .35, M(0x8a7a5a), 0, .1, -.8); }, r: 0 },
  tent: { rest: 1, shelter: 2.2, mk: g => { const t = mesh(new THREE.ConeGeometry(1.9, 2.2, 4), M(0x6a6a3a), 0, 1.1, 0, g); t.rotation.y = Math.PI / 4; t.scale.z = 1.4; MB(g, .8, 1.2, .05, M(0x1a1a14), 0, .6, 1.3); }, r: 1.3 },
  wood_shelter: { rest: 1, shelter: 3, mk: g => { for (const [x, z] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]) MC(g, .12, .14, 2.6, WOOD(), x, 1.3, z, 6); const r = MB(g, 4.4, .15, 4, WOOD(), 0, 2.7, 0); r.rotation.x = .12; for (let i = 0; i < 5; i++) MB(g, .25, 2.4, .2, WOOD(), -1.8 + i * .9, 1.2, -1.7); }, cols: [[-1.8, -1.6, .2], [1.8, -1.6, .2], [-1.8, 1.6, .2], [1.8, 1.6, .2], [0, -1.7, .4], [-1, -1.7, .4], [1, -1.7, .4]] },
  storage_chest: { store: 24, mk: g => { MB(g, 1.2, .6, .7, WOOD(), 0, .3, 0); MB(g, 1.25, .1, .75, M(0x5a3e28), 0, .62, 0); }, r: .6 },
  drying_rack: { st: ['rack'], mk: g => { for (const x of [-.9, .9]) MC(g, .05, .06, 1.7, M(0x6a4a30), x, .85, 0, 5); MC(g, .04, .04, 2, M(0x6a4a30), 0, 1.6, 0, 5).rotation.z = Math.PI / 2; for (let i = 0; i < 5; i++) MB(g, .12, .45, .03, M(0x8a3a24), -.6 + i * .3, 1.32, 0); }, r: .5 },
  cooking_rack: { st: ['fire', 'cook'], light: 1, mk: g => { for (let i = 0; i < 3; i++) { const l = MC(g, .04, .05, 2, M(0x5a3a22), Math.cos(i * 2.1) * .5, .9, Math.sin(i * 2.1) * .5, 5); l.rotation.set(Math.sin(i * 2.1) * .25, 0, -Math.cos(i * 2.1) * .25); } MC(g, .25, .2, .3, M(0x2a2a2a), 0, .8, 0, 10); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mesh(new THREE.DodecahedronGeometry(.16, 0), M(0x8a8780), Math.cos(a) * .4, .08, Math.sin(a) * .4, g); } g.userData.flame = mesh(new THREE.ConeGeometry(.22, .5, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 }), 0, .3, 0, g); }, r: .6 },
  water_collector: { make: ['water_rain', 150, 6], mk: g => { for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) MC(g, .04, .04, 1.4, M(0x6a4a30), x, .7, z, 5); const h = mesh(new THREE.ConeGeometry(1, .5, 4, 1, true), new THREE.MeshLambertMaterial({ color: 0x8a6a48, side: THREE.DoubleSide }), 0, 1.2, 0, g); h.rotation.set(Math.PI, Math.PI / 4, 0); MC(g, .3, .25, .4, M(0xa8643c), 0, .2, 0, 10); }, r: .8 },
  palisade: { wall: 1, hp: 300 }, wood_wall: { wall: 1, hp: 400 }, metal_wall: { wall: 1, hp: 900 }, door: { wall: 1, door: 1, hp: 900 },
  spikes: { spikes: 1, mk: g => { for (let i = 0; i < 7; i++) { const s = MC(g, .04, .07, 1.8, WOOD(), -1.6 + i * .53, .6, 0, 5); s.rotation.x = i % 2 ? .7 : -.7; } MC(g, .08, .08, 3.6, WOOD(), 0, .5, 0, 5).rotation.z = Math.PI / 2; }, r: 0 },
  watchtower: { tower: 5.2, mk: g => { for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) MC(g, .12, .16, 5.6, WOOD(), x, 2.8, z, 6); MB(g, 3, .2, 3, WOOD(), 0, 5.2, 0); for (const [x, z, ry] of [[0, -1.45, 0], [0, 1.45, 0], [-1.45, 0, Math.PI / 2], [1.45, 0, Math.PI / 2]]) MB(g, 3, .9, .08, WOOD(), x, 5.75, z, ry); const r = mesh(new THREE.ConeGeometry(2.4, 1.2, 4), M(0x5a4430), 0, 7.4, 0, g); r.rotation.y = Math.PI / 4; for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) MC(g, .06, .06, 1.6, WOOD(), x, 6.4, z, 5); }, cols: [[-1.2, -1.2, .2], [1.2, -1.2, .2], [-1.2, 1.2, .2], [1.2, 1.2, .2]] },
  storage_crate: { store: 32, mk: g => { MB(g, 1.3, .9, .9, new THREE.MeshLambertMaterial({ map: texWood, color: 0xb08a5a }), 0, .45, 0); }, r: .7 },
  rain_coll: { make: ['water_rain', 90, 10], mk: g => { MC(g, .55, .55, 1.4, S(0x3a6a9a, { metalness: .4 }), 0, .9, 0, 14); for (const [x, z] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) MB(g, .1, .2, .1, WOOD(), x, .1, z); MC(g, .7, .5, .1, S(0x8a8a8a), 0, 1.65, 0, 14); }, r: .6 },
  cook_station: { st: ['fire', 'cook'], light: 1, mk: g => { MB(g, 1.6, .9, 1, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e }), 0, .45, 0); MB(g, 1.4, .06, .8, M(0x2a2a2a), 0, .93, 0); MC(g, .2, .2, .3, M(0x3a3a3a), -.3, 1.1, 0, 10); g.userData.flame = mesh(new THREE.BoxGeometry(.9, .05, .4), glowM(0xff7a2a), 0, .7, .51, g); }, r: .9 },
  workshop: { st: ['bench'], mk: g => { MB(g, 2.2, .1, 1, WOOD(), 0, .95, 0); for (const [x, z] of [[-1, -.4], [1, -.4], [-1, .4], [1, .4]]) MB(g, .1, .95, .1, WOOD(), x, .47, z); MB(g, .4, .3, .3, M(0x3a3a3a), -.6, 1.15, 0); MB(g, 2.2, 1, .06, WOOD(), 0, 1.5, -.5); for (let i = 0; i < 5; i++) MB(g, .04, .3, .02, S(0x9a9a9a), -.8 + i * .4, 1.5, -.45); }, r: 1 },
  farm_plot: { farm: 1, mk: g => { MB(g, 2, .3, 1.4, WOOD(), 0, .15, 0); MB(g, 1.8, .05, 1.2, M(0x3e2e1e), 0, .31, 0); }, r: 0 },
  greenhouse: { farm: 2, mk: g => { const gl = new THREE.MeshLambertMaterial({ color: 0xc8e0e8, transparent: true, opacity: .32, side: THREE.DoubleSide }); MB(g, 3, .3, 2.2, WOOD(), 0, .15, 0); MB(g, 2.8, .05, 2, M(0x3e2e1e), 0, .31, 0); MB(g, 3, 1.8, 2.2, gl, 0, 1.2, 0); const r = mesh(new THREE.ConeGeometry(2.1, .9, 4), gl, 0, 2.55, 0, g); r.rotation.y = Math.PI / 4; r.scale.z = .75; for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) MB(g, .06, 2.1, .06, WOOD(), x, 1.2, z); }, r: 1.4 },
  water_filter: { st: ['filter'], mk: g => { for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) MB(g, .06, 1.2, .06, S(0x8a8a8a), x, .6, z); mesh(new THREE.ConeGeometry(.45, .7, 10), S(0xa0a4a8, { metalness: .6 }), 0, 1.4, 0, g).rotation.x = Math.PI; MC(g, .3, .3, .3, S(0x6a8aa0), 0, .3, 0, 10); }, r: .5 },
  chair: { mk: g => { MB(g, .5, .06, .5, WOOD(), 0, .45, 0); for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) MB(g, .05, .45, .05, WOOD(), x, .22, z); MB(g, .5, .5, .05, WOOD(), 0, .72, -.23); }, r: 0 },
  table: { mk: g => { MB(g, 1.6, .08, .9, WOOD(), 0, .8, 0); for (const [x, z] of [[-.7, -.35], [.7, -.35], [-.7, .35], [.7, .35]]) MB(g, .08, .8, .08, WOOD(), x, .4, z); }, r: .6 },
  bed: { rest: 1, mk: g => { MB(g, 1.1, .4, 2.1, WOOD(), 0, .2, 0); MB(g, 1, .18, 1.9, M(0x8a8a7a), 0, .48, 0); MB(g, .7, .12, .35, M(0xd8d0c0), 0, .62, -.75); MB(g, 1.1, .9, .08, WOOD(), 0, .45, -1.05); }, r: .7 },
  shelves: { store: 16, mk: g => { for (const x of [-.7, .7]) MB(g, .06, 1.8, .4, WOOD(), x, .9, 0); for (let i = 0; i < 4; i++) MB(g, 1.4, .05, .4, WOOD(), 0, .2 + i * .5, 0); for (let i = 0; i < 6; i++) MB(g, .25, .25, .25, M(pick([0x8a6a48, 0x5a6a4a, 0x6a6a6a])), -.5 + (i % 3) * .5, .35 + Math.floor(i / 3) * .5, 0); }, r: .5 },
  lantern: { light: 1, mk: g => { MC(g, .03, .03, 1.6, M(0x3a3a3a), 0, .8, 0, 5); MC(g, .1, .12, .25, glowM(0xffd080), 0, 1.7, 0, 8); MC(g, .12, .12, .04, M(0x2a2a2a), 0, 1.85, 0, 8); }, r: 0 },
  weapon_rack: { store: 8, gearOnly: 1, mk: g => { MB(g, 1.6, 1.4, .1, WOOD(), 0, .7, -.15); for (let i = 0; i < 4; i++) MB(g, .05, .05, .3, WOOD(), -.6 + i * .4, 1.1, 0); for (let i = 0; i < 3; i++) MB(g, .06, 1.1, .06, M(0x1a1a1a), -.4 + i * .4, .65, .05).rotation.z = .1; }, r: 0 },
  map_table: { map: 1, mk: g => { MB(g, 1.6, .08, 1, WOOD(), 0, .85, 0); for (const [x, z] of [[-.7, -.4], [.7, -.4], [-.7, .4], [.7, .4]]) MB(g, .08, .85, .08, WOOD(), x, .42, z); MB(g, 1.3, .01, .8, M(0xc8b890), 0, .9, 0); }, r: .6 },
  bookshelf: { books: 1, mk: g => { MB(g, 1.4, 1.9, .4, WOOD(), 0, .95, 0); for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) MB(g, .14, .32, .3, M(pick([0x6a2a1a, 0x2a3a5a, 0x3a5a2a, 0x7a6a4a])), -.5 + i * .16, .25 + r * .45, .04); }, r: .5 },
  forge: { st: ['forge', 'fire'], light: 1, mk: g => { MB(g, 2, 1.6, 1.6, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), 0, .8, 0); MB(g, .7, 2.2, .7, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x6a6460 }), .5, 2.6, -.3); g.userData.flame = MB(g, .9, .5, .05, glowM(0xff6a1a), 0, .9, .81); MB(g, .5, .35, .25, M(0x2a2a2a), 1.5, .75, .4); MC(g, .15, .15, .7, M(0x4a3a2a), 1.5, .35, .4, 8); }, r: 1.2 },
  lockers: { store: 24, mk: g => { for (let i = 0; i < 3; i++) { MB(g, .5, 1.9, .5, S(0x5a6a6a, { metalness: .5 }), -.52 + i * .52, .95, 0); MB(g, .3, .05, .02, M(0x222222), -.52 + i * .52, 1.6, .26); } }, r: .7 },
  ammo_box: { store: 16, mk: g => { MB(g, .9, .5, .5, S(0x4a5a3a, { metalness: .3 }), 0, .25, 0); MB(g, .2, .06, .1, M(0x1a1a1a), 0, .53, 0); }, r: .5 },
  metal_crate: { store: 48, mk: g => { MB(g, 1.5, 1, 1, S(0x7a7e80, { metalness: .6 }), 0, .5, 0); for (const x of [-.6, .6]) MB(g, .08, 1.02, 1.02, M(0x3a3a3a), x, .5, 0); }, r: .8 },
  barracks: { rest: 1, guards: 2, shelter: 3.5, mk: g => { const cv = M(0x8a8a6a); MB(g, 6, 2.6, 4, cv, 0, 1.3, 0); const r = mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 12, 1, false, 0, Math.PI), cv, 0, 2.6, 0, g); r.rotation.z = Math.PI / 2; r.scale.y = 1; r.scale.x = .5; MB(g, 1.2, 2, .05, M(0x1a1a14), 0, 1, 2.02); }, cols: [[-2, 0, 1.9], [0, 0, 1.9], [2, 0, 1.9]] },
  med_station: { st: ['lab'], heal: 1, mk: g => { MB(g, 2, .9, .8, S(0xd8d8d0), 0, .45, 0); MB(g, .5, .5, .05, glowM(0xe04040), 0, 1.3, -.38); MB(g, .2, .5, .05, glowM(0xffffff), 0, 1.3, -.36); MB(g, .5, .2, .05, glowM(0xffffff), 0, 1.3, -.355); MB(g, 2, 1.2, .1, S(0xc8c8c0), 0, 1.4, -.4); }, r: 1 },
  generator: { power: 'fuel', light: 1, mk: g => { MB(g, 1.3, .9, .8, S(0xd8a828, { metalness: .4 }), 0, .55, 0); MB(g, 1.5, .1, 1, M(0x1a1a1a), 0, .1, 0); MC(g, .1, .1, .5, M(0x2a2a2a), .5, 1.1, .2, 8); g.userData.lamp = MB(g, .1, .1, .05, glowM(0x40ff60), -.4, .8, .41); }, r: .8 },
  solar_panel: { power: 'sun', mk: g => { for (let i = 0; i < 3; i++) { const p = MB(g, 1, .05, 1.6, S(0x1a2a5a, { metalness: .6, roughness: .2 }), -1.1 + i * 1.1, 1.1, 0); p.rotation.x = -.5; MB(g, .06, 1, .06, M(0x6a6a6a), -1.1 + i * 1.1, .5, .3); } }, r: 0 },
  radio_tower: { radio: 1, mk: g => { for (const [x, z] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) { const l = MC(g, .05, .05, 9, M(0x8a3a2a), x * .6, 4.5, z * .6, 5); l.rotation.set(z * -.06, 0, x * .06); } for (let i = 1; i < 8; i++) MB(g, .9 - i * .08, .04, .04, M(0x8a3a2a), 0, i * 1.1, 0); g.userData.lamp = mesh(new THREE.SphereGeometry(.15, 8, 6), glowM(0xff3020), 0, 9.1, 0, g); MB(g, .8, .9, .6, S(0x6a6a6a), 0, .45, 1.2); }, r: .8 },
  turret: { turret: 1, needPower: 1, mk: g => { MB(g, 1, 1, 1, S(0x5a5e60, { metalness: .5 }), 0, .5, 0); const head = new THREE.Group(); head.position.y = 1.2; g.add(head); MB(head, .5, .4, .6, S(0x3a3e40, { metalness: .6 }), 0, 0, 0); MC(head, .04, .04, .9, M(0x1a1a1a), 0, .05, -.6, 8).rotation.x = Math.PI / 2; MB(head, .1, .1, .05, glowM(0xff3030), 0, .15, -.31); g.userData.head = head; }, r: .7 },
  lab: { st: ['lab', 'bench'], mk: g => { MB(g, 2.4, .9, .9, S(0xe0e0d8), 0, .45, 0); MB(g, .6, .4, .05, glowM(0x60c0ff), -.5, 1.2, -.3); MB(g, .5, .35, .4, S(0x2a2a2a), -.5, 1.1, -.1); for (let i = 0; i < 4; i++) MC(g, .05, .05, .2, new THREE.MeshLambertMaterial({ color: pick([0x8ad0a0, 0xd0a08a, 0xa08ad0]), transparent: true, opacity: .8 }), .4 + i * .15, 1, .1, 8); }, r: 1 },
};
for (const k in WALLS) BUILD_DEF[k].mk = g => wallMesh(g, k);

/* ---------- the placed list, its state is saved inside G.flags.placed ---------- */
const PLACED = [];
let powerSun = false;
const powered = () => PLACED.some(p => (BUILD_DEF[p.k].power === 'fuel' && p.rec.fuel > 0) || (BUILD_DEF[p.k].power === 'sun' && !isNight()));
function buildPlaced(rec) {
  const B = BUILD_DEF[rec.k]; if (!B) return;
  const g = new THREE.Group(); g.position.set(rec.x, heightAt(rec.x, rec.z), rec.z); g.rotation.y = rec.yaw || 0;
  B.mk(g); world.add(g);
  const p = { k: rec.k, x: rec.x, z: rec.z, yaw: rec.yaw || 0, g, rec, cols: [] };
  const C = (lx, lz, r) => { const [a, b] = rotXZ(lx, lz, p.yaw); p.cols.push(addCol(p.x + a, p.z + b, r)); };
  if (B.wall) for (let i = -4; i <= 4; i++) { if (B.door && Math.abs(i) <= 2) continue; C(i * .45, 0, .32); }
  else if (B.cols) for (const [x, z, r] of B.cols) C(x, z, r);
  else if (B.r) C(0, 0, B.r);
  if (B.door) { p.doorCols = []; for (let i = -2; i <= 2; i++) { const [a, b] = rotXZ(i * .45, 0, p.yaw); p.doorCols.push(addCol(p.x + a, p.z + b, rec.open ? -9 : .32)); } if (rec.open) g.userData.leaf.rotation.y = -1.5; }
  if (B.shelter) { p.sh = { x: p.x, z: p.z, kind: 'placed', r: B.shelter }; SHELTERS.push(p.sh); }
  if (B.tower) { addFloor(p.x, p.z, p.yaw, 1.4, 1.4, heightAt(p.x, p.z) + B.tower + .1); }
  if (B.store) rec.inv = rec.inv || {}, rec.gear = rec.gear || [];
  if (B.farm && rec.crop) farmShow(p);
  if (B.guards) spawnGuards(p);
  PLACED.push(p); return p;
}
function placeKit(k) {
  if (cnt(k) <= 0) return;
  if (Math.hypot(P.x, P.z) < 14 && Math.abs(P.x) < 12 && P.z < 6) { sfx('no'); toast('Too close to the wreck — place it somewhere open'); return; }
  const B = BUILD_DEF[k], dist = B.wall ? 2.6 : B.tower || B.guards || k === 'greenhouse' ? 4.5 : 2.4;
  const x = P.x - Math.sin(P.yaw) * dist, z = P.z - Math.cos(P.yaw) * dist;
  if (waterAt(x, z) > heightAt(x, z) - .3) { sfx('no'); toast("Can't build in water"); return; }
  if (PLACED.some(p => Math.hypot(p.x - x, p.z - z) < (BUILD_DEF[p.k].wall && B.wall ? 1.5 : 1))) { sfx('no'); toast('Something is already there'); return; }
  take(k, 1);
  const rec = { k, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +(B.wall ? P.yaw : P.yaw + Math.PI).toFixed(3) };
  (G.flags.placed ||= []).push(rec); buildPlaced(rec);
  sfx('buy'); puff(x, heightAt(x, z) + .3, z, 0x8a7a6a, 8, 2, .15, .6);
  toast(`${nameOf(k)} built${B.rest ? ' · use it to set your respawn' : B.store ? ' · use it to store things' : B.farm ? ' · plant seeds in it' : ''}`, 2.6); save();
}
function unplace(p, refund) {
  world.remove(p.g); for (const c of [...p.cols, ...(p.doorCols || [])]) c.r = -9;
  if (p.sh) SHELTERS.splice(SHELTERS.indexOf(p.sh), 1);
  if (p.guardEnts) for (const e of p.guardEnts) removeEnt(e);
  PLACED.splice(PLACED.indexOf(p), 1); G.flags.placed = (G.flags.placed || []).filter(r => r !== p.rec);
  if (refund) {
    const R = RECIPES.find(r => r.o === p.k); const back = [];
    if (R) for (const [id, n] of Object.entries(R.i)) { const m = Math.floor(n / (R.n || 1) / 2); if (m > 0) { give(id, m); back.push(`+${m} ${nameOf(id).toLowerCase()}`); } }
    for (const [id, n] of Object.entries(p.rec.inv || {})) give(id, n); for (const g of p.rec.gear || []) INV.tools.push(g);
    toast(`Dismantled ${nameOf(p.k).toLowerCase()}${back.length ? ' · ' + back.join(' · ') : ''}`, 2.6); sfx('thud');
  }
  save();
}
function restorePlaced() { for (const p of [...PLACED]) { world.remove(p.g); for (const c of [...p.cols, ...(p.doorCols || [])]) c.r = -9; if (p.sh) SHELTERS.splice(SHELTERS.indexOf(p.sh), 1); if (p.guardEnts) for (const e of p.guardEnts) removeEnt(e); } PLACED.length = 0; for (const r of G.flags.placed || []) buildPlaced(r); }
const nearPlaced = (r = 3.2) => { let b = null, bd = r; for (const p of PLACED) { const B = BUILD_DEF[p.k], rr0 = B.wall ? 2.4 : B.guards ? 4 : (B.r || .5) + 2; const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < Math.max(r, rr0) && d - rr0 < bd) { bd = d - rr0; b = p; } } return b; };

/* ---------- what using a placeable does (E), and Q to dismantle ---------- */
function placedAction(p) {
  const B = BUILD_DEF[p.k], rec = p.rec, n = nameOf(p.k);
  if (B.st) return { l: `${n} · craft`, act: () => openCraft(B.st.includes('forge') ? 'mat' : B.st.includes('bench') ? 'tool' : B.st.includes('lab') ? 'med' : 'food') };
  if (B.store) return { l: `Open ${n.toLowerCase()}`, act: () => openStore(p) };
  if (B.rest) return { l: G.flags.spawn && Math.hypot(G.flags.spawn.x - p.x, G.flags.spawn.z - p.z) < 1 ? `${n} · rest (respawn set)` : `${n} · set respawn here`, act: () => { G.flags.spawn = { x: p.x, z: p.z }; P.hp = Math.min(100, P.hp + 15); sfx('pickup'); toast('You\'ll wake up here if you go down', 2.4); save(); } };
  if (B.door) return { l: rec.open ? 'Close the door' : 'Open the door', act: () => { rec.open = !rec.open; p.g.userData.leaf.rotation.y = rec.open ? -1.5 : 0; for (const c of p.doorCols) c.r = rec.open ? -9 : .32; sfx('gate'); save(); } };
  if (B.tower) { const top = heightAt(p.x, p.z) + B.tower + .1; return { l: P.y < top - 2 ? 'Climb the watchtower' : 'Climb down', act: () => { if (P.y < top - 2) { P.x = p.x; P.z = p.z; P.y = top; } else { P.x = p.x + 2.4; P.z = p.z + 2.4; P.y = heightAt(P.x, P.z); } P.vy = 0; sfx('step'); } }; }
  if (B.make) { const [id, , cap] = B.make, have = rec.n || 0; return { l: have ? `Collect ${have} ${nameOf(id).toLowerCase()}` : `${n} · filling (${have}/${cap})`, act: () => { if (rec.n) { give(id, rec.n); toast(`+${rec.n} ${nameOf(id).toLowerCase()}`); rec.n = 0; sfx('pickup'); save(); } } }; }
  if (B.farm) return farmAction(p);
  if (B.power === 'fuel') return { l: `Generator · fuel ${Math.ceil(rec.fuel || 0)}%${cnt('fuel') ? ' · add fuel' : ''}`, act: () => { if (!cnt('fuel')) { sfx('no'); toast('Needs fuel'); return; } take('fuel', 1); rec.fuel = Math.min(100, (rec.fuel || 0) + 50); sfx('reload'); save(); } };
  if (B.map) return { l: 'Study the map table', act: () => { revealAll('map'); } };
  if (B.books) return { l: 'Read', act: () => { toast(pick(['A field guide to edible plants — mushrooms with white gills are the ones that kill you.', 'A pre-fire almanac. The winters used to be colder.', 'A schematic for a hand-cranked generator, half the pages missing.', TIER_HOW[Math.min(6, tierNow() + 1)] || 'Nothing you don’t know.']), 4); } };
  if (B.radio) return { l: 'Radio tower · listen', act: () => { G.flags.radioTower = 1; for (const R of REGIONS) if (R.base) (G.flags.seen ||= {})[R.id] = 1; toast('Chatter on every band — faction bases marked on the map, and you\'ll hear raiders coming', 3.4); save(); } };
  if (B.turret) return { l: powered() ? 'Security station · armed' : 'Security station · needs power (generator or solar)', act: () => {} };
  if (B.heal) return { l: 'Medical station', act: () => openCraft('med') };
  if (B.guards) return { l: `Barracks · ${p.guardEnts?.filter(e => !e.dead).length || 0} guards`, act: () => { spawnGuards(p, true); } };
  return { l: n, act: () => {} };
}

/* ---------- farming ---------- */
const CROP_OF = { seed_corn: 'corn', seed_potato: 'potato', seed_wheat: 'wheat', seed_bean: 'beans', seed_squash: 'squash', seed_carrot: 'carrot' };
const GROW = 360;
function farmAction(p) {
  const rec = p.rec, B = BUILD_DEF[p.k];
  if (!rec.crop) { const seed = Object.keys(CROP_OF).find(s => cnt(s) > 0); return { l: seed ? `Plant ${nameOf(seed).toLowerCase()}` : 'Farm plot · needs seeds', act: () => { if (!seed) { sfx('no'); toast('No seeds — forage, trade, or cut them from crops'); return; } take(seed, 1); rec.crop = seed; rec.g = 0; if (cnt('fertilizer')) { take('fertilizer', 1); rec.fert = 1; } farmShow(p); sfx('pickup'); toast(`Planted${rec.fert ? ' (fertilized)' : ''} · ready in about ${Math.round(GROW / B.farm / (rec.fert ? 2 : 1) / 60)} min`); save(); } }; }
  if (rec.g < 1) return { l: `${nameOf(CROP_OF[rec.crop])} growing · ${Math.round(rec.g * 100)}%`, act: () => {} };
  return { l: `Harvest ${nameOf(CROP_OF[rec.crop]).toLowerCase()}`, act: () => { const n = (3 + Math.floor(rnd() * 3)) * B.farm; give(CROP_OF[rec.crop], n); const s = 1 + Math.floor(rnd() * 2); give(rec.crop, s); toast(`+${n} ${nameOf(CROP_OF[rec.crop]).toLowerCase()} · +${s} seeds`); rec.crop = null; farmShow(p); sfx('pickup'); save(); } };
}
function farmShow(p) {
  if (p.g.userData.plants) { p.g.remove(p.g.userData.plants); p.g.userData.plants = null; }
  if (!p.rec.crop) return;
  const pl = new THREE.Group(), k = .2 + Math.min(1, p.rec.g || 0) * .8, col = { seed_corn: 0x7a9a3a, seed_wheat: 0xb8a050, seed_squash: 0x4a8a3a, seed_carrot: 0x5a9a3a, seed_potato: 0x4a7a3a, seed_bean: 0x5a8a4a }[p.rec.crop];
  const W = BUILD_DEF[p.k].farm > 1 ? 2.6 : 1.6;
  for (let i = 0; i < (W > 2 ? 12 : 8); i++) { const c = mesh(new THREE.ConeGeometry(.12, .7, 5), M(col), -W / 2 + .2 + (i % 4) * W / 4, .35 * k + .3, -.4 + Math.floor(i / 4) * .45, pl); c.scale.setScalar(k); if ((p.rec.g || 0) >= 1) mesh(new THREE.SphereGeometry(.07, 6, 4), M(0xe0a030), c.position.x, c.position.y + .3, c.position.z, pl); }
  p.g.add(pl); p.g.userData.plants = pl;
}

/* ---------- barracks guards: Arc folk with rifles who shoot at raiders ---------- */
function spawnGuards(p, refill) {
  p.guardEnts = (p.guardEnts || []).filter(e => !e.dead && ents.includes(e));
  const want = BUILD_DEF[p.k].guards; if (refill && p.guardEnts.length >= want) { toast('Barracks is fully manned'); return; }
  if (refill && cnt('ration') + cnt('dried_meat') + cnt('canned') < 2) { sfx('no'); toast('Feed a new guard: 2 cooked/dried meat or canned food'); return; }
  while (p.guardEnts.length < want) {
    if (refill) { for (let k = 0; k < 2; k++) { const f = ['ration', 'dried_meat', 'canned'].find(id => cnt(id) > 0); if (f) take(f, 1); } }
    const e = spawnNPC('guard', p.x + rr(-3, 3), p.z + rr(-3, 3), { model: 'michael', tint: 0x4a5a6a, wander: true }); e.guard = 1; e.home = { x: p.x, z: p.z }; e.hp = 100; e.fireT = 0;
    const gm = modelCopy('gun-night', .7, 'z'); if (gm) { gm.position.set(.25, e.p.H * .55, .25); e.p.body.add(gm); }
    p.guardEnts.push(e); if (refill) { toast('A new guard joins the barracks'); break; }
  }
}
function updGuard(e, dt) {
  e.fireT -= dt; if (e.fireT > 0) return false;
  let best = null, bd = 42; for (const t of ents) if (t.type === 'clan' && !t.dead) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < bd) { bd = d; best = t; } }
  if (!best) { e.fireT = .5; return false; }
  e.fireT = rr(.6, 1.1); e.yaw = Math.atan2(best.x - e.x, best.z - e.z);
  const from = new THREE.Vector3(e.x, e.y + 1.4, e.z), to = new THREE.Vector3(best.x + rr(-.3, .3), best.y + 1.2, best.z + rr(-.3, .3));
  tracer(from, to, 0xffe0a0); sfx('turret', Math.max(.15, 1 - Math.hypot(e.x - P.x, e.z - P.z) / 80));
  if (rnd() < .6) damage(best, 24, false, to);
  return true;
}

/* ---------- per-frame: fires, lights, spikes, turrets, crops, water, fuel, healing ---------- */
const PLIGHTS = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa860, 0, 16, 1.6); world.add(l); PLIGHTS.push(l); }
let placeT = 0;
function updPlaced(dt) {
  placeT -= dt; const slow = placeT <= 0; if (slow) placeT = 1;
  const pw = slow ? powered() : null, nightK = isNight() ? 1 : .25;
  const lit = [];
  for (const p of PLACED) {
    const B = BUILD_DEF[p.k], rec = p.rec, d = Math.hypot(p.x - P.x, p.z - P.z);
    if (p.g.userData.flame) { const f = p.g.userData.flame; f.scale.y = 1 + Math.sin(G.t * 13 + p.x) * .15; }
    if (B.light && d < 60) lit.push([d, p]);
    if (B.spikes) for (const e of ents) if (e.type === 'clan' && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 2) { e.hp -= 35 * dt; e.slow = .5; if (e.hp <= 0) damage(e, 1, false, new THREE.Vector3(e.x, e.y + 1, e.z)); }
    if (B.turret && (slow ? (p.pw = pw) : p.pw)) {
      p.cool = (p.cool || 0) - dt;
      if (p.cool <= 0) { let best = null, bd = 46; for (const e of ents) if (e.type === 'clan' && !e.dead) { const dd = Math.hypot(e.x - p.x, e.z - p.z); if (dd < bd) { bd = dd; best = e; } }
        p.cool = best ? .4 : .5;
        if (best) { const h = p.g.userData.head; h.rotation.y = Math.atan2(best.x - p.x, best.z - p.z) - p.yaw + Math.PI; const from = new THREE.Vector3(p.x, heightAt(p.x, p.z) + 1.3, p.z), to = new THREE.Vector3(best.x, best.y + 1.2, best.z); tracer(from, to, 0xff8080); sfx('turret', Math.max(.15, 1 - d / 90)); if (rnd() < .75) damage(best, 26, false, to); } }
    }
    if (!slow) continue;
    if (B.farm && rec.crop && rec.g < 1) { rec.g = Math.min(1, (rec.g || 0) + B.farm * (rec.fert ? 2 : 1) / GROW); if (Math.round(rec.g * 10) !== Math.round((rec.g - B.farm / GROW) * 10) || rec.g >= 1) farmShow(p); }
    if (B.make) { const [, every, cap] = B.make; rec.t = (rec.t || 0) + (rust.state === 'none' ? 1 : 2); if (rec.t >= every) { rec.t = 0; rec.n = Math.min(cap, (rec.n || 0) + 1); } }
    if (B.power === 'fuel' && rec.fuel > 0) { rec.fuel = Math.max(0, rec.fuel - .25); if (p.g.userData.lamp) p.g.userData.lamp.visible = true; } else if (p.g.userData.lamp && B.power) p.g.userData.lamp.visible = false;
    if (B.radio && p.g.userData.lamp) p.g.userData.lamp.visible = Math.sin(G.t * 3) > 0;
    if (B.heal && d < 4.5 && !P.dead) { P.hp = Math.min(100, P.hp + 2); if (P.bleed > 0) P.bleed = Math.max(0, P.bleed - 6); }
  }
  lit.sort((a, b) => a[0] - b[0]);
  PLIGHTS.forEach((l, i) => { const q = lit[i]; if (!q) { l.intensity = 0; return; } const p = q[1]; l.position.set(p.x, heightAt(p.x, p.z) + (p.k === 'lantern' ? 1.8 : 1.2), p.z); l.intensity = (p.k === 'lantern' ? 2.2 : 3) * nightK * (1 + Math.sin(G.t * 17 + i) * .08); });
}

/* ---------- storage ---------- */
let storeAt = null;
function openStore(p) { storeAt = p; invTab = 'store'; toggleInv(true); }
function storeUsed(p) { return Object.values(p.rec.inv || {}).length + (p.rec.gear || []).length; }
function storePut(id, all) {
  const p = storeAt, B = BUILD_DEF[p.k];
  if (typeof id === 'number') { const g = INV.tools.find(t => t.u === id); if (!g) return; if (storeUsed(p) >= B.store) { toast('Full'); return; } unequip(g); INV.tools.splice(INV.tools.indexOf(g), 1); p.rec.gear.push(g); }
  else { if (B.gearOnly) { toast('Weapons and tools only'); return; } if (!p.rec.inv[id] && storeUsed(p) >= B.store) { toast('Full'); return; } const n = all ? cnt(id) : 1; take(id, n); p.rec.inv[id] = (p.rec.inv[id] || 0) + n; }
  sfx('pickup'); save();
}
function storeTake(id, all) {
  const p = storeAt;
  if (typeof id === 'number') { const j = p.rec.gear.findIndex(g => g.u === id); if (j < 0) return; INV.tools.push(p.rec.gear.splice(j, 1)[0]); }
  else { const n = all ? p.rec.inv[id] : 1; give(id, n); p.rec.inv[id] -= n; if (p.rec.inv[id] <= 0) delete p.rec.inv[id]; }
  sfx('pickup'); save();
}
