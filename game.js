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
import { mergeGeometries } from './vendor/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from './vendor/jsm/utils/SkeletonUtils.js';
import { clone as skClone } from './vendor/jsm/utils/SkeletonUtils.js';

/* ---------- atmosphere: height fog with aerial perspective (replaces three's flat linear fog everywhere) ----------
   fog.near = where haze starts, fog.far = the distance that's ~95% hazed at valley-floor height. The haze thins with altitude,
   so ridges and peaks stand out above the murk in the low ground — that's what sells the distance. */
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogDepth = - mvPosition.z;\nvFogWorld = (inverse(viewMatrix) * mvPosition).xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\nuniform float fogNear;\nuniform float fogFar;\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fogWallU = floor(fogNear / 1000.0), fogWall = fogWallU * 10.0;   // view-distance wall, packed into fogNear (see packFogNear)
  float fogCamD = length(vFogWorld - cameraPosition);
  float fogDist = max(0.0, fogCamD - (fogNear - fogWallU * 1000.0));
  float fogHy = max(0.0, (vFogWorld.y + cameraPosition.y) * .5 - 12.0);
  float fogDen = (3.0 / max(fogFar, 1.0)) * (.2 + .8 * exp(-fogHy * .0055));
  float fogFactor = 1.0 - exp(-fogDist * fogDen);
  if (fogWall > 0.0) fogFactor = max(fogFactor, smoothstep(fogWall * .72, fogWall, fogCamD));   // nothing shows past the view distance, peaks included
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
#endif`;

const $ = id => document.getElementById(id);
const packFogNear = near => near + (VIEW_M > 0 ? Math.round(VIEW_M / 10) * 1000 : 0);
/* controls follow the device: phones/tablets get touch controls, computers get keyboard + mouse — even touchscreen laptops. */
const isTouch = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  || (matchMedia('(pointer:coarse)').matches && !matchMedia('(any-pointer:fine)').matches);
try { localStorage.removeItem('arc-controls'); } catch (e) {}   // clear the old title-screen override
const LOW = isTouch;                       // phones: fewer trees/grass, smaller textures, cheaper post
/* ---------- graphics settings (Nov 10): Textures low/med/high and View distance near/med/far/max, saved in localStorage.
   Textures apply on load (the page reloads when you change them); view distance applies live.
   View distance is a hard limit: past it everything sits inside the fog wall, and terrain, forest, props and districts
   past it aren't built or drawn — the GPU only works on what you can actually see. */
const TEX_LEVELS = { low: { label: 'Low', cap: 512, capD: 256, aniso: 2, file: 'phone' }, med: { label: 'Medium', cap: 1024, capD: 512, aniso: 4, file: 'pc' }, high: { label: 'High', cap: 0, capD: 0, aniso: 8, file: 'pc' } };
const VIEW_LEVELS = { near: { label: 'Near', m: 300, haze: 1 }, med: { label: 'Medium', m: 450, haze: .7 }, far: { label: 'Far', m: 700, haze: .4 }, max: { label: 'Max', m: 0, haze: 0 } };
const GFX = (() => {
  let o = {}; try { o = JSON.parse(localStorage.getItem('arc-gfx')) || {}; } catch (e) {}
  const q = new URLSearchParams(location.search), t = q.get('tex') || o.tex, v = q.get('view') || o.view;
  return { tex: TEX_LEVELS[t] ? t : (LOW ? 'low' : 'high'), view: VIEW_LEVELS[v] ? v : (LOW ? 'med' : 'far') };
})();
function saveGfx() { try { localStorage.setItem('arc-gfx', JSON.stringify(GFX)); } catch (e) {} }
const TEXQ = TEX_LEVELS[GFX.tex];
let VIEW_M = VIEW_LEVELS[GFX.view].m;            // 0 = no limit
const SFX = TEXQ.file;
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
   lander came down. West: the Thorn outpost, then Ashmere, the Thornkin stronghold. Lake Ilse sits just outside the gate, to the west. South-west: the dropsite, where you come to. South: the fire
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
  lake: { x: -36, z: 94 }, dropsite: { x: -268, z: 282 }, arches: { x: -66, z: -206 }, lookout: { x: -120, z: 430 }, bridge: { x: riverX(236), z: 236 }, relay: { x: -300, z: -320 },
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
const LAKES = [{ x: POI.lake.x, z: POI.lake.z, R: 25, L: 0, near: true, wob: .2 }, { x: POI.varr.x, z: POI.varr.z, R: 150, L: 0 }, { x: POI.mirror.x, z: POI.mirror.z, R: 105, L: 0 }];
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
function lakeRw(L, x, z) { const a = Math.atan2(z - L.z, x - L.x); return L.R * (1 + (vnoise(Math.cos(a) * 2 + 5 + L.x * .01, Math.sin(a) * 2) - .5) * (L.wob ?? .4)); }
function lakeCut(L, x, z, h) { const ld = Math.hypot(x - L.x, z - L.z); if (ld > L.R * 3) return h; const Rw = lakeRw(L, x, z), hc = ld < Rw ? L.L - .5 - 5 * (1 - (ld / Rw) ** 2) : L.L - .5 + (ld - Rw) * .45; return hc < h ? hc : h; }
function riverWL(z) { const f = clamp((z - RIV_Z0) / RIV_STEP, 0, RIV_N - 1.001), i = Math.floor(f); return lerp(RIVWL[i], RIVWL[i + 1], f - i); }
function carved(x, z) {
  let h = rawH(x, z);
  const dr = Math.abs(x - riverX(z));
  // inside the valley the gorge stops 150m out (as built); out past the rim it cuts a full valley through the hills
  const cap = 150 + 600 * smooth(560, 780, Math.hypot(x, z));
  if (dr < cap) { const wl = riverWL(z); const hc = dr < RIV_HW ? wl - .4 - 2.1 * (1 - (dr / RIV_HW) ** 2) : wl - .4 + (dr - RIV_HW) * .55; if (hc < h) h = dr < 150 ? hc : lerp(h, hc, 1 - smooth(cap * .8, cap, dr)); }
  for (const L of LAKES) if (!L.near) h = lakeCut(L, x, z, h);   // the near lake (Lake Ilse, by the gate) is cut after the camp is levelled
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
  for (const L of LAKES) if (!L.near) { let m = 1e9; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; m = Math.min(m, rawH(L.x + Math.cos(a) * L.R * 1.24, L.z + Math.sin(a) * L.R * 1.24)); } L.L = m - 1.6; }
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
function flatH(x, z) {
  let h = carved(x, z);
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r1) h = f.h + (h - f.h) * smooth(f.r0, f.r1, d); }
  return h;
}
function fullH(x, z) {
  let h = flatH(x, z);
  for (const L of LAKES) if (L.near) h = lakeCut(L, x, z, h);
  return h;
}
/* the near lake sits in the levelled ground in front of the gate, so its level comes from that ground */
function prepNearLakes() {
  for (const L of LAKES) if (L.near) { let m = 1e9; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; m = Math.min(m, flatH(L.x + Math.cos(a) * L.R * 1.24, L.z + Math.sin(a) * L.R * 1.24)); } L.L = m - 1.1; }
  LAKE_L = LAKES[0].L;
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
  addFlat(POI.arches.x, POI.arches.z, 20, 42);                                       // the Old Arches, on the hill behind the Arc
  addFlat(POI.dropsite.x, POI.dropsite.z, 34, 60);                                  // the dropsite: open, level ground to build on
  prepNearLakes();
}

/* ---------- renderer / scene / post ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.35 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;            // PCF (not PCF-soft): about half the shadow cost per pixel, edges still filtered
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
  // tone mapping (ACES) + sRGB happen here too (three puts those functions + toneMappingExposure in every shader's prefix),
  // so the separate OutputPass — a whole extra full-screen pass — is gone
  fragmentShader: `uniform sampler2D tDiffuse;uniform float t,contrast,sat,vig,grain,fringe,lift,gain,hurt;uniform vec2 res;uniform vec3 shadow,high;varying vec2 vUv;
    vec3 om(vec3 c){return sRGBTransferOETF(vec4(ACESFilmicToneMapping(c),1.0)).rgb;}
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec2 d=vUv-.5;float r2=dot(d,d);vec2 o=d*fringe*r2*4.0;
      vec3 c=om(vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b));
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
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, rust: { value: 0 }, fogC: { value: new THREE.Color() }, haze: { value: VIEW_LEVELS[GFX.view].haze } };
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol,fogC; uniform float rust,haze; varying vec3 vP;
    void main(){ float h = max(vP.y,0.); vec3 c = mix(hor, top, pow(h,.45)); c = mix(fogC, c, smoothstep(-.02, .16 + haze * .22, vP.y));
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
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = TEXQ.aniso;
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
  { id: 'lake', name: 'LAKE ILSE', sub: 'Still water, a stone’s throw from the gate', x: POI.lake.x, z: POI.lake.z, r: 34 },
  { id: 'dropsite', name: 'THE DROPSITE', sub: 'A piece of the Arc, torn off on the way down · where you woke', x: POI.dropsite.x, z: POI.dropsite.z, r: 60 },
  { id: 'lookout', name: 'SOUTH LOOKOUT', sub: 'A fire tower on the ridge', x: POI.lookout.x, z: POI.lookout.z, r: 35 },
  { id: 'arches', name: 'THE OLD ARCHES', sub: 'Older than the city · something is buried under them', x: POI.arches.x, z: POI.arches.z, r: 40 },
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
const CLIPS = {};                                      // animations that came with a model (the rigged animals)
/* phones: the model kit's textures are mostly 1024² (some 2048²) — ~640 MB on the GPU plus Safari's decoded copy, more than an
   iPhone tab is allowed, so iOS kills the page while it loads. Redraw every model texture at most TEX_CAP (detail maps TEX_CAP_DETAIL) wide before it's uploaded
   (a quarter of the memory per step down) and let the full-size original go. */
const TEX_CAP = TEXQ.cap, TEX_CAP_DETAIL = TEXQ.capD, SHRUNK = new WeakSet();   // colour maps keep 512; normal/roughness/metal/AO maps drop to 256
function shrinkTextures(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      for (const k in m) {
        const t = m[k]; if (!t || !t.isTexture || SHRUNK.has(t)) continue; SHRUNK.add(t);
        const cap = k === 'map' || k === 'emissiveMap' ? TEX_CAP : TEX_CAP_DETAIL;
        const img = t.image, w = img && img.width, h = img && img.height;
        if (!w || !h || Math.max(w, h) <= cap) continue;
        const s = cap / Math.max(w, h), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); } catch (e) { continue; }
        if (img.close) img.close();                                   // ImageBitmap: free it now rather than at GC
        t.image = c; t.needsUpdate = true;
      }
    }
  });
}
async function loadModels(names, quiet) {
  let done = 0;
  await Promise.all(names.map(n => gltf.loadAsync(`assets/models/${n}.glb`).then(g => {
    if (TEX_CAP) shrinkTextures(g.scene);
    MODELS[n] = g.scene; if (g.animations && g.animations.length) { MODELS[n + ':anims'] = g.animations; CLIPS[n] = g.animations; } done++; if (!quiet) setLoad(`UNPACKING THE ARMORY ${done}/${names.length}`);
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
  sand: C_('#8a7d64'), ash: C_('#2c2723'), street: C_('#3e3d3b'), concrete: C_('#7a7670') };
function terrainColor(x, z, h, sl, out) {
  out.copy(TC.grass).lerp(TC.grass2, fbm(x * .05, z * .05)).lerp(TC.forest, smooth(.45, .7, fbm(x * .012 + 40, z * .012)) * .8);
  out.lerp(TC.rock, smooth(.7, 1.3, sl));
  // the snowline sits low on the valley's own mountain but climbs out in the outlands, so the big ranges show rock and forest below their caps
  const snowL = lerp(122, 620, smooth(800, 1700, Math.hypot(x, z)));
  out.lerp(TC.snow, smooth(snowL, snowL + 28 + snowL * .08, h + fbm(x * .05, z * .05) * (14 + snowL * .1)) * (1 - smooth(1.2, 1.8, sl) * (snowL > 200 ? .8 : .5)));
  const w = waterAt(x, z); if (w > -1e8) out.lerp(TC.sand, (1 - smooth(.2, 2.2, h - w)) * .85);
  const pd = pathDist(x, z); out.lerp(TC.dirt, (1 - smooth(1.8, 4.2, pd)) * .9);
  const cd = Math.hypot(x, z); out.lerp(TC.mud, (1 - smooth(CAMP_R - 14, CAMP_R + 6, cd)) * .55); if (cd < CAMP_R + 4) out.lerp(TC.dirt, (1 - smooth(-.5, 3, streetDist(x, z))) * .8);
  for (const p of [POI.village, POI.ashmere]) { const vd = Math.hypot(x - p.x, z - p.z); out.lerp(TC.dirt, (1 - smooth(14, 30, vd)) * .7); }
  const hd = Math.hypot(x - POI.halvard.x, z - POI.halvard.z); if (hd < 90) { const gx = Math.abs(((x - POI.halvard.x) % 26 + 26) % 26 - 13), gz = Math.abs(((z - POI.halvard.z) % 26 + 26) % 26 - 13); if (Math.min(gx, gz) > 9.5 && hd < 75) out.lerp(TC.street, .8); }
  const cd2 = Math.hypot(x - CITY.x, z - CITY.z);
  if (cd2 < CITY.R + 40) {                      // the city: cracked asphalt streets on a 44m grid, concrete and rubble between
    const k = 1 - smooth(CITY.R - 20, CITY.R + 40, cd2), gx = Math.abs(((x - CITY.x) % 44 + 44) % 44 - 22), gz = Math.abs(((z - CITY.z) % 44 + 44) % 44 - 22);
    out.lerp(TC.concrete, k * .85); if (Math.max(gx, gz) > 17) out.lerp(TC.street, k * .9); if (fbm(x * .08, z * .08) > .62) out.lerp(TC.grass2, k * .5);
  }
  for (const B of BASES) { const bd = Math.hypot(x - B.x, z - B.z); out.lerp(TC.dirt, (1 - smooth(B.R - 6, B.R + 14, bd)) * .8); }
  for (const s of SCORCH) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r) out.lerp(TC.ash, (1 - d / s.r) * .85); }
  out.multiplyScalar(.92 + hash(x * .7, z * .7) * .16);
  return out;
}
const slopeAt = (x, z) => { const h = heightAt(x, z); return Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5; };
/* streamed: only the chunks near you exist; new ones are built a few rows per frame so walking never hitches */
const CH = 160, NCH = Math.ceil(HALF * 2 / CH), TSEG = LOW ? 40 : 64;
let terrMat = null, terrIdx = null, chunkJob = null;
const CHUNKS = new Map();
let T_LOAD = 470, T_DROP = 700;   // set from the view distance (setViewDist)
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
  if (Math.hypot(x, z) < CAMP_R + 12) return false;
  if (envKeepClear(x, z)) return false;
  if (Math.hypot(x - 80, z + 36) < 18 || Math.hypot(x + 80, z + 24) < 14) return false;   // the fallen side modules
  if (pathDist(x, z) < 5.5) return false;
  if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30) || OUT_MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 45)) return false;
  if (HOLDS.some(H => Math.hypot(x - H.x, z - H.z) < H.R + 14)) return false;
  if (inCity(x, z, 30) || inBase(x, z, 14)) return false;
  for (const p of [[POI.watchers, 30]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
  for (const p of [[POI.village, 34], [POI.pod, 18], [POI.halvard, 96], [POI.ashmere, 62], [POI.burn, 64], [POI.lookout, 14], [POI.dropsite, 40], [POI.lake, LAKES[0].R + 6]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
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
      const hid = xClear(x, z);   // (Nov 11) a new place stands here: grow the tree (same random numbers) but don't draw it
      (K.list[b] ||= []).push([hid ? X_HIDE : dummy.matrix.clone(), tint.setHSL(rr(.27, .36), rr(.1, .3), rr(.75, 1.05)).clone()]);
      if (!hid) { addCol(x, z, (K === kinds[0] ? .45 : .3) * s); addRes(['fir', 'alder', 'snag'][kinds.indexOf(K)], x, z, s); }
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
    const hid = xClear(x, z);
    rocks.setMatrixAt(i, hid ? X_HIDE : dummy.matrix);
    if (!hid) { if (s > 1) addCol(x, z, s * 1.1); addRes(s > 1 ? 'boulder' : 'stone', x, z, s); }
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
      if (xClear(x, z)) c.visible = false; else addCol(x, z, s * .38); placed++;
    }
  }
  // undergrowth (no collision)
  const fern = merge([{ geo: new THREE.ConeGeometry(.6, .7, 5), m: tm(0, .3, 0), color: 0x34502a, color2: 0x5a7a3a }, { geo: new THREE.ConeGeometry(.4, .9, 4), m: tm(.3, .4, .2, .3), color: 0x3c5a2e, color2: 0x62843e }], .1);
  const ferns = new THREE.InstancedMesh(fern, VCOL, LOW ? 1800 : 4000);
  for (let i = 0; i < ferns.count; i++) {
    const x = rr(-VALLEY, VALLEY), z = rr(-VALLEY, VALLEY);
    if (pathDist(x, z) < 3 || Math.hypot(x, z) < CAMP_R + 2 || waterAt(x, z) > heightAt(x, z) - .4) { i--; continue; }
    const s = rr(.6, 1.5); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
    ferns.setMatrixAt(i, dummy.matrix); addRes('fern', x, z, s);
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
  const inner = (x, z) => Math.hypot(x, z) < VALLEY + 140 || Math.hypot(x, z) > WORLD + 60 || inCity(x, z, 20) || inBase(x, z, 10);
  const K = [[LOW ? 400 : 680, []], [LOW ? 45 : 90, []], [12, []]];
  K.forEach(([tries, L], ki) => {
    for (let t = 0; t < tries; t++) {
      const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z)) continue;
      const dens = fbm(x * .018 + 5, z * .018 + 11);
      if (ki === 1 ? (dens > .55 || R() > .5) : R() > smooth(.3, .6, dens) + .14) continue;
      if (ki === 1 && waterAt(x, z) < -1e8 && Math.abs(x - riverX(z)) > 60 && LAKES.every(L => Math.hypot(x - L.x, z - L.z) > L.R + 56) && R() < .7) continue;
      if (!treeOK(x, z) || xClear(x, z)) continue;
      const s = ki === 0 ? lerp(.85, 1.3, R()) : lerp(.8, 1.2, R()), sy = ki === 0 ? lerp(1.2, 2.1, R()) : lerp(.9, 1.3, R());
      dummy.position.set(x, heightAt(x, z) - .25, z); dummy.rotation.set((R() - .5) * .08, R() * 6, (R() - .5) * .08); dummy.scale.set(s, sy, s); dummy.updateMatrix();
      L.push([dummy.matrix.clone(), tint.setHSL(lerp(.27, .36, R()), lerp(.1, .3, R()), lerp(.75, 1.05, R())).clone()]);
      if (cols) { addCol(x, z, (ki === 0 ? .45 : .3) * s); addRes(['fir', 'alder', 'snag'][ki], x, z, s); }
    }
    if (!L.length) return;
    const im = new THREE.InstancedMesh(OGEO[ki], TREEMAT, L.length);
    L.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  });
  const rocks = [], ferns = [];
  for (let t = 0; t < 20; t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 4 || waterAt(x, z) > heightAt(x, z) - .4 || xClear(x, z)) continue;
    const s = R() < .12 ? lerp(2, 4.5, R()) : lerp(.4, 1.4, R());
    dummy.position.set(x, heightAt(x, z) + s * .2, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(s * lerp(1, 1.6, R()), s * lerp(.6, 1, R()), s); dummy.updateMatrix();
    rocks.push(dummy.matrix.clone()); if (cols && s > 1) addCol(x, z, s * 1.1); if (cols) addRes(s > 1 ? 'boulder' : 'stone', x, z, s);
  }
  for (let t = 0; t < (LOW ? 40 : 90); t++) {
    const x = x0 + R() * CELL_T, z = z0 + R() * CELL_T; if (inner(x, z) || pathDist(x, z) < 3 || waterAt(x, z) > heightAt(x, z) - .4) continue;
    const s = lerp(.6, 1.5, R()); dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); ferns.push(dummy.matrix.clone()); if (cols) addRes('fern', x, z, s);
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
let FOR_SHOW = 430, FOR_DROP = 900;
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
    const cd = Math.hypot(x, z); if (cd < CAMP_R - 2 && (hx > .35 || streetDist(x, z) < .8 || inHull(x, z))) continue;
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
/* the Arc: the main hull, walk-in. One big blast door faces the yard; inside there's a deck, a ramp up to a catwalk along
   the south wall, and a firing slit the whole length — the place you fall back to when the walls go.
   (Nov 10) It came down hard and it looks it: the skin is dented and wavy, the roof has settled flatter in places, ribs are
   bent or snapped, and it's patched in mismatched plate. The east end doesn't stop: the hull carries on through a buckled
   joint into the east wing, which bends round to the south (to your right as you face the door) — walk-in too, part of the
   holdout. The two side modules came down outside the wall; the spire stuck nose-first behind the hull. */
const ARC = { x: 0, z: -36, R: 11, LW: 36, LE: 24, C: 4.5, W: 10, DOOR: 4.2, WALK: 7.5, SLIT0: 8.2, SLIT1: 9.7 };
// the east wing's centreline: out of the east end, a short neck, a bend round to the south, then straight on
const WING = (() => {
  const R = 9, C = 3.4, W = Math.sqrt(R * R - C * C), Rb = 12.5, TH = 1.25, NECK = 2.5, LS = 9;
  const x0 = ARC.x + ARC.LE, z0 = ARC.z, pts = [];
  let s = 0;
  const push = (x, z, tx, tz) => { const q = pts[pts.length - 1]; if (q) s += Math.hypot(x - q.x, z - q.z); pts.push({ x, z, tx, tz, nx: -tz, nz: tx, s }); };
  for (let d = 0; d < NECK; d += .5) push(x0 + d, z0, 1, 0);
  const cx = x0 + NECK, cz = z0 + Rb, na = Math.ceil(TH * Rb / .5);
  for (let i = 0; i < na; i++) { const a = i / na * TH; push(cx + Rb * Math.sin(a), cz - Rb * Math.cos(a), Math.cos(a), Math.sin(a)); }
  const ex = cx + Rb * Math.sin(TH), ez = cz - Rb * Math.cos(TH), tx = Math.cos(TH), tz = Math.sin(TH);
  for (let d = 0; d <= LS + 1e-6; d += .5) push(ex + tx * d, ez + tz * d, tx, tz);
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (const p of pts) for (const k of [-1, 1]) { const x = p.x + p.nx * k * (W + 1), z = p.z + p.nz * k * (W + 1); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  return { R, C, W, pts, len: s, end: pts[pts.length - 1], bx0, bx1, bz0, bz1 };
})();
function inWing(x, z) {
  if (x < ARC.x + ARC.LE - .2 || x > WING.bx1 || z < WING.bz0 || z > WING.bz1) return false;
  const P = WING.pts; let bd = 1e9, bi = 0;
  for (let i = 0; i < P.length; i++) { const d = (x - P[i].x) ** 2 + (z - P[i].z) ** 2; if (d < bd) { bd = d; bi = i; } }
  const p = P[bi], ax = x - p.x, az = z - p.z, along = ax * p.tx + az * p.tz;
  if ((bi === P.length - 1 && along > 0) || (bi === 0 && along < -.2)) return false;
  return Math.abs(ax * p.nx + az * p.nz) < WING.W + .3;
}
const ARC_CORE = { x: ARC.x + 14, z: ARC.z - 5 };
const hullDoor = { open: true, hp: 520, max: 520, t: 1 };
let hullDoors = [];
const inHull = (x, z) => (x - ARC.x > -ARC.LW && x - ARC.x < ARC.LE && Math.abs(z - ARC.z) < ARC.W + .3) || inWing(x, z);
const ARC_DOOR_OUT = { x: ARC.x, z: ARC.z + ARC.W + 2.6 }, ARC_DOOR_IN = { x: ARC.x, z: ARC.z + ARC.W - 3 };
function hullCollide(o, rad) {
  const lx = o.x - ARC.x, lz = o.z - ARC.z, Wd = ARC.W + .3;
  if (Math.abs(lx) < ARC.DOOR + .2 && Math.abs(lz - Wd) < rad + .35 && !(hullDoor.open || hullDoor.hp <= 0)) {
    const inside = (o.phz ?? lz) < Wd;
    o.z = ARC.z + (inside ? Wd - rad - .35 : Wd + rad + .35);
  }
  o.phz = o.z - ARC.z;
}
// the hull's own random stream, so reshaping it never moves anything else in the world
let ARC_S = 90210;
const arnd = () => (ARC_S = (ARC_S * 16807) % 2147483647, (ARC_S - 1) / 2147483646), arr = (a, b) => a + arnd() * (b - a), apick = a => a[Math.floor(arnd() * a.length)];
/* how far the skin sits off a true cylinder at (x along the hull, direction sy = sin θ up, sz = cos θ south): the roof has
   settled flatter and wavy, the north side and roof are dented; the low south wall (door, slit, catwalk) stays true, and
   the ends ease back to round so the bulkheads still fit */
const HULL_DENTS = [];
function hullOff(x, sy, sz) {
  const h = ARC.C + ARC.R * sy, th = Math.atan2(sy, sz);
  const ends = smooth(-ARC.LW, -ARC.LW + 5, x) * smooth(ARC.LE, ARC.LE - 4, x);
  const roof = smooth(ARC.SLIT1 + .6, ARC.SLIT1 + 3.2, h), north = sz < 0 ? smooth(1.2, 4, h) * smooth(0, -.35, sz) : 0;
  let o = -.75 * Math.max(0, sy) ** 4 * (.55 + .45 * Math.sin(x * .07 + 1.3));
  o += .26 * Math.sin(x * .11 + th * 2.1) + .13 * Math.sin(x * .29 - th * 3.7);
  o -= 1.1 * Math.max(0, sy) ** 2 * (.5 + .5 * Math.sin(x * .05 - .4));          // the roofline sags in long stretches
  o += .45 * Math.max(0, sy) * -sz;                                              // and leans a little to the north
  for (const xc of [-14.5, 8.5]) o -= .5 * Math.exp(-(((x - xc) / .9) ** 2));      // two creases where it buckled on impact
  for (const D of HULL_DENTS) { const dx = x - D.x, da = (th - D.a) * ARC.R; o -= D.d * Math.exp(-(dx * dx + da * da) / (D.r * D.r)); }
  return o * Math.max(roof, north * .6) * ends + .05 * Math.sin(x * 1.9 + th * 7) * ends;
}
// push every vertex of a geometry (in the hull's frame) off true by hullOff
function hullDent(geo, scale = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z); if (r < 1) continue; const k = (r + hullOff(x, y / r, z / r) * scale) / r; p.setY(i, y * k); p.setZ(i, z * k); }
  p.needsUpdate = true; geo.computeVertexNormals(); return geo;
}
function hullShell(t0, t1, x0, x1, mat, rOff = 0) {
  const geo = new THREE.CylinderGeometry(ARC.R + rOff, ARC.R + rOff, x1 - x0, Math.max(3, Math.ceil((t1 - t0) * 9)), Math.max(1, Math.ceil((x1 - x0) / 1.5)), true, t0, t1 - t0);
  geo.rotateZ(Math.PI / 2); geo.translate((x0 + x1) / 2, 0, 0); hullDent(geo);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
}
// the wing's skin off true: same idea, along the bend (s = metres along the centreline, phi = angle round from the floor)
const WING_DENTS = [];
function wingOff(s, phi) {
  const h = WING.C + WING.R * Math.sin(phi), ends = smooth(0, 4, s) * smooth(WING.len, WING.len - 3, s), roof = smooth(5.5, 9.5, h);
  let o = -.6 * Math.max(0, Math.sin(phi)) ** 4 * (.5 + .5 * Math.sin(s * .13 + .4)) + .22 * Math.sin(s * .17 + phi * 2.3) + .1 * Math.sin(s * .41 - phi * 3.1);
  for (const D of WING_DENTS) { const ds = s - D.s, da = (phi - D.a) * WING.R; o -= D.d * Math.exp(-(ds * ds + da * da) / (D.r * D.r)); }
  return o * roof * ends + .05 * Math.sin(s * 2.1 + phi * 6) * ends;
}
// a sheet that follows the wing's skin: rOff out from it, between angles phi0..phi1, from s0 to s1 along it
function wingSkin(rOff, phi0, phi1, s0 = 0, s1 = WING.len, nphi = 40) {
  const P = WING.pts.filter(p => p.s >= s0 - 1e-6 && p.s <= s1 + 1e-6), pos = [], uv = [], idx = [];
  for (const p of P) for (let j = 0; j <= nphi; j++) {
    const ph = lerp(phi0, phi1, j / nphi), r = WING.R + rOff + wingOff(p.s, ph), c = Math.cos(ph) * r;
    pos.push(p.x + p.nx * c, WING.C + Math.sin(ph) * r, p.z + p.nz * c); uv.push(p.s / 5, ph * WING.R / 5);
  }
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < nphi; j++) { const a = i * (nphi + 1) + j, b = a + nphi + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildArc() {
  const g = new THREE.Group(); g.position.set(ARC.x, H0 + ARC.C, ARC.z); world.add(g);
  const R = ARC.R, LW = ARC.LW, LE = ARC.LE, C = ARC.C;
  for (let i = 0; i < 8; i++) HULL_DENTS.push({ x: arr(-LW + 6, LE - 5), a: arr(.95, 2.6), r: arr(1.6, 3.2), d: arr(.35, .9) });
  for (let i = 0; i < 4; i++) WING_DENTS.push({ s: arr(5, WING.len - 4), a: arr(.9, 2.3), r: arr(1.5, 2.8), d: arr(.3, .8) });
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set((LW + LE) / 5, 5);
  const hullMat = new THREE.MeshStandardMaterial({ map: t, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xc4c2bb, metalness: .45, roughness: .62, side: THREE.DoubleSide });
  // angles: world z = R cos θ (south = 0), y = R sin θ (top = π/2)
  const tFloor = -Math.asin(C / R), tDoor = Math.asin((6.6 - C) / R), tS0 = Math.asin((ARC.SLIT0 - C) / R), tS1 = Math.asin((ARC.SLIT1 - C) / R);
  g.add(hullShell(tS1, Math.PI * 2 + tFloor, -LW, LE, hullMat));             // roof, north wall
  g.add(hullShell(tDoor, tS0, -LW, LE, hullMat));                            // band between the door and the slit
  g.add(hullShell(tFloor, tDoor, -LW, -ARC.DOOR, hullMat));                  // south wall, either side of the door
  g.add(hullShell(tFloor, tDoor, ARC.DOOR, LE, hullMat));
  // patches: plate welded over the holes, none of it matching — primer, bare steel, rust, a scorched stretch
  const patchM = [0x8a5a44, 0x6e7276, 0x9a948a, 0x5a5e58, 0xa8a49a, 0x7a4a36].map(c => new THREE.MeshStandardMaterial({ map: TX.metal, color: c, metalness: .45, roughness: .7 }));
  const scorch = new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x3a3631, metalness: .3, roughness: .92 });
  for (let i = 0; i < 16; i++) {
    const w = arr(1.6, 4.5), x = arr(-LW + 2, LE - 2 - w), south = arnd() < .3, a0 = south ? arr(tS1 + .04, 1.2) : arr(.9, 3.1), da = arr(.12, .38);
    g.add(hullShell(a0, a0 + da, x, x + w, apick(patchM), .05 + i * .002));
  }
  g.add(hullShell(1.7, 2.6, 8, 19, scorch, .04)); g.add(hullShell(.6, 1.15, -31, -24, scorch, .045));
  // the slit: posts every few metres, and a dark lip
  for (let x = -LW + 2; x < LE - 1; x += 3.2) { const y = (ARC.SLIT0 + ARC.SLIT1) / 2 - C; mesh(new THREE.BoxGeometry(.35, ARC.SLIT1 - ARC.SLIT0 + .3, .5), S(0x55554f, { metalness: .5 }), x, y, Math.sqrt(R * R - y * y), g); }
  // west bulkhead: a disc with a sealed hatch
  { const cap = mesh(new THREE.CircleGeometry(R, 44), S(0x6d6e6c, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), -LW, 0, 0, g); cap.rotation.y = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(R * .42, .35, 6, 18), M(0x3a3a38), -(LW + .3), -R * .1, 0, g); ring.rotation.y = Math.PI / 2;
    mesh(new THREE.CircleGeometry(R * .4, 18), M(0x2a2a28, { side: THREE.DoubleSide }), -(LW + .25), -R * .1, 0, g).rotation.y = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mesh(new THREE.BoxGeometry(.4, .6, .6), M(0x55585a), -(LW + .45), -R * .1 + Math.sin(a) * R * .42, Math.cos(a) * R * .42, g); } }
  // east end: a bulkhead ring round the opening into the wing, and a buckled collar where the two sections meet
  { const sh = new THREE.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, WING.C - C, WING.R + .05, 0, Math.PI * 2, true); sh.holes.push(hole);
    const cap = mesh(new THREE.ShapeGeometry(sh, 40), S(0x6d6e6c, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), LE, 0, 0, g); cap.rotation.y = Math.PI / 2;
    for (const [dx, r, th] of [[.15, WING.R + .25, .45], [1.4, WING.R + .55, .6], [2.4, WING.R + .35, .4]]) {
      const tg = new THREE.TorusGeometry(r, th, 6, 40); const pa = tg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const a = Math.atan2(pa.getY(i), pa.getX(i)); pa.setZ(i, pa.getZ(i) + Math.sin(a * 3 + dx) * .25); }
      tg.computeVertexNormals(); const col = mesh(tg, S(dx > 1 ? 0x8a8478 : 0x4a4a46, { map: TX.metal, metalness: .55 }), LE + dx, WING.C - C, 0, g); col.rotation.y = Math.PI / 2; col.rotation.x = arr(-.05, .05);
    } }
  // ribs outside: bent with the skin, a couple missing, a couple snapped off short; fins on the ones still whole
  const ribM = S(0xd8d8d0, { metalness: .5, roughness: .45 });
  for (let x0 = -LW + 3; x0 < LE - 1.5; x0 += 6) {
    if (arnd() < .1) continue;
    const x = x0 + arr(-.8, .8), broken = arnd() < .22, arc = broken ? Math.PI * arr(.4, .72) : Math.PI;
    const tg = new THREE.TorusGeometry(R + .5 + arr(-.1, .15), .4, 5, 24, arc);
    if (broken && arnd() < .5) tg.rotateZ(Math.PI - arc);
    tg.rotateY(Math.PI / 2); tg.rotateX(arr(-.04, .04)); tg.translate(x, 0, 0); hullDent(tg);
    mesh(tg, ribM, 0, 0, 0, g);
    if (!broken) { const fin = mesh(new THREE.BoxGeometry(.45, 3.4, 1.1), ribM, x, R + 2 + hullOff(x, 1, 0), 0, g); fin.rotation.z = arr(-.3, .3); fin.rotation.x = arr(-.12, .12); }
  }
  for (let i = 0; i < 6; i++) { const x = arr(-LW * .8, LE * .8); const p = mesh(new THREE.BoxGeometry(arr(6, 11), .5, arr(6, 9)), M(0x8e9294), x, R + .3 + hullOff(x, 1, 0), arr(-2.5, 2.5), g); p.rotation.set(arr(-.35, .35), arnd(), arr(-.3, .3)); }
  // door frame + "ARC" stencil over it
  const fr = S(0x3c3d3e, { metalness: .6 });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.6, 6.9, 1.2), fr, s * (ARC.DOOR + .3), 6.9 / 2 - C, Math.sqrt(R * R - 1) - .2, g);
  mesh(new THREE.BoxGeometry(ARC.DOOR * 2 + 1.2, .6, 1.4), fr, 0, 6.7 - C, Math.cos(tDoor) * R - .1, g);
  for (let i = 0; i < 10; i++) mesh(new THREE.BoxGeometry(.6, .5, .08), M(i % 2 ? 0x1a1a1a : 0xd9a32a), -ARC.DOOR + .4 + i * .85, 7.2 - C, Math.cos(Math.asin((7.2 - C) / R)) * R + .05, g);
  { const sy = (12.4 - C) / R, sz = Math.sqrt(1 - sy * sy), rs = R + hullOff(0, sy, sz);
    const arcSign = mesh(new THREE.BoxGeometry(9, 1.6, .15), [M(0x2a2826), M(0x2a2826), M(0x2a2826), M(0x2a2826), new THREE.MeshLambertMaterial({ map: signTex('THE ARC') }), M(0x2a2826)], 0, rs * sy, rs * sz + .5, g);
    arcSign.rotation.x = -Math.asin(sy) * .85; arcSign.rotation.z = .025; }
  // blast doors: two slabs that slide into the hull
  for (const s of [-1, 1]) {
    const d = new THREE.Group(); g.add(d);
    const slab = mesh(new THREE.BoxGeometry(ARC.DOOR, 6.5, .35), S(0x6a6e70, { map: TX.metal, metalness: .55, roughness: .5 }), 0, 6.5 / 2 - C, 0, d);
    for (const y of [1, 3.2, 5.4]) mesh(new THREE.BoxGeometry(ARC.DOOR - .3, .25, .12), M(0x3a3d3f), 0, y - C, .22, d);
    for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(.25, 1.6, .1), M(k % 2 ? 0x1a1a1a : 0xd9a32a), s * -(ARC.DOOR / 2 - .3), .9 + k * .4 - C, .24, d).rotation.z = .6;
    hullDoors.push({ g: d, s, slab });
  }
  // ---- inside ----
  const deckT = texPanel.clone(); deckT.needsUpdate = true; deckT.repeat.set((LW + LE) / 6, ARC.W / 3);
  const deckM = new THREE.MeshLambertMaterial({ map: deckT, color: 0x8a8c88 });
  mesh(new THREE.BoxGeometry(LW + LE, .14, ARC.W * 2 + .2), deckM, (LE - LW) / 2, .07 - C, 0, g);
  // catwalk along the south wall + ramp up from the west end
  const walkZ = ARC.W - 1.25, walkHD = 1.45, steel = M(0x4a4c4e), grate = new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a6c6c });
  const wx0 = -10, wx1 = LE - 1.2, rx0 = -LW + 1.8;
  mesh(new THREE.BoxGeometry(wx1 - wx0, .2, walkHD * 2), grate, (wx0 + wx1) / 2, ARC.WALK - C, walkZ, g);
  for (let x = wx0 + 1; x < wx1; x += 4) mesh(new THREE.BoxGeometry(.2, ARC.WALK, .2), steel, x, ARC.WALK / 2 - C, walkZ - walkHD + .15, g);
  mesh(new THREE.BoxGeometry(wx1 - wx0, .08, .08), M(0xd9a32a), (wx0 + wx1) / 2, ARC.WALK + 1 - C, walkZ - walkHD, g);
  for (let x = wx0; x < wx1; x += 2) mesh(new THREE.BoxGeometry(.06, 1, .06), steel, x, ARC.WALK + .5 - C, walkZ - walkHD, g);
  const rLen = wx0 - rx0, rAng = Math.atan2(ARC.WALK, rLen);
  const ramp = mesh(new THREE.BoxGeometry(Math.hypot(rLen, ARC.WALK), .2, walkHD * 2), grate, (rx0 + wx0) / 2, ARC.WALK / 2 - C, walkZ, g); ramp.rotation.z = rAng;
  const rail = mesh(new THREE.BoxGeometry(Math.hypot(rLen, ARC.WALK), .08, .08), M(0xd9a32a), (rx0 + wx0) / 2, ARC.WALK / 2 + 1 - C, walkZ - walkHD, g); rail.rotation.z = rAng;
  addFloor(ARC.x + (wx0 + wx1) / 2, ARC.z + walkZ, 0, (wx1 - wx0) / 2, walkHD, H0 + ARC.WALK);
  addFloor(ARC.x + (rx0 + wx0) / 2, ARC.z + walkZ, 0, rLen / 2, walkHD, H0 + ARC.WALK / 2); FLOORS[FLOORS.length - 1].slope = ARC.WALK / rLen;
  // the core: the old reactor housing, still warm — raiders who get in go for it
  { const cg = new THREE.Group(); cg.position.set(ARC_CORE.x - ARC.x, -C, ARC_CORE.z - ARC.z); g.add(cg);
    mesh(new THREE.CylinderGeometry(2.2, 2.6, 1, 16), M(0x3a3c3e), 0, .5, 0, cg);
    mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 16), S(0x8a8c8e, { metalness: .6 }), 0, 3.2, 0, cg);
    const glow = mesh(new THREE.CylinderGeometry(1.55, 1.55, .5, 16), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, toneMapped: false }), 0, 3.2, 0, cg); glow.castShadow = false;
    DECOR_ANIM.push(tt => { glow.material.color.setHSL(.54, .8, .55 + Math.sin(tt * 2.2) * .12); });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const p = mesh(new THREE.CylinderGeometry(.15, .15, 6, 6), M(0x2a2a2a), Math.cos(a) * 2.2, 3, Math.sin(a) * 2.2, cg); p.rotation.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); }
    addCol(ARC_CORE.x, ARC_CORE.z, 2.4); }
  // bunks, lockers, crates — a place to hole up
  // (Nov 10) with Bryce's props loaded the bunks, lockers and strip lights are models (dressArc in 1h-props.js); the hull's own draws still run so nothing else moves
  const propsIn = MODELS['props/bed'] != null;
  for (let i = 0; i < 6; i++) { const x = -24 + i * 3.4, z = -ARC.W + 1.4, ry = arr(-.05, .05), cs = [apick([0x6a7a5a, 0x8a8a80, 0x5a6a7a]), apick([0x6a7a5a, 0x8a8a80, 0x5a6a7a])]; if (propsIn) continue;
    const b = new THREE.Group(); b.position.set(x, -C, z); b.rotation.y = ry; g.add(b);
    [.5, 1.8].forEach((y, k) => { mesh(new THREE.BoxGeometry(2.2, .14, 1), M(0x5a5e60), 0, y, 0, b); mesh(new THREE.BoxGeometry(2, .16, .9), M(cs[k]), 0, y + .14, 0, b); });
    for (const sx of [-1.05, 1.05]) mesh(new THREE.BoxGeometry(.08, 2.4, .08), M(0x3a3a3a), sx, 1.2, .45, b);
    addCol(ARC.x + x, ARC.z + z, 1); }
  for (let i = 0; i < 8; i++) { const x = -4 + i * 1.1, z = -ARC.W + .7, cl = apick([0x5a6a7a, 0x6a6e70, 0x4a5a6a]), ry = arr(-.06, .06); if (!propsIn) mesh(new THREE.BoxGeometry(1, 2.2, .6), M(cl), x, 1.1 - C, z, g).rotation.y = ry; }
  addColLine(ARC.x - 4, ARC.z - ARC.W + .7, ARC.x + 4, ARC.z - ARC.W + .7, .6);
  for (const [x, z] of [[-14, 2], [-12, -2.5], [6, 3], [20, 4], [-22, 3]]) { if (propsIn && Math.abs(z - 4.3) < 2.5 && (Math.abs(x - 18.6) < 6 || Math.abs(x + 22) < 3.5)) { arr(-.3, .3); continue; }   // the passages stand there now
    mesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), M(0x4f5a3a), x, .55 - C, z, g).rotation.y = arr(-.3, .3); mesh(new THREE.BoxGeometry(1.1, .9, .9), M(0x5a4a36), x + .2, 1.55 - C, z, g).rotation.y = .4; addCol(ARC.x + x, ARC.z + z, .9); }
  // strip lights + one warm lamp so it isn't a cave
  const strip = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  for (let x = -LW + 4; x < LE - 2; x += 8) { const rz = arr(-.04, .04); if (propsIn) continue; const l = mesh(new THREE.BoxGeometry(2.4, .1, .25), strip, x, R + hullOff(x, 1, 0) - 1.3, 0, g); l.castShadow = false; l.rotation.z = rz; }
  const hl = new THREE.PointLight(0xffd8a0, 2.4, 52, 1.2); hl.position.set(-4, R - 3, 0); g.add(hl);
  // collision: the shell (bullets pass over the south side above 8 m — that's the slit), the west end, the east end round
  // the opening into the wing, a gap for the door
  const zS = ARC.z + ARC.W + .3, zN = ARC.z - ARC.W - .3;
  addColLine(ARC.x - LW, zN, ARC.x + LE, zN, .6);
  for (const [a, b] of [[-LW, -ARC.DOOR - .4], [ARC.DOOR + .4, LE]]) { const n = Math.ceil((b - a) / .8); for (let i = 0; i <= n; i++) addCol(ARC.x + lerp(a, b, i / n), zS, .6, 8); }
  addColLine(ARC.x - LW - .3, zN, ARC.x - LW - .3, zS, .6);
  addColLine(ARC.x + LE + .3, zN, ARC.x + LE + .3, ARC.z - WING.W - .4, .6); addColLine(ARC.x + LE + .3, ARC.z + WING.W + .4, ARC.x + LE + .3, zS, .6);

  // ---- the east wing: out of the east end and round to the south ----
  const wg = new THREE.Group(); wg.position.set(0, H0, 0); world.add(wg);
  const wt = texPanel.clone(); wt.needsUpdate = true; wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const wingMat = new THREE.MeshStandardMaterial({ map: wt, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xbcb8ae, metalness: .45, roughness: .66, side: THREE.DoubleSide });
  const ph0 = -Math.asin(WING.C / WING.R) - .02, ph1 = Math.PI - ph0;
  { const m = new THREE.Mesh(wingSkin(0, ph0, ph1), wingMat); m.castShadow = m.receiveShadow = true; wg.add(m); }
  for (let i = 0; i < 9; i++) { const s0 = arr(2, WING.len - 5), a0 = arr(.5, 2.4); const m = new THREE.Mesh(wingSkin(.05 + i * .002, a0, a0 + arr(.15, .4), s0, s0 + arr(1.5, 4), 6), apick(patchM)); m.castShadow = true; wg.add(m); }
  { const m = new THREE.Mesh(wingSkin(.04, 1.6, 2.4, WING.len * .45, WING.len * .8, 10), scorch); wg.add(m); }
  // the deck, following the bend
  { const pos = [], uv = [], idx = [], P = WING.pts;
    P.forEach((p, i) => { for (const k of [-1, 1]) { pos.push(p.x + p.nx * k * (WING.W + .2), .14, p.z + p.nz * k * (WING.W + .2)); uv.push(p.s / 3, k * WING.W / 3); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); dg.setIndex(idx); dg.computeVertexNormals();
    const dt2 = texPanel.clone(); dt2.needsUpdate = true; dt2.wrapS = dt2.wrapT = THREE.RepeatWrapping;
    const dm = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ map: dt2, color: 0x8a8c88, side: THREE.DoubleSide })); dm.receiveShadow = true; wg.add(dm); }
  // its far end: a bulkhead with a hatch that's been welded shut, a little out of square
  { const e = WING.end, yaw = Math.atan2(e.tx, e.tz);
    const cap = mesh(new THREE.CircleGeometry(WING.R + .05, 40), S(0x666864, { map: TX.metal, metalness: .5, side: THREE.DoubleSide }), e.x, WING.C, e.z, wg); cap.rotation.set(.03, yaw, .02);
    const hg = new THREE.Group(); hg.position.set(e.x + e.tx * .3, WING.C - 1.4, e.z + e.tz * .3); hg.rotation.y = yaw; wg.add(hg);
    mesh(new THREE.TorusGeometry(2.1, .3, 6, 18), M(0x3a3a38), 0, 0, 0, hg); mesh(new THREE.CircleGeometry(2, 18), M(0x2a2a28), 0, 0, -.05, hg);
    for (let k = 0; k < 7; k++) { const b = mesh(new THREE.BoxGeometry(.18, 1.2, .12), M(0x6a5a4a), arr(-1.6, 1.6), arr(-1.4, 1.4), .12, hg); b.rotation.z = arr(-1.2, 1.2); }
    const tc = new THREE.TorusGeometry(WING.R + .35, .45, 6, 40); const tcol = mesh(tc, ribM, e.x - e.tx * .4, WING.C, e.z - e.tz * .4, wg); tcol.rotation.y = yaw; }
  // ribs round the wing, square to the bend
  for (let s = 4; s < WING.len - 2; s += arr(4.8, 6.2)) {
    const p = WING.pts.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), arc = arnd() < .2 ? Math.PI * arr(.45, .7) : Math.PI;
    const tg = new THREE.TorusGeometry(WING.R + .45 + Math.max(0, wingOff(p.s, Math.PI / 2)), .36, 5, 22, arc); if (arc < Math.PI && arnd() < .5) tg.rotateZ(Math.PI - arc);
    tg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(p.nx, 0, p.nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.tx, 0, p.tz)).setPosition(p.x, WING.C, p.z));
    mesh(tg, ribM, 0, 0, 0, wg);
    if (arc === Math.PI) { const fin = mesh(new THREE.BoxGeometry(.4, 2.8, 1), ribM, p.x, WING.C + WING.R + 1.6 + wingOff(p.s, Math.PI / 2), p.z, wg); fin.rotation.set(arr(-.1, .1), Math.atan2(p.tx, p.tz) + Math.PI / 2, arr(-.3, .3)); }
  }
  for (let i = 0; i < 3; i++) { const p = apick(WING.pts.slice(6, -6)); const pl = mesh(new THREE.BoxGeometry(arr(4, 7), .45, arr(4, 6)), M(0x8e9294), p.x, WING.C + WING.R + .25 + wingOff(p.s, Math.PI / 2), p.z, wg); pl.rotation.set(arr(-.3, .3), arnd() * 3, arr(-.3, .3)); }
  // inside the wing: stores — crates and drums along the walls, a rack of lockers, lights down the spine
  { const P = WING.pts, put = (s, side, f) => { const p = P.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), o = side * (WING.W - 1.3); f(p.x + p.nx * o, p.z + p.nz * o, Math.atan2(p.tx, p.tz)); };
    for (const [s, side] of [[5, 1], [9, -1], [14, 1], [19, -1], [23, -1], [27, 1], [31, -1]]) put(s, side, (x, z, yaw) => {
      mesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), M(apick([0x4f5a3a, 0x5a4a36, 0x4a5a6a])), x, .69, z, wg).rotation.y = yaw + arr(-.3, .3);
      mesh(new THREE.BoxGeometry(1.1, .9, .9), M(0x5a4a36), x + arr(-.2, .2), 1.69, z + arr(-.2, .2), wg).rotation.y = yaw + arr(-.6, .6); addCol(x, z, .9); });
    for (const [s, side] of [[11, 1], [25, 1]]) put(s, side, (x, z, yaw) => { for (let k = -1; k <= 1; k++) { mesh(new THREE.CylinderGeometry(.3, .3, .9, 12), M(apick([0x7a2a22, 0x3a4a3a, 0x5a5e60])), x + Math.cos(yaw) * k * .65, .59, z - Math.sin(yaw) * k * .65, wg); } addCol(x, z, 1.1); });
    put(17, -1, (x, z, yaw) => { const lg = new THREE.Group(); lg.position.set(x, .14, z); lg.rotation.y = yaw + Math.PI / 2; wg.add(lg); for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(1, 2.2, .6), M(apick([0x5a6a7a, 0x6a6e70, 0x4a5a6a])), (k - 1.5) * 1.05, 1.1, 0, lg).rotation.y = arr(-.06, .06); addCol(x, z, 1.6); });
    for (let s = 3; s < WING.len - 2; s += 7) { const p = P.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b); const l = mesh(new THREE.BoxGeometry(.25, .1, 2.4), strip, p.x, WING.C + WING.R + wingOff(p.s, Math.PI / 2) - 1.3, p.z, wg); l.rotation.y = Math.atan2(p.tx, p.tz); l.castShadow = false; } }
  // the wing's walls (round the bend) and its far end
  WING.pts.forEach((p, i) => { if (i % 2) return; for (const k of [-1, 1]) addCol(p.x + p.nx * k * (WING.W + .25), p.z + p.nz * k * (WING.W + .25), .6); });
  { const e = WING.end; addColLine(e.x - e.nx * WING.W, e.z - e.nz * WING.W, e.x + e.nx * WING.W, e.z + e.nz * WING.W, .6); }
  SHELTERS.push({ x: ARC.x, z: ARC.z, kind: 'arc', r: 0, hull: 1 });
  dressArc();
  for (let i = 0; i < 74; i++) rnd();   // the hull used to draw from the world's stream: keep everything after it where it was

  // the side modules, broken off on the way down, now outside the wall
  const m2 = hullModule(6.6, 26); m2.position.set(80, heightAt(80, -36) + 4.2, -36); m2.rotation.set(-.05, .95, .08); world.add(m2);
  for (let i = -12; i <= 12; i += 4) addCol(80 + Math.cos(.95) * i, -36 - Math.sin(.95) * i, 6.8);
  const m3 = hullModule(5.4, 18, false); m3.position.set(-80, heightAt(-80, -24) + 3.2, -24); m3.rotation.set(0, -1.2, .1); world.add(m3);
  for (let i = -8; i <= 8; i += 3.5) addCol(-80 + Math.cos(-1.2) * i, -24 - Math.sin(-1.2) * i, 5.6);
  // the spire: a broken tower section that came down nose-first and stuck, behind the hull
  const sp = new THREE.Group(); sp.position.set(-6, H0 - 4, -56); sp.rotation.set(-.2, .3, .18); world.add(sp);
  mesh(lattice(11, 80, 0x56544f, 6), VCOL, 0, 0, 0, sp);
  const coreT = texPanel.clone(); coreT.needsUpdate = true; coreT.repeat.set(1, 9);
  mesh(new THREE.BoxGeometry(7, 70, 7), new THREE.MeshStandardMaterial({ map: coreT, normalMap: TX.metal2N, color: 0x9a948c, metalness: .4, roughness: .7 }), 0, 35, 0, sp);
  for (let i = 0; i < 12; i++) { const b = mesh(new THREE.BoxGeometry(rr(3, 8), rr(1.5, 5), rr(3, 8)), M(pick([0x6e6a63, 0x8a8478, 0x4f4c47])), rr(-5, 5), rr(10, 80), rr(-5, 5), sp); b.rotation.set(rnd(), rnd(), rnd()); }
  for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(.25, rr(4, 9), .25), M(0x3b3a37), rr(-4, 4), 80 + rr(0, 4), rr(-4, 4), sp); b.rotation.set(rr(-.8, .8), 0, rr(-.8, .8)); }
  addCol(-6, -56, 7.5);
  // radio mast with loudspeakers, off the hull's west end (the east wing took its old spot)
  const mast = new THREE.Group(); mast.position.set(-44, H0, -40); world.add(mast);
  mesh(lattice(1.6, 26, 0x9a9a96, 2.4), VCOL, 0, 0, 0, mast);
  for (const [a, y] of [[0, 24.5], [2.1, 24.5], [4.2, 23.4]]) {
    const hn = mesh(new THREE.ConeGeometry(.8, 1.4, 10, 1, true), M(0x5d5e5c, { side: THREE.DoubleSide }), Math.sin(a) * 1.3, y, Math.cos(a) * 1.3, mast);
    hn.lookAt(Math.sin(a) * 9, y - 1, Math.cos(a) * 9); hn.rotateX(-Math.PI / 2);
  }
  mesh(new THREE.CylinderGeometry(1, 1, .2, 16), M(0xc9c9c4), 0, 26.3, 0, mast).rotation.x = .5;
  addCol(-44, -40, 1.3);
}
function updHullDoor(dt) {
  const target = hullDoor.hp <= 0 ? .55 : hullDoor.open ? 1 : 0;
  hullDoor.t = lerp(hullDoor.t, target, dt * 1.6);
  const zO = ARC.W - .45;
  for (const d of hullDoors) { d.g.position.set(d.s * (ARC.DOOR / 2 + hullDoor.t * (ARC.DOOR + .2)), 0, zO); d.g.rotation.z = hullDoor.hp <= 0 ? d.s * .08 : 0; }
}

/* the wall: corrugated sheets, log posts, and the gate with its sign */
const WALL_H = [2.4, 3.6, 4.6, 5.4];
function buildWall(level) {
  if (wallGroup) world.remove(wallGroup);
  wallGroup = new THREE.Group(); wallGroup.position.y = 0; world.add(wallGroup);
  const H = WALL_H[level];
  const sheetCols = [0x9da3a6, 0x8f9a9e, 0x7f8f9e, 0xa2a49d, 0x9a7f6a, 0x9b5a3e, 0x6f86a0];
  const SEG = 96, segA = (Math.PI * 2 - GATE_HALF * 2) / SEG;
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
  if (typeof bakeGroup === 'function') bakeGroup(wallGroup, new Set(), 40);
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
const TOWER_POS = [[.42, 59], [-.42, 59], [2.75, 59.5], [-2.75, 59.5]];
function buildTowers() {
  for (const [a, r] of TOWER_POS) {
    const x = Math.sin(a) * r, z = Math.cos(a) * r, y = heightAt(x, z);
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = a; world.add(t);
    towerKit(t);   // (Nov 10) timber legs, sandbagged platform, tin roof: 1f-houses.js
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

/* inside the walls: the yard fire, and the settlement's buildings in a ring just inside the wall — where you cook, craft,
   trade and gear up. Each has a keeper behind a counter (E: trade) and a station at the side you can use yourself. */
/* the layout (from Bryce's sketch): Main Street runs from the gate straight to the Arc's door; Arc Row crosses in front of
   the hull; Cross Street cuts the yard in half; West Lane and East Lane split the blocks. Buildings face their street.
   ry: which way the front faces (0 = south/+z, π/2 = east/+x, π = north, -π/2 = west) */
const HP = Math.PI / 2;
const STREETS = [   // (Nov 10) relatively straight, not ruled: the lanes wander a little and meet a little off square
  { n: 'Main Street', a: [0, 66], b: [.9, 22], w: 8 },
  { n: 'Main Street', a: [.9, 22], b: [0, -24], w: 8 },
  { n: 'Arc Row', a: [-52, -15.8], b: [-18, -17.4], w: 6 },
  { n: 'Arc Row', a: [-18, -17.4], b: [22, -16.4], w: 6 },
  { n: 'Cross Street', a: [-55, 23.2], b: [-2, 21.4], w: 6 },
  { n: 'Cross Street', a: [-2, 21.4], b: [55, 22.6], w: 6 },
  { n: 'West Lane', a: [-31.5, -17], b: [-30, 17], w: 4 },
  { n: 'West Lane', a: [-30, 17], b: [-32.4, 50], w: 4 },
  { n: 'East Lane', a: [28, 22], b: [29.6, 52], w: 4 },
  { n: 'Shop Walk', a: [-4, 3], b: [-27, 4.3], w: 3 },
  { n: 'Commons Walk', a: [4, 2], b: [44, 2], w: 3.5 },
];
const streetDist = (x, z) => { let d = 1e9; for (const S of STREETS) d = Math.min(d, segDist(x, z, S.a[0], S.a[1], S.b[0], S.b[1]) - S.w / 2); return d; };
const SHOP_DEFS = [
  { id: 'craft', x: -16.6, z: -5.4, ry: HP + .06, sign: 'WORKSHOP', who: 'kade', name: 'Kade', st: ['bench', 'forge'], stN: 'Workbench + forge · craft', cat: 'tool', col: 0x8a9092, tint: 0xd8d0c4 },
  { id: 'trade', x: -15.6, z: 12.2, ry: HP - .08, sign: 'TRADING POST', who: 'odile', name: 'Odile', st: ['bench'], stN: 'Sorting table · craft materials', cat: 'mat', col: 0x9a8a5a, tint: 0x9a7a60 },
  { id: 'med', x: -45.4, z: 5.2, ry: HP + .1, bw: 14, bd: 9, sign: 'CLINIC', who: 'juno', name: 'Juno', st: ['lab'], stN: 'Clinic lab · make medicine', cat: 'med', col: 0xb8b8b0, tint: 0xe0d8cc },
  { id: 'wear', x: -42.8, z: 33.4, ry: Math.PI - .07, sign: 'OUTFITTER', who: 'wren', name: 'Wren', st: ['bench'], stN: 'Sewing table · craft clothing', cat: 'wear', col: 0x6a8aa0, tint: 0xa0b0c8 },
  { id: 'guns', x: -15.4, z: 33.8, ry: HP + .05, sign: 'GUNSMITH', who: 'rook', name: 'Rook', st: ['bench'], stN: 'Gun bench · craft weapons + ammo', cat: 'weap', col: 0x6a7a4a, tint: 0x8a9070 },
  { id: 'cook', x: 16.5, z: 32.4, ry: -HP - .07, sign: 'COOKHOUSE', who: 'bram', name: 'Bram', st: ['fire', 'cook'], stN: 'Stove · cook', cat: 'food', col: 0xa86a48, tint: 0xc8a888 },
  { id: 'bunk', x: 40.6, z: 34.6, ry: Math.PI + .08, bw: 12, sign: 'BUNKHOUSE', st: [], stN: 'Rest in a bunk', col: 0x7a7a5a },
  { id: 'salvage', x: 49.6, z: 5, ry: -HP + .07, sign: 'SALVAGE', who: 'gus', name: 'Gus', st: ['bench'], stN: 'Strip-down bench · craft materials', cat: 'mat', col: 0x8a6a52, tint: 0x9a8a7a },
];
function shopL2W(D, lx, lz) { const c = Math.cos(D.ry), s = Math.sin(D.ry); return { x: D.cx + lx * c + lz * s, z: D.cz - lx * s + lz * c }; }
for (const D of SHOP_DEFS) { D.cx = D.x; D.cz = D.z; D.bw = D.bw || 11; D.bd = D.bd || 8; D.keeper = shopL2W(D, 0, -1.1); D.spot = shopL2W(D, -3.9, 1.9); D.front = shopL2W(D, 0, 2.1); D.forge = shopL2W(D, 3.9, 2.6); }
const SHOP = Object.fromEntries(SHOP_DEFS.map(D => [D.id, D]));
/* the walkers' network: settlers and extras walk the streets node to node (junctions, street ends, a spot in front of each
   shop) instead of picking a random point in the yard, which put them inside walls and shops. */
const WALK = (() => {
  const nodes = [], onSt = STREETS.map(() => []);
  const node = (x, z) => { for (const n of nodes) if (Math.hypot(n.x - x, n.z - z) < 1.5) return n; const n = { x, z, id: nodes.length, nb: new Set(), shop: null }; nodes.push(n); return n; };
  const proj = (S, x, z) => { const [ax, az] = S.a, [bx, bz] = S.b, dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return { t, x: ax + dx * t, z: az + dz * t }; };
  STREETS.forEach((S, i) => { onSt[i].push({ t: 0, n: node(...S.a) }, { t: 1, n: node(...S.b) }); });
  // junctions: wherever two streets touch (within their widths), sample along A and take the closest point on B
  for (let i = 0; i < STREETS.length; i++) for (let j = i + 1; j < STREETS.length; j++) {
    const A = STREETS[i], B = STREETS[j]; let best = null;
    for (let k = 0; k <= 60; k++) { const t = k / 60, x = lerp(A.a[0], A.b[0], t), z = lerp(A.a[1], A.b[1], t), q = proj(B, x, z), d = Math.hypot(q.x - x, q.z - z); if (!best || d < best.d) best = { d, t, x, z, q }; }
    if (best.d > (A.w + B.w) / 2 + 1) continue;
    const na = node(best.x, best.z), nb = node(best.q.x, best.q.z); onSt[i].push({ t: best.t, n: na }); onSt[j].push({ t: best.q.t, n: nb });
    if (na !== nb) { na.nb.add(nb); nb.nb.add(na); }
  }
  // a spot in front of each shop, tied to the nearest street
  for (const D of SHOP_DEFS) {
    const f = shopL2W(D, 0, D.bd / 2 + (D.id === 'cook' ? 6.4 : 2.6)); let bi = 0, bq = null;
    STREETS.forEach((S, i) => { const q = proj(S, f.x, f.z); if (!bq || Math.hypot(q.x - f.x, q.z - f.z) < Math.hypot(bq.x - f.x, bq.z - f.z)) { bq = q; bi = i; } });
    const sn = node(bq.x, bq.z), fn = node(f.x, f.z); fn.shop = D; onSt[bi].push({ t: bq.t, n: sn }); if (sn !== fn) { sn.nb.add(fn); fn.nb.add(sn); }
  }
  onSt.forEach(L => { L.sort((a, b) => a.t - b.t); for (let k = 1; k < L.length; k++) if (L[k].n !== L[k - 1].n) { L[k].n.nb.add(L[k - 1].n); L[k - 1].n.nb.add(L[k].n); } });
  const nearest = (x, z) => { let b = nodes[0], bd = 1e9; for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } } return b; };
  function path(from, to) {          // BFS by distance (Dijkstra, tiny graph)
    const dist = new Map([[from, 0]]), prev = new Map(), open = [from];
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b)); const n = open.shift(); if (n === to) break;
      for (const m of n.nb) { const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z); if (d < (dist.get(m) ?? 1e9)) { dist.set(m, d); prev.set(m, n); open.push(m); } }
    }
    const out = []; for (let n = to; n && n !== from; n = prev.get(n)) out.unshift(n); return out;
  }
  /* after the town is built (piles, tables, posts all have collision): move any node that landed on something to the
     nearest clear spot, and cut links that would walk through something */
  function settle() {
    const free = (x, z) => { const L = grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))) || []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of grid.get(gkey(Math.floor(x / CELL) + i, Math.floor(z / CELL) + j)) || []) if (Math.hypot(x - c.x, z - c.z) < c.r + .9) return false; return true; };
    for (const n of nodes) if (!free(n.x, n.z)) {
      let done = false; for (let r = .5; r <= 6 && !done; r += .5) for (let a = 0; a < 6.28 && !done; a += .4) { const x = n.x + Math.sin(a) * r, z = n.z + Math.cos(a) * r; if (free(x, z)) { n.x = x; n.z = z; done = true; } }
    }
    for (const n of nodes) for (const m of [...n.nb]) if (n.nb.size > 1 && m.nb.size > 1 && !clearLine(n.x, n.z, m.x, m.z, .55)) { n.nb.delete(m); m.nb.delete(n); }
  }
  return { nodes, nearest, path, settle };
})();
const SPOTS = {
  bench: SHOP.craft.spot, fire: { x: 24, z: 9 }, smoke: shopL2W(SHOP.cook, 7.6, 1.5), med: SHOP.med.spot, armory: SHOP.guns.spot,
};
let smokeGroup;
/* shopHouse(D): each building is raised in 1f-houses.js (Nov 10 rebuild) */
const texGravel = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#6a5f50'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = rr(70, 150) | 0; g.fillStyle = `rgba(${v},${v - 8},${v - 20},${rr(.25, .7)})`; const r = rr(1, 3.2); g.fillRect(rnd() * w, rnd() * h, r, r); }
  grime(g, w, h, 14, 'rgba(40,32,24,.35)'); grime(g, w, h, 6, 'rgba(70,90,50,.18)');
});
/* the streets: gravel ribbons with worn edges, lamp posts along them, and a gatehouse over the gate */
function buildStreets() {
  const edge = new THREE.MeshLambertMaterial({ color: 0x5a5244, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  STREETS.forEach((S, si) => {
    const [ax, az] = S.a, [bx, bz] = S.b, L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    const t = texGravel.clone(); t.needsUpdate = true; t.repeat.set(S.w / 4, L / 4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S.w, L + S.w), new THREE.MeshLambertMaterial({ map: t, color: 0xb8ad9c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.set(-Math.PI / 2, 0, yaw + Math.PI); m.position.set((ax + bx) / 2, H0 + .03 + si * .006, (az + bz) / 2); m.receiveShadow = true; world.add(m);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(S.w + 1.4, L + S.w + 1.4), edge); e.rotation.copy(m.rotation); e.position.set(m.position.x, H0 + .02, m.position.z); world.add(e);
    // lamp posts every ~14 m, alternating sides (not on the narrow walks)
    if (S.w < 4) return;
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let d = 7, k = 0; d < L - 3; d += 14, k++) {
      const sd = (k % 2 ? 1 : -1) * (S.w / 2 + .7), x = lerp(ax, bx, d / L) + nx * sd, z = lerp(az, bz, d / L) + nz * sd;
      if (Math.hypot(x, z) > CAMP_R - 3 || inHull(x, z) || SHOP_DEFS.some(D => Math.hypot(x - D.cx, z - D.cz) < Math.max(D.bw, D.bd) / 2 + 1.2) || Math.hypot(x - SPOTS.fire.x, z - SPOTS.fire.z) < 6 || streetDist(x, z) < -.2) continue;
      const lp = new THREE.Group(); lp.position.set(x, H0, z); world.add(lp);
      mesh(new THREE.CylinderGeometry(.08, .11, 4.2, 6), M(0x3a3a38), 0, 2.1, 0, lp);
      mesh(new THREE.BoxGeometry(.9, .08, .08), M(0x3a3a38), -Math.sign(sd) * nx * .4, 4.15, -Math.sign(sd) * nz * .4, lp).rotation.y = Math.atan2(nx, nz) + HP;
      const bulb = mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), -Math.sign(sd) * nx * .8, 4, -Math.sign(sd) * nz * .8, lp); bulb.castShadow = false;
      addCol(x, z, .2, 4);
    }
  });
  buildGatehouse();   // (Nov 10) 1f-houses.js
}
function buildCampProps() {
  const y0 = H0;
  for (const D of SHOP_DEFS) shopHouse(D);
  // the yard fire
  const f = new THREE.Group(); f.position.set(SPOTS.fire.x, y0, SPOTS.fire.z); world.add(f);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; mesh(new THREE.DodecahedronGeometry(.36, 0), M(0x6a6660), Math.cos(a) * 1.3, .15, Math.sin(a) * 1.3, f); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(.1, .11, 1.6, 5), M(0x4a3020), 0, .25, 0, f); l.rotation.set(Math.PI / 2 - .3, i * .8, 0); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.65, 1.6, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .9 }));
  flame.position.y = .9; f.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a })); flame2.position.y = .75; f.add(flame2);
  DECOR_ANIM.push(t => { flame.scale.set(1 + Math.sin(t * 17) * .1, 1 + Math.sin(t * 11) * .2, 1); flame2.scale.y = 1 + Math.sin(t * 23) * .25; flame.rotation.y = t * 2; });
  fireLight = new THREE.PointLight(0xff9a4a, 2.4, 26, 0); fireLight.position.set(SPOTS.fire.x, y0 + 1.6, SPOTS.fire.z); world.add(fireLight);
  addCol(SPOTS.fire.x, SPOTS.fire.z, 1.5);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, x = SPOTS.fire.x + Math.cos(a) * 4.2, z = SPOTS.fire.z + Math.sin(a) * 4.2;
    const b = new THREE.Group(); b.position.set(x, y0, z); b.rotation.y = -a + Math.PI / 2; world.add(b);
    const wood = new THREE.MeshLambertMaterial({ map: texWood, color: 0xa0886e });
    mesh(new THREE.BoxGeometry(2.6, .12, .45), wood, 0, .45, 0, b); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.12, .45, .4), wood, s, .22, 0, b); }
  // drums, a generator, cable runs
  for (const [x, z] of [[-8, -12], [8, -12], [-25, -12], [20, -11], [-26, 18], [-6, 50], [8, 48], [34, 46], [-36, 46], [44, -8]]) {
    mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 10), M(pick([0x5a6a7a, 0x7a3a2a, 0x3a5a3a])), x, H0 + .55, z, world); addCol(x, z, .5);
  }
  buildYard();   // (Nov 10) power yard, pole line, notice board, string lights, blast walls: 1f-houses.js
  buildStreets();
  campLight = new THREE.PointLight(0xffd9a0, 0, 90, 0); campLight.position.set(0, H0 + 16, 10); world.add(campLight);
  smokeGroup = new THREE.Group(); smokeGroup.position.set(SPOTS.smoke.x, H0, SPOTS.smoke.z); smokeGroup.rotation.y = SHOP.cook.ry; world.add(smokeGroup);
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
    const x = rr(-46, 46), z = rr(82, 150); if (pathDist(x, z) < 4 || Math.hypot(x - POI.lake.x, z - POI.lake.z) < LAKES[0].R * 1.3) continue;
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
    if (s.kind === 'house' || s.kind === 'arc') continue;   // (Nov 10) the shops and the Arc are their own shelter: no concrete hut inside them
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
  for (let i = 0; i < 9; i++) { const x = rr(-40, 40), z = rr(82, 146); if (waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'field'); }
  for (let i = 0; i < 110; i++) { const a = rnd() * Math.PI * 2, r = rr(96, VALLEY - 20); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) > 110 || waterAt(x, z) > heightAt(x, z) - .5) { i--; continue; } spawnScrap(x, z, 'wild'); }
}

/* ================= Kestrel's buildings (Nov 10 rebuild) =================
   Bryce: "complete destroy all building and make them from ground up WAY BETTER, something that looks like it WAS lived in".
   Every building is put together from its parts the way the settlers would have: a frame, then cladding a board or a sheet at a
   time (each one its own colour and a little out of true), patched where something broke, windows with frames, glass, curtains or
   boards, doors left ajar, a roof of overlapping sheets with a tarp over the leak, a gutter into a rain barrel, a stovepipe, a
   loft or an upstairs with laundry out, and the inside full of what the place is for.
   All of a building's parts are merged into one mesh per material (HKIT), so a house is a handful of draws however much is in it.
   Its own random stream (hrnd), so changing a house never moves anything else in the world.
   Kestrel's layout, the keepers, counters, stations and colliders are where they were (SHOP_DEFS, 1c-camp.js). */

let HR_S = 7331;
const hrnd = () => (HR_S = (HR_S * 16807) % 2147483647, (HR_S - 1) / 2147483646);
const hr = (a, b) => a + hrnd() * (b - a), hpick = a => a[Math.floor(hrnd() * a.length)], hp = p => hrnd() < p;

/* ---------- textures (drawn once; neutral, so each piece's vertex colour gives it its paint or wood) ---------- */
// weathered boards: 1 m square, grain running up the board
const texBoard = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#c4bcb0'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const x = rnd() * w, a = rr(.05, .22); g.strokeStyle = `rgba(${pick(['40,30,20', '70,55,40', '20,15,10'])},${a})`; g.lineWidth = rr(.6, 2.4);
    g.beginPath(); g.moveTo(x, 0); let xx = x; for (let y = 0; y <= h; y += 32) { xx += rr(-3, 3); g.lineTo(xx, y); } g.stroke(); }
  for (let i = 0; i < 9; i++) { const x = rnd() * w, y = rnd() * h, rx = rr(4, 10), ry = rr(10, 22); const gr = g.createRadialGradient(x, y, 1, x, y, ry);
    gr.addColorStop(0, 'rgba(45,30,18,.75)'); gr.addColorStop(.5, 'rgba(70,50,30,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx * 1.6, ry, 0, 0, 7); g.fill(); }
  // flaking paint: lighter bare-wood patches, and dirt
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(235,225,205,${rr(.08, .22)})`; g.fillRect(rnd() * w, rnd() * h, rr(4, 26), rr(10, 60)); }
  grime(g, w, h, 26, 'rgba(50,40,30,.28)'); grime(g, w, h, 10, 'rgba(60,80,40,.16)');
});
// corrugated sheet: 1 m wide, ridges every ~7.7 cm, rust running down from the top and from the fixings
const texCorr2 = ctex(512, 512, (g, w, h) => {
  for (let x = 0; x < w; x++) { const v = 176 + Math.sin(x / w * Math.PI * 26) * 30 | 0; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x, 0, 1, h); }
  for (let i = 0; i < 70; i++) { const x = rnd() * w, len = rr(30, 260), y0 = rnd() < .5 ? 0 : rnd() * h;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, `rgba(${rr(110, 150) | 0},${rr(50, 70) | 0},25,${rr(.25, .6)})`); gr.addColorStop(1, 'rgba(120,60,25,0)');
    g.fillStyle = gr; g.fillRect(x, y0, rr(2, 9), len); }
  grime(g, w, h, 30, 'rgba(120,58,22,.4)'); grime(g, w, h, 14, 'rgba(40,32,26,.35)');
  g.fillStyle = 'rgba(60,40,25,.6)'; for (let x = 10; x < w; x += 39) for (const y of [14, h - 14]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
});
const texCorr2N = ctex(512, 8, (g, w, h) => { for (let x = 0; x < w; x++) { const s = Math.cos(x / w * Math.PI * 26); g.fillStyle = `rgb(${128 + s * 100 | 0},128,255)`; g.fillRect(x, 0, 1, h); } });
texCorr2N.colorSpace = THREE.NoColorSpace;
// cinder blocks: 1.6 m square, 40 x 20 cm blocks, mortar, a damp line at the foot
const texBlock = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#7f7b74'; g.fillRect(0, 0, w, h);
  const bw = w / 4, bh = h / 8;
  for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const x = c * bw + (r % 2) * bw / 2, y = r * bh; const v = rr(150, 190) | 0;
    g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${rr(.05, .18)})`; g.fillRect(x + 3 + rnd() * (bw - 8), y + 3 + rnd() * (bh - 8), 2, 2); } }
  grime(g, w, h, 18, 'rgba(50,45,38,.35)'); grime(g, w, h, 8, 'rgba(70,90,50,.22)');
});
const texBlockN = ctex(128, 128, (g, w, h) => {
  g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h); const bw = w / 4, bh = h / 8;
  for (let r = 0; r < 8; r++) { g.fillStyle = 'rgb(128,90,230)'; g.fillRect(0, r * bh, w, 1); g.fillStyle = 'rgb(128,166,230)'; g.fillRect(0, r * bh + 1, w, 1);
    for (let c = -1; c < 5; c++) { const x = c * bw + (r % 2) * bw / 2; g.fillStyle = 'rgb(90,128,230)'; g.fillRect(x, r * bh, 1, bh); g.fillStyle = 'rgb(166,128,230)'; g.fillRect(x + 1, r * bh, 1, bh); } }
});
texBlockN.colorSpace = THREE.NoColorSpace;
// canvas / tarp / cloth weave with water stains
const texTarp = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6d0c4'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${rr(.03, .08)})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${rr(.02, .06)})`; g.fillRect(x, 0, 1, h); }
  grime(g, w, h, 16, 'rgba(70,60,45,.28)');
  g.strokeStyle = 'rgba(80,70,55,.3)'; for (let i = 0; i < 5; i++) { g.lineWidth = rr(1, 3); g.beginPath(); g.ellipse(rnd() * w, rnd() * h, rr(10, 40), rr(8, 30), rnd() * 3, 0, 7); g.stroke(); }
});
// posters, notices, a calendar, kids' drawings: an atlas of 4 x 2 sheets, picked by UV
const texPaper = ctex(512, 256, (g, w, h) => {
  const cw = w / 4, ch = h / 2;
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * cw, y = Math.floor(i / 4) * ch;
    g.fillStyle = pick(['#e8e0cc', '#ddd5c0', '#cfc6ae', '#e6dcc4']); g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.fillStyle = 'rgba(40,35,30,.85)';
    if (i === 0) { g.font = '900 22px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('RATIONS', x + cw / 2, y + 34); g.font = '12px monospace'; for (let k = 0; k < 6; k++) g.fillText('— — — —  ' + (k + 1) * 2, x + cw / 2, y + 58 + k * 14); }
    else if (i === 1) { g.font = '900 20px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('MISSING', x + cw / 2, y + 30); g.fillStyle = '#8a8070'; g.fillRect(x + 34, y + 40, cw - 68, 54); g.fillStyle = 'rgba(40,35,30,.8)'; g.font = '11px monospace'; g.fillText('last seen east ridge', x + cw / 2, y + 112); }
    else if (i === 2) { g.strokeStyle = 'rgba(40,35,30,.7)'; g.lineWidth = 1; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { g.strokeRect(x + 10 + c * 15, y + 24 + r * 18, 15, 18); if (rnd() < .5) { g.beginPath(); g.moveTo(x + 12 + c * 15, y + 26 + r * 18); g.lineTo(x + 23 + c * 15, y + 40 + r * 18); g.stroke(); } } g.font = '900 14px Impact'; g.fillText('DAY ___', x + 14, y + 18); }
    else if (i === 3) { g.lineWidth = 3; for (const col of ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f']) { g.strokeStyle = col; g.beginPath(); g.moveTo(x + rr(10, cw - 10), y + rr(20, ch - 20)); for (let k = 0; k < 4; k++) g.lineTo(x + rr(10, cw - 10), y + rr(20, ch - 20)); g.stroke(); } g.fillStyle = '#f1c40f'; g.beginPath(); g.arc(x + cw - 24, y + 24, 12, 0, 7); g.fill(); }
    else if (i === 4) { g.font = '900 18px Impact'; g.textAlign = 'center'; g.fillText('WALL WATCH', x + cw / 2, y + 26); g.font = '11px monospace'; g.textAlign = 'left'; for (let k = 0; k < 7; k++) g.fillText(pick(['KADE', 'TAM', 'ILKA', 'BRANN', 'SOVA', 'PELL', 'NICO', 'JUNO']) + '  ' + pick(['N', 'E', 'S', 'W']) + ' ' + (k + 1), x + 14, y + 46 + k * 11); }
    else if (i === 5) { g.font = '900 24px Impact'; g.textAlign = 'center'; g.fillStyle = '#7a1e18'; g.fillText('BOIL', x + cw / 2, y + 40); g.fillText('WATER', x + cw / 2, y + 66); g.font = '11px monospace'; g.fillStyle = 'rgba(40,35,30,.8)'; g.fillText('lake + river', x + cw / 2, y + 90); }
    else if (i === 6) { g.strokeStyle = 'rgba(40,35,30,.75)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + cw / 2, y + ch / 2, 40, 0, 7); g.stroke(); g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; g.moveTo(x + cw / 2, y + ch / 2); g.lineTo(x + cw / 2 + Math.cos(a) * 52, y + ch / 2 + Math.sin(a) * 52); } g.stroke(); g.font = '10px monospace'; g.fillText('KESTREL', x + 8, y + 16); }
    else { g.font = 'italic 13px Georgia, serif'; g.textAlign = 'left'; for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(40,35,60,.6)'; g.fillRect(x + 12, y + 20 + k * 13, rr(40, cw - 30), 1.5); } }
    grime(g, w, h, 2, 'rgba(90,70,40,.25)');
  }
});
// hand-painted / stencilled / sprayed shop signs
function paintSign(text, style) {
  return ctex(512, 128, (g, w, h) => {
    const font = style === 'stencil' ? '900 76px "Big Shoulders Stencil Display", Impact, sans-serif' : style === 'spray' ? '900 80px Impact, sans-serif' : '700 70px Georgia, "Times New Roman", serif';
    if (style === 'stencil') { g.fillStyle = '#5d6062'; g.fillRect(0, 0, w, h); grime(g, w, h, 20, 'rgba(120,60,25,.4)'); }
    else if (style === 'spray') { g.fillStyle = '#8a8f90'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x++) { g.fillStyle = `rgba(0,0,0,${.08 + Math.sin(x / 9) * .06})`; g.fillRect(x, 0, 1, h); } grime(g, w, h, 18, 'rgba(120,60,25,.45)'); }
    else { for (let y = 0; y < h; y += 32) { const v = rr(70, 100) | 0; g.fillStyle = `rgb(${v + 20},${v + 8},${v - 6})`; g.fillRect(0, y, w, 31); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 31, w, 1); } g.strokeStyle = style; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = style === 'stencil' ? '#e2dccc' : style === 'spray' ? '#d8432c' : '#efe6cf';
    if (style === 'spray') { g.shadowColor = '#d8432c'; g.shadowBlur = 6; }
    g.fillText(text, w / 2, h / 2 + 4, w - 40); g.shadowBlur = 0;
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr(60, 100) | 0},${rr(50, 80) | 0},${rr(40, 60) | 0},${rr(.2, .6)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 5), rr(1, 3)); }
    grime(g, w, h, 8, 'rgba(40,30,20,.3)');
  });
}

/* ---------- materials: one per surface kind, all tinted per piece by vertex colour ---------- */
const HMATS = {};
function hm(k) {
  if (HMATS[k]) return HMATS[k];
  const vc = { vertexColors: true };
  const T = {
    board: () => new THREE.MeshStandardMaterial({ ...vc, map: texBoard, roughness: .93, metalness: 0 }),
    corr: () => new THREE.MeshStandardMaterial({ ...vc, map: texCorr2, normalMap: texCorr2N, normalScale: new THREE.Vector2(1.2, 1.2), roughness: .62, metalness: .38 }),
    block: () => new THREE.MeshStandardMaterial({ ...vc, map: texBlock, normalMap: texBlockN, roughness: .95, metalness: 0 }),
    hull: () => new THREE.MeshStandardMaterial({ ...vc, map: texPanel, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.7, .7), roughness: .58, metalness: .42 }),
    metal: () => new THREE.MeshStandardMaterial({ ...vc, map: TX.metal, normalMap: TX.metalN, roughness: .55, metalness: .5 }),
    conc: () => new THREE.MeshStandardMaterial({ ...vc, map: texConcrete, roughness: .96, metalness: 0 }),
    cloth: () => new THREE.MeshStandardMaterial({ ...vc, map: texTarp, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    plain: () => new THREE.MeshStandardMaterial({ ...vc, roughness: .82, metalness: .05 }),
    shiny: () => new THREE.MeshStandardMaterial({ ...vc, roughness: .35, metalness: .55 }),
    paper: () => new THREE.MeshStandardMaterial({ ...vc, map: texPaper, roughness: .95, metalness: 0, side: THREE.DoubleSide }),
    rock: () => new THREE.MeshStandardMaterial({ ...vc, map: TX.rock, roughness: .95, metalness: 0 }),
    glass: () => new THREE.MeshStandardMaterial({ color: 0x46545c, roughness: .06, metalness: .7, transparent: true, opacity: .55, depthWrite: false }),
    glow: () => new THREE.MeshBasicMaterial({ ...vc, toneMapped: false }),
    win: () => new THREE.MeshBasicMaterial({ color: 0x2a2620, toneMapped: false }),       // lit from inside after dark (HOUSE_NIGHT)
  };
  return HMATS[k] = T[k]();
}
// inside a building the roof shades everything from the sun; the inside materials add the light bounced round the room,
// in each piece's own colour (diffuse x k), a little more after dark when the lamps are lit
const INNER_GLOW = { value: .3 };
const HMATS_IN = {};
function hmIn(k) {
  if (HMATS_IN[k]) return HMATS_IN[k];
  const base = hm(k); if (!base.isMeshStandardMaterial) return HMATS_IN[k] = base;
  const m = base.clone();
  m.onBeforeCompile = sh => { sh.uniforms.uInnerGlow = INNER_GLOW; sh.fragmentShader = 'uniform float uInnerGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uInnerGlow;'); };
  m.customProgramCacheKey = () => 'inner-' + k;
  return HMATS_IN[k] = m;
}
const hSignMats = {};
function hSignMat(text, style) { const k = text + style; return hSignMats[k] || (hSignMats[k] = new THREE.MeshStandardMaterial({ map: paintSign(text, style), roughness: .85, metalness: style === 'stencil' ? .3 : 0 })); }
// windows and lamps warm up as it gets dark
let houseNightK = -1;
function updHouseLights() {
  const t = G.tod, k = t > .5 ? smooth(.7, .8, t) : 1 - smooth(.2, .28, t);
  if (Math.abs(k - houseNightK) < .01) return; houseNightK = k;
  hm('win').color.setRGB(lerp(.09, 1.25, k), lerp(.08, .78, k), lerp(.07, .36, k));
  INNER_GLOW.value = lerp(.3, .42, k);
}

/* ---------- the kit: parts gathered per material, merged into one mesh each ---------- */
const _hq = new THREE.Quaternion(), _he = new THREE.Euler(), _hv = new THREE.Vector3(), _hs = new THREE.Vector3(), _hc = new THREE.Color();
function htm(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(_hv.set(x, y, z), _hq.setFromEuler(_he.set(rx, ry, rz)), _hs.set(sx, sy, sz)); }
// box UVs in metres (tile = metres per texture repeat), offset so neighbouring pieces don't repeat the same patch
function boxUV(g, w, h, d, tile, uo, vo) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile + uo, uv.getY(i) * dims[f][1] / tile + vo); }
}
function hkit(lowDetail) {
  const P = {};
  let base = null;
  function put(mat, g, col) {
    if (g.index) g = g.toNonIndexed();
    if (base) g.applyMatrix4(base);
    const n = g.attributes.position.count, a = new Float32Array(n * 3); _hc.set(col);
    for (let i = 0; i < n; i++) { a[i * 3] = _hc.r; a[i * 3 + 1] = _hc.g; a[i * 3 + 2] = _hc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    (P[mat] || (P[mat] = [])).push(g);
  }
  const K = {
    low: !!lowDetail,
    at(m) { base = m; return K; },           // following parts are placed in this frame (a wall, a shelf...)
    box(mat, w, h, d, x, y, z, rx, ry, rz, col = 0xffffff, tile = 1) {
      const g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, tile, hrnd() * 9, hrnd() * 9);
      g.applyMatrix4(htm(x, y, z, rx || 0, ry || 0, rz || 0)); put(mat, g, col);
    },
    cyl(mat, rt, rb, h, seg, x, y, z, rx, ry, rz, col = 0xffffff, open = false, t0 = 0, tl = Math.PI * 2) {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * (rt + rb), uv.getY(i) * h);
      g.applyMatrix4(htm(x, y, z, rx || 0, ry || 0, rz || 0)); put(mat, g, col);
    },
    geo(mat, g, m, col = 0xffffff) { if (m) g.applyMatrix4(m); put(mat, g, col); },
    // a plank of paper/poster from the atlas (cell 0-7)
    poster(cell, w, h, x, y, z, ry, rz = 0) {
      const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, cx = (cell % 4) / 4, cy = 1 - (Math.floor(cell / 4) + 1) / 2;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) / 4, cy + uv.getY(i) / 2);
      g.applyMatrix4(htm(x, y, z, 0, ry, rz)); put('paper', g, 0xffffff);
    },
    build(parent, shadows = true, inside = false) {
      for (const k in P) {
        const g = mergeGeometries(P[k]); if (!g) continue;
        const m = new THREE.Mesh(g, inside ? hmIn(k) : hm(k));
        m.castShadow = shadows && !['glass', 'glow', 'win', 'paper'].includes(k); m.receiveShadow = !['glow', 'win'].includes(k);
        parent.add(m);
      }
    },
  };
  return K;
}

/* ---------- palettes ---------- */
const WOODC = [0x8a7a66, 0x9a8670, 0x7a6a58, 0x6e6152, 0xa08a6e, 0x857766];          // bare, weathered
const RUST = [0xb07850, 0x9a6a4a, 0xa88a72, 0x8a8a86, 0x9c9a94, 0xb59474, 0x7f6a5a]; // tin, from new-ish grey to orange
const CLOTHC = [0x6a7a5a, 0x7a5a48, 0x5a6a7a, 0x8a7a5a, 0x9a4a3a, 0x4a5a6a, 0xa89a7a, 0x6a5a7a, 0x3a4a3a];
const tint = (c, k = .14) => { _hc.set(c); const h = {}; _hc.getHSL(h); return new THREE.Color().setHSL(h.h + hr(-.02, .02), clamp(h.s * hr(1 - k, 1 + k), 0, 1), clamp(h.l * hr(1 - k, 1 + k), 0, 1)).getHex(); };

/* ---------- walls: cladding a run of wall a piece at a time, round its openings ----------
   frame: wall runs along +x from 0 to L, outside face toward +z, y up from the floor. holes: [{x0,x1,y0,y1}] */
function cladRun(K, L, H, kind, o) {
  const holes = o.holes || [], col = o.col;
  const cuts = new Set([0, L]); for (const h of holes) { cuts.add(clamp(h.x0, 0, L)); cuts.add(clamp(h.x1, 0, L)); }
  const vspans = (a, b) => {           // the heights this strip covers, minus any opening over it
    let segs = [[0, H]];
    for (const h of holes) if (h.x0 <= a + 1e-3 && h.x1 >= b - 1e-3) segs = segs.flatMap(([s0, s1]) => [[s0, Math.min(s1, h.y0)], [Math.max(s0, h.y1), s1]].filter(([p, q]) => q - p > .04));
    return segs;
  };
  const strips = [];
  const pw = kind === 'board' ? [.17, .27] : kind === 'corr' ? [.82, .92] : kind === 'hull' ? [1.1, 1.7] : [9, 9];
  const bounds = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < bounds.length - 1; i++) { let a = bounds[i]; const b = bounds[i + 1]; while (b - a > .02) { const w = Math.min(b - a, hr(pw[0], pw[1])); strips.push([a, a + (b - a - w < .1 ? b - a : w)]); a += (b - a - w < .1 ? b - a : w); } }
  let alt = 0;
  for (const [a, b] of strips) {
    const w = b - a, cx = (a + b) / 2;
    for (const [y0, y1] of vspans(a, b)) {
      const hh = y1 - y0;
      if (kind === 'board') {
        const c = hp(.08) ? hpick(WOODC) : hp(.06) ? tint(o.patch || 0x6a7a8a) : tint(col, .12);
        const top = y1 >= H - .01 ? hr(-.04, .02) : 0;
        K.box('board', w - .012, hh + top, .035, cx, y0 + (hh + top) / 2, hr(-.006, .006), 0, 0, hr(-.008, .008), c);
        if (hp(.25) && hh > 1) K.box('metal', .016, .016, .01, cx + hr(-.03, .03), y0 + hr(.1, .3), .022, 0, 0, 0, 0x3a3634);   // nail heads
      } else if (kind === 'corr') {
        const c = hp(.12) ? tint(o.patch || 0x6a7f96) : tint(hpick(o.pal || RUST), .1);
        // tall runs get two rows, the upper one lapped over the lower
        const rows = hh > 2.6 ? [[y0, y0 + hh * .55 + .08], [y0 + hh * .55 - .04, y1]] : [[y0, y1]];
        for (const [r0, r1] of rows) K.box('corr', w + .05, r1 - r0, .02, cx, (r0 + r1) / 2, (alt++ % 2) * .014 + hr(0, .006), hr(-.01, .01), 0, hr(-.012, .012), c);
      } else if (kind === 'hull') {
        const rowH = hr(1.1, 1.5);
        for (let y = y0; y < y1 - .02; y += rowH) { const top = Math.min(y1, y + rowH); K.box('hull', w - .02, top - y - .02, .05, cx, (y + top) / 2, hr(-.008, .012), 0, 0, hr(-.006, .006), tint(o.col || 0xc8c4bc, .08), 2); }
      } else if (kind === 'block') {
        K.box('block', w, hh, .2, cx, y0 + hh / 2, -.08, 0, 0, 0, tint(col || 0xd8d2c8, .05), 1.6);
      }
    }
  }
}
// a window: frame, sill, glass (lit from inside after dark), and one of: curtains, shutters, boards, bars
function windowAt(K, x, y, w, h, o = {}) {
  const fc = o.frame || 0x5a4a3a, t = .06;
  for (const [px, py, pw, ph] of [[x, y + h / 2 + t / 2, w + t * 2, t], [x, y - h / 2 - t / 2, w + t * 2, t], [x - w / 2 - t / 2, y, t, h], [x + w / 2 + t / 2, y, t, h]]) K.box('board', pw, ph, .09, px, py, .03, 0, 0, 0, fc);
  K.box('board', w + .24, .05, .16, x, y - h / 2 - t - .02, .07, .06, 0, 0, tint(fc));             // sill
  if (o.boarded) { for (let i = 0; i < 3; i++) K.box('board', w + .3, .14, .03, x, y - h / 3 + i * h / 3, .1, 0, 0, hr(-.25, .25), hpick(WOODC)); K.box('win', w, h, .01, x, y, -.02); return; }
  K.box('win', w, h, .01, x, y, -.03);                                                            // the room behind
  K.box('glass', w, h, .012, x, y, .0);
  K.box('board', .03, h, .03, x, y, .02, 0, 0, 0, fc); K.box('board', w, .03, .03, x, y, .02, 0, 0, 0, fc);   // muntins
  if (o.crack) K.box('glow', .005, h * .6, .002, x + w * .2, y + h * .1, .012, 0, 0, .6, 0x9aa4a8);
  if (o.curtain != null) for (const s of [-1, 1]) K.box('cloth', w * hr(.22, .4), h * .95, .02, x + s * w * .32, y, -.07, 0, 0, 0, o.curtain);
  if (o.shutters) for (const s of [-1, 1]) {
    const a = hr(.9, 1.5) * s, sw = w / 2 + .04, m = htm(x + s * (w / 2 + t), y, .06, 0, -a, 0);
    for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(sw / 4 - .01, h + .06, .03); boxUV(g, sw / 4, h, .03, 1, hrnd() * 9, hrnd() * 9); g.translate(s * (i + .5) * sw / 4, 0, 0); K.geo('board', g, m, tint(o.shutters, .08)); }
  }
  if (o.bars) for (let i = 1; i < 5; i++) K.box('metal', .025, h + .1, .025, x - w / 2 + i * w / 5, y, .08, 0, 0, 0, 0x3a3836);
}
function doorAt(K, x, w, h, o = {}) {
  const fc = o.frame || 0x4a3c30;
  K.box('board', w + .2, .12, .14, x, h + .06, .02, 0, 0, 0, fc);
  for (const s of [-1, 1]) K.box('board', .1, h, .14, x + s * (w / 2 + .05), h / 2, .02, 0, 0, 0, fc);
  K.box('win', w, h, .01, x, h / 2, -.06);
  // the leaf, hinged on the left and left ajar
  const a = o.open ?? hr(.25, 1.1), lw = w - .02, m = htm(x - w / 2, 0, 0, 0, a, 0);
  const n = o.metal ? 1 : Math.round(lw / .18), dc = o.col || 0x6a5a48;
  for (let i = 0; i < n; i++) { const pw = lw / n, g = new THREE.BoxGeometry(pw - .008, h - .04, .04); boxUV(g, pw, h, .04, 1, hrnd() * 9, hrnd() * 9); g.translate((i + .5) * pw, h / 2, 0); K.geo(o.metal ? 'metal' : 'board', g, m.clone(), tint(dc, .1)); }
  if (!o.metal) for (const yy of [.35, h - .35]) { const g = new THREE.BoxGeometry(lw - .06, .1, .03); g.translate(lw / 2, yy, .035); K.geo('board', g, m.clone(), tint(dc, .1)); }
  const hg = new THREE.SphereGeometry(.035, 6, 4); hg.translate(lw - .1, h * .48, .06); K.geo('shiny', hg, m.clone(), 0x8a7a50);
}

/* ---------- models from Bryce's prop packs (Nov 10), placed by size; parts of a pack picked by mesh name ---------- */
function hmodel(name, size, axis = 'y') { return MODELS[name] ? modelCopy(name, size, axis) : null; }
function hpart(name, test, size, axis = 'y') {
  const src = MODELS[name]; if (!src) return null;
  const o = src.clone(true); const drop = [];
  o.traverse(m => { if (m.isMesh && !test(m.name)) drop.push(m); });
  drop.forEach(m => m.removeFromParent());
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return null;
  const sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), k = size / sz[axis];
  const wrap = new THREE.Group(); o.scale.multiplyScalar(k); o.position.set(-c.x * k, -b.min.y * k, -c.z * k); wrap.add(o);
  wrap.traverse(m => { if (m.isMesh) { m.castShadow = size > .5; m.receiveShadow = true; } });
  return wrap;
}
function hput(parent, o, x, y, z, ry = 0, rx = 0, rz = 0) { if (!o) return null; o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; }
const PROP_MODELS = ['props/kitchen', 'props/tool-racks', 'props/hand-tools', 'props/wrenches', 'props/tool-roll', 'props/lights', 'props/radiator', 'props/substation', 'props/barrier', 'props/pipes'];
const fixture = (long = true) => hpart('props/lights', n => long ? /Cube\.00[37]_/.test(n) : /Cube\.01[34]_/.test(n), long ? 1.25 : .8, 'x');

/* ---------- small things settlers own ---------- */
function crate(K, x, y, z, ry, s = 1, c) { const col = c || tint(hpick([0x7a6a50, 0x6a5a44, 0x5f6a4a, 0x8a7656])); const w = .6 * s, h = .45 * s, d = .45 * s;
  K.box('board', w, h, d, x, y + h / 2, z, 0, ry, 0, col); for (const k of [-1, 1]) K.box('board', w + .02, .05, d + .02, x, y + h / 2 + k * h * .35, z, 0, ry, 0, tint(col, .2)); }
function barrel(K, x, y, z, c, h = .9) { K.cyl('metal', .29, .29, h, 14, x, y + h / 2, z, 0, 0, 0, c); for (const yy of [.2, .5, .8]) K.cyl('metal', .3, .3, .035, 14, x, y + yy * h, z, 0, 0, 0, tint(c, .25)); }
function sack(K, x, y, z, s = 1) { const g = new THREE.SphereGeometry(.28 * s, 8, 6); g.scale(1, .62, .8); K.geo('cloth', g, htm(x, y + .16 * s, z, 0, hr(0, 3), hr(-.2, .2)), tint(hpick([0xb8a888, 0xa89878, 0x9a8a68]))); }
function bottleRow(K, x0, x1, y, z, ry = 0) { for (let x = x0; x < x1; x += hr(.07, .16)) { const h = hr(.14, .3), c = hpick([0x3a5a3a, 0x6a4a2a, 0x8a8a7a, 0x2a3a4a, 0xa8a070, 0x7a3a2a]); const p = new THREE.Vector3(x, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  K.cyl(hp(.5) ? 'glass' : 'shiny', .035, .04, h, 7, p.x, y + h / 2, z + p.z, 0, 0, 0, c); } }
function shelf(K, x, z, w, ry, levels, fill) {     // a board-and-bracket shelf unit, loaded
  const m = htm(x, 0, z, 0, ry, 0); const g0 = [];
  for (const s of [-1, 1]) K.geo('board', new THREE.BoxGeometry(.05, levels * .55 + .3, .38), m.clone().multiply(htm(s * w / 2, (levels * .55 + .3) / 2, 0)), 0x5a4a3a);
  for (let i = 0; i < levels; i++) {
    const y = .35 + i * .55; K.geo('board', new THREE.BoxGeometry(w, .035, .4), m.clone().multiply(htm(0, y, 0)), tint(0x7a6a56));
    for (let xx = -w / 2 + .06; xx < w / 2 - .1;) { const iw = hr(.12, .34); if (xx + iw > w / 2 - .04) break;
      const ih = hr(.12, .34), c = fill ? hpick(fill) : hpick(CLOTHC), kind = hrnd();
      if (kind < .45) K.geo('plain', new THREE.BoxGeometry(iw - .02, ih, hr(.2, .32)), m.clone().multiply(htm(xx + iw / 2, y + ih / 2 + .02, 0, 0, hr(-.1, .1), 0)), tint(c));
      else if (kind < .7) K.geo('metal', new THREE.CylinderGeometry(iw * .35, iw * .35, ih, 9), m.clone().multiply(htm(xx + iw / 2, y + ih / 2 + .02, 0)), tint(c));
      else if (kind < .85) { const g = new THREE.SphereGeometry(iw * .45, 7, 5); g.scale(1, .6, .8); K.geo('cloth', g, m.clone().multiply(htm(xx + iw / 2, y + iw * .27, 0)), tint(c)); }
      xx += iw + hr(0, .08); }
  }
}
function laundry(K, ax, ay, az, bx, by, bz) {          // a line between two points, sagging, with washing on it
  const n = 10, P = [];
  for (let i = 0; i <= n; i++) { const t = i / n; P.push(new THREE.Vector3(lerp(ax, bx, t), lerp(ay, by, t) - Math.sin(t * Math.PI) * .25, lerp(az, bz, t))); }
  for (let i = 0; i < n; i++) { const a = P[i], b = P[i + 1], L = a.distanceTo(b); const g = new THREE.CylinderGeometry(.006, .006, L, 3); g.rotateZ(Math.PI / 2);
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x), pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)); K.geo('plain', g, htm((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0, yaw, pitch), 0x3a3a38); }
  for (let i = 1; i < n; i++) { if (hp(.3)) continue; const p = P[i], yaw = Math.atan2(-(bz - az), bx - ax), w = hr(.3, .6), h = hr(.35, .8);
    K.geo('cloth', new THREE.PlaneGeometry(w, h), htm(p.x, p.y - h / 2, p.z, hr(-.05, .05), yaw, hr(-.06, .06)), hpick(CLOTHC.concat([0xd8d4c8, 0xc8c0b0]))); }
}
function stovepipe(K, x, y0, z, h, c = 0x3a3634) { K.cyl('metal', .1, .1, h, 10, x, y0 + h / 2, z, 0, 0, 0, c); K.cyl('metal', .2, .14, .12, 10, x, y0 + h + .1, z, 0, 0, 0, c); K.cyl('metal', .18, .18, .02, 10, x, y0 + h + .22, z, 0, 0, 0, c); }

/* ---------- a house ----------
   S: { clad: 'board'|'corr'|'hull', base: 'block'|null, col, roof: 'gable'|'shed', roofPal, upper: bool, front: 'open'|'rollup'|'shutter',
        lean: true (lean-to at the back), chim: [x,z], sign: [text, style] } */
function raiseHouse(D, S) {
  const g = new THREE.Group(); g.position.set(D.cx, H0, D.cz); g.rotation.y = D.ry; world.add(g);
  const inner = new THREE.Group(); inner.position.copy(g.position); inner.rotation.y = D.ry; world.add(inner);   // the inside: its own cull entry
  const K = hkit(LOW), KI = hkit(LOW);
  const BW = D.bw, BD = D.bd, H1 = 3.3, H2 = S.upper ? 2.75 : 0, HT = H1 + H2, OPEN = BW / 2 - 1.6;
  const kind = S.clad, col = S.col, low = S.base === 'block' ? 1.05 : 0;
  // floor: the old slab, then boards over it in the timber houses
  K.box('conc', BW + .7, .22, BD + .7, 0, .11, 0, 0, 0, 0, 0xb0aaa0, 2);
  if (S.floor === 'board') for (let x = -BW / 2 + .1; x < BW / 2 - .1; x += .2) K.box('board', .19, .03, BD - .2, x + .1, .235, 0, 0, 0, 0, tint(0x8a7a64, .12));
  // the frame: corner posts, the posts either side of the shop front, top plates
  const postC = kind === 'hull' || kind === 'corr' ? 0x4a4644 : 0x5a4a3a, postM = kind === 'hull' ? 'metal' : 'board';
  for (const [px, pz] of [[-BW / 2, -BD / 2], [BW / 2, -BD / 2], [-BW / 2, BD / 2], [BW / 2, BD / 2], [-OPEN, BD / 2], [OPEN, BD / 2]]) K.box(postM, .16, HT + .05, .16, px, HT / 2, pz, 0, 0, 0, tint(postC));
  K.box(postM, BW + .2, .18, .2, 0, H1, BD / 2 + .02, 0, 0, 0, tint(postC));                          // lintel over the shop front
  // walls: back, the two sides, and the front stubs either side of the opening (upper storey: a whole front with windows)
  const wallM = (x, z, ry) => htm(x, 0, z, 0, ry, 0);
  const runs = [
    { m: wallM(BW / 2, -BD / 2, Math.PI), L: BW, side: 'back' },
    { m: wallM(BW / 2, BD / 2, Math.PI / 2), L: BD, side: 'right' },
    { m: wallM(-BW / 2, -BD / 2, -Math.PI / 2), L: BD, side: 'left' },
    { m: wallM(-BW / 2, BD / 2, 0), L: BW, side: 'front' },
  ];
  const winY = 1.75, upY = H1 + 1.45;
  for (const R of runs) {
    const holes = [], wins = [], doors = [];
    if (R.side === 'front') holes.push({ x0: 1.6, x1: BW - 1.6, y0: -1, y1: H1 - .1 });
    else if (R.side === 'back') { for (const u of S.backWin || [BW * .25, BW * .75]) wins.push([u, winY, 1, .9]); }
    else { wins.push([R.L * hr(.35, .62), winY, .9, .85]); if (S.sideDoor === R.side) doors.push([R.L * .78, .9, 2.05]); }
    if (H2) { // upstairs
      if (R.side === 'front') { wins.push([BW * .2, upY, 1.1, 1]); wins.push([BW * .8, upY, 1.1, 1]); doors.push([BW / 2, .95, 2.1, H1 + .02]); }
      else if (R.side === 'back') { wins.push([BW * .5, upY, .9, .9]); doors.push([BW - 1.4, .9, 2.05, H1 + .02]); }
      else wins.push([R.L * .5, upY, .9, .9]);
    }
    for (const [u, y, w, h] of wins) holes.push({ x0: u - w / 2 - .06, x1: u + w / 2 + .06, y0: y - h / 2 - .06, y1: y + h / 2 + .06 });
    for (const [u, w, h, y0 = 0] of doors) holes.push({ x0: u - w / 2 - .05, x1: u + w / 2 + .05, y0: y0 - 1, y1: y0 + h + .1 });
    K.at(R.m);
    if (low) { cladRun(K, R.L, low, 'block', { holes: holes.map(h => ({ ...h })), col: 0xcfc9be }); K.box('board', R.L, .08, .1, R.L / 2, low + .02, .05, 0, 0, 0, 0x5a4a3a); }
    K.at(R.m.clone().multiply(htm(0, low, 0)));
    cladRun(K, R.L, HT - low, kind, { holes: holes.map(h => ({ ...h, y0: h.y0 - low, y1: h.y1 - low })), col, pal: S.pal, patch: S.patch });
    if (R.side !== 'front') {        // the inside face: boards or plaster on the studs, round the same openings
      KI.at(R.m.clone().multiply(htm(.17, .2, -.17)));
      cladRun(KI, R.L - .34, H1 - .25, 'board', { holes: holes.filter(h => h.y0 < H1).map(h => ({ ...h, x0: h.x0 - .17, x1: h.x1 - .17, y0: h.y0 - .2, y1: h.y1 - .2 })), col: S.liner || 0xb8ae9c });
      KI.at(null);
    }
    K.at(R.m);
    for (const [u, y, w, h] of wins) windowAt(K, u, y, w, h, { frame: S.frame, curtain: hp(.6) ? hpick(CLOTHC) : null, shutters: S.shutters && hp(.6) ? S.shutters : null, boarded: hp(S.boarded || .1), bars: S.bars, crack: hp(.3) });
    for (const [u, w, h, y0 = 0] of doors) { K.at(R.m.clone().multiply(htm(0, y0, 0))); doorAt(K, u, w, h, { col: S.door || 0x6a5a48, frame: S.frame, metal: S.metalDoor, open: y0 > 0 ? hr(.05, .5) : undefined }); }
    // gable / shed fill above the wall top on the sides
    if ((R.side === 'left' || R.side === 'right') && S.roof) {
      K.at(R.m);
      const pitch = S.roof === 'gable' ? .42 : 0, rise = S.roof === 'shed' ? 1.1 : 0;
      for (let u = 0; u < R.L - .02;) { const w = Math.min(R.L - u, kind === 'board' ? hr(.17, .27) : hr(.82, .92)); const c = u + w / 2;
        const zf = R.side === 'right' ? BD / 2 - c : c - BD / 2;                       // where this strip is front-to-back (front = +)
        const hh = S.roof === 'gable' ? (BD / 2 - Math.abs(zf)) * Math.tan(pitch) : rise * (zf + BD / 2) / BD;
        if (hh > .05) K.box(kind === 'board' ? 'board' : kind === 'hull' ? 'hull' : 'corr', w - .01, hh, .03, c, HT + hh / 2 - .02, 0, 0, 0, 0, kind === 'board' ? tint(col, .1) : tint(hpick(S.pal || RUST), .1));
        u += w; }
    }
    // a plank band where the upper floor sits
    if (H2) K.box('board', R.L + .1, .22, .06, R.L / 2, H1, .05, 0, 0, 0, tint(0x5a4a3a));
  }
  K.at(null);
  // the ceiling: boards across the joists (the upstairs floor, or under the roof)
  for (let x = -BW / 2 + .2; x < BW / 2 - .2; x += .24) KI.box('board', .23, .03, BD - .3, x + .12, H1 - .12, 0, 0, 0, 0, tint(S.liner || 0xb8ae9c, .1));
  for (let z = -BD / 2 + .6; z < BD / 2; z += 1.2) KI.box('board', BW - .3, .14, .09, 0, H1 - .2, z, 0, 0, 0, 0x5a4a3a);
  // ---- the roof ----
  const ov = .55, pal = S.roofPal || RUST;
  const sheet = (x, y, z, w, len, rx, c) => K.box('corr', w, .02, len, x, y, z, rx, 0, hr(-.012, .012), c);
  if (S.roof === 'gable') {
    const a = .42, half = BD / 2 + ov, len = half / Math.cos(a) + .1, ridge = HT + BD / 2 * Math.tan(a);
    for (const s of [1, -1]) {
      const cz = s * half / 2, cy = HT + (BD / 2 - half / 2) * Math.tan(a) + .02;
      for (let x = -BW / 2 - ov; x < BW / 2 + ov - .1; x += .84) sheet(x + .43, cy + ((x * 7) % 2 > 1 ? .012 : 0), cz, .9, len, s * a, hp(.1) ? tint(0x6a7f96) : tint(hpick(pal), .1));
      K.box('board', BW + ov * 2 + .1, .2, .05, 0, HT - ov * Math.tan(a) - .1, s * (half + .02), 0, 0, 0, tint(0x5a4a3a));   // fascia
      // gutter + downpipe at the front corner, into a barrel
      K.cyl('metal', .09, .09, BW + ov * 2, 8, 0, HT - ov * Math.tan(a) - .17, s * (half + .1), 0, 0, Math.PI / 2, 0x6a6a66, true, 0, Math.PI);
    }
    K.box('corr', BW + ov * 2 + .1, .03, .5, 0, ridge + .03, .16, -.42, 0, 0, tint(0x7a7672)); K.box('corr', BW + ov * 2 + .1, .03, .5, 0, ridge + .03, -.16, .42, 0, 0, tint(0x7a7672));
    S._eave = HT - ov * Math.tan(a) - .17;
  } else {
    const rise = 1.1, ovF = S.upper ? .6 : 1.6, dz = BD + ov + ovF, a = Math.atan2(rise, BD), len = dz / Math.cos(a) + .1;
    const cz = (ovF - ov) / 2, cy = HT + rise / 2 + (cz / BD) * rise + .04;
    for (let x = -BW / 2 - ov; x < BW / 2 + ov - .1; x += .84) sheet(x + .43, cy + (Math.round(x / .84) % 2 ? .014 : 0), cz, .9, len, -a, hp(.1) ? tint(0x6a7f96) : tint(hpick(pal), .1));
    for (const s of [-1, 1]) K.box('board', BW + ov * 2, .2, .05, 0, s > 0 ? HT + rise * (BD / 2 + ovF) / BD + rise / 2 - .06 : HT + rise * (-BD / 2 - ov) / BD + rise / 2 - .06, s > 0 ? BD / 2 + ovF : -BD / 2 - ov, 0, 0, 0, tint(0x5a4a3a));
    K.cyl('metal', .09, .09, BW + ov * 2, 8, 0, HT - ov * rise / BD - .2, -BD / 2 - ov - .1, 0, 0, Math.PI / 2, 0x6a6a66, true, 0, Math.PI);
    if (ovF > 1) for (const s of [-1, 1]) K.box('board', .14, HT + rise - .05, .14, s * (BW / 2 + .2), (HT + rise) / 2 - .1, BD / 2 + ovF - .2, 0, 0, 0, tint(0x5a4a3a));
    S._eave = HT - ov * rise / BD - .2;
  }
  // a tarp over the leaks, held down with tyres and sandbags
  if (S.tarp) { const [tx, tz, tw, td] = S.tarp, ty = S.roof === 'gable' ? HT + (BD / 2 - Math.abs(tz)) * Math.tan(.42) + .06 : HT + 1.1 * (tz + BD / 2) / BD + .58;
    const tg = new THREE.PlaneGeometry(tw, td, 6, 6); const pa = tg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, (hash(pa.getX(i) * 3, pa.getY(i) * 3) - .5) * .06); tg.computeVertexNormals();
    K.geo('cloth', tg, htm(tx, ty, tz, -Math.PI / 2 + (S.roof === 'gable' ? (tz > 0 ? .42 : -.42) : .11), 0, 0), S.tarpC || 0x3a5a8a);
    for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(.26, .1, 6, 12); t.rotateX(Math.PI / 2); K.geo('plain', t, htm(tx + hr(-tw / 2.5, tw / 2.5), ty + .1, tz + hr(-td / 3, td / 3), (S.roof === 'gable' ? (tz > 0 ? .42 : -.42) : .11), 0, 0), 0x1e1e1e); } }
  // rain barrel under the back gutter, with its downpipe
  { const bx = H2 ? -BW / 2 + .5 : BW / 2 - .5, bz = -BD / 2 - .55; barrel(K, bx, 0, bz, tint(0x3a4a5a)); K.cyl('metal', .045, .045, S._eave - .9, 6, bx + .1, .9 + (S._eave - .9) / 2, -BD / 2 - .62, 0, 0, 0, 0x6a6a66); }
  if (S.chim) stovepipe(K, S.chim[0], HT - .2, S.chim[1], (S.roof === 'gable' ? BD / 2 * Math.tan(.42) : 1.1) + 1.4);
  // an aerial and a panel or two on the roof
  if (S.aerial) { K.cyl('metal', .025, .03, 3.4, 5, -BW / 2 + .4, HT + 1.6, -BD / 2 + .3, 0, 0, 0, 0x5a5a58); for (let i = 0; i < 4; i++) K.box('metal', .9 - i * .15, .02, .02, -BW / 2 + .4, HT + 2.4 + i * .3, -BD / 2 + .3, 0, .5, 0, 0x5a5a58); }
  if (S.solar) { const sy = S.roof === 'gable' ? HT + BD / 4 * Math.tan(.42) + .15 : HT + .9, sz = S.roof === 'gable' ? -BD / 4 : -BD * .15;
    for (const sx of [-BW / 4, 0]) { K.box('hull', 1.6, .05, 1.1, sx, sy, sz, S.roof === 'gable' ? -.42 : -.11, 0, 0, 0x2a3a5a, 1.2); K.box('metal', 1.66, .04, 1.16, sx, sy - .03, sz, S.roof === 'gable' ? -.42 : -.11, 0, 0, 0x8a8a88); } }
  // ---- the upstairs: balcony over the shop front, stairs up the back ----
  if (H2) {
    const bd = 1.5, x0 = -BW / 2 + .4, x1 = BW / 2 - .4;
    for (let x = x0; x < x1; x += .2) K.box('board', .19, .05, bd, x + .1, H1 + .02, BD / 2 + bd / 2, 0, 0, 0, tint(0x7a6a56, .12));
    K.box('board', x1 - x0, .2, .08, (x0 + x1) / 2, H1 - .1, BD / 2 + bd, 0, 0, 0, tint(0x5a4a3a));
    for (const px of [x0 + .1, x1 - .1]) K.box('board', .15, H1, .15, px, H1 / 2, BD / 2 + bd - .1, 0, 0, 0, tint(0x5a4a3a));
    K.box('board', x1 - x0, .07, .07, (x0 + x1) / 2, H1 + 1, BD / 2 + bd - .05, 0, 0, 0, tint(0x5a4a3a));
    for (let x = x0 + .3; x < x1 - .2; x += .45) K.box('board', .05, .95, .05, x, H1 + .5, BD / 2 + bd - .05, 0, 0, 0, tint(0x6a5a48));
    for (let i = 0; i < 3; i++) { const px = hr(x0 + .5, x1 - .5); K.cyl('plain', .17, .13, .3, 8, px, H1 + .2, BD / 2 + bd - .3, 0, 0, 0, tint(0x8a5a3a)); const pg = new THREE.SphereGeometry(.22, 7, 5); pg.scale(1, .8, 1); K.geo('plain', pg, htm(px, H1 + .45, BD / 2 + bd - .3), tint(0x4a6a32)); }
    { const cx = hr(x0 + 1, x1 - 1); K.box('board', .45, .05, .45, cx, H1 + .45, BD / 2 + .6); for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) K.box('board', .04, .45, .04, cx + dx, H1 + .22, BD / 2 + .6 + dz); K.box('board', .45, .5, .04, cx, H1 + .72, BD / 2 + .38, -.1); }
    laundry(K, x0 + .1, H1 + 2.2, BD / 2 + bd - .1, x1 - .1, H1 + 2.1, BD / 2 + bd - .1);
    // stairs up the back to the upstairs door
    const sx1 = BW / 2 - .9, sx0 = sx1 - H1 / .19 * .26, n = Math.ceil(H1 / .19), sz = -BD / 2 - .62;
    for (let i = 0; i < n; i++) { const t = i / n; K.box('board', .26, .04, .95, sx0 + (n - 1 - i) * .26 + .13, (i + 1) * H1 / n, sz, 0, 0, 0, tint(0x7a6a56, .1)); }
    const sl = Math.hypot(sx1 - sx0, H1); for (const dz of [-.47, .47]) K.box('board', sl, .25, .06, (sx0 + sx1) / 2, H1 / 2, sz + dz, 0, 0, Math.atan2(-H1, sx1 - sx0), tint(0x5a4a3a));
    K.box('board', 1.4, .06, 1, sx1 + .4, H1, sz, 0, 0, 0, tint(0x7a6a56)); K.box('board', .12, H1, .12, sx1 + 1, H1 / 2, sz - .4, 0, 0, 0, 0x5a4a3a); K.box('board', .12, H1, .12, sx1 + 1, H1 / 2, sz + .4, 0, 0, 0, 0x5a4a3a);
    K.box('board', sl, .06, .06, (sx0 + sx1) / 2, H1 / 2 + .95, sz - .5, 0, 0, Math.atan2(-H1, sx1 - sx0), tint(0x5a4a3a));
    const a = shopL2W(D, sx0, sz), b = shopL2W(D, sx1 + 1, sz); addColLine(a.x, a.z, b.x, b.z, .55);
    for (const px of [x0 + .1, x1 - .1]) { const p = shopL2W(D, px, BD / 2 + bd - .1); addCol(p.x, p.z, .22); }
  }
  // ---- a lean-to on the back: firewood, drums, whatever doesn't fit inside ----
  if (S.lean) {
    const lz = -BD / 2 - 1.1, lw = BW * .55, lx = -BW / 2 + lw / 2 + .2, ly = Math.min(S._eave, 2.6);
    for (let x = lx - lw / 2; x < lx + lw / 2 - .1; x += .84) K.box('corr', .9, .02, 2.3, x + .43, ly - .2, lz + .1, .2, 0, 0, tint(hpick(RUST), .1));
    for (const px of [lx - lw / 2 + .1, lx + lw / 2 - .1]) K.box('board', .12, ly - .35, .12, px, (ly - .35) / 2, lz - .95, 0, 0, 0, 0x5a4a3a);
    K.box('board', lw, .12, .12, lx, ly - .4, lz - .95, 0, 0, 0, 0x5a4a3a);
    // stacked firewood
    for (let r = 0; r < 5; r++) for (let i = 0; i < Math.floor(lw * 2.4) - r; i++) K.cyl('board', .07, .07, .5, 6, lx - lw / 2 + .4 + i * .15 + r * .07, .07 + r * .13, lz + .1, Math.PI / 2, 0, 0, tint(0x8a6a4a, .2));
    const a = shopL2W(D, lx - lw / 2, lz - .4), b = shopL2W(D, lx + lw / 2, lz - .4); addColLine(a.x, a.z, b.x, b.z, .7);
  }
  // ---- the sign ----
  if (S.sign) {
    const [txt, style] = S.sign, sm = hSignMat(txt, style), dk = M(0x2e2a26), sy = S.upper ? H1 + .3 : H1 + .55;
    const sg = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.15, .1), [dk, dk, dk, dk, sm, dk]); sg.position.set(0, S.upper ? H1 - .45 : sy, BD / 2 + (S.upper ? 1.55 : .14)); sg.rotation.z = hr(-.025, .025); sg.castShadow = true; g.add(sg);
    if (!S.upper) for (const s of [-1, 1]) K.cyl('metal', .01, .01, .6, 4, s * 2.4, sy + .85, BD / 2 + .14, 0, 0, s * .15, 0x3a3a38);
  }
  K.build(g);
  return { g, inner, K: KI, BW, BD, H1, HT, OPEN };
}

/* ---------- what's inside: the counter, the back wall, the keeper's own corner, and each trade's tools ---------- */
const HOUSE_STYLE = {
  craft:   { clad: 'corr', base: 'block', col: 0x9aa0a4, pal: [0x9c9a94, 0x8a8a86, 0xb07850, 0xa88a72], roof: 'shed', front: 'rollup', lean: true, chim: [3.9, 1.4], aerial: true, sign: ['WORKSHOP', 'stencil'], tarp: [-2, -1, 3, 2.6], tarpC: 0x4a5a3a, sideDoor: 'left', frame: 0x4a4644, bars: false, floor: 'conc' },
  trade:   { clad: 'board', col: 0x6f8a7c, patch: 0xa86a4a, roof: 'gable', upper: true, shutters: 0x5a6a4a, sign: ['TRADING POST', '#c8a050'], frame: 0x4a3c2e, floor: 'board', door: 0x7a5a3a, tarp: [2.5, 2, 3.4, 2.4], tarpC: 0x9a6a2a },
  med:     { clad: 'board', base: 'block', col: 0xd8d4c6, patch: 0x9aa8b0, roof: 'gable', solar: true, sign: ['CLINIC', '#b8392e'], frame: 0x8a8a84, lean: true, floor: 'board', sideDoor: 'right', shutters: 0xa8b0a8, door: 0xa8aca4 },
  wear:    { clad: 'board', col: 0x9a6458, patch: 0x6a7a8a, roof: 'gable', upper: true, shutters: 0x4a5a6a, sign: ['OUTFITTER', '#d8c8a8'], frame: 0x4a3c2e, floor: 'board', door: 0x5a6a7a },
  guns:    { clad: 'hull', base: 'block', col: 0xc0beb6, roof: 'shed', pal: [0x8a8a86, 0x7a7a76, 0x9c9a94], sign: ['GUNSMITH', 'stencil'], frame: 0x3a3836, bars: true, metalDoor: true, boarded: .05, lean: true, aerial: true, floor: 'conc', sideDoor: 'left' },
  cook:    { clad: 'board', base: 'block', col: 0xa8885e, patch: 0x7a8a6a, roof: 'gable', chim: [-3.3, .5], sign: ['COOKHOUSE', '#e0b060'], frame: 0x4a3c2e, lean: true, floor: 'board', shutters: 0x7a4a32, door: 0x6a4a32, tarp: [-3, -2, 3, 2.2], tarpC: 0x6a7a4a },
  bunk:    { clad: 'corr', col: 0x7a8a6a, pal: [0x7a8a6a, 0x8a9a7a, 0x9c9a94, 0xb07850], roof: 'gable', upper: true, sign: ['BUNKHOUSE', '#c8c0a8'], frame: 0x4a4644, floor: 'board', door: 0x5a6a4a, solar: true, aerial: true },
  salvage: { clad: 'corr', col: 0x9a8a7a, pal: [0xb07850, 0x9a6a4a, 0x8a5a3a, 0xa88a72, 0x9c9a94], patch: 0xc0beb6, roof: 'shed', front: 'rollup', lean: true, sign: ['SALVAGE', 'spray'], frame: 0x4a4644, floor: 'conc', tarp: [1, 0, 3.6, 3], tarpC: 0x8a4a2a, sideDoor: 'right' },
};
const STOCK_COL = { cook: [0x8a3a2a, 0x7a6a4a, 0xc8a050, 0x5a7a3a], craft: [0x6d7276, 0x9a6040, 0x8a8c8c, 0x3a5a7a], trade: [0x7a5a3e, 0x6a7a5a, 0x9a8a6a, 0x5a6a7a, 0xa87a4a],
  med: [0xd8d8d0, 0xc04040, 0x8ab0c8, 0xe0e0d8], guns: [0x2e3424, 0x4f5a3a, 0x3a3a3a, 0x6a5a3a], wear: [0x6a4a32, 0x5a6a7a, 0x8a7a5a, 0x7a3a3a, 0x3a4a5a], bunk: [0x6a7a5a, 0x8a8a80, 0x5a6a7a], salvage: [0x8a8c8c, 0x9a6040, 0x6d7276, 0xb0905a] };

function shopHouse(D) {
  const S = HOUSE_STYLE[D.id], Hs = raiseHouse(D, S), K = Hs.K, g = Hs.g, inner = Hs.inner;
  const { BW, BD, H1 } = Hs, stuff = STOCK_COL[D.id], sx = -3.9, sz = 1.2;
  // the counter: boards on a frame, a worn top, the till box, a lamp
  if (D.who) {
    for (let x = -3.05; x < 3.05; x += .2) K.box('board', .19, 1, .05, x + .1, .52, .7, 0, 0, hr(-.01, .01), tint(S.col && S.clad === 'board' ? S.col : 0x7a6650, .1));
    K.box('board', 6.4, .07, .95, 0, 1.08, .32, 0, 0, 0, tint(0x6a5038)); K.box('board', 6.1, .9, .06, 0, .5, -.12, 0, 0, 0, 0x4a3a2c);
    K.box('metal', .45, .22, .32, 1.6, 1.23, .2, 0, .3, 0, 0x4a4a46);                                 // the till
    K.cyl('shiny', .08, .1, .22, 8, 2.6, 1.23, .3, 0, 0, 0, 0x6a5a3a); K.cyl('glow', .06, .06, .14, 8, 2.6, 1.4, .3, 0, 0, 0, 0xffc870); K.cyl('shiny', .09, .06, .05, 8, 2.6, 1.5, .3, 0, 0, 0, 0x6a5a3a);
    for (let i = 0; i < 5; i++) { const x = hr(-2.6, .8); if (hp(.5)) crate(K, x, 1.11, hr(.1, .5), hr(0, .4), .45, tint(hpick(stuff))); else K.cyl('metal', .06, .06, hr(.1, .2), 8, x, 1.2, hr(.1, .5), 0, 0, 0, tint(hpick(stuff))); }
    K.poster(hpick([0, 2, 4, 5]), .55, .7, -2.4, 1.45, .75, 0);
  }
  // the back wall: shelves of stock, a pegboard of tools or a cabinet
  const bz = -BD / 2 + .3;
  shelf(K, -BW / 4, bz, BW / 2 - .8, 0, 4, stuff); shelf(K, BW / 4, bz, BW / 2 - .8, 0, 3, stuff);
  // posters, a calendar, a kid's drawing on the walls
  K.poster(2, .5, .6, -BW / 2 + .12, 1.9, -1.2, Math.PI / 2); K.poster(hpick([3, 6, 7]), .45, .55, BW / 2 - .12, 1.7, -2.2, -Math.PI / 2);
  // the light: a fluorescent tube hung on chains (lit at night), a rug, a stool, a bucket, a broom
  hput(inner, fixture(), 0, H1 - .55, -1.2);
  for (const dx of [-.55, .55]) K.cyl('metal', .006, .006, .5, 3, dx, H1 - .27, -1.2, 0, 0, 0, 0x3a3a38);
  K.box('glow', 1.1, .03, .05, 0, H1 - .61, -1.2, 0, 0, 0, 0xfff2d8);
  K.box('cloth', 2.2, .015, 1.4, -.4, .26, -2.2, 0, hr(-.1, .1), 0, hpick([0x7a3a2a, 0x3a4a6a, 0x6a5a3a]));
  K.cyl('board', .17, .17, .04, 10, -1.6, .66, -1.6, 0, 0, 0, 0x6a5038); for (let i = 0; i < 3; i++) K.cyl('board', .02, .025, .64, 4, -1.6 + Math.cos(i * 2.1) * .12, .33, -1.6 + Math.sin(i * 2.1) * .12, Math.sin(i * 2.1) * .12, 0, -Math.cos(i * 2.1) * .12, 0x5a4030);
  K.cyl('metal', .16, .12, .3, 10, BW / 2 - .6, .4, -1, 0, 0, 0, 0x6a7078); K.cyl('board', .015, .015, 1.4, 4, BW / 2 - .25, .9, -.4, .12, 0, .25, 0x8a6a4a);
  // ---- each trade ----
  const id = D.id;
  if (id === 'craft') {
    // the workbench (the station): a heavy top on trestles, a vice, the wrench set, the tool roll; the pegboard behind it
    K.box('board', 1.3, .12, 2.7, sx, .98, sz, 0, 0, 0, 0x6a5038); for (const [x, z] of [[-.55, -1.2], [.55, -1.2], [-.55, 1.2], [.55, 1.2]]) K.box('board', .1, .95, .1, sx + x, .48, sz + z, 0, 0, 0, 0x4a3a2c);
    K.box('board', 1.2, .05, 2.5, sx, .32, sz, 0, 0, 0, 0x5a4a3a);
    K.box('metal', .2, .16, .14, sx + .45, 1.12, sz - 1, 0, 0, 0, 0x3a5a7a); K.box('metal', .06, .06, .3, sx + .45, 1.12, sz - .82, 0, 0, Math.PI / 2, 0x3a3a38);
    hput(inner, hmodel('props/wrenches', .45, 'z'), sx - .2, 1.04, sz - .2, .3);
    hput(inner, hmodel('props/tool-roll', .9, 'x'), sx + .1, 1.05, sz + .7, Math.PI / 2 + .2);
    K.box('board', .04, 1.2, 2.2, -BW / 2 + .2, 1.7, sz - .2, 0, 0, 0, 0x8a7a5a);                     // pegboard on the side wall
    const tools = ['hammer1', 'hammer2', 'wrench', 'adjustable_wrench', 'screwdriver', 'pliers', 'prybar', 'hatchet', 'clamp', 'socket_wrench'];
    tools.forEach((t, i) => hput(inner, hpart('props/hand-tools', n => n.startsWith(t + '_lod'), t === 'prybar' ? .6 : t === 'hatchet' ? .42 : .28, 'x'), -BW / 2 + .26, 2.05 - (i % 2) * .55, sz - 1.1 + Math.floor(i / 2) * .45, Math.PI / 2, 0, Math.PI / 2 - .2));
    // the forge (gameplay spot) and its anvil, a quench barrel, gas bottles, an engine on a stand
    const fx = 3.9, fz = 1.4;
    K.box('rock', 1.6, 1.05, 1.4, fx, .52, fz, 0, 0, 0, 0x8a827a, 1.5); K.box('rock', 1.3, .5, 1.1, fx, 1.3, fz - .1, 0, 0, 0, 0x6a625a, 1.5);
    K.box('glow', .7, .32, .04, fx, .8, fz + .71, 0, 0, 0, 0xff7a24); K.box('glow', .9, .05, .7, fx, 1.07, fz - .05, 0, 0, 0, 0xff5a14);
    K.box('metal', 1.1, .9, .9, fx, 1.95, fz - .1, 0, 0, 0, 0x3a3634); stovepipe(K, fx, 2.4, fz - .1, Hs.HT - 2.1);
    K.box('metal', .62, .2, .26, 2.3, .95, 2.45, 0, .2, 0, 0x2e2e2e); K.box('metal', .2, .22, .2, 2.62, .97, 2.45, 0, .2, Math.PI / 4, 0x2e2e2e); K.cyl('board', .22, .26, .85, 8, 2.3, .42, 2.45, 0, 0, 0, 0x5a4030);
    barrel(K, 5, 0, 2.7, 0x4a4f56, .7);
    if (!MODELS['props/gas-bottle']) for (const [x, z, c] of [[-BW / 2 + .5, 3.4, 0x2a5a3a], [-BW / 2 + .8, 3.6, 0x8a2a22]]) { K.cyl('metal', .13, .13, 1.2, 10, x, .6, z, 0, 0, 0, c); K.cyl('shiny', .04, .06, .12, 6, x, 1.26, z, 0, 0, 0, 0x8a7a50); }
    { const ex = 2, ez = -2.5; K.box('metal', .9, .7, .6, ex, 1.1, ez, 0, .3, 0, 0x4a4a48); for (let i = 0; i < 4; i++) K.cyl('metal', .1, .1, .3, 8, ex - .3 + i * .2, 1.55, ez, 0, .3, 0, 0x5a5a58); K.box('metal', .7, .7, .5, ex, .38, ez, 0, .3, 0, 0x2a2a28); }
    // the roll-up door, mostly up
    for (let i = 0; i < 6; i++) K.box('metal', BW - 3.1, .12, .05, 0, H1 - .1 - i * .13, BD / 2 - .12, 0, 0, 0, tint(0x8a8e90, .05));
    hput(inner, hpart('props/tool-racks', () => true, 1.5, 'y'), BW / 2 + .5, 0, 1.8, -Math.PI / 2);
    const w = shopL2W(D, fx, fz); addCol(w.x, w.z, 1);
  } else if (id === 'trade') {
    // barrels and sacks in front, a scale on the table (the station), coils of rope and baskets hung from the beams
    for (const [x, z, c] of [[sx, sz, 0x5a4a3a], [sx + .75, sz + .65, 0x6a5a3a], [3.8, 1.2, 0x3a4a5a], [4.3, 2.2, 0x5a4a3a]]) barrel(K, x, .22, z, tint(c));
    for (let i = 0; i < 6; i++) crate(K, hr(-4.6, 4.6), .22, BD / 2 + hr(.8, 2.2), hr(0, 3), hr(.9, 1.3), tint(hpick(stuff)));
    for (let i = 0; i < 7; i++) sack(K, 3.3 + (i % 4) * .4, .22 + Math.floor(i / 4) * .3, -1.7, 1);
    K.box('board', 1.4, .08, .9, sx, .92, sz + .4, 0, 0, 0, 0x6a5038); for (const [x, z] of [[-.6, -.35], [.6, -.35], [-.6, .35], [.6, .35]]) K.box('board', .07, .88, .07, sx + x, .48, sz + .4 + z, 0, 0, 0, 0x4a3a2c);
    K.cyl('shiny', .2, .2, .03, 12, sx - .3, 1.05, sz + .4, 0, 0, 0, 0x9a8a5a); K.cyl('metal', .02, .02, .3, 4, sx - .3, 1.2, sz + .4, 0, 0, 0, 0x3a3a38); K.box('metal', .5, .02, .02, sx - .3, 1.35, sz + .4, 0, 0, 0, 0x3a3a38);
    for (let i = 0; i < 6; i++) { const x = -4 + i * 1.5; const t = new THREE.TorusGeometry(.2, .05, 5, 12); K.geo('cloth', t, htm(x, H1 - .6, -.4, hr(-.3, .3), 0, 0), hpick([0xa89a6a, 0x8a7a50])); K.cyl('cloth', .005, .005, .5, 3, x, H1 - .2, -.4, 0, 0, 0, 0x3a3a38); }
    for (let i = 0; i < 4; i++) K.cyl('cloth', .2, .14, .25, 10, -3 + i * 1.8, H1 - .9, 1.4, 0, 0, 0, tint(0x9a7a4a), true);
    // bunting across the front
    for (let i = 0; i < 16; i++) { const x = -BW / 2 + .5 + i * (BW - 1) / 15, y = H1 + .05 - Math.sin(i / 15 * Math.PI) * .35; const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([-.12, 0, 0, .12, 0, 0, 0, -.28, 0], 3)); tg.computeVertexNormals(); K.geo('cloth', tg, htm(x, y, BD / 2 + .3), hpick([0xc0392b, 0xe0b040, 0x2e86c1, 0x3a8a4a, 0xd8d4c8])); }
  } else if (id === 'med') {
    // two beds behind curtains, an IV stand, the lab table (the station), cabinets of bottles, a radiator, a sink
    for (const x of [2, 4.4]) {
      K.box('metal', .95, .05, 2, x, .55, -2.6, 0, 0, 0, 0x8a8e90); for (const [dx, dz] of [[-.43, -.95], [.43, -.95], [-.43, .95], [.43, .95]]) K.cyl('metal', .02, .02, .55, 5, x + dx, .28, -2.6 + dz, 0, 0, 0, 0x6a6e70);
      K.box('cloth', .9, .14, 1.95, x, .65, -2.6, 0, 0, 0, 0xe0ddd2); K.box('cloth', .92, .05, 1.2, x, .74, -2.3, 0, 0, hr(-.04, .04), hpick([0x8aa0b8, 0x7a8a6a, 0xb8a888])); K.box('cloth', .55, .1, .32, x, .78, -3.4, 0, 0, 0, 0xf0ece0);
      K.box('metal', .9, .06, .04, x, .9, -3.6, 0, 0, 0, 0x8a8e90);
      const cg = new THREE.PlaneGeometry(2.1, 1.9, 8, 1); const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 9) * .06); cg.computeVertexNormals();
      K.geo('cloth', cg, htm(x - .65, 1.25, -2.6, 0, Math.PI / 2, 0), 0xc8d0c4); K.box('metal', .02, .02, 2.2, x - .65, 2.22, -2.6, 0, 0, 0, 0x8a8e90);
    }
    K.cyl('metal', .015, .015, 1.8, 5, 5.2, .9, -1.6, 0, 0, 0, 0x9a9e9e); K.box('glass', .14, .22, .05, 5.2, 1.65, -1.6, 0, 0, 0); K.cyl('metal', .2, .2, .02, 6, 5.2, .02, -1.6, 0, 0, 0, 0x6a6e70);
    K.box('metal', 1.2, .06, 2.2, sx, .95, sz, 0, 0, 0, 0xb8bcb8); K.box('metal', 1.1, .88, 2, sx, .45, sz, 0, 0, 0, 0x8a8e8a);
    bottleRow(K, sx - .45, sx + .45, .98, sz - .7); K.cyl('glass', .12, .12, .3, 10, sx + .3, 1.13, sz + .5, 0, 0, 0); K.box('plain', .3, .12, .2, sx - .2, 1.04, sz + .6, 0, 0, 0, 0xd8d4c8);
    K.box('metal', .9, 1.9, .45, -BW / 2 + .4, .95, -2.8, 0, 0, 0, 0xc8ccc8); for (const y of [.5, .9, 1.3, 1.7]) bottleRow(K, -.38, .38, y, 0, 0, 0) || 0;
    for (const y of [.7, 1.15, 1.6]) bottleRow(K, -BW / 2 + .1, -BW / 2 + .7, y, -2.6);
    hput(inner, hmodel('props/radiator', .8, 'y'), BW / 2 - .25, .25, -1.3, -Math.PI / 2);
    K.box('metal', .6, .08, .45, -BW / 2 + .4, .9, 2.6, 0, 0, 0, 0xd8dcd8); K.cyl('shiny', .2, .16, .12, 10, -BW / 2 + .4, .9, 2.6, 0, 0, 0, 0xb8bcbc, true); K.cyl('shiny', .02, .02, .3, 5, -BW / 2 + .2, 1.1, 2.6, 0, 0, .5, 0x8a8e8e);
    K.box('glow', .9, .9, .02, 0, H1 + .9, BD / 2 + .06, 0, 0, 0, 0xffffff); const cr = 0xc8392e; K.box('glow', .65, .2, .03, 0, H1 + .9, BD / 2 + .08, 0, 0, 0, cr); K.box('glow', .2, .65, .03, 0, H1 + .9, BD / 2 + .08, 0, 0, 0, cr);
  } else if (id === 'wear') {
    // racks of coats, a mannequin in a vest, the sewing table (the station) with bolts of cloth, hides stretched on frames outside
    for (const x of [2.2, 3.8]) { K.box('metal', .04, 1.8, .04, x - .7, .9, -1.8, 0, 0, 0, 0x3a3a3a); K.box('metal', .04, 1.8, .04, x + .7, .9, -1.8, 0, 0, 0, 0x3a3a3a); K.box('metal', 1.5, .04, .04, x, 1.8, -1.8, 0, 0, 0, 0x3a3a3a);
      for (let k = 0; k < 6; k++) { const c = hpick(stuff); K.box('cloth', .36, hr(.8, 1.1), .16, x - .6 + k * .24, 1.3, -1.8, 0, hr(-.3, .3), 0, tint(c)); K.box('cloth', .1, .7, .1, x - .6 + k * .24 + .2, 1.3, -1.75, 0, 0, .1, tint(c)); } }
    K.box('board', 1.2, .08, 2.2, sx, .95, sz, 0, 0, 0, 0x6a5038); K.box('board', 1.1, .88, 2, sx, .45, sz, 0, 0, 0, 0x5a4430);
    for (let i = 0; i < 4; i++) K.cyl('cloth', .09, .09, .9, 10, sx - .3 + i * .2, 1.08, sz + .2, Math.PI / 2, 0, 0, tint(hpick(stuff)));
    K.box('cloth', .7, .03, .5, sx + .1, 1.0, sz - .6, 0, .2, 0, 0xb8a888); K.box('metal', .3, .25, .2, sx - .2, 1.12, sz - .9, 0, 0, 0, 0x2a2a2a);
    { const mx = 4, mz = 2.6; K.cyl('metal', .05, .05, 1.2, 5, mx, .6, mz, 0, 0, 0, 0x3a3a3a); K.cyl('metal', .25, .25, .03, 8, mx, .02, mz, 0, 0, 0, 0x3a3a3a);
      const tg = new THREE.CylinderGeometry(.2, .16, .65, 10); tg.scale(1, 1, .6); K.geo('plain', tg, htm(mx, 1.45, mz), 0xb0a090); K.box('cloth', .48, .55, .3, mx, 1.45, mz, 0, 0, 0, 0x5a6a4a); K.cyl('plain', .12, .12, .2, 8, mx, 1.86, mz, 0, 0, 0, 0xb0a090); }
    for (let i = 0; i < 6; i++) { const x = -4.6 + i * .3; K.box('plain', .12, .14, .26, x, .29, -BD / 2 + .7, 0, 0, 0, hpick([0x3a2a1e, 0x4a3a2a, 0x2a2a28])); }
    for (const fx of [-3.2, -1.6]) { const fz = BD / 2 + 1.6; for (const s of [-1, 1]) K.box('board', .07, 1.8, .07, fx + s * .6, .9, fz, 0, 0, 0, 0x5a4030); K.box('board', 1.3, .07, .07, fx, 1.75, fz, 0, 0, 0, 0x5a4030);
      const hg = new THREE.PlaneGeometry(1, 1.3, 3, 3); const hpz = hg.attributes.position; for (let i = 0; i < hpz.count; i++) { hpz.setX(i, hpz.getX(i) * (1 - Math.abs(hpz.getY(i)) * .25)); hpz.setZ(i, (hash(i, fx) - .5) * .05); } hg.computeVertexNormals();
      K.geo('cloth', hg, htm(fx, 1.05, fz), tint(0x8a6a48)); const w = shopL2W(D, fx, fz); addCol(w.x, w.z, .6); }
  } else if (id === 'guns') {
    // rifles racked on the back wall (the real models), crates of ammo, the gun bench (the station), sandbags along the front
    const rifles = ['gun-night', 'gun-desert', 'sniper', 'gun-night', 'gun-desert'];
    rifles.forEach((r, i) => { const m = hmodel(r, .95, r === 'sniper' ? 'x' : 'z'); if (!m) return; m.rotation.set(-Math.PI / 2 + .12, r === 'sniper' ? -Math.PI / 2 : 0, 0); m.position.set(-3.6 + i * .95, 1.55, -BD / 2 + .42); inner.add(m); m.traverse(o => { if (o.isMesh) o.castShadow = false; }); });
    K.box('board', 5.4, .08, .25, -1.7, 1.02, -BD / 2 + .42, 0, 0, 0, 0x4a3a2c); K.box('board', 5.4, .06, .14, -1.7, 2.1, -BD / 2 + .32, 0, 0, 0, 0x4a3a2c);
    for (const [x, y, z, r] of [[sx, .22, sz, .1], [sx + .2, .64, sz + .1, .4], [sx + .1, .22, sz + 1.1, -.2], [3.8, .22, 2, .3]]) { if (MODELS['ammo-crate']) { const c = modelCopy('ammo-crate', .42); c.position.set(x, y, z); c.rotation.y = r; inner.add(c); } else crate(K, x, y, z, r, 1, 0x4f5a3a); }
    K.box('metal', 1.2, .06, 2.4, sx + 6.5, .95, -1.8, 0, Math.PI / 2, 0, 0x5a5e60); K.box('metal', 1.1, .9, 2.2, sx + 6.5, .45, -1.8, 0, Math.PI / 2, 0, 0x3a3e40);
    hput(inner, hmodel('props/tool-roll', .9, 'x'), sx + 6.5, .99, -1.8, .1);
    for (let i = 0; i < 9; i++) { const x = -4.6 + (i % 5) * 1.15 + (i > 4 ? .55 : 0), y = .2 + (i > 4 ? .3 : 0), z = BD / 2 + 1.15; const sg = new THREE.BoxGeometry(1.05, .3, .5, 2, 1, 1); const pp = sg.attributes.position; for (let k = 0; k < pp.count; k++) { pp.setY(k, pp.getY(k) * (1 - Math.abs(pp.getX(k)) * .4)); } sg.computeVertexNormals(); K.geo('cloth', sg, htm(x, y, z, 0, hr(-.05, .05), 0), tint(0x8a7e5a)); }
    K.poster(6, .6, .6, BW / 2 - .1, 1.8, 0, -Math.PI / 2); K.poster(6, .6, .6, BW / 2 - .1, 1.8, -1.2, -Math.PI / 2);
  } else if (id === 'cook') {
    // the stove (the station) with the pot and kettle on it, the chimney, hams and herbs from the beams, a dresser of crockery, the long tables
    K.box('rock', 1.8, 1, 1.1, sx, .5, sz - .3, 0, 0, 0, 0x8a827a, 1.4); K.box('metal', 1.9, .06, 1.2, sx, 1.02, sz - .3, 0, 0, 0, 0x2a2a28);
    K.box('glow', .9, .35, .04, sx, .45, sz + .26, 0, 0, 0, 0xff6a1a);
    hput(inner, hpart('props/kitchen', n => /Cylinder\.00[2-6]_|^Vert_kitchen|Cube\.002_/.test(n), .55, 'x'), sx - .45, 1.05, sz - .3);
    hput(inner, hpart('props/kitchen', n => /Cylinder\.00[78]_|Vert\.002_/.test(n), .3, 'y'), sx + .5, 1.05, sz - .45, .6);
    hput(inner, hpart('props/kitchen', n => /^Cylinder_kitchen|^Plane_kitchen|Cylinder\.001_/.test(n), .55, 'x'), sx + .45, 1.06, sz + .05, -.4);
    stovepipe(K, sx + .6, 1.05, sz - .6, Hs.HT + 1.5);
    for (let i = 0; i < 7; i++) K.box('plain', .16, hr(.35, .65), .1, -2.2 + i * .55, H1 - .6, -1.4, 0, 0, hr(-.1, .1), hpick([0x8a3a2a, 0x7a2e22, 0x9a5a32]));
    for (let i = 0; i < 8; i++) { const hg = new THREE.ConeGeometry(.08, .35, 5); hg.rotateX(Math.PI); K.geo('cloth', hg, htm(.6 + i * .4, H1 - .45, -2.8), hpick([0x5a7a3a, 0x7a8a4a, 0x8a7a3a])); }
    K.box('board', 2.2, 2, .45, 3.2, 1, -BD / 2 + .9, 0, 0, 0, 0x6a4a32); for (const y of [.6, 1.1, 1.6]) { K.box('board', 2.1, .04, .42, 3.2, y, -BD / 2 + .9, 0, 0, 0, 0x7a5a3e); for (let k = 0; k < 7; k++) K.cyl('plain', .1, .1, .02, 10, 2.3 + k * .3, y + .12, -BD / 2 + .8, Math.PI / 2 - .2, 0, 0, hpick([0xe0dcd0, 0xc8c0b0, 0x8aa0b8])); }
    hput(inner, hpart('props/kitchen', n => /Cylinder\.009_|Cylinder\.01[0-2]_|Plane\.00[123]_|Vert\.001_|^Cube_kitchen|Cube\.006_/.test(n), .9, 'x'), 1.2, 1.1, .3);
    for (const tx of [-2.6, 2.6]) { const z = BD / 2 + 4.2;
      K.box('board', 3.4, .08, 1, tx, .85, z, 0, 0, 0, tint(0x7a6650)); for (const lx of [-1.5, 1.5]) K.box('board', .1, .85, .9, tx + lx, .42, z, 0, 0, 0, 0x5a4636);
      for (const s of [-1, 1]) { K.box('board', 3.2, .06, .32, tx, .45, z + s * .8, 0, 0, 0, 0x7a6650); for (const lx of [-1.4, 1.4]) K.box('board', .06, .45, .28, tx + lx, .22, z + s * .8, 0, 0, 0, 0x5a4636); }
      for (let k = 0; k < 4; k++) { K.cyl('plain', .14, .14, .02, 10, tx + hr(-1.4, 1.4), .9, z + hr(-.3, .3), 0, 0, 0, 0xa8a49a); if (hp(.6)) K.cyl('metal', .045, .04, .12, 8, tx + hr(-1.4, 1.4), .95, z + hr(-.35, .35), 0, 0, 0, hpick([0x6a7a8a, 0x8a5a3a])); }
      const w = shopL2W(D, tx, z); addCol(w.x, w.z, 1.4); }
    // smoke from the chimney
    const smk = []; const top = new THREE.Vector3(sx + .6, Hs.HT + 2.6, sz - .6);
    for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(rr(.3, .5), 6, 4), new THREE.MeshLambertMaterial({ color: 0xcfcac0, transparent: true, opacity: .3, depthWrite: false })); p.castShadow = false; g.add(p); smk.push([p, i / 8]); }
    DECOR_ANIM.push(tt => { for (const [p, k0] of smk) { const k = (k0 + tt * .07) % 1; p.position.set(top.x + Math.sin(k * 7) * k, top.y + k * 9, top.z + k * 2); p.scale.setScalar(1 + k * 2.5); p.material.opacity = .32 * (1 - k); } });
  } else if (id === 'bunk') {
    // bunks along the back with bedding and kit bags, lockers, a stove, boots by the door, a radiator, a table with cards
    for (let i = 0; i < 4; i++) { const x = -4.2 + i * 2.8, z = -2.4;
      for (const y of [.5, 1.8]) { K.box('board', 1, .12, 2.2, x, y, z, 0, 0, 0, 0x5a4a3a); K.box('cloth', .9, .14, 2, x, y + .13, z, 0, 0, 0, tint(hpick(stuff))); K.box('cloth', .92, .05, 1.3, x, y + .22, z + .3, 0, 0, hr(-.05, .05), tint(hpick(CLOTHC)));
        K.box('cloth', .5, .1, .3, x, y + .26, z - .85, 0, 0, 0, 0xd8d4c8); if (hp(.5)) sack(K, x + .25, y + .2, z + .7, .7); }
      for (const s2 of [-.45, .45]) for (const dz of [-1.05, 1.05]) K.box('board', .08, 2.4, .08, x + s2, 1.2, z + dz, 0, 0, 0, 0x4a3a2a);
      K.box('board', .06, .06, 1.4, x + .45, 1.2, z + 1.05, 0, Math.PI / 2, -.9, 0x4a3a2a); }
    for (let i = 0; i < 5; i++) K.box('metal', .55, 1.9, .5, -BW / 2 + .35, .95, 1.6 - i * .58, 0, 0, 0, tint(hpick([0x5a6a7a, 0x6a6e70, 0x4a5a6a]), .06));
    K.box('board', 2, .06, 1, sx + 2, .8, sz + 1, 0, 0, 0, 0x6a5038); for (const [dx, dz] of [[-.9, -.4], [.9, -.4], [-.9, .4], [.9, .4]]) K.box('board', .06, .78, .06, sx + 2 + dx, .4, sz + 1 + dz, 0, 0, 0, 0x4a3a2c);
    for (let k = 0; k < 9; k++) K.box('paper', .06, .002, .09, sx + 1.6 + hr(0, .8), .84, sz + 1 + hr(-.3, .3), 0, hr(0, 3), 0, 0xffffff);
    if (!MODELS['props/wood-stove']) { K.box('metal', .6, .8, .6, 3.6, .4, 2, 0, 0, 0, 0x2a2a28); K.box('glow', .25, .15, .02, 3.6, .3, 2.31, 0, 0, 0, 0xff6a1a); stovepipe(K, 3.6, .8, 1.9, Hs.HT + .9); }
    for (let i = 0; i < 6; i++) K.box('plain', .12, .15, .28, -1 + i * .25, .3, BD / 2 - .5, 0, hr(-.3, .3), 0, hpick([0x3a2a1e, 0x4a3a2a, 0x2a2a28]));
    hput(inner, hmodel('props/radiator', .8, 'y'), BW / 2 - .25, .25, .6, -Math.PI / 2);
    const b0 = shopL2W(D, -5, -2.4), b1 = shopL2W(D, 5, -2.4); addColLine(b0.x, b0.z, b1.x, b1.z, .9);
  } else if (id === 'salvage') {
    // heaps of scrap out front, the scale (the station), a chain hoist on an A-frame, Bryce's rusty pipe rig, wheels and panels stacked
    for (let i = 0; i < 3; i++) { const px = hr(-4, 4), pz = BD / 2 + hr(1.6, 3.4);
      for (let k = 0; k < 9; k++) K.box(hpick(['corr', 'metal', 'hull']), hr(.4, 1.4), hr(.05, .3), hr(.4, 1.2), px + hr(-.8, .8), hr(.1, .8), pz + hr(-.8, .8), hr(-.6, .6), hr(0, 3), hr(-.6, .6), tint(hpick(stuff)));
      for (let k = 0; k < 2; k++) { const t = new THREE.TorusGeometry(.32, .12, 6, 12); K.geo('plain', t, htm(px + hr(-1, 1), .15 + k * .2, pz + hr(-.6, .6), Math.PI / 2 + hr(-.2, .2), 0, 0), 0x1e1e1e); }
      const w = shopL2W(D, px, pz); addCol(w.x, w.z, 1.2); }
    K.box('metal', 1.4, .9, 1, sx, .45, sz, 0, 0, 0, 0x4a4c4e); K.box('shiny', 1.2, .06, .9, sx, .95, sz, 0, 0, 0, 0x8a8c8c);
    K.box('metal', .3, .5, .1, sx - .5, 1.25, sz - .4, -.2, 0, 0, 0x2a2c2e); K.box('glow', .22, .12, .02, sx - .5, 1.3, sz - .34, -.2, 0, 0, 0x8aff7a);
    { const ax = 3.6, az = 1.6; for (const s2 of [-1, 1]) for (const dz of [-.6, .6]) K.box('metal', .12, 3.1, .12, ax + s2 * .7, 1.5, az + dz, dz * .3, 0, s2 * -.22, 0x6a5a3a);
      K.box('metal', 1.9, .14, .14, ax, 2.98, az, 0, 0, 0, 0x6a5a3a); for (let k = 0; k < 14; k++) { const t = new THREE.TorusGeometry(.03, .01, 4, 6); K.geo('metal', t, htm(ax, 2.85 - k * .07, az, 0, k % 2 ? Math.PI / 2 : 0, 0), 0x3a3836); } K.box('metal', .14, .2, .1, ax, 1.8, az, 0, 0, 0, 0x3a3836); }
    hput(inner, hmodel('props/pipes', 2.2, 'x'), -BW / 2 + .6, 1.6, -1.6, Math.PI / 2);
    for (let i = 0; i < 6; i++) K.box('hull', 1.6, 1.1, .05, 1 + i * .06, .55, -BD / 2 + .5 + i * .1, -.15, 0, 0, tint(0xc0beb6, .06), 2);
  }
  dressShop(D, K, inner, Hs);                       // (Nov 10) Bryce's props: the wood stove, gas bottles, medkits, radios
  // collision: back + side walls, counter, the side station (as before), and the side door gaps left open
  const P0 = shopL2W(D, -BW / 2, -BD / 2), P1 = shopL2W(D, BW / 2, -BD / 2), P2 = shopL2W(D, -BW / 2, BD / 2), P3 = shopL2W(D, BW / 2, BD / 2);
  addColLine(P0.x, P0.z, P1.x, P1.z, .45); addColLine(P0.x, P0.z, P2.x, P2.z, .45); addColLine(P1.x, P1.z, P3.x, P3.z, .45);
  for (const s of [-1, 1]) { const a = shopL2W(D, s * (BW / 2 - 1.6), BD / 2); addColLine(a.x, a.z, P2.x * (s < 0) + P3.x * (s > 0), P2.z * (s < 0) + P3.z * (s > 0), .45); }
  if (D.who) { const c0 = shopL2W(D, -3, .3), c1 = shopL2W(D, 3, .3); addColLine(c0.x, c0.z, c1.x, c1.z, .5); }
  const st = shopL2W(D, sx, sz); addCol(st.x, st.z, .8);
  SHELTERS.push({ x: D.cx, z: D.cz, kind: 'house', r: 3.6 });
  K.build(inner, !LOW, true);
}

/* ---------- the yard between the buildings: power, cables, the notice board, lights, blast walls at the gate ---------- */
function wireBetween(K, a, b, sag = .5, col = 0x1e1e1e, r = .012) {
  const n = 8; let prev = a;
  for (let i = 1; i <= n; i++) { const t = i / n; const p = new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag, lerp(a.z, b.z, t));
    const L = prev.distanceTo(p), g = new THREE.CylinderGeometry(r, r, L, 3); g.rotateZ(Math.PI / 2);
    K.geo('plain', g, htm((prev.x + p.x) / 2, (prev.y + p.y) / 2, (prev.z + p.z) / 2, 0, Math.atan2(-(p.z - prev.z), p.x - prev.x), Math.atan2(p.y - prev.y, Math.hypot(p.x - prev.x, p.z - prev.z))), col); prev = p; }
}
function buildYard() {
  const g = new THREE.Group(); g.position.set(0, H0, 0); world.add(g);
  const K = hkit(LOW);
  // the power yard: Bryce's substation inside a fence, the genset beside it, a pole line out to the buildings
  const PX = 24, PZ = -8;
  const sub = hmodel('props/substation', 2.9); if (sub) { sub.position.set(PX, 0, PZ); sub.rotation.y = -Math.PI / 2; g.add(sub); }
  dressYard(g);
  K.box('conc', 7.4, .2, 5.4, PX + .8, .1, PZ, 0, 0, 0, 0xb8b2a8, 2);
  const fence = [[PX - 2.8, PZ - 2.5], [PX + 4.4, PZ - 2.5], [PX + 4.4, PZ + 2.5], [PX + 1.4, PZ + 2.5]];
  for (let i = 0; i < fence.length - 1; i++) { const [ax, az] = fence[i], [bx, bz] = fence[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.4);
    for (let k = 0; k <= n; k++) K.cyl('metal', .04, .04, 2.2, 6, lerp(ax, bx, k / n), 1.1, lerp(az, bz, k / n), 0, 0, 0, 0x6a6a66);
    const yaw = Math.atan2(-(bz - az), bx - ax); for (const y of [.15, 1.1, 2.15]) K.box('metal', L, .03, .03, (ax + bx) / 2, y, (az + bz) / 2, 0, yaw, 0, 0x6a6a66);
    for (let k = 0; k < L / .12; k++) { const t = k * .12 / L; K.box('metal', .008, 2, .008, lerp(ax, bx, t), 1.15, lerp(az, bz, t), 0, yaw, .7, 0x8a8a86); K.box('metal', .008, 2, .008, lerp(ax, bx, t), 1.15, lerp(az, bz, t), 0, yaw, -.7, 0x8a8a86); }
    addColLine(ax, az, bx, bz, .2); }
  K.box('board', 1.2, .6, .03, PX + 4.42, 1.5, PZ, 0, Math.PI / 2, 0, 0xd8c040); K.poster(5, .5, .5, PX + 4.45, 1.5, PZ, Math.PI / 2);
  // the genset (where the old generator was): a skid, the engine box, an exhaust, a fuel drum and a jerrycan
  { const gx = 14, gz = -11; K.box('metal', 2.6, .15, 1.3, gx, .08, gz, 0, 0, 0, 0x3a3a38); K.box('metal', 2.2, 1.2, 1.1, gx, .75, gz, 0, 0, 0, 0x6b7a3a); K.box('metal', .9, .9, 1.12, gx - .6, .7, gz, 0, 0, 0, 0x4a4a46);
    for (let i = 0; i < 6; i++) K.box('metal', .02, .7, .9, gx + .3 + i * .12, .78, gz + .57, 0, 0, 0, 0x2a2a28); K.cyl('metal', .07, .07, 1.4, 8, gx + .8, 1.9, gz - .3, 0, 0, 0, 0x3a3634); K.cyl('metal', .1, .07, .2, 8, gx + .8, 2.65, gz - .3, .4, 0, 0, 0x2a2826);
    barrel(K, gx - 1.8, 0, gz + .3, 0xa83a2a); K.box('metal', .35, .45, .18, gx - 1.7, .23, gz - .5, 0, .4, 0, 0x7a2a22); addCol(gx, gz, 1.3); }
  // poles: from the yard down Arc Row and up Main Street, wires to each building's eave
  const poles = [[PX - 3.2, PZ + 3], [10, -13], [-6, -13], [-24, -13], [-38, -6], [6, 6], [6, 26], [30, 16], [40, 16], [-6, 26], [-25, 26.5]];
  const tops = [];
  for (const [x, z] of poles) { const h = 6.2; K.cyl('board', .11, .14, h, 7, x, h / 2, z, hr(-.02, .02), 0, hr(-.02, .02), tint(0x6a5a46)); K.box('board', 1.4, .1, .1, x, h - .3, z, 0, hr(0, 3), 0, 0x5a4a3a);
    for (const s of [-.5, .5]) K.cyl('plain', .04, .05, .12, 6, x + s, h - .2, z, 0, 0, 0, 0xb8b0a0); addCol(x, z, .25); tops.push(new THREE.Vector3(x, h - .15, z)); }
  const chain = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 9], [9, 10], [0, 7], [7, 8]];
  for (const [a, b] of chain) wireBetween(K, tops[a], tops[b], .6);
  const toHouse = { craft: 2, trade: 10, med: 4, wear: 10, guns: 9, cook: 6, bunk: 8, salvage: 7 };
  for (const D of SHOP_DEFS) { const t = tops[toHouse[D.id]]; if (!t) continue; const e = shopL2W(D, D.bw / 2 - .3, D.bd / 2); wireBetween(K, t, new THREE.Vector3(e.x, (HOUSE_STYLE[D.id].upper ? 5.9 : 3.3), e.z), .4); }
  // string lights over the commons walk (warm after dark)
  { const pts = [[6, 2.5], [14, 1.5], [22, 2.5], [30, 1.5], [38, 2.5]];
    for (const [x, z] of pts) { K.cyl('board', .06, .07, 4, 6, x, 2, z + (z > 2 ? 1.6 : -1.6), 0, 0, 0, 0x5a4a3a); addCol(x, z + (z > 2 ? 1.6 : -1.6), .15); }
    for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(pts[i][0], 3.9, pts[i][1] + (pts[i][1] > 2 ? 1.6 : -1.6)), b = new THREE.Vector3(pts[i + 1][0], 3.9, pts[i + 1][1] + (pts[i + 1][1] > 2 ? 1.6 : -1.6));
      wireBetween(K, a, b, .45, 0x2a2a28, .008);
      for (let k = 1; k < 8; k++) { const t = k / 8; K.box('win', .07, .1, .07, lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * .45 - .07, lerp(a.z, b.z, t)); } } }
  // the notice board inside the gate: a roofed board of notices, a bench, a bucket of sand
  { const nx = 7, nz = 50, ry = -Math.PI / 2; const m = htm(nx, 0, nz, 0, ry, 0);
    K.at(m); for (const s of [-1, 1]) K.box('board', .12, 2.6, .12, s * 1.3, 1.3, 0, 0, 0, 0, 0x5a4a3a); K.box('board', 2.8, 1.5, .06, 0, 1.6, 0, 0, 0, 0, 0x8a7a5a);
    K.box('corr', 3.1, .03, .8, 0, 2.65, .1, .25, 0, 0, 0x9a6a4a);
    for (let i = 0; i < 9; i++) K.poster(i % 8, hr(.3, .5), hr(.38, .55), -1.1 + (i % 5) * .55 + hr(-.05, .05), 1.25 + Math.floor(i / 5) * .62 + hr(-.05, .05), .04, 0, hr(-.08, .08));
    K.box('board', 1.8, .06, .4, 0, .48, 1.4, 0, 0, 0, 0x7a6650); for (const s of [-1, 1]) K.box('board', .06, .46, .36, s * .8, .23, 1.4, 0, 0, 0, 0x5a4636);
    K.at(null); addColLine(nx, nz - 1.4, nx, nz + 1.4, .3); }
  // planters of herbs along the streets, a cart, a ladder against a wall
  for (const [x, z, r] of [[-5.5, 30, 0], [5.5, 14, 0], [-5.5, 44, 0], [5.5, 40, 0], [-27, 8, Math.PI / 2], [9, 26, 0]]) {
    K.box('board', 2.2, .45, .7, x, .23, z, 0, r, 0, tint(0x6a5038)); K.box('plain', 2.1, .05, .6, x, .44, z, 0, r, 0, 0x3a2e22);
    for (let i = 0; i < 7; i++) { const p = new THREE.Vector3(-.9 + i * .3, 0, hr(-.15, .15)).applyAxisAngle(new THREE.Vector3(0, 1, 0), r); const pg = new THREE.SphereGeometry(hr(.1, .18), 6, 4); pg.scale(1, hr(.8, 1.6), 1); K.geo('plain', pg, htm(x + p.x, .55, z + p.z), tint(hpick([0x4a6a32, 0x5a7a3a, 0x6a7a3a]))); }
    addCol(x, z, .9); }
  { const cx = -8, cz = 18; K.box('board', 1.2, .08, 2, cx, .62, cz, 0, .3, 0, 0x7a6650); for (const s of [-1, 1]) { K.box('board', .06, .35, 2, cx + s * .58 * Math.cos(.3), .78, cz - s * .58 * Math.sin(.3), 0, .3, 0, 0x6a5440); const w = new THREE.TorusGeometry(.38, .05, 6, 14); K.geo('board', w, htm(cx + s * .66 * Math.cos(.3), .38, cz - s * .66 * Math.sin(.3), 0, .3 + Math.PI / 2, 0), 0x4a3a2a); }
    K.box('board', .06, .06, 1.4, cx - .5, .5, cz + 1.4, .5, .3, 0, 0x5a4636); sack(K, cx, .66, cz - .3); sack(K, cx + .2, .66, cz + .4); addCol(cx, cz, 1.1); }
  K.build(g);
  // blast walls outside the gate: Bryce's concrete barrier sections, either side of the road, razor wire on top
  for (const s of [-1, 1]) {
    const bw = hmodel('props/barrier', 4.2); if (!bw) break;
    const x = s * 6.2, z = 74.5, gy = heightAt(x, z); bw.position.set(x, gy - .25, z); bw.rotation.set(0, Math.PI / 2 + s * .08, 0); world.add(bw);
    const KW = hkit(LOW), gw = new THREE.Group(); gw.position.copy(bw.position); gw.rotation.copy(bw.rotation); world.add(gw);
    for (let i = 0; i < 24; i++) { const t = new THREE.TorusGeometry(.32, .015, 4, 12); KW.geo('metal', t, htm(-5.3 + i * .46, 4.35, 0, 0, Math.PI / 2 + .25, 0), 0x8a8a86); }
    KW.build(gw, false);
    const a = new THREE.Vector3(-5.4, 0, 0).applyEuler(bw.rotation), b = new THREE.Vector3(5.4, 0, 0).applyEuler(bw.rotation); addColLine(x + a.x, z + a.z, x + b.x, z + b.z, .7);
  }
}

/* ---------- the gatehouse: two block towers either side of the gate, a covered walk across the top ---------- */
function buildGatehouse() {
  const gz = CAMP_R, gy = heightAt(0, gz);
  const g = new THREE.Group(); g.position.set(0, gy, gz); world.add(g); const K = hkit(LOW);
  for (const s of [-1, 1]) {
    const x = s * (GATE_X + 3.2);
    K.at(htm(x, 0, 0));
    K.box('block', 5, 4.2, 6, 0, 2.1, 0, 0, 0, 0, 0xd0cabe, 1.6);                                     // block base
    for (const z of [-3.02, 3.02]) { K.box('metal', 1.4, .14, .08, 0, 2.6, z, 0, 0, 0, 0x2a2a28); K.box('win', 1.2, .12, .02, 0, 2.6, z * .995); }   // firing slits
    // the guard room on top: salvaged hull plate on all four sides, a slot window on each
    for (const [wx, wz, wr, L] of [[2.5, -3, Math.PI, 5], [2.5, 3, Math.PI / 2, 6], [-2.5, -3, -Math.PI / 2, 6], [-2.5, 3, 0, 5]])
      cladRun(K.at(htm(x + wx, 4.2, wz, 0, wr, 0)), L, 3.4, 'hull', { col: 0xc4c0b8, holes: [{ x0: L / 2 - .9, x1: L / 2 + .9, y0: 1.3, y1: 1.9 }] });
    for (const [wx, wz, wr, L] of [[2.5, -3, Math.PI, 5], [2.5, 3, Math.PI / 2, 6], [-2.5, -3, -Math.PI / 2, 6], [-2.5, 3, 0, 5]]) { K.at(htm(x + wx, 4.2, wz, 0, wr, 0)); K.box('win', 1.8, .6, .02, L / 2, 1.6, -.05); }
    K.at(htm(x, 0, 0));
    for (const z of [-3.05, 3.05]) { K.box('board', 1.1, 2.1, .08, -s * 1.2, 1.05, z, 0, 0, 0, 0x4a4036); K.box('board', 1.3, .1, .12, -s * 1.2, 2.15, z, 0, 0, 0, 0x3a3028); }
    // roof, sandbags along the edge, a lamp, an aerial on one
    K.box('corr', 5.8, .03, 6.8, 0, 7.75, 0, .08, 0, 0, tint(0x8a7a6a)); for (const z of [-3.2, 3.2]) K.box('board', 5.8, .2, .06, 0, 7.6, z, 0, 0, 0, 0x5a4a3a);
    for (let i = 0; i < 8; i++) { const sg = new THREE.BoxGeometry(.75, .26, .42); K.geo('cloth', sg, htm(-2.1 + i * .6, 4.35, 3.15, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); }
    K.box('metal', .3, .25, .3, s * 2.3, 7.2, 3.2, 0, 0, 0, 0x2a2a2a); K.box('win', .22, .18, .02, s * 2.3, 7.2, 3.36);
    if (s > 0) { K.cyl('metal', .03, .04, 4, 5, 2, 9.5, -2.5, 0, 0, 0, 0x5a5a58); for (let i = 0; i < 3; i++) K.box('metal', .9 - i * .2, .02, .02, 2, 10 + i * .4, -2.5, 0, .7, 0, 0x5a5a58); }
    addColLine(x - 2.5, gz - 3, x - 2.5, gz + 3, .4); addColLine(x + 2.5, gz - 3, x + 2.5, gz + 3, .4); addColLine(x - 2.5, gz - 3, x + 2.5, gz - 3, .4); addColLine(x - 2.5, gz + 3, x + 2.5, gz + 3, .4);
  }
  K.at(null);
  // the walk over the gate
  K.box('conc', GATE_X * 2 + 1.5, .4, 3.4, 0, 9.3, 0, 0, 0, 0, 0xb0aaa0, 2);
  for (const z of [-1.6, 1.6]) cladRun(K.at(htm(-GATE_X - .75, 9.5, z, 0, z > 0 ? 0 : 0, 0)), GATE_X * 2 + 1.5, 1.1, 'corr', { pal: RUST });
  K.at(null);
  for (let i = 0; i < 11; i++) { const sg = new THREE.BoxGeometry(.75, .26, .42); K.geo('cloth', sg, htm(-GATE_X + i * .9, 10.75, 1.62, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); }
  const wr = new THREE.BoxGeometry(GATE_X * 2 + 11, .03, 4.2); K.geo('corr', wr, htm(0, 12, 0, .04, 0, 0), tint(0x8a7a6a));
  for (const x of [-(GATE_X + 4.6), GATE_X + 4.6]) for (const z of [-1.9, 1.9]) K.box('metal', .15, 3.8, .15, x, 10.1, z, 0, 0, 0, 0x3a3a38);
  K.build(g);
}

/* ---------- watchtowers: timber legs with cross bracing, a sandbagged platform, a tin roof, the ladder ---------- */
function towerKit(t) {
  const K = hkit(LOW);
  const leg = [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]];
  for (const [x, z] of leg) K.cyl('board', .13, .16, 8.2, 7, x * 1.04, 4.05, z * 1.04, z * -.02, 0, x * .02, tint(0x6a5a46));
  for (let y = 1; y < 8; y += 2.4) for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) { const [ax, az] = leg[a], [bx, bz] = leg[b], L = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(-(bz - az), bx - ax); K.box('board', L, .1, .1, (ax + bx) / 2, y, (az + bz) / 2, 0, yaw, 0, 0x5a4a3a);
    K.box('board', Math.hypot(L, 2.4), .08, .08, (ax + bx) / 2, y + 1.2, (az + bz) / 2, 0, yaw, Math.atan2(2.4, L) * (y % 2 > 1 ? 1 : -1), 0x5a4a3a); }
  for (let x = -1.75; x < 1.75; x += .22) K.box('board', .21, .07, 3.6, x + .11, 8, 0, 0, 0, 0, tint(0x7a6a56, .1));
  for (const [x, z, w, d] of [[0, 1.7, 3.6, .3], [-1.7, 0, .3, 3.6], [1.7, 0, .3, 3.6]]) for (let i = 0; i < Math.round(Math.max(w, d) / .6); i++) { const sg = new THREE.BoxGeometry(w > d ? .62 : .42, .26, w > d ? .42 : .62);
    const sg2 = sg.clone(); K.geo('cloth', sg, htm(w > d ? -1.5 + i * .6 : x, 8.2, w > d ? z : -1.5 + i * .6, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); K.geo('cloth', sg2, htm(w > d ? -1.2 + i * .6 : x, 8.45, w > d ? z : -1.2 + i * .6, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); }
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) K.box('board', .12, 3, .12, px, 9.6, pz, 0, 0, 0, 0x5a4a3a);
  for (let x = -2.1; x < 2.1; x += .84) K.box('corr', .9, .02, 4.4, x + .42, 11.15, 0, .12, 0, hr(-.01, .01), tint(hpick(RUST), .1));
  K.box('board', .08, 8, .08, -.4, 4, -1.45, 0, 0, 0, 0x6a5440); K.box('board', .08, 8, .08, .4, 4, -1.45, 0, 0, 0, 0x6a5440);
  for (let k = 0; k < 10; k++) K.box('board', .8, .07, .07, 0, .4 + k * .8, -1.45, 0, 0, 0, 0x7d6448);
  K.box('metal', .25, .2, .2, -1.6, 10.6, 1.6, 0, 0, 0, 0x2a2a2a);
  K.build(t);
}

/* ---------- a ruin out in the valley (Halvard, the boathouse): a house somebody lived in until they didn't ----------
   Same footprint, door gap, colliders and shelter as before. Walls of boards or block with gaps where boards are gone, windows
   broken, boarded or with a curtain still hanging, the door on the ground, the roof half fallen in, and inside what they left. */
function house(cx, cz, yaw, w, d, floors = 1) {
  const g = new THREE.Group(), K = hkit(LOW), H = 3 * floors;
  const kind = hpick(['board', 'board', 'block', 'corr']), col = kind === 'board' ? hpick([0x8a7a66, 0x7a8a7c, 0x9a7468, 0x8a8a7a, 0xa89a80]) : kind === 'block' ? 0xc8c2b6 : 0;
  K.box('conc', w + .4, .2, d + .4, 0, .1, 0, 0, 0, 0, 0x9a948a, 2);
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) K.box('board', .16, H * hr(.75, 1), .16, px, H * .45, pz, 0, 0, hr(-.04, .04), 0x4a3e32);
  const runs = [{ m: htm(w / 2, 0, -d / 2, 0, Math.PI, 0), L: w }, { m: htm(w / 2, 0, d / 2, 0, Math.PI / 2, 0), L: d }, { m: htm(-w / 2, 0, -d / 2, 0, -Math.PI / 2, 0), L: d, door: hp(.4) }, { m: htm(-w / 2, 0, d / 2, 0, 0, 0), L: w, door: true }];
  for (const R of runs) {
    const holes = [];
    if (R.door) holes.push({ x0: R.L / 2 - .8, x1: R.L / 2 + .8, y0: -1, y1: 2.2 });
    const wins = []; for (let f = 0; f < floors; f++) for (const u of R.L > 5 ? [R.L * .22, R.L * .78] : [R.L / 2]) if (!(R.door && Math.abs(u - R.L / 2) < 1.4 && f === 0)) wins.push([u, 1.6 + f * 3]);
    for (const [u, y] of wins) holes.push({ x0: u - .55, x1: u + .55, y0: y - .5, y1: y + .5 });
    // a broken top edge: some of the wall has come down
    if (hp(.35)) holes.push({ x0: hr(0, R.L * .5), x1: hr(R.L * .5, R.L), y0: H * hr(.55, .85), y1: H + 1 });
    K.at(R.m); cladRun(K, R.L, H, kind, { holes, col, pal: RUST });
    // boards gone: gaps knocked through
    if (kind === 'board') for (let i = 0; i < 3; i++) K.box('win', hr(.15, .4), hr(.4, 1.2), .01, hr(.5, R.L - .5), hr(.6, H - .6), -.03);
    for (const [u, y] of wins) {
      const r = hrnd();
      if (r < .4) windowAt(K, u, y, 1, .9, { frame: 0x4a3e32, boarded: true });
      else if (r < .75) { windowAt(K, u, y, 1, .9, { frame: 0x4a3e32, curtain: hp(.5) ? hpick(CLOTHC) : null, crack: true }); }
      else { for (const [px, py, pw, ph] of [[u, y + .48, 1.1, .06], [u, y - .48, 1.1, .06], [u - .52, y, .06, .9], [u + .52, y, .06, .9]]) K.box('board', pw, ph, .08, px, py, .03, 0, 0, hr(-.04, .04), 0x4a3e32); K.box('win', 1, .9, .01, u, y, -.04); }
    }
    if (R.door) { K.at(R.m); K.box('board', 1.7, .12, .14, R.L / 2, 2.25, .02, 0, 0, hr(-.05, .05), 0x4a3e32); }
  }
  K.at(null);
  // the door, off its hinges, on the ground out front
  { const dg = new THREE.BoxGeometry(.9, .05, 2); boxUV(dg, .9, .05, 2, 1, hrnd() * 9, hrnd() * 9); K.geo('board', dg, htm(hr(-1, 1), .25, d / 2 + 1.1, hr(-.15, .15), hr(0, 3), hr(-.1, .1)), tint(hpick([0x5a4a3a, 0x6a5a48, 0x4a5a6a]))); }
  // the roof: half the sheets still on, the rest fallen in across the room
  const a = .38, half = d / 2 + .4, len = half / Math.cos(a) + .1, keep = hr(.35, .8);
  for (const s of [1, -1]) for (let x = -w / 2 - .4; x < w / 2 + .3; x += .84) {
    const t = (x + w / 2) / w;
    if ((s > 0 ? t : 1 - t) < keep && hp(.88)) K.box('corr', .9, .02, len, x + .42, H + (d / 2 - half / 2) * Math.tan(a) + .02, s * half / 2, s * a, 0, hr(-.02, .02), tint(hpick(RUST), .12));
    else if (hp(.4)) K.box('corr', .9, .02, len * hr(.5, .9), x + .42, hr(.6, H * .6), s * hr(0, half / 2), s * hr(.6, 1.1), hr(-.4, .4), hr(-.3, .3), tint(hpick(RUST), .15));
  }
  for (let x = -w / 2; x <= w / 2 + .01; x += hr(1.1, 1.6)) if (hp(.7)) K.box('board', .1, .14, d + .7, x, H + (hp(.8) ? .05 : -hr(.5, 1.5)), 0, hp(.2) ? hr(-.5, .5) : 0, 0, 0, 0x4a3e32);
  // what they left: a table on its side, a bed frame, a shelf with a few jars, a chair, a stove, rubbish, a pram or a bike wheel
  K.box('board', 1.2, .05, .8, hr(-w / 4, w / 4), .45, hr(-d / 4, d / 4), Math.PI / 2 - .2, hr(0, 3), 0, 0x6a5440);
  { const bx = -w / 2 + 1.2, bz = -d / 2 + 1.3; K.box('metal', .95, .06, 2, bx, .45, bz, 0, 0, 0, 0x5a5a56); K.box('cloth', .9, .12, 1.4, bx, .55, bz + .2, 0, 0, hr(-.1, .1), tint(hpick(CLOTHC))); for (const [dx, dz] of [[-.45, -.95], [.45, -.95], [-.45, .95], [.45, .95]]) K.box('metal', .04, .45, .04, bx + dx, .22, bz + dz, 0, 0, 0, 0x4a4a46); }
  shelf(K, w / 2 - .5, hr(-1, 1), 1.4, -Math.PI / 2, 2, [0x8a8a7a, 0x6a4a2a, 0x3a5a3a]);
  K.box('board', .45, .05, .45, hr(-1, 1), .25, hr(-1, 1), hr(-1.5, 1.5), hr(0, 3), hr(-1.5, 1.5), 0x6a5440);
  if (hp(.6)) { K.box('metal', .6, .7, .5, w / 2 - .6, .35, -d / 2 + .5, 0, 0, 0, 0x2a2a28); K.cyl('metal', .07, .07, H, 8, w / 2 - .5, H / 2 + .4, -d / 2 + .45, 0, 0, hr(-.1, .1), 0x3a3634); }
  for (let i = 0; i < 6; i++) K.box(hpick(['board', 'plain', 'corr']), hr(.2, .9), hr(.03, .15), hr(.2, .7), hr(-w / 2.4, w / 2.4), .25, hr(-d / 2.4, d / 2.4), hr(-.3, .3), hr(0, 3), hr(-.3, .3), tint(hpick([0x6a5a48, 0x8a8a7a, 0x5a4a3a, 0x9a6a4a])));
  for (let i = 0; i < 2; i++) K.poster(hpick([1, 3, 6, 7]), .4, .5, -w / 2 + .14, hr(1.2, 2), hr(-d / 3, d / 3), Math.PI / 2, hr(-.2, .2));
  if (hp(.5)) { const t = new THREE.TorusGeometry(.33, .025, 5, 16); K.geo('metal', t, htm(w / 2 + .3, .34, d / 2 - 1, 0, Math.PI / 2 + .1, .2), 0x2a2a28); }
  // weeds through the floor
  for (let i = 0; i < 5; i++) { const pg = new THREE.ConeGeometry(hr(.1, .25), hr(.4, .9), 5); K.geo('plain', pg, htm(hr(-w / 2.5, w / 2.5), .4, hr(-d / 2.5, d / 2.5)), tint(hpick([0x4a6a32, 0x5a6a3a, 0x6a7a42]))); }
  K.build(g, !LOW);
  place(g, cx, cz, yaw);
  const C = (lx0, lz0, lx1, lz1) => { const [a1, b1] = rotXZ(lx0, lz0, yaw), [c1, e1] = rotXZ(lx1, lz1, yaw); addColLine(cx + a1, cz + b1, cx + c1, cz + e1, .3); };
  C(-w / 2, d / 2, -.9, d / 2); C(.9, d / 2, w / 2, d / 2); C(-w / 2, -d / 2, w / 2, -d / 2); C(w / 2, -d / 2, w / 2, d / 2); C(-w / 2, -d / 2, -w / 2, d / 2);
  SHELTERS.push({ x: cx, z: cz, kind: 'house', r: Math.min(w, d) / 2 - .4 });
  return g;
}

// testing hooks: draw calls and triangles over one whole frame, and what's under the crosshair
window.__H = { info() { return new Promise(res => requestAnimationFrame(() => { renderer.info.autoReset = false; renderer.info.reset(); requestAnimationFrame(() => { const r = renderer.info.render; const o = { calls: r.calls, tris: r.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; renderer.info.autoReset = true; res(o); }); })); }, probe() { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), camera); rc.layers.enableAll();
  const hits = rc.intersectObjects(world.children, true).slice(0, 5); return hits.map(h => { const m = [].concat(h.object.material)[0]; const k = Object.keys(HMATS).find(x => HMATS[x] === m) || Object.keys(HMATS_IN).find(x => HMATS_IN[x] === m) && 'in-' + Object.keys(HMATS_IN).find(x => HMATS_IN[x] === m);
    return [k || m.type, h.distance.toFixed(2), h.object.name, m.color && m.color.getHexString()]; }); } };

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
/* a ruined house: house(cx, cz, yaw, w, d, floors) is in 1f-houses.js (Nov 10 rebuild) */
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
  const L = POI.lake, R = LAKES[0].R, a = Math.atan2(64 - L.z, 6 - L.x);   // dock on the gate side, facing the road out
  const sx = L.x + Math.cos(a) * R * .92, sz = L.z + Math.sin(a) * R * .92, yaw = -a + Math.PI / 2;
  const g = new THREE.Group(), w = new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a7258 });
  const deckY = LAKE_L + .5, gy = heightAt(sx, sz);
  for (let k = 0; k < 16; k++) { const p = mesh(new THREE.BoxGeometry(2.6, .14, .5), w, 0, 0, -k * .55, g); p.rotation.z = rr(-.03, .03); }
  for (const s of [-1.2, 1.2]) for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(.12, .12, 3, 6), M(0x4a3a2a), s, -1.4, -k * 2.6, g);
  g.position.set(sx, deckY, sz); g.rotation.y = yaw; world.add(g);
  const [cx, cz] = rotXZ(0, -4.2, yaw); addFloor(sx + cx, sz + cz, yaw, 1.3, 4.6, deckY + .07);
  // boathouse + canoe + fishing shack
  { const b = a + 2.2, bx = L.x + Math.cos(b) * (R + 9), bz = L.z + Math.sin(b) * (R + 9); house(bx, bz, -b, 7, 6); supplyCrate(bx, bz, 'mixed'); }   // boathouse on the far shore
  { const cx2 = L.x + Math.cos(a + .5) * (R + 2.5), cz2 = L.z + Math.sin(a + .5) * (R + 2.5), c = new THREE.Group(); const hull = mesh(new THREE.CylinderGeometry(.5, .5, 4.4, 10, 1, false, 0, Math.PI), M(0x8a3a2a, { side: THREE.DoubleSide }), 0, .5, 0, c); hull.rotation.set(Math.PI / 2, 0, Math.PI); place(c, cx2, cz2, rnd() * 6); }
}

/* the dropsite: where the drop ship came down and where you wake. Salvage in the wreck and around it, and level open
   ground to dig in and build on if you'd rather not walk to Kestrel (the old road north-east goes there). */
function buildDropsite() {
  const D = POI.dropsite, y0 = heightAt(D.x, D.z), toCamp = Math.atan2(-D.z, -D.x);
  const ax = Math.cos(toCamp), az = Math.sin(toCamp);                       // the hull's axis points at Kestrel
  const W = (along, side) => [D.x + ax * along - az * side, D.z + az * along + ax * side];
  const inWreck = (x, z) => { const dx = x - D.x, dz = z - D.z, al = dx * ax + dz * az, sd = -dx * az + dz * ax; return Math.abs(al) < 12.5 && Math.abs(sd) < 6.5; };
  // scorched ground and a long gouge where it skidded in from the south-west
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(18, 28), new THREE.MeshLambertMaterial({ color: 0x1e1b18, transparent: true, opacity: .75, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(D.x, y0 + .06, D.z); scorch.renderOrder = 1; world.add(scorch);
  const gouge = new THREE.Mesh(new THREE.PlaneGeometry(9, 46), new THREE.MeshLambertMaterial({ color: 0x2a231c, transparent: true, opacity: .7, depthWrite: false }));
  gouge.rotation.set(-Math.PI / 2, 0, toCamp + Math.PI / 2); const [gx, gz] = W(-30, 0); gouge.position.set(gx, y0 + .07, gz); gouge.renderOrder = 1; world.add(gouge);

  /* the wreck: a section of the Arc itself, torn off the station when it came down — one end still sealed with its
     airlock, the other ripped open on a dark, gutted corridor, ribs sprung, cables hanging, a snapped truss beside it */
  const g = new THREE.Group(); g.position.set(D.x, y0 + 2.6, D.z); g.rotation.set(0, -toCamp, -.07); world.add(g);
  const R = 5, L = 22;
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(L / 8, 3);
  const skin = new THREE.MeshStandardMaterial({ map: t, normalMap: TX.metal2N, normalScale: new THREE.Vector2(.8, .8), color: 0xb4b2ab, metalness: .45, roughness: .66, side: THREE.DoubleSide });
  const hull = mesh(new THREE.CylinderGeometry(R, R, L, 24, 1, true), skin, 0, 0, 0, g); hull.rotation.z = Math.PI / 2;
  const burnt = S(0x2a2724, { roughness: .9 }), bright = S(0xd8d8d0, { metalness: .5, roughness: .45 });
  // sealed end (toward Kestrel): cap, airlock ring, hatch
  { const cap = mesh(new THREE.CylinderGeometry(R * .92, R, 1, 24), S(0x6d6e6c, { map: TX.metal, metalness: .5 }), L / 2 + .3, 0, 0, g); cap.rotation.z = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(R * .42, .35, 6, 18), M(0x3a3a38), L / 2 + .85, -R * .25, 0, g); ring.rotation.y = Math.PI / 2;
    const hatch = mesh(new THREE.CircleGeometry(R * .4, 18), M(0x4a4c4e), L / 2 + .82, -R * .25, 0, g); hatch.rotation.y = Math.PI / 2; }
  // the torn end: a dark gutted interior, a deck, and a ragged lip of bent plates
  { const dark = mesh(new THREE.CircleGeometry(R * .98, 24), M(0x0b0a09), -L / 2 + 5, 0, 0, g); dark.rotation.y = Math.PI / 2;
    mesh(new THREE.BoxGeometry(6, .25, R * 1.6), S(0x4a4846, { map: TX.metal, metalness: .5 }), -L / 2 + 2.6, -R * .55, 0, g);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, len = rr(.8, 3.6);
      const p = mesh(new THREE.BoxGeometry(len, .12, rr(1.2, 2)), i % 3 ? skin : burnt, -L / 2 - len / 2 + .3, Math.cos(a) * R, Math.sin(a) * R, g);
      p.rotation.set(a, rr(-.25, .25), (rnd() < .5 ? -1 : 1) * rr(.05, .45));
    }
    for (let i = 0; i < 6; i++) { const a = rr(.3, 2.8), c = mesh(new THREE.CylinderGeometry(.06, .06, rr(2, 4.5), 4), M(i % 2 ? 0x1a1a1a : 0x8a3a2a), -L / 2 + rr(.2, 1.5), Math.cos(a) * R * .9 - 1.6, Math.sin(a) * R * .9, g); c.rotation.set(rr(-.2, .2), 0, rr(-.3, .3)); }
    const sprung = mesh(new THREE.TorusGeometry(R + .45, .32, 5, 14, Math.PI * .7), bright, -L / 2 - 1.2, .6, 0, g); sprung.rotation.set(.4, Math.PI / 2, .5);
  }
  // ribs and fins down the length, a scorched band, a few roof plates knocked askew
  for (let x = -L / 2 + 5, k = 0; x < L / 2 - 1; x += 4.5, k++) {
    const rib = mesh(new THREE.TorusGeometry(R + .45, .32, 5, 18, Math.PI), bright, x, 0, 0, g); rib.rotation.y = Math.PI / 2;
    if (k !== 1) { const fin = mesh(new THREE.BoxGeometry(.35, 2.4, .8), bright, x, R + 1.4, 0, g); fin.rotation.z = rr(-.35, .35); }
  }
  { const band = mesh(new THREE.CylinderGeometry(R + .03, R + .03, 7, 24, 1, true, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x1a1816, transparent: true, opacity: .55, depthWrite: false }), -L / 2 + 4, 0, 0, g); band.rotation.z = Math.PI / 2; }
  for (let i = 0; i < 3; i++) { const p = mesh(new THREE.BoxGeometry(rr(4, 6), .35, rr(3, 5)), M(0x8e9294), rr(-4, 8), R + .2, rr(-1.5, 1.5), g); p.rotation.set(rr(-.35, .35), rnd(), rr(-.3, .3)); }
  // a snapped truss spar that came down with it, and a curved slice of the station's outer ring
  { const tr = mesh(lattice(1.4, 18, 0x5a5853, 2.2), VCOL, 0, 0, 0, world); const [x, z] = W(-15, -12.5), th = Math.atan2(ax, az); tr.position.set(x, heightAt(x, z) + .4, z); tr.rotation.order = 'YXZ'; tr.rotation.set(Math.PI / 2 - .12, th, 0);
    for (let k = 1; k < 17; k += 3) addCol(x + Math.sin(th) * k, z + Math.cos(th) * k, .9); }
  { const [x, z] = W(9, 13), arc = new THREE.Group(); arc.position.set(x, heightAt(x, z) - 3, z); arc.rotation.set(0, -toCamp + 1.1, .25); world.add(arc);
    const seg = mesh(new THREE.TorusGeometry(16, 1.3, 8, 18, 1.0), S(0xa8a69e, { map: TX.metal, metalness: .45 }), 0, -12, 0, arc); seg.rotation.z = Math.PI / 2 - .5;
    addCol(x, z, 2.2); }
  for (const al of [-9, -4, 1, 6, 10]) { const [x, z] = W(al, 0); addCol(x, z, 5.2); }
  // seats, cargo and hull plates thrown clear along the furrow
  for (let i = 0; i < 18; i++) {
    const k = i / 18, [x, z] = W(lerp(-50, 4, k) + rr(-4, 4), rr(-13, 13));
    if (inWreck(x, z)) continue;
    const t2 = texPanel.clone(); t2.needsUpdate = true;
    const m = mesh(new THREE.BoxGeometry(rr(1.2, 4), rr(.15, .4), rr(1.2, 3)), new THREE.MeshStandardMaterial({ map: t2, color: 0x9a948a, metalness: .4, roughness: .7 }), x, heightAt(x, z) + .3, z, world);
    m.rotation.set(rr(-1, 1), rnd() * 6, rr(-.5, .5)); if (rnd() < .35) addCol(x, z, 1.1);
  }
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, r = rr(9, 17), x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r; if (inWreck(x, z)) { i--; continue; }
    const seat = new THREE.Group(); mesh(new THREE.BoxGeometry(.6, .12, .6), M(0x4a4e52), 0, .45, 0, seat); mesh(new THREE.BoxGeometry(.6, .7, .1), M(0x3a3e42), 0, .8, -.28, seat); mesh(new THREE.BoxGeometry(.08, .45, .5), M(0x2a2a2a), 0, .22, 0, seat);
    place(seat, x, z, rnd() * 6); seat.rotation.z = rr(-1.4, 1.4); }
  // small fires still going, and smoke out of the torn end
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.28, r = rr(8, 13), x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r; if (inWreck(x, z)) { i--; continue; } const y = heightAt(x, z);
    const f = new THREE.Mesh(new THREE.ConeGeometry(rr(.4, .8), rr(1.1, 1.9), 7), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .9 }));
    f.position.set(x, y + .7, z); world.add(f); const ph = rnd() * 6; DECOR_ANIM.push(t => { f.scale.y = 1 + Math.sin(t * 13 + ph) * .25; });
  }
  { const [x, z] = W(-L / 2 + 2, 0); SMOKES.push({ x, z, y: y0 + 6, k: 0 }); }
  const bl = new THREE.PointLight(0xff8a3a, 2, 34, 0); { const [x, z] = W(-L / 2 - 2, 0); bl.position.set(x, y0 + 3, z); } world.add(bl);
  // salvage: a locker with a starter kit, a cargo net, Arc supply crates, scrap all round
  { const [x, z] = W(-4, 8), o = { id: 'drop_locker', name: 'Arc section locker', rolls: 2, keys: ['bandage', 'rope', 'cloth'], refill: 0 }; if (MODELS['props/locker']) npCache(world, 'locker', 1.73, x, z, -toCamp, 'arc', o); else cache(world, x, z, -toCamp, 'none', 'arc', o); }
  { const [x, z] = W(3, -8.5); cache(world, x, z, -toCamp, 'none', 'wild', { id: 'drop_cargo', name: 'Cargo net', big: 1, rolls: 2, refill: 3 }); }
  for (const [al, sd, l] of [[-15, 4, 'mixed'], [-8, -9, 'ammo'], [8, 9, 'scrap'], [14, -5, 'mixed']]) { const [x, z] = W(al, sd); supplyCrate(x, z, l); CRATES[CRATES.length - 1].table = 'arc'; }
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = rr(8, 40), x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r; if (inWreck(x, z)) { i--; continue; } spawnScrap(x, z, 'wild'); }
  // a fire ring someone started before they left for Kestrel — a place to start your own camp
  { const [fx, fz] = W(-16, -12), fy = heightAt(fx, fz);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; mesh(new THREE.DodecahedronGeometry(.22, 0), M(0x6a6660), fx + Math.cos(a) * .7, fy + .1, fz + Math.sin(a) * .7, world); } }
  dressDropsite(D, toCamp, inWreck);
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
  buildWatchers();
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
      const dens = fbm(x * .018 + 5, z * .018 + 11), fk = smooth(.3, .6, dens) * (1 - smooth(110, 138, h)) * (1 - smooth(1, 1.5, sl)) * (Math.hypot(x, z) < CAMP_R + 12 ? 0 : 1);
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
  const d = Math.hypot(x, z); if (d < CAMP_R + 12 || d > WORLD + 120) return false;
  if (MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 30) || OUT_MEADOWS.some(m => Math.hypot(x - m.x, z - m.z) < 45)) return false;
  if (FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r0 + 6)) return false;
  if (inCity(x, z, 30) || inBase(x, z, 12)) return false;
  for (const p of [ [POI.burn, 64], [POI.halvard, 96], [POI.ashmere, 62]]) if (Math.hypot(x - p[0].x, z - p[0].z) < p[1]) return false;
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
  if (horizonMesh) horizonMesh.visible = !VIEW_M;                        // the 9 km ranges only exist at Max view distance
  if (farTrees) for (const im of farTrees) { const c = im.boundingSphere.center; im.visible = !VIEW_M || (VIEW_M > FAR_TREE_NEAR && Math.hypot(c.x - px, c.z - pz) - im.boundingSphere.radius < VIEW_M); }
  for (const S of FAR_SMOKE) {
    S.sp.visible = !VIEW_M || Math.hypot(S.x - px, S.z - pz) < VIEW_M + 150;
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

/* ================= Cinder City, the Foundry, and the other bases =================
   The city is 840m of dead towers on a street grid, built from a handful of instanced meshes so it stays cheap.
   The Foundry is the district Ironjaw rebuilt: scrap walls, towers, workshops, and the best loot in the land behind locks.
   Out in the wilds: Farlight (friendly Arc traders), Greyhold Station (soldiers), and two Ironjaw yards. */

const FAR_GROUPS = [];                         // whole districts hidden when you're far away
function farGroup(x, z, r) { const g = new THREE.Group(); world.add(g); FAR_GROUPS.push({ g, x, z, r }); return g; }
function updFarGroups(px, pz) { for (const F of FAR_GROUPS) F.g.visible = Math.hypot(px - F.x, pz - F.z) < F.r + (VIEW_M ? Math.min(480, VIEW_M) : 480); }

/* facade: windows and floor lines drawn in the shader from world position, so one material fits every tower size */
function facadeMat() {
  const m = new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xffffff, emissive: 0x2a2826 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec4 cw = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vCN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);\n#else\n vec4 cw = modelMatrix * vec4(transformed, 1.0); vCN = normalize(mat3(modelMatrix) * objectNormal);\n#endif\n vCW = cw.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (abs(vCN.y) < .5) {
    float hz = abs(vCN.x) > .5 ? vCW.z : vCW.x;
    float fy = fract(vCW.y / 3.4), fx = fract(hz / 3.1);
    float win = step(.32, fy) * step(fy, .82) * step(.18, fx) * step(fx, .82);
    float cell = fract(sin(dot(floor(vec2(hz / 3.1, vCW.y / 3.4)), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 glass = cell > .7 ? vec3(.05) : cell > .45 ? vec3(.10, .12, .13) : vec3(.18, .2, .2);
    diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * (cell > .93 ? .3 : 1.));
    diffuseColor.rgb *= 1. - step(fy, .06) * .25;
  }`);
  };
  return m;
}
const _d = new THREE.Object3D(), _c = new THREE.Color();
function instanced(geo, mat, list, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((q, i) => { _d.position.set(q[0], q[1], q[2]); _d.rotation.set(q[6] || 0, q[7] || 0, q[8] || 0); _d.scale.set(q[3], q[4], q[5]); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); if (q[9] != null) im.setColorAt(i, _c.set(q[9])); });
  im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); return im;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, .5, 0);

/* locked caches: each needs a particular tool or key, and holds a better loot table */
const LOCKS = { pry: ['crowbar', 'Pry it open (crowbar)'], cutter: ['bolt_cutters', 'Cut the chain (bolt cutters)'], bypass: ['lock_bypass', 'Bypass the lock (electronic bypass)'],
  card: ['greyhold_card', 'Swipe a Greyhold card'], chip: ['id_chip', 'Use an Arc ID chip'], none: [null, 'Search the stash'] };
const CACHES = [];
function cache(parent, x, z, yaw, lock, table, o = {}) {
  const g = new THREE.Group(), big = o.big;
  const body = S(big ? 0x5a5e62 : lock === 'none' ? 0x6a5a3a : 0x4a5a4a, { metalness: .5, roughness: .5 });
  mesh(new THREE.BoxGeometry(big ? 2.6 : 1.5, big ? 1.6 : .9, big ? 1.4 : .8), body, 0, big ? .8 : .45, 0, g);
  if (lock !== 'none') { const lamp = new THREE.Mesh(new THREE.BoxGeometry(.18, .18, .05), new THREE.MeshBasicMaterial({ color: { pry: 0xffa040, cutter: 0xffd040, bypass: 0x40c0ff, card: 0xe8e8e8, chip: 0x60ffd0 }[lock], toneMapped: false })); lamp.position.set(0, big ? 1.2 : .65, big ? .72 : .42); g.add(lamp); }
  const y = o.y ?? heightAt(x, z);   // (Nov 11) caches inside the city's buildings sit on their floor and bring their own walls
  g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g); if (!o.noCol) addCol(x, z, big ? 1.3 : .8);
  const C = { id: o.id || `c${CACHES.length}`, x, z, y, lock, table, rolls: o.rolls ?? 1, keys: o.keys || [], g, name: o.name, refill: o.refill ?? 3 };
  CACHES.push(C); return C;
}
const cacheOpen = C => { const o = (G.flags.caches || {})[C.id]; return o != null && (C.refill <= 0 || G.day - o < C.refill); };
function nearCache() { let b = null, bd = 2.8; for (const C of CACHES) { const d = Math.hypot(C.x - P.x, C.z - P.z); if (d < bd && Math.abs(C.y - P.y) < 2.6) { bd = d; b = C; } } return b; }   // not the floor above or below
function cacheAction(C) {
  if (cacheOpen(C)) return { l: `${C.name || 'Stash'} · empty (refills in ${Math.max(1, C.refill - (G.day - G.flags.caches[C.id]))} days)`, act: () => {} };
  const [need, label] = LOCKS[C.lock], ok = !need || (GEAR_DEFS[need] ? has(GEAR_DEFS[need].kind) : cnt(need) > 0);
  if (!ok) return { l: `${C.name || 'Locked'} · needs ${nameOf(need).toLowerCase()}`, act: () => { sfx('no'); toast(`Locked — ${label.toLowerCase()}`, 2.4); } };
  return { l: (C.name ? C.name + ' · ' : '') + label, act: () => startChan({ l: label.split(' (')[0], t: C.lock === 'none' ? .8 : 2.2, fn: () => {
    if (need && GEAR_DEFS[need]) wearTool(bestTool(GEAR_DEFS[need].kind), C.lock === 'bypass' ? 1 : 3);
    (G.flags.caches ||= {})[C.id] = G.day;
    const got = []; for (const k of C.keys) if (!cnt(k) || !ITEMS[k] || ITEMS[k].c !== 'story') { give(k, 1); got.push(nameOf(k)); }
    got.push(...rollLoot(C.table, C.rolls)); sfx('buy'); puff(C.x, C.y + 1, C.z, 0xd8c890, 8, 2, .1, .5);
    toast(got.slice(0, 7).join(' · ') || 'Nothing left', 4); save();
  } }) };
}

/* ---------- Cinder City ---------- */
function buildCity() {
  const root = farGroup(CITY.x, CITY.z, CITY.R), B0 = [], tops0 = [], rub0 = [], cars = [], awn0 = [], bush0 = [];
  const addRes0 = addRes, addCol0 = addCol, SHELTERS0 = SHELTERS, supplyCityCrate0 = supplyCityCrate;
  const tint = () => pick([0xd8d2c6, 0xc8c0b2, 0xb8b2a8, 0xa8a49c, 0xc8b8a4, 0x9a968e]);
  const BLK = 44, N = Math.ceil(CITY.R / BLK);
  for (let gx = -N; gx <= N; gx++) for (let gz = -N; gz <= N; gz++) {
    const cx = CITY.x + gx * BLK, cz = CITY.z + gz * BLK, dc = Math.hypot(cx - CITY.x, cz - CITY.z);
    if (dc > CITY.R - 26) continue;
    if (Math.hypot(cx - FOUNDRY.x, cz - FOUNDRY.z) < FOUNDRY.R + 20) continue;
    if (envSites().some(s => s.city && Math.hypot(cx - s.x, cz - s.z) < s.r + 18)) continue;   // the factory + street blocks
    if (pathDist(cx, cz) < 12) continue;
    // (Nov 11) blocks citySites() took (1j-city-interiors.js): roll everything as before so the rest of the world doesn't move, place nothing
    const mine = citySiteAt(cx, cz), B = mine ? [] : B0, tops = mine ? [] : tops0, rub = mine ? [] : rub0, bush = mine ? [] : bush0, awn = mine ? [] : awn0;
    const addRes = mine ? () => {} : addRes0, addCol = mine ? () => {} : addCol0, SHELTERS = mine ? [] : SHELTERS0, supplyCityCrate = mine ? () => rnd() : supplyCityCrate0;
    const k = dc / CITY.R, roll = rnd();
    if (roll < .1) { for (let i = 0; i < 6; i++) bush.push([cx + rr(-14, 14), heightAt(cx, cz), cz + rr(-14, 14), rr(1, 2.4), rr(1, 2.4), rr(1, 2.4), 0, rnd() * 6, 0, 0x3a5a2a]); continue; }   // overgrown lot
    const n = k < .35 ? 1 + (rnd() < .4) : k < .7 ? 2 + (rnd() < .5) : 3 + (rnd() < .4);
    const cells = n === 1 ? [[0, 0, 30, 30]] : n === 2 ? [[-8, 0, 14, 30], [8, 0, 14, 30]] : n === 3 ? [[-8, -8, 14, 14], [8, -8, 14, 14], [0, 8, 30, 14]] : [[-8, -8, 14, 14], [8, -8, 14, 14], [-8, 8, 14, 14], [8, 8, 14, 14]];
    for (const [ox, oz, cw, cd] of cells) {
      const w = cw * rr(.75, .95), d = cd * rr(.75, .95), x = cx + ox, z = cz + oz, y = heightAt(x, z) - .5;
      if (rnd() < .14) {                                                           // collapsed: a rubble heap you can dig through
        for (let i = 0; i < 9; i++) rub.push([x + rr(-w / 2, w / 2), y + rr(0, 2), z + rr(-d / 2, d / 2), rr(2, 6), rr(1, 3), rr(2, 6), rr(-.4, .4), rnd() * 3, rr(-.4, .4), tint()]);
        addRes('rubble', x, z, Math.min(w, d) / 2.2); addCol(x, z, Math.min(w, d) * .3, 3); continue;
      }
      const hgt = k < .35 ? rr(28, 90) : k < .7 ? rr(12, 34) : rr(5, 14), col = tint();
      B.push([x, y, z, w, hgt, d, 0, 0, 0, col]);
      const snapped = rnd() < .45 && hgt > 12;
      if (snapped) for (let i = 0; i < 4; i++) tops.push([x + rr(-w / 3, w / 3), y + hgt - rr(0, 2), z + rr(-d / 3, d / 3), rr(3, w * .5), rr(2, 6), rr(3, d * .5), rr(-.5, .5), rnd() * 3, rr(-.5, .5), col]);
      for (let i = 0; i < 3; i++) rub.push([x + rr(-w / 2 - 3, w / 2 + 3), y, z + (rnd() < .5 ? -1 : 1) * (d / 2 + rr(.5, 3)), rr(.8, 2.4), rr(.4, 1.2), rr(.8, 2.4), rr(-.3, .3), rnd() * 3, 0, col]);
      // collision along the long axis; shots stop at the building's height
      const L = Math.max(w, d), r = Math.min(w, d) / 2, nn = Math.max(1, Math.ceil((L - 2 * r) / (r * 1.2)));
      for (let i = 0; i <= nn; i++) { const t = nn ? i / nn : .5, px = w >= d ? x - w / 2 + r + (w - 2 * r) * t : x, pz = w >= d ? z : z - d / 2 + r + (d - 2 * r) * t; addCol(px, pz, r, hgt); }
      if (rnd() < .35) { const sd = rnd() < .5 ? 1 : -1; awn.push([x, y + 3.4, z + sd * (d / 2 + 1.6), w * .8, .3, 3.2, 0, 0, 0, 0x8a867e]); for (const px of [-w * .35, w * .35]) awn.push([x + px, y, z + sd * (d / 2 + 3), .4, 3.6, .4, 0, 0, 0, 0x7a766e]); SHELTERS.push({ x, z: z + sd * (d / 2 + 1.6), kind: 'house', r: Math.min(3, w * .35) }); }
      if (rnd() < .3) { const s = supplyCityCrate(x + rr(-w / 2, w / 2), z + (rnd() < .5 ? -1 : 1) * (d / 2 + 2)); }
    }
    // streets: wrecks
    for (let i = 0; i < 2; i++) if (rnd() < .55) { const along = rnd() < .5, sx = cx + (along ? rr(-18, 18) : 22 + rr(-2, 2)), sz = cz + (along ? 22 + rr(-2, 2) : rr(-18, 18)); cars.push([sx, heightAt(sx, sz) + .1, sz, 1, 1, 1, rr(-.06, .06), (along ? Math.PI / 2 : 0) + rr(-.4, .4), rr(-.06, .06), pick([0x8a5a3a, 0x6a6e6a, 0x7a4a2e, 0x4a5a6a, 0x9a8a5a])]); addCol0(sx, sz, 1.5); }
  }
  const carGeo = merge([{ geo: new THREE.BoxGeometry(1.9, .7, 4.4), m: tm(0, .65, 0), color: 0xffffff }, { geo: new THREE.BoxGeometry(1.7, .6, 2.2), m: tm(0, 1.3, -.2), color: 0xdddddd }, { geo: new THREE.BoxGeometry(1.75, .45, 1.9), m: tm(0, 1.32, -.2), color: 0x223038 }]);
  const fm = facadeMat();
  for (const im of [instanced(boxGeo, fm, B0), instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: texConcrete, flatShading: true }), tops0), instanced(new THREE.DodecahedronGeometry(.6, 0), new THREE.MeshLambertMaterial({ map: texConcrete, flatShading: true }), rub0),
    buildEnvCity(cars) ? null : instanced(carGeo, new THREE.MeshLambertMaterial({ map: texCorr, vertexColors: true }), cars), instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texConcrete }), awn0), instanced(new THREE.DodecahedronGeometry(.6, 0), M(0x3a5a2a), bush0, false)]) if (im) root.add(im);
  buildFoundry(root);
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = rr(60, CITY.R - 30); let x = CITY.x + Math.cos(a) * r, z = CITY.z + Math.sin(a) * r; if (Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) < FOUNDRY.R + 10) continue; [x, z] = cityShove(x, z); cache(root, x, z, rnd() * 6, pick(['pry', 'pry', 'cutter', 'none']), pick(['city', 'city', 'mil']), { refill: 4 }); }
  buildCityInside(root);   // (Nov 11) the buildings you can go into, the line under the city, the hot zone, the Glasshouse
}
function supplyCityCrate(x, z) { supplyCrate(x, z, 'mixed'); const c = CRATES[CRATES.length - 1]; c.table = 'city'; return c; }

/* ---------- the Foundry: what Ironjaw rebuilt ---------- */
function buildFoundry(root) {
  const F = FOUNDRY, g = new THREE.Group(); root.add(g);
  const sheet = () => new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x9a6a4a, 0x8a7a6a, 0x7a5a3a, 0x6a6e70, 0xa8885a]) });
  const gates = [Math.atan2(0, -1), Math.atan2(-1, 0)];             // west and north
  const wall = [];
  for (let i = 0; i < 150; i++) {
    const a = i / 150 * Math.PI * 2; if (gates.some(ga => Math.abs(angWrap(a - ga)) < .07)) continue;
    const x = F.x + Math.cos(a) * F.R, z = F.z + Math.sin(a) * F.R;
    wall.push([x, heightAt(x, z) - .2, z, 3.8, rr(4.2, 5.4), .25, rr(-.05, .05), -a + Math.PI / 2, rr(-.04, .04), pick([0xd8a07a, 0xc8b8a8, 0xb89070, 0xa8aeb0])]);
    addCol(x, z, 1.9, 5);
  }
  g.add(instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texCorr }), wall));
  for (const ga of gates) for (const s of [-1, 1]) {                      // gate towers with searchlights
    const a = ga + s * .1, x = F.x + Math.cos(a) * (F.R + 1), z = F.z + Math.sin(a) * (F.R + 1), t = new THREE.Group();
    t.add(mesh(lattice(3, 9, 0x5a4a3a, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x4a3a2a), 0, 9, 0, t); mesh(new THREE.BoxGeometry(4, 1.2, 4), sheet(), 0, 9.8, 0, t);
    const lamp = mesh(new THREE.CylinderGeometry(.3, .4, .5, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }), 0, 10.8, 0, t); lamp.rotation.x = 1.2;
    t.position.set(x, heightAt(x, z), z); g.add(t); addCol(x, z, 2);
  }
  // rebuilt blocks: patched towers, scaffolding, smokestacks, stalls, lights
  const fm = facadeMat(), rb = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.28 + .3, r = rr(34, 62), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r, w = rr(12, 18), d = rr(10, 16), h = rr(10, 26), y = heightAt(x, z) - .3;
    rb.push([x, y, z, w, h, d, 0, 0, 0, pick([0xb8aa96, 0xa89a86, 0xc0b4a0])]);
    for (let k = 0; k < 4; k++) { const p = mesh(new THREE.BoxGeometry(rr(2, 5), rr(2, 4), .1), sheet(), x + rr(-w / 2, w / 2), y + rr(2, h - 2), z + d / 2 + .06, g); }
    if (rnd() < .6) { const sc = mesh(lattice(w * .8, h * .8, 0x6a5a48, 2.2), VCOL, x, y, z + d / 2 + 1, g); }
    const L = Math.max(w, d), rr0 = Math.min(w, d) / 2; for (let t = -(L / 2 - rr0); t <= L / 2 - rr0 + .01; t += rr0 * 1.2) addCol(w >= d ? x + t : x, w >= d ? z : z + t, rr0, h);
  }
  g.add(instanced(boxGeo, fm, rb));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 1, x = F.x + Math.cos(a) * 20, z = F.z + Math.sin(a) * 20, y = heightAt(x, z);
    mesh(new THREE.CylinderGeometry(1.2, 1.6, 22, 12), M(0x6a5446), x, y + 11, z, g); const fl = mesh(new THREE.ConeGeometry(.9, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }), x, y + 23.2, z, g);
    DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 9 + i) * .25; }); addCol(x, z, 1.6);
    SMOKES.push({ x, z, y: y + 24, k: rnd() });
  }
  for (let i = 0; i < 8; i++) {                                             // market stalls and fire barrels
    const a = rnd() * 6.28, r = rr(8, 28), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r, y = heightAt(x, z), s = new THREE.Group();
    for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) mesh(new THREE.CylinderGeometry(.05, .05, 2.4, 5), M(0x5a4a3a), px, 1.2, pz, s);
    const tarp = mesh(new THREE.BoxGeometry(2.8, .05, 2.4), M(pick([0x8a3a2a, 0x3a5a7a, 0x6a6a3a])), 0, 2.4, 0, s); tarp.rotation.x = .12; mesh(new THREE.BoxGeometry(2.2, .8, .8), M(0x6a4a30), 0, .4, .5, s);
    s.position.set(x, y, z); s.rotation.y = rnd() * 6; g.add(s); addCol(x, z, 1.3);
    SHELTERS.push({ x, z, kind: 'house', r: 1.4 });
    const bx = x + 3, bz = z; mesh(new THREE.CylinderGeometry(.35, .35, .9, 10), M(0x5a4030), bx, heightAt(bx, bz) + .45, bz, g); const bf = mesh(new THREE.ConeGeometry(.3, .6, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }), bx, heightAt(bx, bz) + 1.1, bz, g); DECOR_ANIM.push(t => { bf.scale.y = 1 + Math.sin(t * 14 + i) * .3; });
  }
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28, x = F.x + Math.cos(a) * 30, z = F.z + Math.sin(a) * 30; mesh(new THREE.SphereGeometry(.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }), x, heightAt(x, z) + 6 + Math.sin(i) * .3, z, g); }
  // the strongroom, the armory, the workshop
  const sr = new THREE.Group(), sx = F.x, sz = F.z, sy = heightAt(sx, sz);
  mesh(new THREE.BoxGeometry(12, 7, 10), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x9a9690 }), 0, 3.5, 0, sr);
  const door = mesh(new THREE.CylinderGeometry(2.4, 2.4, .5, 24), S(0x8a8e90, { metalness: .8, roughness: .3 }), 0, 3, 5.1, sr); door.rotation.x = Math.PI / 2;
  for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.BoxGeometry(.2, 1.6, .2), S(0x6a6e70, { metalness: .8 }), Math.cos(k) * 1.2, 3 + Math.sin(k) * 1.2, 5.4, sr); sp.rotation.z = k; }
  sr.position.set(sx, sy, sz); g.add(sr); for (let t = -4; t <= 4; t += 2.5) addCol(sx + t, sz, 5, 7);
  cache(g, sx, sz + 6.6, 0, 'bypass', 'op', { id: 'strongroom', name: 'The strongroom', big: 1, rolls: 3, keys: ['gate_codes', 'ember', 'halcyon_chip'], refill: 5 });
  cache(g, F.x - 40, F.z + 18, 1, 'pry', 'mil', { id: 'f_armory', name: 'Ironjaw armory', big: 1, rolls: 3, refill: 3 });
  cache(g, F.x + 30, F.z - 35, 2, 'cutter', 'op', { id: 'f_workshop', name: 'Ironjaw workshop', big: 1, rolls: 1, keys: ['greyhold_card'], refill: 3 });
  for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, r = rr(15, 70); supplyCityCrate(F.x + Math.cos(a) * r, F.z + Math.sin(a) * r); }
}

/* ---------- Farlight: Arc survivors who trade ---------- */
const TRADER = { x: 0, z: 0 };
function buildFarlight(B) {
  const g = farGroup(B.x, B.z, B.R), y0 = heightAt(B.x, B.z);
  const hull = hullModule(6, 22); hull.position.set(B.x - 8, y0 + 3, B.z - 6); hull.rotation.set(0, .6, .25); g.add(hull); addColLine(B.x - 16, B.z - 12, B.x, B.z, 4);
  const plate = new THREE.MeshLambertMaterial({ map: texPanel, color: 0xb8bcc0 }), gateA = Math.atan2(-B.z, -B.x);
  for (let i = 0; i < 70; i++) { const a = i / 70 * 6.28; if (Math.abs(angWrap(a - gateA)) < .12) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; const p = mesh(new THREE.BoxGeometry(4.2, rr(3, 4), .3), plate, x, heightAt(x, z) + 1.6, z, g); p.rotation.y = -a + Math.PI / 2; p.rotation.z = rr(-.05, .05); addCol(x, z, 2); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .5, x = B.x + Math.cos(a) * 22, z = B.z + Math.sin(a) * 22; const t = mesh(new THREE.ConeGeometry(2.4, 3, 4), M(pick([0x6a7a8a, 0x8a8a7a, 0x5a6a5a])), x, heightAt(x, z) + 1.5, z, g); t.rotation.y = Math.PI / 4; addCol(x, z, 1.8); }
  // trader's counter, bench + forge + med tent you may use
  const tx = B.x + 10, tz = B.z + 8, ty = heightAt(tx, tz), st = new THREE.Group();
  mesh(new THREE.BoxGeometry(4, 1.1, 1), M(0x6a5a48), 0, .55, 0, st); for (const px of [-1.8, 1.8]) mesh(new THREE.CylinderGeometry(.06, .06, 2.8, 5), M(0x4a4a4a), px, 1.4, -.4, st);
  mesh(new THREE.BoxGeometry(4.4, .06, 2.4), M(0x3a5a7a), 0, 2.8, 0, st); st.position.set(tx, ty, tz); st.rotation.y = gateA; g.add(st); addColLine(tx - 1.6, tz, tx + 1.6, tz, .6);
  TRADER.x = tx + Math.cos(gateA) * 1.6; TRADER.z = tz + Math.sin(gateA) * 1.6; TRADER.at = { x: tx, z: tz };
  const bx = B.x - 12, bz = B.z + 14; mesh(new THREE.BoxGeometry(2.4, .1, 1), WOOD(), bx, heightAt(bx, bz) + .95, bz, g); mesh(new THREE.BoxGeometry(2.2, .9, .9), M(0x5a4430), bx, heightAt(bx, bz) + .45, bz, g); FACTION_ST.push({ x: bx, z: bz, st: ['bench'] });
  const fx = B.x + 2, fz = B.z + 20; mesh(new THREE.BoxGeometry(2, 1.6, 1.6), new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), fx, heightAt(fx, fz) + .8, fz, g); mesh(new THREE.BoxGeometry(.8, .4, .05), new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false }), fx, heightAt(fx, fz) + .9, fz + .81, g); addCol(fx, fz, 1.2); FACTION_ST.push({ x: fx, z: fz, st: ['forge', 'fire', 'cook'] });
  const mx = B.x + 18, mz = B.z - 10; const mt = mesh(new THREE.ConeGeometry(3, 3.4, 6), M(0xd8d8d0), mx, heightAt(mx, mz) + 1.7, mz, g); mesh(new THREE.BoxGeometry(.8, .8, .05), new THREE.MeshBasicMaterial({ color: 0xe04040, toneMapped: false }), mx, heightAt(mx, mz) + 2, mz + 2.2, g); FACTION_ST.push({ x: mx, z: mz + 3, st: ['lab'] });
  SHELTERS.push({ x: mx, z: mz, kind: 'house', r: 2.6 }, { x: tx, z: tz, kind: 'house', r: 2 });
  const fl = mesh(new THREE.ConeGeometry(1, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }), B.x, y0 + 1.2, B.z, g); DECOR_ANIM.push(t => { fl.scale.y = 1 + Math.sin(t * 12) * .2; });
}

/* ---------- Greyhold Station: concrete, chain-link, floodlights, soldiers in masks ---------- */
function buildGreyStation(B) {
  const g = farGroup(B.x, B.z, B.R), conc = new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xa8a8a4 }), gateA = Math.atan2(-B.z, -B.x);
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - gateA)) < .1) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; const f = mesh(lattice(5, 3.2, 0x8a8e90, 1), VCOL, x, heightAt(x, z), z, g); f.rotation.y = -a + Math.PI / 2; addCol(x, z, 2.4); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .4, x = B.x + Math.cos(a) * 26, z = B.z + Math.sin(a) * 26; mesh(new THREE.BoxGeometry(12, 4.5, 8), conc, x, heightAt(x, z) + 2.25, z, g).rotation.y = a; addCol(x, z, 4.6, 4.5); mesh(new THREE.BoxGeometry(2.4, 2.4, .1), M(0x1a1a1a), x - Math.sin(a) * 0, heightAt(x, z) + 1.2, z, g); }
  const hg = mesh(new THREE.CylinderGeometry(9, 9, 22, 18, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x7a7e80, side: THREE.DoubleSide }), B.x + 6, heightAt(B.x, B.z), B.z - 4, g); hg.rotation.z = Math.PI / 2; hg.rotation.y = gateA; addColLine(B.x - 4, B.z - 4, B.x + 16, B.z - 4, 4);
  const mast = mesh(lattice(1.4, 24, 0x9a3a2a, 2), VCOL, B.x - 14, heightAt(B.x - 14, B.z + 12), B.z + 12, g); const ml = mesh(new THREE.SphereGeometry(.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), B.x - 14, heightAt(B.x - 14, B.z + 12) + 24.4, B.z + 12, g); DECOR_ANIM.push(t => { ml.visible = Math.sin(t * 2.6) > 0; });
  for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, r = rr(10, 40), x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r; const sb = mesh(new THREE.BoxGeometry(4, 1.1, 1), M(0x8a7e5a), x, heightAt(x, z) + .55, z, g); sb.rotation.y = rnd() * 3; addCol(x, z, 1.2, 1.1); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28, x = B.x + Math.cos(a) * (B.R - 4), z = B.z + Math.sin(a) * (B.R - 4); mesh(new THREE.CylinderGeometry(.1, .1, 7, 6), M(0x5a5a5a), x, heightAt(x, z) + 3.5, z, g); mesh(new THREE.BoxGeometry(1, .6, .4), new THREE.MeshBasicMaterial({ color: 0xf0f6ff, toneMapped: false }), x, heightAt(x, z) + 7, z, g); }
  cache(g, B.x + 26 * Math.cos(.4) - 2, B.z + 26 * Math.sin(.4) + 5, 0, 'pry', 'mil', { id: 'grey_stash', name: 'Greyhold lockup', big: 1, rolls: 2, keys: ['greyhold_card'], refill: 4 });
  cache(g, B.x - 10, B.z - 20, 0, 'card', 'op', { id: 'grey_vault', name: 'Greyhold vault', big: 1, rolls: 1, keys: ['lab_sample', 'greyhold_files'], refill: 5 });
  for (let i = 0; i < 3; i++) { supplyCrate(B.x + rr(-30, 30), B.z + rr(-30, 30), 'mixed'); CRATES[CRATES.length - 1].table = 'mil'; }
}

/* ---------- Ironjaw yards: scrap walls, shacks, car stacks ---------- */
function buildIronYard(B) {
  const g = farGroup(B.x, B.z, B.R), gateA = Math.atan2(-B.z, -B.x), wall = [];
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - gateA)) < .1) continue; const x = B.x + Math.cos(a) * B.R, z = B.z + Math.sin(a) * B.R; wall.push([x, heightAt(x, z) - .2, z, 3.9, rr(3.6, 4.6), .25, 0, -a + Math.PI / 2, rr(-.05, .05), pick([0xd8a07a, 0xc8b8a8, 0xb89070])]); addCol(x, z, 1.95, 4); }
  g.add(instanced(boxGeo, new THREE.MeshLambertMaterial({ map: texCorr }), wall));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .3, x = B.x + Math.cos(a) * 20, z = B.z + Math.sin(a) * 20; const s = new THREE.Group(); mesh(new THREE.BoxGeometry(6, 3, 5), new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x8a6a4a, 0x7a7a6a]) }), 0, 1.5, 0, s); const r = mesh(new THREE.BoxGeometry(6.6, .15, 5.6), M(0x5a4a3a), 0, 3.1, 0, s); r.rotation.x = .1; s.position.set(x, heightAt(x, z), z); s.rotation.y = -a; g.add(s); addCol(x, z, 2.6, 3); }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { const x = B.x + 8 - i * 3.5, z = B.z - 6; car(x, z + k * .01, rnd() * .3).position.y += k * 1.35; }
  const t = new THREE.Group(); t.add(mesh(lattice(3, 8, 0x5a4a3a, 2.4), VCOL)); mesh(new THREE.BoxGeometry(4, .3, 4), M(0x4a3a2a), 0, 8, 0, t); t.position.set(B.x - 10, heightAt(B.x - 10, B.z + 10), B.z + 10); g.add(t); addCol(B.x - 10, B.z + 10, 2);
  const bf = mesh(new THREE.ConeGeometry(.6, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }), B.x, heightAt(B.x, B.z) + 1.2, B.z, g); DECOR_ANIM.push(tt => { bf.scale.y = 1 + Math.sin(tt * 13) * .3; });
  cache(g, B.x - 6, B.z + 12, 0, 'none', 'city', { id: B.id + '_stash', name: 'Ironjaw stash', big: 1, rolls: 2, refill: 3 });
  for (let i = 0; i < 3; i++) supplyCityCrate(B.x + rr(-25, 25), B.z + rr(-25, 25));
}
/* clan holds get a stash with an insignia */
function buildHoldStashes() {
  for (const H of HOLDS) cache(world, H.x + 6, H.z + 6, 0, 'none', 'clan', { id: H.id + '_stash', name: 'Clan stash', big: 1, rolls: 2, keys: ['insignia'], refill: 3 });
  cache(world, POI.ashmere.x + 8, POI.ashmere.z, 0, 'none', 'clan', { id: 'ashmere_stash', name: 'Ashmere stash', big: 1, rolls: 2, keys: ['insignia'], refill: 3 });
  cache(world, POI.village.x + 5, POI.village.z + 3, 0, 'none', 'clan', { id: 'outpost_stash', name: 'Outpost stash', rolls: 1, keys: ['insignia'], refill: 3 });
  // the Burn: the lander Tern's locker holds an Arc ID chip; the pod has an Arc kit
  cache(world, POI.burn.x + 6, POI.burn.z - 4, 0, 'none', 'arc', { id: 'tern_locker', name: 'Tern lander locker', rolls: 1, keys: ['id_chip', 'nav_console'], refill: 0 });
  cache(world, POI.pod.x - 3, POI.pod.z + 2, 0, 'none', 'arc', { id: 'pod_kit', name: 'Pod survival kit', rolls: 1, keys: ['wristband'], refill: 0 });
  // the Grey Door: open it with a Greyhold card
  cache(world, (POI.vaultFront || POI.vault).x, (POI.vaultFront || POI.vault).z, 0, 'card', 'op', { id: 'grey_door', name: 'The Grey Door', big: 1, rolls: 2, keys: ['arden_notes', 'blackvein', 'sunfall_data'], refill: 6 });
}
function buildBases() { buildCity(); for (const B of BASES) (B.fac === 'arc' ? buildFarlight : B.fac === 'grey' ? buildGreyStation : buildIronYard)(B); buildHoldStashes(); }

/* ---------- who guards what ---------- */
function baseGuards() {
  const F = FOUNDRY;
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = rr(10, F.R - 8); spawnClan(i % 5 === 4 ? 'brute' : 'gunner', F.x + Math.cos(a) * r, F.z + Math.sin(a) * r, 'guard', 'iron'); }
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.28, r = rr(F.R + 30, CITY.R - 20), [x, z] = cityShove(CITY.x + Math.cos(a) * r, CITY.z + Math.sin(a) * r); spawnClan(pick(['gunner', 'gunner', 'warrior']), x, z, 'guard', 'iron'); }   // (Nov 11) not inside the buildings or the quiet places
  for (const B of BASES) {
    if (B.fac === 'arc') { for (let i = 0; i < 6; i++) spawnNPC('extra', B.x + rr(-20, 20), B.z + rr(-20, 20), { wander: true }); const t = spawnNPC('trader', TRADER.x, TRADER.z, { model: 'civilian', tint: 0x6a8aa0, h: 1.72 }); t.trader = 1; t.shop = 'mara'; t.shopName = 'Mara'; named.trader = t; continue; }
    const n = B.fac === 'grey' ? 11 : 8;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rr(6, B.R - 6); spawnClan(B.fac === 'grey' ? 'soldier' : i % 4 === 3 ? 'brute' : 'gunner', B.x + Math.cos(a) * r, B.z + Math.sin(a) * r, 'guard', B.fac); }
  }
}

/* ---------- Farlight's trader: barter in scrap ---------- */
const TRADE_POOL = ['id_chip', 'map', 'seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot', 'bandage', 'painkiller', 'antibiotic', 'disinfect', 'medkit', 'purify_tab',
  'ammo_9', 'ammo_556', 'ammo_762', 'ammo_12', 'arrows', 'gunpowder', 'canned', 'arc_pack', 'salt', 'flour', 'rope', 'cloth', 'synth', 'nails', 'screws', 'bolts', 'glass', 'rubber', 'battery', 'circuit', 'wire', 'cu_wiring',
  'spare_parts', 'springs', 'fuel', 'tool_kit', 'iron', 'steel', 'leather', 'pistol', 'shotgun', 'crowbar', 'bolt_cutters', 'hand_saw', 'backpack', 'gas_mask', 'jacket', 'boots', 'fish_rod', 'flashlight', 'compass'];
function valueOf(id) {
  if (id === 'scrap') return 1;
  if (GEAR_DEFS[id]) return 6 + (GEAR_DEFS[id].t || 1) ** 2 * 5 + (WDEF[id]?.cls === 'gun' ? 25 : 0);
  const I = ITEMS[id]; if (!I) return 1;
  if (I.c === 'ammo') return { ammo_9: .4, ammo_556: .5, ammo_762: 1.2, ammo_12: 1, arrows: .6, ammo_flare: 3, bolts_xb: 1, cell: 3 }[id] || 4;
  if (I.c === 'story') return id === 'id_chip' ? 45 : 30;
  return Math.max(1, Math.round(({ ren: 1, craft: 2, salv: 3 }[I.src] || 1) * (1 + (I.t - 1) * 1.6) * (I.c === 'rare' ? 4 : I.c === 'elec' ? 2 : 1)));
}
const TRADE_LOT = { ammo_9: 15, ammo_45: 12, ammo_556: 20, ammo_762: 6, ammo_12: 8, arrows: 10, bolts_xb: 8, ammo_flare: 2, nails: 10, screws: 8, bolts: 5, fiber: 10, stick: 8, stone: 6 };
/* Kestrel's shops (and Mara out at Farlight): each keeper stocks their own trade; settlers barter what they've gathered */
const SHOP_STOCK = {
  mara: { pool: TRADE_POOL, k: 14, mark: 1.25, blurb: 'Mara trades in scrap.' },
  cook: { k: 12, mark: 1.15, tiered: 1, blurb: 'Bram feeds Kestrel. Hot food, clean water, seed stock.', pool: ['ration', 'cooked_fish', 'dried_meat', 'roast', 'smoked_fish', 'canned', 'arc_pack', 'stew', 'veg_soup', 'fish_soup', 'bread', 'water_boiled', 'water_filtered', 'salt', 'flour', 'oil', 'honey', 'potato', 'corn', 'beans', 'carrot', 'meat', 'fat', 'seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot', 'canteen', 'pot'] },
  craft: { k: 14, mark: 1.25, tiered: 1, blurb: 'Kade sells tools and metal stock.', pool: ['stone_axe', 'stone_pick', 'flint_knife', 'wood_shovel', 'hand_saw', 'fire_starter', 'needle', 'torch_t', 'metal_axe', 'pickaxe', 'hammer', 'crowbar', 'wrench', 'screwdriver', 'bolt_cutters', 'pliers', 'wire_cutters', 'multitool', 'welder', 'flashlight', 'climb_gear', 'lock_bypass', 'rust_detector', 'solar_charger', 'iron', 'steel', 'aluminum', 'copper', 'charcoal', 'pipe', 'gears', 'springs', 'spare_parts', 'tool_kit', 'fasteners', 'bolts', 'screws', 'nails', 'repair_kit'] },
  trade: { k: 16, mark: 1.3, tiered: 1, blurb: 'Odile buys and sells anything that isn’t nailed down.', pool: ['plank', 'log', 'rope', 'cloth', 'canvas', 'synth', 'leather', 'hide', 'glass', 'rubber', 'wire', 'cu_wiring', 'battery', 'circuit', 'sensor', 'fuse', 'antenna', 'fuel', 'gunpowder', 'clay', 'limestone', 'metal_ore', 'fertilizer', 'map', 'compass', 'binoculars', 'radio', 'fish_rod', 'backpack', 'duffel', 'arc_alloy', 'solar_cell', 'med_parts', 'engine_part', 'cable_spool', 'data_drive', 'purify_tab', 'canned'] },
  med: { k: 12, mark: 1.2, tiered: 1, blurb: 'Juno’s clinic. She’ll still patch you up for free.', pool: ['bandage', 'herb_bandage', 'splint', 'poultice', 'disinfect', 'painkiller', 'antibiotic', 'sutures', 'alcohol', 'purify_tab', 'medkit', 'surgical_kit', 'iv', 'rust_med', 'inject', 'herb_med', 'med_parts', 'gas_mask', 'med_scanner'] },
  guns: { k: 14, mark: 1.3, tiered: 1, blurb: 'Rook keeps the guns. Bring scrap, leave armed.', pool: ['ammo_9', 'ammo_45', 'ammo_556', 'ammo_762', 'ammo_12', 'arrows', 'bolts_xb', 'ammo_flare', 'frag', 'smoke_gren', 'molotov', 'throw_spear', 'pistol', 'revolver', 'shotgun', 'smg', 'assault', 'sniper', 'lmg', 'flare_gun', 'shortbow', 'recurve', 'crossbow', 'longbow', 'yumi', 'hornbow', 'hunt_recurve', 'hand_xbow', 'heavy_xbow', 'repeat_xbow', 'm1911', 'pump_rifle', 'machete', 'kukri', 'tomahawk', 'sword', 'war_axe', 'hunting_knife', 'mil_knife', 'stun_baton', 'metal_spear', 'repair_kit', 'gunpowder'] },
  salvage: { k: 12, mark: 1.35, sell: .75, tiered: 1, blurb: 'Gus pays the best rate in Kestrel for salvage, and sells the rare stuff.', pool: ['arc_alloy', 'solar_cell', 'shielding', 'med_parts', 'engine_part', 'cable_spool', 'gas_tank', 'spare_tire', 'winch', 'battery', 'circuit', 'sensor', 'fuse', 'antenna', 'power_cell', 'data_drive', 'camera', 'tablet', 'cu_wiring', 'wire', 'copper', 'aluminum', 'pipe', 'gears', 'springs', 'rubber', 'glass', 'fuel'] },
  wear: { k: 12, mark: 1.25, tiered: 1, blurb: 'Wren makes and mends what you wear.', pool: ['hide_coat', 'jacket', 'hunt_outfit', 'rain_cloak', 'leather_armor', 'metal_chest', 'arc_jumpsuit', 'util_vest', 'sec_uniform', 'tac_armor', 'hazmat', 'rust_suit', 'clan_mask', 'gas_mask', 'helmet', 'riot_helmet', 'nvg', 'gloves', 'arm_guards', 'shield', 'riot_shield', 'boots', 'hide_boots', 'backpack', 'duffel', 'canteen', 'thread', 'cloth', 'leather'] },
};
const SETTLER_POOL = ['log', 'plank', 'stick', 'stone', 'flint', 'fiber', 'rope', 'hide', 'leather', 'bone', 'sinew', 'fat', 'feather', 'meat', 'fish', 'berries', 'mushroom', 'roots', 'nuts', 'herb', 'herb_med', 'honey', 'clay', 'charcoal', 'metal_ore', 'cloth', 'wire', 'water_boiled', 'dried_meat', 'bandage', 'arrows', 'nails'];
const SETTLERS = [{ n: 'Tam', tint: 0xa08868 }, { n: 'Ilka', tint: 0x8aa0b0 }, { n: 'Brann', tint: 0x9a8a6a }, { n: 'Sova', tint: 0xb09080 }, { n: 'Pell', tint: 0x7a8a6a }, { n: 'Nico', tint: 0xa0a0b8 }];
for (let i = 0; i < SETTLERS.length; i++) SHOP_STOCK['settler' + i] = { pool: SETTLER_POOL, k: 4, mark: 1, settler: 1, blurb: `${SETTLERS[i].n} swaps what they gathered for scrap.` };
let curShopE = null;
const shopDef = () => SHOP_STOCK[curShopE?.shop] || SHOP_STOCK.mara;
const itemTier = id => GEAR_DEFS[id]?.t || ITEMS[id]?.t || 1;
function nearShopNPC() { let b = null, bd = 4.4; for (const e of ents) if (e.type === 'npc' && e.shop && !e.dead) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } } return b; }
function openTrade(e) { if (!e) return; curShopE = e; if (e.settler) e.t = 6; invTab = 'trade'; toggleInv(true); }
function tradeStock() {
  const key = curShopE?.shop || 'mara', D = SHOP_STOCK[key], TT = G.flags.trades = G.flags.trades || {}, T = TT[key] || {};
  if (T.day !== G.day || !T.list) {
    const L = [], cap = tierNow() + 1; let pool = D.pool.filter(id => ITEMS[id] || GEAR_DEFS[id]);
    if (D.tiered) pool = pool.filter(id => itemTier(id) <= cap);
    for (let i = 0; i < D.k && pool.length; i++) { const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; L.push([id, GEAR_DEFS[id] ? 1 : TRADE_LOT[id] || (D.settler ? Math.ceil(rr(1, 4)) : rnd() < .5 ? 1 : 2), GEAR_DEFS[id] ? 1 : D.settler ? 1 : Math.ceil(rr(2, 5))]); }
    TT[key] = { day: G.day, list: L };
  }
  return TT[key].list;
}
function buyTrade(i) {
  const L = tradeStock(), [id, n, left] = L[i]; if (left <= 0) return;
  const price = Math.ceil(valueOf(id) * n * shopDef().mark);
  if (INV.scrap < price) { sfx('no'); toast(`Needs ${price} scrap`); return; }
  INV.scrap -= price; give(id, n); L[i][2]--; sfx('buy'); toast(`Bought ${n > 1 ? n + ' ' : ''}${nameOf(id).toLowerCase()} for ${price} scrap`); save();
}
function sellTrade(id, g) {
  if (g) { const v = Math.max(2, Math.round(valueOf(g.id) * (shopDef().sell || .5) * g.d / g.max)); unequip(g); INV.tools.splice(INV.tools.indexOf(g), 1); INV.scrap += v; toast(`Sold ${GEAR_DEFS[g.id].n.toLowerCase()} · +${v} scrap`); }
  else { const lot = Math.min(cnt(id), TRADE_LOT[id] || 1), v = Math.max(1, Math.floor(valueOf(id) * lot * (shopDef().sell || .5))); take(id, lot); INV.scrap += v; toast(`Sold ${lot > 1 ? lot + ' ' : ''}${nameOf(id).toLowerCase()} · +${v} scrap`); }
  sfx('pickup'); save();
}
const nearTrader = () => curShopE && !curShopE.dead && Math.hypot(curShopE.x - P.x, curShopE.z - P.z) < 4.6;

/* ================= Cinder City, inside (Nov 11 · overhaul part 2: the city) =================
   Bryce's plan §1: the destroyed city becomes a major exploration location — enterable buildings, rooftops, basements, hidden
   rooms, collapsed structures, underground passages, valuable loot; some places dangerous (hostiles, wildlife, radiation,
   structural hazards), others peaceful; notes, terminals, recordings and skeletons that tell what happened.

   How it works
   - citySites() reserves whole blocks of the city grid before buildCity lays out the towers (buildCity skips them, without
     changing how much of the world's random stream it uses, so nothing else in the world moves).
   - Buildings are real: a raised ground floor (so no grass grows through it), storeys 3.4 m apart joined by a stacked ramp stair
     against the back wall, walkable floors (FLOORS rects), partitions with doorways, windows, a roof with a parapet and a stair
     bulkhead. Everything of a building merges into one mesh per material (hkit from 1f-houses.js); the inside only draws near.
   - Walls the player bumps into are y-aware segments (CWALLS, cityCollide), so a partition on the 2nd floor doesn't stop you on the
     roof. Outer walls also get ordinary column colliders (addCol) so people, animals and bullets respect them.
   - Underground (basements, a bunker, the Kessler Line metro tunnel) is reached by hatches/stairs (a short fade) and walked for real:
     P.under + UNDER rects stand in for the ground (cityGround). It only draws while you're down there.
   - Dangers: weak floors (patched boards) give way if you dawdle on them — sprint across; radiation (Cinder No. 4 and a leak in the
     tunnel) hurts and builds Rust poisoning unless you wear a hazmat / Rust suit. Quiet places (the Glasshouse, a rooftop garden):
     nobody hunts you there and you heal. Underground, the scavengers up top lose you.
   - Everything found is saved in G.flags.city (doors opened, floors fallen, power, records read); old saves just start empty.
   Its own random stream (crnd), so editing the city's insides never moves anything else. */

let CR_S = 52711;
const crnd = () => (CR_S = (CR_S * 16807) % 2147483647, (CR_S - 1) / 2147483646);
const cr = (a, b) => a + crnd() * (b - a), cpk = a => a[Math.floor(crnd() * a.length)], cp = p => crnd() < p;
const CFH = 3.4;                                              // storey height
const CWALLS = [], CWG = new Map(), UNDER = [], CITY_IT = [], WEAK = [], CZONES = [], CIN_G = [], CUN_G = [], CANIM = [], CDOORS = {};
let CITY_SITES = null, cityApplied = false, CITY_POWER = null, HOLLIS_HATCH = null;
const cityF = () => (G.flags.city ||= { open: {}, coll: {}, lore: {} });
const toolOK = need => GEAR_DEFS[need] ? has(GEAR_DEFS[need].kind) : cnt(need) > 0;

/* ---------- which blocks become what ---------- */
function citySites() {
  if (CITY_SITES) return CITY_SITES;
  const S = CITY_SITES = [], C = CITY, F = FOUNDRY, N = Math.ceil(C.R / 44), ok = [];
  for (let gx = -N; gx <= N; gx++) for (let gz = -N; gz <= N; gz++) {
    const x = C.x + gx * 44, z = C.z + gz * 44;
    if (Math.hypot(x - C.x, z - C.z) > C.R - 60 || Math.hypot(x - F.x, z - F.z) < F.R + 30) continue;
    if (envKeepClear(x, z, 20) || pathDist(x, z) < 18 || waterAt(x, z) > -1e8) continue;
    ok.push({ x, z });
  }
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const take = (def, tx, tz, score) => {
    let best = null, bs = 1e9;
    for (const b of ok) if (!b.used && !S.some(s => Math.hypot(s.x - b.x, s.z - b.z) < 60)) { const sc = score ? score(b) : Math.hypot(b.x - tx, b.z - tz); if (sc < bs) { bs = sc; best = b; } }
    if (!best) return null; best.used = 1;
    const s = { yaw: cpk(yaws), ...def, x: best.x, z: best.z }; s.rad = s.big ? 21 : Math.hypot(s.w, s.d) / 2 + 3; S.push(s); return s;
  };
  // the metro kiosk: west of the Foundry, level with it, so the line can run straight in under Ironjaw's wall
  take({ kind: 'metro', id: 'kessler', name: 'KESSLER ST.', w: 16, d: 12, n: 1, style: 'kiosk', yaw: 0 }, 0, 0, b => Math.abs(b.z - F.z) * 3 + Math.abs(b.x - (F.x - 150)) + (b.x > F.x - 125 || Math.abs(b.z - F.z) > 26 ? 1e5 : 0));
  const K = (a, r) => [C.x + Math.cos(a) * r, C.z + Math.sin(a) * r], kA = Math.atan2(-C.z, -C.x);   // kA: toward Kestrel
  take({ kind: 'bld', id: 'hollis', name: 'HOLLIS HARDWARE', w: 18, d: 14, n: 2, style: 'flat', open0: 1, cellar: 'hollis', hidden: null, weak: [], esc: 0,
    lore: [{ id: 'hollis_note', k: 1, ci: 0, ri: 1 }] }, ...K(kA, 290));
  take({ kind: 'bld', id: 'mercy', name: 'MERCY GENERAL', w: 26, d: 18, n: 4, style: 'hospital', cellar: 'morgue', roof: 'helipad', weak: [2],
    lore: [{ id: 'mercy_triage', k: 0, ci: 0, ri: 1, prop: 'term' }, { id: 'mercy_code', k: 2, ci: 1, ri: 0 }] }, ...K(kA + 2.2, 150));
  take({ kind: 'bld', id: 'precinct', name: 'PRECINCT 9', w: 24, d: 16, n: 3, style: 'police', roof: 'nest', hidden: { k: 1, how: 'boards', lore: 'precinct_cell' },
    lore: [{ id: 'precinct_log', k: 0, ci: 2, ri: 0, prop: 'term' }] }, ...K(kA - .9, 170));
  take({ kind: 'reactor', id: 'reactor', name: 'CINDER NO. 4', big: 1, w: 30, d: 30, style: 'ctl' }, ...K(kA + Math.PI - .4, 250));
  take({ kind: 'glass', id: 'glasshouse', name: 'THE GLASSHOUSE', big: 1, w: 30, d: 30, yaw: 0 }, ...K(kA + 1.1, 210));
  take({ kind: 'bld', id: 'flat1', w: 20, d: 16, n: 5, style: 'flat', roof: 'garden', esc: 1 }, ...K(kA - 2.0, 260));
  take({ kind: 'bld', id: 'flat2', w: 22, d: 16, n: 4, style: 'flat', hidden: { k: 1, how: 'shelf', lore: 'sealed_nine' }, weak: [2], weakOver: 1, cellar: 'cellar' }, ...K(kA + .55, 120));
  take({ kind: 'bld', id: 'flat3', w: 20, d: 15, n: 4, style: 'flat', weak: [1, 3], roof: 'camp', esc: 1 }, ...K(kA + 2.9, 290));
  take({ kind: 'bld', id: 'flat4', w: 18, d: 16, n: 3, style: 'flat', hidden: { k: 0, how: 'shelf', lore: 'sealed_flat4' }, cellar: 'cellar' }, ...K(kA - 1.5, 330));
  take({ kind: 'bld', id: 'flat5', w: 20, d: 14, n: 4, style: 'flat', roof: 'nest', esc: 1 }, ...K(kA + Math.PI + .5, 180));
  take({ kind: 'bld', id: 'office', name: 'CASSEL MUNICIPAL', w: 26, d: 18, n: 4, style: 'office', weak: [3], hidden: { k: 3, how: 'boards', lore: 'sealed_office' },
    lore: [{ id: 'office_terminal', k: 1, ci: 0, ri: 0, prop: 'term' }] }, ...K(kA - .3, 300));
  return S;
}
const citySiteAt = (x, z) => { for (const s of citySites()) if (Math.abs(x - s.x) < 4 && Math.abs(z - s.z) < 4) return s; return null; };
function cityInside(x, z, pad = 0) { for (const s of citySites()) if (Math.hypot(x - s.x, z - s.z) < s.rad + pad) return s; return null; }
function cityShove(x, z) { const s = cityInside(x, z, 4); if (!s) return [x, z]; const a = Math.atan2(z - s.z, x - s.x); return [s.x + Math.cos(a) * (s.rad + 6), s.z + Math.sin(a) * (s.rad + 6)]; }

/* ---------- frames, walls, floors ---------- */
function siteFrame(Q) {
  const c = Math.cos(Q.yaw), s = Math.sin(Q.yaw); Q.c = c; Q.s = s;
  Q.W = (lx, lz) => [Q.x + lx * c + lz * s, Q.z - lx * s + lz * c];
  Q.base = htm(Q.x, 0, Q.z, 0, Q.yaw, 0);
}
function cwall(Q, ax, az, bx, bz, y0, y1, t = .13) {
  const [x0, z0] = Q.W(ax, az), [x1, z1] = Q.W(bx, bz), w = { x0, z0, x1, z1, y0, y1, t, on: true };
  CWALLS.push(w);
  for (let i = Math.floor((Math.min(x0, x1) - 1) / CELL); i <= Math.floor((Math.max(x0, x1) + 1) / CELL); i++)
    for (let j = Math.floor((Math.min(z0, z1) - 1) / CELL); j <= Math.floor((Math.max(z0, z1) + 1) / CELL); j++) { const k = gkey(i, j); if (!CWG.has(k)) CWG.set(k, []); CWG.get(k).push(w); }
  return w;
}
const cbox = (Q, lx, lz, hx, hz, y0, y1) => [cwall(Q, lx - hx, lz - hz, lx + hx, lz - hz, y0, y1), cwall(Q, lx + hx, lz - hz, lx + hx, lz + hz, y0, y1), cwall(Q, lx + hx, lz + hz, lx - hx, lz + hz, y0, y1), cwall(Q, lx - hx, lz + hz, lx - hx, lz - hz, y0, y1)];
function cfloor(Q, lx, lz, hw, hd, y, slope, list = FLOORS) { const [x, z] = Q.W(lx, lz), f = { cx: x, cz: z, c: Q.c, s: Q.s, hw, hd, y }; if (slope) f.slope = slope; list.push(f); return f; }
function underAt(x, z, footY) {
  let best = -1e9;
  for (const f of UNDER) { const dx = x - f.cx, dz = z - f.cz, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c, fy = f.y + (f.slope || 0) * lx;
    if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd && footY > fy - 1.3 && fy > best) best = fy; }
  return best;
}
/* hooks (3-game.js): the ground under you when you're below it, and the walls you bump into */
function cityGround(x, z, y, gy) { if (!P.under) return gy; const u = underAt(x, z, y); if (u > -1e8) return u; P.under = false; return gy; }
function cityCollide(o, rad) {
  if (!CWALLS.length) return;
  const L = CWG.get(gkey(Math.floor(o.x / CELL), Math.floor(o.z / CELL))); if (!L) return;
  const y0 = (o.y || 0) + .3, y1 = (o.y || 0) + 1.75;
  for (let pass = 0; pass < 2; pass++) for (const w of L) {
    if (!w.on || w.y1 <= y0 || w.y0 >= y1) continue;
    const dx = w.x1 - w.x0, dz = w.z1 - w.z0, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((o.x - w.x0) * dx + (o.z - w.z0) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = w.x0 + dx * t, cz = w.z0 + dz * t, ex = o.x - cx, ez = o.z - cz, d = Math.hypot(ex, ez), m = rad + w.t;
    if (d < m) { if (d > 1e-5) { o.x = cx + ex / d * m; o.z = cz + ez / d * m; } else { const nl = Math.sqrt(l2) || 1; o.x = cx - dz / nl * m; o.z = cz + dx / nl * m; } }
  }
}
// a rectangle minus holes, as a few rectangles (x strips, merged where they match)
function rectMinus(r, holes) {
  const xs = new Set([r[0], r[2]]); for (const h of holes) for (const v of [h[0], h[2]]) if (v > r[0] && v < r[2]) xs.add(v);
  const X = [...xs].sort((a, b) => a - b), out = [];
  for (let i = 0; i < X.length - 1; i++) {
    const a = X[i], b = X[i + 1], m = (a + b) / 2; let iv = [[r[1], r[3]]];
    for (const h of holes) if (h[0] < m && h[2] > m) iv = iv.flatMap(([s, e]) => h[3] <= s || h[1] >= e ? [[s, e]] : [[s, Math.min(e, h[1])], [Math.max(s, h[3]), e]].filter(([p, q]) => q - p > .01));
    for (const [s, e] of iv) { const prev = out.find(o => Math.abs(o[2] - a) < 1e-6 && Math.abs(o[1] - s) < 1e-6 && Math.abs(o[3] - e) < 1e-6); if (prev) prev[2] = b; else out.push([a, s, b, e]); }
  }
  return out;
}
/* a run of wall with rectangular openings, cut into boxes, with its collision. ax 'x': along local x from a to b at z = at; 'z': along local z at x = at */
function cutWall(Q, K, mat, col, ax, a, b, at, v0, v1, t, holes, o = {}) {
  const cuts = new Set([a, b]); for (const h of holes) if (h.b > a && h.a < b) { cuts.add(Math.max(a, h.a)); cuts.add(Math.min(b, h.b)); }
  const xs = [...cuts].sort((p, q) => p - q);
  for (let i = 0; i < xs.length - 1; i++) {
    const p = xs[i], q = xs[i + 1]; if (q - p < .01) continue; const m = (p + q) / 2;
    let iv = [[v0, v1]];
    for (const h of holes) if (h.a < m && h.b > m) iv = iv.flatMap(([s, e]) => h.hi <= s || h.lo >= e ? [[s, e]] : [[s, h.lo], [h.hi, e]].filter(([s2, e2]) => e2 - s2 > .01));
    for (const [s, e] of iv) {
      if (ax === 'x') K.box(mat, q - p, e - s, t, m, (s + e) / 2, at, 0, 0, 0, col, o.tile || 2); else K.box(mat, t, e - s, q - p, at, (s + e) / 2, m, 0, 0, 0, col, o.tile || 2);
      if (!o.noCol) { if (ax === 'x') cwall(Q, p, at, q, at, s, e); else cwall(Q, at, p, at, q, s, e); }
    }
  }
}

/* ---------- looks ---------- */
const CSTYLE = {
  flat: { wall: () => cpk([0xb8ad9c, 0xa89c8a, 0xc4b8a4, 0x9c948a, 0xb0a490, 0xa8907c]), mat: 'conc', part: 0xc8bfae, floor: 0x8a8378, win: 1.3, sill: .95, head: 2.45, pitch: 3.1, rooms: ['bed', 'living', 'kitchen', 'bed', 'living', 'kitchen'] },
  office: { wall: () => cpk([0x8a9096, 0x9aa0a4, 0x7e8488]), mat: 'conc', part: 0xb8bcbc, floor: 0x6e7070, win: 2.3, sill: .75, head: 2.85, pitch: 2.9, rooms: ['office', 'office', 'office', 'living'] },
  hospital: { wall: () => cpk([0xd8d4cc, 0xccc8be]), mat: 'conc', part: 0xdcd8d0, floor: 0x9aa0a0, win: 1.5, sill: .9, head: 2.5, pitch: 3.2, rooms: ['ward', 'ward', 'office', 'ward'] },
  police: { wall: () => cpk([0x7a8088, 0x6e747c]), mat: 'block', part: 0xa8aaa8, floor: 0x6a6a66, win: 1.1, sill: 1.1, head: 2.3, pitch: 3.4, rooms: ['office', 'locker', 'office'] },
  ctl: { wall: () => 0x8a8a80, mat: 'block', part: 0xa0a098, floor: 0x5e605a, win: 1.2, sill: 1.1, head: 2.3, pitch: 3.6, rooms: ['office', 'locker'] },
  kiosk: { wall: () => 0x9a8a78, mat: 'block', part: 0xb0a898, floor: 0x7a7468, win: 2.2, sill: .6, head: 2.7, pitch: 3.6, rooms: [] },
};
const BONE = 0xd6cdb6;
function bones(K, x, y, z, ry, sit) {
  const c = Math.cos(ry), s = Math.sin(ry), o = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const put = (g, lx, ly, lz, rx = 0, rz = 0) => { const [px, pz] = o(lx, lz); K.geo('plain', g, htm(px, y + ly, pz, rx, ry, rz), BONE); };
  if (sit) {   // slumped against a wall
    put(new THREE.SphereGeometry(.11, 8, 6), 0, .78, .05, 0, .3); put(new THREE.CylinderGeometry(.025, .025, .5, 5), 0, .5, 0, .2);
    for (let i = 0; i < 4; i++) put(new THREE.BoxGeometry(.3 - i * .03, .02, .14), 0, .62 - i * .07, .05);
    for (const sx of [-.12, .12]) { put(new THREE.CylinderGeometry(.03, .025, .45, 5), sx, .1, .28, Math.PI / 2); put(new THREE.CylinderGeometry(.025, .02, .4, 5), sx, .12, .6, Math.PI / 2 + .3); put(new THREE.CylinderGeometry(.02, .02, .45, 5), sx * 2, .35, .14, .5, sx * 4); }
    return;
  }
  put(new THREE.SphereGeometry(.11, 8, 6), 0, .1, .82); put(new THREE.CylinderGeometry(.025, .025, .6, 5), 0, .05, .45, Math.PI / 2);
  for (let i = 0; i < 5; i++) put(new THREE.BoxGeometry(.32 - i * .03, .03, .025), 0, .07, .64 - i * .07);
  put(new THREE.BoxGeometry(.3, .08, .16), 0, .05, .12);
  for (const sx of [-.1, .1]) { put(new THREE.CylinderGeometry(.03, .025, .45, 5), sx, .04, -.15, Math.PI / 2, sx * .4); put(new THREE.CylinderGeometry(.025, .02, .42, 5), sx * 1.3, .04, -.58, Math.PI / 2); put(new THREE.CylinderGeometry(.02, .02, .55, 5), sx * 2.6, .04, .45, Math.PI / 2, sx * 2); }
}

/* ---------- the records: notes, terminals, recordings ---------- */
const CLORE = {
  hollis_note: { t: 'A note pinned to the shop counter', who: 'Note', lines: ['Dad — the shelter under the shop is stocked. I couldn’t keep the door code in my head, so I left it with Ilse at Mercy General.', 'Third floor, the nurses’ desk. Don’t come looking for me. — R.'] },
  mercy_code: { t: 'A card taped under the nurses’ desk', who: 'Note', lines: ['Ilse — R. Hollis came by. Asked me to keep this for his father: 4 1 7 7.', 'If the old man turns up he’ll know what it’s for. I’m on shift until they move us to the Grey Door.'] },
  mercy_triage: { t: 'Triage terminal', who: 'Terminal', lines: ['TRIAGE LOG · day 9 of the burning. Forty-one admitted.', 'Rust-coloured sputum. Burns that don’t match the fires.', 'Greyhold sent a van for the ones who tested clean. It didn’t come back for the rest.'] },
  mercy_morgue: { t: 'A recorder on the morgue desk', who: 'Recording', lines: ['(a man counting drawers under his breath, then:)', 'They told us the fog would pass over the city. It didn’t pass. It settled.'] },
  precinct_log: { t: 'Duty terminal', who: 'Terminal', lines: ['EVAC ORDER 7: all officers to the Ridge Road checkpoint.', 'Civilians not on the Greyhold list are to be turned back.', 'Officer Dane refused the order. Dane is suspended pending review.'] },
  precinct_cell: { t: 'Scratched into a cell wall', who: 'Wall', lines: ['DANE WAS RIGHT', '(under it, smaller: they bricked up the armoury so nobody could take the guns to the checkpoint)'] },
  reactor_log: { t: 'Control-room terminal', who: 'Terminal', lines: ['CINDER NO. 4 · coolant loop B lost pressure 03:12. Containment holding.', 'Staff evacuated to the dome. Do not open the dome.', 'Do not open the dome.'] },
  reactor_badge: { t: 'A dosimeter on a coat', who: 'Note', lines: ['A dosimeter is still clipped to the coat. The strip has gone black.'] },
  glass_gardener: { t: 'The gardener’s notebook', who: 'Note', lines: ['To whoever finds the Glasshouse: water the lemon tree. It’s the last one.', 'Nobody comes in here. The Ironjaw think the glass is cursed. Let them.'] },
  roof_garden: { t: 'A diary in a biscuit tin', who: 'Note', lines: ['Fourteen months on this roof. Rain barrels, beans, the pigeons.', 'From up here you can see their fires in the Foundry, and the red coming down off the ridge.', 'I’m going to try for the coast.'] },
  roof_camp: { t: 'A note weighed down with a brick', who: 'Note', lines: ['Ironjaw took the stairs on the east side. If you’re reading this, they missed my cache under the water tank.', 'Take it. Pay it forward.'] },
  kessler_poster: { t: 'A notice in the ticket hall', who: 'Notice', lines: ['KESSLER ST · Line 2 · Foundry Yards — Old Market — Port Cassel.', 'NOTICE: Line 2 is closed beyond Foundry Yards by order of Greyhold Civil Defence.'] },
  tunnel_claws: { t: 'A bricked-up branch tunnel', who: 'You', lines: ['Someone bricked this branch up in a hurry.', 'The mortar is scored from the other side. Deep, in fours.'] },
  tunnel_note: { t: 'A note in a dead man’s pocket', who: 'Note', lines: ['The generator on the platform still runs if you can find fuel. The gate opens with the power.', 'The line comes up under the Foundry — a manhole by the old tram shed. That’s how we got food in.'] },
  bunker_terminal: { t: 'Shelter terminal', who: 'Terminal', lines: ['SHELTER 12 · HOLLIS · occupants 0 of 6.', 'Last entry: they broadcast from the Mountain every night now. Same message. ALL ARE WELCOME.', 'Nobody who went has come back on the radio.'] },
  office_terminal: { t: 'Municipal mail terminal', who: 'Terminal', lines: ['CASSEL MUNICIPAL · internal mail · subject: relocation.', 'Departments will relocate to Greyhold Station. Bring nothing that can’t be carried.', 'Do not discuss the list.'] },
  sealed_nine: { t: 'Writing on the back of a door', who: 'Note', lines: ['We sealed ourselves in behind the shelf. It’s been nine days.', 'If the shelf moves, it isn’t us.'] },
  sealed_flat4: { t: 'A letter on the bed', who: 'Note', lines: ['Grandad built the shelf so the patrols wouldn’t find his room.', 'He said the city would come back. He kept the good things in here for when it did.'] },
  sealed_office: { t: 'A typed memo', who: 'Note', lines: ['RECORDS ROOM — SEALED. Copies of the list are not to leave this floor.', '(Every name on the page has been crossed out by hand. One hasn’t: yours is the kind of name it would be.)'] },
};
// where each record was found (the Journal groups them by place)
const CLORE_AT = { hollis_note: 'Hollis Hardware', mercy_code: 'Mercy General', mercy_triage: 'Mercy General', mercy_morgue: 'Mercy General', precinct_log: 'Precinct 9', precinct_cell: 'Precinct 9',
  reactor_log: 'Cinder No. 4', reactor_badge: 'Cinder No. 4', glass_gardener: 'The Glasshouse', roof_garden: 'Cinder City rooftops', roof_camp: 'Cinder City rooftops', kessler_poster: 'The Kessler Line',
  tunnel_claws: 'The Kessler Line', tunnel_note: 'The Kessler Line', bunker_terminal: 'Shelter 12', office_terminal: 'Cassel Municipal', sealed_nine: 'Cinder City · sealed rooms', sealed_flat4: 'Cinder City · sealed rooms', sealed_office: 'Cassel Municipal' };
// (Nov 11) the city's records go into the Journal from Part 1 (2f-explore.js: LOGS, openLog) so there's one place to read them all
function cityLogs() {
  if (typeof LOGS !== 'object') return;
  for (const id in CLORE) { const L = CLORE[id]; LOGS['city_' + id] = { at: CLORE_AT[id] || 'Cinder City', kind: { Terminal: 'term', Recording: 'rec', Wall: 'carve', You: 'carve' }[L.who] || 'note', t: L.t, by: '', b: L.lines.join(' ') }; }
}
function readLore(id) {
  const L = CLORE[id]; if (!L) return; const F = cityF(), first = !F.lore[id]; F.lore[id] = 1;
  if (typeof openLog === 'function' && typeof LOGS === 'object' && LOGS['city_' + id]) { openLog('city_' + id); if (first) save(); return; }
  say(L.lines.map(s => [L.who, s])); if (first) { toast(`${L.t} · city records ${Object.keys(F.lore).length} / ${Object.keys(CLORE).length}`, 3.2); save(); }
}
function cit(Q, lx, lz, y, l, act, r = 2.2, dy = 1.9) { const [x, z] = Q.W(lx, lz), it = { x, z, y, r, dy, l, act }; CITY_IT.push(it); return it; }
// a record and the thing it's on: a paper on a surface, a terminal, a recorder
function lorePt(Q, K, lx, lz, y, id, prop = 'note', ry = 0) {
  if (prop === 'term') {
    K.box('metal', 1.1, .75, .6, lx, y + .375, lz, 0, ry, 0, 0x4a4e50, 1); K.box('plain', .55, .4, .08, lx, y + 1.0, lz, 0, ry, 0, 0x2a2c2e);
    K.box('glow', .48, .32, .02, lx + Math.sin(ry) * .05, y + 1.0, lz + Math.cos(ry) * .05, 0, ry, 0, 0x38c888);
  } else if (prop === 'rec') { K.box('plain', .26, .08, .18, lx, y + .04, lz, 0, ry, 0, 0x2a2a2a); K.box('glow', .03, .03, .03, lx + .08, y + .09, lz, 0, 0, 0, 0xff3020); }
  else if (prop !== 'none') K.box('paper', .24, .006, .32, lx, y + .006, lz, 0, ry + cr(-.4, .4), 0, 0xffffff);
  const L = CLORE[id];
  return cit(Q, lx, lz, y, () => (cityF().lore[id] ? 'Again · ' : prop === 'term' ? 'Read the terminal · ' : prop === 'rec' ? 'Play the recording · ' : 'Read · ') + L.t.replace(/^(A|An|The) /, m => m.toLowerCase()), () => readLore(id), 2, 2.2);
}
// a stash inside: its own id so saves keep track of it, raised to its floor, bumped into like a wall
function ccache(Q, lx, lz, y, ry, lock, table, o = {}) {
  const [x, z] = Q.W(lx, lz), C = cache(Q.g, x, z, ry + Q.yaw, lock, table, { ...o, y, noCol: 1 });
  cbox(Q, lx, lz, o.big ? 1.25 : .72, o.big ? .65 : .42, y, y + (o.big ? 1.6 : .9));
  return C;
}

/* ---------- a building: shell, floors, stairs, rooms ---------- */
function cityBuild(Q, root) {
  siteFrame(Q);
  const hw = Q.w / 2, hd = Q.d / 2, n = Q.n, st = CSTYLE[Q.style || 'flat'];
  let hi = -1e9, lo = 1e9;
  for (let i = -1; i <= 1.001; i += .25) for (let j = -1; j <= 1.001; j += .25) { const [x, z] = Q.W(i * (hw + 3), j * (hd + 3)), h = heightAt(x, z); hi = Math.max(hi, h); lo = Math.min(lo, h); }
  const y0 = Q.y0 = hi + 1.2, top = Q.top = y0 + n * CFH, Y = k => y0 + k * CFH; Q.lo = lo;
  const g = Q.g = new THREE.Group(), gi = Q.gi = new THREE.Group(); root.add(g); root.add(gi);
  CIN_G.push({ g: gi, x: Q.x, z: Q.z, r: Math.hypot(hw, hd) });
  const KE = Q.KE = hkit(), KI = Q.KI = hkit(); KE.at(Q.base); KI.at(Q.base);
  const wc = Q.wc = st.wall(), ix0 = -hw + .15, ix1 = hw - .15, iz0 = -hd + .15, iz1 = hd - .15;
  const stair = !Q.noStair, zb0 = iz0, zb1 = iz0 + 1.7, xa = ix0 + 1.6, xb = xa + 6.4;
  const zm = ((stair ? zb1 : iz0) + iz1) / 2, xs1 = ix0 + (ix1 - ix0) / 3, xs2 = ix0 + 2 * (ix1 - ix0) / 3;
  const cols = [[ix0, xs1], [xs1, xs2], [xs2, ix1]], rows = [[stair ? zb1 : iz0, zm], [zm, iz1]];
  const L = Q.L = { hw, hd, ix0, ix1, iz0, iz1, zb0, zb1, xa, xb, zm, xs1, xs2, cols, rows, Y, stair };
  Q.weakAt = [];
  for (const k of Q.weak || []) {
    let ci = cpk([0, 1, 2]), ri = cpk([0, 1]);
    if (Q.weakOver && Q.hidden && k === Q.hidden.k + 1) { ci = 2; ri = 1; } else if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) ci = 0;
    const [a, b] = cols[ci], [c, d] = rows[ri], ex = Math.min(1.6, (b - a) / 2 - .75), ez = Math.min(1.6, (d - c) / 2 - .75), mx = (a + b) / 2, mz = (c + d) / 2;
    Q.weakAt.push({ k, ci, ri, r: [mx - ex, mz - ez, mx + ex, mz + ez] });
  }
  // outer walls: windows on every storey, the door, a parapet; down past the ground so the plinth hides it
  const vB = lo - .6, vT = top + 1.1;
  const holes = (len, front) => {
    const H = [], nw = Math.max(1, Math.floor((len - 2.4) / st.pitch)), sp = (len - 2.4) / nw;
    for (let k = 0; k < n; k++) for (let i = 0; i < nw; i++) {
      const c = -len / 2 + 1.2 + sp * (i + .5);
      if (front && k === 0) { if (Math.abs(c) < 2) continue; if (Q.open0) { H.push({ a: c - sp / 2 + .35, b: c + sp / 2 - .35, lo: Y(0) + .55, hi: Y(0) + 2.8, k, c }); continue; } }
      const big = cp(.07), ww = st.win;
      H.push({ a: c - ww / 2 - (big ? .3 : 0), b: c + ww / 2 + (big ? .45 : 0), lo: Y(k) + st.sill - (big ? .5 : 0), hi: Y(k) + st.head + (big ? .25 : 0), k, c });
    }
    if (front) H.push({ a: -1, b: 1, lo: y0, hi: y0 + 2.7, door: 1 });
    return H;
  };
  const sides = [
    { ax: 'x', a: -hw - .15, b: hw + .15, at: hd, H: holes(Q.w, true), out: [0, 1] },
    { ax: 'x', a: -hw - .15, b: hw + .15, at: -hd, H: holes(Q.w), out: [0, -1] },
    { ax: 'z', a: -hd + .15, b: hd - .15, at: hw, H: holes(Q.d - .3), out: [1, 0] },
    { ax: 'z', a: -hd + .15, b: hd - .15, at: -hw, H: holes(Q.d - .3), out: [-1, 0] },
  ];
  for (const sd of sides) {
    cutWall(Q, KE, st.mat, wc, sd.ax, sd.a, sd.b, sd.at, vB, vT, .3, sd.H);
    for (const h of sd.H) {   // glass, frames, boards
      if (h.door) continue; const w = h.b - h.a, hh = h.hi - h.lo, c = (h.a + h.b) / 2, cy = (h.lo + h.hi) / 2, f = (sw, sh, du, dv) => sd.ax === 'x' ? [sw, sh, .08, c + du, cy + dv, sd.at] : [.08, sh, sw, sd.at, cy + dv, c + du];
      const r = crnd();
      if (r < .3) { const [a1, a2, a3, a4, a5, a6] = f(w - .05, hh - .05, 0, 0); KE.box('glass', a1, a2, a3 * .5, a4, a5, a6); }
      else if (r < .42) for (let i = 0; i < 3; i++) { const [a1, a2, a3, a4, a5, a6] = f(w + .2, .16, 0, (i - 1) * hh * .3); KE.box('board', a1, a2, a3, a4 + (sd.ax === 'z' ? sd.out[0] * .2 : 0), a5, a6 + (sd.ax === 'x' ? sd.out[1] * .2 : 0), 0, 0, cr(-.12, .12), tint(cpk(WOODC)), 1); }
      const [s1, s2, s3, s4, s5, s6] = f(w + .14, .08, 0, -hh / 2 - .04); KE.box('conc', s1, s2, s3 * 3, s4 + sd.out[0] * .12, s5, s6 + sd.out[1] * .12, 0, 0, 0, 0xa8a49c);
    }
    // column colliders for people, animals and bullets (not across the door)
    const [ax0, az0] = sd.ax === 'x' ? [sd.a, sd.at] : [sd.at, sd.a], [ax1, az1] = sd.ax === 'x' ? [sd.b, sd.at] : [sd.at, sd.b];
    const runs = sd.H.some(h => h.door) ? [[ax0, -1.15], [1.15, ax1]] : [[sd.ax === 'x' ? ax0 : az0, sd.ax === 'x' ? ax1 : az1]];
    for (const [p, q] of runs) { const [x0, z0] = sd.ax === 'x' ? Q.W(p, sd.at) : Q.W(sd.at, p), [x1, z1] = sd.ax === 'x' ? Q.W(q, sd.at) : Q.W(sd.at, q); addColLine(x0, z0, x1, z1, .3); }
  }
  // floor lines and the cornice
  for (let k = 1; k <= n; k++) { const y = k === n ? vT : Y(k) - .1, th = k === n ? .3 : .22;
    KE.box('conc', Q.w + .5, th, .5, 0, y, hd, 0, 0, 0, 0xa8a298); KE.box('conc', Q.w + .5, th, .5, 0, y, -hd, 0, 0, 0, 0xa8a298);
    KE.box('conc', .5, th, Q.d - .1, hw, y, 0, 0, 0, 0, 0xa8a298); KE.box('conc', .5, th, Q.d - .1, -hw, y, 0, 0, 0, 0, 0xa8a298); }
  // the way in: steps, a ramp floor up to the door, the door hanging open
  { const tg = heightAt(...Q.W(0, hd + 2.8)), rise = y0 - tg;
    for (let i = 0; i < 4; i++) KE.box('conc', 2.6, rise * (i + 1) / 4, .7, 0, tg + rise * (i + 1) / 8, hd + 2.6 - i * .7, 0, 0, 0, 0x8e8a82);
    const [rx, rz] = Q.W(0, hd + 1.55); FLOORS.push({ cx: rx, cz: rz, c: Math.cos(Q.yaw + Math.PI / 2), s: Math.sin(Q.yaw + Math.PI / 2), hw: 1.4, hd: 1.25, y: (y0 + tg) / 2, slope: rise / 2.8 });
    KE.box('board', 1.05, 2.6, .07, -.6, y0 + 1.3, hd + .55, 0, -1.15, 0, tint(0x6a5a48), 1); }
  if (Q.name) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), hSignMat(Q.name, Q.style === 'hospital' || Q.style === 'office' ? 'serif' : 'stencil'));
    const [sx, sz] = Q.W(0, hd + .3); sg.position.set(sx, y0 + 3.0, sz); sg.rotation.y = Q.yaw; g.add(sg); }
  // floors (the stair hole and any weak patches cut out), each a walkable rect
  for (let k = 0; k <= n; k++) {
    const y = Y(k), hl = [];
    if (k > 0 && stair) hl.push([xa, zb0, xb, zb1]);
    for (const W of Q.weakAt) if (W.k === k) hl.push(W.r);
    for (const [a, b, c, d] of k === 0 ? [[ix0, iz0, ix1, iz1]] : rectMinus([ix0, iz0, ix1, iz1], hl)) {
      cfloor(Q, (a + c) / 2, (b + d) / 2, (c - a) / 2, (d - b) / 2, y);
      const th = k === 0 ? y - (lo - .4) : .32, K = k === n ? KE : KI;
      K.box(k === n ? 'conc' : 'conc', c - a + (k === n ? .02 : 0), th, d - b, (a + c) / 2, y - th / 2, (b + d) / 2, 0, 0, 0, k === n ? 0x7a7670 : tint(st.floor, .06), 2);
    }
  }
  // the stair: a ramp per storey stacked against the back wall (12 treads), walled off from the rooms
  if (stair) {
    const sl = xb - xa, bz = (zb0 + zb1) / 2, bw = zb1 - zb0;
    for (let k = 0; k < n; k++) {
      const yA = Y(k); cfloor(Q, (xa + xb) / 2, bz, sl / 2, bw / 2, yA + CFH / 2, CFH / sl);
      for (let i = 0; i < 12; i++) KI.box('conc', sl / 12 + .02, .2, bw - .05, xa + (i + .5) * sl / 12, yA + (i + .5) * CFH / 12, bz, 0, 0, 0, 0x9a958c, 1);
      KI.box('conc', Math.hypot(sl, CFH), .25, bw - .1, (xa + xb) / 2, yA + CFH / 2 - .3, bz, 0, 0, Math.atan2(CFH, sl), 0x8a857c, 2);
    }
    KI.box('conc', sl + .1, top - y0, .14, (xa + xb) / 2, (y0 + top) / 2, zb1, 0, 0, 0, st.part, 2);
    KE.box('conc', sl + .4, 2.7, .2, (xa + xb) / 2, top + 1.35, zb1, 0, 0, 0, wc, 2);
    cwall(Q, xa, zb1, xb, zb1, y0, top + 2.7);
    KI.box('conc', .14, 2.1, bw, xb, y0 + 1.05, bz, 0, 0, 0, st.part, 1); cwall(Q, xb, zb0, xb, zb1, y0, y0 + 2.1);   // shut the space under the first flight
    // the bulkhead on the roof: open toward the roof at the top of the flight
    KE.box('conc', sl + .4, 1.6, .3, (xa + xb) / 2, top + 1.9, -hd, 0, 0, 0, wc, 2);
    KE.box('conc', .2, 2.7, bw + .2, xa - .1, top + 1.35, bz, 0, 0, 0, wc, 2); cwall(Q, xa - .1, zb0 - .1, xa - .1, zb1, top - .2, top + 2.7);
    KE.box('conc', sl + .6, .2, bw + .6, (xa + xb) / 2, top + 2.8, bz, 0, 0, 0, 0x6a6660, 2);
  }
  // partitions: three columns of rooms, front and back, a doorway into each; the hidden room's are shut
  for (let k = 0; k < n; k++) {
    if (k === 0 && Q.open0) continue;
    const y = Y(k), yt = Y(k + 1) - .32, hid = Q.hidden && Q.hidden.k === k, dh = 2.25, door = m => ({ a: m - .62, b: m + .62, lo: y - .2, hi: y + dh });
    cutWall(Q, KI, 'conc', st.part, 'x', ix0, ix1, zm, y, yt, .14, cols.map(([a, b], i) => hid && i === 2 ? null : door((a + b) / 2)).filter(Boolean), { tile: 2.5 });
    for (const [i, xs] of [[0, xs1], [1, xs2]]) {
      cutWall(Q, KI, 'conc', st.part, 'z', zm, iz1, xs, y, yt, .14, [door((zm + iz1) / 2)], { tile: 2.5 });
      cutWall(Q, KI, 'conc', st.part, 'z', rows[0][0], zm, xs, y, yt, .14, [door((rows[0][0] + zm) / 2)], { tile: 2.5 });
      if (hid && i === 1) secretDoor(Q, Q.id + '_hid', xs2, (zm + iz1) / 2, y, Q.hidden.how);
    }
  }
  weakFloors(Q);
}
function cityFinish(Q) { Q.KE.build(Q.g, true, false); Q.KI.build(Q.gi, true, true); }

/* ---------- rooms ---------- */
function furnish(Q, k, ci, ri) {
  const K = Q.KI, L = Q.L, [a, b] = L.cols[ci], [c, d] = L.rows[ri], y = L.Y(k), st = CSTYLE[Q.style || 'flat'];
  const solid = (mat, w, h, dd, x, z, col, yy = y) => { K.box(mat, w, h, dd, x, yy + h / 2, z, 0, 0, 0, col, 1); if (h > .45) cbox(Q, x, z, w / 2, dd / 2, yy, yy + h); };
  const at = (w, dd, sx, sz) => [sx < 0 ? a + w / 2 + .15 : b - w / 2 - .15, sz < 0 ? c + dd / 2 + .15 : d - dd / 2 - .15];
  const wood = () => tint(cpk(WOODC)), cloth = () => tint(cpk(CLOTHC));
  // the mess: rubble, paper, a chair on its side
  for (let i = 0; i < 3; i++) K.box('conc', cr(.2, .6), cr(.1, .3), cr(.2, .6), cr(a + .8, b - .8), y + .1, cr(c + .8, d - .8), cr(-.3, .3), cr(0, 3), cr(-.3, .3), 0x8a857c, 1);
  for (let i = 0; i < 4; i++) K.box('paper', .22, .004, .3, cr(a + .5, b - .5), y + .004 + i * .001, cr(c + .5, d - .5), 0, cr(0, 6), 0, 0xffffff);
  if (cp(.5)) { const [x, z] = at(.5, .5, cp(.5) ? -1 : 1, cp(.5) ? -1 : 1); K.box('board', .45, .05, .45, x, y + .25, z, 1.4, cr(0, 3), 0, wood(), 1); K.box('board', .45, .45, .05, x, y + .12, z + .2, 1.4, cr(0, 3), 0, wood(), 1); }
  const kind = k === 0 && ri === 1 && ci === 1 ? 'lobby' : Q.style === 'police' && k === 0 && ri === 0 ? 'cells' : cpk(st.rooms.length ? st.rooms : ['living']);
  const sx = cp(.5) ? -1 : 1, sz = cp(.5) ? -1 : 1;
  if (kind === 'bed') {
    let [x, z] = at(2.1, 1.5, sx, sz); solid('board', 2.1, .45, 1.5, x, z, wood()); K.box('cloth', 1.9, .2, 1.35, x, y + .55, z, 0, 0, cr(-.03, .03), cloth(), 1);
    [x, z] = at(1.1, .6, -sx, sz); solid('board', 1.1, 2, .6, x, z, wood());
  } else if (kind === 'living') {
    let [x, z] = at(2, .85, sx, sz); solid('cloth', 2, .45, .85, x, z, cloth()); K.box('cloth', 2, .45, .2, x, y + .7, z + (sz < 0 ? -.33 : .33), 0, 0, 0, cloth(), 1);
    [x, z] = at(1.4, .35, -sx, -sz); solid('board', 1.4, 1.8, .35, x, z, wood());
    K.box('cloth', 2.2, .02, 1.6, (a + b) / 2 + sx * .6, y + .01, (c + d) / 2 + sz * .5, 0, cr(-.2, .2), 0, cloth(), 1);
  } else if (kind === 'kitchen') {
    let [x, z] = at(2.4, .62, sx, sz); solid('plain', 2.4, .9, .62, x, z, 0x9a948a); K.box('plain', 2.4, .05, .66, x, y + .92, z, 0, 0, 0, 0x5a5650);
    K.box('plain', 2.4, .6, .35, x, y + 1.85, z + (sz < 0 ? -.12 : .12), 0, 0, 0, 0x8a8478);
    [x, z] = at(.72, .72, -sx, sz); solid('shiny', .72, 1.8, .72, x, z, 0xc8c8c0);
  } else if (kind === 'office') {
    for (const ox of [-1, 1]) { const x = (a + b) / 2 + ox * (b - a) * .22, z = (c + d) / 2 + sz * (d - c) * .2; solid('board', 1.4, .75, .7, x, z, 0x6a5a48);
      K.box('plain', .5, .34, .06, x, y + 1.0, z, 0, 0, 0, 0x2a2c2e); K.box('glow', .44, .26, .01, x, y + 1.0, z + .035, 0, 0, 0, 0x0e1612); }
    const [x, z] = at(.5, .6, -sx, -sz); solid('metal', .5, 1.35, .6, x, z, 0x6a7072);
  } else if (kind === 'ward') {
    for (const ox of [-1, 1]) { const [x, z] = at(.95, 2, ox, sz); solid('metal', .95, .55, 2, x, z, 0xb8bcbc); K.box('cloth', .85, .14, 1.9, x, y + .62, z, 0, 0, 0, 0xd8d8d0, 1); K.cyl('metal', .02, .02, 1.7, 5, x + ox * -.6, y + .85, z - .7, 0, 0, 0, 0x8a8e90); }
    K.box('cloth', .04, 1.9, 2.4, (a + b) / 2, y + 1.3, (c + d) / 2, 0, 0, 0, 0x9ab0b4, 1);
  } else if (kind === 'locker') {
    const [x, z] = at(2.4, .5, sx, sz); for (let i = 0; i < 4; i++) solid('metal', .58, 1.9, .5, x - .9 + i * .6, z, tint(0x5a6a6e, .08)); K.box('board', 2, .45, .4, (a + b) / 2, y + .22, (c + d) / 2 + sz * .4, 0, 0, 0, 0x6a5a48, 1);
  } else if (kind === 'cells') {
    for (let i = 0; i < 9; i++) K.cyl('metal', .025, .025, CFH - .4, 5, a + .3 + i * (b - a - .6) / 8, y + (CFH - .4) / 2, (c + d) / 2 + .6, 0, 0, 0, 0x4a4e50);
    cwall(Q, a, (c + d) / 2 + .6, (a + b) / 2 - .5, (c + d) / 2 + .6, y, y + 3); cwall(Q, (a + b) / 2 + .5, (c + d) / 2 + .6, b, (c + d) / 2 + .6, y, y + 3);
    const [x, z] = at(1.8, .7, sx, -1); solid('metal', 1.8, .4, .7, x, z, 0x6a6e70); bones(K, (a + b) / 2 + sx * 1.2, y, c + .4, Math.PI, 1);
  } else if (kind === 'lobby') {
    const [x, z] = at(2.6, .7, sx, -1); solid('board', 2.6, 1.05, .7, x, z, Q.style === 'hospital' ? 0xc8c4bc : 0x5a4a3a);
  }
}
function shopFloor(Q) {
  // an open shop floor: aisles of shelving, the counter by the window, stock everywhere
  const L = Q.L, K = Q.KI, y = L.Y(0), x0 = L.ix0 + 2.6, x1 = L.xs2 - .6;
  for (const z of [L.zm - 1.8, L.zm + 1.2, L.zm + 3.6]) { if (z > L.iz1 - 1.4) continue;
    for (let i = 0; i < 4; i++) K.box('metal', x1 - x0, .04, .55, (x0 + x1) / 2, y + .15 + i * .55, z, 0, 0, 0, 0x6a6e70);
    for (const x of [x0, x1]) K.box('metal', .05, 1.9, .55, x, y + .95, z, 0, 0, 0, 0x4a4e50);
    for (let i = 0; i < 18; i++) K.box('plain', cr(.2, .45), cr(.15, .4), cr(.2, .4), cr(x0 + .3, x1 - .3), y + .25 + Math.floor(cr(0, 4)) * .55, z, 0, cr(-.2, .2), 0, cpk([0xa83a2a, 0x3a6a8a, 0x8a8a3a, 0x6a5a4a, 0x9a9a9a]), 1);
    cbox(Q, (x0 + x1) / 2, z, (x1 - x0) / 2, .28, y, y + 1.9); }
  K.box('board', 3, 1, .8, L.ix1 - 2, y + .5, L.iz1 - 1.6, 0, 0, 0, 0x6a5038, 1); cbox(Q, L.ix1 - 2, L.iz1 - 1.6, 1.5, .4, y, y + 1);
  K.box('metal', .5, .3, .4, L.ix1 - 1.4, y + 1.15, L.iz1 - 1.6, 0, 0, 0, 0x3a3a3a);
  for (let i = 0; i < 10; i++) K.box('plain', cr(.2, .5), cr(.1, .3), cr(.2, .5), cr(L.ix0 + 1, L.ix1 - 1), y + .08, cr(L.zm - 3, L.iz1 - 1), 0, cr(0, 3), cr(-.4, .4), cpk([0xa83a2a, 0x3a6a8a, 0x6a5a4a]), 1);
}
function dressRooms(Q) {
  const L = Q.L;
  if (Q.open0 && Q.kind === 'bld') shopFloor(Q);
  for (let k = 0; k < Q.n; k++) for (let ci = 0; ci < 3; ci++) for (let ri = 0; ri < 2; ri++) {
    if (k === 0 && Q.open0) continue;
    if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) continue;
    if (Q.weakAt.some(W => W.k === k && W.ci === ci && W.ri === ri) && cp(.6)) continue;
    furnish(Q, k, ci, ri);
  }
  // records
  for (const R of Q.lore || []) { const [a, b] = L.cols[R.ci], [c, d] = L.rows[R.ri], y = L.Y(R.k), x = a + 1.2, z = c + 1.1;
    if (R.prop === 'term') lorePt(Q, Q.KI, x, z, y, R.id, 'term', Math.PI * 0); else { Q.KI.box('board', 1.2, .78, .7, x, y + .39, z, 0, 0, 0, 0x5a4a3a, 1); cbox(Q, x, z, .6, .35, y, y + .8); lorePt(Q, Q.KI, x, z, y + .79, R.id, 'note'); } }
  // stashes: two or three ordinary ones per building, somewhere up the stairs
  const names = { flat: ['Kitchen cupboards', 'A wardrobe', 'Under the bed', 'A tool cupboard'], office: ['Desk drawers', 'A filing cabinet', 'The supply closet'], hospital: ['A medicine cabinet', 'A crash cart', 'The supply closet'],
    police: ['An evidence locker', 'A desk drawer', 'A locker'], ctl: ['A locker', 'A tool chest'], kiosk: ['The ticket office'] }[Q.style || 'flat'];
  const nst = Q.style === 'kiosk' ? 0 : 2 + (cp(.5) ? 1 : 0);
  for (let i = 0; i < nst; i++) {
    const k = Math.min(Q.n - 1, Math.floor(cr(Q.open0 ? 1 : 0, Q.n))), ci = cpk([0, 1, 2]), ri = cpk([0, 1]);
    if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) continue;
    const [a, b] = L.cols[ci], [c, d] = L.rows[ri];
    const med = Q.style === 'hospital';
    ccache(Q, (a + b) / 2 + (cp(.5) ? -1 : 1) * ((b - a) / 2 - 1.1), d - .6, L.Y(k), 0, cp(.25) ? 'pry' : 'none', med ? 'ruin' : cp(.3) ? 'ruin' : 'city',
      { id: `cc_${Q.id}_${i}`, name: cpk(names), keys: med ? [cpk(['bandage', 'painkiller', 'antibiotic', 'disinfect', 'sutures'])] : [], refill: 4 });
  }
}

/* ---------- hidden rooms: a shelf that slides, or a boarded doorway ---------- */
function secretDoor(Q, id, lx, lz, y, how) {
  const seg = cwall(Q, lx, lz - .64, lx, lz + .64, y, y + 2.35), g = new THREE.Group(), K = hkit();
  if (how === 'shelf') {
    K.box('board', .42, 2.2, .06, 0, 1.1, -.62, 0, 0, 0, 0x5a4a38, 1); K.box('board', .42, 2.2, .06, 0, 1.1, .62, 0, 0, 0, 0x5a4a38, 1); K.box('board', .04, 2.2, 1.3, .2, 1.1, 0, 0, 0, 0, 0x4a3a2a, 1);
    for (let i = 0; i < 5; i++) { K.box('board', .4, .04, 1.24, 0, .1 + i * .5, 0, 0, 0, 0, 0x6a5a48, 1); for (let j = 0; j < 7; j++) if (cp(.75)) K.box('plain', .26, cr(.24, .36), cr(.05, .1), -.02, .28 + i * .5, -.5 + j * .16, 0, 0, cr(-.1, .1), cpk([0x6a2a22, 0x2a4a5a, 0x4a5a2a, 0x7a6a4a, 0x3a3a3a]), 1); }
  } else for (let i = 0; i < 4; i++) K.box('board', .06, .18, 1.5, 0, .5 + i * .5, 0, cr(-.15, .15), 0, 0, tint(cpk(WOODC)), 1);
  K.build(g, true, true);
  const off = how === 'shelf' ? -.32 : -.12, [x, z] = Q.W(lx + off, lz); g.position.set(x, y, z); g.rotation.y = Q.yaw; Q.gi.add(g);
  const D = CDOORS[id] = { seg, g, open: false, how, x, z, dx: Q.s, dz: Q.c, k: 0, y };
  cit(Q, lx - 1.1, lz, y, () => D.open ? null : how === 'shelf' ? 'A cold draught behind this shelf · push it aside' : toolOK('crowbar') ? 'A boarded-up doorway · pry the boards off' : 'A boarded-up doorway · a crowbar would shift these',
    () => { if (how !== 'shelf' && !toolOK('crowbar')) { sfx('no'); toast('Nailed fast — you need a crowbar', 2.2); return; } startChan({ l: how === 'shelf' ? 'Shoving the shelf' : 'Prying the boards', t: 1.6, fn: () => openDoor(id) }); }, 1.9);
  cit(Q, lx + 1.1, lz, y, () => D.open ? null : 'Force the way out from this side', () => startChan({ l: 'Forcing it', t: 1.2, fn: () => openDoor(id) }), 1.9);
}
function openDoor(id, quiet) {
  const D = CDOORS[id]; if (!D || D.open) return; D.open = true; D.seg.on = false; cityF().open[id] = 1;
  if (D.how === 'shelf') CANIM.push(dt => { D.k = Math.min(1, D.k + dt * (quiet ? 99 : 1.4)); D.g.position.set(D.x + D.dx * 1.35 * D.k, D.y, D.z + D.dz * 1.35 * D.k); return D.k < 1; });
  else CANIM.push(dt => { D.k = Math.min(1, D.k + dt * (quiet ? 99 : 2)); D.g.rotation.z = -D.k * 1.4; D.g.position.y = D.y - D.k * .2; if (D.k >= 1) D.g.visible = false; return D.k < 1; });
  if (!quiet) { sfx('thud'); puff(D.x, D.y + 1.2, D.z, 0xb8a890, 8, 1.5, .1, .7); toast(D.how === 'shelf' ? 'The shelf grinds aside — there’s a room behind it' : 'The boards come away — a sealed room', 3); save(); }
}
function hiddenRoom(Q) {
  const H = Q.hidden; if (!H) return; const L = Q.L, [a, b] = L.cols[2], [c, d] = L.rows[1], y = L.Y(H.k), K = Q.KI;
  K.box('board', 2, .4, .9, b - 1.2, y + .2, c + .7, 0, 0, 0, 0x5a4a38, 1); K.box('cloth', 1.9, .12, .85, b - 1.2, y + .46, c + .7, 0, 0, 0, 0x6a5a4a, 1); cbox(Q, b - 1.2, c + .7, 1, .45, y, y + .5);
  bones(K, (a + b) / 2 + .4, y, d - .6, Math.PI, 1); bones(K, a + 1.3, y, (c + d) / 2, Math.PI / 2 + .4);
  K.box('board', 1.1, .75, .6, b - .9, y + .375, d - .5, 0, 0, 0, 0x6a5a48, 1); cbox(Q, b - .9, d - .5, .55, .3, y, y + .8);
  lorePt(Q, K, b - .9, d - .5, y + .76, H.lore, 'note');
  ccache(Q, a + 1, d - .6, y, 0, 'none', Q.style === 'police' ? 'mil' : 'op', { id: `cc_${Q.id}_hidden`, name: Q.style === 'police' ? 'The bricked-up armoury' : 'A hidden stash', big: 1, rolls: 2, refill: 6, keys: Q.style === 'police' ? ['ammo_556', 'ammo_9'] : [] });
  for (let i = 0; i < 6; i++) K.box('plain', cr(.2, .4), cr(.2, .4), cr(.2, .4), cr(a + .6, b - .6), y + .15, cr(c + .6, d - .6), 0, cr(0, 3), 0, cpk([0x6a5a3a, 0x5a6a4a, 0x8a7a5a]), 1);
}

/* ---------- weak floors: patched boards over a hole; linger and they go ---------- */
function weakFloors(Q) {
  for (const [i, W] of Q.weakAt.entries()) {
    const [a, b, c, d] = W.r, y = Q.L.Y(W.k), cx = (a + c) / 2, cz = (b + d) / 2, wd = c - a, dp = d - b, f = cfloor(Q, cx, cz, wd / 2, dp / 2, y);
    const g = new THREE.Group(), K = hkit();
    for (let j = 0; j < 7; j++) K.box('board', wd / 7 - .05, .06, dp + cr(-.2, .1), -wd / 2 + (j + .5) * wd / 7, -.03 - (j % 2) * .02, cr(-.05, .05), 0, cr(-.04, .04), cr(-.03, .03), tint(cpk(WOODC)), 1);
    for (const jz of [-dp / 3, dp / 3]) K.box('board', wd + .3, .12, .14, 0, -.14, jz, 0, 0, 0, 0x4a3a2a, 1);
    // the hole's ragged edge in the slab
    for (let j = 0; j < 8; j++) { const t = j / 8 * Math.PI * 2; K.box('conc', cr(.3, .7), .3, cr(.2, .4), Math.cos(t) * (wd / 2 + .1), -.15, Math.sin(t) * (dp / 2 + .1), 0, t, 0, 0x8a857c, 1); }
    K.build(g, true, true);
    const [x, z] = Q.W(cx, cz); g.position.set(x, y, z); g.rotation.y = Q.yaw; Q.gi.add(g);
    WEAK.push({ id: `${Q.id}_w${W.k}_${i}`, f, g, y, yb: Q.L.Y(W.k - 1), t: 0, gone: false });
  }
}
function collapse(W, quiet) {
  if (W.gone) return; W.gone = true; const i = FLOORS.indexOf(W.f); if (i >= 0) FLOORS.splice(i, 1); cityF().coll[W.id] = 1;
  if (quiet) { W.g.position.y = W.yb + .1; W.g.rotation.z = .25; return; }
  let vy = 0; CANIM.push(dt => { vy -= 22 * dt; W.g.position.y += vy * dt; W.g.rotation.z += dt * .8; if (W.g.position.y <= W.yb + .1) { W.g.position.y = W.yb + .1; puff(W.f.cx, W.yb + .4, W.f.cz, 0xb0a490, 14, 3, .14, .9); sfx('thud'); return false; } return true; });
  sfx('thud'); puff(W.f.cx, W.y, W.f.cz, 0xb8ab94, 18, 3, .12, .8); toast('The floor gives way!', 2.4);
  if (Math.hypot(P.x - W.f.cx, P.z - W.f.cz) < 3) { P.onGround = false; P.vy = Math.min(P.vy, -1); hurtPlayer(6, P.x + .01, P.z); }
  save();
}

/* ---------- basements, the Hollis shelter ---------- */
function cityGo(x, z, y, under, msg) {
  let el = $('cityFade');
  if (!el) { el = document.createElement('div'); el.id = 'cityFade'; Object.assign(el.style, { position: 'fixed', inset: '0', background: '#050505', opacity: '0', transition: 'opacity .22s', pointerEvents: 'none', zIndex: 40 }); document.body.appendChild(el); }
  el.style.opacity = '1'; sfx('step', 1.2);
  setTimeout(() => { P.x = x; P.z = z; P.y = y; P.eyeY = y; P.vx = P.vz = P.vy = 0; P.under = !!under; P.onGround = true; cityT = 0; if (msg) toast(msg, 2.4); setTimeout(() => { el.style.opacity = '0'; }, 120); }, 240);
}
const goQ = (Q, lx, lz, y, under, msg) => { const [x, z] = Q.W(lx, lz); cityGo(x, z, y, under, msg); };
function ladder(K, x, y0, y1, z, ry = 0) { const h = y1 - y0; for (const s of [-.22, .22]) K.box('metal', .05, h, .05, x + Math.cos(ry) * s, y0 + h / 2, z - Math.sin(ry) * s, 0, ry, 0, 0x5a5e60); for (let y = y0 + .3; y < y1; y += .32) K.box('metal', .46, .04, .04, x, y, z, 0, ry, 0, 0x6a6e70); }
function cityBasement(Q, root) {
  const L = Q.L, yb = Q.yb = Q.lo - 3.9, yc = yb + 3.1, g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: Q.x, z: Q.z, r: Math.hypot(L.hw, L.hd) });
  const K = hkit(); K.at(Q.base); const ix = L.ix1, iz = L.iz1;
  K.box('conc', ix * 2, .3, iz * 2, 0, yb - .15, 0, 0, 0, 0, 0x6a6660, 2); K.box('conc', ix * 2, .3, iz * 2, 0, yc + .15, 0, 0, 0, 0, 0x7a766e, 2);
  for (const [w, dd, x, z] of [[ix * 2 + .4, .3, 0, iz + .15], [ix * 2 + .4, .3, 0, -iz - .15], [.3, iz * 2, ix + .15, 0], [.3, iz * 2, -ix - .15, 0]]) K.box('block', w, yc - yb, dd, x, (yb + yc) / 2, z, 0, 0, 0, 0x8a867c, 1.6);
  cwall(Q, -ix, -iz, ix, -iz, yb - 1, yc); cwall(Q, ix, -iz, ix, iz, yb - 1, yc); cwall(Q, ix, iz, -ix, iz, yb - 1, yc); cwall(Q, -ix, iz, -ix, -iz, yb - 1, yc);
  cfloor(Q, 0, 0, ix, iz, yb, 0, UNDER);
  for (const px of [-ix / 2, ix / 2]) for (const pz of [-iz / 2, iz / 2]) { K.box('conc', .45, yc - yb, .45, px, (yb + yc) / 2, pz, 0, 0, 0, 0x7a766e, 1); cbox(Q, px, pz, .23, .23, yb, yc); }
  for (let i = 0; i < 3; i++) K.cyl('metal', .09, .09, ix * 2 - .4, 8, 0, yc - .25 - i * .22, -iz + .4 + i * .25, 0, 0, Math.PI / 2, 0x6a5040);   // pipes
  const lamp = (x, z) => { K.box('glow', .5, .05, .12, x, yc - .05, z, 0, 0, 0, 0x9a8a60); };
  lamp(-ix / 2, 0); lamp(ix / 2, 0);
  // the hatch: back-right room on the ground floor (open-plan shops: the back corner)
  const hx = (L.xs2 + L.ix1) / 2, hz = (L.rows[0][0] + L.zm) / 2;
  Q.KI.box('board', 1.1, .06, 1.1, hx, Q.y0 + .03, hz, 0, 0, 0, 0x5a4a38, 1); Q.KI.box('metal', .3, .04, .05, hx, Q.y0 + .07, hz + .4, 0, 0, 0, 0x8a8e90);
  ladder(K, hx, yb, yc + .3, hz - .45);
  cit(Q, hx, hz, Q.y0, () => 'Lift the hatch · climb down to the basement', () => goQ(Q, hx, hz + .6, yb, true, Q.cellar === 'morgue' ? 'The morgue' : 'The basement'), 1.6);
  cit(Q, hx, hz, yb, () => 'Climb the ladder up', () => goQ(Q, hx, hz + 1, Q.y0, false), 1.6, 2.4);
  // what's down here
  const shelf = (x, z, ry) => { for (let i = 0; i < 4; i++) K.box('metal', 2, .05, .5, x, yb + .2 + i * .55, z, 0, ry, 0, 0x5a5e60); for (const s of [-.95, .95]) K.box('metal', .05, 2, .5, x + Math.cos(ry) * s, yb + 1, z - Math.sin(ry) * s, 0, ry, 0, 0x4a4e50);
    for (let i = 0; i < 6; i++) K.box('plain', cr(.25, .45), cr(.2, .35), .35, x + Math.cos(ry) * cr(-.8, .8), yb + .4 + Math.floor(cr(0, 4)) * .55, z, 0, ry, 0, cpk([0x7a6a4a, 0x5a6a5a, 0x8a5a3a]), 1); };
  if (Q.cellar === 'morgue') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { K.box('metal', .9, .7, .1, -ix + 1 + i * 1, yb + .5 + j * .75, -iz + .2, 0, 0, 0, 0x9a9e9e); K.box('metal', .3, .05, .05, -ix + 1 + i * 1, yb + .7 + j * .75, -iz + .27, 0, 0, 0, 0x5a5e60); }
    for (const x of [-2, 1.5]) { K.box('metal', .8, .1, 2, x, yb + .85, 1, 0, 0, 0, 0xa8acac); for (const s of [-.35, .35]) K.cyl('metal', .02, .02, .8, 5, x + s, yb + .4, 1, 0, 0, 0, 0x6a6e70); cbox(Q, x, 1, .4, 1, yb, yb + .9); }
    bones(K, -2, yb + .9, 1.6, 0); bones(K, ix - 1.2, yb, -1, -Math.PI / 2, 1);
    K.box('board', 1.4, .76, .7, ix - 1.4, yb + .38, iz - .6, 0, 0, 0, 0x6a6e70, 1); cbox(Q, ix - 1.4, iz - .6, .7, .35, yb, yb + .8);
    const it = lorePt(Q, K, ix - 1.4, iz - .6, yb + .76, 'mercy_morgue', 'rec'); it.dy = 1.6;
    ccache(Q, -ix + 1.4, iz - .6, yb, 0, 'pry', 'ruin', { id: 'cc_mercy_morgue', name: 'The morgue’s drug safe', big: 1, rolls: 1, refill: 5, keys: ['medkit', 'antibiotic', 'surgical_kit'] });
  } else {
    shelf(-ix + 1.2, 0, Math.PI / 2); shelf(ix - 3, -iz + .5, 0);
    K.cyl('metal', .6, .6, 1.8, 12, ix - 1.2, yb + .9, iz - 1.2, 0, 0, 0, 0x7a5a40); cbox(Q, ix - 1.2, iz - 1.2, .6, .6, yb, yb + 1.8);   // boiler
    ccache(Q, -ix + 1.4, iz - .7, yb, 0, Q.cellar === 'hollis' ? 'none' : 'pry', 'city', { id: `cc_${Q.id}_cellar`, name: Q.cellar === 'hollis' ? 'Hollis’s back stock' : 'A padlocked cellar locker', rolls: 1, refill: 4, keys: Q.cellar === 'hollis' ? ['nails', 'screws', 'rope'] : [] });
  }
  if (Q.cellar === 'hollis') hollisShelter(Q, root, K, yb);
  K.build(g, true, true);
}
function hollisShelter(Q, root, KB, yb) {
  // under a crate in the corner of Hollis's basement, a hatch; below, a pre-war shelter behind a keypad blast door
  const L = Q.L, ys = Q.ys = yb - 6.2, yc = ys + 3, g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: Q.x, z: Q.z, r: 12 });
  const K = hkit(); K.at(Q.base); const hx = -L.ix1 + 1.4, hz = -L.iz1 + 1.4;
  const crate = new THREE.Group(), KC = hkit(); KC.box('board', 1.2, .8, 1.2, 0, .4, 0, 0, 0, 0, 0x6a5a40, 1); KC.box('board', 1.25, .06, 1.25, 0, .82, 0, 0, 0, 0, 0x5a4a32, 1); KC.build(crate, true, true);
  const [cx, cz] = Q.W(hx, hz); crate.position.set(cx, yb, cz); crate.rotation.y = Q.yaw; Q.gi.add(crate);
  KB.box('metal', 1, .05, 1, hx, yb + .02, hz, 0, 0, 0, 0x4a4e50); KB.box('metal', .6, .04, .06, hx, yb + .06, hz, 0, 0, 0, 0x8a8e90);
  const crateSeg = cbox(Q, hx, hz, .6, .6, yb, yb + .85);
  HOLLIS_HATCH = { crate, seg: crateSeg, cx, cz, yb };
  cit(Q, hx + 1.1, hz + 1.1, yb, () => cityF().open.hollis_hatch ? null : 'This crate doesn’t sit right · shift it', () => startChan({ l: 'Shifting the crate', t: 1.4, fn: () => revealHatch() }), 1.9);
  cit(Q, hx, hz, yb, () => cityF().open.hollis_hatch ? 'A hatch in the floor · climb down' : null, () => goQ(Q, -5.5 + 1.6, 0, ys, true, 'Shelter 12'), 1.6);
  // the shelter: a vestibule (ladder, keypad), the blast door, the room
  const sx0 = -5.5, sx1 = 5.5, sz0 = -3.8, sz1 = 3.8, dX = -2.2;
  K.box('conc', sx1 - sx0 + .6, .3, sz1 - sz0 + .6, (sx0 + sx1) / 2, ys - .15, 0, 0, 0, 0, 0x6a6a64, 2); K.box('conc', sx1 - sx0 + .6, .3, sz1 - sz0 + .6, (sx0 + sx1) / 2, yc + .15, 0, 0, 0, 0, 0x6a6a64, 2);
  for (const [w, dd, x, z] of [[sx1 - sx0 + .6, .3, 0, sz1 + .15], [sx1 - sx0 + .6, .3, 0, sz0 - .15], [.3, sz1 - sz0, sx1 + .15, 0], [.3, sz1 - sz0, sx0 - .15, 0]]) K.box('conc', w, yc - ys, dd, x, (ys + yc) / 2, z, 0, 0, 0, 0x8a8a80, 1.6);
  cwall(Q, sx0, sz0, sx1, sz0, ys - 1, yc); cwall(Q, sx1, sz0, sx1, sz1, ys - 1, yc); cwall(Q, sx1, sz1, sx0, sz1, ys - 1, yc); cwall(Q, sx0, sz1, sx0, sz0, ys - 1, yc);
  cfloor(Q, 0, 0, sx1, sz1, ys, 0, UNDER);
  // the bulkhead the door sits in
  K.box('metal', .4, yc - ys, sz1 - sz0 - 2.4, dX, (ys + yc) / 2, -(sz1 - sz0) / 4 - .6, 0, 0, 0, 0x5a5e5a); K.box('metal', .4, yc - ys, sz1 - sz0 - 2.4, dX, (ys + yc) / 2, (sz1 - sz0) / 4 + .6, 0, 0, 0, 0x5a5e5a);
  cwall(Q, dX, sz0, dX, -1.2, ys, yc); cwall(Q, dX, 1.2, dX, sz1, ys, yc);
  const door = new THREE.Group(), KD = hkit(); KD.box('metal', .3, 2.6, 2.4, 0, 1.3, 0, 0, 0, 0, 0x6a7068); KD.cyl('metal', .4, .4, .1, 16, -.2, 1.3, 0, 0, 0, Math.PI / 2, 0x8a8e88); KD.build(door, true, true);
  const [dx, dz] = Q.W(dX, 0); door.position.set(dx, ys, dz); door.rotation.y = Q.yaw; g.add(door);
  const seg = cwall(Q, dX, -1.2, dX, 1.2, ys, yc), D = CDOORS.hollis_door = { seg, g: door, open: false, how: 'blast', x: dx, z: dz, dx: Q.s, dz: Q.c, k: 0, y: ys };
  K.box('metal', .06, .3, .22, dX - .25, ys + 1.4, -1.6, 0, 0, 0, 0x2a2c2e); K.box('glow', .02, .08, .16, dX - .29, ys + 1.48, -1.6, 0, 0, 0, 0x40d070);
  cit(Q, dX - .9, -1.4, ys, () => D.open ? null : cityF().lore.mercy_code ? 'Keypad · key in 4 · 1 · 7 · 7' : 'A keypad · four digits. Somebody must have written them down', () => {
    if (!cityF().lore.mercy_code) { sfx('no'); toast('The keypad wants four digits', 2); return; }
    sfx('radio'); cityF().open.hollis_door = 1; D.open = true; seg.on = false; toast('The bolts draw back. The door swings in.', 3); save();
    CANIM.push(dt => { D.k = Math.min(1, D.k + dt * .7); door.position.set(dx + D.dx * 2.4 * D.k, ys, dz + D.dz * 2.4 * D.k); return D.k < 1; }); }, 1.8);
  ladder(K, sx0 + .8, ys, yc + .4, 0, Math.PI / 2);
  cit(Q, sx0 + 1.2, 0, ys, () => 'Climb the ladder up', () => goQ(Q, hx + 1, hz, yb, true), 1.6);
  // the room
  for (let i = 0; i < 3; i++) { K.box('metal', 2, .06, .9, 3.8, ys + .5 + i * 1, sz0 + .5, 0, 0, 0, 0x5a5e5a); K.box('cloth', 1.9, .12, .8, 3.8, ys + .59 + i * 1, sz0 + .5, 0, 0, 0, 0x5a6a4a, 1); }
  cbox(Q, 3.8, sz0 + .5, 1, .45, ys, yc);
  for (let i = 0; i < 4; i++) K.box('metal', 2.4, .05, .5, 0, ys + .3 + i * .6, sz1 - .3, 0, 0, 0, 0x6a6e70);
  for (let i = 0; i < 14; i++) K.box('plain', cr(.2, .35), cr(.15, .3), .3, cr(-1.1, 1.1), ys + .45 + Math.floor(cr(0, 4)) * .6, sz1 - .3, 0, 0, 0, cpk([0x5a6a4a, 0x8a7a4a, 0x7a3a2a, 0xa8a8a0]), 1);
  K.box('glow', .5, .05, .14, 0, yc - .05, 0, 0, 0, 0, 0xc8b890); K.box('glow', .5, .05, .14, 3.5, yc - .05, 0, 0, 0, 0, 0xc8b890);
  lorePt(Q, K, 1.2, sz0 + .5, ys, 'bunker_terminal', 'term', 0);
  ccache(Q, 4, sz1 - .7, ys, 0, 'none', 'op', { id: 'cc_hollis_shelter', name: 'Shelter 12 stores', big: 1, rolls: 2, refill: 7, keys: ['canned', 'purify_tab', 'medkit'] });
  ccache(Q, -.8, -1.6 - .6, ys, 0, 'none', 'mil', { id: 'cc_hollis_gunsafe', name: 'Shelter gun safe', rolls: 1, refill: 7 });
  K.build(g, true, true);
}
function revealHatch(quiet) {
  const H = HOLLIS_HATCH; if (!H) return; cityF().open.hollis_hatch = 1; for (const s of H.seg) s.on = false;
  H.crate.position.x += 1.3; H.crate.rotation.y += .4; if (!quiet) { sfx('thud'); toast('There’s a hatch under it', 2.4); save(); }
}

/* ---------- rooftops and fire escapes ---------- */
function fireEscape(Q) {
  const L = Q.L, K = Q.KE, x = L.hw, lz = L.iz1 - 3;
  for (let k = 1; k <= Q.n; k++) { const y = k === Q.n ? Q.top : L.Y(k) - .05;
    K.box('metal', 1.4, .06, 3.2, x + .75, y, lz, 0, 0, 0, 0x3a3c3e); K.box('metal', .04, .9, 3.2, x + 1.45, y + .45, lz, 0, 0, 0, 0x3a3c3e);
    if (k < Q.n) K.box('metal', .6, .06, Math.hypot(CFH, 3), x + .75, y + CFH / 2, lz, Math.atan2(CFH, 3) * (k % 2 ? 1 : -1), 0, 0, 0x2e3032); }
  const yg = heightAt(...Q.W(x + 1.6, lz)); ladder(K, x + 1.2, yg, L.Y(1), lz + 1.4, Math.PI / 2);
  cit(Q, x + 1.6, lz + 1.4, yg, () => 'Climb the fire escape to the roof', () => goQ(Q, x - 1.6, lz, Q.top, false, 'The roof'), 2, 2.6);
  cit(Q, x - 1.2, lz, Q.top, () => 'Climb down the fire escape', () => goQ(Q, x + 2.4, lz + 1.4, yg, false), 2, 2.2);
}
function cityRoof(Q) {
  const L = Q.L, K = Q.KE, y = Q.top, kind = Q.roof, rx = L.ix1 - 2.4, rz = L.iz1 - 2.4;
  const sol = (mat, w, h, d, x, z, col) => { K.box(mat, w, h, d, x, y + h / 2, z, 0, 0, 0, col, 1); cbox(Q, x, z, w / 2, d / 2, y, y + h); };
  // the water tank on its legs, and the boxes every roof has
  const tx = L.xs2 + 1.6, tz = (L.zm + L.iz1) / 2;
  if (kind !== 'helipad') { for (const [a, b] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) K.box('metal', .12, 1.6, .12, tx + a, y + .8, tz + b, 0, 0, 0, 0x4a3a30); K.cyl('metal', 1.3, 1.3, 2.4, 14, tx, y + 2.8, tz, 0, 0, 0, 0x7a5a42); K.cyl('metal', 1.4, .1, .6, 14, tx, y + 4.3, tz, 0, 0, 0, 0x5a4a3a); cbox(Q, tx, tz, .9, .9, y, y + 4); }
  for (let i = 0; i < 2; i++) sol('metal', 1.2, .9, .9, L.ix0 + 2 + i * 2, L.iz1 - 1.2, 0x8a8e8a);
  K.cyl('metal', .05, .05, 5, 5, L.ix0 + 1, y + 2.5, L.iz1 - .8, 0, 0, 0, 0x5a5a5a);
  if (kind === 'garden') {
    for (let i = 0; i < 4; i++) { const x = L.ix0 + 3 + i * 2.2, z = (L.zb1 + L.zm) / 2 + 1; sol('board', 1.8, .5, 1, x, z, tint(cpk(WOODC)));
      for (let j = 0; j < 5; j++) K.geo('plain', new THREE.DodecahedronGeometry(cr(.18, .3), 0), htm(x + cr(-.7, .7), y + .62, z + cr(-.35, .35)), cpk([0x4a6a2a, 0x5a7a32, 0x3a5a24]));
      for (let j = 0; j < 3; j++) K.cyl('board', .02, .02, 1.6, 4, x - .6 + j * .6, y + 1.3, z, cr(-.1, .1), 0, cr(-.1, .1), 0x8a7a5a); }
    for (const [x, z] of [[rx, L.zm], [rx - 1.4, L.zm]]) { K.cyl('plain', .4, .38, 1, 12, x, y + .5, z, 0, 0, 0, 0x3a5a7a); cbox(Q, x, z, .4, .4, y, y + 1); }
    K.box('cloth', 3, .04, 2, (L.xs1 + L.xs2) / 2, y + 1.8, rz - .5, .25, 0, 0, 0x6a7a5a, 1); for (const s of [-1.4, 1.4]) K.cyl('board', .04, .04, 1.9, 5, (L.xs1 + L.xs2) / 2 + s, y + .95, rz - 1.3, 0, 0, 0, 0x6a5a48);
    K.box('cloth', 1.9, .1, .8, (L.xs1 + L.xs2) / 2, y + .05, rz - .3, 0, .1, 0, 0x5a4a6a, 1);
    for (let i = 0; i < 6; i++) K.box('cloth', .5, .7, .02, L.ix0 + 2 + i * .7, y + 1.7, L.iz1 - 2.6, 0, 0, cr(-.1, .1), cpk(CLOTHC), 1);
    K.box('metal', .3, .3, .3, (L.xs1 + L.xs2) / 2 + 1.6, y + .15, rz - .2, 0, 0, 0, 0x2a2a2a);
    K.box('board', .9, .6, .6, rx, y + .3, rz, 0, 0, 0, 0x6a5a48, 1); cbox(Q, rx, rz, .45, .3, y, y + .6); lorePt(Q, K, rx, rz, y + .61, 'roof_garden', 'note');
    ccache(Q, rx - 2, rz + .8, y, 0, 'none', 'wild', { id: `cc_${Q.id}_garden`, name: 'The gardener’s chest', rolls: 1, refill: 3, keys: ['seed_bean', 'seed_squash', 'water_boiled'] });
    CZONES.push({ kind: 'quiet', id: Q.id + '_garden', name: 'The rooftop garden', x: Q.x, z: Q.z, r: Math.hypot(L.hw, L.hd), y0: y - .5, y1: y + 6 });
  } else if (kind === 'nest') {
    const nx = L.ix1 - 2.4, nz = 0;
    for (let i = 0; i < 9; i++) { const t = -1.4 + i * .35; K.box('cloth', .9, .35, .5, nx + Math.cos(t) * 1.8, y + .18 + (i % 2) * .35, nz + Math.sin(t) * 1.8, 0, -t, 0, 0x8a7e5a, 1); K.box('cloth', .9, .35, .5, nx + Math.cos(t) * 1.8, y + .53, nz + Math.sin(t) * 1.8, 0, -t + .2, 0, 0x7e7250, 1); }
    K.box('cloth', 3.4, .04, 3, nx, y + 2.2, nz, 0, 0, .1, 0x5a5a3a, 1); for (const [a, b] of [[-1.5, -1.3], [-1.5, 1.3]]) K.cyl('metal', .04, .04, 2.2, 5, nx + a, y + 1.1, nz + b, 0, 0, 0, 0x3a3a3a);
    for (let i = 0; i < 20; i++) K.cyl('shiny', .012, .012, .05, 5, nx + cr(-1.2, 1.2), y + .01, nz + cr(-1.2, 1.2), Math.PI / 2, cr(0, 3), 0, 0xc8a050);
    bones(K, nx - .8, y, nz + .6, Math.PI / 2, 1);
    ccache(Q, nx - .3, nz - .6, y, 0, 'none', 'mil', { id: `cc_${Q.id}_nest`, name: 'A sniper’s nest', big: 1, rolls: 2, refill: 4, keys: ['ammo_762'] });
  } else if (kind === 'helipad') {
    const px = (L.xs1 + L.xs2) / 2 + 1, pz = (L.zm + L.iz1) / 2 - .5;
    K.cyl('plain', 4, 4, .04, 32, px, y + .02, pz, 0, 0, 0, 0x5a5e5a); K.box('plain', .5, .03, 3, px - 1, y + .045, pz, 0, 0, 0, 0xe8e4d8); K.box('plain', .5, .03, 3, px + 1, y + .045, pz, 0, 0, 0, 0xe8e4d8); K.box('plain', 1.5, .03, .5, px, y + .045, pz, 0, 0, 0, 0xe8e4d8);
    // a medevac drone that didn't make it
    K.box('metal', 2.4, .6, 1, px + 1.4, y + .3, pz - 1.6, .1, .5, .2, 0xd8d8d0); K.box('metal', 3.2, .05, .2, px + 1.2, y + .7, pz - 1.4, .1, .9, .3, 0x3a3a3a); K.box('plain', .5, .5, .05, px + 1.6, y + .35, pz - 1.05, .1, .5, .2, 0xc83a2a);
    cbox(Q, px + 1.4, pz - 1.6, 1.3, .7, y, y + .9);
    ccache(Q, px - 2.2, pz + 2.2, y, 0, 'pry', 'arc', { id: 'cc_mercy_drone', name: 'The medevac drone’s cargo', rolls: 2, refill: 5, keys: ['medkit', 'iv'] });
  } else if (kind === 'camp') {
    K.box('cloth', 2.2, 1.3, 2, L.ix0 + 3, y + .65, L.iz1 - 2.2, 0, .3, 0, 0x6a6a4a, 1); cbox(Q, L.ix0 + 3, L.iz1 - 2.2, 1.1, 1, y, y + 1.3);
    for (let i = 0; i < 8; i++) K.box('rock', .25, .18, .25, L.ix0 + 6 + Math.cos(i * .8) * .55, y + .09, L.iz1 - 2.4 + Math.sin(i * .8) * .55, 0, i, 0, 0x6a6660);
    K.box('plain', .8, .06, .8, L.ix0 + 6, y + .03, L.iz1 - 2.4, 0, 0, 0, 0x1a1a1a);
    bones(K, L.ix0 + 4.6, y, L.iz1 - 3.8, .7);
    K.box('conc', .4, .2, .2, tx + 1.4, y + .1, tz + 1.4, 0, .4, 0, 0x9a5a3a); lorePt(Q, K, tx + 1.4, tz + 1.8, y, 'roof_camp', 'note');
    ccache(Q, tx, tz, y, 0, 'none', 'city', { id: `cc_${Q.id}_tank`, name: 'A cache under the water tank', rolls: 2, refill: 5, keys: ['ammo_9', 'bandage'] });
  }
}

/* ---------- the special places ---------- */
function colFree(x, z, r) { for (let i = Math.floor((x - 6) / CELL); i <= Math.floor((x + 6) / CELL); i++) for (let j = Math.floor((z - 6) / CELL); j <= Math.floor((z + 6) / CELL); j++) for (const c of grid.get(gkey(i, j)) || []) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; return true; }
function glowMesh(parent, boxes, mat) {
  if (!boxes.length) return null;
  const g = mergeGeometries(boxes.map(([w, h, d, x, y, z, ry = 0]) => { const b = new THREE.BoxGeometry(w, h, d); b.applyMatrix4(htm(x, y, z, 0, ry, 0)); return b; }));
  const m = new THREE.Mesh(g, mat); m.userData.dyn = 1; parent.add(m); return m;
}
// Kessler St.: the kiosk, the platform, and Line 2 east under the city, coming up inside the Foundry's wall
function buildMetro(Q, root) {
  Q.noStair = 1; Q.open0 = 1; cityBuild(Q, root);
  const L = Q.L, KI = Q.KI, y0 = Q.y0;
  for (let i = 0; i < 4; i++) { const x = -3 + i * 2; KI.box('metal', .12, 1, .9, x, y0 + .5, 0, 0, 0, 0, 0x8a8e90); KI.box('metal', .8, .04, .04, x + .5, y0 + .9, 0, 0, 0, 0, 0xa8aca8); }
  KI.box('board', 2.6, 1.1, 1.6, L.ix1 - 1.6, y0 + .55, L.iz1 - 1.2, 0, 0, 0, 0x5a4a3a, 1); KI.box('glass', 2.6, 1.2, .05, L.ix1 - 1.6, y0 + 1.7, L.iz1 - 2, 0, 0, 0); cbox(Q, L.ix1 - 1.6, L.iz1 - 1.2, 1.3, .8, y0, y0 + 1.1);
  for (let i = 0; i < 6; i++) KI.poster(Math.floor(cr(0, 8)), .9, 1.3, L.ix0 + 1.5 + i * 2.1, y0 + 1.7, L.iz0 + .02, 0);
  const it = lorePt(Q, KI, L.ix0 + 1.6, L.iz1 - .6, y0, 'kessler_poster', 'none'); KI.box('paper', 1.2, 1.6, .02, L.ix0 + 1.6, y0 + 1.6, L.iz1 - .05, 0, Math.PI, 0, 0xffffff);
  // the stair door at the back
  KI.box('metal', 2.2, 2.6, .1, 3.5, y0 + 1.3, L.iz0 + .05, 0, 0, 0, 0x3a3e40); KI.box('plain', 1.9, 2.4, .02, 3.5, y0 + 1.2, L.iz0 + .12, 0, 0, 0, 0x0a0a0a);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), hSignMat('LINE 2 ↓', 'stencil')); { const [x, z] = Q.W(3.5, L.iz0 + .16); sg.position.set(x, y0 + 2.95, z); sg.rotation.y = Q.yaw; Q.gi.add(sg); }
  dressRooms(Q); cityFinish(Q);
  // ----- the line (world-aligned) -----
  const F = FOUNDRY, TS = { x: 0, z: 0, yaw: 0 }; siteFrame(TS);
  const zT = Q.z, sx0 = Q.x - 12, sx1 = Q.x + 28, tz0 = zT - 1.2, tz1 = zT + 4.4, tc = zT + 1.6;
  let xE = null; for (let x = F.x - 58; x <= F.x - 22; x += 2) { if (Math.hypot(x - F.x, tc - F.z) > F.R - 8) continue; if (colFree(x, tc, 2.8)) { xE = x; break; } }
  if (xE == null) xE = F.x - 40;
  let mh = 1e9; for (let x = sx0 - 4; x <= xE + 8; x += 4) for (const dz of [-9, 0, 7]) mh = Math.min(mh, heightAt(x, zT + dz));
  const yT = mh - 7.6, yP = yT + 1, hS = yT + 5.2, hT = yT + 4.4, xEnd = xE + 3;
  const g = TS.g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: (sx0 + xEnd) / 2, z: zT, r: (xEnd - sx0) / 2 + 12 });
  const K = hkit(), tile = 0xd8d0b8, dirt = 0x6a6258;
  // floors, ceiling, walls
  K.box('conc', sx1 - sx0, 1.3, tz0 - (zT - 7), (sx0 + sx1) / 2, yP - .65, (zT - 7 + tz0) / 2, 0, 0, 0, 0x8a8478, 2);
  K.box('conc', xEnd - sx0, .3, tz1 - tz0, (sx0 + xEnd) / 2, yT - .15, (tz0 + tz1) / 2, 0, 0, 0, 0x5a554e, 2);
  K.box('conc', sx1 - sx0, .4, tz1 - (zT - 7), (sx0 + sx1) / 2, hS + .2, (zT - 7 + tz1) / 2, 0, 0, 0, 0x8a867e, 3);
  K.box('conc', xEnd - sx1, .4, tz1 - tz0, (sx1 + xEnd) / 2, hT + .2, (tz0 + tz1) / 2, 0, 0, 0, 0x6a665e, 3);
  K.box('conc', sx1 - sx0, hS - yP, .3, (sx0 + sx1) / 2, (yP + hS) / 2, zT - 7.15, 0, 0, 0, tile, 1.2);
  K.box('conc', .3, hS - yT, tz1 - (zT - 7), sx0 - .15, (yT + hS) / 2, (zT - 7 + tz1) / 2, 0, 0, 0, tile, 1.2);
  K.box('block', xEnd - sx0, hS - yT, .3, (sx0 + xEnd) / 2, (yT + hS) / 2, tz1 + .15, 0, 0, 0, dirt, 1.6);
  K.box('block', xEnd - sx1, hT - yT, .3, (sx1 + xEnd) / 2, (yT + hT) / 2, tz0 - .15, 0, 0, 0, dirt, 1.6);
  K.box('conc', .3, hS - yP, tz0 - (zT - 7), sx1 + .15, (yP + hS) / 2, (zT - 7 + tz0) / 2, 0, 0, 0, tile, 1.2);
  K.box('conc', .3, hS - hT, tz1 - tz0, sx1 + .15, (hT + hS) / 2, (tz0 + tz1) / 2, 0, 0, 0, tile, 1.2);
  K.box('block', .3, hT - yT, tz1 - tz0, xEnd + .15, (yT + hT) / 2, (tz0 + tz1) / 2, 0, 0, 0, dirt, 1.6);
  K.box('plain', sx1 - sx0, .02, .3, (sx0 + sx1) / 2, yP + .01, tz0 - .2, 0, 0, 0, 0xc8a830);   // the yellow line
  cfloor(TS, (sx0 + sx1) / 2, (zT - 7 + tz0) / 2, (sx1 - sx0) / 2, (tz0 - (zT - 7)) / 2, yP, 0, UNDER);
  cfloor(TS, (sx0 + xEnd) / 2, (tz0 + tz1) / 2, (xEnd - sx0) / 2, (tz1 - tz0) / 2, yT, 0, UNDER);
  cwall(TS, sx0, zT - 7, sx1, zT - 7, yT - 1, hS); cwall(TS, sx0, zT - 7, sx0, tz1, yT - 1, hS); cwall(TS, sx0, tz1, xEnd, tz1, yT - 1, hS);
  cwall(TS, sx1, tz0, xEnd, tz0, yT - 1, hT); cwall(TS, sx1, zT - 7, sx1, tz0, yT - 1, hS); cwall(TS, xEnd, tz0, xEnd, tz1, yT - 1, hT);
  // rails and sleepers, ribs, cables
  for (const s of [-.72, .72]) K.box('metal', xEnd - sx0, .14, .08, (sx0 + xEnd) / 2, yT + .1, tc + s, 0, 0, 0, 0x6a5a4a);
  for (let x = sx0 + .5; x < xEnd; x += .9) K.box('board', .25, .1, 2.2, x, yT + .03, tc, 0, cr(-.05, .05), 0, 0x3a3228, 1);
  for (let x = sx1 + 4; x < xEnd; x += 5) { K.box('conc', .4, .3, tz1 - tz0, x, hT - .15, (tz0 + tz1) / 2, 0, 0, 0, 0x5a564e, 2); K.box('conc', .4, hT - yT, .2, x, (yT + hT) / 2, tz0 + .1, 0, 0, 0, 0x5a564e, 2); K.box('conc', .4, hT - yT, .2, x, (yT + hT) / 2, tz1 - .1, 0, 0, 0, 0x5a564e, 2); }
  for (let i = 0; i < 3; i++) K.cyl('metal', .03, .03, xEnd - sx1, 5, (sx1 + xEnd) / 2, yT + 3 - i * .14, tz1 - .25, 0, 0, Math.PI / 2, 0x1a1a1a);
  // station: columns, benches, posters, the sign
  for (let x = sx0 + 4; x < sx1 - 2; x += 7) { K.cyl('conc', .32, .32, hS - yP, 10, x, (yP + hS) / 2, tz0 - 1.2, 0, 0, 0, 0xc8c0a8); cbox(TS, x, tz0 - 1.2, .32, .32, yP, hS); }
  for (let x = sx0 + 7.5; x < sx1 - 4; x += 7) { K.box('board', 2, .1, .5, x, yP + .45, zT - 6.4, 0, 0, 0, 0x6a5038, 1); for (const s of [-.8, .8]) K.box('metal', .06, .45, .45, x + s, yP + .22, zT - 6.4, 0, 0, 0, 0x3a3a3a); }
  for (let i = 0; i < 8; i++) K.poster(Math.floor(cr(0, 8)), 1, 1.4, sx0 + 3 + i * 3.4, yP + 1.9, zT - 6.98, 0);
  for (const x of [sx0 + 12, sx0 + 26]) { const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), hSignMat('KESSLER ST', 'stencil')); sg2.position.set(x, yP + 3.4, zT - 6.98); g.add(sg2); }
  // a carriage that never left
  { const cx = sx0 + 8, cl = 13; K.box('metal', cl, 3, 2.8, cx, yT + 1.8, tc, 0, 0, .02, 0x5a6a62); K.box('metal', cl + .2, .25, 2.9, cx, yT + 3.35, tc, 0, 0, .02, 0x4a5650);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) K.box('glass', 1.6, .9, .03, cx - cl / 2 + 1.6 + i * 2.5, yT + 2.3, tc + s * 1.42); K.box('plain', 1.1, 2, .03, cx + 3, yT + 1.6, tc - 1.42, 0, 0, 0, 0x0a0a0a);
    cbox(TS, cx, tc, cl / 2, 1.45, yT, yT + 3.4); }
  // records: a skeleton on the platform, the bricked branch
  bones(K, sx1 - 9, yP, zT - 6.6, 0, 1); lorePt(TS, K, sx1 - 9, zT - 5.9, yP, 'tunnel_note', 'note');
  const TL = xEnd - sx1, bx = sx1 + TL * .22; K.box('block', 3.6, 3.6, .3, bx, yT + 1.8, tz1 - .05, 0, 0, 0, 0x8a4a3a, .8);
  for (let i = 0; i < 4; i++) K.box('plain', .04, 1.4, .02, bx - .3 + i * .18, yT + 1.6, tz1 - .22, 0, 0, .12, 0x1a1210);
  lorePt(TS, K, bx, tz1 - .9, yT, 'tunnel_claws', 'none');
  // power: the generator lights the line and lifts the gate
  const gx = sx1 - 4.5, gz = zT - 5.7;
  K.box('metal', 1.8, 1.2, 1, gx, yP + .6, gz, 0, 0, 0, 0x6a7a3a); K.cyl('metal', .12, .12, .2, 8, gx + .6, yP + 1.3, gz, 0, 0, 0, 0x3a3a3a); K.cyl('metal', .06, .06, 2.4, 6, gx - .9, yP + 2.4, gz, 0, 0, 0, 0x2a2a2a); cbox(TS, gx, gz, .9, .5, yP, yP + 1.2);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, toneMapped: false }), redMat = new THREE.MeshBasicMaterial({ color: 0x6a1408, toneMapped: false });
  const lamps = [], reds = [];
  for (let x = sx0 + 3; x < sx1; x += 6) lamps.push([1.4, .08, .2, x, hS - .06, zT - 3.5]);
  for (let x = sx1 + 3; x < xEnd; x += 8) lamps.push([.6, .12, .12, x, yT + 3.5, tz1 - .12]);
  for (let x = sx0 + 6; x < xEnd; x += 22) reds.push([.2, .2, .1, x, yT + 3.9, tz0 + .1]);
  glowMesh(g, lamps, lampMat); glowMesh(g, reds, redMat);
  const gate = new THREE.Group(), KG = hkit(); for (let i = 0; i < 12; i++) KG.cyl('metal', .04, .04, hT - yT, 5, 0, (hT - yT) / 2, -2.6 + i * .47, 0, 0, 0, 0x4a4e50); KG.box('metal', .1, .12, tz1 - tz0, 0, hT - yT - .4, 0, 0, 0, 0, 0x4a4e50); KG.box('metal', .1, .12, tz1 - tz0, 0, 1.2, 0, 0, 0, 0, 0x4a4e50); KG.build(gate, true, true);
  gate.position.set(sx1 + .8, yT, (tz0 + tz1) / 2); g.add(gate);
  const gseg = cwall(TS, sx1 + .8, tz0, sx1 + .8, tz1, yT - 1, hT);
  CITY_POWER = { on: false, lampMat, gate, gseg, yT, k: 0 };
  cit(TS, gx, gz + .9, yP, () => CITY_POWER.on ? 'The generator hums' : cnt('fuel') > 0 ? 'Fuel the generator (1 fuel) and pull the cord' : 'A generator · dry. It needs fuel', () => {
    if (CITY_POWER.on) return; if (cnt('fuel') <= 0) { sfx('no'); toast('Needs fuel', 2); return; }
    startChan({ l: 'Fuelling the generator', t: 2, fn: () => { take('fuel', 1); powerOn(); } }); }, 2, 2);
  cit(TS, sx1 - .8, tc, yT, () => CITY_POWER.on ? null : 'A barred gate across the line · no power to lift it', () => { sfx('no'); toast('There must be power on this platform somewhere', 2.4); }, 2.2, 2);
  // the leak, the collapse, a maintenance locker
  const lx = sx1 + TL * .45, leak = [];
  K.cyl('metal', .25, .25, 6, 10, lx, yT + 3.1, tz0 + .4, 0, 0, Math.PI / 2, 0x5a6a4a); K.box('metal', .6, .6, .6, lx + .4, yT + 3.1, tz0 + .4, .4, .4, 0, 0x4a5a3a);
  for (let i = 0; i < 4; i++) leak.push([cr(1, 2.4), .02, cr(1, 2), lx + cr(-3, 3), yT + .02, tc + cr(-1.5, 1.5), cr(0, 3)]);
  glowMesh(g, leak, new THREE.MeshBasicMaterial({ color: 0x5aff5a, toneMapped: false, transparent: true, opacity: .55 }));
  CZONES.push({ kind: 'rad', x: lx, z: tc, r: 12, k: .8, under: true });
  const rx = sx1 + TL * .7; for (let i = 0; i < 14; i++) K.geo('conc', new THREE.DodecahedronGeometry(cr(.5, 1.3), 0), htm(rx + cr(-3, 3), yT + cr(.3, 1.6), tz0 + cr(.4, 2.4), cr(0, 3), cr(0, 3), 0), 0x7a746a);
  K.box('conc', 5, .5, 3, rx, hT - .6, tz0 + 1.2, .3, .2, .15, 0x6a665e, 2); cbox(TS, rx, tz0 + 1.3, 3, 1.3, yT, hT);
  ccache(TS, xEnd - 7, tz1 - .6, yT, Math.PI, 'cutter', 'mil', { id: 'cc_line_locker', name: 'Line maintenance locker', rolls: 2, refill: 5, keys: ['fuel'] });
  // up into the Foundry
  ladder(K, xE, yT, hT + .3, tz1 - .4);
  K.box('glow', .3, .1, .3, xE, hT - .1, tz1 - .9, 0, 0, 0, 0xb8a878);
  const mg = new THREE.Group(); { const lid = mesh(new THREE.CylinderGeometry(.55, .55, .06, 18), S(0x4a4a46, { metalness: .7, roughness: .5 }), 0, .03, 0, mg); for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(.9, .065, .05), S(0x3a3a36, { metalness: .7 }), 0, .035, i * .16, mg); }
  mg.position.set(xE, heightAt(xE, tz1 - .4) + .01, tz1 - .4); root.add(mg);
  cit(TS, xE, tz1 - .4, yT, () => 'Climb the ladder · up through a manhole', () => cityGo(xE + 1.2, tz1 - .4, heightAt(xE + 1.2, tz1 - .4), false, 'The Foundry — inside Ironjaw’s wall'), 2, 2.4);
  cit(TS, xE, tz1 - .4, heightAt(xE, tz1 - .4), () => 'A manhole · lift it and climb down', () => cityGo(xE - 1.2, tc, yT, true, 'Line 2'), 1.8, 2.6);
  // the stairs up to the street (to the kiosk)
  K.box('metal', 2.2, 2.6, .1, sx0 + 4, yP + 1.3, zT - 6.95, 0, 0, 0, 0x3a3e40);
  cit(TS, sx0 + 4, zT - 6.1, yP, () => 'Take the stairs up to the street', () => goQ(Q, 3.5, L.iz0 + 1.4, y0, false, 'Kessler St.'), 2, 2);
  cit(Q, 3.5, L.iz0 + .8, y0, () => 'Take the stairs down to the platform', () => cityGo(sx0 + 4, zT - 5.4, yP, true), 2, 2);
  K.build(g, true, true);
  REGIONS.push({ id: 'kessler', name: 'THE KESSLER LINE', sub: 'Line 2, under the city · it runs east, toward the Foundry', area: (x, z) => !!P.under && x > sx0 - 2 && x < xEnd + 2 && Math.abs(z - zT) < 9 });
}
function powerOn(quiet) {
  const C = CITY_POWER; if (!C || C.on) return; C.on = true; cityF().power = 1; C.gseg.on = false; C.lampMat.color.setRGB(1.3, 1.12, .8);
  CANIM.push(dt => { C.k = Math.min(1, C.k + dt * (quiet ? 99 : .35)); C.gate.position.y = C.yT + C.k * 3.6; return C.k < 1; });
  if (!quiet) { sfx('radio'); toast('The lights stutter on down the line. The gate grinds up.', 3.4); save(); }
}
// Cinder No. 4: a cracked containment dome, a cooling-tower stub, a control building, green water. Hot.
function buildReactor(Q, root) {
  siteFrame(Q); const g = Q.g = new THREE.Group(); root.add(g); const K = hkit(); K.at(Q.base);
  const hy = (lx, lz) => heightAt(...Q.W(lx, lz));
  const dx = 7, dz = -7, dy = hy(dx, dz);
  const dome = new THREE.SphereGeometry(8, 28, 14, .6, Math.PI * 2 - .9, 0, Math.PI / 2); K.geo('conc', dome, htm(dx, dy - .3, dz), 0xa8a49a);
  K.cyl('conc', 8.2, 8.4, 2.2, 28, dx, dy + .8, dz, 0, 0, 0, 0x8a8680);
  for (let i = 0; i < 10; i++) K.geo('conc', new THREE.DodecahedronGeometry(cr(.6, 1.6), 0), htm(dx + cr(-3, 3), dy + cr(.2, 1.4), dz - 9 + cr(-2, 1), cr(0, 3), cr(0, 3), 0), 0x9a968c);
  { const [x, z] = Q.W(dx, dz); addCol(x, z, 8.3, 12); }
  const lathe = new THREE.LatheGeometry([...Array(12)].map((_, i) => new THREE.Vector2(5 - Math.sin(i / 11 * Math.PI) * 1.1 - i * .05, i * .9)), 24);
  const tx = -8, tz = -8; K.geo('conc', lathe, htm(tx, hy(tx, tz) - .2, tz), 0x9a968c); { const [x, z] = Q.W(tx, tz); addCol(x, z, 5, 10); }
  // the fence, a gap on the street side
  for (let i = 0; i < 62; i++) { const t = i / 62 * Math.PI * 2, lx = Math.cos(t) * 20.5, lz = Math.sin(t) * 20.5; if (Math.abs(angWrap(t - Math.PI / 2)) < .12) continue;
    const [x, z] = Q.W(lx, lz), f = mesh(lattice(2.1, 2.6, 0x8a8e90, 1), VCOL, x, heightAt(x, z), z, g); f.rotation.y = -t + Math.PI / 2 + Q.yaw; addCol(x, z, 1.05, 2.6); }
  for (const t of [Math.PI / 2 - .2, Math.PI / 2 + .2, 0, Math.PI]) { const [x, z] = Q.W(Math.cos(t) * 20.8, Math.sin(t) * 20.8), sg = new THREE.Mesh(new THREE.PlaneGeometry(2, .5), hSignMat('DANGER · RADIATION', 'stencil')); sg.position.set(x, heightAt(x, z) + 1.6, z); sg.rotation.y = -t + Math.PI / 2 + Q.yaw + Math.PI; g.add(sg); }
  // green water, barrels
  const pud = []; for (let i = 0; i < 9; i++) { const lx = dx + cr(-14, 6), lz = dz + cr(-2, 14), [x, z] = Q.W(lx, lz); pud.push([cr(1.2, 3.4), .02, cr(1, 2.6), x, heightAt(x, z) + .04, z, cr(0, 3)]); }
  glowMesh(g, pud, new THREE.MeshBasicMaterial({ color: 0x48e848, toneMapped: false, transparent: true, opacity: .5 }));
  for (let i = 0; i < 14; i++) { const lx = cr(-14, 14), lz = cr(-14, 14); if (Math.hypot(lx - dx, lz - dz) < 9.5 || Math.hypot(lx - tx, lz - tz) < 6 || (lx < 3 && lz > -.5)) continue; K.cyl('metal', .3, .3, .9, 10, lx, hy(lx, lz) + .45, lz, cp(.3) ? Math.PI / 2 : 0, 0, 0, cpk([0xb8a030, 0xa89028, 0x6a6a5a])); }
  K.build(g, true, false);
  // the control building, inside the fence
  const C = { kind: 'bld', id: 'reactor_ctl', name: 'CONTROL', w: 14, d: 10, n: 2, style: 'ctl', yaw: Q.yaw, weak: [1] };
  [C.x, C.z] = Q.W(-5, 6); cityBuild(C, root); dressRooms(C);
  { const L = C.L, y = L.Y(1), [a, b] = L.cols[2], [c, d] = L.rows[0]; lorePt(C, C.KI, (a + b) / 2, c + .6, y, 'reactor_log', 'term');
    ccache(C, (a + b) / 2, d - .7, y, 0, 'bypass', 'op', { id: 'cc_reactor_safe', name: 'The control-room safe', big: 1, rolls: 2, refill: 6, keys: ['shielding', 'power_cell'] }); }
  cityFinish(C);
  const K2 = hkit(); K2.at(Q.base); const bx = dx + 4, bz = dz + 9; bones(K2, bx, hy(bx, bz), bz, .4);
  lorePt(Q, K2, bx + .3, bz + .5, hy(bx, bz), 'reactor_badge', 'none'); K2.build(g, true, false);
  ccache(Q, dx + 7, dz + 6.5, hy(dx + 7, dz + 6.5), Math.PI, 'pry', 'arc', { id: 'cc_reactor_dome', name: 'Dome service locker', rolls: 2, refill: 5, keys: ['solar_cell'] });
  { const [x, z] = Q.W(dx, dz); CZONES.push({ kind: 'rad', x, z, r: 44, k: 1, under: false }); }
  REGIONS.push({ id: 'reactor', name: 'CINDER NO. 4', sub: 'The power plant · your teeth ache · a hazmat or Rust suit helps', x: Q.x, z: Q.z, r: 30, hostile: true });
}
// the Glasshouse: an old conservatory, overgrown, quiet. Nobody comes in here.
function buildGlass(Q, root) {
  siteFrame(Q); const g = Q.g = new THREE.Group(); root.add(g); const K = hkit(); K.at(Q.base);
  const hw = 13, hd = 8, hy = (lx, lz) => heightAt(...Q.W(lx, lz)), y = hy(0, 0);
  // brick base, iron posts, glass walls, a barrel roof of glass on iron ribs
  for (const [ax, a, b, at] of [['x', -hw, hw, hd], ['x', -hw, hw, -hd], ['z', -hd, hd, hw], ['z', -hd, hd, -hw]]) {
    const doorH = ax === 'z' ? [{ a: -1.3, b: 1.3, lo: y - 2, hi: y + 3.2 }] : [];
    const len = b - a;
    for (const [p, q] of doorH.length ? [[a, -1.3], [1.3, b]] : [[a, b]]) { const m = (p + q) / 2, l = q - p;
      if (ax === 'x') { K.box('block', l, 1.6, .4, m, y - .4, at, 0, 0, 0, 0x8a5a48, 1.2); K.box('glass', l, 3.4, .04, m, y + 2.1, at); } else { K.box('block', .4, 1.6, l, at, y - .4, m, 0, 0, 0, 0x8a5a48, 1.2); K.box('glass', .04, 3.4, l, at, y + 2.1, m); }
      const [x0, z0] = ax === 'x' ? Q.W(p, at) : Q.W(at, p), [x1, z1] = ax === 'x' ? Q.W(q, at) : Q.W(at, q); addColLine(x0, z0, x1, z1, .3); }
    for (let t = a; t <= b + .01; t += len / Math.round(len / 2.6)) { if (ax === 'x') K.box('metal', .12, 3.8, .12, t, y + 1.9, at, 0, 0, 0, 0x2e3a34); else K.box('metal', .12, 3.8, .12, at, y + 1.9, t, 0, 0, 0, 0x2e3a34); }
    if (doorH.length) { K.box('metal', .2, .3, 2.8, at, y + 3.3, 0, 0, 0, 0, 0x2e3a34); }
  }
  const roof = new THREE.CylinderGeometry(hd, hd, hw * 2, 24, 1, true, 0, Math.PI); roof.applyMatrix4(htm(0, 0, 0, 0, 0, Math.PI / 2)); roof.applyMatrix4(new THREE.Matrix4().makeScale(1, .55, 1));
  K.geo('glass', roof, htm(0, y + 3.8, 0));
  for (let x = -hw; x <= hw + .01; x += 2.6) K.geo('metal', new THREE.TorusGeometry(hd, .06, 4, 20, Math.PI).applyMatrix4(htm(0, 0, 0, 0, Math.PI / 2, 0)).applyMatrix4(new THREE.Matrix4().makeScale(1, .55, 1)), htm(x, y + 3.8, 0), 0x2e3a34);
  // inside: paths, beds, trees (one with lemons), a pond, benches, the gardener's table
  K.box('rock', hw * 2 - 1, .04, 1.6, 0, y + .02, 0, 0, 0, 0, 0x9a9080, 1.5);
  const tree = (x, z, s, lemons) => { K.cyl('board', .14 * s, .2 * s, 2.6 * s, 7, x, y + 1.3 * s, z, 0, 0, cr(-.08, .08), 0x5a4632);
    for (let i = 0; i < 5; i++) K.geo('plain', new THREE.IcosahedronGeometry(cr(.9, 1.4) * s, 0), htm(x + cr(-.8, .8) * s, y + (2.6 + cr(0, 1.2)) * s, z + cr(-.8, .8) * s), cpk([0x3a5a2a, 0x4a6a30, 0x2e4a22]));
    if (lemons) for (let i = 0; i < 14; i++) K.geo('plain', new THREE.SphereGeometry(.08, 6, 4), htm(x + cr(-1.1, 1.1), y + cr(2.4, 3.6), z + cr(-1.1, 1.1)), 0xe8c838);
    const [wx, wz] = Q.W(x, z); addCol(wx, wz, .3 * s, 4); };
  tree(-8, -4.5, 1.1, false); tree(8.5, 4.5, 1, false); tree(-3, 4.8, .9, true); tree(5, -5, .8, false);
  for (let i = 0; i < 40; i++) { const lx = cr(-hw + 1, hw - 1), lz = cpk([-1, 1]) * cr(1.4, hd - .6); K.geo('plain', new THREE.DodecahedronGeometry(cr(.25, .6), 0), htm(lx, y + cr(.1, .4), lz, cr(0, 3), cr(0, 3), 0), cpk([0x3a5a2a, 0x5a7a34, 0x4a6a2a, 0x6a7a3a, 0x8a3a4a, 0xc8b0d0])); }
  K.cyl('plain', 2.4, 2.4, .05, 24, 4, y + .03, 2.8, 0, 0, 0, 0x2a4a4a); K.cyl('block', 2.6, 2.6, .35, 24, 4, y + .1, 2.8, 0, 0, 0, 0x8a7a68);
  K.cyl('shiny', 2.35, 2.35, .02, 24, 4, y + .22, 2.8, 0, 0, 0, 0x3a5a5a);
  for (const x of [-5, 1]) { K.box('board', 1.8, .08, .5, x, y + .45, -1.4, 0, 0, 0, 0x6a5038, 1); for (const s of [-.75, .75]) K.box('metal', .06, .45, .45, x + s, y + .22, -1.4, 0, 0, 0, 0x2e3a34); }
  K.box('board', 1.6, .85, .7, -10.5, y + .42, 6.6, 0, 0, 0, 0x6a5038, 1); { const [x, z] = Q.W(-10.5, 6.6); addCol(x, z, .7, 1); }
  for (let i = 0; i < 5; i++) K.cyl('plain', .14, .1, .22, 8, -11 + i * .25, y + .96, 6.5, 0, 0, 0, 0x9a5a3a);
  lorePt(Q, K, -10.2, 6.5, y + .86, 'glass_gardener', 'note');
  K.build(g, true, false);
  ccache(Q, -11.5, -6.6, y, 0, 'none', 'ruin', { id: 'cc_glasshouse', name: 'The gardener’s chest', rolls: 1, refill: 3, keys: ['seed_corn', 'seed_bean', 'herb_med', 'honey'] });
  CZONES.push({ kind: 'quiet', id: 'glasshouse', name: 'The Glasshouse', x: Q.x, z: Q.z, r: 15 });
  REGIONS.push({ id: 'glasshouse', name: 'THE GLASSHOUSE', sub: 'Quiet. Something still grows here', x: Q.x, z: Q.z, r: 16 });
}

/* ---------- build it all (called from buildCity, once the Foundry is up) ---------- */
function buildCityInside(root) {
  const keep = HR_S;   // the houses' stream (hkit and tint draw from it) stays where it was
  for (const Q of citySites()) {
    if (Q.kind === 'metro') { buildMetro(Q, root); continue; }
    if (Q.kind === 'reactor') { buildReactor(Q, root); continue; }
    if (Q.kind === 'glass') { buildGlass(Q, root); continue; }
    cityBuild(Q, root); dressRooms(Q); hiddenRoom(Q);
    if (Q.cellar) cityBasement(Q, root);
    if (Q.esc) fireEscape(Q);
    cityRoof(Q);
    cityFinish(Q);
    if (Q.name) REGIONS.push({ id: 'c_' + Q.id, name: Q.name, sub: { hospital: 'Four floors of wards · the morgue is below', police: 'Locked up tight · the roof looks over the whole street', office: 'The city’s offices · paper everywhere', flat: 'A shop with a cellar' }[Q.style] || 'Cinder City', x: Q.x, z: Q.z, r: Math.hypot(Q.w, Q.d) / 2 + 4 });
  }
  HR_S = keep; cityLogs();
  console.log('city: built', citySites().length, 'places ·', CWALLS.length, 'walls ·', CITY_IT.length, 'things to use');
}

/* ---------- per frame (3-game.js): what's near, what you're standing on, what the air is doing ---------- */
let cityT = 0, cBadgeTxt = '', cityNearT = -1, cityNearV = null;
function cityNear() {
  if (cityNearT === G.t) return cityNearV; cityNearT = G.t; cityNearV = null;
  if (!CITY_IT.length || (!inCity(P.x, P.z, 40) && !P.under)) return null;
  let bd = 1e9;
  for (const it of CITY_IT) { const d = Math.hypot(it.x - P.x, it.z - P.z); if (d > it.r || d >= bd || Math.abs(it.y - P.y) > it.dy) continue; const l = it.l(); if (!l) continue; bd = d; cityNearV = it; it._l = l; }
  return cityNearV;
}
function radRes() { let r = 0; for (const t of wornAll()) { const D = GEAR_DEFS[t.id]; r += (D.fog || 0) * (D.slot === 'head' ? .3 : 1); } return clamp(r, 0, .95); }
function badge(t, col) {
  let el = $('cityBadge');
  if (!el) { el = document.createElement('div'); el.id = 'cityBadge'; Object.assign(el.style, { position: 'fixed', left: '50%', top: '114px', transform: 'translateX(-50%)', font: '700 13px/1.3 "Barlow Condensed", system-ui, sans-serif', letterSpacing: '.14em', padding: '5px 12px', borderRadius: '3px', background: 'rgba(8,10,8,.55)', pointerEvents: 'none', zIndex: 30, display: 'none', textTransform: 'uppercase', whiteSpace: 'nowrap' }); document.body.appendChild(el); }
  if (t === cBadgeTxt) return; cBadgeTxt = t; el.style.display = t ? 'block' : 'none'; if (t) { el.textContent = t; el.style.color = col; }
}
function cityApply() {
  cityApplied = true; const F = cityF();
  for (const id in F.open) if (CDOORS[id]) { if (id === 'hollis_door') { const D = CDOORS[id]; D.open = true; D.seg.on = false; D.g.position.set(D.x + D.dx * 2.4, D.y, D.z + D.dz * 2.4); } else openDoor(id, true); }
  if (F.open.hollis_hatch) revealHatch(true);
  for (const W of WEAK) if (F.coll[W.id]) collapse(W, true);
  if (F.power) powerOn(true);
}
// inside one of the city's buildings (not on its roof)?
function cityIndoors() {
  if (!CITY_SITES || !inCity(P.x, P.z, 10)) return false;
  for (const Q of CITY_SITES) { if (!Q.L || Math.abs(P.x - Q.x) > 25 || Math.abs(P.z - Q.z) > 25) continue; const dx = P.x - Q.x, dz = P.z - Q.z, lx = dx * Q.c - dz * Q.s, lz = dx * Q.s + dz * Q.c;
    if (Math.abs(lx) < Q.L.hw && Math.abs(lz) < Q.L.hd && P.y > Q.y0 - .6 && P.y < Q.top - .5) return true; }
  return false;
}
/* hook (3-game.js, right after updWeather): rain stays outside the buildings; underground there's no sun, a dim fill, a dark haze
   (what 2f-explore.js does for its pockets) — a little brighter on the Line once the generator's running */
function cityAfterWeather() {
  if (G.mode !== 'play') return;
  if (P.under) {
    if (typeof rainMesh !== 'undefined') rainMesh.visible = false;
    const lit = CITY_POWER && CITY_POWER.on && Math.abs(P.z - CITY_POWER.gate.position.z) < 10 ? .14 : 0;
    sun.intensity = 0; hemi.intensity = .42 + lit; hemi.color.setHex(0x9a9488); scene.fog.color.setHex(0x060606); scene.fog.far = 70; scene.fog.near = packFogNear(1); stars.material.opacity = 0;
  } else if (typeof rainMesh !== 'undefined' && rainMesh.visible && cityIndoors()) rainMesh.visible = false;
}
function updCity(dt) {
  for (let i = CANIM.length - 1; i >= 0; i--) if (!CANIM[i](dt)) CANIM.splice(i, 1);
  if (!CITY_SITES || G.mode !== 'play') return;
  if (!cityApplied) cityApply();
  const near = inCity(P.x, P.z, 30);
  cityT -= dt; if (cityT <= 0) { cityT = .25;
    for (const o of CIN_G) o.g.visible = near && Math.hypot(P.x - o.x, P.z - o.z) < o.r + 90;
    for (const o of CUN_G) o.g.visible = !!P.under && Math.hypot(P.x - o.x, P.z - o.z) < o.r + 60; }
  if (!near && !P.under) { badge(''); return; }
  const F = cityF();
  // weak floors: they sag, creak, and go if you're still on them a beat later
  for (const W of WEAK) {
    if (W.gone) continue; const f = W.f, dx = P.x - f.cx, dz = P.z - f.cz, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c;
    const on = P.onGround && !P.fly && !P.dead && Math.abs(lx) <= f.hw + .2 && Math.abs(lz) <= f.hd + .2 && Math.abs(P.y - f.y) < .15;
    if (on) { if (W.t === 0) { tone(64, .6, .3, 'sawtooth', 0, -14); noiseBurst(.4, 300, .6, .2); if (!F.weakHint) { F.weakHint = 1; toast('The boards sag under you — keep moving!', 2.6); } }
      W.t += dt; W.g.position.y = W.y - Math.min(.08, W.t * .2); if (W.t > .42) collapse(W); }
    else if (W.t > 0) { W.t = Math.max(0, W.t - dt * .8); if (W.t === 0) W.g.position.y = W.y; }
  }
  // the air: radiation, and the quiet places
  let rad = 0, quiet = null;
  for (const Z of CZONES) {
    if (Z.y0 != null && (P.y < Z.y0 || P.y > Z.y1)) continue; if (Z.under != null && Z.under !== !!P.under) continue;
    const d = Math.hypot(P.x - Z.x, P.z - Z.z); if (d > Z.r) continue;
    if (Z.kind === 'rad') rad = Math.max(rad, Z.k * Math.min(1, (1 - d / Z.r) * 1.6)); else quiet = Z;
  }
  if (rad > 0 && !P.dead && !P.fly) {
    // the dose goes on Part 1's radiation meter (P.rad, 2f-explore.js: the bar, wearing off, Juno / Rust medicine clear it);
    // it fills fast in here, and past 60 the city's hot places really hurt — Cinder No. 4 can kill you
    const res = typeof fogResist === 'function' ? clamp(fogResist(), 0, 1) * .9 : radRes(), e = rad * (1 - res);
    P.rad = Math.min(100, (P.rad || 0) + (e * 9 + .8) * dt);   // (+.8: what the meter would otherwise wear off this frame)
    if (P.rad > 60) { P.hp -= (P.rad - 60) * .15 * dt; P.hurtT = Math.max(P.hurtT, .25); if (Math.random() < dt * 1.5) hud.hurt.style.opacity = Math.min(1, (P.rad - 60) / 50); }
    if (Math.random() < dt * (3 + rad * 45)) noiseBurst(.006, 4200, 1.4, .1 + rad * .2, 'highpass');
    if (!F.radHint) { F.radHint = 1; toast('Radiation. A hazmat or Rust suit keeps most of it off — Juno or Rust medicine clears it.', 4.5); }
    badge(`☢ Radiation ${Math.round(rad * 100)}%` + (res > 0 ? ` · suit stops ${Math.round(res * 100)}%` : ''), res > .6 ? '#d8e070' : '#7cff6a');
    if (P.hp <= 0) die();
  } else if (quiet) {
    if (!P.dead && P.hp < 100 && P.food > 20 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * 2.5);
    if (Math.random() < dt * .35) { const f = rr(2600, 3600); tone(f, .07, .04, 'sine', 0, 500); tone(f * 1.1, .06, .03, 'sine', .1, -300); }
    if (!F.quiet || !F.quiet[quiet.id]) { (F.quiet ||= {})[quiet.id] = 1; toast(`${quiet.name} · quiet. Nobody hunts you in here, and you can catch your breath.`, 4); }
    badge('Quiet · safe here', '#a8d8b8');
  } else badge(P.under ? 'Underground · they can’t see you up there' : '', '#b8b0a0');
  // nobody chases you into a quiet place, or underground
  if (quiet || P.under) for (const e of ents) if (e.type === 'clan' && !e.dead && e.mode !== 'raid' && Math.abs(e.x - P.x) < 120 && Math.abs(e.z - P.z) < 120) { if (e.state === 'chase') e.state = 'idle'; e.blind = Math.max(e.blind || 0, .5); }
}
window.__city = { get sites() { return CITY_SITES; }, cityCollide, cityGround, collapse, revealHatch, CITY_IT, WEAK, CZONES, UNDER, CWALLS, CDOORS, cityGo, powerOn, openDoor, cityNear, underAt, get power() { return CITY_POWER; } };   // for testing from the console

/* ================= Bryce's environment models (Nov 10) =================
   assets/models/e: conifers (medium + high poly), rock sets (Davia's boulders, blocky rocks, modular stones), pallets, boxes,
   trash cans, the Arc cargo containers kit, the old factory, an abandoned city street, a burnt-out bus, a bus stop, the
   apocalypse car and a bunker entrance. Packs are split into pieces (one per mesh) and the repeated things are instanced.
   Where they go:
   · conifers: a ring of real pines round Kestrel and along the valley paths (the drawn firs still fill the far forest)
   · rocks: Davia's boulders over the valley slopes, the blocky rocks on the grey mountain and the lookout ridge, the modular
     stones along the Coldwater's banks
   · Kestrel: pallets, boxes and bins at Salvage, the Trading Post and the Workshop
   · the dropsite: the Arc's cargo containers spilled round the wreck; Farlight keeps more
   · Halvard + the old road: wrecked cars, a bus stop and the burnt bus
   · Cinder City: the old factory and the street block take two city blocks; wrecked cars + buses replace the drawn ones
   · Greyhold Station: the bunker entrance into the mountain */
const ENV_MODELS = ['e/conifer', 'e/conifer_hi', 'e/pallets', 'e/containers', 'e/factory', 'e/trashcans', 'e/rocks_davia', 'e/rocks_blocky', 'e/boxes', 'e/street', 'e/bus', 'e/bunker', 'e/busstop', 'e/car', 'e/rocks_mod'];

/* quantized (int16) attributes: copy to float before moving geometry around */
function floatGeo(geo) {
  const g = new THREE.BufferGeometry();
  for (const nm of Object.keys(geo.attributes)) { const A = geo.attributes[nm], n = A.count, k = A.itemSize, arr = new Float32Array(n * k); for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) arr[i * k + c] = A.getComponent(i, c); g.setAttribute(nm, new THREE.BufferAttribute(arr, k)); }
  if (geo.index) g.setIndex(Array.from(geo.index.array)); for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}
const _ev = new THREE.Vector3();
/* every mesh of a pack as its own piece, standing on y=0, centred in x/z */
const PIECES = {};
function pieces(name) {
  if (PIECES[name]) return PIECES[name]; const src = MODELS[name]; if (!src) return [];
  src.updateMatrixWorld(true); const out = [];
  src.traverse(m => { if (!m.isMesh) return; const geo = floatGeo(m.geometry); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(_ev);
    geo.translate(-c.x, -b.min.y, -c.z); geo.computeBoundingBox(); geo.computeBoundingSphere(); out.push({ geo, mat: m.material, size: geo.boundingBox.getSize(new THREE.Vector3()), name: m.name }); });
  return PIECES[name] = out;
}
/* the whole model, one entry per mesh, the model standing on y=0 and centred */
const WHOLE = {};
function whole(name) {
  if (WHOLE[name]) return WHOLE[name]; const src = MODELS[name]; if (!src) return null;
  src.updateMatrixWorld(true); const parts = [], b = new THREE.Box3();
  src.traverse(m => { if (!m.isMesh) return; const geo = floatGeo(m.geometry); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); b.union(geo.boundingBox); parts.push({ geo, mat: m.material }); });
  const c = b.getCenter(new THREE.Vector3()); for (const p of parts) { p.geo.translate(-c.x, -b.min.y, -c.z); p.geo.computeBoundingSphere(); }
  return WHOLE[name] = { parts, size: b.getSize(new THREE.Vector3()) };
}
/* instance parts at a list of matrices */
function instParts(parent, parts, mats, shadow = true) {
  const out = []; if (!mats.length) return out;
  for (const p of parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); out.push(im); }
  return out;
}
const envM = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
/* one placed copy (shares geometry) — for the one-off landmarks */
function envPut(parent, name, x, y, z, ry = 0, s = 1) {
  const W = whole(name); if (!W) return null; const g = new THREE.Group();
  for (const p of W.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g); return g;
}
const envFloor = (x, z, w, d, ry) => { let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const lx = a * w / 2, lz = b * d / 2; lo = Math.min(lo, heightAt(x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry))); } return lo; };
/* collision along a box's perimeter, with `gaps` (local x positions on the long sides) left open as doorways */
function colRect(x, z, w, d, ry, r = .6, gaps = []) {
  const c = Math.cos(ry), s = Math.sin(ry), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const edge = (ax, az, bx, bz, gap) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.3))); for (let i = 0; i <= n; i++) { const lx = lerp(ax, bx, i / n), lz = lerp(az, bz, i / n); if (gap && gaps.some(g => Math.abs(lx - g) < 1.8)) continue; const [wx, wz] = W(lx, lz); addCol(wx, wz, r, 8); } };
  edge(-w / 2, -d / 2, w / 2, -d / 2, 1); edge(-w / 2, d / 2, w / 2, d / 2, 1); edge(-w / 2, -d / 2, -w / 2, d / 2); edge(w / 2, -d / 2, w / 2, d / 2);
}

/* ---------- sites picked once, before the forest and the city are laid out, so neither builds over them ---------- */
let ENV_SITES = null;
function envSites() {
  if (ENV_SITES) return ENV_SITES;
  const S = ENV_SITES = [];
  const firstOK = (list, test) => list.find(([x, z]) => test(x, z));
  // the paddock: a flat bit of ground just outside the wall, off the paths
  let best = null;
  for (let a = 0; a < 6.28; a += .13) for (const r of [84, 92, 100]) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 40) continue;
    const sl = slopeAt(x, z), pd = pathDist(x, z), sc = sl * 40 - Math.min(pd, 30) + (SHELTERS.some(s => Math.hypot(s.x - x, s.z - z) < 25) ? 50 : 0) + (Math.hypot(x - 80, z + 36) < 44 || Math.hypot(x + 80, z + 24) < 36 ? 50 : 0);
    if (pd > 15 && waterAt(x, z) < -1e8 && (!best || sc < best.sc)) best = { x, z, sc }; }
  if (best) S.push({ id: 'paddock', x: best.x, z: best.z, r: 16 });
  S.push({ id: 'arches', x: POI.arches.x, z: POI.arches.z, r: 34 });            // (Nov 10) the Old Arches: no pines or boulders through the ruin
  // two city blocks: the factory and the street
  const C = CITY, cityOK = (x, z) => pathDist(x, z) > 20 && Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) > FOUNDRY.R + 45 && Math.hypot(x - C.x, z - C.z) < C.R - 60;
  const f = firstOK([[C.x + 170, C.z + 60], [C.x + 130, C.z - 150], [C.x - 170, C.z - 120], [C.x + 60, C.z + 200]], cityOK); if (f) S.push({ id: 'factory', x: f[0], z: f[1], r: 30, city: 1 });
  const s = firstOK([[C.x - 120, C.z + 190], [C.x - 200, C.z + 40], [C.x + 20, C.z - 230], [C.x + 230, C.z - 60]], (x, z) => cityOK(x, z) && (!f || Math.hypot(x - f[0], z - f[1]) > 80)); if (s) S.push({ id: 'street', x: s[0], z: s[1], r: 26, city: 1 });
  // (Nov 10) the park: a cleared block for the park arch, away from the other two
  const p = firstOK([[C.x + 40, C.z + 130], [C.x - 60, C.z - 160], [C.x + 150, C.z - 40], [C.x - 150, C.z + 90], [C.x + 90, C.z + 220]], (x, z) => cityOK(x, z) && [f, s].every(q => !q || Math.hypot(x - q[0], z - q[1]) > 85)); if (p) S.push({ id: 'park', x: p[0], z: p[1], r: 32, city: 1 });
  return S;
}
const envSite = id => envSites().find(s => s.id === id);
const envKeepClear = (x, z, pad = 4) => envSites().some(s => Math.hypot(x - s.x, z - s.z) < s.r + pad);

/* ---------- the pines ---------- */
async function buildEnvForest() {
  const W = whole('e/conifer'), WH = whole('e/conifer_hi'); if (!W) return;
  const BT = 200, NB = Math.ceil(HALF * 2 / BT), bins = {}, hero = [];
  const n = LOW ? 260 : 620; let k = 0, guard = 0;
  while (k < n && guard++ < n * 30) {
    // denser near the wall and along the paths, thinning out to ~420 m
    const a = rnd() * 6.28, r = 78 + Math.pow(rnd(), 1.6) * 360, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!treeOK(x, z) || waterAt(x, z) > -1e8 || slopeAt(x, z) > .9) continue;
    const pd = pathDist(x, z); if (pd > 60 && r > 160 && rnd() < .6) continue;
    const big = r < 130 && hero.length < (LOW ? 6 : 14) && rnd() < .12 && WH;
    const s = big ? rr(1.2, 1.6) : rr(.75, 1.25), y = heightAt(x, z) - .3, m = envM(x, y, z, rnd() * 6.28, s, rr(-.03, .03), rr(-.03, .03));
    const hid = xClear(x, z), mm = hid ? X_HIDE : m;   // (Nov 11) keep pines off the new places without moving any other
    if (big) hero.push(mm); else { const b = Math.floor((x + HALF) / BT) + Math.floor((z + HALF) / BT) * NB; (bins[b] ||= []).push(mm); }
    if (!hid) { addCol(x, z, .4 * s); addRes('fir', x, z, s); } k++;
  }
  for (const b in bins) for (const im of instParts(world, W.parts, bins[b])) FAR_HIDE.push(im);
  if (WH) for (const im of instParts(world, WH.parts, hero)) FAR_HIDE.push(im);
  for (const p of [...W.parts, ...(WH ? WH.parts : [])]) for (const m of [].concat(p.mat)) { m.alphaTest = Math.max(m.alphaTest || 0, .4); m.side = THREE.DoubleSide; m.needsUpdate = true; }
  await nextFrame();
}

/* ---------- rocks ---------- */
function buildEnvRocks() {
  const bl = pieces('e/rocks_blocky'), md = pieces('e/rocks_mod');
  const place = (P, list) => { const by = P.map(() => []); for (const [i, m] of list) by[i].push(m); P.forEach((p, i) => instParts(world, [p], by[i])); };
  const DV = whole('e/rocks_davia');
  if (DV) {                 // Davia's rock: one big weathered formation, scattered as outcrops over the valley's slopes and rim
    const L = []; let guard = 0;
    while (L.length < (LOW ? 14 : 26) && guard++ < 4000) {
      const a = rnd() * 6.28, r = 110 + Math.sqrt(rnd()) * (VALLEY - 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (pathDist(x, z) < 20 || waterAt(x, z) > -1e8 || !treeOK(x, z) || envKeepClear(x, z, 20) || slopeAt(x, z) < .25) continue;
      if (L.some(q => Math.hypot(q.x - x, q.z - z) < 60)) continue;
      const want = rr(7, 16), s = want / Math.max(DV.size.x, DV.size.z), ry = rnd() * 6.28;
      const hid = xClear(x, z);
      L.push({ x, z, m: hid ? X_HIDE : envM(x, envFloor(x, z, DV.size.x * s * .6, DV.size.z * s * .6, ry) - DV.size.y * s * .2, z, ry, s) });
      if (!hid) { for (let k = -1; k <= 1; k++) addCol(x + Math.sin(ry) * k * want * .3, z + Math.cos(ry) * k * want * .3, want * .3, 99); addRes('boulder', x, z, want * .4); }
    }
    instParts(world, DV.parts, L.map(q => q.m));
  }
  if (bl.length) {          // blocky rocks on the grey mountain (round the Grey Door) and the lookout ridge
    const L = [];
    for (const [cx, cz, n, R] of [[POI.vault.x, POI.vault.z, 22, 70], [POI.lookout.x, POI.lookout.z, 12, 50], [POI.relay.x, POI.relay.z, 10, 45]]) for (let j = 0, g = 0; j < n && g < 200; g++) {
      const a = rnd() * 6.28, r = rr(16, R), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (pathDist(x, z) < 8 || waterAt(x, z) > -1e8 || Math.hypot(x - POI.vault.x, z - POI.vault.z - 8) < 26 || Math.hypot(x - POI.lookout.x, z - POI.lookout.z) < 14) continue;
      const i = Math.floor(rnd() * bl.length), p = bl[i], s = rr(.8, 1.6);
      const m = envM(x, heightAt(x, z) - .3, z, rnd() * 6.28, s), hid = xClear(x, z); L.push([i, hid ? X_HIDE : m]); if (!hid) { addCol(x, z, Math.max(p.size.x, p.size.z) * s * .4); addRes('boulder', x, z, Math.max(p.size.x, p.size.z) * s * .4); } j++;
    }
    place(bl, L);
  }
  if (md.length) {          // stones along the Coldwater banks
    const L = [];
    for (let z = -VALLEY + 40; z < VALLEY - 40; z += rr(5, 12)) for (const sd of [-1, 1]) { if (rnd() < .35) continue;
      const x = riverX(z) + sd * (RIV_HW + rr(-.5, 3)); if (Math.abs(z - 236) < 20) continue;
      const i = Math.floor(rnd() * md.length), p = md[i], s = rr(.9, 1.8);
      L.push([i, envM(x, heightAt(x, z) - .25, z, rnd() * 6.28, s)]); }
    place(md, L);
  }
}

/* ---------- Kestrel, the dropsite, Farlight, Halvard and the old roads ---------- */
function propPile(parent, name, x, z, ry, n, spread, sMin = .9, sMax = 1.1, col = true) {
  const P = pieces(name); if (!P.length) return; const by = P.map(() => []);
  for (let k = 0; k < n; k++) { const i = Math.floor(rnd() * P.length), lx = rr(-spread, spread), lz = rr(-spread * .5, spread * .5), c = Math.cos(ry), s = Math.sin(ry), px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
    by[i].push(envM(px, heightAt(px, pz), pz, ry + rr(-.4, .4), rr(sMin, sMax))); }
  P.forEach((p, i) => { if (by[i].length) instParts(parent, [p], by[i], p.size.y > .4); });
  if (col) addCol(x, z, spread * .6, 1.2);
}
function buildEnvSites() {
  // Kestrel: against a side or back wall of Salvage, the Trading Post, the Workshop and the Gunsmith — never in a street or another house
  const inHouse = (x, z, me) => SHOP_DEFS.some(D => D !== me && Math.abs((x - D.cx) * Math.cos(D.ry) - (z - D.cz) * Math.sin(D.ry)) < D.bw / 2 + .6 && Math.abs((x - D.cx) * Math.sin(D.ry) + (z - D.cz) * Math.cos(D.ry)) < D.bd / 2 + .6);
  const clear = (p, me, r) => streetDist(p.x, p.z) > r && !inHouse(p.x, p.z, me) && Math.hypot(p.x, p.z) < CAMP_R - 3 && !(typeof inHull === 'function' && inHull(p.x, p.z));
  for (const [id, n] of [['salvage', 3], ['trade', 2], ['craft', 2], ['guns', 1], ['bunk', 1]]) {
    const D = SHOP[id]; if (!D) continue;
    const spots = [[D.bw / 2 + 1.1, -1.4], [-(D.bw / 2 + 1.1), -1.4], [D.bw / 2 + 1.1, 1], [-(D.bw / 2 + 1.1), 1], [-2.5, -(D.bd / 2 + 1.1)], [2.5, -(D.bd / 2 + 1.1)]].map(([lx, lz]) => ({ lx, lz, ...shopL2W(D, lx, lz) }));
    const a = spots.find(p => clear(p, D, 1.4)); if (a) propPile(world, 'e/pallets', a.x, a.z, D.ry + (Math.abs(a.lx) > 2.6 ? Math.PI / 2 : 0), n, 1, .9, 1, true);
    const b = spots.find(p => p !== a && clear(p, D, 1) && (!a || Math.hypot(p.x - a.x, p.z - a.z) > 2.5)); if (b) propPile(world, 'e/boxes', b.x, b.z, D.ry, 4, .6, 1.4, 1.9, false);
  }
  for (const id of ['cook', 'salvage', 'trade']) { const D = SHOP[id], P = pieces('e/trashcans'); if (!D || !P.length) continue;
    const p = [[D.bw / 2 + .8, 1.8], [-(D.bw / 2 + .8), 1.8]].map(([lx, lz]) => shopL2W(D, lx, lz)).find(q => clear(q, D, .6)); if (!p) continue;
    instParts(world, [P[id === 'cook' ? 0 : P.length - 1]], [envM(p.x, heightAt(p.x, p.z), p.z, D.ry, 1)]); addCol(p.x, p.z, .45, 1.2); }
  // the dropsite: Arc cargo spilled from the torn end of the wreck
  const cargo = () => pieces('e/containers').filter(p => Math.max(p.size.x, p.size.z) > .7 && p.size.y > .4);
  { const D = POI.dropsite, toCamp = Math.atan2(-D.z, -D.x), ax = Math.cos(toCamp), az = Math.sin(toCamp), C = cargo(), wake = { x: D.x + DROP_WAKE[0], z: D.z + DROP_WAKE[1] };
    if (C.length) { const by = C.map(() => []);
      for (let k = 0, g = 0; k < (LOW ? 8 : 13) && g < 200; g++) { const along = -rr(13, 30), sd = rr(-11, 11), x = D.x + ax * along - az * sd, z = D.z + az * along + ax * sd, i = Math.floor(rnd() * C.length);
        if (Math.hypot(x - wake.x, z - wake.z) < 7 || Math.abs(sd) < 5.5 && along > -15) continue; k++;
        by[i].push(envM(x, heightAt(x, z) - .05, z, rnd() * 6.28, rr(.5, .7), rnd() < .3 ? rr(-.3, .3) : 0, rnd() < .3 ? rr(-.4, .4) : 0)); addCol(x, z, Math.max(C[i].size.x, C[i].size.z) * .26, 1.5); }
      C.forEach((p, i) => instParts(world, [p], by[i])); } }
  // Farlight: the Arc survivors kept their cargo
  { const B = BASES.find(b => b.id === 'farlight'), C = cargo(); if (B && C.length) { const g = farGroup(B.x, B.z, B.R), by = C.map(() => []);
    for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, r = rr(28, B.R - 6), x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r, i = Math.floor(rnd() * C.length); by[i].push(envM(x, heightAt(x, z), z, rnd() * 6.28, .7)); addCol(x, z, Math.max(C[i].size.x, C[i].size.z) * .3, 1.5); }
    C.forEach((p, i) => instParts(g, [p], by[i])); propPile(g, 'e/pallets', B.x + 12, B.z + 14, .4, 4, 1.4); } }
  // Halvard: wrecks on its streets, a bus stop on the old road in, the burnt bus beside it
  { const H = POI.halvard, car = whole('e/car'), cars = [];
    if (car) { for (const lx of [-39, -13, 13, 39]) for (let k = 0; k < 2; k++) { if (rnd() < .4) continue; const z = H.z + rr(-50, 50), x = H.x + lx + rr(-2.5, 2.5); cars.push(envM(x, heightAt(x, z) - .05, z, (rnd() < .5 ? 0 : Math.PI) + rr(-.35, .35), 1)); addCol(x, z - 1.2, 1.2, 1.6); addCol(x, z + 1.2, 1.2, 1.6); }
      instParts(world, car.parts, cars); }
    const p0 = [400, 262], p1 = [H.x, H.z], dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = Math.atan2(ux, uz);
    const bx = p0[0] + ux * 30 - uz * 7, bz = p0[1] + uz * 30 + ux * 7;
    const bs = envPut(world, 'e/busstop', bx, heightAt(bx, bz) - .05, bz, ry + Math.PI / 2); if (bs) addCol(bx, bz, 1.1, 2.8);
    const tx = p0[0] + ux * 52 + uz * 9, tz = p0[1] + uz * 52 - ux * 9, b = envPut(world, 'e/bus', tx, envFloor(tx, tz, 3, 11, ry + .25) - .1, tz, ry + .25);
    if (b) { b.rotation.z = .04; addColLine(tx - Math.sin(ry + .25) * 5, tz - Math.cos(ry + .25) * 5, tx + Math.sin(ry + .25) * 5, tz + Math.cos(ry + .25) * 5, 1.6); }
    const P = pieces('e/trashcans'); if (P.length) { const c = Math.cos(ry), s = Math.sin(ry); instParts(world, [P[0]], [envM(bx + c * 2.6, heightAt(bx, bz), bz - s * 2.6, ry, 1)]); }
  }
  // the old roads in the valley: a car left here and there
  { const car = whole('e/car'); if (car) { const L = [];
    for (const path of PATHS) for (let i = 0; i < path.length - 1; i++) { if (rnd() < .55) continue; const [ax, az] = path[i], [bx, bz] = path[i + 1], t = rr(.2, .8), x0 = lerp(ax, bx, t), z0 = lerp(az, bz, t), ry = Math.atan2(bx - ax, bz - az), off = (rnd() < .5 ? -1 : 1) * rr(3.5, 6);
      const x = x0 + Math.cos(ry) * off, z = z0 - Math.sin(ry) * off; if (Math.hypot(x, z) < CAMP_R + 20 || waterAt(x, z) > -1e8 || envKeepClear(x, z)) continue;
      L.push(envM(x, heightAt(x, z) - .1, z, ry + rr(-.6, .6), 1, rr(-.05, .05), rr(-.08, .08))); addCol(x, z, 1.6, 1.6); }
    instParts(world, car.parts, L); } }
  // Greyhold Station: the bunker entrance, dug into the slope behind the station
  { const B = BASES.find(b => b.id === 'greystation'), W = whole('e/bunker'); if (B && W) {
    const away = Math.atan2(B.z, B.x), x = B.x + Math.cos(away) * (B.R + 18), z = B.z + Math.sin(away) * (B.R + 18), ry = Math.atan2(B.x - x, B.z - z);
    const g = farGroup(x, z, 40); envPut(g, 'e/bunker', x, envFloor(x, z, 20, 16, ry) - .15, z, ry); addCol(x, z, 4.5, 6); } }
}
/* Cinder City: the two landmark blocks and the wrecks */
function buildEnvCity(cars) {
  const f = envSite('factory'), s = envSite('street');
  if (f) { const g = farGroup(f.x, f.z, 40), ry = .2, W = whole('e/factory'); if (W) { envPut(g, 'e/factory', f.x, envFloor(f.x, f.z, W.size.x, W.size.z, ry) - .3, f.z, ry); colRect(f.x, f.z, W.size.x - .6, W.size.z - .6, ry, .7, []); cache(g, f.x, f.z, 0, 'pry', 'city', { id: 'c_factory', name: 'Old factory floor', big: 1, rolls: 1, refill: 2 }); } }
  if (s) { const g = farGroup(s.x, s.z, 40), ry = -.15; envPut(g, 'e/street', s.x, heightAt(s.x, s.z) - .25, s.z, ry); const P = pieces('e/trashcans'); if (P.length) instParts(g, [P[0], P[1] || P[0]], [envM(s.x + 6, heightAt(s.x + 6, s.z), s.z + 3, ry)]); }
  dressCity(f, whole('e/factory'), .2);
  // the drawn wrecks in the streets become real ones: one in six a bus
  const car = whole('e/car'), bus = whole('e/bus'); if (!car || !cars?.length) return false;
  const root = farGroup(CITY.x, CITY.z, CITY.R), cm = [], bm = [];
  for (const q of cars) { if (envKeepClear(q[0], q[2])) continue; const isBus = bus && rnd() < .16; (isBus ? bm : cm).push(envM(q[0], q[1] - .1, q[2], q[7], 1, q[6], q[8])); if (isBus) addColLine(q[0] - Math.sin(q[7]) * 4.5, q[2] - Math.cos(q[7]) * 4.5, q[0] + Math.sin(q[7]) * 4.5, q[2] + Math.cos(q[7]) * 4.5, 1.6); }
  instParts(root, car.parts, cm); if (bus) instParts(root, bus.parts, bm);
  return true;
}

/* ================= Bryce's second model batch (Nov 10): assets/models/props/ =================
   36 models (compressed: GLTFLoader + MeshoptDecoder). Packs that were joined into one mesh per material (medbay-pack,
   floor-modular, floor-section, floor-section-b) are split back into pieces by their geometry islands (`npSplit`);
   repeated things are instanced (`instParts` from 1g-env.js). Where they go:
   · the dropsite: a broken-off station section lying in the dirt beside the hull, in three pieces — windowed hull bays (wall-b
     pairs) with the seats still bolted in, bunks, lootable lockers, fuel cells and medkits spilled round it, deck plates and
     grating thrown along the furrow, the cargo-bay floor panel, a roof-plate lean-to
   · the Arc (the raid holdout) — the only place the station's own interior (hallway, corridor) is used: an infirmary at the west end (the medbay pack, beds, lamps, medkits, a drop ceiling with
     strip lights), a bunk room of stacked pods, lockers by the door, machinery round the core, and the radio room at the
     far end of the east wing (wall screens, consoles, server racks, a rack of walkie-talkies, seats); you walk into the
     infirmary through the white hallway, and the dark corridor runs from the core into the wing. The interior only draws when you can
     see into the hull (`updArcInterior`).
   · Kestrel: a wood stove in every building, gas bottles in the workshops and the power yard, the fuel tank by the genset,
     medkits in the clinic, a walkie-talkie on the gun bench, salvage on Gus's bench
   · Cinder City: the park arch as a landmark in its own cleared park, statues and pillars scattered through the streets as
     ruins, fuel tanks beside the old factory
   · the Old Arches: stone-arch-ruins on the hill north of Kestrel, a point of interest with loot you can see from the yard
   The radio warnings before night 100 come in over the walkie-talkie (`radioDay` in 3-game.js). */
const NEW_PROPS = ['bed', 'catwalk-bridge', 'ceiling-light', 'chairs-x4', 'cinema-camera', 'computer-console', 'corridor', 'floor-material', 'floor-modular', 'floor-panel',
  'floor-section-b', 'floor-section', 'floor-tiles', 'fuel-cell', 'gas-bottle', 'hallway', 'keypad-panel', 'locker', 'medbay-pack', 'medkit-case', 'medkit-small', 'roof-panel',
  'server-rack', 'server-tower', 'statue', 'stone-arch-ruins', 'stone-pillar', 'walkie-talkie', 'wall-2', 'wall-3', 'wall-4', 'wall-b', 'wall-c', 'wall-screen',
  'fuel-tank', 'park-arch', 'wood-stove'].map(n => 'props/' + n);
const npHas = n => !!MODELS['props/' + n];
const npW = n => whole('props/' + n);
// its own random stream, so placing these never moves anything else in the world
let NP_S = 424242;
const nrnd = () => (NP_S = (NP_S * 16807) % 2147483647, (NP_S - 1) / 2147483646), nr = (a, b) => a + nrnd() * (b - a);
const HPI = Math.PI / 2;

/* ---------- splitting packs: weld by position, find connected islands, gather islands whose boxes touch ---------- */
const NP_SPLIT = {};
function npSplit(name, gap = .05, perMesh = false) {
  const key = name + gap + perMesh; if (NP_SPLIT[key]) return NP_SPLIT[key];
  const root = MODELS['props/' + name]; if (!root) return [];
  root.updateMatrixWorld(true);
  const meshes = [], isl = [], v = new THREE.Vector3();
  root.traverse(m => { if (m.isMesh) meshes.push(m); });
  const data = meshes.map((m, mi) => {
    const src = m.geometry, pos = src.attributes.position, n = pos.count, P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const weld = new Map(), id = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 1e3) + ',' + Math.round(P[i * 3 + 1] * 1e3) + ',' + Math.round(P[i * 3 + 2] * 1e3); let w = weld.get(k); if (w === undefined) weld.set(k, w = weld.size); id[i] = w; }
    const par = new Int32Array(weld.size).map((_, i) => i), find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    const ix = src.index ? src.index.array : Uint32Array.from({ length: n }, (_, i) => i), nt = ix.length / 3;
    for (let t = 0; t < nt; t++) { const a = find(id[ix[t * 3]]), b = find(id[ix[t * 3 + 1]]); par[b] = a; par[find(id[ix[t * 3 + 2]])] = a; }
    const by = new Map();
    for (let t = 0; t < nt; t++) { const r = find(id[ix[t * 3]]); let I = by.get(r); if (!I) by.set(r, I = { mi, tris: [], box: new THREE.Box3() }); I.tris.push(t); for (let k = 0; k < 3; k++) { const j = ix[t * 3 + k]; I.box.expandByPoint(v.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2])); } }
    for (const I of by.values()) isl.push(I);
    return { P, ix };
  });
  const par = isl.map((_, i) => i), find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const order = isl.map((_, i) => i).sort((a, b) => isl[a].box.min.x - isl[b].box.min.x), eb = new THREE.Box3();
  for (let i = 0; i < order.length; i++) { const A = isl[order[i]]; eb.copy(A.box).expandByScalar(gap);
    for (let j = i + 1; j < order.length; j++) { const B = isl[order[j]]; if (B.box.min.x > eb.max.x) break; if ((!perMesh || A.mi === B.mi) && eb.intersectsBox(B.box)) par[find(order[j])] = find(order[i]); } }
  const groups = new Map(); isl.forEach((I, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(I); });
  const out = [], nv = new THREE.Vector3();
  for (const L of groups.values()) {
    const box = new THREE.Box3(); for (const I of L) box.union(I.box);
    const ctr = box.getCenter(new THREE.Vector3()), parts = [];
    for (let mi = 0; mi < meshes.length; mi++) {
      const mine = L.filter(I => I.mi === mi); if (!mine.length) continue;
      const m = meshes[mi], src = m.geometry, { P, ix } = data[mi], uv = src.attributes.uv, nrm = src.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const map = new Map(), pos = [], uvs = [], nor = [], idx = [];
      for (const I of mine) for (const t of I.tris) for (let k = 0; k < 3; k++) { const j = ix[t * 3 + k]; let w = map.get(j);
        if (w === undefined) { map.set(j, w = map.size); pos.push(P[j * 3] - ctr.x, P[j * 3 + 1] - box.min.y, P[j * 3 + 2] - ctr.z); if (uv) uvs.push(uv.getX(j), uv.getY(j)); if (nrm) { nv.fromBufferAttribute(nrm, j).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z); } }
        idx.push(w); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals();
      g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere(); parts.push({ geo: g, mat: m.material });
    }
    out.push({ name: meshes[L[0].mi].name, parts, size: box.getSize(new THREE.Vector3()), ctr, base: box.min.y });
  }
  out.sort((a, b) => a.ctr.x - b.ctr.x || a.ctr.z - b.ctr.z);
  return NP_SPLIT[key] = out;
}

/* collision for a ruin, from its own stone: every standing island taller than a man gets a post where it stands */
function npStoneCols(name, ox, oz, ry, s, h) {
  for (const P of npSplit(name, .05)) { if (P.size.y * s < 1.6 || P.base * s > 1) continue; const r = Math.min(P.size.x, P.size.z) * s * .5, L = Math.max(P.size.x, P.size.z) * s, n = Math.max(1, Math.round(L / (r * 2 + .01)));
    for (let k = 0; k < n; k++) { const t = n > 1 ? (k / (n - 1) - .5) * (L - 2 * r) : 0, lx = P.ctr.x * s + (P.size.x >= P.size.z ? t : 0), lz = P.ctr.z * s + (P.size.x >= P.size.z ? 0 : t); const [x, z] = npL2W(ox, oz, ry, lx, lz); addCol(x, z, Math.max(.35, r), h); } }
}

/* a model with some meshes dropped by name and/or the triangles inside a box cut away (model space, before centring):
   used to open the station's doors so its passages are walk-through */
const NP_OPEN = {};
function npOpened(name, drop, cut) {
  if (NP_OPEN[name]) return NP_OPEN[name]; const W = npW(name), src = MODELS['props/' + name]; if (!W) return null;
  const names = []; src.traverse(m => { if (m.isMesh) names.push(m.name); });
  const box = new THREE.Box3(), parts = [];
  W.parts.forEach((p, i) => { if (drop && drop.test(names[i])) return; let geo = p.geo;
    if (cut) { const pos = geo.attributes.position, ix = geo.index ? geo.index.array : null, n = ix ? ix.length : pos.count, keep = [], v = new THREE.Vector3(), c = new THREE.Vector3();
      for (let t = 0; t < n; t += 3) { c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, ix ? ix[t + k] : t + k)); c.multiplyScalar(1 / 3); if (!cut.containsPoint(c)) for (let k = 0; k < 3; k++) keep.push(ix ? ix[t + k] : t + k); }
      geo = geo.clone(); geo.setIndex(keep); geo.computeBoundingSphere(); }
    parts.push({ geo, mat: p.mat }); });
  return NP_OPEN[name] = { parts, size: W.size };
}

/* ---------- placing ---------- */
// one copy as plain meshes (bakes + culls with its group); s may be a number or [sx, sy, sz]
function npPut(parent, src, x, y, z, ry = 0, s = 1, o = {}) {
  const W = typeof src === 'string' ? npW(src) : src; if (!W) return null; const g = new THREE.Group();
  for (const p of W.parts) { if (o.skip && o.skip(p)) continue; const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = o.shadow ?? true; m.receiveShadow = true; g.add(m); }
  g.position.set(x, y, z); g.rotation.set(o.rx || 0, ry, o.rz || 0); if (Array.isArray(s)) g.scale.set(...s); else g.scale.setScalar(s); parent.add(g); return g;
}
// many copies, instanced: list of [x, y, z, ry, s, rx, rz]
function npInst(parent, src, list, shadow = true) {
  const W = typeof src === 'string' ? npW(src) : src; if (!W || !list.length) return [];
  return instParts(parent, W.parts, list.map(a => envM(a[0], a[1], a[2], a[3] || 0, a[4] ?? 1, a[5] || 0, a[6] || 0)), shadow);
}
const npPiece = (name, test, gap = .02, perMesh = true) => npSplit(name, gap, perMesh).filter(p => test(p.name));
// a frame's local (x, z) to world, for collision
const npL2W = (ox, oz, yaw, x, z) => [ox + x * Math.cos(yaw) + z * Math.sin(yaw), oz - x * Math.sin(yaw) + z * Math.cos(yaw)];
// a cache whose box is swapped for a model (lockers, med cases)
function npCache(parent, model, size, x, z, yaw, table, o) {
  const C = cache(parent, x, z, yaw, 'none', table, o), W = npW(model); if (!W) return C;
  C.g.children[0].visible = false; C.g.remove(C.g.children[0]);
  const k = size / W.size.y; for (const p of W.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(k); m.rotation.y = o.front ?? 0; m.castShadow = m.receiveShadow = true; C.g.add(m); }
  return C;
}

/* ================= the Arc: infirmary, bunk room, radio room ================= */
// the radio room is the far end of the east wing (the hull bends round to the south there): a point s metres along the wing's
// centreline, o metres to its side, with the wing's direction there
const wingAt = (s, o = 0) => { const p = WING.pts.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b); return { x: p.x + p.nx * o, z: p.z + p.nz * o, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz }; };
const ARC_RADIO = wingAt(WING.len - 5.6), ARC_WALKIES = wingAt(WING.len - 9, -2.6);
let arcInside = null; const ARC_LIGHTS = [];
function dressArc() {
  if (!npHas('bed')) return;
  const C = ARC.C, F = -C + .14, X = ARC.x, Z = ARC.z;
  // its own world group (so the bake merges inside it and it can be switched off when you can't see in); lit by the hull lamp
  const g = new THREE.Group(); g.position.set(X, H0 + C, Z); world.add(g); arcInside = g;
  const col = (x, z, r, h = 6) => addCol(X + x, Z + z, r, h), colL = (x0, z0, x1, z1, r) => addColLine(X + x0, Z + z0, X + x1, Z + z1, r);
  const lite = !LOW;
  // ceiling: strip lights down the roof, hung upside down (the light side of the model faces up)
  { const L = []; for (let x = -ARC.LW + 6; x < ARC.LE - 3; x += lite ? 8 : 12) L.push([x, ARC.R + hullOff(x, 1, 0) - 1.15, 0, HPI, 2.2, Math.PI]); npInst(g, 'ceiling-light', L, false);
    const W2 = []; for (let s = 5; s < WING.len - 3; s += 8) { const p = wingAt(s); W2.push([p.x - X, WING.C + WING.R + wingOff(s, HPI) - 1.15 - C, p.z - Z, Math.atan2(p.tx, p.tz), 1.8, Math.PI]); } npInst(g, 'ceiling-light', W2, false); }
  // a white panelled partition closes off the infirmary (open to the south, where the catwalk runs and the hallway leads in)
  const W2 = npW('wall-2');
  npPut(g, W2, -22, F, -4.35, HPI, 1, { shadow: false }); colL(-22, -10, -22, 1.2, .6);

  // ---- the infirmary (west end): a drop ceiling on pillars, four beds with blankets, lamps, carts, oxygen, medkits ----
  { const bed = npPiece('medbay-pack', n => n.startsWith('Enf_Camilla')), man = npPiece('medbay-pack', n => n.startsWith('Enf_Manta')), lamp = npPiece('medbay-pack', n => n.startsWith('Enf_Lamparas')),
      foco = npPiece('medbay-pack', n => n.startsWith('Enf_Foco')), pil = npPiece('medbay-pack', n => n.startsWith('Enf_Pilar')), cart = npPiece('medbay-pack', n => n.startsWith('Enf_Utensilios')),
      oxy = npPiece('medbay-pack', n => n.startsWith('Enf_Bombona')), chair = npPiece('medbay-pack', n => n.startsWith('Enf_Silla')), pak = npPiece('medbay-pack', n => n.startsWith('Enf_Medpak')),
      door = npPiece('medbay-pack', n => n.startsWith('Enf_Puerta'));
    // the blue tiled floor
    npPut(g, 'floor-tiles', -29, F + .012, -5, 0, [.9, 1, 1.3], { shadow: false });
    // beds, heads to the north wall, each with the blanket where the pack had it
    const BX = [-34, -31.3, -28.6, -25.9], bz = -9.2 + 1.21;
    bed.forEach((B, i) => npInst(g, B, BX.filter((_, k) => k % bed.length === i).map(x => [x, F, bz])));
    if (bed[0] && man.length) man.forEach((Mn, i) => { const B = bed[Math.min(i, bed.length - 1)], dx = Mn.ctr.x - B.ctr.x, dz = Mn.ctr.z - B.ctr.z, dy = Mn.base - B.base;
      npInst(g, Mn, BX.filter((_, k) => k % man.length === i).map(x => [x + dx, F + dy, bz + dz])); });
    for (const x of BX) colL(x, -9.3, x, -7.2, .6);
    // carts between the beds, a chair, oxygen bottles in the corner
    cart.forEach((P, i) => npInst(g, P, [[-32.65 + i * 5.4, F, -9.0, 0]]));
    if (chair[0]) npInst(g, chair[0], [[-27.2, F, -5.6, Math.PI + .3]]);
    oxy.forEach((P, i) => npInst(g, P, [[-35.1 + i * .5, F, -1.7 + (i % 2) * .4, nr(0, 6)]]));
    // the drop ceiling: grated plates on the pack's pillars, lamps and light panels hung under it
    const CY = 3.25;
    for (const x of [-33.3, -29, -24.7]) npPut(g, 'roof-panel', x, F + CY, -6.2, 0, [.95, .6, .95], { shadow: false });
    { const L = []; for (const x of [-35.4, -30.85, -26.95, -23.1]) for (const z of [-3.3]) L.push([x, F, z]); pil.forEach((P, i) => npInst(g, P, L.filter((_, k) => k % pil.length === i).map(a => [...a, 0, CY / P.size.y]))); for (const [x, , z] of L) col(x, z, .45); }
    if (foco[0]) npInst(g, foco[0], BX.map(x => [x, F + CY - .12, bz + .2]), false);
    lamp.forEach((P, i) => npInst(g, P, [[-32.65 + i * 5.4, F + CY - P.size.y, -7.4]], false));
    npInst(g, 'ceiling-light', [-33.3, -29, -24.7].map(x => [x, F + CY - .02, -4.6, HPI, 1.4, Math.PI]), false);
    // medkits: a wall pack on the north wall, red kits on the pillars, a case on each cart
    if (pak[0]) npInst(g, pak[0], [[-22.75, F + 1.3, -2, -HPI]]);
    npInst(g, 'medkit-small', [-35.4, -30.85, -26.95].map(x => [x + .45, F + 1.25, -3.3]));
    npInst(g, 'medkit-case', [[-32.65, F + .86, -9.0, .3], [-27.25, F + .86, -9.0, -.2]]);
    // the sealed hatch in the west bulkhead: the pack's door in its frame, a keypad beside it
    door.forEach(P => npInst(g, P, [[-ARC.LW + .35 + (P.ctr.z - door[0].ctr.z), F + (P.base - door[0].base), -1.6, HPI]]));
    npPut(g, 'keypad-panel', -ARC.LW + .2, F + 1.1, .3, HPI, .4, { shadow: false });
  }

  // ---- the bunk room: pods two high along the north wall, opening into the room ----
  { const L = []; for (let x = -20.6; x < -5.5; x += 2.1) for (const y of [F, F + 1.2]) L.push([x, y, -9.5, -HPI]);
    npInst(g, 'bed', lite ? L : L.filter((_, i) => i % 2 === 0), false); colL(-21.5, -9.4, -5.6, -9.4, .6);
    // lockers by the door (three to a unit), doors facing the room
    npInst(g, 'locker', [-2.66, -1.33, 0, 1.33, 2.66].map(x => [x, F, -9.55, -HPI]), false);
  }
  // ---- machinery round the core ----
  npInst(g, 'wall-4', [11.85, 13.28, 14.71, 16.14].map(x => [x, F, -9.6, -HPI]), false); colL(11, -9.5, 17, -9.5, .5);
  npInst(g, 'gas-bottle', [[17.6, F, -8.9], [17.7, F, -8.4, 1]], false);
  npInst(g, 'fuel-cell', [[9.6, F, -8.8], [10.3, F, -9.2, .7], [9.9, F, -8.1, 2]], false);

  // ---- the radio room: the far end of the east wing — screens on an end wall, the radio desk, racks down both sides ----
  { const E = WING.len, at = (sv, o, y = F) => { const p = wingAt(sv, o); return [p.x - X, y, p.z - Z]; }, t = wingAt(E - 4), back = Math.atan2(-t.tx, -t.tz), fwd = Math.atan2(t.tx, t.tz), toN = Math.atan2(-t.nx, -t.nz), fromN = Math.atan2(t.nx, t.nz);
    const cW = (s0, o0, s1, o1, r) => { const a = wingAt(s0, o0), b = wingAt(s1, o1); addColLine(a.x, a.z, b.x, b.z, r); };
    npPut(g, W2, ...at(E - .9, 0), back, 1, { shadow: false }); cW(E - .9, -5.6, E - .9, 5.6, .6);
    npInst(g, 'wall-screen', [-3.4, 0, 3.4].map(o => [...at(E - 1.5, o, F + 1.3), back]), false);
    npInst(g, 'computer-console', [-2.2, 0, 2.2].map(o => [...at(E - 4.4, o), back]), false); for (const o of [-2.2, 0, 2.2]) { const p = wingAt(E - 4.4, o); addCol(p.x, p.z, .8); }
    npInst(g, 'chairs-x4', [[...at(E - 8.2, 0), fwd]], false); cW(E - 8.2, -1.3, E - 8.2, 1.3, .4);
    npInst(g, 'server-rack', [0, 1, 2, 3].slice(0, lite ? 4 : 2).map(k => [...at(E - 9.6 + k * 1.3, 4.6), toN]), false); cW(E - 10.3, 4.6, E - 4.7, 4.6, .6);
    npInst(g, 'server-tower', [0, 1, 2, 3, 4, 5, 6, 7].map(k => [...at(E - 10.6 + k * .65, -4.6), fromN]), false); cW(E - 10.9, -4.6, E - 5.8, -4.6, .5);
    // the floor under the desk: modular tiles from the pack
    if (lite) { const T = npSplit('floor-modular', .05).filter(p => Math.abs(p.size.x - .8) < .05 && Math.abs(p.size.z - .8) < .05), by = T.map(() => []); let k = 0;
      for (let sv = E - 6.4; sv < E - 2.2; sv += .8) for (let o = -2.8; o < 3; o += .8) by[k++ % T.length].push([...at(sv, o, F + .005), back + (k % 4) * HPI]);
      T.forEach((P, i) => npInst(g, P, by[i], false)); }
    // the walkie-talkie rack: a table of handsets on charge (take one: you'll hear the other settlements on it)
    const wx = ARC_WALKIES.x - X, wz = ARC_WALKIES.z - Z, ty = shopKitTable(g, wx, F, wz, 1.6, .7);
    npInst(g, 'walkie-talkie', [-.55, -.2, .15, .5].map((dx, i) => [wx + dx, ty, wz + (i % 2) * .08, nr(-.2, .2)]), false);
    npInst(g, 'cinema-camera', [[wx + .5, ty, wz + .1, -.6, 1.6]], false); addCol(ARC_WALKIES.x, ARC_WALKIES.z, .8);
  }
  // the two passages (the station's own interior): the white hallway is the way into the infirmary, the dark corridor runs from
  // the core into the east wing — both set across the open strip south of the partitions, so you walk through them
  { const hy = H0 + .14;
    // the hallway's closed end gets its door cut out; the corridor loses the doors at both ends
    npPut(g, npOpened('hallway', null, new THREE.Box3(new THREE.Vector3(-.82, .26, -3.2), new THREE.Vector3(.82, 2.36, -2.5))), -22, F, 4.3, HPI, 1, { shadow: false }); colL(-24.9, 2.05, -19.1, 2.05, .25); colL(-24.9, 6.55, -19.1, 6.55, .25); addFloor(X - 22, Z + 4.3, 0, 2.9, 1.9, hy + .22);
    npPut(g, npOpened('corridor', /Doorway_door/), 18.6, F, 4.3, HPI, 1.35, { shadow: false });
    colL(13.2, 2.55, 24, 2.55, .3); colL(13.2, 6.05, 24, 6.05, .3); addFloor(X + 18.6, Z + 4.3, 0, 5.4, 1.4, hy + .42);
    for (const ex of [13.1, 24.1]) for (const dz of [-1.25, 1.25]) col(ex, 4.3 + dz, .45, 3);   // the end frames either side of the opening
    npInst(g, 'ceiling-light', [[16.2, F + 2.5, 4.3, HPI, 1, Math.PI], [21, F + 2.5, 4.3, HPI, 1, Math.PI]], false); }
  // white trim panels along the south wall, either side of the blast door, and a keypad by the door outside
  { const L = []; for (let x = -ARC.LW + 4; x < ARC.LE - 2; x += 2.6) if (Math.abs(x) > ARC.DOOR + 2) L.push([x, F, 9.55, Math.PI]); npInst(g, 'wall-c', L, false); }
  npPut(g, 'keypad-panel', ARC.DOOR + 1.9, 1.6 - C, Math.sqrt(ARC.R ** 2 - (1.6 - C + .5) ** 2) + .25, -.12, .45, { shadow: false });
  // room lights: cool over the radio desk, white in the infirmary, warm over the bunks (off whenever the interior isn't drawn,
  // so they never take a slot in the light pool from the yard)
  for (const [x, z, c, i] of [[ARC_RADIO.x - X, ARC_RADIO.z - Z, 0x9ad8ff, 2.2], [-29, -6, 0xf2f6ff, 2.4], [-13, -6, 0xffd8a8, 1.8]]) { const l = new THREE.PointLight(c, i, 22, 1.4); l.position.set(x, F + 3, z); l.userData.on = i; g.add(l); ARC_LIGHTS.push(l); }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  DECOR_ANIM.push(updArcInterior);
}
// a plain metal table (drawn), returns its top height
function shopKitTable(g, x, y, z, w, d) {
  const m = S(0x5a5e60, { metalness: .5, roughness: .5 }); mesh(new THREE.BoxGeometry(w, .06, d), m, x, y + .82, z, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(.05, .8, .05), M(0x3a3c3e), x + sx * (w / 2 - .06), y + .4, z + sz * (d / 2 - .06), g);
  return y + .85;
}
// the interior only draws when the camera is inside the hull or looking in through the open blast door
function updArcInterior() {
  if (!arcInside) return; const cx = camera.position.x - ARC.x, cz = camera.position.z - ARC.z;
  arcInside.visible = inHull(camera.position.x, camera.position.z) || (cz > ARC.W - 1 && cz < ARC.W + 70 && Math.abs(cx) < 12 + (cz - ARC.W) * 1.1 && hullDoor.t > .05);
  for (const l of ARC_LIGHTS) l.intensity = arcInside.visible ? l.userData.on : 0;
}

/* ================= the dropsite: a broken-off station section in the dirt ================= */
function dressDropsite(D, toCamp, inWreck) {
  if (!npHas('hallway')) return;
  const ax = Math.cos(toCamp), az = Math.sin(toCamp), yaw = -toCamp, W = (al, sd) => [D.x + ax * al - az * sd, D.z + az * al + ax * sd];
  const root = farGroup(D.x, D.z, -150);                        // draws within ~330 m: the hull stays the landmark from Kestrel
  // a chunk of the section: a group in the dropsite frame (x = along the furrow, z = across), on the ground at its centre
  const chunk = (al, sd, rot = 0, floor = 0, tilt = 0) => { const [x, z] = W(al, sd), c = new THREE.Group(); c.position.set(x, heightAt(x, z) - floor + .03, z); c.rotation.set(0, yaw + rot, tilt); root.add(c); return { c, x, z, yaw: yaw + rot }; };
  const wall = (K, x0, x1, z, r = .3) => { const [a, b] = npL2W(K.x, K.z, K.yaw, x0, z), [c, d] = npL2W(K.x, K.z, K.yaw, x1, z); addColLine(a, b, c, d, r); };
  const SD = 18;                                                 // the section lies along the furrow, off the hull's south side

  // the section: wall-b hull segments in mirrored pairs (windows both sides), broken into three pieces along the furrow
  const WB = npW('wall-b');
  const bay = (al, n, rot, tilt, sink = .2) => { const K = chunk(al, SD, rot, sink, tilt), h = n * 4.49 / 2;
    for (let i = 0; i < n; i++) { const x = -h + 2.245 + i * 4.49; npPut(K.c, WB, x, 0, 1.2, 0); npPut(K.c, WB, x, 0, -1.2, Math.PI); }
    wall(K, -h + .2, h - .2, 2.3); wall(K, -h + .2, h - .2, -2.3); return K; };
  // the forward bay: the seats still bolted to the floor
  { const K = bay(5.2, 3, .1, .02);
    npInst(K.c, 'chairs-x4', [[-4.3, .2, 1.55, Math.PI], [-.6, .2, 1.55, Math.PI], ...(LOW ? [] : [[-2.2, .2, -1.55, 0]])]);
    npInst(K.c, 'medkit-small', [[2.4, 1.2, 2.25, HPI + Math.PI]]);
    npInst(K.c, 'bed', [[7.6, .05, .6, .2, 1, 0, -1.25]]); }                     // a bunk pod tipped out of the torn end
  // the crew bay: bunks along both walls
  const H = bay(-6.4, 2, -.08, -.03);
  npInst(H.c, 'bed', [[-2.3, .2, 1.72, HPI], [-2.3, .2, -1.72, -HPI], [2.1, .2, 1.72, HPI]]);
  // the last piece, sunk at one end where it ploughed in
  const R = bay(-16.4, 2, .06, .05, .45);
  npInst(R.c, 'ceiling-light', [[-2.2, 3.35, 0, HPI, 1, Math.PI], [2.2, 3.35, 0, HPI, 1, Math.PI]], false);
  // lootable lockers: one in the crew bay, one in the sunk piece, and the section locker by the hull keeps its starter kit
  { const p = npL2W(H.x, H.z, H.yaw, 2.1, -1.75); npCache(root, 'locker', 1.73, p[0], p[1], H.yaw - HPI, 'arc', { id: 'drop_locker2', name: 'Arc crew locker', rolls: 2, refill: 4, front: 0 }); }
  { const p = npL2W(R.x, R.z, R.yaw, 1.2, 1.75); npCache(root, 'locker', 1.73, p[0], p[1], R.yaw + HPI, 'arc', { id: 'drop_locker3', name: 'Arc crew locker', rolls: 2, refill: 4, front: 0 }); }
  // fuel cells and medkits spilled round it (two of the med cases still have something in them)
  { const L = [], M2 = [], S2 = [];
    for (let i = 0; i < 12; i++) { const al = nr(-26, 14), sd = SD + (nrnd() < .5 ? -1 : 1) * nr(3.4, 9); const [x, z] = W(al, sd); if (inWreck(x, z)) continue;
      const tip = nrnd() < .5; (i % 3 === 0 ? M2 : i % 3 === 1 ? L : S2).push([x, heightAt(x, z) + (tip ? .3 : 0), z, nr(0, 6.3), 1, tip ? HPI : 0, 0]); }
    npInst(root, 'fuel-cell', L); npInst(root, 'medkit-small', S2.map(a => [a[0], heightAt(a[0], a[2]) + .1, a[2], a[3], 1, 0, HPI]));
    npInst(root, 'medkit-case', M2.slice(2));
    M2.slice(0, 2).forEach((a, i) => npCache(root, 'medkit-case', .18, a[0], a[2], a[3], 'arc', { id: 'drop_med' + i, name: 'Arc med case', rolls: 1, keys: ['bandage'], refill: 5 })); }
  // a triage spot: a stretcher from the medbay pack, oxygen, a cart, where someone patched people up after the landing
  { const bed = npPiece('medbay-pack', n => n.startsWith('Enf_Camilla')), oxy = npPiece('medbay-pack', n => n.startsWith('Enf_Bombona')), cart = npPiece('medbay-pack', n => n.startsWith('Enf_Utensilios'));
    const [x, z] = W(-3, SD + 6.5), y = heightAt(x, z);
    if (bed[0]) npInst(root, bed[0], [[x, y, z, yaw + .4]]); if (oxy[0]) npInst(root, oxy[0], [[x + 1.4, y, z - .6, .5]]); if (cart[0]) npInst(root, cart[0], [[x - 1.2, y, z + .9, yaw - .3]]); addCol(x, z, 1.2, 1.2); }
  // keypad beside the sealed airlock at the hull's far end
  { const [x, z] = W(11.6, 2.8); npPut(root, 'keypad-panel', x, heightAt(x, z) + 1.2, z, yaw + HPI, .45, { shadow: false }); }
  // thrown along the furrow: deck sections, grating, dark plates, a catwalk wrenched loose
  { const FS = npSplit('floor-section', .05), FB = npSplit('floor-section-b', .05);
    const deck = (P, al, sd, s, ry, rx, rz, sink) => { const [x, z] = W(al, sd); npInst(root, P, [[x, heightAt(x, z) - sink, z, yaw + ry, s, rx, rz]]); addCol(x, z, Math.min(P.size.x, P.size.z) * s * .35, 1.2); };
    if (FS[0]) deck(FS[0], -36, -6, .45, .4, .12, -.1, .25);
    if (FS[1]) deck(FS[1], -44, 7, .5, -.3, -.15, .2, .2);
    if (FB[0]) deck(FB[0], -31, 11, .7, 1.2, .08, .35, .4);
    if (FB[1]) deck(FB[1], -2, -6.9, .8, -.2, .9, 0, .2);
    { const L = []; for (const [al, sd, r] of [[-22, -7, .5], [-40, -2, 2.1], [-12, 12.5, 1.1], [-48, 12, .3]]) { const [x, z] = W(al, sd); L.push([x, heightAt(x, z) + .1, z, yaw + r, .8, nr(-.3, .3), nr(-.2, .2)]); } npInst(root, 'wall-3', L); }
    { const [x, z] = W(-1, SD - 5.6); npPut(root, 'catwalk-bridge', x, heightAt(x, z) + .5, z, yaw + .25, 1, { rz: .14, rx: -.08 }); addCol(x, z, 1.3, 1.2); } }
  // the cargo-bay floor, ripped out whole and lying flat: level ground to build a camp on
  { const [x, z] = W(10, -22); npPut(root, 'floor-panel', x, heightAt(x, z) + .02, z, yaw, 1, { shadow: false });
    // the floor material's rusty plating, under the crew bay where it came to rest
    const FM = npW('floor-material'); if (FM) { const p = FM.parts[0], mat = p.mat.clone(); if (mat.map) { mat.map = mat.map.clone(); mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; mat.map.repeat.set(3, 2); mat.map.needsUpdate = true; }
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), mat); pl.rotation.set(-HPI, 0, yaw); const [px, pz] = W(-6.4, SD + .6); pl.position.set(px, heightAt(px, pz) + .04, pz); pl.receiveShadow = true; root.add(pl); } }
  // a roof plate propped on two poles over the fire ring: somewhere dry to start
  { const [x, z] = W(-16, -9.6); npPut(root, 'roof-panel', x, heightAt(x, z) + 1.7, z, yaw + .3, [.8, 1, .55], { rx: .45 });
    for (const s of [-1.5, 1.5]) { const [px, pz] = npL2W(x, z, yaw + .3, s, -1.1); mesh(new THREE.CylinderGeometry(.06, .07, 2.4, 6), M(0x5a4a3a), px, heightAt(px, pz) + 1.1, pz, root); } }
}

/* ================= Kestrel ================= */
// a wood stove in every building, with its flue up through the roof
const STOVE_AT = { craft: [4.75, -2.5], trade: [4.75, -2.6], med: [6.25, -2.7], wear: [4.75, -2.6], guns: [4.75, -2.5], cook: [4.75, -2.3], salvage: [4.75, -2.4], bunk: [3.6, 2, 0] };
function dressShop(D, K, inner, Hs) {
  const id = D.id, st = STOVE_AT[id];
  if (st && npHas('wood-stove')) {
    const ry = st[2] ?? -HPI, fx = st[0] + Math.sin(ry) * -.18, fz = st[1] + Math.cos(ry) * -.18;      // the flue sits 18 cm behind the firebox
    npPut(inner, 'wood-stove', st[0], 0, st[1], ry); stovepipe(K, fx, 2.05, fz, Hs.HT - .35);
    const w = shopL2W(D, st[0], st[1]); addCol(w.x, w.z, .5, 2);
  }
  const BW = D.bw, sx = -3.9, sz = 1.2;
  if (id === 'craft') npInst(inner, 'gas-bottle', [[-BW / 2 + .5, 0, 3.3], [-BW / 2 + .85, 0, 3.6, 1], [-BW / 2 + .45, 0, 2.85, 2.2]]);
  if (id === 'salvage') { npInst(inner, 'gas-bottle', [[-BW / 2 + .5, 0, 2.6], [-BW / 2 + .5, 0, 3.05, .8]]); npInst(inner, 'fuel-cell', [[2.2, 0, 3.1], [2.9, 0, 3.4, .9]]);
    npPut(inner, 'cinema-camera', sx + .3, .99, sz + .2, .5, 1.5); npPut(inner, 'walkie-talkie', sx - .2, 1.02, sz + .3, 1.3, 1, { rx: -HPI }); }
  if (id === 'guns') npPut(inner, 'walkie-talkie', sx + 6.3, 1.02, -1.4, .4, 1, { rx: -HPI });
  if (id === 'med') { npInst(inner, 'medkit-small', [[-BW / 2 + .07, 1.35, .6], [-BW / 2 + .07, 1.35, -.2]]); npPut(inner, 'medkit-case', sx + .25, .98, sz - .05, .1); }
}
// the power yard: the fuel tank beside the genset, gas bottles by the fence
function dressYard(g) {
  if (!npHas('fuel-tank')) return;
  npPut(g, 'fuel-tank', 20.6, 0, -11.9, HPI); addColLine(16.9, -11.9, 24.3, -11.9, 1.1);
  npInst(g, 'gas-bottle', [[15.9, 0, -9.9], [16.35, 0, -9.65, 1.2], [16.15, 0, -10.35, 2.5]]); addCol(16.1, -10, .6, 2);
}

/* ================= Cinder City: the park and the ruins in the streets ================= */
function dressCity(fSite, fW, fry) {
  if (!npHas('park-arch')) return;
  const P = envSite('park');
  if (P) { const g = farGroup(P.x, P.z, 60), A = npW('park-arch'), s = 1.6, ry = .35;
    // the arch (its flat base plane left out), standing on the lowest ground under it so it never floats
    npPut(g, A, P.x, envFloor(P.x, P.z, A.size.x * s, 2.5 * s, ry) - .3, P.z, ry, s, { skip: p => { p.geo.computeBoundingBox(); return p.geo.boundingBox.max.y - p.geo.boundingBox.min.y < .05; } });
    npStoneCols('park-arch', P.x, P.z, ry, s, 12);
    // the statues facing it and a broken ring of pillars round the old lawn
    const st = []; for (const sd of [-1, 1]) { const [x, z] = npL2W(P.x, P.z, ry, sd * 9, 14); st.push([x, heightAt(x, z) - .2, z, ry + Math.PI + sd * .3, 1]); addCol(x, z, 1.7, 9); } npInst(g, 'statue', st);
    const pil = []; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + nr(-.08, .08), r = 22 + nr(-1, 1), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (nrnd() < .2) continue;
      const fall = nrnd() < .25, y = heightAt(x, z); pil.push(fall ? [x, y + .55, z, nr(0, 6.3), 1, HPI, 0] : [x, y - .1, z, nr(0, 6.3), nr(.7, 1.15), nr(-.06, .06), nr(-.06, .06)]); if (!fall) addCol(x, z, .7, 5); }
    npInst(g, 'stone-pillar', pil);
    { const C = whole('e/conifer') ? 'e/conifer' : null; if (C) { const L = []; for (let i = 0; i < 9; i++) { const a = nr(0, 6.3), r = nr(26, 29), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; L.push(envM(x, heightAt(x, z) - .3, z, nr(0, 6), nr(.8, 1.2))); addCol(x, z, .4); } instParts(g, whole(C).parts, L); } }
    cache(g, P.x + 4, P.z - 6, ry, 'pry', 'city', { id: 'c_park', name: 'Park keeper’s strongbox', rolls: 2, refill: 3 });
  }
  // ruins through the streets: statues on the crossroads, pillars along the kerbs (stood, leaning or fallen)
  { const root = farGroup(CITY.x, CITY.z, CITY.R), st = [], pil = [], BLK = 44, N = Math.ceil(CITY.R / BLK);
    const ok = (x, z, pad) => Math.hypot(x - CITY.x, z - CITY.z) < CITY.R - 40 && Math.hypot(x - FOUNDRY.x, z - FOUNDRY.z) > FOUNDRY.R + 15 && !envKeepClear(x, z, pad) && pathDist(x, z) > 7;
    for (let gx = -N; gx < N; gx++) for (let gz = -N; gz < N; gz++) { const x = CITY.x + (gx + .5) * BLK, z = CITY.z + (gz + .5) * BLK;
      if (!ok(x, z, 10)) continue; const r = nrnd();
      if (r < .1) { st.push([x, heightAt(x, z) - .2, z, nr(0, 6.3), nr(.8, 1)]); addCol(x, z, 1.6, 8); }
      else if (r < .45) for (let k = 0; k < 3; k++) { const px = x + nr(-6, 6), pz = z + nr(-6, 6), y = heightAt(px, pz), fall = nrnd() < .4;
        pil.push(fall ? [px, y + .5, pz, nr(0, 6.3), nr(.8, 1), HPI, 0] : [px, y - .2, pz, nr(0, 6.3), nr(.5, 1.1), nr(-.12, .12), nr(-.12, .12)]); if (!fall) addCol(px, pz, .6, 4); } }
    npInst(root, 'statue', st); npInst(root, 'stone-pillar', pil); }
  // the old factory's fuel tanks
  if (fSite && fW) { const g = farGroup(fSite.x, fSite.z, 40), L = [];
    for (const [lx, lz] of [[fW.size.x / 2 + 4, -4], [fW.size.x / 2 + 4, 4]]) { const [x, z] = npL2W(fSite.x, fSite.z, fry, lx, lz); if (Math.hypot(x - fSite.x, z - fSite.z) < fSite.r + 14) { L.push([x, heightAt(x, z) - .1, z, fry]); addColLine(...npL2W(x, z, fry, 0, -3.7), ...npL2W(x, z, fry, 0, 3.7), 1.1); } }
    npInst(g, 'fuel-tank', L); }
}

/* ================= the Old Arches: a ruin on the hill north of Kestrel ================= */
function buildArches() {
  const A = POI.arches, W = npW('stone-arch-ruins'); if (!W) return;
  const g = farGroup(A.x, A.z, 900), s = 2.4, ry = .5;            // big enough to read from the yard; drawn out to ~1.4 km
  npPut(g, W, A.x, envFloor(A.x, A.z, W.size.x * s, W.size.z * s * .5, ry) - .25, A.z, ry, s);
  npStoneCols('stone-arch-ruins', A.x, A.z, ry, s, 10);
  const pil = []; for (let i = 0; i < 10; i++) { const a = nr(0, 6.3), r = nr(23, 30), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r, y = heightAt(x, z), fall = nrnd() < .4;
    pil.push(fall ? [x, y + .5, z, nr(0, 6.3), 1, HPI, 0] : [x, y - .2, z, nr(0, 6.3), nr(.6, 1.2), nr(-.1, .1), nr(-.1, .1)]); if (!fall) addCol(x, z, .7, 5); }
  npInst(g, 'stone-pillar', pil);
  { const [x, z] = npL2W(A.x, A.z, ry, 2, 11); npInst(g, 'statue', [[x, heightAt(x, z) - .2, z, ry + Math.PI, .8]]); addCol(x, z, 1.4, 8); }
  // what's under them: a sealed stone chest in the middle arch, a buried crate further back
  { const [x, z] = npL2W(A.x, A.z, ry, -1.5, 2.2); cache(g, x, z, ry, 'pry', 'ruin', { id: 'arches_chest', name: 'Stone chest under the arches', big: 1, rolls: 3, refill: 5 }); }
  { const [x, z] = npL2W(A.x, A.z, ry, 11, -7); cache(g, x, z, ry + 1, 'none', 'ruin', { id: 'arches_cache', name: 'Half-buried crate', rolls: 1, refill: 3 }); }
}
/* ================= (Nov 11, Part 3) weather =================
   Clear, cloudy, fog, rain and thunderstorms drift across the valley on their own schedule. Weather changes what you can
   see and what the clans can see — it never hurts you:
   · fog and rain pull the haze in (never closer than WX_MIN_FAR), and dim the daylight; nights don't get any darker
   · the clans spot you from less far away in fog, rain and storms (wxSight → updClan), so bad weather is cover
   · rain fills pots, canteens and water collectors, and the fish bite more (wxFishK)
   · lightning is only light and sound — it never strikes you
   The red fog owns the sky while it's out: weather clears for it. Inside the Arc the rain and haze stay outside.
   Hooks (3-game.js): updWeather(dt) after updTime, wxSight() in updClan, wxSave() in save(), wxLoad(s) in startGame. */

const WX = {
  //        far: haze distance ×   light: daylight ×   grey: sky/fog to grey   cloud: extra cloud cover   rain   wind   sight: clan spotting ×   bolt: strikes / min   fish: bite bonus   dur: seconds [min, max]
  clear:  { n: 'Clear',        far: 1,   light: 1,   grey: 0,   cloud: 0,   rain: 0,   wind: 0,   sight: 1,   bolt: 0, fish: 0,   dur: [260, 520] },
  cloudy: { n: 'Overcast',     far: .85, light: .82, grey: .35, cloud: .4,  rain: 0,   wind: .3,  sight: .95, bolt: 0, fish: .03, dur: [160, 320] },
  fog:    { n: 'Fog',          far: .3,  light: .85, grey: .6,  cloud: .2,  rain: 0,   wind: 0,   sight: .55, bolt: 0, fish: .06, dur: [150, 260] },
  rain:   { n: 'Rain',         far: .55, light: .68, grey: .6,  cloud: .65, rain: .6,  wind: .5,  sight: .7,  bolt: 0, fish: .1,  dur: [160, 300] },
  storm:  { n: 'Thunderstorm', far: .42, light: .5,  grey: .8,  cloud: .85, rain: 1,   wind: 1,   sight: .6,  bolt: 4, fish: .1,  dur: [100, 200] },
};
// what tends to follow what (weights)
const WX_NEXT = {
  clear: { clear: 2, cloudy: 4, fog: 1.2 },
  cloudy: { clear: 3, rain: 2.5, fog: 1, storm: .8 },
  fog: { clear: 3, cloudy: 2 },
  rain: { cloudy: 3, storm: 1.5, clear: 1 },
  storm: { rain: 3, cloudy: 1.5 },
};
const WX_MIN_FAR = 75;                       // weather never closes the view in tighter than this (metres)
const WX_MSG = {
  clear: 'The sky clears',
  cloudy: 'Clouds rolling in',
  fog: 'Fog settling over the valley · the clans will struggle to spot you',
  rain: 'Rain · the clans see less · pots and collectors fill · the fish are biting',
  storm: 'Thunderstorm · the clans can barely see in this — good cover',
};
const WX_KEYS = ['far', 'light', 'grey', 'cloud', 'rain', 'wind', 'sight', 'bolt', 'fish'];
const wx = { id: 'clear', t: 300, cur: {}, flash: 0, boltT: 12, slowT: 0, quiet: true };
for (const k of WX_KEYS) wx.cur[k] = WX.clear[k];

function wxPick(from) {
  const W = WX_NEXT[from] || WX_NEXT.clear; let tot = 0; for (const k in W) tot += W[k];
  // mornings are foggier
  let r = Math.random() * tot; if (G.tod > .2 && G.tod < .34 && from !== 'fog' && Math.random() < .3) return 'fog';
  for (const k in W) { r -= W[k]; if (r <= 0) return k; } return 'clear';
}
function wxSet(id, quiet) {
  if (!WX[id]) return; wx.id = id; const d = WX[id].dur; wx.t = d[0] + Math.random() * (d[1] - d[0]);
  if (!quiet && G.mode === 'play' && !cine) toast(WX_MSG[id], 3.2);
  if (id === 'storm') wx.boltT = 6 + Math.random() * 8;
}
const wxRustOut = () => rust.state !== 'none' || rust.k > .05;
const wxSight = () => wx.cur.sight;
const wxFishK = () => wx.cur.fish;
const wxRaining = () => wx.cur.rain > .3 && !wxRustOut() && !inHull(P.x, P.z);

/* ---------- rain: streaks in a box that travels with the camera (all the motion is in the vertex shader) ---------- */
const RAIN_N = LOW ? 1400 : 3200, RAIN_B = 26, RAIN_H = 22;
const rainU = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() }, uOp: { value: 0 }, uCol: { value: new THREE.Color(.75, .8, .86) } };
const rainMesh = (() => {
  const pos = new Float32Array(RAIN_N * 6), end = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); for (let j = 0; j < 2; j++) { pos.set([x, y, z], i * 6 + j * 3); end[i * 2 + j] = j; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute float aEnd; uniform float uT; uniform vec3 uCam; uniform vec2 uWind; varying float vE;
      void main(){ const float B = ${RAIN_B}.0, H = ${RAIN_H}.0, SP = 19.0;
        float x = mod(position.x * 2.0 * B - uCam.x + uT * uWind.x, 2.0 * B) - B;
        float z = mod(position.z * 2.0 * B - uCam.z + uT * uWind.y, 2.0 * B) - B;
        float y = mod(position.y * H - uT * SP, H) - H * .45;
        vec3 p = uCam + vec3(x, y, z) - normalize(vec3(uWind.x, -SP, uWind.y)) * aEnd * .75;
        vE = aEnd; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vE; void main(){ gl_FragColor = vec4(uCol, uOp * (1.0 - vE * .7)); }`,
  }));
  m.frustumCulled = false; m.visible = false; m.renderOrder = 5; scene.add(m); return m;
})();

/* ---------- lightning: a short jagged bolt far off, a flash of light, thunder that arrives late ---------- */
const boltMat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false, depthWrite: false });
const boltLine = new THREE.Line(new THREE.BufferGeometry(), boltMat); boltLine.frustumCulled = false; boltLine.visible = false; scene.add(boltLine);
let boltLife = 0;
function wxStrike() {
  const a = P.yaw + Math.PI + (Math.random() - .5) * 2.4, r = 260 + Math.random() * 420;   // mostly somewhere you can see
  const bx = P.x + Math.sin(a) * r, bz = P.z + Math.cos(a) * r, gy = heightAt(bx, bz), top = gy + 320;
  const pts = []; let x = bx + (Math.random() - .5) * 40, z = bz + (Math.random() - .5) * 40;
  for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push(new THREE.Vector3(x, top + (gy - top) * k, z)); x += (Math.random() - .5) * 26 * (1 - k * .5); z += (Math.random() - .5) * 26 * (1 - k * .5); if (i === 14) { pts[i].x = bx; pts[i].z = bz; } }
  boltLine.geometry.dispose(); boltLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  boltLine.visible = true; boltLife = .22; wx.flash = 1;
  // thunder: ~340 m/s, so the far ones arrive seconds later and quieter
  if (AC && !muted) { const dl = Math.min(3.5, r / 340), v = clamp(1.1 - r / 900, .3, .9); noiseBurst(.35, 900, .7, .18 * v, 'lowpass', dl); noiseBurst(3.2, 140, .5, .55 * v, 'lowpass', dl + .1); noiseBurst(2.2, 70, .4, .5 * v, 'lowpass', dl + .5); }
}

/* ---------- rain on the roof: a looped noise bed, louder the harder it rains (quiet inside the Arc) ---------- */
let rainGain = null;
function wxAudio(rain, inside) {
  if (!AC) return;
  if (!rainGain) {
    const s = AC.createBufferSource(); s.buffer = AC.noiseBuf; s.loop = true;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    rainGain = AC.createGain(); rainGain.gain.value = 0; s.connect(hp).connect(lp).connect(rainGain).connect(master); s.start();
  }
  rainGain.gain.value = rain * (inside ? .025 : .085);
  if (windGain) windGain.gain.value += wx.cur.wind * (inside ? .02 : .08);
}

/* ---------- per frame, after updTime has set the day's sky (this only tints what it set) ---------- */
const _wxA = new THREE.Color(), _wxB = new THREE.Color();
function updWeather(dt) {
  if (G.mode !== 'play') { rainMesh.visible = false; return; }
  const rustOut = wxRustOut();
  if (!rustOut) { wx.t -= dt; if (wx.t <= 0) wxSet(wxPick(wx.id), wx.quiet); wx.quiet = false; }
  const T = rustOut ? WX.clear : WX[wx.id], ease = 1 - Math.exp(-dt / (rustOut ? 3 : 9));
  for (const k of WX_KEYS) wx.cur[k] += (T[k] - wx.cur[k]) * ease;
  const c = wx.cur, inside = UG.at ? 1 : hullFogK, out = 1 - inside;   // (Nov 11) under the ground counts as inside
  // daylight only: weather doesn't make the night any darker
  const dayK = clamp(sun.intensity / 1.2, 0, 1), dim = 1 - (1 - c.light) * dayK * out;
  sun.intensity *= dim; hemi.intensity *= 1 - (1 - c.light) * dayK * .7 * out;
  // haze closes in (never tighter than WX_MIN_FAR), and the fog/sky go grey
  const far0 = scene.fog.far, far = Math.max(Math.min(far0, WX_MIN_FAR), far0 * (1 - (1 - c.far) * out));
  if (far < far0) { const n = scene.fog.near, code = n - (n % 1000); scene.fog.far = far; scene.fog.near = code + (n % 1000) * far / far0; }
  const gk = c.grey * out;
  if (gk > .01) {
    const L = scene.fog.color.r * .3 + scene.fog.color.g * .55 + scene.fog.color.b * .15;
    _wxA.setRGB(L * .97, L, L * 1.03); scene.fog.color.lerp(_wxA, gk); skyU.fogC.value.copy(scene.fog.color);
    skyU.hor.value.lerp(_wxA, gk * .8); skyU.top.value.lerp(_wxB.setRGB(L * .8, L * .83, L * .88), gk * .7);
    stars.material.opacity *= 1 - c.cloud;
  }
  for (const C of CLOUDS) { C.u.op.value = Math.min(1, C.u.op.value + c.cloud * .6); C.u.col.value.multiplyScalar(1 - c.cloud * .45); C.u.haze.value.copy(scene.fog.color); }
  // lightning
  if (c.bolt > .5 && !rustOut && wx.id === 'storm') { wx.boltT -= dt; if (wx.boltT <= 0) { wx.boltT = 60 / c.bolt * (.4 + Math.random() * 1.2); wxStrike(); } }
  if (boltLife > 0) { boltLife -= dt; boltMat.opacity = boltLife > .12 ? 1 : boltLife > .07 ? .2 : boltLife > 0 ? .9 : 0; if (boltLife <= 0) boltLine.visible = false; }
  if (wx.flash > .01) {
    const f = wx.flash * (boltLife > .07 && boltLife < .12 ? .3 : 1) * out;
    hemi.intensity += f * 2.2; skyU.hor.value.lerp(_wxA.setRGB(.85, .88, 1), f * .5); skyU.top.value.lerp(_wxA, f * .3);
    wx.flash = Math.max(0, wx.flash - dt * 3.2);
  }
  // rain streaks: off inside the Arc; lit by the sky so they don't glow at night
  const ra = c.rain * out * (rustOut ? 0 : 1);
  rainMesh.visible = ra > .02;
  if (rainMesh.visible) {
    rainU.uT.value = G.t; rainU.uCam.value.copy(camera.position); rainU.uWind.value.set(Math.sin(G.t * .05) * 3 * c.wind + 1.5 * c.wind, 2 * c.wind);
    rainU.uOp.value = .28 * ra; rainU.uCol.value.setRGB(.7, .75, .82).multiplyScalar(.35 + dayK * .65 + wx.flash * .5);
    rainMesh.geometry.setDrawRange(0, Math.ceil(RAIN_N * Math.min(1, ra * 1.1)) * 2);
  }
  wxAudio(ra, inside > .5);
  // once a second: rain fills placed water collectors faster
  wx.slowT -= dt;
  if (wx.slowT <= 0) { wx.slowT = 1; if (ra > .3) for (const p of PLACED) { const B = BUILD_DEF[p.k]; if (B && B.make && B.make[0] === 'water_rain' && p.rec) p.rec.t = (p.rec.t || 0) + 3 * ra; } }
}

/* ---------- save: its own key, so the main save format is untouched and old saves just start clear ---------- */
const WX_SAVE = 'the-arc-wx-v1';
function wxSave() { try { localStorage.setItem(WX_SAVE, JSON.stringify({ id: wx.id, t: wx.t, buffs: P.buffs || {}, water: P.water ?? 100 })); } catch (e) {} }
function wxLoad(s) {
  let w = null; if (s) try { w = JSON.parse(localStorage.getItem(WX_SAVE) || 'null'); } catch (e) {}
  P.buffs = (w && w.buffs) || {}; P.water = w && w.water != null ? w.water : 100; P.thirstWarn = 0;
  wxSet(w && WX[w.id] ? w.id : 'clear', true); if (w && w.t > 0) wx.t = w.t;
  for (const k of WX_KEYS) wx.cur[k] = WX[wx.id][k];
  wx.quiet = true; wx.flash = 0;
  if (s) survLoad(); else G.flags.durK = DUR_K;     // fresh games start with the new durability already
}
window.__WX = { set(id, snap) { wxSet(id); if (snap) for (const k of WX_KEYS) wx.cur[k] = WX[id][k]; }, get: () => ({ id: wx.id, t: Math.round(wx.t), ...wx.cur }), strike: wxStrike };

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
  const d = Math.hypot(o.x, o.z), R = CAMP_R;
  if (Math.abs(d - R) < rad + .45 && d > .01) {
    const a = Math.atan2(o.x, o.z);
    const gateOpen = gate.open || gate.hp <= 0;
    if (Math.abs(a) < GATE_HALF - .02 && gateOpen) { o.pd = d; return; }   // (Nov 10) a shut gate stops you too: E opens it
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
  hullCollide(o, rad);
  const d = Math.hypot(o.x, o.z); if (d > WORLD) { o.x *= WORLD / d; o.z *= WORLD / d; }
}
/* is the straight walk from a to b free of anything solid (and not across the wall)? */
function clearLine(x0, z0, x1, z1, rad) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / .8));
  if ((Math.hypot(x0, z0) < CAMP_R) !== (Math.hypot(x1, z1) < CAMP_R)) return false;
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
    const hurt = e.hp < e.maxhp * .25, home = Math.hypot(e.x - e.home.x, e.z - e.home.z), inCamp = Math.hypot(P.x, P.z) < CAMP_R + 4 || P.safe;
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
  if (Math.hypot(x, z) > WORLD - 60 || waterAt(x, z) > heightAt(x, z) - .5 || Math.hypot(x, z) < CAMP_R + 30 || inCity(x, z, -40) || inBase(x, z, 10)) continue; if (test && !test(x, z)) continue; return { x, z }; } return null; }
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
const ICON_IDS = new Set('alcohol aluminum ammo_12 ammo_45 ammo_556 ammo_762 ammo_9 ammo_box ammo_flare antenna antibiotic arc_alloy arc_jumpsuit arc_pack arden_notes arm_guards arrows ash assault backpack bandage bark barracks battery beans bed berries binoculars blackvein blood_bag blood_kit blueberries bolt_cutters bolts bolts_xb bone bone_dagger bone_knife bookshelf boots branch bread breather cable2 cable_spool camera campfire canned canteen canvas carrot cell chair charcoal circuit clan_mask clay climb_gear climb_pick cloth club compass cook_station cooked_fish cooking_rack copper corn crossbow crowbar cu_wiring data_drive diag_pc disinfect documents dome door dried_meat drone drying_rack duffel ember engine_part farm_plot fasteners fat feather fertilizer fiber fire_starter fish fish_rod fish_soup fish_spear flare_gun flashlight flint flint_knife flour forge frag fuel fuel_can2 fuse gas2 gas3 gas_mask gas_tank gate_codes gears generator glass gloves greenhouse greens grey_armor grey_rifle greyhold_card greyhold_files gunpowder halcyon_chip hammer hand_saw hand_xbow hardwood harness hatchet hazmat heavy_xbow helmet herb herb_bandage herb_med hide hide_boots hide_coat honey hook hook2 hornbow hunt_outfit hunt_recurve hunt_spear hunting_knife id_chip inject insignia iv jacket knife kukri lab lab_sample lake_fish lantern lantern_key leather leather_armor limestone lmg lock_bypass locker lockers log longbow m1911 machete map map_table meat med_parts med_scanner med_station medkit meridian_gear metal_axe metal_chest metal_crate metal_ore metal_spear metal_wall mil_armor mil_knife molotov multitool mushroom nails nav_console needle notebook nuts nvg oil painkiller palisade pan pants photo pickaxe pills pipe pistol plank pliers pot potato poultice power2 power_cell pulse_pistol pump_rifle purify_tab radio radio_tower rain_cloak rain_coll ration recurve reed repair_drone repeat_xbow revolver riot_helmet riot_shield roast rope rope2 rubber rust_detector rust_med rust_suit salt sat scrap screwdriver screws sealed_suit sec_uniform seed_bean seed_carrot seed_corn seed_potato seed_squash seed_wheat sensor serum sharp_rock shellfish shelves shield shielding shortbow shotgun sinew sleeping_mat smg smoke_gren smoked_fish sniper soil solar_cell solar_charger solar_panel spare_parts spare_tire spear spikes spindle splint springs squash staff steel stew stick stone stone_axe stone_knife stone_pick storage_chest storage_crate stun_baton sunfall_data surgical_kit sutures sword synth table tablet tabs2 tabs3 tac_armor teeth tent terminal thread throw_spear tomahawk tool_kit torch_t transmitter turret usb util_vest vane veg_soup vine war_axe war_paint watchtower water_boiled water_collector water_dirty water_filter water_filtered water_rain weapon_rack welder wheat winch window wire wire_cutters wood_hammer wood_shelter wood_shovel wood_spear wood_wall workshop wraps wrench wristband yumi'.split(' '));

/* ================= the data: every item, tool, weapon, piece of wear, placeable and recipe =================
   The world's own setting: Arc folk, the Thornkin clans, Ironjaw scavengers, Greyhold, the Rust, the Ember,
   HALCYON, Dr. Sel Arden, Sunfall, the Lantern vault, Meridian, mind spindles and the Gate Stone.
   Tiers aren't chapters: each one opens when you find its key item out in the world (see TIER_KEYS). */

const TIERS = ['', 'The Landing', 'The Clans', 'The Arc Survivors', 'Greyhold', 'Sunfall', 'Beyond'];
const TIER_KEYS = { insignia: 2, id_chip: 3, greyhold_card: 4, arden_notes: 5, gate_codes: 6 };
const TIER_HOW = ['', '', 'Take a clan insignia from the Thornkin (holds, outposts, warriors)', 'Find an Arc ID chip (the Burn, Farlight, the city)',
  'Take a Greyhold access card (Greyhold Station, the Foundry)', "Open the Grey Door for Dr. Arden's notebook", 'Crack the Foundry strongroom for the Gate Stone codes'];

// [id, name, category, tier, source, weight]   source: ren = renewable · salv = only from ruins/crates/factions · craft · story
const ITEM_DEFS = [
  // wood
  ['stick', 'Sticks', 'wood', 1, 'ren', .3], ['branch', 'Branch', 'wood', 1, 'ren', .8], ['log', 'Log', 'wood', 1, 'ren', 3], ['plank', 'Plank', 'wood', 1, 'craft', 1.2],
  ['bark', 'Bark', 'wood', 1, 'ren', .3], ['hardwood', 'Hardwood', 'wood', 1, 'ren', 1.5],
  // stone + earth
  ['stone', 'Small stone', 'stone', 1, 'ren', .5], ['sharp_rock', 'Sharp rock', 'stone', 1, 'craft', .3], ['flint', 'Flint', 'stone', 1, 'ren', .3],
  ['limestone', 'Limestone', 'stone', 1, 'ren', .8], ['clay', 'Clay', 'stone', 1, 'ren', .8], ['charcoal', 'Charcoal', 'stone', 1, 'craft', .2],
  ['metal_ore', 'Metal ore', 'stone', 2, 'ren', 1.2], ['soil', 'Soil', 'stone', 1, 'ren', 1], ['ash', 'Ash', 'stone', 1, 'craft', .1], ['fertilizer', 'Fertilizer', 'stone', 2, 'craft', .5],
  // plant fibres
  ['fiber', 'Plant fiber', 'fiber', 1, 'ren', .1], ['vine', 'Vines', 'fiber', 1, 'ren', .2], ['reed', 'Reeds', 'fiber', 1, 'ren', .1], ['leaves', 'Leaves', 'fiber', 1, 'ren', .05],
  // metals
  ['scrap', 'Scrap metal', 'metal', 1, 'salv', .5], ['iron', 'Iron', 'metal', 3, 'craft', 1], ['steel', 'Steel', 'metal', 3, 'craft', 1], ['copper', 'Copper', 'metal', 2, 'salv', .6],
  ['aluminum', 'Aluminum', 'metal', 3, 'salv', .4], ['wire', 'Wire', 'metal', 1, 'salv', .2],
  // animal
  ['hide', 'Hide', 'animal', 1, 'ren', 1], ['leather', 'Leather', 'animal', 2, 'craft', .6], ['bone', 'Bone', 'animal', 1, 'ren', .3], ['sinew', 'Sinew', 'animal', 1, 'ren', .05],
  ['feather', 'Feathers', 'animal', 1, 'ren', .01], ['teeth', 'Teeth', 'animal', 1, 'ren', .05], ['fat', 'Animal fat', 'animal', 1, 'ren', .3],
  // textiles
  ['cloth', 'Cloth scraps', 'textile', 1, 'salv', .1], ['rope', 'Rope', 'textile', 1, 'craft', .3], ['thread', 'Thread', 'textile', 1, 'craft', .02],
  ['canvas', 'Canvas', 'textile', 2, 'craft', .5], ['synth', 'Synthetic fabric', 'textile', 3, 'salv', .3],
  // electronics (only from ruins and factions)
  ['circuit', 'Circuit board', 'elec', 3, 'salv', .2], ['battery', 'Battery', 'elec', 3, 'salv', .4], ['cu_wiring', 'Copper wiring', 'elec', 2, 'salv', .3],
  ['sensor', 'Sensor', 'elec', 3, 'salv', .2], ['fuse', 'Fuse', 'elec', 3, 'salv', .05], ['antenna', 'Antenna', 'elec', 3, 'salv', .5], ['power_cell', 'Power cell', 'elec', 5, 'salv', .6],
  ['data_drive', 'Data drive', 'elec', 3, 'salv', .1], ['camera', 'Camera', 'elec', 3, 'salv', .6], ['tablet', 'Computer tablet', 'elec', 4, 'salv', .6],
  // industrial
  ['nails', 'Nails', 'indus', 1, 'salv', .02], ['screws', 'Screws', 'indus', 1, 'salv', .02], ['bolts', 'Bolts', 'indus', 2, 'salv', .05], ['pipe', 'Pipe', 'indus', 2, 'salv', 1],
  ['gears', 'Gears', 'indus', 3, 'salv', .3], ['springs', 'Springs', 'indus', 3, 'salv', .1], ['rubber', 'Rubber', 'indus', 2, 'salv', .4], ['fasteners', 'Fasteners', 'indus', 2, 'craft', .1],
  ['spare_parts', 'Spare parts', 'indus', 3, 'salv', .6], ['tool_kit', 'Tool kit', 'indus', 3, 'salv', 2], ['hook', 'Bone hook', 'indus', 1, 'craft', .01], ['pot', 'Clay pot', 'indus', 1, 'craft', .8],
  ['glass', 'Glass', 'indus', 3, 'salv', .4], ['gunpowder', 'Gunpowder', 'indus', 3, 'craft', .05], ['fuel', 'Fuel', 'indus', 3, 'salv', 2], ['gas_tank', 'Gas cylinder', 'indus', 3, 'salv', 4],
  ['engine_part', 'Engine part', 'indus', 3, 'salv', 3], ['spare_tire', 'Spare tire', 'indus', 3, 'salv', 6], ['winch', 'Winch cable', 'indus', 3, 'salv', 2], ['cable_spool', 'Cable spool', 'indus', 3, 'salv', 2],
  // rare salvage (never renewable)
  ['arc_alloy', 'Arc alloy', 'rare', 3, 'salv', .5], ['solar_cell', 'Solar cell', 'rare', 3, 'salv', .4], ['shielding', 'Rust shielding', 'rare', 4, 'salv', 1], ['med_parts', 'Medical components', 'rare', 3, 'salv', .2],
  // food
  ['berries', 'Wild berries', 'food', 1, 'ren', .05], ['blueberries', 'Blueberries', 'food', 1, 'ren', .05], ['mushroom', 'Mushrooms', 'food', 1, 'ren', .05], ['roots', 'Roots', 'food', 1, 'ren', .1],
  ['nuts', 'Nuts', 'food', 1, 'ren', .05], ['greens', 'Edible greens', 'food', 1, 'ren', .05], ['herb', 'Herbs', 'food', 1, 'ren', .02],
  ['potato', 'Potatoes', 'food', 2, 'ren', .3], ['corn', 'Corn', 'food', 2, 'ren', .3], ['beans', 'Beans', 'food', 2, 'ren', .2], ['wheat', 'Wheat', 'food', 2, 'ren', .2],
  ['squash', 'Squash', 'food', 2, 'ren', .8], ['carrot', 'Carrots', 'food', 2, 'ren', .2],
  ['meat', 'Raw meat', 'food', 1, 'ren', .5], ['fish', 'River fish', 'food', 1, 'ren', .4], ['lake_fish', 'Lake fish', 'food', 1, 'ren', .4], ['shellfish', 'Shellfish', 'food', 1, 'ren', .2],
  ['salt', 'Salt', 'food', 2, 'craft', .05], ['flour', 'Flour', 'food', 2, 'craft', .3], ['oil', 'Cooking oil', 'food', 2, 'craft', .3], ['honey', 'Honey', 'food', 1, 'ren', .3],
  ['ration', 'Cooked meat', 'food', 1, 'craft', .4], ['cooked_fish', 'Cooked fish', 'food', 1, 'craft', .3], ['dried_meat', 'Dried meat', 'food', 1, 'craft', .2], ['roast', 'Roasted meat', 'food', 1, 'craft', .5],
  ['smoked_fish', 'Smoked fish', 'food', 1, 'craft', .2], ['canned', 'Canned ration', 'food', 1, 'salv', .4], ['arc_pack', 'Arc food pack', 'food', 1, 'salv', .3],
  ['stew', 'Vegetable stew', 'food', 1, 'craft', .6], ['veg_soup', 'Vegetable soup', 'food', 1, 'craft', .6], ['fish_soup', 'Fish soup', 'food', 1, 'craft', .6], ['bread', 'Bread', 'food', 2, 'craft', .3],
  // seeds
  ['seed_corn', 'Corn seeds', 'seed', 2, 'ren', .01], ['seed_potato', 'Seed potatoes', 'seed', 2, 'ren', .05], ['seed_wheat', 'Wheat seeds', 'seed', 2, 'ren', .01],
  ['seed_bean', 'Bean seeds', 'seed', 2, 'ren', .01], ['seed_squash', 'Squash seeds', 'seed', 2, 'ren', .01], ['seed_carrot', 'Carrot seeds', 'seed', 2, 'ren', .01],
  // water
  ['water_dirty', 'Dirty water', 'water', 1, 'ren', .5], ['water_boiled', 'Boiled water', 'water', 1, 'craft', .5], ['water_filtered', 'Filtered water', 'water', 2, 'craft', .5], ['water_rain', 'Rainwater', 'water', 1, 'ren', .5],
  // medicine
  ['herb_med', 'Medicinal herbs', 'med', 1, 'ren', .02], ['bandage', 'Bandage', 'med', 1, 'craft', .05], ['herb_bandage', 'Herbal bandage', 'med', 1, 'craft', .05], ['splint', 'Splint', 'med', 1, 'craft', .4],
  ['poultice', 'Herbal poultice', 'med', 1, 'craft', .1], ['disinfect', 'Disinfectant', 'med', 2, 'craft', .2], ['painkiller', 'Painkillers', 'med', 1, 'craft', .05], ['antibiotic', 'Antibiotics', 'med', 3, 'craft', .05],
  ['sutures', 'Surgical thread', 'med', 2, 'craft', .02], ['alcohol', 'Medical alcohol', 'med', 2, 'craft', .3], ['purify_tab', 'Purification tablets', 'med', 2, 'salv', .02], ['medkit', 'Medical kit', 'med', 2, 'craft', .6],
  ['surgical_kit', 'Surgical kit', 'med', 3, 'craft', .5], ['iv', 'IV supplies', 'med', 3, 'craft', .4], ['blood_bag', 'Blood bag', 'med', 4, 'salv', .4], ['rust_med', 'Rust medicine', 'med', 4, 'craft', .1],
  ['lab_sample', 'Laboratory sample', 'med', 4, 'salv', .05], ['blood_kit', 'Blood-testing kit', 'med', 4, 'salv', .3], ['inject', 'Protective injection', 'med', 4, 'craft', .05], ['serum', 'Black-vein serum', 'med', 5, 'craft', .05],
  // documents + odds and ends
  ['map', 'Old map', 'doc', 1, 'salv', .05], ['notebook', 'Notebook', 'doc', 1, 'salv', .1], ['photo', 'Photograph', 'doc', 1, 'salv', .01], ['documents', 'Documents', 'doc', 2, 'salv', .1],
  ['war_paint', 'War paint', 'doc', 2, 'craft', .05],
  // story items (keys, relics)
  ['wristband', 'Arc wristband', 'story', 1, 'story', .1], ['id_chip', 'Arc ID chip', 'story', 3, 'story', .01], ['nav_console', 'Dropship nav console', 'story', 3, 'story', 2],
  ['insignia', 'Clan insignia', 'story', 2, 'story', .1], ['ember', 'The Ember', 'story', 6, 'story', .3], ['blackvein', 'Black-vein sample', 'story', 5, 'story', .05],
  ['greyhold_card', 'Greyhold access card', 'story', 4, 'story', .01], ['greyhold_files', 'Greyhold medical files', 'story', 4, 'story', .2], ['halcyon_chip', 'HALCYON chip', 'story', 5, 'story', .01],
  ['arden_notes', "Dr. Arden's notebook", 'story', 5, 'story', .2], ['sunfall_data', 'Sunfall warning data', 'story', 5, 'story', .05], ['lantern_key', 'Lantern vault key', 'story', 5, 'story', .1],
  ['meridian_gear', 'Meridian equipment', 'story', 6, 'story', 1], ['spindle', 'Mind spindle', 'story', 6, 'story', .2], ['gate_codes', 'Gate Stone codes', 'story', 6, 'story', .5],
  // ammunition
  ['ammo_556', 'Rifle rounds', 'ammo', 1, 'salv', .012], ['ammo_762', 'Heavy rifle rounds', 'ammo', 1, 'salv', .025], ['ammo_9', '9mm rounds', 'ammo', 3, 'craft', .01],
  ['ammo_45', '.45 rounds', 'ammo', 3, 'craft', .015], ['ammo_12', 'Shotgun shells', 'ammo', 3, 'craft', .04], ['ammo_flare', 'Flares', 'ammo', 3, 'craft', .1],
  ['arrows', 'Arrows', 'ammo', 2, 'craft', .04], ['bolts_xb', 'Crossbow bolts', 'ammo', 3, 'craft', .05], ['cell', 'Pulse cells', 'ammo', 6, 'salv', .1],
  ['throw_spear', 'Throwing spear', 'ammo', 1, 'craft', 1], ['smoke_gren', 'Smoke grenade', 'ammo', 3, 'craft', .4], ['frag', 'Frag grenade', 'ammo', 3, 'craft', .4], ['molotov', 'Fire bottle', 'ammo', 2, 'craft', .5],
];
const ITEMS = {}; for (const [id, n, c, t, src, w] of ITEM_DEFS) ITEMS[id] = { id, n, c, t, src, w };

/* tools, weapons and wear are individual pieces with durability + quality */
const QUAL = [{ n: 'Crude', k: .7 }, { n: 'Standard', k: 1 }, { n: 'Fine', k: 1.4 }];
const GEAR_DEFS = {
  // primitive tools
  stone_axe: { n: 'Stone axe', kind: 'axe', pw: 1, dur: 40, t: 1, w: 1.5 }, stone_pick: { n: 'Stone pickaxe', kind: 'pick', pw: 1, dur: 40, t: 1, w: 2 },
  flint_knife: { n: 'Flint knife', kind: 'knife', pw: 1, dur: 35, t: 1, w: .3 }, bone_knife: { n: 'Bone knife', kind: 'knife', pw: 1, dur: 25, t: 1, w: .2 },
  wood_shovel: { n: 'Wooden shovel', kind: 'shovel', pw: 1, dur: 30, t: 1, w: 1.5 }, fish_spear: { n: 'Fishing spear', kind: 'fish', pw: 1, dur: 25, t: 1, w: 1 },
  fish_rod: { n: 'Fishing rod', kind: 'fish', pw: 2, dur: 60, t: 1, w: .8 }, torch_t: { n: 'Torch', kind: 'light', pw: 1, dur: 240, t: 1, w: .5 },
  fire_starter: { n: 'Flint fire starter', kind: 'fire', pw: 1, dur: 30, t: 1, w: .2 }, wood_hammer: { n: 'Wooden hammer', kind: 'hammer', pw: 1, dur: 40, t: 1, w: 1 },
  needle: { n: 'Sewing needle', kind: 'needle', pw: 1, dur: 30, t: 1, w: .01 }, hand_saw: { n: 'Hand saw', kind: 'saw', pw: 1, dur: 80, t: 2, w: 1 },
  // metal tools
  metal_axe: { n: 'Metal axe', kind: 'axe', pw: 2, dur: 160, t: 3, w: 2.2 }, pickaxe: { n: 'Pickaxe', kind: 'pick', pw: 2, dur: 160, t: 3, w: 3 },
  hammer: { n: 'Hammer', kind: 'hammer', pw: 2, dur: 160, t: 3, w: 1 }, crowbar: { n: 'Crowbar', kind: 'pry', pw: 2, dur: 200, t: 3, w: 2 },
  wrench: { n: 'Wrench', kind: 'wrench', pw: 2, dur: 200, t: 3, w: 1 }, screwdriver: { n: 'Screwdriver', kind: 'driver', pw: 2, dur: 150, t: 3, w: .3 },
  bolt_cutters: { n: 'Bolt cutters', kind: 'cutter', pw: 2, dur: 120, t: 3, w: 2.5 }, pliers: { n: 'Pliers', kind: 'pliers', pw: 2, dur: 150, t: 3, w: .4 },
  wire_cutters: { n: 'Wire cutters', kind: 'pliers', pw: 1, dur: 120, t: 3, w: .4 }, multitool: { n: 'Multitool', kind: 'multi', pw: 2, dur: 140, t: 3, w: .3 },
  welder: { n: 'Welding kit', kind: 'weld', pw: 2, dur: 80, t: 3, w: 4 }, flashlight: { n: 'Flashlight', kind: 'light', pw: 2, dur: 900, t: 3, w: .5 },
  radio: { n: 'Portable radio', kind: 'radio', pw: 2, dur: 400, t: 3, w: 1 }, binoculars: { n: 'Binoculars', kind: 'binoc', pw: 2, dur: 400, t: 3, w: .8 },
  compass: { n: 'Compass', kind: 'compass', pw: 1, dur: 999, t: 2, w: .2 }, climb_gear: { n: 'Climbing gear', kind: 'climb', pw: 2, dur: 200, t: 3, w: 2 },
  // advanced equipment
  rust_detector: { n: 'Rust detector', kind: 'detector', pw: 3, dur: 600, t: 4, w: .6 }, med_scanner: { n: 'Medical scanner', kind: 'scanner', pw: 3, dur: 400, t: 4, w: .8 },
  lock_bypass: { n: 'Electronic lock bypass', kind: 'bypass', pw: 3, dur: 12, t: 4, w: .4 }, solar_charger: { n: 'Portable solar charger', kind: 'charger', pw: 3, dur: 999, t: 3, w: 1 },
  transmitter: { n: 'Signal transmitter', kind: 'transmit', pw: 3, dur: 20, t: 4, w: 1.5 }, repair_drone: { n: 'Repair drone', kind: 'drone', pw: 3, dur: 600, t: 5, w: 3 },
  breather: { n: 'Breathing apparatus', kind: 'breather', pw: 3, dur: 300, t: 4, w: 2 }, diag_pc: { n: 'Diagnostic computer', kind: 'diag', pw: 3, dur: 999, t: 4, w: 3 },
  // weapons (stats live in WDEF, in 2c-weapons.js)
  stone_knife: { n: 'Stone knife', kind: 'weapon', dur: 40, t: 1, w: .3 }, bone_dagger: { n: 'Bone dagger', kind: 'weapon', dur: 35, t: 1, w: .2 },
  hunting_knife: { n: 'Hunting knife', kind: 'knife', pw: 2, dur: 150, t: 2, w: .4 }, mil_knife: { n: 'Combat knife', kind: 'knife', pw: 2, dur: 220, t: 3, w: .4 },
  wood_spear: { n: 'Wooden spear', kind: 'weapon', dur: 40, t: 1, w: 1.5 }, metal_spear: { n: 'Metal spear', kind: 'weapon', dur: 120, t: 2, w: 2 }, hunt_spear: { n: 'Hunting spear', kind: 'weapon', dur: 70, t: 2, w: 1.6 },
  club: { n: 'Club', kind: 'weapon', dur: 60, t: 1, w: 2 }, staff: { n: 'Staff', kind: 'weapon', dur: 80, t: 1, w: 1.5 }, hatchet: { n: 'Hatchet', kind: 'axe', pw: 1, dur: 90, t: 2, w: 1.2 },
  machete: { n: 'Machete', kind: 'weapon', dur: 140, t: 2, w: 1 }, sword: { n: 'Sword', kind: 'weapon', dur: 220, t: 3, w: 1.8 }, war_axe: { n: 'War axe', kind: 'axe', pw: 2, dur: 200, t: 3, w: 2.6 },
  stun_baton: { n: 'Stun baton', kind: 'weapon', dur: 160, t: 3, w: 1 },
  shortbow: { n: 'Shortbow', kind: 'weapon', dur: 120, t: 2, w: 1 }, recurve: { n: 'Recurve bow', kind: 'weapon', dur: 200, t: 2, w: 1.2 }, crossbow: { n: 'Crossbow', kind: 'weapon', dur: 220, t: 3, w: 3 },
  pistol: { n: 'Pistol', kind: 'weapon', dur: 600, t: 3, w: 1 }, revolver: { n: 'Revolver', kind: 'weapon', dur: 700, t: 3, w: 1.3 }, shotgun: { n: 'Shotgun', kind: 'weapon', dur: 400, t: 3, w: 3.5 },
  smg: { n: 'Submachine gun', kind: 'weapon', dur: 900, t: 4, w: 3 }, assault: { n: 'Assault rifle', kind: 'weapon', dur: 1200, t: 4, w: 3.8 }, sniper: { n: 'Sniper rifle', kind: 'weapon', dur: 300, t: 4, w: 5 },
  // (Nov 10, Bryce's models) more guns, bows and blades
  m1911: { n: 'M1911 pistol', kind: 'weapon', dur: 650, t: 3, w: 1.1 }, pump_rifle: { n: 'Lightning pump rifle', kind: 'weapon', dur: 500, t: 3, w: 3.2 },
  pulse_pistol: { n: 'Meridian pulse pistol', kind: 'weapon', dur: 700, t: 6, w: 1 },
  longbow: { n: 'Longbow', kind: 'weapon', dur: 220, t: 2, w: 1.1 }, yumi: { n: 'Yumi', kind: 'weapon', dur: 240, t: 3, w: 1.2 }, hornbow: { n: 'Horn bow', kind: 'weapon', dur: 260, t: 3, w: .9 },
  hunt_recurve: { n: "Hunter's recurve", kind: 'weapon', dur: 280, t: 3, w: 1.3 }, hand_xbow: { n: 'Hand crossbow', kind: 'weapon', dur: 160, t: 3, w: 1.4 },
  heavy_xbow: { n: 'Heavy crossbow', kind: 'weapon', dur: 300, t: 4, w: 5 }, repeat_xbow: { n: 'Repeating crossbow', kind: 'weapon', dur: 200, t: 4, w: 3 },
  kukri: { n: 'Kukri', kind: 'weapon', dur: 180, t: 3, w: .9 }, tomahawk: { n: 'Tactical tomahawk', kind: 'axe', pw: 2, dur: 240, t: 3, w: 1.2 },
  lmg: { n: 'Light machine gun', kind: 'weapon', dur: 1600, t: 4, w: 8 }, flare_gun: { n: 'Flare gun', kind: 'weapon', dur: 200, t: 3, w: .8 },
  grey_rifle: { n: 'Greyhold security rifle', kind: 'weapon', dur: 1600, t: 4, w: 3.6 }, pulse_rifle: { n: 'Meridian pulse rifle', kind: 'weapon', dur: 900, t: 6, w: 3 },
  // wear: slot · prot (damage cut) · fog (Rust resistance) · mob (speed) · stealth (how close enemies get before noticing) · warm (slower hunger) · cap (carry)
  wraps: { n: 'Torn clothing', kind: 'wear', slot: 'body', prot: .04, warm: .05, dur: 40, t: 1, w: .5 }, hide_coat: { n: 'Hide coat', kind: 'wear', slot: 'body', prot: .1, warm: .25, dur: 80, t: 1, w: 3 },
  jacket: { n: 'Leather jacket', kind: 'wear', slot: 'body', prot: .12, warm: .2, dur: 140, t: 2, w: 2 }, hunt_outfit: { n: 'Hunting outfit', kind: 'wear', slot: 'body', prot: .1, warm: .15, stealth: .35, dur: 120, t: 2, w: 2 },
  rain_cloak: { n: 'Rain cloak', kind: 'wear', slot: 'body', prot: .05, warm: .3, fog: .15, dur: 100, t: 2, w: 1.2 }, leather_armor: { n: 'Clan leather armor', kind: 'wear', slot: 'body', prot: .22, warm: .1, dur: 160, t: 2, w: 4 },
  metal_chest: { n: 'Metal chestplate', kind: 'wear', slot: 'body', prot: .36, mob: -.08, dur: 220, t: 2, w: 8 }, arc_jumpsuit: { n: 'Arc jumpsuit', kind: 'wear', slot: 'body', prot: .06, warm: .1, mob: .04, dur: 160, t: 3, w: 1.2 },
  util_vest: { n: 'Utility vest', kind: 'wear', slot: 'body', prot: .1, cap: 12, dur: 160, t: 3, w: 1.5 }, sec_uniform: { n: 'Security uniform', kind: 'wear', slot: 'body', prot: .18, dur: 200, t: 3, w: 3 },
  tac_armor: { n: 'Tactical armor', kind: 'wear', slot: 'body', prot: .42, mob: -.04, cap: 6, dur: 320, t: 3, w: 7 }, hazmat: { n: 'Hazmat suit', kind: 'wear', slot: 'body', prot: .08, fog: .7, mob: -.06, dur: 160, t: 4, w: 4 },
  grey_armor: { n: 'Greyhold security armor', kind: 'wear', slot: 'body', prot: .5, fog: .3, dur: 400, t: 4, w: 8 }, rust_suit: { n: 'Rust suit', kind: 'wear', slot: 'body', prot: .2, fog: .95, mob: -.05, dur: 260, t: 4, w: 5 },
  mil_armor: { n: 'Reinforced military armor', kind: 'wear', slot: 'body', prot: .6, mob: -.06, dur: 500, t: 5, w: 10 }, sealed_suit: { n: 'Sealed environmental suit', kind: 'wear', slot: 'body', prot: .45, fog: 1, warm: .3, dur: 600, t: 6, w: 6 },
  clan_mask: { n: 'Clan bone mask', kind: 'wear', slot: 'head', prot: .05, stealth: .2, dur: 80, t: 2, w: .8 }, gas_mask: { n: 'Gas mask', kind: 'wear', slot: 'head', fog: .6, dur: 200, t: 4, w: 1 },
  helmet: { n: 'Helmet', kind: 'wear', slot: 'head', prot: .14, dur: 260, t: 3, w: 1.5 }, riot_helmet: { n: 'Riot helmet', kind: 'wear', slot: 'head', prot: .2, dur: 320, t: 4, w: 2 },
  nvg: { n: 'Night-vision goggles', kind: 'wear', slot: 'head', nv: 1, dur: 900, t: 4, w: .8 },
  gloves: { n: 'Gloves', kind: 'wear', slot: 'arms', prot: .02, gather: .3, dur: 120, t: 2, w: .2 }, arm_guards: { n: 'Arm guards', kind: 'wear', slot: 'arms', prot: .1, dur: 160, t: 2, w: 1.2 },
  shield: { n: 'Reinforced shield', kind: 'wear', slot: 'arms', prot: .22, mob: -.05, dur: 260, t: 2, w: 5 }, riot_shield: { n: 'Riot shield', kind: 'wear', slot: 'arms', prot: .32, mob: -.07, dur: 400, t: 4, w: 6 },
  boots: { n: 'Boots', kind: 'wear', slot: 'feet', prot: .02, mob: .06, dur: 200, t: 2, w: 1 }, hide_boots: { n: 'Hide boots', kind: 'wear', slot: 'feet', mob: .03, warm: .1, dur: 90, t: 1, w: .8 },
  backpack: { n: 'Backpack', kind: 'wear', slot: 'pack', cap: 30, dur: 999, t: 2, w: 1 }, duffel: { n: 'Duffel bag', kind: 'wear', slot: 'pack', cap: 20, dur: 999, t: 2, w: 1 },
  canteen: { n: 'Water canteen', kind: 'container', dur: 999, t: 2, w: .5 },
};
const WEAR_SLOTS = ['head', 'body', 'arms', 'feet', 'pack'];

/* (Nov 11, Part 3) gentler survival — the knobs live here so they're easy to tune.
   Food and water are two bars. Food used to empty in ~20 min of walking; now ~65. Water is light: drink now and then
   (any lake or river, a canteen), and running dry only stops healing and slows stamina.
   Starving no longer kills: it wears you down to a floor and stops. */
const SURV = {
  drain: .025, sprintK: 1.5, swimK: 1.4,       // food per second while walking (was .08), × while sprinting / swimming
  thirst: .035,                                 // water bar per second (~45 min from full). Empty = no natural healing + slower stamina, never damage
  thirstyAt: 25,                                // a one-time nudge when the water bar gets this low
  starveHp: .25, starveFloor: 12,               // an empty food bar drains health to this floor, never below
  regenAbove: 35,                               // natural healing once you're this fed (was 45)
  sickFood: .04, doseFood: .03,                 // what sickness / Rust poisoning cost the food bar per second
  repairAt: .4,                                 // Repair buttons only show once gear is below this much condition (40%)
  protCut: .2,                                  // 'Hardy' buff: damage taken × (1 − this)
  rainCatch: 40, rainCap: 8,                    // in the rain with a pot/canteen: +1 rainwater every N s, up to this many
};
/* buffs from cooked food — each lasts for the seconds given in FOOD (2b-craft.js) */
const BUFF_DEF = {
  stam: { n: 'Energised', c: '#e0c060', note: 'stamina lasts longer' },
  heal: { n: 'Mending', c: '#80d0a0', note: 'healing over time' },
  prot: { n: 'Hardy', c: '#d09060', note: 'less damage, resists the red fog a little' },
};
/* longer-lasting gear: every tool, weapon and piece of wear lasts this many times longer (packs/canteens never wore out).
   Gear in old saves is stretched to match the first time they load (survLoad). */
const DUR_K = 2.5;
for (const id in GEAR_DEFS) if (GEAR_DEFS[id].dur < 999) GEAR_DEFS[id].dur = Math.round(GEAR_DEFS[id].dur * DUR_K);

/* recipes · at: station (fire · cook · rack · bench · forge · lab · filter) · tool: a tool kind you must carry (wears once) */
const R_ = (o, i, cat, t, extra = {}) => ({ o, i, cat, t, ...extra });
const RECIPES = [
  // materials
  R_('rope', { fiber: 4 }, 'mat', 1), R_('rope', { vine: 3 }, 'mat', 1, { alt: 1 }), R_('thread', { fiber: 3 }, 'mat', 1, { n: 3 }), R_('sharp_rock', { flint: 1 }, 'mat', 1, { n: 2 }),
  R_('plank', { log: 1 }, 'mat', 1, { tool: 'axe' }), R_('plank', { log: 1 }, 'mat', 2, { n: 3, at: 'bench', tool: 'saw' }),
  R_('charcoal', { log: 1 }, 'mat', 1, { n: 2, at: 'fire' }), R_('ash', { stick: 3 }, 'mat', 1, { n: 2, at: 'fire' }), R_('pot', { clay: 3 }, 'mat', 1, { at: 'fire' }),
  R_('hook', { bone: 1 }, 'mat', 1, { n: 2, tool: 'knife' }), R_('leather', { hide: 1, fat: 1 }, 'mat', 2, { at: 'rack' }), R_('leather', { hide: 1, bark: 3 }, 'mat', 2, { at: 'rack', alt: 1 }),
  R_('cloth', { thread: 4 }, 'mat', 2, { n: 2, at: 'bench' }), R_('canvas', { cloth: 3, fat: 1 }, 'mat', 2), R_('fertilizer', { ash: 1, soil: 1, bone: 1 }, 'mat', 2, { n: 2 }),
  R_('fasteners', { nails: 3, screws: 2 }, 'mat', 2, { n: 2 }), R_('copper', { cu_wiring: 2 }, 'mat', 2, { tool: 'knife' }), R_('salt', { water_dirty: 3 }, 'mat', 2, { at: 'cook' }),
  R_('iron', { metal_ore: 2, charcoal: 1 }, 'mat', 3, { at: 'forge' }), R_('iron', { scrap: 3, charcoal: 1 }, 'mat', 3, { at: 'forge', alt: 1 }), R_('steel', { iron: 2, charcoal: 2 }, 'mat', 3, { at: 'forge' }),
  R_('nails', { iron: 1 }, 'mat', 3, { n: 10, at: 'forge' }), R_('screws', { steel: 1 }, 'mat', 3, { n: 8, at: 'forge' }), R_('bolts', { steel: 1 }, 'mat', 3, { n: 5, at: 'forge' }),
  R_('wire', { copper: 1 }, 'mat', 3, { n: 3, at: 'bench', tool: 'pliers' }), R_('pipe', { iron: 2 }, 'mat', 3, { at: 'forge' }), R_('springs', { steel: 1 }, 'mat', 3, { n: 3, at: 'forge' }),
  R_('gears', { steel: 1 }, 'mat', 3, { n: 2, at: 'forge' }), R_('gunpowder', { charcoal: 2, salt: 1, ash: 1 }, 'mat', 3, { n: 5, at: 'bench' }),
  R_('spare_parts', { gears: 1, springs: 1, screws: 2 }, 'mat', 3, { at: 'bench' }), R_('tool_kit', { scrap: 4, screws: 4, leather: 1 }, 'mat', 3, { at: 'bench', tool: 'wrench' }),
  R_('fuel', { fat: 4, charcoal: 1 }, 'mat', 3, { at: 'forge' }), R_('glass', { limestone: 2, ash: 2, charcoal: 2 }, 'mat', 3, { at: 'forge' }),
  // tools
  R_('stone_axe', { stick: 1, stone: 2, fiber: 2 }, 'tool', 1), R_('stone_pick', { stick: 2, stone: 3, rope: 1 }, 'tool', 1), R_('flint_knife', { flint: 2, cloth: 1 }, 'tool', 1),
  R_('flint_knife', { flint: 2, fiber: 2 }, 'tool', 1, { alt: 1 }), R_('bone_knife', { bone: 2, sinew: 1 }, 'tool', 1), R_('wood_shovel', { stick: 2, bark: 2, rope: 1 }, 'tool', 1),
  R_('fish_spear', { stick: 2, flint: 1, fiber: 1 }, 'tool', 1), R_('fish_rod', { stick: 2, fiber: 2, hook: 1 }, 'tool', 1), R_('torch_t', { stick: 1, cloth: 1, fat: 1 }, 'tool', 1),
  R_('fire_starter', { flint: 1, stone: 1 }, 'tool', 1), R_('wood_hammer', { log: 1, stick: 1, rope: 1 }, 'tool', 1), R_('needle', { bone: 1 }, 'tool', 1, { tool: 'knife' }),
  R_('hand_saw', { scrap: 3, stick: 1 }, 'tool', 2, { at: 'bench' }), R_('compass', { iron: 1, glass: 1 }, 'tool', 3, { at: 'bench' }),
  R_('metal_axe', { iron: 2, hardwood: 1, leather: 1 }, 'tool', 3, { at: 'forge' }), R_('pickaxe', { iron: 3, hardwood: 1 }, 'tool', 3, { at: 'forge' }), R_('hammer', { iron: 1, hardwood: 1 }, 'tool', 3, { at: 'forge' }),
  R_('crowbar', { steel: 2 }, 'tool', 3, { at: 'forge' }), R_('wrench', { steel: 1, iron: 1 }, 'tool', 3, { at: 'forge' }), R_('screwdriver', { steel: 1, plank: 1 }, 'tool', 3, { at: 'bench' }),
  R_('pliers', { steel: 1, rubber: 1 }, 'tool', 3, { at: 'forge' }), R_('wire_cutters', { steel: 1, rubber: 1 }, 'tool', 3, { at: 'forge' }), R_('bolt_cutters', { steel: 3, rubber: 1, bolts: 2 }, 'tool', 3, { at: 'forge' }),
  R_('multitool', { steel: 2, screws: 2, springs: 1 }, 'tool', 3, { at: 'bench' }), R_('welder', { battery: 2, cu_wiring: 2, steel: 2, gas_tank: 1 }, 'tool', 3, { at: 'bench' }),
  R_('flashlight', { battery: 1, glass: 1, aluminum: 1, wire: 1 }, 'tool', 3, { at: 'bench' }), R_('radio', { circuit: 1, battery: 1, antenna: 1, wire: 2 }, 'tool', 3, { at: 'bench' }),
  R_('binoculars', { glass: 2, aluminum: 1, rubber: 1 }, 'tool', 3, { at: 'bench' }), R_('climb_gear', { rope: 3, steel: 1, leather: 2 }, 'tool', 3, { at: 'bench' }),
  R_('solar_charger', { solar_cell: 2, wire: 2, circuit: 1 }, 'tool', 3, { at: 'bench' }), R_('canteen', { leather: 2, fiber: 1 }, 'tool', 2),
  R_('rust_detector', { sensor: 1, circuit: 1, battery: 1 }, 'tool', 4, { at: 'bench' }), R_('med_scanner', { sensor: 2, circuit: 1, battery: 1, glass: 1 }, 'tool', 4, { at: 'lab' }),
  R_('lock_bypass', { circuit: 1, battery: 1, wire: 2, sensor: 1 }, 'tool', 4, { at: 'bench', tool: 'driver' }), R_('transmitter', { circuit: 2, antenna: 1, battery: 2 }, 'tool', 4, { at: 'bench' }),
  R_('breather', { rubber: 2, charcoal: 3, aluminum: 1, gas_tank: 1 }, 'tool', 4, { at: 'bench' }), R_('diag_pc', { circuit: 3, battery: 2, glass: 1, aluminum: 2 }, 'tool', 4, { at: 'bench' }),
  R_('repair_drone', { circuit: 2, sensor: 2, battery: 2, arc_alloy: 2, spare_parts: 2 }, 'tool', 5, { at: 'bench' }),
  // weapons + ammo
  R_('stone_knife', { flint: 2, stick: 1, fiber: 1 }, 'weap', 1), R_('bone_dagger', { bone: 2, sinew: 1 }, 'weap', 1), R_('wood_spear', { hardwood: 1 }, 'weap', 1, { tool: 'knife' }),
  R_('club', { hardwood: 1, fiber: 2 }, 'weap', 1), R_('staff', { hardwood: 2 }, 'weap', 1, { tool: 'knife' }), R_('throw_spear', { stick: 2, flint: 1, feather: 2 }, 'weap', 1, { n: 2 }),
  R_('shortbow', { hardwood: 2, sinew: 2 }, 'weap', 2), R_('recurve', { hardwood: 2, bone: 2, sinew: 3, leather: 1 }, 'weap', 2, { at: 'bench' }),
  R_('arrows', { stick: 5, feather: 5, sharp_rock: 5 }, 'weap', 2, { n: 5 }), R_('hunt_spear', { stick: 2, sharp_rock: 1, rope: 1 }, 'weap', 2),
  R_('hatchet', { hardwood: 1, flint: 2, sinew: 1 }, 'weap', 2), R_('machete', { scrap: 3, leather: 1 }, 'weap', 2, { at: 'bench' }), R_('metal_spear', { scrap: 2, stick: 2, rope: 1 }, 'weap', 2, { at: 'bench' }),
  R_('hunting_knife', { iron: 1, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('molotov', { alcohol: 1, cloth: 1 }, 'weap', 2),
  R_('crossbow', { plank: 2, steel: 1, springs: 1, sinew: 3 }, 'weap', 3, { at: 'bench' }), R_('bolts_xb', { stick: 5, iron: 1 }, 'weap', 3, { n: 5, at: 'forge' }),
  R_('sword', { steel: 3, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('war_axe', { steel: 2, hardwood: 1, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('mil_knife', { steel: 1, rubber: 1 }, 'weap', 3, { at: 'forge' }),
  R_('stun_baton', { battery: 2, cu_wiring: 2, rubber: 1, aluminum: 1 }, 'weap', 3, { at: 'bench' }),
  R_('pistol', { steel: 2, springs: 2, spare_parts: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }), R_('revolver', { steel: 3, springs: 1, spare_parts: 1, hardwood: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }),
  R_('shotgun', { pipe: 2, steel: 2, spare_parts: 2, hardwood: 1 }, 'weap', 3, { at: 'bench', tool: 'wrench' }), R_('flare_gun', { pipe: 1, springs: 1, scrap: 2 }, 'weap', 3, { at: 'bench' }),
  R_('smg', { steel: 4, springs: 3, spare_parts: 3, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }), R_('assault', { steel: 5, springs: 3, spare_parts: 4, arc_alloy: 1, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }),
  R_('sniper', { steel: 4, glass: 2, spare_parts: 3, hardwood: 1, tool_kit: 1 }, 'weap', 4, { at: 'bench', tool: 'weld' }), R_('lmg', { steel: 8, springs: 4, spare_parts: 6, arc_alloy: 2, tool_kit: 1 }, 'weap', 5, { at: 'bench', tool: 'weld' }),
  R_('m1911', { steel: 2, springs: 2, spare_parts: 1, rubber: 1 }, 'weap', 3, { at: 'bench', tool: 'driver' }), R_('pump_rifle', { pipe: 1, steel: 3, springs: 2, spare_parts: 2, hardwood: 2 }, 'weap', 3, { at: 'bench', tool: 'wrench' }),
  R_('longbow', { hardwood: 3, sinew: 3, leather: 1 }, 'weap', 2, { tool: 'knife' }), R_('yumi', { hardwood: 3, plank: 1, sinew: 3, leather: 1, rope: 1 }, 'weap', 3, { at: 'bench' }),
  R_('hornbow', { bone: 3, hardwood: 1, sinew: 4, leather: 1 }, 'weap', 3, { at: 'bench' }), R_('hunt_recurve', { hardwood: 2, aluminum: 1, sinew: 3, leather: 1, rubber: 1 }, 'weap', 3, { at: 'bench' }),
  R_('hand_xbow', { plank: 1, steel: 1, springs: 1, sinew: 2 }, 'weap', 3, { at: 'bench' }), R_('heavy_xbow', { plank: 3, steel: 3, springs: 2, gears: 2, rope: 2 }, 'weap', 4, { at: 'bench', tool: 'wrench' }),
  R_('repeat_xbow', { plank: 3, hardwood: 2, springs: 2, sinew: 4, fasteners: 1 }, 'weap', 4, { at: 'bench' }),
  R_('kukri', { steel: 2, leather: 1 }, 'weap', 3, { at: 'forge' }), R_('tomahawk', { steel: 2, rubber: 1, fasteners: 1 }, 'weap', 3, { at: 'forge' }),
  R_('pulse_pistol', { meridian_gear: 1, power_cell: 1, arc_alloy: 2, circuit: 1 }, 'weap', 6, { at: 'bench' }),
  R_('pulse_rifle', { meridian_gear: 1, power_cell: 2, arc_alloy: 3, circuit: 2 }, 'weap', 6, { at: 'bench' }),
  R_('ammo_9', { scrap: 1, gunpowder: 1 }, 'weap', 3, { n: 15, at: 'bench' }), R_('ammo_45', { scrap: 1, gunpowder: 1 }, 'weap', 3, { n: 10, at: 'bench' }),
  R_('ammo_556', { scrap: 2, gunpowder: 2 }, 'weap', 3, { n: 20, at: 'bench' }), R_('ammo_762', { scrap: 2, gunpowder: 2 }, 'weap', 3, { n: 8, at: 'bench' }),
  R_('ammo_12', { scrap: 1, gunpowder: 2, cloth: 1 }, 'weap', 3, { n: 8, at: 'bench' }), R_('ammo_flare', { gunpowder: 1, scrap: 1, fat: 1 }, 'weap', 3, { n: 2, at: 'bench' }),
  R_('smoke_gren', { charcoal: 2, scrap: 1, fiber: 2 }, 'weap', 3, { at: 'bench' }), R_('frag', { gunpowder: 3, scrap: 2, screws: 2 }, 'weap', 3, { at: 'bench' }),
  R_('cell', { power_cell: 1 }, 'weap', 6, { n: 10, at: 'bench' }),
  R_('repair_kit', { scrap: 2, spare_parts: 1, tool_kit: 1 }, 'weap', 3, { at: 'bench' }),
  // clothing + armor
  R_('wraps', { cloth: 3 }, 'wear', 1), R_('hide_coat', { hide: 3, sinew: 2 }, 'wear', 1, { tool: 'needle' }), R_('hide_boots', { hide: 2, sinew: 1 }, 'wear', 1, { tool: 'needle' }),
  R_('jacket', { leather: 4, thread: 2 }, 'wear', 2, { tool: 'needle' }), R_('hunt_outfit', { leather: 3, hide: 2, thread: 2, leaves: 6 }, 'wear', 2, { tool: 'needle' }),
  R_('rain_cloak', { canvas: 2, fat: 2 }, 'wear', 2), R_('leather_armor', { leather: 6, cloth: 3, fiber: 2 }, 'wear', 2, { tool: 'needle' }),
  R_('metal_chest', { scrap: 5, leather: 3, fasteners: 2 }, 'wear', 2, { at: 'bench' }), R_('clan_mask', { bone: 2, leather: 1, feather: 1 }, 'wear', 2),
  R_('war_paint', { charcoal: 1, fat: 1, berries: 1 }, 'wear', 2, { n: 2 }), R_('gloves', { leather: 1, thread: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('arm_guards', { leather: 2, bone: 2 }, 'wear', 2), R_('boots', { leather: 2, rubber: 1, thread: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('backpack', { cloth: 4, leather: 2, fiber: 2 }, 'wear', 2, { tool: 'needle' }), R_('duffel', { canvas: 3, leather: 1, rope: 1 }, 'wear', 2, { tool: 'needle' }),
  R_('shield', { plank: 4, scrap: 3, leather: 2 }, 'wear', 2, { at: 'bench' }),
  R_('util_vest', { canvas: 2, cloth: 2, fasteners: 2 }, 'wear', 3, { at: 'bench' }), R_('arc_jumpsuit', { synth: 3, thread: 2 }, 'wear', 3, { tool: 'needle' }),
  R_('sec_uniform', { synth: 2, cloth: 2, thread: 2 }, 'wear', 3, { tool: 'needle' }), R_('tac_armor', { steel: 3, synth: 3, fasteners: 4 }, 'wear', 3, { at: 'bench' }),
  R_('helmet', { steel: 2, leather: 1, fasteners: 1 }, 'wear', 3, { at: 'forge' }),
  R_('gas_mask', { rubber: 2, charcoal: 3, glass: 1, aluminum: 1 }, 'wear', 4, { at: 'bench' }), R_('hazmat', { rubber: 4, synth: 4, glass: 1 }, 'wear', 4, { at: 'bench', tool: 'needle' }),
  R_('rust_suit', { shielding: 2, rubber: 4, synth: 4, glass: 1 }, 'wear', 4, { at: 'bench' }), R_('nvg', { circuit: 1, sensor: 1, glass: 2, battery: 1 }, 'wear', 4, { at: 'bench' }),
  R_('riot_helmet', { steel: 2, glass: 1, rubber: 1 }, 'wear', 4, { at: 'forge' }), R_('riot_shield', { steel: 3, glass: 2, rubber: 1 }, 'wear', 4, { at: 'forge' }),
  R_('mil_armor', { steel: 4, arc_alloy: 2, synth: 3, fasteners: 4 }, 'wear', 5, { at: 'bench' }), R_('sealed_suit', { shielding: 3, arc_alloy: 2, rubber: 4, battery: 2, circuit: 1 }, 'wear', 6, { at: 'bench' }),
  // food + cooking
  R_('ration', { meat: 1 }, 'food', 1, { at: 'fire' }), R_('roast', { meat: 2, herb: 1 }, 'food', 1, { at: 'fire' }), R_('cooked_fish', { fish: 1 }, 'food', 1, { at: 'fire', alt2: { lake_fish: 1 } }),
  R_('water_boiled', { water_dirty: 1 }, 'food', 1, { at: 'fire' }), R_('water_boiled', { water_rain: 1 }, 'food', 1, { at: 'fire', alt: 1 }),
  R_('stew', { veg: 2, water_boiled: 1 }, 'food', 1, { at: 'fire' }), R_('veg_soup', { greens: 2, roots: 1, water_boiled: 1 }, 'food', 1, { at: 'fire' }),
  R_('fish_soup', { fish: 1, herb: 1, water_boiled: 1 }, 'food', 1, { at: 'fire', alt2: { lake_fish: 1 } }),
  R_('dried_meat', { meat: 2 }, 'food', 1, { n: 2, at: 'rack' }), R_('smoked_fish', { fish: 2 }, 'food', 1, { n: 2, at: 'rack', alt2: { lake_fish: 2 } }),
  R_('oil', { fat: 2 }, 'food', 2, { at: 'fire' }), R_('oil', { corn: 3 }, 'food', 2, { at: 'cook', alt: 1 }), R_('flour', { wheat: 3 }, 'food', 2, { tool: 'hammer' }),
  R_('bread', { flour: 2, water_boiled: 1 }, 'food', 2, { n: 2, at: 'cook' }), R_('water_filtered', { water_dirty: 3, charcoal: 1 }, 'food', 2, { n: 3 }),
  R_('purify_tab', { charcoal: 1, herb: 1 }, 'med', 1, { n: 2 }), R_('water_filtered', { water_rain: 2 }, 'food', 1, { n: 2, alt: 1 }),
  R_('water_filtered', { water_dirty: 1 }, 'food', 2, { at: 'filter', alt: 1 }),
  R_('seed_corn', { corn: 1 }, 'food', 2, { n: 3, tool: 'knife' }), R_('seed_potato', { potato: 1 }, 'food', 2, { n: 2, tool: 'knife' }), R_('seed_wheat', { wheat: 1 }, 'food', 2, { n: 3 }),
  R_('seed_bean', { beans: 1 }, 'food', 2, { n: 3 }), R_('seed_squash', { squash: 1 }, 'food', 2, { n: 4, tool: 'knife' }), R_('seed_carrot', { carrot: 1 }, 'food', 2, { n: 2 }),
  // medicine
  R_('herb_bandage', { cloth: 1, herb_med: 2 }, 'med', 1), R_('bandage', { cloth: 1, water_boiled: 1 }, 'med', 1, { at: 'fire' }), R_('poultice', { herb_med: 2, fat: 1 }, 'med', 1),
  R_('splint', { stick: 2, cloth: 2 }, 'med', 1), R_('painkiller', { bark: 2, water_boiled: 1 }, 'med', 1, { at: 'fire' }),
  R_('alcohol', { corn: 3, pot: 1 }, 'med', 2, { at: 'cook' }), R_('alcohol', { wheat: 3, pot: 1 }, 'med', 2, { at: 'cook', alt: 1 }), R_('alcohol', { berries: 6, pot: 1 }, 'med', 2, { at: 'cook', alt: 1 }),
  R_('disinfect', { alcohol: 1, water_boiled: 1 }, 'med', 2, { n: 2 }), R_('sutures', { thread: 2, alcohol: 1 }, 'med', 2, { n: 3 }),
  R_('medkit', { herb_bandage: 2, disinfect: 1, painkiller: 1 }, 'med', 2), R_('medkit', { bandage: 2, disinfect: 1, painkiller: 1 }, 'med', 2, { alt: 1 }),
  R_('antibiotic', { mushroom: 3, alcohol: 1, pot: 1 }, 'med', 3, { n: 2, at: 'lab' }), R_('surgical_kit', { sutures: 2, disinfect: 1, steel: 1 }, 'med', 3, { at: 'lab' }),
  R_('iv', { med_parts: 1, water_filtered: 2, sutures: 1 }, 'med', 3, { at: 'lab' }),
  R_('rust_med', { lab_sample: 1, herb_med: 3, alcohol: 1 }, 'med', 4, { at: 'lab' }), R_('inject', { lab_sample: 1, med_parts: 1, alcohol: 1 }, 'med', 4, { n: 2, at: 'lab' }),
  R_('serum', { blackvein: 1, med_parts: 2, inject: 1 }, 'med', 5, { at: 'lab' }),
];

/* placeables (made into kits, then placed — see 2d-build.js for what each one does) */
const BUILD_LIST = [
  ['campfire', 'Campfire', 1, { stone: 6, stick: 5 }], ['sleeping_mat', 'Sleeping mat', 1, { fiber: 8, leaves: 6 }], ['tent', 'Tent', 1, { stick: 6, hide: 3, rope: 2 }],
  ['wood_shelter', 'Wooden shelter', 1, { log: 6, stick: 8, rope: 3, leaves: 6 }], ['storage_chest', 'Storage chest', 1, { log: 2, plank: 2, rope: 1 }],
  ['drying_rack', 'Drying rack', 1, { stick: 6, rope: 2 }], ['cooking_rack', 'Cooking rack', 1, { stick: 6, stone: 4, pot: 1 }], ['water_collector', 'Water collector', 1, { stick: 4, hide: 2, pot: 1 }],
  ['palisade', 'Wooden palisade', 1, { log: 4, stick: 4 }], ['spikes', 'Spike barricade', 1, { stick: 8, rope: 2 }], ['watchtower', 'Watchtower', 1, { log: 10, rope: 6, plank: 4 }],
  ['wood_wall', 'Wooden wall', 2, { log: 6, rope: 2 }], ['storage_crate', 'Storage crate', 2, { plank: 5, nails: 4 }], ['rain_coll', 'Rain collector', 2, { scrap: 4, cloth: 2, pot: 1 }],
  ['cook_station', 'Cooking station', 2, { stone: 8, scrap: 3 }], ['workshop', 'Workshop', 2, { plank: 6, scrap: 4, fasteners: 2 }], ['farm_plot', 'Farm plot', 2, { log: 2, soil: 4, stick: 4 }],
  ['greenhouse', 'Greenhouse plot', 2, { plank: 4, soil: 3, cloth: 2 }], ['water_filter', 'Water filter', 2, { charcoal: 2, cloth: 1, pot: 1 }],
  ['chair', 'Chair', 2, { plank: 2, nails: 2 }], ['table', 'Table', 2, { plank: 4, nails: 4 }], ['bed', 'Bed', 2, { plank: 4, cloth: 4, hide: 2 }], ['shelves', 'Shelves', 2, { plank: 4, nails: 2 }],
  ['lantern', 'Lantern', 2, { scrap: 2, fat: 2, glass: 1 }], ['weapon_rack', 'Weapon rack', 2, { plank: 3, nails: 2 }], ['map_table', 'Map table', 2, { plank: 4, nails: 2, map: 1 }],
  ['bookshelf', 'Bookshelf', 2, { plank: 4, notebook: 2 }],
  ['forge', 'Forge', 3, { stone: 20, clay: 8, log: 4 }], ['metal_wall', 'Metal wall', 3, { scrap: 6, steel: 1, fasteners: 2 }], ['door', 'Reinforced door', 3, { steel: 3, plank: 4, bolts: 4 }],
  ['lockers', 'Lockers', 3, { steel: 2, fasteners: 2 }], ['ammo_box', 'Ammunition storage', 3, { scrap: 3, fasteners: 1 }], ['metal_crate', 'Metal crate', 3, { scrap: 6, bolts: 2 }],
  ['barracks', 'Barracks', 3, { plank: 12, nails: 10, cloth: 6, hide: 4 }], ['med_station', 'Medical station', 3, { scrap: 4, medkit: 2, plank: 4 }],
  ['generator', 'Generator', 3, { engine_part: 1, scrap: 6, cu_wiring: 2 }], ['solar_panel', 'Solar panels', 3, { solar_cell: 3, aluminum: 2, wire: 2 }],
  ['radio_tower', 'Radio tower', 3, { circuit: 2, wire: 4, battery: 1, antenna: 1 }],
  ['turret', 'Security station', 4, { circuit: 2, sensor: 2, steel: 4, battery: 2 }], ['lab', 'Research lab', 4, { diag_pc: 1, glass: 2, steel: 4, med_parts: 2 }],
];
const BUILD_N = {}; for (const [id, n, t] of BUILD_LIST) { BUILD_N[id] = n; ITEMS[id] = { id, n, c: 'build', t, src: 'craft', w: 2 }; RECIPES.push(R_(id, BUILD_LIST.find(b => b[0] === id)[3], 'build', t)); }
for (const id of ['palisade', 'spikes', 'wood_wall', 'metal_wall', 'door']) RECIPES.find(r => r.o === id).n = 2;

const VEG = ['roots', 'greens', 'mushroom', 'potato', 'carrot', 'squash', 'corn', 'beans'];
const RCATS = [['mat', 'Materials'], ['tool', 'Tools'], ['weap', 'Weapons'], ['wear', 'Clothing'], ['food', 'Food'], ['med', 'Medicine'], ['build', 'Building']];
const nameOf = id => ITEMS[id]?.n || GEAR_DEFS[id]?.n || id;
const STATION_N = { fire: 'Fire', cook: 'Cooking station', rack: 'Drying rack', bench: 'Workbench', forge: 'Forge', lab: 'Lab', filter: 'Water filter' };
const CAT_N = { wood: 'Wood', stone: 'Stone & earth', fiber: 'Plant fibers', metal: 'Metals', animal: 'Animal', textile: 'Textiles', elec: 'Electronics', indus: 'Industrial', rare: 'Rare salvage',
  food: 'Food', seed: 'Seeds', water: 'Water', med: 'Medicine', doc: 'Documents', story: 'Relics & keys', ammo: 'Ammunition', build: 'To place' };
const SRC_N = { ren: 'Renewable', salv: 'Salvage only', craft: 'Crafted', story: 'Story item' };
const LORE = {
  insignia: 'Thornkin clan mark. Studying it teaches the clans’ craft — Tier 2.', id_chip: 'An Arc crew chip. Opens Arc lockers and the old ring’s manuals — Tier 3.',
  greyhold_card: 'A Greyhold security card. Opens the Grey Door and Greyhold technology — Tier 4.', arden_notes: 'Dr. Sel Arden’s research, from before Sunfall — Tier 5.',
  gate_codes: 'Coordinates and sequences for the Gate Stone. Meridian technology — Tier 6.', ember: 'A warm, humming relic. Carrying it, wounds close faster and the Rust can’t touch you.',
  blackvein: 'Blood that the Rust doesn’t poison. A lab can make a serum from it.', wristband: 'Arc vitals band — shows how long your injuries will last.',
  nav_console: 'Lander navigation data — reveals every landmark on the map.', map: 'An old-world map — reveals every named place.', halcyon_chip: 'It whispers about a Quiet City.',
  sunfall_data: 'The sun will flare again. Night 100 is the warning.', lantern_key: 'Opens the Lantern vault, if anyone can find it.', spindle: 'A mind spindle. Nobody knows what it holds.',
  meridian_gear: 'Equipment from a ship that never came back. A bench can build a pulse rifle from it.', greyhold_files: 'Greyhold’s medical files — their labs made the Rust medicine.',
};
/* ---------- icons: one glyph per category, tinted per item ---------- */
const GLYPH = {
  wood: c => `<rect x="2" y="6" width="12" height="5" rx="2.5" fill="${c}" stroke="#000"/><circle cx="13" cy="8.5" r="2" fill="#d8b888" stroke="#000"/>`,
  stone: c => `<path d="M2 12l2-6 5-3 5 4 0 5z" fill="${c}" stroke="#000"/>`,
  fiber: c => `<path d="M8 14V5M8 14L4 4M8 14l4-10M8 14L2 8M8 14l6-6" stroke="${c}" stroke-width="1.6" fill="none"/>`,
  metal: c => `<path d="M2 5l6-3 6 3v6l-6 3-6-3z" fill="${c}" stroke="#000"/><path d="M2 5l6 3 6-3M8 8v6" stroke="#000" fill="none"/>`,
  animal: c => `<path d="M4 4a1.6 1.6 0 1 1 2 2l4 4a1.6 1.6 0 1 1 2 2 1.6 1.6 0 1 1-2-2L6 6a1.6 1.6 0 1 1-2-2z" fill="${c}" stroke="#000" stroke-width=".8"/>`,
  textile: c => `<path d="M3 3h10l-1 10H4z" fill="${c}" stroke="#000"/><path d="M5 6h6M5 9h6" stroke="#0006"/>`,
  elec: c => `<rect x="3" y="3" width="10" height="10" rx="1" fill="${c}" stroke="#000"/><path d="M6 6h4v4H6zM1 6h2M1 10h2M13 6h2M13 10h2" stroke="#000" fill="none"/>`,
  indus: c => `<circle cx="8" cy="8" r="5" fill="${c}" stroke="#000"/><circle cx="8" cy="8" r="2" fill="#0007"/>`,
  rare: c => `<path d="M8 1l5 5-5 9-5-9z" fill="${c}" stroke="#000"/><path d="M3 6h10" stroke="#fff6"/>`,
  food: c => `<path d="M3 9c0-4 4-7 8-6 3 1 3 5 0 7-2 2-5 3-7 2z" fill="${c}" stroke="#000"/>`,
  water: c => `<path d="M8 2C6 6 4 8 4 10.5a4 4 0 0 0 8 0C12 8 10 6 8 2z" fill="${c}" stroke="#000"/>`,
  med: c => `<rect x="2" y="3" width="12" height="10" rx="2" fill="${c}" stroke="#000"/><path d="M8 5v6M5 8h6" stroke="#c0302a" stroke-width="2"/>`,
  seed: c => `<path d="M8 2c4 3 4 9 0 12-4-3-4-9 0-12z" fill="${c}" stroke="#000"/>`,
  doc: c => `<rect x="3" y="2" width="10" height="12" fill="${c}" stroke="#000"/>`,
  ammo: c => `<path d="M4 14V6l1.5-4L7 6v8zM9 14V6l1.5-4L12 6v8z" fill="${c}" stroke="#000" stroke-width=".8"/>`,
  story: c => `<path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" fill="${c}" stroke="#000" stroke-width=".8"/>`,
  tool: c => `<path d="M3 14l7-7" stroke="#8a6a44" stroke-width="2"/><path d="M8 3l5 1 1 5-3-1-3 1z" fill="${c}" stroke="#000"/>`,
  wear: c => `<path d="M5 2h6l3 3-2 2v7H4V7L2 5z" fill="${c}" stroke="#000"/>`,
  build: c => `<path d="M2 8l6-5 6 5v6H2z" fill="${c}" stroke="#000"/><path d="M6 14v-4h4v4" stroke="#000" fill="none"/>`,
};
// painted item icons in assets/icons (ICON_IDS is generated by build.sh from that folder); anything missing falls back to a drawn glyph
const ICON_TINT = { ration: 'sepia(.7) saturate(1.4) brightness(.72)', roast: 'sepia(.8) saturate(1.5) brightness(.6)', cooked_fish: 'sepia(.6) brightness(.85)', smoked_fish: 'sepia(.9) brightness(.7)',
hardwood: 'brightness(.75) saturate(1.2)', stick: 'brightness(1.15) saturate(.8)', limestone: 'grayscale(1) brightness(1.4)', 
  stone_pick: 'sepia(.4) brightness(.8)', flint_knife: 'grayscale(.8) brightness(.7)', stone_knife: 'grayscale(.9) brightness(.6)', bone_knife: 'sepia(.6) brightness(1.3)', bone_dagger: 'sepia(.6) brightness(1.3)',
  water_dirty: 'sepia(.7) hue-rotate(40deg) brightness(.75)', water_rain: 'hue-rotate(-20deg) brightness(1.1)', fish_soup: 'sepia(.3) brightness(1.15)', veg_soup: 'hue-rotate(40deg)',
  mil_knife: 'grayscale(1) brightness(.6)', hunting_knife: 'sepia(.3)', wood_spear: 'sepia(.5) brightness(.9)', metal_spear: 'grayscale(.6) brightness(1.1)', staff: 'brightness(.8)', recurve: 'sepia(.3) brightness(.85)',
  grey_rifle: 'grayscale(.6) brightness(1.3)', hide_coat: 'sepia(.6) brightness(1.1)', rain_cloak: 'hue-rotate(160deg) saturate(.6)', wraps: 'grayscale(.6) brightness(1.1)', hide_boots: 'sepia(.5) brightness(1.15)',
  metal_chest: 'sepia(.4) brightness(.9)', sec_uniform: 'grayscale(.4) brightness(1.1)', grey_armor: 'grayscale(.9) brightness(1.2)', mil_armor: 'brightness(.75)', rust_suit: 'hue-rotate(-30deg) saturate(1.3)',
  sealed_suit: 'grayscale(.8) brightness(1.3)', riot_shield: 'brightness(1.2)', clan_mask: 'sepia(.9) brightness(1.2)', arc_alloy: 'hue-rotate(180deg) saturate(.6) brightness(1.2)', shielding: 'sepia(.8) saturate(1.5)',
  synth: 'hue-rotate(200deg) saturate(1.5)', thread: 'grayscale(.6) brightness(1.4)', bread: 'sepia(.7) brightness(.95)', lake_fish: 'hue-rotate(20deg)', shellfish: 'sepia(.6) hue-rotate(-20deg)',
  nuts: 'sepia(.4) brightness(.9)', greens: 'hue-rotate(20deg)', squash: 'sepia(.5) saturate(2) hue-rotate(-10deg)', shield: 'sepia(.5) brightness(.9)', palisade: 'brightness(.85)',
  drying_rack: 'sepia(.5)', cook_station: 'grayscale(.4)', storage_crate: 'sepia(.3) brightness(1.1)', ammo_box: 'hue-rotate(60deg) saturate(.6)' };
function icon(id) {
  if (ICON_IDS.has(id)) return `<img class="ic" src="assets/icons/${id}.png" alt="" draggable="false"${ICON_TINT[id] ? ` style="filter:${ICON_TINT[id]}"` : ''}>`;
  const I = ITEMS[id], D = GEAR_DEFS[id];
  const g = I ? GLYPH[I.c] || GLYPH.indus : D ? (D.kind === 'wear' ? GLYPH.wear : GLYPH.tool) : GLYPH.build;
  const col = I ? '#a8a090' : D ? (D.salv ? '#b8c0c6' : '#9a968e') : '#a07a4e';
  return `<svg viewBox="0 0 16 16">${g(col)}</svg>`;
}

/* ================= inventory, gear, crafting, food, injuries, gathering, loot ================= */

/* ---------- counts (scrap / meat / cooked meat / the two rifle calibres keep their old INV slots) ---------- */
const LINK = { scrap: 'scrap', meat: 'meat', ration: 'rations', ammo_556: 'res', ammo_762: 'resH' };
function invInit() {
  INV.items = INV.items && typeof INV.items === 'object' ? INV.items : {}; INV.tools = Array.isArray(INV.tools) ? INV.tools : [];
  INV.uid = INV.uid || 1; for (const t of INV.tools) if (!t.u) t.u = INV.uid++;
  INV.tools = INV.tools.filter(t => GEAR_DEFS[t.id]);
  for (const k in INV.items) if (!ITEMS[k]) delete INV.items[k];
}
function cnt(id) {
  if (id === 'veg') return VEG.reduce((a, v) => a + cnt(v), 0);
  const k = LINK[id]; if (k) return INV[k] || 0;
  if (GEAR_DEFS[id]) return INV.tools.filter(t => t.id === id).length;
  return INV.items[id] || 0;
}
function give(id, n = 1, q) {
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) newGear(id, q); return; }
  const k = LINK[id]; if (k) { INV[k] = Math.max(0, (INV[k] || 0) + n); return; }
  const was = INV.items[id] || 0, v = was + n; if (v > 0) INV.items[id] = v; else delete INV.items[id];
  if (n > 0 && !was && TIER_KEYS[id]) unlockTier(TIER_KEYS[id], id);
  if (n > 0 && !was && (id === 'map' || id === 'nav_console')) revealAll(id);
}
const busy = t => t.on || (INV.eq && INV.eq.includes(t.u));
function take(id, n) {
  if (id === 'veg') { for (const v of VEG) { const m = Math.min(n, cnt(v)); if (m) { take(v, m); n -= m; } if (!n) break; } return; }
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) { let j = INV.tools.findIndex(t => t.id === id && !busy(t)); if (j < 0) j = INV.tools.findIndex(t => t.id === id); if (j >= 0) unequip(INV.tools.splice(j, 1)[0]); } return; }
  give(id, -n);
}
function newGear(id, q, wear = 0) {
  const D = GEAR_DEFS[id]; if (q == null) { const r = rnd(); q = r < .22 ? 0 : r < .85 ? 1 : 2; }
  const max = Math.round(D.dur * QUAL[q].k), g = { id, q, max, d: Math.max(1, Math.round(max * (1 - wear))), u: INV.uid = (INV.uid || 1) + 1 };
  INV.tools.push(g);
  if (D.kind === 'wear' && !INV.tools.some(t => t.on && GEAR_DEFS[t.id].slot === D.slot)) g.on = true;
  if (typeof autoEquip === 'function') autoEquip(g);
  return g;
}
function unequip(g) { g.on = false; if (INV.eq) INV.eq = INV.eq.map(u => u === g.u ? null : u); }
const bestTool = kind => { let b = null; for (const t of INV.tools) { const D = GEAR_DEFS[t.id]; if (D.kind !== kind && !(D.kind === 'multi' && ['knife', 'pliers', 'driver'].includes(kind))) continue; const pw = D.pw || 1, bp = b ? GEAR_DEFS[b.id].pw || 1 : -1; if (!b || pw > bp || (pw === bp && t.d > b.d)) b = t; } return b; };
let lastTool = null;
function wearTool(t, n = 1) {
  if (!t) return; t.d -= n; if (GEAR_DEFS[t.id].kind !== 'wear') lastTool = t;
  if (t.d > 0 && t.d <= t.max * .15 && !t.warned) { t.warned = 1; toast(`${GEAR_DEFS[t.id].n} is wearing out — Repair in the bag (E)`, 3); }
  if (t.d <= 0) { INV.tools.splice(INV.tools.indexOf(t), 1); unequip(t); sfx('no'); toast(`${QUAL[t.q].n} ${GEAR_DEFS[t.id].n.toLowerCase()} broke`, 2.6); if (lastTool === t) lastTool = null; if (typeof onGearBroke === 'function') onGearBroke(t); }
}
const has = kind => !!bestTool(kind);

/* ---------- wear: five slots, stats add up ---------- */
const wornAll = () => INV.tools.filter(t => t.on && GEAR_DEFS[t.id].kind === 'wear');
function wearStat(k) { let v = 0; for (const t of wornAll()) v += GEAR_DEFS[t.id][k] || 0; return v; }
function toggleWear(g) {
  const D = GEAR_DEFS[g.id]; if (D.kind !== 'wear') return;
  if (g.on) { g.on = false; return; }
  for (const t of INV.tools) if (t.on && GEAR_DEFS[t.id].slot === D.slot) t.on = false;
  g.on = true; sfx('pickup');
}
function hurtWear(n) { for (const t of wornAll()) if (GEAR_DEFS[t.id].prot) wearTool(t, n); }

/* ---------- carry weight ---------- */
const carryCap = () => G.flags.dev ? 1e9 : 45 + wearStat('cap');
function carryLoad() {
  let w = 0;
  for (const [id, n] of Object.entries(INV.items)) w += (ITEMS[id]?.w ?? .2) * n;
  for (const id in LINK) w += (ITEMS[id]?.w || 0) * cnt(id);
  for (const t of INV.tools) w += GEAR_DEFS[t.id].w || 1;
  return Math.round(w * 10) / 10;
}
let loadT = 0;
function updLoad(dt) { loadT -= dt; if (loadT > 0) return; loadT = .5; const was = P.over; P.over = carryLoad() > carryCap(); if (P.over && !was) toast('Overloaded — you\'re slower. Drop or store something, or wear a pack', 3.2); }

/* ---------- tiers open when you find their key ---------- */
const tierNow = () => G.flags.tier || 1;
const tierOpen = t => t <= tierNow();
function unlockTier(t, id) {
  if (t <= tierNow()) return; G.flags.tier = t;
  setTimeout(() => { card(`TIER ${t} · ${TIERS[t].toUpperCase()}`, `${nameOf(id)} studied — new recipes in the craft menu`, 4.5); music.sting?.('sting-drum-hit', .4); }, 600);
  save();
}
function revealAll(id) {
  const seen = G.flags.seen = G.flags.seen || {};
  for (const R of REGIONS) if (!R.area && !R.river) seen[R.id] = 1;
  if (id === 'nav_console' || id === 'map') { G.flags.mapAll = 1; toast(id === 'map' ? 'The old map marks every named place' : 'The console lists every landing site and ruin', 3); }
}

/* ---------- stations ---------- */
const FIXED_ST = () => { const st = { fire: [[SPOTS.fire, 4.2]], cook: [[SPOTS.fire, 4.2]], rack: [[SPOTS.smoke, 4.6]], forge: [[SHOP.craft.forge, 3.4]] };
  for (const D of SHOP_DEFS) for (const k of D.st) (st[k] = st[k] || []).push([D.spot, 3.8]);
  return st; };
function nearStation(kind) {
  for (const [p, r] of FIXED_ST()[kind] || []) if (Math.hypot(P.x - p.x, P.z - p.z) < r) return true;
  if (typeof PLACED === 'undefined') return false;
  for (const p of PLACED) { const B = BUILD_DEF[p.k]; if (B && B.st && B.st.includes(kind) && Math.hypot(P.x - p.x, P.z - p.z) < (B.str || 3.6) && (!B.needPower || powered())) return true; }
  for (const S of FACTION_ST) if (S.st.includes(kind) && Math.hypot(P.x - S.x, P.z - S.z) < 4) return true;
  return false;
}
const FACTION_ST = [];                         // benches/forges in friendly bases (filled by the city/bases builder)

/* ---------- crafting ---------- */
function recipeIns(r) {
  if (!r.alt2) return Object.entries(r.i);
  const [k0, n0] = Object.entries(r.i)[0];
  if (cnt(k0) >= n0) return Object.entries(r.i);
  return [...Object.entries(r.alt2), ...Object.entries(r.i).slice(1)];
}
function recipeState(r) {
  const ins = recipeIns(r);
  const miss = ins.some(([k, n]) => cnt(k) < n), stOK = !r.at || nearStation(r.at), toolOK = !r.tool || has(r.tool);
  return { ins, miss, stOK, toolOK, open: tierOpen(r.t), ok: tierOpen(r.t) && !miss && stOK && toolOK };
}
function craft(r, times = 1) {
  let made = 0;
  for (let k = 0; k < times; k++) {
    const s = recipeState(r);
    if (!s.open) { sfx('no'); toast(`Tier ${r.t}: ${TIER_HOW[r.t]}`, 3.4); break; }
    if (s.miss) { if (!made) { sfx('no'); toast('Missing materials'); } break; }
    if (!s.stOK) { sfx('no'); toast(`Needs a ${STATION_N[r.at].toLowerCase()}`); break; }
    if (!s.toolOK) { sfx('no'); toast(`Needs a ${r.tool === 'weld' ? 'welding kit' : r.tool === 'driver' ? 'screwdriver' : r.tool}`); break; }
    for (const [k2, n] of s.ins) take(k2, n);
    if (r.tool) wearTool(bestTool(r.tool));
    if (GEAR_DEFS[r.o]) {
      let q = null; if (nearStation('bench') || nearStation('forge')) { const x = rnd(); q = x < .08 ? 0 : x < .68 ? 1 : 2; }
      const g = newGear(r.o, q); toast(`${QUAL[g.q].n} ${GEAR_DEFS[r.o].n.toLowerCase()} · ${g.max} uses`, 2.6);
    } else give(r.o, r.n || 1);
    made++;
  }
  if (!made) return;
  if (!GEAR_DEFS[r.o]) toast(`+${(r.n || 1) * made} ${nameOf(r.o)}`, 1.8);
  sfx(r.at === 'fire' || r.at === 'cook' ? 'eat' : 'buy');
  save(); renderInv();
}

/* ---------- food: variety matters, raw/dirty things can make you sick ---------- */
const FOOD = {
  // (Part 3) cooked food gives buffs — b: { stam | heal | prot: seconds } (BUFF_DEF in 2a-data.js); raw food still risks sickness
  ration: { f: 0, h: 0, k: 'meat', ration: 1, b: { prot: 180 } }, dried_meat: { f: 42, h: 10, k: 'meat', b: { prot: 180 } }, roast: { f: 60, h: 16, k: 'meat', b: { prot: 300, heal: 120 } }, meat: { f: 14, h: 0, k: 'meat', risk: .35 },
  cooked_fish: { f: 32, h: 10, k: 'fish', b: { stam: 240 } }, smoked_fish: { f: 38, h: 10, k: 'fish', b: { stam: 240 } }, fish: { f: 10, h: 0, k: 'fish', risk: .3 }, lake_fish: { f: 10, h: 0, k: 'fish', risk: .3 }, shellfish: { f: 12, h: 2, k: 'fish', risk: .2 },
  berries: { f: 8, h: 2, k: 'plant' }, blueberries: { f: 8, h: 3, k: 'plant' }, nuts: { f: 12, h: 2, k: 'plant' }, greens: { f: 7, h: 3, k: 'plant' }, roots: { f: 10, h: 1, k: 'plant', risk: .08 },
  mushroom: { f: 9, h: 0, k: 'plant', risk: .22 }, potato: { f: 12, h: 2, k: 'plant', risk: .1 }, carrot: { f: 9, h: 3, k: 'plant' }, corn: { f: 10, h: 2, k: 'plant' }, squash: { f: 14, h: 3, k: 'plant' }, honey: { f: 15, h: 6, k: 'plant', b: { heal: 120 } },
  stew: { f: 46, h: 22, k: 'meal', b: { heal: 300, prot: 180 } }, veg_soup: { f: 40, h: 22, k: 'meal', b: { heal: 300 } }, fish_soup: { f: 52, h: 24, k: 'meal', b: { heal: 300, stam: 300 } }, bread: { f: 30, h: 6, k: 'meal', b: { stam: 300 } }, canned: { f: 40, h: 8, k: 'meal' }, arc_pack: { f: 35, h: 10, k: 'meal', b: { stam: 120 } },
  water_dirty: { f: 0, w: 30, h: 0, k: 'water', risk: .2 }, water_boiled: { f: 0, w: 45, h: 5, k: 'water', b: { stam: 90 } }, water_filtered: { f: 0, w: 45, h: 6, k: 'water', b: { stam: 90 } }, water_rain: { f: 0, w: 40, h: 4, k: 'water' },
};
const DIET_N = 6;
function eatItem(id, quiet) {
  const F = FOOD[id]; if (!F || cnt(id) <= 0) return false;
  if (P.food >= 99 && F.k !== 'water' && !quiet) { toast('Not hungry'); return false; }
  if (F.k === 'water' && (P.water ?? 100) >= 99 && !quiet) { toast('Not thirsty'); return false; }
  take(id, 1);
  let [f, h] = F.ration ? RATION() : [F.f, F.h];
  P.diet = P.diet || [];
  const same = P.diet.filter(k => k === F.k).length, mult = F.k === 'water' ? 1 : Math.max(.45, 1 - same * .16);
  f = Math.round(f * mult);
  P.diet.push(F.k); if (P.diet.length > DIET_N) P.diet.shift();
  P.food = Math.min(100, P.food + f); P.hp = Math.min(100, P.hp + h);
  const hasP = P.diet.some(k => k === 'meat' || k === 'fish'), hasV = P.diet.some(k => k === 'plant' || k === 'meal'), hasW = P.diet.includes('water');
  if (F.w) { P.water = Math.min(100, (P.water ?? 100) + F.w); P.thirstWarn = 0; }
  let note = F.w ? `+${F.w} water` : `+${f} food`;
  if (mult < .8) note += ' · same food again, less filling';
  if (hasP && hasV && hasW && !(P.fed > 0)) { P.fed = 240; note += ' · well fed'; }
  if (F.risk && rnd() < F.risk) { P.sick = Math.max(P.sick || 0, 45); note = 'That was bad. You feel sick.'; sfx('cough'); }
  else { sfx('eat'); if (F.b) { P.buffs = P.buffs || {}; for (const k in F.b) P.buffs[k] = Math.max(P.buffs[k] || 0, F.b[k]); note += ' · ' + Object.keys(F.b).map(k => `${BUFF_DEF[k].n} (${BUFF_DEF[k].note})`).join(' · '); } }
  toast(note, 2.2);
  return true;
}
function eatBest() {
  // thirsty and carrying clean water? drink first
  if ((P.water ?? 100) < 60) { const d = ['water_filtered', 'water_boiled', 'water_rain'].find(id => cnt(id) > 0); if (d) { eatItem(d); return; } }
  const have = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water' && !FOOD[id].risk);
  if (!have.length) { const raw = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water'); if (!raw.length) { sfx('no'); toast('Nothing to eat — hunt, forage or cook'); return; } toast('Only raw food left — cook it at a fire first', 2.4); return; }
  const seen = k => (P.diet || []).filter(x => x === k).length;
  have.sort((a, b) => seen(FOOD[a].k) - seen(FOOD[b].k) || (FOOD[b].f || 40) - (FOOD[a].f || 40));
  eatItem(have[0]);
}
const foodCount = () => Object.keys(FOOD).reduce((a, id) => a + (FOOD[id].k !== 'water' && !FOOD[id].risk ? cnt(id) : 0), 0);

/* ---------- injuries: bleeding, fractures, sickness, the Rust — each wants its own fix ---------- */
const MEDS = {
  herb_bandage: { h: 15, fix: ['bleed'] }, bandage: { h: 20, fix: ['bleed'] }, splint: { h: 0, fix: ['frac'] }, poultice: { h: 5, fix: ['sick'] },
  antibiotic: { h: 10, fix: ['sick'] }, disinfect: { h: 5, fix: ['sick'] }, painkiller: { h: 25, fix: [] }, medkit: { h: 60, fix: ['bleed', 'sick', 'frac'] },
  surgical_kit: { h: 35, fix: ['bleed', 'frac'] }, iv: { h: 45, fix: [] }, blood_bag: { h: 55, fix: ['bleed'] },
  rust_med: { h: 10, fix: ['dose'] }, inject: { h: 0, fix: [], fn: () => { P.immune = 600; return 'protected from the Rust for 10 minutes'; } },
  serum: { h: 30, fix: ['dose'], fn: () => { G.flags.serum = 1; return 'the Rust can’t hurt you any more'; } },
  war_paint: { h: 0, fix: [], fn: () => { P.paint = 600; return 'painted — the clans notice you later'; } },
  purify_tab: { h: 0, fix: [], fn: () => { const n = Math.min(3, cnt('water_dirty')); if (!n) return 'nothing to purify'; take('water_dirty', n); give('water_filtered', n); return `${n} water purified`; } },
};
function useMed(id) {
  const M0 = MEDS[id]; if (!M0 || cnt(id) <= 0) return false;
  const fixes = M0.fix.filter(k => P[k] > 0);
  if (!fixes.length && P.hp >= 99 && !M0.fn) { toast("You don't need that right now"); return false; }
  take(id, 1); for (const k of fixes) P[k] = 0; P.hp = Math.min(100, P.hp + M0.h);
  const extra = M0.fn ? M0.fn() : '';
  sfx('pickup'); toast([M0.h ? `+${M0.h} health` : '', fixes.map(k => ({ bleed: 'bleeding stopped', frac: 'leg splinted', sick: 'fever breaking', dose: 'Rust flushed out' })[k]).join(' · '), extra].filter(Boolean).join(' · '), 2.6);
  return true;
}
function healBest() {
  const want = ['bleed', 'frac', 'sick', 'dose'].filter(k => P[k] > (k === 'dose' ? 20 : 0));
  const ids = Object.keys(MEDS).filter(id => cnt(id) > 0 && !MEDS[id].fn);
  let pickId = null;
  for (const w of want) { pickId = ids.filter(id => MEDS[id].fix.includes(w)).sort((a, b) => MEDS[a].fix.length - MEDS[b].fix.length)[0]; if (pickId) break; }
  if (!pickId && P.hp < 85) pickId = ids.filter(id => MEDS[id].h > 0).sort((a, b) => MEDS[a].h - MEDS[b].h)[0];
  if (!pickId) { sfx('no'); toast(want.length ? `Nothing here treats ${{ frac: 'a fracture — make a splint', bleed: 'bleeding — make a bandage', sick: 'sickness — make a poultice', dose: 'Rust poisoning — find Rust medicine' }[want[0]]}` : 'Nothing to treat'); return; }
  useMed(pickId);
}
const medCount = () => Object.keys(MEDS).reduce((a, id) => a + (MEDS[id].fn ? 0 : cnt(id)), 0);
function clearInjuries() { P.bleed = 0; P.frac = 0; P.sick = 0; P.dose = 0; }
function onHurt(n, melee) {
  n *= 1 - Math.min(.8, wearStat('prot')); hurtWear(1);
  if (cnt('ember')) n *= .8;
  if (P.buffs && P.buffs.prot > 0) n *= 1 - SURV.protCut;
  if (melee && rnd() < .22 + n / 120) { if (!(P.bleed > 0)) toast('You\'re bleeding — bandage it (slot 5)', 2.6); P.bleed = 45; }
  return n;
}
function onFall(dmg) { if (has('climb')) return; if (dmg >= 12 && !(P.frac > 0)) { P.frac = 1; toast('Something cracked. A splint will fix the leg (slot 5)', 3); } }
const fogResist = () => G.flags.serum || P.immune > 0 || cnt('ember') ? 1 : Math.min(1, wearStat('fog') + (has('breather') ? .8 : 0) + (P.buffs && P.buffs.prot > 0 ? .25 : 0));   // Hardy (cooked meat, stew) shrugs off some red fog too
function updStatus(dt) {
  if (P.dead || cine) return;
  if (P.bleed > 0) { P.bleed -= dt; P.hp -= dt * .9; if (P.bleed < 1 && rnd() < .3 && !(P.sick > 0)) { P.sick = 60; toast('The wound’s gone bad — infection', 2.6); } }
  if (P.sick > 0) { P.sick -= dt; P.food = Math.max(0, P.food - dt * SURV.sickFood); if (P.hp > 30) P.hp -= dt * .35; }
  if (P.dose > 0) { if (P.dose > 40) { P.food = Math.max(0, P.food - dt * SURV.doseFood); if (P.hp > 20) P.hp -= dt * .25; } if (rust.state === 'none') P.dose = Math.max(0, P.dose - dt * .05); }
  if (P.fed > 0) { P.fed -= dt; if (P.hp < 100 && P.hurtT <= 0 && P.food > 45) P.hp = Math.min(100, P.hp + dt * .6); }
  if (cnt('ember') && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * .8);
  if (P.immune > 0) P.immune -= dt; if (P.paint > 0) P.paint -= dt;
  const br = rust.state === 'active' && !P.safe ? bestTool('breather') : null; if (br && Math.random() < dt) wearTool(br);
  if (P.hp <= 0) die();
}
const statusTags = () => [P.bleed > 0 && ['Bleeding', '#e0573d'], P.frac > 0 && ['Fractured leg', '#e0a040'], P.sick > 0 && ['Sick', '#a8c050'], P.dose > 20 && ['Rust poisoning', '#c0603a'],
  P.fed > 0 && ['Well fed', '#7fc4b8'], ...Object.keys(BUFF_DEF).map(k => P.buffs && P.buffs[k] > 0 && [BUFF_DEF[k].n, BUFF_DEF[k].c]), P.immune > 0 && ['Rust-proof', '#9ad06a'], P.paint > 0 && ['War paint', '#b0b0b0'], P.over && ['Overloaded', '#e0a040']].filter(Boolean);
const stealthK = () => Math.max(.35, 1 - wearStat('stealth') - (P.paint > 0 ? .3 : 0));

/* ---------- gathering: trees, rocks, undergrowth, water ---------- */
const RCELL = 6, RGRID = new Map(), RDEPL = new Map();
function addRes(kind, x, z, s = 1) { if (kind !== 'rubble' && (inCity(x, z, 4) || inBase(x, z, 4))) return; const k = gkey(Math.floor(x / RCELL), Math.floor(z / RCELL)); let L = RGRID.get(k); if (!L) RGRID.set(k, L = []); L.push({ kind, x, z, s }); }
const NODE_USES = { fir: 4, alder: 4, snag: 3, boulder: 4, stone: 1, fern: 2, rubble: 3 };
const NODE_REGROW = { fir: 420, alder: 420, snag: 600, boulder: 600, stone: 360, fern: 240, rubble: 900 };
function nodeLeft(n) { const d = RDEPL.get(n); if (!d) return NODE_USES[n.kind]; if (G.t > d.at) { RDEPL.delete(n); return NODE_USES[n.kind]; } return NODE_USES[n.kind] - d.used; }
function useNode(n) { let d = RDEPL.get(n); if (!d || G.t > d.at) RDEPL.set(n, d = { used: 0, at: 0 }); d.used++; d.at = G.t + NODE_REGROW[n.kind]; }
function nearNode() {
  const ci = Math.floor(P.x / RCELL), cj = Math.floor(P.z / RCELL); let b = null, bd = 1e9;
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const n of RGRID.get(gkey(i, j)) || []) {
    const reach = n.kind === 'boulder' || n.kind === 'rubble' ? n.s * 1.1 + 1.4 : n.kind === 'fir' || n.kind === 'alder' || n.kind === 'snag' ? 1.9 : 1.6;
    const d = Math.hypot(n.x - P.x, n.z - P.z) - reach; if (d < 0 && d < bd && nodeLeft(n) > 0) { bd = d; b = n; }
  }
  return b;
}
function nearWater() {
  if (Math.abs(P.y - heightAt(P.x, P.z)) > 1.5 && !P.swim) return null;
  for (let a = 0; a < 6.28; a += .785) for (const r of [0, 1.6, 3]) { const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) + .15) return { x, z, lake: LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.R + 10) }; }
  return null;
}
const gSpeed = () => 1 / (1 + wearStat('gather'));
const TREE_N = { fir: 'fir', alder: 'alder', snag: 'dead tree' };
function nodeAction(n) {
  const g = gSpeed();
  if (n.kind in TREE_N) { const ax = bestTool('axe'); return ax ? { l: `Chop the ${TREE_N[n.kind]}`, t: 1.6 / (GEAR_DEFS[ax.id].pw || 1) * g, fn: () => chop(n, ax) } : { l: n.kind === 'snag' ? 'Snap off dry branches' : 'Gather sticks', t: 1.1 * g, fn: () => sticks(n) }; }
  if (n.kind === 'boulder') { const pk = bestTool('pick'); return pk ? { l: 'Mine the rock', t: 1.8 / (GEAR_DEFS[pk.id].pw || 1) * g, fn: () => mine(n, pk) } : { l: 'Prise loose stones', t: 1.3 * g, fn: () => looseStones(n) }; }
  if (n.kind === 'rubble') { const pr = bestTool('pry') || bestTool('pick'); return { l: pr ? 'Pry through the rubble' : 'Dig through the rubble', t: (pr ? 1.4 : 2.6) * g, fn: () => rubble(n, pr) }; }
  if (n.kind === 'stone') return { l: 'Take the stone', t: .5, fn: () => { useNode(n); gain([['stone', 1], ['flint', rnd() < .25 ? 1 : 0]]); } };
  if (n.kind === 'fern') { const sh = bestTool('shovel'); return { l: sh ? 'Forage + dig' : 'Forage the undergrowth', t: 1 * g, fn: () => forage(n) }; }
}
function gain(list) {
  const got = list.filter(([, n]) => n > 0); for (const [id, n] of got) give(id, n);
  if (got.length) { sfx('pickup'); toast(got.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · '), 1.8); gatherHint(); }
}
function chop(n, ax) { useNode(n); const pw = GEAR_DEFS[ax.id].pw || 1; wearTool(ax); sfx('thud'); gain([['log', pw + (rnd() < .4 ? 1 : 0)], ['stick', 1 + Math.floor(rnd() * 2)], ['bark', rnd() < .5 ? 1 : 0], ['hardwood', n.kind === 'alder' && rnd() < .55 ? 1 : 0], ['honey', rnd() < .03 ? 1 : 0]]); }
function sticks(n) { useNode(n); useNode(n); gain([['stick', 2 + Math.floor(rnd() * 2)], ['bark', rnd() < .3 ? 1 : 0], ['leaves', rnd() < .4 ? 2 : 0], ['branch', n.kind === 'snag' && rnd() < .4 ? 1 : 0], ['feather', rnd() < .06 ? 2 : 0]]); }
function mine(n, pk) { useNode(n); const pw = GEAR_DEFS[pk.id].pw || 1; wearTool(pk); sfx('metal', .6); gain([['stone', 2 + pw], ['flint', rnd() < .35 + pw * .1 ? 1 : 0], ['limestone', rnd() < .25 ? 1 : 0], ['metal_ore', rnd() < (pw > 1 ? .35 : .08) ? 1 : 0]]); }
function looseStones(n) { useNode(n); useNode(n); gain([['stone', 1 + Math.floor(rnd() * 2)], ['flint', rnd() < .18 ? 1 : 0]]); }
function rubble(n, pr) {
  useNode(n); if (pr) wearTool(pr); sfx('metal', .5);
  const r = (id, p, a = 1, b = a) => [id, rnd() < p ? a + Math.floor(rnd() * (b - a + 1)) : 0];
  gain([r('scrap', .8, 1, 3), r('stone', .5, 1, 2), r('nails', .3, 2, 5), r('screws', .2, 2, 4), r('pipe', .12), r('glass', .15), r('cu_wiring', .14), r('wire', .15), r('rubber', .1), r('metal_ore', .1), r('fuse', .05), r('springs', .06), r('gears', .05), r('documents', .04), r('photo', .04)]);
}
function forage(n) {
  useNode(n); const kn = bestTool('knife'), sh = bestTool('shovel'), seed = pick(['seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot']);
  const L = [['fiber', 2 + (kn ? 1 : 0)], ['vine', rnd() < .2 ? 1 : 0], ['berries', rnd() < .2 ? 1 + Math.floor(rnd() * 2) : 0], ['blueberries', rnd() < .1 ? 2 : 0], ['herb_med', rnd() < .18 ? 1 : 0],
    ['herb', rnd() < .14 ? 1 : 0], ['mushroom', rnd() < .14 ? 1 : 0], ['greens', rnd() < .16 ? 1 : 0], ['nuts', rnd() < .08 ? 1 : 0], ['leaves', rnd() < .4 ? 2 : 0], [seed, rnd() < .03 ? 1 : 0],
    ['roots', sh ? (rnd() < .6 ? 1 + Math.floor(rnd() * 2) : 0) : rnd() < .1 ? 1 : 0], ['soil', sh ? 1 + Math.floor(rnd() * 2) : 0], ['clay', sh && rnd() < .15 ? 1 : 0]];
  if (kn && rnd() < .5) wearTool(kn); if (sh) wearTool(sh);
  gain(L);
}
const container = () => cnt('pot') > 0 || cnt('canteen') > 0;
function waterAction(w) {
  const fi = bestTool('fish'), sh = bestTool('shovel'), acts = [];
  // (Part 3) drink straight from a lake or river — a small chance of an upset stomach, nothing worse
  if ((P.water ?? 100) < 95) acts.push({ l: 'Drink', t: .8, fn: () => { P.water = Math.min(100, (P.water ?? 100) + 35); P.thirstWarn = 0; sfx('splash'); if (rnd() < .1) { P.sick = Math.max(P.sick || 0, 30); toast('+35 water · the water tasted off', 2); } else toast('+35 water', 1.4); } });
  if (container()) acts.push({ l: 'Fill up (dirty water)', t: 1, fn: () => gain([['water_dirty', cnt('canteen') ? 3 : 2]]) });
  if (fi) acts.push({ l: fi.id === 'fish_rod' ? 'Cast a line' : 'Spear fish', t: fi.id === 'fish_rod' ? 3.2 : 2.4, fn: () => {
    // (Part 3) better odds, a chance of two with a rod, and fish bite more in rain and fog (wxFishK, 1k-weather.js)
    const rod = fi.id === 'fish_rod', bite = (rod ? .85 : .65) + wxFishK();
    wearTool(fi); if (rnd() < bite) gain([[w.lake ? 'lake_fish' : 'fish', rod && rnd() < .3 ? 2 : 1], ['shellfish', rnd() < .12 ? 1 : 0]]); else { toast('Nothing bit', 1.4); sfx('splash'); } } });
  if (sh && !w.lake) acts.push({ l: 'Dig clay from the bank', t: 1.8, fn: () => { wearTool(sh); gain([['clay', 2 + Math.floor(rnd() * 2)]]); } });
  acts.push({ l: 'Cut reeds', t: .9, fn: () => gain([['reed', 1 + Math.floor(rnd() * 2)], ['fiber', 1], ['shellfish', rnd() < .08 ? 1 : 0]]) });
  return acts;
}
let gHinted = false;
function gatherHint() { if (gHinted || G.flags.craftHint) return; gHinted = true; G.flags.craftHint = 1; setTimeout(() => toast(isTouch ? 'Tap the bag → CRAFT to turn these into tools' : 'Press I → CRAFT to turn these into tools', 4.5), 1900); }

/* channelled actions: hold still, the bar fills, then it happens (moving away cancels) */
let chan = null;
function startChan(a) { if (chan || !a) return; chan = { ...a, t0: a.t, x: P.x, z: P.z }; sfx('swing'); }
function updChan(dt) {
  if (!chan) return;
  if (P.dead || cine || Math.hypot(P.x - chan.x, P.z - chan.z) > .9 || invOpen || shopOpen) { chan = null; return; }
  chan.t -= dt; if (Math.random() < dt * 2.5) sfx('swing');
  if (chan.t <= 0) { const f = chan.fn; chan = null; f(); if (invOpen) renderInv(); }
}
let waterPick = 0;
function wildInteract() {
  if (chan) return { l: `${chan.l}…`, prog: 1 - chan.t / chan.t0, act: () => {} };
  const n = nearNode(); if (n) { const a = nodeAction(n); return a && { l: a.l, act: () => startChan(a) }; }
  const w = nearWater(); if (w) { const acts = waterAction(w); const a = acts[waterPick % acts.length]; return { l: a.l + (acts.length > 1 ? `  ·  ${isTouch ? 'hold' : 'Q'}: next` : ''), act: () => startChan(a), next: () => { waterPick++; }, multi: acts.length > 1 }; }
  return null;
}

/* butchering by-products: a knife gets you far more than meat */
function butcherYield(e) {
  if (e.sp) { const kn = bestTool('knife'); if (kn) wearTool(kn); return { L: wildYield(e, kn), kn }; }
  const kn = bestTool('knife'), L = [['meat', e.type === 'boar' ? 2 : 1]];
  if (kn) { wearTool(kn); L.push(['hide', 1], ['bone', 1 + Math.floor(rnd() * 2)], ['fat', e.type === 'boar' ? 2 : 1], ['sinew', e.type === 'deer' ? 1 + Math.floor(rnd() * 2) : 1], ['teeth', e.type === 'boar' && rnd() < .5 ? 1 : 0]); }
  else L.push(['bone', rnd() < .5 ? 1 : 0]);
  return { L, kn };
}

/* ---------- loot tables: the further from home and the better guarded, the better ---------- */
const GUNS_LOW = ['pistol', 'revolver', 'shotgun', 'flare_gun', 'm1911', 'pump_rifle'], GUNS_HIGH = ['smg', 'assault', 'sniper', 'lmg', 'grey_rifle'];
const LOOT = {
  wild: { cloth: [.55, 1, 3], rope: [.25], nails: [.3, 2, 5], screws: [.2, 2, 4], wire: [.25, 1, 2], bandage: [.2], painkiller: [.12], canned: [.2], purify_tab: [.08], ammo_556: [.4, 10, 25], seed_corn: [.06, 2, 4], seed_potato: [.06, 1, 3], map: [.03] },
  ruin: { cloth: [.5, 1, 3], nails: [.4, 3, 8], screws: [.3, 2, 6], bolts: [.2, 2, 4], wire: [.35, 1, 3], cu_wiring: [.3, 1, 2], pipe: [.2], glass: [.25, 1, 2], rubber: [.2], circuit: [.15], battery: [.2], fuse: [.18], sensor: [.06],
    spare_parts: [.18], springs: [.15], gears: [.12], gas_tank: [.05], fuel: [.1], disinfect: [.1], antibiotic: [.06], canned: [.3, 1, 2], documents: [.1], photo: [.08], notebook: [.06], ammo_9: [.25, 6, 15], ammo_556: [.25, 10, 25], synth: [.15, 1, 2], aluminum: [.15] },
  city: { scrap: [.7, 2, 5], nails: [.5, 4, 10], screws: [.4, 3, 8], bolts: [.35, 2, 5], cu_wiring: [.35, 1, 3], pipe: [.25], glass: [.35, 1, 2], rubber: [.3], circuit: [.25, 1, 2], battery: [.3], fuse: [.25], sensor: [.12],
    antenna: [.08], spare_parts: [.25], springs: [.25], gears: [.2], tool_kit: [.06], engine_part: [.05], fuel: [.15], gas_tank: [.08], solar_cell: [.06], arc_alloy: [.05], synth: [.25, 1, 3], aluminum: [.25, 1, 2], copper: [.2],
    canned: [.3, 1, 2], disinfect: [.15], antibiotic: [.1], med_parts: [.08], painkiller: [.2], alcohol: [.12], ammo_9: [.35, 8, 20], ammo_45: [.2, 6, 12], ammo_12: [.2, 4, 10], ammo_556: [.3, 15, 30], data_drive: [.08], camera: [.05], tablet: [.03], id_chip: [.025] },
  mil: { ammo_556: [.8, 30, 60], ammo_762: [.5, 8, 20], ammo_9: [.5, 15, 30], ammo_12: [.35, 8, 16], frag: [.3, 1, 2], smoke_gren: [.3, 1, 2], medkit: [.35], blood_bag: [.1], iv: [.12], inject: [.12], rust_med: [.1],
    battery: [.4, 1, 2], circuit: [.3], sensor: [.2], synth: [.4, 2, 4], steel: [.3, 1, 2], lab_sample: [.12], greyhold_files: [.05], shielding: [.1] },
  op: { ammo_556: [.9, 40, 90], ammo_762: [.6, 15, 30], ammo_12: [.5, 10, 20], frag: [.6, 2, 4], medkit: [.6, 1, 2], inject: [.3], rust_med: [.3], arc_alloy: [.5, 1, 3], solar_cell: [.4, 1, 2], power_cell: [.15],
    circuit: [.6, 1, 3], sensor: [.4, 1, 2], tool_kit: [.4], spare_parts: [.6, 2, 4], shielding: [.3, 1, 2], blackvein: [.08], halcyon_chip: [.1], sunfall_data: [.1], spindle: [.06] },
  clan: { hide: [.5, 1, 3], leather: [.3, 1, 2], bone: [.5, 1, 3], sinew: [.4, 1, 2], feather: [.4, 2, 5], fat: [.3, 1, 2], herb_med: [.4, 1, 3], dried_meat: [.4, 1, 3], arrows: [.3, 3, 8], rope: [.3],
    war_paint: [.3, 1, 2], seed_wheat: [.2, 2, 4], seed_bean: [.2, 2, 4], seed_squash: [.15, 1, 3], honey: [.15], salt: [.2, 1, 2] },
  arc: { arc_pack: [.6, 1, 3], cloth: [.5, 1, 3], synth: [.4, 1, 2], battery: [.3], circuit: [.2], wire: [.4, 1, 3], bandage: [.4], purify_tab: [.3], arc_alloy: [.2], ammo_556: [.4, 15, 30], wristband: [.2], photo: [.2], notebook: [.15] },
  trade: {},
};
const GEAR_LOOT = {
  wild: [.05, ['crowbar', 'wrench', 'hunting_knife', 'flashlight', 'hand_saw', 'compass', 'machete', 'longbow', 'canteen', 'gloves', 'boots', 'jacket']],
  ruin: [.14, ['metal_axe', 'pickaxe', 'crowbar', 'wrench', 'screwdriver', 'pliers', 'hammer', 'flashlight', 'radio', 'binoculars', 'pistol', 'revolver', 'm1911', 'pump_rifle', 'machete', 'kukri', 'hand_xbow', 'backpack', 'duffel', 'util_vest', 'helmet', 'boots', 'gloves']],
  city: [.2, ['bolt_cutters', 'crowbar', 'multitool', 'welder', 'flashlight', 'radio', 'binoculars', 'wire_cutters', 'pistol', 'revolver', 'm1911', 'pump_rifle', 'shotgun', 'smg', 'flare_gun', 'stun_baton', 'mil_knife', 'tomahawk', 'kukri', 'backpack', 'tac_armor', 'sec_uniform', 'helmet', 'gas_mask', 'arc_jumpsuit', 'climb_gear']],
  mil: [.45, ['assault', 'smg', 'shotgun', 'sniper', 'grey_rifle', 'tac_armor', 'grey_armor', 'gas_mask', 'riot_helmet', 'riot_shield', 'helmet', 'nvg', 'hazmat', 'rust_detector', 'med_scanner', 'mil_knife', 'stun_baton', 'breather', 'tomahawk', 'heavy_xbow']],
  op: [.9, ['lmg', 'assault', 'sniper', 'grey_rifle', 'pulse_pistol', 'heavy_xbow', 'mil_armor', 'grey_armor', 'rust_suit', 'nvg', 'lock_bypass', 'transmitter', 'repair_drone', 'diag_pc', 'solar_charger']],
  clan: [.2, ['shortbow', 'recurve', 'longbow', 'yumi', 'hornbow', 'hunt_recurve', 'repeat_xbow', 'hunt_spear', 'hatchet', 'war_axe', 'club', 'clan_mask', 'leather_armor', 'arm_guards', 'hide_coat', 'bone_dagger', 'staff']],
  arc: [.15, ['flashlight', 'radio', 'arc_jumpsuit', 'pistol', 'multitool', 'med_scanner']],
};
function rollLoot(table, extraRolls = 0) {
  const T = LOOT[table] || LOOT.wild, out = [];
  for (const [id, [p, a = 1, b = a]] of Object.entries(T)) if (rnd() < p) out.push([id, a + Math.floor(rnd() * (b - a + 1))]);
  for (const [id, n] of out) give(id, n);
  const msg = out.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`);
  const GL = GEAR_LOOT[table];
  for (let k = 0; k <= extraRolls; k++) if (GL && rnd() < GL[0]) { const g = newGear(pick(GL[1]), pick([0, 1, 1, 2]), table === 'op' || table === 'mil' ? rr(0, .3) : rr(.2, .65)); msg.unshift(`${GEAR_DEFS[g.id].n} (${Math.round(g.d / g.max * 100)}%)`); }
  return msg;
}
const RUIN_AT = () => [[POI.halvard, 110], [POI.burn, 75]];
function crateTable(c) {
  if (c.table) return c.table;
  if (inCity(c.x, c.z, 0)) return 'city';
  if (RUIN_AT().some(([p, r]) => Math.hypot(c.x - p.x, c.z - p.z) < r)) return Math.hypot(c.x - POI.burn.x, c.z - POI.burn.z) < 75 ? 'arc' : 'ruin';
  if (HOLDS.some(H => Math.hypot(c.x - H.x, c.z - H.z) < H.R + 10) || Math.hypot(c.x - POI.ashmere.x, c.z - POI.ashmere.z) < 80) return 'clan';
  return 'wild';
}
function crateSalvage(c) { return rollLoot(crateTable(c)); }
function clanDrop(e) {
  const L = [], T = e && e.fac === 'iron' ? [['scrap', .6, 1, 3], ['ammo_9', .35, 4, 10], ['ammo_12', .15, 2, 5], ['nails', .3, 2, 6], ['cloth', .3, 1, 2], ['canned', .15], ['fuel', .05], ['bolts', .2, 1, 3]]
    : e && e.fac === 'grey' ? [['ammo_556', .7, 10, 25], ['battery', .2], ['inject', .1], ['medkit', .15], ['synth', .3, 1, 2], ['greyhold_card', .04], ['lab_sample', .06]]
      : [['cloth', .3, 1, 2], ['bone', .18], ['feather', .15, 2, 2], ['rope', .1], ['herb_med', .06], ['arrows', .1, 2, 4], ['insignia', .05], ['war_paint', .05]];
  for (const [id, p, a = 1, b = a] of T) if (rnd() < p) L.push([id, a + Math.floor(rnd() * (b - a + 1))]);
  for (const [id, n] of L) give(id, n); return L;
}

/* ================= (Nov 11, Part 3) gentler survival =================
   Called once a frame from updPlayer. The food bar (hunger + thirst) drains ~3× slower than before, starving wears you down
   but never kills, cooked food buffs tick down here, and rain fills a pot or canteen. Tuning: SURV / BUFF_DEF in 2a-data.js. */
let rainCatchT = 0;
function updSurvival(dt) {
  const warm = 1 - Math.min(.5, wearStat('warm') * (isNight() ? 1 : .4));
  P.food = Math.max(0, P.food - dt * SURV.drain * (P.sprinting ? SURV.sprintK : 1) * (P.swim ? SURV.swimK : 1) * warm);
  const B = P.buffs || (P.buffs = {});
  for (const k in B) if (B[k] > 0) { B[k] -= dt; if (B[k] <= 0) { delete B[k]; toast(`${BUFF_DEF[k]?.n || k} wore off`, 1.6); } }
  P.water = Math.max(0, (P.water ?? 100) - dt * SURV.thirst * (P.sprinting ? SURV.sprintK : 1));
  if (P.water < SURV.thirstyAt && !P.thirstWarn) { P.thirstWarn = 1; toast('Getting thirsty — drink at a lake or river, or from your canteen (4)', 3); }
  const dry = P.water <= 0;
  if (dry && P.stamT <= 0 && !P.sprinting) P.stam = Math.max(0, P.stam - dt * 9);   // stamina refills at about half speed
  if (P.food <= 0) { if (P.hp > SURV.starveFloor) P.hp = Math.max(SURV.starveFloor, P.hp - dt * SURV.starveHp); }
  else if (!dry && P.food > SURV.regenAbove && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * (Math.hypot(P.x, P.z) < CAMP_R ? 1.6 : .5));
  if (B.heal > 0 && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * .9);
  // Energised: sprinting costs half as much and stamina comes back faster (updPlayer has already spent/refilled it this frame)
  if (B.stam > 0) { if (P.sprinting) P.stam = Math.min(100, P.stam + dt * 5.5); else if (P.stamT <= 0) P.stam = Math.min(100, P.stam + dt * 10); }
  // catching rain
  if (wxRaining() && container() && !P.safe) {
    rainCatchT += dt;
    if (rainCatchT > SURV.rainCatch) { rainCatchT = 0; if (cnt('water_rain') < SURV.rainCap) { give('water_rain', 1); toast('+1 rainwater · your pot caught the rain', 1.8); } }
  }
}
/* old saves: stretch the gear they already carry to the new, longer durability (once) */
function survLoad() {
  if ((G.flags.durK || 1) >= DUR_K) return;
  const k0 = G.flags.durK || 1;
  for (const t of INV.tools) { const D = GEAR_DEFS[t.id]; if (!D || D.dur >= 999) continue; const max = Math.round(D.dur * QUAL[t.q ?? 1].k); if (max > t.max) { t.d = Math.min(max, Math.round(t.d * max / t.max)); t.max = max; } }
  G.flags.durK = DUR_K; void k0;
}
/* easy repairs: a repair kit restores fully anywhere; otherwise scrap (or sticks + fiber for primitive tools) patches it
   up to 60%, or all the way at a workbench or forge */
function repairCost(t) {
  const D = GEAR_DEFS[t.id]; if (!D || t.d > t.max * SURV.repairAt) return null;
  if (cnt('repair_kit')) return { l: 'Repair · kit', need: [['repair_kit', 1]], full: true };
  const atBench = nearStation('bench') || nearStation('forge');
  if ((D.t || 1) <= 1 && cnt('stick') >= 1 && cnt('fiber') >= 2) return { l: `Repair · stick + 2 fiber${atBench ? '' : ' (60%)'}`, need: [['stick', 1], ['fiber', 2]], full: atBench };
  const sc = 1 + (D.t || 1);
  if (INV.scrap >= sc) return { l: `Repair · ${sc} scrap${atBench ? '' : ' (60%)'}`, need: [['scrap', sc]], full: atBench };
  return null;
}
const repairLabel = t => repairCost(t)?.l || null;
/* the one-tap Repair button: fixes everything worn, most worn first, as far as your kits / scrap / sticks go */
const needsRepair = () => INV.tools.filter(t => GEAR_DEFS[t.id] && GEAR_DEFS[t.id].dur < 999 && t.d <= t.max * SURV.repairAt);
function repairAll() {
  const list = needsRepair().sort((a, b) => a.d / a.max - b.d / b.max); let n = 0;
  for (const t of list) { const c = repairCost(t); if (!c) break; for (const [id, k] of c.need) { if (id === 'scrap') INV.scrap -= k; else take(id, k); } t.d = c.full ? t.max : Math.max(t.d, Math.round(t.max * .6)); t.warned = 0; n++; }
  if (!n) { sfx('no'); toast(list.length ? 'Need a repair kit, scrap, or a stick and fiber' : 'Nothing needs repairing'); return; }
  sfx('buy'); toast(`Repaired ${n} item${n > 1 ? 's' : ''}${n < list.length ? ` · ran out of materials for ${list.length - n}` : ''}`, 2.4); save();
}
function repairGear(t) {
  const c = t && repairCost(t); if (!c) { sfx('no'); toast('Need a repair kit, scrap, or a stick and fiber'); return; }
  for (const [id, n] of c.need) { if (id === 'scrap') INV.scrap -= n; else take(id, n); }
  t.d = c.full ? t.max : Math.max(t.d, Math.min(t.max, Math.round(t.max * .6))); t.warned = 0;
  sfx('buy'); toast(`${GEAR_DEFS[t.id].n} repaired${c.full ? '' : ' to 60% · a workbench fixes it fully'}`, 2.2); save();
}

/* ================= weapons: three slots (1–2 guns, 3 melee or bow), throwables on G =================
   The Arc rifle (bench upgrades) and the hunting rifle are always yours; everything else is a piece of gear with
   durability. Guns are hitscan (shotguns fire pellets), bows and crossbows loose real arrows, melee swings hit what's
   in front of you, grenades bounce and go off. */

// stats: cls gun|bow|melee · ammo item · dmg · mag · rate (s between shots) · spread · pellets · auto · scope · reach · stun · burn · spd (projectile)
const WDEF = {
  hunter: { cls: 'gun', ammo: 'ammo_762', dmg: 150, mag: 5, rate: 1.05, spread: .0015, scope: 5, reload: 2.2 },
  pistol: { cls: 'gun', ammo: 'ammo_9', dmg: 30, mag: 12, rate: .16, spread: .018, scope: 1.25, reload: 1.3 },
  revolver: { cls: 'gun', ammo: 'ammo_45', dmg: 58, mag: 6, rate: .42, spread: .012, scope: 1.3, reload: 2 },
  shotgun: { cls: 'gun', ammo: 'ammo_12', dmg: 15, pellets: 9, mag: 6, rate: .85, spread: .055, scope: 1.2, reload: 2.4 },
  smg: { cls: 'gun', ammo: 'ammo_9', dmg: 22, mag: 30, rate: .07, spread: .022, auto: 1, scope: 1.3, reload: 1.6 },
  assault: { cls: 'gun', ammo: 'ammo_556', dmg: 40, mag: 30, rate: .095, spread: .01, auto: 1, scope: 1.6, reload: 1.8 },
  sniper: { cls: 'gun', ammo: 'ammo_762', dmg: 210, mag: 5, rate: 1.2, spread: .0008, scope: 7, reload: 2.4 },
  lmg: { cls: 'gun', ammo: 'ammo_556', dmg: 36, mag: 80, rate: .085, spread: .02, auto: 1, scope: 1.4, reload: 3.6 },
  grey_rifle: { cls: 'gun', ammo: 'ammo_556', dmg: 50, mag: 30, rate: .1, spread: .007, auto: 1, scope: 2.2, reload: 1.8 },
  pulse_rifle: { cls: 'gun', ammo: 'cell', dmg: 85, mag: 20, rate: .2, spread: .002, auto: 1, scope: 2, reload: 1.5, pulse: 1 },
  flare_gun: { cls: 'bow', ammo: 'ammo_flare', dmg: 25, mag: 1, rate: .8, spd: 55, grav: 4, burn: 6, flare: 1, reload: 1.4 },
  shortbow: { cls: 'bow', ammo: 'arrows', dmg: 55, mag: 1, rate: .85, spd: 48, grav: 9, reload: .01 },
  recurve: { cls: 'bow', ammo: 'arrows', dmg: 80, mag: 1, rate: .95, spd: 62, grav: 8, reload: .01 },
  crossbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 120, mag: 1, rate: .3, spd: 80, grav: 5, reload: 1.8, scope: 1.8 },
  m1911: { cls: 'gun', ammo: 'ammo_45', dmg: 44, mag: 8, rate: .22, spread: .014, scope: 1.25, reload: 1.5 },
  pump_rifle: { cls: 'gun', ammo: 'ammo_45', dmg: 82, mag: 10, rate: .62, spread: .004, scope: 1.9, reload: 2.6 },
  pulse_pistol: { cls: 'gun', ammo: 'cell', dmg: 58, mag: 12, rate: .2, spread: .005, scope: 1.4, reload: 1.2, pulse: 1 },
  longbow: { cls: 'bow', ammo: 'arrows', dmg: 95, mag: 1, rate: 1.1, spd: 70, grav: 7, reload: .01, scope: 1.2 },
  yumi: { cls: 'bow', ammo: 'arrows', dmg: 102, mag: 1, rate: 1.05, spd: 74, grav: 7, reload: .01, scope: 1.2 },
  hornbow: { cls: 'bow', ammo: 'arrows', dmg: 72, mag: 1, rate: .6, spd: 60, grav: 8, reload: .01 },
  hunt_recurve: { cls: 'bow', ammo: 'arrows', dmg: 90, mag: 1, rate: .85, spd: 68, grav: 8, reload: .01, scope: 1.15 },
  hand_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 62, mag: 1, rate: .3, spd: 60, grav: 7, reload: 1.1, scope: 1.3 },
  heavy_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 175, mag: 1, rate: .4, spd: 96, grav: 4, reload: 3, scope: 2.2 },
  repeat_xbow: { cls: 'bow', ammo: 'bolts_xb', dmg: 46, mag: 8, rate: .32, spd: 62, grav: 7, reload: 2.6, scope: 1.2 },
  // melee (tools double as weapons, weaker)
  stone_knife: { cls: 'melee', dmg: 22, rate: .42, reach: 2 }, bone_dagger: { cls: 'melee', dmg: 24, rate: .4, reach: 2 }, flint_knife: { cls: 'melee', dmg: 18, rate: .42, reach: 2 },
  bone_knife: { cls: 'melee', dmg: 16, rate: .42, reach: 2 }, hunting_knife: { cls: 'melee', dmg: 32, rate: .38, reach: 2.1 }, mil_knife: { cls: 'melee', dmg: 40, rate: .34, reach: 2.1 },
  multitool: { cls: 'melee', dmg: 14, rate: .45, reach: 1.9 }, wood_spear: { cls: 'melee', dmg: 34, rate: .7, reach: 3.2 }, metal_spear: { cls: 'melee', dmg: 52, rate: .7, reach: 3.3 },
  hunt_spear: { cls: 'melee', dmg: 44, rate: .65, reach: 3.2 }, fish_spear: { cls: 'melee', dmg: 22, rate: .7, reach: 3 }, club: { cls: 'melee', dmg: 40, rate: .8, reach: 2.3, stun: .6 },
  staff: { cls: 'melee', dmg: 26, rate: .55, reach: 2.8, stun: .3 }, hatchet: { cls: 'melee', dmg: 42, rate: .6, reach: 2.2 }, machete: { cls: 'melee', dmg: 55, rate: .55, reach: 2.4 },
  sword: { cls: 'melee', dmg: 75, rate: .55, reach: 2.6 }, war_axe: { cls: 'melee', dmg: 90, rate: .85, reach: 2.5 }, stun_baton: { cls: 'melee', dmg: 25, rate: .6, reach: 2.2, stun: 2.6 },
  stone_axe: { cls: 'melee', dmg: 30, rate: .75, reach: 2.2 }, metal_axe: { cls: 'melee', dmg: 50, rate: .7, reach: 2.3 }, crowbar: { cls: 'melee', dmg: 40, rate: .65, reach: 2.3, stun: .4 },
  kukri: { cls: 'melee', dmg: 60, rate: .5, reach: 2.3 }, tomahawk: { cls: 'melee', dmg: 70, rate: .55, reach: 2.3 },
  pickaxe: { cls: 'melee', dmg: 45, rate: .85, reach: 2.3 }, stone_pick: { cls: 'melee', dmg: 26, rate: .85, reach: 2.2 }, hammer: { cls: 'melee', dmg: 34, rate: .6, reach: 2, stun: .5 },
  wood_hammer: { cls: 'melee', dmg: 20, rate: .6, reach: 2, stun: .3 }, wrench: { cls: 'melee', dmg: 30, rate: .55, reach: 2, stun: .3 }, wood_shovel: { cls: 'melee', dmg: 22, rate: .75, reach: 2.4 },
};
const isWeapon = id => !!WDEF[id];
const SLOT_OF = id => WDEF[id]?.cls === 'gun' ? 'gun' : 'hand';
const THROWS = ['frag', 'molotov', 'smoke_gren', 'throw_spear'];

/* ---------- viewmodels: three models from the kit for the rifles, everything else built from parts ---------- */
const VMAT = { gun: () => S(0x1c1d1f, { metalness: .65, roughness: .38 }), steel: () => S(0x9aa0a4, { metalness: .8, roughness: .3 }), wood: () => M(0x6a4528), dark: () => M(0x141414),
  leather: () => M(0x3a2618), bone: () => M(0xd8ccb2), orange: () => S(0xd0441e, { metalness: .2, roughness: .5 }), glow: c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }) };
function vbox(g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, g); o.rotation.set(rx, ry, rz); return o; }
function vcyl(g, r0, r1, l, m, x, y, z, rx = Math.PI / 2, ry = 0, rz = 0, seg = 10) { const o = mesh(new THREE.CylinderGeometry(r0, r1, l, seg), m, x, y, z, g); o.rotation.set(rx, ry, rz); return o; }
const PROC = {
  pistol: g => { const m = VMAT.gun(); vbox(g, .036, .045, .2, m, 0, .01, 0); vbox(g, .032, .1, .05, m, 0, -.055, .06, -.25); vbox(g, .03, .02, .05, m, 0, -.03, .02); },
  flare_gun: g => { const m = VMAT.orange(); vcyl(g, .025, .025, .18, m, 0, .01, -.02); vbox(g, .04, .05, .1, m, 0, .01, .06); vbox(g, .035, .1, .05, m, 0, -.06, .08, -.3); },
  revolver: g => { const m = VMAT.steel(); vcyl(g, .012, .012, .2, m, 0, .02, -.06); vcyl(g, .028, .028, .05, m, 0, .01, .04); vbox(g, .03, .03, .08, m, 0, .02, .06); vbox(g, .032, .1, .045, VMAT.wood(), 0, -.05, .1, -.35); },
  shotgun: g => { const m = VMAT.gun(), w = VMAT.wood(); vcyl(g, .018, .018, .62, m, 0, .025, -.18); vcyl(g, .016, .016, .5, m, 0, -.01, -.14); vbox(g, .05, .06, .16, m, 0, .01, .18); vbox(g, .05, .07, .28, w, 0, -.02, .38, .12); vbox(g, .04, .04, .16, w, 0, -.02, -.12); },
  smg: g => { const m = VMAT.gun(); vbox(g, .05, .07, .34, m, 0, 0, 0); vcyl(g, .014, .014, .14, m, 0, .01, -.24); vbox(g, .03, .14, .04, m, 0, -.1, -.02); vbox(g, .035, .09, .045, m, 0, -.07, .1, -.25); vbox(g, .02, .03, .18, m, 0, .02, .24); },
  pulse_rifle: g => { const m = S(0xd8dde2, { metalness: .5, roughness: .3 }); vbox(g, .06, .08, .7, m, 0, 0, 0); vbox(g, .045, .05, .3, VMAT.dark(), 0, .06, -.05); vbox(g, .012, .012, .5, VMAT.glow(0x6ad8ff), .032, 0, 0); vbox(g, .012, .012, .5, VMAT.glow(0x6ad8ff), -.032, 0, 0); vbox(g, .04, .1, .05, m, 0, -.08, .12, -.25); },
  shortbow: g => { const w = VMAT.wood(), a = new THREE.Mesh(new THREE.TorusGeometry(.34, .01, 5, 20, 2), w); a.rotation.set(0, Math.PI / 2, -1); a.position.set(0, 0, .3); g.add(a); vcyl(g, .0015, .0015, .58, VMAT.bone(), 0, 0, .03, 0); vbox(g, .025, .07, .025, VMAT.leather(), 0, 0, -.04); },
  recurve: g => { PROC.shortbow(g); vbox(g, .03, .08, .03, VMAT.leather(), 0, 0, -.12); },
  crossbow: g => { const w = VMAT.wood(), m = VMAT.gun(); vbox(g, .05, .05, .6, w, 0, 0, 0); vbox(g, .5, .025, .04, m, 0, .02, -.24); vcyl(g, .002, .002, .5, VMAT.bone(), 0, .03, -.17, 0, 0, Math.PI / 2); vbox(g, .035, .1, .05, w, 0, -.07, .15, -.3); },
  knife: (g, blade = VMAT.steel(), hilt = VMAT.leather(), L = .2) => { vbox(g, .01, .035, L, blade, 0, 0, -L / 2); vbox(g, .03, .03, .11, hilt, 0, 0, .05); },
  spear: (g, tip = VMAT.steel()) => { vcyl(g, .014, .014, 1.3, VMAT.wood(), 0, 0, .1); mesh(new THREE.ConeGeometry(.03, .16, 5), tip, 0, 0, -.62, g).rotation.x = -Math.PI / 2; },
  club: g => { vcyl(g, .03, .05, .55, VMAT.wood(), 0, 0, -.1); for (let i = 0; i < 6; i++) { const s = mesh(new THREE.ConeGeometry(.012, .06, 4), VMAT.steel(), Math.cos(i) * .05, Math.sin(i) * .05, -.3 + (i % 3) * .05, g); s.rotation.set(Math.PI / 2, 0, i); } },
  axe: (g, head = VMAT.steel(), L = .5) => { vcyl(g, .016, .02, L, VMAT.wood(), 0, 0, 0); vbox(g, .02, .13, .09, head, 0, .05, -L / 2 + .04); },
  hammer: (g, head = VMAT.steel()) => { vcyl(g, .015, .018, .38, VMAT.wood(), 0, 0, 0); vbox(g, .05, .05, .1, head, 0, .02, -.18, 0, Math.PI / 2); },
  baton: g => { vcyl(g, .02, .02, .5, VMAT.dark(), 0, 0, -.05); vcyl(g, .022, .022, .06, VMAT.glow(0x5ab0ff), 0, 0, -.32); },
  sword: g => { vbox(g, .012, .045, .7, VMAT.steel(), 0, 0, -.35); vbox(g, .13, .02, .03, VMAT.gun(), 0, 0, .02); vbox(g, .03, .03, .14, VMAT.leather(), 0, 0, .1); },
  crowbar: g => { vcyl(g, .012, .012, .7, S(0xb02a1a, { metalness: .4 }), 0, 0, -.1); vcyl(g, .012, .012, .1, S(0xb02a1a), 0, .04, -.46, 0); },
  shovel: g => { vcyl(g, .015, .015, .8, VMAT.wood(), 0, 0, 0); vbox(g, .14, .01, .18, VMAT.wood(), 0, 0, -.45); },
};
PROC.m1911 = PROC.pistol; PROC.pump_rifle = PROC.shotgun;
const VIEWS = {
  pistol: { proc: PROC.pistol, len: .22, at: [.17, -.18, -.36], grip: [0, -.09, .07], fore: [-.01, -.09, .05], scope: 1.25, sound: 'machine-gun-clean-single' },
  flare_gun: { proc: PROC.flare_gun, len: .22, at: [.17, -.18, -.36], grip: [0, -.09, .07], fore: [-.01, -.09, .06] },
  revolver: { proc: PROC.revolver, len: .3, at: [.17, -.18, -.38], grip: [0, -.09, .1], fore: [-.01, -.09, .09], sound: 'gun-shot-heavy' },
  shotgun: { proc: PROC.shotgun, len: .9, at: [.2, -.2, -.44], grip: [0, -.07, .2], fore: [0, -.04, -.12], sound: 'gun-shot-heavy' },
  smg: { proc: PROC.smg, len: .5, at: [.19, -.2, -.4], grip: [0, -.09, .1], fore: [0, -.05, -.1], sound: 'machine-gun-clean-single' },
  assault: { model: 'gun-night', len: .84, axis: 'z', tint: 0x6a6a5a, at: [.2, -.21, -.43], grip: [0, -.07, .09], fore: [0, -.03, -.19], sound: 'rifle-m16-b' },
  grey_rifle: { model: 'gun-desert', len: .86, axis: 'z', tint: 0x9aa0a6, at: [.2, -.215, -.44], grip: [0, -.08, .1], fore: [0, -.04, -.2], sound: 'rifle-m16-b' },
  lmg: { model: 'gun-desert', len: 1, axis: 'z', tint: 0x4a4e44, at: [.21, -.23, -.46], grip: [0, -.08, .12], fore: [0, -.04, -.24], sound: 'gun-shot-heavy', extra: g => vcyl(g, .07, .07, .08, VMAT.gun(), 0, -.09, -.02, 0, 0, Math.PI / 2) },
  sniper: { model: 'sniper', len: 1.2, axis: 'x', yaw: Math.PI / 2, tint: 0x5a5e62, at: [.2, -.2, -.52], grip: [0, -.07, .22], fore: [0, -.04, -.22], sound: 'gun-shot-heavy' },
  pulse_rifle: { proc: PROC.pulse_rifle, len: .7, at: [.2, -.2, -.42], grip: [0, -.08, .12], fore: [0, -.05, -.18] },
  shortbow: { proc: PROC.shortbow, len: .3, at: [-.06, -.1, -.55], grip: [0, -.02, -.04], fore: [0, -.02, -.04], bow: 1 },
  recurve: { proc: PROC.recurve, len: .3, at: [-.06, -.1, -.55], grip: [0, -.02, -.04], fore: [0, -.02, -.04], bow: 1 },
  crossbow: { proc: PROC.crossbow, len: .6, at: [.18, -.2, -.42], grip: [0, -.07, .15], fore: [0, -.03, -.12] },
};
/* (Nov 10) Bryce's weapon models (assets/models/w/*.glb), baked so the muzzle or blade tip points -z, up is +y and the middle of
   the model is at the origin. `msize` is the model's length along `axis` (bows stand up, so theirs is their height); grip/fore are
   where the hands close. Until a model has loaded (they stream in after the world), the drawn stand-in above is used. */
const MV = (model, msize, at, grip, fore, extra = {}) => ({ model, msize, axis: 'z', at, grip, fore, ...extra });
const BOWV = (model, h, extra = {}) => ({ model, msize: h, axis: 'y', yaw: -.85, at: [-.07, -.1, -.52], grip: [0, 0, 0], fore: [0, 0, 0], bow: 1, ...extra });   // turned so you see the curve of the limbs
const MODEL_VIEWS = {
  pistol: MV('w/pistol9', .2, [.17, -.16, -.36], [0, -.035, .05], [-.01, -.05, .045], { len: .2, sound: 'machine-gun-clean-single' }),
  m1911: MV('w/m1911', .22, [.17, -.16, -.37], [0, -.035, .055], [-.01, -.05, .05], { len: .22, sound: 'gun-shot-heavy' }),
  revolver: MV('w/revolver38', .27, [.17, -.16, -.38], [0, -.04, .085], [-.01, -.055, .08], { len: .27, sound: 'gun-shot-heavy' }),
  pulse_pistol: MV('w/pulse_pistol', .26, [.17, -.16, -.37], [0, -.045, .06], [-.01, -.06, .055], { len: .26, sound: 'machine-gun-clean-single' }),
  smg: MV('w/smg', .66, [.19, -.2, -.42], [0, -.06, .09], [0, -.05, -.16], { len: .66, sound: 'machine-gun-clean-single' }),
  shotgun: MV('w/rmb93', .92, [.2, -.2, -.44], [0, -.06, .13], [0, -.04, -.17], { len: .92, sound: 'gun-shot-heavy' }),
  pump_rifle: MV('w/lightning', 1, [.2, -.2, -.46], [0, -.05, .17], [0, -.03, -.14], { len: 1, sound: 'gun-shot-heavy' }),
  shortbow: BOWV('w/shortbow', .95), recurve: BOWV('w/recurve', .95), longbow: BOWV('w/longbow', 1.35), yumi: BOWV('w/yumi', 1.45),
  hornbow: BOWV('w/hornbow', .8), hunt_recurve: BOWV('w/recurve2', 1.15),
  crossbow: MV('w/light_xbow', .66, [.18, -.2, -.44], [0, -.05, .2], [0, -.03, -.08], { len: .66 }),
  hand_xbow: MV('w/hand_xbow', .4, [.17, -.18, -.4], [0, -.07, .09], [-.01, -.07, .08], { len: .4 }),
  heavy_xbow: MV('w/heavy_xbow', .78, [.19, -.2, -.47], [0, -.05, .22], [0, -.03, -.1], { len: .78 }),
  repeat_xbow: MV('w/repeat_xbow', .5, [.18, -.2, -.44], [0, -.05, .14], [0, -.03, -.06], { len: .5 }),
};
// blades and axes: the grip sits along the handle (+z end)
const BLADEV = (model, L, g) => ({ model, msize: L, axis: 'z', len: L, at: [.24, -.24, -.42], grip: [0, -.01, L * g], fore: [0, -.01, L * g], melee: 1 });
const MELEE_MODELS = { hunting_knife: BLADEV('w/kabar', .3, .3), mil_knife: BLADEV('w/kabar', .32, .3), multitool: BLADEV('w/folding_knife', .2, .28),
  hatchet: BLADEV('w/hatchet', .4, .38), metal_axe: BLADEV('w/hatchet', .62, .4), war_axe: BLADEV('w/tomahawk', .62, .38), tomahawk: BLADEV('w/tomahawk', .42, .36),
  machete: BLADEV('w/machete', .6, .36), kukri: BLADEV('w/kukri', .46, .36) };
const WEAPON_MODELS = [...new Set([...Object.values(MODEL_VIEWS), ...Object.values(MELEE_MODELS)].map(V => V.model).concat(['w/arrow', 'w/bolt', 'w/frag', 'w/molotov']))];
const MELEE_VIEW = { stone_knife: g => PROC.knife(g, M(0x4a4e56)), flint_knife: g => PROC.knife(g, M(0x4a4e56), M(0x8aa04a)), bone_dagger: g => PROC.knife(g, VMAT.bone()), bone_knife: g => PROC.knife(g, VMAT.bone()),
  hunting_knife: g => PROC.knife(g), mil_knife: g => PROC.knife(g, VMAT.gun(), VMAT.dark(), .22), multitool: g => PROC.knife(g, VMAT.steel(), VMAT.orange(), .1), machete: g => PROC.knife(g, VMAT.steel(), VMAT.dark(), .5),
  wood_spear: g => PROC.spear(g, VMAT.wood()), metal_spear: g => PROC.spear(g), hunt_spear: g => PROC.spear(g, M(0x4a4e56)), fish_spear: g => PROC.spear(g, M(0x4a4e56)), staff: g => vcyl(g, .02, .02, 1.5, VMAT.wood(), 0, 0, 0),
  club: PROC.club, hatchet: g => PROC.axe(g, M(0x4a4e56), .4), stone_axe: g => PROC.axe(g, M(0x7a7870), .45), metal_axe: g => PROC.axe(g), war_axe: g => PROC.axe(g, VMAT.steel(), .7), sword: PROC.sword,
  stun_baton: PROC.baton, crowbar: PROC.crowbar, pickaxe: g => { PROC.axe(g, VMAT.steel(), .6); vbox(g, .02, .3, .03, VMAT.steel(), 0, .02, -.27); }, stone_pick: g => { PROC.axe(g, M(0x7a7870), .55); vbox(g, .02, .26, .04, M(0x7a7870), 0, .02, -.24); },
  hammer: g => PROC.hammer(g), wood_hammer: g => PROC.hammer(g, VMAT.wood()), wrench: g => { vbox(g, .015, .03, .32, VMAT.steel(), 0, 0, -.05); vbox(g, .015, .07, .05, VMAT.steel(), 0, .02, -.22); }, wood_shovel: PROC.shovel };
for (const id in MELEE_VIEW) VIEWS[id] = { proc: MELEE_VIEW[id], len: .5, at: [.24, -.24, -.42], grip: [0, 0, .05], fore: [0, 0, .05], melee: 1 };
for (const id in MODEL_VIEWS) VIEWS[id] = { ...VIEWS[id], ...MODEL_VIEWS[id] };
for (const id in MELEE_MODELS) VIEWS[id] = { ...VIEWS[id], proc: MELEE_VIEW[id] || (g => PROC.knife(g, VMAT.steel(), VMAT.dark(), .4)), ...MELEE_MODELS[id] };
for (const id in VIEWS) { const V = VIEWS[id], D = GEAR_DEFS[id]; WEAPONS[id] = { name: D ? D.n : id, axis: 'z', auto: !!WDEF[id]?.auto, scope: WDEF[id]?.scope || 1, sound: V.sound || 'rifle-m16-a', ...V }; }
WEAPONS.hunter.name = 'Hunting rifle';

/* ---------- what's in each slot ---------- */
function eqInit() {
  if (!Array.isArray(INV.eq) || INV.eq.length !== 3) INV.eq = ['arc', G.flags.hunter ? 'hunter' : null, null];
  INV.eq = INV.eq.map(u => u === 'arc' || u === 'hunter' || u == null ? u : INV.tools.some(t => t.u === u) ? u : null);
  if (!INV.eq[0] && !INV.eq[1] && !INV.eq[2]) INV.eq[0] = 'arc';
}
function slotWeapon(i) {
  const u = INV.eq?.[i]; if (u == null) return null;
  if (u === 'arc') { const R = RIFLE[UP.rifle]; return { key: R.id, g: null, st: { cls: 'gun', ammo: 'ammo_556', dmg: R.dmg, mag: R.mag, rate: R.rate, spread: R.spread, auto: 1, scope: WEAPONS[R.id].scope, reload: 1.7 }, name: WEAPONS[R.id].name };
  }
  if (u === 'hunter') return { key: 'hunter', g: null, st: WDEF.hunter, name: 'Hunting rifle' };
  const g = INV.tools.find(t => t.u === u); if (!g || !WDEF[g.id]) return null;
  return { key: g.id, g, st: WDEF[g.id], name: GEAR_DEFS[g.id].n };
}
const curW = () => slotWeapon(P.slot) || slotWeapon(0) || { key: 'carbine', g: null, st: { cls: 'melee', dmg: 8, rate: .5, reach: 1.6 }, name: 'Fists' };
const gunId = () => curW().key;
const magOf = w => w.g ? (w.g.mag ?? 0) : INV.mags[w.key] ?? 0;
function setMag(w, n) { if (w.g) w.g.mag = n; else INV.mags[w.key] = n; }
const ammoLeft = w => w.st.ammo ? cnt(w.st.ammo) : 0;
function selectSlot(i) {
  if (!slotWeapon(i)) { if (i === 2) toast('Slot 3 is for a melee weapon or bow — equip one from the bag', 2.4); return; }
  if (P.slot === i || P.reload > 0) return;
  P.slot = i; P.swapT = .4; selectGunView(gunId()); sfx('reload'); toast(curW().name, 1.2);
}
function swapGun() { for (let k = 1; k <= 3; k++) { const i = (P.slot + k) % 3; if (slotWeapon(i)) { selectSlot(i); return; } } }
function equipTo(g, i) {
  const cls = WDEF[g.id]?.cls; if (!cls) return;
  if (cls === 'gun' && i === 2) i = 0; if (cls !== 'gun' && i !== 2) i = 2;
  INV.eq = INV.eq.map(u => u === g.u ? null : u); INV.eq[i] = g.u;
  if (P.slot === i) selectGunView(gunId()); toast(`${GEAR_DEFS[g.id].n} → slot ${i + 1}`, 1.8); sfx('reload'); save();
}
function autoEquip(g) {
  if (!WDEF[g.id] || !INV.eq || GEAR_DEFS[g.id].kind !== 'weapon' && !['hunting_knife', 'mil_knife', 'hatchet', 'war_axe'].includes(g.id)) return;
  const i = WDEF[g.id].cls === 'gun' ? (INV.eq[1] == null ? 1 : INV.eq[0] == null ? 0 : -1) : (INV.eq[2] == null ? 2 : -1);
  if (i >= 0) { INV.eq[i] = g.u; setTimeout(() => toast(`${GEAR_DEFS[g.id].n} ready in slot ${i + 1}`, 2.2), 1200); }
}
function onGearBroke(g) { if (!slotWeapon(P.slot)) { P.slot = slotWeapon(0) ? 0 : slotWeapon(1) ? 1 : 0; selectGunView(gunId()); } }

/* ---------- firing ---------- */
const ray = new THREE.Vector3(), rayO = new THREE.Vector3();
function rayHit(o, d, maxT) {
  let best = null, bt = maxT, mult = 1;
  for (const e of ents) {
    if (e.dead || e.type === 'npc') continue;
    if (Math.hypot(e.x - o.x, e.z - o.z) > maxT + 3) continue;
    for (const [cx, cy, cz, r, m] of hitSpheres(e)) {
      const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
      if (h < 0) continue; const t = -b - Math.sqrt(h);
      if (t > 0 && t < bt) { bt = t; best = e; mult = m; }
    }
  }
  let tHit = bt, solid = false;
  for (let t = .8; t < bt; t += 1) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < heightAt(x, z)) { tHit = t; best = null; solid = true; break; }
    if (t > 2 && (t | 0) % 2 === 0) for (const c of nearCols(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r * .8 && y < heightAt(c.x, c.z) + (c.h < 99 ? c.h : 8)) { tHit = t; best = null; solid = true; break; }
    if (solid) break;
  }
  return { e: best, t: tHit, mult, solid };
}
function shoot() {
  const w = curW(), R = w.st;
  if (P.reload > 0 || P.fire > 0 || P.dead || P.swapT > 0) return;
  if (R.cls === 'melee') return swing(w);
  if (magOf(w) <= 0) { sfx('dry'); P.fire = .25; if (ammoLeft(w) > 0) reload(); else toast(`Out of ${nameOf(R.ammo).toLowerCase()}`); input.fire = false; return; }
  setMag(w, magOf(w) - 1); P.fire = R.rate; P.kick = Math.min(P.kick + (R.dmg > 100 ? .09 : R.pellets ? .11 : .028), .14);
  if (!R.auto) input.fire = false;
  if (w.g) wearTool(w.g, 1);
  camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  if (R.cls === 'bow') { fireProj(R, w.key); sfx(R.flare ? 'shot' : 'whoosh'); if (magOf(w) === 0 && ammoLeft(w) > 0) setTimeout(reload, 120); return; }
  sfx('shot'); flash.visible = true; flash.rotation.z = rnd() * 6; flashLight.intensity = 3; setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 40);
  const mz = new THREE.Vector3(); muzzle.getWorldPosition(mz);
  let hitAny = false, head = false;
  for (let p = 0; p < (R.pellets || 1); p++) {
    const sp = R.spread * (1 - P.ads * .7) * (P.onGround ? 1 : 2.5);
    const d = ray.clone(); d.x += rr(-sp, sp); d.y += rr(-sp, sp); d.normalize();
    const h = rayHit(rayO, d, 400), end = rayO.clone().addScaledVector(d, h.t);
    if (p < 3) tracer(mz, end, R.pulse ? 0x7ae0ff : undefined);
    if (h.e) { damage(h.e, R.dmg * h.mult * (h.t > 40 && R.pellets ? .5 : 1), true, end); hitAny = true; head = head || h.mult > 1.5; }
    else if (h.t < 399 && p < 3) { puff(end.x, end.y + .1, end.z, 0x6a5a48, 4, 1.5, .1, .4); if (p === 0) sfx('impact', .7); }
  }
  if (hitAny) { sfx(head ? 'head' : 'hit'); hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90); hud.hitm.style.filter = head ? 'drop-shadow(0 0 3px #f44)' : ''; }
  if (magOf(w) === 0 && ammoLeft(w) > 0) setTimeout(reload, 240);
}
function reload() {
  const w = curW(), R = w.st;
  if (R.cls === 'melee' || P.reload > 0 || magOf(w) >= R.mag || ammoLeft(w) <= 0) return;
  P.reload = R.reload || 1.7; P.reloadMax = P.reload; if (R.cls !== 'bow' || R.reload > .5) sfx('reload');
}
function finishReload() { const w = curW(), R = w.st; if (!R.ammo) return; const n = Math.min(R.mag - magOf(w), ammoLeft(w)); setMag(w, magOf(w) + n); take(R.ammo, n); }

/* melee: a short swing, then whatever's in reach in front of you takes the hit */
function swing(w) {
  const R = w.st; P.fire = R.rate; P.swingT = .32; sfx('swing'); input.fire = !!R.auto;
  setTimeout(() => {
    if (P.dead) return;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = R.reach + .6;
    for (const e of ents) { if (e.dead || e.type === 'npc') continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > bd || Math.abs(e.y - P.y) > 2.5) continue; if ((dx * fx + dz * fz) / (d || 1) < .45) continue; bd = d; best = e; }
    if (best) {
      const at = new THREE.Vector3(best.x, best.y + 1.2, best.z), sneak = best.state === 'idle' || best.state === 'graze' || best.state === 'root';
      damage(best, R.dmg * (sneak ? 2 : 1), true, at); sfx('hit'); if (R.stun) best.stun = Math.max(best.stun || 0, R.stun);
      if (w.g) wearTool(w.g, 1); hud.hitm.classList.add('on'); setTimeout(() => hud.hitm.classList.remove('on'), 90);
      if (sneak) toast('Sneak attack ×2', 1);
    } else { const n = nearNode(); if (n && w.g && ['stone_axe', 'metal_axe', 'hatchet', 'war_axe', 'pickaxe', 'stone_pick'].includes(w.g.id)) sfx('thud'); }
  }, 130);
}

/* projectiles: arrows, bolts, flares, thrown spears, grenades, fire bottles */
const PROJ = [];
const PROJ_MODEL = { arrow: ['w/arrow', .75], bolt: ['w/bolt', .42], frag: ['w/frag', .12, 'y'], molotov: ['w/molotov', .26, 'y'] };
function projMesh(kind) {
  const g = new THREE.Group(), pm = PROJ_MODEL[kind], mc = pm && modelCopy(pm[0], pm[1], pm[2] || 'z');
  if (mc) { mc.traverse(o => { if (o.isMesh) { o.castShadow = false; } }); { const b = new THREE.Box3().setFromObject(mc); mc.position.y -= (b.min.y + b.max.y) / 2; } g.add(mc); if (kind === 'molotov') mesh(new THREE.SphereGeometry(.035, 6, 4), VMAT.glow(0xff8a2a), 0, .27, 0, g); world.add(g); return g; }
  if (kind === 'frag' || kind === 'smoke_gren') mesh(new THREE.SphereGeometry(.07, 8, 6), M(kind === 'frag' ? 0x4a5a3a : 0x6a6a62), 0, 0, 0, g);
  else if (kind === 'molotov') { mesh(new THREE.CylinderGeometry(.04, .05, .2, 8), M(0x7a4a1a), 0, 0, 0, g); mesh(new THREE.SphereGeometry(.04, 6, 4), VMAT.glow(0xff8a2a), 0, .12, 0, g); }
  else if (kind === 'flare') mesh(new THREE.SphereGeometry(.08, 8, 6), VMAT.glow(0xff4a3a), 0, 0, 0, g);
  else { const L = kind === 'throw_spear' ? 1.6 : kind === 'bolt' ? .45 : .7; vcyl(g, .008, .008, L, VMAT.wood(), 0, 0, 0); mesh(new THREE.ConeGeometry(.018, .07, 4), VMAT.steel(), 0, 0, -L / 2, g).rotation.x = -Math.PI / 2; }
  world.add(g); return g;
}
function fireProj(R, key) {
  const kind = R.flare ? 'flare' : /crossbow|xbow/.test(key) ? 'bolt' : 'arrow', g = projMesh(kind), d = ray.clone();
  const p = { g, kind, x: rayO.x + d.x * .6, y: rayO.y + d.y * .6 - .05, z: rayO.z + d.z * .6, vx: d.x * R.spd, vy: d.y * R.spd, vz: d.z * R.spd, grav: R.grav, dmg: R.dmg, burn: R.burn || 0, t: 0, owner: 'p' };
  PROJ.push(p);
}
function throwNext() {
  if (P.dead || cine || G.mode !== 'play') return;
  const id = (P.thr && cnt(P.thr) > 0) ? P.thr : THROWS.find(k => cnt(k) > 0);
  if (!id) { toast('Nothing to throw — craft grenades or throwing spears', 2); sfx('no'); return; }
  take(id, 1); camera.getWorldPosition(rayO); camera.getWorldDirection(ray);
  const spd = id === 'throw_spear' ? 32 : 18, g = projMesh(id);
  PROJ.push({ g, kind: id, x: rayO.x + ray.x * .5, y: rayO.y + ray.y * .5, z: rayO.z + ray.z * .5, vx: ray.x * spd, vy: ray.y * spd + (id === 'throw_spear' ? 1 : 3.5), vz: ray.z * spd, grav: 12, dmg: id === 'throw_spear' ? 70 : 0, t: 0, owner: 'p', fuse: id === 'frag' ? 2.4 : id === 'smoke_gren' ? 1.6 : 0 });
  sfx('whoosh'); toast(`${nameOf(id)} · ${cnt(id)} left`, 1.2);
}
const FIRES = [], SMOKES_P = [];
function explode(x, y, z) {
  sfx('boom'); puff(x, y + .5, z, 0xffa040, 18, 7, .3, .5, 2); puff(x, y + .5, z, 0x3a3a36, 16, 4, .5, 1.6, -1);
  for (const e of [...ents]) { if (e.dead || e.type === 'npc') continue; const d = Math.hypot(e.x - x, e.z - z, (e.y + 1) - y); if (d < 7) damage(e, 160 * (1 - d / 7) + 20, true, new THREE.Vector3(e.x, e.y + 1, e.z)); }
  const dp = Math.hypot(P.x - x, P.z - z, P.y + 1 - y); if (dp < 6) hurtPlayer(70 * (1 - dp / 6), x + .01, z);
  for (const p of PLACED || []) if (Math.hypot(p.x - x, p.z - z) < 4 && p.hp != null) p.hp -= 60;
}
function updProj(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i]; p.t += dt;
    if (!p.stuck) {
      const steps = 3, sd = dt / steps;
      for (let s = 0; s < steps && !p.stuck; s++) {
        p.vy -= p.grav * sd; p.x += p.vx * sd; p.y += p.vy * sd; p.z += p.vz * sd;
        const gh = heightAt(p.x, p.z);
        if (p.owner === 'p' && p.dmg > 0) for (const e of ents) { if (e.dead || e.type === 'npc') continue; if (Math.hypot(e.x - p.x, e.z - p.z) > 2.5) continue;
          for (const [cx, cy, cz, r, m] of hitSpheres(e)) if (Math.hypot(p.x - cx, p.y - cy, p.z - cz) < r + .05) { damage(e, p.dmg * m, true, new THREE.Vector3(p.x, p.y, p.z)); sfx(m > 1.5 ? 'head' : 'hit'); if (p.burn) e.burn = p.burn; p.stuck = 1; p.hitE = e; p.t = 20; break; }
          if (p.stuck) break; }
        if (!p.stuck && p.y < gh) {
          p.y = gh + .05;
          if (p.kind === 'frag' || p.kind === 'smoke_gren') { p.vx *= .35; p.vz *= .35; p.vy = Math.abs(p.vy) * .3; if (Math.abs(p.vy) < .6) { p.vy = 0; p.grav = 0; p.vx = p.vz = 0; } }
          else p.stuck = 1;
          if (p.kind === 'molotov') { FIRES.push({ x: p.x, z: p.z, y: gh, t: 7 }); sfx('boom', .5); p.t = 99; }
          if (p.kind === 'flare') { FIRES.push({ x: p.x, z: p.z, y: gh, t: 1.2, small: 1 }); }
        }
        if (!p.stuck && p.t > .1) for (const c of nearCols(p.x, p.z)) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r * .8 && p.y < heightAt(c.x, c.z) + 8) { if (p.kind === 'frag' || p.kind === 'smoke_gren') { p.vx *= -.3; p.vz *= -.3; } else p.stuck = 1; break; }
      }
      p.g.position.set(p.x, p.y, p.z);
      if (!p.stuck && p.grav && p.kind !== 'frag' && p.kind !== 'smoke_gren') p.g.lookAt(p.x - p.vx, p.y - p.vy, p.z - p.vz);
      if (p.kind === 'flare' && Math.random() < .5) puff(p.x, p.y, p.z, 0xff6a3a, 1, .5, .06, .3, 1);
    }
    if (p.hitE && !p.hitE.dead) p.g.position.set(p.hitE.x, p.hitE.y + 1.2, p.hitE.z);
    if (p.fuse) { p.fuse -= dt; if (p.fuse <= 0) { if (p.kind === 'frag') explode(p.x, p.y, p.z); else SMOKES_P.push({ x: p.x, z: p.z, y: p.y, t: 14 }); p.t = 99; p.fuse = 0; } }
    if (p.t > (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'throw_spear' ? 25 : 30) || p.t >= 99) { world.remove(p.g); PROJ.splice(i, 1); }
  }
  for (let i = FIRES.length - 1; i >= 0; i--) { const f = FIRES[i]; f.t -= dt; if (Math.random() < dt * (f.small ? 8 : 20)) puff(f.x + rr(-1.5, 1.5) * (f.small ? .2 : 1), f.y + .3, f.z + rr(-1.5, 1.5) * (f.small ? .2 : 1), pick([0xff8a2a, 0xffb04a, 0xe0502a]), 2, 1.5, .18, .6, 3);
    if (!f.small) { for (const e of ents) if (!e.dead && e.type !== 'npc' && Math.hypot(e.x - f.x, e.z - f.z) < 3.2) e.burn = Math.max(e.burn || 0, 3); if (Math.hypot(P.x - f.x, P.z - f.z) < 2.4) hurtPlayer(14 * dt, f.x + .01, f.z); }
    if (f.t <= 0) FIRES.splice(i, 1); }
  for (let i = SMOKES_P.length - 1; i >= 0; i--) { const s = SMOKES_P[i]; s.t -= dt; if (Math.random() < dt * 14) puff(s.x + rr(-3, 3), s.y + rr(.5, 3), s.z + rr(-3, 3), 0xa8a8a0, 2, .6, rr(.6, 1.2), 2.5, -.3);
    for (const e of ents) if (e.type === 'clan' && Math.hypot(e.x - s.x, e.z - s.z) < 9 && e.state === 'chase') { e.state = e.mode === 'raid' ? 'raid' : 'idle'; e.blind = 3; }
    if (s.t <= 0) SMOKES_P.splice(i, 1); }
}
const inSmoke = (x, z) => SMOKES_P.some(s => Math.hypot(x - s.x, z - s.z) < 9);

/* melee + bow viewmodel motion */
function weaponAnim(dt) {
  const V = WEAPONS[gunId()];
  if (P.swingT > 0) { P.swingT -= dt; const k = Math.sin((1 - P.swingT / .32) * Math.PI); vm.rotation.x -= k * 1.1; vm.rotation.z += k * .5; vm.position.x -= k * .12; vm.position.z -= k * .15; }
  if (V?.melee && !(P.swingT > 0)) { vm.rotation.x += .25; vm.rotation.z -= .2; }
  if (V?.bow) { vm.rotation.z += .15; const draw = P.fire > 0 ? Math.min(1, P.fire * 1.5) : 0; vm.position.z += draw * .05; }
}

/* ---------- enemy gunners (Ironjaw scavengers, Greyhold soldiers) ---------- */
function gunnerShoot(e) {
  const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz);
  e.yaw = Math.atan2(dx, dz);
  const from = new THREE.Vector3(e.x + Math.sin(e.yaw) * .5, e.y + 1.45, e.z + Math.cos(e.yaw) * .5), to = new THREE.Vector3(P.x + rr(-.4, .4), P.y + 1.2, P.z + rr(-.4, .4));
  // line of sight: terrain + walls between us
  const dir = to.clone().sub(from), L = dir.length(); dir.normalize();
  for (let t = 1.5; t < L - 1; t += 1.5) { const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t; if (y < heightAt(x, z)) return false; if (t > 3) for (const c of nearCols(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r * .7 && y < heightAt(c.x, c.z) + Math.min(c.h || 8, 8)) return false; }
  if (inSmoke(P.x, P.z) || inSmoke(e.x, e.z)) return false;
  const moving = Math.hypot(input.mx, input.my) > .3, hitP = clamp((e.fac === 'grey' ? .46 : .36) - d / (e.fac === 'grey' ? 120 : 90) - (moving ? .14 : 0) - (P.over ? -.05 : 0), .05, .45);
  tracer(from, to, 0xffd890); sfx(d < 40 ? 'turret' : 'impact', Math.max(.15, 1 - d / 90));
  if (rnd() < hitP) hurtPlayer(e.fac === 'grey' ? rr(8, 12) : rr(5, 9), e.x, e.z); else if (rnd() < .3) sfx('whoosh');
  return true;
}
function updGunner(e, dt, dp) {
  // keep a fighting distance, strafe, shoot when there's a clear line
  const p = e.p; let tx = e.x, tz = e.z, spd = 0;
  const want = e.fac === 'grey' ? 20 : 15;
  if (dp > want + 8) { tx = P.x; tz = P.z; spd = e.speed; }
  else if (dp < want - 8) { tx = e.x - (P.x - e.x); tz = e.z - (P.z - e.z); spd = e.speed * .8; }
  else { e.strafe = (e.strafe || (rnd() < .5 ? 1 : -1)); if (rnd() < dt * .4) e.strafe *= -1; const a = Math.atan2(P.x - e.x, P.z - e.z) + Math.PI / 2 * e.strafe; tx = e.x + Math.sin(a) * 4; tz = e.z + Math.cos(a) * 4; spd = e.speed * .55; }
  if (e.cool <= 0 && dp < 70) { e.cool = e.fac === 'grey' ? rr(.8, 1.3) : rr(1.2, 2.1); e.burst = (e.burst || 0) + 1; if (e.burst > 3) { e.burst = 0; e.cool = rr(2.5, 4); } if (!gunnerShoot(e)) { e.cool = .4; spd = e.speed; tx = P.x; tz = P.z; } }
  return [tx, tz, spd];
}

/* ================= base building: everything you can place =================
   Kits are crafted, then placed in front of you (walls face you). Q on a placed thing dismantles it for half back. */

/* colliders near a point (used by shots, projectiles and line-of-sight checks) */
function nearCols(x, z) { const L = grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); return L || []; }

const WOOD = () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x9a7a58 });
const MB = (g, w, h, d, m, x, y, z, ry = 0) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, g); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; return o; };
const MC = (g, r0, r1, h, m, x, y, z, seg = 8) => { const o = mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z, g); o.castShadow = true; return o; };
const glowM = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// wall-type pieces are a 4m run, built across your view
const WALLS = { palisade: { h: 3.4, m: 'logs', spike: 1 }, wood_wall: { h: 3, m: 'planks' }, metal_wall: { h: 3.4, m: 'metal' }, door: { h: 3, m: 'door' } };
function wallMesh(g, k) {
  const W = WALLS[k];
  if (W.m === 'logs') for (let i = 0; i < 9; i++) { MC(g, .2, .22, W.h, WOOD(), -1.8 + i * .45, W.h / 2, 0, 7); mesh(new THREE.ConeGeometry(.21, .5, 7), WOOD(), -1.8 + i * .45, W.h + .25, 0, g); }
  else if (W.m === 'planks') { for (let i = 0; i < 6; i++) MB(g, 4, .44, .12, WOOD(), 0, .3 + i * .5, 0); for (const x of [-1.9, 0, 1.9]) MB(g, .2, W.h, .2, M(0x5a3e28), x, W.h / 2, .12); }
  else if (W.m === 'metal') { const mt = new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x8a8478, 0x7a6a5a, 0x6a7072]) }); for (let i = 0; i < 4; i++) MB(g, 1.05, W.h, .08, mt, -1.5 + i * 1, W.h / 2, (i % 2) * .04); for (const y of [.5, W.h - .4]) MB(g, 4.1, .12, .14, M(0x3a3a3a), 0, y, .08); }
  else { for (const x of [-1.6, 1.6]) MB(g, .8, W.h, .3, M(0x5a5a5a), x, W.h / 2, 0); const dr = new THREE.Group(); dr.position.set(-1.2, 0, 0); g.add(dr); MB(dr, 2.4, 2.6, .12, new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a6a64 }), 1.2, 1.3, 0); MB(dr, .1, .1, .2, M(0x222222), 2.1, 1.3, .1); g.userData.leaf = dr; MB(g, 4, .4, .3, M(0x5a5a5a), 0, W.h - .2, 0); }
}
// what each placeable is and does · st: stations it counts as · store: storage slots · rest: you can set your respawn here
const BUILD_DEF = {
  campfire: { st: ['fire'], light: 1, mk: g => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; mesh(new THREE.DodecahedronGeometry(.22, 0), M(0x8a8780), Math.cos(a) * .6, .1, Math.sin(a) * .6, g); } for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.07, .08, .9, 5), M(0x5a3a22), 0, .2, 0, g).rotation.set(1.2, i * 2.1, 0); g.userData.flame = mesh(new THREE.ConeGeometry(.3, .8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 }), 0, .55, 0, g); }, r: .55 },
  sleeping_mat: { rest: 1, mk: g => { MB(g, .9, .08, 2, M(0x7a8a4a), 0, .04, 0); MB(g, .8, .14, .35, M(0x8a7a5a), 0, .1, -.8); }, r: 0 },
  tent: { rest: 1, shelter: 2.2, mk: g => { const t = mesh(new THREE.ConeGeometry(1.9, 2.2, 4), M(0x6a6a3a), 0, 1.1, 0, g); t.rotation.y = Math.PI / 4; t.scale.z = 1.4; MB(g, .8, 1.2, .05, M(0x1a1a14), 0, .6, 1.3); }, r: 1.3 },
  wood_shelter: { rest: 1, shelter: 3, mk: g => { for (const [x, z] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]) MC(g, .12, .14, 2.6, WOOD(), x, 1.3, z, 6); const r = MB(g, 4.4, .15, 4, WOOD(), 0, 2.7, 0); r.rotation.x = .12; for (let i = 0; i < 5; i++) MB(g, .25, 2.4, .2, WOOD(), -1.8 + i * .9, 1.2, -1.7); }, cols: [[-1.8, -1.6, .2], [1.8, -1.6, .2], [-1.8, 1.6, .2], [1.8, 1.6, .2], [0, -1.7, .4], [-1, -1.7, .4], [1, -1.7, .4]] },
  storage_chest: { store: 24, mk: g => { MB(g, 1.2, .6, .7, WOOD(), 0, .3, 0); MB(g, 1.25, .1, .75, M(0x5a3e28), 0, .62, 0); }, r: .6 },
  drying_rack: { st: ['rack'], mk: g => { for (const x of [-.9, .9]) MC(g, .05, .06, 1.7, M(0x6a4a30), x, .85, 0, 5); MC(g, .04, .04, 2, M(0x6a4a30), 0, 1.6, 0, 5).rotation.z = Math.PI / 2; for (let i = 0; i < 5; i++) MB(g, .12, .45, .03, M(0x8a3a24), -.6 + i * .3, 1.32, 0); }, r: .5 },
  cooking_rack: { st: ['fire', 'cook'], light: 1, mk: g => { for (let i = 0; i < 3; i++) { const l = MC(g, .04, .05, 2, M(0x5a3a22), Math.cos(i * 2.1) * .5, .9, Math.sin(i * 2.1) * .5, 5); l.rotation.set(Math.sin(i * 2.1) * .25, 0, -Math.cos(i * 2.1) * .25); } MC(g, .25, .2, .3, M(0x2a2a2a), 0, .8, 0, 10); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mesh(new THREE.DodecahedronGeometry(.16, 0), M(0x8a8780), Math.cos(a) * .4, .08, Math.sin(a) * .4, g); } g.userData.flame = mesh(new THREE.ConeGeometry(.22, .5, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 }), 0, .3, 0, g); }, r: .6 },
  water_collector: { make: ['water_rain', 150, 6], mk: g => { for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) MC(g, .04, .04, 1.4, M(0x6a4a30), x, .7, z, 5); const h = mesh(new THREE.ConeGeometry(1, .5, 4, 1, true), new THREE.MeshLambertMaterial({ color: 0x8a6a48, side: THREE.DoubleSide }), 0, 1.2, 0, g); h.rotation.set(Math.PI, Math.PI / 4, 0); MC(g, .3, .25, .4, M(0xa8643c), 0, .2, 0, 10); }, r: .8 },
  palisade: { wall: 1, hp: 300 }, wood_wall: { wall: 1, hp: 400 }, metal_wall: { wall: 1, hp: 900 }, door: { wall: 1, door: 1, hp: 900 },
  spikes: { spikes: 1, mk: g => { for (let i = 0; i < 7; i++) { const s = MC(g, .04, .07, 1.8, WOOD(), -1.6 + i * .53, .6, 0, 5); s.rotation.x = i % 2 ? .7 : -.7; } MC(g, .08, .08, 3.6, WOOD(), 0, .5, 0, 5).rotation.z = Math.PI / 2; }, r: 0 },
  watchtower: { tower: 5.2, mk: g => { for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) MC(g, .12, .16, 5.6, WOOD(), x, 2.8, z, 6); MB(g, 3, .2, 3, WOOD(), 0, 5.2, 0); for (const [x, z, ry] of [[0, -1.45, 0], [0, 1.45, 0], [-1.45, 0, Math.PI / 2], [1.45, 0, Math.PI / 2]]) MB(g, 3, .9, .08, WOOD(), x, 5.75, z, ry); const r = mesh(new THREE.ConeGeometry(2.4, 1.2, 4), M(0x5a4430), 0, 7.4, 0, g); r.rotation.y = Math.PI / 4; for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) MC(g, .06, .06, 1.6, WOOD(), x, 6.4, z, 5); }, cols: [[-1.2, -1.2, .2], [1.2, -1.2, .2], [-1.2, 1.2, .2], [1.2, 1.2, .2]] },
  storage_crate: { store: 32, mk: g => { MB(g, 1.3, .9, .9, new THREE.MeshLambertMaterial({ map: texWood, color: 0xb08a5a }), 0, .45, 0); }, r: .7 },
  rain_coll: { make: ['water_rain', 90, 10], mk: g => { MC(g, .55, .55, 1.4, S(0x3a6a9a, { metalness: .4 }), 0, .9, 0, 14); for (const [x, z] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) MB(g, .1, .2, .1, WOOD(), x, .1, z); MC(g, .7, .5, .1, S(0x8a8a8a), 0, 1.65, 0, 14); }, r: .6 },
  cook_station: { st: ['fire', 'cook'], light: 1, mk: g => { MB(g, 1.6, .9, 1, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a968e }), 0, .45, 0); MB(g, 1.4, .06, .8, M(0x2a2a2a), 0, .93, 0); MC(g, .2, .2, .3, M(0x3a3a3a), -.3, 1.1, 0, 10); g.userData.flame = mesh(new THREE.BoxGeometry(.9, .05, .4), glowM(0xff7a2a), 0, .7, .51, g); }, r: .9 },
  workshop: { st: ['bench'], mk: g => { MB(g, 2.2, .1, 1, WOOD(), 0, .95, 0); for (const [x, z] of [[-1, -.4], [1, -.4], [-1, .4], [1, .4]]) MB(g, .1, .95, .1, WOOD(), x, .47, z); MB(g, .4, .3, .3, M(0x3a3a3a), -.6, 1.15, 0); MB(g, 2.2, 1, .06, WOOD(), 0, 1.5, -.5); for (let i = 0; i < 5; i++) MB(g, .04, .3, .02, S(0x9a9a9a), -.8 + i * .4, 1.5, -.45); }, r: 1 },
  farm_plot: { farm: 1, mk: g => { MB(g, 2, .3, 1.4, WOOD(), 0, .15, 0); MB(g, 1.8, .05, 1.2, M(0x3e2e1e), 0, .31, 0); }, r: 0 },
  greenhouse: { farm: 2, mk: g => { const gl = new THREE.MeshLambertMaterial({ color: 0xc8e0e8, transparent: true, opacity: .32, side: THREE.DoubleSide }); MB(g, 3, .3, 2.2, WOOD(), 0, .15, 0); MB(g, 2.8, .05, 2, M(0x3e2e1e), 0, .31, 0); MB(g, 3, 1.8, 2.2, gl, 0, 1.2, 0); const r = mesh(new THREE.ConeGeometry(2.1, .9, 4), gl, 0, 2.55, 0, g); r.rotation.y = Math.PI / 4; r.scale.z = .75; for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) MB(g, .06, 2.1, .06, WOOD(), x, 1.2, z); }, r: 1.4 },
  water_filter: { st: ['filter'], mk: g => { for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) MB(g, .06, 1.2, .06, S(0x8a8a8a), x, .6, z); mesh(new THREE.ConeGeometry(.45, .7, 10), S(0xa0a4a8, { metalness: .6 }), 0, 1.4, 0, g).rotation.x = Math.PI; MC(g, .3, .3, .3, S(0x6a8aa0), 0, .3, 0, 10); }, r: .5 },
  chair: { mk: g => { MB(g, .5, .06, .5, WOOD(), 0, .45, 0); for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) MB(g, .05, .45, .05, WOOD(), x, .22, z); MB(g, .5, .5, .05, WOOD(), 0, .72, -.23); }, r: 0 },
  table: { mk: g => { MB(g, 1.6, .08, .9, WOOD(), 0, .8, 0); for (const [x, z] of [[-.7, -.35], [.7, -.35], [-.7, .35], [.7, .35]]) MB(g, .08, .8, .08, WOOD(), x, .4, z); }, r: .6 },
  bed: { rest: 1, mk: g => { MB(g, 1.1, .4, 2.1, WOOD(), 0, .2, 0); MB(g, 1, .18, 1.9, M(0x8a8a7a), 0, .48, 0); MB(g, .7, .12, .35, M(0xd8d0c0), 0, .62, -.75); MB(g, 1.1, .9, .08, WOOD(), 0, .45, -1.05); }, r: .7 },
  shelves: { store: 16, mk: g => { for (const x of [-.7, .7]) MB(g, .06, 1.8, .4, WOOD(), x, .9, 0); for (let i = 0; i < 4; i++) MB(g, 1.4, .05, .4, WOOD(), 0, .2 + i * .5, 0); for (let i = 0; i < 6; i++) MB(g, .25, .25, .25, M(pick([0x8a6a48, 0x5a6a4a, 0x6a6a6a])), -.5 + (i % 3) * .5, .35 + Math.floor(i / 3) * .5, 0); }, r: .5 },
  lantern: { light: 1, mk: g => { MC(g, .03, .03, 1.6, M(0x3a3a3a), 0, .8, 0, 5); MC(g, .1, .12, .25, glowM(0xffd080), 0, 1.7, 0, 8); MC(g, .12, .12, .04, M(0x2a2a2a), 0, 1.85, 0, 8); }, r: 0 },
  weapon_rack: { store: 8, gearOnly: 1, mk: g => { MB(g, 1.6, 1.4, .1, WOOD(), 0, .7, -.15); for (let i = 0; i < 4; i++) MB(g, .05, .05, .3, WOOD(), -.6 + i * .4, 1.1, 0); for (let i = 0; i < 3; i++) MB(g, .06, 1.1, .06, M(0x1a1a1a), -.4 + i * .4, .65, .05).rotation.z = .1; }, r: 0 },
  map_table: { map: 1, mk: g => { MB(g, 1.6, .08, 1, WOOD(), 0, .85, 0); for (const [x, z] of [[-.7, -.4], [.7, -.4], [-.7, .4], [.7, .4]]) MB(g, .08, .85, .08, WOOD(), x, .42, z); MB(g, 1.3, .01, .8, M(0xc8b890), 0, .9, 0); }, r: .6 },
  bookshelf: { books: 1, mk: g => { MB(g, 1.4, 1.9, .4, WOOD(), 0, .95, 0); for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) MB(g, .14, .32, .3, M(pick([0x6a2a1a, 0x2a3a5a, 0x3a5a2a, 0x7a6a4a])), -.5 + i * .16, .25 + r * .45, .04); }, r: .5 },
  forge: { st: ['forge', 'fire'], light: 1, mk: g => { MB(g, 2, 1.6, 1.6, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a7470 }), 0, .8, 0); MB(g, .7, 2.2, .7, new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x6a6460 }), .5, 2.6, -.3); g.userData.flame = MB(g, .9, .5, .05, glowM(0xff6a1a), 0, .9, .81); MB(g, .5, .35, .25, M(0x2a2a2a), 1.5, .75, .4); MC(g, .15, .15, .7, M(0x4a3a2a), 1.5, .35, .4, 8); }, r: 1.2 },
  lockers: { store: 24, mk: g => { for (let i = 0; i < 3; i++) { MB(g, .5, 1.9, .5, S(0x5a6a6a, { metalness: .5 }), -.52 + i * .52, .95, 0); MB(g, .3, .05, .02, M(0x222222), -.52 + i * .52, 1.6, .26); } }, r: .7 },
  ammo_box: { store: 16, mk: g => { MB(g, .9, .5, .5, S(0x4a5a3a, { metalness: .3 }), 0, .25, 0); MB(g, .2, .06, .1, M(0x1a1a1a), 0, .53, 0); }, r: .5 },
  metal_crate: { store: 48, mk: g => { MB(g, 1.5, 1, 1, S(0x7a7e80, { metalness: .6 }), 0, .5, 0); for (const x of [-.6, .6]) MB(g, .08, 1.02, 1.02, M(0x3a3a3a), x, .5, 0); }, r: .8 },
  barracks: { rest: 1, guards: 2, shelter: 3.5, mk: g => { const cv = M(0x8a8a6a); MB(g, 6, 2.6, 4, cv, 0, 1.3, 0); const r = mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 12, 1, false, 0, Math.PI), cv, 0, 2.6, 0, g); r.rotation.z = Math.PI / 2; r.scale.y = 1; r.scale.x = .5; MB(g, 1.2, 2, .05, M(0x1a1a14), 0, 1, 2.02); }, cols: [[-2, 0, 1.9], [0, 0, 1.9], [2, 0, 1.9]] },
  med_station: { st: ['lab'], heal: 1, mk: g => { MB(g, 2, .9, .8, S(0xd8d8d0), 0, .45, 0); MB(g, .5, .5, .05, glowM(0xe04040), 0, 1.3, -.38); MB(g, .2, .5, .05, glowM(0xffffff), 0, 1.3, -.36); MB(g, .5, .2, .05, glowM(0xffffff), 0, 1.3, -.355); MB(g, 2, 1.2, .1, S(0xc8c8c0), 0, 1.4, -.4); }, r: 1 },
  generator: { power: 'fuel', light: 1, mk: g => { MB(g, 1.3, .9, .8, S(0xd8a828, { metalness: .4 }), 0, .55, 0); MB(g, 1.5, .1, 1, M(0x1a1a1a), 0, .1, 0); MC(g, .1, .1, .5, M(0x2a2a2a), .5, 1.1, .2, 8); g.userData.lamp = MB(g, .1, .1, .05, glowM(0x40ff60), -.4, .8, .41); }, r: .8 },
  solar_panel: { power: 'sun', mk: g => { for (let i = 0; i < 3; i++) { const p = MB(g, 1, .05, 1.6, S(0x1a2a5a, { metalness: .6, roughness: .2 }), -1.1 + i * 1.1, 1.1, 0); p.rotation.x = -.5; MB(g, .06, 1, .06, M(0x6a6a6a), -1.1 + i * 1.1, .5, .3); } }, r: 0 },
  radio_tower: { radio: 1, mk: g => { for (const [x, z] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) { const l = MC(g, .05, .05, 9, M(0x8a3a2a), x * .6, 4.5, z * .6, 5); l.rotation.set(z * -.06, 0, x * .06); } for (let i = 1; i < 8; i++) MB(g, .9 - i * .08, .04, .04, M(0x8a3a2a), 0, i * 1.1, 0); g.userData.lamp = mesh(new THREE.SphereGeometry(.15, 8, 6), glowM(0xff3020), 0, 9.1, 0, g); MB(g, .8, .9, .6, S(0x6a6a6a), 0, .45, 1.2); }, r: .8 },
  turret: { turret: 1, needPower: 1, mk: g => { MB(g, 1, 1, 1, S(0x5a5e60, { metalness: .5 }), 0, .5, 0); const head = new THREE.Group(); head.position.y = 1.2; g.add(head); MB(head, .5, .4, .6, S(0x3a3e40, { metalness: .6 }), 0, 0, 0); MC(head, .04, .04, .9, M(0x1a1a1a), 0, .05, -.6, 8).rotation.x = Math.PI / 2; MB(head, .1, .1, .05, glowM(0xff3030), 0, .15, -.31); g.userData.head = head; }, r: .7 },
  lab: { st: ['lab', 'bench'], mk: g => { MB(g, 2.4, .9, .9, S(0xe0e0d8), 0, .45, 0); MB(g, .6, .4, .05, glowM(0x60c0ff), -.5, 1.2, -.3); MB(g, .5, .35, .4, S(0x2a2a2a), -.5, 1.1, -.1); for (let i = 0; i < 4; i++) MC(g, .05, .05, .2, new THREE.MeshLambertMaterial({ color: pick([0x8ad0a0, 0xd0a08a, 0xa08ad0]), transparent: true, opacity: .8 }), .4 + i * .15, 1, .1, 8); }, r: 1 },
};
for (const k in WALLS) BUILD_DEF[k].mk = g => wallMesh(g, k);

/* ---------- the placed list, its state is saved inside G.flags.placed ---------- */
const PLACED = [];
let powerSun = false;
const powered = () => PLACED.some(p => (BUILD_DEF[p.k].power === 'fuel' && p.rec.fuel > 0) || (BUILD_DEF[p.k].power === 'sun' && !isNight()));
function buildPlaced(rec) {
  const B = BUILD_DEF[rec.k]; if (!B) return;
  const g = new THREE.Group(); g.position.set(rec.x, heightAt(rec.x, rec.z), rec.z); g.rotation.y = rec.yaw || 0;
  B.mk(g); world.add(g);
  const p = { k: rec.k, x: rec.x, z: rec.z, yaw: rec.yaw || 0, g, rec, cols: [] };
  const C = (lx, lz, r) => { const [a, b] = rotXZ(lx, lz, p.yaw); p.cols.push(addCol(p.x + a, p.z + b, r)); };
  if (B.wall) for (let i = -4; i <= 4; i++) { if (B.door && Math.abs(i) <= 2) continue; C(i * .45, 0, .32); }
  else if (B.cols) for (const [x, z, r] of B.cols) C(x, z, r);
  else if (B.r) C(0, 0, B.r);
  if (B.door) { p.doorCols = []; for (let i = -2; i <= 2; i++) { const [a, b] = rotXZ(i * .45, 0, p.yaw); p.doorCols.push(addCol(p.x + a, p.z + b, rec.open ? -9 : .32)); } if (rec.open) g.userData.leaf.rotation.y = -1.5; }
  if (B.shelter) { p.sh = { x: p.x, z: p.z, kind: 'placed', r: B.shelter }; SHELTERS.push(p.sh); }
  if (B.tower) { addFloor(p.x, p.z, p.yaw, 1.4, 1.4, heightAt(p.x, p.z) + B.tower + .1); }
  if (B.store) rec.inv = rec.inv || {}, rec.gear = rec.gear || [];
  if (B.farm && rec.crop) farmShow(p);
  if (B.guards) spawnGuards(p);
  PLACED.push(p); return p;
}
function placeKit(k) {
  if (cnt(k) <= 0) return;
  if (Math.hypot(P.x, P.z) < 14 && Math.abs(P.x) < 12 && P.z < 6) { sfx('no'); toast('Too close to the wreck — place it somewhere open'); return; }
  const B = BUILD_DEF[k], dist = B.wall ? 2.6 : B.tower || B.guards || k === 'greenhouse' ? 4.5 : 2.4;
  const x = P.x - Math.sin(P.yaw) * dist, z = P.z - Math.cos(P.yaw) * dist;
  if (waterAt(x, z) > heightAt(x, z) - .3) { sfx('no'); toast("Can't build in water"); return; }
  if (PLACED.some(p => Math.hypot(p.x - x, p.z - z) < (BUILD_DEF[p.k].wall && B.wall ? 1.5 : 1))) { sfx('no'); toast('Something is already there'); return; }
  take(k, 1);
  const rec = { k, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +(B.wall ? P.yaw : P.yaw + Math.PI).toFixed(3) };
  (G.flags.placed ||= []).push(rec); buildPlaced(rec);
  sfx('buy'); puff(x, heightAt(x, z) + .3, z, 0x8a7a6a, 8, 2, .15, .6);
  toast(`${nameOf(k)} built${B.rest ? ' · use it to set your respawn' : B.store ? ' · use it to store things' : B.farm ? ' · plant seeds in it' : ''}`, 2.6); save();
}
function unplace(p, refund) {
  world.remove(p.g); for (const c of [...p.cols, ...(p.doorCols || [])]) c.r = -9;
  if (p.sh) SHELTERS.splice(SHELTERS.indexOf(p.sh), 1);
  if (p.guardEnts) for (const e of p.guardEnts) removeEnt(e);
  PLACED.splice(PLACED.indexOf(p), 1); G.flags.placed = (G.flags.placed || []).filter(r => r !== p.rec);
  if (refund) {
    const R = RECIPES.find(r => r.o === p.k); const back = [];
    if (R) for (const [id, n] of Object.entries(R.i)) { const m = Math.floor(n / (R.n || 1) / 2); if (m > 0) { give(id, m); back.push(`+${m} ${nameOf(id).toLowerCase()}`); } }
    for (const [id, n] of Object.entries(p.rec.inv || {})) give(id, n); for (const g of p.rec.gear || []) INV.tools.push(g);
    toast(`Dismantled ${nameOf(p.k).toLowerCase()}${back.length ? ' · ' + back.join(' · ') : ''}`, 2.6); sfx('thud');
  }
  save();
}
function restorePlaced() { for (const p of [...PLACED]) { world.remove(p.g); for (const c of [...p.cols, ...(p.doorCols || [])]) c.r = -9; if (p.sh) SHELTERS.splice(SHELTERS.indexOf(p.sh), 1); if (p.guardEnts) for (const e of p.guardEnts) removeEnt(e); } PLACED.length = 0; for (const r of G.flags.placed || []) buildPlaced(r); }
const nearPlaced = (r = 3.2) => { let b = null, bd = r; for (const p of PLACED) { const B = BUILD_DEF[p.k], rr0 = B.wall ? 2.4 : B.guards ? 4 : (B.r || .5) + 2; const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < Math.max(r, rr0) && d - rr0 < bd) { bd = d - rr0; b = p; } } return b; };

/* ---------- what using a placeable does (E), and Q to dismantle ---------- */
function placedAction(p) {
  const B = BUILD_DEF[p.k], rec = p.rec, n = nameOf(p.k);
  if (B.st) return { l: `${n} · craft`, act: () => openCraft(B.st.includes('forge') ? 'mat' : B.st.includes('bench') ? 'tool' : B.st.includes('lab') ? 'med' : 'food') };
  if (B.store) return { l: `Open ${n.toLowerCase()}`, act: () => openStore(p) };
  if (B.rest) return { l: G.flags.spawn && Math.hypot(G.flags.spawn.x - p.x, G.flags.spawn.z - p.z) < 1 ? `${n} · rest (respawn set)` : `${n} · set respawn here`, act: () => { G.flags.spawn = { x: p.x, z: p.z }; P.hp = Math.min(100, P.hp + 15); sfx('pickup'); toast('You\'ll wake up here if you go down', 2.4); save(); } };
  if (B.door) return { l: rec.open ? 'Close the door' : 'Open the door', act: () => { rec.open = !rec.open; p.g.userData.leaf.rotation.y = rec.open ? -1.5 : 0; for (const c of p.doorCols) c.r = rec.open ? -9 : .32; sfx('gate'); save(); } };
  if (B.tower) { const top = heightAt(p.x, p.z) + B.tower + .1; return { l: P.y < top - 2 ? 'Climb the watchtower' : 'Climb down', act: () => { if (P.y < top - 2) { P.x = p.x; P.z = p.z; P.y = top; } else { P.x = p.x + 2.4; P.z = p.z + 2.4; P.y = heightAt(P.x, P.z); } P.vy = 0; sfx('step'); } }; }
  if (B.make) { const [id, , cap] = B.make, have = rec.n || 0; return { l: have ? `Collect ${have} ${nameOf(id).toLowerCase()}` : `${n} · filling (${have}/${cap})`, act: () => { if (rec.n) { give(id, rec.n); toast(`+${rec.n} ${nameOf(id).toLowerCase()}`); rec.n = 0; sfx('pickup'); save(); } } }; }
  if (B.farm) return farmAction(p);
  if (B.power === 'fuel') return { l: `Generator · fuel ${Math.ceil(rec.fuel || 0)}%${cnt('fuel') ? ' · add fuel' : ''}`, act: () => { if (!cnt('fuel')) { sfx('no'); toast('Needs fuel'); return; } take('fuel', 1); rec.fuel = Math.min(100, (rec.fuel || 0) + 50); sfx('reload'); save(); } };
  if (B.map) return { l: 'Study the map table', act: () => { revealAll('map'); } };
  if (B.books) return { l: 'Read', act: () => { toast(pick(['A field guide to edible plants — mushrooms with white gills are the ones that kill you.', 'A pre-fire almanac. The winters used to be colder.', 'A schematic for a hand-cranked generator, half the pages missing.', TIER_HOW[Math.min(6, tierNow() + 1)] || 'Nothing you don’t know.']), 4); } };
  if (B.radio) return { l: 'Radio tower · listen', act: () => { G.flags.radioTower = 1; for (const R of REGIONS) if (R.base) (G.flags.seen ||= {})[R.id] = 1; toast('Chatter on every band — faction bases marked on the map, and you\'ll hear raiders coming', 3.4); save(); } };
  if (B.turret) return { l: powered() ? 'Security station · armed' : 'Security station · needs power (generator or solar)', act: () => {} };
  if (B.heal) return { l: 'Medical station', act: () => openCraft('med') };
  if (B.guards) return { l: `Barracks · ${p.guardEnts?.filter(e => !e.dead).length || 0} guards`, act: () => { spawnGuards(p, true); } };
  return { l: n, act: () => {} };
}

/* ---------- farming ---------- */
const CROP_OF = { seed_corn: 'corn', seed_potato: 'potato', seed_wheat: 'wheat', seed_bean: 'beans', seed_squash: 'squash', seed_carrot: 'carrot' };
const GROW = 360;
function farmAction(p) {
  const rec = p.rec, B = BUILD_DEF[p.k];
  if (!rec.crop) { const seed = Object.keys(CROP_OF).find(s => cnt(s) > 0); return { l: seed ? `Plant ${nameOf(seed).toLowerCase()}` : 'Farm plot · needs seeds', act: () => { if (!seed) { sfx('no'); toast('No seeds — forage, trade, or cut them from crops'); return; } take(seed, 1); rec.crop = seed; rec.g = 0; if (cnt('fertilizer')) { take('fertilizer', 1); rec.fert = 1; } farmShow(p); sfx('pickup'); toast(`Planted${rec.fert ? ' (fertilized)' : ''} · ready in about ${Math.round(GROW / B.farm / (rec.fert ? 2 : 1) / 60)} min`); save(); } }; }
  if (rec.g < 1) return { l: `${nameOf(CROP_OF[rec.crop])} growing · ${Math.round(rec.g * 100)}%`, act: () => {} };
  return { l: `Harvest ${nameOf(CROP_OF[rec.crop]).toLowerCase()}`, act: () => { const n = (3 + Math.floor(rnd() * 3)) * B.farm; give(CROP_OF[rec.crop], n); const s = 1 + Math.floor(rnd() * 2); give(rec.crop, s); toast(`+${n} ${nameOf(CROP_OF[rec.crop]).toLowerCase()} · +${s} seeds`); rec.crop = null; farmShow(p); sfx('pickup'); save(); } };
}
function farmShow(p) {
  if (p.g.userData.plants) { p.g.remove(p.g.userData.plants); p.g.userData.plants = null; }
  if (!p.rec.crop) return;
  const pl = new THREE.Group(), k = .2 + Math.min(1, p.rec.g || 0) * .8, col = { seed_corn: 0x7a9a3a, seed_wheat: 0xb8a050, seed_squash: 0x4a8a3a, seed_carrot: 0x5a9a3a, seed_potato: 0x4a7a3a, seed_bean: 0x5a8a4a }[p.rec.crop];
  const W = BUILD_DEF[p.k].farm > 1 ? 2.6 : 1.6;
  for (let i = 0; i < (W > 2 ? 12 : 8); i++) { const c = mesh(new THREE.ConeGeometry(.12, .7, 5), M(col), -W / 2 + .2 + (i % 4) * W / 4, .35 * k + .3, -.4 + Math.floor(i / 4) * .45, pl); c.scale.setScalar(k); if ((p.rec.g || 0) >= 1) mesh(new THREE.SphereGeometry(.07, 6, 4), M(0xe0a030), c.position.x, c.position.y + .3, c.position.z, pl); }
  p.g.add(pl); p.g.userData.plants = pl;
}

/* ---------- barracks guards: Arc folk with rifles who shoot at raiders ---------- */
function spawnGuards(p, refill) {
  p.guardEnts = (p.guardEnts || []).filter(e => !e.dead && ents.includes(e));
  const want = BUILD_DEF[p.k].guards; if (refill && p.guardEnts.length >= want) { toast('Barracks is fully manned'); return; }
  if (refill && cnt('ration') + cnt('dried_meat') + cnt('canned') < 2) { sfx('no'); toast('Feed a new guard: 2 cooked/dried meat or canned food'); return; }
  while (p.guardEnts.length < want) {
    if (refill) { for (let k = 0; k < 2; k++) { const f = ['ration', 'dried_meat', 'canned'].find(id => cnt(id) > 0); if (f) take(f, 1); } }
    const e = spawnNPC('guard', p.x + rr(-3, 3), p.z + rr(-3, 3), { model: 'keeper', armed: true, wander: true }); e.guard = 1; e.home = { x: p.x, z: p.z }; e.hp = 100; e.fireT = 0;
    const gm = modelCopy('gun-night', .7, 'z'); if (gm) { gm.position.set(.25, e.p.H * .55, .25); e.p.body.add(gm); }
    p.guardEnts.push(e); if (refill) { toast('A new guard joins the barracks'); break; }
  }
}
function updGuard(e, dt) {
  e.fireT -= dt; if (e.fireT > 0) return false;
  let best = null, bd = 42; for (const t of ents) if (isFoe(t)) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < bd) { bd = d; best = t; } }
  if (!best) { e.fireT = .5; return false; }
  e.fireT = rr(.6, 1.1); e.yaw = Math.atan2(best.x - e.x, best.z - e.z);
  const from = new THREE.Vector3(e.x, e.y + 1.4, e.z), to = new THREE.Vector3(best.x + rr(-.3, .3), best.y + 1.2, best.z + rr(-.3, .3));
  tracer(from, to, 0xffe0a0); sfx('turret', Math.max(.15, 1 - Math.hypot(e.x - P.x, e.z - P.z) / 80));
  if (rnd() < .6) damage(best, 24, false, to);
  return true;
}

/* ---------- per-frame: fires, lights, spikes, turrets, crops, water, fuel, healing ---------- */
const PLIGHTS = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa860, 0, 16, 1.6); world.add(l); PLIGHTS.push(l); }
let placeT = 0;
function updPlaced(dt) {
  placeT -= dt; const slow = placeT <= 0; if (slow) placeT = 1;
  const pw = slow ? powered() : null, nightK = isNight() ? 1 : .25;
  const lit = [];
  for (const p of PLACED) {
    const B = BUILD_DEF[p.k], rec = p.rec, d = Math.hypot(p.x - P.x, p.z - P.z);
    if (p.g.userData.flame) { const f = p.g.userData.flame; f.scale.y = 1 + Math.sin(G.t * 13 + p.x) * .15; }
    if (B.light && d < 60) lit.push([d, p]);
    if (B.spikes) for (const e of ents) if (e.type === 'clan' && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 2) { e.hp -= 35 * dt; e.slow = .5; if (e.hp <= 0) damage(e, 1, false, new THREE.Vector3(e.x, e.y + 1, e.z)); }
    if (B.turret && (slow ? (p.pw = pw) : p.pw)) {
      p.cool = (p.cool || 0) - dt;
      if (p.cool <= 0) { let best = null, bd = 46; for (const e of ents) if (isFoe(e)) { const dd = Math.hypot(e.x - p.x, e.z - p.z); if (dd < bd) { bd = dd; best = e; } }
        p.cool = best ? .4 : .5;
        if (best) { const h = p.g.userData.head; h.rotation.y = Math.atan2(best.x - p.x, best.z - p.z) - p.yaw + Math.PI; const from = new THREE.Vector3(p.x, heightAt(p.x, p.z) + 1.3, p.z), to = new THREE.Vector3(best.x, best.y + 1.2, best.z); tracer(from, to, 0xff8080); sfx('turret', Math.max(.15, 1 - d / 90)); if (rnd() < .75) damage(best, 26, false, to); } }
    }
    if (!slow) continue;
    if (B.farm && rec.crop && rec.g < 1) { rec.g = Math.min(1, (rec.g || 0) + B.farm * (rec.fert ? 2 : 1) / GROW); if (Math.round(rec.g * 10) !== Math.round((rec.g - B.farm / GROW) * 10) || rec.g >= 1) farmShow(p); }
    if (B.make) { const [, every, cap] = B.make; rec.t = (rec.t || 0) + (rust.state === 'none' ? 1 : 2); if (rec.t >= every) { rec.t = 0; rec.n = Math.min(cap, (rec.n || 0) + 1); } }
    if (B.power === 'fuel' && rec.fuel > 0) { rec.fuel = Math.max(0, rec.fuel - .25); if (p.g.userData.lamp) p.g.userData.lamp.visible = true; } else if (p.g.userData.lamp && B.power) p.g.userData.lamp.visible = false;
    if (B.radio && p.g.userData.lamp) p.g.userData.lamp.visible = Math.sin(G.t * 3) > 0;
    if (B.heal && d < 4.5 && !P.dead) { P.hp = Math.min(100, P.hp + 2); if (P.bleed > 0) P.bleed = Math.max(0, P.bleed - 6); }
  }
  lit.sort((a, b) => a[0] - b[0]);
  PLIGHTS.forEach((l, i) => { const q = lit[i]; if (!q) { l.intensity = 0; return; } const p = q[1]; l.position.set(p.x, heightAt(p.x, p.z) + (p.k === 'lantern' ? 1.8 : 1.2), p.z); l.intensity = (p.k === 'lantern' ? 2.2 : 3) * nightK * (1 + Math.sin(G.t * 17 + i) * .08); });
}

/* ---------- storage ---------- */
let storeAt = null;
function openStore(p) { storeAt = p; invTab = 'store'; toggleInv(true); }
function storeUsed(p) { return Object.values(p.rec.inv || {}).length + (p.rec.gear || []).length; }
function storePut(id, all) {
  const p = storeAt, B = BUILD_DEF[p.k];
  if (typeof id === 'number') { const g = INV.tools.find(t => t.u === id); if (!g) return; if (storeUsed(p) >= B.store) { toast('Full'); return; } unequip(g); INV.tools.splice(INV.tools.indexOf(g), 1); p.rec.gear.push(g); }
  else { if (B.gearOnly) { toast('Weapons and tools only'); return; } if (!p.rec.inv[id] && storeUsed(p) >= B.store) { toast('Full'); return; } const n = all ? cnt(id) : 1; take(id, n); p.rec.inv[id] = (p.rec.inv[id] || 0) + n; }
  sfx('pickup'); save();
}
function storeTake(id, all) {
  const p = storeAt;
  if (typeof id === 'number') { const j = p.rec.gear.findIndex(g => g.u === id); if (j < 0) return; INV.tools.push(p.rec.gear.splice(j, 1)[0]); }
  else { const n = all ? p.rec.inv[id] : 1; give(id, n); p.rec.inv[id] -= n; if (p.rec.inv[id] <= 0) delete p.rec.inv[id]; }
  sfx('pickup'); save();
}

/* ================= exploration (Nov 11, Part 1 of the overhaul) =================
   New places all over the map, things left behind that tell what happened before the Arc came down, hidden stashes,
   and places under the ground you climb down into.
   · XSITE_DEFS: every new place, with where it would like to be; `xSites()` nudges each one onto workable ground
     (flat enough, dry, off the roads, clear of every older place) the first time it's asked — before the forest grows,
     so `xClear` can keep trees off them. The forest builders still spend their random numbers on a tree that lands in
     a site (it just isn't drawn), so nothing that was already in the world moves.
   · LOGS: notes, recordings, terminals, photos, maps and carvings. Reading one files it in the Journal (bag → Journal);
     some mark a place or a stash on the map (`XMARKS`).
   · pockets: places under the ground (a cellar, a cave, an old rail tunnel, an army bunker, a research lab). Each is
     built out past the edge of the walkable world (the far corners, beyond WORLD), so nothing on the surface can wander
     in; climbing down moves you there and the pocket's own rooms are your walls and floors (`pocketCollide`). Rooms are
     axis-aligned boxes; walls are worked out from which boxes touch (`xSeal`). Doors can need power (a fuse in the
     generator), a key, or a tool. Radiation (`P.rad`) sits in a few rooms and at Brightwater; a hazmat suit or a gas
     mask keeps it off you, Juno or Rust medicine clears it.
   · surface builders use their own random stream (XS_SEED), and swap the world's stream out while they run, so adding
     a place here never moves anything else. */

let XS_SEED = 311041;
const xrnd = () => (XS_SEED = (XS_SEED * 16807) % 2147483647, (XS_SEED - 1) / 2147483646), xr = (a, b) => a + xrnd() * (b - a), xp = a => a[Math.floor(xrnd() * a.length)];
const UG_Y = -150;                         // the floor level of every pocket (well under the terrain out at the corners)
const XHPI = Math.PI / 2;
const xSm = (c, o) => S(c, o);          // the standard-material maker (site code below names its site S)

/* ---------- new story items (keys, cards) ---------- */
for (const [id, n, w] of [['hesper_key', 'Hesper armory key', .05], ['bw_card', 'Brightwater keycard', .02], ['fuse_box', 'Generator fuse', .2]]) if (!ITEMS[id]) ITEMS[id] = { id, n, c: 'story', t: 1, src: 'story', w };
Object.assign(LORE, {
  hesper_key: 'Stamped FORT HESPER · ARMORY. Opens the armory door in the bunker under the fort.',
  bw_card: 'BRIGHTWATER RESEARCH · LEVEL 3. Opens the archive in the lab under the Brightwater Annex.',
});
LOCKS.hk = ['hesper_key', 'Unlock it (armory key)']; LOCKS.bw = ['bw_card', 'Swipe the Brightwater keycard'];

/* ================= the places ================= */
// tx/tz: where it would like to be · r: how much ground it needs · sl: how uneven that ground may be · hill: wants a slope (a door into a hillside)
const XSITE_DEFS = [
  { id: 'millbrook', name: 'MILLBROOK', sub: 'A farm village from before the fire · nobody left', tx: 230, tz: 40, r: 42, sl: .22, kind: 'valley' },
  { id: 'kvrn', name: 'KVRN RELAY STATION', sub: 'An old-world radio station on the south rim', tx: 60, tz: 650, r: 22, sl: .3 },
  { id: 'cave', name: 'WHISPER CAVE', sub: 'Cold air breathes out of the hill', tx: 110, tz: -245, r: 10, sl: .9, hill: 1 },
  { id: 'summit', name: 'KESTREL RIDGE', sub: 'The whole valley from up here', tx: 20, tz: -205, r: 9, sl: .6, peak: 1 },
  { id: 'tunA', name: 'COLDWATER LINE · WEST PORTAL', sub: 'An old rail tunnel through the rim', tx: 520, tz: -380, r: 12, sl: 1, hill: 1 },
  { id: 'tunB', name: 'COLDWATER LINE · EAST PORTAL', sub: 'An old rail tunnel through the rim', tx: 880, tz: -560, r: 12, sl: 1, hill: 1 },
  { id: 'hesper', name: 'FORT HESPER', sub: 'Old-world army post · Ironjaw squatters', tx: -1150, tz: 700, r: 44, sl: .2, hostile: 1 },
  { id: 'bright', name: 'BRIGHTWATER ANNEX', sub: 'A research station · the fence still says KEEP OUT', tx: 900, tz: 900, r: 34, sl: .22 },
  { id: 'longfall', name: 'THE LONG FALL', sub: 'Another piece of the Arc · it came down years before you', tx: 1700, tz: 900, r: 46, sl: .3 },
  { id: 'route9', name: 'ROUTE 9', sub: 'An old-world highway · the traffic never moved again', tx: -190, tz: 1620, r: 30, sl: .5, road: 1 },
  { id: 'ember', name: 'EMBER REST', sub: 'A clan camp · burnt out', tx: -1500, tz: -1300, r: 30, sl: .3 },
  { id: 'blackdoor', name: 'THE BLACK DOOR', sub: 'A blast door in the hill · the keypad is still lit', tx: -560, tz: -560, r: 8, sl: 1, hill: 1 },
  // the river crossings and the little camps are placed by their own rules (see xSites)
];
const XCAMP_T = [[-420, 380], [380, 520], [600, -250], [-560, 120], [1000, 0], [-200, 900], [-900, -200], [1250, 400]];
const XSTASH_T = [[300, -470], [-470, 470], [700, 300], [-1000, 1300], [1450, -1250], [-1650, -500]];
let XSITES = null, XTRAIL = [], XROAD = [], XCAMPS = [], XSTASH = [], XCROSS = {};
function xAvoid() {
  const A = [[0, 0, CAMP_R + 60]];
  for (const k in POI) { const p = POI[k]; if (p && typeof p.x === 'number') A.push([p.x, p.z, k === 'lake' ? LAKES[0].R + 30 : 50]); }
  for (const H of HOLDS) A.push([H.x, H.z, H.R + 40]);
  A.push([CITY.x, CITY.z, CITY.R + 40]); for (const B of BASES) A.push([B.x, B.z, B.R + 40]);
  for (const s of SCOUTS) A.push([s.x, s.z, 28]); for (const s of SHELTERS) A.push([s.x, s.z, 16]);
  for (const m of MEADOWS) A.push([m.x, m.z, 32]); for (const m of OUT_MEADOWS) A.push([m.x, m.z, 48]);
  for (const L of LAKES) A.push([L.x, L.z, L.R + 14]);
  for (const s of envSites()) A.push([s.x, s.z, s.r + 10]);
  return A;
}
function xFind(D, taken, AV) {
  const ok = (x, z) => {
    const d0 = Math.hypot(x, z); if (d0 > WORLD - D.r - 60 || d0 < CAMP_R + 70) return false;
    if (D.kind === 'valley' && d0 > VALLEY - 40) return false;
    for (const [ax, az, ar] of AV) if (Math.hypot(x - ax, z - az) < ar + D.r) return false;
    for (const t of taken) if (Math.hypot(x - t.x, z - t.z) < t.r + D.r + 20) return false;
    if (Math.abs(x - riverX(z)) < RIV_HW + D.r + 10) return false;
    if (!D.road && pathDist(x, z) < D.r * .8 + 4) return false;
    const sl = slopeAt(x, z);
    if (D.hill) return sl > .35 && sl < D.sl * 1.3 && waterAt(x, z) < heightAt(x, z) - 2;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 13; i++) { const a = i / 12 * 6.283, rr2 = i ? D.r * (i % 2 ? .5 : .9) : 0, px = x + Math.cos(a) * rr2, pz = z + Math.sin(a) * rr2, h = heightAt(px, pz);
      if (waterAt(px, pz) > h - .5) return false; lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo <= D.r * D.sl && sl < D.sl * 2;
  };
  for (let ring = 0; ring <= 48; ring++) {
    const rad = ring * 8, n = ring ? Math.max(8, Math.round(rad / 5)) : 1;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + ring * .7, x = D.tx + Math.cos(a) * rad, z = D.tz + Math.sin(a) * rad; if (ok(x, z)) return { x, z }; }
  }
  return { x: D.tx, z: D.tz, forced: 1 };
}
// the highest ground within `r` of a point
function xPeak(x0, z0, r) { let b = [x0, z0, -1e9]; for (let x = x0 - r; x <= x0 + r; x += 4) for (let z = z0 - r; z <= z0 + r; z += 4) { if (Math.hypot(x - x0, z - z0) > r) continue; const h = heightAt(x, z); if (h > b[2]) b = [x, z, h]; } return { x: b[0], z: b[1] }; }
// which way a hillside faces (downhill, away from the slope)
function xDownhill(x, z) { const hx = heightAt(x + 3, z) - heightAt(x - 3, z), hz = heightAt(x, z + 3) - heightAt(x, z - 3); return Math.atan2(-hx, -hz); }
function xSites() {
  if (XSITES) return XSITES; XSITES = {};
  const AV = xAvoid(), taken = [];
  for (const D of XSITE_DEFS) {
    let s;
    if (D.peak) s = xPeak(D.tx, D.tz, 70);
    else s = xFind(D, taken, AV);
    const S = XSITES[D.id] = { ...D, x: s.x, z: s.z, y: heightAt(s.x, s.z) };
    if (D.hill) S.face = xDownhill(S.x, S.z);
    taken.push(S);
  }
  // the ridge trail: from behind Kestrel up to the top of the ridge, then down the far side to the cave
  { const pts = [[64, -96], [96, -140], [70, -176], [XSITES.summit.x, XSITES.summit.z], [(XSITES.summit.x + XSITES.cave.x) / 2 + 10, (XSITES.summit.z + XSITES.cave.z) / 2], [XSITES.cave.x + Math.sin(XSITES.cave.face) * 8, XSITES.cave.z + Math.cos(XSITES.cave.face) * 8]];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6); for (let k = 0; k < n; k++) XTRAIL.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]); }
    XTRAIL.push(pts[pts.length - 1]); }
  // Route 9: a long straight-ish run of old highway across the south of the outlands
  { const R = XSITES.route9, a = -.25, L = 520; for (let k = -L; k <= L; k += 10) { const bend = Math.sin(k / L * 1.6) * 40; XROAD.push([R.x + Math.cos(a) * k - Math.sin(a) * bend, R.z + Math.sin(a) * k + Math.cos(a) * bend]); } }
  // little camps: somebody stopped here once
  for (let i = 0; i < XCAMP_T.length; i++) { const s = xFind({ tx: XCAMP_T[i][0], tz: XCAMP_T[i][1], r: 7, sl: .35 }, taken, AV); const S = { id: 'camp' + i, x: s.x, z: s.z, r: 7 }; XCAMPS.push(S); taken.push(S); }
  for (let i = 0; i < XSTASH_T.length; i++) { const s = xFind({ tx: XSTASH_T[i][0], tz: XSTASH_T[i][1], r: 4, sl: .5 }, taken, AV); const S = { id: 'stash' + i, x: s.x, z: s.z, r: 4 }; XSTASH.push(S); taken.push(S); }
  // the river crossings: a rope bridge over the gorge in the north, stepping stones across the shallows in the south
  const cross = (z0, z1, want) => { let b = null; for (let z = z0; z <= z1; z += 6) { const rx = riverX(z), xl = rx - RIV_HW - 7, xr2 = rx + RIV_HW + 7, hl = heightAt(xl, z), hr2 = heightAt(xr2, z), wl = riverWL(z);
    if (waterAt(xl, z) > hl - .2 || waterAt(xr2, z) > hr2 - .2) continue; const sc = want === 'high' ? Math.abs(hl - hr2) * 3 - Math.min(hl, hr2) + wl : Math.abs(hl - hr2) * 2 + Math.abs(Math.min(hl, hr2) - wl - 1.5) * 3;
    if (Math.hypot(rx - POI.bridge.x, z - POI.bridge.z) < 120 || Math.hypot(rx - POI.burn.x, z - POI.burn.z) < 90 || Math.hypot(rx - POI.halvard.x, z - POI.halvard.z) < 110) continue;
    if (!b || sc < b.sc) b = { z, xl, xr: xr2, hl, hr: hr2, wl, sc }; } return b; };
  XCROSS.rope = cross(-470, -200, 'high'); XCROSS.ford = cross(440, 620, 'low');
  return XSITES;
}
const xSegD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
// keep the forest (and the boulders) off a new place, the trail and the highway
function xClear(x, z) {
  const S = xSites();
  for (const k in S) { const s = S[k]; const r = s.hill ? s.r + 4 : s.peak ? s.r + 3 : s.r + 6; if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r && Math.hypot(x - s.x, z - s.z) < r) return true; }
  for (const c of XCAMPS) if (Math.hypot(x - c.x, z - c.z) < 9) return true;
  for (let i = 0; i < XTRAIL.length; i += 1) { const [tx, tz] = XTRAIL[i]; if (Math.abs(x - tx) < 3.6 && Math.abs(z - tz) < 3.6) return true; }
  for (let i = 0; i < XROAD.length - 1; i++) { const [ax, az] = XROAD[i], [bx, bz] = XROAD[i + 1]; if (Math.abs(x - ax) > 20 || Math.abs(z - az) > 20) continue; if (xSegD(x, z, ax, az, bx, bz) < 10) return true; }
  for (const c of Object.values(XCROSS)) if (c && Math.abs(z - c.z) < 6 && x > c.xl - 8 && x < c.xr + 8) return true;
  return false;
}
// a matrix that hides an instance (trees in a site are still "grown", so nothing else moves — they just aren't drawn)
const X_HIDE = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);

/* ================= lore ================= */
// kind: note · rec (a recording) · term (a terminal) · photo · map · carve (marks cut in stone or wood)
const LOGS = {
  // Millbrook + the cellar under it
  mb_notice: { at: 'Millbrook', kind: 'note', t: 'Notice, nailed to the well', by: 'Millbrook council', b: 'By order of the Provincial Guard: every household is to walk to FORT HESPER by the north road. Take water, take warm clothes, leave the animals. The trucks are not coming. Do not wait for them.\n\nThe Rourke place has not answered. If anyone sees Ansel, tell him the order includes him.' },
  mb_letter: { at: 'Millbrook', kind: 'note', t: 'A letter on a kitchen table', by: 'Ada', b: 'Tom — we went with the others. The sky was green again last night, and the radio says the Guard will have power at Hesper for months. Mum would not leave the garden so we carried her. I left you the good knife under the floorboard by the stove. Come and find us. — Ada' },
  mb_rourke1: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · day 3', by: 'Ansel Rourke', b: 'Day 3 below. They all walked to Hesper. Fools. The army doesn’t have enough for itself, never mind three hundred farmers. I have eleven months of tins, a hand pump to the well and a filter. When the sun settles I’ll come up and the valley will be mine.' },
  mb_rourke2: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · day 61', by: 'Ansel Rourke', b: 'Day 61. Somebody knocked on the doors last night. Three knocks, then nothing. I didn’t open. In the morning there were tracks in the frost going north, toward Hesper, and the frost was pink.\n\nI have moved the important things behind the shelf.' },
  mb_rourke3: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · last page', by: 'Ansel Rourke', b: 'Day 140, I think. The pump died. The well tastes of copper. I went up once and the trees were wrong — taller, and the fog that came in over the ridge was red and it burned my throat.\n\nThe map is for whoever finds this. Hesper has a bunker under it. Their generator runs on fuses like mine. The Guard will have left the armory locked, they always did.' },
  mb_photo: { at: 'Millbrook', kind: 'photo', t: 'A photo in a cracked frame', by: '', b: 'A harvest fair. Bunting over the street you’re standing in, a tractor with ribbons on it, forty people squinting into the sun. Someone has written on the back: MILLBROOK, LAST GOOD SUMMER.' },
  // the ridge, the cave
  rd_summit: { at: 'Kestrel Ridge', kind: 'note', t: 'Pages pinned under a stone', by: 'Maren Ostby, Arc scout', b: 'Climbed up to signal the Arc with the mirror. No answer — the ring’s gone dark over the sea. From up here you can see everything: the river, the black scar of the Burn, smoke from the clan holds.\n\nThere is a cave on the far side of this ridge. Cold air comes out of it, and at night I could swear it hums.' },
  cv_painting: { at: 'Whisper Cave', kind: 'carve', t: 'Paintings on the cave wall', by: 'Thornkin, long ago', b: 'Red ochre and soot. People with spears, a herd of deer — and above them, a great ring in the sky, falling, and a red cloud rolling out from under it. The people in the paintings are running into this cave.\n\nUnder the cloud someone has painted thirteen standing stones.' },
  cv_rec: { at: 'Whisper Cave', kind: 'rec', t: 'A field recorder', by: 'Dr. Paulo Iness, survey team', b: '“…cave system extends at least four hundred metres. Air temperature constant at eight degrees. The hum we keep hearing isn’t geological — there’s a regular period to it, eleven seconds. Something underneath is running. Peretz thinks it’s old mine machinery. I think we should leave.” [static]' },
  cv_deep: { at: 'Whisper Cave · the deep chamber', kind: 'carve', t: 'Words cut into the stone', by: 'Unknown', b: 'Thirteen marks in a ring, and in the middle, newer, scratched with a blade:\n\nWHEN THE HEART-LIGHT IS RED, KNOCK SEVEN TIMES QUICKLY AND THE SKY WILL OPEN.\n\n(Your health bar is red. You wonder.)' },
  // the rail tunnel
  tn_order: { at: 'Coldwater Line', kind: 'note', t: 'A sign wired to the portal', by: 'Hesper Command', b: 'TUNNEL CLOSED TO CIVILIAN TRAFFIC. BY ORDER OF HESPER COMMAND. ANYONE FOUND IN THE COLDWATER LINE WITHOUT A PASS WILL BE TURNED BACK.\n\nUnderneath, in marker: they didn’t turn anyone back. they just closed the doors.' },
  tn_rec: { at: 'Coldwater Line', kind: 'rec', t: 'A maintenance logger', by: 'Line engineer K. Doyle', b: '“Maintenance bay, shift log. Generator’s down again — third fuse this week. Spare’s in the bay but the bay won’t open without power, which is genius. If you’re hearing this and you’ve got a fuse, the panel is in the alcove opposite. Bring the bay up and take whatever you need. I won’t be back for it.”' },
  // the radio station
  kv_term: { at: 'KVRN Relay Station', kind: 'term', t: 'The broadcast desk', by: 'KVRN automated log', b: '> LAST TRANSMISSION 04:12\n> “…flare activity off every scale we have. Stay indoors. Stay away from windows. If the sky turns green, that is not the aurora you know, that is the grid going. Go below ground if you can. This is KVRN, and we’ll keep talking for as long as we can—”\n> SIGNAL LOST' },
  kv_numbers: { at: 'KVRN Relay Station', kind: 'rec', t: 'A tape loop, still turning', by: 'Unknown', b: 'A woman’s voice, very calm, over and over:\n\n“Nine. Nine. Site Nine awaits the signal. Lantern is lit. Lantern is lit. Nine.”\n\nThen eleven seconds of a low hum, and it starts again.' },
  kv_log: { at: 'KVRN Relay Station', kind: 'note', t: 'Station manager’s notebook', by: 'Hal Brenner', b: 'The army asked us to keep a channel open for them — a tone, nothing else, every eleven seconds. They wouldn’t say what it was for. When I asked where it was going, the colonel pointed west at the hills and said “a door.”' },
  // Fort Hesper + the bunker under it
  hs_iron: { at: 'Fort Hesper', kind: 'note', t: 'A scrawled note', by: 'Ironjaw', b: 'Boss — the bunker’s dead. No lights, and the big door at the back won’t move without power. Gnash tried a crowbar and broke his arm. Somebody needs to find fuses or we’re sitting on top of a locked armory like idiots.' },
  hs_duty: { at: 'Hesper Bunker', kind: 'note', t: 'Duty roster', by: '4th Provincial Guard', b: 'Week 9. Civilians at the gate: 312. Rations: 40 days at half. The order from Command is unchanged — no more civilians inside. Sergeant Wills refused it and has been relieved.' },
  hs_cmd: { at: 'Hesper Bunker', kind: 'term', t: 'The commander’s terminal', by: 'Col. R. Avens', b: '> Brightwater wants the sick ones sent up to them. They say they can treat the burns from the fog. I don’t believe them, but I don’t have medicine and they do.\n> Transport leaves at dawn. I’m sending the Brightwater liaison’s keycard with the convoy so they stop asking me for it.\n> Note: the card never left. It’s in my desk. I don’t want anyone going back there.' },
  hs_letter: { at: 'Hesper Bunker', kind: 'note', t: 'A letter that was never sent', by: 'Pvt. Ibby Sohn', b: 'Dad — they’re saying the fog is from Brightwater. That they made it. Everyone in the mess says it like a joke and nobody laughs. If I get out I’m going east to the coast. Don’t come here. Don’t let anyone send you to the lab.' },
  // Brightwater
  bw_sign: { at: 'Brightwater Annex', kind: 'note', t: 'A sign on the fence', by: 'Brightwater Research', b: 'RESTRICTED · BIOLOGICAL AND RADIOLOGICAL WORK IN PROGRESS · AUTHORISED STAFF ONLY. Below that, a newer sign, hand-painted: THE FOG COMES FROM HERE.' },
  bw_varga1: { at: 'Brightwater Lab', kind: 'term', t: 'Lab terminal · Dr. Varga', by: 'Dr. Ilse Varga', b: '> SPECIMEN R, SERIES 4.\n> The agent was meant to carry the shield into the lungs — a mist you breathe once and you never burn again. It works. It works too well. It binds iron. It turns the air red.\n> Dr. Arden says the Greyhold people want samples. I said no. I don’t think I get to say no.' },
  bw_varga2: { at: 'Brightwater Lab', kind: 'rec', t: 'A voice memo', by: 'Dr. Ilse Varga', b: '“The tank in B is cracked. I’ve sealed the room. Anyone going in needs a suit — not because of the agent, because of the shielding salts, they’re hot. I’m leaving the suits in the locker. I am leaving. Arden is staying. God help her.”' },
  bw_liaison: { at: 'Brightwater Lab', kind: 'note', t: 'Memo, stamped GREYHOLD', by: 'Greyhold liaison', b: 'Transfer of all surviving subjects to the mountain facility is approved. The subjects who show tolerance to the agent are of particular value. Their blood is to be preserved. Their names are not.' },
  bw_archive: { at: 'Brightwater Archive', kind: 'term', t: 'Archive terminal', by: 'Brightwater Research', b: '> PROJECT LANTERN — SUMMARY\n> Three sites. One sealed under the mountain (GREYHOLD). One that never answered (MERIDIAN). One kept dark until the signal: SITE NINE, west of the relay, in the hill.\n> When the sun flares again, Lantern is to be lit.\n> [the rest of the file is corrupted]' },
  // the Long Fall
  lf_rec: { at: 'The Long Fall', kind: 'rec', t: 'A black box, still talking', by: 'Hydroponics Ring C', b: '“This is Ring C. We separated early — the clamps blew. We’re coming down long, over the hills. Tell the Council it wasn’t sabotage, it was the clamps, it was always the clamps. Tell my boy I— [impact]”' },
  lf_manifest: { at: 'The Long Fall', kind: 'term', t: 'Cargo manifest', by: 'Ring C', b: '> RING C — HYDROPONICS · 41 crew\n> Seed vault (sealed) · water reclaimer · med stores\n> Dropped: year 87 of the Arc. Recovered: never.\n> Somebody has scratched into the screen bezel: 9 OF US WALKED OUT. WE WENT TO THE LAKE.' },
  // Route 9
  r9_note: { at: 'Route 9', kind: 'note', t: 'A note under a wiper', by: 'Unknown', b: 'Traffic hasn’t moved in two days. The Guard says Hesper is full. Someone on the radio says Brightwater is taking people in. We’re going to walk. If you find our car, the water in the boot is clean — take it.' },
  r9_photo: { at: 'Route 9', kind: 'photo', t: 'A class photo on a bus seat', by: '', b: 'Thirty kids in matching sweaters, MILLBROOK SCHOOL — YEAR 4 on a chalkboard behind them. The teacher is holding up a drawing of the sun, coloured green.' },
  // Ember Rest
  em_carve: { at: 'Ember Rest', kind: 'carve', t: 'Marks cut into a fallen pole', by: 'A Thornkin survivor', b: 'Clan marks, cut fast. You can read some of them now:\n\nRED FOG IN THE NIGHT. MEN WITH NO FACES WALKED IN IT. THEY TOOK THE YOUNG AND THE STRONG. THEY WENT TO THE GREY MOUNTAIN. WE BURNED OUR DEAD AND WE RAN.' },
  // the Black Door
  bd_keypad: { at: 'The Black Door', kind: 'term', t: 'The keypad', by: 'SITE 9', b: '> SITE 9 · LANTERN PROTOCOL\n> STATUS: AWAITING SIGNAL\n> MANUAL ENTRY DISABLED\n\nThe keypad is warm. Somewhere behind the door, something hums every eleven seconds.' },
  // the camps
  cp0: { at: 'A camp by the trees', kind: 'note', t: 'Carved into a log', by: 'Hunters', b: 'TAV + REN · SPLIT UP AT THE RIVER · MEET BACK HERE IN 3 DAYS. The carving is old. Under it, only one more line: DAY 9. STILL WAITING.' },
  cp1: { at: 'A camp in the hills', kind: 'note', t: 'A page from a notebook', by: 'An Arc kid', b: 'Day 9 by myself. The pod’s radio only does static. I ate the last bar. If anyone from the Arc finds this I went toward the smoke in the north because smoke means people. Please be the right people.' },
  cp2: { at: 'A scout’s camp', kind: 'map', t: 'A scavenger’s map', by: 'Ironjaw', b: 'A hand-drawn map, mostly crossings-out. Three of the marks have the same sign beside them — three short bars — and one is circled: “stash, not ours, didn’t touch it.”', mark: 'stash1' },
  cp3: { at: 'A camp under the pines', kind: 'carve', t: 'An offering stone', by: 'Thornkin', b: 'A flat stone with feathers, a bone bead and a clan mark pressed into clay. The mark means “we were here and we left in peace.” Somebody keeps the feathers fresh.' },
  cp4: { at: 'An old campsite', kind: 'photo', t: 'A photo tucked into a boot', by: '', b: 'A family in front of a tent — this tent — waving. The date on the back is three days before the sky went green.' },
  cp5: { at: 'A camp in the open', kind: 'note', t: 'A field report, half burned', by: 'Greyhold patrol', b: 'Sweep 14. Two specimens collected from the lake shore, both tolerant. Thornkin scouts sighted; avoided. Fog window closes at dawn. Recommend we bring the Reavers next time — the clans don’t run from us any more.' },
  cp6: { at: 'A drover’s camp', kind: 'note', t: 'A tally board', by: 'A drover', b: 'Cattle counted every night, marks in rows of five. The rows stop at forty-one. Then, in a different hand: wolves.' },
  cp7: { at: 'A lookout camp', kind: 'note', t: 'A note in a tin', by: 'Rook, Kestrel', b: 'If you’re reading this you came the long way. The tunnel through the east rim — the Coldwater Line — cuts two hours off. Bring a light. And a fuse, if you can spare one.' },
  // the mark: the stash sign
  mk_mark: { at: 'A marked stash', kind: 'carve', t: 'Three short bars', by: 'Old smugglers’ sign', b: 'Three short bars, cut or painted on a rock, mean “something is buried here, take what you need, leave the rest.” Once you know the sign you see it everywhere. Two more of them are near — you scratch them onto your map.', mark: ['stash2', 'stash3'] },
};
const LOG_KIND = { note: ['Read the note', 'Note'], rec: ['Play the recording', 'Recording'], term: ['Read the terminal', 'Terminal'], photo: ['Look at the photo', 'Photo'], map: ['Look at the map', 'Map'], carve: ['Read the marks', 'Carving'] };
const XNOTES = [];   // { x, y, z, id, g, pocket }
const XUSE = [];     // generic things to use: { x, y, z, r, pocket, label(), act() }
const XMARKS = {};   // map marks a log can reveal: id → { x, z, n }
const XANIM = [];    // per-frame animations (doors, the collapsing floor, lamps)
const XRAD = [];     // surface radiation: { x, z, r, k }
const XRESTORE = []; // put doors, power, shelves and floors back the way the save has them (run when a game starts)

/* ================= helpers ================= */
const XMAT = {};
function xm(key) {
  if (XMAT[key]) return XMAT[key];
  const t = (tex, rep) => { const c = tex.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; if (rep) c.repeat.set(rep, rep); return c; };
  const D = {
    conc: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xb8b2a8 }), concD: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x7a766e }),
    concW: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xd8d4cc }), tile: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xc8ccc8 }),
    rock: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a746c }), rockD: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x55504a }),
    dirt: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x5a4a3a }), wood: () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a7258 }),
    woodD: () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x5a4636 }), panel: () => new THREE.MeshStandardMaterial({ map: texPanel, color: 0x9aa0a0, metalness: .45, roughness: .6 }),
    rust: () => new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a5a3a }), olive: () => new THREE.MeshLambertMaterial({ map: texCorr, color: 0x5a6248 }),
    metal: () => new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x8a8e90, metalness: .5, roughness: .55 }), dark: () => new THREE.MeshLambertMaterial({ color: 0x0a0a0a }),
    asphalt: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x4a4a48 }), sand: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a8a6a }),
    bone: () => new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }), cloth: () => new THREE.MeshLambertMaterial({ color: 0x8a3a2a, side: THREE.DoubleSide }),
    paper: () => new THREE.MeshBasicMaterial({ color: 0xe8e2cc, side: THREE.DoubleSide }), glass: () => new THREE.MeshStandardMaterial({ color: 0x6a9a8a, transparent: true, opacity: .35, roughness: .1, metalness: .2 }),
    glowG: () => new THREE.MeshBasicMaterial({ color: 0x6aff9a, toneMapped: false }), glowR: () => new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }),
    glowA: () => new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false }), glowW: () => new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false }),
    glowT: () => new THREE.MeshBasicMaterial({ color: 0x5ae0d0, toneMapped: false }), screen: () => new THREE.MeshBasicMaterial({ color: 0x3ad07a, toneMapped: false }),
    water: () => new THREE.MeshStandardMaterial({ color: 0x1a2a2c, roughness: .05, metalness: .6, transparent: true, opacity: .85 }),
    char: () => new THREE.MeshLambertMaterial({ color: 0x1e1a16 }), hide: () => new THREE.MeshLambertMaterial({ color: 0x6a4a32, side: THREE.DoubleSide }),
    paint: () => new THREE.MeshBasicMaterial({ color: 0xd84a2a }), white: () => new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), yellow: () => new THREE.MeshLambertMaterial({ color: 0xd8b040 }),
  };
  return XMAT[key] = D[key]();
}
// a box with its texture tiled by size, so walls don't stretch
function xbox(parent, w, h, d, mat, x, y, z, ry = 0, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, tile, 0, 0);
  const m = mesh(g, typeof mat === 'string' ? xm(mat) : mat, x, y, z, parent); m.rotation.y = ry; return m;
}
const xcyl = (parent, r0, r1, h, mat, x, y, z, seg = 10) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), typeof mat === 'string' ? xm(mat) : mat, x, y, z, parent);
// a local frame round a point, turned by yaw: W(lx, lz) → world x, z
const xFrame = (cx, cz, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
// a model from the kit, scaled to a height
function xModel(parent, name, h, x, y, z, ry = 0) { const W = whole(name); if (!W) return null; return envPut(parent, name, x, y, z, ry, h / W.size.y); }
// bones on the ground
function xSkeleton(parent, x, y, z, yaw = 0, sit = 0) {
  const g = new THREE.Group(), b = xm('bone');
  mesh(new THREE.SphereGeometry(.11, 8, 6), b, 0, sit ? .95 : .11, sit ? -.05 : .62, g);
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(.13 - i * .008, .012, 4, 10, Math.PI), b, 0, sit ? .75 - i * .07 : .1, sit ? 0 : .38 - i * .07, g); r.rotation.set(sit ? 0 : -XHPI, 0, 0); }
  const spine = mesh(new THREE.CylinderGeometry(.02, .02, .55, 5), b, 0, sit ? .6 : .06, sit ? 0 : .2, g); if (!sit) spine.rotation.x = XHPI;
  for (const s of [-1, 1]) {
    const f = mesh(new THREE.CylinderGeometry(.025, .02, .45, 5), b, s * .1, sit ? .42 : .05, sit ? .2 : -.25, g); f.rotation.set(sit ? XHPI : XHPI + s * .15, 0, s * .1);
    const sh = mesh(new THREE.CylinderGeometry(.02, .015, .42, 5), b, s * .12, sit ? .2 : .04, sit ? .42 : -.68, g); sh.rotation.set(sit ? 0 : XHPI, 0, s * .05);
    const a = mesh(new THREE.CylinderGeometry(.018, .015, .5, 5), b, s * .22, sit ? .55 : .05, sit ? .1 : .25, g); a.rotation.set(sit ? .6 : XHPI + s * .4, 0, s * .3);
  }
  g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g); return g;
}
// a pile of junk/rubble
function xRubble(parent, x, y, z, n, spread, mat = 'concD') { for (let i = 0; i < n; i++) { const s = xr(.25, 1.1), m = mesh(new THREE.DodecahedronGeometry(s, 0), xm(mat), x + xr(-spread, spread), y + s * .4, z + xr(-spread, spread), parent); m.rotation.set(xr(0, 3), xr(0, 3), xr(0, 3)); m.scale.y = xr(.4, .9); } }
// a pickup that tells you something
function xNote(parent, id, x, y, z, yaw = 0, pocket = null) {
  const L = LOGS[id]; if (!L) return; const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  if (L.kind === 'note' || L.kind === 'photo' || L.kind === 'map') {
    const p = mesh(new THREE.PlaneGeometry(L.kind === 'map' ? .42 : .22, L.kind === 'map' ? .32 : .3), L.kind === 'photo' ? new THREE.MeshBasicMaterial({ color: 0xc8b890, side: THREE.DoubleSide }) : xm('paper'), 0, .02, 0, g); p.rotation.x = -XHPI; p.rotation.z = xr(-.4, .4);
    if (L.kind === 'photo') { const f = mesh(new THREE.PlaneGeometry(.16, .12), new THREE.MeshBasicMaterial({ color: 0x5a4a3a }), 0, .025, -.02, g); f.rotation.x = -XHPI; }
  } else if (L.kind === 'rec') {
    xbox(g, .26, .09, .17, 'woodD', 0, .045, 0); xbox(g, .22, .02, .1, 'dark', 0, .1, 0);
    const led = mesh(new THREE.SphereGeometry(.015, 6, 4), xm('glowR'), .1, .095, .07, g); XANIM.push(t => { led.visible = Math.sin(t * 5) > 0; });
  } else if (L.kind === 'term') {
    if (!xModel(g, 'props/computer-console', 1.1, 0, 0, 0, 0)) { xbox(g, .9, .9, .6, 'metal', 0, .45, 0); }
    const sc = mesh(new THREE.PlaneGeometry(.5, .32), xm('screen'), 0, 1.02, .32, g); sc.rotation.x = -.35; XANIM.push(t => { sc.material.color.setHSL(.38, .7, .35 + Math.sin(t * 2 + x) * .04); });
  } else if (L.kind === 'carve') {
    const m = mesh(new THREE.PlaneGeometry(.6, .4), new THREE.MeshBasicMaterial({ color: 0xc8a070, transparent: true, opacity: .5, side: THREE.DoubleSide }), 0, .6, 0, g);
  }
  // a faint glint so things left behind can be spotted
  if (L.kind !== 'term') { const gl = new THREE.Mesh(new THREE.OctahedronGeometry(.045), new THREE.MeshBasicMaterial({ color: 0xffe8b0, toneMapped: false })); gl.position.y = L.kind === 'carve' ? .95 : .3; g.add(gl); XANIM.push(t => { gl.position.y = (L.kind === 'carve' ? .95 : .3) + Math.sin(t * 2.4 + x) * .05; gl.visible = !(G.flags.logs || {})[id] && Math.sin(t * 3 + z) > -.4; }); }
  XNOTES.push({ x, y, z, id, g, pocket });
}
function xUse(o) { XUSE.push(o); return o; }
// round colliders along a building's walls, with one doorway (width `door`) in the middle of the front (+z) side
function xColRect(x, z, w, d, yaw, r = .5, door = 0) {
  const F = xFrame(x, z, yaw), run = (ax, az, bx, bz, gap) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.3))); for (let i = 0; i <= n; i++) { const lx = lerp(ax, bx, i / n), lz = lerp(az, bz, i / n); if (gap && Math.abs(lx) < door / 2 + r * .6) continue; const [px, pz] = F(lx, lz); addCol(px, pz, r); } };
  run(-w / 2, -d / 2, w / 2, -d / 2); run(-w / 2, d / 2, w / 2, d / 2, door > 0); run(-w / 2, -d / 2, -w / 2, d / 2); run(w / 2, -d / 2, w / 2, d / 2);
}
// surface placement: group at a point on the ground
function xPlace(obj, x, z, yaw = 0, up = 0) { obj.position.set(x, heightAt(x, z) + up, z); obj.rotation.y = yaw; world.add(obj); return obj; }
function xLowest(x, z, w, d, yaw) { let lo = 1e9; const F = xFrame(x, z, yaw); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]]) { const [px, pz] = F(a * w / 2, b * d / 2); lo = Math.min(lo, heightAt(px, pz)); } return lo; }
// a light that's always there (the light pool picks the nearest four each frame)
function xLamp(parent, x, y, z, color, I, dist, fixture = true) {
  const l = new THREE.PointLight(color, I * 1.6, dist * 1.2, 0); l.position.set(x, y, z); parent.add(l);
  if (fixture) { const f = mesh(new THREE.BoxGeometry(.5, .06, .16), new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, y + .05, z, parent); f.castShadow = false; l.userData.fx = f; }
  return l;
}
function xFire(parent, x, y, z, s = 1) {
  const f = new THREE.Mesh(new THREE.ConeGeometry(.45 * s, 1.2 * s, 7), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .9 })); f.position.set(x, y + .55 * s, z); parent.add(f);
  const ph = xr(0, 6); XANIM.push(t => { f.scale.y = 1 + Math.sin(t * 13 + ph) * .25; });
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mesh(new THREE.DodecahedronGeometry(.16 * s, 0), M(0x5a5650), x + Math.cos(a) * .55 * s, y + .08, z + Math.sin(a) * .55 * s, parent); }
  xLamp(parent, x, y + 1.4, z, 0xff8a3a, 1.6, 16, false); return f;
}
function xTent(parent, x, z, yaw, col = 0x6a5a3a, burnt = false) {
  const g = new THREE.Group(), m = burnt ? xm('char') : new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
  const sh = new THREE.Shape([new THREE.Vector2(-1.2, 0), new THREE.Vector2(1.2, 0), new THREE.Vector2(0, 1.4)]);
  const t = mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), m, 0, 0, -1.2, g);
  if (burnt) { t.scale.y = .5; t.rotation.z = .2; }
  mesh(new THREE.PlaneGeometry(.9, 1), xm('dark'), 0, .5, 1.22, g);
  xPlace(g, x, z, yaw); addCol(x, z, 1.1); return g;
}

/* ================= pockets: places under the ground ================= */
const POCKETS = {};
const UG = { at: null, fadeEl: null, tagEl: null, lamp: null, standT: 0 };
// slots out in the far corners of the map, past the edge of the walkable world
const PK_SLOT = { cellar: [1990, 1990], cave: [2130, 1990], hesper: [2270, 2010], lab: [1990, 2150], tunnel: [-2370, -2110] };
function mkPocket(id, name, o = {}) {
  const [ox, oz] = PK_SLOT[id], g = new THREE.Group(); g.visible = false; scene.add(g);
  const pk = { id, name, ox, oz, y: UG_Y, g, rects: [], obst: [], hz: [], weak: [], surf: o.surf || 'metal', fog: o.fog || 70, hemi: (o.hemi ?? .22) + .2, hemiC: o.hemiC || 0x8a9098, power: !!o.power, lamps: [], plamps: [], dyn: new Set(), bounds: [1e9, 1e9, -1e9, -1e9] };
  POCKETS[id] = pk; return pk;
}
const pw = (pk, lx, lz) => [pk.ox + lx, pk.oz + lz];
/* a room: x0..x1, z0..x1 in the pocket's own metres; y up from the pocket floor. Walls come later, in xSeal. */
function xRoom(pk, x0, z0, x1, z1, o = {}) {
  const R = { x0: pk.ox + x0, z0: pk.oz + z0, x1: pk.ox + x1, z1: pk.oz + z1, ylo: pk.y + (o.y || 0), yhi: pk.y + (o.y2 ?? o.y ?? 0), h: o.h || 3, wall: o.wall || 'conc', floor: o.floor || 'concD', ceil: o.ceil || 'concD', nofloor: o.nofloor, noceil: o.noceil, nowall: o.nowall || '', axis: o.axis, tag: o.tag };
  pk.rects.push(R); const b = pk.bounds; b[0] = Math.min(b[0], R.x0); b[1] = Math.min(b[1], R.z0); b[2] = Math.max(b[2], R.x1); b[3] = Math.max(b[3], R.z1);
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, w = R.x1 - R.x0, d = R.z1 - R.z0;
  if (R.ylo === R.yhi) {
    if (!R.nofloor) { xbox(pk.g, w, .3, d, R.floor, cx, R.ylo - .15, cz, 0, 2); addFloor(cx, cz, 0, w / 2, d / 2, R.ylo); }
  } else {        // a ramp or a flight of stairs, climbing along its axis ('x' or 'z')
    const ax = R.axis || 'z', L = ax === 'z' ? d : w, n = Math.max(2, Math.round(L / .32)), rise = R.yhi - R.ylo;
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, y = R.ylo + rise * t;
      if (ax === 'z') xbox(pk.g, w, .3, L / n + .02, R.floor, cx, y - .15, R.z0 + t * d, 0, 2); else xbox(pk.g, L / n + .02, .3, d, R.floor, R.x0 + t * w, y - .15, cz, 0, 2); }
    // FLOORS slope runs along local x: for a z-ramp turn the floor a quarter so local x is world z
    const slope = rise / L;
    if (ax === 'z') FLOORS.push({ cx, cz, c: 0, s: -1, hw: d / 2, hd: w / 2, y: (R.ylo + R.yhi) / 2, slope });
    else FLOORS.push({ cx, cz, c: 1, s: 0, hw: w / 2, hd: d / 2, y: (R.ylo + R.yhi) / 2, slope });
    R.ramp = { ax, slope, cx, cz, mid: (R.ylo + R.yhi) / 2 };
  }
  return R;
}
const rTop = R => Math.max(R.ylo, R.yhi);
/* walls and ceilings: every edge of every room, minus where another room at about the same height crosses it */
function xSeal(pk) {
  const T = .3, E = .05;
  for (const R of pk.rects) {
    const top = rTop(R) + R.h, bot = Math.min(R.ylo, R.yhi);
    const edges = [['z', R.z0, R.x0, R.x1, -1], ['z', R.z1, R.x0, R.x1, 1], ['x', R.x0, R.z0, R.z1, -1], ['x', R.x1, R.z0, R.z1, 1]];
    for (const [ax, at, a0, a1, side] of edges) {
      const key = ax === 'z' ? (side < 0 ? 'n' : 's') : (side < 0 ? 'w' : 'e'); if (R.nowall.includes(key)) continue;
      const gaps = [];
      for (const Q of pk.rects) { if (Q === R) continue;
        if (Math.min(Q.ylo, Q.yhi) > rTop(R) + 1.2 || rTop(Q) < Math.min(R.ylo, R.yhi) - 1.2) continue;
        if (ax === 'z') { if (Q.z0 < at - E && Q.z1 > at + E || (side > 0 ? Q.z0 <= at + E && Q.z1 > at + E : Q.z1 >= at - E && Q.z0 < at - E)) { const g0 = Math.max(a0, Q.x0), g1 = Math.min(a1, Q.x1); if (g1 > g0 + .1) gaps.push([g0, g1]); } }
        else { if (Q.x0 < at - E && Q.x1 > at + E || (side > 0 ? Q.x0 <= at + E && Q.x1 > at + E : Q.x1 >= at - E && Q.x0 < at - E)) { const g0 = Math.max(a0, Q.z0), g1 = Math.min(a1, Q.z1); if (g1 > g0 + .1) gaps.push([g0, g1]); } }
      }
      gaps.sort((p, q) => p[0] - q[0]); let s = a0; const runs = [];
      for (const [g0, g1] of gaps) { if (g0 > s) runs.push([s, g0]); s = Math.max(s, g1); } if (a1 > s) runs.push([s, a1]);
      for (const [r0, r1] of runs) { const L = r1 - r0; if (L < .05) continue; const m = (r0 + r1) / 2, h = top - bot + .3, y = bot + h / 2 - .3;
        if (ax === 'z') xbox(pk.g, L + T * 2, h, T, R.wall, m, y, at + side * T / 2, 0, 2.5); else xbox(pk.g, T, h, L + T * 2, R.wall, at + side * T / 2, y, m, 0, 2.5); }
      // a lintel over each opening, down to the lower of the two ceilings
      for (const [g0, g1] of gaps) { const L = g1 - g0; if (L < .2) continue; const m = (g0 + g1) / 2;
        if (ax === 'z') xbox(pk.g, L, .4, T, R.wall, m, top - .2, at + side * T / 2, 0, 2.5); else xbox(pk.g, T, .4, L, R.wall, at + side * T / 2, top - .2, m, 0, 2.5); }
    }
    if (!R.noceil) xbox(pk.g, R.x1 - R.x0 + T * 2, .3, R.z1 - R.z0 + T * 2, R.ceil, (R.x0 + R.x1) / 2, top + .15, (R.z0 + R.z1) / 2, 0, 2.5);
  }
}
// a solid box that blocks walking inside a pocket (furniture, a closed door)
function xSolid(pk, x0, z0, x1, z1, o = {}) { const B = { x0: pk.ox + x0, z0: pk.oz + z0, x1: pk.ox + x1, z1: pk.oz + z1, on: true, ...o }; pk.obst.push(B); return B; }
// a door across an opening: slides up into the ceiling when opened. need: 'power' | an item id | null
function xDoor(pk, id, lx, lz, axis, width, o = {}) {
  const [x, z] = pw(pk, lx, lz), y = pk.y + (o.y || 0), h = o.h || 2.8, g = new THREE.Group(); g.position.set(x, y, z); pk.g.add(g); pk.dyn.add(g);
  const slab = xbox(g, axis === 'x' ? width : .25, h, axis === 'x' ? .25 : width, o.mat || 'panel', 0, h / 2, 0, 0, 1.5);
  for (const s of [-1, 1]) xbox(g, axis === 'x' ? width * .98 : .28, .12, axis === 'x' ? .28 : width * .98, 'yellow', 0, h / 2 + s * .9, 0);
  const lamp = mesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), axis === 'x' ? width / 2 + .2 : 0, 1.5, axis === 'x' ? 0 : width / 2 + .2, g);
  const B = xSolid(pk, lx - (axis === 'x' ? width / 2 : .35), lz - (axis === 'x' ? .35 : width / 2), lx + (axis === 'x' ? width / 2 : .35), lz + (axis === 'x' ? .35 : width / 2));
  const D = { id, pk, g, slab, lamp, B, need: o.need, label: o.label || 'the door', open: false, t: 0, h };
  const setOpen = (v, quiet) => { D.open = v; B.on = !v; lamp.material.color.set(v ? 0x5aff7a : 0xff3a2a); if (!quiet) { sfx('gate'); (G.flags.xd ||= {})[id] = 1; save(); } };
  D.setOpen = setOpen;
  XANIM.push((t, dt) => { D.t = clamp(D.t + (D.open ? dt : -dt) * .8, 0, 1); slab.position.y = h / 2 + D.t * (h - .3); });
  const canOpen = () => !D.need || (D.need === 'power' ? pk.powered : cnt(D.need) > 0 || (GEAR_DEFS[D.need] && has(GEAR_DEFS[D.need].kind)));
  const why = () => D.need === 'power' ? 'no power' : `needs ${nameOf(D.need).toLowerCase()}`;
  for (const s of [-1, 1]) { const ux = x + (axis === 'x' ? 0 : s * 1.1), uz = z + (axis === 'x' ? s * 1.1 : 0);
    xUse({ x: ux, y, z: uz, r: 1.8, pocket: pk, label: () => D.open ? null : canOpen() ? `Open ${D.label}` : `${D.label[0].toUpperCase() + D.label.slice(1)} · ${why()}`,
      act: () => { if (D.open) return; if (!canOpen()) { sfx('no'); toast(D.need === 'power' ? 'Dead. Nothing has power down here.' : `Locked — ${why()}`, 2.6); return; } setOpen(true); toast(`${D.label[0].toUpperCase() + D.label.slice(1)} grinds open`, 2.2); if (o.onOpen) o.onOpen(); } }); }
  XRESTORE.push(() => { const o = !!(G.flags.xd || {})[id]; setOpen(o, true); D.t = o ? 1 : 0; });
  return D;
}
// the generator: put a fuse in and the pocket has power
function xGenerator(pk, lx, lz, yaw = 0) {
  const [x, z] = pw(pk, lx, lz), y = pk.y, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; pk.g.add(g);
  xbox(g, 2.2, 1.4, 1.2, 'olive', 0, .7, 0); xbox(g, 2.3, .15, 1.3, 'metal', 0, 1.45, 0); xcyl(g, .12, .12, 1.6, 'metal', .8, 2.2, 0, 8);
  for (let i = 0; i < 4; i++) xbox(g, .05, .9, 1, 'dark', -.9 + i * .18, .7, .62);
  const pan = xbox(g, .5, .6, .08, 'metal', -.4, 1.0, .64), lamp = mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), -.4, 1.42, .66, g);
  xSolid(pk, lx - 1.3, lz - .8, lx + 1.3, lz + .8);
  const on = quiet => { pk.powered = true; lamp.material.color.set(0x5aff7a); for (const l of pk.plamps) { l.intensity = l.userData.I; if (l.userData.fx) l.userData.fx.material.color.setHex(l.userData.C); } if (!quiet) { (G.flags.xp ||= {})[pk.id] = 1; save(); } };
  pk.powerOn = on;
  const off = () => { pk.powered = false; lamp.material.color.set(0xff3a2a); for (const l of pk.plamps) { l.intensity = 0; if (l.userData.fx) l.userData.fx.material.color.setHex(0x2a2a2a); } };
  xUse({ x, y, z, r: 2.4, pocket: pk, label: () => pk.powered ? 'Generator · running' : cnt('fuse') || cnt('fuse_box') ? 'Fit a fuse and start the generator' : 'Generator · dead (needs a fuse)',
    act: () => { if (pk.powered) return; const f = cnt('fuse_box') ? 'fuse_box' : cnt('fuse') ? 'fuse' : null; if (!f) { sfx('no'); toast('The fuse slot is empty. Fuses turn up in ruins and the city — or a stash.', 3); return; }
      startChan({ l: 'Fitting the fuse', t: 1.6, fn: () => { take(f, 1); on(); sfx('reload'); noiseBurst(1.4, 90, 1, .25); toast('The generator coughs and catches · power is back', 3); } }); } });
  XRESTORE.push(() => (G.flags.xp || {})[pk.id] ? on(true) : off());
}
// a lamp that only lights when the pocket has power (or always, if it has its own)
function xPLamp(pk, lx, y, lz, color = 0xe8f0ff, I = 1.6, dist = 14) {
  const [x, z] = pw(pk, lx, lz), l = xLamp(pk.g, x, pk.y + y, z, color, I, dist); l.userData.I = l.intensity; l.userData.C = color;
  if (!pk.power) { pk.plamps.push(l); l.intensity = 0; if (l.userData.fx) l.userData.fx.material.color.setHex(0x2a2a2a); }
  return l;
}
// a dim emergency light that's always on (a battery that never quite died)
function xELamp(pk, lx, y, lz, color = 0xff4a2a, I = .55, dist = 9) { const [x, z] = pw(pk, lx, lz); const l = xLamp(pk.g, x, pk.y + y, z, color, I, dist), base = l.intensity, ph = xr(0, 6); if (xrnd() < .4) XANIM.push(t => { l.intensity = Math.sin(t * 17 + ph) > .9 ? .1 : base; }); return l; }
// loot inside a pocket
function xPCache(pk, lx, lz, yaw, lock, table, o = {}) { const [x, z] = pw(pk, lx, lz); const C = cache(pk.g, x, z, yaw, LOCKS[lock] && !['pry', 'cutter', 'bypass', 'card', 'chip', 'none'].includes(lock) ? 'card' : lock, table, o); C.lock = lock; C.g.position.y = pk.y + (o.y || 0); pk.dyn.add(C.g); return C; }
// the way in, on the surface, and the way out, inside
function xEntrance(pk, sx, sz, label, inSpot, outSpot) {
  pk.in = inSpot; pk.out = outSpot;
  xUse({ x: sx, z: sz, r: 2.8, pocket: null, label: () => label, act: () => xGo(pk, pk.in) });
}
function xExit(pk, lx, y, lz, label, out) { const [x, z] = pw(pk, lx, lz); xUse({ x, y: pk.y + y, z, r: 2.2, pocket: pk, label: () => label, act: () => xGo(null, out || pk.out) }); }
// move between the surface and a pocket, behind a quick fade
let xBusy = false;
function xGo(pk, spot) {
  if (xBusy || !spot) return; xBusy = true; const F = UG.fadeEl; F.style.opacity = 1; sfx('step', 1.2);
  setTimeout(() => { xGoNow(pk, spot); setTimeout(() => { F.style.opacity = 0; xBusy = false; }, 120); }, 380);
}
function xGoNow(pk, spot) {
  {
    if (UG.at) UG.at.g.visible = false;
    UG.at = pk; if (pk) { pk.g.visible = true; (G.flags.seen ||= {})['pk_' + pk.id] = 1; }
    P.x = spot.x; P.z = spot.z; P.y = spot.y ?? heightAt(spot.x, spot.z); P.eyeY = P.y; P.vx = P.vz = P.vy = 0; P.yaw = spot.yaw ?? P.yaw; P.fly = false; chan = null;
    UG.tagEl.textContent = pk ? `UNDERGROUND · ${pk.name}` : ''; UG.tagEl.style.display = pk ? 'block' : 'none';
    updTerrain(P.x, P.z); updForest?.(P.x, P.z);
    if (pk && !(G.flags.pkseen ||= {})[pk.id]) { G.flags.pkseen[pk.id] = 1; card(pk.name, pk.sub || 'Below ground', 3.4); save(); }
    const mm = $('minic'); if (mm) mm.style.visibility = pk ? 'hidden' : '';
  }
}
// inside a pocket: you can stand where a room is, at about its height, and not inside anything solid
function pkValid(pk, x, z, y, rad) {
  let inRoom = false;
  for (const R of pk.rects) { if (x < R.x0 + rad || x > R.x1 - rad || z < R.z0 + rad || z > R.z1 - rad) continue;
    const lo = Math.min(R.ylo, R.yhi) - 1.6, hi = rTop(R) + 1.6; if (y < lo || y > hi) continue; inRoom = true; break; }
  if (!inRoom) return false;
  for (const B of pk.obst) if (B.on && x > B.x0 - rad && x < B.x1 + rad && z > B.z0 - rad && z < B.z1 + rad && (B.ylo == null || (y > B.ylo - 1 && y < B.yhi))) return false;
  return true;
}
function pocketCollide(o, rad, ox, oz) {
  const pk = UG.at; if (!pk) return;
  // the grid's round colliders (crates and caches set inside the pocket)
  const i0 = Math.floor(o.x / CELL), j0 = Math.floor(o.z / CELL);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const L = grid.get(gkey(i, j)); if (!L) continue;
    for (const c of L) { const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; } } }
  if (pkValid(pk, o.x, o.z, o.y, rad)) return;
  if (pkValid(pk, o.x, oz, o.y, rad)) { o.z = oz; return; }
  if (pkValid(pk, ox, o.z, o.y, rad)) { o.x = ox; return; }
  o.x = ox; o.z = oz;
}
// a stretch of floor that gives way under you
function xWeak(pk, lx0, lz0, lx1, lz1, id, fl) {
  const W = { x0: pk.ox + lx0, z0: pk.oz + lz0, x1: pk.ox + lx1, z1: pk.oz + lz1, id, fl, gone: false, t: 0 };
  const cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2, w = W.x1 - W.x0, d = W.z1 - W.z0;
  W.mesh = xbox(pk.g, w, .3, d, 'rock', cx, pk.y - .15, cz); pk.dyn.add(W.mesh);
  W.cracks = []; for (let i = 0; i < 6; i++) { const c = mesh(new THREE.BoxGeometry(xr(.6, 1.6), .02, .05), xm('dark'), cx + xr(-w / 3, w / 3), pk.y + .01, cz + xr(-d / 3, d / 3), pk.g); c.rotation.y = xr(0, 3); W.cracks.push(c); pk.dyn.add(c); }
  FLOORS.push(W.floor = { cx, cz, c: 1, s: 0, hw: w / 2, hd: d / 2, y: pk.y });
  pk.weak.push(W);
  XRESTORE.push(() => { if ((G.flags.xc || {})[id] && !W.gone) xCollapse(W, true); });
  return W;
}
function xCollapse(W, quiet) {
  W.gone = true; const i = FLOORS.indexOf(W.floor); if (i >= 0) FLOORS.splice(i, 1);
  for (const c of W.cracks) c.visible = false;
  if (quiet) { W.mesh.visible = false; return; }
  (G.flags.xc ||= {})[W.id] = 1; sfx('thud'); noiseBurst(1.2, 120, .8, .4); puff(P.x, P.y + .5, P.z, 0x8a8478, 14, 4, .2, 1, -2);
  let t = 0; XANIM.push((tt, dt) => { if (!W.mesh.visible) return; t += dt; W.mesh.position.y -= dt * t * 9; W.mesh.rotation.z = t * .6; if (t > 1.5) W.mesh.visible = false; });
  toast('The floor gives way!', 2.2);
  setTimeout(() => { if (UG.at && !P.dead) hurtPlayer(12, P.x, P.z); }, 450);
}

/* ================= building it all ================= */
function buildExplore() {
  const s0 = seed; seed = 81051151;            // the world's stream, swapped out: helpers that use it can't move anything else
  xSites();
  for (const D of XSITE_DEFS) { const S = XSITES[D.id]; if (D.id === 'tunB') continue; REGIONS.push({ id: 'x_' + D.id, name: D.id === 'tunA' ? 'THE COLDWATER LINE' : D.name, sub: D.sub, x: S.x, z: S.z, r: Math.max(26, S.r + 14), hostile: !!D.hostile, base: !!D.hostile }); }
  buildMillbrook(); buildKVRN(); buildRidge(); buildCave(); buildTunnel(); buildHesper(); buildBright(); buildLongFall(); buildRoute9(); buildEmber(); buildBlackDoor();
  buildCrossings(); buildCamps(); buildStashes();
  for (const k in POCKETS) xSeal(POCKETS[k]);
  // the lamp you carry under the ground: a flashlight if you've got one, otherwise a lighter
  UG.lamp = new THREE.PointLight(0xffe0b0, 0, 10, 0); camera.add(UG.lamp); UG.lamp.position.set(.25, -.1, -.3);
  buildXHud();
  window.__X = { sim: (n, dt = 1 / 30, pre) => { for (let i = 0; i < n; i++) { if (pre) pre(); G.t += dt; updPlayer(dt); updXplore(dt); if (typeof updChan === "function") updChan(dt); if (window.__simEnts) for (const e of [...ents]) if (e.type === "clan" && Math.hypot(e.x - P.x, e.z - P.z) < 300) updClan(e, dt); } }, xGoNow, XSITES, XCROSS, XCAMPS, XSTASH, POCKETS, UG, LOGS, XNOTES, XUSE, xGo, openLog, closeLog, pkValid };
  seed = s0;
}
function bakeExplore() {
  for (const k in POCKETS) { const pk = POCKETS[k]; pk.g.visible = true; const dyn = new Set([...pk.dyn]); pk.g.traverse(o => { if (o.isPointLight || (o.userData && o.userData.fx)) dyn.add(o); }); for (const l of [...pk.plamps]) if (l.userData.fx) dyn.add(l.userData.fx); try { bakeGroup(pk.g, dyn, 30); } catch (e) { console.warn('bake pocket', k, e); } pk.g.visible = UG.at === pk; }
}

/* ---------- Millbrook: a farm village, walked out of. A storm cellar under the Rourke place. ---------- */
function buildMillbrook() {
  const S = XSITES.millbrook, yaw = xr(0, 6.28), F = xFrame(S.x, S.z, yaw);
  // the street and the houses either side, the chapel at the top, the well in the middle
  for (let k = -32; k <= 32; k += 4) { const [x, z] = F(0, k); const m = xbox(world, 5, .12, 4.2, 'dirt', x, heightAt(x, z) + .03, z, yaw); m.receiveShadow = true; m.castShadow = false; }
  const homes = [[-11, -20, 0], [11, -18, Math.PI], [-12, -4, 0], [12, -2, Math.PI], [-11, 13, 0], [13, 15, Math.PI]];
  homes.forEach(([lx, lz, ry], i) => { const [x, z] = F(lx, lz); house(x, z, yaw + ry + XHPI + xr(-.06, .06), xr(7, 9), xr(6, 8), i === 3 ? 2 : 1); SHELTERS.push({ x, z, kind: 'house', r: 3.8 }); });
  // the chapel
  { const [x, z] = F(0, -36), g = new THREE.Group(), m = xm('concW');
    xbox(g, 9, 6, 14, m, 0, 3, 0); xbox(g, 3, 12, 3, m, 0, 6, -6.5); const sp = mesh(new THREE.ConeGeometry(2.4, 4, 4), xm('rust'), 0, 14, -6.5, g); sp.rotation.y = Math.PI / 4;
    const roof = mesh(new THREE.CylinderGeometry(.01, 6, 3, 4, 1), xm('rust'), 0, 7.5, 1, g); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.5;
    xbox(g, 2.2, 3, .2, 'dark', 0, 1.5, 7.05); for (const s of [-1, 1]) for (const zz of [-3, 2]) xbox(g, .1, 2, 1, 'glass', s * 4.52, 3.6, zz);
    const yy = xLowest(x, z, 9, 14, yaw); g.position.set(x, yy, z); g.rotation.y = yaw; world.add(g); xColRect(x, z, 9, 14, yaw, .5, 2.4); }
  // the well, with the notice nailed to it
  { const [x, z] = F(0, 4), y = heightAt(x, z); xcyl(world, 1.1, 1.2, .9, 'conc', x, y + .45, z, 14); for (const s of [-1, 1]) xbox(world, .14, 2, .14, 'woodD', x + s * .9, y + 1, z); xbox(world, 2.2, .12, .5, 'woodD', x, y + 2, z); addCol(x, z, 1.3);
    xNote(world, 'mb_notice', x + 1.25, y + .95, z, yaw); }
  // fences, overgrown gardens, a tractor rusting in a yard, a cart
  for (const [lx, lz] of [[-18, -12], [18, -10], [-18, 6], [19, 8]]) { const [x0, z0] = F(lx, lz - 6), [x1, z1] = F(lx, lz + 6); for (let t = 0; t <= 1; t += .125) { const x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (xrnd() < .2) continue; const p = xbox(world, .12, xr(.9, 1.3), .12, 'woodD', x, heightAt(x, z) + .5, z); p.rotation.z = xr(-.2, .2); } }
  { const [x, z] = F(20, -26), g = new THREE.Group(); xbox(g, 1.6, 1.2, 2.6, 'rust', 0, 1.1, 0); xbox(g, 1.2, 1, 1.2, 'rust', 0, 2.1, -.5);
    for (const [wx, wz, r] of [[-1, 1, .9], [1, 1, .9], [-.9, -1, .5], [.9, -1, .5]]) { const w = xcyl(g, r, r, .4, 'dark', wx, r, wz, 12); w.rotation.z = XHPI; } xPlace(g, x, z, yaw + .7); addCol(x, z, 1.8); }
  { const [x, z] = F(-6, 22); car(x, z, yaw + .3); }
  // a kitchen table with Ada's letter, a photo on a porch
  { const [x, z] = F(-12, -4), y = heightAt(x, z); xbox(world, 1.4, .08, .8, 'wood', x, y + .78, z, yaw); for (const [a, b] of [[-.6, -.3], [.6, -.3], [-.6, .3], [.6, .3]]) { const [px, pz] = xFrame(x, z, yaw)(a, b); xbox(world, .06, .76, .06, 'woodD', px, y + .38, pz); }
    xNote(world, 'mb_letter', x, y + .83, z, yaw); }
  { const [x, z] = F(9.5, 15); xNote(world, 'mb_photo', x, heightAt(x, z) + .05, z, yaw); }
  for (let i = 0; i < 6; i++) { const [x, z] = F(xr(-16, 16), xr(-28, 26)); spawnScrap(x, z, 'wild'); }
  for (const [lx, lz, t] of [[-14, -18, 'ruin'], [14, 0, 'ruin'], [-14, 14, 'wild']]) { const [x, z] = F(lx, lz); supplyCrate(x, z); CRATES[CRATES.length - 1].table = t; }
  // the Rourke place: the house at the bottom of the street, with storm-cellar doors against its side
  const [hx, hz] = F(14, 26); house(hx, hz, yaw + XHPI + .05, 8, 7); SHELTERS.push({ x: hx, z: hz, kind: 'house', r: 3.8 });
  const [cx, cz] = F(14, 31.5), cy = heightAt(cx, cz);
  { const g = new THREE.Group(); xbox(g, 2.4, .5, 2, 'conc', 0, .25, 0); for (const s of [-1, 1]) { const d = xbox(g, 1.15, .07, 1.9, 'woodD', s * .6, .55, 0); d.rotation.x = .35; d.rotation.z = s * .02; }
    xbox(g, .3, .06, .06, 'metal', 0, .62, -.3); xPlace(g, cx, cz, yaw); addCol(cx, cz, 1); }
  const pk = mkPocket('cellar', 'THE ROURKE CELLAR', { surf: 'gravel', fog: 40, hemi: .16, power: true }); pk.sub = 'Ansel Rourke didn’t walk to Hesper';
  const out = F(14, 34);
  xEntrance(pk, cx, cz, 'Open the cellar doors · go down', { x: pk.ox + 1.2, y: pk.y + 2.9, z: pk.oz + .9, yaw: Math.PI }, { x: out[0], z: out[1], yaw: Math.atan2(out[0] - cx, out[1] - cz) + Math.PI });
  buildCellar(pk);
}
function buildCellar(pk) {
  xRoom(pk, 0, 0, 2.4, 6, { y: 3, y2: 0, down: 1, axis: 'z', h: 2.6, wall: 'woodD', floor: 'woodD', ceil: 'woodD' });   // the steps down
  xRoom(pk, -3, 5, 6, 13, { h: 2.6, wall: 'conc', floor: 'concD', ceil: 'woodD' });                                       // the main room
  xRoom(pk, 4.5, 7, 10, 11.5, { h: 2.4, wall: 'conc', ceil: 'woodD' });                                                    // the pantry
  xRoom(pk, -6, 8, -2, 10, { h: 1.9, wall: 'rockD', floor: 'dirt', ceil: 'rockD' });                                       // the crawl behind the shelf
  xRoom(pk, -9.5, 6, -5, 12, { h: 2.2, wall: 'rockD', floor: 'dirt', ceil: 'woodD' });                                     // what he hid
  xExit(pk, 1.2, 2.9, .6, 'Climb out of the cellar');
  const [ox, oz] = [pk.ox, pk.oz], y = pk.y, g = pk.g;
  xPLamp(pk, 1.5, 2.5, 9, 0xffc890, 1.2, 10); xELamp(pk, 1.2, 2.4, 3, 0xffb060, .6, 7);
  // bunks, a table, a radio, shelves of tins
  if (!xModel(g, 'props/bed', .6, ox + 4.6, y, oz + 6.2, 0)) xbox(g, 2, .5, .9, 'woodD', ox + 4.6, y + .25, oz + 6.2); xSolid(pk, 3.5, 5, 6, 7);
  xbox(g, 1.6, .08, .9, 'wood', ox + .6, y + .78, oz + 10.5); for (const [a, b] of [[-.7, -.35], [.7, -.35], [-.7, .35], [.7, .35]]) xbox(g, .06, .76, .06, 'woodD', ox + .6 + a, y + .38, oz + 10.5 + b); xSolid(pk, -.3, 9.9, 1.5, 11.1);
  xbox(g, .5, .3, .3, 'olive', ox + .2, y + .97, oz + 10.4); mesh(new THREE.SphereGeometry(.03, 6, 4), xm('glowA'), ox + .4, y + 1.05, oz + 10.56, g);
  xNote(g, 'mb_rourke1', ox + 1, y + .83, oz + 10.6, .3, pk); xNote(g, 'mb_rourke2', ox + 4.8, y + .55, oz + 6.2, 0, pk);
  for (let k = 0; k < 4; k++) { xbox(g, .5, .06, 4, 'woodD', ox + 9.7, y + .4 + k * .5, oz + 9.25); for (let j = 0; j < 8; j++) xcyl(g, .07, .07, .14, xp(['metal', 'rust', 'olive']), ox + 9.65 + xr(-.1, .1), y + .5 + k * .5, oz + 7.6 + j * .46, 8); }
  xSolid(pk, 9.3, 7, 10, 11.5);
  xPCache(pk, 7.5, 10.8, Math.PI, 'none', 'wild', { id: 'x_cellar_pantry', name: 'Pantry crates', rolls: 2, keys: ['canned', 'water_filtered'], refill: 6 });
  // the shelf against the west wall, with what's behind it
  const shelf = new THREE.Group(); shelf.position.set(ox - 2.8, y, oz + 9); g.add(shelf); pk.dyn.add(shelf);
  xbox(shelf, .5, 2.2, 2.6, 'woodD', 0, 1.1, 0); for (let k = 0; k < 4; k++) xbox(shelf, .55, .05, 2.6, 'wood', .02, .3 + k * .55, 0);
  for (let j = 0; j < 10; j++) xcyl(shelf, .07, .07, .14, xp(['metal', 'rust']), .05, .38 + (j % 4) * .55, -1.1 + j * .24, 8);
  const SB = xSolid(pk, -3.2, 7.6, -2.4, 10.4);
  const moved = () => { SB.on = false; shelf.position.z = oz + 11.3; shelf.rotation.y = .25; };
  xUse({ x: ox - 2, y, z: oz + 9, r: 1.6, pocket: pk, label: () => SB.on ? ((G.flags.logs || {}).mb_rourke2 ? 'Shift the shelf · he said he moved things behind it' : 'The shelf rocks when you lean on it · shift it') : null,
    act: () => startChan({ l: 'Shifting the shelf', t: 1.4, fn: () => { moved(); (G.flags.xd ||= {}).cellar_shelf = 1; sfx('thud'); toast('There’s a gap in the wall behind it', 2.4); save(); } }) });
  XRESTORE.push(() => { if ((G.flags.xd || {}).cellar_shelf) moved(); else { SB.on = true; shelf.position.z = oz + 9; shelf.rotation.y = 0; } });
  xSkeleton(g, ox - 8, y, oz + 9, XHPI, 1); xbox(g, .5, .45, .5, 'woodD', ox - 8, y + .22, oz + 9.1);
  xNote(g, 'mb_rourke3', ox - 7.2, y + .02, oz + 8.4, 0, pk);
  xPCache(pk, -8.5, 6.9, 0, 'none', 'ruin', { id: 'x_cellar_hidden', name: 'Rourke’s strongbox', rolls: 2, keys: ['revolver', 'ammo_9', 'fuse_box'], refill: 0 });
  xELamp(pk, -7, 2, 9, 0xffb060, .5, 6);
  XMARKS.hesper_map = { x: XSITES.hesper.x, z: XSITES.hesper.z, n: 'Fort Hesper' };
  LOGS.mb_rourke3.mark = 'hesper_map';
}

/* ---------- KVRN: an old radio station on the south rim ---------- */
function buildKVRN() {
  const S = XSITES.kvrn, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  // the station house: concrete, the roof half gone
  { const g = new THREE.Group(), y = xLowest(S.x, S.z, 12, 8, yaw);
    xbox(g, 12, .4, 8, 'concD', 0, .2, 0); for (const [x, z, w, d] of [[0, -3.9, 12, .3], [-5.9, 0, .3, 8], [5.9, 0, .3, 8], [-3.7, 3.9, 4.6, .3], [3.7, 3.9, 4.6, .3]]) xbox(g, w, 3.4, d, 'conc', x, 1.9, z);
    xbox(g, 12.4, .3, 4.5, 'concD', 0, 3.7, -1.8); xbox(g, 3, .6, 8.4, 'conc', -4.7, 3.7, 0);
    for (const x of [-3, 3]) xbox(g, 1.4, 1, .32, 'glass', x, 2.2, -3.9);
    g.position.set(S.x, y, S.z); g.rotation.y = yaw; world.add(g); xColRect(S.x, S.z, 12, 8, yaw, .45, 2.8); addFloor(S.x, S.z, yaw, 6, 4, y + .4); SHELTERS.push({ x: S.x, z: S.z, kind: 'house', r: 4 });
    // inside: the broadcast desk, racks, the tape machine still turning
    const [tx, tz] = F(-2, -2.6); xNote(world, 'kv_term', tx, y + .4, tz, yaw + Math.PI);
    const [rx, rz] = F(3.5, -2.5); if (!xModel(world, 'props/server-rack', 2, rx, y + .4, rz, yaw + Math.PI)) xbox(world, .8, 2, .6, 'metal', rx, y + 1.4, rz, yaw);
    const [ux, uz] = F(4.8, 1.5); xbox(world, .9, .8, .5, 'woodD', ux, y + .8, uz, yaw); xNote(world, 'kv_numbers', ux, y + 1.2, uz, yaw);
    const reel = []; for (const s of [-1, 1]) { const [qx, qz] = xFrame(ux, uz, yaw)(s * .18, 0); const r = xcyl(world, .12, .12, .03, 'dark', qx, y + 1.3, qz, 12); reel.push(r); } XANIM.push((t, dt) => { for (const r of reel) r.rotation.y += dt * 2; });
    const [nx, nz] = F(-4.5, 2); xNote(world, 'kv_log', nx, y + .45, nz, yaw);
    const [cx, cz] = F(-4.5, -2.4); const C = cache(world, cx, cz, yaw, 'pry', 'ruin', { id: 'x_kvrn_locker', name: 'Engineer’s locker', rolls: 2, keys: ['radio', 'battery'], refill: 5 }); C.g.position.y = y + .4;
  }
  // the mast: a lattice tower with dishes, a red lamp at the top that still blinks
  { const [x, z] = F(0, 12), H = 42, g = new THREE.Group(); g.add(mesh(lattice(3.4, H, 0x8a8a86, 3), VCOL));
    for (const [yy, a] of [[H - 6, .4], [H - 10, 2.6], [H - 14, 4.4]]) { const d = mesh(new THREE.CylinderGeometry(1.5, 1.5, .2, 16), xSm(0xd0d0cc), Math.sin(a) * 2, yy, Math.cos(a) * 2, g); d.rotation.set(1.2, a, 0); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })); lamp.position.y = H + .6; g.add(lamp); XANIM.push(t => { lamp.visible = Math.sin(t * 2.2) > .2; });
    for (const s of [0, 2.1, 4.2]) { const [ax, az] = xFrame(x, z, s)(0, 22); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, heightAt(x, z) + H - 4, z), new THREE.Vector3(ax, heightAt(ax, az) + .2, az)]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); world.add(ln); }
    xPlace(g, x, z, .3); addCol(x, z, 2.4); }
  // a generator shed and fuel drums
  { const [x, z] = F(-9, 6); const g = new THREE.Group(); xbox(g, 3, 2.4, 2.4, 'rust', 0, 1.2, 0); xbox(g, 3.3, .1, 2.7, 'rust', 0, 2.45, 0); xPlace(g, x, z, yaw); addCol(x, z, 1.7); }
  for (let i = 0; i < 4; i++) { const [x, z] = F(-7 + xr(-1, 1), 9 + i * .9); xcyl(world, .3, .3, .9, 'rust', x, heightAt(x, z) + .45, z, 10); }
  for (let i = 0; i < 3; i++) { const [x, z] = F(xr(-8, 8), xr(4, 14)); spawnScrap(x, z, 'wild'); }
}

/* ---------- the ridge trail and the summit ---------- */
function buildRidge() {
  // cairns and marker posts all the way up, a rope on the steep bits
  for (let i = 4; i < XTRAIL.length; i += 5) { const [x, z] = XTRAIL[i], y = heightAt(x, z);
    if (i % 10 === 4) { for (let k = 0; k < 4; k++) mesh(new THREE.DodecahedronGeometry(.32 - k * .06, 0), M(0x8a8680), x + xr(-.06, .06), y + .2 + k * .36, z + xr(-.06, .06), world); }
    else { const p = xbox(world, .1, 1.5, .1, 'woodD', x + 1.2, y + .7, z); const f = mesh(new THREE.PlaneGeometry(.35, .2), xm('cloth'), x + 1.37, y + 1.3, z, world); f.rotation.y = xr(0, 6); }
  }
  for (let i = 1; i < XTRAIL.length - 1; i++) { const [x, z] = XTRAIL[i]; if (slopeAt(x, z) < .7 || i % 2) continue; const [px, pz] = XTRAIL[i - 1], yy = heightAt(x, z), py = heightAt(px, pz);
    const p = xbox(world, .1, 1.1, .1, 'woodD', x - 1, yy + .5, z); const a = new THREE.Vector3(x - 1, yy + 1, z), b = new THREE.Vector3(px - 1, py + 1, pz); world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0x8a7a5a }))); }
  // the top: a pole with a mirror, a lean-to, Maren's pages under a stone, a stash
  const S = XSITES.summit, y = heightAt(S.x, S.z);
  { const g = new THREE.Group(); xbox(g, .12, 4.5, .12, 'woodD', 0, 2.25, 0); const mr = mesh(new THREE.CircleGeometry(.4, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05 }), 0, 4.2, .08, g); XANIM.push(t => { mr.rotation.y = Math.sin(t * .4) * .6; });
    const fl = mesh(new THREE.PlaneGeometry(1, .6), xm('cloth'), .55, 3.8, 0, g); XANIM.push(t => { fl.rotation.y = Math.sin(t * 2) * .3; }); xPlace(g, S.x, S.z); addCol(S.x, S.z, .3); }
  { const [x, z] = xFrame(S.x, S.z, 0)(3, 2); const g = new THREE.Group(); const t = mesh(new THREE.PlaneGeometry(3, 2.2), xm('hide'), 0, 1, 0, g); t.rotation.x = -1; xbox(g, .1, 1.8, .1, 'woodD', -1.4, .9, -.5); xbox(g, .1, 1.8, .1, 'woodD', 1.4, .9, -.5); xPlace(g, x, z, .5); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; mesh(new THREE.DodecahedronGeometry(.2, 0), M(0x5a5650), S.x + 2 + Math.cos(a) * .6, y + .05, S.z - 2 + Math.sin(a) * .6, world); }
  mesh(new THREE.DodecahedronGeometry(.4, 0), M(0x8a8680), S.x - 1.5, y + .2, S.z + 1, world); xNote(world, 'rd_summit', S.x - 1, y + .1, S.z + 1.6, .4);
  { const C = cache(world, S.x + 2.5, S.z - 2.4, .4, 'none', 'wild', { id: 'x_summit', name: 'Scout’s pack', rolls: 2, keys: ['binoculars'], refill: 0 }); }
}

/* ---------- Whisper Cave ---------- */
function buildCave() {
  const S = XSITES.cave, f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z);
  // the mouth: two great rocks and a lintel stone, black inside
  { const g = new THREE.Group(); for (const s of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(3.2, 1), xm('rock'), s * 3.6, 2.2, -1, g); r.scale.set(.8, 1.3, 1.1); }
    const top = mesh(new THREE.DodecahedronGeometry(3.4, 1), xm('rock'), 0, 5.6, -1.6, g); top.scale.set(1.6, .6, 1.1);
    mesh(new THREE.PlaneGeometry(4.4, 4.4), xm('dark'), 0, 2.1, -1.2, g); xRubble(g, 0, 0, 1.5, 8, 2.5, 'rock');
    g.position.set(S.x, y - .6, S.z); g.rotation.y = f; world.add(g); }
  for (const s of [-1, 1]) { const [x, z] = F(s * 3.6, -1); addCol(x, z, 2.6); } { const [x, z] = F(0, -2.4); addCol(x, z, 1.7); }
  const pk = mkPocket('cave', 'WHISPER CAVE', { surf: 'gravel', fog: 38, hemi: .28, hemiC: 0x8a9aa0 }); pk.sub = 'It hums. Eleven seconds, every time.';
  const [ex, ez] = F(0, 1.8), [ox, oz] = F(0, 4.5);
  xEntrance(pk, ex, ez, 'Go into the cave', { x: pk.ox + 2, y: pk.y + 2, z: pk.oz + .9, yaw: Math.PI }, { x: ox, z: oz, yaw: f });
  const r = { wall: 'rock', floor: 'dirt', ceil: 'rockD' };
  xRoom(pk, 0, 0, 4, 10, { ...r, y: 2, y2: 0, down: 1, axis: 'z', h: 3.4 });     // the way in, sloping down
  xRoom(pk, -6, 9, 8, 24, { ...r, h: 5.5 });                                       // the painted hall
  xRoom(pk, 6.5, 14, 20, 21, { ...r, h: 4, nofloor: 1 });                           // the side gallery (its floor is laid by hand, round the weak patch)
  xRoom(pk, 12, 14, 20, 21, { ...r, y: -5, h: 5, noceil: 1 });                      // the deep chamber, under it
  xExit(pk, 2, 1.9, .5, 'Climb out of the cave');
  // the gallery floor: solid round the edges, the middle ready to give way
  const gf = (x0, z0, x1, z1) => { const [ax, az] = pw(pk, x0, z0), [bx, bz] = pw(pk, x1, z1), cx = (ax + bx) / 2, cz = (az + bz) / 2, w = bx - ax, d = bz - az; xbox(pk.g, w, .3, d, 'dirt', cx, pk.y - .15, cz); addFloor(cx, cz, 0, w / 2, d / 2, pk.y); };
  gf(6.5, 14, 13.5, 21); gf(13.5, 14, 20, 15.2); gf(13.5, 19.8, 20, 21); gf(18.5, 15.2, 20, 19.8);
  xWeak(pk, 13.5, 15.2, 18.5, 19.8, 'cave_floor');
  const g = pk.g, Y = pk.y;
  // rock clutter along the walls, stalactites, glowing fungus
  for (const R of pk.rects) { if (R.ylo !== R.yhi) continue; const n = Math.round((R.x1 - R.x0 + R.z1 - R.z0) / 3);
    for (let i = 0; i < n; i++) { const side = i % 4, t = xrnd(), x = side < 2 ? lerp(R.x0, R.x1, t) : side === 2 ? R.x0 + .3 : R.x1 - .3, z = side >= 2 ? lerp(R.z0, R.z1, t) : side === 0 ? R.z0 + .3 : R.z1 - .3;
      const s = xr(.5, 1.3), m = mesh(new THREE.DodecahedronGeometry(s, 0), xm('rock'), x, R.ylo + s * .3, z, g); m.rotation.set(xr(0, 3), xr(0, 3), xr(0, 3)); m.scale.y = xr(.6, 1.4);
      if (xrnd() < .5) { const st = mesh(new THREE.ConeGeometry(xr(.1, .3), xr(.6, 1.6), 5), xm('rockD'), lerp(R.x0 + 1, R.x1 - 1, xrnd()), R.ylo + R.h - .4, lerp(R.z0 + 1, R.z1 - 1, xrnd()), g); st.rotation.x = Math.PI; } } }
  const fungus = (lx, lz, yy) => { const [x, z] = pw(pk, lx, lz); for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(xr(.04, .1), 6, 4), xm('glowT'), x + xr(-.5, .5), Y + yy + xr(0, .6), z + xr(-.5, .5), g); xLamp(g, x, Y + yy + .6, z, 0x4ad0c0, .7, 8, false); };
  fungus(-5, 12, .2); fungus(7, 22, .3); fungus(16, 20.5, -4.8); fungus(13, 14.5, -4.8);
  // the old camp in the hall: a dead fire, a bedroll, the recorder, the paintings on the wall
  { const [x, z] = pw(pk, 1, 17); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mesh(new THREE.DodecahedronGeometry(.16, 0), M(0x4a4640), x + Math.cos(a) * .5, Y + .08, z + Math.sin(a) * .5, g); } mesh(new THREE.CircleGeometry(.45, 10), xm('char'), x, Y + .02, z, g).rotation.x = -XHPI;
    const br = mesh(new THREE.BoxGeometry(.8, .12, 2), M(0x3a4a5a), x + 2, Y + .06, z, g); xNote(g, 'cv_rec', x + 1.4, Y + .02, z - 1.2, .4, pk);
  }
  { const [x, z] = pw(pk, -5.85, 16); const pnt = mesh(new THREE.PlaneGeometry(5, 2.6), new THREE.MeshBasicMaterial({ color: 0x9a4a2a, transparent: true, opacity: .55 }), x, Y + 2.4, z, g); pnt.rotation.y = XHPI;
    for (let i = 0; i < 9; i++) { const m = mesh(new THREE.PlaneGeometry(xr(.2, .5), xr(.3, .8)), new THREE.MeshBasicMaterial({ color: xp([0x2a1a12, 0x7a2a1a, 0xc06a3a]) }), x + .02, Y + xr(1.4, 3.4), z + xr(-2.2, 2.2), g); m.rotation.y = XHPI; }
    const ring = mesh(new THREE.TorusGeometry(.6, .06, 4, 18), new THREE.MeshBasicMaterial({ color: 0x1a120e }), x + .03, Y + 3.4, z + 1.2, g); ring.rotation.y = XHPI;
    xNote(g, 'cv_painting', x + .4, Y + .4, z, XHPI, pk); }
  // an underground pool in the gallery's far corner (you can't walk on water)
  { const [x, z] = pw(pk, 9, 19.5); const w = mesh(new THREE.PlaneGeometry(4, 2.6), xm('water'), x, Y + .05, z, g); w.rotation.x = -XHPI; xSolid(pk, 7, 18.2, 11, 20.8); }
  // the deep chamber: thirteen marks in a ring, the carving, and what the old survey team left
  { const [x, z] = pw(pk, 16, 17.5), y3 = Y - 5;
    for (let i = 0; i < 13; i++) { const a = i / 13 * 6.28, st = mesh(new THREE.BoxGeometry(.3, xr(.7, 1.1), .18), xm('rockD'), x + Math.cos(a) * 2.2, y3 + .45, z + Math.sin(a) * 2.2, g); st.rotation.y = -a; }
    xNote(g, 'cv_deep', x, y3, z, 0, pk);
    xRubble(g, x - 1, y3, z + .5, 10, 1.6, 'rock');
    xPCache(pk, 19, 15, -XHPI, 'none', 'mil', { id: 'x_cave_deep', name: 'Survey team’s case', rolls: 2, keys: ['flashlight', 'rope', 'fuse'], refill: 0, y: -5 });
    xSkeleton(g, x - 2.5, y3, z + 2.6, 2.4);
    // a rope back up to the gallery
    const [rx, rz] = pw(pk, 19.2, 20.4); xcyl(g, .04, .04, 5, M(0x8a7a5a), rx, y3 + 2.5, rz, 5);
    xUse({ x: rx, y: y3, z: rz, r: 1.8, pocket: pk, label: () => 'Climb the rope back up', act: () => startChan({ l: 'Climbing', t: 1.2, fn: () => { P.x = pk.ox + 19.2; P.z = pk.oz + 20.4; P.y = pk.y + .1; P.vy = 0; } }) }); }
}

/* ---------- the Coldwater Line: an old rail tunnel through the east rim ---------- */
function buildTunnel() {
  const A = XSITES.tunA, B = XSITES.tunB;
  const portal = (S, label) => { const f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z) - .3, g = new THREE.Group();
    xbox(g, 9, 7.5, 2.4, 'conc', 0, 3.75, -.6); xbox(g, 5.6, 5.6, .3, 'dark', 0, 2.8, .65);
    xbox(g, 9.6, .8, 2.8, 'concD', 0, 7.6, -.6); for (const s of [-1, 1]) { xbox(g, 1.2, 7.5, 3.6, 'concD', s * 5, 3.75, -.4); const wing = xbox(g, 6, 5, .8, 'conc', s * 7.6, 2.3, -2.2); wing.rotation.y = s * .5; }
    for (let k = 0; k < 40; k++) { const tz = .9 + k * 1.2; xbox(g, 2.6, .12, .25, 'woodD', 0, .08, tz); } for (const s of [-1, 1]) xbox(g, .08, .12, 48, 'metal', s * .72, .2, 24.8);
    xbox(g, 2.4, 1.4, .1, 'white', 3.2, 2.6, .8); xbox(g, 2.2, .3, .02, 'paint', 3.2, 2.9, .86);
    xRubble(g, 0, 0, 3, 6, 3, 'rock'); g.position.set(S.x, y, S.z); g.rotation.y = f; world.add(g);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const [x, z] = F(s * (3.4 + k * 1.6), -.4); addCol(x, z, .9); } { const [x, z] = F(0, -1.2); addCol(x, z, 2); }
    return F; };
  const FA = portal(A), FB = portal(B);
  const pk = mkPocket('tunnel', 'THE COLDWATER LINE', { surf: 'gravel', fog: 60, hemi: .2, hemiC: 0x9aa0a8 }); pk.sub = 'Two hours’ walk, under the rim';
  const L = 240;
  const [ax, az] = FA(0, 1.6), [aox, aoz] = FA(0, 4), [bx, bz] = FB(0, 1.6), [box2, boz] = FB(0, 4);
  pk.in = { x: pk.ox + 2.5, y: pk.y, z: pk.oz, yaw: -XHPI }; pk.out = { x: aox, z: aoz, yaw: A.face };
  const inB = { x: pk.ox + L - 2.5, y: pk.y, z: pk.oz, yaw: XHPI }, outB = { x: box2, z: boz, yaw: B.face };
  xUse({ x: ax, z: az, r: 3, pocket: null, label: () => 'Walk into the tunnel', act: () => xGo(pk, pk.in) });
  xUse({ x: bx, z: bz, r: 3, pocket: null, label: () => 'Walk into the tunnel', act: () => xGo(pk, inB) });
  xNote(world, 'tn_order', ...(() => { const [x, z] = FA(3.2, 1.2); return [x, heightAt(x, z) + .1, z]; })(), A.face);
  const r = { wall: 'concD', floor: 'concD', ceil: 'concD' };
  xRoom(pk, 0, -3, L, 3, { ...r, h: 5.5 });
  xRoom(pk, 100, -9, 107, -2, { ...r, h: 3 });          // the alcove with the generator panel
  xRoom(pk, 110, 3.6, 120, 11, { ...r, h: 3 });         // the maintenance bay
  xRoom(pk, 113.4, 2, 116.6, 4.6, { ...r, h: 2.8 });    // its doorway
  xExit(pk, 1, 0, 0, 'Walk out of the tunnel · west portal', pk.out); xExit(pk, L - 1, 0, 0, 'Walk out of the tunnel · east portal', outB);
  const g = pk.g, Y = pk.y;
  // the line itself: sleepers, rails, cable trays, a lamp every 30 m (dead until the generator runs), red emergency lights
  { const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, .12, 2.6), xm('woodD'), Math.floor(L / 1.2)); const d = new THREE.Object3D();
    for (let i = 0; i < sl.count; i++) { d.position.set(pk.ox + .6 + i * 1.2, Y + .06, pk.oz); d.rotation.y = xr(-.05, .05); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); } g.add(sl);
    for (const s of [-1, 1]) xbox(g, L, .12, .08, 'metal', pk.ox + L / 2, Y + .18, pk.oz + s * .72, 0, 4);
    for (const s of [-1, 1]) xbox(g, L, .1, .4, 'metal', pk.ox + L / 2, Y + 3.6, pk.oz + s * 2.75, 0, 4); }
  for (let x = 15; x < L; x += 30) xPLamp(pk, x, 5.2, 0, 0xe8f0ff, 1.5, 22);
  for (let x = 30; x < L; x += 45) xELamp(pk, x, 2.6, -2.8, 0xff3a2a, .5, 10);
  // the flooded stretch, the cave-in and a derailed cart
  { const w = mesh(new THREE.PlaneGeometry(34, 6), xm('water'), pk.ox + 75, Y + .22, pk.oz, g); w.rotation.x = -XHPI; }
  { const [x, z] = pw(pk, 168, 0); xRubble(g, x, Y, z + 1.4, 22, 4, 'concD'); xSolid(pk, 163, 0, 173, 3); const sl2 = xbox(g, 6, .5, 3.2, 'concD', x - 1, Y + 1.5, z + 1.6); sl2.rotation.z = .4; }
  { const [x, z] = pw(pk, 140, -1.2), c = new THREE.Group(); xbox(c, 3.2, 1.2, 1.8, 'rust', 0, .9, 0); for (const s of [-1, 1]) for (const t of [-1, 1]) { const wh = xcyl(c, .3, .3, .12, 'dark', s * 1, .3, t * .9, 10); wh.rotation.x = XHPI; } c.position.set(x, Y, z); c.rotation.set(0, .2, .25); g.add(c); xSolid(pk, 138, -2.4, 142.2, .2); }
  // the alcove: the panel the logger talks about
  xGenerator(pk, 103.5, -7.6, Math.PI);
  xNote(g, 'tn_rec', pk.ox + 101, Y + 1, pk.oz - 2.7, 0, pk); xbox(g, .8, .9, .5, 'olive', pk.ox + 101, Y + .45, pk.oz - 2.7); xSolid(pk, 100.5, -3, 101.5, -2.4);
  // the maintenance bay, behind a door that needs power
  xDoor(pk, 'tunnel_bay', 115, 3.3, 'x', 3.2, { need: 'power', label: 'the maintenance bay' });
  xPLamp(pk, 115, 2.8, 7, 0xe8f0ff, 1.2, 10);
  for (let k = 0; k < 3; k++) xbox(g, 4, .06, .6, 'metal', pk.ox + 116, Y + .5 + k * .6, pk.oz + 10.6);
  xModel(g, 'props/tool-racks', 2, pk.ox + 111.5, Y, pk.oz + 10.4, Math.PI); xSolid(pk, 114, 10, 118, 11); xSolid(pk, 110, 9.6, 113, 11);
  xPCache(pk, 118.6, 7, -XHPI, 'none', 'ruin', { id: 'x_tunnel_bay', name: 'Spares cage', rolls: 3, keys: ['tool_kit', 'spare_parts', 'fuse'], refill: 5 });
  xbox(g, .6, .6, .6, 'yellow', pk.ox + 111, Y + .3, pk.oz + 4.6);
  for (let i = 0; i < 8; i++) { const [x, z] = pw(pk, xr(10, L - 10), xr(-2.4, 2.4)); const m = mesh(new THREE.DodecahedronGeometry(xr(.2, .5), 0), xm('concD'), x, Y + .15, z, g); m.scale.y = .5; }
}

/* ---------- Fort Hesper and the bunker under it ---------- */
function buildHesper() {
  const S = XSITES.hesper, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  BASES.push({ id: 'hesper', name: 'FORT HESPER', sub: 'Old-world army post · Ironjaw squatters', x: S.x, z: S.z, R: 40, fac: 'iron', hostile: true });
  // the perimeter: sandbag walls and concrete blocks, a gap at the gate (facing the valley)
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - XHPI)) < .14) continue; const [x, z] = F(Math.cos(a) * 36, Math.sin(a) * 36), y = heightAt(x, z);
    if (i % 8 === 0) { xbox(world, 1.8, 1.4, 1, 'conc', x, y + .7, z, yaw - a - XHPI); addCol(x, z, 1); continue; }
    xbox(world, 3.4, .9, 1.1, 'sand', x, y + .45, z, yaw - a - XHPI); addCol(x, z, 1.4); }
  // watchtowers at the gate
  for (const s of [-1, 1]) { const [x, z] = F(s * 7, 38), g = new THREE.Group(); g.add(mesh(lattice(3, 7, 0x5a5a50, 2.4), VCOL)); xbox(g, 3.4, .2, 3.4, 'olive', 0, 7, 0); for (const k of [[0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]]) xbox(g, k[0] ? .1 : 3.4, 1, k[0] ? 3.4 : .1, 'sand', k[0], 7.5, k[1]); xbox(g, 3.6, .1, 3.6, 'olive', 0, 9.4, 0); xPlace(g, x, z, yaw); addCol(x, z, 1.8); }
  // a comms mast, barracks huts (half-round tin), a command block, trucks, a fuel dump
  { const [x, z] = F(-20, -20), g = new THREE.Group(); g.add(mesh(lattice(2, 24, 0x6a6a64, 3), VCOL)); xPlace(g, x, z); addCol(x, z, 1.2); }
  for (const [lx, lz] of [[-18, 4], [-18, 16], [18, 10]]) { const [x, z] = F(lx, lz), g = new THREE.Group(), h = mesh(new THREE.CylinderGeometry(3, 3, 12, 14, 1, true, -XHPI, Math.PI), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a7058, side: THREE.DoubleSide }), 0, 0, 0, g); h.rotation.x = -XHPI;
    const y0 = xLowest(x, z, 6, 12, yaw); g.position.set(x, y0, z); g.rotation.y = yaw; world.add(g); for (const s of [-1, 1]) xbox(world, 6, 3, .2, 'olive', ...(() => { const [px, pz] = xFrame(x, z, yaw)(0, s * 6); return [px, y0 + 1.5, pz]; })(), yaw);
    colRect(x, z, 6, 12, yaw, .5, []); SHELTERS.push({ x, z, kind: 'house', r: 2.4 }); }
  const [kx, kz] = F(6, -12);
  { const g = new THREE.Group(), y0 = xLowest(kx, kz, 12, 9, yaw); xbox(g, 12, .4, 9, 'concD', 0, .2, 0); for (const [x, z, w, d] of [[0, -4.4, 12, .3], [-5.9, 0, .3, 9], [5.9, 0, .3, 9], [-3.8, 4.4, 4.4, .3], [3.8, 4.4, 4.4, .3]]) xbox(g, w, 3.2, d, 'conc', x, 1.8, z); xbox(g, 12.4, .3, 9.4, 'concD', 0, 3.5, 0);
    xbox(g, 4, 1, .1, 'white', 0, 2.8, 4.6); xbox(g, 3.8, .4, .02, 'olive', 0, 2.8, 4.66);
    g.position.set(kx, y0, kz); g.rotation.y = yaw; world.add(g); xColRect(kx, kz, 12, 9, yaw, .45, 3.2); addFloor(kx, kz, yaw, 6, 4.5, y0 + .4); SHELTERS.push({ x: kx, z: kz, kind: 'house', r: 4 });
    const [nx, nz] = xFrame(kx, kz, yaw)(-3, -2); xbox(world, 1.6, .8, .8, 'woodD', nx, y0 + .8, nz, yaw); xNote(world, 'hs_iron', nx, y0 + 1.22, nz, yaw);
    const [cx, cz] = xFrame(kx, kz, yaw)(3.5, -3); const C = cache(world, cx, cz, yaw, 'none', 'mil', { id: 'x_hesper_cmd', name: 'Ironjaw loot pile', rolls: 1, refill: 4 }); C.g.position.y = y0 + .4; }
  for (const [lx, lz, a] of [[10, 18, .3], [22, -2, 1.4]]) { const [x, z] = F(lx, lz), g = new THREE.Group(); xbox(g, 2.4, 1.1, 6.4, 'olive', 0, 1.2, 0); xbox(g, 2.4, 1.4, 2, 'olive', 0, 2.2, 2.2); xbox(g, 2.5, 2.2, 4, 'cloth', 0, 2.9, -1.2);
    for (const [wx, wz] of [[-1.2, 2.2], [1.2, 2.2], [-1.2, -1.5], [1.2, -1.5], [-1.2, -2.8], [1.2, -2.8]]) { const w = xcyl(g, .55, .55, .4, 'dark', wx, .55, wz, 12); w.rotation.z = XHPI; }
    g.rotation.z = xr(-.06, .06); xPlace(g, x, z, yaw + a); const F2 = xFrame(x, z, yaw + a); for (const k of [-2, 0, 2]) { const [px, pz] = F2(0, k); addCol(px, pz, 1.4); } }
  for (let i = 0; i < 10; i++) { const [x, z] = F(24 + (i % 4) * 1, 14 + Math.floor(i / 4) * 1); xcyl(world, .32, .32, .95, xp(['olive', 'rust']), x, heightAt(x, z) + .47, z, 10); }
  for (let i = 0; i < 3; i++) { const [x, z] = F(xr(-25, 25), xr(-25, 25)); supplyCrate(x, z); CRATES[CRATES.length - 1].table = 'mil'; }
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-28, 28), xr(-28, 28)); spawnScrap(x, z, 'wild'); }
  // the bunker door in the low concrete block at the back
  const [bx, bz] = F(0, -26), by = heightAt(bx, bz);
  { const g = new THREE.Group(); if (!xModel(g, 'e/bunker', 4.5, 0, 0, 0, Math.PI)) { xbox(g, 8, 4, 6, 'conc', 0, 1.6, 0); xbox(g, 2.4, 2.6, .2, 'panel', 0, 1.3, 3.05); } g.position.set(bx, by - .4, bz); g.rotation.y = yaw; world.add(g); addCol(bx, bz, 3.2); }
  const pk = mkPocket('hesper', 'HESPER BUNKER', { surf: 'metal', fog: 50, hemi: .1 }); pk.sub = 'The 4th Provincial Guard held out down here';
  const [ex, ez] = F(0, -21.5), [ox, oz] = F(0, -19);
  xEntrance(pk, ex, ez, 'Go down into the bunker', { x: pk.ox + 1.5, y: pk.y + 3.9, z: pk.oz + .8, yaw: Math.PI }, { x: ox, z: oz, yaw });
  // garrison: Ironjaw holding the fort
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-22, 22), xr(-20, 24)); spawnClan(i % 4 === 3 ? 'brute' : 'gunner', x, z, 'guard', 'iron'); }
  buildHesperBunker(pk);
}
function buildHesperBunker(pk) {
  const r = { wall: 'conc', floor: 'tile', ceil: 'concD' };
  xRoom(pk, 0, 0, 3, 8, { ...r, y: 4, y2: 0, down: 1, axis: 'z', h: 3 });   // stairs down
  xRoom(pk, -1, 7, 4, 31, { ...r, h: 3 });                                    // the main corridor
  xRoom(pk, 2.5, 9, 14, 18, { ...r, h: 3 });                                  // mess hall
  xRoom(pk, -12, 10, .5, 20, { ...r, h: 2.8 });                               // dormitory
  xRoom(pk, 2.5, 21, 10, 28, { ...r, h: 2.8 });                               // the commander's office
  xRoom(pk, -10, 22, .5, 30, { ...r, h: 3.2, floor: 'concD' });               // generator room
  xRoom(pk, -2, 30, 6, 38, { ...r, h: 3.2, floor: 'concD' });                 // the armory
  xExit(pk, 1.5, 3.9, .5, 'Climb the stairs out');
  const g = pk.g, Y = pk.y, P2 = (lx, lz) => pw(pk, lx, lz);
  xELamp(pk, 1.5, 2.6, 4, 0xff3a2a, .5, 9); xELamp(pk, 1.5, 2.6, 14, 0xff3a2a, .45, 10); xELamp(pk, 1.5, 2.6, 26, 0xff3a2a, .5, 10);
  for (const [x, z] of [[1.5, 10], [1.5, 20], [8, 13], [-6, 15], [6, 24.5], [-5, 26], [2, 34]]) xPLamp(pk, x, 2.75, z, 0xe8f0ff, 1.4, 12);
  // the mess: long tables and benches
  for (const z of [11.5, 15]) { const [x, zz] = P2(9, z); xbox(g, 7, .08, 1.1, 'metal', x, Y + .76, zz); xbox(g, 6.6, .7, .9, 'dark', x, Y + .35, zz); for (const s of [-1, 1]) xbox(g, 7, .06, .35, 'metal', x, Y + .45, zz + s * .9); xSolid(pk, 5.5, z - 1.2, 12.5, z + 1.2); }
  { const [x, z] = P2(13.3, 14); xbox(g, .9, .95, 4.6, 'metal', x, Y + .48, z); xbox(g, .95, .05, 4.7, 'white', x, Y + .97, z); for (let k = 0; k < 3; k++) xcyl(g, .18, .16, .3, 'metal', x, Y + 1.15, z - 1.4 + k * 1.4, 10); xSolid(pk, 12.6, 11.5, 14, 16.5); }
  xNote(g, 'hs_letter', ...P2(8, 15).flatMap((v, i) => i ? [Y + .82, v] : [v]), 0, pk);
  // the dorm: rows of bunks and lockers
  for (let i = 0; i < 4; i++) { const z = 11.5 + i * 2.2; const [x, zz] = P2(-10, z); for (const yy of [.45, 1.5]) xbox(g, 2, .18, .9, 'olive', x, Y + yy, zz); for (const s of [-1, 1]) xbox(g, .06, 1.9, .06, 'metal', x + s * 1, Y + .95, zz); xSolid(pk, -11.2, z - .5, -8.8, z + .5); }
  for (let i = 0; i < 5; i++) { const [x, z] = P2(-4.6, 10.6 + i * .75); if (!xModel(g, 'props/locker', 1.9, x, Y, z, 0)) xbox(g, .6, 1.9, .6, 'olive', x, Y + .95, z); } xSolid(pk, -5.1, 10.2, -4.1, 14.2);
  xPCache(pk, -1.5, 18.5, XHPI, 'none', 'mil', { id: 'x_hesper_dorm', name: 'Footlocker', rolls: 1, refill: 5 });
  xNote(g, 'hs_duty', ...P2(-9, 19.5).flatMap((v, i) => i ? [Y + 1.62, v] : [v]), 0, pk);
  // the commander's office: the desk, the terminal, the keycard in the drawer
  { const [x, z] = P2(7, 25.5); xbox(g, 2.4, .08, 1.1, 'wood', x, Y + .78, z); xbox(g, 2.2, .72, 1, 'woodD', x, Y + .38, z); xSolid(pk, 5.6, 24.8, 8.4, 26.2);
    xNote(g, 'hs_cmd', ...P2(4, 27.2).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 3.4, 26.6, 4.6, 27.8);
    xPCache(pk, 9, 22.2, Math.PI, 'none', 'mil', { id: 'x_hesper_desk', name: 'Colonel Avens’ desk drawer', rolls: 1, keys: ['bw_card', 'hesper_key'], refill: 0, y: 0 });
    for (let i = 0; i < 3; i++) xModel(g, 'props/server-rack', 2, ...P2(3.2 + i * .9, 21.5).flatMap((v, k) => k ? [Y, v] : [v]), 0); }
  // the generator room
  xGenerator(pk, -6, 27.5, 0);
  for (let i = 0; i < 4; i++) { const [x, z] = P2(-9 + i * .8, 23); xModel(g, 'props/gas-bottle', 1.3, x, Y, z, 0) || xcyl(g, .2, .2, 1.3, 'olive', x, Y + .65, z, 8); }
  xModel(g, 'props/pipes', 2.6, ...P2(-1.5, 28.5).flatMap((v, k) => k ? [Y, v] : [v]), XHPI);
  // the armory, behind the blast door at the end of the corridor (power, and the armory key)
  xDoor(pk, 'hesper_armory', 1.5, 30.5, 'x', 4.6, { need: 'power', label: 'the armory blast door' });
  for (let k = 0; k < 3; k++) xbox(g, .5, .06, 6, 'metal', pk.ox + 5.5, Y + .6 + k * .7, pk.oz + 34); for (let k = 0; k < 6; k++) xbox(g, .1, 1.2, .3, 'dark', pk.ox + 5.5, Y + 1.4, pk.oz + 31.6 + k * .9);
  xSolid(pk, 5.1, 31, 6, 37);
  xPCache(pk, 0, 36.8, 0, 'hk', 'mil', { id: 'x_hesper_armory', name: 'Weapons cage', big: 1, rolls: 4, keys: ['assault', 'tac_armor', 'frag', 'ammo_556'], refill: 0 });
  xPCache(pk, -1.2, 33, XHPI, 'none', 'mil', { id: 'x_hesper_ammo', name: 'Ammunition crates', rolls: 2, refill: 6 });
}

/* ---------- Brightwater Annex and the lab under it ---------- */
function buildBright() {
  const S = XSITES.bright, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  // a chain fence on posts (most of it still up), warning signs, the gatehouse
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; if (Math.abs(angWrap(a - XHPI)) < .12) continue; const [x, z] = F(Math.cos(a) * 30, Math.sin(a) * 30), y = heightAt(x, z);
    xbox(world, .1, 2.6, .1, 'metal', x, y + 1.3, z); if (xrnd() < .82) { const [nx, nz] = F(Math.cos(a + .157) * 30, Math.sin(a + .157) * 30); const L = Math.hypot(nx - x, nz - z), pnl = mesh(new THREE.PlaneGeometry(L, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a8e90, transparent: true, opacity: .35, side: THREE.DoubleSide }), (x + nx) / 2, y + 1.3, (z + nz) / 2, world); pnl.rotation.y = Math.atan2(nx - x, nz - z) + XHPI; colRect((x + nx) / 2, (z + nz) / 2, L, .2, Math.atan2(nx - x, nz - z) + XHPI, .2); } }
  { const [x, z] = F(4, 31); xbox(world, 2.4, 1.4, .1, 'yellow', x, heightAt(x, z) + 1.6, z, yaw); xNote(world, 'bw_sign', x, heightAt(x, z) + .1, z + .3, yaw); }
  // the main building: a concrete box, one end caved in
  const [hx, hz] = F(0, -4);
  { const g = new THREE.Group(), y0 = xLowest(hx, hz, 22, 14, yaw); xbox(g, 22, .4, 14, 'concD', 0, .2, 0);
    for (const [x, z, w, d, h] of [[0, -6.9, 22, .3, 5], [-10.9, 0, .3, 14, 5], [10.9, -3, .3, 8, 3], [-6.5, 6.9, 9, .3, 5], [6.5, 6.9, 9, .3, 2.6]]) xbox(g, w, h, d, 'concW', x, h / 2 + .3, z);
    xbox(g, 14, .3, 14.4, 'concD', -4, 5.3, 0); for (let i = 0; i < 4; i++) xbox(g, 2, 1.1, .32, 'glass', -8 + i * 4, 3, -6.9);
    xRubble(g, 7, .3, 2, 26, 4, 'concW'); const sl = xbox(g, 8, .3, 7, 'concD', 6.5, 2.2, 1.5); sl.rotation.z = .5;
    g.position.set(hx, y0, hz); g.rotation.y = yaw; world.add(g); xColRect(hx, hz, 22, 14, yaw, .45, 4); addFloor(hx, hz, yaw, 11, 7, y0 + .4); SHELTERS.push({ x: hx, z: hz, kind: 'house', r: 5 });
    // a cracked tank outside the collapsed end: green glow, and the counter starts clicking
    const [tx, tz] = xFrame(hx, hz, yaw)(13, 2); const t = xcyl(world, 1.6, 1.6, 4, 'metal', tx, y0 + 2, tz, 14); t.rotation.z = .25;
    for (let i = 0; i < 10; i++) mesh(new THREE.SphereGeometry(xr(.08, .2), 6, 4), xm('glowG'), tx + xr(-3, 3), heightAt(tx, tz) + .05, tz + xr(-3, 3), world);
    xLamp(world, tx, y0 + 1, tz, 0x6aff8a, 1.2, 14, false); XRAD.push({ x: tx, z: tz, r: 9, k: 6 }); addCol(tx, tz, 1.8);
    const [cx, cz] = xFrame(hx, hz, yaw)(-8, 4); const C = cache(world, cx, cz, yaw, 'pry', 'ruin', { id: 'x_bright_office', name: 'Filing cabinet', rolls: 2, keys: ['documents'], refill: 5 }); C.g.position.y = y0 + .4;
    // the hatch in the floor
    const [qx, qz] = xFrame(hx, hz, yaw)(-4, 0); xbox(world, 1.6, .1, 1.6, 'panel', qx, y0 + .45, qz, yaw); xbox(world, 1.7, .04, .2, 'yellow', qx, y0 + .5, qz, yaw);
    const pk = mkPocket('lab', 'BRIGHTWATER LAB', { surf: 'metal', fog: 45, hemi: .12, hemiC: 0x8aa09a, power: true }); pk.sub = 'The fog was meant to be a cure';
    const [ox, oz] = xFrame(hx, hz, yaw)(-4, 2.2);
    xEntrance(pk, qx, qz, 'Open the floor hatch · climb down', { x: pk.ox + 2.5, y: pk.y, z: pk.oz + 1.2, yaw: Math.PI }, { x: ox, y: y0 + .4, z: oz, yaw });
    buildLab(pk);
  }
  for (let i = 0; i < 2; i++) { const [x, z] = F(xr(-18, 18), xr(10, 24)); supplyCrate(x, z); CRATES[CRATES.length - 1].table = 'ruin'; }
  { const [x, z] = F(-16, 18); car(x, z, yaw + 2); }
}
function buildLab(pk) {
  const r = { wall: 'concW', floor: 'tile', ceil: 'concW' };
  xRoom(pk, 0, 0, 5, 5, { ...r, h: 3 });                       // the ladder well
  xRoom(pk, 1, 4, 4, 30, { ...r, h: 3 });                      // the decon corridor (a hall where it meets the labs)
  xRoom(pk, 2.5, 12, 16, 22, { ...r, h: 3.4 });                // lab A
  xRoom(pk, -12, 12, 2.5, 22, { ...r, h: 3.4 });               // lab B (the leak)
  xRoom(pk, -1, 29, 6, 38, { ...r, h: 3 });                    // the archive
  xExit(pk, 2.5, 0, .6, 'Climb the ladder out');
  const g = pk.g, Y = pk.y, P2 = (lx, lz) => pw(pk, lx, lz);
  { const [x, z] = P2(2.5, .3); for (let k = 0; k < 9; k++) xbox(g, .9, .05, .05, 'metal', x, Y + .3 + k * .35, z); }
  for (const [x, z] of [[2.5, 2.5], [2.5, 8], [9, 15], [9, 19.5], [-5, 17], [2.5, 25], [2.5, 34]]) xPLamp(pk, x, 2.9, z, 0xd8fff0, 1.1, 12);
  xELamp(pk, -9, 2.6, 13, 0x6aff8a, .9, 12);
  // decon arches with nozzles
  for (const z of [6, 8, 10]) { const [x, zz] = P2(2.5, z); for (const s of [-1, 1]) xbox(g, .15, 2.8, .2, 'metal', x + s * 1.35, Y + 1.4, zz); xbox(g, 2.9, .15, .2, 'metal', x, Y + 2.8, zz); }
  // lab A: specimen tanks with something cloudy in them, benches, terminals, the suit locker
  for (let i = 0; i < 4; i++) { const [x, z] = P2(7 + i * 2.4, 21); xcyl(g, .55, .55, .3, 'metal', x, Y + .15, z, 14); const tk = mesh(new THREE.CylinderGeometry(.5, .5, 2.1, 14, 1, true), xm('glass'), x, Y + 1.35, z, g);
    const fl = mesh(new THREE.CylinderGeometry(.46, .46, 1.6 - i * .2, 12), new THREE.MeshBasicMaterial({ color: 0x8a3a2a, transparent: true, opacity: .5, toneMapped: false }), x, Y + .3 + (1.6 - i * .2) / 2, z, g); xcyl(g, .55, .55, .3, 'metal', x, Y + 2.55, z, 14); }
  xSolid(pk, 6, 20.2, 15.6, 21.9);
  for (const z of [14.5, 17.5]) { const [x, zz] = P2(10, z); xbox(g, 6, .08, 1, 'white', x, Y + .9, zz); xbox(g, 5.8, .85, .9, 'metal', x, Y + .44, zz); xSolid(pk, 7, z - .6, 13, z + .6); for (let k = 0; k < 4; k++) xcyl(g, .06, .06, .25, 'glass', x - 2 + k * 1.2, Y + 1.06, zz, 8); }
  xNote(g, 'bw_varga1', ...P2(15, 13.2).flatMap((v, i) => i ? [Y, v] : [v]), -XHPI, pk); xSolid(pk, 14.4, 12.6, 15.6, 13.8);
  xNote(g, 'bw_liaison', ...P2(9, 17.5).flatMap((v, i) => i ? [Y + .95, v] : [v]), 0, pk);
  xPCache(pk, 15.2, 16, -XHPI, 'none', 'mil', { id: 'x_lab_suits', name: 'Suit locker', rolls: 0, keys: ['hazmat', 'purify_tab'], refill: 0 });
  // lab B: the cracked tank and the hot salts. Radiation in here.
  { const [x, z] = P2(-8, 17); const t = xcyl(g, 1.1, 1.1, 2.8, 'metal', x, Y + 1.4, z, 14); t.rotation.z = .15; for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(xr(.05, .16), 6, 4), xm('glowG'), x + xr(-3, 3), Y + .04, z + xr(-3, 3), g); xSolid(pk, -9.2, 15.8, -6.8, 18.2);
    xLamp(g, x, Y + 1, z, 0x6aff8a, 1.4, 12, false); }
  pk.hz.push({ x0: pk.ox - 12, z0: pk.oz + 12, x1: pk.ox - 2, z1: pk.oz + 22, k: 7 });
  xNote(g, 'bw_varga2', ...P2(0, 13).flatMap((v, i) => i ? [Y + .95, v] : [v]), 0, pk); xbox(g, 1.2, .9, .6, 'metal', pk.ox, Y + .45, pk.oz + 13); xSolid(pk, -.6, 12.6, .6, 13.4);
  xPCache(pk, -11, 20.5, XHPI, 'none', 'op', { id: 'x_lab_hot', name: 'Shielded case', rolls: 2, keys: ['rust_med', 'lab_sample'], refill: 0 });
  for (let i = 0; i < 4; i++) { const [x, z] = P2(-11.4, 13 + i * 1.6); xModel(g, 'props/server-rack', 2, x, Y, z, XHPI) || xbox(g, .6, 2, .6, 'metal', x, Y + 1, z); } xSolid(pk, -12, 12.4, -10.8, 19);
  // the archive door: the Brightwater keycard
  xDoor(pk, 'lab_archive', 2.5, 29.5, 'x', 3, { need: 'bw_card', label: 'the archive door' });
  for (let i = 0; i < 5; i++) { const [x, z] = P2(-.4 + i * 1.5, 37.4); xModel(g, 'props/server-tower', 2, x, Y, z, Math.PI) || xbox(g, .8, 2, .6, 'metal', x, Y + 1, z); } xSolid(pk, -1, 36.8, 6, 38);
  xNote(g, 'bw_archive', ...P2(2.5, 35.5).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 1.9, 34.9, 3.1, 36.1);
  xPCache(pk, 5.2, 31.5, -XHPI, 'none', 'op', { id: 'x_lab_archive', name: 'Archive vault', big: 1, rolls: 3, keys: ['greyhold_files', 'rust_detector', 'med_scanner'], refill: 0 });
  XMARKS.site9 = { x: XSITES.blackdoor.x, z: XSITES.blackdoor.z, n: 'Site Nine' }; LOGS.bw_archive.mark = 'site9'; LOGS.kv_log.mark = 'site9';
}

/* ---------- the Long Fall: Hydroponics Ring C, down in the hills for decades ---------- */
function buildLongFall() {
  const S = XSITES.longfall, yaw = xr(0, 6.28), F = xFrame(S.x, S.z, yaw), y = heightAt(S.x, S.z);
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(3, 3);
  const skin = new THREE.MeshStandardMaterial({ map: t, color: 0x8a8a82, metalness: .4, roughness: .7, side: THREE.DoubleSide });
  // the ring section, half buried, moss-green along the bottom, a solar wing snapped off and lying beside it
  { const g = new THREE.Group(); const R = 7, L = 30; const h = mesh(new THREE.CylinderGeometry(R, R, L, 26, 1, true, .4, 5.2), skin, 0, 0, 0, g); h.rotation.z = XHPI;
    for (let x = -L / 2 + 3; x < L / 2; x += 5) { const rib = mesh(new THREE.TorusGeometry(R + .3, .3, 5, 18, 5.2), xSm(0x9a9890, { metalness: .4 }), x, 0, 0, g); rib.rotation.y = XHPI; rib.rotation.z = .4; }
    const moss = mesh(new THREE.CylinderGeometry(R + .05, R + .05, L, 26, 1, true, 2.2, 1.6), new THREE.MeshLambertMaterial({ color: 0x3a5a2a, transparent: true, opacity: .7, side: THREE.DoubleSide }), 0, 0, 0, g); moss.rotation.z = XHPI;
    g.position.set(S.x, y + 2.2, S.z); g.rotation.set(0, yaw, .08); world.add(g);
    for (let k = -12; k <= 12; k += 4) { const [px, pz] = F(k, -6); addCol(px, pz, 1.4); const [qx, qz] = F(k, 6); addCol(qx, qz, 1.4); } }
  { const [x, z] = F(4, 18), g = new THREE.Group(); for (let i = 0; i < 6; i++) xbox(g, 3.6, .08, 2.2, new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: .6, roughness: .3 }), i * 3.8, 0, 0); xbox(g, 23, .2, .3, 'metal', 9.5, .1, 0); g.position.set(x, heightAt(x, z) + .3, z); g.rotation.set(.1, yaw + .6, .08); world.add(g); }
  // seed racks spilled out of the open end, gone wild: a little green patch of crops nobody planted
  for (let i = 0; i < 40; i++) { const [x, z] = F(-20 + xr(-6, 6), xr(-6, 6)); const p = mesh(new THREE.ConeGeometry(xr(.15, .35), xr(.6, 1.3), 5), new THREE.MeshLambertMaterial({ color: xp([0x4a7a2a, 0x6a8a2a, 0x8a9a3a]) }), x, heightAt(x, z) + .4, z, world); }
  // the crew's graves: nine walked out, the rest are here
  for (let i = 0; i < 6; i++) { const [x, z] = F(-8 + i * 2.6, 14); xbox(world, .1, 1.2, .1, 'metal', x, heightAt(x, z) + .6, z); xbox(world, .7, .1, .1, 'metal', x, heightAt(x, z) + 1, z, yaw); }
  { const [x, z] = F(-15.5, 0); xNote(world, 'lf_rec', x, heightAt(x, z) + .1, z, yaw); }
  { const [x, z] = F(-13, 3.5); xNote(world, 'lf_manifest', x, heightAt(x, z), z, yaw + XHPI); }
  { const [x, z] = F(-12, -3); const C = cache(world, x, z, yaw, 'chip', 'arc', { id: 'x_longfall_med', name: 'Ring C med stores', big: 1, rolls: 3, keys: ['medkit', 'antibiotic'], refill: 0 }); }
  { const [x, z] = F(-17, -4); const C = cache(world, x, z, yaw, 'none', 'arc', { id: 'x_longfall_lock', name: 'Crew locker', rolls: 2, keys: ['id_chip'], refill: 0 }); }
  xSkeleton(world, ...(() => { const [x, z] = F(-16, 2); return [x, heightAt(x, z), z]; })(), yaw + .5);
  for (let i = 0; i < 16; i++) { const [x, z] = F(xr(-40, 40), xr(-30, 30)); if (Math.abs(x - S.x) < 16 && Math.abs(z - S.z) < 8) continue; const m = mesh(new THREE.BoxGeometry(xr(1, 3.5), xr(.15, .35), xr(1, 2.5)), skin, x, heightAt(x, z) + .2, z, world); m.rotation.set(xr(-1, 1), xr(0, 6), xr(-.5, .5)); }
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-35, 35), xr(-25, 25)); spawnScrap(x, z, 'wild'); }
}

/* ---------- Route 9 ---------- */
function buildRoute9() {
  // the road: slabs of old asphalt laid on the ground, lane lines, barriers, a jam of dead cars
  const R = XROAD, g = new THREE.Group(); world.add(g);
  for (let i = 0; i < R.length - 1; i++) { const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az) + .4, a = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ha = heightAt(ax, az), hb = heightAt(bx, bz), hm = Math.min(ha, hb, heightAt(mx, mz));
    if (waterAt(mx, mz) > hm) continue;
    const s = xbox(g, 12, .7, L, 'asphalt', mx, (ha + hb) / 2 + .02, mz, a, 4); s.rotation.x = Math.atan2(ha - hb, L) ; s.rotation.order = 'YXZ'; s.rotation.set(Math.atan2(ha - hb, L), a, 0);
    if (i % 2 === 0) { const ln = xbox(g, .2, .02, 3, 'yellow', mx, (ha + hb) / 2 + .38, mz, a); ln.rotation.order = 'YXZ'; ln.rotation.set(Math.atan2(ha - hb, L), a, 0); }
    if (i % 3 === 0 && xrnd() < .7) for (const sd of [-1, 1]) { const [px, pz] = xFrame(mx, mz, a)(sd * 6.3, 0); const b = xbox(g, .4, .8, L * .9, 'conc', px, heightAt(px, pz) + .35, pz, a); addCol(px, pz, .5); }
  }
  // the jam: lines of cars, a tanker jack-knifed across both lanes, a bus on its side
  const n = R.length;
  for (let i = 8; i < n - 8; i += 2) { if (xrnd() < .35) continue; const [ax, az] = R[i], [bx, bz] = R[i + 1], a = Math.atan2(bx - ax, bz - az); for (const lane of [-3, 3]) { if (xrnd() < .4) continue; const [x, z] = xFrame(ax, az, a)(lane + xr(-.4, .4), xr(-1, 1)); car(x, z, a + (lane < 0 ? 0 : Math.PI) + xr(-.25, .25)); } }
  { const [ax, az] = R[Math.floor(n / 2)], [bx, bz] = R[Math.floor(n / 2) + 1], a = Math.atan2(bx - ax, bz - az), F = xFrame(ax, az, a);
    const tg = new THREE.Group(); xbox(tg, 2.6, 3, 12, 'white', 0, 2, 0); xbox(tg, 2.4, .9, 11, 'dark', 0, .45, 0); for (const k of [-4.5, -3.3, 4.5]) for (const s of [-1, 1]) { const w = xcyl(tg, .55, .55, .4, 'dark', s * 1.2, .55, k, 12); w.rotation.z = XHPI; }
    const [tx, tz] = F(0, 0); xPlace(tg, tx, tz, a + 1.2); const FT = xFrame(tx, tz, a + 1.2); for (const k of [-5, -2.5, 0, 2.5, 5]) { const [px, pz] = FT(0, k); addCol(px, pz, 1.5); }
    const cab = new THREE.Group(); xbox(cab, 2.6, 2.8, 3, 'rust', 0, 1.8, 0); xbox(cab, 2.4, .9, 1.2, 'glass', 0, 2.6, 1.5); const [cx, cz] = FT(0, 8); xPlace(cab, cx, cz, a + .3); addCol(cx, cz, 1.7);
    const [dx, dz] = FT(1.6, 2); const C = cache(world, dx, dz, a + 1.2, 'cutter', 'city', { id: 'x_r9_trailer', name: 'Trailer doors (chained)', big: 1, rolls: 2, keys: ['canned', 'water_filtered'], refill: 6 });
    const [nx, nz] = F(-3, -10); xNote(world, 'r9_note', nx, heightAt(nx, nz) + .9, nz, a);
    const [bsx, bsz] = F(4, 18); const bus = new THREE.Group(); if (!xModel(bus, 'e/bus', 3, 0, 0, 0, 0)) xbox(bus, 2.6, 3, 11, 'yellow', 0, 1.5, 0); bus.position.set(bsx, heightAt(bsx, bsz) + 1.3, bsz); bus.rotation.set(0, a + .2, XHPI * .98); world.add(bus); { const FB = xFrame(bsx, bsz, a + .2); for (const k of [-4, -1.5, 1, 3.5]) { const [px, pz] = FB(0, k); addCol(px, pz, 1.6); } }
    const [px, pz] = F(6.5, 18); xNote(world, 'r9_photo', px, heightAt(px, pz) + .05, pz, a);
    // the overpass: two pillars still standing, the deck broken in the middle and dropped onto the road
    const [ox, oz] = F(0, 60); for (const s of [-1, 1]) { const [qx, qz] = xFrame(ox, oz, a)(s * 9, 0); xbox(world, 1.6, 8, 1.6, 'conc', qx, heightAt(qx, qz) + 4, qz, a); addCol(qx, qz, 1.2); const dk = xbox(world, 8, .8, 12, 'concD', ...(() => { const [ux, uz] = xFrame(ox, oz, a)(s * 6, 0); return [ux, heightAt(ux, uz) + 4, uz]; })(), a + XHPI); dk.rotation.order = 'YXZ'; dk.rotation.set(0, a + XHPI, s * .55); }
    xRubble(world, ox, heightAt(ox, oz), oz, 14, 4, 'concD'); }
  for (let i = 0; i < 10; i++) { const [x, z] = R[Math.floor(xr(4, n - 4))]; spawnScrap(x + xr(-5, 5), z + xr(-5, 5), 'wild'); }
  for (let i = 0; i < 4; i++) { const [x, z] = R[Math.floor(xr(6, n - 6))]; supplyCrate(x + xr(-4, 4), z + xr(-4, 4)); CRATES[CRATES.length - 1].table = 'ruin'; }
}

/* ---------- Ember Rest: a clan camp, burnt out ---------- */
function buildEmber() {
  const S = XSITES.ember, F = xFrame(S.x, S.z, 0), y = heightAt(S.x, S.z);
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.28; if (xrnd() < .35) continue; const [x, z] = F(Math.cos(a) * 24, Math.sin(a) * 24), h = xr(1.5, 4.5); const p = mesh(new THREE.CylinderGeometry(.08, .28, h, 6), xm('char'), x, heightAt(x, z) + h / 2 - .2, z, world); p.rotation.set(xr(-.4, .4), 0, xr(-.4, .4)); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + xr(-.2, .2), [x, z] = F(Math.cos(a) * xr(8, 16), Math.sin(a) * xr(8, 16)); xTent(world, x, z, -a, 0, true); }
  { const g = new THREE.Group(); mesh(new THREE.CircleGeometry(4, 16), xm('char'), 0, .05, 0, g).rotation.x = -XHPI; for (let i = 0; i < 12; i++) { const l = xbox(g, .25, .25, xr(1.5, 3), 'char', xr(-1.5, 1.5), .2, xr(-1.5, 1.5), xr(0, 3)); } xPlace(g, S.x, S.z); }
  for (let i = 0; i < 5; i++) { const [x, z] = F(xr(-14, 14), xr(-14, 14)); xSkeleton(world, x, heightAt(x, z), z, xr(0, 6)); }
  for (let i = 0; i < 6; i++) { const [x, z] = F(xr(-16, 16), xr(-16, 16)); const sp = xcyl(world, .03, .03, 2.2, 'woodD', x, heightAt(x, z) + .1, z, 5); sp.rotation.set(XHPI, xr(0, 6), 0); }
  { const [x, z] = F(5, -6), p = xbox(world, .35, .35, 4, 'char', x, heightAt(x, z) + .2, z, .4); xNote(world, 'em_carve', x + .5, heightAt(x, z) + .1, z, .4); }
  SMOKES.push({ x: S.x, z: S.z, y: y + .5, k: .3 });
  const C = cache(world, ...F(-10, 9), .3, 'none', 'clan', { id: 'x_ember', name: 'A cache under a hide', rolls: 3, keys: ['insignia'], refill: 0 });
}

/* ---------- the Black Door ---------- */
function buildBlackDoor() {
  const S = XSITES.blackdoor, f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z);
  const g = new THREE.Group();
  xbox(g, 10, 8, 3, 'concD', 0, 3, -1.6); xbox(g, 6, 5.6, .4, new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x3a3a40, metalness: .55, roughness: .45 }), 0, 2.8, .1);
  for (let i = 0; i < 5; i++) xbox(g, 5.6, .08, .1, 'metal', 0, .8 + i * 1.1, .34);
  for (const s of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(3, 1), xm('rock'), s * 5.4, 2, -1.4, g); r.scale.set(.8, 1.2, 1); }
  const top = mesh(new THREE.DodecahedronGeometry(3.6, 1), xm('rock'), 0, 7, -2, g); top.scale.set(1.8, .7, 1.2);
  xbox(g, .5, .7, .14, 'dark', 3.6, 1.5, .25); xLamp(g, 3.6, 2.2, 1.2, 0xffa040, .9, 9, false); const kp = mesh(new THREE.PlaneGeometry(.36, .2), new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false }), 3.6, 1.7, .33, g);
  XANIM.push(t => { kp.material.color.setHSL(.1, 1, .35 + (Math.sin(t * 6.28 / 11) > .95 ? .25 : 0)); });
  xbox(g, 1.6, .4, .05, 'yellow', 0, 6, .35); xbox(g, 1.4, .2, .02, 'dark', 0, 6, .38);
  g.position.set(S.x, y - .5, S.z); g.rotation.y = f; world.add(g);
  for (let k = -4; k <= 4; k += 1.6) { const [x, z] = F(k, -.2); addCol(x, z, .9); }
  const [kx, kz] = F(3.6, 1.2); xNote(world, 'bd_keypad', kx, heightAt(kx, kz) + .05, kz, f);
  xUse({ x: kx, z: kz, r: 2, pocket: null, label: () => 'Try the keypad', act: () => { sfx('no'); toast('AWAITING SIGNAL. The keys don’t even click.', 3); (G.flags.blackdoor = (G.flags.blackdoor || 0) + 1); } });
}

/* ---------- the river crossings ---------- */
function buildCrossings() {
  const R = XCROSS.rope;
  if (R) {   // a plank-and-rope bridge over the gorge
    const y0 = R.hl + .4, y1 = R.hr + .4, len = R.xr - R.xl, mid = (R.xl + R.xr) / 2, sl = (y1 - y0) / len, g = new THREE.Group();
    for (let k = 0; k < len / .5; k++) { const x = R.xl + k * .5 + .25, sag = Math.sin(k * .5 / len * Math.PI) * -.9; const p = xbox(world, .4, .08, 1.7, 'wood', x, y0 + (x - R.xl) * sl + sag, R.z); p.rotation.z = xr(-.04, .04); }
    for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 20; k++) { const x = R.xl + k / 20 * len; pts.push(new THREE.Vector3(x, y0 + (x - R.xl) * sl + Math.sin(k / 20 * Math.PI) * -.6 + 1, R.z + s * .9)); } world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a7a5a }))); }
    for (const [x, yy] of [[R.xl, y0], [R.xr, y1]]) for (const s of [-1, 1]) { xbox(world, .2, 1.8, .2, 'woodD', x, yy + .5, R.z + s * .95); addCol(x, R.z + s * .95, .2); }
    // the deck: three gently sagging pieces so you walk the dip
    for (let k = 0; k < 3; k++) { const xa = R.xl + k * len / 3, xb = xa + len / 3, ya = y0 + (xa - R.xl) * sl + Math.sin(k / 3 * Math.PI) * -.9, yb = y0 + (xb - R.xl) * sl + Math.sin((k + 1) / 3 * Math.PI) * -.9;
      FLOORS.push({ cx: (xa + xb) / 2, cz: R.z, c: 1, s: 0, hw: (xb - xa) / 2 + .05, hd: .85, y: (ya + yb) / 2 + .04, slope: (yb - ya) / (xb - xa) }); }
    REGIONS.push({ id: 'x_rope', name: 'THE ROPE BRIDGE', sub: 'Someone strung it over the gorge · it holds, mostly', x: mid, z: R.z, r: 26 });
  }
  const D = XCROSS.ford;
  if (D) {   // stepping stones across the shallows
    const wl = D.wl, n = Math.round((D.xr - D.xl) / 1.45);
    for (let k = 0; k <= n; k++) { const x = D.xl + (D.xr - D.xl) * k / n, gy = heightAt(x, D.z); if (gy > wl + .2) continue; const top = wl + .28;
      const st = mesh(new THREE.CylinderGeometry(.75, .9, top - gy + .4, 8), M(0x8a8680), x, (top + gy) / 2 - .2, D.z + xr(-.15, .15), world); st.rotation.y = xr(0, 3); FLOORS.push({ cx: x, cz: D.z, c: 1, s: 0, hw: .72, hd: .72, y: top }); }
    REGIONS.push({ id: 'x_ford', name: 'THE STEPPING STONES', sub: 'A dry way over the Coldwater', x: (D.xl + D.xr) / 2, z: D.z, r: 24 });
  }
}

/* ---------- little camps: somebody stopped here once ---------- */
function buildCamps() {
  XCAMPS.forEach((C, i) => {
    const y = heightAt(C.x, C.z), F = xFrame(C.x, C.z, xr(0, 6.28));
    const [fx, fz] = F(0, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; mesh(new THREE.DodecahedronGeometry(.17, 0), M(0x5a5650), fx + Math.cos(a) * .55, y + .06, fz + Math.sin(a) * .55, world); } mesh(new THREE.CircleGeometry(.4, 10), xm('char'), fx, y + .03, fz, world).rotation.x = -XHPI;
    { const [x, z] = F(2.4, 1); xTent(world, x, z, xr(0, 6), xp([0x6a5a3a, 0x4a5a3a, 0x5a4a5a]), i === 4); }
    { const [x, z] = F(-1.6, 1.8); const l = xbox(world, .4, .4, 2.4, 'woodD', x, heightAt(x, z) + .2, z, xr(0, 3)); }
    if (i === 1 || i === 4 || i === 5) { const [x, z] = F(-2, -1.5); xSkeleton(world, x, heightAt(x, z), z, xr(0, 6)); }
    if (i === 5) { const [x, z] = F(1, -2); const m = mesh(new THREE.BoxGeometry(.3, .35, .2), M(0x2a2a2a), x, heightAt(x, z) + .15, z, world); }
    const [nx, nz] = F(-1, 1.2); xNote(world, 'cp' + i, nx, heightAt(nx, nz) + (LOGS['cp' + i].kind === 'carve' ? 0 : .42), nz, xr(0, 6));
    const [cx, cz] = F(1.5, -1.8); cache(world, cx, cz, xr(0, 6), 'none', i === 5 ? 'mil' : i === 3 ? 'clan' : 'wild', { id: 'x_camp' + i, name: 'Left-behind pack', rolls: 1, refill: 7 });
    REGIONS.push({ id: 'x_camp' + i, name: ['TAV AND REN’S CAMP', 'THE LONE CAMP', 'A SCOUT’S CAMP', 'THE OFFERING STONE', 'THE FAMILY CAMP', 'A PATROL’S CAMP', 'THE DROVER’S CAMP', 'ROOK’S LOOKOUT'][i], sub: 'Somebody stopped here once', x: C.x, z: C.z, r: 14 });
  });
}

/* ---------- marked stashes: three short bars on a rock ---------- */
function buildStashes() {
  XSTASH.forEach((S, i) => {
    const y = heightAt(S.x, S.z), r = mesh(new THREE.DodecahedronGeometry(1.1, 0), M(0x8a8680), S.x, y + .5, S.z, world); r.scale.set(1.2, .8, 1); addCol(S.x, S.z, 1.1);
    const a = xr(0, 6.28); for (let k = 0; k < 3; k++) { const b = mesh(new THREE.PlaneGeometry(.12, .5), xm('paint'), S.x + Math.sin(a) * 1.15 + Math.cos(a) * (k - 1) * .2, y + .7, S.z + Math.cos(a) * 1.15 - Math.sin(a) * (k - 1) * .2, world); b.rotation.y = a; }
    const [cx, cz] = xFrame(S.x, S.z, a)(0, 2.2); const C = cache(world, cx, cz, a, 'none', i % 2 ? 'mil' : 'ruin', { id: 'x_stash' + i, name: 'A buried stash', rolls: 2, keys: ['fuse'], refill: 0 });
    C.g.scale.y = .5; mesh(new THREE.CircleGeometry(1.2, 10), xm('dirt'), cx, heightAt(cx, cz) + .03, cz, world).rotation.x = -XHPI;
    if (i === 0) xNote(world, 'mk_mark', S.x + Math.sin(a) * 1.6, y + .1, S.z + Math.cos(a) * 1.6, a);
    XMARKS['stash' + i] = { x: S.x, z: S.z, n: 'Marked stash' };
  });
}

/* ================= reading, the Journal, the map ================= */
let xReader = null, xReading = null;
function buildXHud() {
  const st = document.createElement('style');
  st.textContent = `#xread{position:fixed;inset:0;display:none;place-items:center;z-index:60;background:rgba(6,6,6,.55)}#xread.on{display:grid}
#xread .pg{width:min(560px,90vw);max-height:80vh;overflow:auto;background:#e9e1cc;color:#2a241c;padding:26px 30px 20px;border-radius:3px;box-shadow:0 12px 40px #000a;font:17px/1.5 Georgia,serif;white-space:pre-wrap}
#xread.term .pg{background:#0c1410;color:#7ff0a8;font:15px/1.5 ui-monospace,Menlo,monospace;border:1px solid #2a5a3a}#xread.rec .pg{background:#1a1816;color:#e8dcc4}#xread.carve .pg{background:#5a4a3a;color:#f0e0c4}
#xread h3{margin:0 0 2px;font:700 13px/1.2 "Barlow Condensed",sans-serif;letter-spacing:.12em;text-transform:uppercase;opacity:.65}#xread h2{margin:0 0 12px;font:700 22px/1.2 "Barlow Condensed",sans-serif}
#xread .by{margin-top:14px;font-style:italic;opacity:.7}#xread button{margin-top:14px;font:700 14px "Barlow Condensed",sans-serif;padding:7px 18px;background:#2a241c;color:#e9e1cc;border:0;border-radius:3px;cursor:pointer}
#xfade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:55}
#xtag{position:fixed;top:12px;left:50%;transform:translateX(-50%);font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#c8c0b0;background:#0008;padding:4px 12px;border-radius:3px;display:none;z-index:20;pointer-events:none}
#xrad{position:fixed;left:16px;bottom:118px;width:150px;display:none;z-index:20;font:700 12px "Barlow Condensed",sans-serif;color:#9aff8a;letter-spacing:.08em;pointer-events:none}#xrad i{display:block;height:5px;background:#6aff6a;margin-top:2px;border-radius:2px}
.jn{display:grid;gap:6px}.jn button.lg{display:block;width:100%;text-align:left;padding:7px 10px;background:#0003;border:1px solid #fff2;color:inherit;font:inherit;border-radius:3px;cursor:pointer}.jn button.lg small{opacity:.6;margin-left:6px}.jn .pl{margin:4px 0 0;opacity:.75}`;
  document.head.appendChild(st);
  xReader = document.createElement('div'); xReader.id = 'xread'; document.body.appendChild(xReader);
  xReader.addEventListener('click', e => { if (e.target === xReader || e.target.closest('button')) closeLog(); });
  UG.fadeEl = document.createElement('div'); UG.fadeEl.id = 'xfade'; document.body.appendChild(UG.fadeEl);
  UG.tagEl = document.createElement('div'); UG.tagEl.id = 'xtag'; document.body.appendChild(UG.tagEl);
  UG.radEl = document.createElement('div'); UG.radEl.id = 'xrad'; UG.radEl.innerHTML = 'RADIATION<i></i>'; document.body.appendChild(UG.radEl);
  addEventListener('keydown', e => { if (!xReading) return; if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat) closeLog(); } }, true);
}
function openLog(id) {
  const L = LOGS[id]; if (!L) return; xReading = id;
  const logs = G.flags.logs ||= {}, first = !logs[id];
  if (first) { logs[id] = G.day; const mk = [].concat(L.mark || []); for (const m of mk) (G.flags.xmark ||= {})[m] = 1; save(); }
  if (L.kind === 'rec') { noiseBurst(.5, 1800, .6, .06, 'bandpass'); }
  xReader.className = 'on ' + L.kind;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  xReader.innerHTML = `<div class="pg"><h3>${esc(LOG_KIND[L.kind][1])} · ${esc(L.at)}</h3><h2>${esc(L.t)}</h2>${esc(L.b)}${L.by ? `<div class="by">— ${esc(L.by)}</div>` : ''}${first && L.mark ? '<div class="by">Marked on your map.</div>' : ''}<div><button>Close${isTouch ? '' : ' (E)'}</button></div></div>`;
  if (document.pointerLockElement) document.exitPointerLock();
  if (first) { const n = Object.keys(logs).length; toast(`Journal · ${n} of ${Object.keys(LOGS).length} found`, 2.4); }
}
function closeLog() { xReading = null; xReader.className = ''; if (!isTouch && G.mode === 'play' && !invOpen) canvas.requestPointerLock?.(); }
function journalHTML() {
  const logs = G.flags.logs || {}, ids = Object.keys(LOGS), found = ids.filter(i => logs[i]);
  let h = `<p class="dim">Things you’ve found that tell what happened here · ${found.length} of ${ids.length}. Tap one to read it again.</p><div class="jn">`;
  const by = {}; for (const id of found) (by[LOGS[id].at] ||= []).push(id);
  for (const at of Object.keys(by)) { h += `<p class="pl"><b>${at}</b></p>`; for (const id of by[at]) h += `<button class="lg" data-log="${id}">${LOGS[id].t}<small>${LOG_KIND[LOGS[id].kind][1]}</small></button>`; }
  if (!found.length) h += '<p class="dim">Nothing yet. Notes, recordings, terminals and marks are left all over — look for a faint glint.</p>';
  const places = XSITE_DEFS.filter(D => D.id !== 'tunB' && (G.flags.seen || {})['x_' + D.id]).map(D => D.name), unseen = XSITE_DEFS.length - 1 - places.length;
  h += `<p class="pl"><b>Places found</b> · ${places.length ? places.join(' · ') : 'none yet'}${unseen ? ` · ${unseen} more out there` : ''}</p></div>`;
  return h;
}
function drawXMarks(g, S, k) {
  const m = G.flags.xmark || {}; g.font = `700 ${10 * k}px "Barlow Condensed",sans-serif`; g.textAlign = 'center';
  for (const id in m) { const M2 = XMARKS[id]; if (!M2) continue; const [x, y] = toMap(M2.x, M2.z, S); const done = id.startsWith('stash') && (G.flags.caches || {})['x_' + id];
    g.strokeStyle = done ? '#8a8478' : '#e8c070'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(x - 4 * k, y - 4 * k); g.lineTo(x + 4 * k, y + 4 * k); g.moveTo(x + 4 * k, y - 4 * k); g.lineTo(x - 4 * k, y + 4 * k); g.stroke();
    if (!(G.flags.seen || {})['x_' + (id === 'hesper_map' ? 'hesper' : id === 'site9' ? 'blackdoor' : id)]) { g.fillStyle = '#000a'; g.fillText(M2.n, x + k, y - 6 * k); g.fillStyle = '#e8c070'; g.fillText(M2.n, x, y - 7 * k); } }
}

/* ================= each frame ================= */
const nearXOf = (L, r) => { let b = null, bd = r; for (const o of L) { if ((o.pocket || null) !== UG.at) continue; if (o.y != null && Math.abs(o.y - P.y) > 2.6) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < (o.r || r) && d < bd) { bd = d; b = o; } } return b; };
const XINTERACT = [
  { id: 'xnote', at: () => nearXOf(XNOTES, 2.1), r: 2.1, label: () => { const n = nearXOf(XNOTES, 2.1), L = LOGS[n.id]; return `${LOG_KIND[L.kind][0]} · ${L.t}${(G.flags.logs || {})[n.id] ? ' (read)' : ''}`; }, act: () => openLog(nearXOf(XNOTES, 2.1).id) },
  { id: 'xuse', at: () => nearXOf(XUSE, 3), r: 3, label: () => nearXOf(XUSE, 3).label(), act: () => nearXOf(XUSE, 3).act() },
];
let xRadT = 0, xTick = 0;
function updXplore(dt) {
  for (const f of XANIM) f(G.t, dt);
  const pk = UG.at;
  if (pk) {
    if (P.fly) P.fly = false;
    const b = pk.bounds;
    // left without climbing out (you died down here and woke up somewhere else): put the pocket away, and bring your bag up to the entrance
    if (P.x < b[0] - 30 || P.x > b[2] + 30 || P.z < b[1] - 30 || P.z > b[3] + 30) {
      pk.g.visible = false; UG.at = null; UG.tagEl.style.display = 'none';
      const B = G.flags.bag; if (B && B.x > b[0] - 5 && B.x < b[2] + 5 && B.z > b[1] - 5 && B.z < b[3] + 5 && pk.out) { B.x = pk.out.x; B.z = pk.out.z; showBag(); save(); }
    }
    // a weak floor: stand on it a moment and it goes
    for (const W of pk.weak) { if (W.gone) continue; const on = P.x > W.x0 && P.x < W.x1 && P.z > W.z0 && P.z < W.z1 && Math.abs(P.y - pk.y) < .3;
      if (on) { W.t += dt; if (W.t > .25 && W.t - dt <= .25) { sfx('thud'); toast('The floor creaks…', 1.4); } if (W.t > .9) xCollapse(W); } else W.t = Math.max(0, W.t - dt * .5); }
  }
  // radiation: rooms in a pocket, or the spill outside Brightwater
  let rk = 0;
  if (pk) { for (const H of pk.hz) if (P.x > H.x0 && P.x < H.x1 && P.z > H.z0 && P.z < H.z1) rk = Math.max(rk, H.k); }
  else for (const R of XRAD) { const d = Math.hypot(P.x - R.x, P.z - R.z); if (d < R.r) rk = Math.max(rk, R.k * (1 - d / R.r * .6)); }
  const prot = clamp((typeof fogResist === 'function' ? fogResist() : 0), 0, 1);
  P.rad = P.rad || 0;
  if (rk > 0 && !P.dead) { P.rad = Math.min(100, P.rad + rk * (1 - prot * .9) * dt); xTick -= dt * (1 + rk * (1 - prot * .8)); if (xTick <= 0) { xTick = xr(.05, .35); noiseBurst(.012, 3200, 2, .05, 'highpass'); }
    if (!G.flags.radWarn) { G.flags.radWarn = 1; toast('Radiation — the counter’s clicking. A hazmat suit or a gas mask keeps it off you.', 4); } }
  else P.rad = Math.max(0, P.rad - dt * .8);
  if (P.rad > 40 && !P.dead && P.hp > 15) P.hp -= (P.rad - 40) * .012 * dt;
  xRadT -= dt; if (xRadT <= 0) { xRadT = .2; const on = P.rad > 1; UG.radEl.style.display = on ? 'block' : 'none'; if (on) { UG.radEl.firstElementChild.style.width = P.rad + '%'; UG.radEl.firstElementChild.style.background = P.rad > 40 ? '#e0d040' : '#6aff6a'; } }
  // the lamp you carry: only below ground
  if (UG.lamp) { const fl = pk && has('light'); UG.lamp.intensity = pk ? (fl ? 3.2 : 1.3) : 0; UG.lamp.distance = fl ? 28 : 12; }
  if (pk) { STEP_SURF = pk.surf; xAfterLight(); }   // again after the weather has had its say
}
// lighting below ground: no sun, a dim fill, a short dark haze (called from updTime after the sky is set)
function xAfterLight() {
  const pk = UG.at; if (!pk) return;
  sun.intensity = 0; hemi.intensity = pk.hemi + (pk.powered || pk.power ? .12 : 0); hemi.color.setHex(pk.hemiC);
  scene.fog.color.setHex(0x050607); scene.fog.far = pk.fog; scene.fog.near = packFogNear(1);
  stars.material.opacity = 0;
}
function xRestore() { if (UG.at) { UG.at.g.visible = false; UG.at = null; } UG.tagEl.style.display = 'none'; const mm = $('minic'); if (mm) mm.style.visibility = ''; P.rad = 0; for (const f of XRESTORE) f(); }
// Juno patching you up (or Rust medicine) clears radiation too
{ const ci = clearInjuries; clearInjuries = function () { ci(); P.rad = 0; }; }

/* ================= factions, territory, diplomacy (Nov 11, Part 4 of the overhaul) =================
   Every group out there is its own faction now, with a reputation you move by what you do:
   · FAC: the Thornkin (Ashmere, the Thorn outpost, the valley scouts), the Hollow Pines (Varnhold), the Ridge Runners
     (Sunscar), the Rootkin (Elderhollow), Ironjaw (the Foundry, the yards, Rustgate, Fort Hesper), Greyhold (the
     station) and Farlight (Arc traders). Clan fighters all share fac 'clan' in the old code: `facOf` works out which
     tribe a fighter belongs to from where they live (raiders are told when they're spawned).
   · reputation −100…100 (G.flags.fac[f].rep). Below −20 they attack on sight; a ceasefire holds them off for a week.
     Killing their people, burning their depot or killing their leader costs you; gifts, contracts, freeing their
     people and killing their enemies earns it. 75+ and a finished contract: they'll ally — fighters on raid nights,
     cheaper trade, and they'll be counted on Night 100.
   · territory (OUTPOSTS): the scout camps and three road checkpoints change hands. Each day the factions push on each
     other's outposts (`facDay`); clear one yourself and you can raise Kestrel's banner on it — it sends supplies home
     every morning until someone takes it back.
   · patrols walk between a faction's outposts, ambushes wait by the roads, rival groups fight each other out in the
     open (`facFight` drives a fighter who has a foe or is defending Kestrel as an ally).
   · each capital has a leader (tougher, named) and a supply depot. Burn the depot and that faction raids weaker for
     ten days; kill the leader and they're thrown into disorder for six — then they come for you.
   · talk: a white flag outside each capital (parley, even when they're hostile), the leader in person (when they're
     not), or the radio desk in the Arc. Everything else lives in the bag's Factions tab. */

const FAC = {
  thorn: { n: 'Thornkin', c: '#c0503a', cap: () => POI.ashmere, leader: ['Garrun', 'war-chief'], rep: -50, kind: 'clan', since: 1, rw: 1, want: ['bandage', 'canned', 'nails'], cap_r: 80 },
  pines: { n: 'Hollow Pines', c: '#4a8a5a', cap: () => HOLDS[0], leader: ['Old Mother Yew', 'elder'], rep: -30, kind: 'clan', since: 3, rw: .5, want: ['cloth', 'rope', 'canned'], cap_r: 60 },
  ridge: { n: 'Ridge Runners', c: '#c8a040', cap: () => HOLDS[1], leader: ['Kael Swift', 'runner-chief'], rep: -35, kind: 'clan', since: 3, rw: .5, want: ['arrows', 'hide', 'bandage'], cap_r: 60 },
  root: { n: 'Rootkin', c: '#8a6a3a', cap: () => HOLDS[2], leader: ['Elder Brann', 'root-elder'], rep: 0, kind: 'clan', since: 4, rw: .4, want: ['herb_med', 'seed_corn', 'canned'], cap_r: 64 },
  iron: { n: 'Ironjaw', c: '#8a8e96', cap: () => FOUNDRY, leader: ['Rask', 'boss'], rep: -45, kind: 'iron', since: 6, rw: .8, want: ['ammo_9', 'fuel', 'spare_parts'], cap_r: 90 },
  grey: { n: 'Greyhold', c: '#d8d8d8', cap: () => BASES.find(B => B.id === 'greystation'), leader: ['Captain Oren Vale', 'commander'], rep: -70, kind: 'grey', since: 20, rw: .5, floor: -60, want: ['rust_med', 'lab_sample'], cap_r: 70 },
  arc: { n: 'Farlight', c: '#7fc4b8', cap: () => BASES.find(B => B.id === 'farlight'), leader: ['Marta Quill', 'quartermaster'], rep: 40, kind: 'arc', since: 999, rw: 0, want: ['hide', 'dried_meat', 'herb_med'], cap_r: 60 },
};
const FAC_IDS = Object.keys(FAC), TRIBES = ['thorn', 'pines', 'ridge', 'root'];
// who's at war with whom (both ways)
const FAC_WAR = [['thorn', 'root'], ['thorn', 'iron'], ['thorn', 'grey'], ['pines', 'ridge'], ['pines', 'iron'], ['pines', 'grey'], ['ridge', 'iron'], ['ridge', 'grey'], ['root', 'grey'], ['iron', 'grey'], ['iron', 'arc'], ['grey', 'arc'], ['thorn', 'arc']];
const atWar = (a, b) => a !== b && FAC_WAR.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
const FAC_KINDS = { clan: ['warrior', 'thrower', 'warrior', 'brute'], iron: ['gunner', 'gunner', 'brute', 'gunner'], grey: ['soldier', 'soldier', 'soldier'], arc: ['gunner', 'gunner'] };
const facFac = f => FAC[f].kind === 'clan' ? 'clan' : FAC[f].kind;   // the old `fac` string a fighter of faction f carries

function facS(f) {   // a faction's saved state
  const A = G.flags.fac ||= {};
  return A[f] ||= { met: f === 'thorn' ? 1 : 0, rep: FAC[f].rep, cease: 0, allied: 0, depot: 0, lead: 0, job: null, done: 0, gift: 0, kday: 0, kgain: 0, buy: {} };
}
const facRep = f => facS(f).rep;
function facStanding(f) { const S = facS(f), r = S.rep; return S.allied ? 'Allied' : S.cease > G.day ? 'Ceasefire' : r <= -60 ? 'At war' : r < -20 ? 'Hostile' : r < 20 ? 'Wary' : r < 60 ? 'Friendly' : 'Trusted'; }
const facHostile = f => { if (!f || !FAC[f]) return true; const S = facS(f); return !S.allied && !(S.cease > G.day) && S.rep < -20; };
const facAllied = f => !!(FAC[f] && facS(f).allied);
function facAdd(f, d, why) {
  if (!FAC[f]) return; const S = facS(f), was = facHostile(f), r0 = S.rep;
  S.rep = clamp(S.rep + d, FAC[f].floor ?? -100, 100);
  if (S.allied && S.rep < 40) { S.allied = 0; toast(`The ${FAC[f].n} have broken the alliance`, 3.4); }
  const now = facHostile(f);
  if (why && Math.round(S.rep) !== Math.round(r0)) toast(`${FAC[f].n} ${d > 0 ? '+' : ''}${Math.round(d)} · ${why}`, 2.4);
  if (was && !now) toast(`The ${FAC[f].n} will no longer attack you on sight`, 3);
  if (!was && now) toast(`The ${FAC[f].n} are hostile now`, 3);
  facRegions(); save();
}
// which faction a fighter belongs to
function facOf(e) {
  if (e.tribe) return e.tribe;
  if (e.fac === 'iron' || e.fac === 'grey' || e.fac === 'arc') return e.fac;
  const h = e.home || e;
  if (Math.hypot(h.x, h.z) < VALLEY + 150) return 'thorn';
  let b = 'thorn', bd = Math.hypot(h.x - POI.ashmere.x, h.z - POI.ashmere.z);
  for (const [f, H] of [['pines', HOLDS[0]], ['ridge', HOLDS[1]], ['root', HOLDS[2]]]) { const d = Math.hypot(h.x - H.x, h.z - H.z); if (d < bd) { bd = d; b = f; } }
  return b;
}
const facHostileE = e => e.mode === 'raid' || e.angry || facHostile(e.tribe || (e.tribe = facOf(e)));
// anything Kestrel's towers, guards and turrets should shoot at
const isFoe = e => e.type === 'clan' && !e.dead && e.mode !== 'ally' && (e.mode === 'raid' || facHostileE(e));

/* ================= territory ================= */
// the three road checkpoints: on the roads out of the valley, past the rim
const CHECKS = [{ id: 'chk_w', n: 'West road checkpoint', a: Math.PI * 1.05, r: VALLEY + 110 }, { id: 'chk_e', n: 'East road checkpoint', a: -.25, r: VALLEY + 120 }, { id: 'chk_s', n: 'South road checkpoint', a: Math.PI * .52, r: VALLEY + 100 }];
const OUTPOSTS = [];
function facNearestCap(x, z, list = FAC_IDS) { let b = null, bd = 1e9; for (const f of list) { if (f === 'arc') continue; const C = FAC[f].cap(); if (!C) continue; const d = Math.hypot(x - C.x, z - C.z); if (d < bd) { bd = d; b = f; } } return b; }
function buildOutposts() {
  SCOUTS.forEach((s, i) => { const inV = Math.hypot(s.x, s.z) < VALLEY + 60; OUTPOSTS.push({ id: 'sc' + i, n: inV ? 'Valley scout camp' : 'Outland scout camp', x: s.x, z: s.z, kind: 'camp', home: inV ? 'thorn' : facNearestCap(s.x, s.z) }); });
  for (const C of CHECKS) {
    // walk outward along the angle until we're on a road, if there's one near
    let best = null; for (let k = -40; k <= 40; k += 4) { const a = C.a + k / C.r, x = Math.cos(a) * C.r, z = Math.sin(a) * C.r, d = pathDist(x, z); if (waterAt(x, z) > heightAt(x, z) - .5) continue; if (!best || d < best.d) best = { x, z, d }; }
    if (!best) continue; OUTPOSTS.push({ id: C.id, n: C.n, x: best.x, z: best.z, kind: 'check', home: facNearestCap(best.x, best.z, ['thorn', 'iron', 'pines', 'ridge', 'root']) });
  }
  const own = G.flags.out ||= {};
  for (const O of OUTPOSTS) {
    if (!own[O.id]) own[O.id] = O.home;
    const y = heightAt(O.x, O.z);
    // the banner pole (its cloth shows who holds it)
    const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(.07, .09, 5, 6), M(0x4a3a2a), 0, 2.5, 0, g);
    O.cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .8), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })); O.cloth.position.set(.66, 4.4, 0); g.add(O.cloth);
    const [bx, bz] = [O.x + 4, O.z + 3]; g.position.set(bx, heightAt(bx, bz), bz); world.add(g); O.bx = bx; O.bz = bz; g.userData.dyn = 1;
    const ph = rnd() * 6; DECOR_ANIM.push(t => { O.cloth.rotation.y = Math.sin(t * 1.7 + ph) * .35; });
    if (O.kind === 'check') {   // a barricade across the road: logs, tyres, a car body
      for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(5, 1.1, .8), new THREE.MeshLambertMaterial({ map: texWood, color: 0x6a5440 }), O.x + s * 4, y + .55, O.z, world); addCol(O.x + s * 3, O.z, .8); addCol(O.x + s * 5, O.z, .8); }
      for (let k = 0; k < 4; k++) { const t = mesh(new THREE.TorusGeometry(.4, .16, 6, 12), M(0x1a1a1a), O.x + rr(-2, 2), y + .2 + k * .3, O.z + 1.4, world); t.rotation.x = Math.PI / 2; }
      for (let k = 0; k < 2; k++) supplyCrate(O.x + rr(-4, 4), O.z + rr(2.5, 4));
    }
  }
  facPaintBanners();
}
function facPaintBanners() { const own = G.flags.out || {}; for (const O of OUTPOSTS) { const f = own[O.id]; O.cloth.material.color.set(f === 'kestrel' ? '#f0a640' : FAC[f] ? FAC[f].c : '#888'); } }
const postOwner = O => (G.flags.out || {})[O.id];
const postGuards = O => ents.filter(e => e.type === 'clan' && !e.dead && e.post === O.id);
// put the right people at an outpost (only when you're not watching)
function garrison(O, force) {
  const f = postOwner(O), there = postGuards(O), far = Math.hypot(P.x - O.x, P.z - O.z) > 180;
  if (f === 'kestrel') { if (far || force) for (const e of there) removeEnt(e); return; }
  if (!FAC[f]) return;
  const wrong = there.filter(e => facOf(e) !== f);
  if (wrong.length && (far || force)) for (const e of wrong) removeEnt(e);
  const ok = postGuards(O).filter(e => facOf(e) === f).length, want = O.kind === 'check' ? 4 : 3;
  if (ok >= want || (!far && !force)) return;
  if (G.flags.outClr && G.flags.outClr[O.id] > G.day - 2) return;   // you cleared it: it stays empty a couple of days
  const K = FAC_KINDS[FAC[f].kind];
  for (let i = ok; i < want; i++) { const e = spawnClan(K[i % K.length], O.x + rr(-6, 6), O.z + rr(-6, 6), 'guard', facFac(f)); e.tribe = f; e.post = O.id; }
}

/* ================= leaders, depots, prisoners, parley posts ================= */
const DEPOTS = [], PRISONERS = [], PARLEY = [];
function capitalSpot(f, along, side = 0) { const C = FAC[f].cap(); if (!C) return null; const a = Math.atan2(-C.z, -C.x), R = (C.R || FAC[f].cap_r * .6); return { x: C.x + Math.cos(a) * R * along - Math.sin(a) * side, z: C.z + Math.sin(a) * R * along + Math.cos(a) * side, a }; }
function buildFacSites() {
  for (const f of FAC_IDS) {
    const C = FAC[f].cap(); if (!C) continue;
    // the white flag: outside the gate, toward Kestrel
    const R = C.R || FAC[f].cap_r * .6, a = Math.atan2(-C.z, -C.x), px = C.x + Math.cos(a) * (R + 22), pz = C.z + Math.sin(a) * (R + 22);
    if (f !== 'arc') { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(.06, .08, 4, 6), M(0x6a5a48), 0, 2, 0, g); const fl = mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshLambertMaterial({ color: 0xf0ece0, side: THREE.DoubleSide }), .56, 3.5, 0, g);
      DECOR_ANIM.push(t => { fl.rotation.y = Math.sin(t * 2 + px) * .3; }); g.position.set(px, heightAt(px, pz), pz); world.add(g); addCol(px, pz, .2); PARLEY.push({ f, x: px, z: pz }); }
    if (f === 'arc') continue;
    // the supply depot: crates under a tarp, fuel drums
    const s = capitalSpot(f, -.35, R * .3); if (s) { const g = new THREE.Group(); const y = heightAt(s.x, s.z);
      for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(1.1, .8, .9), M(f === 'iron' || f === 'grey' ? 0x4f5a3a : 0x6a5038), (i % 3) * 1.15 - 1.15, .4 + Math.floor(i / 3) * .8, 0, g);
      for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(.3, .3, .9, 10), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a3a2a }), -2.4 + (i % 2) * .65, .45, 1.2 + Math.floor(i / 2) * .65, g);
      const tarp = mesh(new THREE.PlaneGeometry(4.6, 3.2), new THREE.MeshLambertMaterial({ color: f === 'grey' ? 0x5a5e62 : 0x5a6a3a, side: THREE.DoubleSide }), 0, 1.9, .3, g); tarp.rotation.x = -1.25;
      g.position.set(s.x, y, s.z); g.rotation.y = -s.a; world.add(g); g.userData.dyn = 1; addCol(s.x, s.z, 2);
      const burnt = new THREE.Group(); mesh(new THREE.CircleGeometry(3, 12), M(0x1a1612), 0, .05, 0, burnt).rotation.x = -Math.PI / 2; for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(rr(.4, 1), .2, rr(.4, 1)), M(0x1e1a16), rr(-1.5, 1.5), .1, rr(-1.5, 1.5), burnt);
      burnt.position.copy(g.position); burnt.visible = false; world.add(burnt); burnt.userData.dyn = 1;
      DEPOTS.push({ f, x: s.x, z: s.z, g, burnt }); }
  }
  // prisoners tied to posts in the hostile capitals: who they are, who holds them
  for (const [holder, who, of, name] of [['thorn', 'clan', 'root', 'a Rootkin hunter'], ['iron', 'arc', 'arc', 'a Farlight trader'], ['grey', 'arc', 'kestrel', 'an Arc kid'], ['pines', 'clan', 'ridge', 'a Ridge Runner'], ['ridge', 'clan', 'pines', 'a Hollow Pines scout'], ['iron', 'clan', 'thorn', 'a Thornkin warrior']]) {
    const s = capitalSpot(holder, -.1, (PRISONERS.filter(p => p.holder === holder).length ? -1 : 1) * 6); if (!s) continue;
    const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(.1, .12, 2.4, 6), M(0x4a3a2a), 0, 1.2, -.25, g);
    const pp = makePerson(who === 'clan' ? 'warrior' : 'arc', { fac: who === 'clan' ? 'clan' : 'arc' }); pp.g.scale.setScalar(.98); g.add(pp.g); if (pp.weapon) pp.weapon.visible = false;
    for (let k = 0; k < 3; k++) { const r = mesh(new THREE.TorusGeometry(.26, .025, 4, 12), M(0x8a7a5a), 0, .7 + k * .35, -.1, g); r.rotation.x = Math.PI / 2; }
    g.position.set(s.x, heightAt(s.x, s.z), s.z); g.rotation.y = -s.a + Math.PI; world.add(g); g.userData.dyn = 1; addCol(s.x, s.z, .4);
    PRISONERS.push({ id: `pr_${holder}_${of}`, holder, of, name, x: s.x, z: s.z, g });
  }
  facSyncSites();
}
function facSyncSites() {
  for (const D of DEPOTS) { const out = facS(D.f).depot > G.day; D.g.visible = !out; D.burnt.visible = out; }
  const fr = G.flags.freed || {};
  for (const Pr of PRISONERS) Pr.g.visible = !(fr[Pr.id] && G.day - fr[Pr.id] < 12);
}
// leaders: one at each capital, tougher, with a name
function spawnLeaders() {
  for (const f of FAC_IDS) {
    if (f === 'arc') continue; const S = facS(f); if (S.lead > G.day) continue;
    if (ents.some(e => e.leader === f && !e.dead)) continue;
    const s = capitalSpot(f, -.2, 3); if (!s) continue;
    const e = spawnClan(f === 'grey' ? 'soldier' : f === 'iron' ? 'gunner' : 'brute', s.x, s.z, 'guard', facFac(f));
    e.tribe = f; e.leader = f; e.hp = e.maxhp = e.maxhp * 3.5; e.g.scale.multiplyScalar(1.12); e.speed *= .9; e.name = FAC[f].leader[0];
  }
}

/* ================= fights between groups, patrols, allies ================= */
function nearestFoeOf(e, r) {
  let b = null, bd = r; const me = facOf(e);
  for (const o of ents) { if (o === e || o.type !== 'clan' || o.dead) continue;
    const ok = e.mode === 'ally' ? (o.mode === 'raid' || (facHostileE(o) && Math.hypot(o.x, o.z) < CAMP_R + 40)) : o.mode === 'ally' ? false : atWar(me, facOf(o)) && o.mode !== 'raid';
    if (!ok) continue; const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; b = o; } }
  return b;
}
function facFight(e, dt) {
  const p = e.p;
  if (!e.foe || e.foe.dead || !ents.includes(e.foe)) e.foe = (e.scanT = (e.scanT || 0) - dt) <= 0 ? (e.scanT = .8, nearestFoeOf(e, e.mode === 'ally' ? 90 : 70)) : null;
  const f = e.foe;
  let tx = e.x, tz = e.z, spd = 0;
  if (!f) {
    if (e.mode !== 'ally') return false;
    // allies with nobody to fight: hold the yard inside the gate
    if (!e.hold) e.hold = { x: rr(-10, 10), z: CAMP_R - rr(6, 14) };
    tx = e.hold.x; tz = e.hold.z; spd = Math.hypot(tx - e.x, tz - e.z) > 2 ? e.speed : 0;
  } else {
    const dx = f.x - e.x, dz = f.z - e.z, d = Math.hypot(dx, dz), gun = e.kind === 'gunner' || e.kind === 'soldier';
    if (gun) {
      if (d > 22) { tx = f.x; tz = f.z; spd = e.speed; } else if (d < 9) { tx = e.x - dx; tz = e.z - dz; spd = e.speed * .7; }
      if (d < 40 && e.cool <= 0) { e.cool = rr(.9, 1.6); e.yaw = Math.atan2(dx, dz);
        const from = new THREE.Vector3(e.x + Math.sin(e.yaw) * .5, e.y + 1.45, e.z + Math.cos(e.yaw) * .5), to = new THREE.Vector3(f.x + rr(-.4, .4), f.y + 1.2, f.z + rr(-.4, .4));
        tracer(from, to, 0xffd890); const pd = Math.hypot(e.x - P.x, e.z - P.z); if (pd < 160) sfx(pd < 50 ? 'turret' : 'impact', Math.max(.08, 1 - pd / 160) * .7);
        if (rnd() < .42) damage(f, e.fac === 'grey' ? rr(14, 20) : rr(10, 16), false, to); }
    } else {
      tx = f.x; tz = f.z; spd = e.speed * (d > 5 ? 1.1 : .8);
      if (d < 2.2 && e.cool <= 0) { e.cool = e.kind === 'brute' ? 1.5 : 1.1; e.yaw = Math.atan2(dx, dz); sfx('swing', Math.max(.05, 1 - Math.hypot(e.x - P.x, e.z - P.z) / 60)); damage(f, e.kind === 'brute' ? 26 : 15, false, new THREE.Vector3(f.x, f.y + 1.2, f.z)); p.body.rotation.x = .3; }
    }
  }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0; if (f && !v) e.yaw = Math.atan2(f.x - e.x, f.z - e.z);
  p.body.position.z = 0; if (p.body.rotation.x > 0) p.body.rotation.x = Math.max(0, p.body.rotation.x - dt * 2);
  e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
  return true;
}
// called at the top of updClan: true means this fighter's frame is handled here
function facUpd(e, dt) {
  if (!e.tribe) e.tribe = facOf(e);
  if (e.mode === 'raid') return false;
  // standing down: a faction that isn't hostile stops chasing you (unless you started it)
  if (e.state === 'chase' && !facHostileE(e)) { e.state = 'idle'; e.t = 5; }
  // groups at war go for each other when they meet (the player always takes priority if they shoot)
  if (e.mode === 'ally' || e.foe || (e.state === 'idle' && ((e.scan2 = (e.scan2 || rr(0, 1)) - dt) <= 0 && ((e.scan2 = rr(.8, 1.4)), true)) && nearestFoeOf(e, 40))) {
    if (e.state === 'chase' && e.mode !== 'ally') { e.foe = null; return false; }
    if (facFight(e, dt)) return true;
  }
  // patrols walk their route while nothing's going on
  if (e.route && e.state === 'idle') {
    const dp = Math.hypot(P.x - e.x, P.z - e.z), gun = e.kind === 'gunner' || e.kind === 'soldier';
    if (facHostileE(e) && !P.dead && !UG.at && dp < (gun ? 44 : 32) * stealthK() * (isNight() ? .7 : 1) * wxSight()) { e.state = 'chase'; sfx('grunt'); alertNear(e); return false; }
    const w = e.route[e.ri || 0]; if (Math.hypot(w.x - e.x, w.z - e.z) < 3) { e.ri = ((e.ri || 0) + 1) % e.route.length; }
    const v = moveEnt(e, w.x + (e.offX || 0), w.z + (e.offZ || 0), 1.9, dt), p = e.p; e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
    e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return true;
  }
  return false;
}
function facHurt(e) {
  const f = facOf(e); e.foe = null; facS(f).met = 1;
  if (!facHostile(f) && !e.angry && e.mode !== 'raid') {
    for (const o of ents) if (o.type === 'clan' && !o.dead && facOf(o) === f && Math.hypot(o.x - e.x, o.z - e.z) < 40) { o.angry = G.day + 1; o.state = 'chase'; o.foe = null; }
    facAdd(f, e.mode === 'ally' ? -15 : -10, 'you attacked them');
  }
}
function facDied(e, byPlayer) {
  const f = facOf(e), S = facS(f); S.met = 1;
  if (e.post && byPlayer && !postGuards({ id: e.post }).length) { (G.flags.outClr ||= {})[e.post] = G.day; const O = OUTPOSTS.find(o => o.id === e.post); if (O && postOwner(O) !== 'kestrel') toast(`${O.n} is clear · raise Kestrel’s banner on it`, 3.2); }
  if (!byPlayer) return;
  if (e.leader) { S.lead = G.day + 6; S.revenge = G.day + 6; facAdd(f, -25, `you killed ${e.name}`); card(`${e.name.toUpperCase()} IS DEAD`, `The ${FAC[f].n} are leaderless — and they’ll want blood`, 4.5); }
  else if (e.mode !== 'raid') facAdd(f, -4);
  // their enemies notice
  if (S.kday !== G.day) { for (const g of FAC_IDS) { const T = facS(g); if (T.kday !== G.day) { T.kday = G.day; T.kgain = 0; } } }
  for (const g of FAC_IDS) if (atWar(g, f) && g !== f) { const T = facS(g); if (T.kgain < 10) { T.kgain += 2; T.rep = clamp(T.rep + 2, FAC[g].floor ?? -100, 100); } }
  // contracts: hunting a faction's enemy
  for (const g of FAC_IDS) { const J = facS(g).job; if (J && J.t === 'hunt' && J.f === f) { J.n++; if (J.n >= J.need) toast(`Contract for the ${FAC[g].n} done · go back to them`, 3); } }
}

/* ================= encounters on the road ================= */
let facEncT = 120, facPatT = 40;
function facEncounters(dt) {
  if (UG.at || night.active || P.dead) return;
  const dK = Math.hypot(P.x, P.z); if (dK < CAMP_R + 90) return;
  // patrols: a few people walking between two of a faction's outposts near you
  facPatT -= dt;
  if (facPatT <= 0) { facPatT = rr(70, 130);
    const near = OUTPOSTS.filter(O => FAC[postOwner(O)] && Math.hypot(O.x - P.x, O.z - P.z) < 420);
    if (near.length && ents.filter(e => e.route && !e.dead).length < 8) {
      const A = pick(near), f = postOwner(A), others = OUTPOSTS.filter(O => O !== A && postOwner(O) === f && Math.hypot(O.x - A.x, O.z - A.z) < 900);
      const B = others.length ? pick(others) : { x: A.x + rr(-200, 200), z: A.z + rr(-200, 200) };
      const route = [{ x: A.x, z: A.z }, { x: (A.x + B.x) / 2 + rr(-30, 30), z: (A.z + B.z) / 2 + rr(-30, 30) }, { x: B.x, z: B.z }];
      const K = FAC_KINDS[FAC[f].kind], n = f === 'grey' ? 3 : 3 + (rnd() < .4 ? 1 : 0);
      for (let i = 0; i < n; i++) { const e = spawnClan(K[i % K.length], A.x + rr(-4, 4), A.z + rr(-4, 4), 'guard', facFac(f)); e.tribe = f; e.route = route; e.ri = 1; e.offX = rr(-2, 2); e.offZ = rr(-2, 2); e.patrol = G.t; }
    }
  }
  facEncT -= dt; if (facEncT > 0) return; facEncT = rr(240, 420);
  const fwd = { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) };
  if (rnd() < .5) {
    // a fight: two groups at war, ahead of you
    const here = facNearestCap(P.x, P.z) || 'thorn', foes = FAC_IDS.filter(g => g !== 'arc' && atWar(here, g)); if (!foes.length) return;
    const there = pick(foes), cx = P.x + fwd.x * 75 + rr(-20, 20), cz = P.z + fwd.z * 75 + rr(-20, 20);
    if (waterAt(cx, cz) > heightAt(cx, cz) - .5 || Math.hypot(cx, cz) > WORLD - 60) return;
    const A = [], B = [];
    for (const [f, L, s] of [[here, A, -1], [there, B, 1]]) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 4; i++) { const e = spawnClan(K[i % K.length], cx + s * 14 + rr(-4, 4), cz + rr(-6, 6), 'guard', facFac(f)); e.tribe = f; e.home = { x: cx + s * 30, z: cz }; e.skirm = G.t; L.push(e); } }
    A.forEach((e, i) => { e.foe = B[i % B.length]; }); B.forEach((e, i) => { e.foe = A[i % A.length]; });
    toast(`Fighting ahead — ${FAC[here].n} and ${FAC[there].n}`, 3); horn(70, 1.6, .1, 2);
  } else {
    // an ambush: a hostile group waiting off the road ahead
    if (pathDist(P.x, P.z) > 14) return;
    const hos = FAC_IDS.filter(f => f !== 'arc' && facHostile(f) && G.day >= FAC[f].since - 2); if (!hos.length) return;
    const f = facNearestCap(P.x, P.z, hos) || hos[0], K = FAC_KINDS[FAC[f].kind];
    for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, x = P.x + fwd.x * rr(45, 60) + fwd.z * sd * rr(10, 18), z = P.z + fwd.z * rr(45, 60) - fwd.x * sd * rr(10, 18);
      const e = spawnClan(K[i % K.length], x, z, 'guard', facFac(f)); e.tribe = f; e.ambush = 1; }
    G.flags.ambushWarn = (G.flags.ambushWarn || 0) + 1;
  }
}
function facCleanup() {
  // patrols, skirmishers and ambushers far from you go home for good
  for (const e of [...ents]) if (e.type === 'clan' && (e.route || e.skirm || e.ambush) && (e.dead || Math.hypot(e.x - P.x, e.z - P.z) > 380)) { if (!e.dead || e.deadT > 8) removeEnt(e); }
  for (const e of ents) if (e.angry && e.angry < G.day) e.angry = 0;
}

/* ================= raids: who comes at night ================= */
function facRaidWeights() {
  const W = {};
  for (const f of FAC_IDS) { const F = FAC[f], S = facS(f); if (!F.rw) continue; if (!(night.final || G.day >= F.since)) continue; if (!facHostile(f) && !(night.final && S.rep < 0 && !S.allied && !(S.cease > G.day))) continue;
    let w = F.rw * (S.depot > G.day ? .4 : 1) * (S.lead > G.day ? .5 : 1) * (S.revenge && S.revenge <= G.day && S.revenge > G.day - 3 ? 2.2 : 1);
    W[f] = w; }
  return W;
}
function facRaider() {
  const W = facRaidWeights(), tot = Object.values(W).reduce((a, b) => a + b, 0); if (tot <= 0) return null;
  let r = rnd() * tot, f = 'thorn'; for (const k in W) { r -= W[k]; if (r <= 0) { f = k; break; } }
  if (f === 'grey') return ['soldier', 'grey', f];
  if (f === 'iron') return [rnd() < .2 ? 'brute' : 'gunner', 'iron', f];
  const k = night.wave >= 3 && rnd() < .17 ? 'brute' : night.wave >= 2 && rnd() < .4 ? 'thrower' : 'warrior';
  return [k, 'clan', f];
}
const facAnyRaider = () => Object.values(facRaidWeights()).some(w => w > 0);
function facRaidScale() {
  const W = facRaidWeights(); if (!Object.values(W).some(w => w > 0)) return 0; const base = FAC_IDS.reduce((a, f) => a + (FAC[f].rw && (night.final || G.day >= FAC[f].since) ? FAC[f].rw : 0), 0) || 1, now = Object.values(W).reduce((a, b) => a + b, 0);
  const held = OUTPOSTS.filter(O => postOwner(O) === 'kestrel').length;
  return clamp(now / base, .25, 1.4) * Math.max(.6, 1 - held * .05);
}
// allies send fighters when the horn goes
function facNight() {
  const al = FAC_IDS.filter(f => facAllied(f) && f !== 'arc'); let n = 0;
  for (const f of al) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 4; i++) { const e = spawnClan(K[i % K.length], rr(-6, 6), CAMP_R - rr(4, 10), 'ally', facFac(f)); e.tribe = f; e.state = 'ally'; n++; } }
  if (facAllied('arc')) for (let i = 0; i < 3; i++) { const e = spawnClan('gunner', rr(-6, 6), CAMP_R - rr(4, 10), 'ally', 'arc'); e.tribe = 'arc'; e.state = 'ally'; n++; }
  if (n) setTimeout(() => toast(`${al.map(f => FAC[f].n).join(' and ')} fighters are on the wall with you`, 3.4), 2500);
  if (!facAnyRaider()) setTimeout(() => say([['Kade', 'Quiet out there. Nobody who hates us is in a fighting mood tonight. Stay sharp anyway.']]), 3000);
}

/* ================= the daily turn ================= */
let facLastDay = -1;
function facDay() {
  facLastDay = G.day;
  for (const e of [...ents]) if (e.mode === 'ally') removeEnt(e);
  const own = G.flags.out ||= {}, news = [];
  // pushing on each other's outposts
  for (const O of OUTPOSTS) {
    const cur = own[O.id], far = Math.hypot(P.x - O.x, P.z - O.z) > 220; if (!far) continue;
    const near = facNearestCap(O.x, O.z), rivals = FAC_IDS.filter(g => g !== 'arc' && g !== cur && (cur === 'kestrel' ? facHostile(g) : atWar(g, cur)) && Math.hypot(FAC[g].cap().x - O.x, FAC[g].cap().z - O.z) < 1100);
    if (!rivals.length) continue;
    const g = rivals.includes(near) ? near : pick(rivals), S = facS(g);
    const chance = (cur === 'kestrel' ? .07 : .06) * (S.depot > G.day ? .3 : 1) * (S.lead > G.day ? .4 : 1) * (cur && FAC[cur] && facS(cur).depot > G.day ? 2 : 1);
    if (rnd() < chance) { own[O.id] = g; news.push(cur === 'kestrel' ? `The ${FAC[g].n} took Kestrel’s ${O.n.toLowerCase()}` : `${FAC[g].n} took a ${O.n.toLowerCase()} from ${FAC[cur] ? 'the ' + FAC[cur].n : 'nobody'}`); }
  }
  for (const O of OUTPOSTS) garrison(O);
  facPaintBanners();
  // Kestrel's outposts send supplies home
  const held = OUTPOSTS.filter(O => own[O.id] === 'kestrel').length;
  if (held) { const sc = held * 6, m = held * 2; INV.scrap += sc; INV.meat = (INV.meat || 0) + m; news.push(`Kestrel’s ${held} outpost${held > 1 ? 's' : ''} sent home ${sc} scrap and ${m} meat`); }
  // contracts, leaders, depots
  for (const f of FAC_IDS) { const S = facS(f); if (!S.job && !facHostile(f) || (!S.job && f !== 'grey' && S.rep > -40)) S.job = facNewJob(f); if (S.cease && S.cease === G.day) news.push(`The ceasefire with the ${FAC[f].n} is over`); }
  spawnLeaders(); facSyncSites(); facRegions();
  if (news.length && (cnt('radio') > 0 || news.some(n => n.includes('Kestrel’s')))) setTimeout(() => { for (const [i, n] of news.slice(0, 3).entries()) setTimeout(() => toast(n, 3.4), i * 3600); }, 4200);
  save();
}
function facNewJob(f) {
  const foes = FAC_IDS.filter(g => g !== 'arc' && atWar(f, g)), t = rnd();
  const held = PRISONERS.find(p => p.of === f && !((G.flags.freed || {})[p.id] && G.day - G.flags.freed[p.id] < 12));
  if (held && t < .3) return { t: 'free', id: held.id, txt: `Free ${held.name} from the ${FAC[held.holder].n}` };
  if (foes.length && t < .6) { const g = pick(foes); return { t: 'hunt', f: g, n: 0, need: 5, txt: `Kill 5 ${FAC[g].n}` }; }
  if (foes.length && t < .75) { const g = pick(foes.filter(x => DEPOTS.some(D => D.f === x)) || foes); if (g) return { t: 'depot', f: g, txt: `Burn the ${FAC[g].n} supply depot` }; }
  const id = pick(FAC[f].want), need = ITEMS[id] && ITEMS[id].w > .5 ? 3 : 5; return { t: 'bring', id, need, txt: `Bring ${need} × ${nameOf(id).toLowerCase()}` };
}
const jobDone = J => J && (J.t === 'hunt' ? J.n >= J.need : J.t === 'free' ? !!(G.flags.freed || {})[J.id] : J.t === 'depot' ? facS(J.f).depot > G.day : J.t === 'bring' ? cnt(J.id) >= J.need : false);
function facRegions() {
  const map = { thorn: ['ashmere', 'outpost'], pines: ['varnhold'], ridge: ['sunscar'], root: ['elderhollow'], iron: ['foundry', 'ironyard_s', 'ironyard_e', 'x_hesper'], grey: ['greystation'], arc: ['farlight'] };
  for (const f in map) for (const id of map[f]) { const R = REGIONS.find(r => r.id === id); if (!R) continue; const h = facHostile(f); R.hostile = h; R.friend = !h && facRep(f) >= 20; }
}

/* ================= talking: parley posts, leaders, the radio ================= */
let facCtx = null;   // { f (or null for the radio), x, z } — where you're talking from
const facCtxOK = () => facCtx && Math.hypot(P.x - facCtx.x, P.z - facCtx.z) < 7;
function openFactions(f, x, z, radio) { facCtx = { f, x, z, radio }; if (f) facS(f).met = 1; invTab = 'factions'; toggleInv(true); }
const nearLeader = () => { for (const e of ents) if (e.leader && !e.dead && !facHostileE(e) && Math.hypot(e.x - P.x, e.z - P.z) < 3.4) return e; return null; };
const nearDepot = () => { for (const D of DEPOTS) if (D.g.visible && Math.hypot(D.x - P.x, D.z - P.z) < 3.4) return D; return null; };
const nearPrisoner = () => { for (const Pr of PRISONERS) if (Pr.g.visible && Math.hypot(Pr.x - P.x, Pr.z - P.z) < 2.6) return Pr; return null; };
const nearParley = () => { for (const Q of PARLEY) if (Math.hypot(Q.x - P.x, Q.z - P.z) < 3) return Q; return null; };
const nearBanner = () => { for (const O of OUTPOSTS) if (Math.hypot(O.bx - P.x, O.bz - P.z) < 3.2) return O; return null; };
const SAB = ['molotov', 'frag', 'fuel', 'gas_tank'];
function freePrisoner(Pr, paid) {
  (G.flags.freed ||= {})[Pr.id] = G.day; Pr.g.visible = false; sfx('pickup');
  if (Pr.of === 'kestrel' || Pr.of === 'arc') G.flags.rescued = (G.flags.rescued || 0) + 1;
  if (FAC[Pr.of]) facAdd(Pr.of, 15, `you freed ${Pr.name}`);
  if (!paid) facAdd(Pr.holder, -5);
  toast(`${Pr.name[0].toUpperCase() + Pr.name.slice(1)} is free${Pr.of === 'kestrel' || Pr.of === 'arc' ? ' — they’ll make their own way to Kestrel' : ''}`, 3.4); save();
}
const FINTERACT = [
  { id: 'parley', at: () => nearParley(), r: 3, label: () => { const Q = nearParley(); return facRep(Q.f) <= -85 ? `${FAC[Q.f].n} · they won’t talk to you` : `White flag · parley with the ${FAC[Q.f].n}`; }, act: () => { const Q = nearParley(); if (facRep(Q.f) <= -85) { sfx('no'); return; } openFactions(Q.f, Q.x, Q.z); } },
  { id: 'leader', at: () => nearLeader(), r: 3.4, label: () => { const e = nearLeader(); return `Talk to ${e.name}, ${FAC[e.leader].leader[1]} of the ${FAC[e.leader].n}`; }, act: () => { const e = nearLeader(); openFactions(e.leader, e.x, e.z); } },
  { id: 'depot', at: () => nearDepot(), r: 3.4, label: () => { const D = nearDepot(), it = SAB.find(k => cnt(k) > 0); return it ? `Burn the ${FAC[D.f].n} supply depot (uses ${nameOf(it).toLowerCase()})` : `${FAC[D.f].n} supply depot · you need fuel, a molotov or a grenade to burn it`; },
    act: () => { const D = nearDepot(), it = SAB.find(k => cnt(k) > 0); if (!it) { sfx('no'); return; } startChan({ l: 'Setting the fire', t: 3, fn: () => {
      take(it, 1); const S = facS(D.f); S.depot = G.day + 10; const got = rollLoot(FAC[D.f].kind === 'clan' ? 'clan' : FAC[D.f].kind === 'grey' ? 'mil' : 'city', 1);
      sfx('boom'); puff(D.x, heightAt(D.x, D.z) + 1, D.z, 0xff7a2a, 26, 7, .3, 1.4, -2); SMOKES.push({ x: D.x, z: D.z, y: heightAt(D.x, D.z) + 1, k: rnd() });
      facSyncSites(); facAdd(D.f, -12, 'you burned their depot'); for (const e of ents) if (e.type === 'clan' && !e.dead && facOf(e) === D.f && Math.hypot(e.x - D.x, e.z - D.z) < 70) { e.angry = G.day + 1; e.state = 'chase'; }
      card('DEPOT BURNED', `The ${FAC[D.f].n} will raid weaker for ten days`, 3.4); if (got.length) setTimeout(() => toast('Grabbed: ' + got.slice(0, 5).join(' · '), 3), 1500);
      for (const g of FAC_IDS) { const J = facS(g).job; if (J && J.t === 'depot' && J.f === D.f) toast(`Contract for the ${FAC[g].n} done · go back to them`, 3); } save(); } }); } },
  { id: 'prisoner', at: () => nearPrisoner(), r: 2.6, label: () => `Cut the ropes · free ${nearPrisoner().name}`, act: () => { const Pr = nearPrisoner(); startChan({ l: 'Cutting the ropes', t: 1.8, fn: () => freePrisoner(Pr) }); } },
  { id: 'banner', at: () => nearBanner(), r: 3.2, label: () => { const O = nearBanner(), f = postOwner(O); if (f === 'kestrel') return `${O.n} · Kestrel’s`; return postGuards(O).length ? `${O.n} · held by the ${FAC[f] ? FAC[f].n : '—'}` : `Raise Kestrel’s banner over the ${O.n.toLowerCase()}`; },
    act: () => { const O = nearBanner(), f = postOwner(O); if (f === 'kestrel' || postGuards(O).length) return; startChan({ l: 'Raising the banner', t: 2.2, fn: () => { (G.flags.out ||= {})[O.id] = 'kestrel'; facPaintBanners(); if (FAC[f]) facAdd(f, -6, 'you took their outpost'); card('OUTPOST TAKEN', `${O.n} flies Kestrel’s colours · it sends supplies home every morning`, 3.6); save(); } }); } },
];
// the radio desk in the Arc: diplomacy by radio
function facRadio() { openFactions(null, ARC_RADIO.x, ARC_RADIO.z, true); }

/* the Factions tab */
function factionsHTML() {
  const ctx = facCtxOK() ? facCtx : null, here = ctx && ctx.f;
  let h = `<p class="dim">${ctx ? (ctx.radio ? 'On the radio — gifts, ceasefires and alliances by radio; trade and deliveries need you there in person.' : `Talking with the ${FAC[here].n}.`) : 'What every group out there thinks of Kestrel. To talk: the white flag outside their camp, their leader in person, or the radio desk in the Arc.'}</p><div class="jn">`;
  const order = here ? [here, ...FAC_IDS.filter(f => f !== here)] : FAC_IDS;
  for (const f of order) {
    const F = FAC[f], S = facS(f), met = S.met || here === f || (G.flags.seen || {})[{ thorn: 'ashmere', pines: 'varnhold', ridge: 'sunscar', root: 'elderhollow', iron: 'foundry', grey: 'greystation', arc: 'farlight' }[f]];
    if (!met) { h += `<p class="pl" style="opacity:.5"><b>???</b> · a faction you haven’t met</p>`; continue; }
    const st = facStanding(f), w = (S.rep + 100) / 2, posts = OUTPOSTS.filter(O => postOwner(O) === f).length;
    const lead = S.lead > G.day ? `leader dead (${S.lead - G.day}d)` : `${F.leader[0]}, ${F.leader[1]}`, tags = [S.cease > G.day && `ceasefire ${S.cease - G.day}d`, S.depot > G.day && `depot burned ${S.depot - G.day}d`, posts && `${posts} outpost${posts > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    h += `<div style="border:1px solid #fff2;border-left:4px solid ${F.c};padding:8px 10px;border-radius:3px;background:#0002"><b>${F.n}</b> · <span style="color:${facHostile(f) ? '#e0573d' : S.rep >= 20 ? '#7fc4b8' : '#efe9dc'}">${st}</span> <small style="opacity:.6">${Math.round(S.rep)}</small>
      <div class="bar" style="height:5px;margin:4px 0;background:#0005"><i style="display:block;height:100%;width:${w}%;background:${F.c}"></i></div><small style="opacity:.75">${lead}${tags ? ' · ' + tags : ''}</small>`;
    if (S.job && !(f === 'grey' && S.rep < -40)) h += `<div style="margin-top:4px"><small>Contract: ${S.job.txt}${S.job.t === 'hunt' ? ` (${S.job.n}/${S.job.need})` : S.job.t === 'bring' ? ` (${Math.min(cnt(S.job.id), S.job.need)}/${S.job.need})` : ''}${jobDone(S.job) ? ' · <b style="color:#7fc4b8">ready</b>' : ''} · reward: standing, 40 scrap</small></div>`;
    const can = ctx && (ctx.radio || here === f), inPerson = ctx && here === f, B = [];
    if (can && f !== 'grey' || can && S.rep > -60) {
      B.push(`<button data-fa="gift" data-f="${f}"${INV.scrap >= 25 && S.gift !== G.day ? '' : ' class="dis"'}>Gift 25 scrap</button>`);
      if (facHostile(f) && !(S.cease > G.day)) B.push(`<button data-fa="cease" data-f="${f}"${INV.scrap >= 60 && S.rep >= -60 ? '' : ' class="dis"'}>Ceasefire, 7 days · 60 scrap${S.rep < -60 ? ' (they won’t yet)' : ''}</button>`);
      if (!S.allied && S.rep >= 75) B.push(`<button data-fa="ally" data-f="${f}"${S.done >= 1 ? '' : ' class="dis"'}>Propose an alliance${S.done >= 1 ? '' : ' (finish a contract first)'}</button>`);
      if (S.job && jobDone(S.job) && (S.job.t !== 'bring' || inPerson)) B.push(`<button data-fa="job" data-f="${f}">Hand in the contract</button>`);
      const held = PRISONERS.filter(p => p.holder === f && p.g.visible);
      if (held.length && S.rep >= -40) B.push(`<button data-fa="ransom" data-f="${f}"${INV.scrap >= 80 ? '' : ' class="dis"'}>Trade for their prisoners · 80 scrap</button>`);
    }
    if (B.length) h += `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${B.join('')}</div>`;
    if (inPerson && !facHostile(f) && S.rep >= 20 || inPerson && S.allied) {
      const stock = facStock(f), mk = S.allied ? .75 : S.rep >= 60 ? .9 : 1.1;
      h += `<div class="row" style="margin-top:6px">${stock.map(([id, n], i) => { const pr = Math.ceil(valueOf(id) * n * mk), left = !(S.buy || {})[G.day + ':' + i]; return itemTile(id, n, `<button data-fa="buy" data-f="${f}" data-i="${i}"${left && INV.scrap >= pr ? '' : ' class="dis"'}>${left ? pr + ' scrap' : 'sold'}</button>`); }).join('')}</div>`;
    } else if (inPerson) h += `<small style="opacity:.6">They’ll trade once they’re Friendly.</small>`;
    h += '</div>';
  }
  return h + `<p class="pl">Outposts: ${OUTPOSTS.filter(O => postOwner(O) === 'kestrel').length} of ${OUTPOSTS.length} fly Kestrel’s colours.</p></div>`;
}
function facStock(f) {
  const T = FAC[f].kind === 'clan' ? 'clan' : FAC[f].kind === 'grey' ? 'mil' : FAC[f].kind === 'arc' ? 'arc' : 'city';
  const keys = Object.keys(LOOT[T]).filter(k => ITEMS[k] && ITEMS[k].c !== 'story'), gear = (GEAR_LOOT[T] || [0, []])[1];
  let s = G.day * 131 + f.length * 17; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = []; for (let i = 0; i < 4; i++) { const id = keys[Math.floor(r() * keys.length)], [, a = 1, b = a] = LOOT[T][id]; out.push([id, Math.max(1, Math.round((a + b) / 2))]); }
  if (gear.length && facRep(f) >= 40) out.push([gear[Math.floor(r() * gear.length)], 1]);
  return out;
}
function facAction(d) {
  const f = d.f, S = facS(f), F = FAC[f];
  if (d.fa === 'gift') { if (INV.scrap < 25 || S.gift === G.day) return; INV.scrap -= 25; S.gift = G.day; facAdd(f, 6, 'a gift'); sfx('buy'); }
  else if (d.fa === 'cease') { if (INV.scrap < 60 || S.rep < -60) { sfx('no'); return; } INV.scrap -= 60; S.cease = G.day + 7; facAdd(f, 8, 'ceasefire agreed'); card('CEASEFIRE', `The ${F.n} will hold off for seven days`, 3.4); for (const e of ents) if (facOf(e) === f && e.state === 'chase') { e.state = 'idle'; e.angry = 0; } }
  else if (d.fa === 'ally') { if (S.rep < 75 || S.done < 1) return; S.allied = 1; card('ALLIANCE', `The ${F.n} stand with Kestrel · their fighters will come when the horn goes`, 4); sfx('buy'); facRegions(); save(); }
  else if (d.fa === 'job') { const J = S.job; if (!jobDone(J)) return; if (J.t === 'bring') take(J.id, J.need); S.job = null; S.done++; INV.scrap += 40; const got = rollLoot(F.kind === 'clan' ? 'clan' : F.kind === 'grey' ? 'mil' : F.kind === 'arc' ? 'arc' : 'city', 1); facAdd(f, 20, 'contract done'); toast(['+40 scrap', ...got].slice(0, 5).join(' · '), 3); }
  else if (d.fa === 'ransom') { if (INV.scrap < 80) return; INV.scrap -= 80; for (const Pr of PRISONERS.filter(p => p.holder === f && p.g.visible)) freePrisoner(Pr, true); facAdd(f, 3); }
  else if (d.fa === 'buy') { const stock = facStock(f), [id, n] = stock[+d.i], mk = S.allied ? .75 : S.rep >= 60 ? .9 : 1.1, pr = Math.ceil(valueOf(id) * n * mk), k = G.day + ':' + d.i; if ((S.buy ||= {})[k] || INV.scrap < pr) { sfx('no'); return; } INV.scrap -= pr; S.buy[k] = 1; give(id, n); sfx('buy'); toast(`+${n} ${nameOf(id).toLowerCase()}`, 1.8); }
  save();
}

/* ================= setup and each frame ================= */
function buildFactions() {
  const s0 = seed; seed = 4040404;
  for (const f of FAC_IDS) facS(f);
  buildOutposts(); buildFacSites();
  // the scout groups placed at boot belong to their outposts now
  for (const e of ents) if (e.type === 'clan' && e.mode === 'guard' && !e.post) { const O = OUTPOSTS.find(o => Math.hypot(o.x - e.home.x, o.z - e.home.z) < 12); if (O) { const own = postOwner(O); e.post = O.id; e.tribe = FAC[own] && facFac(own) === e.fac ? own : facOf(e); } }
  for (const O of OUTPOSTS) garrison(O, true);
  spawnLeaders(); facRegions(); facLastDay = G.day;
  window.__F = { FAC, OUTPOSTS, DEPOTS, PRISONERS, PARLEY, facS, facAdd, facHostile, facDay, facRaider, openFactions, facAction, nearestFoeOf, facEncounters, garrison, get facEncT() { return facEncT; }, set facEncT(v) { facEncT = v; } };
  seed = s0;
}
function facRestore() {
  for (const f of FAC_IDS) facS(f);
  const own = G.flags.out ||= {}; for (const O of OUTPOSTS) if (!own[O.id]) own[O.id] = O.home;
  facPaintBanners(); for (const O of OUTPOSTS) garrison(O, true); facSyncSites(); spawnLeaders(); facRegions(); facLastDay = G.day;
}
let facT = 0;
function updFactions(dt) {
  if (G.day !== facLastDay && facLastDay >= 0) facDay();
  facEncounters(dt);
  facT -= dt; if (facT <= 0) { facT = 3; facCleanup(); }
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
/* (Nov 10) the warning before night 100 comes over the walkie-talkies: the other settlements call Kestrel as the clans gather.
   Carry a radio (a walkie-talkie from the rack in the Arc's radio room, or one you find) and you hear each call at dawn;
   without one the calls wait on the radio desk in the Arc. */
const RADIO_CALLS = [
  [70, 'Farlight', 'Kestrel, this is Farlight. The clans have stopped raiding each other. That never happens. They’re saving it for someone — and I think it’s you.'],
  [85, 'Farlight', 'Kestrel, Farlight again. Ironjaw is buying up every round in the valley, and there are Greyhold trucks on the north road. Count the nights.'],
  [92, 'Halvard', 'Anyone on this channel — it’s the scavvers at Halvard. War paint at Varnhold and Sunscar both. Eight nights, they’re saying. Eight.'],
  [97, 'Farlight', 'Three nights, Kestrel. They’re camped along the rim. Bring everyone inside the wall and get the turrets fed.'],
  [99, 'Farlight', 'Tomorrow night. Every clan, Ironjaw, Greyhold — all of them at once. Good luck, Kestrel. Farlight out.'],
];
const radioDue = () => { const h = G.flags.radio || {}; return RADIO_CALLS.filter(c => G.day >= c[0] && !h[c[0]]); };
function radioPlay(due) { const h = G.flags.radio = G.flags.radio || {}; for (const c of due) h[c[0]] = 1; const c = due[due.length - 1]; G.flags.radioNag = 0; say([['Radio', `${c[1]}: ${c[2]}`]]); }
function radioDay() {
  if (G.flags.held100) return; const due = radioDue(); if (!due.length) return;
  if (cnt('radio') > 0) { toast('Your walkie-talkie crackles', 2.4); radioPlay(due); }
  else if (!G.flags.radioNag) { G.flags.radioNag = 1; toast('Someone is calling Kestrel — the radio desk in the Arc', 4); }
}
function radioListen() {
  const due = radioDue(); if (due.length) { radioPlay(due); return; }
  const last = [...RADIO_CALLS].reverse().find(c => G.day >= c[0]);
  say([['Radio', last ? `${last[1]}, repeating: ${last[2]}` : pick(['Static. Under it, someone reading out numbers.', 'Farlight on the hour: prices for salt and rounds. Nothing for Kestrel.', 'Static, and a few bars of a song from somewhere far off.'])]]);
}
function takeWalkie() { G.flags.walkies = (G.flags.walkies || 0) + 1; newGear('radio', 1); sfx('pickup'); toast('Took a walkie-talkie · you’ll hear the other settlements on it', 3.2); setTimeout(radioDay, 1200); }
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

/* ================= open world: no chapters — goals follow what you've unlocked ================= */
function openGoal() {
  const t = tierNow();
  if (!G.flags.reached) return { text: 'Search the wreck, then follow the old road north-east to Kestrel — or dig in and build here', at: { x: 0, z: 70 } };
  if (!INV.tools.some(g => GEAR_DEFS[g.id].kind === 'axe')) return { text: 'Make a stone axe: sticks, stones and fiber from outside the wall (I → Craft)', at: null };
  if (t < 2) return { text: 'Tier 2: take a clan insignia — Thorn Outpost, Ashmere, or a clan hold', at: POI.village };
  if (t < 3) return { text: 'Tier 3: the lander Tern’s locker at the Burn holds an Arc ID chip', at: POI.burn };
  if (t < 4) return { text: 'Tier 4: raid Greyhold Station (or the Foundry workshop) for an access card', at: BASES.find(B => B.id === 'greystation') };
  if (t < 5) return { text: 'Open the Grey Door with the access card', at: POI.vaultFront || POI.vault };
  if (t < 6) return { text: 'Crack the Foundry strongroom in Cinder City (electronic lock bypass)', at: FOUNDRY };
  return { text: `Hold Kestrel to night 100 · night ${G.day}`, at: null };
}
const STEPS = { 13: { text: () => openGoal().text, at: () => openGoal().at } };
function nearestScrap(tag) { let b = null, bd = 1e9; for (const s of SCRAPS) if (s.alive && (!tag || s.tag === tag)) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; b = s; } } return b; }
function nearestAnimal(type) { let b = null, bd = 1e9; for (const e of ents) if (e.type === type && !e.dead) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } } return b; }
function setStep(n) { G.step = n; save(); }
function objText() { const st = STEPS[G.step] || STEPS[13]; return typeof st.text === 'function' ? st.text() : st.text; }
function face(e, x, z) { if (e) e.yaw = Math.atan2(x - e.x, z - e.z); }
function talk(who) {
  if (who === 'kade') { say([['Kade', pick(['Bring me scrap and I’ll make the wall taller. The bench and the forge are yours too.', 'If the wall goes, get in the Arc and seal the doors. The catwalk slit covers the whole yard.', 'The clans mark everything they own. Take one of those marks and we can learn how they work leather and bone.', 'There’s a whole dead city to the south-east. Scavengers live in the middle of it, and they don’t share.', 'Night 100. Everyone on the radio says the same number. Be ready.'])]]); openShop(); return true; }
  if (who === 'juno') { if (P.hp < 100 || P.bleed > 0 || P.frac > 0 || P.sick > 0 || P.dose > 0) { P.hp = 100; clearInjuries(); say([['Juno', 'Hold still. There — patched.']]); sfx('pickup'); } else say([['Juno', pick(["You're in one piece. Keep it that way.", 'Farlight trades medicine. West, past the rim.', 'Boil your water. I’m tired of treating fevers.'])]]); return true; }
  return false;
}
function restBunk() { if (night.active) { sfx('no'); toast('No sleeping through a raid'); return; } P.hp = 100; P.food = Math.max(0, P.food - 8); sfx('pickup'); toast('You rest up · health full', 2.4); save(); }
// what each keeper does besides trading (Q / hold on the trade prompt)
const KEEPER_Q = {
  kade: { l: () => 'upgrades', act: () => talk('kade') },
  juno: { l: () => P.hp < 100 || P.bleed > 0 || P.frac > 0 || P.sick > 0 || P.dose > 0 ? 'patch up' : 'talk', act: () => talk('juno') },
  rook: { l: () => 'draw rifle ammo', act: () => { if (G.flags.armoryDay === G.day) { sfx('no'); toast('Already drew today’s ammo — come back tomorrow'); return; } G.flags.armoryDay = G.day; INV.res = Math.max(INV.res, RES_MAX); INV.resH = Math.max(INV.resH, RESH_MAX); sfx('reload'); toast('Ammo restocked (once a day)'); } },
};

/* ================= interactables ================= */
const GATE_SPOT = { x: 0, z: CAMP_R };
const INTERACT = [
  ...SHOP_DEFS.map(D => ({ id: 'st_' + D.id, at: () => D.spot, r: 2.6, label: () => D.id === 'bunk' && P.hp >= 100 ? null : D.stN, act: () => D.id === 'bunk' ? restBunk() : openCraft(D.cat) })),
  { id: 'forge', at: () => SHOP.craft.forge, r: 2.4, label: () => 'Forge · smelt + metalwork', act: () => openCraft('mat') },
  { id: 'fire', at: () => SPOTS.fire, r: 3.4, label: () => 'Cook at the fire', act: () => openCraft('food') },
  { id: 'smoke', at: () => SPOTS.smoke, r: 3.2, label: () => 'Drying rack · dry meat', act: () => openCraft('food') },
  { id: 'hulldoor', at: () => inHull(P.x, P.z) ? ARC_DOOR_IN : ARC_DOOR_OUT, r: 4.2, label: () => hullDoor.hp <= 0 ? (night.active ? 'The Arc’s doors are wrecked' : null) : hullDoor.open ? 'Seal the Arc’s blast doors' : 'Open the Arc’s blast doors', act: () => { if (hullDoor.hp <= 0) return; hullDoor.open = !hullDoor.open; sfx('gate'); toast(hullDoor.open ? 'Blast doors open' : `Blast doors sealed · ${Math.round(hullDoor.hp)} / ${hullDoor.max}`, 2); } },
  // (Nov 10, Bryce) the settlement gate opens and shuts by hand, from either side
  { id: 'gate', at: () => GATE_SPOT, r: 6.5, label: () => gate.hp <= 0 ? null : gate.open ? 'Close the gate' : 'Open the gate', act: () => { if (gate.hp <= 0) return; gate.open = !gate.open; sfx('gate'); toast(gate.open ? 'Gate open' : 'Gate shut', 1.8); } },
  { id: 'fogheal', at: () => nearDowned(), r: 2.6, label: () => { const e = nearDowned(), id = FOG_MEDS.find(k => cnt(k) > 0); return `${e.shopName || 'Settler'} is down — ` + (id ? `treat them (${nameOf(id).toLowerCase()})` : 'you need a bandage or a medkit'); }, act: () => healDowned(nearDowned()) },
  { id: 'radiodesk', at: () => arcInside ? ARC_RADIO : null, r: 2.7, label: () => (radioDue().length ? 'Answer the radio · someone is calling Kestrel' : 'Listen to the radio') + `  ·  ${isTouch ? 'hold' : 'Q'}: talk to the factions`, act: () => radioListen(), next: () => facRadio() },
  { id: 'walkies', at: () => arcInside ? ARC_WALKIES : null, r: 2.3, label: () => cnt('radio') > 0 || (G.flags.walkies || 0) >= 4 ? null : 'Take a walkie-talkie', act: () => takeWalkie() },
  { id: 'crate', at: () => nearCrate(), r: 2.6, label: () => 'Search the crate', act: () => openCrate(nearCrate()) },
  { id: 'cache', at: () => nearCache(), r: 2.8, label: () => cacheAction(nearCache()).l, act: () => cacheAction(nearCache()).act() },
  { id: 'trader', at: () => nearShopNPC(), r: 4.4, label: () => { const e = nearShopNPC(), x = KEEPER_Q[e.name]; return `Trade with ${e.shopName}` + (x ? `  ·  ${isTouch ? 'hold' : 'Q'}: ${x.l()}` : ''); }, act: () => openTrade(nearShopNPC()), next: () => { const x = KEEPER_Q[nearShopNPC()?.name]; if (x) x.act(); } },
  { id: 'fstation', at: () => nearFStation(), r: 3, label: () => 'Farlight ' + STATION_N[nearFStation().st[0]].toLowerCase() + ' · craft', act: () => openCraft(nearFStation().st.includes('lab') ? 'med' : nearFStation().st.includes('forge') ? 'mat' : 'tool') },
  { id: 'bag', at: () => nearBag(), r: 2.6, label: () => 'Pick up your dropped bag', act: () => pickBag() },
  ...XINTERACT, ...FINTERACT,   // (Nov 11) notes, recordings, hatches, doors, generators (2f-explore.js)
  { id: 'city', at: () => cityNear(), r: 3.2, label: () => cityNear()?._l, act: () => cityNear()?.act() },   // (Nov 11) Cinder City's insides: 1j-city-interiors.js
  { id: 'climb', at: () => POI.lookout, r: 3.6, label: () => P.y < POI.lookoutTop - 3 ? 'Climb the lookout' : 'Climb down', act: () => climbLookout() },
];
const nearFStation = () => { for (const S of FACTION_ST) if (Math.hypot(S.x - P.x, S.z - P.z) < 3) return S; return null; };
let curInter = null;
function findInteract() {
  if (P.dead || cine || shopOpen) return null;
  if (chan) return wildInteract();
  let best = null, bd = 1e9;
  for (const it of INTERACT) {
    const at = it.at(); if (!at) continue;
    const d = Math.hypot(at.x - P.x, at.z - P.z); if (d > it.r || d > bd) continue;
    const l = it.label(); if (!l) continue;
    best = { it, l, next: it.next, multi: !!it.next && / {2}· {2}(Q|hold): /.test(l) }; bd = d;
  }
  const pl = nearPlaced(); if (pl) { const d = Math.hypot(pl.x - P.x, pl.z - P.z) - 1; if (d < bd) { const a = placedAction(pl); bd = d; best = { it: { act: a.act }, l: a.l + `  ·  ${isTouch ? 'hold' : 'Q'}: dismantle`, next: () => unplace(pl, true), multi: true }; } }
  for (const e of ents) if (e.type !== 'clan' && e.type !== 'npc' && e.dead && !e.butchered) {
    const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < 2.8 && d < bd) { bd = d; best = { it: { act: () => butcher(e) }, l: `Butcher the ${e.sp ? e.sp.n.toLowerCase() : e.type}` }; }
  }
  if (!best && Math.hypot(P.x, P.z) > CAMP_R - 4) { const w = wildInteract(); if (w) best = { it: { act: w.act }, l: w.l, prog: w.prog, next: w.next, multi: w.multi }; }
  return best;
}
// (Nov 10, Bryce) no bag button: E (phone: USE) does what's in front of you, and with nothing there it opens the bag; again closes it
function useInteract() { if (invOpen) { toggleInv(false); return; } if (curInter) curInter.it.act(); else toggleInv(true); }

function butcher(e) {
  e.butchered = true; sfx('pickup'); puff(e.x, e.y + .5, e.z, 0x7a2a1a, 5, 1.5, .1, .5);
  const { L, kn } = butcherYield(e); const got = L.filter(([, n]) => n > 0); for (const [id, n] of got) give(id, n);
  toast(got.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · ') + (kn ? '' : ' · a knife would get hide + sinew'), 2.8);
  e.deadT = Math.max(e.deadT, 20);
}
const RATION = () => [[40, 10], [55, 20], [70, 30]][UP.smoke];
function eat() { save(); }

/* ================= dying: your bag stays where you fell ================= */
function dropBag() {
  const items = { ...INV.items }; for (const id of ['scrap', 'meat', 'ration']) if (cnt(id)) items[id] = cnt(id);
  const gear = INV.tools.filter(t => !busy(t));
  if (!Object.keys(items).length && !gear.length) return;
  G.flags.bag = { x: P.x, z: P.z, items, gear };
  INV.items = {}; INV.scrap = 0; INV.meat = 0; INV.rations = 0; INV.tools = INV.tools.filter(t => busy(t));
  showBag();
}
let bagMesh = null;
function showBag() {
  if (bagMesh) { world.remove(bagMesh); bagMesh = null; }
  const B = G.flags.bag; if (!B) return;
  bagMesh = new THREE.Group(); mesh(new THREE.SphereGeometry(.4, 8, 6), M(0x6a5a3a), 0, .3, 0, bagMesh).scale.y = .7;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 30, 6), new THREE.MeshBasicMaterial({ color: 0xf0a640, transparent: true, opacity: .35, toneMapped: false, depthWrite: false })); beam.position.y = 15; bagMesh.add(beam);
  bagMesh.position.set(B.x, heightAt(B.x, B.z), B.z); world.add(bagMesh);
}
const nearBag = () => G.flags.bag && Math.hypot(G.flags.bag.x - P.x, G.flags.bag.z - P.z) < 2.6 ? G.flags.bag : null;
function pickBag() {
  const B = G.flags.bag; if (!B) return;
  for (const [id, n] of Object.entries(B.items)) give(id, n); for (const g of B.gear) INV.tools.push(g);
  G.flags.bag = null; showBag(); sfx('buy'); toast('Got your things back'); save();
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
function dawnScene(won) {
  G.tod = .24; G.todTarget = null; G.day++;
  if (night.final && won) { G.flags.held100 = 1; card('THE HUNDREDTH NIGHT', 'Kestrel stands. The world is yours to take.', 6); }
  else toast(won ? `Day ${G.day}. Kestrel held.` : `Day ${G.day}. They got inside — we lost supplies.`, 4);
  respawnBases(); save(); radioDay();
}
function respawnBases() {
  // a cleared base fills back up two days later
  const fill = G.flags.refill = G.flags.refill || {};
  for (const R of [{ id: 'foundry', ...FOUNDRY, fac: 'iron' }, ...BASES.filter(B => B.hostile)]) {
    const alive = ents.filter(e => e.type === 'clan' && !e.dead && e.mode === 'guard' && Math.hypot(e.x - R.x, e.z - R.z) < (R.R || 60) + 30).length;
    if (alive >= 3) { fill[R.id] = 0; continue; }
    fill[R.id] = (fill[R.id] || 0) + 1; if (fill[R.id] < 2) continue; fill[R.id] = 0;
    const n = R.id === 'foundry' ? 14 : R.fac === 'grey' ? 10 : 7;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rr(6, (R.R || 60) - 6); spawnClan(R.fac === 'grey' ? 'soldier' : i % 4 === 3 ? 'brute' : 'gunner', R.x + Math.cos(a) * r, R.z + Math.sin(a) * r, 'guard', R.fac); }
  }
}

/* ================= night raids ================= */
function startNight() {
  night.active = true; night.wave = 0; night.core = 100;
  night.final = G.day >= 100 && !G.flags.held100;
  night.waves = night.final ? 12 : Math.min(2 + Math.ceil(G.day / 3), 8);
  gate.open = false; sfx('gate'); G.tod = .9; G.todTarget = null;
  horn(78, 3.2, .26, 4);
  if (night.final) { card('NIGHT 100', 'Everyone is coming', 5); say([['Kade', 'This is it. Every clan, Ironjaw, Greyhold — all of them. Hold the wall!']]); }
  else say([['Kade', G.day < 3 ? 'Horns in the trees. Everyone to the wall!' : pick(['Here they come again. To the wall!', 'Raiders! Close it up!', 'Lights out there — get inside!'])]]);
  if (Math.hypot(P.x, P.z) > CAMP_R) toast('Get inside the wall!', 4); else toast('If the wall goes, fall back into the Arc and seal the doors', 4);
  facNight();
  nextWave();
}
function nextWave() {
  night.wave++; night.left = Math.min(40, Math.round((4 + night.wave * 2 + Math.floor(G.day * (night.final ? 2.2 : .8))) * facRaidScale())); night.spawnT = 1;
  if (night.wave > 1) { toast(`Wave ${night.wave}`); horn(82, 1.8, .2, 3); }
}
// who raids: the clans from the start, Ironjaw gunners from night 6, Greyhold soldiers from night 20, everyone on night 100
function raiderKind() {
  const fr = facRaider(); if (fr) return fr; if (!facAnyRaider()) return null;   // (Nov 11) who raids follows who's hostile — 2g-factions.js
  const r = rnd();
  if ((G.day >= 20 || night.final) && r < (night.final ? .2 : .1)) return ['soldier', 'grey'];
  if ((G.day >= 6 || night.final) && r < (night.final ? .45 : .28)) return ['gunner', 'iron'];
  if (night.wave >= 3 && r < .55 && rnd() < .3) return ['brute', 'clan'];
  if (night.wave >= 2 && rnd() < .4) return ['thrower', 'clan'];
  return ['warrior', 'clan'];
}
function updNight(dt) {
  if (night.left > 0) {
    night.spawnT -= dt;
    if (night.spawnT <= 0) {
      night.spawnT = rr(.7, 1.6); night.left--;
      const a = rr(-1.7, 1.7) + (night.wave >= 3 && rnd() < .3 ? Math.PI : 0), r = rr(105, 125);
      const rk = raiderKind(); if (rk) { const [k, f, tr] = rk; const re = spawnClan(k, Math.sin(a) * r, Math.cos(a) * r, 'raid', f); if (tr) re.tribe = tr; }
    }
  } else if (!ents.some(e => e.type === 'clan' && e.mode === 'raid' && !e.dead)) {
    if (night.wave < night.waves) { night.between += dt; if (night.between > 9) { night.between = 0; nextWave(); } }
    else endNight(true);
  }
  if (night.core <= 0) endNight(false);
}
function endNight(won) {
  night.active = false; gate.open = true; gate.hp = gate.max; hullDoor.hp = hullDoor.max; hullDoor.open = true;
  for (const e of [...ents]) if (e.type === 'clan' && e.mode === 'raid') removeEnt(e);
  if (!won) INV.scrap = Math.floor(INV.scrap * .6);
  for (const s of SCRAPS) if (!s.alive && s.tag === 'wild' && rnd() < .5) { s.alive = true; s.g.visible = true; }
  ensureWildlife();
  dawnScene(won);
}

/* ================= the Rust (red fog) ================= */
/* (Nov 10) the Rust comes every 7–10 days. In Kestrel the only cover is the Arc: the horn goes, everyone runs for the
   blast doors. One or two always get caught out — they go down in the fog, and unless you get a bandage or a medkit into
   them they don't get up. A roof doesn't stop fog: the only cover is the sealed hull. Out in the world it's gear
   (gas mask, hazmat, breather, Rust medicine) or nothing. */
const warnLen = () => 40 + (has('detector') ? 25 : 0) + (G.flags.radioTower ? 10 : 0);   // the horn to the fog
function rustDue() { return G.day + 7 + Math.floor(rnd() * 4); }
function startRust(scripted) {
  rust.state = 'warn'; rust.t = warnLen();
  G.flags.rustDay = rustDue(); P.fogT = 0;
  // who gets caught out: one or two of the settlers and townsfolk, late off the mark and slow
  const pool = ents.filter(e => e.type === 'npc' && !e.dead && (e.settler || e.name === 'extra') && Math.hypot(e.home.x, e.home.z) < CAMP_R);
  for (const e of pool) { e.straggler = false; e.rescued = false; e.fogDose = 0; }
  for (let i = 0, n = 1 + (rnd() < .5 ? 1 : 0); i < n && pool.length; i++) pool.splice(Math.floor(rnd() * pool.length), 1)[0].straggler = true;
  horn(110, 3, .22, 0); setTimeout(() => horn(110, 3, .22, 0), 3600);
  say([['Radio', scripted ? "That's the mast horn! Red fog off the ridge — get inside the Arc or get a mask on, NOW." : 'Mast horn — the Rust is coming. Everyone into the Arc! If you’re out there, mask up.']]);
}
function nearestShelter() { return { x: ARC_DOOR_OUT.x, z: ARC_DOOR_OUT.z, camp: true }; }
function inShelter() { return inHull(P.x, P.z); }   // (Nov 10) fog gets under any roof: only the sealed hull keeps it out
/* townsfolk in the fog: where to go, and what it does to them if they're out in it. Returns a move target or null. */
function fogNPC(e, dt) {
  if (e.follow || Math.hypot(e.home.x, e.home.z) > CAMP_R) return null;
  if (e.downed) {
    e.dieT -= dt; if (rnd() < dt * .6) puff(e.x, e.y + .4, e.z, 0x9a3a22, 1, .6, .1, .5, 1.5);
    if (e.dieT <= 0) { removeEnt(e); e.dead = true; toast(`${e.shopName || 'A settler'} didn't make it — the Rust got them.`, 4); sfx('no'); }
    return { x: e.x, z: e.z, spd: 0 };
  }
  const on = rust.state === 'warn' || rust.state === 'active';
  if (!on) { e.fogSpot = null; e.fogRoute = null; return null; }
  if (!e.fogSpot) e.fogRoute = null;
  if (!e.fogSpot) e.fogSpot = rnd() < .7 ? { x: ARC.x + rr(-24, 10), z: ARC.z + rr(-6, 5) } : (() => { const p = WING.pts[8 + Math.floor(rnd() * (WING.pts.length - 12))], o = rr(-4, 4); return { x: p.x + p.nx * o, z: p.z + p.nz * o }; })();
  const out = !inHull(e.x, e.z);
  if (rust.state === 'active' && out && !(e.shop && !e.settler) && !e.rescued) {   // (Nov 10) the watch (the two on the gate too) breathe it like anyone else
    e.fogDose = (e.fogDose || 0) + dt * (e.straggler ? 1.6 : 1);
    if (rnd() < dt * 1.2 && Math.hypot(e.x - P.x, e.z - P.z) < 18) sfx('cough', .6);
    if (e.fogDose > 9) { e.downed = true; e.dieT = 70; e.route = null; toast(`${e.shopName || 'Someone'} is down in the fog — get a bandage or a medkit into them!`, 4.5); return { x: e.x, z: e.z, spd: 0 }; }
  }
  // stragglers dither until the fog's on them, then stumble
  if (e.straggler && !e.rescued && rust.state === 'warn') return { x: e.x, z: e.z, spd: 0 };
  // (Nov 10) the way there: out of the shop door, along the streets to the Arc's doors, then in (straight lines got the keepers
  // stuck behind their counters). Anyone wedged for a few seconds out of your sight skips to the next corner.
  if (out && !e.fogRoute) e.fogRoute = fogRouteFor(e);
  if (e.fogRoute && e.fogRoute.length) {
    const n = e.fogRoute[0], d = Math.hypot(n.x - e.x, n.z - e.z);
    if (d < 1.1) { e.fogRoute.shift(); e.fogStuck = 0; e.fogBest = 1e9; }
    else {
      // no headway on this corner (sliding along a wall doesn't count) — skip to it
      if (d < (e.fogBest ?? 1e9) - .3) { e.fogBest = d; e.fogStuck = 0; } else e.fogStuck = (e.fogStuck || 0) + dt;
      if (e.fogStuck > (Math.hypot(e.x - P.x, e.z - P.z) > 14 ? 2.5 : 6)) { e.x = n.x; e.z = n.z; e.fogRoute.shift(); e.fogStuck = 0; e.fogBest = 1e9; }
      return { x: n.x, z: n.z, spd: e.straggler && !e.rescued ? 1.7 : 3.8 };
    }
  }
  return { x: e.fogSpot.x, z: e.fogSpot.z, spd: Math.hypot(e.fogSpot.x - e.x, e.fogSpot.z - e.z) > .8 ? (e.straggler && !e.rescued ? 1.7 : 3.8) : 0 };
}
function fogRouteFor(e) {
  const pts = [], D = SHOP[e.shop];
  if (D && Math.hypot(e.x - D.cx, e.z - D.cz) < Math.max(D.bw, D.bd) * .6) pts.push(shopL2W(D, 0, D.bd / 2 + 1.2), shopL2W(D, 0, D.bd / 2 + 2.6));
  const p0 = pts.length ? pts[pts.length - 1] : e, from = WALK.nearest(p0.x, p0.z), to = WALK.nearest(ARC_DOOR_OUT.x, ARC_DOOR_OUT.z);
  pts.push(from, ...WALK.path(from, to), { x: ARC_DOOR_OUT.x + rr(-1.2, 1.2), z: ARC_DOOR_OUT.z });
  return pts.map(n => ({ x: n.x, z: n.z }));
}
const nearDowned = () => { for (const e of ents) if (e.downed && Math.hypot(e.x - P.x, e.z - P.z) < 2.6) return e; return null; };
const FOG_MEDS = ['rust_med', 'medkit', 'blood_bag', 'iv', 'surgical_kit', 'bandage', 'herb_bandage', 'painkiller'];
function healDowned(e) {
  const id = FOG_MEDS.find(k => cnt(k) > 0);
  if (!id) { sfx('no'); toast('You need something to treat them — a bandage, a medkit or Rust medicine', 3); return; }
  take(id, 1); e.downed = false; e.rescued = true; e.fogDose = 0; e.straggler = false; sfx('pickup');
  toast(`You patched ${e.shopName || 'them'} up (${nameOf(id).toLowerCase()}) — they're heading for the Arc`, 3.5);
}
/* (Nov 10, Bryce) the blast doors shut themselves when the fog rolls in and open again when it lifts (E at the door still works:
   caught outside, you can open them, get in and seal them behind you) */
function sealForFog(on) {
  if (hullDoor.hp <= 0 || night.active) return;
  if (on && hullDoor.open) { hullDoor.open = false; sfx('gate'); toast(inHull(P.x, P.z) ? 'Blast doors sealed — the fog is here' : 'The Arc’s doors are sealing — E at the door to get in', 3.5); }
  if (!on && !hullDoor.open) { hullDoor.open = true; sfx('gate'); toast('Blast doors opening', 2.5); }
}
/* time to the next fog, for the countdown at the top of the screen: null = nothing to show yet */
function fogCountdown() {
  if (rust.state === 'warn') return { t: `RED FOG IN ${clock(rust.t)}`, k: 'warn' };
  if (rust.state === 'active') return { t: `RED FOG · LIFTS IN ${clock(rust.t)}`, k: 'act' };
  if (rust.state === 'clear') return { t: 'FOG LIFTING', k: '' };
  if (!G.flags.reached) return null;
  if (!G.flags.firstRust) return G.flags.firstRustT != null ? { t: `RED FOG IN ${clock(G.flags.firstRustT + warnLen())}`, k: G.flags.firstRustT < 30 ? 'near' : '' } : null;
  if (G.flags.rustDay == null) return null;
  // it comes in the day window (.36–.62) of its day; past the window it rolls to the next morning
  const rem = G.day < G.flags.rustDay ? (G.flags.rustDay - G.day) + (.36 - G.tod) : G.tod < .36 ? .36 - G.tod : G.tod < .62 ? 0 : 1.36 - G.tod;
  if (rem <= 0 && night.active) return { t: 'RED FOG AFTER THE RAID', k: 'near' };
  if (rem <= 0) return { t: `RED FOG IN ${clock(warnLen())}`, k: 'near' };
  const secs = rem * DAY_LEN / .56 + warnLen();
  if (rem < 1) return { t: `RED FOG IN ${clock(secs)}`, k: secs < 120 ? 'near' : '' };
  const h = Math.floor(rem * 24);
  return { t: `RED FOG IN ${Math.floor(h / 24)}D ${h % 24}H`, k: '' };
}
const clock = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
function updRust(dt) {
  if (rust.state === 'none') {
    if (G.flags.rustDay == null) G.flags.rustDay = rustDue();
    // (Nov 10) the first fog: about 45 s after you first walk into Kestrel (and once on older saves that are already there)
    if (G.flags.reached && !G.flags.firstRust && !night.active) { G.flags.firstRustT = (G.flags.firstRustT ?? 60) - dt; if (G.flags.firstRustT <= 0) { G.flags.firstRust = 1; delete G.flags.firstRustT; startRust(false); } }
    if ((G.chapterDone || G.day > 1) && !night.active && G.day >= G.flags.rustDay && G.tod > .36 && G.tod < .62) startRust(false);
    if (G.step === 8 && !G.flags.rustDone && Math.hypot(P.x, P.z) > 85) { G.flags.rustDone = 1; startRust(true); }
  } else if (rust.state === 'warn') { rust.t -= dt; rust.k = lerp(rust.k, .25, dt * .3); if (rust.t <= 0) { rust.state = 'active'; rust.t = 60; rust.sealT = 8; } }
  else if (rust.state === 'active') {
    rust.t -= dt; rust.k = lerp(rust.k, 1, dt * .8);
    // the doors shut once whoever is right at them is through (or after 8 s, whoever's left)
    if (rust.sealT > 0) { rust.sealT -= dt; if (rust.sealT <= 0 || !ents.some(e => e.type === 'npc' && !e.dead && !e.downed && e.fogSpot && Math.hypot(e.x - ARC_DOOR_OUT.x, e.z - ARC_DOOR_OUT.z) < 7 && !inHull(e.x, e.z))) { rust.sealT = 0; sealForFog(true); } }
    P.safe = inShelter();
    // it burns harder the longer you're out in it: ~5 hp/s at first, ~15 after twenty seconds
    P.fogT = P.safe ? Math.max(0, (P.fogT || 0) - dt * 2) : (P.fogT || 0) + dt;
    const fr = fogResist(); if (!P.safe && !P.dead && fr < 1) { P.dose = (P.dose || 0) + dt * 1.6 * (1 - fr); P.hp -= (5 + Math.min(10, P.fogT * .5)) * dt * (1 - fr); P.coughT -= dt; if (P.coughT <= 0) { P.coughT = rr(1.2, 2.2); sfx('cough'); hud.hurt.style.opacity = .5; } }
    if (rust.t <= 0) { rust.state = 'clear'; rust.t = 8; sealForFog(false); say([['Radio', 'Fog is lifting. Breathe easy.']]); }
  } else if (rust.state === 'clear') { rust.t -= dt; rust.k = lerp(rust.k, 0, dt * .6); if (rust.t <= 0) { rust.state = 'none'; rust.k = 0; } }
}

/* ================= actors update ================= */
function moveEnt(e, tx, tz, speed, dt) {
  { const ih = inHull(e.x, e.z); if (ih !== inHull(tx, tz)) { const a = ih ? ARC_DOOR_IN : ARC_DOOR_OUT, b = ih ? ARC_DOOR_OUT : ARC_DOOR_IN;
    if (Math.hypot(e.x - a.x, e.z - a.z) > 1.6 && !(Math.abs(e.x - ARC.x) < ARC.DOOR - .8 && Math.abs(e.z - ARC.z - ARC.W - .3) < 2.4)) { tx = clamp(e.x, a.x - 2, a.x + 2); tz = a.z; } else { tx = b.x; tz = b.z; } } }
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
  if (e.burn > 0) { e.burn -= dt; e.hp -= 12 * dt; if (Math.random() < dt * 8) puff(e.x, e.y + 1, e.z, 0xff7a2a, 1, 1, .12, .4, 2); if (e.hp <= 0) { damage(e, 1, true, new THREE.Vector3(e.x, e.y + 1, e.z)); return; } }
  if (e.stun > 0) { e.stun -= dt; p.body.rotation.z = Math.sin(e.t * 20) * .1; e.g.position.set(e.x, e.y, e.z); return; }
  if (e.blind > 0) e.blind -= dt;
  if (facUpd(e, dt)) return;   // (Nov 11) factions: standing down, fights between groups, patrols, allies (2g-factions.js)
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp);
  const insideP = Math.hypot(P.x, P.z) < CAMP_R, insideE = Math.hypot(e.x, e.z) < CAMP_R, gun = e.kind === 'gunner' || e.kind === 'soldier';
  const hullP = inHull(P.x, P.z), hullE = inHull(e.x, e.z);
  const walled = (insideP !== insideE && gate.hp > 0 && !gate.open) || (hullP !== hullE && hullDoor.hp > 0 && !hullDoor.open);
  let tx = e.x, tz = e.z, spd = 0;
  if (e.atk > 0) { // attack swing in progress
    e.atk -= dt; const wind = e.atk > .25; p.body.rotation.x = wind ? -.12 : .35; p.body.position.z = wind ? -.1 : .35; if (p.weapon) p.weapon.rotation.x = wind ? -1.6 : .6;
    if (e.atk <= .25 && !e.struck) { e.struck = true; sfx('swing');
      if (e.target === 'hull') { hullDoor.hp -= e.kind === 'brute' ? 30 : 12; sfx('thud'); puff(e.x + Math.sin(e.yaw) * 1.2, e.y + 1.4, e.z + Math.cos(e.yaw) * 1.2, 0x8a8a8a, 3, 2, .1, .4); if (hullDoor.hp <= 0) { hullDoor.hp = 0; toast('They’ve forced the Arc’s doors!', 3); sfx('gate'); } }
      else if (e.target === 'gate') { gate.hp -= e.kind === 'brute' ? 34 : 14; sfx('thud'); puff(e.x + Math.sin(e.yaw) * 1.2, e.y + 1.4, e.z + Math.cos(e.yaw) * 1.2, 0x8a7a6a, 3, 2, .1, .4); if (gate.hp <= 0) { gate.hp = 0; toast('The gate is down!', 3); sfx('gate'); } }
      else if (dp < 2.7 && Math.abs(P.y - e.y) < 2.4 && !P.dead) hurtPlayer(e.kind === 'brute' ? 24 : 13, e.x, e.z); }
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
    const sees = (e.mode === 'guard' ? (gun ? 46 : 30) : 34) * stealthK() * (e.fac === 'clan' && P.paint > 0 ? .6 : 1) * (isNight() ? .7 : 1) * wxSight();
    if (dp < sees && !P.dead && !UG.at && facHostileE(e) && !(e.blind > 0) && !(insideP && !gate.open) && !inSmoke(P.x, P.z)) { e.state = 'chase'; sfx('grunt'); alertNear(e); }
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
      if (!hullE && hullDoor.hp > 0 && !hullDoor.open) {   // the Arc is sealed: break the doors
        tx = clamp(e.x, ARC.x - 3, ARC.x + 3); tz = ARC.z + ARC.W + 1.7; spd = e.speed;
        if (Math.hypot(e.x - tx, e.z - tz) < 2.2 && e.cool <= 0) { e.yaw = Math.PI; e.target = 'hull'; e.atk = .65; e.struck = false; e.cool = e.kind === 'brute' ? 1.6 : 1.2; }
      } else { tx = ARC_CORE.x; tz = ARC_CORE.z + 3; spd = e.speed; }
      if (Math.hypot(e.x - ARC_CORE.x, e.z - ARC_CORE.z) < 7) { night.core -= dt * (e.kind === 'brute' ? 7 : 3.5); if (Math.random() < dt * 3) puff(e.x, e.y + 1, e.z, 0xff8a3a, 2, 1, .12, .5, 2); }
    }
    if ((!walled && dp < 16 || gun && dp < 45) && !P.dead) e.state = 'chase';
    if (e.kind === 'thrower' && dp < 30 && dp > 8 && e.cool <= 0 && !P.dead && Math.abs(P.y - e.y) < 12) { e.yaw = Math.atan2(dxp, dzp); e.target = 'p'; e.cool = rr(2.4, 3.6); e.throwT = .6; }
  }
  if (e.state === 'chase' && gun) {
    if (P.dead || dp > 90 || (e.mode === 'guard' && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 140)) e.state = e.mode === 'raid' ? 'raid' : 'idle';
    else { [tx, tz, spd] = updGunner(e, dt, dp); if (p.weapon) p.weapon.rotation.x = -.1; }
  } else if (e.state === 'chase') {
    if (P.dead || dp > 70 || walled || (e.mode === 'guard' && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 120)) e.state = e.mode === 'raid' ? 'raid' : 'idle';
    tx = P.x; tz = P.z; spd = e.speed * (dp > 6 ? 1.15 : 1) * (e.slow ? .5 : 1); e.slow = 0;
    if (e.kind === 'thrower' && dp > 8 && dp < 28 && e.cool <= 0) { e.yaw = Math.atan2(dxp, dzp); e.cool = rr(2.2, 3.4); e.throwT = .6; }
    else if (e.kind === 'thrower' && dp < 12) { tx = e.x - dxp; tz = e.z - dzp; }
    if (dp < 2.1 && Math.abs(P.y - e.y) < 2.4 && e.cool <= 0) { e.yaw = Math.atan2(dxp, dzp); e.target = 'p'; e.atk = .7; e.struck = false; e.cool = e.kind === 'brute' ? 1.6 : 1.1; }
  }
  if (e.throwT > 0) { e.throwT -= dt; p.body.rotation.x = -.18; if (p.weapon) p.weapon.rotation.x = -2.2; if (e.throwT <= 0) { throwSpear(e); p.body.rotation.x = .25; if (p.weapon) p.weapon.rotation.x = .3; } e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return; }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  p.body.position.z = 0;
  e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
// a guard who spots you shouts: everyone near them joins in
function alertNear(e) { for (const o of ents) if (o !== e && o.type === 'clan' && !o.dead && o.state === 'idle' && Math.hypot(o.x - e.x, o.z - e.z) < 28) o.state = 'chase'; }
function updAnimal(e, dt) {
  if (e.sp) return updWild(e, dt);
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
  } else if (e.guard && night.active && updGuard(e, dt)) {
    spd = 0;
  } else if (e.wander) {
    const inCamp = Math.hypot(e.home.x, e.home.z) < CAMP_R;
    if (inCamp) {                       // Kestrel: walk the streets, stop at shop fronts, loiter, move on
      if (night.active) e.route = null;
      else if (e.route && e.route.length) {
        const n = e.route[0], wx = n.x + e.offX, wz = n.z + e.offZ;
        if (Math.hypot(wx - e.x, wz - e.z) < .7) { e.route.shift(); if (!e.route.length) { e.route = null; e.wait = n.shop ? rr(5, 11) : rr(1.5, 5); e.at = n; } else if (rnd() < .12) e.wait = rr(1, 3); }
        else if (e.wait > 0) e.wait -= dt;
        else { tx = wx; tz = wz; spd = e.walkSpd; }
      } else {
        e.wait -= dt;
        if (e.at && e.at.shop) e.yaw += angWrap(Math.atan2(e.at.shop.cx - e.x, e.at.shop.cz - e.z) - e.yaw) * Math.min(1, dt * 3);
        if (e.wait <= 0) {
          const N = WALK.nodes, shops = N.filter(n => n.shop), to = rnd() < .5 ? pick(shops) : pick(N), from = WALK.nearest(e.x, e.z);
          e.route = [from, ...WALK.path(from, to)]; e.offX = rr(-.9, .9); e.offZ = rr(-.9, .9); e.at = null;
        }
      }
    } else {                            // out in the world: short strolls round home, never into something solid
      e.t -= dt;
      if (e.t <= 0) { e.t = rr(4, 10); for (let k = 0; k < 6; k++) { const x = e.home.x + rr(-8, 8), z = e.home.z + rr(-8, 8); if (clearLine(e.x, e.z, x, z, e.r)) { e.tx = x; e.tz = z; break; } } }
      if (e.tx !== undefined && Math.hypot(e.tx - e.x, e.tz - e.z) > .6) { tx = e.tx; tz = e.tz; spd = e.walkSpd; }
    }
  } else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) > .6) { tx = e.home.x; tz = e.home.z; spd = 2; }
  if (e.guard && !night.active && rnd() < dt * .5) updGuard(e, dt);
  if (e === curShopE && invOpen && invTab === 'trade') { spd = 0; e.yaw += angWrap(Math.atan2(P.x - e.x, P.z - e.z) - e.yaw) * Math.min(1, dt * 4); }
  if (night.active && !e.follow && (e.name === 'extra' || e.settler) && Math.hypot(e.home.x, e.home.z) < CAMP_R) { if (!e.hullSpot) e.hullSpot = { x: ARC.x + rr(-22, 6), z: ARC.z + rr(-6, 4) }; tx = e.hullSpot.x; tz = e.hullSpot.z; spd = Math.hypot(tx - e.x, tz - e.z) > .8 ? 3.2 : 0; }
  { const f = fogNPC(e, dt); if (e.dead) return; if (f) { tx = f.x; tz = f.z; spd = f.spd; } }
  const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0;
  if (!v && dp < 6 && !cine && !e.downed) e.yaw += angWrap(Math.atan2(P.x - e.x, P.z - e.z) - e.yaw) * Math.min(1, dt * 4);
  e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 2.5), v);
  { const gy = heightAt(e.x, e.z), fy = floorAt(e.x, e.z, e.y ?? gy); e.y = Math.max(gy, fy); } e.g.position.set(e.x, e.y + (e.downed ? .25 : 0), e.z); e.g.rotation.y = e.yaw; e.g.rotation.x = e.downed ? -1.45 : 0;
}
function updTowers(dt) {
  for (const T of towers) {
    if (T.beam) T.beam.material.opacity = (isNight() ? .07 : 0) * (1 - rust.k * .5);
    if (UP.tur <= 0) continue;
    T.cool -= dt; if (T.cool > 0) continue;
    let best = null, bd = 48 + UP.tur * 6;
    for (const e of ents) if (isFoe(e)) { const d = Math.hypot(e.x - T.x, e.z - T.z); if (d < bd) { bd = d; best = e; } }
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
  n = onHurt(n, fx !== P.x || fz !== P.z);
  P.hp -= n; P.hurtT = .6; P.kick += .05; sfx('hurt'); hud.hurt.style.opacity = Math.min(1, .35 + n / 30);
  if (P.hp <= 0) die();
}
function die() {
  P.dead = true; P.hp = 0; $('dead').style.display = 'grid'; if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => {
    dropBag();
    $('dead').style.display = 'none'; P.dead = false; P.hp = 70; clearInjuries(); chan = null; P.food = Math.max(P.food, 50); P.water = Math.max(P.water ?? 100, 50); P.fly = false;
    const sp = G.flags.spawn && PLACED.some(p => BUILD_DEF[p.k].rest && Math.hypot(p.x - G.flags.spawn.x, p.z - G.flags.spawn.z) < 1) ? G.flags.spawn : null;
    if (sp) { P.x = sp.x + 1.5; P.z = sp.z + 1.5; } else if (!G.flags.reached) { P.x = POI.dropsite.x + DROP_WAKE[0]; P.z = POI.dropsite.z + DROP_WAKE[1]; } else { P.x = SHOP.med.front.x; P.z = SHOP.med.front.z; }
    if (G.flags.reached && rust.state !== 'none' && rust.state !== 'clear') { P.x = ARC_DOOR_IN.x; P.z = ARC_DOOR_IN.z - 3; }   // in a fog, they carried you into the Arc
    P.y = heightAt(P.x, P.z); P.pd = Math.hypot(P.x, P.z); P.pitch = 0; P.slot = slotWeapon(0) ? 0 : P.slot; selectGunView(gunId());
    if (INV.res < 30) INV.res = 30;
    const who = sp ? 'You wake up at your bed' : G.flags.reached ? 'Juno patched you up' : 'You come to by the wreck';
    toast(G.flags.bag ? `${who}. Your bag is where you fell — follow the light.` : `${who}.`, 4);
  }, 2600);
}
function damage(e, n, byPlayer, at) {
  if (e.dead) return;
  e.hp -= n;
  if (byPlayer && e.type === 'clan') facHurt(e);
  puff(at.x, at.y, at.z, e.type === 'clan' ? 0x6a1a12 : 0x6a1a12, 5, 2, .08, .4);
  if (e.type === 'clan' && e.state !== 'chase' && e.state !== 'raid' && byPlayer) e.state = 'chase';
  if (e.sp) wildHit(e);
  else if (e.type === 'deer' && e.state !== 'flee') { e.state = 'flee'; e.t = rr(5, 8); }
  else if (e.type === 'boar') e.state = 'charge';
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 0; G.kills++; if (e.type === 'clan') facDied(e, byPlayer);
    if (e.type === 'clan') { sfx('grunt'); const dr = clanDrop(e); if (rnd() < .55) { INV.scrap++; dr.unshift(['scrap', 1]); } if (byPlayer && dr.length) toast(dr.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · '), 2); e.climbing = false; e.climbY = 0; e.g.position.y = e.y; }
    if (e.sp) { if (byPlayer) toast(`${e.sp.n} down — go butcher it`); }
    else if (e.type === 'deer' || e.type === 'boar') { if (byPlayer) toast(`${e.type === 'deer' ? 'Deer' : 'Boar'} down — go butcher it`); }
  }
}
let touchUp = false;
function toggleFly(v = !P.fly) {
  if (G.mode !== 'play' || cine || P.dead) return;
  if (v && !G.flags.dev) return;
  P.fly = v; P.vy = 0; $('bFly').classList.toggle('on', v); toast(v ? (isTouch ? 'Flying · look where you want to go · hold JUMP to climb · tap FLY to land' : 'Flying · WASD + look · Space up · C down · Shift fast · Esc, then click FLY to land') : 'Landed', 3.5);
}
/* the secret: tap the heart 7 times fast (or type "floombus" on a keyboard) — every item in the game, a bottomless bag,
   and the FLY button. Do it again any time to top everything back up. */
let secretTaps = [], secretKeys = '';
function secretTap() { const now = performance.now(); secretTaps = secretTaps.filter(t => now - t < 2500); secretTaps.push(now); if (secretTaps.length >= 7) { secretTaps = []; unlockEverything(); } }
function unlockEverything() {
  if (G.mode !== 'play') return;
  const first = !G.flags.dev; G.flags.dev = 1;
  for (const id in ITEMS) { const I = ITEMS[id], want = I.c === 'story' ? 1 : I.c === 'ammo' ? 500 : I.c === 'build' ? 10 : 99; if (cnt(id) < want) give(id, want - cnt(id)); }
  for (const id in GEAR_DEFS) if (!INV.tools.some(t => t.id === id)) give(id, 1, 2);
  INV.scrap = Math.max(INV.scrap, 9999); INV.res = Math.max(INV.res, RES_MAX); INV.resH = Math.max(INV.resH, RESH_MAX);
  G.flags.tier = 6; showFlyBtn(); sfx('buy'); toast(first ? 'Everything unlocked · every item, a bottomless bag, and the FLY button' : 'Topped up · every item restocked', 4);
  if (invOpen) renderInv(); save();
}
function showFlyBtn() { $('bFly').style.display = G.flags.dev ? 'grid' : 'none'; }
$('bFly').addEventListener('click', e => { e.stopPropagation(); if (G.flags.dev) toggleFly(); });
$('hp').addEventListener('click', e => { e.stopPropagation(); secretTap(); });
addEventListener('keydown', e => { if (G.mode !== 'play' || e.key.length !== 1) return; secretKeys = (secretKeys + e.key.toLowerCase()).slice(-8); if (secretKeys === 'floombus') { secretKeys = ''; unlockEverything(); } });
function updPlayer(dt) {
  if (P.dead) return;
  // look (slower while aiming)
  const lk = 1 / (1 + (zoomOf(gunId()) - 1) * P.ads * .8) / (P.binoc ? 3 : 1);
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
    const wl = UG.at ? -1e9 : waterAt(P.x, P.z), depth = wl - P.y;   // (Nov 11) under the ground: no water, no terrain, the pocket's own rooms
    P.swim = depth > 1.25;
    const wantRun = !(P.frac > 0) && !P.over && (input.sprint || (isTouch && ml > .96) || P.runToggle) && my > .3 && !shopOpen && !input.ads && !input.fire && !P.swim && depth < .5;
    if (P.stam <= 0) P.winded = true; else if (P.winded && P.stam > 35) P.winded = false;
    sprint = wantRun && !P.winded;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let wx = fx * my + rx * mx, wz = fz * my + rz * mx;
    // slope along where you're heading
    let slopeK = 1;
    if (ml > .05 && P.onGround && !UG.at) { const wl2 = Math.hypot(wx, wz), dx = wx / wl2, dz = wz / wl2, gr = (heightAt(P.x + dx * 1.6, P.z + dz * 1.6) - heightAt(P.x, P.z)) / 1.6; slopeK = clamp(1 - Math.max(0, gr - .22) * 1.1, .38, 1) * (gr < -.25 ? 1.06 : 1); }
    const spd = (sprint ? 9.6 : 5.4) * (shopOpen ? 0 : 1) * (P.swim ? .55 : depth > .4 ? .7 : 1) * (1 - P.ads * .45) * slopeK * (P.frac > 0 ? .62 : 1) * (P.over ? .65 : 1) * (1 + wearStat('mob'));
    wx *= spd; wz *= spd;
    const acc = P.swim ? 9 : !P.onGround ? 7 : ml > .05 ? 42 : 30;
    let dvx = wx - P.vx, dvz = wz - P.vz; const dl = Math.hypot(dvx, dvz);
    if (dl > 1e-4) { const st = Math.min(dl, acc * dt); P.vx += dvx / dl * st; P.vz += dvz / dl * st; }
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt;
    if (UG.at) pocketCollide(P, .42, ox, oz); else { collide(P, .42, true); cityCollide(P, .42); }
    // what actually happened after bumping trees and walls becomes the new velocity, so you slide along things instead of sticking
    if (dt > 0) { const ax = (P.x - ox) / dt, az = (P.z - oz) / dt; if (Math.hypot(ax, az) < Math.hypot(P.vx, P.vz) + 2) { P.vx = ax; P.vz = az; } }
    hs = Math.hypot(P.vx, P.vz);
    // stamina: sprinting drains it, it comes back after a breather; run it dry and you're winded until it's a third back
    if (sprint && hs > 3) { P.stam = Math.max(0, P.stam - dt * 11); P.stamT = 1; }
    else { P.stamT -= dt; if (P.stamT <= 0) P.stam = Math.min(100, P.stam + dt * (hs > 1 ? 13 : 24)); }
    if (P.winded) { P.breathT = (P.breathT || 0) - dt; if (P.breathT <= 0) { P.breathT = .75; noiseBurst(.32, 750, .8, .035, 'bandpass'); } }
    let gy = UG.at ? -1e9 : heightAt(P.x, P.z);
    const fl = floorAt(P.x, P.z, P.y); if (fl > gy) gy = fl;
    gy = cityGround(P.x, P.z, P.y, gy);   // basements and the line under the city
    if (P.swim) gy = Math.max(gy, wl - 1.3);
    // jump: pressing a beat early still counts, and so does a beat after you've stepped off an edge
    if (input.jump) P.jumpBuf = .15; input.jump = false; P.jumpBuf -= dt;
    P.coyote = P.onGround ? .12 : P.coyote - dt;
    if (P.jumpBuf > 0 && (P.coyote > 0 || P.swim)) { P.vy = P.swim ? 3 : 6.8 + (sprint ? .4 : 0); P.onGround = false; P.coyote = 0; P.jumpBuf = 0; if (!P.swim) P.stam = Math.max(0, P.stam - 5); }
    P.vy -= (P.swim ? 6 : 22) * dt; P.y += P.vy * dt;
    if (P.y <= gy) {
      if (!P.onGround) { P.land = Math.max(P.land, clamp(-P.vy * .022, 0, .32)); if (P.vy < -4.5) sfx('step', 1.3); if (P.vy < -11) { sfx('thud'); if (P.vy < -17) { const fd = Math.round((-P.vy - 17) * 4); hurtPlayer(fd, P.x, P.z); onFall(fd); } } }
      P.y = gy; P.vy = 0; P.onGround = true;
    }
    else if (P.onGround && P.vy <= 0 && P.y - gy < .55 + hs * .06) P.y = gy; else P.onGround = false;
    // footsteps and head bob are driven by distance covered, so they always match your stride
    const moving = hs > .6 && P.onGround;
    const stepLen = sprint ? 2.25 : 1.6, b0 = Math.floor(P.bob / Math.PI);
    if (P.onGround) P.bob += hs * dt / stepLen * Math.PI;
    STEP_SURF = depth > -.1 ? 'sand' : fl > -1e8 && fl >= P.y - .1 ? (Math.hypot(P.x - POI.bridge.x, P.z - POI.bridge.z) < 50 ? 'gravel' : 'metal') : P.y > 122 ? 'snow' : pathDist(P.x, P.z) < 3 || (Math.hypot(P.x, P.z) < CAMP_R && streetDist(P.x, P.z) < .3) || Math.hypot(P.x - POI.halvard.x, P.z - POI.halvard.z) < 75 ? 'gravel' : 'trail';
    if (moving && Math.floor(P.bob / Math.PI) !== b0) { sfx('step', sprint ? 1.35 : clamp(hs / 5.4, .5, 1)); if (depth > -.05) sfx('splash'); }
    P.bobAmp = lerp(P.bobAmp, moving ? clamp(hs / 5.4, 0, 1.8) : 0, Math.min(1, dt * 8));
    // the eye follows the ground smoothly instead of snapping over every bump
    P.eyeY = P.onGround && Math.abs(P.y - P.eyeY) < .8 ? lerp(P.eyeY, P.y, Math.min(1, dt * 22)) : P.y;
  }
  P.sprinting = sprint && hs > 3;
  // survival
  updSurvival(dt);   // (Part 3) hunger, healing, food buffs, rain-catching — 2b-craft.js
  if (P.hp <= 0 && !P.dead) die();
  P.hurtT -= dt;
  // weapon
  const W = WEAPONS[gunId()] || WEAPONS.carbine;
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
  P.roll = lerp(P.roll, -latV * .0045 + Math.cos(P.bob) * .006 * bk * P.runK, Math.min(1, dt * 8));   // no roll from turning: the head stays level when you look side to side
  P.sway = 0;
  camera.position.set(P.x + rx * bobX * .5, P.eyeY + (P.swim ? 1.45 : 1.62) + bobY - P.land, P.z + rz * bobX * .5);
  camera.rotation.set(P.pitch + P.kick * .35 - P.land * .12, P.yaw, P.roll);
  // (Nov 10, Bryce: "like Elyra") aiming zooms the view and the gun stays at your side; only the snipers look through a scope
  if (P.ads < .1) P.scopeLvl = 0;
  const fov0 = BASE_FOV + P.runK * 7, fov = fov0 / (1 + (zoomOf(gunId()) - 1) * P.ads) / (P.binoc ? 4 : 1);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const scoped = SNIPE.has(gunId()) && P.ads > .85;
  $('scope').classList.toggle('on', scoped); vm.visible = !scoped && !P.swim; if (isTouch) $('bZoom').style.display = scoped ? 'grid' : 'none';
  // viewmodel: bob, kick, reload dip, swap drop; aiming slides it to the centre
  const rl = P.reload > 0 ? Math.sin((1 - P.reload / P.reloadMax) * Math.PI) : 0, sw = (P.swapT || 0) / .45;
  // running lowers and cants the gun; it lags a hair behind fast turns
  const rk2 = P.runK;
  vm.position.set(bobX * .8 + P.ads * .012 + P.sway * .5 - rk2 * .03, bobY * .7 - rl * .16 - sw * .3 - rk2 * .07 - P.land * .3 - P.ads * .04, P.kick * 1.1 - P.ads * .02 + rk2 * .03);
  vm.rotation.set(rl * .5 + P.kick * 1.4 - rk2 * .32 + Math.sin(P.bob) * .03 * rk2, P.sway * 1.5 + rk2 * .55, -rl * .3 + rk2 * .2 + P.roll * .5);
  weaponAnim(dt);
  // the gun is drawn as if by its own unzoomed camera: squeezed toward the middle by exactly as much as the zoom magnifies (ELYRA's vmFov)
  { const zk = Math.tan(fov0 * Math.PI / 360) / Math.tan(camera.fov * Math.PI / 360); vm.scale.set(1 / zk, 1 / zk, 1); vm.position.x /= zk; vm.position.y /= zk; }
}
/* (Nov 10) zoom, from ELYRA: assault rifles 2x; pistols, SMGs, shotguns and bows 1.3x; the snipers (hunting rifle, sniper rifle) 4x
   through the scope, 7x with Z (phone: ZOOM) while scoped. Every time you scope in it starts at 4x and eases between the two */
const SNIPE = new Set(['hunter', 'sniper']), AR_Z = new Set(['carbine', 'battle', 'assault', 'grey_rifle', 'pulse_rifle', 'lmg', 'pump_rifle']), SCOPE_Z = [4, 7];
P.scopeLvl = 0; P.zoomNow = SCOPE_Z[0];
function zoomOf(id) {
  if (SNIPE.has(id)) { const want = SCOPE_Z[P.scopeLvl] || SCOPE_Z[0]; P.zoomNow += (want - P.zoomNow) * .22; if (Math.abs(want - P.zoomNow) < .01) P.zoomNow = want; return P.zoomNow; }
  if (AR_Z.has(id)) return 2;
  return (WEAPONS[id]?.scope || 1) > 1 ? 1.3 : 1;
}
function scopeZoom() { if (!SNIPE.has(gunId()) || P.ads < .85 || P.dead) return; P.scopeLvl = (P.scopeLvl + 1) % SCOPE_Z.length; sfx('dry'); }
function climbLookout() {
  if (P.y < POI.lookoutTop - 3) { P.x = POI.lookout.x + .5; P.z = POI.lookout.z + .5; P.y = POI.lookoutTop; P.vy = 0; toast('The whole valley, laid out', 2.5); }
  else { P.x = POI.lookout.x - 4; P.z = POI.lookout.z + 4; P.y = heightAt(P.x, P.z); P.vy = 0; }
  sfx('step'); sfx('step');
}
const nearCrate = () => { let b = null, bd = 3; for (const c of CRATES) { if (c.opened && G.t - (c.at || 0) > 1500) { c.opened = false; c.g.scale.y *= 2; } if (c.opened) continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; b = c; } } return b; };
function openCrate(c) {
  if (!c || c.opened) return; c.opened = true; c.at = G.t; c.g.scale.y *= .5;
  const msg = [];
  if (c.loot === 'ammo' || c.loot === 'mixed') { const n = 18 + Math.floor(rnd() * 20); INV.res = Math.min(RES_MAX + 30, INV.res + n); msg.push(`+${n} rounds`); if (G.flags.hunter) { INV.resH += 4; msg.push('+4 rifle rounds'); } }
  if (c.loot === 'scrap' || c.loot === 'mixed') { const n = 2 + Math.floor(rnd() * 4); INV.scrap += n; msg.push(`+${n} scrap`); }
  if (rnd() < .3) { give('dried_meat', 1); msg.push('+1 dried meat'); }
  msg.push(...crateSalvage(c));
  sfx('pickup'); toast(msg.slice(0, 6).join(' · '), 3.4);
}

/* ================= wildlife + the clans in the wider valley ================= */
function ensureWildlife() {
  if (ensureWild()) return;
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
  baseGuards();
}

/* ================= time + atmosphere ================= */
const isNight = () => G.tod > .8 || G.tod < .22;
const DAY_LEN = 420;
let hullFogK = 0;
function updTime(dt) {
  if (night.active) { G.tod = lerp(G.tod, .92, dt * .2); }
  else if (G.todTarget != null) { G.tod = lerp(G.tod, G.todTarget, dt * .08); }
  else if (G.chapterDone && G.step >= 12 && !G.flags.reached) {
    // before you've reached Kestrel the raids aren't your fight: nights pass (a bit quicker) wherever you are
    G.tod += dt * (.56 / DAY_LEN) * (isNight() ? 2 : 1);
    if (G.tod >= 1) { G.tod -= 1; G.day++; toast(`Day ${G.day}`, 2.4); save(); radioDay(); }
  }
  else if (G.chapterDone && G.step >= 12) {
    G.tod += dt * (.56 / DAY_LEN);
    if (G.tod > .72 && !G.flags.duskWarn) { G.flags.duskWarn = 1; say([['Kade', 'Sun is going down. Get back inside the wall.']]); }
    if (G.tod >= .79) { G.flags.duskWarn = 0; startNight(); }
  }
  if (G.step === 10) { night.prep -= dt; G.tod = lerp(.74, .8, 1 - night.prep / 75); if (night.prep <= 0) startNight(); }
  const s = todSample(G.tod);
  // rust tint — (Nov 10) the red fog stays outside the Arc: inside the hull (and its east wing) it clears, and the
  // ordinary haze thins too, so you can see from one end to the other
  hullFogK = lerp(hullFogK, inHull(P.x, P.z) ? 1 : 0, Math.min(1, dt * 4));
  const rk = rust.k * (1 - hullFogK);
  const fogC = s.fog.clone().lerp(_ca.set(0x7a3220), rk);
  scene.fog.color.copy(fogC);
  let far = VIEW_M ? Math.min(s.far, VIEW_M) : s.far;
  if (isNight() && Math.hypot(P.x, P.z) < CAMP_R + 30) far += UP.light * 45;
  scene.fog.far = lerp(far, 24, rk); scene.fog.near = packFogNear(lerp(Math.min(40, far * .05), 2, rk) + hullFogK * 60);
  skyU.fogC.value.copy(fogC); skyU.top.value.copy(s.top); skyU.hor.value.copy(s.hor).lerp(_ca.set(0x7a3220), rk * .8); skyU.sunCol.value.copy(s.sun); skyU.rust.value = rk * .7;
  const ang = (G.tod - .25) * Math.PI * 2, sd = new THREE.Vector3(Math.cos(ang) * .8, Math.sin(ang), .35).normalize();
  skyU.sunDir.value.copy(sd);
  const ld = sd.y > 0 ? sd : sd.clone().negate();
  sun.position.set(P.x + ld.x * 160, P.y + ld.y * 160, P.z + ld.z * 160); sun.target.position.set(P.x, P.y, P.z);
  sun.color.copy(s.sun); sun.intensity = s.sunI * (1 - rk * .6);
  hemi.intensity = s.hemiI * 1.45 * (1 - rk * .3); hemi.color.copy(s.top).lerp(_cb.set(0xcfd8dc), .5);
  xAfterLight();
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
  const nv = wearStat('nv') > 0, lt = bestTool('light');
  torch.intensity = nightK * (lt ? (GEAR_DEFS[lt.id].pw > 1 ? 4.2 : 3.2) : 2.6); if (lt && nightK > .5 && Math.random() < .016) wearTool(lt);
  campLight.intensity = nightK * (.35 + UP.light * .55);
  fireLight.intensity = 1.2 + nightK * 2 + Math.sin(G.t * 17) * .3;
  renderer.toneMappingExposure = 1.0 + nightK * (nv ? 2.2 : .4);
  for (const M0 of MIST) { M0.m.material.opacity = (.26 + Math.sin(G.t * .2 + M0.ph) * .06) * (1 - rk) * clamp(s.sunI, .25, 1); M0.m.material.color.copy(s.fog).lerp(_cb.set(0xffffff), .3); M0.m.position.x = M0.x + Math.sin(G.t * .03 + M0.ph) * 12; }
  if (relayLamp) relayLamp.visible = Math.sin(G.t * 2.4) > .2;
  if (waterMat) { texWaterN.offset.y -= dt * .02; texWaterN.offset.x += dt * .004; }
  if (windGain) windGain.gain.value = .04 + rk * .12;
  hud.rustv.style.opacity = rk > .4 && !P.safe ? 1 : rk * .6;
  if (vaultLamp) vaultLamp.visible = Math.sin(G.t * 3) > 0;
  if (AC && isNight() && !muted && !night.active) { cricketT -= .016; if (cricketT <= 0) { cricketT = rr(.3, 1.6); for (let i = 0; i < 3; i++) tone(rr(3800, 4600), .03, .025, 'sine', i * .06); } }
}

/* ================= HUD: health, toolbar, gun + ammo, minimap — that's it ================= */
let toolSig = '';
// toolbar: 1–2 guns, 3 melee/bow, 4 eat, 5 treat
function slotDefs() {
  const w = i => { const s = slotWeapon(i); if (!s) return { k: 'w' + i }; const ic = s.g ? icon(s.g.id) : icon(s.key === 'hunter' ? 'sniper' : 'assault'); return { k: 'w' + i + s.key, icon: ic, label: s.name, on: P.slot === i, dur: s.g ? s.g.d / s.g.max : null }; };
  return [w(0), w(1), w(2),
    { k: 'ration', icon: foodCount() > 0 ? icon('ration') : '', label: foodCount() > 0 ? 'Eat (picks what your diet is missing)' : '', n: foodCount() },
    { k: 'med', icon: medCount() > 0 ? icon('bandage') : '', label: medCount() > 0 ? 'Treat injuries' : '', n: medCount(), warn: P.bleed > 0 || P.frac > 0 || P.sick > 0 || P.dose > 20 }];
}
function renderTool() {
  const d = slotDefs(), sig = JSON.stringify(d.map(x => [x.k, x.icon && x.icon.length, x.on, x.n, x.warn, x.dur != null && Math.round(x.dur * 20)]));
  if (sig === toolSig) return; toolSig = sig;
  hud.tool.innerHTML = d.map((x, i) => `<div class="slot${x.on ? ' on' : ''}${x.icon ? '' : ' empty'}${x.warn ? ' warn' : ''}" data-i="${i}" title="${x.label || ''}"><em>${i + 1}</em>${x.icon || ''}${x.n ? `<b>${x.n}</b>` : ''}${x.dur != null ? `<u style="width:${Math.round(x.dur * 100)}%;background:${x.dur < .25 ? '#e0573d' : '#7fc4b8'}"></u>` : ''}</div>`).join('');
}
function useSlot(i) {
  if (G.mode !== 'play' || cine || P.dead) return;
  if (i <= 2) selectSlot(i);
  else if (i === 3) eatBest();
  else if (i === 4) healBest();
}
hud.tool.addEventListener('click', e => { const s0 = e.target.closest('.slot'); if (s0) useSlot(+s0.dataset.i); });
function updHUD(dt) {
  hud.hp.style.width = Math.max(0, P.hp) + '%';
  { const st = $('stam'); st.firstElementChild.style.width = P.stam + '%'; st.classList.toggle('on', P.stam < 99.5 && !P.fly); st.classList.toggle('low', !!P.winded); } if (isTouch) $('bRun').classList.toggle('lit', !!P.runToggle);
  hud.hpw.classList.toggle('hungry', P.food < 22);
  const w = curW();
  hud.mag.textContent = w.st.cls === 'melee' ? '—' : P.reload > 0 ? '··' : magOf(w); hud.res.textContent = w.st.ammo ? '/ ' + ammoLeft(w) : '';
  hud.gunn.textContent = w.name + (w.g ? ` · ${Math.round(w.g.d / w.g.max * 100)}%` : '');
  renderTool();
  let alert = '';
  if (rust.state === 'warn') alert = 'Get inside the Arc or mask up';
  else if (rust.state === 'active' && !P.safe && fogResist() < .95) alert = 'Red fog — get inside the Arc!';
  else if (night.active) alert = `${night.final ? 'NIGHT 100' : 'Hold Kestrel'} · wave ${night.wave}/${night.waves}`;
  else if (P.food <= 0) alert = 'Starving — eat something';
  else if (P.water <= 0) alert = 'Thirsty — drink water (4)';
  else if (P.bleed > 0) alert = 'Bleeding — bandage it (5)';
  else if (P.dose > 40) alert = 'Rust poisoning — Rust medicine (5)';
  else if (P.sick > 50) alert = 'Sick — a poultice will help (5)';
  hud.alert.textContent = alert; hud.alert.classList.toggle('on', !!alert); hud.alert.classList.toggle('rust', rust.state === 'warn' || rust.state === 'active');
  { const fc = fogCountdown(), el = $('fogc'); el.classList.toggle('on', !!fc); if (fc) { if (el.textContent !== fc.t) el.textContent = fc.t; el.className = 'on ' + fc.k; } }
  miniT -= dt; if (miniT <= 0) { miniT = .1; drawMini(); }
  if (invOpen) { invT -= dt; if (invT <= 0) { invT = .3; updInvBars(); if ((invTab === 'store' && storeAt && Math.hypot(storeAt.x - P.x, storeAt.z - P.z) > 5) || (invTab === 'trade' && !nearTrader())) { invTab = 'bag'; renderInv(); } } }
  updChan(dt); updStatus(dt); updLoad(dt);
  curInter = findInteract();
  if (curInter) {
    const bar = curInter.prog != null ? `<i class="pg"><i style="width:${Math.round(curInter.prog * 100)}%"></i></i>` : '';
    if (isTouch) { hud.use.style.display = 'grid'; hud.use.classList.remove('bag'); hud.use.innerHTML = curInter.l.replace(/ {2}· {2}hold: [a-z]+/, '') + (curInter.multi ? ` <small>(hold: ${/dismantle/.test(curInter.l) ? 'dismantle' : 'next'})</small>` : '') + bar; hud.prompt.style.display = 'none'; }
    else { hud.prompt.style.display = 'block'; hud.prompt.innerHTML = (curInter.prog != null ? '' : '<kbd>E</kbd>') + curInter.l + bar; }
  } else { hud.prompt.style.display = 'none'; if (isTouch) { hud.use.style.display = 'grid'; hud.use.classList.add('bag'); if (hud.use.textContent !== 'BAG') hud.use.textContent = 'BAG'; } else hud.use.style.display = 'none'; }
  hud.hurt.style.opacity = Math.max(0, (+hud.hurt.style.opacity || 0) - dt * 1.2);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) hud.toast.classList.remove('on'); }
  if (subT > 0) { subT -= dt; if (subT <= 0) nextLine(); }
}

/* ---------- the bag: Bag · Craft · Storage · Trade ---------- */
let invOpen = false, invT = 0;
function objectiveNow() {
  if (rust.state === 'warn' || rust.state === 'active') return 'Get inside the Arc until the fog lifts';
  if (night.active) return `Hold Kestrel · wave ${night.wave}/${night.waves}`;
  return objText();
}
let invTab = 'bag', craftCat = 'tool', craftOnly = false;
const BAG_ORDER = ['ammo', 'food', 'water', 'med', 'seed', 'build', 'wood', 'stone', 'fiber', 'animal', 'textile', 'metal', 'indus', 'elec', 'rare', 'doc', 'story'];
function itemTile(id, n, extra = '', attrs = '') { const I = ITEMS[id]; return `<div class="it"${attrs} title="${nameOf(id)}${I ? ' · ' + (SRC_N[I.src] || '') : ''}${LORE[id] ? ' — ' + LORE[id] : ''}">${icon(id)}<b>${n}</b><span>${nameOf(id)}</span>${extra}</div>`; }
function bagGroups() { const groups = {}; const all = { scrap: INV.scrap, meat: INV.meat, ration: INV.rations || 0, ammo_556: INV.res, ammo_762: INV.resH, ...INV.items }; for (const [id, n] of Object.entries(all)) { if (!(n > 0)) continue; (groups[ITEMS[id]?.c || 'indus'] ||= []).push([id, n]); } return groups; }
function gearTile(t, btns) {
  const D = GEAR_DEFS[t.id], f = t.d / t.max, eqi = INV.eq.indexOf(t.u), W = WDEF[t.id];
  const stat = D.kind === 'wear' ? [D.prot && `${Math.round(D.prot * 100)}% armor`, D.fog && `${Math.round(D.fog * 100)}% Rust`, D.cap && `+${D.cap} carry`, D.stealth && 'stealth', D.warm && 'warm', D.nv && 'night vision', D.gather && 'faster gathering'].filter(Boolean).join(' · ') : W ? (W.cls === 'melee' ? `${W.dmg} dmg melee` : `${W.dmg}${W.pellets ? '×' + W.pellets : ''} dmg · ${nameOf(W.ammo).toLowerCase()}`) : '';
  return `<div class="it gear${t.on || eqi >= 0 ? ' on' : ''}" title="${D.n}">${icon(t.id)}<span>${QUAL[t.q].n}${eqi >= 0 ? ` · slot ${eqi + 1}` : ''}${t.on ? ' · worn' : ''}</span><span class="nm">${D.n}</span><div class="dur"><i style="width:${Math.round(f * 100)}%;background:${f < .25 ? '#e0573d' : '#7fc4b8'}"></i></div><small>${t.d}/${t.max}${stat ? ' · ' + stat : ''}</small>${btns}</div>`;
}
function renderInv() {
  const hh = Math.floor((G.tod * 24 + 24) % 24), mm = Math.floor((G.tod * 24 * 60) % 60 / 15) * 15;
  const T = [['bag', 'Bag'], ['craft', 'Craft'], ['journal', 'Journal'], ['factions', 'Factions']]; if (storeAt && Math.hypot(storeAt.x - P.x, storeAt.z - P.z) < 5) T.push(['store', nameOf(storeAt.k)]); if (nearTrader()) T.push(['trade', 'Trade']);
  if (!T.some(t => t[0] === invTab)) invTab = 'bag';
  const tabs = `<div class="tabs">${T.map(([k, n]) => `<button data-tab="${k}" class="${invTab === k ? 'on' : ''}">${n}</button>`).join('')}<button data-gfx="1" title="Settings">Settings</button><button class="xb" data-x="1">✕</button></div>`;
  const tags = statusTags().map(([t, c]) => `<span class="tag" style="--c:${c}">${t}</span>`).join('');
  const load = carryLoad(), cap = carryCap();
  const head = `<div class="stat"><span>Health</span><div class="bar"><i id="ivhp" style="width:${Math.max(0, P.hp)}%;background:#d9503a"></i></div><span>Food</span><div class="bar"><i id="ivfd" style="width:${P.food}%;background:#e0a040"></i></div><span>Water</span><div class="bar"><i id="ivwt" style="width:${P.water ?? 100}%;background:#5aa8d8"></i></div><span>Load</span><div class="bar"><i style="width:${Math.min(100, load / cap * 100)}%;background:${load > cap ? '#e0573d' : '#7fc4b8'}"></i></div></div>${tags ? `<div class="tags">${tags}</div>` : ''}`;
  let body = '';
  if (invTab === 'bag') {
    const groups = bagGroups();
    const act = id => FOOD[id] ? `<button data-eat="${id}">${FOOD[id].k === 'water' ? 'Drink' : 'Eat'}</button>` : MEDS[id] ? `<button data-med="${id}">Use</button>` : BUILD_DEF[id] ? `<button data-place="${id}">Place</button>` : THROWS.includes(id) ? `<button data-thr="${id}">${P.thr === id ? 'Ready ✓' : 'Ready (G)'}</button>` : '';
    for (const c of BAG_ORDER) if (groups[c]) body += `<h4>${CAT_N[c]}</h4><div class="row">${groups[c].map(([id, n]) => itemTile(id, n, act(id))).join('')}</div>`;
    const sorted = [...INV.tools].sort((a, b) => (WDEF[b.id] ? 2 : GEAR_DEFS[b.id].kind === 'wear' ? 1 : 0) - (WDEF[a.id] ? 2 : GEAR_DEFS[a.id].kind === 'wear' ? 1 : 0));
    if (sorted.length) body += `<h4>Weapons, tools & gear · ${INV.tools.length}${needsRepair().length ? ` <button data-fixall="1">Repair all · ${needsRepair().length}</button>` : ''}</h4><div class="row">${sorted.map(t => { const D = GEAR_DEFS[t.id], W = WDEF[t.id], b = [];
      if (D.kind === 'wear') b.push(`<button data-wear="${t.u}">${t.on ? 'Take off' : 'Wear'}</button>`);
      if (W && W.cls === 'gun') b.push(`<button data-eq="${t.u}" data-slot="0">Slot 1</button><button data-eq="${t.u}" data-slot="1">Slot 2</button>`);
      else if (W) b.push(`<button data-eq="${t.u}" data-slot="2">Slot 3</button>`);
      { const rl = repairLabel(t); if (rl) b.push(`<button data-fix="${t.u}">${rl}</button>`); }
      return gearTile(t, b.join('')); }).join('')}</div>`;
    body += `<p class="dim">Slots: 1 ${slotWeapon(0)?.name || '—'} · 2 ${slotWeapon(1)?.name || '—'} · 3 ${slotWeapon(2)?.name || '—'}${INV.eq[0] !== 'arc' && INV.eq[1] !== 'arc' ? ' · <button data-arc="1">Arc rifle → slot 1</button>' : ''}${INV.eq[0] !== 'hunter' && INV.eq[1] !== 'hunter' ? ' <button data-hunt="1">Hunting rifle → slot 2</button>' : ''}</p>`;
    if (!Object.keys(groups).length && !INV.tools.length) body += '<p class="dim">Empty. Gather sticks from trees, stones from rocks and fiber from the undergrowth outside the wall.</p>';
    body += `<p class="obj">◆ ${objectiveNow() || 'Explore'}</p><p class="day">Tier ${tierNow()} · ${TIERS[tierNow()]} · Day ${G.day} of 100 · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${exploredPct()}% explored</p>`;
  } else if (invTab === 'craft') {
    body += `<div class="ctabs">${RCATS.map(([k, n]) => `<button data-cat="${k}" class="${craftCat === k ? 'on' : ''}">${n}</button>`).join('')}<button data-only="1" class="${craftOnly ? 'on' : ''}">Can make</button></div>`;
    const near = Object.keys(STATION_N).filter(nearStation).map(k => STATION_N[k]);
    body += `<p class="dim">${near.length ? `At: ${near.join(', ')}` : 'Not at a station — fire, bench, forge, rack and lab recipes need you standing at one.'} · Tier ${tierNow()}${tierNow() < 6 ? ` · next: ${TIER_HOW[tierNow() + 1]}` : ''}</p><div class="recs">`;
    let list = RECIPES.filter(r => r.cat === craftCat);
    if (craftOnly) list = list.filter(r => recipeState(r).ok);
    list.sort((a, b) => (tierOpen(b.t) - tierOpen(a.t)) || a.t - b.t);
    for (const r of list) {
      const st = recipeState(r), locked = !st.open;
      const ing = st.ins.map(([k, n]) => `<span class="${cnt(k) >= n ? 'ok' : 'no'}">${k === 'veg' ? 'vegetables' : nameOf(k).toLowerCase()} ${Math.min(cnt(k), n)}/${n}</span>`).join('');
      const tn = { weld: 'welding kit', driver: 'screwdriver', saw: 'saw', pry: 'crowbar' }[r.tool] || r.tool;
      const req = [r.at && `<span class="${st.stOK ? 'ok' : 'no'}">@ ${STATION_N[r.at].toLowerCase()}</span>`, r.tool && `<span class="${st.toolOK ? 'ok' : 'no'}">needs ${tn}</span>`].filter(Boolean).join('');
      const D = GEAR_DEFS[r.o], W = WDEF[r.o], what = D ? (D.kind === 'wear' ? [D.prot && `${Math.round(D.prot * 100)}% armor`, D.fog && `${Math.round(D.fog * 100)}% Rust`, D.cap && `+${D.cap} carry`].filter(Boolean).join(' · ') || 'wear' : W ? `${W.dmg} dmg · ${D.dur} uses` : `${D.dur} uses`) : BUILD_DEF[r.o] ? 'placeable' : '';
      body += `<div class="rec${st.ok ? ' can' : ''}${locked ? ' lock' : ''}">${icon(r.o)}<div class="rt"><b>${nameOf(r.o)}${r.n > 1 ? ` ×${r.n}` : ''}</b>${what ? `<em>${what}</em>` : ''}<div class="ing">${ing}${req}</div></div>${locked ? `<small>Tier ${r.t} · ${TIERS[r.t]}</small>` : `<div class="cb"><button data-craft="${RECIPES.indexOf(r)}"${st.ok ? '' : ' class="dis"'}>Craft</button>${st.ok && !GEAR_DEFS[r.o] ? `<button data-craft5="${RECIPES.indexOf(r)}">×5</button>` : ''}</div>`}</div>`;
    }
    if (!list.length) body += '<p class="dim">Nothing you can make here right now.</p>';
    body += '</div>';
  } else if (invTab === 'store') {
    const p = storeAt, B = BUILD_DEF[p.k], groups = bagGroups();
    body += `<p class="dim">${nameOf(p.k)} · ${storeUsed(p)}/${B.store} slots · tap to move one, shift-tap (or ×all) to move the stack</p><div class="two"><div><h4>Your bag</h4><div class="row">`;
    for (const c of BAG_ORDER) for (const [id, n] of groups[c] || []) body += itemTile(id, n, `<button data-put="${id}">→</button><button data-putall="${id}">×all</button>`);
    for (const t of INV.tools) if (!busy(t)) body += gearTile(t, `<button data-putg="${t.u}">→</button>`);
    body += `</div></div><div><h4>Stored</h4><div class="row">`;
    for (const [id, n] of Object.entries(p.rec.inv)) body += itemTile(id, n, `<button data-take="${id}">←</button><button data-takeall="${id}">×all</button>`);
    for (const t of p.rec.gear) body += gearTile(t, `<button data-takeg="${t.u}">←</button>`);
    body += '</div></div></div>';
  } else if (invTab === 'factions') {
    body += factionsHTML();
  } else if (invTab === 'journal') {
    body += journalHTML();
  } else if (invTab === 'trade') {
    const L = tradeStock(), groups = bagGroups();
    const SD = shopDef(), mk = SD.mark;
    body += `<p class="dim">${SD.blurb} You have <b>${INV.scrap}</b> scrap. Stock changes every day${SD.tiered ? ' · better gear shows up as you climb the tiers' : ''}.</p><h4>Buy</h4><div class="row">`;
    L.forEach(([id, n, left], i) => { const pr = Math.ceil(valueOf(id) * n * mk); body += itemTile(id, n, `<button data-buy="${i}"${left > 0 && INV.scrap >= pr ? '' : ' class="dis"'}>${left > 0 ? pr + ' scrap' : 'sold out'}</button>`); });
    body += `</div><h4>Sell</h4><div class="row">`;
    for (const c of BAG_ORDER) for (const [id, n] of groups[c] || []) if (id !== 'scrap' && ITEMS[id]?.c !== 'story') { const lot = Math.min(n, TRADE_LOT[id] || 1); body += itemTile(id, n, `<button data-sell="${id}">+${Math.max(1, Math.floor(valueOf(id) * lot * (SD.sell || .5)))}${lot > 1 ? ' /' + lot : ''}</button>`); }
    for (const t of INV.tools) if (!busy(t)) body += gearTile(t, `<button data-sellg="${t.u}">+${Math.max(2, Math.round(valueOf(t.id) * (SD.sell || .5) * t.d / t.max))}</button>`);
    body += '</div>';
  }
  $('invb').innerHTML = tabs + head + body;
}
function updInvBars() { const a = $('ivhp'), b = $('ivfd'); if (a) a.style.width = Math.max(0, P.hp) + '%'; if (b) b.style.width = P.food + '%'; const c = $('ivwt'); if (c) c.style.width = (P.water ?? 100) + '%'; }
function openCraft(cat) { invTab = 'craft'; if (cat) craftCat = cat; toggleInv(true); }
function toggleInv(v = !invOpen) {
  if (v && mapOpen) toggleMap();
  invOpen = v; $('inv').classList.toggle('on', v); if (v) { renderInv(); if (document.pointerLockElement) document.exitPointerLock(); }
}
$('inv').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.gfx) { toggleInv(false); openGfx(); return; }
  if (!b) { if (!e.target.closest('#invp')) toggleInv(false); return; }
  e.stopPropagation(); const d = b.dataset, g = u => INV.tools.find(t => t.u === +u);
  if (d.x) return toggleInv(false);
  if (d.tab) invTab = d.tab;
  else if (d.cat) craftCat = d.cat;
  else if (d.log) { toggleInv(false); openLog(d.log); return; }
  else if (d.fa) facAction(d);
  else if (d.only) craftOnly = !craftOnly;
  else if (d.craft) return craft(RECIPES[+d.craft], e.shiftKey ? 5 : 1);
  else if (d.craft5) return craft(RECIPES[+d.craft5], 5);
  else if (d.eat) eatItem(d.eat);
  else if (d.med) useMed(d.med);
  else if (d.place) { toggleInv(false); placeKit(d.place); return; }
  else if (d.thr) { P.thr = P.thr === d.thr ? null : d.thr; }
  else if (d.wear) { toggleWear(g(d.wear)); save(); }
  else if (d.eq) equipTo(g(d.eq), +d.slot);
  else if (d.arc) { INV.eq[0] = 'arc'; if (P.slot === 0) selectGunView(gunId()); }
  else if (d.hunt) { INV.eq[1] = 'hunter'; G.flags.hunter = 1; if (P.slot === 1) selectGunView(gunId()); }
  else if (d.fix) repairGear(g(d.fix));
  else if (d.fixall) repairAll();
  else if (d.put || d.putall) storePut(d.put || d.putall, !!d.putall || e.shiftKey);
  else if (d.take || d.takeall) storeTake(d.take || d.takeall, !!d.takeall || e.shiftKey);
  else if (d.putg) storePut(+d.putg); else if (d.takeg) storeTake(+d.takeg);
  else if (d.buy) buyTrade(+d.buy); else if (d.sell) sellTrade(d.sell); else if (d.sellg) sellTrade(null, g(d.sellg));
  renderInv();
});
/* ---------- pause (Nov 10, Bryce): the button top-left (or Esc / P) stops the game; the main menu lives in here ---------- */
let paused = false, pauseAt = 0;
function setPause(v) {
  if (v === paused || G.mode !== 'play') return;
  if (v && (P.dead || cine)) return;
  paused = v; pauseAt = performance.now(); $('pause').classList.toggle('on', v);
  input.fire = false; input.ads = false; input.mx = input.my = 0; for (const k in keys) keys[k] = false;
  if (v) {
    if (invOpen) toggleInv(false); if (mapOpen) toggleMap(); if (shopOpen) closeShop();
    $('pinfo').textContent = `Day ${G.day} · Tier ${tierNow()}` + (fogCountdown() ? ' · ' + fogCountdown().t.toLowerCase().replace(/^red fog/, 'red fog') : '');
    $('pSnd').textContent = `Sound: ${muted ? 'off' : 'on'}`;
    $('pkeys').textContent = isTouch ? 'Left thumb: move · right thumb: look · USE does what’s in front of you, or opens your bag · AIM zooms (ZOOM on a sniper scope) · tap the minimap for the map.'
      : 'WASD move · Shift sprint · mouse look · click fire · right-click aim (Z: 4x / 7x on a sniper) · R reload · 1–5 toolbar · E use, or open your bag · Q swap · G throw · M map · N sound · Esc / P pause';
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (!isTouch) canvas.requestPointerLock?.();
}
$('bPause').addEventListener('click', e => { e.stopPropagation(); setPause(true); });
$('pRes').addEventListener('click', e => { e.stopPropagation(); setPause(false); });
$('pMap').addEventListener('click', e => { e.stopPropagation(); setPause(false); if (document.pointerLockElement) document.exitPointerLock(); toggleMap(); });
$('pSnd').addEventListener('click', e => { e.stopPropagation(); setMute(!muted); $('pSnd').textContent = `Sound: ${muted ? 'off' : 'on'}`; });
$('pGfx').addEventListener('click', e => { e.stopPropagation(); openGfx(); });
$('pMenu').addEventListener('click', e => { e.stopPropagation(); save(); location.reload(); });   // saved: Continue on the title picks up right here
$('pause').addEventListener('click', e => { if (e.target.id === 'pause') setPause(false); });
$('pause').addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
// Esc on a PC drops the mouse lock before the page sees the key: losing the lock mid-play (nothing else open) pauses
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.mode === 'play' && !paused && !gfxOpen && !invOpen && !mapOpen && !shopOpen && !P.dead && !cine && !isTouch) setPause(true); });
$('mini').addEventListener('click', e => { e.stopPropagation(); toggleMap(); });
if (isTouch) document.body.classList.add('touch');

/* ================= input ================= */
// audio unlocks on the events browsers actually count as a tap (touchend / pointerup / click / key), anywhere on the page
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) addEventListener(ev, () => initAudio(), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) { music.pauseAll(); AC.suspend().catch(() => {}); }
  else { AC.resume().catch(() => {}); music.resume(); }
});
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; initAudio();
  if (G.mode !== 'play') return;
  if (paused) { if ((e.code === 'Escape' || e.code === 'KeyP') && performance.now() - pauseAt > 300) setPause(false); return; }
  if (e.code === 'KeyP' && !cine) { setPause(true); return; }
  if (cine && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { skipCine(); return; }
  if (e.code === 'KeyE' && !e.repeat) { if (shopOpen) closeShop(); else useInteract(); }
  if (e.code === 'KeyR') reload();
  if (e.code === 'Space') input.jump = true;
  if (e.code === 'KeyN') setMute(!muted);
  if (e.code === 'KeyO') { if (gfxOpen) closeGfx(); else openGfx(); }
  if (e.code === 'KeyM') { if (invOpen) toggleInv(false); toggleMap(); }
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); toggleInv(); }
  if (e.code === 'KeyQ') { if (curInter && curInter.multi && curInter.next) curInter.next(); else swapGun(); }
  if (e.code === 'KeyG') throwNext();
  if (e.code === 'KeyZ') scopeZoom();
  if (e.code === 'KeyB') { if (has('binoc')) { P.binoc = !P.binoc; toast(P.binoc ? 'Binoculars' : 'Binoculars away', 1); } }
  const dg = /^Digit([1-5])$/.exec(e.code); if (dg) useSlot(+dg[1] - 1);
  if (e.code === 'Escape') { if (gfxOpen || shopOpen || invOpen || mapOpen) { if (gfxOpen) closeGfx(); if (shopOpen) closeShop(); if (invOpen) toggleInv(false); if (mapOpen) toggleMap(); } else if (performance.now() - pauseAt > 300) setPause(true); }
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
addEventListener('wheel', e => { if (G.mode === 'play' && document.pointerLockElement && Math.abs(e.deltaY) > 4) swapGun(); }, { passive: true });
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
    if (el && el.closest('#hp')) { e.preventDefault(); secretTap(); continue; }
    if (el && el.closest('#bFly')) { e.preventDefault(); if (G.flags.dev) toggleFly(); continue; }
    if (el && el.closest('.slot')) { e.preventDefault(); useSlot(+el.closest('.slot').dataset.i); continue; }
    if (el && el.closest('#mini')) { e.preventDefault(); toggleMap(); continue; }
    if (el && el.closest('#bPause')) { e.preventDefault(); setPause(true); continue; }
    if (el && el.closest('#bZoom')) { e.preventDefault(); scopeZoom(); continue; }
    const btn = el && el.closest('.btn');
    if (btn) {
      btn.classList.add('on');
      if (btn.id === 'bFire') { input.fire = true; touches.set(t.identifier, { kind: 'fire', x: t.clientX, y: t.clientY, btn }); }
      else { touches.set(t.identifier, { kind: 'btn', btn }); if (btn.id === 'bJump') { input.jump = true; touchUp = true; } if (btn.id === 'bRel') reload(); if (btn.id === 'bThrow') throwNext(); if (btn.id === 'bUse') { if (curInter && curInter.multi) touches.get(t.identifier).useT = performance.now(); else useInteract(); }
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
    if (s.btn) { s.btn.classList.remove('on'); if (s.btn.id === 'bJump') touchUp = false; if (s.useT) { if (performance.now() - s.useT > 450) curInter?.next?.(); else useInteract(); } }
    touches.delete(t.identifier);
  }
}
for (const el of [canvas, $('touch')]) { el.addEventListener('touchstart', tStart, { passive: false }); el.addEventListener('touchmove', tMove, { passive: false }); el.addEventListener('touchend', tEnd); el.addEventListener('touchcancel', tEnd); }
document.addEventListener('touchmove', e => { if (G.mode === 'play' && !e.target.closest('#shop') && !e.target.closest('#invp')) e.preventDefault(); }, { passive: false });
for (const id of ['inv', 'map']) $(id).addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });

/* ================= save ================= */
const SAVE = 'the-arc-save-v2';
function save() {
  if (G.mode !== 'play') return;
  try { localStorage.setItem(SAVE, JSON.stringify({ v: 3, step: G.step, day: G.day, tod: G.tod, chapterDone: true, flags: G.flags, inv: INV, up: UP, hp: P.hp, food: P.food, p: { diet: P.diet, bleed: P.bleed, frac: P.frac, sick: P.sick, dose: P.dose } })); } catch (e) {}
  wxSave();
}
function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }

/* ================= main loop ================= */
let last = performance.now(), saveT = 0, titleT = 0, regionT = 1;
/* adaptive resolution: if the frame rate sags, render fewer pixels (down to a floor) until it holds; creep back up when
   there's headroom. Fill rate (bloom, grade, shadows, PBR people) is what lags first on most screens. */
const PR_MAX = Math.min(devicePixelRatio || 1, LOW ? 1.35 : 1.75), PR_MIN = Math.min(PR_MAX, LOW ? .75 : .9);
let prNow = PR_MAX, prT = 0, prN = 0, prHold = 0;
function adaptRes(raw) {
  if (G.mode !== 'play' || document.hidden || raw <= 0 || raw > .5) return;
  prT += raw; prN++; prHold -= raw; if (prT < 1.5) return;
  const fps = prN / prT; prT = 0; prN = 0; let n = prNow;
  // quality ladder: resolution first; at the floor and still slow, drop bloom (a dozen small passes); bloom comes back first
  if (fps < 48) { if (prNow <= PR_MIN + .01 && fps < 42 && bloom.enabled) { bloom.enabled = false; prHold = 20; } n = Math.max(PR_MIN, prNow - .15); prHold = 20; }
  else if (fps > 58 && prHold <= 0) { if (!bloom.enabled) { bloom.enabled = true; prHold = 8; return; } n = Math.min(PR_MAX, prNow + .1); }
  if (Math.abs(n - prNow) > .01) { prNow = n; renderer.setPixelRatio(n); resize(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  adaptRes((now - last) / 1000);
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (paused) { composer.render(0); return; }
  G.t += dt;
  for (const f of DECOR_ANIM) f(G.t);
  updHouseLights();
  for (const s of SCRAPS) if (s.alive) { s.glint.rotation.y += dt * 2; s.glint.position.y = .55 + Math.sin(G.t * 3 + s.ph) * .1; s.glint.visible = Math.sin(G.t * 4 + s.ph) > -.2; }
  for (const p of beaconSmoke) { p.userData.k = (p.userData.k + dt * .08) % 1; const k = p.userData.k; p.position.set(POI.pod.x + Math.sin(k * 9) * k * 2, heightAt(POI.pod.x, POI.pod.z) + 2 + k * 26, POI.pod.z + k * 4); p.scale.setScalar(1 + k * 3); p.material.opacity = .4 * (1 - k); p.visible = false; }
  // gate swing
  const gTarget = gate.hp <= 0 ? .3 : gate.open ? 1 : 0;
  gate.ang = lerp(gate.ang, gTarget, dt * 2.5);
  for (const d of gateDoors) { d.pivot.rotation.y = d.s * gate.ang * 1.65; d.door.rotation.z = gate.hp <= 0 ? d.s * .4 : 0; }
  updHullDoor(dt);

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
    updCull(dt);
    if (mapOpen) drawMap();
    for (const e of [...ents]) {
      const d = Math.hypot(e.x - P.x, e.z - P.z); e.g.visible = d < clamp(scene.fog.far * .45, 140, 320);
      if (e.p && e.p.lo) { const near = d < (e.p.near ? 27 : 23); if (near !== e.p.near) { e.p.near = near; e.p.hi.visible = near; e.p.lo.visible = !near; } }
      if (d > 260 && e.type !== 'clan') continue;
      if (e.type === 'clan' && d > 300 && e.mode !== 'raid' && e.state === 'idle') continue;
      if (e.type === 'clan') updClan(e, dt); else if (e.type === 'npc') updNPC(e, dt); else updAnimal(e, dt);
    }
    updPets(dt); updTowers(dt); updSpears(dt); updProj(dt); updPlaced(dt); updFarGroups(P.x, P.z); updCity(dt);
    if (night.active) updNight(dt);
    updRust(dt); updTime(dt); updWeather(dt); cityAfterWeather(); updXplore(dt); updFactions(dt); updHUD(dt);
    // scrap pickup
    for (const s of SCRAPS) if (s.alive && Math.hypot(s.x - P.x, s.z - P.z) < 1.9 && !P.dead) {
      s.alive = false; s.g.visible = false; INV.scrap++; sfx('pickup');
      { const x = rnd() < .2 ? pick(['nails', 'screws', 'wire', 'nails']) : null; if (x) give(x, 1 + Math.floor(rnd() * 2)); toast(x ? `+1 scrap · +${nameOf(x).toLowerCase()}` : '+1 scrap', 1.3); }
      if (G.step === 2 && s.tag === 'field') { G.flags.fieldScrap = (G.flags.fieldScrap || 0) + 1; if (G.flags.fieldScrap >= 5) { setStep(3); say([['Radio', "Kade here — that's enough. Bring it to the bench."]]); } }
    }
    saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  }
  updParts(dt); updTracers(dt); updLightPool();
  grade.uniforms.t.value = G.t;
  composer.render(dt);
}

/* light pool: the world has a dozen point lights (camp fire, hull lamp, village fires, placed lamps, muzzle flash…) and
   three.js makes every lit pixel loop over all of them, near or not — the biggest per-pixel cost on phones. They stay in
   the scene graph (so the code that flickers/moves them keeps working) but invisible, and each frame the few real
   lights below copy the ones that actually reach the camera. The light count never changes, so no shader recompiles. */
const LPOOL = [], LSRC = [], _lv = new THREE.Vector3();
function buildLightPool() {
  scene.traverse(o => { if (o.isPointLight) LSRC.push(o); });
  for (const l of LSRC) l.visible = false;
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 0); scene.add(l); LPOOL.push(l); }
}
function updLightPool() {
  const cx = camera.position.x, cz = camera.position.z, pick3 = [];
  for (const l of LSRC) {
    if (!(l.intensity > 0)) continue;
    // what matters is how close the lit patch (the light's reach) comes to the camera, not the light itself:
    // a fire 40 m off still visibly lights the ground around it
    l.getWorldPosition(_lv); const reach = l.distance || 300, d = Math.hypot(_lv.x - cx, _lv.z - cz) - reach;
    if (d > 70) continue;
    pick3.push({ l, k: l === flashLight ? -1e9 : d - l.intensity * 2, x: _lv.x, y: _lv.y, z: _lv.z });
  }
  pick3.sort((a, b) => a.k - b.k);
  LPOOL.forEach((P, i) => { const s = pick3[i]; if (!s) { P.intensity = 0; return; }
    P.color.copy(s.l.color); P.intensity = s.l.intensity; P.distance = s.l.distance; P.decay = s.l.decay; P.position.set(s.x, s.y, s.z); });
}

/* ================= regions + the valley map ================= */
/* distance culling for the hand-placed world: thousands of small props (crates, debris, fences, shop bits) each cost a draw
   call — twice with the sun's shadow — even when they're a few pixels on the horizon. Each prop group gets a draw distance
   from its size (small things fade out first, never past the haze); hidden ones go to layer 1, which neither the camera nor
   the shadow pass draws. Terrain, the forest, people and animals have their own streaming/culling. */
/* static bake: the settlement, towns and camps are built from thousands of little boxes and cylinders, each its own draw
   call (twice with shadows). Inside each top-level group, meshes that share a look (same material settings, same shadow
   flags, same ~30 m cell) are merged into one. Anything that moves, hides, flickers or gets rebuilt is left alone:
   doors, tower guns/lamps, crates, caches, scrap, the smokehouse, placed buildings, flames/glows (basic or transparent). */
const _bkm = new THREE.Matrix4(), _bkv = new THREE.Vector3(), MAT_BAKE = new Map();
const matSig = m => [m.type, m.color && m.color.getHex(), m.map && m.map.uuid, m.normalMap && m.normalMap.uuid, m.normalScale && m.normalScale.x, m.emissive && m.emissive.getHex(), m.emissiveMap && m.emissiveMap.uuid,
  m.emissiveIntensity, m.flatShading, m.side, m.vertexColors, m.roughness, m.metalness, m.roughnessMap && m.roughnessMap.uuid, m.metalnessMap && m.metalnessMap.uuid, m.aoMap && m.aoMap.uuid,
  m.envMapIntensity, m.fog, m.toneMapped, m.polygonOffset, m.wireframe].join('|');
function bakeable(o) {
  const m = o.material, g = o.geometry;
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.children.length || !o.visible || o.layers.mask !== 1 || o.renderOrder || !o.frustumCulled) return false;
  if (Array.isArray(m) || !m.visible || m.transparent || m.alphaTest > 0 || m.isMeshBasicMaterial || m.isShaderMaterial || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return false;
  if (!g.attributes.position || !g.attributes.normal || g.morphAttributes.position || Object.keys(o.userData).length) return false;
  return true;
}
function bakeGroup(root, dyn, cellSize = 30) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map();
  (function walk(o) {
    if (dyn.has(o) || !o.visible) return;
    if (o !== root && bakeable(o)) {
      _bkm.multiplyMatrices(inv, o.matrixWorld); if (_bkm.determinant() <= 0) return;
      o.getWorldPosition(_bkv);
      const names = Object.keys(o.geometry.attributes).filter(n => ['position', 'normal', 'uv', 'color'].includes(n)).sort();
      const key = [matSig(o.material), names.join(','), o.castShadow, o.receiveShadow, Math.floor(_bkv.x / cellSize), Math.floor(_bkv.z / cellSize)].join('#');
      let B = buckets.get(key); if (!B) buckets.set(key, B = { mat: o.material, names, list: [] });
      B.list.push({ o, m: _bkm.clone() }); return;
    }
    for (const c of o.children) walk(c);
  })(root);
  let saved = 0;
  for (const B of buckets.values()) {
    if (B.list.length < 2) continue;
    const geos = B.list.map(({ o, m }) => {
      const src = o.geometry, g = new THREE.BufferGeometry();
      for (const n of B.names) { const a = src.attributes[n], f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
        g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); }
      if (src.index) g.setIndex(Array.from(src.index.array)); else g.setIndex([...Array(src.attributes.position.count).keys()]);
      if (src.groups.length) { const gr = src.groups[0]; if (src.groups.length === 1) g.setDrawRange(gr.start, gr.count); }
      g.applyMatrix4(m); return g;
    });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const k = matSig(B.mat); if (!MAT_BAKE.has(k)) MAT_BAKE.set(k, B.mat);
    const mm = new THREE.Mesh(merged, MAT_BAKE.get(k)); mm.castShadow = B.list[0].o.castShadow; mm.receiveShadow = B.list[0].o.receiveShadow;
    root.add(mm);
    for (const { o } of B.list) o.parent.remove(o);
    saved += B.list.length - 1;
  }
  return saved;
}
function bakeDyn() {
  const d = new Set([...ents.map(e => e.g), ...CHUNKS.values(), ...OCELLS.values(), smokeGroup, ...beaconSmoke, ...SCRAPS.map(s => s.g), ...CRATES.map(c => c.g), ...CACHES.map(c => c.g),
    ...gateDoors.flatMap(g => [g.pivot, g.door]), ...hullDoors.map(h => h.g), ...towers.flatMap(T => [T.gun, T.lamp]), ...PLACED.map(p => p.g), ...PETS.map(e => e.g), ...DUCKS.map(D => D.g)]);
  d.delete(undefined); d.delete(null); return d;
}
function bakeWorld() {
  const dyn = bakeDyn(); let saved = 0;
  for (const o of [...world.children]) if (!dyn.has(o) && o.isGroup) saved += bakeGroup(o, dyn);
  // loose meshes added straight to the world (barrels, rubble, debris): gather them per 40 m cell into one group each
  const loose = new Map();
  for (const o of [...world.children]) if (!dyn.has(o) && bakeable(o)) { const k = Math.floor(o.position.x / 40) + ',' + Math.floor(o.position.z / 40); if (!loose.has(k)) loose.set(k, []); loose.get(k).push(o); }
  for (const L of loose.values()) { if (L.length < 3) continue; const g = new THREE.Group(); world.add(g); for (const o of L) g.attach(o); saved += bakeGroup(g, dyn, 40); }
  console.log('bake: merged away', saved, 'meshes');
}

const CULL = []; let cullT = 0;
function buildCull() {
  const skip = new Set([...CHUNKS.values(), ...OCELLS.values(), ...ents.map(e => e.g), ...PETS.map(e => e.g), ...DUCKS.map(D => D.g)]);
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  for (const o of world.children) {
    if (skip.has(o) || o.isSprite) continue;
    let inst = false; const meshes = [];
    o.traverse(c => { if (c.isInstancedMesh) inst = true; else if (c.isMesh || c.isLine || c.isPoints) meshes.push(c); });
    if (inst || !meshes.length) continue;
    box.setFromObject(o); if (box.isEmpty()) continue; box.getBoundingSphere(sph);
    if (sph.radius > 90) continue;
    if (sph.radius < 1.5) for (const m of meshes) m.castShadow = false;   // pebbles, scrap and crates: their shadows cost a draw each and read as nothing
    CULL.push({ x: sph.center.x, z: sph.center.z, r: sph.radius, meshes, on: true });
  }
}
function updCull(dt) {
  cullT -= dt; if (cullT > 0) return; cullT = .2;
  const cx = camera.position.x, cz = camera.position.z, hz = scene.fog.far * 1.25;
  for (const c of CULL) {
    const on = Math.hypot(c.x - cx, c.z - cz) - c.r < Math.min(70 + c.r * 40, hz + c.r * 2, VIEW_M ? VIEW_M + c.r : 750);
    if (on !== c.on) { c.on = on; for (const m of c.meshes) m.layers.mask = on ? 1 : 2; }
  }
}
const DROP_WAKE = (() => { const a = Math.atan2(-POI.dropsite.z, -POI.dropsite.x); return [-Math.cos(a) * 27 - Math.sin(a) * 3, -Math.sin(a) * 27 + Math.cos(a) * 3]; })();   // where you come to: in the furrow, looking into the torn end
function checkRegions() {
  if (UG.at) return;
  const seen = G.flags.seen = G.flags.seen || {};
  if (!G.flags.reached && Math.hypot(P.x, P.z) < CAMP_R + 10) {
    G.flags.reached = 1; G.flags.firstRustT = 45; save();
    say([['Kade', 'You made it. We’ve got a wall, a fire and not much else.'], ['Kade', 'The shops are open — trade, craft, eat. I’ll be at the bench.'], ['Juno', 'Come see me when you get hurt. You will.']]);
  }
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
function regionColor(R) { return R.id === 'kestrel' ? '#f0a640' : R.friend ? '#7fc4b8' : R.hostile ? '#e0573d' : '#efe9dc'; }
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
  drawXMarks(g, S, k);
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
  Object.assign(UP, { wall: 0, gate: 0, tur: 0, light: 0, rifle: 0, smoke: 0 });
  Object.assign(INV, { scrap: 0, meat: 0, rations: 0, mags: { carbine: 20, battle: 25, hunter: 5 }, res: 60, resH: 15, items: { cloth: 3, bandage: 1, canned: 2, water_boiled: 2 }, tools: [], eq: null, uid: 1 });
  clearInjuries(); P.diet = []; P.fed = 0; P.immune = 0; P.paint = 0; chan = null; lastTool = null; RDEPL.clear();
  G.step = 13; G.day = 1; G.tod = .3; G.chapterDone = true; G.flags = { tier: 1, hunter: 1 };
  if (s) {
    Object.assign(UP, s.up); Object.assign(INV, s.inv); G.day = s.day; G.flags = s.flags || {}; P.hp = s.hp ?? 100; P.food = s.food ?? 100;
    G.tod = clamp(s.tod ?? .3, .26, .7); G.flags.hunter = 1; G.flags.tier = G.flags.tier || 1;
    if (!INV.mags || typeof INV.mags !== 'object') INV.mags = { carbine: 20, battle: 25, hunter: 5 };
    if (s.p) { P.diet = s.p.diet || []; P.bleed = s.p.bleed || 0; P.frac = s.p.frac || 0; P.sick = s.p.sick || 0; P.dose = s.p.dose || 0; }
  }
  wxLoad(s);         // (Part 3) weather + food buffs, and stretches old saves' gear to the new durability — 1k-weather.js
  G.step = 13; G.chapterDone = true;
  G.flags.seen = G.flags.seen || {}; if (s && G.flags.reached == null) G.flags.reached = 1;   // saves from before the dropsite start already know Kestrel
  if (G.flags.reached) G.flags.seen.kestrel = 1; INV.rations = INV.rations || 0;
  invInit(); eqInit(); restorePlaced(); showBag(); xRestore(); facRestore(); gHinted = !!G.flags.craftHint;
  for (const k in TIER_KEYS) if (cnt(k) && TIER_KEYS[k] > tierNow()) G.flags.tier = TIER_KEYS[k];
  resetExplore(G.flags.exp); toolSig = '';
  P.slot = 0; applyUpgrades(); selectGunView(gunId());
  showFlyBtn(); P.fly = false;
  gate.hp = gate.max;
  document.body.classList.remove('title'); G.mode = 'play';
  const sp = G.flags.spawn && PLACED.some(p => BUILD_DEF[p.k].rest && Math.hypot(p.x - G.flags.spawn.x, p.z - G.flags.spawn.z) < 1) ? G.flags.spawn : null;
  const wake = !sp && !G.flags.reached;
  P.x = sp ? sp.x + 1.5 : wake ? POI.dropsite.x + DROP_WAKE[0] : 3; P.z = sp ? sp.z + 1.5 : wake ? POI.dropsite.z + DROP_WAKE[1] : 30; P.y = heightAt(P.x, P.z); P.pd = Math.hypot(P.x, P.z);
  P.yaw = wake ? Math.atan2(P.x - POI.dropsite.x, P.z - POI.dropsite.z) : 0; P.pitch = 0;   // you wake looking at the wreck
  if (!s) {
    say([['Radio', '…anyone at the drop site, this is Kestrel. If you can hear this, you made it down.'], ['Kade', 'Grab what you can from the wreck. Our walls are north-east — follow the old road.'], ['Kade', 'Or dig in where you are. Your call. Nights out there get loud.']]);
    setTimeout(() => toast(isTouch ? 'Search the wreck · BAG → Craft to build here · the minimap shows the way to Kestrel' : 'E search the wreck · E on nothing: bag + craft · M map — Kestrel is north-east', 6), 2500);
  } else toast(`Day ${G.day} · Tier ${tierNow()}`, 3);
  if (!isTouch) setTimeout(() => canvas.requestPointerLock?.(), 50);
}
function menu() {
  const s = load();
  $('menu').innerHTML = (s ? '<button id="bCont">Continue</button><button class="sec" id="bNew">New game</button>' : '<button id="bNew">Start</button>') + `<button class="sec" id="bMute">Sound: ${muted ? 'off' : 'on'}</button><button class="sec" id="bGfx">Settings</button>`;
  $('keys').textContent = isTouch ? 'Left thumb: move (push to the edge to sprint) · right thumb: look · hold the crosshair button to fire · tap the toolbar to switch or eat · tap the minimap for the map · USE (BAG when nothing is near) for inventory · the pause button top-left for the menu.' : 'WASD move · Shift sprint · mouse look · click fire · right-click aim · R reload · 1–5 toolbar · E use / bag · Space jump/swim · M map · N sound · Esc pause';
  $('bNew').onclick = () => { if (s && !confirmNew()) return; try { localStorage.removeItem(SAVE); } catch (e) {} startGame(true); };
  if ($('bCont')) $('bCont').onclick = () => startGame(false);
  $('bGfx').onclick = () => openGfx();
  $('bMute').onclick = () => { setMute(!muted); $('bMute').textContent = `Sound: ${muted ? 'off' : 'on'}`; };
}
let newArmed = false;
function confirmNew() { if (newArmed) return true; newArmed = true; $('bNew').textContent = 'Tap again to wipe save'; setTimeout(() => { newArmed = false; if ($('bNew')) $('bNew').textContent = 'New game'; }, 2500); return false; }

/* ================= settings (Nov 10): Textures + View distance ================= */
function setViewDist(k) {
  GFX.view = k; const L = VIEW_LEVELS[k]; VIEW_M = L.m; skyU.haze.value = L.haze;
  T_LOAD = VIEW_M ? Math.min(470, VIEW_M + 60) : 470; T_DROP = T_LOAD + 230;          // ground streamed only as far as you can see
  FOR_SHOW = VIEW_M ? Math.min(430, VIEW_M + 20) : 430; FOR_DROP = FOR_SHOW + 470;      // same for the forest
  cullT = 0;
}
setViewDist(GFX.view);
let gfxOpen = false;
function renderGfx() {
  const row = (title, key, levels, note) => `<h4>${title}</h4><div class="opts">${Object.entries(levels).map(([k, L]) =>
    `<button data-${key}="${k}" class="${GFX[key] === k ? 'on' : ''}">${L.label}${L.m ? `<small>${L.m} m</small>` : key === 'view' ? '<small>no limit</small>' : ''}</button>`).join('')}</div><p class="dim">${note}</p>`;
  $('gfxb').innerHTML = '<h3>Settings</h3>'
    + row('Textures', 'tex', TEX_LEVELS, `Sharper surfaces cost graphics memory. Changing this restarts the game (your save is kept).${isTouch ? ' High can crash phones.' : ''}`)
    + row('View distance', 'view', VIEW_LEVELS, 'How far you can see before the fog closes in. Shorter = smoother. Changes right away.')
    + '<button class="xb" data-close="1">Done</button>';
}
function openGfx() { gfxOpen = true; renderGfx(); $('gfx').classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); }
function closeGfx() { gfxOpen = false; $('gfx').classList.remove('on'); }
$('gfx').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) { if (e.target.id === 'gfx') closeGfx(); return; }
  if (b.dataset.close) { closeGfx(); return; }
  if (b.dataset.view) { setViewDist(b.dataset.view); saveGfx(); renderGfx(); return; }
  if (b.dataset.tex && b.dataset.tex !== GFX.tex) { GFX.tex = b.dataset.tex; saveGfx(); if (G.mode === 'play') save(); location.reload(); }
});

async function boot() {
  try { await Promise.race([document.fonts.load('900 70px "Big Shoulders Stencil Display"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  setLoad('READING THE RIVER'); await nextFrame();
  prepWater(); prepFlats();
  await buildHeightmap(); H0 = heightAt(0, 0);
  const mp = loadModels(['gun-night', 'gun-desert', 'sniper', 'fp-arms', 'civilian', 'michael', 'elias', 'dropship', 'cliff', 'ammo-crate', 'civilian-lo', 'michael-lo', 'elias-lo', 'keeper', 'keeper-lo', 'settler', 'settler-lo', 'gun-night-lo', 'gun-desert-lo', ...PROP_MODELS, ...FAUNA_MODELS, ...ENV_MODELS, ...NEW_PROPS]);
  await buildTerrain(); buildWater();
  setLoad('UNPACKING THE ARMORY'); await mp;
  setLoad('GROWING THE FOREST'); await nextFrame();
  await buildForest(); await buildEnvForest(); buildEnvRocks(); buildGrass(); buildMist();
  setLoad('RAISING KESTREL'); await nextFrame();
  buildArc(); buildWall(0); buildGate(); dressGate(0); buildTowers(); dressTowers(0, 0); buildCampProps(); dressSmokehouse(0); buildNearby();
  setLoad('WALKING THE VALLEY'); await nextFrame();
  buildHalvard(); buildBurn(); buildDropsite(); buildAshmere(); buildLake(); buildLookout(); buildBridge(); buildScoutCamps(); buildRelay(); buildArches();
  setLoad('RAISING CINDER CITY'); await nextFrame(); buildBases(); buildSmoke();
  setLoad('WALKING THE OUTLANDS'); await nextFrame(); buildOutlands(); buildEnvSites();
  await buildFar();
  seedScraps(); seedCrates(); buildRifle(); selectGunView('carbine');
  for (const D of SHOP_DEFS.filter(D => D.who)) { const e = spawnNPC(D.who, D.keeper.x, D.keeper.z, { model: pick(['civilian', 'settler']), tint: D.tint, yaw: D.ry, h: rr(1.68, 1.82) }); e.shop = D.id; e.shopName = D.name; named[D.who] = e; }
  WALK.settle(); buildPaddock();
  for (let i = 0; i < 8; i++) { const n = pick(WALK.nodes); spawnNPC('extra', n.x + rr(-1, 1), n.z + rr(-1, 1), { wander: true }); }
  SETTLERS.forEach((S, i) => { const n = pick(WALK.nodes), e = spawnNPC('settler', n.x + rr(-1, 1), n.z + rr(-1, 1), { model: pick(['civilian', 'settler', 'settler']), tint: S.tint, wander: true, h: rr(1.62, 1.84) }); e.settler = 1; e.shop = 'settler' + i; e.shopName = S.n; });
  // (Nov 10) Kestrel's watch: Keeper foot soldiers (Bryce's rigged model), two on the gate facing out and three walking the streets
  for (const sx of [-1, 1]) spawnNPC('watch', sx * (GATE_X + 1.6), CAMP_R - 5, { model: 'keeper', armed: true, yaw: 0, h: rr(1.78, 1.86) });
  for (let i = 0; i < 3; i++) { const n = pick(WALK.nodes); spawnNPC('watch', n.x + rr(-1, 1), n.z + rr(-1, 1), { model: 'keeper', armed: true, wander: true, h: rr(1.76, 1.86) }); }
  ensureWildlife(); villageGuards(); buildExplore(); buildFactions(); bakeWorld(); bakeExplore(); buildCull(); buildLightPool();
  await buildMapCanvas(); resetExplore('');
  updTime(0); refreshEnv(G.tod, 0);
  menu();
  requestAnimationFrame(frame);
  // Bryce's weapon models stream in behind the menu; each gun swaps from its drawn stand-in once its model is here
  loadModels(WEAPON_MODELS, true).then(() => { for (const k in GUNV) if (WEAPONS[k]?.model?.startsWith('w/')) { GUNV[k].removeFromParent(); delete GUNV[k]; } if (curGunId) selectGunView(curGunId); });
}
boot();
window.__arc = { G, P, INV, UP, night, rust, ents, gate, updNight, updClan, startNight, startRust, setStep, skipCine: () => skipCine(), get cine() { return cine; } };
window.__T = { spawnClan, inHull, hullDoor, SHOP, ARC, nearShopNPC, openTrade, findInteract, get named() { return named; }, get chanObj() { return chan; }, slotWeapon, equipTo, selectSlot, throwNext, CACHES, cacheAction, BASES, FOUNDRY, CITY, PLACED, tradeStock, rollLoot, newGear, ITEMS, RECIPES, GEAR_DEFS, cnt, give, craft, eatItem, healBest, nearNode, wildInteract, openCraft, placeKit, nearStation, get chan() { return chan; }, updTerrain, updForest, CLOUDS, FAR_SMOKE, get far() { return { farTerrMesh, horizonMesh, farTrees }; }, scene, cam: camera, heightAt, floorAt, waterAt, THREE, CHUNKS, OCELLS, renderer, useSlot, toggleInv, toggleMap };
window.__E = { ARC_RADIO, ARC_WALKIES, WING, envSites, PETS, DUCKS, POI, BASES, CITY, FAUNA, WEAPONS, get models() { return Object.keys(MODELS); }, selectGunView, PATHS };
Object.assign(window.__T, { updNPC, updRust, fogCountdown, setPause, zoomOf, useInteract, input });
Object.defineProperties(window.__T, { paused: { get: () => paused }, invOpen: { get: () => invOpen } });
