# Cảnh báo tải xuống đang được xác minh

Ngày 20/10/2026, người dùng báo “phát hiện virus” sau hướng dẫn tải extension/Ollama. Người dùng xác nhận cảnh báo xuất hiện trên Windows; chưa có nguyên văn thông báo, tên mối đe dọa hoặc tệp bị chặn để phân biệt Defender/SmartScreen. **Chưa xác định cảnh báo thuộc ZIP extension, installer Ollama hay một tệp khác; chưa kết luận có mã độc hoặc false positive.**

Tạm rút `video-to-prompt.zip` khỏi nhánh main và bỏ liên kết cài ZIP trong README trong khi xác minh. Các bản cũ vẫn có thể tồn tại trong lịch sử Git/cache. Không tắt antivirus, thêm ngoại lệ hoặc khôi phục tệp đã cách ly theo hướng dẫn của repository này.

## Các kiểm tra đã làm

- ZIP 3.1.1 trên GitHub khớp với ZIP và các tệp nguồn tại commit `cf5169d`. SHA-256: `6e8ac75dbc780ef12e659279748a6d4ff9893da2a362e2d3ee2aa8cd3818a227`.
- Kiểm tra CRC và thành phần ZIP: không có đường dẫn thoát thư mục, symlink hay file thực thi Windows; JS/MJS/WASM vẫn là mã thực thi trong trình duyệt, nên kiểm tra này không chứng minh không có mã độc.
- Hai tài nguyên ONNX MJS/WASM cũ khớp byte với gói `onnxruntime-web` trong npm lockfile. Bundle trình duyệt cũ có thể build lại giống hệt; metafile cho thấy không chứa `sharp`, `onnxruntime-node`, `global-agent`, `roarr` hoặc `sprintf-js`.
- `npm audit` ở dependency cũ báo 6 cảnh báo (2 high, 4 moderate), qua nhánh Node của Transformers. Đây là báo cáo lỗ hổng dependency, không phải kết quả antivirus hoặc bằng chứng nguyên nhân cảnh báo tải xuống.
- Nâng `@huggingface/transformers` từ 3.8.1 lên 4.3.1 và cập nhật lockfile; lần kiểm tra sau cập nhật báo 0 cảnh báo npm. Kết quả chỉ phản ánh cơ sở dữ liệu advisory tại thời điểm chạy, không phải chứng nhận an toàn.
- Build lại bundle ở dạng không minify để dễ rà soát. Runtime ONNX lấy từ package đã khóa phiên bản; script build chặn việc đưa các package Node kể trên vào bundle trình duyệt. `vendor/PROVENANCE.json` ghi phiên bản và SHA-256 các tệp runtime; metafile nằm ở `dist/vision-runtime-metafile.json`.
- GitHub push protection của bản sửa nhận nhầm một tên constructor công khai (32 ký tự) trong bảng đăng ký model Mistral thành API key. Đã đối chiếu với source package, không phải khóa tài khoản. Build cho ứng dụng caption cố định bỏ mục đăng ký kiến trúc Mistral không dùng đến; không mã hóa chuỗi hoặc tắt/ghi đè push protection. Sự kiện này độc lập với cảnh báo Windows chưa xác định, không phải bằng chứng Windows báo nhầm.
- Giữ CSP chỉ cho phép script/worker từ extension; WASM cần `wasm-unsafe-eval`. Tắt cache factory WASM tạo Blob của runtime mới vì JS/MJS/WASM đã nằm trong extension. Trọng số/cấu hình model vẫn tải riêng qua HTTPS, không phải mã JS từ CDN.
- Bài runtime đã thực thi ONNX Add thật dưới CSP tương ứng và kiểm tra lỗi tải trọng số bằng worker thật. Đây không phải kiểm thử chất lượng model hay quét virus.

## Còn cần xác minh

Môi trường hiện không có Windows Defender hoặc công cụ antivirus với bộ chữ ký để quét ZIP. Chưa có kết quả quét antivirus độc lập và chưa tái hiện được cảnh báo của người dùng. Không gửi ZIP/mã nguồn đến dịch vụ quét bên ngoài.

Cần nguyên văn tên cảnh báo và đường dẫn/tên tệp bị chặn. Trên Windows: **Windows Security → Virus & threat protection → Protection history → mở mục liên quan**, lấy **Threat name** và **Affected items**. Nếu chỉ là cảnh báo tải xuống của Chrome, lấy nguyên văn thông báo ở Downloads. Có thể là chặn do danh tiếng tệp hoặc phát hiện mã độc; chỉ phân biệt khi có thông tin thực tế.

Không phát hành lại ZIP chỉ dựa vào `npm audit` hoặc việc bài test chức năng đã qua. Trước khi cung cấp lại bản cài, cần đối chiếu báo cáo thực tế, xử lý nguyên nhân xác định được và nêu rõ phạm vi kiểm chứng antivirus.

## Đóng gói để kiểm tra

`npm run package` chỉ tạo ZIP cục bộ trong `dist/`; không tự chép vào gốc repository hoặc phát hành. Khi đủ điều kiện phát hành, việc chép ra gốc là bước riêng có chủ ý: `python3 scripts/package.py --copy-to-root`.
