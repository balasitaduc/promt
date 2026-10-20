import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('vendor', { recursive: true });
await build({ entryPoints: ['scripts/vision-runtime-entry.js'], outfile: 'vendor/vision-runtime.js', bundle: true, platform: 'browser', format: 'esm', target: ['chrome116'], minify: true, legalComments: 'linked', plugins: [{ name:'local-wasm-backend',setup(builder){builder.onResolve({filter:/^onnxruntime-web(?:\/wasm)?$/},()=>({path:resolve('node_modules/onnxruntime-web/dist/ort.wasm.min.mjs')}));}}], logLevel: 'info' });
for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `vendor/${name}`);
let licenses='Bundled runtime generated from locked npm dependencies. ONNX/Transformers code is local; model weights are downloaded separately.\n\n';
for (const name of ['@huggingface/transformers','onnxruntime-web','onnxruntime-common']) {
  const metadata=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8'));
  licenses+=`${name} ${metadata.version} — ${metadata.license}\n`;
  for (const file of ['LICENSE','LICENSE.txt','LICENSE.md']) {
    try { licenses+=await readFile(`node_modules/${name}/${file}`,'utf8');break; } catch {}
  }
  licenses+='\n\n';
}
await writeFile('vendor/THIRD_PARTY_LICENSES.txt',licenses);
