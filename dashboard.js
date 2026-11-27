(async function () {
  'use strict';
  const O = window.ORACLE, E = O.engine, T = O.tools;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toast = t => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2000); };
  const dateStr = ts => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const setOut = (el, raw) => { el._raw = raw; el.innerHTML = O.md(raw); };
  const clipS = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const fail = (el, e) => { O.orb.set('error', 1800); if (el) setOut(el, '**Couldn’t do that.** ' + (e && e.message ? e.message : e)); else toast(e.message || String(e)); };

  const st = await O.store.settings();
  document.documentElement.classList.toggle('calm', !!st.reduceMotion);
  $('#sideOrb').innerHTML = O.orb.html(); O.orb.boot(); O.particles.start($('#fx'), st.particles && !st.reduceMotion);

  /* ───── navigation ───── */
  const PANELS = ['chat', 'analyse', 'text', 'writing', 'vault', 'tools', 'settings'];
  const PANEL_META = {
    chat: ['Chat', 'Ask questions about the page you have open.'],
    analyse: ['Page analysis', 'Turn the current page into summaries, notes and study material.'],
    text: ['Dictionary & text tools', 'Look up words or work with text you select or paste.'],
    writing: ['Writing assistant', 'Draft, refine, proofread and review your writing with local AI.'],
    vault: ['Knowledge vault', 'Keep your notes, definitions and saved page summaries together.'],
    tools: ['Browser tools', 'Research across several open pages, manage tabs and compare sources.'],
    settings: ['Settings', 'Control your local experience and privacy preferences.']
  };
  function show(p) {
    if (!PANELS.includes(p)) p = 'chat';
    $$('.panel').forEach(x => x.classList.toggle('on', x.id === 'p-' + p));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    const meta = PANEL_META[p]; $('#panelTitle').textContent = meta[0]; $('#panelDescription').textContent = meta[1];
    history.replaceState(null, '', location.search + '#' + p);
    if (p === 'vault') renderVault(); if (p === 'tools') { renderTabs(); renderResearchTabs(); renderBookmarks(); }
  }
  $$('#nav button').forEach(b => b.onclick = () => show(b.dataset.p));
  const h0 = location.hash.slice(1);
  if (h0 === 'welcome') $('#welcome').hidden = false;
  $('#welcomeX').onclick = () => { $('#welcome').hidden = true; };

  /* ───── target tab ───── */
  let tabId = +new URLSearchParams(location.search).get('tab') || null;
  async function loadTabs() {
    const tabs = await T.pageTabs(); const sel = $('#tabSel'); sel.innerHTML = '';
    tabs.forEach(t => sel.add(new Option(clipS(t.title || t.url, 48), t.id)));
    if (!tabs.length) sel.add(new Option('No web pages open', ''));
    const pick = tabs.find(t => t.id === tabId) || await T.targetTab();
    if (pick) sel.value = pick.id; tabId = +sel.value || null;
    for (const id of ['#cmpA', '#cmpB']) { const c = $(id), keep = c.value; c.innerHTML = ''; tabs.forEach(t => c.add(new Option(clipS(t.title || t.url, 40), t.id))); if (keep) c.value = keep; }
    if (tabs.length > 1 && $('#cmpA').value === $('#cmpB').value) $('#cmpB').selectedIndex = ($('#cmpA').selectedIndex + 1) % tabs.length;
  }
  await loadTabs();
  const chat = await O.chat.mount({ log: $('#log'), input: $('#input'), form: $('#form'), chips: $('#chips'), clearBtn: $('#clear'), getTabId: () => tabId });
  $('#tabSel').onchange = () => { tabId = +$('#tabSel').value || null; chat.invalidate(); A = null; };
  $('#tabRefresh').onclick = async () => { await loadTabs(); chat.invalidate(); await renderResearchTabs(); toast('Tab list refreshed'); };
  const needTab = async () => { const t = await T.targetTab(tabId); if (!t) throw new Error('Open a normal web page (http or https) in another tab, then press ↻ in the sidebar.'); return t; };

  /* ───── copy / save buttons ───── */
  document.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]'), s = e.target.closest('[data-save]');
    if (c) { const el = $(c.dataset.copy); try { await navigator.clipboard.writeText(O.plain(el._raw || el.innerText)); toast('Copied'); } catch (x) { toast('Copy was blocked by the browser'); } }
    if (s) {
      const el = $(s.dataset.save), raw = el._raw; if (!raw) { toast('Nothing to save yet'); return; }
      await O.store.addVault({ type: s.dataset.save === '#tOut' ? 'note' : 'summary', title: (s.dataset.title || 'Saved') + (A && s.dataset.save === '#aOut' ? ': ' + A.doc.title : ''), text: O.plain(raw), url: A && s.dataset.save === '#aOut' ? A.doc.url : '' });
      toast('Saved to your vault');
    }
  });

  /* ───── page analysis ───── */
  let A = null, mode = 'quick';
  async function analyse() {
    const t = await needTab(); const card = $('#aCard');
    card.classList.add('scanning'); O.orb.set('analysing');
    try { const [doc] = await Promise.all([T.extract(t.id), sleep(1000)]); A = { doc, tab: t.id }; renderStats(doc); return doc; }
    finally { card.classList.remove('scanning'); O.orb.set('idle'); }
  }
  function renderStats(d) {
    const rs = O.nlp.readStats(d.text), kw = O.nlp.keywords(d.text, 3).map(k => k.word).join(', ');
    const ext = d.links.filter(l => l.external).length;
    const items = [['Title', clipS(d.title, 46)], ['Domain', d.domain], ['Words', rs.words.toLocaleString()], ['Reading time', rs.minutes + ' min'], ['Difficulty', rs.label + (rs.grade != null ? ` · grade ${rs.grade}` : '')], ['Headings', d.blocks.filter(b => b.t[0] === 'h').length], ['Links', `${d.links.length} (${ext} external)`], ['Main subject', kw || '—']];
    $('#stats').innerHTML = ''; items.forEach(([k, v], i) => { const s = document.createElement('div'); s.className = 'stat'; s.style.animationDelay = i * 40 + 'ms'; s.innerHTML = '<b></b><span></span>'; s.firstChild.textContent = v; s.lastChild.textContent = k; $('#stats').appendChild(s); });
  }
  function parseGeneratedJSON(raw, key) {
    const source = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const first = source.indexOf('{'), last = source.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    try {
      const value = JSON.parse(source.slice(first, last + 1));
      const items = value && value[key];
      return Array.isArray(items) ? items : null;
    } catch (_) { return null; }
  }

  async function renderMode(m) {
    mode = m; $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const out = $('#aOut');
    try {
      const doc = A && A.tab === (+$('#tabSel').value || A.tab) ? A.doc : await analyse();
      O.orb.set('analysing');
      setOut(out, '_Qwen is reading the page and preparing an analysis…_');
      const questions = {
        quick: 'Give me a useful overview of this page, including its central message and the most important supporting ideas.',
        detailed: 'Give me a genuinely in-depth analysis of this page, explaining the ideas, evidence, relationships, implications and limitations.',
        keypoints: 'Identify and explain the most important points from this page and why each matters.',
        simple: 'Teach me the content of this page in clear, accessible language, explaining technical terms and difficult ideas.',
        study: 'Turn this page into detailed, well-organised revision notes that help me understand and remember it.',
        facts: 'Analyse this page and extract its important facts, figures, names, dates, claims and supporting evidence. Separate facts from interpretation.',
        cards: 'Create useful flashcards from this page that test genuine understanding.',
        quiz: 'Create a multiple-choice quiz from this page, with plausible distractors, correct answers and explanations.'
      };
      const generated = await O.localAI.askTask(m, { page: doc, question: questions[m] || 'Analyse this page.' });
      if (m === 'cards') {
        const cards = parseGeneratedJSON(generated, 'cards');
        if (cards && cards.length) return renderCards(out, cards.filter(c => c && typeof c.q === 'string' && typeof c.a === 'string').slice(0, 10));
      }
      if (m === 'quiz') {
        const questions = parseGeneratedJSON(generated, 'questions');
        const valid = (questions || []).filter(q =>
          q && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length === 4 &&
          q.options.every(option => typeof option === 'string') &&
          Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
        ).slice(0, 8);
        if (valid.length) return renderQuiz(out, valid);
      }
      setOut(out, generated);
    } catch (e) { fail(out, e); }
    finally { O.orb.set('idle'); }
  }
  function renderCards(out, cards) {
    cards = Array.isArray(cards) ? cards : [];
    out._raw = '## Flashcards\n\n' + cards.map((card, i) => '**' + (i + 1) + '. ' + card.q + '**\n\n' + card.a).join('\n\n');
    if (!cards.length) { out.innerHTML = O.md('No flashcards were generated. Please try again.'); return; }
    out.innerHTML = '<p class="mute">Click a card to flip it.</p><div class="fcgrid"></div>';
    cards.forEach(c => { const f = document.createElement('div'); f.className = 'fc'; f.tabIndex = 0; f.innerHTML = '<div><small class="mute"></small><p></p></div>'; const lab = f.querySelector('small'), p = f.querySelector('p'); lab.textContent = 'Question'; p.textContent = c.q; const flip = () => { const on = f.classList.toggle('flip'); lab.textContent = on ? 'Answer' : 'Question'; p.textContent = on ? c.a : c.q; }; f.onclick = flip; f.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); flip(); } }; out.querySelector('.fcgrid').appendChild(f); });
  }
  function renderQuiz(out, qs) {
    qs = Array.isArray(qs) ? qs : [];
    out._raw = '## Quiz\n\n' + qs.map((q, i) => '**' + (i + 1) + '. ' + q.q + '**\n' + q.options.map((option, k) => '  ' + 'ABCD'[k] + ') ' + option).join('\n') + '\n\n**Answer:** ' + 'ABCD'[q.answer] + (q.explanation ? ' — ' + q.explanation : '')).join('\n\n');
    if (!qs.length) { out.innerHTML = O.md('No quiz questions were generated. Please try again.'); return; }
    out.innerHTML = '<p class="mute">Choose an answer. ORACLE explains it after you select.</p><div id="qs"></div><p id="score"></p>'; let done = 0, right = 0;
    qs.forEach((q, i) => {
      const d = document.createElement('div'); d.className = 'q'; const p = document.createElement('p'); p.textContent = `${i + 1}. ${q.q}`; d.appendChild(p);
      q.options.forEach((o, k) => { const b = document.createElement('button'); b.className = 'btn opt'; b.textContent = o; b.onclick = () => { d.querySelectorAll('button').forEach(x => (x.disabled = true)); const ok = k === q.answer; b.classList.add(ok ? 'ok' : 'no'); if (!ok) d.querySelectorAll('button')[q.answer].classList.add('ok'); const explanation = document.createElement('p'); explanation.className = 'mute'; explanation.textContent = (ok ? 'Correct. ' : 'Not quite. ') + (q.explanation || 'The correct answer is ' + q.options[q.answer] + '.'); d.appendChild(explanation); done++; if (ok) right++; if (done === qs.length) $('#score').innerHTML = `<b>Score: ${right} / ${qs.length}</b>`; }; d.appendChild(b); });
      out.querySelector('#qs').appendChild(d);
    });
  }
  $('#analyse').onclick = async () => { try { await analyse(); await renderMode(mode); } catch (e) { fail($('#aOut'), e); } };
  $$('#modes button').forEach(b => b.onclick = () => renderMode(b.dataset.m));

  /* ───── text assistant ───── */
  $('#grab').onclick = async () => { try { const t = await needTab(); const s = await T.selection(t.id); if (!s) throw new Error('Nothing is selected on that page. Highlight some text there first.'); $('#tIn').value = s; toast('Selection copied in'); } catch (e) { fail($('#tOut'), e); } };
  const textTasks = {
    explain: 'explain',
    simplify: 'simple',
    summarise: 'summarise',
    define: 'define',
    keypoints: 'keypoints',
    revision: 'study',
    flashcards: 'cards',
    translate: 'translate'
  };
  async function dictionaryContextFor(text, userDefs) {
    const terms = [...new Set((String(text || '').match(/[\p{L}][\p{L}’'\-]{5,}/gu) || []).map(x => x.toLowerCase()))]
      .sort((a, b) => b.length - a.length).slice(0, 5);
    const references = [];
    for (const word of terms) {
      const own = E.defineWord(word, null, userDefs);
      if (!own.includes('isn’t in ORACLE’s bundled definition set yet.')) {
        references.push(own);
      } else if (O.dictionaryFull) {
        const item = await O.dictionaryFull.lookup(word).catch(() => null);
        if (item) references.push(O.dictionaryFull.format(item));
      }
      if (references.length >= 4) break;
    }
    return references.join('\n\n');
  }
  $$('[data-t]').forEach(b => b.onclick = async () => {
    const text = $('#tIn').value.trim(), task = textTasks[b.dataset.t];
    if (!text) { fail($('#tOut'), new Error('Paste text or grab a page selection first.')); return; }
    b.disabled = true; O.orb.set('processing');
    setOut($('#tOut'), '_Qwen is working on your text…_');
    try {
      const userDefs = (await O.store.vault()).filter(e => e.type === 'definition');
      const reference = task === 'define' ? await dictionaryContextFor(text, userDefs) : '';
      const answer = await O.localAI.askTask(task, {
        question: {
          explain: 'Explain this passage in depth and clarify its important ideas.',
          simple: 'Rewrite and explain this passage in plain, accessible language.',
          summarise: 'Summarise this passage without losing its important meaning.',
          define: 'Identify and explain the important vocabulary in this passage, especially how each term is used here.',
          keypoints: 'Extract and explain the key ideas and why they matter.',
          study: 'Create detailed revision notes from this passage.',
          cards: 'Create understanding-focused flashcards from this passage.',
          translate: 'Translate this passage naturally and accurately.'
        }[task],
        selection: text,
        reference,
        language: $('#tLang').value
      });
      if (task === 'cards') {
        const cards = parseGeneratedJSON(answer, 'cards');
        const valid = (cards || []).filter(card => card && typeof card.q === 'string' && typeof card.a === 'string').slice(0, 10);
        if (valid.length) { renderCards($('#tOut'), valid); return; }
      }
      setOut($('#tOut'), answer);
    } catch (error) { fail($('#tOut'), error); }
    finally { b.disabled = false; O.orb.set('idle'); }
  });
  /* ───── offline dictionary ───── */
  const dictLookup = async () => {
    const word = $('#dictWord').value.trim();
    if (!word) { setOut($('#dictOut'), 'Enter a word to look up.'); $('#dictWord').focus(); return; }
    $('#dictLookup').disabled = true;
    try {
      const userDefs = (await O.store.vault()).filter(e => e.type === 'definition');
      const curated = E.defineWord(word, null, userDefs);
      let dictionaryEntry = curated;
      if (curated.includes('isn’t in ORACLE’s bundled definition set yet.')) {
        setOut($('#dictOut'), '**Looking through the expanded offline dictionary…**');
        const full = O.dictionaryFull ? await O.dictionaryFull.lookup(word).catch(error => {
          throw new Error('The expanded offline dictionary could not be opened: ' + error.message);
        }) : null;
        if (full) dictionaryEntry = O.dictionaryFull.format(full);
      }
      setOut($('#dictOut'), '_Qwen is preparing a clear explanation using ORACLE’s dictionary data…_');
      try {
        const explanation = await O.localAI.askTask('define', {
          question: 'Explain the word “' + word + '” clearly and in depth. Cover its different meanings where relevant, part of speech, typical usage, connotations and a natural example.',
          reference: dictionaryEntry
        });
        setOut($('#dictOut'), explanation + '\n\n---\n\n**Offline dictionary reference**\n\n' + dictionaryEntry);
      } catch (error) {
        setOut($('#dictOut'), dictionaryEntry + '\n\n> AI explanation unavailable: ' + (error && error.message ? error.message : String(error)));
      }
    } catch (e) { fail($('#dictOut'), e); }
    finally { $('#dictLookup').disabled = false; }
  };
  $('#dictLookup').onclick = dictLookup;
  $('#dictWord').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); dictLookup(); } });
  const dictCount = $('.dictionary-foot');
  if (dictCount) {
    dictCount.textContent = 'Curated local glossary · Expanded offline WordNet index loads only the letter you look up · Your Vault definitions take priority';
    if (O.dictionaryFull) O.dictionaryFull.metadata().then(meta => {
      dictCount.textContent = `${meta.word_count.toLocaleString()} WordNet word forms + curated glossary · Multiple senses and examples · Loaded locally, on demand`;
    }).catch(() => {});
  }

  /* ───── knowledge vault ───── */
  async function fillCollections() {
    const cols = await O.store.collections();
    for (const [id, all] of [['#vCol', true], ['#vNewCol', false]]) { const s = $(id), keep = s.value; s.innerHTML = ''; if (all) s.add(new Option('All collections', 'all')); cols.forEach(c => s.add(new Option(c, c))); if (keep && [...s.options].some(o => o.value === keep)) s.value = keep; }
    $('#vChips').innerHTML = '';
    cols.forEach(c => { const b = document.createElement('span'); b.className = 'badge'; b.textContent = c; if (c !== 'General') { const x = document.createElement('button'); x.textContent = ' ×'; x.style.cssText = 'background:none;border:0;color:inherit;cursor:pointer'; x.setAttribute('aria-label', 'Delete collection ' + c); x.onclick = async () => { if (confirm(`Delete the collection “${c}”? Its entries move to General.`)) { await O.store.removeCollection(c); renderVault(); } }; b.appendChild(x); } $('#vChips').appendChild(b); });
  }
  async function renderVault() {
    await fillCollections();
    const list = await O.store.searchVault($('#vQ').value, $('#vCol').value, $('#vType').value), box = $('#vList'); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty-note"><h3>Your vault is empty</h3><p>Save summaries from the analysis page, selections from the page button, or add a note or definition above.</p></div>'; return; }
    list.forEach(e => {
      const it = document.createElement('div'); it.className = 'item';
      it.innerHTML = '<div class="grow"><div class="t"></div><div class="s"></div><p></p></div><button class="btn sm danger" aria-label="Delete entry">Delete</button>';
      it.querySelector('.t').textContent = e.title;
      const s = it.querySelector('.s'); s.innerHTML = `<span class="badge"></span><span class="badge"></span> ${dateStr(e.created)} `; s.children[0].textContent = e.type; s.children[1].textContent = e.collection;
      if (/^https?:/.test(e.url)) { const a = document.createElement('a'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = host(e.url); a.style.color = '#7dd3fc'; s.appendChild(a); }
      const p = it.querySelector('p'); const full = e.text || ''; p.textContent = clipS(full, 260);
      if (full.length > 260) { p.style.cursor = 'pointer'; p.title = 'Click to expand'; let open = false; p.onclick = () => { open = !open; p.textContent = open ? full : clipS(full, 260); }; }
      it.querySelector('button').onclick = async () => { if (confirm('Delete this entry?')) { await O.store.removeVault(e.id); renderVault(); } };
      box.appendChild(it);
    });
  }
  ['#vQ'].forEach(i => $(i).addEventListener('input', renderVault)); ['#vCol', '#vType'].forEach(i => $(i).addEventListener('change', renderVault));
  $('#vAdd').onclick = async () => {
    const title = $('#vTitle').value.trim(), text = $('#vText').value.trim();
    if (!title || !text) { toast('Add a title and some text'); return; }
    await O.store.addVault({ type: $('#vNewType').value, title, text, collection: $('#vNewCol').value || 'General' });
    $('#vTitle').value = ''; $('#vText').value = ''; toast('Added to vault'); renderVault();
  };
  $('#vAddC').onclick = async () => { await O.store.addCollection($('#vNewC').value); $('#vNewC').value = ''; renderVault(); };
  $('#vExport').onclick = async () => { const blob = new Blob([await O.store.exportAll()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'oracle-vault.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

  const CROSS_TAB_LIMIT = 5;
  const researchSelected = new Set();
  let researchTabs = [], lastCrossResearch = null, crossResearchBusy = false;
  /* ───── tab manager ───── */
  let tabData = { tabs: [], duplicates: [] };
  async function renderTabs() {
    tabData = await T.tabsSummary(); const q = $('#tbQ').value.toLowerCase(), box = $('#tbList'); box.innerHTML = '';
    const dupIds = new Set(tabData.duplicates.flat().map(t => t.id));
    const tabs = tabData.tabs.filter(t => ((t.title || '') + ' ' + t.url).toLowerCase().includes(q));
    if (!tabs.length) { box.innerHTML = '<div class="empty-note"><p>No matching tabs.</p></div>'; return; }
    tabs.forEach(t => {
      const it = document.createElement('div'); it.className = 'item' + (dupIds.has(t.id) ? ' dup' : '');
      it.innerHTML = '<input type="checkbox" aria-label="Select tab"><div class="grow"><div class="t"></div><div class="s"></div></div><button class="btn sm">Switch</button>';
      it.querySelector('input').dataset.id = t.id; it.querySelector('.t').textContent = t.title || t.url;
      it.querySelector('.s').textContent = host(t.url) + (dupIds.has(t.id) ? ' · duplicate' : '');
      it.querySelector('button').onclick = () => T.switchTo(t); box.appendChild(it);
    });
  }
  $('#tbQ').addEventListener('input', renderTabs); $('#tbRef').onclick = renderTabs;
  $('#tbDup').onclick = async () => {
    await renderTabs(); let n = 0;
    tabData.duplicates.forEach(g => g.slice(1).forEach(t => { const c = $(`#tbList input[data-id="${t.id}"]`); if (c) { c.checked = true; n++; } }));
    toast(n ? `Selected ${n} duplicate tab${n > 1 ? 's' : ''} (the first of each set is kept)` : 'No duplicate tabs found');
  };
  $('#tbClose').onclick = async () => {
    const ids = $$('#tbList input:checked').map(c => +c.dataset.id); if (!ids.length) { toast('Select tabs first'); return; }
    if (!confirm(`Close ${ids.length} tab${ids.length > 1 ? 's' : ''}? This can’t be undone from ORACLE.`)) return;
    await T.closeTabs(ids); await renderTabs(); await loadTabs(); toast('Tabs closed');
  };

  function updateResearchCount() {
    const count = researchSelected.size;
    $('#researchCount').textContent = count + ' of ' + CROSS_TAB_LIMIT + ' sources selected · ' + (count < 2 ? 'choose at least 2' : 'ready to research');
    $('#researchRun').disabled = count < 2 || crossResearchBusy;
  }
  async function renderResearchTabs() {
    const box = $('#researchTabList');
    if (!box) return;
    const tabs = await T.pageTabs();
    researchTabs = tabs;
    const openIds = new Set(tabs.map(t => t.id));
    [...researchSelected].forEach(id => { if (!openIds.has(id)) researchSelected.delete(id); });
    const query = ($('#researchTabSearch').value || '').trim().toLowerCase();
    const visibleTabs = tabs.filter(t => ((t.title || '') + ' ' + t.url).toLowerCase().includes(query));
    box.innerHTML = '';
    if (!visibleTabs.length) {
      box.innerHTML = '<div class="empty-note"><p>No readable HTTP/HTTPS tabs match this filter.</p></div>';
      updateResearchCount();
      return;
    }
    visibleTabs.forEach(tab => {
      const selected = researchSelected.has(tab.id);
      const row = document.createElement('div');
      row.className = 'item research-tab-row' + (selected ? ' selected' : '');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'research-tab-check';
      check.checked = selected;
      check.disabled = !selected && researchSelected.size >= CROSS_TAB_LIMIT;
      check.setAttribute('aria-label', 'Include ' + (tab.title || tab.url) + ' in cross-tab research');
      const copy = document.createElement('div');
      copy.className = 'grow';
      const title = document.createElement('div');
      title.className = 't';
      title.textContent = tab.title || tab.url;
      const meta = document.createElement('div');
      meta.className = 's';
      meta.textContent = host(tab.url) + (tab.active ? ' · active tab' : '');
      copy.append(title, meta);
      const switchButton = document.createElement('button');
      switchButton.type = 'button';
      switchButton.className = 'btn sm research-switch';
      switchButton.textContent = 'Switch';
      switchButton.title = 'Switch to this tab';
      switchButton.addEventListener('click', async () => {
        try { await T.switchTo(tab); } catch (error) { toast(error.message || String(error)); }
      });
      check.addEventListener('change', () => {
        if (check.checked) {
          if (researchSelected.size >= CROSS_TAB_LIMIT) {
            check.checked = false;
            toast('Cross-tab research supports up to ' + CROSS_TAB_LIMIT + ' pages at once.');
            return;
          }
          researchSelected.add(tab.id);
        } else researchSelected.delete(tab.id);
        renderResearchTabs();
      });
      row.append(check, copy, switchButton);
      box.appendChild(row);
    });
    updateResearchCount();
  }
  $('#researchTabSearch').addEventListener('input', renderResearchTabs);
  $('#researchRefresh').addEventListener('click', async () => {
    try { await renderResearchTabs(); toast('Research tab list refreshed'); }
    catch (error) { $('#researchStatus').textContent = error.message || String(error); }
  });
  $('#researchSelectFive').addEventListener('click', async () => {
    try {
      await renderResearchTabs();
      const query = ($('#researchTabSearch').value || '').trim().toLowerCase();
      const visible = researchTabs.filter(t => ((t.title || '') + ' ' + t.url).toLowerCase().includes(query));
      researchSelected.clear();
      visible.slice(0, CROSS_TAB_LIMIT).forEach(t => researchSelected.add(t.id));
      await renderResearchTabs();
    } catch (error) { $('#researchStatus').textContent = error.message || String(error); }
  });
  $('#researchClearSelection').addEventListener('click', async () => {
    researchSelected.clear();
    await renderResearchTabs();
  });
  function renderResearchSources(sources) {
    const box = $('#researchSources');
    box.innerHTML = '';
    if (!sources.length) { box.hidden = true; return; }
    box.hidden = false;
    const heading = document.createElement('div');
    heading.className = 'research-sources-heading';
    heading.textContent = 'Sources used';
    box.appendChild(heading);
    sources.forEach((source, index) => {
      const item = document.createElement('div');
      item.className = 'research-source';
      const tag = document.createElement('span');
      tag.className = 'badge';
      tag.textContent = '[S' + (index + 1) + ']';
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title || source.domain || ('Source ' + (index + 1));
      const domain = document.createElement('small');
      domain.textContent = source.domain || host(source.url);
      item.append(tag, link, domain);
      box.appendChild(item);
    });
  }
  async function runCrossTabResearch() {
    if (crossResearchBusy) return;
    const out = $('#researchOut');
    const selected = researchTabs.filter(t => researchSelected.has(t.id));
    if (selected.length < 2) { fail(out, new Error('Select at least two open web pages first.')); return; }
    const question = $('#researchQuestion').value.trim();
    if (!question) { fail(out, new Error('Enter a research question for the selected pages.')); return; }
    const unique = [], seen = new Set();
    selected.forEach(tab => {
      const key = T.normUrl(tab.url);
      if (!seen.has(key)) { seen.add(key); unique.push(tab); }
    });
    if (unique.length < 2) { fail(out, new Error('The selected tabs contain the same page. Choose at least two different pages.')); return; }
    crossResearchBusy = true;
    lastCrossResearch = null;
    renderResearchSources([]);
    $('#researchRun').disabled = true;
    $('#researchSave').disabled = true;
    $('#researchCopy').disabled = true;
    $('#researchStatus').textContent = 'Reading ' + unique.length + ' pages on this device…';
    setOut(out, '_Extracting readable page content from your selected tabs…_');
    O.orb.set('analysing');
    try {
      const extracted = await Promise.all(unique.map(async tab => {
        try {
          const doc = await T.extract(tab.id);
          if (!doc || typeof doc.text !== 'string' || doc.text.trim().length < 80) {
            throw new Error('The page did not contain enough readable text.');
          }
          return { tab, doc };
        } catch (error) {
          return { tab, error: error && error.message ? error.message : String(error) };
        }
      }));
      const successful = extracted.filter(item => item.doc);
      const failed = extracted.filter(item => !item.doc);
      if (successful.length < 2) {
        const details = failed.map(item => (item.tab.title || host(item.tab.url)) + ': ' + item.error).join('\n');
        throw new Error('ORACLE could read only ' + successful.length + ' selected page(s). At least two readable pages are required. Check that Edge allows ORACLE to access those websites, then reload the affected tabs.' + (details ? '\n\n' + details : ''));
      }
      const sources = successful.map((item, index) => ({
        title: item.doc.title || item.tab.title || 'Untitled page',
        url: item.doc.url || item.tab.url,
        domain: item.doc.domain || host(item.tab.url),
        text: item.doc.text
      }));
      $('#researchStatus').textContent = 'Synthesising ' + sources.length + ' sources with local Qwen…';
      setOut(out, '_Qwen is checking agreement, disagreement and source evidence…_');
      const result = await O.localAI.askTask('research', {
        sources,
        question: question + '\n\nUse source markers [S1], [S2], etc. for factual claims. Separate direct source evidence from inference, identify conflicts and state when the supplied pages do not establish an answer.'
      });
      const warning = failed.length
        ? '\n\n> **Some selected pages could not be read:** ' + failed.map(item => (item.tab.title || host(item.tab.url)) + ' — ' + item.error).join('; ')
        : '';
      const report = result + warning;
      setOut(out, report);
      lastCrossResearch = { question, report, sources };
      renderResearchSources(sources);
      $('#researchStatus').textContent = 'Analysed ' + sources.length + ' sources' + (failed.length ? ' · ' + failed.length + ' unavailable' : '') + ' · processed on this device';
      $('#researchSave').disabled = false;
      $('#researchCopy').disabled = false;
    } catch (error) {
      fail(out, error);
      $('#researchStatus').textContent = 'Research could not be completed.';
    } finally {
      crossResearchBusy = false;
      updateResearchCount();
      $('#researchSave').disabled = !lastCrossResearch;
      $('#researchCopy').disabled = !lastCrossResearch;
      O.orb.set('idle');
    }
  }
  $('#researchRun').addEventListener('click', runCrossTabResearch);
  $('#researchSave').addEventListener('click', async () => {
    if (!lastCrossResearch) return;
    try {
      const sourceNotes = lastCrossResearch.sources.map((source, i) => '[S' + (i + 1) + '] ' + source.title + ' — ' + source.url).join('\n');
      await O.store.addVault({
        type: 'note',
        title: 'Cross-tab research: ' + lastCrossResearch.question.slice(0, 72),
        text: lastCrossResearch.report + '\n\n## Sources\n' + sourceNotes,
        url: lastCrossResearch.sources[0] && lastCrossResearch.sources[0].url || ''
      });
      toast('Research report saved to your Knowledge Vault');
    } catch (error) { toast(error.message || String(error)); }
  });
  $('#researchCopy').addEventListener('click', async () => {
    if (!lastCrossResearch) return;
    const sourceNotes = lastCrossResearch.sources.map((source, i) => '[S' + (i + 1) + '] ' + source.title + ' — ' + source.url).join('\n');
    try {
      await navigator.clipboard.writeText(lastCrossResearch.report + '\n\n## Sources\n' + sourceNotes);
      toast('Research report copied');
    } catch (_) { toast('Copy was blocked by the browser'); }
  });

  /* ───── bookmarks ───── */
  async function renderBookmarks() {
    const cats = await O.store.categories(), s = $('#bmCat'), keep = s.value; s.innerHTML = ''; cats.forEach(c => s.add(new Option(c, c))); if (keep) s.value = keep;
    const q = $('#bmQ').value.toLowerCase(), all = (await O.store.bookmarks()).filter(b => (b.title + ' ' + b.url + ' ' + b.category).toLowerCase().includes(q)), box = $('#bmList'); box.innerHTML = '';
    if (!all.length) { box.innerHTML = '<div class="empty-note"><p>No saved pages yet. Open a page and press <b>Save current page</b>.</p></div>'; return; }
    all.forEach(b => {
      const it = document.createElement('div'); it.className = 'item'; it.innerHTML = '<div class="grow"><div class="t"></div><div class="s"><span class="badge"></span></div></div><button class="btn sm">Open</button><button class="btn sm danger" aria-label="Delete bookmark">✕</button>';
      it.querySelector('.t').textContent = b.title; it.querySelector('.badge').textContent = b.category; it.querySelector('.s').append(' ' + host(b.url) + ' · ' + dateStr(b.created));
      const [open, del] = it.querySelectorAll('button'); open.onclick = () => chrome.tabs.create({ url: b.url }); del.onclick = async () => { await O.store.removeBookmark(b.id); renderBookmarks(); };
      box.appendChild(it);
    });
  }
  $('#bmQ').addEventListener('input', renderBookmarks);
  $('#bmAddCat').onclick = async () => { await O.store.addCategory($('#bmNew').value); $('#bmNew').value = ''; renderBookmarks(); };
  $('#bmSave').onclick = async () => { try { const t = await needTab(); await T.bookmarkPage(t.id, $('#bmCat').value); toast('Page saved'); renderBookmarks(); } catch (e) { fail(null, e); } };

  /* ───── reading assistant ───── */
  $('#rdSize').value = st.readerSize; $('#rdVal').textContent = st.readerSize + 'px';
  const rdMsg = t => { $('#rdMsg').textContent = t; };
  $('#rdOn').onclick = async () => { try { const t = await needTab(); const r = await T.send(t.id, { type: 'oracle:reader', on: true, size: +$('#rdSize').value }); if (!r.ok) throw new Error(r.error); await T.switchTo(t); } catch (e) { rdMsg(e.message); } };
  $('#rdOff').onclick = async () => { try { const t = await needTab(); await T.send(t.id, { type: 'oracle:reader', on: false }); } catch (e) { rdMsg(e.message); } };
  $('#rdSize').oninput = async () => { const v = +$('#rdSize').value; $('#rdVal').textContent = v + 'px'; await O.store.saveSettings({ readerSize: v }); try { const t = await needTab(); T.send(t.id, { type: 'oracle:readerSize', size: v }); } catch (e) { /* none open */ } };
  $('#hlOn').onclick = async () => { try { const t = await needTab(); const r = await T.send(t.id, { type: 'oracle:highlight', on: true }); rdMsg(r.count ? `Highlighted ${r.count} passages on the page.` : 'No suitable passages found.'); await T.switchTo(t); } catch (e) { rdMsg(e.message); } };
  $('#hlOff').onclick = async () => { try { const t = await needTab(); await T.send(t.id, { type: 'oracle:highlight', on: false }); await T.send(t.id, { type: 'oracle:findClear' }); rdMsg('Highlights cleared.'); } catch (e) { rdMsg(e.message); } };

  /* ───── page tools & smart search ───── */
  $$('[data-pt]').forEach(b => b.onclick = async () => {
    const out = $('#ptOut');
    try {
      const t = await needTab();
      const k = b.dataset.pt;
      const d = await T.extract(t.id);
      if (k === 'overview' || k === 'keywords') {
        O.orb.set('analysing');
        setOut(out, k === 'overview'
          ? '_Qwen is examining the purpose, audience and main ideas of this website…_'
          : '_Qwen is identifying the central topics and themes…_');
        const result = await O.localAI.askTask(k, {
          page: d,
          question: k === 'overview'
            ? 'Give me a useful, structured overview of this website and explain what the page is trying to communicate.'
            : 'Find the most important subject keywords and themes in this page. Explain each briefly and group related ideas.'
        });
        setOut(out, result);
      } else {
        setOut(out, k === 'links' ? E.linksText(d, 300) : k === 'stats' ? E.readingStatsText(d) : E.headingsText(d));
      }
    } catch (e) { fail(out, e); }
    finally { O.orb.set('idle'); }
  });
  const fCnt = r => { $('#fCnt').textContent = r && r.count ? `${r.index + 1} / ${r.count}` : 'No matches'; };
  const doFind = async () => { try { const t = await needTab(); const r = await T.send(t.id, { type: 'oracle:find', term: $('#fQ').value }); fCnt(r); if (r.count) await T.switchTo(t); } catch (e) { $('#fCnt').textContent = e.message; } };
  $('#fGo').onclick = doFind; $('#fQ').addEventListener('keydown', e => { if (e.key === 'Enter') doFind(); });
  for (const [id, dir] of [['#fPrev', -1], ['#fNext', 1]]) $(id).onclick = async () => { try { const t = await needTab(); fCnt(await T.send(t.id, { type: 'oracle:findStep', dir })); await T.switchTo(t); } catch (e) { $('#fCnt').textContent = e.message; } };
  $('#fClr').onclick = async () => { try { const t = await needTab(); await T.send(t.id, { type: 'oracle:findClear' }); $('#fCnt').textContent = ''; } catch (e) { $('#fCnt').textContent = e.message; } };
  $('#cmpGo').onclick = async () => {
    const out = $('#cmpOut');
    try {
      const idA = +$('#cmpA').value, idB = +$('#cmpB').value;
      if (!idA || !idB) throw new Error('Choose two open web pages to compare.');
      if (idA === idB) throw new Error('Pick two different tabs.');
      O.orb.set('analysing');
      setOut(out, '_Qwen is comparing both pages and examining their similarities and differences…_');
      const [a, b] = await Promise.all([T.extract(idA), T.extract(idB)]);
      const result = await O.localAI.askTask('compare', {
        page: a,
        secondaryPage: b,
        question: 'Compare these two webpages in depth. Explain what they agree on, where they differ, how their evidence and reasoning compare, and what a reader should take away.'
      });
      setOut(out, result);
    } catch (e) { fail(out, e); }
    finally { O.orb.set('idle'); }
  };

  /* ───── writing assistant ───── */
  const WRITER_KEY = 'oracle_writing_workspace_v1';
  const WRITER_LIMIT = 4200;
  let writerLastResult = '', writerLastIsReview = false, writerPreviousDraft = '', writerInputSnapshot = '', writerBusy = false, writerSaveTimer = 0;
  const writerDraft = $('#writerDraft'), writerResult = $('#writerResult');
  function writerCount() {
    const value = writerDraft.value || '';
    const words = (value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
    $('#writerCount').textContent = value.length.toLocaleString() + ' / ' + WRITER_LIMIT.toLocaleString() + ' characters · ' + words + ' words';
  }
  function writerSetStatus(message) { $('#writerStatus').textContent = message; }
  function queueWriterSave() {
    clearTimeout(writerSaveTimer);
    writerSetStatus('Saving draft locally…');
    writerSaveTimer = setTimeout(async () => {
      try {
        await chrome.storage.local.set({ [WRITER_KEY]: {
          draft: writerDraft.value.slice(0, WRITER_LIMIT),
          action: $('#writerAction').value,
          tone: $('#writerTone').value,
          audience: $('#writerAudience').value,
          format: $('#writerFormat').value,
          instructions: $('#writerInstructions').value.slice(0, 600),
          savedAt: Date.now()
        } });
        writerSetStatus('Draft saved locally · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (error) { writerSetStatus('Draft is in this session, but local autosave failed.'); }
    }, 450);
  }
  async function restoreWriterState() {
    try {
      const stored = await chrome.storage.local.get(WRITER_KEY);
      const saved = stored && stored[WRITER_KEY];
      if (saved && typeof saved === 'object') {
        writerDraft.value = String(saved.draft || '').slice(0, WRITER_LIMIT);
        if (saved.action && [...$('#writerAction').options].some(option => option.value === saved.action)) $('#writerAction').value = saved.action;
        if (saved.tone) $('#writerTone').value = saved.tone;
        if (saved.audience) $('#writerAudience').value = saved.audience;
        if (saved.format) $('#writerFormat').value = saved.format;
        if (typeof saved.instructions === 'string') $('#writerInstructions').value = saved.instructions.slice(0, 600);
        writerSetStatus(saved.savedAt ? 'Recovered local draft · ' + new Date(saved.savedAt).toLocaleString() : 'Recovered local draft.');
      }
    } catch (error) { writerSetStatus('Draft autosave is unavailable in this browser session.'); }
    writerCount();
  }
  function writerAppend(text, label) {
    const clean = String(text || '').trim();
    if (!clean) throw new Error('There is no readable text to insert.');
    const separator = writerDraft.value.trim() ? '\n\n' : '';
    const room = WRITER_LIMIT - writerDraft.value.length - separator.length;
    if (room <= 0) throw new Error('The draft has reached its ' + WRITER_LIMIT.toLocaleString() + '-character limit.');
    const inserted = clean.slice(0, room);
    writerDraft.value += separator + inserted;
    writerDraft.dispatchEvent(new Event('input', { bubbles: true }));
    writerDraft.focus();
    writerSetStatus(label + (inserted.length < clean.length ? ' · clipped to fit the draft limit' : ' · inserted'));
  }
  async function writerImport(kind) {
    try {
      const tab = await needTab();
      if (kind === 'selection') {
        const selected = await T.selection(tab.id);
        if (!selected) throw new Error('Highlight some text on the selected page first.');
        writerAppend(selected, 'Page selection');
      } else {
        const doc = await T.extract(tab.id);
        if (!doc || !doc.text) throw new Error('ORACLE could not read text from the selected page.');
        writerAppend(doc.text.slice(0, 3200), 'Page text');
      }
    } catch (error) { writerSetStatus(error.message || String(error)); toast(error.message || String(error)); }
  }
  writerDraft.addEventListener('input', () => {
    writerCount();
    if (writerLastResult && writerDraft.value.trim() !== writerInputSnapshot) {
      $('#writerApply').disabled = true;
      $('#writerResultMeta').textContent = 'Result is based on an earlier draft';
    }
    queueWriterSave();
  });
  ['writerAction','writerTone','writerAudience','writerFormat','writerInstructions'].forEach(id => {
    $('#' + id).addEventListener(id === 'writerInstructions' ? 'input' : 'change', queueWriterSave);
  });
  $('#writerImportSelection').addEventListener('click', () => writerImport('selection'));
  $('#writerImportPage').addEventListener('click', () => writerImport('page'));
  $('#writerCopyDraft').addEventListener('click', async () => {
    if (!writerDraft.value.trim()) { toast('There is no draft to copy'); return; }
    try { await navigator.clipboard.writeText(writerDraft.value); toast('Draft copied'); }
    catch (_) { toast('Copy was blocked by the browser'); }
  });
  $('#writerClear').addEventListener('click', () => {
    if (writerDraft.value && !confirm('Clear the current draft? The previous version can be restored until another draft is applied.')) return;
    writerDraft.value = '';
    writerDraft.dispatchEvent(new Event('input', { bubbles: true }));
    writerSetStatus('Draft cleared · autosave will remember the empty draft');
  });
  $('#writerRestore').addEventListener('click', () => {
    if (!writerPreviousDraft) return;
    const current = writerDraft.value;
    writerDraft.value = writerPreviousDraft;
    writerPreviousDraft = current;
    $('#writerRestore').disabled = !writerPreviousDraft;
    writerDraft.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Previous draft restored');
  });
  const WRITER_TASKS = {
    proofread: 'Proofread the draft. Correct spelling, grammar, punctuation and obvious usage errors. Keep sentence choices and voice as close to the original as possible. Do not rewrite merely for preference.',
    rewrite: 'Rewrite the draft to make it polished, coherent and engaging while preserving its original meaning, key details and intent.',
    clarify: 'Improve clarity, structure, transitions and sentence flow. Remove ambiguity and unnecessary repetition without changing the underlying message.',
    shorten: 'Make the draft more concise. Remove repetition and unnecessary wording while preserving all important ideas, details and qualifications.',
    expand: 'Develop the existing ideas with clearer explanations, useful transitions and fuller reasoning. Do not invent facts, examples, statistics or evidence; where more evidence is needed, mark the gap rather than filling it.',
    continue: 'Continue the draft naturally from its final sentence. Do not rewrite or repeat the existing text. Match its voice, structure and level of detail, and make the continuation feel connected.',
    email: 'Shape the draft or notes into a clear, well-structured email with an appropriate subject line, greeting, concise body and sign-off. Do not invent names, dates, promises or circumstances; use neutral placeholders where essential details are missing.',
    academic: 'Polish the draft into clear academic prose. Improve precision, logical flow and formal register while preserving the author’s argument, terminology and any existing citations. Do not fabricate references or evidence.'
  };
  async function runWriter(reviewOnly) {
    if (writerBusy) return;
    const draft = writerDraft.value.trim();
    if (draft.length < 3) { writerSetStatus('Add a draft or insert text from a page first.'); writerDraft.focus(); return; }
    writerBusy = true;
    writerLastResult = '';
    writerLastIsReview = !!reviewOnly;
    writerInputSnapshot = draft;
    ['writerRun','writerReview'].forEach(id => { $('#' + id).disabled = true; });
    ['writerCopyResult','writerApply','writerSaveResult'].forEach(id => { $('#' + id).disabled = true; });
    $('#writerResultTitle').textContent = reviewOnly ? 'Draft review' : 'Your improved draft';
    $('#writerResultMeta').textContent = 'Working with local Qwen…';
    setOut(writerResult, reviewOnly ? '_Reviewing structure, clarity, tone and correctness…_' : '_Editing your draft with local Qwen…_');
    writerSetStatus(reviewOnly ? 'Reviewing draft locally…' : 'Generating an improved draft locally…');
    O.orb.set('processing');
    try {
      const action = $('#writerAction').value;
      const tone = $('#writerTone').value;
      const audience = $('#writerAudience').value;
      const format = $('#writerFormat').value;
      const extra = $('#writerInstructions').value.trim();
      const brief = [
        reviewOnly ? 'Review the writing draft and provide specific, prioritised editorial feedback. Do not replace the full draft.' : 'Editing task: ' + (WRITER_TASKS[action] || WRITER_TASKS.rewrite),
        'Desired tone: ' + tone + '.',
        'Intended audience: ' + audience + '.',
        'Format: ' + format + '.',
        extra ? 'Additional user instructions: ' + extra : '',
        reviewOnly
          ? 'Give an overall assessment, identify strengths, list the most important improvements in priority order, and show up to three concrete before/after sentence-level suggestions when useful. Be constructive and precise.'
          : 'Return only the finished draft. Do not add an introduction, explanation of changes, grading, or Markdown code fence. Preserve the author’s meaning, factual claims, proper nouns, numbers, dates and existing citations. Do not invent facts, evidence, quotations, references or unsupported detail. If the draft contains an unclear factual gap, retain the uncertainty instead of guessing.'
      ].filter(Boolean).join('\n\n');
      const result = await O.localAI.askTask(reviewOnly ? 'writing_review' : 'writing', {
        draft,
        question: brief
      });
      writerLastResult = result;
      writerResult._raw = result;
      writerResult.innerHTML = O.md(result);
      $('#writerResultTitle').textContent = reviewOnly ? 'Editorial feedback' : 'Your improved draft';
      $('#writerResultMeta').textContent = (reviewOnly ? 'Review complete' : 'Draft ready') + ' · ' + (result.match(/[\p{L}\p{N}]+/gu) || []).length + ' words';
      $('#writerCopyResult').disabled = false;
      $('#writerApply').disabled = !!reviewOnly || writerDraft.value.trim() !== writerInputSnapshot;
      $('#writerSaveResult').disabled = false;
      writerSetStatus(reviewOnly ? 'Review complete · original draft preserved' : 'Draft improved · original text is still unchanged');
    } catch (error) {
      fail(writerResult, error);
      $('#writerResultMeta').textContent = 'Could not complete';
      writerSetStatus(error && error.message ? error.message : String(error));
    } finally {
      writerBusy = false;
      ['writerRun','writerReview'].forEach(id => { $('#' + id).disabled = false; });
      O.orb.set('idle');
    }
  }
  $('#writerRun').addEventListener('click', () => runWriter(false));
  $('#writerReview').addEventListener('click', () => runWriter(true));
  $('#writerCopyResult').addEventListener('click', async () => {
    if (!writerLastResult) return;
    try { await navigator.clipboard.writeText(writerLastResult); toast('Writing result copied'); }
    catch (_) { toast('Copy was blocked by the browser'); }
  });
  $('#writerApply').addEventListener('click', () => {
    if (!writerLastResult || writerLastIsReview || writerDraft.value.trim() !== writerInputSnapshot) return;
    writerPreviousDraft = writerDraft.value;
    writerDraft.value = writerLastResult.slice(0, WRITER_LIMIT);
    writerInputSnapshot = writerDraft.value.trim();
    writerDraft.dispatchEvent(new Event('input', { bubbles: true }));
    $('#writerRestore').disabled = false;
    $('#writerApply').disabled = true;
    toast('Result applied · your previous draft can be restored');
  });
  $('#writerSaveResult').addEventListener('click', async () => {
    if (!writerLastResult) return;
    try {
      const task = writerLastIsReview ? 'Editorial review' : 'Improved draft';
      await O.store.addVault({
        type: 'note',
        title: 'Writing assistant · ' + task + ' · ' + new Date().toLocaleDateString(),
        text: '## Original draft\n\n' + writerInputSnapshot + '\n\n## ' + task + '\n\n' + writerLastResult
      });
      toast('Writing result saved to your Knowledge Vault');
    } catch (error) { toast(error.message || String(error)); }
  });
  await restoreWriterState();

  /* ───── settings ───── */
  $('#sPart').checked = st.particles; $('#sType').checked = st.typing; $('#sCalm').checked = st.reduceMotion;
  const aiStatus = $('#aiStatus'), aiPrepare = $('#aiPrepare');
  async function refreshLocalAIStatus() {
    if (!O.localAI) { aiStatus.textContent = 'Local AI component did not load. Reload ORACLE.'; aiPrepare.disabled = true; return; }
    const info = await O.localAI.status();
    aiStatus.textContent = info.message;
    aiPrepare.disabled = info.state === 'unsupported' || info.state === 'unavailable';
    aiPrepare.textContent = info.state === 'available' ? 'Local AI loaded' : info.state === 'cached' ? 'Load cached model' : 'Download & prepare model';
  }
  refreshLocalAIStatus().catch(e => { aiStatus.textContent = e.message || String(e); });
  aiPrepare.onclick = async () => {
    aiPrepare.disabled = true;
    aiPrepare.textContent = 'Preparing…';
    aiStatus.textContent = 'Checking WebGPU and preparing the local model…';
    try {
      await O.localAI.prepare((percent, detail) => {
        const label = detail || (percent >= 100 ? 'Finishing model setup' : 'Preparing local model');
        aiStatus.textContent = percent >= 100 ? (label + ' (finalising…)') : (label + ' · ' + percent + '%');
      });
      aiStatus.textContent = 'Qwen is ready for AI-powered page analysis, chat, definitions and study tools.';
      aiPrepare.textContent = 'Local AI ready';
    } catch (error) {
      aiStatus.textContent = error && error.message ? error.message : String(error);
      aiPrepare.textContent = 'Try again';
    } finally {
      aiPrepare.disabled = false;
      const current = await O.localAI.status().catch(() => ({ state: 'unsupported' }));
      if (current.state === 'available') aiPrepare.textContent = 'Local AI loaded';
      else if (current.state === 'cached') aiPrepare.textContent = 'Load cached model';
      else aiPrepare.textContent = 'Download & prepare model';
      if (current.state === 'unsupported' || current.state === 'unavailable') aiPrepare.disabled = true;
    }
  };

  $('#sPart').onchange = e => O.store.saveSettings({ particles: e.target.checked });
  $('#sType').onchange = e => O.store.saveSettings({ typing: e.target.checked });
  $('#sCalm').onchange = e => { O.store.saveSettings({ reduceMotion: e.target.checked }); document.documentElement.classList.toggle('calm', e.target.checked); };
  $('#sShort').onclick = () => { const url = (navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome') + '://extensions/shortcuts'; chrome.tabs.create({ url }).catch(() => { $('#sShortMsg').textContent = 'Open ' + url + ' in a new tab.'; }); };
  $('#sClearChat').onclick = () => { $('#clear').click(); toast('Conversation cleared'); };
  $('#sClearAll').onclick = async () => { if (confirm('Delete ALL ORACLE data (chat, vault, bookmarks, settings)? This can’t be undone.')) { await O.store.clearAll(); location.hash = '#chat'; location.reload(); } };

  /* ───── command palette (Ctrl/Cmd+K) ───── */
  const run = async (m, title) => { show('analyse'); await renderMode(m); };
  const cmds = () => [
    ...[['chat', 'Chat'], ['analyse', 'Page analysis'], ['text', 'Text assistant'], ['writing', 'Writing assistant'], ['vault', 'Knowledge vault'], ['tools', 'Browser tools'], ['settings', 'Settings']].map(([p, t]) => ({ title: 'Go to ' + t, hint: 'panel', run: () => show(p) })),
    { title: 'Open writing assistant', hint: 'draft and refine text', run: () => show('writing') },
    { title: 'Analyse page', hint: 'selected page', run: async () => { show('analyse'); try { await analyse(); await renderMode(mode); } catch (e) { fail($('#aOut'), e); } } },
    ...[['quick', 'Quick summary'], ['detailed', 'Detailed summary'], ['keypoints', 'Key points'], ['simple', 'Explain simply'], ['study', 'Study mode'], ['facts', 'Fact extraction'], ['cards', 'Flashcards'], ['quiz', 'Quiz']].map(([m, t]) => ({ title: t, hint: 'analyse page', run: () => run(m) })),
    { title: 'Select duplicate tabs', hint: 'tab manager', run: () => { show('tools'); $('#tbDup').click(); } },
    { title: 'Save current page as bookmark', hint: 'bookmarks', run: () => { show('tools'); $('#bmSave').click(); } },
    { title: 'Clear conversation', hint: 'chat', run: () => { show('chat'); $('#clear').click(); } }
  ];
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); O.palette.open(cmds()); } });

  show(PANELS.includes(h0) ? h0 : 'chat');
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PANELS.includes(h)) show(h); });
  if (!tabId) { /* no target yet */ }
})().catch(error => {
  const message = error && error.message ? error.message : String(error);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;padding:14px 16px;border:1px solid #ef4444;border-radius:12px;background:#241018;color:#fff;font:14px/1.5 Segoe UI, sans-serif;box-shadow:0 8px 32px #0008';
  banner.textContent = 'ORACLE startup failed: ' + message + ' — reload the extension at edge://extensions, then reopen the dashboard.';
  document.body.appendChild(banner);
});