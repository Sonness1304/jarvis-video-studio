# P7.4 — Phối nhịp chuyển động nhiều cảnh

User14/10 giao triển khai P7.4 theo đề xuất nối P7.3. Bounded extension vào luồng
image-motion/editor đã có; baseline a6906b0 sạch, coordinator inline. Không cài repo,
dependency/model hoặc thay renderer/schema. Không paid API/GPU/characters/dubbing/.exe.

Mục tiêu: phối các cảnh ảnh thành một chuỗi có chủ ý thay vì chỉnh từng cảnh. Mở
“Phối nhịp nhiều cảnh” tại thư viện Cảnh. Chọn preset theo chủ đề:

| Preset | Chuỗi chuyển động ảnh, lặp theo thứ tự ảnh trong bài |
|---|---|
| Giải thích | Tiến gần → Lia trái → Lia phải → Đứng yên |
| Kể chuyện | Tiến gần → Lia phải → Lia trái → Lùi xa |
| Sản phẩm | Đứng yên → Tiến gần → Lia trái → Lùi xa |
| Mạng xã hội | Tiến gần → Lia trái → Lùi xa → Lia phải |

Mức Êm/Cân bằng/Nổi bật = strengthgentle/medium/strong của P7.3; đây là nhịp chuyển
động hình, không đổi tốc độ giọng/thời lượng. Suggest preset từ brief.preset; không áp
một style chung cho mọi video. Palette UI giữ BeVietnamPro/xanh#3569CC/nền#F3F6FC,
text#192E52, muted#637C9D. Dialog dạng bàn phối cảnh: preset cards, nhịp segmented,
dải hướng chuyển động và danh sách trước/sau theo scene; mobile1column, focus/reducedmotion.

Chỉ `visual:media,media.kind:image` không shots được phép đổi; giữ nguyên fit/path/hash,
hold, phraseIDs/text/voice/sub, template/theme/branding/music/transition, thứ tự cảnh.
Default giữ mọi ảnh đã có explicit motion, kể cả still. Checkbox “Thay cả chuyển động
đã chỉnh” cho phép đổi chúng, không tự bật. Sequence index tính trên tất cả eligible
image scenes trước lọc explicit; giữ chỉnh tay không khiến các cảnh sau đổi thứ tự preset.

Danh sách cho từng scene báo áp dụng/không đổi/giữ chỉnh tay/bỏ qua clip hoặc bố cục.
Đổi lựa chọn trong dialog chưa sửa nháp. Áp dụng chỉ khi có thay đổi thật, một DraftHistory
full-brief snapshot cho cả nhóm; undo/redo/save/reload như edit hiện có. Không áp dụng
tự động khi chọn preset, không tự lưu/xuất/inference. Hủy/Esc không sửa nháp.

Capture projectID/revision và toàn JSON draft lúc mở. Nếu reorder/edit/đổi project/bản
lưu trong lúc dialog mở, vô hiệu Apply và yêu cầu mở lại. Preview-only/seek không đổi
draft nên không stale. Apply tính lại từ captured-current inputs, không dùng object
plan được UI chỉnh hoặc model output làm dữ liệu thực thi.

Kiểm pure sequence/idempotence/manualoverride/skippedtypes/atomicundo/stalecapture,
schema roundtrip và measured timeline/SRT identity. Browser đa cảnh/hủy/overwrite/undo/
save/reload/stale/mobile/keyboard. Native pilot ≥3image scenes → MP4, so WAV/timing/SRT
giữa trước và sau; kiểm mọi scene boundary/seek A→B→A, ảnh still giữ pixel, decode AV.
Cache0generated khi dùng lời đọc đã có. User quality/phát âm vẫn riêng.

Claude chỉ review guide authored này, ghi model/usage/dispositions; một fresh readonly
review cuối trên committed code. Bàn giao ở consumer checkpoint, rootJarvis chỉ pointer,
5paths Memorydirty giữ nguyên. Hướng sau P7.4: preset layout/content đa cảnh và quản lý
phiên bản mẫu; shot media riêng hoặc audio-beat sync cần scope/thiết kế mới, chưa tự chạy.
