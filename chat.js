/* ORACLE chat controller shared by the popup and the dashboard. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});
  const hhmm = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  O.chat = {
    async mount(o) {
      const settings = await O.store.settings();
      const ctx = { last: '' };
      let busy = false, cache = { id: null, at: 0, doc: null };

      const tabId = () => (o.getTabId ? o.getTabId() : null);
      const env = {
        async getPage() {
          const t = await O.tools.targetTab(tabId());
          if (!t) throw new Error('Open a normal web page (http or https) in a tab first. ORACLE can’t read browser pages or its own pages.');
          if (cache.doc && cache.id === t.id && Date.now() - cache.at < 20000) return cache.doc;
          const doc = await O.tools.extract(t.id); cache = { id: t.id, at: Date.now(), doc }; return doc;
        },
        async getSelection() { const t = await O.tools.targetTab(tabId()); if (!t) throw new Error('No readable tab found.'); const s = await O.tools.selection(t.id); if (!s) throw new Error('Nothing is selected on that page.'); return s; },
        listTabs: () => O.tools.tabsSummary(),
        async find(term) { const t = await O.tools.targetTab(tabId()); if (!t) throw new Error('No readable tab found.'); const r = await O.tools.send(t.id, { type: 'oracle:find', term }); return r || { count: 0 }; },
        vaultSearch: q => O.store.searchVault(q),
        async askAI(question, doc, selection, task, extra) {
          if (!O.localAI) throw new Error('The shared Local AI bridge did not load. Reload the ORACLE extension and try again.');
          const history = await O.store.conversation();
          if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].text === question) history.pop();
          const knowledge = await O.store.searchVault(question).catch(() => []);
          const options = Object.assign({
            page: doc || null,
            selection: selection || '',
            history,
            knowledge: Array.isArray(knowledge) ? knowledge.slice(0, 2) : []
          }, extra || {});
          return task ? O.localAI.askTask(task, Object.assign(options, { question })) : O.localAI.ask(question, options);
        },
        vaultDefs: async () => (await O.store.vault()).filter(e => e.type === 'definition'),
        async lookupDefinition(word) {
          const result = await chrome.runtime.sendMessage({ type: 'oracle:dictionaryLookup', word });
          if (!result || !result.ok || !result.senses || !result.senses.length) return null;
          const senses = result.senses.map((sense, i) => {
            const pos = sense.pos ? ' *(' + sense.pos + ')*' : '';
            const examples = (sense.examples || []).map(example => '> Example: “' + example + '”').join('\n');
            return (i + 1) + '. ' + sense.definition + pos + (examples ? '\n' + examples : '');
          }).join('\n\n');
          return '**' + word + '**\n\n' + senses + '\n\n> Source: Open English Wordnet (CC BY 4.0). This definition was saved locally for future offline lookups.';
        },
        async savePage(kind) {
          const t = await O.tools.targetTab(tabId()); if (!t) throw new Error('No readable tab found.');
          if (kind === 'bookmark') { await O.tools.bookmarkPage(t.id, 'Read later'); return `Bookmarked **${t.title || t.url}** under “Read later”.`; }
          const doc = await env.getPage();
          const summary = await env.askAI('Create a useful summary of this page for my Knowledge Vault.', doc, '', 'quick');
          await O.store.addVault({ type: 'summary', title: doc.title, text: O.plain(summary), url: doc.url });
          return `Saved an AI-written summary of **${doc.title}** to your Knowledge Vault.`;
        }
      };

      /* rendering */
      const log = o.log;
      const scroll = () => { log.scrollTop = log.scrollHeight; };
      function emptyState() {
        if (log.children.length) return;
        log.innerHTML = `<div class="empty"><div>${o.compact ? '' : ''}</div><h3>Ready when you are</h3><p>Open a web page, then ask me to summarise it, pull out key points, find dates or make revision notes. Everything is processed on this device.</p></div>`;
      }
      function bubble(role, text, ts, err) {
        const e = log.querySelector('.empty'); if (e) e.remove();
        const el = document.createElement('div'); el.className = 'msg ' + role + (err ? ' err' : '');
        const body = document.createElement('div'); body.className = 'md'; el.appendChild(body);
        const meta = document.createElement('div'); meta.className = 'meta'; meta.innerHTML = `<time>${hhmm(ts)}</time>`;
        if (role === 'bot') { const c = document.createElement('button'); c.textContent = 'Copy'; c.onclick = async () => { try { await navigator.clipboard.writeText(O.plain(text)); c.textContent = 'Copied'; } catch (x) { c.textContent = 'Blocked'; } setTimeout(() => (c.textContent = 'Copy'), 1300); }; meta.appendChild(c); }
        el.appendChild(meta); log.appendChild(el);
        if (role === 'user') body.textContent = text; else body.innerHTML = O.md(text);
        scroll(); return { el, body };
      }
      function setChips(list) {
        if (!o.chips) return; o.chips.innerHTML = '';
        (list || O.engine.SUG.default).slice(0, 4).forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = s; b.onclick = () => send(s); o.chips.appendChild(b); });
      }
      async function typeIn(body, text) {
        if (!settings.typing || settings.reduceMotion || text.length > 900) { body.innerHTML = O.md(text); return; }
        const plain = O.plain(text); const step = Math.max(2, Math.ceil(plain.length / 90));
        body.textContent = '';
        for (let i = 0; i < plain.length; i += step) { body.textContent = plain.slice(0, i + step); scroll(); await sleep(14); }
        body.innerHTML = O.md(text); scroll();
      }

      /* history */
      const hist = await O.store.conversation();
      hist.forEach(m => bubble(m.role, m.text, m.ts, m.err));
      const lastBot = [...hist].reverse().find(m => m.role === 'bot'); if (lastBot) ctx.last = lastBot.text;
      emptyState(); setChips(); scroll();

      async function send(text) {
        text = (text || '').trim();
        if (!text || busy) return;
        busy = true;
        let pending = null;
        let userText = text;
        try {
          const ts = Date.now();
          bubble('user', text, ts);
          await O.store.pushMessage({ role: 'user', text, ts });
          pending = document.createElement('div');
          pending.className = 'msg bot';
          pending.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
          log.appendChild(pending);
          scroll();

          const pageish = /summar|point|simpl|note|date|fact|flash|quiz|overview|link|heading|keyword|stat|read|explain|compare|find|save|study|what|who|when|how/i.test(text);
          O.orb.set(pageish ? 'analysing' : 'processing');
          const t0 = Date.now();
          let res;
          try {
            const intent = O.engine.detect(text.toLowerCase()).id;
            const aiTasks = {
              summarize: 'quick',
              summarize_detailed: 'detailed',
              keypoints: 'keypoints',
              simplify: 'simple',
              study: 'study',
              facts: 'facts',
              flashcards: 'cards',
              quiz: 'quiz',
              define: 'define',
              explain: 'explain'
            };
            const task = aiTasks[intent];
            if ((task || intent === 'none') && O.localAI) {
              let doc = null, selection = '', extra = {};
              const asksForSelection = /\b(selected|selection|highlight)\b/i.test(text);
              const asksAboutPage = /\b(this|current|that|the)\s+(page|article|website|site|post|text|passage|document)\b|\b(on|in|from)\s+(this|the)\s+(page|article|website|site|post)\b/i.test(text);
              const pageTask = ['quick', 'detailed', 'keypoints', 'study', 'facts', 'cards', 'quiz'].includes(task);
              if (asksForSelection) selection = await env.getSelection();
              else if (pageTask || asksAboutPage) doc = await env.getPage();
              else if (['simple', 'explain', 'keypoints'].includes(task) && ctx.last && /\b(that|this|it|previous|last|above|again)\b/i.test(text)) selection = O.plain(ctx.last).slice(0, 3200);

              if (task === 'define') {
                const found = text.match(/(?:define|definition of|meaning of|what does)\s+["“'‘]?([\p{L}][\p{L}'’\-]{0,59})/iu);
                const word = found ? found[1].toLowerCase() : '';
                if (word) {
                  const userDefs = await env.vaultDefs();
                  let reference = '';
                  if (O.dictionaryFull) {
                    const entry = await O.dictionaryFull.lookup(word).catch(() => null);
                    if (entry) reference = O.dictionaryFull.format(entry);
                  }
                  if (!reference) reference = O.engine.defineWord(word, doc, userDefs);
                  extra.reference = reference;
                }
              }
              const answer = await env.askAI(text, doc, selection, task, extra);
              res = { text: answer, state: 'responding', intent: 'local-ai', suggestions: O.engine.SUG.default };
            } else {
              res = await O.engine.handle(text, env, ctx);
            }
          } catch (e) {
            res = { text: '**Assistant error.** ' + (e && e.message ? e.message : String(e)), state: 'error', suggestions: ['Help'] };
          }

          await sleep(Math.max(0, 450 - (Date.now() - t0)));
          if (pending) pending.remove();
          pending = null;
          if (res && res.clear) {
            await O.store.clearConversation();
            log.innerHTML = '';
            ctx.last = '';
            emptyState();
            setChips();
            O.orb.set('idle');
            return;
          }

          const answerText = res && typeof res.text === 'string' ? res.text : 'The assistant returned no response. Please try again.';
          const err = !res || res.state === 'error';
          O.orb.set(err ? 'error' : 'responding', err ? 1800 : 0);
          const b = bubble('bot', '', Date.now(), err);
          await typeIn(b.body, answerText);
          await O.store.pushMessage({ role: 'bot', text: answerText, ts: Date.now(), err });
          ctx.last = answerText;
          setChips(res && res.suggestions);
          if (!err) O.orb.set('idle');
        } catch (e) {
          if (pending) pending.remove();
          const message = '**Chat error.** ' + (e && e.message ? e.message : String(e));
          try {
            const b = bubble('bot', '', Date.now(), true);
            b.body.textContent = message;
          } catch (_) { /* Keep the chat unlocked even if rendering failed. */ }
          O.orb.set('error', 1800);
        } finally {
          busy = false;
        }
      }

      o.form.addEventListener('submit', e => { e.preventDefault(); const v = o.input.value; o.input.value = ''; send(v); });
      if (o.clearBtn) o.clearBtn.onclick = async () => { await O.store.clearConversation(); log.innerHTML = ''; ctx.last = ''; emptyState(); setChips(); };
      return { send, env, invalidate() { cache = { id: null, at: 0, doc: null }; } };
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
