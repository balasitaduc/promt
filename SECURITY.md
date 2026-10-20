# Cảnh báo tải xuống đang được xác minh

Ngày 20/10/2026, người dùng cung cấp báo cáo **Windows Security/Defender**: `Trojan:Script/Ulthar.A!ml`, mức Severe, `Quarantine failed`, đồng thời mục báo cáo ghi tệp đã được Allow. Affected item là `video-to-prompt (1).zip -> sidepanel.html`, tải từ URL raw của repository. Không công bố tên tài khoản Windows hoặc đường dẫn cá nhân của người dùng.

**Đã xác định tệp bị Defender đánh dấu, nhưng chưa xác định nguyên nhân hoặc kết luận có mã độc/false positive.** Việc cập nhật dependency không chứng minh đã khắc phục nhận diện trên HTML.

Tạm rút `video-to-prompt.zip` khỏi nhánh main và bỏ liên kết cài ZIP trong README trong khi xác minh. Các bản cũ vẫn có thể tồn tại trong lịch sử Git/cache. Không tắt antivirus, thêm ngoại lệ hoặc khôi phục tệp đã cách ly theo hướng dẫn của repository này.

## Các kiểm tra đã làm

- ZIP 3.1.1 trên GitHub khớp với ZIP và các tệp nguồn tại commit `cf5169d`. SHA-256: `6e8ac75dbc780ef12e659279748a6d4ff9893da2a362e2d3ee2aa8cd3818a227`.
- Kiểm tra CRC và thành phần ZIP: không có đường dẫn thoát thư mục, symlink hay file thực thi Windows; JS/MJS/WASM vẫn là mã thực thi trong trình duyệt, nên kiểm tra này không chứng minh không có mã độc.
- Đối chiếu chính `sidepanel.html` trong ZIP 3.1.1 với source tại commit phát hành: khớp byte, 10.925 byte. SHA-256: `4a9e0b47336983a6ebc6a1da0c04189da43418ad3f01575498a31ced9155c149`. Rà soát tĩnh bằng HTML parser: chỉ một script module nội bộ `sidepanel.js`, không script inline, thuộc tính event handler inline, iframe/object/embed hoặc URI javascript/data/vbscript. Liên kết ngoài trong HTML chỉ tới ChatGPT, Gemini và trang API key OpenAI. Các tính chất này chưa đủ để tuyên bố file sạch hoặc Defender nhận nhầm; module được HTML nạp và runtime cũng phải được kiểm tra.
- Hai tài nguyên ONNX MJS/WASM cũ khớp byte với gói `onnxruntime-web` trong npm lockfile. Bundle trình duyệt cũ có thể build lại giống hệt; metafile cho thấy không chứa `sharp`, `onnxruntime-node`, `global-agent`, `roarr` hoặc `sprintf-js`.
- `npm audit` ở dependency cũ báo 6 cảnh báo (2 high, 4 moderate), qua nhánh Node của Transformers. Đây là báo cáo lỗ hổng dependency, không phải kết quả antivirus hoặc bằng chứng nguyên nhân cảnh báo tải xuống.
- Nâng `@huggingface/transformers` từ 3.8.1 lên 4.3.1 và cập nhật lockfile; lần kiểm tra sau cập nhật báo 0 cảnh báo npm. Kết quả chỉ phản ánh cơ sở dữ liệu advisory tại thời điểm chạy, không phải chứng nhận an toàn.
- Build lại bundle ở dạng không minify để dễ rà soát. Runtime ONNX lấy từ package đã khóa phiên bản; script build chặn việc đưa các package Node kể trên vào bundle trình duyệt. `vendor/PROVENANCE.json` ghi phiên bản và SHA-256 các tệp runtime; metafile nằm ở `dist/vision-runtime-metafile.json`.
- GitHub push protection của bản sửa nhận nhầm một tên constructor công khai (32 ký tự) trong bảng đăng ký model Mistral thành API key. Đã đối chiếu với source package, không phải khóa tài khoản. Build cho ứng dụng caption cố định bỏ mục đăng ký kiến trúc Mistral không dùng đến; không mã hóa chuỗi hoặc tắt/ghi đè push protection. Sự kiện này độc lập với cảnh báo Windows chưa xác định, không phải bằng chứng Windows báo nhầm.
- Giữ CSP chỉ cho phép script/worker từ extension; WASM cần `wasm-unsafe-eval`. Tắt cache factory WASM tạo Blob của runtime mới vì JS/MJS/WASM đã nằm trong extension. Trọng số/cấu hình model vẫn tải riêng qua HTTPS, không phải mã JS từ CDN.
- Bài runtime đã thực thi ONNX Add thật dưới CSP tương ứng và kiểm tra lỗi tải trọng số bằng worker thật. Đây không phải kiểm thử chất lượng model hay quét virus.

## Còn cần xác minh

Môi trường hiện không có Windows Defender hoặc công cụ antivirus với bộ chữ ký để quét ZIP. Chưa có kết quả quét antivirus độc lập và chưa tái hiện được cảnh báo của người dùng trong môi trường này. Truy cập đọc trang tra cứu Microsoft và VirusTotal hash bị proxy từ chối 403; không có kết quả online để đối chiếu. Không gửi ZIP/mã nguồn đến dịch vụ quét bên ngoài.

Đã nhận tên mối đe dọa/tệp từ người dùng. Còn thiếu một lần xác minh bằng Defender cập nhật hoặc đánh giá của Microsoft để xác định tính đúng/sai và nguyên nhân nhận diện. Chưa gửi mẫu ra Microsoft hoặc dịch vụ bên ngoài.

### Xử lý trên máy Windows

1. Trong **Windows Security → Virus & threat protection → Allowed threats**, chọn đúng mục liên quan và **Don't allow** để thu hồi trạng thái cho phép. Không thêm ngoại lệ hoặc chọn Allow/Restore.
2. Nếu đã nạp extension, tắt/gỡ đúng extension tại `chrome://extensions`. Đóng Chrome và xóa các ZIP/thư mục đã giải nén của extension này nếu chúng chưa được Defender cách ly. Không giải nén lại mẫu bị chặn để thử cài.
3. Cập nhật Security intelligence và chạy **Scan options → Full scan**. Nếu vẫn báo cách ly/khắc phục thất bại, dùng **Microsoft Defender Offline scan**; lưu công việc trước vì máy sẽ khởi động lại.

Đây là hướng dẫn xử lý theo báo cáo, không phải bằng chứng máy đã bị điều khiển hoặc xác nhận quá trình khắc phục trên máy người dùng đã thành công.

Không phát hành lại ZIP chỉ dựa vào `npm audit` hoặc việc bài test chức năng đã qua. Trước khi cung cấp lại bản cài, cần đối chiếu báo cáo thực tế, xử lý nguyên nhân xác định được và nêu rõ phạm vi kiểm chứng antivirus.

## Đóng gói để kiểm tra

`npm run package` chỉ tạo ZIP cục bộ trong `dist/`; không tự chép vào gốc repository hoặc phát hành. Khi đủ điều kiện phát hành, việc chép ra gốc là bước riêng có chủ ý: `python3 scripts/package.py --copy-to-root`.
