// Versioned semantic report structure. Pixel measurements are attached by the app,
// never accepted as facts from AI/imported JSON.
export const SCENE_FIELDS = [
  ['subject','Chủ thể','Subject'], ['characterIds','Tham chiếu nhân vật','Character references'],
  ['appearance','Diện mạo','Appearance'], ['wardrobe','Trang phục / vật liệu','Wardrobe / materials'],
  ['action','Hành động','Action'], ['environment','Bối cảnh','Environment'],
  ['timeOfDay','Thời điểm','Time of day'], ['foreground','Tiền cảnh','Foreground'],
  ['background','Hậu cảnh','Background'], ['shotSize','Cỡ cảnh','Shot size'],
  ['cameraAngle','Góc máy','Camera angle'], ['cameraMovement','Chuyển động máy','Camera movement'],
  ['lensLook','Đặc tính ống kính','Lens look'], ['composition','Bố cục','Composition'],
  ['depthOfField','Độ sâu trường ảnh','Depth of field'], ['lighting','Ánh sáng','Lighting'],
  ['colorGrade','Màu sắc','Color grade'], ['mood','Sắc thái gợi ý','Suggested mood'],
  ['visualStyle','Phong cách','Visual style'], ['continuity','Tính nhất quán','Continuity'],
  ['transition','Chuyển cảnh','Transition'], ['pace','Nhịp cảnh','Pacing']
];
export const sceneId = index => `scene_${String(index + 1).padStart(3,'0')}`;
const blankFields = () => Object.fromEntries(SCENE_FIELDS.map(([key]) => [key,null]));
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
function text(value, name, max = 8000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new Error(`Trường ${name} phải là văn bản tối đa ${max} ký tự.`);
  return value.trim() || null;
}
function list(value, name, max = 24) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error(`Trường ${name} phải là danh sách tối đa ${max} phần tử.`);
  return value;
}
const texts = (value,name,max=24) => list(value,name,max).map((item,i) => text(item,`${name}.${i}`,3000)).filter(Boolean);
function evidence(value, duration, start=0, end=duration) {
  return list(value,'evidence',16).map(item => {
    if (!isObject(item) || !Number.isFinite(item.timestamp) || item.timestamp < start-.05 || item.timestamp > end+.05) throw new Error('Mốc bằng chứng nằm ngoài cảnh/video.');
    const observation = text(item.observation,'evidence.observation',2000);
    if (!observation) throw new Error('Bằng chứng cần mô tả điều nhìn thấy trong ảnh.');
    return {timestamp:item.timestamp,observation};
  });
}

export function deepInstruction() {
  return `Also include a "deep" object with schemaVersion:3. Keep output concise but specific to the supplied images, not boilerplate. Separate observable evidence, uncertain inference and creative suggestions. Return null for unknown fields; never turn brightness/edge statistics into a claim about a person, lens focal length, Kelvin temperature, camera direction, daylight location or generative origin. No claimed original prompt or guaranteed identity lock.
+deep.masterPromptVi: detailed Vietnamese master recreation prompt; deep.masterPromptEn: genuinely English master prompt (do not leave Vietnamese phrases). Organize both into concept, character/object continuity, ordered timed scene sequence, camera language, lighting/color, pacing, style and negative constraints.
+deep.styleBible: common materials, visual treatment, composition and consistency to preserve.
+deep.sceneDetails: one entry for EACH scenes item in identical order, with sceneId "scene_001" etc, fields:{${SCENE_FIELDS.map(([key,,label]) => `${key}: string|null (${label})`).join('; ')}}, promptVi:string, promptEn:string, imagePrompt:string (English static keyframe prompt), videoPrompt:string (English action/camera/temporal prompt), negativePrompt:string (scene-specific), evidence:[{timestamp:number,observation:string}], uncertainties:string[]. Ground observed shot scale/angle and subject description in image evidence. Treat lens look and motion as uncertain unless visually supported by multiple frames. Distinguish action from camera movement. Reference uploaded keyframes for continuity without asserting the same identity is proven. Include scene-specific foreground/background/materials and avoid repeating identical prompts across scenes.
+deep.characters:[{id:string,name:string|null,appearance:string|null,wardrobe:string|null,continuity:string|null,sceneIds:string[],referenceTimestamp:number|null,evidence:[{timestamp:number,observation:string}]}]. Track only visually supported recurring subjects/objects, max 12; do not invent a face, name or clothing from pixel averages.
+deep.audio:{soundDesignSuggestion:string|null,dialogueSuggestion:string|null}; these are NEW creative suggestions, never detected audio/transcripts because no audio was supplied.
+deep.narrative:{logline:string|null,hook:string|null,beats:[{sceneId:string,purpose:string,onScreenText:string|null,transition:string|null}],ending:string|null,loop:string|null}; separate visible story from proposed editing/text.
+deep.viral:{hookAssessment:string|null,retentionRisks:string[],improvements:string[]}; editorial reasoning only, no predicted view count or viral percentage.
+deep.productionPlan:[{phase:string,action:string,deliverable:string,minutesMin:number|null,minutesMax:number|null,assumption:string}]; estimates for a proposed NEW recreation workflow, not the author's actual production time. State scope (hands-on vs generation waiting) and assumptions when giving minutes.
+deep.recreation:{referenceStrategy:string|null,continuityChecklist:string[],generationSteps:string[],editingPlan:string|null,verificationChecklist:string[],toolRecommendations:string[]}; recommended tools are NOT claims about original tools.
+deep.aiAssessment:{observations:string[],unknowns:string[]}; do not supply an AI-origin probability, confidence percentage, quality score, real production time, tool probability or numerical detection claim. These cannot be calibrated from these samples.
+Use at most 12 meaningful scenes (combine into sequences if needed and state the coverage limitation). Keep each field focused on distinctive details rather than repeating global statistics. For 1-4 scenes, aim for 80-120 words per scene prompt language, 30-60 words each image/video prompt, and concise field values. For more scenes, shorten each prompt and field to fit the output budget while retaining all sections. Root masterPrompt and scenes[].prompt may be concise compatibility summaries; deep contains the detailed variants.
+Evidence timestamps must refer to provided frames within that scene. All JSON values must be valid, no comments or markdown fencing.`.replace(/^\+/gm,'');
}

export function normalizeDeep(value, scenes, duration) {
  if (!isObject(value)) throw new Error('deep phải là đối tượng JSON.');
  if (value.schemaVersion !== 3) throw new Error('Báo cáo chuyên sâu cần deep.schemaVersion = 3.');
  const ids = scenes.map((_,i)=>sceneId(i));
  const details = list(value.sceneDetails,'sceneDetails',48);
  if (details.length !== scenes.length) throw new Error('Số sceneDetails phải khớp số cảnh.');
  const normalized = {
    schemaVersion:3, masterPromptVi:text(value.masterPromptVi,'masterPromptVi',24000), masterPromptEn:text(value.masterPromptEn,'masterPromptEn',24000), styleBible:text(value.styleBible,'styleBible'),
    sceneDetails:details.map((item,i)=>{
      if (!isObject(item) || item.sceneId !== ids[i] || !isObject(item.fields)) throw new Error('sceneId / fields không khớp thứ tự cảnh.');
      return {sceneId:ids[i],fields:Object.fromEntries(SCENE_FIELDS.map(([key])=>[key,text(item.fields[key],key,3000)])),
        promptVi:text(item.promptVi,'promptVi',14000),promptEn:text(item.promptEn,'promptEn',14000),imagePrompt:text(item.imagePrompt,'imagePrompt'),videoPrompt:text(item.videoPrompt,'videoPrompt'),negativePrompt:text(item.negativePrompt,'negativePrompt'),
        evidence:evidence(item.evidence,duration,scenes[i].start,scenes[i].end),uncertainties:texts(item.uncertainties,'uncertainties',16)};
    }),
    characters:list(value.characters,'characters',12).map((item,i)=>{
      if (!isObject(item)) throw new Error('characters chứa phần tử không hợp lệ.');
      const id=text(item.id,'character.id',80); if (!id) throw new Error('Nhân vật cần id.');
      const sceneIds=texts(item.sceneIds,'character.sceneIds',48);
      if (sceneIds.some(id=>!ids.includes(id))) throw new Error('Nhân vật tham chiếu cảnh không tồn tại.');
      const timestamp=item.referenceTimestamp;
      if (timestamp!=null && (!Number.isFinite(timestamp)||timestamp<0||timestamp>duration)) throw new Error('Mốc ảnh tham chiếu nhân vật không hợp lệ.');
      return {id,name:text(item.name,'character.name',200),appearance:text(item.appearance,'appearance'),wardrobe:text(item.wardrobe,'wardrobe'),continuity:text(item.continuity,'continuity'),sceneIds,referenceTimestamp:timestamp??null,evidence:evidence(item.evidence,duration)};
    }),
    audio:{status:'not_analyzed',soundDesignSuggestion:text(value.audio?.soundDesignSuggestion,'soundDesignSuggestion'),dialogueSuggestion:text(value.audio?.dialogueSuggestion,'dialogueSuggestion')},
    narrative:{logline:text(value.narrative?.logline,'logline'),hook:text(value.narrative?.hook,'hook'),ending:text(value.narrative?.ending,'ending'),loop:text(value.narrative?.loop,'loop'),beats:list(value.narrative?.beats,'beats',48).map(item=>{
      if (!isObject(item)||!ids.includes(item.sceneId)) throw new Error('Narrative beat tham chiếu cảnh không tồn tại.');
      return {sceneId:item.sceneId,purpose:text(item.purpose,'purpose'),onScreenText:text(item.onScreenText,'onScreenText'),transition:text(item.transition,'transition')};
    })},
    viral:{hookAssessment:text(value.viral?.hookAssessment,'hookAssessment'),retentionRisks:texts(value.viral?.retentionRisks,'retentionRisks'),improvements:texts(value.viral?.improvements,'improvements')},
    productionPlan:list(value.productionPlan,'productionPlan',16).map(item=>{
      if (!isObject(item)) throw new Error('Bước sản xuất không hợp lệ.');
      const min=item.minutesMin??null,max=item.minutesMax??null,assumption=text(item.assumption,'assumption');
      if ((min!==null||max!==null)&&(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max<min||max>10080||!assumption)) throw new Error('Ước lượng phút cần min/max hợp lệ và giả định cụ thể.');
      return {phase:text(item.phase,'phase'),action:text(item.action,'action'),deliverable:text(item.deliverable,'deliverable'),minutesMin:min,minutesMax:max,assumption};
    }),
    recreation:{referenceStrategy:text(value.recreation?.referenceStrategy,'referenceStrategy'),continuityChecklist:texts(value.recreation?.continuityChecklist,'continuityChecklist'),generationSteps:texts(value.recreation?.generationSteps,'generationSteps'),editingPlan:text(value.recreation?.editingPlan,'editingPlan'),verificationChecklist:texts(value.recreation?.verificationChecklist,'verificationChecklist'),toolRecommendations:texts(value.recreation?.toolRecommendations,'toolRecommendations')},
    aiAssessment:{status:'not_calibrated',probability:null,confidence:null,observations:texts(value.aiAssessment?.observations,'observations'),unknowns:texts(value.aiAssessment?.unknowns,'unknowns')}
  };
  if (new Set(normalized.characters.map(c=>c.id)).size!==normalized.characters.length) throw new Error('ID nhân vật bị trùng.');
  return normalized;
}

export function verifyFrameEvidence(deep,frames) {
  if (!deep) return;
  const timestamps=frames.map(frame=>frame.timestamp);
  const supplied=value=>timestamps.some(timestamp=>Math.abs(timestamp-value)<=.12);
  const references=[...deep.sceneDetails.flatMap(scene=>scene.evidence.map(e=>e.timestamp)),...deep.characters.flatMap(c=>[...c.evidence.map(e=>e.timestamp),...(c.referenceTimestamp===null?[]:[c.referenceTimestamp])])];
  if(references.some(timestamp=>!supplied(timestamp)))throw new Error('AI viện dẫn timestamp không có trong các khung hình đã gửi. Hãy yêu cầu dùng đúng mốc ảnh.');
}

const mean = (rows,key) => { const values=rows.map(r=>r[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; };
export function sceneMeasurements(samples,start,end) {
  const rows=samples.filter(s=>s.timestamp>=start && s.timestamp<end);
  if (!rows.length) return {sampleCount:0,keyframeTimestamp:null};
  const keys=['luminance','contrast','saturation','temperature','edgeDensity','centerEdgeRatio','visualChange','detailX','detailY','topEdge','bottomEdge'];
  const result={sampleCount:rows.length,palette:[...new Set(rows.flatMap(r=>r.palette||[]))].slice(0,6)};
  for(const key of keys){const value=mean(rows,key);result[key]=value===null?null:Math.round(value*1000)/1000;}
  // The first difference crosses the scene boundary; do not count it as within-scene change.
  const change=mean(rows.slice(1),'visualChange');result.visualChange=change===null?null:Math.round(change*1000)/1000;
  const best=rows.reduce((best,row)=>(row.edgeDensity??0)>(best.edgeDensity??0)?row:best,rows[0]);
  return {...result,keyframeTimestamp:best.timestamp};
}
const num = (value,digits=1) => Number.isFinite(value)?value.toFixed(digits):'—';
export function measurementText(m,vi=true) {
  if (!m?.sampleCount) return vi?'Không có ảnh mẫu nằm trong khoảng cảnh này.':'No sampled image inside this interval.';
  return vi?`${m.sampleCount} ảnh · Luminance ${num(m.luminance)}/255 · Tương phản σ ${num(m.contrast)} · Bão hòa ${num(m.saturation)}% · Bảng màu ${(m.palette||[]).join(', ')}\nMật độ cạnh ${num(m.edgeDensity,3)} · Tỷ lệ cạnh tâm/rìa ${num(m.centerEdgeRatio,2)} · Trọng tâm chi tiết (${num(m.detailX,3)}, ${num(m.detailY,3)}) · Biến thiên ảnh Δ ${num(m.visualChange,3)}. Trọng tâm cạnh không phải vị trí nhân vật; Δ không xác định hướng camera.`
    :`${m.sampleCount} samples; mean luminance ${num(m.luminance)}/255; contrast σ ${num(m.contrast)}; saturation ${num(m.saturation)}%; palette ${(m.palette||[]).join(', ')}; edge density ${num(m.edgeDensity,3)}; detail centroid (${num(m.detailX,3)}, ${num(m.detailY,3)}); image change ${num(m.visualChange,3)}. Edge centroid is not a detected subject; image change does not identify camera direction.`;
}
function localPrompt(scene,m,index,vi) {
  const id=sceneId(index),duration=(scene.end-scene.start).toFixed(2);
  if (vi) return `[PROMPT TÁI TẠO ĐỀ XUẤT — ${id} · ${duration}s]\nCHỦ THỂ: [mô tả chủ thể trong ảnh tham chiếu], [diện mạo / vật liệu / trang phục].\nHÀNH ĐỘNG: [điền hành động thực tế sau khi xem video].\nBỐI CẢNH: [không gian, tiền cảnh, hậu cảnh, thời điểm — chưa nhận diện bằng Local].\nBỐ CỤC & CAMERA: Giữ bố cục ảnh tham chiếu tại ${num(m.keyframeTimestamp,3)}s; [cỡ cảnh], [góc máy], [chuyển động máy và tốc độ cần tái tạo].\nMÀU & ÁNH SÁNG THAM CHIẾU: Độ sáng TB ${num(m.luminance)}/255, tương phản σ ${num(m.contrast)}, bão hòa ${num(m.saturation)}%, màu ${(m.palette||[]).join(', ')}. Đây là số đo ảnh, không suy ra setup đèn hoặc nhiệt độ Kelvin.\nTÍNH LIÊN TỤC: Dùng keyframe cảnh làm ảnh tham chiếu; ghi lại các chi tiết cần giữ cho cảnh sau. Chưa xác minh đồng nhất nhân vật.\nCHUYỂN CẢNH: [xác nhận kiểu cắt và diễn tiến qua ranh giới ước lượng ${scene.start.toFixed(2)}–${scene.end.toFixed(2)}s].`;
  return `[SUGGESTED RECREATION — ${id}, ${duration}s]\nSUBJECT: [SUBJECT: describe the visible person/object using the reference image], [appearance, materials and wardrobe].\nACTION: [describe the observed action after reviewing the video].\nENVIRONMENT: [setting, foreground, background and time of day].\nCAMERA: Match the reference composition at ${num(m.keyframeTimestamp,3)}s; [shot scale], [camera angle], [intended camera motion and speed].\nCOLOR REFERENCE: mean luminance ${num(m.luminance)}/255, contrast σ ${num(m.contrast)}, saturation ${num(m.saturation)}%, palette ${(m.palette||[]).join(', ')}. Preserve the reference appearance; these metrics do not identify lighting equipment or Kelvin temperature.\nCONTINUITY: use a chosen reference image and document stable subject/material details. Identity across scenes is not established by local analysis.\nTRANSITION: [confirm the cut or transition], estimated scene interval ${scene.start.toFixed(2)}–${scene.end.toFixed(2)}s.`;
}

export function buildDossier(analysis,meta,{local=false}={}) {
  const source=analysis.deep;
  const samples=analysis.localMetrics?.samples||[];
  const details=analysis.scenes.map((scene,i)=>{
    const supplied=source?.sceneDetails?.[i],m=sceneMeasurements(samples,scene.start,scene.end);
    const fields={...blankFields(),...supplied?.fields};
    if (!supplied) {
      if (!local) {fields.action=scene.description;fields.cameraMovement=scene.motion;fields.lighting=scene.lighting;}
      fields.colorGrade=m.sampleCount?`Palette ${(m.palette||[]).join(', ')}; saturation ${num(m.saturation)}%`:null;
      fields.composition=m.detailX!=null?`Trọng tâm cạnh (${num(m.detailX,3)}, ${num(m.detailY,3)}), không phải nhận diện chủ thể`:null;
      fields.pace=`${(scene.end-scene.start).toFixed(2)}s · khoảng cảnh ước lượng`;
    }
    const promptVi=supplied?.promptVi||(local?localPrompt(scene,m,i,true):`Tái tạo cảnh ${i+1}: ${scene.description}\nCamera: ${scene.camera}\nÁnh sáng: ${scene.lighting}\nChuyển động ước lượng: ${scene.motion}`);
    const promptEn=supplied?.promptEn||(local?localPrompt(scene,m,i,false):scene.prompt);
    return {sceneId:sceneId(i),fields,promptVi,promptEn,
      imagePrompt:supplied?.imagePrompt||(local?`Static reference keyframe for ${sceneId(i)}: [describe subject, setting and framing]. Match palette ${(m.palette||[]).join(', ')} and the reference image at ${num(m.keyframeTimestamp,3)}s. Do not imply motion in a still image.`:scene.prompt+' Create a static reference keyframe; omit temporal actions.'),
      videoPrompt:supplied?.videoPrompt||(local?`Duration ${(scene.end-scene.start).toFixed(2)}s. Start from the selected reference keyframe. [Describe subject action], [camera movement and speed], [ending pose and transition]. Preserve chosen appearance and scene geometry. Pixel differences alone do not specify the motion.`:scene.prompt),
      negativePrompt:supplied?.negativePrompt||analysis.negativePrompt,
      evidence:supplied?.evidence||[],uncertainties:supplied?.uncertainties||(local?['Chủ thể, hành động, cỡ cảnh, góc máy, lens và chuyển động cần người dùng/AI quan sát.']:['Báo cáo cũ chưa cung cấp bằng chứng theo timestamp.']),measurements:m};
  });
  const sequenceVi=analysis.scenes.map((s,i)=>`${sceneId(i)} (${s.start.toFixed(2)}–${s.end.toFixed(2)}s): ${local?measurementText(details[i].measurements,true):s.description}`).join('\n');
  const sequenceEn=analysis.scenes.map((s,i)=>`${sceneId(i)} (${s.start.toFixed(2)}–${s.end.toFixed(2)}s): ${measurementText(details[i].measurements,false)}`).join('\n');
  const n=analysis.scenes.length;
  return {schemaVersion:3,origin:local?'local_measured':source?'ai_structured':'legacy_ai',
    masterPromptVi:source?.masterPromptVi||`1. Ý TƯỞNG TỔNG THỂ\n${analysis.summary}\n2. THAM CHIẾU & TÍNH LIÊN TỤC\nChọn keyframe cho từng cảnh; tự xác nhận chủ thể lặp lại. Giữ nhất quán diện mạo, vật liệu và trang phục theo ảnh đã chọn.\n3. CHUỖI CẢNH\n${sequenceVi}\n4. NGÔN NGỮ MÁY QUAY\n${local?'Chưa xác định cỡ cảnh / góc máy / chuyển động từ pixel. Điền hoặc yêu cầu Vision AI.':analysis.scenes.map(s=>s.camera).join('; ')}\n5. ÁNH SÁNG & MÀU\n${analysis.visualStyle}\n6. NHỊP ĐỘ\nThời lượng ${meta.duration.toFixed(2)}s, trung bình ${(meta.duration/n).toFixed(2)}s/cảnh; kiểm tra nhịp gốc trên video.\n7. PHONG CÁCH & KIỂM TRA\nSử dụng ảnh tham chiếu, kiểm tra biến dạng và độ liên tục; không bảo đảm giữ nguyên danh tính 100%.\n8. NEGATIVE GỢI Ý\n${analysis.negativePrompt}`,
    masterPromptEn:source?.masterPromptEn||(local?`1. OVERALL CONCEPT\nRecreate a ${meta.width}:${meta.height} reference-driven video, ${meta.duration.toFixed(2)}s over ${n} estimated visual segments. [SUBJECT: describe the reference subject and intended narrative].\n2. CONTINUITY ANCHORS\nChoose reference keyframes; document subject appearance, materials and wardrobe manually. Do not assume identity across scenes from image metrics.\n3. SCENE SEQUENCE\n${sequenceEn}\n4. CAMERA LANGUAGE\n[Set shot sizes, camera angles, lens look and motions after reviewing the source].\n5. COLOR & LIGHT\nPreserve each scene's measured palette and reference image; do not infer the original lighting rig from brightness.\n6. PACING\nAverage ${(meta.duration/n).toFixed(2)}s per estimated scene. Confirm cuts and tempo by watching the video.\n7. STYLE & CONTINUITY\n[Specify the desired visual style]. Check spatial and temporal consistency against the chosen references.\n8. NEGATIVE CONSTRAINTS\n${analysis.negativePrompt}`:analysis.masterPrompt),
    styleBible:source?.styleBible||analysis.visualStyle,sceneDetails:details,characters:source?.characters||[],
    audio:source?.audio||{status:'not_analyzed',soundDesignSuggestion:null,dialogueSuggestion:null},
    narrative:source?.narrative||{logline:local?null:analysis.summary,hook:null,ending:null,loop:null,beats:analysis.scenes.map((s,i)=>({sceneId:sceneId(i),purpose:local?'[Điền vai trò cảnh sau khi quan sát chủ thể/hành động]':s.description,onScreenText:null,transition:'Xác nhận trên video; mốc ranh giới hiện là ước lượng.'}))},
    viral:source?.viral||{hookAssessment:null,retentionRisks:[`Khoảng ${(meta.duration/n).toFixed(2)}s/cảnh chỉ là nhịp trung bình; cần xem video để đánh giá giữ chân.`, 'Ảnh mẫu không đủ xác minh chuyển cảnh, hook hoặc khả năng loop.'],improvements:['Chọn một điểm nhấn rõ trong 1–3 giây đầu.', 'Kiểm tra thông tin/chữ trong vùng an toàn của khung hình.', 'So sánh đoạn kết với khung mở đầu nếu muốn làm loop.']},
    productionPlan:source?.productionPlan?.length?source.productionPlan:[
      {phase:'Chuẩn bị',action:'Chọn ảnh tham chiếu và điền chủ thể/hành động chưa rõ.',deliverable:`${n} bộ tham chiếu cảnh`,minutesMin:5,minutesMax:15,assumption:'Ngân sách gợi ý cho bản tái tạo mới; thao tác thủ công, đã có ảnh nguồn.'},
      {phase:'Tạo thử',action:'Chuẩn bị prompt và so sánh 2 phương án cho mỗi cảnh.',deliverable:`Khoảng ${n*2} phương án clip`,minutesMin:n*3,minutesMax:n*10,assumption:'Giả định 2 lượt thử/cảnh; chỉ phút thao tác, không gồm thời gian chờ dịch vụ render.'},
      {phase:'Dựng',action:'Ghép theo timeline, cân màu và thêm âm thanh có quyền sử dụng.',deliverable:'Bản dựng nháp và bản xuất',minutesMin:5,minutesMax:20,assumption:'Ước lượng kế hoạch, một người dựng cơ bản; không phải thời gian thực của tác giả.'}
    ],
    recreation:source?.recreation||{referenceStrategy:`Dùng keyframe đã chọn của từng cảnh; ${n} cảnh cần kiểm tra nhất quán trước khi dựng.`,continuityChecklist:['Xác nhận chủ thể nào thật sự lặp lại giữa cảnh.', 'Ghi lại diện mạo/vật liệu/trang phục dựa trên ảnh, không dựa vào màu trung bình.', 'So sánh bố cục và nền qua từng điểm cắt.'],generationSteps:['Hoàn thiện 22 trường có căn cứ.', 'Tạo Image Prompt để kiểm tra bố cục tĩnh.', 'Tạo Video Prompt riêng cho hành động và camera.', 'Chạy clip thử trước khi tạo toàn bộ cảnh.'],editingPlan:`Ghép ${n} cảnh theo thứ tự 0–${meta.duration.toFixed(2)}s; xác minh các mốc ước lượng trước khi khóa dựng.`,verificationChecklist:['Kiểm tra chủ thể và chi tiết vật thể.', 'So camera/hành động với video gốc, không chỉ keyframe.', 'Kiểm tra flicker, méo hình và nhịp cắt.', 'Audio chưa phân tích: tự nghe và thiết kế riêng.'],toolRecommendations:[]},
    aiAssessment:{status:'not_calibrated',probability:null,confidence:null,observations:source?.aiAssessment?.observations||[],unknowns:source?.aiAssessment?.unknowns||['Chưa có bộ phát hiện nguồn AI được hiệu chuẩn.', 'Không xác định công cụ tạo gốc chỉ từ kiểu màu/độ nét.']}
  };
}

export function attachMeasurements(analysis,localAnalysis,meta,{local=false}={}) {
  const next={...analysis,localMetrics:localAnalysis?.localMetrics||analysis.localMetrics};
  next.deep=buildDossier(next,meta,{local});
  return next;
}
export function reportReadiness(deep) {
  const values=deep.sceneDetails.flatMap(scene=>Object.values(scene.fields));
  const known=values.filter(value=>typeof value==='string'&&value.trim()&&!/[\[\]]|chưa xác định|not identified|unknown/i.test(value)).length;
  return {filled:known,total:values.length,percent:Math.round(known/Math.max(1,values.length)*100),evidencedScenes:deep.sceneDetails.filter(s=>s.evidence.length).length};
}
