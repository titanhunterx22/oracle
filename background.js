/* ORACLE background service worker: keyboard commands and opening the dashboard. Makes no network requests. */
const DASH = chrome.runtime.getURL('dashboard.html');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'open-palette') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.tabs.sendMessage(tab.id, { type: 'oracle:palette' }); }
  catch (e) { chrome.tabs.create({ url: DASH + '#chat' }); } // browser pages can't run content scripts
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'oracle:openDashboard') chrome.tabs.create({ url: DASH + (msg.hash || '#chat') });
});

chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') chrome.tabs.create({ url: DASH + '#welcome' });
});


/* Optional Open English Wordnet lookup. Only the requested word is sent.
   Successful results are cached locally so they remain available offline. */
const ORACLE_WORDNET_CACHE = 'oracle_wordnet_cache_v1';
function oracleExtractGlosses(value, out, seen) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) { value.forEach(v => oracleExtractGlosses(v, out, seen)); return; }
  const definition = value.definition || value.gloss || value.description;
  if (typeof definition === 'string' && definition.trim()) {
    const pos = value.partOfSpeech || value.pos || value.category || '';
    const examples = Array.isArray(value.examples) ? value.examples : (value.example ? [value.example] : []);
    const cleanExamples = examples.map(x => typeof x === 'string' ? x : (x && (x.text || x.example) || '')).filter(Boolean).slice(0, 2);
    const item = { pos: String(pos), definition: definition.trim(), examples: cleanExamples };
    if (!out.some(x => x.definition === item.definition)) out.push(item);
  }
  Object.values(value).forEach(v => oracleExtractGlosses(v, out, seen));
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'oracle:dictionaryLookup') return;
  const word = String(msg.word || '').toLowerCase().trim();
  if (!/^[a-z][a-z'’-]{0,59}$/.test(word)) { sendResponse({ ok: false }); return; }
  (async () => {
    const stored = await chrome.storage.local.get(ORACLE_WORDNET_CACHE);
    const cache = stored[ORACLE_WORDNET_CACHE] || {};
    if (cache[word] && cache[word].savedAt && Date.now() - cache[word].savedAt < 1000 * 60 * 60 * 24 * 180) {
      return { ok: true, cached: true, word, senses: cache[word].senses };
    }
    const response = await fetch('https://en-word.net/api/lemma/' + encodeURIComponent(word), {
      headers: { Accept: 'application/json' }, cache: 'no-store'
    });
    if (!response.ok) throw new Error('Dictionary service returned HTTP ' + response.status);
    const data = await response.json();
    const senses = [];
    oracleExtractGlosses(data, senses, new WeakSet());
    if (!senses.length) return { ok: false, unavailable: true };
    cache[word] = { savedAt: Date.now(), senses: senses.slice(0, 12) };
    const entries = Object.entries(cache).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 1500);
    await chrome.storage.local.set({ [ORACLE_WORDNET_CACHE]: Object.fromEntries(entries) });
    return { ok: true, cached: false, word, senses: cache[word].senses };
  })().then(sendResponse).catch(() => sendResponse({ ok: false, unavailable: true }));
  return true;
});
