
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
/* people are ELYRA's survivor models (rigid), moved by hand: stride bob, sway, lean, lunge. The Thornkin wear the same
   kit darkened to leather, with an ash band, a fur mantle with thorns, and a spear, blade or club. */
function makePerson(kind, o = {}) {
  const clan = kind === 'warrior' || kind === 'thrower' || kind === 'brute', armed = kind === 'gunner' || kind === 'soldier';
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const H = kind === 'brute' ? 1.98 : (o.h || rr(1.68, 1.84));
  // (Nov 10) Kestrel's own people: Bryce's settler (the Keeper civilian, standing) and his rigged Keeper foot soldier join the old two
  const model = o.model || (clan ? (kind === 'brute' ? 'michael' : pick(['civilian', 'michael'])) : armed ? 'michael' : pick(['civilian', 'settler', 'settler', 'keeper', 'michael']));
  const tint = o.tint ?? (clan ? (o.fac === 'iron' ? pick([0x8a5a3a, 0x6a5a4a]) : pick([0x6a5040, 0x5a4434, 0x7a5a44])) : kind === 'soldier' ? 0x5a6066 : kind === 'gunner' ? pick([0x8a5a3a, 0x7a6a50, 0x6a4a3a]) : null);
  const walkU = { ph: { value: 0 }, amp: { value: 0 } };
  // the survivor models face their own +x, but people move along +z — turn them, or everyone walks sideways
  // the Keeper foot soldier is really rigged (Bryce, Nov 10): his own skeleton and his Walking / Running clips, faces +z already
  const rig = MODELS[model + ':anims'] ? rigCopy(model, H, tint) : null;
  const m = rig ? rig.wrap : modelCopy(model, H, 'y', tint);
  if (rig) body.add(m);
  else if (m) { m.rotation.y = -Math.PI / 2; walkify(m, H, walkU); body.add(m); }
  // far away: the ~1.5k-triangle copy (the full ones are 10-19k each, and there can be dozens on screen)
  const lo = m && MODELS[model + '-lo'] ? modelCopy(model + '-lo', H, 'y', tint) : null;
  if (lo) { lo.rotation.y = -Math.PI / 2; walkify(lo, H, walkU); lo.visible = false; body.add(lo); }
  else { mesh(new THREE.BoxGeometry(.5, H * .55, .3), M(0x4a4a4a), 0, H * .62, 0, body); mesh(new THREE.BoxGeometry(.28, .3, .28), M(0xc68e6a), 0, H * .93, 0, body); }
  let weapon = null;
  if (clan) {
    const leather = M(0x2a1e14), fur = M(0x5e4a36), bone = M(0xd8d0bc);
    mesh(new THREE.BoxGeometry(.3, .06, .05), M(0x0c0c0c), 0, H * .925, .13, body);                 // ash band across the eyes
    const mant = mesh(new THREE.CylinderGeometry(.28, .42, .26, 8), fur, 0, H * .79, 0, body); mant.scale.z = .75;
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { const th = mesh(new THREE.ConeGeometry(.04, .3, 4), bone, sx * (.24 + k * .07), H * .84, -.02 + k * .05, body); th.rotation.z = -sx * .7; }
    mesh(new THREE.TorusGeometry(.19, .035, 5, 12), leather, 0, H * .55, 0, body).rotation.x = Math.PI / 2;
    if (kind === 'brute') {
      mesh(new THREE.BoxGeometry(.3, .32, .06), bone, 0, H * .935, .14, body);                         // bone mask
      for (const sx of [-1, 1]) { mesh(new THREE.BoxGeometry(.07, .05, .02), M(0x111111), sx * .07, H * .945, .175, body); const h = mesh(new THREE.ConeGeometry(.05, .4, 4), bone, sx * .13, H * 1.02, 0, body); h.rotation.z = -sx * .6; }
    }
    weapon = new THREE.Group(); weapon.position.set(.3, H * .5, .08); body.add(weapon);
    if (kind === 'thrower') {
      mesh(new THREE.CylinderGeometry(.025, .025, 2, 5), M(0x6a4a2a), 0, .35, 0, weapon); mesh(new THREE.ConeGeometry(.05, .28, 4), M(0x9a9a92), 0, 1.45, 0, weapon);
      for (let i = 0; i < 2; i++) mesh(new THREE.CylinderGeometry(.02, .02, 1.6, 4), M(0x6a4a2a), -.12 + i * .07, H * .7, -.2, body).rotation.x = .3;
    } else if (kind === 'brute') {
      const c = mesh(new THREE.CylinderGeometry(.05, .05, 1.1, 5), M(0x4a3020), 0, 0, .3, weapon); c.rotation.x = Math.PI / 2 - .3;
      mesh(new THREE.BoxGeometry(.26, .26, .42), M(0x6a6660), 0, .25, .8, weapon);
    } else {
      const b = mesh(new THREE.BoxGeometry(.04, .09, .7), M(0x8a8a86), 0, 0, .4, weapon); mesh(new THREE.BoxGeometry(.06, .06, .18), leather, 0, 0, 0, weapon);
    }
  }
  if (armed) {
    weapon = new THREE.Group(); weapon.position.set(.22, H * .58, .22); body.add(weapon);
    const gn = kind === 'soldier' ? 'gun-desert' : 'gun-night', gm = modelCopy(MODELS[gn + '-lo'] ? gn + '-lo' : gn, .72, 'z');   // a 13k-triangle gun is wasted at arm's length if (gm) weapon.add(gm); else mesh(new THREE.BoxGeometry(.06, .1, .7), M(0x1a1a1a), 0, 0, 0, weapon);
    if (kind === 'soldier') {                                     // Greyhold: helmet + gas mask
      mesh(new THREE.SphereGeometry(.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0x4a5056), 0, H * .95, 0, body);
      mesh(new THREE.BoxGeometry(.2, .14, .1), M(0x1a1a1a), 0, H * .9, .12, body); for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(.045, .05, .08, 8), M(0x2a2a2a), sx * .08, H * .87, .17, body).rotation.x = Math.PI / 2;
    } else {                                                       // Ironjaw: scrap shoulder plate + red rag
      mesh(new THREE.BoxGeometry(.32, .06, .26), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a6a4a }), -.18, H * .82, 0, body).rotation.z = .3;
      mesh(new THREE.BoxGeometry(.3, .07, .05), M(0x8a2a1a), 0, H * .9, .13, body);
    }
  }
  // a Keeper on watch carries his rifle in his right hand, down along the leg (it swings with the arm)
  if (rig && o.armed && rig.hand) { const gm = modelCopy(MODELS['gun-night-lo'] ? 'gun-night-lo' : 'gun-night', .72 / rig.k, 'z'); if (gm) { gm.rotation.set(-Math.PI / 2, 0, 0); gm.position.set(0, .12 / rig.k, .04 / rig.k); rig.hand.add(gm); } }
  g.traverse(x => { if (x.isMesh) { x.castShadow = true; } });
  return { g, body, weapon, H, kind, walkU, hi: m, lo, near: true, rig };
}
/* a copy of a rigged model (Nov 10): own bones (SkeletonUtils), sized to height H, feet on y = 0, and its clips set up for poseWalk:
   'walk' and 'run' played off the stride phase, and a standing pose (the walk held where the feet pass each other) when still */
function rigCopy(name, H, tint) {
  const src = MODELS[name], clips = MODELS[name + ':anims'], s = SkeletonUtils.clone(src);
  let sk = null; s.traverse(o => { if (o.isSkinnedMesh) { if (!sk) sk = o; o.frustumCulled = false; o.castShadow = true;
    if (tint) o.material = [].concat(o.material).map(x => { const c = x.clone(); c.color = c.color.clone().multiply(new THREE.Color(tint)); return c; })[0]; } });
  if (!sk) return null;
  sk.geometry.computeBoundingBox(); const bb = sk.geometry.boundingBox, k = H / (bb.max.y - bb.min.y);
  const wrap = new THREE.Group(); s.scale.setScalar(k); s.position.y = -bb.min.y * k; wrap.add(s);
  const find = w => clips.find(c => new RegExp(w, 'i').test(c.name));
  const mixer = new THREE.AnimationMixer(s), walkC = find('walk'), runC = find('run') || walkC;
  const RIG = { wrap, mixer, k, w: 0, hand: s.getObjectByName('mixamorigRightHand') || s.getObjectByName('mixamorig:RightHand') };
  if (walkC) {
    // where in the walk the feet pass each other: the standing pose (found once per model)
    if (src.userData.standT == null) { const m2 = new THREE.AnimationMixer(s), a = m2.clipAction(walkC); a.play(); let best = 0, bd = 1e9; const L = new THREE.Vector3(), R = new THREE.Vector3();
      const lf = s.getObjectByName('mixamorigLeftFoot'), rf = s.getObjectByName('mixamorigRightFoot');
      if (lf && rf) for (let i = 0; i < 32; i++) { a.time = i / 32 * walkC.duration; m2.update(0); s.updateMatrixWorld(true); lf.getWorldPosition(L); rf.getWorldPosition(R); const d = Math.abs(L.z - R.z) + Math.abs(L.y - R.y); if (d < bd) { bd = d; best = a.time; } }
      a.stop(); m2.uncacheRoot(s); src.userData.standT = best; }
    RIG.stand = mixer.clipAction(walkC.clone()); RIG.walk = mixer.clipAction(walkC); RIG.run = mixer.clipAction(runC === walkC ? walkC.clone() : runC);
    for (const a of [RIG.stand, RIG.walk, RIG.run]) { a.play(); a.paused = true; }
    RIG.standT = src.userData.standT; RIG.stand.time = RIG.standT; RIG.stand.setEffectiveWeight(1); RIG.walk.setEffectiveWeight(0); RIG.run.setEffectiveWeight(0); mixer.update(0);
  }
  return RIG;
}
/* stride: bob, side sway, forward lean with speed, and the legs + arms swinging (walkU, done in the vertex shader) */
function poseWalk(p, ph, amt, v = amt * 2.5) {
  p.body.position.y = Math.abs(Math.sin(ph)) * .05 * amt;
  p.body.rotation.z = Math.sin(ph) * .03 * amt;
  p.body.rotation.x = .07 * amt;
  if (p.weapon) p.weapon.rotation.x = Math.sin(ph) * .12 * amt;
  if (p.walkU) { const tgt = v > .08 ? Math.min(.5, .24 + v * .055) : 0; p.walkU.amp.value += (tgt - p.walkU.amp.value) * .2; p.walkU.ph.value = ph; }
  // a rigged person: his clips, played off the same stride phase (one clip loop = one stride), walk to run by speed; only up close
  const R = p.rig; if (R && R.walk && p.near) {
    R.w += ((v > .15 ? 1 : 0) - R.w) * .2; const run = clamp((v - 2.4) / 1.6, 0, 1), f = ((ph / 6.283) % 1 + 1) % 1;
    R.walk.time = f * R.walk.getClip().duration; R.run.time = f * R.run.getClip().duration; R.stand.time = R.standT;
    R.stand.setEffectiveWeight(1 - R.w); R.walk.setEffectiveWeight(R.w * (1 - run)); R.run.setEffectiveWeight(R.w * run); R.mixer.update(0);
    p.body.rotation.z = 0;                                   // (the clip sways him already)
  }
}
// one full stride (left + right step) per ~1.4 m walking, stretching to ~3 m at a run
const strideRate = v => v * 6.283 / clamp(1.05 + v * .42, 1.35, 3.1);

/* The survivor models are single rigid meshes, so legs and arms are bent in the vertex shader: below the hip, each side
   swings about the hip by ±amp (left/right by the sign of x); the arms (outside the torso, shoulder to hand height)
   swing the other way about the shoulder. Done in the person's own frame (feet at 0, height H, facing +z). */
const WALK_GEO = new Map();
/* Tripo bodies have the legs (and arms) fused to each other/the torso, so bending them by a smooth "which side" weight
   stretches a web of triangles between them. Instead each triangle is given to one side (left/right leg, arm or not) by
   its centre; vertices shared across the split are duplicated, so the legs part cleanly (the cut is inside the legs). */
function walkGeo(geo, toP, H) {
  if (WALK_GEO.has(geo)) return WALK_GEO.get(geo);
  const idx = geo.index, nTri = (idx ? idx.count : geo.attributes.position.count) / 3, P = geo.attributes.position, v = new THREE.Vector3();
  const pp = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(toP); pp[i * 3] = v.x / H; pp[i * 3 + 1] = v.y / H; pp[i * 3 + 2] = v.z / H; }
  const names = Object.keys(geo.attributes), out = Object.fromEntries(names.map(n => [n, []])), sa = [], remap = new Map(), newIdx = [];
  for (let t = 0; t < nTri; t++) {
    const vi = [0, 1, 2].map(k => idx ? idx.getX(t * 3 + k) : t * 3 + k);
    const cx = (pp[vi[0] * 3] + pp[vi[1] * 3] + pp[vi[2] * 3]) / 3, cy = (pp[vi[0] * 3 + 1] + pp[vi[1] * 3 + 1] + pp[vi[2] * 3 + 1]) / 3;
    const side = cx < 0 ? -1 : 1, arm = Math.abs(cx) > .125 && cy > .42 && cy < .82 ? 1 : 0, leg = cy < .5 ? 1 : 0;
    for (const a of vi) {
      const key = a * 8 + (side + 1) * 2 + arm * 1 + leg * 4; let n = remap.get(key);
      if (n === undefined) { n = sa.length / 2; remap.set(key, n); sa.push(side, arm); for (const nm of names) { const A = geo.attributes[nm]; for (let k = 0; k < A.itemSize; k++) out[nm].push(A.getComponent(a, k)); } }
      newIdx.push(n);
    }
  }
  const g = new THREE.BufferGeometry();
  for (const nm of names) g.setAttribute(nm, new THREE.BufferAttribute(new Float32Array(out[nm]), geo.attributes[nm].itemSize));
  g.setAttribute('wSA', new THREE.BufferAttribute(new Float32Array(sa), 2)); g.setIndex(newIdx);
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere; if (!g.boundingSphere) g.computeBoundingSphere();
  WALK_GEO.set(geo, g); return g;
}
function walkify(wrap, H, U) {
  wrap.updateMatrixWorld(true);
  wrap.traverse(m => {
    if (!m.isMesh) return;
    const toP = m.matrixWorld.clone(), fromP = toP.clone().invert();
    m.geometry = walkGeo(m.geometry, toP, H);
    m.material = [].concat(m.material).map(x => {
      const c = x.clone();
      c.onBeforeCompile = sh => {
        sh.uniforms.wPh = U.ph; sh.uniforms.wAmp = U.amp; sh.uniforms.wH = { value: H };
        sh.uniforms.wTo = { value: toP }; sh.uniforms.wFrom = { value: fromP };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 wSA; uniform float wPh, wAmp, wH; uniform mat4 wTo, wFrom;
vec3 wSwing(vec3 p, float a, vec3 piv) { vec3 q = p - piv; float c = cos(a), s = sin(a); return piv + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); }`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
if (wAmp > .002) {
  vec3 p = (wTo * vec4(transformed, 1.0)).xyz; float h = wH, sw = sin(wPh) * wAmp, side = wSA.x;
  float leg = 1.0 - smoothstep(.4 * h, .5 * h, p.y);                           // full below the hip, fading out over it
  vec3 q = wSwing(p, sw * side * leg, vec3(0.0, .5 * h, 0.0));
  float knee = (1.0 - smoothstep(.22 * h, .3 * h, p.y)) * max(0.0, -sw * side) * .8 * leg;   // the trailing leg bends a little
  q = wSwing(q, -knee, vec3(q.x, .27 * h, q.z));
  float arm = wSA.y * (1.0 - smoothstep(.74 * h, .8 * h, p.y));
  q = mix(q, wSwing(p, -sw * side * .6, vec3(p.x, .8 * h, 0.0)), arm);
  transformed = (wFrom * vec4(q, 1.0)).xyz;
}`);
      };
      c.customProgramCacheKey = () => 'walk';
      return c;
    });
    if (m.material.length === 1) m.material = m.material[0];
  });
}

/* ================= animals ================= */
// an animal is a dozen-plus plain coloured boxes; the ones that move together (body, neck, head) become one mesh each
function fuseKids(grp) {
  const ms = grp.children.filter(o => o.isMesh && !o.children.length && o.material.isMeshLambertMaterial && !o.material.map && !o.material.vertexColors);
  if (ms.length < 2) return;
  const parts = ms.map(o => { o.updateMatrix(); return { geo: o.geometry, color: o.material.color, m: o.matrix }; });   // Color(color) copies, so no colour-space round trip
  for (const o of ms) grp.remove(o);
  mesh(merge(parts), VCOL, 0, 0, 0, grp);
}
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
  fuseKids(body); fuseKids(neck); fuseKids(head);
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
  fuseKids(body); fuseKids(head);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, body, head, legs };
}

/* ================= entities ================= */
const ents = [];
function addEnt(e) { e.pd = Math.hypot(e.x, e.z); e.y = heightAt(e.x, e.z); world.add(e.g); ents.push(e); e.g.position.set(e.x, e.y, e.z); return e; }
function removeEnt(e) { world.remove(e.g); const i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1); }

function spawnClan(kind, x, z, mode, fac = 'clan') {
  const p = makePerson(kind, { fac });
  const hp = kind === 'brute' ? 150 : kind === 'thrower' ? 50 : kind === 'soldier' ? 130 : kind === 'gunner' ? 85 : 70;
  return addEnt({ type: 'clan', fac, kind, p, g: p.g, x, z, yaw: 0, hp, maxhp: hp, speed: kind === 'brute' ? 3.3 : kind === 'thrower' ? 4 : kind === 'gunner' || kind === 'soldier' ? 4.2 : 4.7,
    state: mode === 'raid' ? 'raid' : 'idle', mode, home: { x, z }, t: rnd() * 5, atk: 0, cool: rr(.5, 2), ph: rnd() * 6, dead: false, deadT: 0, r: .45,
    climb: mode === 'raid' && rnd() < CLIMB[UP.wall] && kind !== 'brute', stuck: 0, side: 0 });
}
function spawnDeer(x, z) { const stag = rnd() < .35, p = makeDeer(stag); return addEnt({ type: 'deer', p, g: p.g, x, z, yaw: rnd() * 6, hp: 45, state: 'graze', t: rr(1, 5), ph: 0, dead: false, deadT: 0, r: .5, home: { x, z } }); }
function spawnBoar(x, z) { const p = makeBoar(); return addEnt({ type: 'boar', p, g: p.g, x, z, yaw: rnd() * 6, hp: 80, state: 'root', t: rr(1, 4), ph: 0, dead: false, deadT: 0, r: .5, cool: 0, home: { x, z } }); }
function spawnNPC(name, x, z, o) {
  const p = makePerson('arc', o);
  return addEnt({ type: 'npc', name, p, g: p.g, x, z, yaw: o.yaw ?? 0, home: { x, z }, wander: !!o.wander, t: rr(1, 6), ph: rnd() * 6, r: .4, tx: x, tz: z, follow: false,
    stuck: 0, side: 0, route: null, wait: rr(0, 3), walkSpd: rr(1.15, 1.5), offX: rr(-.9, .9), offZ: rr(-.9, .9) });
}
function hitSpheres(e) {
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  if (e.type === 'clan') { const H = e.p.H, cl = e.climbY || 0; return [[e.x, e.y + H * .66 + cl, e.z, .4 * H / 1.76, 1], [e.x, e.y + H * .93 + cl, e.z, .16 * H / 1.76, 2.2], [e.x, e.y + H * .3 + cl, e.z, .28, .8]]; }
  if (e.sp) return hitSpheresAnimal(e);
  if (e.type === 'deer') return [[e.x, e.y + 1.05, e.z, .62, 1], [e.x + fx * .85, e.y + 1.75, e.z + fz * .85, .26, 2]];
  if (e.type === 'boar') return [[e.x, e.y + .66, e.z, .58, 1], [e.x + fx * .65, e.y + .66, e.z + fz * .65, .26, 1.8]];
  return [];
}

/* ================= player ================= */
const P = { slot: 0, ads: 0, swim: false, x: 0, z: 26, y: 0, vy: 0, yaw: Math.PI, pitch: 0, hp: 100, food: 100, onGround: true, reload: 0, fire: 0, bob: 0, kick: 0, dead: false, hurtT: 0, pd: 26, coughT: 0, stepT: 0, safe: false,
  vx: 0, vz: 0, stam: 100, stamT: 0, winded: false, runToggle: false, sprinting: false, jumpBuf: 0, coyote: 0, land: 0, eyeY: 0, bobAmp: 0, roll: 0, sway: 0, runK: 0 };
const INV = { scrap: 0, meat: 0, mags: { carbine: 20, battle: 25, hunter: 5 }, res: 60, resH: 15, items: {}, tools: [], eq: ['arc', 'hunter', null] };
const UP = { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 };
const CLIMB = [.55, .3, .1, 0];
/* the bench's rifle tiles: 1 suppressor + bigger mag, 2 swap to the scoped battle rifle, 3 its tac light + more */
const RIFLE = [{ id: 'carbine', dmg: 28, mag: 20, rate: .115, spread: .014 }, { id: 'carbine', dmg: 34, mag: 25, rate: .11, spread: .011 }, { id: 'battle', dmg: 46, mag: 25, rate: .13, spread: .007 }, { id: 'battle', dmg: 56, mag: 30, rate: .12, spread: .005 }];
const HUNTER = { id: 'hunter', dmg: 150, mag: 5, rate: 1.05, spread: .0015 };
const RES_MAX = 90, RESH_MAX = 20;
const gunStats = () => curW().st;
const input = { mx: 0, my: 0, look: [0, 0], fire: false, jump: false, sprint: false };

function wallCollide(o, rad, isPlayer) {
  const d = Math.hypot(o.x, o.z); if (d < CAMP_R - 8 || d > CAMP_RMAX + 3) { o.pd = d; o.pdn = d; return; }
  const a = Math.atan2(o.x, o.z), R = wallR(a);
  if (Math.abs(d - R) < rad + .45 && d > .01) {
    const gateOpen = gate.open || gate.hp <= 0;
    if (Math.abs(a) < GATE_HALF - .02 && gateOpen) { o.pd = d; return; }   // (Nov 10) a shut gate stops you too: E opens it
    const inside = (o.pdn ?? (o.pd ?? d) * CAMP_R / R) < CAMP_R;
    const nd = inside ? R - rad - .45 : R + rad + .45;
    o.x *= nd / d; o.z *= nd / d;
  }
  o.pd = Math.hypot(o.x, o.z); o.pdn = campD(o.x, o.z);
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
  hullCollide(o, rad);
  const d = Math.hypot(o.x, o.z); if (d > WORLD) { o.x *= WORLD / d; o.z *= WORLD / d; }
}
/* is the straight walk from a to b free of anything solid (and not across the wall)? */
function clearLine(x0, z0, x1, z1, rad) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / .8));
  if ((campD(x0, z0) < CAMP_R) !== (campD(x1, z1) < CAMP_R)) return false;
  for (let k = 1; k <= n; k++) {
    const x = lerp(x0, x1, k / n), z = lerp(z0, z1, k / n), cl = grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (cl) for (const c of cl) if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return false;
  }
  return true;
}

/* ================= first-person guns: ELYRA's real-world models only =================
   carbine = 'gun-night' (black AR-style), battle rifle = 'gun-desert' (tan, scoped; the bench's rifle upgrade swaps to it),
   hunting rifle = 'sniper' (bolt action, big scope). Arms = ELYRA's fp-arms (grey sleeves, black gloves). */
const vm = new THREE.Group(); camera.add(vm);
const WEAPONS = {
  carbine: { name: 'Carbine', model: 'gun-night', len: .78, axis: 'z', at: [.2, -.21, -.42], grip: [0, -.07, .09], fore: [0, -.03, -.19], auto: true, scope: 1.35, sound: 'rifle-m16-a' },
  battle: { name: 'Battle rifle', model: 'gun-desert', len: .86, axis: 'z', at: [.2, -.215, -.44], grip: [0, -.08, .1], fore: [0, -.04, -.2], auto: true, scope: 2.4, sound: 'rifle-m16-b' },
  hunter: { name: 'Hunting rifle', model: 'sniper', len: 1.1, axis: 'x', yaw: Math.PI / 2, at: [.2, -.2, -.5], grip: [0, -.07, .2], fore: [0, -.04, -.2], auto: false, scope: 5, sound: 'gun-shot-heavy' },
};
const GUNV = {};
let muzzle = new THREE.Object3D(), flash, flashLight, armsObj = [];
function gunView(id) {
  const W = WEAPONS[id], g = new THREE.Group();
  let m = null;
  if (W.model && MODELS[W.model]) { m = modelCopy(W.model, W.msize || W.len, W.axis, W.tint); if (m && W.extra) W.extra(m); } else if (W.proc) { m = new THREE.Group(); W.proc(m); }
  if (m) {
    if (W.yaw) m.rotation.y = W.yaw;
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()); m.position.sub(c);
    g.add(m);
  } else mesh(new THREE.BoxGeometry(.07, .1, W.len), M(0x2b2d2f), 0, 0, 0, g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; for (const mm of [].concat(o.material)) { mm.envMapIntensity = 1.3; } } });
  const mz = new THREE.Object3D(); mz.position.set(0, .02, -W.len / 2 - .02); g.add(mz); g.userData.muzzle = mz;
  const ext = new THREE.Group(); g.add(ext); g.userData.ext = ext;          // attachments the bench adds
  return g;
}
/* (Nov 10) Bryce's survivor arms: rolled olive sleeves, bare forearms, black leather gloves. Baked from the rigged model with the
   right hand closed round a pistol grip (index finger out along the trigger guard) and the left cupped under a handguard; in the
   file each forearm has the grip point inside the curled hand at the origin and the elbow at +y = 1, so it sits straight on a gun's
   grip point and ARM_LEN is how long it is from there to the elbow. */
const ARM_LEN = .44;
function buildArms() {
  const src = MODELS['fp-arms']; if (!src) return;
  for (const n of ['armR', 'armL']) {
    const a = src.getObjectByName(n); if (!a) continue;
    const c = a.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(ARM_LEN);
    const piv = new THREE.Group(), inner = new THREE.Group(); inner.add(c); piv.add(inner);
    c.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; const mm = o.material = o.material.clone(); if (mm.map) { mm.emissive = new THREE.Color(1, 1, 1); mm.emissiveMap = mm.map; mm.emissiveIntensity = .12; } } });
    vm.add(piv); armsObj.push(piv);
  }
}
const _ua = new THREE.Vector3(), _ub = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function poseArms(gun, W) {
  if (armsObj.length < 2) return;
  const ends = [[W.grip, [.26, -.55, .32]], [W.fore, [-.2, -.6, .05]]];
  armsObj.forEach((a, i) => {
    const [h, el] = ends[i];
    _ua.set(h[0], h[1], h[2]).applyMatrix4(gun.matrix);
    a.position.copy(_ua);
    _ub.set(el[0], el[1], el[2]).sub(_ua).normalize();
    a.quaternion.setFromUnitVectors(_up, _ub);
    a.rotateY(i ? 1.6 : 0);
  });
}
let curGun = null, curGunId = '';
function selectGunView(id) {
  if (!GUNV[id]) { GUNV[id] = gunView(id); vm.add(GUNV[id]); }
  for (const k in GUNV) GUNV[k].visible = k === id;
  curGun = GUNV[id]; curGunId = id; muzzle = curGun.userData.muzzle;
  const W = WEAPONS[id]; curGun.position.set(...W.at); curGun.rotation.set(0, 0, 0); curGun.updateMatrix();
  poseArms(curGun, W);
  if (flash) { flash.removeFromParent(); curGun.add(flash); flash.position.copy(muzzle.position); flash.position.z -= .1; }
}
function dressGun(id, lv) {               // carbine/battle rifle attachments shown on the gun
  const g = GUNV[id]; if (!g) return; const ext = g.userData.ext; ext.clear();
  const L = WEAPONS[id].len, dark = S(0x1c1d1e, { metalness: .6, roughness: .4 });
  if (lv >= 1) { const s = mesh(new THREE.CylinderGeometry(.022, .022, .16, 10), dark, 0, .02, -L / 2 - .07, ext); s.rotation.x = Math.PI / 2; g.userData.muzzle.position.z = -L / 2 - .16; }
  if (lv >= 3) { mesh(new THREE.BoxGeometry(.03, .03, .09), dark, .035, -.005, -L / 2 + .2, ext); const lens = new THREE.Mesh(new THREE.CircleGeometry(.012, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d0 })); lens.position.set(.035, -.005, -L / 2 + .154); lens.rotation.y = Math.PI; ext.add(lens); }
  ext.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
}
function buildRifle() {
  flash = new THREE.Mesh(new THREE.ConeGeometry(.05, .2, 7), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
  flash.rotation.x = -Math.PI / 2; flash.visible = false;
  buildArms();
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

/* ================= audio: ELYRA's sound library (Pixabay), synth stand-ins until a file has loaded ================= */
let AC, master, muted = false, windGain, cricketT = 0, sfxGain, musicVol = .55;
const BUF = {};
const SAMPLES = ['rifle-m16-a', 'rifle-m16-b', 'gun-shot-heavy', 'machine-gun-clean-single', 'bullet-impact', 'bullet-hit-b', 'bullet-hit-metal', 'hit-body', 'bullet-whizz', 'ricochet-metal',
  'casing-1', 'casing-2', 'casing-3', 'shell-drop-1', 'shell-drop-2', 'distant-shot-a', 'distant-shot-b', 'distant-shot-c', 'distant-burst', 'expl-boom',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => 'step-trail-' + i), ...[1, 2, 3, 4].map(i => 'step-gravel-' + i), ...[1, 2, 3, 4].map(i => 'step-metal-' + i), ...[1, 2, 3, 4].map(i => 'step-snow-' + i), ...[1, 2, 3, 4].map(i => 'step-sand-' + i)];
try { muted = localStorage.getItem('the-arc-mute') === '1'; } catch (e) {}
/* phones: iOS mutes Web Audio with the ringer switch unless the page says it plays media; the context and the music
   players only unlock inside a real tap (touchend/click, not touchstart), and iOS suspends/"interrupts" the context when
   the app is backgrounded — so every tap re-checks, and coming back to the tab resumes it. */
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
function initAudio() {
  if (AC) { if (AC.state !== 'running' && AC.state !== 'closed') AC.resume().catch(() => {}); music.unlock(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return; }
  if (AC.state !== 'running') AC.resume().catch(() => {});
  // a one-sample silent buffer started inside the gesture is what finally opens the output on older iOS
  try { const s = AC.createBufferSource(); s.buffer = AC.createBuffer(1, 1, 22050); s.connect(AC.destination); s.start(0); } catch (e) {}
  master = AC.createGain(); master.gain.value = muted ? 0 : .9; master.connect(AC.destination);
  sfxGain = AC.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
  const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AC.noiseBuf = buf;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  windGain = AC.createGain(); windGain.gain.value = .05;
  src.connect(lp).connect(windGain).connect(master); src.start();
  for (const n of SAMPLES) fetch(`assets/sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(a => AC.decodeAudioData(a)).then(b => { BUF[n] = b; }).catch(() => {});
  music.unlock();
}
function setMute(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; music.setMute(m); try { localStorage.setItem('the-arc-mute', m ? '1' : '0'); } catch (e) {} }
function play(name, vol = 1, rate = 1, when = 0) {
  const b = BUF[name]; if (!AC || !b || muted) return false;
  const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.playbackRate.value = rate * rr(.95, 1.05); g.gain.value = vol;
  s.connect(g).connect(sfxGain); s.start(AC.currentTime + when); return true;
}
/* music: two players crossfading. moods: day / night / raid / intro / dawn */
const music = (() => {
  const TR = { day: ['quiet-bones', 'quiet-bones-drift'], night: ['dark-bones-abyss'], raid: ['dark-bones-pulse', 'drive-total-war'], intro: ['quiet-bones-deep'], dawn: ['awe-bones-dark'], tense: ['dark-bones-pulse'] };
  // iOS only lets an <audio> element play from code after it has played once inside a tap, and ignores .volume
  // (always full) — so both players are "blessed" in the first tap, and the stings reuse one blessed player too.
  const A = [new Audio(), new Audio()], STING = new Audio(); [...A, STING].forEach(a => { a.preload = 'auto'; a.setAttribute('playsinline', ''); }); A.forEach(a => { a.loop = true; a.volume = 0; });
  const SILENT = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
  let cur = 0, mood = '', ok = false, mute = muted, fade = null, blessed = false;
  function go(m, force) {
    if (m === mood && !force) return; mood = m; if (!ok) return;
    const nx = 1 - cur, a = A[nx], b = A[cur], list = TR[m] || TR.day;
    a.src = `assets/music/${list[Math.floor(Math.random() * list.length)]}.mp3`; a.volume = 0;
    if (!mute) a.play().catch(() => {});
    cur = nx; clearInterval(fade); let t = 0;
    fade = setInterval(() => { t += .05; const k = Math.min(1, t / 2.5), v = mute ? 0 : musicVol; a.volume = v * k; b.volume = v * (1 - k); if (k >= 1) { b.pause(); clearInterval(fade); } }, 50);
  }
  function bless() {      // inside a tap: play every element once (silently) so later play() calls are allowed
    if (blessed) return; blessed = true;
    for (const a of [...A, STING]) { if (!a.src) { a.src = SILENT; const p = a.play(); if (p) p.then(() => { if (a.src === SILENT) a.pause(); }).catch(() => { blessed = false; }); } }
  }
  return { go, unlock() {
      if (!ok) { ok = true; go(mood || 'day', true); bless(); return; }
      bless(); if (!mute && A[cur].paused && A[cur].src && !A[cur].src.startsWith('data:')) A[cur].play().catch(() => {});   // iOS paused it (call, app switch)
    },
    setMute(m) { mute = m; A[cur].volume = m ? 0 : musicVol; if (m) A.forEach(a => a.pause()); else if (ok) A[cur].play().catch(() => {}); },
    pauseAll() { A.forEach(a => a.pause()); }, resume() { if (ok && !mute && A[cur].src) A[cur].play().catch(() => {}); },
    sting(n, v = .5) { if (!ok || mute) return; STING.src = `assets/music/${n}.mp3`; STING.volume = v; STING.play().catch(() => {}); } };
})();
let STEP_SURF = 'trail';
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
    case 'shot': if (!play(WEAPONS[curGunId]?.sound || 'rifle-m16-a', .8 * vol)) { noiseBurst(.22, 1800, .7, .55 * vol); tone(90, .18, .5 * vol, 'sine', 0, -50); } play(pick(['casing-1', 'casing-2', 'casing-3', 'shell-drop-1', 'shell-drop-2']), .25, 1, .35); break;
    case 'turret': if (!play('machine-gun-clean-single', .5 * vol)) { noiseBurst(.12, 2400, .7, .22 * vol); tone(140, .1, .2 * vol, 'square', 0, -80); } break;
    case 'dry': tone(1800, .03, .15); break;
    case 'reload': tone(900, .05, .12, 'square'); tone(600, .06, .12, 'square', .35); tone(1200, .05, .14, 'square', .9); break;
    case 'hit': if (!play('hit-body', .7)) noiseBurst(.08, 900, 1, .25); break;
    case 'impact': if (!play(pick(['bullet-impact', 'bullet-hit-b']), .35 * vol)) noiseBurst(.06, 1400, 1, .12); break;
    case 'metal': if (!play(pick(['bullet-hit-metal', 'ricochet-metal']), .45 * vol)) tone(2400, .08, .1, 'triangle'); break;
    case 'head': tone(1400, .08, .14, 'triangle'); if (!play('hit-body', .8, 1.15)) noiseBurst(.08, 900, 1, .25); break;
    case 'hurt': tone(160, .2, .3, 'sawtooth', 0, -80); noiseBurst(.15, 400, 1, .3); break;
    case 'pickup': tone(880, .07, .14, 'triangle'); tone(1320, .09, .12, 'triangle', .07); break;
    case 'buy': tone(220, .08, .2, 'square'); tone(330, .1, .2, 'square', .08); noiseBurst(.25, 3000, .8, .2, 'bandpass', .05); tone(440, .2, .18, 'triangle', .2); break;
    case 'no': tone(160, .12, .18, 'square'); break;
    case 'whoosh': if (!play('bullet-whizz', .6, .55)) noiseBurst(.3, 1200, 2, .18, 'bandpass'); break;
    case 'swing': noiseBurst(.18, 700, 2, .15, 'bandpass'); break;
    case 'thud': tone(70, .2, .4, 'sine', 0, -30); noiseBurst(.12, 300, 1, .25); break;
    case 'step': if (!play(`step-${STEP_SURF}-${1 + Math.floor(rnd() * (STEP_SURF === 'trail' ? 8 : 4))}`, .32 * vol)) noiseBurst(.07, 260 + rnd() * 120, 1, .05 * vol); break;
    case 'splash': noiseBurst(.25, 900 + rnd() * 500, .6, .1, 'bandpass'); noiseBurst(.18, 2600, .5, .04, 'highpass', .05); break;
    case 'boom': if (!play('expl-boom', .7)) tone(60, .6, .5, 'sine', 0, -30); break;
    case 'cough': noiseBurst(.18, 600, 2, .2, 'bandpass'); noiseBurst(.14, 500, 2, .16, 'bandpass', .22); break;
    case 'eat': for (let i = 0; i < 3; i++) noiseBurst(.06, 1500, 2, .12, 'bandpass', i * .14); break;
    case 'deer': tone(700, .25, .1, 'triangle', 0, -300); break;
    case 'grunt': tone(110, .25, .2 * vol, 'sawtooth', 0, -40); break;
    case 'growl': tone(85, .55, .18 * vol, 'sawtooth', 0, 25); noiseBurst(.45, 260, 1.5, .1 * vol, 'bandpass'); break;
    case 'roar': tone(70, .9, .3 * vol, 'sawtooth', 0, -25); noiseBurst(.8, 380, 1, .2 * vol, 'bandpass'); break;
    case 'cluck': tone(820, .06, .05 * vol, 'square', 0, -200); tone(760, .06, .04 * vol, 'square', .1, -200); break;
    case 'radio': noiseBurst(.25, 2500, .5, .12, 'highpass'); break;
    case 'gate': tone(60, .5, .35, 'sawtooth', 0, 20); noiseBurst(.6, 300, .5, .2); break;
  }
}
