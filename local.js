import { buildDossier, sceneMeasurements, measurementText } from './deep.js';

// Deterministic pixel analysis. No trained vision model or semantic inference.
export function measurePixels(pixels, width = Math.sqrt(pixels.length / 4), height = width) {
  if (!pixels.length || pixels.length % 4) throw new Error('Dữ liệu ảnh không hợp lệ.');
  const histogram = Array(16).fill(0), palette = new Map(), luma = [];
  let luminance = 0, squared = 0, saturation = 0, warm = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma.push(y);
    luminance += y; squared += y * y; warm += r - b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    saturation += max ? (max - min) / max : 0;
    histogram[Math.min(15, Math.floor(y / 16))]++;
    const bucket = [r, g, b].map(v => Math.min(255, Math.floor(v / 48) * 48 + 24));
    const key = '#' + bucket.map(v => v.toString(16).padStart(2, '0')).join('');
    palette.set(key, (palette.get(key) || 0) + 1);
  }
  const mean = luminance / count;
  let edgeSum=0,weightedX=0,weightedY=0,centerSum=0,centerCount=0,rimSum=0,rimCount=0,top=0,topCount=0,bottom=0,bottomCount=0,edgeCount=0;
  const spatial=Number.isInteger(width)&&Number.isInteger(height)&&width*height===count;
  if(spatial) for(let y=0;y<height-1;y++) for(let x=0;x<width-1;x++) {
    const at=y*width+x,energy=(Math.abs(luma[at+1]-luma[at])+Math.abs(luma[at+width]-luma[at]))/510;
    const nx=(x+.5)/width,ny=(y+.5)/height;
    edgeSum+=energy;weightedX+=nx*energy;weightedY+=ny*energy;edgeCount++;
    if(nx>=.25&&nx<=.75&&ny>=.25&&ny<=.75){centerSum+=energy;centerCount++;}else{rimSum+=energy;rimCount++;}
    if(ny<.25){top+=energy;topCount++;}if(ny>.75){bottom+=energy;bottomCount++;}
  }
  const lumaGrid=spatial?Array.from({length:256},(_,i)=>luma[Math.min(height-1,Math.floor(Math.floor(i/16)*height/16))*width+Math.min(width-1,Math.floor(i%16*width/16))]/255):[];
  return {
    luminance: Math.round(mean), contrast: Math.round(Math.sqrt(Math.max(0, squared / count - mean ** 2))),
    saturation: Math.round(saturation / count * 100), temperature: Math.round(warm / count),
    histogram: histogram.map(n => n / count),
    palette: [...palette].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([color]) => color),
    edgeDensity:spatial?edgeSum/Math.max(1,edgeCount):null,
    centerEdgeRatio:rimSum>0?(centerSum/Math.max(1,centerCount))/(rimSum/Math.max(1,rimCount)):null,
    detailX:edgeSum>0?weightedX/edgeSum:null,detailY:edgeSum>0?weightedY/edgeSum:null,
    topEdge:spatial?top/Math.max(1,topCount):null,bottomEdge:spatial?bottom/Math.max(1,bottomCount):null,lumaGrid
  };
}

export function frameDifference(a, b) {
  const histogram = a.histogram.reduce((sum, value, i) => sum + Math.abs(value - b.histogram[i]), 0) / 2;
  const color = Math.min(1, Math.abs(a.temperature - b.temperature) / 255);
  if (a.lumaGrid?.length===256 && b.lumaGrid?.length===256) {
    const spatial=a.lumaGrid.reduce((sum,value,i)=>sum+Math.abs(value-b.lumaGrid[i]),0)/256;
    const scale=Math.max(.08,((a.contrast||0)+(b.contrast||0))/510);
    return histogram*.45+color*.15+Math.min(1,spatial/scale)*.4;
  }
  return histogram * 0.7 + color * 0.3;
}

export function segmentScenes(samples, duration, threshold) {
  if (!samples.length) throw new Error('Cần khung hình để tách cảnh.');
  const differences=samples.map((sample,i)=>i?frameDifference(samples[i-1].metrics,sample.metrics):0);
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:0;};
  const center=median(differences.slice(1)),deviation=median(differences.slice(1).map(value=>Math.abs(value-center)));
  // Relative peaks can detect a cut between similarly colored shots; the fixed
  // floor suppresses tiny compression/motion fluctuations. This remains heuristic.
  const cutoff=threshold??Math.max(.12,Math.min(.45,center+3*deviation));
  const scenes = [];
  let first = 0, start = 0, previousCut = -2;
  for (let i = 1; i < samples.length; i++) {
    if (differences[i]>=cutoff && differences[i]>=differences[i-1] && differences[i]>=(differences[i+1]??0) && i-previousCut>1 && scenes.length < 23) {
      const end = (samples[i - 1].timestamp + samples[i].timestamp) / 2;
      scenes.push({ start, end, first, last: i - 1 });
      start = end; first = i; previousCut=i;
    }
  }
  scenes.push({ start, end: duration, first, last: samples.length - 1 });
  return scenes;
}

export function buildLocalAnalysis(samples, meta, goal = '', language = 'vi') {
  const groups = segmentScenes(samples, meta.duration);
  const avg = key => Math.round(samples.reduce((sum, s) => sum + s.metrics[key], 0) / samples.length);
  const palette = [...new Set(samples.flatMap(s => s.metrics.palette))].slice(0, 8);
  const brightness = avg('luminance') < 70 ? 'dark / low luminance' : avg('luminance') > 175 ? 'bright / high luminance' : 'mid-tone luminance';
  const colors = avg('temperature') > 20 ? 'warm-biased colors' : avg('temperature') < -20 ? 'cool-biased colors' : 'balanced warm/cool colors';
  const aspect = `${meta.width}:${meta.height}`;
  const base = `Recreate a video with aspect ratio ${aspect}, ${brightness}, ${colors}, ${avg('saturation')}% average HSV saturation. Use this measured palette as a visual reference: ${palette.join(', ')}. [SUBJECT: describe the visible subject], [ACTION: describe the action], [SETTING: describe the environment], [CAMERA: choose framing and movement].`;
  const goalNote = goal ? ` Creative note supplied by the user: ${JSON.stringify(goal.slice(0, 1000))}.` : '';
  const english = language === 'en';
  const rows=samples.map((s,i)=>({timestamp:s.timestamp,...s.metrics,visualChange:i?frameDifference(samples[i-1].metrics,s.metrics):null,histogram:undefined,lumaGrid:undefined}));
  const analysis = {
    summary: english ? `${samples.length} sampled frames; ${groups.length} estimated visual segments. Local analysis measures pixels, not subjects or meaning.` : `Đã đo ${samples.length} khung hình, phát hiện ${groups.length} phân đoạn hình ảnh ước lượng. Chế độ cục bộ đo pixel, không nhận diện chủ thể hoặc hiểu nội dung.`,
    visualStyle: `${english ? 'Measured visual properties' : 'Đặc tính hình ảnh đo được'}: ${brightness}; ${colors}; ${english ? 'mean luminance' : 'độ sáng trung bình'} ${avg('luminance')}/255; ${english ? 'contrast (luminance standard deviation)' : 'tương phản (độ lệch chuẩn độ sáng)'} ${avg('contrast')}; ${english ? 'mean saturation' : 'bão hòa trung bình'} ${avg('saturation')}%.`,
    limitations: english ? 'No trained vision model is loaded. Subjects, characters, actions, camera motion, audio, original tool and original prompts cannot be determined by these metrics. Scene cuts are estimates from sparse frame differences; fades or lighting changes can create false cuts. Prompts are editable templates with placeholders, not semantic reconstructions.' : 'Không tải mô hình AI Vision. Số đo pixel không xác định chủ thể, nhân vật, hành động, chuyển động camera, âm thanh, công cụ tạo hoặc prompt gốc. Ranh giới cảnh chỉ ước lượng từ ảnh mẫu; thay đổi ánh sáng/chuyển màu có thể bị tính là đổi cảnh. Prompt là mẫu có chỗ trống để điền, không phải mô tả ngữ nghĩa do AI nhận diện.',
    masterPrompt: base + goalNote,
    negativePrompt: 'Suggested only: blur, compression artifacts, flicker, inconsistent details, warped geometry, unintended text.',
    scenes: groups.map((group, index) => {
      const m=sceneMeasurements(rows,group.start,group.end);
      return ({
      start: group.start, end: group.end,
      description: (english ? `Visual segment ${index + 1}. Subject and action require manual description or AI.\n` : `Phân đoạn ${index + 1}. Cần tự mô tả hoặc dùng AI để xác định chủ thể và hành động.\n`)+measurementText(m,!english),
      camera: english ? 'Not identifiable from pixel statistics.' : 'Chưa xác định từ số đo pixel.',
      lighting: `Mean luminance ${m.luminance?.toFixed(1)??'unknown'}/255; measured from scene samples, not a lighting setup.`,
      motion: english ? 'Frame differences do not establish motion or camera direction.' : 'Khác biệt giữa ảnh không đủ xác định chuyển động hoặc hướng máy.',
      prompt: `Scene ${index + 1}, estimated ${group.start.toFixed(2)}–${group.end.toFixed(2)}s. ${base}${goalNote}`
    });}),
    localMetrics: { palette, luminance: avg('luminance'), contrast: avg('contrast'), saturation: avg('saturation'), samples: rows }
  };
  analysis.deep=buildDossier(analysis,meta,{local:true});
  if(goal) {analysis.deep.masterPromptVi+=`\nGhi chú sáng tạo do người dùng cung cấp: ${JSON.stringify(goal.slice(0,1000))}`;analysis.deep.masterPromptEn+=goalNote;}
  analysis.masterPrompt=analysis.deep.masterPromptEn;
  analysis.scenes.forEach((scene,i)=>{scene.prompt=analysis.deep.sceneDetails[i].promptEn+goalNote;});
  return analysis;
}

export async function analyzeLocal(frames, meta, goal, language, onProgress = () => {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const samples = [];
  try {
    for (let i = 0; i < frames.length; i++) {
      const image = new Image(); image.src = frames[i].dataUrl; await image.decode();
      ctx.drawImage(image, 0, 0, 64, 64);
      samples.push({ timestamp: frames[i].timestamp, metrics: measurePixels(ctx.getImageData(0, 0, 64, 64).data,64,64) });
      onProgress(i + 1, frames.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return buildLocalAnalysis(samples, meta, goal, language);
  } finally { canvas.width = canvas.height = 0; }
}
