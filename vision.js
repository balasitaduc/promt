import { VISION_MODEL, VISION_CACHE } from './vision-config.js';

export class LocalVision {
  constructor(factory=()=>new Worker(new URL('./vision-worker.js',import.meta.url),{type:'module'})){this.factory=factory;this.worker=null;this.cancelCurrent=null;}
  caption(scenes,{signal,onProgress=()=>{},timeoutMs=600000}={}){
    if(signal?.aborted)return Promise.reject(new DOMException('Đã hủy Local Vision.','AbortError'));
    if(this.cancelCurrent)return Promise.reject(new Error('Local Vision đang bận.'));
    let worker;
    try{worker=this.worker||(this.worker=this.factory());}catch{ return Promise.reject(Object.assign(new Error('Không tạo được worker Local Vision.'),{code:'MODEL_RUNTIME_FAILED'})); }
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('message',message);worker.removeEventListener('error',failed);signal?.removeEventListener('abort',abort);this.cancelCurrent=null;};
      const stop=error=>{cleanup();worker.terminate();if(this.worker===worker)this.worker=null;reject(error);};
      const abort=()=>stop(new DOMException('Đã hủy Local Vision.','AbortError'));
      const failed=()=>stop(Object.assign(new Error('Không khởi động được worker Local Vision. Kiểm tra runtime/CSP và tải lại extension.'),{code:'MODEL_RUNTIME_FAILED'}));
      const message=event=>{const data=event.data;if(data?.id!==id)return;
        if(data.type==='progress')onProgress(data);
        else if(data.type==='result'){cleanup();resolve(data);}
        else if(data.type==='error'){cleanup();reject(Object.assign(new Error(data.message),{code:data.code}));}
      };
      const timer=setTimeout(()=>stop(Object.assign(new Error('Local Vision quá thời gian 10 phút. Kiểm tra tốc độ tải model/bộ nhớ và thử lại.'),{code:'MODEL_TIMEOUT'})),timeoutMs);
      worker.addEventListener('message',message);worker.addEventListener('error',failed);signal?.addEventListener('abort',abort,{once:true});this.cancelCurrent=abort;
      try{worker.postMessage({id,type:'caption',scenes});}catch{failed();}
    });
  }
  dispose(){if(this.cancelCurrent)this.cancelCurrent();this.worker?.terminate();this.worker=null;}
  async clearCache(){this.dispose();if(globalThis.caches)await caches.delete(VISION_CACHE);}
}

export function visionSceneInputs(analysis,frames){
  return analysis.scenes.map((scene,index)=>{
    const detail=analysis.deep.sceneDetails[index],target=detail.measurements.keyframeTimestamp;
    const frame=(Number.isFinite(target)&&frames.find(f=>Math.abs(f.timestamp-target)<.02&&f.timestamp>=scene.start&&f.timestamp<scene.end))||frames.find(f=>f.timestamp>=scene.start&&f.timestamp<scene.end);
    if(!frame)throw new Error(`Cảnh ${index+1} không có ảnh tham chiếu để chạy Vision.`);
    return {sceneId:detail.sceneId,timestamp:frame.timestamp,dataUrl:frame.dataUrl};
  });
}

export function applyCaptions(analysis,result,meta){
  if(result.model!==VISION_MODEL||!Array.isArray(result.captions)||result.captions.length!==analysis.scenes.length)throw new Error('Kết quả caption không khớp model/số cảnh.');
  const next=structuredClone(analysis);const deep=next.deep;deep.origin='local_caption';deep.characters=[];
  const captions=result.captions.map((item,i)=>{
    const scene=next.scenes[i],detail=deep.sceneDetails[i];
    if(item.sceneId!==detail.sceneId||typeof item.caption!=='string'||!item.caption.trim()||item.caption.length>1000||!Number.isFinite(item.timestamp)||item.timestamp<scene.start||item.timestamp>=scene.end)throw new Error('Caption hoặc timestamp không khớp cảnh.');
    const caption=item.caption.trim(),reference=`SUBJECT_S${String(i+1).padStart(2,'0')}`;
    const action=caption.match(/\b(walking|running|standing|sitting|holding|playing|riding|eating|drinking|looking|flying|swimming|driving|dancing|jumping|lying)\b.*$/i)?.[0]||null;
    const wardrobe=caption.match(/\bwearing\b\s+(.+)$/i)?.[0]||null;
    const environment=caption.match(/\b(?:in a room|in a kitchen|on a beach|on the beach|on a street|on the street|in a field|in the snow|on a table|in a park|in the water|outside|indoors)\b.*$/i)?.[0]||null;
    detail.fields.subject=caption;detail.fields.characterIds=i<12?reference:null;detail.fields.action=action;detail.fields.wardrobe=wardrobe;detail.fields.environment=environment;
    if(/\bclose[- ]up\b/i.test(caption))detail.fields.shotSize='Close-up · nhãn suy luận trong caption, cần đối chiếu ảnh';
    detail.evidence=[{timestamp:item.timestamp,observation:`Caption từ model cục bộ (tiếng Anh): ${caption}`}];
    detail.uncertainties=['Caption ảnh đơn có thể sai; kiểm tra với keyframe.', 'ID là tham chiếu từng cảnh, chưa chứng minh cùng danh tính giữa các cảnh.', 'Không suy ra camera chuyển động, lens thật, audio hoặc nguồn AI từ một caption.'];
    detail.promptVi=detail.promptVi.replace('[mô tả chủ thể trong ảnh tham chiếu]',()=>`mô tả model (tiếng Anh): ${caption}`)+`\nBằng chứng: keyframe ${item.timestamp.toFixed(3)}s; caption là suy luận chưa được xác minh.`;
    detail.promptEn=detail.promptEn.replace(/\[SUBJECT:[^\]]*\]/g,()=>caption);
    if(action)detail.promptEn=detail.promptEn.replace('[describe the observed action after reviewing the video]',()=>`${action} (inferred from a still image; confirm against the video)`);
    detail.imagePrompt=`Reference keyframe at ${item.timestamp.toFixed(3)}s: ${caption}. Preserve the observed composition and palette ${(detail.measurements.palette||[]).join(', ')}. Static image, no invented camera movement or hidden details. Confirm the model caption against the reference.`;
    detail.videoPrompt=`Duration ${(scene.end-scene.start).toFixed(2)}s. Use the reference image at ${item.timestamp.toFixed(3)}s showing: ${caption}. ${action?`Suggested action based on the still caption: ${action}; verify motion against the video.`:'[Specify motion after reviewing the video].'} [Specify intended camera movement]. Preserve reference appearance and geometry; a single caption does not establish temporal continuity.`;
    scene.description=`Local Vision caption (EN): ${caption}\nẢnh tham chiếu: ${item.timestamp.toFixed(3)}s; ${item.elapsedMs} ms suy luận.\n${scene.description}`;
    scene.prompt=detail.promptEn;if(action)scene.motion=`Caption gợi ý: ${action}. Chưa xác nhận chuyển động bằng video.`;
    if(i<12)deep.characters.push({id:reference,name:`Chủ thể tham chiếu cảnh ${i+1}`,appearance:caption,wardrobe,continuity:'So sánh thủ công ảnh giữa các cảnh trước khi gán cùng danh tính.',sceneIds:[detail.sceneId],referenceTimestamp:item.timestamp,evidence:[...detail.evidence]});
    return {sceneId:detail.sceneId,timestamp:item.timestamp,caption,elapsedMs:item.elapsedMs};
  });
  deep.masterPromptEn=`LOCAL VISION REFERENCE CAPTIONS (AI inference; confirm with source images):\n${captions.map(c=>`${c.sceneId} at ${c.timestamp.toFixed(3)}s: ${c.caption}`).join('\n')}\n\n${deep.masterPromptEn}`;
  deep.masterPromptVi=`MÔ TẢ ẢNH TỪ LOCAL VISION (caption gốc tiếng Anh, cần đối chiếu):\n${captions.map(c=>`${c.sceneId} · ${c.timestamp.toFixed(3)}s: ${c.caption}`).join('\n')}\n\n${deep.masterPromptVi}`;
  next.masterPrompt=deep.masterPromptEn;next.summary=`Local Vision đã tạo caption cho ${captions.length} cảnh bằng ${result.model}. Caption là suy luận từ keyframe, không phải phân tích toàn bộ video/âm thanh.\n${captions.map(c=>`${c.sceneId}: ${c.caption}`).join('\n')}`;
  next.limitations='Model caption mô tả ảnh bằng tiếng Anh; có thể nhận nhầm hoặc bỏ sót chi tiết. Không có bộ đo độ chính xác/confidence đã hiệu chuẩn. Caption không xác định danh tính xuyên cảnh, hướng camera, lens, âm thanh hoặc công cụ tạo video. Các trường chưa quan sát được vẫn để trống; phần số đo pixel giữ tách biệt.';
  deep.narrative.logline=null;deep.narrative.beats=captions.map(c=>({sceneId:c.sceneId,purpose:`Tư liệu hình ảnh từ caption: ${c.caption}. Vai trò kịch bản cần người dùng/Web AI đánh giá.`,onScreenText:null,transition:null}));
  next.localVision={model:result.model,revision:result.revision,device:result.device,captions};
  return next;
}
