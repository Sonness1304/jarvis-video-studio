# P7.5 — Bàn nội dung

Mở `Open-Video-Studio.cmd`, mở dự án, chọn thư viện **Cảnh → Bàn nội dung**.
Bàn dùng sáu mạch kể: giải thích, hướng dẫn, demo công cụ, kể chuyện, so sánh và số liệu.
Giữ template/theme/giọng của dự án; không tải model mới.

## Từ chủ đề đến bản nháp

1. Điền chủ đề, người xem, mục tiêu, thời lượng dự kiến và thông tin nguồn. Chọn 3–6 cảnh.
2. Bấm **Gợi ý bằng Claude Sonnet** nếu muốn gọi AI. Chỉ brief đang nhập được gửi qua
   9router; media, tài khoản và toàn bộ dự án không được tự gửi. Mở bảng/đổi cấu trúc/đổi
   bố cục/đọc kết quả không gọi model. Sonnet dùng alias `ag/claude-sonnet-4-6`.
3. Xem dàn cảnh và lý do. Sửa tiêu đề, lời đọc, chữ trên hình, các ý chính, bố cục và
   thông tin còn thiếu. Số liệu/trích dẫn/URL không khớp thông tin nguồn có ô cần xác nhận;
   chỉ xóa ghi chú đó sau khi tự kiểm và bổ sung. Đây là hỗ trợ kiểm nguồn, không chứng minh
   mọi câu chữ AI đều đúng. URL trong ghi chú không tự được truy cập/xác minh.
4. Chọn từng cảnh cần áp dụng. Cảnh ảnh/clip/storyboard có sẵn được giữ mặc định;
   chỉ thay khi bật lựa chọn rõ trên thẻ. Cảnh cũ dư ra không bị xóa. Media mới phải chọn
   từ danh sách đã đăng ký và kiểm lại hash ở server.
5. Bấm **Áp dụng vào nháp**. Một lần Hoàn tác khôi phục cả nhóm. Bấm **Lưu dự án** để
   lưu, **Cập nhật preview** để xem hình, hoặc **Xuất video** để tạo giọng và MP4/SRT.
   Áp dụng không tự lưu, tạo ảnh/clip hoặc xuất video.

Thời lượng mục tiêu là ý định biên tập, không kéo giãn audio. WAV thật quyết định timeline
và phụ đề. Thay visual giữ voice cache; đổi lời chỉ cần tạo lại cụm đọc thay đổi.

## Khi đang chờ hoặc đã có kết quả

Chữ đang gõ được giữ khi AI trả lời. Nếu đã sửa sau khi gọi, kết quả mới nằm ở nút
**Mở gợi ý mới**; có thể quay lại bản đang sửa. Đóng bảng giữ bản chỉnh trong tab.
Cache giới hạn64KiB; nếu không lưu được, app giữ trong RAM và cảnh báo trước khi đóng trang.
Kết quả AI gốc lưu bền vững, tách khỏi project, tại `.runtime/studio/content-attempts/`.
Đọc lại ở **Kết quả đã lưu**; không cần gọi model thêm.

Nháp/revision/project khác snapshot của lần gọi thì Apply bị vô hiệu. Vẫn được xem/sửa
candidate; không tự ghép vào nháp mới. Nút **Bỏ bản chỉnh, lấy nháp hiện tại** cần xác nhận.

Mỗi project chỉ có một owner đang chạy/chưa rõ; timeout không chứng minh chưa dùng token.
**Kiểm tra lần chưa rõ** đọc lại kết quả/owner, không gửi lại. Chỉ yêu cầu mới có chủ ý
được nhận sau khi owner cũ đã chết rõ ràng; lịch sử UNKNOWN vẫn giữ. PID reuse/không probe
được owner giữ trạng thái chưa rõ. Không kill process hoặc tự xóa lịch sử/khóa.

Opus chỉ hiện cho lỗi kết nối Sonnet đủ điều kiện và cần bấm riêng, không tự fallback;
HTTP4xx/429 không chuyển model/account. Alias dự phòng `ag/claude-opus-4-6-thinking`;
native fallback chưa được nghiệm thu. Thinking yêu cầu trong body chưa là bằng chứng upstream.

## Token và giới hạn

Hiển thị actual model/input/output/cache khi provider trả; thiếu usage ghi chưa rõ, không0.
Không có bảng giá được xác minh thì không hiển thị USD giả. Token AI khác chi phí media local.
10lần/project,100toàn app; request32KiB/candidate64KiB/receipt16KiB/response1MiB;
60giây/6000outputtokens. Đủ giới hạn thì giữ lịch sử và từ chối lần mới, không tự dọn.

Connector metadata ở `content-connector.json`, fixedloopback20128; savedkey helper Jarvis
được kiểm hash bytes trước chạy, CurrentUserDPAPI chỉ vào env child. Không đưa key vào
browser/log/Git. Helper đổi hash thì dừng để operator kiểm trước cập nhật pin.
Không sửa `runtime-config.json` hoặc cache fingerprint của giọng.

Admission lease được xuất bản atomically có PID/start/nonce; deadowner được archive trước
nhận lần mới. Identity/lease/recovery không rõ thì giữ nguyên, không tự xóa cưỡng ép.
Interrupted recovery sau bước archive là trường hợp giữ khóa để operator kiểm; chưa có
nút dọn lịch sử/khóa. Không dùng lệnh xóa tùy ý để giải phóng app.

Xem [nghiệm thu](acceptance/video-p7-5.md), [review và dispositions](reviews/p7-5-code.md).
