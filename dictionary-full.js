/* ORACLE expanded offline dictionary loader.
   Data is packaged with the extension and loaded one alphabet shard at a time. */
(function (g) {
  'use strict';

  const O = (g.ORACLE = g.ORACLE || {});
  const ROOT = 'dictionary-data/';
  const shardCache = new Map();
  const shardLoads = new Map();
  let metadataPromise = null;

  function normalise(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('en-GB')
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["“'‘]+|["”'’.?!,:;]+$/g, '');
  }

  function shardFor(word) {
    const first = word.slice(0, 1);
    return /^[a-z]$/.test(first) ? first : 'other';
  }

  function assetUrl(path) {
    if (g.chrome && g.chrome.runtime && typeof g.chrome.runtime.getURL === 'function') {
      return g.chrome.runtime.getURL(ROOT + path);
    }
    return ROOT + path;
  }

  async function loadMetadata() {
    const response = await fetch(assetUrl('metadata.json'));
    if (!response.ok) throw new Error('The offline dictionary index could not be read (' + response.status + ').');
    return response.json();
  }

  function metadata() {
    if (!metadataPromise) metadataPromise = loadMetadata();
    return metadataPromise;
  }

  async function loadShard(key) {
    if (shardCache.has(key)) return shardCache.get(key);
    if (shardLoads.has(key)) return shardLoads.get(key);
    const operation = (async () => {
      if (typeof g.DecompressionStream !== 'function') {
        throw new Error('This browser cannot decompress the bundled offline dictionary. Update Microsoft Edge and try again.');
      }
      const response = await fetch(assetUrl(key + '.json.gz'));
      if (!response.ok) throw new Error('Offline dictionary shard ' + key + ' could not be loaded (' + response.status + ').');
      const compressed = await response.arrayBuffer();
      const stream = new Blob([compressed]).stream().pipeThrough(new g.DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      const data = JSON.parse(text);
      shardCache.set(key, data);
      return data;
    })();
    shardLoads.set(key, operation);
    try {
      return await operation;
    } finally {
      shardLoads.delete(key);
    }
  }

  function candidates(word) {
    const result = [word];
    const add = value => { if (value && !result.includes(value)) result.push(value); };
    if (/ies$/.test(word) && word.length > 4) add(word.slice(0, -3) + 'y');
    if (/ied$/.test(word) && word.length > 4) add(word.slice(0, -3) + 'y');
    if (/ves$/.test(word) && word.length > 4) {
      add(word.slice(0, -3) + 'f');
      add(word.slice(0, -3) + 'fe');
    }
    if (/ing$/.test(word) && word.length > 5) {
      const base = word.slice(0, -3);
      add(base);
      if (/(.)\1$/.test(base)) add(base.slice(0, -1));
      add(base + 'e');
    }
    if (/ed$/.test(word) && word.length > 4) {
      const base = word.slice(0, -2);
      add(base);
      if (/(.)\1$/.test(base)) add(base.slice(0, -1));
      add(base + 'e');
    }
    if (/es$/.test(word) && word.length > 4) add(word.slice(0, -2));
    if (/s$/.test(word) && word.length > 3) add(word.slice(0, -1));
    return result;
  }

  async function lookup(value) {
    const word = normalise(value);
    if (!word) return null;
    const key = shardFor(word);
    const data = await loadShard(key);
    for (const candidate of candidates(word)) {
      const senses = data[candidate];
      if (Array.isArray(senses) && senses.length) {
        return { query: word, matched: candidate, senses: senses.slice(0, 8) };
      }
    }
    return null;
  }

  function escapeMarkdown(value) {
    return String(value || '').replace(/([\\*_\[\]<>])/g, '\\$1');
  }

  function labelPos(pos) {
    return ({ n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' })[pos] || 'word';
  }

  function format(result) {
    if (!result || !result.senses || !result.senses.length) return '';
    const lines = ['## ' + escapeMarkdown(result.query)];
    result.senses.forEach((sense, index) => {
      lines.push('**' + (index + 1) + '. ' + labelPos(sense.pos) + '** — ' + sense.definition);
      if (sense.example) lines.push('> Example: ' + sense.example);
      if (sense.related && sense.related.length) {
        lines.push('> Related: ' + sense.related.map(escapeMarkdown).join(', '));
      }
    });
    lines.push('> Source: Open English WordNet 2025+ (CC BY 4.0).');
    return lines.join('\n\n');
  }

  O.dictionaryFull = Object.freeze({ lookup, format, metadata, loadedShards: () => [...shardCache.keys()] });
})(typeof self !== 'undefined' ? self : globalThis);
