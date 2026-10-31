# P6 — Cắt clip và chỉnh nhịp kể

## Mở app
Trong File Explorer tại `.`, bấm đúp **Open-Video-Studio.cmd**. Launcher mở app chạy nền và trình duyệt ở http://127.0.0.1:20130; không cần giữ cửa sổ terminal. Nếu app đang phục vụ đúng cổng, launcher dùng lại phiên hiện tại, không chạy thêm hoặc đóng process khác. Log riêng từng lần mở tại `.runtime/studio/launcher/`, `last-launch.json` giữ PID và đường dẫn log. Launcher không tự inference, mở Startup hay xuất video.

Lệnh terminal thay thế: `pwsh -NoProfile -File scripts/open-studio.ps1`. Để chỉ xem trạng thái, không mở app: thêm `-Status -NoBrowser`. Launcher console cũ `scripts/start-studio.ps1` vẫn được giữ; đóng cửa sổ đó sẽ dừng phiên chạy gắn với nó. Khởi động lại Windows cũng dừng process nền, cần bấm shortcut lại.

## Cắt đoạn hình nguồn
Nhập clip ở Media, ghi nguồn/quyền sử dụng rồi gắn vào một cảnh. Trong inspector **Cảnh**, bấm **Mở bàn cắt clip**. Video xanh lá là file nguồn, có thời gian riêng với timeline dự án xanh dương.

- Kéo Con trỏ nguồn hoặc dùng điều khiển video để xem; nút ±1 frame dịch1/30giây.
- Chọn Điểm vào/Điểm ra bằng hai thanh kéo, hoặc lấy vị trí con trỏ. Điểm ra không bao gồm frame ngay sau nó; nút lấy điểm ra giữ cả frame con trỏ hiện tại.
- **Áp dụng điểm cắt** tạo một lần chỉnh sửa có undo. **Hủy**, nút × và Escape giữ nguyên dự án. Không chỉnh file gốc, không lấy tiếng gốc hoặc kéo giãn giọng đọc.
- Nếu nguồn ngắn hơn cảnh, renderer giữ frame cuối. Nếu cảnh/bản lưu bị đổi trong lúc mở bàn cắt, app yêu cầu mở lại; điểm cắt nháp chưa được áp dụng.

Giới hạn nhập clip60giây/64MiB của P3 vẫn áp dụng. Các điểm chọn được làm tròn theo30fps của media đã chuẩn hóa. Media mỗi shot, nhiều layer hoặc crossfade audio chưa có.

## Snap và chia cảnh
**Snap lời đọc** hút con trỏ dự án vào mốc bắt đầu cụm khi đủ gần; các dấu số dưới timeline và nút ‹/› giúp tua theo cụm. Nháp ghi thời gian ước lượng; bản xuất dùng WAV đo thật. Snap lời đọc không tác động con trỏ video nguồn trong bàn cắt.

Chọn cảnh có ít nhất hai dòng lời đọc, cập nhật preview. Chọn **Mốc chia cảnh**, hoặc **Lấy mốc gần con trỏ**, kiểm tra đoạn chữ được báo rồi bấm **Chia cảnh**. App chia trước cụm đã chọn; không chia giữa một từ. Hai cảnh giữ nguyên mọi cụm/ID/thứ tự, có thể undo/redo một lần. Storyboard kế thừa hình đang dùng ở mốc mới, giữ anchors; ảnh/clip vẫn cùng source/path/hash. Với clip, điểm ra bên trái bằng điểm vào bên phải. Nếu mốc đã nằm ở đoạn giữ frame cuối, app từ chối chia nguồn ở đó.

Chia thành hai scene thêm0,42giây nghỉ theo renderer hiện tại. Giữ hình cuối cảnh cũ được chuyển sang cảnh phải; tổng thời lượng và SRT sẽ được đo lại khi xuất. Giọng không bị stretch, lời không mất hay nhân đôi. Giới hạn20cảnh/40shot vẫn giữ; thao tác vượt giới hạn bị từ chối.

Muốn chỉnh trên bản xuất đo thật, phải mở video đúng project/revision đã lưu và nháp sạch. Bản xuất lịch sử hoặc của dự án khác chỉ xem/tua: cập nhật preview nháp hiện tại để sửa. Không dùng media trung gian của bản xuất thay source clip khi tính điểm cắt.

## Giữ nhịp hình
Thanh **Giữ hình cuối cảnh** trên timeline thêm0–10giây sau lời đọc, không đổi tốc độ giọng/phụ đề. Kéo để xem số, thả để tạo một undo. Chọn cảnh khác để chỉnh nhịp riêng. Preview lại sau thay đổi và xem/nghe MP4 cuối.

## Bằng chứng và phần còn lại
Đọc [checkpoint](project-checkpoint.md), [plan](superpowers/plans/video-p6/plan.md) và [review](reviews/p6-dispositions.md) để biết ca nào đã đạt. Chưa lấy tests/model review thay chất lượng do người dùng xem/nghe duyệt. Proxy file riêng hoãn vì clip normalized đang phát trực tiếp; nếu có đo seek chậm sẽ mở phase riêng. Nhớ nhân vật và dịch Trung–Việt vẫn hoãn.
