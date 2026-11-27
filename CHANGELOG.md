# ORACLE 1.4.1

- Added a futuristic electric aura and animated lightning arcs to the shared ORACLE orb while it is processing, analysing or responding.
- Added a compact chat thinking indicator that switches between THINKING and ANALYSING PAGE.
- Respects the system and ORACLE reduced-motion settings.

# ORACLE 1.4.0

- Routed page-analysis formats through local Qwen: quick and detailed analysis, key points, plain-language explanations, revision notes, fact analysis, flashcards and quizzes are now generated and reasoned about by the model instead of extractive sentence selection.
- Routed chat requests, selected-text actions, text assistant tasks, contextual definitions, translations and page summaries saved to the Knowledge Vault through local Qwen.
- Added task-specific prompts that request explanations, evidence, relationships, implications and limitations instead of simply repeating source text.
- Added AI-powered website overviews, contextual keyword/theme analysis and in-depth comparison of two open pages.
- Serialized inference requests through the shared offscreen runtime so chat, dashboard and page selection use one Qwen worker safely.
- Added structured AI output for interactive flashcards and multiple-choice quizzes, with readable-response fallback if the model returns malformed structured output.
- Moved WebLLM into one shared hidden offscreen document. Popup, dashboard and in-page tools use the same model worker, avoiding duplicate model sessions and visible helper tabs.
- Added the offscreen permission and build verification for the shared runtime. Dictionary retrieval, page extraction, reading statistics, links, find/highlight and tab operations remain deterministic local tools.

# ORACLE 1.3.0

- Expanded the offline English dictionary with Open English WordNet 2025+ (over 150,000 lexical forms and multiple senses per word).
- Added verified build-time dataset download and compact gzip alphabet shards, loaded on demand so ordinary pages do not parse the full dictionary.
- Added attribution and Princeton WordNet licence notices, and updated dictionary search and chat fallbacks.

# ORACLE 1.2.0

- Upgraded Local AI to Qwen 2.5 1.5B Instruct q4f32 with a 2K context and a longer response budget.
- Added model specifications and first-run status messaging to Settings.
- Added private local Knowledge Vault retrieval so Qwen can ground responses in your own saved notes.
- Refreshed the dashboard, chat, settings cards, navigation, popup and controls with a shared visual theme.

# ORACLE 1.1.0

- Replaced the Chrome-only Prompt API/Gemini Nano adapter with WebLLM, a shared Chromium implementation using WebGPU.
- Added a dedicated Web Worker so model loading and inference do not block the popup or dashboard UI.
- Added the Qwen 2.5 0.5B quantised model, first-run download progress, GPU availability checks, local model caching and clear unsupported-device errors.
- Added a reproducible Parcel build, build verification, and a GitHub Actions artifact containing a ready-to-install extension for Edge and Chrome.
- Updated model download permissions and extension CSP for the Hugging Face/MLC model files and WebAssembly runtime.
- Updated Edge/Chrome installation and privacy documentation. Page content and prompts remain local during inference; only model files are downloaded.

# ORACLE 1.0.6

- Restored the Chrome-only Local AI adapter using Chrome's built-in Prompt API and Gemini Nano.
- Removed Edge-specific AI setup and browser guidance; the extension is documented for Google Chrome again.

# ORACLE 1.0.3\n\n- Added optional Open English Wordnet fallback for words missing from the bundled glossary. Successful definitions are cached locally for offline reuse; only the requested word is sent to the dictionary service.\n

- Improved offline definitions with broader inflection handling (including common plural, past-tense and comparative forms) and local spelling suggestions for likely typos.

- Redesigned the full dashboard with a unified dark interface, clearer typography, structured navigation, consistent cards, improved forms and responsive layouts.
- Refined the popup with a compact brand header, clearer quick actions, improved chat surface and matching controls.
- Reorganised Settings into visual groups for appearance, shortcuts, privacy, permissions and local data management.
- Added a consistent icon treatment and refreshed all extension icon sizes to match the new visual identity.
- Preserved existing interactions, page-analysis behaviour, offline dictionary and local-only data handling.

# ORACLE 1.0.2

- Fixed page analysis so an empty or incomplete content-script response triggers the direct DOM extraction fallback.
- Improved extraction on article pages that render content in custom div-based layouts rather than standard paragraph tags.
- Added a 719-entry offline English glossary, bringing the combined built-in definition set to 784 entries. User-saved Vault definitions continue to take priority.
- Added a dedicated offline dictionary lookup to the dashboard's Text assistant.

Everything remains local to the browser. No dictionary or page content is sent to a server.
