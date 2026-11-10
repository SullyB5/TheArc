
/* ================= the far view: what makes the land read as huge =================
   - far terrain: one coarse mesh of the whole map, always drawn, tucked just under the streamed chunks near you
   - far forest: cheap two-tier cones over every forested hillside, only drawn past where the real trees stop
   - the horizon: range after range of mountains out past the world's edge, fading into the haze
   - life in the sky: smoke rising from the clan holds and the dead city, and birds wheeling over the valley */
const FAR_STEP = LOW ? 32 : 24, FAR_HALF = HALF + FAR_STEP * 4, FAR_EDGE = HALF - 40;
const FAR_TREE_NEAR = 385, FAR_TREE_FULL = 425;
/* height for the far views: the map, clamped so the out-of-bounds corners of the square don't shoot to the moon */
function farH(x, z) {
  const d = Math.hypot(x, z);
  if (d > FAR_EDGE) { x *= FAR_EDGE / d; z *= FAR_EDGE / d; }
  return Math.min(heightAt(x, z), 1500);
}
const sinkU = { value: 1 };
function sinkShader(mat, near0, near1, deep) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSink = sinkU;
    sh.vertexShader = 'uniform float uSink;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float fd = distance(transformed.xz, cameraPosition.xz);
        transformed.y -= uSink * (2.5 + fd * .002 + ${deep.toFixed(1)} * (1.0 - smoothstep(${near0.toFixed(1)}, ${near1.toFixed(1)}, fd))); }`);
  };
}
async function buildFarTerrain() {
  const N = Math.round(FAR_HALF * 2 / FAR_STEP) + 1, pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), c = new THREE.Color(), fir = new THREE.Color(0x2c4030);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -FAR_HALF + i * FAR_STEP, z = -FAR_HALF + j * FAR_STEP, h = farH(x, z), k = j * N + i;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const sl = Math.hypot(farH(x + 6, z) - h, farH(x, z + 6) - h) / 6;
      terrainColor(x, z, h, sl, c);
      // hillsides that carry forest read darker from a distance, the way a real conifer slope does
      const dens = fbm(x * .018 + 5, z * .018 + 11), fk = smooth(.3, .6, dens) * (1 - smooth(110, 138, h)) * (1 - smooth(1, 1.5, sl)) * (Math.hypot(x, z) < 62 ? 0 : 1);
      c.lerp(fir, fk * .6);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    if (j % 40 === 0) { setLoad(`SEEING FAR ${Math.round(j / N * 100)}%`); await nextFrame(); }
  }
  const idx = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, d = a + N, e = d + 1;
    const cx = -FAR_HALF + (i + .5) * FAR_STEP, cz = -FAR_HALF + (j + .5) * FAR_STEP;
    if (Math.hypot(cx, cz) > HALF + FAR_STEP * 2) continue;             // the horizon ring takes over out there
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.detailSoil });
  // the streamed chunks own everything within ~460m of you; the far mesh sinks well under them there
  sinkShader(mat, 330, 450, 30);
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -1; world.add(m); farTerrMesh = m;
  // uv so the detail texture tiles the same as the chunks (x/7, z/7)
  const uv = new Float32Array(N * N * 2); for (let k = 0; k < N * N; k++) { uv[k * 2] = pos[k * 3] / 7; uv[k * 2 + 1] = pos[k * 3 + 2] / 7; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* the far forest: same density rules as the real trees, so the silhouettes line up with what you'll find when you get there */
function farTreeOK(x, z) {
  const d = Math.hypot(x, z); if (d < 62 || d > WORLD + 120) return false;
  if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30) || OUT_MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 45)) return false;
  if (FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r0 + 6)) return false;
  for (const p of [[POI.cinder, 110], [POI.burn, 64], [POI.halvard, 96], [POI.ashmere, 62]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  const h = heightAt(x, z); if (h > 136 || waterAt(x, z) > h - .6) return false;
  if (slopeAt(x, z) > 1.5) return false;
  if (pathDist(x, z) < 6) return false;
  return true;
}
let farTrees = null, farTerrMesh = null, horizonMesh = null;
async function buildFarForest() {
  const step = LOW ? 21 : 14, R = cellRng(77, 91), list = [];
  for (let z = -WORLD - 120; z <= WORLD + 120; z += step) {
    for (let x = -WORLD - 120; x <= WORLD + 120; x += step) {
      const px = x + (R() - .5) * step * .9, pz = z + (R() - .5) * step * .9;
      const dens = fbm(px * .018 + 5, pz * .018 + 11);
      if (R() > smooth(.3, .6, dens) + .1) continue;
      if (!farTreeOK(px, pz)) continue;
      list.push(px, pz, lerp(.8, 1.35, R()), R());
    }
    if (Math.round(z) % 400 < step) { setLoad(`THE FAR FOREST ${Math.round((z + WORLD) / (WORLD * 2) * 100)}%`); await nextFrame(); }
  }
  const geo = merge([
    { geo: new THREE.ConeGeometry(3.6, 12, 5, 1, true), m: tm(0, 8, 0), color: 0x2a4232, color2: 0x4c7454 },
    { geo: new THREE.ConeGeometry(2.3, 8, 5, 1, true), m: tm(0, 15, 0, 0, .6), color: 0x355640, color2: 0x5e8a62 },
  ]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // drawn only past where the real trees end, and they grow in over 40m so there's no hard pop
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ic = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float fd = distance(ic.xz, cameraPosition.xz);
        transformed *= smoothstep(${FAR_TREE_NEAR.toFixed(1)}, ${FAR_TREE_FULL.toFixed(1)}, fd); }`);
  };
  // bucketed into 400m tiles so the camera only draws the tiles in view
  const TILE = 400, buckets = new Map(), n = list.length / 4, dm = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < n; i++) { const k = Math.floor((list[i * 4] + HALF) / TILE) * 100 + Math.floor((list[i * 4 + 1] + HALF) / TILE); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); }
  farTrees = [];
  for (const L of buckets.values()) {
    const im = new THREE.InstancedMesh(geo, mat, L.length);
    L.forEach((i, j) => {
      const x = list[i * 4], z = list[i * 4 + 1], s = list[i * 4 + 2], r = list[i * 4 + 3];
      dm.position.set(x, heightAt(x, z) - .3, z); dm.rotation.set(0, r * 6, 0); dm.scale.set(s, s * lerp(.9, 1.25, r), s); dm.updateMatrix();
      im.setMatrixAt(j, dm.matrix); im.setColorAt(j, tint.setHSL(lerp(.27, .36, r), lerp(.1, .3, (r * 7) % 1), lerp(.7, 1, (r * 13) % 1)));
    });
    im.computeBoundingSphere(); im.boundingSphere.radius += 30; im.castShadow = false; im.receiveShadow = false; world.add(im); farTrees.push(im);
  }
}

/* the horizon: ranges of mountains beyond the world's edge, out to ~9km */
function buildHorizon() {
  const SEG = LOW ? 220 : 360, RADII = [HALF - 60, HALF + 200, 2900, 3400, 4000, 4700, 5500, 6400, 7400, 8600];
  const pos = [], col = [], idx = [], c = new THREE.Color(), rock = new THREE.Color(0x6a6c70), forest = new THREE.Color(0x34483c), snow = new THREE.Color(0xe4e8ec);
  for (let ri = 0; ri < RADII.length; ri++) {
    const r = RADII[ri];
    for (let s = 0; s <= SEG; s++) {
      const a = s / SEG * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const ridge = 1 - Math.abs(fbm(x * .0006 + 17, z * .0006 - 3) * 2 - 1);
      let h = 300 + 1000 * ridge * ridge + 200 * fbm(x * .0025 + 1, z * .0025 + 4) - 300 * smooth(4000, 8600, r);
      if (ri === 0) h = farH(x, z) - 6;                                  // meet the map's own edge
      else if (ri === 1) h = lerp(farH(x, z), h, .45);
      pos.push(x, h, z);
      c.copy(forest).lerp(rock, smooth(450, 850, h)).lerp(snow, smooth(950, 1250, h + fbm(x * .004, z * .004) * 160));
      col.push(c.r, c.g, c.b);
    }
  }
  const W = SEG + 1;
  for (let ri = 0; ri < RADII.length - 1; ri++) for (let s = 0; s < SEG; s++) { const a = ri * W + s, b = a + 1, d = a + W, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.frustumCulled = false; m.renderOrder = -1; world.add(m); horizonMesh = m;
}

/* smoke from the holds and the dead city: tall columns you can steer by from kilometres away */
const FAR_SMOKE = [];
function buildFarSmoke() {
  const tex = ctex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(.6, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const src = [...HOLDS.map(H => [H.x, H.z, 0x8a8580]), [POI.cinder.x, POI.cinder.z, 0x5c5856], [POI.cinder.x + 60, POI.cinder.z - 40, 0x5c5856], [POI.ashmere.x, POI.ashmere.z, 0x8a8580]];
  for (const [x, z, color] of src) {
    const y0 = heightAt(x, z), N = 14;
    for (let i = 0; i < N; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: .5 }));
      world.add(sp); FAR_SMOKE.push({ sp, x, z, y0, k: i / N, ph: rnd() * 6 });
    }
  }
}

/* birds: a few loose flocks wheeling high over wherever you are */
let birdL, birdR; const BIRDS = [], FLOCKS = [];
function buildBirds() {
  const wing = side => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.25, 0, 0, .35, side * 1.1, 0, .05], 3)); g.computeVertexNormals(); return g; };
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1c1e, side: THREE.DoubleSide });
  const n = LOW ? 24 : 40;
  birdL = new THREE.InstancedMesh(wing(-1), mat, n); birdR = new THREE.InstancedMesh(wing(1), mat, n);
  for (const b of [birdL, birdR]) { b.frustumCulled = false; world.add(b); }
  for (let f = 0; f < 5; f++) FLOCKS.push({ x: rr(-300, 300), z: rr(-300, 300), y: 0, r: rr(30, 70), a: rnd() * 6, w: rr(.08, .16) * (rnd() < .5 ? -1 : 1), up: rr(55, 140) });
  for (let i = 0; i < n; i++) BIRDS.push({ f: i % FLOCKS.length, ox: rr(-14, 14), oz: rr(-14, 14), oy: rr(-6, 6), ph: rnd() * 6, s: rr(.8, 1.3) });
}
const _bm = new THREE.Object3D(), _bq = new THREE.Quaternion(), _bf = new THREE.Vector3(0, 0, 1);
function updFar(dt, t, px, pz) {
  for (const S of FAR_SMOKE) {
    const k = (S.k + t * .012) % 1, h = k * 230;
    S.sp.position.set(S.x + Math.sin(S.ph + t * .05) * 8 + k * k * 180, S.y0 + 8 + h, S.z + k * k * 70);
    const sc = 24 + k * 130; S.sp.scale.set(sc, sc * .85, 1); S.sp.material.opacity = .3 * smooth(0, .1, k) * (1 - smooth(.55, 1, k));
  }
  if (!birdL) return;
  for (const F of FLOCKS) {
    // a flock that's drifted far from you finds somewhere new nearby
    if (Math.hypot(F.x - px, F.z - pz) > 650) { const a = rnd() * 6.28, r = rr(120, 420); F.x = px + Math.cos(a) * r; F.z = pz + Math.sin(a) * r; }
    F.a += F.w * dt; F.x += Math.cos(F.a * .3) * dt * 1.5; F.z += Math.sin(F.a * .3) * dt * 1.5;
    F.y = lerp(F.y || heightAt(F.x, F.z) + F.up, heightAt(F.x, F.z) + F.up, dt * .2);
  }
  BIRDS.forEach((B, i) => {
    const F = FLOCKS[B.f], a = F.a + B.ph * .15;
    const x = F.x + Math.cos(a) * F.r + B.ox, z = F.z + Math.sin(a) * F.r + B.oz, y = F.y + B.oy + Math.sin(t * .7 + B.ph) * 2;
    const yaw = -a + (F.w > 0 ? 0 : Math.PI), flap = Math.sin(t * 9 + B.ph * 3) * (Math.sin(t * .6 + B.ph) > -.3 ? .7 : .05);
    _bm.position.set(x, y, z); _bm.scale.setScalar(B.s);
    _bm.rotation.set(0, yaw, flap); _bm.updateMatrix(); birdL.setMatrixAt(i, _bm.matrix);
    _bm.rotation.set(0, yaw, -flap); _bm.updateMatrix(); birdR.setMatrixAt(i, _bm.matrix);
  });
  birdL.instanceMatrix.needsUpdate = birdR.instanceMatrix.needsUpdate = true;
}
async function buildFar() {
  await buildFarTerrain(); buildHorizon();
  await buildFarForest(); buildFarSmoke(); buildBirds();
}
