
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
const INTERACT = [
  ...SHOP_DEFS.map(D => ({ id: 'st_' + D.id, at: () => D.spot, r: 2.6, label: () => D.id === 'bunk' && P.hp >= 100 ? null : D.stN, act: () => D.id === 'bunk' ? restBunk() : openCraft(D.cat) })),
  { id: 'forge', at: () => SHOP.craft.forge, r: 2.4, label: () => 'Forge · smelt + metalwork', act: () => openCraft('mat') },
  { id: 'fire', at: () => SPOTS.fire, r: 3.4, label: () => 'Cook at the fire', act: () => openCraft('food') },
  { id: 'smoke', at: () => SPOTS.smoke, r: 3.2, label: () => 'Drying rack · dry meat', act: () => openCraft('food') },
  { id: 'hulldoor', at: () => inHull(P.x, P.z) ? ARC_DOOR_IN : ARC_DOOR_OUT, r: 4.2, label: () => hullDoor.hp <= 0 ? (night.active ? 'The Arc’s doors are wrecked' : null) : hullDoor.open ? 'Seal the Arc’s blast doors' : 'Open the Arc’s blast doors', act: () => { if (hullDoor.hp <= 0) return; hullDoor.open = !hullDoor.open; sfx('gate'); toast(hullDoor.open ? 'Blast doors open' : `Blast doors sealed · ${Math.round(hullDoor.hp)} / ${hullDoor.max}`, 2); } },
  { id: 'crate', at: () => nearCrate(), r: 2.6, label: () => 'Search the crate', act: () => openCrate(nearCrate()) },
  { id: 'cache', at: () => nearCache(), r: 2.8, label: () => cacheAction(nearCache()).l, act: () => cacheAction(nearCache()).act() },
  { id: 'trader', at: () => nearShopNPC(), r: 4.4, label: () => { const e = nearShopNPC(), x = KEEPER_Q[e.name]; return `Trade with ${e.shopName}` + (x ? `  ·  ${isTouch ? 'hold' : 'Q'}: ${x.l()}` : ''); }, act: () => openTrade(nearShopNPC()), next: () => { const x = KEEPER_Q[nearShopNPC()?.name]; if (x) x.act(); } },
  { id: 'fstation', at: () => nearFStation(), r: 3, label: () => 'Farlight ' + STATION_N[nearFStation().st[0]].toLowerCase() + ' · craft', act: () => openCraft(nearFStation().st.includes('lab') ? 'med' : nearFStation().st.includes('forge') ? 'mat' : 'tool') },
  { id: 'bag', at: () => nearBag(), r: 2.6, label: () => 'Pick up your dropped bag', act: () => pickBag() },
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
    const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < 2.8 && d < bd) { bd = d; best = { it: { act: () => butcher(e) }, l: `Butcher the ${e.type}` }; }
  }
  if (!best && Math.hypot(P.x, P.z) > CAMP_R - 4) { const w = wildInteract(); if (w) best = { it: { act: w.act }, l: w.l, prog: w.prog, next: w.next, multi: w.multi }; }
  return best;
}
function useInteract() { if (curInter) curInter.it.act(); }

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
  respawnBases(); save();
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
  nextWave();
}
function nextWave() {
  night.wave++; night.left = Math.min(40, 4 + night.wave * 2 + Math.floor(G.day * (night.final ? 2.2 : .8))); night.spawnT = 1;
  if (night.wave > 1) { toast(`Wave ${night.wave}`); horn(82, 1.8, .2, 3); }
}
// who raids: the clans from the start, Ironjaw gunners from night 6, Greyhold soldiers from night 20, everyone on night 100
function raiderKind() {
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
      const [k, f] = raiderKind(); spawnClan(k, Math.sin(a) * r, Math.cos(a) * r, 'raid', f);
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
function startRust(scripted) {
  rust.state = 'warn'; rust.t = 22 + (has('detector') ? 25 : 0) + (G.flags.radioTower ? 10 : 0);
  horn(110, 3, .22, 0); setTimeout(() => horn(110, 3, .22, 0), 3600);
  say([['Radio', scripted ? "That's the mast horn! Red fog off the ridge — get under a roof, NOW." : 'Mast horn — the Rust is coming. Find cover.']]);
}
function nearestShelter() { let b = null, bd = 1e9; for (const s of SHELTERS) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; b = s; } } if (Math.hypot(P.x, P.z) - CAMP_R < bd) return { x: 0, z: 0, camp: true }; return b; }
function inShelter() { if (Math.hypot(P.x, P.z) < CAMP_R - 2 || inHull(P.x, P.z)) return true; return SHELTERS.some(s => Math.hypot(s.x - P.x, s.z - P.z) < s.r); }
function updRust(dt) {
  if (rust.state === 'none') {
    if ((G.chapterDone || G.day > 1) && !night.active && G.tod > .3 && G.tod < .68) { rust.next -= dt; if (rust.next <= 0) { rust.next = rr(220, 360); startRust(false); } }
    if (G.step === 8 && !G.flags.rustDone && Math.hypot(P.x, P.z) > 85) { G.flags.rustDone = 1; startRust(true); }
  } else if (rust.state === 'warn') { rust.t -= dt; rust.k = lerp(rust.k, .25, dt * .3); if (rust.t <= 0) { rust.state = 'active'; rust.t = 32; } }
  else if (rust.state === 'active') {
    rust.t -= dt; rust.k = lerp(rust.k, 1, dt * .8);
    P.safe = inShelter();
    const fr = fogResist(); if (!P.safe && !P.dead && fr < 1) { P.dose = (P.dose || 0) + dt * 1.2 * (1 - fr); P.hp -= 7 * dt * (1 - fr); P.coughT -= dt; if (P.coughT <= 0) { P.coughT = rr(1.2, 2.2); sfx('cough'); hud.hurt.style.opacity = .5; } }
    if (rust.t <= 0) { rust.state = 'clear'; rust.t = 8; say([['Radio', 'Fog is lifting. Breathe easy.']]); }
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
    const sees = (e.mode === 'guard' ? (gun ? 46 : 30) : 34) * stealthK() * (e.fac === 'clan' && P.paint > 0 ? .6 : 1) * (isNight() ? .7 : 1);
    if (dp < sees && !P.dead && !(e.blind > 0) && !(insideP && !gate.open) && !inSmoke(P.x, P.z)) { e.state = 'chase'; sfx('grunt'); alertNear(e); }
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
  e.ph += dt * v * 2.1; poseWalk(p, e.ph, Math.min(1, v / 3));
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
}
// a guard who spots you shouts: everyone near them joins in
function alertNear(e) { for (const o of ents) if (o !== e && o.type === 'clan' && !o.dead && o.state === 'idle' && Math.hypot(o.x - e.x, o.z - e.z) < 28) o.state = 'chase'; }
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
  } else if (e.guard && night.active && updGuard(e, dt)) {
    spd = 0;
  } else if (e.wander) {
    const inCamp = Math.hypot(e.home.x, e.home.z) < CAMP_R;
    e.t -= dt; if (e.t <= 0) { e.t = rr(4, 10); e.tx = e.home.x + rr(-8, 8); e.tz = e.home.z + rr(-8, 8); if (inCamp && Math.hypot(e.tx, e.tz) > CAMP_R - 6) { e.tx = e.home.x; e.tz = e.home.z; } }
    if (e.tx !== undefined && Math.hypot(e.tx - e.x, e.tz - e.z) > .6) { tx = e.tx; tz = e.tz; spd = 1.3; }
  } else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) > .6) { tx = e.home.x; tz = e.home.z; spd = 2; }
  if (e.guard && !night.active && rnd() < dt * .5) updGuard(e, dt);
  if (e === curShopE && invOpen && invTab === 'trade') { spd = 0; e.yaw += angWrap(Math.atan2(P.x - e.x, P.z - e.z) - e.yaw) * Math.min(1, dt * 4); }
  if (night.active && !e.follow && (e.name === 'extra' || e.settler) && Math.hypot(e.home.x, e.home.z) < CAMP_R) { if (!e.hullSpot) e.hullSpot = { x: ARC.x + rr(-22, 6), z: ARC.z + rr(-6, 4) }; tx = e.hullSpot.x; tz = e.hullSpot.z; spd = Math.hypot(tx - e.x, tz - e.z) > .8 ? 3.2 : 0; }
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
  n = onHurt(n, fx !== P.x || fz !== P.z);
  P.hp -= n; P.hurtT = .6; P.kick += .05; sfx('hurt'); hud.hurt.style.opacity = Math.min(1, .35 + n / 30);
  if (P.hp <= 0) die();
}
function die() {
  P.dead = true; P.hp = 0; $('dead').style.display = 'grid'; if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => {
    dropBag();
    $('dead').style.display = 'none'; P.dead = false; P.hp = 70; clearInjuries(); chan = null; P.food = Math.max(P.food, 50); P.fly = false;
    const sp = G.flags.spawn && PLACED.some(p => BUILD_DEF[p.k].rest && Math.hypot(p.x - G.flags.spawn.x, p.z - G.flags.spawn.z) < 1) ? G.flags.spawn : null;
    if (sp) { P.x = sp.x + 1.5; P.z = sp.z + 1.5; } else if (!G.flags.reached) { P.x = POI.dropsite.x + DROP_WAKE[0]; P.z = POI.dropsite.z + DROP_WAKE[1]; } else { P.x = SHOP.med.front.x; P.z = SHOP.med.front.z; }
    P.y = heightAt(P.x, P.z); P.pd = Math.hypot(P.x, P.z); P.pitch = 0; P.slot = slotWeapon(0) ? 0 : P.slot; selectGunView(gunId());
    if (INV.res < 30) INV.res = 30;
    const who = sp ? 'You wake up at your bed' : G.flags.reached ? 'Juno patched you up' : 'You come to by the wreck';
    toast(G.flags.bag ? `${who}. Your bag is where you fell — follow the light.` : `${who}.`, 4);
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
    if (e.type === 'clan') { sfx('grunt'); const dr = clanDrop(e); if (rnd() < .55) { INV.scrap++; dr.unshift(['scrap', 1]); } if (byPlayer && dr.length) toast(dr.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · '), 2); e.climbing = false; e.climbY = 0; e.g.position.y = e.y; }
    if (e.type === 'deer' || e.type === 'boar') { e.yaw = e.yaw; if (byPlayer) toast(`${e.type === 'deer' ? 'Deer' : 'Boar'} down — go butcher it`); }
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
  const lk = 1 / (1 + ((WEAPONS[gunId()]?.scope || 1) - 1) * P.ads * .8) / (P.binoc ? 3 : 1);
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
    const wantRun = !(P.frac > 0) && !P.over && (input.sprint || (isTouch && ml > .96) || P.runToggle) && my > .3 && !shopOpen && !input.ads && !input.fire && !P.swim && depth < .5;
    if (P.stam <= 0) P.winded = true; else if (P.winded && P.stam > 35) P.winded = false;
    sprint = wantRun && !P.winded;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let wx = fx * my + rx * mx, wz = fz * my + rz * mx;
    // slope along where you're heading
    let slopeK = 1;
    if (ml > .05 && P.onGround) { const wl2 = Math.hypot(wx, wz), dx = wx / wl2, dz = wz / wl2, gr = (heightAt(P.x + dx * 1.6, P.z + dz * 1.6) - heightAt(P.x, P.z)) / 1.6; slopeK = clamp(1 - Math.max(0, gr - .22) * 1.1, .38, 1) * (gr < -.25 ? 1.06 : 1); }
    const spd = (sprint ? 9.6 : 5.4) * (shopOpen ? 0 : 1) * (P.swim ? .55 : depth > .4 ? .7 : 1) * (1 - P.ads * .45) * slopeK * (P.frac > 0 ? .62 : 1) * (P.over ? .65 : 1) * (1 + wearStat('mob'));
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
  P.food = Math.max(0, P.food - dt * (P.sprinting ? .13 : .08) * (P.swim ? 1.6 : 1) * (1 - Math.min(.5, wearStat('warm') * (isNight() ? 1 : .4))));
  if (P.food <= 0) { P.hp -= dt * 1.2; if (P.hp <= 0) die(); }
  else if (P.food > 45 && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * (Math.hypot(P.x, P.z) < CAMP_R ? 1.6 : .5));
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
  const fov = (BASE_FOV + P.runK * 7) / (1 + ((W.scope || 1) - 1) * P.ads) / (P.binoc ? 4 : 1);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const scoped = (W.scope || 1) >= 4.5 && P.ads > .85;
  $('scope').classList.toggle('on', scoped); vm.visible = !scoped && !P.swim;
  // viewmodel: bob, kick, reload dip, swap drop; aiming slides it to the centre
  const rl = P.reload > 0 ? Math.sin((1 - P.reload / P.reloadMax) * Math.PI) : 0, sw = (P.swapT || 0) / .45;
  // running lowers and cants the gun; it lags a hair behind fast turns
  const rk2 = P.runK;
  vm.position.set(bobX * .8 - P.ads * W.at[0] + P.sway * .5 - rk2 * .03, bobY * .7 - rl * .16 - sw * .3 - rk2 * .07 - P.land * .3 + P.ads * (-W.at[1] - .085 - (W.scope > 2 ? .045 : 0)), P.kick * 1.1 + P.ads * .1 + rk2 * .03);
  vm.rotation.set(rl * .5 + P.kick * 1.4 - rk2 * .32 + Math.sin(P.bob) * .03 * rk2, P.sway * 1.5 + rk2 * .55, -rl * .3 + rk2 * .2 + P.roll * .5);
  weaponAnim(dt);
}
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
function updTime(dt) {
  if (night.active) { G.tod = lerp(G.tod, .92, dt * .2); }
  else if (G.todTarget != null) { G.tod = lerp(G.tod, G.todTarget, dt * .08); }
  else if (G.chapterDone && G.step >= 12 && !G.flags.reached) {
    // before you've reached Kestrel the raids aren't your fight: nights pass (a bit quicker) wherever you are
    G.tod += dt * (.56 / DAY_LEN) * (isNight() ? 2 : 1);
    if (G.tod >= 1) { G.tod -= 1; G.day++; toast(`Day ${G.day}`, 2.4); save(); }
  }
  else if (G.chapterDone && G.step >= 12) {
    G.tod += dt * (.56 / DAY_LEN);
    if (G.tod > .72 && !G.flags.duskWarn) { G.flags.duskWarn = 1; say([['Kade', 'Sun is going down. Get back inside the wall.']]); }
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
  if (rust.state === 'warn') alert = `Red fog in ${Math.ceil(rust.t)}s — get under a roof`;
  else if (rust.state === 'active' && !P.safe && fogResist() < .95) alert = 'Red fog — get under a roof!';
  else if (night.active) alert = `${night.final ? 'NIGHT 100' : 'Hold Kestrel'} · wave ${night.wave}/${night.waves}`;
  else if (P.food <= 0) alert = 'Starving — eat something';
  else if (P.bleed > 0) alert = 'Bleeding — bandage it (5)';
  else if (P.dose > 40) alert = 'Rust poisoning — Rust medicine (5)';
  else if (P.sick > 50) alert = 'Sick — a poultice will help (5)';
  hud.alert.textContent = alert; hud.alert.classList.toggle('on', !!alert); hud.alert.classList.toggle('rust', rust.state === 'warn' || rust.state === 'active');
  miniT -= dt; if (miniT <= 0) { miniT = .1; drawMini(); }
  if (invOpen) { invT -= dt; if (invT <= 0) { invT = .3; updInvBars(); if ((invTab === 'store' && storeAt && Math.hypot(storeAt.x - P.x, storeAt.z - P.z) > 5) || (invTab === 'trade' && !nearTrader())) { invTab = 'bag'; renderInv(); } } }
  updChan(dt); updStatus(dt); updLoad(dt);
  curInter = findInteract();
  if (curInter) {
    const bar = curInter.prog != null ? `<i class="pg"><i style="width:${Math.round(curInter.prog * 100)}%"></i></i>` : '';
    if (isTouch) { hud.use.style.display = 'grid'; hud.use.innerHTML = curInter.l.replace(/ {2}· {2}hold: [a-z]+/, '') + (curInter.multi ? ` <small>(hold: ${/dismantle/.test(curInter.l) ? 'dismantle' : 'next'})</small>` : '') + bar; hud.prompt.style.display = 'none'; }
    else { hud.prompt.style.display = 'block'; hud.prompt.innerHTML = (curInter.prog != null ? '' : '<kbd>E</kbd>') + curInter.l + bar; }
  } else { hud.prompt.style.display = 'none'; hud.use.style.display = 'none'; }
  hud.hurt.style.opacity = Math.max(0, (+hud.hurt.style.opacity || 0) - dt * 1.2);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) hud.toast.classList.remove('on'); }
  if (subT > 0) { subT -= dt; if (subT <= 0) nextLine(); }
}

/* ---------- the bag: Bag · Craft · Storage · Trade ---------- */
let invOpen = false, invT = 0;
function objectiveNow() {
  if (rust.state === 'warn' || rust.state === 'active') return 'Get under a roof until the fog lifts';
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
  const T = [['bag', 'Bag'], ['craft', 'Craft']]; if (storeAt && Math.hypot(storeAt.x - P.x, storeAt.z - P.z) < 5) T.push(['store', nameOf(storeAt.k)]); if (nearTrader()) T.push(['trade', 'Trade']);
  if (!T.some(t => t[0] === invTab)) invTab = 'bag';
  const tabs = `<div class="tabs">${T.map(([k, n]) => `<button data-tab="${k}" class="${invTab === k ? 'on' : ''}">${n}</button>`).join('')}<button class="xb" data-x="1">✕</button></div>`;
  const tags = statusTags().map(([t, c]) => `<span class="tag" style="--c:${c}">${t}</span>`).join('');
  const load = carryLoad(), cap = carryCap();
  const head = `<div class="stat"><span>Health</span><div class="bar"><i id="ivhp" style="width:${Math.max(0, P.hp)}%;background:#d9503a"></i></div><span>Food</span><div class="bar"><i id="ivfd" style="width:${P.food}%;background:#e0a040"></i></div><span>Load</span><div class="bar"><i style="width:${Math.min(100, load / cap * 100)}%;background:${load > cap ? '#e0573d' : '#7fc4b8'}"></i></div></div>${tags ? `<div class="tags">${tags}</div>` : ''}`;
  let body = '';
  if (invTab === 'bag') {
    const groups = bagGroups();
    const act = id => FOOD[id] ? `<button data-eat="${id}">${FOOD[id].k === 'water' ? 'Drink' : 'Eat'}</button>` : MEDS[id] ? `<button data-med="${id}">Use</button>` : BUILD_DEF[id] ? `<button data-place="${id}">Place</button>` : THROWS.includes(id) ? `<button data-thr="${id}">${P.thr === id ? 'Ready ✓' : 'Ready (G)'}</button>` : '';
    for (const c of BAG_ORDER) if (groups[c]) body += `<h4>${CAT_N[c]}</h4><div class="row">${groups[c].map(([id, n]) => itemTile(id, n, act(id))).join('')}</div>`;
    const sorted = [...INV.tools].sort((a, b) => (WDEF[b.id] ? 2 : GEAR_DEFS[b.id].kind === 'wear' ? 1 : 0) - (WDEF[a.id] ? 2 : GEAR_DEFS[a.id].kind === 'wear' ? 1 : 0));
    if (sorted.length) body += `<h4>Weapons, tools & gear · ${INV.tools.length}</h4><div class="row">${sorted.map(t => { const D = GEAR_DEFS[t.id], W = WDEF[t.id], b = [];
      if (D.kind === 'wear') b.push(`<button data-wear="${t.u}">${t.on ? 'Take off' : 'Wear'}</button>`);
      if (W && W.cls === 'gun') b.push(`<button data-eq="${t.u}" data-slot="0">Slot 1</button><button data-eq="${t.u}" data-slot="1">Slot 2</button>`);
      else if (W) b.push(`<button data-eq="${t.u}" data-slot="2">Slot 3</button>`);
      if (cnt('repair_kit') && t.d < t.max) b.push(`<button data-fix="${t.u}">Repair</button>`);
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
function updInvBars() { const a = $('ivhp'), b = $('ivfd'); if (a) a.style.width = Math.max(0, P.hp) + '%'; if (b) b.style.width = P.food + '%'; }
function openCraft(cat) { invTab = 'craft'; if (cat) craftCat = cat; toggleInv(true); }
function toggleInv(v = !invOpen) {
  if (v && mapOpen) toggleMap();
  invOpen = v; $('inv').classList.toggle('on', v); if (v) { renderInv(); if (document.pointerLockElement) document.exitPointerLock(); }
}
$('inv').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) { if (!e.target.closest('#invp')) toggleInv(false); return; }
  e.stopPropagation(); const d = b.dataset, g = u => INV.tools.find(t => t.u === +u);
  if (d.x) return toggleInv(false);
  if (d.tab) invTab = d.tab;
  else if (d.cat) craftCat = d.cat;
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
  else if (d.fix) { const t = g(d.fix); take('repair_kit', 1); t.d = Math.min(t.max, t.d + Math.round(t.max * .6)); sfx('buy'); toast(`${GEAR_DEFS[t.id].n} repaired`); save(); }
  else if (d.put || d.putall) storePut(d.put || d.putall, !!d.putall || e.shiftKey);
  else if (d.take || d.takeall) storeTake(d.take || d.takeall, !!d.takeall || e.shiftKey);
  else if (d.putg) storePut(+d.putg); else if (d.takeg) storeTake(+d.takeg);
  else if (d.buy) buyTrade(+d.buy); else if (d.sell) sellTrade(d.sell); else if (d.sellg) sellTrade(null, g(d.sellg));
  renderInv();
});
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
  if (e.code === 'KeyQ') { if (curInter && curInter.multi && curInter.next) curInter.next(); else swapGun(); }
  if (e.code === 'KeyG') throwNext();
  if (e.code === 'KeyB') { if (has('binoc')) { P.binoc = !P.binoc; toast(P.binoc ? 'Binoculars' : 'Binoculars away', 1); } }
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
    if (el && (el.closest('#mini') || el.closest('#bInv'))) { e.preventDefault(); if (el.closest('#mini')) toggleMap(); else { const now = performance.now(); toggleInv(); window.__bagT = now; } continue; }
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
  if (fps < 48) { n = Math.max(PR_MIN, prNow - .15); prHold = 20; }
  else if (fps > 58 && prHold <= 0) n = Math.min(PR_MAX, prNow + .1);
  if (Math.abs(n - prNow) > .01) { prNow = n; renderer.setPixelRatio(n); resize(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  adaptRes((now - last) / 1000);
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  G.t += dt;
  for (const f of DECOR_ANIM) f(G.t);
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
      if (d > 260 && e.type !== 'clan') continue;
      if (e.type === 'clan' && d > 300 && e.mode !== 'raid' && e.state === 'idle') continue;
      if (e.type === 'clan') updClan(e, dt); else if (e.type === 'npc') updNPC(e, dt); else updAnimal(e, dt);
    }
    updTowers(dt); updSpears(dt); updProj(dt); updPlaced(dt); updFarGroups(P.x, P.z);
    if (night.active) updNight(dt);
    updRust(dt); updTime(dt); updHUD(dt);
    // scrap pickup
    for (const s of SCRAPS) if (s.alive && Math.hypot(s.x - P.x, s.z - P.z) < 1.9 && !P.dead) {
      s.alive = false; s.g.visible = false; INV.scrap++; sfx('pickup');
      { const x = rnd() < .2 ? pick(['nails', 'screws', 'wire', 'nails']) : null; if (x) give(x, 1 + Math.floor(rnd() * 2)); toast(x ? `+1 scrap · +${nameOf(x).toLowerCase()}` : '+1 scrap', 1.3); }
      if (G.step === 2 && s.tag === 'field') { G.flags.fieldScrap = (G.flags.fieldScrap || 0) + 1; if (G.flags.fieldScrap >= 5) { setStep(3); say([['Radio', "Kade here — that's enough. Bring it to the bench."]]); } }
    }
    saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  }
  updParts(dt); updTracers(dt);
  grade.uniforms.t.value = G.t;
  composer.render(dt);
}

/* ================= regions + the valley map ================= */
/* distance culling for the hand-placed world: thousands of small props (crates, debris, fences, shop bits) each cost a draw
   call — twice with the sun's shadow — even when they're a few pixels on the horizon. Each prop group gets a draw distance
   from its size (small things fade out first, never past the haze); hidden ones go to layer 1, which neither the camera nor
   the shadow pass draws. Terrain, the forest, people and animals have their own streaming/culling. */
const CULL = []; let cullT = 0;
function buildCull() {
  const skip = new Set([...CHUNKS.values(), ...OCELLS.values(), ...ents.map(e => e.g)]);
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
    const on = Math.hypot(c.x - cx, c.z - cz) - c.r < Math.min(70 + c.r * 40, hz + c.r * 2, 750);
    if (on !== c.on) { c.on = on; for (const m of c.meshes) m.layers.mask = on ? 1 : 2; }
  }
}
const DROP_WAKE = (() => { const a = Math.atan2(-POI.dropsite.z, -POI.dropsite.x); return [-Math.cos(a) * 27 - Math.sin(a) * 3, -Math.sin(a) * 27 + Math.cos(a) * 3]; })();   // where you come to: in the furrow, looking into the torn end
function checkRegions() {
  const seen = G.flags.seen = G.flags.seen || {};
  if (!G.flags.reached && Math.hypot(P.x, P.z) < CAMP_R + 10) {
    G.flags.reached = 1; save();
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
  G.step = 13; G.chapterDone = true;
  G.flags.seen = G.flags.seen || {}; if (s && G.flags.reached == null) G.flags.reached = 1;   // saves from before the dropsite start already know Kestrel
  if (G.flags.reached) G.flags.seen.kestrel = 1; INV.rations = INV.rations || 0;
  invInit(); eqInit(); restorePlaced(); showBag(); gHinted = !!G.flags.craftHint;
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
    setTimeout(() => toast(isTouch ? 'Search the wreck · Bag → Craft to build here · the minimap shows the way to Kestrel' : 'E search the wreck · I bag + craft (build here) · M map — Kestrel is north-east', 6), 2500);
  } else toast(`Day ${G.day} · Tier ${tierNow()}`, 3);
  if (!isTouch) setTimeout(() => canvas.requestPointerLock?.(), 50);
}
function menu() {
  const s = load();
  $('menu').innerHTML = (s ? '<button id="bCont">Continue</button><button class="sec" id="bNew">New game</button>' : '<button id="bNew">Start</button>') + `<button class="sec" id="bMute">Sound: ${muted ? 'off' : 'on'}</button>`;
  $('keys').textContent = isTouch ? 'Left thumb: move (push to the edge to sprint) · right thumb: look · hold the crosshair button to fire · tap the toolbar to switch or eat · tap the minimap for the map · bag for inventory.' : 'WASD move · Shift sprint · mouse look · click fire · right-click aim · R reload · 1–5 toolbar · E use · Space jump/swim · I inventory · M map · N sound';
  $('bNew').onclick = () => { if (s && !confirmNew()) return; try { localStorage.removeItem(SAVE); } catch (e) {} startGame(true); };
  if ($('bCont')) $('bCont').onclick = () => startGame(false);
  $('bMute').onclick = () => { setMute(!muted); $('bMute').textContent = `Sound: ${muted ? 'off' : 'on'}`; };
}
let newArmed = false;
function confirmNew() { if (newArmed) return true; newArmed = true; $('bNew').textContent = 'Tap again to wipe save'; setTimeout(() => { newArmed = false; if ($('bNew')) $('bNew').textContent = 'New game'; }, 2500); return false; }

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
  buildHalvard(); buildBurn(); buildDropsite(); buildAshmere(); buildLake(); buildLookout(); buildBridge(); buildScoutCamps(); buildRelay();
  setLoad('RAISING CINDER CITY'); await nextFrame(); buildBases(); buildSmoke();
  setLoad('WALKING THE OUTLANDS'); await nextFrame(); buildOutlands();
  await buildFar();
  seedScraps(); seedCrates(); buildRifle(); selectGunView('carbine');
  for (const D of SHOP_DEFS.filter(D => D.who)) { const e = spawnNPC(D.who, D.keeper.x, D.keeper.z, { model: 'civilian', tint: D.tint, yaw: D.ry, h: rr(1.68, 1.82) }); e.shop = D.id; e.shopName = D.name; named[D.who] = e; }
  for (const [x, z] of [[-3, 10], [6, 30], [-14, 4], [20, 22], [-22, 24], [8, 2], [-8, 40], [14, 40]]) spawnNPC('extra', x, z, { wander: true });
  SETTLERS.forEach((S, i) => { const a = rnd() * 6.28, r = rr(8, 34), e = spawnNPC('settler', Math.sin(a) * r, Math.cos(a) * r + 8, { model: 'civilian', tint: S.tint, wander: true, h: rr(1.62, 1.84) }); e.settler = 1; e.shop = 'settler' + i; e.shopName = S.n; });
  ensureWildlife(); villageGuards(); buildCull();
  await buildMapCanvas(); resetExplore('');
  updTime(0); refreshEnv(G.tod, 0);
  menu();
  requestAnimationFrame(frame);
}
boot();
window.__arc = { G, P, INV, UP, night, rust, ents, gate, updNight, updClan, startNight, startRust, setStep, skipCine: () => skipCine(), get cine() { return cine; } };
window.__T = { spawnClan, inHull, hullDoor, SHOP, ARC, nearShopNPC, openTrade, findInteract, get named() { return named; }, get chanObj() { return chan; }, slotWeapon, equipTo, selectSlot, throwNext, CACHES, cacheAction, BASES, FOUNDRY, CITY, PLACED, tradeStock, rollLoot, newGear, ITEMS, RECIPES, GEAR_DEFS, cnt, give, craft, eatItem, healBest, nearNode, wildInteract, openCraft, placeKit, nearStation, get chan() { return chan; }, updTerrain, updForest, CLOUDS, FAR_SMOKE, get far() { return { farTerrMesh, horizonMesh, farTrees }; }, scene, cam: camera, heightAt, floorAt, waterAt, THREE, CHUNKS, OCELLS, renderer, useSlot, toggleInv, toggleMap };
