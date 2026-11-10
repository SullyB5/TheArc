/* THE ARC — Chapter 1: Landfall
   First-person survival / holdout. One file, built from src/ parts (see build.sh). */
import * as THREE from './three.module.min.js';

const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angWrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let seed = 90210;
const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const rr = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- noise ---------- */
function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; }

/* ---------- map layout ----------
   Camp sits at the origin, gate facing +z (south). Mountains ring the valley. */
const WORLD = 360;                      // walkable radius
const CAMP_R = 42;                      // wall radius
const GATE_HALF = 4.7 / CAMP_R;         // half-angle of the gate gap
const POI = {
  pod:      { x: 172, z: 158 },
  meadow:   { x: 98,  z: -44 },
  village:  { x: -196, z: -66 },
  vault:    { x: -186, z: -206 },
  debris:   { x: 0,   z: 88 },
};
const MEADOWS = [POI.meadow, { x: -72, z: 132 }, { x: 140, z: 58 }, { x: -112, z: 34 }, { x: 60, z: 176 }];
const SHELTERS = [
  { x: 44, z: 150, kind: 'bus' }, { x: 128, z: 96, kind: 'hut' }, { x: -84, z: 92, kind: 'cave' },
  { x: -146, z: -18, kind: 'bus' }, { x: 118, z: -64, kind: 'cave' }, { x: 206, z: 128, kind: 'hut' },
  { x: -96, z: -96, kind: 'hut' }, { x: 214, z: -34, kind: 'cave' }, { x: -150, z: -150, kind: 'bus' },
];
const PATHS = [
  [[0, 40], [0, 96], [46, 136], [112, 150], [170, 156]],
  [[6, 44], [44, 58], [82, 12], [98, -40]],
  [[-6, 44], [-60, 42], [-118, -14], [-190, -62]],
  [[-118, -14], [-150, -128], [-184, -196]],
];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}

/* ---------- terrain ---------- */
function rawH(x, z) {
  let h = (fbm(x * .0075 + 3, z * .0075 + 7) - .5) * 30 + (fbm(x * .03, z * .03) - .5) * 4;
  const d = Math.hypot(x, z), e = Math.max(0, d - 250);
  h += e * e * .0065 + e * .35 * fbm(x * .02 + 9, z * .02);
  const gd = Math.hypot(x + 300, z + 320);
  h += 150 * Math.exp(-(gd * gd) / (2 * 95 * 95));            // the grey mountain
  // the big forested mountain that looms right behind the wreck (north of camp)
  const mx = (x - 10) / 120, mz = (z + 178) / 62;
  h += 165 * Math.exp(-(mx * mx + mz * mz) / 2) * (.85 + fbm(x * .015 + 2, z * .015) * .3);
  h += 40 * Math.exp(-(((x + 70) / 50) ** 2 + ((z + 130) / 40) ** 2) / 2);   // a shoulder ridge to the west
  const pd = pathDist(x, z); if (pd < 10) h -= (1 - pd / 10) * .8; // paths sit a touch lower
  return h;
}
const FLATS = [];
function addFlat(x, z, r0, r1, h) { FLATS.push({ x, z, r0, r1, h: h ?? rawH(x, z) }); }
function heightAt(x, z) {
  let h = rawH(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r1) h = f.h + (h - f.h) * smooth(f.r0, f.r1, d);
  }
  return h;
}
addFlat(0, 0, 54, 88);
addFlat(POI.village.x, POI.village.z, 22, 40);
addFlat(POI.pod.x, POI.pod.z, 8, 22);
addFlat(POI.vault.x, POI.vault.z + 12, 10, 22);
for (const s of SHELTERS) addFlat(s.x, s.z, 6, 14);
const H0 = heightAt(0, 0);

/* ---------- renderer / scene ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9b8b2, 30, 260);
const camera = new THREE.PerspectiveCamera(64, 1, .08, 1400);
camera.rotation.order = 'YXZ';
scene.add(camera);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h > 1.8 ? 60 : w / h > 1.3 ? 64 : 72;
  camera.updateProjectionMatrix();
  $('rot').hidden = !(isTouch && h > w);
}
addEventListener('resize', resize);
resize();

/* ---------- sky + light ---------- */
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, rust: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol; uniform float rust; varying vec3 vP;
    void main(){ float h = max(vP.y,0.); vec3 c = mix(hor, top, pow(h,.5)); if(vP.y<0.) c = hor*.9;
      float s = max(dot(vP, sunDir), 0.); c += sunCol*(pow(s,700.)*3. + pow(s,10.)*.22);
      c = mix(c, vec3(.42,.14,.07), rust);
      gl_FragColor = vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
}));
sky.renderOrder = -1;
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{ const a = []; for (let i = 0; i < 900; i++) { const t = rnd() * Math.PI * 2, y = rr(.08, 1); const r = Math.sqrt(1 - y * y); a.push(Math.cos(t) * r * 950, y * 950, Math.sin(t) * r * 950); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
scene.add(stars);

const hemi = new THREE.HemisphereLight(0xcfdce6, 0x3a3428, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .4;
scene.add(sun, sun.target);

/* time-of-day palette: tod 0 = midnight, .25 sunrise, .5 noon, .75 sunset */
const TOD = [
  [0.00, '#05080e', '#111a24', '#0d141b', '#7b93b8', .28, .24, 70],
  [0.20, '#141c30', '#4a4250', '#3a3a42', '#ffb07a', .3, .32, 120],
  [0.25, '#3a4766', '#d29a74', '#9a8a7e', '#ffb27a', 1.1, .65, 190],
  [0.32, '#6b8fb0', '#c8d2cc', '#aebbb4', '#fff0d6', 2.3, 1.0, 250],
  [0.50, '#5c88b4', '#cfd9d4', '#b5c3bc', '#fff6e8', 2.6, 1.1, 270],
  [0.68, '#5f84aa', '#d6cfbf', '#b6b4a6', '#ffe2b8', 2.3, 1.0, 250],
  [0.76, '#323456', '#e08954', '#866458', '#ff9558', 1.0, .58, 170],
  [0.82, '#141a2e', '#3a2c3c', '#2a2630', '#a8a0c0', .34, .32, 110],
  [0.90, '#05080e', '#111a24', '#0d141b', '#7b93b8', .28, .24, 70],
  [1.00, '#05080e', '#111a24', '#0d141b', '#7b93b8', .28, .24, 70],
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function todSample(t) {
  t = ((t % 1) + 1) % 1;
  let i = 0; while (i < TOD.length - 2 && TOD[i + 1][0] <= t) i++;
  const A = TOD[i], B = TOD[i + 1], k = smooth(0, 1, (t - A[0]) / (B[0] - A[0]));
  const mixC = (j) => _ca.set(A[j]).lerp(_cb.set(B[j]), k).clone();
  return { top: mixC(1), hor: mixC(2), fog: mixC(3), sun: mixC(4), sunI: lerp(A[5], B[5], k), hemiI: lerp(A[6], B[6], k), far: lerp(A[7], B[7], k) };
}

/* ---------- canvas textures ---------- */
function ctex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function grime(g, w, h, n, col) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rr(4, 26);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
const texPanel = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#9a9c9c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 140 + rr(-22, 22) | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    g.fillStyle = '#0000002a'; for (const [a, b] of [[6, 6], [58, 6], [6, 58], [58, 58]]) { g.beginPath(); g.arc(x * 64 + a, y * 64 + b, 1.8, 0, 7); g.fill(); }
  }
  g.fillStyle = '#c96a2a'; g.fillRect(0, 128, w, 7);
  g.fillStyle = '#00000018'; for (let i = 0; i < 26; i++) { const x = rnd() * w; g.fillRect(x, rnd() * h, rr(1, 3), rr(20, 90)); }
  grime(g, w, h, 18, 'rgba(70,45,25,.35)');
}, [2, 2]);
const texCorr = ctex(128, 128, (g, w, h) => {
  for (let x = 0; x < w; x++) { const v = 150 + Math.sin(x / w * Math.PI * 16) * 38 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
  grime(g, w, h, 10, 'rgba(120,60,25,.45)');
  g.fillStyle = '#0000001c'; g.fillRect(0, h - 18, w, 18);
});
const texWood = ctex(64, 128, (g, w, h) => {
  g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(40,25,15,${rr(.15, .35)})`; g.lineWidth = rr(.5, 2); g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + rr(-6, 6), h * .3, x + rr(-6, 6), h * .6, x, h); g.stroke(); }
});
const texConcrete = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#8c8984'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${rr(0, .12)})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  grime(g, w, h, 8, 'rgba(60,50,40,.3)');
});
function signTex(text) {
  return ctex(512, 96, (g, w, h) => {
    g.fillStyle = '#2f2e2c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c1b1a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    g.fillStyle = '#555'; for (const x of [14, w - 14]) for (const y of [16, h - 16]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.font = '900 70px "Big Shoulders Stencil Display", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#d6d0c2'; g.fillText(text.split('').join(String.fromCharCode(8202)), w / 2, h / 2 + 4);
    grime(g, w, h, 10, 'rgba(90,50,20,.35)');
  });
}

/* ---------- materials + geometry helpers ---------- */
const MAT = new Map();
function M(color, o = {}) {
  const k = color + JSON.stringify(Object.keys(o).length ? Object.entries(o).map(([a, b]) => [a, b && b.uuid ? b.uuid : b]) : '');
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...o }));
  return MAT.get(k);
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? M(c, o) : c);
function tm(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function merge(parts) {
  const list = parts.map(p => { let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); if (p.m) g.applyMatrix4(p.m); return { g, c: new THREE.Color(p.color) }; });
  const n = list.reduce((s, p) => s + p.g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const { g, c } of list) {
    const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const VCOL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/* ---------- collision ---------- */
const CELL = 8, grid = new Map();
const gkey = (i, j) => i * 10007 + j;
function addCol(x, z, r, h = 99) {
  const c = { x, z, r, h };
  for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
    for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const k = gkey(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c);
    }
  return c;
}
function nearCols(x, z) { return grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))) || []; }

/* ---------- terrain mesh ---------- */
const SCORCH = [];
const terrain = (() => {
  const SIZE = 840, SEG = isTouch ? 170 : 220;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const c = new THREE.Color(), grass = new THREE.Color('#52703a'), grass2 = new THREE.Color('#3f5a2e'), forest = new THREE.Color('#34442a'),
    dirt = new THREE.Color('#6e5c45'), rock = new THREE.Color('#6c6a64'), snow = new THREE.Color('#dde2e4'), mud = new THREE.Color('#4a3f33');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z); p.setY(i, h);
    const sl = Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5;
    c.copy(grass).lerp(grass2, fbm(x * .05, z * .05)).lerp(forest, smooth(.45, .7, fbm(x * .012 + 40, z * .012)) * .8);
    c.lerp(rock, smooth(.75, 1.4, sl));
    c.lerp(snow, smooth(120, 150, h + fbm(x * .05, z * .05) * 14) * (1 - smooth(1.2, 1.8, sl) * .5));
    const pd = pathDist(x, z); c.lerp(dirt, (1 - smooth(1.8, 4.2, pd)) * .9);
    const cd = Math.hypot(x, z); c.lerp(mud, (1 - smooth(30, 46, cd)) * .75);
    const vd = Math.hypot(x - POI.village.x, z - POI.village.z); c.lerp(dirt, (1 - smooth(14, 24, vd)) * .7);
    for (const s of SCORCH) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r) c.lerp(new THREE.Color('#2a2420'), (1 - d / s.r) * .8); }
    c.multiplyScalar(.92 + hash(x * .7, z * .7) * .16);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  return m;
});
SCORCH.push({ x: 0, z: 92, r: 26 }, { x: -18, z: 74, r: 12 }, { x: 22, z: 112, r: 14 }, { x: POI.pod.x, z: POI.pod.z, r: 14 });

/* ---------- world build ---------- */
const world = new THREE.Group(); scene.add(world);
const SCRAPS = [];          // pickups
const DECOR_ANIM = [];      // things that flicker / spin
let fireLight, campLight, gateGroup, gateDoors = [], wallGroup, towers = [], beaconSmoke = [], vaultLamp, signMat;

function buildTerrainAndForest() {
  world.add(terrain());
  // pines: trunk + three tiers, one geometry, instanced
  const pine = merge([
    { geo: new THREE.CylinderGeometry(.18, .32, 2.6, 5), m: tm(0, 1.3, 0), color: 0x4a3526 },
    { geo: new THREE.ConeGeometry(1.9, 3.2, 7), m: tm(0, 3.1, 0), color: 0x2c4429 },
    { geo: new THREE.ConeGeometry(1.5, 2.9, 7), m: tm(0, 4.6, 0, 0, .4), color: 0x31502e },
    { geo: new THREE.ConeGeometry(1.0, 2.5, 7), m: tm(0, 6.0, 0, 0, .8), color: 0x385a33 },
  ]);
  const snag = merge([
    { geo: new THREE.CylinderGeometry(.12, .3, 7, 5), m: tm(0, 3.5, 0), color: 0x6d655a },
    { geo: new THREE.CylinderGeometry(.04, .08, 2.2, 4), m: tm(.5, 4.5, 0, 0, 0, -.9), color: 0x6d655a },
    { geo: new THREE.CylinderGeometry(.04, .08, 1.6, 4), m: tm(-.4, 5.6, 0, 0, 0, .8), color: 0x6d655a },
  ]);
  const N = isTouch ? 2300 : 3200;
  const pines = new THREE.InstancedMesh(pine, VCOL, N), snags = new THREE.InstancedMesh(snag, VCOL, 160);
  pines.castShadow = snags.castShadow = true; pines.receiveShadow = true;
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  let n = 0, ns = 0, guard = 0;
  while (n < N && guard++ < N * 30) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 395, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 62) continue;
    if (pathDist(x, z) < 5.5) continue;
    if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30)) continue;
    if (Math.hypot(x - POI.village.x, z - POI.village.z) < 34) continue;
    if (Math.hypot(x - POI.pod.x, z - POI.pod.z) < 18) continue;
    if (Math.hypot(x - POI.vault.x, z - POI.vault.z - 8) < 24) continue;
    if (SHELTERS.some(s => Math.hypot(x - s.x, z - s.z) < 12)) continue;
    if (Math.abs(x) < 46 && z > 50 && z < 130 && rnd() < .8) continue;   // debris field mostly open
    const h = heightAt(x, z); if (h > 135) continue;
    if (Math.hypot(heightAt(x + 2, z) - h, heightAt(x, z + 2) - h) > 3.4) continue;   // too steep for trees
    const dens = fbm(x * .02 + 5, z * .02 + 11); if (rnd() > smooth(.3, .62, dens) + .12) continue;
    const s = rr(.85, 1.35), sy = rr(1.3, 2.2);
    if (rnd() < .05 && ns < 160) {
      dummy.position.set(x, h - .3, z); dummy.rotation.set(rr(-.08, .08), rnd() * 6, rr(-.08, .08)); dummy.scale.set(s, sy * .7, s); dummy.updateMatrix();
      snags.setMatrixAt(ns++, dummy.matrix); addCol(x, z, .35 * s); continue;
    }
    dummy.position.set(x, h - .3, z); dummy.rotation.set(rr(-.05, .05), rnd() * 6, rr(-.05, .05)); dummy.scale.set(s, sy, s); dummy.updateMatrix();
    pines.setMatrixAt(n, dummy.matrix);
    tint.setHSL(rr(.22, .3), rr(.15, .35), rr(.75, 1)); pines.setColorAt(n, tint);
    addCol(x, z, .45 * s);
    n++;
  }
  pines.count = n; snags.count = ns;
  world.add(pines, snags);
  // rocks
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockG, M(0x7a776f), 420);
  rocks.castShadow = rocks.receiveShadow = true;
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, r = 60 + Math.sqrt(rnd()) * 330, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDist(x, z) < 4) { i--; continue; }
    const s = rnd() < .1 ? rr(2, 4) : rr(.4, 1.4);
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.set(s * rr(1, 1.6), s * rr(.6, 1), s); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    if (s > 1) addCol(x, z, s * 1.1);
  }
  world.add(rocks);
  // ferns / undergrowth (no collision)
  const fern = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x4c6b33 }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x56763a }]);
  const ferns = new THREE.InstancedMesh(fern, VCOL, 1400);
  for (let i = 0; i < 1400; i++) {
    const a = rnd() * Math.PI * 2, r = 50 + Math.sqrt(rnd()) * 330, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDist(x, z) < 3) { i--; continue; }
    const s = rr(.6, 1.4); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
    ferns.setMatrixAt(i, dummy.matrix);
  }
  world.add(ferns);
}

/* the crashed station: hull modules with ribbed arches, an airlock, and the leaning spire */
function hullModule(r, len, ribs = true) {
  const g = new THREE.Group();
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(len / 8, 3);
  const cyl = mesh(new THREE.CylinderGeometry(r, r, len, 18, 1), new THREE.MeshLambertMaterial({ map: t, color: 0xbdbcb6 }), 0, 0, 0, g);
  cyl.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(r * .92, r, 1, 18), M(0x6d6e6c), s * (len / 2 + .3), 0, 0, g); cap.rotation.z = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(r * .42, .35, 6, 18), M(0x3a3a38), s * (len / 2 + .85), -r * .25, 0, g); ring.rotation.y = Math.PI / 2;
    const hole = mesh(new THREE.CircleGeometry(r * .4, 18), M(0x0d0d0c), s * (len / 2 + .82), -r * .25, 0, g); hole.rotation.y = s * Math.PI / 2;
  }
  if (ribs) for (let x = -len / 2 + 3; x < len / 2 - 1; x += 4.5) {
    const rib = mesh(new THREE.TorusGeometry(r + .45, .32, 4, 14, Math.PI), M(0xd4d4cc), x, 0, 0, g); rib.rotation.y = Math.PI / 2;
    const fin = mesh(new THREE.BoxGeometry(.35, 2.4, .8), M(0xd4d4cc), x, r + 1.4, 0, g); fin.rotation.z = rr(-.25, .25);
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
  mesh(new THREE.BoxGeometry(5, 50, 5), new THREE.MeshLambertMaterial({ map: coreT, color: 0x9a948c }), 0, 25, 0, sp);
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
    const mat = new THREE.MeshLambertMaterial({ map: texCorr, color: pick(sheetCols) });
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
function buildOutside() {
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
  for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, r = rr(70, 330); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) > 70) { i--; continue; } spawnScrap(x, z, 'wild'); }
}

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

/* ================= state ================= */
const gate = { open: true, hp: 260, max: 260, ang: 1 };
const G = { mode: 'title', step: 0, day: 1, tod: .34, todTarget: null, kills: 0, t: 0, chapterDone: false, flags: {} };
const night = { active: false, wave: 0, waves: 3, left: 0, spawnT: 0, between: 0, core: 100, prep: 0 };
const rust = { state: 'none', t: 0, next: 200, k: 0 };
let named = {};
const gateMaxFor = lv => 260 + lv * 220;

/* ================= UI helpers ================= */
const hud = { hp: $('hpb').firstElementChild, fd: $('fdb').firstElementChild, scrap: $('scrap'), meat: $('meat'), mag: $('mag'), res: $('res'), clock: $('clock'),
  obj: $('obj'), objt: $('objt'), objd: $('objd'), arrow: document.querySelector('#obj .arrow'), toast: $('toast'), mark: $('mark'), markd: $('markd'),
  prompt: $('prompt'), hurt: $('hurt'), rustv: $('rustv'), sub: $('sub'), hitm: $('hitm'), use: $('bUse') };
let toastT = 0;
function toast(s, dur = 2.6) { hud.toast.textContent = s; hud.toast.classList.add('on'); toastT = dur; }
let subQ = [], subT = 0;
const SPEAKERS = { Narrator: '#b8b2a4', Vos: '#e8b46a', Kade: '#7fc4b8', Juno: '#e88a8a', Wren: '#b9a6e6', Radio: '#9ad06a', Greyhold: '#d8d8d8' };
function say(lines) { for (const l of lines) subQ.push(l); if (subT <= 0) nextLine(); }
function nextLine() {
  const l = subQ.shift();
  if (!l) { hud.sub.classList.remove('on'); subT = 0; return; }
  const [who, text, fn] = l;
  hud.sub.innerHTML = (who ? `<b style="color:${SPEAKERS[who] || '#ddd'}">${who}</b>` : '') + text;
  hud.sub.classList.add('on'); subT = 1.6 + text.length * .052;
  if (who === 'Radio' || who === 'Greyhold') sfx('radio');
  if (fn) fn();
}
function card(h, p, dur = 4) { $('cardh').textContent = h; $('cardp').textContent = p; $('card').classList.add('on'); setTimeout(() => $('card').classList.remove('on'), dur * 1000); }

/* ================= cinematics ================= */
let cine = null;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function playCine(shots, onEnd) {
  cine = { shots, i: -1, t: 0, onEnd };
  document.body.classList.add('cine');
  if (document.pointerLockElement) document.exitPointerLock();
  nextShot();
}
function nextShot() {
  cine.i++; cine.t = 0;
  const s = cine.shots[cine.i];
  if (!s) return endCine();
  subQ = []; if (s.lines) say(s.lines); else { hud.sub.classList.remove('on'); subT = 0; }
  if (s.fn) s.fn();
  s.dur = s.dur || Math.max(3.2, (s.lines || []).reduce((a, l) => a + 1.6 + l[1].length * .052, 0));
}
function endCine() {
  const c = cine; cine = null; subQ = []; hud.sub.classList.remove('on'); subT = 0;
  document.body.classList.remove('cine');
  camera.position.set(P.x, P.y + 1.62, P.z); camera.rotation.set(P.pitch, P.yaw, 0);
  if (c.onEnd) c.onEnd();
}
function skipCine() { if (cine) nextShot(); }
function updCine(dt) {
  const s = cine.shots[cine.i]; cine.t += dt;
  const k = smooth(0, 1, cine.t / s.dur);
  const f = s.from, t = s.to || s.from, la = s.look, lb = s.look2 || s.look;
  camera.position.set(lerp(f[0], t[0], k), lerp(f[1], t[1], k), lerp(f[2], t[2], k));
  _v1.set(lerp(la[0], lb[0], k), lerp(la[1], lb[1], k), lerp(la[2], lb[2], k));
  camera.lookAt(_v1);
  if (cine.t >= s.dur) nextShot();
}
const Y = (x, z, up = 0) => heightAt(x, z) + up;

/* ================= story ================= */
const STEPS = {
  1: { text: 'Talk to Kade at the workbench', at: () => named.kade },
  2: { text: () => `Salvage hull scrap past the gate (${Math.min(G.flags.fieldScrap || 0, 5)}/5)`, at: () => nearestScrap('field') },
  3: { text: 'Bring the scrap to Kade', at: () => named.kade },
  4: { text: 'Raise the wall at the workbench', at: () => SPOTS.bench },
  5: { text: 'Talk to Juno at the med tent', at: () => named.juno },
  6: { text: () => `Hunt deer in the east meadow (${Math.min(INV.meat, 2)}/2 meat)`, at: () => nearestAnimal('deer') || POI.meadow },
  7: { text: 'Cook the meat at the fire pit', at: () => SPOTS.fire },
  8: { text: 'Find the escape pod beacon', at: () => POI.pod },
  9: { text: 'Bring Wren home to Kestrel', at: () => ({ x: 0, z: CAMP_R + 6 }) },
  10: { text: () => `Get ready — night falls in ${Math.ceil(night.prep)}s`, at: () => SPOTS.bench },
  11: { text: () => `Hold Kestrel until dawn · wave ${night.wave}/${night.waves}`, at: () => ({ x: 0, z: CAMP_R }) },
  12: { text: 'Chapter 2 is coming: look for the sealed door in the mountain', at: () => POI.vaultFront || POI.vault },
  13: { text: 'Free roam: hunt, salvage, upgrade, hold the nights', at: () => null },
};
function nearestScrap(tag) { let b = null, bd = 1e9; for (const s of SCRAPS) if (s.alive && (!tag || s.tag === tag)) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; b = s; } } return b; }
function nearestAnimal(type) { let b = null, bd = 1e9; for (const e of ents) if (e.type === type && !e.dead) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } } return b; }
function setStep(n) { G.step = n; save(); }

function introCine() {
  const g = CAMP_R;
  playCine([
    { from: [60, 120, 260], to: [30, 70, 150], look: [0, 20, 0], look2: [0, 10, 0], dur: 7, lines: [['Narrator', 'For three generations the Arc was the only home any of us knew.'], ['Narrator', 'When the air started running out, the Council cut the outer ring loose and sent it down.']] },
    { from: [-60, 40, -30], to: [-30, 30, -70], look: [-12, 40, -36], look2: [-12, 20, -36], dur: 6, lines: [['Narrator', 'Our piece came down in this valley. Four hundred of us walked out of it.']] },
    { from: [0, Y(0, g + 14, 2), g + 14], to: [0, Y(0, g + 6, 1.7), g + 6], look: [0, Y(0, g, 7.6), g], look2: [0, Y(0, g, 6.5), g], dur: 5, lines: [['Narrator', 'We put a wall around it and named it Kestrel.']] },
    { from: [SPOTS.vosPost.x + 3, H0 + 1.7, SPOTS.vosPost.z - 4], to: [SPOTS.vosPost.x + 1.6, H0 + 1.65, SPOTS.vosPost.z - 2.4], look: [SPOTS.vosPost.x, H0 + 1.7, SPOTS.vosPost.z], fn: () => face(named.vos, SPOTS.vosPost.x + 2, SPOTS.vosPost.z - 3),
      lines: [['Vos', "You're up. Good. Something's been watching us from the treeline since first light."], ['Vos', 'Kade needs a hand with the wall. Go.']] },
  ], () => { P.x = SPOTS.vosPost.x + 1.5; P.z = SPOTS.vosPost.z - 3; P.yaw = Math.atan2(-(SPOTS.bench.x - P.x), -(SPOTS.bench.z - P.z)); P.pitch = 0; setStep(1); toast(isTouch ? 'Left thumb moves · right thumb looks' : 'WASD move · mouse look · E use', 4); });
}
function face(e, x, z) { if (e) e.yaw = Math.atan2(x - e.x, z - e.z); }

function talk(who) {
  const s = G.step;
  if (who === 'kade') {
    if (s === 1) { say([['Kade', 'Half this wall is bedsheets and hope.'], ['Kade', "There's hull scrap all over the field past the gate. Bring me five pieces."]]); G.flags.fieldScrap = 0; setStep(2); return true; }
    if (s === 3) { say([['Kade', "That'll do. Use the bench — wall first."], ['Kade', 'Whatever you bolt on, you will see go up.']]); setStep(4); openShop(); return true; }
  }
  if (who === 'juno' && s === 5) {
    say([['Juno', "Four hundred people and we're splitting ration paste."], ['Juno', "There's deer in the east meadow. Bring back meat — two will do."]]);
    setStep(6); spawnHerd(POI.meadow, 5); return true;
  }
  if (who === 'vos') { say([['Vos', pick(["Keep your rifle clean. It's the only one we've got that shoots straight.", "If the mast horn sounds, get under a roof. Don't stop to ask why.", 'The painted ones test the wall at night. Make it tall.'])]]); return true; }
  if (who === 'wren') { say([['Wren', "I'm fine. I'm right behind you."]]); return true; }
  if (who === 'juno') { if (P.hp < 100) { P.hp = 100; say([['Juno', 'Hold still. There — patched.']]); sfx('pickup'); } else say([['Juno', "You're in one piece. Keep it that way."]]); return true; }
  return false;
}

/* ================= interactables ================= */
const INTERACT = [
  { id: 'kade', at: () => named.kade, r: 3.2, label: () => G.step === 1 || G.step === 3 ? 'Talk to Kade' : null, act: () => talk('kade') },
  { id: 'bench', at: () => SPOTS.bench, r: 3.4, label: () => (G.step >= 4 || G.step === 0) && G.step !== 11 ? 'Workbench' : null, act: () => openShop() },
  { id: 'juno', at: () => named.juno, r: 3, label: () => G.step === 5 ? 'Talk to Juno' : P.hp < 100 ? 'Get patched up' : null, act: () => talk('juno') },
  { id: 'vos', at: () => named.vos, r: 2.8, label: () => G.step > 1 && G.step !== 11 ? 'Talk to Vos' : null, act: () => talk('vos') },
  { id: 'fire', at: () => SPOTS.fire, r: 3.2, label: () => INV.meat > 0 ? `Cook & eat (${INV.meat} meat)` : null, act: () => eat() },
  { id: 'armory', at: () => SPOTS.armory, r: 3, label: () => INV.res < RES_MAX || INV.mag < RIFLE[UP.rifle].mag ? 'Restock ammo' : null, act: () => { INV.res = RES_MAX; INV.mag = RIFLE[UP.rifle].mag; sfx('reload'); toast('Ammo restocked'); } },
  { id: 'pod', at: () => POI.pod, r: 7, label: () => G.step === 8 ? 'Check the pod' : null, act: () => podScene() },
  { id: 'vault', at: () => POI.vaultFront || POI.vault, r: 8, label: () => 'Sealed door', act: () => { say([['', 'Sealed tight. Something hums on the other side.'], ['', 'Chapter 2: Greyhold — coming soon.']]); if (G.step === 12) setStep(13); } },
];
let curInter = null;
function findInteract() {
  if (P.dead || cine || shopOpen) return null;
  let best = null, bd = 1e9;
  for (const it of INTERACT) {
    const at = it.at(); if (!at) continue;
    const d = Math.hypot(at.x - P.x, at.z - P.z); if (d > it.r || d > bd) continue;
    const l = it.label(); if (!l) continue;
    best = { it, l }; bd = d;
  }
  for (const e of ents) if (e.type !== 'clan' && e.type !== 'npc' && e.dead && !e.butchered) {
    const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < 2.8 && d < bd) { bd = d; best = { it: { act: () => butcher(e) }, l: `Butcher the ${e.type}` }; }
  }
  return best;
}
function useInteract() { if (curInter) curInter.it.act(); }

function butcher(e) {
  e.butchered = true; INV.meat += 1; sfx('pickup'); puff(e.x, e.y + .5, e.z, 0x7a2a1a, 5, 1.5, .1, .5);
  toast('+1 meat');
  e.deadT = Math.max(e.deadT, 20);
  if (G.step === 6 && INV.meat >= 2) { setStep(7); say([['Juno', 'Cook it at the fire pit. First real food most of us have ever had.']]); }
}
function eat() {
  if (INV.meat <= 0) return;
  INV.meat--; const lv = UP.smoke;
  P.food = Math.min(100, P.food + [40, 55, 70][lv]); P.hp = Math.min(100, P.hp + [10, 20, 30][lv]);
  sfx('eat'); puff(SPOTS.fire.x, H0 + 1.2, SPOTS.fire.z, 0x9a9a9a, 6, .8, .3, 1.4, 1);
  toast(`+${[40, 55, 70][lv]} food`);
  if (G.step === 7) {
    setStep(8);
    say([['Radio', "Kade here — I've got a pod beacon on the mast."], ['Radio', 'South-east, past the ridge. Somebody else made it down. Go get them.']]);
  }
  save();
}

/* ================= upgrades: Earn-to-Die style tiles ================= */
const UPS = [
  { id: 'wall', max: 3, cost: [5, 16, 30] }, { id: 'gate', max: 3, cost: [6, 14, 26] }, { id: 'tur', max: 3, cost: [10, 20, 34] },
  { id: 'light', max: 2, cost: [8, 18] }, { id: 'rifle', max: 3, cost: [8, 20, 32] }, { id: 'smoke', max: 2, cost: [6, 14] },
];
function iconURL(id) {
  const c = document.createElement('canvas'); c.width = 144; c.height = 100; const g = c.getContext('2d');
  g.lineJoin = g.lineCap = 'round'; const ink = '#14110e';
  const R = (x, y, w, h, f) => { g.fillStyle = f; g.fillRect(x, y, w, h); g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(x, y, w, h); };
  const poly = (pts, f) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = f; g.fill(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke(); };
  if (id === 'wall') { const cs = ['#9da3a6', '#7f8f9e', '#9a7f6a', '#a2a49d', '#9b5a3e']; for (let i = 0; i < 5; i++) { R(14 + i * 23, 30, 23, 56, cs[i]); g.strokeStyle = '#0003'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(14 + i * 23 + k * 6, 33); g.lineTo(14 + i * 23 + k * 6, 83); g.stroke(); } } for (const x of [12, 58, 104, 128]) R(x, 22, 8, 66, '#8a6a4c'); for (let i = 0; i < 6; i++) poly([[16 + i * 20, 30], [26 + i * 20, 12], [36 + i * 20, 30]], '#b08860'); }
  if (id === 'gate') { R(18, 14, 12, 76, '#8a6a4c'); R(114, 14, 12, 76, '#8a6a4c'); R(10, 18, 124, 16, '#2f2e2c'); g.fillStyle = '#d6d0c2'; g.font = '900 13px Impact,sans-serif'; g.textAlign = 'center'; g.fillText('KESTREL', 72, 31); R(30, 40, 41, 50, '#7f8a8e'); R(73, 40, 41, 50, '#9a7f6a'); g.strokeStyle = '#5f4936'; g.lineWidth = 6; g.beginPath(); g.moveTo(32, 48); g.lineTo(69, 84); g.moveTo(75, 84); g.lineTo(112, 48); g.stroke(); }
  if (id === 'tur') { g.strokeStyle = '#6b5a46'; g.lineWidth = 5; g.beginPath(); g.moveTo(44, 96); g.lineTo(56, 40); g.moveTo(100, 96); g.lineTo(88, 40); g.moveTo(48, 80); g.lineTo(96, 60); g.moveTo(96, 80); g.lineTo(48, 60); g.stroke(); R(40, 34, 64, 10, '#6b5a46'); R(58, 18, 26, 16, '#3d4042'); R(84, 22, 46, 6, '#1e1f20'); poly([[132, 25], [142, 18], [142, 32]], '#ffc66a'); }
  if (id === 'light') { poly([[60, 30], [140, 6], [140, 96], [60, 50]], 'rgba(255,240,190,.55)'); R(36, 26, 26, 28, '#2a2a2a'); g.fillStyle = '#fff2c8'; g.beginPath(); g.arc(60, 40, 9, 0, 7); g.fill(); R(44, 54, 8, 40, '#6b5a46'); }
  if (id === 'rifle') { R(16, 46, 30, 16, '#6a4a30'); R(44, 42, 60, 14, '#2b2d2f'); R(100, 46, 38, 6, '#1a1b1c'); R(64, 56, 10, 22, '#1a1b1c'); R(56, 30, 34, 10, '#1a1b1c'); g.fillStyle = '#5aa0b0'; g.fillRect(86, 31, 4, 8); R(120, 44, 18, 10, '#1a1b1c'); }
  if (id === 'smoke') { for (const x of [26, 118]) R(x, 24, 8, 70, '#8a6c50'); R(22, 28, 104, 6, '#8a6c50'); for (let i = 0; i < 6; i++) R(34 + i * 14, 36, 8, 30, ['#8a3a2a', '#7a2e22', '#9a4a30'][i % 3]); g.strokeStyle = '#bbb8'; g.lineWidth = 5; for (const x of [50, 90]) { g.beginPath(); g.moveTo(x, 22); g.bezierCurveTo(x - 10, 14, x + 10, 8, x, 0); g.stroke(); } poly([[14, 26], [72, 8], [130, 26]], '#7a7a72'); }
  return c.toDataURL();
}
const shopEl = $('shop'); let shopOpen = false;
const ICONS = Object.fromEntries(UPS.map(u => [u.id, iconURL(u.id)]));
const GEAR = '<svg viewBox="0 0 16 16"><path d="M2 5l6-3 6 3v6l-6 3-6-3z" fill="#9aa3a8" stroke="#000"/></svg>';
function renderShop() {
  shopEl.innerHTML = UPS.map(u => {
    const lv = UP[u.id], max = lv >= u.max, cost = u.cost[lv];
    return `<div class="tile ${max ? 'max' : INV.scrap < cost ? 'no' : ''}" data-id="${u.id}"><img src="${ICONS[u.id]}" alt="${u.id}"><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'f' : ''}"></i>`).join('')}</div><div class="cost">${max ? 'MAX' : GEAR + cost}</div></div>`;
  }).join('') + '<button id="shopx" aria-label="Close">✕</button>';
}
function openShop() { shopOpen = true; renderShop(); shopEl.classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); }
function closeShop() { shopOpen = false; shopEl.classList.remove('on'); }
shopEl.addEventListener('click', e => {
  if (e.target.closest('#shopx')) { closeShop(); return; }
  const t = e.target.closest('.tile'); if (!t) return;
  const u = UPS.find(x => x.id === t.dataset.id), lv = UP[u.id];
  if (lv >= u.max) return;
  if (INV.scrap < u.cost[lv]) { sfx('no'); toast(`Need ${u.cost[lv]} scrap`); return; }
  INV.scrap -= u.cost[lv]; UP[u.id]++; sfx('buy'); applyUpgrades(u.id);
  renderShop(); shopEl.querySelector(`[data-id="${u.id}"]`)?.classList.add('buy');
  if (G.step === 4 && u.id === 'wall') { setStep(5); closeShop(); say([['Kade', 'Look at that. Almost looks like we meant to live here.'], ['Kade', "Juno's asking for you. Med tent."]]); }
  save();
});
function applyUpgrades(only) {
  if (!only || only === 'wall') buildWall(UP.wall);
  if (!only || only === 'gate') { dressGate(UP.gate); const m = gateMaxFor(UP.gate); gate.hp = Math.min(m, gate.hp + (m - gate.max)); gate.max = m; if (!only) gate.hp = m; }
  if (!only || only === 'tur' || only === 'light') dressTowers(UP.tur, UP.light);
  if (!only || only === 'rifle') { buildRifle(UP.rifle); INV.mag = Math.min(INV.mag + 2, RIFLE[UP.rifle].mag); }
  if (!only || only === 'smoke') dressSmokehouse(UP.smoke);
}

/* ================= story set pieces ================= */
function spawnHerd(c, n) { for (let i = 0; i < n; i++) spawnDeer(c.x + rr(-16, 16), c.z + rr(-16, 16)); }
function podScene() {
  const p = POI.pod;
  if (!named.wren) named.wren = spawnNPC('wren', p.x + 3, p.z + 2, { jacket: 0x6a5a7a, hair: 0x2a1d14, skin: 0xc68e6a, pack: false });
  face(named.wren, P.x, P.z);
  const w = named.wren;
  playCine([
    { from: [P.x, P.y + 1.62, P.z], to: [lerp(P.x, w.x, .55), w.y + 1.6, lerp(P.z, w.z, .55)], look: [w.x, w.y + 1.4, w.z], lines: [['Wren', "Don't shoot — I'm Arc! Wren. Hydroponics deck."]] },
    { from: [w.x + 3, w.y + 1.7, w.z + 3], to: [w.x + 2.2, w.y + 1.65, w.z + 2.2], look: [w.x, w.y + 1.6, w.z], lines: [['Wren', 'There were three of us in this pod. The painted ones took the other two.'], ['Wren', 'Ash on their faces. Thorns on their shoulders. They called themselves Thornkin.']] },
    { from: [p.x - 10, Y(p.x - 10, p.z - 10, 6), p.z - 10], to: [p.x - 16, Y(p.x - 16, p.z - 16, 9), p.z - 16], look: [p.x, Y(p.x, p.z, 2), p.z], lines: [['Wren', "They'll be back for the pod. Please — get me out of here."]] },
  ], () => {
    w.follow = true; setStep(9); G.flags.ambush = 0;
    toast('Wren follows you');
  });
}
function ambushCheck() {
  if (G.step !== 9 || G.flags.ambush) return;
  const d = Math.hypot(P.x, P.z);
  if (d < 140 && d > 70) {
    G.flags.ambush = 1;
    const a = Math.atan2(P.x, P.z);
    for (let i = 0; i < 4; i++) { const b = a + rr(-1.2, 1.2), r = rr(26, 34); const e = spawnClan(i === 3 ? 'thrower' : 'warrior', P.x + Math.sin(b) * r, P.z + Math.cos(b) * r, 'ambush'); e.state = 'chase'; }
    sfx('grunt'); horn(82, 2.2, .18, 3);
    say([['Wren', 'They followed us!']]);
  }
}
function arriveHome() {
  const w = named.wren; w.follow = false; w.home = { x: -14, z: 10 }; w.wander = true;
  playCine([
    { from: [6, H0 + 2.2, 30], to: [4, H0 + 1.8, 26], look: [SPOTS.vosPost.x, H0 + 1.6, SPOTS.vosPost.z], fn: () => { named.vos.x = 2; named.vos.z = 24; face(named.vos, 5, 28); },
      lines: [['Vos', 'You brought one home. Good.'], ['Vos', "But the treeline's full of horns. They're coming tonight."]] },
    { from: [SPOTS.bench.x + 4, H0 + 2, SPOTS.bench.z + 4], look: [SPOTS.bench.x, H0 + 1, SPOTS.bench.z], lines: [['Kade', "Spend what you've got on the bench. We have until dark."]] },
  ], () => { named.vos.x = SPOTS.vosPost.x; named.vos.z = SPOTS.vosPost.z; night.prep = 75; setStep(10); G.todTarget = .74; });
}
function dawnScene(won) {
  const g = CAMP_R;
  G.tod = .24; G.todTarget = null;
  if (!G.chapterDone) {
    playCine([
      { from: [0, H0 + 8, 6], to: [0, H0 + 9, 14], look: [0, H0 + 6, 60], look2: [10, H0 + 10, 90], dur: 5, lines: [['Vos', won ? "Dawn. We're still here." : "Dawn. They got inside — but we're still here."]] },
      { from: [26, H0 + 4, 4], to: [23, H0 + 6, 0], look: [22, H0 + 18, -3], dur: 4.5, lines: [['Radio', '…kssh… Kestrel camp… do you read…']] },
      { from: [24, H0 + 2, 6], look: [22, H0 + 16, -3], lines: [['Greyhold', "This is Greyhold. We've watched your fires since you fell."], ['Greyhold', 'Come to the mountain. We can help you.']] },
      { from: [SPOTS.bench.x + 3, H0 + 1.8, SPOTS.bench.z + 3], look: [named.kade.x, H0 + 1.6, named.kade.z], lines: [['Kade', "Nobody lives in that mountain. Nobody's supposed to."]] },
    ], () => { G.chapterDone = true; card('LANDFALL', 'Chapter 1 complete'); setTimeout(() => card('GREYHOLD', 'Chapter 2 · coming soon', 3.5), 4600); setStep(12); G.day++; save(); });
  } else { G.day++; toast(won ? `Day ${G.day}. Kestrel held.` : `Day ${G.day}. We lost supplies in the night.`, 4); save(); }
}

/* ================= night raids ================= */
function startNight() {
  night.active = true; night.wave = 0; night.core = 100;
  night.waves = G.chapterDone ? Math.min(2 + Math.ceil(G.day / 2), 6) : 3;
  gate.open = false; sfx('gate'); G.tod = .9; G.todTarget = null;
  horn(78, 3.2, .26, 4);
  if (G.step === 10) { setStep(11); say([['Vos', "Gate's shut. Nobody gets over that wall."]]); }
  else say([['Vos', 'Horns in the trees. Everyone to the wall!']]);
  if (Math.hypot(P.x, P.z) > CAMP_R) toast('Get inside the wall!', 4);
  nextWave();
}
function nextWave() {
  night.wave++; night.left = 4 + night.wave * 2 + Math.floor(G.day * 1.5); night.spawnT = 1;
  if (night.wave > 1) { toast(`Wave ${night.wave}`); horn(82, 1.8, .2, 3); }
}
function raiderKind() { const r = rnd(); if (night.wave >= 3 && r < .18) return 'brute'; if (night.wave >= 2 && r < .45) return 'thrower'; return 'warrior'; }
function updNight(dt) {
  if (night.left > 0) {
    night.spawnT -= dt;
    if (night.spawnT <= 0) {
      night.spawnT = rr(.7, 1.6); night.left--;
      const a = rr(-1.7, 1.7) + (night.wave >= 3 && rnd() < .3 ? Math.PI : 0), r = rr(105, 125);
      spawnClan(raiderKind(), Math.sin(a) * r, Math.cos(a) * r, 'raid');
    }
  } else if (!ents.some(e => e.type === 'clan' && !e.dead)) {
    if (night.wave < night.waves) { night.between += dt; if (night.between > 9) { night.between = 0; nextWave(); } }
    else endNight(true);
  }
  if (night.core <= 0) endNight(false);
}
function endNight(won) {
  night.active = false; gate.open = true; gate.hp = gate.max;
  for (const e of [...ents]) if (e.type === 'clan') removeEnt(e);
  if (!won) INV.scrap = Math.floor(INV.scrap * .6);
  for (const s of SCRAPS) if (!s.alive && s.tag === 'wild' && rnd() < .5) { s.alive = true; s.g.visible = true; }
  ensureWildlife();
  dawnScene(won);
}

/* ================= the Rust (red fog) ================= */
function startRust(scripted) {
  rust.state = 'warn'; rust.t = 22;
  horn(110, 3, .22, 0); setTimeout(() => horn(110, 3, .22, 0), 3600);
  say([['Radio', scripted ? "That's the mast horn! Red fog off the ridge — get under a roof, NOW." : 'Mast horn — the Rust is coming. Find cover.']]);
}
function nearestShelter() { let b = null, bd = 1e9; for (const s of SHELTERS) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; b = s; } } if (Math.hypot(P.x, P.z) - CAMP_R < bd) return { x: 0, z: 0, camp: true }; return b; }
function inShelter() { if (Math.hypot(P.x, P.z) < CAMP_R - 2) return true; return SHELTERS.some(s => Math.hypot(s.x - P.x, s.z - P.z) < s.r); }
function updRust(dt) {
  if (rust.state === 'none') {
    if (G.chapterDone && !night.active && G.tod > .3 && G.tod < .68) { rust.next -= dt; if (rust.next <= 0) { rust.next = rr(220, 360); startRust(false); } }
    if (G.step === 8 && !G.flags.rustDone && Math.hypot(P.x, P.z) > 85) { G.flags.rustDone = 1; startRust(true); }
  } else if (rust.state === 'warn') { rust.t -= dt; rust.k = lerp(rust.k, .25, dt * .3); if (rust.t <= 0) { rust.state = 'active'; rust.t = 32; } }
  else if (rust.state === 'active') {
    rust.t -= dt; rust.k = lerp(rust.k, 1, dt * .8);
    P.safe = inShelter();
    if (!P.safe && !P.dead) { P.hp -= 7 * dt; P.coughT -= dt; if (P.coughT <= 0) { P.coughT = rr(1.2, 2.2); sfx('cough'); hud.hurt.style.opacity = .5; } }
    if (rust.t <= 0) { rust.state = 'clear'; rust.t = 8; say([['Radio', 'Fog is lifting. Breathe easy.']]); }
  } else if (rust.state === 'clear') { rust.t -= dt; rust.k = lerp(rust.k, 0, dt * .6); if (rust.t <= 0) { rust.state = 'none'; rust.k = 0; } }
}

/* ================= actors update ================= */
function moveEnt(e, tx, tz, speed, dt) {
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < .05) return 0;
  let want = Math.atan2(dx, dz);
  if (e.side) want += e.side;
  e.yaw += angWrap(want - e.yaw) * Math.min(1, dt * 8);
  const ox = e.x, oz = e.z, st = Math.min(speed * dt, d);
  e.x += Math.sin(e.yaw) * st; e.z += Math.cos(e.yaw) * st;
  collide(e, e.r, false);
  const moved = Math.hypot(e.x - ox, e.z - oz);
  if (moved < st * .3) { e.stuck += dt; if (e.stuck > .5) { e.side = (rnd() < .5 ? -1 : 1) * 1.2; e.stuck = -.8; } } else if (e.stuck < 0) { e.stuck += dt; if (e.stuck >= 0) e.side = 0; } else e.stuck = 0;
  return moved / dt;
}
function updClan(e, dt) {
  const p = e.p;
  if (e.dead) {
    e.deadT += dt; p.g.rotation.x = Math.min(Math.PI / 2, e.deadT * 5) * -1; e.g.position.y = e.y - (e.deadT > 6 ? (e.deadT - 6) * .4 : 0);
    if (e.deadT > 9) removeEnt(e); return;
  }
  e.t += dt; e.cool -= dt;
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp);
  const insideP = Math.hypot(P.x, P.z) < CAMP_R, insideE = Math.hypot(e.x, e.z) < CAMP_R;
  const walled = insideP !== insideE && gate.hp > 0 && !gate.open;
  let tx = e.x, tz = e.z, spd = 0;
  if (e.atk > 0) { // attack swing in progress
    e.atk -= dt; p.armR.rotation.x = e.atk > .25 ? -2.4 : .5; p.legL.rotation.x = p.legR.rotation.x = 0;
    if (e.atk <= .25 && !e.struck) { e.struck = true; sfx('swing');
      if (e.target === 'gate') { gate.hp -= e.kind === 'brute' ? 34 : 14; sfx('thud'); puff(e.x + Math.sin(e.yaw) * 1.2, e.y + 1.4, e.z + Math.cos(e.yaw) * 1.2, 0x8a7a6a, 3, 2, .1, .4); if (gate.hp <= 0) { gate.hp = 0; toast('The gate is down!', 3); sfx('gate'); } }
      else if (dp < 2.7 && !P.dead) hurtPlayer(e.kind === 'brute' ? 24 : 13, e.x, e.z); }
    e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return;
  }
  if (e.climbing) {
    e.climbT -= dt; e.climbY = (1 - Math.abs(e.climbT / e.climbDur * 2 - 1)) * (WALL_H[UP.wall] + .3);
    p.armL.rotation.x = p.armR.rotation.x = -2.8 + Math.sin(e.t * 9) * .4;
    if (e.climbT <= 0) { e.climbing = false; e.climbY = 0; const d = Math.hypot(e.x, e.z); e.x *= (CAMP_R - 1.6) / d; e.z *= (CAMP_R - 1.6) / d; e.pd = CAMP_R - 1.6; e.state = 'chase'; }
    e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y + e.climbY, e.z); e.g.rotation.y = e.yaw; return;
  }
  if (e.state === 'idle') {
    if (e.t > 4) { e.t = 0; e.tx = e.home.x + rr(-10, 10); e.tz = e.home.z + rr(-10, 10); }
    tx = e.tx ?? e.x; tz = e.tz ?? e.z; spd = 1.3;
    if (dp < (e.mode === 'guard' ? 30 : 34) && !P.dead && !(insideP && !gate.open)) { e.state = 'chase'; sfx('grunt'); }
  }
  if (e.state === 'raid') {
    const dE = Math.hypot(e.x, e.z);
    if (!insideE) {
      if (e.climb && UP.wall < 3) {
        const a = Math.atan2(e.x, e.z); tx = Math.sin(a) * (CAMP_R + 1); tz = Math.cos(a) * (CAMP_R + 1); spd = e.speed;
        if (Math.abs(a) < GATE_HALF + .05) e.climb = false;
        if (dE < CAMP_R + 1.4) { e.climbing = true; e.climbDur = e.climbT = 2.2 + UP.wall * 1.4; e.yaw = Math.atan2(-e.x, -e.z); sfx('grunt'); }
      } else if (gate.hp > 0 && !gate.open) {
        tx = clamp(e.x, -3, 3); tz = CAMP_R + 1.5; spd = e.speed;
        if (Math.hypot(e.x - tx, e.z - tz) < 2.2 && e.cool <= 0) { e.yaw = Math.PI; e.target = 'gate'; e.atk = .65; e.struck = false; e.cool = e.kind === 'brute' ? 1.6 : 1.2; }
      } else { tx = 0; tz = dE > CAMP_R + 4 ? CAMP_R + 3 : CAMP_R - 6; spd = e.speed; }
    } else {
      tx = -4; tz = -4; spd = e.speed;
      if (Math.hypot(e.x + 4, e.z + 4) < 9) { night.core -= dt * (e.kind === 'brute' ? 7 : 3.5); if (Math.random() < dt * 3) puff(e.x, e.y + 1, e.z, 0xff8a3a, 2, 1, .12, .5, 2); }
    }
    if (!walled && dp < 16 && !P.dead) e.state = 'chase';
    if (e.kind === 'thrower' && dp < 30 && dp > 8 && e.cool <= 0 && !P.dead && Math.abs(P.y - e.y) < 12) { e.yaw = Math.atan2(dxp, dzp); e.target = 'p'; e.cool = rr(2.4, 3.6); e.throwT = .6; }
  }
  if (e.state === 'chase') {
    if (P.dead || dp > 70 || walled) e.state = e.mode === 'raid' ? 'raid' : 'idle';
    tx = P.x; tz = P.z; spd = e.speed * (dp > 6 ? 1.15 : 1);
    if (e.kind === 'thrower' && dp > 8 && dp < 28 && e.cool <= 0) { e.yaw = Math.atan2(dxp, dzp); e.cool = rr(2.2, 3.4); e.throwT = .6; }
    else if (e.kind === 'thrower' && dp < 12) { tx = e.x - dxp; tz = e.z - dzp; }
    if (dp < 2.1 && e.cool <= 0) { e.yaw = Math.atan2(dxp, dzp); e.target = 'p'; e.atk = .7; e.struck = false; e.cool = e.kind === 'brute' ? 1.6 : 1.1; }
  }
  if (e.throwT > 0) { e.throwT -= dt; p.armR.rotation.x = -2.6; if (e.throwT <= 0) { throwSpear(e); p.armR.rotation.x = .4; } e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return; }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  e.ph += dt * v * 2.1; poseWalk(p, e.ph, Math.min(1, v / 3));
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
function updAnimal(e, dt) {
  const p = e.p;
  if (e.dead) { e.deadT += dt; p.body.rotation.z = Math.min(Math.PI / 2, e.deadT * 4); p.body.position.y = -.25 * Math.min(1, e.deadT * 4); if (e.deadT > 25) removeEnt(e); e.g.position.y = e.y - (e.deadT > 22 ? (e.deadT - 22) : 0); return; }
  e.t -= dt; e.cool -= dt;
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp);
  let spd = 0, tx = e.x, tz = e.z;
  if (e.type === 'deer') {
    if (e.state !== 'flee' && dp < (input.sprint ? 26 : 16) && !P.dead) { e.state = 'flee'; e.t = rr(4, 7); sfx('deer'); }
    if (e.state === 'flee') { tx = e.x - dxp; tz = e.z - dzp; spd = 9.5; if (e.t <= 0) e.state = 'graze'; }
    else if (e.state === 'graze') { if (e.t <= 0) { e.state = 'walk'; e.t = rr(2, 4); e.tx = e.home.x + rr(-14, 14); e.tz = e.home.z + rr(-14, 14); } }
    else { tx = e.tx; tz = e.tz; spd = 1.6; if (e.t <= 0) { e.state = 'graze'; e.t = rr(2, 6); } }
    p.neck.rotation.x = e.state === 'graze' ? 1.1 : 0;
  } else {
    if (e.state !== 'charge' && dp < 11 && !P.dead) { e.state = 'charge'; sfx('grunt'); }
    if (e.state === 'charge') { tx = P.x; tz = P.z; spd = 7.8; if (dp < 1.6 && e.cool <= 0) { hurtPlayer(12, e.x, e.z); e.cool = 1.4; e.state = 'back'; e.t = 1.4; } if (dp > 30) e.state = 'root'; }
    else if (e.state === 'back') { tx = e.x - dxp; tz = e.z - dzp; spd = 5; if (e.t <= 0) e.state = 'charge'; }
    else if (e.t <= 0) { e.t = rr(2, 5); e.tx = e.home.x + rr(-10, 10); e.tz = e.home.z + rr(-10, 10); }
    else if (e.tx !== undefined) { tx = e.tx; tz = e.tz; spd = 1.2; }
  }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  e.ph += dt * v * 2.6; const s = Math.sin(e.ph) * Math.min(1, v / 2) * .7;
  p.legs[0].rotation.x = p.legs[3].rotation.x = s; p.legs[1].rotation.x = p.legs[2].rotation.x = -s;
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
function updNPC(e, dt) {
  const p = e.p, dp = Math.hypot(P.x - e.x, P.z - e.z);
  let tx = e.x, tz = e.z, spd = 0;
  if (e.follow) {
    if (dp > 3.2) { tx = P.x; tz = P.z; spd = dp > 8 ? 7.5 : 4.6; }
    if (dp > 45) { e.x = P.x - Math.sin(P.yaw) * -3; e.z = P.z - Math.cos(P.yaw) * -3; }
    if (G.step === 9 && Math.hypot(e.x, e.z) < CAMP_R - 4 && Math.hypot(P.x, P.z) < CAMP_R - 2) arriveHome();
  } else if (e.wander) {
    e.t -= dt; if (e.t <= 0) { e.t = rr(4, 10); e.tx = e.home.x + rr(-8, 8); e.tz = e.home.z + rr(-8, 8); if (Math.hypot(e.tx, e.tz) > CAMP_R - 6) { e.tx = e.home.x; e.tz = e.home.z; } }
    if (e.tx !== undefined && Math.hypot(e.tx - e.x, e.tz - e.z) > .6) { tx = e.tx; tz = e.tz; spd = 1.3; }
  } else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) > .6) { tx = e.home.x; tz = e.home.z; spd = 2; }
  if (night.active && !e.follow && e.name === 'extra') { tx = e.home.x * .5; tz = -12; spd = spd || 0; }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  if (!v && dp < 6 && !cine) e.yaw += angWrap(Math.atan2(P.x - e.x, P.z - e.z) - e.yaw) * Math.min(1, dt * 4);
  e.ph += dt * v * 2.2; poseWalk(p, e.ph, Math.min(1, v / 2.5));
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
function updTowers(dt) {
  for (const T of towers) {
    if (T.beam) T.beam.material.opacity = (isNight() ? .07 : 0) * (1 - rust.k * .5);
    if (UP.tur <= 0) continue;
    T.cool -= dt; if (T.cool > 0) continue;
    let best = null, bd = 48 + UP.tur * 6;
    for (const e of ents) if (e.type === 'clan' && !e.dead) { const d = Math.hypot(e.x - T.x, e.z - T.z); if (d < bd) { bd = d; best = e; } }
    if (!best) { T.cool = .3; continue; }
    T.cool = [0, 1.1, .8, .55][UP.tur];
    const a = Math.atan2(best.x - T.x, best.z - T.z); T.gun.rotation.y = a - T.a;
    const from = new THREE.Vector3(); T.gun.getWorldPosition(from); from.y += .5;
    const to = new THREE.Vector3(best.x + rr(-.3, .3), best.y + 1.2 + (best.climbY || 0), best.z + rr(-.3, .3));
    tracer(from, to, 0xffd080); sfx('turret', Math.max(.2, 1 - Math.hypot(T.x - P.x, T.z - P.z) / 90));
    if (rnd() < .82) damage(best, [0, 18, 26, 34][UP.tur], false, to);
  }
}

/* ================= player ================= */
function hurtPlayer(n, fx, fz) {
  if (P.dead || cine) return;
  P.hp -= n; P.hurtT = .6; P.kick += .05; sfx('hurt'); hud.hurt.style.opacity = Math.min(1, .35 + n / 30);
  if (P.hp <= 0) die();
}
function die() {
  P.dead = true; P.hp = 0; $('dead').style.display = 'grid'; if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => {
    $('dead').style.display = 'none'; P.dead = false; P.hp = 70; P.food = Math.max(P.food, 50);
    P.x = SPOTS.med.x + 2.5; P.z = SPOTS.med.z + 2.5; P.pd = Math.hypot(P.x, P.z); P.yaw = Math.atan2(-(0 - P.x), -(10 - P.z)); P.pitch = 0;
    const lost = Math.floor(INV.scrap * .25); INV.scrap -= lost; INV.meat = 0; if (INV.res < 16) INV.res = 16;
    if (G.step === 9 && named.wren) { named.wren.x = P.x + 1; named.wren.z = P.z + 1; }
    toast(lost ? `Juno patched you up. Lost ${lost} scrap.` : 'Juno patched you up.', 3.5);
  }, 2600);
}
function damage(e, n, byPlayer, at) {
  if (e.dead) return;
  e.hp -= n;
  puff(at.x, at.y, at.z, e.type === 'clan' ? 0x6a1a12 : 0x6a1a12, 5, 2, .08, .4);
  if (e.type === 'clan' && e.state !== 'chase' && e.state !== 'raid' && byPlayer) e.state = 'chase';
  if (e.type === 'deer' && e.state !== 'flee') { e.state = 'flee'; e.t = rr(5, 8); }
  if (e.type === 'boar') e.state = 'charge';
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 0; G.kills++;
    if (e.type === 'clan') { sfx('grunt'); if (rnd() < .55) { INV.scrap++; if (byPlayer) toast('+1 scrap'); } e.climbing = false; e.climbY = 0; e.g.position.y = e.y; }
    if (e.type === 'deer' || e.type === 'boar') { e.yaw = e.yaw; if (byPlayer) toast(`${e.type === 'deer' ? 'Deer' : 'Boar'} down — go butcher it`); }
  }
}
const ray = new THREE.Vector3(), rayO = new THREE.Vector3();
function shoot() {
  const R = RIFLE[UP.rifle];
  if (P.reload > 0 || P.fire > 0 || P.dead) return;
  if (INV.mag <= 0) { sfx('dry'); P.fire = .25; if (INV.res > 0) reload(); else toast('Out of ammo — restock at the armory'); return; }
  INV.mag--; P.fire = R.rate; P.kick = Math.min(P.kick + .045, .12);
  sfx('shot'); flash.visible = true; flash.rotation.z = rnd() * 6; flashLight.intensity = 3; setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 45);
  camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  ray.x += rr(-R.spread, R.spread); ray.y += rr(-R.spread, R.spread); ray.normalize();
  let best = null, bt = 260, mult = 1;
  for (const e of ents) {
    if (e.dead || e.type === 'npc') continue;
    if (Math.hypot(e.x - P.x, e.z - P.z) > 260) continue;
    for (const [cx, cy, cz, r, m] of hitSpheres(e)) {
      const ox = rayO.x - cx, oy = rayO.y - cy, oz = rayO.z - cz;
      const b = ox * ray.x + oy * ray.y + oz * ray.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
      if (h < 0) continue; const t = -b - Math.sqrt(h);
      if (t > 0 && t < bt) { bt = t; best = e; mult = m; }
    }
  }
  // terrain occlusion: march the ray
  let tHit = bt;
  for (let t = 1; t < bt; t += 1.5) { const x = rayO.x + ray.x * t, y = rayO.y + ray.y * t, z = rayO.z + ray.z * t; if (y < heightAt(x, z)) { tHit = t; best = null; break; } }
  const end = rayO.clone().addScaledVector(ray, tHit);
  const mz = new THREE.Vector3(); muzzle.getWorldPosition(mz); tracer(mz, end);
  if (best) {
    damage(best, R.dmg * mult, true, end); sfx(mult > 1.5 ? 'head' : 'hit');
    hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90);
    if (mult > 1.5) hud.hitm.style.filter = 'drop-shadow(0 0 3px #f44)'; else hud.hitm.style.filter = '';
  } else if (tHit < 259) puff(end.x, end.y + .1, end.z, 0x6a5a48, 4, 1.5, .1, .4);
  if (INV.mag === 0 && INV.res > 0) setTimeout(reload, 220);
}
function reload() {
  const R = RIFLE[UP.rifle];
  if (P.reload > 0 || INV.mag >= R.mag || INV.res <= 0) return;
  P.reload = 1.5; sfx('reload');
}
function finishReload() { const R = RIFLE[UP.rifle], n = Math.min(R.mag - INV.mag, INV.res); INV.mag += n; INV.res -= n; }

function updPlayer(dt) {
  if (P.dead) return;
  // look
  P.yaw -= input.look[0]; P.pitch = clamp(P.pitch - input.look[1], -1.45, 1.45); input.look[0] = input.look[1] = 0;
  // move
  let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const sprint = (input.sprint || ml > .96) && my > .3 && !shopOpen;
  const spd = (sprint ? 8.6 : 5.4) * (shopOpen ? 0 : 1);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const vx = (fx * my + rx * mx) * spd, vz = (fz * my + rz * mx) * spd;
  P.x += vx * dt; P.z += vz * dt;
  collide(P, .42, true);
  const gy = heightAt(P.x, P.z);
  if (input.jump && P.onGround) { P.vy = 6.8; P.onGround = false; }
  input.jump = false;
  P.vy -= 22 * dt; P.y += P.vy * dt;
  if (P.y <= gy) { if (!P.onGround && P.vy < -9) sfx('thud'); P.y = gy; P.vy = 0; P.onGround = true; }
  else if (P.onGround && P.y - gy < .5) P.y = gy; else P.onGround = false;
  const moving = Math.hypot(vx, vz) > .5 && P.onGround;
  P.bob += dt * (moving ? (sprint ? 13 : 9) : 0);
  P.stepT -= dt * (moving ? (sprint ? 1.6 : 1) : 0); if (P.stepT <= 0) { P.stepT = .42; if (moving) sfx('step', sprint ? 1.4 : 1); }
  input.sprint = sprint;
  // survival
  P.food = Math.max(0, P.food - dt * (sprint ? .13 : .08));
  if (P.food <= 0) { P.hp -= dt * 1.2; if (P.hp <= 0) die(); }
  else if (P.food > 45 && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * (Math.hypot(P.x, P.z) < CAMP_R ? 1.6 : .5));
  if (P.hp <= 0 && !P.dead) die();
  P.hurtT -= dt;
  // weapon
  P.fire -= dt; if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) finishReload(); }
  if (input.fire && !shopOpen) shoot();
  P.kick = Math.max(0, P.kick - dt * .45);
  // camera
  const bobY = Math.sin(P.bob) * .045, bobX = Math.cos(P.bob * .5) * .03;
  camera.position.set(P.x, P.y + 1.62 + bobY, P.z);
  camera.rotation.set(P.pitch + P.kick, P.yaw, 0);
  vm.position.set(.26 + bobX, -.25 + bobY * .6 - (P.reload > 0 ? Math.sin(P.reload / 1.5 * Math.PI) * .18 : 0), -.5 + P.kick * 1.2);
  vm.rotation.set(P.reload > 0 ? Math.sin(P.reload / 1.5 * Math.PI) * .6 : P.kick * 2, 0, 0);
  // sheltered under a roof? (mostly for the Rust)
  if (G.step === 9 && named.wren && Math.hypot(P.x, P.z) < 160) ambushCheck();
}

/* ================= wildlife ================= */
function ensureWildlife() {
  const deer = ents.filter(e => e.type === 'deer' && !e.dead).length, boar = ents.filter(e => e.type === 'boar' && !e.dead).length;
  for (let i = deer; i < 14; i++) { const m = pick(MEADOWS); spawnDeer(m.x + rr(-18, 18), m.z + rr(-18, 18)); }
  for (let i = boar; i < 6; i++) { const a = rnd() * 6.28, r = rr(90, 300); spawnBoar(Math.cos(a) * r, Math.sin(a) * r); }
}
function villageGuards() { for (let i = 0; i < 5; i++) spawnClan(i === 4 ? 'brute' : i % 2 ? 'thrower' : 'warrior', POI.village.x + rr(-12, 12), POI.village.z + rr(-12, 12), 'guard'); }

/* ================= time + atmosphere ================= */
const isNight = () => G.tod > .8 || G.tod < .22;
const DAY_LEN = 420;
function updTime(dt) {
  if (night.active) { G.tod = lerp(G.tod, .92, dt * .2); }
  else if (G.todTarget != null) { G.tod = lerp(G.tod, G.todTarget, dt * .08); }
  else if (G.chapterDone && G.step >= 12) {
    G.tod += dt * (.56 / DAY_LEN);
    if (G.tod > .72 && !G.flags.duskWarn) { G.flags.duskWarn = 1; say([['Vos', 'Sun is going down. Get back inside the wall.']]); }
    if (G.tod >= .79) { G.flags.duskWarn = 0; startNight(); }
  }
  if (G.step === 10) { night.prep -= dt; G.tod = lerp(.74, .8, 1 - night.prep / 75); if (night.prep <= 0) startNight(); }
  const s = todSample(G.tod);
  // rust tint
  const rk = rust.k;
  const fogC = s.fog.clone().lerp(_ca.set(0x7a3220), rk);
  scene.fog.color.copy(fogC);
  let far = s.far;
  if (isNight() && Math.hypot(P.x, P.z) < CAMP_R + 30) far += UP.light * 45;
  scene.fog.far = lerp(far, 24, rk); scene.fog.near = lerp(far * .12, 2, rk);
  skyU.top.value.copy(s.top); skyU.hor.value.copy(s.hor).lerp(_ca.set(0x7a3220), rk * .8); skyU.sunCol.value.copy(s.sun); skyU.rust.value = rk * .7;
  const ang = (G.tod - .25) * Math.PI * 2, sd = new THREE.Vector3(Math.cos(ang) * .8, Math.sin(ang), .35).normalize();
  skyU.sunDir.value.copy(sd);
  const ld = sd.y > 0 ? sd : sd.clone().negate();
  sun.position.set(P.x + ld.x * 160, P.y + ld.y * 160, P.z + ld.z * 160); sun.target.position.set(P.x, P.y, P.z);
  sun.color.copy(s.sun); sun.intensity = s.sunI * (1 - rk * .6);
  hemi.intensity = s.hemiI * (1 - rk * .3); hemi.color.copy(s.top).lerp(_cb.set(0xcfd8dc), .5);
  stars.material.opacity = clamp((isNight() ? 1 : 0) - rk, 0, 1) * smooth(.15, .3, Math.abs(G.tod - .5) * 2 - .3) * 1.2;
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  const nightK = clamp(1 - s.sunI / 1.2, 0, 1);
  torch.intensity = nightK * 2.6;
  campLight.intensity = nightK * (.35 + UP.light * .55);
  fireLight.intensity = 1.2 + nightK * 2 + Math.sin(G.t * 17) * .3;
  renderer.toneMappingExposure = 1.08 + nightK * .35;
  if (windGain) windGain.gain.value = .04 + rk * .12;
  hud.rustv.style.opacity = rk > .4 && !P.safe ? 1 : rk * .6;
  if (vaultLamp) vaultLamp.visible = Math.sin(G.t * 3) > 0;
  if (AC && isNight() && !muted && !night.active) { cricketT -= .016; if (cricketT <= 0) { cricketT = rr(.3, 1.6); for (let i = 0; i < 3; i++) tone(rr(3800, 4600), .03, .025, 'sine', i * .06); } }
}

/* ================= HUD ================= */
const _p = new THREE.Vector3();
function updHUD(dt) {
  hud.hp.style.width = Math.max(0, P.hp) + '%'; hud.fd.style.width = P.food + '%';
  hud.scrap.textContent = INV.scrap; hud.meat.textContent = INV.meat;
  hud.mag.textContent = P.reload > 0 ? '··' : INV.mag; hud.res.textContent = '/ ' + INV.res;
  const hh = Math.floor((G.tod * 24 + 24) % 24), mm = Math.floor((G.tod * 24 * 60) % 60 / 15) * 15;
  hud.clock.textContent = `Day ${G.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  // objective
  let text, at;
  if (rust.state === 'warn' || (rust.state === 'active' && !P.safe)) {
    const s = nearestShelter(); text = rust.state === 'warn' ? `Red fog in ${Math.ceil(rust.t)}s — get to cover` : 'Get under a roof!'; at = s;
    hud.obj.classList.add('rust');
  } else {
    hud.obj.classList.remove('rust');
    const st = STEPS[G.step];
    if (night.active && G.step !== 11) { text = `Hold Kestrel · wave ${night.wave}/${night.waves}`; at = { x: 0, z: CAMP_R }; }
    else if (st) { text = typeof st.text === 'function' ? st.text() : st.text; at = st.at(); }
  }
  if (text) { hud.obj.style.display = 'flex'; hud.objt.textContent = text; } else hud.obj.style.display = 'none';
  if (at && !(rust.state === 'active' && P.safe)) {
    const dx = at.x - P.x, dz = at.z - P.z, d = Math.hypot(dx, dz);
    const rel = angWrap(Math.atan2(dx, dz) - (P.yaw + Math.PI));
    hud.arrow.style.transform = `rotate(${-rel}rad)`; hud.objd.textContent = d > 4 ? Math.round(d) + 'm' : '';
    hud.arrow.style.display = '';
    _p.set(at.x, heightAt(at.x, at.z) + 3, at.z).project(camera);
    if (_p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1 && d > 6) {
      hud.mark.style.display = 'flex'; hud.mark.style.left = ((_p.x + 1) / 2 * innerWidth) + 'px'; hud.mark.style.top = ((1 - _p.y) / 2 * innerHeight) + 'px'; hud.markd.textContent = Math.round(d) + 'm';
    } else hud.mark.style.display = 'none';
  } else { hud.arrow.style.display = 'none'; hud.objd.textContent = ''; hud.mark.style.display = 'none'; }
  // interact prompt
  curInter = findInteract();
  if (curInter) {
    if (isTouch) { hud.use.style.display = 'grid'; hud.use.textContent = curInter.l; hud.prompt.style.display = 'none'; }
    else { hud.prompt.style.display = 'block'; hud.prompt.innerHTML = `<kbd>E</kbd>${curInter.l}`; }
  } else { hud.prompt.style.display = 'none'; hud.use.style.display = 'none'; }
  hud.hurt.style.opacity = Math.max(0, (+hud.hurt.style.opacity || 0) - dt * 1.2);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) hud.toast.classList.remove('on'); }
  if (subT > 0) { subT -= dt; if (subT <= 0) nextLine(); }
}

/* ================= input ================= */
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; initAudio();
  if (G.mode !== 'play') return;
  if (cine && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { skipCine(); return; }
  if (e.code === 'KeyE') { if (shopOpen) closeShop(); else useInteract(); }
  if (e.code === 'KeyR') reload();
  if (e.code === 'Space') input.jump = true;
  if (e.code === 'KeyM') setMute(!muted);
  if (e.code === 'Escape' && shopOpen) closeShop();
});
addEventListener('keyup', e => { keys[e.code] = false; });
function keyMove() {
  if (isTouch && !keys.KeyW && !keys.KeyA && !keys.KeyS && !keys.KeyD) return;
  input.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  input.my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
}
canvas.addEventListener('mousedown', e => {
  initAudio();
  if (G.mode !== 'play') return;
  if (cine) { skipCine(); return; }
  if (isTouch) return;
  if (!document.pointerLockElement) { if (!shopOpen) canvas.requestPointerLock?.(); return; }
  if (e.button === 0) input.fire = true;
});
addEventListener('mouseup', e => { if (e.button === 0 && !isTouch) input.fire = false; });
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && !cine) { input.look[0] += e.movementX * .0022; input.look[1] += e.movementY * .0022; } });

// touch: left half = floating stick, right half = look; fire button also looks while held
const stick = $('stick'), knob = stick.firstElementChild, touches = new Map();
const LOOK_S = .0058;
function tStart(e) {
  initAudio();
  if (G.mode !== 'play') return;
  if (cine) { e.preventDefault(); skipCine(); return; }
  for (const t of e.changedTouches) {
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el && (el.closest('.tile') || el.closest('#shopx') || el.closest('#arcade-home'))) continue;
    const btn = el && el.closest('.btn');
    if (btn) {
      btn.classList.add('on');
      if (btn.id === 'bFire') { input.fire = true; touches.set(t.identifier, { kind: 'fire', x: t.clientX, y: t.clientY, btn }); }
      else { touches.set(t.identifier, { kind: 'btn', btn }); if (btn.id === 'bJump') input.jump = true; if (btn.id === 'bRel') reload(); if (btn.id === 'bUse') useInteract(); }
      continue;
    }
    if (t.clientX < innerWidth * .42 && ![...touches.values()].some(v => v.kind === 'stick')) {
      touches.set(t.identifier, { kind: 'stick', x: t.clientX, y: t.clientY });
      stick.style.display = 'block'; stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px'; knob.style.transform = '';
    } else touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
  }
  e.preventDefault();
}
function tMove(e) {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.kind === 'stick') {
      let dx = t.clientX - s.x, dy = t.clientY - s.y; const d = Math.hypot(dx, dy), m = 52;
      if (d > m) { dx *= m / d; dy *= m / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; input.mx = dx / m; input.my = -dy / m;
    } else if (s.kind === 'look' || s.kind === 'fire') {
      input.look[0] += (t.clientX - s.x) * LOOK_S; input.look[1] += (t.clientY - s.y) * LOOK_S; s.x = t.clientX; s.y = t.clientY;
    }
  }
  e.preventDefault();
}
function tEnd(e) {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.kind === 'stick') { input.mx = input.my = 0; stick.style.display = 'none'; }
    if (s.kind === 'fire') input.fire = false;
    if (s.btn) s.btn.classList.remove('on');
    touches.delete(t.identifier);
  }
}
for (const el of [canvas, $('touch')]) { el.addEventListener('touchstart', tStart, { passive: false }); el.addEventListener('touchmove', tMove, { passive: false }); el.addEventListener('touchend', tEnd); el.addEventListener('touchcancel', tEnd); }
document.addEventListener('touchmove', e => { if (G.mode === 'play' && !e.target.closest('#shop')) e.preventDefault(); }, { passive: false });

/* ================= save ================= */
const SAVE = 'the-arc-save-v1';
function save() {
  if (G.mode !== 'play') return;
  try { localStorage.setItem(SAVE, JSON.stringify({ step: G.step, day: G.day, tod: G.tod, chapterDone: G.chapterDone, flags: G.flags, inv: INV, up: UP, hp: P.hp, food: P.food })); } catch (e) {}
}
function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }

/* ================= main loop ================= */
let last = performance.now(), saveT = 0, titleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  G.t += dt;
  for (const f of DECOR_ANIM) f(G.t);
  for (const s of SCRAPS) if (s.alive) { s.glint.rotation.y += dt * 2; s.glint.position.y = .55 + Math.sin(G.t * 3 + s.ph) * .1; s.glint.visible = Math.sin(G.t * 4 + s.ph) > -.2; }
  for (const p of beaconSmoke) { p.userData.k = (p.userData.k + dt * .08) % 1; const k = p.userData.k; p.position.set(POI.pod.x + Math.sin(k * 9) * k * 2, heightAt(POI.pod.x, POI.pod.z) + 2 + k * 26, POI.pod.z + k * 4); p.scale.setScalar(1 + k * 3); p.material.opacity = .4 * (1 - k); p.visible = G.step <= 8; }
  // gate swing
  const gTarget = gate.hp <= 0 ? .3 : gate.open ? 1 : 0;
  gate.ang = lerp(gate.ang, gTarget, dt * 2.5);
  for (const d of gateDoors) { d.pivot.rotation.y = d.s * gate.ang * 1.65; d.door.rotation.z = gate.hp <= 0 ? d.s * .4 : 0; }

  if (G.mode === 'title') {
    titleT += dt * .04;
    camera.position.set(Math.sin(titleT) * 70, H0 + 22, Math.cos(titleT) * 70 + 10);
    camera.lookAt(0, H0 + 8, 0);
    updTime(dt);
  } else {
    keyMove();
    if (cine) updCine(dt); else { updPlayer(dt); }
    for (const e of [...ents]) {
      if (Math.hypot(e.x - P.x, e.z - P.z) > 240 && e.type !== 'clan') continue;
      if (e.type === 'clan') updClan(e, dt); else if (e.type === 'npc') updNPC(e, dt); else updAnimal(e, dt);
    }
    updTowers(dt); updSpears(dt);
    if (night.active) updNight(dt);
    updRust(dt); updTime(dt); updHUD(dt);
    // scrap pickup
    for (const s of SCRAPS) if (s.alive && Math.hypot(s.x - P.x, s.z - P.z) < 1.9 && !P.dead) {
      s.alive = false; s.g.visible = false; INV.scrap++; sfx('pickup'); toast('+1 scrap', 1.2);
      if (G.step === 2 && s.tag === 'field') { G.flags.fieldScrap = (G.flags.fieldScrap || 0) + 1; if (G.flags.fieldScrap >= 5) { setStep(3); say([['Radio', "Kade here — that's enough. Bring it to the bench."]]); } }
    }
    saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  }
  updParts(dt); updTracers(dt);
  renderer.render(scene, camera);
}

/* ================= start ================= */
function startGame(fresh) {
  initAudio();
  const s = !fresh && load();
  Object.assign(UP, { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 }); Object.assign(INV, { scrap: 0, meat: 0, mag: 8, res: 24 });
  G.step = 0; G.day = 1; G.tod = .34; G.chapterDone = false; G.flags = {};
  if (s) {
    Object.assign(UP, s.up); Object.assign(INV, s.inv); G.day = s.day; G.chapterDone = s.chapterDone; G.flags = s.flags || {}; P.hp = s.hp ?? 100; P.food = s.food ?? 100;
    G.step = s.step;
    if (G.step === 9) G.step = 8;            // the pod escort restarts from the pod
    if (G.step === 10 || G.step === 11) { G.step = 10; }
    if (G.step >= 12) G.tod = clamp(s.tod, .26, .7); else G.tod = G.step >= 8 ? .58 : G.step >= 5 ? .45 : .36;
    if (G.step === 6) spawnHerd(POI.meadow, 4);
  }
  applyUpgrades();
  gate.hp = gate.max;
  document.body.classList.remove('title'); G.mode = 'play';
  if (!s || G.step === 0) introCine();
  else {
    P.x = SPOTS.vosPost.x + 1.5; P.z = SPOTS.vosPost.z - 3; P.pd = Math.hypot(P.x, P.z); P.yaw = 0; P.pitch = 0;
    if (G.step === 10) { night.prep = 60; G.todTarget = .74; if (named.wren) { named.wren.wander = true; } else { named.wren = spawnNPC('wren', -14, 10, { jacket: 0x6a5a7a, hair: 0x2a1d14, skin: 0xc68e6a, pack: false, wander: true }); } }
    if (G.step >= 12 && !named.wren) named.wren = spawnNPC('wren', -14, 10, { jacket: 0x6a5a7a, hair: 0x2a1d14, skin: 0xc68e6a, pack: false, wander: true });
    toast(`Day ${G.day} · Kestrel`, 3);
  }
  if (!isTouch) setTimeout(() => canvas.requestPointerLock?.(), 50);
}
function menu() {
  const s = load();
  $('menu').innerHTML = (s && s.step > 0 ? '<button id="bCont">Continue</button><button class="sec" id="bNew">New game</button>' : '<button id="bNew">Start</button>') + `<button class="sec" id="bMute">Sound: ${muted ? 'off' : 'on'}</button>`;
  $('keys').textContent = isTouch ? 'Left thumb: move (push to the edge to sprint) · right thumb: look · hold the crosshair button to fire and aim.' : 'WASD move · Shift sprint · mouse look · click fire · R reload · E use · Space jump · M sound';
  $('bNew').onclick = () => { if (s && s.step > 0 && !confirmNew()) return; try { localStorage.removeItem(SAVE); } catch (e) {} startGame(true); };
  if ($('bCont')) $('bCont').onclick = () => startGame(false);
  $('bMute').onclick = () => { setMute(!muted); $('bMute').textContent = `Sound: ${muted ? 'off' : 'on'}`; };
}
let newArmed = false;
function confirmNew() { if (newArmed) return true; newArmed = true; $('bNew').textContent = 'Tap again to wipe save'; setTimeout(() => { newArmed = false; if ($('bNew')) $('bNew').textContent = 'New game'; }, 2500); return false; }

async function boot() {
  try { await Promise.race([document.fonts.load('900 70px "Big Shoulders Stencil Display"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  buildTerrainAndForest(); buildArc(); buildWall(0); buildGate(); dressGate(0); buildTowers(); dressTowers(0, 0); buildCampProps(); dressSmokehouse(0); buildOutside(); seedScraps(); buildRifle(0);
  named.kade = spawnNPC('kade', SPOTS.bench.x + 1.4, SPOTS.bench.z + 1.6, { jacket: 0x5a4a3a, hair: 0x161616, skin: 0x8d5a3c, yaw: -2.2 });
  named.juno = spawnNPC('juno', SPOTS.med.x + 2.6, SPOTS.med.z + 1.4, { jacket: 0xdedad0, hair: 0x8a6a3a, skin: 0xf0c8a8, yaw: 1 });
  named.vos = spawnNPC('vos', SPOTS.vosPost.x, SPOTS.vosPost.z, { jacket: 0x2f3d4c, hair: 0x9a9a92, skin: 0xc68e6a, yaw: Math.PI, scale: 1.05 });
  for (const [x, z] of [[-3, 10], [6, 9], [-12, 4], [2, -2], [18, 18], [-20, 18], [8, 2]]) spawnNPC('extra', x, z, { wander: true });
  ensureWildlife(); villageGuards();
  sky.position.copy(camera.position);
  menu();
  requestAnimationFrame(frame);
}
boot();
window.__arc = { G, P, INV, UP, night, rust, ents, gate, startNight, startRust, setStep, skipCine: () => skipCine(), get cine() { return cine; } };
