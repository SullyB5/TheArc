
/* ================= Season 2: "The Mountain" — missions, the choice, the endings (Nov 11, Part 11 of the overhaul) =================
   Fourteen more main missions follow Aftermath (they're appended to MISSIONS in 2i-story.js, so the same runner drives
   them): the Spoke, rebuilding, the trail of the missing, the strange machines, finding the Mountain, what they do in it,
   the Drift, the red wind (a Greyhold fog tower to wreck), the coalition (two allies), cutting Greyhold's supplies, the
   prisoner transport, the red card, the assault (allies hit the front gate while you go in by any door; free the people
   on the beds; Captain Vale in the reactor hall) — and the choice at the reactor:
     · VENT THE FOG into the Mountain: Greyhold is gone, everyone inside with it.
     · SPARE THEM: shut the reactor down, take your people, leave them a truce they have to keep.
     · GIVE THEM THE CURE: Dr. Arden's serum, made from blackvein instead of people — Greyhold can live outside.
   The ending card and epilogue follow the choice, how many of the missing came home, who stood with you, and what
   Kestrel has become. Afterwards the world keeps going (G.flags.s2done): free play, side jobs, raids from whoever's left.
   Season 2 also adds events: Greyhold prisoner transports, equipment shipments, and Hollowed packs at dusk. */

/* ---------- the fog tower ---------- */
let FOGTOWER = null;
function buildFogTower() {
  const s = xFind({ tx: -620, tz: -920, r: 10, sl: .35 }, [], xAvoid()); FOGTOWER = { x: s.x, z: s.z }; const y = heightAt(s.x, s.z), g = new THREE.Group(); g.visible = false; world.add(g); g.userData.dyn = 1; FOGTOWER.g = g;
  g.add(mesh(lattice(3, 14, 0x6a6a64, 3), VCOL)); g.children[0].position.set(s.x, y, s.z);
  mesh(new THREE.CylinderGeometry(1.6, 1.2, 3, 12), new THREE.MeshStandardMaterial({ color: 0x7a3a2a, metalness: .5, roughness: .5 }), s.x, y + 15.5, s.z, g);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; mesh(new THREE.CylinderGeometry(.2, .3, 1.4, 6), M(0x3a3a3a), s.x + Math.cos(a) * 1.4, y + 16.5, s.z + Math.sin(a) * 1.4, g); }
  FOGTOWER.cloud = []; for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(3, 7), 1), new THREE.MeshLambertMaterial({ color: 0x8a2a1a, transparent: true, opacity: .28, depthWrite: false })); m.position.set(s.x + rr(-30, 30), y + rr(2, 12), s.z + rr(-30, 30)); g.add(m); FOGTOWER.cloud.push(m); }
  addCol(s.x, s.z, 2.4);
}
const fogTowerOn = () => FOGTOWER && S2() && !G.flags.fogTowerDown && !G.flags.s2done;

/* ---------- the prisoner transport (mission + event) ---------- */
function spawnTransport(forMission) {
  const B = BASES.find(b => b.id === 'greystation'); if (!B) return false;
  const a = Math.atan2(-B.z, -B.x), A = { x: B.x + Math.cos(a) * 140 + 60, z: B.z + Math.sin(a) * 140 }, Bp = { x: B.x + Math.cos(a) * 70, z: B.z + Math.sin(a) * 70 };
  if (EV.convoy) return false;
  const cart = new THREE.Group(); mesh(new THREE.BoxGeometry(2.2, 2, 4.2), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x5a5e62 }), 0, 1.4, 0, cart); for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(.05, 1.2, .05), M(0x1a1a1a), -1.12, 1.6, -1.5 + k * .6, cart);
  for (const [x, z] of [[-1.1, 1.4], [1.1, 1.4], [-1.1, -1.4], [1.1, -1.4]]) { const w = mesh(new THREE.CylinderGeometry(.5, .5, .2, 10), M(0x1a1a1a), x, .5, z, cart); w.rotation.z = Math.PI / 2; }
  world.add(cart); const C = { f: 'grey', A, B: Bp, cart, t: 0, L: Math.hypot(Bp.x - A.x, Bp.z - A.z), guards: [], esc: 0, looted: false, end: G.t + 900, prisoners: forMission ? 3 : 2, mission: forMission }; EV.convoy = C;
  for (let i = 0; i < 5; i++) { const g = spawnClan('soldier', A.x + rr(-3, 3), A.z + rr(-3, 3), 'guard', 'grey'); g.tribe = 'grey'; g.convoy = 1; C.guards.push(g); }
  C.mark = evMark((A.x + Bp.x) / 2, (A.z + Bp.z) / 2, 'Prisoner transport', C.end);
  return true;
}
EVENTS.transport = { cd: 1500, ok: () => S2() && !G.flags.s2done, go() { if (!spawnTransport(false)) return false; say([['Radio', 'Farlight: Greyhold transport on the north road, Kestrel — and it’s carrying people.']]); return true; } };
EVENTS.hollowpack = { cd: 800, ok: () => S2() && G.tod > .66 && !G.flags.s2done, go() { const s = evSpotAhead(40, 60, rr(-1, 1)); if (!s) return false; for (let i = 0; i < 4; i++) { const e = spawnClan(i ? 'warrior' : 'brute', s.x + rr(-6, 6), s.z + rr(-6, 6), 'guard', 'clan'); e.tribe = 'hollow'; e.state = 'chase'; e.speed *= 1.2; e.evTemp = 1; } toast('Shrieks in the trees — the Hollowed!', 3); sfx('roar'); return true; } };
// freeing the people in a transport cart
const nearTransport = () => { const C = EV.convoy; return C && C.prisoners && !C.freed && C.guards.every(g => g.dead || !ents.includes(g)) && Math.hypot(C.cart.position.x - P.x, C.cart.position.z - P.z) < 3.8 ? C : null; };

/* ---------- the assault, Vale, the choice ---------- */
const AS = () => G.flags.assault ||= { on: 0, freed: 0, vale: 0, choice: null };
let VALE = null;
function assaultStart() {
  const A = AS(); if (A.on) return; A.on = G.day;
  // allies hit the front of Greyhold Station
  const B = BASES.find(b => b.id === 'greystation'); const al = FAC_IDS.filter(f => facAllied(f));
  if (B) for (const f of al) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 6; i++) { const a = Math.atan2(-B.z, -B.x), e = spawnClan(K[i % K.length], B.x + Math.cos(a) * 80 + rr(-10, 10), B.z + Math.sin(a) * 80 + rr(-10, 10), 'ally', facFac(f)); e.tribe = f; e.state = 'ally'; e.hold = { x: B.x + rr(-20, 20), z: B.z + rr(-20, 20) }; } }
  if (B) for (let i = 0; i < 8; i++) { const e = spawnClan('soldier', B.x + rr(-25, 25), B.z + rr(-25, 25), 'guard', 'grey'); e.tribe = 'grey'; e.state = 'chase'; }
  card('THE ASSAULT', al.length ? `The ${al.map(f => FAC[f].n).join(' and the ')} hit the front gate. Get inside.` : 'Nobody came. It’s you. Get inside.', 4.6);
}
function bedFree(i) {
  const A = AS(), S = setS(), miss = (S.missing || []).filter(m => !m.home); const bed = MTN.beds[i]; if (!bed || bed.freed) return; bed.freed = 1; bed.g.visible = false; ((G.flags.mtn ||= {}).beds ||= {})[i] = 1;
  const m = miss[0]; if (m) { m.home = G.day; (S.pending ||= []).push({ n: m.n, trait: 'steady' }); toast(`${m.n} — alive. They’ll make it home.`, 3.4); }
  else { G.flags.rescued = (G.flags.rescued || 0) + 1; toast('Someone you don’t know. Alive. They’ll follow you out.', 3); }
  A.freed++; save();
}
function valeSpawn() {
  if (VALE && !VALE.dead && ents.includes(VALE)) return; if (AS().vale) return;
  VALE = pkSpawn(MTN, 'soldier', -30, 45, { boss: 900, name: 'Captain Oren Vale' }); VALE.state = 'chase'; VALE.valeAdds = 0;
  for (let i = 0; i < 3; i++) pkSpawn(MTN, 'soldier', -36 + i * 4, 57).state = 'chase';
}
function valeTick() {
  if (!VALE || VALE.dead) return;
  if (VALE.hp < VALE.maxhp * .66 && VALE.valeAdds === 0 || VALE.hp < VALE.maxhp * .33 && VALE.valeAdds === 1) { VALE.valeAdds++; say([['Captain Vale', VALE.valeAdds === 1 ? 'You think you’re saving them? You’re killing my children!' : 'Seal the hall! Everyone to me!']]); for (let i = 0; i < 3; i++) pkSpawn(MTN, 'soldier', -38 + i * 6, 58).state = 'chase'; }
}
// the choice panel
let choiceEl = null;
function openChoice() {
  if (AS().choice) return; if (document.pointerLockElement) document.exitPointerLock();
  if (!choiceEl) { choiceEl = document.createElement('div'); choiceEl.id = 'xchoice'; choiceEl.style.cssText = 'position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.72)'; document.body.appendChild(choiceEl);
    choiceEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.ch) makeChoice(b.dataset.ch); }); }
  const cure = cnt('blackvein') > 0;
  choiceEl.innerHTML = `<div style="width:min(620px,92vw);background:#14110e;border:1px solid #f0a64066;border-radius:6px;padding:24px 26px;color:#efe9dc;font:16px/1.5 Georgia,serif">
    <div style="font:700 13px 'Barlow Condensed',sans-serif;letter-spacing:.16em;opacity:.7">THE REACTOR HALL</div><h2 style="font:700 26px 'Barlow Condensed',sans-serif;margin:4px 0 10px">Vale is down. The Mountain is yours to decide.</h2>
    <p>The fog vents run straight up through every level. The serum notes are on Arden’s desk. Two hundred people live down here — soldiers, and children.</p>
    <div style="display:grid;gap:10px;margin-top:14px">
    <button data-ch="vent" style="text-align:left;padding:12px;background:#3a1410;color:#efe9dc;border:1px solid #e0573d88;border-radius:4px;font:15px Georgia,serif;cursor:pointer"><b>Vent the fog into the Mountain.</b><br><small>Greyhold will never take anyone again. Nor will anyone in it ever leave.</small></button>
    <button data-ch="spare" style="text-align:left;padding:12px;background:#1e1a14;color:#efe9dc;border:1px solid #fff3;border-radius:4px;font:15px Georgia,serif;cursor:pointer"><b>Spare them.</b><br><small>Shut the reactor down, take your people and go. Leave them a truce — and a warning.</small></button>
    <button data-ch="cure" ${cure ? '' : 'disabled'} style="text-align:left;padding:12px;background:#10241e;color:#efe9dc;border:1px solid #7fc4b888;border-radius:4px;font:15px Georgia,serif;cursor:${cure ? 'pointer' : 'not-allowed'};opacity:${cure ? 1 : .5}"><b>Give them the cure.</b><br><small>${cure ? 'Arden’s serum, made from blackvein instead of people. They can live outside. They’ll owe you everything.' : 'You need blackvein — the blood the Rust doesn’t poison — to make Arden’s serum. (Vale’s safe, the Brightwater archive…)'}</small></button></div></div>`;
  choiceEl.style.display = 'grid';
}
function makeChoice(ch) {
  const A = AS(); if (A.choice) return; A.choice = ch; choiceEl.style.display = 'none'; if (!isTouch) canvas.requestPointerLock?.();
  if (ch === 'cure') take('blackvein', 1);
  if (ch === 'vent') { sfx('boom'); noiseBurst(3, 60, 1, .4); for (const e of [...ents]) if (e.pk === MTN) { e.dead = true; removeEnt(e); } facS('grey').rep = -100; G.flags.greyGone = 1; }
  if (ch === 'spare') { mtnPower(false); const S = facS('grey'); S.rep = -25; S.cease = G.day + 60; }
  if (ch === 'cure') { const S = facS('grey'); S.rep = 45; S.cease = G.day + 365; }
  G.flags.s2done = G.day; s2After(); setTimeout(ending, 2500); save();
}
// what changes in the world after
function s2After() {
  const ch = AS().choice;
  if (ch === 'vent' || ch === 'cure' || ch === 'spare') { for (const e of [...ents]) if (e.gcheck) removeEnt(e); GCHECK.length = 0; }
  if (ch === 'vent' || ch === 'cure') { const B = BASES.find(b => b.id === 'greystation'); if (B) B.hostile = false; }
  if (ch === 'vent') { for (const e of [...ents]) if (e.type === 'clan' && e.fac === 'grey' && !e.pk) { e.dead = true; removeEnt(e); } }
  if (FOGTOWER) G.flags.fogTowerDown = 1;
  facRegions();
}
function ending() {
  const A = AS(), S = setS(), miss = S.missing || [], home = miss.filter(m => m.home).length, lost = miss.length - home, allies = FAC_IDS.filter(f => facAllied(f)).map(f => FAC[f].n), lv = SET_LEVELS[setLevel()];
  const title = { vent: 'THE RED WIND', spare: 'AN UNEASY PEACE', cure: 'THE OPEN DOOR' }[A.choice];
  const lines = [
    A.choice === 'vent' ? 'The fog went down through every level of the Mountain, and nothing came back up. Greyhold is a tomb. The valley sleeps easier, and some nights you don’t.' :
    A.choice === 'spare' ? 'You walked out with your people and left the Mountain dark. Greyhold keeps to its truce — for now. The children who walked outside for an hour will remember who let them live.' :
    'Arden’s serum works. By spring, Greyhold’s people are planting beside yours. Nobody forgets what was done in Ward R — but nobody has to do it again.',
    home ? `${home} of the missing came home to Kestrel${lost ? `; ${lost} never did` : ''}.` : miss.length ? 'None of the missing came home.' : '',
    allies.length ? `The ${allies.join(', the ')} stood with you, and the valley is theirs as much as yours.` : 'You did it with no one beside you. That will be remembered too.',
    `Kestrel is a ${lv.toLowerCase()} now — ${S.ros.length} people, morale ${Math.round(S.morale)}.`,
    'The world goes on. So do you.',
  ].filter(Boolean);
  say(lines.slice(1).map(l => ['', l]));
  card(title, lines[0], 9);
  setTimeout(() => card('SEASON 2 · COMPLETE', 'Free play: the valley is still out there', 6), 10000);
}
const S2INTERACT = [
  { id: 'spoketalk', at: () => SPOKE && SPOKE.g.visible && SPOKE.talk && !G.flags.spokeMet ? SPOKE.talk : null, r: 4, label: () => 'Talk to the people from the Spoke', act: () => { G.flags.spokeMet = G.day; const S = setS(); for (const n of ['Ilse', 'Dov', 'Ana']) (S.pending ||= []).push({ n, trait: pick(TRAITS)[0] }); facAdd('arc', 8); say([['Spoke survivor', 'We’re from Ring F. We thought we were the last. Is it true — a town with a wall?'], ['', 'Three of them will walk to Kestrel. The rest head for Farlight.']]); save(); } },
  { id: 'transport', at: () => nearTransport() && nearTransport().cart.position, r: 3.8, label: () => 'Break the lock on the transport · free the prisoners', act: () => { const C = nearTransport(); startChan({ l: 'Breaking the lock', t: 2.2, fn: () => { C.freed = 1; for (let i = 0; i < C.prisoners; i++) G.flags.rescued = (G.flags.rescued || 0) + 1; if (C.mission) G.flags.transportFreed = G.day; toast(`${C.prisoners} prisoners free — they’ll walk to Kestrel`, 3.4); sfx('metal'); save(); } }); } },
  { id: 'fogtower', at: () => fogTowerOn() && Math.hypot(P.x - FOGTOWER.x, P.z - FOGTOWER.z) < 4 ? FOGTOWER : null, r: 4, label: () => { const it = SAB.find(k => cnt(k) > 0); return it ? `Wreck the fog tower (uses ${nameOf(it).toLowerCase()})` : 'The fog tower · you need fuel, a molotov or a grenade to wreck it'; },
    act: () => { const it = SAB.find(k => cnt(k) > 0); if (!it) { sfx('no'); return; } startChan({ l: 'Wiring it to blow', t: 3, fn: () => { take(it, 1); G.flags.fogTowerDown = G.day; sfx('boom'); puff(FOGTOWER.x, heightAt(FOGTOWER.x, FOGTOWER.z) + 10, FOGTOWER.z, 0xff7a2a, 30, 9, .4, 1.6, -2); FOGTOWER.g.visible = false; card('THE TOWER FALLS', 'The red wind out of the north thins and stops', 4); save(); } }); } },
  { id: 'bed', at: () => { if (UG.at !== MTN || !MTN.beds) return null; for (const [i, b] of MTN.beds.entries()) { if (b.freed) continue; const [x, z] = pw(MTN, b.a, b.b); if (Math.hypot(P.x - x, P.z - z) < 2.2) return { x, z, i }; } return null; }, r: 2.2, label: () => 'Unstrap them', act: () => { const B2 = S2INTERACT[3].at(); startChan({ l: 'Pulling the lines out', t: 1.6, fn: () => bedFree(B2.i) }); } },
  { id: 'choice', at: () => UG.at === MTN && AS().vale && !AS().choice ? (() => { const [x, z] = pw(MTN, -24, 44); return { x, z }; })() : null, r: 3, label: () => 'The reactor controls · decide what happens to the Mountain', act: () => openChoice() },
];

/* ---------- the missions ---------- */
const MTN_ENT = () => [S2() && (G.flags.pkseen || {}).mtn];
MISSIONS.push(
  { id: 's2spoke', t: 'Fire in the Sky', by: 'Kade', open: () => !!G.flags.s2,
    intro: [['Kade', 'Something came down in the east last night. Bigger than the pod, bigger than the Burn.'], ['Kade', 'If it’s from the Arc, there could be people in it. Go.']],
    steps: [{ txt: 'Find what came down in the east — the Spoke', at: () => SPOKE, done: () => !!(G.flags.seen || {}).x_spoke || !!G.flags.spokeMet }, { txt: 'Talk to the survivors', at: () => SPOKE && SPOKE.talk, done: () => !!G.flags.spokeMet }],
    reward: () => give('trauma_kit', 1), rt: 'Three of them are coming to Kestrel · a trauma kit' },
  { id: 's2rebuild', t: 'Back on Our Feet', by: 'Juno', open: () => true,
    intro: [['Juno', 'We can’t go looking for anyone while the yard’s still black with soot. Rebuild. Get people working again.']],
    steps: [{ txt: 'Rebuild every burned building', at: () => { const id = (G.flags.burnt || [])[0]; return id && SHOP[id] ? SHOP[id].front : null; }, done: () => !(G.flags.burnt || []).length }, { txt: 'Lift Kestrel’s morale to 50', at: () => null, done: () => setS().morale >= 50 }],
    reward: () => { setS().morale += 4; }, rt: 'Kestrel breathes again' },
  { id: 's2tracks', t: 'The Missing', by: 'Kade', open: () => true,
    intro: [['Kade', 'The bootprints go north-west, into the fog, toward Greyhold Station. Follow them. Look. Don’t start a war on your own.']],
    steps: [{ txt: 'Follow the trail to Greyhold Station', at: () => BASES.find(b => b.id === 'greystation'), done: () => { const B = BASES.find(b => b.id === 'greystation'); return B && Math.hypot(P.x - B.x, P.z - B.z) < 160; } }],
    reward: () => {}, rt: 'The tracks go under the mountain', outro: [['Radio', 'Farlight: You’re at Greyhold Station? Kestrel — the station’s just the lid. They live under the mountain.']] },
  { id: 's2tech', t: 'Strange Machines', by: 'Rook', open: () => true,
    intro: [['Rook', 'This needle from the gate — the steel isn’t old-world, it’s new. Somebody is still making things. Brightwater knew Greyhold. Find out what they knew.']],
    steps: [{ txt: 'Read the Greyhold memo in the Brightwater lab', at: () => XS('bright'), done: () => !!(G.flags.logs || {}).bw_liaison }, { txt: 'Open the Brightwater archive (keycard from Fort Hesper)', at: () => XS('bright'), done: () => !!(G.flags.logs || {}).bw_archive }],
    reward: () => give('stim', 2), rt: 'You know what Greyhold is · 2 stims' },
  { id: 's2mountain', t: 'Under the Mountain', by: 'Kade', open: () => true,
    intro: [['Kade', 'Front gate, a vent on the mountainside, or the tunnels the Hollowed use. Get in, see it, get out.']],
    steps: [{ txt: 'Get inside the Mountain (front gate with a Greyhold card · the vent with bolt cutters · the Drift)', at: () => MTN && MTN.vent, done: () => !!(G.flags.pkseen || {}).mtn }],
    reward: () => {}, rt: 'You’ve seen it. Clean, bright — and wrong.' },
  { id: 's2ward', t: 'What They Do', by: 'Juno', open: () => true,
    intro: [['Juno', 'You said there were doors you couldn’t open. Open them. I need to know what they’re doing to our people.']],
    steps: [{ txt: 'Find Ward R — the harvest ward', at: () => MTN && MTN.vent, done: () => !!(G.flags.logs || {}).mt_ward }, { txt: 'Read the captain’s terminal', at: () => MTN && MTN.vent, done: () => !!(G.flags.logs || {}).mt_vale }, { txt: 'Tell Juno', at: () => clinic(), done: () => !!G.flags.toldJuno, use: { at: () => clinic(), r: 4, label: 'Tell Juno what’s in Ward R', need: true, act: () => { G.flags.toldJuno = G.day; } } }],
    reward: () => {}, rt: '', outro: [['Juno', 'They’re draining them. Like livestock.'], ['Juno', '…Then we go and get them. All of them.']] },
  { id: 's2drift', t: 'Into the Drift', by: 'Mina', open: () => true,
    intro: [['Mina', 'The Hollowed keep people in cages down in the Drift. Some of them might be ours. I’m going — with or without you.']],
    steps: [{ txt: 'Free everyone in the Drift’s cages', at: () => HOLLOW_NEST, done: () => Object.keys((G.flags.mtn || {}).cages || {}).length >= 3 }],
    reward: () => give('hollow_cloak', 1), rt: 'A Hollowed cloak — they ignore you longer in it' },
  { id: 's2fog', t: 'The Red Wind', by: 'Rook', open: () => true,
    intro: [['Rook', 'The fog’s been coming out of the north on still days. Fog doesn’t do that. Something’s pushing it.']],
    start: () => { (G.flags.xmark ||= {}).fogtower = 1; XMARKS.fogtower = { x: FOGTOWER.x, z: FOGTOWER.z, n: 'Red wind' }; },
    steps: [{ txt: 'Find what’s making the fog in the north and wreck it', at: () => FOGTOWER, done: () => !!G.flags.fogTowerDown }],
    reward: () => { setS().morale += 5; }, rt: 'The red wind stops' },
  { id: 's2coalition', t: 'The Coalition', by: 'Kade', open: () => true,
    intro: [['Kade', 'We can’t take the Mountain alone. Two allies. Clans, Farlight, Ironjaw — I don’t care who, as long as they show up.']],
    steps: [{ txt: 'Make allies of two factions (bag → Factions)', at: () => null, done: () => FAC_IDS.filter(f => facAllied(f)).length >= 2 }],
    reward: () => {}, rt: 'They’ll march with you' },
  { id: 's2supply', t: 'Starve the Mountain', by: 'Rook', open: () => true,
    intro: [['Rook', 'Greyhold Station feeds the Mountain. Burn its depot and they come out fighting hungry.']],
    steps: [{ txt: 'Burn the Greyhold supply depot at Greyhold Station', at: () => DEPOTS.find(d => d.f === 'grey'), done: () => facS('grey').depot > 0 }],
    reward: () => give('molotov', 2), rt: '2 molotovs' },
  { id: 's2transport', t: 'The Transport', by: 'Farlight', open: () => true,
    intro: [['Farlight', 'Kestrel — a Greyhold transport is on the north road with people in the back. It’s yours if you can stop it.']],
    start: () => { if (!spawnTransport(true)) setTimeout(() => spawnTransport(true), 30000); },
    steps: [{ txt: 'Stop the prisoner transport and free the people inside', at: () => EV.convoy && EV.convoy.cart.position, done: () => !!G.flags.transportFreed }],
    reward: () => { setS().morale += 4; }, rt: 'Three more coming home' },
  { id: 's2card', t: 'The Red Card', by: 'Kade', open: () => true,
    intro: [['Kade', 'Those red doors — we need a way through them on the day. Vale’s card, or kill the power to the whole place.']],
    steps: [{ txt: 'Get a red Greyhold card (Vale’s desk) — or find out how to kill the Mountain’s power', at: () => MTN && MTN.vent, done: () => cnt('mtn_card') > 0 || !!(G.flags.logs || {}).mt_truth || !!(G.flags.mtn || {}).off }],
    reward: () => {}, rt: 'You know how to open every door' },
  { id: 's2assault', t: 'The Assault', by: 'Kade', open: () => true,
    intro: [['Kade', 'This is it. Our allies hit the front gate. You go in — any door you like. Get our people off those beds. Find Vale.']],
    start: () => assaultStart(),
    steps: [
      { txt: 'Get inside the Mountain', at: () => BASES.find(b => b.id === 'greystation'), done: () => UG.at === MTN || AS().freed > 0 },
      { txt: 'Free the people in the harvest ward', at: () => MTN && MTN.vent, done: () => AS().freed >= Math.min(4, MTN.beds.length) },
      { txt: 'Find Captain Vale in the reactor hall — and finish it', at: () => MTN && MTN.vent, done: () => !!AS().vale, start: () => valeSpawn() },
    ], reward: () => {}, rt: '' },
  { id: 's2choice', t: 'The Choice', by: 'Kade', open: () => true,
    intro: [['Kade', 'It’s your call. Whatever you decide, Kestrel will stand behind it.']],
    steps: [{ txt: 'Decide what happens to the Mountain (the reactor controls)', at: () => MTN && MTN.vent, done: () => !!AS().choice }],
    reward: () => {}, rt: '' },
);

for (const [i, m] of MISSIONS.entries()) MSI[m.id] = i;   // the runner's index knows about the new ones

/* ---------- each frame ---------- */
let s2sT = 0;
function updS2Story(dt) {
  valeTick();
  if (VALE && VALE.dead && !AS().vale) { AS().vale = G.day; card('CAPTAIN VALE IS DEAD', 'The reactor hall is yours', 4); save(); }
  // the third step of the assault spawns Vale when it starts
  const m = msCur(); if (m && m.id === 's2assault' && MS().st === 2) valeSpawn();
  // the fog tower: a red wind round it
  if (FOGTOWER) { FOGTOWER.g.visible = fogTowerOn(); if (fogTowerOn()) { for (const c of FOGTOWER.cloud) c.rotation.y += dt * .05; const d = Math.hypot(P.x - FOGTOWER.x, P.z - FOGTOWER.z); if (d < 45 && !UG.at && !P.dead) { const fr = fogResist(); if (fr < 1) { P.hp -= 4 * dt * (1 - fr); P.dose = (P.dose || 0) + dt * (1 - fr); } } } }
  s2sT -= dt; if (s2sT > 0) return; s2sT = 1;
  // the beds you freed stay freed
  if (MTN && MTN.beds) for (const [i, b] of MTN.beds.entries()) if (((G.flags.mtn || {}).beds || {})[i] && !b.freed) { b.freed = 1; b.g.visible = false; }
}
function buildS2Story() { const s0 = seed; seed = 1111111; buildFogTower(); window.__S2S = { AS, openChoice, makeChoice, assaultStart, valeSpawn, bedFree, ending, spawnTransport, get VALE() { return VALE; } }; seed = s0; }
function s2StoryRestore() { VALE = null; if (G.flags.s2done && AS().choice) s2After(); if (FOGTOWER && G.flags.fogTowerDown) FOGTOWER.g.visible = false; if (G.flags.xmark && G.flags.xmark.fogtower && FOGTOWER) XMARKS.fogtower = { x: FOGTOWER.x, z: FOGTOWER.z, n: 'Red wind' }; }
