# P7.1 — AI Studio trong Video Studio

Mở app nhưP6. Bấm **AI Studio** cạnh Cập nhật preview để mở bàn tạoảnh.

1. Mở dựán và chọn cảnh. AI Studio ghi rõ cảnhđích; bấm Chọn lại cảnh đang mở khi muốn đổi.
2. Viết prompt cho hình. Nút Lấy gợi ý lấy tiêuđề/lời cảnh làm bảnnháp, không gọi model viết lại.
   SDXL thường phù hợp promptEnglish; user tự chỉnh chủthể/bốicảnh/ánh sáng/gócmáy theo nội dung.
3. Chọn Theo prompt/Minh họa/Nét vẽ/Ảnh chụp. Style là suffixprompt, không là checkpointmodel khác.
   Nhập seed0..4294967295 hoặc dùng ↻ chọn mới. Profile hiện tại768×1024/20steps/1ảnh/lượt.
4. Kiểm tra backend/resources rồi Tạo ảnh. Tác vụ lưu request và danh tính trướcsubmit; đóngdialog
   không hủy. Nút không nhận tình trạng chưa đủRAM/backendtắt là đã tạoảnh.
5. Khi hoàn tất, chọn ảnh trong thưviện để xem lớn/thôngsố. Dùng lại thông số chỉ điền form, chưa tạo.
6. Bấm Gắn vào cảnh đích: một lầnundo, giữ lời kể/giọng. Lưu dựán, cập nhậtpreview hoặc xuất MP4.
   Ảnh không tự gắn khi generationxong. Nếu đổi dựán/cảnh/bảnlưu/nháp, chọnlạiđích trướcgắn.
   Cảnh đang dùng storyboard cần Dùng lại bố cục cảnh theoP5 trước, không tự xóa shots.

Ảnhlegacy đã VERIFIED vẫn hiện; thôngsốprompt cũ có thể thiếu nên Dùng lại thông số bịdisable.
Gallery đọc PNGcanonical hiệncó, không tạo thêmcopyasset làm tăng ổC. Gắnảnh không xóa filegốc.

## Backend local và RAM

ComfyUI đã pin tại `.tools/comfyui`, modelSDXL đã cài; app không tự tải/cài/mởbackend.
Khi đủtài nguyên, lệnh **terminal PowerShell tại Jarvis-Video**:

```powershell
node src/gpu-cli.mjs preflight
pwsh -NoProfile -File scripts/start-comfy.ps1
```

Giữterminalbackend mở trong giaiđoạnnày. AI Studio→Làm mới đọc trạng thái mới; modelhash/runtime
vẫn kiểm lại khiTạoảnh. Theo yêu cầu người dùng15/10, thử mức3GiBRAMtrống thay4GiB;
6GiBVRAMtrống/30GiBdisktrống giữ nguyên. Đây là headroom của Jarvis, không yêu cầu chung củaComfy
hoặcCodex. Fileweights6.94GB không bằng peakRAM; giảmgate không làm model dùng ít bộnhớ hơn và
chưa chứng minh chạy ổn sát3GiB. Nếu RAM vẫn dưới3GiB thì preflight dừng trước generation.
App chỉnh video thôngthường dùng pipelineCPU riêng.

Một tác vụ nặng tại một thời điểm. BảnP7.1 chưa cóglobalcancel/autoqueue/backendmanagedlifecycle.
Comfyglobalinterrupt có thể ngắtjobngoàiapp nên chưa đưa vàonútDừng. Có lỗi/UNKNOWN: giữjob;
Kiểm tra kết quả đọc đúngownedreceipt saupidđãthoát. GPUintentpending thì dùng lệnh hiệncó
`node src/gpu-cli.mjs reconcile` rồi Kiểm tra kết quả lại; không bấmTạoảnh để thửtrùng.
Nếu không có thôngtinđủ, UNKNOWN được giữ và cần kiểmtraowner/lease; không autoFAILED/autoretry.

## Nghiên cứu và giới hạn

[Bài tham khảo/phân tích](research/p7-1-ai-studio.md), [thiết kế](superpowers/specs/2026-10-14-video-p7-1.md),
[plan](superpowers/plans/video-p7-1/plan.md), [review](reviews/p7-1-dispositions.md) và checkpoint giữ
trạng thái nghiệmthu. Gallerycóảnh/codetests không chứng minh lần này đã sinhảnh mới thànhcông.
MediaAPIfee0 khác thời gian/điện/GPU và tokenClaude. ChưaclipAIUI/P7.2,voice-SRTimport/folderautocut/
autoSFX/457scene/longform/character/dubbing/.exe. Chất lượng do userxem vẫn riêng.
