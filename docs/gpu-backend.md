# GPU backend P1

Một backend ComfyUI8010b48d/.tools/comfyui, .venv-gpu Python3.12.14/Torch2.10cu130;
CPU .venv/VieNeu/FFmpeg/HyperFrames nguyên lock/hash. [Manifest](../gpu-provenance.json)
và [GPU versions lock](../requirements-gpu.lock). Chỉ core graph, offline/loopback8188;
no Manager/custom/paid nodes, account settings hoặc global startup mới.

PowerShell terminal tại .:

```powershell
node src/gpu-cli.mjs preflight
# Sau preflight đạt, giữ terminal này mở:
pwsh -NoProfile -File scripts/start-comfy.ps1
# Terminal khác, tuần tự sau khi backend ready và không có build khác:
node src/gpu-cli.mjs status
node src/gpu-cli.mjs image 'A friendly small robot in a bright creative workshop, cinematic illustration, no text'
```

Theo yêu cầu người dùng15/10, thử ngưỡng live3GiB freeRAM/6GiB freeVRAM/30GiB disk trước nạp model
và ngay trước submit, thay mức RAM6GiB cũ. Đây là ngưỡng thử của Jarvis, chưa chứng minh đủ cho mọi job;
không dùng totalRAM/HTTP200 thay gate hoặc suy mức tối thiểu chung của ComfyUI.
SDXL base single checkpoint768x1024/batch1/20steps/seed20261013; exact LFSbytes/SHA trong manifest.
Model tải public streaming1MiB (không loadtensor), giữ .part và resume explicit đúng revision,
hash toàn file trước rename; `& .\.venv-gpu\Scripts\python.exe scripts/download-gpu-models.py sdxl-base`.
Không overwrite existing model lệch hash hoặc tự retry endpoint/rate limit. Cài model không sinh ảnh.

Image output mới ở outputs/jarvis-UUID, graph/source/model/hash/resource timestamps trong receipt.
VERIFIED chỉ sau completedhistory+scopedfilename+PNGdecode+dimensions+copyhash; qualityuser riêng.
UNKNOWN submit giữ durableintent .runtime/gpu-job.json chặn mọi pipeline nặng, kể cả CLI đã thoát.
`node src/gpu-cli.mjs reconcile` tìm clientId trong queue/history hoặc đọc promptId, kiểm/copy/decode
output rồi archive intent chỉ khi terminal. Không tự xóa intent hoặc auto submit lại. Có promptId:
`node src/gpu-cli.mjs history PROMPT_ID`. Deadline30phút UNKNOWN không kill job.
Heavy pipelines tuần tự; GPU receipt resources là sampled system freeRAM/VRAM, không processpeak
hay energybenchmark. ComfyUI không là sandbox cho graph/model Python; không nhận arbitrary graph.

Ảnh native SDXL đã VERIFIED tại sourceaecd7e1; ảnh có decode/hash đã đưa vào narrated MP4/SRT thật.
Clip canary CLI có graph core cố định LTX2Bfp8+T5fp8scaled,49frames320x51224fps. Cả hai weights
đã tải đủ/hash đúng sau phục hồi CDN; nativeclip đã decode/hash/frameQA tại sourcef467968.
Backend10.05s/CLI10.964s, không paidAPI. Đây là canary thấpresolution, không productionquality.
Commands explicit (weights đã cài trên máy này):

```powershell
& .\.venv-gpu\Scripts\python.exe scripts/download-gpu-models.py ltx-2b
& .\.venv-gpu\Scripts\python.exe scripts/download-gpu-models.py ltx-t5
node src/gpu-cli.mjs clip outputs/jarvis-ID/receipt.json 'English motion prompt'
```

Input là receipt PNG VERIFIED, không arbitraryworkflow/URL. Canary không fullresolution app/video
audio; H264/frame/fps/duration/strictdecode riêng. First/mid/last đã xem: robotmotion/camera có thật,
cuốiclip cắt bớt đầu robot nên qualityuser vẫn UNVERIFIED. No cross-film consistency claim.
Không Wan2.2raw5B default trên16GiB, không LTX22B/LoRA/characters.
Ngưỡng RAM3GiB thay mức thử4GiB trước đây theo yêu cầu user15/10. [Spec P7.1](superpowers/specs/2026-10-14-video-p7-1.md)
giữ lịch sử; nếu vẫn thiếu3GiB thì dừng, không tự hạ tiếp. Đây là RAM trống trước launch/submit,
không phải giới hạn tổng RAM tiến trình hoặc bảo đảm model chỉ chiếm3GiB.

ComfyUI code GPL3; SDXLweights OpenRAIL++-M và LTXweights license riêng, không suy giấy phép
weights từ code. Nội bộ local pilot không quyết định bán/redistribute app/model bundle.
