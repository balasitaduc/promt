import { formatTime, toMarkdown, htmlReport } from './core.js';

export const REPORT_TABS = ['Tổng quan', 'Cảnh', 'Prompt', 'AI Tool', 'Nhân vật', 'Camera', 'Audio', 'Kịch bản', 'Viral', 'Workflow', 'Tái tạo', 'Export'];
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
function block(parent, title, text, prompt = false) {
  parent.append(el('h4', title), el(prompt ? 'div' : 'p', text, prompt ? 'prompt' : undefined));
}
function button(label, action, id, cyan = false) {
  const n = el('button', label, cyan ? 'cyan' : undefined);
  if (id) n.id = id;
  n.addEventListener('click', action); return n;
}
function checklist(parent, items) {
  const list = el('ol', undefined, 'checklist');
  list.append(...items.map(text => el('li', text))); parent.append(list);
}

export function reportMarkdown(report) {
  return toMarkdown(report.analysis, report.meta) + `
## AI Tool
Công cụ tạo gốc: Unknown — không xác định chính xác từ ảnh.
Nguồn phân tích: ${report.engine}
Thời điểm tạo báo cáo: ${report.createdAt}

## Nhân vật
${report.engine.startsWith('Local') ? 'Local không nhận diện nhân vật/chủ thể; cần điền thủ công hoặc dùng AI.' : 'Đối chiếu chủ thể trong mô tả từng cảnh với ảnh nguồn; không coi là xác minh danh tính.'}

## Audio
Chưa phân tích âm thanh, nhạc nền hoặc lời thoại.

## Kịch bản gợi ý từ hình ảnh
${report.analysis.scenes.map((scene, i) => `${i + 1}. ${formatTime(scene.start)}–${formatTime(scene.end)}: ${scene.description}`).join('\n')}
Không phải kịch bản hoặc lời thoại gốc.

## Viral — checklist gợi ý
Kiểm tra điểm nhấn 1–3 giây đầu, nhịp cắt cảnh, chữ trên điện thoại và quyền sử dụng nội dung. Không dự đoán điểm viral hoặc lượt xem.

## Workflow gợi ý
Xác nhận chủ thể/bối cảnh → sửa prompt → tạo clip thử → so sánh hình ảnh → ghép cảnh/thêm âm thanh có quyền sử dụng.

## Tái tạo
Nguồn ${report.meta.width}×${report.meta.height}, ${report.meta.duration.toFixed(2)} giây. Prompt ở trên là suy luận hoặc mẫu gợi ý, không phải prompt gốc; seed, lens và workflow gốc chưa được xác minh.
`;
}

export function renderReport(root, report, tab, { frames = [], copy, download, seek } = {}) {
  root.replaceChildren();
  if (!report) {
    root.append(el('div', '▧', 'empty-icon'), el('h2', 'Chưa có báo cáo phân tích'), el('p', 'Chọn nguồn video rồi bấm PHÂN TÍCH VIDEO.', 'hint')); return;
  }
  const { analysis: result, meta } = report;
  const allPrompts = [result.masterPrompt, result.negativePrompt, ...result.scenes.map(scene => scene.prompt)].join('\n\n');
  const markdown = reportMarkdown(report);
  root.append(el('h3', `${REPORT_TABS[tab].toLocaleUpperCase('vi')} · ${tab + 1}/12`), el('span', report.engine, 'tag'));
  switch (tab) {
    case 0:
      block(root, 'Tổng quan video', result.summary);
      block(root, 'Phong cách & hình ảnh', result.visualStyle);
      if (result.localMetrics) {
        const swatches = el('div', undefined, 'swatches');
        for (const color of result.localMetrics.palette) {
          if (!/^#[a-fA-F0-9]{6}$/.test(color)) continue;
          const chip = el('span', undefined, 'swatch'), sample = el('i'); sample.style.backgroundColor = color;
          chip.append(sample, document.createTextNode(color)); swatches.append(chip);
        }
        root.append(swatches);
      }
      block(root, 'Giới hạn & độ tin cậy', result.limitations);
      root.append(el('p', 'Không thể khôi phục chắc chắn prompt gốc hoặc xác định công cụ tạo video chỉ từ ảnh.', 'notice'));
      break;
    case 1:
      root.append(el('p', 'Mốc cảnh là ước lượng từ các ảnh mẫu, không phải điểm cắt đã kiểm chứng trên toàn video.', 'notice'));
      result.scenes.forEach((scene, i) => {
        const article = el('article', undefined, 'scene'), header = el('div', undefined, 'scene-header');
        header.append(el('h4', `Cảnh ${i + 1} · ${formatTime(scene.start)} – ${formatTime(scene.end)}`), button('Xem mốc', () => seek(scene.start)));
        article.append(header);
        const frame = frames.find(f => f.timestamp >= scene.start && f.timestamp <= scene.end);
        if (frame) { const img = el('img'); img.src = frame.dataUrl; img.alt = `Ảnh mẫu cảnh ${i + 1}`; article.append(img); }
        block(article, 'Mô tả', scene.description); block(article, 'Chuyển động', scene.motion); root.append(article);
      }); break;
    case 2:
      block(root, 'Master Prompt', result.masterPrompt, true);
      block(root, 'Negative Prompt · gợi ý', result.negativePrompt, true);
      result.scenes.forEach((scene, i) => {
        block(root, `Scene Prompt ${i + 1}`, scene.prompt, true);
        root.append(button('Copy Scene Prompt', () => copy(scene.prompt)));
      }); break;
    case 3:
      block(root, 'Công cụ tạo video gốc', 'Unknown — không thể xác định chính xác công cụ gốc chỉ từ pixel hoặc phong cách hình ảnh.');
      block(root, 'Công cụ phân tích báo cáo này', report.engine);
      root.append(el('p', 'Nhà cung cấp phân tích không phải bằng chứng về công cụ đã tạo video. Không gán phần trăm AI nếu không có mô hình đã hiệu chuẩn.', 'notice')); break;
    case 4:
      root.append(el('p', 'Chế độ Local không nhận diện người/vật. Nếu dùng AI, phần dưới trích từ mô tả cảnh do AI trả về và vẫn cần kiểm tra.', 'notice'));
      result.scenes.forEach((scene, i) => block(root, `Chủ thể trong mô tả cảnh ${i + 1}`, scene.description)); break;
    case 5:
      result.scenes.forEach((scene, i) => block(root, `Camera cảnh ${i + 1}`, `${scene.camera}\nÁnh sáng: ${scene.lighting}\nChuyển động: ${scene.motion}`)); break;
    case 6:
      block(root, 'Audio chưa được phân tích', 'Extension chỉ lấy khung hình. Không nghe âm thanh, không nhận diện giọng nói, nhạc nền, nhịp beat hoặc lời thoại.');
      checklist(root, ['Tự nghe video và ghi lại nhạc nền / lời thoại nếu có quyền sử dụng.', 'Điền yêu cầu âm thanh riêng khi tái tạo; không xem đây là nội dung trích xuất.']); break;
    case 7:
      root.append(el('p', 'Dàn cảnh gợi ý theo báo cáo hình ảnh, không phải kịch bản hoặc lời thoại gốc.', 'notice'));
      result.scenes.forEach((scene, i) => block(root, `Đoạn ${i + 1} · ${formatTime(scene.start)} – ${formatTime(scene.end)}`, scene.description)); break;
    case 8:
      block(root, 'Checklist tối ưu · gợi ý biên tập', 'Không chấm điểm viral hoặc dự đoán lượt xem từ ảnh mẫu.');
      checklist(root, ['Kiểm tra 1–3 giây đầu có chủ thể / điểm nhấn rõ ràng.', 'Đối chiếu nhịp cắt cảnh với video gốc, không chỉ ảnh mẫu.', 'Đảm bảo chữ đọc được trên màn hình điện thoại.', 'Kiểm tra quyền âm nhạc, hình ảnh và thông điệp trước khi đăng.', 'Đo tỷ lệ giữ chân thực tế sau khi phát hành.']); break;
    case 9:
      checklist(root, ['Xác nhận chủ thể, bối cảnh và giới hạn của báo cáo.', 'Chọn ảnh tham chiếu và chỉnh prompt, điền các chỗ trống nếu dùng Local.', 'Tạo clip thử ngắn với công cụ tạo video bạn chọn.', 'So sánh bố cục, ánh sáng và tính nhất quán qua từng cảnh.', 'Ghép cảnh, thêm âm thanh có quyền sử dụng và xuất theo tỷ lệ nguồn.']); break;
    case 10:
      block(root, 'Thông số nguồn', `${meta.width} × ${meta.height} · ${meta.duration.toFixed(2)} giây · ${meta.frameCount} ảnh mẫu`);
      block(root, 'Prompt tái tạo đề xuất', result.masterPrompt, true);
      block(root, 'Cần kiểm tra thủ công', 'Bố cục, chủ thể, hành động, camera, chuyển cảnh, âm thanh và độ nhất quán. Các tham số seed, lens, model hoặc workflow gốc không được suy ra chắc chắn.'); break;
    case 11: {
      root.append(el('h4', 'SAO CHÉP NHANH (CLIPBOARD)'));
      const copies = el('div', undefined, 'button-grid');
      copies.append(button('Copy All (Toàn bộ báo cáo TXT)', () => copy(markdown), 'copy-all', true), button('Copy Tất cả Prompt', () => copy(allPrompts), 'copy-prompts'), button('Copy Scene Prompts', () => copy(result.scenes.map(s => s.prompt).join('\n\n')), 'copy-scenes'), button('Copy Master Prompt', () => copy(result.masterPrompt), 'copy-master'));
      root.append(copies, el('h4', 'XUẤT FILE BÁO CÁO'), el('p', 'Tạo và tải trực tiếp trong trình duyệt, không cần phần mềm bên ngoài.', 'hint'));
      const exports = el('div', undefined, 'button-grid');
      exports.append(button('Export JSON (.json)', () => download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'video-report.json'), 'export-json', true), button('Export TXT (.txt)', () => download(new Blob([markdown], { type: 'text/plain;charset=utf-8' }), 'video-report.txt'), 'export-txt', true), button('Export Markdown (.md)', () => download(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), 'video-report.md'), 'export-md', true), button('Export HTML Report (.html)', () => download(new Blob([htmlReport(markdown)], { type: 'text/html;charset=utf-8' }), 'video-report.html'), 'export-html', true));
      root.append(exports, el('h4', 'XEM TRƯỚC DỮ LIỆU CHUẨN HÓA (RESULT JSON)'), el('pre', JSON.stringify(report, null, 2), 'prompt json-preview')); break;
    }
  }
}
