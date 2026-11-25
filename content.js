/* ORACLE content script: reads the page locally, selection assistant, reader mode, find & highlight, palette.
   Nothing here talks to the network. */
(function () {
  'use strict';
  if (window.__ORACLE_LOADED) return;
  window.__ORACLE_LOADED = true;
  const O = window.ORACLE, E = O.engine;

  /* ───────── page extraction ───────── */
  const SKIP = 'nav,header,footer,aside,script,style,noscript,form,iframe,svg,canvas,button,select,textarea,input,[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[aria-hidden=true],[class*=cookie],[id*=cookie],[class*=advert],[class*=newsletter],[class*=sidebar],[class*=breadcrumb],[class*=share-],oracle-root,oracle-reader';
  const visible = el => el.getClientRects().length > 0;
  const inSkip = el => { const s = el.closest(SKIP); return !!s && !(s.tagName === 'HEADER' && s.closest('article,main')); };

  function pickRoot() {
    const scores = new Map();
    document.querySelectorAll('p,li,blockquote,pre').forEach(p => {
      if (inSkip(p)) return;
      const t = p.textContent.trim(); if (t.length < 40) return;
      let ld = 0; p.querySelectorAll('a').forEach(a => { ld += a.textContent.length; });
      const sc = t.length * (1 - Math.min(1, ld / t.length));
      let el = p.parentElement, d = 0;
      for (; el && d < 3; el = el.parentElement, d++) scores.set(el, (scores.get(el) || 0) + sc / (d + 1));
    });
    let best = null, max = 0;
    scores.forEach((v, el) => { if (v > max && el !== document.documentElement) { max = v; best = el; } });
    const pre = document.querySelector('article, main, [role=main]');
    if (pre && pre.textContent.length > 400 && (!best || (scores.get(pre) || 0) >= 0.5 * max)) return pre;
    return best || document.body;
  }

  function extract() {
    const root = pickRoot(), blocks = []; let chars = 0, last = '';
    const clean = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],p,li,blockquote,pre').forEach(el => {
      if (chars > 150000 || blocks.length > 1500 || inSkip(el) || !visible(el)) return;
      const tag = el.tagName.toLowerCase();
      if ((tag === 'li' || tag === 'blockquote') && el.querySelector('p')) return;
      if (tag === 'pre' && el.textContent.length > 1500) return;
      const text = clean(el.innerText || el.textContent);
      if (!text || text === last || (tag[0] !== 'h' && text.length < 25) || (tag[0] === 'h' && text.length > 220)) return;
      let linkChars = 0; el.querySelectorAll('a').forEach(a => { linkChars += clean(a.innerText || a.textContent).length; });
      if (text.length && linkChars / text.length > 0.7) return;
      last = text; chars += text.length;
      const heading = tag[0] === 'h' || el.getAttribute('role') === 'heading';
      blocks.push({ t: heading ? (tag[0] === 'h' ? tag : 'h2') : tag === 'blockquote' ? 'q' : tag === 'pre' ? 'p' : tag, text });
    });

    // Some sites put article copy in custom divs instead of paragraphs. Use their visible
    // text as a fallback whenever the semantic extraction did not find enough material.
    if (chars < 160) {
      let raw = clean(root.innerText || root.textContent);
      if (raw.length < 120 && root !== document.body) raw = clean(document.body && document.body.innerText);
      let lines = (root.innerText || '').split(/\n+/).map(clean).filter(line => line.length >= 28);
      if (lines.length < 2 && raw.length >= 80) {
        lines = (O.nlp.sentences(raw).length ? O.nlp.sentences(raw) : [raw]).map(clean).filter(line => line.length >= 28);
      }
      if (lines.length < 2 && document.body) {
        const bodyLines = (document.body.innerText || '').split(/\n+/).map(clean).filter(line => line.length >= 28);
        if (bodyLines.join(' ').length > lines.join(' ').length) lines = bodyLines;
      }
      if (lines.length) {
        blocks.length = 0;
        lines.slice(0, 1500).forEach(text => blocks.push({ t: 'p', text: text.slice(0, 1800) }));
        chars = blocks.reduce((n, block) => n + block.text.length, 0);
      } else if (raw.length >= 80) {
        blocks.length = 0; blocks.push({ t: 'p', text: raw.slice(0, 150000) }); chars = raw.length;
      }
    }

    const seen = new Set(), links = [];
    document.querySelectorAll('a[href]').forEach(a => {
      if (links.length >= 500 || !/^https?:/i.test(a.href) || seen.has(a.href)) return;
      seen.add(a.href);
      let ext = false; try { ext = new URL(a.href).hostname !== location.hostname; } catch (e) { /* ignore */ }
      links.push({ text: clean(a.textContent).slice(0, 100) || new URL(a.href).hostname, href: a.href, external: ext });
    });
    const h1 = document.querySelector('h1');
    const title = (document.title || (h1 && h1.textContent) || location.hostname).trim();
    const text = blocks.map(b => b.text).join('\n');
    return { title, url: location.href, domain: location.hostname.replace(/^www\./, ''), lang: document.documentElement.lang || '', blocks, links, text, wordCount: O.nlp.words(text).length };
  }

  /* ───────── in-page styles for highlights ───────── */
  function pageStyle() {
    if (document.getElementById('oracle-page-style')) return;
    const s = document.createElement('style'); s.id = 'oracle-page-style';
    s.textContent = 'mark.oracle-find{background:#22d3ee55!important;color:inherit!important;border-radius:3px;outline:1px solid #22d3ee}mark.oracle-find.oracle-cur{background:#facc15aa!important;outline:2px solid #f59e0b}mark.oracle-hl{background:rgba(139,92,246,.32)!important;color:inherit!important;border-radius:3px;box-shadow:0 0 0 2px rgba(139,92,246,.16)}';
    document.documentElement.appendChild(s);
  }
  const textNodes = (root, test) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && !/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|MARK)$/.test(n.parentElement.tagName) && !n.parentElement.closest('oracle-root,oracle-reader') && n.parentElement.getClientRects().length && test(n)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const out = []; let n; while ((n = w.nextNode())) out.push(n); return out;
  };
  const unwrap = sel => { document.querySelectorAll(sel).forEach(m => { const p = m.parentNode; if (!p) return; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); }); };
  const wrap = (node, a, b, cls) => { const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b); const m = document.createElement('mark'); m.className = cls; r.surroundContents(m); return m; };

  /* find */
  let finds = [], cur = -1;
  function clearFind() { unwrap('mark.oracle-find'); finds = []; cur = -1; }
  function find(term) {
    clearFind(); pageStyle();
    if (!term || term.trim().length < 2) return { count: 0, index: -1 };
    const re = new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const marks = [];
    for (const node of textNodes(document.body, n => n.nodeValue.length > 1)) {
      const ms = [...node.nodeValue.matchAll(re)]; if (!ms.length) continue;
      for (let i = ms.length - 1; i >= 0 && marks.length < 1000; i--) { try { marks.push(wrap(node, ms[i].index, ms[i].index + ms[i][0].length, 'oracle-find')); } catch (e) { /* skip */ } }
    }
    finds = marks.sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
    if (finds.length) step(1, true);
    return { count: finds.length, index: cur };
  }
  function step(dir, first) {
    if (!finds.length) return { count: 0, index: -1 };
    if (cur >= 0 && finds[cur]) finds[cur].classList.remove('oracle-cur');
    cur = first ? 0 : (cur + dir + finds.length) % finds.length;
    finds[cur].classList.add('oracle-cur'); finds[cur].scrollIntoView && finds[cur].scrollIntoView({ block: 'center', behavior: 'smooth' });
    return { count: finds.length, index: cur };
  }

  /* highlight important passages */
  function highlight(on) {
    unwrap('mark.oracle-hl'); if (!on) return { count: 0 }; pageStyle();
    const root = pickRoot(), body = root.innerText || root.textContent;
    const freq = O.nlp.freqMap(body), title = new Set(O.nlp.words(document.title).filter(w => !O.nlp.STOP.has(w)).map(O.nlp.stem));
    const cand = [];
    for (const node of textNodes(root, n => n.nodeValue.length > 60 && !n.parentElement.closest('a,nav,button,h1,h2,h3,h4,h5,h6,pre,code'))) {
      for (const m of node.nodeValue.matchAll(/[^.!?]+[.!?]+/g)) {
        const s = m[0].trim(); if (s.length < 50 || s.length > 300) continue;
        cand.push({ node, start: m.index + m[0].indexOf(s), end: m.index + m[0].indexOf(s) + s.length, score: O.nlp.scoreSentence(s, freq, title) });
      }
    }
    const pick = cand.sort((a, b) => b.score - a.score).slice(0, Math.min(10, Math.max(3, Math.round(cand.length * 0.06)))).sort((a, b) => b.start - a.start);
    let n = 0; for (const c of pick) { try { wrap(c.node, c.start, c.end, 'oracle-hl'); n++; } catch (e) { /* skip */ } }
    return { count: n };
  }

  /* ───────── shadow-DOM UI host (selection helper + result panel) ───────── */
  const UI_CSS = `
  :host{all:initial}*{box-sizing:border-box}
  .fab{position:fixed;z-index:2147483646;width:34px;height:34px;border-radius:50%;border:1px solid rgba(160,140,255,.6);background:radial-gradient(circle at 35% 30%,#c4b5fd,#6d3df5 55%,#1b1050);box-shadow:0 0 18px rgba(139,92,246,.75);cursor:pointer;animation:pop .18s ease-out;padding:0}
  .fab:hover{box-shadow:0 0 26px rgba(34,211,238,.8)}
  @keyframes pop{from{transform:scale(.4);opacity:0}}
  .panel{position:fixed;right:18px;bottom:18px;z-index:2147483646;width:min(400px,calc(100vw - 36px));max-height:74vh;display:flex;flex-direction:column;background:rgba(10,13,31,.96);color:#e8eaf6;border:1px solid rgba(150,140,255,.32);border-radius:14px;box-shadow:0 18px 70px rgba(80,60,255,.4);font:13.5px/1.5 "Segoe UI Variable","Segoe UI",system-ui,sans-serif;animation:slide .22s ease-out}
  @keyframes slide{from{opacity:0;transform:translateY(14px)}}
  .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(150,140,255,.15)}
  .dot{width:10px;height:10px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 10px #8b5cf6}
  .hd b{letter-spacing:.3em;font-weight:300;font-size:13px}.hd span{flex:1}
  .x{background:none;border:0;color:#8b90b3;font-size:18px;cursor:pointer}
  .bd{padding:10px 12px;overflow:auto}
  .sel{margin:0 0 8px;padding:6px 10px;border-left:3px solid #22d3ee;color:#aab0d4;font-size:12.5px;max-height:70px;overflow:auto}
  .acts{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
  .acts button,.ft button{background:rgba(139,92,246,.16);border:1px solid rgba(150,140,255,.3);color:#dcd8ff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}
  .acts button:hover,.ft button:hover{background:rgba(139,92,246,.4)}
  .out h3,.out h4{margin:.6em 0 .3em;font-size:14px;color:#c4b5fd}.out p{margin:.4em 0}.out ul{margin:.3em 0;padding-left:18px}.out blockquote{margin:.5em 0;padding-left:10px;border-left:2px solid #4f7cff;color:#9aa1c9;font-size:12.5px}
  .out table{border-collapse:collapse;font-size:12px}.out td,.out th{border:1px solid rgba(150,140,255,.2);padding:3px 6px}
  .ft{display:flex;gap:6px;padding:8px 12px;border-top:1px solid rgba(150,140,255,.15)}
  select{background:#12163a;color:#dcd8ff;border:1px solid rgba(150,140,255,.3);border-radius:999px;font-size:12px;padding:3px 6px}
  .scan{height:2px;background:linear-gradient(90deg,transparent,#22d3ee,transparent);animation:sc 1s linear infinite}@keyframes sc{from{transform:translateX(-100%)}to{transform:translateX(100%)}}`;
  let host, root, panel, lastSel = '';
  function ui() {
    if (host && host.isConnected) return root;
    host = document.createElement('oracle-root'); root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${UI_CSS}</style>`; document.documentElement.appendChild(host); return root;
  }
  const clearFab = () => { const f = root && root.querySelector('.fab'); if (f) f.remove(); };
  function closePanel() { if (panel) { panel.remove(); panel = null; } }

  const ACTS = [['explain', 'Explain'], ['simplify', 'Simplify'], ['summarise', 'Summarise'], ['define', 'Define words'], ['keypoints', 'Key points'], ['revision', 'Revision notes'], ['flashcards', 'Flashcards'], ['translate', 'Translate']];
  function openPanel({ title, selection, markdown, actions }) {
    ui(); closePanel(); clearFab();
    panel = document.createElement('div'); panel.className = 'panel';
    panel.innerHTML = `<div class="hd"><i class="dot"></i><b>ORACLE</b><span></span><button class="x" aria-label="Close">×</button></div><div class="bd"></div><div class="ft"><button data-a="copy">Copy</button><button data-a="save">Save to Vault</button></div>`;
    const bd = panel.querySelector('.bd'); let current = { title, md: markdown || '' };
    if (selection) {
      bd.innerHTML = '<div class="sel"></div><div class="acts"></div><div class="out"></div>';
      bd.querySelector('.sel').textContent = selection.length > 400 ? selection.slice(0, 400) + '…' : selection;
      const acts = bd.querySelector('.acts');
      ACTS.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => runAct(id); acts.appendChild(b); });
      const sel = document.createElement('select'); sel.title = 'Translate into'; [['es', 'Spanish'], ['fr', 'French'], ['de', 'German']].forEach(([v, l]) => sel.add(new Option(l, v))); acts.appendChild(sel);
      panel.__lang = sel;
    } else bd.innerHTML = '<div class="out"></div>';
    const out = bd.querySelector('.out');
    const show = (t, md) => { current = { title: t, md }; out.innerHTML = O.md(md); };
    const runAct = async (id) => {
      const buttons = [...panel.querySelectorAll('.acts button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const userDefs = (await O.store.vault()).filter(e => e.type === 'definition');
        const result = E.textAction(id, selection, { lang: panel.__lang && panel.__lang.value, userDefs });
        if (typeof result !== 'string' || !result.trim()) throw new Error('The text tool returned an empty result.');
        show(id, result);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        show('Tool error', '**ORACLE could not run this action.** ' + message);
      } finally {
        buttons.forEach(button => { button.disabled = false; });
      }
    };
    if (markdown) show(title, markdown); else out.innerHTML = '<p style="color:#8b90b3">Choose an action above.</p>';
    panel.querySelector('.x').onclick = closePanel;
    panel.querySelector('[data-a=copy]').onclick = async (e) => { try { await navigator.clipboard.writeText(O.plain(current.md)); e.target.textContent = 'Copied'; } catch (x) { e.target.textContent = 'Copy blocked'; } setTimeout(() => (e.target.textContent = 'Copy'), 1400); };
    panel.querySelector('[data-a=save]').onclick = async (e) => {
      if (!current.md) return;
      await O.store.addVault({ type: selection ? 'selection' : 'summary', title: (title || 'Saved') + (selection ? ': ' + selection.slice(0, 40) : ''), text: O.plain(current.md), url: location.href });
      e.target.textContent = 'Saved ✓'; setTimeout(() => (e.target.textContent = 'Save to Vault'), 1400);
    };
    root.appendChild(panel); return { show };
  }

  /* selection button */
  document.addEventListener('mouseup', (e) => {
    if (host && e.composedPath().includes(host)) return;
    setTimeout(() => {
      const s = window.getSelection(), t = s ? s.toString().trim() : '';
      if (t.length < 3 || t.length > 20000 || !s.rangeCount) { clearFab(); return; }
      lastSel = t; ui(); clearFab();
      const r = s.getRangeAt(0).getBoundingClientRect();
      const b = document.createElement('button'); b.className = 'fab'; b.title = 'Send to ORACLE'; b.setAttribute('aria-label', 'Send selection to ORACLE');
      b.style.left = Math.min(innerWidth - 44, Math.max(6, r.right + 6)) + 'px'; b.style.top = Math.min(innerHeight - 44, Math.max(6, r.bottom + 6)) + 'px';
      b.onmousedown = ev => ev.preventDefault();
      b.onclick = () => openPanel({ title: 'Selection', selection: lastSel });
      root.appendChild(b);
    }, 10);
  });
  document.addEventListener('mousedown', (e) => { if (!(host && e.composedPath().includes(host))) clearFab(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePanel(); clearFab(); closeReader(); } });

  /* ───────── reader mode ───────── */
  let reader = null;
  const READER_CSS = `:host{all:initial}.r{position:fixed;inset:0;z-index:2147483645;overflow:auto;background:#0b0d1c;color:#dfe2f5;font-family:Georgia,"Iowan Old Style",serif}
  .bar{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:10px 18px;background:rgba(11,13,28,.92);backdrop-filter:blur(8px);border-bottom:1px solid rgba(150,140,255,.2);font:13px "Segoe UI",system-ui,sans-serif}
  .bar b{letter-spacing:.3em;font-weight:300;flex:1}.bar button{background:rgba(139,92,246,.18);border:1px solid rgba(150,140,255,.3);color:#dcd8ff;border-radius:8px;padding:5px 12px;cursor:pointer}
  article{max-width:680px;margin:0 auto;padding:30px 20px 90px;line-height:1.75}h1{font-size:1.7em;line-height:1.25;margin:.2em 0 .6em}h2,h3,h4{margin:1.6em 0 .4em;color:#c4b5fd;line-height:1.3}p,li,blockquote{margin:.8em 0}blockquote{border-left:3px solid #4f7cff;padding-left:14px;color:#aab0d4}.meta{color:#8b90b3;font:13px "Segoe UI",system-ui,sans-serif}`;
  async function openReader(size) {
    closeReader(); const d = extract();
    if (d.blocks.length < 2) throw new Error('No readable article text was found on this page.');
    const st = await O.store.settings(); size = size || st.readerSize;
    reader = document.createElement('oracle-reader'); const r = reader.attachShadow({ mode: 'open' });
    const rs = O.nlp.readStats(d.text);
    r.innerHTML = `<style>${READER_CSS}</style><div class="r"><div class="bar"><b>ORACLE · READING MODE</b><button data-s="-1">A−</button><button data-s="1">A+</button><button data-x>Close</button></div><article style="font-size:${size}px"></article></div>`;
    const art = r.querySelector('article'); const h = document.createElement('h1'); h.textContent = d.title; art.appendChild(h);
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${d.domain} · ${rs.words.toLocaleString()} words · ${rs.minutes} min read`; art.appendChild(meta);
    let inList = null;
    d.blocks.forEach(b => { if (b.t === 'h1' && b.text === d.title) return; const el = document.createElement(b.t === 'li' ? 'li' : b.t === 'q' ? 'blockquote' : b.t); el.textContent = b.text; if (b.t === 'li') { if (!inList) { inList = document.createElement('ul'); art.appendChild(inList); } inList.appendChild(el); } else { inList = null; art.appendChild(el); } });
    r.addEventListener('click', async (e) => {
      const bt = e.target.closest('button'); if (!bt) return;
      if (bt.dataset.s) { size = Math.max(13, Math.min(34, size + 2 * +bt.dataset.s)); art.style.fontSize = size + 'px'; O.store.saveSettings({ readerSize: size }); }
      else closeReader();
    });
    document.documentElement.appendChild(reader); document.documentElement.style.overflow = 'hidden';
    return { size };
  }
  function closeReader() { if (reader) { reader.remove(); reader = null; document.documentElement.style.overflow = ''; } }
  function readerSize(s) { if (!reader) return; reader.shadowRoot.querySelector('article').style.fontSize = s + 'px'; }

  /* ───────── page commands (palette & messages) ───────── */
  async function runMode(title, fn) {
    ui(); const p = openPanel({ title, markdown: '' });
    p.show(title, '_Analysing this page locally…_');
    await new Promise(r => setTimeout(r, 120));
    try { p.show(title, fn(extract())); } catch (e) { p.show(title, '**Couldn’t analyse this page.** ' + e.message); }
  }
  function commands() {
    const M = E.modes;
    return [
      { title: 'Quick summary', hint: 'this page', run: () => runMode('Quick summary', M.quick) },
      { title: 'Detailed summary', hint: 'this page', run: () => runMode('Detailed summary', M.detailed) },
      { title: 'Key points', hint: 'this page', run: () => runMode('Key points', M.keypoints) },
      { title: 'Explain simply', hint: 'this page', run: () => runMode('Explain simply', M.simple) },
      { title: 'Study mode: revision notes', hint: 'this page', run: () => runMode('Revision notes', M.study) },
      { title: 'Fact extraction', hint: 'dates, figures, names', run: () => runMode('Fact extraction', M.facts) },
      { title: 'Flashcards', hint: 'from this page', run: () => runMode('Flashcards', d => E.cardsText(E.flashcards(d))) },
      { title: 'Quiz', hint: 'from this page', run: () => runMode('Quiz', d => E.quizText(E.quiz(d))) },
      { title: 'Page overview', hint: 'domain, headings, links', run: () => runMode('Overview', E.overview) },
      { title: 'Reading statistics', hint: 'time, difficulty', run: () => runMode('Reading statistics', E.readingStatsText) },
      { title: 'List headings', hint: 'outline', run: () => runMode('Outline', E.headingsText) },
      { title: 'List links', hint: 'on this page', run: () => runMode('Links', d => E.linksText(d)) },
      { title: 'Reading mode', hint: 'distraction-free', run: () => openReader().catch(e => runMode('Reading mode', () => e.message)) },
      { title: 'Highlight important passages', hint: 'toggle', run: () => { const n = highlight(!document.querySelector('mark.oracle-hl')).count; if (!n) closePanel(); } },
      { title: 'Find in page…', hint: 'highlight matches', run: () => { const t = prompt('Find in this page:'); if (t) { const r = find(t); runMode('Find', () => r.count ? `**${r.count}** match${r.count > 1 ? 'es' : ''} highlighted for “${t}”.` : `No matches for “${t}”.`); } } },
      { title: 'Save this page to Vault', hint: 'quick summary', run: async () => { const d = extract(); await O.store.addVault({ type: 'summary', title: d.title, text: O.plain(M.quick(d)), url: d.url }); runMode('Saved', () => 'Saved a quick summary of this page to your Knowledge Vault.'); } },
      { title: 'Clear highlights', hint: 'find & important', run: () => { clearFind(); highlight(false); } },
      { title: 'Open ORACLE dashboard', hint: 'full view', run: () => chrome.runtime.sendMessage({ type: 'oracle:openDashboard', hash: '#chat' }) }
    ];
  }

  /* ───────── messages from popup / dashboard / background ───────── */
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    try {
      switch (msg.type) {
        case 'oracle:ping': send({ ok: true }); break;
        case 'oracle:extract': send({ ok: true, doc: extract() }); break;
        case 'oracle:selection': send({ ok: true, text: (window.getSelection() || '').toString().trim() || lastSel }); break;
        case 'oracle:find': send({ ok: true, ...find(msg.term) }); break;
        case 'oracle:findStep': send({ ok: true, ...step(msg.dir) }); break;
        case 'oracle:findClear': clearFind(); send({ ok: true }); break;
        case 'oracle:highlight': send({ ok: true, ...highlight(msg.on) }); break;
        case 'oracle:reader':
          if (msg.on) openReader(msg.size).then(r => send({ ok: true, ...r }), e => send({ ok: false, error: e.message })); else { closeReader(); send({ ok: true }); }
          return true;
        case 'oracle:readerSize': readerSize(msg.size); send({ ok: true }); break;
        case 'oracle:palette': O.palette.open(commands()); send({ ok: true }); break;
        default: return false;
      }
    } catch (e) { send({ ok: false, error: e.message }); }
    return false;
  });
})();
