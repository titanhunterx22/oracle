# ORACLE — private Chromium browser companion

ORACLE is a Manifest V3 extension for **Microsoft Edge and Google Chrome**. It uses **Qwen 2.5 1.5B Instruct running locally with WebLLM + WebGPU** for page analysis, in-depth explanations, summaries, fact analysis, revision notes, flashcards, quizzes, definitions, selected-text tools and open-ended chat. Its Smart Tab Manager groups tabs by topic or website, detects duplicate pages, filters and sorts open tabs, and saves/restores local browser workspaces. The offline dictionary and exact browser operations remain local data tools. There are no paid API keys, accounts, analytics or ORACLE AI servers.

## Install the ready-built extension (recommended)

1. Open the [ORACLE GitHub Actions page](https://github.com/titanhunterx22/oracle/actions).
2. Open the latest successful **Build ORACLE extension** workflow run.
3. Under **Artifacts**, download **ORACLE-browser-extension** and extract the ZIP.
4. In Microsoft Edge, open `edge://extensions`; in Google Chrome, open `chrome://extensions`.
5. Turn on **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
6. Pin ORACLE to the toolbar and reload tabs that were already open.

The workflow artifact already contains the bundled WebLLM runtime and worker. Node.js is not required to install it. The separate ORACLE-Creative-Studio-Engine artifact contains an optional Windows companion installer for local image generation.

## Install from source

Requires Node.js 22 or newer. From the repository folder:

```bash
npm install
npm run build:check
``

Then load the generated `dist` folder through `edge://extensions` or `chrome://extensions` → **Load unpacked**. The build uses Parcel's WebExtension configuration to bundle the WebLLM runtime and dedicated worker inside the extension, as required by Manifest V3's extension-page security policy.


### Smart Tab Manager

Open Dashboard → **Browser tools**. Search tab titles and URLs, filter by window, duplicate, pinned or recently used tabs, and sort by recent activity, title, website or window order. ORACLE can group ungrouped tabs into deterministic topic groups or group selected tabs by website. Existing user-created groups and pinned tabs are deliberately left alone by automatic organisation. Individual tabs can be switched to, pinned/unpinned, muted/unmuted, duplicated or closed; selected tabs can be ungrouped or closed.

Save the normal webpages in the current window as a named workspace, then restore it later. Restore opens only pages that are not already present in that window. Workspace names and URLs are saved in `chrome.storage.local` on this device; they are not uploaded or included in AI prompts. Browser tab grouping uses Chromium's built-in Tab Groups API and the `tabGroups` permission. The manager only lists normal HTTP/HTTPS pages; browser-internal and extension pages are intentionally excluded.

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
| Writing assistant | Dashboard → **Writing assistant** |
| Local image generation | Dashboard → **Creative Studio** (requires the separate Windows companion) |
| Smart Tab Manager | Dashboard → **Browser tools** → **Smart tab manager** |

The Writing assistant provides proofread, rewrite, clarity, shorten, expand, continue, email and academic-polish workflows, with tone, audience, format and optional instructions. **Review draft** produces constructive editorial feedback separately from the edited text. Page selections and readable page text can be inserted into the editor. The working draft and editor settings autosave to `chrome.storage.local` on this device. Generated results are shown separately; **Use result as draft** is an explicit action and the previous draft can be restored. Results can be copied or saved to the Knowledge Vault. Drafts and prompts are passed to the existing local Qwen model and are not sent to an ORACLE server.
| Change keyboard shortcuts | `edge://extensions/shortcuts` or `chrome://extensions/shortcuts` |

Example requests: “Give me an in-depth analysis of this page”, “Explain the author’s argument”, “What evidence supports the main claim?”, “Compare these two pages”, “Give me a website overview”, “Find the main themes and keywords”, “Explain this simply”, “Turn this into detailed revision notes”, “Find and explain the important facts”, “Create flashcards”, “Quiz me”, “Explain this word in context”, and “Translate this passage”, or “Proofread this email”. Generated content tasks use Local AI once the model has been prepared. Exact operations such as searching for text, listing links, reading statistics, navigating tabs and retrieving dictionary senses remain deterministic.

## Local AI: WebLLM + Qwen 2.5 1.5B Instruct

ORACLE runs one shared WebLLM runtime in a hidden extension document and performs inference in a **dedicated Web Worker** using WebGPU. The popup, dashboard and in-page selection assistant all send requests to this same model worker, rather than loading separate copies. It uses `Qwen2.5-1.5B-Instruct-q4f32_1-MLC`, configured with a 2,048-token context and up to 448 generated tokens for longer analysis tasks. WebLLM estimates about 1.8 GB of VRAM for this model. The q4f32 variant is selected for broad GPU compatibility; actual speed and stability depend on the browser, graphics driver and available shared memory.

On first setup, open Dashboard → Settings → Local AI reasoning and select **Download & prepare model**. An internet connection is needed to download the model files from Hugging Face/MLC. WebLLM caches the model locally; later sessions can load the cached model without downloading it again unless browser storage is cleared or evicted. Generation itself happens locally. When relevant, ORACLE can also retrieve up to two matching notes from your local Knowledge Vault and include them as private context. ORACLE does not send prompts, saved notes, selected text, webpage content or answers to an AI server.

A compatible WebGPU browser, GPU/driver and sufficient graphics memory are required. Use a current stable release of Edge or Chrome. No experimental browser flags or paid API keys are required. In Edge, `edge://gpu` can help diagnose WebGPU support; also check that hardware acceleration is enabled and the graphics driver is current. If no compatible GPU adapter is available, Local AI is disabled and ORACLE's other tools remain available.

The model has no live internet access. Do not rely on it for live/current facts, and check important answers independently.

## Permissions and privacy

- `storage` — chat, vault, bookmarks, settings and local-model setup information.
- `offscreen` — hosts one hidden extension document so page tools and dashboard share the same WebGPU model without opening a tab.
- `tabs` — list, search, switch and close tabs.
- `activeTab`, `scripting` — read the active page when you invoke ORACLE.
- Content script on HTTP/HTTPS pages — page extraction, selection helper, highlighting and the command palette.
- `http://127.0.0.1:8765/*` — narrowly scoped connection from the extension dashboard to the optional local OpenVINO image companion.
- `https://en-word.net/*` — optional word-only dictionary lookup when a term is not in the bundled glossary; only the requested word is sent and successful results are cached.
- Hugging Face/MLC model hosts — download model weights and the WebGPU model library during setup. These hosts are not used to send user prompts or page content.

The extension CSP allows only packaged scripts/WebAssembly and the specific model-download origins. ORACLE has no application backend, accounts, telemetry or paid AI API. The optional image companion is a separate process on this computer, bound only to loopback; its model files and image gallery are stored locally.

### Local image generation — Creative Studio

Creative Studio runs the OpenVINO GenAI image engine in a separate, self-contained Windows application. The downloadable companion includes its own private Python runtime, OpenVINO libraries and required packages; **you do not need to install Python or pip**. Download and extract the latest **ORACLE-Creative-Studio-Engine** artifact from GitHub Actions, then double-click Install-ORACLE-Creative-Studio.bat. Start **ORACLE Creative Studio** from the Windows Start Menu and keep its window open. In Edge, open Dashboard → Creative Studio → **Prepare local engine** to download the separate 2.3 GB Stable Diffusion 1.5 INT8 model. Generation is local after the model download. The companion targets Intel GPU acceleration with CPU fallback, starts only on 127.0.0.1:8765 and accepts requests only from the ORACLE extension. See [EDGE_SETUP.md](EDGE_SETUP.md) and [companion/image-engine/README.md](companion/image-engine/README.md).

## Honest limitations

- Creative Studio's self-contained companion is a larger download because it bundles its own runtime. The model weights are downloaded separately on first setup and require several gigabytes of free storage. A compatible Intel graphics driver is needed for Iris Xe acceleration; CPU fallback may be slower.
- WebGPU availability depends on browser version, operating system, GPU, drivers and available graphics memory. A WebGPU adapter check does not guarantee every model will initialise successfully.
- Qwen 2.5 1.5B is still a small local model and is less capable than large cloud models. It can hallucinate and has no live web access.
- The expanded offline dictionary packages Open English WordNet 2025+ (161,875 lexical forms across 120,564 synsets in the upstream release; ORACLE's compact build contains 152,459 defined word forms and 212,608 senses) alongside ORACLE's curated learner-friendly glossary. Alphabetic shards are compressed and loaded from the extension only when a word is looked up. It provides multiple WordNet senses, examples and related words, but it is a lexical database rather than a complete general-purpose learner's dictionary; specialist, inflected and newly coined terms may still be missing.
- Translation is generated by the compact local Qwen model; quality and fluency can vary, particularly for long or highly technical passages.
- AI fact analysis extracts and explains information in the supplied page; it does not independently verify the truth of the page’s claims. Qwen 2.5 1.5B is a compact local model, so verify important outputs.
- Browser-internal pages, extension stores and some built-in PDF viewer pages cannot be read by extensions.

## Project files

`local-ai.js` — local inference and task prompts; `local-ai-bridge.js` — shared API for dashboard, popup and content scripts; `ai-offscreen.html` / `ai-offscreen.js` — the single shared hidden AI runtime; `webllm-client.entry.js` and `webllm-worker.entry.js` — WebLLM client/worker build entries; `engine.js` — deterministic NLP and intent router; `chat.js` — shared popup/dashboard chat; `content.js` — page extraction and selection tools; `dictionary.js` — curated offline English glossary; `dictionary-full.js` — lazy WordNet shard loader; `scripts/build_offline_dictionary.py` — verified dataset-to-shard builder; `storage.js` — local persistence; `tools.js` — tabs and page messaging; `dashboard.*` and `popup.*` — user interface.

For detailed Edge-specific install and troubleshooting steps, see [EDGE_SETUP.md](EDGE_SETUP.md). See [CHANGELOG.md](CHANGELOG.md) for release history.
