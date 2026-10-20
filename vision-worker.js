import { pipeline, RawImage, env } from './vendor/vision-runtime.js';
import { VISION_MODEL, VISION_REVISION, VISION_RUNTIME_PATH } from './vision-config.js';

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
// Executable runtime assets are bundled locally; only model data is cached.
// Avoid the runtime's optional Blob-based factory cache under extension CSP.
env.useWasmCache = false;
env.backends.onnx.wasm.wasmPaths = new URL(VISION_RUNTIME_PATH, import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let captioner, busy = false;
const send = (id,type,data={}) => self.postMessage({id,type,...data});
function publicError(error,loading) {
  const status=String(error?.message||'').match(/\b(401|403|404|429|50[0-9])\b/)?.[1];
  return loading
    ? `Không tải/nạp được Local Vision${status?` (HTTP ${status})`:''}. Kiểm tra quyền kết nối Hugging Face/CDN model và bộ nhớ thiết bị. Ảnh đã lấy vẫn có thể dùng với Web AI.`
    : 'Local Vision không trả được caption hợp lệ. Thử ảnh khác, giảm số cảnh hoặc dùng Web AI; không có báo cáo AI hoàn tất cho lần này.';
}
async function load(id) {
  if(captioner)return captioner;
  const files=new Map();
  send(id,'progress',{stage:'loading',message:'Đang tải/nạp model caption (~237 MB lần đầu); không gửi ảnh lên mạng.'});
  captioner=await pipeline('image-to-text',VISION_MODEL,{
    revision:VISION_REVISION,dtype:'q8',device:'wasm',
    progress_callback:event=>{
      if(event.status!=='progress'||!event.file||!Number.isFinite(event.loaded))return;
      files.set(event.file,{loaded:event.loaded,total:Number.isFinite(event.total)?event.total:0});
      const totals=[...files.values()];const loadedBytes=totals.reduce((sum,f)=>sum+f.loaded,0),totalBytes=totals.reduce((sum,f)=>sum+f.total,0);
      send(id,'progress',{stage:'loading',loadedBytes,totalBytes,message:`Đang tải model: ${(loadedBytes/1048576).toFixed(1)} MB${totalBytes?` / ${(totalBytes/1048576).toFixed(1)} MB các tệp đã biết`:''}`});
    }
  });
  send(id,'progress',{stage:'ready',message:'Đã nạp mô hình caption trong WASM. Bắt đầu suy luận ảnh trên máy.'});
  return captioner;
}
function jpegBlob(dataUrl) {
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)||dataUrl.length>5000000)throw new Error('JPEG không hợp lệ.');
  const binary=atob(dataUrl.split(',')[1]);return new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'image/jpeg'});
}
self.addEventListener('message',async event=>{
  const {id,type,scenes}=event.data||{};
  if(type!=='caption')return;
  if(busy){send(id,'error',{code:'MODEL_BUSY',message:'Local Vision đang xử lý yêu cầu khác.'});return;}
  busy=true;let loading=true;
  try{
    if(!Array.isArray(scenes)||!scenes.length||scenes.length>24)throw new Error('Cần 1–24 ảnh tham chiếu cảnh.');
    const model=await load(id);loading=false;const captions=[];
    for(let i=0;i<scenes.length;i++){
      const scene=scenes[i],started=performance.now();
      send(id,'progress',{stage:'inference',current:i+1,total:scenes.length,message:`Đang suy luận caption cảnh ${i+1}/${scenes.length}…`});
      const image=await RawImage.fromBlob(jpegBlob(scene.dataUrl));
      const output=await model(image,{max_new_tokens:40,num_beams:1});
      const caption=output?.[0]?.generated_text?.trim();if(!caption)throw new Error('Caption rỗng.');
      captions.push({sceneId:scene.sceneId,timestamp:scene.timestamp,caption:caption.slice(0,1000),elapsedMs:Math.round(performance.now()-started)});
    }
    send(id,'result',{model:VISION_MODEL,revision:VISION_REVISION,device:'wasm',captions});
  }catch(error){if(loading)captioner=null;send(id,'error',{code:loading?'MODEL_LOAD_FAILED':'MODEL_INFERENCE_FAILED',message:publicError(error,loading)});}
  finally{busy=false;}
});
