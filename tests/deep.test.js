import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENE_FIELDS, normalizeDeep, sceneMeasurements, attachMeasurements, verifyFrameEvidence, reportReadiness } from '../deep.js';
import { parseAnalysis, buildInstruction } from '../core.js';
import { measurePixels, buildLocalAnalysis, frameDifference, segmentScenes } from '../local.js';
import { reportMarkdown } from '../reports.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/deep-analysis.json',import.meta.url),'utf8'));
const meta={name:'synthetic.webm',duration:2,width:320,height:180,frameCount:4};
const solid=(r,g,b)=>new Uint8ClampedArray(Array.from({length:16},()=>[r,g,b,255]).flat());
const samples=[{timestamp:0,metrics:measurePixels(solid(240,0,0))},{timestamp:.5,metrics:measurePixels(solid(240,0,0))},{timestamp:1,metrics:measurePixels(solid(0,0,240))},{timestamp:1.5,metrics:measurePixels(solid(0,0,240))}];

test('deep schema retains 22 scene fields, bilingual/image/video prompts and distinct specialist sections',()=>{
  assert.equal(SCENE_FIELDS.length,22);assert.equal(new Set(SCENE_FIELDS.map(f=>f[0])).size,22);
  const parsed=parseAnalysis(JSON.stringify(fixture),2);
  assert.equal(Object.keys(parsed.deep.sceneDetails[0].fields).length,22);
  assert.match(parsed.deep.masterPromptVi,/khối vuông/);assert.match(parsed.deep.masterPromptEn,/white square/);
  assert.match(parsed.deep.sceneDetails[0].imagePrompt,/Static/);assert.match(parsed.deep.sceneDetails[0].videoPrompt,/Two-second/);
  assert.equal(parsed.deep.characters[0].sceneIds[0],'scene_001');
  assert.ok(parsed.deep.narrative.hook);assert.ok(parsed.deep.viral.hookAssessment);assert.ok(parsed.deep.productionPlan[0].assumption);
});

test('untrusted AI percentages, audio status and pixel measurements cannot be imported as verified facts',()=>{
  const injected=structuredClone(fixture);injected.deep.aiAssessment.probability=63;injected.deep.aiAssessment.confidence=56;
  injected.deep.audio.status='detected';injected.deep.sceneDetails[0].measurements={luminance:999};
  const parsed=parseAnalysis(JSON.stringify(injected),2);
  assert.equal(parsed.deep.aiAssessment.probability,null);assert.equal(parsed.deep.aiAssessment.confidence,null);
  assert.equal(parsed.deep.audio.status,'not_analyzed');assert.equal(parsed.deep.sceneDetails[0].measurements,undefined);
  const local=buildLocalAnalysis(samples,meta),merged=attachMeasurements(parsed,local,meta);
  assert.ok(merged.deep.sceneDetails[0].measurements.luminance<255);
  assert.equal(merged.deep.sceneDetails[0].fields.subject,'Khối vuông trắng');
});

test('scene metrics use half-open time ranges, exclude cut deltas and do not leak adjacent-scene colors',()=>{
  const rows=[{timestamp:0,luminance:20,palette:['#ff0000'],visualChange:null},{timestamp:.5,luminance:40,palette:['#ff0000'],visualChange:.1},{timestamp:1,luminance:200,palette:['#0000ff'],visualChange:.9},{timestamp:1.5,luminance:220,palette:['#0000ff'],visualChange:.2}];
  const first=sceneMeasurements(rows,0,1),last=sceneMeasurements(rows,1,2);
  assert.equal(first.luminance,30);assert.equal(last.luminance,210);
  assert.deepEqual(first.palette,['#ff0000']);assert.deepEqual(last.palette,['#0000ff']);
  assert.equal(first.visualChange,.1);assert.equal(last.visualChange,.2);
  assert.equal(sceneMeasurements(rows,.6,.9).sampleCount,0);
});

test('spatial comparison can detect a layout cut with identical color histograms; blank images have no invented subject center',()=>{
  const layout=flip=>new Uint8ClampedArray(Array.from({length:64},(_,i)=>{
    const value=((i%8<4)!==flip)?255:0;return [value,value,value,255];
  }).flat());
  const a=measurePixels(layout(false),8,8),b=measurePixels(layout(true),8,8);
  assert.deepEqual(a.histogram,b.histogram);assert.ok(frameDifference(a,b)>.3);
  const rows=[{timestamp:0,metrics:a},{timestamp:1,metrics:a},{timestamp:2,metrics:b},{timestamp:3,metrics:b}];
  assert.equal(segmentScenes(rows,4).length,2);
  const blank=measurePixels(solid(255,255,255));assert.equal(blank.detailX,null);assert.equal(blank.detailY,null);
});

test('evidence and character links are validated against scene ranges and actual supplied frame times',()=>{
  const parsed=parseAnalysis(JSON.stringify(fixture),2);
  verifyFrameEvidence(parsed.deep,[{timestamp:0},{timestamp:1.5}]);
  const wrong=structuredClone(fixture.deep);wrong.sceneDetails[0].evidence[0].timestamp=99;
  assert.throws(()=>normalizeDeep(wrong,fixture.scenes,2),/ngoài cảnh/);
  wrong.sceneDetails[0].evidence[0].timestamp=.4;
  const normalized=normalizeDeep(wrong,fixture.scenes,2);
  assert.throws(()=>verifyFrameEvidence(normalized,[{timestamp:0},{timestamp:1.5}]),/không có trong/);
  const badLink=structuredClone(fixture.deep);badLink.characters[0].sceneIds=['scene_999'];
  assert.throws(()=>normalizeDeep(badLink,fixture.scenes,2),/không tồn tại/);
});

test('local prompt bundles differ by actual scene palette, preserve unknown semantic fields and use independent VI/EN templates',()=>{
  const result=buildLocalAnalysis(samples,meta);
  assert.equal(result.scenes.length,2);
  const [a,b]=result.deep.sceneDetails;
  assert.notEqual(a.promptVi,b.promptVi);assert.notEqual(a.promptEn,b.promptEn);
  assert.equal(a.fields.subject,null);assert.equal(a.fields.cameraMovement,null);assert.equal(a.fields.lensLook,null);
  assert.match(a.promptEn,/\[SUBJECT:/);assert.match(a.promptVi,/CHỦ THỂ/);
  assert.equal(result.deep.aiAssessment.probability,null);
  assert.ok(reportReadiness(result.deep).percent<50);
});

test('export includes complete deep content and production budgets require explicit assumptions',()=>{
  const analysis=attachMeasurements(parseAnalysis(JSON.stringify(fixture),2),buildLocalAnalysis(samples,meta),meta);
  const text=reportMarkdown({analysis,meta,id:'test',engine:'Mock AI',createdAt:'2026-10-19',elapsedMs:1});
  for(const label of ['Master Prompt VI','Master Prompt EN','22 trường','Image Prompt','Video Prompt','OBJECT_01','Ngân sách','Bằng chứng','Lời thoại gợi ý'])assert.ok(text.includes(label),label);
  const bad=structuredClone(fixture.deep);bad.productionPlan[0].minutesMax=1;
  assert.throws(()=>normalizeDeep(bad,fixture.scenes,2),/min\/max/);
  const noAssumption=structuredClone(fixture.deep);noAssumption.productionPlan[0].assumption='';
  assert.throws(()=>normalizeDeep(noAssumption,fixture.scenes,2),/giả định/);
  assert.match(buildInstruction(meta,'vi',''),/sceneDetails/);assert.match(buildInstruction(meta,'vi',''),/cameraMovement/);
});
