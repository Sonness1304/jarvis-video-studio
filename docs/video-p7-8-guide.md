# P7.8 — Biên tập phụ đề và cách đọc

Mở Studio → tab **Video** bên phải → **Phụ đề & dấu ấn** → **Biên tập phụ đề**.
Chọn cụm lời kể ở cột trái; sửa chữ trên hình ở bên phải. Bỏ trống để dùng lời kể gốc.
Từ khóa nhấn: mỗi cụm một dòng, phải xuất hiện trong phụ đề; đây là nhấn tĩnh theo cụm,
không karaoke từng từ. Dùng phím Tab để di chuyển và Escape để đóng; có hỏi bỏ nếu đã sửa.

Năm kiểu: Nền hộp, Chữ gọn, Viền rõ, Nhấn từ và Dải phụ đề. Chọn cỡ20–44, vị trí và màu
theo nền video. Thẻ xem là phác thảo; **Cập nhật preview** kiểm đúng tỷ lệ dọc/ngang/vuông.
Cảnh báo tràn/chạm nội dung sẽ chỉ cụm cần sửa, không tự cắt hoặc thu chữ âm thầm.

Mở **Cách đọc riêng cho giọng AI** nếu muốn viết cách phát âm khác chữ hiển thị.
Ví dụ chữ “AI” có thể đọc “Ây ai”. **Áp dụng vào nháp** tạo một bước hoàn tác, không tự
lưu/tạo giọng. Lưu dự án trước khi xuất. **Khôi phục cụm này** bỏ tùy chỉnh của cụm đó.

Chỉ đổi phụ đề/kiểu/màu không tạo lại giọng. Đổi cách đọc tạo lại đúng cụm cần thay; mốc
thời gian sau đó đo lại từ WAV. Sửa lời kể có nghĩa sẽ bỏ phụ đề/cách đọc riêng của đúng cụm
và báo số cụm bị reset; sửa tương đương NFC/khoảng trắng giữ nguyên. Undo khôi phục cả nhóm.
Tắt chữ trên video vẫn có file SRT để dùng riêng. SRT giữ ngắt dòng, không chứa màu/font/nhấn từ.

[Nghiệm thu](acceptance/video-p7-8.md), [review](reviews/p7-8-code.md).
Giọng/phát âm và thẩm mỹ cần người dùng xem/nghe. Emoji có tests Unicode/grapheme, chưa
nghiệm thu fontemoji trong MP4. Trường hợp keyword overlap hiếm `banana`/`ban`/`ana` có thể
bỏ lượt nhấn sau; chữ vẫn giữ đầy đủ. Desktop là phase kế tiếp đã được duyệt riêng.
