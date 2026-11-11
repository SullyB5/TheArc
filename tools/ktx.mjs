// GPU-compressed phone set: node ktx.mjs <inDir> <outDir> [--color 1024] [--detail 512] [--tris 20000] [--skip re] [--match re] [--shard i/n] [--force]
// Every .glb under inDir is rewritten into outDir with KTX2 (Basis Universal) textures, which stay compressed in graphics memory:
//   colour/emissive maps  -> ETC1S (sRGB), at most --color px    (~0.5-1 byte per pixel on the GPU instead of 4)
//   normal maps           -> UASTC + zstd, at most --detail px    (~1 byte per pixel, keeps normals clean)
//   roughness/metal/AO    -> ETC1S (linear), at most --detail px
// Sizes are rounded down to powers of two. Meshes over --tris triangles are simplified toward it (vertices only removed).
// The loader needs KTX2Loader + the Basis transcoder (vendor/jsm/libs/basis/). Source files are never touched.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { simplify, weld, prune, dedup, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

const A = process.argv.slice(2); const inDir = A[0], outDir = A[1];
const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const COLOR = +opt('color', 1024), DETAIL = +opt('detail', 512), TRIS = +opt('tris', 20000);
const SKIP = opt('skip', null) ? new RegExp(opt('skip')) : null, MATCH = opt('match', null) ? new RegExp(opt('match')) : null;
const [SI, SN] = (opt('shard', '0/1')).split('/').map(Number), FORCE = A.includes('--force');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const imageDecoder = async buf => { const { data, info } = await sharp(Buffer.from(buf)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const COLOR_SLOTS = /^(baseColorTexture|emissiveTexture|diffuseTexture|specularColorTexture)$/;
const pot = n => 2 ** Math.floor(Math.log2(Math.max(4, n)));

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (path.resolve(p) !== path.resolve(outDir)) walk(p); } else if (p.endsWith('.glb')) files.push(p); } })(inDir);
const countTris = doc => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(), pos = p.getAttribute('POSITION'); if (pos) t += (i ? i.getCount() : pos.getCount()) / 3; } return Math.round(t); };
const slotsOf = (doc, tex) => [...new Set(tex.getGraph().listParentEdges(tex).filter(e => e.getParent() !== doc.getRoot()).map(e => e.getName()))];

let k = -1, inB = 0, outB = 0;
for (const f of files) {
  const rel = path.relative(inDir, f);
  if (SKIP && SKIP.test(rel)) continue;
  if (MATCH && !MATCH.test(rel)) continue;
  if (++k % SN !== SI) continue;
  const dst = path.join(outDir, rel);
  if (!FORCE && fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(f).mtimeMs) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const t0 = Date.now();
  try {
    const doc = await io.read(f);
    const used = new Set(doc.getRoot().listExtensionsUsed().map(e => e.extensionName));
    const wasQ = used.has('KHR_mesh_quantization'), wasMO = used.has('EXT_meshopt_compression');
    // 1. resize every texture to a power of two under its cap, as PNG (the encoder's input); sort by role
    const role = new Map();
    for (const tex of doc.getRoot().listTextures()) {
      const img = tex.getImage(); if (!img || tex.getMimeType() === 'image/ktx2') continue;
      const slots = slotsOf(doc, tex);
      const r = slots.some(s => COLOR_SLOTS.test(s)) ? 'color' : slots.includes('normalTexture') ? 'normal' : 'data';
      const cap = r === 'color' ? COLOR : DETAIL;
      const md = await sharp(Buffer.from(img)).metadata();
      const w = Math.min(pot(md.width), cap), h = Math.min(pot(md.height), cap);
      tex.setImage(new Uint8Array(await sharp(Buffer.from(img)).resize(w, h, { fit: 'fill' }).png({ compressionLevel: 1 }).toBuffer())).setMimeType('image/png');
      tex.setName((tex.getName() || 't') + '@' + r);
      role.set(tex, r);
    }
    // 2. geometry
    const tris0 = countTris(doc); let tris1 = tris0;
    if (tris0 > TRIS) { await doc.transform(weld({}), simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(.25, TRIS / tris0), error: .004, lockBorder: true })); tris1 = countTris(doc); }
    // 3. GPU compression by role (pattern matches the role tag put in each texture's name)
    const base = { imageDecoder, generateMipmap: true, isKTX2File: true, enableDebug: false };
    await doc.transform(
      ktx2({ ...base, pattern: /@color$/, isUASTC: false, qualityLevel: 192, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }),
      ktx2({ ...base, pattern: /@normal$/, isUASTC: true, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1 }),
      ktx2({ ...base, pattern: /@data$/, isUASTC: false, qualityLevel: 160, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false }),
    );
    for (const tex of doc.getRoot().listTextures()) tex.setName((tex.getName() || '').replace(/@(color|normal|data)$/, ''));
    await doc.transform(dedup(), prune({ keepAttributes: true, keepLeaves: true, keepExtras: true }));
    if (wasQ) await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
    if (wasMO) doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: wasQ ? EXTMeshoptCompression.EncoderMethod.QUANTIZE : EXTMeshoptCompression.EncoderMethod.FILTER });
    const left = doc.getRoot().listTextures().filter(t => t.getMimeType() !== 'image/ktx2').length;
    await io.write(dst, doc);
    const a = fs.statSync(f).size, b = fs.statSync(dst).size; inB += a; outB += b;
    console.log(`${rel}  ${(a / 1024) | 0}KB -> ${(b / 1024) | 0}KB  tris ${tris0} -> ${tris1}  ${role.size} tex${left ? ` (${left} NOT ktx2)` : ''}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`!! ${rel}: ${e.message.slice(0, 160)}`);
  }
}
console.log(`shard ${SI}/${SN} done  ${(inB / 1e6).toFixed(1)}MB -> ${(outB / 1e6).toFixed(1)}MB`);
