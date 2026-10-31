# P7.2 — Tạo clip từ ảnh trong AI Studio

User14/10 đã duyệt thiết kế bounded trong chat: chọn ảnh VERIFIED, nhập chuyển động, LTX2B đã cài
tạo49frames320×512/24fps (~2.04s), xem trước, gắn vào cảnh; giữ giọng/sub/undo/resources và không model mới.
Đây là bản clip thử thấp resolution, không phim production hay đồng nhất nhân vật.
[Nghiệm thu kỹ thuật](acceptance/video-p7-2.md) đã có nativeclip→MP4; userquality vẫn riêng.

## Cách dùng

1. Mở Open-Video-Studio.cmd, vào dựán/chọncảnh. Mở AI Studio, chọnảnh rồi **Tạo clip từ ảnh này**.
2. Clip AI hiện ảnhnguồn vàcảnhđích. Nhập promptchuyểnđộng (ví dụ robotdịchchuyểntaynhẹ/cameraổnđịnh).
3. Khi đủRAM/VRAM/disk vàbackendREADY, bấm **Tạo clip từ ảnh** mộtlần. Nếu backendtắt:
   chạy `pwsh -NoProfile -File scripts/start-comfy.ps1` trongterminaltạiJarvis-Video.
4. Chờtácvụhoàntất, chọnclip trongthưviện đểxem. Bấm **Gắn clip vào cảnh đích** để nhậpMedia/gắn1undo.
   Nếuđíchđãđổi, clip vẫnởMedia; chọnlạiđích rồi gắn. Scene cóstoryboard phải dùng workflowP5 trước.
5. Lưu/Cập nhậtpreview hoặcXuấtvideo. P6trim/split dùng canonicalclip; giọng/sub không thay theo ảnh.
   Cảnhdàihơnclip sẽgiữframecuối theo rendererP6, không tựsinhthêmchuyểnđộng.

App20130chạynền khôngcầngiữterminalapp. BackendComfyhiệnmanualstartup vàđãdừngsaupilot đểnhườngRAM;
không tựnạpmodeleveryrefresh. CóUNKNOWN: không bấmTạolại, đọcjob/ownedreceipt và dùngreconciletheoguideGPU.

## Hợp đồng triển khai

- Reuse AI Studio/JobManager/GPUintent/lease; thêm jobkindclip với danh tính cấp trước spawn,
  canonicalClipRequest{prompt,source{id,receipt,image{path,sha256}}}. Client chỉ gửi imageId+prompt;
  server đọc đúng ownPNGreceipt VERIFIED/hash và pin snapshot kèmreceiptSHA; không nhận URL/path/graph tùy ý.
- Child fixed argv `node src/gpu-cli.mjs clip-request OWNED_REQUEST_FILE`; requestenvelope và receipt
  identity lưu trước submit. Kiểm lại source/hash trước graphinputcopy; graphLTX/seed20261013 cố định.
- Readiness clip kiểm modelstat ltx-2b/ltx-t5, resources4GiBRAM/6GiBVRAM/30GiBdisk, backendqueue/lease.
  Generation vẫn kiểm hashes/runtime. Không giả inference từ ready, no fakepercent/globalinterrupt/retry.
- Result clip cần ownid/client/receipt/canonicalrequest/sourceimage/graph khớp; MP4hash/ffprobe49frames
  320×512/24fps/H264/49÷24s và strictdecode rồi sealreceipt. UNKNOWN/crash/restart giữ pending; reconcile
  đọc đúng ownedterminalreceipt, hỗ trợFAILED hoặc VERIFIED, không nhận foreignattempt cùngprompt.
  Reconcile không spawn/submit. Source mất/đổi trướcinputcopy thìFAILED trướcGPUintent, không fallback.
- Cliplist chỉ lấy VERIFIED clipjobs; file qua authenticatedhashchecked route. UI chọn clip để xem video
  controls/muted, hiện nguồn và thông số; generation không autoattach. Chọn ảnh nguồn từ gallery PNG.
- Gắn clip cần targetcapture project/revision/scene/generation trước và sauasync. Dùng existing
  importAsset chuẩn hóa vào outputs/asset-ID/media.mp4 trước khi attach, giữ contractP3/P6;
  không mở schema media để nhận arbitraryGPUfile. POSTtyped import xác minh jobseal/source và giữ
  jobs.exclusive/buildlease. Reuse normalizedasset khi sourceHash khớp và canonicalfilehash đúng;
  crash sau import có thể đọc lại assetrecord, không copy mỗi lần xem/gắn. Asset độc lập scene;
  không reuse targetcapture/attachrecord cũ khireusefile.
- Một lần attach là1undo, không sửa phrases/voice; scene có shots từchối trướcmutation, không tự xóa
  storyboard. Asset nhập xong mà targetstale vẫn ở Media; báo rõ, không gắn sang scene khác.
- Tests RED→GREEN request/sourcepin/foreignreceipt/UNKNOWN/terminalrecovery, auth/CSRF/CAS,
  clipreadinessmodelmissing, reuseasset; fullNode/Python. Browser và một nativeclip từ ảnhP7.1 mới,
  attach/undo/save/reload→MP4/strictdecode/SRT/seek. Một freshreadonlycode review cuối, một fixpass.

Coordinatorinline, sourceconsumer riêng, rootMemorydirty giữ nguyên. Không globalconfig/newdeps,
paidAPI/longform/dubbing/characters/packaging/publish. Claude review authored guide/code, không private media.
