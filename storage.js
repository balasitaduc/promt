export const DEFAULT_SETTINGS = { language: 'both', maxFrames: 36, autoDetect: true, cache: true, theme: 'dark' };
const KEY = 'video_prompt_v2';
const EMPTY = () => ({ settings: { ...DEFAULT_SETTINGS }, history: [], cache: {} });

export function validateSettings(value) {
  const maxFrames = Number(value.maxFrames);
  if (!Number.isInteger(maxFrames) || maxFrames < 12 || maxFrames > 60) throw new Error('Số keyframe phải là số nguyên từ 12 đến 60.');
  if (!['both', 'vi', 'en'].includes(value.language) || !['dark', 'light'].includes(value.theme)) throw new Error('Cài đặt không hợp lệ.');
  return { language: value.language, maxFrames, autoDetect: !!value.autoDetect, cache: !!value.cache, theme: value.theme };
}

export class Repository {
  constructor(adapter) { this.adapter = adapter; this.state = EMPTY(); }
  async load() {
    const value = await this.adapter.get(KEY);
    if (value) {
      this.state = { ...EMPTY(), ...value };
      this.state.settings = validateSettings({ ...DEFAULT_SETTINGS, ...value.settings });
      if (!Array.isArray(this.state.history)) this.state.history = [];
      if (!this.state.cache || typeof this.state.cache !== 'object' || Array.isArray(this.state.cache)) this.state.cache = {};
    }
    return this.state;
  }
  async saveSettings(settings) {
    this.state.settings = validateSettings(settings);
    if (!settings.cache) this.state.cache = {};
    await this.persist();
  }
  async addReport(report, fingerprint) {
    // Retain only the normalized report. Never persist media, API keys or headers.
    const safe = { id: report.id, createdAt: report.createdAt, engine: report.engine, meta: report.meta, analysis: report.analysis, elapsedMs: report.elapsedMs };
    if (JSON.stringify(safe).length > 250000) throw new Error('Báo cáo quá lớn để lưu lịch sử (tối đa 250 KB). Bạn vẫn có thể xuất tệp.');
    this.state.history = [safe, ...this.state.history.filter(item => item.id !== safe.id)].slice(0, 20);
    if (this.state.settings.cache && fingerprint) {
      this.state.cache = { [fingerprint]: safe, ...Object.fromEntries(Object.entries(this.state.cache).filter(([key]) => key !== fingerprint).slice(0, 7)) };
    }
    await this.persist();
  }
  async clearCache() { this.state.cache = {}; await this.persist(); }
  async clearHistory() { this.state.history = []; await this.persist(); }
  async persist() { await this.adapter.set(KEY, this.state); }
}

export function browserAdapter() {
  if (globalThis.chrome?.storage?.local) return {
    get: async key => (await chrome.storage.local.get(key))[key],
    set: async (key, value) => chrome.storage.local.set({ [key]: value })
  };
  return {
    get: async key => JSON.parse(localStorage.getItem(key) || 'null'),
    set: async (key, value) => localStorage.setItem(key, JSON.stringify(value))
  };
}

export async function fingerprint(frames, meta, options) {
  const bytes = new TextEncoder().encode(JSON.stringify({ frames: frames.map(f => [f.timestamp, f.dataUrl]), meta, options }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, '0')).join('');
}
