
/* ================= everyday play (Nov 11, from Bryce's "Everyday Gameplay Design" doc) =================
   What's here is only what the game didn't already have. Everything else in the doc (exploration, hidden rooms,
   factions, settlers and jobs, side jobs, Old Hob, light survival, Day 100 and after) was already built.
   · the morning (`e2Day`): each new day Kestrel has a briefing — what the settlers brought in, who's loyal, what the
     traders are short of, rumors, requests, and the scouts' word on tonight. Bag → Journal → Today, and a panel when
     you wake in Kestrel.
   · rumors (`e2Rumors`): three a day (four with the lookout), marked on the map: places you haven't found, a crate
     nobody's opened, who's moving on which outpost, and the hooks for the events below.
   · new events: the Missing Trader (a wagon on the road, tracks to the camp holding him), Smoke in the Hills (a new
     camp on a ridge — watch it from cover first, or walk in), A Deal Gone Wrong (a shipment argued over at Farlight).
     The pool is weighted by how the world stands (`w` on each event in 2k-events.js).
   · the raid warning (`e2Warn`): on a raid day the scouts come in at midday — fortify (logs + nails: the gate is
     patched and the raid comes in thinner), intercept (a war party camped out there: kill it before dark and the raid
     is a fraction), or negotiate (scrap to stand them down tonight; not Greyhold, not the Hollowed).
   · traders: each shop has a shortage (+50%), a deal (−30%) and two things it wants (pays double); each keeper has a
     contract (bring N of something within 3 days → scrap and their trust); trust up to 5 takes up to 15% off, and at
     trust 3 the rare-goods keepers sometimes stock a blueprint.
   · people: a settler who's been in Kestrel a few days may ask something of you — a keepsake from where they came
     from, a brother or sister still out there, or a score to settle with a named raider. Do it and they're loyal:
     +morale and a small gift in the stores each morning, and as your companion you take 10% less damage.
   · routes (`E2_ROUTES`): rock faces you can climb with climbing gear, or rig once with 2 rope for good; rubble over
     a cellar (pickaxe or shovel); a wreck over a hatch (crowbar — or lift it with a companion); a washed-out
     footbridge over the Coldwater (8 planks, 2 rope, 10 nails and a hammer). Each opens a way or a stash.
   · two projects that open things up: the lookout (an extra rumor every morning, a warning every raid day and earlier)
     and the market square (a travelling trader sets up in Kestrel every third day; contracts pay a quarter more).
   · the expedition report: come home after a trip and Kestrel's clerk sums it up — what you found, what you gained,
     what changed because you went.
   State: G.flags.ev2 (saved). Debug: __E2. */

const E2 = () => G.flags.ev2 ||= { day: -1, rum: [], deal: {}, con: {}, trust: {}, tn: null, pm: null, pmSeq: 0, rope: {}, dug: {}, br: {}, notes: [], done: 0, intelK: 1, farMark: 0, tradeOff: 0 };
const E2LIVE = { smoke: null, lost: null, deal: null, icpt: null, pm: null, hob: null };
const E2_MARKS = [];   // { x, z, n, ring, until (day) }

/* ---------- a panel for choices (styled like the quarrel panel) ---------- */
let e2El = null;
function e2Panel(title, html, btns) {
  if (document.pointerLockElement) document.exitPointerLock();
  if (!e2El) { e2El = document.createElement('div'); e2El.id = 'e2p'; e2El.style.cssText = 'position:fixed;inset:0;z-index:71;display:none;place-items:center;background:rgba(0,0,0,.66)'; document.body.appendChild(e2El);
    e2El.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) { if (e.target === e2El) e2Close(); return; } e.stopPropagation(); if (b.classList.contains('dis')) { sfx('no'); return; } if (b.dataset.e2) e2Action(b.dataset); }); }
  const bt = b => `<button data-e2="${b.k}"${b.v ? ` data-v="${b.v}"` : ''}${b.dis ? ' class="dis"' : ''} style="text-align:left;padding:10px;background:#1e1a14;color:#efe9dc;border:1px solid #fff3;border-radius:4px;font:15px Georgia,serif;cursor:pointer;${b.dis ? 'opacity:.45' : ''}">${b.t}</button>`;
  e2El.innerHTML = `<div style="width:min(560px,94vw);max-height:86vh;overflow:auto;background:#14110e;border:1px solid #f0a64066;border-radius:6px;padding:20px 22px;color:#efe9dc;font:15px/1.5 Georgia,serif"><h2 style="font:700 24px 'Barlow Condensed',sans-serif;margin:0 0 8px;letter-spacing:.04em">${title}</h2>${html}<div style="display:grid;gap:8px;margin-top:12px">${btns.map(bt).join('')}</div></div>`;
  e2El.style.display = 'grid';
}
function e2Close() { if (e2El) e2El.style.display = 'none'; if (!isTouch && G.mode === 'play' && !invOpen) try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch (e) {} }
const e2Open = () => e2El && e2El.style.display !== 'none';
const e2Note = s => { const E = E2(); E.notes.push(s); if (E.notes.length > 12) E.notes.shift(); };

/* ---------- finding room in the world for something new ---------- */
function e2Free(x, z, r, sl = .45) {
  if (waterAt(x, z) > heightAt(x, z) - .6 || slopeAt(x, z) > sl || Math.hypot(x, z) > WORLD - 60) return false;
  for (let i = Math.floor((x - r) / CELL) - 1; i <= Math.floor((x + r) / CELL) + 1; i++) for (let j = Math.floor((z - r) / CELL) - 1; j <= Math.floor((z + r) / CELL) + 1; j++) { const L = grid.get(gkey(i, j)); if (L) for (const c of L) if (c.r > 0 && Math.hypot(c.x - x, c.z - z) < c.r + r) return false; }
  return true;
}
function e2Spot(tx, tz, r, r0 = 0, r1 = 40) { for (let k = 0; k < 60; k++) { const a = rnd() * 6.283, d = k ? rr(r0, r1) : 0, x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d; if (e2Free(x, z, r)) return { x, z }; } return null; }
const e2Ring = (r0, r1, cx = 0, cz = 0) => { for (let k = 0; k < 40; k++) { const a = rnd() * 6.283, d = rr(r0, r1), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (e2Free(x, z, 3)) return { x, z }; } return null; };
const e2Where = (x, z) => { let b = null, bd = 1e9; for (const R of REGIONS) { if (R.x == null || R.river || R.area || R.id === 'kestrel') continue; const d = Math.hypot(R.x - x, R.z - z); if (d < bd) { bd = d; b = R; } } return b ? (bd < (b.r || 40) + 30 ? b.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase()) : `out past ${b.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase())}`) : 'out in the wilds'; };
const e2Dir = (x, z) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(x, -z) + 6.283) % 6.283) / (Math.PI / 4)) % 8];
// a small smoke column of its own (the world's smoke columns are counted once when the map is built)
function e2Smoke(x, y, z) { const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x4a4440, transparent: true, opacity: .34, depthWrite: false }), 12); im.frustumCulled = false; world.add(im); const k0 = rnd(); im.userData.tick = t => { for (let i = 0; i < 12; i++) { const k = (k0 + i / 12 + t * .025) % 1; _sm.position.set(x + Math.sin(k * 7 + i) * k * 4, y + k * 46, z + k * 8); _sm.scale.setScalar(.8 + k * 7); _sm.updateMatrix(); im.setMatrixAt(i, _sm.matrix); } im.instanceMatrix.needsUpdate = true; }; return im; }
function e2Tent(x, z, yaw, col) { const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }); const sh = new THREE.Shape([new THREE.Vector2(-1.2, 0), new THREE.Vector2(1.2, 0), new THREE.Vector2(0, 1.4)]); mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), m, 0, 0, -1.2, g); mesh(new THREE.PlaneGeometry(.9, 1), xm('dark'), 0, .5, 1.22, g); g.position.set(x, heightAt(x, z), z); g.rotation.y = yaw; world.add(g); return g; }
// an event's stash comes out of the world with it
function e2DropCache(C) { if (!C) return; world.remove(C.g); const i = CACHES.indexOf(C); if (i >= 0) CACHES.splice(i, 1); }
function e2Fire(x, z) { const g = new THREE.Group(), y = heightAt(x, z); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; mesh(new THREE.DodecahedronGeometry(.16, 0), M(0x5a5650), Math.cos(a) * .5, .06, Math.sin(a) * .5, g); } const f = mesh(new THREE.ConeGeometry(.38, 1, 7), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .9 }), 0, .5, 0, g); g.position.set(x, y, z); world.add(g); g.userData.tick = t => { f.scale.y = 1 + Math.sin(t * 13 + x) * .25; }; return g; }

/* ---------- the morning ---------- */
const SHOP_KEYS = ['cook', 'craft', 'trade', 'med', 'guns', 'salvage', 'wear'];
const KEEPER_N = { cook: 'Bram', craft: 'Kade', trade: 'Odile', med: 'Juno', guns: 'Rook', salvage: 'Gus', wear: 'Wren', mara: 'Mara' };
const CON_WANT = {
  cook: [['meat', 8], ['fish', 5], ['honey', 2], ['mushroom', 6], ['berries', 10], ['salt', 3], ['fat', 4]],
  craft: [['metal_ore', 6], ['iron', 4], ['gears', 3], ['springs', 3], ['pipe', 3], ['charcoal', 6]],
  trade: [['hide', 5], ['cloth', 10], ['battery', 2], ['circuit', 2], ['glass', 4], ['rope', 4], ['feather', 12]],
  med: [['herb_med', 6], ['herb', 8], ['alcohol', 2], ['cloth', 8], ['med_parts', 1], ['honey', 2]],
  guns: [['gunpowder', 6], ['spare_parts', 3], ['springs', 2], ['steel', 2], ['bone', 6]],
  salvage: [['arc_alloy', 2], ['solar_cell', 1], ['engine_part', 1], ['cu_wiring', 4], ['sensor', 1], ['data_drive', 1]],
  wear: [['hide', 6], ['leather', 4], ['sinew', 4], ['feather', 10], ['thread', 4]],
  mara: [['dried_meat', 4], ['hide', 4], ['herb_med', 4]],
};
let e2LastDay = -1;
function e2Day(quiet) {
  e2LastDay = G.day; const E = E2(); if (E.day === G.day) return; E.day = G.day;
  // contracts that ran out, new ones where a keeper has none
  for (const k of [...SHOP_KEYS, 'mara']) { const C = E.con[k]; if (C && C.until < G.day) delete E.con[k]; if (!E.con[k]) { const L = CON_WANT[k].filter(([id]) => ITEMS[id] || GEAR_DEFS[id]); if (!L.length) continue; const [it, n0] = pick(L), n = Math.max(1, Math.round(n0 * rr(.8, 1.3))); E.con[k] = { it, n, rw: Math.ceil(valueOf(it) * n * 1.7 + 10), until: G.day + 3 }; } }
  E.deal = {};   // the day's shortages and deals are worked out when you first open that shop's stock
  if (E.farMark && E.farMark < G.day) E.farMark = 0;
  if (E.tradeOff && E.tradeOff < G.day) E.tradeOff = 0;
  E.tn = null; e2ClearIcpt(); if (E.intelUsed) { E.intelK = 1; E.intelUsed = 0; }
  e2Rumors();
  // loyal settlers: a little extra in the stores, a little lift
  const S = setS(), loyal = S.ros.filter(R => R.loyal);
  if (loyal.length) { S.morale = clamp(S.morale + loyal.length, 0, 100); for (const R of loyal) { const gift = { kind: 'herb_med', brave: 'ammo_9', grim: 'dried_meat', steady: 'nails', careful: 'bandage', restless: 'scrap', cheerful: 'canned', sharp: 'arrows' }[R.trait] || 'canned'; if (ITEMS[gift] || gift === 'scrap') sAdd(gift, gift === 'scrap' ? 6 : gift === 'nails' || gift === 'ammo_9' || gift === 'arrows' ? 6 : 1); } }
  // a settler asks something of you
  if (!E.pm && G.day >= 4 && rnd() < .55) { const cand = S.ros.filter(R => !R.loyal && G.day - (R.joined || 1) >= 3 && !R.pmDone); if (cand.length) e2PmOffer(pick(cand)); }
  // the market: a trader in Kestrel every third day
  e2Hob();
  if (!quiet && G.flags.reached) setTimeout(() => { if (inKestrel() && !P.dead && !night.active && !invOpen && !e2Open() && G.mode === 'play') e2Morning(); else toast(`Day ${G.day} · ${E.rum.length} rumors in Kestrel — bag → Journal → Today`, 3.4); }, 7500);
  save();
}
function e2Rumors() {
  const E = E2(), out = [], seen = G.flags.seen || {}, n = projDone('lookout') ? 4 : 3, who = () => pick(setS().ros.map(R => R.n).concat(['Kade', 'Odile', 'Rook', 'Gus']));
  E2_MARKS.length = 0;
  const makers = {
    place: () => { const un = REGIONS.filter(R => R.x != null && !R.river && !R.area && R.id !== 'kestrel' && !seen[R.id] && Math.hypot(R.x, R.z) < WORLD - 80); if (!un.length) return null; const R = pick(un); return { t: 'place', txt: `${who()} swears there's something ${e2Dir(R.x, R.z)} of here — ${R.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase())}. ${R.sub || ''}`, x: R.x, z: R.z, n: R.name.split(' · ')[0], ring: 60 }; },
    cache: () => { const L = CACHES.filter(C => !C.ev && C.refill <= 0 && !(G.flags.caches || {})[C.id] && C.y != null && Math.hypot(C.x, C.z) > CAMP_R + 120 && Math.abs(C.y - heightAt(C.x, C.z)) < 3); if (!L.length) return null; const C = pick(L); const x = C.x + rr(-40, 40), z = C.z + rr(-40, 40); return { t: 'cache', txt: `A drifter traded word of ${C.name ? (/^(a|an|the) /i.test(C.name) ? '' : 'a ') + C.name.toLowerCase() : 'a stash'} nobody's opened, ${e2Where(C.x, C.z)}. Somewhere in the ring on your map.`, x, z, n: 'Unopened stash', ring: 70 }; },
    smoke: () => { if (E2LIVE.smoke || G.day < 3) return null; const s = e2High(); if (!s) return null; E.smokeAt = { x: s.x, z: s.z, day: G.day }; return { t: 'smoke', txt: `The watch saw smoke on the hills to the ${e2Dir(s.x, s.z)} at first light. Somebody new has moved in.`, x: s.x, z: s.z, n: 'Smoke on the hills', ring: 40 }; },
    lost: () => { if (E2LIVE.lost || G.day < 2) return null; const s = e2Ring(260, 520); if (!s) return null; E.lostAt = { x: s.x, z: s.z, day: G.day }; return { t: 'lost', txt: `Odile's runner, Corin, should have been back from Farlight yesterday. He took the road ${e2Dir(s.x, s.z)}.`, x: s.x, z: s.z, n: 'Where Corin was last seen', ring: 50 }; },
    post: () => { const L = OUTPOSTS.filter(O => FAC[postOwner(O)] && postOwner(O) !== 'kestrel'); if (!L.length) return null; const O = pick(L), f = postOwner(O), riv = FAC_IDS.filter(g => g !== f && atWar(f, g) && !FAC[g].mute && (!FAC[g].s2 || G.flags.s2)); if (!riv.length) return null; const g = pick(riv); return { t: 'post', txt: `${FAC[g].n} have been seen near the ${O.n.toLowerCase()} the ${FAC[f].n} hold. It may change hands — or be thin on guards today.`, x: O.x, z: O.z, n: O.n }; },
    short: () => { const k = pick(SHOP_KEYS); const L = CON_WANT[k].filter(([id]) => ITEMS[id]); if (!L.length) return null; return { t: 'short', txt: `${KEEPER_N[k]} is short of ${nameOf(pick(L)[0]).toLowerCase()} — check what the shops are paying double for today.` }; },
  };
  const order = ['place', 'smoke', 'lost', 'cache', 'post', 'short', 'place', 'cache'];
  for (let k = 0; k < 4; k++) order.push(pick(Object.keys(makers)));
  const used = new Set();
  for (const t of order.sort(() => rnd() - .5)) { if (out.length >= n) break; if (used.has(t) && t !== 'place') continue; const r = makers[t](); if (r) { out.push(r); used.add(t); } }
  E.rum = out; e2MarksSync();
}
function e2MarksSync() { const E = E2(); E2_MARKS.length = 0; for (const r of E.rum) if (r.x != null && !r.gone) E2_MARKS.push({ x: r.x, z: r.z, n: r.n, ring: r.ring || 0 }); }
function e2High() { let b = null; for (let k = 0; k < 40; k++) { const a = rnd() * 6.283, d = rr(240, 560), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!e2Free(x, z, 6)) continue; const h = heightAt(x, z) - (heightAt(x + 30, z) + heightAt(x - 30, z) + heightAt(x, z + 30) + heightAt(x, z - 30)) / 4; if (!b || h > b.h) b = { x, z, h }; } return b; }

function todayHTML() {
  const E = E2(), S = setS();
  let h = `<h4>Today · day ${G.day}</h4><div class="jn">`;
  const row = (c, t) => `<div style="padding:6px 8px;border:1px solid #fff2;border-left:4px solid ${c};border-radius:3px;background:#0002">${t}</div>`;
  // settlers
  const out = S.lastOut || {}, haul = Object.entries(out).slice(0, 6).map(([k, n]) => `${n} ${nameOf(k).toLowerCase()}`).join(' · ');
  const C = typeof compS === 'function' && compS(), cR = C && S.ros.find(R => R.id === C.id), loyal = S.ros.filter(R => R.loyal).map(R => R.n);
  h += row('#7fc4b8', `<b>Kestrel</b> <small style="opacity:.8">${S.ros.length} people · morale ${Math.round(S.morale)}${haul ? ` · brought in: ${haul}` : ''}${cR ? ` · ${cR.n} is with you${cR.loyal ? ' (loyal)' : ''}` : ''}${loyal.length ? ` · loyal: ${loyal.join(', ')}` : ''}</small>`);
  // tonight
  const T = E.tn;
  if (T && !T.done) h += row('#e0573d', `<b>Tonight</b> <small style="opacity:.8">${e2WarnText(T)}</small>${T.choice ? '' : ' ' + e2WarnBtns(T).map(b => `<button data-e2="${b.k}"${b.dis ? ' class="dis"' : ''}>${b.t}</button>`).join(' ')}`);
  // a request
  if (E.pm) { const R = S.ros.find(r => r.id === E.pm.sid); if (R) h += row('#c8a0e0', `<b>${R.n} asked you something</b> <small style="opacity:.8">${E.pm.d}</small> ${E.pm.st ? `<small style="color:#c8a0e0">· ${E.pm.st === 2 ? 'done — go and tell them' : 'on your map'}</small>` : `<button data-e2="pmyes">I'll do it</button> <button data-e2="pmno">Not now</button>`}`); }
  // traders
  const deals = SHOP_KEYS.map(k => { const D = E.deal[k]; return D ? `${KEEPER_N[k]}: wants ${D.want.map(i => nameOf(i).toLowerCase()).join(', ')}` : null; }).filter(Boolean);
  const cons = Object.entries(E.con).map(([k, c]) => `${KEEPER_N[k]}: ${c.n} × ${nameOf(c.it).toLowerCase()} (${c.rw} scrap, by day ${c.until})`);
  h += row('#e8c070', `<b>Traders</b> <small style="opacity:.8">${deals.length ? deals.join(' · ') + ' · ' : 'Each shop has a shortage, a deal and two things it pays double for. '}Contracts — ${cons.slice(0, 8).join(' · ')}</small>${E2LIVE.hob ? ' <small style="color:#e8c070">· a travelling trader is at the market</small>' : ''}`);
  // rumors
  for (const r of E.rum) h += row('#ff9a6a', `<b>Rumor</b> <small style="opacity:.8">${r.txt}${r.gone ? ' <i>(done)</i>' : r.x != null ? ' · on your map' : ''}</small>`);
  const SJo = SJ().offers.length; if (SJo) h += `<p class="dim">${SJo} new on the job board by the stores.</p>`;
  return h + '</div>';
}
function e2Morning() {
  const E = E2(), S = setS();
  const out = S.lastOut || {}, haul = Object.entries(out).slice(0, 5).map(([k, n]) => `${n} ${nameOf(k).toLowerCase()}`).join(', ');
  let h = `<p style="opacity:.85">${haul ? `The settlers brought in ${haul}. ` : ''}Morale is ${Math.round(S.morale) > 60 ? 'good' : Math.round(S.morale) < 30 ? 'low' : 'holding'} (${Math.round(S.morale)}).${SJ().offers.length ? ` The job board has ${SJ().offers.length} new.` : ''}</p>`;
  if (E.rum.length) h += `<p style="margin:8px 0 4px"><b>Word around the fire</b></p>` + E.rum.map(r => `<p style="margin:2px 0;opacity:.85">· ${r.txt}</p>`).join('');
  if (E.pm && !E.pm.st) { const R = S.ros.find(r => r.id === E.pm.sid); if (R) h += `<p style="margin:10px 0 2px"><b>${R.n}</b> <i>“${E.pm.ask}”</i></p>`; }
  const btns = [];
  if (E.pm && !E.pm.st) btns.push({ k: 'pmyes', t: 'Tell them you’ll do it' }, { k: 'pmno', t: 'Not now' });
  btns.push({ k: 'close', t: 'Head out' });
  e2Panel(`MORNING · DAY ${G.day}`, h, btns);
}

/* ---------- the raid warning ---------- */
function e2WarnCheck() {
  const E = E2(); if (E.tn || E.warnDay === G.day) return;
  if (!G.flags.reached || G.day < 3 || night.active || G.day >= 99 && !G.flags.held100 && !G.flags.fell100 || SIEGE.on) return;
  const look = projDone('lookout'); if (G.tod < (look ? .38 : .5)) return;
  E.warnDay = G.day;
  if (!facAnyRaider() || (!look && rnd() > .6)) return;
  const W = facRaidWeights(); let f = null, bw = -1; for (const k in W) if (W[k] > bw) { bw = W[k]; f = k; }
  if (!f) return;
  const n = Math.max(4, Math.round(Math.min(2 + Math.ceil(G.day / 3), 8) * (5 + G.day * .8) * facRaidScale()));
  E.tn = { f, n, k: 1, choice: null, done: 0 };
  const scout = pick(setS().ros.filter(R => R.job === 'scout' || R.job === 'guard').map(R => R.n)) || 'One of the watch';
  if (inKestrel() || cnt('radio') > 0 || G.flags.longRadio) { say([[scout, `${FAC[f].n} — a war party, maybe ${n} of them, gathering ${e2Dir(FAC[f].cap().x, FAC[f].cap().z)} of the wall. They'll come tonight.`], ['', 'Bag → Journal → Today: fortify, intercept or try to talk them down.']]); card('SCOUTS’ WARNING', `The ${FAC[f].n} are coming tonight`, 4); }
  save();
}
const e2CanTalk = f => f && !['grey', 'hollow'].includes(f) && !FAC[f].mute && facRep(f) > -75;
const e2TalkCost = () => 30 + Math.round(G.day * .8);
function e2WarnText(T) {
  const F = FAC[T.f];
  if (T.choice === 'fort') return `The ${F.n} are coming. Kestrel is fortified — the gate's patched and the walls are manned; expect them thinner.`;
  if (T.choice === 'icpt') return E2LIVE.icpt && !E2LIVE.icpt.won ? `Their war party is camped out there (on your map). Kill it before dark and tonight's raid is a fraction.` : `You broke their war party. Whatever comes tonight is the dregs.`;
  if (T.choice === 'nego') return `You paid the ${F.n} to stay home tonight.`;
  return `The scouts say the ${F.n} are gathering — maybe ${T.n} of them. They'll come at dark.`;
}
function e2WarnBtns(T) {
  const logs = cnt('log') + sCnt('log'), nails = cnt('nails') + sCnt('nails'), c = e2TalkCost();
  return [{ k: 'fort', t: `Fortify (8 logs, 12 nails · you+stores have ${logs}/${nails})`, dis: logs < 8 || nails < 12 },
    { k: 'icpt', t: 'Intercept their war party before dark' },
    { k: 'nego', t: e2CanTalk(T.f) ? `Negotiate (${c} scrap, by radio or at their white flag)` : `Negotiate — the ${FAC[T.f].n} don't talk`, dis: !e2CanTalk(T.f) || INV.scrap < c }];
}
function e2Use(id, n) { const a = Math.min(cnt(id), n); if (a) take(id, a); if (n - a > 0) sAdd(id, -(n - a)); }
function e2WarnChoose(k) {
  const E = E2(), T = E.tn; if (!T || T.choice) return;
  if (k === 'fort') { if (cnt('log') + sCnt('log') < 8 || cnt('nails') + sCnt('nails') < 12) { sfx('no'); return; } e2Use('log', 8); e2Use('nails', 12); T.choice = 'fort'; T.k = .72; gate.hp = gate.max; sfx('metal'); toast('The gate is patched, the walls braced, everyone who can hold a rifle is told where to stand', 3.6); }
  else if (k === 'icpt') { const C = FAC[T.f].cap(); const a = Math.atan2(C.x, C.z), s = e2Spot(Math.sin(a) * rr(170, 240), Math.cos(a) * rr(170, 240), 4, 10, 60); if (!s) { toast('The scouts lost them in the trees', 2.6); return; } T.choice = 'icpt'; e2Icpt(T.f, s.x, s.z); }
  else if (k === 'nego') { const c = e2TalkCost(); if (!e2CanTalk(T.f) || INV.scrap < c) { sfx('no'); return; } INV.scrap -= c; T.choice = 'nego'; facAdd(T.f, 4, 'you paid them to stand down'); sfx('radio'); say([[FAC[T.f].leader[0], pick(['Scrap first. Then we sleep. Don’t make us regret it.', 'One night. Count yourselves lucky.', 'We’ll find someone else’s wall tonight.'])]]); }
  save();
}
function e2Icpt(f, x, z) {
  const K = FAC_KINDS[FAC[f].kind] || FAC_KINDS.clan, L = { f, x, z, ents: [], props: [], won: 0 };
  for (let i = 0; i < 6; i++) { const e = spawnClan(K[i % K.length], x + rr(-7, 7), z + rr(-7, 7), 'guard', facFac(f)); e.tribe = f; e.evTemp = 1; L.ents.push(e); }
  L.props.push(e2Fire(x, z)); for (let i = 0; i < 2; i++) { const a = i * 2.6 + .4; L.props.push(e2Tent(x + Math.cos(a) * 5, z + Math.sin(a) * 5, -a, 0x6a4a32)); }
  E2LIVE.icpt = L; E2_MARKS.push({ x, z, n: `${FAC[f].n} war party`, ring: 0, icpt: 1 });
  toast(`Their war party is camped ${e2Dir(x, z)} of the wall — it's on your map. Hit it before dark.`, 3.6);
}
function e2ClearIcpt() { const L = E2LIVE.icpt; if (!L) return; for (const e of L.ents) if (!e.dead && ents.includes(e)) removeEnt(e); for (const p of L.props) world.remove(p); for (const C of L.caches || []) e2DropCache(C); E2LIVE.icpt = null; for (let i = E2_MARKS.length - 1; i >= 0; i--) if (E2_MARKS[i].icpt) E2_MARKS.splice(i, 1); }
// tonight's raid follows the choice
{ const rs0 = facRaidScale; facRaidScale = function () { const T = E2().tn, v = rs0(); return v * (T ? T.k : 1) * (E2().intelK || 1); }; }
{ const rw0 = facRaidWeights; facRaidWeights = function () { const W = rw0(), T = G.flags.ev2 && G.flags.ev2.tn; if (T && T.choice === 'nego' && !night.final) delete W[T.f]; return W; }; }
{ const sn0 = startNight; startNight = function () { const E = E2(), T = E.tn; sn0(); if (T && !night.final) { if (T.choice === 'fort') night.waves = Math.max(1, night.waves - 1); if (T.choice === 'icpt' && E2LIVE.icpt && E2LIVE.icpt.won) night.waves = Math.max(1, Math.ceil(night.waves / 3)); if (T.choice === 'icpt' && E2LIVE.icpt && !E2LIVE.icpt.won) { e2ClearIcpt(); T.k = 1.1; setTimeout(() => toast('The war party you didn’t stop is at the wall', 3), 2500); } } if (E.intelK < 1) { E.intelUsed = 1; setTimeout(() => toast('What you learned watching their camp is paying off — they come in thinner', 3), 4000); } }; }

/* ---------- the Missing Trader ---------- */
function e2Lost(x, z) {
  if (E2LIVE.lost) return false;
  const a = rr(0, 6.28), L = { x, z, props: [], foes: [], freed: 0, cargo: null, trader: null, end: G.t + 900 };
  // the wagon: on its side, a wheel off, crates spilled
  const w = new THREE.Group(); mesh(new THREE.BoxGeometry(1.8, .9, 3.2), new THREE.MeshLambertMaterial({ map: texWood, color: 0x7a5e44 }), 0, .9, 0, w);
  for (const [px, pz] of [[-.95, 1], [.95, 1], [-.95, -1]]) { const wh = mesh(new THREE.CylinderGeometry(.45, .45, .15, 10), M(0x2a2218), px, .45, pz, w); wh.rotation.z = Math.PI / 2; }
  const off = mesh(new THREE.CylinderGeometry(.45, .45, .15, 10), M(0x2a2218), 2.2, .08, -1.6, w);
  w.rotation.set(0, a, .5); w.position.set(x, heightAt(x, z), z); world.add(w); L.props.push(w); addCol(x, z, 1.8);
  for (let i = 0; i < 4; i++) { const c = mesh(new THREE.BoxGeometry(.7, .5, .6), M(pick([0x6a5038, 0x5a4a34])), x + rr(-3, 3), heightAt(x, z) + .25, z + rr(-3, 3), world); c.rotation.y = rr(0, 6); L.props.push(c); }
  // tracks to where they took him
  const d = rr(55, 75), cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d, cs = e2Spot(cx, cz, 4, 5, 30) || { x: cx, z: cz };
  const trk = new THREE.Group(), tm = new THREE.MeshBasicMaterial({ color: 0x2a2018, transparent: true, opacity: .55, depthWrite: false });
  const n = Math.floor(Math.hypot(cs.x - x, cs.z - z) / 1.4); for (let i = 2; i < n; i++) { const k = i / n, px = lerp(x, cs.x, k) + Math.sin(i * 1.7) * .6, pz = lerp(z, cs.z, k) + Math.cos(i * 1.3) * .6; const s = mesh(new THREE.PlaneGeometry(.22, .34), tm, px + (i % 2 ? .25 : -.25), heightAt(px, pz) + .05, pz, trk); s.rotation.set(-XHPI, 0, -a); } world.add(trk); L.props.push(trk);
  // the captors' camp
  L.props.push(e2Fire(cs.x, cs.z)); L.props.push(e2Tent(cs.x + 4, cs.z + 2, rr(0, 6), 0x5a4a32));
  const hos = FAC_IDS.filter(f => f !== 'arc' && facHostile(f) && !FAC[f].mute && (!FAC[f].s2 || G.flags.s2)), f = hos.length ? facNearestCap(cs.x, cs.z, hos) : null;
  if (f) { const K = FAC_KINDS[FAC[f].kind]; for (let i = 0; i < 4; i++) { const g = spawnClan(K[i % K.length], cs.x + rr(-6, 6), cs.z + rr(-6, 6), 'guard', facFac(f)); g.tribe = f; g.evTemp = 1; L.foes.push(g); } L.f = f; }
  else for (const wv of spawnGroup('wolf', cs.x + 6, cs.z + 4, 4, 6, 30)) L.foes.push(wv);
  const t = spawnNPC('corin', cs.x - 2.2, cs.z - 1.5, { model: 'civilian', yaw: rr(0, 6), h: 1.74 }); t.corin = 1; t.wander = false; L.trader = t;
  L.cargo = cache(world, cs.x + 1.6, cs.z - 3, rr(0, 6), 'none', 'city', { id: 'e2_cargo_' + Math.floor(G.t), name: 'Corin’s cargo', rolls: 2, refill: 0, noCol: 1 }); L.cargo.ev = 1; L.caches = [L.cargo];
  L.cx = cs.x; L.cz = cs.z; E2LIVE.lost = L; E2_MARKS.push({ x, z, n: 'An overturned wagon', ring: 0, lost: 1 });
  return true;
}
const e2LostClear = () => { const L = E2LIVE.lost; return L && L.foes.every(e => e.dead || !ents.includes(e)); };
function e2LostFree() {
  const L = E2LIVE.lost; if (!L || L.freed) return; if (!e2LostClear()) { toast('Not with them still here', 2); return; }
  L.freed = 1; const E = E2(); E.trust.trade = Math.min(5, (E.trust.trade || 0) + 1); E.tradeOff = G.day + 5; INV.scrap += 25; facAdd('arc', 4, 'you brought their runner home'); E.done++;
  say([['Corin', L.cargo && !(G.flags.caches || {})[L.cargo.id] ? 'You came for me? Odile owes you. Take a share of the cargo — I’ll tell her it was the toll.' : 'You came for me. I won’t forget it — and neither will Odile.'], ['', '+25 scrap · Odile’s prices are 10% lower for five days · Odile trusts you more']]);
  e2Note('Brought Corin, Odile’s runner, home'); for (const r of E.rum) if (r.t === 'lost') r.gone = 1; e2MarksSync(); L.trader.evEnd = G.t + 15; save();
}

/* ---------- Smoke in the Hills ---------- */
const DRIFT = ['Asha', 'Brede', 'Calla', 'Dunn', 'Ivo', 'Mae', 'Orrin', 'Tess'];
SHOP_STOCK.drifter = { pool: ['rope', 'cloth', 'hide', 'dried_meat', 'berries', 'herb_med', 'arrows', 'ammo_9', 'nails', 'bandage', 'water_boiled', 'fish', 'feather', 'flint', 'leather', 'canned', 'map', 'compass'], k: 6, mark: 1.1, blurb: 'Drifters. They barter what they carry.' };
function e2SmokeCamp(x, z) {
  if (E2LIVE.smoke) return false;
  const s = e2Spot(x, z, 5, 4, 40) || { x, z }, L = { x: s.x, z: s.z, props: [], ents: [], kind: null, f: null, obs: 0, seen: 0, hail: 0, end: G.t + 1100 };
  const fr = FAC_IDS.filter(f => f !== 'arc' && !FAC[f].mute && (!FAC[f].s2 || G.flags.s2) && f !== 'grey'), r = rnd();
  if (r < .45 || !fr.length) L.kind = 'drift'; else { L.kind = 'fac'; L.f = pick(fr); }
  L.props.push(e2Fire(s.x, s.z)); L.props.push(e2Smoke(s.x, heightAt(s.x, s.z) + 1, s.z));
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + rr(-.3, .3); L.props.push(e2Tent(s.x + Math.cos(a) * 6, s.z + Math.sin(a) * 6, -a, L.kind === 'drift' ? 0x6a6a5a : 0x6a4a32)); }
  if (L.kind === 'drift') { const n = 3 + (rnd() < .5 ? 1 : 0); L.names = []; for (let i = 0; i < n; i++) { const nm = DRIFT[(i + Math.floor(G.day)) % DRIFT.length]; const e = spawnNPC('drifter', s.x + rr(-4, 4), s.z + rr(-4, 4), { model: pick(['civilian', 'settler']), yaw: rr(0, 6), h: rr(1.64, 1.82) }); e.wander = false; if (!i) { e.shop = 'drifter'; e.shopName = nm; } L.ents.push(e); L.names.push(nm); } }
  else { const K = FAC_KINDS[FAC[L.f].kind] || FAC_KINDS.clan; for (let i = 0; i < 5; i++) { const e = spawnClan(K[i % K.length], s.x + rr(-6, 6), s.z + rr(-6, 6), 'guard', facFac(L.f)); e.tribe = L.f; e.evTemp = 1; L.ents.push(e); } L.loot = cache(world, s.x - 3, s.z + 2.5, rr(0, 6), 'none', FAC[L.f].kind === 'iron' ? 'city' : 'clan', { id: 'e2_smoke_' + Math.floor(G.t), name: 'Their supplies', rolls: 2, refill: 0, noCol: 1 }); L.loot.ev = 1; L.caches = [L.loot]; }
  E2LIVE.smoke = L; E2_MARKS.push({ x: s.x, z: s.z, n: 'Smoke on the hills', ring: 0, smoke: 1 });
  return true;
}
function e2SmokeTick(dt) {
  const L = E2LIVE.smoke; if (!L) return; const d = Math.hypot(P.x - L.x, P.z - L.z);
  // watching from cover: crouched or through binoculars, 35–130 m out, for a few seconds
  if (!L.seen && d > 30 && d < 130 && (P.crouch || P.binoc)) { L.obs += dt * (P.binoc ? 1.6 : 1); if (L.obs > 4) e2SmokeSeen(); } else if (!L.seen) L.obs = Math.max(0, L.obs - dt);
  if (L.kind === 'fac' && !L.cleared && L.ents.every(e => e.dead || !ents.includes(e))) { L.cleared = 1; E2().done++; e2Note(`Cleared the new ${FAC[L.f].n} camp on the hill`); toast('The camp on the hill is yours to pick through', 2.6); }
}
function e2SmokeSeen() {
  const L = E2LIVE.smoke; if (!L || L.seen) return; L.seen = 1; const E = E2(); E.done++;
  if (L.kind === 'drift') { card('YOU WATCH THEM', `${L.ents.length} drifters — tired, armed with not much. They keep looking toward Kestrel’s smoke.`, 4.2); e2Note('Watched a drifters’ camp on the hill'); }
  else { const hos = facHostile(L.f); E.intelK = hos ? Math.max(.7, (E.intelK || 1) * .85) : E.intelK; card('YOU WATCH THEM', `${FAC[L.f].n} — ${L.ents.length} of them, ${hos ? 'scouting the valley. You learn the way they move; their next raid comes in thinner.' : 'hunting, not hunting you.'}`, 4.4); e2Note(`Watched a ${FAC[L.f].n} camp from cover${hos ? ' — learned how they move' : ''}`); }
  for (const r of E.rum) if (r.t === 'smoke') r.gone = 1; e2MarksSync(); save();
}
function e2Hail() {
  const L = E2LIVE.smoke; if (!L) return; L.hail = 1;
  if (L.kind === 'drift') {
    const S = setS(), room = housing() - S.ros.length - (S.pending || []).length;
    e2Panel('THE DRIFTERS', `<p>${L.names[0]} does the talking. They walked from the south after their camp burned. They've seen Kestrel's wall from the ridge for three days and couldn't decide whether to come.</p><p style="opacity:.8">Kestrel has ${Math.max(0, room)} free bed${room === 1 ? '' : 's'}.</p>`,
      [{ k: 'dinv', t: room >= 2 ? 'Tell them there’s room in Kestrel (two of them come)' : room === 1 ? 'Tell them there’s room for one' : 'Kestrel has no beds — build some first', dis: room < 1 }, { k: 'dtrade', t: `Trade with ${L.names[0]}` }, { k: 'dgift', t: 'Leave them food (2 canned) and go', dis: cnt('canned') < 2 }, { k: 'close', t: 'Leave them be' }]);
  } else {
    const f = L.f; if (facHostile(f)) return;
    e2Panel(`A ${FAC[f].n.toUpperCase()} CAMP`, `<p>They let you walk in. A hunting party, a long way from home — they've been watching the valley, and Kestrel.</p>`,
      [{ k: 'fgift', t: `Share what you've got (${FAC[f].want.map(nameOf).join(' or ').toLowerCase()})`, dis: !FAC[f].want.some(i => cnt(i) > 0) }, { k: 'fnews', t: 'Ask what they’ve seen' }, { k: 'close', t: 'Nod and move on' }]);
  }
}

/* ---------- A Deal Gone Wrong (Farlight) ---------- */
function e2DealCheck() {
  const E = E2(), B = BASES.find(b => b.id === 'farlight'); if (!B || E2LIVE.deal || night.active || isNight()) return;
  if (Math.hypot(P.x - B.x, P.z - B.z) > 75 || E.dealDay === G.day) return; E.dealDay = G.day;
  if (G.day - (E.dealLast || -9) < 4 || rnd() > .55 || facHostile('arc')) return;
  const bf = FAC_IDS.filter(f => f !== 'arc' && !FAC[f].mute && !facHostile(f) && f !== 'grey' && (!FAC[f].s2 || G.flags.s2)), b = bf.length ? pick(bf) : null;
  const s = e2Spot(B.x + rr(-10, 10), B.z + rr(-10, 10), 3, 4, 30); if (!s) return;
  const L = { x: s.x, z: s.z, b, ents: [], props: [], end: G.t + 400 };
  const m = spawnNPC('dealer', s.x - 3, s.z, { model: 'civilian', yaw: Math.PI / 2, h: 1.74 }); m.wander = false; L.ents.push(m);
  for (let i = 0; i < 2; i++) { if (b) { const K = FAC_KINDS[FAC[b].kind] || FAC_KINDS.clan, e = spawnClan(K[i], s.x + 3, s.z + (i - .5) * 1.6, 'guard', facFac(b)); e.tribe = b; e.evTemp = 1; e.yaw = -Math.PI / 2; L.ents.push(e); } else { const e = spawnNPC('drifter', s.x + 3, s.z + (i - .5) * 1.6, { model: 'settler', yaw: -Math.PI / 2, h: 1.72 }); e.wander = false; L.ents.push(e); } }
  const g = new THREE.Group(); for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.9, .7, .8), M(pick([0x6a5038, 0x5a6a7a])), (i - 1) * .95, .35, 0, g); mesh(new THREE.BoxGeometry(.7, .5, .6), M(0x6a5038), 0, 1, 0, g); g.position.set(s.x, heightAt(s.x, s.z), s.z); world.add(g); L.props.push(g); addCol(s.x, s.z, 1.4);
  E2LIVE.deal = L; E.dealLast = G.day;
  say([['', `Raised voices by Farlight's gate — a shipment, and two sides who both say it's theirs.`]]);
}
const e2DealWho = () => E2LIVE.deal && E2LIVE.deal.b ? `the ${FAC[E2LIVE.deal.b].n}` : 'the drifters';
function e2DealPanel() {
  const L = E2LIVE.deal; if (!L || L.done) return; const b = L.b, can = (b ? facRep(b) >= 0 : true) && facRep('arc') >= 20;
  e2Panel('A DEAL GONE WRONG', `<p>Farlight's quartermaster says ${e2DealWho()} were paid in advance and came short. ${b ? `The ${FAC[b].n}` : 'The drifters'} say the scrap was light and they've counted it twice. Hands are drifting toward weapons.</p>`,
    [{ k: 'dneg', t: can ? 'Talk them through it (everyone counts again, in front of you)' : 'Talk them through it — pay 15 scrap to cover the difference', dis: !can && INV.scrap < 15 },
     { k: 'dfar', t: 'Back Farlight' }, { k: 'dbuy', t: `Back ${e2DealWho()}` }, { k: 'dleave', t: 'Walk away' }]);
}
function e2DealChoose(k) {
  const L = E2LIVE.deal; if (!L || L.done) return; const E = E2(), b = L.b; L.done = 1; L.end = G.t + 20; E.done++;
  if (k === 'dneg') { const can = (b ? facRep(b) >= 0 : true) && facRep('arc') >= 20; if (!can) INV.scrap -= 15; facAdd('arc', 4, 'you settled the deal'); if (b) facAdd(b, 4, 'you settled the deal'); INV.scrap += 15; toast('Everyone counts again. It was both of them. They shake on it, and Farlight pays you a finder’s fee (+15 scrap)', 4); e2Note(`Settled a deal between Farlight and ${e2DealWho()}`); }
  else if (k === 'dfar') { facAdd('arc', 6, 'you backed them'); if (b) facAdd(b, -12, 'you backed Farlight'); const got = rollLoot('arc', 1); toast(`${e2DealWho().replace(/^\w/, c => c.toUpperCase())} storm off. Farlight cuts you in: ${got.slice(0, 4).join(' · ')}`, 4); e2Note(`Backed Farlight over ${e2DealWho()}`); }
  else if (k === 'dbuy') { facAdd('arc', -8, 'you backed the other side'); if (b) facAdd(b, 8, 'you backed them'); INV.scrap += 25; E.farMark = G.day + 2; toast(`${e2DealWho().replace(/^\w/, c => c.toUpperCase())} get their shipment and slip you 25 scrap. Mara will charge you more for a couple of days.`, 4); e2Note(`Backed ${e2DealWho()} against Farlight`); }
  else { E.farMark = G.day + 2; toast('Shoving, shouting, nobody gets anything. Farlight is short on stock for a couple of days.', 3.6); }
  for (const e of L.ents) if (e.type === 'clan') e.home = { x: e.x + rr(-30, 30), z: e.z + rr(-30, 30) };
  e2Close(); save();
}

/* ---------- people: personal missions, loyalty ---------- */
ITEMS.keepsake = { id: 'keepsake', n: 'Keepsake', c: 'story', t: 1, src: 'story', w: .1 }; LORE.keepsake = 'Something someone in Kestrel left behind. Take it to them.';
function e2PmOffer(R) {
  const E = E2(), hos = FAC_IDS.filter(f => f !== 'arc' && facHostile(f) && !FAC[f].mute && (!FAC[f].s2 || G.flags.s2));
  const types = ['keep', 'kin']; if (hos.length && OUTPOSTS.some(O => hos.includes(postOwner(O)))) types.push('score', 'score');
  const t = pick(types), sites = Object.keys(XSITES).filter(k => XSITES[k] && XSITES[k].name && !/tunB/.test(k)), S = XSITES[pick(sites)];
  let pm;
  if (t === 'keep') { const s = e2Spot(S.x + rr(-14, 14), S.z + rr(-14, 14), 1.2, 4, 26) || { x: S.x + 6, z: S.z + 6 }; const thing = pick(['my mother’s ring', 'a tin of photographs', 'my father’s compass', 'a child’s drawing, folded small', 'a bundle of letters']); pm = { t, x: s.x, z: s.z, thing, ask: `When we ran from ${S.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase())} I left ${thing} behind. I know it’s just a thing. Would you look?`, d: `Find ${thing} at ${S.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase())} and bring it back.` }; }
  else if (t === 'kin') { const s = e2Ring(300, 640); if (!s) return; const kin = pick(FIRST.filter(n => !setS().ros.some(r => r.n === n))), rel = pick(['brother', 'sister', 'cousin']); pm = { t, x: s.x, z: s.z, kin, rel, ask: `My ${rel} ${kin} was alive at the last camp we had, ${e2Dir(s.x, s.z)} of here. If they still are… tell them where I am.`, d: `Find ${R.n}’s ${rel} ${kin}, ${e2Dir(s.x, s.z)} of Kestrel, and send them home.` }; }
  else { const O = pick(OUTPOSTS.filter(o => hos.includes(postOwner(o)))), f = postOwner(O), nm = pick(['Vorn', 'Skarrow', 'Black Tolly', 'Hask', 'Mother Crane', 'Ditch']); pm = { t, x: O.x + rr(-8, 8), z: O.z + rr(-8, 8), f, nm, ask: `There’s one of the ${FAC[f].n} called ${nm}. ${nm} is why I’m the only one of my lot who made it here. I want them to stop being alive.`, d: `Kill ${nm} of the ${FAC[f].n} at the ${O.n.toLowerCase()}.` }; }
  E.pmSeq++; E.pm = { id: 'pm' + E.pmSeq, sid: R.id, st: 0, ...pm };
}
function e2PmSpawn() {
  const E = E2(), pm = E.pm; if (!pm || pm.st !== 1 || E2LIVE.pm) return; const L = E2LIVE.pm = { ents: [], props: [] };
  if (pm.t === 'keep' && !cnt('keepsake')) { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(.45, .3, .3), M(0x6a4a32), 0, .15, 0, g); mesh(new THREE.BoxGeometry(.47, .05, .32), M(0x8a6a42), 0, .31, 0, g); g.position.set(pm.x, heightAt(pm.x, pm.z), pm.z); world.add(g); L.props.push(g); const gl = new THREE.Mesh(new THREE.OctahedronGeometry(.05), new THREE.MeshBasicMaterial({ color: 0xffe8b0, toneMapped: false })); gl.position.set(pm.x, heightAt(pm.x, pm.z) + .55, pm.z); world.add(gl); L.props.push(gl); }
  if (pm.t === 'kin') { const e = spawnNPC('kin', pm.x, pm.z, { model: pick(['civilian', 'settler']), yaw: rr(0, 6), h: rr(1.64, 1.82) }); e.wander = false; e.kin = 1; L.ents.push(e); L.kinE = e; L.foes = spawnGroup('wolf', pm.x + 12, pm.z + 8, 3, 6, 30) || []; }
  if (pm.t === 'score') { const K = FAC_KINDS[FAC[pm.f].kind] || FAC_KINDS.clan, e = spawnClan(K.includes('brute') ? 'brute' : K[0], pm.x, pm.z, 'guard', facFac(pm.f)); e.tribe = pm.f; e.hp = e.maxhp = e.maxhp * 2.6; e.g.scale.multiplyScalar(1.12); e.name = pm.nm; e.e2score = 1; L.ents.push(e); L.boss = e; for (let i = 0; i < 2; i++) { const g = spawnClan(K[(i + 1) % K.length], pm.x + rr(-5, 5), pm.z + rr(-5, 5), 'guard', facFac(pm.f)); g.tribe = pm.f; L.ents.push(g); } }
}
function e2PmClear() { const L = E2LIVE.pm; if (!L) return; for (const e of L.ents.concat(L.foes || [])) if (e && !e.dead && ents.includes(e)) removeEnt(e); for (const p of L.props) world.remove(p); E2LIVE.pm = null; }
function e2PmTick() {
  const E = E2(), pm = E.pm; if (!pm || pm.st !== 1) return; const L = E2LIVE.pm; if (!L) return;
  if (pm.t === 'score' && L.boss && L.boss.dead) { pm.st = 2; card('IT’S DONE', `${pm.nm} won’t hurt anyone else. Tell ${e2PmName()}.`, 3.6); e2Note(`Killed ${pm.nm} for ${e2PmName()}`); save(); }
}
const e2PmName = () => { const pm = E2().pm, R = pm && setS().ros.find(r => r.id === pm.sid); return R ? R.n : 'them'; };
function e2PmDone() {
  const E = E2(), pm = E.pm, S = setS(), R = pm && S.ros.find(r => r.id === pm.sid); if (!pm) return;
  if (R) { R.loyal = G.day; R.pmDone = 1; S.morale = clamp(S.morale + 6, 0, 100); }
  if (pm.t === 'keep') take('keepsake', cnt('keepsake'));
  const line = pm.t === 'keep' ? `You found it. I didn’t think — thank you. Whatever you need, I’m with you.` : pm.t === 'kin' ? `${pm.kin} is coming? Then I owe you more than I can carry. I’m yours, for whatever you need.` : `Good. Good. I can sleep now. Anything you ask, I’ll do.`;
  say([[R ? R.n : '', line], ['', `${R ? R.n : 'They'} is loyal now: +morale, a gift in the stores each morning, and with you they watch your back (10% less damage)`]]);
  E.done++; E.pm = null; e2PmClear(); sfx('buy'); save();
}
// loyal companions watch your back
{ const oh0 = onHurt; onHurt = function (n, melee) { n = oh0(n, melee); const C = typeof compS === 'function' && compS(); if (C) { const R = setS().ros.find(r => r.id === C.id); if (R && R.loyal && compEnt()) n *= .9; } return n; }; }

/* ---------- routes: climbs, rubble, wrecks, the footbridge ---------- */
const E2_ROUTES = [];
function e2BuildRoutes() {
  const sites = Object.keys(XSITES).filter(k => XSITES[k] && XSITES[k].x != null).map(k => ({ k, ...XSITES[k] })).concat(REGIONS.filter(R => R.x != null && !R.river && !R.area && R.id !== 'kestrel' && Math.hypot(R.x, R.z) < VALLEY + 300).map(R => ({ k: R.id, x: R.x, z: R.z })));
  // climbs: a rock face with a real drop — the steepest spots round the valley, a few near somewhere worth going
  const cand = [];
  for (let k = 0; k < 1400; k++) {
    const a = rnd() * 6.283, d = rr(CAMP_R + 70, VALLEY + 420), bx = Math.cos(a) * d, bz = Math.sin(a) * d; if (!e2Free(bx, bz, 1.2, .9)) continue;
    const h0 = heightAt(bx, bz); let best = null;
    for (let j = 0; j < 10; j++) { const b2 = j / 10 * 6.283; for (let r = 5; r <= 16; r += 1.5) { const tx = bx + Math.cos(b2) * r, tz = bz + Math.sin(b2) * r, dh = heightAt(tx, tz) - h0; if (dh > 6 && dh < 28 && slopeAt(tx, tz) < 1.1 && waterAt(tx, tz) < heightAt(tx, tz) - .5 && (!best || dh / r > best.k)) best = { tx, tz, dh, k: dh / r }; } }
    if (best && best.k > .65) { let sc = best.k; for (const S of sites) if (Math.hypot(S.x - bx, S.z - bz) < 120) { sc += .4; break; } cand.push({ bx, bz, ...best, sc }); }
  }
  cand.sort((p, q) => q.sc - p.sc); let nc = 0;
  for (const c of cand) {
    if (nc >= 6) break; const bx = c.bx, bz = c.bz, best = c;
    if (E2_ROUTES.some(o => Math.hypot(o.x - bx, o.z - bz) < 180)) continue;
    let near = null, nd = 1e9; for (const S of sites) { const d = Math.hypot(S.x - bx, S.z - bz); if (d < nd) { nd = d; near = S; } }
    { const S = near || {};
      const R = { id: 'cl' + nc, kind: 'climb', x: bx, z: bz, tx: best.tx, tz: best.tz, near: S.name || S.k || 'the hills' };
      const g = new THREE.Group(), y0 = heightAt(bx, bz), y1 = heightAt(best.tx, best.tz);
      // pitons up the face, a cairn at the top, and (once rigged) the rope
      for (let i = 1; i < 6; i++) { const k2 = i / 6, px = lerp(bx, best.tx, k2), pz = lerp(bz, best.tz, k2); mesh(new THREE.BoxGeometry(.06, .06, .3), M(0x9a9a96), px, heightAt(px, pz) + .3, pz, g); }
      for (let i = 0; i < 4; i++) mesh(new THREE.DodecahedronGeometry(.32 - i * .06, 0), xm('rock'), best.tx + .6, y1 + .2 + i * .36, best.tz + .6, g);
      const pts = []; for (let i = 0; i <= 12; i++) { const k2 = i / 12, px = lerp(best.tx, bx, k2), pz = lerp(best.tz, bz, k2); pts.push(new THREE.Vector3(px, Math.max(heightAt(px, pz) + .25, lerp(y1 + 1, y0 + .1, k2)), pz)); }
      R.rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc8a060 })); R.rope.visible = false; g.add(R.rope);
      world.add(g); R.g = g;
      R.cache = cache(world, best.tx - .8, best.tz - .8, rr(0, 6), 'none', pick(['mil', 'op', 'ruin']), { id: 'e2_ledge' + nc, name: 'Climber’s cache', rolls: 1, refill: 0 });
      E2_ROUTES.push(R); nc++; }
  }
  // rubble over a cellar, a wreck over a hatch
  const ruinSites = sites.filter(S => Math.hypot(S.x, S.z) > CAMP_R + 80).sort(() => rnd() - .5); let nd = 0;
  for (const S of ruinSites) {
    if (nd >= 8) break; const s = e2Spot(S.x, S.z, 2.2, 12, 45); if (!s || E2_ROUTES.some(o => Math.hypot(o.x - s.x, o.z - s.z) < 90)) continue;
    const kind = nd % 2 ? 'wreck' : 'rubble', R = { id: 'dg' + nd, kind, x: s.x, z: s.z, near: S.name || S.k }, y = heightAt(s.x, s.z), g = new THREE.Group(), lid = new THREE.Group();
    mesh(new THREE.BoxGeometry(1.4, .08, 1.4), xm('concD'), 0, .04, 0, lid); mesh(new THREE.BoxGeometry(.9, .06, .9), xm('rust'), 0, .1, 0, lid); g.add(lid);
    const pile = new THREE.Group();
    if (kind === 'rubble') { for (let i = 0; i < 9; i++) { const r = mesh(new THREE.DodecahedronGeometry(rr(.35, .8), 0), xm(pick(['rock', 'concD', 'rockD'])), rr(-1, 1), rr(.2, .9), rr(-1, 1), pile); r.rotation.set(rr(0, 3), rr(0, 3), 0); } const bm = xbox(pile, 3, .3, .3, 'woodD', 0, .9, 0); bm.rotation.set(0, .6, .3); }
    else { const car = new THREE.Group(); xbox(car, 1.8, .9, 4, 'rust', 0, .7, 0); xbox(car, 1.6, .6, 2, 'rust', 0, 1.4, -.3); for (const [px, pz] of [[-.9, 1.3], [.9, 1.3], [-.9, -1.3]]) { const w2 = mesh(new THREE.CylinderGeometry(.36, .36, .2, 10), M(0x1a1816), px, .36, pz, car); w2.rotation.z = XHPI; } car.rotation.set(.12, rr(0, 6), .18); pile.add(car); }
    g.add(pile); g.position.set(s.x, y, s.z); world.add(g); R.pile = pile; R.col = addCol(s.x, s.z, 1.6); R.g = g;
    R.cache = cache(world, s.x, s.z, 0, 'none', pick(['ruin', 'mil', 'city']), { id: 'e2_cellar' + nd, name: kind === 'rubble' ? 'Buried cellar' : 'Hatch under the wreck', rolls: 2, refill: 0, noCol: 1 }); R.cache.g.visible = false; R.cache.y = y - 50;   // out of reach until it's open
    E2_ROUTES.push(R); nd++;
  }
  // the washed-out footbridge
  { let b = null; for (let z = -200; z <= 80; z += 6) { const rx = riverX(z), xl = rx - RIV_HW - 7, xr2 = rx + RIV_HW + 7, hl = heightAt(xl, z), hr2 = heightAt(xr2, z); if (waterAt(xl, z) > hl - .2 || waterAt(xr2, z) > hr2 - .2) continue; if (Object.values(XCROSS).some(c => c && Math.abs(c.z - z) < 90)) continue; const sc = Math.abs(hl - hr2) * 3 + Math.abs(z + 60) * .02; if (!b || sc < b.sc) b = { z, xl, xr: xr2, hl, hr: hr2, sc }; }
    if (b) { const R = { id: 'br0', kind: 'bridge', ...b, x: b.xl, z: b.z, x2: b.xr }, g = new THREE.Group(); world.add(g); R.g = g;
      for (const [x, yy, s] of [[b.xl, b.hl, 1], [b.xr, b.hr, -1]]) { for (const sz of [-1, 1]) { xbox(g, .22, 1.9, .22, 'woodD', x, yy + .5, b.z + sz * .95); addCol(x, b.z + sz * .95, .2); } for (let k = 0; k < 4; k++) { const p = xbox(g, .4, .08, 1.7, 'wood', x + s * (k * .5 + .3), yy + .38 - k * .06, b.z); p.rotation.z = s * (k * .08); } }
      R.deck = new THREE.Group(); g.add(R.deck); R.deck.visible = false; E2_ROUTES.push(R); }
  }
  REGIONS.push(...E2_ROUTES.filter(R => R.kind === 'bridge').map(R => ({ id: 'e2_bridge', name: 'THE WASHED-OUT CROSSING', sub: 'A footbridge the Coldwater took. Planks, rope and nails would put it back', x: (R.xl + R.xr) / 2, z: R.z, r: 22 })));
}
function e2RouteSync() {
  const E = E2();
  for (const R of E2_ROUTES) {
    if (R.kind === 'climb') R.rope.visible = !!E.rope[R.id];
    if (R.kind === 'rubble' || R.kind === 'wreck') { const open = !!E.dug[R.id]; R.pile.visible = !open; R.col.r = open ? -99 : 1.6; R.cache.g.visible = open; R.cache.y = open ? heightAt(R.x, R.z) : heightAt(R.x, R.z) - 50; if (open && R.kind === 'wreck') { R.pile.visible = true; R.pile.position.set(2.6, 0, 1.2); R.pile.rotation.y = .9; } else R.pile.position.set(0, 0, 0); }
    if (R.kind === 'bridge' && E.br[R.id] && !R.built) e2BridgeBuild(R);
  }
}
function e2BridgeBuild(R) {
  R.built = 1; R.deck.visible = true; const y0 = R.hl + .4, y1 = R.hr + .4, len = R.xr - R.xl, sl = (y1 - y0) / len;
  for (let k = 0; k < len / .5; k++) { const x = R.xl + k * .5 + .25; const p = xbox(R.deck, .44, .1, 1.8, k % 7 ? 'wood' : 'woodD', x, y0 + (x - R.xl) * sl, R.z); p.rotation.z = rr(-.02, .02); }
  for (const s of [-1, 1]) { xbox(R.deck, len, .1, .1, 'woodD', (R.xl + R.xr) / 2, (y0 + y1) / 2 + 1, R.z + s * .95).rotation.z = Math.atan(sl); for (let k = 2; k < len - 1; k += 3) xbox(R.deck, .1, 1, .1, 'woodD', R.xl + k, y0 + k * sl + .5, R.z + s * .95); }
  FLOORS.push({ cx: (R.xl + R.xr) / 2, cz: R.z, c: 1, s: 0, hw: len / 2 + .05, hd: .9, y: (y0 + y1) / 2 + .05, slope: sl });
  addColLine(R.xl + 1, R.z + 1.05, R.xr - 1, R.z + 1.05, .12); addColLine(R.xl + 1, R.z - 1.05, R.xr - 1, R.z - 1.05, .12);
}
function e2ClimbGo(R, up) {
  const E = E2(), gear = bestTool('climb');
  if (!E.rope[R.id] && !gear) { if (cnt('rope') >= 2) { take('rope', 2); E.rope[R.id] = 1; e2RouteSync(); sfx('metal'); toast('You rig a rope up the face. It stays — anyone can use it now', 3); E.done++; e2Note('Rigged a rope up a rock face'); save(); return; } sfx('no'); toast('You need climbing gear — or 2 rope to rig it for good', 2.6); return; }
  startChan({ l: up ? 'Climbing' : 'Climbing down', t: E.rope[R.id] ? 1.2 : 2.2, fn: () => { if (!E.rope[R.id] && gear) gear.d = Math.max(1, gear.d - 4); const x = up ? R.tx : R.x, z = up ? R.tz : R.z; cityGo(x + (up ? -1.5 : 1.2) * Math.sign(R.x - R.tx || 1), z + (up ? -1.5 : 1.2) * Math.sign(R.z - R.tz || 1), heightAt(x, z) + .1, false, up ? 'Up top' : ''); if (up && !(G.flags.seen || {})['e2_' + R.id]) { (G.flags.seen ||= {})['e2_' + R.id] = 1; E.done++; e2Note('Climbed a rock face to a ledge'); save(); } } });
}
function e2DigGo(R) {
  const E = E2(); if (E.dug[R.id]) return;
  if (R.kind === 'rubble') { const t = bestTool('pick') || bestTool('shovel'); if (!t) { sfx('no'); toast('You need a pickaxe or a shovel to dig this out', 2.6); return; }
    startChan({ l: 'Digging out the rubble', t: 4, fn: () => { t.d = Math.max(1, t.d - 5); E.dug[R.id] = 1; e2RouteSync(); sfx('metal'); toast('Under the rubble: a cellar door', 2.6); E.done++; e2Note(`Dug out a buried cellar near ${R.near.toLowerCase ? R.near.toLowerCase() : R.near}`); save(); } }); }
  else { const t = bestTool('pry'), C = typeof compEnt === 'function' && compEnt(), withC = C && Math.hypot(C.x - P.x, C.z - P.z) < 12; if (!t && !withC) { sfx('no'); toast('Too heavy to shift alone — a crowbar, or someone to lift with you', 2.6); return; }
    startChan({ l: withC && !t ? `Lifting it with ${C.shopName || 'your companion'}` : 'Levering the wreck over', t: 3, fn: () => { if (t) t.d = Math.max(1, t.d - 5); E.dug[R.id] = 1; e2RouteSync(); sfx('metal'); toast('The wreck rolls off a hatch', 2.6); E.done++; e2Note('Shifted a wreck off a hatch'); save(); } }); }
}
function e2BridgeGo(R) {
  const E = E2(); if (E.br[R.id]) return; const need = { plank: 8, rope: 2, nails: 10 }, miss = Object.entries(need).filter(([k, n]) => cnt(k) < n);
  if (!has('hammer')) { sfx('no'); toast('You need a hammer — and 8 planks, 2 rope, 10 nails', 2.8); return; }
  if (miss.length) { sfx('no'); toast(`Still need ${miss.map(([k, n]) => `${n - cnt(k)} ${nameOf(k).toLowerCase()}`).join(', ')}`, 2.8); return; }
  startChan({ l: 'Laying the planks', t: 5, fn: () => { for (const [k, n] of Object.entries(need)) take(k, n); E.br[R.id] = 1; e2RouteSync(); sfx('buy'); card('THE CROSSING', 'The footbridge is back. A short way over the Coldwater.', 3.4); setS().morale = clamp(setS().morale + 3, 0, 100); E.done++; e2Note('Rebuilt the footbridge over the Coldwater'); save(); } });
}
const e2NearRoute = () => { for (const R of E2_ROUTES) { const ends = R.kind === 'climb' ? [[R.x, R.z, 1], [R.tx, R.tz, 0]] : R.kind === 'bridge' ? [[R.xl, R.z, 1], [R.xr, R.z, 1]] : [[R.x, R.z, 1]]; for (const [x, z, up] of ends) if (Math.hypot(x - P.x, z - P.z) < 3) return { R, x, z, up }; } return null; };
function e2RouteLabel(n) {
  const E = E2(), R = n.R;
  if (R.kind === 'climb') { if (!n.up) return E.rope[R.id] || bestTool('climb') ? 'Climb down the face' : null; return E.rope[R.id] ? 'Climb the rope' : bestTool('climb') ? 'Climb the rock face (climbing gear)' : `A climbable face · rig it with 2 rope (you have ${cnt('rope')}) or bring climbing gear`; }
  if (R.kind === 'rubble') return E.dug[R.id] ? null : 'Rubble over a cellar door · dig it out (pickaxe or shovel)';
  if (R.kind === 'wreck') return E.dug[R.id] ? null : 'A wreck over a hatch · lever it off (crowbar, or lift with a companion)';
  if (R.kind === 'bridge') return E.br[R.id] ? null : `Rebuild the footbridge · 8 planks, 2 rope, 10 nails, a hammer (you have ${cnt('plank')}/${cnt('rope')}/${cnt('nails')})`;
}

/* ---------- camp upgrades that open things up ---------- */
PROJECTS.lookout = { n: 'Lookout post', d: 'An extra rumor every morning; the scouts warn of every raid, and earlier', cost: { log: 14, rope: 4, nails: 12 }, w: 3 }; PROJ_IDS.push('lookout');
PROJECTS.market = { n: 'Market square', d: 'A travelling trader sets up in Kestrel every third day; contracts pay a quarter more', cost: { log: 12, cloth: 8, scrap: 30 }, w: 3 }; PROJ_IDS.push('market');
const E2_PLOTS = {}, E2_PG = {};
function e2Plots() {
  const take = (tx, tz) => { for (let k = 0; k < 80; k++) { const a = rnd() * 6.283, d = k ? rr(4, 26) : 0, x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d; if (Math.hypot(x, z) < CAMP_R + 10 || pathDist(x, z) < 6 || XPLOTS.some(p => Math.hypot(p.x - x, p.z - z) < 16) || Math.hypot(x, z - (CAMP_R + 34)) < 26) continue; if (e2Free(x, z, 6)) return { x, z }; } return { x: tx, z: tz }; };
  E2_PLOTS.lookout = take(-72, 46); E2_PLOTS.market = take(70, 50);
}
{ const bp0 = buildProject; buildProject = function (id, stage) {
  if (id !== 'lookout' && id !== 'market') return bp0(id, stage);
  if (E2_PG[id]) { world.remove(E2_PG[id]); E2_PG[id] = null; } if (!stage) return; const Pl = E2_PLOTS[id]; if (!Pl) return;
  const g = new THREE.Group(), yaw = Math.atan2(-Pl.x, -Pl.z); g.position.set(Pl.x, xLowest(Pl.x, Pl.z, 6, 6, yaw), Pl.z); g.rotation.y = yaw; world.add(g); E2_PG[id] = g;
  if (stage === 1) { for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) xbox(g, .2, 3, .2, 'wood', x, 1.5, z); for (let i = 0; i < 5; i++) xbox(g, 3, .25, .25, 'wood', 3.6, .2 + i * .26, -1 + (i % 2) * .3); return; }
  if (id === 'lookout') { g.add(mesh(lattice(3, 10, 0x5a4430, 2.4), VCOL)); xbox(g, 3.8, .2, 3.8, 'woodD', 0, 10, 0); for (const k of [[0, 1.8], [0, -1.8], [1.8, 0], [-1.8, 0]]) xbox(g, k[0] ? .1 : 3.8, 1, k[0] ? 3.8 : .1, 'wood', k[0], 10.5, k[1]); for (const s of [-1, 1]) { const r = xbox(g, 4.4, .1, 2.4, 'rust', 0, 12.2, s * 1.1); r.rotation.x = s * .3; } xbox(g, .1, 2, .1, 'woodD', 1.7, 11.4, 1.7); const fl = mesh(new THREE.PlaneGeometry(1, .6), new THREE.MeshLambertMaterial({ color: 0xf0a640, side: THREE.DoubleSide }), 2.2, 13, 1.7, g); if (typeof GATEFLAGS !== 'undefined') { GATEFLAGS.push(fl); fl.material.color.set(kColor()); } addCol(Pl.x, Pl.z, 2); }
  else { for (let i = 0; i < 3; i++) { const sx = (i - 1) * 4.2, st = new THREE.Group(); for (const [x, z] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) xbox(st, .14, 2.4, .14, 'woodD', x, 1.2, z); xbox(st, 3, .1, 2.4, 'wood', 0, .9, 0); const aw = mesh(new THREE.PlaneGeometry(3.2, 2.6), new THREE.MeshLambertMaterial({ color: pick([0x8a3a2a, 0x3a5a8a, 0xb89a50, 0x4a6a3a]), side: THREE.DoubleSide }), 0, 2.45, 0, st); aw.rotation.x = -XHPI + .2; for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(.4, .3, .35), M(pick([0x6a5038, 0x5a6a7a, 0x8a7a5a])), -1 + k * .66, 1.1, rr(-.6, .6), st); st.position.set(sx, 0, 0); g.add(st); const [cx, cz] = xFrame(Pl.x, Pl.z, yaw)(sx, 0); addCol(cx, cz, 1.4); } }
}; }
function e2Hob() {
  const H = E2LIVE.hob; if (H) { removeEnt(H); E2LIVE.hob = null; }
  if (!projDone('market') || G.day % 3) return; const Pl = E2_PLOTS.market; if (!Pl) return;
  const [x, z] = xFrame(Pl.x, Pl.z, Math.atan2(-Pl.x, -Pl.z))(0, 2.6);
  const e = spawnNPC('merchant', x, z, { model: 'civilian', yaw: Math.atan2(-Pl.x, -Pl.z) + Math.PI, h: 1.74 }); e.shop = 'merchant'; e.shopName = 'Old Hob'; e.wander = false; E2LIVE.hob = e;
}

/* ---------- traders: shortages, deals, wants, contracts, trust ---------- */
function e2DealFor(key) {
  const E = E2(); if (E.deal[key]) return E.deal[key]; const D = SHOP_STOCK[key]; if (!D || D.settler || key === 'drifter') return null;
  const list = (G.flags.trades || {})[key]?.list || [], pool = D.pool.filter(id => ITEMS[id] && !GEAR_DEFS[id]);
  const wantPool = (CON_WANT[key] || []).map(x => x[0]).filter(id => ITEMS[id]).concat(pool).filter((v, i, a) => a.indexOf(v) === i);
  const want = []; while (want.length < 2 && wantPool.length) want.push(wantPool.splice(Math.floor(rnd() * Math.min(wantPool.length, 8)), 1)[0]);
  const inList = list.map(r => r[0]).filter(id => !GEAR_DEFS[id] && !want.includes(id));
  const short = inList.length ? pick(inList) : null, rest = inList.filter(i => i !== short);
  return E.deal[key] = { want, short, cheap: rest.length ? pick(rest) : null };
}
{ const ts0 = tradeStock; tradeStock = function () {
  const key = curShopE?.shop || 'mara', L = ts0(), E = E2(); const D = e2DealFor(key);
  // a blueprint, now and then, for those who trust you
  const TT = G.flags.trades[key]; if (TT && !TT.bpTry && ['salvage', 'guns', 'craft', 'mara', 'merchant'].includes(key)) { TT.bpTry = 1; if ((E.trust[key] || 0) >= 3 || key === 'merchant' ? rnd() < .4 : rnd() < .06) { const bp = Object.keys(BLUEPRINTS).filter(id => !bpKnown(id) && !cnt(id)); if (bp.length) L.push([pick(bp), 1, 1]); } }
  return L; }; }
TRADE_HOOK.buy = (key, id) => { const E = E2(), D = E.deal[key]; let m = 1; if (BLUEPRINTS[id]) m *= 4; if (D) { if (D.short === id) m *= 1.5; if (D.cheap === id) m *= .7; } m *= 1 - Math.min(.15, (E.trust[key] || 0) * .03); if (key === 'trade' && E.tradeOff >= G.day) m *= .9; if (key === 'mara' && E.farMark >= G.day) m *= 1.2; return m; };
TRADE_HOOK.sell = (key, id) => { const D = E2().deal[key]; return D && D.want.includes(id) ? 2 : 1; };
TRADE_HOOK.tag = (key, id) => { const D = E2().deal[key]; if (!D) return ''; return D.short === id ? '<small style="color:#e0573d;display:block">short · +50%</small>' : D.cheap === id ? '<small style="color:#7fc4b8;display:block">deal · −30%</small>' : BLUEPRINTS[id] ? '<small style="color:#c8a0e0;display:block">rare</small>' : ''; };
TRADE_HOOK.stag = (key, id) => { const D = E2().deal[key]; return D && D.want.includes(id) ? '<small style="color:#e8c070;display:block">wanted · ×2</small>' : ''; };
TRADE_HOOK.head = key => {
  const E = E2(), C = E.con[key], D = e2DealFor(key), tr = E.trust[key] || 0; let h = '';
  if (D && D.want.length) h += `<p class="dim">${KEEPER_N[key] || 'They'} pays double today for ${D.want.map(i => nameOf(i).toLowerCase()).join(' and ')}.${tr ? ` Trust ${tr}/5 · ${Math.min(15, tr * 3)}% off.` : ''}</p>`;
  if (C) { const have = cnt(C.it), rw = Math.ceil(C.rw * (projDone('market') ? 1.25 : 1)); h += `<div style="padding:6px 8px;border:1px solid #fff2;border-left:4px solid #e8c070;border-radius:3px;background:#0002;margin:4px 0"><b>Contract</b> <small style="opacity:.8">${C.n} × ${nameOf(C.it).toLowerCase()} by day ${C.until} → ${rw} scrap and ${KEEPER_N[key] || 'their'}’s trust · you have ${have}</small> <button data-e2="con" data-v="${key}"${have >= C.n ? '' : ' class="dis"'}>Hand in</button></div>`; }
  return h;
};
function e2Contract(key) {
  const E = E2(), C = E.con[key]; if (!C) return; if (cnt(C.it) < C.n) { sfx('no'); return; }
  take(C.it, C.n); const rw = Math.ceil(C.rw * (projDone('market') ? 1.25 : 1)); INV.scrap += rw; E.trust[key] = Math.min(5, (E.trust[key] || 0) + 1); delete E.con[key]; E.done++;
  card('CONTRACT DONE', `+${rw} scrap · ${KEEPER_N[key] || 'they'} trust you ${E.trust[key]}/5`, 3); e2Note(`Filled ${KEEPER_N[key] || 'a trader'}’s contract`); sfx('buy'); save();
}

/* ---------- the expedition report ---------- */
let e2Trip = null, e2RepEl = null;
function e2Snap() {
  const it = { scrap: INV.scrap, ...INV.items }; for (const t of INV.tools) it['g:' + t.id] = (it['g:' + t.id] || 0) + 1;
  const rep = {}; for (const f of FAC_IDS) rep[f] = Math.round(facRep(f));
  return { t: G.t, seen: { ...(G.flags.seen || {}) }, logs: Object.keys(G.flags.logs || {}).length, caches: Object.keys(G.flags.caches || {}).length, it, rep, posts: OUTPOSTS.filter(O => postOwner(O) === 'kestrel').length, notes: E2().notes.length, bp: Object.keys(G.flags.bp || {}).length, saved: setS().saved + (setS().pending || []).length, done: E2().done };
}
function e2TripTick() {
  const out = Math.hypot(P.x, P.z) > CAMP_R + 14 || !!UG.at;
  if (out && !e2Trip && !P.dead) e2Trip = e2Snap();
  if (!out && e2Trip) { const A = e2Trip; e2Trip = null; if (G.t - A.t > 100 && !night.active && !P.dead) e2Report(A, e2Snap()); }
}
function e2Report(A, B) {
  const disc = [], gain = [], chg = [];
  const newSeen = Object.keys(B.seen).filter(k => !A.seen[k]); const nm = k => { const R = REGIONS.find(r => r.id === k); if (R) return R.name.split(' · ')[0].toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()); if (k.startsWith('pk_') && POCKETS[k.slice(3)]) return POCKETS[k.slice(3)].name.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()); return null; };
  const places = newSeen.map(nm).filter(Boolean); if (places.length) disc.push(places.slice(0, 4).join(', ') + (places.length > 4 ? ` and ${places.length - 4} more` : ''));
  if (B.logs > A.logs) disc.push(`${B.logs - A.logs} record${B.logs - A.logs > 1 ? 's' : ''} for the Journal`);
  if (B.caches > A.caches) disc.push(`${B.caches - A.caches} stash${B.caches - A.caches > 1 ? 'es' : ''} opened`);
  if (B.bp > A.bp) disc.push(`${B.bp - A.bp} blueprint${B.bp - A.bp > 1 ? 's' : ''} learned`);
  const ds = B.it.scrap - A.it.scrap; if (ds > 0) gain.push(`+${ds} scrap`);
  const dl = Object.keys(B.it).filter(k => k !== 'scrap' && (B.it[k] || 0) > (A.it[k] || 0)).map(k => [k, B.it[k] - (A.it[k] || 0)]).sort((a, b) => valueOf(b[0].replace('g:', '')) * b[1] - valueOf(a[0].replace('g:', '')) * a[1]);
  for (const [k, n] of dl.slice(0, 5)) gain.push(`${n > 1 ? n + ' ' : ''}${(GEAR_DEFS[k.replace('g:', '')]?.n || nameOf(k)).toLowerCase()}`);
  for (const f of FAC_IDS) { const d = B.rep[f] - A.rep[f]; if (Math.abs(d) >= 3) chg.push(`${FAC[f].n} ${d > 0 ? '+' : ''}${d}`); }
  if (B.posts > A.posts) chg.push(`${B.posts - A.posts} outpost${B.posts - A.posts > 1 ? 's' : ''} now fly Kestrel’s colours`);
  if (B.saved > A.saved) chg.push(`${B.saved - A.saved} more ${B.saved - A.saved > 1 ? 'people are' : 'person is'} coming to Kestrel`);
  let home = null; for (const s of E2().notes.slice(A.notes)) { if (s.startsWith('HOME:')) home = s.slice(5); else chg.push(s); }
  E2().notes = E2().notes.filter(s => !s.startsWith('HOME:'));
  const line = (h, L, none) => `<p style="margin:4px 0"><b style="color:#f0a640">${h}</b> ${L.length ? L.join(' · ') : `<span style="opacity:.6">${none}</span>`}</p>`;
  if (!disc.length && !gain.length && !chg.length) return;
  if (!e2RepEl) { e2RepEl = document.createElement('div'); e2RepEl.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:60;width:min(560px,92vw);background:#14110ee8;border:1px solid #f0a64066;border-radius:6px;padding:12px 16px;color:#efe9dc;font:14px/1.45 Georgia,serif;transition:opacity .4s;cursor:pointer'; e2RepEl.addEventListener('click', () => { e2RepEl.style.opacity = 0; setTimeout(() => e2RepEl.style.display = 'none', 400); }); document.body.appendChild(e2RepEl); }
  e2RepEl.innerHTML = `<div style="font:700 18px 'Barlow Condensed',sans-serif;letter-spacing:.06em;margin-bottom:4px">BACK IN KESTREL · ${Math.round((G.t - A.t) / 60)} MIN OUT</div>${line('Discovered', disc, 'nothing new')}${line('Gained', gain, 'nothing to show')}${line('Changed', chg, 'the world didn’t notice')}${home ? line('Homecoming', [home], '') : ''}<div style="opacity:.5;font-size:12px;margin-top:4px">tap to close</div>`;
  e2RepEl.style.display = 'block'; e2RepEl.style.opacity = 1; clearTimeout(e2RepEl._t); e2RepEl._t = setTimeout(() => { e2RepEl.style.opacity = 0; setTimeout(() => e2RepEl.style.display = 'none', 400); }, 14000);
}

/* ---------- the event pool (2k-events.js picks by weight) ---------- */
EVENTS.lostTrader = { cd: 1400, w: () => 1 + (E2().trust.trade || 0 ? 0 : .5), ok: () => !E2LIVE.lost && G.day >= 2, go() { const s = evSpotAhead(110, 170, rr(-.8, .8)); if (!s || !e2Lost(s.x, s.z)) return false; toast('A wagon on its side by the road ahead. Nobody with it.', 3.4); return true; } };
EVENTS.hillSmoke = { cd: 1500, w: () => 1 + Math.max(0, (60 - exploredPct()) / 40), ok: () => !E2LIVE.smoke && G.day >= 3, go() { let b = null; for (let k = 0; k < 16; k++) { const s = evSpotAhead(180, 300, rr(-1.4, 1.4)); if (!s) continue; const h = heightAt(s.x, s.z); if (!b || h > b.h) b = { ...s, h }; } if (!b || !e2SmokeCamp(b.x, b.z)) return false; toast('Smoke rising off a ridge — someone new has moved in. Watch from cover, or walk in.', 4); return true; } };

/* ---------- interactions ---------- */
const E2INTERACT = [
  { id: 'e2route', at: () => e2NearRoute(), r: 3, label: () => e2RouteLabel(e2NearRoute()), act: () => { const n = e2NearRoute(); if (!n) return; const R = n.R; if (R.kind === 'climb') e2ClimbGo(R, n.up); else if (R.kind === 'bridge') e2BridgeGo(R); else e2DigGo(R); } },
  { id: 'e2corin', at: () => { const L = E2LIVE.lost; return L && !L.freed && L.trader && !L.trader.dead ? L.trader : null; }, r: 2.6, label: () => e2LostClear() ? 'Cut Corin loose' : 'Corin is tied up · deal with his captors first', act: () => e2LostFree() },
  { id: 'e2hail', at: () => { const L = E2LIVE.smoke; return L && !L.hail && !(L.kind === 'fac' && facHostile(L.f)) ? L : null; }, r: 12, label: () => 'Hail the camp', act: () => e2Hail() },
  { id: 'e2deal', at: () => { const L = E2LIVE.deal; return L && !L.done ? L : null; }, r: 6, label: () => 'Step into the argument', act: () => e2DealPanel() },
  { id: 'e2keep', at: () => { const pm = E2().pm; return pm && pm.st === 1 && pm.t === 'keep' && !cnt('keepsake') && E2LIVE.pm ? pm : null; }, r: 2.4, label: () => `Pick up ${E2().pm.thing}`, act: () => { give('keepsake', 1); const pm = E2().pm; pm.st = 2; for (const p of E2LIVE.pm.props) world.remove(p); E2LIVE.pm.props = []; sfx('pickup'); toast(`Found ${pm.thing}. Take it back to ${e2PmName()}.`, 3); e2Note(`Found ${pm.thing} for ${e2PmName()}`); save(); } },
  { id: 'e2kin', at: () => { const pm = E2().pm, L = E2LIVE.pm; return pm && pm.st === 1 && pm.t === 'kin' && L && L.kinE && !L.kinE.dead ? L.kinE : null; }, r: 2.8, label: () => (E2LIVE.pm.foes || []).some(f => !f.dead && ents.includes(f) && Math.hypot(f.x - P.x, f.z - P.z) < 30) ? 'Clear the wolves first' : `Tell ${E2().pm.kin} that ${e2PmName()} is in Kestrel`, act: () => { const L = E2LIVE.pm, pm = E2().pm; if ((L.foes || []).some(f => !f.dead && ents.includes(f) && Math.hypot(f.x - P.x, f.z - P.z) < 30)) return; (setS().pending ||= []).push({ n: pm.kin, trait: pick(TRAITS)[0] }); pm.st = 2; say([[pm.kin, `${e2PmName()}? Alive? I’ll go tonight. Tell them I’m coming.`]]); e2Note(`Found ${pm.kin}, ${e2PmName()}’s ${pm.rel} — on their way to Kestrel`); L.kinE.evEnd = 1; setTimeout(() => { if (L.kinE && ents.includes(L.kinE)) removeEnt(L.kinE); }, 8000); save(); } },
  { id: 'e2pmback', at: () => { const pm = E2().pm; if (!pm || pm.st !== 2) return null; const R = setS().ros.find(r => r.id === pm.sid), e = R && survEnt(R); return e && (pm.t !== 'keep' || cnt('keepsake')) ? e : null; }, r: 2.8, label: () => `Tell ${e2PmName()}`, act: () => e2PmDone() },
];

/* ---------- the click handler (panel + Journal + Trade) ---------- */
function e2Action(d) {
  const k = d.e2, E = E2(), L = E2LIVE.smoke;
  if (k === 'close') return e2Close();
  if (k === 'fort' || k === 'icpt' || k === 'nego') { e2WarnChoose(k); if (e2Open()) e2Close(); if (invOpen) renderInv(); return; }
  if (k === 'pmyes') { if (E.pm) { E.pm.st = 1; e2PmSpawn(); toast('It’s on your map', 2.2); save(); } if (e2Open()) e2Close(); if (invOpen) renderInv(); return; }
  if (k === 'pmno') { if (E.pm) { const R = setS().ros.find(r => r.id === E.pm.sid); if (R) R.pmDone = 0; E.pm = null; } if (e2Open()) e2Close(); if (invOpen) renderInv(); return; }
  if (k === 'con') { e2Contract(d.v); if (invOpen) renderInv(); return; }
  if (k.startsWith('d') && ['dneg', 'dfar', 'dbuy', 'dleave'].includes(k)) return e2DealChoose(k);
  if (L && k === 'dinv') { const S = setS(), room = housing() - S.ros.length - (S.pending || []).length, n = Math.min(2, room); if (n < 1) return; for (let i = 0; i < n; i++) (S.pending ||= []).push({ n: L.names[i + 1] || L.names[0], trait: pick(TRAITS)[0] }); E.done++; e2Note(`Invited ${n} drifter${n > 1 ? 's' : ''} to Kestrel`); for (let i = 1; i <= n; i++) if (L.ents[i]) L.ents[i].g.visible = false; say([[L.names[0], n > 1 ? 'They’ll go tomorrow. I’ll keep the fire here a while longer.' : 'One of us will come. That’s more than we had this morning.']]); e2Close(); save(); return; }
  if (L && k === 'dtrade') { e2Close(); openTrade(L.ents[0]); return; }
  if (L && k === 'dgift') { take('canned', 2); setS().morale = clamp(setS().morale + 2, 0, 100); INV.scrap += 0; say([[L.names[0], 'We won’t forget Kestrel was kind.']]); e2Note('Left food for the drifters'); E.done++; e2Close(); save(); return; }
  if (L && k === 'fgift') { const it = FAC[L.f].want.find(i => cnt(i) > 0); if (it) { take(it, 1); facAdd(L.f, 6, 'you shared with their hunters'); } e2Close(); return; }
  if (L && k === 'fnews') { e2Close(); const un = REGIONS.filter(R => R.x != null && !R.river && !R.area && !(G.flags.seen || {})[R.id]); const R = un.length ? pick(un) : null; if (R) { E.rum.push({ t: 'place', txt: `${FAC[L.f].n} hunters told you about ${R.name.toLowerCase().replace(/(^|[\s·])\w/g, c => c.toUpperCase())}, ${e2Dir(R.x - L.x, R.z - L.z)} of their camp.`, x: R.x, z: R.z, n: R.name.split(' · ')[0], ring: 50 }); e2MarksSync(); } say([[FAC[L.f].leader[0].split(' ')[0] === 'Old' ? 'Hunter' : 'Hunter', R ? `There's a place ${e2Dir(R.x - L.x, R.z - L.z)} of here — ${R.name.toLowerCase()}. We don't go near it. You might.` : 'Nothing you haven\'t seen.']]); L.hail = 1; return; }
}

/* ---------- map marks ---------- */
{ const dm0 = drawSideMarks; drawSideMarks = function (g, S, k) { dm0(g, S, k);
  const dot = (x, z, n, col, ring) => { const [X, Y] = toMap(x, z, S); g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.2 * k; if (ring) { g.save(); g.setLineDash([3 * k, 3 * k]); g.strokeStyle = col; g.lineWidth = 1.4 * k; g.beginPath(); g.arc(X, Y, ring / MAPR * S / 2, 0, 7); g.stroke(); g.restore(); } else { g.beginPath(); g.arc(X, Y, 4 * k, 0, 7); g.fill(); g.stroke(); } g.fillStyle = '#000a'; g.fillText(n, X + k, Y - 7 * k); g.fillStyle = col; g.fillText(n, X, Y - 8 * k); };
  for (const m of E2_MARKS) dot(m.x, m.z, m.n, m.icpt ? '#e0573d' : '#d8b0ff', m.ring);
  const pm = E2().pm; if (pm && pm.st === 1) dot(pm.x, pm.z, pm.t === 'keep' ? 'The keepsake' : pm.t === 'kin' ? pm.kin : pm.nm, '#c8a0e0', 0);
  const E = E2(); for (const R of E2_ROUTES) if ((G.flags.seen || {})['e2r_' + R.id]) { const [X, Y] = toMap(R.x, R.z, S); g.fillStyle = R.kind === 'climb' ? (E.rope[R.id] ? '#c8a060' : '#8a7a5a') : R.kind === 'bridge' ? (E.br[R.id] ? '#c8a060' : '#8a7a5a') : E.dug[R.id] ? '#8a8a8a' : '#c8a060'; g.fillRect(X - 2 * k, Y - 2 * k, 4 * k, 4 * k); }
}; }

/* ---------- setup, restore, each frame ---------- */
function buildEveryday() { const s0 = seed; seed = 4242424; e2BuildRoutes(); e2Plots(); seed = s0;
  window.__E2 = { E2, E2LIVE, E2_ROUTES, E2_PLOTS, e2Day, e2Rumors, e2Morning, e2Lost, e2SmokeCamp, e2SmokeSeen, e2Hail, e2DealPanel, e2DealCheck, e2WarnCheck, e2WarnChoose, e2PmOffer, e2PmSpawn, e2Report, e2Snap, todayHTML, e2Contract, e2Hob, e2RouteSync, force: { warn() { E2().warnDay = -1; G.tod = .6; e2WarnCheck(); return E2().tn; }, deal() { E2().dealDay = -1; E2().dealLast = -9; const B = BASES.find(b => b.id === 'farlight'); P.x = B.x + 30; P.z = B.z; e2DealCheck(); return !!E2LIVE.deal; } } };
}
function everydayRestore() {
  for (const k of ['lost', 'smoke', 'deal']) { const L = E2LIVE[k]; if (L) { for (const e of (L.ents || []).concat(L.foes || [], L.trader ? [L.trader] : [])) if (e && !e.dead && ents.includes(e)) removeEnt(e); for (const p of L.props || []) world.remove(p); for (const C of L.caches || []) e2DropCache(C); E2LIVE[k] = null; } }
  e2ClearIcpt(); e2PmClear(); E2_MARKS.length = 0; e2Trip = null;
  const E = E2(); e2LastDay = E.day; e2MarksSync(); e2RouteSync(); e2Hob();
  if (E.pm && E.pm.st === 1) e2PmSpawn();
  if (E.tn && E.tn.choice === 'icpt' && !E.tn.done) E.tn.choice = null;   // the war party scattered while you were away
}
let e2T = 0;
function updEveryday(dt) {
  if (G.mode !== 'play') return;
  for (const k of ['lost', 'smoke']) { const L = E2LIVE[k]; if (L) for (const p of L.props) p.userData.tick?.(G.t); }
  if (E2LIVE.icpt) for (const p of E2LIVE.icpt.props) p.userData.tick?.(G.t);
  e2SmokeTick(dt);
  e2T -= dt; if (e2T > 0) return; e2T = .5;
  if (G.day !== e2LastDay) e2Day(e2LastDay < 0);
  e2TripTick(); e2WarnCheck(); e2DealCheck(); e2PmTick();
  const E = E2();
  // rumors that seed an event: it's there when you get close
  if (E.lostAt && !E2LIVE.lost && E.lostAt.day >= G.day - 1 && Math.hypot(P.x - E.lostAt.x, P.z - E.lostAt.z) < 240) { const s = e2Spot(E.lostAt.x, E.lostAt.z, 3, 0, 40); if (s && e2Lost(s.x, s.z)) E.lostAt = null; }
  if (E.smokeAt && !E2LIVE.smoke && E.smokeAt.day >= G.day - 1 && Math.hypot(P.x - E.smokeAt.x, P.z - E.smokeAt.z) < 320) { if (e2SmokeCamp(E.smokeAt.x, E.smokeAt.z)) E.smokeAt = null; }
  // the intercept
  const I = E2LIVE.icpt; if (I && !I.won && I.ents.every(e => e.dead || !ents.includes(e))) { I.won = 1; E.done++; card('WAR PARTY BROKEN', `Whatever the ${FAC[I.f].n} send tonight, it'll be the dregs`, 3.6); e2Note(`Broke a ${FAC[I.f].n} war party before it reached the wall`); give('ammo_556', 20); const pc = cache(world, I.x + 2, I.z + 2, 0, 'none', FAC[I.f].kind === 'iron' ? 'city' : 'clan', { id: 'e2_icpt_' + G.day, name: 'The war party’s packs', rolls: 2, refill: 0, noCol: 1 }); pc.ev = 1; (I.caches ||= []).push(pc); save(); }
  if (night.active && E.tn) E.tn.done = 1;
  // routes you've walked past go on the map
  for (const R of E2_ROUTES) if (!(G.flags.seen || {})['e2r_' + R.id] && Math.hypot(R.x - P.x, R.z - P.z) < 40) { (G.flags.seen ||= {})['e2r_' + R.id] = 1; if (R.kind !== 'bridge') toast(R.kind === 'climb' ? 'A rock face with old pitons in it — a way up' : R.kind === 'rubble' ? 'Rubble heaped over what looks like a cellar door' : 'A wreck sitting on something — a hatch?', 2.6); }
  // tidy up finished events
  for (const k of ['lost', 'smoke', 'deal']) { const L = E2LIVE[k]; if (!L) continue; const far = Math.hypot(P.x - L.x, P.z - L.z) > 150; if ((G.t > L.end || (k === 'lost' && L.freed) || (k === 'deal' && L.done)) && far || G.t > L.end + 600) { for (const e of (L.ents || []).concat(L.foes || [], L.trader ? [L.trader] : [])) if (e && !e.dead && ents.includes(e)) removeEnt(e); for (const p of L.props || []) world.remove(p); for (const C of L.caches || []) e2DropCache(C); E2LIVE[k] = null; for (let i = E2_MARKS.length - 1; i >= 0; i--) if (E2_MARKS[i][k]) E2_MARKS.splice(i, 1); } }
}

/* ================= (Nov 11, Bryce) nights away, coming home with loot, the works board =================
   · you don't have to be in Kestrel every night: if you're far out (140 m past the wall, or underground) when the
     horns go, the watch holds it without you — walls, gate, turrets, guards, allies and whatever you prepared that
     day (fortify / intercept / negotiate) against the size of the raid. The night passes quicker out there, and at
     midnight you hear how it went. Get home before midnight and you fight it yourself. Night 100 still needs you.
   · coming home with loot pays: the expedition report adds a homecoming — a cut of what the haul is worth in scrap
     (net of what you spent), morale, and a hot meal from Bram for a big one.
   · the works board (next to the job board): every upgrade Kade used to sell, in words — what it is now, what the
     next level changes and where to look — plus the settlement projects. Buy one and a beacon stands over what
     changed and your view turns to it. Kade's "upgrades" opens the same board. */
let e2Away = null;
const e2FarFromHome = () => Math.hypot(P.x, P.z) > CAMP_R + 140 || !!UG.at;
{ const sn1 = startNight; startNight = function () {
  if (G.flags.reached && !night.active && G.day < 99 && !SIEGE.on && e2FarFromHome()) {
    if (!e2Away || e2Away.day !== G.day) { e2Away = { day: G.day }; toast('Horns back at Kestrel. You’re too far out — the watch will hold it without you tonight', 4.2); }
    return;
  }
  if (e2Away && e2Away.day === G.day) { e2Away = null; toast('You made it back in time — the raid is yours to fight', 3); }
  sn1(); }; }
function e2AwayStrength() {
  const S = setS(), guards = S.ros.filter(R => R.job === 'guard').length * (projDone('barracks') ? 2 : 1), al = FAC_IDS.filter(f => facAllied(f) && f !== 'arc').length + (facAllied('arc') ? 1 : 0), T = E2().tn;
  const D = 14 + UP.wall * 9 + UP.gate * 6 + UP.tur * 9 + UP.light * 3 + guards * 5 + al * 12 + (projDone('towers') ? 10 : 0) + (projDone('gatehouse') ? 8 : 0) + (T && T.choice === 'fort' ? 16 : 0) + setS().morale * .1;
  const waves = Math.min(2 + Math.ceil(G.day / 3), 8), A = facAnyRaider() ? waves * (4 + G.day * .7) * facRaidScale() * (T && T.choice === 'icpt' && E2LIVE.icpt && E2LIVE.icpt.won ? .33 : 1) : 0;
  return { D, A, guards };
}
function e2AwayResolve() {
  const S = setS(), { D, A, guards } = e2AwayStrength(), T = E2().tn;
  G.day++; e2Away = null; if (T) T.done = 1;
  if (A <= 0) { S.lastWin = 1; toast(`Day ${G.day}. A quiet night at Kestrel — nobody who hates you came.`, 4); }
  else { const p = clamp(D / (D + A * .8), .15, .95), won = rnd() < p; S.lastWin = won ? 1 : 0;
    if (won) { toast(`Day ${G.day}. Kestrel held without you — ${guards ? guards + ' on the wall' : 'the watch'}${UP.tur ? ', the turrets' : ''}${T && T.choice ? ', and what you did today' : ''}.`, 4.4); e2Note('Kestrel held a raid while you were away'); }
    else { const lost = []; for (const id of Object.keys(stores()).sort(() => rnd() - .5).slice(0, 4)) { const n = Math.ceil(sCnt(id) * .25); if (n) { sAdd(id, -n); lost.push(`${n} ${nameOf(id).toLowerCase()}`); } } gate.hp = Math.max(40, gate.hp * .5);
      toast(`Day ${G.day}. Raiders got over the wall while you were away${lost.length ? ' — they took ' + lost.join(', ') : ''}. More guards, a taller wall or turrets would have held.`, 5); e2Note('Raiders got into Kestrel while you were away'); } }
  respawnBases(); save(); radioDay();
}

/* ---------- the homecoming ---------- */
function e2Homecoming(A, B) {
  let V = 0; for (const k of Object.keys(B.it)) { if (k === 'scrap') continue; const d = (B.it[k] || 0) - (A.it[k] || 0); if (d > 0) V += valueOf(k.replace('g:', '')) * d; }
  const ds = B.it.scrap - A.it.scrap; if (ds < 0) V += ds;   // what you spent doesn't count
  if (V < 12) return null;
  const sc = Math.min(160, Math.round(V * .2)), mo = Math.min(6, Math.round(V / 40)), meal = V >= 120 && ITEMS.stew;
  INV.scrap += sc; setS().morale = clamp(setS().morale + mo, 0, 100); if (meal) give('stew', 1);
  sfx('buy'); save();
  return `the settlers count your haul (worth ~${Math.round(V)}) · +${sc} scrap${mo ? ` · morale +${mo}` : ''}${meal ? ' · Bram saves you a hot stew' : ''}`;
}
{ const rp0 = e2Report; e2Report = function (A, B) { const h = e2Homecoming(A, B); if (h) E2().notes.push('HOME:' + h); rp0(A, B); }; }

/* ---------- the works board ---------- */
const WORKS = {
  wall: { n: 'The wall', lv: ['Rough timber, 2.4 m — raiders climb it easily', 'Raised to 3.6 m: about half the raiders who used to climb over can’t', 'Raised to 4.6 m and braced: only a few still climb it', 'Raised to 5.4 m, the full height: nobody climbs it; they have to break the gate'], at: () => [{ x: GATE_SPOT.x + 10, z: GATE_SPOT.z - 1 }], where: 'all the way round Kestrel — look at the wall by the gate' },
  gate: { n: 'The gate', lv: ['Planks on hinges', 'Cross-braced timber doors (480 strength)', 'Steel sheet bolted over the lower half (700 strength)', 'Spikes facing out; the toughest gate Kestrel can have (920 strength)'], at: () => [GATE_SPOT], where: 'the main gate on the south side' },
  tur: { n: 'Tower guns', lv: ['The towers are empty', 'A gun on each watchtower that fires at raiders itself', 'Longer barrels and a steel shield: faster, harder-hitting', 'Twin barrels and an ammo box: the fastest, with the longest reach'], at: () => towers.map(T => ({ x: T.x, z: T.z })), where: 'on top of every watchtower round the wall' },
  light: { n: 'Searchlights', lv: ['No lights on the towers', 'A searchlight on every tower; nights in Kestrel are brighter and you see further', 'Brighter lamps: Kestrel is lit up like a town at night'], at: () => towers.map(T => ({ x: T.x, z: T.z })), where: 'on the watchtowers (look after dark)' },
  rifle: { n: 'Your Arc rifle', lv: ['The basic Arc carbine', 'A suppressor and a 25-round magazine', 'Swapped for the scoped battle rifle (more damage, more accurate)', 'A tac light and a 30-round magazine on the battle rifle'], at: () => [], where: 'your rifle, slot 1' },
  smoke: { n: 'Drying rack', lv: ['A bare rack: meat dries into 40-food rations', 'A roof over it: better rations (55 food)', 'Walls and a stovepipe: the best rations (70 food)'], at: () => [SPOTS.smoke], where: 'beside Bram’s cookhouse' },
};
let WORKS_BOARD = null, e2Beacons = [], e2Turn = null;
function buildWorksBoard() {
  if (!BOARD) return; const s = e2Spot(BOARD.x - 3.2, BOARD.z, 1.2, 1, 6) || { x: BOARD.x - 3.2, z: BOARD.z }, x = s.x, z = s.z, g = new THREE.Group();
  for (const sd of [-1, 1]) mesh(new THREE.BoxGeometry(.12, 2.2, .12), M(0x4a3a2a), sd * .9, 1.1, 0, g); mesh(new THREE.BoxGeometry(2, 1.2, .08), M(0x6a5a48), 0, 1.5, 0, g);
  mesh(new THREE.BoxGeometry(1.8, .26, .1), new THREE.MeshBasicMaterial({ color: 0xf0a640, toneMapped: false }), 0, 2.25, 0, g);
  for (let i = 0; i < 3; i++) mesh(new THREE.PlaneGeometry(.5, .36), new THREE.MeshLambertMaterial({ color: 0xd8d0b8, side: THREE.DoubleSide }), -.6 + i * .6, 1.45, .05, g);
  g.position.set(x, heightAt(x, z), z); g.rotation.y = BOARD.yaw ?? rr(-.3, .3); world.add(g); addCol(x, z, .5); WORKS_BOARD = { x, z };
}
const nearWorks = () => WORKS_BOARD && Math.hypot(P.x - WORKS_BOARD.x, P.z - WORKS_BOARD.z) < 3.4;
function e2Works() {
  if (typeof shopOpen !== 'undefined' && shopOpen) closeShop();
  const S = setS(); let h = `<p style="opacity:.8">You have <b>${INV.scrap}</b> scrap. Projects are paid from the Kestrel stores and built by people on the Building job.</p><h3 style="font:700 17px 'Barlow Condensed',sans-serif;margin:10px 0 4px;color:#f0a640">DEFENCES & GEAR</h3>`;
  const btns = [];
  for (const u of UPS) { const W = WORKS[u.id], lv = UP[u.id], max = lv >= u.max, cost = u.cost[lv];
    h += `<div style="padding:6px 8px;margin:4px 0;border:1px solid #fff2;border-left:4px solid ${max ? '#7fc4b8' : '#f0a640'};border-radius:3px"><b>${W.n}</b> <small style="opacity:.7">level ${lv}/${u.max}</small><br><small>Now: ${W.lv[lv]}</small>${max ? '' : `<br><small style="color:#f0d090">Next: ${W.lv[lv + 1]} — ${cost} scrap · ${W.where}</small>`}</div>`;
    if (!max) btns.push({ k: 'wup', v: u.id, t: `Upgrade ${W.n.toLowerCase()} → level ${lv + 1} (${cost} scrap)`, dis: INV.scrap < cost }); }
  h += `<h3 style="font:700 17px 'Barlow Condensed',sans-serif;margin:12px 0 4px;color:#f0a640">PROJECTS OUTSIDE THE WALL</h3>`;
  for (const id of PROJ_IDS) { const Pj = PROJECTS[id], J = S.proj[id] || {}, cost = Object.entries(Pj.cost), can = cost.every(([k, n]) => sCnt(k) >= n);
    const st = J.done ? 'built' : S.cur === id ? `being built (${Math.round((J.pts || 0) / Pj.w * 100)}% · ${S.ros.filter(R => R.job === 'build').length} on Building)` : 'not started';
    h += `<div style="padding:6px 8px;margin:4px 0;border:1px solid #fff2;border-left:4px solid ${J.done ? '#7fc4b8' : S.cur === id ? '#e8c070' : '#6a6458'};border-radius:3px"><b>${Pj.n}</b> <small style="opacity:.7">${st}</small><br><small>${Pj.d}</small>${J.done || S.cur === id ? '' : `<br><small style="color:${can ? '#f0d090' : '#c08070'}">Costs ${cost.map(([k, n]) => `${n} ${nameOf(k).toLowerCase()} (${sCnt(k)})`).join(', ')} from the stores</small>`}</div>`;
    if (!J.done && S.cur !== id) btns.push({ k: 'wpj', v: id, t: `Start: ${Pj.n}`, dis: !!S.cur || !can }); }
  if (S.cur) h += `<p style="opacity:.7"><small>One project at a time — ${PROJECTS[S.cur].n} is going up now.</small></p>`;
  btns.push({ k: 'close', t: 'Done' });
  e2Panel('KESTREL WORKS', h, btns);
}
function e2WorksUp(id) {
  const u = UPS.find(x => x.id === id), lv = UP[id]; if (!u || lv >= u.max) return; const cost = u.cost[lv];
  if (INV.scrap < cost) { sfx('no'); toast(`Need ${cost} scrap`); return; }
  INV.scrap -= cost; UP[id]++; sfx('buy'); applyUpgrades(id); save();
  const W = WORKS[id]; e2Close(); card(`${W.n.toUpperCase()} · LEVEL ${UP[id]}`, W.lv[UP[id]], 5);
  e2ShowMe(W.at(), W.where);
}
function e2WorksProject(id) {
  const S = setS(), Pj = PROJECTS[id]; if (S.cur || !Object.entries(Pj.cost).every(([k, n]) => sCnt(k) >= n)) { sfx('no'); return; }
  setAction({ sp: id }); e2Close();
  const Pl = id === 'lookout' || id === 'market' ? E2_PLOTS[id] : id === 'gatehouse' ? { x: 0, z: CAMP_R + 34 } : projPlot(id);
  card(Pj.n.toUpperCase(), `Scaffolding is up · put people on Building to finish it · ${Pj.d}`, 5); if (Pl) e2ShowMe([Pl], 'outside the wall');
}
// a beacon over what changed, and your view turns to it
function e2ShowMe(pts, where) {
  for (const b of e2Beacons) world.remove(b.m); e2Beacons = [];
  if (!pts.length) { toast(`Changed: ${where}`, 3); return; }
  for (const p of pts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: .45, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); m.position.set(p.x, heightAt(p.x, p.z) + 20, p.z); world.add(m); e2Beacons.push({ m, until: G.t + 45 }); E2_MARKS.push({ x: p.x, z: p.z, n: 'Changed', ring: 0, beacon: 1 }); }
  let b = pts[0], bd = 1e9; for (const p of pts) { const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; b = p; } }
  e2Turn = { yaw: Math.atan2(-(b.x - P.x), -(b.z - P.z)), t: 1 };
  toast(`Look for the orange light${pts.length > 1 ? 's' : ''} — ${where} (${Math.round(bd)} m ${e2Dir(b.x - P.x, b.z - P.z)})`, 4.4);
}
// Kade's "upgrades" opens the board too
openShop = function () { e2Works(); };
E2INTERACT.push({ id: 'e2works', at: () => WORKS_BOARD, r: 3.4, label: () => 'Kestrel works board · upgrade the base', act: () => e2Works() });
{ const ac0 = e2Action; e2Action = function (d) { if (d.e2 === 'wup') return e2WorksUp(d.v); if (d.e2 === 'wpj') return e2WorksProject(d.v); return ac0(d); }; }
{ const be0 = buildEveryday; buildEveryday = function () { be0(); const s0 = seed; seed = 4343434; buildWorksBoard(); seed = s0; Object.assign(window.__E2, { e2Works, e2WorksUp, e2AwayResolve, e2AwayStrength, e2Homecoming, get away() { return e2Away; } }); }; }
{ const ue0 = updEveryday; updEveryday = function (dt) { ue0(dt); if (G.mode !== 'play') return;
  // a night away passes quicker, and at midnight you hear how it went
  if (e2Away) { if (!e2FarFromHome() && G.tod >= .79) { /* home in time: startNight takes it from here */ } else { if (isNight()) G.tod += dt * (.56 / DAY_LEN); if (G.tod >= 1) { G.tod -= 1; e2AwayResolve(); } } }
  if (!e2Away && G.flags.reached && G.tod < .3 && isNight() && !night.active && G.tod > .001) G.tod += dt * (.56 / DAY_LEN);   // the rest of an away night, quicker
  for (const b of [...e2Beacons]) { b.m.material.opacity = .3 + Math.sin(G.t * 4) * .15; if (G.t > b.until) { world.remove(b.m); e2Beacons.splice(e2Beacons.indexOf(b), 1); } }
  if (!e2Beacons.length) for (let i = E2_MARKS.length - 1; i >= 0; i--) if (E2_MARKS[i].beacon) E2_MARKS.splice(i, 1);
  if (e2Turn) { P.yaw += angWrap(e2Turn.yaw - P.yaw) * Math.min(1, dt * 4); e2Turn.t -= dt; if (e2Turn.t <= 0) e2Turn = null; }
}; }
