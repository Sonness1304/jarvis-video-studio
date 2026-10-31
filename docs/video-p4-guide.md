# P4 — Bàn dựng theo công việc

Mở app http://127.0.0.1:20130 bằng `pwsh -NoProfile -File scripts/start-studio.ps1` tại ..

- **Dự án**: tìm tên có/không dấu hoặc mã; tạo từ template/mở brief. Lịch sử vẫn giữ nguyên.
- **Cảnh**: chọn, thêm, đổi thứ tự, nhân đôi; chỉnh nội dung ngay bên phải.
- **Media**: nhập ảnh/clip/nhạc, tìm tên hoặc ID, chọn loại và gắn vào cảnh. Các bản cùng tên là các asset riêng, không tự ghi đè.
- Inspector **Cảnh**: lời kể/bố cục/giữhình/trimclip; **Âm thanh**: preset giọng, nghe thử, nhạcgain/duck; **Video**: tỷlệ/theme/màu/chuyểncảnh/phụđề/branding.
- Mũi tên trái/phải, Home/End khi focus tab để chuyển; các ô chỉnh được giữ khi đổi tab. Undo/redo và lưu vẫn như P3.
- Badge vàng **Nháp** là thời gian ước lượng/chưa có giọng. Badge xanh **Bản xuất** là MP4 đo thật; ghi title/revision và khácnháp nếu có. Nút phát/tạm dừng theo player thật.
- **Kết quả sản xuất** lọc dự án hiện tại; bật toàn bộ lịch sử để xem cũ. RUNNING/UNKNOWN toàn app và batch chưa kết thúc luôn hiện. Giọng nghe thử dùng chung được lọc theo preset hiện tại. Lọc chỉ ảnh hưởng hiển thị, không mở quyền chạy tác vụ chồng nhau.
- Lỗi có hướng dẫn và mục **Chi tiết lỗi**; UNKNOWN phải kiểm tra kết quả trước, không xóa lease/process. Không tự chạy lại hay đổi tài khoản.

## Quay và nghiệm thu

outputs/app-demo-20261014-p4/app-tour-complete.mp4 là bản quay thao tác thật103.9s từ P3. app-tour-p4.mp4 là lượt sau nâng cấp (xem nghiệm thu để biết đãverify). Đây là screenrecord không thu tiếng máy; bản video xuất thật trong các attempt có giọng/nhạc riêng.
[Nhận định và review](reviews/p4-dispositions.md), [spec](superpowers/specs/2026-10-14-video-p4.md), [plan](superpowers/plans/video-p4/plan.md), [nghiệm thu](acceptance/video-p4.md). Kết quả do checkpoint hiện hành quyết định.

## Hướng phát triển

P5: storyboard nhiều shot, layout theo từng chủ đề, vùng an toàn dọc có thể bật/tắt, preset thương hiệu và rubric chất lượng từ bài thực tế. Đo nhịp, khả năng đọc và thời gian dựng trước thêm model. P6: trim/split trực quan, proxyreview, per-scenevoice và audioediting khi contract undo/timing đã rõ. OTIO có thể dùng trao đổi timeline với phần mềm ngoài; không là renderer và không chứa media.
Nguồn https://opentimelineio.readthedocs.io/en/latest/ và tabs https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ đã đốichiếu14/10/2026. Đây là roadmap, chưa tự thực thi P5/P6; nhớ nhân vật và Trung→Việt vẫn tách riêng.
