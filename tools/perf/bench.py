# The Arc perf bench: python3 bench.py <root> <port> <label> [pc|phone] [extra query]
# Needs: pip install playwright; a Chrome/Chromium (path below). WebGL runs on SwiftShader (CPU), so frame times are only
# comparable run-to-run on the same machine; draw calls, triangles and memory are exact.
import os; os.makedirs('shots', exist_ok=True)
# Boots the game in headless Chrome (SwiftShader), starts a new game and visits fixed camera spots.
# Records per spot: draw calls, triangles, geometries/textures/programs, estimated GPU memory, frame time; plus load time/bytes.
import asyncio, json, os, sys, time, subprocess, http.server, threading, functools
from playwright.async_api import async_playwright

ROOT, PORT, LABEL = sys.argv[1], int(sys.argv[2]), sys.argv[3]
MODE = sys.argv[4] if len(sys.argv) > 4 else 'pc'
EXTRA = sys.argv[5] if len(sys.argv) > 5 else ''

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

# name, x, z, look-at x, z, pitch (spots chosen to cover the opening, Kestrel, the Arc interior, forest, towns)
SPOTS = [
  ('dropsite', 'wake', None, None, None, 0),
  ('kestrel-gate', 3, 90, 0, 0, 0),
  ('kestrel-in', 3, 30, 0, -36, 0),
  ('kestrel-east', 40, 10, -40, 0, 0),
  ('arc-inside', 0, -36, 20, -36, 0),
  ('forest', 150, 60, 250, 60, 0),
  ('halvard', 420, 260, 480, 300, 0),
  ('high-view', 0, 140, 0, 0, -.12),
]

JS_STATS = r"""
() => new Promise(res => {
  const T = window.__T, r = T.renderer, sc = T.scene;
  requestAnimationFrame(() => { r.info.autoReset = false; r.info.reset();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const R = r.info.render, M = r.info.memory;
      const o = { calls: Math.round(R.calls / 2), tris: Math.round(R.triangles / 2), geos: M.geometries, tex: M.textures, progs: (r.info.programs || []).length };   // average of two frames (the shadow map redraws every other frame)
      r.info.autoReset = true;
      // GPU memory estimate: every texture and geometry reachable from the scene (uploaded ones are what count; this is an upper bound)
      const seenT = new Set(), seenG = new Set(); let tb = 0, gb = 0;
      const bpp = t => { if (!t.isCompressedTexture) return 4; const f = t.format; return (f >= 33776 && f <= 33779) ? (f === 33776 || f === 33777 ? .5 : 1) : 1; };
      sc.traverse(m => {
        if (m.geometry && !seenG.has(m.geometry)) { seenG.add(m.geometry); const g = m.geometry; for (const k in g.attributes) { const a = g.attributes[k]; gb += (a.array || (a.data && a.data.array) || { byteLength: 0 }).byteLength; } if (g.index) gb += g.index.array.byteLength; }
        if (m.isInstancedMesh) gb += m.instanceMatrix.array.byteLength;
        for (const mt of [].concat(m.material || [])) for (const k in mt) { const t = mt[k]; if (t && t.isTexture && !seenT.has(t)) { seenT.add(t);
          const im = t.image || {}; const w = (t.mipmaps && t.mipmaps[0] && t.mipmaps[0].width) || im.width || 0, h = (t.mipmaps && t.mipmaps[0] && t.mipmaps[0].height) || im.height || 0;
          const pp = r.properties.get(t); if (pp && pp.__webglInit) tb += w * h * bpp(t) * 1.33; } }
      });
      o.texMB = Math.round(tb / 1e6); o.geoMB = Math.round(gb / 1e6); o.nTex = seenT.size;
      o.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0;
      res(o);
    }));
  });
})
"""
JS_FRAMES = r"""
(n) => new Promise(res => { const ts = []; let last = performance.now();
  function f(now) { ts.push(now - last); last = now; if (ts.length < n) requestAnimationFrame(f); else { ts.shift(); ts.sort((a,b)=>a-b);
    res({ avg: +(ts.reduce((a,b)=>a+b,0)/ts.length).toFixed(1), p50: +ts[ts.length>>1].toFixed(1), p95: +ts[Math.floor(ts.length*.95)].toFixed(1) }); } }
  requestAnimationFrame(f); })
"""

async def main():
    out = { 'label': LABEL, 'mode': MODE, 'spots': {} }
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
        if MODE == 'phone':
            ctx = await b.new_context(viewport={'width': 640, 'height': 296}, device_scale_factor=1, is_mobile=True, has_touch=True,
                user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
        else:
            ctx = await b.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
        pg = await ctx.new_page()
        reqs = {}
        pg.on('requestfinished', lambda rq: reqs.__setitem__(rq.url, 1))
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('console', lambda m: errs.append('console:' + m.text[:200]) if m.type == 'error' else None)
        t0 = time.time()
        await pg.goto(f'http://127.0.0.1:{PORT}/index.html?bench=1{EXTRA}', wait_until='load')
        await pg.wait_for_selector('#bNew', timeout=600000)
        out['loadS'] = round(time.time() - t0, 1)
        nbytes = 0
        for u in reqs:
            if u.startswith(f'http://127.0.0.1:{PORT}/'):
                fp = os.path.join(ROOT, u.split(f':{PORT}/')[1].split('?')[0])
                if os.path.isfile(fp): nbytes += os.path.getsize(fp)
        out['loadMB'] = round(nbytes / 1e6, 1); out['nReq'] = len(reqs)
        out['menu'] = await pg.evaluate(JS_STATS)
        await pg.evaluate("document.getElementById('bNew').click()")
        await pg.wait_for_timeout(3000)
        for name, x, z, lx, lz, pitch in SPOTS:
            await pg.evaluate("""([x, z, lx, lz, pitch]) => { const P = __arc.P, T = __T;
              if (x === 'wake') { return; }
              P.x = x; P.z = z; P.vy = 0; P.y = Math.max(T.heightAt(x, z), T.floorAt ? T.floorAt(x, z, 999) : -1e9);
              P.yaw = Math.atan2(x - lx, z - lz); P.pitch = pitch; }""", [x, z, lx, lz, pitch])
            await pg.wait_for_timeout(2500)
            await pg.evaluate("([x, z, lx, lz, pitch]) => { if (x === 'wake') return; const P = __arc.P; P.yaw = Math.atan2(x - lx, z - lz); P.pitch = pitch; }", [x, z, lx, lz, pitch])
            s = await pg.evaluate(JS_STATS)
            s['frame'] = await pg.evaluate(JS_FRAMES, 12)
            s['pos'] = await pg.evaluate("[Math.round(__arc.P.x), Math.round(__arc.P.y), Math.round(__arc.P.z)]")
            out['spots'][name] = s
            print(name, json.dumps(s), flush=True)
            await pg.screenshot(path=f'shots/{LABEL}-{MODE}-{name}.png')
        # combat burst: an explosion + a volley of tracers 12 m ahead, measured the next frames
        await pg.evaluate("() => { const P = __arc.P; P.x = 3; P.z = 30; P.yaw = 0; P.pitch = 0; }")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("() => __FIN.ev('explode(P.x, P.y + 1, P.z - 12); for (let i = 0; i < 12; i++) tracer(new THREE.Vector3(P.x, P.y + 1.5, P.z), new THREE.Vector3(P.x + i - 6, P.y + 1, P.z - 30))')")
        s = await pg.evaluate(JS_STATS); out['spots']['explosion'] = s; print('explosion', json.dumps(s), flush=True)
        out['errors'] = errs[:20]
        await b.close()
    json.dump(out, open(f'{LABEL}-{MODE}.json', 'w'), indent=1)
    print('load', out['loadS'], 's', out['loadMB'], 'MB', out['nReq'], 'req; errors', len(errs))
    for e in errs[:8]: print('  ', e)

asyncio.run(main())
