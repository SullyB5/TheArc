
/* ================= the story: missions (Nov 11, Parts 6–7 of the overhaul) =================
   Season 1 — Days 1–100, "The Ground": fifteen main missions, one after another, each opening when the last is done
   (and, for some, when enough days have passed). The world stays open the whole time: the day clock never waits, and
   you can wander off between steps for as long as you like.
   · MISSIONS: id, title, who gives it, when it opens, what they say, its steps (each: the objective text, where it is on
     the map, how it's done, and anything that has to appear in the world for it), the reward, and what changes after.
   · G.flags.ms = { cur, st, done: { id: day }, ... }. Steps are checked every half second, so anything you already did
     (killed Garrun, powered the Hesper generator…) counts straight away.
   · the objective line in the HUD and the marker on the map follow the current step (`msText`, `msAt`); with no mission
     running they fall back to the old tier goals. Bag → Journal lists the mission, its steps, and what's done. */

for (const [id, n] of [['pump_valve', 'Pump valve'], ['war_map', 'Thornkin war-map'], ['kvrn_tx', 'KVRN transmitter'], ['war_plans', 'Garrun’s war plans'], ['fever_med', 'Fever medicine']]) if (!ITEMS[id]) ITEMS[id] = { id, n, c: 'story', t: 1, src: 'story', w: .3 };
Object.assign(LORE, { pump_valve: 'From the Millbrook pump house. Juno needs it for the well.', war_map: 'Thornkin marks for every camp and hold in the hills.', kvrn_tx: 'The transmitter out of KVRN. Wire it into the Arc’s radio desk.', war_plans: 'Clan marks, Ironjaw scrawl and a Greyhold stamp — all on one page.' });
Object.assign(LOGS, {
  ms_pod: { at: 'The Pod', kind: 'note', t: 'Scratched into the hatch', by: 'Mina', b: 'MINA + TEO WERE HERE · GOING UP THE RIDGE TO SIGNAL THE ARC · DAY 2' },
  ms_teo: { at: 'Kestrel Ridge', kind: 'note', t: 'In Teo’s pocket', by: 'Teo', b: 'Mina went down the far side to find water. She said there was a cave. I told her to wait for me. My leg won’t hold me any more. If you’re from Kestrel — she’s in the cave. Go get her.' },
});
const SPEAK_C = { Juno: '#e88a8a', Kade: '#7fc4b8', Rook: '#d8b070', Mina: '#c0a0e0', Farlight: '#9ad06a' };

const MS = () => G.flags.ms ||= { cur: null, st: 0, done: {}, wait: 0 };
const msNear = (p, r) => p && Math.hypot(P.x - p.x, P.z - p.z) < r && !UG.at;
const clinic = () => (SHOP.med && (SHOP.med.front || SHOP.med.spot)) || { x: 0, z: 30 };
const kadeAt = () => (named.kade && !named.kade.dead) ? { x: named.kade.x, z: named.kade.z } : (SHOP.craft && SHOP.craft.spot) || { x: 0, z: 0 };
const junoAt = () => (named.juno && !named.juno.dead) ? { x: named.juno.x, z: named.juno.z } : clinic();
const depotsBurned = () => FAC_IDS.filter(f => facS(f).depot > 0).length;
const XS = id => XSITES[id];

const MISSIONS = [
  { id: 'land', t: 'Down to Earth', by: 'Radio', open: () => true,
    intro: [['Radio', '…anyone from the drop, this is Kestrel. Search what came down with you, then follow the old road north-east. We’ve got a wall.']],
    steps: [
      { txt: 'Search the wreck at the dropsite', at: () => POI.dropsite, done: () => !!(G.flags.caches || {}).drop_locker || G.flags.reached },
      { txt: 'Follow the old road north-east to Kestrel', at: () => ({ x: 0, z: 70 }), done: () => !!G.flags.reached },
    ], reward: () => {}, rt: 'You made it in.' },
  { id: 'missing', t: 'Missing', by: 'Juno', open: () => G.day >= 2,
    intro: [['Juno', 'Two from your drop never came in. Mina and Teo. Someone saw them heading for the pod east of here.'], ['Juno', 'Find them. Please.']],
    steps: [
      { txt: 'Search the escape pod east of Kestrel', at: () => POI.pod, done: () => !!(G.flags.logs || {}).ms_pod },
      { txt: 'Follow their trail up Kestrel Ridge', at: () => XS('summit'), done: () => !!(G.flags.logs || {}).ms_teo },
      { txt: 'Find Mina in Whisper Cave', at: () => XS('cave'), done: () => !!G.flags.minaFound },
    ], reward: () => { (setS().pending ||= []).push({ n: 'Mina', trait: 'brave' }); setS().morale += 6; give('binoculars', 1); }, rt: 'Mina will be in Kestrel by morning · binoculars',
    outro: [['Mina', 'Teo… he didn’t make it, did he. Thank you for coming. I’ll walk to Kestrel. I owe you.']] },
  { id: 'water', t: 'Clean Water', by: 'Juno', open: () => G.day >= 3,
    intro: [['Juno', 'Half the yard has the runs. The well’s gone bad.'], ['Juno', 'Millbrook, east of here, had a pump house. If the valve’s still in it I can rig a filter.']],
    steps: [
      { txt: 'Take the pump valve from Millbrook’s well', at: () => XS('millbrook'), done: () => cnt('pump_valve') > 0 || !!G.flags.wellFixed },
      { txt: 'Bring the valve to Juno at the clinic', at: () => clinic(), done: () => !!G.flags.wellFixed, use: { at: () => clinic(), r: 4, label: 'Give Juno the pump valve', need: 'pump_valve', act: () => { take('pump_valve', 1); G.flags.wellFixed = G.day; } } },
    ], reward: () => { give('water_filtered', 4); setS().morale += 5; }, rt: 'Kestrel’s well runs clean · 4 water into the stores every morning',
    outro: [['Juno', 'Clean water. You have no idea how good that sounds.']] },
  { id: 'hostile', t: 'Hostile Ground', by: 'Kade', open: () => G.day >= 5,
    intro: [['Kade', 'The painted ones keep an outpost west of here. They watch us. I want to know what they’re watching for.'], ['Kade', 'Get close. If there’s a map in that camp, bring it.']],
    steps: [
      { txt: 'Scout the Thorn outpost to the west', at: () => POI.village, done: () => Math.hypot(P.x - POI.village.x, P.z - POI.village.z) < 70 || cnt('war_map') > 0 },
      { txt: 'Take the Thornkin war-map from the outpost', at: () => POI.village, done: () => cnt('war_map') > 0 || !!(MS().done.hostile) },
    ], reward: () => { for (const id of ['ashmere', 'varnhold', 'sunscar', 'elderhollow']) (G.flags.seen ||= {})[id] = 1; facS('pines').met = facS('ridge').met = facS('root').met = 1; }, rt: 'Every clan hold is on your map',
    outro: [['Kade', 'Four clans, not one. And this one — Elderhollow — has no war marks at all.']] },
  { id: 'contact', t: 'First Contact', by: 'Kade', open: () => true,
    intro: [['Kade', 'The Rootkin at Elderhollow have never raided us. Go under the white flag. Talk. Trade. Anything but shoot.']],
    steps: [
      { txt: 'Go to Elderhollow and raise the white flag', at: () => PARLEY.find(q => q.f === 'root'), done: () => { const q = PARLEY.find(q => q.f === 'root'); return (q && Math.hypot(P.x - q.x, P.z - q.z) < 12) || facRep('root') >= 20; } },
      { txt: 'Earn the Rootkin’s trust — Friendly (gifts, a contract)', at: () => PARLEY.find(q => q.f === 'root'), done: () => facRep('root') >= 20 },
    ], reward: () => { give('herb_med', 3); setS().morale += 4; }, rt: 'The Rootkin will trade with you · 3 herbal medicine',
    outro: [['Radio', 'Elder Brann: Your people are strange, Kestrel. But you keep your word. Come and trade.']] },
  { id: 'signal', t: 'Signal', by: 'Rook', open: () => G.day >= 8,
    intro: [['Rook', 'Our radio barely reaches the wall. KVRN, on the south rim, had a real transmitter.'], ['Rook', 'Get it and I’ll wire it in. Then we hear them coming before they come.']],
    steps: [
      { txt: 'Take the transmitter from KVRN relay station', at: () => XS('kvrn'), done: () => cnt('kvrn_tx') > 0 || !!G.flags.longRadio },
      { txt: 'Wire it into the radio desk in the Arc (east wing)', at: () => ARC_RADIO, done: () => !!G.flags.longRadio, use: { at: () => ARC_RADIO, r: 3.2, label: 'Wire the KVRN transmitter into the desk', need: 'kvrn_tx', act: () => { take('kvrn_tx', 1); G.flags.longRadio = G.day; } } },
    ], reward: () => { facAdd('arc', 10); }, rt: 'The radio reaches every settlement · warnings at dusk of who’s raiding tonight',
    outro: [['Radio', 'Farlight: Kestrel? Loud and clear, for the first time. Welcome to the air.']] },
  { id: 'taken', t: 'Taken', by: 'Kade', open: () => G.day >= 12 && MS().done.signal,
    intro: [['Kade', 'They came over the north wall last night. Not to fight — to take people.'], ['Kade', 'Two of ours are tied up in Ashmere. Get them back however you can. Fight, sneak — or talk, if the Thornkin will listen.']],
    start: () => takeCaptives(),
    steps: [{ txt: 'Free Kestrel’s people held in Ashmere (cut them loose, or trade for them at the white flag)', at: () => POI.ashmere, done: () => !(setS().ros || []).some(R => R.held) }],
    reward: () => { setS().morale += 8; }, rt: 'They’re home', outro: [['Juno', 'Rope burns and bruises. They’ll live. Thank you.']] },
  { id: 'below', t: 'What’s Below', by: 'Kade', open: () => G.day >= 15,
    intro: [['Kade', 'Old Rourke’s map — Fort Hesper. An army post, with a bunker under it, and an armory in the bunker.'], ['Kade', 'Ironjaw are sitting on top of it and can’t get in. Beat them to it.']],
    start: () => { (G.flags.xmark ||= {}).hesper_map = 1; },
    steps: [
      { txt: 'Get into the bunker under Fort Hesper', at: () => XS('hesper'), done: () => !!(G.flags.pkseen || {}).hesper },
      { txt: 'Bring the bunker’s generator back (it needs a fuse)', at: () => XS('hesper'), done: () => !!(G.flags.xp || {}).hesper },
      { txt: 'Open the armory', at: () => XS('hesper'), done: () => !!(G.flags.caches || {}).x_hesper_armory },
    ], reward: () => { INV.res += 60; setS().morale += 4; }, rt: '+60 rifle rounds from the Guard’s stock', outro: [['Kade', 'Army rifles. Real ones. Now we’re a garrison.']] },
  { id: 'fever', t: 'The Fever', by: 'Juno', open: () => G.day >= 22,
    intro: [['Juno', 'It started with Tam and now it’s six of them. Fever, a rash, red in the eyes — it isn’t the water.'], ['Juno', 'There was a lab out east, Brightwater. If they made anything, it’s medicine. Two lots of antibiotics, or Rust medicine.']],
    start: () => { setS().fever = 1; },
    steps: [
      { txt: 'Find medicine at the Brightwater lab (2 antibiotics or 1 Rust medicine)', at: () => XS('bright'), done: () => cnt('antibiotic') >= 2 || cnt('rust_med') >= 1 || !setS().fever },
      { txt: 'Bring the medicine to Juno', at: () => clinic(), done: () => !setS().fever, use: { at: () => clinic(), r: 4, label: 'Give Juno the medicine', need: () => cnt('rust_med') >= 1 ? 'rust_med' : cnt('antibiotic') >= 2 ? 'antibiotic' : null, act: () => { if (cnt('rust_med') >= 1) take('rust_med', 1); else take('antibiotic', 2); setS().fever = 0; } } },
    ], reward: () => { setS().morale += 8; }, rt: 'The fever breaks', outro: [['Juno', 'Brightwater made this? Then Brightwater knew the fog was coming. I don’t like that at all.']] },
  { id: 'plans', t: 'War Plans', by: 'Kade', open: () => G.day >= 32,
    intro: [['Kade', 'The clans have stopped raiding each other. That has never happened.'], ['Kade', 'Garrun keeps his plans in the longhouse at Ashmere. I need to see them.']],
    steps: [
      { txt: 'Get into Ashmere’s longhouse and take Garrun’s war plans', at: () => POI.ashmere, done: () => cnt('war_plans') > 0 || !!G.flags.knowCoalition },
      { txt: 'Bring the plans to Kade', at: () => kadeAt(), done: () => !!G.flags.knowCoalition, use: { at: () => kadeAt(), r: 4, label: 'Show Kade the war plans', need: 'war_plans', act: () => { take('war_plans', 1); G.flags.knowCoalition = G.day; } } },
    ], reward: () => {}, rt: 'Now you know what’s coming',
    outro: [['Kade', 'Thornkin, Ironjaw — and that’s a Greyhold stamp. All of them, on the hundredth night.'], ['Kade', 'Every clan we turn, every depot we burn, is fewer of them at the wall. Get to work.']] },
  { id: 'peace', t: 'Peace or Blood', by: 'Kade', open: () => true,
    intro: [['Kade', 'Turn one of the clans. A ceasefire, an alliance — anything that keeps their spears off our wall.'], ['Kade', 'Or cut the head off the Thornkin. Garrun dead buys us the same.']],
    steps: [{ txt: 'Make peace with a clan (Thornkin, Hollow Pines or Ridge Runners) — or kill Garrun', at: () => PARLEY.find(q => q.f === 'thorn'), done: () => ['thorn', 'pines', 'ridge'].some(f => !facHostile(f)) || facS('thorn').lead > 0 }],
    reward: () => { setS().morale += 5; }, rt: 'One less enemy at the wall' },
  { id: 'line', t: 'Cut the Line', by: 'Rook', open: () => G.day >= 45,
    intro: [['Rook', 'An army walks on its stomach. Burn their stores and they come to Night 100 hungry.'], ['Rook', 'Fuel, a molotov, a grenade — any of it lights a depot.']],
    steps: [{ txt: 'Burn two supply depots', at: () => { const D = DEPOTS.find(d => d.g.visible && facHostile(d.f)); return D || null; }, done: () => depotsBurned() >= 2 }],
    reward: () => { give('molotov', 2); }, rt: '2 molotovs' },
  { id: 'dig', t: 'Dig In', by: 'Kade', open: () => G.day >= 60,
    intro: [['Kade', 'Forty days. Then everybody comes at once. Walls, people on them, and somewhere to fall back to.']],
    steps: [
      { txt: 'Finish two settlement projects (bag → Settlement)', at: () => null, done: () => Object.values(setS().proj).filter(p => p.done).length >= 2 },
      { txt: 'Put three people on watch (guard job)', at: () => null, done: () => setS().ros.filter(R => R.job === 'guard').length >= 3 },
      { txt: 'Have Kade raise the wall at least once', at: () => kadeAt(), done: () => UP.wall >= 1 },
    ], reward: () => { setS().morale += 6; }, rt: 'Kestrel is ready — as ready as it gets' },
  { id: 'gather', t: 'The Gathering', by: 'Farlight', open: () => G.day >= 90,
    intro: [['Farlight', 'Kestrel, they’re camped on the west rim. Hundreds. You should see it with your own eyes.']],
    steps: [{ txt: 'See the war camp on the west rim for yourself', at: () => WARCAMP, done: () => msNear(WARCAMP, 110) }],
    reward: () => {}, rt: 'Ten nights. Maybe fewer.', outro: [['Kade', 'You saw it. Good. Now everyone else needs to stop pretending.']] },
  { id: 'night100', t: 'The Hundredth Night', by: 'Kade', open: () => G.day >= 97,
    intro: [['Kade', 'This is it. When the horn goes, everyone does their job. If the wall goes, we fall back to the Arc.']],
    steps: [{ txt: 'Hold Kestrel through Night 100', at: () => null, done: () => !!G.flags.held100 || !!G.flags.fell100 }],
    reward: () => {}, rt: '' },
  { id: 'after', t: 'Aftermath', by: 'Kade', open: () => !!(G.flags.held100 || G.flags.fell100),
    intro: [['Kade', 'We’re still here. That’s more than they wanted.'], ['Juno', 'Kade… we’re short. More than the ones they dragged off. People went missing in the night — after it was over.']],
    start: () => vanish(),
    steps: [
      { txt: 'Clear and rebuild the burned buildings', at: () => { const id = (G.flags.burnt || [])[0]; return id && SHOP[id] ? SHOP[id].front : null; }, done: () => !(G.flags.burnt || []).length },
      { txt: 'Look at what was left by the gate', at: () => CLUE, done: () => !!(G.flags.logs || {}).ms_syringe },
      { txt: 'Tell Kade who’s missing', at: () => kadeAt(), done: () => !!G.flags.s2, use: { at: () => kadeAt(), r: 4, label: 'Tell Kade who’s missing', need: true, act: () => { G.flags.s2 = G.day; } } },
    ], reward: () => {}, rt: '',
    outro: [['Kade', 'A Greyhold needle. Footprints that walk straight into the fog and don’t come out.'], ['Kade', 'They’re in the mountain. Whatever Greyhold is — whatever’s under that grey door — that’s where our people are.']] },
];
const MSI = Object.fromEntries(MISSIONS.map((m, i) => [m.id, i]));

/* ---------- things the missions put in the world ---------- */
let WARCAMP = null, MINA = null, CLUE = null;
const CAPTIVES = [];
function buildStoryWorld() {
  // the pod: a note on the hatch
  { const p = POI.pod; xNote(world, 'ms_pod', p.x + 2.5, heightAt(p.x + 2.5, p.z + 1) + .1, p.z + 1, 0); }
  // Teo, near the top of the ridge
  { const S = XS('summit'), x = S.x + 8, z = S.z + 6, y = heightAt(x, z); const pp = makePerson('arc', {}); pp.g.position.set(x, y + .15, z); pp.g.rotation.set(-Math.PI / 2, 0, .4); if (pp.weapon) pp.weapon.visible = false; world.add(pp.g); xNote(world, 'ms_teo', x + .8, y + .05, z - .4, 0); }
  // Mina, hurt, in the cave's painted hall
  { const pk = POCKETS.cave, x = pk.ox - 3.6, z = pk.oz + 21.5; MINA = makePerson('arc', {}); MINA.g.position.set(x, pk.y, z); MINA.g.rotation.y = 2.4; if (MINA.weapon) MINA.weapon.visible = false; pk.g.add(MINA.g); xSolid(pk, -4.2, 20.9, -3, 22.1);
    xUse({ x, y: pk.y, z, r: 2.2, pocket: pk, label: () => G.flags.minaFound ? null : msStepIs('missing', 2) ? 'Help Mina up' : 'A girl in an Arc jumpsuit, shivering', act: () => { if (!msStepIs('missing', 2)) { say([['Mina', 'Are you… from the Arc? Teo’s up on the ridge. Please.']]); return; } G.flags.minaFound = G.day; MINA.g.visible = false; save(); } }); }
  // Millbrook's pump valve, the KVRN transmitter, the war-map at the Thorn outpost, Garrun's plans in Ashmere
  const grab = (x, z, item, mid, step, label) => xUse({ x, z, r: 2.4, pocket: null, label: () => cnt(item) || (MS().done[mid]) || !msStepIs(mid, step) ? null : label, act: () => startChan({ l: label.split(' ·')[0], t: 1.6, fn: () => { give(item, 1); sfx('pickup'); toast(`+ ${nameOf(item)}`, 2.4); save(); } }) });
  { const W = XS('millbrook').well; grab(W.x, W.z, 'pump_valve', 'water', 0, 'Unbolt the pump valve from the well'); }
  { const S = XS('kvrn'), yaw = Math.atan2(-S.x, -S.z), [x, z] = xFrame(S.x, S.z, yaw)(-2, -2.6); grab(x, z, 'kvrn_tx', 'signal', 0, 'Pull the transmitter out of the desk'); }
  { const p = POI.village; const g = new THREE.Group(); mesh(new THREE.BoxGeometry(1.2, .8, .7), M(0x6a5038), 0, .4, 0, g); const mp = mesh(new THREE.PlaneGeometry(.8, .55), new THREE.MeshLambertMaterial({ color: 0xc8b088, side: THREE.DoubleSide }), 0, .81, 0, g); mp.rotation.x = -Math.PI / 2; g.position.set(p.x + 3, heightAt(p.x + 3, p.z - 2), p.z - 2); world.add(g); addCol(p.x + 3, p.z - 2, .6); grab(p.x + 3, p.z - 2, 'war_map', 'hostile', 1, 'Take the war-map'); }
  { const A = POI.ashmere, gateA = Math.atan2(-A.z, -A.x), [x, z] = xFrame(A.x - 12, A.z, Math.PI / 2 + gateA)(0, -6); grab(x, z, 'war_plans', 'plans', 0, 'Take Garrun’s war plans from the chest'); const c = new THREE.Group(); mesh(new THREE.BoxGeometry(1, .6, .6), M(0x4a3626), 0, .3, 0, c); c.position.set(x, heightAt(x, z), z); world.add(c); }
  // the clue at the gate after Night 100: a spent syringe with a Greyhold stamp, bootprints into the trees
  { const x = 4.5, z = CAMP_R + 7, y = heightAt(x, z); CLUE = { x, z }; const g = new THREE.Group(); g.visible = false; world.add(g); g.userData.dyn = 1; CLUE.g = g;
    mesh(new THREE.CylinderGeometry(.02, .02, .18, 6), new THREE.MeshBasicMaterial({ color: 0xd8f0ff }), x, y + .03, z, g).rotation.z = Math.PI / 2;
    for (let i = 0; i < 10; i++) { const fp = mesh(new THREE.PlaneGeometry(.14, .3), new THREE.MeshLambertMaterial({ color: 0x2a221a, transparent: true, opacity: .6, depthWrite: false }), x + i * .5 + (i % 2) * .25, 0, z + i * 1.1, g); fp.position.y = heightAt(fp.position.x, fp.position.z) + .03; fp.rotation.x = -Math.PI / 2; }
    LOGS.ms_syringe = { at: 'Kestrel’s gate', kind: 'note', t: 'A spent syringe', by: 'Greyhold', b: 'A steel syringe, empty, stamped with the Greyhold mark. Beside it, bootprints — heavy, all the same tread — walking north-west into the trees, toward the grey mountain. Three sets go out. None come back.' };
    xNote(g, 'ms_syringe', x - .4, y + .02, z, 0); }
  // the war camp on the west rim (only there from day 88)
  { const s = xFind({ tx: -VALLEY - 170, tz: 60, r: 40, sl: .3 }, [], xAvoid()); WARCAMP = { x: s.x, z: s.z }; const g = new THREE.Group(); g.visible = false; world.add(g); g.userData.dyn = 1; WARCAMP.g = g;
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, r = rr(6, 40), x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; const t = mesh(new THREE.ConeGeometry(rr(1.8, 2.6), rr(3.2, 4.4), 8), M(pick([0x7a5a3e, 0x6a4a32, 0x5a6248, 0x8a6a48])), x, heightAt(x, z) + 1.8, z, g); }
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = rr(4, 30), x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, f = new THREE.Mesh(new THREE.ConeGeometry(.9, 2.4, 7), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); f.position.set(x, heightAt(x, z) + 1.1, z); g.add(f); }
    for (const f of ['thorn', 'pines', 'ridge', 'iron', 'grey']) { const a = rnd() * 6.28, x = s.x + Math.cos(a) * 14, z = s.z + Math.sin(a) * 14; const b = new THREE.Group(); mesh(new THREE.CylinderGeometry(.08, .1, 6, 6), M(0x3a2a1a), 0, 3, 0, b); mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshLambertMaterial({ color: FAC[f].c, side: THREE.DoubleSide }), .8, 5.3, 0, b); b.position.set(x, heightAt(x, z), z); g.add(b); }
    for (let i = 0; i < 3; i++) SMOKES.push({ x: s.x + rr(-20, 20), z: s.z + rr(-20, 20), y: heightAt(s.x, s.z) + 2, k: rnd() }); }
}
// the captives for "Taken"
function takeCaptives(restoring) {
  const S = setS(); let held = S.ros.filter(R => R.held);
  if (!held.length && !restoring) { const pool = S.ros.filter(R => R.origin === 'kestrel' && survEnt(R)); held = pool.slice(0, 2); for (const R of held) R.held = 'thorn'; }
  for (const C of CAPTIVES) { world.remove(C.g); const i = PRISONERS.indexOf(C); if (i >= 0) PRISONERS.splice(i, 1); } CAPTIVES.length = 0;
  held.forEach((R, k) => {
    const e = SROS[R.id]; if (e) e.g.visible = false;
    const s = capitalSpot('thorn', .1, (k ? -1 : 1) * 4); if (!s) return;
    const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(.1, .12, 2.4, 6), M(0x4a3a2a), 0, 1.2, -.25, g); const pp = makePerson('arc', {}); if (pp.weapon) pp.weapon.visible = false; g.add(pp.g);
    for (let j = 0; j < 3; j++) { const r = mesh(new THREE.TorusGeometry(.26, .025, 4, 12), M(0x8a7a5a), 0, .7 + j * .35, -.1, g); r.rotation.x = Math.PI / 2; }
    g.position.set(s.x, heightAt(s.x, s.z), s.z); g.rotation.y = -s.a + Math.PI; world.add(g); addCol(s.x, s.z, .4);
    const Pr = { id: 'pr_story_' + R.id, holder: 'thorn', of: 'kestrel', name: R.n, x: s.x, z: s.z, g, sid: R.id }; PRISONERS.push(Pr); CAPTIVES.push(Pr);
  });
}
function storyFreed(Pr) { const R = setS().ros.find(x => x.id === Pr.sid); if (R) { R.held = 0; const e = SROS[R.id]; if (e) { e.g.visible = true; e.x = rr(-2, 2); e.z = CAMP_R - 3; } } Pr.g.visible = false; }

/* ---------- running the missions ---------- */
const msCur = () => { const M2 = MS(); return M2.cur ? MISSIONS[MSI[M2.cur]] : null; };
const msStepIs = (id, st) => { const M2 = MS(); return M2.cur === id && M2.st === st; };
function msText() { const m = msCur(); if (!m) return null; const s = m.steps[MS().st]; return s ? `${m.t}: ${s.txt}` : null; }
function msAt() { const m = msCur(); if (!m) return null; const s = m.steps[MS().st]; const a = s && s.at && s.at(); return a ? { x: a.x, z: a.z } : null; }
function msStart(m, quiet) {
  const M2 = MS(); M2.cur = m.id; M2.st = 0;
  if (!quiet) { card('MISSION · ' + m.t.toUpperCase(), m.steps[0].txt, 4); if (m.intro) say(m.intro.map(([w, l]) => [w === 'Farlight' ? 'Radio' : w, w === 'Farlight' ? 'Farlight: ' + l : l])); }
  if (m.start) m.start();
  save();
}
function msFinish(m) {
  const M2 = MS(); M2.done[m.id] = G.day; M2.cur = null; M2.st = 0; M2.wait = 25;
  if (m.reward) m.reward();
  card('MISSION COMPLETE', m.t + (m.rt ? ' · ' + m.rt : ''), 4.2); sfx('buy');
  if (m.outro) setTimeout(() => say(m.outro), 1800);
  if (m.id === 'after') setTimeout(() => card('SEASON 2 · THE MOUNTAIN', 'Days 101–200 · find the missing', 6), 9000);
  save();
}
let msT = 0, msWarnDay = -1, msWellDay = -1;
function updStory(dt) {
  if (G.mode !== 'play' || cine) return;
  msT -= dt; if (msT > 0) return; msT = .5;
  storyTick();
  const M2 = MS();
  if (WARCAMP) WARCAMP.g.visible = G.day >= 88 && !G.flags.held100 && !G.flags.fell100;
  if (CLUE) CLUE.g.visible = !!(M2.done.night100 || M2.cur === 'after');
  // the next mission, after a short breath
  if (!M2.cur) {
    if ((M2.wait = (M2.wait || 0) - .5) > 0 || night.active) return;
    const m = MISSIONS.find((x, i) => !M2.done[x.id] && MISSIONS.slice(0, i).every(y => M2.done[y.id]) && x.open());
    if (m && m.id === 'land' && G.flags.reached) { M2.done.land = G.day; return; }
    if (m) msStart(m, m.id === 'land');
    return;
  }
  const m = msCur(); if (!m) { M2.cur = null; return; }
  // steps already done fall straight through
  let guard = 0; while (M2.st < m.steps.length && m.steps[M2.st].done() && guard++ < 10) { M2.st++; if (M2.st < m.steps.length) { toast(`${m.t} · ${m.steps[M2.st].txt}`, 3.4); save(); } }
  if (M2.st >= m.steps.length) msFinish(m);
}
// daily touches: the well, the dusk warning on the long radio
function storyTick() {
  if (G.flags.wellFixed && msWellDay !== G.day) { msWellDay = G.day; sAdd('water_filtered', 4); }
  if (G.flags.longRadio && G.tod > .7 && G.tod < .78 && msWarnDay !== G.day && !night.active) {
    msWarnDay = G.day; const W = facRaidWeights(), who = Object.keys(W).filter(f => W[f] > 0).map(f => FAC[f].n);
    say([['Radio', who.length ? `Farlight: Heads up, Kestrel — ${who.join(', ')} moving your way tonight.` : 'Farlight: Quiet on every channel tonight, Kestrel. Enjoy it.']]);
  }
}
// mission hand-ins at a person or place
const STINTERACT = [
  { id: 'msuse', at: () => { const m = msCur(); const s = m && m.steps[MS().st]; if (!s || !s.use) return null; const need = typeof s.use.need === 'function' ? s.use.need() : s.use.need; if (need !== true && (!need || !cnt(need))) return null; return s.use.at(); }, r: 4,
    label: () => msCur().steps[MS().st].use.label, act: () => { const s = msCur().steps[MS().st]; s.use.act(); sfx('buy'); save(); } },
];
function missionsHTML() {
  const M2 = MS(), m = msCur();
  let h = '<h4>Missions</h4><div class="jn">';
  if (m) { h += `<div style="padding:8px 10px;border:1px solid #f0a64066;border-left:4px solid #f0a640;border-radius:3px;background:#0002"><b>${m.t}</b> <small style="opacity:.7">from ${m.by}</small>`;
    m.steps.forEach((s, i) => { h += `<div style="opacity:${i < M2.st ? .5 : i === M2.st ? 1 : .35}"><small>${i < M2.st ? '✓' : i === M2.st ? '◆' : '·'} ${s.txt}</small></div>`; }); h += '</div>'; }
  else { const nx = MISSIONS.find(x => !M2.done[x.id]); h += `<p class="dim">${nx ? 'Nothing right now — the next job will come to you.' : 'Season 1 is done.'}</p>`; }
  const done = MISSIONS.filter(x => M2.done[x.id]); if (done.length) h += `<p class="pl"><small>Done: ${done.map(x => x.t).join(' · ')}</small></p>`;
  return h + '</div>';
}
function buildStory() { const s0 = seed; seed = 6060606; for (const k in SPEAK_C) if (!SPEAKERS[k]) SPEAKERS[k] = SPEAK_C[k]; buildStoryWorld(); window.__M = { MISSIONS, MS, msStart, msFinish, updStory, get WARCAMP() { return WARCAMP; }, takeCaptives, msText }; seed = s0; }
// the ones who vanished after Night 100
function vanish() {
  const S = setS(); if (S.vanished) return; S.vanished = G.day; const pool = S.ros.filter(R => !R.held && survEnt(R)); const gone = [];
  for (let i = 0; i < 2 && pool.length > 3; i++) { const R = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; const e = SROS[R.id]; if (e) { e.dead = true; removeEnt(e); } S.ros.splice(S.ros.indexOf(R), 1); (S.missing ||= []).push({ n: R.n, id: R.id, day: G.day, by: 'grey' }); gone.push(R.n); }
  if (gone.length) setTimeout(() => card(`${gone.length === 2 ? 'TWO' : 'ONE'} MORE MISSING`, `${gone.join(' and ')} — gone in the night`, 4.5), 4000);
  save();
}
function storyRestore() { const M2 = MS(); if (CLUE) CLUE.g.visible = !!(MS().done.night100 || M2.cur === 'after'); if (MINA) MINA.g.visible = !G.flags.minaFound; if (setS().ros.some(R => R.held)) takeCaptives(true); else takeCaptives(true); msWellDay = G.day; }
