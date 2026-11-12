import asyncio, http.server, threading, functools, json
from playwright.async_api import async_playwright
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8310), functools.partial(Q, directory='.')); threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': 960, 'height': 540})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('console', lambda m: errs.append('C:' + m.text[:200]) if m.type == 'error' and 'Failed to load' not in m.text else None)
        await pg.goto('http://127.0.0.1:8310/index.html?bench=1&stats'); await pg.wait_for_selector('#bNew', timeout=600000)
        await pg.evaluate("document.getElementById('bNew').click()"); await pg.wait_for_timeout(3000)
        ev = lambda js: pg.evaluate(f"() => __FIN.ev({json.dumps(js)})")
        await ev("P.x = 3; P.z = 40; P.y = heightAt(3, 40); P.yaw = 0; give('frag', 3); give('throw_spear', 2)")
        await pg.wait_for_timeout(2000)
        for i in range(4): await ev("input.fire = true"); await pg.wait_for_timeout(400); await ev("input.fire = false"); await pg.wait_for_timeout(300)
        await ev("P.thr = 'frag'; throwNext()"); await pg.wait_for_timeout(3000)
        await ev("P.thr = 'throw_spear'; throwNext()"); await pg.wait_for_timeout(2500)
        print('after combat', await ev("({ parts: parts.length, proj: PROJ.length, pool: Object.fromEntries(Object.entries(PROJ_POOL).map(([k, v]) => [k, v.length])), tracersOn: tracers.filter(t => t.on).length, voices: VOICES })"))
        print('snap', await pg.evaluate('__perf.snap()'))
        await pg.screenshot(path='func-stats.png')
        # underground and back
        await ev("xGoNow(POCKETS.cellar, POCKETS.cellar.spawn || { x: POCKETS.cellar.ox, z: POCKETS.cellar.oz, y: UG_Y + 1 })"); await pg.wait_for_timeout(3000)
        print('underground', await ev("({ under: IN_POCKET, chunksVis: [...CHUNKS.values()].filter(m => m.visible).length })"), await pg.evaluate('__perf.snap()'))
        await ev("xGoNow(null, { x: 3, z: 40 })"); await pg.wait_for_timeout(3000)
        print('back up', await ev("({ under: IN_POCKET, chunksVis: [...CHUNKS.values()].filter(m => m.visible).length })"), await pg.evaluate('__perf.snap()'))
        # presets (perf keeps PC textures? perf pc tex = med -> would reload; use applyPreset without tex/view to test live knobs)
        for k in ['perf', 'bal', 'qual']:
            r = await ev(f"(applyPreset('{k}', false), {{ pq: PQ, shadow: sun.shadow.mapSize.x, bloom: bloom.enabled, pr: renderer.getPixelRatio() }})"); await pg.wait_for_timeout(1500)
            print(k, json.dumps(r)[:220])
        await ev("openGfx()"); await pg.wait_for_timeout(800); await pg.screenshot(path='func-settings.png')
        print('ERRORS', errs[:10])
        await b.close()
asyncio.run(main())
