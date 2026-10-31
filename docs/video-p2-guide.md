# Video Studio P2 — mở xưởng và làm video

Tài liệu nền P2/historical. [P3 guide](video-p3-guide.md) cập nhật nhập media, nhạc, tỷ lệ,
phụ đề/branding và batch; [checkpoint](project-checkpoint.md) là state hiện hành duy nhất.

User ngày14/10 giao app đa dạng; V1 máy móc là một lựa chọn. 8template/5theme, local/free,
25preset voices; video720×1280/30fps/≤180s. Nhớ nhân vật/phim dài, Trung→Việt hoãn.

## Mở app

PowerShell terminal, không phải promptchat:

```powershell
Set-Location -LiteralPath '.'
pwsh -NoProfile -File .\scripts\start-studio.ps1
```

Giữ terminal mở. Truy cập http://127.0.0.1:20130 bằng trình duyệt thường, không cần Codex.
Nếu cổng đã phục vụ đúng VideoStudio, dùng cửa sổ đó; không killoccupant khác.
Đóng/tắt máy dừng app; launcher này không cài Startup.9router/Panel20128–20129 riêng vẫn giữ nguyên.
GPUComfyUI không autoload khi mở app; vẫn dùng CLI/guide GPU nếu cần sinh ảnh/clip.

## Làm một bài

1. Bấm + trong Dự án; chọn template, tên/phong cách/giọng rồi tạo. Nội dung mẫu cần bạn sửa.
2. Chọn từng cảnh; đổi bố cục, tiêu đề, lời kể từng dòng và chữ/danh sách/con số trên hình.
   Slideshow chọn Ảnhlocal đã có nativeSDXLreceipt; uploadảnh/video bên ngoài chưa thuộc P2.
3. Nghe thử giọng; tác vụ trả WAV và nút Nghe giọng. Mẫu này không đo narration của cảnh.
4. Kéo cảnh đổi thứ tự hoặc dùng↑↓; +thêm/⧉nhânđôi/−bỏcảnh, undo/redo. Giữ hình thêm0–10s
   sau lời đọc. Giọng/subtitles không bị kéo giãn. Lưu dự án explicit; có revision cho mỗi bản.
5. Cập nhậtpreview, play/scrub/frame-step. Nháp không cógiọng, durationước lượng từ sốchữ.
6. Xuấtvideo lưu snapshot và chạy CLI tuần tự. Trong Bảnxuất&tácvụ, Xembảnxuất dùngMP4 thật,
   timelineđoWAV; MP4/SRT/Bằngchứng tải về. Sau sửa trở lại nháp; exportcũ giữrevision riêng.

Existingbriefs có thể Mởbriefđãcó thànhbản riêng, không sửa briefnguồn. Server chỉ chạy typed
voice/export CLI, không shelltựdo. Projects/revisions/jobs tại.runtime/studio, outputs/caches ngoàiGit.
Hai tab save cùngrevision trảREVISION_CONFLICT, nháp giữ nguyên; tải lại để lấy bản mới.

## Khi tác vụ bị gián đoạn

RUNNING là đang chạy; UNKNOWN sau restart/30mdeadline không chứng minhfailed. App không tựretry
hoặc killprocess. Kiểm tra đúngjoblog và CPU/GPUlease theo README; giữ outputsfailed.
Readbackreconcile chỉ đọc kếtquả cuối/hash đã có, không chạy lại inference/render. Chưa có
UIrecovery đầyđủ: coordinator dùng JobManager.reconcile với đúngjobID; nếu thiếu result,
giữUNKNOWN và điều tra lifecycle. Không xóa.runtime để vượt lease.

## Khả năng và bước tiếp

Chữđộng, list, quote, compare, metric, sảnphẩm và PNGpanzoom thực; V1visuals còn chọn được.
Con số/bars của starter là minh họa, không dữ liệu trực tiếp hay fact đã kiểm. Cần nhập facts đúng.
P2 là appscene-editor bản đầu; chưa CapCutmulti-layer, arbitrarytrim/split, per-scenevoice,
uploadedmusic/video, nhiều tỷ lệ, batchqueue, GPUclipimport hoặc autosave.
Thứ tự đề xuất P3: importmedia/licensereceipts→musicducking/waveform→ratio/captionlayout→
timeline trim/split/transition→batchtemplates. Characters riêng cho phim dài, dubbing sau.
LocalmediaAPIfee0 khác điện/time/storage và Claude reviewtokens; không claimquota/Thinkingverified.

Nghiệm thu/revision/giới hạn theo [checkpoint](project-checkpoint.md),
[spec](superpowers/specs/2026-10-14-video-p2.md), [plan](superpowers/plans/video-p2/plan.md),
[research](research/p2-editor-2026-10-14.md), [review](reviews/p2-dispositions.md).
