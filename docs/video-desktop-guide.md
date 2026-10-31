# Jarvis Video Studio — ứng dụng Windows

Bản đầu dùng trên máy hiện tại, dùng lại model, Python, Node và dữ liệu tại
`.`. Mở bằng shortcut **Jarvis Video Studio** ngoài Desktop,
hoặc [Jarvis Video Studio.exe](../desktop-dist/VideoStudio/Jarvis%20Video%20Studio.exe).
Không cần giữ cửa sổ PowerShell mở.

## Cách dùng

Thư viện mới: **Media → Mở thư viện lớn** để xem ảnh/clip/nhạc và thông tin file,
lọc theo nháp, gắn vào cảnh/nhạc; xem [guide media](media-library-guide.md).

1. Mở app, chọn dự án có sẵn hoặc bấm **+** để chọn template theo chủ đề.
2. Chỉnh cảnh, giọng, nội dung và timeline; bấm **Lưu dự án**.
3. Trong **Video → Phụ đề & dấu ấn → Biên tập phụ đề**, chọn một trong năm kiểu,
   sửa chữ, từ khóa hoặc cách đọc. **Áp dụng vào nháp**, rồi lưu dự án.
4. **Cập nhật preview** để kiểm tra bố cục. Thời gian nháp là ước lượng; xuất video
   mới có thời gian giọng thật và waveform. **Xuất video** dùng bộ xử lý local.
5. Ở **Bản xuất & tác vụ**, chọn **Xem bản xuất**, **MP4** hoặc **SRT**.
   App mở hộp thoại Windows để bạn chọn chỗ lưu; file gốc vẫn nằm trong `outputs`.

Đóng cửa sổ giữ backend và job đang dựng. Mở app lại để xem cùng job; không bấm Xuất
lại chỉ vì cửa sổ vừa đóng. App hỏi trước nếu còn nháp chưa lưu hoặc bảng chưa Apply.
**Quay lại để lưu** giữ chữ và đưa bạn về app; bạn tự áp dụng/lưu rồi đóng.

Menu **Studio → Mở lại kết nối** kết nối lại và làm mới phiên trong trang hiện tại,
giữ nháp/history/bảng đang sửa; không tự chạy lại save, export hoặc Claude.
Nếu backend lỗi, kiểm tra thông báo và log `.runtime/studio/launcher` trước khi thử lại.
Ca backend dừng → reconnect giữ nháp, làm mới CSRF và lưu lại đã kiểm thật ngày15/10;
không tự chạy lại job cũ. Xem acceptance để biết đúng revision và phạm vi pilot.

**Studio → Thoát hoàn toàn khi rảnh** chỉ bật khi chính cửa sổ đó đã khởi động backend.
Nếu app dùng lại backend của phiên khác, nút này bị tắt. Backend từ chối thoát khi
có job, mutation, lease hoặc trạng thái chưa xác định. Không dùng nút này thay cho
kiểm tra job UNKNOWN. Đóng cửa sổ thông thường vẫn được và không giết job.

## Giữ dữ liệu và bộ cài

Giữ nguyên **toàn bộ** thư mục `desktop-dist\VideoStudio`, gồm exe, DLL, manifest và
licenses. Không kéo riêng exe sang chỗ khác; tạo thêm shortcut nếu cần.
Không đổi vị trí root/model đang dùng. Đây là app phụ thuộc runtime trên máy này,
chưa phải installer dùng trên máy khác, chưa có cập nhật tự động hay codesigning.
App dùng WebView2 profile riêng trong `%LOCALAPPDATA%\JarvisVideoStudio`, không dùng
profile/mật khẩu Chrome. Không cần quyền admin hay đổi cấu hình bảo mật Windows.

Giọng local và dựng video không gọi API media trả phí. Bàn nội dung Claude vẫn dùng
gateway và usage của yêu cầu do bạn chủ động bấm; mở app không gọi inference.

## Build lại khi phát triển

Từ PowerShell tại root consumer, sau khi source đã commit và sạch:

```powershell
pwsh -NoProfile -File .\scripts\build-desktop.ps1
```

SDK pin `10.0.402`, WebView2 SDK pin `1.0.4258.31`; restore dùng lock hiện có,
packages/cache trong consumer. Không tự cài runtime toàn máy. Nếu thiếu runtime/root,
app giữ dữ liệu và hiện hộp thoại hướng dẫn; cổng bị phiên khác chiếm cũng hiện rõ.
Manifest/build receipt ghi root, source, SHA256/size và
dependency hashes. Xem [nghiệm thu](acceptance/video-desktop.md) và
[review đã xử lý](reviews/video-desktop-code.md).

`blocked by policy` của tool Codex là lỗi khác với DESKTOP_BUSY/UNKNOWN/PORT_BUSY trong
app. [Chẩn đoán15/10](diagnostics/desktop-policy-2026-10-15.md) ghi call bị chặn trước
PowerShell và các ca đã kiểm; hiện không cần tự mở terminal để dùng exe.

Tạo thêm shortcut (không ghi đè shortcut cũ):

```powershell
pwsh -NoProfile -File .\scripts\create-desktop-shortcut.ps1
```
