# Video Studio P3 — bàn dựng media

Mở app như P2: PowerShell tại `.`, chạy
`pwsh -NoProfile -File scripts/start-studio.ps1`, giữ terminal mở rồi vào
[Video Studio](http://127.0.0.1:20130/). Không cần Codex hoặc 9router để dựng media local.
Tắt máy sẽ dừng app; chưa cài tự mở cùng Windows cho consumer này.

## Quy trình một bài

1. Chọn template theo chủ đề. Có 8 cấu trúc nội dung và 5 phong cách; V1 máy móc chỉ là một lựa chọn.
   Sửa lời đọc, tiêu đề, các ý và dữ liệu. Nội dung starter không thay nghiên cứu facts.
2. Sang tab **Media**, điền ghi chú quyền sử dụng rồi nhập ảnh, clip hoặc nhạc từ máy.
   PNG/JPEG/WebP/MP4/WAV/MP3; tối đa 64 MiB/file, ảnh16Mp, clip60s, nhạc180s.
   Server chuẩn hóa và kiểm decode/hash. Bản gốc, log và lần nhập lỗi được giữ.
   Ghi chú là khai báo của người nhập, không xác minh giấy phép hoặc quyền phân phối.
3. Chọn cảnh rồi **Gắn vào cảnh**. Clip có điểm vào/ra theo giây, lấp khung/giữ toàn hình.
   Độ dài cảnh theo giọng đo thật: cắt hình hoặc giữ frame cuối; bỏ âm thanh clip gốc.
4. Chọn **Dùng làm nhạc nền**; điều chỉnh âm lượng−36..0dB và hạ nhạc khi có lời−30..0dB.
   Nhạc lặp/fade, duck theo RMS PCM giọng, rồi master theo loudnorm cố định.
   Sửa nhạc/hình không làm mất cache giọng hợp lệ. Mỗi video hiện dùng một preset giọng chung.
5. Chọn dọc720×1280, ngang1280×720 hoặc vuông1080×1080/30fps; chuyển cảnh cắt/mờ/trượt.
   Phụ đề có bật/tắt, kiểu hộp/chữ gọn, cỡ20–44; SRT luôn có. Tên kênh/dòng phụ/chân video sửa riêng.
6. **Cập nhật preview** để duyệt nháp. Nháp không có tiếng, thời gian ước lượng; seek clip tôn trọng
   điểm vào/ra. Sau **Xuất video**, chọn **Xem bản xuất** để nghe/xem MP4 thật và waveform RMS đã đo.
   Waveform là biên độ giọng theo từng cụm, không phổ tần, không có sóng giả cho bản nháp.
7. **Lưu dự án** có revision; undo/redo tối đa50thao tác. Sau sửa, viewer trở lại nháp;
   bản xuất cũ vẫn gắn với revision của nó. Hai tab sửa cùng revision báo xung đột và giữ nháp.

## Xuất nhiều bản

**Xuất nhiều bản** → chọn tỷ lệ và phong cách, tổng1–12 tổ hợp. **Lưu & bắt đầu hàng đợi**
chụp cùng một bản lưu cho toàn bộ tổ hợp; chỉnh nháp sau đó không đổi các bản đang dựng.
Mỗi lần chỉ một job nặng; CPU/GPU lease vẫn áp dụng. MP4/SRT/receipt ở từng job,
thẻ phiên bản có link MP4; job tạo giọng cũng nằm trong danh sách tác vụ.

Lỗi một bản sẽ dừng hàng đợi. **Tiếp tục bản còn lại** bỏ qua bản đã lỗi/đã xong, chỉ dựng bản chờ;
không tự thử lại bản lỗi. Khởi động lại app đưa hàng đợi về tạm dừng, job đang chạy về UNKNOWN.
**Kiểm tra kết quả** chỉ đọc kết quả/hash đã có. Nếu còn UNKNOWN, kiểm joblog/process/lease theo
README; không xóa runtime hoặc killprocess để chạy đè. Chỉ resume sau khi trạng thái rõ.

Thư viện và lịch sử tại `.runtime/studio`; media/cache tại `outputs`/`.cache` ngoài Git.
Giới hạn JSON128KiB riêng với upload64MiB. Không download URL từ ô nhập file, không chạy lệnh tự do.
Không auto-clean hoặc auto-publish. [Checkpoint](project-checkpoint.md) giữ bằng chứng/revision hiện hành.

## Hướng P4 để cân nhắc

Ưu tiên chất lượng trước thêm model: storyboard nhiều shot trong mỗi cảnh; safe-area dọc cho TikTok/
Shorts; bộ layout theo kể chuyện, tutorial màn hình, sản phẩm, tin/kiến thức; library preset thương hiệu.
Tiếp đó: trim/split trực quan trên timeline, sửa nhịp/crossfade âm nhạc, duyệt bản proxy và xuất bản chọn.
Đo thời gian dựng/tỷ lệ cache/quality rubric trên bài thật trước nâng độ phân giải hoặc mở batch lớn.
Đây là hướng đề xuất, chưa tự triển khai P4. Nhớ nhân vật thuộc dự án phim dài riêng;
Trung→Việt và tự đăng mạng xã hội vẫn hoãn. Media API fee0 khác điện, thời gian và token review.
