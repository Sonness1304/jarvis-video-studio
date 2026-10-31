# Video Studio P5 — Dựng nhiều shot theo lời kể

Mở app tại http://127.0.0.1:20130. Từ PowerShell ở `.`, chạy:

```powershell
pwsh -NoProfile -File .\scripts\start-studio.ps1
```

Đọc [checkpoint](project-checkpoint.md) để biết revision và phần đã nghiệm thu. P5 tiếp nối [P4](video-p4-guide.md); giới hạn media, giọng và xuất nhiều bản của [P3](video-p3-guide.md) vẫn áp dụng.

## Tạo storyboard

1. Chọn một template phù hợp. Có thêm **Kiến thức bằng sơ đồ**, **Demo công cụ**, **Nhật ký câu chuyện**, nâng tổng số lên 11 template và giữ 5 phong cách độc lập.
2. Trong tab **Cảnh**, viết lời đọc thành nhiều dòng. Mỗi dòng là một cụm đọc và có thể là mốc bắt đầu shot.
3. Bấm **Biên tập storyboard** → **Tạo shot theo các cụm đọc**. Chỉnh tiêu đề, bố cục, chữ và danh sách cho từng shot. Bố cục sơ đồ, demo sản phẩm và trang câu chuyện có hình thức khác nhau; vẫn được chọn theme/màu riêng theo bài.
4. Đổi mốc bắt đầu bằng **Bắt đầu ở cụm**. Shot đầu bắt đầu ở cụm đầu; các mốc sau giữ thứ tự và không trùng. Tối đa 8 shot/cảnh, 40 shot/video. Các cụm chưa có shot tiếp tục dùng shot gần nhất trước đó.
5. Chọn **Dùng lại bố cục cảnh** để bỏ chế độ nhiều shot và sửa hình/bố cục gốc. Gắn ảnh/clip vào cảnh đang có storyboard sẽ bị từ chối trước khi thay dữ liệu. Nhạc nền vẫn dùng được. Media riêng từng shot và cắt/chia clip trực quan thuộc giai đoạn sau.
6. Khi xóa dòng lời đọc, shot gắn với dòng bị xóa cũng được bỏ và có thông báo. Undo/redo khôi phục cả lời đọc và storyboard. Nhân đôi cảnh cấp ID mới cho cụm/shot, giữ liên kết.
7. **Cập nhật preview** để xem nháp. Hàng **Shot** trên timeline cho biết thời lượng và cho bấm để tua. Bản nháp ước lượng, chưa có giọng. Sau xuất, thời lượng shot/cụm/phụ đề theo WAV đo thật; không tự kéo giãn giọng.

Đây là đổi shot theo cụm lời đọc trong một cảnh, chưa phải timeline nhiều lớp/keyframe hay gắn một video riêng vào mỗi shot. Các mẫu có chữ gợi ý cần được sửa theo thông tin bạn đã kiểm chứng.

## Kiểm tra khung hình

**Vùng an toàn** bật lớp tham khảo ngay trên preview hoặc MP4 trong app. Nó không thay bố cục và không xuất vào video. Khung dọc chừa 8% trái, 16% phải, 10% trên và 22% dưới; tỷ lệ khác dùng khung 8% mỗi cạnh. Đây là profile tham khảo ngày 14/10/2026, không bảo đảm UI của mọi nền tảng/thiết bị.

Sau khi font tải xong, preview gửi cảnh báo chữ vượt khung hoặc tiêu đề giao với hình. Đây là số đo bố cục, không phải điểm chất lượng chuyên nghiệp. Nháp mới/sửa nội dung cần cập nhật preview lại; bản xuất vẫn phải xem/nghe riêng. Cảnh báo chỉ áp dụng đúng preview hiện tại, không nhận kết quả cũ để đánh giá bản đang sửa.

App server cần khởi động lại sau cập nhật module server. Nếu bạn đang sửa nháp chưa lưu, chép/lưu phần chỉnh sửa trước khi tải lại tab. Trạng thái nạp module mới được ghi riêng trong nghiệm thu, không suy từ việc mở trang.

## Preset thương hiệu

Trong **Video → Preset thương hiệu**:

- Đặt tên rồi **Lưu thành preset mới** để lưu màu nhấn, theme, tên kênh/dòng phụ/chân video và cấu hình phụ đề hiện tại.
- Chọn preset và **Áp dụng vào nháp**. Thao tác có undo/redo, không thay lời đọc, media, nhạc hay giọng của dự án. Lưu dự án trước khi xuất.
- Mỗi lần lưu tạo ID riêng; các preset trùng tên vẫn phân biệt bằng mã. Tối đa 50 preset, không tự ghi đè hay xóa preset cũ.
- Bản xuất/hàng đợi dùng giá trị đã chụp trong revision của dự án, không đọc lại preset để thay đổi video đã xếp hàng.

Bản đầu dùng font Be Vietnam Pro đã có giấy phép; chưa có upload logo/custom font hoặc bộ nhận diện đầy đủ. Preset không bắt buộc dùng cùng một phong cách cho mọi chủ đề.

## Bài thử và bước tiếp

Các bài thử tự viết, video/ảnh/bằng chứng ở `outputs/p5-pilot`; MP4 gốc trong các attempt được dẫn ở [nghiệm thu](acceptance/video-p5.md). Ba bài ngắn là canary kỹ thuật, không phải bài dài hay mẫu đã được người dùng duyệt phát âm/thẩm mỹ.

Sau P5, hướng P6 là cắt/chia clip trực quan, snap theo mốc lời đọc, sửa nhịp và proxy review. Cần chốt quy tắc timing, subtitle và undo trước khi triển khai. Nhớ nhân vật/phim dài và Trung–Việt vẫn để riêng; không tự tải thêm model hoặc đăng nội dung lên mạng.
