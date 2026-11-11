
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

// (Nov 11) markings that were on the Arc's plating when it came down: deck and bay numbers, hazard chevrons, arrows, the
// station's ring logo — an atlas of 4 x 2, picked by UV, stuck on salvaged panels so you can tell where each one came from
const texStencil = ctex(512, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); const cw = w / 4, ch = h / 2;
  const txt = (i, t, sz, col = 'rgba(30,30,30,.85)') => { const x = (i % 4) * cw, y = Math.floor(i / 4) * ch; g.fillStyle = col; g.font = `900 ${sz}px "Big Shoulders Stencil Display", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + cw / 2, y + ch / 2, cw - 10); };
  txt(0, 'DECK 4', 40); txt(1, 'BAY 12-C', 34); txt(2, 'ARC', 64, 'rgba(160,40,30,.85)'); txt(5, 'NO STEP', 30);
  { const x = 3 * cw, y = 0; g.save(); g.beginPath(); g.rect(x + 4, y + 30, cw - 8, ch - 60); g.clip(); for (let k = -6; k < 12; k++) { g.fillStyle = k % 2 ? 'rgba(20,20,20,.9)' : 'rgba(220,160,40,.95)'; g.beginPath(); g.moveTo(x + k * 22, y + 30); g.lineTo(x + k * 22 + 22, y + 30); g.lineTo(x + k * 22 - 18, y + ch - 30); g.lineTo(x + k * 22 - 40, y + ch - 30); g.fill(); } g.restore(); }
  { const x = 0, y = ch; g.strokeStyle = 'rgba(40,40,40,.85)'; g.lineWidth = 7; g.beginPath(); g.arc(x + cw / 2, y + ch / 2, 38, 0, 7); g.stroke(); g.beginPath(); g.arc(x + cw / 2, y + ch / 2, 20, 0, 7); g.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; g.beginPath(); g.moveTo(x + cw / 2 + Math.cos(a) * 20, y + ch / 2 + Math.sin(a) * 20); g.lineTo(x + cw / 2 + Math.cos(a) * 38, y + ch / 2 + Math.sin(a) * 38); g.stroke(); } }
  { const x = 2 * cw, y = ch; g.fillStyle = 'rgba(30,30,30,.85)'; g.beginPath(); g.moveTo(x + 20, y + ch / 2 - 14); g.lineTo(x + cw - 50, y + ch / 2 - 14); g.lineTo(x + cw - 50, y + ch / 2 - 34); g.lineTo(x + cw - 14, y + ch / 2); g.lineTo(x + cw - 50, y + ch / 2 + 34); g.lineTo(x + cw - 50, y + ch / 2 + 14); g.lineTo(x + 20, y + ch / 2 + 14); g.fill(); }
  txt(7, 'O2 · 7', 40, 'rgba(30,70,120,.85)');
  for (let i = 0; i < 1600; i++) { g.clearRect(rnd() * w, rnd() * h, rr(1, 4), rr(1, 3)); }        // worn off in flecks
});
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
    plate: () => new THREE.MeshStandardMaterial({ ...vc, map: TX.metal, normalMap: TX.metalN, normalScale: new THREE.Vector2(.6, .6), roughness: .62, metalness: .32 }),
    stencil: () => new THREE.MeshStandardMaterial({ ...vc, map: texStencil, roughness: .6, metalness: .3, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
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

/* (Nov 11) Kestrel's buildings are made out of the Arc: every part a settler would have cut from wood or tin is cut from
   the hull instead. shipKit wraps a kit so 'board' parts come out as salvaged plate (painted, primer, rust where the paint's
   gone) and 'corr' parts as hull panelling; models and cloth are untouched. */
function shipKit(K) {
  const map = m => m === 'board' ? 'plate' : m === 'corr' ? 'hull' : m;
  const W = Object.create(K);
  W.box = (m, ...a) => K.box(map(m), ...a); W.cyl = (m, ...a) => K.cyl(map(m), ...a); W.geo = (m, ...a) => K.geo(map(m), ...a);
  W.at = m => { K.at(m); return W; }; W.raw = K;
  return W;
}
// a stencil off the hull (atlas cell 0-7) on a panel, w x h, in the current frame
function stencil(K, cell, w, h, x, y, z, ry = 0, rz = 0) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, cx = (cell % 4) / 4, cy = 1 - (Math.floor(cell / 4) + 1) / 2;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) / 4, cy + uv.getY(i) / 2);
  K.geo('stencil', g, htm(x, y, z, 0, ry, rz), 0xffffff);
}
// a porthole off the station: a ring of plate round thick glass (lit from inside after dark)
function porthole(K, x, y, r = .32) {
  const ring = new THREE.TorusGeometry(r + .06, .07, 6, 16); K.geo('metal', ring, htm(x, y, .06), 0x5a5e60);
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; K.box('shiny', .04, .04, .03, x + Math.cos(a) * (r + .06), y + Math.sin(a) * (r + .06), .12, 0, 0, 0, 0x8a8e90); }
  const gl = new THREE.CircleGeometry(r, 16); K.geo('win', gl.clone(), htm(x, y, -.02)); K.geo('glass', gl, htm(x, y, .02));
}
// the hull's own paint, as it came down: station white, pale grey, primer, gunmetal, a teal bulkhead
const SHIPC = [0xd6d4cc, 0xc4c2ba, 0xb4b2aa, 0x9a8a7a, 0x7a8286, 0x6a6e70, 0xa8b4b0, 0x8a6a52];
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
        const c = hp(.08) ? hpick(WOODC) : hp(.06) ? tint(o.patch || 0x6a7a8a) : tint(col, .12);   // (inside a ship kit these come out as plate strips)
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
        for (let y = y0; y < y1 - .02; y += rowH) { const top = Math.min(y1, y + rowH), ph = top - y - .02, oddC = hp(.16), c = oddC ? tint(hpick(o.pal || SHIPC), .06) : tint(o.col || 0xc8c4bc, .07), lap = (alt++ % 2) * .02;
          K.box('hull', w + .03, ph, .05, cx, (y + top) / 2, lap + hr(-.006, .01), hr(-.008, .008), 0, hr(-.008, .008), c, 2);
          if (ph > .5 && w > .6) { for (const sx of [-1, 1]) for (let ry = y + .12; ry < top - .05; ry += .32) K.box('shiny', .025, .025, .02, cx + sx * (w / 2 - .05), ry, lap + .035, 0, 0, 0, 0x7a7e80); }   // rivets down the lap
          if (!o.inside && ph > .7 && w > .9 && hp(.07)) stencil(K, hpick([0, 1, 2, 5, 7, 4, 6]), Math.min(w * .8, 1.1), .55, cx, y + ph / 2, lap + .03, 0, hr(-.03, .03));
          if (!o.inside && hp(.04) && ph > .8) K.box('plate', w * hr(.4, .8), ph * hr(.3, .6), .03, cx + hr(-.1, .1), y + ph * hr(.3, .7), lap + .04, 0, 0, hr(-.1, .1), hpick([0x8a5a3a, 0x7a4a32, 0x5a5e60]));   // a patch welded over a hole
        }
      } else if (kind === 'block') {
        K.box('block', w, hh, .2, cx, y0 + hh / 2, -.08, 0, 0, 0, tint(col || 0xd8d2c8, .05), 1.6);
      }
    }
  }
}
// a window: frame, sill, glass (lit from inside after dark), and one of: curtains, shutters, boards, bars
function windowAt(K, x, y, w, h, o = {}) {
  const fc = o.frame || 0x4a4c4e, t = .08;
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
  if (o.metal) {   // (Nov 11) a bulkhead door off the Arc: a handwheel, a band of hazard paint, its little window
    const wg = new THREE.TorusGeometry(.17, .025, 5, 14); wg.translate(lw / 2, h * .5, .07); K.geo('shiny', wg, m.clone(), 0x8a8e90);
    for (let k = 0; k < 3; k++) { const sg = new THREE.BoxGeometry(.34, .025, .02); sg.rotateZ(k * 1.047); sg.translate(lw / 2, h * .5, .07); K.geo('shiny', sg, m.clone(), 0x8a8e90); }
    for (let k = 0; k < Math.floor(lw / .2); k++) { const sg = new THREE.BoxGeometry(.1, .14, .012); sg.translate(.1 + k * .2, .2, .03); K.geo('plain', sg, m.clone(), k % 2 ? 0x1e1e1e : 0xd9a32a); }
    const gw = new THREE.CircleGeometry(.13, 12); gw.translate(lw / 2, h * .78, .03); K.geo('win', gw, m.clone());
  }
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
  const K = shipKit(hkit(LOW)), KI = shipKit(hkit(LOW));
  const BW = D.bw, BD = D.bd, H1 = 3.3, H2 = S.upper ? 2.75 : 0, HT = H1 + H2, OPEN = BW / 2 - 1.6;
  const kind = S.clad, col = S.col, low = S.base === 'block' ? 1.05 : 0;
  // floor: the old slab, then boards over it in the timber houses
  K.box('conc', BW + .7, .22, BD + .7, 0, .11, 0, 0, 0, 0, 0xb0aaa0, 2);
  if (S.floor === 'board') for (let x = -BW / 2 + .1; x < BW / 2 - .1; x += .2) K.box('board', .19, .03, BD - .2, x + .1, .235, 0, 0, 0, 0, tint(0x8a7a64, .12));
  // the frame: corner posts, the posts either side of the shop front, top plates
  // the frame: lengths of the Arc's own ribs and I-beams, still in their station white or gunmetal (Nov 11)
  const postC = S.ribC || 0x55585a, postM = 'metal';
  for (const [px, pz] of [[-BW / 2, -BD / 2], [BW / 2, -BD / 2], [-BW / 2, BD / 2], [BW / 2, BD / 2], [-OPEN, BD / 2], [OPEN, BD / 2]]) {
    const c = tint(postC, .05); K.box(postM, .26, HT + .05, .08, px, HT / 2, pz - .09, 0, 0, 0, c); K.box(postM, .08, HT + .05, .22, px, HT / 2, pz, 0, 0, 0, c); K.box(postM, .26, HT + .05, .08, px, HT / 2, pz + .09, 0, 0, 0, c); }
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
  // (Nov 11) the gable roofs are a length of the Arc's hull laid over the walls: an arch, chord BD + overhang, sagging 1.5 m
  const AOV = .55, ACH = BD + AOV * 2, ASAG = 1.55, AR = (ACH * ACH / 4 + ASAG * ASAG) / (2 * ASAG), AY0 = HT + .08 + ASAG - AR;
  const archY = z => AY0 + Math.sqrt(Math.max(0, AR * AR - z * z));
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
      cladRun(KI, R.L - .34, H1 - .25, 'hull', { holes: holes.filter(h => h.y0 < H1).map(h => ({ ...h, x0: h.x0 - .17, x1: h.x1 - .17, y0: h.y0 - .2, y1: h.y1 - .2 })), col: S.liner || 0xc8c6be, pal: [0xb8bcb8, 0xd0cec6, 0xa8b0ae], inside: true });
      KI.at(null);
    }
    K.at(R.m);
    for (const [u, y, w, h] of wins) windowAt(K, u, y, w, h, { frame: S.frame, curtain: hp(.6) ? hpick(CLOTHC) : null, shutters: S.shutters && hp(.6) ? S.shutters : null, boarded: hp(S.boarded || .1), bars: S.bars, crack: hp(.3) });
    for (const [u, w, h, y0 = 0] of doors) { K.at(R.m.clone().multiply(htm(0, y0, 0))); doorAt(K, u, w, h, { col: S.door || 0x8a8e90, frame: S.frame, metal: true, open: y0 > 0 ? hr(.05, .5) : undefined }); }
    // portholes where there's wall to spare, and a run of conduit along the top (it came off the Arc with the plate)
    if (R.side !== 'front' && R.L > 6) { K.at(R.m); for (const u of [R.L * .14, R.L * .86]) if (!holes.some(h => u > h.x0 - .6 && u < h.x1 + .6 && h.y0 < 2.4)) porthole(K, u, 1.85, .3); }
    if (R.side !== 'front') { K.at(R.m); K.cyl('metal', .045, .045, R.L - .4, 6, R.L / 2, H1 - .35, .09, 0, 0, Math.PI / 2, 0x4a4c4e); }
    // gable / shed fill above the wall top on the sides
    if ((R.side === 'left' || R.side === 'right') && S.roof) {
      K.at(R.m);
      const pitch = S.roof === 'gable' ? .42 : 0, rise = S.roof === 'shed' ? 1.1 : 0;
      for (let u = 0; u < R.L - .02;) { const w = Math.min(R.L - u, kind === 'board' ? hr(.17, .27) : hr(.82, .92)); const c = u + w / 2;
        const zf = R.side === 'right' ? BD / 2 - c : c - BD / 2;                       // where this strip is front-to-back (front = +)
        const hh = S.roof === 'gable' ? archY(zf) - HT : rise * (zf + BD / 2) / BD;
        if (hh > .05) K.box(kind === 'board' ? 'board' : kind === 'hull' ? 'hull' : 'corr', w - .01, hh, .03, c, HT + hh / 2 - .02, 0, 0, 0, 0, kind === 'board' ? tint(col, .1) : tint(hpick(S.pal || RUST), .1));
        u += w; }
    }
    // a plank band where the upper floor sits
    if (H2) K.box('board', R.L + .1, .22, .06, R.L / 2, H1, .05, 0, 0, 0, tint(0x5a4a3a));
  }
  K.at(null);
  // the ceiling: boards across the joists (the upstairs floor, or under the roof)
  // the ceiling: deck plate laid across I-beam joists (the upstairs floor, or under the roof)
  for (let x = -BW / 2 + .2; x < BW / 2 - .2; x += 1.2) KI.box('hull', 1.19, .03, BD - .3, x + .6, H1 - .12, 0, 0, 0, 0, tint(0x8e908c, .06), 1.6);
  for (let z = -BD / 2 + .6; z < BD / 2; z += 1.6) KI.box('metal', BW - .3, .16, .1, 0, H1 - .22, z, 0, 0, 0, 0x4a4c4e);
  // ---- the roof ----
  const ov = .55, pal = S.roofPal || RUST;
  const sheet = (x, y, z, w, len, rx, c) => K.box('corr', w, .02, len, x, y, z, rx, 0, hr(-.012, .012), c);
  if (S.roof === 'gable') {
    // the shell: a curved length of hull, its skin wavy where it hit, the station's ribs still on it, end trims and a gutter
    const half = Math.asin(ACH / 2 / AR), L = BW + ov * 2 + .1, rc = tint(hpick(S.roofPal || [0xd0cec6, 0xbcbab2, 0xc8c4b8]), .05);
    const sg = new THREE.CylinderGeometry(AR, AR, L, 18, Math.max(2, Math.round(L / 1.2)), true, HP - half, half * 2);
    { const pa = sg.attributes.position, uv = sg.attributes.uv; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), x = pa.getX(i), z = pa.getZ(i), k = 1 + (Math.sin(y * 1.7 + x * 2.3) * .012 + Math.sin(y * .6) * .01); pa.setX(i, x * k); pa.setZ(i, z * k); } for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * AR * half * 2 / 2, uv.getY(i) * L / 2); }
    sg.rotateZ(HP); sg.computeVertexNormals(); K.geo('hull', sg, htm(0, AY0, 0), rc);
    const ig = sg.clone(); ig.scale(1, .985, .985); K.geo('hull', ig, htm(0, AY0 - .05, 0), tint(0x8a8c8a, .05));     // the underside, so it reads from inside
    // patches welded on, a stencil, the ribs over the top
    for (let i = 0; i < 3; i++) { const pz = hr(-BD / 2, BD / 2), px = hr(-BW / 2 + 1, BW / 2 - 1), sl = Math.atan2(-pz, Math.sqrt(AR * AR - pz * pz)); K.box('plate', hr(.8, 1.8), .03, hr(.6, 1.4), px, archY(pz) + .04, pz, -sl, 0, hr(-.1, .1), hpick([0x8a5a3a, 0x7a7e80, 0x9a948a])); }
    for (let x = -BW / 2 + .6; x < BW / 2; x += hr(2.1, 2.8)) { const rg = new THREE.TorusGeometry(AR + .08, .09, 4, 22, half * 2); rg.rotateZ(HP - half); rg.rotateY(HP); K.geo('metal', rg, htm(x, AY0, 0), tint(0xc8c6be, .05)); K.box('metal', .14, .14, .22, x, archY(0) + .14, 0, 0, 0, 0, 0x6a6e70); }
    for (const sx of [-1, 1]) { const tg = new THREE.TorusGeometry(AR + .02, .07, 4, 22, half * 2); tg.rotateZ(HP - half); tg.rotateY(HP); K.geo('metal', tg, htm(sx * L / 2, AY0, 0), 0x4a4c4e); }
    for (const sz of [1, -1]) K.cyl('metal', .09, .09, BW + ov * 2, 8, 0, HT - .06, sz * (ACH / 2 + .06), 0, 0, Math.PI / 2, 0x6a6a66, true, 0, Math.PI);
    S._eave = HT - .1;
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
  if (S.tarp) { const [tx, tz, tw, td] = S.tarp, ty = S.roof === 'gable' ? archY(tz) + .06 : HT + 1.1 * (tz + BD / 2) / BD + .58;
    const tg = new THREE.PlaneGeometry(tw, td, 6, 6); const pa = tg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, (hash(pa.getX(i) * 3, pa.getY(i) * 3) - .5) * .06); tg.computeVertexNormals();
    K.geo('cloth', tg, htm(tx, ty, tz, -Math.PI / 2 + (S.roof === 'gable' ? Math.atan2(tz, Math.sqrt(AR * AR - tz * tz)) : .11), 0, 0), S.tarpC || 0x3a5a8a);
    for (let i = 0; i < 0; i++) { const t = new THREE.TorusGeometry(.26, .1, 6, 12); t.rotateX(Math.PI / 2); K.geo('plain', t, htm(tx + hr(-tw / 2.5, tw / 2.5), ty + .1, tz + hr(-td / 3, td / 3), (S.roof === 'gable' ? (tz > 0 ? .42 : -.42) : .11), 0, 0), 0x1e1e1e); } }
  // rain barrel under the back gutter, with its downpipe
  { const bx = H2 ? -BW / 2 + .5 : BW / 2 - .5, bz = -BD / 2 - .55; barrel(K, bx, 0, bz, tint(0x3a4a5a)); K.cyl('metal', .045, .045, S._eave - .9, 6, bx + .1, .9 + (S._eave - .9) / 2, -BD / 2 - .62, 0, 0, 0, 0x6a6a66); }
  if (S.chim) stovepipe(K, S.chim[0], HT - .2, S.chim[1], (S.roof === 'gable' ? archY(S.chim[1]) - HT : 1.1) + 1.4);
  // an aerial and a panel or two on the roof
  if (S.aerial) { K.cyl('metal', .025, .03, 3.4, 5, -BW / 2 + .4, HT + 1.6, -BD / 2 + .3, 0, 0, 0, 0x5a5a58); for (let i = 0; i < 4; i++) K.box('metal', .9 - i * .15, .02, .02, -BW / 2 + .4, HT + 2.4 + i * .3, -BD / 2 + .3, 0, .5, 0, 0x5a5a58); }
  if (S.solar) { const sz = S.roof === 'gable' ? -BD / 4 : -BD * .15, sy = S.roof === 'gable' ? archY(sz) + .15 : HT + .9, sa = S.roof === 'gable' ? -Math.atan2(-sz, Math.sqrt(AR * AR - sz * sz)) : -.11;
    for (const sx of [-BW / 4, 0]) { K.box('hull', 1.6, .05, 1.1, sx, sy, sz, sa, 0, 0, 0x2a3a5a, 1.2); K.box('metal', 1.66, .04, 1.16, sx, sy - .03, sz, sa, 0, 0, 0x8a8a88); } }
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
const HOUSE_STYLE = {   // (Nov 11) all of them cut from the Arc: col = the plate's paint, pal = the odd panel from somewhere else on the ship
  craft:   { clad: 'hull', col: 0x8a9094, pal: [0x6a6e70, 0x9a8a7a, 0xb4b2aa], roof: 'shed', front: 'rollup', lean: true, chim: [3.9, 1.4], aerial: true, sign: ['WORKSHOP', 'stencil'], tarp: [-2, -1, 3, 2.6], tarpC: 0x4a5a3a, sideDoor: 'left', frame: 0x3a3c3e, floor: 'conc', ribC: 0x4a4c4e },
  trade:   { clad: 'hull', col: 0xa8b4b0, pal: [0xd6d4cc, 0x8a6a52, 0x7a8286], roof: 'gable', upper: true, shutters: 0x6a7a74, sign: ['TRADING POST', 'stencil'], frame: 0x4a4c4e, floor: 'board', ribC: 0xc8c6be },
  med:     { clad: 'hull', col: 0xdcdad2, pal: [0xc4c2ba, 0xb8c4c8], roof: 'gable', solar: true, sign: ['CLINIC', '#b8392e'], frame: 0x8a8e90, lean: true, floor: 'board', sideDoor: 'right', shutters: 0xa8b0a8, door: 0xc8ccc8, ribC: 0xd8d6ce },
  wear:    { clad: 'hull', col: 0x7a8a9a, pal: [0x9a8a7a, 0xc4c2ba, 0x6a6e70], roof: 'gable', upper: true, shutters: 0x4a5a6a, sign: ['OUTFITTER', 'stencil'], frame: 0x3a3c3e, floor: 'board', door: 0x5a6a7a, ribC: 0x55585a },
  guns:    { clad: 'hull', col: 0x6a7068, pal: [0x5a5e60, 0x7a7a76, 0x8a6a52], roof: 'shed', sign: ['GUNSMITH', 'stencil'], frame: 0x2e3032, bars: true, boarded: .05, lean: true, aerial: true, floor: 'conc', sideDoor: 'left', ribC: 0x3a3c3e },
  cook:    { clad: 'hull', col: 0xc4bcae, pal: [0x9a8a7a, 0xd6d4cc, 0x8a6a52], roof: 'gable', chim: [-3.3, .5], sign: ['COOKHOUSE', 'stencil'], frame: 0x4a4c4e, lean: true, floor: 'board', shutters: 0x7a6a5a, door: 0x8a7a6a, tarp: [-3, -2, 3, 2.2], tarpC: 0x6a7a4a, ribC: 0xc8c6be },
  bunk:    { clad: 'hull', col: 0xb4b2aa, pal: [0x7a8a7a, 0xc4c2ba, 0x9a8a7a], roof: 'gable', upper: true, sign: ['BUNKHOUSE', 'stencil'], frame: 0x4a4c4e, floor: 'board', door: 0x6a7a6a, solar: true, aerial: true, ribC: 0xd0cec6 },
  salvage: { clad: 'hull', col: 0x8a6a52, pal: [0x9a8a7a, 0x6a6e70, 0xb4b2aa, 0x7a4a32], roof: 'shed', front: 'rollup', lean: true, sign: ['SALVAGE', 'spray'], frame: 0x3a3c3e, floor: 'conc', tarp: [1, 0, 3.6, 3], tarpC: 0x8a4a2a, sideDoor: 'right', ribC: 0x4a4c4e },
  ammo:    { clad: 'hull', col: 0x6e6a52, pal: [0x5a5e60, 0x7a6a3a, 0x8a8e90], roof: 'gable', sign: ['MUNITIONS', 'stencil'], frame: 0x2e3032, bars: true, floor: 'conc', sideDoor: 'right', aerial: true, ribC: 0x3a3c3e, roofPal: [0x8a8a7a, 0x7a7c70] },
  store:   { clad: 'hull', col: 0x9a948a, pal: [0xc4c2ba, 0x7a8286], roof: 'gable', sign: ['STOREHOUSE', 'stencil'], frame: 0x3a3c3e, floor: 'conc', ribC: 0xc8c6be, lean: true },
  depot:   { clad: 'hull', col: 0x7a8286, pal: [0x6a6e70, 0x9a8a7a, 0xd6d4cc], roof: 'shed', front: 'rollup', sign: ['DEPOT', 'stencil'], frame: 0x3a3c3e, floor: 'conc', ribC: 0x4a4c4e, sideDoor: 'left', aerial: true },
};
const STOCK_COL = { ammo: [0x4f5a3a, 0x6a5a3a, 0x3a3a3a, 0x8a6a2a], store: [0x8a7a5a, 0x6a7a5a, 0x9a8a6a, 0x5a6a7a], depot: [0x6d7276, 0x8a8c8c, 0x3a5a7a, 0x9a6040], cook: [0x8a3a2a, 0x7a6a4a, 0xc8a050, 0x5a7a3a], craft: [0x6d7276, 0x9a6040, 0x8a8c8c, 0x3a5a7a], trade: [0x7a5a3e, 0x6a7a5a, 0x9a8a6a, 0x5a6a7a, 0xa87a4a],
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
  } else if (id === 'ammo') {
    // (Nov 11) the munitions shed: the powder bench (the station) with a reloading press, scales and trays of brass; racks of
    // ammo crates down the back, explosive drums and gas behind a sandbag wall, frags in an open crate, a red lamp over the door
    K.box('metal', 1.3, .06, 2.6, sx, .95, sz, 0, 0, 0, 0x5a5e60); K.box('metal', 1.2, .9, 2.4, sx, .45, sz, 0, 0, 0, 0x3a3e40);
    K.cyl('metal', .06, .08, .45, 8, sx - .3, 1.2, sz - .8, 0, 0, 0, 0x2a2c2e); K.box('metal', .3, .08, .25, sx - .3, 1.45, sz - .8, 0, 0, 0, 0x2a2c2e); K.cyl('metal', .015, .015, .4, 4, sx - .1, 1.45, sz - .8, 0, 0, HP, 0x8a8e90);
    for (let i = 0; i < 24; i++) K.cyl('shiny', .012, .012, .06, 6, sx + .1 + (i % 6) * .05, 1.01, sz - .2 + Math.floor(i / 6) * .05, 0, 0, 0, 0xc8a050);
    for (let i = 0; i < 4; i++) K.cyl('metal', .08, .08, .22, 10, sx + .4, 1.09, sz + .3 + i * .22, 0, 0, 0, hpick([0x2a2a28, 0x6a2a22, 0x3a4a2a]));
    K.cyl('shiny', .14, .14, .02, 12, sx - .3, 1.0, sz + .7, 0, 0, 0, 0x9a8a5a);
    // racks of ammo crates along the back wall
    for (const rx of [-3.6, -1.2, 1.2]) { for (const y of [.05, .75, 1.45]) K.box('metal', 2.1, .05, .7, rx, y, -BD / 2 + .6, 0, 0, 0, 0x4a4c4e); for (const ex of [-1.02, 1.02]) K.box('metal', .06, 2.1, .7, rx + ex, 1.05, -BD / 2 + .6, 0, 0, 0, 0x3a3c3e);
      for (const y of [.1, .8, 1.5]) for (let k = 0; k < 3; k++) { if (hp(.2)) continue; if (MODELS['ammo-crate']) { const c = modelCopy('ammo-crate', .32); c.position.set(rx - .65 + k * .65, y, -BD / 2 + .62); c.rotation.y = hr(-.15, .15); inner.add(c); c.traverse(o => { if (o.isMesh) o.castShadow = false; }); } else crate(K, rx - .65 + k * .65, y, -BD / 2 + .62, 0, .9, 0x4f5a3a); } }
    // explosive drums behind sandbags in the far corner, and the gas
    for (const [x, z] of [[4.2, -2.6], [4.9, -2.1], [4.4, -1.6], [5.1, -2.9]]) { barrel(K, x, 0, z, 0x8a2a22); K.box('plain', .45, .12, .01, x, .55, z + .3, 0, 0, 0, 0xd9a32a); }
    for (let i = 0; i < 5; i++) { const sg = new THREE.BoxGeometry(.7, .26, .4); K.geo('cloth', sg, htm(3.2 + i * .62, .14 + (i % 2) * .26 * 0, -1.0, 0, hr(-.08, .08), 0), tint(0x8a7e5a)); K.geo('cloth', new THREE.BoxGeometry(.7, .26, .4), htm(3.5 + i * .5, .4, -1.0, 0, hr(-.08, .08), 0), tint(0x8a7e5a)); }
    // frags in an open crate, a box of molotovs (bottles and rag) by the counter
    crate(K, 2.6, .22, 1.9, .2, 1.1, 0x4f5a3a); for (let i = 0; i < 8; i++) { const g2 = new THREE.SphereGeometry(.05, 7, 5); g2.scale(1, 1.3, 1); K.geo('plain', g2, htm(2.45 + (i % 4) * .1, .72, 1.82 + Math.floor(i / 4) * .12), 0x3a4a2a); }
    bottleRow(K, 3.4, 3.9, .22, 2.2);
    // a red lamp over the door, a hazard band on the floor inside the front, NO FLAME on the wall
    K.box('glow', .22, .16, .12, 0, Hs.H1 + .3, BD / 2 + .1, 0, 0, 0, 0xff2a1a);
    for (let k = 0; k < 14; k++) K.box('plain', .3, .006, .22, -2.6 + k * .4, .25, BD / 2 - .5, 0, .6, 0, k % 2 ? 0x1e1e1e : 0xd9a32a);
    stencil(K, 3, 1.4, .7, BW / 2 - .16, 2.1, -1.2, -HP); stencil(K, 3, 1.4, .7, -BW / 2 + .16, 2.1, -1.2, HP);
    // outside: blast walls either side and sandbags across the front
    for (let i = 0; i < 9; i++) { const x = -4.6 + (i % 5) * 1.15 + (i > 4 ? .55 : 0), y = .2 + (i > 4 ? .3 : 0), z = BD / 2 + 1.3; const sg = new THREE.BoxGeometry(1.05, .3, .5); K.geo('cloth', sg, htm(x - (x > -1.6 && x < 1.6 ? 0 : 0), y, z, 0, hr(-.05, .05), 0), tint(0x8a7e5a)); }
    for (const sd of [-1, 1]) { const bw = hmodel('props/barrier', 3.4); if (bw) { bw.position.set(sd * (BW / 2 + 1.1), 0, .5); bw.rotation.y = HP; inner.add(bw); } const w = shopL2W(D, sd * (BW / 2 + 1.1), .5), w0 = shopL2W(D, sd * (BW / 2 + 1.1), -3.2), w1 = shopL2W(D, sd * (BW / 2 + 1.1), 4.2); addColLine(w0.x, w0.z, w1.x, w1.z, .6); }
    const w = shopL2W(D, 4.5, -2.3); addCol(w.x, w.z, 1);
  } else if (id === 'store') {
    // the Storehouse: steel racks of crates, sacks and drums floor to ceiling, a tally board, a hand truck
    for (const [rz, n] of [[-BD / 2 + .55, 3], [-.6, 2]]) for (let k = 0; k < n; k++) { const rx = -BW / 2 + 1.6 + k * 2.3;
      for (const y of [.05, .9, 1.75]) K.box('metal', 2.1, .05, .8, rx, y, rz, 0, 0, 0, 0x4a4c4e); for (const ex of [-1.02, 1.02]) K.box('metal', .06, 2.5, .8, rx + ex, 1.25, rz, 0, 0, 0, 0x3a3c3e);
      for (const y of [.1, .95, 1.8]) for (let j = 0; j < 3; j++) { const r = hrnd(); if (r < .45) crate(K, rx - .65 + j * .65, y, rz, hr(-.1, .1), .9); else if (r < .75) sack(K, rx - .65 + j * .65, y, rz, .8); else barrel(K, rx - .65 + j * .65, y, rz, tint(hpick(stuff)), .7); }
      const c0 = shopL2W(D, rx - 1, rz), c1 = shopL2W(D, rx + 1, rz); addColLine(c0.x, c0.z, c1.x, c1.z, .5); }
    K.box('plate', 1.2, .9, .03, BW / 2 - .1, 1.6, 1.5, 0, -HP, 0, 0x3a3e3a); for (let k = 0; k < 5; k++) K.box('plain', .8, .01, .02, BW / 2 - .13, 1.85 - k * .12, 1.5, 0, -HP, 0, 0xd8d4c8);
    K.box('metal', .5, .05, .4, 2, .12, 2.3, 0, .4, 0, 0x8a2a22); K.box('metal', .05, 1.1, .05, 2, .6, 2.1, .2, .4, 0, 0x8a2a22);
  } else if (id === 'depot') {
    // the Depot: the station's own lockers, a server rack and a terminal still taking power, fuel cells on charge, a pallet of plate
    npInst(inner, 'locker', [-3.6, -2.84, -2.08, -1.32].map(x => [x, .22, -BD / 2 + .5, 0, 1]), false); { const c0 = shopL2W(D, -4, -BD / 2 + .5), c1 = shopL2W(D, -1, -BD / 2 + .5); addColLine(c0.x, c0.z, c1.x, c1.z, .5); }
    npInst(inner, 'server-rack', [[1.2, .22, -BD / 2 + .6, 0]], false); npInst(inner, 'wall-4', [[3.6, .22, -BD / 2 + .3, 0]], false);
    npInst(inner, 'computer-console', [[BW / 2 - 1.1, .22, .6, -HP, .8]], false); { const c = shopL2W(D, BW / 2 - 1.1, .6); addCol(c.x, c.z, .6); }
    npInst(inner, 'fuel-cell', [[-3.6, .22, 1.8], [-3, .22, 2.2, .8], [-3.3, .22, 1.2, 2]], false); npInst(inner, 'gas-bottle', [[-BW / 2 + .45, .22, -1.2], [-BW / 2 + .45, .22, -.7, 1]], false);
    for (let k = 0; k < 6; k++) K.box('hull', 1.6, .04, 1.1, .6, .3 + k * .05, 1.6, 0, hr(-.1, .1), 0, tint(hpick(SHIPC), .05), 2); K.box('plate', 1.4, .14, 1.2, .6, .2, 1.6, 0, 0, 0, 0x7a6a50);
    { const c = shopL2W(D, .6, 1.6); addCol(c.x, c.z, .8); }
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
  const K = shipKit(hkit(LOW));
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
  const poles = [[PX - 3.2, PZ + 3], [10, -14], [-8, -14.5], [-24, -13], [-40, -4], [5, 4], [5, 24], [5.5, 40], [-5, 44], [-5, 26], [-20, 2], [30, 20], [46, 21], [60, 19], [76, 13], [54, 32], [-46, 12]];
  const tops = [];
  for (const [x, z] of poles) { const h = 6.2; K.cyl('board', .11, .14, h, 7, x, h / 2, z, hr(-.02, .02), 0, hr(-.02, .02), tint(0x6a5a46)); K.box('board', 1.4, .1, .1, x, h - .3, z, 0, hr(0, 3), 0, 0x5a4a3a);
    for (const s of [-.5, .5]) K.cyl('plain', .04, .05, .12, 6, x + s, h - .2, z, 0, 0, 0, 0xb8b0a0); addCol(x, z, .25); tops.push(new THREE.Vector3(x, h - .15, z)); }
  const chain = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 16], [16, 10], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [0, 11], [11, 12], [12, 13], [13, 14], [12, 15]];
  for (const [a, b] of chain) wireBetween(K, tops[a], tops[b], .6);
  const toHouse = { craft: 3, trade: 9, med: 16, wear: 9, guns: 8, cook: 7, bunk: 6, salvage: 12, ammo: 14, depot: 15, store: 4 };
  for (const D of SHOP_DEFS) { const t = tops[toHouse[D.id]]; if (!t) continue; const e = shopL2W(D, D.bw / 2 - .3, D.bd / 2); wireBetween(K, t, new THREE.Vector3(e.x, (HOUSE_STYLE[D.id].upper ? 5.9 : 3.3), e.z), .4); }
  // string lights round the commons fire (warm after dark)
  { const pts = [[15.5, 11.5], [19, 3.5], [27.5, 2.5], [31.5, 9.5], [27, 12.6]];
    for (const [x, z] of pts) { K.cyl('metal', .06, .07, 4, 6, x, 2, z, 0, 0, 0, 0x4a4c4e); addCol(x, z, .15); }
    for (let i = 0; i < pts.length; i++) { const p0 = pts[i], p1 = pts[(i + 1) % pts.length], a = new THREE.Vector3(p0[0], 3.9, p0[1]), b = new THREE.Vector3(p1[0], 3.9, p1[1]);
      wireBetween(K, a, b, .45, 0x2a2a28, .008);
      for (let k = 1; k < 8; k++) { const t = k / 8; K.box('win', .07, .1, .07, lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * .45 - .07, lerp(a.z, b.z, t)); } } }
  // the notice board inside the gate: a roofed board of notices, a bench, a bucket of sand
  { const nx = 7.5, nz = 58, ry = -Math.PI / 2; const m = htm(nx, 0, nz, 0, ry, 0);
    K.at(m); for (const s of [-1, 1]) K.box('board', .12, 2.6, .12, s * 1.3, 1.3, 0, 0, 0, 0, 0x5a4a3a); K.box('board', 2.8, 1.5, .06, 0, 1.6, 0, 0, 0, 0, 0x8a7a5a);
    K.box('corr', 3.1, .03, .8, 0, 2.65, .1, .25, 0, 0, 0x9a6a4a);
    for (let i = 0; i < 9; i++) K.poster(i % 8, hr(.3, .5), hr(.38, .55), -1.1 + (i % 5) * .55 + hr(-.05, .05), 1.25 + Math.floor(i / 5) * .62 + hr(-.05, .05), .04, 0, hr(-.08, .08));
    K.box('board', 1.8, .06, .4, 0, .48, 1.4, 0, 0, 0, 0x7a6650); for (const s of [-1, 1]) K.box('board', .06, .46, .36, s * .8, .23, 1.4, 0, 0, 0, 0x5a4636);
    K.at(null); addColLine(nx, nz - 1.4, nx, nz + 1.4, .3); }
  // planters of herbs along the streets, a cart, a ladder against a wall
  for (const [x, z, r] of [[-5.6, 39.6, .05], [5.8, 33, -.04], [-5.5, 56, 0], [-16, 1.6, .1], [57, 21.5, .5], [-31, 1.8, -.08]]) {
    K.box('board', 2.2, .45, .7, x, .23, z, 0, r, 0, tint(0x6a5038)); K.box('plain', 2.1, .05, .6, x, .44, z, 0, r, 0, 0x3a2e22);
    for (let i = 0; i < 7; i++) { const p = new THREE.Vector3(-.9 + i * .3, 0, hr(-.15, .15)).applyAxisAngle(new THREE.Vector3(0, 1, 0), r); const pg = new THREE.SphereGeometry(hr(.1, .18), 6, 4); pg.scale(1, hr(.8, 1.6), 1); K.geo('plain', pg, htm(x + p.x, .55, z + p.z), tint(hpick([0x4a6a32, 0x5a7a3a, 0x6a7a3a]))); }
    addCol(x, z, .9); }
  { const cx = -44, cz = -2; K.box('board', 1.2, .08, 2, cx, .62, cz, 0, .3, 0, 0x7a6650); for (const s of [-1, 1]) { K.box('board', .06, .35, 2, cx + s * .58 * Math.cos(.3), .78, cz - s * .58 * Math.sin(.3), 0, .3, 0, 0x6a5440); const w = new THREE.TorusGeometry(.38, .05, 6, 14); K.geo('board', w, htm(cx + s * .66 * Math.cos(.3), .38, cz - s * .66 * Math.sin(.3), 0, .3 + Math.PI / 2, 0), 0x4a3a2a); }
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
  const g = new THREE.Group(); g.position.set(0, gy, gz); world.add(g); const K = shipKit(hkit(LOW));
  for (const s of [-1, 1]) {
    const x = s * (GATE_X + 3.2);
    K.at(htm(x, 0, 0));
    cladRun(K.at(htm(x - 2.5, 0, 3)), 5, 4.2, 'hull', { col: 0x9a9890 }); cladRun(K.at(htm(x + 2.5, 0, -3, 0, Math.PI, 0)), 5, 4.2, 'hull', { col: 0x9a9890 }); cladRun(K.at(htm(x + 2.5, 0, 3, 0, HP, 0)), 6, 4.2, 'hull', { col: 0x9a9890 }); cladRun(K.at(htm(x - 2.5, 0, -3, 0, -HP, 0)), 6, 4.2, 'hull', { col: 0x9a9890 }); K.at(htm(x, 0, 0)); K.box('plate', 4.9, .2, 5.9, 0, 4.1, 0, 0, 0, 0, 0x6a6c6a);                                     // block base
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
  for (const [x, z] of leg) K.cyl('metal', .13, .16, 8.2, 7, x * 1.04, 4.05, z * 1.04, z * -.02, 0, x * .02, tint(0x6e7072));
  for (let y = 1; y < 8; y += 2.4) for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) { const [ax, az] = leg[a], [bx, bz] = leg[b], L = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(-(bz - az), bx - ax); K.box('metal', L, .1, .1, (ax + bx) / 2, y, (az + bz) / 2, 0, yaw, 0, 0x4a4c4e);
    K.box('metal', Math.hypot(L, 2.4), .08, .08, (ax + bx) / 2, y + 1.2, (az + bz) / 2, 0, yaw, Math.atan2(2.4, L) * (y % 2 > 1 ? 1 : -1), 0x4a4c4e); }
  for (let x = -1.75; x < 1.75; x += .22) K.box('metal', .21, .07, 3.6, x + .11, 8, 0, 0, 0, 0, tint(0x7a7c78, .08));
  for (const [x, z, w, d] of [[0, 1.7, 3.6, .3], [-1.7, 0, .3, 3.6], [1.7, 0, .3, 3.6]]) for (let i = 0; i < Math.round(Math.max(w, d) / .6); i++) { const sg = new THREE.BoxGeometry(w > d ? .62 : .42, .26, w > d ? .42 : .62);
    const sg2 = sg.clone(); K.geo('cloth', sg, htm(w > d ? -1.5 + i * .6 : x, 8.2, w > d ? z : -1.5 + i * .6, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); K.geo('cloth', sg2, htm(w > d ? -1.2 + i * .6 : x, 8.45, w > d ? z : -1.2 + i * .6, 0, hr(-.06, .06), 0), tint(0x8a7e5a)); }
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) K.box('metal', .12, 3, .12, px, 9.6, pz, 0, 0, 0, 0x4a4c4e);
  for (let x = -2.1; x < 2.1; x += .84) K.box('hull', .9, .02, 4.4, x + .42, 11.15, 0, .12, 0, hr(-.01, .01), tint(hpick([0xc8c6be, 0xb0aea6, 0x9a948a]), .06));
  K.box('metal', .08, 8, .08, -.4, 4, -1.45, 0, 0, 0, 0x55585a); K.box('metal', .08, 8, .08, .4, 4, -1.45, 0, 0, 0, 0x55585a);
  for (let k = 0; k < 10; k++) K.box('metal', .8, .07, .07, 0, .4 + k * .8, -1.45, 0, 0, 0, 0x6a6c6e);
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
