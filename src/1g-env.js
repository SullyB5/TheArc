
/* ================= Bryce's environment models (Nov 10) =================
   assets/models/e: conifers (medium + high poly), rock sets (Davia's boulders, blocky rocks, modular stones), pallets, boxes,
   trash cans, the Arc cargo containers kit, the old factory, an abandoned city street, a burnt-out bus, a bus stop, the
   apocalypse car and a bunker entrance. Packs are split into pieces (one per mesh) and the repeated things are instanced.
   Where they go:
   · conifers: a ring of real pines round Kestrel and along the valley paths (the drawn firs still fill the far forest)
   · rocks: Davia's boulders over the valley slopes, the blocky rocks on the grey mountain and the lookout ridge, the modular
     stones along the Coldwater's banks
   · Kestrel: pallets, boxes and bins at Salvage, the Trading Post and the Workshop
   · the dropsite: the Arc's cargo containers spilled round the wreck; Farlight keeps more
   · Halvard + the old road: wrecked cars, a bus stop and the burnt bus
   · Cinder City: the old factory and the street block take two city blocks; wrecked cars + buses replace the drawn ones
   · Greyhold Station: the bunker entrance into the mountain */
const ENV_MODELS = ['e/conifer', 'e/conifer_hi', 'e/pallets', 'e/containers', 'e/factory', 'e/trashcans', 'e/rocks_davia', 'e/rocks_blocky', 'e/boxes', 'e/street', 'e/bus', 'e/bunker', 'e/busstop', 'e/car', 'e/rocks_mod'];

/* quantized (int16) attributes: copy to float before moving geometry around */
function floatGeo(geo) {
  const g = new THREE.BufferGeometry();
  for (const nm of Object.keys(geo.attributes)) { const A = geo.attributes[nm], n = A.count, k = A.itemSize, arr = new Float32Array(n * k); for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) arr[i * k + c] = A.getComponent(i, c); g.setAttribute(nm, new THREE.BufferAttribute(arr, k)); }
  if (geo.index) g.setIndex(Array.from(geo.index.array)); for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}
const _ev = new THREE.Vector3();
/* every mesh of a pack as its own piece, standing on y=0, centred in x/z */
const PIECES = {};
function pieces(name) {
  if (PIECES[name]) return PIECES[name]; const src = MODELS[name]; if (!src) return [];
  src.updateMatrixWorld(true); const out = [];
  src.traverse(m => { if (!m.isMesh) return; const geo = floatGeo(m.geometry); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(_ev);
    geo.translate(-c.x, -b.min.y, -c.z); geo.computeBoundingBox(); geo.computeBoundingSphere(); out.push({ geo, mat: m.material, size: geo.boundingBox.getSize(new THREE.Vector3()), name: m.name }); });
  return PIECES[name] = out;
}
/* the whole model, one entry per mesh, the model standing on y=0 and centred */
const WHOLE = {};
function whole(name) {
  if (WHOLE[name]) return WHOLE[name]; const src = MODELS[name]; if (!src) return null;
  src.updateMatrixWorld(true); const parts = [], b = new THREE.Box3();
  src.traverse(m => { if (!m.isMesh) return; const geo = floatGeo(m.geometry); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); b.union(geo.boundingBox); parts.push({ geo, mat: m.material }); });
  const c = b.getCenter(new THREE.Vector3()); for (const p of parts) { p.geo.translate(-c.x, -b.min.y, -c.z); p.geo.computeBoundingSphere(); }
  return WHOLE[name] = { parts, size: b.getSize(new THREE.Vector3()) };
}
/* instance parts at a list of matrices */
function instParts(parent, parts, mats, shadow = true, opt) {
  const out = []; if (!mats.length) return out;
  // (Nov 12, perf) heavy models (conifers, Davia's rocks, cars, the bus…) get distance LOD, per-instance culling and
  // shadow proxies instead of one fixed-detail mesh (ilodParts in 1a-perf.js)
  if (parts.reduce((t, p) => t + geoTris(p.geo), 0) >= ILOD_MIN_TRIS) return ilodParts(parent, parts, mats, shadow, opt);
  for (const p of parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); out.push(im); }
  return out;
}
const envM = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
/* one placed copy (shares geometry) — for the one-off landmarks */
function envPut(parent, name, x, y, z, ry = 0, s = 1) {
  const W = whole(name); if (!W) return null; const g = new THREE.Group();
  for (const p of W.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g); return g;
}
const envFloor = (x, z, w, d, ry) => { let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const lx = a * w / 2, lz = b * d / 2; lo = Math.min(lo, heightAt(x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry))); } return lo; };
/* collision along a box's perimeter, with `gaps` (local x positions on the long sides) left open as doorways */
function colRect(x, z, w, d, ry, r = .6, gaps = []) {
  const c = Math.cos(ry), s = Math.sin(ry), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const edge = (ax, az, bx, bz, gap) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.3))); for (let i = 0; i <= n; i++) { const lx = lerp(ax, bx, i / n), lz = lerp(az, bz, i / n); if (gap && gaps.some(g => Math.abs(lx - g) < 1.8)) continue; const [wx, wz] = W(lx, lz); addCol(wx, wz, r, 8); } };
  edge(-w / 2, -d / 2, w / 2, -d / 2, 1); edge(-w / 2, d / 2, w / 2, d / 2, 1); edge(-w / 2, -d / 2, -w / 2, d / 2); edge(w / 2, -d / 2, w / 2, d / 2);
}

/* ---------- sites picked once, before the forest and the city are laid out, so neither builds over them ---------- */
let ENV_SITES = null;
function envSites() {
  if (ENV_SITES) return ENV_SITES;
  const S = ENV_SITES = [];
  const firstOK = (list, test) => list.find(([x, z]) => test(x, z));
  // the paddock: a flat bit of ground just outside the wall, off the paths
  let best = null;
  for (let a = 0; a < 6.28; a += .13) for (const r of [84, 92, 100]) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 40) continue;
    const sl = slopeAt(x, z), pd = pathDist(x, z), sc = sl * 40 - Math.min(pd, 30) + (SHELTERS.some(s => Math.hypot(s.x - x, s.z - z) < 25) ? 50 : 0) + (Math.hypot(x - 80, z + 36) < 44 || Math.hypot(x + 80, z + 24) < 36 ? 50 : 0);
    if (pd > 15 && campD(x, z) > CAMP_R + 16 && waterAt(x, z) < -1e8 && (!best || sc < best.sc)) best = { x, z, sc }; }
  if (best) S.push({ id: 'paddock', x: best.x, z: best.z, r: 16 });
  S.push({ id: 'arches', x: POI.arches.x, z: POI.arches.z, r: 34 });            // (Nov 10) the Old Arches: no pines or boulders through the ruin
  // two city blocks: the factory and the street
  const C = CITY, cityOK = (x, z) => pathDist(x, z) > 20 && Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) > FOUNDRY.R + 45 && Math.hypot(x - C.x, z - C.z) < C.R - 60;
  const f = firstOK([[C.x + 170, C.z + 60], [C.x + 130, C.z - 150], [C.x - 170, C.z - 120], [C.x + 60, C.z + 200]], cityOK); if (f) S.push({ id: 'factory', x: f[0], z: f[1], r: 30, city: 1 });
  const s = firstOK([[C.x - 120, C.z + 190], [C.x - 200, C.z + 40], [C.x + 20, C.z - 230], [C.x + 230, C.z - 60]], (x, z) => cityOK(x, z) && (!f || Math.hypot(x - f[0], z - f[1]) > 80)); if (s) S.push({ id: 'street', x: s[0], z: s[1], r: 26, city: 1 });
  // (Nov 10) the park: a cleared block for the park arch, away from the other two
  const p = firstOK([[C.x + 40, C.z + 130], [C.x - 60, C.z - 160], [C.x + 150, C.z - 40], [C.x - 150, C.z + 90], [C.x + 90, C.z + 220]], (x, z) => cityOK(x, z) && [f, s].every(q => !q || Math.hypot(x - q[0], z - q[1]) > 85)); if (p) S.push({ id: 'park', x: p[0], z: p[1], r: 32, city: 1 });
  return S;
}
const envSite = id => envSites().find(s => s.id === id);
const envKeepClear = (x, z, pad = 4) => envSites().some(s => Math.hypot(x - s.x, z - s.z) < s.r + pad);

/* ---------- the pines ---------- */
async function buildEnvForest() {
  const W = whole('e/conifer'), WH = whole('e/conifer_hi'); if (!W) return;
  const BT = 300, NB = Math.ceil(HALF * 2 / BT), bins = {}, hero = []; // (Nov 11, perf) 300 m bins, was 200: about half the pine draws
  const n = LOW ? 260 : 620; let k = 0, guard = 0;
  while (k < n && guard++ < n * 30) {
    // denser near the wall and along the paths, thinning out to ~420 m
    const a = rnd() * 6.28, r = 78 + Math.pow(rnd(), 1.6) * 360, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!treeOK(x, z) || waterAt(x, z) > -1e8 || slopeAt(x, z) > .9) continue;
    const pd = pathDist(x, z); if (pd > 60 && r > 160 && rnd() < .6) continue;
    const big = r < 130 && hero.length < (LOW ? 6 : 14) && rnd() < .12 && WH;
    const s = big ? rr(1.2, 1.6) : rr(.75, 1.25), y = heightAt(x, z) - .3, m = envM(x, y, z, rnd() * 6.28, s, rr(-.03, .03), rr(-.03, .03));
    const hid = xClear(x, z), mm = hid ? X_HIDE : m;   // (Nov 11) keep pines off the new places without moving any other
    if (big) hero.push(mm); else { const b = Math.floor((x + HALF) / BT) + Math.floor((z + HALF) / BT) * NB; (bins[b] ||= []).push(mm); }
    if (!hid) { addCol(x, z, .4 * s); addRes('fir', x, z, s); } k++;
  }
  // (Nov 12, perf) one LOD set per kind instead of 300 m bins: drawn per tree by distance (full / medium / far detail),
  // only what's on screen, nothing past the forest's draw distance; shadows from medium-detail copies near you
  const forestFar = { far: () => FOR_SHOW };
  instParts(world, W.parts, Object.values(bins).flat(), true, forestFar);
  if (WH && hero.length) instParts(world, WH.parts, hero, true, forestFar);
  for (const p of [...W.parts, ...(WH ? WH.parts : [])]) for (const m of [].concat(p.mat)) { m.alphaTest = Math.max(m.alphaTest || 0, .4); m.side = THREE.DoubleSide; m.transparent = false; m.depthWrite = true; m.needsUpdate = true; }   // (Nov 11, perf) cut-out, not blended: drawn in the opaque pass with depth, no sorting or overdraw
  await nextFrame();
}

/* ---------- rocks ---------- */
function buildEnvRocks() {
  const bl = pieces('e/rocks_blocky'), md = pieces('e/rocks_mod');
  const place = (P, list) => { const by = P.map(() => []); for (const [i, m] of list) by[i].push(m); P.forEach((p, i) => instParts(world, [p], by[i])); };
  const DV = whole('e/rocks_davia');
  if (DV) {                 // Davia's rock: one big weathered formation, scattered as outcrops over the valley's slopes and rim
    const L = []; let guard = 0;
    while (L.length < (LOW ? 14 : 26) && guard++ < 4000) {
      const a = rnd() * 6.28, r = 110 + Math.sqrt(rnd()) * (VALLEY - 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (pathDist(x, z) < 20 || waterAt(x, z) > -1e8 || !treeOK(x, z) || envKeepClear(x, z, 20) || slopeAt(x, z) < .25) continue;
      if (L.some(q => Math.hypot(q.x - x, q.z - z) < 60)) continue;
      const want = rr(7, 16), s = want / Math.max(DV.size.x, DV.size.z), ry = rnd() * 6.28;
      const hid = xClear(x, z);
      L.push({ x, z, m: hid ? X_HIDE : envM(x, envFloor(x, z, DV.size.x * s * .6, DV.size.z * s * .6, ry) - DV.size.y * s * .2, z, ry, s) });
      if (!hid) { for (let k = -1; k <= 1; k++) addCol(x + Math.sin(ry) * k * want * .3, z + Math.cos(ry) * k * want * .3, want * .3, 99); addRes('boulder', x, z, want * .4); }
    }
    instParts(world, DV.parts, L.map(q => q.m));
  }
  if (bl.length) {          // blocky rocks on the grey mountain (round the Grey Door) and the lookout ridge
    const L = [];
    for (const [cx, cz, n, R] of [[POI.vault.x, POI.vault.z, 22, 70], [POI.lookout.x, POI.lookout.z, 12, 50], [POI.relay.x, POI.relay.z, 10, 45]]) for (let j = 0, g = 0; j < n && g < 200; g++) {
      const a = rnd() * 6.28, r = rr(16, R), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (pathDist(x, z) < 8 || waterAt(x, z) > -1e8 || Math.hypot(x - POI.vault.x, z - POI.vault.z - 8) < 26 || Math.hypot(x - POI.lookout.x, z - POI.lookout.z) < 14) continue;
      const i = Math.floor(rnd() * bl.length), p = bl[i], s = rr(.8, 1.6);
      const m = envM(x, heightAt(x, z) - .3, z, rnd() * 6.28, s), hid = xClear(x, z); L.push([i, hid ? X_HIDE : m]); if (!hid) { addCol(x, z, Math.max(p.size.x, p.size.z) * s * .4); addRes('boulder', x, z, Math.max(p.size.x, p.size.z) * s * .4); } j++;
    }
    place(bl, L);
  }
  if (md.length) {          // stones along the Coldwater banks
    const L = [];
    for (let z = -VALLEY + 40; z < VALLEY - 40; z += rr(5, 12)) for (const sd of [-1, 1]) { if (rnd() < .35) continue;
      const x = riverX(z) + sd * (RIV_HW + rr(-.5, 3)); if (Math.abs(z - 236) < 20) continue;
      const i = Math.floor(rnd() * md.length), p = md[i], s = rr(.9, 1.8);
      L.push([i, envM(x, heightAt(x, z) - .25, z, rnd() * 6.28, s)]); }
    place(md, L);
  }
}

/* ---------- Kestrel, the dropsite, Farlight, Halvard and the old roads ---------- */
function propPile(parent, name, x, z, ry, n, spread, sMin = .9, sMax = 1.1, col = true) {
  const P = pieces(name); if (!P.length) return; const by = P.map(() => []);
  for (let k = 0; k < n; k++) { const i = Math.floor(rnd() * P.length), lx = rr(-spread, spread), lz = rr(-spread * .5, spread * .5), c = Math.cos(ry), s = Math.sin(ry), px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
    by[i].push(envM(px, heightAt(px, pz), pz, ry + rr(-.4, .4), rr(sMin, sMax))); }
  P.forEach((p, i) => { if (by[i].length) instParts(parent, [p], by[i], p.size.y > .4); });
  if (col) addCol(x, z, spread * .6, 1.2);
}
function buildEnvSites() {
  // Kestrel: against a side or back wall of Salvage, the Trading Post, the Workshop and the Gunsmith — never in a street or another house
  const inHouse = (x, z, me) => SHOP_DEFS.some(D => D !== me && Math.abs((x - D.cx) * Math.cos(D.ry) - (z - D.cz) * Math.sin(D.ry)) < D.bw / 2 + .6 && Math.abs((x - D.cx) * Math.sin(D.ry) + (z - D.cz) * Math.cos(D.ry)) < D.bd / 2 + .6);
  const clear = (p, me, r) => streetDist(p.x, p.z) > r && !inHouse(p.x, p.z, me) && campD(p.x, p.z) < CAMP_R - 3 && !(typeof inHull === 'function' && inHull(p.x, p.z));
  for (const [id, n] of [['salvage', 3], ['trade', 2], ['craft', 2], ['guns', 1], ['bunk', 1]]) {
    const D = SHOP[id]; if (!D) continue;
    const spots = [[D.bw / 2 + 1.1, -1.4], [-(D.bw / 2 + 1.1), -1.4], [D.bw / 2 + 1.1, 1], [-(D.bw / 2 + 1.1), 1], [-2.5, -(D.bd / 2 + 1.1)], [2.5, -(D.bd / 2 + 1.1)]].map(([lx, lz]) => ({ lx, lz, ...shopL2W(D, lx, lz) }));
    const a = spots.find(p => clear(p, D, 1.4)); if (a) propPile(world, 'e/pallets', a.x, a.z, D.ry + (Math.abs(a.lx) > 2.6 ? Math.PI / 2 : 0), n, 1, .9, 1, true);
    const b = spots.find(p => p !== a && clear(p, D, 1) && (!a || Math.hypot(p.x - a.x, p.z - a.z) > 2.5)); if (b) propPile(world, 'e/boxes', b.x, b.z, D.ry, 4, .6, 1.4, 1.9, false);
  }
  for (const id of ['cook', 'salvage', 'trade']) { const D = SHOP[id], P = pieces('e/trashcans'); if (!D || !P.length) continue;
    const p = [[D.bw / 2 + .8, 1.8], [-(D.bw / 2 + .8), 1.8]].map(([lx, lz]) => shopL2W(D, lx, lz)).find(q => clear(q, D, .6)); if (!p) continue;
    instParts(world, [P[id === 'cook' ? 0 : P.length - 1]], [envM(p.x, heightAt(p.x, p.z), p.z, D.ry, 1)]); addCol(p.x, p.z, .45, 1.2); }
  // the dropsite: Arc cargo spilled from the torn end of the wreck
  const cargo = () => pieces('e/containers').filter(p => Math.max(p.size.x, p.size.z) > .7 && p.size.y > .4);
  { const D = POI.dropsite, toCamp = Math.atan2(-D.z, -D.x), ax = Math.cos(toCamp), az = Math.sin(toCamp), C = cargo(), wake = { x: D.x + DROP_WAKE[0], z: D.z + DROP_WAKE[1] };
    if (C.length) { const by = C.map(() => []);
      for (let k = 0, g = 0; k < (LOW ? 8 : 13) && g < 200; g++) { const along = -rr(13, 30), sd = rr(-11, 11), x = D.x + ax * along - az * sd, z = D.z + az * along + ax * sd, i = Math.floor(rnd() * C.length);
        if (Math.hypot(x - wake.x, z - wake.z) < 7 || Math.abs(sd) < 5.5 && along > -15) continue; k++;
        by[i].push(envM(x, heightAt(x, z) - .05, z, rnd() * 6.28, rr(.5, .7), rnd() < .3 ? rr(-.3, .3) : 0, rnd() < .3 ? rr(-.4, .4) : 0)); addCol(x, z, Math.max(C[i].size.x, C[i].size.z) * .26, 1.5); }
      C.forEach((p, i) => instParts(world, [p], by[i])); } }
  // Farlight: the Arc survivors kept their cargo
  { const B = BASES.find(b => b.id === 'farlight'), C = cargo(); if (B && C.length) { const g = farGroup(B.x, B.z, B.R), by = C.map(() => []);
    for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, r = rr(28, B.R - 6), x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r, i = Math.floor(rnd() * C.length); by[i].push(envM(x, heightAt(x, z), z, rnd() * 6.28, .7)); addCol(x, z, Math.max(C[i].size.x, C[i].size.z) * .3, 1.5); }
    C.forEach((p, i) => instParts(g, [p], by[i])); propPile(g, 'e/pallets', B.x + 12, B.z + 14, .4, 4, 1.4); } }
  // Halvard: wrecks on its streets, a bus stop on the old road in, the burnt bus beside it
  { const H = POI.halvard, car = whole('e/car'), cars = [];
    if (car) { for (const lx of [-39, -13, 13, 39]) for (let k = 0; k < 2; k++) { if (rnd() < .4) continue; const z = H.z + rr(-50, 50), x = H.x + lx + rr(-2.5, 2.5); cars.push(envM(x, heightAt(x, z) - .05, z, (rnd() < .5 ? 0 : Math.PI) + rr(-.35, .35), 1)); addCol(x, z - 1.2, 1.2, 1.6); addCol(x, z + 1.2, 1.2, 1.6); }
      instParts(world, car.parts, cars); }
    const p0 = [400, 262], p1 = [H.x, H.z], dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = Math.atan2(ux, uz);
    const bx = p0[0] + ux * 30 - uz * 7, bz = p0[1] + uz * 30 + ux * 7;
    const bs = envPut(world, 'e/busstop', bx, heightAt(bx, bz) - .05, bz, ry + Math.PI / 2); if (bs) addCol(bx, bz, 1.1, 2.8);
    const tx = p0[0] + ux * 52 + uz * 9, tz = p0[1] + uz * 52 - ux * 9, b = envPut(world, 'e/bus', tx, envFloor(tx, tz, 3, 11, ry + .25) - .1, tz, ry + .25);
    if (b) { b.rotation.z = .04; addColLine(tx - Math.sin(ry + .25) * 5, tz - Math.cos(ry + .25) * 5, tx + Math.sin(ry + .25) * 5, tz + Math.cos(ry + .25) * 5, 1.6); }
    const P = pieces('e/trashcans'); if (P.length) { const c = Math.cos(ry), s = Math.sin(ry); instParts(world, [P[0]], [envM(bx + c * 2.6, heightAt(bx, bz), bz - s * 2.6, ry, 1)]); }
  }
  // the old roads in the valley: a car left here and there
  { const car = whole('e/car'); if (car) { const L = [];
    for (const path of PATHS) for (let i = 0; i < path.length - 1; i++) { if (rnd() < .55) continue; const [ax, az] = path[i], [bx, bz] = path[i + 1], t = rr(.2, .8), x0 = lerp(ax, bx, t), z0 = lerp(az, bz, t), ry = Math.atan2(bx - ax, bz - az), off = (rnd() < .5 ? -1 : 1) * rr(3.5, 6);
      const x = x0 + Math.cos(ry) * off, z = z0 - Math.sin(ry) * off; if (campD(x, z) < CAMP_R + 20 || waterAt(x, z) > -1e8 || envKeepClear(x, z)) continue;
      L.push(envM(x, heightAt(x, z) - .1, z, ry + rr(-.6, .6), 1, rr(-.05, .05), rr(-.08, .08))); addCol(x, z, 1.6, 1.6); }
    instParts(world, car.parts, L); } }
  // Greyhold Station: the bunker entrance, dug into the slope behind the station
  { const B = BASES.find(b => b.id === 'greystation'), W = whole('e/bunker'); if (B && W) {
    const away = Math.atan2(B.z, B.x), x = B.x + Math.cos(away) * (B.R + 18), z = B.z + Math.sin(away) * (B.R + 18), ry = Math.atan2(B.x - x, B.z - z);
    const g = farGroup(x, z, 40); envPut(g, 'e/bunker', x, envFloor(x, z, 20, 16, ry) - .15, z, ry); addCol(x, z, 4.5, 6); } }
}
/* Cinder City: the two landmark blocks and the wrecks */
function buildEnvCity(cars) {
  const f = envSite('factory'), s = envSite('street');
  if (f) { const g = farGroup(f.x, f.z, 40), ry = .2, W = whole('e/factory'); if (W) { envPut(g, 'e/factory', f.x, envFloor(f.x, f.z, W.size.x, W.size.z, ry) - .3, f.z, ry); colRect(f.x, f.z, W.size.x - .6, W.size.z - .6, ry, .7, []); cache(g, f.x, f.z, 0, 'pry', 'city', { id: 'c_factory', name: 'Old factory floor', big: 1, rolls: 1, refill: 2 }); } }
  if (s) { const g = farGroup(s.x, s.z, 40), ry = -.15; envPut(g, 'e/street', s.x, heightAt(s.x, s.z) - .25, s.z, ry); const P = pieces('e/trashcans'); if (P.length) instParts(g, [P[0], P[1] || P[0]], [envM(s.x + 6, heightAt(s.x + 6, s.z), s.z + 3, ry)]); }
  dressCity(f, whole('e/factory'), .2);
  // the drawn wrecks in the streets become real ones: one in six a bus
  const car = whole('e/car'), bus = whole('e/bus'); if (!car || !cars?.length) return false;
  const root = farGroup(CITY.x, CITY.z, CITY.R), cm = [], bm = [];
  for (const q of cars) { if (envKeepClear(q[0], q[2])) continue; const isBus = bus && rnd() < .16; (isBus ? bm : cm).push(envM(q[0], q[1] - .1, q[2], q[7], 1, q[6], q[8])); if (isBus) addColLine(q[0] - Math.sin(q[7]) * 4.5, q[2] - Math.cos(q[7]) * 4.5, q[0] + Math.sin(q[7]) * 4.5, q[2] + Math.cos(q[7]) * 4.5, 1.6); }
  instParts(root, car.parts, cm); if (bus) instParts(root, bus.parts, bm);
  return true;
}
