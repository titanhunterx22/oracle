# ORACLE Creative Studio — Windows local image engine

This companion application connects the ORACLE Manifest V3 extension in Microsoft Edge or Chrome to OpenVINO GenAI running on Windows. OpenVINO does not run inside the Edge extension; the extension calls this local process at http://127.0.0.1:8765.

## Target hardware

The first profile targets Intel integrated graphics, including Intel Iris Xe, with CPU fallback. The initial model is Intel's OpenVINO INT8 conversion of Stable Diffusion 1.5:

- Model: OpenVINO/stable-diffusion-v1-5-int8-ov
- Runtime: openvino-genai and its Text2ImagePipeline
- Initial output: 512 × 512, one image per request
- Generation steps: 10, 15, 20, 25 or 30
- Generation progress: the current stable Python API does not expose reliable per-step progress for this pipeline, so the dashboard uses an indeterminate activity indicator until completion.
- Device selection: first available OpenVINO GPU device, otherwise CPU; if GPU pipeline initialisation fails, retry on CPU.

OpenVINO's current system requirements list Intel Iris Xe graphics on Windows 10/11. The Windows GPU plugin needs a compatible Intel graphics driver and OpenCL runtime. CPU inference is the fallback if the GPU is absent, cannot initialise, or fails during generation. A GPU generation failure triggers one CPU retry. Update the Intel graphics driver before troubleshooting GPU detection.

## Installation

1. Install 64-bit Python 3.11 or 3.12 from https://www.python.org/downloads/windows/. Enable the Python Launcher during setup.
2. Extract the ORACLE-Creative-Studio-Engine ZIP.
3. Right-click Install-ORACLE-Creative-Studio.ps1 and choose Run with PowerShell. If Windows blocks it, open PowerShell in the extracted folder and run:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-ORACLE-Creative-Studio.ps1
4. Open Start Menu → ORACLE Creative Studio. Keep its PowerShell window open while using image generation.
5. Open the ORACLE dashboard in Edge → Creative Studio → Prepare local engine. The model downloads only after you click this button. The first setup needs an internet connection and several gigabytes of free disk space.

The installer creates an isolated Python environment under %LOCALAPPDATA%\Programs\ORACLE Creative Studio. Model files and generated images are kept under %LOCALAPPDATA%\ORACLE\CreativeStudio. The model is not bundled into the extension or installer.

## Edge and extension security

The extension requests one narrowly scoped host permission for http://127.0.0.1:8765/*. The service binds only to IPv4 loopback, validates the request Host and Chromium extension Origin, requires the ORACLE client header, and does not enable wildcard CORS. It does not listen on your Wi-Fi/LAN interface. Microsoft's Edge Local Network Access rollout exempts extensions with the required host permissions; this is not a normal webpage request and does not require experimental browser flags.

## Privacy

Prompts, negative prompts, generated images and gallery metadata are processed and stored on this computer. Hugging Face is used only to download the publicly hosted model files during setup. No paid image API, ORACLE cloud service, account or telemetry is used.

The model is distributed under the CreativeML Open RAIL-M licence. Review the licence and original model card before use: https://huggingface.co/OpenVINO/stable-diffusion-v1-5-int8-ov.

## Limitations

- This first release is text-to-image only. Image editing, inpainting, LoRA styles and larger resolutions are not enabled yet.
- Iris Xe is supported by OpenVINO, but actual speed and memory use vary by driver, laptop cooling and power mode. A successful device enumeration does not guarantee that every pipeline operation will run on the GPU.
- CPU fallback is slower. If both GPU and CPU pipeline initialisation fail, the service reports the full setup error in Creative Studio.
- Generation is intentionally single-image and 512 × 512 to keep the initial workload bounded.

## Troubleshooting

- Cannot connect: start the companion from the Windows Start Menu and leave its window open. Check that port 8765 is not blocked or occupied.
- GPU not listed: update the Intel Iris Xe graphics driver from your laptop manufacturer or Intel. OpenVINO's GPU plugin requires the Windows Intel graphics driver/OpenCL runtime.
- GPU initialisation failed: ORACLE tries CPU fallback automatically. The status panel reports the device actually selected.
- Model download interrupted: return to Creative Studio and press Prepare local engine again. Hugging Face snapshot downloads keep already downloaded files in the local cache.
- Need to stop it: close the companion PowerShell window or press Ctrl+C.

This installer has been source-validated and packaged by CI; it still needs a real run on the target laptop to benchmark Iris Xe throughput and confirm the installed driver/runtime combination.
