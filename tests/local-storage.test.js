import test from 'node:test';
import assert from 'node:assert/strict';
import { measurePixels, frameDifference, segmentScenes, buildLocalAnalysis } from '../local.js';
import { Repository, validateSettings, fingerprint } from '../storage.js';
import { representativeFrames, htmlReport, parseAnalysis, sampleTimes } from '../core.js';

const solid = (r, g, b) => new Uint8ClampedArray(Array.from({ length: 16 }, () => [r, g, b, 255]).flat());
const red = measurePixels(solid(255, 0, 0)), blue = measurePixels(solid(0, 0, 255));
const samples = [{ timestamp: 0, metrics: red }, { timestamp: 1, metrics: red }, { timestamp: 2, metrics: blue }, { timestamp: 3, metrics: blue }];
const meta = { duration: 4, width: 720, height: 1280, frameCount: 4, name: 'test.mp4' };
test('pixel metrics measure actual luminance/saturation with no invented semantic fields', () => {
  assert.equal(red.saturation, 100); assert.equal(red.luminance, 54); assert.equal(red.contrast, 0);
  assert.equal(measurePixels(solid(255, 255, 255)).luminance, 255);
  assert.equal(measurePixels(solid(128, 128, 128)).saturation, 0);
  assert.equal(frameDifference(red, red), 0); assert.ok(frameDifference(red, blue) > .3);
  assert.equal(red.subject, undefined); assert.throws(() => measurePixels(new Uint8Array(0)));
});
test('scene segmentation uses image differences and estimates midpoint boundaries', () => {
  const scenes = segmentScenes(samples, 4);
  assert.equal(scenes.length, 2); assert.equal(scenes[0].end, 1.5); assert.equal(scenes[1].end, 4);
  assert.equal(segmentScenes(samples.map(s => ({ ...s, metrics: red })), 4).length, 1);
  const result = buildLocalAnalysis(samples, meta, 'perfume', 'vi');
  assert.match(result.limitations, /Không tải mô hình AI Vision/);
  assert.match(result.masterPrompt, /\[SUBJECT:/); assert.match(result.masterPrompt, /perfume/);
  assert.match(buildLocalAnalysis(samples, meta, '', 'en').summary, /not subjects/);
});
test('60 local frames are sampled down to 24 API frames including both endpoints', () => {
  const frames = sampleTimes(600, 60).map(timestamp => ({ timestamp }));
  const selected = representativeFrames(frames);
  assert.equal(selected.length, 24); assert.equal(selected[0], frames[0]); assert.equal(selected.at(-1), frames.at(-1));
});
function memoryAdapter() {
  let stored;
  return { get: async () => structuredClone(stored), set: async (key, value) => { stored = structuredClone(value); } };
}
test('settings and bounded history/cache round-trip; credentials and frames are not persisted', async () => {
  const adapter = memoryAdapter(), repo = new Repository(adapter); await repo.load();
  await repo.saveSettings({ ...repo.state.settings, maxFrames: 60, autoDetect: false });
  for (let i = 0; i < 23; i++) await repo.addReport({ id: String(i), createdAt: '2026-10-19', meta, analysis: buildLocalAnalysis(samples, meta), engine: 'local', elapsedMs: 20, key: 'MUST_NOT_STORE', frames: ['MUST_NOT_STORE'] }, String(i));
  const restored = new Repository(adapter); await restored.load();
  assert.equal(restored.state.settings.maxFrames, 60); assert.equal(restored.state.history.length, 20);
  assert.equal(Object.keys(restored.state.cache).length, 8);
  assert.ok(!JSON.stringify(restored.state).includes('MUST_NOT_STORE'));
  await restored.clearCache(); assert.equal(Object.keys(restored.state.cache).length, 0); assert.equal(restored.state.history.length, 20);
  await restored.clearHistory(); assert.equal(restored.state.history.length, 0);
  assert.throws(() => validateSettings({ ...restored.state.settings, maxFrames: 61 }));
});
test('cache fingerprints change with frame data, engine and creative goal', async () => {
  const original = await fingerprint([{ timestamp: 0, dataUrl: 'red' }], meta, { engine: 'local', goal: '' });
  assert.notEqual(original, await fingerprint([{ timestamp: 0, dataUrl: 'blue' }], meta, { engine: 'local', goal: '' }));
  assert.notEqual(original, await fingerprint([{ timestamp: 0, dataUrl: 'red' }], meta, { engine: 'cloud', goal: '' }));
  assert.equal(original.length, 64);
});
test('HTML exports escape active content; imported AI results discard unknown fields', () => {
  const output = buildLocalAnalysis(samples, meta);
  const parsed = parseAnalysis(JSON.stringify({ ...output, apiKey: 'NO', localMetrics: { palette: null } }), 4);
  assert.equal(parsed.apiKey, undefined); assert.equal(parsed.localMetrics, undefined);
  const html = htmlReport('<script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img')); assert.match(html, /&lt;script&gt;/);
});
