# ORACLE — private browser companion (Google Chrome, Manifest V3)

Everything runs locally. No API keys, no accounts, no server, no analytics.
ORACLE combines deterministic page tools with optional **on-device AI reasoning**. When supported, Chrome’s built-in Gemini Nano model can answer open-ended questions without a paid API key or external AI server. Summaries, fact extraction, study tools and dictionary lookups continue to use ORACLE’s local processing. The define feature includes **784 bundled offline English entries**, your own Vault definitions, and optional Open English Wordnet lookups. Online results are cached locally for later offline use.

## Install (Google Chrome)
1. Unzip `ORACLE.zip`.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and choose the `ORACLE` folder (the one containing `manifest.json`).
4. Pin the ORACLE icon. Reload any tabs that were already open (or just click the icon: ORACLE can inject itself into the tab you're on).

## Using it
| What | How |
|---|---|
| Popup chat + quick actions | Click the icon, or `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac) |
| Command palette on any page | `Ctrl+Shift+K` (`Cmd+Shift+K`). Also `Ctrl+K` inside the dashboard |
| Selected-text assistant | Highlight text on a page, then click the glowing ORACLE button |
| Full dashboard | Popup → **Dashboard** |
| Offline dictionary | Dashboard → **Text assistant** → enter a word, or ask `Define <word>` in chat |
| Local AI reasoning | Dashboard → **Settings** → **Local AI reasoning** → Download & enable local AI; then ask open-ended questions in Chat |
| Change shortcuts | `chrome://extensions/shortcuts` |

Chat commands: "Summarise this page", "Give me a detailed summary", "What are the main points?", "Explain that more simply",
"Turn this into revision notes", "Find the important dates", "Create flashcards", "Quiz me", "Define <word>",
"Find <text> on this page", "Show page overview", "How long to read this?", "List the links", "Show my tabs",
"Save this page", "Search my vault for <topic>". Any other question about the page returns the best-matching passages.

## Permissions (and why)
- `storage` – chat, vault, bookmarks, settings in `chrome.storage.local` (this device only)
- `tabs` – list/search/switch/close tabs, find duplicates
- `https://en-word.net/*` – optional word-only dictionary lookup when a word is not in the bundled glossary; successful results are cached locally. No page text is sent.\n- `activeTab`, `scripting` – read a tab that was open before install, when you click the icon
- Content script on `http/https` pages – read page text, selection button, highlighting. Browsers show this as "read data on all websites"; ORACLE never sends it anywhere.
- The extension's Content Security Policy sets `connect-src 'none'`, so its own pages cannot make network requests.

## Local AI setup
The optional Local AI feature uses Chrome’s built-in Prompt API and Gemini Nano. It is available in supported versions of **Google Chrome** (Chrome 138+ for extension use), not supported in Edge or other Chromium browsers. Open Dashboard → Settings → Local AI reasoning and click **Download & enable local AI**. Chrome downloads its model the first time; after setup, prompts run on-device and do not need a network connection or paid API key. The model has hardware and storage requirements; see [Chrome’s current requirements](https://developer.chrome.com/docs/ai/prompt-api). It can reason and explain from its learned knowledge, but it can still make mistakes and does not know live/current facts unless you provide them. If Local AI is unavailable, ORACLE falls back to its existing tools.

## Honest limitations
- **Definitions** use your Vault entries first, then the bundled 784-entry offline glossary, then an optional Open English Wordnet lookup. Wordnet results are cached locally (up to 500 words) and remain available offline after the first successful lookup. The external source is not exhaustive: slang, new terms, many proper names and specialist terms may still be missing. Only the requested word is sent to en-word.net; page contents are never sent. Open English Wordnet is derived from Princeton WordNet and distributed by its community under CC BY 4.0; attribution is due to both sources.
- **Translation** (Spanish/French/German) is a ~80-word glossary, word by word. It ignores grammar.
- **Fact extraction** lists dates, figures, possible names and claims *as written on the page*; nothing is verified. Local AI answers can also be wrong and are not a substitute for checking important claims.
- **Names** are detected from capitalisation and can include false positives.
- Browser pages (`chrome://`, the Web Store, built-in PDF viewer) can't be read by any extension.
- Highlighting "important passages" only marks sentences that sit inside a single text node.

## Files
`CHANGELOG.md` · `manifest.json` · `background.js` (shortcut + dashboard opener) · `content.js` (extraction, selection helper, reader, find/highlight, palette) ·
`dictionary.js` (offline English definitions) · `local-ai.js` (Chrome on-device model adapter) · `engine.js` (NLP + intent router) · `tools.js` (tabs/messaging/compare) · `chat.js` · `palette.js` · `orb.js` ·
`popup.*` · `dashboard.*` · `common.css` · `assets/` (icons)


## Page access troubleshooting (v1.0.2)
ORACLE first asks its content script for readable page blocks. If that response is empty or incomplete, it now retries with a direct local DOM extractor. The fallback also reads visible text from modern pages that use custom div-based layouts rather than standard paragraphs. Browser-internal pages, extension stores and PDF viewer tabs remain restricted by Chrome.


## Visual refresh (v1.0.3)
The dashboard, navigation, chat, text assistant, Knowledge Vault, browser tools, Settings and toolbar popup use a unified visual system. The redesign is presentation-only and retains the existing feature workflows and local-only processing.
