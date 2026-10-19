# Dữ liệu và quyền

- Tệp video được đọc cục bộ trong trình duyệt. Không tải toàn bộ tệp lên mạng.
- Chế độ ChatGPT web mặc định không gọi API AI. Extension chuẩn bị bảng ảnh và hướng dẫn để bạn tự tải, đính kèm và gửi trên `chatgpt.com`. Extension không tự gửi, đọc hội thoại, đọc cookie hoặc dùng phiên đăng nhập ChatGPT để gọi API.
- Với chế độ API, khi bạn bấm phân tích sau khi đồng ý, các ảnh JPEG mẫu, thời lượng/kích thước, ghi chú và yêu cầu phân tích được gửi qua HTTPS đến nhà cung cấp bạn chọn: `api.openai.com` (OpenAI) hoặc `generativelanguage.googleapis.com` (Google). Không gửi tên tệp hoặc URL video trong payload API.
- API key chỉ gửi đến đúng nhà cung cấp bằng header `Authorization: Bearer` (OpenAI) hoặc `x-goog-api-key` (Google). Nút tải danh sách model cũng gửi key đến chính nhà cung cấp đó, nhưng không gửi ảnh. Đổi nhà cung cấp xóa key và yêu cầu đồng ý lại. Extension không lưu key, lịch sử, tệp hoặc kết quả trong Chrome Storage; không có analytics hay backend riêng. Cách nhà cung cấp xử lý dữ liệu tùy điều khoản dịch vụ và loại tài khoản.
- Quyền trang Facebook/Instagram dùng để mở link và đọc ảnh video bằng phiên đăng nhập trình duyệt có sẵn. Không đọc cookie hoặc mật khẩu. `activeTab` và `scripting` dùng để lấy ảnh sau thao tác người dùng. Khi CORS chặn, Chrome có thể chụp toàn tab trong bộ nhớ rồi cắt đúng vùng video; chỉ ảnh vùng video được giữ trong bảng để gửi phân tích.
- Bảng ảnh/kết quả chỉ được lưu xuống máy khi bạn bấm tải. Tệp xuất JSON/Markdown có tên tệp hoặc tiêu đề trang làm metadata; hãy kiểm tra trước khi chia sẻ.
- Ảnh video có thể chứa dữ liệu cá nhân. Chỉ gửi nội dung bạn có quyền xử lý và kiểm tra ảnh mẫu trước khi đồng ý.
