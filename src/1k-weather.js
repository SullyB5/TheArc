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
