
/* ================= inventory, gear, crafting, food, injuries, gathering, loot ================= */

/* ---------- counts (scrap / meat / cooked meat / the two rifle calibres keep their old INV slots) ---------- */
const LINK = { scrap: 'scrap', meat: 'meat', ration: 'rations', ammo_556: 'res', ammo_762: 'resH' };
function invInit() {
  INV.items = INV.items && typeof INV.items === 'object' ? INV.items : {}; INV.tools = Array.isArray(INV.tools) ? INV.tools : [];
  INV.uid = INV.uid || 1; for (const t of INV.tools) if (!t.u) t.u = INV.uid++;
  INV.tools = INV.tools.filter(t => GEAR_DEFS[t.id]);
  for (const k in INV.items) if (!ITEMS[k]) delete INV.items[k];
}
function cnt(id) {
  if (id === 'veg') return VEG.reduce((a, v) => a + cnt(v), 0);
  const k = LINK[id]; if (k) return INV[k] || 0;
  if (GEAR_DEFS[id]) return INV.tools.filter(t => t.id === id).length;
  return INV.items[id] || 0;
}
function give(id, n = 1, q) {
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) newGear(id, q); return; }
  const k = LINK[id]; if (k) { INV[k] = Math.max(0, (INV[k] || 0) + n); return; }
  const was = INV.items[id] || 0, v = was + n; if (v > 0) INV.items[id] = v; else delete INV.items[id];
  if (n > 0 && !was && TIER_KEYS[id]) unlockTier(TIER_KEYS[id], id);
  if (n > 0 && !was && (id === 'map' || id === 'nav_console')) revealAll(id);
}
const busy = t => t.on || (INV.eq && INV.eq.includes(t.u));
function take(id, n) {
  if (id === 'veg') { for (const v of VEG) { const m = Math.min(n, cnt(v)); if (m) { take(v, m); n -= m; } if (!n) break; } return; }
  if (GEAR_DEFS[id]) { for (let i = 0; i < n; i++) { let j = INV.tools.findIndex(t => t.id === id && !busy(t)); if (j < 0) j = INV.tools.findIndex(t => t.id === id); if (j >= 0) unequip(INV.tools.splice(j, 1)[0]); } return; }
  give(id, -n);
}
function newGear(id, q, wear = 0) {
  const D = GEAR_DEFS[id]; if (q == null) { const r = rnd(); q = r < .22 ? 0 : r < .85 ? 1 : 2; }
  const max = Math.round(D.dur * QUAL[q].k), g = { id, q, max, d: Math.max(1, Math.round(max * (1 - wear))), u: INV.uid = (INV.uid || 1) + 1 };
  INV.tools.push(g);
  if (D.kind === 'wear' && !INV.tools.some(t => t.on && GEAR_DEFS[t.id].slot === D.slot)) g.on = true;
  if (typeof autoEquip === 'function') autoEquip(g);
  return g;
}
function unequip(g) { g.on = false; if (INV.eq) INV.eq = INV.eq.map(u => u === g.u ? null : u); }
const bestTool = kind => { let b = null; for (const t of INV.tools) { const D = GEAR_DEFS[t.id]; if (D.kind !== kind && !(D.kind === 'multi' && ['knife', 'pliers', 'driver'].includes(kind))) continue; const pw = D.pw || 1, bp = b ? GEAR_DEFS[b.id].pw || 1 : -1; if (!b || pw > bp || (pw === bp && t.d > b.d)) b = t; } return b; };
let lastTool = null;
function wearTool(t, n = 1) {
  if (!t) return; t.d -= n; if (GEAR_DEFS[t.id].kind !== 'wear') lastTool = t;
  if (t.d > 0 && t.d <= t.max * .15 && !t.warned) { t.warned = 1; toast(`${GEAR_DEFS[t.id].n} is wearing out — repair it from the bag (E)`, 3); }
  if (t.d <= 0) { INV.tools.splice(INV.tools.indexOf(t), 1); unequip(t); sfx('no'); toast(`${QUAL[t.q].n} ${GEAR_DEFS[t.id].n.toLowerCase()} broke`, 2.6); if (lastTool === t) lastTool = null; if (typeof onGearBroke === 'function') onGearBroke(t); }
}
const has = kind => !!bestTool(kind);

/* ---------- wear: five slots, stats add up ---------- */
const wornAll = () => INV.tools.filter(t => t.on && GEAR_DEFS[t.id].kind === 'wear');
function wearStat(k) { let v = 0; for (const t of wornAll()) v += GEAR_DEFS[t.id][k] || 0; return v; }
function toggleWear(g) {
  const D = GEAR_DEFS[g.id]; if (D.kind !== 'wear') return;
  if (g.on) { g.on = false; return; }
  for (const t of INV.tools) if (t.on && GEAR_DEFS[t.id].slot === D.slot) t.on = false;
  g.on = true; sfx('pickup');
}
function hurtWear(n) { for (const t of wornAll()) if (GEAR_DEFS[t.id].prot) wearTool(t, n); }

/* ---------- carry weight ---------- */
const carryCap = () => G.flags.dev ? 1e9 : 45 + wearStat('cap');
function carryLoad() {
  let w = 0;
  for (const [id, n] of Object.entries(INV.items)) w += (ITEMS[id]?.w ?? .2) * n;
  for (const id in LINK) w += (ITEMS[id]?.w || 0) * cnt(id);
  for (const t of INV.tools) w += GEAR_DEFS[t.id].w || 1;
  return Math.round(w * 10) / 10;
}
let loadT = 0;
function updLoad(dt) { loadT -= dt; if (loadT > 0) return; loadT = .5; const was = P.over; P.over = carryLoad() > carryCap(); if (P.over && !was) toast('Overloaded — you\'re slower. Drop or store something, or wear a pack', 3.2); }

/* ---------- tiers open when you find their key ---------- */
const tierNow = () => G.flags.tier || 1;
const tierOpen = t => t <= tierNow();
function unlockTier(t, id) {
  if (t <= tierNow()) return; G.flags.tier = t;
  setTimeout(() => { card(`TIER ${t} · ${TIERS[t].toUpperCase()}`, `${nameOf(id)} studied — new recipes in the craft menu`, 4.5); music.sting?.('sting-drum-hit', .4); }, 600);
  save();
}
function revealAll(id) {
  const seen = G.flags.seen = G.flags.seen || {};
  for (const R of REGIONS) if (!R.area && !R.river) seen[R.id] = 1;
  if (id === 'nav_console' || id === 'map') { G.flags.mapAll = 1; toast(id === 'map' ? 'The old map marks every named place' : 'The console lists every landing site and ruin', 3); }
}

/* ---------- stations ---------- */
const FIXED_ST = () => { const st = { fire: [[SPOTS.fire, 4.2]], cook: [[SPOTS.fire, 4.2]], rack: [[SPOTS.smoke, 4.6]], forge: [[SHOP.craft.forge, 3.4]] };
  for (const D of SHOP_DEFS) for (const k of D.st) (st[k] = st[k] || []).push([D.spot, 3.8]);
  return st; };
function nearStation(kind) {
  for (const [p, r] of FIXED_ST()[kind] || []) if (Math.hypot(P.x - p.x, P.z - p.z) < r) return true;
  if (typeof PLACED === 'undefined') return false;
  for (const p of PLACED) { const B = BUILD_DEF[p.k]; if (B && B.st && B.st.includes(kind) && Math.hypot(P.x - p.x, P.z - p.z) < (B.str || 3.6) && (!B.needPower || powered())) return true; }
  for (const S of FACTION_ST) if (S.st.includes(kind) && Math.hypot(P.x - S.x, P.z - S.z) < 4) return true;
  return false;
}
const FACTION_ST = [];                         // benches/forges in friendly bases (filled by the city/bases builder)

/* ---------- crafting ---------- */
function recipeIns(r) {
  if (!r.alt2) return Object.entries(r.i);
  const [k0, n0] = Object.entries(r.i)[0];
  if (cnt(k0) >= n0) return Object.entries(r.i);
  return [...Object.entries(r.alt2), ...Object.entries(r.i).slice(1)];
}
function recipeState(r) {
  const ins = recipeIns(r);
  const miss = ins.some(([k, n]) => cnt(k) < n), stOK = !r.at || nearStation(r.at), toolOK = !r.tool || has(r.tool);
  return { ins, miss, stOK, toolOK, open: tierOpen(r.t), ok: tierOpen(r.t) && !miss && stOK && toolOK };
}
function craft(r, times = 1) {
  let made = 0;
  for (let k = 0; k < times; k++) {
    const s = recipeState(r);
    if (!s.open) { sfx('no'); toast(`Tier ${r.t}: ${TIER_HOW[r.t]}`, 3.4); break; }
    if (s.miss) { if (!made) { sfx('no'); toast('Missing materials'); } break; }
    if (!s.stOK) { sfx('no'); toast(`Needs a ${STATION_N[r.at].toLowerCase()}`); break; }
    if (!s.toolOK) { sfx('no'); toast(`Needs a ${r.tool === 'weld' ? 'welding kit' : r.tool === 'driver' ? 'screwdriver' : r.tool}`); break; }
    for (const [k2, n] of s.ins) take(k2, n);
    if (r.tool) wearTool(bestTool(r.tool));
    if (GEAR_DEFS[r.o]) {
      let q = null; if (nearStation('bench') || nearStation('forge')) { const x = rnd(); q = x < .08 ? 0 : x < .68 ? 1 : 2; }
      const g = newGear(r.o, q); toast(`${QUAL[g.q].n} ${GEAR_DEFS[r.o].n.toLowerCase()} · ${g.max} uses`, 2.6);
    } else give(r.o, r.n || 1);
    made++;
  }
  if (!made) return;
  if (!GEAR_DEFS[r.o]) toast(`+${(r.n || 1) * made} ${nameOf(r.o)}`, 1.8);
  sfx(r.at === 'fire' || r.at === 'cook' ? 'eat' : 'buy');
  save(); renderInv();
}

/* ---------- food: variety matters, raw/dirty things can make you sick ---------- */
const FOOD = {
  // (Part 3) cooked food gives buffs — b: { stam | heal | prot: seconds } (BUFF_DEF in 2a-data.js); raw food still risks sickness
  ration: { f: 0, h: 0, k: 'meat', ration: 1, b: { prot: 180 } }, dried_meat: { f: 42, h: 10, k: 'meat', b: { prot: 180 } }, roast: { f: 60, h: 16, k: 'meat', b: { prot: 300, heal: 120 } }, meat: { f: 14, h: 0, k: 'meat', risk: .35 },
  cooked_fish: { f: 32, h: 10, k: 'fish', b: { stam: 240 } }, smoked_fish: { f: 38, h: 10, k: 'fish', b: { stam: 240 } }, fish: { f: 10, h: 0, k: 'fish', risk: .3 }, lake_fish: { f: 10, h: 0, k: 'fish', risk: .3 }, shellfish: { f: 12, h: 2, k: 'fish', risk: .2 },
  berries: { f: 8, h: 2, k: 'plant' }, blueberries: { f: 8, h: 3, k: 'plant' }, nuts: { f: 12, h: 2, k: 'plant' }, greens: { f: 7, h: 3, k: 'plant' }, roots: { f: 10, h: 1, k: 'plant', risk: .08 },
  mushroom: { f: 9, h: 0, k: 'plant', risk: .22 }, potato: { f: 12, h: 2, k: 'plant', risk: .1 }, carrot: { f: 9, h: 3, k: 'plant' }, corn: { f: 10, h: 2, k: 'plant' }, squash: { f: 14, h: 3, k: 'plant' }, honey: { f: 15, h: 6, k: 'plant', b: { heal: 120 } },
  stew: { f: 46, h: 22, k: 'meal', b: { heal: 300, prot: 180 } }, veg_soup: { f: 40, h: 22, k: 'meal', b: { heal: 300 } }, fish_soup: { f: 52, h: 24, k: 'meal', b: { heal: 300, stam: 300 } }, bread: { f: 30, h: 6, k: 'meal', b: { stam: 300 } }, canned: { f: 40, h: 8, k: 'meal' }, arc_pack: { f: 35, h: 10, k: 'meal', b: { stam: 120 } },
  water_dirty: { f: 4, h: 0, k: 'water', risk: .2 }, water_boiled: { f: 8, h: 5, k: 'water', b: { stam: 90 } }, water_filtered: { f: 8, h: 6, k: 'water', b: { stam: 90 } }, water_rain: { f: 7, h: 4, k: 'water' },
};
const DIET_N = 6;
function eatItem(id, quiet) {
  const F = FOOD[id]; if (!F || cnt(id) <= 0) return false;
  if (P.food >= 99 && F.k !== 'water' && !quiet) { toast('Not hungry'); return false; }
  take(id, 1);
  let [f, h] = F.ration ? RATION() : [F.f, F.h];
  P.diet = P.diet || [];
  const same = P.diet.filter(k => k === F.k).length, mult = F.k === 'water' ? 1 : Math.max(.45, 1 - same * .16);
  f = Math.round(f * mult);
  P.diet.push(F.k); if (P.diet.length > DIET_N) P.diet.shift();
  P.food = Math.min(100, P.food + f); P.hp = Math.min(100, P.hp + h);
  const hasP = P.diet.some(k => k === 'meat' || k === 'fish'), hasV = P.diet.some(k => k === 'plant' || k === 'meal'), hasW = P.diet.includes('water');
  let note = `+${f} food`;
  if (mult < .8) note += ' · same food again, less filling';
  if (hasP && hasV && hasW && !(P.fed > 0)) { P.fed = 240; note += ' · well fed'; }
  if (F.risk && rnd() < F.risk) { P.sick = Math.max(P.sick || 0, 45); note = 'That was bad. You feel sick.'; sfx('cough'); }
  else { sfx('eat'); if (F.b) { P.buffs = P.buffs || {}; for (const k in F.b) P.buffs[k] = Math.max(P.buffs[k] || 0, F.b[k]); note += ' · ' + Object.keys(F.b).map(k => `${BUFF_DEF[k].n} (${BUFF_DEF[k].note})`).join(' · '); } }
  toast(note, 2.2);
  return true;
}
function eatBest() {
  const have = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water' && !FOOD[id].risk);
  if (!have.length) { const raw = Object.keys(FOOD).filter(id => cnt(id) > 0 && FOOD[id].k !== 'water'); if (!raw.length) { sfx('no'); toast('Nothing to eat — hunt, forage or cook'); return; } toast('Only raw food left — cook it at a fire first', 2.4); return; }
  const seen = k => (P.diet || []).filter(x => x === k).length;
  have.sort((a, b) => seen(FOOD[a].k) - seen(FOOD[b].k) || (FOOD[b].f || 40) - (FOOD[a].f || 40));
  eatItem(have[0]);
}
const foodCount = () => Object.keys(FOOD).reduce((a, id) => a + (FOOD[id].k !== 'water' && !FOOD[id].risk ? cnt(id) : 0), 0);

/* ---------- injuries: bleeding, fractures, sickness, the Rust — each wants its own fix ---------- */
const MEDS = {
  herb_bandage: { h: 15, fix: ['bleed'] }, bandage: { h: 20, fix: ['bleed'] }, splint: { h: 0, fix: ['frac'] }, poultice: { h: 5, fix: ['sick'] },
  antibiotic: { h: 10, fix: ['sick'] }, disinfect: { h: 5, fix: ['sick'] }, painkiller: { h: 25, fix: [] }, medkit: { h: 60, fix: ['bleed', 'sick', 'frac'] },
  surgical_kit: { h: 35, fix: ['bleed', 'frac'] }, iv: { h: 45, fix: [] }, blood_bag: { h: 55, fix: ['bleed'] },
  rust_med: { h: 10, fix: ['dose'] }, inject: { h: 0, fix: [], fn: () => { P.immune = 600; return 'protected from the Rust for 10 minutes'; } },
  serum: { h: 30, fix: ['dose'], fn: () => { G.flags.serum = 1; return 'the Rust can’t hurt you any more'; } },
  war_paint: { h: 0, fix: [], fn: () => { P.paint = 600; return 'painted — the clans notice you later'; } },
  purify_tab: { h: 0, fix: [], fn: () => { const n = Math.min(3, cnt('water_dirty')); if (!n) return 'nothing to purify'; take('water_dirty', n); give('water_filtered', n); return `${n} water purified`; } },
};
function useMed(id) {
  const M0 = MEDS[id]; if (!M0 || cnt(id) <= 0) return false;
  const fixes = M0.fix.filter(k => P[k] > 0);
  if (!fixes.length && P.hp >= 99 && !M0.fn) { toast("You don't need that right now"); return false; }
  take(id, 1); for (const k of fixes) P[k] = 0; P.hp = Math.min(100, P.hp + M0.h);
  const extra = M0.fn ? M0.fn() : '';
  sfx('pickup'); toast([M0.h ? `+${M0.h} health` : '', fixes.map(k => ({ bleed: 'bleeding stopped', frac: 'leg splinted', sick: 'fever breaking', dose: 'Rust flushed out' })[k]).join(' · '), extra].filter(Boolean).join(' · '), 2.6);
  return true;
}
function healBest() {
  const want = ['bleed', 'frac', 'sick', 'dose'].filter(k => P[k] > (k === 'dose' ? 20 : 0));
  const ids = Object.keys(MEDS).filter(id => cnt(id) > 0 && !MEDS[id].fn);
  let pickId = null;
  for (const w of want) { pickId = ids.filter(id => MEDS[id].fix.includes(w)).sort((a, b) => MEDS[a].fix.length - MEDS[b].fix.length)[0]; if (pickId) break; }
  if (!pickId && P.hp < 85) pickId = ids.filter(id => MEDS[id].h > 0).sort((a, b) => MEDS[a].h - MEDS[b].h)[0];
  if (!pickId) { sfx('no'); toast(want.length ? `Nothing here treats ${{ frac: 'a fracture — make a splint', bleed: 'bleeding — make a bandage', sick: 'sickness — make a poultice', dose: 'Rust poisoning — find Rust medicine' }[want[0]]}` : 'Nothing to treat'); return; }
  useMed(pickId);
}
const medCount = () => Object.keys(MEDS).reduce((a, id) => a + (MEDS[id].fn ? 0 : cnt(id)), 0);
function clearInjuries() { P.bleed = 0; P.frac = 0; P.sick = 0; P.dose = 0; }
function onHurt(n, melee) {
  n *= 1 - Math.min(.8, wearStat('prot')); hurtWear(1);
  if (cnt('ember')) n *= .8;
  if (P.buffs && P.buffs.prot > 0) n *= 1 - SURV.protCut;
  if (melee && rnd() < .22 + n / 120) { if (!(P.bleed > 0)) toast('You\'re bleeding — bandage it (slot 5)', 2.6); P.bleed = 45; }
  return n;
}
function onFall(dmg) { if (has('climb')) return; if (dmg >= 12 && !(P.frac > 0)) { P.frac = 1; toast('Something cracked. A splint will fix the leg (slot 5)', 3); } }
const fogResist = () => G.flags.serum || P.immune > 0 || cnt('ember') ? 1 : Math.min(1, wearStat('fog') + (has('breather') ? .8 : 0) + (P.buffs && P.buffs.prot > 0 ? .25 : 0));   // Hardy (cooked meat, stew) shrugs off some red fog too
function updStatus(dt) {
  if (P.dead || cine) return;
  if (P.bleed > 0) { P.bleed -= dt; P.hp -= dt * .9; if (P.bleed < 1 && rnd() < .3 && !(P.sick > 0)) { P.sick = 60; toast('The wound’s gone bad — infection', 2.6); } }
  if (P.sick > 0) { P.sick -= dt; P.food = Math.max(0, P.food - dt * SURV.sickFood); if (P.hp > 30) P.hp -= dt * .35; }
  if (P.dose > 0) { if (P.dose > 40) { P.food = Math.max(0, P.food - dt * SURV.doseFood); if (P.hp > 20) P.hp -= dt * .25; } if (rust.state === 'none') P.dose = Math.max(0, P.dose - dt * .05); }
  if (P.fed > 0) { P.fed -= dt; if (P.hp < 100 && P.hurtT <= 0 && P.food > 45) P.hp = Math.min(100, P.hp + dt * .6); }
  if (cnt('ember') && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * .8);
  if (P.immune > 0) P.immune -= dt; if (P.paint > 0) P.paint -= dt;
  const br = rust.state === 'active' && !P.safe ? bestTool('breather') : null; if (br && Math.random() < dt) wearTool(br);
  if (P.hp <= 0) die();
}
const statusTags = () => [P.bleed > 0 && ['Bleeding', '#e0573d'], P.frac > 0 && ['Fractured leg', '#e0a040'], P.sick > 0 && ['Sick', '#a8c050'], P.dose > 20 && ['Rust poisoning', '#c0603a'],
  P.fed > 0 && ['Well fed', '#7fc4b8'], ...Object.keys(BUFF_DEF).map(k => P.buffs && P.buffs[k] > 0 && [BUFF_DEF[k].n, BUFF_DEF[k].c]), P.immune > 0 && ['Rust-proof', '#9ad06a'], P.paint > 0 && ['War paint', '#b0b0b0'], P.over && ['Overloaded', '#e0a040']].filter(Boolean);
const stealthK = () => Math.max(.35, 1 - wearStat('stealth') - (P.paint > 0 ? .3 : 0));

/* ---------- gathering: trees, rocks, undergrowth, water ---------- */
const RCELL = 6, RGRID = new Map(), RDEPL = new Map();
function addRes(kind, x, z, s = 1) { if (kind !== 'rubble' && (inCity(x, z, 4) || inBase(x, z, 4))) return; const k = gkey(Math.floor(x / RCELL), Math.floor(z / RCELL)); let L = RGRID.get(k); if (!L) RGRID.set(k, L = []); L.push({ kind, x, z, s }); }
const NODE_USES = { fir: 4, alder: 4, snag: 3, boulder: 4, stone: 1, fern: 2, rubble: 3 };
const NODE_REGROW = { fir: 420, alder: 420, snag: 600, boulder: 600, stone: 360, fern: 240, rubble: 900 };
function nodeLeft(n) { const d = RDEPL.get(n); if (!d) return NODE_USES[n.kind]; if (G.t > d.at) { RDEPL.delete(n); return NODE_USES[n.kind]; } return NODE_USES[n.kind] - d.used; }
function useNode(n) { let d = RDEPL.get(n); if (!d || G.t > d.at) RDEPL.set(n, d = { used: 0, at: 0 }); d.used++; d.at = G.t + NODE_REGROW[n.kind]; }
function nearNode() {
  const ci = Math.floor(P.x / RCELL), cj = Math.floor(P.z / RCELL); let b = null, bd = 1e9;
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const n of RGRID.get(gkey(i, j)) || []) {
    const reach = n.kind === 'boulder' || n.kind === 'rubble' ? n.s * 1.1 + 1.4 : n.kind === 'fir' || n.kind === 'alder' || n.kind === 'snag' ? 1.9 : 1.6;
    const d = Math.hypot(n.x - P.x, n.z - P.z) - reach; if (d < 0 && d < bd && nodeLeft(n) > 0) { bd = d; b = n; }
  }
  return b;
}
function nearWater() {
  if (Math.abs(P.y - heightAt(P.x, P.z)) > 1.5 && !P.swim) return null;
  for (let a = 0; a < 6.28; a += .785) for (const r of [0, 1.6, 3]) { const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (waterAt(x, z) > heightAt(x, z) + .15) return { x, z, lake: LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.R + 10) }; }
  return null;
}
const gSpeed = () => 1 / (1 + wearStat('gather'));
const TREE_N = { fir: 'fir', alder: 'alder', snag: 'dead tree' };
function nodeAction(n) {
  const g = gSpeed();
  if (n.kind in TREE_N) { const ax = bestTool('axe'); return ax ? { l: `Chop the ${TREE_N[n.kind]}`, t: 1.6 / (GEAR_DEFS[ax.id].pw || 1) * g, fn: () => chop(n, ax) } : { l: n.kind === 'snag' ? 'Snap off dry branches' : 'Gather sticks', t: 1.1 * g, fn: () => sticks(n) }; }
  if (n.kind === 'boulder') { const pk = bestTool('pick'); return pk ? { l: 'Mine the rock', t: 1.8 / (GEAR_DEFS[pk.id].pw || 1) * g, fn: () => mine(n, pk) } : { l: 'Prise loose stones', t: 1.3 * g, fn: () => looseStones(n) }; }
  if (n.kind === 'rubble') { const pr = bestTool('pry') || bestTool('pick'); return { l: pr ? 'Pry through the rubble' : 'Dig through the rubble', t: (pr ? 1.4 : 2.6) * g, fn: () => rubble(n, pr) }; }
  if (n.kind === 'stone') return { l: 'Take the stone', t: .5, fn: () => { useNode(n); gain([['stone', 1], ['flint', rnd() < .25 ? 1 : 0]]); } };
  if (n.kind === 'fern') { const sh = bestTool('shovel'); return { l: sh ? 'Forage + dig' : 'Forage the undergrowth', t: 1 * g, fn: () => forage(n) }; }
}
function gain(list) {
  const got = list.filter(([, n]) => n > 0); for (const [id, n] of got) give(id, n);
  if (got.length) { sfx('pickup'); toast(got.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`).join(' · '), 1.8); gatherHint(); }
}
function chop(n, ax) { useNode(n); const pw = GEAR_DEFS[ax.id].pw || 1; wearTool(ax); sfx('thud'); gain([['log', pw + (rnd() < .4 ? 1 : 0)], ['stick', 1 + Math.floor(rnd() * 2)], ['bark', rnd() < .5 ? 1 : 0], ['hardwood', n.kind === 'alder' && rnd() < .55 ? 1 : 0], ['honey', rnd() < .03 ? 1 : 0]]); }
function sticks(n) { useNode(n); useNode(n); gain([['stick', 2 + Math.floor(rnd() * 2)], ['bark', rnd() < .3 ? 1 : 0], ['leaves', rnd() < .4 ? 2 : 0], ['branch', n.kind === 'snag' && rnd() < .4 ? 1 : 0], ['feather', rnd() < .06 ? 2 : 0]]); }
function mine(n, pk) { useNode(n); const pw = GEAR_DEFS[pk.id].pw || 1; wearTool(pk); sfx('metal', .6); gain([['stone', 2 + pw], ['flint', rnd() < .35 + pw * .1 ? 1 : 0], ['limestone', rnd() < .25 ? 1 : 0], ['metal_ore', rnd() < (pw > 1 ? .35 : .08) ? 1 : 0]]); }
function looseStones(n) { useNode(n); useNode(n); gain([['stone', 1 + Math.floor(rnd() * 2)], ['flint', rnd() < .18 ? 1 : 0]]); }
function rubble(n, pr) {
  useNode(n); if (pr) wearTool(pr); sfx('metal', .5);
  const r = (id, p, a = 1, b = a) => [id, rnd() < p ? a + Math.floor(rnd() * (b - a + 1)) : 0];
  gain([r('scrap', .8, 1, 3), r('stone', .5, 1, 2), r('nails', .3, 2, 5), r('screws', .2, 2, 4), r('pipe', .12), r('glass', .15), r('cu_wiring', .14), r('wire', .15), r('rubber', .1), r('metal_ore', .1), r('fuse', .05), r('springs', .06), r('gears', .05), r('documents', .04), r('photo', .04)]);
}
function forage(n) {
  useNode(n); const kn = bestTool('knife'), sh = bestTool('shovel'), seed = pick(['seed_corn', 'seed_potato', 'seed_wheat', 'seed_bean', 'seed_squash', 'seed_carrot']);
  const L = [['fiber', 2 + (kn ? 1 : 0)], ['vine', rnd() < .2 ? 1 : 0], ['berries', rnd() < .2 ? 1 + Math.floor(rnd() * 2) : 0], ['blueberries', rnd() < .1 ? 2 : 0], ['herb_med', rnd() < .18 ? 1 : 0],
    ['herb', rnd() < .14 ? 1 : 0], ['mushroom', rnd() < .14 ? 1 : 0], ['greens', rnd() < .16 ? 1 : 0], ['nuts', rnd() < .08 ? 1 : 0], ['leaves', rnd() < .4 ? 2 : 0], [seed, rnd() < .03 ? 1 : 0],
    ['roots', sh ? (rnd() < .6 ? 1 + Math.floor(rnd() * 2) : 0) : rnd() < .1 ? 1 : 0], ['soil', sh ? 1 + Math.floor(rnd() * 2) : 0], ['clay', sh && rnd() < .15 ? 1 : 0]];
  if (kn && rnd() < .5) wearTool(kn); if (sh) wearTool(sh);
  gain(L);
}
const container = () => cnt('pot') > 0 || cnt('canteen') > 0;
function waterAction(w) {
  const fi = bestTool('fish'), sh = bestTool('shovel'), acts = [];
  if (container()) acts.push({ l: 'Fill up (dirty water)', t: 1, fn: () => gain([['water_dirty', cnt('canteen') ? 3 : 2]]) });
  if (fi) acts.push({ l: fi.id === 'fish_rod' ? 'Cast a line' : 'Spear fish', t: fi.id === 'fish_rod' ? 3.2 : 2.4, fn: () => {
    // (Part 3) better odds, a chance of two with a rod, and fish bite more in rain and fog (wxFishK, 1k-weather.js)
    const rod = fi.id === 'fish_rod', bite = (rod ? .85 : .65) + wxFishK();
    wearTool(fi); if (rnd() < bite) gain([[w.lake ? 'lake_fish' : 'fish', rod && rnd() < .3 ? 2 : 1], ['shellfish', rnd() < .12 ? 1 : 0]]); else { toast('Nothing bit', 1.4); sfx('splash'); } } });
  if (sh && !w.lake) acts.push({ l: 'Dig clay from the bank', t: 1.8, fn: () => { wearTool(sh); gain([['clay', 2 + Math.floor(rnd() * 2)]]); } });
  acts.push({ l: 'Cut reeds', t: .9, fn: () => gain([['reed', 1 + Math.floor(rnd() * 2)], ['fiber', 1], ['shellfish', rnd() < .08 ? 1 : 0]]) });
  return acts;
}
let gHinted = false;
function gatherHint() { if (gHinted || G.flags.craftHint) return; gHinted = true; G.flags.craftHint = 1; setTimeout(() => toast(isTouch ? 'Tap the bag → CRAFT to turn these into tools' : 'Press I → CRAFT to turn these into tools', 4.5), 1900); }

/* channelled actions: hold still, the bar fills, then it happens (moving away cancels) */
let chan = null;
function startChan(a) { if (chan || !a) return; chan = { ...a, t0: a.t, x: P.x, z: P.z }; sfx('swing'); }
function updChan(dt) {
  if (!chan) return;
  if (P.dead || cine || Math.hypot(P.x - chan.x, P.z - chan.z) > .9 || invOpen || shopOpen) { chan = null; return; }
  chan.t -= dt; if (Math.random() < dt * 2.5) sfx('swing');
  if (chan.t <= 0) { const f = chan.fn; chan = null; f(); if (invOpen) renderInv(); }
}
let waterPick = 0;
function wildInteract() {
  if (chan) return { l: `${chan.l}…`, prog: 1 - chan.t / chan.t0, act: () => {} };
  const n = nearNode(); if (n) { const a = nodeAction(n); return a && { l: a.l, act: () => startChan(a) }; }
  const w = nearWater(); if (w) { const acts = waterAction(w); const a = acts[waterPick % acts.length]; return { l: a.l + (acts.length > 1 ? `  ·  ${isTouch ? 'hold' : 'Q'}: next` : ''), act: () => startChan(a), next: () => { waterPick++; }, multi: acts.length > 1 }; }
  return null;
}

/* butchering by-products: a knife gets you far more than meat */
function butcherYield(e) {
  if (e.sp) { const kn = bestTool('knife'); if (kn) wearTool(kn); return { L: wildYield(e, kn), kn }; }
  const kn = bestTool('knife'), L = [['meat', e.type === 'boar' ? 2 : 1]];
  if (kn) { wearTool(kn); L.push(['hide', 1], ['bone', 1 + Math.floor(rnd() * 2)], ['fat', e.type === 'boar' ? 2 : 1], ['sinew', e.type === 'deer' ? 1 + Math.floor(rnd() * 2) : 1], ['teeth', e.type === 'boar' && rnd() < .5 ? 1 : 0]); }
  else L.push(['bone', rnd() < .5 ? 1 : 0]);
  return { L, kn };
}

/* ---------- loot tables: the further from home and the better guarded, the better ---------- */
const GUNS_LOW = ['pistol', 'revolver', 'shotgun', 'flare_gun', 'm1911', 'pump_rifle'], GUNS_HIGH = ['smg', 'assault', 'sniper', 'lmg', 'grey_rifle'];
const LOOT = {
  wild: { cloth: [.55, 1, 3], rope: [.25], nails: [.3, 2, 5], screws: [.2, 2, 4], wire: [.25, 1, 2], bandage: [.2], painkiller: [.12], canned: [.2], purify_tab: [.08], ammo_556: [.4, 10, 25], seed_corn: [.06, 2, 4], seed_potato: [.06, 1, 3], map: [.03] },
  ruin: { cloth: [.5, 1, 3], nails: [.4, 3, 8], screws: [.3, 2, 6], bolts: [.2, 2, 4], wire: [.35, 1, 3], cu_wiring: [.3, 1, 2], pipe: [.2], glass: [.25, 1, 2], rubber: [.2], circuit: [.15], battery: [.2], fuse: [.18], sensor: [.06],
    spare_parts: [.18], springs: [.15], gears: [.12], gas_tank: [.05], fuel: [.1], disinfect: [.1], antibiotic: [.06], canned: [.3, 1, 2], documents: [.1], photo: [.08], notebook: [.06], ammo_9: [.25, 6, 15], ammo_556: [.25, 10, 25], synth: [.15, 1, 2], aluminum: [.15] },
  city: { scrap: [.7, 2, 5], nails: [.5, 4, 10], screws: [.4, 3, 8], bolts: [.35, 2, 5], cu_wiring: [.35, 1, 3], pipe: [.25], glass: [.35, 1, 2], rubber: [.3], circuit: [.25, 1, 2], battery: [.3], fuse: [.25], sensor: [.12],
    antenna: [.08], spare_parts: [.25], springs: [.25], gears: [.2], tool_kit: [.06], engine_part: [.05], fuel: [.15], gas_tank: [.08], solar_cell: [.06], arc_alloy: [.05], synth: [.25, 1, 3], aluminum: [.25, 1, 2], copper: [.2],
    canned: [.3, 1, 2], disinfect: [.15], antibiotic: [.1], med_parts: [.08], painkiller: [.2], alcohol: [.12], ammo_9: [.35, 8, 20], ammo_45: [.2, 6, 12], ammo_12: [.2, 4, 10], ammo_556: [.3, 15, 30], data_drive: [.08], camera: [.05], tablet: [.03], id_chip: [.025] },
  mil: { ammo_556: [.8, 30, 60], ammo_762: [.5, 8, 20], ammo_9: [.5, 15, 30], ammo_12: [.35, 8, 16], frag: [.3, 1, 2], smoke_gren: [.3, 1, 2], medkit: [.35], blood_bag: [.1], iv: [.12], inject: [.12], rust_med: [.1],
    battery: [.4, 1, 2], circuit: [.3], sensor: [.2], synth: [.4, 2, 4], steel: [.3, 1, 2], lab_sample: [.12], greyhold_files: [.05], shielding: [.1] },
  op: { ammo_556: [.9, 40, 90], ammo_762: [.6, 15, 30], ammo_12: [.5, 10, 20], frag: [.6, 2, 4], medkit: [.6, 1, 2], inject: [.3], rust_med: [.3], arc_alloy: [.5, 1, 3], solar_cell: [.4, 1, 2], power_cell: [.15],
    circuit: [.6, 1, 3], sensor: [.4, 1, 2], tool_kit: [.4], spare_parts: [.6, 2, 4], shielding: [.3, 1, 2], blackvein: [.08], halcyon_chip: [.1], sunfall_data: [.1], spindle: [.06] },
  clan: { hide: [.5, 1, 3], leather: [.3, 1, 2], bone: [.5, 1, 3], sinew: [.4, 1, 2], feather: [.4, 2, 5], fat: [.3, 1, 2], herb_med: [.4, 1, 3], dried_meat: [.4, 1, 3], arrows: [.3, 3, 8], rope: [.3],
    war_paint: [.3, 1, 2], seed_wheat: [.2, 2, 4], seed_bean: [.2, 2, 4], seed_squash: [.15, 1, 3], honey: [.15], salt: [.2, 1, 2] },
  arc: { arc_pack: [.6, 1, 3], cloth: [.5, 1, 3], synth: [.4, 1, 2], battery: [.3], circuit: [.2], wire: [.4, 1, 3], bandage: [.4], purify_tab: [.3], arc_alloy: [.2], ammo_556: [.4, 15, 30], wristband: [.2], photo: [.2], notebook: [.15] },
  trade: {},
};
const GEAR_LOOT = {
  wild: [.05, ['crowbar', 'wrench', 'hunting_knife', 'flashlight', 'hand_saw', 'compass', 'machete', 'longbow', 'canteen', 'gloves', 'boots', 'jacket']],
  ruin: [.14, ['metal_axe', 'pickaxe', 'crowbar', 'wrench', 'screwdriver', 'pliers', 'hammer', 'flashlight', 'radio', 'binoculars', 'pistol', 'revolver', 'm1911', 'pump_rifle', 'machete', 'kukri', 'hand_xbow', 'backpack', 'duffel', 'util_vest', 'helmet', 'boots', 'gloves']],
  city: [.2, ['bolt_cutters', 'crowbar', 'multitool', 'welder', 'flashlight', 'radio', 'binoculars', 'wire_cutters', 'pistol', 'revolver', 'm1911', 'pump_rifle', 'shotgun', 'smg', 'flare_gun', 'stun_baton', 'mil_knife', 'tomahawk', 'kukri', 'backpack', 'tac_armor', 'sec_uniform', 'helmet', 'gas_mask', 'arc_jumpsuit', 'climb_gear']],
  mil: [.45, ['assault', 'smg', 'shotgun', 'sniper', 'grey_rifle', 'tac_armor', 'grey_armor', 'gas_mask', 'riot_helmet', 'riot_shield', 'helmet', 'nvg', 'hazmat', 'rust_detector', 'med_scanner', 'mil_knife', 'stun_baton', 'breather', 'tomahawk', 'heavy_xbow']],
  op: [.9, ['lmg', 'assault', 'sniper', 'grey_rifle', 'pulse_pistol', 'heavy_xbow', 'mil_armor', 'grey_armor', 'rust_suit', 'nvg', 'lock_bypass', 'transmitter', 'repair_drone', 'diag_pc', 'solar_charger']],
  clan: [.2, ['shortbow', 'recurve', 'longbow', 'yumi', 'hornbow', 'hunt_recurve', 'repeat_xbow', 'hunt_spear', 'hatchet', 'war_axe', 'club', 'clan_mask', 'leather_armor', 'arm_guards', 'hide_coat', 'bone_dagger', 'staff']],
  arc: [.15, ['flashlight', 'radio', 'arc_jumpsuit', 'pistol', 'multitool', 'med_scanner']],
};
function rollLoot(table, extraRolls = 0) {
  const T = LOOT[table] || LOOT.wild, out = [];
  for (const [id, [p, a = 1, b = a]] of Object.entries(T)) if (rnd() < p) out.push([id, a + Math.floor(rnd() * (b - a + 1))]);
  for (const [id, n] of out) give(id, n);
  const msg = out.map(([id, n]) => `+${n} ${nameOf(id).toLowerCase()}`);
  const GL = GEAR_LOOT[table];
  for (let k = 0; k <= extraRolls; k++) if (GL && rnd() < GL[0]) { const g = newGear(pick(GL[1]), pick([0, 1, 1, 2]), table === 'op' || table === 'mil' ? rr(0, .3) : rr(.2, .65)); msg.unshift(`${GEAR_DEFS[g.id].n} (${Math.round(g.d / g.max * 100)}%)`); }
  return msg;
}
const RUIN_AT = () => [[POI.halvard, 110], [POI.burn, 75]];
function crateTable(c) {
  if (c.table) return c.table;
  if (inCity(c.x, c.z, 0)) return 'city';
  if (RUIN_AT().some(([p, r]) => Math.hypot(c.x - p.x, c.z - p.z) < r)) return Math.hypot(c.x - POI.burn.x, c.z - POI.burn.z) < 75 ? 'arc' : 'ruin';
  if (HOLDS.some(H => Math.hypot(c.x - H.x, c.z - H.z) < H.R + 10) || Math.hypot(c.x - POI.ashmere.x, c.z - POI.ashmere.z) < 80) return 'clan';
  return 'wild';
}
function crateSalvage(c) { return rollLoot(crateTable(c)); }
function clanDrop(e) {
  const L = [], T = e && e.fac === 'iron' ? [['scrap', .6, 1, 3], ['ammo_9', .35, 4, 10], ['ammo_12', .15, 2, 5], ['nails', .3, 2, 6], ['cloth', .3, 1, 2], ['canned', .15], ['fuel', .05], ['bolts', .2, 1, 3]]
    : e && e.fac === 'grey' ? [['ammo_556', .7, 10, 25], ['battery', .2], ['inject', .1], ['medkit', .15], ['synth', .3, 1, 2], ['greyhold_card', .04], ['lab_sample', .06]]
      : [['cloth', .3, 1, 2], ['bone', .18], ['feather', .15, 2, 2], ['rope', .1], ['herb_med', .06], ['arrows', .1, 2, 4], ['insignia', .05], ['war_paint', .05]];
  for (const [id, p, a = 1, b = a] of T) if (rnd() < p) L.push([id, a + Math.floor(rnd() * (b - a + 1))]);
  for (const [id, n] of L) give(id, n); return L;
}

/* ================= (Nov 11, Part 3) gentler survival =================
   Called once a frame from updPlayer. The food bar (hunger + thirst) drains ~3× slower than before, starving wears you down
   but never kills, cooked food buffs tick down here, and rain fills a pot or canteen. Tuning: SURV / BUFF_DEF in 2a-data.js. */
let rainCatchT = 0;
function updSurvival(dt) {
  const warm = 1 - Math.min(.5, wearStat('warm') * (isNight() ? 1 : .4));
  P.food = Math.max(0, P.food - dt * SURV.drain * (P.sprinting ? SURV.sprintK : 1) * (P.swim ? SURV.swimK : 1) * warm);
  const B = P.buffs || (P.buffs = {});
  for (const k in B) if (B[k] > 0) { B[k] -= dt; if (B[k] <= 0) { delete B[k]; toast(`${BUFF_DEF[k]?.n || k} wore off`, 1.6); } }
  if (P.food <= 0) { if (P.hp > SURV.starveFloor) P.hp = Math.max(SURV.starveFloor, P.hp - dt * SURV.starveHp); }
  else if (P.food > SURV.regenAbove && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * (Math.hypot(P.x, P.z) < CAMP_R ? 1.6 : .5));
  if (B.heal > 0 && P.hp < 100 && P.hurtT <= 0) P.hp = Math.min(100, P.hp + dt * .9);
  // Energised: sprinting costs half as much and stamina comes back faster (updPlayer has already spent/refilled it this frame)
  if (B.stam > 0) { if (P.sprinting) P.stam = Math.min(100, P.stam + dt * 5.5); else if (P.stamT <= 0) P.stam = Math.min(100, P.stam + dt * 10); }
  // catching rain
  if (wxRaining() && container() && !P.safe) {
    rainCatchT += dt;
    if (rainCatchT > SURV.rainCatch) { rainCatchT = 0; if (cnt('water_rain') < SURV.rainCap) { give('water_rain', 1); toast('+1 rainwater · your pot caught the rain', 1.8); } }
  }
}
/* old saves: stretch the gear they already carry to the new, longer durability (once) */
function survLoad() {
  if ((G.flags.durK || 1) >= DUR_K) return;
  const k0 = G.flags.durK || 1;
  for (const t of INV.tools) { const D = GEAR_DEFS[t.id]; if (!D || D.dur >= 999) continue; const max = Math.round(D.dur * QUAL[t.q ?? 1].k); if (max > t.max) { t.d = Math.min(max, Math.round(t.d * max / t.max)); t.max = max; } }
  G.flags.durK = DUR_K; void k0;
}
/* easy repairs: a repair kit restores fully anywhere; otherwise scrap (or sticks + fiber for primitive tools) patches it
   up to 60%, or all the way at a workbench or forge */
function repairCost(t) {
  const D = GEAR_DEFS[t.id]; if (!D || t.d >= t.max) return null;
  if (cnt('repair_kit')) return { l: 'Repair · kit', need: [['repair_kit', 1]], full: true };
  const atBench = nearStation('bench') || nearStation('forge');
  if ((D.t || 1) <= 1 && cnt('stick') >= 1 && cnt('fiber') >= 2) return { l: `Repair · stick + 2 fiber${atBench ? '' : ' (60%)'}`, need: [['stick', 1], ['fiber', 2]], full: atBench };
  const sc = 1 + (D.t || 1);
  if (INV.scrap >= sc) return { l: `Repair · ${sc} scrap${atBench ? '' : ' (60%)'}`, need: [['scrap', sc]], full: atBench };
  return null;
}
const repairLabel = t => repairCost(t)?.l || null;
function repairGear(t) {
  const c = t && repairCost(t); if (!c) { sfx('no'); toast('Need a repair kit, scrap, or a stick and fiber'); return; }
  for (const [id, n] of c.need) { if (id === 'scrap') INV.scrap -= n; else take(id, n); }
  t.d = c.full ? t.max : Math.max(t.d, Math.min(t.max, Math.round(t.max * .6))); t.warned = 0;
  sfx('buy'); toast(`${GEAR_DEFS[t.id].n} repaired${c.full ? '' : ' to 60% · a workbench fixes it fully'}`, 2.2); save();
}
