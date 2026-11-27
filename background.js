/* ORACLE background service worker: keyboard commands and opening the dashboard. Makes no network requests. */
const DASH = chrome.runtime.getURL('dashboard.html');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'open-palette') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.tabs.sendMessage(tab.id, { type: 'oracle:palette' }); }
  catch (e) { chrome.tabs.create({ url: DASH + '#chat' }); } // browser pages can't run content scripts
});

let oracleOffscreenCreating = null;

async function ensureOracleOffscreen() {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== 'function') {
    throw new Error('This Chromium browser does not support the offscreen document needed for shared local AI. Update Edge to a current version.');
  }
  if (typeof chrome.offscreen.hasDocument === 'function' && await chrome.offscreen.hasDocument()) return;
  if (typeof chrome.runtime.getContexts === 'function') {
    const url = chrome.runtime.getURL('ai-offscreen.html');
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (contexts.length) return;
  }
  if (oracleOffscreenCreating) return oracleOffscreenCreating;
  oracleOffscreenCreating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: 'ai-offscreen.html',
        reasons: ['WORKERS', 'LOCAL_STORAGE'],
        justification: 'Run one shared on-device WebGPU language model for ORACLE chat, page analysis and selected-text tools without opening a visible tab.'
      });
    } catch (error) {
      if (typeof chrome.offscreen.hasDocument === 'function' && await chrome.offscreen.hasDocument()) return;
      if (typeof chrome.runtime.getContexts === 'function') {
        const url = chrome.runtime.getURL('ai-offscreen.html');
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
        if (contexts.length) return;
      }
      if (/single offscreen|already exists|only one offscreen|only a single/i.test(error && error.message || '')) return;
      throw error;
    }
  })();
  try { await oracleOffscreenCreating; }
  finally { oracleOffscreenCreating = null; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'oracle:ai:request') return false;
  (async () => {
    await ensureOracleOffscreen();
    const response = await chrome.runtime.sendMessage({
      type: 'oracle:ai:offscreen',
      action: msg.action,
      requestId: msg.requestId,
      question: msg.question,
      task: msg.task,
      options: msg.options || {}
    });
    if (!response) throw new Error('The shared local AI document did not respond. Reload ORACLE and try again.');
    return response;
  })().then(sendResponse).catch(error => sendResponse({
    ok: false,
    error: error && error.message ? error.message : String(error)
  }));
  return true;
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
    cache[word] = { savedAt: Date.now(), senses: senses.slice(0, 5) };
    const entries = Object.entries(cache).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 500);
    await chrome.storage.local.set({ [ORACLE_WORDNET_CACHE]: Object.fromEntries(entries) });
    return { ok: true, cached: false, word, senses: cache[word].senses };
  })().then(sendResponse).catch(async () => {
    try {
      const stored = await chrome.storage.local.get(ORACLE_WORDNET_CACHE);
      const saved = stored[ORACLE_WORDNET_CACHE] || {};
      if (saved[word] && saved[word].senses) return sendResponse({ ok: true, cached: true, stale: true, word, senses: saved[word].senses });
    } catch (_) { /* fall through */ }
    sendResponse({ ok: false, unavailable: true });
  });
  return true;
});
