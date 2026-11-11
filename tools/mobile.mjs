// Phone set builder: node mobile.mjs <inDir> <outDir> [--color 512] [--detail 256] [--tris 20000] [--skip regex] [--match regex] [--list file] [--force]
// Every .glb under inDir is rewritten into outDir (same relative path) with:
//   colour/emissive textures capped at --color px, normal/roughness/metal/AO at --detail px (WebP),
//   meshes over --tris triangles simplified toward that budget (vertices are only removed, so skin weights,
//   UVs and morph-free attributes stay valid), unused data pruned, then meshopt-compressed.
// The source files are never touched.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { textureCompress, simplify, weld, prune, dedup, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

const A = process.argv.slice(2); const inDir = A[0], outDir = A[1];
const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const COLOR = +opt('color', 512), DETAIL = +opt('detail', 256), TRIS = +opt('tris', 20000);
const SKIP = opt('skip', null) ? new RegExp(opt('skip')) : null;
const MATCH = opt('match', null) ? new RegExp(opt('match')) : null;
const LIST = opt('list', null) ? new Set(fs.readFileSync(opt('list'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) : null;
const FORCE = A.includes('--force');

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (path.resolve(p) !== path.resolve(outDir)) walk(p); } else if (p.endsWith('.glb')) files.push(p); } })(inDir);

const countTris = doc => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(), pos = p.getAttribute('POSITION'); if (pos) t += (i ? i.getCount() : pos.getCount()) / 3; } return Math.round(t); };
let inB = 0, outB = 0, n = 0;
for (const f of files) {
  const rel = path.relative(inDir, f);
  if (SKIP && SKIP.test(rel)) continue;
  if (LIST && !LIST.has(rel)) continue;
  if (MATCH && !MATCH.test(rel)) continue;
  const dst = path.join(outDir, rel);
  if (!FORCE && fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(f).mtimeMs) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    const doc = await io.read(f);
    const used = new Set(doc.getRoot().listExtensionsUsed().map(e => e.extensionName));
    const wasQ = used.has('KHR_mesh_quantization'), wasMO = used.has('EXT_meshopt_compression');
    const t0 = countTris(doc);
    // textures: colour first, then everything else at the detail cap
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [COLOR, COLOR], quality: 82, slots: /^(baseColorTexture|emissiveTexture|diffuseTexture)$/ }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [DETAIL, DETAIL], quality: 80, slots: /^(?!baseColorTexture$|emissiveTexture$|diffuseTexture$).*/ }),
    );
    let t1 = t0;
    if (t0 > TRIS) {
      // per-file ratio toward the budget, never below 25% of the original (keeps silhouettes)
      const ratio = Math.max(.25, TRIS / t0);
      await doc.transform(weld({}), simplify({ simplifier: MeshoptSimplifier, ratio, error: .004, lockBorder: true }));
      t1 = countTris(doc);
    }
    await doc.transform(dedup(), prune({ keepAttributes: true, keepLeaves: true, keepExtras: true }));
    // keep the file's own encoding (code reads some attributes raw): quantized stays quantized, float stays float
    if (wasQ) await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
    if (wasMO) doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: wasQ ? EXTMeshoptCompression.EncoderMethod.QUANTIZE : EXTMeshoptCompression.EncoderMethod.FILTER });
    await io.write(dst, doc);
    const a = fs.statSync(f).size, b = fs.statSync(dst).size; inB += a; outB += b; n++;
    console.log(`${rel}  ${(a / 1024) | 0}KB -> ${(b / 1024) | 0}KB  tris ${t0} -> ${t1}`);
  } catch (e) {
    console.log(`!! ${rel}: ${e.message.slice(0, 120)} (copied as is)`);
    fs.copyFileSync(f, dst);
  }
}
console.log(`done ${n} files  ${(inB / 1e6).toFixed(1)}MB -> ${(outB / 1e6).toFixed(1)}MB`);
