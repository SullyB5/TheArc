let H0 = 0;

/* ================= terrain: chunked, coloured per vertex, detail-textured (ELYRA soil + rock) ================= */
const SCORCH = [{ x: 0, z: 92, r: 26 }, { x: -18, z: 74, r: 12 }, { x: 22, z: 112, r: 14 }, { x: POI.pod.x, z: POI.pod.z, r: 14 }, { x: POI.burn.x, z: POI.burn.z, r: 58 }];
const C_ = s => new THREE.Color(s);
const TC = { grass: C_('#56743a'), grass2: C_('#425f2e'), forest: C_('#33452a'), dirt: C_('#6e5c45'), rock: C_('#6f6c66'), snow: C_('#e2e6e8'), mud: C_('#4a3f33'),
  sand: C_('#8a7d64'), ash: C_('#2c2723'), street: C_('#5a5854') };
function terrainColor(x, z, h, sl, out) {
  out.copy(TC.grass).lerp(TC.grass2, fbm(x * .05, z * .05)).lerp(TC.forest, smooth(.45, .7, fbm(x * .012 + 40, z * .012)) * .8);
  out.lerp(TC.rock, smooth(.7, 1.3, sl));
  out.lerp(TC.snow, smooth(122, 150, h + fbm(x * .05, z * .05) * 14) * (1 - smooth(1.2, 1.8, sl) * .5));
  const w = waterAt(x, z); if (w > -1e8) out.lerp(TC.sand, (1 - smooth(.2, 2.2, h - w)) * .85);
  const pd = pathDist(x, z); out.lerp(TC.dirt, (1 - smooth(1.8, 4.2, pd)) * .9);
  const cd = Math.hypot(x, z); out.lerp(TC.mud, (1 - smooth(30, 46, cd)) * .75);
  for (const p of [POI.village, POI.ashmere]) { const vd = Math.hypot(x - p.x, z - p.z); out.lerp(TC.dirt, (1 - smooth(14, 30, vd)) * .7); }
  const hd = Math.hypot(x - POI.halvard.x, z - POI.halvard.z); if (hd < 90) { const gx = Math.abs(((x - POI.halvard.x) % 26 + 26) % 26 - 13), gz = Math.abs(((z - POI.halvard.z) % 26 + 26) % 26 - 13); if (Math.min(gx, gz) > 9.5 && hd < 75) out.lerp(TC.street, .8); }
  for (const s of SCORCH) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r) out.lerp(TC.ash, (1 - d / s.r) * .85); }
  out.multiplyScalar(.92 + hash(x * .7, z * .7) * .16);
  return out;
}
const slopeAt = (x, z) => { const h = heightAt(x, z); return Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5; };
/* streamed: only the chunks near you exist; new ones are built a few rows per frame so walking never hitches */
const CH = 160, NCH = Math.ceil(HALF * 2 / CH), TSEG = LOW ? 40 : 64;
let terrMat = null, terrIdx = null, chunkJob = null;
const CHUNKS = new Map();
const T_LOAD = 470, T_DROP = 700;
const chunkRectD = (ci, cj, px, pz) => { const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH; return Math.hypot(Math.max(x0 - px, 0, px - x0 - CH), Math.max(z0 - pz, 0, pz - z0 - CH)); };
function chunkExists(ci, cj) { const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH; return Math.hypot(x0 + CH / 2, z0 + CH / 2) <= HALF + 120; }
function startChunk(ci, cj) {
  const n = (TSEG + 1) * (TSEG + 1);
  return { ci, cj, row: 0, x0: -HALF + ci * CH, z0: -HALF + cj * CH, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Float32Array(n * 3), uv: new Float32Array(n * 2) };
}
const _tc = new THREE.Color();
function stepChunk(J, ms) {
  const t0 = performance.now(), { pos, nor, col, uv } = J;
  while (J.row <= TSEG) {
    const j = J.row;
    for (let i = 0; i <= TSEG; i++) {
      const k = j * (TSEG + 1) + i, x = J.x0 + i * CH / TSEG, z = J.z0 + j * CH / TSEG, h = heightAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const hx = heightAt(x + 1, z) - heightAt(x - 1, z), hz = heightAt(x, z + 1) - heightAt(x, z - 1);
      const l = Math.hypot(hx, 2, hz); nor[k * 3] = -hx / l; nor[k * 3 + 1] = 2 / l; nor[k * 3 + 2] = -hz / l;
      terrainColor(x, z, h, Math.hypot(hx, hz) / 2, _tc); col[k * 3] = _tc.r; col[k * 3 + 1] = _tc.g; col[k * 3 + 2] = _tc.b;
      uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    }
    J.row++;
    if (ms && performance.now() - t0 > ms) return false;
  }
  if (!terrIdx) { const idx = []; for (let j = 0; j < TSEG; j++) for (let i = 0; i < TSEG; i++) { const a = j * (TSEG + 1) + i, b = a + 1, d = a + TSEG + 1, e = d + 1; idx.push(a, d, b, b, d, e); } terrIdx = new THREE.Uint32BufferAttribute(idx, 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(terrIdx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, terrMat); m.receiveShadow = true; world.add(m);
  CHUNKS.set(J.ci * 1000 + J.cj, m);
  return true;
}
function nearestMissingChunk(px, pz) {
  let best = null, bd = T_LOAD;
  const c0 = Math.floor((px + HALF) / CH), c1 = Math.floor((pz + HALF) / CH), rad = Math.ceil(T_LOAD / CH) + 1;
  for (let cj = c1 - rad; cj <= c1 + rad; cj++) for (let ci = c0 - rad; ci <= c0 + rad; ci++) {
    if (ci < 0 || cj < 0 || ci >= NCH || cj >= NCH || CHUNKS.has(ci * 1000 + cj) || !chunkExists(ci, cj)) continue;
    const d = chunkRectD(ci, cj, px, pz); if (d < bd) { bd = d; best = [ci, cj]; }
  }
  return best;
}
function updTerrain(px, pz, ms = 3.5) {
  for (const [k, m] of CHUNKS) if (chunkRectD(Math.floor(k / 1000), k % 1000, px, pz) > T_DROP) { world.remove(m); m.geometry.dispose(); CHUNKS.delete(k); }
  if (chunkJob && chunkRectD(chunkJob.ci, chunkJob.cj, px, pz) > T_LOAD + 60) chunkJob = null;
  // after a teleport (respawn at camp) the ground under you is built immediately, the rest streams in
  for (let k = 0; k < 4; k++) { const n = nearestMissingChunk(px, pz); if (!n || chunkRectD(n[0], n[1], px, pz) > 140) break; if (chunkJob && chunkJob.ci === n[0] && chunkJob.cj === n[1]) chunkJob = null; stepChunk(startChunk(n[0], n[1]), 0); }
  if (!chunkJob) { const n = nearestMissingChunk(px, pz); if (n) chunkJob = startChunk(n[0], n[1]); }
  if (chunkJob && stepChunk(chunkJob, ms)) chunkJob = null;
}
async function buildTerrain(px = 0, pz = 0) {
  terrMat ||= new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.detailSoil, normalMap: TX.soilN, normalScale: new THREE.Vector2(.6, .6) });
  let done = 0, n;
  while ((n = nearestMissingChunk(px, pz))) {
    stepChunk(startChunk(n[0], n[1]), 0);
    if (++done % 4 === 0) { setLoad(`LAYING THE GROUND ${done}`); await nextFrame(); }
  }
}

/* ================= water: the Coldwater and Lake Ilse ================= */
let waterMat;
function buildWater() {
  waterMat = new THREE.MeshStandardMaterial({ color: 0x1f3a3a, roughness: .06, metalness: .1, transparent: true, opacity: .84, normalMap: texWaterN, normalScale: new THREE.Vector2(.35, .35), depthWrite: false });
  texWaterN.repeat.set(1 / 9, 1 / 9);
  const pos = [], uv = [], idx = [];
  let k = 0;
  for (let z = -HALF; z <= HALF; z += 4) {
    const rx = riverX(z), y = riverWL(z) - .4, w = RIV_HW + 4;
    pos.push(rx - w, y, z, rx + w, y, z); uv.push((rx - w), z, (rx + w), z);
    if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    k++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const river = new THREE.Mesh(g, waterMat); river.renderOrder = 1; world.add(river);
  for (const L of LAKES) {
    const lg = new THREE.CircleGeometry(L.R * 1.33, 64); lg.rotateX(-Math.PI / 2);
    const luv = lg.attributes.uv, lp = lg.attributes.position; for (let i = 0; i < luv.count; i++) luv.setXY(i, lp.getX(i) + L.x, lp.getZ(i) + L.z);
    const lake = new THREE.Mesh(lg, waterMat); lake.position.set(L.x, L.L - .5, L.z); lake.renderOrder = 1; world.add(lake);
  }
}

/* ================= forest: firs, alders, snags, rocks, cliffs — instanced in map tiles so the camera culls them ================= */
const world = new THREE.Group(); scene.add(world);
const SCRAPS = [], CRATES = [], DECOR_ANIM = [];
const TREEMAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
let fireLight, campLight, gateGroup, gateDoors = [], wallGroup, towers = [], beaconSmoke = [], vaultLamp, signMat, relayLamp;
function firGeo() {
  // lowest branches start ~3m up (after scaling) so you never stand inside the skirt
  const parts = [{ geo: new THREE.CylinderGeometry(.13, .3, 4.4, 6), m: tm(0, 2.2, 0), color: 0x4a3626, color2: 0x5e4634 }];
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), r = lerp(2.3, .45, t), y = lerp(3.7, 9.8, t), hgt = lerp(2.3, 1.6, t);
    parts.push({ geo: new THREE.ConeGeometry(r, hgt, 8, 1, true), m: tm(0, y, 0, 0, i * .7), color: 0x3f644a, color2: i % 2 ? 0x76a274 : 0x6a9868 });
  }
  parts.push({ geo: new THREE.ConeGeometry(.3, 1.2, 6), m: tm(0, 10.8, 0), color: 0x6a9868, color2: 0x82b07c });
  return merge(parts, .28);
}
function alderGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(.12, .22, 5, 6), m: tm(0, 2.5, 0), color: 0x8c867a }];
  for (let i = 0; i < 5; i++) parts.push({ geo: new THREE.IcosahedronGeometry(rr(1.2, 1.7), 0), m: tm(rr(-1, 1), rr(5, 6.6), rr(-1, 1)), color: 0x4a6a32, color2: 0x7a9a48 });
  return merge(parts, .35);
}
function snagGeo() {
  return merge([
    { geo: new THREE.CylinderGeometry(.12, .3, 7, 5), m: tm(0, 3.5, 0), color: 0x5d564c, color2: 0x8a8174 },
    { geo: new THREE.CylinderGeometry(.04, .08, 2.2, 4), m: tm(.5, 4.5, 0, 0, 0, -.9), color: 0x6d655a },
    { geo: new THREE.CylinderGeometry(.04, .08, 1.6, 4), m: tm(-.4, 5.6, 0, 0, 0, .8), color: 0x6d655a },
  ], .05);
}
function treeOK(x, z) {
  if (Math.hypot(x, z) < 62) return false;
  if (pathDist(x, z) < 5.5) return false;
  if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30) || OUT_MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 45)) return false;
  if (HOLDS.some(H => Math.hypot(x - H.x, z - H.z) < H.R + 14)) return false;
  for (const p of [[POI.cinder, 110], [POI.watchers, 30]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  for (const p of [[POI.village, 34], [POI.pod, 18], [POI.halvard, 96], [POI.ashmere, 62], [POI.burn, 64], [POI.lookout, 14]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  if (Math.hypot(x - POI.vault.x, z - POI.vault.z - 8) < 24) return false;
  if (SHELTERS.some(s => Math.hypot(x - s.x, z - s.z) < 12) || SCOUTS.some(s => Math.hypot(x - s.x, z - s.z) < 16)) return false;
  if (Math.abs(x) < 46 && z > 50 && z < 130 && rnd() < .8) return false;
  if (Math.abs(x - POI.bridge.x) < 60 && Math.abs(z - POI.bridge.z) < 10) return false;
  const h = heightAt(x, z); if (h > 138 || waterAt(x, z) > h - .6) return false;
  if (slopeAt(x, z) > 1.5) return false;
  return true;
}
async function buildForest() {
  const BT = 200, NB = Math.ceil(HALF * 2 / BT);
  const kinds = [{ geo: firGeo(), n: LOW ? 5200 : 9500, list: {} }, { geo: alderGeo(), n: LOW ? 600 : 1200, list: {} }, { geo: snagGeo(), n: 260, list: {} }];
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (const K of kinds) {
    let n = 0, guard = 0;
    while (n < K.n && guard++ < K.n * 25) {
      const x = rr(-VALLEY - 120, VALLEY + 120), z = rr(-VALLEY - 120, VALLEY + 120);
      if (Math.hypot(x, z) > VALLEY + 140) continue;
      const dens = fbm(x * .018 + 5, z * .018 + 11);
      if (K === kinds[1] ? (dens > .55 || rnd() > .5) : rnd() > smooth(.3, .6, dens) + .14) continue;
      if (K === kinds[1] && waterAt(x, z) < -1e8 && Math.abs(x - riverX(z)) > 60 && LAKES.every(L => Math.hypot(x - L.x, z - L.z) > L.R + 56) && rnd() < .7) continue;
      if (!treeOK(x, z)) continue;
      const s = K === kinds[0] ? rr(.85, 1.3) : rr(.8, 1.2), sy = K === kinds[0] ? rr(1.2, 2.1) : rr(.9, 1.3);
      dummy.position.set(x, heightAt(x, z) - .25, z); dummy.rotation.set(rr(-.04, .04), rnd() * 6, rr(-.04, .04)); dummy.scale.set(s, sy, s); dummy.updateMatrix();
      const b = Math.floor((x + HALF) / BT) + Math.floor((z + HALF) / BT) * NB;
      (K.list[b] ||= []).push([dummy.matrix.clone(), tint.setHSL(rr(.27, .36), rr(.1, .3), rr(.75, 1.05)).clone()]);
      addCol(x, z, (K === kinds[0] ? .45 : .3) * s); addRes(['fir', 'alder', 'snag'][kinds.indexOf(K)], x, z, s);
      n++;
    }
    for (const b in K.list) {
      const L = K.list[b], im = new THREE.InstancedMesh(K.geo, TREEMAT, L.length);
      L.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); world.add(im); FAR_HIDE.push(im);
    }
    await nextFrame();
  }
  // rocks
  const rockMat = new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 900);
  rocks.castShadow = rocks.receiveShadow = true;
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2, r = 60 + Math.sqrt(rnd()) * (VALLEY + 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDist(x, z) < 4 || Math.hypot(x - POI.halvard.x, z - POI.halvard.z) < 80) { i--; continue; }
    const s = rnd() < .1 ? rr(2, 4.5) : rr(.4, 1.4);
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.set(s * rr(1, 1.6), s * rr(.6, 1), s); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    if (s > 1) addCol(x, z, s * 1.1);
    addRes(s > 1 ? 'boulder' : 'stone', x, z, s);
  }
  world.add(rocks);
  // cliff outcrops (ELYRA's cliff model) on the steep faces: mountainsides and the gorge
  if (MODELS.cliff) {
    let placed = 0, guard = 0;
    while (placed < (LOW ? 40 : 70) && guard++ < 6000) {
      const x = rr(-VALLEY, VALLEY), z = rr(-VALLEY, VALLEY);
      const sl = slopeAt(x, z); if (sl < 1 || Math.hypot(x, z) < 90 || pathDist(x, z) < 22 || heightAt(x, z) < 20) continue;
      if (FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r1 + 25) || SCOUTS.some(q => Math.hypot(x - q.x, z - q.z) < 40)) continue;
      const s = rr(10, 26), c = modelCopy('cliff', s);
      c.position.set(x, heightAt(x, z) - s * .25, z); c.rotation.y = rnd() * 6; world.add(c);
      c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color = new THREE.Color(0x8c8a84); } });
      addCol(x, z, s * .38); placed++;
    }
  }
  // undergrowth (no collision)
  const fern = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x34502a, color2: 0x5a7a3a }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x3c5a2e, color2: 0x62843e }], .1);
  const ferns = new THREE.InstancedMesh(fern, VCOL, LOW ? 1800 : 4000);
  for (let i = 0; i < ferns.count; i++) {
    const x = rr(-VALLEY, VALLEY), z = rr(-VALLEY, VALLEY);
    if (pathDist(x, z) < 3 || Math.hypot(x, z) < 48 || waterAt(x, z) > heightAt(x, z) - .4) { i--; continue; }
    const s = rr(.6, 1.5); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
    ferns.setMatrixAt(i, dummy.matrix); addRes('fern', x, z, s);
  }
  ferns.receiveShadow = true; world.add(ferns);
}

/* ================= the outlands forest: 200m cells grown as you approach, from a seed per cell, so they're the same every visit ================= */
const FAR_HIDE = [];                          // valley tree buckets: hidden once you're far from them
const CELL_T = 200, NCT = Math.ceil(HALF * 2 / CELL_T), OCELLS = new Map(), OCOLS = new Set();
let OGEO = null, rockMatO = null, fernGeoO = null;
function cellRng(ci, cj) { let a = (ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function growCell(ci, cj) {
  if (!OGEO) { OGEO = [firGeo(), alderGeo(), snagGeo()]; rockMatO = new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e, flatShading: true });
    fernGeoO = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x34502a, color2: 0x5a7a3a }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x3c5a2e, color2: 0x62843e }], .1); }
  const R = cellRng(ci, cj), x0 = -HALF + ci * CELL_T, z0 = -HALF + cj * CELL_T, key = ci * 1000 + cj, cols = !OCOLS.has(key);
  const g = new THREE.Group(), dummy = new THREE.Object3D(), tint = new THREE.Color();
  const inner = (x, z) => Math.hypot(x, z) < VALLEY + 140 || Math.hypot(x, z) > WORLD + 60;
  const K = [[LOW ? 260 : 440, []], [LOW ? 30 : 60, []], [12, []]];
  K.forEach(([tries, L], ki) => {
    for (let t = 0; t < tries; t++) {
      const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z)) continue;
      const dens = fbm(x * .018 + 5, z * .018 + 11);
      if (ki === 1 ? (dens > .55 || R() > .5) : R() > smooth(.3, .6, dens) + .14) continue;
      if (ki === 1 && waterAt(x, z) < -1e8 && Math.abs(x - riverX(z)) > 60 && LAKES.every(L => Math.hypot(x - L.x, z - L.z) > L.R + 56) && R() < .7) continue;
      if (!treeOK(x, z)) continue;
      const s = ki === 0 ? lerp(.85, 1.3, R()) : lerp(.8, 1.2, R()), sy = ki === 0 ? lerp(1.2, 2.1, R()) : lerp(.9, 1.3, R());
      dummy.position.set(x, heightAt(x, z) - .25, z); dummy.rotation.set((R() - .5) * .08, R() * 6, (R() - .5) * .08); dummy.scale.set(s, sy, s); dummy.updateMatrix();
      L.push([dummy.matrix.clone(), tint.setHSL(lerp(.27, .36, R()), lerp(.1, .3, R()), lerp(.75, 1.05, R())).clone()]);
      if (cols) { addCol(x, z, (ki === 0 ? .45 : .3) * s); addRes(['fir', 'alder', 'snag'][ki], x, z, s); }
    }
    if (!L.length) return;
    const im = new THREE.InstancedMesh(OGEO[ki], TREEMAT, L.length);
    L.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  });
  const rocks = [], ferns = [];
  for (let t = 0; t < 20; t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 4 || waterAt(x, z) > heightAt(x, z) - .4) continue;
    const s = R() < .12 ? lerp(2, 4.5, R()) : lerp(.4, 1.4, R());
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(s * lerp(1, 1.6, R()), s * lerp(.6, 1, R()), s); dummy.updateMatrix();
    rocks.push(dummy.matrix.clone()); if (cols && s > 1) addCol(x, z, s * 1.1); if (cols) addRes(s > 1 ? 'boulder' : 'stone', x, z, s);
  }
  for (let t = 0; t < (LOW ? 40 : 90); t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 3 || waterAt(x, z) > heightAt(x, z) - .4) continue;
    const s = lerp(.6, 1.5, R()); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); ferns.push(dummy.matrix.clone()); if (cols) addRes('fern', x, z, s);
  }
  for (const [L, geo, mat, sh] of [[rocks, null, null, true], [ferns, fernGeoO, VCOL, false]]) {
    if (!L.length) continue;
    const im = new THREE.InstancedMesh(geo || new THREE.DodecahedronGeometry(1, 0), mat || rockMatO, L.length);
    L.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = sh; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  }
  if (MODELS.cliff && R() < .5) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T;
    if (!inner(x, z) && slopeAt(x, z) > 1 && pathDist(x, z) > 22 && !FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r1 + 25)) {
      const s = lerp(10, 26, R()), c = modelCopy('cliff', s); c.position.set(x, heightAt(x, z) - s * .25, z); c.rotation.y = R() * 6; g.add(c);
      if (cols) addCol(x, z, s * .38);
    }
  }
  OCOLS.add(key); world.add(g); OCELLS.set(key, g);
}
const FOR_SHOW = 430, FOR_DROP = 900;
let farT = 0;
function updForest(px, pz, dt) {
  farT -= dt; if (farT > 0) return; farT = .25;
  for (const im of FAR_HIDE) { const c = im.boundingSphere.center; im.visible = Math.hypot(c.x - px, c.z - pz) < FOR_SHOW + im.boundingSphere.radius * .5; }
  for (const [k, g] of OCELLS) {
    const ci = Math.floor(k / 1000), cj = k % 1000, d = Math.hypot(-HALF + (ci + .5) * CELL_T - px, -HALF + (cj + .5) * CELL_T - pz);
    if (d > FOR_DROP) { world.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); OCELLS.delete(k); } else g.visible = d < FOR_SHOW;
  }
  if (Math.hypot(px, pz) < VALLEY - 120) return;
  // grow the nearest missing cell (one per tick)
  let best = null, bd = FOR_SHOW - 60; const c0 = Math.floor((px + HALF) / CELL_T), c1 = Math.floor((pz + HALF) / CELL_T);
  for (let cj = c1 - 3; cj <= c1 + 3; cj++) for (let ci = c0 - 3; ci <= c0 + 3; ci++) {
    if (ci < 0 || cj < 0 || ci >= NCT || cj >= NCT || OCELLS.has(ci * 1000 + cj)) continue;
    const cx = -HALF + (ci + .5) * CELL_T, cz = -HALF + (cj + .5) * CELL_T, d = Math.hypot(cx - px, cz - pz);
    if (Math.hypot(cx, cz) < VALLEY - 40 || Math.hypot(cx, cz) > WORLD + 200) continue;
    if (d < bd) { bd = d; best = [ci, cj]; }
  }
  if (best) { growCell(best[0], best[1]); farT = .05; }
}

/* ================= grass: a patch of blades that follows you, swaying in the wind ================= */
let grassMesh, grassU = { uTime: { value: 0 } }, grassAt = { x: 1e9, z: 1e9 };
function buildGrass() {
  const geo = new THREE.PlaneGeometry(.06, .55, 1, 3); geo.translate(0, .275, 0);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / .55; p.setX(i, p.getX(i) * (1 - t * .85) + t * t * .12); const c = new THREE.Color(0x24361c).lerp(new THREE.Color(0x8aa65a), t); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = grassU.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float tip = position.y / .55;
      float w = sin(uTime*1.7 + ip.x*.35 + ip.z*.27) * .5 + sin(uTime*2.9 + ip.x*.9) * .2;
      transformed.x += w * .22 * tip * tip; transformed.z += sin(uTime*1.3 + ip.z*.4) * .09 * tip * tip;`);
  };
  grassMesh = new THREE.InstancedMesh(geo, mat, LOW ? 7000 : 18000);
  grassMesh.frustumCulled = false; grassMesh.receiveShadow = true; grassMesh.count = 0;
  world.add(grassMesh);
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color(), _gy = new THREE.Vector3(0, 1, 0);
function updGrass(px, pz) {
  if (Math.hypot(px - grassAt.x, pz - grassAt.z) < 5) return;
  grassAt.x = Math.round(px / 2) * 2; grassAt.z = Math.round(pz / 2) * 2;
  const R = LOW ? 24 : 34, step = LOW ? .5 : .45, max = grassMesh.instanceMatrix.count;
  let n = 0;
  for (let gx = grassAt.x - R; gx <= grassAt.x + R && n < max; gx += step) for (let gz = grassAt.z - R; gz <= grassAt.z + R && n < max; gz += step) {
    const hx = hash(Math.round(gx / step), Math.round(gz / step)), hz = hash(Math.round(gz / step) + 7, Math.round(gx / step));
    const x = gx + (hx - .5) * step, z = gz + (hz - .5) * step;
    const dd = (x - px) ** 2 + (z - pz) ** 2; if (dd > R * R) continue;
    const cd = Math.hypot(x, z); if (cd < 44 && hx > .05) continue;
    const h = heightAt(x, z);
    if (h > 128 || waterAt(x, z) > h - .3) continue;
    const dens = fbm(x * .04, z * .04); if (hx > dens * 1.5) continue;
    if (Math.abs(hz - .5) < .15 && pathDist(x, z) < 2.4) continue;
    if (slopeAt(x, z) > 1.1) continue;
    _gq.setFromAxisAngle(_gy, hx * 6.28); const s = .65 + hz * .6;
    _gs.set(s, s * (.7 + dens * .9), s); _gp.set(x, h - .05, z); _gm.compose(_gp, _gq, _gs);
    grassMesh.setMatrixAt(n, _gm); _gc.setHSL(.24 + hx * .07, .35, .55 + hz * .25); grassMesh.setColorAt(n, _gc); n++;
  }
  grassMesh.count = n; grassMesh.instanceMatrix.needsUpdate = true; if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
}

/* ================= mist: soft banks that hang on the mountain and drift through the valley ================= */
const mistTex = ctex(256, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const MIST = [];
function buildMist() {
  const spots = [[10, -120, 60], [-40, -150, 80], [60, -160, 90], [-12, -40, 40], [POI.burn.x, POI.burn.z, 20], [-300, -300, 120], [POI.lake.x, POI.lake.z, 6], [riverX(100), 100, 6], [riverX(-200), -200, 6], [-150, 320, 30]];
  for (const [x, z, up] of spots) for (let i = 0; i < 4; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: .32, depthWrite: false, color: 0xdfe6e4 }));
    const px = x + rr(-50, 50), pz = z + rr(-50, 50);
    m.position.set(px, heightAt(px, pz) + up * rr(.6, 1.2) + 8, pz); m.scale.set(rr(90, 160), rr(26, 44), 1);
    world.add(m); MIST.push({ m, x: px, z: pz, ph: rnd() * 6 });
  }
}
