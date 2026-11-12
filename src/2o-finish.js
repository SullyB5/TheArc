
/* ================= finishing the overhaul (Nov 11, part 12) =================
   What was left after Parts 1–11:
   · bosses: Captain Vale (gas canisters, a shield in the reactor hall you take down by closing two coolant valves,
     reinforcements) and the Pale One, first of the Hollowed (the Drift's deep chamber: he can only really be hurt
     while the braziers burn, puts them out, leaps), with trophies.
   · crafting: blueprints (found in secrets, vaults and on bosses) teach new recipes; workshop upgrades (bench, lab, forge
     — each makes more per craft); salvage (strip gear you don't want at a bench for scrap and parts).
   · cosmetics: Kestrel's colours (outpost banners and the gate flags) and a trophy rack by the stores, unlocked by
     secrets, bosses and the story — including one for the secret unlock.
   · factions: take a beaten enemy prisoner and trade prisoners at the white flag; each clan and Ironjaw keep restricted
     ground near home (an elder grove, a scrap market…) open only to friends — walk in uninvited and they come for you.
   · missions: other ways through several Season 1 missions (a water filter instead of the valve, buying the war-map at
     Farlight, any transmitter, herbal medicine for the fever, questioning a Thornkin prisoner for the war plans).
   · people get hurt: raiders and anyone hunting you can wound settlers outside the Arc and your companion — wounded
     people go down and need a bandage, or they die.
   · the settlement: an outer gatehouse on the south road (a project), settlers who sit round the fire in the evening
     and talk to each other, traders whose stock gets better as the story goes on.
   · events: Greyhold equipment shipments, a quarrel between two friendly factions you can step into, hot zones.
   · balance: the Mountain's turret fires slower and misses more. */

/* ---------- blueprints ---------- */
const BLUEPRINTS = {
  bp_trooper: { n: 'Blueprint: trooper armour', r: R_('trooper_armor', { steel: 4, synth: 3, cloth: 4, bolts: 6 }, 'wear', 5, { at: 'forge', bp: 'bp_trooper' }) },
  bp_rifle: { n: 'Blueprint: Greyhold rifle', r: R_('grey_rifle', { steel: 3, springs: 2, gears: 2, spare_parts: 2, scrap: 20 }, 'weap', 5, { at: 'forge', bp: 'bp_rifle' }) },
  bp_optics: { n: 'Blueprint: field optics', r: R_('nvg', { circuit: 1, battery: 1, glass: 2, scrap: 6 }, 'wear', 3, { at: 'lab', alt: 1, bp: 'bp_optics' }) },
  bp_serum: { n: 'Blueprint: Arden’s serum', r: R_('arden_serum', { rust_med: 1, blood_bag: 1, lab_sample: 1 }, 'med', 5, { at: 'lab', bp: 'bp_serum' }) },
  bp_hollow: { n: 'Blueprint: Hollowed cloak', r: R_('hollow_cloak', { hide: 4, cloth: 3, bone: 4 }, 'wear', 3, { at: 'bench', bp: 'bp_hollow' }) },
  bp_turret: { n: 'Blueprint: Ironjaw frag', r: R_('frag', { scrap: 4, gunpowder: 3, nails: 6 }, 'weap', 3, { at: 'bench', n: 2, bp: 'bp_turret' }) },
};
for (const id in BLUEPRINTS) { ITEMS[id] = { id, n: BLUEPRINTS[id].n, c: 'story', t: 1, src: 'story', w: .05 }; LORE[id] = 'Read it and you know how to make it (it teaches you a recipe).'; RECIPES.push(BLUEPRINTS[id].r); }
ITEMS.arden_serum = { id: 'arden_serum', n: 'Arden’s serum', c: 'med', t: 5, src: 'craft', w: .1 }; LORE.arden_serum = 'Ten minutes where the Rust can’t touch you, and it clears what’s already in you.';
MEDS.arden_serum = { h: 20, fix: ['dose', 'sick'], fn: () => { P.immune = Math.max(P.immune || 0, 600); return 'the Rust can’t touch you for a while'; } };
const bpKnown = id => !!(G.flags.bp || {})[id];
function bpLearn() { for (const id in BLUEPRINTS) if (cnt(id) > 0) { take(id, 1); (G.flags.bp ||= {})[id] = G.day; card('BLUEPRINT LEARNED', BLUEPRINTS[id].n.replace('Blueprint: ', '') + ' · bag → Craft', 3.4); save(); } }
// where the blueprints are: added to vaults and caches that already exist
const BP_AT = { x_mtn_secret: 'bp_trooper', x_hesper_armory: 'bp_rifle', x_lab_archive: 'bp_optics', x_site9_vault: 'bp_serum', x_hollow_hoard: 'bp_hollow', x_cave_deep: 'bp_turret' };

/* ---------- workshop upgrades and salvage ---------- */
const STUP = { bench: { n: 'Workbench', cost: [{ plank: 10, nails: 20, scrap: 30 }, { steel: 4, spare_parts: 4, scrap: 60 }], d: 'ammo, tools and gear: +50% / +100% per craft' }, lab: { n: 'Lab', cost: [{ glass: 4, circuit: 2, scrap: 30 }, { sensor: 2, battery: 2, scrap: 60 }], d: 'medicine: +1 / +2 per craft' }, forge: { n: 'Forge', cost: [{ stone: 20, iron: 3, scrap: 30 }, { steel: 6, charcoal: 10, scrap: 60 }], d: 'gear comes out better made' } };
const stLv = k => (G.flags.stLv || {})[k] || 0;
function craftN(r) { const n = r.n || 1; if (r.at === 'bench' && n > 1 && (r.cat === 'weap' || r.cat === 'tool')) return Math.round(n * (1 + stLv('bench') * .5)); if (r.at === 'lab' && r.cat === 'med') return n + stLv('lab'); return n; }
const haveAll = cost => Object.entries(cost).every(([k, n]) => cnt(k) + sCnt(k) >= n);
function payAll(cost) { for (const [k, n] of Object.entries(cost)) { const fs = Math.min(sCnt(k), n); sAdd(k, -fs); if (n - fs > 0) take(k, n - fs); } }
function salvageOf(t) { const D = GEAR_DEFS[t.id] || {}, tier = D.t || 1, q = t.q ?? 1; return { scrap: 4 + tier * 4 + q * 2, spare_parts: tier >= 3 ? 1 + (q === 2 ? 1 : 0) : 0, cloth: D.kind === 'wear' ? 2 : 0 }; }
function workshopHTML() {
  const home = inKestrel(), atB = nearStation('bench');
  let h = `<h4>Workshops</h4><div class="jn">`;
  for (const k in STUP) { const U = STUP[k], lv = stLv(k), next = U.cost[lv];
    h += `<div style="padding:6px 8px;border:1px solid #fff2;border-radius:3px;background:#0002"><b>${U.n}</b> · level ${lv + 1}/3 <small style="opacity:.7">${U.d}</small>${next ? `<div><small>${Object.entries(next).map(([i, n]) => `<span style="color:${cnt(i) + sCnt(i) >= n ? '#7fc4b8' : '#e0a040'}">${nameOf(i).toLowerCase()} ${cnt(i) + sCnt(i)}/${n}</span>`).join(' · ')}</small> <button data-su="${k}"${G.flags.dev || (home && haveAll(next)) ? '' : ' class="dis"'}>Upgrade</button></div>` : ' <small style="color:#7fc4b8">· done</small>'}</div>`; }
  h += `</div><h4>Salvage${atB ? '' : ' · <small>at a workbench</small>'}</h4>`;
  if (atB) { const L = INV.tools.map((t, i) => [t, i]).filter(([t]) => !busy(t)); h += `<div class="row">${L.length ? L.map(([t, i]) => { const s = salvageOf(t); return itemTile(t.id, 1, `<button data-sv="${i}" title="${Object.entries(s).filter(([, n]) => n).map(([k, n]) => n + ' ' + nameOf(k).toLowerCase()).join(', ')}">Strip</button>`); }).join('') : '<p class="dim">Nothing to strip.</p>'}</div>`; }
  else h += '<p class="dim">Stand at a workbench to strip gear you don’t need for scrap and parts.</p>';
  return h + cosmeticsHTML();
}

function finAction(d) {
  if (d.su) { const U = STUP[d.su], lv = stLv(d.su), c = U && U.cost[lv]; if (!c || (!G.flags.dev && (!inKestrel() || !haveAll(c)))) { sfx('no'); return; } if (!G.flags.dev) payAll(c); (G.flags.stLv ||= {})[d.su] = lv + 1; sfx('pickup'); toast(`${U.n} upgraded · level ${lv + 2}`, 2.4); save(); }
  else if (d.sv) { const t = INV.tools[+d.sv]; if (!t || busy(t) || !nearStation('bench')) { sfx('no'); return; } const out = salvageOf(t); unequip(t); INV.tools.splice(INV.tools.indexOf(t), 1); for (const [k, n] of Object.entries(out)) if (n) { if (k === 'scrap') INV.scrap = (INV.scrap || 0) + n; else give(k, n); } sfx('metal'); toast('Stripped for ' + Object.entries(out).filter(([, n]) => n).map(([k, n]) => n + ' ' + nameOf(k).toLowerCase()).join(', '), 2.6); save(); }
  else if (d.kc) { const K = KCOL[d.kc]; if (!K || !K[2]()) { sfx('no'); return; } G.flags.kcol = d.kc; cosmeticsSync(); sfx('pickup'); save(); }

}
{ const sh0 = settlementHTML; settlementHTML = function () { return sh0() + workshopHTML(); }; }

/* ---------- cosmetics: Kestrel's colours, the trophy rack ---------- */
const KCOL = { amber: ['Kestrel amber', '#f0a640', () => true], lantern: ['Lantern gold', '#ffd870', () => (G.flags.lantern || 0) >= 6], thorn: ['Thornkin red', '#c0503a', () => facAllied('thorn') || facS('thorn').lead > 0], teal: ['Deep teal', '#3ad0c0', () => !!(G.flags.logs || {}).cv_deep], grey: ['Mountain grey', '#d8dce0', () => !!(G.flags.assault || {}).vale], floombus: ['Floombus violet', '#a070ff', () => !!G.flags.dev] };
const kColor = () => (KCOL[G.flags.kcol] || KCOL.amber)[1];
const TROPHIES = { garrun: ['Garrun’s war horn', () => !!G.flags.trophy_garrun], rask: ['Rask’s chest plate', () => !!G.flags.trophy_rask], kael: ['Kael’s spear', () => !!G.flags.trophy_kael], vale: ['Captain Vale’s cap', () => !!(G.flags.assault || {}).vale], pale: ['The Pale One’s mask', () => !!G.flags.paleDead], lantern: ['A Lantern lamp', () => (G.flags.lantern || 0) >= 6], stones: ['A thirteen-stone banner', () => !!(G.flags.logs || {}).cv_deep], floombus: ['A violet Floombus pennant', () => !!G.flags.dev] };
function cosmeticsHTML() {
  let h = `<h4>Kestrel’s colours</h4><div style="display:flex;gap:6px;flex-wrap:wrap">`;
  for (const k in KCOL) { const [n, c, ok] = KCOL[k], on = (G.flags.kcol || 'amber') === k; h += `<button data-kc="${k}" class="${on ? 'on' : ok() ? '' : 'dis'}" style="border-left:6px solid ${c}">${ok() ? n : '???'}</button>`; }
  const got = Object.entries(TROPHIES).filter(([, [, ok]]) => ok());
  return h + `</div><p class="pl"><small>Trophy rack by the stores: ${got.length ? got.map(([, [n]]) => n).join(' · ') : 'empty — bosses, secrets and the story fill it'} (${got.length}/${Object.keys(TROPHIES).length})</small></p>`;
}
let RACK = null, GATEFLAGS = [];
function buildRack() {
  const x = SPOTS.fire.x + 6.4, z = SPOTS.fire.z - 1.2, g = new THREE.Group(); xbox(g, 3.2, .12, .5, 'woodD', 0, 1.6, 0); xbox(g, 3.2, .12, .5, 'woodD', 0, .9, 0); for (const s of [-1, 1]) xbox(g, .12, 2, .5, 'woodD', s * 1.6, 1, 0);
  g.position.set(x, heightAt(x, z), z); g.rotation.y = rr(-.2, .2); world.add(g); addCol(x, z, .9); RACK = { g, items: {} };
  const mk = { garrun: () => { const m = mesh(new THREE.ConeGeometry(.12, .7, 8), M(0xd8cfb8), 0, 0, 0); m.rotation.z = Math.PI / 2; return m; }, rask: () => xbox(null, .6, .7, .12, 'rust', 0, 0, 0), kael: () => { const m = xcyl(null, .025, .025, 2.4, 'woodD', 0, 0, 0, 5); m.rotation.z = Math.PI / 2; return m; },
    vale: () => xcyl(null, .17, .19, .14, M(0x5a5e62), 0, 0, 0, 10), pale: () => mesh(new THREE.SphereGeometry(.16, 10, 8, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0xe8e2d8, side: THREE.DoubleSide }), 0, 0, 0), lantern: () => mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }), 0, 0, 0),
    stones: () => mesh(new THREE.PlaneGeometry(.6, .8), new THREE.MeshLambertMaterial({ color: 0x3ad0c0, side: THREE.DoubleSide }), 0, 0, 0), floombus: () => mesh(new THREE.PlaneGeometry(.8, .4), new THREE.MeshLambertMaterial({ color: 0xa070ff, side: THREE.DoubleSide }), 0, 0, 0) };
  Object.keys(TROPHIES).forEach((k, i) => { const m = mk[k](); m.position.set(-1.2 + (i % 4) * .8, i < 4 ? 1.85 : 1.15, 0); g.add(m); m.visible = false; RACK.items[k] = m; });
  // flags on the gate towers in Kestrel's colours
  for (const s of [-1, 1]) { const fx = s * (GATE_HALF * CAMP_R + 3), fz = CAMP_R + 1.5, f = new THREE.Group(); xcyl(f, .06, .08, 3, 'woodD', 0, 1.5, 0, 6); const cl = mesh(new THREE.PlaneGeometry(1.3, .8), new THREE.MeshLambertMaterial({ color: 0xf0a640, side: THREE.DoubleSide }), .66, 2.6, 0, f); f.position.set(fx, heightAt(fx, fz) + 3.6, fz); world.add(f); GATEFLAGS.push(cl); const ph = rnd() * 6; DECOR_ANIM.push(t => { cl.rotation.y = Math.sin(t * 1.9 + ph) * .35; }); }
}
function cosmeticsSync() { if (RACK) for (const k in RACK.items) RACK.items[k].visible = !!TROPHIES[k][1](); for (const c of GATEFLAGS) c.material.color.set(kColor()); facPaintBanners(); }

/* ---------- bosses ---------- */
// Vale: gas, a shield, reinforcements
function valeMech(e, dt, dp) {
  const pk = e.pk;
  if (!e.gasT) e.gasT = 6;
  e.gasT -= dt; if (e.gasT <= 0 && dp < 24) { e.gasT = rr(9, 12); const tx = P.x, tz = P.z, cloud = new THREE.Mesh(new THREE.SphereGeometry(3.5, 14, 10), new THREE.MeshLambertMaterial({ color: 0x9adf6a, transparent: true, opacity: .32, depthWrite: false })); cloud.position.set(tx, pk.y + 1.4, tz); pk.g.add(cloud); sfx('whoosh'); toast('Gas!', 1);
    let life = 7; BOSS_FIRES.push({ run(dt2) { life -= dt2; cloud.scale.setScalar(1 + (7 - life) * .05); if (Math.hypot(P.x - tx, P.z - tz) < 3.5 && UG.at === pk && !P.dead) { const fr = fogResist(); if (fr < .8) { P.hp -= 9 * dt2 * (1 - fr); if (rnd() < dt2 * 2) sfx('hurt', .4); } } if (life <= 0) { pk.g.remove(cloud); return false; } return true; } }); }
  if (!e.shieldDone && e.hp < e.maxhp * .5 && !e.shield) { e.shield = true; G.flags.valves = {}; say([['Captain Vale', 'Coolant to the core — shield the hall!']]); toast('He’s shielded — close the two coolant valves in the reactor hall', 3.6);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: .25, depthWrite: false })); sh.position.y = 1; e.g.add(sh); e.shieldMesh = sh; }
  if (e.shield && Object.keys(G.flags.valves || {}).length >= 2) { e.shield = false; e.shieldDone = true; if (e.shieldMesh) e.g.remove(e.shieldMesh); e.stun = 3; toast('The shield’s down — he’s exposed!', 2.4); sfx('boom', .6); }
}
// the Pale One: braziers, leaps, the dark
let PALE = null;
function paleMech(e, dt, dp) {
  const pk = e.pk, lit = HOLLOW.braziers.filter(b => b.on).length;
  e.douseT = (e.douseT ?? 18) - dt;
  if (e.douseT <= 0 && lit > 0) { e.douseT = rr(16, 22); const b = HOLLOW.braziers.find(b => b.on); b.on = false; b.fl.visible = false; b.l.intensity = 0; toast('He snuffs a brazier out — it goes darker', 2.2); sfx('whoosh'); }
  if (!e.leapT) e.leapT = 6; e.leapT -= dt;
  if (e.leap) { e.leap.t -= dt; if (e.leap.t > .6) { e.p.body.rotation.x = -.5; return true; } const k = 1 - Math.max(0, e.leap.t) / .6; e.x = lerp(e.leap.x0, e.leap.x1, k); e.z = lerp(e.leap.z0, e.leap.z1, k); e.g.position.set(e.x, pk.y + Math.sin(k * Math.PI) * 2.2, e.z);
    if (e.leap.t <= 0) { if (Math.hypot(P.x - e.x, P.z - e.z) < 2.2) hurtPlayer(26, e.x, e.z); e.leap = null; sfx('thud'); } return true; }
  if (e.leapT <= 0 && dp > 4 && dp < 14 && e.state === 'chase') { e.leapT = rr(7, 10); e.leap = { t: 1.2, x0: e.x, z0: e.z, x1: P.x, z1: P.z }; sfx('roar'); return true; }
  if (!e.called && e.hp < e.maxhp * .5) { e.called = 1; for (let i = 0; i < 3; i++) pkSpawn(pk, 'warrior', 45 + rr(-4, 4), 10 + rr(-2, 2), { hollow: true, fac: 'clan' }).state = 'chase'; say([['', 'The dark answers him — more of them come out of the walls.']]); }
  return false;
}
function buildPaleArena() {
  const pk = HOLLOW; pk.braziers = [];
  for (const [a, b] of [[40.5, 8.5], [50, 8.5], [40.5, 24], [50, 24]]) { const [x, z] = pw(pk, a, b), y = pk.y, g = new THREE.Group(); xcyl(g, .35, .25, 1, 'metal', 0, .5, 0, 8); const fl = new THREE.Mesh(new THREE.ConeGeometry(.35, .8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30 })); fl.position.y = 1.3; g.add(fl);
    g.position.set(x, y, z); pk.g.add(g); const l = xLamp(pk.g, x, y + 1.8, z, 0xff8a3a, 1.2, 12, false); const B = { x, z, fl, l, on: true, I: l.intensity }; pk.braziers.push(B); xSolid(pk, a - .4, b - .4, a + .4, b + .4);
    xUse({ x, y, z, r: 1.8, pocket: pk, label: () => B.on ? null : 'Light the brazier', act: () => startChan({ l: 'Lighting it', t: 1, fn: () => { B.on = true; fl.visible = true; l.intensity = B.I; sfx('swing'); } }) }); }
}
function paleSpawn() {
  if (PALE && !PALE.dead) return; if (G.flags.paleDead || !S2()) return;
  PALE = pkSpawn(HOLLOW, 'brute', 46, 16, { hollow: true, fac: 'clan', boss: 700, name: 'The Pale One' }); PALE.leader = 'hollow'; PALE.boss = 'pale'; PALE.paleBoss = 1; PALE.speed = 5.4; PALE.g.scale.multiplyScalar(1.15);
  PALE.g.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(0xf0ece4), .6); } });
}
// what you do to a boss, adjusted (on top of 2l's armour and staggers)
function bossDamageMod(e, n) {
  if (e.vale && e.shield) { if (!G.flags.shieldTip) { G.flags.shieldTip = 1; toast('Your rounds spark off the shield', 1.6); } return 0; }
  if (e.paleBoss) { const lit = HOLLOW.braziers.filter(b => b.on).length; return lit >= 2 ? n : n * .25; }
  return n;
}

{ const pe0 = pkEntUpd; pkEntUpd = function (e, dt) { if (e.dead || UG.at !== e.pk) return pe0(e, dt); const dp = Math.hypot(P.x - e.x, P.z - e.z);
  if (e === VALE) valeMech(e, dt, dp); if (e.paleBoss && paleMech(e, dt, dp)) { e.g.visible = true; return true; } return pe0(e, dt); }; }
{ const dm0 = aiDamageMod; aiDamageMod = function (e, n, byPlayer) { n = dm0(e, n, byPlayer); return byPlayer ? bossDamageMod(e, n) : n; }; }

/* ---------- prisoners: take them, trade them ---------- */
const nearBeaten = () => { for (const e of ents) if (e.type === 'clan' && !e.dead && !e.pk && !e.leader && e.mode !== 'raid' && e.mode !== 'ally' && (e.flee > 0 || e.stun > 0 || e.hp < e.maxhp * .2) && Math.hypot(e.x - P.x, e.z - P.z) < 2.4 && FAC[facOf(e)] && !FAC[facOf(e)].mute) return e; return null; };
function takePrisoner(e) { const f = facOf(e), C = G.flags.caps ||= {}; C[f] = (C[f] || 0) + 1; removeEnt(e); e.dead = true; toast(`You take the ${FAC[f].n} fighter prisoner · they’re held in Kestrel`, 3); sfx('pickup'); save(); }
function swapPrisoners(f) {
  const C = G.flags.caps ||= {}; if (!(C[f] > 0)) return;
  const theirs = PRISONERS.filter(p => p.holder === f && p.g.visible);
  if (theirs.length) { C[f]--; freePrisoner(theirs[0], true); toast('One of yours for one of theirs', 2.4); }
  else { C[f]--; facAdd(f, 10, 'you sent one of their people home'); }
  save();
}

/* ---------- restricted ground ---------- */
const RESTRICT = [];
function buildRestricted() {
  for (const [f, n, table, keys] of [['root', 'the Elder Grove', 'wild', ['herb_med', 'seed_corn']], ['pines', 'the Old Hunt', 'clan', ['hide', 'arrows']], ['ridge', 'the Runner Cache', 'clan', ['arrows', 'rope']], ['thorn', 'the War Shrine', 'clan', ['clan_mask']], ['iron', 'the Scrap Market', 'city', ['spare_parts', 'gun_parts']]]) {
    const s = capitalSpot(f, -.9, 0); if (!s) continue; const x = s.x, z = s.z, y = heightAt(x, z);
    for (const sd of [-1, 1]) { const g = new THREE.Group(); xcyl(g, .14, .18, 3.2, 'woodD', 0, 1.6, 0, 6); mesh(new THREE.SphereGeometry(.16, 8, 6), xm('bone'), 0, 3.3, 0, g); mesh(new THREE.PlaneGeometry(.5, .9), new THREE.MeshLambertMaterial({ color: FAC[f].c, side: THREE.DoubleSide }), .26, 2.6, 0, g); const px = x + Math.cos(s.a + Math.PI / 2) * sd * 3, pz = z + Math.sin(s.a + Math.PI / 2) * sd * 3; g.position.set(px, heightAt(px, pz), pz); world.add(g); addCol(px, pz, .3); }
    const cx = x - Math.cos(s.a) * 8, cz = z - Math.sin(s.a) * 8; cache(world, cx, cz, rr(0, 6), 'none', table, { id: 'x_rest_' + f, name: `${n[0].toUpperCase() + n.slice(1)} (friends of the ${FAC[f].n} only)`, rolls: 2, keys, refill: 5 });
    RESTRICT.push({ f, n, x: cx, z: cz, r: 14, warned: 0 });
  }
}
function restrictTick(dt) {
  for (const Z of RESTRICT) { const d = Math.hypot(P.x - Z.x, P.z - Z.z); if (d > Z.r || UG.at || P.dead) { Z.in = 0; continue; }
    const ok = !facHostile(Z.f) && facRep(Z.f) >= 20; if (ok) { if (!Z.in) toast(`You’re welcome in ${Z.n}`, 2); Z.in = 1; continue; }
    Z.in = (Z.in || 0) + dt; if (Z.in < dt * 1.5) toast(`This is ${Z.n} — the ${FAC[Z.f].n} don’t let outsiders in. Turn back.`, 3);
    if (Z.in > 5 && !Z.angered) { Z.angered = G.t; facAdd(Z.f, -5, 'you walked into their ground'); for (const e of ents) if (e.type === 'clan' && !e.dead && facOf(e) === Z.f && Math.hypot(e.x - Z.x, e.z - Z.z) < 120) { e.angry = G.day + 1; e.state = 'chase'; } }
    if (Z.angered && G.t - Z.angered > 120) Z.angered = 0; }
}

/* ---------- people get hurt ---------- */
let hurtT = 0;
function hurtTick(dt) {
  hurtT -= dt; if (hurtT > 0) return; hurtT = 1;
  const comp = compEnt();
  // raiders and anyone chasing you can wound a settler outside the Arc, or your companion
  for (const o of ents) {
    if (o.type !== 'npc' || o.dead || o.downed || !o.g.visible) continue;
    const isComp = o === comp, settler = o.settler || o.sid || o.name === 'extra';
    if (!isComp && !(settler && night.active && !inHull(o.x, o.z))) continue;
    for (const e of ents) { if (e.type !== 'clan' || e.dead || e.pk || !(e.mode === 'raid' || e.state === 'chase')) continue; const d = Math.hypot(e.x - o.x, e.z - o.z), gun = e.kind === 'gunner' || e.kind === 'soldier';
      if (d < 2.2 || gun && d < 26 && rnd() < .08) { o.whp = (o.whp ?? 100) - (gun ? rr(8, 14) : rr(12, 20)); if (d < 2.2) e.yaw = Math.atan2(o.x - e.x, o.z - e.z);
        if (o.whp <= 0) { o.whp = 100; o.downed = true; o.dieT = 75; o.siegeHurt = true; o.route = null; toast(`${o.shopName || 'Someone'} is down — get a bandage into them!`, 3.4); } break; } }
  }
}
// a downed companion away from Kestrel: fogNPC doesn't watch them, so we do
function compDownTick() {}
{ const cu0 = compUpd; compUpd = function (e, dt) { if (!e.downed) return cu0(e, dt); e.g.visible = true; poseWalk(e.p, 0, 0, 0); e.p.body.rotation.x = -1.2; e.g.position.set(e.x, heightAt(e.x, e.z) - .2, e.z);
  e.dieT -= dt; if (e.dieT <= 0) { e.dead = true; removeEnt(e); const C = compS(); if (C) compSet(null); toast(`${e.shopName || 'Your companion'} didn’t make it.`, 4); sfx('no'); } return true; }; }

/* ---------- the settlement: life round the fire, the gatehouse ---------- */
{ const sn0 = setNPC; setNPC = function (e, dt) { if (sn0(e, dt)) return true; if (!e.sid || e.comp || e.downed) return false; const R = setS().ros.find(x => x.id === e.sid); return !!(R && setLife(e, R, dt)); }; }
let lifeT = 0;
function setLife(e, R, dt) {
  // evenings: some sit round the fire
  const eve = G.tod > .69 && G.tod < .82 && !night.active && rust.state === 'none' && !e.downed && !e.comp && !e.away && R.job !== 'guard';
  if (eve && (parseInt(R.id.slice(2)) % 3 !== 0)) {
    if (!e.seat) { const k = parseInt(R.id.slice(2)) % 8, a = k / 8 * 6.283; e.seat = { x: SPOTS.fire.x + Math.cos(a) * 2.3, z: SPOTS.fire.z + Math.sin(a) * 2.3, a }; }
    const d = Math.hypot(e.seat.x - e.x, e.seat.z - e.z);
    if (d > .4) { e.route = null; const v = moveEnt(e, e.seat.x, e.seat.z, 1.6, dt); e.ph += dt * strideRate(v); poseWalk(e.p, e.ph, Math.min(1, v / 2.5), v); e.y = heightAt(e.x, e.z); e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; return true; }
    e.yaw = Math.atan2(SPOTS.fire.x - e.x, SPOTS.fire.z - e.z); poseWalk(e.p, 0, 0, 0); e.g.position.set(e.x, heightAt(e.x, e.z) - .42, e.z); e.g.rotation.y = e.yaw; e.p.body.rotation.x = .18;
    if ((e.talkT = (e.talkT ?? rr(4, 20)) - dt) <= 0) { e.talkT = rr(14, 30); bubble(e, pick(['Pass the salt.', 'Remember the Arc’s garden deck?', 'Ha!', 'I miss real coffee.', 'Did you see the stars tonight?', 'My mother used to sing that.', 'Quiet tonight.', 'Who’s on watch?'])); }
    return true;
  }
  if (e.seat && !eve) e.seat = null;
  return false;
}
// speech bubbles over people's heads
const BUBBLES = [];
function bubble(e, text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(14,12,10,.78)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 46, 10) : g.rect(4, 4, 248, 46); g.fill(); g.fillStyle = '#efe9dc'; g.font = '600 22px sans-serif'; g.textAlign = 'center'; g.fillText(text.slice(0, 22), 128, 35);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(2, .5, 1); sp.position.set(0, 2.3, 0); e.g.add(sp); BUBBLES.push({ sp, e, t: 4 });
}
function bubbleTick(dt) { for (const B of [...BUBBLES]) { B.t -= dt; if (B.t <= 0 || B.e.dead) { B.e.g.remove(B.sp); B.sp.material.map.dispose(); BUBBLES.splice(BUBBLES.indexOf(B), 1); } } }
// two settlers who pass each other sometimes stop to talk
function chatPairs() {
  const S = setS(); const live = S.ros.map(R => SROS[R.id]).filter(e => e && !e.dead && e.g.visible && !e.away && !e.seat && !e.comp && !e.downed && Math.hypot(e.x - P.x, e.z - P.z) < 50);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) { const a = live[i], b = live[j]; if (Math.hypot(a.x - b.x, a.z - b.z) < 3 && rnd() < .3) { a.wait = b.wait = 6; a.route = b.route = null; a.yaw = Math.atan2(b.x - a.x, b.z - a.z); b.yaw = a.yaw + Math.PI; bubble(a, pick(['Morning.', 'Heard about the raid?', 'Got a minute?', 'You look tired.', 'Need a hand with that?'])); setTimeout(() => !b.dead && bubble(b, pick(['Not now.', 'Always.', 'Ha — sure.', 'Don’t ask.', 'Later, by the fire.'])), 1600); return; } }
}
// the gatehouse: a palisade gate on the south road
PROJECTS.gatehouse = { n: 'Outer gatehouse', d: 'A palisade gate on the south road: raids start thinner; +morale', cost: { log: 24, stone: 10, nails: 20 }, w: 4 }; PROJ_IDS.push('gatehouse');
let GATEHOUSE = null;
{ const bp0 = buildProject; buildProject = function (id, stage) { if (id !== 'gatehouse') return bp0(id, stage); if (GATEHOUSE) { world.remove(GATEHOUSE); GATEHOUSE = null; } if (!stage) return;
  const z0 = CAMP_R + 34, g = new THREE.Group(); g.position.set(0, heightAt(0, z0), z0); world.add(g); GATEHOUSE = g;
  for (const s of [-1, 1]) { const t = new THREE.Group(); t.add(mesh(lattice(3, stage === 2 ? 6.5 : 3, 0x5a4430, 2.4), VCOL)); if (stage === 2) { xbox(t, 3.4, .2, 3.4, 'woodD', 0, 6.5, 0); for (const k of [[0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]]) xbox(t, k[0] ? .1 : 3.4, 1, k[0] ? 3.4 : .1, 'wood', k[0], 7, k[1]); } t.position.set(s * 5.5, 0, 0); g.add(t); addCol(s * 5.5, z0, 1.8);
    if (stage === 2) for (let k = 0; k < 9; k++) { const x = s * (8 + k * 1.6), y = heightAt(x, z0) - g.position.y; xcyl(g, .28, .3, 4.2, 'woodD', x, y + 2, 0, 7); addCol(x, z0, .45); } }
  if (stage === 2) { xbox(g, 7.6, .5, .5, 'woodD', 0, 6, 0); const fl = mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshLambertMaterial({ color: 0xf0a640, side: THREE.DoubleSide }), 0, 7.2, 0, g); GATEFLAGS.push(fl); fl.material.color.set(kColor()); } }; }

/* ---------- traders get better as the story goes on ---------- */
function storyStock() {
  const D = (G.flags.ms || {}).done || {}, add = (k, ids) => { const S = SHOP_STOCK[k]; if (!S || !S.pool) return; for (const id of ids) if ((ITEMS[id] || GEAR_DEFS[id]) && !S.pool.includes(id)) S.pool.push(id); };
  if (D.below) { add('guns', ['assault', 'ammo_556', 'frag']); add('trade', ['tac_armor', 'helmet']); }
  if (D.fever) add('med', ['antibiotic', 'rust_med', 'medkit']);
  if (D.signal) add('trade', ['radio', 'battery', 'circuit']);
  if (G.flags.s2) { add('guns', ['grey_rifle', 'ammo_762']); add('med', ['stim', 'trauma_kit']); add('wear', ['grey_mask', 'gas_mask']); }
  if (G.flags.s2done) { add('trade', ['nvg', 'trooper_armor']); add('salvage', ['solar_cell', 'sensor']); }
}

/* ---------- Season 2 and late events ---------- */
EVENTS.shipment = { cd: 1300, ok: () => S2() && !G.flags.s2done && !EV.convoy, go() { if (!spawnTransport(false)) return false; const C = EV.convoy; C.prisoners = 0; C.ship = 1; if (C.mark) C.mark.n = 'Greyhold shipment'; toast('A Greyhold equipment shipment is on the north road — Mountain gear, if you can take it', 4); return true; } };
EVENTS.quarrel = { cd: 1500, ok: () => FAC_IDS.filter(f => !FAC[f].mute && !facHostile(f) && facRep(f) >= 20).length >= 2, go() {
  const fr = FAC_IDS.filter(f => !FAC[f].mute && !facHostile(f) && facRep(f) >= 20); const a = pick(fr), b = pick(fr.filter(x => x !== a)); const s = evSpotAhead(30, 45); if (!s) return false;
  const G2 = []; for (const [f, sd] of [[a, -1], [b, 1]]) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 2; i++) { const e = spawnClan(K[i], s.x + sd * 4, s.z + rr(-2, 2), 'guard', facFac(f)); e.tribe = f; e.evTemp = 1; e.yaw = sd > 0 ? -Math.PI / 2 : Math.PI / 2; G2.push(e); } }
  EV.quarrel = { a, b, x: s.x, z: s.z, ents: G2, end: G.t + 240 }; toast(`The ${FAC[a].n} and the ${FAC[b].n} are squaring up over a kill on the road — step in?`, 4.2); return true; } };
EVENTS.hotzone = { cd: 1400, ok: () => G.day > 20, go() { const s = evSpotAhead(70, 120, rr(-1, 1)); if (!s) return false; const R = { x: s.x, z: s.z, r: 14, k: 7, until: G.t + 600 }; XRAD.push(R);
  const g = new THREE.Group(); for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(rr(.08, .25), 6, 4), xm('glowG'), s.x + rr(-10, 10), heightAt(s.x, s.z) + .1, s.z + rr(-10, 10), g); world.add(g); R.g = g;
  cache(world, s.x, s.z, rr(0, 6), 'none', 'op', { id: 'ev_hot_' + Math.floor(G.t), name: 'A hot salvage crate', rolls: 2, refill: 0 }); evMark(s.x, s.z, 'Hot zone', R.until); toast('A geiger crackle on the wind — a hot zone ahead, and something worth having in the middle', 4); return true; } };
function quarrelChoice(side) {
  const Q = EV.quarrel; if (!Q) return; if (choiceEl) choiceEl.style.display = 'none'; if (!isTouch) canvas.requestPointerLock?.();
  if (side === 'a' || side === 'b') { const w = side === 'a' ? Q.a : Q.b, l = side === 'a' ? Q.b : Q.a; facAdd(w, 8, 'you took their side'); facAdd(l, -8, 'you took the other side'); }
  else { if (INV.scrap < 20) { sfx('no'); return; } INV.scrap -= 20; facAdd(Q.a, 3); facAdd(Q.b, 3); toast('You split the kill and pay for the difference. Everyone walks away.', 3); }
  Q.done = 1; Q.end = G.t + 10; save();
}
function quarrelPanel() {
  const Q = EV.quarrel; if (!Q || Q.done) return; if (document.pointerLockElement) document.exitPointerLock();
  if (!choiceEl) { choiceEl = document.createElement('div'); choiceEl.id = 'xchoice'; choiceEl.dataset.q = 1; choiceEl.style.cssText = 'position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.72)'; document.body.appendChild(choiceEl); choiceEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.ch) makeChoice(b.dataset.ch); if (b && b.dataset.qc) quarrelChoice(b.dataset.qc); }); }
  else if (!choiceEl.dataset.q) { choiceEl.dataset.q = 1; choiceEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.qc) quarrelChoice(b.dataset.qc); }); }
  const bt = (k, t) => `<button data-qc="${k}" style="text-align:left;padding:10px;background:#1e1a14;color:#efe9dc;border:1px solid #fff3;border-radius:4px;font:15px Georgia,serif;cursor:pointer">${t}</button>`;
  choiceEl.innerHTML = `<div style="width:min(520px,92vw);background:#14110e;border:1px solid #f0a64066;border-radius:6px;padding:22px 24px;color:#efe9dc;font:16px/1.5 Georgia,serif"><h2 style="font:700 24px 'Barlow Condensed',sans-serif;margin:0 0 8px">A kill on the road</h2><p>Both say they brought the elk down. Both have their hands on their weapons.</p><div style="display:grid;gap:8px">${bt('a', `Side with the ${FAC[Q.a].n}`)}${bt('b', `Side with the ${FAC[Q.b].n}`)}${bt('c', 'Split it and pay the difference (20 scrap)')}</div></div>`;
  choiceEl.style.display = 'grid';
}

/* ---------- other ways through Season 1 ---------- */
{ const st = (id, i) => MISSIONS[MSI[id]] && MISSIONS[MSI[id]].steps[i];
  const w1 = st('water', 1); if (w1) { const d0 = w1.done; w1.done = () => d0() || PLACED.some(p => p.k === 'water_filter' && campD(p.x, p.z) < CAMP_R + 10) && (G.flags.wellFixed ||= G.day); w1.txt = 'Bring the valve to Juno at the clinic — or build a water filter in Kestrel'; const w0 = st('water', 0); const d1 = w0.done; w0.done = () => d1() || PLACED.some(p => p.k === 'water_filter' && campD(p.x, p.z) < CAMP_R + 10); }
  const h1 = st('hostile', 1); if (h1) { h1.txt = 'Take the Thornkin war-map from the outpost — or buy a copy at Farlight (40 scrap)'; h1.use = { at: () => FAC.arc.cap(), r: 30, label: 'Buy a copy of the Thornkin war-map (40 scrap)', need: () => INV.scrap >= 40 && !cnt('war_map') ? true : null, act: () => { INV.scrap -= 40; give('war_map', 1); } }; }
  const s1 = st('signal', 1); if (s1) { s1.txt = 'Wire a transmitter into the Arc’s radio desk (KVRN’s, or any you’ve found)'; s1.use = { at: () => ARC_RADIO, r: 3.2, label: 'Wire the transmitter into the desk', need: () => cnt('kvrn_tx') ? 'kvrn_tx' : has('transmitter') ? true : null, act: () => { if (cnt('kvrn_tx')) take('kvrn_tx', 1); G.flags.longRadio = G.day; } };
    const s0 = st('signal', 0); const d0 = s0.done; s0.done = () => d0() || has('transmitter'); }
  const f1 = st('fever', 1); if (f1) { f1.use.need = () => cnt('rust_med') >= 1 ? 'rust_med' : cnt('antibiotic') >= 2 ? 'antibiotic' : cnt('herb_med') >= 5 ? 'herb_med' : null; const a0 = f1.use.act; f1.use.act = () => { if (!cnt('rust_med') && cnt('antibiotic') < 2 && cnt('herb_med') >= 5) { take('herb_med', 5); setS().fever = 0; } else a0(); };
    const f0 = st('fever', 0); f0.txt = 'Find medicine — 2 antibiotics or 1 Rust medicine (Brightwater), or 5 herbal medicine (the Rootkin)'; const d0 = f0.done; f0.done = () => d0() || cnt('herb_med') >= 5; }
  const p0 = st('plans', 0); if (p0) { p0.txt = 'Take Garrun’s war plans from Ashmere’s longhouse — or take a Thornkin prisoner and question them'; const d0 = p0.done; p0.done = () => d0() || ((G.flags.caps || {}).thorn > 0); }
  const p1 = st('plans', 1); if (p1) { const u = p1.use; p1.use = { ...u, need: () => cnt('war_plans') ? 'war_plans' : (G.flags.caps || {}).thorn > 0 ? true : null, label: 'Tell Kade what you’ve learned', act: () => { if (cnt('war_plans')) take('war_plans', 1); G.flags.knowCoalition = G.day; } }; }
}

{ const fh0 = factionsHTML; factionsHTML = function () { const C = G.flags.caps || {}, held = Object.keys(C).filter(f => C[f] > 0 && FAC[f]); if (!held.length) return fh0(); const at = nearParley();
  return fh0() + `<h4>Prisoners you hold</h4><div class="jn">${held.map(f => `<div style="padding:6px 8px;border:1px solid #fff2;border-radius:3px;background:#0002"><b>${FAC[f].n}</b> × ${C[f]} <button data-fa="swap" data-ff="${f}"${at && at.f === f ? '' : ' class="dis"'}>${PRISONERS.some(p => p.holder === f && p.g.visible) ? 'Trade one for one of ours' : 'Send one home (+rep)'}</button>${at && at.f === f ? '' : ' <small style="opacity:.7">at their white flag</small>'}</div>`).join('')}</div>`; }; }
{ const fa0 = facAction; facAction = function (d) { if (d.fa === 'swap') { const at = nearParley(); if (at && at.f === d.ff) swapPrisoners(d.ff); else sfx('no'); return; } return fa0(d); }; }
{ const fd0 = facDied; facDied = function (e, byPlayer) { fd0(e, byPlayer); if (byPlayer && e.boss && BOSS_TROPHY[e.boss] !== undefined && !G.flags['trophy_' + e.boss]) { G.flags['trophy_' + e.boss] = G.day; const bp = BOSS_TROPHY[e.boss]; if (bp) give(bp, 1); toast(`${e.name}’s trophy goes on Kestrel’s rack`, 3); } }; }
const BOSS_TROPHY = { garrun: null, rask: 'bp_turret', kael: null };

/* ---------- interactions ---------- */
const FININTERACT = [
  { id: 'capture', at: () => nearBeaten(), r: 2.4, label: () => `Take the ${FAC[facOf(nearBeaten())].n} fighter prisoner`, act: () => { const e = nearBeaten(); startChan({ l: 'Tying their hands', t: 1.6, fn: () => takePrisoner(e) }); } },
  { id: 'quarrel', at: () => EV.quarrel && !EV.quarrel.done && Math.hypot(P.x - EV.quarrel.x, P.z - EV.quarrel.z) < 7 ? EV.quarrel : null, r: 7, label: () => 'Step in between them', act: () => quarrelPanel() },
  { id: 'valve', at: () => { if (!MTN || UG.at !== MTN || !VALE || VALE.dead || !VALE.shield) return null; for (const [i, a, b] of [[0, -38, 44], [1, -21, 58]]) { if ((G.flags.valves || {})[i]) continue; const [x, z] = pw(MTN, a, b); if (Math.hypot(P.x - x, P.z - z) < 2.2) return { x, z, i }; } return null; }, r: 2.2, label: () => 'Close the coolant valve', act: () => { const V = FININTERACT.find(o => o.id === 'valve').at(); startChan({ l: 'Wrenching it shut', t: 1.6, fn: () => { (G.flags.valves ||= {})[V.i] = 1; sfx('metal'); toast(`Valve ${Object.keys(G.flags.valves).length} of 2 closed`, 2); } }); } },
];

/* ---------- setup, each frame ---------- */
function buildFinish() {
  const s0 = seed; seed = 1212121;
  for (const C of CACHES) if (BP_AT[C.id] && !C.keys.includes(BP_AT[C.id])) C.keys.push(BP_AT[C.id]);
  buildRack(); buildRestricted(); buildPaleArena();
  // the valves in the reactor hall
  for (const [a, b] of [[-38, 44], [-21, 58]]) { const [x, z] = pw(MTN, a, b), g = new THREE.Group(); xcyl(g, .12, .12, 1.2, 'metal', 0, .6, 0, 8); const wh = mesh(new THREE.TorusGeometry(.3, .05, 6, 14), M(0xd84a2a), 0, 1.25, 0, g); wh.rotation.x = Math.PI / 2; g.position.set(x, MTN.y, z); MTN.g.add(g); }
  window.__FIN = { ev: s => eval(s), BLUEPRINTS, bpLearn, craftN, STUP, cosmeticsSync, paleSpawn, takePrisoner, swapPrisoners, quarrelPanel, quarrelChoice, RESTRICT, get PALE() { return PALE; } };
  seed = s0;
}
function finishRestore() { cosmeticsSync(); storyStock(); PALE = null; if (HOLLOW && HOLLOW.braziers) for (const B of HOLLOW.braziers) { B.on = true; B.fl.visible = true; B.l.intensity = B.I; } }
let finT = 0, chatT2 = 20;
function updFinish(dt) {
  bubbleTick(dt); compDownTick(dt); hurtTick(dt);
  if (EV.quarrel && G.t > EV.quarrel.end) { for (const e of EV.quarrel.ents) if (!e.dead) removeEnt(e); EV.quarrel = null; }
  for (const R of XRAD) if (R.until && G.t > R.until) { if (R.g) world.remove(R.g); XRAD.splice(XRAD.indexOf(R), 1); break; }
  if (PALE && PALE.dead && !G.flags.paleDead) { G.flags.paleDead = G.day; give('bp_hollow', 1); card('THE PALE ONE IS DEAD', 'The Drift goes quiet. The Hollowed raid less without him.', 4.4); facS('hollow').lead = G.day + 9999; save(); }
  if (UG.at === HOLLOW && S2() && !G.flags.paleDead) { const [cx, cz] = pw(HOLLOW, 45, 18); if (Math.hypot(P.x - cx, P.z - cz) < 16) paleSpawn(); }
  finT -= dt; if (finT > 0) return; finT = 1;
  bpLearn(); restrictTick(1); storyStock(); cosmeticsSync();
  if (inKestrel() && (chatT2 -= 1) <= 0) { chatT2 = rr(25, 45); chatPairs(); }
}

/* ---------- Travel (testing): teleport to every site, bunker and underground place ----------
   Shows as a "Travel" tab in the bag once the secret unlock is on (tap the health bar 7 times fast), or with ?travel in the URL. */
const TRAVEL_URL = /[?&]travel\b/.test(location.search);
const travelOn = () => TRAVEL_URL || !!G.flags.dev;
const SITE_NAMES = { millbrook: 'Millbrook', kvrn: 'KVRN Relay Station', cave: 'Whisper Cave', summit: 'Kestrel Ridge (summit)', tunA: 'Coldwater Line — west portal', tunB: 'Coldwater Line — east portal', hesper: 'Fort Hesper', bright: 'Brightwater Annex', longfall: 'The Long Fall', route9: 'Route 9', ember: 'Ember Rest', blackdoor: 'The Black Door' };
const PK_NAMES = { cellar: 'Millbrook cellar', cave: 'Whisper Cave', tunnel: 'Coldwater Line tunnel', hesper: 'Fort Hesper bunker', lab: 'Brightwater lab', survey: 'Survey Station', site9: 'Site Nine', mtn: 'The Mountain (Greyhold)', hollow: 'The Drift (Hollowed tunnels)' };
let TRAVEL = null;
function travelList() {
  if (TRAVEL) return TRAVEL; const L = [], near = (x, z, r) => { const d = Math.hypot(x, z) || 1; return { x: x - x / d * r, z: z - z / d * r }; }, add = (g, n, o, r = 6) => { if (!o || !isFinite(o.x)) return; const s = near(o.x, o.z, r); L.push({ g, n, go: () => xGoNow(null, { x: s.x, z: s.z, yaw: Math.atan2(o.x - s.x, o.z - s.z) }) }); };
  add('Home', 'Kestrel (camp gate)', { x: 0, z: CAMP_R + 4 }, 0);
  for (const id in XSITES || {}) { const S = XSITES[id]; add('Places', SITE_NAMES[id] || S.name, S, (S.r || 10) + 4); }
  for (const id in POCKETS) { const pk = POCKETS[id]; if (pk.in) L.push({ g: 'Underground', n: PK_NAMES[id] || id, go: () => xGoNow(pk, pk.in) }); if (pk.out) L.push({ g: 'Underground entrances', n: (PK_NAMES[id] || id) + ' — entrance', go: () => xGoNow(null, pk.out) }); }
  for (const f of ['thorn', 'pines', 'ridge', 'root', 'iron', 'grey', 'arc']) { const C = FAC[f].cap(); add('Faction homes', `${FAC[f].n} — ${f === 'arc' ? 'Farlight' : f === 'grey' ? 'Greyhold Station' : 'home'}`, C, (C && C.R || FAC[f].cap_r * .6) + 6); }
  for (const Z of RESTRICT) add('Faction homes', `${FAC[Z.f].n} — ${Z.n} (restricted)`, Z, 3);
  for (const O of OUTPOSTS) add('Outposts', O.n + ' (' + O.id + ')', O, 8);
  add('Season 1 story', 'Thornkin war camp', WARCAMP, 10);
  add('Season 2', 'Hollowed nest (Drift entrance hill)', HOLLOW_NEST, 22); add('Season 2', 'The Spoke', SPOKE, 8); add('Season 2', 'The fog tower', FOGTOWER, 8);
  GCHECK.forEach((c, i) => add('Season 2', 'Greyhold checkpoint ' + (i + 1), c, 6));
  XCAMPS.forEach((c, i) => add('Camps & stashes', 'Old camp ' + (i + 1), c, 4)); XSTASH.forEach((c, i) => add('Camps & stashes', 'Hidden stash ' + (i + 1), c, 3));
  if (XSURVEY && XSURVEY.x) add('Places', 'Survey mast', XSURVEY, 6);
  return TRAVEL = L;
}
function travelHTML() {
  const L = travelList(), gs = [...new Set(L.map(t => t.g))];
  const raids = G.flags.dev ? `<h4>Raids</h4><div style="display:flex;flex-wrap:wrap;gap:6px"><button data-dr="raid">Start a raid now</button><button data-dr="final">Start the Night 100 raid</button></div><p class="dim"><small>${night.active ? 'A raid is on right now.' : 'Takes you to the Kestrel gate if you’re far out, then the horns go.'}</small></p>` : '';
  return raids + `<p class="dim">Testing shortcut · tap a place to go there instantly.</p>` + gs.map(g => `<h4>${g}</h4><div style="display:flex;flex-wrap:wrap;gap:6px">${L.map((t, i) => [t, i]).filter(([t]) => t.g === g).map(([t, i]) => `<button data-tp="${i}">${t.n}</button>`).join('')}</div>`).join('');
}
function travelGo(i) { const t = travelList()[+i]; if (!t) return; toggleInv(false); t.go(); P.hp = Math.max(P.hp, 1); toast('→ ' + t.n, 2); }
