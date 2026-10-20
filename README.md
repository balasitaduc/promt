# MD Phân Tích AI — Video Prompt · v3.1.2 (tích hợp Vision thử nghiệm)

Extension Chrome / Edge Manifest V3 phân tích khung hình video Facebook, Instagram hoặc tệp video trên máy. Giao diện tối xanh cyan và báo cáo chuyên sâu theo từng cảnh: nguồn video, 3 chế độ, trạng thái/hiệu năng, báo cáo 12 tab, lịch sử, cài đặt và xuất tệp. Không có máy chủ riêng hoặc tài khoản extension.

**Tạm dừng phát hành ZIP:** đang xác minh báo cáo “phát hiện virus”; chưa biết tệp bị chặn và chưa có kết quả quét antivirus. Không bỏ qua cảnh báo hoặc thêm ngoại lệ. Xem [kết quả kiểm tra và thông tin cần đối chiếu](SECURITY.md).

## Cài / cập nhật

Các bước dưới đây chỉ áp dụng sau khi ZIP được phát hành lại; hiện chưa cung cấp bản tải thay thế.

1. Tải và giải nén `video-to-prompt.zip`.
2. Vào `chrome://extensions` (Edge: `edge://extensions`), bật **Chế độ nhà phát triển**, chọn **Tải tiện ích đã giải nén / Load unpacked**, trỏ đến thư mục có `manifest.json`.
3. Với bản cũ: giải nén đè vào thư mục đang cài rồi bấm **Tải lại / Reload**, đóng và mở lại bảng bên cạnh. Nếu dùng thư mục mới, gỡ bản cũ trước khi cài để tránh hai extension trùng nhau.
4. Bản 2.0 bổ sung quyền `storage` để lưu cài đặt/lịch sử/cache. Chrome có thể yêu cầu chấp nhận quyền sau cập nhật. Ghim và bấm biểu tượng extension để mở bảng.

## Sửa dependency trong 3.1.2 (chưa phát hành ZIP)

Nâng Transformers.js lên 4.3.1, build lại runtime không minify, thêm thông tin phiên bản/hash và kiểm tra không đưa package Node vào bundle trình duyệt. `npm audit` sau cập nhật báo 0 cảnh báo; chưa xác định nguyên nhân cảnh báo antivirus. Lệnh package chỉ tạo tệp trong `dist/`, không tự phát hành. Xem [SECURITY.md](SECURITY.md).

## Mới trong 3.1.1

Cấu hình mặc định Ollama được giảm xuống 4 ảnh/lượt, context 16K và output 8K để bắt đầu với Windows, RAM 32 GB, RTX 3060 12 GB. Khi có nhiều model, ưu tiên Qwen3‑VL 8B đã cài; có thể chọn 4B nhẹ hơn. Ghi chú từng lượt trước tổng hợp hiển thị ở tab Cảnh và có trong bản xuất TXT/Markdown/HTML, bên cạnh JSON. Chưa đo trực tiếp trên phần cứng đó. [Hướng dẫn Windows](MODELS.md#windows-ram-32-gb-rtx-3060-12-gb).

## Mới trong 3.1: model thật và lựa chọn mạnh hơn

- **Caption cục bộ**: Transformers.js + ONNX Runtime WASM đóng gói sẵn, model `Xenova/vit-gpt2-image-captioning` q8 tải từ Hugging Face lần đầu (~237 MB theo bản gốc, chưa xác minh kích thước tải thực tế). Ảnh được suy luận trong worker, không tải ảnh lên Hub. Có tiến độ, hủy, giải phóng worker và xóa cache trọng số riêng. Model này nhỏ, chỉ mô tả keyframe bằng tiếng Anh; không đủ cho phân tích video sâu. Có thể tắt để chỉ đo pixel.
- **Hugging Face Inference Providers**: token chỉ giữ trong phiên; lấy danh sách model khai báo nhận ảnh/trả text từ HF Router. Không gắn cứng một tên model rồi giả định tài khoản nào cũng chạy được. Ảnh được gửi đến HF/provider khi đồng ý.
- **Ollama trên máy**: lấy model đã cài, kiểm tra capability `vision`, dùng `/api/chat` native với ảnh và JSON. Không cần key hay phí API; cần tự cài Ollama/model và đủ RAM/GPU. Chế độ này bỏ qua model có nhãn `cloud` hoặc metadata remote. Xem [hướng dẫn chọn model](MODELS.md).
- **Từng cảnh → tổng hợp**: tùy chọn ở chế độ 3. Tối đa 12 lượt phân tích nhóm cảnh và 1 lượt tổng hợp. Ollama tối đa 4 ảnh/lượt; API khác 12 ảnh/lượt cảnh, 24 ảnh tổng hợp. Các đoạn rất nhiều cảnh được gộp thành tối đa 12 khoảng; không cam kết gửi toàn bộ 60 ảnh khi một khoảng có trên 12 ảnh. Tổng hợp nhận các mô tả cảnh và ảnh tham chiếu, rồi tạo 12 phần báo cáo. Tốn thêm thời gian/tài nguyên/phí; mặc định tắt.
- **Trạng thái trung thực**: lỗi model là `MODEL_ERROR`, không âm thầm biến phép đo pixel thành kết quả Vision. Cache v3 không dùng nhầm làm cache Vision v3.1.

**Kiểm chứng hiện tại:** 34 kiểm thử Node; browser smoke với video thật tổng hợp và phản hồi AI giả lập; ONNX thực thi phép cộng thật bằng WASM dưới CSP extension. **Chưa kiểm chứng chất lượng model caption, HF hoặc Ollama trên video thật.** Cloud bị chặn tải Hugging Face/Router (403); chưa có endpoint Ollama. Đây là bản tích hợp thử nghiệm, không phải benchmark độ chính xác hoặc chứng nhận model mạnh nhất.

## Mới trong 3.0: phân tích chuyên sâu theo cảnh

Bản 3.0 nâng cấp nội dung báo cáo, không chỉ thay giao diện:

- **Timeline bấm được + Storyboard**: bấm cảnh để mở chi tiết, chọn keyframe có mật độ cạnh lớn nhất trong cảnh làm ảnh tham chiếu (không gọi đó là điểm chất lượng).
- **Số đo riêng từng cảnh**: luminance, tương phản σ, bão hòa HSV, palette lượng tử hóa, chỉ số R−B, mật độ cạnh, tỷ lệ cạnh tâm/rìa, trọng tâm chi tiết và biến thiên ảnh. Cảnh ít/không có ảnh sẽ ghi rõ thiếu dữ liệu. Ranh giới dùng khoảng nửa mở để không tính một ảnh cho cả hai cảnh; Δ của lần đổi cảnh không tính là chuyển động nội cảnh.
- **22 trường cấu trúc**: chủ thể, tham chiếu nhân vật, diện mạo, trang phục/vật liệu, hành động, bối cảnh, thời điểm, tiền cảnh, hậu cảnh, cỡ cảnh, góc máy, chuyển động máy, đặc tính lens, bố cục, độ sâu trường ảnh, ánh sáng, màu, sắc thái, phong cách, liên tục, chuyển cảnh và nhịp độ.
- **Prompt riêng**: Master VI/EN, Scene VI/EN, Image Prompt tĩnh, Video Prompt chuyển động và Negative Prompt. Các cảnh Local dùng số đo từng cảnh riêng, không lặp lại palette trung bình toàn video cho mọi cảnh.
- **Nhân vật/chủ thể liên cảnh**: JSON AI có ID, diện mạo, trang phục/vật liệu, cảnh tham chiếu, ảnh tham chiếu và các bằng chứng timestamp. Đây là mô tả/tham chiếu thị giác, không phải xác minh danh tính.
- **Kịch bản / Viral / Workflow / Tái tạo**: đọc các mục JSON riêng từ AI, gồm logline, hook, beats, chữ đề xuất, ending/loop, rủi ro giữ chân, cải thiện, bước sản xuất/đầu ra/giả định thời gian, chiến lược reference và checklist kiểm chứng.
- **Xuất đầy đủ**: cả 22 trường, các prompt song ngữ, số đo, bằng chứng và kế hoạch đều có trong JSON/TXT/Markdown/HTML. Không bỏ nội dung khi chuyển tab.

### Dùng ChatGPT/Gemini để điền phần ngữ nghĩa

Sau khi tải bản mới và Reload extension: chọn chế độ Web → bấm chuẩn bị Storyboard → **tải ảnh + copy lại hướng dẫn mới** → đính kèm ảnh và dán hướng dẫn vào ChatGPT/Gemini → nhập JSON trả về vào extension. Hướng dẫn cũ từ bản 2.0 không có cấu trúc chuyên sâu; JSON cũ vẫn mở được nhưng sẽ báo các mục chưa có dữ liệu.

Trước khi có JSON AI, chế độ Web đã hiển thị số đo Local/timeline và mẫu prompt, nhưng ghi rõ **chưa có suy luận AI**. Chế độ API yêu cầu cùng cấu trúc v3; báo cáo song ngữ dùng nhiều token hơn và có thể tốn phí cao hơn bản cơ bản. API đề nghị tối đa 12 cảnh chính, có thể gộp đoạn dài và nêu giới hạn bao phủ.

### Nguồn dữ liệu và độ tin cậy

- Số đo pixel chỉ được tính từ ảnh thật trong trình duyệt. Không nhập số đo do AI tự khai thành dữ liệu đo trực tiếp.
- Bằng chứng AI phải nằm trong cảnh và gần đúng timestamp ảnh đã gửi (dung sai 0.12s); không được viện dẫn một thời điểm tùy ý chưa lấy mẫu.
- Chỉ số độ đầy đủ = số trường có nội dung / (22 × số cảnh). **Không phải** chất lượng video, độ chính xác hoặc xác suất video AI.
- Không quy đổi màu/độ nét thành xác suất AI, cỡ cảnh, lens/Kelvin, Dolly In/Out hay vị trí nhân vật. Chuyển động camera và nội dung cần mô hình Vision hoặc người dùng quan sát.
- Thời gian sản xuất là **ngân sách đề xuất cho bản tái tạo mới**. Mỗi khoảng phút phải có giả định; không tuyên bố biết thời gian tác giả gốc. Cũng không bảo đảm "khóa nhân vật 100%".
- Audio chỉ có thể có **gợi ý thiết kế mới** từ JSON AI, không phải nhạc/giọng/lời thoại đã phát hiện trong nguồn vì chưa cung cấp audio.

## Nguồn video

- **Video đang mở**: mở và phát video, bấm **Quét lại**, chọn đúng video trong danh sách nếu trang có nhiều video hiển thị. Chế độ tự nhận diện chỉ chạy khi bảng đang mở, không lấy ảnh hoặc gửi AI tự động.
- **Dán link video**: hỗ trợ link HTTPS chính thức của Facebook / Instagram (ví dụ `https://www.instagram.com/reels/DepGcNqih2d/`). Bấm **Mở link & tìm video**; trang được mở trong tab mới. Đăng nhập trên trang chính thức nếu được yêu cầu, đóng hộp thoại, phát video rồi **Quét lại**. Link được mở để đọc video thật, không suy luận nội dung từ URL.
- **Tệp**: tối đa 250 MB, 10 phút; khuyến nghị MP4 H.264 hoặc WebM VP8/VP9. MOV tùy codec Chrome hỗ trợ. Không hỗ trợ livestream.

Bấm **PHÂN TÍCH VIDEO** để lấy mẫu (không cần thêm nút trích xuất riêng). Ảnh dài tối đa 960 pixel. Cài đặt giới hạn 12–60 ảnh: nhanh 12, tiêu chuẩn tối đa 36 trong giới hạn cài đặt, chi tiết dùng đúng giới hạn. Yêu cầu chọn đều tối đa 4 ảnh/lượt Ollama hoặc 24 ảnh/lượt API khác, giữ ảnh đầu/cuối của tập ảnh được chọn. Video trên tab được trả lại vị trí và trạng thái phát ban đầu khi lấy ảnh xong.

Nếu CORS chặn đọc canvas: giữ video đầy đủ trong vùng nhìn thấy, bấm lại biểu tượng extension trên tab video để cấp quyền `activeTab`, rồi thử lại. Extension có thể chụp tab và cắt vùng video. Kiểm tra ảnh mẫu vì lớp phủ/chữ trên trang có thể có trong ảnh. Video riêng tư, bị xóa, yêu cầu đăng nhập, giới hạn khu vực, DRM hoặc video trong iframe có thể không đọc được; dùng tệp video bạn có quyền sử dụng nếu cần.

## Ba chế độ

### 1. Local — miễn phí (mặc định)

Mặc định bật **Chạy model caption ảnh cục bộ (thử nghiệm)**. Model chỉ được tải khi bạn bấm phân tích; lần sau dùng cache trình duyệt nếu còn. Không cần tài khoản HF/token cho model công khai. Có thể tải khá lâu và cần RAM ngoài dung lượng trọng số. Chỉ suy luận một keyframe mỗi cảnh (tối đa 24); caption có thể nhận nhầm. Không xác nhận cùng danh tính xuyên cảnh hoặc chuyển động từ một ảnh.

Nếu tắt caption: chỉ đo luminance, tương phản, bão hòa, palette và phân bố cạnh; phân đoạn cảnh từ khác biệt ảnh. Prompt pixel có chỗ trống để bạn điền. Đổi ánh sáng/fade có thể tạo điểm cắt sai. Trong cả hai trường hợp, muốn hiểu camera/diễn biến/kịch bản sâu hơn nên dùng model đa phương thức ở Web hoặc chế độ 3. Không tạo phần trăm video AI từ số đo màu.

### 2. Gemini / ChatGPT web — không cần API

1. Chọn chế độ Web, bấm **CHUẨN BỊ STORYBOARD + PROMPT**.
2. Tải bảng ảnh JPEG và copy hướng dẫn (hoặc tải `.txt`).
3. Mở ChatGPT / Gemini, tự đính kèm `video-frames.jpg`, dán hướng dẫn và gửi. Khả năng tải ảnh/hạn mức tùy tài khoản.
4. AI được yêu cầu trả JSON gồm `summary`, `visualStyle`, `limitations`, `masterPrompt`, `negativePrompt`, `scenes` (`start`, `end`, `description`, `camera`, `lighting`, `motion`, `prompt`).
5. Dán JSON vào extension, bấm **Nhập & kiểm tra kết quả JSON**. Extension kiểm tra trường và mốc thời gian trước khi tạo báo cáo. Kết quả được ghi là JSON do người dùng nhập, không phải kết nối AI đã được xác minh.

Extension không tự gửi, đính kèm ảnh, đọc hội thoại hoặc dùng cookie ChatGPT để gọi API. Chỉ dán link vào AI web có thể không đủ để đọc video; cần đính kèm bảng ảnh. Mặc định hướng dẫn yêu cầu phân tích tiếng Việt, prompt tiếng Anh; có thể đổi trong Cài đặt.

### 3. Cloud AI — tùy chọn

Chọn OpenAI, Gemini, Hugging Face hoặc Ollama. Bấm **Tải danh sách model**, chọn model nhận ảnh và trả JSON, đồng ý gửi ảnh rồi phân tích. Model/nhà cung cấp có thể không hỗ trợ nhiều ảnh hoặc structured output dù nhận ảnh đơn. Lỗi này cần đổi model, không tự điền dữ liệu giả.

OpenAI dùng Responses API; Gemini dùng `generateContent`; HF dùng `https://router.huggingface.co/v1/chat/completions`. HF token cần quyền **Inference Providers**, chỉ gửi đến HF Router. Theo [bảng giá HF hiện tại](https://huggingface.co/docs/inference-providers/pricing), tài khoản Free không có credit API hằng tháng; tải trọng số mở để chạy trên máy là quyền lợi khác với dịch vụ suy luận. Không gửi token vào chat/GitHub.

Ollama kết nối cố định `http://localhost:11434`, dùng native `/api/tags`, `/api/show`, `/api/chat`. Cấu hình khởi đầu cho GPU 12 GB: tối đa 4 ảnh/lượt, context 16384 và output tối đa 8192 token. Tổng hợp dùng ghi chú rút gọn; ghi chú đầy đủ của các lượt vẫn có trong JSON. Đây không phải cam kết mức VRAM hoặc tốc độ. Giao diện không cài model hoặc khởi động dịch vụ thay bạn; [MODELS.md](MODELS.md) có hướng dẫn. Danh sách chỉ hiện model Vision cục bộ đã cài.

Bật **Phân tích từng cảnh rồi tổng hợp** nếu chấp nhận nhiều yêu cầu. Mỗi lượt được kiểm tra JSON, mốc cảnh và timestamp; lượt lỗi sẽ dừng quá trình. Lượt tổng hợp phải dùng bằng chứng ảnh trực tiếp đính kèm, còn các ghi chú trước đó chỉ là ngữ cảnh AI có thể sai. Báo cáo JSON lưu `analysisPasses` để xem các lượt đã chạy; đây không phải log suy luận ẩn của model. Chế độ một yêu cầu chọn đều tối đa 4 ảnh Ollama hoặc 24 ảnh API khác.

**Gói ChatGPT Free / Plus / Pro không bao gồm phí OpenAI API.** Key chỉ ở bộ nhớ trang, bị xóa khi đổi nhà cung cấp/chế độ hoặc đóng bảng. Có thể hủy; nhà cung cấp có thể vẫn xử lý và tính phí. Giới hạn chờ 3 phút cho một API, 10 phút cho Ollama hoặc nhiều lượt.

## Báo cáo 12 tab

1. Tổng quan: mô tả, phong cách, palette Local và giới hạn.
2. Cảnh: mốc ước lượng, ảnh mẫu và nút xem mốc trên video nguồn.
3. Prompt: master, negative gợi ý và scene prompts.
4. AI Tool: công cụ gốc **Unknown**; tách biệt nguồn phân tích báo cáo.
5. Nhân vật: ID/tham chiếu, diện mạo, trang phục/vật liệu, liên kết cảnh và bằng chứng; Local caption chỉ có tham chiếu chủ thể từng cảnh, chưa xác minh liên cảnh.
6. Camera: camera, ánh sáng và chuyển động từ báo cáo, ghi rõ giới hạn Local.
7. Audio: nêu **chưa phân tích âm thanh**, không bịa nhạc hoặc lời thoại.
8. Kịch bản: logline, hook, beats, chữ đề xuất, ending/loop; không phải thoại gốc.
9. Viral: nhận xét hook, rủi ro và đề xuất từ JSON AI; không dự đoán lượt xem hoặc xác suất viral.
10. Workflow: bước/đầu ra/ngân sách thao tác và giả định; không giả nhận workflow hoặc thời gian gốc.
11. Tái tạo: strategy reference, continuity checklist, Image → Video, editing và kiểm chứng.
12. Export: copy toàn bộ/all prompts/scene/master; tải JSON, TXT, Markdown, HTML; xem JSON chuẩn hóa. HTML không chứa script và escape nội dung AI.

## Cài đặt, lịch sử và cache

- Chuyển **Sáng/Tối**, mở Cài đặt để chọn ngôn ngữ, tối đa 12–60 ảnh, tự nhận diện và cache.
- Lưu tối đa 20 báo cáo lịch sử + 8 cache trong Chrome Storage; không lưu ảnh hoặc key. Metadata có tiêu đề/URL nguồn. Cache có dấu SHA-256 của ảnh, thông số nguồn và tùy chọn phân tích; thay ảnh/model/ghi chú sẽ không dùng nhầm cache cũ.
- **Phân tích lại** bỏ qua cache và lấy lại ảnh. **Xóa cache** không xóa lịch sử; lịch sử có nút xóa riêng. Tắt tự cache xóa cache đang có.
- Mở báo cáo lịch sử không khôi phục ảnh/video. Chọn lại nguồn để phân tích mới.
- **Giải phóng model & ảnh trong RAM** dừng worker model và bỏ tham chiếu ảnh/blob video; cache trọng số vẫn giữ; vẫn giữ báo cáo để xuất. Trình duyệt quyết định thời điểm thu hồi bộ nhớ. Số hiển thị nếu có là JS heap, không phải tổng RAM của máy.

## Phát triển & kiểm thử

Node.js 20+ và Python cho phát triển. ZIP phát hành chứa runtime đã build, người cài Chrome không cần Node/Python.

```sh
npm ci --ignore-scripts --cache /workspace/.cache/npm
npm run build:vision
npm run check
npm test
python3 tests/browser_smoke.py
python3 tests/vision_runtime_smoke.py
npm run package
```

Browser smoke cần Python Playwright, FFmpeg và Chromium (`/usr/bin/chromium`, hoặc `CHROMIUM_PATH`). Kiểm thử video tổng hợp thật, chọn nhiều video/tua/khôi phục, đo pixel, cache/lịch sử/settings, 12 tab, Web JSON import, 4 định dạng xuất, payload/model/quota/cancel OpenAI/Gemini/HF/Ollama **giả lập**, cùng orchestration nhiều lượt. Bài runtime dùng fixture ONNX Add 96 byte đã kiểm tra cấu trúc, chạy WASM thật; không thay thế kiểm thử trọng số pretrained. Lỗi tải model 403 được kiểm tra bằng worker/loader thật với phản hồi mạng bị từ chối chủ động trong bài test. Kết nối live HF cũng đã quan sát bị proxy từ chối 403.

Build dùng npm lockfile và esbuild để bundle Transformers.js cùng backend WASM; mã JS/MJS/WASM đều nằm trong ZIP, không tải mã thực thi từ CDN. Trọng số/tệp cấu hình model tải riêng từ Hub. Giấy phép runtime ở `vendor/THIRD_PARTY_LICENSES.txt`; xem giấy phép trọng số trên model card.

Chromium của môi trường cloud chặn nạp extension chưa đóng gói theo chính sách quản trị. Bài test chạy module/content script thật trong Chromium nhưng giả lập Chrome extension APIs; chưa xác minh `sidePanel`, quyền activeTab hoặc screenshot API thật. Mạng xã hội và dịch vụ AI thật cần đăng nhập/key của người dùng; kết quả phân tích trên các dịch vụ thật chưa được xác minh.

## Nguồn tham khảo

Cấu trúc Manifest V3, lấy khung hình và giao diện được viết lại từ bộ tệp/ảnh người dùng cung cấp. Không tái sử dụng server đăng nhập/kích hoạt, endpoint máy chủ riêng, bundle ONNX/Transformers hoặc WASM cũ. Runtime mới build từ dependency có lockfile; ZIP không chứa trọng số pretrained. Không có màn hình đăng nhập/đăng xuất giả khi chưa có dịch vụ tài khoản.
