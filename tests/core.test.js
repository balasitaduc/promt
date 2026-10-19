import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTimes, validateVideoUrl, createPayload, parseResult, analyze, toMarkdown, createOpenAIPayload, listModels, buildWebPrompt } from '../core.js';

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

test('ChatGPT handoff includes timestamps and asks for images before inferring video content', () => {
  const prompt = buildWebPrompt(meta, frames, 'vi', 'Product advertising');
  assert.match(prompt, /Vietnamese/);
  assert.match(prompt, /0\.000, 3\.900/);
  assert.match(prompt, /If no image is attached/);
  assert.match(prompt, /Product advertising/);
  assert.match(prompt, /readable Markdown/);
  assert.throws(() => buildWebPrompt(meta, []));
});

test('OpenAI Responses payload sends actual frame images and requests JSON', async () => {
  const payload = createOpenAIPayload(frames, meta, 'gpt-4.1-mini');
  assert.equal(payload.input[0].content.filter(c => c.type === 'input_image').length, 2);
  assert.equal(payload.input[0].content[2].image_url, frames[0].dataUrl);
  assert.equal(payload.text.format.type, 'json_object');
  let captured;
  const result = await analyze({ provider: 'openai', key: 'test-openai-key', model: 'gpt-4.1-mini', frames, meta,
    fetcher: async (url, options) => {
      captured = { url, options };
      return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }) };
    } });
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-openai-key');
  assert.ok(!captured.url.includes('test-openai-key'));
  assert.deepEqual(result, output);
});

test('OpenAI rejects incomplete/refused output and errors explain model listing and separate billing', async () => {
  const options = { provider: 'openai', key: 'test-key', model: 'gpt-4.1-mini', frames, meta };
  for (const response of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Refused' }] }] }]) {
    await assert.rejects(analyze({ ...options, fetcher: async () => ({ ok: true, json: async () => response }) }));
  }
  for (const [status, expected] of [[404, /Tải danh sách model/], [429, /không bao gồm phí OpenAI API/], [401, /không thay thế API key/]]) {
    await assert.rejects(analyze({ ...options, fetcher: async () => ({ ok: false, status }) }), expected);
  }
});

test('Gemini model discovery follows pages and filters non-generative models', async () => {
  const urls = [];
  const models = await listModels({ provider: 'gemini', key: 'secret-key', fetcher: async (url, options) => {
    urls.push(url); assert.equal(options.headers['x-goog-api-key'], 'secret-key');
    return { ok: true, json: async () => urls.length === 1 ? {
      models: [{ name: 'models/gemini-available-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next/page'
    } : { models: [{ name: 'models/gemini-available-pro', supportedGenerationMethods: ['generateContent'] }] } };
  } });
  assert.deepEqual(models, ['gemini-available-flash', 'gemini-available-pro']);
  assert.match(urls[1], /pageToken=next%2Fpage/);
  assert.ok(urls.every(url => !url.includes('secret-key')));
});

test('OpenAI model discovery filters audio-only/nonvision families and does not send keys to other providers', async () => {
  const models = await listModels({ provider: 'openai', key: 'test-openai', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/models');
    assert.equal(options.headers.Authorization, 'Bearer test-openai');
    assert.equal(options.headers['x-goog-api-key'], undefined);
    return { ok: true, json: async () => ({ data: ['gpt-4.1-mini', 'gpt-4o-audio-preview', 'gpt-3.5-turbo', 'gpt-5', 'text-embedding-3-small'].map(id => ({ id })) }) };
  } });
  assert.deepEqual(models, ['gpt-4.1-mini', 'gpt-5']);
  await assert.rejects(listModels({ provider: 'other', key: 'x' }), /không hợp lệ/);
});
