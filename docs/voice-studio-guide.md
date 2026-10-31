# Giọng nói và lồng tiếng trong Jarvis

Mở **Jarvis Video Studio**, chọn dự án → tab **Âm thanh** → **Bàn giọng nói**.
Phần này chạy trong Jarvis đang có; VoiceStudio là ứng dụng đồng hành riêng.
[Nghiệm thu và giới hạn](acceptance/voice-integration-20261021.md).

## Chọn giọng và nghe đúng câu

1. Chọn dạng video: kiến thức, kể chuyện, kinh dị hoặc sản phẩm. Dòng gợi ý mô tả cách kể;
   bạn chọn giọng phù hợp sau khi nghe, không có model tự đổi giọng các dự án cũ.
2. Chọn giọng → **Dùng cho cảnh** hoặc **Dùng cho video**. **Theo giọng video** bỏ override của cảnh.
   **Nhớ cho chủ đề này** lưu sở thích cho lần chọn sau; mỗi dự án vẫn giữ lựa chọn đã lưu.
3. Chọn câu → **Nghe câu này · tạo bản khác**. Có thể tạo vài bản để so sánh rồi **Chọn bản đọc này**.
4. **Lưu dự án**. Bản đọc vẫn nghe được sau mở lại và bản xuất dùng đúng WAV đã chọn.
   Sửa câu hoặc giọng làm bản đọc cũ không còn hợp lệ; cần nghe/chọn lại trước khi xuất.

Ô **Từ điển phát âm** nhận mỗi dòng `từ = cách đọc`, ví dụ `Jarvis = Gia vít`.
Bấm **Áp dụng từ điển**, xem dòng **Sẽ đọc** rồi nghe lại. Phụ đề giữ lời gốc.
Cách đọc riêng của câu tại bảng phụ đề ưu tiên hơn từ điển. Từ điển phân biệt chữ hoa/thường,
so từ nguyên vẹn; không chạy biểu thức hoặc thay đi thay lại kết quả.

Bấm **Hoàn tác** trước khi lưu nếu muốn quay lại. **Bỏ chọn bản đọc** chỉ bỏ lựa chọn trong nháp,
không xóa âm thanh đã tạo. Cảnh báo clipping/im lặng/mức âm lượng là kiểm tra kỹ thuật;
bạn vẫn cần nghe và duyệt chất lượng. Lượt thử Hải Đăng có cảnh báo clipping, Thục Đoan không có.

## VoiceStudio nằm ở đâu

- App: `%LOCALAPPDATA%/Programs\VoiceStudio\VoiceStudio.exe`.
- Runtime bạn đã cài: `C:\New folder (2)\VoiceStudio`.
- Model: `%LOCALAPPDATA%/OmniVoice\hf_cache` — riêng với runtime và model VieNeu.
- Trong Jarvis: **Mở VoiceStudio**, sau khi app sẵn sàng bấm **Kiểm tra kết nối**.

App pin **0.5.6**, API loopback `http://127.0.0.1:3900`. Đã cài core OmniVoice và Whisper Small;
không cần cài lại gói Cân bằng4,8GB. Runtime/dependencies/model chiếm nhiều hơn bộ cài EXE.
**OmniVoice weights có điều kiện phi thương mại**: connector Jarvis chặn TTS OmniVoice và các alias;
video hiện tại tiếp tục dùng 25 preset VieNeu. Cài app không đồng nghĩa mọi engine/giọng đều đủ model
hoặc được phép dùng thương mại. VieNeu không có nút vui/buồn được bảo đảm; không giả thêm nút cảm xúc.

## Giọng riêng / clone

Mở mục **Giọng riêng / clone**. Chọn WAV/MP3 bạn có quyền sử dụng, nhập tên, lời đúng trong bản thu,
xác nhận quyền và chọn đoạn sạch **3–8 giây**. Tạo profile, kiểm tra kết nối để nạp danh sách rồi chọn
**Giọng riêng** như một giọng bình thường. Nghe thử trước khi dùng. Cần RAM trống ít nhất4GiB.
Lưu trữ profile giữ reference/revision cho các dự án cũ; không xóa file hoặc sửa preset bank.
User chưa cần clone bằng mẫu cá nhân; độ giống/biểu cảm thực tế chưa được nghiệm thu.

## Chép lời và lồng tiếng V2 · đang nghiệm thu

Trong **Âm thanh → Chép lời & lồng tiếng**, làm theo thứ tự:

1. Mở phần **Nhập video hoặc nhạc / M&E riêng**, chọn MP4/MOV hoặc WAV/MP3 và ghi quyền sử dụng. Giới hạn nhập riêng10phút/512MiB là thử nghiệm; phim dài chưa nghiệm thu đầy đủ. Nhập media thông thường vẫn giữ giới hạn cũ.
2. Tạo/mở phiên. **Chép lời local** dùng Whisper Small trong .venv-asr riêng, cần RAM trống≥4GiB. Chia tối đa60s/chunk; cache có hash giúp dùng lại đoạn xong sau gián đoạn. Nhập SRT nguồn được nếu đã có.
3. Đọc/sửa lời gốc và mốc. **Gợi ý nhóm người nói** dùng encoder local thử nghiệm. Nhóm theo câu, chưa tách overlap/đổi người giữa câu. Nghe nguồn rồi duyệt tên/giọng từng nhân vật; cao độ không chứng minh giới tính. Match yếu/uncertain không tự chọn preset. Có giọng chung và override theo câu; cần tự kiểm phù hợp.
4. Đánh dấu đồng ý gửi **riêng lời thoại/nhãn nhân vật qua9router**, bấm **Dịch sang tiếng Việt**. Không gửi video/âm thanh. Xem nháp rồi **Áp dụng**; không tự ghi đè lời đã sửa. Chỉ gọi model khi bạn bấm.
5. **Tạo các câu chưa có giọng** chạy TTS local tuần tự (RAM≥2GiB), dùng lại take đúng signature. Nghe từng câu; câu dài hơn slot tối đa1.1× phải duyệt tốc độ, quá hơn phải rút/chia lời. Không cắt chữ/kéo trễ câu sau.
6. **Âm thanh nền**: chọn track M&E/music rời dài đủ, cùng giây0; giữ stereo và giảm nền dưới thoại. Hoặc tự chọn **Chỉ lời Việt** nếu chấp nhận bỏ tiếng nguồn. Chưa có separator được nghiệm thu cho track thoại+nhạc trộn sẵn; không có nút giữ nền giả.
7. **Lưu phiên → Xuất WAV/SRT/MP4**, file ở outputs/dub-.... Nguồn gốc giữ nguyên, phiên lồng tiếng riêng với timeline narration. Chưa sửa khẩu hình, clone giọng hoặc tự đăng.

Sau reload, mở **Kết quả đã lưu / tác vụ cần kiểm tra → Tìm kết quả đã lưu** rồi xem nháp dịch/gợi ý cũ. Chỉ áp dụng nếu toàn snapshot còn khớp; không cần dịch lại chỉ để khôi phục.
Nếu dịch UNKNOWN, kiểm tra trước; khi process đã thoát có thể đọc và đánh dấu xác nhận kết quả chưa rõ để **mở khóa hàng đợi**. Có thể đã tính token; không tự gửi lại. Tác vụ GPU/TTS UNKNOWN vẫn theo cơ chế owner/lease hiện có.

[Nghiệm thu từng phần, mẫu22.63s và phần chưa đạt](acceptance/dubbing-v2-20261029.md). Native ASR mới, tự chọn giọng và full pipeline còn UNVERIFIED; UI có tính năng không đồng nghĩa đã đạt chất lượng lồng tiếng phim.

## So giọng A/B trước khi tạo toàn bộ

Trong **Chép lời & lồng tiếng**, mở **So giọng trước khi tạo toàn bộ** sau khi đã nhập lời Việt.

1. Chọn câu có câu hỏi, ngắt nghỉ hoặc cảm xúc đại diện. **Đến câu gốc** đưa video đến đúng mốc;
   tự bấm phát để nghe đối chiếu. Nút này không gửi giọng gốc ra ngoài.
2. Chọn hai giọng A/B, bấm **Tạo mẫu A** và **Tạo mẫu B** lần lượt. Mỗi nút tạo một take local
   của đúng lời Việt đã lưu; mở bảng/đổi lựa chọn không tự chạy model. Cần RAM trống≥2GiB.
3. Nghe hai WAV, bấm **Dùng giọng A/B**. Nếu câu đã gán nhân vật, giọng được áp dụng cho nhân vật;
   các câu có override riêng khác giữ nguyên. Câu chưa gán nhân vật chỉ đổi riêng câu đó.
4. Bản xuất dùng lại đúng take đã nghe cho câu thử; các câu khác có giọng đổi phải tạo lại.
   Có thể **Hoàn tác** trước lưu. Bấm **Lưu phiên** để giữ lựa chọn sau khi mở lại.

Sửa lời/mốc/nhân vật hoặc đổi phân vai làm mẫu không còn hợp lệ. Mẫu quá dài so với slot bị từ chối;
không cắt lời để ép khớp. Lỗi/UNKNOWN cần kiểm tra lịch sử, không tự tạo lại hay chạy song song.
Mẫu A/B chưa chọn nằm trong phiên đang mở; reload cần nghe/chọn lại, WAV vẫn thuộc lịch sử tác vụ.

Danh sách có preset và **Giọng riêng** đang hoạt động đã tạo ở mục clone. Profile đã lưu trữ/mất
không được thay bằng preset ngầm. Chỉ dùng mẫu được phép; chưa tự lấy giọng diễn viên từ video.
Engine hiện pin không có điều khiển cảm xúc được nghiệm thu: viết lời như hội thoại, ngắt ý và
nghe kiểm tra là bước bắt buộc để đánh giá tự nhiên. Không bảo đảm clone giữ đúng ngữ điệu/khẩu hình.

[Bốn WAV thử và nghiệm thu](acceptance/dubbing-voice-audition-20261029.md).

## Nếu chưa chạy được

- `VOICE_UNAVAILABLE`: áp dụng cho tính năng dùng companion; mở VoiceStudio và kiểm tra lại. ASR theo nhu cầu không cần app.
- `VOICE_RAM_GATE_4GIB`: đóng app/tab không dùng để có ít nhất4GiB RAM trống. Có thể để VoiceStudio đóng khi chép lời.
- `VOICE_ASR_RUNTIME_CHANGED` / `VOICE_ASR_MODEL_CHANGED`: runtime hoặc model khác pin; kiểm tra đường dẫn/cài đặt trước, không tự bỏ kiểm hash.
- `VOICE_TAKE_STALE` / `DUB_TAKE_STALE`: câu/giọng đã đổi; nghe và chọn bản mới.
- `DUB_OVERFLOW`: rút ngắn lời hoặc chỉnh/chia mốc nguồn rồi nghe lại; không xuất bằng cách cắt lời.
- `UNKNOWN` / cần kiểm tra: không bấm tạo lại. Dùng **Kiểm tra kết quả** trong lịch sử;
  nếu process/lease chưa xác định thì giữ nguyên, không tự xóa lock hoặc ép chạy song song.

Trong lượt giải phóng RAM, dịch vụ OpenCode đã được dừng bằng CLI chính thức. Khi cần dùng lại,
mở shortcut **OpenCode Jarvis / OpenCode Desktop Jarvis** tại `C:\AI`. Cấu hình không bị gỡ hay đổi.

Lưu ý RAM: mở bằng **Mở VoiceStudio** trong Jarvis dùng launcher không tự nạp TTS;
model vẫn còn và có thể nạp khi cần. Mở EXE trực tiếp vẫn theo hành vi stock. Backend đầy đủ vẫn tốn
khoảng1GB resident cộng giao diện Electron, nên phải đo RAM trống sau khi app đã sẵn sàng.
Khi dùng VieNeu, nhậpSRT hoặc chép lời theo nhu cầu, có thể để VoiceStudio đóng.
ASR theo nhu cầu đã nghiệm thu qua UI trên clip6s: chép lời→sửa→lưu/mở lại→chọn bản đọc→xuất.
[Đo RAM và kết quả](acceptance/voice-asr-ondemand-20261021.md). Whisper vẫn có thể sai từ/tên riêng;
đọc và sửa trước khi tạo giọng. Không bấm tạo lại nếu báo UNKNOWN.
