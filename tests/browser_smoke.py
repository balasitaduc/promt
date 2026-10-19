"""Chromium UI/content-script tests with mocked Chrome APIs and Gemini.

Cloud Chromium policy blocks unpacked extensions; this harness tests the actual
page modules and injected content.js in real browser pages without changing it.
"""
import base64
import json
import os
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = {
    'summary': 'Video tổng hợp đỏ và xanh', 'visualStyle': 'Hình học đơn giản',
    'limitations': 'Chỉ ảnh mẫu, không âm thanh', 'masterPrompt': 'A cinematic red-to-blue abstract film',
    'negativePrompt': 'Blur, artifacts',
    'scenes': [{'start': 0, 'end': 2, 'description': '<img src=x onerror=alert(1)>',
                'camera': 'Static', 'lighting': 'Flat', 'motion': 'Estimated color change',
                'prompt': 'A bright geometric square on a red and blue background'}]
}

with TemporaryDirectory() as temporary, sync_playwright() as playwright:
    context = playwright.chromium.launch_persistent_context(
        temporary, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        headless=True, accept_downloads=True,
        args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    )
    context.add_init_script('''window.chrome = {
      tabs: {
        create: async options => { window.requestedUrl = options.url; return {id:1,url:options.url,status:'complete'}; },
        get: async id => ({id,url:window.requestedUrl,status:'complete'}),
        query: async () => [{id:1,url:window.requestedUrl}],
        sendMessage: async (id, message) => { window.sentMessage = message; return window.testTabResponse; }
      },
      scripting: {executeScript: async options => [{result:true}]},
      runtime: {onMessage: {addListener: listener => {window.vpListener = listener;}}}
    };''')
    def serve_source(route):
        name = route.request.url.split('/')[-1] or 'sidepanel.html'
        path = ROOT / name
        if name not in ['sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'core.js']:
            route.fulfill(status=404); return
        content_type = 'text/javascript' if name.endswith('.js') else 'text/css' if name.endswith('.css') else 'text/html'
        route.fulfill(status=200, content_type=content_type, body=path.read_bytes())
    context.route('http://127.0.0.1:8765/**', serve_source)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8765/sidepanel.html')
    # Generate a real two-second WebM, then remux to add seekable file metadata.
    encoded = page.evaluate('''async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp8'});
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      const complete = new Promise(resolve => recorder.onstop = resolve);
      recorder.start();
      for (let i=0; i<40; i++) {
        ctx.fillStyle = i < 20 ? '#e02020' : '#2020e0'; ctx.fillRect(0,0,320,180);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(i*4,55,40,40);
        await new Promise(resolve => setTimeout(resolve,50));
      }
      recorder.stop(); await complete; stream.getTracks().forEach(t => t.stop());
      return await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.readAsDataURL(new Blob(chunks, {type:'video/webm'})); });
    }''')
    fixture = Path(temporary) / 'sample.webm'
    raw = Path(temporary) / 'recording.webm'
    raw.write_bytes(base64.b64decode(encoded))
    # MediaRecorder emits a live-style WebM without duration; remux into a file.
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(raw), '-c', 'copy', str(fixture)], check=True)
    encoded = base64.b64encode(fixture.read_bytes()).decode()
    page.locator('#frame-count').select_option('6')
    page.locator('#video-file').set_input_files(fixture)
    expect(page.locator('#extract')).to_be_enabled()
    page.locator('#extract').click()
    expect(page.locator('#frames img')).to_have_count(6, timeout=30000)
    # Ensure seeks captured different content, not six copies of frame zero.
    images = page.locator('#frames img').evaluate_all('(images) => images.map(i => i.src)')
    assert len(set(images)) >= 4, 'Frames must contain distinct video positions'
    with page.expect_download() as download:
        page.locator('#export-frames').click()
    assert Path(download.value.path()).stat().st_size > 1000
    print('PASS: actual UI modules load, local video seeks to six distinct frames, JPEG contact sheet exports')

    # Open the user-provided URL shape with a controlled Instagram page.
    social_html = f'<html><head><title>Test Reel</title></head><body style="margin:0"><video width="320" height="180" controls autoplay muted src="data:video/webm;base64,{encoded}"></video></body></html>'
    context.route('https://www.instagram.com/reels/DepGcNqih2d/', lambda route: route.fulfill(status=200, content_type='text/html', body=social_html))
    social = context.new_page()
    social.goto('https://www.instagram.com/reels/DepGcNqih2d/')
    social.wait_for_function('document.querySelector("video").readyState >= 2')
    social.evaluate('(v) => {v.pause(); v.currentTime = 0.25;}', social.query_selector('video'))
    social.wait_for_function('!document.querySelector("video").seeking')
    social.evaluate((ROOT / 'content.js').read_text())
    tab_result = social.evaluate('''() => new Promise(resolve => window.vpListener({type:'VP_EXTRACT',count:6}, {}, resolve))''')
    assert tab_result['ok'], tab_result
    assert len(tab_result['frames']) == 6
    assert len(set(f['dataUrl'] for f in tab_result['frames'])) >= 4
    assert abs(social.locator('video').evaluate('(v) => v.currentTime') - 0.25) < 0.05
    page.evaluate('(response) => {window.testTabResponse = response;}', tab_result)
    page.locator('#video-url').fill('https://www.instagram.com/reels/DepGcNqih2d/')
    page.locator('#open-link').click()
    expect(page.locator('#video-info')).to_contain_text('Test Reel', timeout=40000)
    expect(page.locator('#frames img')).to_have_count(6)
    assert social.url == 'https://www.instagram.com/reels/DepGcNqih2d/'
    assert page.evaluate('window.requestedUrl') == social.url
    print('PASS: Instagram link flow executes real content.js and returns six frames (mock Chrome APIs/page)')

    requests = []
    def gemini(route):
        requests.append(route.request)
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(OUTPUT)}]}}]}))
    context.route('https://generativelanguage.googleapis.com/**', gemini)
    page.locator('#api-key').fill('test-not-a-real-key')
    expect(page.locator('#analyze')).to_be_disabled()
    page.locator('#consent').check()
    page.locator('#analyze').click()
    expect(page.locator('#results')).to_be_visible(timeout=15000)
    expect(page.locator('#result-body')).to_contain_text(OUTPUT['masterPrompt'])
    assert page.locator('#result-body img').count() == 0, 'AI output must render as text, never HTML'
    payload = json.loads(requests[0].post_data)
    assert sum('inlineData' in part for part in payload['contents'][0]['parts']) == 6
    assert 'test-not-a-real-key' not in requests[0].url
    for button, suffix in [('export-md', '.md'), ('export-json', '.json')]:
        with page.expect_download() as download:
            page.locator('#' + button).click()
        content = Path(download.value.path()).read_text()
        assert OUTPUT['masterPrompt'] in content
        assert download.value.suggested_filename.endswith(suffix)
    print('PASS: consent gates API, six JPEGs sent, AI output safe, Markdown and JSON exports valid (mock API)')
    context.unroute('https://generativelanguage.googleapis.com/**')
    context.route('https://generativelanguage.googleapis.com/**', lambda route: route.fulfill(status=429, body='{}'))
    page.locator('#analyze').click()
    expect(page.locator('#status')).to_contain_text('hạn mức')
    expect(page.locator('#results')).to_be_hidden()
    expect(page.locator('#analyze')).to_be_enabled()
    assert not errors, errors
    print('PASS: quota error is actionable, stale results cleared, retry enabled, no browser script errors')
    context.close()
