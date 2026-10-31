# P7.3 — Chuyển động ảnh theo cảnh

User chốt “P7.3 chuyển động ảnh”14/10/2026 sau thiết kế bounded trong chat. Mở rộng
luồng ảnh/preview/render hiện có, coordinator inline. Baseline62ec8b8 sạch; không model,
dependency, GPU generation, paid API, dubbing, nhớ nhân vật hoặc đóng gói mới.

Trong tab Cảnh, chọn cảnh ảnh rồi chọn Mặc định / Đứng yên / Tiến gần / Lùi xa /
Lia trái / Lia phải. Chọn Nhẹ / Vừa / Mạnh và Lấp đầy / Vừa khung. Nút Áp dụng tạo
một bước hoàn tác; thay lựa chọn chưa áp dụng không sửa nháp. Đổi cảnh/bản nháp làm
mới form, không áp dụng form cũ sang cảnh khác. Lưu rồi cập nhật preview hoặc xuất MP4.

Media ảnh có tùy chọn `motion:{preset,strength}`: preset `still`, `push-in`, `pull-out`,
`pan-left`, `pan-right`; strength `gentle`, `medium`, `strong`. Không có motion = giữ
đúng chuyển động cũ. Chọn Mặc định xóa motion. Chỉ ảnh được phép có motion; video và
trường lạ bị từ chối. Metadata không đổi path/hash, text/voice/timing/cache key.

Chuyển động dùng thời gian tuyệt đối và ease smoothstep, clamp0..1 theo toàn thời gian
cảnh nhìn thấy: cảnh đầu từ0, cảnh cuối đến hết video, gồm hold. Một hàm pure dùng chung
composition preview/MP4. Với mức d=.04/.08/.12, zoom từ1 đến1+d hoặc ngược lại;
pan dùng scale1+d và translateX từ+50d% đến-50d% của khung ảnh, hướng ngược cho
lia phải. Overscan giữ kín biên cover. Contain cố ý giữ khoảng trống theo tỉ lệ ảnh;
zoom/pan có thể cắt bớt ảnh. Đứng yên scale1/translate0; explicit motion bỏ scale intro
của lớp cha. Transition toàn cảnh vẫn theo lựa chọn dự án. Không tích lũy theo frame.

Kiểm schema/roundtrip, boundary/math3format, seek A→B→A và legacy; browser thử apply,
undo/redo, đổi cảnh, save/reload, keyboard/mobile. QA chỉ miễn yêu cầu pixel thay đổi
cho ảnh explicit still không shots; vẫn bắt seek identity và strict AV decode. Mọi
ảnh chuyển động/visual cũ giữ gate motion. Native pilot ảnh đã kiểm chứng→MP4, cache
WAV/sub/timing đối chiếu; native mediaAPI0. Thẩm mỹ/phát âm user duyệt riêng.

Claude review chỉ guide authored này. Ghi actual model/taskId/usage/findings, không suy
Thinking từ delivery. Một fresh readonly code review cuối, đối chiếu findings rồi nghiệm thu.

Đơn vị cụ thể sau review: CSS `translate(x%,0) scale(s)`; phần trăm theo element box
chưa scale, rộng bằng viewport của ảnh. d=.08 nghĩa làscale1.08, x từ+4% đến-4%; không
dịch thêm4% sau khi scale lần nữa. Progress=(time-start)/(end-start), duration<=0→0.
Undo/redo dùng full-brief snapshots hiện có, khôi phục đúng ID từng cảnh; giữ cảnh đang
chọn và render lại form của cảnh đó, không ghi snapshot vào selected scene khác.

Implementation/native proof: [nghiệm thu P7.3](acceptance/video-p7-3.md).
