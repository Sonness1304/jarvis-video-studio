# Vì sao ảnh trùng trong thư viện

Readonly audit15/10 tại consumer trước thay đổi catalog, source788ac9f sạch.
`node .runtime/media-duplicate-audit.mjs`exit0; `.runtime/media-duplicate-audit.json` giữ từngID.

| Loại | Record cùng bytehash | Dung lượng mỗi bản |
| --- | --- | --- |
| Ảnh PNG normalized |6|1680086bytes|
| Clip thử2s |5|144995bytes|
| Nhạc thử6s |5|576078bytes|
| Clip source-motion |2|691106bytes|

6ảnh cùng SHA256 `998ba5e4825532a21018aba1f458f16c51ea55a776967a25cc4f87b939e48d26`.
Hash file đọc lại khớp manifest; sourceHash của chúng liên hệ ảnh nguồn
jarvis-c9a7de97-a4aa-4b15-955e-fd473396fb04. Đây là cùng fixture đã được nhập lại trong các
lượt QA trước, không phải6lần sinhảnh khác nhau. `importAsset()` luôn tạo UUID mới mỗi lần nhập,
chưa khử trùng; UIv1 hiển thị một card mỗi ID. Các lần kiểm thử trước của coordinator đã góp
phần tạo nhiều bản này. Không có bằng chứng lỗi ComfyUI tự sinhảnh trùng ở đây.

2ảnhAIraw có hash riêng5a189020… vàfb203e9e…; PNG được chuẩn hóa có thể đổi bytehash dù hình
giống. Không dùng mắt nhìn, tênimage.png hoặc cùngsourceHash làm bằng chứng byte-identical.

User duyệt displaygroup theo exact(kind,SHA256), kèm sốbản/togglehiệntừngbản. Không tựxóa,
mergefiles hoặc thayprojectreferences; no diskspace-savingclaim. Metadata nhóm/tag gắn exactID.
Khi chọn file vẫn hiển thị path/hash/source để phân biệt normalizedvàAIraw. Tính năng khử trùng
lúc upload hoặc dọn bản sao vật lý cần scope riêng, không tự xóa file đang được lịch sử thamchiếu.
