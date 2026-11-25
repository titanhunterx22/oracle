/* ORACLE storage — everything lives in chrome.storage.local on this device. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});
  const area = () => chrome.storage.local;
  const get = async (k, d) => { const r = await area().get(k); return r[k] === undefined ? d : r[k]; };
  const set = (k, v) => area().set({ [k]: v });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const DEFAULTS = { readerSize: 19, particles: true, typing: true, reduceMotion: false };
  const DEF_COLLECTIONS = ['General', 'Study', 'Research'];
  const DEF_CATEGORIES = ['Read later', 'Reference', 'Work', 'Learning'];

  O.store = {
    get, set, uid,
    async settings() { return Object.assign({}, DEFAULTS, await get('settings', {})); },
    async saveSettings(p) { const s = await this.settings(); await set('settings', Object.assign(s, p)); },

    // conversation
    conversation: () => get('conversation', []),
    async pushMessage(m) { const c = await get('conversation', []); c.push(m); await set('conversation', c.slice(-200)); },
    clearConversation: () => set('conversation', []),

    // vault
    vault: () => get('vault', []),
    async addVault(e) {
      const v = await get('vault', []);
      const entry = Object.assign({ id: uid(), type: 'note', title: 'Untitled', text: '', url: '', collection: 'General', created: Date.now() }, e);
      v.unshift(entry); await set('vault', v); return entry;
    },
    async removeVault(id) { await set('vault', (await get('vault', [])).filter(e => e.id !== id)); },
    async searchVault(q, collection, type) {
      let v = await get('vault', []);
      if (collection && collection !== 'all') v = v.filter(e => e.collection === collection);
      if (type && type !== 'all') v = v.filter(e => e.type === type);
      const terms = (q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return v;
      return v.map(e => {
        const t = e.title.toLowerCase(), x = (e.text || '').toLowerCase();
        let s = 0;
        for (const w of terms) { if (t.includes(w)) s += 3; if (x.includes(w)) s += 1; if (!t.includes(w) && !x.includes(w)) return null; }
        return { e, s };
      }).filter(Boolean).sort((a, b) => b.s - a.s).map(r => r.e);
    },
    collections: () => get('collections', DEF_COLLECTIONS),
    async addCollection(name) {
      name = (name || '').trim(); if (!name) return;
      const c = await get('collections', DEF_COLLECTIONS);
      if (!c.some(x => x.toLowerCase() === name.toLowerCase())) { c.push(name); await set('collections', c); }
    },
    async removeCollection(name) {
      if (name === 'General') return;
      await set('collections', (await get('collections', DEF_COLLECTIONS)).filter(c => c !== name));
      await set('vault', (await get('vault', [])).map(e => e.collection === name ? Object.assign(e, { collection: 'General' }) : e));
    },

    // bookmarks
    bookmarks: () => get('bookmarks', []),
    categories: () => get('categories', DEF_CATEGORIES),
    async addCategory(n) { n = (n || '').trim(); if (!n) return; const c = await get('categories', DEF_CATEGORIES); if (!c.includes(n)) { c.push(n); await set('categories', c); } },
    async addBookmark(b) {
      const all = await get('bookmarks', []);
      const ex = all.find(x => x.url === b.url);
      if (ex) { ex.category = b.category || ex.category; ex.title = b.title || ex.title; await set('bookmarks', all); return ex; }
      const entry = Object.assign({ id: uid(), created: Date.now(), category: 'Reference' }, b);
      all.unshift(entry); await set('bookmarks', all); return entry;
    },
    async removeBookmark(id) { await set('bookmarks', (await get('bookmarks', [])).filter(b => b.id !== id)); },

    async exportAll() { return JSON.stringify({ exported: new Date().toISOString(), vault: await get('vault', []), collections: await get('collections', DEF_COLLECTIONS), bookmarks: await get('bookmarks', []) }, null, 2); },
    clearAll: () => area().clear()
  };
})(typeof self !== 'undefined' ? self : globalThis);
