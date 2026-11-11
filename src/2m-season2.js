
/* ================= Season 2: the Mountain (Nov 11, Part 10 of the overhaul) =================
   Days 101–200. The world gets bigger, not replaced:
   · THE MOUNTAIN — Greyhold's facility under the grey mountain, a pocket of its own (`buildMountain`): the front gate
     (through Greyhold Station's bunker, with a Greyhold card), a security checkpoint with cameras and a turret, a bright
     concourse, living quarters where Greyhold's people live, a mess, a clinic that looks like any clinic — and beyond the
     red-card doors the harvest ward, the cells, the armory, the commander's office with a room behind it. The reactor
     hall: shut the reactor down and the cameras and turret die, the lights go red and the card doors fail open. Below,
     the maintenance level runs the width of it, to a vent on the mountainside (the quiet way in, bolt cutters) and to
     the Hollowed tunnels.
   · THE HOLLOWED — fog-mad people who live in tunnels under the north-west outlands and come out on raid nights now
     (a faction nobody can talk to). Their tunnels are a pocket of their own with captives in cages.
   · pocket fighters (`pkEntUpd`): Greyhold troopers and the Hollowed fight you inside pockets — they share the pocket's
     walls (`pkValid`) instead of the world's.
   · up top: Greyhold troopers (tougher, grenades) on the roads, the Spoke (another piece of the Arc, down on day 101,
     with people alive in it), Greyhold checkpoints on the valley roads, the Hollowed in Whisper Cave.
   · gear: a Greyhold respirator, trooper armour, the Hollowed's cloak, stims, trauma kits; the Mountain's own loot.
   Missions that use all this are in Part 11 (2n-season2-story.js). */

/* ---------- gear ---------- */
for (const [id, n, c, w] of [['stim', 'Stim injector', 'med', .1], ['trauma_kit', 'Trauma kit', 'med', .8], ['mtn_card', 'Greyhold red card', 'story', .02]]) if (!ITEMS[id]) ITEMS[id] = { id, n, c, t: 4, src: c === 'story' ? 'story' : 'salv', w };
Object.assign(MEDS, { stim: { h: 30, fix: [], fn: () => { P.stam = 100; P.winded = false; return 'second wind'; } }, trauma_kit: { h: 80, fix: ['bleed', 'frac', 'sick', 'dose'] } });
Object.assign(GEAR_DEFS, {
  grey_mask: { n: 'Greyhold respirator', kind: 'wear', slot: 'head', prot: .08, fog: .85, dur: 260, t: 4, w: 1.2 },
  trooper_armor: { n: 'Mountain trooper armour', kind: 'wear', slot: 'body', prot: .6, fog: .4, mob: -.05, cap: 4, dur: 520, t: 5, w: 9 },
  hollow_cloak: { n: 'Hollowed cloak', kind: 'wear', slot: 'body', prot: .1, stealth: .35, dur: 140, t: 3, w: 2 },
});
Object.assign(LORE, { mtn_card: 'Red-stripe Greyhold access. Opens the Mountain’s restricted wards.', stim: 'Adrenaline and something else. Stamina back, now.', trauma_kit: 'Everything a field surgeon needs. Fixes nearly anything.' });
LOOT.mtn = { ammo_556: [.8, 20, 50], ammo_762: [.4, 10, 20], stim: [.3], trauma_kit: [.15], medkit: [.4], blood_bag: [.3], inject: [.3], rust_med: [.35, 1, 2], battery: [.4, 1, 2], circuit: [.4, 1, 2], sensor: [.3], lab_sample: [.25], greyhold_files: [.1], blackvein: [.06], shielding: [.2] };
GEAR_LOOT.mtn = [.5, ['grey_rifle', 'grey_armor', 'grey_mask', 'trooper_armor', 'nvg', 'gas_mask', 'med_scanner', 'rust_detector', 'lock_bypass']];
RECIPES.push(R_('stim', { painkiller: 1, inject: 1 }, 'med', 4, { at: 'lab' }), R_('trauma_kit', { medkit: 1, blood_bag: 1, inject: 1 }, 'med', 4, { at: 'lab' }), R_('grey_mask', { gas_mask: 1, sensor: 1, synth: 2 }, 'wear', 4, { at: 'bench' }));

/* ---------- the Hollowed ---------- */
let HOLLOW_NEST = null;
FAC.hollow = { n: 'the Hollowed', c: '#8a2a22', cap: () => HOLLOW_NEST, leader: ['The Pale One', 'first'], rep: -100, floor: -100, kind: 'clan', since: 101, rw: .7, want: [], mute: 1, s2: 1, cap_r: 40 };
FAC_IDS.push('hollow'); for (const f of ['thorn', 'pines', 'ridge', 'root', 'iron', 'grey', 'arc']) FAC_WAR.push(['hollow', f]);
const S2 = () => !!G.flags.s2 || G.day > 100;

/* ---------- fighters inside pockets ---------- */
function pkSpawn(pk, kind, lx, lz, o = {}) {
  const fac = o.fac || (kind === 'soldier' ? 'grey' : 'clan'), [x, z] = pw(pk, lx, lz);
  const e = spawnClan(kind, x, z, 'guard', fac); e.pk = pk; e.tribe = o.tribe || (fac === 'grey' ? 'grey' : 'hollow'); e.y = pk.y + (o.y || 0); e.g.position.y = e.y; e.home = { x, z }; e.route = null; e.pkHome = { x, z };
  if (o.hollow) { e.hp = e.maxhp = 60; e.speed = 6; e.g.scale.set(.95, .92, .95); e.hollow = 1; }
  if (fac === 'grey') { e.hp = e.maxhp = e.maxhp * 1.3; e.trooper = 1; }
  if (o.patrol) e.pkPatrol = o.patrol.map(([a, b]) => { const [px, pz] = pw(pk, a, b); return { x: px, z: pz }; });
  if (o.boss) { e.hp = e.maxhp = o.boss; e.name = o.name; e.leader = 'grey'; e.g.scale.multiplyScalar(1.1); }
  return e;
}
function pkEntUpd(e, dt) {
  const pk = e.pk, p = e.p;
  if (UG.at !== pk) { e.g.visible = false; return true; } e.g.visible = true;
  e.t += dt; e.cool -= dt;
  if (e.stun > 0) { e.stun -= dt; return true; }
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp), gun = e.kind === 'soldier' || e.kind === 'gunner', sameLevel = Math.abs(P.y - e.y) < 2.4;
  let tx = e.x, tz = e.z, spd = 0;
  if (e.state === 'idle') {
    const sees = (gun ? 24 : 18) * stealthK() * (pk.powered === false ? .7 : 1);
    if (dp < sees && sameLevel && !P.dead) { e.state = 'chase'; sfx('grunt'); for (const o of ents) if (o.pk === pk && !o.dead && o.state === 'idle' && Math.hypot(o.x - e.x, o.z - e.z) < 20) o.state = 'chase'; }
    else if (e.pkPatrol) { const w = e.pkPatrol[e.pi || 0]; if (Math.hypot(w.x - e.x, w.z - e.z) < 1) e.pi = ((e.pi || 0) + 1) % e.pkPatrol.length; tx = w.x; tz = w.z; spd = 1.6; }
    else if (e.inv) { tx = e.inv.x; tz = e.inv.z; spd = 2.2; if (Math.hypot(tx - e.x, tz - e.z) < 1.5) e.inv = null; }
  }
  if (e.state === 'chase') {
    if (P.dead || !sameLevel && dp > 6) { e.state = 'idle'; e.inv = { x: P.x, z: P.z }; }
    else if (gun) {
      if (dp > 14) { tx = P.x; tz = P.z; spd = e.speed; } else if (dp < 7) { tx = e.x - dxp; tz = e.z - dzp; spd = e.speed * .7; }
      if (e.cool <= 0 && dp < 26) { e.cool = rr(.9, 1.5); e.yaw = Math.atan2(dxp, dzp); const from = new THREE.Vector3(e.x, e.y + 1.45, e.z), to = new THREE.Vector3(P.x + rr(-.4, .4), P.y + 1.2, P.z + rr(-.4, .4));
        tracer(from, to, 0xffd890); sfx('turret', Math.max(.3, 1 - dp / 40)); if (rnd() < clamp(.5 - dp / 60 - (P.crouch ? .1 : 0), .1, .5)) hurtPlayer(rr(8, 12), e.x, e.z); }
    } else {
      tx = P.x; tz = P.z; spd = e.speed;
      if (dp < 1.9 && e.cool <= 0) { e.cool = e.hollow ? .9 : 1.2; e.yaw = Math.atan2(dxp, dzp); sfx('swing'); hurtPlayer(e.hollow ? 12 : 14, e.x, e.z); p.body.rotation.x = .35; }
    }
  }
  // move inside the pocket's rooms
  let v = 0;
  if (spd) { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d > .1) { const st = Math.min(d, spd * dt), nx = e.x + dx / d * st, nz = e.z + dz / d * st;
      if (pkValid(pk, nx, nz, e.y, .35)) { e.x = nx; e.z = nz; v = spd; } else if (pkValid(pk, nx, e.z, e.y, .35)) { e.x = nx; v = spd * .7; } else if (pkValid(pk, e.x, nz, e.y, .35)) { e.z = nz; v = spd * .7; }
      e.yaw = Math.atan2(dx, dz); } }
  if (e.state === 'chase' && !v) e.yaw = Math.atan2(dxp, dzp);
  const fy = floorAt(e.x, e.z, e.y + .5); if (fy > -1e8) e.y = fy;
  if (p.body.rotation.x > 0) p.body.rotation.x = Math.max(0, p.body.rotation.x - dt * 2);
  e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
  e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
  return true;
}
// grenades from Greyhold troopers on the surface
const NADES = [];
function trooperUpd(e, dt, dp) {
  if (!e.trooper && e.fac === 'grey' && S2()) { e.trooper = 1; e.hp = e.maxhp = e.maxhp * 1.4; }
  if (!e.trooper || e.pk || e.state !== 'chase' || dp < 10 || dp > 28) return;
  if ((e.nadeT = (e.nadeT ?? rr(4, 10)) - dt) > 0) return; e.nadeT = rr(11, 16);
  const tx = P.x + P.vx * .6, tz = P.z + P.vz * .6, b = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), M(0x3a4a2a)); world.add(b); const x0 = e.x, z0 = e.z, y0 = e.y + 1.6; let t = 0; sfx('whoosh');
  NADES.push(dt2 => { t += dt2; const k = Math.min(1, t / 1.2); b.position.set(lerp(x0, tx, k), lerp(y0, heightAt(tx, tz) + .15, k) + Math.sin(k * Math.PI) * 4, lerp(z0, tz, k));
    if (k >= 1) { if (t < 2.1) { if (Math.sin(t * 30) > 0) sfx('dry', .3); return true; } world.remove(b); sfx('boom'); puff(tx, heightAt(tx, tz) + .5, tz, 0x6a6058, 18, 6, .25, 1, -2); const d = Math.hypot(P.x - tx, P.z - tz); if (d < 5.5 && !P.dead) hurtPlayer(Math.round(42 * (1 - d / 5.5)) + 4, tx, tz); return false; }
    return true; });
}

/* ---------- the Mountain ---------- */
let MTN = null;
function buildMountain() {
  const pk = mkPocket('mtn', 'THE MOUNTAIN', { surf: 'metal', fog: 70, hemi: .3, hemiC: 0xc8d4dc, power: true }); pk.sub = 'Safe. Clean. Together.'; MTN = pk;
  const r = { wall: 'concW', floor: 'tile', ceil: 'concW' }, red = { wall: 'concD', floor: 'concD', ceil: 'concD' };
  const R = (a, b, c, d, o = {}) => xRoom(pk, a, b, c, d, { ...r, h: 3.2, ...o });
  R(0, 0, 10, 10, { h: 5 });                       // gate hall
  R(3, 9, 7, 24.5);                                // security checkpoint
  R(-20, 23, 30, 33, { h: 6 });                    // the concourse
  R(-40, 15, -18.5, 41);                           // living quarters
  R(28.5, 20, 46, 36);                             // mess
  R(0, 31.5, 4, 62);                               // medical corridor
  R(2.5, 38, 18, 48);                              // the clinic
  R(-18, 46, -.3, 62, red);                        // the harvest ward
  R(-1, 53.5, 1, 56.5, red);                       // its doorway
  R(4.3, 52, 24, 64, red);                         // the cells
  R(3, 56.5, 5.3, 59.5, red);                      // their doorway
  R(29, 36.3, 42, 46, red);                        // armory
  R(34, 35, 37, 37.2);                             // its doorway
  R(-40, 41.3, -18.5, 60, { ...red, h: 6 });       // reactor hall
  R(-26, 40, -23, 42.5);                           // its doorway
  R(22.5, 46.4, 34, 56);                           // the commander's office
  R(22.5, 32, 25, 47);                             // the hall up to it
  R(33.5, 49.6, 40, 52.4, { wall: 'woodD', floor: 'woodD', ceil: 'woodD' });   // the room behind the shelf
  xRoom(pk, -40, 59.5, -35, 70, { ...red, y: 0, y2: -5, axis: 'z', h: 3.4 });   // stairs down
  xRoom(pk, -42, 69, 44, 74, { ...red, y: -5, h: 3.2 });                       // the maintenance level
  xExit(pk, 5, 0, .6, 'Leave through the front gate', null);
  const g = pk.g, Y = pk.y, P2 = (a, b) => pw(pk, a, b), at = (a, b, y = 0) => { const [x, z] = P2(a, b); return [x, Y + y, z]; };
  // light: bright and clean, until the reactor goes
  pk.lights = []; const L = (a, b, y, c = 0xeef4ff, I = 1.3, d = 16) => { const l = xLamp(g, ...at(a, b, y), c, I, d); l.userData.I = l.intensity; l.userData.C = c; pk.lights.push(l); };
  for (const [a, b] of [[5, 4], [5, 16], [-12, 28], [5, 28], [22, 28], [-30, 22], [-30, 34], [37, 26], [2, 40], [10, 43], [2, 54], [-8, 54], [13, 58], [35, 40], [-30, 47], [-30, 55], [28, 51], [37, 51]]) L(a, b, 3);
  for (let x = -38; x < 44; x += 12) xELamp(pk, x, -2.1, 71.5, 0xff4a2a, .55, 10);
  // the concourse: planters, benches, a sign
  for (let x = -16; x < 28; x += 8) { xbox(g, 2, .7, 1.2, 'concW', ...at(x, 31.5, .35)); for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(.25, .8, 5), new THREE.MeshLambertMaterial({ color: 0x4a8a3a }), ...at(x + rr(-.7, .7), 31.5 + rr(-.4, .4), 1.1), g); xSolid(pk, x - 1, 30.9, x + 1, 32.1); }
  { const s = xbox(g, 8, 1.2, .1, new THREE.MeshBasicMaterial({ color: 0xf0f4f8, toneMapped: false }), ...at(5, 23.2, 4.4)); xbox(g, 7.4, .3, .02, 'dark', ...at(5, 23.26, 4.6)); }
  // the people of the Mountain: they live here and they don't look at you
  const civ = (a, b, ry) => { const pp = makePerson('arc', {}); if (pp.weapon) pp.weapon.visible = false; pp.g.position.set(...at(a, b)); pp.g.rotation.y = ry; g.add(pp.g); xSolid(pk, a - .3, b - .3, a + .3, b + .3); };
  civ(-10, 26, .5); civ(12, 30, 2.4); civ(-30, 20, 1); civ(-26, 38, 3); civ(36, 24, -1); civ(40, 31, 2); civ(10, 46, 3.1);
  xUse({ x: P2(-10, 26)[0], y: Y, z: P2(-10, 26)[1], r: 2.4, pocket: pk, label: () => 'Talk to the woman by the planter', act: () => say([['Greyhold woman', 'You’re from outside? You shouldn’t be walking around. The Captain says the outsiders are… being helped. Downstairs.']]) });
  // living quarters: bunks, a classroom
  for (let i = 0; i < 6; i++) { const [x, y, z] = at(-38, 17 + i * 3.6); for (const yy of [.45, 1.5]) xbox(g, 2, .18, .9, 'white', x + 1, y + yy, z); xSolid(pk, -38, 16.5 + i * 3.6, -36, 17.5 + i * 3.6); }
  for (let i = 0; i < 6; i++) xbox(g, .8, .7, .6, 'wood', ...at(-28 + (i % 3) * 2, 34 + Math.floor(i / 3) * 2, .35)); xbox(g, 4, 1.4, .08, 'dark', ...at(-26, 40.8, 1.6));
  // the mess
  for (const z of [24, 28, 32]) { xbox(g, 9, .08, 1.2, 'metal', ...at(38, z, .76)); xSolid(pk, 33.5, z - .8, 42.5, z + .8); }
  xPCache(pk, 45, 34, -Math.PI / 2, 'none', 'mtn', { id: 'x_mtn_mess', name: 'Mess stores', rolls: 1, keys: ['canned', 'water_filtered'], refill: 5 });
  // the security checkpoint: a scanner arch, cameras, a turret at the far end
  { const [x, y, z] = at(5, 14); for (const s of [-1, 1]) xbox(g, .3, 3, .4, 'metal', x + s * 1.8, y + 1.5, z); xbox(g, 3.9, .3, .4, 'metal', x, y + 3, z); }
  pk.cams = []; const cam = (a, b, zone) => { const [x, y, z] = at(a, b, 3.6); const c = mesh(new THREE.BoxGeometry(.3, .25, .5), xm('metal'), x, y, z, g); const led = mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), x, y - .05, z + .27, g); pk.dyn.add(c); pk.dyn.add(led); pk.cams.push({ led, zone: zone.map((v, i) => v + (i % 2 ? pk.oz : pk.ox)), t: 0 }); };
  cam(5, 10, [3, 9, 7, 24]); cam(5, 24, [-20, 23, 30, 33]); cam(2, 33, [0, 31, 4, 62]);
  pk.turret = { at: at(5, 23.5, 2.6), cool: 0, alive: true }; { const [x, y, z] = pk.turret.at; const t = new THREE.Group(); xbox(t, .6, .5, .9, 'metal', 0, 0, 0); xcyl(t, .06, .06, .8, 'dark', 0, 0, -.7, 6).rotation.x = Math.PI / 2; t.position.set(x, y, z); g.add(t); pk.dyn.add(t); pk.turret.g = t; }
  pk.doors = pk.doors || [];
  pk.doors.push(xDoor(pk, 'mtn_check', 5, 24, 'x', 3.6, { need: () => cnt('mtn_card') > 0 || cnt('greyhold_card') > 0 || pk.powered === false, why: 'needs a Greyhold card', label: 'the checkpoint door' }));
  // the clinic: clean, ordinary
  for (let i = 0; i < 3; i++) { xModel(g, 'props/bed', .6, ...at(6 + i * 4, 46.5), Math.PI) || xbox(g, 2, .5, .9, 'white', ...at(6 + i * 4, 46.5, .25)); xSolid(pk, 5 + i * 4, 45.5, 7 + i * 4, 47.5); }
  xNote(g, 'mt_clinic', ...at(16, 40), 0, pk);
  // red-card doors: the harvest ward, the cells, the armory
  const redDoor = (id, a, b, axis, w, label) => pk.doors.push(xDoor(pk, id, a, b, axis, w, { need: () => cnt('mtn_card') > 0 || pk.powered === false, why: 'needs a red Greyhold card', label }));
  redDoor('mtn_ward', -.6, 55, 'z', 3, 'the harvest ward door'); redDoor('mtn_cells', 4.6, 58, 'z', 3, 'the cell block door'); redDoor('mtn_armory', 35.5, 36.6, 'x', 3, 'the armory door');
  // the harvest ward: what Greyhold does with outsiders
  pk.beds = [];
  for (let i = 0; i < 8; i++) { const a = -15 + (i % 4) * 4, b = i < 4 ? 49 : 58.5; xbox(g, 2.1, .6, 1, 'metal', ...at(a, b, .3)); xcyl(g, .03, .03, 1.8, 'metal', ...at(a + 1.2, b - .4, .9), 6); mesh(new THREE.BoxGeometry(.25, .35, .08), new THREE.MeshLambertMaterial({ color: 0x5a0e0a }), ...at(a + 1.2, b - .4, 1.7), g);
    const pp = makePerson('arc', {}); if (pp.weapon) pp.weapon.visible = false; pp.g.position.set(...at(a, b, .62)); pp.g.rotation.set(-Math.PI / 2, 0, 0); g.add(pp.g); pk.dyn.add(pp.g); xSolid(pk, a - 1.1, b - .6, a + 1.1, b + .6); pk.beds.push({ a, b, g: pp.g }); }
  xNote(g, 'mt_ward', ...at(-1, 47.5, .9), 0, pk); xbox(g, 1.2, .9, .6, 'metal', ...at(-1, 47.5, .45));
  // the cells
  for (let i = 0; i < 4; i++) { const a = 7 + i * 4.4; for (let k = 0; k < 7; k++) xcyl(g, .03, .03, 3, 'metal', ...at(a - 1.5 + k * .5, 61, 1.5), 4); xSolid(pk, a - 1.8, 60.8, a + 1.8, 61.2); }
  xNote(g, 'mt_cells', ...at(22, 54, .02), 0, pk);
  // the armory
  xPCache(pk, 40.5, 40, -Math.PI / 2, 'none', 'mtn', { id: 'x_mtn_armory', name: 'Greyhold weapons racks', big: 1, rolls: 4, keys: ['trooper_armor', 'grey_rifle', 'stim', 'stim'], refill: 0 });
  xPCache(pk, 31, 44.5, 0, 'none', 'mtn', { id: 'x_mtn_ammo', name: 'Ammunition lockers', rolls: 2, refill: 6 });
  // the reactor: shut it down and the Mountain goes dark — and blind
  { const [x, y, z] = at(-30, 51); const core = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 16), new THREE.MeshStandardMaterial({ color: 0x8a9aa8, metalness: .6, roughness: .3, emissive: 0x2a6aff, emissiveIntensity: .6 })); core.position.set(x, y + 2.5, z); g.add(core); pk.dyn.add(core); pk.core = core; xSolid(pk, -32.5, 48.5, -27.5, 53.5);
    const [cx, cy, cz] = at(-24, 44); xbox(g, 1.6, 1.3, .7, 'metal', cx, cy + .65, cz); const lev = mesh(new THREE.BoxGeometry(.1, .5, .1), M(0xd84a2a), cx, cy + 1.5, cz + .3, g); pk.dyn.add(lev);
    xUse({ x: cx, y: Y, z: cz, r: 2.2, pocket: pk, label: () => pk.powered === false ? 'Restart the reactor' : 'Shut the reactor down (cameras, turret and card locks go with it)', act: () => startChan({ l: pk.powered === false ? 'Restarting' : 'Shutting it down', t: 2.4, fn: () => mtnPower(pk.powered === false) }) }); }
  // the commander's office, and the room behind the shelf
  xNote(g, 'mt_vale', ...at(26, 54, 0), Math.PI, pk); xSolid(pk, 25.4, 53.4, 26.6, 54.6);
  xPCache(pk, 32, 47, Math.PI, 'pry', 'mtn', { id: 'x_mtn_desk', name: 'Captain Vale’s desk', rolls: 1, keys: ['mtn_card'], refill: 0 });
  { const sh = new THREE.Group(); sh.position.set(...at(33.8, 51)); g.add(sh); pk.dyn.add(sh); xbox(sh, .5, 2.4, 2.8, 'woodD', 0, 1.2, 0); for (let k = 0; k < 4; k++) xbox(sh, .55, .05, 2.8, 'wood', 0, .3 + k * .6, 0);
    const B = xSolid(pk, 33.4, 49.5, 34.2, 52.5); const mv = () => { B.on = false; sh.position.z = pk.oz + 53.6; };
    xUse({ x: pk.ox + 32.6, y: Y, z: pk.oz + 51, r: 1.6, pocket: pk, label: () => B.on ? 'The bookshelf sits a little off the wall · shift it' : null, act: () => startChan({ l: 'Shifting it', t: 1.2, fn: () => { mv(); (G.flags.xd ||= {}).mtn_shelf = 1; save(); } }) });
    XRESTORE.push(() => { if ((G.flags.xd || {}).mtn_shelf) mv(); }); }
  xNote(g, 'mt_truth', ...at(38.8, 51, .9), Math.PI, pk); xbox(g, 1.2, .9, .6, 'woodD', ...at(38.8, 51, .45)); xSolid(pk, 38.2, 50.4, 39.4, 51.6);
  xPCache(pk, 36.2, 51.7, Math.PI, 'none', 'op', { id: 'x_mtn_secret', name: 'Vale’s private safe', rolls: 2, keys: ['blackvein', 'greyhold_files'], refill: 0 });
  // the maintenance level: a vent up to the mountainside at the east end, a hatch to the tunnels at the west end
  for (let x = -36; x < 42; x += 6) xbox(g, .3, .3, 4.6, 'metal', ...at(x, 71.5, -2.2));
  xNote(g, 'mt_maint', ...at(10, 70, -5), 0, pk);
  // guards
  pk.guardDefs = [['soldier', 4, 7], ['soldier', 6, 18], ['soldier', 5, 28, { patrol: [[-15, 28], [25, 28]] }], ['soldier', 10, 43], ['soldier', 2, 58], ['soldier', 36, 40], ['soldier', -26, 56], ['soldier', 28, 50], ['soldier', 0, 71.5, { y: -5, patrol: [[-30, 71.5], [30, 71.5]] }]];
  mtnBuildEntrances(pk);
}
LOGS.mt_clinic = { at: 'The Mountain', kind: 'term', t: 'Clinic terminal', by: 'Greyhold Medical', b: '> PATIENT LOG — LEVEL 1 CLINIC\n> Routine. Burns, fractures, the usual radiation sickness from the deep tunnels.\n> Outsider intake is handled downstairs (Ward R). Level 1 staff do not attend Ward R.' };
LOGS.mt_ward = { at: 'The Mountain · Ward R', kind: 'term', t: 'Ward R terminal', by: 'Greyhold Medical', b: '> WARD R — MARROW PROGRAMME\n> Our people cannot breathe the surface. Their blood can — the outsiders who survived the fog carry what we lack.\n> Each donor yields three treatments before failure.\n> Current donors: Arc (Kestrel) ×3, clan ×2. Dr. Arden has objected again. Note her objection.' };
LOGS.mt_cells = { at: 'The Mountain · cell block', kind: 'carve', t: 'Scratched into a cell wall', by: 'Prisoners', b: 'Tally marks, hundreds. Clan marks and Arc letters side by side. At the bottom, fresh: THEY TAKE YOU AT NIGHT. THEY GIVE YOU BACK EMPTY. — P.' };
LOGS.mt_vale = { at: 'The Mountain · Captain’s office', kind: 'term', t: 'Captain Vale’s terminal', by: 'Capt. Oren Vale', b: '> To Council: the Kestrel raid yielded five donors. The marrow treatments are working — two of our children walked outside for an hour.\n> The clans call the fog-mad ones Hollowed. We made them. The drug keeps them hungry and keeps them ours.\n> If Kestrel comes, we will be ready.' };
LOGS.mt_truth = { at: 'The Mountain · behind the shelf', kind: 'note', t: 'Dr. Sel Arden’s last letter', by: 'Dr. Sel Arden', b: 'I made the medicine that let us live down here, and they turned it into this. The serum doesn’t need the donors to die — Vale lets them die because it’s cheaper.\n\nIf you are reading this and you are from outside: the reactor hall controls everything. Shut it down and every door in this place fails open. Get them out.' };
LOGS.mt_maint = { at: 'The Mountain · maintenance level', kind: 'note', t: 'A maintenance worker’s chalk notes', by: 'Maintenance', b: 'EAST END → vent to the mountainside (grille rusted, cutters)\nWEST END → old hatch to the drift tunnels. DO NOT OPEN. The Hollowed use them.' };
function mtnPower(on) {
  const pk = MTN; pk.powered = on; (G.flags.mtn ||= {}).off = on ? 0 : 1;
  for (const l of pk.lights) { l.intensity = on ? l.userData.I : 0; if (l.userData.fx) l.userData.fx.material.color.setHex(on ? l.userData.C : 0x2a2a2a); }
  pk.hemi = on ? .3 : .12; pk.hemiC = on ? 0xc8d4dc : 0x7a5048; if (pk.core) pk.core.material.emissiveIntensity = on ? .6 : 0;
  for (const c of pk.cams) c.led.material.color.set(on ? 0xff3a2a : 0x222222);
  if (!on) { for (const D of pk.doors || []) if (!D.open) D.setOpen(true, true); toast('The Mountain goes dark. Cameras, turret and card locks are dead — every door fails open.', 3.4); sfx('thud'); for (const o of ents) if (o.pk === pk && !o.dead && o.state === 'idle') o.inv = { x: pk.ox - 24, z: pk.oz + 44 }; }
  save();
}
function mtnBuildEntrances(pk) {
  // the front gate: Greyhold Station's bunker
  const B = BASES.find(b => b.id === 'greystation'); if (B) { const away = Math.atan2(B.z, B.x), bx = B.x + Math.cos(away) * (B.R + 18), bz = B.z + Math.sin(away) * (B.R + 18), d = Math.atan2(B.x - bx, B.z - bz), ex = bx + Math.sin(d) * 6, ez = bz + Math.cos(d) * 6;
    pk.in = { x: pk.ox + 5, y: pk.y, z: pk.oz + 1.5, yaw: Math.PI }; pk.out = { x: ex + Math.sin(d) * 2.5, z: ez + Math.cos(d) * 2.5, yaw: d + Math.PI };
    xUse({ x: ex, z: ez, r: 3, pocket: null, label: () => !S2() ? 'A blast door. Sealed from inside.' : cnt('greyhold_card') || cnt('mtn_card') ? 'Swipe the card · enter the Mountain' : 'The Mountain’s front gate · needs a Greyhold card', act: () => { if (!S2() || !(cnt('greyhold_card') || cnt('mtn_card'))) { sfx('no'); return; } xGo(pk, pk.in); } }); }
  // the vent on the mountainside, above the Grey Door
  const s = xFind({ tx: POI.vault.x - 60, tz: POI.vault.z - 50, r: 4, sl: 1, hill: 1 }, [], xAvoid()); const vy = heightAt(s.x, s.z);
  { const g = new THREE.Group(); xbox(g, 2.2, 1.4, 1.4, 'concD', 0, .5, 0); xbox(g, 1.6, 1, .1, 'metal', 0, .6, .72); for (let i = 0; i < 6; i++) xbox(g, 1.5, .05, .05, 'dark', 0, .2 + i * .17, .78); g.position.set(s.x, vy, s.z); g.rotation.y = xDownhill(s.x, s.z); world.add(g); addCol(s.x, s.z, 1.2); MTN.vent = { x: s.x, z: s.z };
    xUse({ x: s.x, z: s.z, r: 2.6, pocket: null, label: () => !S2() ? 'A rusted vent grille. Warm air.' : (G.flags.mtn || {}).vent ? 'Climb into the vent' : has('cutters') || cnt('bolt_cutters') ? 'Cut the vent grille (bolt cutters)' : 'A rusted vent grille · bolt cutters would open it',
      act: () => { if (!S2()) return; const M2 = G.flags.mtn ||= {}; if (!M2.vent) { if (!(has('cutters') || cnt('bolt_cutters'))) { sfx('no'); return; } startChan({ l: 'Cutting the grille', t: 2.6, fn: () => { M2.vent = 1; sfx('metal'); save(); } }); return; } xGo(pk, { x: pk.ox + 42, y: pk.y - 5, z: pk.oz + 71.5, yaw: XHPI }); } });
    xExit(pk, 43, -5, 71.5, 'Climb up the vent to the mountainside', { x: s.x + 2, z: s.z + 2, yaw: 0 }); }
}

/* ---------- the Hollowed tunnels ---------- */
let HOLLOW = null;
function buildHollow() {
  const s = xFind({ tx: -1100, tz: -980, r: 12, sl: .9, hill: 1 }, [], xAvoid()); HOLLOW_NEST = { x: s.x, z: s.z, R: 20 }; const f = xDownhill(s.x, s.z), y = heightAt(s.x, s.z);
  REGIONS.push({ id: 'x_hollow', name: 'THE DRIFT', sub: 'Bones at the mouth. Something lives in there.', x: s.x, z: s.z, r: 40, hostile: true });
  { const g = new THREE.Group(); for (const sd of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(3, 1), xm('rockD'), sd * 3.4, 2, -1, g); r.scale.set(.8, 1.3, 1); } const top = mesh(new THREE.DodecahedronGeometry(3.2, 1), xm('rockD'), 0, 5.2, -1.4, g); top.scale.set(1.6, .6, 1);
    mesh(new THREE.PlaneGeometry(4.2, 4.2), xm('dark'), 0, 2, -1.1, g); for (let i = 0; i < 6; i++) { const p = xcyl(g, .05, .07, 2.2, 'woodD', rr(-5, 5), 1.1, rr(1, 4), 5); mesh(new THREE.SphereGeometry(.13, 8, 6), xm('bone'), p.position.x, 2.3, p.position.z, g); mesh(new THREE.PlaneGeometry(.4, .8), xm('cloth'), p.position.x + .2, 1.8, p.position.z, g); }
    xRubble(g, 0, 0, 2, 10, 3, 'bone'); g.position.set(s.x, y - .5, s.z); g.rotation.y = f; world.add(g); }
  const F = xFrame(s.x, s.z, f); for (const sd of [-1, 1]) { const [x, z] = F(sd * 3.4, -1); addCol(x, z, 2.4); } { const [x, z] = F(0, -2.4); addCol(x, z, 1.6); }
  const pk = mkPocket('hollow', 'THE DRIFT TUNNELS', { surf: 'gravel', fog: 30, hemi: .16, hemiC: 0x8a6a60 }); pk.sub = 'They live in the dark and they’re hungry'; HOLLOW = pk;
  const [ex, ez] = F(0, 1.8), [ox, oz] = F(0, 4.5); xEntrance(pk, ex, ez, 'Go down into the tunnels', { x: pk.ox + 2, y: pk.y + 2, z: pk.oz + .9, yaw: Math.PI }, { x: ox, z: oz, yaw: f });
  const r = { wall: 'rockD', floor: 'dirt', ceil: 'rockD' };
  xRoom(pk, 0, 0, 4, 10, { ...r, y: 2, y2: 0, axis: 'z', h: 3.2 }); xRoom(pk, -8, 9, 10, 22, { ...r, h: 4 }); xRoom(pk, 8.5, 14, 40, 18, { ...r, h: 3 }); xRoom(pk, 38.5, 6, 52, 30, { ...r, h: 5 }); xRoom(pk, 50.5, 16, 70, 20, { ...r, h: 3 });
  xExit(pk, 2, 1.9, .5, 'Climb out of the tunnels');
  const g = pk.g, Y = pk.y, at = (a, b, yy = 0) => { const [x, z] = pw(pk, a, b); return [x, Y + yy, z]; };
  for (const [a, b] of [[0, 15], [24, 16], [45, 18], [62, 18]]) { const [x, yy, z] = at(a, b); xLamp(g, x, yy + 1.1, z, 0xff6a2a, .9, 10, false); const fl = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); fl.position.set(x, yy + .45, z); g.add(fl); }
  for (let i = 0; i < 18; i++) { const [x, yy, z] = at(rr(-6, 50), rr(10, 28)); if (!pkValid(pk, x, z, Y, .3)) continue; mesh(new THREE.DodecahedronGeometry(rr(.1, .25), 0), xm('bone'), x, yy + .1, z, g); }
  // cages with the Hollowed's captives
  pk.cages = [];
  for (let i = 0; i < 3; i++) { const a = 42 + i * 4, b = 27.5; for (let k = 0; k < 6; k++) xcyl(g, .04, .04, 2.6, 'woodD', ...at(a - 1.2 + k * .5, b - 1.2, 1.3), 4); xSolid(pk, a - 1.4, b - 1.5, a + 1.4, b + 1); const pp = makePerson(i === 1 ? 'warrior' : 'arc', { fac: i === 1 ? 'clan' : 'arc' }); if (pp.weapon) pp.weapon.visible = false; pp.g.position.set(...at(a, b)); pp.g.rotation.y = Math.PI; g.add(pp.g); pk.dyn.add(pp.g); pk.cages.push({ a, b, g: pp.g, id: 'cage' + i });
    xUse({ x: pw(pk, a, b - 2.2)[0], y: Y, z: pw(pk, a, b - 2.2)[1], r: 1.8, pocket: pk, label: () => ((G.flags.mtn || {}).cages || {})['cage' + i] ? null : 'Break the cage open', act: () => startChan({ l: 'Breaking it open', t: 2, fn: () => { ((G.flags.mtn ||= {}).cages ||= {})['cage' + i] = G.day; pp.g.visible = false; if (i === 1) facAdd('thorn', 10, 'you freed one of theirs'); else G.flags.rescued = (G.flags.rescued || 0) + 1; toast('They run for the light', 2.6); save(); } }) }); }
  XRESTORE.push(() => { for (const c of pk.cages) c.g.visible = !((G.flags.mtn || {}).cages || {})[c.id]; });
  xPCache(pk, 50, 9, Math.PI / 2, 'none', 'clan', { id: 'x_hollow_hoard', name: 'The Hollowed’s hoard', big: 1, rolls: 3, keys: ['hollow_cloak'], refill: 0 });
  // the far end: the old hatch into the Mountain's maintenance level
  xUse({ x: pw(pk, 69, 18)[0], y: Y, z: pw(pk, 69, 18)[1], r: 2.2, pocket: pk, label: () => 'A rusted hatch in the rock · into the Mountain', act: () => xGo(MTN, { x: MTN.ox - 40, y: MTN.y - 5, z: MTN.oz + 71.5, yaw: -XHPI }) });
  xUse({ x: MTN.ox - 41, y: MTN.y - 5, z: MTN.oz + 71.5, r: 2, pocket: MTN, label: () => 'The old hatch to the drift tunnels', act: () => xGo(pk, { x: pk.ox + 68, y: pk.y, z: pk.oz + 18, yaw: XHPI }) });
  pk.guardDefs = [['warrior', 0, 18], ['warrior', 4, 12], ['warrior', 20, 16], ['thrower', 30, 15], ['warrior', 44, 12], ['warrior', 48, 20], ['brute', 45, 25], ['warrior', 60, 18]];
}

/* ---------- up top in Season 2 ---------- */
let SPOKE = null;
function buildSpoke() {
  const s = xFind({ tx: 1200, tz: 1250, r: 40, sl: .3 }, [], xAvoid()); const yaw = rr(0, 6), F = xFrame(s.x, s.z, yaw), y = heightAt(s.x, s.z);
  const g = new THREE.Group(); g.visible = false; world.add(g); g.userData.dyn = 1; SPOKE = { x: s.x, z: s.z, g };
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(4, 2); const skin = new THREE.MeshStandardMaterial({ map: t, color: 0xb8b4ac, metalness: .45, roughness: .6, side: THREE.DoubleSide });
  const ring = mesh(new THREE.TorusGeometry(24, 3.2, 10, 40, 1.5), skin, s.x, y - 14, s.z, g); ring.rotation.set(Math.PI / 2 - .35, 0, yaw);
  const hub = mesh(new THREE.CylinderGeometry(5, 5, 14, 18, 1, true), skin, ...(() => { const [x, z] = F(-12, 6); return [x, heightAt(x, z) + 3.5, z]; })(), g); hub.rotation.set(.4, yaw, 1.3);
  for (let i = 0; i < 12; i++) { const [x, z] = F(rr(-40, 40), rr(-30, 30)); const m = mesh(new THREE.BoxGeometry(rr(1, 3), rr(.15, .4), rr(1, 2.5)), skin, x, heightAt(x, z) + .3, z, g); m.rotation.set(rr(-1, 1), rr(0, 6), rr(-.5, .5)); }
  for (let i = 0; i < 4; i++) { const [x, z] = F(rr(-20, 20), rr(-20, 20)); const f = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.6, 7), new THREE.MeshBasicMaterial({ color: 0xff8a30 })); f.position.set(x, heightAt(x, z) + .8, z); g.add(f); }
  // the people who walked out of it
  SPOKE.people = []; for (let i = 0; i < 5; i++) { const [x, z] = F(8 + (i % 3) * 2, 10 + Math.floor(i / 3) * 2); const pp = makePerson('arc', {}); if (pp.weapon) pp.weapon.visible = false; pp.g.position.set(x, heightAt(x, z), z); pp.g.rotation.y = rr(0, 6); g.add(pp.g); SPOKE.people.push(pp); }
  { const [x, z] = F(10, 12); SPOKE.talk = { x, z }; }
}
// Greyhold checkpoints on the valley roads (Season 2)
const GCHECK = [];
function s2Checkpoints() {
  for (const a of [Math.PI * .75, -Math.PI * .2]) { let best = null; for (let k = -30; k <= 30; k += 3) { const r = 420, x = Math.cos(a + k / r) * r, z = Math.sin(a + k / r) * r, d = pathDist(x, z); if (!best || d < best.d) best = { x, z, d }; }
    if (best) GCHECK.push(best); }
}
function s2Spawn() {
  // the Mountain's and the tunnels' people, inside their pockets
  for (const [pk, src] of [[MTN, MTN.guardDefs], [HOLLOW, HOLLOW.guardDefs]]) {
    if (ents.some(e => e.pk === pk && !e.dead)) continue;
    for (const [k, a, b, o = {}] of src) pkSpawn(pk, k, a, b, { ...o, hollow: pk === HOLLOW, fac: pk === HOLLOW ? 'clan' : 'grey' });
  }
  // Greyhold checkpoints up top
  for (const C of GCHECK) if (!ents.some(e => e.gcheck === C && !e.dead)) for (let i = 0; i < 3; i++) { const e = spawnClan('soldier', C.x + rr(-4, 4), C.z + rr(-4, 4), 'guard', 'grey'); e.tribe = 'grey'; e.gcheck = C; }
  // the Hollowed in Whisper Cave now
  const cave = POCKETS.cave; if (cave && !ents.some(e => e.pk === cave && !e.dead)) for (const [a, b] of [[0, 18], [10, 17], [16, 18]]) pkSpawn(cave, 'warrior', a, b, { hollow: true, fac: 'clan', y: b === 18 && a === 16 ? -5 : 0 });
}
function s2Sync() {
  const on = S2();
  if (SPOKE) SPOKE.g.visible = on;
  if (on && SPOKE && !REGIONS.some(r => r.id === 'x_spoke')) REGIONS.push({ id: 'x_spoke', name: 'THE SPOKE', sub: 'It came down on day 101 · people walked out of it', x: SPOKE.x, z: SPOKE.z, r: 50 });
  if (MTN && (G.flags.mtn || {}).off) mtnPower(false); else if (MTN) mtnPower(true);
  if (on) s2Spawn();
}

/* ---------- each frame ---------- */
let s2T = 0, camAlarmT = 0;
function updSeason2(dt) {
  for (const n of [...NADES]) if (!n(dt)) NADES.splice(NADES.indexOf(n), 1);
  const pk = UG.at;
  if (pk === MTN && MTN.powered !== false && !P.dead) {
    // cameras: stand in their view too long (crouching helps) and the alarm goes
    for (const c of MTN.cams) { const [x0, z0, x1, z1] = c.zone, inZ = P.x > x0 && P.x < x1 && P.z > z0 && P.z < z1; c.t = inZ ? c.t + dt * (P.crouch ? .35 : 1) : Math.max(0, c.t - dt); c.led.visible = Math.sin(G.t * (inZ ? 14 : 3)) > 0;
      if (c.t > 1.6 && G.t > camAlarmT) { camAlarmT = G.t + 40; c.t = 0; toast('A camera’s seen you — the alarm’s going!', 3); horn(88, 1.6, .2, 4); for (const o of ents) if (o.pk === MTN && !o.dead) o.state = 'chase'; for (let i = 0; i < 3; i++) pkSpawn(MTN, 'soldier', 5 + rr(-2, 2), 3 + rr(0, 4)).state = 'chase'; } }
    // the checkpoint turret
    const T = MTN.turret; if (T.alive) { const [tx, ty, tz] = T.at, d = Math.hypot(P.x - tx, P.z - tz); T.cool -= dt;
      if (d < 16 && P.z < tz && Math.abs(P.x - tx) < 3 && T.cool <= 0) { T.cool = .45; T.g.rotation.y = Math.atan2(P.x - tx, P.z - tz); tracer(new THREE.Vector3(tx, ty, tz), new THREE.Vector3(P.x + rr(-.3, .3), P.y + 1.2, P.z + rr(-.3, .3)), 0xff8a6a); sfx('turret', .8); if (rnd() < (P.crouch ? .3 : .5)) hurtPlayer(6, tx, tz); } }
  }
  s2T -= dt; if (s2T > 0) return; s2T = 2;
  if (S2() && !G.flags.s2seen) { G.flags.s2seen = 1; s2Sync(); }
  if (S2()) { if (SPOKE && !SPOKE.g.visible) s2Sync(); s2Spawn(); }
}
function buildSeason2() { const s0 = seed; seed = 9090909; for (const [n, f] of [["m", buildMountain], ["h", buildHollow], ["s", buildSpoke], ["c", s2Checkpoints]]) { try { f(); } catch (err) { console.error("S2BUILD", n, err.message, String(err.stack).split("\n").slice(0, 4).join(" / ")); } } for (const id of ['mtn', 'hollow']) xSeal(POCKETS[id]); window.__S2 = { MTN: () => MTN, HOLLOW: () => HOLLOW, SPOKE: () => SPOKE, s2Sync, s2Spawn, mtnPower, pkSpawn, GCHECK, NADES }; seed = s0; }
function season2Restore() { s2Sync(); }
