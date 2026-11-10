
/* ================= Cinder City, the Foundry, and the other bases =================
   The city is 840m of dead towers on a street grid, built from a handful of instanced meshes so it stays cheap.
   The Foundry is the district Ironjaw rebuilt: scrap walls, towers, workshops, and the best loot in the land behind locks.
   Out in the wilds: Farlight (friendly Arc traders), Greyhold Station (soldiers), and two Ironjaw yards. */

const FAR_GROUPS = [];                         // whole districts hidden when you're far away
function farGroup(x, z, r) { const g = new THREE.Group(); world.add(g); FAR_GROUPS.push({ g, x, z, r }); return g; }
function updFarGroups(px, pz) { for (const F of FAR_GROUPS) F.g.visible = Math.hypot(px - F.x, pz - F.z) < F.r + 480; }

/* facade: windows and floor lines drawn in the shader from world position, so one material fits every tower size */
function facadeMat() {
  const m = new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xffffff, emissive: 0x2a2826 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec4 cw = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vCN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);\n#else\n vec4 cw = modelMatrix * vec4(transformed, 1.0); vCN = normalize(mat3(modelMatrix) * objectNormal);\n#endif\n vCW = cw.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (abs(vCN.y) < .5) {
    float hz = abs(vCN.x) > .5 ? vCW.z : vCW.x;
    float fy = fract(vCW.y / 3.4), fx = fract(hz / 3.1);
    float win = step(.32, fy) * step(fy, .82) * step(.18, fx) * step(fx, .82);
    float cell = fract(sin(dot(floor(vec2(hz / 3.1, vCW.y / 3.4)), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 glass = cell > .7 ? vec3(.05) : cell > .45 ? vec3(.10, .12, .13) : vec3(.18, .2, .2);
    diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * (cell > .93 ? .3 : 1.));
    diffuseColor.rgb *= 1. - step(fy, .06) * .25;
  }`);
  };
  return m;
}
const _d = new THREE.Object3D(), _c = new THREE.Color();
function instanced(geo, mat, list, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((q, i) => { _d.position.set(q[0], q[1], q[2]); _d.rotation.set(q[6] || 0, q[7] || 0, q[8] || 0); _d.scale.set(q[3], q[4], q[5]); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); if (q[9] != null) im.setColorAt(i, _c.set(q[9])); });
  im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); return im;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, .5, 0);

/* locked caches: each needs a particular tool or key, and holds a better loot table */
const LOCKS = { pry: ['crowbar', 'Pry it open (crowbar)'], cutter: ['bolt_cutters', 'Cut the chain (bolt cutters)'], bypass: ['lock_bypass', 'Bypass the lock (electronic bypass)'],
  card: ['greyhold_card', 'Swipe a Greyhold card'], chip: ['id_chip', 'Use an Arc ID chip'], none: [null, 'Search the stash'] };
const CACHES = [];
function cache(parent, x, z, yaw, lock, table, o = {}) {
  const g = new THREE.Group(), big = o.big;
  const body = S(big ? 0x5a5e62 : lock === 'none' ? 0x6a5a3a : 0x4a5a4a, { metalness: .5, roughness: .5 });
  mesh(new THREE.BoxGeometry(big ? 2.6 : 1.5, big ? 1.6 : .9, big ? 1.4 : .8), body, 0, big ? .8 : .45, 0, g);
  if (lock !== 'none') { const lamp = new THREE.Mesh(new THREE.BoxGeometry(.18, .18, .05), new THREE.MeshBasicMaterial({ color: { pry: 0xffa040, cutter: 0xffd040, bypass: 0x40c0ff, card: 0xe8e8e8, chip: 0x60ffd0 }[lock], toneMapped: false })); lamp.position.set(0, big ? 1.2 : .65, big ? .72 : .42); g.add(lamp); }
  g.position.set(x, heightAt(x, z), z); g.rotation.y = yaw; parent.add(g); addCol(x, z, big ? 1.3 : .8);
  const C = { id: o.id || `c${CACHES.length}`, x, z, lock, table, rolls: o.rolls ?? 1, keys: o.keys || [], g, name: o.name, refill: o.refill ?? 3 };
  CACHES.push(C); return C;
}
const cacheOpen = C => { const o = (G.flags.caches || {})[C.id]; return o != null && (C.refill <= 0 || G.day - o < C.refill); };
function nearCache() { let b = null, bd = 2.8; for (const C of CACHES) { const d = Math.hypot(C.x - P.x, C.z - P.z); if (d < bd) { bd = d; b = C; } } return b; }
function cacheAction(C) {
  if (cacheOpen(C)) return { l: `${C.name || 'Stash'} · empty (refills in ${Math.max(1, C.refill - (G.day - G.flags.caches[C.id]))} days)`, act: () => {} };
  const [need, label] = LOCKS[C.lock], ok = !need || (GEAR_DEFS[need] ? has(GEAR_DEFS[need].kind) : cnt(need) > 0);
  if (!ok) return { l: `${C.name || 'Locked'} · needs ${nameOf(need).toLowerCase()}`, act: () => { sfx('no'); toast(`Locked — ${label.toLowerCase()}`, 2.4); } };
  return { l: (C.name ? C.name + ' · ' : '') + label, act: () => startChan({ l: label.split(' (')[0], t: C.lock === 'none' ? .8 : 2.2, fn: () => {
    if (need && GEAR_DEFS[need]) wearTool(bestTool(GEAR_DEFS[need].kind), C.lock === 'bypass' ? 1 : 3);
    (G.flags.caches ||= {})[C.id] = G.day;
    const got = []; for (const k of C.keys) if (!cnt(k) || !ITEMS[k] || ITEMS[k].c !== 'story') { give(k, 1); got.push(nameOf(k)); }
    got.push(...rollLoot(C.table, C.rolls)); sfx('buy'); puff(C.x, heightAt(C.x, C.z) + 1, C.z, 0xd8c890, 8, 2, .1, .5);
    toast(got.slice(0, 7).join(' · ') || 'Nothing left', 4); save();
  } }) };
}

/* ---------- Cinder City ---------- */
function buildCity() {
  const root = farGroup(CITY.x, CITY.z, CITY.R), B = [], tops = [], rub = [], cars = [], awn = [], bush = [];
  const tint = () => pick([0xd8d2c6, 0xc8c0b2, 0xb8b2a8, 0xa8a49c, 0xc8b8a4, 0x9a968e]);
  const BLK = 44, N = Math.ceil(CITY.R / BLK);
  for (let gx = -N; gx <= N; gx++) for (let gz = -N; gz <= N; gz++) {
    const cx = CITY.x + gx * BLK, cz = CITY.z + gz * BLK, dc = Math.hypot(cx - CITY.x, cz - CITY.z);
    if (dc > CITY.R - 26) continue;
    if (Math.hypot(cx - FOUNDRY.x, cz - FOUNDRY.z) < FOUNDRY.R + 20) continue;
    if (pathDist(cx, cz) < 12) continue;
    const k = dc / CITY.R, roll = rnd();
    if (roll < .1) { for (let i = 0; i < 6; i++) bush.push([cx + rr(-14, 14), heightAt(cx, cz), cz + rr(-14, 14), rr(1, 2.4), rr(1, 2.4), rr(1, 2.4), 0, rnd() * 6, 0, 0x3a5a2a]); continue; }   // overgrown lot
    const n = k < .35 ? 1 + (rnd() < .4) : k < .7 ? 2 + (rnd() < .5) : 3 + (rnd() < .4);
    const cells = n === 1 ? [[0, 0, 30, 30]] : n === 2 ? [[-8, 0, 14, 30], [8, 0, 14, 30]] : n === 3 ? [[-8, -8, 14, 14], [8, -8, 14, 14], [0, 8, 30, 14]] : [[-8, -8, 14, 14], [8, -8, 14, 14], [-8, 8, 14, 14], [8, 8, 14, 14]];
    for (const [ox, oz, cw, cd] of cells) {
      const w = cw * rr(.75, .95), d = cd * rr(.75, .95), x = cx + ox, z = cz + oz, y = heightAt(x, z) - .5;
      if (rnd() < .14) {                                                           // collapsed: a rubble heap you can dig through
        for (let i = 0; i < 9; i++) rub.push([x + rr(-w / 2, w / 2), y + rr(0, 2), z + rr(-d / 2, d / 2), rr(2, 6), rr(1, 3), rr(2, 6), rr(-.4, .4), rnd() * 3, rr(-.4, .4), tint()]);
        addRes('rubble', x, z, Math.min(w, d) / 2.2); addCol(x, z, Math.min(w, d) * .3, 3); continue;
      }
      const hgt = k < .35 ? rr(28, 90) : k < .7 ? rr(12, 34) : rr(5, 14), col = tint();
      B.push([x, y, z, w, hgt, d, 0, 0, 0, col]);
      const snapped = rnd() < .45 && hgt > 12;
      if (snapped) for (let i = 0; i < 4; i++) tops.push([x + rr(-w / 3, w / 3), y + hgt - rr(0, 2), z + rr(-d / 3, d / 3), rr(3, w * .5), rr(2, 6), rr(3, d * .5), rr(-.5, .5), rnd() * 3, rr(-.5, .5), col]);
      for (let i = 0; i < 3; i++) rub.push([x + rr(-w / 2 - 3, w / 2 + 3), y, z + (rnd() < .5 ? -1 : 1) * (d / 2 + rr(.5, 3)), rr(.8, 2.4), rr(.4, 1.2), rr(.8, 2.4), rr(-.3, .3), rnd() * 3, 0, col]);
      // collision along the long axis; shots stop at the building's height
      const L = Math.max(w, d), r = Math.min(w, d) / 2, nn = Math.max(1, Math.ceil((L - 2 * r) / (r * 1.2)));
      for (let i = 0; i <= nn; i++) { const t = nn ? i / nn : .5, px = w >= d ? x - w / 2 + r + (w - 2 * r) * t : x, pz = w >= d ? z : z - d / 2 + r + (d - 2 * r) * t; addCol(px, pz, r, hgt); }
      if (rnd() < .35) { const sd = rnd() < .5 ? 1 : -1; awn.push([x, y + 3.4, z + sd * (d / 2 + 1.6), w * .8, .3, 3.2, 0, 0, 0, 0x8a867e]); for (const px of [-w * .35, w * .35]) awn.push([x + px, y, z + sd * (d / 2 + 3), .4, 3.6, .4, 0, 0, 0, 0x7a766e]); SHELTERS.push({ x, z: z + sd * (d / 2 + 1.6), kind: 'house', r: Math.min(3, w * .35) }); }
      if (rnd() < .3) { const s = supplyCityCrate(x + rr(-w / 2, w / 2), z + (rnd() < .5 ? -1 : 1) * (d / 2 + 2)); }
    }
    // streets: wrecks
    for (let i = 0; i < 2; i++) if (rnd() < .55) { const along = rnd() < .5, sx = cx + (along ? rr(-18, 18) : 22 + rr(-2, 2)), sz = cz + (along ? 22 + rr(-2, 2) : rr(-18, 18)); cars.push([sx, heightAt(sx, sz) + .1, sz, 1, 1, 1, rr(-.06, .06), (along ? Math.PI / 2 : 0) + rr(-.4, .4), rr(-.06, .06), pick([0x8a5a3a, 0x6a6e6a, 0x7a4a2e, 0x4a5a6a, 0x9a8a5a])]); addCol(sx, sz, 1.5); }
  }
  const carGeo = merge([{ geo: new THREE.BoxGeometry(1.9, .7, 4.4), m: tm(0, .65, 0), color: 0xffffff }, { geo: new THREE.BoxGeometry(1.7, .6, 2.2), m: tm(0, 1.3, -.2), color: 0xdddddd }, { geo: new THREE.BoxGeometry(1.75, .45, 1.9), m: tm(0, 1.32, -.2), color: 0x223038 }]);
  const fm = facadeMat();
  for (const im of [instanced(boxGeo, fm, B), instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: texConcrete, flatShading: true }), tops), instanced(new THREE.DodecahedronGeometry(.6, 0), new THREE.MeshLambertMaterial({ map: texConcrete, flatShading: true }), rub),
    instanced(carGeo, new THREE.MeshLambertMaterial({ map: texCorr, vertexColors: true }), cars), instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texConcrete }), awn), instanced(new THREE.DodecahedronGeometry(.6, 0), M(0x3a5a2a), bush, false)]) if (im) root.add(im);
  buildFoundry(root);
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = rr(60, CITY.R - 30), x = CITY.x + Math.cos(a) * r, z = CITY.z + Math.sin(a) * r; if (Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) < FOUNDRY.R + 10) continue; cache(root, x, z, rnd() * 6, pick(['pry', 'pry', 'cutter', 'none']), pick(['city', 'city', 'mil']), { refill: 4 }); }
}
function supplyCityCrate(x, z) { supplyCrate(x, z, 'mixed'); const c = CRATES[CRATES.length - 1]; c.table = 'city'; return c; }

/* ---------- the Foundry: what Ironjaw rebuilt ---------- */
function buildFoundry(root) {
  const F = FOUNDRY, g = new THREE.Group(); root.add(g);
  const sheet = () => new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x9a6a4a, 0x8a7a6a, 0x7a5a3a, 0x6a6e70, 0xa8885a]) });
  const gates = [Math.atan2(0, -1), Math.atan2(-1, 0)];             // west and north
  const wall = [];
  for (let i = 0; i < 150; i++) {
    const a = i / 150 * Math.PI * 2; if (gates.some(ga => Math.abs(angWrap(a - ga)) < .07)) continue;
    const x = F.x + Math.cos(a) * F.R, z = F.z + Math.sin(a) * F.R;
    wall.push([x, heightAt(x, z) - .2, z, 3.8, rr(4.2, 5.4), .25, rr(-.05, .05), -a + Math.PI / 2, rr(-.04, .04), pick([0xd8a07a, 0xc8b8a8, 0xb89070, 0xa8aeb0])]);
    addCol(x, z, 1.9, 5);
  }
  g.add(instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texCorr }), wall));
  for (const ga of gates) for (const s of [-1, 1]) {                      // gate towers with searchlights
    const a = ga + s * .1, x = F.x + Math.cos(a) * (F.R + 1), z = F.z + Math.sin(a) * (F.R + 1), t = new THREE.Group();
    t.add(mesh(lattice(3, 9, 0x5a4a3a, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x4a3a2a), 0, 9, 0, t); mesh(new THREE.BoxGeometry(4, 1.2, 4), sheet(), 0, 9.8, 0, t);
    const lamp = mesh(new THREE.CylinderGeometry(.3, .4, .5, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }), 0, 10.8, 0, t); lamp.rotation.x = 1.2;
    t.position.set(x, heightAt(x, z), z); g.add(t); addCol(x, z, 2);
  }
  // rebuilt blocks: patched towers, scaffolding, smokestacks, stalls, lights
  const fm = facadeMat(), rb = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.28 + .3, r = rr(34, 62), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r, w = rr(12, 18), d = rr(10, 16), h = rr(10, 26), y = heightAt(x, z) - .3;
    rb.push([x, y, z, w, h, d, 0, 0, 0, pick([0xb8aa96, 0xa89a86, 0xc0b4a0])]);
    for (let k = 0; k < 4; k++) { const p = mesh(new THREE.BoxGeometry(rr(2, 5), rr(2, 4), .1), sheet(), x + rr(-w / 2, w / 2), y + rr(2, h - 2), z + d / 2 + .06, g); }
    if (rnd() < .6) { const sc = mesh(lattice(w * .8, h * .8, 0x6a5a48, 2.2), VCOL, x, y, z + d / 2 + 1, g); }
    const L = Math.max(w, d), rr0 = Math.min(w, d) / 2; for (let t = -(L / 2 - rr0); t <= L / 2 - rr0 + .01; t += rr0 * 1.2) addCol(w >= d ? x + t : x, w >= d ? z : z + t, rr0, h);
  }
  g.add(instanced(boxGeo, fm, rb));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 1, x = F.x + Math.cos(a) * 20, z = F.z + Math.sin(a) * 20, y = heightAt(x, z);
    mesh(new THREE.CylinderGeometry(1.2, 1.6, 22, 12), M(0x6a5446), x, y + 11, z, g); const fl = mesh(new THREE.ConeGeometry(.9, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }), x, y + 23.2, z, g);
    DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 9 + i) * .25; }); addCol(x, z, 1.6);
    SMOKES.push({ x, z, y: y + 24, k: rnd() });
  }
  for (let i = 0; i < 8; i++) {                                             // market stalls and fire barrels
    const a = rnd() * 6.28, r = rr(8, 28), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r, y = heightAt(x, z), s = new THREE.Group();
    for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) mesh(new THREE.CylinderGeometry(.05, .05, 2.4, 5), M(0x5a4a3a), px, 1.2, pz, s);
    const tarp = mesh(new THREE.BoxGeometry(2.8, .05, 2.4), M(pick([0x8a3a2a, 0x3a5a7a, 0x6a6a3a])), 0, 2.4, 0, s); tarp.rotation.x = .12; mesh(new THREE.BoxGeometry(2.2, .8, .8), M(0x6a4a30), 0, .4, .5, s);
    s.position.set(x, y, z); s.rotation.y = rnd() * 6; g.add(s); addCol(x, z, 1.3);
    SHELTERS.push({ x, z, kind: 'house', r: 1.4 });
    const bx = x + 3, bz = z; mesh(new THREE.CylinderGeometry(.35, .35, .9, 10), M(0x5a4030), bx, heightAt(bx, bz) + .45, bz, g); const bf = mesh(new THREE.ConeGeometry(.3, .6, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }), bx, heightAt(bx, bz) + 1.1, bz, g); DECOR_ANIM.push(t => { bf.scale.y = 1 + Math.sin(t * 14 + i) * .3; });
  }
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28, x = F.x + Math.cos(a) * 30, z = F.z + Math.sin(a) * 30; mesh(new THREE.SphereGeometry(.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), x, heightAt(x, z) + 6 + Math.sin(i) * .3, z, g); }
  // the strongroom, the armory, the workshop
  const sr = new THREE.Group(), sx = F.x, sz = F.z, sy = heightAt(sx, sz);
  mesh(new THREE.BoxGeometry(12, 7, 10), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x9a9690 }), 0, 3.5, 0, sr);
  const door = mesh(new THREE.CylinderGeometry(2.4, 2.4, .5, 24), S(0x8a8e90, { metalness: .8, roughness: .3 }), 0, 3, 5.1, sr); door.rotation.x = Math.PI / 2;
  for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.BoxGeometry(.2, 1.6, .2), S(0x6a6e70, { metalness: .8 }), Math.cos(k) * 1.2, 3 + Math.sin(k) * 1.2, 5.4, sr); sp.rotation.z = k; }
  sr.position.set(sx, sy, sz); g.add(sr); for (let t = -4; t <= 4; t += 2.5) addCol(sx + t, sz, 5, 7);
  cache(g, sx, sz + 6.6, 0, 'bypass', 'op', { id: 'strongroom', name: 'The strongroom', big: 1, rolls: 3, keys: ['gate_codes', 'ember', 'halcyon_chip'], refill: 5 });
  cache(g, F.x - 40, F.z + 18, 1, 'pry', 'mil', { id: 'f_armory', name: 'Ironjaw armory', big: 1, rolls: 3, refill: 3 });
  cache(g, F.x + 30, F.z - 35, 2, 'cutter', 'op', { id: 'f_workshop', name: 'Ironjaw workshop', big: 1, rolls: 1, keys: ['greyhold_card'], refill: 3 });
  for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, r = rr(15, 70); supplyCityCrate(F.x + Math.cos(a) * r, F.z + Math.sin(a) * r); }
}

/* ---------- Farlight: Arc survivors who trade ---------- */
const TRADER = { x: 0, z: 0 };
function buildFarlight(B) {
  const g = farGroup(B.x, B.z, B.R), y0 = heightAt(B.x, B.z);
  const hull = hullModule(6, 22); hull.position.set(B.x - 8, y0 + 3, B.z - 6); hull.rotation.set(0, .6, .25); g.add(hull); addColLine(B.x - 16, B.z - 12, B.x, B.z, 4);
  const plate = new THREE.MeshLambertMaterial({ map: texPanel, color: 0xb8bcc0 }), gateA = Math.atan2(-B.z, -B.x);
  for (let i = 0; i < 70; i++) { const a = i / 70 * 6.28; if (Math.abs(angWrap(a - gateA)) < .12) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; const p = mesh(new THREE.BoxGeometry(4.2, rr(3, 4), .3), plate, x, heightAt(x, z) + 1.6, z, g); p.rotation.y = -a + Math.PI / 2; p.rotation.z = rr(-.05, .05); addCol(x, z, 2); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .5, x = B.x + Math.cos(a) * 22, z = B.z + Math.sin(a) * 22; const t = mesh(new THREE.ConeGeometry(2.4, 3, 4), M(pick([0x6a7a8a, 0x8a8a7a, 0x5a6a5a])), x, heightAt(x, z) + 1.5, z, g); t.rotation.y = Math.PI / 4; addCol(x, z, 1.8); }
  // trader's counter, bench + forge + med tent you may use
  const tx = B.x + 10, tz = B.z + 8, ty = heightAt(tx, tz), st = new THREE.Group();
  mesh(new THREE.BoxGeometry(4, 1.1, 1), M(0x6a5a48), 0, .55, 0, st); for (const px of [-1.8, 1.8]) mesh(new THREE.CylinderGeometry(.06, .06, 2.8, 5), M(0x4a4a4a), px, 1.4, -.4, st);
  mesh(new THREE.BoxGeometry(4.4, .06, 2.4), M(0x3a5a7a), 0, 2.8, 0, st); st.position.set(tx, ty, tz); st.rotation.y = gateA; g.add(st); addColLine(tx - 1.6, tz, tx + 1.6, tz, .6);
  TRADER.x = tx + Math.cos(gateA) * 1.6; TRADER.z = tz + Math.sin(gateA) * 1.6; TRADER.at = { x: tx, z: tz };
  const bx = B.x - 12, bz = B.z + 14; mesh(new THREE.BoxGeometry(2.4, .1, 1), WOOD(), bx, heightAt(bx, bz) + .95, bz, g); mesh(new THREE.BoxGeometry(2.2, .9, .9), M(0x5a4430), bx, heightAt(bx, bz) + .45, bz, g); FACTION_ST.push({ x: bx, z: bz, st: ['bench'] });
  const fx = B.x + 2, fz = B.z + 20; mesh(new THREE.BoxGeometry(2, 1.6, 1.6), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), fx, heightAt(fx, fz) + .8, fz, g); mesh(new THREE.BoxGeometry(.8, .4, .05), new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false }), fx, heightAt(fx, fz) + .9, fz + .81, g); addCol(fx, fz, 1.2); FACTION_ST.push({ x: fx, z: fz, st: ['forge', 'fire', 'cook'] });
  const mx = B.x + 18, mz = B.z - 10; const mt = mesh(new THREE.ConeGeometry(3, 3.4, 6), M(0xd8d8d0), mx, heightAt(mx, mz) + 1.7, mz, g); mesh(new THREE.BoxGeometry(.8, .8, .05), new THREE.MeshBasicMaterial({ color: 0xe04040, toneMapped: false }), mx, heightAt(mx, mz) + 2, mz + 2.2, g); FACTION_ST.push({ x: mx, z: mz + 3, st: ['lab'] });
  SHELTERS.push({ x: mx, z: mz, kind: 'house', r: 2.6 }, { x: tx, z: tz, kind: 'house', r: 2 });
  const fl = mesh(new THREE.ConeGeometry(1, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }), B.x, y0 + 1.2, B.z, g); DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 12) * .2; });
}

/* ---------- Greyhold Station: concrete, chain-link, floodlights, soldiers in masks ---------- */
function buildGreyStation(B) {
  const g = farGroup(B.x, B.z, B.R), conc = new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xa8a8a4 }), gateA = Math.atan2(-B.z, -B.x);
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - gateA)) < .1) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; const f = mesh(lattice(5, 3.2, 0x8a8e90, 1), VCOL, x, heightAt(x, z), z, g); f.rotation.y = -a + Math.PI / 2; addCol(x, z, 2.4); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .4, x = B.x + Math.cos(a) * 26, z = B.z + Math.sin(a) * 26; mesh(new THREE.BoxGeometry(12, 4.5, 8), conc, x, heightAt(x, z) + 2.25, z, g).rotation.y = a; addCol(x, z, 4.6, 4.5); mesh(new THREE.BoxGeometry(2.4, 2.4, .1), M(0x1a1a1a), x - Math.sin(a) * 0, heightAt(x, z) + 1.2, z, g); }
  const hg = mesh(new THREE.CylinderGeometry(9, 9, 22, 18, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x7a7e80, side: THREE.DoubleSide }), B.x + 6, heightAt(B.x, B.z), B.z - 4, g); hg.rotation.z = Math.PI / 2; hg.rotation.y = gateA; addColLine(B.x - 4, B.z - 4, B.x + 16, B.z - 4, 4);
  const mast = mesh(lattice(1.4, 24, 0x9a3a2a, 2), VCOL, B.x - 14, heightAt(B.x - 14, B.z + 12), B.z + 12, g); const ml = mesh(new THREE.SphereGeometry(.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), B.x - 14, heightAt(B.x - 14, B.z + 12) + 24.4, B.z + 12, g); DECOR_ANIM.push(t => { ml.visible = Math.sin(t * 2.6) > 0; });
  for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, r = rr(10, 40), x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r; const sb = mesh(new THREE.BoxGeometry(4, 1.1, 1), M(0x8a7e5a), x, heightAt(x, z) + .55, z, g); sb.rotation.y = rnd() * 3; addCol(x, z, 1.2, 1.1); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28, x = B.x + Math.cos(a) * (B.R - 4), z = B.z + Math.sin(a) * (B.R - 4); mesh(new THREE.CylinderGeometry(.1, .1, 7, 6), M(0x5a5a5a), x, heightAt(x, z) + 3.5, z, g); mesh(new THREE.BoxGeometry(1, .6, .4), new THREE.MeshBasicMaterial({ color: 0xf0f6ff, toneMapped: false }), x, heightAt(x, z) + 7, z, g); }
  cache(g, B.x + 26 * Math.cos(.4) - 2, B.z + 26 * Math.sin(.4) + 5, 0, 'pry', 'mil', { id: 'grey_stash', name: 'Greyhold lockup', big: 1, rolls: 2, keys: ['greyhold_card'], refill: 4 });
  cache(g, B.x - 10, B.z - 20, 0, 'card', 'op', { id: 'grey_vault', name: 'Greyhold vault', big: 1, rolls: 1, keys: ['lab_sample', 'greyhold_files'], refill: 5 });
  for (let i = 0; i < 3; i++) { supplyCrate(B.x + rr(-30, 30), B.z + rr(-30, 30), 'mixed'); CRATES[CRATES.length - 1].table = 'mil'; }
}

/* ---------- Ironjaw yards: scrap walls, shacks, car stacks ---------- */
function buildIronYard(B) {
  const g = farGroup(B.x, B.z, B.R), gateA = Math.atan2(-B.z, -B.x), wall = [];
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - gateA)) < .1) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; wall.push([x, heightAt(x, z) - .2, z, 3.9, rr(3.6, 4.6), .25, 0, -a + Math.PI / 2, rr(-.05, .05), pick([0xd8a07a, 0xc8b8a8, 0xb89070])]); addCol(x, z, 1.95, 4); }
  g.add(instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texCorr }), wall));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .3, x = B.x + Math.cos(a) * 20, z = B.z + Math.sin(a) * 20; const s = new THREE.Group(); mesh(new THREE.BoxGeometry(6, 3, 5), new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x8a6a4a, 0x7a7a6a]) }), 0, 1.5, 0, s); const r = mesh(new THREE.BoxGeometry(6.6, .15, 5.6), M(0x5a4a3a), 0, 3.1, 0, s); r.rotation.x = .1; s.position.set(x, heightAt(x, z), z); s.rotation.y = -a; g.add(s); addCol(x, z, 2.6, 3); }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { const x = B.x + 8 - i * 3.5, z = B.z - 6; car(x, z + k * .01, rnd() * .3).position.y += k * 1.35; }
  const t = new THREE.Group(); t.add(mesh(lattice(3, 8, 0x5a4a3a, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x4a3a2a), 0, 8, 0, t); t.position.set(B.x - 10, heightAt(B.x - 10, B.z + 10), B.z + 10); g.add(t); addCol(B.x - 10, B.z + 10, 2);
  const bf = mesh(new THREE.ConeGeometry(.6, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }), B.x, heightAt(B.x, B.z) + 1.2, B.z, g); DECOR_ANIM.push(tt => { bf.scale.y = 1 + Math.sin(tt * 13) * .3; });
  cache(g, B.x - 6, B.z + 12, 0, 'none', 'city', { id: B.id + '_stash', name: 'Ironjaw stash', big: 1, rolls: 2, refill: 3 });
  for (let i = 0; i < 3; i++) supplyCityCrate(B.x + rr(-25, 25), B.z + rr(-25, 25));
}
/* clan holds get a stash with an insignia */
function buildHoldStashes() {
  for (const H of HOLDS) cache(world, H.x + 6, H.z + 6, 0, 'none', 'clan', { id: H.id + '_stash', name: 'Clan stash', big: 1, rolls: 2, keys: ['insignia'], refill: 3 });
  cache(world, POI.ashmere.x + 8, POI.ashmere.z, 0, 'none', 'clan', { id: 'ashmere_stash', name: 'Ashmere stash', big: 1, rolls: 2, keys: ['insignia'], refill: 3 });
  cache(world, POI.village.x + 5, POI.village.z + 3, 0, 'none', 'clan', { id: 'outpost_stash', name: 'Outpost stash', rolls: 1, keys: ['insignia'], refill: 3 });
  // the Burn: the lander Tern's locker holds an Arc ID chip; the pod has an Arc kit
  cache(world, POI.burn.x + 6, POI.burn.z - 4, 0, 'none', 'arc', { id: 'tern_locker', name: 'Tern lander locker', rolls: 1, keys: ['id_chip', 'nav_console'], refill: 0 });
  cache(world, POI.pod.x - 3, POI.pod.z + 2, 0, 'none', 'arc', { id: 'pod_kit', name: 'Pod survival kit', rolls: 1, keys: ['wristband'], refill: 0 });
  // the Grey Door: open it with a Greyhold card
  cache(world, (POI.vaultFront || POI.vault).x, (POI.vaultFront || POI.vault).z, 0, 'card', 'op', { id: 'grey_door', name: 'The Grey Door', big: 1, rolls: 2, keys: ['arden_notes', 'blackvein', 'sunfall_data'], refill: 6 });
}
function buildBases() { buildCity(); for (const B of BASES) (B.fac === 'arc' ? buildFarlight : B.fac === 'grey' ? buildGreyStation : buildIronYard)(B); buildHoldStashes(); }

/* ---------- who guards what ---------- */
function baseGuards() {
  const F = FOUNDRY;
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = rr(10, F.R - 8); spawnClan(i % 5 === 4 ? 'brute' : 'gunner', F.x + Math.cos(a) * r, F.z + Math.sin(a) * r, 'guard', 'iron'); }
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.28, r = rr(F.R + 30, CITY.R - 20); spawnClan(pick(['gunner', 'gunner', 'warrior']), CITY.x + Math.cos(a) * r, CITY.z + Math.sin(a) * r, 'guard', 'iron'); }
  for (const B of BASES) {
    if (B.fac === 'arc') { for (let i = 0; i < 6; i++) spawnNPC('extra', B.x + rr(-20, 20), B.z + rr(-20, 20), { wander: true }); const t = spawnNPC('trader', TRADER.x, TRADER.z, { model: 'civilian', tint: 0x6a8aa0, h: 1.72 }); t.trader = 1; t.shop = 'mara'; t.shopName = 'Mara'; named.trader = t; continue; }
    const n = B.fac === 'grey' ? 11 : 8;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rr(6, B.R - 6); spawnClan(B.fac === 'grey' ? 'soldier' : i % 4 === 3 ? 'brute' : 'gunner', B.x + Math.cos(a) * r, B.z + Math.sin(a) * r, 'guard', B.fac); }
  }
}

/* ---------- Farlight's trader: barter in scrap ---------- */
const TRADE_POOL = ['id_chip', 'map', 'seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot', 'bandage', 'painkiller', 'antibiotic', 'disinfect', 'medkit', 'purify_tab',
  'ammo_9', 'ammo_556', 'ammo_762', 'ammo_12', 'arrows', 'gunpowder', 'canned', 'arc_pack', 'salt', 'flour', 'rope', 'cloth', 'synth', 'nails', 'screws', 'bolts', 'glass', 'rubber', 'battery', 'circuit', 'wire', 'cu_wiring',
  'spare_parts', 'springs', 'fuel', 'tool_kit', 'iron', 'steel', 'leather', 'pistol', 'shotgun', 'crowbar', 'bolt_cutters', 'hand_saw', 'backpack', 'gas_mask', 'jacket', 'boots', 'fish_rod', 'flashlight', 'compass'];
function valueOf(id) {
  if (id === 'scrap') return 1;
  if (GEAR_DEFS[id]) return 6 + (GEAR_DEFS[id].t || 1) ** 2 * 5 + (WDEF[id]?.cls === 'gun' ? 25 : 0);
  const I = ITEMS[id]; if (!I) return 1;
  if (I.c === 'ammo') return { ammo_9: .4, ammo_556: .5, ammo_762: 1.2, ammo_12: 1, arrows: .6, ammo_flare: 3, bolts_xb: 1, cell: 3 }[id] || 4;
  if (I.c === 'story') return id === 'id_chip' ? 45 : 30;
  return Math.max(1, Math.round(({ ren: 1, craft: 2, salv: 3 }[I.src] || 1) * (1 + (I.t - 1) * 1.6) * (I.c === 'rare' ? 4 : I.c === 'elec' ? 2 : 1)));
}
const TRADE_LOT = { ammo_9: 15, ammo_45: 12, ammo_556: 20, ammo_762: 6, ammo_12: 8, arrows: 10, bolts_xb: 8, ammo_flare: 2, nails: 10, screws: 8, bolts: 5, fiber: 10, stick: 8, stone: 6 };
/* Kestrel's shops (and Mara out at Farlight): each keeper stocks their own trade; settlers barter what they've gathered */
const SHOP_STOCK = {
  mara: { pool: TRADE_POOL, k: 14, mark: 1.25, blurb: 'Mara trades in scrap.' },
  cook: { k: 12, mark: 1.15, tiered: 1, blurb: 'Bram feeds Kestrel. Hot food, clean water, seed stock.', pool: ['ration', 'cooked_fish', 'dried_meat', 'roast', 'smoked_fish', 'canned', 'arc_pack', 'stew', 'veg_soup', 'fish_soup', 'bread', 'water_boiled', 'water_filtered', 'salt', 'flour', 'oil', 'honey', 'potato', 'corn', 'beans', 'carrot', 'meat', 'fat', 'seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot', 'canteen', 'pot'] },
  craft: { k: 14, mark: 1.25, tiered: 1, blurb: 'Kade sells tools and metal stock.', pool: ['stone_axe', 'stone_pick', 'flint_knife', 'wood_shovel', 'hand_saw', 'fire_starter', 'needle', 'torch_t', 'metal_axe', 'pickaxe', 'hammer', 'crowbar', 'wrench', 'screwdriver', 'bolt_cutters', 'pliers', 'wire_cutters', 'multitool', 'welder', 'flashlight', 'climb_gear', 'lock_bypass', 'rust_detector', 'solar_charger', 'iron', 'steel', 'aluminum', 'copper', 'charcoal', 'pipe', 'gears', 'springs', 'spare_parts', 'tool_kit', 'fasteners', 'bolts', 'screws', 'nails', 'repair_kit'] },
  trade: { k: 16, mark: 1.3, tiered: 1, blurb: 'Odile buys and sells anything that isn’t nailed down.', pool: ['plank', 'log', 'rope', 'cloth', 'canvas', 'synth', 'leather', 'hide', 'glass', 'rubber', 'wire', 'cu_wiring', 'battery', 'circuit', 'sensor', 'fuse', 'antenna', 'fuel', 'gunpowder', 'clay', 'limestone', 'metal_ore', 'fertilizer', 'map', 'compass', 'binoculars', 'radio', 'fish_rod', 'backpack', 'duffel', 'arc_alloy', 'solar_cell', 'med_parts', 'engine_part', 'cable_spool', 'data_drive', 'purify_tab', 'canned'] },
  med: { k: 12, mark: 1.2, tiered: 1, blurb: 'Juno’s clinic. She’ll still patch you up for free.', pool: ['bandage', 'herb_bandage', 'splint', 'poultice', 'disinfect', 'painkiller', 'antibiotic', 'sutures', 'alcohol', 'purify_tab', 'medkit', 'surgical_kit', 'iv', 'rust_med', 'inject', 'herb_med', 'med_parts', 'gas_mask', 'med_scanner'] },
  guns: { k: 14, mark: 1.3, tiered: 1, blurb: 'Rook keeps the guns. Bring scrap, leave armed.', pool: ['ammo_9', 'ammo_45', 'ammo_556', 'ammo_762', 'ammo_12', 'arrows', 'bolts_xb', 'ammo_flare', 'frag', 'smoke_gren', 'molotov', 'throw_spear', 'pistol', 'revolver', 'shotgun', 'smg', 'assault', 'sniper', 'lmg', 'flare_gun', 'shortbow', 'recurve', 'crossbow', 'machete', 'sword', 'war_axe', 'hunting_knife', 'mil_knife', 'stun_baton', 'metal_spear', 'repair_kit', 'gunpowder'] },
  wear: { k: 12, mark: 1.25, tiered: 1, blurb: 'Wren makes and mends what you wear.', pool: ['hide_coat', 'jacket', 'hunt_outfit', 'rain_cloak', 'leather_armor', 'metal_chest', 'arc_jumpsuit', 'util_vest', 'sec_uniform', 'tac_armor', 'hazmat', 'rust_suit', 'clan_mask', 'gas_mask', 'helmet', 'riot_helmet', 'nvg', 'gloves', 'arm_guards', 'shield', 'riot_shield', 'boots', 'hide_boots', 'backpack', 'duffel', 'canteen', 'thread', 'cloth', 'leather'] },
};
const SETTLER_POOL = ['log', 'plank', 'stick', 'stone', 'flint', 'fiber', 'rope', 'hide', 'leather', 'bone', 'sinew', 'fat', 'feather', 'meat', 'fish', 'berries', 'mushroom', 'roots', 'nuts', 'herb', 'herb_med', 'honey', 'clay', 'charcoal', 'metal_ore', 'cloth', 'wire', 'water_boiled', 'dried_meat', 'bandage', 'arrows', 'nails'];
const SETTLERS = [{ n: 'Tam', tint: 0xa08868 }, { n: 'Ilka', tint: 0x8aa0b0 }, { n: 'Brann', tint: 0x9a8a6a }, { n: 'Sova', tint: 0xb09080 }, { n: 'Pell', tint: 0x7a8a6a }, { n: 'Nico', tint: 0xa0a0b8 }];
for (let i = 0; i < SETTLERS.length; i++) SHOP_STOCK['settler' + i] = { pool: SETTLER_POOL, k: 4, mark: 1, settler: 1, blurb: `${SETTLERS[i].n} swaps what they gathered for scrap.` };
let curShopE = null;
const shopDef = () => SHOP_STOCK[curShopE?.shop] || SHOP_STOCK.mara;
const itemTier = id => GEAR_DEFS[id]?.t || ITEMS[id]?.t || 1;
function nearShopNPC() { let b = null, bd = 4.4; for (const e of ents) if (e.type === 'npc' && e.shop && !e.dead) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } } return b; }
function openTrade(e) { if (!e) return; curShopE = e; if (e.settler) e.t = 6; invTab = 'trade'; toggleInv(true); }
function tradeStock() {
  const key = curShopE?.shop || 'mara', D = SHOP_STOCK[key], TT = G.flags.trades = G.flags.trades || {}, T = TT[key] || {};
  if (T.day !== G.day || !T.list) {
    const L = [], cap = tierNow() + 1; let pool = D.pool.filter(id => ITEMS[id] || GEAR_DEFS[id]);
    if (D.tiered) pool = pool.filter(id => itemTier(id) <= cap);
    for (let i = 0; i < D.k && pool.length; i++) { const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; L.push([id, GEAR_DEFS[id] ? 1 : TRADE_LOT[id] || (D.settler ? Math.ceil(rr(1, 4)) : rnd() < .5 ? 1 : 2), GEAR_DEFS[id] ? 1 : D.settler ? 1 : Math.ceil(rr(2, 5))]); }
    TT[key] = { day: G.day, list: L };
  }
  return TT[key].list;
}
function buyTrade(i) {
  const L = tradeStock(), [id, n, left] = L[i]; if (left <= 0) return;
  const price = Math.ceil(valueOf(id) * n * shopDef().mark);
  if (INV.scrap < price) { sfx('no'); toast(`Needs ${price} scrap`); return; }
  INV.scrap -= price; give(id, n); L[i][2]--; sfx('buy'); toast(`Bought ${n > 1 ? n + ' ' : ''}${nameOf(id).toLowerCase()} for ${price} scrap`); save();
}
function sellTrade(id, g) {
  if (g) { const v = Math.max(2, Math.round(valueOf(g.id) * .5 * g.d / g.max)); unequip(g); INV.tools.splice(INV.tools.indexOf(g), 1); INV.scrap += v; toast(`Sold ${GEAR_DEFS[g.id].n.toLowerCase()} · +${v} scrap`); }
  else { const lot = Math.min(cnt(id), TRADE_LOT[id] || 1), v = Math.max(1, Math.floor(valueOf(id) * lot * .5)); take(id, lot); INV.scrap += v; toast(`Sold ${lot > 1 ? lot + ' ' : ''}${nameOf(id).toLowerCase()} · +${v} scrap`); }
  sfx('pickup'); save();
}
const nearTrader = () => curShopE && !curShopE.dead && Math.hypot(curShopE.x - P.x, curShopE.z - P.z) < 4.6;
