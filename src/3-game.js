
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
  P.yaw -= input.look[0] * lk; P.pitch = clamp(P.pitch - input.look[1] * lk, -1.45, 1.45); input.look[0] = input.look[1] = 0;
  // move (or fly: F toggles it — no gravity, no collisions, go where you look)
  let sprint = false;
  if (P.fly) {
    let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const fast = input.sprint || ml > .96, spd = fast ? 90 : 28, cp = Math.cos(P.pitch);
    const fx = -Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cp, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const up = (keys.Space || touchUp ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
    P.x += (fx * my + rx * mx) * spd * dt; P.z += (fz * my + rz * mx) * spd * dt; P.y += (fy * my * spd + up * spd * .7) * dt;
    const d = Math.hypot(P.x, P.z); if (d > WORLD) { P.x *= WORLD / d; P.z *= WORLD / d; }
    P.y = clamp(P.y, heightAt(P.x, P.z), 600); P.vy = 0; P.onGround = false; P.swim = false; input.jump = false; input.sprint = false;
  } else {
    let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const wl = waterAt(P.x, P.z), depth = wl - P.y;
    P.swim = depth > 1.25;
    sprint = (input.sprint || ml > .96) && my > .3 && !shopOpen && P.ads < .3 && !P.swim && depth < .5;
    const spd = (sprint ? 8.6 : 5.4) * (shopOpen ? 0 : 1) * (P.swim ? .55 : depth > .4 ? .7 : 1) * (1 - P.ads * .45);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const vx = (fx * my + rx * mx) * spd, vz = (fz * my + rz * mx) * spd;
    P.x += vx * dt; P.z += vz * dt;
    collide(P, .42, true);
    let gy = heightAt(P.x, P.z);
    const fl = floorAt(P.x, P.z, P.y); if (fl > gy) gy = fl;
    if (P.swim) gy = Math.max(gy, wl - 1.3);
    if (input.jump && (P.onGround || P.swim)) { P.vy = P.swim ? 3 : 6.8; P.onGround = false; }
    input.jump = false;
    P.vy -= (P.swim ? 6 : 22) * dt; P.y += P.vy * dt;
    if (P.y <= gy) { if (!P.onGround && P.vy < -11) { sfx('thud'); if (P.vy < -17) hurtPlayer(Math.round((-P.vy - 17) * 4), P.x, P.z); } P.y = gy; P.vy = 0; P.onGround = true; }
    else if (P.onGround && P.y - gy < .55) P.y = gy; else P.onGround = false;
    const moving = Math.hypot(vx, vz) > .5 && (P.onGround);
    P.bob += dt * (moving ? (sprint ? 13 : 9) : 0);
    STEP_SURF = depth > -.1 ? 'sand' : fl > -1e8 && fl >= P.y - .1 ? (Math.hypot(P.x - POI.bridge.x, P.z - POI.bridge.z) < 50 ? 'gravel' : 'metal') : P.y > 122 ? 'snow' : pathDist(P.x, P.z) < 3 || Math.hypot(P.x - POI.halvard.x, P.z - POI.halvard.z) < 75 ? 'gravel' : 'trail';
    P.stepT -= dt * (moving ? (sprint ? 1.6 : 1) : 0); if (P.stepT <= 0) { P.stepT = .42; if (moving) sfx('step', sprint ? 1.4 : 1); if (moving && depth > -.05) sfx('splash'); }
    input.sprint = sprint;
  }
  // survival
  P.food = Math.max(0, P.food - dt * (sprint ? .13 : .08) * (P.swim ? 1.6 : 1));
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
  // camera
  const bk = 1 - P.ads * .85, bobY = Math.sin(P.bob) * .045 * bk, bobX = Math.cos(P.bob * .5) * .03 * bk;
  camera.position.set(P.x, P.y + (P.swim ? 1.45 : 1.62) + bobY, P.z);
  camera.rotation.set(P.pitch + P.kick * .35, P.yaw, 0);
  const fov = BASE_FOV / (1 + (W.scope - 1) * P.ads);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const scoped = gunId() === 'hunter' && P.ads > .85;
  $('scope').classList.toggle('on', scoped); vm.visible = !scoped && !P.swim;
  // viewmodel: bob, kick, reload dip, swap drop; aiming slides it to the centre
  const rl = P.reload > 0 ? Math.sin((1 - P.reload / P.reloadMax) * Math.PI) : 0, sw = (P.swapT || 0) / .45;
  vm.position.set(bobX - P.ads * W.at[0], bobY * .6 - rl * .16 - sw * .3 + P.ads * (-W.at[1] - .085 - (W.scope > 2 ? .045 : 0)), P.kick * 1.1 + P.ads * .1);
  vm.rotation.set(rl * .5 + P.kick * 1.4, 0, -rl * .3);
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
  scene.fog.far = lerp(far, 24, rk); scene.fog.near = lerp(far * .12, 2, rk);
  skyU.top.value.copy(s.top); skyU.hor.value.copy(s.hor).lerp(_ca.set(0x7a3220), rk * .8); skyU.sunCol.value.copy(s.sun); skyU.rust.value = rk * .7;
  const ang = (G.tod - .25) * Math.PI * 2, sd = new THREE.Vector3(Math.cos(ang) * .8, Math.sin(ang), .35).normalize();
  skyU.sunDir.value.copy(sd);
  const ld = sd.y > 0 ? sd : sd.clone().negate();
  sun.position.set(P.x + ld.x * 160, P.y + ld.y * 160, P.z + ld.z * 160); sun.target.position.set(P.x, P.y, P.z);
  sun.color.copy(s.sun); sun.intensity = s.sunI * (1 - rk * .6);
  hemi.intensity = s.hemiI * 1.45 * (1 - rk * .3); hemi.color.copy(s.top).lerp(_cb.set(0xcfd8dc), .5);
  stars.material.opacity = clamp((isNight() ? 1 : 0) - rk, 0, 1) * smooth(.15, .3, Math.abs(G.tod - .5) * 2 - .3) * 1.2;
  const camFar = Math.max(220, scene.fog.far * 1.25); if (Math.abs(camera.far - camFar) > 10) { camera.far = camFar; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position); sky.scale.setScalar(camFar * .92); stars.position.copy(camera.position); stars.scale.setScalar(camFar * .9);
  clouds.position.set(camera.position.x, camera.position.y + 420, camera.position.z); clouds.material.map.offset.x += dt * .0016; clouds.material.map.offset.y += dt * .0007;
  clouds.material.color.copy(s.hor).lerp(_cb.set(0xffffff), .35).multiplyScalar(clamp(s.sunI / 2, .12, 1)); clouds.material.opacity = .75 * (1 - rk * .5);
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
        if (btn.id === 'bAim') { input.ads = !input.ads; btn.classList.toggle('lit', input.ads); } }
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

  updSmoke(G.t); grassU.uTime.value = G.t;
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
      const d = Math.hypot(e.x - P.x, e.z - P.z); e.g.visible = d < Math.max(160, scene.fog.far * 1.1);
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
  $('menu').innerHTML = (s && s.step > 0 ? '<button id="bCont">Continue</button><button class="sec" id="bNew">New game</button>' : '<button id="bNew">Start</button>') + `<button class="sec" id="bMute">Sound: ${muted ? 'off' : 'on'}</button><button class="sec" id="bCtrl">Controls: ${isTouch ? 'Phone' : 'Computer'}</button>`;
  $('keys').textContent = isTouch ? 'Left thumb: move (push to the edge to sprint) · right thumb: look · hold the crosshair button to fire · tap the toolbar to switch or eat · tap the minimap for the map · bag for inventory.' : 'WASD move · Shift sprint · mouse look · click fire · right-click aim · R reload · 1–5 toolbar · E use · Space jump/swim · I inventory · M map · F fly · N sound';
  $('bNew').onclick = () => { if (s && s.step > 0 && !confirmNew()) return; try { localStorage.removeItem(SAVE); } catch (e) {} startGame(true); };
  if ($('bCont')) $('bCont').onclick = () => startGame(false);
  $('bCtrl').onclick = () => { try { localStorage.setItem('arc-controls', isTouch ? 'pc' : 'phone'); } catch (e) {} location.reload(); };
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
window.__T = { scene, cam: camera, heightAt, floorAt, waterAt, THREE, CHUNKS, OCELLS, renderer, useSlot, toggleInv, toggleMap };
