import { MAX_FILE_SIZE, sampleTimes, formatTime, analyze, analyzeInDepth, validateVideoUrl, API_PROVIDERS, listModels, buildInstruction, representativeFrames, parseAnalysis } from './core.js';
import { analyzeLocal } from './local.js';
import { Repository, browserAdapter, fingerprint } from './storage.js';
import { REPORT_TABS, renderReport, reportMarkdown } from './reports.js';
import { attachMeasurements, verifyFrameEvidence } from './deep.js';
import { LocalVision, visionSceneInputs, applyCaptions } from './vision.js';
import { VISION_MODEL } from './vision-config.js';

const $ = id => document.getElementById(id);
const video = $('preview'), repository = new Repository(browserAdapter());
const localVision = new LocalVision();
const state = { source: 'tab', engine: 'local', busy: false, scanning: false, fileReady: false, objectUrl: null, meta: null, candidates: [], tabId: null, selectedId: '', frames: [], frameKey: '', sourceKey: '', report: null, reportTab: 0, selectedScene: 0, localAnalysis: null, persistenceError: null, controller: null };
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function progress(value, label) { $('progress').value = value; $('progress-percent').textContent = `${Math.round(value)}%`; $('progress-label').textContent = label; }
function settings() { return repository.state.settings; }
function frameCount() { return $('quality').value === 'fast' ? 12 : $('quality').value === 'deep' ? settings().maxFrames : Math.min(36, settings().maxFrames); }
function language() { return settings().language === 'en' ? 'en' : 'vi'; }
function clearFrames() {
  state.frames = []; state.frameKey = ''; $('frames').replaceChildren(); $('frame-count-label').textContent = 'Khung hình mẫu · 0'; updateWebPrompt();
  state.localAnalysis = null;
}
function resetReport() { state.report = null; state.selectedScene = 0; state.persistenceError = null; $('run-id').textContent = 'Chưa tạo báo cáo'; render(); }
function controls() {
  for (const id of ['source-tab', 'source-link', 'source-file', 'video-file', 'open-link', 'video-url', 'video-select', 'capture-tab', 'quality', 'provider', 'api-key', 'model', 'goal', 'settings-open', 'history-open', 'release-memory', 'clear-cache', 'local-vision', 'clear-model-cache', 'deep-passes']) $(id).disabled = state.busy;
  document.querySelectorAll('[data-engine]').forEach(button => { button.disabled = state.busy; });
  const canAnalyze = state.source !== 'history' && (state.source !== 'file' || state.fileReady);
  const requiresKey = API_PROVIDERS[$('provider').value].requiresKey !== false;
  const apiReady = state.engine !== 'cloud' || ((!requiresKey || $('api-key').value.trim()) && $('model').value.trim() && $('consent').checked);
  $('analyze').disabled = state.busy || !canAnalyze || !apiReady;
  $('reanalyze').disabled = $('analyze').disabled;
  $('load-models').disabled = state.busy || (requiresKey && !$('api-key').value.trim());
  for (const id of ['web-frames', 'web-copy', 'web-prompt-file', 'export-frames']) $(id).disabled = state.busy || !state.frames.length;
  $('import-result').disabled = state.busy || !state.frames.length || !$('import-json').value.trim();
  for (const id of ['copy-result', 'export-open']) $(id).disabled = !state.report || state.busy;
  $('analyze').textContent = state.engine === 'web' ? 'CHUẨN BỊ STORYBOARD + PROMPT' : 'PHÂN TÍCH VIDEO';
  video.controls = !state.busy;
}
async function run(task) {
  if (state.busy) return;
  state.busy = true; controls();
  try { await task(); }
  catch (error) { $('state').textContent = error.name === 'AbortError' ? 'CANCELLED' : error.code?.startsWith('MODEL_') ? 'MODEL_ERROR' : 'ERROR'; status(error.message || 'Có lỗi xảy ra. Hãy thử lại.', true); if(error.code?.startsWith('MODEL_'))$('engine-status').textContent=error.message; }
  finally { state.busy = false; controls(); }
}
function updateMeta() {
  const meta = state.meta;
  $('duration').textContent = meta ? `${meta.duration.toFixed(1)} giây` : '—';
  $('dimensions').textContent = meta ? `${meta.width}×${meta.height} (${meta.width === meta.height ? '1:1' : meta.width < meta.height ? 'dọc' : 'ngang'})` : '—';
  $('video-info').textContent = meta?.url || meta?.name || 'Chọn video để bắt đầu'; $('video-info').title = $('video-info').textContent;
  $('detect-light').classList.toggle('on', !!meta);
  $('detection-status').textContent = !meta ? 'Chưa phát hiện video' : state.source === 'file' ? 'Đã đọc tệp video' : state.source === 'history' ? 'Báo cáo từ lịch sử' : /instagram\.com/.test(meta.url || '') ? 'Đã phát hiện video Instagram' : /facebook\.com|fb\.watch/.test(meta.url || '') ? 'Đã phát hiện video Facebook' : 'Đã phát hiện video trên tab';
  controls();
}
function chooseSource(source) {
  if (state.busy) return;
  state.source = source; clearFrames(); state.meta = null; state.selectedId = ''; resetReport();
  for (const name of ['tab', 'link', 'file']) {
    $(`source-${name}`).setAttribute('aria-selected', String(name === source)); $(`${name}-source`).hidden = name !== source;
  }
  $('source-badge').textContent = source === 'tab' ? 'Video đang mở' : source === 'link' ? 'Dán link video' : 'Tệp trên máy';
  if (source !== 'file') { video.pause(); }
  if (source === 'file' && state.fileReady) {
    state.meta = { name: $('video-file').files[0].name, duration: video.duration, width: video.videoWidth, height: video.videoHeight, frameCount: 0 };
    state.sourceKey = `file:${state.objectUrl}`;
  }
  $('state').textContent = 'IDLE'; progress(0, 'Sẵn sàng'); updateMeta();
  if (source === 'tab') scan(true).catch(() => {});
}
for (const source of ['tab', 'link', 'file']) $(`source-${source}`).addEventListener('click', () => chooseSource(source));
function setEngine(engine) {
  if (state.busy) return;
  if (engine !== state.engine) { $('api-key').value = ''; $('consent').checked = false; }
  state.engine = engine;
  document.querySelectorAll('[data-engine]').forEach(button => { const selected = button.dataset.engine === engine; button.classList.toggle('selected', selected); button.setAttribute('aria-checked', String(selected)); });
  $('engine-badge').textContent = engine === 'local' ? 'LOCAL — MIỄN PHÍ' : engine === 'web' ? 'WEB AI — KHÔNG API' : 'CLOUD AI';
  $('web-mode').hidden = engine !== 'web'; $('api-mode').hidden = engine !== 'cloud'; $('local-mode').hidden = engine !== 'local';
  $('engine-status').textContent = engine === 'local' ? ($('local-vision').checked ? 'Caption AI cục bộ: tải model lần đầu khi bấm phân tích. Chưa chạy suy luận.' : 'Chỉ đo pixel; đã tắt caption AI.') : engine === 'web' ? 'Chuẩn bị ảnh + hướng dẫn; nhập JSON để tạo báo cáo AI.' : 'Chọn runtime, tải danh sách model hỗ trợ ảnh và cấu hình kết nối.';
  updateWebPrompt(); controls();
}
document.querySelectorAll('[data-engine]').forEach(button => button.addEventListener('click', () => setEngine(button.dataset.engine)));
function selectProvider() {
  const config = API_PROVIDERS[$('provider').value];
  $('api-key').value = ''; $('consent').checked = false; $('model-options').replaceChildren();
  $('model').value = config.defaultModel; $('model').placeholder = 'Bấm Tải danh sách model hỗ trợ ảnh'; $('api-key-label').textContent = config.requiresKey === false ? 'Ollama không cần API key' : `${config.label} ${$('provider').value==='huggingface'?'token (quyền Inference Providers)':'API key'}`;
  $('api-key').hidden = config.requiresKey === false;
  $('key-link').href = config.keyUrl; $('key-link').textContent = config.label;
  $('provider-hint').textContent = $('provider').value==='huggingface' ? 'HF Free tải được model mở, nhưng API không có credit miễn phí hằng tháng theo tài liệu hiện tại. Token cần quyền Inference Providers. Danh sách chỉ lấy model có khai báo hỗ trợ ảnh; khả năng nhiều ảnh/JSON còn tùy provider. Xem phí tại Hugging Face Billing.' : $('provider').value==='ollama' ? 'Cần cài và chạy Ollama trên máy này, tải model Vision (ví dụ qwen3-vl:4b hoặc :8b). Extension kết nối localhost:11434, không cần HF token/phí API. Tốc độ và bộ nhớ tùy model/phần cứng. Xem README nếu Chrome chặn kết nối.' : 'API tính phí riêng với gói ChatGPT. Tối đa 24 ảnh được gửi; báo cáo chuyên sâu có thể dùng nhiều token. Danh sách không bảo đảm model nào cũng hỗ trợ ảnh/JSON.';
  $('consent-text').textContent = config.requiresKey===false ? 'Tôi đồng ý gửi ảnh và ghi chú đến Ollama cục bộ trên máy này.' : `Tôi đồng ý gửi ảnh và ghi chú đến ${config.label}. API có thể tính phí.`; controls();
}
$('provider').addEventListener('change', selectProvider);
for (const id of ['api-key', 'consent', 'model', 'import-json']) $(id).addEventListener('input', controls);
$('api-key').addEventListener('input', () => $('model-options').replaceChildren());
$('goal').addEventListener('input', updateWebPrompt);
$('local-vision').addEventListener('change', async()=>{
  try { await repository.saveSettings({...settings(),localVision:$('local-vision').checked});setEngine(state.engine); }
  catch(error){$('local-vision').checked=settings().localVision;status(error.message,true);}
});
$('clear-model-cache').addEventListener('click',()=>run(async()=>{await localVision.clearCache();$('engine-status').textContent='Đã xóa cache trọng số model. Lần chạy caption tiếp theo sẽ tải lại.';status('Đã xóa cache model; lịch sử và cache báo cáo vẫn được giữ.');}));
$('load-models').addEventListener('click', () => run(async () => {
  status('Đang tải danh sách model bằng key của bạn…');
  const models = await listModels({ provider: $('provider').value, key: $('api-key').value, signal: AbortSignal.timeout(20000) });
  if (!models.length) throw new Error('Không tìm thấy model phù hợp. Chọn Web AI để dùng không cần API key.');
  $('model-options').replaceChildren(...models.map(name => { const option = element('option'); option.value = name; return option; }));
  if (!models.includes($('model').value)) $('model').value = models[0];
  status(`Đã tải ${models.length} model; chọn model có hỗ trợ ảnh và JSON.`);
}));

async function tabCommand(tabId, command) {
  try { return await chrome.tabs.sendMessage(tabId, command); }
  catch { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); return chrome.tabs.sendMessage(tabId, command); }
}
async function scan(quiet = false, explicitTab, duringWork = false) {
  if ((state.busy && !duringWork) || state.scanning || state.source === 'file' || state.source === 'history') return;
  const requestedSource = state.source;
  state.scanning = true;
  try {
    if (!globalThis.chrome?.tabs) throw new Error('Chức năng quét video cần chạy trong extension Chrome/Edge.');
    const tab = explicitTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Mở tab Facebook/Instagram có video và bấm biểu tượng extension.');
    if (quiet && !/^https:\/\/(www\.)?(instagram\.com|facebook\.com|m\.facebook\.com|fb\.watch)\//.test(tab.url)) return;
    const response = await tabCommand(tab.id, { type: 'VP_DETECT' });
    if (state.source !== requestedSource || (state.busy && !duringWork)) return;
    if (!response?.ok) throw new Error('Không nhận được thông tin video. Hãy phát video rồi Quét lại.');
    state.tabId = tab.id; state.candidates = response.candidates;
    const chosen = state.candidates.find(item => item.id === state.selectedId) || state.candidates[0];
    $('video-select').replaceChildren(...state.candidates.map((item, i) => { const option = element('option', `${i + 1}. ${item.name} · ${item.duration.toFixed(1)}s · ${item.width}×${item.height}`); option.value = item.id; return option; }));
    if (!chosen) {
      $('video-select').append(element('option', 'Chưa có video hiển thị')); state.meta = null; state.selectedId = ''; clearFrames();
      if (!quiet) status('Chưa thấy video. Phát đúng video, đóng hộp thoại và Quét lại.');
    } else {
      $('tab-source').hidden = false;
      const key = `${tab.id}:${chosen.id}`;
      if (key !== state.sourceKey) { clearFrames(); resetReport(); state.sourceKey = key; }
      state.selectedId = chosen.id; $('video-select').value = chosen.id;
      state.meta = { name: response.title || 'Video trên tab', url: response.url || tab.url, duration: chosen.duration, width: chosen.width, height: chosen.height, frameCount: state.frames.length };
      if (!quiet) status(`Phát hiện ${state.candidates.length} video. Chọn video cần phân tích rồi bấm nút bên dưới.`);
    }
    updateMeta();
  } catch (error) { if (!quiet) status(error.message, true); }
  finally { state.scanning = false; }
}
$('capture-tab').addEventListener('click', () => scan(false));
$('video-select').addEventListener('change', () => {
  const selected = state.candidates.find(item => item.id === $('video-select').value);
  if (!selected || !state.meta) return;
  clearFrames(); resetReport(); state.selectedId = selected.id; state.sourceKey = `${state.tabId}:${selected.id}`;
  state.meta = { ...state.meta, duration: selected.duration, width: selected.width, height: selected.height, frameCount: 0 }; updateMeta();
});
$('open-link').addEventListener('click', () => run(async () => {
  const url = validateVideoUrl($('video-url').value);
  if (!globalThis.chrome?.tabs) throw new Error('Mở giao diện trong extension Chrome/Edge để dùng link.');
  const tab = await chrome.tabs.create({ url, active: true });
  status('Đang mở link. Đăng nhập và phát video nếu trang yêu cầu…');
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const current = await chrome.tabs.get(tab.id);
    if (current.status !== 'complete') continue;
    try {
      const response = await tabCommand(tab.id, { type: 'VP_DETECT' });
      if (response?.candidates?.some(v => v.duration > 0 && v.width > 0)) {
        await scan(false, current, true); return;
      }
    } catch { /* Login redirects can temporarily deny access. */ }
  }
  throw new Error('Chưa đọc được video. Đăng nhập, phát video trên tab vừa mở rồi bấm Quét lại.');
}));
function waitEvent(target, name, action, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(name, done); target.removeEventListener('error', fail); };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Không đọc hoặc tua được video. Thử MP4 H.264 hoặc WebM có codec được hỗ trợ.')); };
    const timer = setTimeout(fail, timeout);
    target.addEventListener(name, done, { once: true }); target.addEventListener('error', fail, { once: true });
    try { action(); } catch { fail(); }
  });
}
async function seek(time) { if (Math.abs(video.currentTime - time) > 0.025 || video.readyState < 2) await waitEvent(video, 'seeked', () => { video.currentTime = time; }); }
$('video-file').addEventListener('change', () => run(async () => {
  clearFrames(); resetReport(); state.meta = null; state.fileReady = false;
  updateMeta();
  video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true;
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  const file = $('video-file').files[0];
  if (!file) { updateMeta(); return; }
  if (file.size > MAX_FILE_SIZE) throw new Error('Chọn tệp tối đa 250 MB.');
  status('Đang đọc video…'); state.objectUrl = URL.createObjectURL(file);
  await waitEvent(video, 'loadeddata', () => { video.src = state.objectUrl; video.load(); });
  sampleTimes(video.duration, frameCount());
  if (!video.videoWidth || !video.videoHeight) throw new Error('Tệp không chứa hình ảnh video hợp lệ.');
  state.fileReady = true; video.hidden = false; state.sourceKey = `file:${state.objectUrl}`;
  state.meta = { name: file.name, duration: video.duration, width: video.videoWidth, height: video.videoHeight, frameCount: 0 };
  $('state').textContent = 'READY'; updateMeta(); status('Đã đọc video. Bấm PHÂN TÍCH VIDEO để lấy ảnh và tạo báo cáo.');
}));
function checkCancelled() { if (state.controller?.signal.aborted) throw new Error('Đã hủy phân tích.'); }
async function extractFrames(force = false) {
  const count = frameCount(), key = `${state.sourceKey}:${count}`;
  if (!force && state.frames.length && state.frameKey === key) return;
  clearFrames(); progress(3, 'Trích xuất khung hình'); $('state').textContent = 'EXTRACTING';
  if (state.source === 'file') {
    const savedTime = video.currentTime, wasPaused = video.paused; video.pause();
    const canvas = document.createElement('canvas'), scale = Math.min(1, 960 / Math.max(state.meta.width, state.meta.height));
    canvas.width = Math.round(state.meta.width * scale); canvas.height = Math.round(state.meta.height * scale);
    const ctx = canvas.getContext('2d'), frames = [];
    try {
      const times = sampleTimes(state.meta.duration, count);
      for (let i = 0; i < times.length; i++) {
        checkCancelled(); await seek(times[i]); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({ timestamp: video.currentTime, dataUrl: canvas.toDataURL('image/jpeg', 0.78) });
        progress((i + 1) / times.length * 45, `Trích xuất khung hình ${i + 1}/${times.length}`);
      }
      state.frames = frames;
    } finally { try { await seek(savedTime); } catch {} if (!wasPaused) video.play().catch(() => {}); canvas.width = canvas.height = 0; }
  } else {
    const response = await tabCommand(state.tabId, { type: 'VP_EXTRACT', count, videoId: state.selectedId });
    if (!response?.ok) throw new Error(response?.error || 'Không lấy được khung hình video.');
    state.frames = response.frames;
    state.meta = { ...state.meta, ...response.meta };
  }
  checkCancelled(); state.meta.frameCount = state.frames.length; state.frameKey = key;
  $('frames').replaceChildren(...state.frames.map(frame => { const figure = element('figure'), img = element('img'); img.src = frame.dataUrl; img.alt = `Khung hình ${formatTime(frame.timestamp)}`; figure.append(img, element('figcaption', formatTime(frame.timestamp))); return figure; }));
  $('frame-count-label').textContent = `Khung hình mẫu · ${state.frames.length}`; updateWebPrompt(); updateMeta();
}
function updateWebPrompt() {
  const measured=state.localAnalysis?.deep?.sceneDetails?.map((scene,i)=>({start:state.localAnalysis.scenes[i].start,end:state.localAnalysis.scenes[i].end,measurements:scene.measurements}));
  $('chatgpt-prompt').value = state.frames.length && state.meta ? `${buildInstruction({...state.meta,measurements:measured}, language(), $('goal').value)}\nI attached a contact sheet of ${state.frames.length} frames in row-major chronological order. Timestamps in seconds: ${state.frames.map(frame => frame.timestamp.toFixed(3)).join(', ')}. If the image is missing, ask me to attach video-frames.jpg; do not infer the video from a link alone. Return the JSON object so I can import it into my extension.` : '';
}
async function saveReport(analysis, engine, elapsedMs, cacheKey) {
  state.report = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), engine, meta: { ...state.meta }, analysis, elapsedMs };
  try { await repository.addReport(state.report, cacheKey); }
  catch (error) { state.persistenceError=error.message; }
  state.reportTab = 0; $('run-id').textContent = state.report.id; render(); controls();
}
async function startAnalysis(force = false) {
  if (!state.meta && state.source !== 'file') await scan(false);
  if (!state.meta) { status('Chọn hoặc phát video trước khi phân tích.', true); return; }
  await run(async () => {
    resetReport(); const started = performance.now(); state.controller = new AbortController(); $('cancel').hidden = false;
    $('state').textContent='PREPARING';progress(1,'Chuẩn bị phân tích chuyên sâu');status('Đang chuẩn bị khung hình và đo dữ liệu theo cảnh…');
    let timeout;
    try {
      await extractFrames(force); checkCancelled();
      const options = { version: 4, engine: state.engine, localVision: state.engine==='local'&&$('local-vision').checked?VISION_MODEL:null, deepPasses:state.engine==='cloud'&&$('deep-passes').checked, provider: state.engine === 'cloud' ? $('provider').value : null, model: state.engine === 'cloud' ? $('model').value : null, language: language(), goal: $('goal').value };
      const cacheKey = await fingerprint(state.frames, state.meta, options);
      const cached = !force && settings().cache ? repository.state.cache[cacheKey] : null;
      if (cached && state.engine !== 'web') { state.report = cached; state.localAnalysis=cached.analysis; $('run-id').textContent = cached.id; $('state').textContent = 'CACHED'; progress(100, 'Đã đọc báo cáo từ cache'); render(); status('Đã dùng kết quả cache. Bấm Phân tích lại để chạy mới.'); return; }
      $('state').textContent='MEASURING';
      state.localAnalysis=await analyzeLocal(state.frames,state.meta,$('goal').value,language(),(current,total)=>{checkCancelled();progress(45+current/total*25,`Đo hình ảnh & lập cấu trúc cảnh ${current}/${total}`);});
      updateWebPrompt();
      if (state.engine === 'web') {
        state.report={id:crypto.randomUUID(),createdAt:new Date().toISOString(),engine:'Web AI Package · Số đo Local; chưa có suy luận AI',meta:{...state.meta},analysis:state.localAnalysis,elapsedMs:Math.round(performance.now()-started)};
        state.reportTab=0;$('run-id').textContent=state.report.id;render();
        $('state').textContent = 'WEB_READY'; progress(100, 'Storyboard + cấu trúc chuyên sâu đã sẵn sàng');
        $('engine-status').textContent = 'Đã đo ảnh theo cảnh. Gửi ảnh + hướng dẫn v3 lên Web AI để điền chủ thể, camera, kịch bản và prompt VI/EN.';
        status('Đã có timeline/số đo và mẫu 22 trường. Các nhận định nội dung vẫn chờ JSON từ Web AI.'); return;
      }
      $('state').textContent = 'ANALYZING'; let analysis, engine;
      if (state.engine === 'local') {
        engine = 'Local · đo pixel, không có mô hình Vision';
        analysis = state.localAnalysis;
        if($('local-vision').checked) {
          $('state').textContent='MODEL_LOADING';
          const result=await localVision.caption(visionSceneInputs(analysis,state.frames),{signal:state.controller.signal,onProgress:event=>{
            $('engine-status').textContent=event.message;
            if(event.stage==='inference'){$('state').textContent='INFERENCING';progress(75+(event.current-1)/event.total*20,event.message);}
            else progress(72,event.message);
          }});
          analysis=applyCaptions(analysis,result,state.meta);engine=`Local Vision caption · ${result.model} · WASM · ${result.captions.length} ảnh cảnh`;
        }
      } else {
        if (!$('consent').checked) throw new Error('Cần đồng ý gửi ảnh trước khi gọi API.');
        const selected = representativeFrames(state.frames), provider = $('provider').value, deepPasses=$('deep-passes').checked;
        engine = `${API_PROVIDERS[provider].label} API · ${$('model').value} · ${selected.length}/${state.frames.length} ảnh`;
        progress(60, `${API_PROVIDERS[provider].label} đang phân tích…`);
        timeout = setTimeout(() => state.controller?.abort('timeout'), provider==='ollama'||deepPasses?600000:180000);
        const measurements=state.localAnalysis.deep.sceneDetails.map((scene,i)=>({start:state.localAnalysis.scenes[i].start,end:state.localAnalysis.scenes[i].end,measurements:scene.measurements}));
        const request={ provider, key: $('api-key').value, model: $('model').value.trim(), frames:deepPasses?state.frames:selected, meta: {...state.meta,measurements}, language: language(), goal: $('goal').value, signal: state.controller.signal };
        analysis = deepPasses ? await analyzeInDepth({...request,onProgress:event=>{const message=event.stage==='scene'?`Phân tích riêng cảnh ${event.current}/${event.total} · ${event.frameCount} ảnh`:'Tổng hợp các cảnh, nhân vật và prompt';progress(70+(event.stage==='scene'?(event.current-1)/(event.total+1):.9)*25,message);$('engine-status').textContent=message;}}) : await analyze(request);
        if(deepPasses)engine+=` · ${analysis.analysisPasses.sceneCalls} lượt cảnh + 1 tổng hợp`;
        analysis=attachMeasurements(analysis,state.localAnalysis,state.meta);
      }
      checkCancelled(); const elapsed = Math.round(performance.now() - started);
      await saveReport(analysis, engine, elapsed, cacheKey);
      $('state').textContent = 'COMPLETED'; progress(100, 'Tạo báo cáo'); $('engine-status').textContent = `Hoàn tất: ${engine}. ${analysis.scenes.length} cảnh ước lượng.`;
      $('performance').textContent = `Tổng thời gian: ${elapsed} ms${performance.memory ? ` · JS heap hiện tại: ~${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB (không phải tổng RAM)` : ' · Trình duyệt không cung cấp số đo bộ nhớ'}`;
      const done=state.engine==='local' ? (analysis.localVision?'Đã tạo caption keyframe và báo cáo số đo. Các mục camera/diễn biến chưa được xác minh; dùng Web AI hoặc model Vision chuyên sâu khi cần.':'Đã tạo báo cáo số đo pixel và mẫu prompt. Chưa nhận diện nội dung; bật caption hoặc chọn Web AI/Vision chuyên sâu.') : 'Đã tạo báo cáo AI. Chọn cảnh trên timeline, đối chiếu bằng chứng và xem prompt VI/EN.';
      status(state.persistenceError?`Đã tạo báo cáo, nhưng chưa lưu được lịch sử/cache: ${state.persistenceError}`:done,!!state.persistenceError);
    } catch (error) {
      if (state.controller?.signal.aborted) {
        const cancelled = new Error(state.controller.signal.reason === 'timeout' ? 'Quá thời gian chờ runtime AI (1 lượt API 3 phút; Ollama/nhiều lượt 10 phút). Thử ít ảnh hơn hoặc đổi model.' : 'Đã hủy phân tích.');
        cancelled.name = 'AbortError'; throw cancelled;
      }
      throw error;
    } finally { clearTimeout(timeout); state.controller = null; $('cancel').hidden = true; }
  });
}
$('analyze').addEventListener('click', () => startAnalysis()); $('reanalyze').addEventListener('click', () => startAnalysis(true));
$('cancel').addEventListener('click', () => { state.controller?.abort('user'); if (state.tabId) chrome.tabs.sendMessage(state.tabId, { type: 'VP_CANCEL' }).catch(() => {}); });
$('import-json').addEventListener('input', controls);
$('import-result').addEventListener('click', () => run(async () => {
  if (!state.frames.length || !state.meta) throw new Error('Chuẩn bị khung hình cho video này trước khi nhập JSON.');
  const text = $('import-json').value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (text.length > 1000000) throw new Error('JSON quá lớn (tối đa 1 MB).');
  const analysis = parseAnalysis(text, state.meta.duration);
  verifyFrameEvidence(analysis.deep,state.frames);
  await saveReport(attachMeasurements(analysis,state.localAnalysis,state.meta), 'Web AI · JSON do người dùng nhập', 0);
  $('state').textContent = 'IMPORTED'; progress(100, 'Đã nhập & kiểm tra JSON'); status(state.persistenceError?`Đã nhập kết quả, nhưng chưa lưu được: ${state.persistenceError}`:'Đã nhập kết quả. Kiểm tra các bằng chứng timestamp và nội dung AI với video nguồn.',!!state.persistenceError);
}));
function render() {
  $('report-tabs').replaceChildren(...REPORT_TABS.map((title, index) => { const button = element('button', `${index + 1}. ${title}`); button.title = title; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(state.reportTab === index)); button.addEventListener('click', () => { state.reportTab = index; render(); }); return button; }));
  renderReport($('result-body'), state.report, state.reportTab, { frames: state.frames, copy, download, selectedScene:state.selectedScene, promptLanguage:settings().language, onScene:index=>{state.selectedScene=index;state.reportTab=1;render();document.querySelector(`.scene-card[data-scene="${index}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});},seek: async time => {
    try {
      if (state.source === 'file' && state.fileReady) await seek(time);
      else if (state.source !== 'history' && state.tabId) { const result = await tabCommand(state.tabId, { type: 'VP_SEEK', videoId: state.selectedId, time }); if (!result?.ok) throw new Error('Video không còn khả dụng. Quét lại video.'); }
      else throw new Error('Báo cáo lịch sử không giữ video. Chọn lại video nguồn để xem mốc.');
    } catch (error) { status(error.message, true); }
  } });
}
$('export-open').addEventListener('click', () => { state.reportTab = 11; render(); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('copy-result').addEventListener('click', () => state.report && copy(reportMarkdown(state.report)));
async function copy(text) { try { await navigator.clipboard.writeText(text); status('Đã sao chép vào clipboard.'); } catch { status('Không ghi được clipboard. Chọn văn bản hoặc tải tệp thay thế.', true); } }
function download(blob, name) { const url = URL.createObjectURL(blob), a = element('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function exportFrames() {
  const canvas = document.createElement('canvas'), columns = 3, cellW = 320, cellH = 210;
  canvas.width = columns * cellW; canvas.height = Math.ceil(state.frames.length / columns) * cellH;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < state.frames.length; i++) {
    const image = new Image(); image.src = state.frames[i].dataUrl; await image.decode();
    const scale = Math.min((cellW - 12) / image.width, (cellH - 34) / image.height), x = i % columns * cellW, y = Math.floor(i / columns) * cellH;
    ctx.drawImage(image, x + (cellW - image.width * scale) / 2, y + 4, image.width * scale, image.height * scale);
    const sceneIndex=state.report?.analysis.scenes.findIndex(scene=>state.frames[i].timestamp>=scene.start&&state.frames[i].timestamp<=scene.end)??-1;
    ctx.fillStyle = '#f5f8ff'; ctx.font = '14px sans-serif'; ctx.fillText(`${sceneIndex>=0?`S${String(sceneIndex+1).padStart(2,'0')} · `:''}F${String(i+1).padStart(3,'0')} · ${formatTime(state.frames[i].timestamp)}`, x + 12, y + cellH - 10);
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9)); canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Không tạo được bảng ảnh.'); download(blob, 'video-frames.jpg'); status('Đã tải Storyboard JPEG.');
}
for (const id of ['export-frames', 'web-frames']) $(id).addEventListener('click', () => run(exportFrames));
$('web-copy').addEventListener('click', () => copy($('chatgpt-prompt').value));
$('web-prompt-file').addEventListener('click', () => download(new Blob([$('chatgpt-prompt').value], { type: 'text/plain;charset=utf-8' }), 'chatgpt-instructions.txt'));
$('release-memory').addEventListener('click', () => { localVision.dispose(); clearFrames(); render(); video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true; $('video-file').value = ''; state.fileReady = false; if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = null; controls(); status('Đã dừng worker model và bỏ tham chiếu khung hình/tệp. Báo cáo vẫn có thể xuất; cache trọng số tải xuống vẫn giữ. Trình duyệt quyết định thời điểm thu hồi RAM/WASM.'); });
$('clear-cache').addEventListener('click', () => run(async () => { await repository.clearCache(); status('Đã xóa cache kết quả; lịch sử vẫn được giữ.'); }));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
$('settings-open').addEventListener('click', () => {
  $('settings-language').value = settings().language; $('settings-frames').value = settings().maxFrames; $('settings-auto').checked = settings().autoDetect; $('settings-cache').checked = settings().cache; $('settings-error').textContent = ''; $('settings-dialog').showModal();
});
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await repository.saveSettings({ ...settings(), language: $('settings-language').value, maxFrames: Number($('settings-frames').value), autoDetect: $('settings-auto').checked, cache: $('settings-cache').checked }); updateWebPrompt(); $('settings-dialog').close(); status('Đã lưu cài đặt trên trình duyệt này.'); }
  catch (error) { $('settings-error').textContent = error.message; }
});
$('theme').addEventListener('click', async () => { try { await repository.saveSettings({ ...settings(), theme: settings().theme === 'dark' ? 'light' : 'dark' }); document.documentElement.dataset.theme = settings().theme; } catch (error) { status(error.message, true); } });
function renderHistory() {
  $('history-list').replaceChildren();
  if (!repository.state.history.length) $('history-list').append(element('p', 'Chưa có báo cáo trong lịch sử.', 'hint'));
  for (const report of repository.state.history) {
    const article = element('article', undefined, 'history-item'), detail = element('div'), open = element('button', 'Mở lại');
    detail.append(element('strong', `${report.analysis.scenes.length} cảnh · ${report.meta.duration.toFixed(1)}s`), element('p', report.engine), element('p', `${report.meta.name} · ${new Date(report.createdAt).toLocaleString('vi-VN')}`));
    open.addEventListener('click', () => { video.pause(); clearFrames(); state.source = 'history'; state.meta = { ...report.meta }; state.report = report; state.reportTab = 0; $('state').textContent = 'HISTORY'; $('run-id').textContent = report.id; progress(100, 'Báo cáo từ lịch sử'); updateMeta(); render(); $('history-dialog').close(); status('Đã mở báo cáo lưu. Không giữ video/ảnh; chọn lại nguồn để chạy phân tích mới.'); });
    article.append(detail, open); $('history-list').append(article);
  }
}
$('history-open').addEventListener('click', () => { renderHistory(); $('history-dialog').showModal(); });
$('clear-history').addEventListener('click', async () => { try { await repository.clearHistory(); renderHistory(); status('Đã xóa lịch sử. Cache riêng có thể xóa bằng nút Xóa cache.'); } catch (error) { status(error.message, true); } });
globalThis.chrome?.runtime?.onMessage?.addListener((message, sender) => { if (message.type === 'VP_PROGRESS' && state.busy && sender?.tab?.id === state.tabId) progress(message.current / message.total * 45, `Trích xuất khung hình ${message.current}/${message.total}`); });
window.addEventListener('pagehide', () => { state.controller?.abort('closed');localVision.dispose(); $('api-key').value = ''; if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); });
try { await repository.load(); document.documentElement.dataset.theme = settings().theme; } catch (error) { status(`Không đọc được cài đặt lưu: ${error.message}`, true); }
$('local-vision').checked=settings().localVision;selectProvider(); setEngine('local');render(); controls();
if (settings().autoDetect) scan(true).catch(() => {});
setInterval(() => { if (settings().autoDetect && !document.hidden) scan(true).catch(() => {}); }, 4000);
