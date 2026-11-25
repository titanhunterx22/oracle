# ORACLE — private browser companion (Chrome & Edge, Manifest V3)

Everything runs locally. No API keys, no accounts, no server, no analytics.
ORACLE is a **rule-based toolkit, not an AI language model**: summaries are extracted sentences,
"simplify" is word-swapping and sentence-splitting, and translation is a small word-by-word glossary. The define feature includes **784 offline English entries** plus definitions you save in your own Vault.

## Install (Chrome or Edge)
1. Unzip `ORACLE.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and switch on **Developer mode**.
3. Click **Load unpacked** and choose the `ORACLE` folder (the one containing `manifest.json`).
4. Pin the ORACLE icon. Reload any tabs that were already open (or just click the icon: ORACLE can inject itself into the tab you're on).

## Using it
| What | How |
|---|---|
| Popup chat + quick actions | Click the icon, or `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac) |
| Command palette on any page | `Ctrl+Shift+K` (`Cmd+Shift+K`). Also `Ctrl+K` inside the dashboard |
| Selected-text assistant | Highlight text on a page, then click the glowing ORACLE button |
| Full dashboard | Popup → **Dashboard** |
| Offline dictionary | Dashboard → **Text assistant** → enter a word in Offline English Dictionary, or ask `Define <word>` in chat |
| Change shortcuts | `chrome://extensions/shortcuts` (Edge: `edge://extensions/shortcuts`) |

Chat commands: "Summarise this page", "Give me a detailed summary", "What are the main points?", "Explain that more simply",
"Turn this into revision notes", "Find the important dates", "Create flashcards", "Quiz me", "Define <word>",
"Find <text> on this page", "Show page overview", "How long to read this?", "List the links", "Show my tabs",
"Save this page", "Search my vault for <topic>". Any other question about the page returns the best-matching passages.

## Permissions (and why)
- `storage` – chat, vault, bookmarks, settings in `chrome.storage.local` (this device only)
- `tabs` – list/search/switch/close tabs, find duplicates
- `activeTab`, `scripting` – read a tab that was open before install, when you click the icon
- Content script on `http/https` pages – read page text, selection button, highlighting. Browsers show this as "read data on all websites"; ORACLE never sends it anywhere.
- The extension's Content Security Policy sets `connect-src 'none'`, so its own pages cannot make network requests.

## Honest limitations
- **Definitions** come from a bundled offline English glossary (784 entries), your own Vault "definition" entries, and the page itself. Unknown words get word-part hints, not invented meanings. The glossary is curated rather than exhaustive; it does not claim to define every English word.
- **Translation** (Spanish/French/German) is a ~80-word glossary, word by word. It ignores grammar.
- **Fact extraction** lists dates, figures, possible names and claims *as written on the page*; nothing is verified.
- **Names** are detected from capitalisation and can include false positives.
- Browser pages (`chrome://`, the Web Store, built-in PDF viewer) can't be read by any extension.
- Highlighting "important passages" only marks sentences that sit inside a single text node.

## Files
`CHANGELOG.md` · `manifest.json` · `background.js` (shortcut + dashboard opener) · `content.js` (extraction, selection helper, reader, find/highlight, palette) ·
`dictionary.js` (offline English definitions) · `engine.js` (NLP + intent router) · `storage.js` · `tools.js` (tabs/messaging/compare) · `chat.js` · `palette.js` · `orb.js` ·
`popup.*` · `dashboard.*` · `common.css` · `assets/` (icons)


## Page access troubleshooting (v1.0.2)
ORACLE first asks its content script for readable page blocks. If that response is empty or incomplete, it now retries with a direct local DOM extractor. The fallback also reads visible text from modern pages that use custom div-based layouts rather than standard paragraphs. Browser-internal pages, extension stores and PDF viewer tabs remain restricted by Chrome/Edge.


## Visual refresh (v1.0.3)
The dashboard, navigation, chat, text assistant, Knowledge Vault, browser tools, Settings and toolbar popup use a unified visual system. The redesign is presentation-only and retains the existing feature workflows and local-only processing.
