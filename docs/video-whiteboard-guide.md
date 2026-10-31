# Bảng minh họa động M2

Mở app → chọn cảnh → **Bảng minh họa động**. Ba mẫu khởi đầu: Quy trình,
Đối chiếu, Nguyên nhân → kết quả. Mẫu chỉ thay bản chỉnh trong bảng; **Áp dụng bảng**
mới thay cảnh đang chọn. Các cảnh khác, giọng và nhạc giữ nguyên.

1. Chọn giấy sáng/bảng tối; sửa 2–6 thẻ, chữ và ô đặt thẻ.
2. Thêm tối đa12 hiệu ứng: Hiện thẻ, Gạch chân, Khoanh, Nhấn vùng, Mũi tên.
3. Chọn cụm lời và Đầu câu/Cuối câu cho mỗi hiệu ứng. Mỗi mốc chỉ một hiệu ứng.
   Mũi tên có thẻ bắt đầu và thẻ đến khác nhau; cả hai cần hiện trước mốc đó.
4. **Áp dụng bảng** → **Cập nhật preview** → mở bảng, bấm **Xem mốc trong preview**.
   Preview nháp dùng thời gian ước lượng, chưa có giọng; MP4 dùng thời lượng WAV đo thật.
5. **Lưu dự án**, rồi **Xuất video**. Khung dọc/ngang/vuông dùng cùng bộ vẽ bảng.

Chữ tối đa70 ký tự/thẻ và phải vừa3 dòng. Nếu preview báo `BOARD_LABEL_OVERFLOW:cảnh:thẻ`,
rút gọn chữ ở thẻ đó; bản chỉnh vẫn còn. Không cắt chữ âm thầm.
Nếu xóa câu đang có hiệu ứng, mở lại bảng và chọn mốc mới hoặc xóa hiệu ứng thiếu mốc.
Khi vừa thay số câu vừa sửa chữ, hệ thống giữ các câu còn khớp và yêu cầu nối lại mốc không rõ.

**Hoàn tác lần áp dụng** phục hồi cả bố cục trước đó. Nếu đang có bản chỉnh chưa Apply,
app hỏi trước khi bỏ. Đóng bảng giữ bản chỉnh; chuyển cảnh/dự án có xác nhận nếu cần.
Nếu nháp chính đã đổi, Apply tạm dừng để tránh ghi đè: chọn **Lấy lại từ nháp** sau khi
cân nhắc giữ/bỏ bản chỉnh. Chọn mẫu, sửa bảng và Apply không tự gọi Claude hay tạo media.

Bài mẫu: **Dự án → Mở brief đã có → m2-whiteboard-pilot.json → Mở bản sao**.
Đây là bài giải thích phương pháp dài50,6giây, dùng đủ5hiệu ứng; không phải video đăng kênh.
[Nghiệm thu](acceptance/video-m2-whiteboard-20261016.md),
[thiết kế](superpowers/specs/2026-10-16-video-m2-whiteboard-design.md).

## Lỗi mở app đã xử lý

Launcher cũ gọi `node src/editor-server.mjs`. App Windows cần entry tuyệt đối để đối chiếu
PID/cổng/root và vì thế báo PORT_BUSY dù đúng thư mục. `open-studio.ps1` và `start-studio.ps1`
nay truyền đường dẫn tuyệt đối có quote. Giữ kiểm tra process/root và mọi dữ liệu/job.
Đây là lỗi tương thích launcher, không phải thông báo host “blocked by policy”.

Nếu cổng20130 do phiên tương đối cũ chiếm: lưu việc đang làm, chờ job hoàn thành, đóng đúng
terminal cũ rồi mở `.exe` mới. Không cần thao tác tay nếu app mới đã mở bình thường;
không tắt tiến trình không rõ nguồn. Các lần khởi chạy bằng launcher mới đã kiểm thật với `.exe`.
