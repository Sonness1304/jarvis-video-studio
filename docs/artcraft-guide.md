# Artcraft trong Jarvis Video Studio

Bản A1 là luồng chuẩn bị cảnh và nhận media về thư viện. Không cần cài thêm Artcraft desktop.
[Web Artcraft](https://app.getartcraft.com/create-video), [tài liệu nghiệm thu](acceptance/artcraft-a1-20261019.md).

1. Mở dự án, chọn cảnh muốn làm hình/clip. Vào **Media → Chuẩn bị cảnh với Artcraft**.
2. Sửa hình/chuyển động, camera, phong cách và thời lượng mục tiêu. Chọn reference nếu muốn
   ghi tên/ID/SHA vào brief. Reference mặc định tắt; brief không chứa file hoặc đường dẫn máy.
3. **Sao chép brief**, **Tải TXT** hoặc **Tải JSON**, rồi **Mở Artcraft**. Bạn tự đăng nhập,
   chọn model, dán prompt, chọn reference và quyết định tạo media trong Artcraft.
4. Xuất ảnh/MP4 về máy. Trong dialog Jarvis, điền ghi chú quyền sử dụng rồi **Nhập kết quả Artcraft**.
5. **Xem thư viện media**, lọc nhóm **Artcraft**, preview và **Gắn vào cảnh đang chọn**.
   Gắn cảnh có thể hoàn tác như thao tác Media khác. Lưu, cập nhật preview, xuất MP4/SRT.

Brief lấy nội dung cảnh lúc mở dialog. Nếu cảnh/dự án thay đổi, banner báo snapshot cũ;
**Lấy cảnh đang chọn** chỉ thay nội dung khi bạn đồng ý bỏ phần chưa sao chép/tải.
Đóng dialog có phần đang chỉnh cũng hỏi trước. Nếu clipboard bị trình duyệt từ chối, dùng Tải TXT.

Ảnh PNG/JPEG/WebP, clip MP4; tối đa64MiB/file và60giây/clip. Nhập từng shot cho video dài.
Âm thanh clip gốc được bỏ; giọng/sub/nhạc Jarvis được giữ riêng. Không roundtrip project3D.
Nguồn/quyền là khai báo của bạn. Tag Artcraft không chứng minh model hoặc giấy phép của provider.
Nếu nhóm/tag lưu lỗi, file nhập vẫn giữ; mở Media và làm mới, không cần nhập trùng.

Jarvis không gửi prompt/media ngầm, không tự gọi generation API hoặc tính phí. Thao tác tạo media
trên Artcraft phụ thuộc account/model/credits; app miễn phí không đồng nghĩa generation miễn phí.
Ảnh Codex và các luồng dựng hiện có vẫn dùng như trước. Không tải model/ComfyUI cho A1.

Nghiệm thu local đã dùng clip QA tổng hợp có audio để kiểm đường nhập→gắn→lưu/mở lại→MP4.
Chưa kiểm bằng output từ tài khoản Artcraft thật; cần bạn đăng nhập Artcraft khi muốn thử bước đó.
