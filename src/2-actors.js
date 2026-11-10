
/* ================= people ================= */
const PAL = {
  arc: [0x3b4a5a, 0x56493a, 0x4a5a48, 0x6a5040, 0x2f3d4c, 0x5a5a5e], pants: [0x2c2f33, 0x3a3530, 0x283038, 0x3d3a33],
  skin: [0xe0b090, 0xc68e6a, 0x8d5a3c, 0xf0c8a8, 0xa86f4c, 0x6e4630], hair: [0x2a1d14, 0x5a3a1e, 0x161616, 0x8a6a3a, 0xb0884a],
};
function limb(w, h, d, color, parent, x, y, z) {
  const piv = new THREE.Group(); piv.position.set(x, y, z); parent.add(piv);
  const m = mesh(new THREE.BoxGeometry(w, h, d), M(color), 0, -h / 2, 0, piv);
  return piv;
}
function makePerson(kind, o = {}) {
  const clan = kind !== 'arc';
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const S = kind === 'brute' ? 1.14 : (o.scale || 1); body.scale.setScalar(S);
  const jacket = o.jacket ?? (clan ? pick([0x3b2f25, 0x463626, 0x2f2a24]) : pick(PAL.arc));
  const pants = o.pants ?? (clan ? 0x2b241e : pick(PAL.pants));
  const skin = o.skin ?? pick(PAL.skin), hair = o.hair ?? (clan ? pick([0x161616, 0x2a1d14, 0x3a2a1a]) : pick(PAL.hair));
  const torso = mesh(new THREE.BoxGeometry(.56, .72, .32), M(jacket), 0, 1.33, 0, body);
  const head = new THREE.Group(); head.position.y = 1.7; body.add(head);
  mesh(new THREE.BoxGeometry(.3, .32, .3), M(skin), 0, .17, 0, head);
  mesh(new THREE.BoxGeometry(.32, .12, .33), M(hair), 0, .35, -.01, head);
  mesh(new THREE.BoxGeometry(.32, .22, .06), M(hair), 0, .22, -.15, head);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.05, .05, .02), M(0x111111), s * .07, .2, .155, head);
  const armL = limb(.17, .64, .17, jacket, body, -.37, 1.64, 0), armR = limb(.17, .64, .17, jacket, body, .37, 1.64, 0);
  for (const a of [armL, armR]) mesh(new THREE.BoxGeometry(.13, .13, .13), M(skin), 0, -.68, 0, a);
  const legL = limb(.21, .92, .23, pants, body, -.14, .97, 0), legR = limb(.21, .92, .23, pants, body, .14, .97, 0);
  for (const l of [legL, legR]) mesh(new THREE.BoxGeometry(.23, .14, .32), M(0x231c16), 0, -.88, .04, l);
  let weapon = null;
  if (clan) {
    mesh(new THREE.BoxGeometry(.32, .07, .02), M(0x0e0e0e), 0, .21, .156, head);             // ash band across the eyes
    mesh(new THREE.BoxGeometry(.66, .22, .42), M(0x5e4a36), 0, 1.66, 0, body);              // fur mantle
    for (const s of [-1, 1]) { const th = mesh(new THREE.ConeGeometry(.05, .3, 4), M(0xd8d0bc), s * .26, 1.82, 0, body); th.rotation.z = -s * .5; }
    mesh(new THREE.BoxGeometry(.58, .12, .34), M(0x2a1e14), 0, .98, 0, body);               // belt
    if (kind === 'brute') {
      mesh(new THREE.BoxGeometry(.34, .36, .06), M(0xd8d0bc), 0, .18, .17, head);             // bone mask
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.07, .05, .02), M(0x111111), s * .08, .2, .205, head);
      for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(.05, .35, 4), M(0xd8d0bc), s * .14, .45, 0, head); h.rotation.z = -s * .6; }
      weapon = new THREE.Group(); armR.add(weapon); weapon.position.set(0, -.68, .05);
      mesh(new THREE.CylinderGeometry(.05, .05, 1.1, 5), M(0x4a3020), 0, 0, .45, weapon).rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(.24, .24, .4), M(0x6a6660), 0, 0, 1, weapon);
    } else if (kind === 'thrower') {
      weapon = new THREE.Group(); armR.add(weapon); weapon.position.set(0, -.68, 0);
      mesh(new THREE.CylinderGeometry(.03, .03, 2, 5), M(0x6a4a2a), 0, 0, 0, weapon);
      mesh(new THREE.ConeGeometry(.06, .3, 4), M(0x9a9a92), 0, 1.1, 0, weapon);
      for (let i = 0; i < 2; i++) mesh(new THREE.CylinderGeometry(.03, .03, 1.6, 4), M(0x6a4a2a), -.15 + i * .08, 1.25, -.2, body).rotation.x = .3;
    } else {
      weapon = new THREE.Group(); armR.add(weapon); weapon.position.set(0, -.68, .05);
      mesh(new THREE.BoxGeometry(.05, .1, .7), M(0x8a8a86), 0, 0, .4, weapon);
      mesh(new THREE.BoxGeometry(.07, .07, .2), M(0x3a2a1a), 0, 0, 0, weapon);
    }
  } else if (o.pack !== false && rnd() < .5) mesh(new THREE.BoxGeometry(.4, .5, .2), M(0x4a4a3a), 0, 1.35, -.26, body);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, body, head, armL, armR, legL, legR, weapon };
}
function poseWalk(p, ph, amt) {
  const s = Math.sin(ph) * amt;
  p.legL.rotation.x = s * .75; p.legR.rotation.x = -s * .75;
  p.armL.rotation.x = -s * .6; p.armR.rotation.x = s * .6;
  p.body.position.y = Math.abs(Math.cos(ph)) * .05 * amt;
}

/* ================= animals ================= */
function makeDeer(stag) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const c = 0x8a6440, d = 0x5a4028;
  mesh(new THREE.BoxGeometry(.48, .52, 1.2), M(c), 0, 1.05, 0, body);
  mesh(new THREE.BoxGeometry(.4, .2, .9), M(0xc9b08a), 0, .82, 0, body);
  const neck = new THREE.Group(); neck.position.set(0, 1.2, .5); body.add(neck);
  mesh(new THREE.BoxGeometry(.2, .55, .22), M(c), 0, .22, .08, neck).rotation.x = .45;
  const head = new THREE.Group(); head.position.set(0, .5, .22); neck.add(head);
  mesh(new THREE.BoxGeometry(.22, .22, .42), M(c), 0, 0, .12, head);
  mesh(new THREE.BoxGeometry(.1, .1, .1), M(0x222222), 0, -.02, .34, head);
  for (const s of [-1, 1]) { const e = mesh(new THREE.BoxGeometry(.05, .18, .08), M(c), s * .14, .14, -.02, head); e.rotation.z = s * .6; }
  if (stag) for (const s of [-1, 1]) {
    const a = mesh(new THREE.BoxGeometry(.04, .5, .04), M(0xd8ccb0), s * .1, .35, -.02, head); a.rotation.z = s * .4;
    const b = mesh(new THREE.BoxGeometry(.03, .26, .03), M(0xd8ccb0), s * .2, .48, .08, head); b.rotation.set(.6, 0, s * .2);
  }
  mesh(new THREE.BoxGeometry(.12, .16, .06), M(0xf0ece0), 0, 1.2, -.62, body);
  const legs = [];
  for (const [x, z] of [[-.16, .45], [.16, .45], [-.16, -.45], [.16, -.45]]) legs.push(limb(.09, .82, .09, d, body, x, .82, z));
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, body, neck, head, legs };
}
function makeBoar() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const c = 0x3e3129;
  mesh(new THREE.BoxGeometry(.56, .58, 1.05), M(c), 0, .66, 0, body);
  mesh(new THREE.BoxGeometry(.12, .22, .9), M(0x1e1612), 0, 1.0, 0, body);
  const head = new THREE.Group(); head.position.set(0, .66, .55); body.add(head);
  mesh(new THREE.BoxGeometry(.4, .38, .42), M(c), 0, 0, .15, head);
  mesh(new THREE.BoxGeometry(.2, .16, .14), M(0x6a4a40), 0, -.06, .42, head);
  for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(.03, .18, 4), M(0xe8e0cc), s * .12, -.08, .4, head); t.rotation.set(-1, 0, s * .4); }
  const legs = [];
  for (const [x, z] of [[-.17, .35], [.17, .35], [-.17, -.35], [.17, -.35]]) legs.push(limb(.12, .42, .12, 0x2a201a, body, x, .42, z));
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, body, head, legs };
}

/* ================= entities ================= */
const ents = [];
function addEnt(e) { e.pd = Math.hypot(e.x, e.z); e.y = heightAt(e.x, e.z); world.add(e.g); ents.push(e); e.g.position.set(e.x, e.y, e.z); return e; }
function removeEnt(e) { world.remove(e.g); const i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1); }

function spawnClan(kind, x, z, mode) {
  const p = makePerson(kind);
  const hp = kind === 'brute' ? 150 : kind === 'thrower' ? 50 : 70;
  return addEnt({ type: 'clan', kind, p, g: p.g, x, z, yaw: 0, hp, maxhp: hp, speed: kind === 'brute' ? 3.3 : kind === 'thrower' ? 4 : 4.7,
    state: mode === 'raid' ? 'raid' : 'idle', mode, home: { x, z }, t: rnd() * 5, atk: 0, cool: rr(.5, 2), ph: rnd() * 6, dead: false, deadT: 0, r: .45,
    climb: mode === 'raid' && rnd() < CLIMB[UP.wall] && kind !== 'brute', stuck: 0, side: 0 });
}
function spawnDeer(x, z) { const stag = rnd() < .35, p = makeDeer(stag); return addEnt({ type: 'deer', p, g: p.g, x, z, yaw: rnd() * 6, hp: 45, state: 'graze', t: rr(1, 5), ph: 0, dead: false, deadT: 0, r: .5, home: { x, z } }); }
function spawnBoar(x, z) { const p = makeBoar(); return addEnt({ type: 'boar', p, g: p.g, x, z, yaw: rnd() * 6, hp: 80, state: 'root', t: rr(1, 4), ph: 0, dead: false, deadT: 0, r: .5, cool: 0, home: { x, z } }); }
function spawnNPC(name, x, z, o) {
  const p = makePerson('arc', o);
  return addEnt({ type: 'npc', name, p, g: p.g, x, z, yaw: o.yaw ?? 0, home: { x, z }, wander: !!o.wander, t: rr(1, 6), ph: 0, r: .4, tx: x, tz: z, follow: false });
}
function hitSpheres(e) {
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  if (e.type === 'clan') { const s = e.kind === 'brute' ? 1.14 : 1, cl = e.climbY || 0; return [[e.x, e.y + 1.25 * s + cl, e.z, .44 * s, 1], [e.x, e.y + 1.88 * s + cl, e.z, .2 * s, 2.2], [e.x, e.y + .55 * s + cl, e.z, .3 * s, .8]]; }
  if (e.type === 'deer') return [[e.x, e.y + 1.05, e.z, .62, 1], [e.x + fx * .85, e.y + 1.75, e.z + fz * .85, .26, 2]];
  if (e.type === 'boar') return [[e.x, e.y + .66, e.z, .58, 1], [e.x + fx * .65, e.y + .66, e.z + fz * .65, .26, 1.8]];
  return [];
}

/* ================= player ================= */
const P = { x: 0, z: 26, y: H0, vy: 0, yaw: Math.PI, pitch: 0, hp: 100, food: 100, onGround: true, reload: 0, fire: 0, bob: 0, kick: 0, dead: false, hurtT: 0, pd: 26, coughT: 0, stepT: 0, safe: false };
const INV = { scrap: 0, meat: 0, mag: 8, res: 24 };
const UP = { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 };
const CLIMB = [.55, .3, .1, 0];
const RIFLE = [{ dmg: 36, mag: 8, rate: .3, spread: .012 }, { dmg: 46, mag: 10, rate: .27, spread: .009 }, { dmg: 58, mag: 12, rate: .24, spread: .005 }, { dmg: 72, mag: 16, rate: .2, spread: .004 }];
const RES_MAX = 40;
const input = { mx: 0, my: 0, look: [0, 0], fire: false, jump: false, sprint: false };

function wallCollide(o, rad, isPlayer) {
  const d = Math.hypot(o.x, o.z), R = CAMP_R;
  if (Math.abs(d - R) < rad + .45 && d > .01) {
    const a = Math.atan2(o.x, o.z);
    const gateOpen = gate.open || gate.hp <= 0;
    if (Math.abs(a) < GATE_HALF - .02 && (isPlayer || gateOpen)) { o.pd = d; return; }
    const inside = (o.pd ?? d) < R;
    const nd = inside ? R - rad - .45 : R + rad + .45;
    o.x *= nd / d; o.z *= nd / d;
  }
  o.pd = Math.hypot(o.x, o.z);
}
function collide(o, rad, isPlayer) {
  for (let pass = 0; pass < 2; pass++) {
    const i0 = Math.floor(o.x / CELL), j0 = Math.floor(o.z / CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const L = grid.get(gkey(i, j)); if (!L) continue;
      for (const c of L) {
        const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
        if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; }
      }
    }
  }
  if (!o.climbing) wallCollide(o, rad, isPlayer);
  const d = Math.hypot(o.x, o.z); if (d > WORLD) { o.x *= WORLD / d; o.z *= WORLD / d; }
}

/* ================= first-person rifle ================= */
const vm = new THREE.Group(); camera.add(vm);
vm.position.set(.26, -.25, -.5);
let muzzle, flash, flashLight;
function buildRifle(lv) {
  vm.clear();
  const metal = M(0x2b2d2f), dark = M(0x1a1b1c), wood = M(0x6a4a30), tape = M(0x55603e);
  mesh(new THREE.BoxGeometry(.07, .09, .46), metal, 0, 0, -.05, vm);
  mesh(new THREE.BoxGeometry(.065, .12, .24), wood, 0, -.03, .3, vm).rotation.x = .12;
  mesh(new THREE.BoxGeometry(.075, .07, .26), lv >= 1 ? tape : wood, 0, -.015, -.32, vm);
  mesh(new THREE.BoxGeometry(.04, .11, .05), dark, 0, -.1, .1, vm).rotation.x = -.3;
  const bl = .3 + (lv >= 1 ? .06 : 0);
  mesh(new THREE.CylinderGeometry(.014, .014, bl, 6), dark, 0, .015, -.45 - bl / 2 + .1, vm).rotation.x = Math.PI / 2;
  let tip = -.35 - bl;
  if (lv >= 1) { mesh(new THREE.CylinderGeometry(.028, .028, .16, 8), dark, 0, .015, tip - .05, vm).rotation.x = Math.PI / 2; tip -= .13; }
  if (lv >= 2) { mesh(new THREE.CylinderGeometry(.026, .03, .22, 10), dark, 0, .085, -.06, vm).rotation.x = Math.PI / 2; for (const z of [-.12, 0]) mesh(new THREE.BoxGeometry(.02, .04, .02), dark, 0, .055, z, vm);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.022, 10), new THREE.MeshBasicMaterial({ color: 0x5aa0b0 })); lens.position.set(0, .085, .051); vm.add(lens); }
  if (lv >= 3) { mesh(new THREE.CylinderGeometry(.075, .075, .07, 14), metal, 0, -.12, -.06, vm).rotation.z = Math.PI / 2; }
  else mesh(new THREE.BoxGeometry(.04, .14, .06), dark, 0, -.11, -.08, vm).rotation.x = .15;
  // hands in fingerless gloves + sleeve
  mesh(new THREE.BoxGeometry(.08, .07, .1), M(0x2a2622), -.01, -.06, -.3, vm);
  mesh(new THREE.BoxGeometry(.1, .1, .3), M(0x3b4a5a), -.03, -.1, -.45 + .5, vm).rotation.x = .2;
  mesh(new THREE.BoxGeometry(.08, .07, .1), M(0x2a2622), .01, -.08, .1, vm);
  vm.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  muzzle = new THREE.Object3D(); muzzle.position.set(0, .015, tip - .02); vm.add(muzzle);
  flash = new THREE.Mesh(new THREE.ConeGeometry(.06, .22, 7), new THREE.MeshBasicMaterial({ color: 0xffc66a, transparent: true, opacity: .95, depthWrite: false }));
  flash.rotation.x = -Math.PI / 2; flash.position.copy(muzzle.position).z -= .1; flash.visible = false; vm.add(flash);
}
flashLight = new THREE.PointLight(0xffb060, 0, 12, 0); camera.add(flashLight); flashLight.position.set(.2, 0, -1);
const torch = new THREE.SpotLight(0xfff0d8, 0, 60, .5, .55, 0); camera.add(torch); torch.position.set(.15, -.1, 0);
const torchTarget = new THREE.Object3D(); torchTarget.position.set(0, -.1, -5); camera.add(torchTarget); torch.target = torchTarget;

/* ================= particles + tracers ================= */
const parts = [];
const pGeo = new THREE.BoxGeometry(1, 1, 1);
function puff(x, y, z, color, n = 6, spd = 3, size = .12, life = .6, grav = -4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.set(x, y, z); m.scale.setScalar(size * rr(.6, 1.3)); world.add(m);
    parts.push({ m, vx: rr(-1, 1) * spd, vy: rr(0, 1.2) * spd, vz: rr(-1, 1) * spd, life, t: 0, grav, s0: m.scale.x });
  }
}
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    p.vy += p.grav * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    const k = 1 - p.t / p.life; p.m.scale.setScalar(p.s0 * Math.max(k, .01)); p.m.material.opacity = k;
    if (p.t >= p.life) { world.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
  }
}
const tracers = [];
function tracer(a, b, color = 0xffe0a0) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9, fog: false }));
  world.add(l); tracers.push({ l, t: 0 });
}
function updTracers(dt) { for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t += dt; t.l.material.opacity = 1 - t.t / .08; if (t.t > .08) { world.remove(t.l); t.l.geometry.dispose(); tracers.splice(i, 1); } } }

/* thrown spears */
const spears = [];
function throwSpear(e) {
  const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(.03, .03, 1.8, 5), M(0x6a4a2a), 0, 0, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.ConeGeometry(.06, .3, 4), M(0x9a9a92), 0, 0, 1, g).rotation.x = Math.PI / 2;
  const sx = e.x + Math.sin(e.yaw) * .4, sy = e.y + 1.7, sz = e.z + Math.cos(e.yaw) * .4;
  const tx = P.x + rr(-.6, .6), ty = P.y + 1.3, tz = P.z + rr(-.6, .6);
  const d = Math.hypot(tx - sx, tz - sz), spd = 22, T = d / spd;
  g.position.set(sx, sy, sz); world.add(g);
  spears.push({ g, vx: (tx - sx) / T, vz: (tz - sz) / T, vy: (ty - sy) / T + 9 * T / 2, t: 0, hit: false });
  sfx('whoosh');
}
function updSpears(dt) {
  for (let i = spears.length - 1; i >= 0; i--) {
    const s = spears[i]; s.t += dt;
    if (!s.hit) {
      s.vy -= 9 * dt; s.g.position.x += s.vx * dt; s.g.position.y += s.vy * dt; s.g.position.z += s.vz * dt;
      s.g.lookAt(s.g.position.x + s.vx, s.g.position.y + s.vy, s.g.position.z + s.vz);
      const p = s.g.position;
      if (!P.dead && Math.hypot(p.x - P.x, p.z - P.z) < .7 && p.y > P.y && p.y < P.y + 2) { hurtPlayer(16, p.x, p.z); s.hit = true; s.t = 9; }
      else if (p.y < heightAt(p.x, p.z)) { s.hit = true; s.t = 0; }
    }
    if (s.t > 6) { world.remove(s.g); spears.splice(i, 1); }
  }
}

/* ================= audio ================= */
let AC, master, muted = false, windGain, cricketT = 0;
try { muted = localStorage.getItem('the-arc-mute') === '1'; } catch (e) {}
function initAudio() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : .8; master.connect(AC.destination);
  const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AC.noiseBuf = buf;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  windGain = AC.createGain(); windGain.gain.value = .05;
  src.connect(lp).connect(windGain).connect(master); src.start();
}
function setMute(m) { muted = m; if (master) master.gain.value = m ? 0 : .8; try { localStorage.setItem('the-arc-mute', m ? '1' : '0'); } catch (e) {} }
function noiseBurst(dur, freq, q, vol, type = 'lowpass', when = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, s = AC.createBufferSource(); s.buffer = AC.noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, rnd()); s.stop(t + dur + .05);
}
function tone(freq, dur, vol, type = 'sine', when = 0, slide = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
function horn(base, dur, vol, vib) {
  if (!AC) return;
  const t = AC.currentTime, g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .5); g.gain.setValueAtTime(vol, t + dur - .6); g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(g).connect(master);
  for (const det of [0, 1.5, -2]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base + det;
    if (vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.connect(lp); o.start(t); o.stop(t + dur); }
}
function sfx(k, vol = 1) {
  if (!AC || muted) return;
  switch (k) {
    case 'shot': noiseBurst(.22, 1800, .7, .55 * vol); tone(90, .18, .5 * vol, 'sine', 0, -50); noiseBurst(.6, 500, .3, .12 * vol, 'lowpass', .05); break;
    case 'turret': noiseBurst(.12, 2400, .7, .22 * vol); tone(140, .1, .2 * vol, 'square', 0, -80); break;
    case 'dry': tone(1800, .03, .15); break;
    case 'reload': tone(900, .05, .12, 'square'); tone(600, .06, .12, 'square', .35); tone(1200, .05, .14, 'square', .9); break;
    case 'hit': noiseBurst(.08, 900, 1, .25); break;
    case 'head': tone(1400, .08, .14, 'triangle'); noiseBurst(.08, 900, 1, .25); break;
    case 'hurt': tone(160, .2, .3, 'sawtooth', 0, -80); noiseBurst(.15, 400, 1, .3); break;
    case 'pickup': tone(880, .07, .14, 'triangle'); tone(1320, .09, .12, 'triangle', .07); break;
    case 'buy': tone(220, .08, .2, 'square'); tone(330, .1, .2, 'square', .08); noiseBurst(.25, 3000, .8, .2, 'bandpass', .05); tone(440, .2, .18, 'triangle', .2); break;
    case 'no': tone(160, .12, .18, 'square'); break;
    case 'whoosh': noiseBurst(.3, 1200, 2, .18, 'bandpass'); break;
    case 'swing': noiseBurst(.18, 700, 2, .15, 'bandpass'); break;
    case 'thud': tone(70, .2, .4, 'sine', 0, -30); noiseBurst(.12, 300, 1, .25); break;
    case 'step': noiseBurst(.07, 260 + rnd() * 120, 1, .05 * vol); break;
    case 'cough': noiseBurst(.18, 600, 2, .2, 'bandpass'); noiseBurst(.14, 500, 2, .16, 'bandpass', .22); break;
    case 'eat': for (let i = 0; i < 3; i++) noiseBurst(.06, 1500, 2, .12, 'bandpass', i * .14); break;
    case 'deer': tone(700, .25, .1, 'triangle', 0, -300); break;
    case 'grunt': tone(110, .25, .2, 'sawtooth', 0, -40); break;
    case 'radio': noiseBurst(.25, 2500, .5, .12, 'highpass'); break;
    case 'gate': tone(60, .5, .35, 'sawtooth', 0, 20); noiseBurst(.6, 300, .5, .2); break;
  }
}
