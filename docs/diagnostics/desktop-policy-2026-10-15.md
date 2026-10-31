# Chẩn đoán policy và lỗi desktop — 15/10/2026

User giao tra nguyên nhân `blocked by policy`, sửa và nghiệm thu phần desktop còn lại.
Coordinator inline tại consumer; chỉ đọc cấu hình/log của host, không đổi cấu hình toàn máy,
Orca, approval/security hoặc năm path Memory đang dirty tại AI-Superpowers.

## Lần chặn xác định được

Rollout của chat ghi `CreateProcess ... Rejected ... blocked by policy` tại
2026-10-14T18:11:25.96Z (01:11:25 ngày15/10 giờ Việt Nam), call
`call_861ae46791724706a381f7ce785643b1`. Đây là lệnh ghép sửa helper QA,
kiểm tra/dừng backend thuộc app rồi mở lại; bị từ chối trước khi PowerShell chạy.
Không có rule/reason chi tiết trong kết quả tool. Không khẳng định Guardian, hook nào
hoặc một pattern cụ thể đã gây từ chối; nguyên nhân quyết định bên trong host còn UNVERIFIED.

Readback chỉ đọc: thread sandbox disabled, approval never; repo không đăng ký
PreToolUse/PermissionRequest. Hook state cũ uppercase path có enabled=false; lowercase
duplicate chỉ có trusted_hash. Orca user hook gửi sự kiện và exit0, chưa có bằng chứng deny.
Default rules chỉ có allow, không có forbid. `codex execpolicy check --pretty --rules
./.codex/rules/default.rules -- 'C:/Program Files/PowerShell/7/pwsh.exe'
-NoProfile -File './scripts/start-studio.ps1'` trả
`{"matchedRules":[]}`, exit0. Điều này kiểm file rules đó, không chứng minh mọi policy của host.
SQLite logs không có exact denial; các mention trong feedback_tags là transcript, không rule.
Electron có warning Guardian enabled, nhưng không gắn với call bị từ chối.
Evidence: `.runtime/desktop-qa/policy-diagnostics.json`, `policy-read.log` và rollout của chat.

Các lệnh riêng kiểm identity rồi Stop-Process của backend idle do app QA sở hữu,
launch exe và build đã thực thi exit0 trong lượt này; không đổi policy để thực hiện.
Không tái chạy nguyên gói đã bị từ chối. Hai lỗi helper cũ OWNER_PROCESS_CHANGED/JOB_NOT_IDLE
do separator argv và REST-array PowerShell là lỗi script, tách khỏi host denial.

## Lỗi ứng dụng đã sửa

1. Job terminal lưu PID15872: Node kill(pid,0) trả EPERM nhưng Windows CIM/Get-Process
   xác nhận không tồn tại. Idle quit trước đó trả DESKTOP_UNKNOWN, không phải policy deny.
   Chỉ Windows EPERM mới dùng readonly CIM probe numeric PID, timeout2s; ABSENT mới cho idle,
   PRESENT/lỗi/timeout vẫn unknown. Không bỏ qua EPERM hàng loạt. Proof `stale-pid-proof.json`.
2. Fresh reviewer phát hiện nhiều PID probe có thể vượt native deadline3s, rồi server đóng
   muộn khi UI đã mở lại. Global activity deadline2s trả UNKNOWN/READY; kết quả đến muộn
   không cấp quyền đóng. RED→GREEN với hai probe chậm; fix2e3b321.
3. Bounds được clamp toàn cửa sổ theo working area; fixture màn hình nhỏ, âm tọa độ và
   màn hình bị tháo. Native máy này một màn hình/DPI120; đa màn hình vật lý chưa kiểm.
4. Thiếu WebView2 và kết nối đầu thất bại chỉ để nền trống: hộp thoại tiếng Việt được
   lên lịch sau callback. `about:blank` cũng là trang chưa kết nối; không chỉ kiểm Source=null.
   Native missing WebView2/process override và foreign-port đã kiểm, không gỡ runtime thật.

Code cuối `c147dbc6cd09cd15283654fa7e003092edd86187`; [nghiệm thu](../acceptance/video-desktop.md)
ghi exact commands, revision và bằng chứng. Backend busy/unknown/auth/ownership vẫn là
validation của app, không phải hook chặn lệnh Codex.

## Khi gặp lại

App hiện mở bằng exe/shortcut không cần terminal. Không cần thao tác tay đổi quyền cho bản này.
Nếu tool host lại trả denied, lưu exact call/time/command và phần lý do review nếu UI cung cấp;
không coi sửa source Jarvis là cách tắt lớp đó. Nếu không có lý do chi tiết, cần chẩn đoán/support
host; chưa có bằng chứng một nút cấu hình toàn máy có thể gỡ hoàn toàn denial này.
[Agent approvals](https://learn.chatgpt.com/docs/agent-approvals-security),
[Auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review),
[Rules](https://learn.chatgpt.com/docs/agent-configuration/rules) là tài liệu tham khảo;
không dùng để suy chính xác rule của call cũ.
