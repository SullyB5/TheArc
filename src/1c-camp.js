
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
/* the Arc: the main hull, walk-in. One big blast door faces the yard; inside there's a deck, a ramp up to a catwalk along
   the south wall, and a firing slit the whole length — the place you fall back to when the walls go.
   (Nov 10) It came down hard and it looks it: the skin is dented and wavy, the roof has settled flatter in places, ribs are
   bent or snapped, and it's patched in mismatched plate. The east end doesn't stop: the hull carries on through a buckled
   joint into the east wing, which bends round to the south (to your right as you face the door) — walk-in too, part of the
   holdout. The two side modules came down outside the wall; the spire stuck nose-first behind the hull. */
const ARC = { x: 0, z: -36, R: 11, LW: 36, LE: 24, C: 4.5, W: 10, DOOR: 4.2, WALK: 7.5, SLIT0: 8.2, SLIT1: 9.7 };
// the east wing's centreline: out of the east end, a short neck, a bend round to the south, then straight on
const WING = (() => {
  const R = 9, C = 3.4, W = Math.sqrt(R * R - C * C), Rb = 12.5, TH = 1.25, NECK = 2.5, LS = 9;
  const x0 = ARC.x + ARC.LE, z0 = ARC.z, pts = [];
  let s = 0;
  const push = (x, z, tx, tz) => { const q = pts[pts.length - 1]; if (q) s += Math.hypot(x - q.x, z - q.z); pts.push({ x, z, tx, tz, nx: -tz, nz: tx, s }); };
  for (let d = 0; d < NECK; d += .5) push(x0 + d, z0, 1, 0);
  const cx = x0 + NECK, cz = z0 + Rb, na = Math.ceil(TH * Rb / .5);
  for (let i = 0; i < na; i++) { const a = i / na * TH; push(cx + Rb * Math.sin(a), cz - Rb * Math.cos(a), Math.cos(a), Math.sin(a)); }
  const ex = cx + Rb * Math.sin(TH), ez = cz - Rb * Math.cos(TH), tx = Math.cos(TH), tz = Math.sin(TH);
  for (let d = 0; d <= LS + 1e-6; d += .5) push(ex + tx * d, ez + tz * d, tx, tz);
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (const p of pts) for (const k of [-1, 1]) { const x = p.x + p.nx * k * (W + 1), z = p.z + p.nz * k * (W + 1); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  return { R, C, W, pts, len: s, end: pts[pts.length - 1], bx0, bx1, bz0, bz1 };
})();
function inWing(x, z) {
  if (x < ARC.x + ARC.LE - .2 || x > WING.bx1 || z < WING.bz0 || z > WING.bz1) return false;
  const P = WING.pts; let bd = 1e9, bi = 0;
  for (let i = 0; i < P.length; i++) { const d = (x - P[i].x) ** 2 + (z - P[i].z) ** 2; if (d < bd) { bd = d; bi = i; } }
  const p = P[bi], ax = x - p.x, az = z - p.z, along = ax * p.tx + az * p.tz;
  if ((bi === P.length - 1 && along > 0) || (bi === 0 && along < -.2)) return false;
  return Math.abs(ax * p.nx + az * p.nz) < WING.W + .3;
}
const ARC_CORE = { x: ARC.x + 14, z: ARC.z - 5 };
const hullDoor = { open: true, hp: 520, max: 520, t: 1 };
let hullDoors = [];
const inHull = (x, z) => (x - ARC.x > -ARC.LW && x - ARC.x < ARC.LE && Math.abs(z - ARC.z) < ARC.W + .3) || inWing(x, z);
const ARC_DOOR_OUT = { x: ARC.x, z: ARC.z + ARC.W + 2.6 }, ARC_DOOR_IN = { x: ARC.x, z: ARC.z + ARC.W - 3 };
function hullCollide(o, rad) {
  const lx = o.x - ARC.x, lz = o.z - ARC.z, Wd = ARC.W + .3;
  if (Math.abs(lx) < ARC.DOOR + .2 && Math.abs(lz - Wd) < rad + .35 && !(hullDoor.open || hullDoor.hp <= 0)) {
    const inside = (o.phz ?? lz) < Wd;
    o.z = ARC.z + (inside ? Wd - rad - .35 : Wd + rad + .35);
  }
  o.phz = o.z - ARC.z;
}
// the hull's own random stream, so reshaping it never moves anything else in the world
let ARC_S = 90210;
const arnd = () => (ARC_S = (ARC_S * 16807) % 2147483647, (ARC_S - 1) / 2147483646), arr = (a, b) => a + arnd() * (b - a), apick = a => a[Math.floor(arnd() * a.length)];
/* how far the skin sits off a true cylinder at (x along the hull, direction sy = sin θ up, sz = cos θ south): the roof has
   settled flatter and wavy, the north side and roof are dented; the low south wall (door, slit, catwalk) stays true, and
   the ends ease back to round so the bulkheads still fit */
const HULL_DENTS = [];
function hullOff(x, sy, sz) {
  const h = ARC.C + ARC.R * sy, th = Math.atan2(sy, sz);
  const ends = smooth(-ARC.LW, -ARC.LW + 5, x) * smooth(ARC.LE, ARC.LE - 4, x);
  const roof = smooth(ARC.SLIT1 + .6, ARC.SLIT1 + 3.2, h), north = sz < 0 ? smooth(1.2, 4, h) * smooth(0, -.35, sz) : 0;
  let o = -.75 * Math.max(0, sy) ** 4 * (.55 + .45 * Math.sin(x * .07 + 1.3));
  o += .26 * Math.sin(x * .11 + th * 2.1) + .13 * Math.sin(x * .29 - th * 3.7);
  o -= 1.1 * Math.max(0, sy) ** 2 * (.5 + .5 * Math.sin(x * .05 - .4));          // the roofline sags in long stretches
  o += .45 * Math.max(0, sy) * -sz;                                              // and leans a little to the north
  for (const xc of [-14.5, 8.5]) o -= .5 * Math.exp(-(((x - xc) / .9) ** 2));      // two creases where it buckled on impact
  for (const D of HULL_DENTS) { const dx = x - D.x, da = (th - D.a) * ARC.R; o -= D.d * Math.exp(-(dx * dx + da * da) / (D.r * D.r)); }
  return o * Math.max(roof, north * .6) * ends + .05 * Math.sin(x * 1.9 + th * 7) * ends;
}
// push every vertex of a geometry (in the hull's frame) off true by hullOff
function hullDent(geo, scale = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z); if (r < 1) continue; const k = (r + hullOff(x, y / r, z / r) * scale) / r; p.setY(i, y * k); p.setZ(i, z * k); }
  p.needsUpdate = true; geo.computeVertexNormals(); return geo;
}
function hullShell(t0, t1, x0, x1, mat, rOff = 0) {
  const geo = new THREE.CylinderGeometry(ARC.R + rOff, ARC.R + rOff, x1 - x0, Math.max(3, Math.ceil((t1 - t0) * 9)), Math.max(1, Math.ceil((x1 - x0) / 1.5)), true, t0, t1 - t0);
  geo.rotateZ(Math.PI / 2); geo.translate((x0 + x1) / 2, 0, 0); hullDent(geo);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
}
// the wing's skin off true: same idea, along the bend (s = metres along the centreline, phi = angle round from the floor)
const WING_DENTS = [];
function wingOff(s, phi) {
  const h = WING.C + WING.R * Math.sin(phi), ends = smooth(0, 4, s) * smooth(WING.len, WING.len - 3, s), roof = smooth(5.5, 9.5, h);
  let o = -.6 * Math.max(0, Math.sin(phi)) ** 4 * (.5 + .5 * Math.sin(s * .13 + .4)) + .22 * Math.sin(s * .17 + phi * 2.3) + .1 * Math.sin(s * .41 - phi * 3.1);
  for (const D of WING_DENTS) { const ds = s - D.s, da = (phi - D.a) * WING.R; o -= D.d * Math.exp(-(ds * ds + da * da) / (D.r * D.r)); }
  return o * roof * ends + .05 * Math.sin(s * 2.1 + phi * 6) * ends;
}
// a sheet that follows the wing's skin: rOff out from it, between angles phi0..phi1, from s0 to s1 along it
function wingSkin(rOff, phi0, phi1, s0 = 0, s1 = WING.len, nphi = 40) {
  const P = WING.pts.filter(p => p.s >= s0 - 1e-6 && p.s <= s1 + 1e-6), pos = [], uv = [], idx = [];
  for (const p of P) for (let j = 0; j <= nphi; j++) {
    const ph = lerp(phi0, phi1, j / nphi), r = WING.R + rOff + wingOff(p.s, ph), c = Math.cos(ph) * r;
    pos.push(p.x + p.nx * c, WING.C + Math.sin(ph) * r, p.z + p.nz * c); uv.push(p.s / 5, ph * WING.R / 5);
  }
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < nphi; j++) { const a = i * (nphi + 1) + j, b = a + nphi + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildArc() {
  const g = new THREE.Group(); g.position.set(ARC.x, H0 + ARC.C, ARC.z); world.add(g);
  const R = ARC.R, LW = ARC.LW, LE = ARC.LE, C = ARC.C;
  for (let i = 0; i < 8; i++) HULL_DENTS.push({ x: arr(-LW + 6, LE - 5), a: arr(.95, 2.6), r: arr(1.6, 3.2), d: arr(.35, .9) });
  for (let i = 0; i < 4; i++) WING_DENTS.push({ s: arr(5, WING.len - 4), a: arr(.9, 2.3), r: arr(1.5, 2.8), d: arr(.3, .8) });
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set((LW + LE) / 5, 5);
  const hullMat = new THREE.MeshStandardMaterial({ map: t, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xc4c2bb, metalness: .45, roughness: .62, side: THREE.DoubleSide });
  // angles: world z = R cos θ (south = 0), y = R sin θ (top = π/2)
  const tFloor = -Math.asin(C / R), tDoor = Math.asin((6.6 - C) / R), tS0 = Math.asin((ARC.SLIT0 - C) / R), tS1 = Math.asin((ARC.SLIT1 - C) / R);
  g.add(hullShell(tS1, Math.PI * 2 + tFloor, -LW, LE, hullMat));             // roof, north wall
  g.add(hullShell(tDoor, tS0, -LW, LE, hullMat));                            // band between the door and the slit
  g.add(hullShell(tFloor, tDoor, -LW, -ARC.DOOR, hullMat));                  // south wall, either side of the door
  g.add(hullShell(tFloor, tDoor, ARC.DOOR, LE, hullMat));
  // patches: plate welded over the holes, none of it matching — primer, bare steel, rust, a scorched stretch
  const patchM = [0x8a5a44, 0x6e7276, 0x9a948a, 0x5a5e58, 0xa8a49a, 0x7a4a36].map(c => new THREE.MeshStandardMaterial({ map: TX.metal, color: c, metalness: .45, roughness: .7 }));
  const scorch = new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x3a3631, metalness: .3, roughness: .92 });
  for (let i = 0; i < 16; i++) {
    const w = arr(1.6, 4.5), x = arr(-LW + 2, LE - 2 - w), south = arnd() < .3, a0 = south ? arr(tS1 + .04, 1.2) : arr(.9, 3.1), da = arr(.12, .38);
    g.add(hullShell(a0, a0 + da, x, x + w, apick(patchM), .05 + i * .002));
  }
  g.add(hullShell(1.7, 2.6, 8, 19, scorch, .04)); g.add(hullShell(.6, 1.15, -31, -24, scorch, .045));
  // the slit: posts every few metres, and a dark lip
  for (let x = -LW + 2; x < LE - 1; x += 3.2) { const y = (ARC.SLIT0 + ARC.SLIT1) / 2 - C; mesh(new THREE.BoxGeometry(.35, ARC.SLIT1 - ARC.SLIT0 + .3, .5), S(0x55554f, { metalness: .5 }), x, y, Math.sqrt(R * R - y * y), g); }
  // west bulkhead: a disc with a sealed hatch
  { const cap = mesh(new THREE.CircleGeometry(R, 44), S(0x6d6e6c, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), -LW, 0, 0, g); cap.rotation.y = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(R * .42, .35, 6, 18), M(0x3a3a38), -(LW + .3), -R * .1, 0, g); ring.rotation.y = Math.PI / 2;
    mesh(new THREE.CircleGeometry(R * .4, 18), M(0x2a2a28, { side: THREE.DoubleSide }), -(LW + .25), -R * .1, 0, g).rotation.y = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mesh(new THREE.BoxGeometry(.4, .6, .6), M(0x55585a), -(LW + .45), -R * .1 + Math.sin(a) * R * .42, Math.cos(a) * R * .42, g); } }
  // east end: a bulkhead ring round the opening into the wing, and a buckled collar where the two sections meet
  { const sh = new THREE.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, WING.C - C, WING.R + .05, 0, Math.PI * 2, true); sh.holes.push(hole);
    const cap = mesh(new THREE.ShapeGeometry(sh, 40), S(0x6d6e6c, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), LE, 0, 0, g); cap.rotation.y = Math.PI / 2;
    for (const [dx, r, th] of [[.15, WING.R + .25, .45], [1.4, WING.R + .55, .6], [2.4, WING.R + .35, .4]]) {
      const tg = new THREE.TorusGeometry(r, th, 6, 40); const pa = tg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const a = Math.atan2(pa.getY(i), pa.getX(i)); pa.setZ(i, pa.getZ(i) + Math.sin(a * 3 + dx) * .25); }
      tg.computeVertexNormals(); const col = mesh(tg, S(dx > 1 ? 0x8a8478 : 0x4a4a46, { map: TX.metal, metalness: .55 }), LE + dx, WING.C - C, 0, g); col.rotation.y = Math.PI / 2; col.rotation.x = arr(-.05, .05);
    } }
  // ribs outside: bent with the skin, a couple missing, a couple snapped off short; fins on the ones still whole
  const ribM = S(0xd8d8d0, { metalness: .5, roughness: .45 });
  for (let x0 = -LW + 3; x0 < LE - 1.5; x0 += 6) {
    if (arnd() < .1) continue;
    const x = x0 + arr(-.8, .8), broken = arnd() < .22, arc = broken ? Math.PI * arr(.4, .72) : Math.PI;
    const tg = new THREE.TorusGeometry(R + .5 + arr(-.1, .15), .4, 5, 24, arc);
    if (broken && arnd() < .5) tg.rotateZ(Math.PI - arc);
    tg.rotateY(Math.PI / 2); tg.rotateX(arr(-.04, .04)); tg.translate(x, 0, 0); hullDent(tg);
    mesh(tg, ribM, 0, 0, 0, g);
    if (!broken) { const fin = mesh(new THREE.BoxGeometry(.45, 3.4, 1.1), ribM, x, R + 2 + hullOff(x, 1, 0), 0, g); fin.rotation.z = arr(-.3, .3); fin.rotation.x = arr(-.12, .12); }
  }
  for (let i = 0; i < 6; i++) { const x = arr(-LW * .8, LE * .8); const p = mesh(new THREE.BoxGeometry(arr(6, 11), .5, arr(6, 9)), M(0x8e9294), x, R + .3 + hullOff(x, 1, 0), arr(-2.5, 2.5), g); p.rotation.set(arr(-.35, .35), arnd(), arr(-.3, .3)); }
  // door frame + "ARC" stencil over it
  const fr = S(0x3c3d3e, { metalness: .6 });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.6, 6.9, 1.2), fr, s * (ARC.DOOR + .3), 6.9 / 2 - C, Math.sqrt(R * R - 1) - .2, g);
  mesh(new THREE.BoxGeometry(ARC.DOOR * 2 + 1.2, .6, 1.4), fr, 0, 6.7 - C, Math.cos(tDoor) * R - .1, g);
  for (let i = 0; i < 10; i++) mesh(new THREE.BoxGeometry(.6, .5, .08), M(i % 2 ? 0x1a1a1a : 0xd9a32a), -ARC.DOOR + .4 + i * .85, 7.2 - C, Math.cos(Math.asin((7.2 - C) / R)) * R + .05, g);
  { const sy = (12.4 - C) / R, sz = Math.sqrt(1 - sy * sy), rs = R + hullOff(0, sy, sz);
    const arcSign = mesh(new THREE.BoxGeometry(9, 1.6, .15), [M(0x2a2826), M(0x2a2826), M(0x2a2826), M(0x2a2826), new THREE.MeshLambertMaterial({ map: signTex('THE ARC') }), M(0x2a2826)], 0, rs * sy, rs * sz + .5, g);
    arcSign.rotation.x = -Math.asin(sy) * .85; arcSign.rotation.z = .025; }
  // blast doors: two slabs that slide into the hull
  for (const s of [-1, 1]) {
    const d = new THREE.Group(); g.add(d);
    const slab = mesh(new THREE.BoxGeometry(ARC.DOOR, 6.5, .35), S(0x6a6e70, { map: TX.metal, metalness: .55, roughness: .5 }), 0, 6.5 / 2 - C, 0, d);
    for (const y of [1, 3.2, 5.4]) mesh(new THREE.BoxGeometry(ARC.DOOR - .3, .25, .12), M(0x3a3d3f), 0, y - C, .22, d);
    for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(.25, 1.6, .1), M(k % 2 ? 0x1a1a1a : 0xd9a32a), s * -(ARC.DOOR / 2 - .3), .9 + k * .4 - C, .24, d).rotation.z = .6;
    hullDoors.push({ g: d, s, slab });
  }
  // ---- inside ----
  const deckT = texPanel.clone(); deckT.needsUpdate = true; deckT.repeat.set((LW + LE) / 6, ARC.W / 3);
  const deckM = new THREE.MeshLambertMaterial({ map: deckT, color: 0x8a8c88 });
  mesh(new THREE.BoxGeometry(LW + LE, .14, ARC.W * 2 + .2), deckM, (LE - LW) / 2, .07 - C, 0, g);
  // catwalk along the south wall + ramp up from the west end
  const walkZ = ARC.W - 1.25, walkHD = 1.45, steel = M(0x4a4c4e), grate = new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a6c6c });
  const wx0 = -10, wx1 = LE - 1.2, rx0 = -LW + 1.8;
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
  // (Nov 10) with Bryce's props loaded the bunks, lockers and strip lights are models (dressArc in 1h-props.js); the hull's own draws still run so nothing else moves
  const propsIn = MODELS['props/bed'] != null;
  for (let i = 0; i < 6; i++) { const x = -24 + i * 3.4, z = -ARC.W + 1.4, ry = arr(-.05, .05), cs = [apick([0x6a7a5a, 0x8a8a80, 0x5a6a7a]), apick([0x6a7a5a, 0x8a8a80, 0x5a6a7a])]; if (propsIn) continue;
    const b = new THREE.Group(); b.position.set(x, -C, z); b.rotation.y = ry; g.add(b);
    [.5, 1.8].forEach((y, k) => { mesh(new THREE.BoxGeometry(2.2, .14, 1), M(0x5a5e60), 0, y, 0, b); mesh(new THREE.BoxGeometry(2, .16, .9), M(cs[k]), 0, y + .14, 0, b); });
    for (const sx of [-1.05, 1.05]) mesh(new THREE.BoxGeometry(.08, 2.4, .08), M(0x3a3a3a), sx, 1.2, .45, b);
    addCol(ARC.x + x, ARC.z + z, 1); }
  for (let i = 0; i < 8; i++) { const x = -4 + i * 1.1, z = -ARC.W + .7, cl = apick([0x5a6a7a, 0x6a6e70, 0x4a5a6a]), ry = arr(-.06, .06); if (!propsIn) mesh(new THREE.BoxGeometry(1, 2.2, .6), M(cl), x, 1.1 - C, z, g).rotation.y = ry; }
  addColLine(ARC.x - 4, ARC.z - ARC.W + .7, ARC.x + 4, ARC.z - ARC.W + .7, .6);
  for (const [x, z] of [[-14, 2], [-12, -2.5], [6, 3], [20, 4], [-22, 3]]) { if (propsIn) { arr(-.3, .3); continue; }   // (Nov 11) the fitted-out base has its own stores (fitArc in 1h-props.js)   // the passages stand there now
    mesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), M(0x4f5a3a), x, .55 - C, z, g).rotation.y = arr(-.3, .3); mesh(new THREE.BoxGeometry(1.1, .9, .9), M(0x5a4a36), x + .2, 1.55 - C, z, g).rotation.y = .4; addCol(ARC.x + x, ARC.z + z, .9); }
  // strip lights + one warm lamp so it isn't a cave
  const strip = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  for (let x = -LW + 4; x < LE - 2; x += 8) { const rz = arr(-.04, .04); if (propsIn) continue; const l = mesh(new THREE.BoxGeometry(2.4, .1, .25), strip, x, R + hullOff(x, 1, 0) - 1.3, 0, g); l.castShadow = false; l.rotation.z = rz; }
  const hl = new THREE.PointLight(0xffd8a0, 2.4, 52, 1.2); hl.position.set(-4, R - 3, 0); g.add(hl);
  // collision: the shell (bullets pass over the south side above 8 m — that's the slit), the west end, the east end round
  // the opening into the wing, a gap for the door
  const zS = ARC.z + ARC.W + .3, zN = ARC.z - ARC.W - .3;
  addColLine(ARC.x - LW, zN, ARC.x + LE, zN, .6);
  for (const [a, b] of [[-LW, -ARC.DOOR - .4], [ARC.DOOR + .4, LE]]) { const n = Math.ceil((b - a) / .8); for (let i = 0; i <= n; i++) addCol(ARC.x + lerp(a, b, i / n), zS, .6, 8); }
  addColLine(ARC.x - LW - .3, zN, ARC.x - LW - .3, zS, .6);
  addColLine(ARC.x + LE + .3, zN, ARC.x + LE + .3, ARC.z - WING.W - .4, .6); addColLine(ARC.x + LE + .3, ARC.z + WING.W + .4, ARC.x + LE + .3, zS, .6);

  // ---- the east wing: out of the east end and round to the south ----
  const wg = new THREE.Group(); wg.position.set(0, H0, 0); world.add(wg);
  const wt = texPanel.clone(); wt.needsUpdate = true; wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const wingMat = new THREE.MeshStandardMaterial({ map: wt, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xbcb8ae, metalness: .45, roughness: .66, side: THREE.DoubleSide });
  const ph0 = -Math.asin(WING.C / WING.R) - .02, ph1 = Math.PI - ph0;
  { const m = new THREE.Mesh(wingSkin(0, ph0, ph1), wingMat); m.castShadow = m.receiveShadow = true; wg.add(m); }
  for (let i = 0; i < 9; i++) { const s0 = arr(2, WING.len - 5), a0 = arr(.5, 2.4); const m = new THREE.Mesh(wingSkin(.05 + i * .002, a0, a0 + arr(.15, .4), s0, s0 + arr(1.5, 4), 6), apick(patchM)); m.castShadow = true; wg.add(m); }
  { const m = new THREE.Mesh(wingSkin(.04, 1.6, 2.4, WING.len * .45, WING.len * .8, 10), scorch); wg.add(m); }
  // the deck, following the bend
  { const pos = [], uv = [], idx = [], P = WING.pts;
    P.forEach((p, i) => { for (const k of [-1, 1]) { pos.push(p.x + p.nx * k * (WING.W + .2), .14, p.z + p.nz * k * (WING.W + .2)); uv.push(p.s / 3, k * WING.W / 3); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); dg.setIndex(idx); dg.computeVertexNormals();
    const dt2 = texPanel.clone(); dt2.needsUpdate = true; dt2.wrapS = dt2.wrapT = THREE.RepeatWrapping;
    const dm = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ map: dt2, color: 0x8a8c88, side: THREE.DoubleSide })); dm.receiveShadow = true; wg.add(dm); }
  // its far end: a bulkhead with a hatch that's been welded shut, a little out of square
  { const e = WING.end, yaw = Math.atan2(e.tx, e.tz);
    const cap = mesh(new THREE.CircleGeometry(WING.R + .05, 40), S(0x666864, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), e.x, WING.C, e.z, wg); cap.rotation.set(.03, yaw, .02);
    const hg = new THREE.Group(); hg.position.set(e.x + e.tx * .3, WING.C - 1.4, e.z + e.tz * .3); hg.rotation.y = yaw; wg.add(hg);
    mesh(new THREE.TorusGeometry(2.1, .3, 6, 18), M(0x3a3a38), 0, 0, 0, hg); mesh(new THREE.CircleGeometry(2, 18), M(0x2a2a28), 0, 0, -.05, hg);
    for (let k = 0; k < 7; k++) { const b = mesh(new THREE.BoxGeometry(.18, 1.2, .12), M(0x6a5a4a), arr(-1.6, 1.6), arr(-1.4, 1.4), .12, hg); b.rotation.z = arr(-1.2, 1.2); }
    const tc = new THREE.TorusGeometry(WING.R + .35, .45, 6, 40); const tcol = mesh(tc, ribM, e.x - e.tx * .4, WING.C, e.z - e.tz * .4, wg); tcol.rotation.y = yaw; }
  // ribs round the wing, square to the bend
  for (let s = 4; s < WING.len - 2; s += arr(4.8, 6.2)) {
    const p = WING.pts.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), arc = arnd() < .2 ? Math.PI * arr(.45, .7) : Math.PI;
    const tg = new THREE.TorusGeometry(WING.R + .45 + Math.max(0, wingOff(p.s, Math.PI / 2)), .36, 5, 22, arc); if (arc < Math.PI && arnd() < .5) tg.rotateZ(Math.PI - arc);
    tg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(p.nx, 0, p.nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.tx, 0, p.tz)).setPosition(p.x, WING.C, p.z));
    mesh(tg, ribM, 0, 0, 0, wg);
    if (arc === Math.PI) { const fin = mesh(new THREE.BoxGeometry(.4, 2.8, 1), ribM, p.x, WING.C + WING.R + 1.6 + wingOff(p.s, Math.PI / 2), p.z, wg); fin.rotation.set(arr(-.1, .1), Math.atan2(p.tx, p.tz) + Math.PI / 2, arr(-.3, .3)); }
  }
  for (let i = 0; i < 3; i++) { const p = apick(WING.pts.slice(6, -6)); const pl = mesh(new THREE.BoxGeometry(arr(4, 7), .45, arr(4, 6)), M(0x8e9294), p.x, WING.C + WING.R + .25 + wingOff(p.s, Math.PI / 2), p.z, wg); pl.rotation.set(arr(-.3, .3), arnd() * 3, arr(-.3, .3)); }
  // inside the wing: stores — crates and drums along the walls, a rack of lockers, lights down the spine
  { const P = WING.pts, put = (s, side, f) => { const p = P.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), o = side * (WING.W - 1.3); f(p.x + p.nx * o, p.z + p.nz * o, Math.atan2(p.tx, p.tz)); };
    for (const [s, side] of [[5, 1], [9, -1], [14, 1], [19, -1], [23, -1], [27, 1], [31, -1]]) put(s, side, (x, z, yaw) => {
      mesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), M(apick([0x4f5a3a, 0x5a4a36, 0x4a5a6a])), x, .69, z, wg).rotation.y = yaw + arr(-.3, .3);
      mesh(new THREE.BoxGeometry(1.1, .9, .9), M(0x5a4a36), x + arr(-.2, .2), 1.69, z + arr(-.2, .2), wg).rotation.y = yaw + arr(-.6, .6); addCol(x, z, .9); });
    for (const [s, side] of [[11, 1], [25, 1]]) put(s, side, (x, z, yaw) => { for (let k = -1; k <= 1; k++) { mesh(new THREE.CylinderGeometry(.3, .3, .9, 12), M(apick([0x7a2a22, 0x3a4a3a, 0x5a5e60])), x + Math.cos(yaw) * k * .65, .59, z - Math.sin(yaw) * k * .65, wg); } addCol(x, z, 1.1); });
    put(17, -1, (x, z, yaw) => { const lg = new THREE.Group(); lg.position.set(x, .14, z); lg.rotation.y = yaw + Math.PI / 2; wg.add(lg); for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(1, 2.2, .6), M(apick([0x5a6a7a, 0x6a6e70, 0x4a5a6a])), (k - 1.5) * 1.05, 1.1, 0, lg).rotation.y = arr(-.06, .06); addCol(x, z, 1.6); });
    for (let s = 3; s < WING.len - 2; s += 7) { const p = P.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b); const l = mesh(new THREE.BoxGeometry(.25, .1, 2.4), strip, p.x, WING.C + WING.R + wingOff(p.s, Math.PI / 2) - 1.3, p.z, wg); l.rotation.y = Math.atan2(p.tx, p.tz); l.castShadow = false; } }
  // the wing's walls (round the bend) and its far end
  WING.pts.forEach((p, i) => { if (i % 2) return; for (const k of [-1, 1]) addCol(p.x + p.nx * k * (WING.W + .25), p.z + p.nz * k * (WING.W + .25), .6); });
  { const e = WING.end; addColLine(e.x - e.nx * WING.W, e.z - e.nz * WING.W, e.x + e.nx * WING.W, e.z + e.nz * WING.W, .6); }
  SHELTERS.push({ x: ARC.x, z: ARC.z, kind: 'arc', r: 0, hull: 1 });
  dressArc();
  for (let i = 0; i < 74; i++) rnd();   // the hull used to draw from the world's stream: keep everything after it where it was

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
  // radio mast with loudspeakers, off the hull's west end (the east wing took its old spot)
  const mast = new THREE.Group(); mast.position.set(-44, H0, -40); world.add(mast);
  mesh(lattice(1.6, 26, 0x9a9a96, 2.4), VCOL, 0, 0, 0, mast);
  for (const [a, y] of [[0, 24.5], [2.1, 24.5], [4.2, 23.4]]) {
    const hn = mesh(new THREE.ConeGeometry(.8, 1.4, 10, 1, true), M(0x5d5e5c, { side: THREE.DoubleSide }), Math.sin(a) * 1.3, y, Math.cos(a) * 1.3, mast);
    hn.lookAt(Math.sin(a) * 9, y - 1, Math.cos(a) * 9); hn.rotateX(-Math.PI / 2);
  }
  mesh(new THREE.CylinderGeometry(1, 1, .2, 16), M(0xc9c9c4), 0, 26.3, 0, mast).rotation.x = .5;
  addCol(-44, -40, 1.3);
}
function updHullDoor(dt) {
  const target = hullDoor.hp <= 0 ? .55 : hullDoor.open ? 1 : 0;
  hullDoor.t = lerp(hullDoor.t, target, dt * 1.6);
  const zO = ARC.W - .45;
  for (const d of hullDoors) { d.g.position.set(d.s * (ARC.DOOR / 2 + hullDoor.t * (ARC.DOOR + .2)), 0, zO); d.g.rotation.z = hullDoor.hp <= 0 ? d.s * .08 : 0; }
}

/* the wall (Nov 11): put up from what came down with the Arc — hull plating cut into panels (each its own paint: station
   white, primer, bare steel, scorched), stood between snapped ribs and I-beams, in straight uneven runs round the yard
   (WALL_PTS in 1-world.js). Upgrades add a second course, braces, spikes cut from rib stock, then razor wire. */
const WALL_H = [2.4, 3.6, 4.6, 5.4];
let WL_S = 31337, wallFirst = true;
const wlr = () => (WL_S = (WL_S * 16807) % 2147483647, (WL_S - 1) / 2147483646), wlrr = (a, b) => a + wlr() * (b - a), wlpk = a => a[Math.floor(wlr() * a.length)];
// the wall's line, as short pieces from the gate's east post round to its west post
function wallRun() {
  const P = WALL_PTS, n = P.length, out = [], g0 = { x: GATE_X, z: CAMP_R }, g1 = { x: -GATE_X, z: CAMP_R };
  const pts = [g0, ...P, g1];
  for (let i = 0; i < pts.length - 1; i++) { const A = pts[i], B = pts[i + 1], L = Math.hypot(B.x - A.x, B.z - A.z), k = Math.max(1, Math.round(L / 2.7));
    for (let j = 0; j < k; j++) out.push({ ax: lerp(A.x, B.x, j / k), az: lerp(A.z, B.z, j / k), bx: lerp(A.x, B.x, (j + 1) / k), bz: lerp(A.z, B.z, (j + 1) / k), corner: j === 0 && i > 0 }); }
  return out;
}
function buildWall(level) {
  if (wallFirst) { for (let i = 0; i < 512; i++) rnd(); wallFirst = false; }   // the old wall drew from the world's stream: keep everything after it where it was
  WL_S = 31337;
  if (wallGroup) world.remove(wallGroup);
  wallGroup = new THREE.Group(); world.add(wallGroup);
  const H = WALL_H[level], K = hkit(LOW);
  const paint = [0xd8d6cf, 0xc8c6bf, 0xb8b6ae, 0x9a9890, 0x8a8e90, 0x7c6a58, 0xa06a48, 0x6a6e70, 0xcfc9b4, 0x5e6266];
  const run = wallRun();
  run.forEach((S, i) => {
    const L = Math.hypot(S.bx - S.ax, S.bz - S.az), cx = (S.ax + S.bx) / 2, cz = (S.az + S.bz) / 2, yaw = Math.atan2(S.bz - S.az, S.bx - S.ax), y = heightAt(cx, cz);
    // outward normal (away from the yard)
    const ox = -Math.sin(-yaw), oz = Math.cos(-yaw), sgn = (cx * Math.sin(yaw) * -1 + cz * Math.cos(yaw)) > 0 ? 1 : -1;
    K.at(htm(cx, y, cz, 0, -yaw, 0));
    const short = level === 0 && wlr() < .2 ? wlrr(.65, .85) : wlrr(.95, 1.04), sh = H * short;
    // one plate, or two courses with the upper lapped over; now and then a curved bit of the hull itself
    const col = tint(wlpk(paint), .06);
    if (wlr() < .12) { const g = new THREE.CylinderGeometry(2.2, 2.2, sh + .1, 8, 1, true, -L / 4.4, L / 2.2); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 2, uv.getY(k) * sh / 2); if (sgn < 0) g.rotateY(Math.PI); g.translate(0, (sh + .1) / 2 - .25, (-2.2 + .1) * sgn); K.geo('hull', g, null, col); }
    else if (sh > 3) { K.box('hull', L + .06, sh * .56, .14, 0, sh * .28 - .2, 0, wlrr(-.02, .02), 0, wlrr(-.01, .01), col, 2); K.box('hull', L + .1, sh * .5, .14, 0, sh * .75 - .2, .07 * sgn, wlrr(-.02, .02), 0, wlrr(-.012, .012), tint(wlpk(paint), .06), 2); }
    else K.box('hull', L + .06, sh, .14, 0, sh / 2 - .25, 0, wlrr(-.03, .03), 0, wlrr(-.015, .015), col, 2);
    // seams: a welded strap over each joint, rivet heads along the top
    K.box('metal', .16, sh, .2, -L / 2, sh / 2 - .25, 0, 0, 0, 0, 0x4a4c4e);
    if (wlr() < .3) K.box('metal', L * wlrr(.3, .7), wlrr(.08, .3), .17, wlrr(-.4, .4), wlrr(.4, sh - .5), 0, 0, 0, wlrr(-.1, .1), wlpk([0xd9a32a, 0x2a2a28]));   // a band of hazard paint
    // posts: a snapped rib or an I-beam every couple of panels, at every corner
    if (S.corner || i % 2 === 0) { const ph = H + wlrr(.6, 1.6);
      if (wlr() < .5) { K.box('metal', .34, ph, .1, -L / 2, ph / 2 - .4, .14 * -sgn, 0, 0, 0, 0x55585a); K.box('metal', .1, ph, .34, -L / 2, ph / 2 - .4, (.14 + .12) * -sgn, 0, 0, 0, 0x55585a); K.box('metal', .34, ph, .1, -L / 2, ph / 2 - .4, (.14 + .24) * -sgn, 0, 0, 0, 0x55585a); }
      else { const rc = tint(0xc8c6be, .05); K.box('metal', .3, ph - .8, .55, -L / 2, (ph - .8) / 2 - .4, -.1 * sgn, wlrr(-.04, .04), 0, 0, rc); K.box('metal', .3, 1.5, .5, -L / 2, ph - .65, -.4 * sgn, -.55 * sgn, 0, 0, rc); } }
    if (level >= 1 && i % 2 === 0) K.box('metal', L, .2, .14, 0, sh * .7, (.16) * -sgn, 0, 0, 0, 0x4a4c4e);
    if (level >= 2) for (const k of [-1, 1]) { const sp = new THREE.ConeGeometry(.09, 2.2, 4); sp.rotateX(-.8 * sgn); K.geo('metal', sp, htm(k * L * .25, .6, 1.1 * sgn), 0x8a8478); }
    if (level >= 3) { const rw = new THREE.TorusGeometry(.32, .03, 4, 10); rw.scale(L * 1.5, 1, 1); K.geo('metal', rw, htm(0, sh + .05, 0, 0, 0, 0), 0x8a8a8a); }
  });
  K.at(null); K.build(wallGroup);
}
const GATE_X = Math.sin(GATE_HALF) * CAMP_R;
function buildGate() {
  gateGroup = new THREE.Group(); gateGroup.position.set(0, heightAt(0, CAMP_R), CAMP_R); world.add(gateGroup);
  const wood = new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x8a8a84, metalness: .5, roughness: .55 });   // (Nov 11) two hull ribs, not logs
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
    const cols = level >= 2 ? [0x6a6e70, 0x5e6466] : [0xc8c6be, 0xb0aea6, 0x9a948a];
    for (let i = 0; i < 3; i++) {
      const panel = mesh(new THREE.BoxGeometry(W / 3 + .05, H, .16), new THREE.MeshStandardMaterial({ map: texPanel, normalMap: TX.metal2N, color: pick(cols), metalness: .45, roughness: .6 }), -d.s * (W / 6 + i * W / 3), H / 2 - .1, 0, d.door);
      panel.rotation.z = rr(-.02, .02);
    }
    if (level >= 1) for (const y of [.8, H - .8]) mesh(new THREE.BoxGeometry(W, .3, .25), M(0x4a4c4e), -d.s * W / 2, y, .15, d.door);
    if (level >= 1) { const x = mesh(new THREE.BoxGeometry(.25, Math.hypot(W, H - 1.6), .22), M(0x4a4c4e), -d.s * W / 2, H / 2, .2, d.door); x.rotation.z = d.s * Math.atan2(W, H - 1.6); }
    if (level >= 2) mesh(new THREE.BoxGeometry(W, H * .5, .1), M(0x55595b), -d.s * W / 2, H * .32, .28, d.door);
    if (level >= 3) for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.ConeGeometry(.1, .7, 4), M(0x9a9a9a), -d.s * (.4 + i * W / 4), H * .5, .55, d.door); sp.rotation.x = Math.PI / 2; }
  }
}
const TOWER_POS = [[.42, 0], [-.42, 0], [1.62, 0], [2.6, 0], [-2.75, 0]].map(([a]) => [a, wallR(a) - 5]);   // (Nov 11) just inside the wall, wherever it runs; a fifth over the east side
function buildTowers() {
  for (const [a, r] of TOWER_POS) {
    const x = Math.sin(a) * r, z = Math.cos(a) * r, y = heightAt(x, z);
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = a; world.add(t);
    towerKit(t);   // (Nov 10) timber legs, sandbagged platform, tin roof: 1f-houses.js
    const gun = new THREE.Group(); gun.position.set(0, 9.2, 1.2); t.add(gun); gun.visible = false;
    const lamp = new THREE.Group(); lamp.position.set(-1.2, 11.5, 1.5); t.add(lamp); lamp.visible = false;
    towers.push({ g: t, x, z, y, gun, lamp, cool: towers.length < 4 ? rnd() : .5, a });
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
/* the layout (Nov 11, Bryce's second plan): in through the gate, Main Street wanders up to the Arc's door. On the left, three
   buildings face the street (Gunsmith, Outfitter, Trading Post), then an opening — West Lane — leads round the back to the
   Clinic, the Workshop and the Storehouse. On the right, two (Cookhouse, Bunkhouse), then East Row branches off to the right
   where the wall runs out a long way: the commons fire and the power yard, Salvage, the Munitions shed (ammo + explosives,
   kept well apart behind blast walls) and the Depot up Foundry Lane. Nothing's ruled straight: every street is a run of short
   legs that kink, and every building sits a little off square.
   ry: which way the front faces (0 = south/+z, π/2 = east/+x, π = north, -π/2 = west) */
const HP = Math.PI / 2;
const STREET_LINES = [
  { n: 'Main Street', w: 6.5, p: [[0, 66], [1.6, 50], [-.8, 36], [1.2, 21], [-.4, 7], [.6, -6], [0, -22]] },
  { n: 'Arc Row', w: 4.5, p: [[-33, -16.5], [-18, -18.6], [0, -19.6], [16, -18.2], [25, -14.5]] },
  { n: 'West Lane', w: 4.2, p: [[-.4, 7], [-12, 5.2], [-24, 7.4], [-36, 4.6], [-46, 7.2], [-52, .5], [-50.5, -4]] },
  { n: 'West Lane', w: 3.4, p: [[-24, 7.4], [-27.5, -1]] },
  { n: 'Clinic Walk', w: 3.4, p: [[-36, 4.6], [-40.5, 13.6]] },
  { n: 'East Row', w: 5, p: [[1.2, 21], [12, 19], [24, 15.6], [36, 14.2], [50, 16.4], [64, 12.6], [80, 8.4], [86, 2]] },
  { n: 'Foundry Lane', w: 4, p: [[50, 16.4], [56.5, 27.5], [62.5, 34]] },
  { n: 'Yard Walk', w: 3.4, p: [[36, 14.2], [34.2, 1.4], [30.4, -4]] },
  { n: 'Shed Walk', w: 3.2, p: [[64, 12.6], [67.5, 4.4]] },
  { n: 'Salvage Walk', w: 3.2, p: [[50, 16.4], [45.2, 8.6]] },
];
const STREETS = STREET_LINES.flatMap(L => L.p.slice(1).map((b, i) => ({ n: L.n, a: L.p[i], b, w: L.w })));
const streetDist = (x, z) => { let d = 1e9; for (const S of STREETS) d = Math.min(d, segDist(x, z, S.a[0], S.a[1], S.b[0], S.b[1]) - S.w / 2); return d; };
const SHOP_DEFS = [
  { id: 'guns', x: -13.6, z: 47.6, ry: HP + .07, sign: 'GUNSMITH', who: 'rook', name: 'Rook', st: ['bench'], stN: 'Gun bench · craft weapons + ammo', cat: 'weap', col: 0x6a7a4a, tint: 0x8a9070 },
  { id: 'wear', x: -12.8, z: 32.4, ry: HP - .05, sign: 'OUTFITTER', who: 'wren', name: 'Wren', st: ['bench'], stN: 'Sewing table · craft clothing', cat: 'wear', col: 0x6a8aa0, tint: 0xa0b0c8 },
  { id: 'trade', x: -14, z: 17.4, ry: HP + .04, sign: 'TRADING POST', who: 'odile', name: 'Odile', st: ['bench'], stN: 'Sorting table · craft materials', cat: 'mat', col: 0x9a8a5a, tint: 0x9a7a60 },
  { id: 'med', x: -42.4, z: 22.6, ry: Math.PI + .07, bw: 14, bd: 9, sign: 'CLINIC', who: 'juno', name: 'Juno', st: ['lab'], stN: 'Clinic lab · make medicine', cat: 'med', col: 0xb8b8b0, tint: 0xe0d8cc },
  { id: 'craft', x: -29.6, z: -5.8, ry: -.06, sign: 'WORKSHOP', who: 'kade', name: 'Kade', st: ['bench', 'forge'], stN: 'Workbench + forge · craft', cat: 'tool', col: 0x8a9092, tint: 0xd8d0c4 },
  { id: 'store', x: -51.6, z: -12.4, ry: .1, bw: 9, bd: 7, sign: 'STOREHOUSE', st: [], stN: null, col: 0x7a7a6a },
  { id: 'cook', x: 15.2, z: 47.2, ry: -HP - .06, sign: 'COOKHOUSE', who: 'bram', name: 'Bram', st: ['fire', 'cook'], stN: 'Stove · cook', cat: 'food', col: 0xa86a48, tint: 0xc8a888 },
  { id: 'bunk', x: 16, z: 30.4, ry: -HP + .05, bw: 12, sign: 'BUNKHOUSE', st: [], stN: 'Rest in a bunk', col: 0x7a7a5a },
  { id: 'salvage', x: 44.2, z: .6, ry: .06, sign: 'SALVAGE', who: 'gus', name: 'Gus', st: ['bench'], stN: 'Strip-down bench · craft materials', cat: 'mat', col: 0x8a6a52, tint: 0x9a8a7a },
  { id: 'ammo', x: 68.4, z: -3.6, ry: -.08, bw: 12, sign: 'MUNITIONS', who: 'vesna', name: 'Vesna', late: 1, st: ['bench'], stN: 'Powder bench · ammo + explosives', cat: 'weap', col: 0x7a6a3a, tint: 0x8a7a5a },
  { id: 'depot', x: 71.6, z: 26.4, ry: -HP + .1, bw: 10, bd: 8, sign: 'DEPOT', st: [], stN: null, col: 0x6a7076 },
];
function shopL2W(D, lx, lz) { const c = Math.cos(D.ry), s = Math.sin(D.ry); return { x: D.cx + lx * c + lz * s, z: D.cz - lx * s + lz * c }; }
for (const D of SHOP_DEFS) { D.cx = D.x; D.cz = D.z; D.bw = D.bw || 11; D.bd = D.bd || 8; D.keeper = shopL2W(D, 0, -1.1); D.spot = shopL2W(D, -3.9, 1.9); D.front = shopL2W(D, 0, 2.1); D.forge = shopL2W(D, 3.9, 2.6); }
const SHOP = Object.fromEntries(SHOP_DEFS.map(D => [D.id, D]));
/* the walkers' network: settlers and extras walk the streets node to node (junctions, street ends, a spot in front of each
   shop) instead of picking a random point in the yard, which put them inside walls and shops. */
const WALK = (() => {
  const nodes = [], onSt = STREETS.map(() => []);
  const node = (x, z) => { for (const n of nodes) if (Math.hypot(n.x - x, n.z - z) < 1.5) return n; const n = { x, z, id: nodes.length, nb: new Set(), shop: null }; nodes.push(n); return n; };
  const proj = (S, x, z) => { const [ax, az] = S.a, [bx, bz] = S.b, dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return { t, x: ax + dx * t, z: az + dz * t }; };
  STREETS.forEach((S, i) => { onSt[i].push({ t: 0, n: node(...S.a) }, { t: 1, n: node(...S.b) }); });
  // junctions: wherever two streets touch (within their widths), sample along A and take the closest point on B
  for (let i = 0; i < STREETS.length; i++) for (let j = i + 1; j < STREETS.length; j++) {
    const A = STREETS[i], B = STREETS[j]; let best = null;
    for (let k = 0; k <= 60; k++) { const t = k / 60, x = lerp(A.a[0], A.b[0], t), z = lerp(A.a[1], A.b[1], t), q = proj(B, x, z), d = Math.hypot(q.x - x, q.z - z); if (!best || d < best.d) best = { d, t, x, z, q }; }
    if (best.d > (A.w + B.w) / 2 + 1) continue;
    const na = node(best.x, best.z), nb = node(best.q.x, best.q.z); onSt[i].push({ t: best.t, n: na }); onSt[j].push({ t: best.q.t, n: nb });
    if (na !== nb) { na.nb.add(nb); nb.nb.add(na); }
  }
  // a spot in front of each shop, tied to the nearest street
  for (const D of SHOP_DEFS) {
    const f = shopL2W(D, 0, D.bd / 2 + (D.id === 'cook' ? 6.4 : 2.6)); let bi = 0, bq = null;
    STREETS.forEach((S, i) => { const q = proj(S, f.x, f.z); if (!bq || Math.hypot(q.x - f.x, q.z - f.z) < Math.hypot(bq.x - f.x, bq.z - f.z)) { bq = q; bi = i; } });
    const sn = node(bq.x, bq.z), fn = node(f.x, f.z); fn.shop = D; onSt[bi].push({ t: bq.t, n: sn }); if (sn !== fn) { sn.nb.add(fn); fn.nb.add(sn); }
  }
  onSt.forEach(L => { L.sort((a, b) => a.t - b.t); for (let k = 1; k < L.length; k++) if (L[k].n !== L[k - 1].n) { L[k].n.nb.add(L[k - 1].n); L[k - 1].n.nb.add(L[k].n); } });
  const nearest = (x, z) => { let b = nodes[0], bd = 1e9; for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } } return b; };
  function path(from, to) {          // BFS by distance (Dijkstra, tiny graph)
    const dist = new Map([[from, 0]]), prev = new Map(), open = [from];
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b)); const n = open.shift(); if (n === to) break;
      for (const m of n.nb) { const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z); if (d < (dist.get(m) ?? 1e9)) { dist.set(m, d); prev.set(m, n); open.push(m); } }
    }
    const out = []; for (let n = to; n && n !== from; n = prev.get(n)) out.unshift(n); return out;
  }
  /* after the town is built (piles, tables, posts all have collision): move any node that landed on something to the
     nearest clear spot, and cut links that would walk through something */
  function settle() {
    const free = (x, z) => { const L = grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))) || []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of grid.get(gkey(Math.floor(x / CELL) + i, Math.floor(z / CELL) + j)) || []) if (Math.hypot(x - c.x, z - c.z) < c.r + .9) return false; return true; };
    for (const n of nodes) if (!free(n.x, n.z)) {
      let done = false; for (let r = .5; r <= 6 && !done; r += .5) for (let a = 0; a < 6.28 && !done; a += .4) { const x = n.x + Math.sin(a) * r, z = n.z + Math.cos(a) * r; if (free(x, z)) { n.x = x; n.z = z; done = true; } }
    }
    for (const n of nodes) for (const m of [...n.nb]) if (n.nb.size > 1 && m.nb.size > 1 && !clearLine(n.x, n.z, m.x, m.z, .55)) { n.nb.delete(m); m.nb.delete(n); }
  }
  return { nodes, nearest, path, settle };
})();
const SPOTS = {
  bench: SHOP.craft.spot, fire: { x: 24, z: 9 }, smoke: shopL2W(SHOP.cook, 7.6, 1.5), med: SHOP.med.spot, armory: SHOP.guns.spot,
};
let smokeGroup;
/* shopHouse(D): each building is raised in 1f-houses.js (Nov 10 rebuild) */
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
      if (campD(x, z) > CAMP_R - 3 || inHull(x, z) || SHOP_DEFS.some(D => Math.hypot(x - D.cx, z - D.cz) < Math.max(D.bw, D.bd) / 2 + 1.2) || Math.hypot(x - SPOTS.fire.x, z - SPOTS.fire.z) < 6 || streetDist(x, z) < -.2) continue;
      const lp = new THREE.Group(); lp.position.set(x, H0, z); world.add(lp);
      mesh(new THREE.CylinderGeometry(.08, .11, 4.2, 6), M(0x3a3a38), 0, 2.1, 0, lp);
      mesh(new THREE.BoxGeometry(.9, .08, .08), M(0x3a3a38), -Math.sign(sd) * nx * .4, 4.15, -Math.sign(sd) * nz * .4, lp).rotation.y = Math.atan2(nx, nz) + HP;
      const bulb = mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), -Math.sign(sd) * nx * .8, 4, -Math.sign(sd) * nz * .8, lp); bulb.castShadow = false;
      addCol(x, z, .2, 4);
    }
  });
  buildGatehouse();   // (Nov 10) 1f-houses.js
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
  buildYard();   // (Nov 10) power yard, pole line, notice board, string lights, blast walls: 1f-houses.js
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
    const x = rr(-46, 46), z = rr(82, 150); if (pathDist(x, z) < 4 || Math.hypot(x - POI.lake.x, z - POI.lake.z) < LAKES[0].R * 1.3) continue;
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
    if (s.kind === 'house' || s.kind === 'arc') continue;   // (Nov 10) the shops and the Arc are their own shelter: no concrete hut inside them
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
  for (let i = 0; i < 9; i++) { const x = rr(-40, 40), z = rr(82, 146); if (waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'field'); }
  for (let i = 0; i < 110; i++) { const a = rnd() * Math.PI * 2, r = rr(96, VALLEY - 20); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) > 110 || waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'wild'); }
}
