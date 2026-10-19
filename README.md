# Video → Prompt

Extension Chrome / Edge Manifest V3: dán link Facebook / Instagram, lấy khung hình video và dùng ChatGPT, OpenAI API hoặc Gemini API để suy luận prompt tổng và prompt theo cảnh. Giao diện tiếng Việt; prompt tạo video bằng tiếng Anh. Không có máy chủ riêng hoặc yêu cầu tài khoản của extension.

**[Tải extension ZIP để cài vào Chrome](https://github.com/balasitaduc/promt/raw/refs/heads/main/video-to-prompt.zip)**. Giải nén gói này, rồi chọn thư mục chứa `manifest.json` khi bấm **Load unpacked**. Nếu GitHub yêu cầu, đăng nhập bằng tài khoản có quyền xem repository.

## Cài đặt

1. Giải nén `video-to-prompt.zip` (bản build cũng có tại `dist/video-to-prompt.zip`) hoặc dùng thư mục mã nguồn này.
2. Mở `chrome://extensions` (Edge: `edge://extensions`), bật **Developer mode / Chế độ nhà phát triển**.
3. Chọn **Load unpacked / Tải tiện ích đã giải nén**, chọn thư mục có `manifest.json`.
4. Ghim extension, bấm biểu tượng **Video → Prompt** để mở bảng bên cạnh.

### Cập nhật từ 1.0.0 lên 1.1.0

Tải ZIP mới, giải nén đè vào thư mục extension cũ rồi vào `chrome://extensions` bấm **Tải lại / Reload** trên thẻ Video → Prompt. Đóng và mở lại side panel để nhận giao diện mới. Nếu Chrome yêu cầu quyền `api.openai.com`, chỉ cấp khi muốn dùng OpenAI API.

## Dùng ChatGPT không cần API key (mặc định)

1. Chọn video hoặc dán link và lấy khung hình như bên dưới.
2. Giữ **ChatGPT web · Không cần key** trong ô công cụ phân tích.
3. Bấm **1. Tải bảng ảnh cho ChatGPT**, rồi **2. Sao chép hướng dẫn** (hoặc tải hướng dẫn `.txt`).
4. Bấm **3. Mở ChatGPT**, đăng nhập tài khoản ChatGPT của bạn nếu cần.
5. Tự đính kèm `video-frames.jpg`, dán hướng dẫn rồi gửi. Kết quả nằm trong hội thoại ChatGPT; hạn mức tải ảnh tùy tài khoản.

Extension không tự đính kèm ảnh hoặc tự gửi, không đọc hội thoại và không dùng cookie ChatGPT để gọi API. Chỉ dán link video vào ChatGPT có thể không đủ để đọc video; cần đính kèm ảnh đã chuẩn bị.

## Phân tích tự động bằng OpenAI API hoặc Gemini API

Sau khi lấy ảnh, chọn **OpenAI API · Tự động** hoặc **Gemini API · Tự động**, nhập key đúng nhà cung cấp, bấm **Tải danh sách model**, chọn model hỗ trợ hình ảnh và JSON. Đồng ý gửi ảnh rồi bấm phân tích. Kết quả hiện trong extension, có thể sao chép/xuất Markdown/JSON.

OpenAI gọi Responses API bằng model GPT hỗ trợ ảnh (tên gợi ý `gpt-4.1-mini`). Gemini gọi `generateContent` (tên gợi ý `gemini-2.5-flash`). Đây là gợi ý, không bảo đảm model khả dụng: danh sách tải bằng API key mới phản ánh quyền truy cập của tài khoản, và mỗi model còn có giới hạn tính năng riêng.

**ChatGPT Free / Plus / Pro và OpenAI API là hai dịch vụ thanh toán riêng.** Đăng nhập ChatGPT không tự cấp API key hoặc quota API. Dùng ChatGPT web nếu không muốn thiết lập API. Key chỉ giữ trong bộ nhớ bảng, không lưu vào mã hoặc ổ đĩa; đổi nhà cung cấp sẽ xóa key và yêu cầu đồng ý lại.

### Lỗi “Không tìm thấy model”

Lỗi này do model đã chọn không được tìm thấy qua API cho key hiện tại (ví dụ tên cũ, quyền truy cập hoặc endpoint không hỗ trợ model đó). Bấm **Tải danh sách model**, chọn model khả dụng hỗ trợ ảnh/JSON rồi thử lại. Không sửa bằng cách nhập key Gemini vào OpenAI hoặc ngược lại. Có thể chuyển ngay sang ChatGPT web để dùng tài khoản ChatGPT mà không cần model API.

## Phân tích link Facebook / Instagram

1. Dán link, ví dụ `https://www.instagram.com/reels/DepGcNqih2d/`, chọn số ảnh mẫu rồi bấm **Mở link & lấy khung hình**.
2. Trang được mở trong tab mới. Extension đợi tối đa 25 giây để tìm video có thể đọc. Nếu trang yêu cầu đăng nhập, hãy đăng nhập bằng giao diện chính thức, đóng hộp thoại và phát video; bấm **Lấy video từ tab đang mở** để thử lại. Extension không đọc mật khẩu hoặc cookie.
3. Nếu CORS chặn canvas: bấm biểu tượng extension khi tab video đang được chọn để cấp `activeTab`, sau đó bấm **Lấy video từ tab đang mở**. Extension có thể chụp tab rồi cắt vùng video; giữ toàn bộ video trong vùng nhìn thấy, không che bằng hộp thoại và không đổi tab. Kiểm tra ảnh mẫu vì lớp phủ/phụ đề có thể xuất hiện trong ảnh. Nếu vẫn không đọc được, dùng tệp video bạn có quyền sử dụng.
4. Chọn ChatGPT web để tự đính kèm ảnh, hoặc OpenAI/Gemini API để phân tích tự động như hướng dẫn ở trên.
5. Với API: đánh dấu đồng ý gửi ảnh và bấm **Phân tích & tạo prompt**. Có thể hủy yêu cầu đang chạy. Hủy không bảo đảm nhà cung cấp dừng xử lý hoặc hoàn phí.
6. Xem tổng quan, phong cách, prompt tổng, negative prompt và cảnh có mốc thời gian ước lượng trong ChatGPT hoặc trong extension tùy chế độ.

## Tệp video

Chọn MP4/WebM/MOV có codec Chrome hỗ trợ (khuyến nghị MP4 H.264 hoặc WebM VP8/VP9). Tối đa 250 MB, 10 phút. Bấm **Lấy khung hình từ tệp**, xem 6/12/24 ảnh mẫu. Khung hình dài tối đa 960 pixel. Có thể tải bảng ảnh JPEG ngay cả khi chưa có API key. Thay đổi số ảnh rồi lấy lại nếu cần mật độ khác.

## Giới hạn

- Đây là **prompt suy luận**, không phải khôi phục prompt gốc. Không xác định chắc chắn công cụ AI đã tạo video.
- Phân tích ảnh mẫu, không nghe âm thanh; chuyển động và ranh giới cảnh là suy đoán. Video cắt cảnh nhanh có thể bị bỏ sót. Thời lượng không lấy từ link; cần video được tải trong trình duyệt.
- Link riêng tư, bị xóa, yêu cầu đăng nhập, giới hạn khu vực, livestream, iframe và DRM có thể không hoạt động. Không tải lén hoặc vượt cơ chế bảo vệ nền tảng.
- Chỉ video đang hiển thị ở frame chính của trang được chọn; ưu tiên video đang phát rồi đến video lớn nhất. Hãy dừng video khác và cuộn đến đúng Reel.
- Có quyền đọc trang Facebook/Instagram để mở link và lấy ảnh. Trang khác chỉ truy cập sau khi bạn bấm biểu tượng extension, nhờ `activeTab`.
- API có thể tính phí hoặc hết quota. Không nhúng key trong mã; key chỉ giữ trong bộ nhớ trang và bị xóa khi đóng bảng. Không có lịch sử lưu tự động.
- Đã kiểm thử bằng video tổng hợp và phản hồi API giả lập. Kiểm tra link mạng xã hội thực tế cần phiên đăng nhập của người dùng; OpenAI/Gemini thật cần API key hợp lệ. Chưa xác minh kết quả phân tích trên các dịch vụ thật.

## Phát triển và kiểm thử

Không cần npm install hoặc build; mã JavaScript module chạy trực tiếp trong extension. Node.js 20+ dùng cho kiểm thử.

```sh
cd /workspace/promt
npm run check
npm test
npm run package
```

Kiểm thử trình duyệt: `python3 tests/browser_smoke.py` cần Python Playwright, FFmpeg và Chromium (`/usr/bin/chromium`, hoặc đặt `CHROMIUM_PATH`). Kiểm thử tạo video WebM tổng hợp, chạy module giao diện và content script thật trong Chromium, lấy ảnh từ tệp/tab, chuẩn bị ảnh/hướng dẫn cho ChatGPT, mở link Instagram giả lập, tải danh sách model, xử lý model 404/quota và phân tích ảnh bằng OpenAI/Gemini giả lập. Chrome extension APIs được giả lập vì Chromium của môi trường cloud có chính sách quản trị chặn tải extension chưa đóng gói. Chưa xác minh side panel, cấp quyền activeTab và chụp tab qua API Chrome thật; cần kiểm tra sau khi cài trên trình duyệt người dùng. Không gọi các API AI thật hoặc cần credential.

## Nguồn tham khảo

Dựa trên cấu trúc Manifest V3, side panel, phát hiện video và lấy khung hình của bộ tệp người dùng cung cấp. Viết lại thành mã nguồn có thể đọc và kiểm thử. Không tái sử dụng module đăng nhập/kích hoạt, máy chủ `mdagent.duckdns.org`, `api.md-ai-analyzer.cloud` hoặc bundle ONNX/Transformers. Các bundle cũ và WASM không cần thiết cho bản mới.
