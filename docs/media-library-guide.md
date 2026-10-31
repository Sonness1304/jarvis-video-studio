# Thư viện media lớn

Mở **Jarvis Video Studio** bằng shortcut Desktop, chọn tab **Media → Mở thư viện lớn**.
Thư viện chung gồm ảnh/clip/nhạc đã nhập, clip AI đã đưa vào kho và ảnh AI gốc có receipt
VERIFIED. Không tự quét mọi thư mục trên máy. Ảnh AI có nhãn **Ảnh AI**, dùng trực tiếp khi
gắn cảnh; không cần nhập lại để tạo thêm một bản sao.

1. Tìm theo tên hoặc mã file; có thể gõ tiếng Việt không dấu.
2. Lọc Ảnh/Clip/Nhạc, “Đang dùng” hoặc “Chưa gắn” trong **nháp hiện tại**.
3. Sắp xếp theo thời gian thêm, dung lượng hoặc tên; lọc thêm nguồn, nhóm và tag.
4. Chọn một thẻ để xem ảnh, phát clip hoặc nghe nhạc bằng controls. Metadata có kích thước,
   thời lượng, dung lượng, ghi chú quyền/nguồn khai báo và thông tin file/hash.
5. Bấm **Gắn vào cảnh đang chọn** hoặc **Dùng làm nhạc nền**. Đây là thay đổi trong nháp;
   có thể Hoàn tác/Làm lại, rồi Lưu dự án khi hài lòng.
6. “Vị trí trong nháp” dẫn về cảnh có tham chiếu đúng file. Nếu cảnh có storyboard, bỏ chế độ
   nhiều shot trong bàn storyboard trước khi gắn media theo toàn cảnh; lỗi hiện trong thư viện.

7. Danh mục có **24 thẻ/trang**; tìm/lọc/sắp xếp áp dụng toàn danh mục trước khi phân trang.
8. Chọn file, nhập **Nhóm** và **Tag** rồi bấm **Lưu nhóm & tag**. Nhóm tối đa40 ký tự,
   tối đa10 tag/file, mỗi tag24 ký tự, ngăn bằng dấu phẩy. Nhãn gắn đúng mã file đang chọn;
   không tự áp dụng cho các bản trùng. Không dùng slash hoặc dấu phẩy bên trong một tag.
   Nhãn lưu riêng, không làm dự án thành bản mới. Bản nhập chưa lưu sẽ hỏi trước khi bỏ.

Escape hoặc nút × đóng và dừng preview; không tự lưu, xuất hoặc gọi AI. Làm mới tải lại catalog;
khi mất kết nối, danh mục đã tải và bản nháp vẫn giữ. Muốn thêm file mới, đóng thư viện rồi dùng
**Nhập media** của tab Media, điền ghi chú quyền sử dụng như trước.

Mặc định những file **cùng loại và cùng SHA256** được gộp thành một thẻ có badge “6 bản”.
Bật **Hiện từng bản trùng** để xem từng record, hoặc chọn mã trong danh sách bản cùng nội dung
ở khung chi tiết. Badge đang dùng tính cả các bản cùng thẻ; chi tiết vị trí/nhãn thuộc đúng bản
đang chọn. Ảnh AI gốc và PNG chuẩn hóa khác byte giữ riêng, có dòng liên hệ nguồn.

Số MiB tổng cộng trường `bytes` của mọi record trong catalog, kể cả các file trùng còn trên đĩa.
Đó là file media chuẩn hóa và ảnh AI gốc được đăng ký, không gồm original.bin, model, cache hoặc
toàn ổ C. Gộp thẻ không giải phóng dung lượng. API mới không cắt200 mục; giới hạn rõ10000 ứng viên,
vượt sẽ báo CATALOG_LIMIT. Sidebar gọn chỉ hiện tối đa24 thẻ; mở thư viện lớn để chuyển trang.
“Chưa gắn” không chứng minh file không còn cần trong dự án khác. Không tự xóa file trong đợt này.

Nếu báo **REVISION_CONFLICT**, phần vừa nhập vẫn còn. Sao chép nhãn cần giữ, bỏ nháp nhãn rồi
Làm mới để đọc bản do phiên khác lưu; đối chiếu trước khi nhập lại. Không tự ghi đè.
Nếu báo **MEDIA_LABELS_CORRUPT**, không tự xóa/reset. Giữ app, lưu bản sao thư mục
`.runtime/studio/media-labels/<id>/` và kiểm snapshot số lớn nhất cùng lỗi; chỉ phục hồi sau khi
đối chiếu được snapshot nguyên vẹn trước đó. Metadata tách khỏi project/receipt/media gốc.

[Nghiệm thu bản mở rộng](acceptance/media-catalog-v2.md), [Claude review](reviews/media-catalog-design.md)
và [fresh code review](reviews/media-catalog-code.md). [Bản đầu](acceptance/media-library.md) giữ lịch sử.
