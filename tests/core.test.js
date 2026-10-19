import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTimes, validateVideoUrl, createPayload, parseResult, analyze, toMarkdown } from '../core.js';

const meta = { duration: 4, width: 640, height: 360, name: 'test.webm', frameCount: 2 };
const frames = [{ timestamp: 0, dataUrl: 'data:image/jpeg;base64,YQ==' }, { timestamp: 3.9, dataUrl: 'data:image/jpeg;base64,Yg==' }];
const output = { summary: 'Một sản phẩm', visualStyle: 'Điện ảnh', limitations: 'Ảnh mẫu; không âm thanh', masterPrompt: 'Product film', negativePrompt: 'Artifacts', scenes: [{ start: 0, end: 4, description: 'Sản phẩm', camera: 'Cận cảnh', lighting: 'Ánh sáng mềm', motion: 'Không xác định', prompt: 'Close-up of a product' }] };
const body = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('sampling covers short and long clips without seeking beyond duration', () => {
  for (const duration of [0.01, 4, 600]) {
    const times = sampleTimes(duration, 24);
    assert.equal(times.length, 24); assert.equal(times[0], 0);
    assert.ok(times.every((t, i) => t >= 0 && t < duration && (!i || t > times[i - 1])));
  }
  for (const value of [0, -1, Infinity, NaN, 601]) assert.throws(() => sampleTimes(value));
});
test('accepts Instagram reels and Facebook links; rejects deceptive hosts and schemes', () => {
  assert.equal(validateVideoUrl('https://www.instagram.com/reels/DepGcNqih2d/'), 'https://www.instagram.com/reels/DepGcNqih2d/');
  assert.ok(validateVideoUrl('https://www.facebook.com/watch/?v=123'));
  for (const url of ['javascript:alert(1)', 'http://instagram.com/reel/a', 'https://instagram.com.evil.com/reel/a', 'https://user@instagram.com/reel/a', 'https://instagram.com/']) assert.throws(() => validateVideoUrl(url));
});
test('payload contains ordered timestamped JPEGs and explicit uncertainty instructions', () => {
  const request = createPayload(frames, meta, 'vi', 'test note');
  assert.equal(request.contents[0].parts.length, 5);
  assert.equal(request.contents[0].parts[2].inlineData.data, 'YQ==');
  assert.match(request.contents[0].parts[0].text, /not full motion or audio/);
  assert.match(request.contents[0].parts[0].text, /test note/);
  assert.throws(() => createPayload([], meta));
});
test('rejects incomplete, malformed and out-of-range AI results', () => {
  assert.deepEqual(parseResult(body(output), 4), output);
  assert.throws(() => parseResult({ candidates: [{ finishReason: 'MAX_TOKENS' }] }, 4));
  assert.throws(() => parseResult(body({ ...output, scenes: [] }), 4));
  assert.throws(() => parseResult(body({ ...output, scenes: [{ ...output.scenes[0], end: 10 }] }), 4));
  assert.throws(() => parseResult(body({ ...output, scenes: [{ ...output.scenes[0], start: -1 }] }), 4));
});
test('Gemini request uses header authentication and handles quota errors without leaking key', async () => {
  let captured;
  const result = await analyze({ key: 'secret-test', model: 'gemini-2.5-flash', frames, meta, fetcher: async (url, options) => { captured = { url, options }; return { ok: true, json: async () => body(output) }; } });
  assert.equal(result.masterPrompt, output.masterPrompt);
  assert.ok(!captured.url.includes('secret-test'));
  assert.equal(captured.options.headers['x-goog-api-key'], 'secret-test');
  await assert.rejects(analyze({ key: 'secret-test', model: 'gemini-2.5-flash', frames, meta, fetcher: async () => ({ ok: false, status: 429 }) }), /hạn mức/);
  assert.match(toMarkdown(result, meta), /Close-up of a product/);
});
