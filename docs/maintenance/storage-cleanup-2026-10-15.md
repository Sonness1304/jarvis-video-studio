# Dọn dung lượng và tài liệu — 15/10/2026

User yêu cầu dọn ảnh QA trùng, phần dư thừa và prompt đã dùng xong, giữ ảnh gốc/file quan trọng.
Phạm vi duy nhất `.`, baseline6817a9da90acbc9faba360594f36620d03463604
sạch. Coordinator inline. Không thay chức năng, auth, policy, model, dependency hoặc dự án khác.

## Đã xóa

451 mục/4.967 file, **516.758.660 byte = 492,82 MiB**. Đây là tổng byte của file bị xóa;
dung lượng ổ C có thể biến động thêm do Windows/app khác và cách cấp phát filesystem.

| Phần | Kết quả | MiB |
| --- | --- | ---: |
| Media QA cùng byte, không còn tham chiếu | 4 PNG,3 clip,1 bản nhạc; cùng manifest tương ứng | 12,74 |
| Preview nháp hết hiệu lực | 415 thư mục `outputs/draft-*`, cũ hơn1giờ; giữ16 mới nhất | 343,39 |
| Cache/bản build tái tạo được | Frame extraction, NuGet HTTP, desktop bin/obj và test bin/obj | 136,25 |
| Bộ ảnh thử phân trang | Fixture riêng51ảnh và bản web sao chép, server đã dừng | 0,39 |
| Script dựng/sửa nguồn đã chạy xong | 13 helper một lần, không có caller/tham chiếu | 0,04 |

Nguồn lớn vẫn cần dùng:3GPUmodels khoảng15,42GiB, GPUenvironment khoảng3,87GiB;
CPUmodel giọng khoảng0,53GiB. Không xóa chúng hoặc cache WAV đang giúp dùng lại giọng.
Không xóa Git/venv/node_modules, giấy phép, lockfiles, actualNuGetpackages, FFmpeg/FFprobe,
source/tests, finalMP4/SRT/QA/receipts hoặc state dự án. Không tự bỏ tính năng vì tên phase cũ.

## Những bản ảnh đã xử lý

Sáu normalizedPNG cùng SHA998ba5e4…: giữ `asset-175d568f-ece5-44d3-a0a1-b41124b8d7ca`
và `asset-406568a6-edc1-4f5f-9681-961b5e4dbefc` vì còn được lịch sử dự án/job/batch sử dụng.
Chỉ xóa bốn record cùng folder tương ứng sau:

- asset-46c3e6e3-0587-4230-9739-eb20c0fe235d
- asset-5c1fefc0-191d-4f75-9581-5c3a247b6d8c
- asset-c7b5cba2-84f0-494b-b759-ca85c22a360f
- asset-da2a2b1c-0046-421e-a424-8b342b7e4559

Hai ảnh AI gốc jarvis-59f4cab5… và jarvis-c9a7de97… giữ nguyên. Original.bin của mỗi bản bỏ
phải cùng hash với original.bin của bản giữ lại; không bỏ nguồn độc nhất. Metadata nhóm/tag cũng
là lý do bảo vệ một record. Không đổi đường dẫn hay viết lại tham chiếu để ép gộp.

Catalog sau dọn: **13 file =11media đã nhập+2AIgốc**, vẫn7nhóm nội dung. Hai PNG chuẩn hóa
còn trùng là có chủ đích giữ các phiên bản dự án cũ; không nhận đã loại hết trùng vật lý.
Group “Kênh AI”, tags “Robot”, “minh họa”, revision1 của ảnh gốc vẫn nguyên.

## Cách kiểm và bằng chứng

- Inventory đầu72.311file/22,1943GiB; scan không lỗi/reparse. Review tập trung vòng đời dữ liệu,
  cache, CLI/backend/frontend/launcher và metadata; không phải audit từng dòng toàn bộ GPU thư viện.
- Quét2.752 descriptor/snapshot: mọi revision project/job/batch/content, authoredbrief và output
  JSON/HTML/JS. Không lấy chỉ trạng thái project mới nhất hoặc badge “chưa gắn” làm quyền xóa.
  Mọi bản trùng bị bỏ đều0reference và còn cùng canonical/sourcehash ở bản giữ.
- Đóng cửa sổ bình thường, không discard userdraft. 43job đều terminal; batchVERIFIED/PARTIAL,
  không build/GPUlease. Stop đúng backend18716 sau root/exe/creationdate/receipt/listener checks;
  không killprocess khác. LegacyPIDreuse kiểm riêng theo CIM, không coi EPERM là processdead.
- `.runtime/storage-cleanup-plan-20261015.json` lưu allowlist từng absolute path/filehash, tổngbyte,
  4.163file được bảo vệ,16preview giữ lại. `.runtime/storage-references-20261015.json` lưu source refs.
- PowerShell duy nhất làm xóa: `.runtime/apply-storage-cleanup-20261015.ps1`, validate-only exit0,
  sau đó `-Apply` exit0. Trước xóa: resolvedpath dưới consumerroot, không reparse/tracked/protected,
  filecount và SHA không đổi. Không chuyển danh sách sang shell khác, không wildcardremove.
- Receipt `.runtime/storage-cleanup-receipt-20261015.json`:451mục thành công;
  freeC143368237056→143894810624byte ở hai thời điểm. Không coi delta này là tiết kiệm riêng Jarvis.
- `node .runtime/storage-post-verify-20261015.mjs`exit0: **4.163 protected file hashes giữ nguyên**,
  CPUpreflight13models và GPUbackend/deps+3modelhashes đúng;15file gói desktop đúng buildreceipt;
  catalog13/rawAI2/normalized2 và metadata nguyên; MP4pilot strictAVdecodeexit0.
- `npm test`206total/205pass/1existing opt-in nativeproofskip/0fail, exit0/9196.8763ms,
  `.runtime/storage-cleanup-node-20261015.log`; Pythonunittest6/6exit0,
  `.runtime/storage-cleanup-python-20261015.log`. Không dùng skip thay nativeproof thực tế.
- Helper kiểm lần đầu dùng sai tên exportGPU, FAILED trước khi chạy checks; đã sửa thành
  gpuRuntime và thêm modelhash loop, chạy lại exit0. Đây là TEST-DEFECT, không lỗi dữ liệu/app.

Ở lượt15/10, README được rút gọn và checkpoint300dòng được lưu archive đầy đủ.
Yêu cầu mới21/10 thay chính sách lưu chi tiết này: archive/kịch bản/review đã nghỉ được bỏ,
chỉ giữ [tóm tắt kết quả](../completed-work.md), hướng dẫn đang dùng và đầuvào recipe cần thiết.
Lịch sử Git vẫn có thể giữ các bản cũ; lượt này không sửa lịch sử Git.

App đã mở lại bằng đúngexe hiện có, PID23748/window394234. UI Media hiện13file; ảnh nguồn và
preview dự án vẫn đọc được, screenshot `.runtime/storage-native-after-20261015.jpg`.
`node .runtime/storage-handoff-20261015.mjs`exit0:84local links đúng, archive giữ nguyên nội dung
ngoài rebaselinks,872immutable statefiles giữhash sau boot,43jobterminal/cổng20130HTTP200;
không runtime source diff so bf4b2fc. README149→61dòng, checkpoint300→66dòng.
Source-code cleanup không được suy ra chỉ vì helper/cache đã xóa; mọi chức năng app được giữ.

## Phần chưa xóa và thao tác tay

Lệnh bổ sung xóa5helper dưới `.runtime` đã bị host automatic approval review từ chối trước
PowerShell với **blocked by policy**, không cung cấp rule cụ thể. Không chạy lại qua wrapper,
shell khác hoặc UI để vượt từ chối. Năm file vẫn được giữ, tổng8.329byte (~8,13KiB):

- review-catalog-opus.mjs
- review-export-check.mjs
- review-media-catalog.mjs
- review-media-library.mjs
- p2-packet.mjs

Đây là caller chuẩn bị prompt/review một lần, không phải Claude integration của app. Scan toàn
source/docs/tests/runtime scripts không thấy caller tới chúng; receipts/findings/artifact review giữ
riêng. Nếu muốn bỏ nốt, user có thể tự chọn **đúng5file trên** trong File Explorer ở
`.\.runtime` rồi Delete. Không chọn cả thư mục `.runtime`.
Không suy ra Jarvishook còn bật hoặc WindowscấmRemoveItem; batch451mục trước đó đã thành công.

Điều tra tiếp theo đã tìm đúng call/time và quyềnnever/fullaccess; userrules không khớp lệnh.
Cách gọi “automatic approval review” phía trên chưa chứng minh đó là tính năng Auto-review.
[Báo cáo phân biệt lớp từ chối, giới hạn log và hướng dẫn thao tác tay](blocked-five-callers-2026-10-15.md)
giữ kết luận exactrule UNVERIFIED; không có cấu hình nào đã được chứng minh cần sửa.

User sau đó báo đã xóa tay. Test-Path15/10 kiểm đúng5file đềufalse; không còn5helper pending.
Không coi thao tác tay là bằng chứng hostpolicy đã sửa hoặc agent đã retry thành công.

Các helper nghiệm thu cũ ghi số catalog21 là snapshot trước dọn, không là live expectation sau đợt này.
Kiểm hiện hành dùng storage-post-verify và checkpoint mới. Không tự bật auto-clean, xóa file dự án,
di chuyển model sang ổ khác hoặc tải lại model. Userquality/newchat/installer như trước vẫn riêng.
