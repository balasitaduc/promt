# Dữ liệu và quyền

- **Local** đọc tệp/khung hình và đo pixel ngay trong trình duyệt. Không tải model, không gửi ảnh, ghi chú hoặc kết quả đến dịch vụ AI. Mở link video vẫn kết nối Facebook/Instagram như trang web thông thường.
- **Web AI** chuẩn bị ảnh và hướng dẫn để bạn tự tải, đính kèm và gửi trên ChatGPT/Gemini. Extension không tự gửi, đọc hội thoại, cookie hoặc dùng phiên đăng nhập để gọi API.
- **Cloud API**: sau khi đồng ý và bấm phân tích, gửi tối đa 24 ảnh JPEG, thời lượng/kích thước, ghi chú và hướng dẫn phân tích qua HTTPS đến `api.openai.com` hoặc `generativelanguage.googleapis.com` tùy bạn chọn. Không gửi tên tệp hoặc URL video trong payload API.
- Key chỉ gửi đúng nhà cung cấp bằng header `Authorization: Bearer` (OpenAI) hoặc `x-goog-api-key` (Google), không đưa vào URL. Nút danh sách model gửi key nhưng không gửi ảnh. Key chỉ giữ trong bộ nhớ khi mở bảng, bị xóa khi đóng bảng/đổi chế độ hoặc nhà cung cấp; không lưu Chrome Storage, lịch sử, cache hoặc tệp xuất.
- Quyền `storage` dùng lưu cài đặt, tối đa 20 báo cáo lịch sử và 8 cache trên trình duyệt của bạn. Báo cáo chứa tiêu đề/URL nguồn, thời gian, số liệu nguồn, engine và kết quả. Cache chỉ lưu báo cáo kèm dấu SHA-256 nhận diện; không lưu ảnh hoặc toàn bộ video. Tắt cache sẽ xóa cache hiện có. Có nút xóa cache và nút xóa lịch sử riêng.
- Quyền trang Facebook/Instagram dùng để quét video đang hiển thị, chọn đúng video và lấy ảnh. Tự quét chỉ hoạt động khi bảng đang mở và tùy chọn tự nhận diện được bật; không tự lấy ảnh hoặc gọi AI. Không đọc mật khẩu/cookie. Trang khác cần người dùng cấp `activeTab` bằng biểu tượng extension.
- Khi CORS chặn canvas, Chrome có thể chụp toàn tab trong bộ nhớ rồi cắt đúng vùng video; chỉ ảnh vùng video được giữ để xem trước/gửi phân tích. Giữ video không bị che và kiểm tra các ảnh trước khi đồng ý gửi. DRM, livestream và iframe có thể không hoạt động.
- Tệp xuất JSON/TXT/Markdown/HTML chứa báo cáo và metadata nguồn; kiểm tra trước khi chia sẻ. Bảng ảnh được lưu xuống máy chỉ khi bấm tải. Nhập JSON chỉ đọc dữ liệu, không thực thi HTML/script; nội dung AI hiển thị bằng văn bản.
- Không có analytics hoặc backend riêng. Việc nhà cung cấp AI xử lý dữ liệu phụ thuộc điều khoản dịch vụ và tài khoản của bạn. Chỉ gửi nội dung bạn có quyền sử dụng.

- Bản 3.0 bổ sung báo cáo có mô tả chủ thể, trang phục/vật liệu, liên kết cảnh, bằng chứng timestamp và prompt VI/EN do AI trả về. Chỉ gửi cho nhà cung cấp sau khi người dùng chọn chế độ và đồng ý; bản Web do người dùng tự gửi. Những thông tin mô tả đó có thể nằm trong lịch sử/tệp xuất, nên kiểm tra trước khi chia sẻ.
- Timestamp bằng chứng được kiểm tra với ảnh mẫu, nhưng không xác minh tính đúng đắn của mô tả AI. Không có mô hình xác suất nguồn AI đã hiệu chuẩn và không đọc audio nguồn.
