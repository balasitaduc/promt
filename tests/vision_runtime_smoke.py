"""Real browser WASM inference and model-loader failure handling, under MV3 CSP.

The tiny Add ONNX fixture validates execution, NOT caption quality. Public caption
weights need a separate live check; this environment currently blocks HF with 403.
"""
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CSP = json.loads((ROOT/'manifest.json').read_text())['content_security_policy']['extension_pages']

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()
    def do_GET(self):
        if self.path == '/test':
            self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
            self.wfile.write(b'<!doctype html><title>Runtime verification</title>'); return
        super().do_GET()

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with TemporaryDirectory() as profile, sync_playwright() as p:
        context=p.chromium.launch_persistent_context(profile,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        page=context.new_page(); errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/test')
        value=page.evaluate('''async()=>{
          const {ort}=await import('/vendor/vision-runtime.js');
          ort.env.wasm.wasmPaths=new URL('/vendor/',location.href).href;
          ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
          const session=await ort.InferenceSession.create('/tests/fixtures/add.onnx',{executionProviders:['wasm']});
          const result=await session.run({a:new ort.Tensor('float32',new Float32Array([1,3]),[2]),b:new ort.Tensor('float32',new Float32Array([2,5]),[2])});
          await session.release(); return Array.from(result.sum.data);
        }''')
        assert value==[3,8],value
        print('PASS: bundled ONNX runtime performs real WASM inference with extension CSP and local binaries')
        requests=[]
        def deny_model(route):
            requests.append(route.request.url)
            route.fulfill(status=403,body='Model access blocked for this test',headers={'Access-Control-Allow-Origin':'*'})
        context.route('https://huggingface.co/**',deny_model)
        value=page.evaluate('''async()=>{
          const {LocalVision}=await import('/vision.js');const vision=new LocalVision();
          const progress=[];
          try {await vision.caption([{sceneId:'S01',timestamp:0,dataUrl:'data:image/jpeg;base64,YQ=='}],{onProgress:e=>progress.push(e.stage),timeoutMs:60000});return {success:true};}
          catch(error){return {success:false,code:error.code,message:error.message,progress};}
          finally{vision.dispose();}
        }''')
        assert not value['success'] and value['code']=='MODEL_LOAD_FAILED',value
        assert 'loading' in value['progress'] and requests,value
        assert not errors,errors
        print('PASS: actual caption worker/runtime starts; denied weights produce MODEL_LOAD_FAILED without a false result')
        print('NOT VERIFIED: actual pretrained caption inference (live Hugging Face download is blocked in cloud)')
        context.close()
finally: server.shutdown();server.server_close()
