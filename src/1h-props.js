
/* ================= Bryce's second model batch (Nov 10): assets/models/props/ =================
   36 models (compressed: GLTFLoader + MeshoptDecoder). Packs that were joined into one mesh per material (medbay-pack,
   floor-modular, floor-section, floor-section-b) are split back into pieces by their geometry islands (`npSplit`);
   repeated things are instanced (`instParts` from 1g-env.js). Where they go:
   · the dropsite: a broken-off station section lying in the dirt beside the hull, in three pieces — windowed hull bays (wall-b
     pairs) with the seats still bolted in, bunks, lootable lockers, fuel cells and medkits spilled round it, deck plates and
     grating thrown along the furrow, the cargo-bay floor panel, a roof-plate lean-to
   · the Arc (the raid holdout) — the only place the station's own interior (hallway, corridor) is used: an infirmary at the west end (the medbay pack, beds, lamps, medkits, a drop ceiling with
     strip lights), a bunk room of stacked pods, lockers by the door, machinery round the core, and the radio room at the
     far end of the east wing (wall screens, consoles, server racks, a rack of walkie-talkies, seats); you walk into the
     infirmary through the white hallway, and the dark corridor runs from the core into the wing. The interior only draws when you can
     see into the hull (`updArcInterior`).
   · Kestrel: a wood stove in every building, gas bottles in the workshops and the power yard, the fuel tank by the genset,
     medkits in the clinic, a walkie-talkie on the gun bench, salvage on Gus's bench
   · Cinder City: the park arch as a landmark in its own cleared park, statues and pillars scattered through the streets as
     ruins, fuel tanks beside the old factory
   · the Old Arches: stone-arch-ruins on the hill north of Kestrel, a point of interest with loot you can see from the yard
   The radio warnings before night 100 come in over the walkie-talkie (`radioDay` in 3-game.js). */
const NEW_PROPS = ['bed', 'catwalk-bridge', 'ceiling-light', 'chairs-x4', 'cinema-camera', 'computer-console', 'corridor', 'floor-material', 'floor-modular', 'floor-panel',
  'floor-section-b', 'floor-section', 'floor-tiles', 'fuel-cell', 'gas-bottle', 'hallway', 'keypad-panel', 'locker', 'medbay-pack', 'medkit-case', 'medkit-small', 'roof-panel',
  'server-rack', 'server-tower', 'statue', 'stone-arch-ruins', 'stone-pillar', 'walkie-talkie', 'wall-2', 'wall-3', 'wall-4', 'wall-b', 'wall-c', 'wall-screen',
  'fuel-tank', 'park-arch', 'wood-stove'].map(n => 'props/' + n);
const npHas = n => !!MODELS['props/' + n];
const npW = n => whole('props/' + n);
// its own random stream, so placing these never moves anything else in the world
let NP_S = 424242;
const nrnd = () => (NP_S = (NP_S * 16807) % 2147483647, (NP_S - 1) / 2147483646), nr = (a, b) => a + nrnd() * (b - a);
const HPI = Math.PI / 2;

/* ---------- splitting packs: weld by position, find connected islands, gather islands whose boxes touch ---------- */
const NP_SPLIT = {};
function npSplit(name, gap = .05, perMesh = false) {
  const key = name + gap + perMesh; if (NP_SPLIT[key]) return NP_SPLIT[key];
  const root = MODELS['props/' + name]; if (!root) return [];
  root.updateMatrixWorld(true);
  const meshes = [], isl = [], v = new THREE.Vector3();
  root.traverse(m => { if (m.isMesh) meshes.push(m); });
  const data = meshes.map((m, mi) => {
    const src = m.geometry, pos = src.attributes.position, n = pos.count, P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const weld = new Map(), id = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 1e3) + ',' + Math.round(P[i * 3 + 1] * 1e3) + ',' + Math.round(P[i * 3 + 2] * 1e3); let w = weld.get(k); if (w === undefined) weld.set(k, w = weld.size); id[i] = w; }
    const par = new Int32Array(weld.size).map((_, i) => i), find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    const ix = src.index ? src.index.array : Uint32Array.from({ length: n }, (_, i) => i), nt = ix.length / 3;
    for (let t = 0; t < nt; t++) { const a = find(id[ix[t * 3]]), b = find(id[ix[t * 3 + 1]]); par[b] = a; par[find(id[ix[t * 3 + 2]])] = a; }
    const by = new Map();
    for (let t = 0; t < nt; t++) { const r = find(id[ix[t * 3]]); let I = by.get(r); if (!I) by.set(r, I = { mi, tris: [], box: new THREE.Box3() }); I.tris.push(t); for (let k = 0; k < 3; k++) { const j = ix[t * 3 + k]; I.box.expandByPoint(v.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2])); } }
    for (const I of by.values()) isl.push(I);
    return { P, ix };
  });
  const par = isl.map((_, i) => i), find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const order = isl.map((_, i) => i).sort((a, b) => isl[a].box.min.x - isl[b].box.min.x), eb = new THREE.Box3();
  for (let i = 0; i < order.length; i++) { const A = isl[order[i]]; eb.copy(A.box).expandByScalar(gap);
    for (let j = i + 1; j < order.length; j++) { const B = isl[order[j]]; if (B.box.min.x > eb.max.x) break; if ((!perMesh || A.mi === B.mi) && eb.intersectsBox(B.box)) par[find(order[j])] = find(order[i]); } }
  const groups = new Map(); isl.forEach((I, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(I); });
  const out = [], nv = new THREE.Vector3();
  for (const L of groups.values()) {
    const box = new THREE.Box3(); for (const I of L) box.union(I.box);
    const ctr = box.getCenter(new THREE.Vector3()), parts = [];
    for (let mi = 0; mi < meshes.length; mi++) {
      const mine = L.filter(I => I.mi === mi); if (!mine.length) continue;
      const m = meshes[mi], src = m.geometry, { P, ix } = data[mi], uv = src.attributes.uv, nrm = src.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const map = new Map(), pos = [], uvs = [], nor = [], idx = [];
      for (const I of mine) for (const t of I.tris) for (let k = 0; k < 3; k++) { const j = ix[t * 3 + k]; let w = map.get(j);
        if (w === undefined) { map.set(j, w = map.size); pos.push(P[j * 3] - ctr.x, P[j * 3 + 1] - box.min.y, P[j * 3 + 2] - ctr.z); if (uv) uvs.push(uv.getX(j), uv.getY(j)); if (nrm) { nv.fromBufferAttribute(nrm, j).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z); } }
        idx.push(w); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals();
      g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere(); parts.push({ geo: g, mat: m.material });
    }
    out.push({ name: meshes[L[0].mi].name, parts, size: box.getSize(new THREE.Vector3()), ctr, base: box.min.y });
  }
  out.sort((a, b) => a.ctr.x - b.ctr.x || a.ctr.z - b.ctr.z);
  return NP_SPLIT[key] = out;
}

/* collision for a ruin, from its own stone: every standing island taller than a man gets a post where it stands */
function npStoneCols(name, ox, oz, ry, s, h) {
  for (const P of npSplit(name, .05)) { if (P.size.y * s < 1.6 || P.base * s > 1) continue; const r = Math.min(P.size.x, P.size.z) * s * .5, L = Math.max(P.size.x, P.size.z) * s, n = Math.max(1, Math.round(L / (r * 2 + .01)));
    for (let k = 0; k < n; k++) { const t = n > 1 ? (k / (n - 1) - .5) * (L - 2 * r) : 0, lx = P.ctr.x * s + (P.size.x >= P.size.z ? t : 0), lz = P.ctr.z * s + (P.size.x >= P.size.z ? 0 : t); const [x, z] = npL2W(ox, oz, ry, lx, lz); addCol(x, z, Math.max(.35, r), h); } }
}

/* a model with some meshes dropped by name and/or the triangles inside a box cut away (model space, before centring):
   used to open the station's doors so its passages are walk-through */
const NP_OPEN = {};
function npOpened(name, drop, cut) {
  if (NP_OPEN[name]) return NP_OPEN[name]; const W = npW(name), src = MODELS['props/' + name]; if (!W) return null;
  const names = []; src.traverse(m => { if (m.isMesh) names.push(m.name); });
  const box = new THREE.Box3(), parts = [];
  W.parts.forEach((p, i) => { if (drop && drop.test(names[i])) return; let geo = p.geo;
    if (cut) { const pos = geo.attributes.position, ix = geo.index ? geo.index.array : null, n = ix ? ix.length : pos.count, keep = [], v = new THREE.Vector3(), c = new THREE.Vector3();
      for (let t = 0; t < n; t += 3) { c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, ix ? ix[t + k] : t + k)); c.multiplyScalar(1 / 3); if (!cut.containsPoint(c)) for (let k = 0; k < 3; k++) keep.push(ix ? ix[t + k] : t + k); }
      geo = geo.clone(); geo.setIndex(keep); geo.computeBoundingSphere(); }
    parts.push({ geo, mat: p.mat }); });
  return NP_OPEN[name] = { parts, size: W.size };
}

/* ---------- placing ---------- */
// one copy as plain meshes (bakes + culls with its group); s may be a number or [sx, sy, sz]
function npPut(parent, src, x, y, z, ry = 0, s = 1, o = {}) {
  const W = typeof src === 'string' ? npW(src) : src; if (!W) return null; const g = new THREE.Group();
  for (const p of W.parts) { if (o.skip && o.skip(p)) continue; const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = o.shadow ?? true; m.receiveShadow = true; g.add(m); }
  g.position.set(x, y, z); g.rotation.set(o.rx || 0, ry, o.rz || 0); if (Array.isArray(s)) g.scale.set(...s); else g.scale.setScalar(s); parent.add(g); return g;
}
// many copies, instanced: list of [x, y, z, ry, s, rx, rz]
function npInst(parent, src, list, shadow = true) {
  const W = typeof src === 'string' ? npW(src) : src; if (!W || !list.length) return [];
  return instParts(parent, W.parts, list.map(a => envM(a[0], a[1], a[2], a[3] || 0, a[4] ?? 1, a[5] || 0, a[6] || 0)), shadow);
}
const npPiece = (name, test, gap = .02, perMesh = true) => npSplit(name, gap, perMesh).filter(p => test(p.name));
// a frame's local (x, z) to world, for collision
const npL2W = (ox, oz, yaw, x, z) => [ox + x * Math.cos(yaw) + z * Math.sin(yaw), oz - x * Math.sin(yaw) + z * Math.cos(yaw)];
// a cache whose box is swapped for a model (lockers, med cases)
function npCache(parent, model, size, x, z, yaw, table, o) {
  const C = cache(parent, x, z, yaw, 'none', table, o), W = npW(model); if (!W) return C;
  C.g.children[0].visible = false; C.g.remove(C.g.children[0]);
  const k = size / W.size.y; for (const p of W.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(k); m.rotation.y = o.front ?? 0; m.castShadow = m.receiveShadow = true; C.g.add(m); }
  return C;
}

/* ================= the Arc: infirmary, bunk room, radio room ================= */
// the radio room is the far end of the east wing (the hull bends round to the south there): a point s metres along the wing's
// centreline, o metres to its side, with the wing's direction there
const wingAt = (s, o = 0) => { const p = WING.pts.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b); return { x: p.x + p.nx * o, z: p.z + p.nz * o, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz }; };
const ARC_RADIO = wingAt(WING.len - 5.6), ARC_WALKIES = wingAt(WING.len - 9, -2.6);
let arcInside = null; const ARC_LIGHTS = [];
function dressArc() {
  if (!npHas('bed')) return;
  const C = ARC.C, F = -C + .14, X = ARC.x, Z = ARC.z;
  // its own world group (so the bake merges inside it and it can be switched off when you can't see in); lit by the hull lamp
  const g = new THREE.Group(); g.position.set(X, H0 + C, Z); world.add(g); arcInside = g;
  const col = (x, z, r, h = 6) => addCol(X + x, Z + z, r, h), colL = (x0, z0, x1, z1, r) => addColLine(X + x0, Z + z0, X + x1, Z + z1, r);
  const lite = !LOW;
  // ceiling: strip lights down the roof, hung upside down (the light side of the model faces up)
  { const L = []; for (let x = -ARC.LW + 6; x < ARC.LE - 3; x += lite ? 8 : 12) L.push([x, ARC.R + hullOff(x, 1, 0) - 1.15, 0, HPI, 2.2, Math.PI]); npInst(g, 'ceiling-light', L, false);
    const W2 = []; for (let s = 5; s < WING.len - 3; s += 8) { const p = wingAt(s); W2.push([p.x - X, WING.C + WING.R + wingOff(s, HPI) - 1.15 - C, p.z - Z, Math.atan2(p.tx, p.tz), 1.8, Math.PI]); } npInst(g, 'ceiling-light', W2, false); }
  // a white panelled partition closes off the infirmary (open to the south, where the catwalk runs and the hallway leads in)
  const W2 = npW('wall-2');
  npPut(g, W2, -22, F, -4.35, HPI, 1, { shadow: false }); colL(-22, -10, -22, 1.2, .6);

  // ---- the infirmary (west end): a drop ceiling on pillars, four beds with blankets, lamps, carts, oxygen, medkits ----
  { const bed = npPiece('medbay-pack', n => n.startsWith('Enf_Camilla')), man = npPiece('medbay-pack', n => n.startsWith('Enf_Manta')), lamp = npPiece('medbay-pack', n => n.startsWith('Enf_Lamparas')),
      foco = npPiece('medbay-pack', n => n.startsWith('Enf_Foco')), pil = npPiece('medbay-pack', n => n.startsWith('Enf_Pilar')), cart = npPiece('medbay-pack', n => n.startsWith('Enf_Utensilios')),
      oxy = npPiece('medbay-pack', n => n.startsWith('Enf_Bombona')), chair = npPiece('medbay-pack', n => n.startsWith('Enf_Silla')), pak = npPiece('medbay-pack', n => n.startsWith('Enf_Medpak')),
      door = npPiece('medbay-pack', n => n.startsWith('Enf_Puerta'));
    // the blue tiled floor
    npPut(g, 'floor-tiles', -29, F + .012, -5, 0, [.9, 1, 1.3], { shadow: false });
    // beds, heads to the north wall, each with the blanket where the pack had it
    const BX = [-34, -31.3, -28.6, -25.9], bz = -9.2 + 1.21;
    bed.forEach((B, i) => npInst(g, B, BX.filter((_, k) => k % bed.length === i).map(x => [x, F, bz])));
    if (bed[0] && man.length) man.forEach((Mn, i) => { const B = bed[Math.min(i, bed.length - 1)], dx = Mn.ctr.x - B.ctr.x, dz = Mn.ctr.z - B.ctr.z, dy = Mn.base - B.base;
      npInst(g, Mn, BX.filter((_, k) => k % man.length === i).map(x => [x + dx, F + dy, bz + dz])); });
    for (const x of BX) colL(x, -9.3, x, -7.2, .6);
    // carts between the beds, a chair, oxygen bottles in the corner
    cart.forEach((P, i) => npInst(g, P, [[-32.65 + i * 5.4, F, -9.0, 0]]));
    if (chair[0]) npInst(g, chair[0], [[-27.2, F, -5.6, Math.PI + .3]]);
    oxy.forEach((P, i) => npInst(g, P, [[-35.1 + i * .5, F, -1.7 + (i % 2) * .4, nr(0, 6)]]));
    // the drop ceiling: grated plates on the pack's pillars, lamps and light panels hung under it
    const CY = 3.25;
    for (const x of [-33.3, -29, -24.7]) npPut(g, 'roof-panel', x, F + CY, -6.2, 0, [.95, .6, .95], { shadow: false });
    { const L = []; for (const x of [-35.4, -30.85, -26.95, -23.1]) for (const z of [-3.3]) L.push([x, F, z]); pil.forEach((P, i) => npInst(g, P, L.filter((_, k) => k % pil.length === i).map(a => [...a, 0, CY / P.size.y]))); for (const [x, , z] of L) col(x, z, .45); }
    if (foco[0]) npInst(g, foco[0], BX.map(x => [x, F + CY - .12, bz + .2]), false);
    lamp.forEach((P, i) => npInst(g, P, [[-32.65 + i * 5.4, F + CY - P.size.y, -7.4]], false));
    npInst(g, 'ceiling-light', [-33.3, -29, -24.7].map(x => [x, F + CY - .02, -4.6, HPI, 1.4, Math.PI]), false);
    // medkits: a wall pack on the north wall, red kits on the pillars, a case on each cart
    if (pak[0]) npInst(g, pak[0], [[-22.75, F + 1.3, -2, -HPI]]);
    npInst(g, 'medkit-small', [-35.4, -30.85, -26.95].map(x => [x + .45, F + 1.25, -3.3]));
    npInst(g, 'medkit-case', [[-32.65, F + .86, -9.0, .3], [-27.25, F + .86, -9.0, -.2]]);
    // the sealed hatch in the west bulkhead: the pack's door in its frame, a keypad beside it
    door.forEach(P => npInst(g, P, [[-ARC.LW + .35 + (P.ctr.z - door[0].ctr.z), F + (P.base - door[0].base), -1.6, HPI]]));
    npPut(g, 'keypad-panel', -ARC.LW + .2, F + 1.1, .3, HPI, .4, { shadow: false });
  }

  // ---- the bunk room: pods two high along the north wall, opening into the room ----
  { const L = []; for (let x = -20.6; x < -5.5; x += 2.1) for (const y of [F, F + 1.2]) L.push([x, y, -9.5, -HPI]);
    npInst(g, 'bed', lite ? L : L.filter((_, i) => i % 2 === 0), false); colL(-21.5, -9.4, -5.6, -9.4, .6);
    // lockers by the door (three to a unit), doors facing the room
    npInst(g, 'locker', [-2.66, -1.33, 0, 1.33, 2.66].map(x => [x, F, -9.55, -HPI]), false);
  }
  // ---- machinery round the core ----
  npInst(g, 'wall-4', [11.85, 13.28, 14.71, 16.14].map(x => [x, F, -9.6, -HPI]), false); colL(11, -9.5, 17, -9.5, .5);
  npInst(g, 'gas-bottle', [[17.6, F, -8.9], [17.7, F, -8.4, 1]], false);
  npInst(g, 'fuel-cell', [[9.6, F, -8.8], [10.3, F, -9.2, .7], [9.9, F, -8.1, 2]], false);

  // ---- the radio room: the far end of the east wing — screens on an end wall, the radio desk, racks down both sides ----
  { const E = WING.len, at = (sv, o, y = F) => { const p = wingAt(sv, o); return [p.x - X, y, p.z - Z]; }, t = wingAt(E - 4), back = Math.atan2(-t.tx, -t.tz), fwd = Math.atan2(t.tx, t.tz), toN = Math.atan2(-t.nx, -t.nz), fromN = Math.atan2(t.nx, t.nz);
    const cW = (s0, o0, s1, o1, r) => { const a = wingAt(s0, o0), b = wingAt(s1, o1); addColLine(a.x, a.z, b.x, b.z, r); };
    npPut(g, W2, ...at(E - .9, 0), back, 1, { shadow: false }); cW(E - .9, -5.6, E - .9, 5.6, .6);
    npInst(g, 'wall-screen', [-3.4, 0, 3.4].map(o => [...at(E - 1.5, o, F + 1.3), back]), false);
    npInst(g, 'computer-console', [-2.2, 0, 2.2].map(o => [...at(E - 4.4, o), back]), false); for (const o of [-2.2, 0, 2.2]) { const p = wingAt(E - 4.4, o); addCol(p.x, p.z, .8); }
    npInst(g, 'chairs-x4', [[...at(E - 8.2, 0), fwd]], false); cW(E - 8.2, -1.3, E - 8.2, 1.3, .4);
    npInst(g, 'server-rack', [0, 1, 2, 3].slice(0, lite ? 4 : 2).map(k => [...at(E - 9.6 + k * 1.3, 4.6), toN]), false); cW(E - 10.3, 4.6, E - 4.7, 4.6, .6);
    npInst(g, 'server-tower', [0, 1, 2, 3, 4, 5, 6, 7].map(k => [...at(E - 10.6 + k * .65, -4.6), fromN]), false); cW(E - 10.9, -4.6, E - 5.8, -4.6, .5);
    // the floor under the desk: modular tiles from the pack
    if (lite) { const T = npSplit('floor-modular', .05).filter(p => Math.abs(p.size.x - .8) < .05 && Math.abs(p.size.z - .8) < .05), by = T.map(() => []); let k = 0;
      for (let sv = E - 6.4; sv < E - 2.2; sv += .8) for (let o = -2.8; o < 3; o += .8) by[k++ % T.length].push([...at(sv, o, F + .005), back + (k % 4) * HPI]);
      T.forEach((P, i) => npInst(g, P, by[i], false)); }
    // the walkie-talkie rack: a table of handsets on charge (take one: you'll hear the other settlements on it)
    const wx = ARC_WALKIES.x - X, wz = ARC_WALKIES.z - Z, ty = shopKitTable(g, wx, F, wz, 1.6, .7);
    npInst(g, 'walkie-talkie', [-.55, -.2, .15, .5].map((dx, i) => [wx + dx, ty, wz + (i % 2) * .08, nr(-.2, .2)]), false);
    npInst(g, 'cinema-camera', [[wx + .5, ty, wz + .1, -.6, 1.6]], false); addCol(ARC_WALKIES.x, ARC_WALKIES.z, .8);
  }
  // the two passages (the station's own interior): the white hallway is the way into the infirmary, the dark corridor runs from
  // the core into the east wing — both set across the open strip south of the partitions, so you walk through them
  { const hy = H0 + .14;
    // the hallway's closed end gets its door cut out; the corridor loses the doors at both ends
    npPut(g, npOpened('hallway', null, new THREE.Box3(new THREE.Vector3(-.82, .26, -3.2), new THREE.Vector3(.82, 2.36, -2.5))), -22, F, 4.3, HPI, 1, { shadow: false }); colL(-24.9, 2.05, -19.1, 2.05, .25); colL(-24.9, 6.55, -19.1, 6.55, .25); addFloor(X - 22, Z + 4.3, 0, 2.9, 1.9, hy + .22);
    npPut(g, npOpened('corridor', /Doorway_door/), 18.6, F, 4.3, HPI, 1.35, { shadow: false });
    colL(13.2, 2.55, 24, 2.55, .3); colL(13.2, 6.05, 24, 6.05, .3); addFloor(X + 18.6, Z + 4.3, 0, 5.4, 1.4, hy + .42);
    for (const ex of [13.1, 24.1]) for (const dz of [-1.25, 1.25]) col(ex, 4.3 + dz, .45, 3);   // the end frames either side of the opening
    npInst(g, 'ceiling-light', [[16.2, F + 2.5, 4.3, HPI, 1, Math.PI], [21, F + 2.5, 4.3, HPI, 1, Math.PI]], false); }
  // white trim panels along the south wall, either side of the blast door, and a keypad by the door outside
  { const L = []; for (let x = -ARC.LW + 4; x < ARC.LE - 2; x += 2.6) if (Math.abs(x) > ARC.DOOR + 2) L.push([x, F, 9.55, Math.PI]); npInst(g, 'wall-c', L, false); }
  npPut(g, 'keypad-panel', ARC.DOOR + 1.9, 1.6 - C, Math.sqrt(ARC.R ** 2 - (1.6 - C + .5) ** 2) + .25, -.12, .45, { shadow: false });
  // room lights: cool over the radio desk, white in the infirmary, warm over the bunks (off whenever the interior isn't drawn,
  // so they never take a slot in the light pool from the yard)
  for (const [x, z, c, i] of [[ARC_RADIO.x - X, ARC_RADIO.z - Z, 0x9ad8ff, 2.2], [-29, -6, 0xf2f6ff, 2.4], [-13, -6, 0xffd8a8, 1.8]]) { const l = new THREE.PointLight(c, i, 22, 1.4); l.position.set(x, F + 3, z); l.userData.on = i; g.add(l); ARC_LIGHTS.push(l); }
  fitArc(g, F);                                       // (Nov 11) the main base rebuilt: decks, mezzanine, mess, armoury, command post
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  DECOR_ANIM.push(updArcInterior);
}
/* ================= (Nov 11) the main base, fitted out =================
   Bryce: the inside of the Arc "looks like shit" — one dark, empty tube. Now it's somewhere people live and hold out: deck plating
   laid over the floor a plate at a time (none of it quite square), a mezzanine of salvaged deck along the north wall on I-beams
   with a stair up from the mess, the mess itself (tables of hull plate, the station's seats), a sandbagged firing point inside the
   blast door, an armoury of lockers and racked rifles, a command post by the core (consoles, wall screens, the war table), racks
   of stores under the catwalk, cross beams with cable trays and Kestrel's colours hung off them, and lights you can see by.
   Built in one kit (merged per material, lit with the bounced-light materials), so it's a handful of draws. */
function fitArc(g, F) {
  const X = ARC.x, Z = ARC.z, K = shipKit(hkit(LOW)), lite = !LOW;
  const col = (x, z, r) => addCol(X + x, Z + z, r), colL = (x0, z0, x1, z1, r) => addColLine(X + x0, Z + z0, X + x1, Z + z1, r);
  const ny = (y) => Math.sqrt(Math.max(0, ARC.R * ARC.R - (y - ARC.C) ** 2));        // the hull's half-width at a height above the floor
  K.at(htm(0, F, 0));                                       // everything below in floor coordinates: y = 0 is the deck
  const plateC = [0x6e7274, 0x7a7e80, 0x666a6c, 0x84867e, 0x5e6264, 0x8a8478];
  // ---- deck plating: 2.4 m plates, each its own shade, a little off true; tread strips down the walkways ----
  for (let x = -21.6; x < ARC.LE - 1; x += 2.4) for (let z = -9.2; z < 8.6; z += 2.4) {
    if (x > 12.6 && z > 1.8 && z < 6.4) continue;                    // the corridor's own floor
    if (x < -18.6 && z > 1.8 && z < 6.8) continue;                   // the hallway
    K.box('hull', 2.36, .025, 2.36, x + 1.2 + hr(-.03, .03), .012, z + 1.2 + hr(-.03, .03), 0, hr(-.012, .012), 0, tint(hpick(plateC), .05), 2.4);
  }
  for (let z = -2.5; z < 9.8; z += .42) K.box('metal', 2.4, .02, .34, 0, .028, z, 0, hr(-.01, .01), 0, 0x7a7e80);          // tread from the door up the middle
  for (let k = 0; k < 18; k++) K.box('plain', .45, .006, .3, -4 + k * .47, .045, 9.2, 0, .5, 0, k % 2 ? 0x1e1e1e : 0xd9a32a);   // hazard band inside the blast door
  // path lights let into the deck: door → mess, door → command post
  for (let z = -1.6; z < 8.6; z += 1.4) for (const sx of [-1.35, 1.35]) K.box('glow', .22, .02, .06, sx, .045, z, 0, 0, 0, 0xffa848);
  for (let x = 2; x < 17; x += 1.6) K.box('glow', .22, .02, .06, x, .045, -.6, 0, HP, 0, 0x7ad0ff);

  // ---- the mezzanine: deck on I-beams along the north wall, x -22 → 10, 3.4 m up; a stair up from the mess ----
  const MY = 3.4, mz0 = -10.4, mz1 = -5, mx0 = -22, mx1 = 10;
  for (let x = mx0; x < mx1 - .01; x += 1.6) K.box('hull', 1.58, .12, mz1 - mz0, x + .8, MY - .06, (mz0 + mz1) / 2, 0, 0, hr(-.004, .004), tint(hpick(plateC), .05), 1.6);
  K.box('metal', mx1 - mx0, .3, .16, (mx0 + mx1) / 2, MY - .27, mz1, 0, 0, 0, 0xc8c6be);                                   // the edge beam, station white
  for (let x = mx0 + 1.2; x < mx1; x += 3.2) K.box('metal', .14, .24, mz1 - mz0, x, MY - .24, (mz0 + mz1) / 2, 0, 0, 0, 0x55585a);   // joists
  for (const x of [-19, -14, -9, -4, 1, 5.6, 9.6]) { K.box('metal', .26, MY - .3, .08, x, (MY - .3) / 2, mz1 - .07, 0, 0, 0, 0x55585a); K.box('metal', .08, MY - .3, .22, x, (MY - .3) / 2, mz1, 0, 0, 0, 0x55585a); K.box('metal', .26, MY - .3, .08, x, (MY - .3) / 2, mz1 + .07, 0, 0, 0, 0x55585a); col(x, mz1, .22); }
  // railing: posts, a mid rail, a yellow top rail (gap where the stair lands at the west end)
  for (let x = -19.4; x < mx1; x += 1.5) K.box('metal', .05, 1.05, .05, x, MY + .52, mz1 + .03, 0, 0, 0, 0x4a4c4e);
  K.box('metal', mx1 + 19.4, .05, .05, (mx1 - 19.4) / 2, MY + .55, mz1 + .03, 0, 0, 0, 0x4a4c4e); K.box('plain', mx1 + 19.4, .07, .07, (mx1 - 19.4) / 2, MY + 1.05, mz1 + .03, 0, 0, 0, 0xd9a32a);
  for (let x = mx1 - .05, k = 0; k < 1; k++) { K.box('metal', .05, 1.05, mz1 - mz0, x, MY + .52, (mz0 + mz1) / 2, 0, 0, 0, 0x4a4c4e); }
  // the landing at the stair head, west end
  K.box('hull', 2.6, .12, 2.7, -20.7, MY - .06, -3.75, 0, 0, 0, 0x6e7274, 1.6);
  addFloor(X + (mx0 + mx1) / 2, Z + (mz0 + mz1) / 2, 0, (mx1 - mx0) / 2, (mz1 - mz0) / 2, H0 + ARC.C + F + MY);
  addFloor(X - 20.7, Z - 3.75, 0, 1.3, 1.35, H0 + ARC.C + F + MY);
  // the stair: treads on two stringers, rising west from the mess
  { const x0 = -12, x1 = -19.4, zc = -3.5, hw = 1.05, n = 16, L = x0 - x1;
    for (let i = 0; i < n; i++) K.box('metal', L / n + .03, .05, hw * 2, x0 - (i + .5) * L / n, (i + 1) * MY / n, zc, 0, 0, 0, i % 4 === 0 ? 0xd9a32a : 0x5a5e60);
    for (const sz of [-hw, hw]) K.box('metal', Math.hypot(L, MY), .26, .08, (x0 + x1) / 2, MY / 2 - .1, zc + sz, 0, 0, -Math.atan2(MY, L), 0x3a3c3e);
    for (const sz of [-hw - .05, hw + .05]) { K.box('plain', Math.hypot(L, MY), .06, .06, (x0 + x1) / 2, MY / 2 + 1, zc + sz, 0, 0, -Math.atan2(MY, L), 0xd9a32a); for (let i = 1; i < 5; i++) K.box('metal', .04, 1, .04, x0 - i * L / 5, i * MY / 5 + .5, zc + sz, 0, 0, 0, 0x4a4c4e); }
    FLOORS.push({ cx: X + (x0 + x1) / 2, cz: Z + zc, c: 1, s: 0, hw: L / 2, hd: hw, y: H0 + ARC.C + F + MY / 2, slope: -MY / L });
    colL(-12.6, zc + hw + .32, -19.4, zc + hw + .32, .22); colL(-14.2, zc - hw - .32, -19.2, zc - hw - .32, .22); }
  // up top: bedrolls and kit for the night watch, crates, a lookout desk with a radio set, a lamp
  for (let i = 0; i < 5; i++) { const x = -16 + i * 2.6; K.box('cloth', .8, .12, 1.9, x, MY + .06, -8.1, 0, hr(-.15, .15), 0, tint(hpick(CLOTHC))); K.box('cloth', .45, .12, .3, x, MY + .14, -8.9, 0, 0, 0, 0xd8d4c8); if (hp(.6)) sack(K, x + .5, MY, -7.2, .7); }
  for (let i = 0; i < 4; i++) crate(K, 2 + i * .7, MY, -9.4 + (i % 2) * .5, hr(-.2, .2), 1, 0x5a6a4a);
  K.box('metal', 1.6, .06, .7, 7.6, MY + .8, -8.4, 0, 0, 0, 0x5a5e60); for (const [dx, dz] of [[-.7, -.3], [.7, -.3], [-.7, .3], [.7, .3]]) K.box('metal', .05, .8, .05, 7.6 + dx, MY + .4, -8.4 + dz, 0, 0, 0, 0x3a3c3e);
  K.box('metal', .5, .3, .3, 7.3, MY + .98, -8.5, 0, .2, 0, 0x3a4a3a); K.box('glow', .2, .06, .01, 7.3, MY + 1.02, -8.34, 0, .2, 0, 0x8aff7a);

  // ---- the mess: two long tables of hull plate on I-beam trestles, the station's seats either side ----
  { const T = [-16.2, -11]; for (const tx of T) { K.box('hull', 3, .07, 1, tx, .78, 1.4, 0, hr(-.02, .02), 0, tint(0xc4c2ba, .05), 1.5);
      for (const ex of [-1.2, 1.2]) { K.box('metal', .08, .75, .7, tx + ex, .38, 1.4, 0, 0, 0, 0x3a3c3e); K.box('metal', .1, .06, .9, tx + ex, .04, 1.4, 0, 0, 0, 0x3a3c3e); }
      for (let k = 0; k < 5; k++) { K.cyl('plain', .13, .13, .02, 10, tx + hr(-1.3, 1.3), .82, 1.4 + hr(-.3, .3), 0, 0, 0, 0xa8a49a); if (hp(.5)) K.cyl('metal', .045, .04, .12, 8, tx + hr(-1.3, 1.3), .87, 1.4 + hr(-.3, .3), 0, 0, 0, hpick([0x6a7a8a, 0x8a5a3a])); }
      colL(tx - 1.4, 1.4, tx + 1.4, 1.4, .55); }
    npInst(g, 'chairs-x4', T.flatMap(tx => [[tx, F, 2.35, Math.PI, 1], [tx, F, .45, 0, 1]]), false);
    for (const tx of T) { colL(tx - 1.3, 2.4, tx + 1.3, 2.4, .32); colL(tx - 1.3, .4, tx + 1.3, .4, .32); }
    // the galley against the mezzanine: the kitchen props on a steel counter, a water drum, a ration board
    K.box('metal', 3.6, .9, .7, -15, .45, -4.2 + .05, 0, 0, 0, 0x6a6e70); K.box('shiny', 3.7, .05, .75, -15, .92, -4.15, 0, 0, 0, 0x9a9e9e);
    hput(g, hpart('props/kitchen', n => /Cylinder\.00[2-6]_|^Vert_kitchen|Cube\.002_/.test(n), .55, 'x'), -16.2, F + .95, -4.2);
    hput(g, hpart('props/kitchen', n => /Cylinder\.00[78]_|Vert\.002_/.test(n), .3, 'y'), -14.6, F + .95, -4.2, .6);
    barrel(K, -12.8, 0, -4.3, 0x3a5a7a); K.poster(0, .55, .7, -13.9, 1.8, -4.53, 0); colL(-16.8, -4.15, -12.6, -4.15, .45); }

  // ---- inside the blast door: a sandbagged firing point either side of the way in, a rack of spare rifles ----
  for (const sd of [-1, 1]) { for (let i = 0; i < 4; i++) for (let r = 0; r < 3; r++) { const sg = new THREE.BoxGeometry(.75, .26, .42); K.geo('cloth', sg, htm(sd * (2.2 + i * .62 + (r % 2) * .3), .14 + r * .26, 5.6 + Math.sin(i * .7) * .25, 0, hr(-.08, .08), 0), tint(0x5a5242)); } colL(sd * 2, 5.6, sd * 4.6, 5.8, .4); }
  { const rx = -6.4, rz = 8.6; K.box('metal', 2.4, .08, .3, rx, .5, rz, 0, 0, 0, 0x3a3c3e); K.box('metal', 2.4, .06, .14, rx, 1.6, rz + .08, 0, 0, 0, 0x3a3c3e);
    ['gun-night', 'gun-desert', 'gun-night', 'gun-desert'].forEach((r, i) => { const m = hmodel(r, .95, 'z'); if (!m) return; m.rotation.set(-HP + .12, 0, 0); m.position.set(rx - .9 + i * .6, F + 1.05, rz - .05); g.add(m); }); col(rx, rz, .5); }

  // ---- the armoury, under the mezzanine east of the lockers: racked rifles, ammo crates, a bench ----
  { const ax = 6.6; K.box('metal', 4.6, .08, .26, ax, 1.02, -9.55, 0, 0, 0, 0x3a3c3e); K.box('metal', 4.6, .06, .14, ax, 2.2, -9.65, 0, 0, 0, 0x3a3c3e);
    ['gun-night', 'sniper', 'gun-desert', 'gun-night', 'gun-desert', 'sniper'].forEach((r, i) => { const m = hmodel(r, .95, r === 'sniper' ? 'x' : 'z'); if (!m) return; m.rotation.set(-HP + .12, r === 'sniper' ? -HP : 0, 0); m.position.set(ax - 2 + i * .8, F + 1.6, -9.5); g.add(m); });
    for (let i = 0; i < 5; i++) { const m = modelCopy('ammo-crate', .4); if (!m) break; m.position.set(ax - 2 + i * .9, F + (i % 2) * .4, -7.4 + (i % 3) * .3); m.rotation.y = hr(-.3, .3); g.add(m); }
    K.box('metal', 2, .06, .8, ax + .4, .92, -6.1, 0, 0, 0, 0x5a5e60); K.box('metal', 1.9, .86, .7, ax + .4, .45, -6.1, 0, 0, 0, 0x3a3e40); colL(ax - .6, -6.1, ax + 1.4, -6.1, .45);
    npInst(g, 'walkie-talkie', [[ax - .1, F + .95, -6.1, .3, 1, -HPI], [ax + .2, F + .95, -6.0, -.2, 1, -HPI]], false); }

  // ---- the command post, east of the core: consoles facing the wall screens, the war table ----
  { npInst(g, 'wall-screen', [[18.7, F + 2.1, -9.85, 0, .9], [21.6, F + 2.3, -9.7, 0, .8]], false);
    npInst(g, 'computer-console', [[18.6, F, -7.2, 0, .85], [21.4, F, -7.1, -.06, .85]], false); col(18.6, -7.2, .8); col(21.4, -7.1, .8);
    npInst(g, 'chairs-x4', [[20, F, -4.7, Math.PI, .8]], false); colL(19, -4.7, 21, -4.7, .3);
    npInst(g, 'server-tower', [0, 1, 2].map(k => [23 - k * .2, F, -8.6 + k * .66, -HPI]), false); colL(23, -9, 22.6, -7, .4);
    // the war table: a plate on trestles with Kestrel's map, markers and a lamp
    const tx = 7.4, tz = -1.6; K.box('hull', 2.6, .07, 1.6, tx, .9, tz, 0, .08, 0, 0x7a7e80, 2); for (const [dx, dz] of [[-1.1, -.6], [1.1, -.6], [-1.1, .6], [1.1, .6]]) K.box('metal', .07, .88, .07, tx + dx, .44, tz + dz, 0, .08, 0, 0x3a3c3e);
    { const pg = new THREE.PlaneGeometry(1.5, 1.1), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, .5 + uv.getX(i) / 4, uv.getY(i) / 2); K.geo('paper', pg, htm(tx, .94, tz, -HP, .08, 0), 0xffffff); }
    for (let i = 0; i < 7; i++) K.cyl('plain', .03, .03, .08, 6, tx + hr(-.6, .6), .98, tz + hr(-.45, .45), 0, 0, 0, hpick([0xc0392b, 0x2e86c1, 0xd9a32a]));
    colL(tx - 1.2, tz, tx + 1.2, tz, .75); }

  // ---- stores under the catwalk: steel racks of crates, drums and sacks along the south wall ----
  for (const [x0, x1] of [[-9.6, -5.8], [6, 12.4], [14, 21.6]]) { const n = Math.floor((x1 - x0) / 2.1);
    for (let k = 0; k < n; k++) { const rx = x0 + 1.05 + k * 2.1, rz = 8.6;
      for (const y of [.05, .9, 1.75]) K.box('metal', 2, .05, .75, rx, y, rz, 0, 0, 0, 0x4a4c4e); for (const ex of [-1, 1]) K.box('metal', .06, 2.5, .75, rx + ex, 1.25, rz, 0, 0, 0, 0x3a3c3e);
      for (const y of [.1, .95, 1.8]) for (let j = 0; j < 3; j++) { const r = hrnd(); if (r < .4) crate(K, rx - .62 + j * .62, y, rz, hr(-.1, .1), .85); else if (r < .7) sack(K, rx - .62 + j * .62, y, rz, .75); else if (r < .9) barrel(K, rx - .62 + j * .62, y, rz, hpick([0x3a5a7a, 0x8a2a22, 0x4a5a3a]), .7); } }
    colL(x0, 8.6, x1, 8.6, .5); }
  npInst(g, 'fuel-cell', [[12.8, F, 7.6], [13.4, F, 7.9, 1]], false);

  // ---- overhead: cross beams spanning the hull, cable trays, Kestrel's colours hung from them, lamps on chains ----
  const BY = 10.6, bw = ny(BY) - .3;
  for (const x of [-20, -8.6, 2.4, 13.6]) { K.box('metal', .26, .34, bw * 2, x, BY, 0, 0, 0, 0, 0xc8c6be); K.box('metal', .3, .06, bw * 2, x, BY + .19, 0, 0, 0, 0, 0x8a8c8a); K.box('metal', .3, .06, bw * 2, x, BY - .19, 0, 0, 0, 0, 0x8a8c8a);
    // a lamp hung from each, and a banner on two of them
    K.cyl('metal', .006, .006, 3.2, 3, x, BY - 1.8, -1, 0, 0, 0, 0x2a2a28); K.cyl('metal', .35, .2, .25, 10, x, BY - 3.5, -1, 0, 0, 0, 0x3a3c3e); K.cyl('glow', .3, .3, .02, 10, x, BY - 3.63, -1, 0, 0, 0, 0xfff0d0);
    if (x === -8.6 || x === 13.6) { const bg = new THREE.PlaneGeometry(1.6, 3.2, 2, 4); const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getY(i) * 2) * .06); bg.computeVertexNormals(); K.geo('cloth', bg, htm(x + .2, BY - 1.8, 3, 0, HP, 0), 0xf0a640); K.box('cloth', .02, .3, 1.6, x + .21, BY - 1.2, 3, 0, 0, 0, 0x2a2a28); } }
  for (const sz of [-1, 1]) { const y = 6.2, z = sz * (ny(y) - .45); K.box('metal', ARC.LW + ARC.LE - 4, .08, .4, (ARC.LE - ARC.LW) / 2, y, z, 0, 0, 0, 0x4a4c4e); for (let k = 0; k < 3; k++) K.cyl('plain', .03, .03, ARC.LW + ARC.LE - 4.5, 5, (ARC.LE - ARC.LW) / 2, y + .08, z + (k - 1) * .1, 0, 0, HP, hpick([0x1e1e1e, 0x8a2a22, 0x2a4a6a])); }
  // cables sagging from the trays down to the consoles and the galley
  wireBetween(K, new THREE.Vector3(19, 6.2, -ny(6.2) + .45), new THREE.Vector3(19.5, 1.3, -8.4), .3, 0x1e1e1e, .02);
  wireBetween(K, new THREE.Vector3(-14, 6.2, -ny(6.2) + .45), new THREE.Vector3(-14.5, 1.2, -4.4), .3, 0x1e1e1e, .02);
  // the inside of the south wall either side of the door: lining panels, a stencil, a fire point
  for (let x = -ARC.LW + 3; x < ARC.LE - 1.5; x += 2.2) if (Math.abs(x) > ARC.DOOR + 1.6) { K.box('hull', 2.15, 2.6, .05, x, 1.4, 9.35, 0, Math.PI, hr(-.006, .006), tint(hpick([0xc4c2ba, 0xb4b2aa, 0xa8b4b0]), .04), 2); }
  stencil(K, 0, 1.6, .8, -8, 2.2, 9.3, Math.PI); stencil(K, 3, 1.4, .6, ARC.DOOR + 1.3, 2.9, 9.3, Math.PI); stencil(K, 3, 1.4, .6, -ARC.DOOR - 1.3, 2.9, 9.3, Math.PI);
  K.box('plain', .3, .5, .2, 9, 1.4, 9.2, 0, 0, 0, 0xb8392e);
  K.at(null);
  K.build(g, false, true);
  // room lights: the mess, the command post, the mezzanine (off whenever the interior isn't drawn)
  for (const [x, y, z, c, i, r] of [[-13, 5, 1, 0xffd8a8, 2.4, 26], [20.5, 3.2, -5.5, 0x9ad8ff, 1.8, 16], [0, 3, 6, 0xffe0b8, 1.6, 18], [-6, 6.4, -7.6, 0xffd0a0, 1.2, 16]]) {
    const l = new THREE.PointLight(c, i, r, 1.4); l.position.set(x, F + y, z); l.userData.on = i; g.add(l); ARC_LIGHTS.push(l); }
}
// a plain metal table (drawn), returns its top height
function shopKitTable(g, x, y, z, w, d) {
  const m = S(0x5a5e60, { metalness: .5, roughness: .5 }); mesh(new THREE.BoxGeometry(w, .06, d), m, x, y + .82, z, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(.05, .8, .05), M(0x3a3c3e), x + sx * (w / 2 - .06), y + .4, z + sz * (d / 2 - .06), g);
  return y + .85;
}
// the interior only draws when the camera is inside the hull or looking in through the open blast door
function updArcInterior() {
  if (!arcInside) return; const cx = camera.position.x - ARC.x, cz = camera.position.z - ARC.z;
  arcInside.visible = inHull(camera.position.x, camera.position.z) || (cz > ARC.W - 1 && cz < ARC.W + 32 &&Math.abs(cx) < 12 + (cz - ARC.W) * 1.1 && hullDoor.t > .05);
  for (const l of ARC_LIGHTS) l.intensity = arcInside.visible ? l.userData.on : 0;
}

/* ================= the dropsite: a broken-off station section in the dirt ================= */
function dressDropsite(D, toCamp, inWreck) {
  if (!npHas('hallway')) return;
  const ax = Math.cos(toCamp), az = Math.sin(toCamp), yaw = -toCamp, W = (al, sd) => [D.x + ax * al - az * sd, D.z + az * al + ax * sd];
  const root = farGroup(D.x, D.z, -150);                        // draws within ~330 m: the hull stays the landmark from Kestrel
  // a chunk of the section: a group in the dropsite frame (x = along the furrow, z = across), on the ground at its centre
  const chunk = (al, sd, rot = 0, floor = 0, tilt = 0) => { const [x, z] = W(al, sd), c = new THREE.Group(); c.position.set(x, heightAt(x, z) - floor + .03, z); c.rotation.set(0, yaw + rot, tilt); root.add(c); return { c, x, z, yaw: yaw + rot }; };
  const wall = (K, x0, x1, z, r = .3) => { const [a, b] = npL2W(K.x, K.z, K.yaw, x0, z), [c, d] = npL2W(K.x, K.z, K.yaw, x1, z); addColLine(a, b, c, d, r); };
  const SD = 18;                                                 // the section lies along the furrow, off the hull's south side

  // the section: wall-b hull segments in mirrored pairs (windows both sides), broken into three pieces along the furrow
  const WB = npW('wall-b');
  const bay = (al, n, rot, tilt, sink = .2) => { const K = chunk(al, SD, rot, sink, tilt), h = n * 4.49 / 2;
    for (let i = 0; i < n; i++) { const x = -h + 2.245 + i * 4.49; npPut(K.c, WB, x, 0, 1.2, 0); npPut(K.c, WB, x, 0, -1.2, Math.PI); }
    wall(K, -h + .2, h - .2, 2.3); wall(K, -h + .2, h - .2, -2.3); return K; };
  // the forward bay: the seats still bolted to the floor
  { const K = bay(5.2, 3, .1, .02);
    npInst(K.c, 'chairs-x4', [[-4.3, .2, 1.55, Math.PI], [-.6, .2, 1.55, Math.PI], ...(LOW ? [] : [[-2.2, .2, -1.55, 0]])]);
    npInst(K.c, 'medkit-small', [[2.4, 1.2, 2.25, HPI + Math.PI]]);
    npInst(K.c, 'bed', [[7.6, .05, .6, .2, 1, 0, -1.25]]); }                     // a bunk pod tipped out of the torn end
  // the crew bay: bunks along both walls
  const H = bay(-6.4, 2, -.08, -.03);
  npInst(H.c, 'bed', [[-2.3, .2, 1.72, HPI], [-2.3, .2, -1.72, -HPI], [2.1, .2, 1.72, HPI]]);
  // the last piece, sunk at one end where it ploughed in
  const R = bay(-16.4, 2, .06, .05, .45);
  npInst(R.c, 'ceiling-light', [[-2.2, 3.35, 0, HPI, 1, Math.PI], [2.2, 3.35, 0, HPI, 1, Math.PI]], false);
  // lootable lockers: one in the crew bay, one in the sunk piece, and the section locker by the hull keeps its starter kit
  { const p = npL2W(H.x, H.z, H.yaw, 2.1, -1.75); npCache(root, 'locker', 1.73, p[0], p[1], H.yaw - HPI, 'arc', { id: 'drop_locker2', name: 'Arc crew locker', rolls: 2, refill: 4, front: 0 }); }
  { const p = npL2W(R.x, R.z, R.yaw, 1.2, 1.75); npCache(root, 'locker', 1.73, p[0], p[1], R.yaw + HPI, 'arc', { id: 'drop_locker3', name: 'Arc crew locker', rolls: 2, refill: 4, front: 0 }); }
  // fuel cells and medkits spilled round it (two of the med cases still have something in them)
  { const L = [], M2 = [], S2 = [];
    for (let i = 0; i < 12; i++) { const al = nr(-26, 14), sd = SD + (nrnd() < .5 ? -1 : 1) * nr(3.4, 9); const [x, z] = W(al, sd); if (inWreck(x, z)) continue;
      const tip = nrnd() < .5; (i % 3 === 0 ? M2 : i % 3 === 1 ? L : S2).push([x, heightAt(x, z) + (tip ? .3 : 0), z, nr(0, 6.3), 1, tip ? HPI : 0, 0]); }
    npInst(root, 'fuel-cell', L); npInst(root, 'medkit-small', S2.map(a => [a[0], heightAt(a[0], a[2]) + .1, a[2], a[3], 1, 0, HPI]));
    npInst(root, 'medkit-case', M2.slice(2));
    M2.slice(0, 2).forEach((a, i) => npCache(root, 'medkit-case', .18, a[0], a[2], a[3], 'arc', { id: 'drop_med' + i, name: 'Arc med case', rolls: 1, keys: ['bandage'], refill: 5 })); }
  // a triage spot: a stretcher from the medbay pack, oxygen, a cart, where someone patched people up after the landing
  { const bed = npPiece('medbay-pack', n => n.startsWith('Enf_Camilla')), oxy = npPiece('medbay-pack', n => n.startsWith('Enf_Bombona')), cart = npPiece('medbay-pack', n => n.startsWith('Enf_Utensilios'));
    const [x, z] = W(-3, SD + 6.5), y = heightAt(x, z);
    if (bed[0]) npInst(root, bed[0], [[x, y, z, yaw + .4]]); if (oxy[0]) npInst(root, oxy[0], [[x + 1.4, y, z - .6, .5]]); if (cart[0]) npInst(root, cart[0], [[x - 1.2, y, z + .9, yaw - .3]]); addCol(x, z, 1.2, 1.2); }
  // keypad beside the sealed airlock at the hull's far end
  { const [x, z] = W(11.6, 2.8); npPut(root, 'keypad-panel', x, heightAt(x, z) + 1.2, z, yaw + HPI, .45, { shadow: false }); }
  // thrown along the furrow: deck sections, grating, dark plates, a catwalk wrenched loose
  { const FS = npSplit('floor-section', .05), FB = npSplit('floor-section-b', .05);
    const deck = (P, al, sd, s, ry, rx, rz, sink) => { const [x, z] = W(al, sd); npInst(root, P, [[x, heightAt(x, z) - sink, z, yaw + ry, s, rx, rz]]); addCol(x, z, Math.min(P.size.x, P.size.z) * s * .35, 1.2); };
    if (FS[0]) deck(FS[0], -36, -6, .45, .4, .12, -.1, .25);
    if (FS[1]) deck(FS[1], -44, 7, .5, -.3, -.15, .2, .2);
    if (FB[0]) deck(FB[0], -31, 11, .7, 1.2, .08, .35, .4);
    if (FB[1]) deck(FB[1], -2, -6.9, .8, -.2, .9, 0, .2);
    { const L = []; for (const [al, sd, r] of [[-22, -7, .5], [-40, -2, 2.1], [-12, 12.5, 1.1], [-48, 12, .3]]) { const [x, z] = W(al, sd); L.push([x, heightAt(x, z) + .1, z, yaw + r, .8, nr(-.3, .3), nr(-.2, .2)]); } npInst(root, 'wall-3', L); }
    { const [x, z] = W(-1, SD - 5.6); npPut(root, 'catwalk-bridge', x, heightAt(x, z) + .5, z, yaw + .25, 1, { rz: .14, rx: -.08 }); addCol(x, z, 1.3, 1.2); } }
  // the cargo-bay floor, ripped out whole and lying flat: level ground to build a camp on
  { const [x, z] = W(10, -22); npPut(root, 'floor-panel', x, heightAt(x, z) + .02, z, yaw, 1, { shadow: false });
    // the floor material's rusty plating, under the crew bay where it came to rest
    const FM = npW('floor-material'); if (FM) { const p = FM.parts[0], mat = p.mat.clone(); if (mat.map) { mat.map = mat.map.clone(); mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; mat.map.repeat.set(3, 2); mat.map.needsUpdate = true; }
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), mat); pl.rotation.set(-HPI, 0, yaw); const [px, pz] = W(-6.4, SD + .6); pl.position.set(px, heightAt(px, pz) + .04, pz); pl.receiveShadow = true; root.add(pl); } }
  // a roof plate propped on two poles over the fire ring: somewhere dry to start
  { const [x, z] = W(-16, -9.6); npPut(root, 'roof-panel', x, heightAt(x, z) + 1.7, z, yaw + .3, [.8, 1, .55], { rx: .45 });
    for (const s of [-1.5, 1.5]) { const [px, pz] = npL2W(x, z, yaw + .3, s, -1.1); mesh(new THREE.CylinderGeometry(.06, .07, 2.4, 6), M(0x5a4a3a), px, heightAt(px, pz) + 1.1, pz, root); } }
}

/* ================= Kestrel ================= */
// a wood stove in every building, with its flue up through the roof
const STOVE_AT = { craft: [4.75, -2.5], trade: [4.75, -2.6], med: [6.25, -2.7], wear: [4.75, -2.6], guns: [4.75, -2.5], cook: [4.75, -2.3], salvage: [4.75, -2.4], bunk: [3.6, 2, 0] };
function dressShop(D, K, inner, Hs) {
  const id = D.id, st = STOVE_AT[id];
  if (st && npHas('wood-stove')) {
    const ry = st[2] ?? -HPI, fx = st[0] + Math.sin(ry) * -.18, fz = st[1] + Math.cos(ry) * -.18;      // the flue sits 18 cm behind the firebox
    npPut(inner, 'wood-stove', st[0], 0, st[1], ry); stovepipe(K, fx, 2.05, fz, Hs.HT - .35);
    const w = shopL2W(D, st[0], st[1]); addCol(w.x, w.z, .5, 2);
  }
  const BW = D.bw, sx = -3.9, sz = 1.2;
  if (id === 'craft') npInst(inner, 'gas-bottle', [[-BW / 2 + .5, 0, 3.3], [-BW / 2 + .85, 0, 3.6, 1], [-BW / 2 + .45, 0, 2.85, 2.2]]);
  if (id === 'salvage') { npInst(inner, 'gas-bottle', [[-BW / 2 + .5, 0, 2.6], [-BW / 2 + .5, 0, 3.05, .8]]); npInst(inner, 'fuel-cell', [[2.2, 0, 3.1], [2.9, 0, 3.4, .9]]);
    npPut(inner, 'cinema-camera', sx + .3, .99, sz + .2, .5, 1.5); npPut(inner, 'walkie-talkie', sx - .2, 1.02, sz + .3, 1.3, 1, { rx: -HPI }); }
  if (id === 'guns') npPut(inner, 'walkie-talkie', sx + 6.3, 1.02, -1.4, .4, 1, { rx: -HPI });
  if (id === 'med') { npInst(inner, 'medkit-small', [[-BW / 2 + .07, 1.35, .6], [-BW / 2 + .07, 1.35, -.2]]); npPut(inner, 'medkit-case', sx + .25, .98, sz - .05, .1); }
}
// the power yard: the fuel tank beside the genset, gas bottles by the fence
function dressYard(g) {
  if (!npHas('fuel-tank')) return;
  npPut(g, 'fuel-tank', 20.6, 0, -11.9, HPI); addColLine(16.9, -11.9, 24.3, -11.9, 1.1);
  npInst(g, 'gas-bottle', [[15.9, 0, -9.9], [16.35, 0, -9.65, 1.2], [16.15, 0, -10.35, 2.5]]); addCol(16.1, -10, .6, 2);
}

/* ================= Cinder City: the park and the ruins in the streets ================= */
function dressCity(fSite, fW, fry) {
  if (!npHas('park-arch')) return;
  const P = envSite('park');
  if (P) { const g = farGroup(P.x, P.z, 60), A = npW('park-arch'), s = 1.6, ry = .35;
    // the arch (its flat base plane left out), standing on the lowest ground under it so it never floats
    npPut(g, A, P.x, envFloor(P.x, P.z, A.size.x * s, 2.5 * s, ry) - .3, P.z, ry, s, { skip: p => { p.geo.computeBoundingBox(); return p.geo.boundingBox.max.y - p.geo.boundingBox.min.y < .05; } });
    npStoneCols('park-arch', P.x, P.z, ry, s, 12);
    // the statues facing it and a broken ring of pillars round the old lawn
    const st = []; for (const sd of [-1, 1]) { const [x, z] = npL2W(P.x, P.z, ry, sd * 9, 14); st.push([x, heightAt(x, z) - .2, z, ry + Math.PI + sd * .3, 1]); addCol(x, z, 1.7, 9); } npInst(g, 'statue', st);
    const pil = []; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + nr(-.08, .08), r = 22 + nr(-1, 1), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (nrnd() < .2) continue;
      const fall = nrnd() < .25, y = heightAt(x, z); pil.push(fall ? [x, y + .55, z, nr(0, 6.3), 1, HPI, 0] : [x, y - .1, z, nr(0, 6.3), nr(.7, 1.15), nr(-.06, .06), nr(-.06, .06)]); if (!fall) addCol(x, z, .7, 5); }
    npInst(g, 'stone-pillar', pil);
    { const C = whole('e/conifer') ? 'e/conifer' : null; if (C) { const L = []; for (let i = 0; i < 9; i++) { const a = nr(0, 6.3), r = nr(26, 29), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; L.push(envM(x, heightAt(x, z) - .3, z, nr(0, 6), nr(.8, 1.2))); addCol(x, z, .4); } instParts(g, whole(C).parts, L); } }
    cache(g, P.x + 4, P.z - 6, ry, 'pry', 'city', { id: 'c_park', name: 'Park keeper’s strongbox', rolls: 2, refill: 3 });
  }
  // ruins through the streets: statues on the crossroads, pillars along the kerbs (stood, leaning or fallen)
  { const root = farGroup(CITY.x, CITY.z, CITY.R), st = [], pil = [], BLK = 44, N = Math.ceil(CITY.R / BLK);
    const ok = (x, z, pad) => Math.hypot(x - CITY.x, z - CITY.z) < CITY.R - 40 && Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) > FOUNDRY.R + 15 && !envKeepClear(x, z, pad) && pathDist(x, z) > 7;
    for (let gx = -N; gx < N; gx++) for (let gz = -N; gz < N; gz++) { const x = CITY.x + (gx + .5) * BLK, z = CITY.z + (gz + .5) * BLK;
      if (!ok(x, z, 10)) continue; const r = nrnd();
      if (r < .1) { st.push([x, heightAt(x, z) - .2, z, nr(0, 6.3), nr(.8, 1)]); addCol(x, z, 1.6, 8); }
      else if (r < .45) for (let k = 0; k < 3; k++) { const px = x + nr(-6, 6), pz = z + nr(-6, 6), y = heightAt(px, pz), fall = nrnd() < .4;
        pil.push(fall ? [px, y + .5, pz, nr(0, 6.3), nr(.8, 1), HPI, 0] : [px, y - .2, pz, nr(0, 6.3), nr(.5, 1.1), nr(-.12, .12), nr(-.12, .12)]); if (!fall) addCol(px, pz, .6, 4); } }
    npInst(root, 'statue', st); npInst(root, 'stone-pillar', pil); }
  // the old factory's fuel tanks
  if (fSite && fW) { const g = farGroup(fSite.x, fSite.z, 40), L = [];
    for (const [lx, lz] of [[fW.size.x / 2 + 4, -4], [fW.size.x / 2 + 4, 4]]) { const [x, z] = npL2W(fSite.x, fSite.z, fry, lx, lz); if (Math.hypot(x - fSite.x, z - fSite.z) < fSite.r + 14) { L.push([x, heightAt(x, z) - .1, z, fry]); addColLine(...npL2W(x, z, fry, 0, -3.7), ...npL2W(x, z, fry, 0, 3.7), 1.1); } }
    npInst(g, 'fuel-tank', L); }
}

/* ================= the Old Arches: a ruin on the hill north of Kestrel ================= */
function buildArches() {
  const A = POI.arches, W = npW('stone-arch-ruins'); if (!W) return;
  const g = farGroup(A.x, A.z, 900), s = 2.4, ry = .5;            // big enough to read from the yard; drawn out to ~1.4 km
  npPut(g, W, A.x, envFloor(A.x, A.z, W.size.x * s, W.size.z * s * .5, ry) - .25, A.z, ry, s);
  npStoneCols('stone-arch-ruins', A.x, A.z, ry, s, 10);
  const pil = []; for (let i = 0; i < 10; i++) { const a = nr(0, 6.3), r = nr(23, 30), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r, y = heightAt(x, z), fall = nrnd() < .4;
    pil.push(fall ? [x, y + .5, z, nr(0, 6.3), 1, HPI, 0] : [x, y - .2, z, nr(0, 6.3), nr(.6, 1.2), nr(-.1, .1), nr(-.1, .1)]); if (!fall) addCol(x, z, .7, 5); }
  npInst(g, 'stone-pillar', pil);
  { const [x, z] = npL2W(A.x, A.z, ry, 2, 11); npInst(g, 'statue', [[x, heightAt(x, z) - .2, z, ry + Math.PI, .8]]); addCol(x, z, 1.4, 8); }
  // what's under them: a sealed stone chest in the middle arch, a buried crate further back
  { const [x, z] = npL2W(A.x, A.z, ry, -1.5, 2.2); cache(g, x, z, ry, 'pry', 'ruin', { id: 'arches_chest', name: 'Stone chest under the arches', big: 1, rolls: 3, refill: 5 }); }
  { const [x, z] = npL2W(A.x, A.z, ry, 11, -7); cache(g, x, z, ry + 1, 'none', 'ruin', { id: 'arches_cache', name: 'Half-buried crate', rolls: 1, refill: 3 }); }
}

/* ================= (Nov 11) the underground places, furnished from the same props =================
   The Mountain's quarters, mess, clinic, checkpoint, office, armory and reactor hall; Hesper's mess and dorm; the Brightwater
   lab and archive. Props face the way they do elsewhere: lockers and bunks open to +x, screens, consoles and seats to +z, at yaw 0. */
function dressPockets() {
  const put = (pk, name, h, lx, lz, ry = 0, y = 0) => { const [x, z] = pw(pk, lx, lz); return xModel(pk.g, 'props/' + name, h, x, pk.y + y, z, ry); };
  const M = POCKETS.mtn;
  if (M) {
    for (let i = 0; i < 6; i++) { put(M, 'locker', 1.73, -19.3, 17.2 + i * 1.4, Math.PI); } xSolid(M, -19.8, 16.4, -18.5, 25.4);                      // quarters: lockers down the east wall
    for (const z of [24, 28, 32]) { for (const [x, s] of [[35.6, -1], [40.4, -1], [35.6, 1], [40.4, 1]]) put(M, 'chairs-x4', .88, x, z + s * 1, s < 0 ? 0 : Math.PI); xSolid(M, 34, z - 1.35, 42, z + 1.35); }   // the mess
    put(M, 'wall-screen', 2, 5, 23.3, 0, 2.6);                                                                                                       // the concourse board
    for (const x of [-14, 14]) { put(M, 'chairs-x4', .88, x, 25, 0); xSolid(M, x - 1.36, 24.6, x + 1.36, 25.4); }
    put(M, 'computer-console', 1.1, 6.4, 12, -HP); xSolid(M, 5.9, 11.4, 6.9, 12.6);                                                                   // the checkpoint desk
    put(M, 'computer-console', 1.1, 16.4, 40, -HP); xSolid(M, 15.9, 39.4, 16.9, 40.6); for (const z of [41, 43]) put(M, 'medkit-small', .4, 17.9, z, -HP, 1.3);   // clinic
    put(M, 'medkit-case', .18, 16.4, 40.6, 0, 1.12);
    for (let i = 0; i < 2; i++) put(M, 'server-rack', 2, 23.2, 48 + i * 1.4, HP); xSolid(M, 22.6, 47.2, 23.8, 50.2);                                  // the captain's office
    put(M, 'wall-screen', 1.6, 28, 55.8, Math.PI, 1.4);
    for (let i = 0; i < 4; i++) put(M, 'locker', 1.73, 30.4 + i * 1.34, 45.4, HP); xSolid(M, 29.6, 44.8, 35.6, 46);                                   // armory
    for (let i = 0; i < 3; i++) put(M, 'fuel-cell', .75, 38 + i * .9, 45.2, i);
    for (let i = 0; i < 8; i++) put(M, 'server-tower', 2.09, -39.4, 43.4 + i * .7, HP); xSolid(M, -39.8, 43, -38.9, 49);                                // reactor hall: racks and the panels
    for (let i = 0; i < 4; i++) put(M, 'wall-4', 2, -19.2, 44 + i * 1.5, Math.PI); xSolid(M, -19.6, 43.2, -18.6, 50);
    put(M, 'computer-console', 1.1, -22.2, 44, -HP); xSolid(M, -22.7, 43.4, -21.7, 44.6);
    for (let i = 0; i < 3; i++) put(M, 'gas-bottle', 1.44, 40 + i * .5, 72.6, i, -5);                                                                // maintenance level
  }
  const Hs = POCKETS.hesper;
  if (Hs) {
    put(Hs, 'wall-screen', 1.4, 8, 9.15, 0, 1.4);
    put(Hs, 'computer-console', 1.1, 8.6, 27.2, Math.PI); put(Hs, 'walkie-talkie', .36, 6.4, 25.5, .4, .82);                                          // the colonel's office
    for (let i = 0; i < 4; i++) put(Hs, 'gas-bottle', 1.44, -1 + i * .55, 37.3, i);                                                                    // armory
  }
  const L = POCKETS.lab;
  if (L) {
    for (const x of [4.2, 8.4, 12.6]) { put(L, 'computer-console', 1.1, x, 13.2, 0); xSolid(L, x - .6, 12.7, x + .6, 13.8); }                         // lab A terminals
    put(L, 'wall-screen', 1.6, 9, 12.15, 0, 1.6);
    for (let i = 0; i < 3; i++) put(L, 'server-rack', 2, 5.3, 31 + i * 1.4, -HP); xSolid(L, 4.7, 30.2, 5.9, 35.2);                                      // the archive
    for (let i = 0; i < 4; i++) put(L, 'server-tower', 2.09, -.4, 31 + i * .7, HP); xSolid(L, -.9, 30.6, .1, 33.6);
    for (const z of [14, 16]) put(L, 'medkit-small', .4, 15.85, z, -HP, 1.3);
    put(L, 'locker', 1.73, -11.3, 13.4, 0); put(L, 'locker', 1.73, -11.3, 14.8, 0); xSolid(L, -11.8, 12.6, -10.6, 15.6);                               // lab B: suit lockers
  }
}
