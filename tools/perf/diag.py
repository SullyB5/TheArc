# where do the triangles go? python3 diag.py <root> <port> x z lx lz [extra query]
import asyncio, json, sys, http.server, threading, functools
from playwright.async_api import async_playwright
ROOT, PORT = sys.argv[1], int(sys.argv[2]); x, z, lx, lz = map(float, sys.argv[3:7]); EXTRA = sys.argv[7] if len(sys.argv) > 7 else ''
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
() => { const T = __T, THREE = T.THREE, cam = T.cam, sc = T.scene, sun = sc.children.find(o => o.isDirectionalLight);
  const fr = new THREE.Frustum(), m = new THREE.Matrix4(); cam.updateMatrixWorld(); m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(m);
  const sfr = new THREE.Frustum(); const sc2 = sun.shadow.camera; sc2.updateMatrixWorld(); m.multiplyMatrices(sc2.projectionMatrix, sc2.matrixWorldInverse); sfr.setFromProjectionMatrix(m);
  const rows = {}; const sph = new THREE.Sphere();
  const tag = o => { let p = o, path = []; while (p && p !== sc && path.length < 6) { path.push(p.name || (p.userData && p.userData.name) || p.type); p = p.parent; } return path.reverse().slice(-4).join('/'); };
  function walk(o, vis) { if (!o.visible) return; for (const c of o.children) walk(c, vis);
    if (!(o.isMesh || o.isLine || o.isPoints)) return; if (!(o.layers.mask & 1)) return;
    const g = o.geometry; let tri = (g.index ? g.index.count : g.attributes.position.count) / 3; if (g.drawRange && g.drawRange.count !== Infinity) tri = Math.min(tri, g.drawRange.count / 3);
    const n = o.isInstancedMesh ? o.count : 1; tri *= n;
    let inCam = true, inSh = o.castShadow;
    if (o.frustumCulled) { if (!g.boundingSphere) g.computeBoundingSphere(); if (o.isInstancedMesh && !o.boundingSphere) o.computeBoundingSphere(); sph.copy(o.isInstancedMesh ? o.boundingSphere : g.boundingSphere).applyMatrix4(o.matrixWorld); inCam = fr.intersectsSphere(sph); inSh = inSh && sfr.intersectsSphere(sph); }
    const mn = [].concat(o.material).map(x => x && x.name).join(','); const k = tag(o) + (o.isInstancedMesh ? ' [inst ' + o.count + ']' : '') + ' {' + mn + '} ' + Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    const r = rows[k] || (rows[k] = { cam: 0, sh: 0, n: 0, calls: 0 }); r.n++; if (inCam) { r.cam += tri; r.calls++; } if (inSh) r.sh += tri; }
  walk(sc, true);
  const L = Object.entries(rows).map(([k, r]) => [k, r]).sort((a, b) => (b[1].cam + b[1].sh) - (a[1].cam + a[1].sh));
  let tc = 0, ts = 0; for (const [, r] of L) { tc += r.cam; ts += r.sh; }
  return { totCam: Math.round(tc), totShadow: Math.round(ts), top: L.slice(0, 45).map(([k, r]) => `${Math.round(r.cam/1000)}k cam ${Math.round(r.sh/1000)}k sh  x${r.n} (${r.calls} calls)  ${k}`) };
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 640, 'height': 360})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: print('PAGEERROR', str(e)[:300]))
        pg.on('console', lambda m: print('CONSOLE', m.text[:300]) if m.type in ('error','warning') else None)
        await pg.goto(f'http://127.0.0.1:{PORT}/index.html?bench=1{EXTRA}'); await pg.wait_for_selector('#bNew', timeout=600000)
        await pg.evaluate("document.getElementById('bNew').click()"); await pg.wait_for_timeout(2000)
        await pg.evaluate("([x,z,lx,lz]) => { const P = __arc.P; P.x = x; P.z = z; P.y = __T.heightAt(x, z); P.yaw = Math.atan2(x - lx, z - lz); P.pitch = 0; }", [x, z, lx, lz])
        await pg.wait_for_timeout(6000)
        r = await pg.evaluate(JS)
        try: print('SNAP', await pg.evaluate('__perf.snap()'))
        except Exception as e: print('nosnap', e)
        print('cam tris', r['totCam'], 'shadow tris', r['totShadow'])
        for l in r['top']: print(' ', l)
        await b.close()
asyncio.run(main())
