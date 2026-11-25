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
