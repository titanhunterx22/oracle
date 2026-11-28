# ORACLE Creative Studio — self-contained Windows image engine

This is a **self-contained Windows application** for ORACLE's Creative Studio. It includes a private Python runtime, OpenVINO GenAI, OpenVINO Runtime, OpenVINO Tokenizers, and the required Python packages inside the application folder. **You do not need to install Python, pip, Node.js, or a development environment.**

## Hardware and model

- Runtime: OpenVINO GenAI 2026.4.1.0
- Model: OpenVINO/stable-diffusion-v1-5-int8-ov
- Model format: Stable Diffusion 1.5, OpenVINO IR, INT8 compressed weights
- Initial output: 512 × 512, one image per generation
- Generation steps: 10, 15, 20, 25 or 30
- Device selection: first available OpenVINO GPU device (Intel Iris Xe where supported); otherwise CPU. If a GPU pipeline fails during generation, the app retries once on CPU.

The model weights are about 2.3 GB on Hugging Face and are not bundled in the Windows application. They download only after you choose **Prepare local engine** in ORACLE Creative Studio. The model download needs internet access. Image generation itself is local after setup.

## Install — no Python required

1. Download and extract ORACLE-Creative-Studio-Engine.zip completely. Do not run the installer from inside the ZIP preview.
2. Double-click Install-ORACLE-Creative-Studio.ps1 (or right-click and choose **Run with PowerShell**).
3. The installer copies the self-contained application to %LOCALAPPDATA%\Programs\ORACLE Creative Studio and adds **ORACLE Creative Studio** to your Windows Start Menu. It does not install Python or alter your PATH.
4. Open **ORACLE Creative Studio** from the Start Menu. Keep its PowerShell window open while using image generation; close the window or press Ctrl+C to stop the service.
5. Open the ORACLE dashboard in Microsoft Edge → **Creative Studio** → **Prepare local engine**. The model is downloaded once to %LOCALAPPDATA%\ORACLE\CreativeStudio.
6. Generate an image. ORACLE tries the Intel GPU first and falls back to CPU if required.

## Edge connection and security

OpenVINO does not run inside Edge. The extension communicates with this bundled Windows application at http://127.0.0.1:8765. The service binds only to IPv4 loopback, validates the request Host and Chromium extension Origin, requires the ORACLE client header, and does not enable wildcard CORS. The extension has a narrowly scoped host permission for this local port. No experimental Edge flags are required.

## Local files

- Application: %LOCALAPPDATA%\Programs\ORACLE Creative Studio
- Downloaded model and cache: %LOCALAPPDATA%\ORACLE\CreativeStudio\models
- Generated images and gallery metadata: %LOCALAPPDATA%\ORACLE\CreativeStudio\gallery

Updating the companion replaces only the application folder. It does not delete the separate model or gallery folders.

## Requirements and limitations

- Windows 10/11, 64-bit x86.
- Intel Iris Xe acceleration depends on the installed Intel graphics driver and OpenVINO GPU plugin. If it is unavailable or fails, CPU fallback is used; CPU generation may be slower.
- The Microsoft Visual C++ 2015–2022 x64 Redistributable may be required by OpenVINO. If the engine fails to start with a missing runtime DLL, install it from https://aka.ms/vs/17/release/vc_redist.x64.exe (administrator approval may be required).
- This first release supports text-to-image only. Image editing, inpainting, larger resolutions and multiple images per job are not enabled yet.
- Progress is shown as an activity indicator until generation completes because this pipeline's stable Python API does not expose reliable per-step progress.

## Model licence

The model is distributed under the CreativeML Open RAIL-M licence. Review its card and licence before use: https://huggingface.co/OpenVINO/stable-diffusion-v1-5-int8-ov.

## Troubleshooting

- **Cannot connect from Edge:** start ORACLE Creative Studio from the Start Menu and keep the window open. Confirm that no other process is using port 8765.
- **The application does not start:** check whether Windows reports a missing Microsoft Visual C++ runtime DLL. Install the x64 Redistributable from the link above if needed.
- **GPU not listed:** update the Intel Iris Xe driver from your laptop manufacturer or Intel. CPU fallback remains available.
- **Model download interrupted:** press Prepare local engine again. The Hugging Face snapshot download reuses existing cached files.
- **Stop the service:** close its PowerShell window or press Ctrl+C.

The Windows application is built and smoke-tested in GitHub Actions. Actual GPU performance still depends on the target laptop's graphics driver.
