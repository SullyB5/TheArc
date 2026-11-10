
/* the crashed station: hull modules with ribbed arches, an airlock, and the leaning spire */
function hullModule(r, len, ribs = true) {
  const g = new THREE.Group();
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(len / 8, 3);
  const cyl = mesh(new THREE.CylinderGeometry(r, r, len, 24, 1), new THREE.MeshStandardMaterial({ map: t, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xc4c2bb, metalness: .45, roughness: .62 }), 0, 0, 0, g);
  cyl.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(r * .92, r, 1, 24), S(0x6d6e6c, { map: TX.metal, metalness: .5 }), s * (len / 2 + .3), 0, 0, g); cap.rotation.z = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(r * .42, .35, 6, 18), M(0x3a3a38), s * (len / 2 + .85), -r * .25, 0, g); ring.rotation.y = Math.PI / 2;
    const hole = mesh(new THREE.CircleGeometry(r * .4, 18), M(0x0d0d0c), s * (len / 2 + .82), -r * .25, 0, g); hole.rotation.y = s * Math.PI / 2;
  }
  if (ribs) for (let x = -len / 2 + 3; x < len / 2 - 1; x += 4.5) {
    const rib = mesh(new THREE.TorusGeometry(r + .45, .32, 5, 18, Math.PI), S(0xd8d8d0, { metalness: .5, roughness: .45 }), x, 0, 0, g); rib.rotation.y = Math.PI / 2;
    const fin = mesh(new THREE.BoxGeometry(.35, 2.4, .8), S(0xd8d8d0, { metalness: .5, roughness: .45 }), x, r + 1.4, 0, g); fin.rotation.z = rr(-.25, .25);
  }
  // roof plates (the angled "prism" shapes from the crash site)
  for (let i = 0; i < 3; i++) {
    const p = mesh(new THREE.BoxGeometry(rr(4, 7), .4, rr(4, 6)), M(0x8e9294), rr(-len / 3, len / 3), r + .2, rr(-1.5, 1.5), g);
    p.rotation.set(rr(-.35, .35), rnd(), rr(-.3, .3));
  }
  return g;
}
function lattice(w, h, color, step = 4) {
  const parts = [], c = color;
  for (const [x, z] of [[-w / 2, -w / 2], [w / 2, -w / 2], [-w / 2, w / 2], [w / 2, w / 2]])
    parts.push({ geo: new THREE.BoxGeometry(.28, h, .28), m: tm(x, h / 2, z), color: c });
  for (let y = 0; y < h; y += step) {
    for (const s of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(w, .18, .18), m: tm(0, y, s * w / 2), color: c });
      parts.push({ geo: new THREE.BoxGeometry(.18, .18, w), m: tm(s * w / 2, y, 0), color: c });
      const dl = Math.hypot(w, step);
      parts.push({ geo: new THREE.BoxGeometry(dl, .12, .12), m: tm(0, y + step / 2, s * w / 2, 0, 0, Math.atan2(step, w) * s), color: c });
      parts.push({ geo: new THREE.BoxGeometry(.12, .12, dl), m: tm(s * w / 2, y + step / 2, 0, Math.atan2(step, w) * s, 0, 0), color: c });
    }
  }
  return merge(parts);
}
/* the Arc: the main hull, twice the old size and walk-in. One big blast door faces the yard; inside there's a deck,
   a ramp up to a catwalk along the south wall, and a firing slit the whole length — the place you fall back to
   when the walls go. The two side modules came down outside the wall; the spire stuck nose-first behind the hull. */
const ARC = { x: 0, z: -36, R: 11, L: 36, C: 4.5, W: 10, DOOR: 4.2, WALK: 7.5, SLIT0: 8.2, SLIT1: 9.7 };
const ARC_CORE = { x: ARC.x + 14, z: ARC.z - 5 };
const hullDoor = { open: true, hp: 520, max: 520, t: 1 };
let hullDoors = [];
const inHull = (x, z) => Math.abs(x - ARC.x) < ARC.L && Math.abs(z - ARC.z) < ARC.W + .3;
const ARC_DOOR_OUT = { x: ARC.x, z: ARC.z + ARC.W + 2.6 }, ARC_DOOR_IN = { x: ARC.x, z: ARC.z + ARC.W - 3 };
function hullCollide(o, rad) {
  const lx = o.x - ARC.x, lz = o.z - ARC.z, Wd = ARC.W + .3;
  if (Math.abs(lx) < ARC.DOOR + .2 && Math.abs(lz - Wd) < rad + .35 && !(hullDoor.open || hullDoor.hp <= 0)) {
    const inside = (o.phz ?? lz) < Wd;
    o.z = ARC.z + (inside ? Wd - rad - .35 : Wd + rad + .35);
  }
  o.phz = o.z - ARC.z;
}
function hullShell(t0, t1, x0, x1, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(ARC.R, ARC.R, x1 - x0, 44, 1, true, t0, t1 - t0), mat);
  m.rotation.z = Math.PI / 2; m.position.x = (x0 + x1) / 2; m.castShadow = m.receiveShadow = true; return m;
}
function buildArc() {
  const g = new THREE.Group(); g.position.set(ARC.x, H0 + ARC.C, ARC.z); world.add(g);
  const R = ARC.R, L = ARC.L, C = ARC.C;
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(L / 5, 5);
  const hullMat = new THREE.MeshStandardMaterial({ map: t, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xc4c2bb, metalness: .45, roughness: .62, side: THREE.DoubleSide });
  // angles: world z = R cos θ (south = 0), y = R sin θ (top = π/2)
  const tFloor = -Math.asin(C / R), tDoor = Math.asin((6.6 - C) / R), tS0 = Math.asin((ARC.SLIT0 - C) / R), tS1 = Math.asin((ARC.SLIT1 - C) / R);
  g.add(hullShell(tS1, Math.PI * 2 + tFloor, -L, L, hullMat));               // roof, north wall
  g.add(hullShell(tDoor, tS0, -L, L, hullMat));                              // band between the door and the slit
  g.add(hullShell(tFloor, tDoor, -L, -ARC.DOOR, hullMat));                   // south wall, either side of the door
  g.add(hullShell(tFloor, tDoor, ARC.DOOR, L, hullMat));
  // the slit: posts every few metres, and a dark lip
  for (let x = -L + 2; x < L - 1; x += 3.2) { const y = (ARC.SLIT0 + ARC.SLIT1) / 2 - C; mesh(new THREE.BoxGeometry(.35, ARC.SLIT1 - ARC.SLIT0 + .3, .5), S(0x55554f, { metalness: .5 }), x, y, Math.sqrt(R * R - y * y), g); }
  // end bulkheads (discs), the east one with a sealed hatch
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CircleGeometry(R, 44), S(0x6d6e6c, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), s * L, 0, 0, g); cap.rotation.y = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(R * .42, .35, 6, 18), M(0x3a3a38), s * (L + .3), -R * .1, 0, g); ring.rotation.y = Math.PI / 2;
    mesh(new THREE.CircleGeometry(R * .4, 18), M(0x2a2a28, { side: THREE.DoubleSide }), s * (L + .25), -R * .1, 0, g).rotation.y = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mesh(new THREE.BoxGeometry(.4, .6, .6), M(0x55585a), s * (L + .45), -R * .1 + Math.sin(a) * R * .42, Math.cos(a) * R * .42, g); }
  }
  // ribs and fins outside
  for (let x = -L + 3; x < L - 1; x += 6) {
    const rib = mesh(new THREE.TorusGeometry(R + .5, .4, 5, 24, Math.PI), S(0xd8d8d0, { metalness: .5, roughness: .45 }), x, 0, 0, g); rib.rotation.y = Math.PI / 2;
    const fin = mesh(new THREE.BoxGeometry(.45, 3.4, 1.1), S(0xd8d8d0, { metalness: .5, roughness: .45 }), x, R + 2, 0, g); fin.rotation.z = rr(-.25, .25);
  }
  for (let i = 0; i < 6; i++) { const p = mesh(new THREE.BoxGeometry(rr(6, 11), .5, rr(6, 9)), M(0x8e9294), rr(-L * .7, L * .7), R + .3, rr(-2.5, 2.5), g); p.rotation.set(rr(-.35, .35), rnd(), rr(-.3, .3)); }
  // door frame + "ARC" stencil over it
  const fr = S(0x3c3d3e, { metalness: .6 });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.6, 6.9, 1.2), fr, s * (ARC.DOOR + .3), 6.9 / 2 - C, Math.sqrt(R * R - 1) - .2, g);
  mesh(new THREE.BoxGeometry(ARC.DOOR * 2 + 1.2, .6, 1.4), fr, 0, 6.7 - C, Math.cos(tDoor) * R - .1, g);
  for (let i = 0; i < 10; i++) mesh(new THREE.BoxGeometry(.6, .5, .08), M(i % 2 ? 0x1a1a1a : 0xd9a32a), -ARC.DOOR + .4 + i * .85, 7.2 - C, Math.cos(Math.asin((7.2 - C) / R)) * R + .05, g);
  const arcSign = mesh(new THREE.BoxGeometry(9, 1.6, .15), [M(0x2a2826), M(0x2a2826), M(0x2a2826), M(0x2a2826), new THREE.MeshLambertMaterial({ map: signTex('THE ARC') }), M(0x2a2826)], 0, 12.4 - C, Math.sqrt(R * R - (12.4 - C) ** 2) + .5, g);
  arcSign.rotation.x = -Math.asin((12.4 - C) / R) * .85;
  // blast doors: two slabs that slide into the hull
  for (const s of [-1, 1]) {
    const d = new THREE.Group(); g.add(d);
    const slab = mesh(new THREE.BoxGeometry(ARC.DOOR, 6.5, .35), S(0x6a6e70, { map: TX.metal, metalness: .55, roughness: .5 }), 0, 6.5 / 2 - C, 0, d);
    for (const y of [1, 3.2, 5.4]) mesh(new THREE.BoxGeometry(ARC.DOOR - .3, .25, .12), M(0x3a3d3f), 0, y - C, .22, d);
    for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(.25, 1.6, .1), M(k % 2 ? 0x1a1a1a : 0xd9a32a), s * -(ARC.DOOR / 2 - .3), .9 + k * .4 - C, .24, d).rotation.z = .6;
    hullDoors.push({ g: d, s, slab });
  }
  // ---- inside ----
  const deckT = texPanel.clone(); deckT.needsUpdate = true; deckT.repeat.set(L / 3, ARC.W / 3);
  mesh(new THREE.BoxGeometry(L * 2, .14, ARC.W * 2 + .2), new THREE.MeshLambertMaterial({ map: deckT, color: 0x8a8c88 }), 0, .07 - C, 0, g);
  // catwalk along the south wall + ramp up from the west end
  const walkZ = ARC.W - 1.25, walkHD = 1.45, steel = M(0x4a4c4e), grate = new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a6c6c });
  const wx0 = -10, wx1 = L - 1.2, rx0 = -L + 1.8;
  mesh(new THREE.BoxGeometry(wx1 - wx0, .2, walkHD * 2), grate, (wx0 + wx1) / 2, ARC.WALK - C, walkZ, g);
  for (let x = wx0 + 1; x < wx1; x += 4) mesh(new THREE.BoxGeometry(.2, ARC.WALK, .2), steel, x, ARC.WALK / 2 - C, walkZ - walkHD + .15, g);
  mesh(new THREE.BoxGeometry(wx1 - wx0, .08, .08), M(0xd9a32a), (wx0 + wx1) / 2, ARC.WALK + 1 - C, walkZ - walkHD, g);
  for (let x = wx0; x < wx1; x += 2) mesh(new THREE.BoxGeometry(.06, 1, .06), steel, x, ARC.WALK + .5 - C, walkZ - walkHD, g);
  const rLen = wx0 - rx0, rAng = Math.atan2(ARC.WALK, rLen);
  const ramp = mesh(new THREE.BoxGeometry(Math.hypot(rLen, ARC.WALK), .2, walkHD * 2), grate, (rx0 + wx0) / 2, ARC.WALK / 2 - C, walkZ, g); ramp.rotation.z = rAng;
  const rail = mesh(new THREE.BoxGeometry(Math.hypot(rLen, ARC.WALK), .08, .08), M(0xd9a32a), (rx0 + wx0) / 2, ARC.WALK / 2 + 1 - C, walkZ - walkHD, g); rail.rotation.z = rAng;
  addFloor(ARC.x + (wx0 + wx1) / 2, ARC.z + walkZ, 0, (wx1 - wx0) / 2, walkHD, H0 + ARC.WALK);
  addFloor(ARC.x + (rx0 + wx0) / 2, ARC.z + walkZ, 0, rLen / 2, walkHD, H0 + ARC.WALK / 2); FLOORS[FLOORS.length - 1].slope = ARC.WALK / rLen;
  // the core: the old reactor housing, still warm — raiders who get in go for it
  { const cg = new THREE.Group(); cg.position.set(ARC_CORE.x - ARC.x, -C, ARC_CORE.z - ARC.z); g.add(cg);
    mesh(new THREE.CylinderGeometry(2.2, 2.6, 1, 16), M(0x3a3c3e), 0, .5, 0, cg);
    mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 16), S(0x8a8c8e, { metalness: .6 }), 0, 3.2, 0, cg);
    const glow = mesh(new THREE.CylinderGeometry(1.55, 1.55, .5, 16), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, toneMapped: false }), 0, 3.2, 0, cg); glow.castShadow = false;
    DECOR_ANIM.push(tt => { glow.material.color.setHSL(.54, .8, .55 + Math.sin(tt * 2.2) * .12); });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const p = mesh(new THREE.CylinderGeometry(.15, .15, 6, 6), M(0x2a2a2a), Math.cos(a) * 2.2, 3, Math.sin(a) * 2.2, cg); p.rotation.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); }
    addCol(ARC_CORE.x, ARC_CORE.z, 2.4); }
  // bunks, lockers, crates — a place to hole up
  for (let i = 0; i < 6; i++) { const x = -24 + i * 3.4, z = -ARC.W + 1.4; const b = new THREE.Group(); b.position.set(x, -C, z); g.add(b);
    for (const y of [.5, 1.8]) { mesh(new THREE.BoxGeometry(2.2, .14, 1), M(0x5a5e60), 0, y, 0, b); mesh(new THREE.BoxGeometry(2, .16, .9), M(pick([0x6a7a5a, 0x8a8a80, 0x5a6a7a])), 0, y + .14, 0, b); }
    for (const sx of [-1.05, 1.05]) mesh(new THREE.BoxGeometry(.08, 2.4, .08), M(0x3a3a3a), sx, 1.2, .45, b);
    addCol(ARC.x + x, ARC.z + z, 1); }
  for (let i = 0; i < 8; i++) { const x = -4 + i * 1.1, z = -ARC.W + .7; mesh(new THREE.BoxGeometry(1, 2.2, .6), M(pick([0x5a6a7a, 0x6a6e70, 0x4a5a6a])), x, 1.1 - C, z, g); }
  addColLine(ARC.x - 4, ARC.z - ARC.W + .7, ARC.x + 4, ARC.z - ARC.W + .7, .6);
  for (const [x, z] of [[-14, 2], [-12, -2.5], [6, 3], [22, 4], [-22, 3]]) { mesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), M(0x4f5a3a), x, .55 - C, z, g); mesh(new THREE.BoxGeometry(1.1, .9, .9), M(0x5a4a36), x + .2, 1.55 - C, z, g).rotation.y = .4; addCol(ARC.x + x, ARC.z + z, .9); }
  // strip lights + one warm lamp so it isn't a cave
  const strip = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  for (let x = -L + 4; x < L - 2; x += 8) mesh(new THREE.BoxGeometry(2.4, .1, .25), strip, x, R - 1.2, 0, g).castShadow = false;
  const hl = new THREE.PointLight(0xffd8a0, 2.4, 46, 1.2); hl.position.set(0, R - 3, 0); g.add(hl);
  // collision: the shell (bullets pass over the south side above 8 m — that's the slit), end walls, a gap for the door
  const zS = ARC.z + ARC.W + .3, zN = ARC.z - ARC.W - .3;
  addColLine(ARC.x - L, zN, ARC.x + L, zN, .6);
  for (const [a, b] of [[-L, -ARC.DOOR - .4], [ARC.DOOR + .4, L]]) { const n = Math.ceil((b - a) / .8); for (let i = 0; i <= n; i++) addCol(ARC.x + lerp(a, b, i / n), zS, .6, 8); }
  addColLine(ARC.x - L - .3, zN, ARC.x - L - .3, zS, .6); addColLine(ARC.x + L + .3, zN, ARC.x + L + .3, zS, .6);
  SHELTERS.push({ x: ARC.x, z: ARC.z, kind: 'arc', r: 0, hull: 1 });

  // the side modules, broken off on the way down, now outside the wall
  const m2 = hullModule(6.6, 26); m2.position.set(80, heightAt(80, -36) + 4.2, -36); m2.rotation.set(-.05, .95, .08); world.add(m2);
  for (let i = -12; i <= 12; i += 4) addCol(80 + Math.cos(.95) * i, -36 - Math.sin(.95) * i, 6.8);
  const m3 = hullModule(5.4, 18, false); m3.position.set(-80, heightAt(-80, -24) + 3.2, -24); m3.rotation.set(0, -1.2, .1); world.add(m3);
  for (let i = -8; i <= 8; i += 3.5) addCol(-80 + Math.cos(-1.2) * i, -24 - Math.sin(-1.2) * i, 5.6);
  // the spire: a broken tower section that came down nose-first and stuck, behind the hull
  const sp = new THREE.Group(); sp.position.set(-6, H0 - 4, -56); sp.rotation.set(-.2, .3, .18); world.add(sp);
  mesh(lattice(11, 80, 0x56544f, 6), VCOL, 0, 0, 0, sp);
  const coreT = texPanel.clone(); coreT.needsUpdate = true; coreT.repeat.set(1, 9);
  mesh(new THREE.BoxGeometry(7, 70, 7), new THREE.MeshStandardMaterial({ map: coreT, normalMap: TX.metal2N, color: 0x9a948c, metalness: .4, roughness: .7 }), 0, 35, 0, sp);
  for (let i = 0; i < 12; i++) { const b = mesh(new THREE.BoxGeometry(rr(3, 8), rr(1.5, 5), rr(3, 8)), M(pick([0x6e6a63, 0x8a8478, 0x4f4c47])), rr(-5, 5), rr(10, 80), rr(-5, 5), sp); b.rotation.set(rnd(), rnd(), rnd()); }
  for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(.25, rr(4, 9), .25), M(0x3b3a37), rr(-4, 4), 80 + rr(0, 4), rr(-4, 4), sp); b.rotation.set(rr(-.8, .8), 0, rr(-.8, .8)); }
  addCol(-6, -56, 7.5);
  // radio mast with loudspeakers, off the hull's east end
  const mast = new THREE.Group(); mast.position.set(42, H0, -36); world.add(mast);
  mesh(lattice(1.6, 26, 0x9a9a96, 2.4), VCOL, 0, 0, 0, mast);
  for (const [a, y] of [[0, 24.5], [2.1, 24.5], [4.2, 23.4]]) {
    const hn = mesh(new THREE.ConeGeometry(.8, 1.4, 10, 1, true), M(0x5d5e5c, { side: THREE.DoubleSide }), Math.sin(a) * 1.3, y, Math.cos(a) * 1.3, mast);
    hn.lookAt(Math.sin(a) * 9, y - 1, Math.cos(a) * 9); hn.rotateX(-Math.PI / 2);
  }
  mesh(new THREE.CylinderGeometry(1, 1, .2, 16), M(0xc9c9c4), 0, 26.3, 0, mast).rotation.x = .5;
  addCol(42, -36, 1.3);
}
function updHullDoor(dt) {
  const target = hullDoor.hp <= 0 ? .55 : hullDoor.open ? 1 : 0;
  hullDoor.t = lerp(hullDoor.t, target, dt * 1.6);
  const zO = ARC.W - .45;
  for (const d of hullDoors) { d.g.position.set(d.s * (ARC.DOOR / 2 + hullDoor.t * (ARC.DOOR + .2)), 0, zO); d.g.rotation.z = hullDoor.hp <= 0 ? d.s * .08 : 0; }
}

/* the wall: corrugated sheets, log posts, and the gate with its sign */
const WALL_H = [2.4, 3.6, 4.6, 5.4];
function buildWall(level) {
  if (wallGroup) world.remove(wallGroup);
  wallGroup = new THREE.Group(); wallGroup.position.y = 0; world.add(wallGroup);
  const H = WALL_H[level];
  const sheetCols = [0x9da3a6, 0x8f9a9e, 0x7f8f9e, 0xa2a49d, 0x9a7f6a, 0x9b5a3e, 0x6f86a0];
  const SEG = 96, segA = (Math.PI * 2 - GATE_HALF * 2) / SEG;
  const posts = [];
  for (let i = 0; i < SEG; i++) {
    const a = GATE_HALF + segA * (i + .5);
    const x = Math.sin(a) * CAMP_R, z = Math.cos(a) * CAMP_R, y = heightAt(x, z);
    const w = segA * CAMP_R + .15;
    const sh = level === 0 && rnd() < .25 ? H * rr(.6, .85) : H * rr(.94, 1.04);
    const mat = new THREE.MeshLambertMaterial({ map: texCorr, normalMap: texCorrN, color: pick(sheetCols) });
    const s = mesh(new THREE.BoxGeometry(w, sh, .18), mat, x, y + sh / 2 - .2, z, wallGroup);
    s.rotation.set(rr(-.03, .03), a, rr(-.02, .02));
    if (i % 3 === 0) posts.push([a - segA / 2, y]);
    if (level >= 2) { // sharpened log spikes outside
      for (let k = -1; k <= 1; k += 2) {
        const sx = Math.sin(a + k * segA * .25) * (CAMP_R + 1.1), sz = Math.cos(a + k * segA * .25) * (CAMP_R + 1.1);
        const sp = mesh(new THREE.ConeGeometry(.12, 2.4, 5), M(0x7a5a3c), sx, heightAt(sx, sz) + .7, sz, wallGroup);
        sp.rotation.set(-Math.cos(a) * .9, 0, Math.sin(a) * .9);
      }
    }
    if (level >= 3) { // razor wire coil
      const rw = mesh(new THREE.TorusGeometry(.32, .03, 4, 10), M(0x8a8a8a), x, y + sh + .1, z, wallGroup);
      rw.rotation.y = a; rw.scale.set(w * 1.5, 1, 1); rw.castShadow = false;
    }
    if (level >= 1 && i % 2 === 0) { // horizontal braces on the inside
      const b = mesh(new THREE.BoxGeometry(w, .22, .22), M(0x5f4936), Math.sin(a) * (CAMP_R - .3), y + sh * .7, Math.cos(a) * (CAMP_R - .3), wallGroup); b.rotation.y = a;
    }
  }
  for (const [a, y] of posts) {
    const x = Math.sin(a) * CAMP_R, z = Math.cos(a) * CAMP_R;
    const p = mesh(new THREE.CylinderGeometry(.22, .28, H + 1.4, 6), new THREE.MeshLambertMaterial({ map: texWood, color: 0xb59a7e }), x, y + (H + 1.4) / 2 - .4, z, wallGroup);
    p.rotation.z = rr(-.04, .04);
  }
}
const GATE_X = Math.sin(GATE_HALF) * CAMP_R;
function buildGate() {
  gateGroup = new THREE.Group(); gateGroup.position.set(0, heightAt(0, CAMP_R), CAMP_R); world.add(gateGroup);
  const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0xb8a088 });
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(.42, .5, 9, 7), wood, s * GATE_X, 4.1, 0, gateGroup);
    addCol(s * GATE_X, CAMP_R, .6);
  }
  signMat = new THREE.MeshLambertMaterial({ map: signTex('KESTREL') });
  for (const y of [7.1, 8.25]) mesh(new THREE.BoxGeometry(GATE_X * 2 + 1.6, .22, .3), M(0x2a2826), 0, y, 0, gateGroup);
  const sign = mesh(new THREE.BoxGeometry(GATE_X * 2 - .6, 1.0, .12), [M(0x2a2826), M(0x2a2826), M(0x2a2826), M(0x2a2826), signMat, signMat], 0, 7.68, 0, gateGroup);
  sign.rotation.y = 0;
  // loudspeaker on the post
  mesh(new THREE.ConeGeometry(.35, .6, 8, 1, true), M(0x444442, { side: THREE.DoubleSide }), GATE_X - .2, 6.2, .5, gateGroup).rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * (GATE_X - .4), 0, 0); gateGroup.add(pivot);
    const door = new THREE.Group(); pivot.add(door);
    gateDoors.push({ pivot, door, s });
  }
}
function dressGate(level) {
  const W = GATE_X - .45, H = WALL_H[Math.max(1, level)] + .3;
  for (const d of gateDoors) {
    d.door.clear();
    const cols = level >= 2 ? [0x6a6e70, 0x5e6466] : [0x8e8a7e, 0x7f8a8e, 0x9a7f6a];
    for (let i = 0; i < 3; i++) {
      const panel = mesh(new THREE.BoxGeometry(W / 3 + .05, H, .16), new THREE.MeshLambertMaterial({ map: texCorr, color: pick(cols) }), -d.s * (W / 6 + i * W / 3), H / 2 - .1, 0, d.door);
      panel.rotation.z = rr(-.02, .02);
    }
    if (level >= 1) for (const y of [.8, H - .8]) mesh(new THREE.BoxGeometry(W, .3, .25), M(0x5f4936), -d.s * W / 2, y, .15, d.door);
    if (level >= 1) { const x = mesh(new THREE.BoxGeometry(.25, Math.hypot(W, H - 1.6), .22), M(0x5f4936), -d.s * W / 2, H / 2, .2, d.door); x.rotation.z = d.s * Math.atan2(W, H - 1.6); }
    if (level >= 2) mesh(new THREE.BoxGeometry(W, H * .5, .1), M(0x55595b), -d.s * W / 2, H * .32, .28, d.door);
    if (level >= 3) for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.ConeGeometry(.1, .7, 4), M(0x9a9a9a), -d.s * (.4 + i * W / 4), H * .5, .55, d.door); sp.rotation.x = Math.PI / 2; }
  }
}
const TOWER_POS = [[.42, 59], [-.42, 59], [2.75, 59.5], [-2.75, 59.5]];
function buildTowers() {
  for (const [a, r] of TOWER_POS) {
    const x = Math.sin(a) * r, z = Math.cos(a) * r, y = heightAt(x, z);
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = a; world.add(t);
    mesh(lattice(2.6, 8, 0x6b5a46, 2.6), VCOL, 0, 0, 0, t);
    mesh(new THREE.BoxGeometry(3.6, .25, 3.6), M(0x6b5a46), 0, 8, 0, t);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(3.6, 1, .12), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8b8f90 }), 0, 8.6, s * 1.75, t);
    mesh(new THREE.BoxGeometry(.12, 1, 3.6), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8b8f90 }), -1.75, 8.6, 0, t);
    const roof = mesh(new THREE.BoxGeometry(4.2, .2, 4.2), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x7a7f80 }), 0, 11.2, 0, t); roof.rotation.x = .12;
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) mesh(new THREE.BoxGeometry(.15, 3, .15), M(0x5a4a3a), px, 9.6, pz, t);
    // ladder
    for (let k = 0; k < 10; k++) mesh(new THREE.BoxGeometry(.8, .08, .08), M(0x7d6448), 0, .4 + k * .8, -1.45, t);
    const gun = new THREE.Group(); gun.position.set(0, 9.2, 1.2); t.add(gun); gun.visible = false;
    const lamp = new THREE.Group(); lamp.position.set(-1.2, 11.5, 1.5); t.add(lamp); lamp.visible = false;
    towers.push({ g: t, x, z, y, gun, lamp, cool: rnd(), a });
    addCol(x, z, 2);
  }
}
function dressTowers(turLv, lightLv) {
  for (const T of towers) {
    T.gun.clear(); T.gun.visible = turLv > 0;
    if (turLv > 0) {
      mesh(new THREE.CylinderGeometry(.35, .45, .5, 8), M(0x2f3133), 0, 0, 0, T.gun);
      const body = mesh(new THREE.BoxGeometry(.5, .4, 1.3), M(0x3d4042), 0, .4, .3, T.gun);
      mesh(new THREE.CylinderGeometry(.07, .07, 1.4 + turLv * .3, 6), M(0x1e1f20), 0, .45, 1.3 + turLv * .15, T.gun).rotation.x = Math.PI / 2;
      if (turLv >= 2) mesh(new THREE.BoxGeometry(1.1, .7, .1), M(0x55595b), 0, .55, .9, T.gun);
      if (turLv >= 3) { mesh(new THREE.CylinderGeometry(.07, .07, 1.6, 6), M(0x1e1f20), .22, .45, 1.6, T.gun).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(.4, .4, .5), M(0x6a5a2a), -.4, .35, 0, T.gun); }
      T.barrel = body;
    }
    T.lamp.clear(); T.lamp.visible = lightLv > 0;
    if (lightLv > 0) {
      mesh(new THREE.CylinderGeometry(.35, .25, .5, 10), M(0x2a2a2a), 0, 0, 0, T.lamp).rotation.x = 1.1;
      const glow = new THREE.Mesh(new THREE.CircleGeometry(.3, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); glow.position.set(0, -.1, .25); glow.rotation.x = -.45; T.lamp.add(glow);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(4 + lightLv * 2, 18, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: .05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      beam.position.set(0, -6, 7); beam.rotation.x = Math.PI - .9; T.lamp.add(beam); T.beam = beam;
    }
  }
}

/* inside the walls: the yard fire, and the settlement's buildings in a ring just inside the wall — where you cook, craft,
   trade and gear up. Each has a keeper behind a counter (E: trade) and a station at the side you can use yourself. */
/* the layout (from Bryce's sketch): Main Street runs from the gate straight to the Arc's door; Arc Row crosses in front of
   the hull; Cross Street cuts the yard in half; West Lane and East Lane split the blocks. Buildings face their street.
   ry: which way the front faces (0 = south/+z, π/2 = east/+x, π = north, -π/2 = west) */
const HP = Math.PI / 2;
const STREETS = [
  { n: 'Main Street', a: [0, 66], b: [0, -24], w: 8 },
  { n: 'Arc Row', a: [-52, -17], b: [52, -17], w: 6 },
  { n: 'Cross Street', a: [-55, 22], b: [55, 22], w: 6 },
  { n: 'West Lane', a: [-31, -17], b: [-31, 50], w: 4 },
  { n: 'East Lane', a: [28, 22], b: [28, 52], w: 4 },
  { n: 'Shop Walk', a: [-4, 3], b: [-27, 3], w: 3 },
  { n: 'Commons Walk', a: [4, 2], b: [44, 2], w: 3.5 },
];
const streetDist = (x, z) => { let d = 1e9; for (const S of STREETS) d = Math.min(d, segDist(x, z, S.a[0], S.a[1], S.b[0], S.b[1]) - S.w / 2); return d; };
const SHOP_DEFS = [
  { id: 'craft', x: -16, z: -5, ry: HP, sign: 'WORKSHOP', who: 'kade', name: 'Kade', st: ['bench', 'forge'], stN: 'Workbench + forge · craft', cat: 'tool', col: 0x8a9092, tint: 0xd8d0c4 },
  { id: 'trade', x: -16, z: 11.5, ry: HP, sign: 'TRADING POST', who: 'odile', name: 'Odile', st: ['bench'], stN: 'Sorting table · craft materials', cat: 'mat', col: 0x9a8a5a, tint: 0x9a7a60 },
  { id: 'med', x: -45, z: 4, ry: HP, bw: 14, bd: 9, sign: 'CLINIC', who: 'juno', name: 'Juno', st: ['lab'], stN: 'Clinic lab · make medicine', cat: 'med', col: 0xb8b8b0, tint: 0xe0d8cc },
  { id: 'wear', x: -42, z: 33, ry: Math.PI, sign: 'OUTFITTER', who: 'wren', name: 'Wren', st: ['bench'], stN: 'Sewing table · craft clothing', cat: 'wear', col: 0x6a8aa0, tint: 0xa0b0c8 },
  { id: 'guns', x: -16, z: 33, ry: HP, sign: 'GUNSMITH', who: 'rook', name: 'Rook', st: ['bench'], stN: 'Gun bench · craft weapons + ammo', cat: 'weap', col: 0x6a7a4a, tint: 0x8a9070 },
  { id: 'cook', x: 16, z: 33, ry: -HP, sign: 'COOKHOUSE', who: 'bram', name: 'Bram', st: ['fire', 'cook'], stN: 'Stove · cook', cat: 'food', col: 0xa86a48, tint: 0xc8a888 },
  { id: 'bunk', x: 41, z: 34, ry: Math.PI, bw: 12, sign: 'BUNKHOUSE', st: [], stN: 'Rest in a bunk', col: 0x7a7a5a },
  { id: 'salvage', x: 50, z: 4, ry: -HP, sign: 'SALVAGE', who: 'gus', name: 'Gus', st: ['bench'], stN: 'Strip-down bench · craft materials', cat: 'mat', col: 0x8a6a52, tint: 0x9a8a7a },
];
function shopL2W(D, lx, lz) { const c = Math.cos(D.ry), s = Math.sin(D.ry); return { x: D.cx + lx * c + lz * s, z: D.cz - lx * s + lz * c }; }
for (const D of SHOP_DEFS) { D.cx = D.x; D.cz = D.z; D.bw = D.bw || 11; D.bd = D.bd || 8; D.keeper = shopL2W(D, 0, -1.1); D.spot = shopL2W(D, -3.9, 1.9); D.front = shopL2W(D, 0, 2.1); D.forge = shopL2W(D, 3.9, 2.6); }
const SHOP = Object.fromEntries(SHOP_DEFS.map(D => [D.id, D]));
const SPOTS = {
  bench: SHOP.craft.spot, fire: { x: 24, z: 9 }, smoke: shopL2W(SHOP.cook, 7.6, 1.5), med: SHOP.med.spot, armory: SHOP.guns.spot,
};
let smokeGroup;
function shopHouse(D) {
  const y0 = H0, g = new THREE.Group(); g.position.set(D.cx, y0, D.cz); g.rotation.y = D.ry; world.add(g);
  const BW = D.bw, BD = D.bd, H = 4.4;
  const corr = c => new THREE.MeshLambertMaterial({ map: texCorr, normalMap: texCorrN, color: c });
  const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0xa08468 }), dark = M(0x2e2a26);
  // slab, walls (back + sides), posts, a front lintel; the front is open over the counter
  mesh(new THREE.BoxGeometry(BW + .6, .2, BD + .6), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xa8a49c }), 0, .1, 0, g);
  mesh(new THREE.BoxGeometry(BW, H, .22), corr(D.col), 0, H / 2, -BD / 2, g);
  for (const s of [-1, 1]) { mesh(new THREE.BoxGeometry(.22, H, BD), corr(D.col), s * BW / 2, H / 2, 0, g); mesh(new THREE.BoxGeometry(1.6, H, .22), corr(D.col), s * (BW / 2 - .8), H / 2, BD / 2, g); }
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.18, .22, H + .8, 6), wood, s * (BW / 2 - 1.7), (H + .8) / 2, BD / 2 + .1, g);
  mesh(new THREE.BoxGeometry(BW, .9, .25), corr(D.col), 0, H - .45, BD / 2, g);
  const roof = mesh(new THREE.BoxGeometry(BW + 1.4, .18, BD + 3.2), corr(0x6e706c), 0, H + .55, .9, g); roof.rotation.x = -.1;
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.12, 1.4, .12), wood, s * (BW / 2 - .4), H + .1, BD / 2 + 2.3, g);
  // the sign over the opening
  const sm = new THREE.MeshLambertMaterial({ map: signTex(D.sign) });
  mesh(new THREE.BoxGeometry(7.2, 1.1, .12), [dark, dark, dark, dark, sm, dark], 0, H + .2, BD / 2 + .22, g);
  // counter + lantern
  if (D.who) { mesh(new THREE.BoxGeometry(6.2, 1.05, .8), wood, 0, .52, .3, g); mesh(new THREE.BoxGeometry(6.5, .1, 1), M(0x5a4430), 0, 1.08, .3, g); }
  const lamp = mesh(new THREE.BoxGeometry(.3, .4, .3), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), 2.6, 1.35, .3, g); lamp.castShadow = false;
  mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }), 0, H - .2, 2, g).castShadow = false;
  // shelves on the back wall
  for (const y of [1.2, 2.2, 3.2]) mesh(new THREE.BoxGeometry(BW - 1.2, .08, .6), wood, 0, y, -BD / 2 + .45, g);
  const stuff = { cook: [0x8a3a2a, 0x7a6a4a, 0xc8a050], craft: [0x6d7276, 0x9a6040, 0x8a8c8c], trade: [0x7a5a3e, 0x6a7a5a, 0x9a8a6a, 0x5a6a7a], med: [0xd8d8d0, 0xc04040, 0x8ab0c8], guns: [0x2e3424, 0x4f5a3a, 0x3a3a3a], wear: [0x6a4a32, 0x5a6a7a, 0x8a7a5a], bunk: [0x6a7a5a, 0x8a8a80, 0x5a6a7a], salvage: [0x8a8c8c, 0x9a6040, 0x6d7276, 0xb0905a] }[D.id];
  { const parts = []; for (const y of [1.2, 2.2, 3.2]) for (let x = -BW / 2 + 1; x < BW / 2 - 1; x += rr(.5, .9)) { const h = rr(.25, .6); parts.push({ geo: new THREE.BoxGeometry(rr(.25, .5), h, .4), m: tm(x, y + h / 2 + .04, -BD / 2 + .45), color: pick(stuff) }); }
    mesh(merge(parts), VCOL, 0, 0, 0, g); }
  // what each place is for
  const sx = -3.9, sz = 1.2;
  if (D.id === 'cook') {
    const stove = new THREE.Group(); stove.position.set(sx, 0, sz - .3); g.add(stove);
    mesh(new THREE.BoxGeometry(1.8, 1, 1.1), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), 0, .5, 0, stove);
    mesh(new THREE.BoxGeometry(.9, .35, .05), new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false }), 0, .45, .56, stove);
    mesh(new THREE.CylinderGeometry(.35, .3, .45, 10), M(0x3a3a3a), -.4, 1.22, 0, stove); mesh(new THREE.CylinderGeometry(.25, .25, .3, 10), M(0x5a4a3a), .45, 1.15, 0, stove);
    mesh(new THREE.CylinderGeometry(.16, .16, H + 1.5, 8), M(0x3a3a3a), .6, (H + 1.5) / 2 + .5, -.3, stove);
    for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(.14, rr(.4, .7), .05), M(pick([0x8a3a2a, 0x7a2e22])), -2 + i * .5, H - .9, -1.4, g);
    // long tables out front
    for (const tx of [-2.6, 2.6]) { const t = new THREE.Group(); t.position.set(tx, 0, BD / 2 + 4.2); g.add(t);
      mesh(new THREE.BoxGeometry(3.4, .1, 1), wood, 0, .85, 0, t); for (const lx of [-1.5, 1.5]) mesh(new THREE.BoxGeometry(.1, .85, .9), wood, lx, .42, 0, t);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(3.2, .08, .35), M(0x7a6650), 0, .45, s * .8, t);
      const w = shopL2W(D, tx, BD / 2 + 4.2); addCol(w.x, w.z, 1.4); }
    const smk = []; const top = new THREE.Vector3(sx + .6, H + 2.3, sz - .6);
    for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(rr(.3, .5), 6, 4), new THREE.MeshLambertMaterial({ color: 0xcfcac0, transparent: true, opacity: .3, depthWrite: false })); p.castShadow = false; g.add(p); smk.push([p, i / 8]); }
    DECOR_ANIM.push(tt => { for (const [p, k0] of smk) { const k = (k0 + tt * .07) % 1; p.position.set(top.x + Math.sin(k * 7) * k, top.y + k * 9, top.z + k * 2); p.scale.setScalar(1 + k * 2.5); p.material.opacity = .32 * (1 - k); } });
  } else if (D.id === 'craft') {
    mesh(new THREE.BoxGeometry(1.2, .15, 2.6), wood, sx, 1, sz, g); for (const [x, z] of [[-.5, -1.1], [.5, -1.1], [-.5, 1.1], [.5, 1.1]]) mesh(new THREE.BoxGeometry(.12, 1, .12), wood, sx + x, .5, sz + z, g);
    mesh(new THREE.BoxGeometry(.3, .3, .4), M(0x3a5a7a), sx, 1.25, sz - .8, g);
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.BoxGeometry(rr(.3, .8), rr(.05, .25), rr(.3, .6)), M(pick(stuff)), sx + rr(-.4, .4), 1.12, sz + rr(-.5, 1), g); s.rotation.y = rnd(); }
    const forge = mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), 3.9, .7, 1.4, g);
    mesh(new THREE.BoxGeometry(.7, .35, .05), new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false }), 3.9, .8, 2.12, g);
    mesh(new THREE.BoxGeometry(.7, .5, .35), M(0x2e2e2e), 2.4, .95, 2.4, g); mesh(new THREE.BoxGeometry(.3, .7, .3), M(0x4a3a2a), 2.4, .35, 2.4, g);  // anvil
    const w = shopL2W(D, 3.9, 1.4); addCol(w.x, w.z, 1);
  } else if (D.id === 'trade') {
    for (const [x, z, r] of [[sx, sz, 0], [sx + .9, sz + .6, .4], [3.8, 1.2, .2], [4.2, 2.3, -.3]]) mesh(new THREE.CylinderGeometry(.4, .4, 1, 10), M(pick([0x5a4a3a, 0x6a5a3a, 0x3a4a5a])), x, .5, z, g).rotation.y = r;
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.8, .5, .6), M(pick(stuff)), rr(-4.5, 4.5), .25, BD / 2 + rr(1.2, 2.4), g).rotation.y = rnd();
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(.35, 6, 4), M(0xb8a888), 3.6 + i * .3, .3, -1.6, g).scale.y = .7;   // sacks
    mesh(new THREE.BoxGeometry(1.4, .9, 1), wood, sx, .45, sz + .4, g);
  } else if (D.id === 'med') {
    for (const x of [1.8, 3.8]) { mesh(new THREE.BoxGeometry(.9, .5, 2), M(0x9a9a92), x, .45, -2.4, g); mesh(new THREE.BoxGeometry(.85, .12, 1.9), M(0xe0ddd4), x, .76, -2.4, g); }
    mesh(new THREE.BoxGeometry(1.2, .1, 2.2), M(0xb0b0aa), sx, .95, sz, g); mesh(new THREE.BoxGeometry(1.1, .9, 2), M(0x8a8a84), sx, .45, sz, g);
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.15, .3, .15), M(pick([0x8ab0c8, 0xc04040, 0xd8d8d0])), sx + rr(-.4, .4), 1.15, sz + rr(-.8, .8), g);
    const cross = new THREE.MeshBasicMaterial({ color: 0xc83a32, toneMapped: false });
    mesh(new THREE.BoxGeometry(1.4, .4, .06), cross, 0, H + 1.3, BD / 2 + .25, g); mesh(new THREE.BoxGeometry(.4, 1.4, .06), cross, 0, H + 1.3, BD / 2 + .25, g);
  } else if (D.id === 'guns') {
    for (let i = 0; i < 7; i++) { const r = mesh(new THREE.BoxGeometry(.12, 1.1, .08), M(0x1e1f20), -3 + i * .9, 2.7, -BD / 2 + .3, g); r.rotation.z = .08; mesh(new THREE.BoxGeometry(.1, .35, .25), M(0x4a3a2a), -3 + i * .9, 2.25, -BD / 2 + .32, g); }
    for (const [x, y, z, r] of [[sx, .4, sz, .1], [sx + .2, 1.2, sz + .1, .4], [sx + .1, .4, sz + 1.1, -.2], [3.8, .4, 2, .3]]) { mesh(new THREE.BoxGeometry(1, .8, .7), M(0x4f5a3a), x, y, z, g).rotation.y = r; mesh(new THREE.BoxGeometry(1.02, .12, .72), M(0x2e3424), x, y, z, g).rotation.y = r; }
    for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(1.4, .5, .5), M(0x8a7e5a), -3 + i * 1.2, .25, BD / 2 + 1.4, g);
  } else if (D.id === 'bunk') {
    for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.position.set(-4.2 + i * 2.8, 0, -2.4); g.add(b);
      for (const y of [.5, 1.8]) { mesh(new THREE.BoxGeometry(1, .14, 2.2), M(0x5a4a3a), 0, y, 0, b); mesh(new THREE.BoxGeometry(.9, .16, 2), M(pick(stuff)), 0, y + .14, 0, b); }
      for (const sx2 of [-.45, .45]) mesh(new THREE.BoxGeometry(.08, 2.4, .08), M(0x3a3a3a), sx2, 1.2, 1.05, b); }
    mesh(new THREE.BoxGeometry(2, .8, 1), wood, sx, .4, sz, g); mesh(new THREE.CylinderGeometry(.3, .3, .5, 10), M(0x6a6a5a), 3.6, .25, 2, g);
    const bl = shopL2W(D, 0, -2.4); addColLine(shopL2W(D, -5, -2.4).x, bl.z, shopL2W(D, 5, -2.4).x, shopL2W(D, 5, -2.4).z, .9);
  } else if (D.id === 'salvage') {
    for (let i = 0; i < 3; i++) { const px = rr(-4, 4), pz = BD / 2 + rr(1.5, 3.5); for (let k = 0; k < 7; k++) { const b = mesh(new THREE.BoxGeometry(rr(.4, 1.4), rr(.1, .4), rr(.4, 1.2)), M(pick(stuff)), px + rr(-.8, .8), rr(.1, .9), pz + rr(-.8, .8), g); b.rotation.set(rr(-.5, .5), rnd() * 3, rr(-.5, .5)); } const w = shopL2W(D, px, pz); addCol(w.x, w.z, 1.2); }
    mesh(new THREE.BoxGeometry(1.4, .9, 1), M(0x4a4c4e), sx, .45, sz, g); mesh(new THREE.BoxGeometry(1.2, .06, .9), M(0x8a8c8c), sx, .95, sz, g);   // the scale
    mesh(new THREE.BoxGeometry(.06, 1.2, .06), M(0x3a3a3a), 3.8, .6, 1.4, g); mesh(new THREE.CylinderGeometry(.4, .4, .05, 12), M(0x9a9a92), 3.8, 1.2, 1.4, g);
  } else if (D.id === 'wear') {
    for (const x of [2.6, 4.2]) { mesh(new THREE.BoxGeometry(.06, 1.8, .06), M(0x3a3a3a), x, .9, -1.8, g); mesh(new THREE.BoxGeometry(1.4, .06, .06), M(0x3a3a3a), x, 1.8, -1.8, g);
      for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(.35, .9, .14), M(pick(stuff)), x - .5 + k * .33, 1.3, -1.8, g); }
    mesh(new THREE.BoxGeometry(1.2, .1, 2.2), wood, sx, .95, sz, g); mesh(new THREE.BoxGeometry(1.1, .9, 2), M(0x5a4430), sx, .45, sz, g);
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.6, .06, .5), M(pick(stuff)), sx, 1.03 + i * .06, sz - .5 + i * .5, g);
    const man = new THREE.Group(); man.position.set(4, 0, 2.6); g.add(man);   // a dummy wearing a vest
    mesh(new THREE.CylinderGeometry(.05, .05, 1.2, 5), M(0x3a3a3a), 0, .6, 0, man); mesh(new THREE.BoxGeometry(.55, .7, .3), M(0x5a6a4a), 0, 1.5, 0, man); mesh(new THREE.SphereGeometry(.15, 8, 6), M(0xb0a898), 0, 2, 0, man);
  }
  // collision: back + side walls, counter, the side station
  const P0 = shopL2W(D, -BW / 2, -BD / 2), P1 = shopL2W(D, BW / 2, -BD / 2), P2 = shopL2W(D, -BW / 2, BD / 2), P3 = shopL2W(D, BW / 2, BD / 2);
  addColLine(P0.x, P0.z, P1.x, P1.z, .45); addColLine(P0.x, P0.z, P2.x, P2.z, .45); addColLine(P1.x, P1.z, P3.x, P3.z, .45);
  for (const s of [-1, 1]) { const a = shopL2W(D, s * (BW / 2 - 1.6), BD / 2); addColLine(a.x, a.z, P2.x * (s < 0) + P3.x * (s > 0), P2.z * (s < 0) + P3.z * (s > 0), .45); }
  if (D.who) { const c0 = shopL2W(D, -3, .3), c1 = shopL2W(D, 3, .3); addColLine(c0.x, c0.z, c1.x, c1.z, .5); }
  const st = shopL2W(D, sx, sz); addCol(st.x, st.z, .8);
  SHELTERS.push({ x: D.cx, z: D.cz, kind: 'house', r: 3.6 });
}
const texGravel = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#6a5f50'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = rr(70, 150) | 0; g.fillStyle = `rgba(${v},${v - 8},${v - 20},${rr(.25, .7)})`; const r = rr(1, 3.2); g.fillRect(rnd() * w, rnd() * h, r, r); }
  grime(g, w, h, 14, 'rgba(40,32,24,.35)'); grime(g, w, h, 6, 'rgba(70,90,50,.18)');
});
/* the streets: gravel ribbons with worn edges, lamp posts along them, and a gatehouse over the gate */
function buildStreets() {
  const edge = new THREE.MeshLambertMaterial({ color: 0x5a5244, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  STREETS.forEach((S, si) => {
    const [ax, az] = S.a, [bx, bz] = S.b, L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    const t = texGravel.clone(); t.needsUpdate = true; t.repeat.set(S.w / 4, L / 4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S.w, L + S.w), new THREE.MeshLambertMaterial({ map: t, color: 0xb8ad9c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.set(-Math.PI / 2, 0, yaw + Math.PI); m.position.set((ax + bx) / 2, H0 + .03 + si * .006, (az + bz) / 2); m.receiveShadow = true; world.add(m);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(S.w + 1.4, L + S.w + 1.4), edge); e.rotation.copy(m.rotation); e.position.set(m.position.x, H0 + .02, m.position.z); world.add(e);
    // lamp posts every ~14 m, alternating sides (not on the narrow walks)
    if (S.w < 4) return;
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let d = 7, k = 0; d < L - 3; d += 14, k++) {
      const sd = (k % 2 ? 1 : -1) * (S.w / 2 + .7), x = lerp(ax, bx, d / L) + nx * sd, z = lerp(az, bz, d / L) + nz * sd;
      if (Math.hypot(x, z) > CAMP_R - 3 || inHull(x, z) || SHOP_DEFS.some(D => Math.hypot(x - D.cx, z - D.cz) < Math.max(D.bw, D.bd) / 2 + 1.2) || Math.hypot(x - SPOTS.fire.x, z - SPOTS.fire.z) < 6 || streetDist(x, z) < -.2) continue;
      const lp = new THREE.Group(); lp.position.set(x, H0, z); world.add(lp);
      mesh(new THREE.CylinderGeometry(.08, .11, 4.2, 6), M(0x3a3a38), 0, 2.1, 0, lp);
      mesh(new THREE.BoxGeometry(.9, .08, .08), M(0x3a3a38), -Math.sign(sd) * nx * .4, 4.15, -Math.sign(sd) * nz * .4, lp).rotation.y = Math.atan2(nx, nz) + HP;
      const bulb = mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), -Math.sign(sd) * nx * .8, 4, -Math.sign(sd) * nz * .8, lp); bulb.castShadow = false;
      addCol(x, z, .2, 4);
    }
  });
  // the gatehouse: two blockhouses either side of the gate and a covered walk across the top
  const conc = new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xa8a49c }), corr = new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a8f90 });
  const gz = CAMP_R, gy = heightAt(0, gz);
  for (const s of [-1, 1]) {
    const x = s * (GATE_X + 3.2), b = new THREE.Group(); b.position.set(x, gy, gz); world.add(b);
    mesh(new THREE.BoxGeometry(5, 8, 6), conc, 0, 4, 0, b);
    for (const z of [-3.05, 3.05]) mesh(new THREE.BoxGeometry(2.4, .5, .1), M(0x111111), 0, 6.4, z, b);
    const r = mesh(new THREE.BoxGeometry(5.6, .25, 6.6), corr, 0, 8.2, 0, b); r.rotation.x = .06;
    for (const z of [-3.1, 3.1]) mesh(new THREE.BoxGeometry(1.1, 2.1, .1), M(0x2a2826), -s * 1.2, 1.05, z, b);
    addColLine(x - 2.5, gz - 3, x - 2.5, gz + 3, .4); addColLine(x + 2.5, gz - 3, x + 2.5, gz + 3, .4); addColLine(x - 2.5, gz - 3, x + 2.5, gz - 3, .4); addColLine(x - 2.5, gz + 3, x + 2.5, gz + 3, .4);
  }
  const walk = new THREE.Group(); walk.position.set(0, gy, gz); world.add(walk);
  mesh(new THREE.BoxGeometry(GATE_X * 2 + 1.5, .4, 3.4), conc, 0, 9.3, 0, walk);
  for (const z of [-1.6, 1.6]) mesh(new THREE.BoxGeometry(GATE_X * 2 + 1.5, 1.1, .2), corr, 0, 10, z, walk);
  const wr = mesh(new THREE.BoxGeometry(GATE_X * 2 + 11, .2, 4.2), corr, 0, 12, 0, walk); wr.rotation.x = .04;
  for (const x of [-(GATE_X + 4.6), GATE_X + 4.6]) for (const z of [-1.9, 1.9]) mesh(new THREE.BoxGeometry(.15, 3.8, .15), M(0x3a3a38), x, 10.1, z, walk);
}
function buildCampProps() {
  const y0 = H0;
  for (const D of SHOP_DEFS) shopHouse(D);
  // the yard fire
  const f = new THREE.Group(); f.position.set(SPOTS.fire.x, y0, SPOTS.fire.z); world.add(f);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; mesh(new THREE.DodecahedronGeometry(.36, 0), M(0x6a6660), Math.cos(a) * 1.3, .15, Math.sin(a) * 1.3, f); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(.1, .11, 1.6, 5), M(0x4a3020), 0, .25, 0, f); l.rotation.set(Math.PI / 2 - .3, i * .8, 0); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.65, 1.6, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .9 }));
  flame.position.y = .9; f.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a })); flame2.position.y = .75; f.add(flame2);
  DECOR_ANIM.push(t => { flame.scale.set(1 + Math.sin(t * 17) * .1, 1 + Math.sin(t * 11) * .2, 1); flame2.scale.y = 1 + Math.sin(t * 23) * .25; flame.rotation.y = t * 2; });
  fireLight = new THREE.PointLight(0xff9a4a, 2.4, 26, 0); fireLight.position.set(SPOTS.fire.x, y0 + 1.6, SPOTS.fire.z); world.add(fireLight);
  addCol(SPOTS.fire.x, SPOTS.fire.z, 1.5);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, x = SPOTS.fire.x + Math.cos(a) * 4.2, z = SPOTS.fire.z + Math.sin(a) * 4.2;
    const b = new THREE.Group(); b.position.set(x, y0, z); b.rotation.y = -a + Math.PI / 2; world.add(b);
    const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0xa0886e });
    mesh(new THREE.BoxGeometry(2.6, .12, .45), wood, 0, .45, 0, b); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.12, .45, .4), wood, s, .22, 0, b); }
  // drums, a generator, cable runs
  for (const [x, z] of [[-8, -12], [8, -12], [-25, -12], [20, -11], [-26, 18], [-6, 50], [8, 48], [34, 46], [-36, 46], [44, -8]]) {
    mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 10), M(pick([0x5a6a7a, 0x7a3a2a, 0x3a5a3a])), x, H0 + .55, z, world); addCol(x, z, .5);
  }
  { const g = new THREE.Group(); g.position.set(14, H0, -11); world.add(g); mesh(new THREE.BoxGeometry(2, 1.3, 1.2), M(0x6b7a3a), 0, .65, 0, g); mesh(new THREE.CylinderGeometry(.12, .12, 1.2, 6), M(0x333333), .6, 1.6, 0, g); addCol(14, -11, 1.3); }
  buildStreets();
  campLight = new THREE.PointLight(0xffd9a0, 0, 90, 0); campLight.position.set(0, H0 + 16, 10); world.add(campLight);
  smokeGroup = new THREE.Group(); smokeGroup.position.set(SPOTS.smoke.x, H0, SPOTS.smoke.z); smokeGroup.rotation.y = SHOP.cook.ry; world.add(smokeGroup);
}
function dressSmokehouse(lv) {
  smokeGroup.clear();
  const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a6c50 });
  for (const [x, z] of [[-1.2, -.6], [1.2, -.6], [-1.2, .6], [1.2, .6]]) mesh(new THREE.BoxGeometry(.14, 2.2, .14), wood, x, 1.1, z, smokeGroup);
  for (const z of [-.3, .3]) mesh(new THREE.BoxGeometry(2.6, .08, .08), wood, 0, 2, z, smokeGroup);
  const strips = 3 + lv * 4;
  for (let i = 0; i < strips; i++) { const s = mesh(new THREE.BoxGeometry(.18, rr(.5, .8), .05), M(pick([0x8a3a2a, 0x7a2e22, 0x9a4a30])), -1.1 + i * (2.2 / strips), 1.65, i % 2 ? .3 : -.3, smokeGroup); s.rotation.z = rr(-.1, .1); }
  if (lv >= 1) { const roof = mesh(new THREE.BoxGeometry(3.2, .12, 2), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x7a7a72 }), 0, 2.4, 0, smokeGroup); roof.rotation.x = .15; }
  if (lv >= 2) { for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.1, 2.2, 1.6), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a8070 }), s * 1.4, 1.1, 0, smokeGroup); mesh(new THREE.CylinderGeometry(.18, .18, 1.2, 8), M(0x3a3a3a), .8, 3, -.4, smokeGroup); }
  addCol(SPOTS.smoke.x, SPOTS.smoke.z, 1.5);
}

/* outside: debris field, shelters, clan village, escape pod, the sealed mountain door */
function buildNearby() {
  // hull fragments in the debris field
  for (let i = 0; i < 16; i++) {
    const x = rr(-46, 46), z = rr(82, 150); if (pathDist(x, z) < 4) continue;
    const y = heightAt(x, z);
    const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(1, 1);
    const kind = rnd();
    let m;
    if (kind < .45) { m = mesh(new THREE.CylinderGeometry(rr(1.5, 3), rr(1.5, 3), rr(3, 7), 10, 1, true, 0, Math.PI * rr(.6, 1)), new THREE.MeshLambertMaterial({ map: t, color: 0xb2aea6, side: THREE.DoubleSide }), x, y + .5, z, world); m.rotation.set(rr(-.6, .6), rnd() * 6, Math.PI / 2 + rr(-.4, .4)); addCol(x, z, 2); }
    else if (kind < .8) { m = mesh(new THREE.BoxGeometry(rr(2, 5), rr(.2, .5), rr(2, 4)), new THREE.MeshLambertMaterial({ map: t, color: 0xa8a49c }), x, y + .8, z, world); m.rotation.set(rr(-1.2, 1.2), rnd() * 6, rr(-.6, .6)); addCol(x, z, 1.6); }
    else { const gg = mesh(lattice(1.2, rr(5, 9), 0x5a5853, 1.6), VCOL, x, y - 1, z, world); gg.rotation.set(rr(.6, 1.2), rnd() * 6, 0); addCol(x, z, 1); }
  }
  // shelters you can get under when the fog comes
  for (const s of SHELTERS) {
    const g = new THREE.Group(); g.position.set(s.x, heightAt(s.x, s.z), s.z); g.rotation.y = rnd() * 6; world.add(g); s.g = g;
    if (s.kind === 'bus') {
      const rust = new THREE.MeshLambertMaterial({ map: texCorr, color: 0x9a5a36 });
      mesh(new THREE.BoxGeometry(2.6, .2, 9), M(0x3a2a20), 0, .6, 0, g);
      for (const sd of [-1, 1]) mesh(new THREE.BoxGeometry(.15, 1.3, 9), rust, sd * 1.25, 1.3, 0, g);
      for (const sd of [-1, 1]) for (let k = -3; k <= 3; k++) mesh(new THREE.BoxGeometry(.12, 1, .2), rust, sd * 1.25, 2.4, k * 1.25, g);
      mesh(new THREE.BoxGeometry(2.7, .2, 9.2), rust, 0, 2.95, 0, g);
      mesh(new THREE.BoxGeometry(2.6, 2.4, .15), rust, 0, 1.75, -4.5, g);
      for (const [x, z] of [[-1.3, -3], [1.3, -3], [-1.3, 3], [1.3, 3]]) mesh(new THREE.CylinderGeometry(.5, .5, .3, 10), M(0x1a1a1a), x, .45, z, g).rotation.z = Math.PI / 2;
      g.rotation.z = rr(-.06, .06);
      s.r = 4.6;
      const c = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y);
      for (const k of [-3.2, 0, 3.2]) for (const sd of [-1.25, 1.25]) addCol(s.x + sd * c + k * sn, s.z - sd * sn + k * c, .3);
    } else if (s.kind === 'cave') {
      for (let i = 0; i < 7; i++) { const a = -1.3 + i * .43; const r = rr(2.2, 3.2); mesh(new THREE.DodecahedronGeometry(r, 0), M(0x6f6c66), Math.sin(a) * 3.4, r * .6, -Math.cos(a) * 3.4, g).rotation.set(rnd(), rnd(), rnd()); }
      mesh(new THREE.DodecahedronGeometry(4, 0), M(0x66635d), 0, 4.2, -1, g).scale.set(1.3, .6, 1);
      mesh(new THREE.CircleGeometry(1.8, 10), M(0x0e0d0c), 0, 1.6, 2.2, g);
      s.r = 4.2;
      for (let i = 0; i < 7; i++) { const a = -1.3 + i * .43 + g.rotation.y; addCol(s.x + Math.sin(a) * 3.4, s.z - Math.cos(a) * 3.4, 1.6); }
    } else {
      mesh(new THREE.BoxGeometry(5, .25, 4), new THREE.MeshLambertMaterial({ map: texConcrete }), 0, .1, 0, g);
      for (const [x, z, w, d] of [[-2.4, 0, .3, 4], [2.4, 0, .3, 4], [0, -1.9, 5, .3]]) mesh(new THREE.BoxGeometry(w, 2.6, d), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xb0aaa0 }), x, 1.3, z, g);
      const r = mesh(new THREE.BoxGeometry(5.6, .3, 4.6), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a7a68 }), 0, 2.75, 0, g); r.rotation.x = .08;
      s.r = 3.8;
      const c = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y);
      for (const [lx, lz] of [[-2.4, -1], [-2.4, 1], [2.4, -1], [2.4, 1], [-1.2, -1.9], [1.2, -1.9]]) addCol(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, .45);
    }
  }
  // clan village: hide tents, totems, a palisade of sharpened logs, a fire
  { const V = POI.village, y = heightAt(V.x, V.z);
    const hide = [0x7a5a3e, 0x6a4a32, 0x8a6a48];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + .3, r = rr(9, 14), x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
      const t = mesh(new THREE.ConeGeometry(2.6, 4.4, 7), M(pick(hide)), x, heightAt(x, z) + 2.1, z, world);
      for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(.05, .05, 1.4, 4), M(0x3a2a1a), x + rr(-.2, .2), heightAt(x, z) + 4.6, z + rr(-.2, .2), world).rotation.set(rr(-.4, .4), 0, rr(-.4, .4));
      addCol(x, z, 2.3);
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2, x = V.x + Math.cos(a) * 5, z = V.z + Math.sin(a) * 5, ty = heightAt(x, z);
      const g = new THREE.Group(); g.position.set(x, ty, z); g.rotation.y = -a + Math.PI / 2; world.add(g);
      for (let k = 0; k < 3; k++) { mesh(new THREE.BoxGeometry(.8, 1.1, .8), M(pick([0x5a4030, 0x6a4a36])), 0, .55 + k * 1.1, 0, g); mesh(new THREE.BoxGeometry(.5, .14, .05), M(0x101010), 0, .75 + k * 1.1, .42, g); }
      mesh(new THREE.BoxGeometry(1.6, .14, .14), M(0xd9d0bd), 0, 3.4, 0, g);
      addCol(x, z, .6);
    }
    for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2; if (Math.abs(angWrap(a - Math.atan2(-V.z, -V.x))) < .25) continue;
      const x = V.x + Math.cos(a) * 21, z = V.z + Math.sin(a) * 21; const l = mesh(new THREE.CylinderGeometry(.01, .28, rr(3, 4.4), 5), M(0x6a5038), x, heightAt(x, z) + 1.6, z, world); l.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); addCol(x, z, .4); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.8, 7), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); fl.position.set(V.x, y + .9, V.z); world.add(fl);
    DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 13) * .2; });
    const vl = new THREE.PointLight(0xff8a3a, 1.6, 24, 0); vl.position.set(V.x, y + 3, V.z); world.add(vl);
    addCol(V.x, V.z, 1.2);
  }
  // escape pod: scorched capsule, chute caught on the trees, beacon smoke
  { const P0 = POI.pod, y = heightAt(P0.x, P0.z);
    const g = new THREE.Group(); g.position.set(P0.x, y, P0.z); g.rotation.set(.35, 1, .15); world.add(g);
    mesh(new THREE.CylinderGeometry(1, 2.2, 3.2, 12), new THREE.MeshLambertMaterial({ map: texPanel, color: 0xcfcac0 }), 0, 1.6, 0, g);
    mesh(new THREE.CylinderGeometry(2.25, 2.25, .45, 12), M(0x2a221c), 0, .1, 0, g);
    mesh(new THREE.BoxGeometry(1, 1.2, .1), M(0x111111), 0, 1.6, 1.75, g).rotation.x = -.35;
    const chute = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 6, 0, Math.PI * 2, 0, 1.2), M(0xd8742c, { side: THREE.DoubleSide }));
    chute.position.set(P0.x - 6, y + 7, P0.z + 4); chute.rotation.set(.8, 0, .6); chute.castShadow = true; world.add(chute);
    addCol(P0.x, P0.z, 2.4);
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(rr(.6, 1.2), 6, 4), new THREE.MeshLambertMaterial({ color: 0xdcd6cc, transparent: true, opacity: .35, depthWrite: false })); p.userData.k = i / 14; world.add(p); beaconSmoke.push(p); }
  }
  // the sealed door in the mountain
  { const V = POI.vault, y = heightAt(V.x, V.z + 12);
    const g = new THREE.Group(); g.position.set(V.x, y, V.z); g.rotation.y = Math.atan2(-V.x, -V.z) + Math.PI; g.lookAt(0, y, 0); world.add(g);
    mesh(new THREE.BoxGeometry(18, 14, 6), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x9a968e }), 0, 6, -2, g);
    const door = mesh(new THREE.CylinderGeometry(4.6, 4.6, .9, 28), new THREE.MeshLambertMaterial({ color: 0x7c7f80 }), 0, 5.2, 1.4, g); door.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mesh(new THREE.BoxGeometry(.5, .5, .5), M(0x55585a), Math.cos(a) * 3.9, 5.2 + Math.sin(a) * 3.9, 1.95, g); }
    for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(1, 2.4, .1), M(i % 2 ? 0x1a1a1a : 0xd9a32a), -7.6 + i * .6, 1.2, 1.05, g).rotation.z = .5;
    vaultLamp = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); vaultLamp.position.set(5.6, 10.6, 1.2); g.add(vaultLamp);
    mesh(new THREE.BoxGeometry(1.2, .5, .5), M(0x333333), -5.6, 10.6, 1.2, g);
    addCol(V.x, V.z, 7);
    const dr = new THREE.Vector3(0, 0, 3).applyQuaternion(g.quaternion); POI.vaultFront = { x: V.x + dr.x * 2.2, z: V.z + dr.z * 2.2 };
  }
}

/* scrap pickups: little glinting panels */
const scrapGeo = new THREE.BoxGeometry(.7, .12, .5);
function spawnScrap(x, z, tag) {
  const g = new THREE.Group(); g.position.set(x, heightAt(x, z) + .25, z); world.add(g);
  mesh(scrapGeo, M(pick([0x9ca2a6, 0xb0905a, 0x8a96a0])), 0, 0, 0, g).rotation.set(rr(-.3, .3), rnd() * 6, rr(-.3, .3));
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(.16), new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); glint.position.y = .55; g.add(glint);
  const S = { x, z, g, glint, tag, alive: true, ph: rnd() * 6 };
  SCRAPS.push(S); return S;
}
function seedScraps() {
  for (let i = 0; i < 9; i++) spawnScrap(rr(-40, 40), rr(82, 146), 'field');
  for (let i = 0; i < 110; i++) { const a = rnd() * Math.PI * 2, r = rr(96, VALLEY - 20); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) > 110 || waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'wild'); }
}
