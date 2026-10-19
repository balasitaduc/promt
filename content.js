// Video detection and frame sampling adapted from the uploaded content.js.
// Injected only after the user explicitly selects the current tab.
(() => {
  if (globalThis.__videoPromptInstalled) return;
  globalThis.__videoPromptInstalled = true;
  let running = false;
  function pickVideo() {
    return [...document.querySelectorAll('video')].filter(video => {
      const r = video.getBoundingClientRect();
      return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    }).sort((a, b) => Number(!b.paused) - Number(!a.paused) || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type !== 'VP_EXTRACT') return false;
    if (running) { respond({ ok: false, error: 'Đang lấy khung hình video. Vui lòng đợi.' }); return false; }
    running = true;
    (async () => {
      const video = pickVideo();
      if (!video) throw new Error('Không thấy video đang hiển thị. Mở và phát video rồi thử lại.');
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error('Video cần tải xong metadata và dài tối đa 10 phút; không hỗ trợ livestream.');
      const count = Number(message.count);
      if (!Number.isInteger(count) || count < 2 || count > 24) throw new Error('Số khung hình không hợp lệ.');
      const state = { time: video.currentTime, paused: video.paused };
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      const frames = [];
      let screenshotMode = false;
      async function screenshotFrame() {
        // Chrome limits captureVisibleTab to two calls per second.
        await new Promise(resolve => setTimeout(resolve, 600));
        const response = await chrome.runtime.sendMessage({ type: 'VP_SCREENSHOT' });
        if (!response?.ok) throw new Error(response?.error || 'Không chụp được vùng video.');
        const r = video.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) throw new Error('Đưa toàn bộ video vào vùng nhìn thấy rồi thử lại.');
        const image = new Image(); image.src = response.dataUrl; await image.decode();
        const crop = document.createElement('canvas'); crop.width = canvas.width; crop.height = canvas.height;
        const scaleX = image.width / innerWidth, scaleY = image.height / innerHeight;
        crop.getContext('2d').drawImage(image, r.left * scaleX, r.top * scaleY, r.width * scaleX, r.height * scaleY, 0, 0, crop.width, crop.height);
        const dataUrl = crop.toDataURL('image/jpeg', 0.78); crop.width = crop.height = 0;
        return dataUrl;
      }
      async function seek(time) {
        if (Math.abs(video.currentTime - time) < 0.025 && video.readyState >= 2) return;
        await new Promise((resolve, reject) => {
          const done = () => { cleanup(); resolve(); };
          const fail = () => { cleanup(); reject(new Error('Không thể tua video. Hãy tải tệp video và phân tích từ máy.')); };
          const timer = setTimeout(fail, 8000);
          const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
          video.addEventListener('seeked', done, { once: true });
          video.addEventListener('error', fail, { once: true });
          try { video.currentTime = time; } catch { fail(); }
        });
      }
      video.pause();
      try {
        for (let i = 0; i < count; i++) {
          await seek((duration - Math.min(0.1, duration / 10)) * i / (count - 1));
          let dataUrl;
          if (!screenshotMode) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try { dataUrl = canvas.toDataURL('image/jpeg', 0.78); }
            catch { screenshotMode = true; }
          }
          if (screenshotMode) dataUrl = await screenshotFrame();
          frames.push({ timestamp: video.currentTime, dataUrl });
        }
        return { ok: true, frames, meta: { name: document.title || 'Video trên tab', duration, width: video.videoWidth, height: video.videoHeight, frameCount: frames.length } };
      } finally {
        try { await seek(state.time); } catch { /* Page may have navigated. */ }
        if (!state.paused) video.play().catch(() => {});
        canvas.width = canvas.height = 0;
      }
    })().then(respond).catch(error => respond({ ok: false, error: error.message })).finally(() => { running = false; });
    return true;
  });
})();
