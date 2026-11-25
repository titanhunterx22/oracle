/* ORACLE browser tools for extension pages (popup & dashboard): tabs, messaging, comparison, bookmarks. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});
  const FILES = ['dictionary.js', 'engine.js', 'storage.js', 'palette.js', 'content.js'];
  const isWeb = u => /^https?:/i.test(u || '');
  const NOREAD = 'This page cannot be read by browser extensions. Try a normal HTTP/HTTPS webpage and click ORACLE while that page is active.';
  // Self-contained fallback: runs locally in the target page when its content script is unavailable.
  function directExtract() {
    const clean = s => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const skip = 'nav,header,footer,aside,script,style,noscript,form,iframe,svg,canvas,button,select,textarea,input,[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[aria-hidden=true],[class*=cookie],[id*=cookie],[class*=advert],[class*=newsletter],[class*=sidebar],[class*=breadcrumb],[class*=share-],oracle-root,oracle-reader';
    const visible = el => {
      if (!el || !el.getClientRects || !el.getClientRects().length) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const rootScore = el => {
      const raw = clean(el.innerText || el.textContent);
      const links = [...el.querySelectorAll('a')].reduce((n, a) => n + clean(a.innerText || a.textContent).length, 0);
      const blocks = el.querySelectorAll('p,li,blockquote').length;
      return raw.length - links * 0.75 + Math.min(blocks, 40) * 18;
    };
    const roots = [...document.querySelectorAll('article,main,[role=main]')].filter(visible)
      .map(el => ({ el, score: rootScore(el), length: clean(el.innerText || el.textContent).length }))
      .filter(x => x.length > 120).sort((a, b) => b.score - a.score);
    let root = roots.length ? roots[0].el : document.body;

    const collect = base => {
      const blocks = []; let chars = 0, last = '';
      base.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],p,li,blockquote,pre').forEach(el => {
        if (chars > 150000 || blocks.length > 1500 || !visible(el) || el.closest(skip)) return;
        const tag = el.tagName.toLowerCase();
        if ((tag === 'li' || tag === 'blockquote') && el.querySelector('p')) return;
        const text = clean(el.innerText || el.textContent);
        if (!text || text === last || (tag[0] !== 'h' && tag !== 'div' && text.length < 24) || (tag[0] === 'h' && text.length > 220)) return;
        let linkChars = 0;
        el.querySelectorAll('a').forEach(a => { linkChars += clean(a.innerText || a.textContent).length; });
        if (text.length > 0 && linkChars / text.length > 0.7) return;
        last = text; chars += text.length;
        const heading = tag[0] === 'h' || el.getAttribute('role') === 'heading';
        blocks.push({ t: heading ? (tag[0] === 'h' ? tag : 'h2') : tag === 'blockquote' ? 'q' : 'p', text });
      });
      return { blocks, chars };
    };

    let { blocks, chars } = collect(root);
    // Many modern sites render articles using nested divs or custom web components.
    // If semantic paragraph extraction is sparse, fall back to the visible text layout.
    if (chars < 160) {
      let raw = clean(root.innerText || root.textContent);
      if (raw.length < 120 && root !== document.body) raw = clean(document.body && document.body.innerText);
      let lines = (root.innerText || '').split(/\n+/).map(clean).filter(x => x.length >= 28);
      if (lines.length < 2 && raw.length >= 80) lines = (raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw]).map(clean).filter(x => x.length >= 28);
      if (lines.length < 2 && document.body) {
        const bodyText = (document.body.innerText || '').split(/\n+/).map(clean).filter(x => x.length >= 28);
        if (bodyText.join(' ').length > lines.join(' ').length) lines = bodyText;
      }
      if (lines.length) {
        blocks = lines.slice(0, 1500).map(text => ({ t: 'p', text: text.slice(0, 1800) }));
        chars = blocks.reduce((n, b) => n + b.text.length, 0);
      } else if (raw.length >= 80) {
        blocks = [{ t: 'p', text: raw.slice(0, 150000) }];
        chars = blocks[0].text.length;
      }
    }
    if (!blocks.length && document.body) {
      const raw = clean(document.body.innerText || document.body.textContent);
      if (raw.length > 80) blocks = [{ t: 'p', text: raw.slice(0, 150000) }];
    }

    const links = [], seen = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      if (links.length >= 500 || !/^https?:/i.test(a.href) || seen.has(a.href)) return;
      seen.add(a.href); let external = false;
      try { external = new URL(a.href).hostname !== location.hostname; } catch (_) { /* ignore */ }
      links.push({ text: clean(a.innerText || a.textContent).slice(0, 100) || a.href, href: a.href, external });
    });
    const text = blocks.map(b => b.text).join('\n');
    return {
      title: clean(document.title) || location.hostname,
      url: location.href,
      domain: location.hostname.replace(/^www\./, ''),
      lang: document.documentElement.lang || '',
      blocks, links, text,
      wordCount: (text.match(/[\p{L}\p{N}]+/gu) || []).length
    };
  }

  const T = {
    isWeb,
    async targetTab(pref) {
      if (pref) { try { const t = await chrome.tabs.get(+pref); if (isWeb(t.url)) return t; } catch (e) { /* closed */ } }
      const [a] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (a && isWeb(a.url)) return a;
      const all = (await chrome.tabs.query({})).filter(t => isWeb(t.url)).sort((x, y) => (y.lastAccessed || 0) - (x.lastAccessed || 0));
      return all[0] || null;
    },
    async send(tabId, msg) {
      try { return await chrome.tabs.sendMessage(tabId, msg); }
      catch (e) {
        try { await chrome.scripting.executeScript({ target: { tabId }, files: FILES }); return await chrome.tabs.sendMessage(tabId, msg); }
        catch (e2) { throw new Error(NOREAD); }
      }
    },
    async extract(tabId) {
      const readable = doc => !!(doc && typeof doc.text === 'string' && doc.text.trim().length >= 40);
      let firstError = null;
      try {
        const r = await T.send(tabId, { type: 'oracle:extract' });
        if (r && r.ok && readable(r.doc)) return r.doc;
        firstError = new Error((r && r.error) || 'The page reader returned an empty document.');
      } catch (e) { firstError = e; }

      // Always try direct DOM extraction when the content script returns no usable text,
      // not only when message delivery throws. This was the source of the empty-response bug.
      try {
        const injected = await chrome.scripting.executeScript({ target: { tabId }, func: directExtract });
        const doc = injected && injected[0] && injected[0].result;
        if (readable(doc)) return doc;
        throw new Error('The page opened, but the fallback reader found less than 40 characters of readable text.');
      } catch (second) {
        const detail = (second && second.message) || (firstError && firstError.message) || 'Unknown browser error';
        if (/cannot access|permission|not allowed|cannot be scripted|extensions gallery|chrome web store|pdf|chrome:\/\/|edge:\/\//i.test(detail)) {
          throw new Error(NOREAD + ' Browser detail: ' + detail);
        }
        throw new Error('ORACLE could not extract enough readable text from this page. Try reloading it, then run the analysis again. Browser detail: ' + detail);
      }
    },
    async selection(tabId) { const r = await T.send(tabId, { type: 'oracle:selection' }); return (r && r.text) || ''; },
    async pageTabs() { return (await chrome.tabs.query({})).filter(t => isWeb(t.url)); },
    normUrl(u) { try { const x = new URL(u); x.hash = ''; ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(p => x.searchParams.delete(p)); return (x.origin + x.pathname.replace(/\/$/, '') + x.search).toLowerCase(); } catch (e) { return u; } },
    async tabsSummary() {
      const tabs = (await chrome.tabs.query({})).filter(t => isWeb(t.url));
      const by = new Map(); tabs.forEach(t => { const k = T.normUrl(t.url); (by.get(k) || by.set(k, []).get(k)).push(t); });
      return { tabs, duplicates: [...by.values()].filter(a => a.length > 1) };
    },
    async switchTo(tab) { await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); },
    closeTabs: ids => chrome.tabs.remove(ids),
    async compare(idA, idB) {
      if (idA === idB) throw new Error('Pick two different tabs.');
      const [a, b] = await Promise.all([T.extract(idA), T.extract(idB)]);
      return O.engine.compare(a, b);
    },
    async bookmarkPage(tabId, category) {
      const t = await chrome.tabs.get(tabId);
      return O.store.addBookmark({ title: t.title || t.url, url: t.url, category });
    },
    openDashboard: async (hash) => {
      const t = await T.targetTab();
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + (t ? '?tab=' + t.id : '') + (hash || '#chat') });
    }
  };
  O.tools = T;
})(typeof self !== 'undefined' ? self : globalThis);
