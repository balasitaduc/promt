import { MAX_FILE_SIZE, sampleTimes, formatTime, analyze, toMarkdown, validateVideoUrl, API_PROVIDERS, listModels, buildWebPrompt } from './core.js';

const $ = id => document.getElementById(id);
const video = $('preview');
let objectUrl, frames = [], meta = null, result = null, busy = false, fileReady = false, controller;
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function controls() {
  $('video-file').disabled = busy;
  $('capture-tab').disabled = busy;
  $('open-link').disabled = busy;
  $('video-url').disabled = busy;
  $('frame-count').disabled = busy;
  $('provider').disabled = busy;
  $('model').disabled = busy;
  $('api-key').disabled = busy;
  $('load-models').disabled = busy || !$('api-key').value.trim();
  $('extract').disabled = busy || !fileReady;
  $('analyze').disabled = busy || $('provider').value === 'web' || !frames.length || !$('api-key').value.trim() || !$('consent').checked;
  $('export-frames').disabled = busy;
  for (const id of ['web-frames', 'web-copy', 'web-prompt-file']) $(id).disabled = busy || !frames.length;
  video.controls = !busy;
}
function clearResults() {
  result = null;
  $('results').hidden = true;
  $('result-body').replaceChildren();
}
function clearFrames() {
  frames = [];
  $('frames').replaceChildren();
  $('export-frames').hidden = true;
  clearResults();
  updateWebPrompt();
}
function updateWebPrompt() {
  $('chatgpt-prompt').value = frames.length && meta ? buildWebPrompt(meta, frames, $('language').value, $('goal').value) : '';
}
function showFrames() {
  $('frames').replaceChildren(...frames.map(frame => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = frame.dataUrl;
    image.alt = `Khung hình tại ${formatTime(frame.timestamp)}`;
    const caption = document.createElement('figcaption');
    caption.textContent = formatTime(frame.timestamp);
    figure.append(image, caption);
    return figure;
  }));
  $('export-frames').hidden = !frames.length;
  $('video-info').textContent = `${meta.name} · ${meta.width} × ${meta.height} · ${meta.duration.toFixed(1)} giây · ${frames.length} khung hình`;
  updateWebPrompt();
  controls();
}
function waitEvent(target, name, action, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(name, done); target.removeEventListener('error', fail); };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Không đọc/tua được video. Thử tệp MP4 (H.264) hoặc WebM có codec được Chrome hỗ trợ.')); };
    const timer = setTimeout(fail, timeout);
    target.addEventListener(name, done, { once: true });
    target.addEventListener('error', fail, { once: true });
    try { action(); } catch { fail(); }
  });
}
async function seek(time) {
  if (Math.abs(video.currentTime - time) < 0.025 && video.readyState >= 2) return;
  await waitEvent(video, 'seeked', () => { video.currentTime = time; });
}
async function run(task) {
  if (busy) return;
  busy = true; controls();
  try { await task(); }
  catch (error) { status(error.message || 'Có lỗi xảy ra. Hãy thử lại.', true); }
  finally { busy = false; $('progress').hidden = true; controls(); }
}
$('video-file').addEventListener('change', () => run(async () => {
  clearFrames(); fileReady = false; meta = null;
  video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  const file = $('video-file').files[0];
  if (!file) { $('video-info').textContent = 'Chưa chọn video.'; return; }
  $('video-info').textContent = file.name;
  if (file.size > MAX_FILE_SIZE) throw new Error('Tệp quá lớn. Chọn video tối đa 250 MB.');
  objectUrl = URL.createObjectURL(file);
  status('Đang đọc video…');
  await waitEvent(video, 'loadeddata', () => { video.src = objectUrl; video.load(); });
  sampleTimes(video.duration, Number($('frame-count').value));
  if (!video.videoWidth || !video.videoHeight) throw new Error('Tệp không chứa hình ảnh video hợp lệ.');
  meta = { name: file.name, duration: video.duration, width: video.videoWidth, height: video.videoHeight, frameCount: 0 };
  fileReady = true; video.hidden = false;
  $('video-info').textContent = `${file.name} · ${meta.width} × ${meta.height} · ${meta.duration.toFixed(1)} giây`;
  status('Đã đọc video. Bấm “Lấy khung hình từ tệp” để xem ảnh mẫu.');
}));

$('extract').addEventListener('click', () => run(async () => {
  clearFrames();
  const times = sampleTimes(video.duration, Number($('frame-count').value));
  const savedTime = video.currentTime, wasPaused = video.paused;
  video.pause();
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 960 / Math.max(meta.width, meta.height));
  canvas.width = Math.round(meta.width * scale); canvas.height = Math.round(meta.height * scale);
  const ctx = canvas.getContext('2d');
  const collected = [];
  $('progress').hidden = false; $('progress').value = 0;
  try {
    for (let i = 0; i < times.length; i++) {
      status(`Đang lấy khung hình ${i + 1}/${times.length}…`);
      await seek(times[i]);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      collected.push({ timestamp: video.currentTime, dataUrl: canvas.toDataURL('image/jpeg', 0.78) });
      $('progress').value = (i + 1) / times.length * 100;
    }
    frames = collected; meta.frameCount = frames.length;
    showFrames(); status('Đã lấy khung hình. Kiểm tra ảnh trước khi gửi phân tích.');
  } finally {
    try { await seek(savedTime); } catch { /* Keep the extraction error if any. */ }
    if (!wasPaused) video.play().catch(() => {});
    canvas.width = canvas.height = 0;
  }
}));

async function captureTab(tab) {
  status('Đang lấy khung hình trên tab; vui lòng giữ nguyên video và không chuyển trang…');
  if (!globalThis.chrome?.tabs || !chrome.scripting) throw new Error('Chức năng này cần chạy trong extension Chrome/Edge.');
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Chọn tab trang web có video rồi mở extension bằng biểu tượng trên thanh công cụ.');
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'VP_EXTRACT', count: Number($('frame-count').value) });
  if (!response?.ok) throw new Error(response?.error || 'Không kết nối được video trên tab.');
  clearFrames(); video.pause(); video.hidden = true; fileReady = false;
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  video.removeAttribute('src'); video.load(); $('video-file').value = '';
  frames = response.frames; meta = response.meta;
  showFrames(); status('Đã lấy khung hình từ tab. Video đã được trả về vị trí ban đầu.');
}
$('capture-tab').addEventListener('click', () => run(async () => {
  if (!globalThis.chrome?.tabs) throw new Error('Hãy mở giao diện trong extension Chrome/Edge.');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await captureTab(tab);
}));
$('open-link').addEventListener('click', () => run(async () => {
  const url = validateVideoUrl($('video-url').value);
  if (!globalThis.chrome?.tabs) throw new Error('Hãy mở giao diện trong extension Chrome/Edge.');
  const tab = await chrome.tabs.create({ url, active: true });
  status('Đang mở link. Nếu trang yêu cầu đăng nhập, hãy đăng nhập trên tab video…');
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const current = await chrome.tabs.get(tab.id);
    if (current.status !== 'complete') continue;
    let ready = false;
    try {
      const [probe] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => [...document.querySelectorAll('video')].some(v => { const r = v.getBoundingClientRect(); return v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 0 && r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight; }) });
      ready = probe?.result;
    } catch { /* Login redirects may temporarily have no script access. */ }
    if (ready) { await captureTab(current); return; }
  }
  throw new Error('Chưa đọc được video từ link. Đăng nhập nếu cần, đóng hộp thoại và phát đúng video trên tab vừa mở; sau đó bấm “Lấy video từ tab đang mở”.');
}));

for (const id of ['api-key', 'consent']) $(id).addEventListener('input', controls);
for (const id of ['goal', 'language']) $(id).addEventListener('input', updateWebPrompt);
function selectProvider() {
  const provider = $('provider').value;
  const isWeb = provider === 'web';
  $('web-mode').hidden = !isWeb; $('api-mode').hidden = isWeb;
  $('api-key').value = ''; $('consent').checked = false;
  $('model-options').replaceChildren();
  if (!isWeb) {
    const config = API_PROVIDERS[provider];
    $('api-summary').textContent = `Kết nối ${config.label} API`;
    $('api-key-label').textContent = `${config.label} API key`;
    $('model').value = config.defaultModel;
    $('key-link').href = config.keyUrl;
    $('key-link').textContent = provider === 'openai' ? 'OpenAI Platform' : 'Google AI Studio';
    $('consent-text').textContent = `Tôi đồng ý gửi các khung hình và ghi chú đến ${config.label} để phân tích. API có thể tính phí theo tài khoản của tôi.`;
  }
  controls();
}
$('provider').addEventListener('change', selectProvider);
$('api-key').addEventListener('input', () => { $('model-options').replaceChildren(); });
$('load-models').addEventListener('click', () => run(async () => {
  status('Đang tải các model khả dụng cho API key của bạn…');
  const models = await listModels({ provider: $('provider').value, key: $('api-key').value, signal: AbortSignal.timeout(20000) });
  $('model-options').replaceChildren(...models.map(model => {
    const option = document.createElement('option'); option.value = model; return option;
  }));
  if (!models.length) throw new Error('Không tìm thấy model phù hợp cho key này. Chuyển sang ChatGPT web hoặc kiểm tra quyền API.');
  if (!models.includes($('model').value)) $('model').value = models[0];
  status(`Đã tải ${models.length} model. Chọn trong ô model; kiểm tra model có hỗ trợ ảnh và JSON trước khi phân tích.`);
}));
$('analyze').addEventListener('click', () => run(async () => {
  if (!$('consent').checked) throw new Error('Cần đồng ý gửi khung hình trước khi phân tích.');
  const provider = $('provider').value;
  const providerName = API_PROVIDERS[provider]?.label;
  if (!providerName) throw new Error('Chọn OpenAI API hoặc Gemini API để phân tích tự động.');
  clearResults();
  controller = new AbortController();
  $('cancel').hidden = false;
  const timeout = setTimeout(() => controller?.abort('timeout'), 120000);
  status(`${providerName} đang phân tích các khung hình…`);
  // Keep result metadata consistent if controls are edited while the request is pending.
  const runMeta = { ...meta };
  try {
    const output = await analyze({ provider, key: $('api-key').value, model: $('model').value.trim(), frames, meta: runMeta, language: $('language').value, goal: $('goal').value, signal: controller.signal });
    if (controller.signal.aborted) return;
    result = output;
    renderResult();
    $('results').hidden = false;
    status('Đã tạo phân tích và prompt. Bạn có thể sao chép hoặc tải kết quả.');
  } catch (error) {
    if (controller.signal.aborted) status(controller.signal.reason === 'timeout' ? 'AI phản hồi quá thời gian 120 giây. Hãy thử lại với ít khung hình hơn.' : 'Đã hủy yêu cầu AI.');
    else if (error instanceof TypeError) throw new Error(`Không kết nối được ${providerName}. Kiểm tra Internet và quyền truy cập API.`);
    else throw error;
  } finally {
    clearTimeout(timeout); controller = null; $('cancel').hidden = true;
  }
}));
$('cancel').addEventListener('click', () => controller?.abort('user'));

function textBlock(parent, title, value, prompt = false) {
  const heading = document.createElement('h4'); heading.textContent = title;
  const text = document.createElement('div'); text.className = `result-text${prompt ? ' prompt' : ''}`; text.textContent = value;
  parent.append(heading, text);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); status('Đã sao chép vào clipboard.'); }
  catch { status('Không thể ghi clipboard. Bạn có thể chọn văn bản hoặc tải tệp .md.', true); }
}
function renderResult() {
  const root = $('result-body'); root.replaceChildren();
  textBlock(root, 'Tổng quan', result.summary);
  textBlock(root, 'Phong cách hình ảnh', result.visualStyle);
  textBlock(root, 'Prompt tổng · English', result.masterPrompt, true);
  textBlock(root, 'Negative prompt gợi ý', result.negativePrompt, true);
  result.scenes.forEach((scene, index) => {
    const section = document.createElement('article'); section.className = 'scene';
    textBlock(section, `Cảnh ${index + 1} · ${formatTime(scene.start)} – ${formatTime(scene.end)} (ước lượng)`, scene.description);
    textBlock(section, 'Camera · Ánh sáng · Chuyển động', `${scene.camera}\n${scene.lighting}\n${scene.motion}`);
    textBlock(section, 'Prompt cảnh · English', scene.prompt, true);
    const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Sao chép prompt cảnh';
    button.addEventListener('click', () => copy(scene.prompt)); section.append(button); root.append(section);
  });
  textBlock(root, 'Giới hạn phân tích', result.limitations);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('copy-all').addEventListener('click', () => result && copy(toMarkdown(result, meta)));
$('export-md').addEventListener('click', () => result && download(new Blob([toMarkdown(result, meta)], { type: 'text/markdown;charset=utf-8' }), 'video-prompt.md'));
$('export-json').addEventListener('click', () => result && download(new Blob([JSON.stringify({ metadata: meta, analysis: result }, null, 2)], { type: 'application/json' }), 'video-prompt.json'));
$('web-copy').addEventListener('click', () => copy($('chatgpt-prompt').value));
$('web-prompt-file').addEventListener('click', () => download(new Blob([$('chatgpt-prompt').value], { type: 'text/plain;charset=utf-8' }), 'chatgpt-instructions.txt'));
async function exportFrames() {
  const canvas = document.createElement('canvas'), columns = 3, cellW = 320, cellH = 210;
  canvas.width = columns * cellW; canvas.height = Math.ceil(frames.length / columns) * cellH;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < frames.length; i++) {
    const image = new Image(); image.src = frames[i].dataUrl; await image.decode();
    const scale = Math.min((cellW - 12) / image.width, (cellH - 34) / image.height);
    const x = (i % columns) * cellW, y = Math.floor(i / columns) * cellH;
    ctx.drawImage(image, x + (cellW - image.width * scale) / 2, y + 4, image.width * scale, image.height * scale);
    ctx.fillStyle = '#e7edf6'; ctx.font = '14px sans-serif'; ctx.fillText(formatTime(frames[i].timestamp), x + 12, y + cellH - 10);
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Không tạo được bảng khung hình.');
  download(blob, 'video-frames.jpg'); status('Đã tải bảng khung hình.');
}
$('export-frames').addEventListener('click', () => run(exportFrames));
$('web-frames').addEventListener('click', () => run(exportFrames));
window.addEventListener('pagehide', () => {
  controller?.abort('closed'); $('api-key').value = '';
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
selectProvider();
