
/* ================= the settlement and its people (Nov 11, Part 5 of the overhaul) =================
   Kestrel grows from a landing camp into a town, and the people in it have names, jobs and moods.
   · ROSTER (G.flags.set.ros): Kestrel's six settlers to begin with, plus everyone you bring in — prisoners you free
     (Part 4), lone survivors out in the world (talk to them), and later the story. Each has a trait and a job.
   · jobs: gather, hunt, farm, cook, build, guard, scout, repair, medic (or idle). Outdoor jobs walk out of the gate in the
     morning and come back at dusk; the rest work at their building in Kestrel. Every morning (`setDay`) the jobs bring
     things into the Kestrel stores (the crates by the fire): wood, stone, meat, vegetables, cooked food, scrap, salvage;
     scouts find places for your map; guards man the wall at night; medics and repairers look after you.
   · morale (0–100): safety (walls, turrets, guards, how the last raid went), food in the stores, beds against people,
     who's been lost and who's been saved, what's been built. It scales everything they bring in; very low, someone leaves.
   · projects: bigger buildings raised outside the wall on the plots `xSites` keeps clear (XPLOTS): housing, a
     smokehouse, a greenhouse, an infirmary, outer watchtowers, a generator, a workshop, a barracks. Each takes materials
     from the stores and days of builders' work; the settlement's level follows how much has been built
     (Landing camp → Settlement → Fortified → Town).
   · bag → Settlement: the roster (assign jobs), morale and why, projects, and the stores (take, or give from your bag). */

const JOBS = {
  idle: { n: 'Resting', d: 'Doing odd jobs round the yard' },
  gather: { n: 'Gathering', d: 'Wood, stone and fibre from outside the wall', away: 1 },
  hunt: { n: 'Hunting', d: 'Meat and hides', away: 1 },
  farm: { n: 'Farming', d: 'Vegetables (more with a greenhouse)' },
  cook: { n: 'Cooking', d: 'Turns raw meat in the stores into cooked meals' },
  build: { n: 'Building', d: 'Works on the current project' },
  guard: { n: 'On watch', d: 'Mans the wall when the horn goes' },
  scout: { n: 'Scouting', d: 'Finds places for the map, and the odd stash', away: 1 },
  repair: { n: 'Repairing', d: 'Mends your gear when you’re home; salvage from scrap' },
  medic: { n: 'Medic', d: 'Patches you up faster in Kestrel; keeps people alive' },
};
const TRAITS = [['steady', 'Steady'], ['cheerful', 'Cheerful'], ['grim', 'Grim'], ['brave', 'Brave'], ['careful', 'Careful'], ['restless', 'Restless'], ['kind', 'Kind'], ['sharp', 'Sharp-eyed']];
const TRAIT_JOB = { brave: 'guard', careful: 'repair', kind: 'medic', 'sharp': 'scout', restless: 'hunt', steady: 'build', cheerful: 'cook', grim: 'gather' };
const FIRST = ['Ada', 'Bram', 'Cass', 'Dov', 'Eli', 'Fen', 'Greta', 'Hale', 'Ines', 'Jory', 'Kit', 'Lena', 'Milo', 'Nell', 'Osk', 'Pia', 'Quin', 'Rhea', 'Saul', 'Tove', 'Ulla', 'Vic', 'Wren', 'Yara', 'Zed', 'Bo', 'Cole', 'Dara', 'Ezra', 'Fay'];
const PROJECTS = {
  housing: { n: 'Housing block', d: '+6 beds', cost: { log: 18, stone: 10, scrap: 20 }, w: 4 },
  smoke: { n: 'Smokehouse', d: 'Cooks make twice as much; +morale', cost: { log: 10, stone: 8 }, w: 3 },
  green: { n: 'Greenhouse', d: 'Farmers grow twice as much', cost: { log: 12, fiber: 10, scrap: 12 }, w: 3 },
  infirm: { n: 'Infirmary ward', d: 'You heal fast in Kestrel; people downed in the fog pull through', cost: { log: 10, scrap: 20, cloth: 6 }, w: 4 },
  towers: { n: 'Outer watchtowers', d: 'Two manned towers outside the wall; raids start thinner', cost: { log: 16, scrap: 25, stone: 6 }, w: 4 },
  power: { n: 'Generator shed', d: 'Lights along the road at night; +morale', cost: { scrap: 40, wire: 6 }, w: 3 },
  shop: { n: 'Workshop', d: 'Repairers do twice as much; salvage', cost: { log: 8, scrap: 30 }, w: 3 },
  barracks: { n: 'Barracks', d: 'Guards count double on the wall', cost: { log: 16, stone: 12, scrap: 10 }, w: 4 },
};
const PROJ_IDS = Object.keys(PROJECTS);
const SET_LEVELS = ['Landing camp', 'Settlement', 'Fortified', 'Town'];
function setS() { return G.flags.set ||= { ros: [], morale: 55, proj: {}, cur: null, stores: {}, lost: 0, saved: 0, lastWin: 1, why: [], seq: 0, lone: {} }; }
const setLevel = () => { const n = Object.values(setS().proj).filter(p => p.done).length; return n >= 7 || (G.day > 100 && n >= 5) ? 3 : n >= 4 || G.flags.held100 ? 2 : n >= 1 || setS().ros.length > 8 ? 1 : 0; };
const projDone = id => !!(setS().proj[id] && setS().proj[id].done);
const housing = () => 10 + (projDone('housing') ? 6 : 0) + PLACED.filter(p => BUILD_DEF[p.k] && BUILD_DEF[p.k].rest && Math.hypot(p.x, p.z) < CAMP_R + 120).length;
const stores = () => setS().stores;
const sCnt = id => stores()[id] || 0;
const sAdd = (id, n) => { const S = stores(); S[id] = Math.max(0, (S[id] || 0) + n); if (!S[id]) delete S[id]; };

/* ---------- people ---------- */
let SROS = {};          // survivor id → entity
function newSurvivor(origin, name) {
  const S = setS(); S.seq++; let s = S.seq * 7919 + G.day * 131; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tr = TRAITS[Math.floor(r() * TRAITS.length)][0], used = new Set(S.ros.map(x => x.n));
  let n = name; for (let k = 0; !n || used.has(n); k++) n = FIRST[Math.floor(r() * FIRST.length)] + (k > 30 ? ' ' + k : '');
  const R = { id: 'sv' + S.seq, n, trait: tr, job: TRAIT_JOB[tr] || 'gather', origin, joined: G.day };
  S.ros.push(R); return R;
}
function spawnSurvivor(R, at) {
  const n = at || pick(WALK.nodes), e = spawnNPC('settler', n.x + rr(-1, 1), n.z + rr(-1, 1), { model: pick(['civilian', 'settler', 'settler']), tint: pick([0xa08868, 0x8aa0b0, 0x9a8a6a, 0xb09080, 0x7a8a6a, 0xa0a0b8]), wander: true, h: rr(1.62, 1.86) });
  e.settler = 1; e.shop = 'settler' + (parseInt(R.id.slice(2)) % SETTLERS.length); e.shopName = R.n; e.sid = R.id; SROS[R.id] = e; return e;
}
// Kestrel's first six are on the roster from the start
function setInitRoster() {
  const S = setS();
  for (const e of ents) if (e.settler && !e.sid && e.shopName) {
    let R = S.ros.find(x => x.n === e.shopName && x.origin === 'kestrel');
    if (!R) { const i = SETTLERS.findIndex(x => x.n === e.shopName); const tr = TRAITS[(i * 3 + 1) % TRAITS.length][0]; S.seq++; R = { id: 'sv' + S.seq, n: e.shopName, trait: tr, job: ['gather', 'hunt', 'cook', 'build', 'farm', 'guard'][i % 6], origin: 'kestrel', joined: 1 }; S.ros.push(R); }
    e.sid = R.id; SROS[R.id] = e;
  }
}
const survEnt = R => { const e = SROS[R.id]; return e && !e.dead && ents.includes(e) ? e : null; };
// updNPC hook: outdoor jobs leave in the morning and come home at dusk; indoor jobs keep to their building
function setNPC(e, dt) {
  if (!e.sid) return false;
  if (e.comp) return compUpd(e, dt);   // the companion out with you — 2l-combat.js
  const R = setS().ros.find(x => x.id === e.sid); if (!R) { e.g.visible = true; return false; }
  if (R.held) { e.g.visible = false; return true; }
  const J = JOBS[R.job] || JOBS.idle, workHours = G.tod > .33 && G.tod < .66 && !night.active && rust.state === 'none' && !e.downed && !e.follow;
  if (J.away && workHours) {
    if (!e.away) { // walk to the gate first, then out of sight
      const d = Math.hypot(e.x, e.z - (CAMP_R - 3));
      if (d > 3.5 && !(e.outbound && !e.route)) { if (!e.outbound || !e.route) { const a = WALK.nearest(e.x, e.z); e.route = [a, ...WALK.path(a, WALK.nearest(0, CAMP_R - 4))]; e.outbound = 1; e.wait = 0; } return false; }
      e.away = true; e.outbound = 0; e.route = null; e.g.visible = false;
    }
    return true;
  }
  if (e.away) { e.away = false; e.g.visible = true; e.x = rr(-2, 2); e.z = CAMP_R - 3; e.route = null; e.wait = 0; }
  e.outbound = 0;
  if (R.job === 'guard') e.guard = true; else if (e.guard && !e.watch) e.guard = false;
  return false;
}

/* ---------- the stores (crates by the fire) ---------- */
let STORE_SPOT = null;
function buildStores() {
  const x = SPOTS.fire.x + 3.4, z = SPOTS.fire.z - 3.2, y = heightAt(x, z), g = new THREE.Group();
  for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.9, .7, .8), M(pick([0x6a5038, 0x5a4a34, 0x7a5e40])), (i % 3) * .95 - .95, .35 + (i > 2 ? .7 : 0), i > 2 ? 0 : rr(-.1, .1), g);
  mesh(new THREE.CylinderGeometry(.32, .32, .9, 10), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x5a6a7a }), 1.7, .45, .3, g);
  const sign = mesh(new THREE.BoxGeometry(1.1, .45, .05), M(0x8a7258), 0, 1.75, -.3, g); mesh(new THREE.BoxGeometry(.06, 1.2, .06), M(0x4a3a2a), 0, 1.1, -.32, g);
  g.position.set(x, y, z); world.add(g); addCol(x, z, 1.4); STORE_SPOT = { x, z };
}
const nearStores = () => STORE_SPOT && Math.hypot(P.x - STORE_SPOT.x, P.z - STORE_SPOT.z) < 3.4 ? STORE_SPOT : null;
const inKestrel = () => Math.hypot(P.x, P.z) < CAMP_R + 6;

/* ---------- projects: the buildings outside the wall ---------- */
const PROJ_PLOT = { housing: 0, smoke: 1, green: 2, infirm: 3, towers: 4, power: 5, shop: 6, barracks: 7 };
const PGROUP = {};
function projPlot(id) { return XPLOTS[PROJ_PLOT[id]] || XPLOTS[0]; }
function buildProject(id, stage) {   // stage 0 nothing, 1 scaffold, 2 done
  if (PGROUP[id]) { world.remove(PGROUP[id]); PGROUP[id] = null; }
  if (!stage) return;
  const Pl = projPlot(id); if (!Pl) return; const yaw = Math.atan2(-Pl.x, -Pl.z), g = new THREE.Group(), y0 = xLowest(Pl.x, Pl.z, 10, 8, yaw);
  g.position.set(Pl.x, y0, Pl.z); g.rotation.y = yaw; world.add(g); PGROUP[id] = g;
  const wood = xm('wood'), roof = new THREE.MeshLambertMaterial({ map: texCorr, color: pick([0x8a5a3a, 0x6a6a5a, 0x7a4a3a]) });
  if (stage === 1) {   // a frame going up, timber stacked beside it
    for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3], [0, -3], [0, 3]]) xbox(g, .2, 4, .2, 'wood', x, 2, z);
    for (const z of [-3, 3]) xbox(g, 8.4, .2, .2, 'wood', 0, 3.9, z); for (const x of [-4, 4]) xbox(g, .2, .2, 6.4, 'wood', x, 3.9, 0);
    xbox(g, 8.6, .3, 6.6, 'concD', 0, .15, 0); for (let i = 0; i < 6; i++) xbox(g, 3, .25, .25, 'wood', 6.2, .2 + i * .26, -2 + (i % 2) * .3);
    const lad = xbox(g, .5, 3.5, .1, 'woodD', -4.6, 1.7, 0); lad.rotation.z = .25; return;
  }
  const shed = (w, d, h, col = 0x8a7a66) => { xbox(g, w + .4, .3, d + .4, 'concD', 0, .15, 0); const m = new THREE.MeshLambertMaterial({ map: texWood, color: col });
    for (const [x, z, ww, dd] of [[0, -d / 2, w, .2], [-w / 2, 0, .2, d], [w / 2, 0, .2, d], [-w / 4 - .5, d / 2, w / 2 - 1, .2], [w / 4 + .5, d / 2, w / 2 - 1, .2]]) xbox(g, ww, h, dd, m, x, h / 2 + .3, z);
    xbox(g, 2, .6, .2, m, 0, h - .0, d / 2); for (const s of [-1, 1]) { const r = xbox(g, w + 1, .12, d / 2 + .9, roof, 0, h + .9, s * d / 4); r.rotation.x = s * .35; }
    for (const x of [-w / 3, w / 3]) { const win = mesh(new THREE.PlaneGeometry(.9, .7), new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }), x, 1.8, d / 2 + .11, g); win.userData.win = 1; }
    colRect(Pl.x, Pl.z, w, d, yaw, .5, [0]); };
  if (id === 'housing') { shed(9, 7, 5.6); xbox(g, 9.2, .2, 7.2, 'woodD', 0, 2.9, 0); for (let k = 0; k < 3; k++) { const l = mesh(new THREE.BoxGeometry(.8, .5, .05), M(pick([0x8a3a2a, 0x3a5a8a, 0xd8c890])), -3 + k * 1.2, 2.2, 3.62, g); } }
  else if (id === 'smoke') { shed(7, 6, 3.4, 0x6a5a48); xcyl(g, .3, .3, 3, 'metal', 2.4, 5, -1, 8); SMOKES.push({ x: Pl.x, z: Pl.z, y: y0 + 6, k: rnd() }); }
  else if (id === 'green') { xbox(g, 6.4, .3, 8, 'concD', 0, .15, 0); for (let i = 0; i < 4; i++) { const a = mesh(new THREE.CylinderGeometry(3, 3, 2, 12, 1, true, -XHPI, Math.PI), xm('glass'), 0, .3, -3 + i * 2, g); a.rotation.x = -XHPI; }
    for (let i = 0; i < 24; i++) mesh(new THREE.ConeGeometry(.2, rr(.4, .9), 5), new THREE.MeshLambertMaterial({ color: pick([0x4a8a2a, 0x6a9a3a, 0x8aaa3a]) }), rr(-2.4, 2.4), .7, rr(-3.4, 3.4), g); colRect(Pl.x, Pl.z, 6, 8, yaw, .4, [0]); }
  else if (id === 'infirm') { shed(9, 6, 3.6, 0xc8c2b6); xbox(g, 1.4, .35, .06, 'paint', 0, 3.1, 3.12); xbox(g, .35, 1.4, .06, 'paint', 0, 3.1, 3.13); }
  else if (id === 'towers') { for (const s of [-1, 1]) { const t = new THREE.Group(); t.add(mesh(lattice(3, 7, 0x5a4430, 2.4), VCOL)); xbox(t, 3.4, .2, 3.4, 'woodD', 0, 7, 0); for (const k of [[0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]]) xbox(t, k[0] ? .1 : 3.4, 1, k[0] ? 3.4 : .1, 'wood', k[0], 7.5, k[1]); t.position.set(s * 5, 0, 0); g.add(t); const [tx, tz] = xFrame(Pl.x, Pl.z, yaw)(s * 5, 0); addCol(tx, tz, 1.8); } }
  else if (id === 'power') { shed(5, 4, 3, 0x6a7058); xbox(g, 2.2, 1.4, 1.2, 'olive', 3.8, .7, 0); for (let i = 0; i < 4; i++) { xcyl(g, .08, .1, 6, 'woodD', -6 + i * 2.5, 3, 4.5, 6); xLamp(g, -6 + i * 2.5, 6, 4.5, 0xffd8a0, .8, 18); } }
  else if (id === 'shop') { shed(9, 7, 4, 0x8a7a66); xModel(g, 'props/tool-racks', 2, -2, .3, -3, 0); xbox(g, 2.4, .9, 1, 'metal', 2, .75, -2.4); }
  else if (id === 'barracks') { shed(11, 6, 3.6, 0x6a6a58); for (let i = 0; i < 3; i++) xbox(g, .9, .4, .4, 'sand', -4 + i * 4, .5, 3.6); }
  try { const dyn = new Set(); g.traverse(o => { if (o.userData && o.userData.win) dyn.add(o); }); bakeGroup(g, dyn, 30); } catch (e) {}
}
// the watch in the new outer towers
let towerGuards = [];
function setTowerGuards() {
  for (const e of towerGuards) removeEnt(e); towerGuards = [];
  if (!projDone('towers')) return; const Pl = projPlot('towers'), yaw = Math.atan2(-Pl.x, -Pl.z);
  for (const s of [-1, 1]) { const [x, z] = xFrame(Pl.x, Pl.z, yaw)(s * 5, 0); const e = spawnNPC('watch', x, z, { model: 'keeper', armed: true, yaw, h: 1.8 }); e.guard = true; e.watch = 1; e.towerY = 7.2; towerGuards.push(e); }
}

/* ---------- each morning ---------- */
let setLastDay = -1;
function setDay(quiet) {
  setLastDay = G.day; const S = setS(), out = {}, why = [];
  // newcomers: people you freed, people you talked into coming
  const arrive = (G.flags.rescued || 0) - (S.rescuedSeen || 0); S.rescuedSeen = G.flags.rescued || 0;
  const pend = S.pending || []; S.pending = [];
  const names = [];
  for (let i = 0; i < arrive; i++) { const R = newSurvivor('rescued'); spawnSurvivor(R, { x: 0, z: CAMP_R - 3 }); names.push(R.n); S.saved++; }
  for (const P2 of pend) { const R = newSurvivor('found', P2.n); R.trait = P2.trait || R.trait; R.job = TRAIT_JOB[R.trait] || 'gather'; spawnSurvivor(R, { x: 0, z: CAMP_R - 3 }); names.push(R.n); S.saved++; }
  if (names.length && !quiet) setTimeout(() => say([['Kade', `${names.join(' and ')} ${names.length > 1 ? 'have' : 'has'} come to Kestrel. Find them something to do.`]]), 5500);
  if (names.includes('Mina') && !quiet) setTimeout(() => say([['Mina', 'If you go out again, take me with you. I can shoot. (Bag → Settlement → Bring along.)']]), 12000);
  // the dead and the gone
  for (const R of [...S.ros]) { const e = SROS[R.id]; if (e && e.dead) { S.ros.splice(S.ros.indexOf(R), 1); S.lost++; why.push(`${R.n} died`); } }
  // morale
  const pop = S.ros.length, cap = housing(), guards = S.ros.filter(R => R.job === 'guard').length * (projDone('barracks') ? 2 : 1);
  const food = ['meat', 'ration', 'dried_meat', ...VEG].reduce((a, k) => a + sCnt(k), 0);
  let m = 45; const add = (v, t) => { m += v; if (Math.abs(v) >= 3) why.push(`${v > 0 ? '+' : ''}${Math.round(v)} ${t}`); };
  add(UP.wall * 3 + UP.tur * 3 + Math.min(12, guards * 3), 'walls and watch');
  add(S.lastWin ? 4 : -12, S.lastWin ? 'held last night' : 'raiders got in');
  add(food >= pop * 2 ? 8 : food >= pop ? 0 : -10, food >= pop * 2 ? 'full stores' : food >= pop ? 'food' : 'not enough food');
  add(cap >= pop ? 5 : -(pop - cap) * 4, cap >= pop ? 'a bed each' : 'people sleeping on floors');
  add(Object.values(S.proj).filter(p => p.done).length * 3, 'what’s been built');
  add(projDone('smoke') ? 3 : 0, 'smokehouse'); add(S.fever ? -12 : 0, 'the fever'); add(projDone('power') ? 4 : 0, 'lights at night'); add(projDone('gatehouse') ? 3 : 0, 'the gatehouse');
  add(Math.min(10, S.saved * 2) - Math.min(20, S.lost * 6), 'the saved and the lost');
  S.morale = clamp(lerp(S.morale, clamp(m, 0, 100), .5), 0, 100); S.why = why.slice(0, 8);
  const mk = .5 + S.morale / 100;
  // the day's work (yesterday's), into the stores
  let pts = 0;
  for (const R of S.ros) {
    const g = (id, n) => { const v = Math.max(0, Math.round(n * mk * (R.trait === 'restless' && JOBS[R.job].away ? 1.2 : 1))); if (v) { sAdd(id, v); out[id] = (out[id] || 0) + v; } };
    switch (R.job) {
      case 'gather': g('log', 3); g('stone', 3); g('fiber', 3); if (rnd() < .3) g('flint', 1); break;
      case 'hunt': g('meat', 3); g('hide', 1); if (rnd() < .4) g('bone', 2); break;
      case 'farm': g(pick(VEG), projDone('green') ? 6 : 3); break;
      case 'cook': { const raw = Math.min(sCnt('meat'), projDone('smoke') ? 6 : 3); sAdd('meat', -raw); g('ration', raw); if (!raw) g('ration', 1); break; }
      case 'build': pts += R.trait === 'steady' ? 1.3 : 1; break;
      case 'scout': { const un = REGIONS.filter(Rg => !Rg.river && !Rg.area && !(G.flags.seen || {})[Rg.id] && Rg.x != null); if (un.length && rnd() < .5 * mk) { const Rg = pick(un); (G.flags.seen ||= {})[Rg.id] = 1; why.push(`${R.n} scouted ${Rg.name}`); } if (rnd() < .4) for (const [id, n] of rollLootQuiet('wild')) g(id, n); break; }
      case 'repair': g('spare_parts', projDone('shop') ? 2 : 1); if (rnd() < .3) g('nails', 4); break;
      case 'medic': g('herb_bandage', 1); break;
      case 'guard': break;
      default: if (rnd() < .5) g('stick', 3);
    }
  }
  // the current project
  if (S.cur) { const J = S.proj[S.cur]; J.pts = (J.pts || 0) + pts * mk; if (J.pts >= PROJECTS[S.cur].w) { J.done = 1; buildProject(S.cur, 2); if (S.cur === 'towers') setTowerGuards(); why.push(`${PROJECTS[S.cur].n} finished`); if (!quiet) setTimeout(() => card(PROJECTS[S.cur ?? ''] ? PROJECTS[S.cur].n.toUpperCase() : 'BUILT', 'Finished · Kestrel ' + SET_LEVELS[setLevel()].toLowerCase(), 3.6), 7000); S.curDone = S.cur; S.cur = null; } }
  // very low morale: someone walks
  if (S.morale < 18 && S.ros.length > 4 && rnd() < .35) { const R = pick(S.ros.filter(r => r.origin !== 'kestrel')) || null; if (R) { S.ros.splice(S.ros.indexOf(R), 1); const e = SROS[R.id]; if (e) removeEnt(e); why.push(`${R.n} left Kestrel`); } }
  // a small gift when spirits are high
  if (S.morale > 72 && rnd() < .3) { const gift = pick(['canned', 'bandage', 'ammo_9', 'herb_med', 'rope']); give(gift, 2); why.push(`the settlers left you ${nameOf(gift).toLowerCase()}`); }
  S.lastOut = out; S.lastWhy = why; S.lastWin = 1;
  if (!quiet && Object.keys(out).length) setTimeout(() => toast(`Settlers brought in: ${Object.entries(out).slice(0, 5).map(([k, n]) => `${n} ${nameOf(k).toLowerCase()}`).join(' · ')} · morale ${Math.round(S.morale)}`, 4.2), 9000);
  save();
}
// loot without the toast or giving it to the player
function rollLootQuiet(t) { const T = LOOT[t] || LOOT.wild, out = []; for (const [id, [p, a = 1, b = a]] of Object.entries(T)) if (rnd() < p * .5) out.push([id, a + Math.floor(rnd() * (b - a + 1))]); return out.slice(0, 3); }

/* ---------- lone survivors out in the world ---------- */
const LONERS = [];
function buildLoners() {
  const spots = [[XSITES.millbrook, 'Hanne', 'kind', 'I stayed when they all walked to Hesper. Somebody had to feed the dogs. The dogs are gone now.'],
    [XCAMPS[1], 'Tobin', 'restless', 'I came down in the pod. Nine days on my own. Is there really a place with a wall?'],
    [XSITES.kvrn, 'Sela', 'sharp', 'I keep the station’s tape running. I don’t know why. Someone should be listening.'],
    [XCAMPS[6], 'Marek', 'grim', 'The wolves had my herd. I’ve got nothing left to watch over.'],
    [XSITES.route9, 'Joss', 'careful', 'I can fix nearly anything with an engine in it. Nothing here has an engine that runs.'],
    [XSITES.longfall, 'Ruth', 'steady', 'I was Ring C. Nine of us walked out. I’m the last one still walking.']];
  for (const [S, n, trait, line] of spots) { if (!S) continue; const x = S.x + 6, z = S.z + 5; const e = spawnNPC('loner', x, z, { model: pick(['civilian', 'settler']), yaw: rr(0, 6), h: rr(1.64, 1.82) }); e.lone = n; e.loneTrait = trait; e.loneLine = line; LONERS.push(e); }
}
const nearLoner = () => { for (const e of LONERS) if (!e.dead && e.g.visible && Math.hypot(e.x - P.x, e.z - P.z) < 3) return e; return null; };
function lonerSync() { const L = setS().lone || {}; for (const e of LONERS) e.g.visible = !L[e.lone]; }

/* ---------- the Settlement tab ---------- */
function settlementHTML() {
  const S = setS(), home = inKestrel(), lv = setLevel(), pop = S.ros.length, cap = housing();
  let h = `<p class="dim"><b>${SET_LEVELS[lv]}</b> · ${pop} people · ${cap} beds · morale <b style="color:${S.morale > 60 ? '#7fc4b8' : S.morale < 30 ? '#e0573d' : '#efe9dc'}">${Math.round(S.morale)}</b>${home ? '' : ' · <i>jobs and projects can only be changed in Kestrel</i>'}</p>`;
  h += `<div class="bar" style="height:6px;margin:2px 0 6px;background:#0005"><i style="display:block;height:100%;width:${S.morale}%;background:${S.morale > 60 ? '#7fc4b8' : S.morale < 30 ? '#e0573d' : '#e0a040'}"></i></div>`;
  if (S.why && S.why.length) h += `<p class="dim" style="font-size:.9em">${S.why.join(' · ')}</p>`;
  h += `<h4>People</h4><div class="jn">`;
  for (const R of S.ros) {
    const tr = (TRAITS.find(t => t[0] === R.trait) || ['', ''])[1], e = survEnt(R), st = e && e.away ? 'out working' : e && e.downed ? 'down in the fog' : e ? '' : 'missing';
    h += `<div style="padding:6px 8px;border:1px solid #fff2;border-radius:3px;background:#0002"><b>${R.n}</b> <small style="opacity:.7">${tr}${R.origin !== 'kestrel' ? ' · ' + (R.origin === 'rescued' ? 'rescued' : 'found') + ' day ' + R.joined : ''}${st ? ' · ' + st : ''}</small><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">`;
    for (const j in JOBS) h += `<button data-sj="${j}" data-sid="${R.id}" class="${R.job === j ? 'on' : home ? '' : 'dis'}" title="${JOBS[j].d}">${JOBS[j].n}</button>`;
    { const isC = (G.flags.comp || {}).id === R.id; h += `<button data-sc="${isC ? '-' : R.id}" class="${isC ? 'on' : home && e && !R.held ? '' : 'dis'}" style="margin-left:auto">${isC ? 'With you · send home' : 'Bring along'}</button>`; }
    h += `</div></div>`;
  }
  h += `</div><h4>Projects · outside the wall</h4><div class="jn">`;
  for (const id of PROJ_IDS) {
    const Pj = PROJECTS[id], J = S.proj[id] || {}, cost = Object.entries(Pj.cost), can = cost.every(([k, n]) => sCnt(k) >= n);
    const state = J.done ? '<b style="color:#7fc4b8">built</b>' : S.cur === id ? `building · ${Math.min(100, Math.round((J.pts || 0) / Pj.w * 100))}% (${S.ros.filter(R => R.job === 'build').length} builders)` : '';
    h += `<div style="padding:6px 8px;border:1px solid #fff2;border-radius:3px;background:#0002"><b>${Pj.n}</b> <small style="opacity:.75">${Pj.d}</small> ${state ? '· ' + state : ''}`;
    if (!J.done && S.cur !== id) h += `<div><small>${cost.map(([k, n]) => `<span style="color:${sCnt(k) >= n ? '#7fc4b8' : '#e0a040'}">${nameOf(k).toLowerCase()} ${sCnt(k)}/${n}</span>`).join(' · ')}</small> <button data-sp="${id}"${can && home && !S.cur ? '' : ' class="dis"'}>${S.cur ? 'one at a time' : 'Start'}</button></div>`;
    h += '</div>';
  }
  const items = Object.entries(S.stores).filter(([, n]) => n > 0);
  h += `</div><h4>Kestrel stores${nearStores() ? '' : ' · <small>at the crates by the fire</small>'}</h4><div class="row">${items.length ? items.map(([id, n]) => itemTile(id, n, nearStores() ? `<button data-st="${id}">Take</button>` : '')).join('') : '<p class="dim">Empty. Settlers on jobs fill it every morning.</p>'}</div>`;
  if (nearStores()) { const groups = bagGroups(); h += `<h4>Give from your bag</h4><div class="row">`; for (const c of BAG_ORDER) for (const [id, n] of groups[c] || []) if (ITEMS[id] && ITEMS[id].c !== 'story') h += itemTile(id, n, `<button data-sg="${id}">Give</button>`); h += '</div>'; }
  return h;
}
function setAction(d, shift) {
  const S = setS();
  if (d.sc) { if (d.sc === '-') compSet(null); else { if (!inKestrel()) { sfx('no'); return; } compSet(d.sc); } save(); return; }
  if (d.sj) { if (!inKestrel()) { sfx('no'); return; } const R = S.ros.find(x => x.id === d.sid); if (R) { R.job = d.sj; sfx('pickup'); } }
  else if (d.sp) { const Pj = PROJECTS[d.sp]; if (S.cur || !inKestrel() || !Object.entries(Pj.cost).every(([k, n]) => sCnt(k) >= n)) { sfx('no'); return; } for (const [k, n] of Object.entries(Pj.cost)) sAdd(k, -n); S.proj[d.sp] = { pts: 0 }; S.cur = d.sp; buildProject(d.sp, 1); sfx('buy'); toast(`${Pj.n} started · put people on Building to finish it`, 3); }
  else if (d.st) { if (!nearStores()) return; const n = shift ? sCnt(d.st) : Math.min(sCnt(d.st), 5); sAdd(d.st, -n); give(d.st, n); sfx('pickup'); }
  else if (d.sg) { if (!nearStores()) return; const n = shift ? cnt(d.sg) : Math.min(cnt(d.sg), 5); take(d.sg, n); sAdd(d.sg, n); sfx('pickup'); }
  save();
}

/* ---------- talking, chatter ---------- */
const SINTERACT = [
  { id: 'stores', at: () => nearStores(), r: 3.4, label: () => `Kestrel stores · ${Object.values(stores()).reduce((a, b) => a + b, 0)} things`, act: () => { invTab = 'settle'; toggleInv(true); } },
  { id: 'loner', at: () => nearLoner(), r: 3, label: () => `Talk to ${nearLoner().lone}`, act: () => { const e = nearLoner(), S = setS();
    say([[e.lone, e.loneLine], ['', housing() > S.ros.length + (S.pending || []).length ? `${e.lone} will walk to Kestrel. They’ll be there by morning.` : 'Kestrel has no bed for them — build housing first.']]);
    if (housing() > S.ros.length + (S.pending || []).length) { (S.pending ||= []).push({ n: e.lone, trait: e.loneTrait }); (S.lone ||= {})[e.lone] = G.day; e.g.visible = false; save(); } } },
];
const CHAT = {
  gather: ['Plenty of deadfall past the east field.', 'My hands haven’t been clean since we landed.'], hunt: ['Deer are moving north. Something’s pushing them.', 'Saw wolf tracks by the lake.'],
  farm: ['The potatoes don’t care that the world ended.', 'Give it a month and we’ll eat like kings.'], cook: ['Don’t ask what’s in it. Eat it.', 'Smoke’s good for the meat and bad for my eyes.'],
  build: ['Another wall, another blister.', 'If you bring in more logs we’ll finish faster.'], guard: ['Quiet tonight. I don’t like quiet.', 'I count the trees. When there’s one more, I shoot it.'],
  scout: ['There’s more out there than anyone on the Arc ever guessed.', 'I found a road nobody’s walked in a hundred years.'], repair: ['Bring me what’s broken.', 'Everything breaks. That’s job security.'],
  medic: ['Sit still. You’re bleeding on my floor.', 'Boil the water. Always boil the water.'], idle: ['Give me something to do before I go mad.', 'Nice to just sit, for once.'],
};
let chatT = 20;
function setChatter(dt) {
  chatT -= dt; if (chatT > 0 || !inKestrel() || night.active || cine) return; chatT = rr(30, 60);
  const S = setS(); let best = null, bd = 6; for (const R of S.ros) { const e = survEnt(R); if (!e || e.away) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = R; } }
  if (!best) return; const low = S.morale < 30;
  say([[best.n, low ? pick(['I don’t know how much longer I can do this.', 'People are scared. They talk about leaving.', 'We need food, and beds, and a night’s sleep.']) : pick(CHAT[best.job] || CHAT.idle)]]);
}

/* ---------- setup and each frame ---------- */
function buildSettlement() {
  const s0 = seed; seed = 5050505;
  buildStores(); buildLoners();
  window.__S = { setS, setDay, setAction, JOBS, PROJECTS, buildProject, housing, setLevel, LONERS, sAdd, get SROS() { return SROS; } };
  seed = s0;
}
function setRestore() {
  SROS = {}; const S = setS();
  // recruits from the save walk Kestrel again
  for (const e of [...ents]) if (e.sid && !SETTLERS.some(x => x.n === e.shopName && e.shop === 'settler' + SETTLERS.indexOf(x))) removeEnt(e);
  for (const e of ents) if (e.settler) e.sid = null;
  setInitRoster();
  for (const R of S.ros) if (R.origin !== 'kestrel' && !SROS[R.id]) spawnSurvivor(R);
  for (const R of [...S.ros]) if (R.origin === 'kestrel' && !SROS[R.id]) S.ros.splice(S.ros.indexOf(R), 1);   // (died in an older save)
  for (const id of PROJ_IDS) buildProject(id, S.proj[id] ? (S.proj[id].done ? 2 : 1) : 0);
  setTowerGuards(); lonerSync();
  if (S.rescuedSeen == null) S.rescuedSeen = G.flags.rescued || 0;
  setLastDay = G.day;
}
function updSettlement(dt) {
  if (G.day !== setLastDay && setLastDay >= 0) setDay();
  setChatter(dt);
  // the outer watch stands up on the platforms
  for (const e of towerGuards) if (e.towerY) e.g.position.y = heightAt(e.x, e.z) + e.towerY;
  // medic + infirmary: you heal in Kestrel
  if (inKestrel() && !P.dead && P.hp < 100) { const med = setS().ros.some(R => R.job === 'medic' && survEnt(R)); if (med) P.hp = Math.min(100, P.hp + dt * (projDone('infirm') ? .9 : .35)); }
  // a repairer at home mends one thing a day for you
  // (handled when you open the Settlement tab in Kestrel — see setRepair)
}
function setRepair() {
  const S = setS(); if (!inKestrel() || S.repDay === G.day || !S.ros.some(R => R.job === 'repair' && survEnt(R))) return;
  const worst = INV.tools.filter(t => t.d < t.max).sort((a, b) => a.d / a.max - b.d / b.max)[0]; if (!worst) return;
  S.repDay = G.day; worst.d = Math.min(worst.max, worst.d + Math.round(worst.max * (projDone('shop') ? .5 : .3))); toast(`${S.ros.find(R => R.job === 'repair').n} fixed up your ${GEAR_DEFS[worst.id].n.toLowerCase()}`, 2.6); save();
}
