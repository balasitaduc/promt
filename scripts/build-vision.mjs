import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
await mkdir('vendor', { recursive: true });
const result=await build({ entryPoints: ['scripts/vision-runtime-entry.js'], outfile: 'vendor/vision-runtime.js', bundle: true, platform: 'browser', format: 'esm', target: ['chrome116'], minify: false, metafile:true, legalComments: 'linked', plugins: [{ name:'local-wasm-backend',setup(builder){builder.onResolve({filter:/^onnxruntime-web(?:\/(?:wasm|webgpu))?$/},()=>({path:resolve('node_modules/onnxruntime-web/dist/ort.wasm.min.mjs')}));}}, {
  name:'fixed-caption-model-registry',setup(builder){
    builder.onLoad({filter:/@huggingface[\\/]transformers[\\/]dist[\\/]transformers\.web\.js$/},async args=>{
      const source=await readFile(args.path,'utf8');
      // This app exposes only ViT-GPT2 captioning in the browser. The unused
      // Mistral architecture registration was misidentified as an API key by
      // repository push protection. Omit that unsupported registry entry;
      // do not encode the string or disable the protection.
      const entry=/^\s*\["mistral3", [^\n]+\n/gm;
      if((source.match(entry)||[]).length!==1)throw new Error('Expected exactly one unused Mistral registry entry in pinned runtime.');
      const contents=source.replace(entry,'');
      if(!contents.includes('["vision-encoder-decoder", "VisionEncoderDecoderModel"]'))throw new Error('Caption model registration must remain present.');
      return {contents,loader:'js',resolveDir:dirname(args.path)};
    });
  }
}], logLevel: 'info' });
const excluded=Object.keys(result.metafile.inputs).filter(path=>/node_modules\/(sharp|onnxruntime-node|global-agent|roarr|sprintf-js)\//.test(path));
if(excluded.length)throw new Error(`Node-only dependencies must not enter browser bundle: ${excluded.join(', ')}`);
await mkdir('dist',{recursive:true});
await writeFile('dist/vision-runtime-metafile.json',JSON.stringify(result.metafile,null,2)+'\n');
for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `vendor/${name}`);
let licenses='Bundled runtime generated from locked npm dependencies. ONNX/Transformers code is local; model weights are downloaded separately.\n\n';
const provenance={dependencies:{},files:{},nodeOnlyDependenciesInBundle:excluded,omittedModelRegistrations:['mistral3']};
for (const name of ['@huggingface/transformers','@huggingface/tokenizers','@huggingface/jinja','onnxruntime-web','onnxruntime-common']) {
  const metadata=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8'));
  provenance.dependencies[name]=metadata.version;
  licenses+=`${name} ${metadata.version} — ${metadata.license}\n`;
  for (const file of ['LICENSE','LICENSE.txt','LICENSE.md']) {
    try { licenses+=await readFile(`node_modules/${name}/${file}`,'utf8');break; } catch {}
  }
  licenses+='\n\n';
}
await writeFile('vendor/THIRD_PARTY_LICENSES.txt',licenses);
for(const name of ['vision-runtime.js','vision-runtime.js.LEGAL.txt','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','THIRD_PARTY_LICENSES.txt'])provenance.files[name]=createHash('sha256').update(await readFile(`vendor/${name}`)).digest('hex');
await writeFile('vendor/PROVENANCE.json',JSON.stringify(provenance,null,2)+'\n');
