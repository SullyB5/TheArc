
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
  for (const f of FAC_IDS) { const F = FAC[f], S = facS(f); if (!F.rw) continue; if (F.s2 && !G.flags.s2 && G.day <= 100) continue; if (!(night.final || G.day >= F.since)) continue; if (!facHostile(f) && !(night.final && S.rep < 0 && !S.allied && !(S.cease > G.day))) continue;
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
  const W = facRaidWeights(); if (!Object.values(W).some(w => w > 0)) return 0; const base = FAC_IDS.reduce((a, f) => a + (FAC[f].rw && !(FAC[f].s2 && !G.flags.s2 && G.day <= 100) && (night.final || G.day >= FAC[f].since) ? FAC[f].rw : 0), 0) || 1, now = Object.values(W).reduce((a, b) => a + b, 0);
  const held = OUTPOSTS.filter(O => postOwner(O) === 'kestrel').length;
  return clamp(now / base, .25, 1.4) * Math.max(.6, 1 - held * .05) * (projDone('towers') ? .9 : 1);
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
    const near = facNearestCap(O.x, O.z), rivals = FAC_IDS.filter(g => g !== 'arc' && g !== cur && !FAC[g].mute && FAC[g].cap() && (cur === 'kestrel' ? facHostile(g) : atWar(g, cur)) && Math.hypot(FAC[g].cap().x - O.x, FAC[g].cap().z - O.z) < 1100);
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
  if (FAC[f].mute) return null;
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
  if (Pr.sid) { storyFreed(Pr); if (!paid) facAdd(Pr.holder, -5); toast(`${Pr.name} is free — heading home to Kestrel`, 3.4); save(); return; }
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
    const can = ctx && (ctx.radio || here === f) && !F.mute, inPerson = ctx && here === f, B = [];
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
