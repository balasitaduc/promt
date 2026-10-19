# Dữ liệu và quyền

- Tệp video được đọc cục bộ trong trình duyệt. Không tải toàn bộ tệp lên mạng.
- Khi bạn bấm phân tích sau khi đồng ý, các ảnh JPEG mẫu, thời lượng/kích thước, ghi chú sáng tạo và yêu cầu phân tích được gửi qua HTTPS đến `generativelanguage.googleapis.com`. Không gửi tên tệp hoặc URL video trong payload Gemini.
- API key được gửi bằng header `x-goog-api-key` đến Google. Extension không lưu key, lịch sử, tệp hoặc kết quả trong Chrome Storage; không có analytics hay backend riêng. Cách Google xử lý dữ liệu phụ thuộc điều khoản dịch vụ và loại tài khoản của bạn.
- Quyền trang Facebook/Instagram dùng để mở link và đọc ảnh video bằng phiên đăng nhập trình duyệt có sẵn. Không đọc cookie hoặc mật khẩu. `activeTab` và `scripting` dùng để lấy ảnh sau thao tác người dùng. Khi CORS chặn, Chrome có thể chụp toàn tab trong bộ nhớ rồi cắt đúng vùng video; chỉ ảnh vùng video được giữ trong bảng và gửi Gemini.
- Bảng ảnh/kết quả chỉ được lưu xuống máy khi bạn bấm tải. Tệp xuất JSON/Markdown có tên tệp hoặc tiêu đề trang làm metadata; hãy kiểm tra trước khi chia sẻ.
- Ảnh video có thể chứa dữ liệu cá nhân. Chỉ gửi nội dung bạn có quyền xử lý và kiểm tra ảnh mẫu trước khi đồng ý.
