
/* ================= the wider valley ================= */
const rustMat = () => new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x9a5a36, 0x8a6a4a, 0x7a4a2e, 0x6a6e6a]) });
const concMat = (c = 0xd8d2c6) => new THREE.MeshLambertMaterial({ map: texConcrete, color: c });
function place(o, x, z, yaw = 0, up = 0) { o.position.set(x, heightAt(x, z) + up, z); o.rotation.y = yaw; world.add(o); return o; }
function rotXZ(lx, lz, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return [lx * c + lz * s, -lx * s + lz * c]; }

/* a rusted old-world car */
function car(x, z, yaw) {
  const g = new THREE.Group(), body = rustMat(), dark = M(0x1a1a1a);
  mesh(new THREE.BoxGeometry(1.9, .7, 4.4), body, 0, .65, 0, g);
  const cab = mesh(new THREE.BoxGeometry(1.7, .6, 2.2), body, 0, 1.3, -.2, g); cab.scale.x = .95;
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.02, .45, 1.9), M(0x223038), s * .86, 1.32, -.2, g);
  for (const [wx, wz] of [[-.9, 1.4], [.9, 1.4], [-.9, -1.4], [.9, -1.4]]) { const w = mesh(new THREE.CylinderGeometry(.38, .38, .25, 10), dark, wx, .3, wz, g); w.rotation.z = Math.PI / 2; w.scale.y = rnd() < .3 ? .5 : 1; }
  g.rotation.z = rr(-.05, .05);
  place(g, x, z, yaw, -.1);
  const [ax, az] = rotXZ(0, 1.3, yaw), [bx, bz] = rotXZ(0, -1.3, yaw);
  addCol(x + ax, z + az, 1.1); addCol(x + bx, z + bz, 1.1);
  return g;
}
/* a ruined house: four walls with a door gap and window holes, half a roof */
function house(cx, cz, yaw, w, d, floors = 1) {
  const g = new THREE.Group(), H = 3 * floors, mat = pick([concMat(), concMat(0xc8b8a4), new THREE.MeshLambertMaterial({ map: texWood, color: 0xc0a888 })]);
  const t = .3;
  const wall = (lx, lz, len, rotY, door) => {
    const segs = door ? [[-len / 2, -.8], [.8, len / 2]] : [[-len / 2, len / 2]];
    for (const [a, b] of segs) {
      const L = b - a, mid = (a + b) / 2;
      const hh = H * (rnd() < .3 ? rr(.55, .9) : 1);
      const m = mesh(new THREE.BoxGeometry(L, hh, t), mat, 0, hh / 2, 0);
      const p = new THREE.Group(); p.add(m); m.position.x = mid; p.position.set(lx, 0, lz); p.rotation.y = rotY; g.add(p);
      // windows: dark insets
      if (L > 2.5) for (let k = 0; k < floors; k++) { const wn = mesh(new THREE.BoxGeometry(1, 1, t + .04), M(0x141414), mid, 1.6 + k * 3, 0); p.add(wn); }
    }
    if (door) { const lint = mesh(new THREE.BoxGeometry(1.6, H - 2.2, t), mat, 0, 2.2 + (H - 2.2) / 2, 0); const p = new THREE.Group(); p.add(lint); p.position.set(lx, 0, lz); p.rotation.y = rotY; g.add(p); }
  };
  wall(0, d / 2, w, 0, true); wall(0, -d / 2, w, 0, false); wall(w / 2, 0, d, Math.PI / 2, false); wall(-w / 2, 0, d, Math.PI / 2, rnd() < .4);
  if (rnd() < .7) { const r = mesh(new THREE.BoxGeometry(w + .6, .25, d * .6 + .4), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a5a4a }), 0, H + .2, -d * .2, g); r.rotation.x = rr(-.25, .1); r.rotation.z = rr(-.12, .12); }
  for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(rr(.4, 1.2), rr(.2, .5), rr(.4, 1)), mat, rr(-w / 2, w / 2) * .7, .2, rr(-d / 2, d / 2) * .7, g); b.rotation.y = rnd() * 3; }
  place(g, cx, cz, yaw);
  // colliders along the walls (door gap left open)
  const C = (lx0, lz0, lx1, lz1) => { const [a, b] = rotXZ(lx0, lz0, yaw), [c, e] = rotXZ(lx1, lz1, yaw); addColLine(cx + a, cz + b, cx + c, cz + e, .3); };
  C(-w / 2, d / 2, -.9, d / 2); C(.9, d / 2, w / 2, d / 2); C(-w / 2, -d / 2, w / 2, -d / 2); C(w / 2, -d / 2, w / 2, d / 2); C(-w / 2, -d / 2, -w / 2, d / 2);
  SHELTERS.push({ x: cx, z: cz, kind: 'house', r: Math.min(w, d) / 2 - .4 });
  return g;
}
function supplyCrate(x, z, loot) {
  const g = MODELS['ammo-crate'] ? modelCopy('ammo-crate', .75) : null;
  const o = g || (() => { const b = new THREE.Group(); mesh(new THREE.BoxGeometry(1.4, .8, .8), M(0x4f5a3a), 0, .4, 0, b); return b; })();
  if (g) o.scale.multiplyScalar(1);
  place(o, x, z, rnd() * 6);
  addCol(x, z, .9);
  CRATES.push({ x, z, g: o, loot: loot || pick(['ammo', 'ammo', 'scrap', 'mixed']), opened: false });
}

function buildHalvard() {
  const C = POI.halvard;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (rnd() < .2 || (i === 0 && j === 0)) continue;
    const x = C.x + i * 26 + rr(-2, 2), z = C.z + j * 26 + rr(-2, 2);
    house(x, z, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rr(-.05, .05), rr(7, 10), rr(6, 9), rnd() < .25 ? 2 : 1);
    if (rnd() < .45) supplyCrate(x + rr(-1.5, 1.5), z + rr(-1.5, 1.5));
    if (rnd() < .5) spawnScrap(x + rr(-3, 3), z + rr(-3, 3), 'wild');
  }
  // the old hall with its bell tower
  { const x = C.x, z = C.z - 2, g = new THREE.Group(), m = concMat(0xa49c90);
    mesh(new THREE.BoxGeometry(12, 7, 16), m, 0, 3.5, 0, g);
    mesh(new THREE.BoxGeometry(4, 16, 4), m, 0, 8, -6, g);
    const sp = mesh(new THREE.ConeGeometry(3.2, 6, 4), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x5a4a3c }), 0, 19, -6, g); sp.rotation.y = Math.PI / 4;
    const roof = mesh(new THREE.CylinderGeometry(.01, 7.6, 4, 4, 1), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a5a48 }), 0, 9, 2, g); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.6;
    mesh(new THREE.BoxGeometry(2.4, 3.4, .4), M(0x111111), 0, 1.7, 8.05, g);
    place(g, x, z); addColLine(x - 6, z - 10, x + 6, z - 10, .5); addColLine(x - 6, z + 6, x - 1.4, z + 6, .5); addColLine(x + 1.4, z + 6, x + 6, z + 6, .5); addColLine(x - 6, z - 10, x - 6, z + 6, .5); addColLine(x + 6, z - 10, x + 6, z + 6, .5);
    SHELTERS.push({ x, z: z - 2, kind: 'house', r: 5.5 }); supplyCrate(x + 3, z - 5, 'mixed'); supplyCrate(x - 3, z - 6, 'ammo'); }
  // water tower
  { const x = C.x + 62, z = C.z - 50, g = new THREE.Group();
    g.add(mesh(lattice(5, 16, 0x6a6a64, 4), VCOL));
    mesh(new THREE.CylinderGeometry(4, 4, 6, 18), rustMat(), 0, 19, 0, g); mesh(new THREE.ConeGeometry(4.3, 2, 18), rustMat(), 0, 23, 0, g);
    place(g, x, z, .3); addCol(x, z, 3.6); }
  // fuel stop: canopy, pumps
  { const x = C.x - 70, z = C.z + 10, g = new THREE.Group();
    mesh(new THREE.BoxGeometry(14, .5, 9), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a3a2a }), 0, 5, 0, g);
    for (const [px, pz] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) mesh(new THREE.BoxGeometry(.4, 5, .4), M(0x8a8a86), px, 2.5, pz, g);
    for (const px of [-2.5, 2.5]) { mesh(new THREE.BoxGeometry(.8, 1.7, .6), M(pick([0x9a4a2a, 0x3a5a7a])), px, .85, 0, g); }
    place(g, x, z, Math.PI / 2); for (const [px, pz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) addCol(x + px, z + pz, .4); addCol(x, z - 2.5, .6); addCol(x, z + 2.5, .6);
    SHELTERS.push({ x, z, kind: 'house', r: 4.2 }); }
  for (let i = 0; i < 14; i++) car(C.x + rr(-70, 70), C.z + (rnd() < .5 ? 13 : -13) + rr(-2, 2) + (Math.floor(rr(-2, 3)) * 26), rr(-.4, .4) + (rnd() < .5 ? 0 : Math.PI));
  // bent street lamps
  for (let i = 0; i < 12; i++) { const x = C.x + rr(-70, 70), z = C.z + 13 * (rnd() < .5 ? 1 : -1); const g = new THREE.Group(); const p = mesh(new THREE.CylinderGeometry(.08, .12, 6, 6), M(0x4a4a46), 0, 3, 0, g); p.rotation.z = rr(-.3, .3); mesh(new THREE.BoxGeometry(1.2, .2, .4), M(0x4a4a46), .5, 6, 0, g); place(g, x, z, rnd() * 6); addCol(x, z, .2); }
}

function buildBurn() {
  const B = POI.burn;
  if (MODELS.dropship) {
    const d = modelCopy('dropship', 26, 'z', 0x9a948a);
    d.position.set(B.x + 4, heightAt(B.x, B.z) - 2.2, B.z - 2); d.rotation.set(.12, .8, -.22); world.add(d);
    addCol(B.x + 4, B.z - 2, 6); addCol(B.x - 4, B.z + 6, 5); addCol(B.x + 12, B.z - 10, 5);
  }
  // furrow of wreckage leading in
  for (let i = 0; i < 26; i++) {
    const t = i / 26, x = lerp(B.x - 90, B.x, t) + rr(-8, 8), z = lerp(B.z - 60, B.z, t) + rr(-8, 8), y = heightAt(x, z);
    const t2 = texPanel.clone(); t2.needsUpdate = true;
    const m = mesh(new THREE.BoxGeometry(rr(1.5, 4.5), rr(.2, .5), rr(1.5, 3.5)), new THREE.MeshStandardMaterial({ map: t2, color: 0x8a847a, metalness: .4, roughness: .7 }), x, y + .5, z, world);
    m.rotation.set(rr(-1.2, 1.2), rnd() * 6, rr(-.6, .6)); if (rnd() < .4) addCol(x, z, 1.2);
    if (rnd() < .5) spawnScrap(x + rr(-3, 3), z + rr(-3, 3), 'wild');
  }
  // fires still burning
  for (let i = 0; i < 7; i++) {
    const x = B.x + rr(-24, 24), z = B.z + rr(-24, 24), y = heightAt(x, z);
    const f = new THREE.Mesh(new THREE.ConeGeometry(rr(.5, 1.1), rr(1.4, 2.6), 7), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .9 }));
    f.position.set(x, y + .9, z); world.add(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(.35, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); f2.position.set(x, y + .6, z); world.add(f2);
    const ph = rnd() * 6; DECOR_ANIM.push(t => { f.scale.y = 1 + Math.sin(t * 13 + ph) * .25; f2.scale.y = 1 + Math.sin(t * 19 + ph) * .3; });
    SMOKES.push({ x, z, y: y + 1, k: rnd() });
  }
  const bl = new THREE.PointLight(0xff8a3a, 3, 60, 0); bl.position.set(B.x, heightAt(B.x, B.z) + 5, B.z); world.add(bl);
  for (let i = 0; i < 10; i++) spawnScrap(B.x + rr(-30, 30), B.z + rr(-30, 30), 'wild');
  supplyCrate(B.x - 10, B.z + 12, 'mixed'); supplyCrate(B.x + 14, B.z + 8, 'ammo');
}
const SMOKES = [];
let smokeIM;
function buildSmoke() {
  smokeIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x3a3634, transparent: true, opacity: .32, depthWrite: false }), SMOKES.length * 10);
  smokeIM.frustumCulled = false; world.add(smokeIM);
}
const _sm = new THREE.Object3D();
function updSmoke(t) {
  if (!smokeIM) return; let n = 0;
  for (const s of SMOKES) for (let i = 0; i < 10; i++) { const k = (s.k + i / 10 + t * .03) % 1; _sm.position.set(s.x + Math.sin(k * 7 + i) * k * 3, s.y + k * 30, s.z + k * 6); _sm.scale.setScalar(.8 + k * 5); _sm.updateMatrix(); smokeIM.setMatrixAt(n++, _sm.matrix); }
  smokeIM.instanceMatrix.needsUpdate = true;
}

function buildAshmere() {
  const A = POI.ashmere, y0 = heightAt(A.x, A.z), R = 48;
  const gateA = Math.atan2(-A.z, -A.x);        // the gate faces the camp
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2; if (Math.abs(angWrap(a - gateA)) < .1) continue;
    const x = A.x + Math.cos(a) * R, z = A.z + Math.sin(a) * R;
    const l = mesh(new THREE.CylinderGeometry(.05, .32, rr(5, 6.5), 6), new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a6e52 }), x, heightAt(x, z) + 2.6, z, world);
    l.rotation.set(Math.sin(a) * .08, 0, -Math.cos(a) * .08); addCol(x, z, .45);
  }
  for (const s of [-1, 1]) {           // gate towers
    const a = gateA + s * .12, x = A.x + Math.cos(a) * (R + 1), z = A.z + Math.sin(a) * (R + 1), g = new THREE.Group();
    g.add(mesh(lattice(3, 7, 0x5a4430, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x5a4430), 0, 7, 0, g);
    for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.ConeGeometry(.08, 1.2, 4), M(0xd8d0bc), rr(-1.8, 1.8), 7.6, rr(-1.8, 1.8), g); sp.rotation.z = rr(-.4, .4); }
    place(g, x, z, -a); addCol(x, z, 2);
  }
  // longhouse
  { const g = new THREE.Group(), w = new THREE.MeshLambertMaterial({ map: texWood, color: 0x7a5e44 });
    mesh(new THREE.BoxGeometry(10, 4, 22), w, 0, 2, 0, g);
    const roofShape = new THREE.Shape([new THREE.Vector2(-6.2, 0), new THREE.Vector2(6.2, 0), new THREE.Vector2(0, 5.5)]);
    const roof = mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 24, bevelEnabled: false }), M(0x4a3a2a), 0, 4, -12, g);
    for (let k = 0; k < 6; k++) { const h = mesh(new THREE.ConeGeometry(.12, 1.6, 4), M(0xd8d0bc), 0, 10 + rr(-.2, .2), -10 + k * 4, g); h.rotation.z = rr(-.6, .6); }
    mesh(new THREE.BoxGeometry(2.6, 3, .2), M(0x120e0a), 0, 1.5, 11.05, g);
    place(g, A.x - 12, A.z, Math.PI / 2 + gateA);
    const [a1, b1] = rotXZ(0, 10.5, Math.PI / 2 + gateA), [a2, b2] = rotXZ(0, -10.5, Math.PI / 2 + gateA);
    addColLine(A.x - 12 + a1, A.z + b1, A.x - 12 + a2, A.z + b2, 5.2);
  }
  // tents, totems, racks, a big fire
  const hide = [0x7a5a3e, 0x6a4a32, 0x8a6a48, 0x5a4434];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = rr(18, 40), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
    if (Math.abs(angWrap(a - gateA)) < .3) continue;
    const t = mesh(new THREE.ConeGeometry(rr(2.2, 3), rr(3.8, 5), 8), M(pick(hide)), x, heightAt(x, z) + 2, z, world); addCol(x, z, 2.2);
    for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(.05, .05, 1.4, 4), M(0x3a2a1a), x + rr(-.2, .2), heightAt(x, z) + 4.6, z + rr(-.2, .2), world).rotation.set(rr(-.4, .4), 0, rr(-.4, .4));
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = A.x + 4 + Math.cos(a) * 12, z = A.z + Math.sin(a) * 12, g = new THREE.Group();
    for (let k = 0; k < 4; k++) { mesh(new THREE.BoxGeometry(.9, 1.1, .9), M(pick([0x5a4030, 0x6a4a36, 0x4a3426])), 0, .55 + k * 1.1, 0, g); mesh(new THREE.BoxGeometry(.55, .14, .05), M(0x101010), 0, .75 + k * 1.1, .46, g); }
    mesh(new THREE.BoxGeometry(2, .14, .14), M(0xd9d0bd), 0, 4.6, 0, g);
    place(g, x, z, -a + Math.PI / 2); addCol(x, z, .7);
  }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); fl.position.set(A.x + 4, y0 + 1.7, A.z); world.add(fl);
  DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 11) * .2; fl.rotation.y = t; });
  const vl = new THREE.PointLight(0xff8a3a, 2.4, 50, 0); vl.position.set(A.x + 4, y0 + 5, A.z); world.add(vl);
  addCol(A.x + 4, A.z, 2);
  SMOKES.push({ x: A.x + 4, z: A.z, y: y0 + 3, k: 0 });
  supplyCrate(A.x - 20, A.z + 14, 'mixed'); supplyCrate(A.x - 22, A.z - 16, 'ammo'); supplyCrate(A.x + 20, A.z + 26, 'scrap');
}

function buildLake() {
  const L = POI.lake, a = Math.atan2(-L.z, -L.x) + .4;                // dock on the camp side
  const sx = L.x + Math.cos(a) * 66, sz = L.z + Math.sin(a) * 66, yaw = -a + Math.PI / 2;
  const g = new THREE.Group(), w = new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a7258 });
  const deckY = LAKE_L + .5, gy = heightAt(sx, sz);
  for (let k = 0; k < 16; k++) { const p = mesh(new THREE.BoxGeometry(2.6, .14, .5), w, 0, 0, -k * .55, g); p.rotation.z = rr(-.03, .03); }
  for (const s of [-1.2, 1.2]) for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(.12, .12, 3, 6), M(0x4a3a2a), s, -1.4, -k * 2.6, g);
  g.position.set(sx, deckY, sz); g.rotation.y = yaw; world.add(g);
  const [cx, cz] = rotXZ(0, -4.2, yaw); addFloor(sx + cx, sz + cz, yaw, 1.3, 4.6, deckY + .07);
  // boathouse + canoe + fishing shack
  { const bx = L.x + Math.cos(a + .25) * 82, bz = L.z + Math.sin(a + .25) * 82; house(bx, bz, -a, 7, 6); supplyCrate(bx, bz, 'mixed'); }
  { const cx2 = L.x + Math.cos(a - .2) * 70, cz2 = L.z + Math.sin(a - .2) * 70, c = new THREE.Group(); const hull = mesh(new THREE.CylinderGeometry(.5, .5, 4.4, 10, 1, false, 0, Math.PI), M(0x8a3a2a, { side: THREE.DoubleSide }), 0, .5, 0, c); hull.rotation.set(Math.PI / 2, 0, Math.PI); place(c, cx2, cz2, rnd() * 6); }
}

function buildLookout() {
  const L = POI.lookout, g = new THREE.Group(), y0 = heightAt(L.x, L.z), H = 16;
  g.add(mesh(lattice(4, H, 0x6a5440, 3.2), VCOL));
  const w = new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a6e52 });
  mesh(new THREE.BoxGeometry(6, .3, 6), w, 0, H, 0, g);
  for (const [x, z, sx, sz] of [[0, 2.9, 6, .15], [0, -2.9, 6, .15], [2.9, 0, .15, 6]]) mesh(new THREE.BoxGeometry(sx, 1.1, sz), w, x, H + .7, z, g);
  for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) mesh(new THREE.BoxGeometry(.18, 3, .18), w, x, H + 1.5, z, g);
  const roof = mesh(new THREE.ConeGeometry(4.8, 2, 4), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a5a4a }), 0, H + 4, 0, g); roof.rotation.y = Math.PI / 4;
  for (let k = 0; k < 20; k++) mesh(new THREE.BoxGeometry(1, .08, .08), M(0x7d6448), -2.2, .5 + k * .8, 0, g).rotation.y = Math.PI / 2;
  place(g, L.x, L.z); addCol(L.x, L.z, 2.6);
  addFloor(L.x, L.z, 0, 2.9, 2.9, y0 + H + .15);
  POI.lookoutTop = y0 + H + .15;
  supplyCrate(L.x + 4, L.z + 3, 'ammo');
}

function buildBridge() {
  const B = POI.bridge, half = 46, x0 = B.x - half, x1 = B.x + half;
  const y0 = heightAt(x0, B.z) + .3, y1 = heightAt(x1, B.z) + .3;
  const len = x1 - x0, slope = (y1 - y0) / len, g = new THREE.Group(), conc = concMat(0x9c968c);
  const deck = mesh(new THREE.BoxGeometry(len, .8, 10), conc, 0, -.4, 0, g);
  for (const s of [-1, 1]) for (let k = -half; k < half; k += 4) if (rnd() > .3) mesh(new THREE.BoxGeometry(3.6, .9, .3), conc, k + 2, .45, s * 4.85, g);
  for (const px of [-22, 0, 22]) { const wl = riverWL(B.z), py = (y0 + y1) / 2; const pier = mesh(new THREE.BoxGeometry(3, py - wl + 6, 8), conc, px, -(py - wl + 6) / 2, 0, g); }
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.BoxGeometry(rr(.6, 2), .3, rr(.6, 2)), M(0x5a5854), rr(-half, half), .05, rr(-4, 4), g); c.rotation.y = rnd() * 3; }
  g.position.set(B.x, (y0 + y1) / 2, B.z); g.rotation.z = Math.atan(slope); world.add(g);
  FLOORS.push({ cx: B.x, cz: B.z, c: 1, s: 0, hw: half, hd: 4.6, y: (y0 + y1) / 2, slope });
  car(B.x + 10, B.z + 2, Math.PI / 2 + .3);
  for (const s of [-1, 1]) addColLine(x0 + 6, B.z + s * 5.2, x1 - 6, B.z + s * 5.2, .3);
}

function buildScoutCamps() {
  for (const S0 of SCOUTS) {
    const y = heightAt(S0.x, S0.z);
    for (let i = 0; i < 2; i++) { const a = i * 2.4 + rnd(), x = S0.x + Math.cos(a) * 5, z = S0.z + Math.sin(a) * 5; mesh(new THREE.ConeGeometry(2, 3.6, 7), M(pick([0x7a5a3e, 0x6a4a32])), x, heightAt(x, z) + 1.7, z, world); addCol(x, z, 1.8); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.2, 7), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); fl.position.set(S0.x, y + .6, S0.z); world.add(fl);
    DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 14 + S0.x) * .25; });
    supplyCrate(S0.x + 3, S0.z - 3);
  }
}

function buildRelay() {
  const R = POI.relay, g = new THREE.Group(), H = 34;
  g.add(mesh(lattice(3, H, 0x8a8a86, 3), VCOL));
  for (const [y, a] of [[H - 4, 0], [H - 7, 2]]) { const d = mesh(new THREE.CylinderGeometry(1.4, 1.4, .2, 16), S(0xd0d0cc), Math.sin(a) * 1.8, y, Math.cos(a) * 1.8, g); d.rotation.x = 1.2; d.rotation.y = a; }
  relayLamp = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); relayLamp.position.y = H + .6; g.add(relayLamp);
  place(g, R.x, R.z, .4);
}

function seedCrates() {
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, r = rr(90, WORLD - 40), x = Math.cos(a) * r, z = Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > .8) { i--; continue; } supplyCrate(x, z); }
}
