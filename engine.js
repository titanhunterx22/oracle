/* ORACLE local intelligence engine.
   Everything here is classic rule-based text processing (word frequencies, sentence scoring,
   regular expressions, small built-in glossaries). There is NO language model and NO network access.
   Outputs are "markdown-lite": ## headings, - bullets, **bold**, > quotes. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});

  /* ───────── basics ───────── */
  const STOP = new Set(('a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours said says say may might one two get got like use used using however thus per via yet still even much many make made new').split(' '));
  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';
  const NOT_NAMES = new Set(('The A An This That These Those It He She They We You I In On At For And But Or If When While After Before However Although Because Since As By With From To Of Not No Yes What Who Where Why How Which There Here Then Also Some Many Most Other Each Every One Two Three First Second Last Monday Tuesday Wednesday Thursday Friday Saturday Sunday ' + MONTHS.replace(/\|/g, ' ')).split(' '));

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = t => (String(t).toLowerCase().match(/[a-z\u00c0-\u024f0-9]+(?:['’-][a-z\u00c0-\u024f0-9]+)*/g) || []);
  const stem = w => { w = w.toLowerCase(); if (w.length <= 4) return w; return w.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, ''); };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  const uniq = a => [...new Set(a)];

  function sentences(t) {
    t = String(t).replace(/\s+/g, ' ').trim();
    if (!t) return [];
    const abbr = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Fig|approx|Inc|Ltd|U\.S|U\.K|Co)\.$/;
    const out = []; let cur = '';
    for (const p of t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(\[])/)) {
      cur = cur ? cur + ' ' + p : p;
      if (abbr.test(cur) || /\b[A-Z]\.$/.test(cur)) continue;
      out.push(cur); cur = '';
    }
    if (cur) out.push(cur);
    return out.map(s => s.trim()).filter(s => s.length > 1);
  }

  function syll(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 3) return w ? 1 : 0;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }

  function readStats(text) {
    const ws = words(text), ss = sentences(text);
    const n = ws.length;
    if (n < 5) return { words: n, sentences: ss.length, minutes: Math.max(1, Math.round(n / 230)), ease: null, grade: null, label: 'Too short to rate', longWordPct: 0 };
    const syl = ws.reduce((a, w) => a + syll(w), 0);
    const wps = n / Math.max(1, ss.length), spw = syl / n;
    const ease = 206.835 - 1.015 * wps - 84.6 * spw;
    const grade = 0.39 * wps + 11.8 * spw - 15.59;
    const label = ease >= 70 ? 'Easy' : ease >= 50 ? 'Standard' : ease >= 30 ? 'Difficult' : 'Very difficult';
    return { words: n, sentences: ss.length, minutes: Math.max(1, Math.round(n / 230)), ease: Math.round(ease), grade: Math.max(0, Math.round(grade * 10) / 10), label, longWordPct: Math.round(100 * ws.filter(w => w.length >= 9).length / n), avgSentence: Math.round(wps) };
  }

  function keywords(text, n = 10, minCount = 1) {
    const map = new Map();
    for (const w of words(text)) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      const s = stem(w); const e = map.get(s) || { count: 0, forms: new Map() };
      e.count++; e.forms.set(w, (e.forms.get(w) || 0) + 1); map.set(s, e);
    }
    return [...map.entries()].filter(([, e]) => e.count >= minCount)
      .map(([s, e]) => ({ stem: s, count: e.count, word: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
      .sort((a, b) => b.count - a.count).slice(0, n);
  }
  function freqMap(text) {
    const m = new Map(); let max = 1;
    for (const w of words(text)) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      const s = stem(w), c = (m.get(s) || 0) + 1; m.set(s, c); if (c > max) max = c;
    }
    for (const [k, v] of m) m.set(k, v / max);
    return m;
  }
  function scoreSentence(s, freq, title, pos, total) {
    const toks = words(s), n = toks.length;
    if (n < 5) return 0;
    let sum = 0;
    for (const w of toks) if (!STOP.has(w) && w.length >= 3) sum += freq.get(stem(w)) || 0;
    let sc = sum / Math.pow(n, 0.7);
    if (title && title.size) { let o = 0; for (const w of toks) if (title.has(stem(w))) o++; sc += 0.15 * Math.min(o, 4); }
    if (/\d/.test(s)) sc *= 1.08;
    if (pos != null && total) { if (pos < 2) sc *= 1.25; else if (pos < total * 0.15) sc *= 1.1; }
    if (n > 45) sc *= 0.7;
    if (/^(click|share|subscribe|sign up|read more|follow us|copyright|©|cookie|we use cookies)/i.test(s)) sc *= 0.1;
    return sc;
  }

  /* ───────── document model ───────── */
  // doc = { title, url, domain, blocks:[{t:'h2'|'p'|'li'|'q',text}], links:[{text,href,external}], text, wordCount }
  const cache = new WeakMap();
  function textToDoc(text, title) {
    const blocks = String(text).split(/\n+/).map(s => s.trim()).filter(Boolean).map(t => ({ t: 'p', text: t }));
    return { title: title || '', url: '', domain: '', blocks, links: [], text: blocks.map(b => b.text).join('\n'), wordCount: words(text).length };
  }
  function A(doc) {
    let a = cache.get(doc); if (a) return a;
    const body = doc.blocks.filter(b => b.t[0] !== 'h');
    const sents = []; body.forEach(b => sentences(b.text).forEach(s => sents.push(s)));
    const bodyText = body.map(b => b.text).join('\n') || doc.text || '';
    const freq = freqMap(bodyText);
    const title = new Set(words(doc.title || '').filter(w => !STOP.has(w)).map(stem));
    const ranked = sents.map((s, i) => ({ i, s, score: scoreSentence(s, freq, title, i, sents.length) }));
    a = { sents, bodyText, freq, title, ranked, kw: keywords(bodyText, 15) };
    cache.set(doc, a); return a;
  }
  function top(doc, n, pool) {
    const a = A(doc);
    const r = (pool || a.ranked).filter(x => x.score > 0).slice().sort((x, y) => y.score - x.score);
    const out = [], seen = [];
    for (const c of r) {
      if (out.length >= n) break;
      const ws = new Set(words(c.s));
      if (seen.some(o => { let k = 0; for (const w of ws) if (o.has(w)) k++; return k / Math.max(1, ws.size) > 0.7; })) continue;
      seen.push(ws); out.push(c);
    }
    return out.sort((x, y) => x.i - y.i);
  }
  function sections(doc) {
    const out = []; let cur = { heading: doc.title || 'Overview', text: [] };
    for (const b of doc.blocks) {
      if (/^h[2-4]$/.test(b.t) || (b.t === 'h1' && cur.text.length)) { out.push(cur); cur = { heading: b.text, text: [] }; }
      else if (b.t[0] !== 'h') cur.text.push(b.text);
    }
    out.push(cur);
    return out.map(s => ({ heading: s.heading, body: s.text.join(' ') })).filter(s => s.body.length > 60);
  }
  const tooShort = doc => (A(doc).bodyText.length < 120);
  const SHORT = '**There isn’t enough readable text on this page to analyse.** Try a page with articles or paragraphs, or reload the tab and run it again.';

  /* ───────── extraction helpers ───────── */
  function dates(text) {
    const out = [];
    const res = [
      new RegExp('\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?(?:' + MONTHS + ')\\.?(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?(?:,?\\s+\\d{4})?\\b', 'g'),
      /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
      /\b\d{1,2}(?:st|nd|rd|th) century\b/gi,
      /\b(?:1[0-9]{3}|20[0-9]{2})s?\b/g
    ];
    for (const s of sentences(text)) {
      const found = new Set();
      res.forEach((re, k) => { for (const m of s.matchAll(re)) { const t = m[0].trim(); if (k === 0 && !/\d/.test(t)) continue; if ([...found].some(f => f.includes(t))) continue; found.add(t); } });
      found.forEach(d => out.push({ value: d, sentence: s }));
    }
    const seen = new Set(); return out.filter(d => !seen.has(d.value + d.sentence) && seen.add(d.value + d.sentence));
  }
  function figures(text) {
    const out = [];
    const re = /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|thousand|[kmbKMB]\b))?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent|per cent|million|billion|trillion|thousand|km|kg|miles|mph|years|degrees|°C|°F|people|users|tonnes|hectares|GB|MB|TB|hours|minutes))/g;
    for (const s of sentences(text)) for (const m of s.matchAll(re)) out.push({ value: m[0].trim(), sentence: s });
    const seen = new Set(); return out.filter(d => !seen.has(d.value + d.sentence) && seen.add(d.value + d.sentence));
  }
  function names(text) {
    const count = new Map();
    for (const s of sentences(text)) {
      const toks = s.split(/\s+/); let run = [];
      const flush = (startIdx) => {
        if (!run.length) return;
        const first = startIdx === 0;
        let r = run.slice();
        if (first && r.length === 1) { run = []; return; }
        if (first) while (r.length && NOT_NAMES.has(r[0])) r.shift();
        if (!r.length || (r.length === 1 && (NOT_NAMES.has(r[0]) || r[0].length < 3))) { run = []; return; }
        const n = r.join(' '); count.set(n, (count.get(n) || 0) + 1); run = [];
      };
      let start = 0;
      toks.forEach((tk, idx) => {
        const clean = tk.replace(/^[("“‘]+|[)"”’.,;:!?]+$/g, '');
        if (/^[A-Z][a-zA-Z'’-]+$/.test(clean) || /^[A-Z]{2,6}$/.test(clean)) { if (!run.length) start = idx; run.push(clean); if (/[.,;:!?]$/.test(tk)) flush(start); }
        else flush(start);
      });
      flush(start);
    }
    return [...count.entries()].filter(([n]) => !NOT_NAMES.has(n)).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 15);
  }
  function claims(doc) {
    const re = /\b(according to|study|studies|research|researchers|found that|reported|claims?|claimed|survey|evidence|experts?|scientists?|percent|statistics?|estimated|announced|revealed|suggests?|shows? that|proved|proven)\b/i;
    const a = A(doc);
    return a.ranked.filter(r => re.test(r.s) && r.s.length < 320).sort((x, y) => y.score - x.score).slice(0, 8).sort((x, y) => x.i - y.i).map(r => r.s);
  }
  function definitions(text) {
    const out = [];
    const re = /^(?:The |A |An )?([A-Z][\w\- ]{2,45}?) (?:is|are|refers to|means|can be defined as|describes|was) (?:a |an |the )?(.{15,220}?)[.;]?$/;
    for (const s of sentences(text)) {
      const m = s.match(re);
      if (m && m[1].split(' ').length <= 5 && !/^(It|This|That|There|He|She|They|We|You|What|Which|Who)\b/.test(m[1])) out.push({ term: m[1].trim(), def: m[2].trim(), sentence: s });
    }
    return out;
  }

  /* ───────── simplifying ───────── */
  const SIMPLE = { utilize: 'use', utilise: 'use', approximately: 'about', demonstrate: 'show', demonstrates: 'shows', numerous: 'many', commence: 'start', subsequently: 'later', therefore: 'so', nevertheless: 'still', additionally: 'also', furthermore: 'also', moreover: 'also', consequently: 'so', 'in order to': 'to', 'due to the fact that': 'because', 'a number of': 'several', 'prior to': 'before', 'in addition to': 'besides', facilitate: 'help', obtain: 'get', require: 'need', requires: 'needs', required: 'needed', assist: 'help', purchase: 'buy', sufficient: 'enough', individuals: 'people', endeavour: 'try', endeavor: 'try', regarding: 'about', methodology: 'method', significant: 'important', significantly: 'greatly', comprehend: 'understand', ascertain: 'find out', terminate: 'end', initiate: 'start', implement: 'carry out', indicate: 'show', indicates: 'shows', subsequent: 'later', commonly: 'often', primarily: 'mainly', fundamental: 'basic', 'in the event that': 'if', 'with regard to': 'about', 'as a result of': 'because of', 'at this point in time': 'now', 'in spite of': 'despite', 'a majority of': 'most', attempt: 'try', beneficial: 'helpful', component: 'part', components: 'parts', construct: 'build', currently: 'now', determine: 'find out', eliminate: 'remove', enhance: 'improve', ensure: 'make sure', establish: 'set up', exhibit: 'show', fundamentally: 'at heart', generate: 'create', illustrate: 'show', inadequate: 'not enough', modify: 'change', notwithstanding: 'despite', objective: 'goal', occur: 'happen', optimal: 'best', participate: 'take part', previously: 'before', proceed: 'go ahead', provide: 'give', reside: 'live', retain: 'keep', sufficiently: 'enough', transmit: 'send', typically: 'usually', ultimately: 'in the end', whereas: 'while', hence: 'so', thereby: 'by doing so', thus: 'so', 'in conjunction with': 'with', 'for the purpose of': 'to', 'it is important to note that': 'note that', 'is able to': 'can', 'has the ability to': 'can' };
  const SIMPLE_RE = new RegExp('\\b(' + Object.keys(SIMPLE).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'gi');
  function simplifyText(t) {
    let out = String(t).replace(SIMPLE_RE, (m) => { const r = SIMPLE[m.toLowerCase()]; return m[0] === m[0].toUpperCase() ? cap(r) : r; });
    out = out.replace(/\s*\((?:[^()]{0,80})\)/g, m => (/\d/.test(m) ? m : ''));
    return sentences(out).map(s => {
      if (words(s).length <= 26) return s;
      let r = s;
      r = r.replace(/; (\w)/g, (m, c) => '. ' + c.toUpperCase());
      r = r.replace(/, which /g, '. This ').replace(/ — /g, '. ');
      r = r.replace(/, (and|but) (?=\w)/g, (m, w, off, str) => { const left = str.slice(0, off), right = str.slice(off + m.length); return (words(left).length >= 8 && words(right).length >= 8) ? '. ' + (w === 'but' ? 'But ' : '') : m; });
      return r.replace(/\.\s+([a-z])/g, (m, c) => '. ' + c.toUpperCase());
    }).join(' ');
  }

  /* ───────── glossary + word parts ───────── */
  const GLOSS = Object.assign({}, O.dictionaryEntries || {});
  `ubiquitous|present or found everywhere
paradigm|a typical model or pattern; a whole way of thinking about something
hypothesis|a proposed explanation that can be tested
empirical|based on observation or experiment rather than theory
ambiguous|open to more than one meaning
inherent|existing as a natural, built-in part of something
mitigate|to make something less severe or harmful
exacerbate|to make a problem worse
ubiquity|the state of being everywhere at once
pragmatic|dealing with things in a practical, realistic way
arbitrary|based on chance or personal choice, not reason
coherent|logical, consistent and easy to follow
correlation|a relationship where two things tend to change together
causation|the process of one thing directly causing another
derivative|something made from or based on something else
discrete|separate and distinct
ephemeral|lasting a very short time
equilibrium|a state of balance
fluctuate|to rise and fall irregularly
heuristic|a practical rule of thumb that helps solve problems
implicit|suggested but not directly stated
explicit|stated clearly and directly
infrastructure|the basic systems and structures a society or project relies on
innovative|introducing new ideas or methods
integrate|to combine parts into a whole
metabolism|the chemical processes that keep a living thing alive
methodology|a system of methods used in a field of study
nuance|a subtle difference in meaning or expression
obsolete|no longer used or useful
phenomenon|a notable fact or event that can be observed
plausible|seeming reasonable or believable
precedent|an earlier event used as an example or guide
prevalent|widespread; common at a particular time or place
proliferate|to increase rapidly in number
rationale|the reasons behind a decision or belief
redundant|not needed; unnecessary
resilient|able to recover quickly from difficulty
scrutiny|careful, critical examination
skeptical|doubtful; not easily convinced
sustainable|able to continue without running out or causing lasting harm
synthesis|combining separate elements into a whole
tangible|real and able to be touched or measured
volatile|likely to change quickly or unpredictably
algorithm|a step-by-step set of rules for solving a problem
bandwidth|the amount of data that can pass through a connection per second
cache|a store of saved data kept for quick reuse
encryption|scrambling information so only authorised people can read it
latency|the delay before a transfer of data begins
protocol|an agreed set of rules for communication
bias|a tendency to favour one thing over another unfairly
inflation|a general rise in prices over time
recession|a period of economic decline
liquidity|how easily an asset can be turned into cash
monopoly|control of a market by a single seller
subsidy|money given by a government to support an industry
legislation|laws, considered as a group
jurisdiction|the official power to make legal decisions in an area
sovereignty|the authority of a state to govern itself
democracy|government by the people, usually through elections
ecosystem|a community of living things and their environment
biodiversity|the variety of life in an area
photosynthesis|how plants turn light, water and carbon dioxide into food
mitosis|cell division that produces two identical cells
genome|the complete set of genetic material in an organism
catalyst|something that speeds up a reaction without being used up
entropy|a measure of disorder in a system
velocity|speed in a particular direction
inertia|the tendency of an object to keep doing what it is already doing
hydrocarbon|a compound made only of hydrogen and carbon
anomaly|something that differs from what is normal or expected
benchmark|a standard used for comparison
consensus|general agreement among a group
criterion|a standard for judging something
dichotomy|a split into two opposing parts
dynamic|constantly changing or active
framework|a basic structure or set of ideas that supports something
hierarchy|a system that ranks things one above another
iterate|to repeat a process to improve it
leverage|to use something to maximum advantage
paradox|a statement that seems contradictory but may be true
perspective|a particular way of viewing things
proficiency|a high degree of skill
rhetoric|the art of persuasive speaking or writing
spectrum|a range of different positions or values
subjective|based on personal feelings or opinions
objective|not influenced by personal feelings; also, a goal
trajectory|the path something follows through space or time
variable|something that can change
verify|to check that something is true`.split('\n').forEach(l => { const i = l.indexOf('|'); GLOSS[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const PRE = { anti: 'against', auto: 'self', bi: 'two', co: 'together', counter: 'against', de: 'remove / reverse', dis: 'not / apart', en: 'cause to be', ex: 'out / former', extra: 'beyond', hyper: 'over / excessive', hypo: 'under', inter: 'between', intra: 'within', macro: 'large', micro: 'small', mis: 'wrongly', multi: 'many', non: 'not', over: 'too much', poly: 'many', post: 'after', pre: 'before', pro: 'for / forward', re: 'again / back', semi: 'half', sub: 'under', super: 'above', trans: 'across', tri: 'three', ultra: 'beyond', un: 'not / reverse', under: 'too little', geo: 'earth', bio: 'life', thermo: 'heat', neuro: 'nerve / brain', psych: 'mind' };
  const SUF = { tion: 'the act or result of', sion: 'the act or result of', ment: 'the result or means of', ness: 'the state of being', ity: 'the quality of', ism: 'a belief or system', ist: 'a person who practises', ology: 'the study of', graphy: 'writing / recording of', able: 'able to be', ible: 'able to be', ous: 'full of', ive: 'tending to', ize: 'to make', ise: 'to make', ify: 'to make', less: 'without', ful: 'full of', ical: 'relating to', ic: 'relating to', al: 'relating to', ance: 'the state of', ence: 'the state of', ship: 'the state or skill of' };
  function wordParts(w) {
    const parts = []; let rest = w;
    const p = Object.keys(PRE).sort((a, b) => b.length - a.length).find(k => rest.startsWith(k) && rest.length - k.length >= 4);
    if (p) { parts.push(`**${p}-** (${PRE[p]})`); rest = rest.slice(p.length); }
    const s = Object.keys(SUF).sort((a, b) => b.length - a.length).find(k => rest.endsWith(k) && rest.length - k.length >= 3);
    if (s) { parts.push(`**${rest.slice(0, -s.length)}**`); parts.push(`**-${s}** (${SUF[s]})`); } else parts.push(`**${rest}**`);
    return parts.length > 1 ? parts.join(' + ') : '';
  }
  function dictionaryDistance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 3) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        rowMin = Math.min(rowMin, next[j]);
      }
      if (rowMin > 3) return 99;
      prev = next;
    }
    return prev[b.length];
  }
  function dictionarySuggestions(query) {
    const limit = query.length <= 5 ? 1 : query.length <= 9 ? 2 : 3;
    return Object.keys(GLOSS).map(word => ({
      word,
      distance: dictionaryDistance(query, word),
      prefix: word.startsWith(query) || query.startsWith(word)
    })).filter(x => x.distance > 0 && x.distance <= limit)
      .sort((a, b) => a.distance - b.distance || Number(b.prefix) - Number(a.prefix) || a.word.localeCompare(b.word))
      .slice(0, 3).map(x => x.word);
  }
  function defineWord(w, doc, userDefs) {
    w = String(w || '').toLowerCase().trim().replace(/^["“'‘]+|["”'’.?!,:;]+$/g, '').replace(/\s+/g, ' ');
    if (!w) return 'Enter a word to look up.';
    const out = [];
    const normalise = value => String(value || '').toLowerCase().trim().replace(/^["“'‘]+|["”'’.?!,:;]+$/g, '');
    const mine = (userDefs || []).find(d => normalise(d.title) === w);
    const candidates = [w];
    const add = x => { if (x && !candidates.includes(x)) candidates.push(x); };
    add(stem(w));
    if (/ies$/.test(w) && w.length > 4) add(w.slice(0, -3) + 'y');
    if (/ied$/.test(w) && w.length > 4) add(w.slice(0, -3) + 'y');
    if (/ves$/.test(w) && w.length > 4) { add(w.slice(0, -3) + 'f'); add(w.slice(0, -3) + 'fe'); }
    if (/ing$/.test(w) && w.length > 5) {
      const base = w.slice(0, -3); add(base);
      if (/(.)\1$/.test(base)) add(base.slice(0, -1));
      add(base + 'e');
    }
    if (/ed$/.test(w) && w.length > 4) {
      const base = w.slice(0, -2); add(base);
      if (/(.)\1$/.test(base)) add(base.slice(0, -1));
      add(base + 'e');
    }
    if (/(er|est)$/.test(w) && w.length > 5) {
      const base = w.replace(/(er|est)$/, ''); add(base);
      if (/(.)\1$/.test(base)) add(base.slice(0, -1));
      add(base + 'e');
      if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
    }
    if (/s$/.test(w) && w.length > 3) add(w.slice(0, -1));
    if (/es$/.test(w) && w.length > 4) add(w.slice(0, -2));
    const hit = candidates.find(x => GLOSS[x]);
    if (mine) out.push('**' + w + '** — ' + mine.text + '\n(from your Knowledge Vault)');
    else if (hit) {
      out.push('**' + w + '**' + (hit !== w ? ' *(base form: ' + hit + ')*' : '') + ' — ' + GLOSS[hit] + '.');
      out.push('> Source: ORACLE’s built-in offline English glossary.');
    } else {
      out.push('**' + w + '** isn’t in ORACLE’s bundled definition set yet. The dictionary is fully offline, so an unlisted word won’t be sent to an external service.');
      const suggestions = w.includes(' ') ? [] : dictionarySuggestions(w);
      if (suggestions.length) out.push('**Possible matches:** ' + suggestions.map(x => '**' + x + '**').join(', ') + '. Try one of these spellings.');
      const wp = wordParts(w); if (wp) out.push('Word parts that might help: ' + wp);
      out.push('You can add your own meaning in **Knowledge vault → Add an entry → Definition**; ORACLE will use it in future lookups.');
    }
    if (doc) {
      const re = new RegExp('\\b' + w.replace(/[.*+?^$()|[\]\\]/g, '\\$&') + '\\b', 'i');
      const sentence = A(doc).sents.find(x => re.test(x));
      if (sentence) out.push('> On this page: ' + clip(sentence, 260));
    }
    return out.join('\n\n');
  }
  function hardWords(text, n = 8) {
    const seen = new Map();
    for (const w of words(text)) { if (w.length < 8 || STOP.has(w) || /\d/.test(w)) continue; seen.set(w, (seen.get(w) || 0) + 1); }
    return [...seen.keys()].map(w => ({ w, s: syll(w) * 2 + w.length / 4 + (GLOSS[w] ? 5 : 0) })).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.w);
  }

  /* ───────── translation (tiny offline glossary) ───────── */
  const DICT = {};
  `the|el / la|le / la|der / die / das
a|un / una|un / une|ein / eine
and|y|et|und
is|es / está|est|ist
are|son / están|sont|sind
of|de|de|von
to|a / para|à / pour|zu
in|en|dans / en|in
on|en / sobre|sur|auf
with|con|avec|mit
for|para / por|pour|für
not|no|ne … pas|nicht
yes|sí|oui|ja
no|no|non|nein
hello|hola|bonjour|hallo
goodbye|adiós|au revoir|auf Wiedersehen
thank you|gracias|merci|danke
please|por favor|s’il vous plaît|bitte
i|yo|je|ich
you|tú / usted|tu / vous|du / Sie
he|él|il|er
she|ella|elle|sie
we|nosotros|nous|wir
they|ellos|ils|sie
this|este / esto|ce / ceci|dies
that|ese / eso|cela|das
what|qué|quoi / que|was
who|quién|qui|wer
where|dónde|où|wo
when|cuándo|quand|wann
why|por qué|pourquoi|warum
how|cómo|comment|wie
water|agua|eau|Wasser
food|comida|nourriture|Essen
house|casa|maison|Haus
book|libro|livre|Buch
time|tiempo|temps|Zeit
day|día|jour|Tag
night|noche|nuit|Nacht
year|año|an / année|Jahr
man|hombre|homme|Mann
woman|mujer|femme|Frau
child|niño|enfant|Kind
people|gente / personas|gens / personnes|Leute
world|mundo|monde|Welt
life|vida|vie|Leben
work|trabajo|travail|Arbeit
school|escuela|école|Schule
city|ciudad|ville|Stadt
country|país|pays|Land
good|bueno|bon|gut
bad|malo|mauvais|schlecht
big|grande|grand|groß
small|pequeño|petit|klein
new|nuevo|nouveau|neu
old|viejo|vieux|alt
many|muchos|beaucoup|viele
all|todo|tout|alle
one|uno|un|eins
two|dos|deux|zwei
three|tres|trois|drei
important|importante|important|wichtig
information|información|information|Information
science|ciencia|science|Wissenschaft
history|historia|histoire|Geschichte
knowledge|conocimiento|connaissance|Wissen
learn|aprender|apprendre|lernen
understand|entender|comprendre|verstehen
read|leer|lire|lesen
write|escribir|écrire|schreiben
page|página|page|Seite
question|pregunta|question|Frage
answer|respuesta|réponse|Antwort
example|ejemplo|exemple|Beispiel
because|porque|parce que|weil
but|pero|mais|aber
or|o|ou|oder
if|si|si|wenn
more|más|plus|mehr
very|muy|très|sehr
also|también|aussi|auch
computer|computadora|ordinateur|Computer
internet|internet|internet|Internet`.split('\n').forEach(l => { const p = l.split('|'); DICT[p[0]] = { es: p[1], fr: p[2], de: p[3] }; });
  function translate(text, lang) {
    const name = { es: 'Spanish', fr: 'French', de: 'German' }[lang];
    const toks = String(text).match(/[A-Za-z\u00c0-\u024f’']+|[^\sA-Za-z\u00c0-\u024f’']+/g) || [];
    let known = 0, total = 0;
    const out = toks.map(t => {
      if (!/[A-Za-z]/.test(t)) return t;
      total++; const e = DICT[t.toLowerCase().replace(/’/g, "'")];
      if (e) { known++; return e[lang].split(' / ')[0]; }
      return `[${t}]`;
    }).join(' ').replace(/\s+([.,;:!?])/g, '$1');
    const pct = total ? Math.round(100 * known / total) : 0;
    return `## Word-by-word glossary → ${name}\n${out}\n\n**Coverage:** ${known} of ${total} words (${pct}%). Words in [brackets] aren’t in ORACLE’s small built-in dictionary (about ${Object.keys(DICT).length} common words per language).\n\n**Be aware:** this swaps single words and ignores grammar, word order and idioms, so it is a reading aid, not a real translation. ORACLE can’t do proper translation without sending text to an online service.`;
  }

  /* ───────── analysis modes (all take a doc, return markdown-lite) ───────── */
  const head = d => d.title ? '## ' + d.title + '\n' : '';
  const sub = d => [d.domain, (A(d).bodyText.split(/\s+/).length).toLocaleString() + ' words', readStats(A(d).bodyText).minutes + ' min read'].filter(Boolean).join(' · ');
  const mainSubject = d => A(d).kw.slice(0, 4).map(k => k.word).join(', ');
  const bullets = arr => arr.map(s => '- ' + s).join('\n');

  const modes = {
    quick(d) {
      if (tooShort(d)) return SHORT;
      const t = top(d, 3);
      return `${head(d)}${sub(d)}\n\n**Main subject:** ${mainSubject(d)}\n\n${t.map(x => x.s).join(' ')}\n\n> Extractive summary: these are the highest-scoring sentences from the page, chosen by word frequency and position, not rewritten.`;
    },
    detailed(d) {
      if (tooShort(d)) return SHORT;
      const a = A(d), secs = sections(d);
      let out = `${head(d)}${sub(d)}\n\n**Overview**\n${top(d, 4).map(x => x.s).join(' ')}\n`;
      if (secs.length > 1) {
        out += '\n**Section by section**\n';
        for (const s of secs.slice(0, 10)) {
          const dd = textToDoc(s.body); const ss = sentences(s.body);
          const pool = ss.map((x, i) => ({ i, s: x, score: scoreSentence(x, a.freq, a.title, i, ss.length) }));
          const t = top(dd, 2, pool);
          out += `\n### ${s.heading}\n${(t.length ? t.map(x => x.s).join(' ') : clip(s.body, 240))}\n`;
        }
      }
      out += `\n**Key terms:** ${a.kw.slice(0, 10).map(k => k.word).join(', ')}`;
      const rs = readStats(a.bodyText);
      out += `\n\n**Reading level:** ${rs.label}${rs.grade != null ? ` (about grade ${rs.grade})` : ''} · ${d.links.length} links on page`;
      return out;
    },
    keypoints(d) {
      if (tooShort(d)) return SHORT;
      const t = top(d, 7);
      return `${head(d)}**Key points**\n${bullets(t.map(x => clip(x.s, 280)))}\n\n**Key terms:** ${A(d).kw.slice(0, 8).map(k => k.word).join(', ')}`;
    },
    simple(d) {
      if (tooShort(d)) return SHORT;
      const t = top(d, 6).map(x => simplifyText(x.s));
      const hw = hardWords(t.join(' '), 6);
      let out = `${head(d)}**In simpler words**\n${bullets(t)}\n\n> Rule-based simplification: long sentences are split and common formal words swapped for plainer ones. It doesn’t rephrase ideas the way a person would.`;
      if (hw.length) out += `\n\n**Words that may still be tricky**\n${bullets(hw.map(w => GLOSS[w] ? `**${w}** — ${GLOSS[w]}` : `**${w}**`))}`;
      return out;
    },
    study(d) {
      if (tooShort(d)) return SHORT;
      const a = A(d), defs = definitions(a.bodyText).slice(0, 8), secs = sections(d);
      let out = `## Revision notes${d.title ? ': ' + d.title : ''}\n**Topic:** ${mainSubject(d)}\n`;
      if (defs.length) out += `\n### Key terms\n${bullets(defs.map(x => `**${x.term}** — ${clip(x.def, 160)}`))}\n`;
      const rest = a.kw.map(k => k.word).filter(w => !defs.some(x => x.term.toLowerCase().includes(w))).slice(0, 8);
      if (rest.length) out += `\n**Also worth knowing:** ${rest.join(', ')}\n`;
      out += '\n### Section notes\n';
      if (secs.length > 1) for (const s of secs.slice(0, 10)) { const ss = sentences(s.body); const pool = ss.map((x, i) => ({ i, s: x, score: scoreSentence(x, a.freq, a.title, i, ss.length) })); out += `\n**${s.heading}**\n${bullets(top(textToDoc(s.body), 2, pool).map(x => clip(x.s, 200)))}\n`; }
      else out += bullets(top(d, 6).map(x => clip(x.s, 200))) + '\n';
      const ds = dates(a.bodyText).slice(0, 6);
      if (ds.length) out += `\n### Dates to remember\n${bullets(ds.map(x => `**${x.value}** — ${clip(x.sentence, 140)}`))}\n`;
      const qs = [...defs.slice(0, 3).map(x => `What is ${x.term}?`), ...secs.slice(0, 3).map(s => `Explain: ${s.heading}`)].slice(0, 5);
      if (qs.length) out += `\n### Self-test questions\n${bullets(qs)}`;
      return out;
    },
    facts(d) {
      const text = A(d).bodyText;
      if (text.length < 80) return SHORT;
      const ds = dates(text).slice(0, 12), fs = figures(text).slice(0, 12), ns = names(text), cs = claims(d);
      let out = `${head(d)}**Fact extraction**\n> Everything below is **as written on the page**. ORACLE has not checked any of it against another source, so treat it as extracted claims, not verified facts. Names are detected from capital letters and can include false positives.\n`;
      out += `\n### Dates\n${ds.length ? bullets(ds.map(x => `**${x.value}** — ${clip(x.sentence, 150)}`)) : '_None found._'}\n`;
      out += `\n### Figures and statistics\n${fs.length ? bullets(fs.map(x => `**${x.value}** — ${clip(x.sentence, 150)}`)) : '_None found._'}\n`;
      out += `\n### Possible names and organisations\n${ns.length ? bullets(ns.map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ''}`)) : '_None found._'}\n`;
      out += `\n### Statements presented as claims or findings\n${cs.length ? bullets(cs.map(s => clip(s, 240))) : '_None found._'}`;
      return out;
    }
  };

  function overview(d) {
    const a = A(d), rs = readStats(a.bodyText);
    const ext = d.links.filter(l => l.external).length;
    return `## Website overview\n- **Title:** ${d.title || '(none)'}\n- **Domain:** ${d.domain || '(unknown)'}\n- **Headings:** ${d.blocks.filter(b => b.t[0] === 'h').length}\n- **Content length:** ${rs.words.toLocaleString()} words in ${d.blocks.length} blocks\n- **Links:** ${d.links.length} (${ext} external, ${d.links.length - ext} internal)\n- **Reading time:** about ${rs.minutes} min\n- **Difficulty:** ${rs.label}${rs.grade != null ? ` (grade ${rs.grade}, Flesch ${rs.ease})` : ''}\n- **Main subject:** ${mainSubject(d) || 'unclear'}`;
  }
  function readingStatsText(d) {
    const rs = readStats(A(d).bodyText);
    return `## Reading statistics\n- **Words:** ${rs.words.toLocaleString()}\n- **Estimated reading time:** ${rs.minutes} min (at 230 words/min)\n- **Sentences:** ${rs.sentences} (average ${rs.avgSentence || '–'} words)\n- **Difficulty:** ${rs.label}${rs.grade != null ? ` — Flesch score ${rs.ease}, about grade ${rs.grade}` : ''}\n- **Long words (9+ letters):** ${rs.longWordPct}%`;
  }
  function headingsText(d) {
    const hs = d.blocks.filter(b => b.t[0] === 'h');
    return hs.length ? `## Page outline\n${hs.map(h => '  '.repeat(Math.max(0, +h.t[1] - 1)) + '- ' + h.text).join('\n')}` : 'This page has no headings that ORACLE could detect.';
  }
  function linksText(d, n = 40) {
    if (!d.links.length) return 'No links were found on this page.';
    return `## Links (${d.links.length})\n${bullets(d.links.slice(0, n).map(l => `${clip(l.text, 70)} — ${l.href}`))}${d.links.length > n ? `\n\n…and ${d.links.length - n} more. The dashboard (Tools → Page tools) can list them all.` : ''}`;
  }
  function keywordsText(d) {
    return `## Keywords\n${A(d).kw.map(k => `**${k.word}** ×${k.count}`).join(' · ')}`;
  }
  function answer(q, d) {
    const a = A(d), qt = uniq(words(q).filter(w => !STOP.has(w) && w.length > 2).map(stem));
    if (!qt.length) return null;
    const df = new Map(); a.sents.forEach(s => { for (const t of new Set(words(s).map(stem))) df.set(t, (df.get(t) || 0) + 1); });
    const r = a.sents.map((s, i) => { const st = new Set(words(s).map(stem)); let sc = 0; for (const t of qt) if (st.has(t)) sc += 1 + 1 / (df.get(t) || 1); return { s, i, sc }; }).filter(x => x.sc > 0).sort((x, y) => y.sc - x.sc).slice(0, 3);
    if (!r.length) return null;
    return `Here are the passages on this page that best match **${qt.join(', ')}**:\n\n${bullets(r.sort((x, y) => x.i - y.i).map(x => clip(x.s, 320)))}\n\n> This is keyword matching, not reasoning. ORACLE found these sentences but can’t judge whether they fully answer your question.`;
  }
  function compare(a, b) {
    const ka = keywords(A(a).bodyText, 25), kb = keywords(A(b).bodyText, 25);
    const sa = new Set(ka.map(k => k.stem)), sb = new Set(kb.map(k => k.stem));
    const shared = ka.filter(k => sb.has(k.stem)).map(k => k.word);
    const onlyA = ka.filter(k => !sb.has(k.stem)).slice(0, 8).map(k => k.word), onlyB = kb.filter(k => !sa.has(k.stem)).slice(0, 8).map(k => k.word);
    const jac = shared.length / Math.max(1, new Set([...sa, ...sb]).size);
    const ra = readStats(A(a).bodyText), rb = readStats(A(b).bodyText);
    const hs = d => d.blocks.filter(x => x.t[0] === 'h').length;
    const label = jac > 0.4 ? 'very similar topics' : jac > 0.2 ? 'overlapping topics' : jac > 0.08 ? 'loosely related' : 'mostly unrelated';
    return `## Page comparison\n**A:** ${a.title || a.domain}\n**B:** ${b.title || b.domain}\n\n**Topic overlap:** ${Math.round(jac * 100)}% of key terms shared — ${label}.\n\n| | A | B |\n|---|---|---|\n| Words | ${ra.words.toLocaleString()} | ${rb.words.toLocaleString()} |\n| Reading time | ${ra.minutes} min | ${rb.minutes} min |\n| Difficulty | ${ra.label} | ${rb.label} |\n| Headings | ${hs(a)} | ${hs(b)} |\n| Links | ${a.links.length} | ${b.links.length} |\n\n**Shared terms:** ${shared.slice(0, 12).join(', ') || 'none'}\n**Only in A:** ${onlyA.join(', ') || 'none'}\n**Only in B:** ${onlyB.join(', ') || 'none'}\n\n**A in brief:** ${top(a, 2).map(x => x.s).join(' ') || '—'}\n\n**B in brief:** ${top(b, 2).map(x => x.s).join(' ') || '—'}`;
  }

  /* ───────── revision generator ───────── */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function cloze(d, n) {
    const a = A(d), out = [];
    for (const r of top(d, n * 2)) {
      if (out.length >= n) break;
      const toks = words(r.s).filter(w => !STOP.has(w) && w.length > 4 && a.freq.get(stem(w)) > 0.15);
      if (!toks.length) continue;
      const ans = toks.sort((x, y) => (a.freq.get(stem(y)) || 0) - (a.freq.get(stem(x)) || 0))[0];
      const re = new RegExp('\\b' + ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (!re.test(r.s) || r.s.length > 300) continue;
      out.push({ sentence: r.s.replace(re, '_____'), answer: ans });
    }
    return out;
  }
  function flashcards(d, max = 14) {
    const a = A(d), cards = [];
    definitions(a.bodyText).slice(0, 6).forEach(x => cards.push({ q: `What is ${x.term}?`, a: clip(x.sentence, 300) }));
    sections(d).slice(0, 4).forEach(s => { const ss = sentences(s.body); const t = top(textToDoc(s.body), 1, ss.map((x, i) => ({ i, s: x, score: scoreSentence(x, a.freq, a.title, i, ss.length) }))); if (t[0]) cards.push({ q: `What does the section “${clip(s.heading, 60)}” say?`, a: clip(t[0].s, 300) }); });
    dates(a.bodyText).slice(0, 4).forEach(x => { if (x.sentence.length < 260) cards.push({ q: `Fill in the date: ${x.sentence.replace(x.value, '_____')}`, a: x.value }); });
    cloze(d, 6).forEach(c => cards.push({ q: `Fill in the blank: ${c.sentence}`, a: c.answer }));
    return cards.slice(0, max);
  }
  function quiz(d, max = 8) {
    const a = A(d), pool = a.kw.map(k => k.word), qs = [];
    for (const c of cloze(d, max + 2)) {
      const wrong = shuffle(pool.filter(w => w.toLowerCase() !== c.answer)).slice(0, 3);
      if (wrong.length < 3) continue;
      const options = shuffle([c.answer, ...wrong]);
      qs.push({ q: c.sentence, options, answer: options.indexOf(c.answer) });
      if (qs.length >= max) break;
    }
    return qs;
  }
  const cardsText = cs => cs.length ? `## Flashcards\n${cs.map((c, i) => `**Q${i + 1}.** ${c.q}\n**A:** ${c.a}`).join('\n\n')}` : 'There wasn’t enough structured text to build flashcards from.';
  const quizText = qs => qs.length ? `## Quiz\n${qs.map((q, i) => `**${i + 1}.** ${q.q}\n${q.options.map((o, k) => `   ${'ABCD'[k]}) ${o}`).join('\n')}`).join('\n\n')}\n\n**Answers:** ${qs.map((q, i) => `${i + 1}${'ABCD'[q.answer]}`).join(' · ')}` : 'There wasn’t enough text to build a quiz from. Quizzes need a page with a few paragraphs of content.';

  /* ───────── selected-text actions ───────── */
  function textAction(action, text, extra) {
    text = String(text || '').trim();
    if (!text) return 'Nothing selected yet. Highlight some text on a page, or paste it in.';
    const d = textToDoc(text), words_ = words(text).length, ss = sentences(text);
    switch (action) {
      case 'explain': {
        const rs = readStats(text), kw = keywords(text, 6).map(k => k.word), hw = hardWords(text, 5);
        let o = `## Explanation\n**What it covers:** ${kw.length ? kw.join(', ') : 'too little text to find a topic'}\n**Reading level:** ${rs.label}${rs.grade != null ? ` (about grade ${rs.grade})` : ''}\n\n**In plainer words:**\n${simplifyText(text)}`;
        if (hw.length) o += `\n\n**Terms to look at**\n${bullets(hw.map(w => GLOSS[w] ? `**${w}** — ${GLOSS[w]}` : `**${w}** — not in the built-in glossary`))}`;
        return o + '\n\n> ORACLE can restate and simplify wording, but it can’t reason about meaning the way a person or an AI model can.';
      }
      case 'simplify': { const s = simplifyText(text); return `## Simpler version\n${s}\n\n> ${s === text ? 'Nothing to simplify here: no long sentences or formal words matched ORACLE’s rules.' : 'Rule-based: long sentences split, formal words swapped.'}`; }
      case 'summarise': {
        if (ss.length <= 2) return `That is already short (${words_} words), so there’s nothing to cut.`;
        return `## Summary\n${top(d, Math.min(3, Math.ceil(ss.length / 3))).map(x => x.s).join(' ')}`;
      }
      case 'define': {
        const hw = hardWords(text, 6); const single = words_ <= 3 && !/[.!?]/.test(text);
        if (single) return words(text).map(w => defineWord(w, null, extra && extra.userDefs)).join('\n\n');
        return hw.length ? `## Difficult words\n${hw.map(w => defineWord(w, d, extra && extra.userDefs)).join('\n\n')}` : 'No difficult words found in this selection.';
      }
      case 'keypoints': { const t = top(d, Math.min(5, ss.length)); return ss.length < 2 ? `## Key points\n${bullets([text])}` : `## Key points\n${bullets(t.map(x => clip(x.s, 260)))}\n\n**Key terms:** ${keywords(text, 6).map(k => k.word).join(', ')}`; }
      case 'revision': {
        const defs = definitions(text), ds = dates(text), kw = keywords(text, 8).map(k => k.word);
        let o = `## Revision notes\n**Topic:** ${kw.slice(0, 3).join(', ') || '—'}\n`;
        if (defs.length) o += `\n### Definitions\n${bullets(defs.map(x => `**${x.term}** — ${clip(x.def, 160)}`))}\n`;
        o += `\n### Main ideas\n${bullets(top(d, Math.min(5, Math.max(1, ss.length))).map(x => clip(x.s, 220)))}\n`;
        if (ds.length) o += `\n### Dates\n${bullets(ds.map(x => `**${x.value}** — ${clip(x.sentence, 120)}`))}\n`;
        return o + `\n**Key terms:** ${kw.join(', ')}`;
      }
      case 'flashcards': return cardsText(flashcards(d, 10));
      case 'translate': return translate(text, (extra && extra.lang) || 'es');
      default: return 'ORACLE doesn’t know that action.';
    }
  }

  /* ───────── intent recognition & chat router ───────── */
  const INTENTS = [
    ['clear', [[/\b(clear|reset|wipe|delete)\b.*\b(chat|conversation|history)\b/, 6]]],
    ['greet', [[/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/, 4]]],
    ['thanks', [[/\b(thanks|thank you|cheers)\b/, 4]]],
    ['help', [[/\b(help|what can you do|commands|capabilities|features|how do (i|you) use)\b/, 4]]],
    ['readstats', [[/\b(reading time|how long (is|will|does|to|would|should)|word count|how many words|readab|reading level|difficulty|how hard|reading stat)/, 6]]],
    ['overview', [[/\b(website|site|page) overview\b|\babout (this|the) (site|website|domain)\b/, 6]]],
    ['summarize_detailed', [[/\b(detailed|full|comprehensive|in[- ]depth|long)\b.*\b(summary|summari[sz]e|breakdown)\b|\bbreak(?:\s|-)?down\b/, 5]]],
    ['summarize', [[/\b(summari[sz]e|summary|tl;?dr|gist|sum up|overview|what is (this|the) (page|article|site|post) about)\b/, 3]]],
    ['keypoints', [[/\b(main|key|important|major) (points?|ideas?|takeaways?)\b|\bkey ?points?\b|\btakeaways?\b|\bbullet points?\b/, 4]]],
    ['simplify', [[/\b(simpl(y|er|ify|e)|easier|plain (english|words|language)|eli5|layman|dumb it down|in simple)\b/, 4]]],
    ['study', [[/\b(revision|revise|study (notes|mode|guide)|lecture notes|turn .* into notes|make notes)\b/, 5], [/\bnotes\b/, 2]]],
    ['facts', [[/\b(dates?|facts?|statistics|stats|numbers|figures|claims|people mentioned|names mentioned)\b/, 4]]],
    ['flashcards', [[/\bflash ?cards?\b/, 6]]],
    ['quiz', [[/\b(quiz|test me|practice questions|multiple choice)\b/, 6]]],
    ['links', [[/\b(links?|urls?|hyperlinks?)\b/, 4]]],
    ['headings', [[/\b(headings?|outline|table of contents|structure|sections)\b/, 4]]],
    ['keywords', [[/\bkeywords?\b|\bmain subject\b|\btopics?\b/, 4]]],
    ['define', [[/\b(define|definition of|what does .+ mean|meaning of|what'?s the meaning|what is the meaning)\b/, 5]]],
    ['explain', [[/\bexplain\b/, 3]]],
    ['find', [[/^(?:please )?(?:find|search(?: for)?|highlight|look for) (?!the important|important|dates|facts)(.+)/, 3], [/\b(?:find|search|look for|highlight) .+ (?:on|in) (?:this |the )?page\b/, 5]]],
    ['tabs', [[/\b(tabs?|duplicate tabs?|open tabs)\b/, 4]]],
    ['save', [[/\b(save|bookmark|store|add)\b.*\b(page|summary|vault|this)\b/, 4]]],
    ['compare', [[/\bcompare\b/, 5]]],
    ['vault', [[/\b(my vault|saved (notes|items|knowledge)|knowledge vault|search (my )?vault)\b/, 6]]]
  ];
  function detect(lc) {
    let best = null;
    for (const [id, rules] of INTENTS) {
      let s = 0; for (const [re, w] of rules) if (re.test(lc)) s += w;
      if (s && (!best || s > best.score)) best = { id, score: s };
    }
    return best && best.score >= 2 ? best : { id: 'none', score: 0 };
  }
  function extractWord(m) {
    const r = [/what does ["“'‘]?([\p{L}][\p{L}\- ]{1,40}?)["”'’]? mean/iu, /(?:define|definition of|meaning of|meaning for)\s+["“'‘]?([\p{L}][\p{L}\- ]{1,40})/iu];
    for (const re of r) { const x = m.match(re); if (x) { const w = x[1].trim().replace(/[?.!]+$/, ''); if (!/^(this|that|the|a|an) (word|term|phrase)$/i.test(w) && !/^(this|that|it|word|term|selection|the selection|selected text)$/i.test(w)) return w.toLowerCase(); } }
    return '';
  }
  const SUG = {
    default: ['Summarise this page', 'What are the main points?', 'Turn this into revision notes', 'Find the important dates'],
    afterSummary: ['What are the main points?', 'Explain that more simply', 'Turn this into revision notes', 'Save this page'],
    afterNotes: ['Create flashcards', 'Quiz me on this page', 'Save this page', 'Find the important dates'],
    afterFacts: ['Summarise this page', 'Create flashcards', 'Show page overview']
  };
  const HELP = `## What ORACLE can do\nORACLE’s page tools use local rules, and optional Local AI can answer open-ended questions and explain topics using Chrome’s on-device model. It does not need a paid API key or AI server.\n\n**Try saying**\n- “Summarise this page” / “Give me a detailed summary”\n- “What are the main points?”\n- “Explain that more simply”\n- “Turn this into revision notes”\n- “Find the important dates”\n- “Create flashcards” / “Quiz me”\n- “Define <word>”, “Find <text> on this page”\n- “Show page overview”, “How long to read this?”, “List the links”\n- “Show my tabs”, “Save this page”, “Search my vault for <topic>”\n\nYou can also ask a question about the page and ORACLE will pull out the most relevant passages.`;

  async function handle(msg, env, ctx) {
    ctx = ctx || {}; env = env || {};
    const m = String(msg || '').trim(), lc = m.toLowerCase();
    const it = detect(lc);
    const page = () => { if (!env.getPage) throw new Error('No page is connected right now.'); return env.getPage(); };
    const R = (text, o) => Object.assign({ text, suggestions: SUG.default, state: 'responding', intent: it.id }, o || {});
    try {
      switch (it.id) {
        case 'greet': return R('Hello. I’m ORACLE, a private, on-device browser companion. Ask me about the page you’re on, or pick a suggestion below.');
        case 'thanks': return R('Any time. Everything stays on your device.');
        case 'help': return R(HELP);
        case 'clear': return R('Conversation cleared.', { clear: true });
        case 'summarize': return R(modes.quick(await page()), { suggestions: SUG.afterSummary });
        case 'summarize_detailed': return R(modes.detailed(await page()), { suggestions: SUG.afterSummary });
        case 'keypoints': return R(modes.keypoints(await page()), { suggestions: SUG.afterSummary });
        case 'study': return R(modes.study(await page()), { suggestions: SUG.afterNotes });
        case 'facts': return R(modes.facts(await page()), { suggestions: SUG.afterFacts });
        case 'overview': return R(overview(await page()));
        case 'readstats': return R(readingStatsText(await page()));
        case 'links': return R(linksText(await page()));
        case 'headings': return R(headingsText(await page()));
        case 'keywords': return R(keywordsText(await page()));
        case 'flashcards': return R(cardsText(flashcards(await page())), { suggestions: ['Quiz me on this page', 'Save this page'] });
        case 'quiz': return R(quizText(quiz(await page())), { suggestions: ['Create flashcards', 'Turn this into revision notes'] });
        case 'simplify': {
          const sel = /\b(selected|selection|highlight)/.test(lc) && env.getSelection ? await env.getSelection() : '';
          if (sel) return R(textAction('simplify', sel));
          if (ctx.last && /\b(that|this|it|previous|last|above)\b/.test(lc) && !/\bpage\b/.test(lc)) {
            const plain = ctx.last.replace(/^[#>\-\s*]+/gm, '').replace(/\*\*/g, '');
            return R(`## Simpler version\n${simplifyText(plain)}\n\n> Rule-based simplification of my previous reply.`);
          }
          return R(modes.simple(await page()), { suggestions: SUG.afterSummary });
        }
        case 'define': {
          let w = extractWord(m);
          if (!w && env.getSelection) { const s = (await env.getSelection().catch(() => '')) || ''; if (s && s.split(/\s+/).length <= 3) w = s.trim().toLowerCase(); }
          if (!w) return R('Which word? Select it on the page and say “define selection”, or type **define <word>**.');
          let d = null; try { d = await page(); } catch (e) { /* page optional */ }
          const userDefs = env.vaultDefs ? await env.vaultDefs() : [];
          const localDefinition = defineWord(w, d, userDefs);
          const isKnownLocally = !localDefinition.includes('isn’t in ORACLE’s bundled definition set yet.');
          if (isKnownLocally) return R(localDefinition);
          if (O.dictionaryFull) {
            const offline = await O.dictionaryFull.lookup(w).catch(() => null);
            if (offline) return R(O.dictionaryFull.format(offline));
          }
          if (env.lookupDefinition) {
            const expanded = await env.lookupDefinition(w).catch(() => null);
            if (expanded) return R(expanded);
          }
          return R(localDefinition);
        }
        case 'explain': {
          if (/\b(selected|selection|highlight)/.test(lc) && env.getSelection) {
            const selected = await env.getSelection();
            if (env.askAI) {
              try { return R(await env.askAI(m, null, selected)); } catch (error) {
                if (!/first-time setup|not supported|unavailable/i.test(error.message || '')) throw error;
              }
            }
            return R(textAction('explain', selected));
          }
          if (/\b(page|article|site|post)\b/.test(lc)) {
            const d = await page();
            if (env.askAI) {
              try { return R(await env.askAI(m, d)); } catch (error) {
                if (!/first-time setup|not supported|unavailable/i.test(error.message || '')) throw error;
              }
            }
            return R(modes.simple(d), { suggestions: SUG.afterSummary });
          }
          if (ctx.last && /\b(that|this|it)\b/.test(lc)) {
            const plain = ctx.last.replace(/^[#>\-\s*]+/gm, '').replace(/\*\*/g, '');
            return R(textAction('explain', plain));
          }
          if (env.askAI) {
            try { return R(await env.askAI(m)); } catch (error) {
              if (!/first-time setup|not supported|unavailable/i.test(error.message || '')) throw error;
            }
          }
          const rest = m.replace(/^explain\s+/i, '');
          if (words(rest).length <= 3) return R(defineWord(rest, await page().catch(() => null), env.vaultDefs ? await env.vaultDefs() : []));
          const ans = answer(rest, await page()); if (ans) return R(ans);
          break;
        }
        case 'find': {
          const t = (m.match(/["“']([^"”']{2,})["”']/) || [])[1] || m.replace(/^(please )?(find|search( for)?|look for|highlight)\s+/i, '').replace(/\s+(on|in)\s+(this |the )?page\.?$/i, '').trim();
          if (!env.find) throw new Error('Page search isn’t available here.');
          const r = await env.find(t);
          return R(r.count ? `Found **${r.count}** match${r.count > 1 ? 'es' : ''} for “${t}” and highlighted ${r.count > 1 ? 'them' : 'it'} on the page. Use Tools → Page tools in the dashboard to step through matches.` : `No matches for “${t}” on this page.`);
        }
        case 'tabs': {
          if (!env.listTabs) throw new Error('Tab information isn’t available here.');
          const { tabs, duplicates } = await env.listTabs();
          let o = `## Open tabs (${tabs.length})\n${bullets(tabs.slice(0, 15).map(t => clip(t.title || t.url, 80)))}`;
          if (tabs.length > 15) o += `\n\n…and ${tabs.length - 15} more.`;
          o += duplicates.length ? `\n\n**Duplicates:** ${duplicates.length} set${duplicates.length > 1 ? 's' : ''} of repeated tabs (${duplicates.reduce((n, g) => n + g.length - 1, 0)} extra). Closing needs your confirmation: open the dashboard → Tools → Tab manager.` : '\n\nNo duplicate tabs found.';
          return R(o);
        }
        case 'save': {
          if (!env.savePage) throw new Error('Saving isn’t available here.');
          const r = await env.savePage(/\bbookmark\b/.test(lc) ? 'bookmark' : 'vault');
          return R(r);
        }
        case 'compare': return R('To compare two pages, open the dashboard → **Tools → Compare pages**, pick two open tabs and press Compare.');
        case 'vault': {
          const q = m.replace(/.*\b(search|find|look)( my)?( knowledge)?( vault)?( for)?\s*/i, '').trim();
          const res = env.vaultSearch ? await env.vaultSearch(/vault/i.test(q) ? '' : q) : [];
          return R(res.length ? `## Vault results (${res.length})\n${bullets(res.slice(0, 8).map(e => `**${clip(e.title, 70)}** (${e.type}) — ${clip((e.text || '').replace(/\s+/g, ' '), 120)}`))}` : 'Nothing in your vault matches that yet.');
        }
      }
      // Open-ended questions use the optional on-device model. Page text is only
      // included when the user clearly asks about the current page or article.
      const isQ = /\?$|^(what|who|when|where|why|how|does|do|is|are|can|which|tell me)\b/.test(lc);
      if ((it.id === 'none' || isQ) && env.askAI && words(m).length >= 2) {
        const asksAboutPage = /\b(this|current|that|the)\s+(page|article|website|site|post|text|passage|document)\b|\b(on|in|from)\s+(this|the)\s+(page|article|website|site|post)\b|\baccording to (this|the) (page|article)\b/i.test(m);
        let doc = null;
        if (asksAboutPage) { try { doc = await page(); } catch (e) { /* page may not be readable */ } }
        return R(await env.askAI(m, doc));
      }
      if (isQ || words(m).length >= 3) {
        let doc = null; try { doc = await page(); } catch (e) { /* none */ }
        if (doc) { const found = answer(m, doc); if (found) return R(found); return R('I couldn’t find anything about that on this page. ORACLE only matches keywords in the page text, so try different words, or say **help** to see what I can do.'); }
      }
      return R('I’m not able to process that. Enable Chrome’s on-device Local AI in Dashboard → Settings for open-ended questions, or say **help** to see the available tools.', { state: 'error' });
    } catch (e) {
      return { text: '**I couldn’t do that.** ' + (e && e.message ? e.message : String(e)), suggestions: ['Help'], state: 'error', intent: it.id };
    }
  }

  /* ───────── markdown-lite → safe HTML ───────── */
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  }
  function md(src) {
    const lines = String(src).split('\n'); let html = '', list = false, para = [], table = [];
    const flushP = () => { if (para.length) { html += '<p>' + para.join('<br>') + '</p>'; para = []; } };
    const flushL = () => { if (list) { html += '</ul>'; list = false; } };
    const flushT = () => {
      if (!table.length) return;
      const rows = table.filter(r => !/^\|[\s|:-]+\|$/.test(r)).map(r => r.split('|').slice(1, -1).map(c => inline(c.trim())));
      html += '<div class="tbl"><table>' + rows.map((r, i) => '<tr>' + r.map(c => i ? `<td>${c}</td>` : `<th>${c}</th>`).join('') + '</tr>').join('') + '</table></div>'; table = [];
    };
    for (const raw of lines) {
      const l = raw.replace(/\s+$/, '');
      if (/^\|.*\|$/.test(l)) { flushP(); flushL(); table.push(l); continue; } else flushT();
      if (!l.trim()) { flushP(); flushL(); continue; }
      let m;
      if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { flushP(); flushL(); html += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; }
      else if ((m = l.match(/^(\s*)[-•]\s+(.*)$/))) { flushP(); if (!list) { html += '<ul>'; list = true; } html += `<li${m[1].length ? ' class="in"' : ''}>${inline(m[2])}</li>`; }
      else if ((m = l.match(/^>\s?(.*)$/))) { flushP(); flushL(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
      else { flushL(); para.push(inline(l)); }
    }
    flushP(); flushL(); flushT();
    return html;
  }
  const plain = s => String(s).replace(/^#{2,3}\s+/gm, '').replace(/\*\*/g, '').replace(/^>\s?/gm, '').replace(/^\|[\s|:-]+\|$/gm, '').replace(/\|/g, ' | ');

  O.nlp = { words, sentences, keywords, freqMap, scoreSentence, stem, readStats, STOP };
  O.md = md; O.plain = plain; O.esc = esc;
  O.engine = { handle, detect, modes, overview, readingStatsText, headingsText, linksText, keywordsText, answer, compare, flashcards, quiz, cardsText, quizText, textAction, defineWord, simplifyText, translate, textToDoc, dates, figures, names, definitions, SUG, GLOSS, dictionarySize: Object.keys(GLOSS).length };
})(typeof self !== 'undefined' ? self : globalThis);
