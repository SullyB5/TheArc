
/* ================= Cinder City, inside (Nov 11 · overhaul part 2: the city) =================
   Bryce's plan §1: the destroyed city becomes a major exploration location — enterable buildings, rooftops, basements, hidden
   rooms, collapsed structures, underground passages, valuable loot; some places dangerous (hostiles, wildlife, radiation,
   structural hazards), others peaceful; notes, terminals, recordings and skeletons that tell what happened.

   How it works
   - citySites() reserves whole blocks of the city grid before buildCity lays out the towers (buildCity skips them, without
     changing how much of the world's random stream it uses, so nothing else in the world moves).
   - Buildings are real: a raised ground floor (so no grass grows through it), storeys 3.4 m apart joined by a stacked ramp stair
     against the back wall, walkable floors (FLOORS rects), partitions with doorways, windows, a roof with a parapet and a stair
     bulkhead. Everything of a building merges into one mesh per material (hkit from 1f-houses.js); the inside only draws near.
   - Walls the player bumps into are y-aware segments (CWALLS, cityCollide), so a partition on the 2nd floor doesn't stop you on the
     roof. Outer walls also get ordinary column colliders (addCol) so people, animals and bullets respect them.
   - Underground (basements, a bunker, the Kessler Line metro tunnel) is reached by hatches/stairs (a short fade) and walked for real:
     P.under + UNDER rects stand in for the ground (cityGround). It only draws while you're down there.
   - Dangers: weak floors (patched boards) give way if you dawdle on them — sprint across; radiation (Cinder No. 4 and a leak in the
     tunnel) hurts and builds Rust poisoning unless you wear a hazmat / Rust suit. Quiet places (the Glasshouse, a rooftop garden):
     nobody hunts you there and you heal. Underground, the scavengers up top lose you.
   - Everything found is saved in G.flags.city (doors opened, floors fallen, power, records read); old saves just start empty.
   Its own random stream (crnd), so editing the city's insides never moves anything else. */

let CR_S = 52711;
const crnd = () => (CR_S = (CR_S * 16807) % 2147483647, (CR_S - 1) / 2147483646);
const cr = (a, b) => a + crnd() * (b - a), cpk = a => a[Math.floor(crnd() * a.length)], cp = p => crnd() < p;
const CFH = 3.4;                                              // storey height
const CWALLS = [], CWG = new Map(), UNDER = [], CITY_IT = [], WEAK = [], CZONES = [], CIN_G = [], CUN_G = [], CANIM = [], CDOORS = {};
let CITY_SITES = null, cityApplied = false, CITY_POWER = null, HOLLIS_HATCH = null;
const cityF = () => (G.flags.city ||= { open: {}, coll: {}, lore: {} });
const toolOK = need => GEAR_DEFS[need] ? has(GEAR_DEFS[need].kind) : cnt(need) > 0;

/* ---------- which blocks become what ---------- */
function citySites() {
  if (CITY_SITES) return CITY_SITES;
  const S = CITY_SITES = [], C = CITY, F = FOUNDRY, N = Math.ceil(C.R / 44), ok = [];
  for (let gx = -N; gx <= N; gx++) for (let gz = -N; gz <= N; gz++) {
    const x = C.x + gx * 44, z = C.z + gz * 44;
    if (Math.hypot(x - C.x, z - C.z) > C.R - 60 || Math.hypot(x - F.x, z - F.z) < F.R + 30) continue;
    if (envKeepClear(x, z, 20) || pathDist(x, z) < 18 || waterAt(x, z) > -1e8) continue;
    ok.push({ x, z });
  }
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const take = (def, tx, tz, score) => {
    let best = null, bs = 1e9;
    for (const b of ok) if (!b.used && !S.some(s => Math.hypot(s.x - b.x, s.z - b.z) < 60)) { const sc = score ? score(b) : Math.hypot(b.x - tx, b.z - tz); if (sc < bs) { bs = sc; best = b; } }
    if (!best) return null; best.used = 1;
    const s = { yaw: cpk(yaws), ...def, x: best.x, z: best.z }; s.rad = s.big ? 21 : Math.hypot(s.w, s.d) / 2 + 3; S.push(s); return s;
  };
  // the metro kiosk: west of the Foundry, level with it, so the line can run straight in under Ironjaw's wall
  take({ kind: 'metro', id: 'kessler', name: 'KESSLER ST.', w: 16, d: 12, n: 1, style: 'kiosk', yaw: 0 }, 0, 0, b => Math.abs(b.z - F.z) * 3 + Math.abs(b.x - (F.x - 150)) + (b.x > F.x - 125 || Math.abs(b.z - F.z) > 26 ? 1e5 : 0));
  const K = (a, r) => [C.x + Math.cos(a) * r, C.z + Math.sin(a) * r], kA = Math.atan2(-C.z, -C.x);   // kA: toward Kestrel
  take({ kind: 'bld', id: 'hollis', name: 'HOLLIS HARDWARE', w: 18, d: 14, n: 2, style: 'flat', open0: 1, cellar: 'hollis', hidden: null, weak: [], esc: 0,
    lore: [{ id: 'hollis_note', k: 1, ci: 0, ri: 1 }] }, ...K(kA, 290));
  take({ kind: 'bld', id: 'mercy', name: 'MERCY GENERAL', w: 26, d: 18, n: 4, style: 'hospital', cellar: 'morgue', roof: 'helipad', weak: [2],
    lore: [{ id: 'mercy_triage', k: 0, ci: 0, ri: 1, prop: 'term' }, { id: 'mercy_code', k: 2, ci: 1, ri: 0 }] }, ...K(kA + 2.2, 150));
  take({ kind: 'bld', id: 'precinct', name: 'PRECINCT 9', w: 24, d: 16, n: 3, style: 'police', roof: 'nest', hidden: { k: 1, how: 'boards', lore: 'precinct_cell' },
    lore: [{ id: 'precinct_log', k: 0, ci: 2, ri: 0, prop: 'term' }] }, ...K(kA - .9, 170));
  take({ kind: 'reactor', id: 'reactor', name: 'CINDER NO. 4', big: 1, w: 30, d: 30, style: 'ctl' }, ...K(kA + Math.PI - .4, 250));
  take({ kind: 'glass', id: 'glasshouse', name: 'THE GLASSHOUSE', big: 1, w: 30, d: 30, yaw: 0 }, ...K(kA + 1.1, 210));
  take({ kind: 'bld', id: 'flat1', w: 20, d: 16, n: 5, style: 'flat', roof: 'garden', esc: 1 }, ...K(kA - 2.0, 260));
  take({ kind: 'bld', id: 'flat2', w: 22, d: 16, n: 4, style: 'flat', hidden: { k: 1, how: 'shelf', lore: 'sealed_nine' }, weak: [2], weakOver: 1, cellar: 'cellar' }, ...K(kA + .55, 120));
  take({ kind: 'bld', id: 'flat3', w: 20, d: 15, n: 4, style: 'flat', weak: [1, 3], roof: 'camp', esc: 1 }, ...K(kA + 2.9, 290));
  take({ kind: 'bld', id: 'flat4', w: 18, d: 16, n: 3, style: 'flat', hidden: { k: 0, how: 'shelf', lore: 'sealed_flat4' }, cellar: 'cellar' }, ...K(kA - 1.5, 330));
  take({ kind: 'bld', id: 'flat5', w: 20, d: 14, n: 4, style: 'flat', roof: 'nest', esc: 1 }, ...K(kA + Math.PI + .5, 180));
  take({ kind: 'bld', id: 'office', name: 'CASSEL MUNICIPAL', w: 26, d: 18, n: 4, style: 'office', weak: [3], hidden: { k: 3, how: 'boards', lore: 'sealed_office' },
    lore: [{ id: 'office_terminal', k: 1, ci: 0, ri: 0, prop: 'term' }] }, ...K(kA - .3, 300));
  return S;
}
const citySiteAt = (x, z) => { for (const s of citySites()) if (Math.abs(x - s.x) < 4 && Math.abs(z - s.z) < 4) return s; return null; };
function cityInside(x, z, pad = 0) { for (const s of citySites()) if (Math.hypot(x - s.x, z - s.z) < s.rad + pad) return s; return null; }
function cityShove(x, z) { const s = cityInside(x, z, 4); if (!s) return [x, z]; const a = Math.atan2(z - s.z, x - s.x); return [s.x + Math.cos(a) * (s.rad + 6), s.z + Math.sin(a) * (s.rad + 6)]; }

/* ---------- frames, walls, floors ---------- */
function siteFrame(Q) {
  const c = Math.cos(Q.yaw), s = Math.sin(Q.yaw); Q.c = c; Q.s = s;
  Q.W = (lx, lz) => [Q.x + lx * c + lz * s, Q.z - lx * s + lz * c];
  Q.base = htm(Q.x, 0, Q.z, 0, Q.yaw, 0);
}
function cwall(Q, ax, az, bx, bz, y0, y1, t = .13) {
  const [x0, z0] = Q.W(ax, az), [x1, z1] = Q.W(bx, bz), w = { x0, z0, x1, z1, y0, y1, t, on: true };
  CWALLS.push(w);
  for (let i = Math.floor((Math.min(x0, x1) - 1) / CELL); i <= Math.floor((Math.max(x0, x1) + 1) / CELL); i++)
    for (let j = Math.floor((Math.min(z0, z1) - 1) / CELL); j <= Math.floor((Math.max(z0, z1) + 1) / CELL); j++) { const k = gkey(i, j); if (!CWG.has(k)) CWG.set(k, []); CWG.get(k).push(w); }
  return w;
}
const cbox = (Q, lx, lz, hx, hz, y0, y1) => [cwall(Q, lx - hx, lz - hz, lx + hx, lz - hz, y0, y1), cwall(Q, lx + hx, lz - hz, lx + hx, lz + hz, y0, y1), cwall(Q, lx + hx, lz + hz, lx - hx, lz + hz, y0, y1), cwall(Q, lx - hx, lz + hz, lx - hx, lz - hz, y0, y1)];
function cfloor(Q, lx, lz, hw, hd, y, slope, list = FLOORS) { const [x, z] = Q.W(lx, lz), f = { cx: x, cz: z, c: Q.c, s: Q.s, hw, hd, y }; if (slope) f.slope = slope; list.push(f); return f; }
function underAt(x, z, footY) {
  let best = -1e9;
  for (const f of UNDER) { const dx = x - f.cx, dz = z - f.cz, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c, fy = f.y + (f.slope || 0) * lx;
    if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd && footY > fy - 1.3 && fy > best) best = fy; }
  return best;
}
/* hooks (3-game.js): the ground under you when you're below it, and the walls you bump into */
function cityGround(x, z, y, gy) { if (!P.under) return gy; const u = underAt(x, z, y); if (u > -1e8) return u; P.under = false; return gy; }
function cityCollide(o, rad) {
  if (!CWALLS.length) return;
  const L = CWG.get(gkey(Math.floor(o.x / CELL), Math.floor(o.z / CELL))); if (!L) return;
  const y0 = (o.y || 0) + .3, y1 = (o.y || 0) + 1.75;
  for (let pass = 0; pass < 2; pass++) for (const w of L) {
    if (!w.on || w.y1 <= y0 || w.y0 >= y1) continue;
    const dx = w.x1 - w.x0, dz = w.z1 - w.z0, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((o.x - w.x0) * dx + (o.z - w.z0) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = w.x0 + dx * t, cz = w.z0 + dz * t, ex = o.x - cx, ez = o.z - cz, d = Math.hypot(ex, ez), m = rad + w.t;
    if (d < m) { if (d > 1e-5) { o.x = cx + ex / d * m; o.z = cz + ez / d * m; } else { const nl = Math.sqrt(l2) || 1; o.x = cx - dz / nl * m; o.z = cz + dx / nl * m; } }
  }
}
// a rectangle minus holes, as a few rectangles (x strips, merged where they match)
function rectMinus(r, holes) {
  const xs = new Set([r[0], r[2]]); for (const h of holes) for (const v of [h[0], h[2]]) if (v > r[0] && v < r[2]) xs.add(v);
  const X = [...xs].sort((a, b) => a - b), out = [];
  for (let i = 0; i < X.length - 1; i++) {
    const a = X[i], b = X[i + 1], m = (a + b) / 2; let iv = [[r[1], r[3]]];
    for (const h of holes) if (h[0] < m && h[2] > m) iv = iv.flatMap(([s, e]) => h[3] <= s || h[1] >= e ? [[s, e]] : [[s, Math.min(e, h[1])], [Math.max(s, h[3]), e]].filter(([p, q]) => q - p > .01));
    for (const [s, e] of iv) { const prev = out.find(o => Math.abs(o[2] - a) < 1e-6 && Math.abs(o[1] - s) < 1e-6 && Math.abs(o[3] - e) < 1e-6); if (prev) prev[2] = b; else out.push([a, s, b, e]); }
  }
  return out;
}
/* a run of wall with rectangular openings, cut into boxes, with its collision. ax 'x': along local x from a to b at z = at; 'z': along local z at x = at */
function cutWall(Q, K, mat, col, ax, a, b, at, v0, v1, t, holes, o = {}) {
  const cuts = new Set([a, b]); for (const h of holes) if (h.b > a && h.a < b) { cuts.add(Math.max(a, h.a)); cuts.add(Math.min(b, h.b)); }
  const xs = [...cuts].sort((p, q) => p - q);
  for (let i = 0; i < xs.length - 1; i++) {
    const p = xs[i], q = xs[i + 1]; if (q - p < .01) continue; const m = (p + q) / 2;
    let iv = [[v0, v1]];
    for (const h of holes) if (h.a < m && h.b > m) iv = iv.flatMap(([s, e]) => h.hi <= s || h.lo >= e ? [[s, e]] : [[s, h.lo], [h.hi, e]].filter(([s2, e2]) => e2 - s2 > .01));
    for (const [s, e] of iv) {
      if (ax === 'x') K.box(mat, q - p, e - s, t, m, (s + e) / 2, at, 0, 0, 0, col, o.tile || 2); else K.box(mat, t, e - s, q - p, at, (s + e) / 2, m, 0, 0, 0, col, o.tile || 2);
      if (!o.noCol) { if (ax === 'x') cwall(Q, p, at, q, at, s, e); else cwall(Q, at, p, at, q, s, e); }
    }
  }
}

/* ---------- looks ---------- */
const CSTYLE = {
  flat: { wall: () => cpk([0xb8ad9c, 0xa89c8a, 0xc4b8a4, 0x9c948a, 0xb0a490, 0xa8907c]), mat: 'conc', part: 0xc8bfae, floor: 0x8a8378, win: 1.3, sill: .95, head: 2.45, pitch: 3.1, rooms: ['bed', 'living', 'kitchen', 'bed', 'living', 'kitchen'] },
  office: { wall: () => cpk([0x8a9096, 0x9aa0a4, 0x7e8488]), mat: 'conc', part: 0xb8bcbc, floor: 0x6e7070, win: 2.3, sill: .75, head: 2.85, pitch: 2.9, rooms: ['office', 'office', 'office', 'living'] },
  hospital: { wall: () => cpk([0xd8d4cc, 0xccc8be]), mat: 'conc', part: 0xdcd8d0, floor: 0x9aa0a0, win: 1.5, sill: .9, head: 2.5, pitch: 3.2, rooms: ['ward', 'ward', 'office', 'ward'] },
  police: { wall: () => cpk([0x7a8088, 0x6e747c]), mat: 'block', part: 0xa8aaa8, floor: 0x6a6a66, win: 1.1, sill: 1.1, head: 2.3, pitch: 3.4, rooms: ['office', 'locker', 'office'] },
  ctl: { wall: () => 0x8a8a80, mat: 'block', part: 0xa0a098, floor: 0x5e605a, win: 1.2, sill: 1.1, head: 2.3, pitch: 3.6, rooms: ['office', 'locker'] },
  kiosk: { wall: () => 0x9a8a78, mat: 'block', part: 0xb0a898, floor: 0x7a7468, win: 2.2, sill: .6, head: 2.7, pitch: 3.6, rooms: [] },
};
const BONE = 0xd6cdb6;
function bones(K, x, y, z, ry, sit) {
  const c = Math.cos(ry), s = Math.sin(ry), o = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const put = (g, lx, ly, lz, rx = 0, rz = 0) => { const [px, pz] = o(lx, lz); K.geo('plain', g, htm(px, y + ly, pz, rx, ry, rz), BONE); };
  if (sit) {   // slumped against a wall
    put(new THREE.SphereGeometry(.11, 8, 6), 0, .78, .05, 0, .3); put(new THREE.CylinderGeometry(.025, .025, .5, 5), 0, .5, 0, .2);
    for (let i = 0; i < 4; i++) put(new THREE.BoxGeometry(.3 - i * .03, .02, .14), 0, .62 - i * .07, .05);
    for (const sx of [-.12, .12]) { put(new THREE.CylinderGeometry(.03, .025, .45, 5), sx, .1, .28, Math.PI / 2); put(new THREE.CylinderGeometry(.025, .02, .4, 5), sx, .12, .6, Math.PI / 2 + .3); put(new THREE.CylinderGeometry(.02, .02, .45, 5), sx * 2, .35, .14, .5, sx * 4); }
    return;
  }
  put(new THREE.SphereGeometry(.11, 8, 6), 0, .1, .82); put(new THREE.CylinderGeometry(.025, .025, .6, 5), 0, .05, .45, Math.PI / 2);
  for (let i = 0; i < 5; i++) put(new THREE.BoxGeometry(.32 - i * .03, .03, .025), 0, .07, .64 - i * .07);
  put(new THREE.BoxGeometry(.3, .08, .16), 0, .05, .12);
  for (const sx of [-.1, .1]) { put(new THREE.CylinderGeometry(.03, .025, .45, 5), sx, .04, -.15, Math.PI / 2, sx * .4); put(new THREE.CylinderGeometry(.025, .02, .42, 5), sx * 1.3, .04, -.58, Math.PI / 2); put(new THREE.CylinderGeometry(.02, .02, .55, 5), sx * 2.6, .04, .45, Math.PI / 2, sx * 2); }
}

/* ---------- the records: notes, terminals, recordings ---------- */
const CLORE = {
  hollis_note: { t: 'A note pinned to the shop counter', who: 'Note', lines: ['Dad — the shelter under the shop is stocked. I couldn’t keep the door code in my head, so I left it with Ilse at Mercy General.', 'Third floor, the nurses’ desk. Don’t come looking for me. — R.'] },
  mercy_code: { t: 'A card taped under the nurses’ desk', who: 'Note', lines: ['Ilse — R. Hollis came by. Asked me to keep this for his father: 4 1 7 7.', 'If the old man turns up he’ll know what it’s for. I’m on shift until they move us to the Grey Door.'] },
  mercy_triage: { t: 'Triage terminal', who: 'Terminal', lines: ['TRIAGE LOG · day 9 of the burning. Forty-one admitted.', 'Rust-coloured sputum. Burns that don’t match the fires.', 'Greyhold sent a van for the ones who tested clean. It didn’t come back for the rest.'] },
  mercy_morgue: { t: 'A recorder on the morgue desk', who: 'Recording', lines: ['(a man counting drawers under his breath, then:)', 'They told us the fog would pass over the city. It didn’t pass. It settled.'] },
  precinct_log: { t: 'Duty terminal', who: 'Terminal', lines: ['EVAC ORDER 7: all officers to the Ridge Road checkpoint.', 'Civilians not on the Greyhold list are to be turned back.', 'Officer Dane refused the order. Dane is suspended pending review.'] },
  precinct_cell: { t: 'Scratched into a cell wall', who: 'Wall', lines: ['DANE WAS RIGHT', '(under it, smaller: they bricked up the armoury so nobody could take the guns to the checkpoint)'] },
  reactor_log: { t: 'Control-room terminal', who: 'Terminal', lines: ['CINDER NO. 4 · coolant loop B lost pressure 03:12. Containment holding.', 'Staff evacuated to the dome. Do not open the dome.', 'Do not open the dome.'] },
  reactor_badge: { t: 'A dosimeter on a coat', who: 'Note', lines: ['A dosimeter is still clipped to the coat. The strip has gone black.'] },
  glass_gardener: { t: 'The gardener’s notebook', who: 'Note', lines: ['To whoever finds the Glasshouse: water the lemon tree. It’s the last one.', 'Nobody comes in here. The Ironjaw think the glass is cursed. Let them.'] },
  roof_garden: { t: 'A diary in a biscuit tin', who: 'Note', lines: ['Fourteen months on this roof. Rain barrels, beans, the pigeons.', 'From up here you can see their fires in the Foundry, and the red coming down off the ridge.', 'I’m going to try for the coast.'] },
  roof_camp: { t: 'A note weighed down with a brick', who: 'Note', lines: ['Ironjaw took the stairs on the east side. If you’re reading this, they missed my cache under the water tank.', 'Take it. Pay it forward.'] },
  kessler_poster: { t: 'A notice in the ticket hall', who: 'Notice', lines: ['KESSLER ST · Line 2 · Foundry Yards — Old Market — Port Cassel.', 'NOTICE: Line 2 is closed beyond Foundry Yards by order of Greyhold Civil Defence.'] },
  tunnel_claws: { t: 'A bricked-up branch tunnel', who: 'You', lines: ['Someone bricked this branch up in a hurry.', 'The mortar is scored from the other side. Deep, in fours.'] },
  tunnel_note: { t: 'A note in a dead man’s pocket', who: 'Note', lines: ['The generator on the platform still runs if you can find fuel. The gate opens with the power.', 'The line comes up under the Foundry — a manhole by the old tram shed. That’s how we got food in.'] },
  bunker_terminal: { t: 'Shelter terminal', who: 'Terminal', lines: ['SHELTER 12 · HOLLIS · occupants 0 of 6.', 'Last entry: they broadcast from the Mountain every night now. Same message. ALL ARE WELCOME.', 'Nobody who went has come back on the radio.'] },
  office_terminal: { t: 'Municipal mail terminal', who: 'Terminal', lines: ['CASSEL MUNICIPAL · internal mail · subject: relocation.', 'Departments will relocate to Greyhold Station. Bring nothing that can’t be carried.', 'Do not discuss the list.'] },
  sealed_nine: { t: 'Writing on the back of a door', who: 'Note', lines: ['We sealed ourselves in behind the shelf. It’s been nine days.', 'If the shelf moves, it isn’t us.'] },
  sealed_flat4: { t: 'A letter on the bed', who: 'Note', lines: ['Grandad built the shelf so the patrols wouldn’t find his room.', 'He said the city would come back. He kept the good things in here for when it did.'] },
  sealed_office: { t: 'A typed memo', who: 'Note', lines: ['RECORDS ROOM — SEALED. Copies of the list are not to leave this floor.', '(Every name on the page has been crossed out by hand. One hasn’t: yours is the kind of name it would be.)'] },
};
// where each record was found (the Journal groups them by place)
const CLORE_AT = { hollis_note: 'Hollis Hardware', mercy_code: 'Mercy General', mercy_triage: 'Mercy General', mercy_morgue: 'Mercy General', precinct_log: 'Precinct 9', precinct_cell: 'Precinct 9',
  reactor_log: 'Cinder No. 4', reactor_badge: 'Cinder No. 4', glass_gardener: 'The Glasshouse', roof_garden: 'Cinder City rooftops', roof_camp: 'Cinder City rooftops', kessler_poster: 'The Kessler Line',
  tunnel_claws: 'The Kessler Line', tunnel_note: 'The Kessler Line', bunker_terminal: 'Shelter 12', office_terminal: 'Cassel Municipal', sealed_nine: 'Cinder City · sealed rooms', sealed_flat4: 'Cinder City · sealed rooms', sealed_office: 'Cassel Municipal' };
// (Nov 11) the city's records go into the Journal from Part 1 (2f-explore.js: LOGS, openLog) so there's one place to read them all
function cityLogs() {
  if (typeof LOGS !== 'object') return;
  for (const id in CLORE) { const L = CLORE[id]; LOGS['city_' + id] = { at: CLORE_AT[id] || 'Cinder City', kind: { Terminal: 'term', Recording: 'rec', Wall: 'carve', You: 'carve' }[L.who] || 'note', t: L.t, by: '', b: L.lines.join(' ') }; }
}
function readLore(id) {
  const L = CLORE[id]; if (!L) return; const F = cityF(), first = !F.lore[id]; F.lore[id] = 1;
  if (typeof openLog === 'function' && typeof LOGS === 'object' && LOGS['city_' + id]) { openLog('city_' + id); if (first) save(); return; }
  say(L.lines.map(s => [L.who, s])); if (first) { toast(`${L.t} · city records ${Object.keys(F.lore).length} / ${Object.keys(CLORE).length}`, 3.2); save(); }
}
function cit(Q, lx, lz, y, l, act, r = 2.2, dy = 1.9) { const [x, z] = Q.W(lx, lz), it = { x, z, y, r, dy, l, act }; CITY_IT.push(it); return it; }
// a record and the thing it's on: a paper on a surface, a terminal, a recorder
function lorePt(Q, K, lx, lz, y, id, prop = 'note', ry = 0) {
  if (prop === 'term') {
    K.box('metal', 1.1, .75, .6, lx, y + .375, lz, 0, ry, 0, 0x4a4e50, 1); K.box('plain', .55, .4, .08, lx, y + 1.0, lz, 0, ry, 0, 0x2a2c2e);
    K.box('glow', .48, .32, .02, lx + Math.sin(ry) * .05, y + 1.0, lz + Math.cos(ry) * .05, 0, ry, 0, 0x38c888);
  } else if (prop === 'rec') { K.box('plain', .26, .08, .18, lx, y + .04, lz, 0, ry, 0, 0x2a2a2a); K.box('glow', .03, .03, .03, lx + .08, y + .09, lz, 0, 0, 0, 0xff3020); }
  else if (prop !== 'none') K.box('paper', .24, .006, .32, lx, y + .006, lz, 0, ry + cr(-.4, .4), 0, 0xffffff);
  const L = CLORE[id];
  return cit(Q, lx, lz, y, () => (cityF().lore[id] ? 'Again · ' : prop === 'term' ? 'Read the terminal · ' : prop === 'rec' ? 'Play the recording · ' : 'Read · ') + L.t.replace(/^(A|An|The) /, m => m.toLowerCase()), () => readLore(id), 2, 2.2);
}
// a stash inside: its own id so saves keep track of it, raised to its floor, bumped into like a wall
function ccache(Q, lx, lz, y, ry, lock, table, o = {}) {
  const [x, z] = Q.W(lx, lz), C = cache(Q.g, x, z, ry + Q.yaw, lock, table, { ...o, y, noCol: 1 });
  cbox(Q, lx, lz, o.big ? 1.25 : .72, o.big ? .65 : .42, y, y + (o.big ? 1.6 : .9));
  return C;
}

/* ---------- a building: shell, floors, stairs, rooms ---------- */
function cityBuild(Q, root) {
  siteFrame(Q);
  const hw = Q.w / 2, hd = Q.d / 2, n = Q.n, st = CSTYLE[Q.style || 'flat'];
  let hi = -1e9, lo = 1e9;
  for (let i = -1; i <= 1.001; i += .25) for (let j = -1; j <= 1.001; j += .25) { const [x, z] = Q.W(i * (hw + 3), j * (hd + 3)), h = heightAt(x, z); hi = Math.max(hi, h); lo = Math.min(lo, h); }
  const y0 = Q.y0 = hi + 1.2, top = Q.top = y0 + n * CFH, Y = k => y0 + k * CFH; Q.lo = lo;
  const g = Q.g = new THREE.Group(), gi = Q.gi = new THREE.Group(); root.add(g); root.add(gi);
  CIN_G.push({ g: gi, x: Q.x, z: Q.z, r: Math.hypot(hw, hd) });
  const KE = Q.KE = hkit(), KI = Q.KI = hkit(); KE.at(Q.base); KI.at(Q.base);
  const wc = Q.wc = st.wall(), ix0 = -hw + .15, ix1 = hw - .15, iz0 = -hd + .15, iz1 = hd - .15;
  const stair = !Q.noStair, zb0 = iz0, zb1 = iz0 + 1.7, xa = ix0 + 1.6, xb = xa + 6.4;
  const zm = ((stair ? zb1 : iz0) + iz1) / 2, xs1 = ix0 + (ix1 - ix0) / 3, xs2 = ix0 + 2 * (ix1 - ix0) / 3;
  const cols = [[ix0, xs1], [xs1, xs2], [xs2, ix1]], rows = [[stair ? zb1 : iz0, zm], [zm, iz1]];
  const L = Q.L = { hw, hd, ix0, ix1, iz0, iz1, zb0, zb1, xa, xb, zm, xs1, xs2, cols, rows, Y, stair };
  Q.weakAt = [];
  for (const k of Q.weak || []) {
    let ci = cpk([0, 1, 2]), ri = cpk([0, 1]);
    if (Q.weakOver && Q.hidden && k === Q.hidden.k + 1) { ci = 2; ri = 1; } else if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) ci = 0;
    const [a, b] = cols[ci], [c, d] = rows[ri], ex = Math.min(1.6, (b - a) / 2 - .75), ez = Math.min(1.6, (d - c) / 2 - .75), mx = (a + b) / 2, mz = (c + d) / 2;
    Q.weakAt.push({ k, ci, ri, r: [mx - ex, mz - ez, mx + ex, mz + ez] });
  }
  // outer walls: windows on every storey, the door, a parapet; down past the ground so the plinth hides it
  const vB = lo - .6, vT = top + 1.1;
  const holes = (len, front) => {
    const H = [], nw = Math.max(1, Math.floor((len - 2.4) / st.pitch)), sp = (len - 2.4) / nw;
    for (let k = 0; k < n; k++) for (let i = 0; i < nw; i++) {
      const c = -len / 2 + 1.2 + sp * (i + .5);
      if (front && k === 0) { if (Math.abs(c) < 2) continue; if (Q.open0) { H.push({ a: c - sp / 2 + .35, b: c + sp / 2 - .35, lo: Y(0) + .55, hi: Y(0) + 2.8, k, c }); continue; } }
      const big = cp(.07), ww = st.win;
      H.push({ a: c - ww / 2 - (big ? .3 : 0), b: c + ww / 2 + (big ? .45 : 0), lo: Y(k) + st.sill - (big ? .5 : 0), hi: Y(k) + st.head + (big ? .25 : 0), k, c });
    }
    if (front) H.push({ a: -1, b: 1, lo: y0, hi: y0 + 2.7, door: 1 });
    return H;
  };
  const sides = [
    { ax: 'x', a: -hw - .15, b: hw + .15, at: hd, H: holes(Q.w, true), out: [0, 1] },
    { ax: 'x', a: -hw - .15, b: hw + .15, at: -hd, H: holes(Q.w), out: [0, -1] },
    { ax: 'z', a: -hd + .15, b: hd - .15, at: hw, H: holes(Q.d - .3), out: [1, 0] },
    { ax: 'z', a: -hd + .15, b: hd - .15, at: -hw, H: holes(Q.d - .3), out: [-1, 0] },
  ];
  for (const sd of sides) {
    cutWall(Q, KE, st.mat, wc, sd.ax, sd.a, sd.b, sd.at, vB, vT, .3, sd.H);
    for (const h of sd.H) {   // glass, frames, boards
      if (h.door) continue; const w = h.b - h.a, hh = h.hi - h.lo, c = (h.a + h.b) / 2, cy = (h.lo + h.hi) / 2, f = (sw, sh, du, dv) => sd.ax === 'x' ? [sw, sh, .08, c + du, cy + dv, sd.at] : [.08, sh, sw, sd.at, cy + dv, c + du];
      const r = crnd();
      if (r < .3) { const [a1, a2, a3, a4, a5, a6] = f(w - .05, hh - .05, 0, 0); KE.box('glass', a1, a2, a3 * .5, a4, a5, a6); }
      else if (r < .42) for (let i = 0; i < 3; i++) { const [a1, a2, a3, a4, a5, a6] = f(w + .2, .16, 0, (i - 1) * hh * .3); KE.box('board', a1, a2, a3, a4 + (sd.ax === 'z' ? sd.out[0] * .2 : 0), a5, a6 + (sd.ax === 'x' ? sd.out[1] * .2 : 0), 0, 0, cr(-.12, .12), tint(cpk(WOODC)), 1); }
      const [s1, s2, s3, s4, s5, s6] = f(w + .14, .08, 0, -hh / 2 - .04); KE.box('conc', s1, s2, s3 * 3, s4 + sd.out[0] * .12, s5, s6 + sd.out[1] * .12, 0, 0, 0, 0xa8a49c);
    }
    // column colliders for people, animals and bullets (not across the door)
    const [ax0, az0] = sd.ax === 'x' ? [sd.a, sd.at] : [sd.at, sd.a], [ax1, az1] = sd.ax === 'x' ? [sd.b, sd.at] : [sd.at, sd.b];
    const runs = sd.H.some(h => h.door) ? [[ax0, -1.15], [1.15, ax1]] : [[sd.ax === 'x' ? ax0 : az0, sd.ax === 'x' ? ax1 : az1]];
    for (const [p, q] of runs) { const [x0, z0] = sd.ax === 'x' ? Q.W(p, sd.at) : Q.W(sd.at, p), [x1, z1] = sd.ax === 'x' ? Q.W(q, sd.at) : Q.W(sd.at, q); addColLine(x0, z0, x1, z1, .3); }
  }
  // floor lines and the cornice
  for (let k = 1; k <= n; k++) { const y = k === n ? vT : Y(k) - .1, th = k === n ? .3 : .22;
    KE.box('conc', Q.w + .5, th, .5, 0, y, hd, 0, 0, 0, 0xa8a298); KE.box('conc', Q.w + .5, th, .5, 0, y, -hd, 0, 0, 0, 0xa8a298);
    KE.box('conc', .5, th, Q.d - .1, hw, y, 0, 0, 0, 0, 0xa8a298); KE.box('conc', .5, th, Q.d - .1, -hw, y, 0, 0, 0, 0, 0xa8a298); }
  // the way in: steps, a ramp floor up to the door, the door hanging open
  { const tg = heightAt(...Q.W(0, hd + 2.8)), rise = y0 - tg;
    for (let i = 0; i < 4; i++) KE.box('conc', 2.6, rise * (i + 1) / 4, .7, 0, tg + rise * (i + 1) / 8, hd + 2.6 - i * .7, 0, 0, 0, 0x8e8a82);
    const [rx, rz] = Q.W(0, hd + 1.55); FLOORS.push({ cx: rx, cz: rz, c: Math.cos(Q.yaw + Math.PI / 2), s: Math.sin(Q.yaw + Math.PI / 2), hw: 1.4, hd: 1.25, y: (y0 + tg) / 2, slope: rise / 2.8 });
    KE.box('board', 1.05, 2.6, .07, -.6, y0 + 1.3, hd + .55, 0, -1.15, 0, tint(0x6a5a48), 1); }
  if (Q.name) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), hSignMat(Q.name, Q.style === 'hospital' || Q.style === 'office' ? 'serif' : 'stencil'));
    const [sx, sz] = Q.W(0, hd + .3); sg.position.set(sx, y0 + 3.0, sz); sg.rotation.y = Q.yaw; g.add(sg); }
  // floors (the stair hole and any weak patches cut out), each a walkable rect
  for (let k = 0; k <= n; k++) {
    const y = Y(k), hl = [];
    if (k > 0 && stair) hl.push([xa, zb0, xb, zb1]);
    for (const W of Q.weakAt) if (W.k === k) hl.push(W.r);
    for (const [a, b, c, d] of k === 0 ? [[ix0, iz0, ix1, iz1]] : rectMinus([ix0, iz0, ix1, iz1], hl)) {
      cfloor(Q, (a + c) / 2, (b + d) / 2, (c - a) / 2, (d - b) / 2, y);
      const th = k === 0 ? y - (lo - .4) : .32, K = k === n ? KE : KI;
      K.box(k === n ? 'conc' : 'conc', c - a + (k === n ? .02 : 0), th, d - b, (a + c) / 2, y - th / 2, (b + d) / 2, 0, 0, 0, k === n ? 0x7a7670 : tint(st.floor, .06), 2);
    }
  }
  // the stair: a ramp per storey stacked against the back wall (12 treads), walled off from the rooms
  if (stair) {
    const sl = xb - xa, bz = (zb0 + zb1) / 2, bw = zb1 - zb0;
    for (let k = 0; k < n; k++) {
      const yA = Y(k); cfloor(Q, (xa + xb) / 2, bz, sl / 2, bw / 2, yA + CFH / 2, CFH / sl);
      for (let i = 0; i < 12; i++) KI.box('conc', sl / 12 + .02, .2, bw - .05, xa + (i + .5) * sl / 12, yA + (i + .5) * CFH / 12, bz, 0, 0, 0, 0x9a958c, 1);
      KI.box('conc', Math.hypot(sl, CFH), .25, bw - .1, (xa + xb) / 2, yA + CFH / 2 - .3, bz, 0, 0, Math.atan2(CFH, sl), 0x8a857c, 2);
    }
    KI.box('conc', sl + .1, top - y0, .14, (xa + xb) / 2, (y0 + top) / 2, zb1, 0, 0, 0, st.part, 2);
    KE.box('conc', sl + .4, 2.7, .2, (xa + xb) / 2, top + 1.35, zb1, 0, 0, 0, wc, 2);
    cwall(Q, xa, zb1, xb, zb1, y0, top + 2.7);
    KI.box('conc', .14, 2.1, bw, xb, y0 + 1.05, bz, 0, 0, 0, st.part, 1); cwall(Q, xb, zb0, xb, zb1, y0, y0 + 2.1);   // shut the space under the first flight
    // the bulkhead on the roof: open toward the roof at the top of the flight
    KE.box('conc', sl + .4, 1.6, .3, (xa + xb) / 2, top + 1.9, -hd, 0, 0, 0, wc, 2);
    KE.box('conc', .2, 2.7, bw + .2, xa - .1, top + 1.35, bz, 0, 0, 0, wc, 2); cwall(Q, xa - .1, zb0 - .1, xa - .1, zb1, top - .2, top + 2.7);
    KE.box('conc', sl + .6, .2, bw + .6, (xa + xb) / 2, top + 2.8, bz, 0, 0, 0, 0x6a6660, 2);
  }
  // partitions: three columns of rooms, front and back, a doorway into each; the hidden room's are shut
  for (let k = 0; k < n; k++) {
    if (k === 0 && Q.open0) continue;
    const y = Y(k), yt = Y(k + 1) - .32, hid = Q.hidden && Q.hidden.k === k, dh = 2.25, door = m => ({ a: m - .62, b: m + .62, lo: y - .2, hi: y + dh });
    cutWall(Q, KI, 'conc', st.part, 'x', ix0, ix1, zm, y, yt, .14, cols.map(([a, b], i) => hid && i === 2 ? null : door((a + b) / 2)).filter(Boolean), { tile: 2.5 });
    for (const [i, xs] of [[0, xs1], [1, xs2]]) {
      cutWall(Q, KI, 'conc', st.part, 'z', zm, iz1, xs, y, yt, .14, [door((zm + iz1) / 2)], { tile: 2.5 });
      cutWall(Q, KI, 'conc', st.part, 'z', rows[0][0], zm, xs, y, yt, .14, [door((rows[0][0] + zm) / 2)], { tile: 2.5 });
      if (hid && i === 1) secretDoor(Q, Q.id + '_hid', xs2, (zm + iz1) / 2, y, Q.hidden.how);
    }
  }
  weakFloors(Q);
}
function cityFinish(Q) { Q.KE.build(Q.g, true, false); Q.KI.build(Q.gi, true, true); }

/* ---------- rooms ---------- */
function furnish(Q, k, ci, ri) {
  const K = Q.KI, L = Q.L, [a, b] = L.cols[ci], [c, d] = L.rows[ri], y = L.Y(k), st = CSTYLE[Q.style || 'flat'];
  const solid = (mat, w, h, dd, x, z, col, yy = y) => { K.box(mat, w, h, dd, x, yy + h / 2, z, 0, 0, 0, col, 1); if (h > .45) cbox(Q, x, z, w / 2, dd / 2, yy, yy + h); };
  const at = (w, dd, sx, sz) => [sx < 0 ? a + w / 2 + .15 : b - w / 2 - .15, sz < 0 ? c + dd / 2 + .15 : d - dd / 2 - .15];
  const wood = () => tint(cpk(WOODC)), cloth = () => tint(cpk(CLOTHC));
  // the mess: rubble, paper, a chair on its side
  for (let i = 0; i < 3; i++) K.box('conc', cr(.2, .6), cr(.1, .3), cr(.2, .6), cr(a + .8, b - .8), y + .1, cr(c + .8, d - .8), cr(-.3, .3), cr(0, 3), cr(-.3, .3), 0x8a857c, 1);
  for (let i = 0; i < 4; i++) K.box('paper', .22, .004, .3, cr(a + .5, b - .5), y + .004 + i * .001, cr(c + .5, d - .5), 0, cr(0, 6), 0, 0xffffff);
  if (cp(.5)) { const [x, z] = at(.5, .5, cp(.5) ? -1 : 1, cp(.5) ? -1 : 1); K.box('board', .45, .05, .45, x, y + .25, z, 1.4, cr(0, 3), 0, wood(), 1); K.box('board', .45, .45, .05, x, y + .12, z + .2, 1.4, cr(0, 3), 0, wood(), 1); }
  const kind = k === 0 && ri === 1 && ci === 1 ? 'lobby' : Q.style === 'police' && k === 0 && ri === 0 ? 'cells' : cpk(st.rooms.length ? st.rooms : ['living']);
  const sx = cp(.5) ? -1 : 1, sz = cp(.5) ? -1 : 1;
  if (kind === 'bed') {
    let [x, z] = at(2.1, 1.5, sx, sz); solid('board', 2.1, .45, 1.5, x, z, wood()); K.box('cloth', 1.9, .2, 1.35, x, y + .55, z, 0, 0, cr(-.03, .03), cloth(), 1);
    [x, z] = at(1.1, .6, -sx, sz); solid('board', 1.1, 2, .6, x, z, wood());
  } else if (kind === 'living') {
    let [x, z] = at(2, .85, sx, sz); solid('cloth', 2, .45, .85, x, z, cloth()); K.box('cloth', 2, .45, .2, x, y + .7, z + (sz < 0 ? -.33 : .33), 0, 0, 0, cloth(), 1);
    [x, z] = at(1.4, .35, -sx, -sz); solid('board', 1.4, 1.8, .35, x, z, wood());
    K.box('cloth', 2.2, .02, 1.6, (a + b) / 2 + sx * .6, y + .01, (c + d) / 2 + sz * .5, 0, cr(-.2, .2), 0, cloth(), 1);
  } else if (kind === 'kitchen') {
    let [x, z] = at(2.4, .62, sx, sz); solid('plain', 2.4, .9, .62, x, z, 0x9a948a); K.box('plain', 2.4, .05, .66, x, y + .92, z, 0, 0, 0, 0x5a5650);
    K.box('plain', 2.4, .6, .35, x, y + 1.85, z + (sz < 0 ? -.12 : .12), 0, 0, 0, 0x8a8478);
    [x, z] = at(.72, .72, -sx, sz); solid('shiny', .72, 1.8, .72, x, z, 0xc8c8c0);
  } else if (kind === 'office') {
    for (const ox of [-1, 1]) { const x = (a + b) / 2 + ox * (b - a) * .22, z = (c + d) / 2 + sz * (d - c) * .2; solid('board', 1.4, .75, .7, x, z, 0x6a5a48);
      K.box('plain', .5, .34, .06, x, y + 1.0, z, 0, 0, 0, 0x2a2c2e); K.box('glow', .44, .26, .01, x, y + 1.0, z + .035, 0, 0, 0, 0x0e1612); }
    const [x, z] = at(.5, .6, -sx, -sz); solid('metal', .5, 1.35, .6, x, z, 0x6a7072);
  } else if (kind === 'ward') {
    for (const ox of [-1, 1]) { const [x, z] = at(.95, 2, ox, sz); solid('metal', .95, .55, 2, x, z, 0xb8bcbc); K.box('cloth', .85, .14, 1.9, x, y + .62, z, 0, 0, 0, 0xd8d8d0, 1); K.cyl('metal', .02, .02, 1.7, 5, x + ox * -.6, y + .85, z - .7, 0, 0, 0, 0x8a8e90); }
    K.box('cloth', .04, 1.9, 2.4, (a + b) / 2, y + 1.3, (c + d) / 2, 0, 0, 0, 0x9ab0b4, 1);
  } else if (kind === 'locker') {
    const [x, z] = at(2.4, .5, sx, sz); for (let i = 0; i < 4; i++) solid('metal', .58, 1.9, .5, x - .9 + i * .6, z, tint(0x5a6a6e, .08)); K.box('board', 2, .45, .4, (a + b) / 2, y + .22, (c + d) / 2 + sz * .4, 0, 0, 0, 0x6a5a48, 1);
  } else if (kind === 'cells') {
    for (let i = 0; i < 9; i++) K.cyl('metal', .025, .025, CFH - .4, 5, a + .3 + i * (b - a - .6) / 8, y + (CFH - .4) / 2, (c + d) / 2 + .6, 0, 0, 0, 0x4a4e50);
    cwall(Q, a, (c + d) / 2 + .6, (a + b) / 2 - .5, (c + d) / 2 + .6, y, y + 3); cwall(Q, (a + b) / 2 + .5, (c + d) / 2 + .6, b, (c + d) / 2 + .6, y, y + 3);
    const [x, z] = at(1.8, .7, sx, -1); solid('metal', 1.8, .4, .7, x, z, 0x6a6e70); bones(K, (a + b) / 2 + sx * 1.2, y, c + .4, Math.PI, 1);
  } else if (kind === 'lobby') {
    const [x, z] = at(2.6, .7, sx, -1); solid('board', 2.6, 1.05, .7, x, z, Q.style === 'hospital' ? 0xc8c4bc : 0x5a4a3a);
  }
}
function shopFloor(Q) {
  // an open shop floor: aisles of shelving, the counter by the window, stock everywhere
  const L = Q.L, K = Q.KI, y = L.Y(0), x0 = L.ix0 + 2.6, x1 = L.xs2 - .6;
  for (const z of [L.zm - 1.8, L.zm + 1.2, L.zm + 3.6]) { if (z > L.iz1 - 1.4) continue;
    for (let i = 0; i < 4; i++) K.box('metal', x1 - x0, .04, .55, (x0 + x1) / 2, y + .15 + i * .55, z, 0, 0, 0, 0x6a6e70);
    for (const x of [x0, x1]) K.box('metal', .05, 1.9, .55, x, y + .95, z, 0, 0, 0, 0x4a4e50);
    for (let i = 0; i < 18; i++) K.box('plain', cr(.2, .45), cr(.15, .4), cr(.2, .4), cr(x0 + .3, x1 - .3), y + .25 + Math.floor(cr(0, 4)) * .55, z, 0, cr(-.2, .2), 0, cpk([0xa83a2a, 0x3a6a8a, 0x8a8a3a, 0x6a5a4a, 0x9a9a9a]), 1);
    cbox(Q, (x0 + x1) / 2, z, (x1 - x0) / 2, .28, y, y + 1.9); }
  K.box('board', 3, 1, .8, L.ix1 - 2, y + .5, L.iz1 - 1.6, 0, 0, 0, 0x6a5038, 1); cbox(Q, L.ix1 - 2, L.iz1 - 1.6, 1.5, .4, y, y + 1);
  K.box('metal', .5, .3, .4, L.ix1 - 1.4, y + 1.15, L.iz1 - 1.6, 0, 0, 0, 0x3a3a3a);
  for (let i = 0; i < 10; i++) K.box('plain', cr(.2, .5), cr(.1, .3), cr(.2, .5), cr(L.ix0 + 1, L.ix1 - 1), y + .08, cr(L.zm - 3, L.iz1 - 1), 0, cr(0, 3), cr(-.4, .4), cpk([0xa83a2a, 0x3a6a8a, 0x6a5a4a]), 1);
}
function dressRooms(Q) {
  const L = Q.L;
  if (Q.open0 && Q.kind === 'bld') shopFloor(Q);
  for (let k = 0; k < Q.n; k++) for (let ci = 0; ci < 3; ci++) for (let ri = 0; ri < 2; ri++) {
    if (k === 0 && Q.open0) continue;
    if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) continue;
    if (Q.weakAt.some(W => W.k === k && W.ci === ci && W.ri === ri) && cp(.6)) continue;
    furnish(Q, k, ci, ri);
  }
  // records
  for (const R of Q.lore || []) { const [a, b] = L.cols[R.ci], [c, d] = L.rows[R.ri], y = L.Y(R.k), x = a + 1.2, z = c + 1.1;
    if (R.prop === 'term') lorePt(Q, Q.KI, x, z, y, R.id, 'term', Math.PI * 0); else { Q.KI.box('board', 1.2, .78, .7, x, y + .39, z, 0, 0, 0, 0x5a4a3a, 1); cbox(Q, x, z, .6, .35, y, y + .8); lorePt(Q, Q.KI, x, z, y + .79, R.id, 'note'); } }
  // stashes: two or three ordinary ones per building, somewhere up the stairs
  const names = { flat: ['Kitchen cupboards', 'A wardrobe', 'Under the bed', 'A tool cupboard'], office: ['Desk drawers', 'A filing cabinet', 'The supply closet'], hospital: ['A medicine cabinet', 'A crash cart', 'The supply closet'],
    police: ['An evidence locker', 'A desk drawer', 'A locker'], ctl: ['A locker', 'A tool chest'], kiosk: ['The ticket office'] }[Q.style || 'flat'];
  const nst = Q.style === 'kiosk' ? 0 : 2 + (cp(.5) ? 1 : 0);
  for (let i = 0; i < nst; i++) {
    const k = Math.min(Q.n - 1, Math.floor(cr(Q.open0 ? 1 : 0, Q.n))), ci = cpk([0, 1, 2]), ri = cpk([0, 1]);
    if (Q.hidden && Q.hidden.k === k && ci === 2 && ri === 1) continue;
    const [a, b] = L.cols[ci], [c, d] = L.rows[ri];
    const med = Q.style === 'hospital';
    ccache(Q, (a + b) / 2 + (cp(.5) ? -1 : 1) * ((b - a) / 2 - 1.1), d - .6, L.Y(k), 0, cp(.25) ? 'pry' : 'none', med ? 'ruin' : cp(.3) ? 'ruin' : 'city',
      { id: `cc_${Q.id}_${i}`, name: cpk(names), keys: med ? [cpk(['bandage', 'painkiller', 'antibiotic', 'disinfect', 'sutures'])] : [], refill: 4 });
  }
}

/* ---------- hidden rooms: a shelf that slides, or a boarded doorway ---------- */
function secretDoor(Q, id, lx, lz, y, how) {
  const seg = cwall(Q, lx, lz - .64, lx, lz + .64, y, y + 2.35), g = new THREE.Group(), K = hkit();
  if (how === 'shelf') {
    K.box('board', .42, 2.2, .06, 0, 1.1, -.62, 0, 0, 0, 0x5a4a38, 1); K.box('board', .42, 2.2, .06, 0, 1.1, .62, 0, 0, 0, 0x5a4a38, 1); K.box('board', .04, 2.2, 1.3, .2, 1.1, 0, 0, 0, 0, 0x4a3a2a, 1);
    for (let i = 0; i < 5; i++) { K.box('board', .4, .04, 1.24, 0, .1 + i * .5, 0, 0, 0, 0, 0x6a5a48, 1); for (let j = 0; j < 7; j++) if (cp(.75)) K.box('plain', .26, cr(.24, .36), cr(.05, .1), -.02, .28 + i * .5, -.5 + j * .16, 0, 0, cr(-.1, .1), cpk([0x6a2a22, 0x2a4a5a, 0x4a5a2a, 0x7a6a4a, 0x3a3a3a]), 1); }
  } else for (let i = 0; i < 4; i++) K.box('board', .06, .18, 1.5, 0, .5 + i * .5, 0, cr(-.15, .15), 0, 0, tint(cpk(WOODC)), 1);
  K.build(g, true, true);
  const off = how === 'shelf' ? -.32 : -.12, [x, z] = Q.W(lx + off, lz); g.position.set(x, y, z); g.rotation.y = Q.yaw; Q.gi.add(g);
  const D = CDOORS[id] = { seg, g, open: false, how, x, z, dx: Q.s, dz: Q.c, k: 0, y };
  cit(Q, lx - 1.1, lz, y, () => D.open ? null : how === 'shelf' ? 'A cold draught behind this shelf · push it aside' : toolOK('crowbar') ? 'A boarded-up doorway · pry the boards off' : 'A boarded-up doorway · a crowbar would shift these',
    () => { if (how !== 'shelf' && !toolOK('crowbar')) { sfx('no'); toast('Nailed fast — you need a crowbar', 2.2); return; } startChan({ l: how === 'shelf' ? 'Shoving the shelf' : 'Prying the boards', t: 1.6, fn: () => openDoor(id) }); }, 1.9);
  cit(Q, lx + 1.1, lz, y, () => D.open ? null : 'Force the way out from this side', () => startChan({ l: 'Forcing it', t: 1.2, fn: () => openDoor(id) }), 1.9);
}
function openDoor(id, quiet) {
  const D = CDOORS[id]; if (!D || D.open) return; D.open = true; D.seg.on = false; cityF().open[id] = 1;
  if (D.how === 'shelf') CANIM.push(dt => { D.k = Math.min(1, D.k + dt * (quiet ? 99 : 1.4)); D.g.position.set(D.x + D.dx * 1.35 * D.k, D.y, D.z + D.dz * 1.35 * D.k); return D.k < 1; });
  else CANIM.push(dt => { D.k = Math.min(1, D.k + dt * (quiet ? 99 : 2)); D.g.rotation.z = -D.k * 1.4; D.g.position.y = D.y - D.k * .2; if (D.k >= 1) D.g.visible = false; return D.k < 1; });
  if (!quiet) { sfx('thud'); puff(D.x, D.y + 1.2, D.z, 0xb8a890, 8, 1.5, .1, .7); toast(D.how === 'shelf' ? 'The shelf grinds aside — there’s a room behind it' : 'The boards come away — a sealed room', 3); save(); }
}
function hiddenRoom(Q) {
  const H = Q.hidden; if (!H) return; const L = Q.L, [a, b] = L.cols[2], [c, d] = L.rows[1], y = L.Y(H.k), K = Q.KI;
  K.box('board', 2, .4, .9, b - 1.2, y + .2, c + .7, 0, 0, 0, 0x5a4a38, 1); K.box('cloth', 1.9, .12, .85, b - 1.2, y + .46, c + .7, 0, 0, 0, 0x6a5a4a, 1); cbox(Q, b - 1.2, c + .7, 1, .45, y, y + .5);
  bones(K, (a + b) / 2 + .4, y, d - .6, Math.PI, 1); bones(K, a + 1.3, y, (c + d) / 2, Math.PI / 2 + .4);
  K.box('board', 1.1, .75, .6, b - .9, y + .375, d - .5, 0, 0, 0, 0x6a5a48, 1); cbox(Q, b - .9, d - .5, .55, .3, y, y + .8);
  lorePt(Q, K, b - .9, d - .5, y + .76, H.lore, 'note');
  ccache(Q, a + 1, d - .6, y, 0, 'none', Q.style === 'police' ? 'mil' : 'op', { id: `cc_${Q.id}_hidden`, name: Q.style === 'police' ? 'The bricked-up armoury' : 'A hidden stash', big: 1, rolls: 2, refill: 6, keys: Q.style === 'police' ? ['ammo_556', 'ammo_9'] : [] });
  for (let i = 0; i < 6; i++) K.box('plain', cr(.2, .4), cr(.2, .4), cr(.2, .4), cr(a + .6, b - .6), y + .15, cr(c + .6, d - .6), 0, cr(0, 3), 0, cpk([0x6a5a3a, 0x5a6a4a, 0x8a7a5a]), 1);
}

/* ---------- weak floors: patched boards over a hole; linger and they go ---------- */
function weakFloors(Q) {
  for (const [i, W] of Q.weakAt.entries()) {
    const [a, b, c, d] = W.r, y = Q.L.Y(W.k), cx = (a + c) / 2, cz = (b + d) / 2, wd = c - a, dp = d - b, f = cfloor(Q, cx, cz, wd / 2, dp / 2, y);
    const g = new THREE.Group(), K = hkit();
    for (let j = 0; j < 7; j++) K.box('board', wd / 7 - .05, .06, dp + cr(-.2, .1), -wd / 2 + (j + .5) * wd / 7, -.03 - (j % 2) * .02, cr(-.05, .05), 0, cr(-.04, .04), cr(-.03, .03), tint(cpk(WOODC)), 1);
    for (const jz of [-dp / 3, dp / 3]) K.box('board', wd + .3, .12, .14, 0, -.14, jz, 0, 0, 0, 0x4a3a2a, 1);
    // the hole's ragged edge in the slab
    for (let j = 0; j < 8; j++) { const t = j / 8 * Math.PI * 2; K.box('conc', cr(.3, .7), .3, cr(.2, .4), Math.cos(t) * (wd / 2 + .1), -.15, Math.sin(t) * (dp / 2 + .1), 0, t, 0, 0x8a857c, 1); }
    K.build(g, true, true);
    const [x, z] = Q.W(cx, cz); g.position.set(x, y, z); g.rotation.y = Q.yaw; Q.gi.add(g);
    WEAK.push({ id: `${Q.id}_w${W.k}_${i}`, f, g, y, yb: Q.L.Y(W.k - 1), t: 0, gone: false });
  }
}
function collapse(W, quiet) {
  if (W.gone) return; W.gone = true; const i = FLOORS.indexOf(W.f); if (i >= 0) FLOORS.splice(i, 1); cityF().coll[W.id] = 1;
  if (quiet) { W.g.position.y = W.yb + .1; W.g.rotation.z = .25; return; }
  let vy = 0; CANIM.push(dt => { vy -= 22 * dt; W.g.position.y += vy * dt; W.g.rotation.z += dt * .8; if (W.g.position.y <= W.yb + .1) { W.g.position.y = W.yb + .1; puff(W.f.cx, W.yb + .4, W.f.cz, 0xb0a490, 14, 3, .14, .9); sfx('thud'); return false; } return true; });
  sfx('thud'); puff(W.f.cx, W.y, W.f.cz, 0xb8ab94, 18, 3, .12, .8); toast('The floor gives way!', 2.4);
  if (Math.hypot(P.x - W.f.cx, P.z - W.f.cz) < 3) { P.onGround = false; P.vy = Math.min(P.vy, -1); hurtPlayer(6, P.x + .01, P.z); }
  save();
}

/* ---------- basements, the Hollis shelter ---------- */
function cityGo(x, z, y, under, msg) {
  let el = $('cityFade');
  if (!el) { el = document.createElement('div'); el.id = 'cityFade'; Object.assign(el.style, { position: 'fixed', inset: '0', background: '#050505', opacity: '0', transition: 'opacity .22s', pointerEvents: 'none', zIndex: 40 }); document.body.appendChild(el); }
  el.style.opacity = '1'; sfx('step', 1.2);
  setTimeout(() => { P.x = x; P.z = z; P.y = y; P.eyeY = y; P.vx = P.vz = P.vy = 0; P.under = !!under; P.onGround = true; cityT = 0; if (msg) toast(msg, 2.4); setTimeout(() => { el.style.opacity = '0'; }, 120); }, 240);
}
const goQ = (Q, lx, lz, y, under, msg) => { const [x, z] = Q.W(lx, lz); cityGo(x, z, y, under, msg); };
function ladder(K, x, y0, y1, z, ry = 0) { const h = y1 - y0; for (const s of [-.22, .22]) K.box('metal', .05, h, .05, x + Math.cos(ry) * s, y0 + h / 2, z - Math.sin(ry) * s, 0, ry, 0, 0x5a5e60); for (let y = y0 + .3; y < y1; y += .32) K.box('metal', .46, .04, .04, x, y, z, 0, ry, 0, 0x6a6e70); }
function cityBasement(Q, root) {
  const L = Q.L, yb = Q.yb = Q.lo - 3.9, yc = yb + 3.1, g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: Q.x, z: Q.z, r: Math.hypot(L.hw, L.hd) });
  const K = hkit(); K.at(Q.base); const ix = L.ix1, iz = L.iz1;
  K.box('conc', ix * 2, .3, iz * 2, 0, yb - .15, 0, 0, 0, 0, 0x6a6660, 2); K.box('conc', ix * 2, .3, iz * 2, 0, yc + .15, 0, 0, 0, 0, 0x7a766e, 2);
  for (const [w, dd, x, z] of [[ix * 2 + .4, .3, 0, iz + .15], [ix * 2 + .4, .3, 0, -iz - .15], [.3, iz * 2, ix + .15, 0], [.3, iz * 2, -ix - .15, 0]]) K.box('block', w, yc - yb, dd, x, (yb + yc) / 2, z, 0, 0, 0, 0x8a867c, 1.6);
  cwall(Q, -ix, -iz, ix, -iz, yb - 1, yc); cwall(Q, ix, -iz, ix, iz, yb - 1, yc); cwall(Q, ix, iz, -ix, iz, yb - 1, yc); cwall(Q, -ix, iz, -ix, -iz, yb - 1, yc);
  cfloor(Q, 0, 0, ix, iz, yb, 0, UNDER);
  for (const px of [-ix / 2, ix / 2]) for (const pz of [-iz / 2, iz / 2]) { K.box('conc', .45, yc - yb, .45, px, (yb + yc) / 2, pz, 0, 0, 0, 0x7a766e, 1); cbox(Q, px, pz, .23, .23, yb, yc); }
  for (let i = 0; i < 3; i++) K.cyl('metal', .09, .09, ix * 2 - .4, 8, 0, yc - .25 - i * .22, -iz + .4 + i * .25, 0, 0, Math.PI / 2, 0x6a5040);   // pipes
  const lamp = (x, z) => { K.box('glow', .5, .05, .12, x, yc - .05, z, 0, 0, 0, 0x9a8a60); };
  lamp(-ix / 2, 0); lamp(ix / 2, 0);
  // the hatch: back-right room on the ground floor (open-plan shops: the back corner)
  const hx = (L.xs2 + L.ix1) / 2, hz = (L.rows[0][0] + L.zm) / 2;
  Q.KI.box('board', 1.1, .06, 1.1, hx, Q.y0 + .03, hz, 0, 0, 0, 0x5a4a38, 1); Q.KI.box('metal', .3, .04, .05, hx, Q.y0 + .07, hz + .4, 0, 0, 0, 0x8a8e90);
  ladder(K, hx, yb, yc + .3, hz - .45);
  cit(Q, hx, hz, Q.y0, () => 'Lift the hatch · climb down to the basement', () => goQ(Q, hx, hz + .6, yb, true, Q.cellar === 'morgue' ? 'The morgue' : 'The basement'), 1.6);
  cit(Q, hx, hz, yb, () => 'Climb the ladder up', () => goQ(Q, hx, hz + 1, Q.y0, false), 1.6, 2.4);
  // what's down here
  const shelf = (x, z, ry) => { for (let i = 0; i < 4; i++) K.box('metal', 2, .05, .5, x, yb + .2 + i * .55, z, 0, ry, 0, 0x5a5e60); for (const s of [-.95, .95]) K.box('metal', .05, 2, .5, x + Math.cos(ry) * s, yb + 1, z - Math.sin(ry) * s, 0, ry, 0, 0x4a4e50);
    for (let i = 0; i < 6; i++) K.box('plain', cr(.25, .45), cr(.2, .35), .35, x + Math.cos(ry) * cr(-.8, .8), yb + .4 + Math.floor(cr(0, 4)) * .55, z, 0, ry, 0, cpk([0x7a6a4a, 0x5a6a5a, 0x8a5a3a]), 1); };
  if (Q.cellar === 'morgue') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { K.box('metal', .9, .7, .1, -ix + 1 + i * 1, yb + .5 + j * .75, -iz + .2, 0, 0, 0, 0x9a9e9e); K.box('metal', .3, .05, .05, -ix + 1 + i * 1, yb + .7 + j * .75, -iz + .27, 0, 0, 0, 0x5a5e60); }
    for (const x of [-2, 1.5]) { K.box('metal', .8, .1, 2, x, yb + .85, 1, 0, 0, 0, 0xa8acac); for (const s of [-.35, .35]) K.cyl('metal', .02, .02, .8, 5, x + s, yb + .4, 1, 0, 0, 0, 0x6a6e70); cbox(Q, x, 1, .4, 1, yb, yb + .9); }
    bones(K, -2, yb + .9, 1.6, 0); bones(K, ix - 1.2, yb, -1, -Math.PI / 2, 1);
    K.box('board', 1.4, .76, .7, ix - 1.4, yb + .38, iz - .6, 0, 0, 0, 0x6a6e70, 1); cbox(Q, ix - 1.4, iz - .6, .7, .35, yb, yb + .8);
    const it = lorePt(Q, K, ix - 1.4, iz - .6, yb + .76, 'mercy_morgue', 'rec'); it.dy = 1.6;
    ccache(Q, -ix + 1.4, iz - .6, yb, 0, 'pry', 'ruin', { id: 'cc_mercy_morgue', name: 'The morgue’s drug safe', big: 1, rolls: 1, refill: 5, keys: ['medkit', 'antibiotic', 'surgical_kit'] });
  } else {
    shelf(-ix + 1.2, 0, Math.PI / 2); shelf(ix - 3, -iz + .5, 0);
    K.cyl('metal', .6, .6, 1.8, 12, ix - 1.2, yb + .9, iz - 1.2, 0, 0, 0, 0x7a5a40); cbox(Q, ix - 1.2, iz - 1.2, .6, .6, yb, yb + 1.8);   // boiler
    ccache(Q, -ix + 1.4, iz - .7, yb, 0, Q.cellar === 'hollis' ? 'none' : 'pry', 'city', { id: `cc_${Q.id}_cellar`, name: Q.cellar === 'hollis' ? 'Hollis’s back stock' : 'A padlocked cellar locker', rolls: 1, refill: 4, keys: Q.cellar === 'hollis' ? ['nails', 'screws', 'rope'] : [] });
  }
  if (Q.cellar === 'hollis') hollisShelter(Q, root, K, yb);
  K.build(g, true, true);
}
function hollisShelter(Q, root, KB, yb) {
  // under a crate in the corner of Hollis's basement, a hatch; below, a pre-war shelter behind a keypad blast door
  const L = Q.L, ys = Q.ys = yb - 6.2, yc = ys + 3, g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: Q.x, z: Q.z, r: 12 });
  const K = hkit(); K.at(Q.base); const hx = -L.ix1 + 1.4, hz = -L.iz1 + 1.4;
  const crate = new THREE.Group(), KC = hkit(); KC.box('board', 1.2, .8, 1.2, 0, .4, 0, 0, 0, 0, 0x6a5a40, 1); KC.box('board', 1.25, .06, 1.25, 0, .82, 0, 0, 0, 0, 0x5a4a32, 1); KC.build(crate, true, true);
  const [cx, cz] = Q.W(hx, hz); crate.position.set(cx, yb, cz); crate.rotation.y = Q.yaw; Q.gi.add(crate);
  KB.box('metal', 1, .05, 1, hx, yb + .02, hz, 0, 0, 0, 0x4a4e50); KB.box('metal', .6, .04, .06, hx, yb + .06, hz, 0, 0, 0, 0x8a8e90);
  const crateSeg = cbox(Q, hx, hz, .6, .6, yb, yb + .85);
  HOLLIS_HATCH = { crate, seg: crateSeg, cx, cz, yb };
  cit(Q, hx + 1.1, hz + 1.1, yb, () => cityF().open.hollis_hatch ? null : 'This crate doesn’t sit right · shift it', () => startChan({ l: 'Shifting the crate', t: 1.4, fn: () => revealHatch() }), 1.9);
  cit(Q, hx, hz, yb, () => cityF().open.hollis_hatch ? 'A hatch in the floor · climb down' : null, () => goQ(Q, -5.5 + 1.6, 0, ys, true, 'Shelter 12'), 1.6);
  // the shelter: a vestibule (ladder, keypad), the blast door, the room
  const sx0 = -5.5, sx1 = 5.5, sz0 = -3.8, sz1 = 3.8, dX = -2.2;
  K.box('conc', sx1 - sx0 + .6, .3, sz1 - sz0 + .6, (sx0 + sx1) / 2, ys - .15, 0, 0, 0, 0, 0x6a6a64, 2); K.box('conc', sx1 - sx0 + .6, .3, sz1 - sz0 + .6, (sx0 + sx1) / 2, yc + .15, 0, 0, 0, 0, 0x6a6a64, 2);
  for (const [w, dd, x, z] of [[sx1 - sx0 + .6, .3, 0, sz1 + .15], [sx1 - sx0 + .6, .3, 0, sz0 - .15], [.3, sz1 - sz0, sx1 + .15, 0], [.3, sz1 - sz0, sx0 - .15, 0]]) K.box('conc', w, yc - ys, dd, x, (ys + yc) / 2, z, 0, 0, 0, 0x8a8a80, 1.6);
  cwall(Q, sx0, sz0, sx1, sz0, ys - 1, yc); cwall(Q, sx1, sz0, sx1, sz1, ys - 1, yc); cwall(Q, sx1, sz1, sx0, sz1, ys - 1, yc); cwall(Q, sx0, sz1, sx0, sz0, ys - 1, yc);
  cfloor(Q, 0, 0, sx1, sz1, ys, 0, UNDER);
  // the bulkhead the door sits in
  K.box('metal', .4, yc - ys, sz1 - sz0 - 2.4, dX, (ys + yc) / 2, -(sz1 - sz0) / 4 - .6, 0, 0, 0, 0x5a5e5a); K.box('metal', .4, yc - ys, sz1 - sz0 - 2.4, dX, (ys + yc) / 2, (sz1 - sz0) / 4 + .6, 0, 0, 0, 0x5a5e5a);
  cwall(Q, dX, sz0, dX, -1.2, ys, yc); cwall(Q, dX, 1.2, dX, sz1, ys, yc);
  const door = new THREE.Group(), KD = hkit(); KD.box('metal', .3, 2.6, 2.4, 0, 1.3, 0, 0, 0, 0, 0x6a7068); KD.cyl('metal', .4, .4, .1, 16, -.2, 1.3, 0, 0, 0, Math.PI / 2, 0x8a8e88); KD.build(door, true, true);
  const [dx, dz] = Q.W(dX, 0); door.position.set(dx, ys, dz); door.rotation.y = Q.yaw; g.add(door);
  const seg = cwall(Q, dX, -1.2, dX, 1.2, ys, yc), D = CDOORS.hollis_door = { seg, g: door, open: false, how: 'blast', x: dx, z: dz, dx: Q.s, dz: Q.c, k: 0, y: ys };
  K.box('metal', .06, .3, .22, dX - .25, ys + 1.4, -1.6, 0, 0, 0, 0x2a2c2e); K.box('glow', .02, .08, .16, dX - .29, ys + 1.48, -1.6, 0, 0, 0, 0x40d070);
  cit(Q, dX - .9, -1.4, ys, () => D.open ? null : cityF().lore.mercy_code ? 'Keypad · key in 4 · 1 · 7 · 7' : 'A keypad · four digits. Somebody must have written them down', () => {
    if (!cityF().lore.mercy_code) { sfx('no'); toast('The keypad wants four digits', 2); return; }
    sfx('radio'); cityF().open.hollis_door = 1; D.open = true; seg.on = false; toast('The bolts draw back. The door swings in.', 3); save();
    CANIM.push(dt => { D.k = Math.min(1, D.k + dt * .7); door.position.set(dx + D.dx * 2.4 * D.k, ys, dz + D.dz * 2.4 * D.k); return D.k < 1; }); }, 1.8);
  ladder(K, sx0 + .8, ys, yc + .4, 0, Math.PI / 2);
  cit(Q, sx0 + 1.2, 0, ys, () => 'Climb the ladder up', () => goQ(Q, hx + 1, hz, yb, true), 1.6);
  // the room
  for (let i = 0; i < 3; i++) { K.box('metal', 2, .06, .9, 3.8, ys + .5 + i * 1, sz0 + .5, 0, 0, 0, 0x5a5e5a); K.box('cloth', 1.9, .12, .8, 3.8, ys + .59 + i * 1, sz0 + .5, 0, 0, 0, 0x5a6a4a, 1); }
  cbox(Q, 3.8, sz0 + .5, 1, .45, ys, yc);
  for (let i = 0; i < 4; i++) K.box('metal', 2.4, .05, .5, 0, ys + .3 + i * .6, sz1 - .3, 0, 0, 0, 0x6a6e70);
  for (let i = 0; i < 14; i++) K.box('plain', cr(.2, .35), cr(.15, .3), .3, cr(-1.1, 1.1), ys + .45 + Math.floor(cr(0, 4)) * .6, sz1 - .3, 0, 0, 0, cpk([0x5a6a4a, 0x8a7a4a, 0x7a3a2a, 0xa8a8a0]), 1);
  K.box('glow', .5, .05, .14, 0, yc - .05, 0, 0, 0, 0, 0xc8b890); K.box('glow', .5, .05, .14, 3.5, yc - .05, 0, 0, 0, 0, 0xc8b890);
  lorePt(Q, K, 1.2, sz0 + .5, ys, 'bunker_terminal', 'term', 0);
  ccache(Q, 4, sz1 - .7, ys, 0, 'none', 'op', { id: 'cc_hollis_shelter', name: 'Shelter 12 stores', big: 1, rolls: 2, refill: 7, keys: ['canned', 'purify_tab', 'medkit'] });
  ccache(Q, -.8, -1.6 - .6, ys, 0, 'none', 'mil', { id: 'cc_hollis_gunsafe', name: 'Shelter gun safe', rolls: 1, refill: 7 });
  K.build(g, true, true);
}
function revealHatch(quiet) {
  const H = HOLLIS_HATCH; if (!H) return; cityF().open.hollis_hatch = 1; for (const s of H.seg) s.on = false;
  H.crate.position.x += 1.3; H.crate.rotation.y += .4; if (!quiet) { sfx('thud'); toast('There’s a hatch under it', 2.4); save(); }
}

/* ---------- rooftops and fire escapes ---------- */
function fireEscape(Q) {
  const L = Q.L, K = Q.KE, x = L.hw, lz = L.iz1 - 3;
  for (let k = 1; k <= Q.n; k++) { const y = k === Q.n ? Q.top : L.Y(k) - .05;
    K.box('metal', 1.4, .06, 3.2, x + .75, y, lz, 0, 0, 0, 0x3a3c3e); K.box('metal', .04, .9, 3.2, x + 1.45, y + .45, lz, 0, 0, 0, 0x3a3c3e);
    if (k < Q.n) K.box('metal', .6, .06, Math.hypot(CFH, 3), x + .75, y + CFH / 2, lz, Math.atan2(CFH, 3) * (k % 2 ? 1 : -1), 0, 0, 0x2e3032); }
  const yg = heightAt(...Q.W(x + 1.6, lz)); ladder(K, x + 1.2, yg, L.Y(1), lz + 1.4, Math.PI / 2);
  cit(Q, x + 1.6, lz + 1.4, yg, () => 'Climb the fire escape to the roof', () => goQ(Q, x - 1.6, lz, Q.top, false, 'The roof'), 2, 2.6);
  cit(Q, x - 1.2, lz, Q.top, () => 'Climb down the fire escape', () => goQ(Q, x + 2.4, lz + 1.4, yg, false), 2, 2.2);
}
function cityRoof(Q) {
  const L = Q.L, K = Q.KE, y = Q.top, kind = Q.roof, rx = L.ix1 - 2.4, rz = L.iz1 - 2.4;
  const sol = (mat, w, h, d, x, z, col) => { K.box(mat, w, h, d, x, y + h / 2, z, 0, 0, 0, col, 1); cbox(Q, x, z, w / 2, d / 2, y, y + h); };
  // the water tank on its legs, and the boxes every roof has
  const tx = L.xs2 + 1.6, tz = (L.zm + L.iz1) / 2;
  if (kind !== 'helipad') { for (const [a, b] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) K.box('metal', .12, 1.6, .12, tx + a, y + .8, tz + b, 0, 0, 0, 0x4a3a30); K.cyl('metal', 1.3, 1.3, 2.4, 14, tx, y + 2.8, tz, 0, 0, 0, 0x7a5a42); K.cyl('metal', 1.4, .1, .6, 14, tx, y + 4.3, tz, 0, 0, 0, 0x5a4a3a); cbox(Q, tx, tz, .9, .9, y, y + 4); }
  for (let i = 0; i < 2; i++) sol('metal', 1.2, .9, .9, L.ix0 + 2 + i * 2, L.iz1 - 1.2, 0x8a8e8a);
  K.cyl('metal', .05, .05, 5, 5, L.ix0 + 1, y + 2.5, L.iz1 - .8, 0, 0, 0, 0x5a5a5a);
  if (kind === 'garden') {
    for (let i = 0; i < 4; i++) { const x = L.ix0 + 3 + i * 2.2, z = (L.zb1 + L.zm) / 2 + 1; sol('board', 1.8, .5, 1, x, z, tint(cpk(WOODC)));
      for (let j = 0; j < 5; j++) K.geo('plain', new THREE.DodecahedronGeometry(cr(.18, .3), 0), htm(x + cr(-.7, .7), y + .62, z + cr(-.35, .35)), cpk([0x4a6a2a, 0x5a7a32, 0x3a5a24]));
      for (let j = 0; j < 3; j++) K.cyl('board', .02, .02, 1.6, 4, x - .6 + j * .6, y + 1.3, z, cr(-.1, .1), 0, cr(-.1, .1), 0x8a7a5a); }
    for (const [x, z] of [[rx, L.zm], [rx - 1.4, L.zm]]) { K.cyl('plain', .4, .38, 1, 12, x, y + .5, z, 0, 0, 0, 0x3a5a7a); cbox(Q, x, z, .4, .4, y, y + 1); }
    K.box('cloth', 3, .04, 2, (L.xs1 + L.xs2) / 2, y + 1.8, rz - .5, .25, 0, 0, 0x6a7a5a, 1); for (const s of [-1.4, 1.4]) K.cyl('board', .04, .04, 1.9, 5, (L.xs1 + L.xs2) / 2 + s, y + .95, rz - 1.3, 0, 0, 0, 0x6a5a48);
    K.box('cloth', 1.9, .1, .8, (L.xs1 + L.xs2) / 2, y + .05, rz - .3, 0, .1, 0, 0x5a4a6a, 1);
    for (let i = 0; i < 6; i++) K.box('cloth', .5, .7, .02, L.ix0 + 2 + i * .7, y + 1.7, L.iz1 - 2.6, 0, 0, cr(-.1, .1), cpk(CLOTHC), 1);
    K.box('metal', .3, .3, .3, (L.xs1 + L.xs2) / 2 + 1.6, y + .15, rz - .2, 0, 0, 0, 0x2a2a2a);
    K.box('board', .9, .6, .6, rx, y + .3, rz, 0, 0, 0, 0x6a5a48, 1); cbox(Q, rx, rz, .45, .3, y, y + .6); lorePt(Q, K, rx, rz, y + .61, 'roof_garden', 'note');
    ccache(Q, rx - 2, rz + .8, y, 0, 'none', 'wild', { id: `cc_${Q.id}_garden`, name: 'The gardener’s chest', rolls: 1, refill: 3, keys: ['seed_bean', 'seed_squash', 'water_boiled'] });
    CZONES.push({ kind: 'quiet', id: Q.id + '_garden', name: 'The rooftop garden', x: Q.x, z: Q.z, r: Math.hypot(L.hw, L.hd), y0: y - .5, y1: y + 6 });
  } else if (kind === 'nest') {
    const nx = L.ix1 - 2.4, nz = 0;
    for (let i = 0; i < 9; i++) { const t = -1.4 + i * .35; K.box('cloth', .9, .35, .5, nx + Math.cos(t) * 1.8, y + .18 + (i % 2) * .35, nz + Math.sin(t) * 1.8, 0, -t, 0, 0x8a7e5a, 1); K.box('cloth', .9, .35, .5, nx + Math.cos(t) * 1.8, y + .53, nz + Math.sin(t) * 1.8, 0, -t + .2, 0, 0x7e7250, 1); }
    K.box('cloth', 3.4, .04, 3, nx, y + 2.2, nz, 0, 0, .1, 0x5a5a3a, 1); for (const [a, b] of [[-1.5, -1.3], [-1.5, 1.3]]) K.cyl('metal', .04, .04, 2.2, 5, nx + a, y + 1.1, nz + b, 0, 0, 0, 0x3a3a3a);
    for (let i = 0; i < 20; i++) K.cyl('shiny', .012, .012, .05, 5, nx + cr(-1.2, 1.2), y + .01, nz + cr(-1.2, 1.2), Math.PI / 2, cr(0, 3), 0, 0xc8a050);
    bones(K, nx - .8, y, nz + .6, Math.PI / 2, 1);
    ccache(Q, nx - .3, nz - .6, y, 0, 'none', 'mil', { id: `cc_${Q.id}_nest`, name: 'A sniper’s nest', big: 1, rolls: 2, refill: 4, keys: ['ammo_762'] });
  } else if (kind === 'helipad') {
    const px = (L.xs1 + L.xs2) / 2 + 1, pz = (L.zm + L.iz1) / 2 - .5;
    K.cyl('plain', 4, 4, .04, 32, px, y + .02, pz, 0, 0, 0, 0x5a5e5a); K.box('plain', .5, .03, 3, px - 1, y + .045, pz, 0, 0, 0, 0xe8e4d8); K.box('plain', .5, .03, 3, px + 1, y + .045, pz, 0, 0, 0, 0xe8e4d8); K.box('plain', 1.5, .03, .5, px, y + .045, pz, 0, 0, 0, 0xe8e4d8);
    // a medevac drone that didn't make it
    K.box('metal', 2.4, .6, 1, px + 1.4, y + .3, pz - 1.6, .1, .5, .2, 0xd8d8d0); K.box('metal', 3.2, .05, .2, px + 1.2, y + .7, pz - 1.4, .1, .9, .3, 0x3a3a3a); K.box('plain', .5, .5, .05, px + 1.6, y + .35, pz - 1.05, .1, .5, .2, 0xc83a2a);
    cbox(Q, px + 1.4, pz - 1.6, 1.3, .7, y, y + .9);
    ccache(Q, px - 2.2, pz + 2.2, y, 0, 'pry', 'arc', { id: 'cc_mercy_drone', name: 'The medevac drone’s cargo', rolls: 2, refill: 5, keys: ['medkit', 'iv'] });
  } else if (kind === 'camp') {
    K.box('cloth', 2.2, 1.3, 2, L.ix0 + 3, y + .65, L.iz1 - 2.2, 0, .3, 0, 0x6a6a4a, 1); cbox(Q, L.ix0 + 3, L.iz1 - 2.2, 1.1, 1, y, y + 1.3);
    for (let i = 0; i < 8; i++) K.box('rock', .25, .18, .25, L.ix0 + 6 + Math.cos(i * .8) * .55, y + .09, L.iz1 - 2.4 + Math.sin(i * .8) * .55, 0, i, 0, 0x6a6660);
    K.box('plain', .8, .06, .8, L.ix0 + 6, y + .03, L.iz1 - 2.4, 0, 0, 0, 0x1a1a1a);
    bones(K, L.ix0 + 4.6, y, L.iz1 - 3.8, .7);
    K.box('conc', .4, .2, .2, tx + 1.4, y + .1, tz + 1.4, 0, .4, 0, 0x9a5a3a); lorePt(Q, K, tx + 1.4, tz + 1.8, y, 'roof_camp', 'note');
    ccache(Q, tx, tz, y, 0, 'none', 'city', { id: `cc_${Q.id}_tank`, name: 'A cache under the water tank', rolls: 2, refill: 5, keys: ['ammo_9', 'bandage'] });
  }
}

/* ---------- the special places ---------- */
function colFree(x, z, r) { for (let i = Math.floor((x - 6) / CELL); i <= Math.floor((x + 6) / CELL); i++) for (let j = Math.floor((z - 6) / CELL); j <= Math.floor((z + 6) / CELL); j++) for (const c of grid.get(gkey(i, j)) || []) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; return true; }
function glowMesh(parent, boxes, mat) {
  if (!boxes.length) return null;
  const g = mergeGeometries(boxes.map(([w, h, d, x, y, z, ry = 0]) => { const b = new THREE.BoxGeometry(w, h, d); b.applyMatrix4(htm(x, y, z, 0, ry, 0)); return b; }));
  const m = new THREE.Mesh(g, mat); m.userData.dyn = 1; parent.add(m); return m;
}
// Kessler St.: the kiosk, the platform, and Line 2 east under the city, coming up inside the Foundry's wall
function buildMetro(Q, root) {
  Q.noStair = 1; Q.open0 = 1; cityBuild(Q, root);
  const L = Q.L, KI = Q.KI, y0 = Q.y0;
  for (let i = 0; i < 4; i++) { const x = -3 + i * 2; KI.box('metal', .12, 1, .9, x, y0 + .5, 0, 0, 0, 0, 0x8a8e90); KI.box('metal', .8, .04, .04, x + .5, y0 + .9, 0, 0, 0, 0, 0xa8aca8); }
  KI.box('board', 2.6, 1.1, 1.6, L.ix1 - 1.6, y0 + .55, L.iz1 - 1.2, 0, 0, 0, 0x5a4a3a, 1); KI.box('glass', 2.6, 1.2, .05, L.ix1 - 1.6, y0 + 1.7, L.iz1 - 2, 0, 0, 0); cbox(Q, L.ix1 - 1.6, L.iz1 - 1.2, 1.3, .8, y0, y0 + 1.1);
  for (let i = 0; i < 6; i++) KI.poster(Math.floor(cr(0, 8)), .9, 1.3, L.ix0 + 1.5 + i * 2.1, y0 + 1.7, L.iz0 + .02, 0);
  const it = lorePt(Q, KI, L.ix0 + 1.6, L.iz1 - .6, y0, 'kessler_poster', 'none'); KI.box('paper', 1.2, 1.6, .02, L.ix0 + 1.6, y0 + 1.6, L.iz1 - .05, 0, Math.PI, 0, 0xffffff);
  // the stair door at the back
  KI.box('metal', 2.2, 2.6, .1, 3.5, y0 + 1.3, L.iz0 + .05, 0, 0, 0, 0x3a3e40); KI.box('plain', 1.9, 2.4, .02, 3.5, y0 + 1.2, L.iz0 + .12, 0, 0, 0, 0x0a0a0a);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), hSignMat('LINE 2 ↓', 'stencil')); { const [x, z] = Q.W(3.5, L.iz0 + .16); sg.position.set(x, y0 + 2.95, z); sg.rotation.y = Q.yaw; Q.gi.add(sg); }
  dressRooms(Q); cityFinish(Q);
  // ----- the line (world-aligned) -----
  const F = FOUNDRY, TS = { x: 0, z: 0, yaw: 0 }; siteFrame(TS);
  const zT = Q.z, sx0 = Q.x - 12, sx1 = Q.x + 28, tz0 = zT - 1.2, tz1 = zT + 4.4, tc = zT + 1.6;
  let xE = null; for (let x = F.x - 58; x <= F.x - 22; x += 2) { if (Math.hypot(x - F.x, tc - F.z) > F.R - 8) continue; if (colFree(x, tc, 2.8)) { xE = x; break; } }
  if (xE == null) xE = F.x - 40;
  let mh = 1e9; for (let x = sx0 - 4; x <= xE + 8; x += 4) for (const dz of [-9, 0, 7]) mh = Math.min(mh, heightAt(x, zT + dz));
  const yT = mh - 7.6, yP = yT + 1, hS = yT + 5.2, hT = yT + 4.4, xEnd = xE + 3;
  const g = TS.g = new THREE.Group(); root.add(g); g.visible = false; CUN_G.push({ g, x: (sx0 + xEnd) / 2, z: zT, r: (xEnd - sx0) / 2 + 12 });
  const K = hkit(), tile = 0xd8d0b8, dirt = 0x6a6258;
  // floors, ceiling, walls
  K.box('conc', sx1 - sx0, 1.3, tz0 - (zT - 7), (sx0 + sx1) / 2, yP - .65, (zT - 7 + tz0) / 2, 0, 0, 0, 0x8a8478, 2);
  K.box('conc', xEnd - sx0, .3, tz1 - tz0, (sx0 + xEnd) / 2, yT - .15, (tz0 + tz1) / 2, 0, 0, 0, 0x5a554e, 2);
  K.box('conc', sx1 - sx0, .4, tz1 - (zT - 7), (sx0 + sx1) / 2, hS + .2, (zT - 7 + tz1) / 2, 0, 0, 0, 0x8a867e, 3);
  K.box('conc', xEnd - sx1, .4, tz1 - tz0, (sx1 + xEnd) / 2, hT + .2, (tz0 + tz1) / 2, 0, 0, 0, 0x6a665e, 3);
  K.box('conc', sx1 - sx0, hS - yP, .3, (sx0 + sx1) / 2, (yP + hS) / 2, zT - 7.15, 0, 0, 0, tile, 1.2);
  K.box('conc', .3, hS - yT, tz1 - (zT - 7), sx0 - .15, (yT + hS) / 2, (zT - 7 + tz1) / 2, 0, 0, 0, tile, 1.2);
  K.box('block', xEnd - sx0, hS - yT, .3, (sx0 + xEnd) / 2, (yT + hS) / 2, tz1 + .15, 0, 0, 0, dirt, 1.6);
  K.box('block', xEnd - sx1, hT - yT, .3, (sx1 + xEnd) / 2, (yT + hT) / 2, tz0 - .15, 0, 0, 0, dirt, 1.6);
  K.box('conc', .3, hS - yP, tz0 - (zT - 7), sx1 + .15, (yP + hS) / 2, (zT - 7 + tz0) / 2, 0, 0, 0, tile, 1.2);
  K.box('conc', .3, hS - hT, tz1 - tz0, sx1 + .15, (hT + hS) / 2, (tz0 + tz1) / 2, 0, 0, 0, tile, 1.2);
  K.box('block', .3, hT - yT, tz1 - tz0, xEnd + .15, (yT + hT) / 2, (tz0 + tz1) / 2, 0, 0, 0, dirt, 1.6);
  K.box('plain', sx1 - sx0, .02, .3, (sx0 + sx1) / 2, yP + .01, tz0 - .2, 0, 0, 0, 0xc8a830);   // the yellow line
  cfloor(TS, (sx0 + sx1) / 2, (zT - 7 + tz0) / 2, (sx1 - sx0) / 2, (tz0 - (zT - 7)) / 2, yP, 0, UNDER);
  cfloor(TS, (sx0 + xEnd) / 2, (tz0 + tz1) / 2, (xEnd - sx0) / 2, (tz1 - tz0) / 2, yT, 0, UNDER);
  cwall(TS, sx0, zT - 7, sx1, zT - 7, yT - 1, hS); cwall(TS, sx0, zT - 7, sx0, tz1, yT - 1, hS); cwall(TS, sx0, tz1, xEnd, tz1, yT - 1, hS);
  cwall(TS, sx1, tz0, xEnd, tz0, yT - 1, hT); cwall(TS, sx1, zT - 7, sx1, tz0, yT - 1, hS); cwall(TS, xEnd, tz0, xEnd, tz1, yT - 1, hT);
  // rails and sleepers, ribs, cables
  for (const s of [-.72, .72]) K.box('metal', xEnd - sx0, .14, .08, (sx0 + xEnd) / 2, yT + .1, tc + s, 0, 0, 0, 0x6a5a4a);
  for (let x = sx0 + .5; x < xEnd; x += .9) K.box('board', .25, .1, 2.2, x, yT + .03, tc, 0, cr(-.05, .05), 0, 0x3a3228, 1);
  for (let x = sx1 + 4; x < xEnd; x += 5) { K.box('conc', .4, .3, tz1 - tz0, x, hT - .15, (tz0 + tz1) / 2, 0, 0, 0, 0x5a564e, 2); K.box('conc', .4, hT - yT, .2, x, (yT + hT) / 2, tz0 + .1, 0, 0, 0, 0x5a564e, 2); K.box('conc', .4, hT - yT, .2, x, (yT + hT) / 2, tz1 - .1, 0, 0, 0, 0x5a564e, 2); }
  for (let i = 0; i < 3; i++) K.cyl('metal', .03, .03, xEnd - sx1, 5, (sx1 + xEnd) / 2, yT + 3 - i * .14, tz1 - .25, 0, 0, Math.PI / 2, 0x1a1a1a);
  // station: columns, benches, posters, the sign
  for (let x = sx0 + 4; x < sx1 - 2; x += 7) { K.cyl('conc', .32, .32, hS - yP, 10, x, (yP + hS) / 2, tz0 - 1.2, 0, 0, 0, 0xc8c0a8); cbox(TS, x, tz0 - 1.2, .32, .32, yP, hS); }
  for (let x = sx0 + 7.5; x < sx1 - 4; x += 7) { K.box('board', 2, .1, .5, x, yP + .45, zT - 6.4, 0, 0, 0, 0x6a5038, 1); for (const s of [-.8, .8]) K.box('metal', .06, .45, .45, x + s, yP + .22, zT - 6.4, 0, 0, 0, 0x3a3a3a); }
  for (let i = 0; i < 8; i++) K.poster(Math.floor(cr(0, 8)), 1, 1.4, sx0 + 3 + i * 3.4, yP + 1.9, zT - 6.98, 0);
  for (const x of [sx0 + 12, sx0 + 26]) { const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), hSignMat('KESSLER ST', 'stencil')); sg2.position.set(x, yP + 3.4, zT - 6.98); g.add(sg2); }
  // a carriage that never left
  { const cx = sx0 + 8, cl = 13; K.box('metal', cl, 3, 2.8, cx, yT + 1.8, tc, 0, 0, .02, 0x5a6a62); K.box('metal', cl + .2, .25, 2.9, cx, yT + 3.35, tc, 0, 0, .02, 0x4a5650);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) K.box('glass', 1.6, .9, .03, cx - cl / 2 + 1.6 + i * 2.5, yT + 2.3, tc + s * 1.42); K.box('plain', 1.1, 2, .03, cx + 3, yT + 1.6, tc - 1.42, 0, 0, 0, 0x0a0a0a);
    cbox(TS, cx, tc, cl / 2, 1.45, yT, yT + 3.4); }
  // records: a skeleton on the platform, the bricked branch
  bones(K, sx1 - 9, yP, zT - 6.6, 0, 1); lorePt(TS, K, sx1 - 9, zT - 5.9, yP, 'tunnel_note', 'note');
  const TL = xEnd - sx1, bx = sx1 + TL * .22; K.box('block', 3.6, 3.6, .3, bx, yT + 1.8, tz1 - .05, 0, 0, 0, 0x8a4a3a, .8);
  for (let i = 0; i < 4; i++) K.box('plain', .04, 1.4, .02, bx - .3 + i * .18, yT + 1.6, tz1 - .22, 0, 0, .12, 0x1a1210);
  lorePt(TS, K, bx, tz1 - .9, yT, 'tunnel_claws', 'none');
  // power: the generator lights the line and lifts the gate
  const gx = sx1 - 4.5, gz = zT - 5.7;
  K.box('metal', 1.8, 1.2, 1, gx, yP + .6, gz, 0, 0, 0, 0x6a7a3a); K.cyl('metal', .12, .12, .2, 8, gx + .6, yP + 1.3, gz, 0, 0, 0, 0x3a3a3a); K.cyl('metal', .06, .06, 2.4, 6, gx - .9, yP + 2.4, gz, 0, 0, 0, 0x2a2a2a); cbox(TS, gx, gz, .9, .5, yP, yP + 1.2);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, toneMapped: false }), redMat = new THREE.MeshBasicMaterial({ color: 0x6a1408, toneMapped: false });
  const lamps = [], reds = [];
  for (let x = sx0 + 3; x < sx1; x += 6) lamps.push([1.4, .08, .2, x, hS - .06, zT - 3.5]);
  for (let x = sx1 + 3; x < xEnd; x += 8) lamps.push([.6, .12, .12, x, yT + 3.5, tz1 - .12]);
  for (let x = sx0 + 6; x < xEnd; x += 22) reds.push([.2, .2, .1, x, yT + 3.9, tz0 + .1]);
  glowMesh(g, lamps, lampMat); glowMesh(g, reds, redMat);
  const gate = new THREE.Group(), KG = hkit(); for (let i = 0; i < 12; i++) KG.cyl('metal', .04, .04, hT - yT, 5, 0, (hT - yT) / 2, -2.6 + i * .47, 0, 0, 0, 0x4a4e50); KG.box('metal', .1, .12, tz1 - tz0, 0, hT - yT - .4, 0, 0, 0, 0, 0x4a4e50); KG.box('metal', .1, .12, tz1 - tz0, 0, 1.2, 0, 0, 0, 0, 0x4a4e50); KG.build(gate, true, true);
  gate.position.set(sx1 + .8, yT, (tz0 + tz1) / 2); g.add(gate);
  const gseg = cwall(TS, sx1 + .8, tz0, sx1 + .8, tz1, yT - 1, hT);
  CITY_POWER = { on: false, lampMat, gate, gseg, yT, k: 0 };
  cit(TS, gx, gz + .9, yP, () => CITY_POWER.on ? 'The generator hums' : cnt('fuel') > 0 ? 'Fuel the generator (1 fuel) and pull the cord' : 'A generator · dry. It needs fuel', () => {
    if (CITY_POWER.on) return; if (cnt('fuel') <= 0) { sfx('no'); toast('Needs fuel', 2); return; }
    startChan({ l: 'Fuelling the generator', t: 2, fn: () => { take('fuel', 1); powerOn(); } }); }, 2, 2);
  cit(TS, sx1 - .8, tc, yT, () => CITY_POWER.on ? null : 'A barred gate across the line · no power to lift it', () => { sfx('no'); toast('There must be power on this platform somewhere', 2.4); }, 2.2, 2);
  // the leak, the collapse, a maintenance locker
  const lx = sx1 + TL * .45, leak = [];
  K.cyl('metal', .25, .25, 6, 10, lx, yT + 3.1, tz0 + .4, 0, 0, Math.PI / 2, 0x5a6a4a); K.box('metal', .6, .6, .6, lx + .4, yT + 3.1, tz0 + .4, .4, .4, 0, 0x4a5a3a);
  for (let i = 0; i < 4; i++) leak.push([cr(1, 2.4), .02, cr(1, 2), lx + cr(-3, 3), yT + .02, tc + cr(-1.5, 1.5), cr(0, 3)]);
  glowMesh(g, leak, new THREE.MeshBasicMaterial({ color: 0x5aff5a, toneMapped: false, transparent: true, opacity: .55 }));
  CZONES.push({ kind: 'rad', x: lx, z: tc, r: 12, k: .8, under: true });
  const rx = sx1 + TL * .7; for (let i = 0; i < 14; i++) K.geo('conc', new THREE.DodecahedronGeometry(cr(.5, 1.3), 0), htm(rx + cr(-3, 3), yT + cr(.3, 1.6), tz0 + cr(.4, 2.4), cr(0, 3), cr(0, 3), 0), 0x7a746a);
  K.box('conc', 5, .5, 3, rx, hT - .6, tz0 + 1.2, .3, .2, .15, 0x6a665e, 2); cbox(TS, rx, tz0 + 1.3, 3, 1.3, yT, hT);
  ccache(TS, xEnd - 7, tz1 - .6, yT, Math.PI, 'cutter', 'mil', { id: 'cc_line_locker', name: 'Line maintenance locker', rolls: 2, refill: 5, keys: ['fuel'] });
  // up into the Foundry
  ladder(K, xE, yT, hT + .3, tz1 - .4);
  K.box('glow', .3, .1, .3, xE, hT - .1, tz1 - .9, 0, 0, 0, 0xb8a878);
  const mg = new THREE.Group(); { const lid = mesh(new THREE.CylinderGeometry(.55, .55, .06, 18), S(0x4a4a46, { metalness: .7, roughness: .5 }), 0, .03, 0, mg); for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(.9, .065, .05), S(0x3a3a36, { metalness: .7 }), 0, .035, i * .16, mg); }
  mg.position.set(xE, heightAt(xE, tz1 - .4) + .01, tz1 - .4); root.add(mg);
  cit(TS, xE, tz1 - .4, yT, () => 'Climb the ladder · up through a manhole', () => cityGo(xE + 1.2, tz1 - .4, heightAt(xE + 1.2, tz1 - .4), false, 'The Foundry — inside Ironjaw’s wall'), 2, 2.4);
  cit(TS, xE, tz1 - .4, heightAt(xE, tz1 - .4), () => 'A manhole · lift it and climb down', () => cityGo(xE - 1.2, tc, yT, true, 'Line 2'), 1.8, 2.6);
  // the stairs up to the street (to the kiosk)
  K.box('metal', 2.2, 2.6, .1, sx0 + 4, yP + 1.3, zT - 6.95, 0, 0, 0, 0x3a3e40);
  cit(TS, sx0 + 4, zT - 6.1, yP, () => 'Take the stairs up to the street', () => goQ(Q, 3.5, L.iz0 + 1.4, y0, false, 'Kessler St.'), 2, 2);
  cit(Q, 3.5, L.iz0 + .8, y0, () => 'Take the stairs down to the platform', () => cityGo(sx0 + 4, zT - 5.4, yP, true), 2, 2);
  K.build(g, true, true);
  REGIONS.push({ id: 'kessler', name: 'THE KESSLER LINE', sub: 'Line 2, under the city · it runs east, toward the Foundry', area: (x, z) => !!P.under && x > sx0 - 2 && x < xEnd + 2 && Math.abs(z - zT) < 9 });
}
function powerOn(quiet) {
  const C = CITY_POWER; if (!C || C.on) return; C.on = true; cityF().power = 1; C.gseg.on = false; C.lampMat.color.setRGB(1.3, 1.12, .8);
  CANIM.push(dt => { C.k = Math.min(1, C.k + dt * (quiet ? 99 : .35)); C.gate.position.y = C.yT + C.k * 3.6; return C.k < 1; });
  if (!quiet) { sfx('radio'); toast('The lights stutter on down the line. The gate grinds up.', 3.4); save(); }
}
// Cinder No. 4: a cracked containment dome, a cooling-tower stub, a control building, green water. Hot.
function buildReactor(Q, root) {
  siteFrame(Q); const g = Q.g = new THREE.Group(); root.add(g); const K = hkit(); K.at(Q.base);
  const hy = (lx, lz) => heightAt(...Q.W(lx, lz));
  const dx = 7, dz = -7, dy = hy(dx, dz);
  const dome = new THREE.SphereGeometry(8, 28, 14, .6, Math.PI * 2 - .9, 0, Math.PI / 2); K.geo('conc', dome, htm(dx, dy - .3, dz), 0xa8a49a);
  K.cyl('conc', 8.2, 8.4, 2.2, 28, dx, dy + .8, dz, 0, 0, 0, 0x8a8680);
  for (let i = 0; i < 10; i++) K.geo('conc', new THREE.DodecahedronGeometry(cr(.6, 1.6), 0), htm(dx + cr(-3, 3), dy + cr(.2, 1.4), dz - 9 + cr(-2, 1), cr(0, 3), cr(0, 3), 0), 0x9a968c);
  { const [x, z] = Q.W(dx, dz); addCol(x, z, 8.3, 12); }
  const lathe = new THREE.LatheGeometry([...Array(12)].map((_, i) => new THREE.Vector2(5 - Math.sin(i / 11 * Math.PI) * 1.1 - i * .05, i * .9)), 24);
  const tx = -8, tz = -8; K.geo('conc', lathe, htm(tx, hy(tx, tz) - .2, tz), 0x9a968c); { const [x, z] = Q.W(tx, tz); addCol(x, z, 5, 10); }
  // the fence, a gap on the street side
  for (let i = 0; i < 62; i++) { const t = i / 62 * Math.PI * 2, lx = Math.cos(t) * 20.5, lz = Math.sin(t) * 20.5; if (Math.abs(angWrap(t - Math.PI / 2)) < .12) continue;
    const [x, z] = Q.W(lx, lz), f = mesh(lattice(2.1, 2.6, 0x8a8e90, 1), VCOL, x, heightAt(x, z), z, g); f.rotation.y = -t + Math.PI / 2 + Q.yaw; addCol(x, z, 1.05, 2.6); }
  for (const t of [Math.PI / 2 - .2, Math.PI / 2 + .2, 0, Math.PI]) { const [x, z] = Q.W(Math.cos(t) * 20.8, Math.sin(t) * 20.8), sg = new THREE.Mesh(new THREE.PlaneGeometry(2, .5), hSignMat('DANGER · RADIATION', 'stencil')); sg.position.set(x, heightAt(x, z) + 1.6, z); sg.rotation.y = -t + Math.PI / 2 + Q.yaw + Math.PI; g.add(sg); }
  // green water, barrels
  const pud = []; for (let i = 0; i < 9; i++) { const lx = dx + cr(-14, 6), lz = dz + cr(-2, 14), [x, z] = Q.W(lx, lz); pud.push([cr(1.2, 3.4), .02, cr(1, 2.6), x, heightAt(x, z) + .04, z, cr(0, 3)]); }
  glowMesh(g, pud, new THREE.MeshBasicMaterial({ color: 0x48e848, toneMapped: false, transparent: true, opacity: .5 }));
  for (let i = 0; i < 14; i++) { const lx = cr(-14, 14), lz = cr(-14, 14); if (Math.hypot(lx - dx, lz - dz) < 9.5 || Math.hypot(lx - tx, lz - tz) < 6 || (lx < 3 && lz > -.5)) continue; K.cyl('metal', .3, .3, .9, 10, lx, hy(lx, lz) + .45, lz, cp(.3) ? Math.PI / 2 : 0, 0, 0, cpk([0xb8a030, 0xa89028, 0x6a6a5a])); }
  K.build(g, true, false);
  // the control building, inside the fence
  const C = { kind: 'bld', id: 'reactor_ctl', name: 'CONTROL', w: 14, d: 10, n: 2, style: 'ctl', yaw: Q.yaw, weak: [1] };
  [C.x, C.z] = Q.W(-5, 6); cityBuild(C, root); dressRooms(C);
  { const L = C.L, y = L.Y(1), [a, b] = L.cols[2], [c, d] = L.rows[0]; lorePt(C, C.KI, (a + b) / 2, c + .6, y, 'reactor_log', 'term');
    ccache(C, (a + b) / 2, d - .7, y, 0, 'bypass', 'op', { id: 'cc_reactor_safe', name: 'The control-room safe', big: 1, rolls: 2, refill: 6, keys: ['shielding', 'power_cell'] }); }
  cityFinish(C);
  const K2 = hkit(); K2.at(Q.base); const bx = dx + 4, bz = dz + 9; bones(K2, bx, hy(bx, bz), bz, .4);
  lorePt(Q, K2, bx + .3, bz + .5, hy(bx, bz), 'reactor_badge', 'none'); K2.build(g, true, false);
  ccache(Q, dx + 7, dz + 6.5, hy(dx + 7, dz + 6.5), Math.PI, 'pry', 'arc', { id: 'cc_reactor_dome', name: 'Dome service locker', rolls: 2, refill: 5, keys: ['solar_cell'] });
  { const [x, z] = Q.W(dx, dz); CZONES.push({ kind: 'rad', x, z, r: 44, k: 1, under: false }); }
  REGIONS.push({ id: 'reactor', name: 'CINDER NO. 4', sub: 'The power plant · your teeth ache · a hazmat or Rust suit helps', x: Q.x, z: Q.z, r: 30, hostile: true });
}
// the Glasshouse: an old conservatory, overgrown, quiet. Nobody comes in here.
function buildGlass(Q, root) {
  siteFrame(Q); const g = Q.g = new THREE.Group(); root.add(g); const K = hkit(); K.at(Q.base);
  const hw = 13, hd = 8, hy = (lx, lz) => heightAt(...Q.W(lx, lz)), y = hy(0, 0);
  // brick base, iron posts, glass walls, a barrel roof of glass on iron ribs
  for (const [ax, a, b, at] of [['x', -hw, hw, hd], ['x', -hw, hw, -hd], ['z', -hd, hd, hw], ['z', -hd, hd, -hw]]) {
    const doorH = ax === 'z' ? [{ a: -1.3, b: 1.3, lo: y - 2, hi: y + 3.2 }] : [];
    const len = b - a;
    for (const [p, q] of doorH.length ? [[a, -1.3], [1.3, b]] : [[a, b]]) { const m = (p + q) / 2, l = q - p;
      if (ax === 'x') { K.box('block', l, 1.6, .4, m, y - .4, at, 0, 0, 0, 0x8a5a48, 1.2); K.box('glass', l, 3.4, .04, m, y + 2.1, at); } else { K.box('block', .4, 1.6, l, at, y - .4, m, 0, 0, 0, 0x8a5a48, 1.2); K.box('glass', .04, 3.4, l, at, y + 2.1, m); }
      const [x0, z0] = ax === 'x' ? Q.W(p, at) : Q.W(at, p), [x1, z1] = ax === 'x' ? Q.W(q, at) : Q.W(at, q); addColLine(x0, z0, x1, z1, .3); }
    for (let t = a; t <= b + .01; t += len / Math.round(len / 2.6)) { if (ax === 'x') K.box('metal', .12, 3.8, .12, t, y + 1.9, at, 0, 0, 0, 0x2e3a34); else K.box('metal', .12, 3.8, .12, at, y + 1.9, t, 0, 0, 0, 0x2e3a34); }
    if (doorH.length) { K.box('metal', .2, .3, 2.8, at, y + 3.3, 0, 0, 0, 0, 0x2e3a34); }
  }
  const roof = new THREE.CylinderGeometry(hd, hd, hw * 2, 24, 1, true, 0, Math.PI); roof.applyMatrix4(htm(0, 0, 0, 0, 0, Math.PI / 2)); roof.applyMatrix4(new THREE.Matrix4().makeScale(1, .55, 1));
  K.geo('glass', roof, htm(0, y + 3.8, 0));
  for (let x = -hw; x <= hw + .01; x += 2.6) K.geo('metal', new THREE.TorusGeometry(hd, .06, 4, 20, Math.PI).applyMatrix4(htm(0, 0, 0, 0, Math.PI / 2, 0)).applyMatrix4(new THREE.Matrix4().makeScale(1, .55, 1)), htm(x, y + 3.8, 0), 0x2e3a34);
  // inside: paths, beds, trees (one with lemons), a pond, benches, the gardener's table
  K.box('rock', hw * 2 - 1, .04, 1.6, 0, y + .02, 0, 0, 0, 0, 0x9a9080, 1.5);
  const tree = (x, z, s, lemons) => { K.cyl('board', .14 * s, .2 * s, 2.6 * s, 7, x, y + 1.3 * s, z, 0, 0, cr(-.08, .08), 0x5a4632);
    for (let i = 0; i < 5; i++) K.geo('plain', new THREE.IcosahedronGeometry(cr(.9, 1.4) * s, 0), htm(x + cr(-.8, .8) * s, y + (2.6 + cr(0, 1.2)) * s, z + cr(-.8, .8) * s), cpk([0x3a5a2a, 0x4a6a30, 0x2e4a22]));
    if (lemons) for (let i = 0; i < 14; i++) K.geo('plain', new THREE.SphereGeometry(.08, 6, 4), htm(x + cr(-1.1, 1.1), y + cr(2.4, 3.6), z + cr(-1.1, 1.1)), 0xe8c838);
    const [wx, wz] = Q.W(x, z); addCol(wx, wz, .3 * s, 4); };
  tree(-8, -4.5, 1.1, false); tree(8.5, 4.5, 1, false); tree(-3, 4.8, .9, true); tree(5, -5, .8, false);
  for (let i = 0; i < 40; i++) { const lx = cr(-hw + 1, hw - 1), lz = cpk([-1, 1]) * cr(1.4, hd - .6); K.geo('plain', new THREE.DodecahedronGeometry(cr(.25, .6), 0), htm(lx, y + cr(.1, .4), lz, cr(0, 3), cr(0, 3), 0), cpk([0x3a5a2a, 0x5a7a34, 0x4a6a2a, 0x6a7a3a, 0x8a3a4a, 0xc8b0d0])); }
  K.cyl('plain', 2.4, 2.4, .05, 24, 4, y + .03, 2.8, 0, 0, 0, 0x2a4a4a); K.cyl('block', 2.6, 2.6, .35, 24, 4, y + .1, 2.8, 0, 0, 0, 0x8a7a68);
  K.cyl('shiny', 2.35, 2.35, .02, 24, 4, y + .22, 2.8, 0, 0, 0, 0x3a5a5a);
  for (const x of [-5, 1]) { K.box('board', 1.8, .08, .5, x, y + .45, -1.4, 0, 0, 0, 0x6a5038, 1); for (const s of [-.75, .75]) K.box('metal', .06, .45, .45, x + s, y + .22, -1.4, 0, 0, 0, 0x2e3a34); }
  K.box('board', 1.6, .85, .7, -10.5, y + .42, 6.6, 0, 0, 0, 0x6a5038, 1); { const [x, z] = Q.W(-10.5, 6.6); addCol(x, z, .7, 1); }
  for (let i = 0; i < 5; i++) K.cyl('plain', .14, .1, .22, 8, -11 + i * .25, y + .96, 6.5, 0, 0, 0, 0x9a5a3a);
  lorePt(Q, K, -10.2, 6.5, y + .86, 'glass_gardener', 'note');
  K.build(g, true, false);
  ccache(Q, -11.5, -6.6, y, 0, 'none', 'ruin', { id: 'cc_glasshouse', name: 'The gardener’s chest', rolls: 1, refill: 3, keys: ['seed_corn', 'seed_bean', 'herb_med', 'honey'] });
  CZONES.push({ kind: 'quiet', id: 'glasshouse', name: 'The Glasshouse', x: Q.x, z: Q.z, r: 15 });
  REGIONS.push({ id: 'glasshouse', name: 'THE GLASSHOUSE', sub: 'Quiet. Something still grows here', x: Q.x, z: Q.z, r: 16 });
}

/* ---------- build it all (called from buildCity, once the Foundry is up) ---------- */
function buildCityInside(root) {
  const keep = HR_S;   // the houses' stream (hkit and tint draw from it) stays where it was
  for (const Q of citySites()) {
    if (Q.kind === 'metro') { buildMetro(Q, root); continue; }
    if (Q.kind === 'reactor') { buildReactor(Q, root); continue; }
    if (Q.kind === 'glass') { buildGlass(Q, root); continue; }
    cityBuild(Q, root); dressRooms(Q); hiddenRoom(Q);
    if (Q.cellar) cityBasement(Q, root);
    if (Q.esc) fireEscape(Q);
    cityRoof(Q);
    cityFinish(Q);
    if (Q.name) REGIONS.push({ id: 'c_' + Q.id, name: Q.name, sub: { hospital: 'Four floors of wards · the morgue is below', police: 'Locked up tight · the roof looks over the whole street', office: 'The city’s offices · paper everywhere', flat: 'A shop with a cellar' }[Q.style] || 'Cinder City', x: Q.x, z: Q.z, r: Math.hypot(Q.w, Q.d) / 2 + 4 });
  }
  HR_S = keep; cityLogs();
  console.log('city: built', citySites().length, 'places ·', CWALLS.length, 'walls ·', CITY_IT.length, 'things to use');
}

/* ---------- per frame (3-game.js): what's near, what you're standing on, what the air is doing ---------- */
let cityT = 0, cBadgeTxt = '', cityNearT = -1, cityNearV = null;
function cityNear() {
  if (cityNearT === G.t) return cityNearV; cityNearT = G.t; cityNearV = null;
  if (!CITY_IT.length || (!inCity(P.x, P.z, 40) && !P.under)) return null;
  let bd = 1e9;
  for (const it of CITY_IT) { const d = Math.hypot(it.x - P.x, it.z - P.z); if (d > it.r || d >= bd || Math.abs(it.y - P.y) > it.dy) continue; const l = it.l(); if (!l) continue; bd = d; cityNearV = it; it._l = l; }
  return cityNearV;
}
function radRes() { let r = 0; for (const t of wornAll()) { const D = GEAR_DEFS[t.id]; r += (D.fog || 0) * (D.slot === 'head' ? .3 : 1); } return clamp(r, 0, .95); }
function badge(t, col) {
  let el = $('cityBadge');
  if (!el) { el = document.createElement('div'); el.id = 'cityBadge'; Object.assign(el.style, { position: 'fixed', left: '50%', top: '114px', transform: 'translateX(-50%)', font: '700 13px/1.3 "Barlow Condensed", system-ui, sans-serif', letterSpacing: '.14em', padding: '5px 12px', borderRadius: '3px', background: 'rgba(8,10,8,.55)', pointerEvents: 'none', zIndex: 30, display: 'none', textTransform: 'uppercase', whiteSpace: 'nowrap' }); document.body.appendChild(el); }
  if (t === cBadgeTxt) return; cBadgeTxt = t; el.style.display = t ? 'block' : 'none'; if (t) { el.textContent = t; el.style.color = col; }
}
function cityApply() {
  cityApplied = true; const F = cityF();
  for (const id in F.open) if (CDOORS[id]) { if (id === 'hollis_door') { const D = CDOORS[id]; D.open = true; D.seg.on = false; D.g.position.set(D.x + D.dx * 2.4, D.y, D.z + D.dz * 2.4); } else openDoor(id, true); }
  if (F.open.hollis_hatch) revealHatch(true);
  for (const W of WEAK) if (F.coll[W.id]) collapse(W, true);
  if (F.power) powerOn(true);
}
// inside one of the city's buildings (not on its roof)?
function cityIndoors() {
  if (!CITY_SITES || !inCity(P.x, P.z, 10)) return false;
  for (const Q of CITY_SITES) { if (!Q.L || Math.abs(P.x - Q.x) > 25 || Math.abs(P.z - Q.z) > 25) continue; const dx = P.x - Q.x, dz = P.z - Q.z, lx = dx * Q.c - dz * Q.s, lz = dx * Q.s + dz * Q.c;
    if (Math.abs(lx) < Q.L.hw && Math.abs(lz) < Q.L.hd && P.y > Q.y0 - .6 && P.y < Q.top - .5) return true; }
  return false;
}
/* hook (3-game.js, right after updWeather): rain stays outside the buildings; underground there's no sun, a dim fill, a dark haze
   (what 2f-explore.js does for its pockets) — a little brighter on the Line once the generator's running */
function cityAfterWeather() {
  if (G.mode !== 'play') return;
  if (P.under) {
    if (typeof rainMesh !== 'undefined') rainMesh.visible = false;
    const lit = CITY_POWER && CITY_POWER.on && Math.abs(P.z - CITY_POWER.gate.position.z) < 10 ? .14 : 0;
    sun.intensity = 0; hemi.intensity = .42 + lit; hemi.color.setHex(0x9a9488); scene.fog.color.setHex(0x060606); scene.fog.far = 70; scene.fog.near = packFogNear(1); stars.material.opacity = 0;
  } else if (typeof rainMesh !== 'undefined' && rainMesh.visible && cityIndoors()) rainMesh.visible = false;
}
function updCity(dt) {
  for (let i = CANIM.length - 1; i >= 0; i--) if (!CANIM[i](dt)) CANIM.splice(i, 1);
  if (!CITY_SITES || G.mode !== 'play') return;
  if (!cityApplied) cityApply();
  const near = inCity(P.x, P.z, 30);
  cityT -= dt; if (cityT <= 0) { cityT = .25;
    for (const o of CIN_G) o.g.visible = near && Math.hypot(P.x - o.x, P.z - o.z) < o.r + 90;
    for (const o of CUN_G) o.g.visible = !!P.under && Math.hypot(P.x - o.x, P.z - o.z) < o.r + 60; }
  if (!near && !P.under) { badge(''); return; }
  const F = cityF();
  // weak floors: they sag, creak, and go if you're still on them a beat later
  for (const W of WEAK) {
    if (W.gone) continue; const f = W.f, dx = P.x - f.cx, dz = P.z - f.cz, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c;
    const on = P.onGround && !P.fly && !P.dead && Math.abs(lx) <= f.hw + .2 && Math.abs(lz) <= f.hd + .2 && Math.abs(P.y - f.y) < .15;
    if (on) { if (W.t === 0) { tone(64, .6, .3, 'sawtooth', 0, -14); noiseBurst(.4, 300, .6, .2); if (!F.weakHint) { F.weakHint = 1; toast('The boards sag under you — keep moving!', 2.6); } }
      W.t += dt; W.g.position.y = W.y - Math.min(.08, W.t * .2); if (W.t > .42) collapse(W); }
    else if (W.t > 0) { W.t = Math.max(0, W.t - dt * .8); if (W.t === 0) W.g.position.y = W.y; }
  }
  // the air: radiation, and the quiet places
  let rad = 0, quiet = null;
  for (const Z of CZONES) {
    if (Z.y0 != null && (P.y < Z.y0 || P.y > Z.y1)) continue; if (Z.under != null && Z.under !== !!P.under) continue;
    const d = Math.hypot(P.x - Z.x, P.z - Z.z); if (d > Z.r) continue;
    if (Z.kind === 'rad') rad = Math.max(rad, Z.k * Math.min(1, (1 - d / Z.r) * 1.6)); else quiet = Z;
  }
  if (rad > 0 && !P.dead && !P.fly) {
    // the dose goes on Part 1's radiation meter (P.rad, 2f-explore.js: the bar, wearing off, Juno / Rust medicine clear it);
    // it fills fast in here, and past 60 the city's hot places really hurt — Cinder No. 4 can kill you
    const res = typeof fogResist === 'function' ? clamp(fogResist(), 0, 1) * .9 : radRes(), e = rad * (1 - res);
    P.rad = Math.min(100, (P.rad || 0) + (e * 9 + .8) * dt);   // (+.8: what the meter would otherwise wear off this frame)
    if (P.rad > 60) { P.hp -= (P.rad - 60) * .15 * dt; P.hurtT = Math.max(P.hurtT, .25); if (Math.random() < dt * 1.5) hud.hurt.style.opacity = Math.min(1, (P.rad - 60) / 50); }
    if (Math.random() < dt * (3 + rad * 45)) noiseBurst(.006, 4200, 1.4, .1 + rad * .2, 'highpass');
    if (!F.radHint) { F.radHint = 1; toast('Radiation. A hazmat or Rust suit keeps most of it off — Juno or Rust medicine clears it.', 4.5); }
    badge(`☢ Radiation ${Math.round(rad * 100)}%` + (res > 0 ? ` · suit stops ${Math.round(res * 100)}%` : ''), res > .6 ? '#d8e070' : '#7cff6a');
    if (P.hp <= 0) die();
  } else if (quiet) {
    if (!P.dead && P.hp < 100 && P.food > 20 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * 2.5);
    if (Math.random() < dt * .35) { const f = rr(2600, 3600); tone(f, .07, .04, 'sine', 0, 500); tone(f * 1.1, .06, .03, 'sine', .1, -300); }
    if (!F.quiet || !F.quiet[quiet.id]) { (F.quiet ||= {})[quiet.id] = 1; toast(`${quiet.name} · quiet. Nobody hunts you in here, and you can catch your breath.`, 4); }
    badge('Quiet · safe here', '#a8d8b8');
  } else badge(P.under ? 'Underground · they can’t see you up there' : '', '#b8b0a0');
  // nobody chases you into a quiet place, or underground
  if (quiet || P.under) for (const e of ents) if (e.type === 'clan' && !e.dead && e.mode !== 'raid' && Math.abs(e.x - P.x) < 120 && Math.abs(e.z - P.z) < 120) { if (e.state === 'chase') e.state = 'idle'; e.blind = Math.max(e.blind || 0, .5); }
}
window.__city = { get sites() { return CITY_SITES; }, cityCollide, cityGround, collapse, revealHatch, CITY_IT, WEAK, CZONES, UNDER, CWALLS, CDOORS, cityGo, powerOn, openDoor, cityNear, underAt, get power() { return CITY_POWER; } };   // for testing from the console
