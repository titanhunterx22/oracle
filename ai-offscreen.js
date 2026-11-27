/* One hidden extension document owns the WebLLM worker for popup, dashboard and page tools. */
(function (g) {
  'use strict';
  const O = g.ORACLE;
  let preparing = null;
  let progress = { percent: 0, detail: 'Waiting for local model setup' };
  let lastError = '';

  function updateProgress(percent, detail) {
    progress = {
      percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
      detail: String(detail || 'Preparing Qwen 2.5 1.5B')
    };
  }

  async function status() {
    if (!O || !O.localAI) throw new Error('The local AI runtime did not load in its offscreen document.');
    if (preparing) {
      return {
        state: 'preparing',
        message: progress.detail + (progress.percent ? ' · ' + progress.percent + '%' : ''),
        progress,
        lastError: ''
      };
    }
    const info = await O.localAI.status();
    if (lastError) return Object.assign({}, info, { lastError, message: lastError });
    return Object.assign({}, info, { progress });
  }

  function beginPrepare() {
    if (preparing) return;
    lastError = '';
    updateProgress(0, 'Checking WebGPU and preparing Qwen');
    preparing = O.localAI.prepare(updateProgress)
      .then(result => {
        updateProgress(100, 'Local AI is ready');
        return result;
      })
      .catch(error => {
        lastError = error && error.message ? error.message : String(error);
        throw error;
      })
      .finally(() => { preparing = null; });
    // The prepare request is acknowledged immediately; clients poll status for progress.
    preparing.catch(() => {});
  }

  g.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'oracle:ai:offscreen') return false;
    (async () => {
      if (!O || !O.localAI) throw new Error('The local AI adapter has not loaded yet.');
      switch (message.action) {
        case 'status':
          return { ok: true, info: await status() };
        case 'prepare':
          beginPrepare();
          return { ok: true, started: true };
        case 'ask':
        case 'askTask':
          if (preparing) await preparing;
          lastError = '';
          if (message.action === 'askTask') {
            return { ok: true, text: await O.localAI.askTask(message.task, message.options || {}) };
          }
          return { ok: true, text: await O.localAI.ask(message.question, message.options || {}) };
        case 'destroy':
          await O.localAI.destroy();
          return { ok: true };
        default:
          throw new Error('Unknown local AI action: ' + String(message.action || ''));
      }
    })().then(sendResponse).catch(error => sendResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }));
    return true;
  });
})(globalThis);
