chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

// Fallback for cross-origin video: capture only the requesting active tab.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'VP_SCREENSHOT' || !sender.tab?.id) return false;
  (async () => {
    const [active] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
    if (active?.id !== sender.tab.id) throw new Error('Giữ tab video ở phía trước khi lấy khung hình.');
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 85 });
    return { ok: true, dataUrl };
  })().then(respond).catch(() => respond({ ok: false, error: 'Trang chặn đọc ảnh. Bấm biểu tượng extension trên tab video để cấp quyền activeTab rồi thử lại, hoặc dùng tệp video.' }));
  return true;
});
