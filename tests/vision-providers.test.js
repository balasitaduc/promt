import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, analyzeInDepth, listModels, createChatPayload, createOllamaPayload } from '../core.js';

const output=JSON.parse(readFileSync(new URL('./fixtures/deep-analysis.json',import.meta.url)));
const meta={duration:2,width:320,height:180,measurements:[{start:0,end:2,measurements:{sampleCount:2}}]};
const frames=[{timestamp:0,dataUrl:'data:image/jpeg;base64,YQ=='},{timestamp:1.9,dataUrl:'data:image/jpeg;base64,Yg=='}];
const json=value=>({ok:true,json:async()=>value});
const chat=value=>json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});

test('HF model discovery requires declared image and text modalities and sends token only to HF Router',async()=>{
  const models=await listModels({provider:'huggingface',key:'test-token',fetcher:async(url,options)=>{
    assert.equal(url,'https://router.huggingface.co/v1/models');assert.equal(options.headers.Authorization,'Bearer test-token');
    return json({data:[{id:'Qwen/vision',architecture:{input_modalities:['text','image'],output_modalities:['text']}},{id:'text-only',architecture:{input_modalities:['text'],output_modalities:['text']}},{id:'unknown'}]});
  }});assert.deepEqual(models,['Qwen/vision']);
});
test('HF payload contains timestamped images, deep structure and no video URL/name; billing failures are explicit',async()=>{
  const payload=createChatPayload(frames,{...meta,name:'PRIVATE_NAME',url:'PRIVATE_URL'},'Qwen/vision');
  assert.equal(payload.messages[0].content.filter(p=>p.type==='image_url').length,2);assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_/);
  const options={provider:'huggingface',key:'test-hf',model:'Qwen/vision:preferred',frames,meta};
  const result=await analyze({...options,fetcher:async(url,init)=>{assert.equal(url,'https://router.huggingface.co/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer test-hf');return chat(output);}});
  assert.equal(result.deep.sceneDetails[0].fields.subject,output.deep.sceneDetails[0].fields.subject);
  for(const status of [401,402,403,404,429])await assert.rejects(analyze({...options,fetcher:async()=>({ok:false,status})}),error=>!error.message.includes('test-hf'));
  await assert.rejects(analyze({...options,fetcher:async()=>({ok:false,status:402})}),/credit/);
  await assert.rejects(analyze({...options,fetcher:async()=>json({choices:[{finish_reason:'length',message:{content:'{}'}}]})}),/chưa trả JSON hoàn chỉnh/);
});
test('Ollama discovery verifies vision capability, excludes cloud/remote models and requires no API key',async()=>{
  const requests=[];
  const models=await listModels({provider:'ollama',key:'',fetcher:async(url,options)=>{
    requests.push(url);assert.ok(!options.headers?.Authorization);
    if(url.endsWith('/tags'))return json({models:[{name:'qwen3-vl:4b'},{name:'text-only'},{name:'qwen:397b-cloud'},{name:'remote-renamed',remote_model:'cloud'}]});
    const model=JSON.parse(options.body).model;return json({capabilities:model==='text-only'?['completion']:['completion','vision']});
  }});assert.deepEqual(models,['qwen3-vl:4b']);assert.equal(requests.length,3);
});
test('Ollama uses native JSON/image API and explicit context size without sending credentials',async()=>{
  const payload=createOllamaPayload(frames,meta,'qwen3-vl:4b');assert.equal(payload.messages[0].images.length,2);assert.equal(payload.format,'json');assert.equal(payload.options.num_ctx,16384);assert.equal(payload.options.num_predict,8192);
  const options={provider:'ollama',key:'MUST_NOT_SEND',model:'qwen3-vl:4b',frames,meta};
  await analyze({...options,fetcher:async(url,init)=>{assert.ok(!init.headers.Authorization);assert.doesNotMatch(init.body,/MUST_NOT_SEND/);if(url.endsWith('/show'))return json({capabilities:['vision']});assert.equal(url,'http://localhost:11434/api/chat');return json({done:true,done_reason:'stop',message:{content:JSON.stringify(output)}});}});
  await assert.rejects(analyze({...options,fetcher:async()=>json({capabilities:['vision'],remote_model:'cloud'})}),/remote\/cloud/);
  await assert.rejects(analyze({...options,model:'qwen:397b-cloud'}),/cloud/);
  await assert.rejects(analyze({...options,fetcher:async()=>{throw new TypeError('Failed to fetch');}}),/localhost:11434/);
});
test('12 GB profile caps images while retaining endpoints and rejects evidence from an unsent frame',async()=>{
  const many=Array.from({length:8},(_,i)=>({timestamp:i/4,dataUrl:`data:image/jpeg;base64,${btoa(String(i))}`}));
  const payload=createOllamaPayload(many,meta,'qwen3-vl:8b');
  assert.equal(payload.messages[0].images.length,4);
  assert.equal(payload.messages[0].images[0],many[0].dataUrl.split(',')[1]);assert.equal(payload.messages[0].images.at(-1),many.at(-1).dataUrl.split(',')[1]);
  const invented=structuredClone(output);invented.deep.sceneDetails[0].evidence[0].timestamp=.25;
  await assert.rejects(analyze({provider:'ollama',key:'',model:'qwen3-vl:8b',frames:many,meta,fetcher:async(url,init)=>{
    if(url.endsWith('/show'))return json({capabilities:['vision']});
    assert.equal(JSON.parse(init.body).messages[0].images.length,4);
    return json({done:true,done_reason:'stop',message:{content:JSON.stringify(invented)}});
  }}),/không có trong các khung hình đã gửi/);
});
test('deep analysis performs scene calls with actual images then passes bounded observations to synthesis',async()=>{
  const seen=[],progress=[];
  const result=await analyzeInDepth({provider:'huggingface',key:'test-hf',model:'Qwen/vision',frames,meta,onProgress:event=>progress.push(event.stage),fetcher:async(url,init)=>{
    seen.push(JSON.parse(init.body));return chat(output);
  }});
  assert.equal(seen.length,2);assert.match(seen[0].messages[0].content[0].text,/scene-level pass/);
  assert.match(seen[1].messages[0].content[0].text,/Earlier scene-level AI observations/);
  assert.equal(result.analysisPasses.sceneCalls,1);assert.deepEqual(progress,['scene','synthesis']);
  const wrong=structuredClone(output);wrong.scenes[0].end=1.5;
  await assert.rejects(analyzeInDepth({provider:'huggingface',key:'x',model:'Qwen/vision',frames,meta,fetcher:async()=>chat(wrong)}),/lượt cảnh/);
  const controller=new AbortController();controller.abort();await assert.rejects(analyzeInDepth({frames,meta,signal:controller.signal}),{name:'AbortError'});
});
