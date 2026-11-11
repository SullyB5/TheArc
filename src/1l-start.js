/* ================= the first twenty minutes (Nov 11): the crash tower, and the road to Kestrel =================
   Bryce: the section you wake beside shouldn't be lying on its side — it came down nose-first and stuck, standing on end,
   and you can get inside it and shelter. Then the walk to Kestrel should have something on it.

   · DROP_TOWER: a length of the Arc, 6 m across, buried nose-down in the furrow and leaning a little. A torn gap at the
     foot faces where you wake; inside, four decks joined by stairs that switch back up the wall (the station's own deck
     plate, crew pods, a mess table, a comms deck, the lookout at the top where the skin has torn open). The gap has a
     sliding plate you can shut (E): shut, the tower keeps the red fog out like the Arc does (`dropSafe`, used by
     `inShelter`), and the rain stays out whether it's shut or not.
   · The road (PATHS: the dropsite → (-150, 222) → (-60, 160) → (0, 104) → the gate): hull plates and seats that came
     down with the section, strung out along the way; a painted trail marker; an escape pod that came down by itself
     (a pod locker, someone who didn't make it, their log); the camp the first survivors made on night one and left; the
     outer marker at the fork; rib posts with lamps up the last stretch to the gate.
   Everything here has its own random stream (srnd), so it never moves anything else in the world. */
let ST_S = 2611;
const srnd = () => (ST_S = (ST_S * 16807) % 2147483647, (ST_S - 1) / 2147483646), sr = (a, b) => a + srnd() * (b - a), spk = a => a[Math.floor(srnd() * a.length)];
const DROP_TOWER = { dyn: [], R: 6, DECK: [.2, 4.4, 8.6, 12.8], door: null, x: 0, z: 0, y: 0, ry: 0, lean: .02 };
const inDropTower = (x, z) => Math.hypot(x - DROP_TOWER.x, z - DROP_TOWER.z) < DROP_TOWER.R - .25;
const dropSafe = () => inDropTower(P.x, P.z) && DROP_TOWER.door && DROP_TOWER.door.shut && DROP_TOWER.door.t < .08;

function buildDropTower(D) {
  ST_S = 2611;
  const T = DROP_TOWER, R = T.R, y0 = heightAt(D.x, D.z), ent = Math.atan2(DROP_WAKE[0], DROP_WAKE[1]);
  T.x = D.x; T.z = D.z; T.y = y0; T.ry = ent;
  const g = new THREE.Group(); g.position.set(D.x, y0, D.z); g.rotation.set(0, ent, 0); world.add(g);
  const lean = new THREE.Group(); lean.rotation.set(-T.lean * .6, 0, T.lean); g.add(lean);     // leaning away from the gap, a little to one side
  const K = shipKit(hkit(LOW)), KI = shipKit(hkit(LOW));
  const L2W = (lx, lz) => [D.x + lx * Math.cos(ent) + lz * Math.sin(ent), D.z - lx * Math.sin(ent) + lz * Math.cos(ent)];
  const GAP = .29, TOP = 17.5;                           // half-angle of the torn gap at the foot; the skin's height (ragged above)
  const plateC = [0xd4d2ca, 0xc4c2ba, 0xb8b6ae, 0xa8a49a, 0x9a948a, 0x8a8478];
  // ---- the skin: vertical runs of hull panel round the drum, ragged at the top, torn open at the foot and at the lookout ----
  const NS = 28, sw = 2 * Math.PI * R / NS;
  const lookHoles = [.9, 2.3, 3.6, 5.0].map(a => [a + sr(-.15, .15), sr(.45, .62)]);
  for (let i = 0; i < NS; i++) {
    const a = (i + .5) / NS * Math.PI * 2, dA = Math.abs(angWrap(a)), top = TOP + sr(-3.2, 1.6) - (i % 7 === 3 ? 3 : 0);
    let y = -1.2; const gapTop = dA < GAP ? 3.1 + sr(0, 1.1) : -9;
    const look = lookHoles.find(([c, w]) => Math.abs(angWrap(a - c)) < w);
    while (y < top - .05) {
      const rh = Math.min(top - y, sr(1.1, 1.6)), yc = y + rh / 2;
      const skip = (yc < gapTop) || (look && yc > T.DECK[3] + .8);
      if (!skip) { const m = htm(Math.sin(a) * R, yc, Math.cos(a) * R, sr(-.03, .03), a, sr(-.02, .02)); K.geo('hull', (() => { const b = new THREE.BoxGeometry(sw + .06, rh - .02, .1); boxUV(b, sw, rh, .1, 2, srnd() * 9, srnd() * 9); return b; })(), m, tint(srnd() < .09 ? spk([0x8a6a52, 0x6a6e70, 0x9a948a]) : 0xc4c2ba, .05));
        if (srnd() < .06 && rh > .8) stencil(K.at(htm(Math.sin(a) * (R + .06), yc, Math.cos(a) * (R + .06), 0, a, 0)), spk([0, 1, 2, 3, 4, 7]), sw * .8, .6, 0, 0, 0), K.at(null); }
      y += rh;
    }
    // the inside face: a darker lining, so the drum reads from in there
    if (!(dA < GAP)) KI.box('hull', sw, top - .4, .04, Math.sin(a) * (R - .14), (top - .4) / 2 - .2, Math.cos(a) * (R - .14), 0, a, 0, tint(0x7a7e80, .06), 2);
    else KI.box('hull', sw, top - 4.4, .04, Math.sin(a) * (R - .14), 4.2 + (top - 4.4) / 2, Math.cos(a) * (R - .14), 0, a, 0, tint(0x7a7e80, .06), 2);
  }
  // torn lips: plates bent outward round the top and round the gap, cables hanging
  for (let i = 0; i < 26; i++) { const a = sr(0, 6.28), y = TOP + sr(-3.5, .8); K.box('hull', sr(.6, 1.6), sr(.8, 2.2), .08, Math.sin(a) * (R + .3), y, Math.cos(a) * (R + .3), sr(-.7, .3), a, sr(-.6, .6), tint(spk(plateC), .06)); }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const a = s * (GAP + .02), y = .4 + k * .8; K.box('hull', .9, .7, .08, Math.sin(a) * (R + .25), y, Math.cos(a) * (R + .25), 0, a + s * sr(.4, .9), sr(-.3, .3), tint(spk(plateC), .06)); }
  for (let i = 0; i < 7; i++) { const a = sr(0, 6.28), L = sr(2, 5); K.cyl('plain', .035, .035, L, 4, Math.sin(a) * (R + .15), TOP - 1 - L / 2, Math.cos(a) * (R + .15), sr(-.1, .1), 0, sr(-.1, .1), spk([0x1e1e1e, 0x8a2a22, 0x2a4a6a])); }
  // ribs round the outside at each deck, a couple sprung loose; two spine beams up the back; fins
  for (const [k, y] of T.DECK.entries()) { const br = srnd() < .3, arc = br ? sr(3.2, 5) : Math.PI * 2; const rg = new THREE.TorusGeometry(R + .28, .2, 5, 36, arc); rg.rotateX(HP); rg.rotateY(sr(0, 6)); K.geo('metal', rg, htm(0, y - .1, 0), tint(0xd0cec6, .04)); }
  for (const a of [Math.PI - .4, Math.PI + .4]) { K.box('metal', .35, TOP - 1, .5, Math.sin(a) * (R + .4), (TOP - 1) / 2 - .5, Math.cos(a) * (R + .4), 0, a, 0, 0xc8c6be); for (let y = 2; y < TOP - 2; y += 4.2) K.box('metal', .25, 2.2, 1, Math.sin(a) * (R + 1), y, Math.cos(a) * (R + 1), 0, a, sr(-.2, .2), 0xc8c6be); }
  // the foot: buried in the furrow — heaped earth round the base, scorch, chunks of rock thrown up
  for (let i = 0; i < 30; i++) { const a = i / 30 * 6.28 + sr(-.1, .1); if (Math.abs(angWrap(a)) < GAP + .15) continue; const r = R + sr(.3, 2.2), s = sr(.5, 1.4); const dg = new THREE.DodecahedronGeometry(s, 0); dg.scale(1.4, .55, 1.2); K.geo('rock', dg, htm(Math.sin(a) * r, s * .2 - .1, Math.cos(a) * r, 0, a, 0), tint(0x5a4e40, .1)); }
  // the gap: a sill of bent deck to step over, hazard paint, a keypad that no longer does anything
  K.box('metal', 3.4, .16, 1.2, 0, .08, R - .2, 0, 0, 0, 0x4a4c4e);
  for (let k = 0; k < 8; k++) K.box('plain', .4, .01, .25, -1.4 + k * .4, .17, R - .2, 0, .6, 0, k % 2 ? 0x1e1e1e : 0xd9a32a);

  // ---- inside: four decks of plate on joists, a stair up the wall between each, the deck below's hole cut out ----
  const RIN = R - .3, RAMP = { d: 2.6, hw: 1.05, x0: -3.6, x1: 3.6 }, side = k => k % 2 ? 1 : -1;      // ramp k (deck k → k+1) runs along z = side(k)·d
  const holeOf = k => k > 0 ? [RAMP.x0 - .1, side(k - 1) * RAMP.d - RAMP.hw - .05, RAMP.x1 + .1, side(k - 1) * RAMP.d + RAMP.hw + .05] : null;
  T.DECK.forEach((dy, k) => {
    const H = holeOf(k), cell = .9;
    for (let x = -RIN; x < RIN; x += cell) for (let z = -RIN; z < RIN; z += cell) {
      const cx = x + cell / 2, cz = z + cell / 2; if (Math.hypot(cx, cz) > RIN - .2) continue;
      if (H && cx > H[0] && cx < H[2] && cz > H[1] && cz < H[3]) continue;
      KI.box('hull', cell - .02, .14, cell - .02, cx, dy - .07, cz, 0, sr(-.01, .01), 0, tint(spk([0x6e7274, 0x7a7e80, 0x666a6c, 0x84867e]), .04), .9);
    }
    if (k > 0) for (const jz of [-3.6, -1.2, 1.2, 3.6]) KI.box('metal', 2 * Math.sqrt(Math.max(0, RIN * RIN - jz * jz)) - .2, .22, .14, 0, dy - .26, jz, 0, 0, 0, 0x4a4c4e);
    // walkable: the deck as rectangles (the walls keep you inside the drum), minus the stair hole
    for (const [a, b, c, d] of H ? rectMinus([-RIN, -RIN, RIN, RIN], [H]) : [[-RIN, -RIN, RIN, RIN]]) {
      const [wx, wz] = L2W((a + c) / 2, (b + d) / 2); FLOORS.push({ cx: wx, cz: wz, c: Math.cos(ent), s: Math.sin(ent), hw: (c - a) / 2, hd: (d - b) / 2, y: y0 + dy });
    }
    if (k === T.DECK.length - 1) return;
    // the stair to the next deck: treads on stringers, a yellow rail on the open side
    const s = side(k), zc = s * RAMP.d, up = s < 0 ? 1 : -1, rise = T.DECK[k + 1] - dy, L = RAMP.x1 - RAMP.x0, n = 16;
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, x = up > 0 ? RAMP.x0 + t * L : RAMP.x1 - t * L; KI.box('metal', L / n + .03, .05, RAMP.hw * 2, x, dy + (i + 1) * rise / n, zc, 0, 0, 0, i % 4 ? 0x5a5e60 : 0xd9a32a); }
    for (const e of [-1, 1]) KI.box('metal', Math.hypot(L, rise), .24, .08, 0, dy + rise / 2 - .12, zc + e * RAMP.hw, 0, 0, up * Math.atan2(rise, L), 0x3a3c3e);
    KI.box('plain', Math.hypot(L, rise), .06, .06, 0, dy + rise / 2 + 1, zc - s * (RAMP.hw + .04), 0, 0, up * Math.atan2(rise, L), 0xd9a32a);
    for (let i = 1; i < 5; i++) { const t = i / 5; KI.box('metal', .04, 1, .04, up > 0 ? RAMP.x0 + t * L : RAMP.x1 - t * L, dy + t * rise + .5, zc - s * (RAMP.hw + .04), 0, 0, 0, 0x4a4c4e); }
    const [wx, wz] = L2W(0, zc); FLOORS.push({ cx: wx, cz: wz, c: Math.cos(ent), s: Math.sin(ent), hw: L / 2, hd: RAMP.hw, y: y0 + dy + rise / 2, slope: up * rise / L });
  });
  // the walls: a ring of posts all the way up, open at the gap; above the gap a wall only from the first deck up
  for (let i = 0; i < 56; i++) { const a = i / 56 * Math.PI * 2; if (Math.abs(angWrap(a)) < GAP + .03) continue; const [x, z] = L2W(Math.sin(a) * (R + .05), Math.cos(a) * (R + .05)); addCol(x, z, .42); }
  const Q = { x: D.x, z: D.z, yaw: ent }; siteFrame(Q);
  { const a0 = -GAP - .05, a1 = GAP + .05; cwall(Q, Math.sin(a0) * R, Math.cos(a0) * R, Math.sin(a1) * R, Math.cos(a1) * R, y0 + 3.2, y0 + 30, .3); }
  // the door: a plate on a runner across the gap — shut it and the drum keeps the fog out
  { const dg = new THREE.Group(); lean.add(dg); const DK = shipKit(hkit(LOW));
    DK.box('hull', 3.3, 3.1, .12, 0, 1.6, 0, 0, 0, 0, 0xb4b2aa, 2); for (let k = 0; k < 9; k++) DK.box('plain', .36, .2, .02, -1.45 + k * .36, .25, .07, 0, 0, .6, k % 2 ? 0x1e1e1e : 0xd9a32a);
    DK.box('metal', .12, .5, .1, 1.3, 1.5, .1, 0, 0, 0, 0x3a3c3e); stencil(DK, 0, 1.4, .6, 0, 2.3, .07, 0); DK.build(dg);
    K.box('metal', 7.6, .18, .25, 0, 3.35, R + .02, 0, 0, 0, 0x3a3c3e);                                       // the runner
    const W = cwall(Q, -1.7, R - .05, 1.7, R - .05, y0 - 1, y0 + 3.2, .25); W.on = false;
    const st = (G.flags.dropDoor ??= 0);
    T.door = { g: dg, W, shut: !!st, t: st ? 0 : 1 }; T.dyn.push(dg);
    const put = () => { const t = T.door.t, a = GAP * 2.6 * t; dg.position.set(Math.sin(a) * (R + .15), 0, Math.cos(a) * (R + .15)); dg.rotation.y = a; };
    let last = null; put(); DECOR_ANIM.push(tt => { const dt = last == null ? 0 : Math.min(.1, Math.max(0, tt - last)); last = tt; const want = T.door.shut ? 0 : 1; if (Math.abs(T.door.t - want) > .002) { T.door.t += Math.sign(want - T.door.t) * Math.min(Math.abs(want - T.door.t), dt * .9); put(); } T.door.W.on = T.door.t < .5; });   // about a second to slide
    const inS = L2W(0, R - 2), outS = L2W(0, R + 2.2);
    INTERACT.push({ id: 'dropdoor', at: () => inDropTower(P.x, P.z) ? { x: inS[0], z: inS[1] } : { x: outS[0], z: outS[1] }, r: 3,
      label: () => P.y > y0 + 2.5 ? null : T.door.shut ? 'Slide the plate open' : 'Slide the plate shut (keeps the red fog out)',
      act: () => { T.door.shut = !T.door.shut; G.flags.dropDoor = T.door.shut ? 1 : 0; sfx('gate'); toast(T.door.shut ? (inDropTower(P.x, P.z) ? 'Shut in · the fog can’t get in here' : 'Plate shut') : 'Plate open', 2.2); } });
  }

  // ---- what's on each deck ----
  const F = T.DECK, lp = (name, list) => npInst(lean, name, list, false);
  // deck 0, the one you walk into: the section's emergency lockers, a medkit on the wall, gas and fuel cells, crates
  lp('locker', [[-4.2, F[0], -2.2, HP + .3], [-4.6, F[0], -.8, HP + .2]]);
  lp('medkit-small', [[RIN - .05, F[0] + 1.3, 1.2, -HP]]); lp('gas-bottle', [[3.9, F[0], -3.2], [4.3, F[0], -2.7, 1]]); lp('fuel-cell', [[3.2, F[0], 2.6], [3.8, F[0], 2.1, 1.2], [2.9, F[0], 1.8, 2]]);
  for (let i = 0; i < 3; i++) crate(KI, -1.6 + i * .7, F[0], 3.6 + (i % 2) * .4, sr(-.3, .3), 1, 0x5a6a4a);
  lp('keypad-panel', [[1.95, F[0] + 1.1, R - .3, Math.PI, .4]]);
  // deck 1, crew: pods along the wall, a table with the seats, a locker of kit
  lp('bed', [[-4.6, F[1], 1.6, 0], [-4.2, F[1], 3.0, -.35], [4.4, F[1], 2.2, Math.PI + .3]]);
  KI.box('hull', 1.8, .06, .9, .4, F[1] + .78, .9, 0, .2, 0, 0xc4c2ba, 1.5); for (const [dx, dz] of [[-.75, -.35], [.75, -.35], [-.75, .35], [.75, .35]]) KI.box('metal', .05, .76, .05, .4 + dx, F[1] + .38, .9 + dz, 0, .2, 0, 0x3a3c3e);
  lp('chairs-x4', [[.2, F[1], 2.1, Math.PI + .2, .7]]);
  // deck 2, comms: the section's console still lit, a rack, a radio, stores
  lp('computer-console', [[0, F[2], 4.2, Math.PI, .85]]); lp('server-rack', [[3.8, F[2], -2.6, -HP]]); lp('wall-screen', [[0, F[2] + 1.9, 5.45, Math.PI, .6]]);
  for (let i = 0; i < 4; i++) crate(KI, -4.2 + (i % 2) * .7, F[2] + Math.floor(i / 2) * .46, -1.6 + (i % 2) * .5, sr(-.3, .3), 1, 0x6a5a44);
  // deck 3, the lookout: the skin torn open on four sides; seats facing Kestrel, a lamp, sandbags at the holes
  { const toK = Math.atan2(-D.x, -D.z) - ent; lp('chairs-x4', [[Math.sin(toK) * 2.4, F[3], Math.cos(toK) * 2.4, toK, .7]]);
    for (const [c] of lookHoles) for (let k = -1; k <= 1; k++) { const a = c + k * .16, sg = new THREE.BoxGeometry(.7, .26, .42); KI.geo('cloth', sg, htm(Math.sin(a) * (R - .5), F[3] + .14, Math.cos(a) * (R - .5), 0, a, 0), tint(0x5a5242)); } }
  // light: an emergency lamp on each deck (warm, a little red), a beacon on top you can see from the road
  for (let k = 0; k < 4; k++) { const a = k * 1.7 + .8; KI.box('glow', .3, .12, .06, Math.sin(a) * (RIN - .1), F[k] + 2.6, Math.cos(a) * (RIN - .1), 0, a, 0, 0xffa060); }
  const lamps = [[0, F[0] + 3, 0, 0xffb070, 1.6], [0, F[2] + 3, 0, 0xffc890, 1.2]].map(([x, y, z, c, i]) => { const l = new THREE.PointLight(c, i, 14, 1.4); l.position.set(x, y, z); lean.add(l); return l; });
  { const bk = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a1a, toneMapped: false })); bk.position.set(Math.sin(Math.PI) * (R + .4), TOP - 1.4, Math.cos(Math.PI) * (R + .4)); lean.add(bk); T.dyn.push(bk); DECOR_ANIM.push(t => { bk.visible = (t % 1.6) < .5; }); }
  DECOR_ANIM.push(() => { const near = Math.hypot(camera.position.x - D.x, camera.position.z - D.z) < 60; for (const l of lamps) l.visible = near; });
  K.build(lean); KI.build(lean, false, true);
  lean.traverse(o => { if (o.isMesh && o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius < 1.2) o.castShadow = false; });
  // lootable: the deck lockers and the comms stores (new ids; the old section locker outside keeps its own)
  { const [x, z] = L2W(-4.4, -1.5); cache(world, x, z, ent + HP, 'none', 'arc', { id: 'drop_tw_lock', name: 'Section emergency locker', rolls: 2, keys: ['bandage', 'canned'], refill: 4, y: y0 + F[0], noCol: true }).g.visible = false; }
  { const [x, z] = L2W(-4, -1.4); cache(world, x, z, ent, 'none', 'arc', { id: 'drop_tw_store', name: 'Comms deck stores', rolls: 2, refill: 5, y: y0 + F[2] }); }
  SHELTERS.push({ x: D.x, z: D.z, kind: 'arc', r: 0 });
}

/* ---------- the road to Kestrel ---------- */
const START_ROAD = [[-232, 268], [-150, 222], [-60, 160], [0, 104], [0, 66]];
function roadAt(t) {          // t in metres along START_ROAD → point, direction, normal
  let s = t;
  for (let i = 0; i < START_ROAD.length - 1; i++) { const [ax, az] = START_ROAD[i], [bx, bz] = START_ROAD[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (s <= L || i === START_ROAD.length - 2) { const k = Math.min(1, s / L), dx = (bx - ax) / L, dz = (bz - az) / L; return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, dx, dz, nx: -dz, nz: dx }; } s -= L; }
}
const roadLen = () => { let s = 0; for (let i = 0; i < START_ROAD.length - 1; i++) s += Math.hypot(START_ROAD[i + 1][0] - START_ROAD[i][0], START_ROAD[i + 1][1] - START_ROAD[i][1]); return s; };
function buildStartRoad() {
  ST_S = 5150;
  const g = new THREE.Group(); world.add(g); const K = shipKit(hkit(LOW)), LEN = roadLen();
  const off = (t, sd) => { const p = roadAt(t); return [p.x + p.nx * sd, p.z + p.nz * sd, p]; };
  const clear = (x, z, r) => pathDist(x, z) > r + 2.4 && waterAt(x, z) < heightAt(x, z) - .3;
  const plateC = [0xd4d2ca, 0xc4c2ba, 0xb8b6ae, 0xa8a49a, 0x9a948a, 0x3a3631];
  // what came down with the section: hull plates, ribs and seats strung out along the first half, thinning out
  for (let i = 0; i < 26; i++) { const t = Math.pow(i / 26, 1.4) * LEN * .6 + sr(0, 8), sd = (srnd() < .5 ? -1 : 1) * sr(4, 16), [x, z] = off(t, sd); if (!clear(x, z, 1)) continue; const y = heightAt(x, z), r = srnd();
    if (r < .55) { K.box('hull', sr(1.2, 3.6), .12, sr(1, 2.4), x, y + .25, z, sr(-.5, .5), sr(0, 6), sr(-.4, .4), tint(spk(plateC), .05), 2); if (srnd() < .4) addCol(x, z, .9, 1); }
    else if (r < .75) { const rg = new THREE.TorusGeometry(sr(2, 3.5), .16, 5, 10, sr(.8, 1.8)); K.geo('metal', rg, htm(x, y - .4, z, sr(-.4, .4), sr(0, 6), sr(1.2, 1.9)), 0xd0cec6); }
    else { const sg = new THREE.Group(); mesh(new THREE.BoxGeometry(.6, .12, .6), M(0x4a4e52), 0, .45, 0, sg); mesh(new THREE.BoxGeometry(.6, .7, .1), M(0x3a3e42), 0, .8, -.28, sg); sg.position.set(x, y, z); sg.rotation.set(sr(-1.4, 1.4), sr(0, 6), sr(-.3, .3)); g.add(sg); }
    if (srnd() < .3) { const sc = new THREE.Mesh(new THREE.CircleGeometry(sr(1.2, 2.4), 10), new THREE.MeshLambertMaterial({ color: 0x1e1b18, transparent: true, opacity: .6, depthWrite: false })); sc.rotation.x = -HP; sc.position.set(x, y + .05, z); g.add(sc); }
  }
  // 1. a trail marker: a length of rib stood up by the road, a plate painted KESTREL with an arrow, a flare can at its foot
  { const [x, z, p] = off(38, -3.6), y = heightAt(x, z), yaw = Math.atan2(p.dx, p.dz);
    K.box('metal', .3, 3.2, .4, x, y + 1.5, z, 0, 0, sr(-.06, .06), 0xd0cec6); K.box('hull', 1.8, .7, .06, x, y + 2.5, z, 0, yaw + HP, 0, 0xc4c2ba, 2);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .62), hSignMat('KESTREL →', 'stencil')); const n = [Math.cos(yaw + HP), -Math.sin(yaw + HP)]; sg.position.set(x + Math.sin(yaw + HP) * .04, y + 2.5, z + Math.cos(yaw + HP) * .04); sg.rotation.y = yaw + HP; g.add(sg);
    const sg2 = sg.clone(); sg2.position.set(x - Math.sin(yaw + HP) * .04, y + 2.5, z - Math.cos(yaw + HP) * .04); sg2.rotation.y = yaw - HP; g.add(sg2);
    K.cyl('metal', .06, .06, .3, 8, x + .3, y + .15, z + .2, 0, 0, 0, 0xc03a22); addCol(x, z, .3); }
  // 2. an escape pod that came down by itself, in a short furrow of its own: the hatch blown, its locker, who was in it
  { const t = LEN * .3, [x, z, p] = off(t, 13), y = heightAt(x, z), yaw = Math.atan2(p.nx, p.nz) + .5; START_SPOTS.pod = { x, z, y, yaw };
    const pg = new THREE.Group(); pg.position.set(x, y + .6, z); pg.rotation.set(.18, yaw, .3); g.add(pg); const PK = shipKit(hkit(LOW));
    const body = new THREE.SphereGeometry(1.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * .78); body.scale(1, 1.25, 1); PK.geo('hull', body, htm(0, .4, 0, Math.PI, 0, 0), 0xd4d2ca);
    PK.cyl('metal', 1.52, 1.52, .3, 16, 0, -.2, 0, 0, 0, 0, 0x6a6e70); PK.cyl('metal', 1.2, 1.4, .5, 16, 0, -.6, 0, 0, 0, 0, 0x2a2826);
    PK.box('win', 1.1, 1.3, .1, 0, .5, 1.42, -.2, 0, 0); PK.box('hull', 1.2, 1.4, .08, 1.7, -.5, 1.8, .9, .5, .7, 0xc4c2ba, 1.5);      // the hatch, blown off
    for (let k = 0; k < 3; k++) stencil(PK.at(htm(0, 0, 0)), [2, 7, 6][k], .9, .4, Math.sin(k * 2.1 + 1) * 1.53, .2 + k * .3, Math.cos(k * 2.1 + 1) * 1.53, k * 2.1 + 1);
    PK.at(null); PK.build(pg); addCol(x, z, 1.7, 3);
    for (let i = 0; i < 6; i++) { const [fx, fz] = [x - Math.sin(yaw) * (3 + i * 1.6), z - Math.cos(yaw) * (3 + i * 1.6)]; const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), new THREE.MeshLambertMaterial({ color: 0x2a231c, transparent: true, opacity: .6, depthWrite: false })); sc.rotation.set(-HP, 0, yaw); sc.position.set(fx, heightAt(fx, fz) + .05, fz); g.add(sc); } }
  // 3. the first night's camp: a hull plate propped as a lean-to, a tarp, bedrolls, a cold fire, a crate they couldn't carry
  { const t = LEN * .55, [x, z, p] = off(t, -11), y = heightAt(x, z), yaw = Math.atan2(p.dx, p.dz); START_SPOTS.camp = { x, z, y, yaw };
    const cg = new THREE.Group(); cg.position.set(x, y, z); cg.rotation.y = yaw; g.add(cg); const CK = shipKit(hkit(LOW));
    CK.box('hull', 3.6, .08, 2.4, 0, 1.2, -.6, .55, 0, 0, 0xb8b6ae, 2); for (const s of [-1.6, 1.6]) CK.box('metal', .12, 2.1, .12, s, 1, .4, 0, 0, 0, 0x55585a);
    const tg = new THREE.PlaneGeometry(3, 1.6, 4, 3); const tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 3) * .05); tg.computeVertexNormals(); CK.geo('cloth', tg, htm(0, .8, -1.6, -.9, 0, 0), 0x6a7a4a);
    for (let k = 0; k < 3; k++) { CK.box('cloth', .7, .1, 1.8, -1 + k * 1, .05, -.6, 0, sr(-.2, .2), 0, tint(spk(CLOTHC))); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; CK.box('rock', .3, .2, .25, Math.cos(a) * .7, .1, 2.2 + Math.sin(a) * .7, 0, a, 0, 0x6a6660); } CK.box('plate', .9, .06, .5, 0, .06, 2.2, 0, .5, 0, 0x1e1a16);
    for (let i = 0; i < 3; i++) CK.cyl('metal', .1, .08, .14, 8, .8 + i * .25, .07, 1.2, 0, 0, 0, spk([0x6a7a8a, 0x8a5a3a]));
    CK.build(cg); addCol(x, z, 1.8, 2); }
  // 4. the outer marker at the fork: two rib posts and a cross plate — KESTREL, the walk's nearly done — and a water drum
  { const [x, z, p] = off(LEN - 75, 0); const y = heightAt(x, z), yaw = Math.atan2(p.dx, p.dz);
    for (const s of [-1, 1]) { const px = x + p.nx * s * 4.2, pz = z + p.nz * s * 4.2; K.box('metal', .35, 4.6, .45, px, heightAt(px, pz) + 2.1, pz, 0, yaw, 0, 0xd0cec6); addCol(px, pz, .35); }
    // the cross plate runs post to post, across the road (yaw puts its width along the road's normal), sitting on the post tops
    const py = Math.min(heightAt(x + p.nx * 4.2, z + p.nz * 4.2), heightAt(x - p.nx * 4.2, z - p.nz * 4.2)) + 4.1;
    K.box('hull', 9.2, .9, .14, x, py, z, 0, yaw, 0, 0x9a948a, 2);
    for (const f of [-1, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.4, .8), hSignMat('KESTREL', 'stencil')); sg.position.set(x + p.dx * .09 * f, py, z + p.dz * .09 * f); sg.rotation.y = f < 0 ? yaw + Math.PI : yaw; g.add(sg); }   // readable from both ways
    const [bx, bz] = [x + p.nx * 5.6, z + p.nz * 5.6]; barrel(K, bx, heightAt(bx, bz), bz, 0x3a5a7a); addCol(bx, bz, .4); }
  // 5. the last stretch: rib posts with lamps both sides of the road up to the gate (lit after dark)
  for (let t = LEN - 60; t < LEN - 2; t += 9) for (const s of [-1, 1]) { const [x, z] = off(t, s * 4.6); if (Math.abs(z - (CAMP_R + 34)) < 5 || campD(x, z) < CAMP_R + 2) continue; const y = heightAt(x, z);
    K.box('metal', .22, 3.6, .3, x, y + 1.8, z, 0, 0, 0, 0xc8c6be); K.box('metal', .7, .08, .08, x - s * .3, y + 3.55, z, 0, 0, 0, 0x4a4c4e); K.box('win', .2, .14, .2, x - s * .6, y + 3.42, z, 0, 0, 0); addCol(x, z, .2); }
  K.build(g);
}
const START_SPOTS = {};
// the places along the road, worked out from the road alone (no randomness), so the forest can keep off them before they're built
const startPts = () => { const LEN = roadLen(), o = (t, sd) => { const p = roadAt(t); return [p.x + p.nx * sd, p.z + p.nz * sd]; }; return [[...o(LEN * .3, 13), 9], [...o(LEN * .55, -11), 9], [...o(LEN - 75, 0), 7], [...o(38, -3.6), 3]]; };
let START_PTS = null;
function startClear(x, z) { START_PTS ||= startPts(); for (const [px, pz, r] of START_PTS) if (Math.abs(x - px) < r && Math.abs(z - pz) < r) return true; return false; }
// notes and loot that need the explore system: run last, after everything else is in the world
function startLate() {
  const s0 = seed; seed = 4040404;
  LOGS.start_tower = { at: 'The crash tower · lookout', kind: 'note', t: 'Chalked on the lookout deck', by: 'Unsigned', b: 'Smoke to the north-east, every morning. People. The old road runs that way past the marker — follow the white plates.\n\nWe stood the night watch up here. If you shut the plate at the bottom, the red stuff stays out. We found that out the hard way.' };
  LOGS.start_pod = { at: 'The road to Kestrel · an escape pod', kind: 'note', t: 'A crew card, written on the back', by: 'Tech. Iris Calloway, Deck 4', b: 'Pod 12 came off before the section did. Hit hard. My leg is wrong. I can see the section from here, standing on its nose like a grave marker.\n\nIf you find this: the locker has water. I couldn’t reach it.' };
  LOGS.start_camp = { at: 'The road to Kestrel · the first camp', kind: 'note', t: 'A note weighed down with a stone', by: 'Kade', b: 'Six of us made it this far the first night. We’re going on to the walls — there are people there, and they have a fire. Whoever comes after: keep on the road, keep the plates on your left, and don’t stop when it gets dark.\n— K.' };
  const pod = START_SPOTS.pod, camp = START_SPOTS.camp;
  if (pod) { const c = (dx, dz) => [pod.x + Math.sin(pod.yaw) * dz + Math.cos(pod.yaw) * dx, pod.z + Math.cos(pod.yaw) * dz - Math.sin(pod.yaw) * dx];
    { const [x, z] = c(0, 2.6); xSkeleton(world, x, heightAt(x, z), z, pod.yaw + 2.6, 1); xNote(world, 'start_pod', x + .5, heightAt(x, z) + .02, z + .2, pod.yaw); }
    { const [x, z] = c(-2, -.6); if (npHas('locker')) npCache(world, 'locker', 1.4, x, z, pod.yaw, 'arc', { id: 'start_pod', name: 'Pod locker', rolls: 2, keys: ['water_boiled'], refill: 0, front: .3 }); } }
  if (camp) { const c = (dx, dz) => [camp.x + Math.sin(camp.yaw) * dz + Math.cos(camp.yaw) * dx, camp.z + Math.cos(camp.yaw) * dz - Math.sin(camp.yaw) * dx];
    { const [x, z] = c(.6, 1.4); xNote(world, 'start_camp', x, heightAt(x, z) + .05, z, camp.yaw); }
    { const [x, z] = c(2.4, -1.4); cache(world, x, z, camp.yaw, 'none', 'wild', { id: 'start_camp', name: 'A crate they left behind', rolls: 2, keys: ['rope'], refill: 4 }); } }
  { const T = DROP_TOWER, [x, z] = [T.x + Math.sin(T.ry + 2) * 3, T.z + Math.cos(T.ry + 2) * 3]; xNote(world, 'start_tower', x, T.y + T.DECK[3] + .02, z, T.ry); }
  seed = s0;
}
