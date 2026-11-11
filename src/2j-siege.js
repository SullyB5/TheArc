
/* ================= Night 100: the siege, and what's left after (Nov 11, Part 7 of the overhaul) =================
   The hundredth night is four stages, one after another as the waves come (twelve waves, three to a stage):
   1 · THE APPROACH  — every faction against you comes from its own side of the valley (toward its home).
   2 · THE BREACH    — a section of the wall is blown open: raiders pour over it (they barely have to climb), and
                       fires start in Kestrel's buildings — put them out (E at the burning building) or lose the building.
   3 · THE TAKING    — raiders come for people, not walls: they grab a settler and run for the dark. Kill the one carrying
                       them and they're free; let them reach the trees and they're gone.
   4 · THE LAST PUSH — Greyhold soldiers and every faction leader still alive; allies, if you have any, arrive now.
   All the while settlers and the watch get hurt — treat them (E, a bandage or a medkit) or they die.
   How hard it is follows what you did before: who's hostile and how strong (Part 4: ceasefires, alliances, burned depots,
   dead leaders, outposts), the settlement (Part 5: guards, outer towers, barracks), the upgrades.
   At dawn (`siegeAfter`): the dead, the taken, the burned. Then "Aftermath" (2i-story.js) leads into Season 2. */

const SIEGE = { on: false, stage: -1, fireT: 0, hurtT: 0, fires: [], grabbed: [], taken: [], breachA: null, breachG: null, alliesIn: false };
const STAGES = [['THE APPROACH', 'They’re coming from every side.'], ['THE BREACH', 'The wall’s blown — fires in the yard!'], ['THE TAKING', 'They’re going for our people!'], ['THE LAST PUSH', 'Greyhold. And every chief that’s left.']];
const siegeStage = () => SIEGE.on ? clamp(Math.floor((night.wave - 1) / 3), 0, 3) : -1;
const siegeStageName = () => SIEGE.on ? STAGES[Math.max(0, siegeStage())][0].toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '';
function siegeStart() {
  Object.assign(SIEGE, { on: true, stage: -1, fireT: 40, hurtT: 30, fires: [], grabbed: [], taken: [], breachA: null, alliesIn: false });
  G.flags.siegeLog = { taken: [], dead: [] };
}
// where a raider of faction `tr` comes from: the side of the valley their home is on
function siegeSpawn(a, r, tr) {
  if (!SIEGE.on) return [a, r];
  const st = siegeStage();
  if (st === 1 && SIEGE.breachA != null && rnd() < .65) return [SIEGE.breachA + rr(-.12, .12), rr(100, 115)];
  if (tr && FAC[tr]) { const C = FAC[tr].cap(); if (C) return [Math.atan2(C.x, C.z) + rr(-.45, .45), rr(105, 125)]; }
  return [a, r];
}
// a raider just spawned: what they're for in this stage
function siegeRaider(e) {
  if (!SIEGE.on || !e) return;
  const st = siegeStage();
  if (st === 1 && SIEGE.breachA != null && Math.abs(angWrap(Math.atan2(e.x, e.z) - SIEGE.breachA)) < .3) { e.climb = true; e.breach = true; }
  if (st === 2 && rnd() < .35 && e.kind !== 'gunner' && e.kind !== 'soldier') { e.grab = true; e.climb = true; e.breach = true; e.speed *= 1.15; }
}
// the breach: a blown section of wall, burning
function siegeBreach() {
  const W = facRaidWeights(); let best = 'thorn', bw = -1; for (const f in W) if (W[f] > bw) { bw = W[f]; best = f; }
  const C = FAC[best].cap(); let a = C ? Math.atan2(C.x, C.z) : Math.PI; if (Math.abs(angWrap(a)) < GATE_HALF * 3) a += .5;   // not the gate itself
  SIEGE.breachA = a; const { x, z } = wallPt(a), y = heightAt(x, z);
  sfx('boom'); puff(x, y + 2, z, 0x6a6058, 30, 8, .3, 1.6, -2); puff(x, y + 2, z, 0xff8a3a, 16, 6, .2, .6, -2);
  const g = new THREE.Group(); g.position.set(x, y, z); world.add(g); SIEGE.breachG = g;
  for (let i = 0; i < 14; i++) { const m = mesh(new THREE.BoxGeometry(rr(.4, 1.6), rr(.2, .7), rr(.4, 1.2)), new THREE.MeshLambertMaterial({ map: texWood, color: 0x3a2a1e }), rr(-3, 3), rr(.1, .8), rr(-2, 2), g); m.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3)); }
  const f = new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 7), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: .9 })); f.position.y = 1.3; g.add(f); DECOR_ANIM.push(t => { f.scale.y = 1 + Math.sin(t * 13) * .25; });
  SMOKES.push({ x, z, y: y + 2, k: rnd() });
}
/* fires in Kestrel's buildings */
function siegeFire() {
  const lit = new Set(SIEGE.fires.filter(F => !F.out).map(F => F.id)), pool = SHOP_DEFS.filter(D => !lit.has(D.id) && !((G.flags.burnt || []).includes(D.id))); if (!pool.length) return;
  const D = pick(pool), g = new THREE.Group(), y = heightAt(D.cx, D.cz); g.position.set(D.cx, y, D.cz); world.add(g);
  const flames = []; for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(rr(.6, 1.1), rr(1.6, 2.8), 7), new THREE.MeshBasicMaterial({ color: pick([0xff7a2a, 0xff9a3a, 0xffb040]), transparent: true, opacity: .9 })); f.position.set(rr(-D.bw / 3, D.bw / 3), rr(4, 5.6), rr(-D.bd / 3, D.bd / 3)); g.add(f); flames.push(f); }
  const l = new THREE.PointLight(0xff7a2a, 0, 26, 0); l.position.y = 5; g.add(l);
  const F = { id: D.id, D, g, flames, l, t: 0, out: false, sm: { x: D.cx, z: D.cz, y: y + 6, k: rnd() } }; SMOKES.push(F.sm); SIEGE.fires.push(F);
  toast(`The ${D.sign.toLowerCase()} is on fire!`, 3); sfx('boom', .5);
}
const nearFire = () => { for (const F of SIEGE.fires) if (!F.out && Math.hypot(F.D.cx - P.x, F.D.cz - P.z) < Math.max(F.D.bw, F.D.bd) / 2 + 3.5) return F; return null; };
function douse(F) { F.out = true; world.remove(F.g); const i = SMOKES.indexOf(F.sm); if (i >= 0) SMOKES.splice(i, 1); sfx('splash'); puff(F.D.cx, heightAt(F.D.cx, F.D.cz) + 4, F.D.cz, 0xd8d8d8, 20, 4, .3, 1.4, -1); toast(`Fire’s out on the ${F.D.sign.toLowerCase()}`, 2.2); }
/* grabbers: they go for people */
function siegeGrab(e, dt) {
  const p = e.p;
  if (e.carry) {
    const d0 = campD(e.x, e.z), a = Math.atan2(e.x, e.z), tx = Math.sin(a) * 180, tz = Math.cos(a) * 180;
    if (d0 < CAMP_R + 1 && d0 > CAMP_R - 2.5) { const w = wallPt(a, 1.8); e.x = w.x; e.z = w.z; }   // over the wall with them
    const v = moveEnt(e, tx, tz, e.speed * .85, dt); e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
    e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
    if (d0 > 128) { // gone
      const vic = e.carry; vic.dead = true; removeEnt(vic); SIEGE.taken.push(vic.shopName || 'a settler'); (G.flags.siegeLog.taken ||= []).push(vic.shopName || 'a settler');
      if (vic.sid) { const R = setS().ros.find(x => x.id === vic.sid); if (R) R.taken = 'grey'; }
      toast(`${vic.shopName || 'Someone'} was dragged off into the dark`, 4); sfx('no'); removeEnt(e); e.dead = true;
    }
    return true;
  }
  // find someone to take: outside the sealed hull, not already taken, not down
  if ((e.pickT = (e.pickT || 0) - dt) <= 0 || !e.prey || e.prey.dead || !ents.includes(e.prey) || e.prey.grabbed) {
    e.pickT = 1; let b = null, bd = 90;
    for (const o of ents) { if (o.type !== 'npc' || o.dead || o.grabbed || o.downed || !(o.settler || o.name === 'extra' || o.sid) || !o.g.visible) continue; if (inHull(o.x, o.z) && hullDoor.hp > 0 && !hullDoor.open) continue; const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; b = o; } }
    e.prey = b;
  }
  const o = e.prey; if (!o) return false;
  if (campD(e.x, e.z) > CAMP_R + .5 && !e.climbing) return false;   // let the usual raid code get them over the wall
  const d = Math.hypot(o.x - e.x, o.z - e.z);
  if (d < 1.5) { e.carry = o; o.grabbed = e; o.g.visible = false; SIEGE.grabbed.push(o);
    const bun = mesh(new THREE.BoxGeometry(.5, .5, 1.3), M(0x5a6a7a), .3, 1.6, 0, e.g); e.bundle = bun;
    toast(`They’ve got ${o.shopName || 'someone'}! Stop them!`, 3.4); sfx('grunt'); return true; }
  const v = moveEnt(e, o.x, o.z, e.speed, dt); e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v);
  e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return true;
}
/* each frame of the siege */
function updSiege(dt) {
  if (!SIEGE.on) return;
  if (!night.active) { SIEGE.on = false; return; }
  const st = siegeStage();
  if (st !== SIEGE.stage) {
    SIEGE.stage = st; card(`STAGE ${st + 1} · ${STAGES[st][0]}`, STAGES[st][1], 3.6); horn(74 + st * 3, 2.4, .24, 4);
    if (st === 0) say([['Kade', 'Every side at once. Watch the west and the north — the gate’s not the only way in.']]);
    if (st === 1) { siegeBreach(); say([['Kade', 'They blew the wall! Get to the gap — and someone put those fires out!']]); SIEGE.fireT = 4; }
    if (st === 2) say([['Juno', 'They’re not fighting — they’re taking people! Get everyone into the Arc!']]);
    if (st === 3) {
      say([['Kade', 'Greyhold. And there’s Garrun… they’re all here. Hold!']]);
      for (const f of FAC_IDS) { if (f === 'arc' || !facHostile(f) || facS(f).lead > G.day) continue; const C = FAC[f].cap(); if (!C) continue; const a = Math.atan2(C.x, C.z), r = 118;
        const e = spawnClan(f === 'grey' ? 'soldier' : f === 'iron' ? 'gunner' : 'brute', Math.sin(a) * r, Math.cos(a) * r, 'raid', facFac(f)); e.tribe = f; e.leader = f; e.name = FAC[f].leader[0]; e.hp = e.maxhp = e.maxhp * 3; e.g.scale.multiplyScalar(1.12); }
      const al = FAC_IDS.filter(f => facAllied(f)); if (al.length && !SIEGE.alliesIn) { SIEGE.alliesIn = true; for (const f of al) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 6; i++) { const e = spawnClan(K[i % K.length], rr(-6, 6), CAMP_R + rr(6, 14), 'ally', facFac(f)); e.tribe = f; e.state = 'ally'; } }
        setTimeout(() => card(`THE ${al.map(f => FAC[f].n.toUpperCase()).join(' AND THE ')} ARE HERE`, 'Your allies came', 3.6), 2000); }
    }
  }
  // fires
  if (st >= 1) { SIEGE.fireT -= dt; if (SIEGE.fireT <= 0) { SIEGE.fireT = rr(26, 40) - st * 3; if (SIEGE.fires.filter(F => !F.out).length < 3 && SIEGE.fires.length < 5) siegeFire(); } }
  for (const F of SIEGE.fires) if (!F.out) { F.t += dt; F.l.intensity = 2 + Math.sin(G.t * 9) * .4; for (const f of F.flames) f.scale.y = 1 + Math.sin(G.t * 12 + f.position.x) * .25 + Math.min(1, F.t / 60); if (F.t > 75 && !F.gutted) { F.gutted = true; toast(`The ${F.D.sign.toLowerCase()} is gutted`, 3); } }
  // people getting hurt on the wall and in the yard
  if (st >= 0) { SIEGE.hurtT -= dt; if (SIEGE.hurtT <= 0) { SIEGE.hurtT = rr(30, 50);
    const pool = ents.filter(o => o.type === 'npc' && !o.dead && !o.downed && !o.grabbed && o.g.visible && (o.guard || o.name === 'watch' || o.settler) && !inHull(o.x, o.z) && campD(o.home.x, o.home.z) < CAMP_R);
    if (pool.length) { const o = pick(pool); o.downed = true; o.dieT = 90; o.siegeHurt = true; o.route = null; toast(`${o.shopName || (o.name === 'watch' ? 'One of the watch' : 'Someone')} is down — get a bandage into them!`, 4); } } }
  // anyone whose taker died is free
  for (const o of [...SIEGE.grabbed]) { const e = o.grabbed; if (e && (e.dead || !ents.includes(e)) && !o.dead) { o.grabbed = null; o.g.visible = true; o.x = e.x; o.z = e.z; SIEGE.grabbed.splice(SIEGE.grabbed.indexOf(o), 1); toast(`${o.shopName || 'They'} broke free!`, 2.6); } }
}
const SGINTERACT = [{ id: 'douse', at: () => nearFire(), r: 9, label: () => `Put out the fire on the ${nearFire().D.sign.toLowerCase()}`, act: () => { const F = nearFire(); startChan({ l: 'Beating out the flames', t: 2.4, fn: () => douse(F) }); } }];

/* ---------- dawn after Night 100 ---------- */
function siegeAfter(won) {
  const L = G.flags.siegeLog || { taken: [], dead: [] }, S = setS();
  // the hurt who weren't treated
  for (const o of [...ents]) if (o.type === 'npc' && o.downed && o.siegeHurt) { L.dead.push(o.shopName || 'one of the watch'); o.dead = true; removeEnt(o); }
  // anyone still carried off is gone
  for (const o of SIEGE.grabbed) if (!o.dead) { L.taken.push(o.shopName || 'a settler'); o.dead = true; removeEnt(o); }
  // if it fell, they took more
  if (!won) { const pool = S.ros.filter(R => !R.held && survEnt(R)); for (let i = 0; i < 3 && pool.length; i++) { const R = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; R.taken = 'grey'; const e = SROS[R.id]; if (e) { e.dead = true; removeEnt(e); } L.taken.push(R.n); } INV.scrap = Math.floor(INV.scrap * .5); for (const k in S.stores) S.stores[k] = Math.floor(S.stores[k] * .4); }
  // the roster: the taken are missing (Season 2 will look for them), the dead are gone
  for (const R of [...S.ros]) { const e = SROS[R.id]; if (R.taken) { (S.missing ||= []).push({ n: R.n, id: R.id, day: G.day, by: R.taken }); S.ros.splice(S.ros.indexOf(R), 1); } else if (e && e.dead) { S.ros.splice(S.ros.indexOf(R), 1); S.lost++; } }
  // what burned
  const burnt = new Set(G.flags.burnt || []); for (const F of SIEGE.fires) if (!F.out) { burnt.add(F.id); world.remove(F.g); } G.flags.burnt = [...burnt]; siegeScorch();
  S.morale = clamp(S.morale + (won ? 12 : -15) - (L.dead.length + L.taken.length) * 5 - burnt.size * 3, 0, 100);
  G.flags.s1end = { won: won ? 1 : 0, dead: L.dead, taken: L.taken, burnt: [...burnt], day: G.day };
  if (!won) G.flags.fell100 = 1;
  if (SIEGE.breachG) { SIEGE.breachG.visible = false; }
  SIEGE.on = false; SIEGE.fires = []; SIEGE.grabbed = [];
  setTimeout(() => card(won ? 'KESTREL HELD' : 'KESTREL FELL — BUT IT STANDS', [L.dead.length ? `${L.dead.length} dead` : 'nobody died', L.taken.length ? `${L.taken.length} taken` : 'nobody taken', burnt.size ? `${burnt.size} building${burnt.size > 1 ? 's' : ''} burned` : 'no fires left'].join(' · '), 6), 6500);
  save();
}
// burned buildings: soot, charred beams and smoke until someone clears them
const SIEGE_SCORCH = {};
function siegeScorch() {
  for (const id in SIEGE_SCORCH) { world.remove(SIEGE_SCORCH[id].g); const i = SMOKES.indexOf(SIEGE_SCORCH[id].sm); if (i >= 0) SMOKES.splice(i, 1); delete SIEGE_SCORCH[id]; }
  for (const id of G.flags.burnt || []) { const D = SHOP[id]; if (!D) continue; const y = heightAt(D.cx, D.cz), g = new THREE.Group(); g.position.set(D.cx, y, D.cz); g.rotation.y = D.ry; world.add(g);
    const soot = mesh(new THREE.BoxGeometry(D.bw + .3, 4.2, D.bd + .3), new THREE.MeshLambertMaterial({ color: 0x0e0c0a, transparent: true, opacity: .55, depthWrite: false }), 0, 2.1, 0, g); soot.castShadow = false;
    for (let i = 0; i < 8; i++) { const b = mesh(new THREE.BoxGeometry(.25, .25, rr(2, 4)), M(0x1a1612), rr(-D.bw / 2, D.bw / 2), rr(.2, 1.2), rr(-D.bd / 2 - 2, -D.bd / 2 - .5) * -1, g); b.rotation.set(rr(-.4, .4), rr(0, 3), rr(-.3, .3)); }
    const sm = { x: D.cx, z: D.cz, y: y + 4, k: rnd() }; SMOKES.push(sm); SIEGE_SCORCH[id] = { g, sm }; }
}
const nearScorch = () => { for (const id of G.flags.burnt || []) { const D = SHOP[id]; if (D && Math.hypot(D.front.x - P.x, D.front.z - P.z) < 4) return D; } return null; };
SGINTERACT.push({ id: 'rebuild', at: () => nearScorch() && nearScorch().front, r: 4, label: () => { const D = nearScorch(), n = cnt('log') + sCnt('log'); return `Clear and rebuild the ${D.sign.toLowerCase()} (8 logs · you have ${n})`; },
  act: () => { const D = nearScorch(); let need = 8; const fromS = Math.min(sCnt('log'), need); need -= fromS; if (cnt('log') < need) { sfx('no'); toast('Not enough logs — 8 from your bag or the stores', 2.6); return; }
    startChan({ l: 'Clearing the wreckage', t: 3.2, fn: () => { sAdd('log', -fromS); take('log', need); G.flags.burnt = (G.flags.burnt || []).filter(x => x !== D.id); siegeScorch(); setS().morale += 3; toast(`The ${D.sign.toLowerCase()} is back in business`, 2.6); save(); } }); } });
function siegeRestore() { SIEGE.on = false; siegeScorch(); }
window.__SG = { SIEGE, updSiege, siegeAfter, siegeFire, nearFire, siegeStage };
