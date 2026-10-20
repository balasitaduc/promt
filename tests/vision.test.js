import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalVision, applyCaptions, visionSceneInputs } from '../vision.js';
import { VISION_MODEL } from '../vision-config.js';
import { buildLocalAnalysis, measurePixels } from '../local.js';
import { parseAnalysis } from '../core.js';
import { reportMarkdown } from '../reports.js';

const meta={duration:4,width:640,height:360,frameCount:3,name:'sample.mp4'};
const metrics=measurePixels(new Uint8ClampedArray(Array(16).fill([255,0,0,255]).flat()));
const local=()=>buildLocalAnalysis([0,1,3].map(timestamp=>({timestamp,metrics})),meta);
const result=()=>({model:VISION_MODEL,revision:'main',device:'wasm',captions:[{sceneId:'scene_001',timestamp:0,caption:'a man wearing a blue shirt standing on a street',elapsedMs:10}]});

test('caption output uses actual model text, preserves measurements and leaves unsupported camera fields unknown',()=>{
  const input=local(),output=applyCaptions(input,result(),meta),detail=output.deep.sceneDetails[0];
  assert.equal(input.deep.sceneDetails[0].fields.subject,null);
  assert.equal(detail.fields.subject,result().captions[0].caption);assert.equal(detail.fields.cameraMovement,null);assert.equal(detail.fields.lensLook,null);
  assert.equal(output.deep.aiAssessment.probability,null);assert.deepEqual(output.localMetrics,input.localMetrics);
  assert.match(detail.promptEn,/a man wearing/);assert.doesNotMatch(detail.promptEn,/\[SUBJECT:/);
  assert.equal(output.deep.characters[0].sceneIds[0],'scene_001');assert.match(output.deep.characters[0].continuity,/thủ công/);
  assert.match(reportMarkdown({meta,analysis:output,engine:'local-caption',elapsedMs:10,createdAt:'now'}),/a man wearing/);
  assert.equal(parseAnalysis(JSON.stringify(output),4).deep.sceneDetails[0].fields.subject,detail.fields.subject);
});
test('mismatched model, scene or timestamp cannot become an analysis result',()=>{
  for(const change of [{model:'other'},{captions:[]},{captions:[{...result().captions[0],sceneId:'S02'}]},{captions:[{...result().captions[0],timestamp:4}]}])assert.throws(()=>applyCaptions(local(),{...result(),...change},meta));
  const input=local();input.deep.sceneDetails[0].measurements.keyframeTimestamp=null;input.scenes[0].start=1;
  assert.equal(visionSceneInputs(input,[{timestamp:0},{timestamp:1}])[0].timestamp,1);
});
class WorkerStub extends EventTarget {
  postMessage(data){this.request=data;}
  respond(data){this.dispatchEvent(new MessageEvent('message',{data:{id:this.request.id,...data}}));}
  terminate(){this.terminated=true;}
}
test('Vision worker protocol reuses a warm worker; abort terminates and allows a fresh run',async()=>{
  const workers=[],client=new LocalVision(()=>{const worker=new WorkerStub();workers.push(worker);return worker;});
  const stages=[],first=client.caption([],{onProgress:e=>stages.push(e.stage)});
  workers[0].respond({type:'progress',stage:'loading'});workers[0].respond({type:'result',...result()});
  assert.equal((await first).model,VISION_MODEL);assert.deepEqual(stages,['loading']);
  const controller=new AbortController(),second=client.caption([],{signal:controller.signal});
  assert.equal(workers.length,1);controller.abort();await assert.rejects(second,{name:'AbortError'});assert.ok(workers[0].terminated);
  const third=client.caption([]);assert.equal(workers.length,2);workers[1].respond({type:'error',code:'MODEL_LOAD_FAILED',message:'Download denied'});
  await assert.rejects(third,{code:'MODEL_LOAD_FAILED'});client.dispose();
});
test('worker crash, timeout and pre-abort reject without a fake result',async()=>{
  const worker=new WorkerStub(),client=new LocalVision(()=>worker);
  const crashed=client.caption([]);worker.dispatchEvent(new Event('error'));await assert.rejects(crashed,{code:'MODEL_RUNTIME_FAILED'});
  const timeout=client.caption([],{timeoutMs:5});await assert.rejects(timeout,{code:'MODEL_TIMEOUT'});
  const controller=new AbortController();controller.abort();await assert.rejects(client.caption([],{signal:controller.signal}),{name:'AbortError'});
});
