"""Exercise real UI, media and content script in Chromium; mock Chrome APIs and AI.
Cloud policy blocks loading unpacked extensions, so sidePanel and activeTab APIs
need a final installation check on the user's browser. No live AI keys required.
"""
import base64
import json
import os
import re
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = json.loads((ROOT/'tests/fixtures/deep-analysis.json').read_text())

with TemporaryDirectory() as temporary, sync_playwright() as playwright:
    context = playwright.chromium.launch_persistent_context(
        temporary, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        headless=True, accept_downloads=True, viewport={'width': 450, 'height': 980},
        args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    )
    context.add_init_script('''window.chrome = {
      tabs: {
        create: async options => { window.requestedUrl = options.url; return {id:1,url:options.url,status:'complete'}; },
        get: async id => ({id,url:window.requestedUrl,status:'complete'}),
        query: async () => [{id:1,url:window.requestedUrl || 'https://www.instagram.com/reels/DepGcNqih2d/'}],
        sendMessage: async (id, message) => {
          window.sentMessage = message;
          if (message.type === 'VP_DETECT') return window.testDetection;
          if (message.type === 'VP_EXTRACT') return window.testTabResponse;
          return {ok:true};
        }
      },
      scripting: {executeScript: async options => [{result:true}]},
      runtime: {onMessage: {addListener: listener => {window.vpListener = listener;}}, sendMessage: async () => ({ok:true})}
    };''')
    def serve_source(route):
        name = route.request.url.split('/')[-1] or 'sidepanel.html'
        path = ROOT / name
        if name not in ['sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'core.js', 'deep.js', 'local.js', 'reports.js', 'storage.js', 'vision.js', 'vision-config.js']:
            route.fulfill(status=404); return
        content_type = 'text/javascript' if name.endswith('.js') else 'text/css' if name.endswith('.css') else 'text/html'
        route.fulfill(status=200, content_type=content_type, body=path.read_bytes())
    context.route('http://127.0.0.1:8765/**', serve_source)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8765/sidepanel.html')
    expect(page.locator('[data-engine=local]')).to_have_attribute('aria-checked', 'true')
    expect(page.locator('#report-tabs button')).to_have_count(12)
    expect(page.locator('#api-mode')).to_be_hidden()
    page.locator('#local-vision').uncheck()
    expect(page.locator('#engine-status')).to_contain_text('Chỉ đo pixel')
    page.locator('#settings-open').click()
    page.locator('#settings-frames').fill('12')
    page.locator('#settings-auto').uncheck()
    page.locator('#settings-form button[type=submit]').click()
    expect(page.locator('#settings-dialog')).not_to_be_visible()
    page.reload()
    page.locator('#settings-open').click()
    expect(page.locator('#settings-frames')).to_have_value('12')
    page.locator('[data-close=settings-dialog]').click()
    print('PASS: screenshot-style dashboard, 12 report tabs and persisted settings load')

    encoded = page.evaluate('''async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp8'}), chunks=[];
      recorder.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(resolve => recorder.onstop = resolve); recorder.start();
      for(let i=0;i<40;i++) {ctx.fillStyle=i<20?'#e02020':'#2020e0';ctx.fillRect(0,0,320,180);ctx.fillStyle='#fff';ctx.fillRect(i*4,55,40,40);await new Promise(r=>setTimeout(r,50));}
      recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
      return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
    }''')
    raw, fixture = Path(temporary)/'recording.webm', Path(temporary)/'sample.webm'
    raw.write_bytes(base64.b64decode(encoded))
    subprocess.run(['ffmpeg','-v','error','-i',str(raw),'-c','copy',str(fixture)], check=True)
    encoded = base64.b64encode(fixture.read_bytes()).decode()
    page.locator('#source-file').click()
    page.locator('#video-file').set_input_files(fixture)
    expect(page.locator('#state')).to_have_text('READY')
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED', timeout=30000)
    expect(page.locator('#frames img')).to_have_count(12)
    images = page.locator('#frames img').evaluate_all('(images)=>images.map(i=>i.src)')
    assert len(set(images)) >= 4
    expect(page.locator('#result-body')).to_contain_text('không nhận diện chủ thể')
    assert page.locator('.timeline button').count() >= 2
    (ROOT/'dist').mkdir(exist_ok=True)
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(ROOT/'dist/v3-overview.png'),full_page=True)
    page.locator('.timeline button').nth(1).click()
    expect(page.locator('#report-tabs button').nth(1)).to_have_attribute('aria-selected','true')
    expect(page.locator('.scene-card[data-scene="1"]')).to_have_attribute('open','')
    assert page.locator('.scene-card[data-scene="1"] .field-table dt').count() == 22
    page.locator('#report-tabs button').nth(2).click()
    expect(page.locator('#copy-master-vi')).to_be_visible()
    expect(page.locator('#copy-master-en')).to_be_visible()
    expect(page.locator('#result-body')).to_contain_text('Image Prompt')
    expect(page.locator('#result-body')).to_contain_text('Video Prompt')
    saved = page.evaluate('JSON.parse(localStorage.getItem("video_prompt_v2"))')
    assert len(saved['history']) == 1 and len(saved['cache']) == 1
    assert len(saved['history'][0]['analysis']['scenes']) >= 2
    assert 'data:image' not in json.dumps(saved)
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('CACHED')
    page.locator('#reanalyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED')
    for index in range(12):
        page.locator('#report-tabs button').nth(index).click()
        assert page.locator('#result-body').inner_text().strip()
    page.locator('#report-tabs button').nth(6).click()
    expect(page.locator('#result-body')).to_contain_text('Audio chưa được phân tích')
    page.locator('#export-open').click()
    for button, suffix in [('export-json','.json'),('export-txt','.txt'),('export-md','.md'),('export-html','.html')]:
        with page.expect_download() as download: page.locator('#'+button).click()
        content = Path(download.value.path()).read_text()
        assert '[SUBJECT:' in content
        assert download.value.suggested_filename.endswith(suffix)
    print('PASS: local pixel analysis, multiple scenes, 12 distinct samples, cache, reanalysis and four export formats')
    (ROOT/'dist').mkdir(exist_ok=True)
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(ROOT/'dist/v2-export.png'), full_page=True)
    page.locator('#theme').click()
    expect(page.locator('html')).to_have_attribute('data-theme','light')
    page.locator('#theme').click()
    page.locator('#history-open').click()
    expect(page.locator('.history-item')).to_have_count(2)
    page.locator('.history-item button').first.click()
    expect(page.locator('#state')).to_have_text('HISTORY')
    expect(page.locator('#analyze')).to_be_disabled()
    page.locator('#source-file').click()
    page.locator('[data-engine=web]').click()
    page.locator('#goal').fill('Create a perfume advertisement')
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('WEB_READY')
    expect(page.locator('#chatgpt-prompt')).to_have_value(re.compile('.*perfume advertisement.*',re.DOTALL))
    expect(page.locator('#chatgpt-prompt')).to_have_value(re.compile('.*Return ONLY a JSON object.*',re.DOTALL))
    for button in ['web-frames','web-prompt-file']:
        with page.expect_download() as download: page.locator('#'+button).click()
        assert Path(download.value.path()).stat().st_size > 500
    page.locator('#import-json').fill('{invalid')
    page.locator('#import-result').click()
    expect(page.locator('#status')).to_contain_text('JSON không hợp lệ')
    invalid = json.loads(json.dumps(OUTPUT))
    invalid['deep']['sceneDetails'][0]['sceneId'] = 'scene_999'
    page.locator('#import-json').fill(json.dumps(invalid))
    page.locator('#import-result').click()
    expect(page.locator('#status')).to_contain_text('không khớp')
    page.locator('#import-json').fill(json.dumps(OUTPUT))
    page.locator('#import-result').click()
    expect(page.locator('#state')).to_have_text('IMPORTED')
    expect(page.locator('#result-body')).to_contain_text(OUTPUT['summary'])
    page.locator('#report-tabs button').nth(1).click()
    assert page.locator('#result-body img').count() == 1  # only actual video thumbnail
    assert page.locator('#result-body img[src=x]').count() == 0
    page.locator('#export-open').click()
    with page.expect_download() as download: page.locator('#export-html').click()
    html = Path(download.value.path()).read_text()
    assert '<img src=x' not in html and '&lt;img src=x' in html
    print('PASS: theme, history reopen, ChatGPT storyboard/JSON handoff, import validation and safe HTML export')

    requests = []
    missing_model = [True]
    def openai(route):
        requests.append(route.request)
        if route.request.url.endswith('/models'):
            result = {'data':[{'id':'gpt-4.1'},{'id':'gpt-4o-audio-preview'}]}
        elif missing_model[0]:
            route.fulfill(status=404,body='{}');return
        else:
            result = {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(OUTPUT)}]}]}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(result))
    context.route('https://api.openai.com/**',openai)
    page.locator('[data-engine=cloud]').click()
    page.locator('#api-key').fill('test-openai-not-real')
    expect(page.locator('#analyze')).to_be_disabled()
    page.locator('#consent').check()
    page.locator('#analyze').click()
    expect(page.locator('#status')).to_contain_text('Tải danh sách model')
    page.locator('#load-models').click()
    expect(page.locator('#model')).to_have_value('gpt-4.1')
    missing_model[0] = False
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED')
    expect(page.locator('#result-body')).to_contain_text(OUTPUT['summary'])
    for index, expected in [(4,'OBJECT_01'),(5,'chính diện'),(7,'Tương phản'),(8,'Đoạn quá tĩnh'),(9,'3–8 phút'),(10,'Animate vị trí')]:
        page.locator('#report-tabs button').nth(index).click()
        expect(page.locator('#result-body')).to_contain_text(expected)
    page.locator('#report-tabs button').nth(2).click()
    expect(page.locator('#result-body')).to_contain_text(OUTPUT['deep']['masterPromptVi'])
    expect(page.locator('#result-body')).to_contain_text(OUTPUT['deep']['masterPromptEn'])
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(ROOT/'dist/v3-ai-prompts.png'),full_page=True)
    request = next(r for r in requests if r.post_data)
    assert sum(p['type']=='input_image' for p in json.loads(request.post_data)['input'][0]['content']) == 12
    assert request.headers['authorization']=='Bearer test-openai-not-real'
    assert 'test-openai-not-real' not in page.evaluate('localStorage.getItem("video_prompt_v2")')
    def gemini(route):
        if ':generateContent' not in route.request.url:
            body={'models':[{'name':'models/gemini-test-flash','supportedGenerationMethods':['generateContent']}]}
        else: body={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(OUTPUT)}]}}]}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
    context.route('https://generativelanguage.googleapis.com/**',gemini)
    page.locator('#provider').select_option('gemini')
    expect(page.locator('#api-key')).to_have_value('')
    expect(page.locator('#consent')).not_to_be_checked()
    page.locator('#api-key').fill('test-gemini-not-real')
    page.locator('#load-models').click()
    expect(page.locator('#model')).to_have_value('gemini-test-flash')
    page.locator('#consent').check()
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED')
    context.unroute('https://generativelanguage.googleapis.com/**')
    context.route('https://generativelanguage.googleapis.com/**',lambda route:route.fulfill(status=429,body='{}'))
    page.locator('#reanalyze').click()
    expect(page.locator('#status')).to_contain_text('hạn mức')
    context.unroute('https://generativelanguage.googleapis.com/**')
    pending = []
    context.route('https://generativelanguage.googleapis.com/**', lambda route: pending.append(route))
    page.locator('#reanalyze').click()
    expect(page.locator('#state')).to_have_text('ANALYZING')
    page.locator('#cancel').click()
    expect(page.locator('#state')).to_have_text('CANCELLED')
    expect(page.locator('#analyze')).to_be_enabled()
    for route in pending:
        try: route.abort()
        except Exception: pass  # The browser may already have aborted the request.
    context.unroute('https://generativelanguage.googleapis.com/**')
    print('PASS: OpenAI/Gemini model recovery, actual image payloads, consent, provider key isolation and quota errors (mock APIs)')

    hf_requests=[]
    def hf_api(route):
        request=route.request
        if request.url.endswith('/models'):
            value={'data':[{'id':'Qwen/test-vision','architecture':{'input_modalities':['text','image'],'output_modalities':['text']}},{'id':'text-only','architecture':{'input_modalities':['text'],'output_modalities':['text']}}]}
        else:
            payload=json.loads(request.post_data);hf_requests.append(payload)
            value=json.loads(json.dumps(OUTPUT));content=payload['messages'][0]['content'];instruction=content[0]['text']
            focus=re.search(r'covering ONLY ([\d.]+)\.\.([\d.]+) seconds',instruction)
            if focus:
                start,end=map(float,focus.groups());timestamp=float(next(p['text'].split(' at ')[1].split(' seconds')[0] for p in content[1:] if p.get('type')=='text'))
                value['scenes'][0].update(start=start,end=end)
                value['deep']['sceneDetails'][0]['evidence'][0]['timestamp']=timestamp
                value['deep']['characters'][0]['evidence'][0]['timestamp']=timestamp
                value['deep']['characters'][0]['referenceTimestamp']=timestamp
            value={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(value)}}]}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
    context.route('https://router.huggingface.co/**',hf_api)
    page.locator('#provider').select_option('huggingface')
    expect(page.locator('#api-key')).to_have_value('')
    expect(page.locator('#model')).to_have_value('')
    expect(page.locator('#provider-hint')).to_contain_text('không có credit')
    page.locator('#api-key').fill('test-hf-not-real');page.locator('#load-models').click()
    expect(page.locator('#model')).to_have_value('Qwen/test-vision')
    expect(page.locator('#model-options option')).to_have_count(1)
    page.locator('#deep-passes').check();page.locator('#consent').check();page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED',timeout=20000)
    stored=page.evaluate('JSON.parse(localStorage.getItem("video_prompt_v2")).history[0]')
    assert stored['analysis']['analysisPasses']['sceneCalls']>=2
    assert len(hf_requests)==stored['analysis']['analysisPasses']['sceneCalls']+1
    assert 'Earlier scene-level AI observations' in hf_requests[-1]['messages'][0]['content'][0]['text']
    assert 'test-hf-not-real' not in json.dumps(stored)
    page.locator('#report-tabs button').nth(1).click()
    expect(page.locator('#result-body')).to_contain_text('GHI CHÚ TỪNG LƯỢT TRƯỚC TỔNG HỢP')
    expect(page.locator('#result-body details.scene-card')).to_have_count(len(stored['analysis']['scenes'])+stored['analysis']['analysisPasses']['sceneCalls'])
    local_requests=[]
    def ollama_api(route):
        local_requests.append(route.request)
        if route.request.url.endswith('/tags'):value={'models':[{'name':'qwen3-vl:4b'},{'name':'qwen3-vl:8b'},{'name':'text-only'}]}
        elif route.request.url.endswith('/show'):value={'capabilities':['vision'] if json.loads(route.request.post_data)['model'].startswith('qwen3-vl:') else ['completion']}
        else:value={'done':True,'done_reason':'stop','message':{'content':json.dumps(OUTPUT)}}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
    context.route('http://localhost:11434/**',ollama_api)
    page.locator('#provider').select_option('ollama')
    expect(page.locator('#api-key')).to_be_hidden();expect(page.locator('#load-models')).to_be_enabled()
    expect(page.locator('#consent')).not_to_be_checked()
    page.locator('#deep-passes').uncheck();page.locator('#load-models').click()
    expect(page.locator('#model')).to_have_value('qwen3-vl:8b')
    page.locator('#consent').check();page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED')
    request=next(r for r in local_requests if r.url.endswith('/chat'))
    assert len(json.loads(request.post_data)['messages'][0]['images'])==4
    assert json.loads(request.post_data)['options']['num_ctx']==16384
    expect(page.locator('#engine-status')).to_contain_text('4/12 ảnh')
    assert 'authorization' not in request.headers
    print('PASS: HF/Ollama provider UI, actual image requests, Vision filtering and scene-then-synthesis orchestration (mock inference)')

    social_html = f'<html><head><title>Test Reel</title></head><body style="margin:0"><video width="320" height="180" controls muted src="data:video/webm;base64,{encoded}"></video><video width="320" height="180" controls muted src="data:video/webm;base64,{encoded}"></video></body></html>'
    context.route('https://www.instagram.com/reels/DepGcNqih2d/',lambda route:route.fulfill(status=200,content_type='text/html',body=social_html))
    social=context.new_page();social.goto('https://www.instagram.com/reels/DepGcNqih2d/')
    social.wait_for_function('[...document.querySelectorAll("video")].every(v=>v.readyState>=2)')
    social.evaluate('''() => {const [a,b]=document.querySelectorAll('video');a.currentTime=.6;b.currentTime=.25;}''')
    social.wait_for_function('[...document.querySelectorAll("video")].every(v=>!v.seeking)')
    social.evaluate((ROOT/'content.js').read_text())
    detection=social.evaluate('''()=>new Promise(resolve=>window.vpListener({type:'VP_DETECT'},{},resolve))''')
    assert len(detection['candidates'])==2
    chosen=detection['candidates'][1]['id']
    tab_result=social.evaluate('''id=>new Promise(resolve=>window.vpListener({type:'VP_EXTRACT',count:12,videoId:id},{},resolve))''',chosen)
    assert tab_result['ok'],tab_result
    assert len(tab_result['frames'])==12
    positions=social.locator('video').evaluate_all('(v)=>v.map(x=>x.currentTime)')
    assert abs(positions[0]-.6)<.05 and abs(positions[1]-.25)<.05
    page.bring_to_front()
    page.evaluate('(x)=>{window.testDetection=x.detection;window.testTabResponse=x.response;}',{'detection':detection,'response':tab_result})
    page.locator('[data-engine=local]').click()
    page.locator('#source-link').click()
    page.locator('#video-url').fill(social.url)
    page.locator('#open-link').click()
    expect(page.locator('#detection-status')).to_contain_text('Instagram')
    expect(page.locator('#video-select option')).to_have_count(2)
    page.locator('#video-select').select_option(chosen)
    page.locator('#analyze').click()
    expect(page.locator('#state')).to_have_text('COMPLETED')
    assert page.evaluate('window.sentMessage.videoId')==chosen
    page.locator('#report-tabs button').nth(1).click()
    assert page.locator('#result-body img').count() > 0
    page.locator('#release-memory').click()
    expect(page.locator('#frames img')).to_have_count(0)
    expect(page.locator('#result-body img')).to_have_count(0)
    page.locator('#report-tabs button').nth(0).click()
    expect(page.locator('#export-open')).to_be_enabled()
    page.locator('#clear-cache').click()
    expect(page.locator('#status')).to_contain_text('Đã xóa cache')
    page.locator('#history-open').click()
    page.locator('#clear-history').click()
    expect(page.locator('.history-item')).to_have_count(0)
    page.locator('[data-close=history-dialog]').click()
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(ROOT/'dist/v2-dashboard.png'),full_page=True)
    for width in [320,450,900]:
        page.set_viewport_size({'width':width,'height':980})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Horizontal overflow at {width}px'
    # A delayed auto/manual scan must not replace a newly selected file source.
    page.evaluate('''() => {
      const original = chrome.tabs.sendMessage;
      chrome.tabs.sendMessage = (id,message) => message.type === 'VP_DETECT'
        ? new Promise(resolve => setTimeout(() => resolve(window.testDetection),200))
        : original(id,message);
    }''')
    page.locator('#source-tab').click()
    page.locator('#source-file').click()
    page.wait_for_timeout(300)
    expect(page.locator('#video-info')).to_contain_text('Chọn video')
    assert not errors,errors
    print('PASS: multi-video detection/selection, real content extraction/restoration, link flow, RAM/cache controls and 320–900px layouts')
    context.close()
