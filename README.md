# MD Phân Tích AI — Video Prompt · v2.0.0

Extension Chrome / Edge Manifest V3 phân tích khung hình video Facebook, Instagram hoặc tệp video trên máy. Giao diện tối xanh cyan theo bộ ảnh tham khảo: nguồn video, 3 chế độ, trạng thái/hiệu năng, báo cáo 12 tab, lịch sử, cài đặt và xuất tệp. Không có máy chủ riêng hoặc tài khoản extension.

**[Tải extension ZIP](https://github.com/balasitaduc/promt/raw/refs/heads/main/video-to-prompt.zip)**

## Cài / cập nhật

1. Tải và giải nén `video-to-prompt.zip`.
2. Vào `chrome://extensions` (Edge: `edge://extensions`), bật **Chế độ nhà phát triển**, chọn **Tải tiện ích đã giải nén / Load unpacked**, trỏ đến thư mục có `manifest.json`.
3. Với bản cũ: giải nén đè vào thư mục đang cài rồi bấm **Tải lại / Reload**, đóng và mở lại bảng bên cạnh. Nếu dùng thư mục mới, gỡ bản cũ trước khi cài để tránh hai extension trùng nhau.
4. Bản 2.0 bổ sung quyền `storage` để lưu cài đặt/lịch sử/cache. Chrome có thể yêu cầu chấp nhận quyền sau cập nhật. Ghim và bấm biểu tượng extension để mở bảng.

## Nguồn video

- **Video đang mở**: mở và phát video, bấm **Quét lại**, chọn đúng video trong danh sách nếu trang có nhiều video hiển thị. Chế độ tự nhận diện chỉ chạy khi bảng đang mở, không lấy ảnh hoặc gửi AI tự động.
- **Dán link video**: hỗ trợ link HTTPS chính thức của Facebook / Instagram (ví dụ `https://www.instagram.com/reels/DepGcNqih2d/`). Bấm **Mở link & tìm video**; trang được mở trong tab mới. Đăng nhập trên trang chính thức nếu được yêu cầu, đóng hộp thoại, phát video rồi **Quét lại**. Link được mở để đọc video thật, không suy luận nội dung từ URL.
- **Tệp**: tối đa 250 MB, 10 phút; khuyến nghị MP4 H.264 hoặc WebM VP8/VP9. MOV tùy codec Chrome hỗ trợ. Không hỗ trợ livestream.

Bấm **PHÂN TÍCH VIDEO** để lấy mẫu (không cần thêm nút trích xuất riêng). Ảnh dài tối đa 960 pixel. Cài đặt giới hạn 12–60 ảnh: nhanh 12, tiêu chuẩn tối đa 36 trong giới hạn cài đặt, chi tiết dùng đúng giới hạn. Yêu cầu API chọn đều tối đa 24 ảnh, giữ cả ảnh đầu/cuối. Video trên tab được trả lại vị trí và trạng thái phát ban đầu khi lấy ảnh xong.

Nếu CORS chặn đọc canvas: giữ video đầy đủ trong vùng nhìn thấy, bấm lại biểu tượng extension trên tab video để cấp quyền `activeTab`, rồi thử lại. Extension có thể chụp tab và cắt vùng video. Kiểm tra ảnh mẫu vì lớp phủ/chữ trên trang có thể có trong ảnh. Video riêng tư, bị xóa, yêu cầu đăng nhập, giới hạn khu vực, DRM hoặc video trong iframe có thể không đọc được; dùng tệp video bạn có quyền sử dụng nếu cần.

## Ba chế độ

### 1. Local — miễn phí (mặc định)

Chạy trực tiếp trong trình duyệt, không API key, không tải model hoặc gửi ảnh lên mạng. Đo độ sáng, độ tương phản (độ lệch chuẩn luminance), độ bão hòa HSV, bảng màu lượng tử hóa và độ lệch màu nóng/lạnh. Phân đoạn cảnh dựa trên thay đổi histogram/màu giữa ảnh mẫu; mốc cắt đặt ở trung điểm giữa hai ảnh. Fade/đổi ánh sáng có thể tạo điểm cắt sai.

**Đây là phép đo pixel, không phải mô hình AI Vision được huấn luyện.** Không nhận diện người/vật/hành động/camera hoặc hiểu nội dung. Prompt là mẫu tiếng Anh dựa trên số đo, có các chỗ trống `[SUBJECT]`, `[ACTION]`, `[SETTING]`, `[CAMERA]` để bạn tự điền. Dùng Web AI hoặc Cloud API khi cần phân tích ngữ nghĩa. Không hiển thị phần trăm video do AI tạo.

### 2. Gemini / ChatGPT web — không cần API

1. Chọn chế độ Web, bấm **CHUẨN BỊ STORYBOARD + PROMPT**.
2. Tải bảng ảnh JPEG và copy hướng dẫn (hoặc tải `.txt`).
3. Mở ChatGPT / Gemini, tự đính kèm `video-frames.jpg`, dán hướng dẫn và gửi. Khả năng tải ảnh/hạn mức tùy tài khoản.
4. AI được yêu cầu trả JSON gồm `summary`, `visualStyle`, `limitations`, `masterPrompt`, `negativePrompt`, `scenes` (`start`, `end`, `description`, `camera`, `lighting`, `motion`, `prompt`).
5. Dán JSON vào extension, bấm **Nhập & kiểm tra kết quả JSON**. Extension kiểm tra trường và mốc thời gian trước khi tạo báo cáo. Kết quả được ghi là JSON do người dùng nhập, không phải kết nối AI đã được xác minh.

Extension không tự gửi, đính kèm ảnh, đọc hội thoại hoặc dùng cookie ChatGPT để gọi API. Chỉ dán link vào AI web có thể không đủ để đọc video; cần đính kèm bảng ảnh. Mặc định hướng dẫn yêu cầu phân tích tiếng Việt, prompt tiếng Anh; có thể đổi trong Cài đặt.

### 3. Cloud AI — tùy chọn

Chọn OpenAI API hoặc Gemini API, nhập key của đúng nhà cung cấp, bấm **Tải danh sách model** và chọn model hỗ trợ ảnh + JSON. Đồng ý gửi ảnh, rồi phân tích. Key chỉ giữ trong bộ nhớ trang; đổi nhà cung cấp/chế độ hoặc đóng bảng sẽ xóa key và yêu cầu đồng ý lại.

OpenAI dùng Responses API, tên gợi ý `gpt-4.1-mini`. Gemini dùng `generateContent`, tên gợi ý `gemini-2.5-flash`. Tên gợi ý có thể không khả dụng; danh sách qua API phản ánh quyền truy cập của key, còn tính năng ảnh/JSON phụ thuộc model. **Lỗi không tìm thấy model (404)**: tải danh sách và chọn model khác, hoặc chuyển Web AI. **Lỗi 429**: kiểm tra quota/thanh toán rồi thử lại. Không đổi key nhà cung cấp qua lại để sửa lỗi.

**Gói ChatGPT Free / Plus / Pro không bao gồm phí OpenAI API.** Hai dịch vụ có key/thanh toán riêng. Có thể hủy trong khi chạy; hủy không bảo đảm nhà cung cấp ngừng xử lý hoặc hoàn phí. Giới hạn chờ API 120 giây.

## Báo cáo 12 tab

1. Tổng quan: mô tả, phong cách, palette Local và giới hạn.
2. Cảnh: mốc ước lượng, ảnh mẫu và nút xem mốc trên video nguồn.
3. Prompt: master, negative gợi ý và scene prompts.
4. AI Tool: công cụ gốc **Unknown**; tách biệt nguồn phân tích báo cáo.
5. Nhân vật: mô tả cảnh do AI trả về; Local không nhận diện chủ thể.
6. Camera: camera, ánh sáng và chuyển động từ báo cáo, ghi rõ giới hạn Local.
7. Audio: nêu **chưa phân tích âm thanh**, không bịa nhạc hoặc lời thoại.
8. Kịch bản: dàn cảnh gợi ý từ hình ảnh, không phải thoại gốc.
9. Viral: checklist biên tập, không dự đoán lượt xem hoặc điểm viral.
10. Workflow: các bước tái tạo gợi ý, không giả nhận workflow gốc.
11. Tái tạo: thông số nguồn và prompt gợi ý.
12. Export: copy toàn bộ/all prompts/scene/master; tải JSON, TXT, Markdown, HTML; xem JSON chuẩn hóa. HTML không chứa script và escape nội dung AI.

## Cài đặt, lịch sử và cache

- Chuyển **Sáng/Tối**, mở Cài đặt để chọn ngôn ngữ, tối đa 12–60 ảnh, tự nhận diện và cache.
- Lưu tối đa 20 báo cáo lịch sử + 8 cache trong Chrome Storage; không lưu ảnh hoặc key. Metadata có tiêu đề/URL nguồn. Cache có dấu SHA-256 của ảnh, thông số nguồn và tùy chọn phân tích; thay ảnh/model/ghi chú sẽ không dùng nhầm cache cũ.
- **Phân tích lại** bỏ qua cache và lấy lại ảnh. **Xóa cache** không xóa lịch sử; lịch sử có nút xóa riêng. Tắt tự cache xóa cache đang có.
- Mở báo cáo lịch sử không khôi phục ảnh/video. Chọn lại nguồn để phân tích mới.
- **Giải phóng ảnh trong RAM** bỏ tham chiếu ảnh/blob video; vẫn giữ báo cáo để xuất. Trình duyệt quyết định thời điểm thu hồi bộ nhớ. Số hiển thị nếu có là JS heap, không phải tổng RAM của máy.

## Phát triển & kiểm thử

Không cần npm install/build. Node.js 20+ cho kiểm thử, Python stdlib cho đóng gói:

```sh
npm run check
npm test
python3 tests/browser_smoke.py
npm run package
```

Browser smoke cần Python Playwright, FFmpeg và Chromium (`/usr/bin/chromium`, hoặc `CHROMIUM_PATH`). Kiểm thử video tổng hợp thật, chọn nhiều video, tua/khôi phục trạng thái, đo pixel, cache/lịch sử/settings, 12 tab, Web JSON import, 4 định dạng xuất, model/quota và payload OpenAI/Gemini giả lập. Kiểm tra bố cục 320–900px; ảnh kiểm thử ở `dist/v2-dashboard.png`, `dist/v2-export.png`.

Chromium của môi trường cloud chặn nạp extension chưa đóng gói theo chính sách quản trị. Bài test chạy module/content script thật trong Chromium nhưng giả lập Chrome extension APIs; chưa xác minh `sidePanel`, quyền activeTab hoặc screenshot API thật. Mạng xã hội và dịch vụ AI thật cần đăng nhập/key của người dùng; kết quả phân tích trên các dịch vụ thật chưa được xác minh.

## Nguồn tham khảo

Cấu trúc Manifest V3, lấy khung hình và giao diện được viết lại từ bộ tệp/ảnh người dùng cung cấp. Không tái sử dụng server đăng nhập/kích hoạt, endpoint máy chủ riêng, bundle ONNX/Transformers hoặc WASM cũ. Bản này không chứa trọng số mô hình AI chạy cục bộ và không tạo màn hình đăng nhập/đăng xuất giả khi chưa có dịch vụ tài khoản.
