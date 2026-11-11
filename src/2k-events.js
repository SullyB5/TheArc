
/* ================= the living world: events, side jobs, the Lantern (Nov 11, Part 8 of the overhaul) =================
   · events (`evTick`): every few minutes out in the world something happens near you, picked by where you are, the
     season and who likes you, each kind with its own cooldown: a travelling merchant on the road, a distress call on
     the radio (someone pinned down — help them and they may come to Kestrel), a supply convoy (Ironjaw's to raid, or
     a Farlight caravan to walk with), a piece of the Arc burning in from the sky, a herd on the move, and once, the
     numbers on the radio that start the Lantern.
   · side jobs: three on the job board by the stores, new ones each morning; take up to three (bag → Journal at the
     board). Recover stolen supplies, find a missing explorer, hunt a dangerous animal, deliver medicine, track enemy
     scouts, collect rare materials, repair a landmark, uncover a marked stash. Marked on the map.
   · the Lantern (G.flags.lantern 0–6): numbers on the radio → the old relay tower and a Farlight patrol that never came
     back → Survey Station 4 (a hatch on the grey mountain): throw the breakers in the right order → the relay's dish,
     three dials set from the survey's notes, sends the signal → the Black Door opens → Site Nine, and the Lantern.
     Breakers and dials are the puzzles; the clues are in the logs. */

/* ---------- events ---------- */
const EV = { t: 150, cd: {}, live: [], marks: [] };
SHOP_STOCK.merchant = { pool: ['circuit', 'sensor', 'battery', 'fuse', 'solar_cell', 'medkit', 'antibiotic', 'rust_med', 'ammo_9', 'ammo_556', 'ammo_12', 'frag', 'molotov', 'tool_kit', 'repair_kit', 'binoculars', 'flashlight', 'gas_mask', 'compass', 'canteen', 'purify_tab', 'canned', 'seed_corn', 'seed_potato'], k: 6, mark: 1.3, blurb: 'Old Hob carries a bit of everything, and he knows what it’s worth.' };
const evMark = (x, z, n, until) => { const m = { x, z, n, until }; EV.marks.push(m); return m; };
function evSpotAhead(d0, d1, side = 0) {
  for (let k = 0; k < 14; k++) { const a = -P.yaw + Math.PI + rr(-.6, .6) + side, d = rr(d0, d1), x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
    if (Math.hypot(x, z) > WORLD - 60 || Math.hypot(x, z) < CAMP_R + 40 || waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > .7) continue; return { x, z }; }
  return null;
}
const EVENTS = {
  merchant: { cd: 600, ok: () => true, go() { const s = evSpotAhead(30, 45); if (!s) return false;
    const e = spawnNPC('merchant', s.x, s.z, { model: 'civilian', yaw: Math.atan2(P.x - s.x, P.z - s.z), h: 1.74 }); e.shop = 'merchant'; e.shopName = 'Old Hob'; e.evEnd = G.t + 300; EV.live.push(e);
    const pack = new THREE.Group(); mesh(new THREE.BoxGeometry(.9, .7, .6), M(0x6a5038), 0, .35, 0, pack); mesh(new THREE.BoxGeometry(.7, .5, .5), M(0x5a4a34), 0, .95, 0, pack); pack.position.set(s.x + 1.2, heightAt(s.x + 1.2, s.z), s.z); world.add(pack); e.prop = pack;
    say([['Old Hob', 'Hold your fire! Just a merchant. Come and see what I’ve got — I’m not staying long.']]); return true; } },
  distress: { cd: 720, ok: () => cnt('radio') > 0 || !!G.flags.longRadio, go() { const s = evSpotAhead(140, 240, rr(-1, 1)); if (!s) return false;
    const e = spawnNPC('stranded', s.x, s.z, { model: pick(['civilian', 'settler']), yaw: rr(0, 6), h: 1.72 }); e.stranded = 1; e.evEnd = G.t + 540; EV.live.push(e);
    const hos = FAC_IDS.filter(f => f !== 'arc' && facHostile(f)), f = hos.length ? facNearestCap(s.x, s.z, hos) : null, foes = [];
    if (f && rnd() < .7) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 3; i++) { const g = spawnClan(K[i % K.length], s.x + rr(-12, 12), s.z + rr(-12, 12), 'guard', facFac(f)); g.tribe = f; foes.push(g); } }
    else for (const w of spawnGroup('wolf', s.x + 14, s.z + 10, 3, 6, 30)) foes.push(w);
    e.foes = foes; e.mark = evMark(s.x, s.z, 'Distress call', G.t + 540);
    say([['Radio', 'Anyone — anyone out there — we’re pinned down, they’re all round us — please —'], ['', 'The call is marked on your map.']]); return true; } },
  convoy: { cd: 900, ok: () => Math.hypot(P.x, P.z) > VALLEY - 100 || G.day > 10, go() {
    const f = facHostile('iron') || rnd() < .5 ? 'iron' : 'arc'; const a = -P.yaw + Math.PI / 2 + rr(-.3, .3), mx = P.x - Math.sin(P.yaw) * 60, mz = P.z - Math.cos(P.yaw) * 60;
    const A = { x: mx - Math.sin(a) * 140, z: mz - Math.cos(a) * 140 }, B = { x: mx + Math.sin(a) * 140, z: mz + Math.cos(a) * 140 };
    if ([A, B].some(p => waterAt(p.x, p.z) > heightAt(p.x, p.z) - .5 || Math.hypot(p.x, p.z) > WORLD - 60)) return false;
    const cart = new THREE.Group(); mesh(new THREE.BoxGeometry(1.8, .9, 3.2), new THREE.MeshLambertMaterial({ map: texWood, color: 0x7a5e44 }), 0, .9, 0, cart); for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(.8, .6, .7), M(f === 'iron' ? 0x4f5a3a : 0x6a7a8a), (i % 2 - .5) * .9, 1.65, (i < 2 ? -.7 : .7), cart);
    for (const [x, z] of [[-.95, 1], [.95, 1], [-.95, -1], [.95, -1]]) { const w = mesh(new THREE.CylinderGeometry(.45, .45, .15, 10), M(0x2a2218), x, .45, z, cart); w.rotation.z = Math.PI / 2; }
    world.add(cart); const C = { f, A, B, cart, t: 0, L: Math.hypot(B.x - A.x, B.z - A.z), guards: [], esc: 0, looted: false, end: G.t + 400 }; EV.convoy = C;
    const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 4; i++) { const g = spawnClan(K[i % K.length], A.x + rr(-3, 3), A.z + rr(-3, 3), 'guard', facFac(f)); g.tribe = f; g.convoy = 1; C.guards.push(g); }
    C.mark = evMark(mx, mz, f === 'iron' ? 'Ironjaw convoy' : 'Farlight caravan', C.end);
    toast(f === 'iron' ? 'An Ironjaw supply convoy is crossing ahead — kill the guards and the cart is yours' : 'A Farlight caravan is passing — walk with it to the far side for their thanks', 4.4); return true; } },
  skydrop: { cd: 1100, ok: () => true, go() { const s = evSpotAhead(120, 220, rr(-1.2, 1.2)); if (!s) return false;
    const y0 = heightAt(s.x, s.z), ball = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd090, toneMapped: false })); ball.position.set(s.x - 300, y0 + 500, s.z - 200); world.add(ball);
    let t = 0; const tail = []; EV.anim = (dt) => { t += dt; const k = Math.min(1, t / 5); ball.position.set(lerp(s.x - 300, s.x, k), lerp(y0 + 500, y0, k * k), lerp(s.z - 200, s.z, k)); if (rnd() < .6) puff(ball.position.x, ball.position.y, ball.position.z, 0x8a7a6a, 2, 1, .6, 2.5, 0);
      if (k >= 1) { world.remove(ball); EV.anim = null; sfx('boom'); puff(s.x, y0 + 2, s.z, 0xff8a3a, 30, 9, .4, 1.6, -2); SMOKES.push({ x: s.x, z: s.z, y: y0 + 1, k: rnd() });
        const C = cache(world, s.x + 3, s.z + 2, rr(0, 6), 'none', 'arc', { id: 'ev_drop_' + Math.floor(G.t), name: 'Arc cargo pod', big: 1, rolls: 3, refill: 0 }); C.ev = 1;
        for (let i = 0; i < 6; i++) { const m = mesh(new THREE.BoxGeometry(rr(.8, 2.4), rr(.2, .4), rr(.8, 2)), new THREE.MeshStandardMaterial({ map: texPanel, color: 0x9a948a, metalness: .4 }), s.x + rr(-6, 6), y0 + .2, s.z + rr(-6, 6), world); m.rotation.set(rr(-1, 1), rr(0, 6), rr(-1, 1)); }
        setTimeout(() => { if (rnd() < .6) for (let i = 0; i < 3; i++) { const g = spawnClan(i ? 'gunner' : 'brute', s.x + rr(30, 40), s.z + rr(-10, 10), 'guard', 'iron'); g.tribe = 'iron'; g.evTemp = 1; } }, 40000); } };
    evMark(s.x, s.z, 'Something fell from the sky', G.t + 600); toast('A streak of fire across the sky — something just came down. It’s on your map.', 4); return true; } },
  migrate: { cd: 600, ok: () => true, go() { const s = evSpotAhead(50, 70, rr(-.8, .8)); if (!s) return false; const key = Math.hypot(P.x, P.z) > VALLEY ? pick(['elk', 'deer', 'bighorn']) : 'deer';
    const herd = spawnGroup(key, s.x, s.z, 8, 10, 22); const a = rr(0, 6.28); EV.herd = { herd, vx: Math.sin(a) * 2.2, vz: Math.cos(a) * 2.2, end: G.t + 120 }; toast(`A herd of ${FAUNA[key].n.toLowerCase()} on the move`, 2.6); return true; } },
  numbers: { cd: 1e9, ok: () => G.day >= 10 && !(G.flags.lantern > 0) && (cnt('radio') > 0 || !!G.flags.longRadio), go() { G.flags.lantern = 1; (G.flags.xmark ||= {}).relay = 1; XMARKS.relay = { x: POI.relay.x, z: POI.relay.z, n: 'The numbers' };
    say([['Radio', '“…nine. Nine. Site Nine awaits the signal. Lantern is lit…”'], ['Radio', 'The static has a direction. Due north-west — the old relay tower on the grey mountain.']]); card('THE NUMBERS', 'Find where the signal comes from — the old relay tower', 4); save(); return true; } },
};
function evTick(dt) {
  if (G.mode !== 'play' || night.active || rust.state === 'active' || UG.at || P.dead || cine) return;
  if (EV.anim) EV.anim(dt);
  // living events
  for (const e of [...EV.live]) {
    if (e.dead || !ents.includes(e)) { EV.live.splice(EV.live.indexOf(e), 1); continue; }
    if (e.stranded && !e.saved && e.foes && e.foes.every(f => f.dead || !ents.includes(f)) && !e.clear) { e.clear = 1; say([['', 'They’re clear. Go and talk to them.']]); }
    if (G.t > e.evEnd && Math.hypot(e.x - P.x, e.z - P.z) > 40) { if (e.prop) world.remove(e.prop); removeEnt(e); EV.live.splice(EV.live.indexOf(e), 1); }
  }
  const C = EV.convoy;
  if (C) {
    const alive = C.guards.filter(g => !g.dead && ents.includes(g));
    if (!C.stopped) { C.t = Math.min(1, C.t + dt * 1.5 / C.L); const x = lerp(C.A.x, C.B.x, C.t), z = lerp(C.A.z, C.B.z, C.t); C.cart.position.set(x, heightAt(x, z), z); C.cart.rotation.y = Math.atan2(C.B.x - C.A.x, C.B.z - C.A.z);
      for (const [i, g] of alive.entries()) { g.home = { x: x + (i % 2 ? 2.5 : -2.5), z: z + (i < 2 ? 3 : -3) }; if (g.state === 'idle') { g.tx = g.home.x; g.tz = g.home.z; g.t = 0; } }
      if (Math.hypot(P.x - x, P.z - z) < 40) C.esc += dt;
      if (alive.length < C.guards.length || alive.some(g => g.state === 'chase')) C.stopped = true; }
    if (C.t >= 1 && !C.done) { C.done = 1; if (C.f === 'arc' && C.esc > 40) { INV.scrap += 40; facAdd('arc', 6, 'you saw their caravan through'); toast('+40 scrap · the caravan made it', 3); } }
    if (C.done || G.t > C.end) { if (Math.hypot(P.x - C.cart.position.x, P.z - C.cart.position.z) > 60 || C.done) { world.remove(C.cart); for (const g of alive) removeEnt(g); EV.convoy = null; } }
  }
  if (EV.herd) { const H = EV.herd; for (const e of H.herd) if (!e.dead) { e.home.x += H.vx * dt; e.home.z += H.vz * dt; } if (G.t > H.end) EV.herd = null; }
  EV.marks = EV.marks.filter(m => G.t < m.until);
  // something new
  if (Math.hypot(P.x, P.z) < CAMP_R + 60) return;
  EV.t -= dt; if (EV.t > 0) return; EV.t = rr(200, 340);
  const pool = Object.keys(EVENTS).filter(k => EVENTS[k].ok() && (EV.cd[k] || 0) < G.t && !(k === 'convoy' && EV.convoy));
  if (!pool.length) return;
  // (Nov 11) weighted by how the world stands: events can carry w() (default 1)
  let k = 'numbers'; if (!pool.includes('numbers')) { const W = pool.map(q => Math.max(0, EVENTS[q].w ? EVENTS[q].w() : 1)), tot = W.reduce((a, b) => a + b, 0); let r = rnd() * tot; k = pool[pool.length - 1]; for (let i = 0; i < pool.length; i++) { r -= W[i]; if (r <= 0) { k = pool[i]; break; } } }
  if (EVENTS[k].go()) EV.cd[k] = G.t + EVENTS[k].cd;
}
const nearStranded = () => { for (const e of EV.live) if (e.stranded && !e.saved && !e.dead && Math.hypot(e.x - P.x, e.z - P.z) < 3) return e; return null; };
const nearCart = () => { const C = EV.convoy; return C && C.stopped && !C.looted && C.guards.every(g => g.dead || !ents.includes(g)) && Math.hypot(C.cart.position.x - P.x, C.cart.position.z - P.z) < 3.5 ? C : null; };

/* ---------- side jobs ---------- */
const SIDE_T = ['supplies', 'explorer', 'hunt', 'medicine', 'scouts', 'materials', 'repair', 'stash'];
let BOARD = null; const SIDE_LIVE = {};   // job id → { ents / props it put in the world }
const SJ = () => G.flags.side ||= { offers: [], active: [], done: 0, day: -1, seq: 0 };
function sideMake(t) {
  const S = SJ(); S.seq++; const id = 'sj' + S.seq, J = { id, t };
  const spot = (r0, r1) => { for (let k = 0; k < 20; k++) { const a = rr(0, 6.28), r = rr(r0, r1), x = Math.cos(a) * r, z = Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) - .5 || slopeAt(x, z) > .7) continue; return { x, z }; } return { x: 200, z: 200 }; };
  if (t === 'supplies') { const O = OUTPOSTS.filter(o => FAC[postOwner(o)] && facHostile(postOwner(o))).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]; if (!O) return null; Object.assign(J, { n: 'Stolen supplies', d: `Raiders took a crate from Kestrel to the ${O.n.toLowerCase()}. Bring it back.`, x: O.x + 3, z: O.z - 3, rw: 30 }); }
  else if (t === 'explorer') { const k = pick(Object.keys(XSITES).filter(k => k !== 'tunB')), s = XSITES[k]; Object.assign(J, { n: 'Missing explorer', d: `Hale went out to ${s.name.toLowerCase().replace(/^\w/, c => c.toUpperCase())} three days ago and didn’t come back.`, x: s.x + 8, z: s.z - 6, who: pick(FIRST), rw: 25 }); }
  else if (t === 'hunt') { const s = spot(250, 520), sp = pick(['grizzly', 'bear', 'tiger', 'moose']); Object.assign(J, { n: 'Dangerous animal', d: `A ${FAUNA[sp].n.toLowerCase()} the size of a cart has been taking people near here. Kill it.`, x: s.x, z: s.z, sp, rw: 45 }); }
  else if (t === 'medicine') { const dest = !facHostile('root') && facRep('root') >= 0 && rnd() < .5 ? 'root' : 'arc', Q = dest === 'root' ? PARLEY.find(q => q.f === 'root') : FAC.arc.cap(); Object.assign(J, { n: 'Medicine run', d: `${dest === 'root' ? 'The Rootkin' : 'Farlight'} have sick children. Take them 2 bandages and a medkit.`, x: Q.x, z: Q.z, dest, rw: 35 }); }
  else if (t === 'scouts') { const s = spot(280, 560), hos = FAC_IDS.filter(f => f !== 'arc' && facHostile(f)); if (!hos.length) return null; const f = facNearestCap(s.x, s.z, hos); Object.assign(J, { n: 'Enemy scouts', d: `${FAC[f].n} scouts have been watching the valley. Find them — somewhere in the marked area — and end it.`, x: s.x + rr(-40, 40), z: s.z + rr(-40, 40), sx: s.x, sz: s.z, f, rw: 30, area: 1 }); }
  else if (t === 'materials') { const it = pick(['circuit', 'sensor', 'solar_cell', 'battery', 'copper', 'spring', 'gears'].filter(i => ITEMS[i])); Object.assign(J, { n: 'Rare materials', d: `Rook needs 3 × ${nameOf(it).toLowerCase()} for the generator. Bring them to the job board.`, it, need: 3, rw: 45, board: 1 }); }
  else if (t === 'repair') { const R2 = pick([['KVRN’s mast', XSITES.kvrn], ['the south lookout', POI.lookout], ['Fort Hesper’s radio mast', XSITES.hesper]]); Object.assign(J, { n: 'Repairs', d: `Fix ${R2[0]} (2 spare parts, 2 wire). Everyone listens better when it works.`, x: R2[1].x + 2, z: R2[1].z + 2, rw: 35 }); }
  else if (t === 'stash') { const i = XSTASH.findIndex((s, k) => !(G.flags.caches || {})['x_stash' + k]); if (i < 0) return null; const s = XSTASH[i]; Object.assign(J, { n: 'A marked stash', d: 'A trader swore there’s a stash under the three bars out there. Dig it up.', x: s.x, z: s.z, si: i, rw: 15 }); }
  return J;
}
function sideRefresh() { const S = SJ(); S.day = G.day; S.offers = []; const pool = [...SIDE_T]; while (S.offers.length < 3 && pool.length) { const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; const J = sideMake(t); if (J) S.offers.push(J); } }
// what a job puts in the world when you take it
function sideSpawn(J) {
  const L = SIDE_LIVE[J.id] = { ents: [], props: [] };
  if (J.t === 'supplies') { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(1, .7, .8), M(0x6a5038), 0, .35, 0, g); mesh(new THREE.BoxGeometry(.6, .2, .02), M(0xf0a640), 0, .5, .41, g); g.position.set(J.x, heightAt(J.x, J.z), J.z); world.add(g); L.props.push(g); }
  else if (J.t === 'explorer') { const pp = makePerson('arc', {}); pp.g.position.set(J.x, heightAt(J.x, J.z) + .2, J.z); pp.g.rotation.set(-1.4, rr(0, 6), 0); if (pp.weapon) pp.weapon.visible = false; world.add(pp.g); L.props.push(pp.g); }
  else if (J.t === 'hunt') { const e = spawnAnimal(J.sp, J.x, J.z, { range: 60 }); if (e) { e.hp = e.maxhp = e.maxhp * 1.8; e.g.scale.multiplyScalar(1.2); e.sideJob = J.id; L.ents.push(e); } }
  else if (J.t === 'scouts') { const K = FAC_KINDS[FAC[J.f].kind]; for (let i = 0; i < 3; i++) { const e = spawnClan(K[i % K.length], J.sx + rr(-6, 6), J.sz + rr(-6, 6), 'guard', facFac(J.f)); e.tribe = J.f; e.sideJob = J.id; L.ents.push(e); } }
}
function sideDone(J, msg) {
  const S = SJ(); S.active = S.active.filter(x => x.id !== J.id); S.done++; INV.scrap += J.rw; const L = SIDE_LIVE[J.id]; if (L) for (const p of L.props) world.remove(p); delete SIDE_LIVE[J.id];
  card('JOB DONE', `${J.n} · +${J.rw} scrap${msg ? ' · ' + msg : ''}`, 3.2); sfx('buy'); save();
}
function sideCheck() {
  for (const J of [...SJ().active]) {
    const L = SIDE_LIVE[J.id] || (sideSpawn(J), SIDE_LIVE[J.id]);
    if (J.t === 'hunt' && L.ents.length && L.ents.every(e => e.dead)) sideDone(J, `${FAUNA[J.sp].n} hide and teeth are yours`);
    else if (J.t === 'scouts' && L.ents.length && L.ents.every(e => e.dead || !ents.includes(e))) { give('ammo_556', 30); sideDone(J, '+30 rifle rounds'); }
    else if (J.t === 'stash' && (G.flags.caches || {})['x_stash' + J.si]) sideDone(J);
  }
}
const nearJob = r => { for (const J of SJ().active) if (J.x != null && !J.area && Math.hypot(J.x - P.x, J.z - P.z) < r) return J; return null; };
function sideHand(J) {
  if (J.t === 'supplies') { sAdd('canned', 4); sAdd('nails', 12); sAdd('cloth', 6); sideDone(J, 'the crate’s back in the stores'); }
  else if (J.t === 'explorer') { const S = setS(); if (housing() > S.ros.length + (S.pending || []).length) (S.pending ||= []).push({ n: J.who, trait: 'careful' }); sideDone(J, `${J.who} is limping home`); }
  else if (J.t === 'medicine') { if (cnt('bandage') < 2 || cnt('medkit') < 1) { sfx('no'); toast('You need 2 bandages and a medkit', 2.6); return; } take('bandage', 2); take('medkit', 1); facAdd(J.dest, 8, 'medicine delivered'); sideDone(J); }
  else if (J.t === 'repair') { if (cnt('spare_parts') < 2 || cnt('wire') < 2) { sfx('no'); toast('You need 2 spare parts and 2 wire', 2.6); return; } take('spare_parts', 2); take('wire', 2); setS().morale += 3; sideDone(J, 'it hums again'); }
  else if (J.t === 'materials') { if (cnt(J.it) < J.need) { sfx('no'); toast(`You need ${J.need} × ${nameOf(J.it).toLowerCase()}`, 2.6); return; } take(J.it, J.need); give('spare_parts', 3); sideDone(J, '+3 spare parts'); }
}
function sideHTML() {
  const S = SJ(), atB = nearBoard(); let h = `<h4>Side jobs</h4><div class="jn">`;
  for (const J of S.active) h += `<div style="padding:6px 8px;border:1px solid #fff2;border-left:4px solid #e8c070;border-radius:3px;background:#0002"><b>${J.n}</b> <small style="opacity:.75">${J.d}</small> <small style="color:#e8c070">· ${J.rw} scrap</small>${J.board && atB ? ` <button data-sjh="${J.id}">Hand in</button>` : ''} <button data-sjx="${J.id}">Drop</button></div>`;
  if (!S.active.length) h += '<p class="dim">No jobs taken. The job board by the stores has new ones every morning.</p>';
  if (atB) { h += `<p class="pl"><b>On the board</b></p>`; for (const J of S.offers) h += `<div style="padding:6px 8px;border:1px dashed #fff3;border-radius:3px"><b>${J.n}</b> <small style="opacity:.75">${J.d}</small> <small style="color:#e8c070">· ${J.rw} scrap</small> <button data-sjt="${J.id}"${S.active.length < 3 ? '' : ' class="dis"'}>Take it</button></div>`; if (!S.offers.length) h += '<p class="dim">Nothing new today.</p>'; }
  return h + '</div>';
}
function sideAction(d) {
  const S = SJ();
  if (d.sjt) { const J = S.offers.find(x => x.id === d.sjt); if (!J || S.active.length >= 3) return; S.offers = S.offers.filter(x => x !== J); S.active.push(J); sideSpawn(J); sfx('pickup'); toast(`Taken: ${J.n} · it’s on your map`, 2.6); }
  else if (d.sjx) { const J = S.active.find(x => x.id === d.sjx); if (!J) return; S.active = S.active.filter(x => x !== J); const L = SIDE_LIVE[J.id]; if (L) { for (const p of L.props) world.remove(p); for (const e of L.ents) if (!e.dead) removeEnt(e); } delete SIDE_LIVE[J.id]; }
  else if (d.sjh) { const J = S.active.find(x => x.id === d.sjh); if (J) sideHand(J); }
  save();
}
function buildBoard() { const x = SPOTS.fire.x - 3.4, z = SPOTS.fire.z + 3.6, g = new THREE.Group(); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.12, 2.2, .12), M(0x4a3a2a), s * .9, 1.1, 0, g); mesh(new THREE.BoxGeometry(2, 1.2, .08), M(0x8a7258), 0, 1.5, 0, g);
  for (let i = 0; i < 5; i++) mesh(new THREE.PlaneGeometry(.3, .4), new THREE.MeshLambertMaterial({ color: 0xe8e2cc, side: THREE.DoubleSide }), -.65 + i * .32, 1.5 + (i % 2) * .1, .05, g); g.position.set(x, heightAt(x, z), z); g.rotation.y = rr(-.3, .3); world.add(g); addCol(x, z, .5); BOARD = { x, z }; }
const nearBoard = () => BOARD && Math.hypot(P.x - BOARD.x, P.z - BOARD.z) < 3.4;
function drawSideMarks(g, S, k) {
  g.font = `700 ${10 * k}px "Barlow Condensed",sans-serif`; g.textAlign = 'center';
  const dot = (x, z, n, col, ring) => { const [X, Y] = toMap(x, z, S); g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.2 * k; if (ring) { g.strokeStyle = col; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(X, Y, ring / MAPR * S / 2, 0, 7); g.stroke(); } else { g.beginPath(); g.moveTo(X, Y - 5 * k); g.lineTo(X + 4 * k, Y); g.lineTo(X, Y + 5 * k); g.lineTo(X - 4 * k, Y); g.closePath(); g.fill(); g.stroke(); } g.fillStyle = '#000a'; g.fillText(n, X + k, Y - 7 * k); g.fillStyle = col; g.fillText(n, X, Y - 8 * k); };
  for (const J of SJ().active) if (J.x != null) dot(J.area ? J.sx : J.x, J.area ? J.sz : J.z, J.n, '#e8c070', J.area ? 70 : 0);
  for (const m of EV.marks) dot(m.x, m.z, m.n, '#ff9a6a');
  for (const O of OUTPOSTS) if ((G.flags.seen || {})['x_' + O.id] || Math.hypot(O.x - P.x, O.z - P.z) < 150) { const [X, Y] = toMap(O.x, O.z, S), f = postOwner(O); g.fillStyle = f === 'kestrel' ? '#f0a640' : FAC[f] ? FAC[f].c : '#888'; g.fillRect(X - 2.5 * k, Y - 2.5 * k, 5 * k, 5 * k); }
}

/* ---------- the Lantern ---------- */
Object.assign(LOGS, {
  ln_patrol: { at: 'The old relay tower', kind: 'note', t: 'A Farlight patrol log', by: 'Sgt. Dace, Farlight', b: 'Day 6 out. The numbers broadcast is coming from here — but the relay’s dead. No power for years. It’s RELAYING something, not sending it.\n\nThe source is a survey hatch on the far side of the mountain: SURVEY STATION 4. We go in at first light.\n\n(The last entry is in a different hand: “Don’t go in. The breakers. Pumps first.”)' },
  ln_breakers: { at: 'Survey Station 4', kind: 'carve', t: 'Scratched beside the breaker panel', by: 'Somebody who learned the hard way', b: 'PUMPS FIRST OR IT FLOODS.\nDOORS BEFORE MAINS OR THE DOORS LOCK.\nNEVER MAINS FIRST.' },
  ln_survey: { at: 'Survey Station 4', kind: 'term', t: 'The survey terminal', by: 'Brightwater Survey', b: '> STATION 4 — LANTERN SUPPORT\n> Site Nine will open to the signal. The signal goes out through the relay dish on the grey mountain.\n> DISH SETTINGS: AZIMUTH 3 · ELEVATION 7 · BAND 2\n> Reminder: the relay needs its own power. Two cells.' },
  ln_site9: { at: 'Site Nine', kind: 'term', t: 'The Lantern', by: 'Lantern Protocol', b: '> LANTERN — CONTINUITY ARCHIVE\n> If you are reading this, the flare came and the surface burned, and someone sent the signal.\n> Lantern holds what the old world wanted kept: seeds, records, and the Ember.\n> GREYHOLD was to keep the people. MERIDIAN was to keep the stars. LANTERN keeps the light.\n> Greyhold has stopped answering. Do not trust Greyhold.' },
  ln_override: { at: 'Site Nine', kind: 'note', t: 'A sticky note on the console', by: 'A technician', b: 'Maintenance override, if the system locks you out: tap the vitals readout seven times, fast. (Yes, really. Ask Hollis.)' },
});
let RELAY_DIAL = null;
function buildLantern() {
  // the patrol at the relay
  { const R = POI.relay; for (let i = 0; i < 3; i++) { const x = R.x + rr(4, 9) * (i % 2 ? 1 : -1), z = R.z + rr(3, 8), y = heightAt(x, z); const pp = makePerson('arc', {}); pp.g.position.set(x, y + .15, z); pp.g.rotation.set(-Math.PI / 2, rr(0, 6), 0); if (pp.weapon) pp.weapon.visible = false; world.add(pp.g); }
    xNote(world, 'ln_patrol', R.x + 3, heightAt(R.x + 3, R.z + 5) + .1, R.z + 5, 0); }
  // the relay's dish dials and power (only matter once the survey's been read)
  { const R = POI.relay, x = R.x - 3, z = R.z + 2.5, g = new THREE.Group(); mesh(new THREE.BoxGeometry(1.2, 1.3, .6), M(0x5a6258), 0, .65, 0, g); for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.09, .09, .05, 10), M(0xd8d8d0), -.35 + i * .35, 1, .31, g).rotation.x = Math.PI / 2;
    const lamp = mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), 0, 1.25, .31, g); g.position.set(x, heightAt(x, z), z); world.add(g); addCol(x, z, .7); RELAY_DIAL = { x, z, lamp };
    const L = () => G.flags.lantern || 0, D = () => (G.flags.dial ||= [1, 1, 1]);
    xUse({ x, z, r: 2.4, pocket: null, label: () => L() < 3 ? null : !G.flags.relayPow ? `Relay control box · dead (fit 2 batteries · you have ${cnt('battery')})` : L() >= 5 ? 'The relay hums. The signal is going out.' : 'Relay control box · powered', act: () => { if (L() < 3) return; if (!G.flags.relayPow) { if (cnt('battery') < 2) { sfx('no'); return; } take('battery', 2); G.flags.relayPow = 1; lamp.material.color.set(0xffb040); sfx('reload'); toast('The relay’s lamp comes up amber', 2.4); save(); } } });
    ['Azimuth', 'Elevation', 'Band'].forEach((n, i) => xUse({ x: x + (i - 1) * .5, z: z + .9, r: 1.2, pocket: null, label: () => L() >= 3 && G.flags.relayPow && L() < 5 ? `${n} dial · ${D()[i]}  (E to turn)` : null,
      act: () => { const d = D(); d[i] = d[i] % 9 + 1; sfx('swing'); if (d[0] === 3 && d[1] === 7 && d[2] === 2) lanternSignal(); save(); } })); }
  // Survey Station 4: a hatch in a concrete pad
  { const S = XSURVEY, y = heightAt(S.x, S.z), g = new THREE.Group(); mesh(new THREE.BoxGeometry(4, .5, 4), new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x9a948a }), 0, .25, 0, g); mesh(new THREE.BoxGeometry(1.4, .12, 1.4), new THREE.MeshStandardMaterial({ map: texPanel, color: 0x6a7068, metalness: .5 }), 0, .55, 0, g);
    mesh(new THREE.BoxGeometry(.8, 1.2, .1), M(0xd8c840), 1.5, 1, -1.8, g); g.position.set(S.x, y, S.z); world.add(g);
    const pk = mkPocket('survey', 'SURVEY STATION 4', { surf: 'metal', fog: 40, hemi: .14 }); pk.sub = 'The hum is louder down here';
    xEntrance(pk, S.x, S.z + 1, 'Open the hatch · climb down', { x: pk.ox + 2, y: pk.y, z: pk.oz + 1.5, yaw: Math.PI }, { x: S.x, z: S.z + 3.5, yaw: 0 });
    REGIONS.push({ id: 'x_survey', name: 'SURVEY STATION 4', sub: 'A hatch on the far side of the grey mountain', x: S.x, z: S.z, r: 24 });
    buildSurvey(pk); }
  // Site Nine, behind the Black Door
  { const pk = mkPocket('site9', 'SITE NINE', { surf: 'metal', fog: 60, hemi: .18, hemiC: 0x9aa8b8, power: true }); pk.sub = 'Lantern is lit'; const B = XSITES.blackdoor, F = xFrame(B.x, B.z, B.face);
    const [ix, iz] = F(0, 2), [ox, oz] = F(0, 4.5);
    pk.in = { x: pk.ox + 4, y: pk.y, z: pk.oz + 1.5, yaw: Math.PI }; pk.out = { x: ox, z: oz, yaw: B.face };
    xUse({ x: ix, z: iz, r: 2.6, pocket: null, label: () => (G.flags.lantern || 0) >= 5 ? 'The Black Door stands open · go in' : null, act: () => xGo(pk, pk.in) });
    buildSite9(pk); }
}
function buildSurvey(pk) {
  const r = { wall: 'concD', floor: 'concD', ceil: 'concD' };
  xRoom(pk, 0, 0, 4, 4, { ...r, h: 3 }); xRoom(pk, 1, 3, 3, 14, { ...r, h: 2.8 }); xRoom(pk, -4, 13, 8, 20, { ...r, h: 3.4 }); xRoom(pk, 0, 19.5, 4, 27, { ...r, h: 3 });
  xExit(pk, 2, 0, .5, 'Climb out of the station');
  const g = pk.g, Y = pk.y, P2 = (a, b) => pw(pk, a, b);
  xELamp(pk, 2, 2.5, 8, 0xff3a2a, .6, 10); xELamp(pk, 2, 2.9, 16, 0xff3a2a, .5, 12);
  for (const [x, z] of [[2, 2], [2, 16], [2, 24]]) xPLamp(pk, x, 2.8, z, 0xe8f0ff, 1.3, 12);
  // the flooded floor that drains when the pumps run
  const water = mesh(new THREE.PlaneGeometry(12, 7), xm('water'), pk.ox + 2, Y + .35, pk.oz + 16.5, g); water.rotation.x = -Math.PI / 2; pk.dyn.add(water);
  // the breaker panel: three switches; the right order opens the inner door
  const [bx, bz] = P2(-3.7, 16.5); xbox(g, .3, 1.6, 2.4, 'olive', bx, Y + 1.2, bz);
  const ORDER = ['pumps', 'doors', 'mains'], NAMES = { mains: 'MAINS', pumps: 'PUMPS', doors: 'DOORS' }, lever = {};
  ['mains', 'pumps', 'doors'].forEach((k, i) => { const m = mesh(new THREE.BoxGeometry(.08, .35, .08), M(0xd8d8d0), bx + .2, Y + 1.2, bz - .7 + i * .7, g); m.rotation.z = -.5; lever[k] = m; pk.dyn.add(m); });
  xNote(g, 'ln_breakers', bx + .5, Y + .2, bz + 1.6, Math.PI / 2, pk);
  const st = () => (G.flags.brk ||= []);
  const setLev = () => { for (const k in lever) lever[k].rotation.z = st().includes(k) ? .5 : -.5; water.visible = !st().includes('pumps') && !(G.flags.lantern >= 3); };
  ['mains', 'pumps', 'doors'].forEach((k, i) => xUse({ x: bx + .6, y: Y, z: bz - .7 + i * .7, r: .55, pocket: pk, label: () => (G.flags.lantern || 0) >= 3 ? null : `Throw the ${NAMES[k]} breaker${st().includes(k) ? ' (on)' : ''}`,
    act: () => { const s = st(); if (s.includes(k)) return; s.push(k); sfx('reload'); setLev();
      if (s[s.length - 1] !== ORDER[s.length - 1]) { G.flags.brk = []; sfx('boom', .4); puff(bx, Y + 1.4, bz, 0xffe08a, 14, 4, .08, .4, -2); hurtPlayer(6, bx, bz); toast('Sparks — everything trips back off', 2.6); setTimeout(setLev, 600); }
      else if (s.length === 3) { pk.powerOn(); D.setOpen(true); G.flags.lantern = Math.max(G.flags.lantern || 0, 3); toast('The pumps run, the lights come up, and the inner door grinds open', 3.4); setLev(); }
      save(); } }));
  pk.powerOn = () => { pk.powered = true; for (const l of pk.plamps) { l.intensity = l.userData.I; if (l.userData.fx) l.userData.fx.material.color.setHex(l.userData.C); } };
  const D = xDoor(pk, 'survey_inner', 2, 19.8, 'x', 3.4, { need: 'power', label: 'the inner door' });
  // the inner room: the terminal, a sealed lift going further down
  xNote(g, 'ln_survey', ...P2(.6, 25.6).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 0, 25, 1.2, 26.2);
  { const [lx, lz] = P2(3.2, 26.4); xbox(g, 2.2, 2.8, .2, 'panel', lx - .3, Y + 1.4, lz + .45); xbox(g, .12, 2.6, .12, 'yellow', lx - 1.4, Y + 1.3, lz + .4); }
  xPCache(pk, 3.4, 21, -Math.PI / 2, 'none', 'op', { id: 'x_survey_case', name: 'Survey equipment case', rolls: 2, keys: ['battery', 'battery'], refill: 0 });
  XRESTORE.push(() => { setLev(); if ((G.flags.lantern || 0) >= 3) pk.powerOn(); });
}
function buildSite9(pk) {
  const r = { wall: 'concW', floor: 'tile', ceil: 'concW' };
  xRoom(pk, 0, 0, 8, 6, { ...r, h: 4 }); xRoom(pk, 2.5, 5, 5.5, 30, { ...r, h: 4.5 }); xRoom(pk, -6, 28, 14, 44, { ...r, h: 8 });
  xExit(pk, 4, 0, .6, 'Climb back up to the Black Door');
  const g = pk.g, Y = pk.y, P2 = (a, b) => pw(pk, a, b);
  for (let z = 8; z < 30; z += 5) xPLamp(pk, 4, 4.2, z, 0xd8e8ff, 1.1, 12);
  // the Lantern: a slow-turning light in a cage of rings, in the middle of a tall round room
  const [cx, cz] = P2(4, 36), core = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe8b0, toneMapped: false })); core.position.set(cx, Y + 4, cz); g.add(core); pk.dyn.add(core);
  const rings = []; for (let i = 0; i < 3; i++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * .5, .06, 6, 40), xm('metal')); rg.position.copy(core.position); g.add(rg); rings.push(rg); pk.dyn.add(rg); }
  XANIM.push(t => { core.scale.setScalar(1 + Math.sin(t * 6.283 / 11) * .06); rings.forEach((rg, i) => { rg.rotation.set(t * (.2 + i * .1), t * (.3 - i * .07), 0); }); });
  xLamp(g, cx, Y + 4, cz, 0xffd890, 2.4, 30, false); xSolid(pk, 1.5, 33.5, 6.5, 38.5);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; xModel(g, 'props/server-tower', 2.2, cx + Math.cos(a) * 8, Y, cz + Math.sin(a) * 6.5, -a + Math.PI / 2) || xbox(g, .8, 2.2, .6, 'metal', cx + Math.cos(a) * 8, Y + 1.1, cz + Math.sin(a) * 6.5); }
  xNote(g, 'ln_site9', ...P2(4, 31).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 3.4, 30.4, 4.6, 31.6);
  xNote(g, 'ln_override', ...P2(-4.5, 30).flatMap((v, i) => i ? [Y + .9, v] : [v]), 0, pk); xbox(g, 1.6, .9, .7, 'metal', pk.ox - 4.5, Y + .45, pk.oz + 30);
  xPCache(pk, 12, 42, -Math.PI / 2, 'none', 'op', { id: 'x_site9_vault', name: 'The Lantern’s vault', big: 1, rolls: 3, keys: ['ember', 'seed_corn', 'seed_potato', 'solar_cell'], refill: 0 });
}
function lanternSignal() {
  if ((G.flags.lantern || 0) >= 5) return; G.flags.lantern = 5; RELAY_DIAL.lamp.material.color.set(0x5aff7a);
  sfx('radio'); noiseBurst(2.5, 70, 1, .3); card('THE SIGNAL', 'The relay sings. Far to the south-west, something heavy unlocks.', 5);
  (G.flags.xmark ||= {}).site9 = 1; lanternOpen(); save();
}
function lanternOpen() { const B = XSITES.blackdoor; if (!B.doorParts) return; for (const o of B.doorParts) { o.position.y += 5.2; } }
const LINTERACT = [
  { id: 'stranded', at: () => nearStranded(), r: 3, label: () => nearStranded().foes.every(f => f.dead || !ents.includes(f)) ? 'Talk to the stranger' : 'Clear the attackers first', act: () => { const e = nearStranded(); if (!e.foes.every(f => f.dead || !ents.includes(f))) return; e.saved = 1; const S = setS(), room = housing() > S.ros.length + (S.pending || []).length;
    const n = pick(FIRST); if (room) (S.pending ||= []).push({ n, trait: pick(TRAITS)[0] }); else { give('canned', 2); INV.scrap += 20; } say([[n, room ? 'You came. Nobody comes. If there’s a bed in Kestrel, I’ll take it.' : 'Thank you. Here — it’s not much.']]); e.evEnd = G.t + 20; save(); } },
  { id: 'cart', at: () => nearCart() && nearCart().cart.position, r: 3.5, label: () => `Loot the ${FAC[nearCart().f].n} cart`, act: () => { const C = nearCart(); C.looted = true; const got = rollLoot(C.f === 'iron' ? 'city' : 'arc', 2); if (!facHostile(C.f)) facAdd(C.f, -10, 'you robbed their caravan'); toast(got.slice(0, 6).join(' · ') || 'Empty', 3.4); sfx('buy'); } },
  { id: 'jobhere', at: () => nearJob(4), r: 4, label: () => { const J = nearJob(4); return J.t === 'supplies' ? 'Take back Kestrel’s crate' : J.t === 'explorer' ? `Help ${J.who} up` : J.t === 'medicine' ? 'Hand over the medicine' : J.t === 'repair' ? 'Make the repairs' : null; }, act: () => sideHand(nearJob(4)) },
  { id: 'board', at: () => nearBoard() && BOARD, r: 3.4, label: () => `Job board · ${SJ().offers.length} new`, act: () => { invTab = 'journal'; toggleInv(true); } },
];

/* ---------- setup and each frame ---------- */
function buildEvents() { const s0 = seed; seed = 7070707; buildBoard(); buildLantern(); for (const k in POCKETS) if (k === 'survey' || k === 'site9') xSeal(POCKETS[k]); window.__EV = { EV, EVENTS, SJ, sideRefresh, sideAction, sideCheck, lanternSignal, evTick }; seed = s0; }
function eventsRestore() {
  for (const id in SIDE_LIVE) { const L = SIDE_LIVE[id]; for (const p of L.props) world.remove(p); for (const e of L.ents) if (!e.dead) removeEnt(e); delete SIDE_LIVE[id]; }
  const S = SJ(); if (S.day !== G.day) sideRefresh(); for (const J of S.active) sideSpawn(J);
  if ((G.flags.lantern || 0) >= 5) lanternOpen(); if (RELAY_DIAL) RELAY_DIAL.lamp.material.color.set((G.flags.lantern || 0) >= 5 ? 0x5aff7a : G.flags.relayPow ? 0xffb040 : 0xff3a2a);
  if ((G.flags.lantern || 0) >= 1) XMARKS.relay = { x: POI.relay.x, z: POI.relay.z, n: 'The numbers' };
}
// the Lantern's own progress markers: the relay found → the survey; survey read → back to the relay
let evCT = 0;
function updEvents(dt) {
  evTick(dt);
  evCT -= dt; if (evCT > 0) return; evCT = .5;
  const S = SJ(); if (S.day !== G.day) sideRefresh();
  sideCheck();
  const L = G.flags.lantern || 0, logs = G.flags.logs || {};
  if (L === 1 && logs.ln_patrol) { G.flags.lantern = 2; XMARKS.survey = { x: XSURVEY.x, z: XSURVEY.z, n: 'Survey Station 4' }; (G.flags.xmark ||= {}).survey = 1; card('SURVEY STATION 4', 'The patrol went in. Nobody came out. It’s on your map.', 4); save(); }
  if (L >= 3 && L < 4 && logs.ln_survey) { G.flags.lantern = 4; toast('The relay dish: azimuth 3, elevation 7, band 2 — and two cells for its power', 4.4); save(); }
  if (L === 5 && (G.flags.pkseen || {}).site9) { G.flags.lantern = 6; save(); }
}
