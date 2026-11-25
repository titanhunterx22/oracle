# Install ORACLE in Microsoft Edge

ORACLE uses the same Manifest V3 build in Microsoft Edge and Google Chrome. The optional Local AI feature uses WebLLM with WebGPU; it does **not** use Chrome's Prompt API, Edge-specific AI APIs, or experimental browser flags.

## Install the ready-built extension

1. Open the [ORACLE GitHub Actions page](https://github.com/titanhunterx22/oracle/actions).
2. Open the latest successful **Build ORACLE extension** run.
3. Under **Artifacts**, download **ORACLE-browser-extension** and extract the ZIP.
4. In Edge, open `edge://extensions` and switch on **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder that directly contains `manifest.json`.
6. Pin ORACLE to the toolbar. Reload any tabs that were already open.

The artifact contains the bundled WebLLM runtime and worker. You do not need Node.js to install the artifact.

## Prepare local AI once

1. Open the ORACLE popup and select **Dashboard**.
2. Open **Settings** → **Local AI reasoning**.
3. Select **Download & prepare model**. Keep the dashboard open while the model and GPU runtime are prepared.
4. When the status reports that Local AI is ready, return to **Chat** and ask an open-ended question.

ORACLE uses `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`. The model files are downloaded from Hugging Face/MLC on first setup and cached by WebLLM in the browser. Inference happens in a dedicated Web Worker using WebGPU. Prompts, selected text, webpage context and answers are not sent to an AI server. Browser storage can be cleared or evicted, in which case the model may need to be downloaded again.

The model is deliberately small, so it is less capable than a large cloud model. It can still make mistakes. It has no live internet access. Use ORACLE's existing page tools for deterministic summaries, facts, tabs, dictionary and study workflows.

## WebGPU troubleshooting

- Update Edge to its latest stable version and restart it.
- Open `edge://gpu` and check the Graphics Feature Status for WebGPU. Check that **Use graphics acceleration when available** is enabled in Edge settings, then restart Edge.
- Update the graphics driver from your computer or GPU manufacturer.
- Close GPU-heavy applications and retry if model initialisation fails because of insufficient GPU memory.
- If ORACLE reports that no GPU adapter is available, the deterministic page tools remain available; local AI cannot run on that device/browser configuration yet.
- No experimental flags should be needed. Do not enable unrelated flags to try to force support.

## Update ORACLE

Download the newest **ORACLE-browser-extension** artifact, extract it over a new folder, then visit `edge://extensions` and press the extension's **Reload** button after selecting the new unpacked folder. Keep the same folder path between updates where practical so the extension ID and its local model cache remain stable.

## Build from source

Requires Node.js 22 or newer:

```bash
npm install
npm run build:check
```

Load the generated `dist` folder through `edge://extensions` → **Load unpacked**. The source includes the WebLLM client and worker entry points; Parcel bundles them for Manifest V3 before installation.
