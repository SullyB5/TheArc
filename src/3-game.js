
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
