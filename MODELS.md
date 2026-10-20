# Chọn model cho phân tích video

Nguồn được đối chiếu ngày 20/10/2026. Đây là lựa chọn kiến trúc và cách kết nối, **chưa phải benchmark chất lượng trên video của bạn**. Không có model nào được chứng minh là “mạnh nhất” trong repository này.

| Lựa chọn | Chạy ở đâu | Phù hợp / giới hạn | Trạng thái tích hợp |
| --- | --- | --- | --- |
| `Xenova/vit-gpt2-image-captioning` q8 | Worker WASM trong Chrome | Mô tả keyframe tiếng Anh; nhỏ hơn VLM nhiều tỷ tham số, không hiểu toàn bộ diễn biến | Đã thêm; runtime thật đã kiểm tra, trọng số pretrained chưa tải được trong cloud |
| SmolVLM / SmolVLM2 | Runtime tương thích trên máy hoặc server | Dòng nhỏ hỗ trợ ảnh/video; cần processor và bản chuyển đổi tương thích, không thể đổi mỗi tên model trong pipeline caption | Đã khảo sát; chưa tích hợp vào browser. Không đóng gói model chưa kiểm tra như tính năng hoàn tất |
| Qwen3‑VL 4B / 8B | Ollama trên máy | Hỏi đáp nhiều ảnh, chủ thể, bố cục, diễn biến ước lượng; cần RAM/VRAM và thời gian suy luận | Adapter Ollama đã thêm; chỉ liệt kê model đã cài có capability `vision`, chưa benchmark thật |
| Qwen3.5 và VLM lớn hơn do provider phục vụ | Hugging Face hoặc runtime phù hợp | Có thể chọn model lớn theo bộ nhớ/ngân sách; không phải mọi model trên Hub đều có API, nhận nhiều ảnh hay trả JSON | HF adapter đã thêm; danh sách lấy động, lọc metadata hỗ trợ ảnh/text, chưa gọi live bằng tài khoản người dùng |
| ChatGPT / Gemini web | Trang AI của bạn | Dùng bảng ảnh + hướng dẫn JSON; hạn mức/tải ảnh tùy tài khoản | Luồng chuẩn bị/nhập JSON đã kiểm tra; người dùng tự đính kèm và gửi |

## Hugging Face Free dùng được gì?

- Tải trọng số công khai và chạy bằng phần cứng của mình, tuân theo giấy phép từng model. Model gated có thể yêu cầu chấp nhận điều khoản/quyền truy cập. Tài khoản miễn phí không biến model gated thành model được cấp quyền tự động.
- Lưu repository và dùng các tính năng Hub trong giới hạn dịch vụ. Một số Spaces công khai cho thử demo, với hạn mức/hàng đợi riêng; không phải GPU/API vô hạn cho extension.
- Theo bảng giá chính thức đã đọc, **Free không có credit Inference Providers hằng tháng**. API cần credit/thanh toán hoặc điều kiện riêng của provider. Không đồng nghĩa cần mua PRO để tải mọi model mở.
- Muốn dùng API trong extension: tạo token fine-grained có quyền **Make calls to Inference Providers**, nhập trực tiếp vào trường token của extension. Không gửi token trong chat/GitHub. Token chỉ ở bộ nhớ phiên, không cần cho model caption công khai.

## Chạy Qwen bằng Ollama trên máy

1. Cài Ollama từ [trang chính thức](https://ollama.com/download), mở ứng dụng/dịch vụ trên máy đang chạy Chrome.
2. Chọn model Vision tương thích với phiên bản Ollama và phần cứng. Ví dụ bắt đầu với `ollama pull qwen3-vl:4b`, hoặc `ollama pull qwen3-vl:8b` khi đủ bộ nhớ; kiểm tra tag ở [thư viện Ollama](https://ollama.com/library/qwen3-vl). Đây là lệnh bạn chạy trên máy, extension không tự tải model Ollama.
3. Trong extension chọn **3. Vision chuyên sâu → Ollama → Tải danh sách model**. Chỉ model đã cài và khai báo `vision` được đưa vào danh sách. Bản có hậu tố cloud hoặc metadata remote không dùng cho chế độ trên máy.
4. Đồng ý gửi ảnh đến Ollama cục bộ. Chạy một lượt trước; sau đó bật **Phân tích từng cảnh rồi tổng hợp** khi muốn nhiều chi tiết hơn. Model nhỏ có thể sai JSON hoặc thiếu trường; đổi model/giảm số cảnh khi gặp lỗi.

Extension dùng `http://localhost:11434`. Nếu không kết nối được: kiểm tra Ollama đang chạy, phiên bản hỗ trợ Vision, quyền truy cập mạng cục bộ của Chrome và log CORS. Khi cần cấu hình Origin, dùng đúng `chrome-extension://<ID>` lấy từ `chrome://extensions` trong `OLLAMA_ORIGINS`, rồi khởi động lại Ollama. Không cần mở dịch vụ ra Internet. Xem [tài liệu Ollama](https://docs.ollama.com/faq).

Request native đặt `num_ctx:32768`, `num_predict:16384`, `format:"json"`, `think:false`. Bộ nhớ còn phụ thuộc lượng ảnh, độ phân giải, quantization và cache ngữ cảnh; kích thước file model không bằng tổng RAM cần có. Chưa có số đo hiệu năng trên phần cứng của bạn.

## Cách phân tích sâu hoạt động

1. Đọc video thật, lấy mẫu ảnh và đo pixel; đề xuất ranh giới cảnh từ khác biệt ảnh.
2. Khi bật nhiều lượt: phân tích ảnh trong từng khoảng cảnh, tối đa 12 lượt. Mỗi lượt yêu cầu 22 trường, mô tả/prompt VI/EN, Image/Video Prompt và timestamp bằng chứng; chưa quan sát được thì để null.
3. Tổng hợp ảnh đại diện cùng các quan sát trước đó thành master prompt, tham chiếu nhân vật, kịch bản, nhận xét biên tập và workflow tái tạo. Ghi chú AI được xử lý như dữ liệu có thể sai, không phải sự thật đã xác minh.
4. Kiểm tra JSON/mốc/timestamp, gắn lại số đo pixel thật rồi hiển thị 12 tab. `analysisPasses` trong JSON cho biết số lượt và các ghi chú cảnh đã dùng. Lượt lỗi dừng và báo lỗi, không sinh dữ liệu thay thế.

Đây vẫn là **phân tích nhiều ảnh lấy mẫu**, chưa gửi track video nguyên bản hoặc audio cho model. Không tuyên bố nhận ra nhạc/lời thoại, lens thật, công cụ tạo video gốc hay phục hồi đúng prompt gốc. Có thể bỏ sót hành động giữa hai ảnh.

## Nguồn chính thức

- [Qwen3‑VL — model, video inference và giới hạn bộ nhớ](https://github.com/QwenLM/Qwen3-VL)
- [Dòng Qwen đa phương thức mới hơn — repository chính thức](https://github.com/QwenLM/Qwen3.5)
- [SmolVLM của Hugging Face](https://github.com/huggingface/smollm/tree/main/vision)
- [Transformers.js — model/browser runtime](https://github.com/huggingface/transformers.js)
- [Hugging Face Inference Providers — giá và credit hiện tại](https://huggingface.co/docs/inference-providers/pricing)
- [Hugging Face Chat Completion — quyền token, ảnh và JSON](https://huggingface.co/docs/inference-providers/tasks/chat-completion)
- [Ollama API — ảnh, model và capability](https://github.com/ollama/ollama/blob/main/docs/api.md)
