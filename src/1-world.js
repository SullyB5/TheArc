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
const CAMP_R = 64;
const GATE_HALF = 4.7 / CAMP_R;
const riverX = z => 318 + Math.sin(z * .0065) * 46 + Math.sin(z * .019 + 1) * 14;
const POI = {
  pod: { x: 172, z: 158 }, meadow: { x: 98, z: -44 }, village: { x: -196, z: -66 }, vault: { x: -186, z: -206 },
  debris: { x: 0, z: 114 }, halvard: { x: 480, z: 300 }, burn: { x: 400, z: -150 }, ashmere: { x: -420, z: -20 },
  lake: { x: -285, z: 290 }, lookout: { x: -120, z: 430 }, bridge: { x: riverX(236), z: 236 }, relay: { x: -300, z: -320 },
  // the outlands, past the valley rim
  varnhold: { x: 120, z: -1180 }, sunscar: { x: 1480, z: 260 }, elderhollow: { x: 160, z: 1360 },
  cinder: { x: 1300, z: -760 }, watchers: { x: -1340, z: 360 }, varr: { x: -700, z: 1150 }, mirror: { x: -1420, z: -380 },
};
const HOLDS = [
  { id: 'varnhold', name: 'VARNHOLD', sub: 'Hold of the Hollow Pines clan', ...POI.varnhold, R: 40 },
  { id: 'sunscar', name: 'SUNSCAR', sub: 'Hold of the Ridge Runners', ...POI.sunscar, R: 36 },
  { id: 'elderhollow', name: 'ELDERHOLLOW', sub: 'Hold of the Rootkin', ...POI.elderhollow, R: 44 },
];
/* Cinder City: a dead city 840m across, with the Foundry — the district Ironjaw rebuilt — inside it. Other bases out in the wilds. */
const CITY = { x: 1300, z: -760, R: 420 }, FOUNDRY = { x: 1230, z: -700, R: 88 };
const BASES = [
  { id: 'farlight', name: 'FARLIGHT', sub: 'Arc survivors · traders', x: -900, z: -650, R: 44, fac: 'arc' },
  { id: 'greystation', name: 'GREYHOLD STATION', sub: 'Greyhold soldiers', x: -700, z: -1250, R: 50, fac: 'grey', hostile: true },
  { id: 'ironyard_s', name: 'IRONJAW YARD', sub: 'Scavenger fort', x: 820, z: -1180, R: 38, fac: 'iron', hostile: true },
  { id: 'ironyard_e', name: 'RUSTGATE', sub: 'Scavenger fort', x: 1760, z: -180, R: 38, fac: 'iron', hostile: true },
];
const inCity = (x, z, pad = 0) => Math.hypot(x - CITY.x, z - CITY.z) < CITY.R + pad;
const inBase = (x, z, pad = 0) => BASES.some(B => Math.hypot(x - B.x, z - B.z) < B.R + pad);
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
  [[0, 62], [0, 104], [46, 140], [112, 150], [170, 156]],
  [[170, 156], [240, 214], [POI.bridge.x - 42, 236], [POI.bridge.x + 42, 236], [400, 262], [480, 300]],
  [[6, 66], [56, 80], [88, 14], [98, -40], [200, -96], [300, -128], [400, -150]],
  [[-6, 66], [-70, 60], [-118, -14], [-196, -62], [-300, -40], [-420, -20]],
  [[-118, -14], [-150, -128], [-184, -196]],
  [[0, 104], [-60, 160], [-150, 222], [-232, 268]],
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
  addFlat(0, 0, 80, 118);
  addFlat(POI.village.x, POI.village.z, 22, 40);
  addFlat(POI.pod.x, POI.pod.z, 8, 22);
  addFlat(POI.vault.x, POI.vault.z + 12, 10, 22);
  addFlat(POI.halvard.x, POI.halvard.z, 70, 110);
  addFlat(POI.ashmere.x, POI.ashmere.z, 52, 80);
  addFlat(POI.lookout.x, POI.lookout.z, 8, 20);
  for (const s of SHELTERS) addFlat(s.x, s.z, 6, 14);
  for (const s of SCOUTS) addFlat(s.x, s.z, 8, 18);
  for (const H of HOLDS) addFlat(H.x, H.z, H.R + 8, H.R + 40);
  addFlat(CITY.x, CITY.z, CITY.R + 10, CITY.R + 90);
  for (const B of BASES) addFlat(B.x, B.z, B.R + 10, B.R + 50);
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
  { id: 'kestrel', name: 'KESTREL', sub: 'What the Arc left us', x: 0, z: 0, r: 84 },
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
  { id: 'foundry', name: 'THE FOUNDRY', sub: 'Ironjaw rebuilt this district · the best loot in the land', x: FOUNDRY.x, z: FOUNDRY.z, r: FOUNDRY.R + 20, hostile: true, base: true },
  { id: 'cinder', name: 'CINDER CITY', sub: 'A dead city · scavengers in the towers', x: CITY.x, z: CITY.z, r: CITY.R + 20 },
  ...BASES.map(B => ({ id: B.id, name: B.name, sub: B.sub, x: B.x, z: B.z, r: B.R + 40, hostile: B.hostile, base: true, friend: !B.hostile })),
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
