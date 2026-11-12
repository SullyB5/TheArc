/* ================= performance systems (Nov 12) =================
   Measured first (tools/bench, see README "Performance (Nov 12)"): around Kestrel a frame drew 6-13 million triangles, about
   half of them in the sun's shadow pass. Almost all of it was a few imported models drawn at full detail at any distance —
   the conifers (5.1k triangles each, ~600 of them), the hero conifers (30k), Davia's rock outcrops (~44k), the wrecked cars
   (20k) — and whole 200-300 m forest bins drawn into a shadow map that only covers 120 m. This file removes that waste
   without touching how anything looks up close:

   · lodGeo: lower-detail copies of a mesh made at load with meshoptimizer's simplifier (the same library the asset tools use).
     Same vertices, same UVs and materials, fewer triangles, seams kept.
   · instanced LOD (ILOD): every instanced model heavy enough to matter (instParts in 1g-env.js) is drawn as full / medium /
     far detail by distance from the camera, per instance, with hysteresis so nothing flickers at a boundary; instances off
     screen aren't drawn at all (per-instance frustum culling); past the view distance they don't exist.
   · shadow proxies: shadows come from a separate, shadow-only copy (shadowOnly: the camera's frustum check drops it, the
     sun's keeps it) holding just the instances near enough to land a shadow in the shadow map, drawn with the medium-detail mesh —
     a shadow can't show the difference. The drawn fir forest gets the same treatment (shnAdd).
   · residency: textures and geometry that nothing visible has used for a while give their graphics memory back
     (they're re-uploaded on their own if you come back), so long sessions don't climb until a phone kills the tab.
   · shader warm-up: every material is compiled behind the title screen, not the first time it comes into view (that was a
     visible hitch the first time you walked into each building or fired each gun).
   · the stats overlay (F3, or Settings → Performance stats): FPS, frame time, draw calls, triangles, graphics memory, load. */

/* shadow-only meshes: three.js tests the shadow pass against the main camera's layers, so a layer can't hide something from
   the camera but not the sun. Instead a proxy's bounding sphere is parked each frame at a point inside the sun's shadow box
   but behind the camera: the camera's frustum check drops it, the shadow camera's keeps it (frustumCulled stays on). */
const SHADOW_PROXIES = [];
function shadowOnly(im) { im.frustumCulled = true; im.boundingSphere = new THREE.Sphere(new THREE.Vector3(), .01); im.userData.shadowOnly = 1; SHADOW_PROXIES.push(im); return im; }
const _spP = new THREE.Vector3(), _spF = new THREE.Vector3(), _spI = new THREE.Matrix4();
function updShadowProxies() {
  camera.getWorldDirection(_spF); _spF.y = 0; if (_spF.lengthSq() < 1e-6) _spF.set(0, 0, -1); _spF.normalize();
  const t = sun.target.position, cp = camera.position;
  // behind the player's feet in first person; behind the camera itself if the camera is away from the player
  if (Math.hypot(cp.x - t.x, cp.z - t.z) < 12) _spP.set(t.x - _spF.x * 4, Math.min(t.y, cp.y - 2.5), t.z - _spF.z * 4);
  else _spP.copy(cp).addScaledVector(_spF, -3);
  for (let i = SHADOW_PROXIES.length - 1; i >= 0; i--) {
    const im = SHADOW_PROXIES[i], par = im.parent; if (!par) { if (im.userData.gone) SHADOW_PROXIES.splice(i, 1); continue; }
    const c = im.boundingSphere.center.copy(_spP);
    if (par !== scene && par !== world) c.applyMatrix4(_spI.copy(im.matrixWorld).invert());
    else if (!im.matrixWorld.equals(_spI.identity())) c.applyMatrix4(_spI.copy(im.matrixWorld).invert());
  }
}
let LOD_K = PQ.lod;                                      // preset scale on every LOD distance

/* ---------- simplified copies of a geometry ---------- */
const LODGEO = new WeakMap();
const geoTris = g => (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
let LOD_READY = false;
MeshoptSimplifier.ready.then(() => { LOD_READY = true; }).catch(() => {});
function lodGeo(geo, ratio, err) {
  let c = LODGEO.get(geo); if (!c) LODGEO.set(geo, c = new Map());
  const key = ratio + ':' + err; if (c.has(key)) return c.get(key);
  let out = geo;
  try {
    const pos = geo.attributes.position;
    if (LOD_READY && geo.index && pos && !pos.isInterleavedBufferAttribute && pos.itemSize === 3 && geoTris(geo) >= 240) {
      const P = pos.array instanceof Float32Array && !pos.normalized ? pos.array : (() => { const a = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { a[i * 3] = pos.getX(i); a[i * 3 + 1] = pos.getY(i); a[i * 3 + 2] = pos.getZ(i); } return a; })();
      // normals + UVs weigh in, so a collapse that would smear the texture or the shading costs as much as one that bends the
      // shape (Permissive: seams may move, but only where that stays within the error)
      const nA = geo.attributes.normal, uA = geo.attributes.uv, AT = new Float32Array(pos.count * 5);
      for (let i = 0; i < pos.count; i++) { const o = i * 5; if (nA) { AT[o] = nA.getX(i); AT[o + 1] = nA.getY(i); AT[o + 2] = nA.getZ(i); } if (uA) { AT[o + 3] = uA.getX(i); AT[o + 4] = uA.getY(i); } }
      const W = [nA ? .25 : 0, nA ? .25 : 0, nA ? .25 : 0, uA ? .5 : 0, uA ? .5 : 0], flags = ratio < .2 ? ['Permissive', 'Prune'] : ['Permissive'];
      const src = geo.index.array, groups = geo.groups.length ? geo.groups : [{ start: 0, count: src.length, materialIndex: 0 }];
      const parts = [], ng = []; let total = 0;
      for (const gr of groups) {
        const idx = Uint32Array.from(src.subarray(gr.start, gr.start + Math.min(gr.count, src.length - gr.start)));
        let res = idx;
        if (idx.length >= 720) { const target = Math.max(36, Math.floor(idx.length * ratio / 3) * 3); res = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, AT, 5, W, null, target, err, flags)[0]; }
        ng.push({ start: total, count: res.length, materialIndex: gr.materialIndex || 0 }); parts.push(res); total += res.length;
      }
      if (total > 0 && total < src.length * .85) {
        const all = new Uint32Array(total); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
        const g = new THREE.BufferGeometry();
        for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);    // shared: one copy of the vertices on the GPU
        g.setIndex(new THREE.BufferAttribute(pos.count < 65536 ? Uint16Array.from(all) : all, 1));
        if (geo.groups.length) for (const q of ng) g.addGroup(q.start, q.count, q.materialIndex);
        if (!geo.boundingSphere) geo.computeBoundingSphere(); if (!geo.boundingBox) geo.computeBoundingBox();
        g.boundingSphere = geo.boundingSphere.clone(); g.boundingBox = geo.boundingBox.clone();
        out = g; g.userData.lodShared = 1; geo.userData.lodShared = 1;
      }
    }
  } catch (e) { console.warn('lod', e && e.message); }
  c.set(key, out); return out;
}
const LOD1 = g => lodGeo(g, .3, .02), LOD2 = g => lodGeo(g, .1, .06);

/* ---------- instanced LOD ---------- */
const ILODS = [], ILOD_MIN_TRIS = 1500;
const _ilFr = new THREE.Frustum(), _ilPM = new THREE.Matrix4(), _ilS = new THREE.Sphere(), _ilV = new THREE.Vector3(), _ilM = new THREE.Matrix4(), _ilQ = new THREE.Quaternion();
const ilodLast = { p: new THREE.Vector3(1e9, 0, 0), q: new THREE.Quaternion(), fov: 0, t: 0, view: -1, k: 0 };
/* parts: [{ geo, mat }] standing on y=0; mats: Matrix4 per instance (parent space). opt.far(): draw limit in m (default: the
   view distance). Returns the meshes it made (like instParts). */
function ilodParts(parent, parts, mats, shadow, opt = {}) {
  const box = new THREE.Box3(); for (const p of parts) { if (!p.geo.boundingBox) p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  const ms = box.getBoundingSphere(new THREE.Sphere()), n = mats.length;
  const L = { parent, n, M: new Float32Array(n * 16), C: new Float32Array(n * 3), R: new Float32Array(n), hid: new Uint8Array(n), lev: new Uint8Array(n).fill(255), sh: new Uint8Array(n),
    shadow, far: opt.far, size: ms.radius, ms, buckets: [], placed: false, frames: 0 };
  mats.forEach((m, i) => { m.toArray(L.M, i * 16); });
  const levels = [parts.map(p => p.geo), parts.map(p => LOD1(p.geo)), parts.map(p => LOD2(p.geo))];
  for (let b = 0; b < 4; b++) {
    if (b === 3 && !shadow) break;
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16); attr.setUsage(THREE.DynamicDrawUsage);
    const ims = parts.map((p, k) => {
      const im = new THREE.InstancedMesh(b === 3 ? levels[1][k] : levels[b][k], p.mat, n);
      im.instanceMatrix = attr; im.count = 0; im.visible = false; im.frustumCulled = false;   // culled per instance below
      im.castShadow = b === 3; im.receiveShadow = b < 3; im.userData.ilod = 1;
      if (b === 3) shadowOnly(im);
      parent.add(im); return im;
    });
    L.buckets.push({ attr, ims });
  }
  ILODS.push(L);
  return L.buckets.flatMap(B => B.ims);
}
/* where each instance is in the world: done once, the first frame its parent has a world matrix (all of these are static) */
function ilodPlace(L) {
  L.parent.updateWorldMatrix(true, false); const W = L.parent.matrixWorld, ws = W.getMaxScaleOnAxis();
  for (let i = 0; i < L.n; i++) {
    _ilM.fromArray(L.M, i * 16); const s = _ilM.getMaxScaleOnAxis();
    if (s < .01) { L.hid[i] = 1; continue; }                                  // X_HIDE: a tree kept off a new place
    _ilV.copy(L.ms.center).applyMatrix4(_ilM).applyMatrix4(W);
    L.C[i * 3] = _ilV.x; L.C[i * 3 + 1] = _ilV.y; L.C[i * 3 + 2] = _ilV.z; L.R[i] = L.ms.radius * s * ws;
  }
  L.placed = true;
}
function ilodOne(L, cp) {
  if (!L.placed) ilodPlace(L);
  const K = LOD_K, d0 = Math.max(22, L.size * 3.5) * K, d1 = Math.max(80, L.size * 13) * K, h = 3.5, shR = PQ.shR;
  const far = L.far ? L.far() : (VIEW_M ? VIEW_M + 30 : 2400);
  const B = L.buckets, nb = B.length, cnt = [0, 0, 0, 0], A = B.map(b => b.attr.array), M = L.M;
  for (let i = 0; i < L.n; i++) {
    if (L.hid[i]) continue;
    const x = L.C[i * 3], y = L.C[i * 3 + 1], z = L.C[i * 3 + 2], r = L.R[i];
    const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z) - r;
    if (nb > 3) { const on = d < shR + (L.sh[i] ? 6 : 0); L.sh[i] = on ? 1 : 0; if (on) A[3].set(M.subarray(i * 16, i * 16 + 16), cnt[3]++ * 16); }
    if (d > far) { L.lev[i] = 255; continue; }
    const pl = L.lev[i]; let lv = d < d0 ? 0 : d < d1 ? 1 : 2;
    if (pl !== 255 && lv !== pl) {          // hysteresis: hold the old level a few metres past the line, both ways
      if (lv > pl && d < (pl === 0 ? d0 : d1) + h) lv = pl;
      else if (lv < pl && d > (pl === 2 ? d1 : d0) - h) lv = pl;
    }
    L.lev[i] = lv;
    _ilS.center.set(x, y, z); _ilS.radius = r * 1.1 + 1 + Math.max(0, d) * .07;   // margin: the check runs every few degrees of turn
    if (!_ilFr.intersectsSphere(_ilS)) continue;
    A[lv].set(M.subarray(i * 16, i * 16 + 16), cnt[lv]++ * 16);
  }
  for (let b = 0; b < nb; b++) {
    const c = cnt[b], at = B[b].attr; at.clearUpdateRanges(); if (c) at.addUpdateRange(0, c * 16); at.needsUpdate = c > 0;
    for (const im of B[b].ims) { im.count = c; im.visible = c > 0; }
  }
}
function updILOD(force) {
  const cam = camera, now = performance.now();
  const moved = cam.position.distanceToSquared(ilodLast.p) > 2.25, turned = 1 - Math.abs(cam.quaternion.dot(ilodLast.q)) > 2.5e-4;
  if (!force && !moved && !turned && cam.fov === ilodLast.fov && now - ilodLast.t < 600 && VIEW_M === ilodLast.view && LOD_K === ilodLast.k) return;
  ilodLast.p.copy(cam.position); ilodLast.q.copy(cam.quaternion); ilodLast.fov = cam.fov; ilodLast.t = now; ilodLast.view = VIEW_M; ilodLast.k = LOD_K;
  cam.updateMatrixWorld(); _ilPM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _ilFr.setFromProjectionMatrix(_ilPM);
  const cp = cam.getWorldPosition(_ilV.set(0, 0, 0)).clone();
  if (IN_POCKET) { for (const L of ILODS) for (const B of L.buckets) for (const im of B.ims) { im.count = 0; im.visible = false; } for (const S of SHN.values()) if (S.im) { S.im.count = 0; S.im.visible = false; S.dirty = true; } return; }
  for (const L of ILODS) ilodOne(L, cp);
  updSHN(cp, force);
}

/* ---------- shadow proxies for the drawn forest ----------
   The fir/alder/snag buckets are 200 m across; drawn into a 120 m shadow map, every tree in every bucket the map touched
   was drawn again. They no longer cast shadows themselves: one shadow-only mesh per tree kind holds the trees within reach. */
const SHN = new Map();
function shnAdd(id, geo, mat, key, mats) {
  let S = SHN.get(id);
  if (!S) {
    S = { srcs: new Map(), cap: 0, im: null, last: new THREE.Vector3(1e9, 0, 0), dirty: true }; SHN.set(id, S);
    S.mk = cap => { const im = new THREE.InstancedMesh(geo, mat, cap); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.visible = false; im.castShadow = true; im.receiveShadow = false;
      shadowOnly(im); scene.add(im); return im; };
  }
  const n = mats.length, M = new Float32Array(n * 16), C = new Float32Array(n * 2), R = new Float32Array(n);
  mats.forEach((m, i) => { m.toArray(M, i * 16); C[i * 2] = m.elements[12]; C[i * 2 + 1] = m.elements[14]; R[i] = m.getMaxScaleOnAxis() * 8; });
  S.srcs.set(key, { n, M, C, R }); S.dirty = true;
}
function shnDel(key) { for (const S of SHN.values()) if (S.srcs.delete(key)) S.dirty = true; }
function updSHN(cp, force) {
  for (const S of SHN.values()) {
    if (!force && !S.dirty && Math.hypot(cp.x - S.last.x, cp.z - S.last.z) < 6) continue;
    S.last.copy(cp); S.dirty = false;
    const R2 = PQ.shR + 12; let c = 0;
    const sel = [];
    for (const src of S.srcs.values()) for (let i = 0; i < src.n; i++) { const dx = src.C[i * 2] - cp.x, dz = src.C[i * 2 + 1] - cp.z, rr2 = R2 + src.R[i]; if (dx * dx + dz * dz < rr2 * rr2 && src.R[i] > .1) sel.push(src.M, i); }
    const need = sel.length / 2;
    if (!S.im || S.cap < need) { const cap = Math.max(256, Math.ceil(need * 1.5)); if (S.im) { S.im.removeFromParent(); S.im.userData.gone = 1; S.im.dispose(); } S.im = S.mk(cap); S.cap = cap; }
    const A = S.im.instanceMatrix.array;
    for (let k = 0; k < sel.length; k += 2) { const M = sel[k], i = sel[k + 1]; A.set(M.subarray(i * 16, i * 16 + 16), c++ * 16); }
    const at = S.im.instanceMatrix; at.clearUpdateRanges(); if (c) at.addUpdateRange(0, c * 16); at.needsUpdate = c > 0;
    S.im.count = c; S.im.visible = c > 0;
  }
}

/* ---------- occlusion: underground ----------
   The pockets (cellars, caves, the lab, the Mountain…) sit 150 m under the far corners of the map, sealed in rock: from
   inside one, nothing on the surface can be seen. While you're down there the ground, the forests, the grass and the far
   scenery aren't drawn at all (they were drawn — fogged out, behind the rock — every frame). */
let IN_POCKET = false, underT = 0;
function updUnder(dt) {
  const u = typeof UG !== 'undefined' && !!UG.at;
  underT -= dt; if (u === IN_POCKET && underT > 0) return; underT = .5;
  const changed = u !== IN_POCKET; IN_POCKET = u;
  if (typeof CHUNKS !== 'undefined') for (const m of CHUNKS.values()) m.visible = !u;
  if (typeof grassMesh !== 'undefined' && grassMesh) grassMesh.visible = !u;
  if (changed) { if (typeof farT !== 'undefined') farT = 0; ilodLast.t = 0; }
}

/* ---------- live lights: a point light added after boot would change the light count and recompile every lit material
   (a long freeze, e.g. when a raid sets a shop on fire). They join the light pool instead. ---------- */
function adoptLight(l) { if (!l || !l.isPointLight) return l; l.visible = false; if (typeof LSRC !== 'undefined' && !LSRC.includes(l)) LSRC.push(l); return l; }

/* ---------- graphics memory: give back what nothing has drawn for a while ----------
   three.js keeps every texture and mesh it ever uploaded. A slice of the world's meshes is checked every frame, and
   whatever could be drawn right now (visible, on a drawn layer — on screen or not) stamps its textures/geometry as used. When the graphics-memory estimate is over budget (phones ~320 MB, computers
   ~1.4 GB), or something has gone unused for 10 minutes, the least recently used things are released from the GPU
   (dispose(): the data stays in memory, so it's simply uploaded again if it comes back into view). Under budget, nothing
   recently seen is ever released — so walking back into town doesn't re-upload anything. */
const RES = { tex: new Map(), geo: new Map(), n: 0, t: 0, freedT: 0, freedG: 0, freedMB: 0, mb: 0 };
const RES_BUDGET = (LOW ? 320 : 1400) * 1e6, RES_IDLE = 30e3, RES_STALE = 600e3;
const PINNED = new WeakSet();       // never released: LOD meshes share vertex buffers with their full-detail mesh
const MAT_TEX = new WeakMap();
function texBytes(t) {
  if (!t) return 0;
  if (t.isCompressedTexture && t.mipmaps && t.mipmaps.length) { let b = 0; for (const m of t.mipmaps) b += m.data ? m.data.byteLength : 0; return b; }
  const im = t.image || {}; const w = im.width || 0, h = im.height || 0; if (!w || !h) return 0;
  return w * h * 4 * (t.generateMipmaps === false ? 1 : 1.33);
}
function geoBytes(g) {
  let b = 0; for (const k in g.attributes) { const a = g.attributes[k]; b += (a.array || (a.data && a.data.array) || { byteLength: 0 }).byteLength; }
  if (g.index) b += g.index.array.byteLength; return b;
}
function matTex(m) {
  let c = MAT_TEX.get(m); if (c && c.v === m.version) return c.l;
  const l = []; for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.isRenderTargetTexture) l.push(v); }
  MAT_TEX.set(m, { v: m.version, l }); return l;
}
/* stamp what could be drawn right now — visible, on a drawn layer — whether or not it's on screen, so turning round never
   finds its textures gone. The world's meshes are listed once a minute and checked a slice per frame. */
function resStamp(now) {
  if (!RES.list || now - RES.listT > 60e3) { RES.list = []; scene.traverse(o => { if (o.isMesh || o.isLine || o.isPoints) RES.list.push(o); }); RES.listT = now; RES.i = 0; }
  const L = RES.list, n = Math.min(L.length, 600);
  for (let k = 0; k < n; k++) {
    if (RES.i >= L.length) RES.i = 0; const o = L[RES.i++];
    if (!(o.layers.mask & 1)) continue;
    let v = o, ok = true, top = o; while (v) { if (!v.visible) { ok = false; break; } top = v; v = v.parent; } if (!ok || top !== scene) continue;
    RES.geo.set(o.geometry, now);
    for (const m of [].concat(o.material || [])) if (m) for (const t of matTex(m)) RES.tex.set(t, now);
  }
  if (scene.environment) RES.tex.set(scene.environment, now);
}
function resSweep(now) {
  const props = renderer.properties, cand = []; let total = 0;
  for (const [t, last] of RES.tex) { const p = props.get(t); if (!p || !p.__webglInit) { RES.tex.delete(t); continue; } const b = texBytes(t); total += b; if (now - last > RES_IDLE && !PINNED.has(t)) cand.push([last, t, b, 0]); }
  for (const [g, last] of RES.geo) { const b = geoBytes(g); total += b; if (now - last > RES_IDLE && !PINNED.has(g) && !g.userData.lodShared) cand.push([last, g, b, 1]); }
  RES.mb = total / 1e6;
  cand.sort((a, b) => a[0] - b[0]);
  for (const [last, o, b, isG] of cand) {
    if (total < RES_BUDGET * .85 && now - last < RES_STALE) break;
    if (!isG) { if (o.isCanvasTexture || o.isDataTexture || !o.image && !o.mipmaps) continue; RES.tex.delete(o); RES.freedT++; }
    else { RES.geo.delete(o); RES.freedG++; }
    o.dispose(); total -= b; RES.freedMB += b / 1e6;
  }
}
function updResidency() {
  if (typeof G === 'undefined' || G.mode !== 'play') return;
  const now = performance.now();
  resStamp(now);
  if (now - RES.t > 5000) { RES.t = now; resSweep(now); }
}

/* ---------- shader warm-up: compile every material in the world while the title screen is up ---------- */
async function warmShaders() {
  const t0 = performance.now();
  try {
    // hidden-by-distance groups (layer 2) and invisible things still get their programs: compile looks at every material
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
  } catch (e) { console.warn('warm', e && e.message); }
  PERF.warmMs = Math.round(performance.now() - t0);
}

/* ---------- the stats overlay + load timing ---------- */
try { performance.setResourceTimingBufferSize(4000); } catch (e) {}   // the default 250 entries undercounts the ~800 files
const PERF = { boot0: performance.now(), menuMs: 0, warmMs: 0, playMs: 0, frames: [], calls: 0, tris: 0, shown: false, el: null, t: 0, memT: 0, texMB: 0, geoMB: 0, nTex: 0 };
function perfLoadInfo() {
  let b = 0, n = 0; try { for (const e of performance.getEntriesByType('resource')) { b += e.encodedBodySize || e.transferSize || 0; n++; } } catch (e) {}
  return { mb: b / 1e6, n };
}
function perfMem() {
  const props = renderer.properties, seenT = new Set(), seenG = new Set(); let tb = 0, gb = 0;
  const seenA = new Set(), aBytes = a => { if (!a || seenA.has(a)) return 0; seenA.add(a); return (a.array || (a.data && a.data.array) || { byteLength: 0 }).byteLength; };
  scene.traverse(o => {
    if (o.geometry && !seenG.has(o.geometry)) { seenG.add(o.geometry); const g = o.geometry; for (const k in g.attributes) gb += aBytes(g.attributes[k]); gb += aBytes(g.index); }   // LOD copies share vertices: count each buffer once
    if (o.isInstancedMesh && !seenG.has(o.instanceMatrix)) { seenG.add(o.instanceMatrix); gb += o.instanceMatrix.array.byteLength; }
    for (const m of [].concat(o.material || [])) if (m) for (const k in m) { const t = m[k]; if (t && t.isTexture && !seenT.has(t)) { seenT.add(t); const p = props.get(t); if (p && p.__webglInit) tb += texBytes(t); } }
  });
  PERF.texMB = tb / 1e6; PERF.geoMB = gb / 1e6; PERF.nTex = seenT.size;
}
function perfShow(on) {
  PERF.shown = on; GFX.stats = on; saveGfx();
  if (on && !PERF.el) { PERF.el = document.createElement('div'); PERF.el.id = 'perfhud'; PERF.el.style.cssText = 'position:fixed;left:calc(var(--l) + 52px);top:var(--t);z-index:3;pointer-events:none;font:600 11px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#dfe;background:#000a;padding:5px 8px;border-radius:7px;white-space:pre;letter-spacing:.02em'; document.body.appendChild(PERF.el); }
  if (PERF.el) PERF.el.style.display = on ? 'block' : 'none';
}
/* draw calls and triangles of the whole frame — every pass (shadow map, scene, bloom, grade) — not just the last one */
function perfRender(dt) {
  const inf = renderer.info; inf.autoReset = false; inf.reset();
  composer.render(dt);
  PERF.calls = inf.render.calls; PERF.tris = inf.render.triangles; inf.autoReset = true;
}
function perfFrame(rawDt) {
  if (rawDt > 0 && rawDt < 10) { PERF.frames.push(rawDt * 1000); if (PERF.frames.length > 240) PERF.frames.shift(); }
  if (!PERF.shown) return;
  PERF.t -= rawDt; if (PERF.t > 0) return; PERF.t = .5;
  PERF.memT -= .5; if (PERF.memT <= 0) { PERF.memT = 3; perfMem(); }
  if (!PERF.frames.length) return;
  const F = PERF.frames.slice(-120), avg = F.reduce((a, b) => a + b, 0) / Math.max(1, F.length), S = [...F].sort((a, b) => b - a), low = S[Math.floor(S.length * .01)] || avg;
  const L = perfLoadInfo(), inf = renderer.info, pr = renderer.getPixelRatio();
  PERF.el.textContent = `${(1000 / avg).toFixed(0)} fps  ${avg.toFixed(1)} ms  (1% low ${(1000 / low).toFixed(0)})\n`
    + `draws ${PERF.calls}  tris ${(PERF.tris / 1e6).toFixed(2)}M\n`
    + `gpu ~${Math.round(PERF.texMB)} MB tex + ${Math.round(PERF.geoMB)} MB mesh  (${inf.memory.textures} tex, ${inf.memory.geometries} geo, ${(inf.programs || []).length} shaders)\n`
    + `particles ${typeof parts !== 'undefined' ? parts.length : 0}  people/animals ${typeof ents !== 'undefined' ? ents.length : 0}  sounds ${typeof VOICES !== 'undefined' ? VOICES : 0}\n`
    + `res ${pr.toFixed(2)}x  ${PRESETS[GFX.preset].label}${presetMatches() ? '' : ' (custom)'} · ${TEXQ.label} tex · view ${VIEW_M || 'max'}${bloom.enabled ? ' · bloom' : ''}\n`
    + `load ${(PERF.menuMs / 1000).toFixed(1)} s · ${L.mb.toFixed(0)} MB / ${L.n} files · warm ${PERF.warmMs} ms${RES.freedT + RES.freedG ? `\nfreed ${RES.freedT} tex + ${RES.freedG} geo (${Math.round(RES.freedMB)} MB)` : ''}`;
}
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); perfShow(!PERF.shown); } });

/* ---------- presets ---------- */
function presetMatches() { const D = PRESETS[GFX.preset][LOW ? 'ph' : 'pc']; return D.tex === GFX.tex && D.view === GFX.view; }
function setShadowSize(n) {
  if (sun.shadow.mapSize.x === n) return;
  sun.shadow.mapSize.set(n, n); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.needsUpdate = true;
}
/* apply a preset's live knobs; textures only change on reload (returns true if one is needed) */
function applyPreset(k, withTexView = true) {
  GFX.preset = k; PQ = PRESETS[k][LOW ? 'ph' : 'pc']; LOD_K = PQ.lod;
  setShadowSize(PQ.shadow);
  if (!LOW) bloom.enabled = PQ.bloom;
  if (typeof setPR === 'function') setPR();
  if (typeof grassAt !== 'undefined') grassAt.x = 1e9;                       // regrow the grass patch at the new density
  ilodLast.t = 0;
  if (withTexView) { if (typeof setViewDist === 'function') setViewDist(PQ.view); if (PQ.tex !== GFX.tex) { GFX.tex = PQ.tex; saveGfx(); return true; } }
  saveGfx(); return false;
}
window.__perf = { PERF, RES, ILODS, SHN, lodGeo, applyPreset, perfShow, perfMem, updILOD, get PQ() { return PQ; },
  snap() { perfMem(); const inf = renderer.info; return { calls: PERF.calls, tris: PERF.tris, texMB: Math.round(PERF.texMB), geoMB: Math.round(PERF.geoMB), tex: inf.memory.textures, geos: inf.memory.geometries, progs: (inf.programs || []).length, menuMs: Math.round(PERF.menuMs), warmMs: PERF.warmMs, freed: RES.freedT + RES.freedG }; } };
