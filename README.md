# ORACLE — private Chromium browser companion

ORACLE is a Manifest V3 extension for **Microsoft Edge and Google Chrome**. Its page analysis, dictionary, study tools, tab manager and Knowledge Vault run locally. Optional open-ended AI uses **WebLLM + WebGPU** with Qwen 2.5 1.5B Instruct; there are no paid API keys, accounts, analytics or ORACLE AI servers.

## Install the ready-built extension (recommended)

1. Open the [ORACLE GitHub Actions page](https://github.com/titanhunterx22/oracle/actions).
2. Open the latest successful **Build ORACLE extension** workflow run.
3. Under **Artifacts**, download **ORACLE-browser-extension** and extract the ZIP.
4. In Microsoft Edge, open `edge://extensions`; in Google Chrome, open `chrome://extensions`.
5. Turn on **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
6. Pin ORACLE to the toolbar and reload tabs that were already open.

The workflow artifact already contains the bundled WebLLM runtime and worker. Node.js is not required to install it.

## Install from source

Requires Node.js 22 or newer. From the repository folder:

```bash
npm install
npm run build:check
``

Then load the generated `dist` folder through `edge://extensions` or `chrome://extensions` → **Load unpacked**. The build uses Parcel's WebExtension configuration to bundle the WebLLM runtime and dedicated worker inside the extension, as required by Manifest V3's extension-page security policy.

## Expanded offline dictionary

The extension build downloads the official Open English WordNet 2025+ JSON release, verifies its published SHA-256 checksum, and generates compressed alphabet shards under `dist/dictionary-data/`. A network connection is needed when building the extension; dictionary lookups are then fully offline. The source archive is not included in the installed extension.

The expanded data is based on [Open English WordNet 2025+](https://github.com/globalwordnet/english-wordnet), released under CC BY 4.0 with attribution to both the Open English WordNet team and Princeton WordNet. See [DICTIONARY_ATTRIBUTION.md](DICTIONARY_ATTRIBUTION.md).

## Using ORACLE

| Feature | How |
|---|---|
| Popup chat and quick actions | Click the icon, or `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac) |
| Command palette | `Ctrl+Shift+K` (`Cmd+Shift+K` on Mac) |
| Selected-text assistant | Highlight text on a page, then click the ORACLE selection button |
| Full dashboard | Open the popup → **Dashboard** |
| Local AI setup | Dashboard → **Settings** → **Local AI reasoning** → **Download & prepare model** |
| Offline dictionary | Dashboard → **Text assistant**, or ask `Define <word>` |
| Change keyboard shortcuts | `edge://extensions/shortcuts` or `chrome://extensions/shortcuts` |

Example requests: “Summarise this page”, “What are the main points?”, “Explain this simply”, “Find the important dates”, “Create flashcards”, “Quiz me”, “Define photosynthesis”, “Find this phrase on the page”, “Show my tabs”, and “Save this page”. Open-ended questions use Local AI once it has been prepared. Existing deterministic page tools continue to work without WebGPU.

## Local AI: WebLLM + Qwen 2.5 1.5B Instruct

ORACLE bundles the WebLLM JavaScript runtime into the extension and runs inference in a **dedicated Web Worker** using WebGPU. It uses `Qwen2.5-1.5B-Instruct-q4f32_1-MLC`, configured with a 2,048-token context and up to 384 generated tokens. WebLLM estimates about 1.8 GB of VRAM for this model. The q4f32 variant is selected for broad GPU compatibility; actual speed and stability depend on the browser, graphics driver and available shared memory.

On first setup, open Dashboard → Settings → Local AI reasoning and select **Download & prepare model**. An internet connection is needed to download the model files from Hugging Face/MLC. WebLLM caches the model locally; later sessions can load the cached model without downloading it again unless browser storage is cleared or evicted. Generation itself happens locally. When relevant, ORACLE can also retrieve up to two matching notes from your local Knowledge Vault and include them as private context. ORACLE does not send prompts, saved notes, selected text, webpage content or answers to an AI server.

A compatible WebGPU browser, GPU/driver and sufficient graphics memory are required. Use a current stable release of Edge or Chrome. No experimental browser flags or paid API keys are required. In Edge, `edge://gpu` can help diagnose WebGPU support; also check that hardware acceleration is enabled and the graphics driver is current. If no compatible GPU adapter is available, Local AI is disabled and ORACLE's other tools remain available.

The model has no live internet access. Do not rely on it for live/current facts, and check important answers independently.

## Permissions and privacy

- `storage` — chat, vault, bookmarks, settings and the local-model setup marker in browser storage.
- `tabs` — list, search, switch and close tabs.
- `activeTab`, `scripting` — read the active page when you invoke ORACLE.
- Content script on HTTP/HTTPS pages — page extraction, selection helper, highlighting and the command palette.
- `https://en-word.net/*` — optional word-only dictionary lookup when a term is not in the bundled glossary; only the requested word is sent and successful results are cached.
- Hugging Face/MLC model hosts — download model weights and the WebGPU model library during setup. These hosts are not used to send user prompts or page content.

The extension CSP allows only packaged scripts/WebAssembly and the specific model-download origins. ORACLE has no application backend, accounts, telemetry or paid AI API.

## Honest limitations

- WebGPU availability depends on browser version, operating system, GPU, drivers and available graphics memory. A WebGPU adapter check does not guarantee every model will initialise successfully.
- Qwen 2.5 1.5B is still a small local model and is less capable than large cloud models. It can hallucinate and has no live web access.
- The expanded offline dictionary packages Open English WordNet 2025+ (161,875 lexical forms across 120,564 synsets in the upstream release; ORACLE's compact build contains 152,459 defined word forms and 212,608 senses) alongside ORACLE's curated learner-friendly glossary. Alphabetic shards are compressed and loaded from the extension only when a word is looked up. It provides multiple WordNet senses, examples and related words, but it is a lexical database rather than a complete general-purpose learner's dictionary; specialist, inflected and newly coined terms may still be missing.
- Spanish/French/German translation uses a small word-by-word glossary and does not preserve grammar.
- Fact extraction lists information as written on a page; it does not independently verify claims.
- Browser-internal pages, extension stores and some built-in PDF viewer pages cannot be read by extensions.

## Project files

`local-ai.js` — Local AI adapter and UI-facing API; `webllm-client.entry.js` and `webllm-worker.entry.js` — WebLLM client/worker build entries; `engine.js` — deterministic NLP and intent router; `chat.js` — shared popup/dashboard chat; `content.js` — page extraction and selection tools; `dictionary.js` — curated offline English glossary; `dictionary-full.js` — lazy WordNet shard loader; `scripts/build_offline_dictionary.py` — verified dataset-to-shard builder; `storage.js` — local persistence; `tools.js` — tabs and page messaging; `dashboard.*` and `popup.*` — user interface.

For detailed Edge-specific install and troubleshooting steps, see [EDGE_SETUP.md](EDGE_SETUP.md). See [CHANGELOG.md](CHANGELOG.md) for release history.
