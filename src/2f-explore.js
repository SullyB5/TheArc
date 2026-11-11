
/* ================= exploration (Nov 11, Part 1 of the overhaul) =================
   New places all over the map, things left behind that tell what happened before the Arc came down, hidden stashes,
   and places under the ground you climb down into.
   · XSITE_DEFS: every new place, with where it would like to be; `xSites()` nudges each one onto workable ground
     (flat enough, dry, off the roads, clear of every older place) the first time it's asked — before the forest grows,
     so `xClear` can keep trees off them. The forest builders still spend their random numbers on a tree that lands in
     a site (it just isn't drawn), so nothing that was already in the world moves.
   · LOGS: notes, recordings, terminals, photos, maps and carvings. Reading one files it in the Journal (bag → Journal);
     some mark a place or a stash on the map (`XMARKS`).
   · pockets: places under the ground (a cellar, a cave, an old rail tunnel, an army bunker, a research lab). Each is
     built out past the edge of the walkable world (the far corners, beyond WORLD), so nothing on the surface can wander
     in; climbing down moves you there and the pocket's own rooms are your walls and floors (`pocketCollide`). Rooms are
     axis-aligned boxes; walls are worked out from which boxes touch (`xSeal`). Doors can need power (a fuse in the
     generator), a key, or a tool. Radiation (`P.rad`) sits in a few rooms and at Brightwater; a hazmat suit or a gas
     mask keeps it off you, Juno or Rust medicine clears it.
   · surface builders use their own random stream (XS_SEED), and swap the world's stream out while they run, so adding
     a place here never moves anything else. */

let XS_SEED = 311041;
const xrnd = () => (XS_SEED = (XS_SEED * 16807) % 2147483647, (XS_SEED - 1) / 2147483646), xr = (a, b) => a + xrnd() * (b - a), xp = a => a[Math.floor(xrnd() * a.length)];
const UG_Y = -150;                         // the floor level of every pocket (well under the terrain out at the corners)
const XHPI = Math.PI / 2;
const xSm = (c, o) => S(c, o);          // the standard-material maker (site code below names its site S)

/* ---------- new story items (keys, cards) ---------- */
for (const [id, n, w] of [['hesper_key', 'Hesper armory key', .05], ['bw_card', 'Brightwater keycard', .02], ['fuse_box', 'Generator fuse', .2]]) if (!ITEMS[id]) ITEMS[id] = { id, n, c: 'story', t: 1, src: 'story', w };
Object.assign(LORE, {
  hesper_key: 'Stamped FORT HESPER · ARMORY. Opens the armory door in the bunker under the fort.',
  bw_card: 'BRIGHTWATER RESEARCH · LEVEL 3. Opens the archive in the lab under the Brightwater Annex.',
});
LOCKS.hk = ['hesper_key', 'Unlock it (armory key)']; LOCKS.bw = ['bw_card', 'Swipe the Brightwater keycard'];

/* ================= the places ================= */
// tx/tz: where it would like to be · r: how much ground it needs · sl: how uneven that ground may be · hill: wants a slope (a door into a hillside)
const XSITE_DEFS = [
  { id: 'millbrook', name: 'MILLBROOK', sub: 'A farm village from before the fire · nobody left', tx: 230, tz: 40, r: 42, sl: .22, kind: 'valley' },
  { id: 'kvrn', name: 'KVRN RELAY STATION', sub: 'An old-world radio station on the south rim', tx: 60, tz: 650, r: 22, sl: .3 },
  { id: 'cave', name: 'WHISPER CAVE', sub: 'Cold air breathes out of the hill', tx: 110, tz: -245, r: 10, sl: .9, hill: 1 },
  { id: 'summit', name: 'KESTREL RIDGE', sub: 'The whole valley from up here', tx: 20, tz: -205, r: 9, sl: .6, peak: 1 },
  { id: 'tunA', name: 'COLDWATER LINE · WEST PORTAL', sub: 'An old rail tunnel through the rim', tx: 520, tz: -380, r: 12, sl: 1, hill: 1 },
  { id: 'tunB', name: 'COLDWATER LINE · EAST PORTAL', sub: 'An old rail tunnel through the rim', tx: 880, tz: -560, r: 12, sl: 1, hill: 1 },
  { id: 'hesper', name: 'FORT HESPER', sub: 'Old-world army post · Ironjaw squatters', tx: -1150, tz: 700, r: 44, sl: .2, hostile: 1 },
  { id: 'bright', name: 'BRIGHTWATER ANNEX', sub: 'A research station · the fence still says KEEP OUT', tx: 900, tz: 900, r: 34, sl: .22 },
  { id: 'longfall', name: 'THE LONG FALL', sub: 'Another piece of the Arc · it came down years before you', tx: 1700, tz: 900, r: 46, sl: .3 },
  { id: 'route9', name: 'ROUTE 9', sub: 'An old-world highway · the traffic never moved again', tx: -190, tz: 1620, r: 30, sl: .5, road: 1 },
  { id: 'ember', name: 'EMBER REST', sub: 'A clan camp · burnt out', tx: -1500, tz: -1300, r: 30, sl: .3 },
  { id: 'blackdoor', name: 'THE BLACK DOOR', sub: 'A blast door in the hill · the keypad is still lit', tx: -560, tz: -560, r: 8, sl: 1, hill: 1 },
  // the river crossings and the little camps are placed by their own rules (see xSites)
];
const XCAMP_T = [[-420, 380], [380, 520], [600, -250], [-560, 120], [1000, 0], [-200, 900], [-900, -200], [1250, 400]];
const XSTASH_T = [[300, -470], [-470, 470], [700, 300], [-1000, 1300], [1450, -1250], [-1650, -500]];
let XSITES = null, XTRAIL = [], XROAD = [], XCAMPS = [], XSTASH = [], XCROSS = {}, XPLOTS = [];
function xAvoid() {
  const A = [[0, 0, CAMP_R + 60]];
  for (const k in POI) { const p = POI[k]; if (p && typeof p.x === 'number') A.push([p.x, p.z, k === 'lake' ? LAKES[0].R + 30 : 50]); }
  for (const H of HOLDS) A.push([H.x, H.z, H.R + 40]);
  A.push([CITY.x, CITY.z, CITY.R + 40]); for (const B of BASES) A.push([B.x, B.z, B.R + 40]);
  for (const s of SCOUTS) A.push([s.x, s.z, 28]); for (const s of SHELTERS) A.push([s.x, s.z, 16]);
  for (const m of MEADOWS) A.push([m.x, m.z, 32]); for (const m of OUT_MEADOWS) A.push([m.x, m.z, 48]);
  for (const L of LAKES) A.push([L.x, L.z, L.R + 14]);
  for (const s of envSites()) A.push([s.x, s.z, s.r + 10]);
  return A;
}
function xFind(D, taken, AV) {
  const ok = (x, z) => {
    const d0 = Math.hypot(x, z); if (d0 > WORLD - D.r - 60 || d0 < CAMP_R + (D.near ? 20 : 70)) return false;
    if (D.near && d0 > CAMP_R + 70) return false;
    if (D.kind === 'valley' && d0 > VALLEY - 40) return false;
    for (const [ax, az, ar] of AV) if (!(D.near && !ax && !az) && Math.hypot(x - ax, z - az) < ar + D.r) return false;
    for (const t of taken) if (Math.hypot(x - t.x, z - t.z) < t.r + D.r + 20) return false;
    if (Math.abs(x - riverX(z)) < RIV_HW + D.r + 10) return false;
    if (!D.road && pathDist(x, z) < D.r * .8 + 4) return false;
    const sl = slopeAt(x, z);
    if (D.hill) return sl > .35 && sl < D.sl * 1.3 && waterAt(x, z) < heightAt(x, z) - 2;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 13; i++) { const a = i / 12 * 6.283, rr2 = i ? D.r * (i % 2 ? .5 : .9) : 0, px = x + Math.cos(a) * rr2, pz = z + Math.sin(a) * rr2, h = heightAt(px, pz);
      if (waterAt(px, pz) > h - .5) return false; lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo <= D.r * D.sl && sl < D.sl * 2;
  };
  for (let ring = 0; ring <= 48; ring++) {
    const rad = ring * 8, n = ring ? Math.max(8, Math.round(rad / 5)) : 1;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + ring * .7, x = D.tx + Math.cos(a) * rad, z = D.tz + Math.sin(a) * rad; if (ok(x, z)) return { x, z }; }
  }
  return { x: D.tx, z: D.tz, forced: 1 };
}
// the highest ground within `r` of a point
function xPeak(x0, z0, r) { let b = [x0, z0, -1e9]; for (let x = x0 - r; x <= x0 + r; x += 4) for (let z = z0 - r; z <= z0 + r; z += 4) { if (Math.hypot(x - x0, z - z0) > r) continue; const h = heightAt(x, z); if (h > b[2]) b = [x, z, h]; } return { x: b[0], z: b[1] }; }
// which way a hillside faces (downhill, away from the slope)
function xDownhill(x, z) { const hx = heightAt(x + 3, z) - heightAt(x - 3, z), hz = heightAt(x, z + 3) - heightAt(x, z - 3); return Math.atan2(-hx, -hz); }
function xSites() {
  if (XSITES) return XSITES; XSITES = {};
  const AV = xAvoid(), taken = [];
  for (const D of XSITE_DEFS) {
    let s;
    if (D.peak) s = xPeak(D.tx, D.tz, 70);
    else s = xFind(D, taken, AV);
    const S = XSITES[D.id] = { ...D, x: s.x, z: s.z, y: heightAt(s.x, s.z) };
    if (D.hill) S.face = xDownhill(S.x, S.z);
    taken.push(S);
  }
  // the ridge trail: from behind Kestrel up to the top of the ridge, then down the far side to the cave
  { const pts = [[64, -96], [96, -140], [70, -176], [XSITES.summit.x, XSITES.summit.z], [(XSITES.summit.x + XSITES.cave.x) / 2 + 10, (XSITES.summit.z + XSITES.cave.z) / 2], [XSITES.cave.x + Math.sin(XSITES.cave.face) * 8, XSITES.cave.z + Math.cos(XSITES.cave.face) * 8]];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6); for (let k = 0; k < n; k++) XTRAIL.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]); }
    XTRAIL.push(pts[pts.length - 1]); }
  // Route 9: a long straight-ish run of old highway across the south of the outlands
  { const R = XSITES.route9, a = -.25, L = 520; for (let k = -L; k <= L; k += 10) { const bend = Math.sin(k / L * 1.6) * 40; XROAD.push([R.x + Math.cos(a) * k - Math.sin(a) * bend, R.z + Math.sin(a) * k + Math.cos(a) * bend]); } }
  // little camps: somebody stopped here once
  for (let i = 0; i < XCAMP_T.length; i++) { const s = xFind({ tx: XCAMP_T[i][0], tz: XCAMP_T[i][1], r: 7, sl: .35 }, taken, AV); const S = { id: 'camp' + i, x: s.x, z: s.z, r: 7 }; XCAMPS.push(S); taken.push(S); }
  for (let i = 0; i < XSTASH_T.length; i++) { const s = xFind({ tx: XSTASH_T[i][0], tz: XSTASH_T[i][1], r: 4, sl: .5 }, taken, AV); const S = { id: 'stash' + i, x: s.x, z: s.z, r: 4 }; XSTASH.push(S); taken.push(S); }
  // (Part 5) plots outside the wall for the settlement's new buildings — picked here so the forest keeps off them too
  for (let i = 0; i < 8; i++) { const a = [-.55, .55, -1.1, 1.1, -1.75, 1.75, -2.4, 2.4][i] + Math.PI / 2, r = 96 + (i % 3) * 7;
    const s = xFind({ tx: Math.cos(a) * r, tz: Math.sin(a) * r, r: 9, sl: .3, near: 1 }, taken, AV); const S = { id: 'plot' + i, x: s.x, z: s.z, r: 9, forced: s.forced }; XPLOTS.push(S); taken.push(S); }
  // the river crossings: a rope bridge over the gorge in the north, stepping stones across the shallows in the south
  const cross = (z0, z1, want) => { let b = null; for (let z = z0; z <= z1; z += 6) { const rx = riverX(z), xl = rx - RIV_HW - 7, xr2 = rx + RIV_HW + 7, hl = heightAt(xl, z), hr2 = heightAt(xr2, z), wl = riverWL(z);
    if (waterAt(xl, z) > hl - .2 || waterAt(xr2, z) > hr2 - .2) continue; const sc = want === 'high' ? Math.abs(hl - hr2) * 3 - Math.min(hl, hr2) + wl : Math.abs(hl - hr2) * 2 + Math.abs(Math.min(hl, hr2) - wl - 1.5) * 3;
    if (Math.hypot(rx - POI.bridge.x, z - POI.bridge.z) < 120 || Math.hypot(rx - POI.burn.x, z - POI.burn.z) < 90 || Math.hypot(rx - POI.halvard.x, z - POI.halvard.z) < 110) continue;
    if (!b || sc < b.sc) b = { z, xl, xr: xr2, hl, hr: hr2, wl, sc }; } return b; };
  XCROSS.rope = cross(-470, -200, 'high'); XCROSS.ford = cross(440, 620, 'low');
  return XSITES;
}
const xSegD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
// keep the forest (and the boulders) off a new place, the trail and the highway
function xClear(x, z) {
  const S = xSites();
  for (const k in S) { const s = S[k]; const r = s.hill ? s.r + 4 : s.peak ? s.r + 3 : s.r + 6; if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r && Math.hypot(x - s.x, z - s.z) < r) return true; }
  for (const c of XCAMPS) if (Math.hypot(x - c.x, z - c.z) < 9) return true;
  for (const c of XPLOTS) if (Math.hypot(x - c.x, z - c.z) < 12) return true;
  for (let i = 0; i < XTRAIL.length; i += 1) { const [tx, tz] = XTRAIL[i]; if (Math.abs(x - tx) < 3.6 && Math.abs(z - tz) < 3.6) return true; }
  for (let i = 0; i < XROAD.length - 1; i++) { const [ax, az] = XROAD[i], [bx, bz] = XROAD[i + 1]; if (Math.abs(x - ax) > 20 || Math.abs(z - az) > 20) continue; if (xSegD(x, z, ax, az, bx, bz) < 10) return true; }
  for (const c of Object.values(XCROSS)) if (c && Math.abs(z - c.z) < 6 && x > c.xl - 8 && x < c.xr + 8) return true;
  return false;
}
// a matrix that hides an instance (trees in a site are still "grown", so nothing else moves — they just aren't drawn)
const X_HIDE = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);

/* ================= lore ================= */
// kind: note · rec (a recording) · term (a terminal) · photo · map · carve (marks cut in stone or wood)
const LOGS = {
  // Millbrook + the cellar under it
  mb_notice: { at: 'Millbrook', kind: 'note', t: 'Notice, nailed to the well', by: 'Millbrook council', b: 'By order of the Provincial Guard: every household is to walk to FORT HESPER by the north road. Take water, take warm clothes, leave the animals. The trucks are not coming. Do not wait for them.\n\nThe Rourke place has not answered. If anyone sees Ansel, tell him the order includes him.' },
  mb_letter: { at: 'Millbrook', kind: 'note', t: 'A letter on a kitchen table', by: 'Ada', b: 'Tom — we went with the others. The sky was green again last night, and the radio says the Guard will have power at Hesper for months. Mum would not leave the garden so we carried her. I left you the good knife under the floorboard by the stove. Come and find us. — Ada' },
  mb_rourke1: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · day 3', by: 'Ansel Rourke', b: 'Day 3 below. They all walked to Hesper. Fools. The army doesn’t have enough for itself, never mind three hundred farmers. I have eleven months of tins, a hand pump to the well and a filter. When the sun settles I’ll come up and the valley will be mine.' },
  mb_rourke2: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · day 61', by: 'Ansel Rourke', b: 'Day 61. Somebody knocked on the doors last night. Three knocks, then nothing. I didn’t open. In the morning there were tracks in the frost going north, toward Hesper, and the frost was pink.\n\nI have moved the important things behind the shelf.' },
  mb_rourke3: { at: 'The Rourke cellar', kind: 'note', t: 'Ansel Rourke’s diary · last page', by: 'Ansel Rourke', b: 'Day 140, I think. The pump died. The well tastes of copper. I went up once and the trees were wrong — taller, and the fog that came in over the ridge was red and it burned my throat.\n\nThe map is for whoever finds this. Hesper has a bunker under it. Their generator runs on fuses like mine. The Guard will have left the armory locked, they always did.' },
  mb_photo: { at: 'Millbrook', kind: 'photo', t: 'A photo in a cracked frame', by: '', b: 'A harvest fair. Bunting over the street you’re standing in, a tractor with ribbons on it, forty people squinting into the sun. Someone has written on the back: MILLBROOK, LAST GOOD SUMMER.' },
  // the ridge, the cave
  rd_summit: { at: 'Kestrel Ridge', kind: 'note', t: 'Pages pinned under a stone', by: 'Maren Ostby, Arc scout', b: 'Climbed up to signal the Arc with the mirror. No answer — the ring’s gone dark over the sea. From up here you can see everything: the river, the black scar of the Burn, smoke from the clan holds.\n\nThere is a cave on the far side of this ridge. Cold air comes out of it, and at night I could swear it hums.' },
  cv_painting: { at: 'Whisper Cave', kind: 'carve', t: 'Paintings on the cave wall', by: 'Thornkin, long ago', b: 'Red ochre and soot. People with spears, a herd of deer — and above them, a great ring in the sky, falling, and a red cloud rolling out from under it. The people in the paintings are running into this cave.\n\nUnder the cloud someone has painted thirteen standing stones.' },
  cv_rec: { at: 'Whisper Cave', kind: 'rec', t: 'A field recorder', by: 'Dr. Paulo Iness, survey team', b: '“…cave system extends at least four hundred metres. Air temperature constant at eight degrees. The hum we keep hearing isn’t geological — there’s a regular period to it, eleven seconds. Something underneath is running. Peretz thinks it’s old mine machinery. I think we should leave.” [static]' },
  cv_deep: { at: 'Whisper Cave · the deep chamber', kind: 'carve', t: 'Words cut into the stone', by: 'Unknown', b: 'Thirteen marks in a ring, and in the middle, newer, scratched with a blade:\n\nWHEN THE HEART-LIGHT IS RED, KNOCK SEVEN TIMES QUICKLY AND THE SKY WILL OPEN.\n\n(Your health bar is red. You wonder.)' },
  // the rail tunnel
  tn_order: { at: 'Coldwater Line', kind: 'note', t: 'A sign wired to the portal', by: 'Hesper Command', b: 'TUNNEL CLOSED TO CIVILIAN TRAFFIC. BY ORDER OF HESPER COMMAND. ANYONE FOUND IN THE COLDWATER LINE WITHOUT A PASS WILL BE TURNED BACK.\n\nUnderneath, in marker: they didn’t turn anyone back. they just closed the doors.' },
  tn_rec: { at: 'Coldwater Line', kind: 'rec', t: 'A maintenance logger', by: 'Line engineer K. Doyle', b: '“Maintenance bay, shift log. Generator’s down again — third fuse this week. Spare’s in the bay but the bay won’t open without power, which is genius. If you’re hearing this and you’ve got a fuse, the panel is in the alcove opposite. Bring the bay up and take whatever you need. I won’t be back for it.”' },
  // the radio station
  kv_term: { at: 'KVRN Relay Station', kind: 'term', t: 'The broadcast desk', by: 'KVRN automated log', b: '> LAST TRANSMISSION 04:12\n> “…flare activity off every scale we have. Stay indoors. Stay away from windows. If the sky turns green, that is not the aurora you know, that is the grid going. Go below ground if you can. This is KVRN, and we’ll keep talking for as long as we can—”\n> SIGNAL LOST' },
  kv_numbers: { at: 'KVRN Relay Station', kind: 'rec', t: 'A tape loop, still turning', by: 'Unknown', b: 'A woman’s voice, very calm, over and over:\n\n“Nine. Nine. Site Nine awaits the signal. Lantern is lit. Lantern is lit. Nine.”\n\nThen eleven seconds of a low hum, and it starts again.' },
  kv_log: { at: 'KVRN Relay Station', kind: 'note', t: 'Station manager’s notebook', by: 'Hal Brenner', b: 'The army asked us to keep a channel open for them — a tone, nothing else, every eleven seconds. They wouldn’t say what it was for. When I asked where it was going, the colonel pointed west at the hills and said “a door.”' },
  // Fort Hesper + the bunker under it
  hs_iron: { at: 'Fort Hesper', kind: 'note', t: 'A scrawled note', by: 'Ironjaw', b: 'Boss — the bunker’s dead. No lights, and the big door at the back won’t move without power. Gnash tried a crowbar and broke his arm. Somebody needs to find fuses or we’re sitting on top of a locked armory like idiots.' },
  hs_duty: { at: 'Hesper Bunker', kind: 'note', t: 'Duty roster', by: '4th Provincial Guard', b: 'Week 9. Civilians at the gate: 312. Rations: 40 days at half. The order from Command is unchanged — no more civilians inside. Sergeant Wills refused it and has been relieved.' },
  hs_cmd: { at: 'Hesper Bunker', kind: 'term', t: 'The commander’s terminal', by: 'Col. R. Avens', b: '> Brightwater wants the sick ones sent up to them. They say they can treat the burns from the fog. I don’t believe them, but I don’t have medicine and they do.\n> Transport leaves at dawn. I’m sending the Brightwater liaison’s keycard with the convoy so they stop asking me for it.\n> Note: the card never left. It’s in my desk. I don’t want anyone going back there.' },
  hs_letter: { at: 'Hesper Bunker', kind: 'note', t: 'A letter that was never sent', by: 'Pvt. Ibby Sohn', b: 'Dad — they’re saying the fog is from Brightwater. That they made it. Everyone in the mess says it like a joke and nobody laughs. If I get out I’m going east to the coast. Don’t come here. Don’t let anyone send you to the lab.' },
  // Brightwater
  bw_sign: { at: 'Brightwater Annex', kind: 'note', t: 'A sign on the fence', by: 'Brightwater Research', b: 'RESTRICTED · BIOLOGICAL AND RADIOLOGICAL WORK IN PROGRESS · AUTHORISED STAFF ONLY. Below that, a newer sign, hand-painted: THE FOG COMES FROM HERE.' },
  bw_varga1: { at: 'Brightwater Lab', kind: 'term', t: 'Lab terminal · Dr. Varga', by: 'Dr. Ilse Varga', b: '> SPECIMEN R, SERIES 4.\n> The agent was meant to carry the shield into the lungs — a mist you breathe once and you never burn again. It works. It works too well. It binds iron. It turns the air red.\n> Dr. Arden says the Greyhold people want samples. I said no. I don’t think I get to say no.' },
  bw_varga2: { at: 'Brightwater Lab', kind: 'rec', t: 'A voice memo', by: 'Dr. Ilse Varga', b: '“The tank in B is cracked. I’ve sealed the room. Anyone going in needs a suit — not because of the agent, because of the shielding salts, they’re hot. I’m leaving the suits in the locker. I am leaving. Arden is staying. God help her.”' },
  bw_liaison: { at: 'Brightwater Lab', kind: 'note', t: 'Memo, stamped GREYHOLD', by: 'Greyhold liaison', b: 'Transfer of all surviving subjects to the mountain facility is approved. The subjects who show tolerance to the agent are of particular value. Their blood is to be preserved. Their names are not.' },
  bw_archive: { at: 'Brightwater Archive', kind: 'term', t: 'Archive terminal', by: 'Brightwater Research', b: '> PROJECT LANTERN — SUMMARY\n> Three sites. One sealed under the mountain (GREYHOLD). One that never answered (MERIDIAN). One kept dark until the signal: SITE NINE, west of the relay, in the hill.\n> When the sun flares again, Lantern is to be lit.\n> [the rest of the file is corrupted]' },
  // the Long Fall
  lf_rec: { at: 'The Long Fall', kind: 'rec', t: 'A black box, still talking', by: 'Hydroponics Ring C', b: '“This is Ring C. We separated early — the clamps blew. We’re coming down long, over the hills. Tell the Council it wasn’t sabotage, it was the clamps, it was always the clamps. Tell my boy I— [impact]”' },
  lf_manifest: { at: 'The Long Fall', kind: 'term', t: 'Cargo manifest', by: 'Ring C', b: '> RING C — HYDROPONICS · 41 crew\n> Seed vault (sealed) · water reclaimer · med stores\n> Dropped: year 87 of the Arc. Recovered: never.\n> Somebody has scratched into the screen bezel: 9 OF US WALKED OUT. WE WENT TO THE LAKE.' },
  // Route 9
  r9_note: { at: 'Route 9', kind: 'note', t: 'A note under a wiper', by: 'Unknown', b: 'Traffic hasn’t moved in two days. The Guard says Hesper is full. Someone on the radio says Brightwater is taking people in. We’re going to walk. If you find our car, the water in the boot is clean — take it.' },
  r9_photo: { at: 'Route 9', kind: 'photo', t: 'A class photo on a bus seat', by: '', b: 'Thirty kids in matching sweaters, MILLBROOK SCHOOL — YEAR 4 on a chalkboard behind them. The teacher is holding up a drawing of the sun, coloured green.' },
  // Ember Rest
  em_carve: { at: 'Ember Rest', kind: 'carve', t: 'Marks cut into a fallen pole', by: 'A Thornkin survivor', b: 'Clan marks, cut fast. You can read some of them now:\n\nRED FOG IN THE NIGHT. MEN WITH NO FACES WALKED IN IT. THEY TOOK THE YOUNG AND THE STRONG. THEY WENT TO THE GREY MOUNTAIN. WE BURNED OUR DEAD AND WE RAN.' },
  // the Black Door
  bd_keypad: { at: 'The Black Door', kind: 'term', t: 'The keypad', by: 'SITE 9', b: '> SITE 9 · LANTERN PROTOCOL\n> STATUS: AWAITING SIGNAL\n> MANUAL ENTRY DISABLED\n\nThe keypad is warm. Somewhere behind the door, something hums every eleven seconds.' },
  // the camps
  cp0: { at: 'A camp by the trees', kind: 'note', t: 'Carved into a log', by: 'Hunters', b: 'TAV + REN · SPLIT UP AT THE RIVER · MEET BACK HERE IN 3 DAYS. The carving is old. Under it, only one more line: DAY 9. STILL WAITING.' },
  cp1: { at: 'A camp in the hills', kind: 'note', t: 'A page from a notebook', by: 'An Arc kid', b: 'Day 9 by myself. The pod’s radio only does static. I ate the last bar. If anyone from the Arc finds this I went toward the smoke in the north because smoke means people. Please be the right people.' },
  cp2: { at: 'A scout’s camp', kind: 'map', t: 'A scavenger’s map', by: 'Ironjaw', b: 'A hand-drawn map, mostly crossings-out. Three of the marks have the same sign beside them — three short bars — and one is circled: “stash, not ours, didn’t touch it.”', mark: 'stash1' },
  cp3: { at: 'A camp under the pines', kind: 'carve', t: 'An offering stone', by: 'Thornkin', b: 'A flat stone with feathers, a bone bead and a clan mark pressed into clay. The mark means “we were here and we left in peace.” Somebody keeps the feathers fresh.' },
  cp4: { at: 'An old campsite', kind: 'photo', t: 'A photo tucked into a boot', by: '', b: 'A family in front of a tent — this tent — waving. The date on the back is three days before the sky went green.' },
  cp5: { at: 'A camp in the open', kind: 'note', t: 'A field report, half burned', by: 'Greyhold patrol', b: 'Sweep 14. Two specimens collected from the lake shore, both tolerant. Thornkin scouts sighted; avoided. Fog window closes at dawn. Recommend we bring the Reavers next time — the clans don’t run from us any more.' },
  cp6: { at: 'A drover’s camp', kind: 'note', t: 'A tally board', by: 'A drover', b: 'Cattle counted every night, marks in rows of five. The rows stop at forty-one. Then, in a different hand: wolves.' },
  cp7: { at: 'A lookout camp', kind: 'note', t: 'A note in a tin', by: 'Rook, Kestrel', b: 'If you’re reading this you came the long way. The tunnel through the east rim — the Coldwater Line — cuts two hours off. Bring a light. And a fuse, if you can spare one.' },
  // the mark: the stash sign
  mk_mark: { at: 'A marked stash', kind: 'carve', t: 'Three short bars', by: 'Old smugglers’ sign', b: 'Three short bars, cut or painted on a rock, mean “something is buried here, take what you need, leave the rest.” Once you know the sign you see it everywhere. Two more of them are near — you scratch them onto your map.', mark: ['stash2', 'stash3'] },
};
const LOG_KIND = { note: ['Read the note', 'Note'], rec: ['Play the recording', 'Recording'], term: ['Read the terminal', 'Terminal'], photo: ['Look at the photo', 'Photo'], map: ['Look at the map', 'Map'], carve: ['Read the marks', 'Carving'] };
const XNOTES = [];   // { x, y, z, id, g, pocket }
const XUSE = [];     // generic things to use: { x, y, z, r, pocket, label(), act() }
const XMARKS = {};   // map marks a log can reveal: id → { x, z, n }
const XANIM = [];    // per-frame animations (doors, the collapsing floor, lamps)
const XRAD = [];     // surface radiation: { x, z, r, k }
const XRESTORE = []; // put doors, power, shelves and floors back the way the save has them (run when a game starts)

/* ================= helpers ================= */
const XMAT = {};
function xm(key) {
  if (XMAT[key]) return XMAT[key];
  const t = (tex, rep) => { const c = tex.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; if (rep) c.repeat.set(rep, rep); return c; };
  const D = {
    conc: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xb8b2a8 }), concD: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x7a766e }),
    concW: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xd8d4cc }), tile: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0xc8ccc8 }),
    rock: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x7a746c }), rockD: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x55504a }),
    dirt: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x5a4a3a }), wood: () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x8a7258 }),
    woodD: () => new THREE.MeshLambertMaterial({ map: texWood, color: 0x5a4636 }), panel: () => new THREE.MeshStandardMaterial({ map: texPanel, color: 0x9aa0a0, metalness: .45, roughness: .6 }),
    rust: () => new THREE.MeshLambertMaterial({ map: texCorr, color: 0x8a5a3a }), olive: () => new THREE.MeshLambertMaterial({ map: texCorr, color: 0x5a6248 }),
    metal: () => new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x8a8e90, metalness: .5, roughness: .55 }), dark: () => new THREE.MeshLambertMaterial({ color: 0x0a0a0a }),
    asphalt: () => new THREE.MeshLambertMaterial({ map: texConcrete, color: 0x4a4a48 }), sand: () => new THREE.MeshLambertMaterial({ map: TX.rock, color: 0x9a8a6a }),
    bone: () => new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }), cloth: () => new THREE.MeshLambertMaterial({ color: 0x8a3a2a, side: THREE.DoubleSide }),
    paper: () => new THREE.MeshBasicMaterial({ color: 0xe8e2cc, side: THREE.DoubleSide }), glass: () => new THREE.MeshStandardMaterial({ color: 0x6a9a8a, transparent: true, opacity: .35, roughness: .1, metalness: .2 }),
    glowG: () => new THREE.MeshBasicMaterial({ color: 0x6aff9a, toneMapped: false }), glowR: () => new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }),
    glowA: () => new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false }), glowW: () => new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false }),
    glowT: () => new THREE.MeshBasicMaterial({ color: 0x5ae0d0, toneMapped: false }), screen: () => new THREE.MeshBasicMaterial({ color: 0x3ad07a, toneMapped: false }),
    water: () => new THREE.MeshStandardMaterial({ color: 0x1a2a2c, roughness: .05, metalness: .6, transparent: true, opacity: .85 }),
    char: () => new THREE.MeshLambertMaterial({ color: 0x1e1a16 }), hide: () => new THREE.MeshLambertMaterial({ color: 0x6a4a32, side: THREE.DoubleSide }),
    paint: () => new THREE.MeshBasicMaterial({ color: 0xd84a2a }), white: () => new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), yellow: () => new THREE.MeshLambertMaterial({ color: 0xd8b040 }),
  };
  return XMAT[key] = D[key]();
}
// a box with its texture tiled by size, so walls don't stretch
function xbox(parent, w, h, d, mat, x, y, z, ry = 0, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, tile, 0, 0);
  const m = mesh(g, typeof mat === 'string' ? xm(mat) : mat, x, y, z, parent); m.rotation.y = ry; return m;
}
const xcyl = (parent, r0, r1, h, mat, x, y, z, seg = 10) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), typeof mat === 'string' ? xm(mat) : mat, x, y, z, parent);
// a local frame round a point, turned by yaw: W(lx, lz) → world x, z
const xFrame = (cx, cz, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
// a model from the kit, scaled to a height
function xModel(parent, name, h, x, y, z, ry = 0) { const W = whole(name); if (!W) return null; return envPut(parent, name, x, y, z, ry, h / W.size.y); }
// bones on the ground
function xSkeleton(parent, x, y, z, yaw = 0, sit = 0) {
  const g = new THREE.Group(), b = xm('bone');
  mesh(new THREE.SphereGeometry(.11, 8, 6), b, 0, sit ? .95 : .11, sit ? -.05 : .62, g);
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(.13 - i * .008, .012, 4, 10, Math.PI), b, 0, sit ? .75 - i * .07 : .1, sit ? 0 : .38 - i * .07, g); r.rotation.set(sit ? 0 : -XHPI, 0, 0); }
  const spine = mesh(new THREE.CylinderGeometry(.02, .02, .55, 5), b, 0, sit ? .6 : .06, sit ? 0 : .2, g); if (!sit) spine.rotation.x = XHPI;
  for (const s of [-1, 1]) {
    const f = mesh(new THREE.CylinderGeometry(.025, .02, .45, 5), b, s * .1, sit ? .42 : .05, sit ? .2 : -.25, g); f.rotation.set(sit ? XHPI : XHPI + s * .15, 0, s * .1);
    const sh = mesh(new THREE.CylinderGeometry(.02, .015, .42, 5), b, s * .12, sit ? .2 : .04, sit ? .42 : -.68, g); sh.rotation.set(sit ? 0 : XHPI, 0, s * .05);
    const a = mesh(new THREE.CylinderGeometry(.018, .015, .5, 5), b, s * .22, sit ? .55 : .05, sit ? .1 : .25, g); a.rotation.set(sit ? .6 : XHPI + s * .4, 0, s * .3);
  }
  g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g); return g;
}
// a pile of junk/rubble
function xRubble(parent, x, y, z, n, spread, mat = 'concD') { for (let i = 0; i < n; i++) { const s = xr(.25, 1.1), m = mesh(new THREE.DodecahedronGeometry(s, 0), xm(mat), x + xr(-spread, spread), y + s * .4, z + xr(-spread, spread), parent); m.rotation.set(xr(0, 3), xr(0, 3), xr(0, 3)); m.scale.y = xr(.4, .9); } }
// a pickup that tells you something
function xNote(parent, id, x, y, z, yaw = 0, pocket = null) {
  const L = LOGS[id]; if (!L) return; const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  if (L.kind === 'note' || L.kind === 'photo' || L.kind === 'map') {
    const p = mesh(new THREE.PlaneGeometry(L.kind === 'map' ? .42 : .22, L.kind === 'map' ? .32 : .3), L.kind === 'photo' ? new THREE.MeshBasicMaterial({ color: 0xc8b890, side: THREE.DoubleSide }) : xm('paper'), 0, .02, 0, g); p.rotation.x = -XHPI; p.rotation.z = xr(-.4, .4);
    if (L.kind === 'photo') { const f = mesh(new THREE.PlaneGeometry(.16, .12), new THREE.MeshBasicMaterial({ color: 0x5a4a3a }), 0, .025, -.02, g); f.rotation.x = -XHPI; }
  } else if (L.kind === 'rec') {
    xbox(g, .26, .09, .17, 'woodD', 0, .045, 0); xbox(g, .22, .02, .1, 'dark', 0, .1, 0);
    const led = mesh(new THREE.SphereGeometry(.015, 6, 4), xm('glowR'), .1, .095, .07, g); XANIM.push(t => { led.visible = Math.sin(t * 5) > 0; });
  } else if (L.kind === 'term') {
    if (!xModel(g, 'props/computer-console', 1.1, 0, 0, 0, 0)) { xbox(g, .9, .9, .6, 'metal', 0, .45, 0); }
    const sc = mesh(new THREE.PlaneGeometry(.5, .32), xm('screen'), 0, 1.02, .32, g); sc.rotation.x = -.35; XANIM.push(t => { sc.material.color.setHSL(.38, .7, .35 + Math.sin(t * 2 + x) * .04); });
  } else if (L.kind === 'carve') {
    const m = mesh(new THREE.PlaneGeometry(.6, .4), new THREE.MeshBasicMaterial({ color: 0xc8a070, transparent: true, opacity: .5, side: THREE.DoubleSide }), 0, .6, 0, g);
  }
  // a faint glint so things left behind can be spotted
  if (L.kind !== 'term') { const gl = new THREE.Mesh(new THREE.OctahedronGeometry(.045), new THREE.MeshBasicMaterial({ color: 0xffe8b0, toneMapped: false })); gl.position.y = L.kind === 'carve' ? .95 : .3; g.add(gl); XANIM.push(t => { gl.position.y = (L.kind === 'carve' ? .95 : .3) + Math.sin(t * 2.4 + x) * .05; gl.visible = !(G.flags.logs || {})[id] && Math.sin(t * 3 + z) > -.4; }); }
  XNOTES.push({ x, y, z, id, g, pocket });
}
function xUse(o) { XUSE.push(o); return o; }
// round colliders along a building's walls, with one doorway (width `door`) in the middle of the front (+z) side
function xColRect(x, z, w, d, yaw, r = .5, door = 0) {
  const F = xFrame(x, z, yaw), run = (ax, az, bx, bz, gap) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.3))); for (let i = 0; i <= n; i++) { const lx = lerp(ax, bx, i / n), lz = lerp(az, bz, i / n); if (gap && Math.abs(lx) < door / 2 + r * .6) continue; const [px, pz] = F(lx, lz); addCol(px, pz, r); } };
  run(-w / 2, -d / 2, w / 2, -d / 2); run(-w / 2, d / 2, w / 2, d / 2, door > 0); run(-w / 2, -d / 2, -w / 2, d / 2); run(w / 2, -d / 2, w / 2, d / 2);
}
// surface placement: group at a point on the ground
function xPlace(obj, x, z, yaw = 0, up = 0) { obj.position.set(x, heightAt(x, z) + up, z); obj.rotation.y = yaw; world.add(obj); return obj; }
function xLowest(x, z, w, d, yaw) { let lo = 1e9; const F = xFrame(x, z, yaw); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]]) { const [px, pz] = F(a * w / 2, b * d / 2); lo = Math.min(lo, heightAt(px, pz)); } return lo; }
// a light that's always there (the light pool picks the nearest four each frame)
function xLamp(parent, x, y, z, color, I, dist, fixture = true) {
  const l = new THREE.PointLight(color, I * 1.6, dist * 1.2, 0); l.position.set(x, y, z); parent.add(l);
  if (fixture) { const f = mesh(new THREE.BoxGeometry(.5, .06, .16), new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, y + .05, z, parent); f.castShadow = false; l.userData.fx = f; }
  return l;
}
function xFire(parent, x, y, z, s = 1) {
  const f = new THREE.Mesh(new THREE.ConeGeometry(.45 * s, 1.2 * s, 7), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .9 })); f.position.set(x, y + .55 * s, z); parent.add(f);
  const ph = xr(0, 6); XANIM.push(t => { f.scale.y = 1 + Math.sin(t * 13 + ph) * .25; });
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mesh(new THREE.DodecahedronGeometry(.16 * s, 0), M(0x5a5650), x + Math.cos(a) * .55 * s, y + .08, z + Math.sin(a) * .55 * s, parent); }
  xLamp(parent, x, y + 1.4, z, 0xff8a3a, 1.6, 16, false); return f;
}
function xTent(parent, x, z, yaw, col = 0x6a5a3a, burnt = false) {
  const g = new THREE.Group(), m = burnt ? xm('char') : new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
  const sh = new THREE.Shape([new THREE.Vector2(-1.2, 0), new THREE.Vector2(1.2, 0), new THREE.Vector2(0, 1.4)]);
  const t = mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), m, 0, 0, -1.2, g);
  if (burnt) { t.scale.y = .5; t.rotation.z = .2; }
  mesh(new THREE.PlaneGeometry(.9, 1), xm('dark'), 0, .5, 1.22, g);
  xPlace(g, x, z, yaw); addCol(x, z, 1.1); return g;
}

/* ================= pockets: places under the ground ================= */
const POCKETS = {};
const UG = { at: null, fadeEl: null, tagEl: null, lamp: null, standT: 0 };
// slots out in the far corners of the map, past the edge of the walkable world
const PK_SLOT = { cellar: [1990, 1990], cave: [2130, 1990], hesper: [2270, 2010], lab: [1990, 2150], tunnel: [-2370, -2110] };
function mkPocket(id, name, o = {}) {
  const [ox, oz] = PK_SLOT[id], g = new THREE.Group(); g.visible = false; scene.add(g);
  const pk = { id, name, ox, oz, y: UG_Y, g, rects: [], obst: [], hz: [], weak: [], surf: o.surf || 'metal', fog: o.fog || 70, hemi: (o.hemi ?? .22) + .2, hemiC: o.hemiC || 0x8a9098, power: !!o.power, lamps: [], plamps: [], dyn: new Set(), bounds: [1e9, 1e9, -1e9, -1e9] };
  POCKETS[id] = pk; return pk;
}
const pw = (pk, lx, lz) => [pk.ox + lx, pk.oz + lz];
/* a room: x0..x1, z0..x1 in the pocket's own metres; y up from the pocket floor. Walls come later, in xSeal. */
function xRoom(pk, x0, z0, x1, z1, o = {}) {
  const R = { x0: pk.ox + x0, z0: pk.oz + z0, x1: pk.ox + x1, z1: pk.oz + z1, ylo: pk.y + (o.y || 0), yhi: pk.y + (o.y2 ?? o.y ?? 0), h: o.h || 3, wall: o.wall || 'conc', floor: o.floor || 'concD', ceil: o.ceil || 'concD', nofloor: o.nofloor, noceil: o.noceil, nowall: o.nowall || '', axis: o.axis, tag: o.tag };
  pk.rects.push(R); const b = pk.bounds; b[0] = Math.min(b[0], R.x0); b[1] = Math.min(b[1], R.z0); b[2] = Math.max(b[2], R.x1); b[3] = Math.max(b[3], R.z1);
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, w = R.x1 - R.x0, d = R.z1 - R.z0;
  if (R.ylo === R.yhi) {
    if (!R.nofloor) { xbox(pk.g, w, .3, d, R.floor, cx, R.ylo - .15, cz, 0, 2); addFloor(cx, cz, 0, w / 2, d / 2, R.ylo); }
  } else {        // a ramp or a flight of stairs, climbing along its axis ('x' or 'z')
    const ax = R.axis || 'z', L = ax === 'z' ? d : w, n = Math.max(2, Math.round(L / .32)), rise = R.yhi - R.ylo;
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, y = R.ylo + rise * t;
      if (ax === 'z') xbox(pk.g, w, .3, L / n + .02, R.floor, cx, y - .15, R.z0 + t * d, 0, 2); else xbox(pk.g, L / n + .02, .3, d, R.floor, R.x0 + t * w, y - .15, cz, 0, 2); }
    // FLOORS slope runs along local x: for a z-ramp turn the floor a quarter so local x is world z
    const slope = rise / L;
    if (ax === 'z') FLOORS.push({ cx, cz, c: 0, s: -1, hw: d / 2, hd: w / 2, y: (R.ylo + R.yhi) / 2, slope });
    else FLOORS.push({ cx, cz, c: 1, s: 0, hw: w / 2, hd: d / 2, y: (R.ylo + R.yhi) / 2, slope });
    R.ramp = { ax, slope, cx, cz, mid: (R.ylo + R.yhi) / 2 };
  }
  return R;
}
const rTop = R => Math.max(R.ylo, R.yhi);
/* walls and ceilings: every edge of every room, minus where another room at about the same height crosses it */
function xSeal(pk) {
  const T = .3, E = .05;
  for (const R of pk.rects) {
    const top = rTop(R) + R.h, bot = Math.min(R.ylo, R.yhi);
    const edges = [['z', R.z0, R.x0, R.x1, -1], ['z', R.z1, R.x0, R.x1, 1], ['x', R.x0, R.z0, R.z1, -1], ['x', R.x1, R.z0, R.z1, 1]];
    for (const [ax, at, a0, a1, side] of edges) {
      const key = ax === 'z' ? (side < 0 ? 'n' : 's') : (side < 0 ? 'w' : 'e'); if (R.nowall.includes(key)) continue;
      const gaps = [];
      for (const Q of pk.rects) { if (Q === R) continue;
        if (Math.min(Q.ylo, Q.yhi) > rTop(R) + 1.2 || rTop(Q) < Math.min(R.ylo, R.yhi) - 1.2) continue;
        if (ax === 'z') { if (Q.z0 < at - E && Q.z1 > at + E || (side > 0 ? Q.z0 <= at + E && Q.z1 > at + E : Q.z1 >= at - E && Q.z0 < at - E)) { const g0 = Math.max(a0, Q.x0), g1 = Math.min(a1, Q.x1); if (g1 > g0 + .1) gaps.push([g0, g1]); } }
        else { if (Q.x0 < at - E && Q.x1 > at + E || (side > 0 ? Q.x0 <= at + E && Q.x1 > at + E : Q.x1 >= at - E && Q.x0 < at - E)) { const g0 = Math.max(a0, Q.z0), g1 = Math.min(a1, Q.z1); if (g1 > g0 + .1) gaps.push([g0, g1]); } }
      }
      gaps.sort((p, q) => p[0] - q[0]); let s = a0; const runs = [];
      for (const [g0, g1] of gaps) { if (g0 > s) runs.push([s, g0]); s = Math.max(s, g1); } if (a1 > s) runs.push([s, a1]);
      for (const [r0, r1] of runs) { const L = r1 - r0; if (L < .05) continue; const m = (r0 + r1) / 2, h = top - bot + .3, y = bot + h / 2 - .3;
        if (ax === 'z') xbox(pk.g, L + T * 2, h, T, R.wall, m, y, at + side * T / 2, 0, 2.5); else xbox(pk.g, T, h, L + T * 2, R.wall, at + side * T / 2, y, m, 0, 2.5); }
      // a lintel over each opening, down to the lower of the two ceilings
      for (const [g0, g1] of gaps) { const L = g1 - g0; if (L < .2) continue; const m = (g0 + g1) / 2;
        if (ax === 'z') xbox(pk.g, L, .4, T, R.wall, m, top - .2, at + side * T / 2, 0, 2.5); else xbox(pk.g, T, .4, L, R.wall, at + side * T / 2, top - .2, m, 0, 2.5); }
    }
    if (!R.noceil) xbox(pk.g, R.x1 - R.x0 + T * 2, .3, R.z1 - R.z0 + T * 2, R.ceil, (R.x0 + R.x1) / 2, top + .15, (R.z0 + R.z1) / 2, 0, 2.5);
  }
}
// a solid box that blocks walking inside a pocket (furniture, a closed door)
function xSolid(pk, x0, z0, x1, z1, o = {}) { const B = { x0: pk.ox + x0, z0: pk.oz + z0, x1: pk.ox + x1, z1: pk.oz + z1, on: true, ...o }; pk.obst.push(B); return B; }
// a door across an opening: slides up into the ceiling when opened. need: 'power' | an item id | null
function xDoor(pk, id, lx, lz, axis, width, o = {}) {
  const [x, z] = pw(pk, lx, lz), y = pk.y + (o.y || 0), h = o.h || 2.8, g = new THREE.Group(); g.position.set(x, y, z); pk.g.add(g); pk.dyn.add(g);
  const slab = xbox(g, axis === 'x' ? width : .25, h, axis === 'x' ? .25 : width, o.mat || 'panel', 0, h / 2, 0, 0, 1.5);
  for (const s of [-1, 1]) xbox(g, axis === 'x' ? width * .98 : .28, .12, axis === 'x' ? .28 : width * .98, 'yellow', 0, h / 2 + s * .9, 0);
  const lamp = mesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), axis === 'x' ? width / 2 + .2 : 0, 1.5, axis === 'x' ? 0 : width / 2 + .2, g);
  const B = xSolid(pk, lx - (axis === 'x' ? width / 2 : .35), lz - (axis === 'x' ? .35 : width / 2), lx + (axis === 'x' ? width / 2 : .35), lz + (axis === 'x' ? .35 : width / 2));
  const D = { id, pk, g, slab, lamp, B, need: o.need, label: o.label || 'the door', open: false, t: 0, h };
  const setOpen = (v, quiet) => { D.open = v; B.on = !v; lamp.material.color.set(v ? 0x5aff7a : 0xff3a2a); if (!quiet) { sfx('gate'); (G.flags.xd ||= {})[id] = 1; save(); } };
  D.setOpen = setOpen;
  XANIM.push((t, dt) => { D.t = clamp(D.t + (D.open ? dt : -dt) * .8, 0, 1); slab.position.y = h / 2 + D.t * (h - .3); });
  const canOpen = () => !D.need || (D.need === 'power' ? pk.powered : cnt(D.need) > 0 || (GEAR_DEFS[D.need] && has(GEAR_DEFS[D.need].kind)));
  const why = () => D.need === 'power' ? 'no power' : `needs ${nameOf(D.need).toLowerCase()}`;
  for (const s of [-1, 1]) { const ux = x + (axis === 'x' ? 0 : s * 1.1), uz = z + (axis === 'x' ? s * 1.1 : 0);
    xUse({ x: ux, y, z: uz, r: 1.8, pocket: pk, label: () => D.open ? null : canOpen() ? `Open ${D.label}` : `${D.label[0].toUpperCase() + D.label.slice(1)} · ${why()}`,
      act: () => { if (D.open) return; if (!canOpen()) { sfx('no'); toast(D.need === 'power' ? 'Dead. Nothing has power down here.' : `Locked — ${why()}`, 2.6); return; } setOpen(true); toast(`${D.label[0].toUpperCase() + D.label.slice(1)} grinds open`, 2.2); if (o.onOpen) o.onOpen(); } }); }
  XRESTORE.push(() => { const o = !!(G.flags.xd || {})[id]; setOpen(o, true); D.t = o ? 1 : 0; });
  return D;
}
// the generator: put a fuse in and the pocket has power
function xGenerator(pk, lx, lz, yaw = 0) {
  const [x, z] = pw(pk, lx, lz), y = pk.y, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; pk.g.add(g);
  xbox(g, 2.2, 1.4, 1.2, 'olive', 0, .7, 0); xbox(g, 2.3, .15, 1.3, 'metal', 0, 1.45, 0); xcyl(g, .12, .12, 1.6, 'metal', .8, 2.2, 0, 8);
  for (let i = 0; i < 4; i++) xbox(g, .05, .9, 1, 'dark', -.9 + i * .18, .7, .62);
  const pan = xbox(g, .5, .6, .08, 'metal', -.4, 1.0, .64), lamp = mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), -.4, 1.42, .66, g);
  xSolid(pk, lx - 1.3, lz - .8, lx + 1.3, lz + .8);
  const on = quiet => { pk.powered = true; lamp.material.color.set(0x5aff7a); for (const l of pk.plamps) { l.intensity = l.userData.I; if (l.userData.fx) l.userData.fx.material.color.setHex(l.userData.C); } if (!quiet) { (G.flags.xp ||= {})[pk.id] = 1; save(); } };
  pk.powerOn = on;
  const off = () => { pk.powered = false; lamp.material.color.set(0xff3a2a); for (const l of pk.plamps) { l.intensity = 0; if (l.userData.fx) l.userData.fx.material.color.setHex(0x2a2a2a); } };
  xUse({ x, y, z, r: 2.4, pocket: pk, label: () => pk.powered ? 'Generator · running' : cnt('fuse') || cnt('fuse_box') ? 'Fit a fuse and start the generator' : 'Generator · dead (needs a fuse)',
    act: () => { if (pk.powered) return; const f = cnt('fuse_box') ? 'fuse_box' : cnt('fuse') ? 'fuse' : null; if (!f) { sfx('no'); toast('The fuse slot is empty. Fuses turn up in ruins and the city — or a stash.', 3); return; }
      startChan({ l: 'Fitting the fuse', t: 1.6, fn: () => { take(f, 1); on(); sfx('reload'); noiseBurst(1.4, 90, 1, .25); toast('The generator coughs and catches · power is back', 3); } }); } });
  XRESTORE.push(() => (G.flags.xp || {})[pk.id] ? on(true) : off());
}
// a lamp that only lights when the pocket has power (or always, if it has its own)
function xPLamp(pk, lx, y, lz, color = 0xe8f0ff, I = 1.6, dist = 14) {
  const [x, z] = pw(pk, lx, lz), l = xLamp(pk.g, x, pk.y + y, z, color, I, dist); l.userData.I = l.intensity; l.userData.C = color;
  if (!pk.power) { pk.plamps.push(l); l.intensity = 0; if (l.userData.fx) l.userData.fx.material.color.setHex(0x2a2a2a); }
  return l;
}
// a dim emergency light that's always on (a battery that never quite died)
function xELamp(pk, lx, y, lz, color = 0xff4a2a, I = .55, dist = 9) { const [x, z] = pw(pk, lx, lz); const l = xLamp(pk.g, x, pk.y + y, z, color, I, dist), base = l.intensity, ph = xr(0, 6); if (xrnd() < .4) XANIM.push(t => { l.intensity = Math.sin(t * 17 + ph) > .9 ? .1 : base; }); return l; }
// loot inside a pocket
function xPCache(pk, lx, lz, yaw, lock, table, o = {}) { const [x, z] = pw(pk, lx, lz); const C = cache(pk.g, x, z, yaw, LOCKS[lock] && !['pry', 'cutter', 'bypass', 'card', 'chip', 'none'].includes(lock) ? 'card' : lock, table, o); C.lock = lock; C.g.position.y = pk.y + (o.y || 0); pk.dyn.add(C.g); return C; }
// the way in, on the surface, and the way out, inside
function xEntrance(pk, sx, sz, label, inSpot, outSpot) {
  pk.in = inSpot; pk.out = outSpot;
  xUse({ x: sx, z: sz, r: 2.8, pocket: null, label: () => label, act: () => xGo(pk, pk.in) });
}
function xExit(pk, lx, y, lz, label, out) { const [x, z] = pw(pk, lx, lz); xUse({ x, y: pk.y + y, z, r: 2.2, pocket: pk, label: () => label, act: () => xGo(null, out || pk.out) }); }
// move between the surface and a pocket, behind a quick fade
let xBusy = false;
function xGo(pk, spot) {
  if (xBusy || !spot) return; xBusy = true; const F = UG.fadeEl; F.style.opacity = 1; sfx('step', 1.2);
  setTimeout(() => { xGoNow(pk, spot); setTimeout(() => { F.style.opacity = 0; xBusy = false; }, 120); }, 380);
}
function xGoNow(pk, spot) {
  {
    if (UG.at) UG.at.g.visible = false;
    UG.at = pk; if (pk) { pk.g.visible = true; (G.flags.seen ||= {})['pk_' + pk.id] = 1; }
    P.x = spot.x; P.z = spot.z; P.y = spot.y ?? heightAt(spot.x, spot.z); P.eyeY = P.y; P.vx = P.vz = P.vy = 0; P.yaw = spot.yaw ?? P.yaw; P.fly = false; chan = null;
    UG.tagEl.textContent = pk ? `UNDERGROUND · ${pk.name}` : ''; UG.tagEl.style.display = pk ? 'block' : 'none';
    updTerrain(P.x, P.z); updForest?.(P.x, P.z);
    if (pk && !(G.flags.pkseen ||= {})[pk.id]) { G.flags.pkseen[pk.id] = 1; card(pk.name, pk.sub || 'Below ground', 3.4); save(); }
    const mm = $('minic'); if (mm) mm.style.visibility = pk ? 'hidden' : '';
  }
}
// inside a pocket: you can stand where a room is, at about its height, and not inside anything solid
function pkValid(pk, x, z, y, rad) {
  let inRoom = false;
  for (const R of pk.rects) { if (x < R.x0 + rad || x > R.x1 - rad || z < R.z0 + rad || z > R.z1 - rad) continue;
    const lo = Math.min(R.ylo, R.yhi) - 1.6, hi = rTop(R) + 1.6; if (y < lo || y > hi) continue; inRoom = true; break; }
  if (!inRoom) return false;
  for (const B of pk.obst) if (B.on && x > B.x0 - rad && x < B.x1 + rad && z > B.z0 - rad && z < B.z1 + rad && (B.ylo == null || (y > B.ylo - 1 && y < B.yhi))) return false;
  return true;
}
function pocketCollide(o, rad, ox, oz) {
  const pk = UG.at; if (!pk) return;
  // the grid's round colliders (crates and caches set inside the pocket)
  const i0 = Math.floor(o.x / CELL), j0 = Math.floor(o.z / CELL);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const L = grid.get(gkey(i, j)); if (!L) continue;
    for (const c of L) { const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; } } }
  if (pkValid(pk, o.x, o.z, o.y, rad)) return;
  if (pkValid(pk, o.x, oz, o.y, rad)) { o.z = oz; return; }
  if (pkValid(pk, ox, o.z, o.y, rad)) { o.x = ox; return; }
  o.x = ox; o.z = oz;
}
// a stretch of floor that gives way under you
function xWeak(pk, lx0, lz0, lx1, lz1, id, fl) {
  const W = { x0: pk.ox + lx0, z0: pk.oz + lz0, x1: pk.ox + lx1, z1: pk.oz + lz1, id, fl, gone: false, t: 0 };
  const cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2, w = W.x1 - W.x0, d = W.z1 - W.z0;
  W.mesh = xbox(pk.g, w, .3, d, 'rock', cx, pk.y - .15, cz); pk.dyn.add(W.mesh);
  W.cracks = []; for (let i = 0; i < 6; i++) { const c = mesh(new THREE.BoxGeometry(xr(.6, 1.6), .02, .05), xm('dark'), cx + xr(-w / 3, w / 3), pk.y + .01, cz + xr(-d / 3, d / 3), pk.g); c.rotation.y = xr(0, 3); W.cracks.push(c); pk.dyn.add(c); }
  FLOORS.push(W.floor = { cx, cz, c: 1, s: 0, hw: w / 2, hd: d / 2, y: pk.y });
  pk.weak.push(W);
  XRESTORE.push(() => { if ((G.flags.xc || {})[id] && !W.gone) xCollapse(W, true); });
  return W;
}
function xCollapse(W, quiet) {
  W.gone = true; const i = FLOORS.indexOf(W.floor); if (i >= 0) FLOORS.splice(i, 1);
  for (const c of W.cracks) c.visible = false;
  if (quiet) { W.mesh.visible = false; return; }
  (G.flags.xc ||= {})[W.id] = 1; sfx('thud'); noiseBurst(1.2, 120, .8, .4); puff(P.x, P.y + .5, P.z, 0x8a8478, 14, 4, .2, 1, -2);
  let t = 0; XANIM.push((tt, dt) => { if (!W.mesh.visible) return; t += dt; W.mesh.position.y -= dt * t * 9; W.mesh.rotation.z = t * .6; if (t > 1.5) W.mesh.visible = false; });
  toast('The floor gives way!', 2.2);
  setTimeout(() => { if (UG.at && !P.dead) hurtPlayer(12, P.x, P.z); }, 450);
}

/* ================= building it all ================= */
function buildExplore() {
  const s0 = seed; seed = 81051151;            // the world's stream, swapped out: helpers that use it can't move anything else
  xSites();
  for (const D of XSITE_DEFS) { const S = XSITES[D.id]; if (D.id === 'tunB') continue; REGIONS.push({ id: 'x_' + D.id, name: D.id === 'tunA' ? 'THE COLDWATER LINE' : D.name, sub: D.sub, x: S.x, z: S.z, r: Math.max(26, S.r + 14), hostile: !!D.hostile, base: !!D.hostile }); }
  buildMillbrook(); buildKVRN(); buildRidge(); buildCave(); buildTunnel(); buildHesper(); buildBright(); buildLongFall(); buildRoute9(); buildEmber(); buildBlackDoor();
  buildCrossings(); buildCamps(); buildStashes();
  for (const k in POCKETS) xSeal(POCKETS[k]);
  // the lamp you carry under the ground: a flashlight if you've got one, otherwise a lighter
  UG.lamp = new THREE.PointLight(0xffe0b0, 0, 10, 0); camera.add(UG.lamp); UG.lamp.position.set(.25, -.1, -.3);
  buildXHud();
  window.__X = { XPLOTS, sim: (n, dt = 1 / 30, pre) => { for (let i = 0; i < n; i++) { if (pre) pre(); G.t += dt; updPlayer(dt); updXplore(dt); if (typeof updChan === "function") updChan(dt); if (window.__simEnts) for (const e of [...ents]) if (e.type === "clan" && Math.hypot(e.x - P.x, e.z - P.z) < 300) updClan(e, dt); } }, xGoNow, XSITES, XCROSS, XCAMPS, XSTASH, POCKETS, UG, LOGS, XNOTES, XUSE, xGo, openLog, closeLog, pkValid };
  seed = s0;
}
function bakeExplore() {
  for (const k in POCKETS) { const pk = POCKETS[k]; pk.g.visible = true; const dyn = new Set([...pk.dyn]); pk.g.traverse(o => { if (o.isPointLight || (o.userData && o.userData.fx)) dyn.add(o); }); for (const l of [...pk.plamps]) if (l.userData.fx) dyn.add(l.userData.fx); try { bakeGroup(pk.g, dyn, 30); } catch (e) { console.warn('bake pocket', k, e); } pk.g.visible = UG.at === pk; }
}

/* ---------- Millbrook: a farm village, walked out of. A storm cellar under the Rourke place. ---------- */
function buildMillbrook() {
  const S = XSITES.millbrook, yaw = xr(0, 6.28), F = xFrame(S.x, S.z, yaw);
  // the street and the houses either side, the chapel at the top, the well in the middle
  for (let k = -32; k <= 32; k += 4) { const [x, z] = F(0, k); const m = xbox(world, 5, .12, 4.2, 'dirt', x, heightAt(x, z) + .03, z, yaw); m.receiveShadow = true; m.castShadow = false; }
  const homes = [[-11, -20, 0], [11, -18, Math.PI], [-12, -4, 0], [12, -2, Math.PI], [-11, 13, 0], [13, 15, Math.PI]];
  homes.forEach(([lx, lz, ry], i) => { const [x, z] = F(lx, lz); house(x, z, yaw + ry + XHPI + xr(-.06, .06), xr(7, 9), xr(6, 8), i === 3 ? 2 : 1); SHELTERS.push({ x, z, kind: 'house', r: 3.8 }); });
  // the chapel
  { const [x, z] = F(0, -36), g = new THREE.Group(), m = xm('concW');
    xbox(g, 9, 6, 14, m, 0, 3, 0); xbox(g, 3, 12, 3, m, 0, 6, -6.5); const sp = mesh(new THREE.ConeGeometry(2.4, 4, 4), xm('rust'), 0, 14, -6.5, g); sp.rotation.y = Math.PI / 4;
    const roof = mesh(new THREE.CylinderGeometry(.01, 6, 3, 4, 1), xm('rust'), 0, 7.5, 1, g); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.5;
    xbox(g, 2.2, 3, .2, 'dark', 0, 1.5, 7.05); for (const s of [-1, 1]) for (const zz of [-3, 2]) xbox(g, .1, 2, 1, 'glass', s * 4.52, 3.6, zz);
    const yy = xLowest(x, z, 9, 14, yaw); g.position.set(x, yy, z); g.rotation.y = yaw; world.add(g); xColRect(x, z, 9, 14, yaw, .5, 2.4); }
  // the well, with the notice nailed to it
  { const [x, z] = F(0, 4), y = heightAt(x, z); S.well = { x, z }; xcyl(world, 1.1, 1.2, .9, 'conc', x, y + .45, z, 14); for (const s of [-1, 1]) xbox(world, .14, 2, .14, 'woodD', x + s * .9, y + 1, z); xbox(world, 2.2, .12, .5, 'woodD', x, y + 2, z); addCol(x, z, 1.3);
    xNote(world, 'mb_notice', x + 1.25, y + .95, z, yaw); }
  // fences, overgrown gardens, a tractor rusting in a yard, a cart
  for (const [lx, lz] of [[-18, -12], [18, -10], [-18, 6], [19, 8]]) { const [x0, z0] = F(lx, lz - 6), [x1, z1] = F(lx, lz + 6); for (let t = 0; t <= 1; t += .125) { const x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (xrnd() < .2) continue; const p = xbox(world, .12, xr(.9, 1.3), .12, 'woodD', x, heightAt(x, z) + .5, z); p.rotation.z = xr(-.2, .2); } }
  { const [x, z] = F(20, -26), g = new THREE.Group(); xbox(g, 1.6, 1.2, 2.6, 'rust', 0, 1.1, 0); xbox(g, 1.2, 1, 1.2, 'rust', 0, 2.1, -.5);
    for (const [wx, wz, r] of [[-1, 1, .9], [1, 1, .9], [-.9, -1, .5], [.9, -1, .5]]) { const w = xcyl(g, r, r, .4, 'dark', wx, r, wz, 12); w.rotation.z = XHPI; } xPlace(g, x, z, yaw + .7); addCol(x, z, 1.8); }
  { const [x, z] = F(-6, 22); car(x, z, yaw + .3); }
  // a kitchen table with Ada's letter, a photo on a porch
  { const [x, z] = F(-12, -4), y = heightAt(x, z); xbox(world, 1.4, .08, .8, 'wood', x, y + .78, z, yaw); for (const [a, b] of [[-.6, -.3], [.6, -.3], [-.6, .3], [.6, .3]]) { const [px, pz] = xFrame(x, z, yaw)(a, b); xbox(world, .06, .76, .06, 'woodD', px, y + .38, pz); }
    xNote(world, 'mb_letter', x, y + .83, z, yaw); }
  { const [x, z] = F(9.5, 15); xNote(world, 'mb_photo', x, heightAt(x, z) + .05, z, yaw); }
  for (let i = 0; i < 6; i++) { const [x, z] = F(xr(-16, 16), xr(-28, 26)); spawnScrap(x, z, 'wild'); }
  for (const [lx, lz, t] of [[-14, -18, 'ruin'], [14, 0, 'ruin'], [-14, 14, 'wild']]) { const [x, z] = F(lx, lz); supplyCrate(x, z); CRATES[CRATES.length - 1].table = t; }
  // the Rourke place: the house at the bottom of the street, with storm-cellar doors against its side
  const [hx, hz] = F(14, 26); house(hx, hz, yaw + XHPI + .05, 8, 7); SHELTERS.push({ x: hx, z: hz, kind: 'house', r: 3.8 });
  const [cx, cz] = F(14, 31.5), cy = heightAt(cx, cz);
  { const g = new THREE.Group(); xbox(g, 2.4, .5, 2, 'conc', 0, .25, 0); for (const s of [-1, 1]) { const d = xbox(g, 1.15, .07, 1.9, 'woodD', s * .6, .55, 0); d.rotation.x = .35; d.rotation.z = s * .02; }
    xbox(g, .3, .06, .06, 'metal', 0, .62, -.3); xPlace(g, cx, cz, yaw); addCol(cx, cz, 1); }
  const pk = mkPocket('cellar', 'THE ROURKE CELLAR', { surf: 'gravel', fog: 40, hemi: .16, power: true }); pk.sub = 'Ansel Rourke didn’t walk to Hesper';
  const out = F(14, 34);
  xEntrance(pk, cx, cz, 'Open the cellar doors · go down', { x: pk.ox + 1.2, y: pk.y + 2.9, z: pk.oz + .9, yaw: Math.PI }, { x: out[0], z: out[1], yaw: Math.atan2(out[0] - cx, out[1] - cz) + Math.PI });
  buildCellar(pk);
}
function buildCellar(pk) {
  xRoom(pk, 0, 0, 2.4, 6, { y: 3, y2: 0, down: 1, axis: 'z', h: 2.6, wall: 'woodD', floor: 'woodD', ceil: 'woodD' });   // the steps down
  xRoom(pk, -3, 5, 6, 13, { h: 2.6, wall: 'conc', floor: 'concD', ceil: 'woodD' });                                       // the main room
  xRoom(pk, 4.5, 7, 10, 11.5, { h: 2.4, wall: 'conc', ceil: 'woodD' });                                                    // the pantry
  xRoom(pk, -6, 8, -2, 10, { h: 1.9, wall: 'rockD', floor: 'dirt', ceil: 'rockD' });                                       // the crawl behind the shelf
  xRoom(pk, -9.5, 6, -5, 12, { h: 2.2, wall: 'rockD', floor: 'dirt', ceil: 'woodD' });                                     // what he hid
  xExit(pk, 1.2, 2.9, .6, 'Climb out of the cellar');
  const [ox, oz] = [pk.ox, pk.oz], y = pk.y, g = pk.g;
  xPLamp(pk, 1.5, 2.5, 9, 0xffc890, 1.2, 10); xELamp(pk, 1.2, 2.4, 3, 0xffb060, .6, 7);
  // bunks, a table, a radio, shelves of tins
  if (!xModel(g, 'props/bed', .6, ox + 4.6, y, oz + 6.2, 0)) xbox(g, 2, .5, .9, 'woodD', ox + 4.6, y + .25, oz + 6.2); xSolid(pk, 3.5, 5, 6, 7);
  xbox(g, 1.6, .08, .9, 'wood', ox + .6, y + .78, oz + 10.5); for (const [a, b] of [[-.7, -.35], [.7, -.35], [-.7, .35], [.7, .35]]) xbox(g, .06, .76, .06, 'woodD', ox + .6 + a, y + .38, oz + 10.5 + b); xSolid(pk, -.3, 9.9, 1.5, 11.1);
  xbox(g, .5, .3, .3, 'olive', ox + .2, y + .97, oz + 10.4); mesh(new THREE.SphereGeometry(.03, 6, 4), xm('glowA'), ox + .4, y + 1.05, oz + 10.56, g);
  xNote(g, 'mb_rourke1', ox + 1, y + .83, oz + 10.6, .3, pk); xNote(g, 'mb_rourke2', ox + 4.8, y + .55, oz + 6.2, 0, pk);
  for (let k = 0; k < 4; k++) { xbox(g, .5, .06, 4, 'woodD', ox + 9.7, y + .4 + k * .5, oz + 9.25); for (let j = 0; j < 8; j++) xcyl(g, .07, .07, .14, xp(['metal', 'rust', 'olive']), ox + 9.65 + xr(-.1, .1), y + .5 + k * .5, oz + 7.6 + j * .46, 8); }
  xSolid(pk, 9.3, 7, 10, 11.5);
  xPCache(pk, 7.5, 10.8, Math.PI, 'none', 'wild', { id: 'x_cellar_pantry', name: 'Pantry crates', rolls: 2, keys: ['canned', 'water_filtered'], refill: 6 });
  // the shelf against the west wall, with what's behind it
  const shelf = new THREE.Group(); shelf.position.set(ox - 2.8, y, oz + 9); g.add(shelf); pk.dyn.add(shelf);
  xbox(shelf, .5, 2.2, 2.6, 'woodD', 0, 1.1, 0); for (let k = 0; k < 4; k++) xbox(shelf, .55, .05, 2.6, 'wood', .02, .3 + k * .55, 0);
  for (let j = 0; j < 10; j++) xcyl(shelf, .07, .07, .14, xp(['metal', 'rust']), .05, .38 + (j % 4) * .55, -1.1 + j * .24, 8);
  const SB = xSolid(pk, -3.2, 7.6, -2.4, 10.4);
  const moved = () => { SB.on = false; shelf.position.z = oz + 11.3; shelf.rotation.y = .25; };
  xUse({ x: ox - 2, y, z: oz + 9, r: 1.6, pocket: pk, label: () => SB.on ? ((G.flags.logs || {}).mb_rourke2 ? 'Shift the shelf · he said he moved things behind it' : 'The shelf rocks when you lean on it · shift it') : null,
    act: () => startChan({ l: 'Shifting the shelf', t: 1.4, fn: () => { moved(); (G.flags.xd ||= {}).cellar_shelf = 1; sfx('thud'); toast('There’s a gap in the wall behind it', 2.4); save(); } }) });
  XRESTORE.push(() => { if ((G.flags.xd || {}).cellar_shelf) moved(); else { SB.on = true; shelf.position.z = oz + 9; shelf.rotation.y = 0; } });
  xSkeleton(g, ox - 8, y, oz + 9, XHPI, 1); xbox(g, .5, .45, .5, 'woodD', ox - 8, y + .22, oz + 9.1);
  xNote(g, 'mb_rourke3', ox - 7.2, y + .02, oz + 8.4, 0, pk);
  xPCache(pk, -8.5, 6.9, 0, 'none', 'ruin', { id: 'x_cellar_hidden', name: 'Rourke’s strongbox', rolls: 2, keys: ['revolver', 'ammo_9', 'fuse_box'], refill: 0 });
  xELamp(pk, -7, 2, 9, 0xffb060, .5, 6);
  XMARKS.hesper_map = { x: XSITES.hesper.x, z: XSITES.hesper.z, n: 'Fort Hesper' };
  LOGS.mb_rourke3.mark = 'hesper_map';
}

/* ---------- KVRN: an old radio station on the south rim ---------- */
function buildKVRN() {
  const S = XSITES.kvrn, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  // the station house: concrete, the roof half gone
  { const g = new THREE.Group(), y = xLowest(S.x, S.z, 12, 8, yaw);
    xbox(g, 12, .4, 8, 'concD', 0, .2, 0); for (const [x, z, w, d] of [[0, -3.9, 12, .3], [-5.9, 0, .3, 8], [5.9, 0, .3, 8], [-3.7, 3.9, 4.6, .3], [3.7, 3.9, 4.6, .3]]) xbox(g, w, 3.4, d, 'conc', x, 1.9, z);
    xbox(g, 12.4, .3, 4.5, 'concD', 0, 3.7, -1.8); xbox(g, 3, .6, 8.4, 'conc', -4.7, 3.7, 0);
    for (const x of [-3, 3]) xbox(g, 1.4, 1, .32, 'glass', x, 2.2, -3.9);
    g.position.set(S.x, y, S.z); g.rotation.y = yaw; world.add(g); xColRect(S.x, S.z, 12, 8, yaw, .45, 2.8); addFloor(S.x, S.z, yaw, 6, 4, y + .4); SHELTERS.push({ x: S.x, z: S.z, kind: 'house', r: 4 });
    // inside: the broadcast desk, racks, the tape machine still turning
    const [tx, tz] = F(-2, -2.6); xNote(world, 'kv_term', tx, y + .4, tz, yaw + Math.PI);
    const [rx, rz] = F(3.5, -2.5); if (!xModel(world, 'props/server-rack', 2, rx, y + .4, rz, yaw + Math.PI)) xbox(world, .8, 2, .6, 'metal', rx, y + 1.4, rz, yaw);
    const [ux, uz] = F(4.8, 1.5); xbox(world, .9, .8, .5, 'woodD', ux, y + .8, uz, yaw); xNote(world, 'kv_numbers', ux, y + 1.2, uz, yaw);
    const reel = []; for (const s of [-1, 1]) { const [qx, qz] = xFrame(ux, uz, yaw)(s * .18, 0); const r = xcyl(world, .12, .12, .03, 'dark', qx, y + 1.3, qz, 12); reel.push(r); } XANIM.push((t, dt) => { for (const r of reel) r.rotation.y += dt * 2; });
    const [nx, nz] = F(-4.5, 2); xNote(world, 'kv_log', nx, y + .45, nz, yaw);
    const [cx, cz] = F(-4.5, -2.4); const C = cache(world, cx, cz, yaw, 'pry', 'ruin', { id: 'x_kvrn_locker', name: 'Engineer’s locker', rolls: 2, keys: ['radio', 'battery'], refill: 5 }); C.g.position.y = y + .4;
  }
  // the mast: a lattice tower with dishes, a red lamp at the top that still blinks
  { const [x, z] = F(0, 12), H = 42, g = new THREE.Group(); g.add(mesh(lattice(3.4, H, 0x8a8a86, 3), VCOL));
    for (const [yy, a] of [[H - 6, .4], [H - 10, 2.6], [H - 14, 4.4]]) { const d = mesh(new THREE.CylinderGeometry(1.5, 1.5, .2, 16), xSm(0xd0d0cc), Math.sin(a) * 2, yy, Math.cos(a) * 2, g); d.rotation.set(1.2, a, 0); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })); lamp.position.y = H + .6; g.add(lamp); XANIM.push(t => { lamp.visible = Math.sin(t * 2.2) > .2; });
    for (const s of [0, 2.1, 4.2]) { const [ax, az] = xFrame(x, z, s)(0, 22); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, heightAt(x, z) + H - 4, z), new THREE.Vector3(ax, heightAt(ax, az) + .2, az)]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); world.add(ln); }
    xPlace(g, x, z, .3); addCol(x, z, 2.4); }
  // a generator shed and fuel drums
  { const [x, z] = F(-9, 6); const g = new THREE.Group(); xbox(g, 3, 2.4, 2.4, 'rust', 0, 1.2, 0); xbox(g, 3.3, .1, 2.7, 'rust', 0, 2.45, 0); xPlace(g, x, z, yaw); addCol(x, z, 1.7); }
  for (let i = 0; i < 4; i++) { const [x, z] = F(-7 + xr(-1, 1), 9 + i * .9); xcyl(world, .3, .3, .9, 'rust', x, heightAt(x, z) + .45, z, 10); }
  for (let i = 0; i < 3; i++) { const [x, z] = F(xr(-8, 8), xr(4, 14)); spawnScrap(x, z, 'wild'); }
}

/* ---------- the ridge trail and the summit ---------- */
function buildRidge() {
  // cairns and marker posts all the way up, a rope on the steep bits
  for (let i = 4; i < XTRAIL.length; i += 5) { const [x, z] = XTRAIL[i], y = heightAt(x, z);
    if (i % 10 === 4) { for (let k = 0; k < 4; k++) mesh(new THREE.DodecahedronGeometry(.32 - k * .06, 0), M(0x8a8680), x + xr(-.06, .06), y + .2 + k * .36, z + xr(-.06, .06), world); }
    else { const p = xbox(world, .1, 1.5, .1, 'woodD', x + 1.2, y + .7, z); const f = mesh(new THREE.PlaneGeometry(.35, .2), xm('cloth'), x + 1.37, y + 1.3, z, world); f.rotation.y = xr(0, 6); }
  }
  for (let i = 1; i < XTRAIL.length - 1; i++) { const [x, z] = XTRAIL[i]; if (slopeAt(x, z) < .7 || i % 2) continue; const [px, pz] = XTRAIL[i - 1], yy = heightAt(x, z), py = heightAt(px, pz);
    const p = xbox(world, .1, 1.1, .1, 'woodD', x - 1, yy + .5, z); const a = new THREE.Vector3(x - 1, yy + 1, z), b = new THREE.Vector3(px - 1, py + 1, pz); world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0x8a7a5a }))); }
  // the top: a pole with a mirror, a lean-to, Maren's pages under a stone, a stash
  const S = XSITES.summit, y = heightAt(S.x, S.z);
  { const g = new THREE.Group(); xbox(g, .12, 4.5, .12, 'woodD', 0, 2.25, 0); const mr = mesh(new THREE.CircleGeometry(.4, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05 }), 0, 4.2, .08, g); XANIM.push(t => { mr.rotation.y = Math.sin(t * .4) * .6; });
    const fl = mesh(new THREE.PlaneGeometry(1, .6), xm('cloth'), .55, 3.8, 0, g); XANIM.push(t => { fl.rotation.y = Math.sin(t * 2) * .3; }); xPlace(g, S.x, S.z); addCol(S.x, S.z, .3); }
  { const [x, z] = xFrame(S.x, S.z, 0)(3, 2); const g = new THREE.Group(); const t = mesh(new THREE.PlaneGeometry(3, 2.2), xm('hide'), 0, 1, 0, g); t.rotation.x = -1; xbox(g, .1, 1.8, .1, 'woodD', -1.4, .9, -.5); xbox(g, .1, 1.8, .1, 'woodD', 1.4, .9, -.5); xPlace(g, x, z, .5); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; mesh(new THREE.DodecahedronGeometry(.2, 0), M(0x5a5650), S.x + 2 + Math.cos(a) * .6, y + .05, S.z - 2 + Math.sin(a) * .6, world); }
  mesh(new THREE.DodecahedronGeometry(.4, 0), M(0x8a8680), S.x - 1.5, y + .2, S.z + 1, world); xNote(world, 'rd_summit', S.x - 1, y + .1, S.z + 1.6, .4);
  { const C = cache(world, S.x + 2.5, S.z - 2.4, .4, 'none', 'wild', { id: 'x_summit', name: 'Scout’s pack', rolls: 2, keys: ['binoculars'], refill: 0 }); }
}

/* ---------- Whisper Cave ---------- */
function buildCave() {
  const S = XSITES.cave, f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z);
  // the mouth: two great rocks and a lintel stone, black inside
  { const g = new THREE.Group(); for (const s of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(3.2, 1), xm('rock'), s * 3.6, 2.2, -1, g); r.scale.set(.8, 1.3, 1.1); }
    const top = mesh(new THREE.DodecahedronGeometry(3.4, 1), xm('rock'), 0, 5.6, -1.6, g); top.scale.set(1.6, .6, 1.1);
    mesh(new THREE.PlaneGeometry(4.4, 4.4), xm('dark'), 0, 2.1, -1.2, g); xRubble(g, 0, 0, 1.5, 8, 2.5, 'rock');
    g.position.set(S.x, y - .6, S.z); g.rotation.y = f; world.add(g); }
  for (const s of [-1, 1]) { const [x, z] = F(s * 3.6, -1); addCol(x, z, 2.6); } { const [x, z] = F(0, -2.4); addCol(x, z, 1.7); }
  const pk = mkPocket('cave', 'WHISPER CAVE', { surf: 'gravel', fog: 38, hemi: .28, hemiC: 0x8a9aa0 }); pk.sub = 'It hums. Eleven seconds, every time.';
  const [ex, ez] = F(0, 1.8), [ox, oz] = F(0, 4.5);
  xEntrance(pk, ex, ez, 'Go into the cave', { x: pk.ox + 2, y: pk.y + 2, z: pk.oz + .9, yaw: Math.PI }, { x: ox, z: oz, yaw: f });
  const r = { wall: 'rock', floor: 'dirt', ceil: 'rockD' };
  xRoom(pk, 0, 0, 4, 10, { ...r, y: 2, y2: 0, down: 1, axis: 'z', h: 3.4 });     // the way in, sloping down
  xRoom(pk, -6, 9, 8, 24, { ...r, h: 5.5 });                                       // the painted hall
  xRoom(pk, 6.5, 14, 20, 21, { ...r, h: 4, nofloor: 1 });                           // the side gallery (its floor is laid by hand, round the weak patch)
  xRoom(pk, 12, 14, 20, 21, { ...r, y: -5, h: 5, noceil: 1 });                      // the deep chamber, under it
  xExit(pk, 2, 1.9, .5, 'Climb out of the cave');
  // the gallery floor: solid round the edges, the middle ready to give way
  const gf = (x0, z0, x1, z1) => { const [ax, az] = pw(pk, x0, z0), [bx, bz] = pw(pk, x1, z1), cx = (ax + bx) / 2, cz = (az + bz) / 2, w = bx - ax, d = bz - az; xbox(pk.g, w, .3, d, 'dirt', cx, pk.y - .15, cz); addFloor(cx, cz, 0, w / 2, d / 2, pk.y); };
  gf(6.5, 14, 13.5, 21); gf(13.5, 14, 20, 15.2); gf(13.5, 19.8, 20, 21); gf(18.5, 15.2, 20, 19.8);
  xWeak(pk, 13.5, 15.2, 18.5, 19.8, 'cave_floor');
  const g = pk.g, Y = pk.y;
  // rock clutter along the walls, stalactites, glowing fungus
  for (const R of pk.rects) { if (R.ylo !== R.yhi) continue; const n = Math.round((R.x1 - R.x0 + R.z1 - R.z0) / 3);
    for (let i = 0; i < n; i++) { const side = i % 4, t = xrnd(), x = side < 2 ? lerp(R.x0, R.x1, t) : side === 2 ? R.x0 + .3 : R.x1 - .3, z = side >= 2 ? lerp(R.z0, R.z1, t) : side === 0 ? R.z0 + .3 : R.z1 - .3;
      const s = xr(.5, 1.3), m = mesh(new THREE.DodecahedronGeometry(s, 0), xm('rock'), x, R.ylo + s * .3, z, g); m.rotation.set(xr(0, 3), xr(0, 3), xr(0, 3)); m.scale.y = xr(.6, 1.4);
      if (xrnd() < .5) { const st = mesh(new THREE.ConeGeometry(xr(.1, .3), xr(.6, 1.6), 5), xm('rockD'), lerp(R.x0 + 1, R.x1 - 1, xrnd()), R.ylo + R.h - .4, lerp(R.z0 + 1, R.z1 - 1, xrnd()), g); st.rotation.x = Math.PI; } } }
  const fungus = (lx, lz, yy) => { const [x, z] = pw(pk, lx, lz); for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(xr(.04, .1), 6, 4), xm('glowT'), x + xr(-.5, .5), Y + yy + xr(0, .6), z + xr(-.5, .5), g); xLamp(g, x, Y + yy + .6, z, 0x4ad0c0, .7, 8, false); };
  fungus(-5, 12, .2); fungus(7, 22, .3); fungus(16, 20.5, -4.8); fungus(13, 14.5, -4.8);
  // the old camp in the hall: a dead fire, a bedroll, the recorder, the paintings on the wall
  { const [x, z] = pw(pk, 1, 17); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mesh(new THREE.DodecahedronGeometry(.16, 0), M(0x4a4640), x + Math.cos(a) * .5, Y + .08, z + Math.sin(a) * .5, g); } mesh(new THREE.CircleGeometry(.45, 10), xm('char'), x, Y + .02, z, g).rotation.x = -XHPI;
    const br = mesh(new THREE.BoxGeometry(.8, .12, 2), M(0x3a4a5a), x + 2, Y + .06, z, g); xNote(g, 'cv_rec', x + 1.4, Y + .02, z - 1.2, .4, pk);
  }
  { const [x, z] = pw(pk, -5.85, 16); const pnt = mesh(new THREE.PlaneGeometry(5, 2.6), new THREE.MeshBasicMaterial({ color: 0x9a4a2a, transparent: true, opacity: .55 }), x, Y + 2.4, z, g); pnt.rotation.y = XHPI;
    for (let i = 0; i < 9; i++) { const m = mesh(new THREE.PlaneGeometry(xr(.2, .5), xr(.3, .8)), new THREE.MeshBasicMaterial({ color: xp([0x2a1a12, 0x7a2a1a, 0xc06a3a]) }), x + .02, Y + xr(1.4, 3.4), z + xr(-2.2, 2.2), g); m.rotation.y = XHPI; }
    const ring = mesh(new THREE.TorusGeometry(.6, .06, 4, 18), new THREE.MeshBasicMaterial({ color: 0x1a120e }), x + .03, Y + 3.4, z + 1.2, g); ring.rotation.y = XHPI;
    xNote(g, 'cv_painting', x + .4, Y + .4, z, XHPI, pk); }
  // an underground pool in the gallery's far corner (you can't walk on water)
  { const [x, z] = pw(pk, 9, 19.5); const w = mesh(new THREE.PlaneGeometry(4, 2.6), xm('water'), x, Y + .05, z, g); w.rotation.x = -XHPI; xSolid(pk, 7, 18.2, 11, 20.8); }
  // the deep chamber: thirteen marks in a ring, the carving, and what the old survey team left
  { const [x, z] = pw(pk, 16, 17.5), y3 = Y - 5;
    for (let i = 0; i < 13; i++) { const a = i / 13 * 6.28, st = mesh(new THREE.BoxGeometry(.3, xr(.7, 1.1), .18), xm('rockD'), x + Math.cos(a) * 2.2, y3 + .45, z + Math.sin(a) * 2.2, g); st.rotation.y = -a; }
    xNote(g, 'cv_deep', x, y3, z, 0, pk);
    xRubble(g, x - 1, y3, z + .5, 10, 1.6, 'rock');
    xPCache(pk, 19, 15, -XHPI, 'none', 'mil', { id: 'x_cave_deep', name: 'Survey team’s case', rolls: 2, keys: ['flashlight', 'rope', 'fuse'], refill: 0, y: -5 });
    xSkeleton(g, x - 2.5, y3, z + 2.6, 2.4);
    // a rope back up to the gallery
    const [rx, rz] = pw(pk, 19.2, 20.4); xcyl(g, .04, .04, 5, M(0x8a7a5a), rx, y3 + 2.5, rz, 5);
    xUse({ x: rx, y: y3, z: rz, r: 1.8, pocket: pk, label: () => 'Climb the rope back up', act: () => startChan({ l: 'Climbing', t: 1.2, fn: () => { P.x = pk.ox + 19.2; P.z = pk.oz + 20.4; P.y = pk.y + .1; P.vy = 0; } }) }); }
}

/* ---------- the Coldwater Line: an old rail tunnel through the east rim ---------- */
function buildTunnel() {
  const A = XSITES.tunA, B = XSITES.tunB;
  const portal = (S, label) => { const f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z) - .3, g = new THREE.Group();
    xbox(g, 9, 7.5, 2.4, 'conc', 0, 3.75, -.6); xbox(g, 5.6, 5.6, .3, 'dark', 0, 2.8, .65);
    xbox(g, 9.6, .8, 2.8, 'concD', 0, 7.6, -.6); for (const s of [-1, 1]) { xbox(g, 1.2, 7.5, 3.6, 'concD', s * 5, 3.75, -.4); const wing = xbox(g, 6, 5, .8, 'conc', s * 7.6, 2.3, -2.2); wing.rotation.y = s * .5; }
    for (let k = 0; k < 40; k++) { const tz = .9 + k * 1.2; xbox(g, 2.6, .12, .25, 'woodD', 0, .08, tz); } for (const s of [-1, 1]) xbox(g, .08, .12, 48, 'metal', s * .72, .2, 24.8);
    xbox(g, 2.4, 1.4, .1, 'white', 3.2, 2.6, .8); xbox(g, 2.2, .3, .02, 'paint', 3.2, 2.9, .86);
    xRubble(g, 0, 0, 3, 6, 3, 'rock'); g.position.set(S.x, y, S.z); g.rotation.y = f; world.add(g);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const [x, z] = F(s * (3.4 + k * 1.6), -.4); addCol(x, z, .9); } { const [x, z] = F(0, -1.2); addCol(x, z, 2); }
    return F; };
  const FA = portal(A), FB = portal(B);
  const pk = mkPocket('tunnel', 'THE COLDWATER LINE', { surf: 'gravel', fog: 60, hemi: .2, hemiC: 0x9aa0a8 }); pk.sub = 'Two hours’ walk, under the rim';
  const L = 240;
  const [ax, az] = FA(0, 1.6), [aox, aoz] = FA(0, 4), [bx, bz] = FB(0, 1.6), [box2, boz] = FB(0, 4);
  pk.in = { x: pk.ox + 2.5, y: pk.y, z: pk.oz, yaw: -XHPI }; pk.out = { x: aox, z: aoz, yaw: A.face };
  const inB = { x: pk.ox + L - 2.5, y: pk.y, z: pk.oz, yaw: XHPI }, outB = { x: box2, z: boz, yaw: B.face };
  xUse({ x: ax, z: az, r: 3, pocket: null, label: () => 'Walk into the tunnel', act: () => xGo(pk, pk.in) });
  xUse({ x: bx, z: bz, r: 3, pocket: null, label: () => 'Walk into the tunnel', act: () => xGo(pk, inB) });
  xNote(world, 'tn_order', ...(() => { const [x, z] = FA(3.2, 1.2); return [x, heightAt(x, z) + .1, z]; })(), A.face);
  const r = { wall: 'concD', floor: 'concD', ceil: 'concD' };
  xRoom(pk, 0, -3, L, 3, { ...r, h: 5.5 });
  xRoom(pk, 100, -9, 107, -2, { ...r, h: 3 });          // the alcove with the generator panel
  xRoom(pk, 110, 3.6, 120, 11, { ...r, h: 3 });         // the maintenance bay
  xRoom(pk, 113.4, 2, 116.6, 4.6, { ...r, h: 2.8 });    // its doorway
  xExit(pk, 1, 0, 0, 'Walk out of the tunnel · west portal', pk.out); xExit(pk, L - 1, 0, 0, 'Walk out of the tunnel · east portal', outB);
  const g = pk.g, Y = pk.y;
  // the line itself: sleepers, rails, cable trays, a lamp every 30 m (dead until the generator runs), red emergency lights
  { const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, .12, 2.6), xm('woodD'), Math.floor(L / 1.2)); const d = new THREE.Object3D();
    for (let i = 0; i < sl.count; i++) { d.position.set(pk.ox + .6 + i * 1.2, Y + .06, pk.oz); d.rotation.y = xr(-.05, .05); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); } g.add(sl);
    for (const s of [-1, 1]) xbox(g, L, .12, .08, 'metal', pk.ox + L / 2, Y + .18, pk.oz + s * .72, 0, 4);
    for (const s of [-1, 1]) xbox(g, L, .1, .4, 'metal', pk.ox + L / 2, Y + 3.6, pk.oz + s * 2.75, 0, 4); }
  for (let x = 15; x < L; x += 30) xPLamp(pk, x, 5.2, 0, 0xe8f0ff, 1.5, 22);
  for (let x = 30; x < L; x += 45) xELamp(pk, x, 2.6, -2.8, 0xff3a2a, .5, 10);
  // the flooded stretch, the cave-in and a derailed cart
  { const w = mesh(new THREE.PlaneGeometry(34, 6), xm('water'), pk.ox + 75, Y + .22, pk.oz, g); w.rotation.x = -XHPI; }
  { const [x, z] = pw(pk, 168, 0); xRubble(g, x, Y, z + 1.4, 22, 4, 'concD'); xSolid(pk, 163, 0, 173, 3); const sl2 = xbox(g, 6, .5, 3.2, 'concD', x - 1, Y + 1.5, z + 1.6); sl2.rotation.z = .4; }
  { const [x, z] = pw(pk, 140, -1.2), c = new THREE.Group(); xbox(c, 3.2, 1.2, 1.8, 'rust', 0, .9, 0); for (const s of [-1, 1]) for (const t of [-1, 1]) { const wh = xcyl(c, .3, .3, .12, 'dark', s * 1, .3, t * .9, 10); wh.rotation.x = XHPI; } c.position.set(x, Y, z); c.rotation.set(0, .2, .25); g.add(c); xSolid(pk, 138, -2.4, 142.2, .2); }
  // the alcove: the panel the logger talks about
  xGenerator(pk, 103.5, -7.6, Math.PI);
  xNote(g, 'tn_rec', pk.ox + 101, Y + 1, pk.oz - 2.7, 0, pk); xbox(g, .8, .9, .5, 'olive', pk.ox + 101, Y + .45, pk.oz - 2.7); xSolid(pk, 100.5, -3, 101.5, -2.4);
  // the maintenance bay, behind a door that needs power
  xDoor(pk, 'tunnel_bay', 115, 3.3, 'x', 3.2, { need: 'power', label: 'the maintenance bay' });
  xPLamp(pk, 115, 2.8, 7, 0xe8f0ff, 1.2, 10);
  for (let k = 0; k < 3; k++) xbox(g, 4, .06, .6, 'metal', pk.ox + 116, Y + .5 + k * .6, pk.oz + 10.6);
  xModel(g, 'props/tool-racks', 2, pk.ox + 111.5, Y, pk.oz + 10.4, Math.PI); xSolid(pk, 114, 10, 118, 11); xSolid(pk, 110, 9.6, 113, 11);
  xPCache(pk, 118.6, 7, -XHPI, 'none', 'ruin', { id: 'x_tunnel_bay', name: 'Spares cage', rolls: 3, keys: ['tool_kit', 'spare_parts', 'fuse'], refill: 5 });
  xbox(g, .6, .6, .6, 'yellow', pk.ox + 111, Y + .3, pk.oz + 4.6);
  for (let i = 0; i < 8; i++) { const [x, z] = pw(pk, xr(10, L - 10), xr(-2.4, 2.4)); const m = mesh(new THREE.DodecahedronGeometry(xr(.2, .5), 0), xm('concD'), x, Y + .15, z, g); m.scale.y = .5; }
}

/* ---------- Fort Hesper and the bunker under it ---------- */
function buildHesper() {
  const S = XSITES.hesper, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  BASES.push({ id: 'hesper', name: 'FORT HESPER', sub: 'Old-world army post · Ironjaw squatters', x: S.x, z: S.z, R: 40, fac: 'iron', hostile: true });
  // the perimeter: sandbag walls and concrete blocks, a gap at the gate (facing the valley)
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28; if (Math.abs(angWrap(a - XHPI)) < .14) continue; const [x, z] = F(Math.cos(a) * 36, Math.sin(a) * 36), y = heightAt(x, z);
    if (i % 8 === 0) { xbox(world, 1.8, 1.4, 1, 'conc', x, y + .7, z, yaw - a - XHPI); addCol(x, z, 1); continue; }
    xbox(world, 3.4, .9, 1.1, 'sand', x, y + .45, z, yaw - a - XHPI); addCol(x, z, 1.4); }
  // watchtowers at the gate
  for (const s of [-1, 1]) { const [x, z] = F(s * 7, 38), g = new THREE.Group(); g.add(mesh(lattice(3, 7, 0x5a5a50, 2.4), VCOL)); xbox(g, 3.4, .2, 3.4, 'olive', 0, 7, 0); for (const k of [[0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]]) xbox(g, k[0] ? .1 : 3.4, 1, k[0] ? 3.4 : .1, 'sand', k[0], 7.5, k[1]); xbox(g, 3.6, .1, 3.6, 'olive', 0, 9.4, 0); xPlace(g, x, z, yaw); addCol(x, z, 1.8); }
  // a comms mast, barracks huts (half-round tin), a command block, trucks, a fuel dump
  { const [x, z] = F(-20, -20), g = new THREE.Group(); g.add(mesh(lattice(2, 24, 0x6a6a64, 3), VCOL)); xPlace(g, x, z); addCol(x, z, 1.2); }
  for (const [lx, lz] of [[-18, 4], [-18, 16], [18, 10]]) { const [x, z] = F(lx, lz), g = new THREE.Group(), h = mesh(new THREE.CylinderGeometry(3, 3, 12, 14, 1, true, -XHPI, Math.PI), new THREE.MeshLambertMaterial({ map: texCorr, color: 0x6a7058, side: THREE.DoubleSide }), 0, 0, 0, g); h.rotation.x = -XHPI;
    const y0 = xLowest(x, z, 6, 12, yaw); g.position.set(x, y0, z); g.rotation.y = yaw; world.add(g); for (const s of [-1, 1]) xbox(world, 6, 3, .2, 'olive', ...(() => { const [px, pz] = xFrame(x, z, yaw)(0, s * 6); return [px, y0 + 1.5, pz]; })(), yaw);
    colRect(x, z, 6, 12, yaw, .5, []); SHELTERS.push({ x, z, kind: 'house', r: 2.4 }); }
  const [kx, kz] = F(6, -12);
  { const g = new THREE.Group(), y0 = xLowest(kx, kz, 12, 9, yaw); xbox(g, 12, .4, 9, 'concD', 0, .2, 0); for (const [x, z, w, d] of [[0, -4.4, 12, .3], [-5.9, 0, .3, 9], [5.9, 0, .3, 9], [-3.8, 4.4, 4.4, .3], [3.8, 4.4, 4.4, .3]]) xbox(g, w, 3.2, d, 'conc', x, 1.8, z); xbox(g, 12.4, .3, 9.4, 'concD', 0, 3.5, 0);
    xbox(g, 4, 1, .1, 'white', 0, 2.8, 4.6); xbox(g, 3.8, .4, .02, 'olive', 0, 2.8, 4.66);
    g.position.set(kx, y0, kz); g.rotation.y = yaw; world.add(g); xColRect(kx, kz, 12, 9, yaw, .45, 3.2); addFloor(kx, kz, yaw, 6, 4.5, y0 + .4); SHELTERS.push({ x: kx, z: kz, kind: 'house', r: 4 });
    const [nx, nz] = xFrame(kx, kz, yaw)(-3, -2); xbox(world, 1.6, .8, .8, 'woodD', nx, y0 + .8, nz, yaw); xNote(world, 'hs_iron', nx, y0 + 1.22, nz, yaw);
    const [cx, cz] = xFrame(kx, kz, yaw)(3.5, -3); const C = cache(world, cx, cz, yaw, 'none', 'mil', { id: 'x_hesper_cmd', name: 'Ironjaw loot pile', rolls: 1, refill: 4 }); C.g.position.y = y0 + .4; }
  for (const [lx, lz, a] of [[10, 18, .3], [22, -2, 1.4]]) { const [x, z] = F(lx, lz), g = new THREE.Group(); xbox(g, 2.4, 1.1, 6.4, 'olive', 0, 1.2, 0); xbox(g, 2.4, 1.4, 2, 'olive', 0, 2.2, 2.2); xbox(g, 2.5, 2.2, 4, 'cloth', 0, 2.9, -1.2);
    for (const [wx, wz] of [[-1.2, 2.2], [1.2, 2.2], [-1.2, -1.5], [1.2, -1.5], [-1.2, -2.8], [1.2, -2.8]]) { const w = xcyl(g, .55, .55, .4, 'dark', wx, .55, wz, 12); w.rotation.z = XHPI; }
    g.rotation.z = xr(-.06, .06); xPlace(g, x, z, yaw + a); const F2 = xFrame(x, z, yaw + a); for (const k of [-2, 0, 2]) { const [px, pz] = F2(0, k); addCol(px, pz, 1.4); } }
  for (let i = 0; i < 10; i++) { const [x, z] = F(24 + (i % 4) * 1, 14 + Math.floor(i / 4) * 1); xcyl(world, .32, .32, .95, xp(['olive', 'rust']), x, heightAt(x, z) + .47, z, 10); }
  for (let i = 0; i < 3; i++) { const [x, z] = F(xr(-25, 25), xr(-25, 25)); supplyCrate(x, z); CRATES[CRATES.length - 1].table = 'mil'; }
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-28, 28), xr(-28, 28)); spawnScrap(x, z, 'wild'); }
  // the bunker door in the low concrete block at the back
  const [bx, bz] = F(0, -26), by = heightAt(bx, bz);
  { const g = new THREE.Group(); if (!xModel(g, 'e/bunker', 4.5, 0, 0, 0, Math.PI)) { xbox(g, 8, 4, 6, 'conc', 0, 1.6, 0); xbox(g, 2.4, 2.6, .2, 'panel', 0, 1.3, 3.05); } g.position.set(bx, by - .4, bz); g.rotation.y = yaw; world.add(g); addCol(bx, bz, 3.2); }
  const pk = mkPocket('hesper', 'HESPER BUNKER', { surf: 'metal', fog: 50, hemi: .1 }); pk.sub = 'The 4th Provincial Guard held out down here';
  const [ex, ez] = F(0, -21.5), [ox, oz] = F(0, -19);
  xEntrance(pk, ex, ez, 'Go down into the bunker', { x: pk.ox + 1.5, y: pk.y + 3.9, z: pk.oz + .8, yaw: Math.PI }, { x: ox, z: oz, yaw });
  // garrison: Ironjaw holding the fort
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-22, 22), xr(-20, 24)); spawnClan(i % 4 === 3 ? 'brute' : 'gunner', x, z, 'guard', 'iron'); }
  buildHesperBunker(pk);
}
function buildHesperBunker(pk) {
  const r = { wall: 'conc', floor: 'tile', ceil: 'concD' };
  xRoom(pk, 0, 0, 3, 8, { ...r, y: 4, y2: 0, down: 1, axis: 'z', h: 3 });   // stairs down
  xRoom(pk, -1, 7, 4, 31, { ...r, h: 3 });                                    // the main corridor
  xRoom(pk, 2.5, 9, 14, 18, { ...r, h: 3 });                                  // mess hall
  xRoom(pk, -12, 10, .5, 20, { ...r, h: 2.8 });                               // dormitory
  xRoom(pk, 2.5, 21, 10, 28, { ...r, h: 2.8 });                               // the commander's office
  xRoom(pk, -10, 22, .5, 30, { ...r, h: 3.2, floor: 'concD' });               // generator room
  xRoom(pk, -2, 30, 6, 38, { ...r, h: 3.2, floor: 'concD' });                 // the armory
  xExit(pk, 1.5, 3.9, .5, 'Climb the stairs out');
  const g = pk.g, Y = pk.y, P2 = (lx, lz) => pw(pk, lx, lz);
  xELamp(pk, 1.5, 2.6, 4, 0xff3a2a, .5, 9); xELamp(pk, 1.5, 2.6, 14, 0xff3a2a, .45, 10); xELamp(pk, 1.5, 2.6, 26, 0xff3a2a, .5, 10);
  for (const [x, z] of [[1.5, 10], [1.5, 20], [8, 13], [-6, 15], [6, 24.5], [-5, 26], [2, 34]]) xPLamp(pk, x, 2.75, z, 0xe8f0ff, 1.4, 12);
  // the mess: long tables and benches
  for (const z of [11.5, 15]) { const [x, zz] = P2(9, z); xbox(g, 7, .08, 1.1, 'metal', x, Y + .76, zz); xbox(g, 6.6, .7, .9, 'dark', x, Y + .35, zz); for (const s of [-1, 1]) xbox(g, 7, .06, .35, 'metal', x, Y + .45, zz + s * .9); xSolid(pk, 5.5, z - 1.2, 12.5, z + 1.2); }
  { const [x, z] = P2(13.3, 14); xbox(g, .9, .95, 4.6, 'metal', x, Y + .48, z); xbox(g, .95, .05, 4.7, 'white', x, Y + .97, z); for (let k = 0; k < 3; k++) xcyl(g, .18, .16, .3, 'metal', x, Y + 1.15, z - 1.4 + k * 1.4, 10); xSolid(pk, 12.6, 11.5, 14, 16.5); }
  xNote(g, 'hs_letter', ...P2(8, 15).flatMap((v, i) => i ? [Y + .82, v] : [v]), 0, pk);
  // the dorm: rows of bunks and lockers
  for (let i = 0; i < 4; i++) { const z = 11.5 + i * 2.2; const [x, zz] = P2(-10, z); for (const yy of [.45, 1.5]) xbox(g, 2, .18, .9, 'olive', x, Y + yy, zz); for (const s of [-1, 1]) xbox(g, .06, 1.9, .06, 'metal', x + s * 1, Y + .95, zz); xSolid(pk, -11.2, z - .5, -8.8, z + .5); }
  for (let i = 0; i < 5; i++) { const [x, z] = P2(-4.6, 10.6 + i * .75); if (!xModel(g, 'props/locker', 1.9, x, Y, z, 0)) xbox(g, .6, 1.9, .6, 'olive', x, Y + .95, z); } xSolid(pk, -5.1, 10.2, -4.1, 14.2);
  xPCache(pk, -1.5, 18.5, XHPI, 'none', 'mil', { id: 'x_hesper_dorm', name: 'Footlocker', rolls: 1, refill: 5 });
  xNote(g, 'hs_duty', ...P2(-9, 19.5).flatMap((v, i) => i ? [Y + 1.62, v] : [v]), 0, pk);
  // the commander's office: the desk, the terminal, the keycard in the drawer
  { const [x, z] = P2(7, 25.5); xbox(g, 2.4, .08, 1.1, 'wood', x, Y + .78, z); xbox(g, 2.2, .72, 1, 'woodD', x, Y + .38, z); xSolid(pk, 5.6, 24.8, 8.4, 26.2);
    xNote(g, 'hs_cmd', ...P2(4, 27.2).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 3.4, 26.6, 4.6, 27.8);
    xPCache(pk, 9, 22.2, Math.PI, 'none', 'mil', { id: 'x_hesper_desk', name: 'Colonel Avens’ desk drawer', rolls: 1, keys: ['bw_card', 'hesper_key'], refill: 0, y: 0 });
    for (let i = 0; i < 3; i++) xModel(g, 'props/server-rack', 2, ...P2(3.2 + i * .9, 21.5).flatMap((v, k) => k ? [Y, v] : [v]), 0); }
  // the generator room
  xGenerator(pk, -6, 27.5, 0);
  for (let i = 0; i < 4; i++) { const [x, z] = P2(-9 + i * .8, 23); xModel(g, 'props/gas-bottle', 1.3, x, Y, z, 0) || xcyl(g, .2, .2, 1.3, 'olive', x, Y + .65, z, 8); }
  xModel(g, 'props/pipes', 2.6, ...P2(-1.5, 28.5).flatMap((v, k) => k ? [Y, v] : [v]), XHPI);
  // the armory, behind the blast door at the end of the corridor (power, and the armory key)
  xDoor(pk, 'hesper_armory', 1.5, 30.5, 'x', 4.6, { need: 'power', label: 'the armory blast door' });
  for (let k = 0; k < 3; k++) xbox(g, .5, .06, 6, 'metal', pk.ox + 5.5, Y + .6 + k * .7, pk.oz + 34); for (let k = 0; k < 6; k++) xbox(g, .1, 1.2, .3, 'dark', pk.ox + 5.5, Y + 1.4, pk.oz + 31.6 + k * .9);
  xSolid(pk, 5.1, 31, 6, 37);
  xPCache(pk, 0, 36.8, 0, 'hk', 'mil', { id: 'x_hesper_armory', name: 'Weapons cage', big: 1, rolls: 4, keys: ['assault', 'tac_armor', 'frag', 'ammo_556'], refill: 0 });
  xPCache(pk, -1.2, 33, XHPI, 'none', 'mil', { id: 'x_hesper_ammo', name: 'Ammunition crates', rolls: 2, refill: 6 });
}

/* ---------- Brightwater Annex and the lab under it ---------- */
function buildBright() {
  const S = XSITES.bright, yaw = Math.atan2(-S.x, -S.z), F = xFrame(S.x, S.z, yaw);
  // a chain fence on posts (most of it still up), warning signs, the gatehouse
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; if (Math.abs(angWrap(a - XHPI)) < .12) continue; const [x, z] = F(Math.cos(a) * 30, Math.sin(a) * 30), y = heightAt(x, z);
    xbox(world, .1, 2.6, .1, 'metal', x, y + 1.3, z); if (xrnd() < .82) { const [nx, nz] = F(Math.cos(a + .157) * 30, Math.sin(a + .157) * 30); const L = Math.hypot(nx - x, nz - z), pnl = mesh(new THREE.PlaneGeometry(L, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a8e90, transparent: true, opacity: .35, side: THREE.DoubleSide }), (x + nx) / 2, y + 1.3, (z + nz) / 2, world); pnl.rotation.y = Math.atan2(nx - x, nz - z) + XHPI; colRect((x + nx) / 2, (z + nz) / 2, L, .2, Math.atan2(nx - x, nz - z) + XHPI, .2); } }
  { const [x, z] = F(4, 31); xbox(world, 2.4, 1.4, .1, 'yellow', x, heightAt(x, z) + 1.6, z, yaw); xNote(world, 'bw_sign', x, heightAt(x, z) + .1, z + .3, yaw); }
  // the main building: a concrete box, one end caved in
  const [hx, hz] = F(0, -4);
  { const g = new THREE.Group(), y0 = xLowest(hx, hz, 22, 14, yaw); xbox(g, 22, .4, 14, 'concD', 0, .2, 0);
    for (const [x, z, w, d, h] of [[0, -6.9, 22, .3, 5], [-10.9, 0, .3, 14, 5], [10.9, -3, .3, 8, 3], [-6.5, 6.9, 9, .3, 5], [6.5, 6.9, 9, .3, 2.6]]) xbox(g, w, h, d, 'concW', x, h / 2 + .3, z);
    xbox(g, 14, .3, 14.4, 'concD', -4, 5.3, 0); for (let i = 0; i < 4; i++) xbox(g, 2, 1.1, .32, 'glass', -8 + i * 4, 3, -6.9);
    xRubble(g, 7, .3, 2, 26, 4, 'concW'); const sl = xbox(g, 8, .3, 7, 'concD', 6.5, 2.2, 1.5); sl.rotation.z = .5;
    g.position.set(hx, y0, hz); g.rotation.y = yaw; world.add(g); xColRect(hx, hz, 22, 14, yaw, .45, 4); addFloor(hx, hz, yaw, 11, 7, y0 + .4); SHELTERS.push({ x: hx, z: hz, kind: 'house', r: 5 });
    // a cracked tank outside the collapsed end: green glow, and the counter starts clicking
    const [tx, tz] = xFrame(hx, hz, yaw)(13, 2); const t = xcyl(world, 1.6, 1.6, 4, 'metal', tx, y0 + 2, tz, 14); t.rotation.z = .25;
    for (let i = 0; i < 10; i++) mesh(new THREE.SphereGeometry(xr(.08, .2), 6, 4), xm('glowG'), tx + xr(-3, 3), heightAt(tx, tz) + .05, tz + xr(-3, 3), world);
    xLamp(world, tx, y0 + 1, tz, 0x6aff8a, 1.2, 14, false); XRAD.push({ x: tx, z: tz, r: 9, k: 6 }); addCol(tx, tz, 1.8);
    const [cx, cz] = xFrame(hx, hz, yaw)(-8, 4); const C = cache(world, cx, cz, yaw, 'pry', 'ruin', { id: 'x_bright_office', name: 'Filing cabinet', rolls: 2, keys: ['documents'], refill: 5 }); C.g.position.y = y0 + .4;
    // the hatch in the floor
    const [qx, qz] = xFrame(hx, hz, yaw)(-4, 0); xbox(world, 1.6, .1, 1.6, 'panel', qx, y0 + .45, qz, yaw); xbox(world, 1.7, .04, .2, 'yellow', qx, y0 + .5, qz, yaw);
    const pk = mkPocket('lab', 'BRIGHTWATER LAB', { surf: 'metal', fog: 45, hemi: .12, hemiC: 0x8aa09a, power: true }); pk.sub = 'The fog was meant to be a cure';
    const [ox, oz] = xFrame(hx, hz, yaw)(-4, 2.2);
    xEntrance(pk, qx, qz, 'Open the floor hatch · climb down', { x: pk.ox + 2.5, y: pk.y, z: pk.oz + 1.2, yaw: Math.PI }, { x: ox, y: y0 + .4, z: oz, yaw });
    buildLab(pk);
  }
  for (let i = 0; i < 2; i++) { const [x, z] = F(xr(-18, 18), xr(10, 24)); supplyCrate(x, z); CRATES[CRATES.length - 1].table = 'ruin'; }
  { const [x, z] = F(-16, 18); car(x, z, yaw + 2); }
}
function buildLab(pk) {
  const r = { wall: 'concW', floor: 'tile', ceil: 'concW' };
  xRoom(pk, 0, 0, 5, 5, { ...r, h: 3 });                       // the ladder well
  xRoom(pk, 1, 4, 4, 30, { ...r, h: 3 });                      // the decon corridor (a hall where it meets the labs)
  xRoom(pk, 2.5, 12, 16, 22, { ...r, h: 3.4 });                // lab A
  xRoom(pk, -12, 12, 2.5, 22, { ...r, h: 3.4 });               // lab B (the leak)
  xRoom(pk, -1, 29, 6, 38, { ...r, h: 3 });                    // the archive
  xExit(pk, 2.5, 0, .6, 'Climb the ladder out');
  const g = pk.g, Y = pk.y, P2 = (lx, lz) => pw(pk, lx, lz);
  { const [x, z] = P2(2.5, .3); for (let k = 0; k < 9; k++) xbox(g, .9, .05, .05, 'metal', x, Y + .3 + k * .35, z); }
  for (const [x, z] of [[2.5, 2.5], [2.5, 8], [9, 15], [9, 19.5], [-5, 17], [2.5, 25], [2.5, 34]]) xPLamp(pk, x, 2.9, z, 0xd8fff0, 1.1, 12);
  xELamp(pk, -9, 2.6, 13, 0x6aff8a, .9, 12);
  // decon arches with nozzles
  for (const z of [6, 8, 10]) { const [x, zz] = P2(2.5, z); for (const s of [-1, 1]) xbox(g, .15, 2.8, .2, 'metal', x + s * 1.35, Y + 1.4, zz); xbox(g, 2.9, .15, .2, 'metal', x, Y + 2.8, zz); }
  // lab A: specimen tanks with something cloudy in them, benches, terminals, the suit locker
  for (let i = 0; i < 4; i++) { const [x, z] = P2(7 + i * 2.4, 21); xcyl(g, .55, .55, .3, 'metal', x, Y + .15, z, 14); const tk = mesh(new THREE.CylinderGeometry(.5, .5, 2.1, 14, 1, true), xm('glass'), x, Y + 1.35, z, g);
    const fl = mesh(new THREE.CylinderGeometry(.46, .46, 1.6 - i * .2, 12), new THREE.MeshBasicMaterial({ color: 0x8a3a2a, transparent: true, opacity: .5, toneMapped: false }), x, Y + .3 + (1.6 - i * .2) / 2, z, g); xcyl(g, .55, .55, .3, 'metal', x, Y + 2.55, z, 14); }
  xSolid(pk, 6, 20.2, 15.6, 21.9);
  for (const z of [14.5, 17.5]) { const [x, zz] = P2(10, z); xbox(g, 6, .08, 1, 'white', x, Y + .9, zz); xbox(g, 5.8, .85, .9, 'metal', x, Y + .44, zz); xSolid(pk, 7, z - .6, 13, z + .6); for (let k = 0; k < 4; k++) xcyl(g, .06, .06, .25, 'glass', x - 2 + k * 1.2, Y + 1.06, zz, 8); }
  xNote(g, 'bw_varga1', ...P2(15, 13.2).flatMap((v, i) => i ? [Y, v] : [v]), -XHPI, pk); xSolid(pk, 14.4, 12.6, 15.6, 13.8);
  xNote(g, 'bw_liaison', ...P2(9, 17.5).flatMap((v, i) => i ? [Y + .95, v] : [v]), 0, pk);
  xPCache(pk, 15.2, 16, -XHPI, 'none', 'mil', { id: 'x_lab_suits', name: 'Suit locker', rolls: 0, keys: ['hazmat', 'purify_tab'], refill: 0 });
  // lab B: the cracked tank and the hot salts. Radiation in here.
  { const [x, z] = P2(-8, 17); const t = xcyl(g, 1.1, 1.1, 2.8, 'metal', x, Y + 1.4, z, 14); t.rotation.z = .15; for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(xr(.05, .16), 6, 4), xm('glowG'), x + xr(-3, 3), Y + .04, z + xr(-3, 3), g); xSolid(pk, -9.2, 15.8, -6.8, 18.2);
    xLamp(g, x, Y + 1, z, 0x6aff8a, 1.4, 12, false); }
  pk.hz.push({ x0: pk.ox - 12, z0: pk.oz + 12, x1: pk.ox - 2, z1: pk.oz + 22, k: 7 });
  xNote(g, 'bw_varga2', ...P2(0, 13).flatMap((v, i) => i ? [Y + .95, v] : [v]), 0, pk); xbox(g, 1.2, .9, .6, 'metal', pk.ox, Y + .45, pk.oz + 13); xSolid(pk, -.6, 12.6, .6, 13.4);
  xPCache(pk, -11, 20.5, XHPI, 'none', 'op', { id: 'x_lab_hot', name: 'Shielded case', rolls: 2, keys: ['rust_med', 'lab_sample'], refill: 0 });
  for (let i = 0; i < 4; i++) { const [x, z] = P2(-11.4, 13 + i * 1.6); xModel(g, 'props/server-rack', 2, x, Y, z, XHPI) || xbox(g, .6, 2, .6, 'metal', x, Y + 1, z); } xSolid(pk, -12, 12.4, -10.8, 19);
  // the archive door: the Brightwater keycard
  xDoor(pk, 'lab_archive', 2.5, 29.5, 'x', 3, { need: 'bw_card', label: 'the archive door' });
  for (let i = 0; i < 5; i++) { const [x, z] = P2(-.4 + i * 1.5, 37.4); xModel(g, 'props/server-tower', 2, x, Y, z, Math.PI) || xbox(g, .8, 2, .6, 'metal', x, Y + 1, z); } xSolid(pk, -1, 36.8, 6, 38);
  xNote(g, 'bw_archive', ...P2(2.5, 35.5).flatMap((v, i) => i ? [Y, v] : [v]), Math.PI, pk); xSolid(pk, 1.9, 34.9, 3.1, 36.1);
  xPCache(pk, 5.2, 31.5, -XHPI, 'none', 'op', { id: 'x_lab_archive', name: 'Archive vault', big: 1, rolls: 3, keys: ['greyhold_files', 'rust_detector', 'med_scanner'], refill: 0 });
  XMARKS.site9 = { x: XSITES.blackdoor.x, z: XSITES.blackdoor.z, n: 'Site Nine' }; LOGS.bw_archive.mark = 'site9'; LOGS.kv_log.mark = 'site9';
}

/* ---------- the Long Fall: Hydroponics Ring C, down in the hills for decades ---------- */
function buildLongFall() {
  const S = XSITES.longfall, yaw = xr(0, 6.28), F = xFrame(S.x, S.z, yaw), y = heightAt(S.x, S.z);
  const t = texPanel.clone(); t.needsUpdate = true; t.repeat.set(3, 3);
  const skin = new THREE.MeshStandardMaterial({ map: t, color: 0x8a8a82, metalness: .4, roughness: .7, side: THREE.DoubleSide });
  // the ring section, half buried, moss-green along the bottom, a solar wing snapped off and lying beside it
  { const g = new THREE.Group(); const R = 7, L = 30; const h = mesh(new THREE.CylinderGeometry(R, R, L, 26, 1, true, .4, 5.2), skin, 0, 0, 0, g); h.rotation.z = XHPI;
    for (let x = -L / 2 + 3; x < L / 2; x += 5) { const rib = mesh(new THREE.TorusGeometry(R + .3, .3, 5, 18, 5.2), xSm(0x9a9890, { metalness: .4 }), x, 0, 0, g); rib.rotation.y = XHPI; rib.rotation.z = .4; }
    const moss = mesh(new THREE.CylinderGeometry(R + .05, R + .05, L, 26, 1, true, 2.2, 1.6), new THREE.MeshLambertMaterial({ color: 0x3a5a2a, transparent: true, opacity: .7, side: THREE.DoubleSide }), 0, 0, 0, g); moss.rotation.z = XHPI;
    g.position.set(S.x, y + 2.2, S.z); g.rotation.set(0, yaw, .08); world.add(g);
    for (let k = -12; k <= 12; k += 4) { const [px, pz] = F(k, -6); addCol(px, pz, 1.4); const [qx, qz] = F(k, 6); addCol(qx, qz, 1.4); } }
  { const [x, z] = F(4, 18), g = new THREE.Group(); for (let i = 0; i < 6; i++) xbox(g, 3.6, .08, 2.2, new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: .6, roughness: .3 }), i * 3.8, 0, 0); xbox(g, 23, .2, .3, 'metal', 9.5, .1, 0); g.position.set(x, heightAt(x, z) + .3, z); g.rotation.set(.1, yaw + .6, .08); world.add(g); }
  // seed racks spilled out of the open end, gone wild: a little green patch of crops nobody planted
  for (let i = 0; i < 40; i++) { const [x, z] = F(-20 + xr(-6, 6), xr(-6, 6)); const p = mesh(new THREE.ConeGeometry(xr(.15, .35), xr(.6, 1.3), 5), new THREE.MeshLambertMaterial({ color: xp([0x4a7a2a, 0x6a8a2a, 0x8a9a3a]) }), x, heightAt(x, z) + .4, z, world); }
  // the crew's graves: nine walked out, the rest are here
  for (let i = 0; i < 6; i++) { const [x, z] = F(-8 + i * 2.6, 14); xbox(world, .1, 1.2, .1, 'metal', x, heightAt(x, z) + .6, z); xbox(world, .7, .1, .1, 'metal', x, heightAt(x, z) + 1, z, yaw); }
  { const [x, z] = F(-15.5, 0); xNote(world, 'lf_rec', x, heightAt(x, z) + .1, z, yaw); }
  { const [x, z] = F(-13, 3.5); xNote(world, 'lf_manifest', x, heightAt(x, z), z, yaw + XHPI); }
  { const [x, z] = F(-12, -3); const C = cache(world, x, z, yaw, 'chip', 'arc', { id: 'x_longfall_med', name: 'Ring C med stores', big: 1, rolls: 3, keys: ['medkit', 'antibiotic'], refill: 0 }); }
  { const [x, z] = F(-17, -4); const C = cache(world, x, z, yaw, 'none', 'arc', { id: 'x_longfall_lock', name: 'Crew locker', rolls: 2, keys: ['id_chip'], refill: 0 }); }
  xSkeleton(world, ...(() => { const [x, z] = F(-16, 2); return [x, heightAt(x, z), z]; })(), yaw + .5);
  for (let i = 0; i < 16; i++) { const [x, z] = F(xr(-40, 40), xr(-30, 30)); if (Math.abs(x - S.x) < 16 && Math.abs(z - S.z) < 8) continue; const m = mesh(new THREE.BoxGeometry(xr(1, 3.5), xr(.15, .35), xr(1, 2.5)), skin, x, heightAt(x, z) + .2, z, world); m.rotation.set(xr(-1, 1), xr(0, 6), xr(-.5, .5)); }
  for (let i = 0; i < 8; i++) { const [x, z] = F(xr(-35, 35), xr(-25, 25)); spawnScrap(x, z, 'wild'); }
}

/* ---------- Route 9 ---------- */
function buildRoute9() {
  // the road: slabs of old asphalt laid on the ground, lane lines, barriers, a jam of dead cars
  const R = XROAD, g = new THREE.Group(); world.add(g);
  for (let i = 0; i < R.length - 1; i++) { const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az) + .4, a = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ha = heightAt(ax, az), hb = heightAt(bx, bz), hm = Math.min(ha, hb, heightAt(mx, mz));
    if (waterAt(mx, mz) > hm) continue;
    const s = xbox(g, 12, .7, L, 'asphalt', mx, (ha + hb) / 2 + .02, mz, a, 4); s.rotation.x = Math.atan2(ha - hb, L) ; s.rotation.order = 'YXZ'; s.rotation.set(Math.atan2(ha - hb, L), a, 0);
    if (i % 2 === 0) { const ln = xbox(g, .2, .02, 3, 'yellow', mx, (ha + hb) / 2 + .38, mz, a); ln.rotation.order = 'YXZ'; ln.rotation.set(Math.atan2(ha - hb, L), a, 0); }
    if (i % 3 === 0 && xrnd() < .7) for (const sd of [-1, 1]) { const [px, pz] = xFrame(mx, mz, a)(sd * 6.3, 0); const b = xbox(g, .4, .8, L * .9, 'conc', px, heightAt(px, pz) + .35, pz, a); addCol(px, pz, .5); }
  }
  // the jam: lines of cars, a tanker jack-knifed across both lanes, a bus on its side
  const n = R.length;
  for (let i = 8; i < n - 8; i += 2) { if (xrnd() < .35) continue; const [ax, az] = R[i], [bx, bz] = R[i + 1], a = Math.atan2(bx - ax, bz - az); for (const lane of [-3, 3]) { if (xrnd() < .4) continue; const [x, z] = xFrame(ax, az, a)(lane + xr(-.4, .4), xr(-1, 1)); car(x, z, a + (lane < 0 ? 0 : Math.PI) + xr(-.25, .25)); } }
  { const [ax, az] = R[Math.floor(n / 2)], [bx, bz] = R[Math.floor(n / 2) + 1], a = Math.atan2(bx - ax, bz - az), F = xFrame(ax, az, a);
    const tg = new THREE.Group(); xbox(tg, 2.6, 3, 12, 'white', 0, 2, 0); xbox(tg, 2.4, .9, 11, 'dark', 0, .45, 0); for (const k of [-4.5, -3.3, 4.5]) for (const s of [-1, 1]) { const w = xcyl(tg, .55, .55, .4, 'dark', s * 1.2, .55, k, 12); w.rotation.z = XHPI; }
    const [tx, tz] = F(0, 0); xPlace(tg, tx, tz, a + 1.2); const FT = xFrame(tx, tz, a + 1.2); for (const k of [-5, -2.5, 0, 2.5, 5]) { const [px, pz] = FT(0, k); addCol(px, pz, 1.5); }
    const cab = new THREE.Group(); xbox(cab, 2.6, 2.8, 3, 'rust', 0, 1.8, 0); xbox(cab, 2.4, .9, 1.2, 'glass', 0, 2.6, 1.5); const [cx, cz] = FT(0, 8); xPlace(cab, cx, cz, a + .3); addCol(cx, cz, 1.7);
    const [dx, dz] = FT(1.6, 2); const C = cache(world, dx, dz, a + 1.2, 'cutter', 'city', { id: 'x_r9_trailer', name: 'Trailer doors (chained)', big: 1, rolls: 2, keys: ['canned', 'water_filtered'], refill: 6 });
    const [nx, nz] = F(-3, -10); xNote(world, 'r9_note', nx, heightAt(nx, nz) + .9, nz, a);
    const [bsx, bsz] = F(4, 18); const bus = new THREE.Group(); if (!xModel(bus, 'e/bus', 3, 0, 0, 0, 0)) xbox(bus, 2.6, 3, 11, 'yellow', 0, 1.5, 0); bus.position.set(bsx, heightAt(bsx, bsz) + 1.3, bsz); bus.rotation.set(0, a + .2, XHPI * .98); world.add(bus); { const FB = xFrame(bsx, bsz, a + .2); for (const k of [-4, -1.5, 1, 3.5]) { const [px, pz] = FB(0, k); addCol(px, pz, 1.6); } }
    const [px, pz] = F(6.5, 18); xNote(world, 'r9_photo', px, heightAt(px, pz) + .05, pz, a);
    // the overpass: two pillars still standing, the deck broken in the middle and dropped onto the road
    const [ox, oz] = F(0, 60); for (const s of [-1, 1]) { const [qx, qz] = xFrame(ox, oz, a)(s * 9, 0); xbox(world, 1.6, 8, 1.6, 'conc', qx, heightAt(qx, qz) + 4, qz, a); addCol(qx, qz, 1.2); const dk = xbox(world, 8, .8, 12, 'concD', ...(() => { const [ux, uz] = xFrame(ox, oz, a)(s * 6, 0); return [ux, heightAt(ux, uz) + 4, uz]; })(), a + XHPI); dk.rotation.order = 'YXZ'; dk.rotation.set(0, a + XHPI, s * .55); }
    xRubble(world, ox, heightAt(ox, oz), oz, 14, 4, 'concD'); }
  for (let i = 0; i < 10; i++) { const [x, z] = R[Math.floor(xr(4, n - 4))]; spawnScrap(x + xr(-5, 5), z + xr(-5, 5), 'wild'); }
  for (let i = 0; i < 4; i++) { const [x, z] = R[Math.floor(xr(6, n - 6))]; supplyCrate(x + xr(-4, 4), z + xr(-4, 4)); CRATES[CRATES.length - 1].table = 'ruin'; }
}

/* ---------- Ember Rest: a clan camp, burnt out ---------- */
function buildEmber() {
  const S = XSITES.ember, F = xFrame(S.x, S.z, 0), y = heightAt(S.x, S.z);
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.28; if (xrnd() < .35) continue; const [x, z] = F(Math.cos(a) * 24, Math.sin(a) * 24), h = xr(1.5, 4.5); const p = mesh(new THREE.CylinderGeometry(.08, .28, h, 6), xm('char'), x, heightAt(x, z) + h / 2 - .2, z, world); p.rotation.set(xr(-.4, .4), 0, xr(-.4, .4)); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + xr(-.2, .2), [x, z] = F(Math.cos(a) * xr(8, 16), Math.sin(a) * xr(8, 16)); xTent(world, x, z, -a, 0, true); }
  { const g = new THREE.Group(); mesh(new THREE.CircleGeometry(4, 16), xm('char'), 0, .05, 0, g).rotation.x = -XHPI; for (let i = 0; i < 12; i++) { const l = xbox(g, .25, .25, xr(1.5, 3), 'char', xr(-1.5, 1.5), .2, xr(-1.5, 1.5), xr(0, 3)); } xPlace(g, S.x, S.z); }
  for (let i = 0; i < 5; i++) { const [x, z] = F(xr(-14, 14), xr(-14, 14)); xSkeleton(world, x, heightAt(x, z), z, xr(0, 6)); }
  for (let i = 0; i < 6; i++) { const [x, z] = F(xr(-16, 16), xr(-16, 16)); const sp = xcyl(world, .03, .03, 2.2, 'woodD', x, heightAt(x, z) + .1, z, 5); sp.rotation.set(XHPI, xr(0, 6), 0); }
  { const [x, z] = F(5, -6), p = xbox(world, .35, .35, 4, 'char', x, heightAt(x, z) + .2, z, .4); xNote(world, 'em_carve', x + .5, heightAt(x, z) + .1, z, .4); }
  SMOKES.push({ x: S.x, z: S.z, y: y + .5, k: .3 });
  const C = cache(world, ...F(-10, 9), .3, 'none', 'clan', { id: 'x_ember', name: 'A cache under a hide', rolls: 3, keys: ['insignia'], refill: 0 });
}

/* ---------- the Black Door ---------- */
function buildBlackDoor() {
  const S = XSITES.blackdoor, f = S.face, F = xFrame(S.x, S.z, f), y = heightAt(S.x, S.z);
  const g = new THREE.Group();
  xbox(g, 10, 8, 3, 'concD', 0, 3, -1.6); xbox(g, 6, 5.6, .4, new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x3a3a40, metalness: .55, roughness: .45 }), 0, 2.8, .1);
  for (let i = 0; i < 5; i++) xbox(g, 5.6, .08, .1, 'metal', 0, .8 + i * 1.1, .34);
  for (const s of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(3, 1), xm('rock'), s * 5.4, 2, -1.4, g); r.scale.set(.8, 1.2, 1); }
  const top = mesh(new THREE.DodecahedronGeometry(3.6, 1), xm('rock'), 0, 7, -2, g); top.scale.set(1.8, .7, 1.2);
  xbox(g, .5, .7, .14, 'dark', 3.6, 1.5, .25); xLamp(g, 3.6, 2.2, 1.2, 0xffa040, .9, 9, false); const kp = mesh(new THREE.PlaneGeometry(.36, .2), new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false }), 3.6, 1.7, .33, g);
  XANIM.push(t => { kp.material.color.setHSL(.1, 1, .35 + (Math.sin(t * 6.28 / 11) > .95 ? .25 : 0)); });
  xbox(g, 1.6, .4, .05, 'yellow', 0, 6, .35); xbox(g, 1.4, .2, .02, 'dark', 0, 6, .38);
  g.position.set(S.x, y - .5, S.z); g.rotation.y = f; world.add(g);
  for (let k = -4; k <= 4; k += 1.6) { const [x, z] = F(k, -.2); addCol(x, z, .9); }
  const [kx, kz] = F(3.6, 1.2); xNote(world, 'bd_keypad', kx, heightAt(kx, kz) + .05, kz, f);
  xUse({ x: kx, z: kz, r: 2, pocket: null, label: () => 'Try the keypad', act: () => { sfx('no'); toast('AWAITING SIGNAL. The keys don’t even click.', 3); (G.flags.blackdoor = (G.flags.blackdoor || 0) + 1); } });
}

/* ---------- the river crossings ---------- */
function buildCrossings() {
  const R = XCROSS.rope;
  if (R) {   // a plank-and-rope bridge over the gorge
    const y0 = R.hl + .4, y1 = R.hr + .4, len = R.xr - R.xl, mid = (R.xl + R.xr) / 2, sl = (y1 - y0) / len, g = new THREE.Group();
    for (let k = 0; k < len / .5; k++) { const x = R.xl + k * .5 + .25, sag = Math.sin(k * .5 / len * Math.PI) * -.9; const p = xbox(world, .4, .08, 1.7, 'wood', x, y0 + (x - R.xl) * sl + sag, R.z); p.rotation.z = xr(-.04, .04); }
    for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 20; k++) { const x = R.xl + k / 20 * len; pts.push(new THREE.Vector3(x, y0 + (x - R.xl) * sl + Math.sin(k / 20 * Math.PI) * -.6 + 1, R.z + s * .9)); } world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a7a5a }))); }
    for (const [x, yy] of [[R.xl, y0], [R.xr, y1]]) for (const s of [-1, 1]) { xbox(world, .2, 1.8, .2, 'woodD', x, yy + .5, R.z + s * .95); addCol(x, R.z + s * .95, .2); }
    // the deck: three gently sagging pieces so you walk the dip
    for (let k = 0; k < 3; k++) { const xa = R.xl + k * len / 3, xb = xa + len / 3, ya = y0 + (xa - R.xl) * sl + Math.sin(k / 3 * Math.PI) * -.9, yb = y0 + (xb - R.xl) * sl + Math.sin((k + 1) / 3 * Math.PI) * -.9;
      FLOORS.push({ cx: (xa + xb) / 2, cz: R.z, c: 1, s: 0, hw: (xb - xa) / 2 + .05, hd: .85, y: (ya + yb) / 2 + .04, slope: (yb - ya) / (xb - xa) }); }
    REGIONS.push({ id: 'x_rope', name: 'THE ROPE BRIDGE', sub: 'Someone strung it over the gorge · it holds, mostly', x: mid, z: R.z, r: 26 });
  }
  const D = XCROSS.ford;
  if (D) {   // stepping stones across the shallows
    const wl = D.wl, n = Math.round((D.xr - D.xl) / 1.45);
    for (let k = 0; k <= n; k++) { const x = D.xl + (D.xr - D.xl) * k / n, gy = heightAt(x, D.z); if (gy > wl + .2) continue; const top = wl + .28;
      const st = mesh(new THREE.CylinderGeometry(.75, .9, top - gy + .4, 8), M(0x8a8680), x, (top + gy) / 2 - .2, D.z + xr(-.15, .15), world); st.rotation.y = xr(0, 3); FLOORS.push({ cx: x, cz: D.z, c: 1, s: 0, hw: .72, hd: .72, y: top }); }
    REGIONS.push({ id: 'x_ford', name: 'THE STEPPING STONES', sub: 'A dry way over the Coldwater', x: (D.xl + D.xr) / 2, z: D.z, r: 24 });
  }
}

/* ---------- little camps: somebody stopped here once ---------- */
function buildCamps() {
  XCAMPS.forEach((C, i) => {
    const y = heightAt(C.x, C.z), F = xFrame(C.x, C.z, xr(0, 6.28));
    const [fx, fz] = F(0, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; mesh(new THREE.DodecahedronGeometry(.17, 0), M(0x5a5650), fx + Math.cos(a) * .55, y + .06, fz + Math.sin(a) * .55, world); } mesh(new THREE.CircleGeometry(.4, 10), xm('char'), fx, y + .03, fz, world).rotation.x = -XHPI;
    { const [x, z] = F(2.4, 1); xTent(world, x, z, xr(0, 6), xp([0x6a5a3a, 0x4a5a3a, 0x5a4a5a]), i === 4); }
    { const [x, z] = F(-1.6, 1.8); const l = xbox(world, .4, .4, 2.4, 'woodD', x, heightAt(x, z) + .2, z, xr(0, 3)); }
    if (i === 1 || i === 4 || i === 5) { const [x, z] = F(-2, -1.5); xSkeleton(world, x, heightAt(x, z), z, xr(0, 6)); }
    if (i === 5) { const [x, z] = F(1, -2); const m = mesh(new THREE.BoxGeometry(.3, .35, .2), M(0x2a2a2a), x, heightAt(x, z) + .15, z, world); }
    const [nx, nz] = F(-1, 1.2); xNote(world, 'cp' + i, nx, heightAt(nx, nz) + (LOGS['cp' + i].kind === 'carve' ? 0 : .42), nz, xr(0, 6));
    const [cx, cz] = F(1.5, -1.8); cache(world, cx, cz, xr(0, 6), 'none', i === 5 ? 'mil' : i === 3 ? 'clan' : 'wild', { id: 'x_camp' + i, name: 'Left-behind pack', rolls: 1, refill: 7 });
    REGIONS.push({ id: 'x_camp' + i, name: ['TAV AND REN’S CAMP', 'THE LONE CAMP', 'A SCOUT’S CAMP', 'THE OFFERING STONE', 'THE FAMILY CAMP', 'A PATROL’S CAMP', 'THE DROVER’S CAMP', 'ROOK’S LOOKOUT'][i], sub: 'Somebody stopped here once', x: C.x, z: C.z, r: 14 });
  });
}

/* ---------- marked stashes: three short bars on a rock ---------- */
function buildStashes() {
  XSTASH.forEach((S, i) => {
    const y = heightAt(S.x, S.z), r = mesh(new THREE.DodecahedronGeometry(1.1, 0), M(0x8a8680), S.x, y + .5, S.z, world); r.scale.set(1.2, .8, 1); addCol(S.x, S.z, 1.1);
    const a = xr(0, 6.28); for (let k = 0; k < 3; k++) { const b = mesh(new THREE.PlaneGeometry(.12, .5), xm('paint'), S.x + Math.sin(a) * 1.15 + Math.cos(a) * (k - 1) * .2, y + .7, S.z + Math.cos(a) * 1.15 - Math.sin(a) * (k - 1) * .2, world); b.rotation.y = a; }
    const [cx, cz] = xFrame(S.x, S.z, a)(0, 2.2); const C = cache(world, cx, cz, a, 'none', i % 2 ? 'mil' : 'ruin', { id: 'x_stash' + i, name: 'A buried stash', rolls: 2, keys: ['fuse'], refill: 0 });
    C.g.scale.y = .5; mesh(new THREE.CircleGeometry(1.2, 10), xm('dirt'), cx, heightAt(cx, cz) + .03, cz, world).rotation.x = -XHPI;
    if (i === 0) xNote(world, 'mk_mark', S.x + Math.sin(a) * 1.6, y + .1, S.z + Math.cos(a) * 1.6, a);
    XMARKS['stash' + i] = { x: S.x, z: S.z, n: 'Marked stash' };
  });
}

/* ================= reading, the Journal, the map ================= */
let xReader = null, xReading = null;
function buildXHud() {
  const st = document.createElement('style');
  st.textContent = `#xread{position:fixed;inset:0;display:none;place-items:center;z-index:60;background:rgba(6,6,6,.55)}#xread.on{display:grid}
#xread .pg{width:min(560px,90vw);max-height:80vh;overflow:auto;background:#e9e1cc;color:#2a241c;padding:26px 30px 20px;border-radius:3px;box-shadow:0 12px 40px #000a;font:17px/1.5 Georgia,serif;white-space:pre-wrap}
#xread.term .pg{background:#0c1410;color:#7ff0a8;font:15px/1.5 ui-monospace,Menlo,monospace;border:1px solid #2a5a3a}#xread.rec .pg{background:#1a1816;color:#e8dcc4}#xread.carve .pg{background:#5a4a3a;color:#f0e0c4}
#xread h3{margin:0 0 2px;font:700 13px/1.2 "Barlow Condensed",sans-serif;letter-spacing:.12em;text-transform:uppercase;opacity:.65}#xread h2{margin:0 0 12px;font:700 22px/1.2 "Barlow Condensed",sans-serif}
#xread .by{margin-top:14px;font-style:italic;opacity:.7}#xread button{margin-top:14px;font:700 14px "Barlow Condensed",sans-serif;padding:7px 18px;background:#2a241c;color:#e9e1cc;border:0;border-radius:3px;cursor:pointer}
#xfade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:55}
#xtag{position:fixed;top:12px;left:50%;transform:translateX(-50%);font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#c8c0b0;background:#0008;padding:4px 12px;border-radius:3px;display:none;z-index:20;pointer-events:none}
#xrad{position:fixed;left:16px;bottom:118px;width:150px;display:none;z-index:20;font:700 12px "Barlow Condensed",sans-serif;color:#9aff8a;letter-spacing:.08em;pointer-events:none}#xrad i{display:block;height:5px;background:#6aff6a;margin-top:2px;border-radius:2px}
.jn{display:grid;gap:6px}.jn button.lg{display:block;width:100%;text-align:left;padding:7px 10px;background:#0003;border:1px solid #fff2;color:inherit;font:inherit;border-radius:3px;cursor:pointer}.jn button.lg small{opacity:.6;margin-left:6px}.jn .pl{margin:4px 0 0;opacity:.75}`;
  document.head.appendChild(st);
  xReader = document.createElement('div'); xReader.id = 'xread'; document.body.appendChild(xReader);
  xReader.addEventListener('click', e => { if (e.target === xReader || e.target.closest('button')) closeLog(); });
  UG.fadeEl = document.createElement('div'); UG.fadeEl.id = 'xfade'; document.body.appendChild(UG.fadeEl);
  UG.tagEl = document.createElement('div'); UG.tagEl.id = 'xtag'; document.body.appendChild(UG.tagEl);
  UG.radEl = document.createElement('div'); UG.radEl.id = 'xrad'; UG.radEl.innerHTML = 'RADIATION<i></i>'; document.body.appendChild(UG.radEl);
  addEventListener('keydown', e => { if (!xReading) return; if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat) closeLog(); } }, true);
}
function openLog(id) {
  const L = LOGS[id]; if (!L) return; xReading = id;
  const logs = G.flags.logs ||= {}, first = !logs[id];
  if (first) { logs[id] = G.day; const mk = [].concat(L.mark || []); for (const m of mk) (G.flags.xmark ||= {})[m] = 1; save(); }
  if (L.kind === 'rec') { noiseBurst(.5, 1800, .6, .06, 'bandpass'); }
  xReader.className = 'on ' + L.kind;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  xReader.innerHTML = `<div class="pg"><h3>${esc(LOG_KIND[L.kind][1])} · ${esc(L.at)}</h3><h2>${esc(L.t)}</h2>${esc(L.b)}${L.by ? `<div class="by">— ${esc(L.by)}</div>` : ''}${first && L.mark ? '<div class="by">Marked on your map.</div>' : ''}<div><button>Close${isTouch ? '' : ' (E)'}</button></div></div>`;
  if (document.pointerLockElement) document.exitPointerLock();
  if (first) { const n = Object.keys(logs).length; toast(`Journal · ${n} of ${Object.keys(LOGS).length} found`, 2.4); }
}
function closeLog() { xReading = null; xReader.className = ''; if (!isTouch && G.mode === 'play' && !invOpen) canvas.requestPointerLock?.(); }
function journalHTML() {
  const logs = G.flags.logs || {}, ids = Object.keys(LOGS), found = ids.filter(i => logs[i]);
  let h = `<p class="dim">Things you’ve found that tell what happened here · ${found.length} of ${ids.length}. Tap one to read it again.</p><div class="jn">`;
  const by = {}; for (const id of found) (by[LOGS[id].at] ||= []).push(id);
  for (const at of Object.keys(by)) { h += `<p class="pl"><b>${at}</b></p>`; for (const id of by[at]) h += `<button class="lg" data-log="${id}">${LOGS[id].t}<small>${LOG_KIND[LOGS[id].kind][1]}</small></button>`; }
  if (!found.length) h += '<p class="dim">Nothing yet. Notes, recordings, terminals and marks are left all over — look for a faint glint.</p>';
  const places = XSITE_DEFS.filter(D => D.id !== 'tunB' && (G.flags.seen || {})['x_' + D.id]).map(D => D.name), unseen = XSITE_DEFS.length - 1 - places.length;
  h += `<p class="pl"><b>Places found</b> · ${places.length ? places.join(' · ') : 'none yet'}${unseen ? ` · ${unseen} more out there` : ''}</p></div>`;
  return h;
}
function drawXMarks(g, S, k) {
  const m = G.flags.xmark || {}; g.font = `700 ${10 * k}px "Barlow Condensed",sans-serif`; g.textAlign = 'center';
  for (const id in m) { const M2 = XMARKS[id]; if (!M2) continue; const [x, y] = toMap(M2.x, M2.z, S); const done = id.startsWith('stash') && (G.flags.caches || {})['x_' + id];
    g.strokeStyle = done ? '#8a8478' : '#e8c070'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(x - 4 * k, y - 4 * k); g.lineTo(x + 4 * k, y + 4 * k); g.moveTo(x + 4 * k, y - 4 * k); g.lineTo(x - 4 * k, y + 4 * k); g.stroke();
    if (!(G.flags.seen || {})['x_' + (id === 'hesper_map' ? 'hesper' : id === 'site9' ? 'blackdoor' : id)]) { g.fillStyle = '#000a'; g.fillText(M2.n, x + k, y - 6 * k); g.fillStyle = '#e8c070'; g.fillText(M2.n, x, y - 7 * k); } }
}

/* ================= each frame ================= */
const nearXOf = (L, r) => { let b = null, bd = r; for (const o of L) { if ((o.pocket || null) !== UG.at) continue; if (o.y != null && Math.abs(o.y - P.y) > 2.6) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < (o.r || r) && d < bd) { bd = d; b = o; } } return b; };
const XINTERACT = [
  { id: 'xnote', at: () => nearXOf(XNOTES, 2.1), r: 2.1, label: () => { const n = nearXOf(XNOTES, 2.1), L = LOGS[n.id]; return `${LOG_KIND[L.kind][0]} · ${L.t}${(G.flags.logs || {})[n.id] ? ' (read)' : ''}`; }, act: () => openLog(nearXOf(XNOTES, 2.1).id) },
  { id: 'xuse', at: () => nearXOf(XUSE, 3), r: 3, label: () => nearXOf(XUSE, 3).label(), act: () => nearXOf(XUSE, 3).act() },
];
let xRadT = 0, xTick = 0;
function updXplore(dt) {
  for (const f of XANIM) f(G.t, dt);
  const pk = UG.at;
  if (pk) {
    if (P.fly) P.fly = false;
    const b = pk.bounds;
    // left without climbing out (you died down here and woke up somewhere else): put the pocket away, and bring your bag up to the entrance
    if (P.x < b[0] - 30 || P.x > b[2] + 30 || P.z < b[1] - 30 || P.z > b[3] + 30) {
      pk.g.visible = false; UG.at = null; UG.tagEl.style.display = 'none';
      const B = G.flags.bag; if (B && B.x > b[0] - 5 && B.x < b[2] + 5 && B.z > b[1] - 5 && B.z < b[3] + 5 && pk.out) { B.x = pk.out.x; B.z = pk.out.z; showBag(); save(); }
    }
    // a weak floor: stand on it a moment and it goes
    for (const W of pk.weak) { if (W.gone) continue; const on = P.x > W.x0 && P.x < W.x1 && P.z > W.z0 && P.z < W.z1 && Math.abs(P.y - pk.y) < .3;
      if (on) { W.t += dt; if (W.t > .25 && W.t - dt <= .25) { sfx('thud'); toast('The floor creaks…', 1.4); } if (W.t > .9) xCollapse(W); } else W.t = Math.max(0, W.t - dt * .5); }
  }
  // radiation: rooms in a pocket, or the spill outside Brightwater
  let rk = 0;
  if (pk) { for (const H of pk.hz) if (P.x > H.x0 && P.x < H.x1 && P.z > H.z0 && P.z < H.z1) rk = Math.max(rk, H.k); }
  else for (const R of XRAD) { const d = Math.hypot(P.x - R.x, P.z - R.z); if (d < R.r) rk = Math.max(rk, R.k * (1 - d / R.r * .6)); }
  const prot = clamp((typeof fogResist === 'function' ? fogResist() : 0), 0, 1);
  P.rad = P.rad || 0;
  if (rk > 0 && !P.dead) { P.rad = Math.min(100, P.rad + rk * (1 - prot * .9) * dt); xTick -= dt * (1 + rk * (1 - prot * .8)); if (xTick <= 0) { xTick = xr(.05, .35); noiseBurst(.012, 3200, 2, .05, 'highpass'); }
    if (!G.flags.radWarn) { G.flags.radWarn = 1; toast('Radiation — the counter’s clicking. A hazmat suit or a gas mask keeps it off you.', 4); } }
  else P.rad = Math.max(0, P.rad - dt * .8);
  if (P.rad > 40 && !P.dead && P.hp > 15) P.hp -= (P.rad - 40) * .012 * dt;
  xRadT -= dt; if (xRadT <= 0) { xRadT = .2; const on = P.rad > 1; UG.radEl.style.display = on ? 'block' : 'none'; if (on) { UG.radEl.firstElementChild.style.width = P.rad + '%'; UG.radEl.firstElementChild.style.background = P.rad > 40 ? '#e0d040' : '#6aff6a'; } }
  // the lamp you carry: only below ground
  if (UG.lamp) { const fl = pk && has('light'); UG.lamp.intensity = pk ? (fl ? 3.2 : 1.3) : 0; UG.lamp.distance = fl ? 28 : 12; }
  if (pk) { STEP_SURF = pk.surf; xAfterLight(); }   // again after the weather has had its say
}
// lighting below ground: no sun, a dim fill, a short dark haze (called from updTime after the sky is set)
function xAfterLight() {
  const pk = UG.at; if (!pk) return;
  sun.intensity = 0; hemi.intensity = pk.hemi + (pk.powered || pk.power ? .12 : 0); hemi.color.setHex(pk.hemiC);
  scene.fog.color.setHex(0x050607); scene.fog.far = pk.fog; scene.fog.near = packFogNear(1);
  stars.material.opacity = 0;
}
function xRestore() { if (UG.at) { UG.at.g.visible = false; UG.at = null; } UG.tagEl.style.display = 'none'; const mm = $('minic'); if (mm) mm.style.visibility = ''; P.rad = 0; for (const f of XRESTORE) f(); }
// Juno patching you up (or Rust medicine) clears radiation too
{ const ci = clearInjuries; clearInjuries = function () { ci(); P.rad = 0; }; }
