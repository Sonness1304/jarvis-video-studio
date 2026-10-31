# Creator Pack và Motion Lab

Ba pilot đã có trong app Windows: **QR bị che, sao vẫn đọc?**, **Ống hút không gãy trong nước**,
**Nén ZIP không làm mất dữ liệu?**. Vào tab **Dự án**, tìm `motion-lab`; sửa lời, màu, giọng,
phụ đề như dự án thường. Muốn giữ bản mẫu, dùng **Mở brief đã có** để nhập lại bằng ID mới.
Motion Lab là ba hình cơ chế typed dùng chung preview/export, không thêm model sinh video.

## Xem và lấy bài

| Pilot | Video | Phụ đề | Cover | Nội dung đăng |
| --- | --- | --- | --- | --- |
| QR ·36,27s | [MP4](../outputs/creator-packs/motion-lab-qr-bac01b14/video.mp4) | [SRT](../outputs/creator-packs/motion-lab-qr-bac01b14/captions.srt) | [PNG](../outputs/creator-packs/motion-lab-qr-bac01b14/cover.png) | [Copy](../outputs/creator-packs/motion-lab-qr-bac01b14/posting-copy.md) |
| Nước ·27,73s | [MP4](../outputs/creator-packs/motion-lab-water-adaffb9a/video.mp4) | [SRT](../outputs/creator-packs/motion-lab-water-adaffb9a/captions.srt) | [PNG](../outputs/creator-packs/motion-lab-water-adaffb9a/cover.png) | [Copy](../outputs/creator-packs/motion-lab-water-adaffb9a/posting-copy.md) |
| ZIP ·31,40s | [MP4](../outputs/creator-packs/motion-lab-zip-426941f3/video.mp4) | [SRT](../outputs/creator-packs/motion-lab-zip-426941f3/captions.srt) | [PNG](../outputs/creator-packs/motion-lab-zip-426941f3/cover.png) | [Copy](../outputs/creator-packs/motion-lab-zip-426941f3/posting-copy.md) |

Mỗi thư mục chứa manifest nguồn/quyền, brief/timeline/receipt, liên hệ project revision/phrase,
hash MP4/SRT/cover/copy và proof. QR có thêm5PNG dùng để decode. `manifest.sha256` kiểm phát hiện
file bị thay/hỏng; đây là checksum không ký số. Trạng thái luôn **DRAFT**, chưa đăng lên nền tảng.
Hai bài ngắn hơn35s để giữ một giải thích gọn, không kéo dài bằng nội dung lặp; nằm trong khoảng
20–75s linh hoạt của spec. 720×1280/30fps H264/AAC, giọng Hải Đăng local, không stock/video tải lại.

## Chỉnh và tái sử dụng

- Mỗi cảnh `visual: motion-lab` có `lab.kind` và `lab.stage` được validator kiểm chặt.
  QR cần matrix thật; nước/ZIP dùng geometry/data cố định. Đổi stage ở brief JSON rồi import bằng ID mới.
- Các stage QR: `clean`, `small`, `large`, `guides`; nước: `straw`, `rays`, `apparent`;
  ZIP: `repeat`, `reference`, `restore`, `limits`. Đây là phạm vi bản đầu, chưa editor mô phỏng tổng quát.
- Bàn nội dung giữ cảnh có cơ chế khi chưa tick cho phép sửa/thay. Khi cho phép, có thể sửa lời
  trong bố cục **Motion Lab hiện tại**, hoặc chọn bố cục khác. Apply/Undo giữ bản lưu gốc cho đến Lưu.
- Gắn ảnh/clip thay cảnh sẽ bỏ metadata cơ chế cũ; Undo khôi phục. Storyboard nhiều shot chỉ dùng
  sau khi chọn bố cục chữ. Không sinh ảnh/clip hoặc gọi Claude tự động khi chỉ mở dự án.
- Sửa hình giữ cache giọng; sửa lời đổi cache đúng phrase theo toàn bộ voice/runtime settings đã pin.
  Preview nháp vẫn ước lượng; MP4/SRT dùng thời lượng WAV đo thật.

## Terminal PowerShell tại Jarvis-Video

Kiểm tra một Pack đã giao:

```powershell
node scripts/creator-pack.mjs verify outputs/creator-packs/motion-lab-qr-bac01b14
```

Quy trình cho bản sửa: lưu brief với ID riêng → build → QA → tạo Pack với metadata đúng project/revision.
Không chép nguyên placeholder dưới đây làm lệnh thật; lấy OUTPUT_FOLDER/QA_JSON từ receipt lần chạy.

```text
node src/cli.mjs build BRIEF_JSON
node src/cli.mjs qa OUTPUT_FOLDER
node scripts/motion-lab-proof.mjs OUTPUT_FOLDER
node scripts/creator-pack.mjs OUTPUT_FOLDER METADATA_JSON QA_JSON
```

Pack yêu cầu receipt mới có `renderInputs` cho normalized brief/timeline/SRT. Pack cũ không có pins
phải dựng lại bằng luồng mới; không tự sửa receipt để nhận đã kiểm. Metadata mẫu ở
`briefs/creator-packs/`, lấy đúng revision từ project store. Mỗi lần Pack tạo thư mục riêng, không ghi đè.
Proof QR hiện dành cho payload `JARVIS MOTION LAB` của pilot; đổi payload cần cập nhật kiểm chứng
riêng, không dùng kết quả decode cũ để chứng minh một mã khác.

QR generator/decoder ở `.tools/motion-lab`: `qrcode1.5.4` MIT và `jsqr1.4.0` Apache2.0.
Lock đã giữ tại `tooling/motion-lab/`; `pwsh -NoProfile -File scripts/setup-motion-lab.ps1`
khôi phục môi trường tool này bằng npmci ignore-scripts. Không đổi package/model/runtime giọng.
`motion-lab-pilots.mjs` chỉ seed lần đầu, sẽ từ chối project đã tồn tại; không dùng lại để ghi đè bài đang sửa.

[Nghiệm thu](acceptance/creator-pack-motion-lab.md), [Claude và phản biện](reviews/creator-pack-motion-lab.md).
Phát âm/nghe toàn phần còn cần đánh giá bằng người; đo loudness/decoder không thay kiểm nghe.
