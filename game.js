/* THE ARC — Chapter 1: Landfall
   First-person survival / holdout. Built from src/ parts by build.sh into game.js.
   Art pass borrows Bryce's ELYRA kit: its real-world gun models, survivor models, terrain + metal textures, sound library,
   the darker score, and its finishing pass (bloom + grade). Names, places and story are The Arc's own. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './vendor/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

/* ---------- atmosphere: height fog with aerial perspective (replaces three's flat linear fog everywhere) ----------
   fog.near = where haze starts, fog.far = the distance that's ~95% hazed at valley-floor height. The haze thins with altitude,
   so ridges and peaks stand out above the murk in the low ground — that's what sells the distance. */
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogDepth = - mvPosition.z;\nvFogWorld = (inverse(viewMatrix) * mvPosition).xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\nuniform float fogNear;\nuniform float fogFar;\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fogDist = max(0.0, length(vFogWorld - cameraPosition) - fogNear);
  float fogHy = max(0.0, (vFogWorld.y + cameraPosition.y) * .5 - 12.0);
  float fogDen = (3.0 / max(fogFar, 1.0)) * (.2 + .8 * exp(-fogHy * .0055));
  float fogFactor = 1.0 - exp(-fogDist * fogDen);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
#endif`;

const $ = id => document.getElementById(id);
/* controls follow the device: phones/tablets get touch controls, computers get keyboard + mouse — even touchscreen laptops. */
const isTouch = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  || (matchMedia('(pointer:coarse)').matches && !matchMedia('(any-pointer:fine)').matches);
try { localStorage.removeItem('arc-controls'); } catch (e) {}   // clear the old title-screen override
const LOW = isTouch;                       // phones: fewer trees/grass, smaller textures, cheaper post
const SFX = LOW ? 'phone' : 'pc';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angWrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let seed = 90210;
const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const rr = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
function setLoad(s) { const el = document.querySelector('#menu .load'); if (el) el.textContent = s; }
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

/* ---------- noise ---------- */
function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; }

/* ================= the map =================
   Kestrel camp at the origin, gate facing +z (south). A big forested mountain looms right behind it (north).
   East: the Coldwater river in its gorge, the old-world town of Halvard past the broken span, and the Burn where the Arc's
   lander came down. West: the Thorn outpost, then Ashmere, the Thornkin stronghold. South-west: Lake Ilse. South: the fire
   lookout. North-west: the grey mountain and the sealed door of Greyhold. */
const VALLEY = 640;                         // the Chapter 1 valley (Kestrel and everything around it)
const WORLD = 2200;                         // walkable radius of the whole map
const HALF = 2400;                          // half-size of the terrain square
const IN_HALF = 800;                        // the fine heightmap covers the valley; the outlands use a coarser one
const CAMP_R = 42;
const GATE_HALF = 4.7 / CAMP_R;
const riverX = z => 318 + Math.sin(z * .0065) * 46 + Math.sin(z * .019 + 1) * 14;
const POI = {
  pod: { x: 172, z: 158 }, meadow: { x: 98, z: -44 }, village: { x: -196, z: -66 }, vault: { x: -186, z: -206 },
  debris: { x: 0, z: 88 }, halvard: { x: 480, z: 300 }, burn: { x: 400, z: -150 }, ashmere: { x: -420, z: -20 },
  lake: { x: -285, z: 290 }, lookout: { x: -120, z: 430 }, bridge: { x: riverX(236), z: 236 }, relay: { x: -300, z: -320 },
  // the outlands, past the valley rim
  varnhold: { x: 120, z: -1180 }, sunscar: { x: 1480, z: 260 }, elderhollow: { x: 160, z: 1360 },
  cinder: { x: 1120, z: -520 }, watchers: { x: -1340, z: 360 }, varr: { x: -700, z: 1150 }, mirror: { x: -1420, z: -380 },
};
const HOLDS = [
  { id: 'varnhold', name: 'VARNHOLD', sub: 'Hold of the Hollow Pines clan', ...POI.varnhold, R: 40 },
  { id: 'sunscar', name: 'SUNSCAR', sub: 'Hold of the Ridge Runners', ...POI.sunscar, R: 36 },
  { id: 'elderhollow', name: 'ELDERHOLLOW', sub: 'Hold of the Rootkin', ...POI.elderhollow, R: 44 },
];
const LAKES = [{ x: POI.lake.x, z: POI.lake.z, R: 74, L: 0 }, { x: POI.varr.x, z: POI.varr.z, R: 150, L: 0 }, { x: POI.mirror.x, z: POI.mirror.z, R: 105, L: 0 }];
const MEADOWS = [POI.meadow, { x: -72, z: 132 }, { x: 140, z: 58 }, { x: -112, z: 34 }, { x: 60, z: 176 }, { x: 200, z: -240 }, { x: -200, z: 180 }, { x: 560, z: 80 }, { x: 40, z: 360 }, { x: -380, z: 160 }];
const OUT_MEADOWS = [{ x: 860, z: 560 }, { x: 1200, z: 900 }, { x: -900, z: 700 }, { x: -1100, z: -900 }, { x: 600, z: -1000 }, { x: -400, z: 1700 }, { x: 1700, z: -900 }, { x: -1700, z: 100 }, { x: 500, z: 1600 }, { x: 1000, z: 1500 }];
const SCOUTS = [{ x: -150, z: 118 }, { x: 250, z: -300 }, { x: 96, z: 430 }, { x: -460, z: 220 }, { x: 560, z: -40 },
  { x: 900, z: 120 }, { x: -820, z: -360 }, { x: 420, z: 980 }, { x: -260, z: -980 }, { x: 1300, z: -300 }, { x: -1000, z: 1000 }, { x: 760, z: -1450 }, { x: -1600, z: -900 }];
const SHELTERS = [
  { x: 44, z: 150, kind: 'bus' }, { x: 128, z: 96, kind: 'hut' }, { x: -84, z: 92, kind: 'cave' },
  { x: -146, z: -18, kind: 'bus' }, { x: 118, z: -64, kind: 'cave' }, { x: 206, z: 128, kind: 'hut' },
  { x: -96, z: -96, kind: 'hut' }, { x: 214, z: -34, kind: 'cave' }, { x: -150, z: -150, kind: 'bus' },
  { x: -220, z: 230, kind: 'hut' }, { x: -30, z: 300, kind: 'bus' }, { x: 260, z: -200, kind: 'cave' },
  { x: -320, z: 60, kind: 'cave' }, { x: 170, z: 380, kind: 'hut' }, { x: -60, z: 470, kind: 'bus' }, { x: 560, z: 150, kind: 'cave' },
];
const RIV_HW = 11, RIV_Z0 = -HALF, RIV_STEP = 4, RIV_N = Math.round(HALF * 2 / RIV_STEP) + 1;
const RIVWL = new Float32Array(RIV_N);
const PATHS = [
  [[0, 40], [0, 96], [46, 136], [112, 150], [170, 156]],
  [[170, 156], [240, 214], [POI.bridge.x - 42, 236], [POI.bridge.x + 42, 236], [400, 262], [480, 300]],
  [[6, 44], [44, 58], [82, 12], [98, -40], [200, -96], [300, -128], [400, -150]],
  [[-6, 44], [-60, 42], [-118, -14], [-196, -62], [-300, -40], [-420, -20]],
  [[-118, -14], [-150, -128], [-184, -196]],
  [[0, 96], [-60, 160], [-150, 222], [-232, 268]],
  [[-60, 160], [-100, 300], [-120, 420]],
  // outland roads, each through a pass in the valley rim
  [[480, 300], [720, 330], [1000, 290], [1480, 260]],
  [[1000, 290], [1080, -100], [1120, -520]],
  [[-184, -196], [-150, -420], [-60, -700], [60, -950], [120, -1180]],
  [[-120, 420], [-90, 700], [40, 1000], [160, 1360]],
  [[-90, 700], [-420, 960], [-560, 1030]],
  [[-420, -20], [-700, 40], [-1000, 180], [-1340, 360]],
  [[-1000, 180], [-1250, -120], [-1300, -280]],
];
/* passes: wherever a road crosses the rim ring, the ridge is cut down */
const RIM_R = 690;
const PASSES = [];
for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
  const [ax, az] = p[i], [bx, bz] = p[i + 1], da = Math.hypot(ax, az), db = Math.hypot(bx, bz);
  if ((da - RIM_R) * (db - RIM_R) < 0) { const t = (RIM_R - da) / (db - da); PASSES.push(Math.atan2(lerp(az, bz, t), lerp(ax, bx, t))); }
}
PASSES.push(Math.atan2(-660, riverX(-660)), Math.atan2(660, riverX(660)));   // the river gorges
/* road shelters in the outlands: somewhere to get under a roof when the red fog rolls in (one every ~230m of road) */
for (const p of PATHS.slice(7)) {
  let next = 120, run = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    while (next < run + L) {
      const k = (next - run) / L, sd = SHELTERS.length % 2 ? 16 : -16, x = lerp(ax, bx, k) + nx * sd, z = lerp(az, bz, k) + nz * sd;
      if (Math.hypot(x, z) > RIM_R + 60 && Math.abs(x - riverX(z)) > 50) SHELTERS.push({ x, z, kind: ['hut', 'cave', 'bus'][SHELTERS.length % 3] });
      next += 230;
    }
    run += L;
  }
}
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

/* ---------- terrain: noise → carve water and craters → flatten building sites → cached heightmap ---------- */
function rawH(x, z) {
  let h = (fbm(x * .0062 + 3, z * .0062 + 7) - .5) * 38 + (fbm(x * .028, z * .028) - .5) * 5;
  const d = Math.hypot(x, z);
  // the valley rim: a ring of ridges, broken by passes where the roads and the river go through
  const ring = Math.exp(-(((d - RIM_R) / 70) ** 2));
  if (ring > .002) {
    const ang = Math.atan2(z, x); let cut = 1;
    for (const pa of PASSES) { const t = angWrap(ang - pa) * d / 55; cut *= 1 - Math.exp(-t * t); }
    h += ring * (55 + 70 * fbm(ang * 4 + 20, d * .01)) * (.12 + .88 * cut);
  }
  // the outlands: the same forest, broader hills and a few big mountains
  const o = smooth(620, 900, d);
  if (o > 0) {
    let oh = (fbm(x * .0032 + 11, z * .0032 - 4) - .5) * 90 + (fbm(x * .017 + 3, z * .017 + 8) - .5) * 10;
    const r = 1 - Math.abs(fbm(x * .0045 + 30, z * .0045) * 2 - 1); oh += smooth(.55, .9, fbm(x * .0021 - 9, z * .0021 + 5)) * 210 * r;
    h += o * oh;
  }
  // the world's edge: ridged ranges rather than a smooth bowl, so the walls of the world look like mountains from anywhere
  const gd = Math.hypot(x + 300, z + 320);
  h += 150 * Math.exp(-(gd * gd) / (2 * 95 * 95));                                   // the grey mountain (Greyhold)
  const mx = (x - 10) / 120, mz = (z + 178) / 62;
  h += 165 * Math.exp(-(mx * mx + mz * mz) / 2) * (.85 + fbm(x * .015 + 2, z * .015) * .3);   // the mountain behind the camp
  h += 40 * Math.exp(-(((x + 70) / 50) ** 2 + ((z + 130) / 40) ** 2) / 2);
  h += 60 * Math.exp(-(((x - 560) / 90) ** 2 + ((z + 330) / 80) ** 2) / 2);          // eastern highlands past the Burn
  h += 35 * Math.exp(-(((x + 150) / 70) ** 2 + ((z - 420) / 50) ** 2) / 2);          // the lookout ridge
  const pd = pathDist(x, z); if (pd < 10) h -= (1 - pd / 10) * .8;
  return h;
}
let LAKE_L = 0;
function lakeRw(L, x, z) { const a = Math.atan2(z - L.z, x - L.x); return L.R * (1 + (vnoise(Math.cos(a) * 2 + 5 + L.x * .01, Math.sin(a) * 2) - .5) * .4); }
function riverWL(z) { const f = clamp((z - RIV_Z0) / RIV_STEP, 0, RIV_N - 1.001), i = Math.floor(f); return lerp(RIVWL[i], RIVWL[i + 1], f - i); }
function carved(x, z) {
  let h = rawH(x, z);
  const dr = Math.abs(x - riverX(z));
  // inside the valley the gorge stops 150m out (as built); out past the rim it cuts a full valley through the hills
  const cap = 150 + 600 * smooth(560, 780, Math.hypot(x, z));
  if (dr < cap) { const wl = riverWL(z); const hc = dr < RIV_HW ? wl - .4 - 2.1 * (1 - (dr / RIV_HW) ** 2) : wl - .4 + (dr - RIV_HW) * .55; if (hc < h) h = dr < 150 ? hc : lerp(h, hc, 1 - smooth(cap * .8, cap, dr)); }
  for (const L of LAKES) {
    const ld = Math.hypot(x - L.x, z - L.z); if (ld > L.R * 3) continue;
    const Rw = lakeRw(L, x, z), hc = ld < Rw ? L.L - .5 - 5 * (1 - (ld / Rw) ** 2) : L.L - .5 + (ld - Rw) * .45; if (hc < h) h = hc;
  }
  // the world's edge: ridged ranges rather than a smooth bowl (added after the river so it doesn't cut a slot through them)
  const d = Math.hypot(x, z), e = Math.max(0, d - 2060);
  if (e > 0) { const rg = 1 - Math.abs(fbm(x * .0019 + 41, z * .0019 - 7) * 2 - 1), rg2 = 1 - Math.abs(fbm(x * .006 + 3, z * .006 + 9) * 2 - 1); h += smooth(0, 340, e) * (160 + 760 * rg * rg + 220 * rg2 * rg2) + e * .25; }
  const B = POI.burn, bd = Math.hypot(x - B.x, z - B.z);
  if (bd < 70) h += -9 * Math.exp(-((bd / 26) ** 2)) + 3 * Math.exp(-(((bd - 32) / 7) ** 2));
  return h;
}
function prepWater() {
  for (let k = 0; k < RIV_N; k++) { const z = RIV_Z0 + k * RIV_STEP, rx = riverX(z); let m = 1e9; for (let dx = -40; dx <= 40; dx += 8) m = Math.min(m, rawH(rx + dx, z)); RIVWL[k] = m - 1.4; }
  for (let pass = 0; pass < 4; pass++) { const c = RIVWL.slice(); for (let k = 2; k < RIV_N - 2; k++) RIVWL[k] = (c[k - 2] + c[k - 1] + c[k] + c[k + 1] + c[k + 2]) / 5; }
  for (let k = 1; k < RIV_N; k++) RIVWL[k] = Math.min(RIVWL[k], RIVWL[k - 1]);        // flows downhill, north to south
  for (const L of LAKES) { let m = 1e9; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; m = Math.min(m, rawH(L.x + Math.cos(a) * L.R * 1.24, L.z + Math.sin(a) * L.R * 1.24)); } L.L = m - 1.6; }
  LAKE_L = LAKES[0].L;
}
const FLATS = [];
/* a level site for a building: its height is the average of the centre and the surrounding ground, and the blend out to
   the natural terrain widens with how far apart they are, so a site never leaves a cliff around itself */
function addFlat(x, z, r0, r1, h) {
  const c = carved(x, z); let sum = 0, dev = 0; const ring = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const v = carved(x + Math.cos(a) * r1, z + Math.sin(a) * r1); ring.push(v); sum += v; }
  const H = h ?? (c * .4 + sum / 16 * .6);
  for (const v of ring) dev = Math.max(dev, Math.abs(v - H));
  FLATS.push({ x, z, r0, r1: Math.max(r1, r0 + dev * 2.6), h: H });
}
function fullH(x, z) {
  let h = carved(x, z);
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r1) h = f.h + (h - f.h) * smooth(f.r0, f.r1, d); }
  return h;
}
const HM_STEP = LOW ? 2.5 : 2, HM_N = Math.round(IN_HALF * 2 / HM_STEP) + 1;        // fine: the valley
const HO_STEP = LOW ? 5 : 4, HO_N = Math.round(HALF * 2 / HO_STEP) + 1;              // coarse: the whole map
let HM = null, HO = null;
function hmSample(A, N, step, half, x, z) {
  let fx = (x + half) / step, fz = (z + half) / step;
  fx = clamp(fx, 0, N - 1.001); fz = clamp(fz, 0, N - 1.001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, o = j * N + i;
  return (A[o] * (1 - u) + A[o + 1] * u) * (1 - v) + (A[o + N] * (1 - u) + A[o + N + 1] * u) * v;
}
function heightAt(x, z) {
  if (!HM) return fullH(x, z);
  if (x > -IN_HALF && x < IN_HALF && z > -IN_HALF && z < IN_HALF) return hmSample(HM, HM_N, HM_STEP, IN_HALF, x, z);
  return hmSample(HO, HO_N, HO_STEP, HALF, x, z);
}
async function buildHeightmap() {
  HM = null; const A = new Float32Array(HM_N * HM_N), B = new Float32Array(HO_N * HO_N), tot = HM_N + HO_N;
  for (let j = 0; j < HM_N; j++) {
    const z = -IN_HALF + j * HM_STEP;
    for (let i = 0; i < HM_N; i++) A[j * HM_N + i] = fullH(-IN_HALF + i * HM_STEP, z);
    if (j % 60 === 0) { setLoad(`SHAPING THE VALLEY ${Math.round(j / tot * 100)}%`); await nextFrame(); }
  }
  for (let j = 0; j < HO_N; j++) {
    const z = -HALF + j * HO_STEP;
    for (let i = 0; i < HO_N; i++) { const x = -HALF + i * HO_STEP; B[j * HO_N + i] = Math.abs(x) <= IN_HALF && Math.abs(z) <= IN_HALF ? hmSample(A, HM_N, HM_STEP, IN_HALF, x, z) : fullH(x, z); }
    if (j % 60 === 0) { setLoad(`SHAPING THE OUTLANDS ${Math.round((HM_N + j) / tot * 100)}%`); await nextFrame(); }
  }
  HM = A; HO = B;
}
function waterAt(x, z) {                   // water surface at (x,z), or -1e9 when dry
  let w = -1e9;
  if (Math.abs(x - riverX(z)) < RIV_HW + 3) w = riverWL(z) - .4;
  for (const L of LAKES) if (Math.hypot(x - L.x, z - L.z) < L.R * 1.35) w = Math.max(w, L.L - .5);
  return w;
}
function prepFlats() {
  addFlat(0, 0, 54, 88);
  addFlat(POI.village.x, POI.village.z, 22, 40);
  addFlat(POI.pod.x, POI.pod.z, 8, 22);
  addFlat(POI.vault.x, POI.vault.z + 12, 10, 22);
  addFlat(POI.halvard.x, POI.halvard.z, 70, 110);
  addFlat(POI.ashmere.x, POI.ashmere.z, 52, 80);
  addFlat(POI.lookout.x, POI.lookout.z, 8, 20);
  for (const s of SHELTERS) addFlat(s.x, s.z, 6, 14);
  for (const s of SCOUTS) addFlat(s.x, s.z, 8, 18);
  for (const H of HOLDS) addFlat(H.x, H.z, H.R + 8, H.R + 40);
  addFlat(POI.cinder.x, POI.cinder.z, 70, 110);
  addFlat(POI.watchers.x, POI.watchers.z, 18, 40);
}

/* ---------- renderer / scene / post ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.35 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9b8b2, 30, 260);
const camera = new THREE.PerspectiveCamera(64, 1, .06, 9000);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* ELYRA's finishing pass, ported: bloom on what's really bright, then one grade pass (S-curve, split toning, saturation,
   vignette, a little chromatic fringe toward the corners, moving film grain). `hurt` drains colour when you're hit. */
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, t: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, contrast: { value: 1.04 }, sat: { value: 1.06 }, vig: { value: .36 },
    grain: { value: .03 }, fringe: { value: .0018 }, shadow: { value: new THREE.Vector3(0, .012, .03) }, high: { value: new THREE.Vector3(.02, .008, -.012) }, lift: { value: .012 }, gain: { value: 1.02 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float t,contrast,sat,vig,grain,fringe,lift,gain,hurt;uniform vec2 res;uniform vec3 shadow,high;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec2 d=vUv-.5;float r2=dot(d,d);vec2 o=d*fringe*r2*4.0;
      vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
      float l=dot(c,vec3(.2126,.7152,.0722));
      c+=shadow*(1.0-smoothstep(.0,.45,l))+high*smoothstep(.45,1.0,l);
      c=mix(vec3(l),c,sat*(1.0-hurt*.6));
      c=clamp((c-.5)*contrast+.5,0.0,1.0);c=c*c*(3.0-2.0*c)*.25+c*.75;
      c=c*gain+lift;
      c*=1.0-vig*smoothstep(.12,.72,r2*(1.0+.35*(res.x/res.y-1.0)));
      c+=(h(vUv*res+fract(t*7.13)*91.0)-.5)*grain;
      gl_FragColor=vec4(c,1.0);}`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), LOW ? .4 : .55, .5, .88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GRADE_SHADER);
composer.addPass(grade);

let BASE_FOV = 64;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  grade.uniforms.res.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  camera.aspect = w / h;
  BASE_FOV = w / h > 1.8 ? 62 : w / h > 1.3 ? 66 : 74;
  camera.fov = BASE_FOV; camera.updateProjectionMatrix();
  $('rot').hidden = !(isTouch && h > w);
}
addEventListener('resize', resize);
resize();

/* ---------- sky, clouds, light ---------- */
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, rust: { value: 0 }, fogC: { value: new THREE.Color() } };
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol,fogC; uniform float rust; varying vec3 vP;
    void main(){ float h = max(vP.y,0.); vec3 c = mix(hor, top, pow(h,.45)); c = mix(fogC, c, smoothstep(-.02, .16, vP.y));
      float s = max(dot(vP, sunDir), 0.); c += sunCol*(pow(s,900.)*6. + pow(s,14.)*.3 + pow(s,3.)*.06) * (.35 + .65*smoothstep(-.05,.1,vP.y));
      c = mix(c, vec3(.42,.14,.07), rust);
      gl_FragColor = vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
sky.renderOrder = -2; sky.frustumCulled = false;
scene.add(sky);
const starGeo = new THREE.BufferGeometry();
{ const a = []; for (let i = 0; i < 1200; i++) { const t = rnd() * Math.PI * 2, y = rr(.06, 1); const r = Math.sqrt(1 - y * y); a.push(Math.cos(t) * r, y, Math.sin(t) * r); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
stars.renderOrder = -1; stars.frustumCulled = false; scene.add(stars);

function cloudTex() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = x / N * Math.PI * 2, b = y / N * Math.PI * 2;        // tileable: noise sampled on a torus
    let v = 0, amp = 1, n = 0;
    for (let o = 0; o < 5; o++) { const f = 1.2 * 2 ** o; v += amp * vnoise(Math.cos(a) * f + Math.cos(b) * f * .5 + 30, Math.sin(a) * f + Math.sin(b) * f + 10); n += amp; amp *= .5; }
    v /= n; const al = smooth(.47, .72, v), i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = al * 230;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t;
}
/* two cloud decks at different heights drifting at different speeds — the parallax between them reads as real altitude.
   They fade out toward their edges and sink into the horizon haze, so there's no visible plane edge. */
const CLOUD_TEX = cloudTex();
const CLOUDS = [[1500, 30000, 8, .0016, .0007, .8], [2700, 40000, 5, .0007, .0011, .5]].map(([y, size, rep, sx, sz, op]) => {
  const u = { map: { value: CLOUD_TEX }, off: { value: new THREE.Vector2(rnd(), rnd()) }, rep: { value: rep }, col: { value: new THREE.Color(1, 1, 1) }, op: { value: op }, haze: { value: new THREE.Color() } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D map; uniform vec2 off; uniform float rep, op; uniform vec3 col, haze; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 t = texture2D(map, vUv * rep + off); float r = length(vUv - .5) * 2.;
        vec3 d = normalize(vW - cameraPosition); float low = smoothstep(.02, .22, abs(d.y));
        float a = t.a * op * (1. - smoothstep(.55, 1., r));
        gl_FragColor = vec4(mix(haze, col, low), a);
        #include <colorspace_fragment>
      }`,
  }));
  m.rotation.x = Math.PI / 2; m.renderOrder = -1; m.frustumCulled = false; scene.add(m);
  return { m, u, y, sx, sz, op };
});

const hemi = new THREE.HemisphereLight(0xcfdce6, 0x5a5444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 420 });
sun.shadow.bias = -.0005; sun.shadow.normalBias = .5;
scene.add(sun, sun.target);

/* environment light for the PBR models (guns, survivors, hull): rebuilt from the sky as the day turns */
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), skyMat); envScene.add(envSky);
const envGround = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0x2c3324 })); envGround.rotation.x = -Math.PI / 2; envGround.position.y = -1.2; envScene.add(envGround);
let envRT = null, envTod = -1, envRust = -1;
function refreshEnv(tod, rk) {
  if (Math.abs(tod - envTod) < .012 && Math.abs(rk - envRust) < .1 && envRT) return;
  envTod = tod; envRust = rk; const old = envRT;
  envRT = pmrem.fromScene(envScene, 0, .1, 100); scene.environment = envRT.texture;
  if (old) old.dispose();
}

/* time-of-day palette: tod 0 = midnight, .25 sunrise, .5 noon, .75 sunset — overcast Pacific-northwest daylight */
const TOD = [
  [0.00, '#04070c', '#0e1620', '#0b1118', '#7b93b8', .26, .2, 240],
  [0.20, '#141c30', '#4a4250', '#3a3a42', '#ffb07a', .3, .3, 420],
  [0.25, '#3a4766', '#d29a74', '#9a8a7e', '#ffb27a', 1.2, .6, 1300],
  [0.32, '#6489ac', '#c4cec9', '#a9b6b0', '#fff0d6', 2.5, .95, 2200],
  [0.50, '#5884b2', '#ccd6d2', '#b4c3c4', '#fff6e8', 2.9, 1.05, 2700],
  [0.68, '#5c82a8', '#d6cebd', '#b4b2a4', '#ffe2b8', 2.5, .95, 2200],
  [0.76, '#30335a', '#e08954', '#866458', '#ff9558', 1.1, .55, 1250],
  [0.82, '#141a2e', '#3a2c3c', '#2a2630', '#a8a0c0', .32, .3, 420],
  [0.90, '#04070c', '#0e1620', '#0b1118', '#7b93b8', .26, .2, 240],
  [1.00, '#04070c', '#0e1620', '#0b1118', '#7b93b8', .26, .2, 240],
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function todSample(t) {
  t = ((t % 1) + 1) % 1;
  let i = 0; while (i < TOD.length - 2 && TOD[i + 1][0] <= t) i++;
  const A = TOD[i], B = TOD[i + 1], k = smooth(0, 1, (t - A[0]) / (B[0] - A[0]));
  const mixC = (j) => _ca.set(A[j]).lerp(_cb.set(B[j]), k).clone();
  return { top: mixC(1), hor: mixC(2), fog: mixC(3), sun: mixC(4), sunI: lerp(A[5], B[5], k), hemiI: lerp(A[6], B[6], k), far: lerp(A[7], B[7], k) };
}

/* ---------- textures ---------- */
const texLoader = new THREE.TextureLoader();
function loadTex(name, srgb = true) {
  const t = texLoader.load(`assets/tex/${name}-${SFX}.jpg`);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = LOW ? 2 : 8;
  return t;
}
const TX = {
  detailSoil: loadTex('detail-soil'), soilN: loadTex('soil-n', false), detailRock: loadTex('detail-rock'), rockN: loadTex('rock-n', false),
  metal: loadTex('metal015'), metalN: loadTex('metal015-n', false), metal2: loadTex('metal039'), metal2N: loadTex('metal039-n', false), rock: loadTex('rock'),
};
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
const texPanel = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#9a9c9c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 140 + rr(-22, 22) | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    g.fillStyle = '#0000002a'; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.beginPath(); g.arc(x * 128 + a, y * 128 + b, 3, 0, 7); g.fill(); }
  }
  g.fillStyle = '#c96a2a'; g.fillRect(0, 256, w, 12);
  g.fillStyle = '#00000018'; for (let i = 0; i < 40; i++) { const x = rnd() * w; g.fillRect(x, rnd() * h, rr(1, 4), rr(30, 160)); }
  grime(g, w, h, 30, 'rgba(70,45,25,.35)');
}, [2, 2]);
const texCorr = ctex(128, 128, (g, w, h) => {
  for (let x = 0; x < w; x++) { const v = 150 + Math.sin(x / w * Math.PI * 16) * 38 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
  grime(g, w, h, 10, 'rgba(120,60,25,.45)');
  g.fillStyle = '#0000001c'; g.fillRect(0, h - 18, w, 18);
});
const texCorrN = ctex(128, 8, (g, w, h) => {
  for (let x = 0; x < w; x++) { const s = Math.cos(x / w * Math.PI * 16); const r = 128 + s * 90 | 0; g.fillStyle = `rgb(${r},128,255)`; g.fillRect(x, 0, 1, h); }
});
texCorrN.colorSpace = THREE.NoColorSpace;
const texWood = ctex(64, 128, (g, w, h) => {
  g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(40,25,15,${rr(.15, .35)})`; g.lineWidth = rr(.5, 2); g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + rr(-6, 6), h * .3, x + rr(-6, 6), h * .6, x, h); g.stroke(); }
});
const texConcrete = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#8c8984'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${rr(0, .12)})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  grime(g, w, h, 16, 'rgba(60,50,40,.35)'); grime(g, w, h, 8, 'rgba(70,90,50,.25)');
  g.strokeStyle = '#0003'; for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-20, 20); y += rr(5, 25); g.lineTo(x, y); } g.stroke(); }
});
const texWaterN = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
  const H = (x, y) => { const a = x / N * Math.PI * 2, b = y / N * Math.PI * 2; return vnoise(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + Math.cos(b) * 4) + vnoise(Math.cos(b) * 6, Math.sin(b) * 6 + Math.sin(a) * 2) * .5; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1); const i = (y * N + x) * 4; img.data[i] = 128 + dx * 300; img.data[i + 1] = 128 + dy * 300; img.data[i + 2] = 255; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
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
const mkey = (p, color, o) => p + color + '|' + Object.entries(o).map(([a, b]) => a + ':' + (b && b.uuid ? b.uuid : b)).join(',');
function M(color, o = {}) { const k = mkey('L', color, o); if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...o })); return MAT.get(k); }
function S(color, o = {}) { const k = mkey('S', color, o); if (!MAT.has(k)) MAT.set(k, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: .25, ...o })); return MAT.get(k); }
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function tm(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
/* merge simple parts into one vertex-coloured geometry. color2 = gradient to the top of that part; jitter roughens the shape */
function merge(parts, jitter = 0) {
  const list = parts.map(p => { let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); if (p.m) g.applyMatrix4(p.m); return { g, c: new THREE.Color(p.color), c2: p.color2 != null ? new THREE.Color(p.color2) : null }; });
  const n = list.reduce((s, p) => s + p.g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), cc = new THREE.Color();
  let o = 0;
  for (const { g, c, c2 } of list) {
    const cnt = g.attributes.position.count, a = g.attributes.position.array;
    let y0 = 1e9, y1 = -1e9; if (c2) for (let i = 0; i < cnt; i++) { y0 = Math.min(y0, a[i * 3 + 1]); y1 = Math.max(y1, a[i * 3 + 1]); }
    for (let i = 0; i < cnt; i++) {
      let x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      if (jitter) { const qx = Math.round(x * 40), qy = Math.round(y * 40), qz = Math.round(z * 40); x += (hash(qx, qz + qy * 7) - .5) * jitter; z += (hash(qz, qx + qy * 3) - .5) * jitter; y += (hash(qy, qx + qz) - .5) * jitter * .5; }
      pos[(o + i) * 3] = x; pos[(o + i) * 3 + 1] = y; pos[(o + i) * 3 + 2] = z;
      cc.copy(c); if (c2) cc.lerp(c2, (y - y0) / Math.max(1e-4, y1 - y0));
      col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b;
    }
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
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
function addColLine(x0, z0, x1, z1, r) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (r * 1.4))); for (let i = 0; i <= n; i++) addCol(lerp(x0, x1, i / n), lerp(z0, z1, i / n), r); }
/* walkable floors above the terrain (bridge deck, dock, lookout platform): oriented rectangles */
const FLOORS = [];
function addFloor(cx, cz, yaw, hw, hd, y) { FLOORS.push({ cx, cz, c: Math.cos(yaw), s: Math.sin(yaw), hw, hd, y }); }
function floorAt(x, z, footY) {
  let best = -1e9;
  for (const f of FLOORS) {
    const dx = x - f.cx, dz = z - f.cz, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c;
    const fy = f.y + (f.slope || 0) * lx;
    if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd && footY > fy - 1.3 && fy > best) best = fy;
  }
  return best;
}

/* ---------- region names: a title card the first time you walk into each place ---------- */
const REGIONS = [
  { id: 'kestrel', name: 'KESTREL', sub: 'What the Arc left us', x: 0, z: 0, r: 60 },
  { id: 'meadow', name: 'THE EAST MEADOW', sub: 'Deer country', x: POI.meadow.x, z: POI.meadow.z, r: 40 },
  { id: 'pod', name: 'THE POD', sub: 'An escape capsule, still smoking', x: POI.pod.x, z: POI.pod.z, r: 26 },
  { id: 'outpost', name: 'THORN OUTPOST', sub: 'The painted ones keep watch here', x: POI.village.x, z: POI.village.z, r: 42, hostile: true },
  { id: 'river', name: 'THE COLDWATER', sub: 'River gorge', river: true },
  { id: 'bridge', name: 'THE BROKEN SPAN', sub: 'An old-world highway', x: POI.bridge.x, z: POI.bridge.z, r: 45 },
  { id: 'halvard', name: 'HALVARD', sub: 'A town from before the fire', x: POI.halvard.x, z: POI.halvard.z, r: 95 },
  { id: 'burn', name: 'THE BURN', sub: 'Where the lander Tern came down', x: POI.burn.x, z: POI.burn.z, r: 70 },
  { id: 'ashmere', name: 'ASHMERE', sub: 'Thornkin stronghold', x: POI.ashmere.x, z: POI.ashmere.z, r: 80, hostile: true },
  { id: 'lake', name: 'LAKE ILSE', sub: 'Still water', x: POI.lake.x, z: POI.lake.z, r: 100 },
  { id: 'lookout', name: 'SOUTH LOOKOUT', sub: 'A fire tower on the ridge', x: POI.lookout.x, z: POI.lookout.z, r: 35 },
  { id: 'grey', name: 'THE GREY DOOR', sub: 'Sealed. Humming.', x: POI.vault.x, z: POI.vault.z, r: 40 },
  // past the rim
  { id: 'outlands', name: 'THE OUTLANDS', sub: 'Nobody from the Arc has been this far', area: (x, z) => Math.hypot(x, z) > RIM_R + 50 },
  ...HOLDS.map(H => ({ id: H.id, name: H.name, sub: H.sub, x: H.x, z: H.z, r: H.R + 70, hostile: true })),
  { id: 'cinder', name: 'CINDER CITY', sub: 'Towers from before the fire', x: POI.cinder.x, z: POI.cinder.z, r: 120 },
  { id: 'watchers', name: 'THE WATCHERS', sub: 'Thirteen stones in a ring', x: POI.watchers.x, z: POI.watchers.z, r: 50 },
  { id: 'varr', name: 'LAKE VARR', sub: 'Deep and cold', x: POI.varr.x, z: POI.varr.z, r: 200 },
  { id: 'mirror', name: 'MIRRORWATER', sub: 'Not a ripple on it', x: POI.mirror.x, z: POI.mirror.z, r: 150 },
];

/* ---------- models (from the ELYRA kit) ---------- */
const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const MODELS = {};
async function loadModels(names) {
  let done = 0;
  await Promise.all(names.map(n => gltf.loadAsync(`assets/models/${n}.glb`).then(g => {
    MODELS[n] = g.scene; done++; setLoad(`UNPACKING THE ARMORY ${done}/${names.length}`);
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; for (const m of [].concat(o.material)) if (m && m.metalness > .6) m.metalness = .6; } });
  }).catch(e => console.warn('model', n, e && e.message))));
}
/* a copy of a model, scaled so its height (or length along an axis) is `size`, standing on y=0 and centred */
function modelCopy(name, size, axis = 'y', tint) {
  const src = MODELS[name]; if (!src) return null;
  const o = src.clone(true);
  if (tint) o.traverse(m => { if (m.isMesh) { m.material = [].concat(m.material).map(x => { const c = x.clone(); c.color = (c.color || new THREE.Color(1, 1, 1)).clone().multiply(new THREE.Color(tint)); return c; }); if (m.material.length === 1) m.material = m.material[0]; } });
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
  const k = size / sz[axis];
  const wrap = new THREE.Group(); o.scale.setScalar(k); o.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k); wrap.add(o);
  return wrap;
}
let H0 = 0;

/* ================= terrain: chunked, coloured per vertex, detail-textured (ELYRA soil + rock) ================= */
const SCORCH = [{ x: 0, z: 92, r: 26 }, { x: -18, z: 74, r: 12 }, { x: 22, z: 112, r: 14 }, { x: POI.pod.x, z: POI.pod.z, r: 14 }, { x: POI.burn.x, z: POI.burn.z, r: 58 }];
const C_ = s => new THREE.Color(s);
const TC = { grass: C_('#56743a'), grass2: C_('#425f2e'), forest: C_('#33452a'), dirt: C_('#6e5c45'), rock: C_('#6f6c66'), snow: C_('#e2e6e8'), mud: C_('#4a3f33'),
  sand: C_('#8a7d64'), ash: C_('#2c2723'), street: C_('#5a5854') };
function terrainColor(x, z, h, sl, out) {
  out.copy(TC.grass).lerp(TC.grass2, fbm(x * .05, z * .05)).lerp(TC.forest, smooth(.45, .7, fbm(x * .012 + 40, z * .012)) * .8);
  out.lerp(TC.rock, smooth(.7, 1.3, sl));
  // the snowline sits low on the valley's own mountain but climbs out in the outlands, so the big ranges show rock and forest below their caps
  const snowL = lerp(122, 620, smooth(800, 1700, Math.hypot(x, z)));
  out.lerp(TC.snow, smooth(snowL, snowL + 28 + snowL * .08, h + fbm(x * .05, z * .05) * (14 + snowL * .1)) * (1 - smooth(1.2, 1.8, sl) * (snowL > 200 ? .8 : .5)));
  const w = waterAt(x, z); if (w > -1e8) out.lerp(TC.sand, (1 - smooth(.2, 2.2, h - w)) * .85);
  const pd = pathDist(x, z); out.lerp(TC.dirt, (1 - smooth(1.8, 4.2, pd)) * .9);
  const cd = Math.hypot(x, z); out.lerp(TC.mud, (1 - smooth(30, 46, cd)) * .75);
  for (const p of [POI.village, POI.ashmere]) { const vd = Math.hypot(x - p.x, z - p.z); out.lerp(TC.dirt, (1 - smooth(14, 30, vd)) * .7); }
  const hd = Math.hypot(x - POI.halvard.x, z - POI.halvard.z); if (hd < 90) { const gx = Math.abs(((x - POI.halvard.x) % 26 + 26) % 26 - 13), gz = Math.abs(((z - POI.halvard.z) % 26 + 26) % 26 - 13); if (Math.min(gx, gz) > 9.5 && hd < 75) out.lerp(TC.street, .8); }
  for (const s of SCORCH) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r) out.lerp(TC.ash, (1 - d / s.r) * .85); }
  out.multiplyScalar(.92 + hash(x * .7, z * .7) * .16);
  return out;
}
const slopeAt = (x, z) => { const h = heightAt(x, z); return Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5; };
/* streamed: only the chunks near you exist; new ones are built a few rows per frame so walking never hitches */
const CH = 160, NCH = Math.ceil(HALF * 2 / CH), TSEG = LOW ? 40 : 64;
let terrMat = null, terrIdx = null, chunkJob = null;
const CHUNKS = new Map();
const T_LOAD = 470, T_DROP = 700;
const chunkRectD = (ci, cj, px, pz) => { const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH; return Math.hypot(Math.max(x0 - px, 0, px - x0 - CH), Math.max(z0 - pz, 0, pz - z0 - CH)); };
function chunkExists(ci, cj) { const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH; return Math.hypot(x0 + CH / 2, z0 + CH / 2) <= HALF + 120; }
function startChunk(ci, cj) {
  const n = (TSEG + 1) * (TSEG + 1);
  return { ci, cj, row: 0, x0: -HALF + ci * CH, z0: -HALF + cj * CH, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Float32Array(n * 3), uv: new Float32Array(n * 2) };
}
const _tc = new THREE.Color();
function stepChunk(J, ms) {
  const t0 = performance.now(), { pos, nor, col, uv } = J;
  while (J.row <= TSEG) {
    const j = J.row;
    for (let i = 0; i <= TSEG; i++) {
      const k = j * (TSEG + 1) + i, x = J.x0 + i * CH / TSEG, z = J.z0 + j * CH / TSEG, h = heightAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const hx = heightAt(x + 1, z) - heightAt(x - 1, z), hz = heightAt(x, z + 1) - heightAt(x, z - 1);
      const l = Math.hypot(hx, 2, hz); nor[k * 3] = -hx / l; nor[k * 3 + 1] = 2 / l; nor[k * 3 + 2] = -hz / l;
      terrainColor(x, z, h, Math.hypot(hx, hz) / 2, _tc); col[k * 3] = _tc.r; col[k * 3 + 1] = _tc.g; col[k * 3 + 2] = _tc.b;
      uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    }
    J.row++;
    if (ms && performance.now() - t0 > ms) return false;
  }
  if (!terrIdx) { const idx = []; for (let j = 0; j < TSEG; j++) for (let i = 0; i < TSEG; i++) { const a = j * (TSEG + 1) + i, b = a + 1, d = a + TSEG + 1, e = d + 1; idx.push(a, d, b, b, d, e); } terrIdx = new THREE.Uint32BufferAttribute(idx, 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(terrIdx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, terrMat); m.receiveShadow = true; world.add(m);
  CHUNKS.set(J.ci * 1000 + J.cj, m);
  return true;
}
function nearestMissingChunk(px, pz) {
  let best = null, bd = T_LOAD;
  const c0 = Math.floor((px + HALF) / CH), c1 = Math.floor((pz + HALF) / CH), rad = Math.ceil(T_LOAD / CH) + 1;
  for (let cj = c1 - rad; cj <= c1 + rad; cj++) for (let ci = c0 - rad; ci <= c0 + rad; ci++) {
    if (ci < 0 || cj < 0 || ci >= NCH || cj >= NCH || CHUNKS.has(ci * 1000 + cj) || !chunkExists(ci, cj)) continue;
    const d = chunkRectD(ci, cj, px, pz); if (d < bd) { bd = d; best = [ci, cj]; }
  }
  return best;
}
function updTerrain(px, pz, ms = 3.5) {
  for (const [k, m] of CHUNKS) if (chunkRectD(Math.floor(k / 1000), k % 1000, px, pz) > T_DROP) { world.remove(m); m.geometry.dispose(); CHUNKS.delete(k); }
  if (chunkJob && chunkRectD(chunkJob.ci, chunkJob.cj, px, pz) > T_LOAD + 60) chunkJob = null;
  // after a teleport (respawn at camp) the ground under you is built immediately, the rest streams in
  for (let k = 0; k < 4; k++) { const n = nearestMissingChunk(px, pz); if (!n || chunkRectD(n[0], n[1], px, pz) > 140) break; if (chunkJob && chunkJob.ci === n[0] && chunkJob.cj === n[1]) chunkJob = null; stepChunk(startChunk(n[0], n[1]), 0); }
  if (!chunkJob) { const n = nearestMissingChunk(px, pz); if (n) chunkJob = startChunk(n[0], n[1]); }
  if (chunkJob && stepChunk(chunkJob, ms)) chunkJob = null;
}
async function buildTerrain(px = 0, pz = 0) {
  terrMat ||= new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.detailSoil, normalMap: TX.soilN, normalScale: new THREE.Vector2(.6, .6) });
  let done = 0, n;
  while ((n = nearestMissingChunk(px, pz))) {
    stepChunk(startChunk(n[0], n[1]), 0);
    if (++done % 4 === 0) { setLoad(`LAYING THE GROUND ${done}`); await nextFrame(); }
  }
}

/* ================= water: the Coldwater and Lake Ilse ================= */
let waterMat;
function buildWater() {
  waterMat = new THREE.MeshStandardMaterial({ color: 0x1f3a3a, roughness: .06, metalness: .1, transparent: true, opacity: .84, normalMap: texWaterN, normalScale: new THREE.Vector2(.35, .35), depthWrite: false });
  texWaterN.repeat.set(1 / 9, 1 / 9);
  const pos = [], uv = [], idx = [];
  let k = 0;
  for (let z = -HALF; z <= HALF; z += 4) {
    const rx = riverX(z), y = riverWL(z) - .4, w = RIV_HW + 4;
    pos.push(rx - w, y, z, rx + w, y, z); uv.push((rx - w), z, (rx + w), z);
    if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    k++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const river = new THREE.Mesh(g, waterMat); river.renderOrder = 1; world.add(river);
  for (const L of LAKES) {
    const lg = new THREE.CircleGeometry(L.R * 1.33, 64); lg.rotateX(-Math.PI / 2);
    const luv = lg.attributes.uv, lp = lg.attributes.position; for (let i = 0; i < luv.count; i++) luv.setXY(i, lp.getX(i) + L.x, lp.getZ(i) + L.z);
    const lake = new THREE.Mesh(lg, waterMat); lake.position.set(L.x, L.L - .5, L.z); lake.renderOrder = 1; world.add(lake);
  }
}

/* ================= forest: firs, alders, snags, rocks, cliffs — instanced in map tiles so the camera culls them ================= */
const world = new THREE.Group(); scene.add(world);
const SCRAPS = [], CRATES = [], DECOR_ANIM = [];
const TREEMAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
let fireLight, campLight, gateGroup, gateDoors = [], wallGroup, towers = [], beaconSmoke = [], vaultLamp, signMat, relayLamp;
function firGeo() {
  // lowest branches start ~3m up (after scaling) so you never stand inside the skirt
  const parts = [{ geo: new THREE.CylinderGeometry(.13, .3, 4.4, 6), m: tm(0, 2.2, 0), color: 0x4a3626, color2: 0x5e4634 }];
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), r = lerp(2.3, .45, t), y = lerp(3.7, 9.8, t), hgt = lerp(2.3, 1.6, t);
    parts.push({ geo: new THREE.ConeGeometry(r, hgt, 8, 1, true), m: tm(0, y, 0, 0, i * .7), color: 0x3f644a, color2: i % 2 ? 0x76a274 : 0x6a9868 });
  }
  parts.push({ geo: new THREE.ConeGeometry(.3, 1.2, 6), m: tm(0, 10.8, 0), color: 0x6a9868, color2: 0x82b07c });
  return merge(parts, .28);
}
function alderGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(.12, .22, 5, 6), m: tm(0, 2.5, 0), color: 0x8c867a }];
  for (let i = 0; i < 5; i++) parts.push({ geo: new THREE.IcosahedronGeometry(rr(1.2, 1.7), 0), m: tm(rr(-1, 1), rr(5, 6.6), rr(-1, 1)), color: 0x4a6a32, color2: 0x7a9a48 });
  return merge(parts, .35);
}
function snagGeo() {
  return merge([
    { geo: new THREE.CylinderGeometry(.12, .3, 7, 5), m: tm(0, 3.5, 0), color: 0x5d564c, color2: 0x8a8174 },
    { geo: new THREE.CylinderGeometry(.04, .08, 2.2, 4), m: tm(.5, 4.5, 0, 0, 0, -.9), color: 0x6d655a },
    { geo: new THREE.CylinderGeometry(.04, .08, 1.6, 4), m: tm(-.4, 5.6, 0, 0, 0, .8), color: 0x6d655a },
  ], .05);
}
function treeOK(x, z) {
  if (Math.hypot(x, z) < 62) return false;
  if (pathDist(x, z) < 5.5) return false;
  if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30) || OUT_MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 45)) return false;
  if (HOLDS.some(H => Math.hypot(x - H.x, z - H.z) < H.R + 14)) return false;
  for (const p of [[POI.cinder, 110], [POI.watchers, 30]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  for (const p of [[POI.village, 34], [POI.pod, 18], [POI.halvard, 96], [POI.ashmere, 62], [POI.burn, 64], [POI.lookout, 14]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  if (Math.hypot(x - POI.vault.x, z - POI.vault.z - 8) < 24) return false;
  if (SHELTERS.some(s => Math.hypot(x - s.x, z - s.z) < 12) || SCOUTS.some(s => Math.hypot(x - s.x, z - s.z) < 16)) return false;
  if (Math.abs(x) < 46 && z > 50 && z < 130 && rnd() < .8) return false;
  if (Math.abs(x - POI.bridge.x) < 60 && Math.abs(z - POI.bridge.z) < 10) return false;
  const h = heightAt(x, z); if (h > 138 || waterAt(x, z) > h - .6) return false;
  if (slopeAt(x, z) > 1.5) return false;
  return true;
}
async function buildForest() {
  const BT = 200, NB = Math.ceil(HALF * 2 / BT);
  const kinds = [{ geo: firGeo(), n: LOW ? 7800 : 14500, list: {} }, { geo: alderGeo(), n: LOW ? 900 : 1800, list: {} }, { geo: snagGeo(), n: 260, list: {} }];
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (const K of kinds) {
    let n = 0, guard = 0;
    while (n < K.n && guard++ < K.n * 25) {
      const x = rr(-VALLEY - 120, VALLEY + 120), z = rr(-VALLEY - 120, VALLEY + 120);
      if (Math.hypot(x, z) > VALLEY + 140) continue;
      const dens = fbm(x * .018 + 5, z * .018 + 11);
      if (K === kinds[1] ? (dens > .55 || rnd() > .5) : rnd() > smooth(.3, .6, dens) + .14) continue;
      if (K === kinds[1] && waterAt(x, z) < -1e8 && Math.abs(x - riverX(z)) > 60 && LAKES.every(L => Math.hypot(x - L.x, z - L.z) > L.R + 56) && rnd() < .7) continue;
      if (!treeOK(x, z)) continue;
      const s = K === kinds[0] ? rr(.85, 1.3) : rr(.8, 1.2), sy = K === kinds[0] ? rr(1.2, 2.1) : rr(.9, 1.3);
      dummy.position.set(x, heightAt(x, z) - .25, z); dummy.rotation.set(rr(-.04, .04), rnd() * 6, rr(-.04, .04)); dummy.scale.set(s, sy, s); dummy.updateMatrix();
      const b = Math.floor((x + HALF) / BT) + Math.floor((z + HALF) / BT) * NB;
      (K.list[b] ||= []).push([dummy.matrix.clone(), tint.setHSL(rr(.27, .36), rr(.1, .3), rr(.75, 1.05)).clone()]);
      addCol(x, z, (K === kinds[0] ? .45 : .3) * s);
      n++;
    }
    for (const b in K.list) {
      const L = K.list[b], im = new THREE.InstancedMesh(K.geo, TREEMAT, L.length);
      L.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); world.add(im); FAR_HIDE.push(im);
    }
    await nextFrame();
  }
  // rocks
  const rockMat = new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 900);
  rocks.castShadow = rocks.receiveShadow = true;
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2, r = 60 + Math.sqrt(rnd()) * (VALLEY + 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDist(x, z) < 4 || Math.hypot(x - POI.halvard.x, z - POI.halvard.z) < 80) { i--; continue; }
    const s = rnd() < .1 ? rr(2, 4.5) : rr(.4, 1.4);
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.set(s * rr(1, 1.6), s * rr(.6, 1), s); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    if (s > 1) addCol(x, z, s * 1.1);
  }
  world.add(rocks);
  // cliff outcrops (ELYRA's cliff model) on the steep faces: mountainsides and the gorge
  if (MODELS.cliff) {
    let placed = 0, guard = 0;
    while (placed < (LOW ? 40 : 70) && guard++ < 6000) {
      const x = rr(-VALLEY, VALLEY), z = rr(-VALLEY, VALLEY);
      const sl = slopeAt(x, z); if (sl < 1 || Math.hypot(x, z) < 90 || pathDist(x, z) < 22 || heightAt(x, z) < 20) continue;
      if (FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r1 + 25) || SCOUTS.some(q => Math.hypot(x - q.x, z - q.z) < 40)) continue;
      const s = rr(10, 26), c = modelCopy('cliff', s);
      c.position.set(x, heightAt(x, z) - s * .25, z); c.rotation.y = rnd() * 6; world.add(c);
      c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color = new THREE.Color(0x8c8a84); } });
      addCol(x, z, s * .38); placed++;
    }
  }
  // undergrowth (no collision)
  const fern = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x34502a, color2: 0x5a7a3a }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x3c5a2e, color2: 0x62843e }], .1);
  const ferns = new THREE.InstancedMesh(fern, VCOL, LOW ? 1800 : 4000);
  for (let i = 0; i < ferns.count; i++) {
    const x = rr(-VALLEY, VALLEY), z = rr(-VALLEY, VALLEY);
    if (pathDist(x, z) < 3 || Math.hypot(x, z) < 48 || waterAt(x, z) > heightAt(x, z) - .4) { i--; continue; }
    const s = rr(.6, 1.5); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
    ferns.setMatrixAt(i, dummy.matrix);
  }
  ferns.receiveShadow = true; world.add(ferns);
}

/* ================= the outlands forest: 200m cells grown as you approach, from a seed per cell, so they're the same every visit ================= */
const FAR_HIDE = [];                          // valley tree buckets: hidden once you're far from them
const CELL_T = 200, NCT = Math.ceil(HALF * 2 / CELL_T), OCELLS = new Map(), OCOLS = new Set();
let OGEO = null, rockMatO = null, fernGeoO = null;
function cellRng(ci, cj) { let a = (ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function growCell(ci, cj) {
  if (!OGEO) { OGEO = [firGeo(), alderGeo(), snagGeo()]; rockMatO = new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e, flatShading: true });
    fernGeoO = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x34502a, color2: 0x5a7a3a }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x3c5a2e, color2: 0x62843e }], .1); }
  const R = cellRng(ci, cj), x0 = -HALF + ci * CELL_T, z0 = -HALF + cj * CELL_T, key = ci * 1000 + cj, cols = !OCOLS.has(key);
  const g = new THREE.Group(), dummy = new THREE.Object3D(), tint = new THREE.Color();
  const inner = (x, z) => Math.hypot(x, z) < VALLEY + 140 || Math.hypot(x, z) > WORLD + 60;
  const K = [[LOW ? 400 : 680, []], [LOW ? 45 : 90, []], [12, []]];
  K.forEach(([tries, L], ki) => {
    for (let t = 0; t < tries; t++) {
      const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z)) continue;
      const dens = fbm(x * .018 + 5, z * .018 + 11);
      if (ki === 1 ? (dens > .55 || R() > .5) : R() > smooth(.3, .6, dens) + .14) continue;
      if (ki === 1 && waterAt(x, z) < -1e8 && Math.abs(x - riverX(z)) > 60 && LAKES.every(L => Math.hypot(x - L.x, z - L.z) > L.R + 56) && R() < .7) continue;
      if (!treeOK(x, z)) continue;
      const s = ki === 0 ? lerp(.85, 1.3, R()) : lerp(.8, 1.2, R()), sy = ki === 0 ? lerp(1.2, 2.1, R()) : lerp(.9, 1.3, R());
      dummy.position.set(x, heightAt(x, z) - .25, z); dummy.rotation.set((R() - .5) * .08, R() * 6, (R() - .5) * .08); dummy.scale.set(s, sy, s); dummy.updateMatrix();
      L.push([dummy.matrix.clone(), tint.setHSL(lerp(.27, .36, R()), lerp(.1, .3, R()), lerp(.75, 1.05, R())).clone()]);
      if (cols) addCol(x, z, (ki === 0 ? .45 : .3) * s);
    }
    if (!L.length) return;
    const im = new THREE.InstancedMesh(OGEO[ki], TREEMAT, L.length);
    L.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  });
  const rocks = [], ferns = [];
  for (let t = 0; t < 20; t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 4 || waterAt(x, z) > heightAt(x, z) - .4) continue;
    const s = R() < .12 ? lerp(2, 4.5, R()) : lerp(.4, 1.4, R());
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(s * lerp(1, 1.6, R()), s * lerp(.6, 1, R()), s); dummy.updateMatrix();
    rocks.push(dummy.matrix.clone()); if (cols && s > 1) addCol(x, z, s * 1.1);
  }
  for (let t = 0; t < (LOW ? 40 : 90); t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 3 || waterAt(x, z) > heightAt(x, z) - .4) continue;
    const s = lerp(.6, 1.5, R()); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); ferns.push(dummy.matrix.clone());
  }
  for (const [L, geo, mat, sh] of [[rocks, null, null, true], [ferns, fernGeoO, VCOL, false]]) {
    if (!L.length) continue;
    const im = new THREE.InstancedMesh(geo || new THREE.DodecahedronGeometry(1, 0), mat || rockMatO, L.length);
    L.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = sh; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  }
  if (MODELS.cliff && R() < .5) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T;
    if (!inner(x, z) && slopeAt(x, z) > 1 && pathDist(x, z) > 22 && !FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r1 + 25)) {
      const s = lerp(10, 26, R()), c = modelCopy('cliff', s); c.position.set(x, heightAt(x, z) - s * .25, z); c.rotation.y = R() * 6; g.add(c);
      if (cols) addCol(x, z, s * .38);
    }
  }
  OCOLS.add(key); world.add(g); OCELLS.set(key, g);
}
const FOR_SHOW = 430, FOR_DROP = 900;
let farT = 0;
function updForest(px, pz, dt) {
  farT -= dt; if (farT > 0) return; farT = .25;
  for (const im of FAR_HIDE) { const c = im.boundingSphere.center; im.visible = Math.hypot(c.x - px, c.z - pz) < FOR_SHOW + im.boundingSphere.radius * .5; }
  for (const [k, g] of OCELLS) {
    const ci = Math.floor(k / 1000), cj = k % 1000, d = Math.hypot(-HALF + (ci + .5) * CELL_T - px, -HALF + (cj + .5) * CELL_T - pz);
    if (d > FOR_DROP) { world.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); OCELLS.delete(k); } else g.visible = d < FOR_SHOW;
  }
  if (Math.hypot(px, pz) < VALLEY - 120) return;
  // grow the nearest missing cell (one per tick)
  let best = null, bd = FOR_SHOW + 30; const c0 = Math.floor((px + HALF) / CELL_T), c1 = Math.floor((pz + HALF) / CELL_T);
  for (let cj = c1 - 3; cj <= c1 + 3; cj++) for (let ci = c0 - 3; ci <= c0 + 3; ci++) {
    if (ci < 0 || cj < 0 || ci >= NCT || cj >= NCT || OCELLS.has(ci * 1000 + cj)) continue;
    const cx = -HALF + (ci + .5) * CELL_T, cz = -HALF + (cj + .5) * CELL_T, d = Math.hypot(cx - px, cz - pz);
    if (Math.hypot(cx, cz) < VALLEY - 40 || Math.hypot(cx, cz) > WORLD + 200) continue;
    if (d < bd) { bd = d; best = [ci, cj]; }
  }
  if (best) { growCell(best[0], best[1]); farT = .05; }
}

/* ================= grass: a patch of blades that follows you, swaying in the wind ================= */
let grassMesh, grassU = { uTime: { value: 0 } }, grassAt = { x: 1e9, z: 1e9 };
function buildGrass() {
  const geo = new THREE.PlaneGeometry(.06, .55, 1, 3); geo.translate(0, .275, 0);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / .55; p.setX(i, p.getX(i) * (1 - t * .85) + t * t * .12); const c = new THREE.Color(0x24361c).lerp(new THREE.Color(0x8aa65a), t); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = grassU.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float tip = position.y / .55;
      float w = sin(uTime*1.7 + ip.x*.35 + ip.z*.27) * .5 + sin(uTime*2.9 + ip.x*.9) * .2;
      transformed.x += w * .22 * tip * tip; transformed.z += sin(uTime*1.3 + ip.z*.4) * .09 * tip * tip;`);
  };
  grassMesh = new THREE.InstancedMesh(geo, mat, LOW ? 7000 : 18000);
  grassMesh.frustumCulled = false; grassMesh.receiveShadow = true; grassMesh.count = 0;
  world.add(grassMesh);
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color(), _gy = new THREE.Vector3(0, 1, 0);
function updGrass(px, pz) {
  if (Math.hypot(px - grassAt.x, pz - grassAt.z) < 5) return;
  grassAt.x = Math.round(px / 2) * 2; grassAt.z = Math.round(pz / 2) * 2;
  const R = LOW ? 24 : 34, step = LOW ? .5 : .45, max = grassMesh.instanceMatrix.count;
  let n = 0;
  for (let gx = grassAt.x - R; gx <= grassAt.x + R && n < max; gx += step) for (let gz = grassAt.z - R; gz <= grassAt.z + R && n < max; gz += step) {
    const hx = hash(Math.round(gx / step), Math.round(gz / step)), hz = hash(Math.round(gz / step) + 7, Math.round(gx / step));
    const x = gx + (hx - .5) * step, z = gz + (hz - .5) * step;
    const dd = (x - px) ** 2 + (z - pz) ** 2; if (dd > R * R) continue;
    const cd = Math.hypot(x, z); if (cd < 44 && hx > .05) continue;
    const h = heightAt(x, z);
    if (h > 128 || waterAt(x, z) > h - .3) continue;
    const dens = fbm(x * .04, z * .04); if (hx > dens * 1.5) continue;
    if (Math.abs(hz - .5) < .15 && pathDist(x, z) < 2.4) continue;
    if (slopeAt(x, z) > 1.1) continue;
    _gq.setFromAxisAngle(_gy, hx * 6.28); const s = .65 + hz * .6;
    _gs.set(s, s * (.7 + dens * .9), s); _gp.set(x, h - .05, z); _gm.compose(_gp, _gq, _gs);
    grassMesh.setMatrixAt(n, _gm); _gc.setHSL(.24 + hx * .07, .35, .55 + hz * .25); grassMesh.setColorAt(n, _gc); n++;
  }
  grassMesh.count = n; grassMesh.instanceMatrix.needsUpdate = true; if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
}

/* ================= mist: soft banks that hang on the mountain and drift through the valley ================= */
const mistTex = ctex(256, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const MIST = [];
function buildMist() {
  const spots = [[10, -120, 60], [-40, -150, 80], [60, -160, 90], [-12, -40, 40], [POI.burn.x, POI.burn.z, 20], [-300, -300, 120], [POI.lake.x, POI.lake.z, 6], [riverX(100), 100, 6], [riverX(-200), -200, 6], [-150, 320, 30]];
  for (const [x, z, up] of spots) for (let i = 0; i < 4; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: .32, depthWrite: false, color: 0xdfe6e4 }));
    const px = x + rr(-50, 50), pz = z + rr(-50, 50);
    m.position.set(px, heightAt(px, pz) + up * rr(.6, 1.2) + 8, pz); m.scale.set(rr(90, 160), rr(26, 44), 1);
    world.add(m); MIST.push({ m, x: px, z: pz, ph: rnd() * 6 });
  }
}

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
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, r = rr(90, VALLEY - 40), x = Math.cos(a) * r, z = Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > .8) { i--; continue; } supplyCrate(x, z); }
}

/* ================= the outlands ================= */
// a clan hold: palisade ring with a gate facing the road, gate towers, longhouse, hide tents, totems, a big fire
function buildHold(H) {
  const R = H.R, y0 = heightAt(H.x, H.z), gateA = Math.atan2(-H.z, -H.x);
  const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a6e52 });
  const posts = [], dummy = new THREE.Object3D();
  for (let i = 0; i < 110; i++) {
    const a = i / 110 * Math.PI * 2; if (Math.abs(angWrap(a - gateA)) < .09) continue;
    const x = H.x + Math.cos(a) * R, z = H.z + Math.sin(a) * R, s = rr(.9, 1.2);
    dummy.position.set(x, heightAt(x, z) + 2.6 * s, z); dummy.rotation.set(Math.sin(a) * .08, 0, -Math.cos(a) * .08); dummy.scale.set(1, s, 1); dummy.updateMatrix(); posts.push(dummy.matrix.clone());
    addCol(x, z, .45);
  }
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.05, .32, 5.6, 6), wood, posts.length); posts.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; world.add(im);
  for (const s of [-1, 1]) {
    const a = gateA + s * .11, x = H.x + Math.cos(a) * (R + 1), z = H.z + Math.sin(a) * (R + 1), g = new THREE.Group();
    g.add(mesh(lattice(3, 8, 0x5a4430, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x5a4430), 0, 8, 0, g);
    for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.ConeGeometry(.08, 1.2, 4), M(0xd8d0bc), rr(-1.8, 1.8), 8.6, rr(-1.8, 1.8), g); sp.rotation.z = rr(-.4, .4); }
    place(g, x, z, -a); addCol(x, z, 2);
  }
  { const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(9, 4, 20), wood, 0, 2, 0, g);
    const roof = mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-5.8, 0), new THREE.Vector2(5.8, 0), new THREE.Vector2(0, 5)]), { depth: 22, bevelEnabled: false }), M(0x4a3a2a), 0, 4, -11, g);
    mesh(new THREE.BoxGeometry(2.6, 3, .2), M(0x120e0a), 0, 1.5, 10.05, g);
    const ox = H.x - Math.cos(gateA) * R * .45, oz = H.z - Math.sin(gateA) * R * .45, yaw = Math.PI / 2 + gateA;
    place(g, ox, oz, -gateA + Math.PI / 2);
    const [a1, b1] = rotXZ(0, 9.5, -gateA + Math.PI / 2), [a2, b2] = rotXZ(0, -9.5, -gateA + Math.PI / 2); addColLine(ox + a1, oz + b1, ox + a2, oz + b2, 4.8);
  }
  const hide = [0x7a5a3e, 0x6a4a32, 0x8a6a48, 0x5a4434];
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, r = rr(14, R - 8), x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r;
    if (Math.abs(angWrap(a - gateA)) < .35 || Math.abs(angWrap(a - gateA - Math.PI)) < .35) continue;
    mesh(new THREE.ConeGeometry(rr(2.2, 3), rr(3.8, 5), 8), M(pick(hide)), x, heightAt(x, z) + 2, z, world); addCol(x, z, 2.2);
  }
  for (let i = 0; i < 5; i++) {
    const a = gateA + (i - 2) * .5, x = H.x + Math.cos(a) * 9, z = H.z + Math.sin(a) * 9, g = new THREE.Group();
    for (let k = 0; k < 4; k++) { mesh(new THREE.BoxGeometry(.9, 1.1, .9), M(pick([0x5a4030, 0x6a4a36, 0x4a3426])), 0, .55 + k * 1.1, 0, g); mesh(new THREE.BoxGeometry(.55, .14, .05), M(0x101010), 0, .75 + k * 1.1, .46, g); }
    mesh(new THREE.BoxGeometry(2, .14, .14), M(0xd9d0bd), 0, 4.6, 0, g);
    place(g, x, z, -a + Math.PI / 2); addCol(x, z, .7);
  }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); fl.position.set(H.x, y0 + 1.7, H.z); world.add(fl);
  DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 12 + H.x) * .2; });
  for (let i = 0; i < 3; i++) supplyCrate(H.x + rr(-R * .5, R * .5), H.z + rr(-R * .5, R * .5), pick(['ammo', 'mixed']));
}

// Cinder City: an old-world town gone to rust and creeper — broken towers, burnt-out cars, streets in a grid
function buildCinder() {
  const C = POI.cinder;
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    const x = C.x + gx * 26 + rr(-3, 3), z = C.z + gz * 26 + rr(-3, 3);
    if (Math.hypot(x - C.x, z - C.z) > 92 || rnd() < .2) continue;
    if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1 && rnd() < .6) {           // towers in the middle, tops snapped off
      const w = rr(10, 15), d = rr(10, 15), hgt = rr(16, 42), g = new THREE.Group(), mat = concMat(pick([0xb8b2a6, 0xa49c90, 0x8e8a84]));
      mesh(new THREE.BoxGeometry(w, hgt, d), mat, 0, hgt / 2, 0, g);
      for (let k = 2; k < hgt - 2; k += 3.2) for (const sd of [-1, 1]) mesh(new THREE.BoxGeometry(w * .9, 1.1, .1), M(0x141414), 0, k, sd * (d / 2 + .02), g);
      for (let k = 0; k < 5; k++) { const c = mesh(new THREE.BoxGeometry(rr(2, 5), rr(1, 4), rr(2, 5)), mat, rr(-w / 2, w / 2), hgt + rr(0, 2), rr(-d / 2, d / 2), g); c.rotation.set(rr(-.4, .4), rnd() * 3, rr(-.4, .4)); }
      const lat = mesh(lattice(1.2, rr(4, 8), 0x6a5a4a, 1.6), VCOL, rr(-w / 3, w / 3), hgt, rr(-d / 3, d / 3), g); lat.rotation.z = rr(-.5, .5);
      place(g, x, z, rr(-.05, .05)); addColLine(x - w / 2, z, x + w / 2, z, d / 2);
      SHELTERS.push({ x, z: z + d / 2 + 1.5, kind: 'house', r: 2.5 });
    } else if (rnd() < .65) house(x, z, (gx + gz) % 2 ? 0 : Math.PI / 2, rr(7, 11), rr(6, 9), rnd() < .4 ? 2 : 1);
    else car(x + rr(-6, 6), z + rr(-6, 6), rnd() * 6);
  }
  for (let i = 0; i < 6; i++) supplyCrate(C.x + rr(-70, 70), C.z + rr(-70, 70), pick(['ammo', 'scrap', 'mixed', 'scrap']));
}

// the Watchers: a ring of standing stones on the western moor, older than anyone remembers
function buildWatchers() {
  const W = POI.watchers;
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2, x = W.x + Math.cos(a) * 14, z = W.z + Math.sin(a) * 14, hgt = rr(4, 7);
    const st = mesh(new THREE.BoxGeometry(rr(1.6, 2.2), hgt, rr(.8, 1.2)), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x8c8a84, flatShading: true }), x, heightAt(x, z) + hgt / 2 - .3, z, world);
    st.rotation.set(rr(-.06, .06), -a + rr(-.2, .2), rr(-.08, .08)); addCol(x, z, 1);
  }
  mesh(new THREE.BoxGeometry(5, 1, 2.6), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7870 }), W.x, heightAt(W.x, W.z) + .4, W.z, world); addCol(W.x, W.z, 2.4);
  supplyCrate(W.x + 3, W.z + 4, 'mixed');
}

function buildOutlands() {
  for (const H of HOLDS) buildHold(H);
  buildCinder(); buildWatchers();
  // supply crates and hull scrap scattered over the outlands (the Arc's ring broke up on the way down)
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = rr(VALLEY + 120, WORLD - 80), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > .8) { i--; continue; } supplyCrate(x, z);
  }
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2, r = rr(VALLEY + 60, WORLD - 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > 1) { i--; continue; } spawnScrap(x, z, 'wild');
  }
}

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
  const clan = kind !== 'arc';
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const H = kind === 'brute' ? 1.98 : (o.h || rr(1.68, 1.84));
  const model = o.model || (clan ? (kind === 'brute' ? 'michael' : pick(['civilian', 'michael'])) : pick(['civilian', 'civilian', 'michael']));
  const tint = o.tint ?? (clan ? pick([0x6a5040, 0x5a4434, 0x7a5a44]) : null);
  const m = modelCopy(model, H, 'y', tint);
  if (m) body.add(m);
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
  g.traverse(x => { if (x.isMesh) { x.castShadow = true; } });
  return { g, body, weapon, H, kind };
}
/* stride: bob, side sway, forward lean with speed */
function poseWalk(p, ph, amt) {
  p.body.position.y = Math.abs(Math.sin(ph)) * .07 * amt;
  p.body.rotation.z = Math.sin(ph) * .045 * amt;
  p.body.rotation.x = .07 * amt;
  if (p.weapon) p.weapon.rotation.x = Math.sin(ph) * .25 * amt;
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
  if (e.type === 'clan') { const H = e.p.H, cl = e.climbY || 0; return [[e.x, e.y + H * .66 + cl, e.z, .4 * H / 1.76, 1], [e.x, e.y + H * .93 + cl, e.z, .16 * H / 1.76, 2.2], [e.x, e.y + H * .3 + cl, e.z, .28, .8]]; }
  if (e.type === 'deer') return [[e.x, e.y + 1.05, e.z, .62, 1], [e.x + fx * .85, e.y + 1.75, e.z + fz * .85, .26, 2]];
  if (e.type === 'boar') return [[e.x, e.y + .66, e.z, .58, 1], [e.x + fx * .65, e.y + .66, e.z + fz * .65, .26, 1.8]];
  return [];
}

/* ================= player ================= */
const P = { slot: 0, ads: 0, swim: false, x: 0, z: 26, y: 0, vy: 0, yaw: Math.PI, pitch: 0, hp: 100, food: 100, onGround: true, reload: 0, fire: 0, bob: 0, kick: 0, dead: false, hurtT: 0, pd: 26, coughT: 0, stepT: 0, safe: false,
  vx: 0, vz: 0, stam: 100, stamT: 0, winded: false, runToggle: false, sprinting: false, jumpBuf: 0, coyote: 0, land: 0, eyeY: 0, bobAmp: 0, roll: 0, sway: 0, runK: 0 };
const INV = { scrap: 0, meat: 0, mags: { carbine: 20, battle: 25, hunter: 5 }, res: 60, resH: 15 };
const UP = { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 };
const CLIMB = [.55, .3, .1, 0];
/* the bench's rifle tiles: 1 suppressor + bigger mag, 2 swap to the scoped battle rifle, 3 its tac light + more */
const RIFLE = [{ id: 'carbine', dmg: 28, mag: 20, rate: .115, spread: .014 }, { id: 'carbine', dmg: 34, mag: 25, rate: .11, spread: .011 }, { id: 'battle', dmg: 46, mag: 25, rate: .13, spread: .007 }, { id: 'battle', dmg: 56, mag: 30, rate: .12, spread: .005 }];
const HUNTER = { id: 'hunter', dmg: 150, mag: 5, rate: 1.05, spread: .0015 };
const RES_MAX = 90, RESH_MAX = 20;
const gunStats = () => P.slot === 1 ? HUNTER : RIFLE[UP.rifle];
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
  const m = modelCopy(W.model, W.len, W.axis);
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
function buildArms() {
  const src = MODELS['fp-arms']; if (!src) return;
  for (const n of ['armR', 'armL']) {
    const a = src.getObjectByName(n); if (!a) continue;
    const c = a.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c), sz = b.getSize(new THREE.Vector3()), k = .5 / sz.y;
    const piv = new THREE.Group(), inner = new THREE.Group(); inner.add(c);
    c.scale.setScalar(k); c.position.set(-(b.min.x + sz.x / 2) * k, -(b.min.y + .06 * sz.y) * k, -(b.min.z + sz.z / 2) * k);
    piv.add(inner);
    c.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; const mm = o.material = o.material.clone(); if (mm.map) { mm.emissive = new THREE.Color(1, 1, 1); mm.emissiveMap = mm.map; mm.emissiveIntensity = .22; } } });
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
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
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
  const A = [new Audio(), new Audio()]; A.forEach(a => { a.loop = true; a.preload = 'none'; a.volume = 0; });
  let cur = 0, mood = '', ok = false, mute = muted, fade = null;
  function go(m, force) {
    if (m === mood && !force) return; mood = m; if (!ok) return;
    const nx = 1 - cur, a = A[nx], b = A[cur], list = TR[m] || TR.day;
    a.src = `assets/music/${list[Math.floor(Math.random() * list.length)]}.mp3`; a.currentTime = 0; a.volume = 0; a.play().catch(() => {});
    cur = nx; clearInterval(fade); let t = 0;
    fade = setInterval(() => { t += .05; const k = Math.min(1, t / 2.5), v = mute ? 0 : musicVol; a.volume = v * k; b.volume = v * (1 - k); if (k >= 1) { b.pause(); clearInterval(fade); } }, 50);
  }
  return { go, unlock() { if (ok) return; ok = true; if (mood) go(mood, true); }, setMute(m) { mute = m; A[cur].volume = m ? 0 : musicVol; }, sting(n, v = .5) { if (!ok || mute) return; const s = new Audio(`assets/music/${n}.mp3`); s.volume = v; s.play().catch(() => {}); } };
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
const hud = { hp: $('hpb').firstElementChild, hpw: $('hp'), mag: $('mag'), res: $('res'), gunn: $('gunn'), alert: $('alert'), tool: $('tool'), toast: $('toast'),
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
  vm.visible = false;
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
function setStep(n) { G.step = n; save(); const st = STEPS[n]; if (st && n > 1 && G.mode === 'play') setTimeout(() => toast('◆ ' + (typeof st.text === 'function' ? st.text() : st.text), 4), 900); }
function objText() { const st = STEPS[G.step]; return st ? (typeof st.text === 'function' ? st.text() : st.text) : ''; }

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
    setStep(6); spawnHerd(POI.meadow, 5);
    G.flags.hunter = 1; INV.mags.hunter = 5; INV.resH = 15; selectGunView('hunter'); selectGunView(RIFLE[UP.rifle].id);
    setTimeout(() => { say([['Juno', "Take the long rifle from the med crate. It drops a deer where it stands."]]); toast(isTouch ? 'Hunting rifle: tap SWAP' : 'Hunting rifle: Q to swap, right mouse to aim', 4.5); }, 7000);
    return true;
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
  { id: 'fire', at: () => SPOTS.fire, r: 3.2, label: () => INV.meat > 0 ? `Cook ${INV.meat} meat into rations` : null, act: () => cook() },
  { id: 'armory', at: () => SPOTS.armory, r: 3, label: () => INV.res < RES_MAX || INV.resH < RESH_MAX ? 'Restock ammo' : null, act: () => { INV.res = RES_MAX; INV.resH = G.flags.hunter ? RESH_MAX : INV.resH; sfx('reload'); toast('Ammo restocked'); } },
  { id: 'crate', at: () => nearCrate(), r: 2.6, label: () => 'Search the crate', act: () => openCrate(nearCrate()) },
  { id: 'climb', at: () => POI.lookout, r: 3.6, label: () => P.y < POI.lookoutTop - 3 ? 'Climb the lookout' : 'Climb down', act: () => climbLookout() },
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
const RATION = () => [[40, 10], [55, 20], [70, 30]][UP.smoke];
function cook() {
  if (INV.meat <= 0) return;
  const n = INV.meat; INV.meat = 0; INV.rations = (INV.rations || 0) + n;
  sfx('eat'); puff(SPOTS.fire.x, H0 + 1.2, SPOTS.fire.z, 0x9a9a9a, 6, .8, .3, 1.4, 1);
  toast(`+${n} ration${n > 1 ? 's' : ''} · slot 3 to eat`, 3);
  if (P.food < 90) eatRation(true);
  eat();
}
function eatRation(quiet) {
  if (!(INV.rations > 0)) { if (!quiet) { sfx('no'); toast('No rations — cook meat at the fire'); } return; }
  if (P.food >= 99 && !quiet) { toast('Not hungry'); return; }
  INV.rations--; const [f, h] = RATION();
  P.food = Math.min(100, P.food + f); P.hp = Math.min(100, P.hp + h); sfx('eat'); toast(`+${f} food`, 1.6);
}
function eat() {
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
function openShop() { document.body.classList.add('shopping'); shopOpen = true; renderShop(); shopEl.classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); }
function closeShop() { document.body.classList.remove('shopping'); shopOpen = false; shopEl.classList.remove('on'); }
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
  if (!only || only === 'rifle') { const id = RIFLE[UP.rifle].id; if (P.slot === 0) selectGunView(id); else if (!GUNV[id]) { selectGunView(id); selectGunView('hunter'); } dressGun('carbine', Math.min(UP.rifle, 1)); dressGun('battle', UP.rifle); INV.mags[id] = Math.max(INV.mags[id] || 0, RIFLE[UP.rifle].mag); }
  if (!only || only === 'smoke') dressSmokehouse(UP.smoke);
}

/* ================= story set pieces ================= */
function spawnHerd(c, n) { for (let i = 0; i < n; i++) spawnDeer(c.x + rr(-16, 16), c.z + rr(-16, 16)); }
function podScene() {
  const p = POI.pod;
  if (!named.wren) named.wren = spawnNPC('wren', p.x + 3, p.z + 2, WREN_LOOK(false));
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
  } else if (!ents.some(e => e.type === 'clan' && e.mode === 'raid' && !e.dead)) {
    if (night.wave < night.waves) { night.between += dt; if (night.between > 9) { night.between = 0; nextWave(); } }
    else endNight(true);
  }
  if (night.core <= 0) endNight(false);
}
function endNight(won) {
  night.active = false; gate.open = true; gate.hp = gate.max;
  for (const e of [...ents]) if (e.type === 'clan' && e.mode === 'raid') removeEnt(e);
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
    e.deadT += dt; p.g.rotation.x = -Math.min(Math.PI / 2, e.deadT * 4.5); p.body.rotation.set(0, 0, 0); p.body.position.set(0, 0, 0); e.g.position.y = e.y - (e.deadT > 6 ? (e.deadT - 6) * .4 : 0);
    if (e.deadT > 9) removeEnt(e); return;
  }
  e.t += dt; e.cool -= dt;
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp);
  const insideP = Math.hypot(P.x, P.z) < CAMP_R, insideE = Math.hypot(e.x, e.z) < CAMP_R;
  const walled = insideP !== insideE && gate.hp > 0 && !gate.open;
  let tx = e.x, tz = e.z, spd = 0;
  if (e.atk > 0) { // attack swing in progress
    e.atk -= dt; const wind = e.atk > .25; p.body.rotation.x = wind ? -.12 : .35; p.body.position.z = wind ? -.1 : .35; if (p.weapon) p.weapon.rotation.x = wind ? -1.6 : .6;
    if (e.atk <= .25 && !e.struck) { e.struck = true; sfx('swing');
      if (e.target === 'gate') { gate.hp -= e.kind === 'brute' ? 34 : 14; sfx('thud'); puff(e.x + Math.sin(e.yaw) * 1.2, e.y + 1.4, e.z + Math.cos(e.yaw) * 1.2, 0x8a7a6a, 3, 2, .1, .4); if (gate.hp <= 0) { gate.hp = 0; toast('The gate is down!', 3); sfx('gate'); } }
      else if (dp < 2.7 && !P.dead) hurtPlayer(e.kind === 'brute' ? 24 : 13, e.x, e.z); }
    e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return;
  }
  if (e.climbing) {
    e.climbT -= dt; e.climbY = (1 - Math.abs(e.climbT / e.climbDur * 2 - 1)) * (WALL_H[UP.wall] + .3);
    p.body.rotation.x = -.25 + Math.sin(e.t * 9) * .08;
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
  if (e.throwT > 0) { e.throwT -= dt; p.body.rotation.x = -.18; if (p.weapon) p.weapon.rotation.x = -2.2; if (e.throwT <= 0) { throwSpear(e); p.body.rotation.x = .25; if (p.weapon) p.weapon.rotation.x = .3; } e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return; }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  p.body.position.z = 0;
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
    if (e.state !== 'flee' && dp < (P.sprinting ? 26 : 16) && !P.dead) { e.state = 'flee'; e.t = rr(4, 7); sfx('deer'); }
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
    const lost = Math.floor(INV.scrap * .25); INV.scrap -= lost; INV.meat = 0; if (INV.res < 30) INV.res = 30;
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
const gunId = () => P.slot === 1 ? 'hunter' : RIFLE[UP.rifle].id;
const resOf = () => P.slot === 1 ? 'resH' : 'res';
function shoot() {
  const R = gunStats(), id = gunId();
  if (P.reload > 0 || P.fire > 0 || P.dead || P.swapT > 0) return;
  if (INV.mags[id] <= 0) { sfx('dry'); P.fire = .25; if (INV[resOf()] > 0) reload(); else toast('Out of ammo — restock at the armory'); return; }
  INV.mags[id]--; P.fire = R.rate; P.kick = Math.min(P.kick + (P.slot ? .09 : .028), .14);
  if (!WEAPONS[id].auto) input.fire = false;
  sfx('shot'); flash.visible = true; flash.rotation.z = rnd() * 6; flashLight.intensity = 3; setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 40);
  camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  const sp = R.spread * (1 - P.ads * .7) * (P.onGround ? 1 : 2.5);
  ray.x += rr(-sp, sp); ray.y += rr(-sp, sp); ray.normalize();
  let best = null, bt = 400, mult = 1;
  for (const e of ents) {
    if (e.dead || e.type === 'npc') continue;
    if (Math.hypot(e.x - P.x, e.z - P.z) > 400) continue;
    for (const [cx, cy, cz, r, m] of hitSpheres(e)) {
      const ox = rayO.x - cx, oy = rayO.y - cy, oz = rayO.z - cz;
      const b = ox * ray.x + oy * ray.y + oz * ray.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
      if (h < 0) continue; const t = -b - Math.sqrt(h);
      if (t > 0 && t < bt) { bt = t; best = e; mult = m; }
    }
  }
  let tHit = bt, hitTree = false;
  for (let t = .8; t < bt; t += 1) {
    const x = rayO.x + ray.x * t, y = rayO.y + ray.y * t, z = rayO.z + ray.z * t;
    if (y < heightAt(x, z)) { tHit = t; best = null; break; }
    if (t > 2 && (t | 0) % 2 === 0) for (const c of nearCols(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r * .8 && y < heightAt(c.x, c.z) + 8) { tHit = t; best = null; hitTree = true; break; }
    if (hitTree) break;
  }
  const end = rayO.clone().addScaledVector(ray, tHit);
  const mz = new THREE.Vector3(); muzzle.getWorldPosition(mz); tracer(mz, end);
  if (best) {
    damage(best, R.dmg * mult, true, end); sfx(mult > 1.5 ? 'head' : 'hit');
    hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90);
    hud.hitm.style.filter = mult > 1.5 ? 'drop-shadow(0 0 3px #f44)' : '';
  } else if (tHit < 399) { puff(end.x, end.y + .1, end.z, hitTree ? 0x5a4a38 : 0x6a5a48, 4, 1.5, .1, .4); sfx(hitTree ? 'impact' : 'impact', .7); }
  if (INV.mags[id] === 0 && INV[resOf()] > 0) setTimeout(reload, 240);
}
function reload() {
  const R = gunStats(), id = gunId();
  if (P.reload > 0 || INV.mags[id] >= R.mag || INV[resOf()] <= 0) return;
  P.reload = P.slot ? 2.2 : 1.7; P.reloadMax = P.reload; sfx('reload');
}
function finishReload() { const R = gunStats(), id = gunId(), k = resOf(), n = Math.min(R.mag - INV.mags[id], INV[k]); INV.mags[id] += n; INV[k] -= n; }
let touchUp = false;
function toggleFly(v = !P.fly) {
  if (G.mode !== 'play' || cine || P.dead) return;
  P.fly = v; P.vy = 0; toast(v ? (isTouch ? 'Flying · look where you want to go · hold JUMP to climb · tap the bag twice fast to land' : 'Flying · WASD + look · Space up · C down · Shift fast · F to land') : 'Landed', 3.5);
}
window.fly = toggleFly;
function swapGun() {
  if (!G.flags.hunter || P.reload > 0) return;
  P.slot = 1 - P.slot; P.swapT = .45; selectGunView(gunId()); sfx('reload'); toast(WEAPONS[gunId()].name, 1.2);
}

function updPlayer(dt) {
  if (P.dead) return;
  // look (slower while aiming)
  const lk = 1 / (1 + (WEAPONS[gunId()].scope - 1) * P.ads * .8);
  const dYaw = input.look[0] * lk;
  P.yaw -= dYaw; P.pitch = clamp(P.pitch - input.look[1] * lk, -1.45, 1.45); input.look[0] = input.look[1] = 0;
  // move (or fly: F toggles it — no gravity, no collisions, go where you look)
  let sprint = false, hs = 0;
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  if (P.fly) {
    let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const fast = input.sprint || (isTouch && ml > .96), spd = fast ? 90 : 28, cp = Math.cos(P.pitch);
    const fx = -Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cp;
    const up = (keys.Space || touchUp ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
    P.x += (fx * my + rx * mx) * spd * dt; P.z += (fz * my + rz * mx) * spd * dt; P.y += (fy * my * spd + up * spd * .7) * dt;
    const d = Math.hypot(P.x, P.z); if (d > WORLD) { P.x *= WORLD / d; P.z *= WORLD / d; }
    P.y = clamp(P.y, heightAt(P.x, P.z), 600); P.vy = 0; P.vx = P.vz = 0; P.onGround = false; P.swim = false; input.jump = false; P.eyeY = P.y;
  } else {
    /* momentum: you speed up and slow down over a fraction of a second instead of snapping, keep some carry in the air,
       and hills push back — steep climbs slow you, so mountains feel like mountains */
    let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (ml < .15) P.runToggle = false;                            // the RUN button lets go when you stop
    const wl = waterAt(P.x, P.z), depth = wl - P.y;
    P.swim = depth > 1.25;
    const wantRun = (input.sprint || (isTouch && ml > .96) || P.runToggle) && my > .3 && !shopOpen && !input.ads && !input.fire && !P.swim && depth < .5;
    if (P.stam <= 0) P.winded = true; else if (P.winded && P.stam > 35) P.winded = false;
    sprint = wantRun && !P.winded;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let wx = fx * my + rx * mx, wz = fz * my + rz * mx;
    // slope along where you're heading
    let slopeK = 1;
    if (ml > .05 && P.onGround) { const wl2 = Math.hypot(wx, wz), dx = wx / wl2, dz = wz / wl2, gr = (heightAt(P.x + dx * 1.6, P.z + dz * 1.6) - heightAt(P.x, P.z)) / 1.6; slopeK = clamp(1 - Math.max(0, gr - .22) * 1.1, .38, 1) * (gr < -.25 ? 1.06 : 1); }
    const spd = (sprint ? 9.6 : 5.4) * (shopOpen ? 0 : 1) * (P.swim ? .55 : depth > .4 ? .7 : 1) * (1 - P.ads * .45) * slopeK;
    wx *= spd; wz *= spd;
    const acc = P.swim ? 9 : !P.onGround ? 7 : ml > .05 ? 42 : 30;
    let dvx = wx - P.vx, dvz = wz - P.vz; const dl = Math.hypot(dvx, dvz);
    if (dl > 1e-4) { const st = Math.min(dl, acc * dt); P.vx += dvx / dl * st; P.vz += dvz / dl * st; }
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt;
    collide(P, .42, true);
    // what actually happened after bumping trees and walls becomes the new velocity, so you slide along things instead of sticking
    if (dt > 0) { const ax = (P.x - ox) / dt, az = (P.z - oz) / dt; if (Math.hypot(ax, az) < Math.hypot(P.vx, P.vz) + 2) { P.vx = ax; P.vz = az; } }
    hs = Math.hypot(P.vx, P.vz);
    // stamina: sprinting drains it, it comes back after a breather; run it dry and you're winded until it's a third back
    if (sprint && hs > 3) { P.stam = Math.max(0, P.stam - dt * 11); P.stamT = 1; }
    else { P.stamT -= dt; if (P.stamT <= 0) P.stam = Math.min(100, P.stam + dt * (hs > 1 ? 13 : 24)); }
    if (P.winded) { P.breathT = (P.breathT || 0) - dt; if (P.breathT <= 0) { P.breathT = .75; noiseBurst(.32, 750, .8, .035, 'bandpass'); } }
    let gy = heightAt(P.x, P.z);
    const fl = floorAt(P.x, P.z, P.y); if (fl > gy) gy = fl;
    if (P.swim) gy = Math.max(gy, wl - 1.3);
    // jump: pressing a beat early still counts, and so does a beat after you've stepped off an edge
    if (input.jump) P.jumpBuf = .15; input.jump = false; P.jumpBuf -= dt;
    P.coyote = P.onGround ? .12 : P.coyote - dt;
    if (P.jumpBuf > 0 && (P.coyote > 0 || P.swim)) { P.vy = P.swim ? 3 : 6.8 + (sprint ? .4 : 0); P.onGround = false; P.coyote = 0; P.jumpBuf = 0; if (!P.swim) P.stam = Math.max(0, P.stam - 5); }
    P.vy -= (P.swim ? 6 : 22) * dt; P.y += P.vy * dt;
    if (P.y <= gy) {
      if (!P.onGround) { P.land = Math.max(P.land, clamp(-P.vy * .022, 0, .32)); if (P.vy < -4.5) sfx('step', 1.3); if (P.vy < -11) { sfx('thud'); if (P.vy < -17) hurtPlayer(Math.round((-P.vy - 17) * 4), P.x, P.z); } }
      P.y = gy; P.vy = 0; P.onGround = true;
    }
    else if (P.onGround && P.vy <= 0 && P.y - gy < .55 + hs * .06) P.y = gy; else P.onGround = false;
    // footsteps and head bob are driven by distance covered, so they always match your stride
    const moving = hs > .6 && P.onGround;
    const stepLen = sprint ? 2.25 : 1.6, b0 = Math.floor(P.bob / Math.PI);
    if (P.onGround) P.bob += hs * dt / stepLen * Math.PI;
    STEP_SURF = depth > -.1 ? 'sand' : fl > -1e8 && fl >= P.y - .1 ? (Math.hypot(P.x - POI.bridge.x, P.z - POI.bridge.z) < 50 ? 'gravel' : 'metal') : P.y > 122 ? 'snow' : pathDist(P.x, P.z) < 3 || Math.hypot(P.x - POI.halvard.x, P.z - POI.halvard.z) < 75 ? 'gravel' : 'trail';
    if (moving && Math.floor(P.bob / Math.PI) !== b0) { sfx('step', sprint ? 1.35 : clamp(hs / 5.4, .5, 1)); if (depth > -.05) sfx('splash'); }
    P.bobAmp = lerp(P.bobAmp, moving ? clamp(hs / 5.4, 0, 1.8) : 0, Math.min(1, dt * 8));
    // the eye follows the ground smoothly instead of snapping over every bump
    P.eyeY = P.onGround && Math.abs(P.y - P.eyeY) < .8 ? lerp(P.eyeY, P.y, Math.min(1, dt * 22)) : P.y;
  }
  P.sprinting = sprint && hs > 3;
  // survival
  P.food = Math.max(0, P.food - dt * (P.sprinting ? .13 : .08) * (P.swim ? 1.6 : 1));
  if (P.food <= 0) { P.hp -= dt * 1.2; if (P.hp <= 0) die(); }
  else if (P.food > 45 && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * (Math.hypot(P.x, P.z) < CAMP_R ? 1.6 : .5));
  if (P.hp <= 0 && !P.dead) die();
  P.hurtT -= dt;
  // weapon
  const W = WEAPONS[gunId()];
  P.ads = lerp(P.ads, input.ads && !P.swim && P.reload <= 0 && !sprint ? 1 : 0, Math.min(1, dt * 12));
  P.fire -= dt; P.swapT = Math.max(0, (P.swapT || 0) - dt);
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) finishReload(); }
  if (input.fire && !shopOpen && !P.swim) shoot();
  P.kick = Math.max(0, P.kick - dt * .5);
  // camera: stride bob, a dip when you land, a lean into strafes, and the view widens a touch at a full run
  P.runK = lerp(P.runK, P.sprinting ? 1 : 0, Math.min(1, dt * 5));
  P.land = lerp(P.land, 0, Math.min(1, dt * 6));
  const bk = (1 - P.ads * .85) * P.bobAmp, bobY = (Math.abs(Math.sin(P.bob)) - .5) * .085 * bk * (1 + P.runK * .5), bobX = Math.cos(P.bob) * .035 * bk * (1 + P.runK * .6);
  const latV = P.vx * rx + P.vz * rz;
  P.roll = lerp(P.roll, -latV * .0045 + Math.cos(P.bob) * .006 * bk * P.runK - dYaw * .6, Math.min(1, dt * 8));
  P.sway = lerp(P.sway, clamp(dYaw * 1.6, -.06, .06), Math.min(1, dt * 10));
  camera.position.set(P.x + rx * bobX * .5, P.eyeY + (P.swim ? 1.45 : 1.62) + bobY - P.land, P.z + rz * bobX * .5);
  camera.rotation.set(P.pitch + P.kick * .35 - P.land * .12, P.yaw, P.roll);
  const fov = (BASE_FOV + P.runK * 7) / (1 + (W.scope - 1) * P.ads);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const scoped = gunId() === 'hunter' && P.ads > .85;
  $('scope').classList.toggle('on', scoped); vm.visible = !scoped && !P.swim;
  // viewmodel: bob, kick, reload dip, swap drop; aiming slides it to the centre
  const rl = P.reload > 0 ? Math.sin((1 - P.reload / P.reloadMax) * Math.PI) : 0, sw = (P.swapT || 0) / .45;
  // running lowers and cants the gun; it lags a hair behind fast turns
  const rk2 = P.runK;
  vm.position.set(bobX * .8 - P.ads * W.at[0] + P.sway * .5 - rk2 * .03, bobY * .7 - rl * .16 - sw * .3 - rk2 * .07 - P.land * .3 + P.ads * (-W.at[1] - .085 - (W.scope > 2 ? .045 : 0)), P.kick * 1.1 + P.ads * .1 + rk2 * .03);
  vm.rotation.set(rl * .5 + P.kick * 1.4 - rk2 * .32 + Math.sin(P.bob) * .03 * rk2, P.sway * 1.5 + rk2 * .55, -rl * .3 + rk2 * .2 + P.roll * .5);
  if (G.step === 9 && named.wren && Math.hypot(P.x, P.z) < 160) ambushCheck();
}
function climbLookout() {
  if (P.y < POI.lookoutTop - 3) { P.x = POI.lookout.x + .5; P.z = POI.lookout.z + .5; P.y = POI.lookoutTop; P.vy = 0; toast('The whole valley, laid out', 2.5); }
  else { P.x = POI.lookout.x - 4; P.z = POI.lookout.z + 4; P.y = heightAt(P.x, P.z); P.vy = 0; }
  sfx('step'); sfx('step');
}
const nearCrate = () => { let b = null, bd = 3; for (const c of CRATES) if (!c.opened) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; b = c; } } return b; };
function openCrate(c) {
  if (!c || c.opened) return; c.opened = true; c.g.scale.y *= .5;
  const msg = [];
  if (c.loot === 'ammo' || c.loot === 'mixed') { const n = 18 + Math.floor(rnd() * 20); INV.res = Math.min(RES_MAX + 30, INV.res + n); msg.push(`+${n} rounds`); if (G.flags.hunter) { INV.resH += 4; msg.push('+4 rifle rounds'); } }
  if (c.loot === 'scrap' || c.loot === 'mixed') { const n = 2 + Math.floor(rnd() * 4); INV.scrap += n; msg.push(`+${n} scrap`); }
  if (rnd() < .3) { INV.meat++; msg.push('+1 dried meat'); }
  sfx('pickup'); toast(msg.join(' · '), 2.6);
}

/* ================= wildlife + the clans in the wider valley ================= */
function ensureWildlife() {
  const inV = e => Math.hypot(e.home ? e.home.x : e.x, e.home ? e.home.z : e.z) < VALLEY;
  const deer = ents.filter(e => e.type === 'deer' && !e.dead && inV(e)).length, boar = ents.filter(e => e.type === 'boar' && !e.dead && inV(e)).length;
  const odeer = ents.filter(e => e.type === 'deer' && !e.dead && !inV(e)).length, oboar = ents.filter(e => e.type === 'boar' && !e.dead && !inV(e)).length;
  for (let i = odeer; i < 30; i++) { const m = OUT_MEADOWS[i % OUT_MEADOWS.length]; spawnDeer(m.x + rr(-22, 22), m.z + rr(-22, 22)); }
  for (let i = oboar; i < 14; i++) { const a = rnd() * 6.28, r = rr(VALLEY + 140, WORLD - 120); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnBoar(x, z); }
  for (let i = deer; i < 26; i++) { const m = MEADOWS[i % MEADOWS.length]; spawnDeer(m.x + rr(-18, 18), m.z + rr(-18, 18)); }
  for (let i = boar; i < 10; i++) { const a = rnd() * 6.28, r = rr(90, VALLEY - 60); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnBoar(x, z); }
}
function clanGroup(c, n, spread, mix) { for (let i = 0; i < n; i++) spawnClan(mix[i % mix.length], c.x + rr(-spread, spread), c.z + rr(-spread, spread), 'guard'); }
function villageGuards() {
  clanGroup(POI.village, 5, 12, ['warrior', 'thrower', 'warrior', 'thrower', 'brute']);
  clanGroup(POI.ashmere, 11, 26, ['warrior', 'thrower', 'warrior', 'brute', 'thrower', 'warrior']);
  clanGroup(POI.burn, 4, 22, ['warrior', 'thrower']);
  for (const s of SCOUTS) clanGroup(s, 3, 7, ['warrior', 'thrower', 'warrior']);
  for (const H of HOLDS) clanGroup(H, 9, H.R * .6, ['warrior', 'thrower', 'warrior', 'brute', 'thrower', 'warrior']);
}

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
  scene.fog.far = lerp(far, 24, rk); scene.fog.near = lerp(Math.min(40, far * .05), 2, rk);
  skyU.fogC.value.copy(fogC); skyU.top.value.copy(s.top); skyU.hor.value.copy(s.hor).lerp(_ca.set(0x7a3220), rk * .8); skyU.sunCol.value.copy(s.sun); skyU.rust.value = rk * .7;
  const ang = (G.tod - .25) * Math.PI * 2, sd = new THREE.Vector3(Math.cos(ang) * .8, Math.sin(ang), .35).normalize();
  skyU.sunDir.value.copy(sd);
  const ld = sd.y > 0 ? sd : sd.clone().negate();
  sun.position.set(P.x + ld.x * 160, P.y + ld.y * 160, P.z + ld.z * 160); sun.target.position.set(P.x, P.y, P.z);
  sun.color.copy(s.sun); sun.intensity = s.sunI * (1 - rk * .6);
  hemi.intensity = s.hemiI * 1.45 * (1 - rk * .3); hemi.color.copy(s.top).lerp(_cb.set(0xcfd8dc), .5);
  stars.material.opacity = clamp((isNight() ? 1 : 0) - rk, 0, 1) * smooth(.15, .3, Math.abs(G.tod - .5) * 2 - .3) * 1.2;
  const camFar = camera.far;
  sky.position.copy(camera.position); sky.scale.setScalar(camFar * .92); stars.position.copy(camera.position); stars.scale.setScalar(camFar * .9);
  for (const C of CLOUDS) {
    C.m.position.set(camera.position.x, C.y, camera.position.z); C.u.off.value.x += dt * C.sx; C.u.off.value.y += dt * C.sz;
    C.u.off.value.x += (camera.position.x - (C.px ?? camera.position.x)) / (C.m.geometry.parameters.width / C.u.rep.value); C.u.off.value.y += (camera.position.z - (C.pz ?? camera.position.z)) / (C.m.geometry.parameters.width / C.u.rep.value); C.px = camera.position.x; C.pz = camera.position.z;
    C.u.col.value.copy(s.hor).lerp(_cb.set(0xffffff), .35).multiplyScalar(clamp(s.sunI / 2, .12, 1)).lerp(_cb.set(0x7a3220), rk * .6); C.u.haze.value.copy(fogC); C.u.op.value = C.op * (1 - rk * .5);
  }
  refreshEnv(G.tod, rk);
  grade.uniforms.hurt.value = clamp(+hud.hurt.style.opacity || 0, 0, 1) * .8 + (P.dead ? 1 : 0);
  grade.uniforms.shadow.value.set(rk * .04, .012 - rk * .01, .03 - rk * .03);
  const nightK = clamp(1 - s.sunI / 1.2, 0, 1);
  torch.intensity = nightK * 2.6;
  campLight.intensity = nightK * (.35 + UP.light * .55);
  fireLight.intensity = 1.2 + nightK * 2 + Math.sin(G.t * 17) * .3;
  renderer.toneMappingExposure = 1.0 + nightK * .4;
  for (const M0 of MIST) { M0.m.material.opacity = (.26 + Math.sin(G.t * .2 + M0.ph) * .06) * (1 - rk) * clamp(s.sunI, .25, 1); M0.m.material.color.copy(s.fog).lerp(_cb.set(0xffffff), .3); M0.m.position.x = M0.x + Math.sin(G.t * .03 + M0.ph) * 12; }
  if (relayLamp) relayLamp.visible = Math.sin(G.t * 2.4) > .2;
  if (waterMat) { texWaterN.offset.y -= dt * .02; texWaterN.offset.x += dt * .004; }
  if (windGain) windGain.gain.value = .04 + rk * .12;
  hud.rustv.style.opacity = rk > .4 && !P.safe ? 1 : rk * .6;
  if (vaultLamp) vaultLamp.visible = Math.sin(G.t * 3) > 0;
  if (AC && isNight() && !muted && !night.active) { cricketT -= .016; if (cricketT <= 0) { cricketT = rr(.3, 1.6); for (let i = 0; i < 3; i++) tone(rr(3800, 4600), .03, .025, 'sine', i * .06); } }
}

/* ================= HUD: health, toolbar, gun + ammo, minimap — that's it ================= */
const SLOT_ICON = {
  rifle: '<svg viewBox="0 0 40 16"><path d="M2 7h22l3-2h9v3h-6l-1 2h-6l-2 5h-4l1-5H2z" fill="#d9d2c2" stroke="#000" stroke-width="1"/></svg>',
  hunter: '<svg viewBox="0 0 40 16"><path d="M1 8h28v-2h10v2l-10 1-2 2h-6l-3 4h-4l1-4H1z" fill="#c9a77a" stroke="#000" stroke-width="1"/><rect x="12" y="3" width="10" height="3" rx="1" fill="#555" stroke="#000" stroke-width=".8"/></svg>',
  ration: '<svg viewBox="0 0 16 16"><path d="M3 9c0-4 4-7 8-6 3 1 3 5 0 7-2 2-5 3-7 2z" fill="#a8552e" stroke="#000"/><path d="M5 9c2-1 4-3 5-5" stroke="#e8b070" stroke-width="1.2" fill="none"/></svg>',
};
let toolSig = '';
function slotDefs() {
  return [
    { k: 'gun0', icon: SLOT_ICON.rifle, label: WEAPONS[RIFLE[UP.rifle].id].name, on: P.slot === 0 },
    { k: 'gun1', icon: G.flags.hunter ? SLOT_ICON.hunter : '', label: G.flags.hunter ? 'Hunting rifle' : '', on: P.slot === 1 },
    { k: 'ration', icon: INV.rations > 0 ? SLOT_ICON.ration : '', label: INV.rations > 0 ? 'Ration' : '', n: INV.rations || 0 },
    { k: 'e4' }, { k: 'e5' },
  ];
}
function renderTool() {
  const d = slotDefs(), sig = JSON.stringify(d.map(x => [x.k, !!x.icon, x.on, x.n]));
  if (sig === toolSig) return; toolSig = sig;
  hud.tool.innerHTML = d.map((x, i) => `<div class="slot${x.on ? ' on' : ''}${x.icon ? '' : ' empty'}" data-i="${i}" title="${x.label || ''}"><em>${i + 1}</em>${x.icon || ''}${x.n ? `<b>${x.n}</b>` : ''}</div>`).join('');
}
function useSlot(i) {
  if (G.mode !== 'play' || cine || P.dead) return;
  if (i === 0 && P.slot !== 0) swapGun();
  else if (i === 1 && P.slot !== 1 && G.flags.hunter) swapGun();
  else if (i === 2) eatRation();
}
hud.tool.addEventListener('click', e => { const s0 = e.target.closest('.slot'); if (s0) useSlot(+s0.dataset.i); });
function updHUD(dt) {
  hud.hp.style.width = Math.max(0, P.hp) + '%';
  { const st = $('stam'); st.firstElementChild.style.width = P.stam + '%'; st.classList.toggle('on', P.stam < 99.5 && !P.fly); st.classList.toggle('low', !!P.winded); } if (isTouch) $('bRun').classList.toggle('lit', !!P.runToggle);
  hud.hpw.classList.toggle('hungry', P.food < 22);
  hud.mag.textContent = P.reload > 0 ? '··' : INV.mags[gunId()]; hud.res.textContent = '/ ' + INV[resOf()];
  hud.gunn.textContent = WEAPONS[gunId()].name;
  renderTool();
  // a short alert only when something is actually trying to kill you
  let alert = '';
  if (rust.state === 'warn') alert = `Red fog in ${Math.ceil(rust.t)}s — get under a roof`;
  else if (rust.state === 'active' && !P.safe) alert = 'Red fog — get under a roof!';
  else if (night.active) alert = `Hold Kestrel · wave ${night.wave}/${night.waves}`;
  else if (P.food <= 0) alert = 'Starving — eat something';
  hud.alert.textContent = alert; hud.alert.classList.toggle('on', !!alert); hud.alert.classList.toggle('rust', rust.state === 'warn' || rust.state === 'active');
  miniT -= dt; if (miniT <= 0) { miniT = .1; drawMini(); }
  if (invOpen) { invT -= dt; if (invT <= 0) { invT = .3; renderInv(); } }
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

/* ---------- inventory ---------- */
let invOpen = false, invT = 0;
const ICO = {
  scrap: '<svg viewBox="0 0 16 16"><path d="M2 5l6-3 6 3v6l-6 3-6-3z" fill="#9aa3a8" stroke="#000"/><path d="M2 5l6 3 6-3M8 8v6" stroke="#000" fill="none"/></svg>',
  meat: '<svg viewBox="0 0 16 16"><path d="M3 9c0-4 4-7 8-6 3 1 3 5 0 7-2 2-5 3-7 2z" fill="#c0634a" stroke="#000"/><circle cx="12.5" cy="12.5" r="2" fill="#eee" stroke="#000"/></svg>',
  ammo: '<svg viewBox="0 0 16 16"><path d="M4 14V6l1.5-4L7 6v8zM9 14V6l1.5-4L12 6v8z" fill="#d8b25a" stroke="#000" stroke-width=".8"/></svg>',
};
function objectiveNow() {
  if (rust.state === 'warn' || rust.state === 'active') return 'Get under a roof until the fog lifts';
  if (night.active && G.step !== 11) return `Hold Kestrel · wave ${night.wave}/${night.waves}`;
  return objText();
}
function renderInv() {
  const it = (ic, n, l) => `<div class="it">${ic}<b>${n}</b><span>${l}</span></div>`;
  const hh = Math.floor((G.tod * 24 + 24) % 24), mm = Math.floor((G.tod * 24 * 60) % 60 / 15) * 15;
  $('invb').innerHTML = `
    <div class="row">${it(ICO.scrap, INV.scrap, 'Scrap')}${it(ICO.meat, INV.meat, 'Raw meat')}${it(SLOT_ICON.ration, INV.rations || 0, 'Rations')}${it(ICO.ammo, INV.res, 'Rifle ammo')}${G.flags.hunter ? it(ICO.ammo, INV.resH, 'Hunting ammo') : ''}</div>
    <div class="stat"><span>Health</span><div class="bar"><i style="width:${Math.max(0, P.hp)}%;background:#d9503a"></i></div><span>Food</span><div class="bar"><i style="width:${P.food}%;background:#e0a040"></i></div></div>
    <p class="obj">◆ ${objectiveNow() || 'Explore'}</p>
    <p class="day">Day ${G.day} of 100 · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${exploredPct()}% of the land explored</p>`;
}
function toggleInv(v = !invOpen) {
  if (v && mapOpen) toggleMap();
  invOpen = v; $('inv').classList.toggle('on', v); if (v) { renderInv(); if (document.pointerLockElement) document.exitPointerLock(); }
}
$('inv').addEventListener('click', () => toggleInv(false));
$('bInv').addEventListener('click', e => { e.stopPropagation(); toggleInv(); });
$('mini').addEventListener('click', e => { e.stopPropagation(); toggleMap(); });
if (isTouch) document.body.classList.add('touch');

/* ================= input ================= */
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; initAudio();
  if (G.mode !== 'play') return;
  if (cine && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { skipCine(); return; }
  if (e.code === 'KeyE') { if (shopOpen) closeShop(); else useInteract(); }
  if (e.code === 'KeyR') reload();
  if (e.code === 'Space') input.jump = true;
  if (e.code === 'KeyN') setMute(!muted);
  if (e.code === 'KeyM') { if (invOpen) toggleInv(false); toggleMap(); }
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); toggleInv(); }
  if (e.code === 'KeyQ') swapGun();
  if (e.code === 'KeyF') toggleFly();
  const dg = /^Digit([1-5])$/.exec(e.code); if (dg) useSlot(+dg[1] - 1);
  if (e.code === 'Escape') { if (shopOpen) closeShop(); if (invOpen) toggleInv(false); if (mapOpen) toggleMap(); }
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
  if (e.button === 2) input.ads = true;
});
addEventListener('wheel', e => { if (G.mode === 'play' && document.pointerLockElement && G.flags.hunter && Math.abs(e.deltaY) > 4) swapGun(); }, { passive: true });
addEventListener('contextmenu', e => { if (G.mode === 'play') e.preventDefault(); });
addEventListener('mouseup', e => { if (e.button === 0 && !isTouch) input.fire = false; if (e.button === 2) input.ads = false; });
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
    if (el && el.closest('.slot')) { e.preventDefault(); useSlot(+el.closest('.slot').dataset.i); continue; }
    if (el && (el.closest('#mini') || el.closest('#bInv'))) { e.preventDefault(); if (el.closest('#mini')) toggleMap(); else { const now = performance.now(); if (now - (window.__bagT || 0) < 350) { toggleInv(false); toggleFly(); } else toggleInv(); window.__bagT = now; } continue; }
    const btn = el && el.closest('.btn');
    if (btn) {
      btn.classList.add('on');
      if (btn.id === 'bFire') { input.fire = true; touches.set(t.identifier, { kind: 'fire', x: t.clientX, y: t.clientY, btn }); }
      else { touches.set(t.identifier, { kind: 'btn', btn }); if (btn.id === 'bJump') { input.jump = true; touchUp = true; } if (btn.id === 'bRel') reload(); if (btn.id === 'bUse') useInteract();
        if (btn.id === 'bAim') { input.ads = !input.ads; btn.classList.toggle('lit', input.ads); } if (btn.id === 'bRun') P.runToggle = !P.runToggle; }
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
    if (s.btn) { s.btn.classList.remove('on'); if (s.btn.id === 'bJump') touchUp = false; }
    touches.delete(t.identifier);
  }
}
for (const el of [canvas, $('touch')]) { el.addEventListener('touchstart', tStart, { passive: false }); el.addEventListener('touchmove', tMove, { passive: false }); el.addEventListener('touchend', tEnd); el.addEventListener('touchcancel', tEnd); }
document.addEventListener('touchmove', e => { if (G.mode === 'play' && !e.target.closest('#shop')) e.preventDefault(); }, { passive: false });
for (const id of ['inv', 'map']) $(id).addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });

/* ================= save ================= */
const SAVE = 'the-arc-save-v2';
function save() {
  if (G.mode !== 'play') return;
  try { localStorage.setItem(SAVE, JSON.stringify({ step: G.step, day: G.day, tod: G.tod, chapterDone: G.chapterDone, flags: G.flags, inv: INV, up: UP, hp: P.hp, food: P.food })); } catch (e) {}
}
function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }

/* ================= main loop ================= */
let last = performance.now(), saveT = 0, titleT = 0, regionT = 1;
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

  updSmoke(G.t); grassU.uTime.value = G.t; updFar(dt, G.t, camera.position.x, camera.position.z);
  if (G.mode === 'title') {
    vm.visible = false; titleT += dt * .03;
    camera.position.set(Math.sin(titleT) * 80, H0 + 20, Math.cos(titleT) * 80 + 20);
    camera.lookAt(0, H0 + 14, -30);
    updGrass(camera.position.x, camera.position.z); updTerrain(camera.position.x, camera.position.z); updForest(camera.position.x, camera.position.z, dt);
    updTime(dt); music.go('dawn');
  } else {
    keyMove();
    if (cine) updCine(dt); else { updPlayer(dt); }
    updGrass(camera.position.x, camera.position.z); updTerrain(camera.position.x, camera.position.z); updForest(camera.position.x, camera.position.z, dt);
    if (!cine) updExplore(dt);
    music.go(cine && G.step === 0 ? 'intro' : night.active ? 'raid' : rust.state === 'active' || rust.state === 'warn' ? 'tense' : isNight() ? 'night' : 'day');
    regionT -= dt; if (regionT <= 0) { regionT = .7; checkRegions(); }
    if (mapOpen) drawMap();
    for (const e of [...ents]) {
      const d = Math.hypot(e.x - P.x, e.z - P.z); e.g.visible = d < clamp(scene.fog.far * .6, 160, 700);
      if (d > 260 && e.type !== 'clan') continue;
      if (e.type === 'clan' && d > 300 && e.mode !== 'raid' && e.state === 'idle') continue;
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
  grade.uniforms.t.value = G.t;
  composer.render(dt);
}

/* ================= regions + the valley map ================= */
function checkRegions() {
  const seen = G.flags.seen = G.flags.seen || {};
  for (const R of REGIONS) {
    if (seen[R.id]) continue;
    const inside = R.area ? R.area(P.x, P.z) : R.river ? Math.abs(P.x - riverX(P.z)) < RIV_HW + 26 : Math.hypot(P.x - R.x, P.z - R.z) < R.r;
    if (inside && !cine) { seen[R.id] = 1; card(R.name, R.sub, 3.6); music.sting('sting-drum-hit', .35); save(); return; }
  }
}
/* the map covers the whole land; anywhere you haven't walked stays dark (the valley you already know) */
let mapOpen = false, mapBase = null;
const MAPPX = LOW ? 768 : 1024, MAPR = WORLD + 100;
const EXP_N = 120, EXP = new Uint8Array(EXP_N * EXP_N), fogC = document.createElement('canvas');
fogC.width = fogC.height = EXP_N; const fogG = fogC.getContext('2d'), fogImg = fogG.createImageData(EXP_N, EXP_N);
for (let k = 0; k < EXP_N * EXP_N; k++) { fogImg.data[k * 4] = 6; fogImg.data[k * 4 + 1] = 9; fogImg.data[k * 4 + 2] = 11; }
const expIdx = (x, z) => { const i = Math.floor((x / MAPR + 1) / 2 * EXP_N), j = Math.floor((z / MAPR + 1) / 2 * EXP_N); return i < 0 || j < 0 || i >= EXP_N || j >= EXP_N ? -1 : j * EXP_N + i; };
function fogPix(k) { fogImg.data[k * 4 + 3] = EXP[k] ? 0 : 215; }
function fogFlush() { fogG.putImageData(fogImg, 0, 0); }
function exploreAt(x, z, r) {
  let ch = false; const cs = MAPR * 2 / EXP_N;
  for (let dz = -r; dz <= r; dz += cs * .5) for (let dx = -r; dx <= r; dx += cs * .5) {
    if (dx * dx + dz * dz > r * r) continue; const k = expIdx(x + dx, z + dz); if (k >= 0 && !EXP[k]) { EXP[k] = 1; fogPix(k); ch = true; }
  }
  if (ch) fogFlush(); return ch;
}
function exploredPct() { let n = 0, t = 0; for (let j = 0; j < EXP_N; j++) for (let i = 0; i < EXP_N; i++) { const x = ((i + .5) / EXP_N * 2 - 1) * MAPR, z = ((j + .5) / EXP_N * 2 - 1) * MAPR; if (Math.hypot(x, z) > WORLD) continue; t++; n += EXP[j * EXP_N + i]; } return Math.round(n / t * 100); }
function packExp() { let s0 = ''; for (let k = 0; k < EXP.length; k += 6) { let v = 0; for (let b = 0; b < 6; b++) v |= (EXP[k + b] || 0) << b; s0 += String.fromCharCode(48 + v); } return s0; }
function unpackExp(str) { EXP.fill(0); if (str) for (let c = 0; c < str.length; c++) { const v = str.charCodeAt(c) - 48; for (let b = 0; b < 6; b++) if (c * 6 + b < EXP.length) EXP[c * 6 + b] = (v >> b) & 1; } }
function resetExplore(str) {
  unpackExp(str);
  for (let j = 0; j < EXP_N; j++) for (let i = 0; i < EXP_N; i++) { const x = ((i + .5) / EXP_N * 2 - 1) * MAPR, z = ((j + .5) / EXP_N * 2 - 1) * MAPR; if (Math.hypot(x, z) < VALLEY - 40) EXP[j * EXP_N + i] = 1; }
  for (let k = 0; k < EXP.length; k++) fogPix(k); fogFlush();
}
let expT = 0;
function updExplore(dt) { expT -= dt; if (expT > 0) return; expT = .5; if (exploreAt(P.x, P.z, 150)) G.flags.exp = packExp(); }

async function buildMapCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = MAPPX; const g = c.getContext('2d'), img = g.createImageData(MAPPX, MAPPX);
  const cG = [.34, .45, .23], cF = [.2, .27, .17], cR = [.44, .43, .4], cS = [.89, .9, .91];
  for (let j = 0; j < MAPPX; j++) {
    const z = (j / MAPPX * 2 - 1) * MAPR;
    for (let i = 0; i < MAPPX; i++) {
      const x = (i / MAPPX * 2 - 1) * MAPR, h = heightAt(x, z), k = (j * MAPPX + i) * 4;
      const hx = heightAt(x + 3, z) - heightAt(x - 3, z), hz = heightAt(x, z + 3) - heightAt(x, z - 3), sl = Math.hypot(hx, hz) / 6;
      const f = smooth(.45, .7, fbm(x * .012 + 40, z * .012)) * .8, rk = smooth(.7, 1.3, sl), sn = smooth(122, 150, h);
      let r = lerp(cG[0], cF[0], f), gg = lerp(cG[1], cF[1], f), b = lerp(cG[2], cF[2], f);
      r = lerp(r, cR[0], rk); gg = lerp(gg, cR[1], rk); b = lerp(b, cR[2], rk); r = lerp(r, cS[0], sn); gg = lerp(gg, cS[1], sn); b = lerp(b, cS[2], sn);
      if (waterAt(x, z) > h) { r = .12; gg = .24; b = .28; }
      const sh = clamp(1 - (hx + hz) * .05 + (h - 20) * .0015, .55, 1.45), edge = Math.hypot(x, z) > WORLD ? .45 : 1;
      img.data[k] = Math.pow(clamp(r * sh * edge, 0, 1), 1 / 2.2) * 255; img.data[k + 1] = Math.pow(clamp(gg * sh * edge, 0, 1), 1 / 2.2) * 255; img.data[k + 2] = Math.pow(clamp(b * sh * edge, 0, 1), 1 / 2.2) * 255; img.data[k + 3] = 255;
    }
    if (j % 48 === 0) { setLoad(`DRAWING THE MAP ${Math.round(j / MAPPX * 100)}%`); await nextFrame(); }
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(120,96,66,.85)'; g.lineWidth = MAPPX / 420; g.lineCap = g.lineJoin = 'round';
  for (const p of PATHS) { g.beginPath(); p.forEach(([x, z], i) => { const X = (x / MAPR + 1) / 2 * MAPPX, Y = (z / MAPR + 1) / 2 * MAPPX; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
  mapBase = c;
}
const toMap = (x, z, S) => [(x / MAPR + 1) / 2 * S, (z / MAPR + 1) / 2 * S];
function regionColor(R) { return R.id === 'kestrel' ? '#f0a640' : R.hostile ? '#e0573d' : '#efe9dc'; }
function drawMap() {
  const cv = $('mapc'), S = Math.round(Math.min(innerHeight - 70, innerWidth - 40, 760) * (devicePixelRatio > 1 ? 2 : 1));
  if (cv.width !== S) cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(mapBase, 0, 0, S, S); g.drawImage(fogC, 0, 0, S, S);
  const k = S / 560, seen = G.flags.seen || {};
  g.font = `700 ${11 * k}px "Barlow Condensed",sans-serif`; g.textAlign = 'center';
  for (const R of REGIONS) {
    if (R.river || R.area || !seen[R.id]) continue; const [x, y] = toMap(R.x, R.z, S);
    g.fillStyle = regionColor(R); g.beginPath(); g.arc(x, y, 3 * k, 0, 7); g.fill();
    g.fillStyle = '#000a'; g.fillText(R.name, x + k, y - 5 * k); g.fillStyle = '#efe9dc'; g.fillText(R.name, x, y - 6 * k);
  }
  const at = objAt(); if (at) { const [x, y] = toMap(at.x, at.z, S); g.strokeStyle = '#f0a640'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y, 6 * k, 0, 7); g.stroke(); }
  const [px, py] = toMap(P.x, P.z, S); playerArrow(g, px, py, 1.1 * k);
  $('mapday').textContent = `Day ${G.day} of 100 · ${exploredPct()}% explored`;
}
function playerArrow(g, x, y, k) {
  g.save(); g.translate(x, y); g.rotate(-P.yaw + Math.PI);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(0, -8 * k); g.lineTo(5 * k, 6 * k); g.lineTo(0, 3 * k); g.lineTo(-5 * k, 6 * k); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function objAt() {
  if (rust.state === 'warn' || (rust.state === 'active' && !P.safe)) return nearestShelter();
  if (night.active) return { x: 0, z: CAMP_R };
  return STEPS[G.step]?.at?.() || null;
}
/* minimap: north-up, ~200m around you */
let miniT = 0;
const MINI_R = 200;
function drawMini() {
  if (!mapBase) return;
  const cv = $('minic'), css = cv.clientWidth || 130, S = Math.round(css * Math.min(devicePixelRatio || 1, 2));
  if (cv.width !== S) cv.width = cv.height = S;
  const g = cv.getContext('2d'), sc = MAPPX / (MAPR * 2), half = MINI_R * sc, cx = (P.x / MAPR + 1) / 2 * MAPPX, cz = (P.z / MAPR + 1) / 2 * MAPPX;
  g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
  g.fillStyle = '#0b0f0d'; g.fillRect(0, 0, S, S);
  g.drawImage(mapBase, cx - half, cz - half, half * 2, half * 2, 0, 0, S, S);
  const fs = EXP_N / (MAPR * 2), fh = MINI_R * fs, fx = (P.x / MAPR + 1) / 2 * EXP_N, fz = (P.z / MAPR + 1) / 2 * EXP_N;
  g.drawImage(fogC, fx - fh, fz - fh, fh * 2, fh * 2, 0, 0, S, S);
  const toM = (x, z) => [S / 2 + (x - P.x) / MINI_R * S / 2, S / 2 + (z - P.z) / MINI_R * S / 2], k = S / 130, seen = G.flags.seen || {};
  for (const R of REGIONS) { if (R.river || R.area || !seen[R.id]) continue; const [x, y] = toM(R.x, R.z); if (Math.hypot(x - S / 2, y - S / 2) > S / 2) continue; g.fillStyle = regionColor(R); g.beginPath(); g.arc(x, y, 2.5 * k, 0, 7); g.fill(); }
  const at = objAt();
  if (at) {
    let [x, y] = toM(at.x, at.z); const dx = x - S / 2, dy = y - S / 2, d = Math.hypot(dx, dy), m = S / 2 - 7 * k;
    if (d > m) { x = S / 2 + dx / d * m; y = S / 2 + dy / d * m; }
    g.fillStyle = rust.state === 'warn' || rust.state === 'active' ? '#7fc4b8' : '#f0a640'; g.strokeStyle = '#000'; g.lineWidth = 1.2 * k;
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-3.5 * k, -3.5 * k, 7 * k, 7 * k); g.strokeRect(-3.5 * k, -3.5 * k, 7 * k, 7 * k); g.restore();
  }
  playerArrow(g, S / 2, S / 2, .8 * k);
  g.restore();
}
$('map').addEventListener('click', () => toggleMap());
function toggleMap() { mapOpen = !mapOpen; $('map').classList.toggle('on', mapOpen); if (mapOpen) { if (invOpen) toggleInv(false); drawMap(); } }

/* ================= start ================= */
function startGame(fresh) {
  initAudio();
  const s = !fresh && load();
  Object.assign(UP, { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 }); Object.assign(INV, { scrap: 0, meat: 0, rations: 0, mags: { carbine: 20, battle: 25, hunter: 5 }, res: 60, resH: 15 });
  G.step = 0; G.day = 1; G.tod = .34; G.chapterDone = false; G.flags = {};
  if (s) {
    Object.assign(UP, s.up); Object.assign(INV, s.inv); G.day = s.day; G.chapterDone = s.chapterDone; G.flags = s.flags || {}; P.hp = s.hp ?? 100; P.food = s.food ?? 100;
    G.step = s.step;
    if (G.step === 9) G.step = 8;            // the pod escort restarts from the pod
    if (G.step === 10 || G.step === 11) { G.step = 10; }
    if (G.step >= 12) G.tod = clamp(s.tod, .26, .7); else G.tod = G.step >= 8 ? .58 : G.step >= 5 ? .45 : .36;
    if (G.step === 6) spawnHerd(POI.meadow, 4);
    if (!INV.mags || typeof INV.mags !== 'object') INV.mags = { carbine: 20, battle: 25, hunter: 5 };
  }
  G.flags.seen = G.flags.seen || {}; G.flags.seen.kestrel = 1; INV.rations = INV.rations || 0;
  resetExplore(G.flags.exp); toolSig = '';
  P.slot = 0; selectGunView(RIFLE[UP.rifle].id);
  applyUpgrades();
  gate.hp = gate.max;
  document.body.classList.remove('title'); G.mode = 'play';
  if (!s || G.step === 0) introCine();
  else {
    P.x = SPOTS.vosPost.x + 1.5; P.z = SPOTS.vosPost.z - 3; P.pd = Math.hypot(P.x, P.z); P.yaw = 0; P.pitch = 0;
    if (G.step === 10) { night.prep = 60; G.todTarget = .74; if (named.wren) { named.wren.wander = true; } else { named.wren = spawnNPC('wren', -14, 10, WREN_LOOK(true)); } }
    if (G.step >= 12 && !named.wren) named.wren = spawnNPC('wren', -14, 10, WREN_LOOK(true));
    toast(`Day ${G.day} · Kestrel`, 3);
  }
  if (!isTouch) setTimeout(() => canvas.requestPointerLock?.(), 50);
}
function menu() {
  const s = load();
  $('menu').innerHTML = (s && s.step > 0 ? '<button id="bCont">Continue</button><button class="sec" id="bNew">New game</button>' : '<button id="bNew">Start</button>') + `<button class="sec" id="bMute">Sound: ${muted ? 'off' : 'on'}</button>`;
  $('keys').textContent = isTouch ? 'Left thumb: move (push to the edge to sprint) · right thumb: look · hold the crosshair button to fire · tap the toolbar to switch or eat · tap the minimap for the map · bag for inventory.' : 'WASD move · Shift sprint · mouse look · click fire · right-click aim · R reload · 1–5 toolbar · E use · Space jump/swim · I inventory · M map · F fly · N sound';
  $('bNew').onclick = () => { if (s && s.step > 0 && !confirmNew()) return; try { localStorage.removeItem(SAVE); } catch (e) {} startGame(true); };
  if ($('bCont')) $('bCont').onclick = () => startGame(false);
  $('bMute').onclick = () => { setMute(!muted); $('bMute').textContent = `Sound: ${muted ? 'off' : 'on'}`; };
}
let newArmed = false;
function confirmNew() { if (newArmed) return true; newArmed = true; $('bNew').textContent = 'Tap again to wipe save'; setTimeout(() => { newArmed = false; if ($('bNew')) $('bNew').textContent = 'New game'; }, 2500); return false; }

const WREN_LOOK = wander => ({ model: 'civilian', tint: 0xb8aac8, pack: false, wander });
async function boot() {
  try { await Promise.race([document.fonts.load('900 70px "Big Shoulders Stencil Display"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  setLoad('READING THE RIVER'); await nextFrame();
  prepWater(); prepFlats();
  await buildHeightmap(); H0 = heightAt(0, 0);
  const mp = loadModels(['gun-night', 'gun-desert', 'sniper', 'fp-arms', 'civilian', 'michael', 'elias', 'dropship', 'cliff', 'ammo-crate']);
  await buildTerrain(); buildWater();
  setLoad('UNPACKING THE ARMORY'); await mp;
  setLoad('GROWING THE FOREST'); await nextFrame();
  await buildForest(); buildGrass(); buildMist();
  setLoad('RAISING KESTREL'); await nextFrame();
  buildArc(); buildWall(0); buildGate(); dressGate(0); buildTowers(); dressTowers(0, 0); buildCampProps(); dressSmokehouse(0); buildNearby();
  setLoad('WALKING THE VALLEY'); await nextFrame();
  buildHalvard(); buildBurn(); buildAshmere(); buildLake(); buildLookout(); buildBridge(); buildScoutCamps(); buildRelay(); buildSmoke();
  setLoad('WALKING THE OUTLANDS'); await nextFrame(); buildOutlands();
  await buildFar();
  seedScraps(); seedCrates(); buildRifle(); selectGunView('carbine');
  named.kade = spawnNPC('kade', SPOTS.bench.x + 1.4, SPOTS.bench.z + 1.6, { model: 'civilian', yaw: -2.2, h: 1.8 });
  named.juno = spawnNPC('juno', SPOTS.med.x + 2.6, SPOTS.med.z + 1.4, { model: 'civilian', tint: 0xe0d8cc, yaw: 1, h: 1.7 });
  named.vos = spawnNPC('vos', SPOTS.vosPost.x, SPOTS.vosPost.z, { model: 'elias', yaw: Math.PI, h: 1.86 });
  for (const [x, z] of [[-3, 10], [6, 9], [-12, 4], [2, -2], [18, 18], [-20, 18], [8, 2], [-8, -4], [12, 22]]) spawnNPC('extra', x, z, { wander: true });
  ensureWildlife(); villageGuards();
  await buildMapCanvas(); resetExplore('');
  updTime(0); refreshEnv(G.tod, 0);
  menu();
  requestAnimationFrame(frame);
}
boot();
window.__arc = { G, P, INV, UP, night, rust, ents, gate, startNight, startRust, setStep, skipCine: () => skipCine(), get cine() { return cine; } };
window.__T = { updTerrain, updForest, CLOUDS, FAR_SMOKE, get far() { return { farTerrMesh, horizonMesh, farTrees }; }, scene, cam: camera, heightAt, floorAt, waterAt, THREE, CHUNKS, OCELLS, renderer, useSlot, toggleInv, toggleMap };
