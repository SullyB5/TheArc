
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
function buildArc() {
  const g = new THREE.Group(); g.position.y = H0; world.add(g);
  const main = hullModule(6.2, 32); main.position.set(-6, 4.3, -14); main.rotation.set(.03, .12, -.04); g.add(main);
  for (let i = -15; i <= 15; i += 5) addCol(-6 + Math.cos(.12) * i, -14 - Math.sin(.12) * i, 6.4);
  const m2 = hullModule(4.4, 18); m2.position.set(18, 3.0, -21); m2.rotation.set(-.05, .95, .06); g.add(m2);
  for (let i = -8; i <= 8; i += 4) addCol(18 + Math.cos(.95) * i, -21 - Math.sin(.95) * i, 4.6);
  const m3 = hullModule(3.6, 12, false); m3.position.set(-24, 2.2, -2); m3.rotation.set(0, -1.2, .08); g.add(m3);
  for (let i = -5; i <= 5; i += 3.3) addCol(-24 + Math.cos(-1.2) * i, -2 - Math.sin(-1.2) * i, 3.8);
  // the spire: a broken tower section that came down nose-first and stuck
  const sp = new THREE.Group(); sp.position.set(-12, -3, -36); sp.rotation.set(-.22, .3, .2); g.add(sp);
  mesh(lattice(8, 58, 0x56544f, 5), VCOL, 0, 0, 0, sp);
  const coreT = texPanel.clone(); coreT.needsUpdate = true; coreT.repeat.set(1, 7);
  mesh(new THREE.BoxGeometry(5, 50, 5), new THREE.MeshStandardMaterial({ map: coreT, normalMap: TX.metal2N, color: 0x9a948c, metalness: .4, roughness: .7 }), 0, 25, 0, sp);
  for (let i = 0; i < 9; i++) { const b = mesh(new THREE.BoxGeometry(rr(2, 6), rr(1, 4), rr(2, 6)), M(pick([0x6e6a63, 0x8a8478, 0x4f4c47])), rr(-4, 4), rr(8, 58), rr(-4, 4), sp); b.rotation.set(rnd(), rnd(), rnd()); }
  for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(.2, rr(3, 7), .2), M(0x3b3a37), rr(-3, 3), 58 + rr(0, 3), rr(-3, 3), sp); b.rotation.set(rr(-.8, .8), 0, rr(-.8, .8)); }
  addCol(-12, -36, 6);
  // radio mast with loudspeakers
  const mast = new THREE.Group(); mast.position.set(22, 0, -3); g.add(mast);
  mesh(lattice(1.4, 19, 0x9a9a96, 2.2), VCOL, 0, 0, 0, mast);
  for (const [a, y] of [[0, 17.5], [2.1, 17.5], [4.2, 16.4]]) {
    const hn = mesh(new THREE.ConeGeometry(.7, 1.3, 10, 1, true), M(0x5d5e5c, { side: THREE.DoubleSide }), Math.sin(a) * 1.2, y, Math.cos(a) * 1.2, mast);
    hn.rotation.set(Math.PI / 2, 0, 0); hn.lookAt(Math.sin(a) * 9, y - 1, Math.cos(a) * 9); hn.rotateX(-Math.PI / 2);
  }
  mesh(new THREE.CylinderGeometry(.9, .9, .2, 16), M(0xc9c9c4), 0, 19.3, 0, mast).rotation.x = .5;
  addCol(22, -3, 1.2);
}

/* the wall: corrugated sheets, log posts, and the gate with its sign */
const WALL_H = [2.4, 3.6, 4.6, 5.4];
function buildWall(level) {
  if (wallGroup) world.remove(wallGroup);
  wallGroup = new THREE.Group(); wallGroup.position.y = 0; world.add(wallGroup);
  const H = WALL_H[level];
  const sheetCols = [0x9da3a6, 0x8f9a9e, 0x7f8f9e, 0xa2a49d, 0x9a7f6a, 0x9b5a3e, 0x6f86a0];
  const SEG = 62, segA = (Math.PI * 2 - GATE_HALF * 2) / SEG;
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
const TOWER_POS = [[.52, 37], [-.52, 37], [2.5, 37.5]];
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

/* inside the walls: fire pit, smokehouse, med tent, workbench, armory, tables */
const SPOTS = {
  bench: { x: 13, z: 14 }, fire: { x: -6, z: 13 }, smoke: { x: -12, z: 17 }, med: { x: -19, z: 7 },
  armory: { x: 10, z: 28 }, vosPost: { x: 3.5, z: 35 },
};
let smokeGroup;
function buildCampProps() {
  const y0 = H0;
  // fire pit
  const f = new THREE.Group(); f.position.set(SPOTS.fire.x, y0, SPOTS.fire.z); world.add(f);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; mesh(new THREE.DodecahedronGeometry(.32, 0), M(0x6a6660), Math.cos(a) * 1.1, .15, Math.sin(a) * 1.1, f); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(.09, .1, 1.4, 5), M(0x4a3020), 0, .25, 0, f); l.rotation.set(Math.PI / 2 - .3, i * .8, 0); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.55, 1.4, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .9 }));
  flame.position.y = .8; f.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(.32, 1.0, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a })); flame2.position.y = .7; f.add(flame2);
  DECOR_ANIM.push(t => { flame.scale.set(1 + Math.sin(t * 17) * .1, 1 + Math.sin(t * 11) * .2, 1); flame2.scale.y = 1 + Math.sin(t * 23) * .25; flame.rotation.y = t * 2; });
  fireLight = new THREE.PointLight(0xff9a4a, 2.2, 22, 0); fireLight.position.set(SPOTS.fire.x, y0 + 1.6, SPOTS.fire.z); world.add(fireLight);
  addCol(SPOTS.fire.x, SPOTS.fire.z, 1.3);
  // benches + tables like a mess hall under the sky
  for (const [x, z, r] of [[-2, 18, .3], [-10, 9, 1.4], [-1, 8, -.6]]) {
    const b = new THREE.Group(); b.position.set(x, y0, z); b.rotation.y = r; world.add(b);
    const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0xa0886e });
    mesh(new THREE.BoxGeometry(3, .12, .45), wood, 0, .45, 0, b);
    for (const s of [-1.2, 1.2]) mesh(new THREE.BoxGeometry(.12, .45, .4), wood, s, .22, 0, b);
  }
  { const t = new THREE.Group(); t.position.set(4, y0, 4); world.add(t);
    mesh(new THREE.BoxGeometry(3.4, .12, 1.4), new THREE.MeshLambertMaterial({ map: texPanel, color: 0xb0b0aa }), 0, .9, 0, t);
    for (const [x, z] of [[-1.5, -.5], [1.5, -.5], [-1.5, .5], [1.5, .5]]) mesh(new THREE.BoxGeometry(.1, .9, .1), M(0x55554f), x, .45, z, t);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(3.2, .1, .35), M(0x7a6650), 0, .45, s * 1.1, t);
    addCol(4, 4, 1.7); }
  // med tent
  { const t = new THREE.Group(); t.position.set(SPOTS.med.x, y0, SPOTS.med.z); t.rotation.y = .6; world.add(t);
    const cloth = M(0xd8d2c0, { side: THREE.DoubleSide });
    const tent = new THREE.Mesh(new THREE.CylinderGeometry(.01, 3.2, 3.2, 4, 1, true), cloth); tent.rotation.y = Math.PI / 4; tent.scale.set(1, 1, 1.6); tent.position.y = 1.6; tent.castShadow = true; t.add(tent);
    mesh(new THREE.BoxGeometry(2.2, .5, .9), M(0x3d6e8a), 1.8, .9, 1.6, t).rotation.y = .3;   // blue stripe banner
    mesh(new THREE.BoxGeometry(1.9, .5, .8), M(0x9a9a92), 0, .3, -1.4, t);                      // cot
    for (const [x, z] of [[2, -1.8], [2.6, -1.2]]) mesh(new THREE.BoxGeometry(.6, .5, .5), M(0x6a7a5a), x, .25, z, t);
    addCol(SPOTS.med.x, SPOTS.med.z, 2.8); }
  // workbench: table, vice, scrap pile, lamp
  { const t = new THREE.Group(); t.position.set(SPOTS.bench.x, y0, SPOTS.bench.z); t.rotation.y = -.7; world.add(t);
    const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0x9a7e60 });
    mesh(new THREE.BoxGeometry(3, .15, 1.2), wood, 0, 1, 0, t);
    for (const [x, z] of [[-1.35, -.5], [1.35, -.5], [-1.35, .5], [1.35, .5]]) mesh(new THREE.BoxGeometry(.14, 1, .14), wood, x, .5, z, t);
    mesh(new THREE.BoxGeometry(.3, .3, .4), M(0x3a5a7a), -.9, 1.25, 0, t);
    for (let i = 0; i < 8; i++) { const s = mesh(new THREE.BoxGeometry(rr(.4, 1), rr(.05, .3), rr(.3, .8)), M(pick([0x8a8c8c, 0x6d7276, 0x9a6040])), 2.2 + rr(-.6, .6), rr(.1, .6), rr(-.7, .7), t); s.rotation.set(rnd(), rnd(), rnd()); }
    mesh(new THREE.BoxGeometry(.5, .4, .3), M(0x2e2e2e), .7, 1.28, -.3, t);
    addCol(SPOTS.bench.x, SPOTS.bench.z, 1.8); }
  // armory crates
  { const t = new THREE.Group(); t.position.set(SPOTS.armory.x, y0, SPOTS.armory.z); world.add(t);
    for (const [x, y, z, r] of [[0, .4, 0, .1], [1.1, .4, .2, -.2], [.5, 1.2, .1, .4], [-1, .4, .4, .3]]) { const c = mesh(new THREE.BoxGeometry(1, .8, .7), M(0x4f5a3a), x, y, z, t); c.rotation.y = r; mesh(new THREE.BoxGeometry(1.02, .12, .72), M(0x2e3424), x, y, z, t).rotation.y = r; }
    addCol(SPOTS.armory.x, SPOTS.armory.z, 1.6); }
  // generator + cable spools + drums for clutter
  for (const [x, z] of [[24, 12], [-26, 16], [27, 4], [-14, 26], [16, -6], [-30, -14]]) {
    const d = mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 10), M(pick([0x5a6a7a, 0x7a3a2a, 0x3a5a3a])), x, H0 + .55, z, world); addCol(x, z, .5);
  }
  { const g = new THREE.Group(); g.position.set(26, H0, 9); world.add(g); mesh(new THREE.BoxGeometry(2, 1.3, 1.2), M(0x6b7a3a), 0, .65, 0, g); mesh(new THREE.CylinderGeometry(.12, .12, 1.2, 6), M(0x333333), .6, 1.6, 0, g); addCol(26, 9, 1.3); }
  // string lights between the fire and the hull
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd890 }), 40);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 40; i++) { const t = i / 39; const x = lerp(-6, 16, t), z = lerp(13, -2, t); dm.position.set(x, H0 + 4.2 - Math.sin(t * Math.PI) * 1.4, z); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); }
  world.add(bulbs);
  campLight = new THREE.PointLight(0xffd9a0, 0, 70, 0); campLight.position.set(0, H0 + 14, 14); world.add(campLight);
  smokeGroup = new THREE.Group(); smokeGroup.position.set(SPOTS.smoke.x, H0, SPOTS.smoke.z); world.add(smokeGroup);
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
    const x = rr(-40, 40), z = rr(56, 128); if (pathDist(x, z) < 4) continue;
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
  for (let i = 0; i < 9; i++) spawnScrap(rr(-34, 34), rr(56, 124), 'field');
  for (let i = 0; i < 110; i++) { const a = rnd() * Math.PI * 2, r = rr(70, VALLEY - 20); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) > 110 || waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'wild'); }
}
