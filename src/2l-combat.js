
/* ================= combat: smarter enemies, stealth, companions, bosses (Nov 11, Part 9 of the overhaul) =================
   · enemies hear things (`aiNoise`: a gunshot carries ~85 m, a bow ~12, a blade ~6): guards who hear walk over to look,
     and spot you if you're in sight when they get there. A guard who spots you shouts, and others of their faction
     within ~130 m come running (`aiCallHelp`). Gunners who get hurt break for cover (a tree or rock between them and
     you) and fire from it (`aiCover`, called from updGunner). Fighters with spears and blades come at you from the
     sides when there's more than one (`flank`). Badly hurt and alone, they run (`flee`) — leaders and raiders don't.
   · stealth: C crouches (lower, slower, much harder to see; touch: the CROUCH button). A blade from behind on someone
     who hasn't seen you, crouched, is a silent takedown.
   · companions: bring one survivor along (bag → Settlement → Bring along). Z (or tap their tag) cycles the order:
     follow · wait here · defend this spot · attack. They shoot at whatever's after you, carry 15 kg for you, and talk.
   · bosses: Garrun (Thornkin war-chief: a war horn that brings warriors, and a charge you can sidestep — he staggers if
     he misses into something), Rask (Ironjaw: armour plate that shrugs off shots from the front, firebombs; get behind
     him or blast him to stagger him), Kael Swift (Ridge Runners: vanishes in smoke and comes at you from behind, throws
     spears). A health bar shows while one's on you. */

/* ---------- hearing, helping, cover, flanking, fleeing ---------- */
function aiNoise(x, z, r) {
  for (const e of ents) { if (e.type !== 'clan' || e.dead || e.mode === 'raid' || e.mode === 'ally' || (e.pk || null) !== UG.at) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > r) continue;
    if (e.state === 'idle') { if (d < r * .3 && facHostileE(e)) { e.state = 'chase'; alertNear(e); } else e.inv = { x: x + rr(-5, 5), z: z + rr(-5, 5), t: 10 }; } }
}
let aiHelpT = 0;
function aiCallHelp(e) {
  if (e.called || e.mode === 'raid' || !facHostileE(e) || G.t < aiHelpT) return; e.called = 1;
  const f = facOf(e); let n = 0;
  for (const o of ents) if (o !== e && o.type === 'clan' && !o.dead && o.state === 'idle' && !o.route && facOf(o) === f && Math.hypot(o.x - e.x, o.z - e.z) < 130) { o.inv = { x: P.x + rr(-6, 6), z: P.z + rr(-6, 6), t: 16 }; o.called = 1; n++; }
  if (n >= 2) { aiHelpT = G.t + 60; toast(`They’re calling for help — ${n} more coming`, 2.6); if (typeof horn === 'function') horn(66, 1.2, .08, 2); }
}
const behindOf = e => { const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1; return (dx * fx + dz * fz) / d < -.2; };
function aiCover(e, dt, dp) {
  if (e.boss) return null;
  if (!e.cover && !e.coverTried && e.hp < e.maxhp * .65) {
    e.coverTried = 1; let best = null, bs = 1e9;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = grid.get(gkey(Math.floor(e.x / CELL) + i, Math.floor(e.z / CELL) + j)); if (!L) continue;
      for (const c of L) { if (c.r < .3 || c.r > 3.5) continue; const de = Math.hypot(c.x - e.x, c.z - e.z); if (de > 14) continue; const dpc = Math.hypot(c.x - P.x, c.z - P.z); if (dpc < 8) continue;
        const sc = de - dpc * .2; if (sc < bs) { bs = sc; best = c; } } }
    if (best) { const dx = best.x - P.x, dz = best.z - P.z, d = Math.hypot(dx, dz) || 1; e.cover = { x: best.x + dx / d * (best.r + .75), z: best.z + dz / d * (best.r + .75) }; e.coverT = 14; }
  }
  if (!e.cover) return null;
  e.coverT -= dt; if (e.coverT <= 0 || dp < 5) { e.cover = null; return null; }
  const c = e.cover, d = Math.hypot(c.x - e.x, c.z - e.z);
  if (d > .8) return [c.x, c.z, e.speed * 1.1];
  e.yaw = Math.atan2(P.x - e.x, P.z - e.z);
  if (e.cool <= 0 && dp < 70) { e.cool = rr(1.1, 1.9); if (!gunnerShoot(e)) e.cool = .5; }
  return [e.x, e.z, 0];
}
function aiMove(e, tx, tz, spd, dt) { const p = e.p, v = moveEnt(e, tx, tz, spd, dt); e.ph += dt * strideRate(v); poseWalk(p, e.ph, Math.min(1, v / 3), v); e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return v; }
function aiUpd(e, dt) {
  if (e.mode === 'ally' || e.mode === 'raid' && !e.boss) return false;
  const dxp = P.x - e.x, dzp = P.z - e.z, dp = Math.hypot(dxp, dzp), gun = e.kind === 'gunner' || e.kind === 'soldier';
  if (e.fac === 'grey') trooperUpd(e, dt, dp);
  if (e.boss && e.state === 'chase' && bossUpd(e, dt, dp)) return true;
  // running for it
  if (e.flee > 0) { e.flee -= dt; const a = Math.atan2(-dxp, -dzp); aiMove(e, e.x + Math.sin(a) * 10, e.z + Math.cos(a) * 10, e.speed * 1.15, dt); if (e.flee <= 0) { e.state = 'idle'; e.home = { x: e.x, z: e.z }; } return true; }
  if (e.state === 'chase' && !e.fled && !e.leader && e.hp < e.maxhp * .28) {
    const pals = ents.filter(o => o !== e && o.type === 'clan' && !o.dead && o.state === 'chase' && facOf(o) === facOf(e) && Math.hypot(o.x - e.x, o.z - e.z) < 25).length;
    if (pals < 2 && rnd() < .6) { e.fled = 1; e.flee = rr(7, 10); e.state = 'flee'; sfx('grunt'); return true; }
  }
  // walking over to see what that noise was
  if (e.state === 'idle' && e.inv) {
    const sees = (gun ? 46 : 32) * stealthK() * (isNight() ? .7 : 1) * wxSight();
    if (facHostileE(e) && dp < sees && !P.dead && !UG.at && !inSmoke(P.x, P.z)) { e.inv = null; e.state = 'chase'; sfx('grunt'); alertNear(e); return false; }
    const d = Math.hypot(e.inv.x - e.x, e.inv.z - e.z);
    if (d > 2) aiMove(e, e.inv.x, e.inv.z, e.speed * .7, dt); else { e.inv.t -= dt; e.yaw += dt * 1.2; aiMove(e, e.x, e.z, 0, dt); if (e.inv.t <= 0) e.inv = null; }
    return true;
  }
  // coming at you from the side
  if (e.state === 'chase' && !gun && e.kind !== 'thrower' && dp > 5 && dp < 26 && !e.atk && !e.throwT) {
    if (e.flank == null) e.flank = ents.filter(o => o.type === 'clan' && !o.dead && o.state === 'chase' && Math.hypot(o.x - P.x, o.z - P.z) < 30).length >= 2 ? (rnd() < .5 ? 1 : -1) * rr(.6, 1.1) : 0;
    if (e.flank) { const a0 = Math.atan2(e.x - P.x, e.z - P.z) + e.flank * .55, R = Math.max(2, dp - 4); aiMove(e, P.x + Math.sin(a0) * R, P.z + Math.cos(a0) * R, e.speed * 1.12, dt); return true; }
  }
  return false;
}
// damage the player does, adjusted: armour, staggers
function aiDamageMod(e, n, byPlayer) {
  if (!byPlayer || e.type !== 'clan') return n;
  if (e.boss === 'rask') { if (n >= 70) { e.stagger = 4; toast('Rask staggers!', 1.6); return n; } if (!(e.stagger > 0) && !behindOf(e)) { if (!G.flags.raskTip) { G.flags.raskTip = 1; toast('His plate soaks it — get behind him, or blast him', 3); } return n * .3; } }
  if (e.stagger > 0) return n * 2;
  return n;
}

/* ---------- crouching ---------- */
function setCrouch(v) { P.crouch = v; const b = $('bCrouch'); if (b) b.classList.toggle('on', v); }

/* ---------- bosses ---------- */
const BOSS = { thorn: 'garrun', iron: 'rask', ridge: 'kael' };
function bossTag(e) { if (e.leader && BOSS[e.leader] && !e.boss) { e.boss = BOSS[e.leader]; e.bT = 4; } }
const BOSS_FIRES = [];
function bossUpd(e, dt, dp) {
  e.bT -= dt; if (e.stagger > 0) { e.stagger -= dt; e.p.body.rotation.z = Math.sin(G.t * 18) * .15; aiMove(e, e.x, e.z, 0, dt); return true; }
  const dxp = P.x - e.x, dzp = P.z - e.z;
  if (e.boss === 'garrun') {
    if (!e.horn1 && e.hp < e.maxhp * .7 || !e.horn2 && e.hp < e.maxhp * .35) { if (!e.horn1) e.horn1 = 1; else e.horn2 = 1; toast('Garrun sounds his war horn!', 2.6); if (typeof horn === 'function') horn(58, 2.2, .3, 3);
      for (let i = 0; i < 3; i++) { const a = rr(0, 6.28); const w = spawnClan(i ? 'warrior' : 'thrower', e.x + Math.sin(a) * 25, e.z + Math.cos(a) * 25, 'guard', 'clan'); w.tribe = 'thorn'; w.state = 'chase'; } }
    if (e.charge) {
      const C = e.charge; C.t -= dt;
      if (C.t > 0 && !C.go) { e.yaw = Math.atan2(dxp, dzp); e.p.body.rotation.x = -.25; aiMove(e, e.x, e.z, 0, dt); if (C.t < .05) { C.go = 1; C.t = 1.2; C.dx = Math.sin(e.yaw); C.dz = Math.cos(e.yaw); sfx('roar'); } return true; }
      if (C.go) { const ox = e.x, oz = e.z; e.x += C.dx * 15 * dt; e.z += C.dz * 15 * dt; collide(e, e.r); const moved = Math.hypot(e.x - ox, e.z - oz);
        e.ph += dt * strideRate(12); poseWalk(e.p, e.ph, 1, 12); e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z);
        if (!C.hit && Math.hypot(P.x - e.x, P.z - e.z) < 1.8) { C.hit = 1; hurtPlayer(28, e.x, e.z); P.vx += C.dx * 9; P.vz += C.dz * 9; }
        if (moved < 15 * dt * .4 && !C.hit) { e.charge = null; e.stagger = 2.5; sfx('thud'); toast('Garrun slams into it — he’s dazed!', 1.8); return true; }
        if (C.t <= 0 || C.t < 1.2 && C.go === 1 && C.t - dt <= 0) e.charge = null; if (C.t <= 0) e.charge = null; return true; }
    }
    if (e.bT <= 0 && dp > 7 && dp < 24) { e.bT = rr(8, 11); e.charge = { t: 1 }; toast('Garrun lowers his head…', 1); sfx('growl'); return true; }
    return false;
  }
  if (e.boss === 'rask') {
    if (e.bT <= 0 && dp > 6 && dp < 30) { e.bT = rr(6, 8); const tx = P.x + P.vx * .8, tz = P.z + P.vz * .8;   // a firebomb where you'll be
      const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3a })); world.add(b); const x0 = e.x, z0 = e.z, y0 = e.y + 1.8; let t = 0;
      BOSS_FIRES.push({ ball: b, t: 0, run(dt2) { t += dt2; const k = Math.min(1, t / 1.1); b.position.set(lerp(x0, tx, k), lerp(y0, heightAt(tx, tz), k) + Math.sin(k * Math.PI) * 6, lerp(z0, tz, k));
        if (k >= 1 && !this.land) { this.land = 1; world.remove(b); sfx('boom', .5); this.zone = { x: tx, z: tz, r: 3.2, life: 6 }; this.fl = []; for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: .85 })); f.position.set(tx + rr(-2.4, 2.4), heightAt(tx, tz) + .6, tz + rr(-2.4, 2.4)); world.add(f); this.fl.push(f); } }
        if (this.zone) { this.zone.life -= dt2; for (const f of this.fl) f.scale.y = 1 + Math.sin(G.t * 14 + f.position.x) * .3; if (Math.hypot(P.x - tx, P.z - tz) < this.zone.r && !P.dead) { P.hp -= 11 * dt2; if (rnd() < dt2 * 3) sfx('hurt', .5); } if (this.zone.life <= 0) { for (const f of this.fl) world.remove(f); return false; } }
        return true; } });
      sfx('whoosh'); }
    return false;
  }
  if (e.boss === 'kael') {
    if (e.bT <= 0 && dp < 30) { e.bT = rr(9, 12); puff(e.x, e.y + 1, e.z, 0x9a9a9a, 26, 3, .6, 2.4, 0); sfx('whoosh');
      const a = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)) + Math.PI + rr(-.6, .6), x = P.x + Math.sin(a) * 7, z = P.z + Math.cos(a) * 7;
      if (waterAt(x, z) < heightAt(x, z) - .5) { e.x = x; e.z = z; e.y = heightAt(x, z); e.g.position.set(e.x, e.y, e.z); puff(e.x, e.y + 1, e.z, 0x9a9a9a, 20, 2, .6, 2, 0); toast('Kael’s behind you!', 1.4); } return true; }
    if (dp > 9 && dp < 26 && e.cool <= 0 && !e.throwT) { e.yaw = Math.atan2(dxp, dzp); e.cool = rr(1.8, 2.6); e.throwT = .5; e.target = 'p'; }
    return false;
  }
  return false;
}
// the boss's health bar
let bossBar = null;
function updBossBar() {
  let b = null, bd = 60; for (const e of ents) if (e.boss && !e.dead && e.state === 'chase') { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } }
  if (!bossBar) { bossBar = document.createElement('div'); bossBar.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);width:min(420px,70vw);z-index:20;pointer-events:none;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#efe9dc;text-align:center;display:none'; bossBar.innerHTML = '<span></span><div style="height:7px;background:#0008;border:1px solid #fff3;border-radius:3px;margin-top:3px"><i style="display:block;height:100%;background:#d9503a;border-radius:2px"></i></div>'; document.body.appendChild(bossBar); }
  bossBar.style.display = b ? 'block' : 'none'; if (b) { bossBar.firstChild.textContent = `${b.name.toUpperCase()} · ${FAC[b.leader].leader[1].toUpperCase()} OF THE ${FAC[b.leader].n.toUpperCase()}${b.stagger > 0 ? ' · STAGGERED' : ''}`; bossBar.querySelector('i').style.width = Math.max(0, b.hp / b.maxhp * 100) + '%'; }
}

/* ---------- companions ---------- */
const CMDS = [['follow', 'Following'], ['wait', 'Waiting here'], ['defend', 'Defending this spot'], ['attack', 'Attacking']];
const compS = () => G.flags.comp || null;
const compEnt = () => { const C = compS(); if (!C) return null; const e = SROS[C.id]; return e && !e.dead && ents.includes(e) ? e : null; };
const compCarry = () => compEnt() ? 15 : 0;
let compTag = null, compBarkT = 0, compTalkT = 90;
function compSet(id) {
  const old = compEnt(); if (old) { old.comp = false; old.follow = false; }
  if (!id) { G.flags.comp = null; compHud(); save(); return; }
  const R = setS().ros.find(r => r.id === id); if (!R) return; G.flags.comp = { id, cmd: 'follow' };
  const e = SROS[id]; if (e) { e.comp = true; e.g.visible = true; e.away = false; } say([[R.n, pick(['I’ll grab my things.', 'Lead the way.', 'About time someone asked.', 'Right behind you.'])]]); compHud(); save();
}
function compCmd(next) {
  const C = compS(); if (!C || !compEnt()) return; const i = CMDS.findIndex(c => c[0] === C.cmd); C.cmd = next || CMDS[(i + 1) % CMDS.length][0];
  const e = compEnt(); if (C.cmd === 'wait' || C.cmd === 'defend') C.at = { x: e.x, z: e.z }; sfx('pickup'); compHud();
  say([[setS().ros.find(r => r.id === C.id).n, { follow: 'With you.', wait: 'I’ll wait here.', defend: 'Nobody gets past me.', attack: 'Going in!' }[C.cmd]]]);
}
function compHud() {
  if (!compTag) { compTag = document.createElement('div'); compTag.style.cssText = 'position:fixed;left:16px;bottom:96px;z-index:21;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#efe9dc;background:#0009;border:1px solid #7fc4b866;border-radius:4px;padding:4px 10px;cursor:pointer;display:none'; compTag.addEventListener('click', e => { e.stopPropagation(); compCmd(); }); compTag.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); compCmd(); }, { passive: false }); document.body.appendChild(compTag); }
  const C = compS(), e = compEnt(); compTag.style.display = C && e ? 'block' : 'none';
  if (C && e) compTag.textContent = `${setS().ros.find(r => r.id === C.id).n} · ${CMDS.find(c => c[0] === C.cmd)[1]}${isTouch ? ' · tap' : ' · Z'}`;
}
// called from setNPC (2h) for the companion: everything they do
function compUpd(e, dt) {
  const C = compS(); if (!C || C.id !== e.sid) { e.comp = false; return false; }
  e.g.visible = true; e.away = false;
  const dp = Math.hypot(P.x - e.x, P.z - e.z);
  if (UG.at) { aiMove2(e, e.x, e.z, 0, dt); return true; }       // they wait at the top while you're underground
  if (dp > 70 && (C.cmd === 'follow' || C.cmd === 'attack')) { const a = P.yaw; e.x = P.x + Math.sin(a) * 3; e.z = P.z + Math.cos(a) * 3; }
  // who to shoot
  let foe = null, fd = C.cmd === 'attack' ? 60 : C.cmd === 'defend' ? 28 : 34; const ax = C.cmd === 'defend' && C.at ? C.at.x : e.x, az = C.cmd === 'defend' && C.at ? C.at.z : e.z;
  for (const o of ents) { if (o.dead || !(isFoe(o) && (o.state === 'chase' || o.mode === 'raid' || C.cmd === 'attack') || o.sp && o.sp.kind === 'pred' && o.state === 'hunt')) continue; const d = Math.hypot(o.x - ax, o.z - az); if (d < fd) { fd = d; foe = o; } }
  let tx = e.x, tz = e.z, spd = 0;
  if (C.cmd === 'follow') { if (dp > 3.4) { tx = P.x; tz = P.z; spd = dp > 9 ? 7.2 : 4.6; } }
  else if (C.cmd === 'wait' || C.cmd === 'defend') { const a = C.at || e; if (Math.hypot(a.x - e.x, a.z - e.z) > 1.2) { tx = a.x; tz = a.z; spd = 4.4; } }
  else if (C.cmd === 'attack' && foe) { const d = Math.hypot(foe.x - e.x, foe.z - e.z); if (d > 16) { tx = foe.x; tz = foe.z; spd = 5.2; } }
  if (foe) { e.fireT = (e.fireT || 0) - dt; if (e.fireT <= 0) { e.fireT = rr(.8, 1.3); e.yaw = Math.atan2(foe.x - e.x, foe.z - e.z);
    const from = new THREE.Vector3(e.x + Math.sin(e.yaw) * .4, e.y + 1.4, e.z + Math.cos(e.yaw) * .4), to = new THREE.Vector3(foe.x + rr(-.3, .3), foe.y + 1.1, foe.z + rr(-.3, .3));
    tracer(from, to, 0xffe0a0); sfx('turret', Math.max(.15, 1 - dp / 70)); if (rnd() < .55) damage(foe, rr(14, 22), false, to);
    if (G.t > compBarkT) { compBarkT = G.t + 25; say([[setS().ros.find(r => r.id === C.id).n, pick(['Contact!', 'On your left!', 'I see them!', 'Keep your head down!'])]]); } } }
  else if ((compTalkT -= dt) <= 0) { compTalkT = rr(110, 180); if (dp < 12 && !night.active) say([[setS().ros.find(r => r.id === C.id).n, pick(['Quiet out here. Too quiet, or just quiet?', 'My feet hurt. Don’t tell anyone I said that.', 'Do you think the Arc can see us from up there?', 'I’ll carry what you can’t. Within reason.', 'When this is over, I’m sleeping for a week.'])]]); }
  aiMove2(e, tx, tz, spd, dt); if (!spd && foe) e.g.rotation.y = e.yaw;
  return true;
}
function aiMove2(e, tx, tz, spd, dt) { const v = spd ? moveEnt(e, tx, tz, spd, dt) : 0; if (!v && !spd) { const dp = Math.hypot(P.x - e.x, P.z - e.z); if (dp < 6) e.yaw += angWrap(Math.atan2(P.x - e.x, P.z - e.z) - e.yaw) * Math.min(1, dt * 4); } e.ph += dt * strideRate(v); poseWalk(e.p, e.ph, Math.min(1, v / 2.5), v); e.y = Math.max(heightAt(e.x, e.z), floorAt(e.x, e.z, e.y ?? 0)); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; }

/* ---------- setup and each frame ---------- */
function buildCombat() {
  // Juno/Kade's alertNear gets the call-for-help on top (function declarations can be wrapped)
  const an = alertNear; alertNear = function (e) { an(e); aiCallHelp(e); };
  if (isTouch) { const b = document.createElement('button'); b.id = 'bCrouch'; b.textContent = 'CROUCH'; b.style.cssText = 'position:fixed;right:18px;top:46%;z-index:22;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.1em;padding:9px 12px;border-radius:24px;border:1px solid #fff4;background:#0007;color:#efe9dc';
    b.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); setCrouch(!P.crouch); }, { passive: false }); document.body.appendChild(b); const st = document.createElement('style'); st.textContent = '#bCrouch.on{background:#7fc4b8;color:#111}'; document.head.appendChild(st); }
  window.__C = { aiNoise, compSet, compCmd, compUpd, bossUpd, BOSS_FIRES, setCrouch };
}
function combatRestore() { setCrouch(false); const C = compS(); if (C) { const e = SROS[C.id]; if (e) e.comp = true; else G.flags.comp = null; } compHud(); }
function updCombat(dt) {
  for (const e of ents) if (e.leader && !e.boss) bossTag(e);
  for (const F of [...BOSS_FIRES]) if (!F.run(dt)) BOSS_FIRES.splice(BOSS_FIRES.indexOf(F), 1);
  updBossBar();
  if (compS() && !compEnt()) { G.flags.comp = null; compHud(); }
}
