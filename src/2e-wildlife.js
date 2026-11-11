
/* ================= wildlife (Nov 10): Bryce's animal models =================
   Every species is a row in FAUNA. The static models (Bryce's animal pack, baked one animal per file in assets/models/a, facing +z,
   feet on y=0) walk with their legs swung in the vertex shader (quadify: each triangle below the shoulder is given to one of four
   legs, front/back x left/right, and swings about that leg's hip in a diagonal gait). The rigged ones (wolf, chicken, tiger) play
   their own clips through an AnimationMixer; the tiger only has an idle, so its legs are swung bone by bone on top of it.
   kind: flee (grazers) · charge (boar-like) · pred (hunts you) · small (bolts) · lurk (waits by water) · tame (Kestrel's paddock)
   L = length the model is scaled to (null keeps the baked size) · sh = shoulder height after scaling (hit spheres + leg split)
   meat/hide/... = butcher yield */
const FAUNA = {
  deer: { n: 'Deer', m: 'a/deer', alt: 'a/doe', altP: .6, L: 1.95, sh: 1.05, hp: 45, kind: 'flee', run: 9.5, walk: 1.6, scare: 16, meat: 2, sinew: 2, snd: 'deer' },
  elk: { n: 'Elk', m: 'a/elk', L: 2.5, sh: 1.45, hp: 90, kind: 'flee', run: 9, walk: 1.5, scare: 20, meat: 3, sinew: 2, snd: 'deer' },
  moose: { n: 'Moose', m: 'a/moose', L: 3, sh: 1.8, hp: 160, kind: 'charge', run: 7, walk: 1.3, aggro: 9, dmg: 22, meat: 4, sinew: 2, snd: 'grunt' },
  boar: { n: 'Boar', m: 'a/boar', L: 1.5, sh: .8, hp: 80, kind: 'charge', run: 7.8, walk: 1.2, aggro: 11, dmg: 12, meat: 2, fat: 2, teeth: .5, snd: 'grunt' },
  rabbit: { n: 'Rabbit', m: 'a/rabbit', L: .42, sh: .3, hp: 10, kind: 'small', run: 8, walk: .9, scare: 9, meat: 1, hide: .5, hop: 1, snd: null },
  fox: { n: 'Fox', m: 'a/fox', L: 1, sh: .42, hp: 22, kind: 'small', run: 9, walk: 1.4, scare: 14, meat: 1, snd: null },
  pheasant: { n: 'Pheasant', m: 'a/pheasant', L: .8, sh: .3, hp: 8, kind: 'small', run: 7, walk: .7, scare: 8, meat: 1, feather: 3, hide: 0, bird: 1, snd: null },
  goose: { n: 'Goose', m: 'a/goose', L: .8, sh: .4, hp: 12, kind: 'small', run: 5, walk: .6, scare: 7, meat: 1, feather: 4, hide: 0, bird: 1, snd: null },
  wolf: { n: 'Wolf', m: 'a/wolf', L: null, sh: .8, hp: 70, kind: 'pred', run: 8.6, walk: 1.6, aggro: 30, dmg: 9, reach: 1.7, cool: 1.1, meat: 1, teeth: 1, rig: { walk: 'WalkFast', idle: 'Howl', walkSpd: 3.2 }, snd: 'growl' },
  bear: { n: 'Black bear', m: 'a/bear', L: 2, sh: 1, hp: 220, kind: 'pred', run: 7.4, walk: 1.2, aggro: 15, dmg: 24, reach: 2.2, cool: 1.6, meat: 4, fat: 3, teeth: 1, snd: 'roar' },
  grizzly: { n: 'Grizzly', m: 'a/grizzly', L: 2.5, sh: 1.25, hp: 320, kind: 'pred', run: 7.6, walk: 1.2, aggro: 18, dmg: 32, reach: 2.4, cool: 1.7, meat: 5, fat: 4, teeth: 1, snd: 'roar' },
  tiger: { n: 'White tiger', m: 'a/tiger', L: null, sh: .95, hp: 260, kind: 'pred', run: 10, walk: 1.5, aggro: 34, dmg: 28, reach: 2.3, cool: 1.3, meat: 3, teeth: 1, rig: { idle: 'Idle', swing: 1 }, snd: 'roar' },
  bighorn: { n: 'Bighorn sheep', m: 'a/bighorn', L: 1.6, sh: .9, hp: 60, kind: 'flee', run: 8, walk: 1.2, scare: 18, meat: 2, sinew: 1, snd: 'deer' },
  mountain_goat: { n: 'Mountain goat', m: 'a/mountain_goat', L: 1.5, sh: .9, hp: 60, kind: 'flee', run: 7.5, walk: 1.1, scare: 16, meat: 2, sinew: 1, snd: 'deer' },
  // escaped from the Cinder City zoo
  lioness: { n: 'Lioness', m: 'a/lioness', L: null, sh: .95, hp: 180, kind: 'pred', run: 10.5, walk: 1.5, aggro: 30, dmg: 22, reach: 2.1, cool: 1.2, meat: 3, teeth: 1, snd: 'roar' },
  hyena: { n: 'Hyena', m: 'a/hyena', L: 1.6, sh: .8, hp: 70, kind: 'pred', run: 9, walk: 1.5, aggro: 26, dmg: 10, reach: 1.7, cool: 1, meat: 1, teeth: 1, snd: 'growl' },
  buffalo: { n: 'Cape buffalo', m: 'a/buffalo', L: 3, sh: 1.5, hp: 240, kind: 'charge', run: 7.5, walk: 1.2, aggro: 12, dmg: 30, meat: 5, fat: 2, snd: 'grunt' },
  wildebeest: { n: 'Wildebeest', m: 'a/wildebeest', L: 2.3, sh: 1.3, hp: 90, kind: 'flee', run: 9.5, walk: 1.4, scare: 20, meat: 3, sinew: 2, snd: 'grunt' },
  warthog: { n: 'Warthog', m: 'a/warthog', L: 1.6, sh: .75, hp: 70, kind: 'charge', run: 8, walk: 1.2, aggro: 9, dmg: 10, meat: 2, fat: 1, teeth: .6, snd: 'grunt' },
  guineafowl: { n: 'Guineafowl', m: 'a/guineafowl', L: .55, sh: .3, hp: 8, kind: 'small', run: 6, walk: .7, scare: 8, meat: 1, feather: 3, hide: 0, bird: 1, snd: null },
  badger: { n: 'Honey badger', m: 'a/badger', L: .85, sh: .3, hp: 40, kind: 'charge', run: 6, walk: 1, aggro: 6, dmg: 7, meat: 1, snd: 'growl' },
  alligator: { n: 'Alligator', m: 'a/alligator', L: 3.4, sh: .45, hp: 200, kind: 'lurk', run: 7, walk: .8, aggro: 8, dmg: 30, reach: 2.6, cool: 2, meat: 3, hide: 2, teeth: 1, low: 1, snd: 'growl' },
  // Kestrel's paddock: they don't flee and you can't shoot them
  horse: { n: 'Horse', m: 'a/horse', L: 2.4, sh: 1.55, hp: 999, kind: 'tame', walk: 1, snd: null },
  donkey: { n: 'Donkey', m: 'a/donkey', L: 2, sh: 1.2, hp: 999, kind: 'tame', walk: .9, snd: null },
  chicken: { n: 'Chicken', m: 'a/chicken', L: null, sh: .3, hp: 999, kind: 'tame', walk: .5, bird: 1, rig: { walk: 'walking', idle: 'pecking', idle2: 'idle', walkSpd: .5 }, snd: 'cluck' },
};
const FAUNA_MODELS = [...new Set(Object.values(FAUNA).flatMap(F => [F.m, F.alt].filter(Boolean))), 'a/goose2'];

/* ---------- the gait shader for the static models ---------- */
const QUAD_GEO = new Map();
function quadGeo(geo, toP, sh) {
  const key = geo.uuid + ':' + sh.toFixed(3); if (QUAD_GEO.has(key)) return QUAD_GEO.get(key);
  const idx = geo.index, nTri = (idx ? idx.count : geo.attributes.position.count) / 3, P = geo.attributes.position, v = new THREE.Vector3();
  const pp = new Float32Array(P.count * 3); let zMin = 1e9, zMax = -1e9;
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(toP); pp[i * 3] = v.x; pp[i * 3 + 1] = v.y; pp[i * 3 + 2] = v.z; if (v.y < sh * .5) { zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z); } }
  const zMid = (zMin + zMax) / 2, top = sh * .62;
  // which leg each triangle belongs to: 0..3 = (front, back) x (left, right); 4 = body
  const grp = new Uint8Array(nTri), sumZ = [0, 0, 0, 0], nZ = [0, 0, 0, 0];
  for (let t = 0; t < nTri; t++) {
    const vi = [0, 1, 2].map(k => idx ? idx.getX(t * 3 + k) : t * 3 + k);
    const cx = (pp[vi[0] * 3] + pp[vi[1] * 3] + pp[vi[2] * 3]) / 3, cy = (pp[vi[0] * 3 + 1] + pp[vi[1] * 3 + 1] + pp[vi[2] * 3 + 1]) / 3, cz = (pp[vi[0] * 3 + 2] + pp[vi[1] * 3 + 2] + pp[vi[2] * 3 + 2]) / 3;
    const g = cy > top ? 4 : (cz > zMid ? 0 : 2) + (cx < 0 ? 0 : 1); grp[t] = g; if (g < 4) { sumZ[g] += cz; nZ[g]++; }
  }
  const hipZ = sumZ.map((s, i) => nZ[i] ? s / nZ[i] : zMid);
  const PH = [0, Math.PI, Math.PI, 0];          // diagonal pairs move together
  const names = Object.keys(geo.attributes), out = Object.fromEntries(names.map(n => [n, []])), qa = [], remap = new Map(), newIdx = [];
  for (let t = 0; t < nTri; t++) {
    const g = grp[t];
    for (let k = 0; k < 3; k++) {
      const a = idx ? idx.getX(t * 3 + k) : t * 3 + k, key = a * 8 + g; let n = remap.get(key);
      if (n === undefined) { n = qa.length / 3; remap.set(key, n); qa.push(g < 4 ? PH[g] : 0, g < 4 ? hipZ[g] : 0, g < 4 ? 1 : 0); for (const nm of names) { const A = geo.attributes[nm]; for (let c = 0; c < A.itemSize; c++) out[nm].push(A.getComponent(a, c)); } }
      newIdx.push(n);
    }
  }
  const g2 = new THREE.BufferGeometry();
  for (const nm of names) g2.setAttribute(nm, new THREE.BufferAttribute(new Float32Array(out[nm]), geo.attributes[nm].itemSize));   // getComponent hands back de-normalized values
  g2.setAttribute('qA', new THREE.BufferAttribute(new Float32Array(qa), 3)); g2.setIndex(newIdx);
  g2.boundingBox = geo.boundingBox; g2.boundingSphere = geo.boundingSphere; if (!g2.boundingSphere) g2.computeBoundingSphere();
  QUAD_GEO.set(key, g2); return g2;
}
function quadify(wrap, sh, U) {
  wrap.updateMatrixWorld(true); const inv = wrap.matrixWorld.clone().invert();
  wrap.traverse(m => {
    if (!m.isMesh || m.isSkinnedMesh) return;
    const toP = inv.clone().multiply(m.matrixWorld), fromP = toP.clone().invert();
    m.geometry = quadGeo(m.geometry, toP, sh);
    m.material = [].concat(m.material).map(x => {
      const c = x.clone();
      c.onBeforeCompile = s => {
        s.uniforms.qPh = U.ph; s.uniforms.qAmp = U.amp; s.uniforms.qTop = { value: sh * .62 }; s.uniforms.qTo = { value: toP }; s.uniforms.qFrom = { value: fromP };
        s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 qA; uniform float qPh, qAmp, qTop; uniform mat4 qTo, qFrom;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
if (qAmp > .002 && qA.z > .5) {
  vec3 p = (qTo * vec4(transformed, 1.0)).xyz;
  float leg = 1.0 - smoothstep(qTop * .55, qTop, p.y), a = sin(qPh + qA.x) * qAmp * leg;
  vec3 piv = vec3(p.x, qTop, qA.y), q = p - piv; float c = cos(a), s = sin(a);
  p = piv + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  transformed = (qFrom * vec4(p, 1.0)).xyz;
}`);
      };
      c.customProgramCacheKey = () => 'quad';
      return c;
    });
    if (m.material.length === 1) m.material = m.material[0];
  });
}

/* ---------- one animal: the model, scaled and dressed ---------- */
const _wq = new THREE.Quaternion(), _wq2 = new THREE.Quaternion(), _wx = new THREE.Vector3(1, 0, 0);
function makeAnimal(key, alt) {
  const F = FAUNA[key], name = alt && F.alt ? F.alt : F.m, src = MODELS[name]; if (!src) return null;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const o = F.rig ? skClone(src) : src.clone(true);
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
  const k = F.L ? F.L / sz.z : 1; o.scale.multiplyScalar(k); o.position.set(-(b.min.x + b.max.x) / 2 * k, -b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
  body.add(o);
  o.traverse(m => { if (m.isMesh) { m.castShadow = F.sh > .45; m.receiveShadow = false; if (m.isSkinnedMesh) m.frustumCulled = false; } });
  const U = { ph: { value: 0 }, amp: { value: 0 } }, p = { g, body, U, k, L: sz.z * k, H: sz.y * k };
  if (F.rig) {
    p.mixer = new THREE.AnimationMixer(o); const clips = CLIPS[name] || [];
    const clip = n => n && clips.find(c => c.name.includes(n));
    p.acts = {}; for (const r of ['walk', 'idle', 'idle2']) { const c = clip(F.rig[r]); if (c) { p.acts[r] = p.mixer.clipAction(c); } }
    const first = p.acts.idle || p.acts.walk; if (first) { first.play(); first.time = rnd() * first.getClip().duration; }
    p.cur = first;
    if (F.rig.swing) { p.legs = []; o.traverse(n => { if (n.isBone && /^[lr]_femurRibbon(Front)?_00/.test(n.name)) p.legs.push({ n, front: /Front/.test(n.name), side: n.name[0] === 'l' ? 1 : -1 }); }); }
  } else quadify(body, F.sh, U);
  return p;
}
function rigPose(e, v, dt) {
  const p = e.p, F = e.sp; if (!p.mixer) return;
  const want = v > .4 && p.acts.walk ? p.acts.walk : (p.acts.idle2 && e.state === 'walk' ? p.acts.idle2 : p.acts.idle || p.acts.walk);
  if (want && want !== p.cur) { want.reset().play(); if (p.cur) p.cur.crossFadeTo(want, .25, false); p.cur = want; }
  if (p.acts.walk) p.acts.walk.timeScale = clamp(v / (F.rig.walkSpd || 2), .4, 3.2);
  p.mixer.update(dt);
  if (p.legs && p.legs.length) {          // the tiger: swing the thighs about the body's side axis, diagonal pairs together
    const a = Math.min(1, v / 4) * .55;
    for (const L of p.legs) {
      const ang = Math.sin(e.ph + (L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0)) * a; if (!ang) continue;
      L.n.parent.getWorldQuaternion(_wq); _wq2.setFromAxisAngle(_wx.set(1, 0, 0).applyQuaternion(e.g.quaternion), ang);
      L.n.quaternion.premultiply(_wq.clone().invert().multiply(_wq2).multiply(_wq));
    }
  }
}

/* ---------- spawning ---------- */
function spawnAnimal(key, x, z, o = {}) {
  const F = FAUNA[key]; if (!F) return null;
  const p = makeAnimal(key, F.alt && rnd() < (F.altP ?? .5));
  if (!p) return key === 'deer' ? spawnDeer(x, z) : key === 'boar' ? spawnBoar(x, z) : null;   // models missing: the old drawn ones
  const e = { type: key, sp: F, p, g: p.g, x, z, yaw: rnd() * 6, hp: F.hp, maxhp: F.hp, state: F.kind === 'charge' ? 'root' : 'graze', t: rr(1, 5), ph: rnd() * 6, dead: false, deadT: 0,
    r: clamp(p.L * .22, .2, .8), cool: 0, home: o.home || { x, z }, range: o.range || (F.kind === 'pred' ? 40 : 16), pack: o.pack, stuck: 0, side: 0, wild: 1 };
  return addEnt(e);
}
function spawnGroup(key, cx, cz, n, spread = 10, range) {
  const pack = { key, n }, out = [];
  for (let i = 0; i < n; i++) { const x = cx + rr(-spread, spread), z = cz + rr(-spread, spread); if (waterAt(x, z) > heightAt(x, z) - .4 && FAUNA[key].kind !== 'lurk') continue; const e = spawnAnimal(key, x, z, { home: { x: cx, z: cz }, range, pack }); if (e) out.push(e); }
  return out;
}
function hitSpheresAnimal(e) {
  const F = e.sp, fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), L = e.p.L, sh = F.sh, by = F.low ? sh * .6 : sh * .78, r = Math.max(sh * .42, Math.min(L * .2, sh * .7));
  const out = [[e.x, e.y + by, e.z, r, 1], [e.x + fx * L * .4, e.y + (F.low ? sh * .6 : sh * 1.05), e.z + fz * L * .4, Math.max(.1, sh * .24), 2]];
  if (L > sh * 1.6) out.push([e.x - fx * L * .25, e.y + by, e.z - fz * L * .25, r * .85, 1]);
  if (e.p.body.position.y) for (const s of out) s[1] += e.p.body.position.y;
  return out;
}

/* ---------- behaviour ---------- */
function updWild(e, dt) {
  const p = e.p, F = e.sp;
  if (e.dead) {
    e.deadT += dt; p.U.amp.value = 0; if (p.mixer) { p.mixer.timeScale = Math.max(0, 1 - e.deadT * 3); p.mixer.update(dt); }
    p.body.rotation.z = Math.min(Math.PI / 2, e.deadT * 4); p.body.position.y = Math.min(1, e.deadT * 4) * F.sh * .25 - (e.deadT > 22 ? (e.deadT - 22) * .5 : 0);
    if (e.deadT > 25) removeEnt(e); return;
  }
  e.t -= dt; e.cool -= dt;
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp), canSee = !P.dead && !cine && Math.abs(P.y - e.y) < 6;
  const away = (k = 1) => [e.x - dxp * k, e.z - dzp * k], wander = (r = e.range) => { e.tx = e.home.x + rr(-r, r); e.tz = e.home.z + rr(-r, r); };
  let spd = 0, tx = e.x, tz = e.z;
  const stealth = 1 - (wearStat ? wearStat('stealth') : 0);
  if (F.kind === 'flee' || F.kind === 'small') {
    const scare = F.scare * (P.sprinting ? 1.6 : 1) * stealth;
    if (e.state !== 'flee' && dp < scare && canSee) { e.state = 'flee'; e.t = rr(4, 7); if (F.snd && dp < 40) sfx(F.snd); if (e.pack) for (const o of ents) if (o.pack === e.pack && !o.dead) { o.state = 'flee'; o.t = rr(4, 7); } }
    if (e.state === 'flee') { [tx, tz] = away(); spd = F.run; if (e.t <= 0) { e.state = 'graze'; e.t = rr(2, 5); } }
    else if (e.state === 'graze') { if (e.t <= 0) { e.state = 'walk'; e.t = rr(2, 5); wander(); } }
    else { tx = e.tx; tz = e.tz; spd = F.walk; if (e.t <= 0 || Math.hypot(tx - e.x, tz - e.z) < .5) { e.state = 'graze'; e.t = rr(2, 7); } }
  } else if (F.kind === 'charge') {
    if (e.state !== 'charge' && e.state !== 'back' && dp < F.aggro * stealth && canSee) { e.state = 'charge'; if (F.snd) sfx(F.snd); }
    if (e.state === 'charge') { tx = P.x; tz = P.z; spd = F.run; if (dp < 1.2 + p.L * .4 && e.cool <= 0) { hurtPlayer(F.dmg, e.x, e.z); e.cool = 1.4; e.state = 'back'; e.t = 1.4; } if (dp > 34 || P.dead) e.state = 'root'; }
    else if (e.state === 'back') { [tx, tz] = away(); spd = F.run * .65; if (e.t <= 0) e.state = 'charge'; }
    else if (e.t <= 0) { e.t = rr(2, 6); wander(); }
    else if (e.tx !== undefined) { tx = e.tx; tz = e.tz; spd = F.walk; }
  } else if (F.kind === 'pred' || F.kind === 'lurk') {
    const hurt = e.hp < e.maxhp * .25, home = Math.hypot(e.x - e.home.x, e.z - e.home.z), inCamp = campD(P.x, P.z) < CAMP_R + 4 || P.safe;
    const aggro = F.aggro * stealth * (isNight() ? 1.35 : 1);
    if (e.state !== 'chase' && e.state !== 'flee' && dp < aggro && canSee && !inCamp && !hurt) { e.state = 'chase'; if (F.snd) sfx(F.snd); if (e.pack) for (const o of ents) if (o.pack === e.pack && !o.dead && o.state !== 'flee') o.state = 'chase'; }
    if (e.state === 'chase') {
      tx = P.x; tz = P.z; spd = F.kind === 'lurk' && dp > 5 ? F.walk * 3 : F.run;
      if (dp < (F.reach || 1.8) && e.cool <= 0 && Math.abs(P.y - e.y) < 2.2) { e.yaw = Math.atan2(dxp, dzp); hurtPlayer(F.dmg, e.x, e.z); e.cool = F.cool || 1.2; e.lunge = .3; if (F.snd) sfx(F.snd, .6); }
      if (dp < (F.reach || 1.8) * .7) spd = 0;
      if (hurt || P.dead || inCamp || dp > aggro * 2.4 || home > (F.kind === 'lurk' ? 25 : 160)) { e.state = hurt ? 'flee' : 'walk'; e.t = rr(4, 8); e.tx = e.home.x; e.tz = e.home.z; }
    } else if (e.state === 'flee') { [tx, tz] = away(); spd = F.run; if (e.t <= 0) { e.state = 'walk'; e.t = 6; e.tx = e.home.x; e.tz = e.home.z; } }
    else if (F.kind === 'lurk') { if (e.t <= 0) { e.t = rr(6, 14); wander(6); } tx = e.tx ?? e.x; tz = e.tz ?? e.z; spd = F.walk; }
    else { if (e.t <= 0 || e.tx === undefined) { e.t = rr(5, 12); e.state = rnd() < .35 ? 'graze' : 'walk'; wander(); } if (e.state === 'walk') { tx = e.tx; tz = e.tz; spd = F.walk; } }
  }
  if (e.stun > 0) { e.stun -= dt; spd = 0; }
  if (spd && F.kind !== 'lurk' && waterAt(tx, tz) > heightAt(tx, tz) - .3) { tx = e.x + (e.x - tx) * .3; tz = e.z + (e.z - tz) * .3; }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  e.ph += dt * (F.bird || F.hop ? 9 : 2.6 + 1.6 / Math.max(.4, F.sh)) * Math.min(v, 6) / Math.max(1, Math.sqrt(v)) * (v > .1 ? 1 : 0);
  p.U.ph.value = e.ph; p.U.amp.value = Math.min(1, v / 2.5) * (F.hop ? .1 : F.bird ? .45 : .5);
  if (p.mixer) rigPose(e, v, dt);
  p.body.position.y = (F.hop || F.bird) && v > .2 ? Math.abs(Math.sin(e.ph)) * (F.hop ? .12 : .03) : 0;
  if (e.lunge > 0) { e.lunge -= dt; p.body.position.z = Math.sin((1 - e.lunge / .3) * Math.PI) * .35; } else p.body.position.z = 0;
  e.y = heightAt(e.x, e.z); if (F.kind === 'lurk') { const w = waterAt(e.x, e.z); if (w > e.y) e.y = w - F.sh * .55; }
  e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
function wildHit(e) {
  const F = e.sp;
  if (F.kind === 'flee' || F.kind === 'small') { if (e.state !== 'flee') { e.state = 'flee'; e.t = rr(5, 8); } }
  else if (F.kind === 'charge') e.state = 'charge';
  else if (e.hp > e.maxhp * .25) { e.state = 'chase'; if (e.pack) for (const o of ents) if (o.pack === e.pack && !o.dead) o.state = 'chase'; }
  else { e.state = 'flee'; e.t = rr(5, 9); }
}
function wildYield(e, kn) {
  const F = e.sp, r = x => x == null ? 0 : x < 1 ? (rnd() < x ? 1 : 0) : x, L = [['meat', F.meat || 1]];
  if (kn) L.push(['hide', r(F.hide ?? 1)], ['bone', 1 + Math.floor(rnd() * (F.sh > 1 ? 3 : 2))], ['fat', r(F.fat ?? (F.sh > .7 ? 1 : 0))], ['sinew', r(F.sinew ?? 1)], ['teeth', r(F.teeth ?? 0)], ['feather', r(F.feather ?? 0)]);
  else L.push(['bone', rnd() < .5 ? 1 : 0], ['feather', F.feather ? 1 : 0]);
  return L;
}

/* ---------- Kestrel's paddock + birds over the lakes (not in ents: you can't shoot them) ---------- */
const PETS = [], DUCKS = [];
function petAt(key, x, z, home, range) {
  const p = makeAnimal(key); if (!p) return;
  const e = { type: key, sp: FAUNA[key], p, g: p.g, x, z, y: heightAt(x, z), yaw: rnd() * 6, home, range, t: rr(0, 4), ph: 0, state: 'graze', stuck: 0, side: 0, r: .2 };
  world.add(e.g); e.g.position.set(x, e.y, e.z); PETS.push(e); return e;
}
function updPets(dt) {
  for (const e of PETS) {
    const d = Math.hypot(e.x - P.x, e.z - P.z); e.g.visible = d < 160; if (d > 170) continue;
    const F = e.sp, p = e.p; e.t -= dt; let spd = 0;
    if (e.t <= 0) { e.t = rr(3, 9); e.state = rnd() < .45 ? 'walk' : 'graze'; const a = rnd() * 6.28, r = Math.sqrt(rnd()) * e.range; e.tx = e.home.x + Math.cos(a) * r; e.tz = e.home.z + Math.sin(a) * r; }
    if (e.state === 'walk') spd = F.walk;
    let v = 0;
    if (spd) { const dx = e.tx - e.x, dz = e.tz - e.z, dd = Math.hypot(dx, dz); if (dd < .3) e.state = 'graze'; else { e.yaw += angWrap(Math.atan2(dx, dz) - e.yaw) * Math.min(1, dt * 4); const st = Math.min(spd * dt, dd); e.x += Math.sin(e.yaw) * st; e.z += Math.cos(e.yaw) * st; v = st / dt; } }
    e.ph += dt * v * (F.bird ? 8 : 3); p.U.ph.value = e.ph; p.U.amp.value = Math.min(1, v / 1.5) * .45;
    if (p.mixer) rigPose(e, v, dt);
    if (F.snd && d < 14 && rnd() < dt * .05) sfx(F.snd, .4);
    e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
  }
  for (const D of DUCKS) {
    D.a += dt * D.w; const x = D.cx + Math.cos(D.a) * D.r, z = D.cz + Math.sin(D.a) * D.r * .7;
    D.g.position.set(x, D.y + Math.sin(D.a * 3) * .6, z); D.g.rotation.set(0, Math.atan2(-Math.sin(D.a) * D.r * D.w, Math.cos(D.a) * D.r * .7 * D.w) , 0);
    D.g.visible = Math.hypot(x - P.x, z - P.z) < 260;
  }
}
function buildPaddock() {
  // a fenced paddock outside the east wall: two horses, a donkey and the hens; more hens scratch round the cookhouse
  const site = envSite('paddock') || { x: 86, z: 6 }, cx = site.x, cz = site.z, R = 11, y0 = heightAt(cx, cz), g = new THREE.Group(); world.add(g);
  const post = M(0x5a4a3a), rail = M(0x7a6650), gapA = Math.atan2(-cz, -cx) - (9.5 / 18) * Math.PI * 2;   // the gate faces Kestrel
  for (let i = 0; i < 18; i++) {
    const a0 = i / 18 * Math.PI * 2, a1 = (i + 1) / 18 * Math.PI * 2; if (i === 9) continue;   // the gap faces the wall
    const x0 = cx + Math.cos(a0 + gapA) * R, z0 = cz + Math.sin(a0 + gapA) * R, x1 = cx + Math.cos(a1 + gapA) * R, z1 = cz + Math.sin(a1 + gapA) * R;
    mesh(new THREE.BoxGeometry(.14, 1.4, .14), post, x0, heightAt(x0, z0) + .6, z0, g);
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (const hy of [.55, 1.05]) { const r = mesh(new THREE.BoxGeometry(L, .08, .05), rail, (x0 + x1) / 2, (heightAt(x0, z0) + heightAt(x1, z1)) / 2 + hy, (z0 + z1) / 2, g); r.rotation.y = ry; }
    addColLine(x0, z0, x1, z1, .25);
  }
  // a trough and a little coop
  mesh(new THREE.BoxGeometry(2, .45, .6), M(0x6a5a46), cx + 4, y0 + .22, cz - 5, g);
  mesh(new THREE.BoxGeometry(1.84, .05, .44), new THREE.MeshLambertMaterial({ color: 0x4a6a78 }), cx + 4, y0 + .43, cz - 5, g);
  mesh(new THREE.BoxGeometry(1.6, 1, 1.2), M(0x8a6a4a), cx - 6, y0 + .7, cz + 4, g); const rf = mesh(new THREE.ConeGeometry(1.3, .7, 4), M(0x5a4a3a), cx - 6, y0 + 1.55, cz + 4, g); rf.rotation.y = Math.PI / 4;
  addCol(cx + 4, cz - 5, 1); addCol(cx - 6, cz + 4, 1);
  const home = { x: cx, z: cz };
  petAt('horse', cx + 3, cz + 2, home, 7); petAt('horse', cx - 2, cz - 3, home, 7); petAt('donkey', cx + 1, cz + 5, home, 6);
  for (let i = 0; i < 6; i++) petAt('chicken', cx - 6 + rr(-2, 2), cz + 4 + rr(-2, 2), { x: cx - 5, z: cz + 3 }, 4);
  const ck = SHOP.cook; if (ck && ck.front) for (let i = 0; i < 4; i++) petAt('chicken', ck.front.x + rr(-2, 2), ck.front.z + rr(-2, 2), { x: ck.front.x, z: ck.front.z }, 3);
  // ducks circling the lakes
  if (MODELS['a/goose2']) for (const L of LAKES) for (let i = 0; i < (L.near ? 4 : 7); i++) {
    const o = modelCopy('a/goose2', .55, 'z'); if (!o) break; const d = new THREE.Group(); d.add(o); world.add(d);
    DUCKS.push({ g: d, cx: L.x + rr(-L.R * .3, L.R * .3), cz: L.z + rr(-L.R * .3, L.R * .3), r: L.R * rr(.4, .8) + 6, y: heightAt(L.x, L.z) + rr(8, 16), a: rnd() * 6, w: rr(.25, .4) * (rnd() < .5 ? -1 : 1) });
  }
}

/* ---------- where things live ---------- */
function wildCount(keys, inValley) { const inV = e => Math.hypot(e.home.x, e.home.z) < VALLEY; return ents.filter(e => e.wild && !e.dead && keys.includes(e.type) && inV(e) === inValley).length; }
function landSpot(cx, cz, r, tries = 30, test) { for (let i = 0; i < tries; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
  if (Math.hypot(x, z) > WORLD - 60 || waterAt(x, z) > heightAt(x, z) - .5 || campD(x, z) < CAMP_R + 30 || inCity(x, z, -40) || inBase(x, z, 10)) continue; if (test && !test(x, z)) continue; return { x, z }; } return null; }
const steep = (x, z) => slopeAt(x, z) > .45 && heightAt(x, z) > 40;
const WILD_PLAN = [
  // [species, valley?, how many groups, group size [min,max], where: 'meadow'|'forest'|'mount'|'zoo'|'lake'|'out']
  ['deer', 1, 7, [2, 4], 'meadow'], ['elk', 1, 2, [2, 3], 'forest'], ['boar', 1, 5, [1, 3], 'forest'], ['rabbit', 1, 7, [1, 3], 'meadow'], ['fox', 1, 4, [1, 1], 'forest'],
  ['pheasant', 1, 5, [1, 3], 'meadow'], ['goose', 1, 2, [3, 5], 'lake'], ['wolf', 1, 2, [3, 3], 'rim'], ['bear', 1, 2, [1, 1], 'rim'],
  ['deer', 0, 7, [3, 4], 'out'], ['elk', 0, 3, [2, 4], 'out'], ['moose', 0, 5, [1, 2], 'lake'], ['boar', 0, 6, [2, 3], 'out'], ['rabbit', 0, 4, [1, 3], 'out'], ['fox', 0, 3, [1, 1], 'out'],
  ['wolf', 0, 3, [3, 4], 'out'], ['grizzly', 0, 4, [1, 1], 'out'], ['tiger', 0, 3, [1, 1], 'out'], ['bighorn', 0, 3, [3, 4], 'mount'], ['mountain_goat', 0, 4, [2, 4], 'mount'], ['pheasant', 0, 3, [2, 3], 'out'],
  ['lioness', 0, 2, [2, 3], 'zoo'], ['hyena', 0, 2, [3, 4], 'zoo'], ['buffalo', 0, 2, [3, 4], 'zoo'], ['wildebeest', 0, 2, [4, 5], 'zoo'], ['warthog', 0, 3, [2, 3], 'zoo'],
  ['guineafowl', 0, 2, [3, 4], 'zoo'], ['badger', 0, 3, [1, 1], 'zoo'], ['alligator', 0, 4, [1, 1], 'gator'],
];
function wildSpot(where) {
  const V = VALLEY, ring = (r0, r1) => { const a = rnd() * 6.28, r = rr(r0, r1); return [Math.cos(a) * r, Math.sin(a) * r]; };
  if (where === 'meadow') { const m = pick(MEADOWS); return landSpot(m.x, m.z, 30); }
  if (where === 'forest') { const [x, z] = ring(110, V - 60); return landSpot(x, z, 30, 30, (x, z) => pathDist(x, z) > 12); }
  if (where === 'rim') { const [x, z] = ring(V - 160, V - 40); return landSpot(x, z, 40, 30, (x, z) => pathDist(x, z) > 25 && SCOUTS.every(s => Math.hypot(x - s.x, z - s.z) > 50)); }
  if (where === 'lake') { const L = pick(LAKES); const a = rnd() * 6.28; return landSpot(L.x + Math.cos(a) * (L.R + 14), L.z + Math.sin(a) * (L.R + 14), 12); }
  if (where === 'gator') { const L = pick(LAKES.filter(L => !L.near)); const a = rnd() * 6.28; return { x: L.x + Math.cos(a) * (L.R - 4), z: L.z + Math.sin(a) * (L.R - 4) }; }
  if (where === 'mount') { for (let i = 0; i < 40; i++) { const [x, z] = ring(V + 120, WORLD - 120); const s = landSpot(x, z, 60, 20, steep); if (s) return s; } return null; }
  if (where === 'zoo') { const a = rnd() * 6.28, r = CITY.R + rr(40, 320); return landSpot(CITY.x + Math.cos(a) * r, CITY.z + Math.sin(a) * r, 40); }
  const m = rnd() < .5 ? pick(OUT_MEADOWS) : null; if (m) return landSpot(m.x, m.z, 60);
  const [x, z] = ring(V + 140, WORLD - 120); return landSpot(x, z, 60);
}
function ensureWild() {
  if (!MODELS[FAUNA.deer.m]) return false;
  const want = {};
  for (const [k, v, n, sz, where] of WILD_PLAN) { const id = k + v; (want[id] ||= { k, v, n: 0, sz, where, groups: 0 }); want[id].n += n * (sz[0] + sz[1]) / 2; want[id].groups += n; }
  for (const id in want) {
    const W = want[id]; let have = wildCount([W.k], !!W.v), guard = 0;
    while (have < W.n * .8 && guard++ < W.groups * 3) { const s = wildSpot(W.where); if (!s) continue; have += spawnGroup(W.k, s.x, s.z, Math.round(rr(W.sz[0], W.sz[1] + .99) - .49), W.k === 'wolf' || W.k === 'hyena' ? 8 : 12, FAUNA[W.k].kind === 'pred' ? 60 : 24).length; }
  }
  return true;
}
